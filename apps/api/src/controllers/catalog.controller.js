const catalogService = require('../services/catalog.service');
const { requestContext } = require('./context');
const { sendSuccess } = require('../utils/responses');

async function listCardTypes(req, res) {
  return sendSuccess(res, await catalogService.listCardTypes());
}

async function createCardType(req, res) {
  return sendSuccess(res, await catalogService.createCardType(req.validated.body, requestContext(req)), null, 201);
}

async function updateCardType(req, res) {
  return sendSuccess(res, await catalogService.updateCardType(req.validated.params.id, req.validated.body, requestContext(req)));
}

async function archiveCardType(req, res) {
  return sendSuccess(res, await catalogService.archiveCardType(req.validated.params.id, requestContext(req)));
}

async function listPricing(req, res) {
  return sendSuccess(res, await catalogService.listPricing(req.validated.query));
}

async function createPricing(req, res) {
  return sendSuccess(res, await catalogService.createPricing(req.validated.body, requestContext(req)), null, 201);
}

module.exports = {
  listCardTypes,
  createCardType,
  updateCardType,
  archiveCardType,
  listPricing,
  createPricing
};
