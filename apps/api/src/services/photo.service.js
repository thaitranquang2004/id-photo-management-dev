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

function processedPrompt(cardType) {
  return [
    'Edit the supplied image into a professional ID photo.',
    'Preserve the person identity and realistic facial features.',
    'Use a plain studio background matching the requested card background color.',
    'Center the face and shoulders, keep a neutral expression, sharp lighting, no text, no watermark.',
    `Requested card type: ${cardType.name}.`,
    `Background color: ${cardType.background_color || '#FFFFFF'}.`
  ].join(' ');
}

async function normalizeIdPhoto(buffer, cardType) {
  const width = mmToPx(cardType.width_mm);
  const height = mmToPx(cardType.height_mm);
  return sharp(buffer)
    .rotate()
    .resize(width, height, { fit: 'cover', position: 'attention' })
    .flatten({ background: cardType.background_color || '#FFFFFF' })
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
      await writeAudit('photo.created', 'photos', photo.id, context, { new_data: photo }, client);
    }
    return { photos };
  });
}

async function processPhoto(photo, order, cardType, job, client) {
  try {
    const original = await assetService.downloadBuffer(photo.cloudinary_original_public_id);
    let sourceBuffer = original.buffer;
    let providerMetadata = { provider: job.provider };

    if (job.provider === 'google_ai' || job.provider === 'hybrid') {
      try {
        const aiResult = await googleAiService.editImage({
          imageBuffer: original.buffer,
          mimeType: original.content_type,
          prompt: processedPrompt(cardType)
        });
        sourceBuffer = aiResult.buffer;
        providerMetadata = {
          ...providerMetadata,
          google_ai_model: aiResult.model,
          google_ai_mime_type: aiResult.mime_type
        };
      } catch (error) {
        if (job.strict_quality_check) throw error;
        providerMetadata = {
          ...providerMetadata,
          google_ai_fallback_reason: error.message
        };
      }
    }

    const processedBuffer = await normalizeIdPhoto(sourceBuffer, cardType);
    const upload = await assetService.uploadBuffer(processedBuffer, {
      folder: `id-photo-management/orders/${order.id}/processed`,
      public_id: photo.id,
      resource_type: 'image',
      format: 'jpg'
    });

    return photosRepository.markProcessed(photo.id, {
      cloudinary_processed_public_id: upload.public_id,
      processed_asset_metadata: {
        ...assetService.cloudinaryMetadata(upload),
        ...providerMetadata,
        target_width_mm: Number(cardType.width_mm),
        target_height_mm: Number(cardType.height_mm),
        dpi: DEFAULT_DPI
      },
      quality_score: 90,
      quality_issues: []
    }, client);
  } catch (error) {
    return photosRepository.markProcessingFailed(photo.id, error.message, client);
  }
}

async function runProcessingJob(jobId, context) {
  return withTransaction(async (client) => {
    const job = await photosRepository.markJobStarted(jobId, client);
    const order = await ordersRepository.findById(job.order_id, client);
    const cardType = await catalogRepository.findCardType(order.card_type_id, client);
    const photos = await photosRepository.photosForJob(job.id, client);

    const results = [];
    for (const photo of photos) {
      results.push(await processPhoto(photo, order, cardType, job, client));
    }

    const processedCount = results.filter((photo) => photo.status === 'processed').length;
    const failedCount = results.length - processedCount;
    const finishedJob = await photosRepository.finishProcessingJob(job.id, {
      status: processedCount > 0 ? 'completed' : 'failed',
      processed_count: processedCount,
      failed_count: failedCount,
      error_message: failedCount > 0 ? 'Một số ảnh xử lý thất bại' : null
    }, client);

    await writeAudit('processing_job.completed', 'processing_jobs', job.id, context, {
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
      await writeAudit('order.status_changed', 'orders', order.id, context, {
        old_data: order,
        new_data: updatedOrder
      }, client);
    }

    const job = await photosRepository.createProcessingJob(body, context.user.id, client);
    const updatedPhotos = await photosRepository.markPhotosProcessing(body.photo_ids, job.id, client);
    await writeAudit('processing_job.created', 'processing_jobs', job.id, context, { new_data: job }, client);

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
    await writeAudit('photo.approved', 'photos', id, context, { old_data: oldPhoto, new_data: photo }, client);
    return { photo };
  });
}

async function rejectPhoto(id, body, context) {
  return withTransaction(async (client) => {
    const oldPhoto = await photosRepository.findById(id, client);
    if (!oldPhoto) throw errors.notFound('Không tìm thấy ảnh');
    if (oldPhoto.status === 'approved') {
      throw errors.invalidState('Không thể reject ảnh đã approved nếu chưa override quy trình', { status: oldPhoto.status });
    }
    const photo = await photosRepository.updateStatus(id, 'rejected', { processing_error: body.reason }, client);
    await writeAudit('photo.rejected', 'photos', id, context, { old_data: oldPhoto, new_data: photo }, client);
    return { photo };
  });
}

async function overridePhoto(id, body, context) {
  return withTransaction(async (client) => {
    const oldPhoto = await photosRepository.findById(id, client);
    if (!oldPhoto) throw errors.notFound('Không tìm thấy ảnh');
    const photo = await photosRepository.overrideProcessed(id, body, client);
    await writeAudit('photo.override', 'photos', id, context, { old_data: oldPhoto, new_data: photo }, client);
    return { photo };
  });
}

module.exports = {
  createPhotos,
  batchProcess,
  getProcessingJob,
  getPhoto,
  approvePhoto,
  rejectPhoto,
  overridePhoto
};
