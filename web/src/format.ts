import type { Category, Media } from './types';

export const CAT_ICON: Record<Category, string> = {
  image: '🖼️',
  document: '📄',
  video: '🎞️',
  audio: '🎵',
  other: '📦',
};

const baseName = (p: string): string => p.split(/[\\/]/).pop() ?? '';

// Build a servable URL for a media item's image (thumbnail preferred). Returns
// null for non-images so the card falls back to a category icon.
export function imageUrl(m: Media): string | null {
  if (m.thumbnailPath) return `/uploads/thumbnails/${baseName(m.thumbnailPath)}`;
  if (m.filePath && m.mimeType.startsWith('image/')) return `/uploads/${baseName(m.filePath)}`;
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
