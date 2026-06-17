const { withTransaction, closePool } = require('../src/db/pool');
const { serviceClient } = require('../src/lib/supabase');
const profilesRepository = require('../src/repositories/profiles.repository');

const email = process.env.FIRST_ADMIN_EMAIL;
const password = process.env.FIRST_ADMIN_PASSWORD;
const fullName = process.env.FIRST_ADMIN_FULL_NAME || 'Admin';
const phone = process.env.FIRST_ADMIN_PHONE || null;

async function main() {
  if (!email || !password) {
    throw new Error('Set FIRST_ADMIN_EMAIL and FIRST_ADMIN_PASSWORD before running this script.');
  }

  const { data, error } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });

  if (error && !/already registered|already been registered/i.test(error.message || '')) {
    throw error;
  }

  let user = data?.user;
  if (!user) {
    const { data: users, error: listError } = await serviceClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) throw listError;
    user = users.users.find((item) => item.email === email);
  }

  if (!user?.id) {
    throw new Error('Could not resolve Supabase user id for FIRST_ADMIN_EMAIL.');
  }

  const profile = await withTransaction((client) => profilesRepository.upsertProfile({
    id: user.id,
    full_name: fullName,
    phone,
    role: 'admin',
    is_active: true,
    disabled_at: null
  }, client));

  console.log(JSON.stringify({
    ok: true,
    user_id: user.id,
    email: user.email,
    profile: {
      id: profile.id,
      role: profile.role,
      is_active: profile.is_active
    }
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, message: error.message }, null, 2));
  process.exitCode = 1;
}).finally(async () => {
  await closePool();
});
