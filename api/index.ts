// api/index.ts — Vercel serverless entry point.
//
// Unlike server.ts (the long-lived local process), Vercel runs the app as a
// serverless function with no persistent `listen`. Each request may hit a cold
// or warm instance, so we must NOT reconnect to Mongo per request: we cache the
// connection promise at module scope and reuse it across warm invocations.
import mongoose from 'mongoose';
import type { IncomingMessage, ServerResponse } from 'http';
import config from '../src/config/env';
import app from '../src/app';

// Cached across warm invocations. A cold start creates the connection once;
// subsequent requests on the same instance await the already-resolved promise
// instead of opening a new connection.
let connectionPromise: Promise<typeof mongoose> | null = null;

function connectToDatabase(): Promise<typeof mongoose> {
  if (!connectionPromise) {
    connectionPromise = mongoose.connect(config.databaseUrl);
  }
  return connectionPromise;
}

// Ensure the DB connection exists, then hand the request to the Express app.
export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  await connectToDatabase();
  app(req, res);
}
