const { one, many } = require('../db/pool');
const { PHOTO_COLS } = require('./photos.repository');

async function list(filters, { limit, offset }, client) {
  const params = [];
  const where = ['1 = 1'];

  if (filters.status) {
    params.push(filters.status);
    where.push(`o.status = $${params.length}`);
  }
  if (filters.created_by) {
    params.push(filters.created_by);
    where.push(`o.created_by = $${params.length}`);
  }
  if (filters.intake_source) {
    params.push(filters.intake_source);
    where.push(`o.intake_source = $${params.length}`);
  }
  if (filters.date_from) {
    params.push(filters.date_from);
    where.push(`o.created_at >= $${params.length}`);
  }
  if (filters.date_to) {
    params.push(filters.date_to);
    where.push(`o.created_at <= $${params.length}`);
  }

  params.push(limit, offset);

  const rows = await many(
    `select o.*, c.ho_ten as customer_name, c.so_dien_thoai as customer_phone,
            ct.ten as card_type_name, count(*) over()::int as total
     from public.orders o
     join public.khach_hang c on c.id = o.customer_id
     join public.loai_the ct on ct.id = o.card_type_id
     where ${where.join(' and ')}
     order by o.created_at desc
     limit $${params.length - 1} offset $${params.length}`,
    params,
    client
  );
  return { rows, total: rows[0]?.total || 0 };
}

async function findById(id, client) {
  return one('select * from public.orders where id = $1', [id], client);
}

async function findByIdForUpdate(id, client) {
  return one('select * from public.orders where id = $1 for update', [id], client);
}

async function findByCodeAndPhone(orderCode, phone, client) {
  return one(
    `select o.*, ct.ten as card_type_name
     from public.orders o
     join public.khach_hang c on c.id = o.customer_id
     join public.loai_the ct on ct.id = o.card_type_id
     where o.order_code = $1
       and regexp_replace(c.so_dien_thoai, '[^0-9]', '', 'g') = regexp_replace($2, '[^0-9]', '', 'g')`,
    [orderCode, phone],
    client
  );
}

async function details(id, client) {
  const order = await one(
    `select o.*, c.ho_ten as customer_name, c.so_dien_thoai as customer_phone,
            ct.ten as card_type_name, ct.ma_viet_tat as card_type_short_code
     from public.orders o
     join public.khach_hang c on c.id = o.customer_id
     join public.loai_the ct on ct.id = o.card_type_id
     where o.id = $1`,
    [id],
    client
  );
  if (!order) return null;

  const [pricingSnapshot, photos, printLayouts, appointment] = await Promise.all([
    one('select * from public.ban_luu_gia where don_hang_id = $1', [id], client),
    many(`select ${PHOTO_COLS} from public.anh where don_hang_id = $1 order by ngay_tao desc`, [id], client),
    many('select * from public.bo_cuc_in where don_hang_id = $1 order by ngay_tao desc', [id], client),
    one(`select id, yeu_cau_online_id as online_request_id, don_hang_id as order_id, ten_khach as customer_name,
                so_dien_thoai as phone, ngay_hen as preferred_date, khung_gio as time_slot, trang_thai as status,
                ghi_chu as note, nguoi_xac_nhan as confirmed_by, ngay_tao as created_at, ngay_cap_nhat as updated_at
         from public.lich_hen where don_hang_id = $1 order by ngay_tao desc limit 1`, [id], client)
  ]);

  return { order, pricing_snapshot: pricingSnapshot, photos, print_layouts: printLayouts, appointment };
}

// Order code format: IN-T{month}{year}-{seq3}, e.g. IN-T62026-001. The sequence
// restarts each month. Advisory lock serializes allocation so there are no gaps/collisions.
async function createOrder(data, actorId, totalAmount, client) {
  await client.query("select pg_advisory_xact_lock(hashtext('id_photo_order_code'))");
  return one(
    `with px as (
       select 'IN-T' || extract(month from now())::int || extract(year from now())::int || '-' as prefix
     )
     insert into public.orders (
       order_code, customer_id, card_type_id, created_by, status, total_amount, quantity,
       pickup_date, notes, intake_source, delivery_method
     )
     select
       (select prefix from px) || lpad(
         (coalesce(
            (select max(substring(o.order_code from '[0-9]+$')::int)
             from public.orders o
             where o.order_code like (select prefix from px) || '%'),
            0) + 1)::text, 3, '0'),
       $1, $2, $3, 'pending', $4, $5, $6, $7, $8, $9
     returning *`,
    [
      data.customer_id,
      data.card_type_id,
      actorId,
      totalAmount,
      data.quantity,
      data.pickup_date || null,
      data.notes || null,
      data.intake_source || 'walk_in',
      data.delivery_method || 'pickup'
    ],
    client
  );
}

async function markReadyNotified(id, client) {
  return one(
    `update public.orders set ready_notified_at = now(), updated_at = now() where id = $1 returning *`,
    [id],
    client
  );
}

async function setAmountPaid(id, amountPaid, client) {
  return one(
    `update public.orders set amount_paid = $2, updated_at = now() where id = $1 returning *`,
    [id, amountPaid],
    client
  );
}

async function createPricingSnapshot(order, pricing, totalAmount, client) {
  return one(
    `insert into public.ban_luu_gia (
       don_hang_id, bang_gia_id, loai_the_id, ten_loai_the, rong_mm, cao_mm,
       mau_nen, gia_moi_ban, phi_xu_ly, so_luong, tong_tien
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     returning *`,
    [
      order.id,
      pricing.id,
      pricing.card_type_id,
      pricing.card_type_name,
      pricing.width_mm,
      pricing.height_mm,
      pricing.background_color,
      pricing.price_per_copy,
      pricing.processing_fee,
      order.quantity,
      totalAmount
    ],
    client
  );
}

async function updateStatus(id, status, patch, client) {
  return one(
    `update public.orders
     set status = $2,
         cancelled_reason = coalesce($3, cancelled_reason),
         completed_at = case when $2 = 'completed' then now() else completed_at end,
         delivered_at = case when $2 = 'delivered' then now() else delivered_at end,
         updated_at = now()
     where id = $1
     returning *`,
    [id, status, patch?.cancelled_reason || null],
    client
  );
}

async function countApprovedPhotos(orderId, client) {
  const row = await one(
    `select count(*)::int as count
     from public.anh
     where don_hang_id = $1 and trang_thai = 'approved'`,
    [orderId],
    client
  );
  return row?.count || 0;
}

async function countGeneratedLayouts(orderId, client) {
  const row = await one(
    `select count(*)::int as count
     from public.bo_cuc_in
     where don_hang_id = $1 and trang_thai = 'generated'`,
    [orderId],
    client
  );
  return row?.count || 0;
}

module.exports = {
  list,
  findById,
  findByIdForUpdate,
  findByCodeAndPhone,
  details,
  createOrder,
  markReadyNotified,
  setAmountPaid,
  createPricingSnapshot,
  updateStatus,
  countApprovedPhotos,
  countGeneratedLayouts
};
