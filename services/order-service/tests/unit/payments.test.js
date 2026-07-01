// tests/unit/payments.test.js
// Test cho nhóm "payments": POST /payments, GET /payments, GET /payments/:id,
// POST /payments/:id/mock-success, POST /payments/:id/mock-fail, POST /:id/pay, GET /admin/payments

process.env.JWT_SECRET = 'test_secret';
process.env.NODE_ENV = 'test';

const jwt = require('jsonwebtoken');

// ---- Mock mysql2/promise ----
jest.mock('mysql2/promise', () => {
    const mockPool = {
        execute: jest.fn(),
        query: jest.fn(),
    };
    return {
        createPool: jest.fn(() => mockPool),
        __mockPool: mockPool,
    };
});

// ---- Mock ioredis ----
jest.mock('ioredis', () => {
    const instance = {
        on: jest.fn(),
        get: jest.fn(),
        set: jest.fn(),
        pipeline: jest.fn(),
    };
    const RedisMock = jest.fn(() => instance);
    RedisMock.__instance = instance;
    return RedisMock;
});

// ---- Mock axios ----
jest.mock('axios');

// ---- Mock amqplib ----
jest.mock('amqplib', () => ({
    connect: jest.fn().mockResolvedValue({
        createChannel: jest.fn().mockResolvedValue({
            assertExchange: jest.fn(),
            publish: jest.fn(),
            close: jest.fn(),
        }),
        close: jest.fn(),
    }),
}));

// ---- Mock shared/logger ----
jest.mock('../../shared/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
}));


const mysql = require('mysql2/promise');
const Redis = require('ioredis');
const axios = require('axios');
const request = require('supertest');

const pool = mysql.__mockPool;
const redis = Redis.__instance;

let app;

beforeAll(() => {
    app = require('../../index');
});

beforeEach(() => {
    jest.clearAllMocks();
});

// ---- Helper tạo JWT hợp lệ ----
const token = (payload) => jwt.sign(payload, process.env.JWT_SECRET);
const authHeader = (payload) => `Bearer ${token(payload)}`;

const CUSTOMER = { id: 1, role: 'customer' };
const OTHER_CUSTOMER = { id: 2, role: 'customer' };
const COORDINATOR = { id: 10, role: 'coordinator' };
const ADMIN = { id: 20, role: 'admin' };

