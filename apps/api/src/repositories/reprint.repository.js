const { one, many } = require('../db/pool');

async function list(filters, { limit, offset }, client) {
  const params = [];
  const where = ['1 = 1'];

  if (filters.status) {
    params.push(filters.status);
    where.push(`prr.status = $${params.length}`);
  }
  if (filters.date_from) {
    params.push(filters.date_from);
    where.push(`prr.created_at >= $${params.length}`);
  }
  if (filters.date_to) {
    params.push(filters.date_to);
    where.push(`prr.created_at <= $${params.length}`);
  }

  params.push(limit, offset);
  const rows = await many(
    `select prr.*, count(*) over()::int as total
     from public.public_reprint_requests prr
     where ${where.join(' and ')}
     order by prr.created_at desc
     limit $${params.length - 1} offset $${params.length}`,
    params,
    client
  );
  return { rows, total: rows[0]?.total || 0 };
}

async function findById(id, client) {
  return one('select * from public.public_reprint_requests where id = $1', [id], client);
}

async function details(id, client) {
  const request = await findById(id, client);
  if (!request) return null;
  const order = await one('select * from public.orders where id = $1', [request.order_id], client);
  const photos = request.requested_photo_ids?.length
    ? await many('select * from public.photos where id = any($1::uuid[])', [request.requested_photo_ids], client)
    : [];
  return { request, order, photos };
}

async function create(data, client) {
  return one(
    `insert into public.public_reprint_requests (
       order_id, requested_photo_ids, requested_layout_id, quantity, phone,
       order_code, reason, note, ip_hash, user_agent
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     returning *`,
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
    `update public.public_reprint_requests
     set status = $2,
         note = coalesce($3, note),
         reviewed_by = $4,
         reviewed_at = now()
     where id = $1
     returning *`,
    [id, data.status, data.note || null, actorId],
    client
  );
}

async function linkOrder(id, orderId, actorId, client) {
  return one(
    `update public.public_reprint_requests
     set status = 'accepted',
         reprint_order_id = $2,
         reviewed_by = $3,
         reviewed_at = now()
     where id = $1
     returning *`,
    [id, orderId, actorId],
    client
  );
}

module.exports = { list, findById, details, create, updateStatus, linkOrder };
