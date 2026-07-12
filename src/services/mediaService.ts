// services/mediaService.ts — the ONLY layer with business logic. Never touches
// req/res; calls the repository and throws AppError. Owns file-system side
// effects (unlinking uploaded files) since those are business rules, not data
// access.
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import sharp from 'sharp';
import { QueryFilter, SortOrder } from 'mongoose';
import mediaRepository from '../repositories/mediaRepository';
import AppError from '../utils/AppError';
import config from '../config/env';
import { IMedia, MediaDocument } from '../models/Media';
import { CreateMediaInput, UpdateMediaInput, MediaQuery } from '../schemas/mediaSchemas';

// File metadata assembled by the controller from Multer's req.file / req.files.
export interface FileInfo {
  filePath: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
}

// Thumbnails live under uploads/thumbnails/. Ensure it exists at startup.
const THUMBNAIL_DIR = path.join(config.uploadDir, 'thumbnails');
fsSync.mkdirSync(THUMBNAIL_DIR, { recursive: true });

const THUMBNAIL_WIDTH = 200;

// Generate a 200px-wide thumbnail for image uploads only. A failure here must
// never fail the upload — log and fall back to a null thumbnailPath. Returns
// the thumbnail path, or null for non-images / on error.
async function generateThumbnail(fileInfo: FileInfo): Promise<string | null> {
  if (!fileInfo || !fileInfo.mimeType || !fileInfo.mimeType.startsWith('image/')) {
    return null; // PDFs and non-images get no thumbnail
  }
  const thumbPath = path.join(THUMBNAIL_DIR, path.basename(fileInfo.filePath));
  try {
    await sharp(fileInfo.filePath).resize({ width: THUMBNAIL_WIDTH }).toFile(thumbPath);
    return thumbPath;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`Thumbnail generation failed for "${fileInfo.filePath}": ${message}`);
    return null;
  }
}

// Best-effort file removal: a missing file must not fail the request — log and
// continue so DELETE still removes the DB record. Never throws (never 500s).
async function safeUnlink(filePath: string | null | undefined): Promise<void> {
  if (!filePath) return;
  try {
    await fs.unlink(filePath);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`Could not delete file "${filePath}": ${message}`);
  }
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
  const thumbnailPath = await generateThumbnail(fileInfo);
  return mediaRepository.create({ ...metadata, ...fileInfo, thumbnailPath });
}

// Bulk create: shared metadata applies to every file. Thumbnails for all
// images are generated concurrently, then all records are inserted at once.
async function createManyMedia(
  filesInfo: FileInfo[],
  metadata: CreateMediaInput
): Promise<MediaDocument[]> {
  if (!filesInfo || filesInfo.length === 0) {
    throw new AppError(400, 'At least one file is required');
  }
  const thumbnails = await Promise.all(filesInfo.map(generateThumbnail));
  const docs: Partial<IMedia>[] = filesInfo.map((fileInfo, i) => ({
    ...metadata,
    ...fileInfo,
    thumbnailPath: thumbnails[i],
  }));
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
    safeUnlink(existing.filePath),
    safeUnlink(existing.thumbnailPath),
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
