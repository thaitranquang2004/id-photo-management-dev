const { withTransaction } = require('../db/pool');
const publicRepository = require('../repositories/public.repository');
const ordersRepository = require('../repositories/orders.repository');
const reprintRepository = require('../repositories/reprint.repository');
const layoutsRepository = require('../repositories/layouts.repository');
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
          signed_url: signedOrNull(publicId, { format: 'jpg' }).signed_url
        };
      }),
      print_layouts: layouts.map((layout) => ({
        id: layout.id,
        layout_type: layout.layout_type,
        paper_size: layout.paper_size,
        status: layout.status,
        signed_url: signedOrNull(layout.cloudinary_public_id, {
          format: layout.layout_asset_metadata?.format || 'png',
          attachment: true
        }).signed_url
      }))
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

module.exports = { customerLookup, photoDownloadUrl, createReprintRequest };
