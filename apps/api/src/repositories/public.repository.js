const { one, many } = require('../db/pool');

async function findOrderByTokenHash(tokenHash, client) {
  return one(
    `select o.*, ct.name as card_type_name
     from public.customer_access_tokens cat
     join public.orders o on o.id = cat.order_id
     join public.card_types ct on ct.id = o.card_type_id
     where cat.token_hash = $1
       and cat.revoked_at is null
       and cat.expires_at > now()`,
    [tokenHash],
    client
  );
}

async function logLookupEvent(event, client) {
  return one(
    `insert into public.public_lookup_events (
       order_id, photo_id, action, result, phone, order_code, success,
       ip_hash, user_agent, metadata
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     returning *`,
    [
      event.order_id || null,
      event.photo_id || null,
      event.action || 'lookup',
      event.result || 'failed',
      event.phone || null,
      event.order_code || null,
      event.success || false,
      event.ip_hash || null,
      event.user_agent || null,
      event.metadata || {}
    ],
    client
  );
}

async function approvedPhotoForPublic(photoId, orderId, client) {
  return one(
    `select *
     from public.photos
     where id = $1 and order_id = $2 and status = 'approved'`,
    [photoId, orderId],
    client
  );
}

async function approvedPhotos(orderId, client) {
  return many(
    `select *
     from public.photos
     where order_id = $1 and status = 'approved'
     order by created_at desc`,
    [orderId],
    client
  );
}

async function generatedLayouts(orderId, client) {
  return many(
    `select *
     from public.print_layouts
     where order_id = $1 and status = 'generated'
     order by created_at desc`,
    [orderId],
    client
  );
}

module.exports = {
  findOrderByTokenHash,
  logLookupEvent,
  approvedPhotoForPublic,
  approvedPhotos,
  generatedLayouts
};
