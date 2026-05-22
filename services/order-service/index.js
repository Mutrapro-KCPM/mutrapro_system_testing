// services/order-service/index.js (ĐÃ CẬP NHẬT HOÀN CHỈNH VỚI RABBITMQ)
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const axios = require('axios');
const amqp = require('amqplib'); // <-- (MQ)
require('dotenv').config({ path: '../../.env', quiet: true });

// Import các module dùng chung
const { logger } = require('./shared/logger');
const { asyncHandler, notFound, errorHandler, AppError } = require('./shared/middleware/errorHandler');
const { responseHandler } = require('./shared/middleware/responseHandler');
const { idParamValidation, feedbackValidation } = require('./shared/middleware/validation');
const { authMiddleware, checkRole, assertOwnerOrRole } = require('./shared/middleware/auth');

// === KẾT NỐI REDIS ===
const Redis = require('ioredis');
const redis = new Redis({
    host: 'redis_cache',
    port: 6379,
});
redis.on('connect', () => {
    logger.info('Order service connected to Redis cache.');
});
redis.on('error', (err) => {
    logger.error('Order service failed to connect to Redis.', { message: err.message });
});
// === KẾT THÚC THÊM MỚI ===

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(express.json());
app.use(responseHandler);

// Health check route
app.get('/health', (req, res) => {
    res.status(200).json({
        service: 'order-service',
        status: 'ok',
        timestamp: new Date().toISOString()
    });
});

const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_ORDER_NAME,
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};
const pool = mysql.createPool(dbConfig);

const PRICING_CONFIG = Object.freeze(Object.assign(Object.create(null), {
    transcription: 300000,
    arrangement: 800000,
    recording: 500000
}));

// Hàm helper để gửi thông báo
const notify = async (userId, eventName, data) => {
    try {
        await axios.post('http://notification-service:3006/notify', { userId, eventName, data });
    } catch (err) {
        logger.error(`Failed to send notification '${eventName}'.`, { error: err.message });
    }
};

// === (MQ) HÀM GỬI TIN NHẮN RABBITMQ ===
const amqpUrl = 'amqp://user:password@rabbitmq';
const exchangeName = 'mutrapro_events';

const publishMessage = async (routingKey, message) => {
    let connection;
    try {
        connection = await amqp.connect(amqpUrl);
        const channel = await connection.createChannel();
        
        await channel.assertExchange(exchangeName, 'topic', { durable: true });
        channel.publish(exchangeName, routingKey, Buffer.from(JSON.stringify(message)));
        
        logger.info(`[RabbitMQ] Message published. Key: ${routingKey}`, message);
        await channel.close();
    } catch (err) {
        logger.error('[RabbitMQ] Failed to publish message.', { message: err.message });
    } finally {
        if (connection) await connection.close();
    }
};
// === KẾT THÚC HÀM MỚI ===

// --- API Endpoints ---
// API: Tạo đơn hàng mới (yêu cầu vai trò 'customer')
app.post('/', authMiddleware, checkRole('customer'), asyncHandler(async (req, res) => {
    const { service_type, description } = req.body;
    const customer_id = req.user.id;
    const price = PRICING_CONFIG[service_type];

    if (price === undefined) {
        throw new AppError('Loại dịch vụ không hợp lệ.', 400);
    }

    if (typeof description !== 'string' || !description.trim()) {
        throw new AppError('Mô tả không được để trống.', 400);
    }

    const [result] = await pool.execute(
        `INSERT INTO orders (customer_id, service_type, description, price, status) VALUES (?, ?, ?, ?, 'pending')`,
        [customer_id, service_type, description.trim(), price]
    );

    // === SỬA LỖI PUSH NOTIFICATION ===
    try {
        const authResponse = await axios.get('http://auth-service:3001/users/by-role/coordinator');
        const coordinators = authResponse.data;

        const notificationData = {
            orderId: result.insertId,
            message: `Có đơn hàng mới #${result.insertId} đang chờ được phân công.`
        };

        for (const coord of coordinators) {
            notify(coord.id, 'new_order_pending', notificationData);
        }
        logger.info(`[Notify] Sent 'new_order_pending' to ${coordinators.length} coordinator(s).`);

    } catch (err) {
        logger.error(`[Notify] Failed to notify coordinators: ${err.message}`);
    }

    logger.info(`New order created with ID: ${result.insertId}`);
    res.status(201).json({ id: result.insertId, message: 'Order created' });
}));

