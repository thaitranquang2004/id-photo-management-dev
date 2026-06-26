const { withTransaction } = require('../db/pool');
const { serviceClient } = require('../lib/supabase');
const adminRepository = require('../repositories/admin.repository');
const profilesRepository = require('../repositories/profiles.repository');
const { parsePagination, buildPagination } = require('../utils/pagination');
const { errors } = require('../utils/app-error');
const { writeAudit } = require('./audit.service');
const cleanupService = require('./cleanup.service');

async function dashboard() {
  return { dashboard: await adminRepository.dashboard() };
}

async function orderReport(query) {
  return { orders: await adminRepository.orderReport(query) };
}

function ordersCsv(rows) {
  const header = ['order_code', 'status', 'total_amount', 'amount_paid', 'quantity', 'created_at', 'customer_name', 'customer_phone', 'card_type_name', 'staff_name'];
  const lines = rows.map((row) => header.map((key) => JSON.stringify(row[key] ?? '')).join(','));
  return [header.join(','), ...lines].join('\n');
}

async function orderReportCsv(query) {
  const rows = await adminRepository.orderReport(query);
  return ordersCsv(rows);
}

async function listUsers(query) {
  const pagination = parsePagination(query);
  const result = await profilesRepository.list(pagination);
  const { data } = await serviceClient.auth.admin.listUsers({
    page: 1,
    perPage: 1000
  });
  const emailById = new Map((data?.users || []).map((user) => [user.id, user.email]));
  return {
    data: {
      users: result.rows.map(({ total, ...row }) => ({
        ...row,
        email: emailById.get(row.id) || null
      }))
    },
    pagination: buildPagination(pagination.page, pagination.limit, result.total)
  };
}

async function createUser(body, context) {
  const { data, error } = await serviceClient.auth.admin.createUser({
    email: body.email,
    password: body.password,
    email_confirm: true
  });
  if (error || !data?.user?.id) {
    throw errors.validation('Không tạo được user Supabase', { reason: error?.message });
  }

  return withTransaction(async (client) => {
    const profile = await profilesRepository.upsertProfile({
      id: data.user.id,
      full_name: body.full_name,
      phone: body.phone,
      role: body.role,
      is_active: body.is_active,
      disabled_at: body.is_active ? null : new Date()
    }, client);
    await writeAudit('user.created', 'nguoi_dung', profile.id, context, { new_data: profile }, client);
    return { user: data.user, profile };
  });
}

async function updateUser(id, body, context) {
  return withTransaction(async (client) => {
    const oldProfile = await profilesRepository.findById(id, client);
    if (!oldProfile) throw errors.notFound('Không tìm thấy nhân viên');
    const patch = {
      ...body,
      disabled_at: body.is_active === false ? new Date() : body.disabled_at
    };
    const profile = await profilesRepository.updateProfile(id, patch, client);
    await writeAudit('user.updated', 'nguoi_dung', id, context, { old_data: oldProfile, new_data: profile }, client);
    return { profile };
  });
}

async function resetPassword(id, context) {
  const profile = await profilesRepository.findById(id);
  if (!profile) throw errors.notFound('Không tìm thấy nhân viên');
  await writeAudit('user.password_reset_requested', 'nguoi_dung', id, context, { new_data: { id } });
  return { message: 'Reset password cần email flow/Supabase template trong triển khai production' };
}

async function auditLogs(query) {
  const pagination = parsePagination(query);
  const { many } = require('../db/pool');
  const rows = await many(
    `select *, count(*) over()::int as total
     from public.nhat_ky_he_thong
     order by ngay_tao desc
     limit $1 offset $2`,
    [pagination.limit, pagination.offset]
  );
  const total = rows[0]?.total || 0;
  return {
    data: { audit_logs: rows.map(({ total: _total, ...row }) => row) },
    pagination: buildPagination(pagination.page, pagination.limit, total)
  };
}

async function purgeOldAssets() {
  return { result: await cleanupService.purgeOldOrders() };
}

module.exports = {
  dashboard,
  orderReport,
  orderReportCsv,
  listUsers,
  createUser,
  updateUser,
  resetPassword,
  auditLogs,
  purgeOldAssets
};
