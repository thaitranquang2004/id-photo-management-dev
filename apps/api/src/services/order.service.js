const { withTransaction } = require('../db/pool');
const catalogRepository = require('../repositories/catalog.repository');
const ordersRepository = require('../repositories/orders.repository');
const { parsePagination, buildPagination } = require('../utils/pagination');
const { generateOrderCode } = require('../utils/order-code');
const { errors } = require('../utils/app-error');
const { writeAudit } = require('./audit.service');

function totalFromPricing(pricing, quantity) {
  return Number(pricing.price_per_copy) * quantity + Number(pricing.processing_fee);
}

function assertTransition(current, next) {
  const allowed = {
    pending: ['processing', 'cancelled'],
    processing: ['completed', 'cancelled'],
    completed: ['delivered', 'cancelled'],
    delivered: [],
    cancelled: []
  };

  if (!allowed[current]?.includes(next)) {
    throw errors.invalidState(`Không thể chuyển đơn từ ${current} sang ${next}`, { current, next });
  }
}

async function listOrders(query) {
  const pagination = parsePagination(query);
  const result = await ordersRepository.list(query, pagination);
  return {
    data: { orders: result.rows.map(({ total, ...row }) => row), total: result.total },
    pagination: buildPagination(pagination.page, pagination.limit, result.total)
  };
}

async function getOrder(id) {
  const details = await ordersRepository.details(id);
  if (!details) throw errors.notFound('Không tìm thấy đơn hàng');
  return details;
}

async function createOrder(body, context) {
  return withTransaction(async (client) => {
    const pricing = await catalogRepository.getCurrentPricing(body.card_type_id, new Date(), client);
    if (!pricing) throw errors.validation('Loại thẻ chưa có giá hiện hành', { card_type_id: body.card_type_id });

    const totalAmount = totalFromPricing(pricing, body.quantity);
    let order = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        order = await ordersRepository.createOrder(body, generateOrderCode(), context.user.id, totalAmount, client);
        break;
      } catch (error) {
        if (error.code !== '23505' || attempt === 2) throw error;
      }
    }

    const pricingSnapshot = await ordersRepository.createPricingSnapshot(order, pricing, totalAmount, client);
    await writeAudit('order.created', 'orders', order.id, context, { new_data: { order, pricing_snapshot: pricingSnapshot } }, client);
    return { order, pricing_snapshot: pricingSnapshot };
  });
}

async function changeStatus(id, nextStatus, context, options = {}) {
  return withTransaction(async (client) => {
    const order = await ordersRepository.findByIdForUpdate(id, client);
    if (!order) throw errors.notFound('Không tìm thấy đơn hàng');
    assertTransition(order.status, nextStatus);

    if (nextStatus === 'completed') {
      const approvedCount = await ordersRepository.countApprovedPhotos(id, client);
      const layoutCount = await ordersRepository.countGeneratedLayouts(id, client);
      if (approvedCount < 1) {
        throw errors.invalidState('Cần ít nhất một ảnh approved để hoàn tất đơn', { approved_photos: approvedCount });
      }
      if (layoutCount < 1 && !options.skip_layout_reason) {
        throw errors.invalidState('Cần layout generated hoặc skip_layout_reason để hoàn tất đơn', { generated_layouts: layoutCount });
      }
    }

    const updated = await ordersRepository.updateStatus(id, nextStatus, {
      cancelled_reason: options.reason || null
    }, client);

    await writeAudit('order.status_changed', 'orders', id, context, {
      old_data: order,
      new_data: { order: updated, reason: options.reason, skip_layout_reason: options.skip_layout_reason }
    }, client);

    return { order: updated };
  });
}

module.exports = {
  listOrders,
  getOrder,
  createOrder,
  changeStatus,
  assertTransition
};
