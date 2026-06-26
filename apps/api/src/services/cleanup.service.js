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
    `select ph.id, ph.cloudinary_original_public_id, ph.cloudinary_processed_public_id
     from public.photos ph
     join public.orders o on o.id = ph.order_id
     where o.created_at < now() - interval '${PURGE_AFTER_DAYS} days' and ph.purged_at is null`
  );
  for (const p of oldPhotos) {
    await assetService.destroyAsset(p.cloudinary_original_public_id);
    if (p.cloudinary_processed_public_id) await assetService.destroyAsset(p.cloudinary_processed_public_id);
    await query('update public.photos set purged_at = now() where id = $1', [p.id]);
    photos += 1;
  }

  const oldLayouts = await many(
    `select pl.id, pl.cloudinary_id
     from public.bo_cuc_in pl
     join public.orders o on o.id = pl.don_hang_id
     where o.created_at < now() - interval '${PURGE_AFTER_DAYS} days' and pl.ngay_don_dep is null`
  );
  for (const l of oldLayouts) {
    await assetService.destroyAsset(l.cloudinary_id);
    await query('update public.bo_cuc_in set ngay_don_dep = now() where id = $1', [l.id]);
    layouts += 1;
  }

  const oldRequestPhotos = await many(
    `select rp.id, rp.cloudinary_original_public_id
     from public.online_request_photos rp
     join public.online_requests r on r.id = rp.online_request_id
     where r.created_at < now() - interval '${PURGE_AFTER_DAYS} days' and rp.purged_at is null`
  );
  for (const rp of oldRequestPhotos) {
    await assetService.destroyAsset(rp.cloudinary_original_public_id);
    await query('update public.online_request_photos set purged_at = now() where id = $1', [rp.id]);
    requestPhotos += 1;
  }

  const summary = { photos, layouts, request_photos: requestPhotos };
  logger.info(summary, 'Purged old Cloudinary assets');
  return summary;
}

module.exports = { purgeOldOrders, PURGE_AFTER_DAYS };
