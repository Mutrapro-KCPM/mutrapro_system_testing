// services/notification-service/index.js
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const http = require('http');
const { Server } = require("socket.io");
const { logger } = require('./shared/logger');
const { authMiddleware, assertOwnerOrRole } = require('./shared/middleware/auth');
require('dotenv').config({ path: '../.env', quiet: true });

// ========== FIREBASE ADMIN SDK ==========
const admin = require("firebase-admin");

try {
  const serviceAccount = require("./firebase-admin-sdk.json");
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  logger.info("Firebase Admin SDK initialized successfully.");
} catch (error) {
  logger.warn("Firebase Admin SDK was not initialized. Push notifications will be disabled.", { message: error.message });
}

// ========== EXPRESS + SOCKET.IO SETUP ==========
const app = express();
const corsOptions = {
  origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  methods: ["GET", "POST"]
};
app.use(cors(corsOptions));
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({
    service: 'notification-service',
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

const server = http.createServer(app);
const io = new Server(server, { cors: corsOptions });

// ========== SOCKET USER MANAGEMENT ==========
let onlineUsers = {};

const addUser = (userId, socketId) => {
  onlineUsers[userId] = socketId;
  logger.info(`User ${userId} connected. Socket=${socketId}. Online users=${Object.keys(onlineUsers).length}`);
};

const removeUser = (socketId) => {
  for (const [userId, sId] of Object.entries(onlineUsers)) {
    if (sId === socketId) {
      delete onlineUsers[userId];
      logger.info(`User ${userId} disconnected. Socket=${socketId}.`);
      break;
    }
  }
};

io.on("connection", (socket) => {
  logger.info(`New client connected: ${socket.id}`);
  socket.on("addUser", (userId) => addUser(userId, socket.id));
  socket.on("disconnect", () => removeUser(socket.id));
});

// ========== MYSQL POOL ==========
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NOTIFICATION_NAME,
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};
const pool = mysql.createPool(dbConfig);

// ========== FCM PUSH NOTIFICATION ==========
const sendPushNotification = async (userId, eventName, data) => {
  try {
    // 1ï¸âƒ£ Láº¥y FCM tokens tá»« DB
    const [rows] = await pool.execute(
      "SELECT fcm_token FROM user_devices WHERE user_id = ?",
      [userId]
    );

    if (rows.length === 0) {
      logger.warn(`[FCM] User ${userId} has no FCM token.`);
      return;
    }

    const tokens = rows.map(r => r.fcm_token);

    // 2ï¸âƒ£ Chuáº©n bá»‹ ná»™i dung thĂ´ng bĂ¡o
    const message = {
      notification: {
        title: "Thông báo mới từ MuTraPro",
        body: data?.message || `Bạn có cập nhật từ sự kiện: ${eventName}`
      },
      webpush: {
        fcmOptions: { link: 'http://localhost:3000/dashboard' }
      },
      tokens
    };

    // 3ï¸âƒ£ Gá»­i thĂ´ng bĂ¡o (cĂº phĂ¡p chuáº©n)
    const response = await admin.messaging().sendEachForMulticast(message);

    logger.info(`[FCM] Push sent. Success=${response.successCount}, failed=${response.failureCount}, user=${userId}`);
  } catch (error) {
    logger.error(`[FCM] Failed to send notification to user ${userId}.`, { message: error.message });
  }
};

// ========== API ENDPOINTS ==========

// đŸ“¨ LÆ°u notification vĂ o DB (ná»™i bá»™)
app.post('/send', async (req, res) => {
  try {
    const { user_id, title, message, channel } = req.body;
    const [result] = await pool.execute(
      `INSERT INTO notifications (user_id, title, message, channel, status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [user_id, title, message, channel || 'push']
    );
    logger.info(`Notification for user ${user_id} saved.`);
    res.status(201).json({ id: result.insertId, message: 'Notification saved successfully' });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/', authMiddleware, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 100);
    const offset = (page - 1) * limit;
    const [countRows] = await pool.execute('SELECT COUNT(*) as total FROM notifications WHERE user_id = ?', [req.user.id]);
    const [items] = await pool.execute(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [String(req.user.id), String(limit), String(offset)]
    );

    res.json({
      success: true,
      message: 'Notifications loaded.',
      data: {
        items,
        pagination: {
          page,
          limit,
          total: countRows[0].total,
          totalPages: Math.ceil(countRows[0].total / limit)
        }
      }
    });
  } catch (err) {
    logger.error(err.message);
    res.status(500).json({ success: false, message: 'Internal server error', errors: [] });
  }
});

app.patch('/:id/read', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM notifications WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Notification not found.', errors: [] });
    }

    assertOwnerOrRole(req, rows[0].user_id, ['admin']);
    await pool.execute("UPDATE notifications SET status = 'sent', sent_at = COALESCE(sent_at, NOW()) WHERE id = ?", [req.params.id]);
    res.json({ success: true, message: 'Notification marked as read.', data: { id: req.params.id } });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({ success: false, message: err.message || 'Internal server error', errors: [] });
  }
});

// đŸ“± ÄÄƒng kĂ½ thiáº¿t bá»‹ (FCM)
app.post('/register-device', async (req, res) => {
  try {
    const { userId, fcmToken } = req.body;
    if (!userId || !fcmToken) {
      return res.status(400).json({ error: 'Thiếu thông tin userId hoặc fcmToken' });
    }

    await pool.execute(
      "INSERT INTO user_devices (user_id, fcm_token) VALUES (?, ?) ON DUPLICATE KEY UPDATE user_id=user_id",
      [userId, fcmToken]
    );

    logger.info(`FCM token registered for user ${userId}.`);
    res.status(200).json({ message: 'Thiết bị đã được đăng ký thành công' });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: 'Lỗi đăng ký thiết bị' });
  }
});

// đŸ“¡ Gá»­i notification real-time
app.post('/notify', async (req, res) => {
  const { userId, eventName, data } = req.body;
  logger.info(`/notify called. userId=${userId}, event=${eventName}`);

  if (userId === 'broadcast') {
    io.emit(eventName, data);
    logger.info(`Broadcast event '${eventName}' to all clients.`);
    return res.status(200).json({ message: 'Đã broadcast.' });
  }

  const receiverSocketId = onlineUsers[userId];
  if (receiverSocketId) {
    io.to(receiverSocketId).emit(eventName, data);
    logger.info(`Realtime event '${eventName}' sent to user ${userId} (${receiverSocketId}).`);
    return res.status(200).json({ message: 'Đã gửi realtime notification.' });
  } else {
    logger.warn(`User ${userId} is offline. Attempting FCM notification.`);
    sendPushNotification(userId, eventName, data); // cháº¡y ngáº§m
    return res.status(200).json({ message: 'User offline, đã gửi push notification.' });
  }
});

// ========== START SERVER ==========
const PORT = process.env.PORT || 3006;
server.listen(PORT, () => {
  logger.info(`Notification Service (HTTP + WS) is running on port ${PORT}`);
});
