// tests/unit/notification.test.js
process.env.NODE_ENV = 'test';
process.env.DB_HOST = 'test_host';
process.env.DB_USER = 'test_user';
process.env.DB_PASSWORD = 'test_password';
process.env.DB_NOTIFICATION_NAME = 'test_db';
process.env.JWT_SECRET = 'test_secret';

const request = require('supertest');
const mysql = require('mysql2/promise');
const admin = require('firebase-admin');
const jwt = require('jsonwebtoken');

// ---- Mock mysql2/promise ----
jest.mock('mysql2/promise', () => {
    const mPool = {
        execute: jest.fn(),
        getConnection: jest.fn(),
    };
    return {
        createPool: jest.fn(() => mPool),
    };
});

// ---- Mock ioredis (cho authMiddleware) ----
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

// ---- Mock Firebase Admin ----
jest.mock('firebase-admin', () => {
    const messaging = {
        sendEachForMulticast: jest.fn(),
    };
    return {
        credential: { cert: jest.fn() },
        initializeApp: jest.fn(),
        messaging: jest.fn(() => messaging),
    };
});

// ---- Mock Logger ----
jest.mock('../../shared/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    }
}));

const { app, sendPushNotification, addUser, removeUser, onlineUsers } = require('../../index');
const pool = mysql.createPool();

