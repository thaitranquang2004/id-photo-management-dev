const { withTransaction } = require('../db/pool');
const paymentRepository = require('../repositories/payment.repository');
const ordersRepository = require('../repositories/orders.repository');
const { writeAudit } = require('./audit.service');
const { errors } = require('../utils/app-error');

// Record one payment (deposit/balance/refund) and keep orders.amount_paid in sync
// within the same transaction so the running total never drifts.
async function recordPayment(orderId, body, context) {
  return withTransaction(async (client) => {
    const order = await ordersRepository.findByIdForUpdate(orderId, client);
    if (!order) throw errors.notFound('Không tìm thấy đơn hàng');

    const payment = await paymentRepository.create({
      don_hang_id: orderId,
      loai: body.loai,
      so_tien: body.so_tien,
      hinh_thuc: body.hinh_thuc,
      ghi_chu: body.ghi_chu,
      nguoi_thu: context.user.id
    }, client);

    const paid = await paymentRepository.sumPaid(orderId, client);
    if (paid < 0) {
      throw errors.validation('Hoàn tiền vượt quá số tiền đã thu', { amount_paid: paid });
    }
    const updatedOrder = await ordersRepository.setAmountPaid(orderId, paid, client);

    await writeAudit('payment.recorded', 'thanh_toan', payment.id, context, {
      new_data: { payment, amount_paid: paid }
    }, client);

    return { payment, order: updatedOrder };
  });
}

async function listPayments(orderId) {
  const payments = await paymentRepository.listByOrder(orderId);
  return { data: { payments } };
}

module.exports = { recordPayment, listPayments };
