// DĂN LĂN DĂ’NG 1 Cá»¦A FILE auth-service/index.js
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled promise rejection:', reason);
    promise.catch(err => console.error('Promise rejection details:', err));
    process.exit(1); // ThoĂ¡t ngay láº­p tá»©c
});
process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    process.exit(1); // ThoĂ¡t ngay láº­p tá»©c
});

const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: '../.env', quiet: true });

// ======================= Sá»¬A Lá»–I PATH á» ÄĂ‚Y =======================
const { logger } = require('./shared/logger');
const { asyncHandler, notFound, errorHandler, AppError } = require('./shared/middleware/errorHandler');
const { responseHandler } = require('./shared/middleware/responseHandler');
// ==================================================================

// === THĂM Káº¾T Ná»I REDIS ===
const Redis = require('ioredis');
const redis = new Redis({
    host: 'redis_cache', // TĂªn service trong docker-compose
    port: 6379,
});
redis.on('connect', () => {
    logger.info('Auth service connected to Redis cache.');
});
redis.on('error', (err) => {
    logger.error('Auth service failed to connect to Redis.', { message: err.message });
});
// === Káº¾T THĂC THĂM Má»I ===

// ======================= Sá»¬A Lá»–I PATH á» ÄĂ‚Y =======================
const {
    registerValidation,
    loginValidation,
    idParamValidation,
    // === IMPORT VALIDATION Má»I ===
    adminCreateUserValidation,
    adminUpdateUserValidation
} = require('./shared/middleware/validation');
// ==================================================================

const { authMiddleware, checkRole } = require('./middleware/authMiddleware');
const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(express.json());
app.use(responseHandler);

//  đŸ”¹  Health check route
app.get('/health', (req, res) => {
    res.status(200).json({
        service: 'auth-service',
        status: 'ok',
        timestamp: new Date().toISOString()
    });
});

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_AUTH_NAME,
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};
const pool = mysql.createPool(dbConfig);

// --- API Endpoints ---
// 1. API: ÄÄƒng kĂ½ ngÆ°á»i dĂ¹ng
app.post('/register', registerValidation, asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const [result] = await pool.execute(
        'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
        [name, email, hashedPassword, 'customer']
    );
    logger.info(`New user registered: ${email}`);
    res.status(201).json({ id: result.insertId, message: 'User registered successfully' });
}));

// 2. API: ÄÄƒng nháº­p
app.post('/login', loginValidation, asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
        throw new AppError('Email hoáº·c máº­t kháº©u khĂ´ng Ä‘Ăºng.', 401);
    }
    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
        throw new AppError('Email hoáº·c máº­t kháº©u khĂ´ng Ä‘Ăºng.', 401);
    }
    const payload = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' });
    delete user.password_hash;
    logger.info(`User logged in: ${email}`);
    res.json({ message: 'Login successful', token, user });
}));

// 3. API Má»I: XĂ¡c thá»±c token
app.get('/verify', authMiddleware, (req, res) => {
    res.json({ message: 'Token is valid', user: req.user });
});

// 4. API: Láº¥y danh sĂ¡ch chuyĂªn viĂªn theo vai trĂ²
app.get('/users/specialists', authMiddleware, checkRole('coordinator'), asyncHandler(async (req, res) => {
    const { role } = req.query;
    const specialistRoles = ['transcriber', 'arranger', 'artist'];
    if (!role || !specialistRoles.includes(role)) {
        throw new AppError('Vai trĂ² chuyĂªn viĂªn khĂ´ng há»£p lá»‡.', 400);
    }
    const [specialists] = await pool.execute(
        'SELECT id, name FROM users WHERE role = ?',
        [role]
    );
    res.json(specialists);
}));

