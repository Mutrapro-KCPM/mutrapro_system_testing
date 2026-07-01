// tests/unit/feedbacks-revisions.test.js
// Test cho nhóm: POST /:id/feedback, GET /:id/feedback, POST /:id/request-revision

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
const mockPublish = jest.fn();
jest.mock('amqplib', () => ({
    connect: jest.fn().mockResolvedValue({
        createChannel: jest.fn().mockResolvedValue({
            assertExchange: jest.fn(),
            publish: mockPublish,
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
const axios = require('axios');
const request = require('supertest');

const pool = mysql.__mockPool;

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
// POST /:id/feedback (Gửi đánh giá)
// ============================================================
describe('POST /:id/feedback (gửi đánh giá)', () => {
    test('trả về 401 nếu không có token', async () => {
        const res = await request(app).post('/1/feedback').send({ rating: 5 });
        expect(res.status).toBe(401);
    });

    test('trả về 403 nếu role không phải customer', async () => {
        const res = await request(app)
            .post('/1/feedback')
            .set('Authorization', authHeader(COORDINATOR))
            .send({ rating: 5 });
        expect(res.status).toBe(403);
    });

    test('trả về 400 nếu id không phải số nguyên', async () => {
        const res = await request(app)
            .post('/abc/feedback')
            .set('Authorization', authHeader(CUSTOMER))
            .send({ rating: 5 });
        expect(res.status).toBe(400);
    });

    test('trả về 400 nếu rating thiếu', async () => {
        const res = await request(app)
            .post('/1/feedback')
            .set('Authorization', authHeader(CUSTOMER))
            .send({});
        expect(res.status).toBe(400);
    });

    test('trả về 400 nếu rating < 1', async () => {
        const res = await request(app)
            .post('/1/feedback')
            .set('Authorization', authHeader(CUSTOMER))
            .send({ rating: 0 });
        expect(res.status).toBe(400);
    });

    test('trả về 400 nếu rating > 5', async () => {
        const res = await request(app)
            .post('/1/feedback')
            .set('Authorization', authHeader(CUSTOMER))
            .send({ rating: 6 });
        expect(res.status).toBe(400);
    });

    test('trả về 400 nếu rating không phải số nguyên (3.5)', async () => {
        const res = await request(app)
            .post('/1/feedback')
            .set('Authorization', authHeader(CUSTOMER))
            .send({ rating: 3.5 });
        expect(res.status).toBe(400);
    });

    test('trả về 400 nếu comment quá 500 ký tự', async () => {
        const res = await request(app)
            .post('/1/feedback')
            .set('Authorization', authHeader(CUSTOMER))
            .send({ rating: 5, comment: 'a'.repeat(501) });
        expect(res.status).toBe(400);
    });

    test('trả về 404 nếu đơn hàng không tồn tại', async () => {
        pool.execute.mockResolvedValueOnce([[]]); // SELECT orders
        const res = await request(app)
            .post('/999/feedback')
            .set('Authorization', authHeader(CUSTOMER))
            .send({ rating: 5 });
        expect(res.status).toBe(404);
    });

    test('trả về 403 nếu customer khác cố đánh giá đơn không phải của mình', async () => {
        pool.execute.mockResolvedValueOnce([[{ customer_id: CUSTOMER.id, status: 'paid' }]]);
        const res = await request(app)
            .post('/1/feedback')
            .set('Authorization', authHeader(OTHER_CUSTOMER))
            .send({ rating: 5 });
        expect(res.status).toBe(403);
    });

    test('trả về 400 nếu đơn hàng chưa được thanh toán (status != paid)', async () => {
        pool.execute.mockResolvedValueOnce([[{ customer_id: CUSTOMER.id, status: 'completed' }]]);
        const res = await request(app)
            .post('/1/feedback')
            .set('Authorization', authHeader(CUSTOMER))
            .send({ rating: 5 });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/đã thanh toán/);
    });

    test('trả về 409 nếu đơn hàng đã được đánh giá rồi', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ customer_id: CUSTOMER.id, status: 'paid' }]]) // SELECT orders
            .mockResolvedValueOnce([[{ id: 1 }]]); // SELECT feedback (đã tồn tại)
        const res = await request(app)
            .post('/1/feedback')
            .set('Authorization', authHeader(CUSTOMER))
            .send({ rating: 4 });
        expect(res.status).toBe(409);
        expect(res.body.message).toMatch(/đã được đánh giá/);
    });

    test('gửi đánh giá thành công với rating và comment', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ customer_id: CUSTOMER.id, status: 'paid' }]]) // SELECT orders
            .mockResolvedValueOnce([[]]) // SELECT feedback (chưa có)
            .mockResolvedValueOnce([{ insertId: 1 }]); // INSERT feedback

        const res = await request(app)
            .post('/1/feedback')
            .set('Authorization', authHeader(CUSTOMER))
            .send({ rating: 5, comment: 'Rất hài lòng!' });

        expect(res.status).toBe(201);
        expect(res.body.message).toMatch(/đánh giá thành công/);
        expect(pool.execute).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO feedback'),
            ['1', 5, 'Rất hài lòng!']
        );
    });

    test('gửi đánh giá thành công chỉ với rating (không có comment)', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ customer_id: CUSTOMER.id, status: 'paid' }]])
            .mockResolvedValueOnce([[]])
            .mockResolvedValueOnce([{ insertId: 2 }]);

        const res = await request(app)
            .post('/1/feedback')
            .set('Authorization', authHeader(CUSTOMER))
            .send({ rating: 3 });

        expect(res.status).toBe(201);
        expect(pool.execute).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO feedback'),
            ['1', 3, null]
        );
    });

    test('gửi đánh giá với rating biên dưới (1) thành công', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ customer_id: CUSTOMER.id, status: 'paid' }]])
            .mockResolvedValueOnce([[]])
            .mockResolvedValueOnce([{ insertId: 3 }]);

        const res = await request(app)
            .post('/1/feedback')
            .set('Authorization', authHeader(CUSTOMER))
            .send({ rating: 1, comment: 'Chưa hài lòng' });

        expect(res.status).toBe(201);
    });

    test('gửi đánh giá với comment đúng 500 ký tự (biên trên hợp lệ)', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ customer_id: CUSTOMER.id, status: 'paid' }]])
            .mockResolvedValueOnce([[]])
            .mockResolvedValueOnce([{ insertId: 4 }]);

        const res = await request(app)
            .post('/1/feedback')
            .set('Authorization', authHeader(CUSTOMER))
            .send({ rating: 4, comment: 'a'.repeat(500) });

        expect(res.status).toBe(201);
    });
});

