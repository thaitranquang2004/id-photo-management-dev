const { withTransaction } = require('../db/pool');
const customersRepository = require('../repositories/customers.repository');
const { parsePagination, buildPagination } = require('../utils/pagination');
const { errors } = require('../utils/app-error');
const { writeAudit } = require('./audit.service');

async function listCustomers(query) {
  const pagination = parsePagination(query);
  const result = await customersRepository.list({ so_dien_thoai: query.so_dien_thoai, ...pagination });
  return {
    data: { customers: result.rows.map(({ total, ...row }) => row) },
    pagination: buildPagination(pagination.page, pagination.limit, result.total)
  };
}

async function getCustomer(id) {
  const customer = await customersRepository.findById(id);
  if (!customer) throw errors.notFound('Không tìm thấy khách hàng');
  const recentOrders = await customersRepository.recentOrders(id);
  return { customer, recent_orders: recentOrders };
}

async function createCustomer(body, context) {
  return withTransaction(async (client) => {
    const customer = await customersRepository.create(body, context.user.id, client);
    await writeAudit('customer.created', 'khach_hang',customer.id, context, { new_data: customer }, client);
    return { customer };
  });
}

async function updateCustomer(id, body, context) {
  return withTransaction(async (client) => {
    const oldCustomer = await customersRepository.findById(id, client);
    if (!oldCustomer) throw errors.notFound('Không tìm thấy khách hàng');
    const customer = await customersRepository.update(id, body, client);
    await writeAudit('customer.updated', 'khach_hang',id, context, { old_data: oldCustomer, new_data: customer }, client);
    return { customer };
  });
}

async function archiveCustomer(id, context) {
  return withTransaction(async (client) => {
    const oldCustomer = await customersRepository.findById(id, client);
    if (!oldCustomer) throw errors.notFound('Không tìm thấy khách hàng');
    const customer = await customersRepository.archive(id, client);
    const orderCount = await customersRepository.countOrders(id, client);
    await writeAudit('customer.archived', 'khach_hang',id, context, { old_data: oldCustomer, new_data: customer }, client);
    return { customer, order_count: orderCount };
  });
}

async function customerPhotos(id) {
  const customer = await customersRepository.findById(id);
  if (!customer) throw errors.notFound('Không tìm thấy khách hàng');
  const photos = await customersRepository.approvedPhotos(id);
  return { data: { photos } };
}

module.exports = {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  archiveCustomer,
  customerPhotos
};