// 5. API: Cáº­p nháº­t tĂªn ngÆ°á»i dĂ¹ngc
app.put('/users/:id', authMiddleware, idParamValidation, asyncHandler(async (req, res) => {
    const targetUserId = parseInt(req.params.id, 10);
    const { name } = req.body;
    if (req.user.id !== targetUserId) {
        throw new AppError('Báº¡n khĂ´ng cĂ³ quyá»n thá»±c hiá»‡n hĂ nh Ä‘á»™ng nĂ y.', 403);
    }
    if (!name) {
        throw new AppError('TĂªn khĂ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng.', 400);
    }
    const [result] = await pool.execute('UPDATE users SET name = ? WHERE id = ?', [name, targetUserId]);
    // === THĂM Lá»†NH XĂ“A CACHE ===
    if (result.affectedRows > 0) {
        const customerCacheKey = `user:${targetUserId}:name`;
        await redis.del(customerCacheKey); // Lá»‡nh xĂ³a key
        logger.info(`[Cache] Deleted key ${customerCacheKey} after user profile update.`);
    }
    // === Káº¾T THĂC THĂM Má»I ===
    if (result.affectedRows === 0) {
        throw new AppError('KhĂ´ng tĂ¬m tháº¥y ngÆ°á»i dĂ¹ng.', 404);
    }
    logger.info(`User profile updated: ${req.user.email}`);
    res.json({ message: 'Cáº­p nháº­t há»“ sÆ¡ thĂ nh cĂ´ng.' });
}));

// 6. API: Äá»•i máº­t kháº©u
app.put('/users/:id/password', authMiddleware, idParamValidation, asyncHandler(async (req, res) => {
    const targetUserId = parseInt(req.params.id, 10);
    const { oldPassword, newPassword } = req.body;
    if (req.user.id !== targetUserId) {
        throw new AppError('Báº¡n khĂ´ng cĂ³ quyá»n thá»±c hiá»‡n hĂ nh Ä‘á»™ng nĂ y.', 403);
    }
    if (!oldPassword || !newPassword || newPassword.length < 6) {
        throw new AppError('Vui lĂ²ng cung cáº¥p máº­t kháº©u cÅ© vĂ  máº­t kháº©u má»›i (Ă­t nháº¥t 6 kĂ½ tá»±).', 400);
    }
    const [rows] = await pool.execute('SELECT password_hash FROM users WHERE id = ?', [targetUserId]);
    if (rows.length === 0) {
        throw new AppError('KhĂ´ng tĂ¬m tháº¥y ngÆ°á»i dĂ¹ng.', 404);
    }
    const user = rows[0];
    const isMatch = await bcrypt.compare(oldPassword, user.password_hash);
    if (!isMatch) {
        throw new AppError('Máº­t kháº©u cÅ© khĂ´ng Ä‘Ăºng.', 401);
    }
    const salt = await bcrypt.genSalt(10);
    const hashedNewPassword = await bcrypt.hash(newPassword, salt);
    await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [hashedNewPassword, targetUserId]);
    logger.info(`User password changed: ${req.user.email}`);
    res.json({ message: 'Äá»•i máº­t kháº©u thĂ nh cĂ´ng.' });
}));

// 7. API: Láº¥y thĂ´ng tin cÆ¡ báº£n cá»§a má»™t user (dĂ¹ng ná»™i bá»™ giá»¯a cĂ¡c service)
app.get('/users/:id', idParamValidation, asyncHandler(async (req, res) => {
    const [rows] = await pool.execute('SELECT id, name, email, role FROM users WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
        throw new AppError('KhĂ´ng tĂ¬m tháº¥y ngÆ°á»i dĂ¹ng.', 404);
    }
    res.json(rows[0]);
}));

// 8. API Má»I: Láº¥y IDs theo vai trĂ² (dĂ¹ng ná»™i bá»™)
app.get('/users/by-role/:role', asyncHandler(async (req, res) => {
    const { role } = req.params;
    // Láº¥y chá»‰ ID
    const [users] = await pool.execute('SELECT id FROM users WHERE role = ?', [role]);
    res.json(users); // Sáº½ tráº£ vá» [ {id: 2}, {id: 4}, ... ]
}));

