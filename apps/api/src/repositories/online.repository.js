const { one, many } = require('../db/pool');

async function createRequest(data, client) {
  return one(
    `insert into public.yeu_cau_online (
       id, ho_ten, so_dien_thoai, email, loai_the_id, loai_yeu_cau, ghi_chu, ip_hash, user_agent, metadata
     )
     values (coalesce($1, extensions.gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9, $10)
     returning *`,
    [
      data.id || null,
      data.ho_ten,
      data.so_dien_thoai,
      data.email || null,
      data.loai_the_id || null,
      data.loai_yeu_cau || 'both',
      data.ghi_chu || null,
      data.ip_hash || null,
      data.user_agent || null,
      data.metadata || {}
    ],
    client
  );
}

async function addRequestPhoto(data, client) {
  return one(
    `insert into public.anh_yeu_cau_online (
       yeu_cau_online_id, cloudinary_anh_goc_id, metadata_anh_goc,
       rong_px, cao_px, dung_luong_bytes
     )
     values ($1, $2, $3, $4, $5, $6)
     returning *`,
    [
      data.yeu_cau_online_id,
      data.cloudinary_anh_goc_id,
      data.metadata_anh_goc || {},
      data.rong_px || null,
      data.cao_px || null,
      data.dung_luong_bytes || null
    ],
    client
  );
}

async function listRequests(filters, { limit, offset }, client) {
  const params = [];
  const where = ['1 = 1'];

  if (filters.trang_thai) {
    params.push(filters.trang_thai);
    where.push(`orq.trang_thai = $${params.length}`);
  }

  params.push(limit, offset);
  const rows = await many(
    `select orq.*, ct.ten as ten_loai_the,
            (select count(*)::int from public.anh_yeu_cau_online orp where orp.yeu_cau_online_id = orq.id) as so_anh,
            lh.ngay_hen, lh.khung_gio, lh.trang_thai as trang_thai_lich_hen,
            count(*) over()::int as total
     from public.yeu_cau_online orq
     left join public.loai_the ct on ct.id = orq.loai_the_id
     left join lateral (
       select ngay_hen, khung_gio, trang_thai
       from public.lich_hen
       where yeu_cau_online_id = orq.id
       order by ngay_tao desc
       limit 1
     ) lh on true
     where ${where.join(' and ')}
     order by orq.ngay_tao desc
     limit $${params.length - 1} offset $${params.length}`,
    params,
    client
  );
  return { rows, total: rows[0]?.total || 0 };
}

async function findRequestById(id, client) {
  return one(`select * from public.yeu_cau_online where id = $1`, [id], client);
}

// Public, customer-facing: limited safe fields, gated by phone match.
// Trả về mọi yêu cầu online của SĐT (mới nhất trước).
async function listPublicStatus(phone, client) {
  return many(
    `select r.id, r.trang_thai, r.loai_yeu_cau, r.ngay_tao,
            o.ma_don as ma_don_da_tao,
            a.ngay_hen, a.khung_gio, a.trang_thai as trang_thai_lich_hen
     from public.yeu_cau_online r
     left join public.don_hang o on o.id = r.don_da_tao_id
     left join lateral (
       select ngay_hen, khung_gio, trang_thai
       from public.lich_hen
       where yeu_cau_online_id = r.id
       order by ngay_tao desc
       limit 1
     ) a on true
     where regexp_replace(r.so_dien_thoai, '[^0-9]', '', 'g') = regexp_replace($1, '[^0-9]', '', 'g')
     order by r.ngay_tao desc
     limit 50`,
    [phone],
    client
  );
}

async function requestDetails(id, client) {
  const request = await one(
    `select orq.*, ct.ten as ten_loai_the, ct.ma_viet_tat as ma_viet_tat_loai_the
     from public.yeu_cau_online orq
     left join public.loai_the ct on ct.id = orq.loai_the_id
     where orq.id = $1`,
    [id],
    client
  );
  if (!request) return null;

  const [photos, appointment] = await Promise.all([
    many(`select * from public.anh_yeu_cau_online where yeu_cau_online_id = $1 order by ngay_tao`, [id], client),
    one(`select * from public.lich_hen where yeu_cau_online_id = $1 order by ngay_tao desc limit 1`, [id], client)
  ]);
  return { request, photos, appointment };
}