// ============================================================
// POST /payments (Tạo thanh toán mới)
// ============================================================
describe('POST /payments (tạo thanh toán)', () => {
    test('trả về 401 nếu không có token', async () => {
        const res = await request(app).post('/payments').send({ order_id: 1 });
        expect(res.status).toBe(401);
    });

    test('trả về 403 nếu role không phải customer', async () => {
        const res = await request(app)
            .post('/payments')
            .set('Authorization', authHeader(COORDINATOR))
            .send({ order_id: 1 });
        expect(res.status).toBe(403);
    });

    test('trả về 400 nếu thiếu order_id', async () => {
        const res = await request(app)
            .post('/payments')
            .set('Authorization', authHeader(CUSTOMER))
            .send({});
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/Order ID is required/);
    });

    test('trả về 404 nếu đơn hàng không tồn tại', async () => {
        pool.execute.mockResolvedValueOnce([[]]); // SELECT orders
        const res = await request(app)
            .post('/payments')
            .set('Authorization', authHeader(CUSTOMER))
            .send({ order_id: 999 });
        expect(res.status).toBe(404);
    });

    test('trả về 403 nếu customer khác cố tạo thanh toán cho đơn không phải của mình', async () => {
        pool.execute.mockResolvedValueOnce([[{ id: 1, customer_id: CUSTOMER.id, price: 300000, status: 'completed' }]]);
        const res = await request(app)
            .post('/payments')
            .set('Authorization', authHeader(OTHER_CUSTOMER))
            .send({ order_id: 1 });
        expect(res.status).toBe(403);
    });

    test('trả về 400 nếu đơn hàng chưa hoàn thành (status=pending)', async () => {
        pool.execute.mockResolvedValueOnce([[{ id: 1, customer_id: CUSTOMER.id, price: 300000, status: 'pending' }]]);
        const res = await request(app)
            .post('/payments')
            .set('Authorization', authHeader(CUSTOMER))
            .send({ order_id: 1 });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/đã hoàn thành/);
    });

    test('trả về 400 nếu đơn hàng đang in_progress', async () => {
        pool.execute.mockResolvedValueOnce([[{ id: 1, customer_id: CUSTOMER.id, price: 300000, status: 'in_progress' }]]);
        const res = await request(app)
            .post('/payments')
            .set('Authorization', authHeader(CUSTOMER))
            .send({ order_id: 1 });
        expect(res.status).toBe(400);
    });

    test('trả về 409 nếu đơn hàng đã được thanh toán trước đó', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ id: 1, customer_id: CUSTOMER.id, price: 300000, status: 'completed' }]]) // SELECT orders
            .mockResolvedValueOnce([[{ id: 5 }]]); // SELECT payment (đã paid)
        const res = await request(app)
            .post('/payments')
            .set('Authorization', authHeader(CUSTOMER))
            .send({ order_id: 1 });
        expect(res.status).toBe(409);
        expect(res.body.message).toMatch(/đã được thanh toán/);
    });

    test('tạo thanh toán thành công cho đơn hàng completed', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ id: 1, customer_id: CUSTOMER.id, price: 500000, status: 'completed' }]]) // SELECT orders
            .mockResolvedValueOnce([[]]) // SELECT payment (chưa có)
            .mockResolvedValueOnce([{ insertId: 10 }]); // INSERT payment

        const res = await request(app)
            .post('/payments')
            .set('Authorization', authHeader(CUSTOMER))
            .send({ order_id: 1, method: 'momo' });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.data.id).toBe(10);
        expect(res.body.data.status).toBe('pending');
        expect(res.body.data.amount).toBe(500000);
    });

    test('tạo thanh toán thành công cho đơn hàng fixed', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ id: 2, customer_id: CUSTOMER.id, price: 800000, status: 'fixed' }]])
            .mockResolvedValueOnce([[]])
            .mockResolvedValueOnce([{ insertId: 11 }]);

        const res = await request(app)
            .post('/payments')
            .set('Authorization', authHeader(CUSTOMER))
            .send({ order_id: 2 });

        expect(res.status).toBe(201);
        expect(res.body.data.amount).toBe(800000);
    });

    test('sử dụng bank_transfer làm method mặc định khi không truyền', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ id: 1, customer_id: CUSTOMER.id, price: 300000, status: 'completed' }]])
            .mockResolvedValueOnce([[]])
            .mockResolvedValueOnce([{ insertId: 12 }]);

        const res = await request(app)
            .post('/payments')
            .set('Authorization', authHeader(CUSTOMER))
            .send({ order_id: 1 });

        expect(res.status).toBe(201);
        expect(pool.execute).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO payment'),
            [1, CUSTOMER.id, 300000, 'bank_transfer']
        );
    });
});

// ============================================================
// GET /payments (Lấy danh sách thanh toán - admin/coordinator, có phân trang)
// ============================================================
describe('GET /payments (lấy danh sách thanh toán có phân trang)', () => {
    test('trả về 401 nếu không có token', async () => {
        const res = await request(app).get('/payments');
        expect(res.status).toBe(401);
    });

    test('trả về 403 nếu role là customer', async () => {
        const res = await request(app).get('/payments').set('Authorization', authHeader(CUSTOMER));
        expect(res.status).toBe(403);
    });

    test('trả về danh sách thanh toán rỗng với phân trang đúng', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ total: 0 }]]) // COUNT
            .mockResolvedValueOnce([[]]); // items

        const res = await request(app).get('/payments').set('Authorization', authHeader(ADMIN));

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.items).toEqual([]);
        expect(res.body.data.pagination.page).toBe(1);
        expect(res.body.data.pagination.total).toBe(0);
    });

    test('phân trang hoạt động đúng với page=2 và limit=5', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ total: 12 }]])
            .mockResolvedValueOnce([[{ id: 6 }, { id: 7 }]]);

        const res = await request(app)
            .get('/payments?page=2&limit=5')
            .set('Authorization', authHeader(COORDINATOR));

        expect(res.status).toBe(200);
        expect(res.body.data.pagination.page).toBe(2);
        expect(res.body.data.pagination.limit).toBe(5);
        expect(res.body.data.pagination.totalPages).toBe(3); // ceil(12/5) = 3
    });

    test('lọc theo status=paid', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ total: 3 }]])
            .mockResolvedValueOnce([[{ id: 1, status: 'paid' }]]);

        const res = await request(app)
            .get('/payments?status=paid')
            .set('Authorization', authHeader(ADMIN));

        expect(res.status).toBe(200);
        expect(pool.execute).toHaveBeenCalledWith(
            expect.stringContaining('WHERE status = ?'),
            ['paid']
        );
    });

    test('trả về 400 nếu status không hợp lệ', async () => {
        const res = await request(app)
            .get('/payments?status=invalid_status')
            .set('Authorization', authHeader(ADMIN));
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/Payment status is invalid/);
    });

    test('giới hạn limit tối đa 100', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ total: 200 }]])
            .mockResolvedValueOnce([[]]);

        const res = await request(app)
            .get('/payments?limit=999')
            .set('Authorization', authHeader(ADMIN));

        expect(res.status).toBe(200);
        expect(res.body.data.pagination.limit).toBe(100);
    });

    test('page mặc định là 1 và limit mặc định là 10', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ total: 5 }]])
            .mockResolvedValueOnce([[]]);

        const res = await request(app)
            .get('/payments')
            .set('Authorization', authHeader(ADMIN));

        expect(res.status).toBe(200);
        expect(res.body.data.pagination.page).toBe(1);
        expect(res.body.data.pagination.limit).toBe(10);
    });
});