// API: Lấy TẤT CẢ đơn hàng (yêu cầu coordinator/admin)
app.get('/', authMiddleware, checkRole('coordinator', 'admin'), asyncHandler(async (req, res) => {
    const [orders] = await pool.execute('SELECT * FROM orders ORDER BY created_at DESC');
    const [feedbackRows] = await pool.execute('SELECT order_id, rating, comment FROM feedback');
    const feedbackMap = new Map();
    feedbackRows.forEach(fb => {
        feedbackMap.set(fb.order_id, { rating: fb.rating, comment: fb.comment });
    });

    const mapWithConcurrency = async (items, limit, mapper) => {
        const results = new Array(items.length);
        let nextIndex = 0;
        const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
            while (nextIndex < items.length) {
                const currentIndex = nextIndex++;
                results[currentIndex] = await mapper(items[currentIndex], currentIndex);
            }
        });
        await Promise.all(workers);
        return results;
    };

    const orderIds = orders.map(order => order.id);
    const taskResults = await mapWithConcurrency(orderIds, 10, async (orderId) => {
        try {
            const taskResponse = await axios.get(`http://task-service:3003/order/${orderId}`);
            return { orderId, task: taskResponse.data };
        } catch (error) {
            if (error.response?.status !== 404) {
                logger.warn(`[Order Service] Failed to fetch task for order ${orderId}.`, { message: error.message });
            }
            return { orderId, task: null };
        }
    });

    const taskByOrderId = new Map();
    const specialistIds = new Set();
    taskResults.forEach(({ orderId, task }) => {
        if (!task) {
            return;
        }
        taskByOrderId.set(orderId, task);
        if (task.assigned_to) {
            specialistIds.add(task.assigned_to);
        }
    });

    const specialistNameById = new Map();
    const specialistIdList = Array.from(specialistIds);
    if (specialistIdList.length > 0) {
        const cacheKeys = specialistIdList.map(id => `user:${id}:name`);
        const cachedResults = await redis.pipeline(cacheKeys.map(key => ['get', key])).exec();
        const missedSpecialistIds = [];

        cachedResults.forEach(([error, cachedName], index) => {
            const specialistId = specialistIdList[index];
            if (error) {
                logger.warn(`[Cache] Failed to read specialist ${specialistId} from Redis.`, { message: error.message });
                missedSpecialistIds.push(specialistId);
                return;
            }

            if (cachedName) {
                specialistNameById.set(specialistId, cachedName);
                logger.info(`[Cache] HIT for specialist ${specialistId}`);
            } else {
                missedSpecialistIds.push(specialistId);
                logger.info(`[Cache] MISS for specialist ${specialistId}. Fetching...`);
            }
        });

        const fetchedSpecialists = await mapWithConcurrency(missedSpecialistIds, 5, async (specialistId) => {
            try {
                const authResponse = await axios.get(`http://auth-service:3001/users/${specialistId}`);
                return { specialistId, name: authResponse.data.name };
            } catch (error) {
                if (error.response?.status !== 404) {
                    logger.warn(`[Order Service] Failed to fetch specialist ${specialistId}.`, { message: error.message });
                }
                return { specialistId, name: null };
            }
        });

        const cachePipeline = redis.pipeline();
        let cacheWriteCount = 0;
        fetchedSpecialists.forEach(({ specialistId, name }) => {
            if (!name) {
                return;
            }
            specialistNameById.set(specialistId, name);
            cachePipeline.set(`user:${specialistId}:name`, name, 'EX', 3600);
            cacheWriteCount++;
        });
        if (cacheWriteCount > 0) {
            await cachePipeline.exec();
        }
    }

    const enrichedOrders = orders.map((order) => {
        const task = taskByOrderId.get(order.id);
        const assignedSpecialistName = task?.assigned_to ? specialistNameById.get(task.assigned_to) || null : null;

        return {
            ...order,
            assignedSpecialist: assignedSpecialistName,
            feedback: feedbackMap.get(order.id) || null
        };
    });
    res.json(enrichedOrders);
}));

