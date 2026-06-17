const { withTransaction } = require('../db/pool');
const layoutsRepository = require('../repositories/layouts.repository');
const photosRepository = require('../repositories/photos.repository');
const ordersRepository = require('../repositories/orders.repository');
const { errors } = require('../utils/app-error');
const { writeAudit } = require('./audit.service');
const assetService = require('./asset.service');

async function validateConfig(body) {
  const photos = await photosRepository.findManyByIds(body.photo_ids);
  const invalid = photos.filter((photo) => photo.order_id !== body.order_id || photo.status !== 'approved');
  return {
    valid: photos.length === body.photo_ids.length && invalid.length === 0,
    warnings: invalid.length ? ['Chỉ ảnh approved thuộc cùng order mới được dùng cho layout'] : []
  };
}

async function preview() {
  throw errors.cloudinary('Preview layout cần renderer/Cloudinary, hiện mới có skeleton an toàn');
}

async function generateLayout(body, context) {
  if (!body.cloudinary_public_id) {
    throw errors.cloudinary('Tạo layout thật cần cloudinary_public_id từ renderer/upload');
  }

  return withTransaction(async (client) => {
    const order = await ordersRepository.findByIdForUpdate(body.order_id, client);
    if (!order) throw errors.notFound('Không tìm thấy đơn hàng');

    const photos = await photosRepository.findManyByIds(body.photo_ids, client);
    if (photos.length !== body.photo_ids.length || photos.some((photo) => photo.order_id !== body.order_id || photo.status !== 'approved')) {
      throw errors.validation('Layout chỉ được dùng ảnh approved thuộc cùng order', { order_id: body.order_id });
    }

    const printLayout = await layoutsRepository.createLayout(body, context.user.id, client);
    const items = await layoutsRepository.createItems(printLayout.id, body.photo_ids, client);
    await writeAudit('layout.created', 'print_layouts', printLayout.id, context, { new_data: { print_layout: printLayout, items } }, client);

    let updatedOrder = order;
    if (order.status === 'processing') {
      updatedOrder = await ordersRepository.updateStatus(order.id, 'completed', {}, client);
      await writeAudit('order.status_changed', 'orders', order.id, context, { old_data: order, new_data: updatedOrder }, client);
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
  if (layout.status !== 'generated') {
    throw errors.invalidState('Chỉ layout generated mới có URL tải', { status: layout.status });
  }
  const signed = assetService.signedDownloadUrl(layout.cloudinary_public_id, { format: 'pdf', resource_type: 'image', attachment: true });
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
    await writeAudit('layout.issue_reported', 'layout_issues', issue.id, context, {
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
