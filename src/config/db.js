// config/db.js — Mongoose connection helper.
const mongoose = require('mongoose');
const config = require('./env');

// Connect to MongoDB. Rejects on failure so server.js can decide to exit.
async function connectDB() {
  await mongoose.connect(config.dbUri);
  // eslint-disable-next-line no-console
  console.log('MongoDB connected');
  return mongoose.connection;
}

// Cleanly close the connection during graceful shutdown.
async function disconnectDB() {
  await mongoose.disconnect();
}

module.exports = { connectDB, disconnectDB };
