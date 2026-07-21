const test = require('node:test');
const assert = require('node:assert/strict');
const { canDownloadPublicFile } = require('../src/services/public.service');

function order(overrides = {}) {
  return {
    trang_thai: 'cho_xu_ly',
    hinh_thuc_giao: 'lay_hinh_ngay',
    tong_tien: 100000,
    da_thanh_toan: 100000,
    ...overrides
  };
}

test('mọi hình thức giao được tải file khi đơn hoàn tất và thanh toán đủ', () => {
  for (const hinh_thuc_giao of ['lay_file_truc_tuyen', 'lay_hinh_ngay', 'hen_lay_hinh']) {
    assert.equal(canDownloadPublicFile(order({ hinh_thuc_giao, trang_thai: 'hoan_tat' })), true);
    assert.equal(canDownloadPublicFile(order({ hinh_thuc_giao, trang_thai: 'da_giao' })), true);
  }
});

test('đơn chưa hoàn tất hoặc chưa thanh toán đủ không được tải file', () => {
  assert.equal(canDownloadPublicFile(order({ trang_thai: 'cho_xu_ly' })), false);
  assert.equal(canDownloadPublicFile(order({ trang_thai: 'dang_xu_ly' })), false);
  assert.equal(canDownloadPublicFile(order({ trang_thai: 'hoan_tat', da_thanh_toan: 99999 })), false);
});
