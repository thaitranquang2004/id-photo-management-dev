const reprintService = require('../services/reprint.service');
const { requestContext } = require('./context');
const { sendSuccess } = require('../utils/responses');

async function list(req, res) {
  const result = await reprintService.listRequests(req.validated.query);
  return sendSuccess(res, result.data, result.pagination);
}

async function get(req, res) {
  return sendSuccess(res, await reprintService.getRequest(req.validated.params.id));
}

async function updateStatus(req, res) {
  return sendSuccess(res, await reprintService.updateStatus(req.validated.params.id, req.validated.body, requestContext(req)));
}

async function convert(req, res) {
  return sendSuccess(
    res,
    await reprintService.convertToOrder(req.validated.params.id, req.validated.body, requestContext(req)),
    null,
    201
  );
}

module.exports = { list, get, updateStatus, convert };
