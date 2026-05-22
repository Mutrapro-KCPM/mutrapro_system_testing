﻿// services/task-service/index.js
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const axios = require('axios');
const amqp = require('amqplib'); // <-- (MQ) BÆ¯á»C 1: THĂM AMQP
require('dotenv').config({ path: '../.env', quiet: true });

// ======================= Sá»¬A Lá»–I PATH á» ÄĂ‚Y =======================
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

// Â  đŸ”¹  Â Health check route
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

// HĂ m helper Ä‘á»ƒ gá»­i thĂ´ng bĂ¡o
const notify = async (userId, eventName, data) => {
    try {
        await axios.post('http://notification-service:3006/notify', { userId, eventName, data });
    } catch (err) {
        logger.error(`Failed to send notification '${eventName}'.`, { error: err.message });
    }
};

// === (MQ) BÆ¯á»C 2: TĂCH LOGIC RE-OPEN RA HĂ€M RIĂNG ===
const handleReOpenTask = async (orderId, comment) => {
    // TĂ¬m task má»›i nháº¥t cá»§a order nĂ y
    const [taskRows] = await pool.execute(
        'SELECT id, assigned_to FROM task WHERE order_id = ? ORDER BY assigned_at DESC LIMIT 1',
        [orderId]
    );
    if (taskRows.length === 0) {
        logger.error(`[RabbitMQ] No task found for order ${orderId} to reopen.`);
        throw new Error(`KhĂ´ng tĂ¬m tháº¥y task cho order ${orderId}`);
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
// === Káº¾T THĂC BÆ¯á»C 2 ===

// --- API Endpoints ---
// API: Táº¡o cĂ´ng viá»‡c má»›i (yĂªu cáº§u coordinator)
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

// API: Cáº­p nháº­t tráº¡ng thĂ¡i cĂ´ng viá»‡c (yĂªu cáº§u chuyĂªn viĂªn hoáº·c coordinator)
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
    // 1. Cáº­p nháº­t tráº¡ng thĂ¡i task
    await pool.execute('UPDATE task SET status = ? WHERE id = ?', [status, id]);
    // 2. Láº¥y order_id (cáº§n cho cáº£ 2 logic bĂªn dÆ°á»›i)
    const [taskRows] = await pool.execute('SELECT order_id FROM task WHERE id = ?', [id]);
    const orderId = taskRows[0]?.order_id;
    if (!orderId) {
        logger.warn(`Task #${id} status updated, but could not find matching orderId.`);
        res.json({ message: 'Task status updated, but failed to find order.' });
        return;
    }
    // 3. (LOGIC Má»I) Náº¿u task báº¯t Ä‘áº§u (in_progress), cáº­p nháº­t cáº£ tráº¡ng thĂ¡i cá»§a order
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
    // 4. (LOGIC CÅ¨) Náº¿u task hoĂ n thĂ nh (done) vĂ  cĂ³ coordinatorId, bĂ¡o cho coordinator biáº¿t
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

// API: Láº¥y task gáº§n nháº¥t theo Order ID (dĂ¹ng ná»™i bá»™)
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

// API: Má»Ÿ láº¡i má»™t task tá»« tráº¡ng thĂ¡i 'done' (dĂ¹ng ná»™i bá»™ bá»Ÿi order-service)
app.post('/order/:orderId/re-open', asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const { comment } = req.body; // Nháº­n comment tá»« yĂªu cáº§u revision
    // Gá»i hĂ m logic Ä‘Ă£ tĂ¡ch
    await handleReOpenTask(orderId, comment);
    res.json({ message: 'Task re-opened successfully' });
}));

