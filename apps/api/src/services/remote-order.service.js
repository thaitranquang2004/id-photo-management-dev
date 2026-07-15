const crypto = require('node:crypto');
const { withTransaction } = require('../db/pool');
const catalogRepository = require('../repositories/catalog.repository');
const customersRepository = require('../repositories/customers.repository');
const photosRepository = require('../repositories/photos.repository');
const lichHenRepository = require('../repositories/lich-hen.repository');
const orderService = require('./order.service');
const assetService = require('./asset.service');
const notificationService = require('./notification.service');
const { errors } = require('../utils/app-error');
const sharp = require('sharp');

async function submit(body, files, req) {
  if (!files?.length) throw errors.validation('Cần gửi ít nhất một ảnh hợp lệ', { field: 'files' });
  const cardType = await catalogRepository.findCardType(body.loai_the_id);
  if (!cardType?.dang_hoat_dong) throw errors.validation('Loại ảnh không hợp lệ', { field: 'loai_the_id' });
  const orderId = crypto.randomUUID();
  const uploaded = [];
  try {
    for (const file of files) {
      try { await sharp(file.buffer).metadata(); } catch (_error) { throw errors.validation('Có ảnh không hợp lệ hoặc không đọc được', { file: file.originalname }); }
      const asset = await assetService.uploadBuffer(file.buffer, { folder: `id-photo-management/orders/${orderId}/originals`, resource_type: 'image' });
      uploaded.push({ asset, file });
    }
    const result = await withTransaction(async (client) => {
      let customer = await customersRepository.findByPhone(body.so_dien_thoai, client);
      if (!customer) customer = await customersRepository.create({ ho_ten: body.ho_ten, so_dien_thoai: body.so_dien_thoai, email: body.email }, null, client);
      const context = { user: { id: null }, ip: req.ip, userAgent: req.get('user-agent') };
      const created = await orderService.createOrderCore({ ...body, id: orderId, khach_hang_id: customer.id, nguon_don: 'gui_anh_tu_xa' }, context, client);
      for (const item of uploaded) await photosRepository.create({
        don_hang_id: created.order.id, cloudinary_anh_goc_id: item.asset.public_id,
        ten_file_goc: item.file.originalname, rong_px: item.asset.width, cao_px: item.asset.height, dung_luong_bytes: item.asset.bytes,
        metadata_anh_goc: { ...assetService.cloudinaryMetadata(item.asset), original_filename: item.file.originalname, mimetype: item.file.mimetype }
      }, client);
      let lich_hen = null;
      if (body.hinh_thuc_giao === 'hen_lay_hinh') lich_hen = await lichHenRepository.create({
        don_hang_id: created.order.id, ten_khach: customer.ho_ten, so_dien_thoai: customer.so_dien_thoai, email: customer.email,
        ngay_hen: body.ngay_hen_lay, khung_gio: body.khung_gio_lay, loai_lich: 'hen_lay_hinh', trang_thai: 'da_xac_nhan', ghi_chu: body.ghi_chu
      }, client);
      return { ...created, customer, lich_hen };
    });
    await notificationService.notifyEvent('don_gui_anh_da_nhan', { customer_name: result.customer.ho_ten, email: result.customer.email, phone: result.customer.so_dien_thoai, order_id: result.order.id, order_code: result.order.ma_don });
    return { order: result.order, pricing_snapshot: result.pricing_snapshot, lich_hen: result.lich_hen };
  } catch (error) {
    await Promise.allSettled(uploaded.map(({ asset }) => assetService.destroyAsset(asset.public_id)));
    throw error;
  }
}

module.exports = { submit };
