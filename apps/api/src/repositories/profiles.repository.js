const { one, many } = require('../db/pool');

async function findById(id, client) {
  return one('select * from public.profiles where id = $1', [id], client);
}

async function list({ limit, offset }, client) {
  const rows = await many(
    `select *, count(*) over()::int as total
     from public.profiles
     order by created_at desc
     limit $1 offset $2`,
    [limit, offset],
    client
  );
  return { rows, total: rows[0]?.total || 0 };
}

async function upsertProfile(profile, client) {
  return one(
    `insert into public.profiles (id, full_name, phone, role, is_active, disabled_at)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (id) do update set
       full_name = excluded.full_name,
       phone = excluded.phone,
       role = excluded.role,
       is_active = excluded.is_active,
       disabled_at = excluded.disabled_at,
       updated_at = now()
     returning *`,
    [
      profile.id,
      profile.full_name,
      profile.phone || null,
      profile.role,
      profile.is_active,
      profile.disabled_at || null
    ],
    client
  );
}

async function updateProfile(id, patch, client) {
  const current = await findById(id, client);
  if (!current) return null;

  return one(
    `update public.profiles
     set full_name = coalesce($2, full_name),
         phone = coalesce($3, phone),
         role = coalesce($4, role),
         is_active = coalesce($5, is_active),
         disabled_at = $6,
         updated_at = now()
     where id = $1
     returning *`,
    [
      id,
      patch.full_name ?? null,
      patch.phone ?? null,
      patch.role ?? null,
      patch.is_active ?? null,
      Object.prototype.hasOwnProperty.call(patch, 'disabled_at') ? patch.disabled_at : current.disabled_at
    ],
    client
  );
}

module.exports = { findById, list, upsertProfile, updateProfile };
