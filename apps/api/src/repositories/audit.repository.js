const { one } = require('../db/pool');

async function insertAuditLog(entry, client) {
  return one(
    `insert into public.nhat_ky_he_thong (
       nguoi_thuc_hien, hanh_dong, loai_doi_tuong, doi_tuong_id, du_lieu_cu, du_lieu_moi, dia_chi_ip, user_agent
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     returning *`,
    [
      entry.nguoi_thuc_hien || null,
      entry.hanh_dong,
      entry.loai_doi_tuong,
      entry.doi_tuong_id || null,
      entry.du_lieu_cu || null,
      entry.du_lieu_moi || null,
      entry.dia_chi_ip || null,
      entry.user_agent || null
    ],
    client
  );
}

module.exports = { insertAuditLog };
