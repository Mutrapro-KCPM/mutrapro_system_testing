//File này sẽ quản lý việc ghi log cho tất cả các service.
// shared/logger.js
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: process.env.SERVICE_NAME || 'unknown-service' },
  transports: [
    // Ghi tất cả log có level 'error' trở lên vào file error.log
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error'
    }),
    // Ghi tất cả log vào file combined.log
    new winston.transports.File({
      filename: 'logs/combined.log'
    })
  ]
});

// Nếu không phải môi trường production thì log ra cả console
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

module.exports = { logger };