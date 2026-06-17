function sendSuccess(res, data = {}, pagination = null, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
    pagination
  });
}

function sendError(res, error) {
  return res.status(error.statusCode || 500).json({
    success: false,
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message: error.message || 'Có lỗi xảy ra',
      details: error.details || {}
    }
  });
}

module.exports = { sendSuccess, sendError };
