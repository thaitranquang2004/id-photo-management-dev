const { withTransaction } = require('../db/pool');
const env = require('../config/env');
const catalogRepository = require('../repositories/catalog.repository');
const ordersRepository = require('../repositories/orders.repository');
const customersRepository = require('../repositories/customers.repository');
const lichHenRepository = require('../repositories/lich-hen.repository');
const notificationService = require('./notification.service');
const { parsePagination, buildPagination } = require('../utils/pagination');
const { errors } = require('../utils/app-error');
const { writeAudit } = require('./audit.service');

function totalFromPricing(pricing, quantity) {
  return Number(pricing.gia_moi_ban) * quantity + Number(pricing.phi_xu_ly);
}

function totalFromOnlineFilePricing(pricing) {
  return Number(pricing.gia_tron_goi);
}

function assertTransition(current, next) {
  const allowed = {
    cho_xu_ly: ['dang_xu_ly', 'da_huy'],
    dang_xu_ly: ['hoan_tat', 'da_huy'],
    hoan_tat: ['da_giao', 'da_huy'],
    da_giao: [],
    da_huy: []
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
  const isOnlineFileDelivery = body.hinh_thuc_giao === 'lay_file_truc_tuyen';
  // File trực tuyến dùng giá trọn gói, nên không tin hoặc lưu số lượng client gửi lên.
  // Bản sao này cũng giữ các caller tái sử dụng `body` không bị thay đổi ngoài ý muốn.
  const orderBody = isOnlineFileDelivery ? { ...body, so_luong: 1 } : body;
  let pricing = null;
  let onlineFilePricing = null;
  let cardType = null;
  let totalAmount;

  // Không cho tạo đơn mới với loại thẻ đã archive, kể cả khi client giữ lại
  // một loai_the_id cũ hoặc gọi API trực tiếp.
  cardType = await catalogRepository.findCardType(orderBody.loai_the_id, client);
  if (!cardType || cardType.dang_hoat_dong === false) {
    throw errors.validation('Loại thẻ không còn áp dụng', { loai_the_id: orderBody.loai_the_id });
  }

  if (isOnlineFileDelivery) {
    try {
      onlineFilePricing = await catalogRepository.getCurrentOnlineFilePricing(new Date(), client);
    } catch (error) {
      if (!catalogRepository.isOnlineFilePricingTableMissing(error)) throw error;
    }
    if (!onlineFilePricing) {
      throw errors.validation(
        'Chưa cấu hình giá file trực tuyến. Vui lòng liên hệ Admin để cập nhật Bảng giá.',
        { hinh_thuc_giao: orderBody.hinh_thuc_giao }
      );
    }
    totalAmount = totalFromOnlineFilePricing(onlineFilePricing);
  } else {
    pricing = await catalogRepository.getCurrentPricing(orderBody.loai_the_id, new Date(), client);
    if (!pricing) throw errors.validation('Loại thẻ chưa có giá hiện hành', { loai_the_id: orderBody.loai_the_id });
    totalAmount = totalFromPricing(pricing, orderBody.so_luong);
  }

  const order = await ordersRepository.createOrder(orderBody, context?.user?.id || null, totalAmount, client);

  const pricingSnapshot = await ordersRepository.createPricingSnapshot(order, pricing, totalAmount, client, {
    cardType,
    onlineFilePricing
  });
  await writeAudit('order.created', 'don_hang', order.id, context, { new_data: { order, pricing_snapshot: pricingSnapshot } }, client);
  return { order, pricing_snapshot: pricingSnapshot };
}

async function createOrder(body, context) {
  return withTransaction(async (client) => {
    const result = await createOrderCore(body, context, client);
    if (body.lich_hen_id) {
      const lichHen = await lichHenRepository.findById(body.lich_hen_id, client, true);
      if (!lichHen || lichHen.loai_lich !== 'dat_lich_chup' || lichHen.trang_thai !== 'da_xac_nhan') {
        throw errors.invalidState('Chỉ có thể tạo đơn từ lịch chụp đã xác nhận');
      }
      await lichHenRepository.ganDonVaHoanTat(lichHen.id, result.order.id, context.user.id, client);
    } else if (body.hinh_thuc_giao === 'hen_lay_hinh') {
      const customer = await customersRepository.findById(body.khach_hang_id, client);
      await lichHenRepository.create({
        don_hang_id: result.order.id,
        ten_khach: customer?.ho_ten,
        so_dien_thoai: customer?.so_dien_thoai,
        email: customer?.email,
        ngay_hen: body.ngay_hen_lay,
        khung_gio: body.khung_gio_lay,
        loai_lich: 'hen_lay_hinh',
        trang_thai: 'da_xac_nhan',
        nguoi_xac_nhan: context.user.id
      }, client);
    }
    return result;
  });
}

// Flag ready_notified_at và dựng payload thông báo photos_ready với link tra cứu
// tự điền SĐT + mã đơn (khách bấm là tra được ngay, không cần token).
async function prepareReadyNotification(order, client) {
  const customer = await customersRepository.findById(order.khach_hang_id, client);
  await ordersRepository.markReadyNotified(order.id, client);
  const lookupUrl = `${env.WEB_BASE_URL.replace(/\/$/, '')}/tra-cuu`
    + `?sdt=${encodeURIComponent(customer?.so_dien_thoai || '')}`
    + `&ma_don=${encodeURIComponent(order.ma_don)}`;
  return {
    event_type: 'photos_ready',
    lookup_url: lookupUrl,
    payload: {
      customer_name: customer?.ho_ten,
      email: customer?.email,
      phone: customer?.so_dien_thoai,
      order_id: order.id,
      order_code: order.ma_don,
      pickup_date: order.ngay_hen_lay,
      lookup_url: lookupUrl
    }
  };
}

async function prepareDeliveredNotification(order, client) {
  const customer = await customersRepository.findById(order.khach_hang_id, client);
  return {
    event_type: 'order_delivered',
    payload: {
      customer_name: customer?.ho_ten,
      email: customer?.email,
      phone: customer?.so_dien_thoai,
      order_id: order.id,
      order_code: order.ma_don
    }
  };
}

async function prepareCancelledNotification(order, reason, client) {
  const customer = await customersRepository.findById(order.khach_hang_id, client);
  return {
    event_type: 'order_cancelled',
    payload: {
      customer_name: customer?.ho_ten,
      email: customer?.email,
      phone: customer?.so_dien_thoai,
      order_id: order.id,
      order_code: order.ma_don,
      reason
    }
  };
}

async function changeStatus(id, nextStatus, context, options = {}) {
  const outcome = await withTransaction(async (client) => {
    const order = await ordersRepository.findByIdForUpdate(id, client);
    if (!order) throw errors.notFound('Không tìm thấy đơn hàng');
    assertTransition(order.trang_thai, nextStatus);

    if (nextStatus === 'hoan_tat') {
      const approvedCount = await ordersRepository.countApprovedPhotos(id, client);
      if (approvedCount < 1) {
        throw errors.invalidState('Cần ít nhất một ảnh đã duyệt để hoàn tất đơn', { approved_photos: approvedCount });
      }
    }

    if (nextStatus === 'da_giao') {
      const total = Number(order.tong_tien || 0);
      const paid = Number(order.da_thanh_toan || 0);
      if (paid < total) {
        throw errors.invalidState('Đơn chưa thanh toán đủ. Hãy thu đủ tiền trước khi giao.', {
          total_amount: total, amount_paid: paid, balance: total - paid
        });
      }
    }

    const updated = await ordersRepository.updateStatus(id, nextStatus, {
      cancelled_reason: options.reason || null
    }, client);

    await writeAudit('order.status_changed', 'don_hang', id, context, {
      old_data: order,
      new_data: { order: updated, reason: options.reason }
    }, client);

    let notifications = [];
    if (nextStatus === 'hoan_tat' && !order.ngay_bao_san_sang) {
      const notify = await prepareReadyNotification(updated, client);
      notifications = await notificationService.enqueueEvent(notify.event_type, notify.payload, client);
    } else if (nextStatus === 'da_giao') {
      const notify = await prepareDeliveredNotification(updated, client);
      notifications = await notificationService.enqueueEvent(notify.event_type, notify.payload, client);
    } else if (nextStatus === 'da_huy') {
      const notify = await prepareCancelledNotification(updated, options.reason, client);
      notifications = await notificationService.enqueueEvent(notify.event_type, notify.payload, client);
    }

    return { order: updated, notifications };
  });

  await notificationService.dispatchRows(outcome.notifications);
  return { order: outcome.order };
}

// Gửi link chỉ khi đã có ảnh approved. Với đơn đang xử lý, thao tác này cũng là
// xác nhận ảnh đã sẵn sàng nên đơn được chuyển sang completed trong cùng transaction.
async function notifyReady(id, context) {
  const outcome = await withTransaction(async (client) => {
    const order = await ordersRepository.findByIdForUpdate(id, client);
    if (!order) throw errors.notFound('Không tìm thấy đơn hàng');

    const approvedCount = await ordersRepository.countApprovedPhotos(id, client);
    if (approvedCount < 1) {
      throw errors.invalidState('Cần ít nhất một ảnh đã duyệt trước khi gửi link cho khách', {
        approved_photos: approvedCount
      });
    }
    if (order.trang_thai === 'da_huy') {
      throw errors.invalidState('Không thể gửi link cho đơn đã hủy', { current: order.trang_thai });
    }

    let updatedOrder = order;
    if (['cho_xu_ly', 'dang_xu_ly'].includes(order.trang_thai)) {
      updatedOrder = await ordersRepository.updateStatus(id, 'hoan_tat', {}, client);
      await writeAudit('order.status_changed', 'don_hang', id, context, {
        old_data: order,
        new_data: { order: updatedOrder, reason: 'notify_ready' }
      }, client);
    }

    const notify = await prepareReadyNotification(updatedOrder, client);
    const notifications = await notificationService.enqueueEvent(notify.event_type, notify.payload, client);
    await writeAudit('order.notify_ready', 'don_hang', id, context, {
      new_data: { order: updatedOrder, lookup_url: notify.lookup_url }
    }, client);
    return { order: updatedOrder, notify, notifications };
  });

  await notificationService.dispatchRows(outcome.notifications);
  return { order: outcome.order, lookup_url: outcome.notify.lookup_url };
}

module.exports = {
  listOrders,
  getOrder,
  createOrder,
  createOrderCore,
  changeStatus,
  notifyReady,
  assertTransition,
  totalFromPricing,
  totalFromOnlineFilePricing
};
