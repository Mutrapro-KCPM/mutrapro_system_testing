// tests/unit/orders.test.js
// Test cho nhóm "order": POST /, GET /, GET /stats, GET /customer/:customerId, GET /:id, PUT /:id/status

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
    const makePipeline = () => {
        const pipeline = {
            set: jest.fn(() => pipeline),
            get: jest.fn(() => pipeline),
            exec: jest.fn().mockResolvedValue([]),
        };
        return pipeline;
    };
    const instance = {
        on: jest.fn(),
        get: jest.fn(),
        set: jest.fn(),
        pipeline: jest.fn(() => makePipeline()),
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
const TRANSCRIBER = { id: 30, role: 'transcriber' };

// ============================================================
// POST / (Tạo đơn hàng)
// ============================================================
describe('POST / (tạo đơn hàng)', () => {
    test('trả về 401 nếu không có token', async () => {
        const res = await request(app).post('/').send({ service_type: 'transcription', description: 'abc' });
        expect(res.status).toBe(401);
    });

    test('trả về 401 nếu token sai định dạng', async () => {
        const res = await request(app)
            .post('/')
            .set('Authorization', 'InvalidTokenFormat')
            .send({ service_type: 'transcription', description: 'abc' });
        expect(res.status).toBe(401);
    });

    test('trả về 403 nếu role không phải customer', async () => {
        const res = await request(app)
            .post('/')
            .set('Authorization', authHeader(COORDINATOR))
            .send({ service_type: 'transcription', description: 'abc' });
        expect(res.status).toBe(403);
    });

    test('trả về 400 nếu service_type không hợp lệ (giá trị không tồn tại)', async () => {
        const res = await request(app)
            .post('/')
            .set('Authorization', authHeader(CUSTOMER))
            .send({ service_type: 'unknown_type', description: 'abc' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/Loại dịch vụ không hợp lệ/);
    });

    test('trả về 400 nếu service_type là mảng (sai kiểu dữ liệu)', async () => {
        const res = await request(app)
            .post('/')
            .set('Authorization', authHeader(CUSTOMER))
            .send({ service_type: ['transcription'], description: 'abc' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/Loại dịch vụ không hợp lệ/);
    });

    test('trả về 400 nếu service_type rỗng', async () => {
        const res = await request(app)
            .post('/')
            .set('Authorization', authHeader(CUSTOMER))
            .send({ service_type: '', description: 'Mô tả hợp lệ' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/Loại dịch vụ không hợp lệ/);
    });

    test('trả về 400 nếu description rỗng', async () => {
        const res = await request(app)
            .post('/')
            .set('Authorization', authHeader(CUSTOMER))
            .send({ service_type: 'transcription', description: '   ' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/Mô tả không được để trống/);
    });

    test('trả về 400 nếu description vượt quá 2000 ký tự', async () => {
        const res = await request(app)
            .post('/')
            .set('Authorization', authHeader(CUSTOMER))
            .send({ service_type: 'transcription', description: 'a'.repeat(2001) });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/vượt quá 2000/);
    });

    test('trả về 400 nếu description không phải string (số)', async () => {
        const res = await request(app)
            .post('/')
            .set('Authorization', authHeader(CUSTOMER))
            .send({ service_type: 'transcription', description: 12345 });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/Mô tả không được để trống/);
    });

    test('tạo đơn hàng transcription thành công với giá 300000', async () => {
        pool.execute.mockResolvedValueOnce([{ insertId: 99 }]);
        axios.get.mockResolvedValueOnce({ data: [{ id: 10 }] });
        axios.post.mockResolvedValue({});

        const res = await request(app)
            .post('/')
            .set('Authorization', authHeader(CUSTOMER))
            .send({ service_type: 'transcription', description: 'Cần chép nhạc bài hát' });

        expect(res.status).toBe(201);
        expect(res.body).toEqual({ id: 99, message: 'Order created' });
        expect(pool.execute).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO orders'),
            [CUSTOMER.id, 'transcription', 'Cần chép nhạc bài hát', 300000]
        );
    });

    test('tạo đơn hàng arrangement thành công với giá 800000', async () => {
        pool.execute.mockResolvedValueOnce([{ insertId: 100 }]);
        axios.get.mockResolvedValueOnce({ data: [] });

        const res = await request(app)
            .post('/')
            .set('Authorization', authHeader(CUSTOMER))
            .send({ service_type: 'arrangement', description: 'Phối khí bài hát' });

        expect(res.status).toBe(201);
        expect(res.body.id).toBe(100);
        expect(pool.execute).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO orders'),
            [CUSTOMER.id, 'arrangement', 'Phối khí bài hát', 800000]
        );
    });

    test('tạo đơn hàng recording thành công với giá 500000', async () => {
        pool.execute.mockResolvedValueOnce([{ insertId: 101 }]);
        axios.get.mockResolvedValueOnce({ data: [{ id: 10 }, { id: 11 }] });
        axios.post.mockResolvedValue({});

        const res = await request(app)
            .post('/')
            .set('Authorization', authHeader(CUSTOMER))
            .send({ service_type: 'recording', description: 'Cần thu âm bài hát' });

        expect(res.status).toBe(201);
        expect(res.body.id).toBe(101);
        expect(pool.execute).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO orders'),
            [CUSTOMER.id, 'recording', 'Cần thu âm bài hát', 500000]
        );
    });

    test('vẫn trả về 201 dù bước gửi notification cho coordinator bị lỗi', async () => {
        pool.execute.mockResolvedValueOnce([{ insertId: 102 }]);
        axios.get.mockRejectedValueOnce(new Error('auth-service down'));

        const res = await request(app)
            .post('/')
            .set('Authorization', authHeader(CUSTOMER))
            .send({ service_type: 'arrangement', description: 'Phối khí bài hát' });

        expect(res.status).toBe(201);
        expect(res.body.id).toBe(102);
    });

    test('tạo đơn hàng với description 2000 ký tự (biên trên hợp lệ)', async () => {
        pool.execute.mockResolvedValueOnce([{ insertId: 103 }]);
        axios.get.mockResolvedValueOnce({ data: [] });

        const res = await request(app)
            .post('/')
            .set('Authorization', authHeader(CUSTOMER))
            .send({ service_type: 'transcription', description: 'a'.repeat(2000) });

        expect(res.status).toBe(201);
        expect(res.body.id).toBe(103);
    });
});

