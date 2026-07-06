process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'unit-test-secret';
process.env.INTERNAL_SERVICE_TOKEN = 'internal-test-token';
process.env.DB_HOST = 'localhost';
process.env.DB_USER = 'unit';
process.env.DB_TASK_NAME = 'unit';

const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('mysql2/promise', () => {
  const mockPool = { execute: jest.fn(), query: jest.fn() };
  return { createPool: jest.fn(() => mockPool), __mockPool: mockPool };
});

jest.mock('axios');

jest.mock('amqplib', () => ({
  connect: jest.fn().mockResolvedValue({
    createChannel: jest.fn().mockResolvedValue({
      assertExchange: jest.fn(),
      assertQueue: jest.fn(),
      bindQueue: jest.fn(),
      consume: jest.fn(),
      ack: jest.fn(),
      nack: jest.fn()
    })
  })
}));

jest.mock('../../shared/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

const mysql = require('mysql2/promise');
const axios = require('axios');
const app = require('../../index');

const pool = mysql.__mockPool;
const token = (payload) => jwt.sign(payload, process.env.JWT_SECRET);
const auth = (payload) => `Bearer ${token(payload)}`;
const futureDeadline = () => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

beforeEach(() => {
  jest.clearAllMocks();
});

describe('task-service whitebox tests', () => {
  describe('GET /health', () => {
    test('returns health status', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.service).toBe('task-service');
      expect(res.body.status).toBe('ok');
    });
  });

  describe('POST /', () => {
    const validBody = () => ({
      order_id: 123,
      assigned_to: 10,
      specialist_role: 'transcriber',
      deadline: futureDeadline()
    });

    test('returns 401 without token', async () => {
      const res = await request(app).post('/').send(validBody());

      expect(res.status).toBe(401);
      expect(pool.execute).not.toHaveBeenCalled();
    });

    test('returns 403 when role is not coordinator', async () => {
      const res = await request(app)
        .post('/')
        .set('Authorization', auth({ id: 1, role: 'artist' }))
        .send(validBody());

      expect(res.status).toBe(403);
      expect(pool.execute).not.toHaveBeenCalled();
    });

    test('returns 400 when required fields are missing', async () => {
      const res = await request(app)
        .post('/')
        .set('Authorization', auth({ id: 1, role: 'coordinator' }))
        .send({ order_id: 123 });

      expect(res.status).toBe(400);
      expect(pool.execute).not.toHaveBeenCalled();
    });

    test('returns 409 when order already has an active task', async () => {
      pool.execute.mockResolvedValueOnce([[{ id: 1 }]]);

      const res = await request(app)
        .post('/')
        .set('Authorization', auth({ id: 1, role: 'coordinator' }))
        .send(validBody());

      expect(res.status).toBe(409);
    });

    test('creates task and sends notification', async () => {
      pool.execute.mockResolvedValueOnce([[]]);
      pool.execute.mockResolvedValueOnce([{ insertId: 99 }]);
      axios.post.mockResolvedValueOnce({});

      const res = await request(app)
        .post('/')
        .set('Authorization', auth({ id: 1, role: 'coordinator' }))
        .send(validBody());

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ id: 99, message: 'Task created' });
      expect(axios.post).toHaveBeenCalledWith(
        'http://notification-service:3006/notify',
        expect.objectContaining({ userId: 10, eventName: 'new_task' })
      );
    });
  });

  describe('PUT /:id/status', () => {
    test('returns 401 without token', async () => {
      const res = await request(app).put('/1/status').send({ status: 'done' });

      expect(res.status).toBe(401);
      expect(pool.execute).not.toHaveBeenCalled();
    });

    test('returns 400 for invalid status', async () => {
      const res = await request(app)
        .put('/1/status')
        .set('Authorization', auth({ id: 10, role: 'artist' }))
        .send({ status: 'invalid_status' });

      expect(res.status).toBe(400);
      expect(pool.execute).not.toHaveBeenCalled();
    });

    test('returns 404 when task does not exist', async () => {
      pool.execute.mockResolvedValueOnce([[]]);

      const res = await request(app)
        .put('/1/status')
        .set('Authorization', auth({ id: 10, role: 'artist' }))
        .send({ status: 'in_progress' });

      expect(res.status).toBe(404);
    });

    test('returns 403 when user is not owner or privileged role', async () => {
      pool.execute.mockResolvedValueOnce([[{ assigned_to: 11 }]]);

      const res = await request(app)
        .put('/1/status')
        .set('Authorization', auth({ id: 10, role: 'artist' }))
        .send({ status: 'in_progress' });

      expect(res.status).toBe(403);
    });

    test('updates to in_progress and notifies order-service', async () => {
      pool.execute.mockResolvedValueOnce([[{ assigned_to: 10 }]]);
      pool.execute.mockResolvedValueOnce([{ affectedRows: 1 }]);
      pool.execute.mockResolvedValueOnce([[{ order_id: 123 }]]);
      axios.put.mockResolvedValueOnce({});

      const res = await request(app)
        .put('/1/status')
        .set('Authorization', auth({ id: 10, role: 'artist' }))
        .send({ status: 'in_progress' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Task status updated');
      expect(axios.put).toHaveBeenCalledWith(
        'http://order-service:3002/123/status',
        { status: 'in_progress' },
        expect.objectContaining({
          headers: { 'X-Internal-Service-Token': process.env.INTERNAL_SERVICE_TOKEN }
        })
      );
    });

    test('updates to done and notifies coordinator', async () => {
      pool.execute.mockResolvedValueOnce([[{ assigned_to: 10 }]]);
      pool.execute.mockResolvedValueOnce([{ affectedRows: 1 }]);
      pool.execute.mockResolvedValueOnce([[{ order_id: 123 }]]);
      axios.post.mockResolvedValueOnce({});

      const res = await request(app)
        .put('/1/status')
        .set('Authorization', auth({ id: 2, role: 'coordinator' }))
        .send({ status: 'done', coordinatorId: 5 });

      expect(res.status).toBe(200);
      expect(axios.post).toHaveBeenCalledWith(
        'http://notification-service:3006/notify',
        expect.objectContaining({ userId: 5, eventName: 'task_completed' })
      );
    });
  });

  describe('GET /order/:orderId', () => {
    test('returns 404 when order has no task', async () => {
      pool.execute.mockResolvedValueOnce([[]]);

      const res = await request(app).get('/order/123');

      expect(res.status).toBe(404);
    });

    test('returns latest task for order', async () => {
      pool.execute.mockResolvedValueOnce([[{ id: 99, order_id: 123, status: 'assigned' }]]);

      const res = await request(app).get('/order/123');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: 99, order_id: 123, status: 'assigned' });
    });
  });

  describe('POST /order/:orderId/re-open', () => {
    test('succeeds without notification when no task exists', async () => {
      pool.execute.mockResolvedValueOnce([[]]);

      const res = await request(app).post('/order/123/re-open').send({ comment: 'fix this' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Task re-opened successfully');
      expect(axios.post).not.toHaveBeenCalled();
    });

    test('does not update when task is already revision_requested', async () => {
      pool.execute.mockResolvedValueOnce([[{
        id: 99,
        status: 'revision_requested',
        assigned_to: 10
      }]]);

      const res = await request(app).post('/order/123/re-open').send({ comment: 'fix this' });

      expect(res.status).toBe(200);
      expect(pool.execute).toHaveBeenCalledTimes(1);
      expect(axios.post).not.toHaveBeenCalled();
    });

    test('reopens task and sends notification', async () => {
      pool.execute.mockResolvedValueOnce([[{ id: 99, status: 'done', assigned_to: 10 }]]);
      pool.execute.mockResolvedValueOnce([{ affectedRows: 1 }]);
      axios.post.mockResolvedValueOnce({});

      const res = await request(app).post('/order/123/re-open').send({ comment: 'need fix' });

      expect(res.status).toBe(200);
      expect(axios.post).toHaveBeenCalledWith(
        'http://notification-service:3006/notify',
        expect.objectContaining({ userId: 10, eventName: 'task_revision_needed' })
      );
    });
  });

  describe('GET /specialist/:specialistId', () => {
    test('returns 401 without token', async () => {
      const res = await request(app).get('/specialist/10');

      expect(res.status).toBe(401);
      expect(pool.execute).not.toHaveBeenCalled();
    });

    test('returns 403 when user cannot view specialist tasks', async () => {
      const res = await request(app)
        .get('/specialist/10')
        .set('Authorization', auth({ id: 11, role: 'artist' }));

      expect(res.status).toBe(403);
      expect(pool.execute).not.toHaveBeenCalled();
    });

    test('returns empty list when specialist has no tasks', async () => {
      pool.execute.mockResolvedValueOnce([[]]);

      const res = await request(app)
        .get('/specialist/10')
        .set('Authorization', auth({ id: 10, role: 'artist' }));

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    test('enriches tasks with order description', async () => {
      pool.execute.mockResolvedValueOnce([[{ id: 1, order_id: 123, assigned_to: 10 }]]);
      axios.get.mockResolvedValueOnce({ data: { data: { description: 'Draw logo' } } });

      const res = await request(app)
        .get('/specialist/10')
        .set('Authorization', auth({ id: 1, role: 'coordinator' }));

      expect(res.status).toBe(200);
      expect(res.body[0]).toMatchObject({ id: 1, description: 'Draw logo' });
      expect(axios.get).toHaveBeenCalledWith(
        'http://order-service:3002/123',
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: expect.any(String) }) })
      );
    });

    test('uses fallback description when order-service fails', async () => {
      pool.execute.mockResolvedValueOnce([[{ id: 1, order_id: 123, assigned_to: 10 }]]);
      axios.get.mockRejectedValueOnce(new Error('network down'));

      const res = await request(app)
        .get('/specialist/10')
        .set('Authorization', auth({ id: 10, role: 'artist' }));

      expect(res.status).toBe(200);
      expect(res.body[0].description).toBe('Order description unavailable.');
    });
  });
});
