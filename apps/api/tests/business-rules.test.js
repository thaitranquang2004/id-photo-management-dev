const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'http://127.0.0.1:54321';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

const { AppError } = require('../src/utils/app-error');
const { assertTransition } = require('../src/services/order.service');

test('orders do not use ready state and reject invalid transitions', () => {
  assert.throws(
    () => assertTransition('pending', 'delivered'),
    (error) => error instanceof AppError && error.code === 'INVALID_STATE_TRANSITION'
  );
});

test('orders allow standard forward transitions', () => {
  assert.doesNotThrow(() => assertTransition('pending', 'processing'));
  assert.doesNotThrow(() => assertTransition('processing', 'completed'));
  assert.doesNotThrow(() => assertTransition('completed', 'delivered'));
});
