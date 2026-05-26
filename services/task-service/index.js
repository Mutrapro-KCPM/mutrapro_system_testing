// services/task-service/index.js
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const axios = require('axios');
const amqp = require('amqplib'); // <-- (MQ) BƯỚC 1: THÊM AMQP
require('dotenv').config({ path: '../.env', quiet: true });

// ======================= SỬA LỖI PATH Ở ĐÂY =======================
const { logger } = require('./shared/logger');
const { asyncHandler, notFound, errorHandler, AppError } = require('./shared/middleware/errorHandler');
const { responseHandler } = require('./shared/middleware/responseHandler');
const { createTaskValidation, idParamValidation } = require('./shared/middleware/validation');
const { authMiddleware, checkRole, assertOwnerOrRole } = require('./shared/middleware/auth');
// ==================================================================

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(express.json());
app.use(responseHandler);

// 🔹 Health check route
app.get('/health', (req, res) => {
  res.status(200).json({
    service: 'task-service',
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_TASK_NAME,
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const pool = mysql.createPool(dbConfig);

// Hàm helper để gửi thông báo
const notify = async (userId, eventName, data) => {
  try {
    await axios.post('http://notification-service:3006/notify', { userId, eventName, data });
  } catch (err) {
    logger.error(`Failed to send notification '${eventName}'.`, { error: err.message });
  }
};

// === (MQ) BƯỚC 2: TÁCH LOGIC RE-OPEN RA HÀM RIÊNG ===
const handleReOpenTask = async (orderId, comment) => {
  // Tìm task mới nhất của order này
  const [taskRows] = await pool.execute(
    'SELECT id, assigned_to FROM task WHERE order_id = ? ORDER BY assigned_at DESC LIMIT 1',
    [orderId]
  );

  if (taskRows.length === 0) {
    logger.error(`[RabbitMQ] No task found for order ${orderId} to reopen.`);
    throw new Error(`Không tìm thấy task cho order ${orderId}`);
  }

  const task = taskRows[0];
  const [updateResult] = await pool.execute(
    "UPDATE task SET status = 'revision_requested', revision_comment = ? WHERE id = ? AND (status = 'done' OR status = 'assigned')", // Cho phép re-open cả task "done" hoặc "assigned" (nếu khách hàng sửa ngay)
    [comment, task.id]
  );

  if (updateResult.affectedRows === 0) {
    logger.warn(`[RabbitMQ] Task ${task.id} is not in a valid state to reopen.`);
    throw new Error(`Task ${task.id} không ở trạng thái hợp lệ`);
  }

  // Gửi thông báo cho chuyên viên
  notify(task.assigned_to, 'task_revision_needed', {
    orderId: orderId,
    taskId: task.id,
    message: `Đơn hàng #${orderId} cần bạn chỉnh sửa lại sản phẩm.`
  });

  logger.info(`Task #${task.id} for order #${orderId} has been re-opened for revision.`);
  return true;
};
// === KẾT THÚC BƯỚC 2 ===

// --- API Endpoints ---

// API: Tạo công việc mới (yêu cầu coordinator)
app.post('/', authMiddleware, checkRole('coordinator'), createTaskValidation, asyncHandler(async (req, res) => {
  const { order_id, assigned_to, specialist_role, deadline } = req.body;

  const [existingTasks] = await pool.execute(
    "SELECT id FROM task WHERE order_id = ? AND status IN ('assigned','in_progress','revision_requested') LIMIT 1",
    [order_id]
  );

  if (existingTasks.length > 0) {
    throw new AppError('Đơn hàng này đã có task đang xử lý.', 409);
  }

  const [result] = await pool.execute(
    `INSERT INTO task (order_id, assigned_to, specialist_role, status, deadline) VALUES (?, ?, ?, 'assigned', ?)`,
    [order_id, assigned_to, specialist_role, deadline]
  );

  // Gửi thông báo cho chuyên viên được giao việc
  notify(assigned_to, 'new_task', {
    orderId: order_id,
    message: `Bạn vừa được giao một công việc mới cho đơn hàng #${order_id}.`
  });

  logger.info(`New task created for order #${order_id}, assigned to user #${assigned_to}`);
  res.status(201).json({ id: result.insertId, message: 'Task created' });
}));

// API: Cập nhật trạng thái công việc (yêu cầu chuyên viên hoặc coordinator)
app.put('/:id/status', authMiddleware, idParamValidation, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, coordinatorId } = req.body;
  const validStatuses = ['assigned', 'in_progress', 'revision_requested', 'done'];

  if (!validStatuses.includes(status)) {
    throw new AppError('Trạng thái task không hợp lệ.', 400);
  }

  const [currentTaskRows] = await pool.execute('SELECT assigned_to FROM task WHERE id = ?', [id]);
  
  if (currentTaskRows.length === 0) {
    throw new AppError('Không tìm thấy task.', 404);
  }

  assertOwnerOrRole(req, currentTaskRows[0].assigned_to, ['admin', 'coordinator']);

  // 1. Cập nhật trạng thái task
  await pool.execute('UPDATE task SET status = ? WHERE id = ?', [status, id]);

  // 2. Lấy order_id (cần cho cả 2 logic bên dưới)
  const [taskRows] = await pool.execute('SELECT order_id FROM task WHERE id = ?', [id]);
  const orderId = taskRows[0]?.order_id;

  if (!orderId) {
    logger.warn(`Task #${id} status updated, but could not find matching orderId.`);
    res.json({ message: 'Task status updated, but failed to find order.' });
    return;
  }

  // 3. (LOGIC MỚI) Nếu task bắt đầu (in_progress), cập nhật cả trạng thái của order
  if (status === 'in_progress') {
    try {
      await axios.put(
        `http://order-service:3002/${orderId}/status`,
        { status: 'in_progress' },
        { headers: { 'X-Internal-Service-Token': process.env.INTERNAL_SERVICE_TOKEN } }
      );
      logger.info(`[Task Service] Notified Order Service to update order ${orderId} to in_progress.`);
    } catch (err) {
      logger.error(`[Task Service] Failed to update order status for order ${orderId}`, { message: err.message });
    }
  }

  // 4. (LOGIC CŨ) Nếu task hoàn thành (done) và có coordinatorId, báo cho coordinator biết
  if (status === 'done' && coordinatorId) {
    notify(coordinatorId, 'task_completed', {
      taskId: id,
      orderId: orderId,
      message: `Công việc cho đơn hàng #${orderId} đã được chuyên viên hoàn thành.`
    });
  }

  logger.info(`Task #${id} status updated to ${status}`);
  res.json({ message: 'Task status updated' });
}));

// API: Lấy task gần nhất theo Order ID (dùng nội bộ)
app.get('/order/:orderId', asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const [rows] = await pool.execute(
    'SELECT * FROM task WHERE order_id = ? ORDER BY assigned_at DESC LIMIT 1',
    [orderId]
  );

  if (rows.length === 0) {
    throw new AppError('Không tìm thấy task cho đơn hàng này.', 404);
  }

  res.json(rows[0]);
}));

