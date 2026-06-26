const { one, many } = require('../db/pool');

async function dashboard(client) {
  const [orders, revenue, customers, photos] = await Promise.all([
    one('select count(*)::int as total from public.don_hang', [], client),
    one("select coalesce(sum(tong_tien), 0)::numeric as total from public.don_hang where trang_thai in ('completed', 'delivered')", [], client),
    one("select count(*)::int as total from public.khach_hang where ngay_tao >= now() - interval '30 days'", [], client),
    one("select count(*)::int as total from public.anh where trang_thai in ('processed', 'approved')", [], client)
  ]);

  return {
    orders_total: orders.total,
    revenue_total: revenue.total,
    new_customers_30d: customers.total,
    processed_photos_total: photos.total
  };
}

async function orderReport(filters, client) {
  const params = [];
  const where = ['1 = 1'];
  if (filters.date_from) {
    params.push(filters.date_from);
    where.push(`o.ngay_tao >= $${params.length}`);
  }
  if (filters.date_to) {
    params.push(filters.date_to);
    where.push(`o.ngay_tao <= $${params.length}`);
  }
  if (filters.card_type_id) {
    params.push(filters.card_type_id);
    where.push(`o.loai_the_id = $${params.length}`);
  }
  if (filters.staff_id) {
    params.push(filters.staff_id);
    where.push(`o.nguoi_tao = $${params.length}`);
  }
  if (filters.status) {
    params.push(filters.status);
    where.push(`o.trang_thai = $${params.length}`);
  }

  return many(
    `select o.ma_don as order_code, o.trang_thai as status, o.tong_tien as total_amount,
            o.da_thanh_toan as amount_paid, o.so_luong as quantity, o.ngay_tao as created_at,
            c.ho_ten as customer_name, c.so_dien_thoai as customer_phone,
            ct.ten as card_type_name,
            p.ho_ten as staff_name
     from public.don_hang o
     join public.khach_hang c on c.id = o.khach_hang_id
     join public.loai_the ct on ct.id = o.loai_the_id
     join public.nguoi_dung p on p.id = o.nguoi_tao
     where ${where.join(' and ')}
     order by o.ngay_tao desc`,
    params,
    client
  );
}

module.exports = { dashboard, orderReport };
