# Media Library API

A RESTful API for a content team's media library. It accepts image and PDF
uploads with metadata, stores files on disk via Multer, and exposes search,
filtering, sorting, and pagination over the collection. All input is validated
with Zod before any controller runs, and every response — success or failure —
uses one consistent JSON envelope.

## Stack

- **Language:** TypeScript (strict mode), compiled to CommonJS
- **Runtime:** Node.js + Express 5
- **Database:** MongoDB via Mongoose
- **Validation:** Zod (one reusable middleware, field-level error details)
- **Uploads:** Multer (disk storage, 5MB cap, JPEG/PNG/PDF only by MIME type)
- **Thumbnails:** sharp (200px-wide thumbnail per image)
- **Config:** dotenv-flow (per-environment files) + Zod startup validation (fail fast)
- **Logging:** Pino structured logs (`pino-http`; `pino-pretty` in development)
- **Deploy:** Vercel serverless function (`@vercel/node`)

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create the per-environment file from the template and fill in values.
   `dotenv-flow` loads the file matching `NODE_ENV` — `.env.development`,
   `.env.test`, or `.env.production`:

   ```bash
   cp .env.example .env.development
   ```

   | Key                | Meaning                                             | Example                                    |
   |--------------------|-----------------------------------------------------|--------------------------------------------|
   | `NODE_ENV`         | `development` \| `test` \| `production`              | `development`                              |
   | `PORT`             | HTTP port the server listens on                     | `3000`                                      |
   | `DATABASE_URL`     | MongoDB connection string                           | `mongodb://127.0.0.1:27017/media_library`   |
   | `JWT_SECRET`       | Reserved for the future auth extension (optional)   | `<long random string>`                      |
   | `MAX_FILE_SIZE_MB` | Max upload size in **megabytes** (bytes in config)  | `5`                                         |
   | `UPLOAD_DIR`       | Directory Multer writes uploads into                | `uploads`                                   |
   | `LOG_LEVEL`        | `debug` \| `info` \| `warn` \| `error`                | `info`                                      |

   Every variable is validated at startup by a Zod schema in
   `src/config/env.ts`. A missing or invalid variable is a fatal configuration
   error: the process names the offending variable and exits before the server
   starts.

3. Run the server:

   ```bash
   npm run dev        # tsx watch — runs TypeScript directly, auto-restart
   npm run build      # tsc → compiles src/ + server.ts into dist/
   npm start          # runs the compiled dist/server.js
   npm run typecheck  # tsc --noEmit — type-check without emitting
   ```

   `dev` executes the TypeScript sources directly (no build step). For
   production, `build` emits JavaScript to `dist/` and `start` runs it.

## Deployment (Vercel)

**Live URL:** https://media-library-api-seven.vercel.app — health check at
[`/health`](https://media-library-api-seven.vercel.app/health).

The app runs on Vercel as a **serverless function**. `api/index.ts` is the
Vercel entry: it reuses a **cached Mongoose connection** across warm invocations
(never reconnecting per request) and exports the Express app; `vercel.json`
routes all traffic to it. `server.ts` (`app.listen` + graceful shutdown) is the
local/dev entry only.

### Deploy steps

1. **MongoDB Atlas (free tier).** Create a free **M0** cluster, add a database
   user, and allow network access from anywhere (`0.0.0.0/0` — Vercel's egress
   IPs are dynamic). Copy the `mongodb+srv://…` connection string and insert the
   password and a database name, e.g.
   `mongodb+srv://user:pass@cluster.mongodb.net/media_library?retryWrites=true&w=majority`.
2. **Import the repo into Vercel** (GitHub integration → auto-deploys `main`).
   No build settings are needed — `vercel.json` + `@vercel/node` handle it.
3. **Set Production environment variables** (Vercel → Settings → Environment
   Variables):

   | Key                | Value                                              |
   |--------------------|----------------------------------------------------|
   | `NODE_ENV`         | `production`                                        |
   | `DATABASE_URL`     | your Atlas `mongodb+srv://…` string                 |
   | `JWT_SECRET`       | a long random string (reserved for future auth)     |
   | `MAX_FILE_SIZE_MB` | `5`                                                 |
   | `UPLOAD_DIR`       | `/tmp/uploads`                                      |
   | `LOG_LEVEL`        | `info`                                              |

4. **Deploy** (automatic on push to `main`, or the dashboard **Deploy** button),
   then verify: `curl https://media-library-api-seven.vercel.app/health`.
5. Point Postman's **Production** environment `BASE_URL` at the live URL and run
   the collection in `postman/`.

### Vercel limitations

Serverless functions differ from a long-lived server in ways that matter here:

- **Ephemeral filesystem.** Only `/tmp` is writable, and it is **not durable**:
  files Multer writes during one invocation do not persist and are not shared
  across instances. An upload still returns `201` and its **metadata record is
  created**, but the stored bytes may disappear on the next cold start. This is
  why `UPLOAD_DIR` is `/tmp/uploads` in production — an accepted limitation.
- **Cold starts.** An idle function is torn down; the next request pays a
  startup cost and re-establishes the Mongo connection (hence the cached
  connection in `api/index.ts`).
- **No long-lived processes.** There is no persistent `listen`, no background
  work, and the process-level handlers (`SIGTERM`/`SIGINT` graceful shutdown,
  `unhandledRejection`) are effectively **dev-only** — Vercel owns the lifecycle.

### Production file handling (the real fix)

Local disk storage is a development convenience. In production, file bytes
belong in **object storage** — **AWS S3** or **Cloudinary** — not on the
function's disk:

- Replace Multer's disk storage with a **stream to the storage SDK** (e.g.
  `multer-s3`, or Multer memory storage piped into the S3/Cloudinary SDK) in the
  upload middleware.
