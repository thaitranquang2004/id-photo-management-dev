const { withTransaction } = require('../db/pool');
const reprintRepository = require('../repositories/reprint.repository');
const { parsePagination, buildPagination } = require('../utils/pagination');
const { errors } = require('../utils/app-error');
const { writeAudit } = require('./audit.service');

const allowedTransitions = {
  new: ['reviewed', 'accepted', 'rejected'],
  reviewed: ['accepted', 'rejected'],
  accepted: ['completed'],
  rejected: [],
  completed: []
};

async function listRequests(query) {
  const pagination = parsePagination(query);
  const result = await reprintRepository.list(query, pagination);
  return {
    data: { requests: result.rows.map(({ total, ...row }) => row), total: result.total },
    pagination: buildPagination(pagination.page, pagination.limit, result.total)
  };
}

async function getRequest(id) {
  const details = await reprintRepository.details(id);
  if (!details) throw errors.notFound('Không tìm thấy yêu cầu in lại');
  return details;
}

async function updateStatus(id, body, context) {
  return withTransaction(async (client) => {
    const oldRequest = await reprintRepository.findById(id, client);
    if (!oldRequest) throw errors.notFound('Không tìm thấy yêu cầu in lại');
    if (!allowedTransitions[oldRequest.status]?.includes(body.status)) {
      throw errors.invalidState(`Không thể chuyển reprint request từ ${oldRequest.status} sang ${body.status}`, {
        current: oldRequest.status,
        next: body.status
      });
    }
    const request = await reprintRepository.updateStatus(id, body, context.user.id, client);
    await writeAudit('reprint_request.status_changed', 'public_reprint_requests', id, context, {
      old_data: oldRequest,
      new_data: request
    }, client);
    return { request };
  });
}

module.exports = { listRequests, getRequest, updateStatus };
