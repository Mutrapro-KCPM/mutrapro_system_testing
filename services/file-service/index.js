const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
require('dotenv').config({ path: '../.env', quiet: true });

const { logger } = require('./shared/logger');
const { notFound, errorHandler } = require('./shared/middleware/errorHandler');
const { responseHandler } = require('./shared/middleware/responseHandler');
const { createFileController } = require('./controllers/fileController');

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(express.json());
app.use(responseHandler);

app.get('/health', (req, res) => {
    res.status(200).json({
        service: 'file-service',
        status: 'ok',
        timestamp: new Date().toISOString()
    });
});

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_FILE_NAME,
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

app.use('/', createFileController({ pool, logger }));

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 3004;
if (require.main === module) {
    app.listen(PORT, () => {
        logger.info(`File Service is running on port ${PORT}`);
    });
}

module.exports = app;

