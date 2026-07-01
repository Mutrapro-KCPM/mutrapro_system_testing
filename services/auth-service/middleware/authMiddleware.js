const jwt = require('jsonwebtoken');
const { AppError } = require('../../../shared/middleware/errorHandler');

const authMiddleware = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new AppError('Yêu cầu xác thực không hợp lệ', 401);
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Gắn thông tin user đã giải mã vào request để các xử lý sau có thể dùng
        req.user = decoded;
        next();
    } catch (error) {
        // next(error) sẽ đẩy lỗi về cho errorHandler xử lý
        next(new AppError('Token không hợp lệ hoặc đã hết hạn', 401));
    }
};

// Middleware kiểm tra vai trò (role)
const checkRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return next(new AppError('Bạn không có quyền truy cập vào tài nguyên này', 403));
        }
        next();
    };
};

module.exports = { authMiddleware, checkRole };
