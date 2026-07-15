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

async function cardTypes(req, res) {
  return sendSuccess(res, await publicService.listPublicCardTypes());
}

async function qcCheck(req, res) {
  return sendSuccess(res, await publicService.checkPhotoQuality(req.file, req.validated.body.loai_the_id));
}

module.exports = { customerLookup, photoDownloadUrl, createReprintRequest, cardTypes, qcCheck };
