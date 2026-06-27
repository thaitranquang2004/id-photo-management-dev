const { withTransaction } = require('../db/pool');
const crypto = require('node:crypto');
const sharp = require('sharp');
const layoutsRepository = require('../repositories/layouts.repository');
const photosRepository = require('../repositories/photos.repository');
const ordersRepository = require('../repositories/orders.repository');
const catalogRepository = require('../repositories/catalog.repository');
const { errors } = require('../utils/app-error');
const { writeAudit } = require('./audit.service');
const assetService = require('./asset.service');

const PAPER_SIZES_MM = {
  A4: { width: 210, height: 297 },
  '10x15': { width: 100, height: 150 },
  '13x18': { width: 130, height: 180 }
};

function mmToPx(mm, dpi) {
  return Math.max(1, Math.round((Number(mm) / 25.4) * dpi));
}

function paperSize(body) {
  const configured = body.layout_config || {};
  if (configured.paper_width_mm && configured.paper_height_mm) {
    return {
      width: Number(configured.paper_width_mm),
      height: Number(configured.paper_height_mm)
    };
  }
  return PAPER_SIZES_MM[body.paper_size] || PAPER_SIZES_MM.A4;
}

function photoSize(body, cardType) {
  const configured = body.layout_config || {};
  return {
    width: Number(configured.photo_width_mm || cardType.rong_mm),
    height: Number(configured.photo_height_mm || cardType.cao_mm)
  };
}

async function loadPrintablePhoto(photo) {
  const publicId = photo.cloudinary_anh_xu_ly_id || photo.cloudinary_anh_goc_id;
  const asset = await assetService.downloadBuffer(publicId);
  return sharp(asset.buffer).rotate().toBuffer();
}

async function renderLayoutBuffer(body, order, cardType, photos) {
  const dpi = Number(body.dpi || body.layout_config?.dpi || 300);
  const paper = paperSize(body);
  const card = photoSize(body, cardType);
  const marginMm = Number(body.layout_config?.margin_mm ?? 5);
  const gapMm = Number(body.layout_config?.gap_mm ?? 2);

  const paperWidthPx = mmToPx(paper.width, dpi);
  const paperHeightPx = mmToPx(paper.height, dpi);
  const photoWidthPx = mmToPx(card.width, dpi);
  const photoHeightPx = mmToPx(card.height, dpi);
  const marginPx = mmToPx(marginMm, dpi);
  const gapPx = mmToPx(gapMm, dpi);
  const labelHeightPx = body.add_text ? mmToPx(5, dpi) : 0;
  const itemHeightPx = photoHeightPx + labelHeightPx;
  const columns = Math.max(1, Math.floor((paperWidthPx - marginPx * 2 + gapPx) / (photoWidthPx + gapPx)));
  const rows = Math.max(1, Math.floor((paperHeightPx - marginPx * 2 + gapPx) / (itemHeightPx + gapPx)));
  const capacity = columns * rows;

  if (photos.length > capacity) {
    throw errors.validation('Số ảnh vượt quá sức chứa layout', { capacity, requested: photos.length });
  }

  const composites = [];
  for (let index = 0; index < photos.length; index += 1) {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const left = marginPx + column * (photoWidthPx + gapPx);
    const top = marginPx + row * (itemHeightPx + gapPx);
    const photoBuffer = await loadPrintablePhoto(photos[index]);
    const resized = await sharp(photoBuffer)
      .resize(photoWidthPx, photoHeightPx, { fit: 'cover', position: 'attention' })
      .jpeg({ quality: 94, mozjpeg: true })
      .toBuffer();
    composites.push({ input: resized, left, top });

    if (body.add_text) {
      const labelSvg = Buffer.from(`
        <svg width="${photoWidthPx}" height="${labelHeightPx}" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="white"/>
          <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle"
            font-family="Arial, sans-serif" font-size="${Math.max(12, Math.round(labelHeightPx * 0.42))}" fill="#111">
            ${order.order_code}
          </text>
        </svg>
      `);
      composites.push({ input: labelSvg, left, top: top + photoHeightPx });
    }
  }

  const buffer = await sharp({
    create: {
      width: paperWidthPx,
      height: paperHeightPx,
      channels: 3,
      background: '#FFFFFF'
    }
  })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toBuffer();

  return {
    buffer,
    metadata: {
      dpi,
      paper_width_mm: paper.width,
      paper_height_mm: paper.height,
      paper_width_px: paperWidthPx,
      paper_height_px: paperHeightPx,
      photo_width_mm: card.width,
      photo_height_mm: card.height,
      photo_width_px: photoWidthPx,
      photo_height_px: photoHeightPx,
      columns,
      rows,
      format: 'png'
    }
  };
}

async function validatedLayoutInputs(body, client) {
  const order = await ordersRepository.findById(body.order_id, client);
  if (!order) throw errors.notFound('Không tìm thấy đơn hàng');
  const cardType = await catalogRepository.findCardType(order.card_type_id, client);
  const photos = await photosRepository.findManyByIds(body.photo_ids, client);
  if (photos.length !== body.photo_ids.length || photos.some((photo) => photo.don_hang_id !== body.order_id || photo.trang_thai !== 'approved')) {
    throw errors.validation('Layout chỉ được dùng ảnh approved thuộc cùng order', { order_id: body.order_id });
  }
  return { order, cardType, photos };
}