// ============================================================
// GET /:id/feedback (Kiểm tra feedback đã tồn tại chưa)
// ============================================================
describe('GET /:id/feedback (kiểm tra feedback)', () => {
    test('trả về 401 nếu không có token', async () => {
        const res = await request(app).get('/1/feedback');
        expect(res.status).toBe(401);
    });

    test('trả về 400 nếu id không phải số nguyên', async () => {
        const res = await request(app)
            .get('/abc/feedback')
            .set('Authorization', authHeader(CUSTOMER));
        expect(res.status).toBe(400);
    });

    test('trả về 404 nếu đơn hàng không tồn tại', async () => {
        pool.execute.mockResolvedValueOnce([[]]); // SELECT orders
        const res = await request(app)
            .get('/999/feedback')
            .set('Authorization', authHeader(CUSTOMER));
        expect(res.status).toBe(404);
    });

    test('trả về 403 nếu customer khác cố kiểm tra feedback đơn không phải của mình', async () => {
        pool.execute.mockResolvedValueOnce([[{ customer_id: CUSTOMER.id }]]);
        const res = await request(app)
            .get('/1/feedback')
            .set('Authorization', authHeader(OTHER_CUSTOMER));
        expect(res.status).toBe(403);
    });

    test('chủ đơn hàng kiểm tra: đã có feedback (hasFeedback=true)', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ customer_id: CUSTOMER.id }]]) // SELECT orders
            .mockResolvedValueOnce([[{ id: 1 }]]); // SELECT feedback (tồn tại)

        const res = await request(app)
            .get('/1/feedback')
            .set('Authorization', authHeader(CUSTOMER));

        expect(res.status).toBe(200);
        expect(res.body.hasFeedback).toBe(true);
    });

    test('chủ đơn hàng kiểm tra: chưa có feedback (hasFeedback=false)', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ customer_id: CUSTOMER.id }]])
            .mockResolvedValueOnce([[]]); // feedback chưa tồn tại

        const res = await request(app)
            .get('/1/feedback')
            .set('Authorization', authHeader(CUSTOMER));

        expect(res.status).toBe(200);
        expect(res.body.hasFeedback).toBe(false);
    });

    test('admin kiểm tra feedback đơn hàng của bất kỳ ai', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ customer_id: CUSTOMER.id }]])
            .mockResolvedValueOnce([[{ id: 10 }]]);

        const res = await request(app)
            .get('/1/feedback')
            .set('Authorization', authHeader(ADMIN));

        expect(res.status).toBe(200);
        expect(res.body.hasFeedback).toBe(true);
    });

    test('coordinator kiểm tra feedback đơn hàng thành công', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ customer_id: CUSTOMER.id }]])
            .mockResolvedValueOnce([[]]);

        const res = await request(app)
            .get('/1/feedback')
            .set('Authorization', authHeader(COORDINATOR));

        expect(res.status).toBe(200);
        expect(res.body.hasFeedback).toBe(false);
    });
});

