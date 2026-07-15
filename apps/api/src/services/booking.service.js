const { withTransaction } = require('../db/pool');
const lichHenRepository = require('../repositories/lich-hen.repository');
const notificationService = require('./notification.service');
const { writeAudit } = require('./audit.service');
const { parsePagination, buildPagination } = require('../utils/pagination');
const { errors } = require('../utils/app-error');

async function listKhungGioChup(ngay_hen) {
  if (!ngay_hen) throw errors.validation('Cần chọn ngày chụp', { field: 'ngay_hen' });
  return { khung_gio: await lichHenRepository.listKhungGioChup(ngay_hen) };
}

async function datLichChup(body, context = {}) {
  const lich_hen = await withTransaction(async (client) => {
    const slot = await lichHenRepository.findKhungGioForUpdate(body.khung_gio, client);
    if (!slot) throw errors.validation('Khung giờ chụp không còn hoạt động', { field: 'khung_gio' });
    return lichHenRepository.create({ ...body, loai_lich: 'dat_lich_chup', trang_thai: 'cho_xac_nhan' }, client);
  });
  await notificationService.notifyEvent('dat_lich_chup_da_nhan', {
    customer_name: lich_hen.ten_khach, email: lich_hen.email, phone: lich_hen.so_dien_thoai,
    preferred_date: lich_hen.ngay_hen, time_slot: lich_hen.khung_gio
  });
  return { lich_hen };
}

async function listLichHen(query) {
  const pagination = parsePagination(query); const result = await lichHenRepository.list(query, pagination);
  return { data: { appointments: result.rows.map(({ total, ...item }) => item), total: result.total }, pagination: buildPagination(pagination.page, pagination.limit, result.total) };
}

async function capNhatTrangThai(id, body, context) {
  const outcome = await withTransaction(async (client) => {
    const old = await lichHenRepository.findById(id, client, true);
    if (!old) throw errors.notFound('Không tìm thấy lịch hẹn');
    if (old.loai_lich === 'dat_lich_chup' && body.trang_thai === 'da_xac_nhan') {
      if (old.trang_thai !== 'cho_xac_nhan') throw errors.invalidState('Chỉ lịch chờ xác nhận mới có thể xác nhận');
      const slot = await lichHenRepository.findKhungGioForUpdate(old.khung_gio, client);
      if (!slot) throw errors.validation('Khung giờ chụp không còn hoạt động');
      const confirmed = await lichHenRepository.countDaXacNhan(old.ngay_hen, old.khung_gio, client);
      if (confirmed >= slot.suc_chua_toi_da) throw errors.invalidState('Khung giờ chụp đã đủ chỗ', { suc_chua_toi_da: slot.suc_chua_toi_da });
    }
    const lich_hen = await lichHenRepository.updateStatus(id, body, context.user.id, client);
    await writeAudit('lich_hen.cap_nhat_trang_thai', 'lich_hen', id, context, { old_data: old, new_data: lich_hen }, client);
    return lich_hen;
  });
  if (outcome.loai_lich === 'dat_lich_chup' && ['da_xac_nhan', 'tu_choi'].includes(outcome.trang_thai)) {
    await notificationService.notifyEvent(outcome.trang_thai === 'da_xac_nhan' ? 'dat_lich_chup_da_xac_nhan' : 'dat_lich_chup_tu_choi', {
      customer_name: outcome.ten_khach, email: outcome.email, phone: outcome.so_dien_thoai,
      preferred_date: outcome.ngay_hen, time_slot: outcome.khung_gio, note: outcome.ghi_chu
    });
  }
  return { appointment: outcome };
}

async function listCauHinh() { return { khung_gio: await lichHenRepository.listCauHinh() }; }
async function capNhatCauHinh(id, body) {
  const khung_gio = await lichHenRepository.updateCauHinh(id, body);
  if (!khung_gio) throw errors.notFound('Không tìm thấy khung giờ');
  return { khung_gio };
}

async function nhacLichLayHinh() {
  const lichHen = await lichHenRepository.lichCanNhacLayHinh();
  for (const item of lichHen) {
    await notificationService.notifyEvent('nhac_hen_lay_hinh', { customer_name: item.ten_khach, email: item.email, phone: item.so_dien_thoai, preferred_date: item.ngay_hen, time_slot: item.khung_gio, order_id: item.don_hang_id });
    await lichHenRepository.danhDauDaNhac(item.id);
  }
  return lichHen.length;
}

module.exports = { listKhungGioChup, datLichChup, listLichHen, capNhatTrangThai, listCauHinh, capNhatCauHinh, nhacLichLayHinh };
