const { withTransaction } = require('../db/pool');
const sharp = require('sharp');
const photosRepository = require('../repositories/photos.repository');
const ordersRepository = require('../repositories/orders.repository');
const catalogRepository = require('../repositories/catalog.repository');
const { errors } = require('../utils/app-error');
const { writeAudit } = require('./audit.service');
const assetService = require('./asset.service');
const googleAiService = require('./google-ai.service');

const DEFAULT_DPI = 300;

function mmToPx(mm, dpi = DEFAULT_DPI) {
  return Math.max(1, Math.round((Number(mm) / 25.4) * dpi));
}

function qcIssue(code, severity, message, value = null, threshold = null) {
  return { code, severity, message, value, threshold };
}

function aspectWithinTolerance(a, b, tolerance) {
  if (!a || !b) return true;
  return Math.abs(a - b) / b <= tolerance;
}

// Combine deterministic checks (resolution/aspect from Sharp) with best-effort AI
// findings into structured warnings. QC never blocks on its own in non-strict mode —
// staff always reviews. In strict mode a `fail` rollup rejects the photo.
function computeQc({ sourceWidthPx, sourceHeightPx, cardType, aiFindings }) {
  const issues = [];
  const targetWidth = mmToPx(cardType.rong_mm);
  const targetHeight = mmToPx(cardType.cao_mm);

  if (sourceWidthPx && sourceHeightPx) {
    const minRatio = Math.min(sourceWidthPx / targetWidth, sourceHeightPx / targetHeight);
    if (minRatio < 0.6) {
      issues.push(qcIssue('low_resolution', 'fail',
        `Ảnh gốc ${sourceWidthPx}x${sourceHeightPx}px quá nhỏ so với khổ in ${targetWidth}x${targetHeight}px @${DEFAULT_DPI}dpi`,
        Number(minRatio.toFixed(2)), 0.6));
    } else if (minRatio < 1) {
      issues.push(qcIssue('low_resolution', 'warn',
        'Ảnh gốc nhỏ hơn khổ in mục tiêu, có thể bị mờ khi phóng to',
        Number(minRatio.toFixed(2)), 1));
    }

    const srcAspect = sourceWidthPx / sourceHeightPx;
    const cardAspect = targetWidth / targetHeight;
    if (!aspectWithinTolerance(srcAspect, cardAspect, 0.15)) {
      issues.push(qcIssue('wrong_aspect', 'warn',
        'Tỉ lệ ảnh gốc khác tỉ lệ thẻ; ảnh sẽ có viền nền khi chuẩn hoá (không cắt vào mặt)',
        Number(srcAspect.toFixed(2)), Number(cardAspect.toFixed(2))));
    }
  }

  if (aiFindings) {
    const req = cardType.yeu_cau || {};
    if (aiFindings.face_detected === false || aiFindings.face_count === 0) {
      issues.push(qcIssue('no_face', 'fail', 'Không phát hiện khuôn mặt trong ảnh'));
    }
    if (typeof aiFindings.face_count === 'number' && aiFindings.face_count > 1) {
      issues.push(qcIssue('multiple_faces', 'warn', `Phát hiện ${aiFindings.face_count} khuôn mặt`));
    }
    if (aiFindings.face_centered === false) {
      issues.push(qcIssue('face_not_centered', 'warn', 'Khuôn mặt chưa được căn giữa'));
    }
    if (typeof aiFindings.face_height_ratio === 'number') {
      const minR = Number(req.min_face_ratio) || 0.5;
      const maxR = Number(req.max_face_ratio) || 0.8;
      if (aiFindings.face_height_ratio < minR || aiFindings.face_height_ratio > maxR) {
        issues.push(qcIssue('face_ratio_out_of_range', 'warn',
          `Tỉ lệ khuôn mặt ${(aiFindings.face_height_ratio * 100).toFixed(0)}% ngoài khoảng ${minR}-${maxR}`,
          Number(aiFindings.face_height_ratio.toFixed(2)), `${minR}-${maxR}`));
      }
    }
    if (aiFindings.background_uniform === false) {
      issues.push(qcIssue('background_not_uniform', 'warn', 'Nền chưa đồng nhất'));
    }
    if (aiFindings.background_matches_required_color === false) {
      issues.push(qcIssue('background_wrong_color', 'warn',
        `Nền chưa đúng màu yêu cầu (${cardType.mau_nen || '#FFFFFF'})`));
    }
    if (aiFindings.glare_or_strong_shadow === true) {
      issues.push(qcIssue('glare_or_shadow', 'warn', 'Có loá sáng hoặc bóng đổ mạnh'));
    }
    if (aiFindings.eyes_open === false) {
      issues.push(qcIssue('eyes_closed', 'warn', 'Mắt có thể đang nhắm'));
    }
    if (aiFindings.neutral_expression === false) {
      issues.push(qcIssue('non_neutral_expression', 'warn', 'Biểu cảm chưa trung tính'));
    }
    if (aiFindings.sufficient_sharpness === false) {
      issues.push(qcIssue('low_sharpness', 'warn', 'Ảnh chưa đủ sắc nét'));
    }
  }

  const hasFail = issues.some((item) => item.severity === 'fail');
  const hasWarn = issues.some((item) => item.severity === 'warn');
  const penalty = issues.reduce((sum, item) => sum + (item.severity === 'fail' ? 40 : 10), 0);

  return {
    qc_status: hasFail ? 'fail' : hasWarn ? 'warn' : 'pass',
    quality_score: Math.max(0, Math.min(100, 100 - penalty)),
    quality_issues: issues
  };
}

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

