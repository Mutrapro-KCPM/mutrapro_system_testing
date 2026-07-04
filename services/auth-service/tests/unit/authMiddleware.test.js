// tests/unit/authMiddleware.test.js
const { authMiddleware, checkRole } = require('../../middleware/authMiddleware');
const { AppError } = require('../../shared/middleware/errorHandler');
const jwt = require('jsonwebtoken');

jest.mock('jsonwebtoken');

describe('Auth Middleware', () => {
    let req;
    let res;
    let next;

    beforeEach(() => {
        req = { headers: {} };
        res = {};
        next = jest.fn();
        process.env.JWT_SECRET = 'test_secret';
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('authMiddleware', () => {
        test('ném AppError 401 nếu không có authorization header', () => {
            authMiddleware(req, res, next);
            expect(next).toHaveBeenCalledWith(expect.any(AppError));
            expect(next.mock.calls[0][0].statusCode).toBe(401);
        });

        test('ném AppError 401 nếu token không bắt đầu bằng Bearer', () => {
            req.headers.authorization = 'InvalidTokenFormat';
            authMiddleware(req, res, next);
            expect(next).toHaveBeenCalledWith(expect.any(AppError));
        });

        test('gọi next() với req.user được gán nếu token hợp lệ', () => {
            req.headers.authorization = 'Bearer validtoken';
            const decodedPayload = { id: 1, role: 'admin' };
            jwt.verify.mockReturnValue(decodedPayload);

            authMiddleware(req, res, next);

            expect(jwt.verify).toHaveBeenCalledWith('validtoken', 'test_secret');
            expect(req.user).toEqual(decodedPayload);
            expect(next).toHaveBeenCalledTimes(1);
            expect(next).toHaveBeenCalledWith(); // Gọi next không có tham số lỗi
        });

        test('ném AppError 401 nếu token sai hoặc hết hạn', () => {
            req.headers.authorization = 'Bearer expiredtoken';
            jwt.verify.mockImplementation(() => {
                throw new Error('jwt expired');
            });

            authMiddleware(req, res, next);

            expect(next).toHaveBeenCalledWith(expect.any(AppError));
            expect(next.mock.calls[0][0].statusCode).toBe(401);
        });
    });

    describe('checkRole', () => {
        test('ném AppError 403 nếu không có req.user', () => {
            const middleware = checkRole('admin');
            middleware(req, res, next);
            expect(next).toHaveBeenCalledWith(expect.any(AppError));
            expect(next.mock.calls[0][0].statusCode).toBe(403);
        });

        test('ném AppError 403 nếu role của user không nằm trong danh sách cho phép', () => {
            req.user = { role: 'customer' };
            const middleware = checkRole('admin', 'coordinator');
            middleware(req, res, next);
            expect(next).toHaveBeenCalledWith(expect.any(AppError));
            expect(next.mock.calls[0][0].statusCode).toBe(403);
        });

        test('gọi next() nếu user có role hợp lệ', () => {
            req.user = { role: 'admin' };
            const middleware = checkRole('admin', 'coordinator');
            middleware(req, res, next);
            expect(next).toHaveBeenCalledWith(); // Gọi next thành công
        });
    });
});
