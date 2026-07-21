const assert = require('node:assert/strict');
const test = require('node:test');

process.env.NODE_ENV = 'test';
process.env.PORT = process.env.PORT || '4001';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-anon';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

const photoService = require('../src/services/photo.service');
const schemas = require('../src/validation/schemas');
const { pool } = require('../src/db/pool');
const ordersRepository = require('../src/repositories/orders.repository');
const photosRepository = require('../src/repositories/photos.repository');
const auditRepository = require('../src/repositories/audit.repository');

const context = {
  user: { id: '00000000-0000-4000-8000-000000000001', role: 'staff' },
  requestId: 'photo-validation-test'
};

test('photo creation requires Cloudinary original public_id before DB insert', async () => {
  await assert.rejects(
    () => photoService.createPhotos({ don_hang_id: '20000000-0000-4000-8000-000000000001' }, [], context),
    (error) => error.code === 'VALIDATION_ERROR'
  );
});

test('upload ảnh tự chuyển đơn chờ xử lý sang đang xử lý', async () => {
  const originals = {
    connect: pool.connect,
    findById: ordersRepository.findById,
    findByIdForUpdate: ordersRepository.findByIdForUpdate,
    updateStatus: ordersRepository.updateStatus,
    createPhoto: photosRepository.create,
    insertAuditLog: auditRepository.insertAuditLog
  };
  const calls = [];
  const orderId = '20000000-0000-4000-8000-000000000001';
  const pendingOrder = { id: orderId, trang_thai: 'cho_xu_ly' };

  try {
    pool.connect = async () => ({ query: async () => ({}), release: () => {} });
    ordersRepository.findById = async () => pendingOrder;
    ordersRepository.findByIdForUpdate = async () => pendingOrder;
    ordersRepository.updateStatus = async (id, status) => {
      calls.push({ id, status });
      return { ...pendingOrder, trang_thai: status };
    };
    photosRepository.create = async () => ({ id: '30000000-0000-4000-8000-000000000001' });
    auditRepository.insertAuditLog = async () => ({});

    const result = await photoService.createPhotos({
      don_hang_id: orderId,
      cloudinary_anh_goc_id: 'orders/test/original'
    }, [], context);

    assert.deepEqual(calls, [{ id: orderId, status: 'dang_xu_ly' }]);
    assert.equal(result.order.trang_thai, 'dang_xu_ly');
    assert.equal(result.photos.length, 1);
  } finally {
    Object.assign(pool, { connect: originals.connect });
    Object.assign(ordersRepository, {
      findById: originals.findById,
      findByIdForUpdate: originals.findByIdForUpdate,
      updateStatus: originals.updateStatus
    });
    photosRepository.create = originals.createPhoto;
    auditRepository.insertAuditLog = originals.insertAuditLog;
  }
});

test('ảnh gốc QC trên 80 điểm được duyệt mà không cần xử lý AI', async () => {
  const originals = {
    connect: pool.connect,
    findById: photosRepository.findById,
    updateStatus: photosRepository.updateStatus,
    insertAuditLog: auditRepository.insertAuditLog
  };
  const photoId = '30000000-0000-4000-8000-000000000001';
  const rawPhoto = { id: photoId, trang_thai: 'anh_goc', diem_chat_luong: 81 };

  try {
    pool.connect = async () => ({ query: async () => ({}), release: () => {} });
    photosRepository.findById = async () => rawPhoto;
    photosRepository.updateStatus = async (id, status) => ({ ...rawPhoto, id, trang_thai: status });
    auditRepository.insertAuditLog = async () => ({});

    const result = await photoService.approvePhoto(photoId, context);
    assert.equal(result.photo.trang_thai, 'da_duyet');
  } finally {
    pool.connect = originals.connect;
    photosRepository.findById = originals.findById;
    photosRepository.updateStatus = originals.updateStatus;
    auditRepository.insertAuditLog = originals.insertAuditLog;
  }
});

test('ảnh gốc QC 80 điểm hoặc thấp hơn vẫn không thể duyệt trực tiếp', async () => {
  const originals = {
    connect: pool.connect,
    findById: photosRepository.findById,
    updateStatus: photosRepository.updateStatus
  };
  const photoId = '30000000-0000-4000-8000-000000000001';

  try {
    pool.connect = async () => ({ query: async () => ({}), release: () => {} });
    photosRepository.findById = async () => ({ id: photoId, trang_thai: 'anh_goc', diem_chat_luong: 80 });
    photosRepository.updateStatus = async () => {
      throw new Error('Không được cập nhật trạng thái');
    };

    await assert.rejects(
      () => photoService.approvePhoto(photoId, context),
      (error) => error.code === 'INVALID_STATE_TRANSITION'
    );
  } finally {
    pool.connect = originals.connect;
    photosRepository.findById = originals.findById;
    photosRepository.updateStatus = originals.updateStatus;
  }
});

test('batch processing defaults to Google AI provider', () => {
  const body = schemas.batchProcessBody.parse({
    don_hang_id: '20000000-0000-4000-8000-000000000001',
    danh_sach_anh_id: ['30000000-0000-4000-8000-000000000001']
  });

  assert.equal(body.nha_cung_cap, 'google_ai');
});

test('batch processing defaults to safe_assist mode (AI must not alter identity)', () => {
  const body = schemas.batchProcessBody.parse({
    don_hang_id: '20000000-0000-4000-8000-000000000001',
    danh_sach_anh_id: ['30000000-0000-4000-8000-000000000001']
  });

  assert.equal(body.che_do_xu_ly, 'safe_assist');
});

test('batch processing rejects unknown processing_mode', () => {
  assert.throws(() => schemas.batchProcessBody.parse({
    don_hang_id: '20000000-0000-4000-8000-000000000001',
    danh_sach_anh_id: ['30000000-0000-4000-8000-000000000001'],
    che_do_xu_ly: 'beautify'
  }));
});

test('batch processing rejects Banana.dev provider value', () => {
  assert.throws(() => schemas.batchProcessBody.parse({
    don_hang_id: '20000000-0000-4000-8000-000000000001',
    danh_sach_anh_id: ['30000000-0000-4000-8000-000000000001'],
    nha_cung_cap: 'banana'
  }));
});
