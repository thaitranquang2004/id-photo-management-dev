const crypto = require('node:crypto');
const { withTransaction } = require('../db/pool');
const onlineRepository = require('../repositories/online.repository');
const customersRepository = require('../repositories/customers.repository');
const catalogRepository = require('../repositories/catalog.repository');
const photosRepository = require('../repositories/photos.repository');
const publicRepository = require('../repositories/public.repository');
const orderService = require('./order.service');
const assetService = require('./asset.service');
const notificationService = require('./notification.service');
const { writeAudit } = require('./audit.service');
const { parsePagination, buildPagination } = require('../utils/pagination');
const { errors } = require('../utils/app-error');
const { sha256 } = require('../utils/hash');

function ipHash(req) {
  return sha256(req.ip || 'unknown');
}

async function uploadRequestFile(file, requestId) {
  const result = await assetService.uploadBuffer(file.buffer, {
    folder: `id-photo-management/online-requests/${requestId}/originals`,
    resource_type: 'image'
  });
  return {
    online_request_id: requestId,
    cloudinary_original_public_id: result.public_id,
    original_asset_metadata: {
      ...assetService.cloudinaryMetadata(result),
      original_filename: file.originalname,
      mimetype: file.mimetype
    },
    width_px: result.width,
    height_px: result.height,
    file_size_bytes: result.bytes
  };
}

// Public, no-login. Creates an online request with optional self-uploaded photos
// and/or a lightweight appointment. Uploads happen before the transaction (matching
// the staff photo-upload flow) using a pre-generated request id for clean foldering.
async function submitOnlineRequest(body, files, req) {
  if (body.card_type_id) {
    const cardType = await catalogRepository.findCardType(body.card_type_id);
    if (!cardType || !cardType.is_active) {
      throw errors.validation('Loại ảnh không hợp lệ', { card_type_id: body.card_type_id });
    }
  }

  const requestId = crypto.randomUUID();
  const photoInputs = files?.length
    ? await Promise.all(files.map((file) => uploadRequestFile(file, requestId)))
    : [];

  const created = await withTransaction(async (client) => {
    const request = await onlineRepository.createRequest({
      id: requestId,
      full_name: body.full_name,
      phone: body.phone,
      email: body.email,
      card_type_id: body.card_type_id,
      request_type: body.request_type,
      note: body.note,
      ip_hash: ipHash(req),
      user_agent: req.get('user-agent'),
      metadata: {}
    }, client);

    for (const input of photoInputs) {
      await onlineRepository.addRequestPhoto(input, client);
    }

    let appointment = null;
    if (body.preferred_date && body.time_slot) {
      appointment = await onlineRepository.createAppointment({
        online_request_id: requestId,
        customer_name: body.full_name,
        phone: body.phone,
        preferred_date: body.preferred_date,
        time_slot: body.time_slot,
        status: 'requested',
        note: body.note
      }, client);
    }

    await publicRepository.logLookupEvent({
      action: 'online_request',
      result: 'success',
      phone: body.phone,
      success: true,
      ip_hash: ipHash(req),
      user_agent: req.get('user-agent'),
      metadata: {
        online_request_id: requestId,
        request_type: body.request_type,
        photo_count: photoInputs.length,
        has_appointment: Boolean(appointment)
      }
    }, client);

    return { request_id: request.id, status: request.status, photo_count: photoInputs.length };
  });

  // Fire-and-forget after commit so notification issues never break the submission.
  await notificationService.notifyEvent('online_request_received', {
    customer_name: body.full_name,
    email: body.email,
    phone: body.phone,
    online_request_id: created.request_id,
    metadata: { request_type: body.request_type }
  });

  return created;
}

async function listInbox(query) {
  const pagination = parsePagination(query);
  const result = await onlineRepository.listRequests(query, pagination);
  return {
    data: { online_requests: result.rows.map(({ total, ...row }) => row), total: result.total },
    pagination: buildPagination(pagination.page, pagination.limit, result.total)
  };
}

async function getInboxItem(id) {
  const details = await onlineRepository.requestDetails(id);
  if (!details) throw errors.notFound('Không tìm thấy yêu cầu online');
  return details;
}

async function acceptRequest(id, context) {
  const updated = await withTransaction(async (client) => {
    const request = await onlineRepository.findRequestById(id, client);
    if (!request) throw errors.notFound('Không tìm thấy yêu cầu online');
    if (request.status !== 'new') {
      throw errors.invalidState('Chỉ yêu cầu mới (new) mới được tiếp nhận', { status: request.status });
    }
    const next = await onlineRepository.updateRequestStatus(id, { status: 'accepted' }, context.user.id, client);
    await writeAudit('online_request.accepted', 'yeu_cau_online', id, context, { old_data: request, new_data: next }, client);
    return next;
  });
  await notificationService.notifyEvent('online_request_accepted', {
    customer_name: updated.full_name,
    email: updated.email,
    phone: updated.phone,
    online_request_id: updated.id
  });
  return { request: updated };
}

async function rejectRequest(id, body, context) {
  const updated = await withTransaction(async (client) => {
    const request = await onlineRepository.findRequestById(id, client);
    if (!request) throw errors.notFound('Không tìm thấy yêu cầu online');
    if (request.status === 'converted') {
      throw errors.invalidState('Yêu cầu đã chuyển thành đơn, không thể từ chối', { status: request.status });
    }
    const next = await onlineRepository.updateRequestStatus(id, { status: 'rejected', note: body.note }, context.user.id, client);
    await writeAudit('online_request.rejected', 'yeu_cau_online', id, context, { old_data: request, new_data: next }, client);
    return next;
  });
  await notificationService.notifyEvent('online_request_rejected', {
    customer_name: updated.full_name,
    email: updated.email,
    phone: updated.phone,
    online_request_id: updated.id,
    note: body.note
  });
  return { request: updated };
}

