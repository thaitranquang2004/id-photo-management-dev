const { ipKeyGenerator, rateLimit } = require('express-rate-limit');
const env = require('../config/env');
const { errors } = require('../utils/app-error');

const publicApiLimiter = rateLimit({
  windowMs: env.PUBLIC_LOOKUP_RATE_LIMIT_WINDOW_MS,
  limit: env.PUBLIC_LOOKUP_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const phone = req.body?.phone || req.query?.phone || '';
    const orderCode = req.body?.order_code || req.query?.order_code || '';
    return `${ipKeyGenerator(req.ip)}:${phone}:${orderCode}`;
  },
  handler: (req, res, next) => next(errors.rateLimited())
});

module.exports = { publicApiLimiter };
