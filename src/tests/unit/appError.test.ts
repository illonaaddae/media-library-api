// Unit test: AppError carries the fields the error handler relies on.
import AppError from '../../utils/AppError';

describe('AppError', () => {
  it('captures message, statusCode, status, isOperational, and details', () => {
    const details = [{ field: 'title', message: 'title is required' }];
    const err = new AppError(400, 'Validation failed', details);

    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('Validation failed');
    expect(err.statusCode).toBe(400);
    expect(err.status).toBe('error');
    expect(err.isOperational).toBe(true);
    expect(err.details).toEqual(details);
  });

  it('leaves details undefined when none are provided', () => {
    const err = new AppError(404, 'Not found');

    expect(err.details).toBeUndefined();
    expect(err.statusCode).toBe(404);
    expect(err.status).toBe('error');
    expect(err.isOperational).toBe(true);
  });
});
