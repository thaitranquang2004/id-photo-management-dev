const intakeService = require('../services/intake.service');
const { requestContext } = require('./context');
const { sendSuccess } = require('../utils/responses');

async function submit(req, res) {
  return sendSuccess(res, await intakeService.submitOnlineRequest(req.validated.body, req.files, req), null, 201);
}

async function publicStatus(req, res) {
  const result = await intakeService.onlineRequestStatus(req.validated.params.id, req.validated.body.so_dien_thoai);
  return sendSuccess(res, result.data);
}

async function list(req, res) {
  const result = await intakeService.listInbox(req.validated.query);
  return sendSuccess(res, result.data, result.pagination);
}

async function get(req, res) {
  return sendSuccess(res, await intakeService.getInboxItem(req.validated.params.id));
}

async function accept(req, res) {
  return sendSuccess(res, await intakeService.acceptRequest(req.validated.params.id, requestContext(req)));
}

async function reject(req, res) {
  return sendSuccess(res, await intakeService.rejectRequest(req.validated.params.id, req.validated.body, requestContext(req)));
}

async function convert(req, res) {
  return sendSuccess(res, await intakeService.convertToOrder(req.validated.params.id, req.validated.body, requestContext(req)), null, 201);
}

async function listAppointments(req, res) {
  const result = await intakeService.listAppointments(req.validated.query);
  return sendSuccess(res, result.data, result.pagination);
}

async function createAppointment(req, res) {
  return sendSuccess(res, await intakeService.createAppointment(req.validated.body, requestContext(req)), null, 201);
}

async function updateAppointmentStatus(req, res) {
  return sendSuccess(res, await intakeService.updateAppointmentStatus(req.validated.params.id, req.validated.body, requestContext(req)));
}

module.exports = {
  submit,
  publicStatus,
  list,
  get,
  accept,
  reject,
  convert,
  listAppointments,
  createAppointment,
  updateAppointmentStatus
};
