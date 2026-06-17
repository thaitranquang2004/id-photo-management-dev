const { one, many } = require('../db/pool');

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
    `select o.*, c.full_name as customer_name, c.phone as customer_phone,
            ct.name as card_type_name, count(*) over()::int as total
     from public.orders o
     join public.customers c on c.id = o.customer_id
     join public.card_types ct on ct.id = o.card_type_id
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
    `select o.*
     from public.orders o
     join public.customers c on c.id = o.customer_id
     where o.order_code = $1 and c.phone = $2`,
    [orderCode, phone],
    client
  );
}

async function details(id, client) {
  const order = await one(
    `select o.*, c.full_name as customer_name, c.phone as customer_phone,
            ct.name as card_type_name, ct.short_code as card_type_short_code
     from public.orders o
     join public.customers c on c.id = o.customer_id
     join public.card_types ct on ct.id = o.card_type_id
     where o.id = $1`,
    [id],
    client
  );
  if (!order) return null;

  const [pricingSnapshot, photos, printLayouts] = await Promise.all([
    one('select * from public.pricing_snapshots where order_id = $1', [id], client),
    many('select * from public.photos where order_id = $1 order by created_at desc', [id], client),
    many('select * from public.print_layouts where order_id = $1 order by created_at desc', [id], client)
  ]);

  return { order, pricing_snapshot: pricingSnapshot, photos, print_layouts: printLayouts };
}

async function createOrder(data, orderCode, actorId, totalAmount, client) {
  return one(
    `insert into public.orders (
       order_code, customer_id, card_type_id, created_by, status, total_amount, quantity, pickup_date, notes
     )
     values ($1, $2, $3, $4, 'pending', $5, $6, $7, $8)
     returning *`,
    [
      orderCode,
      data.customer_id,
      data.card_type_id,
      actorId,
      totalAmount,
      data.quantity,
      data.pickup_date || null,
      data.notes || null
    ],
    client
  );
}

async function createPricingSnapshot(order, pricing, totalAmount, client) {
  return one(
    `insert into public.pricing_snapshots (
       order_id, pricing_id, card_type_id, card_type_name, width_mm, height_mm,
       background_color, price_per_copy, processing_fee, quantity, total_amount
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
     from public.photos
     where order_id = $1 and status = 'approved'`,
    [orderId],
    client
  );
  return row?.count || 0;
}

async function countGeneratedLayouts(orderId, client) {
  const row = await one(
    `select count(*)::int as count
     from public.print_layouts
     where order_id = $1 and status = 'generated'`,
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
  createPricingSnapshot,
  updateStatus,
  countApprovedPhotos,
  countGeneratedLayouts
};
