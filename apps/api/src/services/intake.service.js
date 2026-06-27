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
    yeu_cau_online_id: requestId,
    cloudinary_anh_goc_id: result.public_id,
    metadata_anh_goc: {
      ...assetService.cloudinaryMetadata(result),
      original_filename: file.originalname,
      mimetype: file.mimetype
    },
    rong_px: result.width,
    cao_px: result.height,
    dung_luong_bytes: result.bytes
  };
}

// Public, no-login. Creates an online request with optional self-uploaded photos
// and/or a lightweight appointment. Uploads happen before the transaction (matching
// the staff photo-upload flow) using a pre-generated request id for clean foldering.
async function submitOnlineRequest(body, files, req) {
  if (body.loai_the_id) {
    const cardType = await catalogRepository.findCardType(body.loai_the_id);
    if (!cardType || !cardType.dang_hoat_dong) {
      throw errors.validation('Loại ảnh không hợp lệ', { loai_the_id: body.loai_the_id });
    }
  }

  const requestId = crypto.randomUUID();
  const photoInputs = files?.length
    ? await Promise.all(files.map((file) => uploadRequestFile(file, requestId)))
    : [];

  const created = await withTransaction(async (client) => {
    const request = await onlineRepository.createRequest({
      id: requestId,
      ho_ten: body.ho_ten,
      so_dien_thoai: body.so_dien_thoai,
      email: body.email,
      loai_the_id: body.loai_the_id,
      loai_yeu_cau: body.loai_yeu_cau,
      ghi_chu: body.ghi_chu,
      ip_hash: ipHash(req),
      user_agent: req.get('user-agent'),
      metadata: {}
    }, client);

    for (const input of photoInputs) {
      await onlineRepository.addRequestPhoto(input, client);
    }

    let appointment = null;
    if (body.ngay_hen && body.khung_gio) {
      appointment = await onlineRepository.createAppointment({
        yeu_cau_online_id: requestId,
        ten_khach: body.ho_ten,
        so_dien_thoai: body.so_dien_thoai,
        ngay_hen: body.ngay_hen,
        khung_gio: body.khung_gio,
        trang_thai: 'requested',
        ghi_chu: body.ghi_chu
      }, client);
    }

    await publicRepository.logLookupEvent({
      action: 'online_request',
      result: 'success',
      phone: body.so_dien_thoai,
      success: true,
      ip_hash: ipHash(req),
      user_agent: req.get('user-agent'),
      metadata: {
        online_request_id: requestId,
        request_type: body.loai_yeu_cau,
        photo_count: photoInputs.length,
        has_appointment: Boolean(appointment)
      }
    }, client);

    return { ma_yeu_cau: request.id, trang_thai: request.trang_thai, so_anh: photoInputs.length };
  });

  // Fire-and-forget after commit so notification issues never break the submission.
  await notificationService.notifyEvent('online_request_received', {
    customer_name: body.ho_ten,
    email: body.email,
    phone: body.so_dien_thoai,
    online_request_id: created.ma_yeu_cau,
    metadata: { request_type: body.loai_yeu_cau }
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
    if (request.trang_thai !== 'new') {
      throw errors.invalidState('Chỉ yêu cầu mới (new) mới được tiếp nhận', { trang_thai: request.trang_thai });
    }
    const next = await onlineRepository.updateRequestStatus(id, { trang_thai: 'accepted' }, context.user.id, client);
    await writeAudit('online_request.accepted', 'yeu_cau_online', id, context, { old_data: request, new_data: next }, client);
    return next;
  });
  await notificationService.notifyEvent('online_request_accepted', {
    customer_name: updated.ho_ten,
    email: updated.email,
    phone: updated.so_dien_thoai,
    online_request_id: updated.id
  });
  return { request: updated };
}