- Persist only the returned **object URL + metadata** in Mongo (the bucket URL
  replaces `filePath`); sharp thumbnails are uploaded the same way.
- Serve files from the bucket/CDN rather than the API. Uploads then become
  durable, shared across instances, and independent of the function lifecycle.

## Folder structure

The project follows a strict layered architecture. Each layer has one job and a
boundary it must not cross:

```
src/
├── config/          env.ts (validated config), db.ts (Mongoose connection),
│                    crashHandler.ts (uncaughtException, imported first)
├── models/          Media.ts — Mongoose schema + indexes + IMedia interface
├── repositories/    mediaRepository.ts — the ONLY layer that touches Mongoose
├── services/        mediaService.ts — the ONLY layer with business logic
├── controllers/     mediaController.ts — maps req/res; no Mongoose, no logic
├── routes/          mediaRoutes.ts — middleware chains + controller refs only
├── middlewares/     errorHandler, notFound, validate, upload
├── utils/           AppError, catchAsync, apiResponse
├── schemas/         mediaSchemas.ts — Zod schemas (+ inferred input types)
└── app.ts           builds the Express app (no listen, no DB)
server.ts            connects DB, starts listening, owns process-level handlers
tsconfig.json        strict TypeScript config (module/resolution: node16)
uploads/             stored files (gitignored; thumbnails/ generated by sharp)
dist/                compiled JavaScript output (gitignored; `npm run build`)
```

- **routes** — declare HTTP method, path, and the middleware chain. Zero logic.
- **controllers** — read the request, call a service, shape the HTTP response
  with `sendSuccess`. Never import Mongoose.
- **services** — all business rules; call repositories and throw `AppError`.
  Never touch `req`/`res`.
- **repositories** — all Mongoose queries and nothing else. Merge the
  soft-delete guard (`deletedAt: null`) into every read.
- **app.ts vs server.ts** — `app.ts` builds the app; `server.ts` owns the
  process (DB connect, `listen`, signal handlers).

## Data model — `Media`

| Field          | Type       | Rules                                                          |
|----------------|------------|----------------------------------------------------------------|
| `title`        | String     | required, trimmed, text-indexed for full-text search           |
| `tags`         | [String]   | default `[]`, each lowercased + trimmed                        |
| `category`     | String     | required enum: `image`, `document`, `video`, `audio`, `other`  |
| `filePath`     | String     | required — path written by Multer                             |
| `originalName` | String     | required — original uploaded filename                         |
| `mimeType`     | String     | required — the file's MIME type                               |
| `fileSize`     | Number     | required — size in bytes                                      |
| `thumbnailPath`| String     | 200px thumbnail path for images; `null` for PDFs              |
| `deletedAt`    | Date       | soft-delete marker; `null` = active                           |
| `createdAt` / `updatedAt` | Date | managed by the `timestamps` schema option              |

## Endpoints

Base path: `/media`

| Method | Endpoint            | Description                                    |
|--------|---------------------|------------------------------------------------|
| POST   | `/media`            | Upload one file + metadata (multipart/form-data)|
| POST   | `/media/bulk`       | Upload up to 5 files sharing one metadata set   |
| GET    | `/media`            | List with pagination, filtering, and search     |
| GET    | `/media/:id`        | Get one item                                    |
| PUT    | `/media/:id`        | Update metadata (full)                          |
| PATCH  | `/media/:id`        | Update metadata (partial)                       |
| DELETE | `/media/:id`        | Hard delete record + file (or `?soft=true`)     |
| POST   | `/media/:id/restore`| Restore a soft-deleted item                     |

### Response envelope

Success:

```json
{ "status": "success", "data": { } }
```

Error (an **operational error** — an expected, handled failure, not a
programmer bug):

```json
{ "status": "error", "message": "...", "details": [] }
```

`details` is present only when field-level information exists (e.g. validation).

### POST /media

