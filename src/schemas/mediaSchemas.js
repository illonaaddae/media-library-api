// schemas/mediaSchemas.js — Zod schemas for request validation.
// Multipart forms deliver everything as strings, so tags/numbers/booleans are
// coerced or transformed here rather than assumed to arrive typed.
const { z } = require('zod');
const { CATEGORIES } = require('../models/Media');

// tags may arrive as a real array (JSON) or a comma-separated string (multipart
// form). Normalize both to a trimmed, non-empty string array.
const tagsSchema = z
  .union([z.array(z.string()), z.string()])
  .transform((val) =>
    (Array.isArray(val) ? val : val.split(','))
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0)
  );

const categorySchema = z.enum(CATEGORIES, {
  message: `category must be one of: ${CATEGORIES.join(', ')}`,
});

// POST /media body.
const createMediaSchema = z.object({
  title: z.string().trim().min(1, 'title is required'),
  tags: tagsSchema.optional(),
  category: categorySchema,
});

// PUT/PATCH /media/:id body — all optional, but at least one field required.
const updateMediaSchema = z
  .object({
    title: z.string().trim().min(1, 'title cannot be empty'),
    tags: tagsSchema,
    category: categorySchema,
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field (title, tags, category) must be provided',
  });

// Coerce common truthy/falsy query strings to a boolean.
const booleanQuery = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

// GET /media query string.
const mediaQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  category: categorySchema.optional(),
  tags: tagsSchema.optional(),
  search: z.string().trim().optional(),
  sortBy: z.enum(['createdAt', 'title', 'fileSize']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  includeDeleted: booleanQuery.optional(),
});

// :id param — reject non-ObjectId strings with a 400 (not a Mongoose CastError).
const idParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id: must be a 24-character hex ObjectId'),
});

module.exports = {
  createMediaSchema,
  updateMediaSchema,
  mediaQuerySchema,
  idParamSchema,
};
