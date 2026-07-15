const { withTransaction } = require('../db/pool');
const publicRepository = require('../repositories/public.repository');
const ordersRepository = require('../repositories/orders.repository');
const reprintRepository = require('../repositories/reprint.repository');
const catalogRepository = require('../repositories/catalog.repository');
const customersRepository = require('../repositories/customers.repository');
const { errors } = require('../utils/app-error');
const { ipHash } = require('../utils/hash');
const assetService = require('./asset.service');
const sharp = require('sharp');
const googleAiService = require('./google-ai.service');
const { computeQc } = require('./photo-qc');

async function resolvePublicOrder(input, client) {
  return ordersRepository.findByCodeAndPhone(input.ma_don, input.so_dien_thoai, client);
}

function publicOrderInfo(order) {
  const co_the_tai_file = order.hinh_thuc_giao === 'lay_file_truc_tuyen'
    && order.trang_thai === 'delivered'
    && Number(order.da_thanh_toan || 0) >= Number(order.tong_tien || 0);
  return {
    id: order.id,
    ma_don: order.ma_don,
    ten_loai_the: order.ten_loai_the,
    trang_thai: order.trang_thai,
    ngay_tao: order.ngay_tao,
    hinh_thuc_giao: order.hinh_thuc_giao,
    co_the_tai_file
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
      throw errors.notFound('Không tìm thấy đơn hàng');
    }

    const canDownload = order.hinh_thuc_giao === 'lay_file_truc_tuyen'
      && order.trang_thai === 'delivered' && Number(order.da_thanh_toan || 0) >= Number(order.tong_tien || 0);
    const photos = await publicRepository.approvedPhotos(order.id, client);
    // Bộ sưu tập: toàn bộ ảnh đã duyệt của khách qua mọi đơn (không chỉ đơn đang tra).
    const collectionPhotos = await customersRepository.approvedPhotos(order.khach_hang_id, client);

    return {
      order_info: publicOrderInfo(order),
      photos: photos.map((photo) => {
        const publicId = photo.cloudinary_anh_xu_ly_id || photo.cloudinary_anh_goc_id;
        return {
          id: photo.id,
          trang_thai: photo.trang_thai,
          da_don_dep: Boolean(photo.ngay_don_dep),
          signed_url: canDownload && !photo.ngay_don_dep ? signedOrNull(publicId, { format: 'jpg' }).signed_url : null
        };
      }),
      collection: collectionPhotos.map((photo) => {
        const publicId = photo.cloudinary_anh_xu_ly_id || photo.cloudinary_anh_goc_id;
        return {
          id: photo.id,
          ma_don: photo.ma_don,
          ngay_tao: photo.ngay_tao,
          da_don_dep: Boolean(photo.ngay_don_dep),
          signed_url: canDownload && !photo.ngay_don_dep ? signedOrNull(publicId, { format: 'jpg' }).signed_url : null
        };
      })
    };
  });
}

async function photoDownloadUrl(photoId, body, req) {
  return withTransaction(async (client) => {
    const order = await resolvePublicOrder(body, client);
    if (!order) throw errors.notFound('Không tìm thấy đơn hàng');
    if (order.hinh_thuc_giao !== 'lay_file_truc_tuyen' || order.trang_thai !== 'delivered'
      || Number(order.da_thanh_toan || 0) < Number(order.tong_tien || 0)) {
      throw errors.invalidState('Đơn chưa đủ điều kiện tải file trực tuyến');
    }

    const photo = await publicRepository.approvedPhotoForPublic(photoId, order.id, client);
    if (!photo) {
      throw errors.notFound('Không tìm thấy ảnh approved');
    }
    if (photo.ngay_don_dep) {
      throw errors.invalidState('Ảnh đã hết hạn lưu trữ (quá 6 tháng), không thể tải.');
    }

    const publicId = photo.cloudinary_anh_xu_ly_id || photo.cloudinary_anh_goc_id;
    return assetService.signedDownloadUrl(publicId, { format: 'jpg', attachment: true });
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

    const request = await reprintRepository.create({
      ...body,
      don_hang_id: order.id,
      ip_hash: ipHash(req),
      user_agent: req.get('user-agent')
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

// Kiểm tra chất lượng ảnh khách gửi (trang đặt lịch) MÀ KHÔNG lưu trữ:
// phân tích ngay trên buffer trong RAM, trả về feedback đủ/chưa đủ chuẩn ảnh thẻ.
// Không upload Cloudinary, không ghi DB. AI (Gemini) là tuỳ chọn — thiếu key thì
// vẫn trả kết quả kiểm tra tất định (độ phân giải/tỉ lệ).
async function checkPhotoQuality(file, loaiTheId) {
  if (!file) throw errors.validation('Thiếu ảnh cần kiểm tra', { field: 'file' });

  const cardType = await catalogRepository.findCardType(loaiTheId);
  if (!cardType || cardType.dang_hoat_dong === false) {
    throw errors.notFound('Loại ảnh không tồn tại hoặc đã ngừng áp dụng', { field: 'loai_the_id' });
  }

  let sourceWidthPx = null;
  let sourceHeightPx = null;
  try {
    const meta = await sharp(file.buffer).rotate().metadata();
    sourceWidthPx = meta.width || null;
    sourceHeightPx = meta.height || null;
  } catch (error) {
    throw errors.validation('Không đọc được ảnh. Vui lòng thử ảnh JPEG/PNG khác.', { field: 'file' });
  }

  const aiFindings = await googleAiService.assessQuality({
    imageBuffer: file.buffer,
    mimeType: file.mimetype,
    cardType
  });

  const qc = computeQc({ sourceWidthPx, sourceHeightPx, cardType, aiFindings });
  return { ...qc, ai_available: Boolean(aiFindings) };
}

module.exports = { customerLookup, photoDownloadUrl, createReprintRequest, listPublicCardTypes, checkPhotoQuality };
