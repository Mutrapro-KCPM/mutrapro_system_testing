// shared/middleware/errorHandler.js
const { logger } = require('../logger');

class AppError extends Error {
  constructor(message, statusCode, errors = []) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

const errorHandler = (err, req, res, next) => {

  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';

  if (err.code === 'ER_DUP_ENTRY') {
    statusCode = 409;
    message = 'Resource already exists.';
  }

  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token is invalid or expired. Please log in again.';
  }

  const logContext = {
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      statusCode
  };

  if (statusCode >= 500) {
    logger.error(message, { ...logContext, stack: err.stack });
  } else {
    logger.warn('Client request rejected', logContext);
  }
  const errors = err.errors || [];

  res.status(statusCode).json({
    success: false,
    message,
    error: message,
    errors,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const notFound = (req, res, next) => {
  const error = new AppError(`Route not found - ${req.originalUrl}`, 404);
  next(error);
};

module.exports = {
  AppError,
  errorHandler,
  asyncHandler,
  notFound
};

