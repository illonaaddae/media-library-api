# Lab 04 — Claude Code Build Prompts (Media Library API)

New project. Create an empty repo folder, put `CLAUDE.md` at the root, open it
in VS Code, and run these prompts in order in Claude Code. Run one, review the
diff, test, commit, then move on. Don't paste them all at once.

---

## Prompt 0 — Scaffold & environment

```
Read CLAUDE.md. Initialize the project: npm init, install express, mongoose,
zod, multer, dotenv (dev: nodemon). Create the exact folder structure from
CLAUDE.md with empty placeholder files.

Create config/env.js that loads dotenv and validates PORT, DB_URI, NODE_ENV,
UPLOAD_DIR, MAX_FILE_SIZE at startup with a Zod schema on process.env — fail
fast naming the missing/invalid var. Export a typed config object.

Create app.js (express.json, routes placeholder) and server.js (env → db
connect → listen). Add .env, .env.example (keys only), .gitignore (node_modules,
.env, uploads/* with a .gitkeep exception). Add npm scripts: start, dev.
```

---

## Prompt 1 — Model & repository

```
Create models/Media.js per the CLAUDE.md table: title (required, trimmed, text
index), tags ([String], default [], lowercase/trim), category (required enum),
filePath, originalName, mimeType, fileSize (all required), timestamps, plus
deletedAt (Date, default null) and thumbnailPath (String, default null) for the
extensions. Add an index on category.

Create repositories/mediaRepository.js — the ONLY file that touches Mongoose:
create, findAll(filter, {skip, limit, sort}), count(filter), findById, insertMany,
updateById, softDeleteById (sets deletedAt), restoreById, hardDeleteById.
All read methods must merge { deletedAt: null } into the filter unless an
includeDeleted option is passed. No business logic here — pure data access.
```

---

## Prompt 2 — Error handling core

```
Create utils/AppError.js (statusCode, status="error", isOperational, optional
details array), utils/catchAsync.js, and utils/apiResponse.js with a
sendSuccess(res, statusCode, data) helper that always emits
{ status: "success", data }.

Create middlewares/notFound.js (404 using req.originalUrl) and
middlewares/errorHandler.js handling: AppError → its status/message/details;
MulterError → 400 (LIMIT_FILE_SIZE gets a clear "max 5MB" message); Mongoose
ValidationError/CastError → 400; everything else → 500 generic, full error
logged server-side, no stack traces in production responses. Error envelope:
{ status: "error", message, details? }.

In server.js add process handlers: uncaughtException (log, exit 1, registered
first), unhandledRejection (log, server.close then exit 1), and graceful
shutdown on SIGTERM/SIGINT closing the server and mongoose connection.
Wire notFound + errorHandler last in app.js.
```

---

## Prompt 3 — Zod schemas & validation middleware

```
Create schemas/mediaSchemas.js: createMediaSchema (title required non-empty;
tags optional — accept array OR comma-separated string and transform to string
array; category required enum), updateMediaSchema (all optional, refine at
least one field present), mediaQuerySchema (page coerce int ≥1 default 1, limit
coerce int 1–50 default 10, category enum optional, tags comma-string→array,
search string, sortBy enum createdAt|title|fileSize default createdAt, order
asc|desc default desc, includeDeleted coerce boolean optional), idParamSchema
(24-hex ObjectId regex).

Create middlewares/validate.js — a factory validate(schema, source='body') that
parses req[source], replaces it with the parsed value, and on failure calls
next(new AppError(400, 'Validation failed', details)) where details maps
error.issues to [{ field, message }]. Field-level errors are graded — make
sure details is populated.
```

---

## Prompt 4 — Multer upload middleware

