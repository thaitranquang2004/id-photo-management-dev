const { many, query } = require('../db/pool');
const assetService = require('./asset.service');
const { logger } = require('../logger');

const PURGE_AFTER_DAYS = 180;

// Delete Cloudinary assets of orders/online-requests older than 6 months and mark
// the rows purged (DB rows kept for history). Best-effort per asset.
async function purgeOldOrders() {
  let photos = 0;
  let layouts = 0;
  let requestPhotos = 0;

  const oldPhotos = await many(
    `select ph.id, ph.cloudinary_anh_goc_id, ph.cloudinary_anh_xu_ly_id
     from public.anh ph
     join public.don_hang o on o.id = ph.don_hang_id
     where o.ngay_tao < now() - interval '${PURGE_AFTER_DAYS} days' and ph.ngay_don_dep is null`
  );
  for (const p of oldPhotos) {
    await assetService.destroyAsset(p.cloudinary_anh_goc_id);
    if (p.cloudinary_anh_xu_ly_id) await assetService.destroyAsset(p.cloudinary_anh_xu_ly_id);
    await query('update public.anh set ngay_don_dep = now() where id = $1', [p.id]);
    photos += 1;
  }

  const oldLayouts = await many(
    `select pl.id, pl.cloudinary_id
     from public.bo_cuc_in pl
     join public.don_hang o on o.id = pl.don_hang_id
     where o.ngay_tao < now() - interval '${PURGE_AFTER_DAYS} days' and pl.ngay_don_dep is null`
  );
  for (const l of oldLayouts) {
    await assetService.destroyAsset(l.cloudinary_id);
    await query('update public.bo_cuc_in set ngay_don_dep = now() where id = $1', [l.id]);
    layouts += 1;
  }

  const oldRequestPhotos = await many(
    `select rp.id, rp.cloudinary_anh_goc_id
     from public.anh_yeu_cau_online rp
     join public.yeu_cau_online r on r.id = rp.yeu_cau_online_id
     where r.ngay_tao < now() - interval '${PURGE_AFTER_DAYS} days' and rp.ngay_don_dep is null`
  );
  for (const rp of oldRequestPhotos) {
    await assetService.destroyAsset(rp.cloudinary_anh_goc_id);
    await query('update public.anh_yeu_cau_online set ngay_don_dep = now() where id = $1', [rp.id]);
    requestPhotos += 1;
  }

  const summary = { photos, layouts, request_photos: requestPhotos };
  logger.info(summary, 'Purged old Cloudinary assets');
  return summary;
}

module.exports = { purgeOldOrders, PURGE_AFTER_DAYS };
