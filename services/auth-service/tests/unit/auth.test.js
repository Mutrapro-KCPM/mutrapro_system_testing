// tests/unit/auth.test.js
process.env.JWT_SECRET = 'test_secret';
process.env.NODE_ENV = 'test';
process.env.DB_HOST = 'test_host';
process.env.DB_USER = 'test_user';
process.env.DB_PASSWORD = 'test_password';
process.env.DB_AUTH_NAME = 'test_db';

const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const request = require('supertest');

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
        del: jest.fn(),
    };
    const RedisMock = jest.fn(() => instance);
    RedisMock.__instance = instance;
    return RedisMock;
});

// ---- Mock bcrypt ----
jest.mock('bcrypt', () => ({
    genSalt: jest.fn().mockResolvedValue('test_salt'),
    hash: jest.fn().mockResolvedValue('hashed_password'),
    compare: jest.fn(),
}));

// ---- Mock logger ----
jest.mock('../../shared/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    },
}));

const mysql = require('mysql2/promise');
const pool = mysql.__mockPool;

let app;

beforeAll(() => {
    app = require('../../index');
});

beforeEach(() => {
    jest.clearAllMocks();
});

describe('Auth Service Whitebox Tests', () => {
    describe('POST /register', () => {
        test('nên trả về 409 nếu email đã tồn tại trong database', async () => {
            // Mock DB: Execute query check email trả về mảng có phần tử => email đã tồn tại
            pool.execute.mockResolvedValueOnce([[{ id: 1 }]]);

            const res = await request(app).post('/register').send({
                name: 'Test User',
                email: 'test@example.com',
                password: 'password123',
            });

            expect(res.status).toBe(409);
            expect(res.body.message).toMatch(/Email already exists/);
        });

        test('nên tạo user mới thành công và trả về mã 201', async () => {
            // Mock DB: Check email trả về rỗng (chưa tồn tại)
            pool.execute.mockResolvedValueOnce([[]]);
            // Mock DB: Insert user mới thành công
            pool.execute.mockResolvedValueOnce([{ insertId: 99 }]);

            const res = await request(app).post('/register').send({
                name: 'Test User',
                email: 'new@example.com',
                password: 'password123',
            });

            expect(res.status).toBe(201);
            expect(res.body.id).toBe(99);
            expect(res.body.message).toMatch(/Đăng ký người dùng thành công/);
            
            // Kiểm tra xem hệ thống có gọi hàm mã hoá mật khẩu hay không
            expect(bcrypt.hash).toHaveBeenCalledWith('password123', 'test_salt');
        });

        test('nên trả về 400 nếu tên bị trống (Validation)', async () => {
            const res = await request(app).post('/register').send({
                name: '', email: 'test@example.com', password: 'password123'
            });
            expect(res.status).toBe(400);
            expect(res.body.errors[0].msg).toMatch(/Tên không được để trống/);
        });

        test('nên trả về 400 nếu email sai định dạng (Validation)', async () => {
            const res = await request(app).post('/register').send({
                name: 'Test', email: 'not-an-email', password: 'password123'
            });
            expect(res.status).toBe(400);
            expect(res.body.errors[0].msg).toMatch(/Email không hợp lệ/);
        });

        test('nên trả về 400 nếu mật khẩu dưới 6 ký tự (Validation)', async () => {
            const res = await request(app).post('/register').send({
                name: 'Test', email: 'test@example.com', password: '123'
            });
            expect(res.status).toBe(400);
            expect(res.body.errors[0].msg).toMatch(/Mật khẩu phải có ít nhất 6 ký tự/);
        });
    });

    describe('POST /login', () => {
        test('nên đăng nhập thành công và trả về token', async () => {
            // Mock DB: Trả về user đúng
            pool.execute.mockResolvedValueOnce([[{
                id: 1, name: 'Test', email: 'test@example.com', password_hash: 'hashed', role: 'customer'
            }]]);
            
            // Mock bcrypt: Giả lập so sánh password hợp lệ
            bcrypt.compare.mockResolvedValueOnce(true);

            const res = await request(app).post('/login').send({
                email: 'test@example.com',
                password: 'password123',
            });

            expect(res.status).toBe(200);
            expect(res.body.message).toMatch(/Login successful/);
            expect(res.body.token).toBeDefined();
        });

        test('nên trả về 401 nếu sai mật khẩu', async () => {
            pool.execute.mockResolvedValueOnce([[{
                id: 1, name: 'Test', email: 'test@example.com', password_hash: 'hashed', role: 'customer'
            }]]);
            
            // Mock bcrypt: Mật khẩu sai
            bcrypt.compare.mockResolvedValueOnce(false);

            const res = await request(app).post('/login').send({
                email: 'test@example.com',
                password: 'wrong_password',
            });

            expect(res.status).toBe(401);
            expect(res.body.message).toMatch(/Email hoặc mật khẩu không đúng/);
        });

        test('nên trả về 401 nếu email không tồn tại trong DB', async () => {
            // Mock DB: Trả về mảng rỗng
            pool.execute.mockResolvedValueOnce([[]]);
            
            const res = await request(app).post('/login').send({
                email: 'not-exist@example.com',
                password: 'password123',
            });

            expect(res.status).toBe(401);
            expect(res.body.message).toMatch(/Email hoặc mật khẩu không đúng/);
        });

        test('nên trả về 400 nếu email sai định dạng (Validation)', async () => {
            const res = await request(app).post('/login').send({
                email: 'invalid', password: 'password123'
            });
            expect(res.status).toBe(400);
            expect(res.body.errors[0].msg).toMatch(/Email không hợp lệ/);
        });

        test('nên trả về 400 nếu mật khẩu bị trống (Validation)', async () => {
            const res = await request(app).post('/login').send({
                email: 'test@example.com', password: ''
            });
            expect(res.status).toBe(400);
            expect(res.body.errors[0].msg).toMatch(/Mật khẩu không được để trống/);
        });
    });

    // Helper tạo JWT để gọi các API yêu cầu xác thực
    const token = (payload) => jwt.sign(payload, process.env.JWT_SECRET);
    const authHeader = (payload) => `Bearer ${token(payload)}`;

    describe('GET /health', () => {
        test('trả về trạng thái ok', async () => {
            const res = await request(app).get('/health');
            expect(res.status).toBe(200);
            expect(res.body.service).toBe('auth-service');
        });
    });

    describe('GET /verify', () => {
        test('trả về 200 và thông tin user nếu token hợp lệ', async () => {
            const payload = { id: 1, name: 'A', email: 'a@a.com', role: 'customer' };
            const res = await request(app)
                .get('/verify')
                .set('Authorization', authHeader(payload));
            
            expect(res.status).toBe(200);
            // jwt.verify return thêm iat, nên dùng toMatchObject thay vì toEqual
            expect(res.body.user).toMatchObject(payload);
        });
    });

    describe('GET /users/specialists', () => {
        test('trả về danh sách specialist cho coordinator', async () => {
            pool.execute.mockResolvedValueOnce([[{ id: 2, name: 'S1' }]]);
            const res = await request(app)
                .get('/users/specialists?role=artist')
                .set('Authorization', authHeader({ id: 1, role: 'coordinator' }));
            
            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(1);
        });
        
        test('báo lỗi nếu role không hợp lệ', async () => {
            const res = await request(app)
                .get('/users/specialists?role=admin')
                .set('Authorization', authHeader({ id: 1, role: 'coordinator' }));
            expect(res.status).toBe(400);
        });
    });

    describe('PUT /users/:id', () => {
        test('cập nhật tên thành công', async () => {
            pool.execute.mockResolvedValueOnce([{ affectedRows: 1 }]);
            const redis = require('ioredis').__instance;
            
            const res = await request(app)
                .put('/users/1')
                .set('Authorization', authHeader({ id: 1, email: 'a@a.com', role: 'customer' }))
                .send({ name: 'New Name' });
                
            expect(res.status).toBe(200);
            expect(redis.del).toHaveBeenCalledWith('user:1:name');
        });
        
        test('báo lỗi 403 nếu cố sửa tên user khác', async () => {
            const res = await request(app)
                .put('/users/2')
                .set('Authorization', authHeader({ id: 1, role: 'customer' }))
                .send({ name: 'New Name' });
            expect(res.status).toBe(403);
        });

        test('báo lỗi 400 nếu tên bị trống (không có name)', async () => {
            const res = await request(app)
                .put('/users/1')
                .set('Authorization', authHeader({ id: 1, role: 'customer' }))
                .send({ name: '   ' });
            expect(res.status).toBe(400);
            expect(res.body.message).toMatch(/Name is required/);
        });

        test('báo lỗi 400 nếu tên quá 100 ký tự', async () => {
            const res = await request(app)
                .put('/users/1')
                .set('Authorization', authHeader({ id: 1, role: 'customer' }))
                .send({ name: 'a'.repeat(101) });
            expect(res.status).toBe(400);
            expect(res.body.message).toMatch(/Name must be at most 100 characters/);
        });

        test('báo lỗi 404 nếu user không tồn tại trong DB', async () => {
            pool.execute.mockResolvedValueOnce([{ affectedRows: 0 }]);
            const res = await request(app)
                .put('/users/1')
                .set('Authorization', authHeader({ id: 1, role: 'customer' }))
                .send({ name: 'New Name' });
            expect(res.status).toBe(404);
            expect(res.body.message).toMatch(/User not found/);
        });
    });

    describe('PUT /users/:id/password', () => {
        test('đổi pass thành công', async () => {
            pool.execute.mockResolvedValueOnce([[{ password_hash: 'oldhash' }]]); // SELECT
            bcrypt.compare.mockResolvedValueOnce(true); // check old pass
            bcrypt.hash.mockResolvedValueOnce('newhash');
            pool.execute.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE
            
            const res = await request(app)
                .put('/users/1/password')
                .set('Authorization', authHeader({ id: 1, role: 'customer' }))
                .send({ oldPassword: 'oldpass123', newPassword: 'newpass123' });
            expect(res.status).toBe(200);
        });

        test('báo lỗi 400 nếu thiếu mật khẩu hoặc mật khẩu mới quá ngắn', async () => {
            const res = await request(app)
                .put('/users/1/password')
                .set('Authorization', authHeader({ id: 1, role: 'customer' }))
                .send({ oldPassword: 'oldpass123', newPassword: '123' });
            expect(res.status).toBe(400);
        });

        test('báo lỗi 404 nếu không tìm thấy người dùng', async () => {
            pool.execute.mockResolvedValueOnce([[]]);
            const res = await request(app)
                .put('/users/1/password')
                .set('Authorization', authHeader({ id: 1, role: 'customer' }))
                .send({ oldPassword: 'oldpass123', newPassword: 'newpass123' });
            expect(res.status).toBe(404);
        });
    });

    describe('GET /users/:id', () => {
        test('lấy thông tin cơ bản của user', async () => {
            pool.execute.mockResolvedValueOnce([[{ id: 1, name: 'A' }]]);
            const res = await request(app).get('/users/1');
            expect(res.status).toBe(200);
            expect(res.body.name).toBe('A');
        });

        test('báo lỗi 404 nếu không tìm thấy user', async () => {
            pool.execute.mockResolvedValueOnce([[]]);
            const res = await request(app).get('/users/1');
            expect(res.status).toBe(404);
        });
    });

    describe('GET /users/by-role/:role', () => {
        test('lấy ids theo role', async () => {
            pool.execute.mockResolvedValueOnce([[{ id: 1 }, { id: 2 }]]);
            const res = await request(app).get('/users/by-role/customer');
            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(2);
        });
    });

    describe('Admin CRUD users', () => {
        test('GET /admin/users', async () => {
            pool.execute.mockResolvedValueOnce([[{ id: 1, email: 'a@a.com' }]]);
            const res = await request(app)
                .get('/admin/users')
                .set('Authorization', authHeader({ id: 99, role: 'admin' }));
            expect(res.status).toBe(200);
        });

        test('POST /admin/users (Tạo user)', async () => {
            pool.execute.mockResolvedValueOnce([{ insertId: 2 }]);
            bcrypt.hash.mockResolvedValueOnce('hashed');
            
            const res = await request(app)
                .post('/admin/users')
                .set('Authorization', authHeader({ id: 99, role: 'admin' }))
                .send({ name: 'B', email: 'b@b.com', password: 'password123', role: 'customer' });
            expect(res.status).toBe(201);
        });

        test('PUT /admin/users/:id (Cập nhật user)', async () => {
            pool.execute.mockResolvedValueOnce([{ affectedRows: 1 }]);
            const redis = require('ioredis').__instance;
            
            const res = await request(app)
                .put('/admin/users/2')
                .set('Authorization', authHeader({ id: 99, role: 'admin' }))
                .send({ name: 'B2', email: 'b@b.com', role: 'customer' });
            expect(res.status).toBe(200);
            expect(redis.del).toHaveBeenCalledWith('user:2:name');
        });

        test('PUT /admin/users/:id báo lỗi 400 nếu admin tự sửa role của chính mình', async () => {
            const res = await request(app)
                .put('/admin/users/99')
                .set('Authorization', authHeader({ id: 99, role: 'admin' }))
                .send({ name: 'B2', email: 'b@b.com', role: 'customer' });
            expect(res.status).toBe(400);
        });

        test('PUT /admin/users/:id báo lỗi 404 nếu không tìm thấy user', async () => {
            pool.execute.mockResolvedValueOnce([{ affectedRows: 0 }]);
            const res = await request(app)
                .put('/admin/users/2')
                .set('Authorization', authHeader({ id: 99, role: 'admin' }))
                .send({ name: 'B2', email: 'b@b.com', role: 'customer' });
            expect(res.status).toBe(404);
        });

        test('DELETE /admin/users/:id (Xóa user)', async () => {
            pool.execute.mockResolvedValueOnce([{ affectedRows: 1 }]);
            const res = await request(app)
                .delete('/admin/users/2')
                .set('Authorization', authHeader({ id: 99, role: 'admin' }));
            expect(res.status).toBe(200);
        });

        test('DELETE /admin/users/:id báo lỗi 400 nếu admin tự xóa mình', async () => {
            const res = await request(app)
                .delete('/admin/users/99')
                .set('Authorization', authHeader({ id: 99, role: 'admin' }));
            expect(res.status).toBe(400);
        });

        test('DELETE /admin/users/:id báo lỗi 404 nếu không tìm thấy user', async () => {
            pool.execute.mockResolvedValueOnce([{ affectedRows: 0 }]);
            const res = await request(app)
                .delete('/admin/users/2')
                .set('Authorization', authHeader({ id: 99, role: 'admin' }));
            expect(res.status).toBe(404);
        });
    });
});
