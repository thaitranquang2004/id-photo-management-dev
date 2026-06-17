const { one, many } = require('../db/pool');

async function create(data, client) {
  return one(
    `insert into public.photos (
       order_id, cloudinary_original_public_id, original_asset_metadata,
       width_px, height_px, file_size_bytes
     )
     values ($1, $2, $3, $4, $5, $6)
     returning *`,
    [
      data.order_id,
      data.cloudinary_original_public_id,
      data.original_asset_metadata || {},
      data.width_px || null,
      data.height_px || null,
      data.file_size_bytes || null
    ],
    client
  );
}

async function findById(id, client) {
  return one('select * from public.photos where id = $1', [id], client);
}

async function findManyByIds(ids, client) {
  return many('select * from public.photos where id = any($1::uuid[])', [ids], client);
}

async function findApprovedByOrder(orderId, client) {
  return many(
    `select *
     from public.photos
     where order_id = $1 and status = 'approved'
     order by created_at desc`,
    [orderId],
    client
  );
}

async function updateStatus(id, status, patch, client) {
  return one(
    `update public.photos
     set status = $2,
         approved_at = case when $2 = 'approved' then now() else approved_at end,
         processing_error = coalesce($3, processing_error),
         override_notes = coalesce($4, override_notes),
         updated_at = now()
     where id = $1
     returning *`,
    [id, status, patch?.processing_error || null, patch?.override_notes || null],
    client
  );
}

async function overrideProcessed(id, data, client) {
  return one(
    `update public.photos
     set cloudinary_processed_public_id = $2,
         processed_asset_metadata = coalesce($3, processed_asset_metadata),
         manual_override = true,
         override_notes = $4,
         status = 'processed',
         processed_at = now(),
         updated_at = now()
     where id = $1
     returning *`,
    [id, data.cloudinary_processed_public_id, data.processed_asset_metadata || null, data.notes || null],
    client
  );
}

async function createProcessingJob(data, actorId, client) {
  return one(
    `insert into public.processing_jobs (
       order_id, requested_by, provider, status, strict_quality_check, photo_count
     )
     values ($1, $2, $3, 'queued', $4, $5)
     returning *`,
    [
      data.order_id,
      actorId,
      data.provider || 'cloudinary',
      data.strict_quality_check || false,
      data.photo_ids.length
    ],
    client
  );
}

async function markPhotosProcessing(photoIds, jobId, client) {
  return many(
    `update public.photos
     set status = 'processing',
         last_processing_job_id = $2,
         processing_attempts = processing_attempts + 1,
         updated_at = now()
     where id = any($1::uuid[])
     returning *`,
    [photoIds, jobId],
    client
  );
}

async function findProcessingJob(id, client) {
  return one('select * from public.processing_jobs where id = $1', [id], client);
}

async function photosForJob(jobId, client) {
  return many(
    `select *
     from public.photos
     where last_processing_job_id = $1
     order by created_at desc`,
    [jobId],
    client
  );
}

module.exports = {
  create,
  findById,
  findManyByIds,
  findApprovedByOrder,
  updateStatus,
  overrideProcessed,
  createProcessingJob,
  markPhotosProcessing,
  findProcessingJob,
  photosForJob
};
