// schemas/mediaSchemas.ts — Zod schemas for request validation.
// Multipart forms deliver everything as strings, so tags/numbers/booleans are
// coerced or transformed here rather than assumed to arrive typed.
import * as zod from 'zod';
import { CATEGORIES } from '../models/Media';

// tags may arrive as a real array (JSON) or a comma-separated string (multipart
// form). Normalize both to a trimmed, non-empty string array.
const tagsSchema = zod
  .union([zod.array(zod.string()), zod.string()])
  .transform((val) =>
    (Array.isArray(val) ? val : val.split(','))
      .map((tag) => tag.trim().toLowerCase())
      .filter((tag) => tag.length > 0)
  );

const categorySchema = zod.enum(CATEGORIES, {
  message: `category must be one of: ${CATEGORIES.join(', ')}`,
});

// POST /media body.
export const createMediaSchema = zod.object({
  title: zod.string().trim().min(1, 'title is required'),
  tags: tagsSchema.optional(),
  category: categorySchema,
});

// PUT/PATCH /media/:id body — all optional, but at least one field required.
export const updateMediaSchema = zod
  .object({
    title: zod.string().trim().min(1, 'title cannot be empty'),
    tags: tagsSchema,
    category: categorySchema,
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field (title, tags, category) must be provided',
  });

// Coerce common truthy/falsy query strings to a boolean.
const booleanQuery = zod
  .enum(['true', 'false', '1', '0'])
  .transform((value) => value === 'true' || value === '1');

// GET /media query string.
export const mediaQuerySchema = zod.object({
  page: zod.coerce.number().int().min(1).default(1),
  limit: zod.coerce.number().int().min(1).max(50).default(10),
  category: categorySchema.optional(),
  tags: tagsSchema.optional(),
  search: zod.string().trim().optional(),
  sortBy: zod.enum(['createdAt', 'title', 'fileSize']).default('createdAt'),
  order: zod.enum(['asc', 'desc']).default('desc'),
  includeDeleted: booleanQuery.optional(),
});

// :id param — reject non-ObjectId strings with a 400 (not a Mongoose CastError).
export const idParamSchema = zod.object({
  id: zod
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid id: must be a 24-character hex ObjectId'),
});

// Inferred types for the validated, transformed request payloads.
export type CreateMediaInput = zod.infer<typeof createMediaSchema>;
export type UpdateMediaInput = zod.infer<typeof updateMediaSchema>;
export type MediaQuery = zod.infer<typeof mediaQuerySchema>;
export type IdParam = zod.infer<typeof idParamSchema>;
