// server.ts — process entry point. Validates env, connects DB, starts the
// HTTP server, and owns process-level handlers (uncaught/unhandled, signals).

// Imported FIRST — installs the uncaughtException handler before any other
// module (env validation, directory creation) can run.
import './src/config/crashHandler';

import { Server } from 'http';
import config from './src/config/env'; // validates env at import time
import logger from './src/config/logger';
import app from './src/app';
import { connectDB, disconnectDB } from './src/config/db';

let server: Server | undefined;

async function start(): Promise<void> {
  await connectDB();

  server = app.listen(config.port, () => {
    logger.info(`Server listening on port ${config.port} [${config.nodeEnv}]`);
  });
}

// Unhandled promise rejection — close the server gracefully, then exit.
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'UNHANDLED REJECTION — shutting down');
  if (server) {
    server.close(() => process.exit(1));
  } else {
    process.exit(1);
  }
});

// Graceful shutdown on termination signals: stop accepting connections, then
// disconnect Mongoose.
async function shutdown(signal: string): Promise<void> {
  logger.info(`${signal} received — shutting down gracefully`);
  if (server) {
    await new Promise<void>((resolve) => {
      server!.close(() => resolve());
    });
  }
  await disconnectDB();
  process.exit(0);
}

(['SIGTERM', 'SIGINT'] as const).forEach((signal) => {
  process.on(signal, () => {
    shutdown(signal).catch((err) => {
      logger.error({ err }, 'Error during graceful shutdown');
      process.exit(1);
    });
  });
});

start().catch((err) => {
  logger.error({ err }, 'Failed to start server');
  process.exit(1);
});
