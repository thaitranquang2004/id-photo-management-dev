const { one } = require('../db/pool');

async function insertAuditLog(entry, client) {
  return one(
    `insert into public.audit_logs (
       actor_id, action, entity_type, entity_id, old_data, new_data, ip_address, user_agent
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     returning *`,
    [
      entry.actor_id || null,
      entry.action,
      entry.entity_type,
      entry.entity_id || null,
      entry.old_data || null,
      entry.new_data || null,
      entry.ip_address || null,
      entry.user_agent || null
    ],
    client
  );
}

module.exports = { insertAuditLog };
