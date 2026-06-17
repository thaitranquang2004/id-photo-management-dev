const cloudinary = require('cloudinary').v2;
const { pool } = require('../src/db/pool');
const env = require('../src/config/env');
const { serviceClient } = require('../src/lib/supabase');
const googleAi = require('../src/services/google-ai.service');

async function check(name, run) {
  try {
    const result = await run();
    return { name, ok: true, ...result };
  } catch (error) {
    return {
      name,
      ok: false,
      code: error.code,
      status: error.status || error.statusCode,
      message: error.message
    };
  }
}

async function main() {
  const checks = await Promise.all([
    check('env', async () => ({
      node_env: env.NODE_ENV,
      has_supabase_url: Boolean(env.SUPABASE_URL),
      has_supabase_service_role_key: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
      has_database_url: Boolean(env.DATABASE_URL),
      has_cloudinary: Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET),
      has_gemini_api_key: Boolean(env.GEMINI_API_KEY),
      gemini_image_model: env.GEMINI_IMAGE_MODEL
    })),
    check('database', async () => {
      const result = await pool.query('select current_database() as database_name, current_schema() as schema_name');
      return {
        database_name: result.rows[0].database_name,
        schema_name: result.rows[0].schema_name
      };
    }),
    check('supabase_auth_admin', async () => {
      const { data, error } = await serviceClient.auth.admin.listUsers({ page: 1, perPage: 1 });
      if (error) throw error;
      return { user_count_page: Array.isArray(data?.users) ? data.users.length : null };
    }),
    check('cloudinary', async () => {
      cloudinary.config({
        cloud_name: env.CLOUDINARY_CLOUD_NAME,
        api_key: env.CLOUDINARY_API_KEY,
        api_secret: env.CLOUDINARY_API_SECRET,
        secure: true
      });
      const result = await cloudinary.api.ping();
      return { status: result.status };
    }),
    check('google_ai', async () => googleAi.assertImageModelAvailable())
  ]);

  await pool.end();
  console.log(JSON.stringify({ ok: checks.every((item) => item.ok), checks }, null, 2));

  if (checks.some((item) => !item.ok)) {
    process.exitCode = 1;
  }
}

main().catch(async (error) => {
  try {
    await pool.end();
  } catch {}
  console.error(JSON.stringify({ ok: false, message: error.message }, null, 2));
  process.exit(1);
});
