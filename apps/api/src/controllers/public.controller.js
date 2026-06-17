const publicService = require('../services/public.service');
const { sendSuccess } = require('../utils/responses');

async function customerLookup(req, res) {
  return sendSuccess(res, await publicService.customerLookup(req.validated.query, req));
}

async function photoDownloadUrl(req, res) {
  return sendSuccess(res, await publicService.photoDownloadUrl(req.validated.params.id, req.validated.body, req));
}

async function createReprintRequest(req, res) {
  return sendSuccess(res, await publicService.createReprintRequest(req.validated.body, req), null, 201);
}

module.exports = { customerLookup, photoDownloadUrl, createReprintRequest };
