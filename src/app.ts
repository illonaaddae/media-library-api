// app.ts — builds and configures the Express application. No DB connection or
// server.listen here; server.ts owns process lifecycle.
import path from "path";
import express from "express";
import pinoHttp from "pino-http";
import config from "./config/env";
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

// Static frontend (served same-origin so the UI needs no CORS). In production
// on Vercel the UI is served by the CDN via vercel.json; this covers local dev.
app.use(express.static(path.join(__dirname, "..", "public")));
// Serve uploaded files + thumbnails so the UI can render them. On Vercel these
// live in the ephemeral /tmp and won't persist — the UI falls back to an icon.
app.use("/uploads", express.static(config.uploadDir));

// Health check — no DB dependency.
app.use("/health", healthRoute);

// Media routes.
app.use("/media", mediaRoutes);

// 404 for any unmatched route, then the central error handler — must be last.
app.use(notFound);
app.use(errorHandler);

export default app;
