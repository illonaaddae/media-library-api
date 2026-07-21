// config/crashHandler.ts — registers the uncaughtException handler. Imported
// FIRST in server.ts; importing it also initializes the logger (and therefore
// env validation). A programmer error leaves the process in an unknown state,
// so log at error level and exit immediately.
import logger from './logger';

process.on('uncaughtException', (err) => {
  logger.error({ err }, 'UNCAUGHT EXCEPTION — shutting down');
  process.exit(1);
});
