const request = require('supertest');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');

// Thiết lập biến môi trường bắt buộc cho test
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_key';
process.env.DB_STUDIO_NAME = 'mutrapro_studio';

// Mock thư viện mysql2 (Giả lập Database)
jest.mock('mysql2/promise', () => {
    const mockPool = { execute: jest.fn(), query: jest.fn() };
    return { createPool: jest.fn(() => mockPool), __mockPool: mockPool };
});

// Mock axios (bỏ qua việc gọi sang notification-service)
jest.mock('axios');

// Mock logger
jest.mock('../../shared/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    }
}));

const pool = require('mysql2/promise').__mockPool;
const app = require('../../index'); 

const generateToken = (payload) => jwt.sign(payload, process.env.JWT_SECRET);

describe('Studio Service Tests', () => {
    let validArtistToken;
    let validAdminToken;
    let validStudioAdminToken;
    let validUserToken;

    beforeAll(() => {
        validArtistToken = generateToken({ id: 99, role: 'artist' });
        validAdminToken = generateToken({ id: 1, role: 'admin' });
        validStudioAdminToken = generateToken({ id: 2, role: 'studio_admin' });
        validUserToken = generateToken({ id: 3, role: 'user' });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /health', () => {
        it('should return 200', async () => {
            const res = await request(app).get('/health');
            expect(res.status).toBe(200);
            expect(res.body.service).toBe('studio-service');
        });
    });

    describe('GET /studios', () => {
        it('should return a list of studios', async () => {
            pool.execute.mockResolvedValueOnce([[{ id: 1, name: 'Studio A' }]]);
            const res = await request(app).get('/studios');
            expect(res.status).toBe(200);
            expect(res.body.length).toBe(1);
            expect(res.body[0].name).toBe('Studio A');
        });
    });

    describe('POST /bookings', () => {
        it('should return 401 if missing token', async () => {
            const res = await request(app).post('/bookings').send({});
            expect(res.status).toBe(401);
        });

        it('should return 403 if role is wrong', async () => {
            const res = await request(app)
                .post('/bookings')
                .set('Authorization', `Bearer ${validUserToken}`)
                .send({});
            expect(res.status).toBe(403);
        });

        it('should return 400 if missing fields', async () => {
            const res = await request(app)
                .post('/bookings')
                .set('Authorization', `Bearer ${validArtistToken}`)
                .send({ studioId: 1 });
            expect(res.status).toBe(400);
        });

        it('should return 400 if start_time >= end_time', async () => {
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 1);
            const res = await request(app)
                .post('/bookings')
                .set('Authorization', `Bearer ${validArtistToken}`)
                .send({
                    studioId: 1,
                    orderId: 123,
                    startTime: futureDate.toISOString(),
                    endTime: futureDate.toISOString() // Same time
                });
            expect(res.status).toBe(400);
        });

        it('should return 400 if booking in the past', async () => {
            const pastDate = new Date();
            pastDate.setFullYear(2020);
            const res = await request(app)
                .post('/bookings')
                .set('Authorization', `Bearer ${validArtistToken}`)
                .send({
                    studioId: 1,
                    orderId: 123,
                    startTime: pastDate.toISOString(),
                    endTime: new Date(pastDate.getTime() + 3600000).toISOString()
                });
            expect(res.status).toBe(400);
            expect(res.body.message).toBe('Không thể đặt lịch trong quá khứ.');
        });

        it('should return 404 if studio does not exist', async () => {
            pool.execute.mockResolvedValueOnce([[]]); // Empty studio result
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 1);
            
            const res = await request(app)
                .post('/bookings')
                .set('Authorization', `Bearer ${validArtistToken}`)
                .send({ studioId: 999, orderId: 123, startTime: futureDate.toISOString(), endTime: new Date(futureDate.getTime() + 3600000).toISOString() });
            
            expect(res.status).toBe(404);
        });

        it('should return 400 if studio not available', async () => {
            pool.execute.mockResolvedValueOnce([[{ status: 'maintenance' }]]); 
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 1);
            
            const res = await request(app)
                .post('/bookings')
                .set('Authorization', `Bearer ${validArtistToken}`)
                .send({ studioId: 1, orderId: 123, startTime: futureDate.toISOString(), endTime: new Date(futureDate.getTime() + 3600000).toISOString() });
            
            expect(res.status).toBe(400);
        });

        it('should return 409 if conflict', async () => {
            pool.execute.mockResolvedValueOnce([[{ status: 'available' }]]); 
            pool.execute.mockResolvedValueOnce([[{ id: 10 }]]); 
            
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 1);
            
            const res = await request(app)
                .post('/bookings')
                .set('Authorization', `Bearer ${validArtistToken}`)
                .send({ studioId: 1, orderId: 123, startTime: futureDate.toISOString(), endTime: new Date(futureDate.getTime() + 3600000).toISOString() });
            
            expect(res.status).toBe(409);
        });

        it('should return 201 on success', async () => {
            pool.execute.mockResolvedValueOnce([[{ status: 'available' }]]); 
            pool.execute.mockResolvedValueOnce([[]]); 
            pool.execute.mockResolvedValueOnce([{ insertId: 55 }]); 

            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 1);
            
            const res = await request(app)
                .post('/bookings')
                .set('Authorization', `Bearer ${validArtistToken}`)
                .send({ studioId: 1, orderId: 123, startTime: futureDate.toISOString(), endTime: new Date(futureDate.getTime() + 3600000).toISOString() });
            
            expect(res.status).toBe(201);
            expect(res.body.id).toBe(55);
        });
    });

    describe('GET /bookings/order/:orderId', () => {
        it('should return 404 if booking not found', async () => {
            pool.execute.mockResolvedValueOnce([[]]);
            const res = await request(app).get('/bookings/order/999');
            expect(res.status).toBe(404);
        });

        it('should return 200 and booking if found', async () => {
            pool.execute.mockResolvedValueOnce([[{ studioName: 'A' }]]);
            const res = await request(app).get('/bookings/order/123');
            expect(res.status).toBe(200);
            expect(res.body.studioName).toBe('A');
        });
    });

    describe('POST /bookings/:id/confirm', () => {
        it('should return 404 if not found', async () => {
            pool.execute.mockResolvedValueOnce([[]]);
            const res = await request(app)
                .post('/bookings/1/confirm')
                .set('Authorization', `Bearer ${validStudioAdminToken}`);
            expect(res.status).toBe(404);
        });

        it('should return 409 if conflict', async () => {
            pool.execute.mockResolvedValueOnce([[{ id: 1, studio_id: 1, end_time: new Date(), start_time: new Date() }]]);
            pool.execute.mockResolvedValueOnce([[{ id: 2 }]]); // Conflict
            
            const res = await request(app)
                .post('/bookings/1/confirm')
                .set('Authorization', `Bearer ${validStudioAdminToken}`);
            expect(res.status).toBe(409);
        });

        it('should return success on confirm', async () => {
            pool.execute.mockResolvedValueOnce([[{ id: 1, studio_id: 1, end_time: new Date(), start_time: new Date() }]]);
            pool.execute.mockResolvedValueOnce([[]]); // No conflict
            pool.execute.mockResolvedValueOnce([{}]); // Update
            
            const res = await request(app)
                .post('/bookings/1/confirm')
                .set('Authorization', `Bearer ${validStudioAdminToken}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });

    describe('POST /bookings/:id/reject', () => {
        it('should return 404 if not found', async () => {
            pool.execute.mockResolvedValueOnce([{ affectedRows: 0 }]);
            const res = await request(app)
                .post('/bookings/1/reject')
                .set('Authorization', `Bearer ${validStudioAdminToken}`);
            expect(res.status).toBe(404);
        });

        it('should return success on reject', async () => {
            pool.execute.mockResolvedValueOnce([{ affectedRows: 1 }]);
            const res = await request(app)
                .post('/bookings/1/reject')
                .set('Authorization', `Bearer ${validStudioAdminToken}`);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });

    describe('POST /bookings/:id/cancel', () => {
        it('should return 404 if booking not found', async () => {
            pool.execute.mockResolvedValueOnce([[]]);
            const res = await request(app)
                .post('/bookings/1/cancel')
                .set('Authorization', `Bearer ${validArtistToken}`);
            expect(res.status).toBe(404);
        });

        it('should return 403 if not owner or admin', async () => {
            pool.execute.mockResolvedValueOnce([[{ id: 1, artist_id: 100 }]]);
            const res = await request(app)
                .post('/bookings/1/cancel')
                .set('Authorization', `Bearer ${validArtistToken}`); // artist ID is 99
            expect(res.status).toBe(403);
        });

        it('should return success if owner', async () => {
            pool.execute.mockResolvedValueOnce([[{ id: 1, artist_id: 99 }]]); // matches ID 99
            pool.execute.mockResolvedValueOnce([{}]); // Update
            const res = await request(app)
                .post('/bookings/1/cancel')
                .set('Authorization', `Bearer ${validArtistToken}`); 
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });

    describe('PUT /studios/:id/status', () => {
        it('should return 400 if status invalid', async () => {
            const res = await request(app)
                .put('/studios/1/status')
                .set('Authorization', `Bearer ${validStudioAdminToken}`)
                .send({ status: 'invalid_status' });
            expect(res.status).toBe(400);
        });

        it('should return 404 if not found', async () => {
            pool.execute.mockResolvedValueOnce([{ affectedRows: 0 }]);
            const res = await request(app)
                .put('/studios/1/status')
                .set('Authorization', `Bearer ${validStudioAdminToken}`)
                .send({ status: 'maintenance' });
            expect(res.status).toBe(404);
        });

        it('should return success on valid update', async () => {
            pool.execute.mockResolvedValueOnce([{ affectedRows: 1 }]);
            const res = await request(app)
                .put('/studios/1/status')
                .set('Authorization', `Bearer ${validStudioAdminToken}`)
                .send({ status: 'booked' });
            expect(res.status).toBe(200);
            expect(res.body.message).toBe('Cập nhật trạng thái phòng thu thành công.');
        });
    });
});