// ============================================================
// GET /payments/:id (Xem chi tiết thanh toán)
// ============================================================
describe('GET /payments/:id (chi tiết thanh toán)', () => {
    test('trả về 401 nếu không có token', async () => {
        const res = await request(app).get('/payments/1');
        expect(res.status).toBe(401);
    });

    test('trả về 404 nếu giao dịch không tồn tại', async () => {
        pool.execute.mockResolvedValueOnce([[]]);
        const res = await request(app)
            .get('/payments/999')
            .set('Authorization', authHeader(CUSTOMER));
        expect(res.status).toBe(404);
    });

    test('chủ giao dịch xem chi tiết thành công', async () => {
        const payment = { id: 1, customer_id: CUSTOMER.id, amount: 300000, status: 'paid' };
        pool.execute.mockResolvedValueOnce([[payment]]);

        const res = await request(app)
            .get('/payments/1')
            .set('Authorization', authHeader(CUSTOMER));

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toEqual(payment);
    });

    test('admin xem giao dịch của bất kỳ ai', async () => {
        const payment = { id: 2, customer_id: CUSTOMER.id, amount: 500000, status: 'pending' };
        pool.execute.mockResolvedValueOnce([[payment]]);

        const res = await request(app)
            .get('/payments/2')
            .set('Authorization', authHeader(ADMIN));

        expect(res.status).toBe(200);
        expect(res.body.data).toEqual(payment);
    });

    test('trả về 403 nếu customer khác cố xem giao dịch không phải của mình', async () => {
        pool.execute.mockResolvedValueOnce([[{ id: 1, customer_id: CUSTOMER.id, amount: 300000, status: 'paid' }]]);
        const res = await request(app)
            .get('/payments/1')
            .set('Authorization', authHeader(OTHER_CUSTOMER));
        expect(res.status).toBe(403);
    });
});

// ============================================================
// POST /payments/:id/mock-success (Giả lập thanh toán thành công)
// ============================================================
describe('POST /payments/:id/mock-success (giả lập thanh toán thành công)', () => {
    test('trả về 404 nếu giao dịch không tồn tại', async () => {
        pool.execute.mockResolvedValueOnce([[]]);
        const res = await request(app)
            .post('/payments/999/mock-success')
            .set('Authorization', authHeader(CUSTOMER));
        expect(res.status).toBe(404);
    });

    test('trả về 403 nếu không phải chủ giao dịch hoặc admin', async () => {
        pool.execute.mockResolvedValueOnce([[{ id: 1, customer_id: CUSTOMER.id, status: 'pending', order_id: 1 }]]);
        const res = await request(app)
            .post('/payments/1/mock-success')
            .set('Authorization', authHeader(OTHER_CUSTOMER));
        expect(res.status).toBe(403);
    });

    test('trả về 409 nếu giao dịch đã thanh toán rồi', async () => {
        pool.execute.mockResolvedValueOnce([[{ id: 1, customer_id: CUSTOMER.id, status: 'paid', order_id: 1 }]]);
        const res = await request(app)
            .post('/payments/1/mock-success')
            .set('Authorization', authHeader(CUSTOMER));
        expect(res.status).toBe(409);
        expect(res.body.message).toMatch(/đã được thanh toán/);
    });

    test('đánh dấu thanh toán thành công, cập nhật cả payment và order', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ id: 5, customer_id: CUSTOMER.id, status: 'pending', order_id: 10 }]]) // SELECT payment
            .mockResolvedValueOnce([{ affectedRows: 1 }]) // UPDATE payment SET status='paid'
            .mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE orders SET status='paid'

        const res = await request(app)
            .post('/payments/5/mock-success')
            .set('Authorization', authHeader(CUSTOMER));

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.transaction_id).toMatch(/^MTP-/);
        // Kiểm tra UPDATE payment
        expect(pool.execute).toHaveBeenCalledWith(
            expect.stringContaining("UPDATE payment SET status = 'paid'"),
            expect.arrayContaining([5])
        );
        // Kiểm tra UPDATE orders
        expect(pool.execute).toHaveBeenCalledWith(
            expect.stringContaining("UPDATE orders SET status = 'paid'"),
            [10]
        );
    });
});

