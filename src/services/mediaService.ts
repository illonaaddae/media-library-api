// services/mediaService.ts — the ONLY layer with business logic. Never touches
// req/res; calls the repository and throws AppError. Owns storage side effects
// (persisting and removing files) since those are business rules, not data
// access.
import sharp from 'sharp';
import { QueryFilter, SortOrder } from 'mongoose';
import mediaRepository from '../repositories/mediaRepository';
import AppError from '../utils/AppError';
import logger from '../config/logger';
import { saveFile, deleteFile } from './storage';
import { IMedia, MediaDocument } from '../models/Media';
import { CreateMediaInput, UpdateMediaInput, MediaQuery } from '../schemas/mediaSchemas';

// File payload assembled by the controller from Multer's in-memory req.file /
// req.files. The buffer is persisted by the storage module; it is never stored
// on the document.
export interface FileInfo {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  fileSize: number;
}

// Metadata persisted on the document once the bytes are stored.
interface StoredFileMeta {
  filePath: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  thumbnailPath: string | null;
}

const THUMBNAIL_WIDTH = 200;

// Generate and store a 200px-wide thumbnail for image uploads only. A failure
// here must never fail the upload — log and fall back to a null thumbnail.
// Returns the stored thumbnail reference, or null for non-images / on error.
async function generateThumbnail(fileInfo: FileInfo): Promise<string | null> {
  if (!fileInfo.mimeType || !fileInfo.mimeType.startsWith('image/')) {
    return null; // PDFs, video, audio, and other non-images get no thumbnail
  }
  try {
    const thumb = await sharp(fileInfo.buffer).resize({ width: THUMBNAIL_WIDTH }).toBuffer();
    return await saveFile(thumb, fileInfo.originalName, fileInfo.mimeType, 'thumbnails');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn(`Thumbnail generation failed for "${fileInfo.originalName}": ${message}`);
    return null;
  }
}

// Persist one file (bytes + optional thumbnail) and return the document
// metadata. Thumbnail generation runs alongside the main store.
async function storeFile(fileInfo: FileInfo): Promise<StoredFileMeta> {
  const [filePath, thumbnailPath] = await Promise.all([
    saveFile(fileInfo.buffer, fileInfo.originalName, fileInfo.mimeType),
    generateThumbnail(fileInfo),
  ]);
  return {
    filePath,
    originalName: fileInfo.originalName,
    mimeType: fileInfo.mimeType,
    fileSize: fileInfo.fileSize,
    thumbnailPath,
  };
}

// Create one media record. fileInfo is assembled by the controller from
// req.file; metadata is the validated body (title, tags, category).
async function createMedia(
  fileInfo: FileInfo | null,
  metadata: CreateMediaInput
): Promise<MediaDocument> {
  if (!fileInfo) {
    throw new AppError(400, 'File is required');
  }
  const stored = await storeFile(fileInfo);
  const media = await mediaRepository.create({ ...metadata, ...stored });
  logger.info(
    { filename: fileInfo.originalName, size: fileInfo.fileSize },
    'File uploaded'
  );
  return media;
}

// Bulk create: shared metadata applies to every file. Files are stored (bytes +
// thumbnails) concurrently, then all records are inserted at once.
async function createManyMedia(
  filesInfo: FileInfo[],
  metadata: CreateMediaInput
): Promise<MediaDocument[]> {
  if (!filesInfo || filesInfo.length === 0) {
    throw new AppError(400, 'At least one file is required');
  }
  const stored = await Promise.all(filesInfo.map(storeFile));
  const docs: Partial<IMedia>[] = stored.map((meta) => ({ ...metadata, ...meta }));
  return mediaRepository.insertMany(docs);
}

async function getMediaById(id: string): Promise<MediaDocument> {
  const media = await mediaRepository.findById(id);
  if (!media) {
    throw new AppError(404, `Media with id ${id} not found`);
  }
  return media;
}

async function updateMedia(id: string, updates: UpdateMediaInput): Promise<MediaDocument> {
  // Existence check first so a missing record is a clean 404, not a silent
  // no-op update.
  const existing = await mediaRepository.findById(id);
  if (!existing) {
    throw new AppError(404, `Media with id ${id} not found`);
  }
  const updated = await mediaRepository.updateById(id, updates);
  if (!updated) {
    throw new AppError(404, `Media with id ${id} not found`);
  }
  return updated;
}

// Default: HARD delete (record + file + thumbnail) — the brief requires DELETE
// to remove the item and its file. soft=true keeps the file and just marks
// deletedAt.
async function deleteMedia(
  id: string,
  { soft = false }: { soft?: boolean } = {}
): Promise<MediaDocument> {
  if (soft) {
    const softDeleted = await mediaRepository.softDeleteById(id);
    if (!softDeleted) {
      throw new AppError(404, `Media with id ${id} not found`);
    }
    return softDeleted;
  }

  // Fetch the record (including already-soft-deleted ones) so we know which
  // files to unlink before removing it.
  const existing = await mediaRepository.findById(id, { includeDeleted: true });
  if (!existing) {
    throw new AppError(404, `Media with id ${id} not found`);
  }

  await mediaRepository.hardDeleteById(id);
  await Promise.all([
    deleteFile(existing.filePath),
    deleteFile(existing.thumbnailPath),
  ]);

  return existing;
}

async function restoreMedia(id: string): Promise<MediaDocument> {
  const restored = await mediaRepository.restoreById(id);
  if (!restored) {
    throw new AppError(404, `Media with id ${id} not found or not deleted`);
  }
  return restored;
}

export interface PaginatedMedia {
  results: MediaDocument[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// List with filtering, search, sorting, and pagination.
async function listMedia(query: MediaQuery): Promise<PaginatedMedia> {
  const { page, limit, category, tags, search, sortBy, order, includeDeleted } = query;

  const filter: QueryFilter<IMedia> = {};
  if (category) filter.category = category; // exact match
  if (tags && tags.length) filter.tags = { $in: tags };
  if (search) filter.$text = { $search: search }; // full-text on title index

  const sort: Record<string, SortOrder> = { [sortBy]: order === 'asc' ? 1 : -1 };
  const skip = (page - 1) * limit;
  const options = { skip, limit, sort, includeDeleted: !!includeDeleted };

  // Fetch the page and the total count concurrently.
  const [results, total] = await Promise.all([
    mediaRepository.findAll(filter, options),
    mediaRepository.count(filter, { includeDeleted: !!includeDeleted }),
  ]);

  return {
    results,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export default {
  createMedia,
  createManyMedia,
  getMediaById,
  updateMedia,
  deleteMedia,
  restoreMedia,
  listMedia,
};
