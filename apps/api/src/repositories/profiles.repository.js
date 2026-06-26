const { one, many } = require('../db/pool');

// Alias cột nguoi_dung về tiếng Anh để auth.middleware + admin.service không phải đổi.
const PROF_COLS = `id, ho_ten as full_name, so_dien_thoai as phone, vai_tro as role,
  dang_hoat_dong as is_active, ngay_luu_tru as disabled_at, ngay_tao as created_at, ngay_cap_nhat as updated_at`;

async function findById(id, client) {
  return one(`select ${PROF_COLS} from public.nguoi_dung where id = $1`, [id], client);
}

async function list({ limit, offset }, client) {
  const rows = await many(
    `select ${PROF_COLS}, count(*) over()::int as total
     from public.nguoi_dung
     order by ngay_tao desc
     limit $1 offset $2`,
    [limit, offset],
    client
  );
  return { rows, total: rows[0]?.total || 0 };
}

async function upsertProfile(profile, client) {
  return one(
    `insert into public.nguoi_dung (id, ho_ten, so_dien_thoai, vai_tro, dang_hoat_dong, ngay_luu_tru)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (id) do update set
       ho_ten = excluded.ho_ten,
       so_dien_thoai = excluded.so_dien_thoai,
       vai_tro = excluded.vai_tro,
       dang_hoat_dong = excluded.dang_hoat_dong,
       ngay_luu_tru = excluded.ngay_luu_tru,
       ngay_cap_nhat = now()
     returning ${PROF_COLS}`,
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
    `update public.nguoi_dung
     set ho_ten = coalesce($2, ho_ten),
         so_dien_thoai = coalesce($3, so_dien_thoai),
         vai_tro = coalesce($4, vai_tro),
         dang_hoat_dong = coalesce($5, dang_hoat_dong),
         ngay_luu_tru = $6,
         ngay_cap_nhat = now()
     where id = $1
     returning ${PROF_COLS}`,
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
