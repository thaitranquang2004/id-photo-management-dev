const { one, many } = require('../db/pool');
const { PHOTO_COLS } = require('./photos.repository');

// Alias cột don_hang về tiếng Anh (p = prefix, vd 'o.') để order.service + frontend không phải đổi.
const orderCols = (p = '') => `${p}id, ${p}ma_don as order_code, ${p}khach_hang_id as customer_id, ${p}loai_the_id as card_type_id,
  ${p}nguoi_tao as created_by, ${p}trang_thai as status, ${p}tong_tien as total_amount, ${p}so_luong as quantity,
  ${p}ngay_hen_lay as pickup_date, ${p}ghi_chu as notes, ${p}ly_do_huy as cancelled_reason,
  ${p}ngay_hoan_tat as completed_at, ${p}ngay_giao as delivered_at, ${p}nguon_don as intake_source,
  ${p}hinh_thuc_giao as delivery_method, ${p}ngay_bao_san_sang as ready_notified_at, ${p}da_thanh_toan as amount_paid,
  ${p}ngay_tao as created_at, ${p}ngay_cap_nhat as updated_at`;

async function list(filters, { limit, offset }, client) {
  const params = [];
  const where = ['1 = 1'];

  if (filters.status) {
    params.push(filters.status);
    where.push(`o.trang_thai = $${params.length}`);
  }
  if (filters.created_by) {
    params.push(filters.created_by);
    where.push(`o.nguoi_tao = $${params.length}`);
  }
  if (filters.intake_source) {
    params.push(filters.intake_source);
    where.push(`o.nguon_don = $${params.length}`);
  }
  if (filters.date_from) {
    params.push(filters.date_from);
    where.push(`o.ngay_tao >= $${params.length}`);
  }
  if (filters.date_to) {
    params.push(filters.date_to);
    where.push(`o.ngay_tao <= $${params.length}`);
  }

  params.push(limit, offset);

  const rows = await many(
    `select ${orderCols('o.')}, c.ho_ten as customer_name, c.so_dien_thoai as customer_phone,
            ct.ten as card_type_name, count(*) over()::int as total
     from public.don_hang o
     join public.khach_hang c on c.id = o.khach_hang_id
     join public.loai_the ct on ct.id = o.loai_the_id
     where ${where.join(' and ')}
     order by o.ngay_tao desc
     limit $${params.length - 1} offset $${params.length}`,
    params,
    client
  );
  return { rows, total: rows[0]?.total || 0 };
}

async function findById(id, client) {
  return one(`select ${orderCols()} from public.don_hang where id = $1`, [id], client);
}

async function findByIdForUpdate(id, client) {
  return one(`select ${orderCols()} from public.don_hang where id = $1 for update`, [id], client);
}

async function findByCodeAndPhone(orderCode, phone, client) {
  return one(
    `select ${orderCols('o.')}, ct.ten as card_type_name
     from public.don_hang o
     join public.khach_hang c on c.id = o.khach_hang_id
     join public.loai_the ct on ct.id = o.loai_the_id
     where o.ma_don = $1
       and regexp_replace(c.so_dien_thoai, '[^0-9]', '', 'g') = regexp_replace($2, '[^0-9]', '', 'g')`,
    [orderCode, phone],
    client
  );
}

async function details(id, client) {
  const order = await one(
    `select ${orderCols('o.')}, c.ho_ten as customer_name, c.so_dien_thoai as customer_phone,
            ct.ten as card_type_name, ct.ma_viet_tat as card_type_short_code
     from public.don_hang o
     join public.khach_hang c on c.id = o.khach_hang_id
     join public.loai_the ct on ct.id = o.loai_the_id
     where o.id = $1`,
    [id],
    client
  );
  if (!order) return null;

  const [pricingSnapshot, photos, printLayouts, appointment] = await Promise.all([
    one('select * from public.ban_luu_gia where don_hang_id = $1', [id], client),
    many(`select ${PHOTO_COLS} from public.anh where don_hang_id = $1 order by ngay_tao desc`, [id], client),
    many('select * from public.bo_cuc_in where don_hang_id = $1 order by ngay_tao desc', [id], client),
    one('select * from public.lich_hen where don_hang_id = $1 order by ngay_tao desc limit 1', [id], client)
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
     insert into public.don_hang (
       ma_don, khach_hang_id, loai_the_id, nguoi_tao, trang_thai, tong_tien, so_luong,
       ngay_hen_lay, ghi_chu, nguon_don, hinh_thuc_giao
     )
     select
       (select prefix from px) || lpad(
         (coalesce(
            (select max(substring(o.ma_don from '[0-9]+$')::int)
             from public.don_hang o
             where o.ma_don like (select prefix from px) || '%'),
            0) + 1)::text, 3, '0'),
       $1, $2, $3, 'pending', $4, $5, $6, $7, $8, $9
     returning ${orderCols()}`,
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
    `update public.don_hang set ngay_bao_san_sang = now(), ngay_cap_nhat = now() where id = $1 returning ${orderCols()}`,
    [id],
    client
  );
}

async function setAmountPaid(id, amountPaid, client) {
  return one(
    `update public.don_hang set da_thanh_toan = $2, ngay_cap_nhat = now() where id = $1 returning ${orderCols()}`,
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
    `update public.don_hang
     set trang_thai = $2,
         ly_do_huy = coalesce($3, ly_do_huy),
         ngay_hoan_tat = case when $2 = 'completed' then now() else ngay_hoan_tat end,
         ngay_giao = case when $2 = 'delivered' then now() else ngay_giao end,
         ngay_cap_nhat = now()
     where id = $1
     returning ${orderCols()}`,
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
  orderCols,
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
