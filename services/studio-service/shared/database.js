const mysql = require('mysql2/promise');

const createPool = (databaseEnvName, overrides = {}) => {
    const database = process.env[databaseEnvName];

    if (!database) {
        throw new Error(`Missing required database environment variable: ${databaseEnvName}`);
    }

    return mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database,
        charset: 'utf8mb4',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        ...overrides
    });
};

module.exports = {
    createPool
};
