// utils/AppError.ts — operational error carrying an HTTP status code and
// optional field-level details. Thrown by services/middlewares, handled by the
// central errorHandler.

// One field-level validation detail in an error envelope.
export interface ErrorDetail {
  field: string;
  message: string;
}

class AppError extends Error {
  statusCode: number;
  status: string;
  isOperational: boolean;
  details?: ErrorDetail[];

  constructor(statusCode: number, message: string, details?: ErrorDetail[]) {
    super(message);
    this.statusCode = statusCode;
    this.status = 'error';
    this.isOperational = true; // distinguishes expected errors from bugs
    if (details) this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export default AppError;
