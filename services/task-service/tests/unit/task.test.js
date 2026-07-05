process.env.NODE_ENV = 'test';
process.env.DB_HOST = 'test_host';
process.env.DB_USER = 'test_user';
process.env.DB_PASSWORD = 'test_password';
process.env.DB_TASK_NAME = 'test_db';
process.env.JWT_SECRET = 'test_secret';

const request = require('supertest');

// ---- Mock mysql2/promise ----
jest.mock('mysql2/promise', () => {
  const mockPool = {
    execute: jest.fn()
  };
  return {
    createPool: jest.fn(() => mockPool),
    __mockPool: mockPool
  };
}, { virtual: true });

// ---- Mock amqplib ----
jest.mock('amqplib', () => {
  return {
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
  };
}, { virtual: true });

// ---- Mock axios ----
jest.mock('axios', () => {
  return {
    post: jest.fn(),
    put: jest.fn(),
    get: jest.fn()
  };
}, { virtual: true });

// ---- Mock shared dependencies (since they might not exist locally) ----
jest.mock('../../shared/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}), { virtual: true });

jest.mock('../../shared/middleware/errorHandler', () => ({
  asyncHandler: (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  },
  notFound: (req, res, next) => res.status(404).json({ message: 'Not Found' }),
  errorHandler: (err, req, res, next) => {
    res.status(err.statusCode || 500).json({ message: err.message });
  },
  AppError: class extends Error {
    constructor(message, statusCode) {
      super(message);
      this.statusCode = statusCode;
    }
  }
}), { virtual: true });

jest.mock('../../shared/middleware/responseHandler', () => ({
  responseHandler: (req, res, next) => { next(); }
}), { virtual: true });

jest.mock('../../shared/middleware/validation', () => ({
  createTaskValidation: (req, res, next) => { next(); },
  idParamValidation: (req, res, next) => { next(); }
}), { virtual: true });

jest.mock('../../shared/middleware/auth', () => ({
  authMiddleware: (req, res, next) => { next(); },
  checkRole: (roles) => (req, res, next) => { next(); },
  assertOwnerOrRole: (req, ownerId, roles) => { return true; }
}), { virtual: true });


const mysql = require('mysql2/promise');
const pool = mysql.__mockPool;
const axios = require('axios');

let app;

beforeAll(() => {
  app = require('../../index');
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Task Service Unit Tests', () => {

  describe('GET /health', () => {
    test('nên trả về status ok', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });

  describe('POST /', () => {
    test('nên trả về 409 nếu đơn hàng đã có task', async () => {
      pool.execute.mockResolvedValueOnce([[{ id: 1 }]]); // Mock existing task
      const res = await request(app).post('/').send({
        order_id: 123, assigned_to: 10, specialist_role: 'designer', deadline: '2023-10-10'
      });
      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/đã có task đang xử lý/i);
    });

    test('nên tạo task thành công và gọi notify', async () => {
      pool.execute.mockResolvedValueOnce([[]]); // No existing task
      pool.execute.mockResolvedValueOnce([{ insertId: 99 }]); // Insert result

      axios.post.mockResolvedValueOnce({}); // Mock notify success

      const res = await request(app).post('/').send({
        order_id: 123, assigned_to: 10, specialist_role: 'designer', deadline: '2023-10-10'
      });

      expect(res.status).toBe(201);
      expect(res.body.id).toBe(99);
      expect(res.body.message).toBe('Task created');

      expect(axios.post).toHaveBeenCalledWith(
        'http://notification-service:3006/notify',
        expect.objectContaining({ userId: 10, eventName: 'new_task' })
      );
    });
  });

  describe('PUT /:id/status', () => {
    test('nên trả về 400 nếu status không hợp lệ', async () => {
      const res = await request(app).put('/1/status').send({ status: 'invalid_status' });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/không hợp lệ/i);
    });

    test('nên trả về 404 nếu không tìm thấy task', async () => {
      pool.execute.mockResolvedValueOnce([[]]); // currentTaskRows
      const res = await request(app).put('/1/status').send({ status: 'in_progress' });
      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/Không tìm thấy task/i);
    });

    test('nên update in_progress và gọi order-service', async () => {
      pool.execute.mockResolvedValueOnce([[{ assigned_to: 10 }]]); // currentTaskRows
      pool.execute.mockResolvedValueOnce([]); // update
      pool.execute.mockResolvedValueOnce([[{ order_id: 123 }]]); // get order_id

      axios.put.mockResolvedValueOnce({}); // mock axios update order

      const res = await request(app).put('/1/status').send({ status: 'in_progress' });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Task status updated');

      expect(axios.put).toHaveBeenCalledWith(
        'http://order-service:3002/123/status',
        { status: 'in_progress' },
        expect.any(Object)
      );
    });

    test('nên update done và thông báo coordinator', async () => {
      pool.execute.mockResolvedValueOnce([[{ assigned_to: 10 }]]);
      pool.execute.mockResolvedValueOnce([]);
      pool.execute.mockResolvedValueOnce([[{ order_id: 123 }]]);

      axios.post.mockResolvedValueOnce({}); // mock notification

      const res = await request(app).put('/1/status').send({ status: 'done', coordinatorId: 5 });
      expect(res.status).toBe(200);

      expect(axios.post).toHaveBeenCalledWith(
        'http://notification-service:3006/notify',
        expect.objectContaining({ userId: 5, eventName: 'task_completed' })
      );
    });
  });

  describe('GET /order/:orderId', () => {
    test('nên trả về 404 nếu order không có task', async () => {
      pool.execute.mockResolvedValueOnce([[]]);
      const res = await request(app).get('/order/123');
      expect(res.status).toBe(404);
    });

    test('nên trả về thông tin task', async () => {
      pool.execute.mockResolvedValueOnce([[{ id: 99, order_id: 123 }]]);
      const res = await request(app).get('/order/123');
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(99);
    });
  });

  describe('POST /order/:orderId/re-open', () => {
    test('không làm gì nếu không tìm thấy task', async () => {
      pool.execute.mockResolvedValueOnce([[]]); // no task
      const res = await request(app).post('/order/123/re-open').send({ comment: 'fix this' });
      expect(res.status).toBe(200); // Route handled gracefully internally? wait, handleReOpenTask returns boolean. The route just res.json
      expect(res.body.message).toBe('Task re-opened successfully');
      expect(axios.post).not.toHaveBeenCalled();
    });

    test('đổi thành revision_requested và gửi notify', async () => {
      pool.execute.mockResolvedValueOnce([[{ id: 99, status: 'done', assigned_to: 10 }]]); // find task
      pool.execute.mockResolvedValueOnce([{ affectedRows: 1 }]); // update task

      axios.post.mockResolvedValueOnce({}); // mock notification

      const res = await request(app).post('/order/123/re-open').send({ comment: 'need fix' });
      expect(res.status).toBe(200);

      expect(axios.post).toHaveBeenCalledWith(
        'http://notification-service:3006/notify',
        expect.objectContaining({ eventName: 'task_revision_needed' })
      );
    });
  });

  describe('GET /specialist/:specialistId', () => {
    test('trả về rỗng nếu không có task', async () => {
      pool.execute.mockResolvedValueOnce([[]]);
      const res = await request(app).get('/specialist/10');
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(0);
    });

    test('lấy danh sách và gọi order-service để enrich', async () => {
      pool.execute.mockResolvedValueOnce([[{ id: 1, order_id: 123 }]]);
      axios.get.mockResolvedValueOnce({ data: { data: { description: 'Draw logo' } } });

      const res = await request(app).get('/specialist/10');
      expect(res.status).toBe(200);
      expect(res.body[0].description).toBe('Draw logo');
      expect(axios.get).toHaveBeenCalledWith('http://order-service:3002/123', expect.any(Object));
    });
  });
});
