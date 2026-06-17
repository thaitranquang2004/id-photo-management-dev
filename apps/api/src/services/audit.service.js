const auditRepository = require('../repositories/audit.repository');

async function writeAudit(action, entityType, entityId, context, data = {}, client) {
  return auditRepository.insertAuditLog(
    {
      actor_id: context?.user?.id || null,
      action,
      entity_type: entityType,
      entity_id: entityId,
      old_data: data.old_data || null,
      new_data: data.new_data || null,
      ip_address: context?.ip || null,
      user_agent: context?.userAgent || null
    },
    client
  );
}

module.exports = { writeAudit };
