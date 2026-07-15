const customerService = require('../services/customer.service');
const { requestContext } = require('./context');
const { sendSuccess } = require('../utils/responses');

async function list(req, res) {
  const result = await customerService.listCustomers(req.validated.query);
  return sendSuccess(res, result.data, result.pagination);
}

async function get(req, res) {
  return sendSuccess(res, await customerService.getCustomer(req.validated.params.id));
}

async function create(req, res) {
  return sendSuccess(res, await customerService.createCustomer(req.validated.body, requestContext(req)), null, 201);
}

async function update(req, res) {
  return sendSuccess(res, await customerService.updateCustomer(req.validated.params.id, req.validated.body, requestContext(req)));
}

async function archive(req, res) {
  return sendSuccess(res, await customerService.archiveCustomer(req.validated.params.id, requestContext(req)));
}

async function photos(req, res) {
  const result = await customerService.customerPhotos(req.validated.params.id);
  return sendSuccess(res, result.data);
}

module.exports = { list, get, create, update, archive, photos };
