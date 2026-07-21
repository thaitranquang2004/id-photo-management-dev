const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'http://127.0.0.1:54321';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

const { AppError } = require('../src/utils/app-error');
const catalogRepository = require('../src/repositories/catalog.repository');
const ordersRepository = require('../src/repositories/orders.repository');
const customersRepository = require('../src/repositories/customers.repository');
const lichHenRepository = require('../src/repositories/lich-hen.repository');
const auditRepository = require('../src/repositories/audit.repository');
const { pool } = require('../src/db/pool');
const notificationService = require('../src/services/notification.service');
const bookingService = require('../src/services/booking.service');
const { dateOnly, rangesOverlap } = require('../src/services/catalog.service');
const {
  assertTransition,
  changeStatus,
  createOrderCore,
  totalFromPricing,
  totalFromOnlineFilePricing
} = require('../src/services/order.service');
const { assertMinimumOnlineRequestQcScore, MIN_ONLINE_REQUEST_QC_SCORE } = require('../src/services/intake.service');

test('orders do not use ready state and reject invalid transitions', () => {
  assert.throws(
    () => assertTransition('cho_xu_ly', 'da_giao'),
    (error) => error instanceof AppError && error.code === 'INVALID_STATE_TRANSITION'
  );
});

test('orders allow standard forward transitions', () => {
  assert.doesNotThrow(() => assertTransition('cho_xu_ly', 'dang_xu_ly'));
  assert.doesNotThrow(() => assertTransition('dang_xu_ly', 'hoan_tat'));
  assert.doesNotThrow(() => assertTransition('hoan_tat', 'da_giao'));
});

test('đặt lịch chụp lưu khóa ngoại khung giờ chụp và snapshot giờ chuẩn', async () => {
  const originals = {
    connect: pool.connect,
    findKhungGioForUpdate: lichHenRepository.findKhungGioForUpdate,
    create: lichHenRepository.create,
    enqueueEvent: notificationService.enqueueEvent,
    dispatchRows: notificationService.dispatchRows
  };
  const slotId = '30000000-0000-4000-8000-000000000001';
  let createdBody;

  try {
    pool.connect = async () => ({ query: async () => ({}), release: () => {} });
    lichHenRepository.findKhungGioForUpdate = async () => ({
      id: slotId,
      khung_gio: '08:00-09:00',
      suc_chua_toi_da: 1
    });
    lichHenRepository.create = async (body) => {
      createdBody = body;
      return { id: '40000000-0000-4000-8000-000000000001', ...body };
    };
    notificationService.enqueueEvent = async () => [];
    notificationService.dispatchRows = async (rows) => rows;

    const result = await bookingService.datLichChup({
      ten_khach: 'An',
      so_dien_thoai: '0901234567',
      email: 'an@example.com',
      ngay_hen: '2026-08-01',
      khung_gio: '08:00-09:00'
    });

    assert.equal(result.lich_hen.khung_gio_chup_id, slotId);
    assert.equal(createdBody.khung_gio_chup_id, slotId);
    assert.equal(createdBody.khung_gio, '08:00-09:00');
    assert.equal(createdBody.loai_lich, 'dat_lich_chup');
  } finally {
    pool.connect = originals.connect;
    lichHenRepository.findKhungGioForUpdate = originals.findKhungGioForUpdate;
    lichHenRepository.create = originals.create;
    notificationService.enqueueEvent = originals.enqueueEvent;
    notificationService.dispatchRows = originals.dispatchRows;
  }
});

