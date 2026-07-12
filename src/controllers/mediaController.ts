// controllers/mediaController.ts — req/res mapping only. No business logic, no
// Mongoose. Every handler is wrapped in catchAsync so rejections reach the
// central error handler.
import catchAsync from '../utils/catchAsync';
import { sendSuccess } from '../utils/apiResponse';
import mediaService, { FileInfo } from '../services/mediaService';
import { MediaQuery } from '../schemas/mediaSchemas';

// POST /media — Multer has already parsed the file and multipart fields; the
// validated body is in req.body, the file in req.file.
export const createMedia = catchAsync(async (req, res) => {
  // Assemble persisted file metadata from Multer's req.file (undefined if no
  // file was sent — the service raises 400 "File is required").
  const fileInfo: FileInfo | null = req.file
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
export const createBulkMedia = catchAsync(async (req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const filesInfo: FileInfo[] = files.map((f) => ({
    filePath: f.path,
    originalName: f.originalname,
    mimeType: f.mimetype,
    fileSize: f.size,
  }));

  const media = await mediaService.createManyMedia(filesInfo, req.body);
  return sendSuccess(res, 201, media);
});

// GET /media — validated query lives on req.query.
export const listMedia = catchAsync(async (req, res) => {
  // validate() has already replaced req.query with the parsed, typed value.
  const data = await mediaService.listMedia(req.query as unknown as MediaQuery);
  return sendSuccess(res, 200, data);
});

// GET /media/:id
export const getMedia = catchAsync(async (req, res) => {
  const media = await mediaService.getMediaById(req.params.id as string);
  return sendSuccess(res, 200, media);
});

// PUT/PATCH /media/:id — full or partial metadata update (same service call).
export const updateMedia = catchAsync(async (req, res) => {
  const media = await mediaService.updateMedia(req.params.id as string, req.body);
  return sendSuccess(res, 200, media);
});

// DELETE /media/:id — hard delete by default; ?soft=true marks deletedAt.
export const deleteMedia = catchAsync(async (req, res) => {
  const soft = req.query.soft === 'true';
  const media = await mediaService.deleteMedia(req.params.id as string, { soft });
  return sendSuccess(res, 200, { deleted: media._id, soft });
});

// POST /media/:id/restore
export const restoreMedia = catchAsync(async (req, res) => {
  const media = await mediaService.restoreMedia(req.params.id as string);
  return sendSuccess(res, 200, media);
});

export default {
  createMedia,
  createBulkMedia,
  listMedia,
  getMedia,
  updateMedia,
  deleteMedia,
  restoreMedia,
};
