const layoutService = require('../services/layout.service');
const { requestContext } = require('./context');
const { sendSuccess } = require('../utils/responses');

async function validateConfig(req, res) {
  return sendSuccess(res, await layoutService.validateConfig(req.validated.body));
}

async function preview(req, res) {
  return sendSuccess(res, await layoutService.preview(req.validated.body));
}

async function generate(req, res) {
  return sendSuccess(res, await layoutService.generateLayout(req.validated.body, requestContext(req)), null, 201);
}

async function get(req, res) {
  return sendSuccess(res, await layoutService.getLayout(req.validated.params.id));
}

async function downloadUrl(req, res) {
  return sendSuccess(res, await layoutService.downloadUrl(req.validated.params.id));
}

async function reprint(req, res) {
  return sendSuccess(res, await layoutService.reprint(req.validated.params.id));
}

async function issue(req, res) {
  return sendSuccess(res, await layoutService.reportIssue(req.validated.params.id, req.validated.body, requestContext(req)), null, 201);
}

module.exports = { validateConfig, preview, generate, get, downloadUrl, reprint, issue };
