const { one, many } = require('../db/pool');

async function findById(id, client) {
  return one('select * from public.nguoi_dung where id = $1', [id], client);
}

async function list({ limit, offset }, client) {
  const rows = await many(
    `select *, count(*) over()::int as total
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
     returning *`,
    [
      profile.id,
      profile.ho_ten,
      profile.so_dien_thoai || null,
      profile.vai_tro,
      profile.dang_hoat_dong,
      profile.ngay_luu_tru || null
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
     returning *`,
    [
      id,
      patch.ho_ten ?? null,
      patch.so_dien_thoai ?? null,
      patch.vai_tro ?? null,
      patch.dang_hoat_dong ?? null,
      Object.prototype.hasOwnProperty.call(patch, 'ngay_luu_tru') ? patch.ngay_luu_tru : current.ngay_luu_tru
    ],
    client
  );
}

module.exports = { findById, list, upsertProfile, updateProfile };
