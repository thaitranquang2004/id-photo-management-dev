const { one, many } = require('../db/pool');

function isOnlineFilePricingTableMissing(error) {
  return error?.code === '42P01'
    && String(error.message || '').includes('bang_gia_file_truc_tuyen');
}

async function listCardTypes(client) {
  // Trả về cột thật của loai_the (tiếng Việt) + giá hiện hành (field ghép: *_hien_hanh).
  return many(
    `select ct.*,
            p.id as bang_gia_hien_hanh_id,
            p.gia_moi_ban as gia_moi_ban_hien_hanh,
            p.phi_xu_ly as phi_xu_ly_hien_hanh
     from public.loai_the ct
     left join lateral (
       select *
       from public.bang_gia p
       where p.loai_the_id = ct.id
         and p.hieu_luc_tu <= current_date
         and (p.hieu_luc_den is null or p.hieu_luc_den >= current_date)
       order by p.hieu_luc_tu desc
       limit 1
     ) p on true
     where ct.dang_hoat_dong = true
     order by ct.thu_tu_hien_thi, ct.ten`,
    [],
    client
  );
}

async function findCardType(id, client) {
  return one('select * from public.loai_the where id = $1', [id], client);
}

async function createCardType(data, client) {
  return one(
    `insert into public.loai_the (
       ten, ma_viet_tat, rong_mm, cao_mm, mau_nen, yeu_cau, thu_tu_hien_thi
     )
     values ($1, $2, $3, $4, $5, $6, $7)
     returning *`,
    [
      data.ten,
      data.ma_viet_tat,
      data.rong_mm,
      data.cao_mm,
      data.mau_nen,
      data.yeu_cau || {},
      data.thu_tu_hien_thi || 0
    ],
    client
  );
}

async function updateCardType(id, patch, client) {
  return one(
    `update public.loai_the
     set ten = coalesce($2, ten),
         ma_viet_tat = coalesce($3, ma_viet_tat),
         rong_mm = coalesce($4, rong_mm),
         cao_mm = coalesce($5, cao_mm),
         mau_nen = coalesce($6, mau_nen),
         yeu_cau = coalesce($7, yeu_cau),
         thu_tu_hien_thi = coalesce($8, thu_tu_hien_thi),
         ngay_cap_nhat = now()
     where id = $1
     returning *`,
    [
      id,
      patch.ten ?? null,
      patch.ma_viet_tat ?? null,
      patch.rong_mm ?? null,
      patch.cao_mm ?? null,
      patch.mau_nen ?? null,
      patch.yeu_cau ?? null,
      patch.thu_tu_hien_thi ?? null
    ],
    client
  );
}

async function archiveCardType(id, client) {
  return one(
    `update public.loai_the
     set dang_hoat_dong = false,
         ngay_luu_tru = now(),
         ngay_cap_nhat = now()
     where id = $1
     returning *`,
    [id],
    client
  );
}

async function listPricing(cardTypeId, client) {
  return many(
    `select p.*, ct.ten as ten_loai_the
     from public.bang_gia p
     join public.loai_the ct on ct.id = p.loai_the_id
     where ($1::uuid is null or p.loai_the_id = $1)
     order by p.loai_the_id, p.hieu_luc_tu desc`,
    [cardTypeId || null],
    client
  );
}

async function listOnlineFilePricing(client) {
  return many(
    `select p.*, u.ho_ten as nguoi_tao_ten
     from public.bang_gia_file_truc_tuyen p
     left join public.nguoi_dung u on u.id = p.nguoi_tao
     order by p.hieu_luc_tu desc, p.ngay_tao desc`,
    [],
    client
  );
}

async function lockOnlineFilePricing(client) {
  return many(
    `select id, gia_tron_goi,
            hieu_luc_tu::text as hieu_luc_tu,
            hieu_luc_den::text as hieu_luc_den
     from public.bang_gia_file_truc_tuyen
     order by hieu_luc_tu
     for update`,
    [],
    client
  );
}

async function getCurrentOnlineFilePricing(effectiveDate, client) {
  return one(
    `select *
     from public.bang_gia_file_truc_tuyen
     where hieu_luc_tu <= $1::date
       and (hieu_luc_den is null or hieu_luc_den >= $1::date)
     order by hieu_luc_tu desc
     limit 1
     for share`,
    [effectiveDate],
    client
  );
}