describe('Notification Service Whitebox Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Clear online users
        for (const key in onlineUsers) {
            delete onlineUsers[key];
        }
    });

    const token = (payload) => jwt.sign(payload, process.env.JWT_SECRET);
    const authHeader = (payload) => `Bearer ${token(payload)}`;

    describe('GET /health', () => {
        test('trả về 200 ok', async () => {
            const res = await request(app).get('/health');
            expect(res.status).toBe(200);
            expect(res.body.service).toBe('notification-service');
        });
    });

    describe('POST /send', () => {
        test('trả về 201 khi tạo thông báo thành công', async () => {
            pool.execute.mockResolvedValueOnce([{ insertId: 1 }]);
            
            const res = await request(app).post('/send').send({
                user_id: 1,
                title: 'Test',
                message: 'Hello'
            });
            
            expect(res.status).toBe(201);
            expect(res.body.id).toBe(1);
        });

        test('trả về 400 nếu user_id không hợp lệ', async () => {
            const res = await request(app).post('/send').send({
                user_id: 'abc', // Not a number
                title: 'Test',
                message: 'Hello'
            });
            expect(res.status).toBe(400);
        });

        test('trả về 500 nếu DB lỗi', async () => {
            pool.execute.mockRejectedValueOnce(new Error('DB Error'));
            
            const res = await request(app).post('/send').send({
                user_id: 1,
                title: 'Test',
                message: 'Hello'
            });
            expect(res.status).toBe(500);
        });
    });

    describe('GET /', () => {
        test('trả về danh sách thông báo', async () => {
            pool.execute.mockResolvedValueOnce([[{ total: 1 }]]); // COUNT
            pool.execute.mockResolvedValueOnce([[{ id: 1, title: 'Test' }]]); // SELECT
            
            const res = await request(app)
                .get('/')
                .set('Authorization', authHeader({ id: 1, role: 'customer' }));
                
            expect(res.status).toBe(200);
            expect(res.body.data.items).toHaveLength(1);
        });

        test('trả về 500 nếu DB lỗi', async () => {
            pool.execute.mockRejectedValueOnce(new Error('DB Error'));
            
            const res = await request(app)
                .get('/')
                .set('Authorization', authHeader({ id: 1, role: 'customer' }));
                
            expect(res.status).toBe(500);
        });
    });

    describe('PATCH /:id/read', () => {
        test('cập nhật thành công', async () => {
            pool.execute.mockResolvedValueOnce([[{ id: 1, user_id: 1 }]]); // SELECT
            pool.execute.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE
            
            const res = await request(app)
                .patch('/1/read')
                .set('Authorization', authHeader({ id: 1, role: 'customer' }));
                
            expect(res.status).toBe(200);
        });

        test('báo lỗi 404 nếu không tìm thấy', async () => {
            pool.execute.mockResolvedValueOnce([[]]);
            
            const res = await request(app)
                .patch('/1/read')
                .set('Authorization', authHeader({ id: 1, role: 'customer' }));
                
            expect(res.status).toBe(404);
        });

        test('báo lỗi 403 nếu người khác cập nhật', async () => {
            pool.execute.mockResolvedValueOnce([[{ id: 1, user_id: 2 }]]);
            
            const res = await request(app)
                .patch('/1/read')
                .set('Authorization', authHeader({ id: 1, role: 'customer' }));
                
            expect(res.status).toBe(403);
        });

        test('cho phép admin cập nhật của người khác', async () => {
            pool.execute.mockResolvedValueOnce([[{ id: 1, user_id: 2 }]]);
            pool.execute.mockResolvedValueOnce([{ affectedRows: 1 }]);
            
            const res = await request(app)
                .patch('/1/read')
                .set('Authorization', authHeader({ id: 99, role: 'admin' }));
                
            expect(res.status).toBe(200);
        });
    });

    describe('POST /register-device', () => {
        test('đăng ký thành công', async () => {
            pool.execute.mockResolvedValueOnce([{ affectedRows: 1 }]);
            
            const res = await request(app).post('/register-device').send({
                userId: 1,
                fcmToken: 'valid-token'
            });
            expect(res.status).toBe(200);
        });

        test('báo lỗi 400 nếu thiếu dữ liệu', async () => {
            const res = await request(app).post('/register-device').send({
                userId: 1
            });
            expect(res.status).toBe(400);
        });

        test('báo lỗi 500 nếu token quá dài', async () => {
            const res = await request(app).post('/register-device').send({
                userId: 1,
                fcmToken: 'a'.repeat(256)
            });
            expect(res.status).toBe(500);
        });

        test('báo lỗi 500 nếu DB lỗi', async () => {
            pool.execute.mockRejectedValueOnce(new Error('DB Error'));
            
            const res = await request(app).post('/register-device').send({
                userId: 1,
                fcmToken: 'valid-token'
            });
            expect(res.status).toBe(500);
        });
    });

    describe('POST /notify', () => {
        test('broadcast', async () => {
            const res = await request(app).post('/notify').send({
                userId: 'broadcast',
                eventName: 'test-event',
                data: { msg: 'hi' }
            });
            expect(res.status).toBe(200);
            expect(res.body.message).toMatch(/broadcast/i);
        });

        test('realtime to online user', async () => {
            addUser(1, 'socket-123'); // Simulate user online
            const res = await request(app).post('/notify').send({
                userId: 1,
                eventName: 'test-event',
                data: { msg: 'hi' }
            });
            expect(res.status).toBe(200);
            expect(res.body.message).toMatch(/realtime/i);
        });

        test('push to offline user', async () => {
            // User offline => triggers sendPushNotification
            pool.execute.mockResolvedValueOnce([[{ fcm_token: 'token1' }]]); // mock finding token
            admin.messaging().sendEachForMulticast.mockResolvedValueOnce({ successCount: 1, failureCount: 0 });

            const res = await request(app).post('/notify').send({
                userId: 1,
                eventName: 'test-event',
                data: { msg: 'hi' }
            });
            expect(res.status).toBe(200);
            expect(res.body.message).toMatch(/push/i);
            
            // Wait slightly for async sendPushNotification to execute (it is not awaited by route!)
            await new Promise(r => setTimeout(r, 10));
            expect(admin.messaging().sendEachForMulticast).toHaveBeenCalled();
        });
    });

    describe('Socket user management', () => {
        test('addUser and removeUser', () => {
            addUser(99, 'sock99');
            expect(onlineUsers[99]).toBe('sock99');
            
            removeUser('sock99');
            expect(onlineUsers[99]).toBeUndefined();
        });
        
        test('removeUser with non-existent socket does nothing', () => {
            addUser(99, 'sock99');
            removeUser('unknown-sock');
            expect(onlineUsers[99]).toBe('sock99');
        });
    });

    describe('sendPushNotification error paths', () => {
        test('user has no tokens', async () => {
            pool.execute.mockResolvedValueOnce([[]]);
            await sendPushNotification(1, 'event', {});
            // FCM should not be called
            expect(admin.messaging().sendEachForMulticast).not.toHaveBeenCalled();
        });

        test('FCM throws error', async () => {
            pool.execute.mockResolvedValueOnce([[{ fcm_token: 't' }]]);
            admin.messaging().sendEachForMulticast.mockRejectedValueOnce(new Error('FCM fail'));
            await sendPushNotification(1, 'event', {});
            // Should be caught and logged
        });
    });
});