// API: Lấy thống kê
app.get('/stats', authMiddleware, checkRole('admin', 'coordinator'), asyncHandler(async (req, res) => {
    const [revenueRows] = await pool.execute("SELECT SUM(amount) as totalRevenue FROM payment WHERE status = 'paid'");
    const [statusRows] = await pool.execute("SELECT status, COUNT(*) as count FROM orders GROUP BY status");
    const [totalOrdersRows] = await pool.execute("SELECT COUNT(*) as totalOrders FROM orders");
    res.json({
        totalRevenue: revenueRows[0].totalRevenue || 0,
        orderStats: statusRows,
        totalOrders: totalOrdersRows[0].totalOrders || 0
    });
}));

// API: (Admin) LẤY TẤT CẢ GIAO DỊCH
app.get('/admin/payments', authMiddleware, checkRole('admin'), asyncHandler(async (req, res) => {
    const [payments] = await pool.execute('SELECT * FROM payment ORDER BY created_at DESC');
    if (payments.length === 0) {
        return res.json([]);
    }

    const enrichedPayments = await Promise.all(
        payments.map(async (payment) => {
            let customerName = 'Không rõ';
            const customerCacheKey = `user:${payment.customer_id}:name`;
            
            try {
                const cachedName = await redis.get(customerCacheKey);
                if (cachedName) {
                    customerName = cachedName;
                    logger.info(`[Cache] HIT for user ${payment.customer_id} (in payments)`);
                } else {
                    logger.info(`[Cache] MISS for user ${payment.customer_id} (in payments). Fetching...`);
                    const authResponse = await axios.get(`http://auth-service:3001/users/${payment.customer_id}`);
                    customerName = authResponse.data.name;
                    await redis.set(customerCacheKey, customerName, 'EX', 3600);
                }
            } catch (error) {
                if (error.response?.status !== 404) {
                    logger.warn(`[Order Service] Failed to fetch user ${payment.customer_id}.`, { message: error.message });
                }
            }
            return {
                ...payment,
                customer_name: customerName
            };
        })
    );
    res.json(enrichedPayments);
}));

app.post('/payments', authMiddleware, checkRole('customer'), asyncHandler(async (req, res) => {
    const { order_id, method } = req.body;
    if (!order_id) {
        throw new AppError('Order ID is required.', 400);
    }

    const [orderRows] = await pool.execute('SELECT id, customer_id, price, status FROM orders WHERE id = ?', [order_id]);
    if (orderRows.length === 0) {
        throw new AppError('Không tìm thấy đơn hàng.', 404);
    }

    const order = orderRows[0];
    assertOwnerOrRole(req, order.customer_id);
    if (!['completed', 'fixed'].includes(order.status)) {
        throw new AppError('Chỉ có thể tạo thanh toán cho đơn hàng đã hoàn thành.', 400);
    }

    const [existingPaid] = await pool.execute(
        "SELECT id FROM payment WHERE order_id = ? AND status = 'paid' LIMIT 1",
        [order_id]
    );
    if (existingPaid.length > 0) {
        throw new AppError('Đơn hàng này đã được thanh toán.', 409);
    }

    const [result] = await pool.execute(
        "INSERT INTO payment (order_id, customer_id, amount, method, status) VALUES (?, ?, ?, ?, 'pending')",
        [order_id, req.user.id, order.price, method || 'bank_transfer']
    );

    res.status(201).json({
        success: true,
        message: 'Payment created.',
        data: { id: result.insertId, status: 'pending', amount: order.price }
    });
}));