// ============================================================
// POST /payments/:id/mock-fail (Giả lập thanh toán thất bại)
// ============================================================
describe('POST /payments/:id/mock-fail (giả lập thanh toán thất bại)', () => {
    test('trả về 404 nếu giao dịch không tồn tại', async () => {
        pool.execute.mockResolvedValueOnce([[]]);
        const res = await request(app)
            .post('/payments/999/mock-fail')
            .set('Authorization', authHeader(CUSTOMER));
        expect(res.status).toBe(404);
    });

    test('trả về 409 nếu giao dịch đã thanh toán thành công rồi', async () => {
        pool.execute.mockResolvedValueOnce([[{ id: 1, customer_id: CUSTOMER.id, status: 'paid' }]]);
        const res = await request(app)
            .post('/payments/1/mock-fail')
            .set('Authorization', authHeader(CUSTOMER));
        expect(res.status).toBe(409);
        expect(res.body.message).toMatch(/đã thanh toán/);
    });

    test('đánh dấu thanh toán thất bại thành công', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ id: 3, customer_id: CUSTOMER.id, status: 'pending' }]]) // SELECT
            .mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE

        const res = await request(app)
            .post('/payments/3/mock-fail')
            .set('Authorization', authHeader(CUSTOMER));

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.id).toBe(3);
        expect(pool.execute).toHaveBeenCalledWith(
            expect.stringContaining("UPDATE payment SET status = 'failed'"),
            [3]
        );
    });
});

// ============================================================
// POST /:id/pay (Thanh toán đơn hàng - luồng trực tiếp với transaction)
// ============================================================
describe('POST /:id/pay (thanh toán đơn hàng trực tiếp)', () => {
    test('trả về 401 nếu không có token', async () => {
        const res = await request(app).post('/1/pay').send({ amount: 300000 });
        expect(res.status).toBe(401);
    });

    test('trả về 403 nếu role không phải customer', async () => {
        const res = await request(app)
            .post('/1/pay')
            .set('Authorization', authHeader(COORDINATOR))
            .send({ amount: 300000 });
        expect(res.status).toBe(403);
    });

    test('trả về 400 nếu id không phải số nguyên', async () => {
        const res = await request(app)
            .post('/abc/pay')
            .set('Authorization', authHeader(CUSTOMER))
            .send({ amount: 300000 });
        expect(res.status).toBe(400);
    });

    test('trả về 404 nếu đơn hàng không tồn tại', async () => {
        pool.execute.mockResolvedValueOnce([[]]); // SELECT orders
        const res = await request(app)
            .post('/999/pay')
            .set('Authorization', authHeader(CUSTOMER))
            .send({ amount: 300000, method: 'credit_card' });
        expect(res.status).toBe(404);
    });

    test('trả về 403 nếu customer khác cố thanh toán đơn không phải của mình', async () => {
        pool.execute.mockResolvedValueOnce([[{ customer_id: CUSTOMER.id, price: 300000 }]]);
        const res = await request(app)
            .post('/1/pay')
            .set('Authorization', authHeader(OTHER_CUSTOMER))
            .send({ amount: 300000 });
        expect(res.status).toBe(403);
    });

    test('trả về 400 nếu số tiền không khớp với giá đơn hàng', async () => {
        pool.execute.mockResolvedValueOnce([[{ customer_id: CUSTOMER.id, price: 300000 }]]);
        const res = await request(app)
            .post('/1/pay')
            .set('Authorization', authHeader(CUSTOMER))
            .send({ amount: 100000, method: 'credit_card' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/Số tiền thanh toán không khớp/);
    });

    test('trả về 400 nếu đơn hàng không ở trạng thái hợp lệ (ROLLBACK)', async () => {
        pool.execute.mockResolvedValueOnce([[{ customer_id: CUSTOMER.id, price: 500000 }]]); // SELECT orders
        pool.query.mockResolvedValueOnce({}); // START TRANSACTION
        pool.execute.mockResolvedValueOnce([{ affectedRows: 0 }]); // UPDATE (status != completed/fixed)
        pool.query.mockResolvedValueOnce({}); // ROLLBACK

        const res = await request(app)
            .post('/1/pay')
            .set('Authorization', authHeader(CUSTOMER))
            .send({ amount: 500000, method: 'credit_card' });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/không hợp lệ để thanh toán/);
    });

    test('thanh toán thành công và COMMIT transaction', async () => {
        pool.execute.mockResolvedValueOnce([[{ customer_id: CUSTOMER.id, price: 300000 }]]); // SELECT orders
        pool.query.mockResolvedValueOnce({}); // START TRANSACTION
        pool.execute
            .mockResolvedValueOnce([{ affectedRows: 1 }]) // UPDATE orders SET status='paid'
            .mockResolvedValueOnce([{ insertId: 50 }]); // INSERT payment
        pool.query.mockResolvedValueOnce({}); // COMMIT

        const res = await request(app)
            .post('/1/pay')
            .set('Authorization', authHeader(CUSTOMER))
            .send({ amount: 300000, method: 'momo' });

        expect(res.status).toBe(200);
        expect(res.body.message).toMatch(/Thanh toán thành công/);
        // Kiểm tra INSERT payment
        expect(pool.execute).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO payment'),
            ['1', CUSTOMER.id, 300000, 'momo']
        );
    });

    test('dùng credit_card làm method mặc định khi không truyền', async () => {
        pool.execute.mockResolvedValueOnce([[{ customer_id: CUSTOMER.id, price: 300000 }]]);
        pool.query.mockResolvedValueOnce({});
        pool.execute
            .mockResolvedValueOnce([{ affectedRows: 1 }])
            .mockResolvedValueOnce([{ insertId: 51 }]);
        pool.query.mockResolvedValueOnce({});

        const res = await request(app)
            .post('/1/pay')
            .set('Authorization', authHeader(CUSTOMER))
            .send({ amount: 300000 });

        expect(res.status).toBe(200);
        expect(pool.execute).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO payment'),
            ['1', CUSTOMER.id, 300000, 'credit_card']
        );
    });
});