test('xác nhận lịch chụp đếm sức chứa bằng khung_gio_chup_id', async () => {
  const originals = {
    connect: pool.connect,
    findById: lichHenRepository.findById,
    findKhungGioByIdForUpdate: lichHenRepository.findKhungGioByIdForUpdate,
    countDaXacNhan: lichHenRepository.countDaXacNhan,
    updateStatus: lichHenRepository.updateStatus,
    insertAuditLog: auditRepository.insertAuditLog,
    enqueueEvent: notificationService.enqueueEvent,
    dispatchRows: notificationService.dispatchRows
  };
  const appointmentId = '40000000-0000-4000-8000-000000000001';
  const slotId = '30000000-0000-4000-8000-000000000001';
  let countedSlotId;

  try {
    pool.connect = async () => ({ query: async () => ({}), release: () => {} });
    lichHenRepository.findById = async () => ({
      id: appointmentId,
      loai_lich: 'dat_lich_chup',
      trang_thai: 'cho_xac_nhan',
      ngay_hen: '2026-08-01',
      khung_gio: '08:00-09:00',
      khung_gio_chup_id: slotId,
      ten_khach: 'An',
      so_dien_thoai: '0901234567',
      email: 'an@example.com'
    });
    lichHenRepository.findKhungGioByIdForUpdate = async (id) => ({ id, suc_chua_toi_da: 2 });
    lichHenRepository.countDaXacNhan = async (_ngayHen, id) => {
      countedSlotId = id;
      return 1;
    };
    lichHenRepository.updateStatus = async (_id, body) => ({
      id: appointmentId,
      loai_lich: 'dat_lich_chup',
      trang_thai: body.trang_thai,
      ngay_hen: '2026-08-01',
      khung_gio: '08:00-09:00',
      khung_gio_chup_id: slotId
    });
    auditRepository.insertAuditLog = async () => ({});
    notificationService.enqueueEvent = async () => [];
    notificationService.dispatchRows = async (rows) => rows;

    await bookingService.capNhatTrangThai(
      appointmentId,
      { trang_thai: 'da_xac_nhan' },
      { user: { id: '60000000-0000-4000-8000-000000000001' } }
    );

    assert.equal(countedSlotId, slotId);
  } finally {
    pool.connect = originals.connect;
    lichHenRepository.findById = originals.findById;
    lichHenRepository.findKhungGioByIdForUpdate = originals.findKhungGioByIdForUpdate;
    lichHenRepository.countDaXacNhan = originals.countDaXacNhan;
    lichHenRepository.updateStatus = originals.updateStatus;
    auditRepository.insertAuditLog = originals.insertAuditLog;
    notificationService.enqueueEvent = originals.enqueueEvent;
    notificationService.dispatchRows = originals.dispatchRows;
  }
});

test('không thể giao đơn khi chưa thu đủ tiền', async () => {
  const originals = {
    connect: pool.connect,
    findByIdForUpdate: ordersRepository.findByIdForUpdate,
    updateStatus: ordersRepository.updateStatus
  };

  try {
    pool.connect = async () => ({ query: async () => ({}), release: () => {} });
    ordersRepository.findByIdForUpdate = async () => ({
      id: '40000000-0000-4000-8000-000000000001',
      trang_thai: 'hoan_tat',
      tong_tien: 100000,
      da_thanh_toan: 99000,
      hinh_thuc_giao: 'hen_lay_hinh'
    });
    ordersRepository.updateStatus = async () => {
      throw new Error('Không được giao đơn thiếu tiền');
    };

    await assert.rejects(
      () => changeStatus('40000000-0000-4000-8000-000000000001', 'da_giao', { user: { id: '60000000-0000-4000-8000-000000000001' } }),
      (error) => error instanceof AppError
        && error.code === 'INVALID_STATE_TRANSITION'
        && error.message.includes('chưa thanh toán đủ')
    );
  } finally {
    pool.connect = originals.connect;
    ordersRepository.findByIdForUpdate = originals.findByIdForUpdate;
    ordersRepository.updateStatus = originals.updateStatus;
  }
});

