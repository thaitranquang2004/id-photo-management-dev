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
  if (typeof date === 'string') return date.slice(0, 10);
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
  const [cardTypes, onlineFilePricing] = await Promise.all([
    catalogRepository.listCardTypes(),
    catalogRepository.getCurrentOnlineFilePricingOrNull(new Date())
  ]);
  return {
    card_types: cardTypes,
    gia_file_truc_tuyen_hien_hanh: onlineFilePricing?.gia_tron_goi ?? null,
    bang_gia_file_truc_tuyen_hien_hanh_id: onlineFilePricing?.id ?? null
  };
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
    const closedPricing = await catalogRepository.closeActivePricingForCardType(id, dateOnly(new Date()), client);
    await writeAudit('card_type.archived', 'loai_the', id, context, {
      old_data: oldCardType,
      new_data: { card_type: cardType, closed_pricing: closedPricing }
    }, client);
    return { card_type: cardType, closed_pricing: closedPricing };
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

async function listOnlineFilePricing() {
  try {
    const [pricing, currentPricing] = await Promise.all([
      catalogRepository.listOnlineFilePricing(),
      catalogRepository.getCurrentOnlineFilePricing(new Date())
    ]);
    return { pricing, current_pricing: currentPricing, pricing_schema_ready: true };
  } catch (error) {
    if (catalogRepository.isOnlineFilePricingTableMissing(error)) {
      return { pricing: [], current_pricing: null, pricing_schema_ready: false };
    }
    throw error;
  }
}

async function createOnlineFilePricing(body, context) {
  try {
    return await withTransaction(async (client) => {
      // Bảng này là một mức giá chung, nên phải khoá cả trường hợp chưa có hàng nào.
      // FOR UPDATE không khoá được bảng rỗng và có thể để hai Admin cùng tạo mốc đầu tiên.
      await client.query("select pg_advisory_xact_lock(hashtext('id_photo_online_file_pricing'))");

      const existing = await catalogRepository.lockOnlineFilePricing(client);
      const newFrom = dateOnly(body.hieu_luc_tu);
      const newTo = body.hieu_luc_den ? dateOnly(body.hieu_luc_den) : null;

      const openPrice = existing.find((row) => row.hieu_luc_den === null && dateOnly(row.hieu_luc_tu) < newFrom);
      let closedRows = [];
      if (openPrice) {
        closedRows = await catalogRepository.closeOpenOnlineFilePricing(
          addDays(body.hieu_luc_tu, -1),
          client
        );
      }

      const refreshed = await catalogRepository.lockOnlineFilePricing(client);
      const overlapping = refreshed.find((row) => rangesOverlap(row.hieu_luc_tu, row.hieu_luc_den, newFrom, newTo));
      if (overlapping) {
        throw errors.validation('Khoảng giá file trực tuyến bị overlap với giá hiện có', {
          overlapping_pricing_id: overlapping.id
        });
      }

      const pricing = await catalogRepository.insertOnlineFilePricing(
        { ...body, hieu_luc_tu: newFrom, hieu_luc_den: newTo },
        context.user.id,
        client
      );

      await writeAudit('online_file_pricing.changed', 'bang_gia_file_truc_tuyen', pricing.id, context, {
        old_data: { closed_pricing: closedRows },
        new_data: pricing
      }, client);

      return { pricing };
    });
  } catch (error) {
    // Hàng rào DB vẫn là lớp bảo vệ cuối cùng nếu có thao tác ngoài API.
    if (error.code === '23P01') {
      throw errors.validation('Khoảng giá file trực tuyến bị overlap với giá hiện có');
    }
    if (catalogRepository.isOnlineFilePricingTableMissing(error)) {
      throw errors.validation('Database chưa được cập nhật giá file trực tuyến. Vui lòng chạy migration trước khi cấu hình giá.');
    }
    throw error;
  }
}

module.exports = {
  listCardTypes,
  createCardType,
  updateCardType,
  archiveCardType,
  listPricing,
  createPricing,
  listOnlineFilePricing,
  createOnlineFilePricing,
  dateOnly,
  rangesOverlap
};
