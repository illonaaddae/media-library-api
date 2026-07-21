// Unit test: catchAsync forwards async rejections to Express's next().
import type { Request, Response, NextFunction } from 'express';
import catchAsync from '../../utils/catchAsync';

describe('catchAsync', () => {
  it('forwards a rejected promise to next(error)', async () => {
    const error = new Error('boom');
    const next = jest.fn();

    await catchAsync(async () => {
      throw error;
    })({} as Request, {} as Response, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(error);
  });

  it('does not call next() when the wrapped handler resolves', async () => {
    const next = jest.fn();

    await catchAsync(async () => {
      // resolves without throwing
    })({} as Request, {} as Response, next as unknown as NextFunction);

    expect(next).not.toHaveBeenCalled();
  });
});
