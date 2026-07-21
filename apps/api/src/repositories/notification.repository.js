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
      data.status || data.trang_thai || 'cho_gui',
      data.don_hang_id || data.order_id || null,
      data.yeu_cau_online_id || data.online_request_id || null,
      data.metadata || {}
    ],
    client
  );
}

async function markStatus(id, status, patch = {}, client) {
  return one(
    `update public.nhat_ky_thong_bao
     set trang_thai = $2,
         loi = $3,
         metadata = metadata || coalesce($4::jsonb, '{}'::jsonb),
         gui_luc = case when $2 in ('da_gui', 'mo_phong') then now() else gui_luc end,
         so_lan_thu = coalesce(so_lan_thu, 0) + 1,
         thu_lan_cuoi_luc = now(),
         thu_lai_sau_luc = case
           when $2 = 'that_bai' then now() + make_interval(secs => coalesce($5, 300))
           else null
         end
     where id = $1
     returning *`,
    [id, status, patch.error_message || null, patch.metadata || null, patch.retry_after_seconds || null],
    client
  );
}

async function findById(id, client) {
  return one('select * from public.nhat_ky_thong_bao where id = $1', [id], client);
}

async function dueForDispatch(limit = 50, client) {
  return many(
    `select *
     from public.nhat_ky_thong_bao
     where trang_thai in ('cho_gui', 'that_bai')
       and coalesce(thu_lai_sau_luc, now()) <= now()
     order by coalesce(thu_lai_sau_luc, ngay_tao), ngay_tao
     limit $1`,
    [limit],
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

module.exports = { create, markStatus, findById, dueForDispatch, list };
