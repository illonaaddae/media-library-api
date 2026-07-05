// utils/catchAsync.js — wraps an async controller so any rejected promise is
// forwarded to Express's error pipeline (next) instead of crashing the process.
const catchAsync = (fn) => (req, res, next) => fn(req, res, next).catch(next);

module.exports = catchAsync;
