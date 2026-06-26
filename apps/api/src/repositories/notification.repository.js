const { one, many } = require('../db/pool');

async function create(data, client) {
  return one(
    `insert into public.notification_log (
       channel, event_type, recipient, subject, body, status, order_id, online_request_id, metadata
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     returning *`,
    [
      data.channel,
      data.event_type,
      data.recipient,
      data.subject || null,
      data.body || null,
      data.status || 'pending',
      data.order_id || null,
      data.online_request_id || null,
      data.metadata || {}
    ],
    client
  );
}

async function markStatus(id, status, patch = {}, client) {
  return one(
    `update public.notification_log
     set status = $2,
         error_message = coalesce($3, error_message),
         metadata = metadata || coalesce($4::jsonb, '{}'::jsonb),
         sent_at = case when $2 in ('sent', 'simulated') then now() else sent_at end
     where id = $1
     returning *`,
    [id, status, patch.error_message || null, patch.metadata || null],
    client
  );
}

async function list(filters, { limit, offset }, client) {
  const params = [];
  const where = ['1 = 1'];

  if (filters.channel) {
    params.push(filters.channel);
    where.push(`channel = $${params.length}`);
  }
  if (filters.event_type) {
    params.push(filters.event_type);
    where.push(`event_type = $${params.length}`);
  }
  if (filters.order_id) {
    params.push(filters.order_id);
    where.push(`order_id = $${params.length}`);
  }

  params.push(limit, offset);
  const rows = await many(
    `select *, count(*) over()::int as total
     from public.notification_log
     where ${where.join(' and ')}
     order by created_at desc
     limit $${params.length - 1} offset $${params.length}`,
    params,
    client
  );
  return { rows, total: rows[0]?.total || 0 };
}

module.exports = { create, markStatus, list };
