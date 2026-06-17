const { authClient } = require('../lib/supabase');
const profilesRepository = require('../repositories/profiles.repository');
const { errors } = require('../utils/app-error');

function extractBearerToken(req) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return null;
  }
  return token;
}

async function authenticate(req, res, next) {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      throw errors.unauthorized('Thiếu Authorization Bearer token');
    }

    const { data, error } = await authClient.auth.getUser(token);
    if (error || !data?.user?.id) {
      throw errors.unauthorized('Token không hợp lệ hoặc đã hết hạn');
    }

    const profile = await profilesRepository.findById(data.user.id);
    if (!profile) {
      throw errors.forbidden('Tài khoản chưa được cấp profile nội bộ');
    }
    if (!profile.is_active) {
      throw errors.forbidden('Tài khoản đã bị vô hiệu hóa');
    }

    req.user = {
      id: data.user.id,
      role: profile.role,
      profile
    };

    return next();
  } catch (error) {
    return next(error);
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(errors.unauthorized());
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(errors.forbidden());
    }
    return next();
  };
}

module.exports = { authenticate, requireRole };
