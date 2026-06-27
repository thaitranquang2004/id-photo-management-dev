const { one, many } = require('../db/pool');
const { orderCols } = require('./orders.repository');

// Alias cột khach_hang về tiếng Anh để customer.service + frontend không phải đổi.
const CUST_COLS = `id, ho_ten as full_name, so_dien_thoai as phone, email, ghi_chu as notes,
  dang_hoat_dong as is_active, ngay_luu_tru as archived_at, nguoi_tao as created_by,
  ngay_tao as created_at, ngay_cap_nhat as updated_at`;

async function list({ phone, limit, offset }, client) {
  const params = [];
  const where = ['dang_hoat_dong = true'];

  if (phone) {
    params.push(`%${phone}%`);
    where.push(`so_dien_thoai ilike $${params.length}`);
  }

  params.push(limit, offset);

  const rows = await many(
    `select ${CUST_COLS}, count(*) over()::int as total
     from public.khach_hang
     where ${where.join(' and ')}
     order by ngay_tao desc
     limit $${params.length - 1} offset $${params.length}`,
    params,
    client
  );

  return { rows, total: rows[0]?.total || 0 };
}

async function findById(id, client) {
  return one(`select ${CUST_COLS} from public.khach_hang where id = $1`, [id], client);
}

async function findByPhone(phone, client) {
  return one(
    `select ${CUST_COLS} from public.khach_hang
     where so_dien_thoai = $1 and dang_hoat_dong = true
     order by ngay_tao desc
     limit 1`,
    [phone],
    client
  );
}

async function create(data, actorId, client) {
  return one(
    `insert into public.khach_hang (ho_ten, so_dien_thoai, email, ghi_chu, nguoi_tao)
     values ($1, $2, $3, $4, $5)
     returning ${CUST_COLS}`,
    [data.full_name, data.phone, data.email || null, data.notes || null, actorId],
    client
  );
}

async function update(id, patch, client) {
  return one(
    `update public.khach_hang
     set ho_ten = coalesce($2, ho_ten),
         so_dien_thoai = coalesce($3, so_dien_thoai),
         email = coalesce($4, email),
         ghi_chu = coalesce($5, ghi_chu),
         ngay_cap_nhat = now()
     where id = $1
     returning ${CUST_COLS}`,
    [id, patch.full_name ?? null, patch.phone ?? null, patch.email ?? null, patch.notes ?? null],
    client
  );
}

async function archive(id, client) {
  return one(
    `update public.khach_hang
     set dang_hoat_dong = false,
         ngay_luu_tru = now(),
         ngay_cap_nhat = now()
     where id = $1
     returning ${CUST_COLS}`,
    [id],
    client
  );
}

async function countOrders(customerId, client) {
  const row = await one('select count(*)::int as count from public.don_hang where khach_hang_id = $1', [customerId], client);
  return row?.count || 0;
}

async function recentOrders(customerId, client) {
  return many(
    `select ${orderCols('o.')}, ct.ten as card_type_name
     from public.don_hang o
     join public.loai_the ct on ct.id = o.loai_the_id
     where o.khach_hang_id = $1
     order by o.ngay_tao desc
     limit 10`,
    [customerId],
    client
  );
}

// Tất cả ảnh đã duyệt của 1 khách qua mọi đơn (mới nhất trước). Kèm order_code để biết ảnh thuộc đơn nào.
async function approvedPhotos(customerId, client) {
  return many(
    `select p.id, p.trang_thai, p.ngay_tao, p.ngay_don_dep,
            p.cloudinary_anh_xu_ly_id, p.cloudinary_anh_goc_id,
            p.metadata_anh_xu_ly, p.metadata_anh_goc,
            o.ma_don as order_code
     from public.anh p
     join public.don_hang o on o.id = p.don_hang_id
     where o.khach_hang_id = $1 and p.trang_thai = 'approved'
     order by p.ngay_tao desc
     limit 100`,
    [customerId],
    client
  );
}

async function printLayouts(customerId, { limit, offset }, client) {
  const rows = await many(
    `select pl.*, count(*) over()::int as total
     from public.bo_cuc_in pl
     join public.don_hang o on o.id = pl.don_hang_id
     where o.khach_hang_id = $1
     order by pl.ngay_tao desc
     limit $2 offset $3`,
    [customerId, limit, offset],
    client
  );
  return { rows, total: rows[0]?.total || 0 };
}

module.exports = {
  list,
  findById,
  findByPhone,
  create,
  update,
  archive,
  countOrders,
  recentOrders,
  approvedPhotos,
  printLayouts
};
