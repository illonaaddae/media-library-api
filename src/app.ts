// app.ts — builds and configures the Express application. No DB connection or
// server.listen here; server.ts owns process lifecycle.
import express from 'express';
import mediaRoutes from './routes/mediaRoutes';
import notFound from './middlewares/notFound';
import errorHandler from './middlewares/errorHandler';

const app = express();

// Parse JSON request bodies. Multipart (file uploads) is handled per-route by
// Multer, not here.
app.use(express.json());

// Health check.
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'success', data: { uptime: process.uptime() } });
});

// Media routes.
app.use('/media', mediaRoutes);

// 404 for any unmatched route, then the central error handler — must be last.
app.use(notFound);
app.use(errorHandler);

export default app;
