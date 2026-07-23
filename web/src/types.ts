export type Category = 'image' | 'document' | 'video' | 'audio' | 'other';

export const CATEGORIES: Category[] = ['image', 'document', 'video', 'audio', 'other'];

export interface Media {
  _id: string;
  title: string;
  category: Category;
  tags: string[];
  filePath: string;
  thumbnailPath: string | null;
  originalName: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface MediaList {
  results: Media[];
  pagination: Pagination;
}
