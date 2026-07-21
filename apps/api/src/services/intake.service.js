const crypto = require('node:crypto');
const { withTransaction } = require('../db/pool');
const onlineRepository = require('../repositories/online.repository');
const customersRepository = require('../repositories/customers.repository');
const catalogRepository = require('../repositories/catalog.repository');
const photosRepository = require('../repositories/photos.repository');
const orderService = require('./order.service');
const assetService = require('./asset.service');
const notificationService = require('./notification.service');
const { checkPhotoQualityForCardType } = require('./public.service');
const { writeAudit } = require('./audit.service');
const { parsePagination, buildPagination } = require('../utils/pagination');
const { errors } = require('../utils/app-error');
const { ipHash } = require('../utils/hash');

const MIN_ONLINE_REQUEST_QC_SCORE = 60;

function assertMinimumOnlineRequestQcScore(qc, filename) {
  const score = Number(qc?.diem_chat_luong);
  if (Number.isFinite(score) && score >= MIN_ONLINE_REQUEST_QC_SCORE) return;
  throw errors.validation(`Ảnh ${filename || ''} cần đạt tối thiểu ${MIN_ONLINE_REQUEST_QC_SCORE} điểm QC trước khi gửi`.trim(), {
    field: 'files',
    filename,
    diem_chat_luong: Number.isFinite(score) ? score : null,
    diem_toi_thieu: MIN_ONLINE_REQUEST_QC_SCORE,
    loi_chat_luong: qc?.loi_chat_luong || []
  });
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
  if (!files?.length) throw errors.validation('Cần gửi ít nhất một ảnh hợp lệ', { field: 'files' });
  const cardType = await catalogRepository.findCardType(body.loai_the_id);
  if (!cardType || !cardType.dang_hoat_dong) {
    throw errors.validation('Loại ảnh không hợp lệ', { loai_the_id: body.loai_the_id });
  }

  const requestId = crypto.randomUUID();
  const photoInputs = [];
  try {
    for (const file of files) {
      const qc = await checkPhotoQualityForCardType(file, cardType);
      assertMinimumOnlineRequestQcScore(qc, file.originalname);
      photoInputs.push(await uploadRequestFile(file, requestId));
    }
  } catch (error) {
    await Promise.allSettled(photoInputs.map((input) => assetService.destroyAsset(input.cloudinary_anh_goc_id)));
    throw error;
  }

  let created;
  try {
    created = await withTransaction(async (client) => {
      const request = await onlineRepository.createRequest({
        id: requestId,
        ho_ten: body.ho_ten,
        so_dien_thoai: body.so_dien_thoai,
        email: body.email,
        loai_the_id: body.loai_the_id,
        loai_yeu_cau: 'upload',
        hinh_thuc_giao: body.hinh_thuc_giao,
        so_luong: body.hinh_thuc_giao === 'lay_file_truc_tuyen' ? 1 : body.so_luong,
        ngay_hen_lay: body.hinh_thuc_giao === 'hen_lay_hinh' ? body.ngay_hen_lay : null,
        khung_gio_lay: body.hinh_thuc_giao === 'hen_lay_hinh' ? body.khung_gio_lay : null,
        ghi_chu: body.ghi_chu,
        ip_hash: ipHash(req),
        user_agent: req.get('user-agent'),
        metadata: { qc_minimum_score: MIN_ONLINE_REQUEST_QC_SCORE }
      }, client);

      for (const input of photoInputs) {
        await onlineRepository.addRequestPhoto(input, client);
      }

      const result = { ma_yeu_cau: request.id, trang_thai: request.trang_thai, so_anh: photoInputs.length };
      const notifications = await notificationService.enqueueEvent('online_request_received', {
        customer_name: body.ho_ten,
        email: body.email,
        phone: body.so_dien_thoai,
        online_request_id: result.ma_yeu_cau,
        metadata: { request_type: 'upload' }
      }, client);
      return { ...result, notifications };
    });
  } catch (error) {
    await Promise.allSettled(photoInputs.map((input) => assetService.destroyAsset(input.cloudinary_anh_goc_id)));
    throw error;
  }

  await notificationService.dispatchRows(created.notifications);

  const { notifications, ...response } = created;
  return response;
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
    if (request.trang_thai !== 'moi') {
      throw errors.invalidState('Chỉ yêu cầu mới mới được tiếp nhận', { trang_thai: request.trang_thai });
    }
    const next = await onlineRepository.updateRequestStatus(id, { trang_thai: 'da_tiep_nhan' }, context.user.id, client);
    await writeAudit('online_request.accepted', 'yeu_cau_online', id, context, { old_data: request, new_data: next }, client);
    const notifications = await notificationService.enqueueEvent('online_request_accepted', {
      customer_name: next.ho_ten,
      email: next.email,
      phone: next.so_dien_thoai,
      online_request_id: next.id
    }, client);
    return { request: next, notifications };
  });
  await notificationService.dispatchRows(updated.notifications);
  return { request: updated.request };
}

