const request = require('supertest');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');

// Thiết lập biến môi trường bắt buộc cho test
process.env.JWT_SECRET = 'test_secret_key';
process.env.DB_STUDIO_NAME = 'mutrapro_studio';

// Mock thư viện mysql2 (Giả lập Database)
jest.mock('mysql2/promise', () => {
    const mPool = { execute: jest.fn() };
    return { createPool: jest.fn(() => mPool) };
});

// Mock axios (bỏ qua việc gọi sang notification-service)
jest.mock('axios');

// Require app SAU KHI đã set process.env
const app = require('../index'); 

describe('Studio Booking API Tests (POST /bookings)', () => {
    let pool;
    let validToken;

    beforeAll(() => {
        pool = mysql.createPool();
        // Tạo một token hợp lệ cho Artist
        validToken = jwt.sign({ id: 99, role: 'artist' }, process.env.JWT_SECRET);
    });

    afterEach(() => {
        jest.clearAllMocks(); // Xóa lịch sử mock sau mỗi test để không bị nhiễu
    });

    it('TC-01: Báo lỗi 400 nếu truyền ngày đặt lịch nằm trong quá khứ', async () => {
        const pastDate = new Date();
        pastDate.setFullYear(2020); // Lùi về năm 2020

        const res = await request(app)
            .post('/bookings')
            .set('Authorization', `Bearer ${validToken}`)
            .send({
                studioId: 1,
                orderId: 123,
                startTime: pastDate.toISOString(),
                endTime: new Date(pastDate.getTime() + 3600000).toISOString() // + 1 tiếng
            });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Không thể đặt lịch trong quá khứ.');
    });

    it('TC-02: Báo lỗi 409 Conflict nếu trùng giờ với lịch của người khác', async () => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 1); // Đặt vào ngày mai
        
        // Giả lập DB trả về: Phòng thu tồn tại và available
        pool.execute.mockResolvedValueOnce([[{ status: 'available' }]]); 
        // Giả lập DB trả về: Bị trùng lịch (mảng conflicts có 1 phần tử)
        pool.execute.mockResolvedValueOnce([[{ id: 10 }]]); 

        const res = await request(app)
            .post('/bookings')
            .set('Authorization', `Bearer ${validToken}`)
            .send({
                studioId: 1,
                orderId: 123,
                startTime: futureDate.toISOString(),
                endTime: new Date(futureDate.getTime() + 3600000).toISOString()
            });

        expect(res.status).toBe(409);
        expect(res.body.message).toBe('Khung giờ này đã có lịch đặt trước đó.');
        expect(pool.execute).toHaveBeenCalledTimes(2); // Đảm bảo đã chạy 2 câu lệnh SQL
    });

    it('TC-03: Đặt lịch thành công và trả về mã 201 Created', async () => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 1); 
        
        pool.execute.mockResolvedValueOnce([[{ status: 'available' }]]); // Có phòng
        pool.execute.mockResolvedValueOnce([[]]); // Không trùng lịch
        pool.execute.mockResolvedValueOnce([{ insertId: 55 }]); // Insert thành công

        const res = await request(app)
            .post('/bookings')
            .set('Authorization', `Bearer ${validToken}`)
            .send({ studioId: 1, orderId: 123, startTime: futureDate.toISOString(), endTime: new Date(futureDate.getTime() + 3600000).toISOString() });

        expect(res.status).toBe(201);
        expect(res.body.id).toBe(55);
    });
});