// API: Mở lại một task từ trạng thái 'done' (dùng nội bộ bởi order-service)
app.post('/order/:orderId/re-open', asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { comment } = req.body; // Nhận comment từ yêu cầu revision

  // Gọi hàm logic đã tách
  await handleReOpenTask(orderId, comment);
  res.json({ message: 'Task re-opened successfully' });
}));

// API: Lấy danh sách công việc của một chuyên viên
app.get('/specialist/:specialistId', authMiddleware, asyncHandler(async (req, res) => {
  const { specialistId } = req.params;
  assertOwnerOrRole(req, specialistId, ['admin', 'coordinator']);

  const [tasks] = await pool.execute('SELECT * FROM task WHERE assigned_to = ? ORDER BY assigned_at DESC', [specialistId]);
  
  if (tasks.length === 0) {
    return res.json([]);
  }

  // Làm giàu dữ liệu: Lấy mô tả đơn hàng từ order-service (Đã fix Authorization và Fallback tiếng Việt)
  const enrichedTasks = await Promise.all(
    tasks.map(async (task) => {
      try {
        const orderResponse = await axios.get(`http://order-service:3002/${task.order_id}`, {
          headers: { Authorization: req.headers.authorization || `Bearer ${req.token}` }
        });
        const order = orderResponse.data?.data || orderResponse.data;
        return { ...task, description: order.description || 'Không có mô tả đơn hàng.' };
      } catch (error) {
        logger.error(`Không thể lấy chi tiết cho order ID ${task.order_id}`, { message: error.message });
        return { ...task, description: 'Order description unavailable.' };
      }
    })
  );

  res.json(enrichedTasks);
}));

// === (MQ) BƯỚC 4: THÊM HÀM LẮNG NGHE RABBITMQ ===
const amqpUrl = 'amqp://user:password@rabbitmq';
const exchangeName = 'mutrapro_events';
const queueName = 'task_service_queue'; // Tên hàng đợi riêng của service này

async function startMessageListener() {
  let connection;
  try {
    // Chờ 10s để RabbitMQ khởi động xong (cách đơn giản, an toàn)
    logger.info('[RabbitMQ] Waiting 10s for RabbitMQ startup...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    logger.info('[RabbitMQ] Connecting to RabbitMQ...');
    connection = await amqp.connect(amqpUrl);
    const channel = await connection.createChannel();

    // Đảm bảo exchange tồn tại
    await channel.assertExchange(exchangeName, 'topic', { durable: true });

    // Đảm bảo queue tồn tại
    await channel.assertQueue(queueName, { durable: true });

    // Ràng buộc (Bind) queue này với exchange
    const routingKey = 'order.revision_requested';
    await channel.bindQueue(queueName, exchangeName, routingKey);

    logger.info(`[RabbitMQ] Task service listening for key '${routingKey}' on queue '${queueName}'.`);

    // Bắt đầu nhận tin nhắn
    channel.consume(queueName, async (msg) => {
      if (msg.content) {
        try {
          const message = JSON.parse(msg.content.toString());
          logger.info(`[RabbitMQ] Message received (key: ${msg.fields.routingKey}).`, message);

          // Xử lý logic
          if (msg.fields.routingKey === 'order.revision_requested') {
            await handleReOpenTask(message.orderId, message.comment);
          }

          // Báo cho RabbitMQ biết là đã xử lý xong
          channel.ack(msg);
        } catch (err) {
          logger.error('[RabbitMQ] Failed to process message.', { message: err.message });
          // Báo cho RabbitMQ biết là xử lý lỗi (để nó thử gửi lại sau)
          channel.nack(msg, false, true);
        }
      }
    });

  } catch (err) {
    logger.error('[RabbitMQ] Failed to connect or listen.', { message: err.message });
    // Thử kết nối lại sau 5 giây
    setTimeout(startMessageListener, 5000);
  }
}
// === KẾT THÚC BƯỚC 4 ===

// --- Middleware xử lý cuối cùng ---
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
  logger.info(`Task Service is running on port ${PORT}`);
  startMessageListener(); // <-- (MQ) BƯỚC 4: KHỞI ĐỘNG LISTENER
});