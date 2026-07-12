// utils/catchAsync.ts — wraps an async controller so any rejected promise is
// forwarded to Express's error pipeline (next) instead of crashing the process.
import { Request, Response, NextFunction, RequestHandler } from 'express';

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

const catchAsync =
  (fn: AsyncHandler): RequestHandler =>
  (req, res, next) =>
    fn(req, res, next).catch(next);

export default catchAsync;
