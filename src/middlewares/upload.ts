// middlewares/upload.ts — Multer disk storage config for media uploads.
// Restricts by MIME type and size; produces collision-resistant, sanitized
// filenames. Rejections surface as AppError(400) via the error handler.
import fs from "fs";
import path from "path";
import crypto from "crypto";
import multer from "multer";
import config from "../config/env";
import AppError from "../utils/AppError";

// Ensure the upload directory exists before Multer writes to it.
fs.mkdirSync(config.uploadDir, { recursive: true });

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "application/pdf"]);

// Strip path separators and unsafe characters from an original filename.
// Never trust the client-supplied name — collapse it to a safe basename.
function sanitizeFilename(original: string): string {
  const base = path.basename(original || "file"); // drop any directory parts
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100) || "file";
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    // config.uploadDir resolves to /tmp/uploads on Vercel (read-only fs except
    // /tmp) and the configured UPLOAD_DIR everywhere else — see config/env.ts.
    cb(null, config.uploadDir);
  },
  filename: (_req, file, cb) => {
    const timestamp = Date.now();
    const random = crypto.randomBytes(6).toString("hex");
    cb(null, `${timestamp}-${random}-${sanitizeFilename(file.originalname)}`);
  },
});

// Allow only jpeg/png/pdf by MIME type; reject anything else with a 400.
function fileFilter(
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
): void {
  if (ALLOWED_MIME.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError(400, `Unsupported file type: ${file.mimetype}`));
  }
}

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: config.maxFileSize },
});

// Single-file upload for POST /media.
export const uploadSingle = upload.single("file");
// Multi-file upload (max 5) for POST /media/bulk.
export const uploadArray = upload.array("files", 5);