// ============================================================
// GET /admin/payments (Admin lấy tất cả giao dịch)
// ============================================================
describe('GET /admin/payments (admin lấy tất cả giao dịch)', () => {
    test('trả về 401 nếu không có token', async () => {
        const res = await request(app).get('/admin/payments');
        expect(res.status).toBe(401);
    });

    test('trả về 403 nếu role không phải admin', async () => {
        const res = await request(app)
            .get('/admin/payments')
            .set('Authorization', authHeader(COORDINATOR));
        expect(res.status).toBe(403);
    });

    test('trả về danh sách rỗng khi chưa có giao dịch', async () => {
        pool.execute.mockResolvedValueOnce([[]]); // payments rỗng

        const res = await request(app)
            .get('/admin/payments')
            .set('Authorization', authHeader(ADMIN));

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    test('trả về danh sách giao dịch với tên khách hàng từ cache (HIT)', async () => {
        const payment = { id: 1, customer_id: 5, amount: 300000, status: 'paid' };
        pool.execute.mockResolvedValueOnce([[payment]]);
        redis.get.mockResolvedValueOnce('Nguyễn Văn D'); // cache HIT

        const res = await request(app)
            .get('/admin/payments')
            .set('Authorization', authHeader(ADMIN));

        expect(res.status).toBe(200);
        expect(res.body[0].customer_name).toBe('Nguyễn Văn D');
        expect(axios.get).not.toHaveBeenCalled();
    });

    test('trả về danh sách giao dịch với tên khách hàng từ auth-service (cache MISS)', async () => {
        const payment = { id: 2, customer_id: 8, amount: 500000, status: 'pending' };
        pool.execute.mockResolvedValueOnce([[payment]]);
        redis.get.mockResolvedValueOnce(null); // cache MISS
        axios.get.mockResolvedValueOnce({ data: { name: 'Trần Thị E' } });

        const res = await request(app)
            .get('/admin/payments')
            .set('Authorization', authHeader(ADMIN));

        expect(res.status).toBe(200);
        expect(res.body[0].customer_name).toBe('Trần Thị E');
        expect(redis.set).toHaveBeenCalledWith('user:8:name', 'Trần Thị E', 'EX', 3600);
    });

    test('trả về customer_name = "Không rõ" khi auth-service lỗi', async () => {
        const payment = { id: 3, customer_id: 99, amount: 800000, status: 'paid' };
        pool.execute.mockResolvedValueOnce([[payment]]);
        redis.get.mockResolvedValueOnce(null);
        axios.get.mockRejectedValueOnce(new Error('auth-service down'));

        const res = await request(app)
            .get('/admin/payments')
            .set('Authorization', authHeader(ADMIN));

        expect(res.status).toBe(200);
        expect(res.body[0].customer_name).toBe('Không rõ');
    });
});
