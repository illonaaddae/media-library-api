// services/storage.ts — file persistence abstraction.
//
// Production (Vercel) has no durable filesystem, so uploaded bytes go to Vercel
// Blob and we keep the returned public URL. Local dev and tests have no Blob
// token, so they fall back to disk under UPLOAD_DIR and serve via /uploads.
// Either way callers store the returned reference (a full https URL or a
// /uploads/... path) directly in Mongo and hand it straight to an <img src>.
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { put, del } from '@vercel/blob';
import config from '../config/env';
import logger from '../config/logger';

// Use Vercel Blob when a store is linked to the project. Vercel injects either a
// classic read/write token (BLOB_READ_WRITE_TOKEN) or, with OIDC auth, a store
// id (BLOB_STORE_ID) plus a runtime VERCEL_OIDC_TOKEN. The @vercel/blob SDK
// resolves whichever is present automatically, so we just detect either. Absent
// locally, so dev/tests fall back to disk.
const useBlob = !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);

// Collapse a client-supplied name to a safe basename fragment.
function sanitize(original: string): string {
  const base = path.basename(original || 'file');
  return base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100) || 'file';
}

// Persist a buffer and return a servable reference. `subdir` groups files
// (e.g. 'thumbnails'); the reference is a Blob URL in production, a /uploads
// path in disk mode.
export async function saveFile(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
  subdir = ''
): Promise<string> {
  const filename = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}-${sanitize(originalName)}`;
  const key = subdir ? `${subdir}/${filename}` : filename;

  if (useBlob) {
    const blob = await put(`media/${key}`, buffer, {
      access: 'public',
      contentType: mimeType,
    });
    return blob.url;
  }

  const dir = path.join(config.uploadDir, subdir);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, filename), buffer);
  // Web path served by express.static mounted at /uploads (see app.ts).
  return subdir ? `/uploads/${subdir}/${filename}` : `/uploads/${filename}`;
}

// Best-effort removal of a stored reference. A missing file must never fail the
// request (DELETE still removes the DB record), so this never throws.
export async function deleteFile(ref: string | null | undefined): Promise<void> {
  if (!ref) return;
  try {
    if (/^https?:\/\//.test(ref)) {
      await del(ref);
    } else if (ref.startsWith('/uploads/')) {
      await fs.unlink(path.join(config.uploadDir, ref.replace(/^\/uploads\//, '')));
    } else {
      // Legacy absolute/relative disk path from older records.
      await fs.unlink(ref);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn(`Could not delete stored file "${ref}": ${message}`);
  }
}
