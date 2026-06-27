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
    await writeAudit('card_type.created', 'loai_the', cardType.id, context, { new_data: cardType }, client);
    return { card_type: cardType };
  });
}

async function updateCardType(id, body, context) {
  return withTransaction(async (client) => {
    const oldCardType = await catalogRepository.findCardType(id, client);
    if (!oldCardType) throw errors.notFound('Không tìm thấy loại thẻ');
    const cardType = await catalogRepository.updateCardType(id, body, client);
    await writeAudit('card_type.updated', 'loai_the', id, context, { old_data: oldCardType, new_data: cardType }, client);
    return { card_type: cardType };
  });
}

async function archiveCardType(id, context) {
  return withTransaction(async (client) => {
    const oldCardType = await catalogRepository.findCardType(id, client);
    if (!oldCardType) throw errors.notFound('Không tìm thấy loại thẻ');
    const cardType = await catalogRepository.archiveCardType(id, client);
    await writeAudit('card_type.archived', 'loai_the', id, context, { old_data: oldCardType, new_data: cardType }, client);
    return { card_type: cardType };
  });
}

async function listPricing(query) {
  return { pricing: await catalogRepository.listPricing(query.loai_the_id) };
}

async function createPricing(body, context) {
  return withTransaction(async (client) => {
    const cardType = await catalogRepository.findCardType(body.loai_the_id, client);
    if (!cardType) throw errors.notFound('Không tìm thấy loại thẻ');

    const existing = await catalogRepository.lockPricingForCardType(body.loai_the_id, client);
    const newFrom = dateOnly(body.hieu_luc_tu);
    const newTo = body.hieu_luc_den ? dateOnly(body.hieu_luc_den) : null;

    const openPrice = existing.find((row) => row.hieu_luc_den === null && dateOnly(row.hieu_luc_tu) < newFrom);
    let closedRows = [];
    if (openPrice) {
      closedRows = await catalogRepository.closeOpenPricing(
        body.loai_the_id,
        addDays(body.hieu_luc_tu, -1),
        client
      );
    }

    const refreshed = await catalogRepository.lockPricingForCardType(body.loai_the_id, client);
    const overlapping = refreshed.find((row) => rangesOverlap(row.hieu_luc_tu, row.hieu_luc_den, newFrom, newTo));
    if (overlapping) {
      throw errors.validation('Khoảng giá bị overlap với giá hiện có', {
        card_type_id: body.loai_the_id,
        overlapping_pricing_id: overlapping.id
      });
    }

    const pricing = await catalogRepository.insertPricing(
      { ...body, hieu_luc_tu: newFrom, hieu_luc_den: newTo },
      context.user.id,
      client
    );

    await writeAudit('pricing.changed', 'bang_gia', pricing.id, context, {
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
