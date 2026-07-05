# CLAUDE.md — Media Library API (FEM33 / Lab 04)

This file guides Claude Code while building a production-grade Media Library API
from scratch. Follow it exactly. This is a **new project** — do not reuse the
Task Tracker codebase.

## Goal

A RESTful API for a content team's media library that:

- Accepts image/PDF uploads with metadata (Multer, disk storage).
- Supports search, filtering, sorting, and pagination.
- Validates all input with Zod before controllers run.
- Returns one consistent JSON envelope for success and failure.

## Stack & key decisions

- **Runtime:** Node.js + Express.
- **Database:** MongoDB via Mongoose.
- **Validation:** `zod` — one reusable middleware, field-level error details.
- **Uploads:** `multer` — disk storage to `/uploads`, 5MB cap, jpeg/png/pdf only.
- **Config:** `dotenv` + startup env validation in `config/env.js`. [Lab 2 fix]
- **Async:** `async/await` only — no `.then()`/`.catch()` chains anywhere.

## Layered architecture (this is 20% of the grade — be strict)

```
project-root/
├── src/
│   ├── config/          env.js, db.js
│   ├── models/          Media.js
│   ├── repositories/    mediaRepository.js   ← ONLY layer that touches Mongoose
│   ├── services/        mediaService.js      ← ONLY layer with business logic
│   ├── controllers/     mediaController.js   ← req/res mapping only
│   ├── routes/          mediaRoutes.js       ← route defs only, no logic
│   ├── middlewares/     errorHandler.js, notFound.js, validate.js, upload.js
│   ├── utils/           AppError.js, catchAsync.js, apiResponse.js
│   ├── schemas/         mediaSchemas.js      ← Zod schemas
│   └── app.js
├── uploads/             (gitignored contents, keep .gitkeep)
├── server.js
├── .env / .env.example
└── package.json
```

Hard rules (the reviewer will check these):

- Routes contain **zero** business logic — only middleware chains and controller refs.
- Controllers never touch Mongoose; they call services and shape the HTTP response.
- Services never touch `req`/`res`; they call repositories and throw `AppError`.
- Repositories contain **all** Mongoose queries and nothing else.
- `app.js` builds the Express app; `server.js` connects DB, starts listening, and
  owns process-level handlers. Keep them separate.

## Data model — `Media`

| Field        | Type     | Rules                                             |
|--------------|----------|---------------------------------------------------|
| title        | String   | required, trimmed, text-indexed for search        |
| tags         | [String] | default `[]`, lowercased/trimmed                  |
| category     | String   | enum `["image","document","video","audio","other"]`, required |
| filePath     | String   | required — path saved by Multer                   |
| originalName | String   | required — original uploaded filename             |
| mimeType     | String   | required                                          |
| fileSize     | Number   | required (bytes)                                  |
| timestamps   | —        | `createdAt`/`updatedAt` via schema option         |

Add a text index on `title` (full-text search) and an index on `category`.

## Endpoints

| Method | Endpoint     | Description                          |
|--------|--------------|--------------------------------------|
| POST   | /media       | Upload one file + metadata           |
| GET    | /media       | List with pagination/filter/search   |
| GET    | /media/:id   | Get one item                         |
| PUT    | /media/:id   | Update metadata (full)               |
| PATCH  | /media/:id   | Update metadata (partial)            |
| DELETE | /media/:id   | Delete record **and** file on disk   |

**PUT vs PATCH:** the brief lists PUT. Implement **both** — PUT as the rubric
route, PATCH as the semantically correct partial update — and note the
distinction in the README. [Lab 2 fix]

