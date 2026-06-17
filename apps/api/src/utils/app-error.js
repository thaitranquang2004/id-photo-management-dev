class AppError extends Error {
  constructor(statusCode, code, message, details = {}) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
  }
}

const errors = {
  validation(message = 'Dữ liệu không hợp lệ', details = {}) {
    return new AppError(400, 'VALIDATION_ERROR', message, details);
  },
  unauthorized(message = 'Bạn cần đăng nhập để tiếp tục', details = {}) {
    return new AppError(401, 'UNAUTHORIZED', message, details);
  },
  forbidden(message = 'Bạn không có quyền thực hiện thao tác này', details = {}) {
    return new AppError(403, 'FORBIDDEN', message, details);
  },
  notFound(message = 'Không tìm thấy dữ liệu', details = {}) {
    return new AppError(404, 'NOT_FOUND', message, details);
  },
  invalidState(message = 'Trạng thái hiện tại không cho phép thao tác này', details = {}) {
    return new AppError(409, 'INVALID_STATE_TRANSITION', message, details);
  },
  rateLimited(message = 'Bạn thao tác quá nhanh, vui lòng thử lại sau', details = {}) {
    return new AppError(429, 'RATE_LIMITED', message, details);
  },
  cloudinary(message = 'Không thể xử lý tài nguyên Cloudinary', details = {}) {
    return new AppError(502, 'CLOUDINARY_ERROR', message, details);
  },
  banana(message = 'Không thể xử lý tác vụ Banana', details = {}) {
    return new AppError(502, 'BANANA_ERROR', message, details);
  },
  ai(message = 'Không thể xử lý ảnh bằng AI', details = {}) {
    return new AppError(502, 'AI_PROCESSING_FAILED', message, details);
  }
};

module.exports = { AppError, errors };
