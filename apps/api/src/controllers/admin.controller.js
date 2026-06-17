const adminService = require('../services/admin.service');
const { requestContext } = require('./context');
const { sendSuccess } = require('../utils/responses');

async function dashboard(req, res) {
  return sendSuccess(res, await adminService.dashboard());
}

async function ordersReport(req, res) {
  return sendSuccess(res, await adminService.orderReport(req.validated.query));
}

async function ordersReportCsv(req, res) {
  const csv = await adminService.orderReportCsv(req.validated.query);
  res.type('text/csv');
  return res.send(csv);
}

async function createExport(req, res) {
  return sendSuccess(res, await adminService.createExportJob(req.validated.body, requestContext(req)), null, 201);
}

async function getExportJob(req, res) {
  return sendSuccess(res, await adminService.getExportJob(req.validated.params.id));
}

async function listUsers(req, res) {
  const result = await adminService.listUsers(req.validated.query);
  return sendSuccess(res, result.data, result.pagination);
}

async function createUser(req, res) {
  return sendSuccess(res, await adminService.createUser(req.validated.body, requestContext(req)), null, 201);
}

async function updateUser(req, res) {
  return sendSuccess(res, await adminService.updateUser(req.validated.params.id, req.validated.body, requestContext(req)));
}

async function resetPassword(req, res) {
  return sendSuccess(res, await adminService.resetPassword(req.validated.params.id, requestContext(req)));
}

async function auditLogs(req, res) {
  const result = await adminService.auditLogs(req.validated.query);
  return sendSuccess(res, result.data, result.pagination);
}

module.exports = {
  dashboard,
  ordersReport,
  ordersReportCsv,
  createExport,
  getExportJob,
  listUsers,
  createUser,
  updateUser,
  resetPassword,
  auditLogs
};
