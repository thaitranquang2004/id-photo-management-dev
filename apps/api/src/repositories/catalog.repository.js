const { one, many } = require('../db/pool');

async function listCardTypes(client) {
  // Trả về cột thật của loai_the (tiếng Việt) + giá hiện hành (alias tiếng Anh: current_*).
  return many(
    `select ct.*,
            p.id as current_pricing_id,
            p.gia_moi_ban as current_price_per_copy,
            p.phi_xu_ly as current_processing_fee
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
  // Alias về tiếng Anh: hàm này nuôi engine xử lý ảnh/AI/layout (photo/google-ai/layout.service)
  // vốn đọc cardType.width_mm/background_color..., nên giữ ổn định để không phải sửa engine.
  return one(
    `select id, ten as name, ma_viet_tat as short_code, rong_mm as width_mm, cao_mm as height_mm,
            mau_nen as background_color, yeu_cau as requirements, thu_tu_hien_thi as display_order,
            dang_hoat_dong as is_active, ngay_luu_tru as archived_at, ngay_tao as created_at, ngay_cap_nhat as updated_at
     from public.loai_the where id = $1`,
    [id],
    client
  );
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
    `select *
     from public.bang_gia
     where ($1::uuid is null or loai_the_id = $1)
     order by loai_the_id, hieu_luc_tu desc`,
    [cardTypeId || null],
    client
  );
}

async function lockPricingForCardType(cardTypeId, client) {
  return many(
    `select *
     from public.bang_gia
     where loai_the_id = $1
     order by hieu_luc_tu
     for update`,
    [cardTypeId],
    client
  );
}

async function getCurrentPricing(cardTypeId, effectiveDate, client) {
  // Output alias tiếng Anh để engine tạo đơn (order.service/createPricingSnapshot) không phải đổi.
  return one(
    `select p.id, p.loai_the_id as card_type_id,
            p.gia_moi_ban as price_per_copy, p.phi_xu_ly as processing_fee,
            p.hieu_luc_tu as effective_from, p.hieu_luc_den as effective_to,
            ct.ten as card_type_name, ct.rong_mm as width_mm, ct.cao_mm as height_mm,
            ct.mau_nen as background_color
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
  lockPricingForCardType,
  getCurrentPricing,
  closeOpenPricing,
  insertPricing
};
