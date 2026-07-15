const { one, many } = require('../db/pool');

async function list(filters, { limit, offset }, client) {
  const params = [];
  const where = ['1 = 1'];

  if (filters.trang_thai) {
    params.push(filters.trang_thai);
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
  // ma_don/so_dien_thoai được lưu snapshot trên yeu_cau_in_lai nhưng có thể NULL
  // (dữ liệu tạo trong giai đoạn đổi tên field). Lấy dự phòng từ đơn gốc qua don_hang_id.
  // coalesce đặt sau prr.* nên ghi đè cột cùng tên (pg: cột trùng tên -> giá trị sau thắng).
  const rows = await many(
    `select prr.*,
            coalesce(prr.ma_don, o.ma_don) as ma_don,
            coalesce(prr.so_dien_thoai, kh.so_dien_thoai) as so_dien_thoai,
            count(*) over()::int as total
     from public.yeu_cau_in_lai prr
     left join public.don_hang o on o.id = prr.don_hang_id
     left join public.khach_hang kh on kh.id = o.khach_hang_id
     where ${where.join(' and ')}
     order by prr.ngay_tao desc
     limit $${params.length - 1} offset $${params.length}`,
    params,
    client
  );
  return { rows, total: rows[0]?.total || 0 };
}

async function findById(id, client) {
  return one('select * from public.yeu_cau_in_lai where id = $1', [id], client);
}

async function details(id, client) {
  const request = await findById(id, client);
  if (!request) return null;
  const order = await one(
    `select o.*, kh.so_dien_thoai as sdt_khach_hang
     from public.don_hang o
     left join public.khach_hang kh on kh.id = o.khach_hang_id
     where o.id = $1`,
    [request.don_hang_id],
    client
  );
  const photos = request.danh_sach_anh_id?.length
    ? await many(`select * from public.anh where id = any($1::uuid[])`, [request.danh_sach_anh_id], client)
    : [];
  return { request, order, photos };
}

async function create(data, client) {
  return one(
    `insert into public.yeu_cau_in_lai (
       don_hang_id, danh_sach_anh_id, so_luong, so_dien_thoai,
       ma_don, ly_do, ghi_chu, ip_hash, user_agent
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     returning *`,
    [
      data.don_hang_id,
      data.danh_sach_anh_id || [],
      data.so_luong,
      data.so_dien_thoai || null,
      data.ma_don || null,
      data.ly_do || null,
      data.ghi_chu || null,
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
     returning *`,
    [id, data.trang_thai, data.ghi_chu || null, actorId],
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
     returning *`,
    [id, orderId, actorId],
    client
  );
}

module.exports = { list, findById, details, create, updateStatus, linkOrder };
