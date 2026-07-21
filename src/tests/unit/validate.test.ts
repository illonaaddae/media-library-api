// Unit test: the validate() middleware factory. Called directly with fake
// req/res/next — no HTTP stack, so these are unit tests.
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import validate from '../../middlewares/validate';
import AppError from '../../utils/AppError';

describe('validate middleware', () => {
  it('calls next() and replaces req[source] with parsed/coerced data on valid input', () => {
    const schema = z.object({ count: z.coerce.number() });
    const req = { body: { count: '5' } } as unknown as Request;
    const next = jest.fn();

    validate(schema)(req, {} as Response, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(); // next() with no error argument
    expect(req.body).toEqual({ count: 5 }); // coerced from string to number
  });

  it('forwards a 400 AppError with field-level details on invalid input', () => {
    const schema = z.object({ title: z.string() });
    const req = { body: {} } as unknown as Request;
    const next = jest.fn();

    validate(schema)(req, {} as Response, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe('Validation failed');
    expect(err.details).toEqual([{ field: 'title', message: expect.any(String) }]);
  });

  it('validates the requested source (query) rather than body', () => {
    const schema = z.object({ q: z.string() });
    const req = { query: { q: 'hello' } } as unknown as Request;
    const next = jest.fn();

    validate(schema, 'query')(req, {} as Response, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledWith();
    expect(req.query).toEqual({ q: 'hello' });
  });
});