// ============================================================
// GET / (Lấy tất cả đơn hàng - chỉ coordinator/admin)
// ============================================================
describe('GET / (lấy tất cả đơn hàng)', () => {
    test('trả về 403 nếu role là customer', async () => {
        const res = await request(app).get('/').set('Authorization', authHeader(CUSTOMER));
        expect(res.status).toBe(403);
    });

    test('trả về 403 nếu role là transcriber', async () => {
        const res = await request(app).get('/').set('Authorization', authHeader(TRANSCRIBER));
        expect(res.status).toBe(403);
    });

    test('trả về danh sách rỗng khi chưa có đơn hàng nào', async () => {
        pool.execute
            .mockResolvedValueOnce([[]]) // SELECT orders
            .mockResolvedValueOnce([[]]); // SELECT feedback

        const res = await request(app).get('/').set('Authorization', authHeader(COORDINATOR));
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    test('làm giàu dữ liệu đơn hàng với task, specialist name và feedback', async () => {
        const order = { id: 1, customer_id: 1, service_type: 'recording', status: 'in_progress' };
        pool.execute
            .mockResolvedValueOnce([[order]]) // SELECT orders
            .mockResolvedValueOnce([[{ order_id: 1, rating: 5, comment: 'Tốt' }]]); // SELECT feedback

        axios.get.mockResolvedValueOnce({ data: { assigned_to: 55 } }); // task-service cho order 1

        redis.pipeline.mockReturnValueOnce({
            exec: jest.fn().mockResolvedValue([[null, null]]), // cache miss cho specialist 55
        });

        axios.get.mockResolvedValueOnce({ data: { name: 'Nguyễn Văn A' } }); // auth-service specialist 55

        const cacheWritePipeline = { set: jest.fn(), exec: jest.fn().mockResolvedValue([]) };
        redis.pipeline.mockReturnValueOnce(cacheWritePipeline);

        const res = await request(app).get('/').set('Authorization', authHeader(ADMIN));

        expect(res.status).toBe(200);
        expect(res.body).toEqual([
            {
                ...order,
                assignedSpecialist: 'Nguyễn Văn A',
                feedback: { rating: 5, comment: 'Tốt' },
            },
        ]);
        expect(cacheWritePipeline.set).toHaveBeenCalledWith('user:55:name', 'Nguyễn Văn A', 'EX', 3600);
    });

    test('trả về đơn hàng với assignedSpecialist=null khi không có task', async () => {
        const order = { id: 2, customer_id: 1, service_type: 'transcription', status: 'pending' };
        pool.execute
            .mockResolvedValueOnce([[order]])
            .mockResolvedValueOnce([[]]); // không có feedback

        // task-service trả về 404
        axios.get.mockRejectedValueOnce({ response: { status: 404 } });

        const res = await request(app).get('/').set('Authorization', authHeader(COORDINATOR));

        expect(res.status).toBe(200);
        expect(res.body[0].assignedSpecialist).toBeNull();
        expect(res.body[0].feedback).toBeNull();
    });

    test('trả về specialist name từ cache (HIT) khi đã có sẵn', async () => {
        const order = { id: 3, customer_id: 1, service_type: 'arrangement', status: 'in_progress' };
        pool.execute
            .mockResolvedValueOnce([[order]])
            .mockResolvedValueOnce([[]]); // feedback

        axios.get.mockResolvedValueOnce({ data: { assigned_to: 77 } }); // task-service

        // Redis pipeline trả về cache HIT
        redis.pipeline.mockReturnValueOnce({
            exec: jest.fn().mockResolvedValue([[null, 'Trần Thị C']]),
        });

        const res = await request(app).get('/').set('Authorization', authHeader(ADMIN));

        expect(res.status).toBe(200);
        expect(res.body[0].assignedSpecialist).toBe('Trần Thị C');
    });
});

// ============================================================
// GET /stats (Lấy thống kê - admin/coordinator)
// ============================================================
describe('GET /stats (lấy thống kê)', () => {
    test('trả về 401 nếu không có token', async () => {
        const res = await request(app).get('/stats');
        expect(res.status).toBe(401);
    });

    test('trả về 403 nếu role là customer', async () => {
        const res = await request(app).get('/stats').set('Authorization', authHeader(CUSTOMER));
        expect(res.status).toBe(403);
    });

    test('coordinator xem thống kê thành công', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ totalRevenue: 1500000 }]])  // SUM revenue
            .mockResolvedValueOnce([[{ status: 'pending', count: 3 }, { status: 'paid', count: 2 }]])  // status counts
            .mockResolvedValueOnce([[{ totalOrders: 5 }]]);  // total orders

        const res = await request(app).get('/stats').set('Authorization', authHeader(COORDINATOR));

        expect(res.status).toBe(200);
        expect(res.body.totalRevenue).toBe(1500000);
        expect(res.body.totalOrders).toBe(5);
        expect(res.body.orderStats).toHaveLength(2);
    });

    test('trả về totalRevenue = 0 khi chưa có thanh toán', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ totalRevenue: null }]])
            .mockResolvedValueOnce([[]])
            .mockResolvedValueOnce([[{ totalOrders: 0 }]]);

        const res = await request(app).get('/stats').set('Authorization', authHeader(ADMIN));

        expect(res.status).toBe(200);
        expect(res.body.totalRevenue).toBe(0);
        expect(res.body.totalOrders).toBe(0);
        expect(res.body.orderStats).toEqual([]);
    });
});

