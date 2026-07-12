// middlewares/errorHandler.ts — central error handler. Registered LAST in
// app.ts. Translates known error types into the standard error envelope:
//   { status: "error", message, details? }
import { ErrorRequestHandler } from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import AppError, { ErrorDetail } from '../utils/AppError';
import config from '../config/env';

// Friendly messages for Multer's error codes.
function multerMessage(err: multer.MulterError): string {
  switch (err.code) {
    case 'LIMIT_FILE_SIZE':
      return 'File too large — max 5MB';
    case 'LIMIT_FILE_COUNT':
      return 'Too many files uploaded';
    case 'LIMIT_UNEXPECTED_FILE':
      return `Unexpected file field: ${err.field}`;
    default:
      return err.message || 'File upload error';
  }
}

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  let statusCode = 500;
  let message = 'Internal server error';
  let details: ErrorDetail[] | undefined;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    details = err.details;
  } else if (err instanceof multer.MulterError) {
    statusCode = 400;
    message = multerMessage(err);
  } else if (err instanceof mongoose.Error.ValidationError) {
    statusCode = 400;
    message = 'Validation failed';
    details = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
  } else if (err instanceof mongoose.Error.CastError) {
    statusCode = 400;
    message = `Invalid value for ${err.path}`;
  }

  // Always log the full error server-side for diagnosis.
  if (statusCode >= 500) {
    console.error(err);
  }

  const body: {
    status: 'error';
    message: string;
    details?: ErrorDetail[];
    stack?: string;
  } = { status: 'error', message };
  if (details && details.length) body.details = details;
  // Never leak stack traces in production; expose them otherwise for debugging.
  if (!config.isProduction && statusCode >= 500 && err instanceof Error) {
    body.stack = err.stack;
  }

  res.status(statusCode).json(body);
};

export default errorHandler;