test('đơn đã thu đủ có thể giao và tạo notification outbox có liên kết đơn', async () => {
  const originals = {
    connect: pool.connect,
    findByIdForUpdate: ordersRepository.findByIdForUpdate,
    updateStatus: ordersRepository.updateStatus,
    findCustomerById: customersRepository.findById,
    insertAuditLog: auditRepository.insertAuditLog,
    enqueueEvent: notificationService.enqueueEvent,
    dispatchRows: notificationService.dispatchRows
  };
  const calls = [];
  const orderId = '40000000-0000-4000-8000-000000000001';

  try {
    pool.connect = async () => ({ query: async () => ({}), release: () => {} });
    ordersRepository.findByIdForUpdate = async () => ({
      id: orderId,
      khach_hang_id: '50000000-0000-4000-8000-000000000001',
      ma_don: 'IN-T72026-001',
      trang_thai: 'hoan_tat',
      tong_tien: 100000,
      da_thanh_toan: 100000,
      hinh_thuc_giao: 'hen_lay_hinh'
    });
    ordersRepository.updateStatus = async (id, status) => ({ id, khach_hang_id: '50000000-0000-4000-8000-000000000001', ma_don: 'IN-T72026-001', trang_thai: status });
    customersRepository.findById = async () => ({ ho_ten: 'An', email: 'an@example.com', so_dien_thoai: '0901234567' });
    auditRepository.insertAuditLog = async () => ({});
    notificationService.enqueueEvent = async (eventType, payload) => {
      calls.push({ eventType, payload });
      return [{ id: '70000000-0000-4000-8000-000000000001', don_hang_id: payload.order_id }];
    };
    notificationService.dispatchRows = async (rows) => {
      calls.push({ dispatched: rows.map((row) => row.don_hang_id) });
      return rows;
    };

    const result = await changeStatus(orderId, 'da_giao', { user: { id: '60000000-0000-4000-8000-000000000001' } });
    assert.equal(result.order.trang_thai, 'da_giao');
    assert.equal(calls[0].eventType, 'order_delivered');
    assert.equal(calls[0].payload.order_id, orderId);
    assert.deepEqual(calls[1].dispatched, [orderId]);
  } finally {
    pool.connect = originals.connect;
    ordersRepository.findByIdForUpdate = originals.findByIdForUpdate;
    ordersRepository.updateStatus = originals.updateStatus;
    customersRepository.findById = originals.findCustomerById;
    auditRepository.insertAuditLog = originals.insertAuditLog;
    notificationService.enqueueEvent = originals.enqueueEvent;
    notificationService.dispatchRows = originals.dispatchRows;
  }
});

test('giá file trực tuyến là trọn gói một lần cho mỗi đơn', () => {
  const onlinePrice = { gia_tron_goi: 45000 };
  assert.equal(totalFromOnlineFilePricing(onlinePrice, 4), 45000);
  assert.equal(totalFromOnlineFilePricing(onlinePrice, 12), 45000);

  // Giá in theo loại thẻ vẫn dùng công thức cũ: giá/bản * số lượng + phí xử lý.
  assert.equal(totalFromPricing({ gia_moi_ban: 8000, phi_xu_ly: 2000 }, 4), 34000);
});

test('mốc ngày giá giữ nguyên ngày DB để phát hiện overlap ở ngày giáp ranh', () => {
  // Repository khoá bảng giá và ép DATE về chuỗi YYYY-MM-DD trước khi gọi helper.
  // Không được biến DATE local thành ngày UTC trước đó.
  assert.equal(dateOnly('2026-07-18'), '2026-07-18');
  assert.equal(rangesOverlap('2026-07-10', '2026-07-18', '2026-07-18', null), true);
  assert.equal(rangesOverlap('2026-07-10', '2026-07-17', '2026-07-18', null), false);
});

test('chỉ bỏ qua lỗi thiếu bảng giá online trong giai đoạn rollout migration', () => {
  assert.equal(catalogRepository.isOnlineFilePricingTableMissing({
    code: '42P01',
    message: 'relation "bang_gia_file_truc_tuyen" does not exist'
  }), true);
  assert.equal(catalogRepository.isOnlineFilePricingTableMissing({
    code: '42501',
    message: 'permission denied for table bang_gia_file_truc_tuyen'
  }), false);
});

