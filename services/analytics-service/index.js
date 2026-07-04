const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
require('dotenv').config({ path: '../.env', quiet: true });

// Sá»­a Ä‘Æ°á»ng dáº«n require cho Ä‘Ăºng
const  { logger } = require('./shared/logger');
const  { asyncHandler, notFound, errorHandler, AppError } = require('./shared/middleware/errorHandler');
const { authMiddleware, checkRole } = require('./shared/middleware/auth');
const { responseHandler } = require('./shared/middleware/responseHandler');

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(express.json());
app.use(responseHandler);

// đŸ”¹ Health check route
app.get('/health', (req, res) => {
  res.status(200).json({
    service: 'analytics-service',
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Káº¿t ná»‘i CSDL Má»I (analytics)
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_ANALYTICS_NAME, // <-- Äá»c tá»« CSDL bĂ¡o cĂ¡o
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};
const pool = mysql.createPool(dbConfig);

// API duy nháº¥t: Láº¥y bĂ¡o cĂ¡o Ä‘Ă£ Ä‘Æ°á»£c NiFi chuáº©n bá»‹
// API nĂ y SIĂU NHáº¸, chá»‰ lĂ  1 cĂ¢u SELECT Ä‘Æ¡n giáº£n
const getDashboardStats = asyncHandler(async (req, res) => {
  const [rows] = await pool.execute(
    "SELECT json_value FROM report_dashboard WHERE report_name = 'dashboard_stats'"
  );

  if (rows.length === 0) {
    // Tráº£ vá» dá»¯ liá»‡u rá»—ng náº¿u NiFi chÆ°a cháº¡y
    return res.success({ message: 'Report loaded.', data: {"totalRevenue": 0, "totalOrders": 0, "orderStats": []} });
  }

  // Tráº£ vá» JSON Ä‘Ă£ Ä‘Æ°á»£c NiFi tĂ­nh toĂ¡n vĂ  lÆ°u trá»¯
  res.success({ message: 'Report loaded.', data: rows[0].json_value });
});

app.get('/stats', authMiddleware, checkRole('admin', 'coordinator'), getDashboardStats);
app.get('/reports/overview', authMiddleware, checkRole('admin', 'coordinator'), getDashboardStats);

// --- Middleware xá»­ lĂ½ cuá»‘i cĂ¹ng ---
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 3008; // (Port má»›i)
if (require.main === module) {
  app.listen(PORT, () => {
    logger.info(`Analytics Service is running on port ${PORT}`);
  });
}
module.exports = app;