// ============================================================
// POST /:id/request-revision (Yêu cầu chỉnh sửa)
// ============================================================
describe('POST /:id/request-revision (yêu cầu chỉnh sửa)', () => {
    test('trả về 401 nếu không có token', async () => {
        const res = await request(app).post('/1/request-revision').send({ comment: 'Sửa lại' });
        expect(res.status).toBe(401);
    });

    test('trả về 403 nếu role không phải customer', async () => {
        const res = await request(app)
            .post('/1/request-revision')
            .set('Authorization', authHeader(COORDINATOR))
            .send({ comment: 'Sửa lại' });
        expect(res.status).toBe(403);
    });

    test('trả về 400 nếu id không phải số nguyên', async () => {
        const res = await request(app)
            .post('/abc/request-revision')
            .set('Authorization', authHeader(CUSTOMER))
            .send({ comment: 'Sửa lại' });
        expect(res.status).toBe(400);
    });

    test('trả về 400 nếu thiếu comment', async () => {
        const res = await request(app)
            .post('/1/request-revision')
            .set('Authorization', authHeader(CUSTOMER))
            .send({});
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/nội dung yêu cầu chỉnh sửa/);
    });

    test('trả về 400 nếu comment rỗng (chỉ có khoảng trắng)', async () => {
        const res = await request(app)
            .post('/1/request-revision')
            .set('Authorization', authHeader(CUSTOMER))
            .send({ comment: '   ' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/nội dung yêu cầu chỉnh sửa/);
    });

    test('trả về 400 nếu comment vượt quá 1000 ký tự', async () => {
        const res = await request(app)
            .post('/1/request-revision')
            .set('Authorization', authHeader(CUSTOMER))
            .send({ comment: 'a'.repeat(1001) });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/vượt quá 1000/);
    });

    test('trả về 404 nếu đơn hàng không tồn tại', async () => {
        pool.execute.mockResolvedValueOnce([[]]); // SELECT orders
        const res = await request(app)
            .post('/999/request-revision')
            .set('Authorization', authHeader(CUSTOMER))
            .send({ comment: 'Cần sửa lại phần intro' });
        expect(res.status).toBe(404);
    });

    test('trả về 403 nếu customer khác cố yêu cầu chỉnh sửa đơn không phải của mình', async () => {
        pool.execute.mockResolvedValueOnce([[{ customer_id: CUSTOMER.id }]]);
        const res = await request(app)
            .post('/1/request-revision')
            .set('Authorization', authHeader(OTHER_CUSTOMER))
            .send({ comment: 'Cần sửa' });
        expect(res.status).toBe(403);
    });

    test('trả về 400 nếu đơn hàng không ở trạng thái completed/fixed', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ customer_id: CUSTOMER.id }]]) // SELECT orders
            .mockResolvedValueOnce([{ affectedRows: 0 }]); // UPDATE (status != completed/fixed)

        const res = await request(app)
            .post('/1/request-revision')
            .set('Authorization', authHeader(CUSTOMER))
            .send({ comment: 'Cần sửa phần điệp khúc' });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/không hợp lệ để yêu cầu chỉnh sửa/);
    });

    test('yêu cầu chỉnh sửa thành công và gửi message qua RabbitMQ', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ customer_id: CUSTOMER.id }]]) // SELECT orders
            .mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE status='revision_requested'
        axios.post.mockResolvedValue({}); // notify

        const res = await request(app)
            .post('/1/request-revision')
            .set('Authorization', authHeader(CUSTOMER))
            .send({ comment: 'Cần sửa phần điệp khúc', coordinatorId: 10 });

        expect(res.status).toBe(200);
        expect(res.body.message).toMatch(/Yêu cầu chỉnh sửa đã được gửi/);
        // Kiểm tra UPDATE orders
        expect(pool.execute).toHaveBeenCalledWith(
            expect.stringContaining("UPDATE orders SET status = 'revision_requested'"),
            ['1']
        );
        // Kiểm tra gửi message RabbitMQ
        expect(mockPublish).toHaveBeenCalledWith(
            'mutrapro_events',
            'order.revision_requested',
            expect.any(Buffer)
        );
    });

    test('yêu cầu chỉnh sửa thành công mà không gửi notification (không có coordinatorId)', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ customer_id: CUSTOMER.id }]])
            .mockResolvedValueOnce([{ affectedRows: 1 }]);

        const res = await request(app)
            .post('/1/request-revision')
            .set('Authorization', authHeader(CUSTOMER))
            .send({ comment: 'Sửa lại nhịp trống' });

        expect(res.status).toBe(200);
        expect(res.body.message).toMatch(/Yêu cầu chỉnh sửa đã được gửi/);
        // Không gọi notify vì không có coordinatorId
        expect(axios.post).not.toHaveBeenCalled();
    });

    test('yêu cầu chỉnh sửa với comment đúng 1000 ký tự (biên trên hợp lệ)', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ customer_id: CUSTOMER.id }]])
            .mockResolvedValueOnce([{ affectedRows: 1 }]);

        const res = await request(app)
            .post('/1/request-revision')
            .set('Authorization', authHeader(CUSTOMER))
            .send({ comment: 'a'.repeat(1000) });

        expect(res.status).toBe(200);
    });
});
