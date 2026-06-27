const { one, many } = require('../db/pool');

async function create(data, client) {
  return one(
    `insert into public.anh (
       don_hang_id, cloudinary_anh_goc_id, metadata_anh_goc,
       rong_px, cao_px, dung_luong_bytes
     )
     values ($1, $2, $3, $4, $5, $6)
     returning *`,
    [
      data.don_hang_id,
      data.cloudinary_anh_goc_id,
      data.metadata_anh_goc || {},
      data.rong_px || null,
      data.cao_px || null,
      data.dung_luong_bytes || null
    ],
    client
  );
}

async function findById(id, client) {
  return one(`select * from public.anh where id = $1`, [id], client);
}

async function findManyByIds(ids, client) {
  return many(`select * from public.anh where id = any($1::uuid[])`, [ids], client);
}

async function findApprovedByOrder(orderId, client) {
  return many(
    `select *
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
     returning *`,
    [id, status, patch?.loi_xu_ly || null],
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
     returning *`,
    [
      id,
      data.cloudinary_anh_xu_ly_id,
      data.metadata_anh_xu_ly || {},
      data.diem_chat_luong ?? null,
      JSON.stringify(data.loi_chat_luong || []),
      data.trang_thai_qc || null,
      data.ai_da_ap_dung || null
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
     returning *`,
    [id, data.diem_chat_luong ?? null, JSON.stringify(data.loi_chat_luong || []), data.trang_thai_qc],
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
     returning *`,
    [id, message],
    client
  );
}

async function createProcessingJob(data, actorId, client) {
  return one(
    `insert into public.tac_vu_xu_ly (
       don_hang_id, nguoi_yeu_cau, nha_cung_cap, trang_thai, kiem_tra_nghiem_ngat, che_do_xu_ly, so_anh
     )
     values ($1, $2, $3, 'queued', $4, $5, $6)
     returning *`,
    [
      data.don_hang_id,
      actorId,
      data.nha_cung_cap || 'google_ai',
      data.kiem_tra_nghiem_ngat || false,
      data.che_do_xu_ly || 'safe_assist',
      data.danh_sach_anh_id.length
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
     returning *`,
    [photoIds, jobId],
    client
  );
}

async function findProcessingJob(id, client) {
  return one('select * from public.tac_vu_xu_ly where id = $1', [id], client);
}

async function markJobStarted(id, client) {
  return one(
    `update public.tac_vu_xu_ly
     set trang_thai = 'processing',
         bat_dau_luc = coalesce(bat_dau_luc, now())
     where id = $1
     returning *`,
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
     returning *`,
    [
      id,
      patch.trang_thai,
      patch.so_da_xu_ly,
      patch.so_that_bai,
      patch.loi || null
    ],
    client
  );
}

async function photosForJob(jobId, client) {
  return many(
    `select *
     from public.anh
     where tac_vu_xu_ly_id = $1
     order by ngay_tao desc`,
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
