const { ipKeyGenerator, rateLimit } = require('express-rate-limit');
const env = require('../config/env');
const { errors } = require('../utils/app-error');

const publicApiLimiter = rateLimit({
  windowMs: env.PUBLIC_LOOKUP_RATE_LIMIT_WINDOW_MS,
  limit: env.PUBLIC_LOOKUP_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  // Mỗi API công khai có một quota riêng theo IP. Trước đây mọi request không
  // dùng các field tiếng Anh `phone`/`order_code` đều rơi vào cùng một key rỗng,
  // khiến việc mở trang, tải khung giờ và gửi biểu mẫu có thể chặn lẫn nhau.
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}:${req.method}:${req.path}`,
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
