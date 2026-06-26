const { one, many } = require('../db/pool');

async function list({ phone, limit, offset }, client) {
  const params = [];
  const where = ['is_active = true'];

  if (phone) {
    params.push(`%${phone}%`);
    where.push(`phone ilike $${params.length}`);
  }

  params.push(limit, offset);

  const rows = await many(
    `select *, count(*) over()::int as total
     from public.customers
     where ${where.join(' and ')}
     order by created_at desc
     limit $${params.length - 1} offset $${params.length}`,
    params,
    client
  );

  return { rows, total: rows[0]?.total || 0 };
}

async function findById(id, client) {
  return one('select * from public.customers where id = $1', [id], client);
}

async function findByPhone(phone, client) {
  return one(
    `select * from public.customers
     where phone = $1 and is_active = true
     order by created_at desc
     limit 1`,
    [phone],
    client
  );
}

async function create(data, actorId, client) {
  return one(
    `insert into public.customers (full_name, phone, email, notes, created_by)
     values ($1, $2, $3, $4, $5)
     returning *`,
    [data.full_name, data.phone, data.email || null, data.notes || null, actorId],
    client
  );
}

async function update(id, patch, client) {
  return one(
    `update public.customers
     set full_name = coalesce($2, full_name),
         phone = coalesce($3, phone),
         email = coalesce($4, email),
         notes = coalesce($5, notes),
         updated_at = now()
     where id = $1
     returning *`,
    [id, patch.full_name ?? null, patch.phone ?? null, patch.email ?? null, patch.notes ?? null],
    client
  );
}

async function archive(id, client) {
  return one(
    `update public.customers
     set is_active = false,
         archived_at = now(),
         updated_at = now()
     where id = $1
     returning *`,
    [id],
    client
  );
}

async function countOrders(customerId, client) {
  const row = await one('select count(*)::int as count from public.orders where customer_id = $1', [customerId], client);
  return row?.count || 0;
}

async function recentOrders(customerId, client) {
  return many(
    `select o.*, ct.ten as card_type_name
     from public.orders o
     join public.loai_the ct on ct.id = o.card_type_id
     where o.customer_id = $1
     order by o.created_at desc
     limit 10`,
    [customerId],
    client
  );
}

// Tất cả ảnh đã duyệt của 1 khách qua mọi đơn (mới nhất trước). Kèm order_code để biết ảnh thuộc đơn nào.
async function approvedPhotos(customerId, client) {
  return many(
    `select p.id, p.trang_thai as status, p.ngay_tao as created_at, p.ngay_don_dep as purged_at,
            p.cloudinary_anh_xu_ly_id as cloudinary_processed_public_id, p.cloudinary_anh_goc_id as cloudinary_original_public_id,
            p.metadata_anh_xu_ly as processed_asset_metadata, p.metadata_anh_goc as original_asset_metadata,
            o.order_code
     from public.anh p
     join public.orders o on o.id = p.don_hang_id
     where o.customer_id = $1 and p.trang_thai = 'approved'
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
     join public.orders o on o.id = pl.don_hang_id
     where o.customer_id = $1
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
