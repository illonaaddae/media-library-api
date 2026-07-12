// utils/apiResponse.ts — consistent success envelope helper.
// Always emits { status: "success", data }. Errors go through errorHandler.
import { Response } from 'express';

export function sendSuccess(res: Response, statusCode: number, data: unknown): Response {
  return res.status(statusCode).json({ status: 'success', data });
}
