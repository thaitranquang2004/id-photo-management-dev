const photoService = require('../services/photo.service');
const { requestContext } = require('./context');
const { sendSuccess } = require('../utils/responses');

async function create(req, res) {
  return sendSuccess(res, await photoService.createPhotos(req.validated.body, req.files, requestContext(req)), null, 201);
}

async function batchProcess(req, res) {
  return sendSuccess(res, await photoService.batchProcess(req.validated.body, requestContext(req)), null, 201);
}

async function getJob(req, res) {
  return sendSuccess(res, await photoService.getProcessingJob(req.validated.params.id));
}

async function get(req, res) {
  return sendSuccess(res, await photoService.getPhoto(req.validated.params.id));
}

async function approve(req, res) {
  return sendSuccess(res, await photoService.approvePhoto(req.validated.params.id, requestContext(req)));
}

async function reject(req, res) {
  return sendSuccess(res, await photoService.rejectPhoto(req.validated.params.id, req.validated.body, requestContext(req)));
}

async function override(req, res) {
  return sendSuccess(res, await photoService.overridePhoto(req.validated.params.id, req.validated.body, requestContext(req)));
}

module.exports = { create, batchProcess, getJob, get, approve, reject, override };