async function rejectRequest(id, body, context) {
  const updated = await withTransaction(async (client) => {
    const request = await onlineRepository.findRequestById(id, client);
    if (!request) throw errors.notFound('Không tìm thấy yêu cầu online');
    if (request.trang_thai === 'converted') {
      throw errors.invalidState('Yêu cầu đã chuyển thành đơn, không thể từ chối', { trang_thai: request.trang_thai });
    }
    const next = await onlineRepository.updateRequestStatus(id, { trang_thai: 'rejected', ghi_chu: body.ghi_chu }, context.user.id, client);
    await writeAudit('online_request.rejected', 'yeu_cau_online', id, context, { old_data: request, new_data: next }, client);
    return next;
  });
  await notificationService.notifyEvent('online_request_rejected', {
    customer_name: updated.ho_ten,
    email: updated.email,
    phone: updated.so_dien_thoai,
    online_request_id: updated.id,
    note: body.ghi_chu
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
    if (request.trang_thai === 'converted') {
      throw errors.invalidState('Yêu cầu đã được chuyển thành đơn', { trang_thai: request.trang_thai });
    }

    const cardTypeId = body.loai_the_id || request.loai_the_id;
    if (!cardTypeId) {
      throw errors.validation('Cần chọn loại thẻ để tạo đơn', { field: 'loai_the_id' });
    }

    let customer = await customersRepository.findByPhone(request.so_dien_thoai, client);
    if (!customer) {
      customer = await customersRepository.create({
        ho_ten: request.ho_ten,
        so_dien_thoai: request.so_dien_thoai,
        email: request.email
      }, context.user.id, client);
    }

    const { order, pricing_snapshot: pricingSnapshot } = await orderService.createOrderCore({
      khach_hang_id: customer.id,
      loai_the_id: cardTypeId,
      so_luong: body.so_luong,
      ngay_hen_lay: body.ngay_hen_lay,
      ghi_chu: body.ghi_chu || request.ghi_chu,
      nguon_don: 'online',
      hinh_thuc_giao: 'online'
    }, context, client);

    const requestPhotos = await onlineRepository.requestPhotos(id, client);
    for (const requestPhoto of requestPhotos) {
      const asset = await assetService.downloadBuffer(requestPhoto.cloudinary_anh_goc_id);
      const uploaded = await assetService.uploadBuffer(asset.buffer, {
        folder: `id-photo-management/orders/${order.id}/originals`,
        resource_type: 'image'
      });
      await photosRepository.create({
        don_hang_id: order.id,
        cloudinary_anh_goc_id: uploaded.public_id,
        metadata_anh_goc: {
          ...assetService.cloudinaryMetadata(uploaded),
          ...requestPhoto.metadata_anh_goc,
          public_id: uploaded.public_id,
          secure_url: uploaded.secure_url,
          copied_from_online_request: id
        },
        rong_px: requestPhoto.rong_px,
        cao_px: requestPhoto.cao_px,
        dung_luong_bytes: requestPhoto.dung_luong_bytes
      }, client);
    }

    const appointment = await onlineRepository.findAppointmentByRequest(id, client);
    if (appointment) {
      await onlineRepository.linkAppointmentOrder(appointment.id, order.id, client);
    }

    const updatedRequest = await onlineRepository.linkConverted(id, { don_hang_id: order.id, khach_hang_id: customer.id }, client);
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
      ten_khach: body.ten_khach,
      so_dien_thoai: body.so_dien_thoai,
      ngay_hen: body.ngay_hen,
      khung_gio: body.khung_gio,
      trang_thai: 'confirmed',
      ghi_chu: body.ghi_chu,
      nguoi_xac_nhan: context.user.id
    }, client);
    await writeAudit('appointment.created', 'lich_hen',appointment.id, context, { new_data: appointment }, client);
    return { appointment };
  });
}

async function updateAppointmentStatus(id, body, context) {
  const updated = await withTransaction(async (client) => {
    const appointment = await onlineRepository.findAppointmentById(id, client);
    if (!appointment) throw errors.notFound('Không tìm thấy lịch hẹn');
    const next = await onlineRepository.updateAppointmentStatus(id, { trang_thai: body.trang_thai, ghi_chu: body.ghi_chu }, context.user.id, client);
    await writeAudit('appointment.status_changed', 'lich_hen',id, context, { old_data: appointment, new_data: next }, client);
    return next;
  });
  if (updated.trang_thai === 'confirmed') {
    await notificationService.notifyEvent('appointment_confirmed', {
      customer_name: updated.ten_khach,
      phone: updated.so_dien_thoai,
      preferred_date: updated.ngay_hen,
      time_slot: updated.khung_gio
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
