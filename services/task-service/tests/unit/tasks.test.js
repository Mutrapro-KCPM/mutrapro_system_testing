// services/task-service/tests/unit/tasks.test.js

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

// ---- Mock axios ----
jest.mock('axios');

// ---- Mock amqplib ----
jest.mock('amqplib', () => ({
    connect: jest.fn().mockResolvedValue({
        createChannel: jest.fn().mockResolvedValue({
            assertExchange: jest.fn(),
            assertQueue: jest.fn(),
            bindQueue: jest.fn(),
            consume: jest.fn(),
            publish: jest.fn(),
            close: jest.fn(),
            ack: jest.fn(),
            nack: jest.fn(),
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

// ---- Helper JWT ----
const token = (payload) => jwt.sign(payload, process.env.JWT_SECRET);
const authHeader = (payload) => `Bearer ${token(payload)}`;

const CUSTOMER = { id: 1, role: 'customer' };
const COORDINATOR = { id: 10, role: 'coordinator' };
const ADMIN = { id: 20, role: 'admin' };
const SPECIALIST = { id: 30, role: 'transcriber' };
const OTHER_SPECIALIST = { id: 31, role: 'transcriber' };

// ============================================================
// GET /health
// ============================================================
describe('GET /health', () => {
    test('trả về 200, body.service = task-service, status = ok', async () => {
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
        expect(res.body.service).toBe('task-service');
        expect(res.body.status).toBe('ok');
    });
});

// ============================================================
// POST /
// ============================================================
describe('POST /', () => {
    const validTaskData = {
        order_id: 100,
        assigned_to: 30,
        specialist_role: 'transcriber',
        deadline: '2026-12-31'
    };

    test('401 nếu không có token', async () => {
        const res = await request(app).post('/').send(validTaskData);
        expect(res.status).toBe(401);
    });

    test('403 nếu role không phải coordinator', async () => {
        const res = await request(app).post('/').set('Authorization', authHeader(CUSTOMER)).send(validTaskData);
        expect(res.status).toBe(403);
    });

    test('400 nếu thiếu thông tin bắt buộc', async () => {
        const { order_id, ...missingData } = validTaskData;
        const res = await request(app).post('/').set('Authorization', authHeader(COORDINATOR)).send(missingData);
        expect(res.status).toBe(400);
    });

    test('409 nếu order đã có task đang xử lý', async () => {
        pool.execute.mockResolvedValueOnce([[{ id: 5 }]]); 

        const res = await request(app).post('/').set('Authorization', authHeader(COORDINATOR)).send(validTaskData);
        expect(res.status).toBe(409);
        expect(res.body.message).toMatch(/Đơn hàng này đã có task đang xử lý/);
    });

    test('201 nếu tạo task thành công', async () => {
        pool.execute
            .mockResolvedValueOnce([[]]) // no existing task
            .mockResolvedValueOnce([{ insertId: 99 }]); // insert result
        axios.post.mockResolvedValueOnce({}); // notify success

        const res = await request(app).post('/').set('Authorization', authHeader(COORDINATOR)).send(validTaskData);
        expect(res.status).toBe(201);
        expect(res.body.id).toBe(99);
        expect(res.body.message).toBe('Task created');
    });

    test('vẫn 201 nếu gửi notification bị lỗi', async () => {
        pool.execute
            .mockResolvedValueOnce([[]])
            .mockResolvedValueOnce([{ insertId: 100 }]);
        axios.post.mockRejectedValueOnce(new Error('notification-service down'));

        const res = await request(app).post('/').set('Authorization', authHeader(COORDINATOR)).send(validTaskData);
        expect(res.status).toBe(201);
        expect(res.body.id).toBe(100);
    });
});

// ============================================================
// PUT /:id/status
// ============================================================
describe('PUT /:id/status', () => {
    test('401 nếu thiếu token', async () => {
        const res = await request(app).put('/1/status').send({ status: 'in_progress' });
        expect(res.status).toBe(401);
    });

    test('400 nếu status không hợp lệ', async () => {
        const res = await request(app).put('/1/status').set('Authorization', authHeader(COORDINATOR)).send({ status: 'invalid_status' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/Trạng thái task không hợp lệ/);
    });

    test('404 nếu không tìm thấy task', async () => {
        pool.execute.mockResolvedValueOnce([[]]); // SELECT assigned_to
        const res = await request(app).put('/1/status').set('Authorization', authHeader(COORDINATOR)).send({ status: 'in_progress' });
        expect(res.status).toBe(404);
        expect(res.body.message).toMatch(/Không tìm thấy task/);
    });

    test('403 nếu user không phải owner/admin/coordinator', async () => {
        pool.execute.mockResolvedValueOnce([[{ assigned_to: SPECIALIST.id }]]);
        // another specialist tries to update
        const res = await request(app).put('/1/status').set('Authorization', authHeader(OTHER_SPECIALIST)).send({ status: 'in_progress' });
        expect(res.status).toBe(403);
    });

    test('success khi owner cập nhật status', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ assigned_to: SPECIALIST.id }]]) // SELECT assigned_to
            .mockResolvedValueOnce([{ affectedRows: 1 }]) // UPDATE task
            .mockResolvedValueOnce([[{ order_id: 100 }]]); // SELECT order_id

        const res = await request(app).put('/1/status').set('Authorization', authHeader(SPECIALIST)).send({ status: 'assigned' });
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Task status updated');
    });

    test('status = in_progress thì gọi axios.put sang order-service', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ assigned_to: SPECIALIST.id }]])
            .mockResolvedValueOnce([{ affectedRows: 1 }])
            .mockResolvedValueOnce([[{ order_id: 100 }]]);
        
        axios.put.mockResolvedValueOnce({});

        const res = await request(app).put('/1/status').set('Authorization', authHeader(SPECIALIST)).send({ status: 'in_progress' });
        expect(res.status).toBe(200);
        expect(axios.put).toHaveBeenCalledWith(
            'http://order-service:3002/100/status',
            { status: 'in_progress' },
            expect.any(Object)
        );
    });

    test('status = done và có coordinatorId thì gọi notification-service', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ assigned_to: SPECIALIST.id }]])
            .mockResolvedValueOnce([{ affectedRows: 1 }])
            .mockResolvedValueOnce([[{ order_id: 100 }]]);
        
        axios.post.mockResolvedValueOnce({});

        const res = await request(app).put('/1/status')
            .set('Authorization', authHeader(SPECIALIST))
            .send({ status: 'done', coordinatorId: COORDINATOR.id });
        expect(res.status).toBe(200);
        
        expect(axios.post).toHaveBeenCalledWith(
            'http://notification-service:3006/notify',
            expect.objectContaining({
                userId: COORDINATOR.id,
                eventName: 'task_completed'
            })
        );
    });
});

