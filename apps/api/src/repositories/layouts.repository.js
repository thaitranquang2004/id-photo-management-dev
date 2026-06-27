const { one, many } = require('../db/pool');

async function findById(id, client) {
  return one('select * from public.bo_cuc_in where id = $1', [id], client);
}

async function getWithItems(id, client) {
  const printLayout = await findById(id, client);
  if (!printLayout) return null;
  const items = await many(
    `select pli.*, p.trang_thai as trang_thai_anh
     from public.chi_tiet_bo_cuc pli
     join public.anh p on p.id = pli.anh_id
     where pli.bo_cuc_id = $1
     order by pli.vi_tri`,
    [id],
    client
  );
  return { print_layout: printLayout, items };
}

async function createLayout(data, actorId, client) {
  return one(
    `insert into public.bo_cuc_in (
       don_hang_id, nguoi_tao, kieu_bo_cuc, kho_giay, dpi, them_chu, trang_thai,
       cloudinary_id, cau_hinh_bo_cuc, metadata_file, dung_luong_bytes, metadata_khac
     )
     values ($1, $2, $3, $4, $5, $6, 'generated', $7, $8, $9, $10, $11)
     returning *`,
    [
      data.don_hang_id,
      actorId,
      data.kieu_bo_cuc,
      data.kho_giay,
      data.dpi || 300,
      data.them_chu || false,
      data.cloudinary_id,
      data.cau_hinh_bo_cuc || {},
      data.metadata_file || {},
      data.dung_luong_bytes || null,
      data.metadata || {}
    ],
    client
  );
}

async function createItems(layoutId, photoIds, client) {
  const values = photoIds.map((_, index) => `($1, $${index + 2}, ${index})`).join(', ');
  return many(
    `insert into public.chi_tiet_bo_cuc (bo_cuc_id, anh_id, vi_tri)
     values ${values}
     returning *`,
    [layoutId, ...photoIds],
    client
  );
}

async function createIssue(layoutId, data, actorId, client) {
  return one(
    `insert into public.loi_bo_cuc (bo_cuc_id, loai_loi, ghi_chu, nguoi_bao)
     values ($1, $2, $3, $4)
     returning *`,
    [layoutId, data.loai_loi, data.ghi_chu || null, actorId],
    client
  );
}

async function markNeedsFix(layoutId, client) {
  return one(
    `update public.bo_cuc_in
     set trang_thai = 'needs_fix'
     where id = $1
     returning *`,
    [layoutId],
    client
  );
}

async function generatedByOrder(orderId, client) {
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
  findById,
  getWithItems,
  createLayout,
  createItems,
  createIssue,
  markNeedsFix,
  generatedByOrder
};
