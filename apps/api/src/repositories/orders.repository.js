const { one, many } = require('../db/pool');

async function list(filters, { limit, offset }, client) {
  const params = [];
  const where = ['1 = 1'];

  if (filters.trang_thai) {
    params.push(filters.trang_thai);
    where.push(`o.trang_thai = $${params.length}`);
  }
  if (filters.nguoi_tao) {
    params.push(filters.nguoi_tao);
    where.push(`o.nguoi_tao = $${params.length}`);
  }
  if (filters.nguon_don) {
    params.push(filters.nguon_don);
    where.push(`o.nguon_don = $${params.length}`);
  }
  if (filters.date_from) {
    params.push(filters.date_from);
    where.push(`o.ngay_tao >= $${params.length}`);
  }
  if (filters.date_to) {
    params.push(filters.date_to);
    where.push(`o.ngay_tao <= $${params.length}`);
  }
  if (filters.chua_thanh_toan) {
    // Đơn đã hủy không còn là khoản cần staff theo dõi thu tiền.
    where.push(`coalesce(o.da_thanh_toan, 0) < coalesce(o.tong_tien, 0)`);
    where.push(`o.trang_thai <> 'da_huy'`);
  }

  params.push(limit, offset);

  const rows = await many(
    `select o.*, c.ho_ten as ten_khach_hang, c.so_dien_thoai as sdt_khach_hang,
            ct.ten as ten_loai_the, count(*) over()::int as total
     from public.don_hang o
     join public.khach_hang c on c.id = o.khach_hang_id
     join public.loai_the ct on ct.id = o.loai_the_id
     where ${where.join(' and ')}
     order by o.ngay_tao desc
     limit $${params.length - 1} offset $${params.length}`,
    params,
    client
  );
  return { rows, total: rows[0]?.total || 0 };
}

async function findById(id, client) {
  return one(`select * from public.don_hang where id = $1`, [id], client);
}

async function findByIdForUpdate(id, client) {
  return one(`select * from public.don_hang where id = $1 for update`, [id], client);
}

async function findByCodeAndPhone(orderCode, phone, client) {
  return one(
    `select o.*, ct.ten as ten_loai_the
     from public.don_hang o
     join public.khach_hang c on c.id = o.khach_hang_id
     join public.loai_the ct on ct.id = o.loai_the_id
     where o.ma_don = $1
       and regexp_replace(c.so_dien_thoai, '[^0-9]', '', 'g') = regexp_replace($2, '[^0-9]', '', 'g')`,
    [orderCode, phone],
    client
  );
}

async function details(id, client) {
  const order = await one(
    `select o.*, c.ho_ten as ten_khach_hang, c.so_dien_thoai as sdt_khach_hang,
            ct.ten as ten_loai_the, ct.ma_viet_tat as ma_viet_tat_loai_the
     from public.don_hang o
     join public.khach_hang c on c.id = o.khach_hang_id
     join public.loai_the ct on ct.id = o.loai_the_id
     where o.id = $1`,
    [id],
    client
  );
  if (!order) return null;

  const [pricingSnapshot, photos, appointment] = await Promise.all([
    one('select * from public.ban_luu_gia where don_hang_id = $1', [id], client),
    many(`select * from public.anh where don_hang_id = $1 order by ngay_tao desc`, [id], client),
    one('select * from public.lich_hen where don_hang_id = $1 order by ngay_tao desc limit 1', [id], client)
  ]);

  return { order, pricing_snapshot: pricingSnapshot, photos, appointment };
}

// Order code format: IN-T{month}{year}-{seq3}, e.g. IN-T62026-001. The sequence
// restarts each month. Advisory lock serializes allocation so there are no gaps/collisions.
async function createOrder(data, actorId, totalAmount, client) {
  await client.query("select pg_advisory_xact_lock(hashtext('id_photo_order_code'))");
  return one(
    `with px as (
       select 'IN-T' || extract(month from now())::int || extract(year from now())::int || '-' as prefix
     )
     insert into public.don_hang (
       id, ma_don, khach_hang_id, loai_the_id, nguoi_tao, trang_thai, tong_tien, so_luong,
       ngay_hen_lay, ghi_chu, nguon_don, hinh_thuc_giao
     )
     select
       coalesce($1, extensions.gen_random_uuid()),
       (select prefix from px) || lpad(
         (coalesce(
            (select max(substring(o.ma_don from '[0-9]+$')::int)
             from public.don_hang o
             where o.ma_don like (select prefix from px) || '%'),
            0) + 1)::text, 3, '0'),
       $2, $3, $4, 'cho_xu_ly', $5, $6, $7, $8, $9, $10
     returning *`,
    [
      data.id || null,
      data.khach_hang_id,
      data.loai_the_id,
      actorId || null,
      totalAmount,
      data.so_luong,
      data.ngay_hen_lay || null,
      data.ghi_chu || null,
      data.nguon_don || 'tai_tiem',
      data.hinh_thuc_giao || 'lay_hinh_ngay'
    ],
    client
  );
}

async function markReadyNotified(id, client) {
  return one(
    `update public.don_hang set ngay_bao_san_sang = now(), ngay_cap_nhat = now() where id = $1 returning *`,
    [id],
    client
  );
}

async function setAmountPaid(id, amountPaid, client) {
  return one(
    `update public.don_hang set da_thanh_toan = $2, ngay_cap_nhat = now() where id = $1 returning *`,
    [id, amountPaid],
    client
  );
}

async function createPricingSnapshot(order, pricing, totalAmount, client, options = {}) {
  const cardType = options.cardType || pricing;
  const onlineFilePricing = options.onlineFilePricing || null;
  return one(
    `insert into public.ban_luu_gia (
       don_hang_id, bang_gia_id, loai_the_id, ten_loai_the, rong_mm, cao_mm,
       mau_nen, gia_moi_ban, phi_xu_ly, so_luong, tong_tien,
       bang_gia_file_truc_tuyen_id, gia_file_truc_tuyen
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     returning *`,
    [
      order.id,
      pricing?.id || null,
      cardType.loai_the_id || cardType.id,
      cardType.ten_loai_the || cardType.ten,
      cardType.rong_mm,
      cardType.cao_mm,
      cardType.mau_nen,
      pricing?.gia_moi_ban ?? null,
      pricing?.phi_xu_ly ?? null,
      order.so_luong,
      totalAmount,
      onlineFilePricing?.id || null,
      onlineFilePricing?.gia_tron_goi ?? null
    ],
    client
  );
}

async function updateStatus(id, status, patch, client) {
  return one(
    `update public.don_hang
     set trang_thai = $2,
         ly_do_huy = coalesce($3, ly_do_huy),
         ngay_hoan_tat = case when $2 = 'hoan_tat' then now() else ngay_hoan_tat end,
         ngay_giao = case when $2 = 'da_giao' then now() else ngay_giao end,
         ngay_cap_nhat = now()
     where id = $1
     returning *`,
    [id, status, patch?.cancelled_reason || null],
    client
  );
}

async function countApprovedPhotos(orderId, client) {
  const row = await one(
    `select count(*)::int as count
     from public.anh
     where don_hang_id = $1 and trang_thai = 'da_duyet'`,
    [orderId],
    client
  );
  return row?.count || 0;
}

module.exports = {
  list,
  findById,
  findByIdForUpdate,
  findByCodeAndPhone,
  details,
  createOrder,
  markReadyNotified,
  setAmountPaid,
  createPricingSnapshot,
  updateStatus,
  countApprovedPhotos
};
