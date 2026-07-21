// config/logger.ts — application-wide Pino logger.
// Level comes from config.logLevel. In development we pipe through pino-pretty
// for human-readable output; production (and test) emit raw JSON. Sensitive
// request headers are redacted.
import pino from 'pino';
import config from './env';

const logger = pino({
  level: config.logLevel,
  // Never log credentials, even if a request carries them.
  redact: ['req.headers.authorization'],
  // pino-pretty runs in a worker thread — enable it in development ONLY, so
  // production stays raw JSON and tests don't spawn an extra handle.
  transport:
    config.nodeEnv === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
});

export default logger;