// ============================================================
// GET /order/:orderId
// ============================================================
describe('GET /order/:orderId', () => {
    test('404 nếu không có task', async () => {
        pool.execute.mockResolvedValueOnce([[]]);
        const res = await request(app).get('/order/999');
        expect(res.status).toBe(404);
        expect(res.body.message).toMatch(/Không tìm thấy task cho đơn hàng này/);
    });

    test('200 nếu có task', async () => {
        const task = { id: 1, order_id: 100, status: 'assigned' };
        pool.execute.mockResolvedValueOnce([[task]]);
        const res = await request(app).get('/order/100');
        expect(res.status).toBe(200);
        expect(res.body).toEqual(task);
    });
});

// ============================================================
// POST /order/:orderId/re-open
// ============================================================
describe('POST /order/:orderId/re-open', () => {
    test('không có task thì vẫn response success, không update DB', async () => {
        pool.execute.mockResolvedValueOnce([[]]); // SELECT task
        const res = await request(app).post('/order/100/re-open').send({ comment: 'Please fix' });
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Task re-opened successfully');
        // ensure UPDATE was not called
        expect(pool.execute).toHaveBeenCalledTimes(1);
    });

    test('task đã revision_requested thì không update lại', async () => {
        pool.execute.mockResolvedValueOnce([[{ id: 1, status: 'revision_requested' }]]);
        const res = await request(app).post('/order/100/re-open').send({ comment: 'Please fix' });
        expect(res.status).toBe(200);
        expect(pool.execute).toHaveBeenCalledTimes(1);
    });

    test('task done/assigned/in_progress thì update revision_requested', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ id: 1, status: 'done', assigned_to: SPECIALIST.id }]]) // SELECT task
            .mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE task

        axios.post.mockResolvedValueOnce({}); // notify

        const res = await request(app).post('/order/100/re-open').send({ comment: 'Please fix' });
        expect(res.status).toBe(200);
        
        // SELECT and UPDATE
        expect(pool.execute).toHaveBeenCalledTimes(2);
        expect(pool.execute).toHaveBeenNthCalledWith(2, expect.stringContaining("UPDATE task SET status = 'revision_requested'"), expect.any(Array));
    });

    test('gửi notification cho assigned_to nếu reopen thành công', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ id: 1, status: 'done', assigned_to: SPECIALIST.id }]])
            .mockResolvedValueOnce([{ affectedRows: 1 }]);

        axios.post.mockResolvedValueOnce({});

        const res = await request(app).post('/order/100/re-open').send({ comment: 'Fix it' });
        expect(res.status).toBe(200);
        
        expect(axios.post).toHaveBeenCalledWith(
            'http://notification-service:3006/notify',
            expect.objectContaining({
                userId: SPECIALIST.id,
                eventName: 'task_revision_needed'
            })
        );
    });
});

// ============================================================
// GET /specialist/:specialistId
// ============================================================
describe('GET /specialist/:specialistId', () => {
    test('401 nếu thiếu token', async () => {
        const res = await request(app).get(`/specialist/${SPECIALIST.id}`);
        expect(res.status).toBe(401);
    });

    test('403 nếu không phải chính specialist/admin/coordinator', async () => {
        const res = await request(app).get(`/specialist/${SPECIALIST.id}`).set('Authorization', authHeader(OTHER_SPECIALIST));
        expect(res.status).toBe(403);
    });

    test('trả [] nếu không có task', async () => {
        pool.execute.mockResolvedValueOnce([[]]);
        const res = await request(app).get(`/specialist/${SPECIALIST.id}`).set('Authorization', authHeader(SPECIALIST));
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    test('trả task có description khi order-service trả dữ liệu', async () => {
        const tasks = [{ id: 1, order_id: 100, assigned_to: SPECIALIST.id }];
        pool.execute.mockResolvedValueOnce([tasks]);
        axios.get.mockResolvedValueOnce({ data: { description: 'Good job' } });

        const res = await request(app).get(`/specialist/${SPECIALIST.id}`).set('Authorization', authHeader(SPECIALIST));
        expect(res.status).toBe(200);
        expect(res.body[0].description).toBe('Good job');
    });

    test('fallback description = "Order description unavailable." khi order-service lỗi', async () => {
        const tasks = [{ id: 1, order_id: 100, assigned_to: SPECIALIST.id }];
        pool.execute.mockResolvedValueOnce([tasks]);
        axios.get.mockRejectedValueOnce(new Error('order-service offline'));

        const res = await request(app).get(`/specialist/${SPECIALIST.id}`).set('Authorization', authHeader(SPECIALIST));
        expect(res.status).toBe(200);
        expect(res.body[0].description).toBe('Order description unavailable.');
    });
});
