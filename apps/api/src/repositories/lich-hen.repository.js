const { one, many } = require('../db/pool');

async function listKhungGioChup(ngayHen, client) {
  return many(
    `select c.*, coalesce(d.so_cho_da_xac_nhan, 0)::int as so_cho_da_xac_nhan,
            greatest(c.suc_chua_toi_da - coalesce(d.so_cho_da_xac_nhan, 0), 0)::int as so_cho_con_lai
     from public.cau_hinh_khung_gio_chup c
     left join lateral (
       select count(*)::int as so_cho_da_xac_nhan from public.lich_hen l
       where l.loai_lich = 'dat_lich_chup' and l.trang_thai = 'da_xac_nhan'
         and l.ngay_hen = $1 and l.khung_gio = c.khung_gio
     ) d on true
     where c.dang_hoat_dong = true
     order by c.thu_tu, c.khung_gio`, [ngayHen], client);
}

async function listCauHinh(client) {
  return many('select * from public.cau_hinh_khung_gio_chup order by thu_tu, khung_gio', [], client);
}

async function updateCauHinh(id, data, client) {
  return one(`update public.cau_hinh_khung_gio_chup
    set suc_chua_toi_da = coalesce($2, suc_chua_toi_da), dang_hoat_dong = coalesce($3, dang_hoat_dong),
        thu_tu = coalesce($4, thu_tu), ngay_cap_nhat = now() where id = $1 returning *`,
    [id, data.suc_chua_toi_da ?? null, data.dang_hoat_dong ?? null, data.thu_tu ?? null], client);
}

async function findKhungGioForUpdate(khungGio, client) {
  return one('select * from public.cau_hinh_khung_gio_chup where khung_gio = $1 and dang_hoat_dong = true for update', [khungGio], client);
}

async function countDaXacNhan(ngayHen, khungGio, client) {
  const row = await one(`select count(*)::int as count from public.lich_hen
    where loai_lich = 'dat_lich_chup' and trang_thai = 'da_xac_nhan' and ngay_hen = $1 and khung_gio = $2`, [ngayHen, khungGio], client);
  return row?.count || 0;
}

async function create(data, client) {
  return one(`insert into public.lich_hen
    (don_hang_id, ten_khach, so_dien_thoai, email, ngay_hen, khung_gio, loai_lich, trang_thai, ghi_chu, nguoi_xac_nhan)
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *`,
    [data.don_hang_id || null, data.ten_khach, data.so_dien_thoai, data.email || null, data.ngay_hen, data.khung_gio,
      data.loai_lich, data.trang_thai, data.ghi_chu || null, data.nguoi_xac_nhan || null], client);
}

async function list(filters, { limit, offset }, client) {
  const params = []; const where = ['1=1'];
  for (const [key, column, op] of [['trang_thai','l.trang_thai','='], ['loai_lich','l.loai_lich','='], ['date_from','l.ngay_hen','>='], ['date_to','l.ngay_hen','<=']]) {
    if (filters[key]) { params.push(filters[key]); where.push(`${column} ${op} $${params.length}`); }
  }
  params.push(limit, offset);
  const rows = await many(`select l.*, o.ma_don, count(*) over()::int as total from public.lich_hen l
    left join public.don_hang o on o.id=l.don_hang_id where ${where.join(' and ')}
    order by l.ngay_hen, l.khung_gio, l.ngay_tao limit $${params.length - 1} offset $${params.length}`, params, client);
  return { rows, total: rows[0]?.total || 0 };
}

async function findById(id, client, forUpdate = false) {
  return one(`select * from public.lich_hen where id = $1${forUpdate ? ' for update' : ''}`, [id], client);
}

async function updateStatus(id, data, actorId, client) {
  return one(`update public.lich_hen set trang_thai=$2, ghi_chu=coalesce($3,ghi_chu),
    nguoi_xac_nhan=case when $2 in ('da_xac_nhan','da_xong') then $4 else nguoi_xac_nhan end,
    ngay_cap_nhat=now() where id=$1 returning *`, [id, data.trang_thai, data.ghi_chu || null, actorId || null], client);
}

async function ganDonVaHoanTat(id, donHangId, actorId, client) {
  return one(`update public.lich_hen set don_hang_id=$2,trang_thai='da_xong',nguoi_xac_nhan=$3,ngay_cap_nhat=now()
    where id=$1 returning *`, [id, donHangId, actorId || null], client);
}

async function lichCanNhacLayHinh(client) {
  return many(`select * from public.lich_hen where loai_lich='hen_lay_hinh' and trang_thai='da_xac_nhan'
    and email is not null and ngay_nhac_lay_hinh is null and ngay_hen = current_date + 1 order by ngay_hen, khung_gio`, [], client);
}
async function danhDauDaNhac(id, client) { return one('update public.lich_hen set ngay_nhac_lay_hinh=now(), ngay_cap_nhat=now() where id=$1 returning *', [id], client); }

module.exports = { listKhungGioChup, listCauHinh, updateCauHinh, findKhungGioForUpdate, countDaXacNhan, create, list, findById, updateStatus, ganDonVaHoanTat, lichCanNhacLayHinh, danhDauDaNhac };