`DELETE` must remove the file from `/uploads` (use `fs/promises.unlink`; if the
file is already missing, log it and still delete the record — don't 500).

## Validation (Zod)

`schemas/mediaSchemas.js` exports:

- `createMediaSchema` — body: `title` required non-empty string; `tags` optional
  array of strings (accept a comma-separated string from multipart forms and
  transform to array); `category` must be a valid enum value.
- `updateMediaSchema` — same fields, all optional, `.refine` that at least one
  field is present.
- `mediaQuerySchema` — query: `page` (int ≥1, default 1), `limit` (int 1–50,
  default 10), `category` (enum), `tags` (comma-separated string → array),
  `search` (string), `sortBy` (enum: `createdAt|title|fileSize`, default
  `createdAt`), `order` (`asc|desc`, default `desc`). Use `z.coerce` for numbers.
- `idParamSchema` — `:id` must be a valid Mongo ObjectId (24-hex regex) → 400,
  not a Mongoose CastError 500.

`middlewares/validate.js` — one reusable factory: `validate(schema, source)`
where source is `body` | `query` | `params`. On failure, throw
`AppError` with status 400 and `details` mapped from `error.issues` to
`[{ field, message }]`. Validation always runs **before** the controller.

**Multipart ordering matters:** for `POST /media`, Multer must run *before*
body validation (multipart fields don't exist on `req.body` until Multer parses
them). Chain: `upload.single('file')` → `validate(createMediaSchema)` → controller.

## File uploads (Multer)

`middlewares/upload.js`:

- Disk storage to `uploads/`; filename = `<timestamp>-<random>-<sanitized original>`
  (never trust the raw original name — strip path separators).
- `fileFilter`: allow only `image/jpeg`, `image/png`, `application/pdf`; reject
  others by passing an `AppError(400, "Unsupported file type: <mime>")`.
- `limits: { fileSize: 5 * 1024 * 1024 }`.
- In the error handler, translate `MulterError` (`LIMIT_FILE_SIZE` etc.) into a
  400 with a clear message — an oversized file must return **400, not 500**.
- Missing file on POST → 400 "File is required" (check in controller or a tiny
  middleware; Zod can't see the file).
- Ensure `uploads/` exists at startup (`fs.mkdirSync(..., { recursive: true })`).

## Pagination, filtering & search (GET /media)

- Build a filter object: `category` exact match; `tags` → `{ $in: [...] }`;
  `search` → text search on title (`$text` or case-insensitive regex — prefer
  `$text` since the index exists).
- Sort by validated `sortBy` + `order`.
- **Use `Promise.all()`** to fetch page results and total count concurrently —
  this is the rubric's explicit example:

```js
const [results, total] = await Promise.all([
  mediaRepository.findAll(filter, { skip, limit, sort }),
  mediaRepository.count(filter),
]);
```

- Response shape (exactly this): [Lab 2 fix — pagination metadata]

```json
{
  "status": "success",
  "data": {
    "results": [],
    "pagination": { "total": 84, "page": 2, "limit": 10, "totalPages": 9 }
  }
}
```

- Defaults: page 1, limit 10; hard cap limit at 50 (enforced by Zod).
- Requesting a page beyond `totalPages` returns an empty `results` array with
  correct metadata — not an error.

## Error handling & responses (20% of grade)

- `utils/AppError.js`: `class AppError extends Error` with `statusCode`,
  `status = "error"`, `isOperational = true`, optional `details` array.
- `utils/catchAsync.js`: `const catchAsync = fn => (req, res, next) => fn(req, res, next).catch(next);`
  Wrap **every** controller.
- `middlewares/notFound.js`: 404 with `` `Route ${req.originalUrl} not found` ``. [Lab 2 fix]
- `middlewares/errorHandler.js`, registered **last** in `app.js`:
  - `AppError` → its status/message/details.
  - `MulterError` → 400 with friendly message.
  - Mongoose `ValidationError`/`CastError` → 400.
  - Unknown errors → 500 generic message; log full error server-side; never leak
    stack traces in production responses.
- Envelopes — success: `{ "status": "success", "data": {} }`; error:
  `{ "status": "error", "message": "...", "details": [] }` (`details` only when present).
- **Process-level handlers in `server.js`:**
  - `unhandledRejection` → log, `server.close()` then `process.exit(1)`.
  - `uncaughtException` → log, `process.exit(1)` immediately (register before anything else).
  - Graceful shutdown on `SIGTERM`/`SIGINT`: close server, disconnect Mongoose.

## Environment configuration

- `.env` keys: `PORT`, `DB_URI`, `NODE_ENV`, `UPLOAD_DIR`, `MAX_FILE_SIZE`.
- `config/env.js` validates all required vars at startup (a small Zod schema on
  `process.env` is a nice touch) — fail fast with a message naming the missing
  var. [Lab 2 fix]
- Commit `.env.example` (keys only). `.env` and `uploads/*` in `.gitignore`.

## Carry-over fixes from previous labs (apply throughout)

1. **Pagination** — defaults, max cap, metadata object, filter applied before paginating.
2. **PATCH vs PUT** — implement both; document the distinction.
3. **`req.originalUrl`** in the 404 handler.
4. **Env validation** at startup, fail fast.
5. **Precise vocabulary** in comments/README/commits: *validation* vs
   *sanitization*; *MIME type* (not "file extension checking"); *multipart/form-data*
   (not "form upload"); *operational error* vs *programmer error*; *pagination
   metadata* (not "page info").

## Extensions to include (scoped selection)

- **Multiple file uploads:** `POST /media/bulk` with `upload.array('files', 5)`;
  validate shared metadata; insert many; use `Promise.all()` for any per-file work.
- **Image thumbnail generation:** `sharp` — on image upload, generate a 200px-wide
  thumbnail to `uploads/thumbnails/`, store `thumbnailPath` on the record
  (null for PDFs). Delete the thumbnail too on DELETE.
- **Soft delete:** `deletedAt: Date | null` on the model. **Default DELETE stays
  a hard delete (record + file) because the brief explicitly requires "Delete
  media item and file."** Soft delete is opt-in via `DELETE /media/:id?soft=true`
  (sets `deletedAt`, keeps the file). All reads filter `deletedAt: null` in the
  **repository** layer so it can't be forgotten. Add `POST /media/:id/restore`
  and a validated `?includeDeleted=true` escape hatch on GET /media.

Skip Cloudinary/S3, auth, and audit logging — out of scope for the deadline.

## Definition of done (maps to the 100% rubric)

- [ ] Four layers, each respecting its boundary; no logic in routes. (20%)
- [ ] Central errorHandler + AppError; process-level rejection/exception handlers; consistent envelopes. (20%)
- [ ] Zod validation on POST body, PUT/PATCH body, GET query, and :id params via one reusable middleware, field-level details. (15%)
- [ ] Multer disk storage, type/size restrictions → 400s, all seven metadata fields stored. (20%)
- [ ] page/limit/category/tags/search/sortBy/order all functional; pagination metadata correct. (15%)
- [ ] catchAsync on every controller; Promise.all() in list endpoint; zero .then() chains. (10%)

## Testing checklist (Postman/Insomnia)

Upload valid jpeg/png/pdf → 201 with all metadata · upload a .txt/.exe → 400
unsupported type · upload >5MB file → 400 (not 500) · POST with no file → 400 ·
POST missing title → 400 with `details: [{ field: "title", ... }]` · invalid
category enum → 400 · GET with `?page=2&limit=5` → correct metadata · `?limit=100`
→ clamped/rejected per schema · `?category=image&tags=a,b&search=report&sortBy=fileSize&order=asc`
→ combined filters work · `?page=abc` → 400 · GET/PUT/DELETE with malformed id →
400, with valid-but-absent id → 404 · DELETE removes DB record + file (or soft
delete sets deletedAt) · unknown route → 404 showing `req.originalUrl` · missing
env var → server refuses to start.