Send **multipart/form-data** with a `file` part plus metadata fields. Multer
parses the multipart body *before* validation, because the metadata fields do
not exist on `req.body` until Multer has parsed them.

```bash
curl -X POST http://localhost:3000/media \
  -F "file=@sunset.png" \
  -F "title=Sunset over the bay" \
  -F "category=image" \
  -F "tags=nature,sky"
```

`201 Created`:

```json
{
  "status": "success",
  "data": {
    "_id": "6a4ab2a1b0926246986c06d4",
    "title": "Sunset over the bay",
    "tags": ["nature", "sky"],
    "category": "image",
    "filePath": "uploads/1783280289670-565d0be6da77-sunset.png",
    "originalName": "sunset.png",
    "mimeType": "image/png",
    "fileSize": 51234,
    "thumbnailPath": "uploads/thumbnails/1783280289670-565d0be6da77-sunset.png",
    "deletedAt": null,
    "createdAt": "2026-07-05T19:38:09.741Z",
    "updatedAt": "2026-07-05T19:38:09.741Z"
  }
}
```

### Validation-error example

A request missing the required `title`:

```bash
curl -X POST http://localhost:3000/media \
  -F "file=@sunset.png" \
  -F "category=image"
```

`400 Bad Request` — field-level `details`:

```json
{
  "status": "error",
  "message": "Validation failed",
  "details": [
    { "field": "title", "message": "Invalid input: expected string, received undefined" }
  ]
}
```

Other 400s: an unsupported **MIME type** (`Unsupported file type: text/plain`),
a file above `MAX_FILE_SIZE` (`File too large — max 5MB`, never a 500), and a
malformed `:id` (`Invalid id: must be a 24-character hex ObjectId`, caught
before it becomes a Mongoose `CastError`).

### GET /media — pagination metadata

Query parameters: `page` (int ≥1, default 1), `limit` (int 1–50, default 10),
`category` (enum), `tags` (comma-separated), `search` (full-text on title),
`sortBy` (`createdAt` | `title` | `fileSize`, default `createdAt`), `order`
(`asc` | `desc`, default `desc`), `includeDeleted` (boolean).

```bash
curl "http://localhost:3000/media?category=image&tags=nature,sky&search=report&sortBy=fileSize&order=asc&page=2&limit=10"
```

`200 OK` — results plus a **pagination metadata** object:

```json
{
  "status": "success",
  "data": {
    "results": [ /* Media documents */ ],
    "pagination": { "total": 84, "page": 2, "limit": 10, "totalPages": 9 }
  }
}
```

Requesting a page beyond `totalPages` returns an empty `results` array with
correct pagination metadata — not an error.

## PUT vs PATCH

The brief lists `PUT`, but both are implemented:

- **PUT `/media/:id`** — the rubric route. Semantically a *full* replacement of
  the editable metadata. Validated with `updateMediaSchema`.
- **PATCH `/media/:id`** — the semantically correct *partial* update: send only
  the fields you want to change.

Both share `updateMediaSchema`, which marks every field optional and uses a
`.refine` to reject an empty body (`At least one field ... must be provided`).
In this API their runtime behavior is identical — the distinction is HTTP
semantics: PUT signals "replace the resource's metadata", PATCH signals "merge
these fields". PATCH is the recommendation for clients doing targeted edits.

## Soft delete

Per the brief, `DELETE /media/:id` is a **hard delete by default**: it removes
the database record *and* unlinks the file and its thumbnail from disk. If a
file is already missing on disk, the API logs it and still deletes the record —
a missing file never produces a 500.

Soft delete is opt-in:

- `DELETE /media/:id?soft=true` — sets `deletedAt` and **keeps** the file.
- `POST /media/:id/restore` — clears `deletedAt`.
- Reads exclude soft-deleted records by default; the repository merges
  `deletedAt: null` into every read filter so it cannot be forgotten.
- `GET /media?includeDeleted=true` — escape hatch to include soft-deleted items.

## Testing checklist

- Upload valid JPEG/PNG/PDF → `201` with all metadata fields stored.
- Upload a `.txt`/`.exe` → `400` unsupported MIME type.
- Upload a file above 5MB → `400` (never `500`).
- POST with no file → `400` "File is required".
- POST missing `title` → `400` with `details: [{ field: "title", ... }]`.
- Invalid `category` enum → `400`.
- `GET /media?page=2&limit=5` → correct pagination metadata.
- `GET /media?limit=100` → rejected by the schema (cap is 50).
- `GET /media?category=image&tags=a,b&search=report&sortBy=fileSize&order=asc`
  → combined filters work.
- `GET /media?page=abc` → `400`.
- GET/PUT/DELETE with a malformed `:id` → `400`; valid-but-absent `:id` → `404`.
- DELETE removes the DB record + file (or `?soft=true` sets `deletedAt`).
- Unknown route → `404` showing `req.originalUrl`.
- Missing environment variable → server refuses to start.
```
