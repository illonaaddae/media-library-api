// utils/AppError.js — operational error carrying an HTTP status code and
// optional field-level details. Thrown by services/middlewares, handled by the
// central errorHandler.
class AppError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.status = 'error';
    this.isOperational = true; // distinguishes expected errors from bugs
    if (details) this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
