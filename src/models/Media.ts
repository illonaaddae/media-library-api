// models/Media.ts — Mongoose schema/model for a media library item.
import mongoose, { Schema, Model, HydratedDocument } from 'mongoose';

export const CATEGORIES = ['image', 'document', 'video', 'audio', 'other'] as const;
export type Category = (typeof CATEGORIES)[number];

// Shape of a media document's own fields (timestamps added by the schema option).
export interface IMedia {
  title: string;
  tags: string[];
  category: Category;
  filePath: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  deletedAt: Date | null;
  thumbnailPath: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type MediaDocument = HydratedDocument<IMedia>;

const mediaSchema = new Schema<IMedia>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    tags: {
      type: [String],
      default: [],
      // Normalize each tag: lowercase + trim.
      set: (tags: unknown) =>
        Array.isArray(tags)
          ? tags.map((tag) => String(tag).trim().toLowerCase())
          : tags,
    },
    category: {
      type: String,
      required: true,
      enum: CATEGORIES,
    },
    filePath: {
      type: String,
      required: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    // Soft-delete marker: null = active, Date = soft-deleted.
    deletedAt: {
      type: Date,
      default: null,
    },
    // Thumbnail path for images (null for PDFs / non-image files).
    thumbnailPath: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// Full-text search on title.
mediaSchema.index({ title: 'text' });
// Exact-match filtering on category.
mediaSchema.index({ category: 1 });

export const Media: Model<IMedia> = mongoose.model<IMedia>('Media', mediaSchema);

export default Media;
