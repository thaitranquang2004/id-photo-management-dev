const { withTransaction } = require('../db/pool');
const publicRepository = require('../repositories/public.repository');
const ordersRepository = require('../repositories/orders.repository');
const reprintRepository = require('../repositories/reprint.repository');
const layoutsRepository = require('../repositories/layouts.repository');
const catalogRepository = require('../repositories/catalog.repository');
const customersRepository = require('../repositories/customers.repository');
const { errors } = require('../utils/app-error');
const { sha256 } = require('../utils/hash');
const assetService = require('./asset.service');

function ipHash(req) {
  return sha256(req.ip || 'unknown');
}

async function resolvePublicOrder(input, client) {
  if (input.token) {
    return publicRepository.findOrderByTokenHash(sha256(input.token), client);
  }
  return ordersRepository.findByCodeAndPhone(input.ma_don, input.so_dien_thoai, client);
}

function publicOrderInfo(order) {
  return {
    id: order.id,
    ma_don: order.ma_don,
    ten_loai_the: order.ten_loai_the,
    trang_thai: order.trang_thai,
    ngay_tao: order.ngay_tao
  };
}

function signedOrNull(publicId, options) {
  try {
    return assetService.signedDownloadUrl(publicId, options);
  } catch (_error) {
    return { signed_url: null, expires_at: null };
  }
}

async function customerLookup(query, req) {
  return withTransaction(async (client) => {
    const order = await resolvePublicOrder(query, client);
    if (!order) {
      await publicRepository.logLookupEvent({
        action: 'lookup',
        result: 'not_found',
        phone: query.so_dien_thoai,
        order_code: query.ma_don,
        success: false,
        ip_hash: ipHash(req),
        user_agent: req.get('user-agent')
      }, client);
      throw errors.notFound('Không tìm thấy đơn hàng');
    }

    const photos = await publicRepository.approvedPhotos(order.id, client);
    const layouts = await publicRepository.generatedLayouts(order.id, client);
    // Bộ sưu tập: toàn bộ ảnh đã duyệt của khách qua mọi đơn (không chỉ đơn đang tra).
    const collectionPhotos = await customersRepository.approvedPhotos(order.khach_hang_id, client);

    await publicRepository.logLookupEvent({
      order_id: order.id,
      action: 'lookup',
      result: 'success',
      phone: query.so_dien_thoai,
      order_code: query.ma_don,
      success: true,
      ip_hash: ipHash(req),
      user_agent: req.get('user-agent')
    }, client);

    return {
      order_info: publicOrderInfo(order),
      photos: photos.map((photo) => {
        const publicId = photo.cloudinary_anh_xu_ly_id || photo.cloudinary_anh_goc_id;
        return {
          id: photo.id,
          trang_thai: photo.trang_thai,
          da_don_dep: Boolean(photo.ngay_don_dep),
          signed_url: photo.ngay_don_dep ? null : signedOrNull(publicId, { format: 'jpg' }).signed_url
        };
      }),
      print_layouts: layouts.map((layout) => ({
        id: layout.id,
        kieu_bo_cuc: layout.kieu_bo_cuc,
        kho_giay: layout.kho_giay,
        trang_thai: layout.trang_thai,
        da_don_dep: Boolean(layout.ngay_don_dep),
        signed_url: layout.ngay_don_dep ? null : signedOrNull(layout.cloudinary_id, {
          format: layout.metadata_file?.format || 'png',
          attachment: true
        }).signed_url
      })),
      collection: collectionPhotos.map((photo) => {
        const publicId = photo.cloudinary_anh_xu_ly_id || photo.cloudinary_anh_goc_id;
        return {
          id: photo.id,
          ma_don: photo.ma_don,
          ngay_tao: photo.ngay_tao,
          da_don_dep: Boolean(photo.ngay_don_dep),
          signed_url: photo.ngay_don_dep ? null : signedOrNull(publicId, { format: 'jpg' }).signed_url
        };
      })
    };
  });
}