app.get('/payments', authMiddleware, checkRole('admin', 'coordinator'), asyncHandler(async (req, res) => {
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '10', 10), 1), 100);
    const offset = (page - 1) * limit;
    const status = req.query.status;
    const allowedStatuses = ['pending', 'paid', 'failed'];
    if (status && !allowedStatuses.includes(status)) {
        throw new AppError('Payment status is invalid.', 400);
    }

    const where = status ? 'WHERE status = ?' : '';
    const params = status ? [status] : [];
    const [countRows] = await pool.execute(`SELECT COUNT(*) as total FROM payment ${where}`, params);
    const [items] = await pool.execute(
        `SELECT * FROM payment ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset]
    );

    res.json({
        success: true,
        message: 'Payments loaded.',
        data: {
            items,
            pagination: {
                page,
                limit,
                total: countRows[0].total,
                totalPages: Math.ceil(countRows[0].total / limit)
            }
        }
    });
}));

app.get('/payments/:id', authMiddleware, asyncHandler(async (req, res) => {
    const [rows] = await pool.execute('SELECT * FROM payment WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
        throw new AppError('Không tìm thấy giao dịch.', 404);
    }
    assertOwnerOrRole(req, rows[0].customer_id, ['admin', 'coordinator']);
    res.json({ success: true, message: 'Payment loaded.', data: rows[0] });
}));

app.post('/payments/:id/mock-success', authMiddleware, asyncHandler(async (req, res) => {
    const [rows] = await pool.execute('SELECT * FROM payment WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
        throw new AppError('Không tìm thấy giao dịch.', 404);
    }
    const payment = rows[0];
    assertOwnerOrRole(req, payment.customer_id, ['admin']);
    if (payment.status === 'paid') {
        throw new AppError('Giao dịch đã được thanh toán.', 409);
    }

    const transactionId = `MTP-${Date.now()}-${payment.id}`;
    await pool.execute(
        "UPDATE payment SET status = 'paid', transaction_id = ?, paid_at = NOW() WHERE id = ?",
        [transactionId, payment.id]
    );
    await pool.execute("UPDATE orders SET status = 'paid' WHERE id = ?", [payment.order_id]);
    res.json({ success: true, message: 'Payment marked as paid.', data: { transaction_id: transactionId } });
}));

app.post('/payments/:id/mock-fail', authMiddleware, asyncHandler(async (req, res) => {
    const [rows] = await pool.execute('SELECT * FROM payment WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
        throw new AppError('Không tìm thấy giao dịch.', 404);
    }
    const payment = rows[0];
    assertOwnerOrRole(req, payment.customer_id, ['admin']);
    if (payment.status === 'paid') {
        throw new AppError('Không thể đánh dấu thất bại cho giao dịch đã thanh toán.', 409);
    }

    await pool.execute("UPDATE payment SET status = 'failed' WHERE id = ?", [payment.id]);
    res.json({ success: true, message: 'Payment marked as failed.', data: { id: payment.id } });
}));

// API: Lấy tất cả đơn hàng của một khách hàng
app.get('/customer/:customerId', authMiddleware, asyncHandler(async (req, res) => {
    const { customerId } = req.params;
    assertOwnerOrRole(req, customerId, ['admin', 'coordinator']);
    
    const [orders] = await pool.execute('SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC', [customerId]);
    const enrichedOrders = await Promise.all(
        orders.map(async (order) => {
            if (order.service_type === 'recording' && order.status !== 'pending') {
                try {
                    const bookingResponse = await axios.get(`http://studio-service:3005/bookings/order/${order.id}`);
                    return { ...order, studioInfo: bookingResponse.data };
                } catch (error) {
                    if (error.response && error.response.status !== 404) {
                        logger.error(`[Order Service] Failed to fetch booking for order ${order.id}.`, { message: error.message });
                    }
                    return order;
                }
            }
            return order;
        })
    );
    res.json(enrichedOrders);
}));

