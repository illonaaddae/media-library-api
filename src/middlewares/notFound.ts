// middlewares/notFound.ts — catch-all for unmatched routes. Forwards a 404
// AppError naming the actual requested URL.
import { RequestHandler } from 'express';
import AppError from '../utils/AppError';

const notFound: RequestHandler = (req, _res, next) => {
  next(new AppError(404, `Route ${req.originalUrl} not found`));
};

export default notFound;