// === START: API Má»I CHO ADMIN CRUD USERS ===
// 9. API (Admin): Láº¥y táº¥t cáº£ ngÆ°á»i dĂ¹ng
app.get('/admin/users', authMiddleware, checkRole('admin'), asyncHandler(async (req, res) => {
    // Láº¥y táº¥t cáº£ user, loáº¡i bá» password_hash
    const [users] = await pool.execute('SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC');
    res.json(users);
}));

// 10. API (Admin): Táº¡o ngÆ°á»i dĂ¹ng má»›i
app.post('/admin/users', authMiddleware, checkRole('admin'), adminCreateUserValidation, asyncHandler(async (req, res) => {
    const { name, email, password, role } = req.body;
    // MĂ£ hĂ³a máº­t kháº©u
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const [result] = await pool.execute(
        'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
        [name, email, hashedPassword, role]
    );
    logger.info(`Admin created new user: ${email} (Role: ${role})`);
    res.status(201).json({ id: result.insertId, message: 'Táº¡o ngÆ°á»i dĂ¹ng thĂ nh cĂ´ng' });
}));

// 11. API (Admin): Cáº­p nháº­t ngÆ°á»i dĂ¹ng
app.put('/admin/users/:id', authMiddleware, checkRole('admin'), idParamValidation, adminUpdateUserValidation, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, email, role } = req.body;
    // Admin khĂ´ng Ä‘Æ°á»£c phĂ©p sá»­a tĂ i khoáº£n cá»§a chĂ­nh mĂ¬nh qua API nĂ y Ä‘á»ƒ trĂ¡nh tá»± khĂ³a
    if (parseInt(id, 10) === req.user.id) {
        throw new AppError('KhĂ´ng thá»ƒ tá»± sá»­a vai trĂ² cá»§a chĂ­nh mĂ¬nh. Vui lĂ²ng sá»­a trong CSDL.', 400);
    }
    const [result] = await pool.execute(
        'UPDATE users SET name = ?, email = ?, role = ? WHERE id = ?',
        [name, email, role, id]
    );
    // === THĂM Lá»†NH XĂ“A CACHE ===
    if (result.affectedRows > 0) {
        const customerCacheKey = `user:${id}:name`;
        await redis.del(customerCacheKey); // Lá»‡nh xĂ³a key
        logger.info(`[Cache] Deleted key ${customerCacheKey} after admin user update.`);
    }
    // === Káº¾T THĂC THĂM Má»I ===
    if (result.affectedRows === 0) {
        throw new AppError('KhĂ´ng tĂ¬m tháº¥y ngÆ°á»i dĂ¹ng.', 404);
    }
    logger.info(`Admin updated user ID: ${id}`);
    res.json({ message: 'Cáº­p nháº­t ngÆ°á»i dĂ¹ng thĂ nh cĂ´ng' });
}));

// 12. API (Admin): XĂ³a ngÆ°á»i dĂ¹ng
app.delete('/admin/users/:id', authMiddleware, checkRole('admin'), idParamValidation, asyncHandler(async (req, res) => {
    const { id } = req.params;
    // NgÄƒn admin tá»± xĂ³a mĂ¬nh
    if (parseInt(id, 10) === req.user.id) {
        throw new AppError('Báº¡n khĂ´ng thá»ƒ tá»± xĂ³a chĂ­nh mĂ¬nh.', 400);
    }
    const [result] = await pool.execute('DELETE FROM users WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
        throw new AppError('KhĂ´ng tĂ¬m tháº¥y ngÆ°á»i dĂ¹ng.', 404);
    }
    logger.info(`Admin deleted user ID: ${id}`);
    res.json({ message: 'XĂ³a ngÆ°á»i dĂ¹ng thĂ nh cĂ´ng' });
}));
// === END: API Má»I CHO ADMIN CRUD USERS ===

// --- Middleware xá»­ lĂ½ cuá»‘i cĂ¹ng ---
app.use(notFound);
app.use(errorHandler);
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    logger.info(`Auth Service is running on port ${PORT}`);
});

