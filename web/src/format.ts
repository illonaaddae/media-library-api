import type { Category, Media } from './types';

export const CAT_ICON: Record<Category, string> = {
  image: '🖼️',
  document: '📄',
  video: '🎞️',
  audio: '🎵',
  other: '📦',
};

const baseName = (p: string): string => p.split(/[\\/]/).pop() ?? '';

// Normalize a stored reference into a browser-usable URL. Handles absolute Blob
// URLs (used as-is), /uploads web paths (used as-is), and legacy disk paths
// (reduced to their basename under /uploads).
function toUrl(ref: string): string {
  if (/^https?:\/\//.test(ref)) return ref;
  if (ref.startsWith('/uploads/')) return ref;
  return `/uploads/${baseName(ref)}`;
}

// The full uploaded file's URL (used for the "view" action / opening originals).
export function fileUrl(m: Media): string {
  return toUrl(m.filePath);
}

// Preview image URL (thumbnail preferred). Returns null for non-images so the
// card falls back to a category icon.
export function imageUrl(m: Media): string | null {
  if (m.thumbnailPath) return toUrl(m.thumbnailPath);
  if (m.filePath && m.mimeType.startsWith('image/')) return toUrl(m.filePath);
  return null;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