async function photoDownloadUrl(photoId, body, req) {
  return withTransaction(async (client) => {
    const order = await resolvePublicOrder(body, client);
    if (!order) throw errors.notFound('Không tìm thấy đơn hàng');

    const photo = await publicRepository.approvedPhotoForPublic(photoId, order.id, client);
    if (!photo) {
      await publicRepository.logLookupEvent({
        order_id: order.id,
        photo_id: photoId,
        action: 'download',
        result: 'not_found',
        phone: body.so_dien_thoai,
        order_code: body.ma_don,
        success: false,
        ip_hash: ipHash(req),
        user_agent: req.get('user-agent')
      }, client);
      throw errors.notFound('Không tìm thấy ảnh approved');
    }
    if (photo.ngay_don_dep) {
      throw errors.invalidState('Ảnh đã hết hạn lưu trữ (quá 6 tháng), không thể tải.');
    }

    const publicId = photo.cloudinary_anh_xu_ly_id || photo.cloudinary_anh_goc_id;
    const signed = assetService.signedDownloadUrl(publicId, { format: 'jpg', attachment: true });
    await publicRepository.logLookupEvent({
      order_id: order.id,
      photo_id: photo.id,
      action: 'download',
      result: 'success',
      phone: body.so_dien_thoai,
      order_code: body.ma_don,
      success: true,
      ip_hash: ipHash(req),
      user_agent: req.get('user-agent')
    }, client);
    return signed;
  });
}

async function createReprintRequest(body, req) {
  return withTransaction(async (client) => {
    const order = await resolvePublicOrder(body, client);
    if (!order) throw errors.notFound('Không tìm thấy đơn hàng');

    if (body.danh_sach_anh_id.length > 0) {
      const approved = await publicRepository.approvedPhotos(order.id, client);
      const approvedIds = new Set(approved.map((photo) => photo.id));
      const invalid = body.danh_sach_anh_id.filter((id) => !approvedIds.has(id));
      if (invalid.length) {
        throw errors.validation('danh_sach_anh_id phải thuộc đơn và đã approved', { danh_sach_anh_id_khong_hop_le: invalid });
      }
    }

    if (body.bo_cuc_id) {
      const layout = await layoutsRepository.findById(body.bo_cuc_id, client);
      if (!layout || layout.don_hang_id !== order.id || layout.trang_thai !== 'generated') {
        throw errors.validation('bo_cuc_id không hợp lệ cho đơn này', { bo_cuc_id: body.bo_cuc_id });
      }
    }

    const request = await reprintRepository.create({
      ...body,
      don_hang_id: order.id,
      ip_hash: ipHash(req),
      user_agent: req.get('user-agent')
    }, client);

    await publicRepository.logLookupEvent({
      order_id: order.id,
      action: 'reprint_requested',
      result: 'success',
      phone: body.so_dien_thoai,
      order_code: body.ma_don,
      success: true,
      ip_hash: ipHash(req),
      user_agent: req.get('user-agent'),
      metadata: { request_id: request.id }
    }, client);

    return { ma_yeu_cau: request.id, trang_thai: request.trang_thai };
  });
}

// Trimmed, login-free catalog for the public booking page.
async function listPublicCardTypes() {
  const cardTypes = await catalogRepository.listCardTypes();
  return {
    card_types: cardTypes.map((cardType) => ({
      id: cardType.id,
      ten: cardType.ten,
      ma_viet_tat: cardType.ma_viet_tat,
      rong_mm: cardType.rong_mm,
      cao_mm: cardType.cao_mm,
      mau_nen: cardType.mau_nen,
      yeu_cau: cardType.yeu_cau,
      gia_moi_ban_hien_hanh: cardType.gia_moi_ban_hien_hanh ?? null
    }))
  };
}

module.exports = { customerLookup, photoDownloadUrl, createReprintRequest, listPublicCardTypes };
