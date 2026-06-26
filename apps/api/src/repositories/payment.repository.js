const { one, many } = require('../db/pool');

async function create(data, client) {
  return one(
    `insert into public.thanh_toan (don_hang_id, loai, so_tien, hinh_thuc, ghi_chu, nguoi_thu)
     values ($1, $2, $3, $4, $5, $6)
     returning *`,
    [data.don_hang_id, data.loai, data.so_tien, data.hinh_thuc || 'cash', data.ghi_chu || null, data.nguoi_thu || null],
    client
  );
}

async function listByOrder(orderId, client) {
  return many(
    `select p.*, pr.full_name as nguoi_thu_ten
     from public.thanh_toan p
     left join public.profiles pr on pr.id = p.nguoi_thu
     where p.don_hang_id = $1
     order by p.ngay_tao desc`,
    [orderId],
    client
  );
}

// Net amount collected: deposits + balance payments minus refunds.
async function sumPaid(orderId, client) {
  const row = await one(
    `select coalesce(sum(case when loai = 'refund' then -so_tien else so_tien end), 0)::numeric as paid
     from public.thanh_toan
     where don_hang_id = $1`,
    [orderId],
    client
  );
  return Number(row?.paid || 0);
}

module.exports = { create, listByOrder, sumPaid };
