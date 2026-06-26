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
  return ordersRepository.findByCodeAndPhone(input.order_code, input.phone, client);
}

function publicOrderInfo(order) {
  return {
    id: order.id,
    order_code: order.order_code,
    card_type_name: order.card_type_name,
    status: order.status,
    created_at: order.created_at
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
        phone: query.phone,
        order_code: query.order_code,
        success: false,
        ip_hash: ipHash(req),
        user_agent: req.get('user-agent')
      }, client);
      throw errors.notFound('Không tìm thấy đơn hàng');
    }

    const photos = await publicRepository.approvedPhotos(order.id, client);
    const layouts = await publicRepository.generatedLayouts(order.id, client);
    // Bộ sưu tập: toàn bộ ảnh đã duyệt của khách qua mọi đơn (không chỉ đơn đang tra).
    const collectionPhotos = await customersRepository.approvedPhotos(order.customer_id, client);

    await publicRepository.logLookupEvent({
      order_id: order.id,
      action: 'lookup',
      result: 'success',
      phone: query.phone,
      order_code: query.order_code,
      success: true,
      ip_hash: ipHash(req),
      user_agent: req.get('user-agent')
    }, client);

    return {
      order_info: publicOrderInfo(order),
      photos: photos.map((photo) => {
        const publicId = photo.cloudinary_processed_public_id || photo.cloudinary_original_public_id;
        return {
          id: photo.id,
          status: photo.status,
          purged: Boolean(photo.purged_at),
          signed_url: photo.purged_at ? null : signedOrNull(publicId, { format: 'jpg' }).signed_url
        };
      }),
      print_layouts: layouts.map((layout) => ({
        id: layout.id,
        layout_type: layout.kieu_bo_cuc,
        paper_size: layout.kho_giay,
        status: layout.trang_thai,
        purged: Boolean(layout.ngay_don_dep),
        signed_url: layout.ngay_don_dep ? null : signedOrNull(layout.cloudinary_id, {
          format: layout.metadata_file?.format || 'png',
          attachment: true
        }).signed_url
      })),
      collection: collectionPhotos.map((photo) => {
        const publicId = photo.cloudinary_processed_public_id || photo.cloudinary_original_public_id;
        return {
          id: photo.id,
          order_code: photo.order_code,
          created_at: photo.created_at,
          purged: Boolean(photo.purged_at),
          signed_url: photo.purged_at ? null : signedOrNull(publicId, { format: 'jpg' }).signed_url
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
        phone: body.phone,
        order_code: body.order_code,
        success: false,
        ip_hash: ipHash(req),
        user_agent: req.get('user-agent')
      }, client);
      throw errors.notFound('Không tìm thấy ảnh approved');
    }
    if (photo.purged_at) {
      throw errors.invalidState('Ảnh đã hết hạn lưu trữ (quá 6 tháng), không thể tải.');
    }

    const publicId = photo.cloudinary_processed_public_id || photo.cloudinary_original_public_id;
    const signed = assetService.signedDownloadUrl(publicId, { format: 'jpg', attachment: true });
    await publicRepository.logLookupEvent({
      order_id: order.id,
      photo_id: photo.id,
      action: 'download',
      result: 'success',
      phone: body.phone,
      order_code: body.order_code,
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

    if (body.photo_ids.length > 0) {
      const approved = await publicRepository.approvedPhotos(order.id, client);
      const approvedIds = new Set(approved.map((photo) => photo.id));
      const invalid = body.photo_ids.filter((id) => !approvedIds.has(id));
      if (invalid.length) {
        throw errors.validation('photo_ids phải thuộc đơn và đã approved', { invalid_photo_ids: invalid });
      }
    }

    if (body.layout_id) {
      const layout = await layoutsRepository.findById(body.layout_id, client);
      if (!layout || layout.order_id !== order.id || layout.status !== 'generated') {
        throw errors.validation('layout_id không hợp lệ cho đơn này', { layout_id: body.layout_id });
      }
    }

    const request = await reprintRepository.create({
      ...body,
      order_id: order.id,
      ip_hash: ipHash(req),
      user_agent: req.get('user-agent')
    }, client);

    await publicRepository.logLookupEvent({
      order_id: order.id,
      action: 'reprint_requested',
      result: 'success',
      phone: body.phone,
      order_code: body.order_code,
      success: true,
      ip_hash: ipHash(req),
      user_agent: req.get('user-agent'),
      metadata: { request_id: request.id }
    }, client);

    return { request_id: request.id, status: request.status };
  });
}

// Trimmed, login-free catalog for the public booking page.
async function listPublicCardTypes() {
  const cardTypes = await catalogRepository.listCardTypes();
  return {
    card_types: cardTypes.map((cardType) => ({
      id: cardType.id,
      name: cardType.name,
      short_code: cardType.short_code,
      width_mm: cardType.width_mm,
      height_mm: cardType.height_mm,
      background_color: cardType.background_color,
      requirements: cardType.requirements,
      current_price_per_copy: cardType.current_price_per_copy ?? null
    }))
  };
}

module.exports = { customerLookup, photoDownloadUrl, createReprintRequest, listPublicCardTypes };
