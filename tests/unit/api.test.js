const request = require('supertest');

// MOCK: Middleware Xác thực (Bypass JWT Security)
jest.mock('../../services/order-service/shared/middleware/auth', () => {
    return {
        authMiddleware: (req, res, next) => {
            // Giả lập user luôn hợp lệ với role customer
            req.user = { id: 1, email: 'test@customer.com', role: 'customer' };
            next();
        },
        checkRole: (roles) => (req, res, next) => next(),
        assertOwnerOrRole: (role) => (req, res, next) => next()
    };
});

// MOCK: External Dependencies
jest.mock('mysql2/promise');
jest.mock('ioredis', () => {
    return jest.fn().mockImplementation(() => {
        return { get: jest.fn(), set: jest.fn(), quit: jest.fn() };
    });
});
jest.mock('amqplib', () => {
    return {
        connect: jest.fn().mockResolvedValue({
            createChannel: jest.fn().mockResolvedValue({
                assertQueue: jest.fn(),
                sendToQueue: jest.fn()
            }),
            close: jest.fn()
        })
    };
});

// Import App SAU KHI đã mock
const app = require('../../services/order-service/index');
const mysql = require('mysql2/promise');

describe('Order Service - Controller Unit Tests (Mocked DB)', () => {
    let mockPool;

    beforeAll(() => {
        // Giả lập MySQL Pool
        mockPool = {
            query: jest.fn(),
            execute: jest.fn(),
            getConnection: jest.fn().mockResolvedValue({
                query: jest.fn(),
                release: jest.fn(),
                beginTransaction: jest.fn(),
                commit: jest.fn(),
                rollback: jest.fn(),
            })
        };
        mysql.createPool.mockReturnValue(mockPool);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    // ----------------------------------------------------
    // KỊCH BẢN 1: Tạo Đơn hàng (Khớp với báo cáo TC 1)
    // ----------------------------------------------------
    describe('POST /api/orders', () => {
        it('TC1: [HP] Nên tạo đơn hàng thành công và trả về 201', async () => {
            // Giả lập MySQL INSERT thành công (Trả về insertId)
            mockPool.query.mockResolvedValueOnce([{ insertId: 99 }]); 
            
            const payload = {
                service_type: 'transcription',
                description: 'Cần làm gấp bản phổ âm',
                total_duration: 10
            };

            const response = await request(app)
                .post('/api/orders')
                .send(payload);

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('id', 99);
            expect(mockPool.query).toHaveBeenCalled(); // Xác nhận đã gọi xuống DB
        });

        it('TC2: [BVA] Nên BÁO LỖI 400 nếu description > 2000 ký tự', async () => {
            const payload = {
                service_type: 'recording',
                description: 'A'.repeat(2001) // Vượt biên
            };

            const response = await request(app)
                .post('/api/orders')
                .send(payload);

            expect(response.status).toBe(400);
            expect(mockPool.query).not.toHaveBeenCalled(); // Đảm bảo lỗi Validation đã chặn không cho DB chạy
        });
    });

    // ----------------------------------------------------
    // KỊCH BẢN 2: Thanh toán (Float-point Validation)
    // ----------------------------------------------------
    describe('POST /api/orders/:id/pay', () => {
        it('TC3: [BVA] Nên TỪ CHỐI nếu thanh toán sai số thập phân (Float bypass)', async () => {
            // Giả lập MySQL SELECT trả về đơn hàng giá 300,000 và đang chờ thanh toán
            mockPool.query.mockResolvedValueOnce([[{ price: 300000, status: 'completed' }]]);

            const response = await request(app)
                .post('/api/orders/5/pay')
                .send({ amount: 300000.001 }); // Số thập phân lỗi

            expect(response.status).toBe(400);
            // expect(response.body.message).toContain('Số tiền không hợp lệ');
        });
    });
});
