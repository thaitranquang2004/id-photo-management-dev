const { withTransaction } = require('../db/pool');
const photosRepository = require('../repositories/photos.repository');
const ordersRepository = require('../repositories/orders.repository');
const { errors } = require('../utils/app-error');
const { writeAudit } = require('./audit.service');

async function createPhotos(body, files, context) {
  if (files?.length && !body.cloudinary_original_public_id) {
    throw errors.cloudinary('Upload file thật lên Cloudinary chưa được tích hợp; gửi cloudinary_original_public_id để tạo record ảnh');
  }
  if (!body.cloudinary_original_public_id) {
    throw errors.validation('Cần cloudinary_original_public_id để tạo record ảnh');
  }

  return withTransaction(async (client) => {
    const order = await ordersRepository.findById(body.order_id, client);
    if (!order) throw errors.notFound('Không tìm thấy đơn hàng');
    const photo = await photosRepository.create(body, client);
    await writeAudit('photo.created', 'photos', photo.id, context, { new_data: photo }, client);
    return { photos: [photo] };
  });
}

async function batchProcess(body, context) {
  return withTransaction(async (client) => {
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
