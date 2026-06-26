const { one, many } = require('../db/pool');

// Alias cột bảng anh về tên tiếng Anh: engine photo.service + frontend đọc ảnh không phải đổi.
const PHOTO_COLS = `id, don_hang_id as order_id, tac_vu_xu_ly_id as last_processing_job_id,
  cloudinary_anh_goc_id as cloudinary_original_public_id, cloudinary_anh_xu_ly_id as cloudinary_processed_public_id,
  metadata_anh_goc as original_asset_metadata, metadata_anh_xu_ly as processed_asset_metadata,
  rong_px as width_px, cao_px as height_px, dung_luong_bytes as file_size_bytes,
  diem_chat_luong as quality_score, loi_chat_luong as quality_issues,
  loi_xu_ly as processing_error, so_lan_xu_ly as processing_attempts,
  trang_thai as status, trang_thai_qc as qc_status, qc_kiem_luc as qc_checked_at,
  ai_da_ap_dung as ai_assist_applied, ngay_xu_ly as processed_at, ngay_duyet as approved_at,
  ngay_don_dep as purged_at, ngay_tao as created_at, ngay_cap_nhat as updated_at`;

async function create(data, client) {
  return one(
    `insert into public.anh (
       don_hang_id, cloudinary_anh_goc_id, metadata_anh_goc,
       rong_px, cao_px, dung_luong_bytes
     )
     values ($1, $2, $3, $4, $5, $6)
     returning ${PHOTO_COLS}`,
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
  return one(`select ${PHOTO_COLS} from public.anh where id = $1`, [id], client);
}

async function findManyByIds(ids, client) {
  return many(`select ${PHOTO_COLS} from public.anh where id = any($1::uuid[])`, [ids], client);
}

async function findApprovedByOrder(orderId, client) {
  return many(
    `select ${PHOTO_COLS}
     from public.anh
     where don_hang_id = $1 and trang_thai = 'approved'
     order by ngay_tao desc`,
    [orderId],
    client
  );
}

async function updateStatus(id, status, patch, client) {
  return one(
    `update public.anh
     set trang_thai = $2,
         ngay_duyet = case when $2 = 'approved' then now() else ngay_duyet end,
         loi_xu_ly = coalesce($3, loi_xu_ly),
         ngay_cap_nhat = now()
     where id = $1
     returning ${PHOTO_COLS}`,
    [id, status, patch?.processing_error || null],
    client
  );
}

async function markProcessed(id, data, client) {
  return one(
    `update public.anh
     set trang_thai = 'processed',
         cloudinary_anh_xu_ly_id = $2,
         metadata_anh_xu_ly = $3,
         diem_chat_luong = $4,
         loi_chat_luong = $5,
         trang_thai_qc = coalesce($6, trang_thai_qc),
         qc_kiem_luc = now(),
         ai_da_ap_dung = coalesce($7::jsonb, ai_da_ap_dung),
         loi_xu_ly = null,
         ngay_xu_ly = now(),
         ngay_cap_nhat = now()
     where id = $1
     returning ${PHOTO_COLS}`,
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
    `update public.anh
     set diem_chat_luong = $2,
         loi_chat_luong = $3,
         trang_thai_qc = $4,
         qc_kiem_luc = now(),
         ngay_cap_nhat = now()
     where id = $1
     returning ${PHOTO_COLS}`,
    [id, data.quality_score ?? null, JSON.stringify(data.quality_issues || []), data.qc_status],
    client
  );
}

async function markProcessingFailed(id, message, client) {
  return one(
    `update public.anh
     set trang_thai = 'rejected',
         loi_xu_ly = $2,
         ngay_cap_nhat = now()
     where id = $1
     returning ${PHOTO_COLS}`,
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
    `update public.anh
     set trang_thai = 'processing',
         tac_vu_xu_ly_id = $2,
         so_lan_xu_ly = so_lan_xu_ly + 1,
         ngay_cap_nhat = now()
     where id = any($1::uuid[])
     returning ${PHOTO_COLS}`,
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
    `select ${PHOTO_COLS}
     from public.anh
     where tac_vu_xu_ly_id = $1
     order by ngay_tao desc`,
    [jobId],
    client
  );
}

module.exports = {
  PHOTO_COLS,
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
