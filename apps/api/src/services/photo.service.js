const { withTransaction } = require('../db/pool');
const sharp = require('sharp');
const photosRepository = require('../repositories/photos.repository');
const ordersRepository = require('../repositories/orders.repository');
const catalogRepository = require('../repositories/catalog.repository');
const { errors } = require('../utils/app-error');
const { writeAudit } = require('./audit.service');
const assetService = require('./asset.service');
const googleAiService = require('./google-ai.service');
const { DEFAULT_DPI, mmToPx, computeQc } = require('./photo-qc');

// The AI step recomposes to a standard head-and-shoulders ID portrait at the card
// ratio. Here we only fit to the exact card dimensions, padding with the uniform card
// background color so any small ratio mismatch is invisible. `contain` never cuts the head.
async function normalizeIdPhoto(buffer, cardType) {
  const width = mmToPx(cardType.rong_mm);
  const height = mmToPx(cardType.cao_mm);
  const background = cardType.mau_nen || '#FFFFFF';
  return sharp(buffer)
    .rotate()
    .resize(width, height, { fit: 'contain', position: 'centre', background })
    .flatten({ background })
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
}

async function uploadOriginalFile(file, orderId) {
  const result = await assetService.uploadBuffer(file.buffer, {
    folder: `id-photo-management/orders/${orderId}/originals`,
    resource_type: 'image'
  });

  return {
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

async function createPhotos(body, files, context) {
  if (!files?.length && !body.cloudinary_anh_goc_id) {
    throw errors.validation('Cần cloudinary_original_public_id để tạo record ảnh');
  }

  const order = await ordersRepository.findById(body.don_hang_id);
  if (!order) throw errors.notFound('Không tìm thấy đơn hàng');

  const photoInputs = files?.length
    ? await Promise.all(files.map((file) => uploadOriginalFile(file, body.don_hang_id)))
    : [body];

  return withTransaction(async (client) => {
    const photos = [];
    for (const input of photoInputs) {
      const photo = await photosRepository.create({ ...body, ...input }, client);
      photos.push(photo);
      await writeAudit('photo.created', 'anh',photo.id, context, { new_data: photo }, client);
    }
    return { photos };
  });
}

async function processPhoto(photo, order, cardType, job, client) {
  try {
    const original = await assetService.downloadBuffer(photo.cloudinary_anh_goc_id);
    const sourceMeta = await sharp(original.buffer).metadata();
    let sourceBuffer = original.buffer;
    let providerMetadata = { provider: job.nha_cung_cap, processing_mode: job.che_do_xu_ly };
    const aiAssist = {
      ai_edited: false,
      background: false,
      lighting: false,
      straighten: false,
      identity_preserved: true
    };

    const useAi = job.che_do_xu_ly === 'safe_assist'
      && (job.nha_cung_cap === 'google_ai' || job.nha_cung_cap === 'hybrid');

    if (useAi) {
      try {
        const aiResult = await googleAiService.editImage({
          imageBuffer: original.buffer,
          mimeType: original.content_type,
          prompt: googleAiService.buildSafeAssistPrompt(cardType)
        });
        sourceBuffer = aiResult.buffer;
        providerMetadata = {
          ...providerMetadata,
          google_ai_model: aiResult.model,
          google_ai_mime_type: aiResult.mime_type
        };
        Object.assign(aiAssist, { ai_edited: true, background: true, lighting: true, straighten: true });
      } catch (error) {
        if (job.kiem_tra_nghiem_ngat) throw error;
        providerMetadata = { ...providerMetadata, google_ai_fallback_reason: error.message };
        aiAssist.fallback_reason = error.message;
      }
    }

    const processedBuffer = await normalizeIdPhoto(sourceBuffer, cardType);
    const upload = await assetService.uploadBuffer(processedBuffer, {
      folder: `id-photo-management/orders/${order.id}/processed`,
      public_id: photo.id,
      resource_type: 'image',
      format: 'jpg'
    });

    const aiFindings = await googleAiService.assessQuality({
      imageBuffer: processedBuffer,
      mimeType: 'image/jpeg',
      cardType
    });

    const qc = computeQc({
      sourceWidthPx: sourceMeta.width || photo.rong_px,
      sourceHeightPx: sourceMeta.height || photo.cao_px,
      cardType,
      aiFindings
    });

    const processed = await photosRepository.markProcessed(photo.id, {
      cloudinary_anh_xu_ly_id: upload.public_id,
      metadata_anh_xu_ly: {
        ...assetService.cloudinaryMetadata(upload),
        ...providerMetadata,
        target_width_mm: Number(cardType.rong_mm),
        target_height_mm: Number(cardType.cao_mm),
        dpi: DEFAULT_DPI,
        ai_safe_assist: aiAssist,
        qc_findings: aiFindings || null
      },
      diem_chat_luong: qc.diem_chat_luong,
      loi_chat_luong: qc.loi_chat_luong,
      trang_thai_qc: qc.trang_thai_qc,
      ai_da_ap_dung: aiAssist
    }, client);

    if (job.kiem_tra_nghiem_ngat && qc.trang_thai_qc === 'fail') {
      const reason = `QC thất bại: ${qc.loi_chat_luong
        .filter((item) => item.severity === 'fail')
        .map((item) => item.message)
        .join('; ')}`;
      return photosRepository.updateStatus(photo.id, 'rejected', { loi_xu_ly: reason }, client);
    }

    return processed;
  } catch (error) {
    return photosRepository.markProcessingFailed(photo.id, error.message, client);
  }
}

async function runProcessingJob(jobId, context) {
  return withTransaction(async (client) => {
    const job = await photosRepository.markJobStarted(jobId, client);
    const order = await ordersRepository.findById(job.don_hang_id, client);
    const cardType = await catalogRepository.findCardType(order.loai_the_id, client);
    const photos = await photosRepository.photosForJob(job.id, client);

    const results = [];
    for (const photo of photos) {
      results.push(await processPhoto(photo, order, cardType, job, client));
    }

    const processedCount = results.filter((photo) => photo.trang_thai === 'processed').length;
    const failedCount = results.length - processedCount;
    const finishedJob = await photosRepository.finishProcessingJob(job.id, {
      trang_thai: processedCount > 0 ? 'completed' : 'failed',
      so_da_xu_ly: processedCount,
      so_that_bai: failedCount,
      loi: failedCount > 0 ? 'Một số ảnh xử lý thất bại' : null
    }, client);

    await writeAudit('processing_job.completed', 'tac_vu_xu_ly', job.id, context, {
      new_data: finishedJob
    }, client);

    return { job: finishedJob, photos: results };
  });
}

async function batchProcess(body, context) {
  const created = await withTransaction(async (client) => {
    const order = await ordersRepository.findByIdForUpdate(body.don_hang_id, client);
    if (!order) throw errors.notFound('Không tìm thấy đơn hàng');
    if (!['pending', 'processing'].includes(order.trang_thai)) {
      throw errors.invalidState('Chỉ đơn pending hoặc processing mới được batch-process', { status: order.trang_thai });
    }

    const photos = await photosRepository.findManyByIds(body.danh_sach_anh_id, client);
    if (photos.length !== body.danh_sach_anh_id.length || photos.some((photo) => photo.don_hang_id !== body.don_hang_id)) {
      throw errors.validation('danh_sach_anh_id phải thuộc cùng don_hang_id', { don_hang_id: body.don_hang_id });
    }

    let updatedOrder = order;
    if (order.trang_thai === 'pending') {
      updatedOrder = await ordersRepository.updateStatus(order.id, 'processing', {}, client);
      await writeAudit('order.status_changed', 'don_hang', order.id, context, {
        old_data: order,
        new_data: updatedOrder
      }, client);
    }

    const job = await photosRepository.createProcessingJob(body, context.user.id, client);
    const updatedPhotos = await photosRepository.markPhotosProcessing(body.danh_sach_anh_id, job.id, client);
    await writeAudit('processing_job.created', 'tac_vu_xu_ly', job.id, context, { new_data: job }, client);

    return { order: updatedOrder, job, photos: updatedPhotos };
  });

  const processed = await runProcessingJob(created.job.id, context);
  return { order: created.order, job: processed.job, photos: processed.photos };
}

async function getProcessingJob(id) {
  const job = await photosRepository.findProcessingJob(id);
  if (!job) throw errors.notFound('Không tìm thấy processing job');
  const photos = await photosRepository.photosForJob(id);
  return { job, photos };
}

async function getPhoto(id) {
  const photo = await photosRepository.findById(id);
  if (!photo) throw errors.notFound('Không tìm thấy ảnh');
  return { photo };
}

async function approvePhoto(id, context) {
  return withTransaction(async (client) => {
    const oldPhoto = await photosRepository.findById(id, client);
    if (!oldPhoto) throw errors.notFound('Không tìm thấy ảnh');
    if (!['processed', 'approved'].includes(oldPhoto.trang_thai)) {
      throw errors.invalidState('Chỉ ảnh processed mới được approved', { trang_thai: oldPhoto.trang_thai });
    }
    const photo = await photosRepository.updateStatus(id, 'approved', {}, client);
    await writeAudit('photo.approved', 'anh',id, context, { old_data: oldPhoto, new_data: photo }, client);
    return { photo };
  });
}

async function rejectPhoto(id, body, context) {
  return withTransaction(async (client) => {
    const oldPhoto = await photosRepository.findById(id, client);
    if (!oldPhoto) throw errors.notFound('Không tìm thấy ảnh');
    if (oldPhoto.trang_thai === 'approved') {
      throw errors.invalidState('Không thể từ chối ảnh đã được duyệt.', { trang_thai: oldPhoto.trang_thai });
    }
    const photo = await photosRepository.updateStatus(id, 'rejected', { loi_xu_ly: body.ly_do }, client);
    await writeAudit('photo.rejected', 'anh',id, context, { old_data: oldPhoto, new_data: photo }, client);
    return { photo };
  });
}

// Re-run QC only (no AI editing) on the current best asset. Mode quality_check_only.
async function requalifyPhoto(id, context) {
  return withTransaction(async (client) => {
    const photo = await photosRepository.findById(id, client);
    if (!photo) throw errors.notFound('Không tìm thấy ảnh');

    const publicId = photo.cloudinary_anh_xu_ly_id || photo.cloudinary_anh_goc_id;
    if (!publicId) throw errors.invalidState('Ảnh chưa có asset để kiểm tra QC');

    const order = await ordersRepository.findById(photo.don_hang_id, client);
    const cardType = await catalogRepository.findCardType(order.loai_the_id, client);

    const asset = await assetService.downloadBuffer(publicId);
    const aiFindings = await googleAiService.assessQuality({
      imageBuffer: asset.buffer,
      mimeType: asset.content_type,
      cardType
    });

    const qc = computeQc({
      sourceWidthPx: photo.rong_px,
      sourceHeightPx: photo.cao_px,
      cardType,
      aiFindings
    });

    const updated = await photosRepository.updateQc(id, qc, client);
    await writeAudit('photo.requalified', 'anh',id, context, { old_data: photo, new_data: updated }, client);
    return { photo: updated };
  });
}

module.exports = {
  createPhotos,
  batchProcess,
  getProcessingJob,
  getPhoto,
  approvePhoto,
  rejectPhoto,
  requalifyPhoto
};
