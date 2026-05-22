﻿// services/studio-service/index.js
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config({ path: '../.env', quiet: true });

// ======================= SỬA LỖI PATH Ở ĐÂY =======================
const { logger } = require('./shared/logger');
const { asyncHandler, notFound, errorHandler, AppError } = require('./shared/middleware/errorHandler');
const { responseHandler } = require('./shared/middleware/responseHandler');
const { idParamValidation } = require('./shared/middleware/validation');
const { authMiddleware, checkRole } = require('./shared/middleware/auth');
// ==================================================================

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(express.json());
app.use(responseHandler);

// Health check route
app.get('/health', (req, res) => {
    res.status(200).json({
        service: 'studio-service',
        status: 'ok',
        timestamp: new Date().toISOString()
    });
});

const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_STUDIO_NAME,
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};
const pool = mysql.createPool(dbConfig);

const notify = async (userId, eventName, data) => {
    try {
        await axios.post('http://notification-service:3006/notify', { userId, eventName, data });
    } catch (err) {
        logger.error(`Failed to send notification '${eventName}'.`, { error: err.message });
    }
};

// --- API Endpoints ---
// API: Lấy danh sách tất cả phòng thu (công khai)
app.get('/studios', asyncHandler(async (req, res) => {
    const [rows] = await pool.execute('SELECT * FROM studios ORDER BY name ASC');
    res.json(rows);
}));

// API: Đặt lịch phòng thu (BẢN FIX ĐẦY ĐỦ CAMELCASE + ĐÓNG CHẶN GIỜ QUÁ KHỨ)
app.post('/bookings', authMiddleware, checkRole('artist', 'studio_admin', 'admin'), asyncHandler(async (req, res) => {
    // Fix bẫy đặt tên bằng cách map song song cả snake_case lẫn camelCase từ frontend gửi lên
    const studio_id = req.body.studio_id || req.body.studioId;
    const order_id = req.body.order_id || req.body.orderId;
    const start_time = req.body.start_time || req.body.startTime;
    const end_time = req.body.end_time || req.body.endTime;
    const studioAdminId = req.body.studioAdminId || req.body.studio_admin_id;
    const artist_id = req.user.id;

    if (!studio_id || !order_id || !start_time || !end_time) {
        throw new AppError('Thiếu thông tin bắt buộc để đặt phòng thu (studio_id, order_id, start_time, end_time).', 400);
    }

    const startDate = new Date(start_time);
    const endDate = new Date(end_time);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        logger.error(`[Booking Error] Sai định dạng ngày. Start: ${start_time}, End: ${end_time}`);
        throw new AppError('Thời gian đặt lịch không hợp lệ (Sai định dạng ngày tháng).', 400);
    }
    
    if (startDate >= endDate) {
        throw new AppError('Thời gian kết thúc phải sau thời gian bắt đầu.', 400);
    }

    if (startDate < new Date()) {
        throw new AppError('Không thể đặt lịch trong quá khứ.', 400);
    }

    // Kiểm tra xem phòng thu có tồn tại và đang ở trạng thái 'available' không
    const [studioRows] = await pool.execute('SELECT status FROM studios WHERE id = ?', [studio_id]);
    if (studioRows.length === 0) {
        throw new AppError('Không tìm thấy phòng thu này trong hệ thống.', 404);
    }
    if (studioRows[0].status !== 'available') {
        throw new AppError(`Phòng thu hiện tại không sẵn sàng (Trạng thái: ${studioRows[0].status}).`, 400);
    }

    // Kiểm tra trùng lịch đặt trùng lặp -> FIX: Dùng đối tượng Date (endDate, startDate) thay vì chuỗi raw chuỗi ISO tránh lệch múi giờ
    const [conflicts] = await pool.execute(
        `SELECT id FROM booking
         WHERE studio_id = ?
           AND status = 'scheduled'
           AND start_time < ?
           AND end_time > ?
         LIMIT 1`,
        [studio_id, endDate, startDate]
    );

    if (conflicts.length > 0) {
        throw new AppError('Khung giờ này đã có lịch đặt trước đó.', 409);
    }

    // FIX: Truyền startDate và endDate vào mảng tham số thực thi để lưu đúng định dạng DATETIME của MySQL
    const [result] = await pool.execute(
        `INSERT INTO booking (studio_id, artist_id, order_id, start_time, end_time, status) VALUES (?, ?, ?, ?, ?, 'scheduled')`,
        [studio_id, artist_id, order_id, startDate, endDate]
    );

    if (studioAdminId) {
        notify(studioAdminId, 'new_booking', {
            studioId: studio_id,
            orderId: order_id,
            message: `Có một lịch đặt mới tại phòng thu của bạn cho đơn hàng #${order_id}.`
        });
    }

    logger.info(`New booking created for studio #${studio_id} by artist #${artist_id}`);
    res.status(201).json({ id: result.insertId, message: 'Booking created' });
}));

