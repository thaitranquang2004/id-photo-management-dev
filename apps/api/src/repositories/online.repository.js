const { one, many } = require('../db/pool');

// Alias cột về tên tiếng Anh để intake.service + frontend không phải đổi (p = prefix bảng, vd 'orq.').
const reqCols = (p = '') => `${p}id, ${p}ho_ten as full_name, ${p}so_dien_thoai as phone, ${p}email,
  ${p}loai_the_id as card_type_id, ${p}loai_yeu_cau as request_type, ${p}ghi_chu as note, ${p}trang_thai as status,
  ${p}don_da_tao_id as converted_order_id, ${p}khach_hang_id as customer_id, ${p}ip_hash, ${p}user_agent, ${p}metadata,
  ${p}nguoi_duyet as reviewed_by, ${p}ngay_duyet as reviewed_at, ${p}ngay_tao as created_at, ${p}ngay_cap_nhat as updated_at`;
const rpCols = (p = '') => `${p}id, ${p}yeu_cau_online_id as online_request_id,
  ${p}cloudinary_anh_goc_id as cloudinary_original_public_id, ${p}metadata_anh_goc as original_asset_metadata,
  ${p}rong_px as width_px, ${p}cao_px as height_px, ${p}dung_luong_bytes as file_size_bytes,
  ${p}ngay_don_dep as purged_at, ${p}ngay_tao as created_at`;
const aptCols = (p = '') => `${p}id, ${p}yeu_cau_online_id as online_request_id, ${p}don_hang_id as order_id,
  ${p}ten_khach as customer_name, ${p}so_dien_thoai as phone, ${p}ngay_hen as preferred_date, ${p}khung_gio as time_slot,
  ${p}trang_thai as status, ${p}ghi_chu as note, ${p}nguoi_xac_nhan as confirmed_by,
  ${p}ngay_tao as created_at, ${p}ngay_cap_nhat as updated_at`;

async function createRequest(data, client) {
  return one(
    `insert into public.yeu_cau_online (
       id, ho_ten, so_dien_thoai, email, loai_the_id, loai_yeu_cau, ghi_chu, ip_hash, user_agent, metadata
     )
     values (coalesce($1, extensions.gen_random_uuid()), $2, $3, $4, $5, $6, $7, $8, $9, $10)
     returning ${reqCols()}`,
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
    `insert into public.anh_yeu_cau_online (
       yeu_cau_online_id, cloudinary_anh_goc_id, metadata_anh_goc,
       rong_px, cao_px, dung_luong_bytes
     )
     values ($1, $2, $3, $4, $5, $6)
     returning ${rpCols()}`,
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
    where.push(`orq.trang_thai = $${params.length}`);
  }

  params.push(limit, offset);
  const rows = await many(
    `select ${reqCols('orq.')}, ct.ten as card_type_name,
            (select count(*)::int from public.anh_yeu_cau_online orp where orp.yeu_cau_online_id = orq.id) as photo_count,
            count(*) over()::int as total
     from public.yeu_cau_online orq
     left join public.loai_the ct on ct.id = orq.loai_the_id
     where ${where.join(' and ')}
     order by orq.ngay_tao desc
     limit $${params.length - 1} offset $${params.length}`,
    params,
    client
  );
  return { rows, total: rows[0]?.total || 0 };
}

async function findRequestById(id, client) {
  return one(`select ${reqCols()} from public.yeu_cau_online where id = $1`, [id], client);
}

// Public, customer-facing: limited safe fields, gated by id + phone match.
async function findPublicStatus(requestId, phone, client) {
  return one(
    `select r.id, r.trang_thai as status, r.loai_yeu_cau as request_type, r.ngay_tao as created_at,
            o.order_code as converted_order_code,
            a.preferred_date, a.time_slot, a.status as appointment_status
     from public.yeu_cau_online r
     left join public.orders o on o.id = r.don_da_tao_id
     left join lateral (
       select ngay_hen as preferred_date, khung_gio as time_slot, trang_thai as status
       from public.lich_hen
       where yeu_cau_online_id = r.id
       order by ngay_tao desc
       limit 1
     ) a on true
     where r.id = $1
       and regexp_replace(r.so_dien_thoai, '[^0-9]', '', 'g') = regexp_replace($2, '[^0-9]', '', 'g')`,
    [requestId, phone],
    client
  );
}

async function requestDetails(id, client) {
  const request = await one(
    `select ${reqCols('orq.')}, ct.ten as card_type_name, ct.ma_viet_tat as card_type_short_code
     from public.yeu_cau_online orq
     left join public.loai_the ct on ct.id = orq.loai_the_id
     where orq.id = $1`,
    [id],
    client
  );
  if (!request) return null;

  const [photos, appointment] = await Promise.all([
    many(`select ${rpCols()} from public.anh_yeu_cau_online where yeu_cau_online_id = $1 order by ngay_tao`, [id], client),
    one(`select ${aptCols()} from public.lich_hen where yeu_cau_online_id = $1 order by ngay_tao desc limit 1`, [id], client)
  ]);
  return { request, photos, appointment };
}

async function requestPhotos(requestId, client) {
  return many(
    `select ${rpCols()} from public.anh_yeu_cau_online where yeu_cau_online_id = $1 order by ngay_tao`,
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
     returning ${reqCols()}`,
    [id, data.status, data.note || null, actorId || null],
    client
  );
}

async function linkConverted(id, { order_id, customer_id }, client) {
  return one(
    `update public.yeu_cau_online
     set trang_thai = 'converted',
         don_da_tao_id = $2,
         khach_hang_id = $3,
         ngay_duyet = now(),
         ngay_cap_nhat = now()
     where id = $1
     returning ${reqCols()}`,
    [id, order_id, customer_id],
    client
  );
}

async function createAppointment(data, client) {
  return one(
    `insert into public.lich_hen (
       yeu_cau_online_id, don_hang_id, ten_khach, so_dien_thoai, ngay_hen, khung_gio, trang_thai, ghi_chu, nguoi_xac_nhan
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     returning ${aptCols()}`,
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
    `select ${aptCols()} from public.lich_hen where yeu_cau_online_id = $1 order by ngay_tao desc limit 1`,
    [requestId],
    client
  );
}

async function linkAppointmentOrder(id, orderId, client) {
  return one(
    `update public.lich_hen set don_hang_id = $2, ngay_cap_nhat = now() where id = $1 returning ${aptCols()}`,
    [id, orderId],
    client
  );
}

async function listAppointments(filters, { limit, offset }, client) {
  const params = [];
  const where = ['1 = 1'];

  if (filters.status) {
    params.push(filters.status);
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
    `select ${aptCols('a.')}, o.order_code, count(*) over()::int as total
     from public.lich_hen a
     left join public.orders o on o.id = a.don_hang_id
     where ${where.join(' and ')}
     order by a.ngay_hen asc, a.ngay_tao desc
     limit $${params.length - 1} offset $${params.length}`,
    params,
    client
  );
  return { rows, total: rows[0]?.total || 0 };
}

async function findAppointmentById(id, client) {
  return one(`select ${aptCols()} from public.lich_hen where id = $1`, [id], client);
}

async function updateAppointmentStatus(id, data, actorId, client) {
  return one(
    `update public.lich_hen
     set trang_thai = $2,
         ghi_chu = coalesce($3, ghi_chu),
         nguoi_xac_nhan = case when $2 in ('confirmed', 'done') then $4 else nguoi_xac_nhan end,
         ngay_cap_nhat = now()
     where id = $1
     returning ${aptCols()}`,
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
