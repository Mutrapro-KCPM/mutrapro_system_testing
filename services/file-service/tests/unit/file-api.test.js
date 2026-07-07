// tests/unit/file-api.test.js
// Tests for File Service endpoints: GET /health, POST /upload, GET /files/order/:orderId, GET /files/download/:fileId

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

// ---- Mock fs ----
jest.mock('fs', () => {
    const originalFs = jest.requireActual('fs');
    return {
        ...originalFs,
        existsSync: jest.fn(),
        unlink: jest.fn((path, cb) => {
            if (cb) cb(null);
        }),
        mkdirSync: jest.fn()
    };
});

// ---- Mock upload config ----
let mockUploadedFile = {
    originalname: 'demo.mp3',
    mimetype: 'audio/mpeg',
    path: 'uploads/test-demo.mp3',
    size: 123
};

jest.mock('../../config/uploadConfig', () => {
    const path = require('path');
    return {
        handleSingleFileUpload: () => (req, res, next) => {
            if (mockUploadedFile) {
                req.file = { ...mockUploadedFile };
            } else {
                req.file = undefined;
            }
            next();
        },
        decodeOriginalName: jest.fn(name => name),
        isAllowedFile: jest.fn(() => true),
        UPLOADS_DIR: path.resolve(__dirname, '../../uploads')
    };
});

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
const fs = require('fs');
const request = require('supertest');
const { isAllowedFile } = require('../../config/uploadConfig');

const pool = mysql.__mockPool;

let app;

beforeAll(() => {
    app = require('../../index');
});

beforeEach(() => {
    jest.clearAllMocks();
    pool.execute.mockReset();
    pool.query.mockReset();
    axios.get.mockReset();
    axios.post.mockReset();
    fs.existsSync.mockReset();

    mockUploadedFile = {
        originalname: 'demo.mp3',
        mimetype: 'audio/mpeg',
        path: 'uploads/test-demo.mp3',
        size: 123
    };
    isAllowedFile.mockReturnValue(true);
});

// ---- Helper JWT functions ----
const token = (payload) => jwt.sign(payload, process.env.JWT_SECRET);
const authHeader = (payload) => `Bearer ${token(payload)}`;

const CUSTOMER = { id: 1, role: 'customer' };
const OTHER_CUSTOMER = { id: 2, role: 'customer' };
const TRANSCRIBER = { id: 3, role: 'transcriber' };
const ARRANGER = { id: 4, role: 'arranger' };
const ARTIST = { id: 5, role: 'artist' };
const COORDINATOR = { id: 10, role: 'coordinator' };
const ADMIN = { id: 20, role: 'admin' };

// ============================================================
// GET /health
// ============================================================
describe('GET /health', () => {
    test('trả về 200 và status ok', async () => {
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
        expect(res.body.service).toBe('file-service');
        expect(res.body.status).toBe('ok');
        expect(res.body.timestamp).toBeDefined();
    });
});

