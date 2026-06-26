const auditRepository = require('../repositories/audit.repository');

async function writeAudit(action, entityType, entityId, context, data = {}, client) {
  return auditRepository.insertAuditLog(
    {
      nguoi_thuc_hien: context?.user?.id || null,
      hanh_dong: action,
      loai_doi_tuong: entityType,
      doi_tuong_id: entityId,
      du_lieu_cu: data.old_data || null,
      du_lieu_moi: data.new_data || null,
      dia_chi_ip: context?.ip || null,
      user_agent: context?.userAgent || null
    },
    client
  );
}

module.exports = { writeAudit };
