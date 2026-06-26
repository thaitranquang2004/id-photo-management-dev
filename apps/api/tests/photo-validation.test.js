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

const context = {
  user: { id: '00000000-0000-4000-8000-000000000001', role: 'staff' },
  requestId: 'photo-validation-test'
};

test('photo creation requires Cloudinary original public_id before DB insert', async () => {
  await assert.rejects(
    () => photoService.createPhotos({ order_id: '20000000-0000-4000-8000-000000000001' }, [], context),
    (error) => error.code === 'VALIDATION_ERROR'
  );
});

test('batch processing defaults to Google AI provider', () => {
  const body = schemas.batchProcessBody.parse({
    order_id: '20000000-0000-4000-8000-000000000001',
    photo_ids: ['30000000-0000-4000-8000-000000000001']
  });

  assert.equal(body.provider, 'google_ai');
});

test('batch processing defaults to safe_assist mode (AI must not alter identity)', () => {
  const body = schemas.batchProcessBody.parse({
    order_id: '20000000-0000-4000-8000-000000000001',
    photo_ids: ['30000000-0000-4000-8000-000000000001']
  });

  assert.equal(body.processing_mode, 'safe_assist');
});

test('batch processing rejects unknown processing_mode', () => {
  assert.throws(() => schemas.batchProcessBody.parse({
    order_id: '20000000-0000-4000-8000-000000000001',
    photo_ids: ['30000000-0000-4000-8000-000000000001'],
    processing_mode: 'beautify'
  }));
});

test('batch processing rejects Banana.dev provider value', () => {
  assert.throws(() => schemas.batchProcessBody.parse({
    order_id: '20000000-0000-4000-8000-000000000001',
    photo_ids: ['30000000-0000-4000-8000-000000000001'],
    provider: 'banana'
  }));
});

test('layout generation defaults to grid on A4 paper', () => {
  const body = schemas.layoutGenerateBody.parse({
    order_id: '20000000-0000-4000-8000-000000000001',
    photo_ids: ['30000000-0000-4000-8000-000000000001']
  });

  assert.equal(body.layout_type, 'grid');
  assert.equal(body.paper_size, 'A4');
});
