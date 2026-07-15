const test = require('node:test');
const assert = require('node:assert/strict');
const schemas = require('../src/validation/schemas');

const uuid = '11111111-1111-4111-8111-111111111111';

test('đặt lịch chụp bắt buộc email, còn đơn không được tạo bởi payload đặt lịch', () => {
  assert.throws(() => schemas.studioBookingBody.parse({ ten_khach: 'An', so_dien_thoai: '0901234567', ngay_hen: '2026-08-01', khung_gio: '08:00-09:00' }));
  const booking = schemas.studioBookingBody.parse({ ten_khach: 'An', so_dien_thoai: '0901234567', email: 'an@example.com', ngay_hen: '2026-08-01', khung_gio: '08:00-09:00' });
  assert.equal(booking.email, 'an@example.com');
  assert.equal('loai_the_id' in booking, false);
});

test('đơn gửi ảnh chỉ cho phép file trực tuyến hoặc hẹn lấy; hẹn lấy bắt buộc lịch', () => {
  assert.throws(() => schemas.remoteOrderBody.parse({ ho_ten: 'An', so_dien_thoai: '0901234567', email: 'an@example.com', loai_the_id: uuid, so_luong: 4, hinh_thuc_giao: 'lay_hinh_ngay' }));
  assert.throws(() => schemas.remoteOrderBody.parse({ ho_ten: 'An', so_dien_thoai: '0901234567', email: 'an@example.com', loai_the_id: uuid, so_luong: 4, hinh_thuc_giao: 'hen_lay_hinh' }));
  assert.equal(schemas.remoteOrderBody.parse({ ho_ten: 'An', so_dien_thoai: '0901234567', email: 'an@example.com', loai_the_id: uuid, so_luong: 4, hinh_thuc_giao: 'lay_file_truc_tuyen' }).hinh_thuc_giao, 'lay_file_truc_tuyen');
});

test('đơn tại tiệm chỉ cần ngày và giờ khi chọn hẹn lấy hình', () => {
  assert.doesNotThrow(() => schemas.orderCreateBody.parse({ khach_hang_id: uuid, loai_the_id: uuid, so_luong: 4, hinh_thuc_giao: 'lay_hinh_ngay' }));
  assert.throws(() => schemas.orderCreateBody.parse({ khach_hang_id: uuid, loai_the_id: uuid, so_luong: 4, hinh_thuc_giao: 'hen_lay_hinh' }));
});
