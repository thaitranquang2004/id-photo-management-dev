const { one, many } = require('../db/pool');

async function createRequest(data, client) {
  return one(
    `insert into public.online_requests (
       id, full_name, phone, email, card_type_id, request_type, note, ip_hash, user_agent, metadata
     )
     values (coalesce($1, extensions.gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9, $10)
     returning *`,
    [
      data.id || null,
      data.full_name,
      data.phone,
      data.email || null,
      data.card_type_id || null,
      data.request_type || 'both',
      data.note || null,
      data.ip_hash || null,
      data.user_agent || null,
      data.metadata || {}
    ],
    client
  );
}

async function addRequestPhoto(data, client) {
  return one(
    `insert into public.online_request_photos (
       online_request_id, cloudinary_original_public_id, original_asset_metadata,
       width_px, height_px, file_size_bytes
     )
     values ($1, $2, $3, $4, $5, $6)
     returning *`,
    [
      data.online_request_id,
      data.cloudinary_original_public_id,
      data.original_asset_metadata || {},
      data.width_px || null,
      data.height_px || null,
      data.file_size_bytes || null
    ],
    client
  );
}

async function listRequests(filters, { limit, offset }, client) {
  const params = [];
  const where = ['1 = 1'];

  if (filters.status) {
    params.push(filters.status);
    where.push(`orq.status = $${params.length}`);
  }

  params.push(limit, offset);
  const rows = await many(
    `select orq.*, ct.ten as card_type_name,
            (select count(*)::int from public.online_request_photos orp where orp.online_request_id = orq.id) as photo_count,
            count(*) over()::int as total
     from public.online_requests orq
     left join public.loai_the ct on ct.id = orq.card_type_id
     where ${where.join(' and ')}
     order by orq.created_at desc
     limit $${params.length - 1} offset $${params.length}`,
    params,
    client
  );
  return { rows, total: rows[0]?.total || 0 };
}

async function findRequestById(id, client) {
  return one('select * from public.online_requests where id = $1', [id], client);
}

// Public, customer-facing: limited safe fields, gated by id + phone match.
async function findPublicStatus(requestId, phone, client) {
  return one(
    `select r.id, r.status, r.request_type, r.created_at,
            o.order_code as converted_order_code,
            a.preferred_date, a.time_slot, a.status as appointment_status
     from public.online_requests r
     left join public.orders o on o.id = r.converted_order_id
     left join lateral (
       select preferred_date, time_slot, status
       from public.appointments
       where online_request_id = r.id
       order by created_at desc
       limit 1
     ) a on true
     where r.id = $1
       and regexp_replace(r.phone, '[^0-9]', '', 'g') = regexp_replace($2, '[^0-9]', '', 'g')`,
    [requestId, phone],
    client
  );
}

async function requestDetails(id, client) {
  const request = await one(
    `select orq.*, ct.ten as card_type_name, ct.ma_viet_tat as card_type_short_code
     from public.online_requests orq
     left join public.loai_the ct on ct.id = orq.card_type_id
     where orq.id = $1`,
    [id],
    client
  );
  if (!request) return null;

  const [photos, appointment] = await Promise.all([
    many('select * from public.online_request_photos where online_request_id = $1 order by created_at', [id], client),
    one('select * from public.appointments where online_request_id = $1 order by created_at desc limit 1', [id], client)
  ]);
  return { request, photos, appointment };
}

async function requestPhotos(requestId, client) {
  return many(
    'select * from public.online_request_photos where online_request_id = $1 order by created_at',
    [requestId],
    client
  );
}

async function updateRequestStatus(id, data, actorId, client) {
  return one(
    `update public.online_requests
     set status = $2,
         note = coalesce($3, note),
         reviewed_by = $4,
         reviewed_at = now(),
         updated_at = now()
     where id = $1
     returning *`,
    [id, data.status, data.note || null, actorId || null],
    client
  );
}

async function linkConverted(id, { order_id, customer_id }, client) {
  return one(
    `update public.online_requests
     set status = 'converted',
         converted_order_id = $2,
         customer_id = $3,
         reviewed_at = now(),
         updated_at = now()
     where id = $1
     returning *`,
    [id, order_id, customer_id],
    client
  );
}

async function createAppointment(data, client) {
  return one(
    `insert into public.appointments (
       online_request_id, order_id, customer_name, phone, preferred_date, time_slot, status, note, confirmed_by
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     returning *`,
    [
      data.online_request_id || null,
      data.order_id || null,
      data.customer_name || null,
      data.phone || null,
      data.preferred_date,
      data.time_slot,
      data.status || 'requested',
      data.note || null,
      data.confirmed_by || null
    ],
    client
  );
}

async function findAppointmentByRequest(requestId, client) {
  return one(
    'select * from public.appointments where online_request_id = $1 order by created_at desc limit 1',
    [requestId],
    client
  );
}

async function linkAppointmentOrder(id, orderId, client) {
  return one(
    'update public.appointments set order_id = $2, updated_at = now() where id = $1 returning *',
    [id, orderId],
    client
  );
}

async function listAppointments(filters, { limit, offset }, client) {
  const params = [];
  const where = ['1 = 1'];

  if (filters.status) {
    params.push(filters.status);
    where.push(`a.status = $${params.length}`);
  }
  if (filters.date_from) {
    params.push(filters.date_from);
    where.push(`a.preferred_date >= $${params.length}`);
  }
  if (filters.date_to) {
    params.push(filters.date_to);
    where.push(`a.preferred_date <= $${params.length}`);
  }

  params.push(limit, offset);
  const rows = await many(
    `select a.*, o.order_code, count(*) over()::int as total
     from public.appointments a
     left join public.orders o on o.id = a.order_id
     where ${where.join(' and ')}
     order by a.preferred_date asc, a.created_at desc
     limit $${params.length - 1} offset $${params.length}`,
    params,
    client
  );
  return { rows, total: rows[0]?.total || 0 };
}

async function findAppointmentById(id, client) {
  return one('select * from public.appointments where id = $1', [id], client);
}

async function updateAppointmentStatus(id, data, actorId, client) {
  return one(
    `update public.appointments
     set status = $2,
         note = coalesce($3, note),
         confirmed_by = case when $2 in ('confirmed', 'done') then $4 else confirmed_by end,
         updated_at = now()
     where id = $1
     returning *`,
    [id, data.status, data.note || null, actorId || null],
    client
  );
}

module.exports = {
  createRequest,
  addRequestPhoto,
  listRequests,
  findRequestById,
  findPublicStatus,
  requestDetails,
  requestPhotos,
  updateRequestStatus,
  linkConverted,
  createAppointment,
  findAppointmentByRequest,
  linkAppointmentOrder,
  listAppointments,
  findAppointmentById,
  updateAppointmentStatus
};