// ============================================================
// GET /customer/:customerId (Lấy đơn hàng theo khách hàng)
// ============================================================
describe('GET /customer/:customerId (lấy đơn hàng theo khách)', () => {
    test('trả về 401 nếu không có token', async () => {
        const res = await request(app).get('/customer/1');
        expect(res.status).toBe(401);
    });

    test('trả về 403 nếu customer khác cố xem đơn của người khác', async () => {
        const res = await request(app)
            .get('/customer/1')
            .set('Authorization', authHeader(OTHER_CUSTOMER));
        expect(res.status).toBe(403);
    });

    test('chủ đơn hàng xem danh sách đơn hàng của mình thành công', async () => {
        pool.execute.mockResolvedValueOnce([[
            { id: 1, customer_id: 1, service_type: 'transcription', status: 'pending' },
            { id: 2, customer_id: 1, service_type: 'arrangement', status: 'paid' },
        ]]);

        const res = await request(app)
            .get('/customer/1')
            .set('Authorization', authHeader(CUSTOMER));

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(2);
    });

    test('admin xem đơn hàng của bất kỳ khách hàng nào', async () => {
        pool.execute.mockResolvedValueOnce([[
            { id: 5, customer_id: 1, service_type: 'recording', status: 'pending' },
        ]]);

        const res = await request(app)
            .get('/customer/1')
            .set('Authorization', authHeader(ADMIN));

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
    });

    test('bổ sung studioInfo cho đơn recording đã không còn pending', async () => {
        pool.execute.mockResolvedValueOnce([[
            { id: 10, customer_id: 1, service_type: 'recording', status: 'in_progress' },
        ]]);
        axios.get.mockResolvedValueOnce({ data: { studio: 'Studio A', date: '2026-07-01' } });

        const res = await request(app)
            .get('/customer/1')
            .set('Authorization', authHeader(CUSTOMER));

        expect(res.status).toBe(200);
        expect(res.body[0].studioInfo).toEqual({ studio: 'Studio A', date: '2026-07-01' });
    });

    test('không bổ sung studioInfo cho đơn recording còn pending', async () => {
        pool.execute.mockResolvedValueOnce([[
            { id: 11, customer_id: 1, service_type: 'recording', status: 'pending' },
        ]]);

        const res = await request(app)
            .get('/customer/1')
            .set('Authorization', authHeader(CUSTOMER));

        expect(res.status).toBe(200);
        expect(res.body[0].studioInfo).toBeUndefined();
    });

    test('vẫn trả về đơn hàng dù studio-service bị lỗi', async () => {
        pool.execute.mockResolvedValueOnce([[
            { id: 12, customer_id: 1, service_type: 'recording', status: 'completed' },
        ]]);
        axios.get.mockRejectedValueOnce(new Error('studio-service down'));

        const res = await request(app)
            .get('/customer/1')
            .set('Authorization', authHeader(CUSTOMER));

        expect(res.status).toBe(200);
        expect(res.body[0].studioInfo).toBeUndefined();
        expect(res.body[0].id).toBe(12);
    });

    test('trả về danh sách rỗng khi khách chưa có đơn hàng', async () => {
        pool.execute.mockResolvedValueOnce([[]]);

        const res = await request(app)
            .get('/customer/1')
            .set('Authorization', authHeader(CUSTOMER));

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });
});

