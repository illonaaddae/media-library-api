// middlewares/notFound.js — catch-all for unmatched routes. Forwards a 404
// AppError naming the actual requested URL.
const AppError = require('../utils/AppError');

function notFound(req, res, next) {
  next(new AppError(404, `Route ${req.originalUrl} not found`));
}

module.exports = notFound;
