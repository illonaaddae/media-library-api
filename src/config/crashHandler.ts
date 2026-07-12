// config/crashHandler.ts — registers the uncaughtException handler. Imported
// FIRST in server.ts so it is installed before any other module runs (env
// validation, directory creation, etc.). A programmer error leaves the process
// in an unknown state, so exit immediately.
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION — shutting down');
  console.error(err);
  process.exit(1);
});