// ============================================================
// GET /:id (Chi tiết đơn hàng)
// ============================================================
describe('GET /:id (chi tiết đơn hàng)', () => {
    test('trả về 400 nếu id không phải số nguyên', async () => {
        const res = await request(app).get('/abc').set('Authorization', authHeader(CUSTOMER));
        expect(res.status).toBe(400);
    });

    test('trả về 400 nếu id là số âm', async () => {
        const res = await request(app).get('/-1').set('Authorization', authHeader(CUSTOMER));
        expect(res.status).toBe(400);
    });

    test('trả về 400 nếu id là 0', async () => {
        const res = await request(app).get('/0').set('Authorization', authHeader(CUSTOMER));
        expect(res.status).toBe(400);
    });

    test('trả về 404 nếu không tìm thấy đơn hàng', async () => {
        pool.execute.mockResolvedValueOnce([[]]);
        const res = await request(app).get('/1').set('Authorization', authHeader(CUSTOMER));
        expect(res.status).toBe(404);
    });

    test('trả về 403 nếu customer khác cố xem đơn hàng không phải của mình', async () => {
        pool.execute.mockResolvedValueOnce([[{ id: 1, customer_id: CUSTOMER.id }]]);
        const res = await request(app).get('/1').set('Authorization', authHeader(OTHER_CUSTOMER));
        expect(res.status).toBe(403);
    });

    test('chủ đơn hàng xem thành công, lấy tên khách từ cache (HIT)', async () => {
        pool.execute.mockResolvedValueOnce([[{ id: 1, customer_id: CUSTOMER.id, status: 'pending' }]]);
        redis.get.mockResolvedValueOnce('Trần Thị B');

        const res = await request(app).get('/1').set('Authorization', authHeader(CUSTOMER));

        expect(res.status).toBe(200);
        expect(res.body.customer_name).toBe('Trần Thị B');
        expect(axios.get).not.toHaveBeenCalled();
    });

    test('admin xem thành công, cache MISS thì gọi auth-service và ghi lại cache', async () => {
        pool.execute.mockResolvedValueOnce([[{ id: 1, customer_id: CUSTOMER.id, status: 'pending' }]]);
        redis.get.mockResolvedValueOnce(null);
        axios.get.mockResolvedValueOnce({ data: { name: 'Khách Hàng A' } });

        const res = await request(app).get('/1').set('Authorization', authHeader(ADMIN));

        expect(res.status).toBe(200);
        expect(res.body.customer_name).toBe('Khách Hàng A');
        expect(redis.set).toHaveBeenCalledWith('user:1:name', 'Khách Hàng A', 'EX', 3600);
    });

    test('coordinator xem đơn hàng thành công', async () => {
        pool.execute.mockResolvedValueOnce([[{ id: 5, customer_id: CUSTOMER.id, status: 'assigned' }]]);
        redis.get.mockResolvedValueOnce('Lê Văn C');

        const res = await request(app).get('/5').set('Authorization', authHeader(COORDINATOR));

        expect(res.status).toBe(200);
        expect(res.body.customer_name).toBe('Lê Văn C');
    });

    test('trả về customer_name = "Không rõ" khi auth-service lỗi', async () => {
        pool.execute.mockResolvedValueOnce([[{ id: 1, customer_id: CUSTOMER.id, status: 'pending' }]]);
        redis.get.mockResolvedValueOnce(null);
        axios.get.mockRejectedValueOnce(new Error('auth-service down'));

        const res = await request(app).get('/1').set('Authorization', authHeader(CUSTOMER));

        expect(res.status).toBe(200);
        expect(res.body.customer_name).toBe('Không rõ');
    });
});

