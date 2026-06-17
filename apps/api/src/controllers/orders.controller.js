const orderService = require('../services/order.service');
const { requestContext } = require('./context');
const { sendSuccess } = require('../utils/responses');

async function list(req, res) {
  const result = await orderService.listOrders(req.validated.query);
  return sendSuccess(res, result.data, result.pagination);
}

async function get(req, res) {
  return sendSuccess(res, await orderService.getOrder(req.validated.params.id));
}

async function create(req, res) {
  return sendSuccess(res, await orderService.createOrder(req.validated.body, requestContext(req)), null, 201);
}

async function startProcessing(req, res) {
  return sendSuccess(res, await orderService.changeStatus(req.validated.params.id, 'processing', requestContext(req)));
}

async function complete(req, res) {
  return sendSuccess(res, await orderService.changeStatus(req.validated.params.id, 'completed', requestContext(req), req.validated.body));
}

async function deliver(req, res) {
  return sendSuccess(res, await orderService.changeStatus(req.validated.params.id, 'delivered', requestContext(req)));
}

async function cancel(req, res) {
  return sendSuccess(res, await orderService.changeStatus(req.validated.params.id, 'cancelled', requestContext(req), {
    reason: req.validated.body.reason
  }));
}

module.exports = { list, get, create, startProcessing, complete, deliver, cancel };
