// config/env.ts — load .env and validate required environment variables at
// startup with a Zod schema on process.env. Fail fast, naming the offending var.
import 'dotenv/config';
import { z } from 'zod';

// Schema describing every environment variable the app relies on. Coercions
// keep the exported config strongly typed (numbers as numbers, not strings).
const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  DB_URI: z.string().min(1, 'DB_URI is required'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  UPLOAD_DIR: z.string().min(1).default('uploads'),
  MAX_FILE_SIZE: z.coerce
    .number()
    .int()
    .positive()
    .default(5 * 1024 * 1024), // 5MB
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast: list each invalid/missing variable by name, then exit.
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  console.error(`Invalid environment configuration:\n${details}`);
  process.exit(1);
}

// Frozen, typed config object — the single source of truth for env values.
const config = Object.freeze({
  port: parsed.data.PORT,
  dbUri: parsed.data.DB_URI,
  nodeEnv: parsed.data.NODE_ENV,
  uploadDir: parsed.data.UPLOAD_DIR,
  maxFileSize: parsed.data.MAX_FILE_SIZE,
  isProduction: parsed.data.NODE_ENV === 'production',
});

export type Config = typeof config;

export default config;
