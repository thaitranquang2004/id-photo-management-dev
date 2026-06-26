const { withTransaction } = require('../db/pool');
const reprintRepository = require('../repositories/reprint.repository');
const ordersRepository = require('../repositories/orders.repository');
const photosRepository = require('../repositories/photos.repository');
const customersRepository = require('../repositories/customers.repository');
const orderService = require('./order.service');
const assetService = require('./asset.service');
const notificationService = require('./notification.service');
const { parsePagination, buildPagination } = require('../utils/pagination');
const { errors } = require('../utils/app-error');
const { writeAudit } = require('./audit.service');

const allowedTransitions = {
  new: ['reviewed', 'accepted', 'rejected'],
  reviewed: ['accepted', 'rejected'],
  accepted: ['completed'],
  rejected: [],
  completed: []
};

async function listRequests(query) {
  const pagination = parsePagination(query);
  const result = await reprintRepository.list(query, pagination);
  return {
    data: { requests: result.rows.map(({ total, ...row }) => row), total: result.total },
    pagination: buildPagination(pagination.page, pagination.limit, result.total)
  };
}

async function getRequest(id) {
  const details = await reprintRepository.details(id);
  if (!details) throw errors.notFound('Không tìm thấy yêu cầu in lại');
  return details;
}

async function updateStatus(id, body, context) {
  return withTransaction(async (client) => {
    const oldRequest = await reprintRepository.findById(id, client);
    if (!oldRequest) throw errors.notFound('Không tìm thấy yêu cầu in lại');
    if (!allowedTransitions[oldRequest.status]?.includes(body.status)) {
      throw errors.invalidState(`Không thể chuyển reprint request từ ${oldRequest.status} sang ${body.status}`, {
        current: oldRequest.status,
        next: body.status
      });
    }
    const request = await reprintRepository.updateStatus(id, body, context.user.id, client);
    await writeAudit('reprint_request.status_changed', 'yeu_cau_in_lai', id, context, {
      old_data: oldRequest,
      new_data: request
    }, client);
    return { request };
  });
}

// Turn an accepted reprint request into a real (billable) order: reuse the
// original order's customer + card type, copy the requested printable photos in
// as already-approved, and link the request to the new order.
async function convertToOrder(id, body, context) {
  const outcome = await withTransaction(async (client) => {
    const request = await reprintRepository.findById(id, client);
    if (!request) throw errors.notFound('Không tìm thấy yêu cầu in lại');
    if (request.reprint_order_id) {
      throw errors.invalidState('Yêu cầu in lại đã được tạo đơn', { reprint_order_id: request.reprint_order_id });
    }
    if (!['new', 'reviewed', 'accepted'].includes(request.status)) {
      throw errors.invalidState(`Không thể tạo đơn từ yêu cầu ở trạng thái ${request.status}`, { status: request.status });
    }

    const origOrder = await ordersRepository.findById(request.order_id, client);
    if (!origOrder) throw errors.invalidState('Đơn gốc không còn tồn tại');

    const { order, pricing_snapshot: pricingSnapshot } = await orderService.createOrderCore({
      customer_id: origOrder.customer_id,
      card_type_id: origOrder.card_type_id,
      quantity: body.quantity || request.quantity,
      pickup_date: body.pickup_date,
      notes: body.notes || `In lại từ đơn ${origOrder.order_code}`,
      intake_source: 'reprint',
      delivery_method: 'pickup'
    }, context, client);

    // Fall back to all approved photos of the original order when the customer
    // didn't pick specific photos, so the reprint order always has photos to print.
    const sourcePhotos = request.requested_photo_ids?.length
      ? await photosRepository.findManyByIds(request.requested_photo_ids, client)
      : await photosRepository.findApprovedByOrder(origOrder.id, client);
    for (const src of sourcePhotos) {
      const printablePublicId = src.cloudinary_processed_public_id || src.cloudinary_original_public_id;
      const asset = await assetService.downloadBuffer(printablePublicId);
      const uploaded = await assetService.uploadBuffer(asset.buffer, {
        folder: `id-photo-management/orders/${order.id}/originals`,
        resource_type: 'image'
      });
      const photo = await photosRepository.create({
        order_id: order.id,
        cloudinary_original_public_id: uploaded.public_id,
        original_asset_metadata: {
          ...assetService.cloudinaryMetadata(uploaded),
          copied_from_photo: src.id,
          copied_from_order: origOrder.id
        },
        width_px: src.width_px,
        height_px: src.height_px,
        file_size_bytes: src.file_size_bytes
      }, client);
      await photosRepository.updateStatus(photo.id, 'approved', {}, client);
    }

    const updatedRequest = await reprintRepository.linkOrder(id, order.id, context.user.id, client);
    await writeAudit('reprint_request.converted', 'yeu_cau_in_lai', id, context, {
      old_data: request,
      new_data: { request: updatedRequest, order_id: order.id }
    }, client);

    const customer = await customersRepository.findById(origOrder.customer_id, client);
    return { request: updatedRequest, order, pricing_snapshot: pricingSnapshot, customer };
  });

  // After commit so a mail/Zalo issue never rolls back the conversion.
  await notificationService.notifyEvent('reprint_approved', {
    customer_name: outcome.customer?.full_name,
    email: outcome.customer?.email,
    phone: outcome.customer?.phone,
    order_id: outcome.order.id,
    order_code: outcome.order.order_code,
    quantity: outcome.order.quantity
  });

  return { request: outcome.request, order: outcome.order, pricing_snapshot: outcome.pricing_snapshot };
}

module.exports = { listRequests, getRequest, updateStatus, convertToOrder };