async function validateConfig(body) {
  const photos = await photosRepository.findManyByIds(body.photo_ids);
  const invalid = photos.filter((photo) => photo.don_hang_id !== body.order_id || photo.trang_thai !== 'approved');
  return {
    valid: photos.length === body.photo_ids.length && invalid.length === 0,
    warnings: invalid.length ? ['Chỉ ảnh approved thuộc cùng order mới được dùng cho layout'] : []
  };
}

async function preview(body) {
  const { order, cardType, photos } = await validatedLayoutInputs(body);
  const rendered = await renderLayoutBuffer(body, order, cardType, photos);
  const upload = await assetService.uploadBuffer(rendered.buffer, {
    folder: `id-photo-management/orders/${order.id}/layout-previews`,
    public_id: crypto.randomUUID(),
    resource_type: 'image',
    format: 'png'
  });
  const signed = assetService.signedDownloadUrl(upload.public_id, { format: 'png' });
  return {
    preview_signed_url: signed.signed_url,
    expires_at: signed.expires_at,
    cloudinary_public_id: upload.public_id,
    layout_config: {
      ...body.layout_config,
      renderer: rendered.metadata
    }
  };
}

async function generateLayout(body, context) {
  return withTransaction(async (client) => {
    const order = await ordersRepository.findByIdForUpdate(body.order_id, client);
    if (!order) throw errors.notFound('Không tìm thấy đơn hàng');

    const cardType = await catalogRepository.findCardType(order.card_type_id, client);
    const photos = await photosRepository.findManyByIds(body.photo_ids, client);
    if (photos.length !== body.photo_ids.length || photos.some((photo) => photo.don_hang_id !== body.order_id || photo.trang_thai !== 'approved')) {
      throw errors.validation('Layout chỉ được dùng ảnh approved thuộc cùng order', { order_id: body.order_id });
    }

    let layoutBody = body;
    if (!body.cloudinary_public_id) {
      const rendered = await renderLayoutBuffer(body, order, cardType, photos);
      const upload = await assetService.uploadBuffer(rendered.buffer, {
        folder: `id-photo-management/orders/${order.id}/layouts`,
        public_id: crypto.randomUUID(),
        resource_type: 'image',
        format: 'png'
      });
      layoutBody = {
        ...body,
        cloudinary_public_id: upload.public_id,
        layout_asset_metadata: {
          ...assetService.cloudinaryMetadata(upload),
          ...rendered.metadata
        },
        file_size_bytes: upload.bytes,
        metadata: {
          renderer: 'sharp-grid',
          source: 'api'
        }
      };
    }

    const printLayout = await layoutsRepository.createLayout(layoutBody, context.user.id, client);
    const items = await layoutsRepository.createItems(printLayout.id, body.photo_ids, client);
    await writeAudit('layout.created', 'bo_cuc_in', printLayout.id, context, { new_data: { print_layout: printLayout, items } }, client);

    let updatedOrder = order;
    if (order.status === 'processing') {
      updatedOrder = await ordersRepository.updateStatus(order.id, 'completed', {}, client);
      await writeAudit('order.status_changed', 'don_hang', order.id, context, { old_data: order, new_data: updatedOrder }, client);
    }

    return { print_layout: printLayout, items, order: updatedOrder };
  });
}

async function getLayout(id) {
  const layout = await layoutsRepository.getWithItems(id);
  if (!layout) throw errors.notFound('Không tìm thấy layout');
  return layout;
}

async function downloadUrl(id) {
  const layout = await layoutsRepository.findById(id);
  if (!layout) throw errors.notFound('Không tìm thấy layout');
  if (layout.trang_thai !== 'generated') {
    throw errors.invalidState('Chỉ layout generated mới có URL tải', { status: layout.trang_thai });
  }
  const signed = assetService.signedDownloadUrl(layout.cloudinary_id, {
    format: layout.metadata_file?.format || 'png',
    resource_type: 'image',
    attachment: true
  });
  return { layout_signed_url: signed.signed_url, expires_at: signed.expires_at };
}

async function reprint(id) {
  return downloadUrl(id);
}

async function reportIssue(id, body, context) {
  return withTransaction(async (client) => {
    const layout = await layoutsRepository.findById(id, client);
    if (!layout) throw errors.notFound('Không tìm thấy layout');
    const issue = await layoutsRepository.createIssue(id, body, context.user.id, client);
    const printLayout = await layoutsRepository.markNeedsFix(id, client);
    await writeAudit('layout.issue_reported', 'loi_bo_cuc', issue.id, context, {
      old_data: layout,
      new_data: { issue, print_layout: printLayout }
    }, client);
    return { issue, print_layout: printLayout };
  });
}

module.exports = {
  validateConfig,
  preview,
  generateLayout,
  getLayout,
  downloadUrl,
  reprint,
  reportIssue
};