// API: Lấy chi tiết một đơn hàng
app.get('/:id', authMiddleware, idParamValidation, asyncHandler(async (req, res) => {
    const { id } = req.params;

    const [rows] = await pool.execute(
        `SELECT o.*, f.rating, f.comment 
        FROM orders o
        LEFT JOIN feedback f ON o.id = f.order_id
        WHERE o.id = ?`,
        [id]
    );
    if (rows.length === 0) {
        throw new AppError('Không tìm thấy đơn hàng.', 404);
    }
    
    const order = rows[0];
    assertOwnerOrRole(req, order.customer_id, ['admin', 'coordinator', 'transcriber', 'arranger', 'artist', 'studio_admin']);
    
    let customerName = 'Không rõ';
    const customerCacheKey = `user:${order.customer_id}:name`;
    
    try {
        const cachedName = await redis.get(customerCacheKey);
        if (cachedName) {
            customerName = cachedName;
            logger.info(`[Cache] HIT for user ${order.customer_id}`);
        } else {
            logger.info(`[Cache] MISS for user ${order.customer_id}. Fetching...`);
            const authResponse = await axios.get(`http://auth-service:3001/users/${order.customer_id}`);
            customerName = authResponse.data.name;
            await redis.set(customerCacheKey, customerName, 'EX', 3600);
        }
    } catch (error) {
        if (error.response?.status !== 404) {
            logger.warn(`[Order Service] Failed to fetch user ${order.customer_id} for order ${id}.`, { message: error.message });
        }
    }

    const enrichedOrder = {
        ...order,
        customer_name: customerName
    };
    res.json(enrichedOrder);
}));

// API: Cập nhật trạng thái đơn hàng (ĐÃ THÊM QUYỀN CHO TRANSCRIBER, ARRANGER, ARTIST)
app.put('/:id/status', authMiddleware, checkRole('coordinator', 'admin', 'transcriber', 'arranger', 'artist'), idParamValidation, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    
    const validStatuses = ['pending', 'assigned', 'in_progress', 'completed', 'revision_requested', 'fixed', 'paid', 'cancelled'];
    if (!validStatuses.includes(status)) {
        throw new AppError('Trạng thái đơn hàng không hợp lệ.', 400);
    }
    
    const [orderRows] = await pool.execute('SELECT customer_id FROM orders WHERE id = ?', [id]);
    if (orderRows.length === 0) {
        throw new AppError('Không tìm thấy đơn hàng.', 404);
    }
    
    const customerId = orderRows[0].customer_id;
    await pool.execute('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
    
    notify(customerId, 'order_status_updated', {
        orderId: id,
        newStatus: status,
        message: `Trạng thái đơn hàng #${id} của bạn đã được cập nhật thành: ${status}.`
    });
    
    logger.info(`Order #${id} status updated to ${status}`);
    res.json({ message: 'Order status updated successfully' });
}));

// API: Thanh toán
app.post('/:id/pay', authMiddleware, checkRole('customer'), idParamValidation, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { amount, method } = req.body;
    const customer_id = req.user.id;
    
    const [orderRows] = await pool.execute('SELECT customer_id, price FROM orders WHERE id = ?', [id]);
    if (orderRows.length === 0) {
        throw new AppError('Không tìm thấy đơn hàng.', 404);
    }
    
    assertOwnerOrRole(req, orderRows[0].customer_id);
    if (Number(amount) !== Number(orderRows[0].price)) {
        throw new AppError('Số tiền thanh toán không khớp với đơn hàng.', 400);
    }
    
    await pool.query('START TRANSACTION');
    const  [updateResult] = await pool.execute(
        "UPDATE orders SET status = ? WHERE id = ? AND (status = 'completed' OR status = 'fixed')",
        ['paid', id]
    );
    if (updateResult.affectedRows === 0) {
        await pool.query('ROLLBACK');
        throw new AppError('Đơn hàng không hợp lệ để thanh toán.', 400);
    }
    
    await pool.execute(
        `INSERT INTO payment (order_id, customer_id, amount, method, status) VALUES (?, ?, ?, ?, 'paid')`,
        [id, customer_id, amount, method || 'credit_card']
    );
    await pool.query('COMMIT');
    
    logger.info(`Payment successful for order #${id}`);
    res.json({ message: 'Thanh toán thành công!' });
}));

