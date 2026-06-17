const assert = require('node:assert/strict');
const test = require('node:test');

process.env.NODE_ENV = 'test';
process.env.PORT = process.env.PORT || '4001';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-anon';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

const { requireRole } = require('../src/middleware/auth.middleware');

test('staff cannot pass admin-only middleware even if body/query claims admin', () => {
  const middleware = requireRole('admin');
  const req = {
    user: { id: '00000000-0000-4000-8000-000000000001', role: 'staff' },
    body: { role: 'admin' },
    query: { role: 'admin' }
  };

  let nextError;
  middleware(req, {}, (error) => {
    nextError = error;
  });

  assert.equal(nextError.statusCode, 403);
  assert.equal(nextError.code, 'FORBIDDEN');
});

test('admin can pass admin-only middleware', () => {
  const middleware = requireRole('admin');
  const req = {
    user: { id: '00000000-0000-4000-8000-000000000002', role: 'admin' }
  };

  let nextError = 'not-called';
  middleware(req, {}, (error) => {
    nextError = error;
  });

  assert.equal(nextError, undefined);
});

test('role middleware rejects request without authenticated user', () => {
  const middleware = requireRole('staff', 'admin');

  let nextError;
  middleware({}, {}, (error) => {
    nextError = error;
  });

  assert.equal(nextError.statusCode, 401);
  assert.equal(nextError.code, 'UNAUTHORIZED');
});
