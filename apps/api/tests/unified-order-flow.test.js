const test = require('node:test');
const assert = require('node:assert/strict');
const schemas = require('../src/validation/schemas');

const uuid = '11111111-1111-4111-8111-111111111111';

test('chuẩn hóa và kiểm tra định dạng số điện thoại, email', () => {
  assert.equal(schemas.phone.parse('0901 234 567'), '0901234567');
  assert.equal(schemas.phone.parse('+84 901-234-567'), '+84901234567');
  assert.throws(() => schemas.phone.parse('12121212'));
  assert.throws(() => schemas.phone.parse('090123456'));
  assert.throws(() => schemas.customerCreateBody.parse({
    ho_ten: 'An', so_dien_thoai: '0901234567', email: 'khong-phai-email'
  }));
});

test('đặt lịch chụp bắt buộc email, còn đơn không được tạo bởi payload đặt lịch', () => {
  assert.throws(() => schemas.studioBookingBody.parse({ ten_khach: 'An', so_dien_thoai: '0901234567', ngay_hen: '2026-08-01', khung_gio: '08:00-09:00' }));
  const booking = schemas.studioBookingBody.parse({ ten_khach: 'An', so_dien_thoai: '0901234567', email: 'an@example.com', ngay_hen: '2026-08-01', khung_gio: '08:00-09:00' });
  assert.equal(booking.email, 'an@example.com');
  assert.equal('loai_the_id' in booking, false);
});

test('yêu cầu gửi ảnh chỉ cho phép file trực tuyến hoặc hẹn lấy; hẹn lấy bắt buộc lịch', () => {
  const remoteBody = { ho_ten: 'An', so_dien_thoai: '0901234567', email: 'an@example.com', loai_the_id: uuid };
  assert.throws(() => schemas.remoteOnlineRequestBody.parse({ ...remoteBody, so_luong: 4, hinh_thuc_giao: 'lay_hinh_ngay' }));
  assert.throws(() => schemas.remoteOnlineRequestBody.parse({ ...remoteBody, so_luong: 4, hinh_thuc_giao: 'hen_lay_hinh' }));
  assert.throws(() => schemas.remoteOnlineRequestBody.parse({
    ...remoteBody,
    so_luong: 3,
    hinh_thuc_giao: 'hen_lay_hinh',
    ngay_hen_lay: '2026-08-01',
    khung_gio_lay: '08:00-09:00'
  }));

  const onlineWithoutQuantity = schemas.remoteOnlineRequestBody.parse({ ...remoteBody, hinh_thuc_giao: 'lay_file_truc_tuyen' });
  assert.equal(onlineWithoutQuantity.so_luong, undefined);

  const onlineWithLegacyQuantity = schemas.remoteOnlineRequestBody.parse({ ...remoteBody, so_luong: 0, hinh_thuc_giao: 'lay_file_truc_tuyen' });
  assert.equal(onlineWithLegacyQuantity.hinh_thuc_giao, 'lay_file_truc_tuyen');
  assert.equal(onlineWithLegacyQuantity.so_luong, 0);
});

test('đơn tại tiệm chỉ cần ngày và giờ khi chọn hẹn lấy hình', () => {
  assert.doesNotThrow(() => schemas.orderCreateBody.parse({ khach_hang_id: uuid, loai_the_id: uuid, so_luong: 4, hinh_thuc_giao: 'lay_hinh_ngay' }));
  assert.throws(() => schemas.orderCreateBody.parse({ khach_hang_id: uuid, loai_the_id: uuid, hinh_thuc_giao: 'lay_hinh_ngay' }));
  assert.throws(() => schemas.orderCreateBody.parse({ khach_hang_id: uuid, loai_the_id: uuid, so_luong: 4, hinh_thuc_giao: 'hen_lay_hinh' }));

  const onlineOrder = schemas.orderCreateBody.parse({ khach_hang_id: uuid, loai_the_id: uuid, hinh_thuc_giao: 'lay_file_truc_tuyen' });
  assert.equal(onlineOrder.so_luong, undefined);
});

test('chuyển yêu cầu online không cần số lượng khi lấy file, nhưng hẹn lấy phải đủ lịch', () => {
  assert.equal(schemas.convertRequestBody.parse({}).so_luong, undefined);
  assert.equal(schemas.convertRequestBody.parse({ so_luong: -1 }).so_luong, -1);
  assert.throws(() => schemas.convertRequestBody.parse({ hinh_thuc_giao: 'hen_lay_hinh', so_luong: 4 }));
  assert.doesNotThrow(() => schemas.convertRequestBody.parse({
    hinh_thuc_giao: 'hen_lay_hinh', so_luong: 4, ngay_hen_lay: '2026-08-01', khung_gio_lay: '08:00 - 09:00'
  }));
});

test('giá file trực tuyến cần có khoảng hiệu lực hợp lệ', () => {
  const pricing = schemas.onlineFilePricingCreateBody.parse({
    gia_tron_goi: '45000',
    hieu_luc_tu: '2026-07-18'
  });
  assert.equal(pricing.gia_tron_goi, 45000);
  assert.throws(() => schemas.onlineFilePricingCreateBody.parse({
    gia_tron_goi: 45000,
    hieu_luc_tu: '2026-07-19',
    hieu_luc_den: '2026-07-18'
  }));
});
