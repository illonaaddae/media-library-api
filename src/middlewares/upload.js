// middlewares/upload.js — Multer disk storage config for media uploads.
// Restricts by MIME type and size; produces collision-resistant, sanitized
// filenames. Rejections surface as AppError(400) via the error handler.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const config = require('../config/env');
const AppError = require('../utils/AppError');

// Ensure the upload directory exists before Multer writes to it.
fs.mkdirSync(config.uploadDir, { recursive: true });

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'application/pdf']);

// Strip path separators and unsafe characters from an original filename.
// Never trust the client-supplied name — collapse it to a safe basename.
function sanitizeFilename(original) {
  const base = path.basename(original || 'file'); // drop any directory parts
  return base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100) || 'file';
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.uploadDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const random = crypto.randomBytes(6).toString('hex');
    cb(null, `${timestamp}-${random}-${sanitizeFilename(file.originalname)}`);
  },
});

// Allow only jpeg/png/pdf by MIME type; reject anything else with a 400.
function fileFilter(req, file, cb) {
  if (ALLOWED_MIME.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError(400, `Unsupported file type: ${file.mimetype}`));
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: config.maxFileSize },
});

module.exports = {
  upload,
  // Single-file upload for POST /media.
  uploadSingle: upload.single('file'),
  // Multi-file upload (max 5) for POST /media/bulk.
  uploadArray: upload.array('files', 5),
};