async function createPhotos(body, files, context) {
  if (!files?.length && !body.cloudinary_original_public_id) {
    throw errors.validation('Cần cloudinary_original_public_id để tạo record ảnh');
  }

  const order = await ordersRepository.findById(body.order_id);
  if (!order) throw errors.notFound('Không tìm thấy đơn hàng');

  const photoInputs = files?.length
    ? await Promise.all(files.map((file) => uploadOriginalFile(file, body.order_id)))
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
    const original = await assetService.downloadBuffer(photo.cloudinary_original_public_id);
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
      sourceWidthPx: sourceMeta.width || photo.width_px,
      sourceHeightPx: sourceMeta.height || photo.height_px,
      cardType,
      aiFindings
    });

    const processed = await photosRepository.markProcessed(photo.id, {
      cloudinary_processed_public_id: upload.public_id,
      processed_asset_metadata: {
        ...assetService.cloudinaryMetadata(upload),
        ...providerMetadata,
        target_width_mm: Number(cardType.rong_mm),
        target_height_mm: Number(cardType.cao_mm),
        dpi: DEFAULT_DPI,
        ai_safe_assist: aiAssist,
        qc_findings: aiFindings || null
      },
      quality_score: qc.quality_score,
      quality_issues: qc.quality_issues,
      qc_status: qc.qc_status,
      ai_assist_applied: aiAssist
    }, client);

    if (job.kiem_tra_nghiem_ngat && qc.qc_status === 'fail') {
      const reason = `QC thất bại: ${qc.quality_issues
        .filter((item) => item.severity === 'fail')
        .map((item) => item.message)
        .join('; ')}`;
      return photosRepository.updateStatus(photo.id, 'rejected', { processing_error: reason }, client);
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
    const cardType = await catalogRepository.findCardType(order.card_type_id, client);
    const photos = await photosRepository.photosForJob(job.id, client);

    const results = [];
    for (const photo of photos) {
      results.push(await processPhoto(photo, order, cardType, job, client));
    }

    const processedCount = results.filter((photo) => photo.status === 'processed').length;
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
    const order = await ordersRepository.findByIdForUpdate(body.order_id, client);
    if (!order) throw errors.notFound('Không tìm thấy đơn hàng');
    if (!['pending', 'processing'].includes(order.status)) {
      throw errors.invalidState('Chỉ đơn pending hoặc processing mới được batch-process', { status: order.status });
    }

    const photos = await photosRepository.findManyByIds(body.photo_ids, client);
    if (photos.length !== body.photo_ids.length || photos.some((photo) => photo.order_id !== body.order_id)) {
      throw errors.validation('photo_ids phải thuộc cùng order_id', { order_id: body.order_id });
    }

    let updatedOrder = order;
    if (order.status === 'pending') {
      updatedOrder = await ordersRepository.updateStatus(order.id, 'processing', {}, client);
      await writeAudit('order.status_changed', 'don_hang', order.id, context, {
        old_data: order,
        new_data: updatedOrder
      }, client);
    }

    const job = await photosRepository.createProcessingJob(body, context.user.id, client);
    const updatedPhotos = await photosRepository.markPhotosProcessing(body.photo_ids, job.id, client);
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
    if (!['processed', 'approved'].includes(oldPhoto.status)) {
      throw errors.invalidState('Chỉ ảnh processed mới được approved', { status: oldPhoto.status });
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
    if (oldPhoto.status === 'approved') {
      throw errors.invalidState('Không thể từ chối ảnh đã được duyệt.', { status: oldPhoto.status });
    }
    const photo = await photosRepository.updateStatus(id, 'rejected', { processing_error: body.reason }, client);
    await writeAudit('photo.rejected', 'anh',id, context, { old_data: oldPhoto, new_data: photo }, client);
    return { photo };
  });
}

// Re-run QC only (no AI editing) on the current best asset. Mode quality_check_only.
async function requalifyPhoto(id, context) {
  return withTransaction(async (client) => {
    const photo = await photosRepository.findById(id, client);
    if (!photo) throw errors.notFound('Không tìm thấy ảnh');

    const publicId = photo.cloudinary_processed_public_id || photo.cloudinary_original_public_id;
    if (!publicId) throw errors.invalidState('Ảnh chưa có asset để kiểm tra QC');

    const order = await ordersRepository.findById(photo.order_id, client);
    const cardType = await catalogRepository.findCardType(order.card_type_id, client);

    const asset = await assetService.downloadBuffer(publicId);
    const aiFindings = await googleAiService.assessQuality({
      imageBuffer: asset.buffer,
      mimeType: asset.content_type,
      cardType
    });

    const qc = computeQc({
      sourceWidthPx: photo.width_px,
      sourceHeightPx: photo.height_px,
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