test('mọi luồng dùng createOrderCore lấy file trực tuyến đều snapshot giá trọn gói', async () => {
  const originals = {
    findCardType: catalogRepository.findCardType,
    getCurrentOnlineFilePricing: catalogRepository.getCurrentOnlineFilePricing,
    getCurrentPricing: catalogRepository.getCurrentPricing,
    createOrder: ordersRepository.createOrder,
    createPricingSnapshot: ordersRepository.createPricingSnapshot,
    insertAuditLog: auditRepository.insertAuditLog
  };
  const calls = [];
  const createdBodies = [];

  try {
    catalogRepository.findCardType = async () => ({
      id: '20000000-0000-4000-8000-000000000001',
      ten: 'CCCD',
      rong_mm: 30,
      cao_mm: 40,
      mau_nen: '#FFFFFF'
    });
    catalogRepository.getCurrentOnlineFilePricing = async () => ({
      id: '30000000-0000-4000-8000-000000000001',
      gia_tron_goi: 45000
    });
    catalogRepository.getCurrentPricing = async () => {
      throw new Error('Đơn file trực tuyến không được lấy giá in theo loại thẻ');
    };
    ordersRepository.createOrder = async (body, actorId, totalAmount) => {
      createdBodies.push(body);
      return {
        id: `40000000-0000-4000-8000-00000000000${calls.length + 1}`,
        so_luong: body.so_luong,
        tong_tien: totalAmount,
        actor_id: actorId
      };
    };
    ordersRepository.createPricingSnapshot = async (order, pricing, totalAmount, _client, options) => {
      calls.push({ order, pricing, totalAmount, options });
      return {
        id: `snapshot-${calls.length}`,
        tong_tien: totalAmount,
        bang_gia_file_truc_tuyen_id: options.onlineFilePricing.id,
        gia_file_truc_tuyen: options.onlineFilePricing.gia_tron_goi
      };
    };
    auditRepository.insertAuditLog = async () => ({});

    for (const [nguon_don, so_luong] of [
      ['tai_tiem', undefined],
      ['gui_anh_tu_xa', 12],
      ['gui_anh_tu_xa', 0],
      ['gui_anh_tu_xa', -1]
    ]) {
      const body = {
        khach_hang_id: '50000000-0000-4000-8000-000000000001',
        loai_the_id: '20000000-0000-4000-8000-000000000001',
        nguon_don,
        hinh_thuc_giao: 'lay_file_truc_tuyen'
      };
      if (so_luong !== undefined) body.so_luong = so_luong;

      const result = await createOrderCore(body, { user: { id: '60000000-0000-4000-8000-000000000001' } }, {});
      assert.equal(result.order.tong_tien, 45000);
      assert.equal(result.order.so_luong, 1);
      assert.equal(result.pricing_snapshot.gia_file_truc_tuyen, 45000);
      assert.equal(body.so_luong, so_luong);
    }

    assert.equal(calls.length, 4);
    assert.deepEqual(createdBodies.map((body) => body.so_luong), [1, 1, 1, 1]);
    assert.equal(calls[0].pricing, null);
    assert.equal(calls[0].options.onlineFilePricing.id, '30000000-0000-4000-8000-000000000001');
    assert.equal(calls[1].totalAmount, 45000);
  } finally {
    Object.assign(catalogRepository, {
      findCardType: originals.findCardType,
      getCurrentOnlineFilePricing: originals.getCurrentOnlineFilePricing,
      getCurrentPricing: originals.getCurrentPricing
    });
    Object.assign(ordersRepository, {
      createOrder: originals.createOrder,
      createPricingSnapshot: originals.createPricingSnapshot
    });
    auditRepository.insertAuditLog = originals.insertAuditLog;
  }
});

test('đơn file trực tuyến bị chặn khi chưa có giá đang hiệu lực', async () => {
  const originals = {
    findCardType: catalogRepository.findCardType,
    getCurrentOnlineFilePricing: catalogRepository.getCurrentOnlineFilePricing
  };
  try {
    catalogRepository.findCardType = async () => ({ id: '20000000-0000-4000-8000-000000000001' });
    catalogRepository.getCurrentOnlineFilePricing = async () => null;

    await assert.rejects(
      () => createOrderCore({
        khach_hang_id: '50000000-0000-4000-8000-000000000001',
        loai_the_id: '20000000-0000-4000-8000-000000000001',
        so_luong: 4,
        hinh_thuc_giao: 'lay_file_truc_tuyen'
      }, { user: { id: '60000000-0000-4000-8000-000000000001' } }, {}),
      (error) => error instanceof AppError
        && error.code === 'VALIDATION_ERROR'
        && error.message.includes('Chưa cấu hình giá file trực tuyến')
    );
  } finally {
    catalogRepository.findCardType = originals.findCardType;
    catalogRepository.getCurrentOnlineFilePricing = originals.getCurrentOnlineFilePricing;
  }
});

test('ảnh khách gửi cần đạt tối thiểu 60 điểm QC', () => {
  assert.equal(MIN_ONLINE_REQUEST_QC_SCORE, 60);
  assert.doesNotThrow(() => assertMinimumOnlineRequestQcScore({ diem_chat_luong: 60 }, 'dat.jpg'));
  assert.doesNotThrow(() => assertMinimumOnlineRequestQcScore({ diem_chat_luong: 82 }, 'dat.jpg'));
  assert.throws(
    () => assertMinimumOnlineRequestQcScore({ diem_chat_luong: 59, loi_chat_luong: [] }, 'chua-dat.jpg'),
    (error) => error instanceof AppError
      && error.code === 'VALIDATION_ERROR'
      && error.message.includes('60 điểm QC')
  );
});
