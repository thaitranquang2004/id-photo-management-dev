const intakeService = require('../services/intake.service');
const bookingService = require('../services/booking.service');
const { requestContext } = require('./context');
const { sendSuccess } = require('../utils/responses');

async function submit(req, res) {
  return sendSuccess(res, await intakeService.submitOnlineRequest(req.validated.body, req.files, req), null, 201);
}

async function publicStatus(req, res) {
  const result = await intakeService.onlineRequestStatus(req.validated.body.so_dien_thoai);
  return sendSuccess(res, result.data);
}

async function datLichChup(req, res) { return sendSuccess(res, await bookingService.datLichChup(req.validated.body, requestContext(req)), null, 201); }
async function khungGioChup(req, res) { return sendSuccess(res, await bookingService.listKhungGioChup(req.validated.query.ngay_hen)); }
async function listCauHinhKhungGio(req, res) { return sendSuccess(res, await bookingService.listCauHinh()); }
async function capNhatCauHinhKhungGio(req, res) { return sendSuccess(res, await bookingService.capNhatCauHinh(req.validated.params.id, req.validated.body)); }

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
  const result = await bookingService.listLichHen(req.validated.query);
  return sendSuccess(res, result.data, result.pagination);
}

async function updateAppointmentStatus(req, res) {
  return sendSuccess(res, await bookingService.capNhatTrangThai(req.validated.params.id, req.validated.body, requestContext(req)));
}

module.exports = {
  submit,
  publicStatus,
  datLichChup,
  khungGioChup,
  listCauHinhKhungGio,
  capNhatCauHinhKhungGio,
  list,
  get,
  accept,
  reject,
  convert,
  listAppointments,
  updateAppointmentStatus
};
