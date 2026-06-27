const { one, many } = require('../db/pool');

async function create(data, client) {
  return one(
    `insert into public.nhat_ky_thong_bao (
       kenh, loai_su_kien, nguoi_nhan, tieu_de, noi_dung, trang_thai, don_hang_id, yeu_cau_online_id, metadata
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     returning *`,
    [
      data.channel,
      data.event_type,
      data.recipient,
      data.subject || null,
      data.body || null,
      data.trang_thai || 'pending',
      data.don_hang_id || null,
      data.yeu_cau_online_id || null,
      data.metadata || {}
    ],
    client
  );
}

async function markStatus(id, status, patch = {}, client) {
  return one(
    `update public.nhat_ky_thong_bao
     set trang_thai = $2,
         loi = coalesce($3, loi),
         metadata = metadata || coalesce($4::jsonb, '{}'::jsonb),
         gui_luc = case when $2 in ('sent', 'simulated') then now() else gui_luc end
     where id = $1
     returning *`,
    [id, status, patch.error_message || null, patch.metadata || null],
    client
  );
}

async function list(filters, { limit, offset }, client) {
  const params = [];
  const where = ['1 = 1'];

  if (filters.kenh) {
    params.push(filters.kenh);
    where.push(`kenh = $${params.length}`);
  }
  if (filters.loai_su_kien) {
    params.push(filters.loai_su_kien);
    where.push(`loai_su_kien = $${params.length}`);
  }
  if (filters.don_hang_id) {
    params.push(filters.don_hang_id);
    where.push(`don_hang_id = $${params.length}`);
  }

  params.push(limit, offset);
  const rows = await many(
    `select *, count(*) over()::int as total
     from public.nhat_ky_thong_bao
     where ${where.join(' and ')}
     order by ngay_tao desc
     limit $${params.length - 1} offset $${params.length}`,
    params,
    client
  );
  return { rows, total: rows[0]?.total || 0 };
}

module.exports = { create, markStatus, list };
