// models/Media.js — Mongoose schema/model for a media library item.
const mongoose = require('mongoose');

const CATEGORIES = ['image', 'document', 'video', 'audio', 'other'];

const mediaSchema = new mongoose.Schema(
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
      set: (tags) =>
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

const Media = mongoose.model('Media', mediaSchema);

module.exports = Media;
module.exports.CATEGORIES = CATEGORIES;
