const { withTransaction } = require('../db/pool');
const catalogRepository = require('../repositories/catalog.repository');
const { errors } = require('../utils/app-error');
const { writeAudit } = require('./audit.service');

function addDays(date, days) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy.toISOString().slice(0, 10);
}

function dateOnly(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function rangesOverlap(aFrom, aTo, bFrom, bTo) {
  const aStart = dateOnly(aFrom);
  const aEnd = aTo ? dateOnly(aTo) : '9999-12-31';
  const bStart = dateOnly(bFrom);
  const bEnd = bTo ? dateOnly(bTo) : '9999-12-31';
  return aStart <= bEnd && bStart <= aEnd;
}

async function listCardTypes() {
  return { card_types: await catalogRepository.listCardTypes() };
}

async function createCardType(body, context) {
  return withTransaction(async (client) => {
    const cardType = await catalogRepository.createCardType(body, client);
    await writeAudit('card_type.created', 'card_types', cardType.id, context, { new_data: cardType }, client);
    return { card_type: cardType };
  });
}

async function updateCardType(id, body, context) {
  return withTransaction(async (client) => {
    const oldCardType = await catalogRepository.findCardType(id, client);
    if (!oldCardType) throw errors.notFound('Không tìm thấy loại thẻ');
    const cardType = await catalogRepository.updateCardType(id, body, client);
    await writeAudit('card_type.updated', 'card_types', id, context, { old_data: oldCardType, new_data: cardType }, client);
    return { card_type: cardType };
  });
}

async function archiveCardType(id, context) {
  return withTransaction(async (client) => {
    const oldCardType = await catalogRepository.findCardType(id, client);
    if (!oldCardType) throw errors.notFound('Không tìm thấy loại thẻ');
    const cardType = await catalogRepository.archiveCardType(id, client);
    await writeAudit('card_type.archived', 'card_types', id, context, { old_data: oldCardType, new_data: cardType }, client);
    return { card_type: cardType };
  });
}

async function listPricing(query) {
  return { pricing: await catalogRepository.listPricing(query.card_type_id) };
}

async function createPricing(body, context) {
  return withTransaction(async (client) => {
    const cardType = await catalogRepository.findCardType(body.card_type_id, client);
    if (!cardType) throw errors.notFound('Không tìm thấy loại thẻ');

    const existing = await catalogRepository.lockPricingForCardType(body.card_type_id, client);
    const newFrom = dateOnly(body.effective_from);
    const newTo = body.effective_to ? dateOnly(body.effective_to) : null;

    const openPrice = existing.find((row) => row.effective_to === null && dateOnly(row.effective_from) < newFrom);
    let closedRows = [];
    if (openPrice) {
      closedRows = await catalogRepository.closeOpenPricing(
        body.card_type_id,
        addDays(body.effective_from, -1),
        client
      );
    }

    const refreshed = await catalogRepository.lockPricingForCardType(body.card_type_id, client);
    const overlapping = refreshed.find((row) => rangesOverlap(row.effective_from, row.effective_to, newFrom, newTo));
    if (overlapping) {
      throw errors.validation('Khoảng giá bị overlap với giá hiện có', {
        card_type_id: body.card_type_id,
        overlapping_pricing_id: overlapping.id
      });
    }

    const pricing = await catalogRepository.insertPricing(
      { ...body, effective_from: newFrom, effective_to: newTo },
      context.user.id,
      client
    );

    await writeAudit('pricing.changed', 'pricing', pricing.id, context, {
      old_data: { closed_pricing: closedRows },
      new_data: pricing
    }, client);

    return { pricing };
  });
}

module.exports = {
  listCardTypes,
  createCardType,
  updateCardType,
  archiveCardType,
  listPricing,
  createPricing
};