// ============================================================
// POST /upload
// ============================================================
describe('POST /upload', () => {
    test('trả về 401 nếu thiếu token', async () => {
        const res = await request(app)
            .post('/upload')
            .send({ order_id: 1, file_type: 'audio' });
        expect(res.status).toBe(401);
    });

    test('trả về 400 nếu không có file', async () => {
        mockUploadedFile = null;
        const res = await request(app)
            .post('/upload')
            .set('Authorization', authHeader(CUSTOMER))
            .send({ order_id: 1, file_type: 'audio' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/No file was uploaded/);
    });

    test('trả về 400 nếu order_id không phải số nguyên dương (e.g. chữ)', async () => {
        const res = await request(app)
            .post('/upload')
            .set('Authorization', authHeader(CUSTOMER))
            .send({ order_id: 'abc', file_type: 'audio' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/order_id must be a positive integer/);
    });

    test('trả về 400 nếu order_id không phải số nguyên dương (e.g. số âm)', async () => {
        const res = await request(app)
            .post('/upload')
            .set('Authorization', authHeader(CUSTOMER))
            .send({ order_id: -5, file_type: 'audio' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/order_id must be a positive integer/);
    });

    test('trả về 400 nếu file_type không hợp lệ', async () => {
        const res = await request(app)
            .post('/upload')
            .set('Authorization', authHeader(CUSTOMER))
            .send({ order_id: 1, file_type: 'invalid_type' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/File type is invalid/);
    });

    test('trả về 400 nếu file format không được hỗ trợ bởi isAllowedFile', async () => {
        isAllowedFile.mockReturnValueOnce(false);
        const res = await request(app)
            .post('/upload')
            .set('Authorization', authHeader(CUSTOMER))
            .send({ order_id: 1, file_type: 'audio' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/File format is not supported/);
    });

    test('trả về 403 nếu role không được upload loại file đó (e.g. customer upload notation)', async () => {
        const res = await request(app)
            .post('/upload')
            .set('Authorization', authHeader(CUSTOMER))
            .send({ order_id: 1, file_type: 'notation' });
        expect(res.status).toBe(403);
        expect(res.body.message).toMatch(/You are not allowed to upload this file type/);
    });

    test('trả về 403 nếu customer không có quyền với order (id không khớp)', async () => {
        axios.get.mockResolvedValueOnce({ data: { id: 1, customer_id: 999 } });

        const res = await request(app)
            .post('/upload')
            .set('Authorization', authHeader(CUSTOMER))
            .send({ order_id: 1, file_type: 'audio' });

        expect(res.status).toBe(403);
        expect(res.body.message).toMatch(/You are not allowed to upload files for this order/);
        expect(axios.get).toHaveBeenCalledWith('http://order-service:3002/1', expect.any(Object));
    });

    test('upload thành công cho customer và insert vào DB', async () => {
        axios.get.mockResolvedValueOnce({ data: { id: 1, customer_id: CUSTOMER.id } });
        pool.execute.mockResolvedValueOnce([{ insertId: 101 }]);

        const res = await request(app)
            .post('/upload')
            .set('Authorization', authHeader(CUSTOMER))
            .send({ order_id: 1, file_type: 'audio' });

        expect(res.status).toBe(201);
        expect(res.body.data.id).toBe(101);
        expect(pool.execute).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO file'),
            [1, CUSTOMER.id, 'demo.mp3', expect.stringContaining('uploads'), 'audio', 123]
        );
    });

    test('gọi notification-service nếu file_type khác audio và có coordinatorId', async () => {
        axios.get.mockImplementation((url) => {
            if (url.includes('task-service')) {
                return Promise.resolve({ data: { assigned_to: TRANSCRIBER.id } });
            }
            return Promise.reject(new Error('unmatched url'));
        });
        pool.execute.mockResolvedValueOnce([{ insertId: 102 }]);
        axios.post.mockResolvedValueOnce({}); // notification-service

        const res = await request(app)
            .post('/upload')
            .set('Authorization', authHeader(TRANSCRIBER))
            .send({ order_id: 1, file_type: 'notation', coordinatorId: 10 });

        expect(res.status).toBe(201);
        expect(res.body.data.id).toBe(102);
        expect(axios.post).toHaveBeenCalledWith(
            'http://notification-service:3006/notify',
            expect.objectContaining({
                userId: 10,
                eventName: 'product_file_uploaded',
                data: expect.objectContaining({
                    orderId: 1,
                    fileName: 'demo.mp3',
                    uploaderId: TRANSCRIBER.id
                })
            })
        );
    });
});

// ============================================================
// GET /files/order/:orderId
// ============================================================
describe('GET /files/order/:orderId', () => {
    test('trả về 401 nếu thiếu token', async () => {
        const res = await request(app).get('/files/order/1');
        expect(res.status).toBe(401);
    });

    test('trả về 400 nếu orderId không hợp lệ (e.g. âm hoặc chữ)', async () => {
        const res = await request(app)
            .get('/files/order/abc')
            .set('Authorization', authHeader(CUSTOMER));
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/orderId must be a positive integer/);
    });

    test('trả về 403 nếu không có quyền xem file order', async () => {
        axios.get.mockResolvedValueOnce({ data: { id: 1, customer_id: 999 } });

        const res = await request(app)
            .get('/files/order/1')
            .set('Authorization', authHeader(CUSTOMER));

        expect(res.status).toBe(403);
        expect(res.body.message).toMatch(/You are not allowed to access files for this order/);
    });

    test('trả về 200 và danh sách file nếu có quyền', async () => {
        axios.get.mockResolvedValueOnce({ data: { id: 1, customer_id: CUSTOMER.id } });
        const mockFiles = [
            { id: 1, file_name: 'demo.mp3', file_type: 'audio', file_size: 123, created_at: '2026-07-07T00:00:00.000Z' }
        ];
        pool.execute.mockResolvedValueOnce([mockFiles]);

        const res = await request(app)
            .get('/files/order/1')
            .set('Authorization', authHeader(CUSTOMER));

        expect(res.status).toBe(200);
        expect(res.body.data).toEqual(mockFiles);
        expect(pool.execute).toHaveBeenCalledWith(
            expect.stringContaining('SELECT id, file_name, file_type, file_size, created_at'),
            [1]
        );
    });
});

// ============================================================
// GET /files/download/:fileId
// ============================================================
describe('GET /files/download/:fileId', () => {
    test('trả về 401 nếu thiếu token', async () => {
        const res = await request(app).get('/files/download/1');
        expect(res.status).toBe(401);
    });

    test('trả về 400 nếu fileId không hợp lệ', async () => {
        const res = await request(app)
            .get('/files/download/abc')
            .set('Authorization', authHeader(CUSTOMER));
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/fileId must be a positive integer/);
    });

    test('trả về 404 nếu không có metadata trong DB', async () => {
        pool.execute.mockResolvedValueOnce([[]]); // empty result

        const res = await request(app)
            .get('/files/download/1')
            .set('Authorization', authHeader(CUSTOMER));

        expect(res.status).toBe(404);
        expect(res.body.message).toMatch(/File metadata was not found/);
    });

    test('trả về 403 nếu không có quyền đọc order liên quan', async () => {
        const mockMetadata = { id: 1, order_id: 10, file_path: 'uploads/demo.mp3', file_name: 'demo.mp3' };
        pool.execute.mockResolvedValueOnce([[mockMetadata]]);
        axios.get.mockResolvedValueOnce({ data: { id: 10, customer_id: 999 } }); // not matching CUSTOMER

        const res = await request(app)
            .get('/files/download/1')
            .set('Authorization', authHeader(CUSTOMER));

        expect(res.status).toBe(403);
        expect(res.body.message).toMatch(/You are not allowed to access files for this order/);
    });

    test('trả về 404 nếu file không tồn tại trên server', async () => {
        const mockMetadata = { id: 1, order_id: 10, file_path: 'uploads/demo.mp3', file_name: 'demo.mp3' };
        pool.execute.mockResolvedValueOnce([[mockMetadata]]);
        axios.get.mockResolvedValueOnce({ data: { id: 10, customer_id: CUSTOMER.id } });
        fs.existsSync.mockReturnValueOnce(false); // file not on disk

        const res = await request(app)
            .get('/files/download/1')
            .set('Authorization', authHeader(CUSTOMER));

        expect(res.status).toBe(404);
        expect(res.body.message).toMatch(/File was not found on server/);
    });

    test('trả về 200/sendFile nếu file tồn tại trên server', async () => {
        const mockMetadata = { id: 1, order_id: 10, file_path: 'uploads/demo.mp3', file_name: 'demo.mp3' };
        pool.execute.mockResolvedValueOnce([[mockMetadata]]);
        axios.get.mockResolvedValueOnce({ data: { id: 10, customer_id: CUSTOMER.id } });
        fs.existsSync.mockReturnValueOnce(true); // file exists

        const realFs = jest.requireActual('fs');
        const targetPath = require('path').resolve(__dirname, '../../uploads/demo.mp3');
        const dir = require('path').dirname(targetPath);
        if (!realFs.existsSync(dir)) {
            realFs.mkdirSync(dir, { recursive: true });
        }
        realFs.writeFileSync(targetPath, 'dummy data');

        const res = await request(app)
            .get('/files/download/1')
            .set('Authorization', authHeader(CUSTOMER));

        expect(res.status).toBe(200);
        expect(res.headers['content-disposition']).toContain("filename*=UTF-8''demo.mp3");

        // Dọn dẹp file tạm
        try {
            realFs.unlinkSync(targetPath);
        } catch(e) {}
    });
});
