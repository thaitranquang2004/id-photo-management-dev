const { errors } = require('./app-error');

function parsePagination(query) {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 20);

  if (!Number.isInteger(page) || page < 1) {
    throw errors.validation('page không hợp lệ', { field: 'page' });
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw errors.validation('limit phải từ 1 đến 100', { field: 'limit' });
  }

  return {
    page,
    limit,
    offset: (page - 1) * limit
  };
}

function buildPagination(page, limit, total) {
  return {
    page,
    limit,
    total,
    total_pages: Math.ceil(total / limit)
  };
}

module.exports = { parsePagination, buildPagination };