// ============================================================
// PUT /:id/status (Cập nhật trạng thái đơn hàng)
// ============================================================
describe('PUT /:id/status (cập nhật trạng thái đơn hàng)', () => {
    test('trả về 401 nếu không có token', async () => {
        const res = await request(app).put('/1/status').send({ status: 'assigned' });
        expect(res.status).toBe(401);
    });

    test('trả về 400 nếu status không hợp lệ', async () => {
        const res = await request(app)
            .put('/1/status')
            .set('Authorization', authHeader(COORDINATOR))
            .send({ status: 'khong_ton_tai' });
        expect(res.status).toBe(400);
    });

    test('trả về 400 nếu id không phải số nguyên', async () => {
        const res = await request(app)
            .put('/abc/status')
            .set('Authorization', authHeader(COORDINATOR))
            .send({ status: 'assigned' });
        expect(res.status).toBe(400);
    });

    test('trả về 403 nếu role là customer', async () => {
        const res = await request(app)
            .put('/1/status')
            .set('Authorization', authHeader(CUSTOMER))
            .send({ status: 'assigned' });
        expect(res.status).toBe(403);
    });

    test('trả về 404 nếu không tìm thấy đơn hàng', async () => {
        pool.execute.mockResolvedValueOnce([[]]);
        const res = await request(app)
            .put('/1/status')
            .set('Authorization', authHeader(COORDINATOR))
            .send({ status: 'assigned' });
        expect(res.status).toBe(404);
    });

    test('không cho phép cập nhật thành trạng thái paid qua API này', async () => {
        pool.execute.mockResolvedValueOnce([[{ customer_id: 1, status: 'completed' }]]);
        const res = await request(app)
            .put('/1/status')
            .set('Authorization', authHeader(COORDINATOR))
            .send({ status: 'paid' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/paid/);
    });

    test('không cho phép cập nhật đơn hàng đã bị hủy', async () => {
        pool.execute.mockResolvedValueOnce([[{ customer_id: 1, status: 'cancelled' }]]);
        const res = await request(app)
            .put('/1/status')
            .set('Authorization', authHeader(COORDINATOR))
            .send({ status: 'assigned' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/đã hủy/);
    });

    test('từ chối chuyển trạng thái không hợp lệ (pending -> completed)', async () => {
        pool.execute.mockResolvedValueOnce([[{ customer_id: 1, status: 'pending' }]]);
        const res = await request(app)
            .put('/1/status')
            .set('Authorization', authHeader(COORDINATOR))
            .send({ status: 'completed' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/Không thể chuyển trạng thái/);
    });

    test('từ chối chuyển trạng thái không hợp lệ (assigned -> completed)', async () => {
        pool.execute.mockResolvedValueOnce([[{ customer_id: 1, status: 'assigned' }]]);
        const res = await request(app)
            .put('/1/status')
            .set('Authorization', authHeader(COORDINATOR))
            .send({ status: 'completed' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/Không thể chuyển trạng thái/);
    });

    test('cập nhật trạng thái thành công (pending -> assigned) và gửi thông báo', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ customer_id: 1, status: 'pending' }]]) // SELECT
            .mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE
        axios.post.mockResolvedValue({});

        const res = await request(app)
            .put('/1/status')
            .set('Authorization', authHeader(COORDINATOR))
            .send({ status: 'assigned' });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Order status updated successfully');
        expect(pool.execute).toHaveBeenCalledWith('UPDATE orders SET status = ? WHERE id = ?', ['assigned', '1']);
    });

    test('chuyển trạng thái thành công (assigned -> in_progress)', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ customer_id: 1, status: 'assigned' }]])
            .mockResolvedValueOnce([{ affectedRows: 1 }]);
        axios.post.mockResolvedValue({});

        const res = await request(app)
            .put('/1/status')
            .set('Authorization', authHeader(COORDINATOR))
            .send({ status: 'in_progress' });

        expect(res.status).toBe(200);
    });

    test('chuyển trạng thái thành công (in_progress -> completed)', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ customer_id: 1, status: 'in_progress' }]])
            .mockResolvedValueOnce([{ affectedRows: 1 }]);
        axios.post.mockResolvedValue({});

        const res = await request(app)
            .put('/1/status')
            .set('Authorization', authHeader(TRANSCRIBER))
            .send({ status: 'completed' });

        expect(res.status).toBe(200);
    });

    test('chuyển trạng thái thành công (pending -> cancelled)', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ customer_id: 1, status: 'pending' }]])
            .mockResolvedValueOnce([{ affectedRows: 1 }]);
        axios.post.mockResolvedValue({});

        const res = await request(app)
            .put('/1/status')
            .set('Authorization', authHeader(COORDINATOR))
            .send({ status: 'cancelled' });

        expect(res.status).toBe(200);
    });

    test('giữ nguyên trạng thái (cùng trạng thái) không bị lỗi', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ customer_id: 1, status: 'in_progress' }]])
            .mockResolvedValueOnce([{ affectedRows: 1 }]);
        axios.post.mockResolvedValue({});

        const res = await request(app)
            .put('/1/status')
            .set('Authorization', authHeader(COORDINATOR))
            .send({ status: 'in_progress' });

        expect(res.status).toBe(200);
    });
});
