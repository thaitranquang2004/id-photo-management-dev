const { one, many } = require('../db/pool');

async function findOrderByTokenHash(tokenHash, client) {
  return one(
    `select o.*, ct.ten as card_type_name
     from public.ma_truy_cap_khach cat
     join public.don_hang o on o.id = cat.don_hang_id
     join public.loai_the ct on ct.id = o.loai_the_id
     where cat.ma_hash = $1
       and cat.thu_hoi_luc is null
       and cat.het_han_luc > now()`,
    [tokenHash],
    client
  );
}

async function createAccessToken(orderId, tokenHash, expiresAt, client) {
  return one(
    `insert into public.ma_truy_cap_khach (don_hang_id, ma_hash, het_han_luc)
     values ($1, $2, $3)
     returning *`,
    [orderId, tokenHash, expiresAt],
    client
  );
}

async function logLookupEvent(event, client) {
  return one(
    `insert into public.su_kien_tra_cuu (
       don_hang_id, anh_id, hanh_dong, ket_qua, so_dien_thoai, ma_don,
       ip_hash, user_agent, metadata
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     returning id`,
    [
      event.order_id || null,
      event.photo_id || null,
      event.action || 'lookup',
      event.result || 'failed',
      event.phone || null,
      event.order_code || null,
      event.ip_hash || null,
      event.user_agent || null,
      event.metadata || {}
    ],
    client
  );
}

async function approvedPhotoForPublic(photoId, orderId, client) {
  return one(
    `select *
     from public.anh
     where id = $1 and don_hang_id = $2 and trang_thai = 'approved'`,
    [photoId, orderId],
    client
  );
}

async function approvedPhotos(orderId, client) {
  return many(
    `select *
     from public.anh
     where don_hang_id = $1 and trang_thai = 'approved'
     order by ngay_tao desc`,
    [orderId],
    client
  );
}

async function generatedLayouts(orderId, client) {
  return many(
    `select *
     from public.bo_cuc_in
     where don_hang_id = $1 and trang_thai = 'generated'
     order by ngay_tao desc`,
    [orderId],
    client
  );
}

module.exports = {
  findOrderByTokenHash,
  createAccessToken,
  logLookupEvent,
  approvedPhotoForPublic,
  approvedPhotos,
  generatedLayouts
};