async function requestPhotos(requestId, client) {
  return many(
    `select * from public.anh_yeu_cau_online where yeu_cau_online_id = $1 order by ngay_tao`,
    [requestId],
    client
  );
}

async function updateRequestStatus(id, data, actorId, client) {
  return one(
    `update public.yeu_cau_online
     set trang_thai = $2,
         ghi_chu = coalesce($3, ghi_chu),
         nguoi_duyet = $4,
         ngay_duyet = now(),
         ngay_cap_nhat = now()
     where id = $1
     returning *`,
    [id, data.trang_thai, data.ghi_chu || null, actorId || null],
    client
  );
}

async function linkConverted(id, { don_hang_id, khach_hang_id }, client) {
  return one(
    `update public.yeu_cau_online
     set trang_thai = 'converted',
         don_da_tao_id = $2,
         khach_hang_id = $3,
         ngay_duyet = now(),
         ngay_cap_nhat = now()
     where id = $1
     returning *`,
    [id, don_hang_id, khach_hang_id],
    client
  );
}

async function createAppointment(data, client) {
  return one(
    `insert into public.lich_hen (
       yeu_cau_online_id, don_hang_id, ten_khach, so_dien_thoai, email, ngay_hen, khung_gio, loai_lich, trang_thai, ghi_chu, nguoi_xac_nhan
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     returning *`,
    [
      data.yeu_cau_online_id || null,
      data.don_hang_id || null,
      data.ten_khach || null,
      data.so_dien_thoai || null,
      data.email || null,
      data.ngay_hen,
      data.khung_gio,
      data.loai_lich || 'hen_lay_hinh',
      data.trang_thai || 'cho_xac_nhan',
      data.ghi_chu || null,
      data.nguoi_xac_nhan || null
    ],
    client
  );
}

async function findAppointmentByRequest(requestId, client) {
  return one(
    `select * from public.lich_hen where yeu_cau_online_id = $1 order by ngay_tao desc limit 1`,
    [requestId],
    client
  );
}

// Gắn lịch hẹn (mong muốn lấy) của yêu cầu online vào đơn khi convert -> thành lịch
// hẹn LẤY đã xác nhận; cập nhật ngày/giờ nếu staff đổi lúc tạo đơn.
async function linkAppointmentOrder(id, data, client) {
  return one(
    `update public.lich_hen
     set don_hang_id = $2,
         ngay_hen = coalesce($3, ngay_hen),
         khung_gio = coalesce($4, khung_gio),
         loai_lich = 'hen_lay_hinh',
         trang_thai = 'da_xac_nhan',
         ngay_cap_nhat = now()
     where id = $1
     returning *`,
    [id, data.don_hang_id, data.ngay_hen || null, data.khung_gio || null],
    client
  );
}

async function listAppointments(filters, { limit, offset }, client) {
  const params = [];
  const where = ['1 = 1'];

  if (filters.trang_thai) {
    params.push(filters.trang_thai);
    where.push(`a.trang_thai = $${params.length}`);
  }
  if (filters.date_from) {
    params.push(filters.date_from);
    where.push(`a.ngay_hen >= $${params.length}`);
  }
  if (filters.date_to) {
    params.push(filters.date_to);
    where.push(`a.ngay_hen <= $${params.length}`);
  }

  params.push(limit, offset);
  const rows = await many(
    `select a.*, o.ma_don, count(*) over()::int as total
     from public.lich_hen a
     left join public.don_hang o on o.id = a.don_hang_id
     where ${where.join(' and ')}
     order by a.ngay_hen asc, a.ngay_tao desc
     limit $${params.length - 1} offset $${params.length}`,
    params,
    client
  );
  return { rows, total: rows[0]?.total || 0 };
}

async function findAppointmentById(id, client) {
  return one(`select * from public.lich_hen where id = $1`, [id], client);
}

async function updateAppointmentStatus(id, data, actorId, client) {
  return one(
    `update public.lich_hen
     set trang_thai = $2,
         ghi_chu = coalesce($3, ghi_chu),
         nguoi_xac_nhan = case when $2 in ('da_xac_nhan', 'da_xong') then $4 else nguoi_xac_nhan end,
         ngay_cap_nhat = now()
     where id = $1
     returning *`,
    [id, data.trang_thai, data.ghi_chu || null, actorId || null],
    client
  );
}

module.exports = {
  createRequest,
  addRequestPhoto,
  listRequests,
  findRequestById,
  listPublicStatus,
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
