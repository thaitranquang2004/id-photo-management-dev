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
         updated_at = now()
     where id = $1
     returning *`,
    [id, status, patch?.processing_error || null],
    client
  );
}

async function markProcessed(id, data, client) {
  return one(
    `update public.photos
     set status = 'processed',
         cloudinary_processed_public_id = $2,
         processed_asset_metadata = $3,
         quality_score = $4,
         quality_issues = $5,
         qc_status = coalesce($6, qc_status),
         qc_checked_at = now(),
         ai_assist_applied = coalesce($7::jsonb, ai_assist_applied),
         processing_error = null,
         processed_at = now(),
         updated_at = now()
     where id = $1
     returning *`,
    [
      id,
      data.cloudinary_processed_public_id,
      data.processed_asset_metadata || {},
      data.quality_score ?? null,
      JSON.stringify(data.quality_issues || []),
      data.qc_status || null,
      data.ai_assist_applied || null
    ],
    client
  );
}

async function updateQc(id, data, client) {
  return one(
    `update public.photos
     set quality_score = $2,
         quality_issues = $3,
         qc_status = $4,
         qc_checked_at = now(),
         updated_at = now()
     where id = $1
     returning *`,
    [id, data.quality_score ?? null, JSON.stringify(data.quality_issues || []), data.qc_status],
    client
  );
}

async function markProcessingFailed(id, message, client) {
  return one(
    `update public.photos
     set status = 'rejected',
         processing_error = $2,
         updated_at = now()
     where id = $1
     returning *`,
    [id, message],
    client
  );
}

// Alias cột tac_vu_xu_ly về tên tiếng Anh để engine photo.service + frontend không phải đổi.
const JOB_COLS = `id, don_hang_id as order_id, nguoi_yeu_cau as requested_by, nha_cung_cap as provider,
  trang_thai as status, kiem_tra_nghiem_ngat as strict_quality_check, che_do_xu_ly as processing_mode,
  so_anh as photo_count, so_da_xu_ly as processed_count, so_that_bai as failed_count,
  loi as error_message, bat_dau_luc as started_at, hoan_tat_luc as completed_at, ngay_tao as created_at`;

async function createProcessingJob(data, actorId, client) {
  return one(
    `insert into public.tac_vu_xu_ly (
       don_hang_id, nguoi_yeu_cau, nha_cung_cap, trang_thai, kiem_tra_nghiem_ngat, che_do_xu_ly, so_anh
     )
     values ($1, $2, $3, 'queued', $4, $5, $6)
     returning ${JOB_COLS}`,
    [
      data.order_id,
      actorId,
      data.provider || 'google_ai',
      data.strict_quality_check || false,
      data.processing_mode || 'safe_assist',
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
  return one(`select ${JOB_COLS} from public.tac_vu_xu_ly where id = $1`, [id], client);
}

async function markJobStarted(id, client) {
  return one(
    `update public.tac_vu_xu_ly
     set trang_thai = 'processing',
         bat_dau_luc = coalesce(bat_dau_luc, now())
     where id = $1
     returning ${JOB_COLS}`,
    [id],
    client
  );
}

async function finishProcessingJob(id, patch, client) {
  return one(
    `update public.tac_vu_xu_ly
     set trang_thai = $2,
         so_da_xu_ly = $3,
         so_that_bai = $4,
         loi = $5,
         hoan_tat_luc = now()
     where id = $1
     returning ${JOB_COLS}`,
    [
      id,
      patch.status,
      patch.processed_count,
      patch.failed_count,
      patch.error_message || null
    ],
    client
  );
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
  markProcessed,
  updateQc,
  markProcessingFailed,
  createProcessingJob,
  markPhotosProcessing,
  findProcessingJob,
  markJobStarted,
  finishProcessingJob,
  photosForJob
};
