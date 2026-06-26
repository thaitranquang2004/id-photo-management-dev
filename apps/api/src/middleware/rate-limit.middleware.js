const { ipKeyGenerator, rateLimit } = require('express-rate-limit');
const env = require('../config/env');
const { errors } = require('../utils/app-error');

const publicApiLimiter = rateLimit({
  windowMs: env.PUBLIC_LOOKUP_RATE_LIMIT_WINDOW_MS,
  limit: env.PUBLIC_LOOKUP_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const phone = (req.body?.phone || req.query?.phone || '').replace(/\D/g, '');
    const orderCode = req.body?.order_code || req.query?.order_code || '';
    return `${ipKeyGenerator(req.ip)}:${phone}:${orderCode}`;
  },
  handler: (req, res, next) => next(errors.rateLimited())
});

// Throttles authenticated write operations (POST/PATCH/PUT/DELETE) per user so a
// single account can't hammer admin/payment/order mutations. Reads (GET) are skipped.
const mutatingApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'GET',
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req.ip),
  handler: (req, res, next) => next(errors.rateLimited())
});

module.exports = { publicApiLimiter, mutatingApiLimiter };
