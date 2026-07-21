// config/env.ts — load the .env file matching NODE_ENV (dotenv-flow) and
// validate required environment variables at startup with a Zod schema on
// process.env. Fail fast, naming the offending var, then exit(1).
import { config as loadEnvFiles } from 'dotenv-flow';
import { z } from 'zod';

// Load .env.<NODE_ENV> (+ .local overrides). When NODE_ENV is unset — as it is
// for `npm run dev` / `npm start` — default to development so .env.development
// is picked up. Tests set NODE_ENV=test to select .env.test.
loadEnvFiles({ default_node_env: 'development' });

// Schema describing every environment variable the app relies on. Coercions
// keep the exported config strongly typed (numbers as numbers, not strings).
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  // Reserved for the future auth extension; the API has no auth yet. Optional
  // until then, but present in .env.example. A blank value (template files
  // leave it empty) is treated as "not set" rather than a hard error.
  JWT_SECRET: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().min(1).optional()
  ),
  MAX_FILE_SIZE_MB: z.coerce
    .number()
    .positive()
    .default(5), // megabytes — converted to bytes below
  UPLOAD_DIR: z.string().min(1).default('uploads'),
  // Set automatically by Vercel; presence means the serverless runtime, whose
  // filesystem is read-only except /tmp.
  VERCEL: z.string().optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast: list each invalid/missing variable by name, then exit.
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  // Bootstrap phase: this runs before the logger exists (the logger depends on
  // the very config being validated here), so write straight to stderr.
  process.stderr.write(`Invalid environment configuration:\n${details}\n`);
  process.exit(1);
}

// Frozen, typed config object — the single source of truth for env values.
const config = Object.freeze({
  nodeEnv: parsed.data.NODE_ENV,
  port: parsed.data.PORT,
  databaseUrl: parsed.data.DATABASE_URL,
  jwtSecret: parsed.data.JWT_SECRET,
  // Env carries megabytes; the app works in bytes (Multer's limit).
  maxFileSize: parsed.data.MAX_FILE_SIZE_MB * 1024 * 1024,
  // On Vercel the filesystem is read-only except /tmp, so uploads AND their
  // thumbnails must live under /tmp/uploads regardless of the configured dir.
  // Both Multer (middlewares/upload.ts) and thumbnail generation
  // (services/mediaService.ts) derive their paths from this single value.
  uploadDir: parsed.data.VERCEL ? '/tmp/uploads' : parsed.data.UPLOAD_DIR,
  logLevel: parsed.data.LOG_LEVEL,
  isProduction: parsed.data.NODE_ENV === 'production',
});

export type Config = typeof config;

export default config;
