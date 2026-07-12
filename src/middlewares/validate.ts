// middlewares/validate.ts — reusable validation factory.
// validate(schema, source) parses req[source] with a Zod schema, replaces it
// with the parsed (coerced/transformed) value, and on failure forwards a 400
// AppError carrying field-level details.
import { RequestHandler } from 'express';
import { ZodType } from 'zod';
import AppError, { ErrorDetail } from '../utils/AppError';

type Source = 'body' | 'query' | 'params';

function validate(schema: ZodType, source: Source = 'body'): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const details: ErrorDetail[] = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || source,
        message: issue.message,
      }));
      return next(new AppError(400, 'Validation failed', details));
    }

    // Replace with the parsed value so controllers see coerced types /
    // transformed tags / applied defaults. Use defineProperty because in
    // Express 5 req.query is a getter-only property — plain assignment is
    // silently ignored, leaving controllers with the raw, unparsed value.
    Object.defineProperty(req, source, {
      value: result.data,
      writable: true,
      configurable: true,
      enumerable: true,
    });
    return next();
  };
}

export default validate;
