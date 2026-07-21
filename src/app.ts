// app.ts — builds and configures the Express application. No DB connection or
// server.listen here; server.ts owns process lifecycle.
import express from "express";
import pinoHttp from "pino-http";
import logger from "./config/logger";
import mediaRoutes from "./routes/mediaRoutes";
import healthRoute from "./routes/healthRoute";
import notFound from "./middlewares/notFound";
import errorHandler from "./middlewares/errorHandler";

const app = express();

// Structured request logging (info) with sensitive headers redacted by logger.
app.use(pinoHttp({ logger }));

// Parse JSON request bodies. Multipart (file uploads) is handled per-route by
// Multer, not here.
app.use(express.json());

// Health check — no DB dependency.
app.use("/health", healthRoute);

// Media routes.
app.use("/media", mediaRoutes);

// 404 for any unmatched route, then the central error handler — must be last.
app.use(notFound);
app.use(errorHandler);

export default app;