// During a rolling deploy, web/API code can reach an environment before its
// migration is applied. Catalog screens should remain usable; order creation
// still uses the strict function above and is blocked safely.
async function getCurrentOnlineFilePricingOrNull(effectiveDate, client) {
  try {
    return await getCurrentOnlineFilePricing(effectiveDate, client);
  } catch (error) {
    if (isOnlineFilePricingTableMissing(error)) return null;
    throw error;
  }
}

async function closeOpenOnlineFilePricing(effectiveTo, client) {
  return many(
    `update public.bang_gia_file_truc_tuyen
     set hieu_luc_den = $1::date,
         ngay_cap_nhat = now()
     where hieu_luc_den is null
       and hieu_luc_tu <= $1::date
     returning *`,
    [effectiveTo],
    client
  );
}

async function insertOnlineFilePricing(data, actorId, client) {
  return one(
    `insert into public.bang_gia_file_truc_tuyen (
       gia_tron_goi, hieu_luc_tu, hieu_luc_den, nguoi_tao
     )
     values ($1, $2, $3, $4)
     returning *`,
    [
      data.gia_tron_goi,
      data.hieu_luc_tu,
      data.hieu_luc_den || null,
      actorId || null
    ],
    client
  );
}

async function lockPricingForCardType(cardTypeId, client) {
  return many(
    `select id, loai_the_id,
            hieu_luc_tu::text as hieu_luc_tu,
            hieu_luc_den::text as hieu_luc_den
     from public.bang_gia
     where loai_the_id = $1
     order by hieu_luc_tu
     for update`,
    [cardTypeId],
    client
  );
}

async function getCurrentPricing(cardTypeId, effectiveDate, client) {
  return one(
    `select p.id, p.loai_the_id, p.gia_moi_ban, p.phi_xu_ly, p.hieu_luc_tu, p.hieu_luc_den,
            ct.ten as ten_loai_the, ct.rong_mm, ct.cao_mm, ct.mau_nen
     from public.bang_gia p
     join public.loai_the ct on ct.id = p.loai_the_id
     where p.loai_the_id = $1
       and p.hieu_luc_tu <= $2::date
       and (p.hieu_luc_den is null or p.hieu_luc_den >= $2::date)
     order by p.hieu_luc_tu desc
     limit 1`,
    [cardTypeId, effectiveDate],
    client
  );
}

async function closeOpenPricing(cardTypeId, effectiveTo, client) {
  return many(
    `update public.bang_gia
     set hieu_luc_den = $2::date
     where loai_the_id = $1
       and hieu_luc_den is null
       and hieu_luc_tu <= $2::date
     returning *`,
    [cardTypeId, effectiveTo],
    client
  );
}

// Archive dừng hiệu lực ngay trong ngày archive. Lịch sử giá vẫn được giữ lại
// để các đơn cũ và trang Bảng giá có thể truy vết đúng tên loại thẻ.
async function closeActivePricingForCardType(cardTypeId, effectiveTo, client) {
  return many(
    `update public.bang_gia
     set hieu_luc_den = $2::date
     where loai_the_id = $1
       and hieu_luc_tu <= $2::date
       and (hieu_luc_den is null or hieu_luc_den > $2::date)
     returning *`,
    [cardTypeId, effectiveTo],
    client
  );
}

async function insertPricing(data, actorId, client) {
  return one(
    `insert into public.bang_gia (
       loai_the_id, gia_moi_ban, phi_xu_ly, hieu_luc_tu, hieu_luc_den, nguoi_tao
     )
     values ($1, $2, $3, $4, $5, $6)
     returning *`,
    [
      data.loai_the_id,
      data.gia_moi_ban,
      data.phi_xu_ly,
      data.hieu_luc_tu,
      data.hieu_luc_den || null,
      actorId
    ],
    client
  );
}

module.exports = {
  listCardTypes,
  findCardType,
  createCardType,
  updateCardType,
  archiveCardType,
  listPricing,
  listOnlineFilePricing,
  lockOnlineFilePricing,
  getCurrentOnlineFilePricing,
  getCurrentOnlineFilePricingOrNull,
  isOnlineFilePricingTableMissing,
  closeOpenOnlineFilePricing,
  insertOnlineFilePricing,
  lockPricingForCardType,
  getCurrentPricing,
  closeOpenPricing,
  closeActivePricingForCardType,
  insertPricing
};