// API: Láº¥y danh sĂ¡ch cĂ´ng viá»‡c cá»§a má»™t chuyĂªn viĂªn
app.get('/specialist/:specialistId', authMiddleware, asyncHandler(async (req, res) => {
    const { specialistId } = req.params;
    assertOwnerOrRole(req, specialistId, ['admin', 'coordinator']);
    const [tasks] = await pool.execute('SELECT * FROM task WHERE assigned_to = ? ORDER BY assigned_at DESC', [specialistId]);
    if (tasks.length === 0) {
        return res.json([]);
    }
    // LĂ m giĂ u dá»¯ liá»‡u: Láº¥y mĂ´ táº£ Ä‘Æ¡n hĂ ng tá»« order-service
    const enrichedTasks = await Promise.all(
        tasks.map(async (task) => {
            try {
                const orderResponse = await axios.get(`http://order-service:3002/${task.order_id}`, {
                    headers: { Authorization: `Bearer ${req.token}` }
                });
                return { ...task, description: orderResponse.data.description };
            } catch (error) {
                logger.error(`Failed to fetch order details for order ID ${task.order_id}.`, { message: error.message });
            return { ...task, description: 'Không thể tải mô tả đơn hàng.' };
            }
        })
    );
    res.json(enrichedTasks);
}));

// === (MQ) BÆ¯á»C 4: THĂM HĂ€M Láº®NG NGHE RABBITMQ ===
const amqpUrl = 'amqp://user:password@rabbitmq';
const exchangeName = 'mutrapro_events';
const queueName = 'task_service_queue'; // TĂªn hĂ ng Ä‘á»£i riĂªng cá»§a service nĂ y
async function startMessageListener() {
    let connection;
    try {
        // Chá» 10s Ä‘á»ƒ RabbitMQ khá»Ÿi Ä‘á»™ng xong (cĂ¡ch Ä‘Æ¡n giáº£n, an toĂ n)
        logger.info('[RabbitMQ] Waiting 10s for RabbitMQ startup...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        logger.info('[RabbitMQ] Connecting to RabbitMQ...');
        connection = await amqp.connect(amqpUrl);
        const channel = await connection.createChannel();
        // Äáº£m báº£o exchange tá»“n táº¡i
        await channel.assertExchange(exchangeName, 'topic', { durable: true });
        // Äáº£m báº£o queue tá»“n táº¡i
        await channel.assertQueue(queueName, { durable: true });
        // RĂ ng buá»™c (Bind) queue nĂ y vá»›i exchange
        const routingKey = 'order.revision_requested';
        await channel.bindQueue(queueName, exchangeName, routingKey);
        logger.info(`[RabbitMQ] Task service listening for key '${routingKey}' on queue '${queueName}'.`);
        // Báº¯t Ä‘áº§u nháº­n tin nháº¯n
        channel.consume(queueName, async (msg) => {
            if (msg.content) {
                try {
                    const message = JSON.parse(msg.content.toString());
                    logger.info(`[RabbitMQ] Message received (key: ${msg.fields.routingKey}).`, message);
                    // Xá»­ lĂ½ logic
                    if (msg.fields.routingKey === 'order.revision_requested') {
                        await handleReOpenTask(message.orderId, message.comment);
                    }
                    // BĂ¡o cho RabbitMQ biáº¿t lĂ  Ä‘Ă£ xá»­ lĂ½ xong
                    channel.ack(msg);
                } catch (err) {
                    logger.error('[RabbitMQ] Failed to process message.', { message: err.message });
                    // BĂ¡o cho RabbitMQ biáº¿t lĂ  xá»­ lĂ½ lá»—i (Ä‘á»ƒ nĂ³ thá»­ gá»­i láº¡i sau)
                    channel.nack(msg, false, true);
                }
            }
        });
    } catch (err) {
        logger.error('[RabbitMQ] Failed to connect or listen.', { message: err.message });
        // Thá»­ káº¿t ná»‘i láº¡i sau 5 giĂ¢y
        setTimeout(startMessageListener, 5000);
    }
}
// === Káº¾T THĂC BÆ¯á»C 4 ===

// --- Middleware xá»­ lĂ½ cuá»‘i cĂ¹ng ---
app.use(notFound);
app.use(errorHandler);
const PORT = process.env.PORT || 3003;
app.listen(PORT, () => {
    logger.info(`Task Service is running on port ${PORT}`);
    startMessageListener(); // <-- (MQ) BÆ¯á»C 4: KHá»I Äá»˜NG LISTENER
});
