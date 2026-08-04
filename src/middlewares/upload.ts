// middlewares/upload.ts — Multer in-memory upload config for media.
// Restricts by MIME type and size; keeps the file in memory (req.file.buffer)
// so the service can persist it via the storage module (Vercel Blob in
// production, disk locally). Rejections surface as AppError(400).
import multer from "multer";
import config from "../config/env";
import AppError from "../utils/AppError";

const ALLOWED_MIME = new Set([
  // images
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  // documents
  "application/pdf",
  "application/msword", // .doc
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  // video
  "video/mp4",
  "video/webm",
  "video/quicktime", // .mov
  // audio
  "audio/mpeg", // .mp3
  "audio/wav",
  "audio/ogg",
]);

// Keep the uploaded file in memory; the storage module owns naming and
// persistence (Blob or disk). This keeps uploads working on Vercel's read-only
// filesystem without touching /tmp at this layer.
const storage = multer.memoryStorage();

// Allow only the whitelisted MIME types; reject anything else with a 400.
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
