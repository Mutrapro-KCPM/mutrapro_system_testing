const request = require('supertest');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');

// Setup environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_secret_key';
process.env.DB_HOST = 'localhost';
process.env.DB_USER = 'root';
process.env.DB_PASSWORD = '';
process.env.DB_ANALYTICS_NAME = 'analytics_db';

// Mock mysql2/promise
jest.mock('mysql2/promise', () => {
    const mockPool = { execute: jest.fn(), query: jest.fn() };
    return { createPool: jest.fn(() => mockPool), __mockPool: mockPool };
});

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

describe('Analytics Service Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('GET /health should return 200', async () => {
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
        expect(res.body.service).toBe('analytics-service');
        expect(res.body.status).toBe('ok');
    });

    describe('GET /stats', () => {
        it('should return 401 if no token provided', async () => {
            const res = await request(app).get('/stats');
            expect(res.status).toBe(401);
        });

        it('should return 403 if role is not admin or coordinator', async () => {
            const token = generateToken({ id: 1, role: 'artist' });
            const res = await request(app)
                .get('/stats')
                .set('Authorization', `Bearer ${token}`);
            expect(res.status).toBe(403);
        });

        it('should return default data when DB has no rows', async () => {
            const token = generateToken({ id: 1, role: 'admin' });
            pool.execute.mockResolvedValueOnce([[]]); // Empty rows

            const res = await request(app)
                .get('/stats')
                .set('Authorization', `Bearer ${token}`);
            
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.totalRevenue).toBe(0);
            expect(res.body.data.totalOrders).toBe(0);
        });

        it('should return json_value when DB has report_dashboard', async () => {
            const token = generateToken({ id: 1, role: 'coordinator' });
            const mockData = { totalRevenue: 1000, totalOrders: 5, orderStats: [] };
            pool.execute.mockResolvedValueOnce([[{ json_value: mockData }]]);

            const res = await request(app)
                .get('/stats')
                .set('Authorization', `Bearer ${token}`);
            
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.totalRevenue).toBe(1000);
            expect(res.body.data.totalOrders).toBe(5);
        });
    });

    describe('GET /reports/overview', () => {
        it('should return 401 if no token provided', async () => {
            const res = await request(app).get('/reports/overview');
            expect(res.status).toBe(401);
        });

        it('should return 403 if role is not admin or coordinator', async () => {
            const token = generateToken({ id: 3, role: 'artist' });
            const res = await request(app)
                .get('/reports/overview')
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(403);
        });

        it('should return default data when DB has no rows (admin)', async () => {
            const token = generateToken({ id: 2, role: 'admin' });
            pool.execute.mockResolvedValueOnce([[]]); 

            const res = await request(app)
                .get('/reports/overview')
                .set('Authorization', `Bearer ${token}`);
            
            expect(res.status).toBe(200);
            expect(res.body.data.totalRevenue).toBe(0);
        });

        it('should return json_value when DB has report_dashboard', async () => {
            const token = generateToken({ id: 4, role: 'coordinator' });
            const mockData = { totalRevenue: 2500, totalOrders: 9, orderStats: [{ status: 'completed', count: 9 }] };
            pool.execute.mockResolvedValueOnce([[{ json_value: mockData }]]);

            const res = await request(app)
                .get('/reports/overview')
                .set('Authorization', `Bearer ${token}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toEqual(mockData);
        });
    });
});
