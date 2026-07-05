// server.js — process entry point. Validates env, connects DB, starts the
// HTTP server, and owns process-level handlers (uncaught/unhandled, signals).

// Register uncaughtException handler before anything else — a programmer error
// leaves the process in an unknown state, so exit immediately.
process.on('uncaughtException', (err) => {
  // eslint-disable-next-line no-console
  console.error('UNCAUGHT EXCEPTION — shutting down');
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

const config = require('./src/config/env'); // validates env at require time
const app = require('./src/app');
const { connectDB, disconnectDB } = require('./src/config/db');

let server;

async function start() {
  await connectDB();

  server = app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening on port ${config.port} [${config.nodeEnv}]`);
  });
}

// Unhandled promise rejection — close the server gracefully, then exit.
process.on('unhandledRejection', (reason) => {
  // eslint-disable-next-line no-console
  console.error('UNHANDLED REJECTION — shutting down');
  // eslint-disable-next-line no-console
  console.error(reason);
  if (server) {
    server.close(() => process.exit(1));
  } else {
    process.exit(1);
  }
});

// Graceful shutdown on termination signals: stop accepting connections, then
// disconnect Mongoose.
async function shutdown(signal) {
  // eslint-disable-next-line no-console
  console.log(`${signal} received — shutting down gracefully`);
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await disconnectDB();
  process.exit(0);
}

['SIGTERM', 'SIGINT'].forEach((signal) => {
  process.on(signal, () => {
    shutdown(signal).catch((err) => {
      // eslint-disable-next-line no-console
      console.error(err);
      process.exit(1);
    });
  });
});

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server');
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
