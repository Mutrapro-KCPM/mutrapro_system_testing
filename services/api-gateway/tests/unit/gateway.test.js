const request = require('supertest');
const fetch = require('node-fetch');

// Set environment variables for test
process.env.NODE_ENV = 'test';
process.env.CORS_ORIGIN = '*';
process.env.INTERNAL_SERVICE_PROTOCOL = 'http';

// Mock node-fetch
jest.mock('node-fetch');
const { Response } = jest.requireActual('node-fetch');

const app = require('../../index');

describe('API Gateway Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('GET /api/health should return 200 and success status', async () => {
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.service).toBe('api-gateway');
        expect(res.body.data.status).toBe('ok');
    });

    it('GET /api/health/all should return status of all services when all are ok', async () => {
        // Mock fetch to return success for all calls
        fetch.mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ status: 'ok', timestamp: '2023-10-10' }), { status: 200 })));

        const res = await request(app).get('/api/health/all');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.auth.status).toBe('ok');
        expect(res.body.data.order.status).toBe('ok');
        expect(res.body.data.task.status).toBe('ok');
        expect(res.body.data.file.status).toBe('ok');
        expect(res.body.data.studio.status).toBe('ok');
        expect(res.body.data.notification.status).toBe('ok');
        expect(fetch).toHaveBeenCalledTimes(6);
    });

    it('GET /api/health/all should handle unreachable services', async () => {
        // Mock fetch to fail for some services
        fetch.mockImplementation((url) => {
            if (url.includes('auth-service')) {
                return Promise.reject(new Error('Network error'));
            }
            return Promise.resolve(new Response(JSON.stringify({ status: 'ok', timestamp: '2023-10-10' }), { status: 200 }));
        });

        const res = await request(app).get('/api/health/all');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.auth.status).toBe('error');
        expect(res.body.data.order.status).toBe('ok');
    });
});
