const crypto = require('node:crypto');
const { withTransaction } = require('../db/pool');
const env = require('../config/env');
const catalogRepository = require('../repositories/catalog.repository');
const ordersRepository = require('../repositories/orders.repository');
const customersRepository = require('../repositories/customers.repository');
const publicRepository = require('../repositories/public.repository');
const notificationService = require('./notification.service');
const { parsePagination, buildPagination } = require('../utils/pagination');
const { sha256 } = require('../utils/hash');
const { errors } = require('../utils/app-error');
const { writeAudit } = require('./audit.service');

const ACCESS_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function totalFromPricing(pricing, quantity) {
  return Number(pricing.gia_moi_ban) * quantity + Number(pricing.phi_xu_ly);
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

// Core order creation reused by the staff endpoint AND online-request conversion.
// Runs inside the caller's transaction so callers can compose extra work atomically.
async function createOrderCore(body, context, client) {
  const pricing = await catalogRepository.getCurrentPricing(body.card_type_id, new Date(), client);
  if (!pricing) throw errors.validation('Loại thẻ chưa có giá hiện hành', { card_type_id: body.card_type_id });

  const totalAmount = totalFromPricing(pricing, body.quantity);
  const order = await ordersRepository.createOrder(body, context.user.id, totalAmount, client);

  const pricingSnapshot = await ordersRepository.createPricingSnapshot(order, pricing, totalAmount, client);
  await writeAudit('order.created', 'don_hang', order.id, context, { new_data: { order, pricing_snapshot: pricingSnapshot } }, client);
  return { order, pricing_snapshot: pricingSnapshot };
}

async function createOrder(body, context) {
  return withTransaction((client) => createOrderCore(body, context, client));
}

// Mint a customer access token (store only the sha256 hash), flag ready_notified_at,
// and build the photos_ready notification payload with a tokened lookup URL. This
// closes the loop on the previously-unused ma_truy_cap_khach table.
async function prepareReadyNotification(order, client) {
  const customer = await customersRepository.findById(order.customer_id, client);
  const token = crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_MS);
  await publicRepository.createAccessToken(order.id, sha256(token), expiresAt, client);
  await ordersRepository.markReadyNotified(order.id, client);
  const lookupUrl = `${env.WEB_BASE_URL.replace(/\/$/, '')}/tra-cuu?token=${token}`;
  return {
    event_type: 'photos_ready',
    lookup_url: lookupUrl,
    payload: {
      customer_name: customer?.ho_ten,
      email: customer?.email,
      phone: customer?.so_dien_thoai,
      order_id: order.id,
      order_code: order.order_code,
      pickup_date: order.pickup_date,
      lookup_url: lookupUrl
    }
  };
}

async function prepareDeliveredNotification(order, client) {
  const customer = await customersRepository.findById(order.customer_id, client);
  return {
    event_type: 'order_delivered',
    payload: {
      customer_name: customer?.ho_ten,
      email: customer?.email,
      phone: customer?.so_dien_thoai,
      order_id: order.id,
      order_code: order.order_code
    }
  };
}

async function prepareCancelledNotification(order, reason, client) {
  const customer = await customersRepository.findById(order.customer_id, client);
  return {
    event_type: 'order_cancelled',
    payload: {
      customer_name: customer?.ho_ten,
      email: customer?.email,
      phone: customer?.so_dien_thoai,
      order_id: order.id,
      order_code: order.order_code,
      reason
    }
  };
}

async function changeStatus(id, nextStatus, context, options = {}) {
  const outcome = await withTransaction(async (client) => {
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

    if (nextStatus === 'delivered') {
      const total = Number(order.total_amount || 0);
      const paid = Number(order.amount_paid || 0);
      if (paid < total && !options.allow_unpaid_reason) {
        throw errors.invalidState('Đơn chưa thanh toán đủ. Hãy thu đủ tiền hoặc nhập lý do giao nợ.', {
          total_amount: total, amount_paid: paid, balance: total - paid
        });
      }
    }

    const updated = await ordersRepository.updateStatus(id, nextStatus, {
      cancelled_reason: options.reason || null
    }, client);

    await writeAudit('order.status_changed', 'don_hang', id, context, {
      old_data: order,
      new_data: { order: updated, reason: options.reason, skip_layout_reason: options.skip_layout_reason }
    }, client);

    let notify = null;
    if (nextStatus === 'completed' && !order.ready_notified_at) {
      notify = await prepareReadyNotification(updated, client);
    } else if (nextStatus === 'delivered') {
      notify = await prepareDeliveredNotification(updated, client);
    } else if (nextStatus === 'cancelled') {
      notify = await prepareCancelledNotification(updated, options.reason, client);
    }

    return { order: updated, notify };
  });

  // Notify after commit so a mail/Zalo issue never rolls back the status change.
  if (outcome.notify) {
    await notificationService.notifyEvent(outcome.notify.event_type, outcome.notify.payload);
  }
  return { order: outcome.order };
}

// Manual (re)send of the "photos ready" link; returns the lookup URL for the UI.
async function notifyReady(id, context) {
  const outcome = await withTransaction(async (client) => {
    const order = await ordersRepository.findByIdForUpdate(id, client);
    if (!order) throw errors.notFound('Không tìm thấy đơn hàng');
    const notify = await prepareReadyNotification(order, client);
    await writeAudit('order.notify_ready', 'don_hang', id, context, { new_data: { lookup_url: notify.lookup_url } }, client);
    return { order, notify };
  });

  await notificationService.notifyEvent(outcome.notify.event_type, outcome.notify.payload);
  return { order: outcome.order, lookup_url: outcome.notify.lookup_url };
}

module.exports = {
  listOrders,
  getOrder,
  createOrder,
  createOrderCore,
  changeStatus,
  notifyReady,
  assertTransition
};