async function rejectRequest(id, body, context) {
  const updated = await withTransaction(async (client) => {
    const request = await onlineRepository.findRequestById(id, client);
    if (!request) throw errors.notFound('Không tìm thấy yêu cầu online');
    if (request.trang_thai === 'da_tao_don') {
      throw errors.invalidState('Yêu cầu đã chuyển thành đơn, không thể từ chối', { trang_thai: request.trang_thai });
    }
    const next = await onlineRepository.updateRequestStatus(id, { trang_thai: 'tu_choi', ghi_chu: body.ghi_chu }, context.user.id, client);
    await writeAudit('online_request.rejected', 'yeu_cau_online', id, context, { old_data: request, new_data: next }, client);
    const notifications = await notificationService.enqueueEvent('online_request_rejected', {
      customer_name: next.ho_ten,
      email: next.email,
      phone: next.so_dien_thoai,
      online_request_id: next.id,
      note: body.ghi_chu
    }, client);
    return { request: next, notifications };
  });
  await notificationService.dispatchRows(updated.notifications);
  return { request: updated.request };
}

// Convert an online request into a real order: find/create the customer, create the
// order (online intake_source) reusing the pricing-snapshot core, copy self-uploaded
// photos into the order's folder (new public_id to satisfy the unique index), and link
// any appointment. All atomic.
async function convertToOrder(id, body, context) {
  return withTransaction(async (client) => {
    const request = await onlineRepository.findRequestById(id, client);
    if (!request) throw errors.notFound('Không tìm thấy yêu cầu online');
    if (request.trang_thai === 'da_tao_don') {
      throw errors.invalidState('Yêu cầu đã được chuyển thành đơn', { trang_thai: request.trang_thai });
    }
    if (request.trang_thai !== 'da_tiep_nhan') {
      throw errors.invalidState('Cần tiếp nhận yêu cầu trước khi tạo đơn', { trang_thai: request.trang_thai });
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

    const deliveryMethod = body.hinh_thuc_giao || request.hinh_thuc_giao || 'lay_file_truc_tuyen';
    const quantity = deliveryMethod === 'lay_file_truc_tuyen'
      ? 1
      : (body.so_luong ?? request.so_luong);

    // Lịch hẹn cũ (trước migration) hoặc lựa chọn lưu trực tiếp trên yêu cầu.
    const wishAppointment = await onlineRepository.findAppointmentByRequest(id, client);
    const pickupDate = body.ngay_hen_lay || request.ngay_hen_lay || wishAppointment?.ngay_hen || null;
    const pickupSlot = body.khung_gio_lay || request.khung_gio_lay || wishAppointment?.khung_gio || null;
    if (deliveryMethod === 'hen_lay_hinh' && (!pickupDate || !pickupSlot || Number(quantity) < 4)) {
      throw errors.validation('Hẹn lấy hình cần số lượng tối thiểu 4, ngày và khung giờ lấy');
    }

    const { order, pricing_snapshot: pricingSnapshot } = await orderService.createOrderCore({
      khach_hang_id: customer.id,
      loai_the_id: cardTypeId,
      so_luong: quantity,
      ngay_hen_lay: deliveryMethod === 'hen_lay_hinh' ? pickupDate : undefined,
      ghi_chu: body.ghi_chu || request.ghi_chu,
      nguon_don: 'gui_anh_tu_xa',
      hinh_thuc_giao: deliveryMethod
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

    // Tạo/gắn lịch hẹn LẤY cho đơn khi có ngày lấy.
    if (deliveryMethod === 'hen_lay_hinh' && wishAppointment) {
      await onlineRepository.linkAppointmentOrder(wishAppointment.id, {
        don_hang_id: order.id,
        ngay_hen: pickupDate,
        khung_gio: pickupSlot
      }, client);
    } else if (deliveryMethod === 'hen_lay_hinh') {
      await onlineRepository.createAppointment({
        don_hang_id: order.id,
        ten_khach: request.ho_ten,
        so_dien_thoai: request.so_dien_thoai,
        ngay_hen: pickupDate,
        khung_gio: pickupSlot,
        loai_lich: 'hen_lay_hinh',
        trang_thai: 'da_xac_nhan',
        nguoi_xac_nhan: context.user.id
      }, client);
    }

    const updatedRequest = await onlineRepository.linkConverted(id, { don_hang_id: order.id, khach_hang_id: customer.id }, client);
    await writeAudit('online_request.converted', 'yeu_cau_online', id, context, {
      old_data: request,
      new_data: { request: updatedRequest, order_id: order.id, customer_id: customer.id }
    }, client);

    return { request: updatedRequest, order, pricing_snapshot: pricingSnapshot, customer };
  });
}

// Public, customer-facing status lookup by phone (no login).
// Trả về tất cả yêu cầu/đơn/lịch mà khách đã tạo từ các luồng công khai.
async function onlineRequestStatus(phone) {
  const requests = await onlineRepository.listPublicStatus(phone);
  if (!requests.length) throw errors.notFound('Không tìm thấy yêu cầu, lịch chụp hoặc đơn gửi ảnh nào khớp số điện thoại. Vui lòng kiểm tra lại.');
  return { data: { requests } };
}

module.exports = {
  submitOnlineRequest,
  assertMinimumOnlineRequestQcScore,
  MIN_ONLINE_REQUEST_QC_SCORE,
  listInbox,
  getInboxItem,
  acceptRequest,
  rejectRequest,
  convertToOrder,
  onlineRequestStatus
};
