// config/db.ts — Mongoose connection helper.
import mongoose, { Connection } from 'mongoose';
import config from './env';

// Connect to MongoDB. Rejects on failure so server.ts can decide to exit.
export async function connectDB(): Promise<Connection> {
  await mongoose.connect(config.dbUri);
  console.log('MongoDB connected');
  return mongoose.connection;
}

// Cleanly close the connection during graceful shutdown.
export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
}
