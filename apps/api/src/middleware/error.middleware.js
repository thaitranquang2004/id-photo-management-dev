const { ZodError } = require('zod');
const { AppError } = require('../utils/app-error');
const { sendError } = require('../utils/responses');

function notFoundHandler(req, res, next) {
  next(new AppError(404, 'NOT_FOUND', 'Không tìm thấy endpoint', { path: req.originalUrl }));
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof ZodError) {
    return sendError(res, new AppError(400, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ', error.flatten()));
  }

  if (error instanceof AppError) {
    return sendError(res, error);
  }

  req.log?.error({ err: error }, 'Unhandled API error');
  return sendError(res, new AppError(500, 'INTERNAL_ERROR', 'Có lỗi xảy ra', {}));
}

module.exports = { notFoundHandler, errorHandler };