// API: Lấy thông tin booking theo order ID (dùng cho service khác)
app.get('/bookings/order/:orderId', asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const [rows] = await pool.execute(`
        SELECT s.name as studioName, s.location, b.start_time, b.end_time
        FROM booking b JOIN studios s ON b.studio_id = s.id
        WHERE b.order_id = ? LIMIT 1`,
        [orderId]
    );
    if (rows.length === 0) {
        throw new AppError('Không tìm thấy lịch đặt cho đơn hàng này.', 404);
    }
    res.json(rows[0]);
}));

// --- API DÀNH RIÊNG CHO ADMIN PHÒNG THU ---
// API: Lấy toàn bộ lịch đặt (yêu cầu 'studio_admin')
app.get('/bookings/all', authMiddleware, checkRole('studio_admin'), asyncHandler(async (req, res) => {
    const [rows] = await pool.execute(`
        SELECT b.id, b.order_id, b.start_time, b.end_time, s.name as studio_name
        FROM booking b JOIN studios s ON b.studio_id = s.id
        WHERE b.status = 'scheduled' ORDER BY b.start_time ASC`);
    res.json(rows);
}));

app.post('/bookings/:id/confirm', authMiddleware, checkRole('studio_admin', 'admin'), asyncHandler(async (req, res) => {
    const [rows] = await pool.execute('SELECT * FROM booking WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
        throw new AppError('Không tìm thấy lịch đặt.', 404);
    }
    const booking = rows[0];
    
    const [conflicts] = await pool.execute(
        `SELECT id FROM booking
         WHERE studio_id = ?
           AND id <> ?
           AND status = 'scheduled'
           AND start_time < ?
           AND end_time > ?
         LIMIT 1`,
        [booking.studio_id, booking.id, booking.end_time, booking.start_time]
    );
    if (conflicts.length > 0) {
        throw new AppError('Khung giờ này đã có lịch đặt.', 409);
    }
    
    await pool.execute("UPDATE booking SET status = 'scheduled' WHERE id = ?", [booking.id]);
    res.json({ success: true, message: 'Booking confirmed.', data: { id: booking.id } });
}));

app.post('/bookings/:id/reject', authMiddleware, checkRole('studio_admin', 'admin'), asyncHandler(async (req, res) => {
    const [result] = await pool.execute("UPDATE booking SET status = 'cancelled' WHERE id = ?", [req.params.id]);
    if (result.affectedRows === 0) {
        throw new AppError('Không tìm thấy lịch đặt.', 404);
    }
    res.json({ success: true, message: 'Booking rejected.', data: { id: req.params.id } });
}));

app.post('/bookings/:id/cancel', authMiddleware, asyncHandler(async (req, res) => {
    const [rows] = await pool.execute('SELECT * FROM booking WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
        throw new AppError('Không tìm thấy lịch đặt.', 404);
    }
    
    const booking = rows[0];
    if (!['admin', 'studio_admin'].includes(req.user.role) && Number(booking.artist_id) !== Number(req.user.id)) {
        throw new AppError('Bạn không có quyền hủy lịch này.', 403);
    }
    
    await pool.execute("UPDATE booking SET status = 'cancelled' WHERE id = ?", [booking.id]);
    res.json({ success: true, message: 'Booking cancelled.', data: { id: booking.id } });
}));

// API: Cập nhật trạng thái phòng thu (yêu cầu 'studio_admin')
app.put('/studios/:id/status', authMiddleware, checkRole('studio_admin'), idParamValidation, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const validStatuses = ['available', 'booked', 'maintenance'];
    
    if (!validStatuses.includes(status)) {
        throw new AppError('Trạng thái không hợp lệ.', 400);
    }
    
    const [result] = await pool.execute('UPDATE studios SET status = ? WHERE id = ?', [status, id]);
    if (result.affectedRows === 0) {
        throw new AppError('Không tìm thấy phòng thu.', 404);
    }
    
    notify('broadcast', 'studio_status_updated', {
        studioId: id,
        newStatus: status
    });
    
    logger.info(`Studio #${id} status updated to ${status}`);
    res.json({ message: 'Cập nhật trạng thái phòng thu thành công.' });
}));

// --- Middleware xử lý cuối cùng ---
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 3005;
if (require.main === module) {
    app.listen(PORT, () => {
        logger.info(`Studio Service is running on port ${PORT}`);
    });
}
module.exports = app;