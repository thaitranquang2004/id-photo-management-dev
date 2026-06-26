const path = require('node:path');
const dotenv = require('dotenv');
const { z } = require('zod');

dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || path.resolve(process.cwd(), '.env'), quiet: true });

const emptyToUndefined = (value) => (value === '' ? undefined : value);
// env booleans are strings; z.coerce.boolean treats any non-empty string as true,
// so parse explicitly: 'true'/'1' => true, anything else => the provided default.
const boolFromEnv = (defaultValue) => z.preprocess((value) => {
  if (value === undefined || value === '') return defaultValue;
  return value === 'true' || value === '1' || value === true;
}, z.boolean());

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.preprocess(emptyToUndefined, z.string().default('*')),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  CLOUDINARY_CLOUD_NAME: z.preprocess(emptyToUndefined, z.string().optional()),
  CLOUDINARY_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  CLOUDINARY_API_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
  GEMINI_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  GEMINI_IMAGE_MODEL: z.preprocess(emptyToUndefined, z.string().default('gemini-2.5-flash-image')),
  GEMINI_ANALYSIS_MODEL: z.preprocess(emptyToUndefined, z.string().default('gemini-2.5-flash')),
  SMTP_HOST: z.preprocess(emptyToUndefined, z.string().optional()),
  SMTP_PORT: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().optional()),
  SMTP_USER: z.preprocess(emptyToUndefined, z.string().optional()),
  SMTP_PASS: z.preprocess(emptyToUndefined, z.string().optional()),
  SMTP_SECURE: boolFromEnv(false),
  MAIL_FROM: z.preprocess(emptyToUndefined, z.string().default('Tiệm hình thẻ <no-reply@tiemhinhthe.local>')),
  NOTIFICATIONS_ENABLED: boolFromEnv(true),
  ASSET_PURGE_ENABLED: boolFromEnv(true),
  WEB_BASE_URL: z.preprocess(emptyToUndefined, z.string().default('http://localhost:5173')),
  SIGNED_URL_PUBLIC_TTL_SECONDS: z.coerce.number().int().positive().default(86400),
  SIGNED_URL_INTERNAL_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  PUBLIC_LOOKUP_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  PUBLIC_LOOKUP_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20)
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.flatten().fieldErrors;
  // eslint-disable-next-line no-console
  console.error('Invalid API environment configuration', details);
  process.exit(1);
}

// A wildcard CORS origin combined with `credentials: true` is unsafe in production
// (and browsers reject it anyway). Fail fast so a misconfigured deploy never starts.
if (parsed.data.NODE_ENV === 'production' && parsed.data.CORS_ORIGIN === '*') {
  // eslint-disable-next-line no-console
  console.error('CORS_ORIGIN must be set to the web app origin (not "*") in production');
  process.exit(1);
}

module.exports = parsed.data;
