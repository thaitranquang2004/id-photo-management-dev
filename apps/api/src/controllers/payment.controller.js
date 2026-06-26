const paymentService = require('../services/payment.service');
const { requestContext } = require('./context');
const { sendSuccess } = require('../utils/responses');

async function record(req, res) {
  return sendSuccess(
    res,
    await paymentService.recordPayment(req.validated.params.id, req.validated.body, requestContext(req)),
    null,
    201
  );
}

async function list(req, res) {
  const result = await paymentService.listPayments(req.validated.params.id);
  return sendSuccess(res, result.data);
}

module.exports = { record, list };
