const { one, many } = require('../db/pool');
const { PHOTO_COLS } = require('./photos.repository');

// Alias cột yeu_cau_in_lai về tiếng Anh (p = prefix, vd 'prr.') để service + frontend không phải đổi.
const rprCols = (p = '') => `${p}id, ${p}don_hang_id as order_id, ${p}danh_sach_anh_id as requested_photo_ids,
  ${p}bo_cuc_id as requested_layout_id, ${p}so_luong as quantity, ${p}so_dien_thoai as phone, ${p}ma_don as order_code,
  ${p}ly_do as reason, ${p}ghi_chu as note, ${p}trang_thai as status, ${p}ip_hash, ${p}user_agent,
  ${p}ngay_tao as created_at, ${p}nguoi_duyet as reviewed_by, ${p}ngay_duyet as reviewed_at, ${p}don_in_lai_id as reprint_order_id`;

async function list(filters, { limit, offset }, client) {
  const params = [];
  const where = ['1 = 1'];

  if (filters.status) {
    params.push(filters.status);
    where.push(`prr.trang_thai = $${params.length}`);
  }
  if (filters.date_from) {
    params.push(filters.date_from);
    where.push(`prr.ngay_tao >= $${params.length}`);
  }
  if (filters.date_to) {
    params.push(filters.date_to);
    where.push(`prr.ngay_tao <= $${params.length}`);
  }

  params.push(limit, offset);
  const rows = await many(
    `select ${rprCols('prr.')}, count(*) over()::int as total
     from public.yeu_cau_in_lai prr
     where ${where.join(' and ')}
     order by prr.ngay_tao desc
     limit $${params.length - 1} offset $${params.length}`,
    params,
    client
  );
  return { rows, total: rows[0]?.total || 0 };
}

async function findById(id, client) {
  return one(`select ${rprCols()} from public.yeu_cau_in_lai where id = $1`, [id], client);
}

async function details(id, client) {
  const request = await findById(id, client);
  if (!request) return null;
  const order = await one('select * from public.orders where id = $1', [request.order_id], client);
  const photos = request.requested_photo_ids?.length
    ? await many(`select ${PHOTO_COLS} from public.anh where id = any($1::uuid[])`, [request.requested_photo_ids], client)
    : [];
  return { request, order, photos };
}

async function create(data, client) {
  return one(
    `insert into public.yeu_cau_in_lai (
       don_hang_id, danh_sach_anh_id, bo_cuc_id, so_luong, so_dien_thoai,
       ma_don, ly_do, ghi_chu, ip_hash, user_agent
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     returning ${rprCols()}`,
    [
      data.order_id,
      data.photo_ids || [],
      data.layout_id || null,
      data.quantity,
      data.phone || null,
      data.order_code || null,
      data.reason || null,
      data.note || null,
      data.ip_hash || null,
      data.user_agent || null
    ],
    client
  );
}

async function updateStatus(id, data, actorId, client) {
  return one(
    `update public.yeu_cau_in_lai
     set trang_thai = $2,
         ghi_chu = coalesce($3, ghi_chu),
         nguoi_duyet = $4,
         ngay_duyet = now()
     where id = $1
     returning ${rprCols()}`,
    [id, data.status, data.note || null, actorId],
    client
  );
}

async function linkOrder(id, orderId, actorId, client) {
  return one(
    `update public.yeu_cau_in_lai
     set trang_thai = 'accepted',
         don_in_lai_id = $2,
         nguoi_duyet = $3,
         ngay_duyet = now()
     where id = $1
     returning ${rprCols()}`,
    [id, orderId, actorId],
    client
  );
}

module.exports = { list, findById, details, create, updateStatus, linkOrder };