// Convert an online request into a real order: find/create the customer, create the
// order (online intake_source) reusing the pricing-snapshot core, copy self-uploaded
// photos into the order's folder (new public_id to satisfy the unique index), and link
// any appointment. All atomic.
async function convertToOrder(id, body, context) {
  return withTransaction(async (client) => {
    const request = await onlineRepository.findRequestById(id, client);
    if (!request) throw errors.notFound('Không tìm thấy yêu cầu online');
    if (request.status === 'converted') {
      throw errors.invalidState('Yêu cầu đã được chuyển thành đơn', { status: request.status });
    }

    const cardTypeId = body.card_type_id || request.card_type_id;
    if (!cardTypeId) {
      throw errors.validation('Cần chọn loại thẻ để tạo đơn', { field: 'card_type_id' });
    }

    let customer = await customersRepository.findByPhone(request.phone, client);
    if (!customer) {
      customer = await customersRepository.create({
        full_name: request.full_name,
        phone: request.phone,
        email: request.email
      }, context.user.id, client);
    }

    const { order, pricing_snapshot: pricingSnapshot } = await orderService.createOrderCore({
      customer_id: customer.id,
      card_type_id: cardTypeId,
      quantity: body.quantity,
      pickup_date: body.pickup_date,
      notes: body.notes || request.note,
      intake_source: 'online',
      delivery_method: 'online'
    }, context, client);

    const requestPhotos = await onlineRepository.requestPhotos(id, client);
    for (const requestPhoto of requestPhotos) {
      const asset = await assetService.downloadBuffer(requestPhoto.cloudinary_original_public_id);
      const uploaded = await assetService.uploadBuffer(asset.buffer, {
        folder: `id-photo-management/orders/${order.id}/originals`,
        resource_type: 'image'
      });
      await photosRepository.create({
        order_id: order.id,
        cloudinary_original_public_id: uploaded.public_id,
        original_asset_metadata: {
          ...assetService.cloudinaryMetadata(uploaded),
          ...requestPhoto.original_asset_metadata,
          public_id: uploaded.public_id,
          secure_url: uploaded.secure_url,
          copied_from_online_request: id
        },
        width_px: requestPhoto.width_px,
        height_px: requestPhoto.height_px,
        file_size_bytes: requestPhoto.file_size_bytes
      }, client);
    }

    const appointment = await onlineRepository.findAppointmentByRequest(id, client);
    if (appointment) {
      await onlineRepository.linkAppointmentOrder(appointment.id, order.id, client);
    }

    const updatedRequest = await onlineRepository.linkConverted(id, { order_id: order.id, customer_id: customer.id }, client);
    await writeAudit('online_request.converted', 'yeu_cau_online', id, context, {
      old_data: request,
      new_data: { request: updatedRequest, order_id: order.id, customer_id: customer.id }
    }, client);

    return { request: updatedRequest, order, pricing_snapshot: pricingSnapshot, customer };
  });
}

async function listAppointments(query) {
  const pagination = parsePagination(query);
  const result = await onlineRepository.listAppointments(query, pagination);
  return {
    data: { appointments: result.rows.map(({ total, ...row }) => row), total: result.total },
    pagination: buildPagination(pagination.page, pagination.limit, result.total)
  };
}

async function createAppointment(body, context) {
  return withTransaction(async (client) => {
    const appointment = await onlineRepository.createAppointment({
      customer_name: body.customer_name,
      phone: body.phone,
      preferred_date: body.preferred_date,
      time_slot: body.time_slot,
      status: 'confirmed',
      note: body.note,
      confirmed_by: context.user.id
    }, client);
    await writeAudit('appointment.created', 'lich_hen',appointment.id, context, { new_data: appointment }, client);
    return { appointment };
  });
}

async function updateAppointmentStatus(id, body, context) {
  const updated = await withTransaction(async (client) => {
    const appointment = await onlineRepository.findAppointmentById(id, client);
    if (!appointment) throw errors.notFound('Không tìm thấy lịch hẹn');
    const next = await onlineRepository.updateAppointmentStatus(id, { status: body.status, note: body.note }, context.user.id, client);
    await writeAudit('appointment.status_changed', 'lich_hen',id, context, { old_data: appointment, new_data: next }, client);
    return next;
  });
  if (updated.status === 'confirmed') {
    await notificationService.notifyEvent('appointment_confirmed', {
      customer_name: updated.customer_name,
      phone: updated.phone,
      preferred_date: updated.preferred_date,
      time_slot: updated.time_slot
    });
  }
  return { appointment: updated };
}

// Public, customer-facing status lookup by request id + phone (no login).
async function onlineRequestStatus(requestId, phone) {
  const row = await onlineRepository.findPublicStatus(requestId, phone);
  if (!row) throw errors.notFound('Không tìm thấy yêu cầu. Vui lòng kiểm tra mã yêu cầu và số điện thoại.');
  return { data: { request: row } };
}

module.exports = {
  submitOnlineRequest,
  listInbox,
  getInboxItem,
  acceptRequest,
  rejectRequest,
  convertToOrder,
  listAppointments,
  createAppointment,
  updateAppointmentStatus,
  onlineRequestStatus
};