```
Create middlewares/upload.js: multer disk storage into config.UPLOAD_DIR
(ensure the directory exists at startup with mkdirSync recursive). Filename:
timestamp-random-sanitizedOriginalName (strip path separators and unsafe
chars). fileFilter allows only image/jpeg, image/png, application/pdf —
otherwise cb(new AppError(400, `Unsupported file type: ${mime}`)). limits:
fileSize 5MB from config. Export upload.single('file') and
upload.array('files', 5) wrappers.

Verify the errorHandler already converts MulterError LIMIT_FILE_SIZE to a 400 —
an oversized upload must never produce a 500.
```

---

## Prompt 5 — Service & controller & routes (core CRUD)

```
Create services/mediaService.js (no req/res here): createMedia(fileInfo,
metadata) — throws AppError(400, 'File is required') if no file; getMediaById
(404 via AppError if not found); updateMedia (existence check first);
deleteMedia — HARD delete by default (remove record, unlink file + thumbnail
with fs/promises; if a file is already missing, log and continue — never 500)
because the brief requires DELETE to remove item and file; soft delete only
when soft=true (set deletedAt, keep file); restoreMedia;
listMedia(query) — build filter (category exact, tags $in, search via $text on
title), sort from sortBy/order, skip/limit from page/limit, then use
Promise.all([repository.findAll(...), repository.count(filter)]) and return
{ results, pagination: { total, page, limit, totalPages } }.

Create controllers/mediaController.js — every handler wrapped in catchAsync,
delegating to the service, responding with sendSuccess (201 for create). For
create, assemble fileInfo from req.file (filePath, originalName, mimeType,
fileSize).

Create routes/mediaRoutes.js with NO logic:
POST   /            upload.single('file') → validate(createMediaSchema) → create
GET    /            validate(mediaQuerySchema,'query') → list
GET    /:id         validate(idParamSchema,'params') → getOne
PUT    /:id         validate(idParamSchema,'params') → validate(updateMediaSchema) → update
PATCH  /:id         same chain → update (partial)
DELETE /:id         validate(idParamSchema,'params') → remove (?soft=true validated in query schema)
POST   /:id/restore validate(idParamSchema,'params') → restore

Mount at /media in app.js. Note in comments: multer runs BEFORE validation on
POST because multipart fields aren't on req.body until multer parses them.
```

---

## Prompt 6 — Extensions: bulk upload & thumbnails

```
Install sharp. In the service layer: after an image upload (mimeType starts
with image/), generate a 200px-wide thumbnail into uploads/thumbnails/ and
store thumbnailPath (null for PDFs). Use async sharp calls; a thumbnail
failure must not fail the upload — log and continue with thumbnailPath null.

Add POST /media/bulk: upload.array('files', 5) → validate(createMediaSchema) →
controller. Shared metadata applies to all files. Process thumbnails for all
images with Promise.all. Insert with repository.insertMany. Respond 201 with
the created records.

Confirm delete behavior matches CLAUDE.md: default DELETE unlinks file +
thumbnail and removes the record; ?soft=true keeps the file and sets deletedAt.
```

---

## Prompt 7 — README & smoke test

```
Write README.md: overview, setup (.env.example walkthrough), folder structure
with one line per layer explaining its boundary, endpoint table with example
requests/responses (include a validation-error example and the pagination
envelope), the PUT vs PATCH distinction, soft-delete behavior, and the testing
checklist from CLAUDE.md.

Then start the server and smoke test with curl: valid upload, bad file type,
missing title, list with combined query params, invalid page value, malformed
id, delete + restore. Fix anything that fails. Use precise vocabulary
everywhere (MIME type, multipart/form-data, pagination metadata, operational
error).
```

---

## Prompt 8 — Rubric self-review (read-only)

```
Read CLAUDE.md's "Definition of done" and audit the codebase against each
rubric line. For each: state pass/fail with the file and line that proves it.
Specifically verify: no Mongoose outside repositories, no business logic in
routes/controllers, catchAsync on every controller, Promise.all in listMedia,
zero .then()/.catch() chains (grep for them), MulterError → 400, details array
on validation errors, pagination metadata shape matches the brief exactly.
Report gaps — don't fix yet.
```
