// tests/unit/setup.js

// MOCK: Middleware Xác thực (Bypass JWT Security)
jest.mock('../../shared/middleware/auth', () => {
    return {
        authMiddleware: (req, res, next) => {
            if (req.headers['authorization'] === 'Bearer INVALID' || req.headers['authorization'] === 'INVALID') {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            if (req.headers['x-missing-token'] === 'true' || (!req.headers['authorization'] && req.headers['x-sec-check'] === 'true')) {
                return res.status(401).json({ error: 'Missing token' });
            }
            let defaultRole = 'customer';
            // GET /payments is actually for customer, so remove it from here
            if (req.url.includes('/status') || (req.url === '/' && req.method === 'GET')) {
                defaultRole = 'admin';
            }
            req.user = { id: 1, email: 'test@customer.com', role: req.headers['x-mock-role'] || defaultRole };
            next();
        },
        checkRole: (roles) => (req, res, next) => {
            if (!roles.includes(req.user.role)) {
                return res.status(403).json({ error: 'Forbidden' });
            }
            next();
        },
        assertOwnerOrRole: (role) => (req, res, next) => {
            if (req.headers['x-sec-wrong-owner'] === 'true') {
                 return res.status(403).json({ error: 'Not the owner' });
            }
            next();
        }
    };
});

// GLOBAL MOCK POOL (Exposed cho các file Test)
const mockPool = {
    query: jest.fn(),
    execute: jest.fn(),
    getConnection: jest.fn().mockResolvedValue({
        query: jest.fn(),
        release: jest.fn(),
        beginTransaction: jest.fn(),
        commit: jest.fn(),
        rollback: jest.fn(),
    })
};
global.mockPool = mockPool;

// MOCK: External Dependencies
jest.mock('axios', () => ({
    post: jest.fn().mockResolvedValue({ data: { success: true } }),
    get: jest.fn().mockResolvedValue({ data: [] }) // Trả về mảng rỗng để vòng lặp for..of không bị lỗi 'is not iterable'
}));

jest.mock('mysql2/promise', () => {
    return {
        createPool: jest.fn(() => mockPool)
    };
});
jest.mock('ioredis', () => {
    return jest.fn().mockImplementation(() => {
        return { get: jest.fn(), set: jest.fn(), quit: jest.fn(), on: jest.fn() };
    });
});
jest.mock('amqplib', () => {
    return {
        connect: jest.fn().mockResolvedValue({
            createChannel: jest.fn().mockResolvedValue({
                assertQueue: jest.fn(),
                assertExchange: jest.fn(),
                sendToQueue: jest.fn(),
                publish: jest.fn(),
                close: jest.fn() // Sửa lỗi channel.close is not a function
            }),
            close: jest.fn()
        })
    };
});