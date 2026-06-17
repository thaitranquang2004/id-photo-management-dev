const path = require('node:path');
const dotenv = require('dotenv');
const { z } = require('zod');

dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || path.resolve(process.cwd(), '.env'), quiet: true });

const emptyToUndefined = (value) => (value === '' ? undefined : value);

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

module.exports = parsed.data;
