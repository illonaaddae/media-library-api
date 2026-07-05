// controllers/mediaController.js — req/res mapping only. No business logic, no
// Mongoose. Every handler is wrapped in catchAsync so rejections reach the
// central error handler.
const catchAsync = require('../utils/catchAsync');
const { sendSuccess } = require('../utils/apiResponse');
const mediaService = require('../services/mediaService');

// POST /media — Multer has already parsed the file and multipart fields; the
// validated body is in req.body, the file in req.file.
const createMedia = catchAsync(async (req, res) => {
  // Assemble persisted file metadata from Multer's req.file (undefined if no
  // file was sent — the service raises 400 "File is required").
  const fileInfo = req.file
    ? {
        filePath: req.file.path,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
      }
    : null;

  const media = await mediaService.createMedia(fileInfo, req.body);
  return sendSuccess(res, 201, media);
});

// POST /media/bulk — up to 5 files sharing one set of metadata. Multer puts
// the parsed files on req.files.
const createBulkMedia = catchAsync(async (req, res) => {
  const filesInfo = (req.files || []).map((f) => ({
    filePath: f.path,
    originalName: f.originalname,
    mimeType: f.mimetype,
    fileSize: f.size,
  }));

  const media = await mediaService.createManyMedia(filesInfo, req.body);
  return sendSuccess(res, 201, media);
});

// GET /media — validated query lives on req.query.
const listMedia = catchAsync(async (req, res) => {
  const data = await mediaService.listMedia(req.query);
  return sendSuccess(res, 200, data);
});

// GET /media/:id
const getMedia = catchAsync(async (req, res) => {
  const media = await mediaService.getMediaById(req.params.id);
  return sendSuccess(res, 200, media);
});

// PUT/PATCH /media/:id — full or partial metadata update (same service call).
const updateMedia = catchAsync(async (req, res) => {
  const media = await mediaService.updateMedia(req.params.id, req.body);
  return sendSuccess(res, 200, media);
});

// DELETE /media/:id — hard delete by default; ?soft=true marks deletedAt.
const deleteMedia = catchAsync(async (req, res) => {
  const soft = req.query.soft === 'true';
  const media = await mediaService.deleteMedia(req.params.id, { soft });
  return sendSuccess(res, 200, { deleted: media._id, soft });
});

// POST /media/:id/restore
const restoreMedia = catchAsync(async (req, res) => {
  const media = await mediaService.restoreMedia(req.params.id);
  return sendSuccess(res, 200, media);
});

module.exports = {
  createMedia,
  createBulkMedia,
  listMedia,
  getMedia,
  updateMedia,
  deleteMedia,
  restoreMedia,
};
