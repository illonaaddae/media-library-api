// server.ts — process entry point. Validates env, connects DB, starts the
// HTTP server, and owns process-level handlers (uncaught/unhandled, signals).

// Imported FIRST — installs the uncaughtException handler before any other
// module (env validation, directory creation) can run.
import './src/config/crashHandler';

import { Server } from 'http';
import config from './src/config/env'; // validates env at import time
import app from './src/app';
import { connectDB, disconnectDB } from './src/config/db';

let server: Server | undefined;

async function start(): Promise<void> {
  await connectDB();

  server = app.listen(config.port, () => {
    console.log(`Server listening on port ${config.port} [${config.nodeEnv}]`);
  });
}

// Unhandled promise rejection — close the server gracefully, then exit.
process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION — shutting down');
  console.error(reason);
  if (server) {
    server.close(() => process.exit(1));
  } else {
    process.exit(1);
  }
});

// Graceful shutdown on termination signals: stop accepting connections, then
// disconnect Mongoose.
async function shutdown(signal: string): Promise<void> {
  console.log(`${signal} received — shutting down gracefully`);
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
      console.error(err);
      process.exit(1);
    });
  });
});

start().catch((err) => {
  console.error('Failed to start server');
  console.error(err);
  process.exit(1);
});
