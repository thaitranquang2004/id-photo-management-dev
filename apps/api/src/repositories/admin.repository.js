const { one, many } = require('../db/pool');

async function dashboard(client) {
  const [orders, revenue, customers, photos] = await Promise.all([
    one('select count(*)::int as total from public.orders', [], client),
    one("select coalesce(sum(total_amount), 0)::numeric as total from public.orders where status in ('completed', 'delivered')", [], client),
    one("select count(*)::int as total from public.customers where created_at >= now() - interval '30 days'", [], client),
    one("select count(*)::int as total from public.photos where status in ('processed', 'approved')", [], client)
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
    where.push(`o.created_at >= $${params.length}`);
  }
  if (filters.date_to) {
    params.push(filters.date_to);
    where.push(`o.created_at <= $${params.length}`);
  }
  if (filters.card_type_id) {
    params.push(filters.card_type_id);
    where.push(`o.card_type_id = $${params.length}`);
  }
  if (filters.staff_id) {
    params.push(filters.staff_id);
    where.push(`o.created_by = $${params.length}`);
  }
  if (filters.status) {
    params.push(filters.status);
    where.push(`o.status = $${params.length}`);
  }

  return many(
    `select o.order_code, o.status, o.total_amount, o.amount_paid, o.quantity, o.created_at,
            c.full_name as customer_name, c.phone as customer_phone,
            ct.name as card_type_name,
            p.full_name as staff_name
     from public.orders o
     join public.customers c on c.id = o.customer_id
     join public.card_types ct on ct.id = o.card_type_id
     join public.profiles p on p.id = o.created_by
     where ${where.join(' and ')}
     order by o.created_at desc`,
    params,
    client
  );
}

module.exports = { dashboard, orderReport };