// API: Gửi feedback
app.post('/:id/feedback', authMiddleware, checkRole('customer'), idParamValidation, feedbackValidation, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { rating, comment } = req.body;
    
    const [orderRows] = await pool.execute('SELECT customer_id, status FROM orders WHERE id = ?', [id]);
    if (orderRows.length === 0) {
        throw new AppError('Không tìm thấy đơn hàng.', 404);
    }
    
    assertOwnerOrRole(req, orderRows[0].customer_id);
    if (orderRows[0].status !== 'paid') {
        throw new AppError('Chỉ có thể đánh giá đơn hàng đã thanh toán.', 400);
    }
    
    const finalComment = comment || null; 

    const [existing] = await pool.execute('SELECT id FROM feedback WHERE order_id = ?', [id]);
    if (existing.length > 0) {
        throw new AppError('Đơn hàng này đã được đánh giá.', 409);
    }
    
    await pool.execute(
        'INSERT INTO feedback (order_id, rating, comment) VALUES (?, ?, ?)',
        [id, rating, finalComment] 
    );
    
    logger.info(`New feedback submitted for order #${id}`);
    res.status(201).json({ message: 'Gửi đánh giá thành công!' });
}));

// API: Kiểm tra feedback đã tồn tại chưa
app.get('/:id/feedback', authMiddleware, idParamValidation, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const [orderRows] = await pool.execute('SELECT customer_id FROM orders WHERE id = ?', [id]);
    if (orderRows.length === 0) {
        throw new AppError('Không tìm thấy đơn hàng.', 404);
    }
    assertOwnerOrRole(req, orderRows[0].customer_id, ['admin', 'coordinator']);
    const [rows] = await pool.execute('SELECT id FROM feedback WHERE order_id = ?', [id]);
    res.json({ hasFeedback: rows.length > 0 });
}));

// API: Khách hàng yêu cầu chỉnh sửa
app.post('/:id/request-revision', authMiddleware, checkRole('customer'), idParamValidation, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { comment, coordinatorId } = req.body;
    
    if (!comment || !comment.trim()) {
        throw new AppError('Vui lòng nhập nội dung yêu cầu chỉnh sửa.', 400);
    }
    
    const [orderOwnerRows] = await pool.execute('SELECT customer_id FROM orders WHERE id = ?', [id]);
    if (orderOwnerRows.length === 0) {
        throw new AppError('Không tìm thấy đơn hàng.', 404);
    }
    
    assertOwnerOrRole(req, orderOwnerRows[0].customer_id); 
    
    const [updateResult] = await pool.execute(
        "UPDATE orders SET status = 'revision_requested' WHERE id = ? AND (status = 'completed' OR status = 'fixed')", 
        [id]
    );
    if (updateResult.affectedRows === 0) {
        throw new AppError('Đơn hàng không hợp lệ để yêu cầu chỉnh sửa.', 400);
    }
    
    // RabbitMQ
    const routingKey = 'order.revision_requested';
    const message = {
        orderId: id,
        comment: comment
    };
    await publishMessage(routingKey, message);

    if (coordinatorId) {
        notify(coordinatorId, 'revision_requested', {
            orderId: id,
            message: `Khách hàng vừa yêu cầu chỉnh sửa cho đơn hàng #${id}. Lý do: ${comment}`
        });
    }
    
    logger.info(`Revision requested for order #${id}`);
    res.json({ message: 'Yêu cầu chỉnh sửa đã được gửi đi.' });
}));

// --- Middleware xử lý cuối cùng ---
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
    logger.info(`Order Service is running on port ${PORT}`);
});
