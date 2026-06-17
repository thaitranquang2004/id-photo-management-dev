import { apiData, apiRequest } from './client';

export async function getAdminDashboard() {
  return apiData('/admin/dashboard');
}

export async function listCardTypes() {
  return apiData('/card-types');
}

export async function createCardType(payload) {
  return apiData('/card-types', { method: 'POST', body: payload });
}

export async function updateCardType(id, payload) {
  return apiData(`/card-types/${id}`, { method: 'PATCH', body: payload });
}

export async function archiveCardType(id) {
  return apiData(`/card-types/${id}/archive`, { method: 'PATCH', body: {} });
}

export async function listPricing(params = {}) {
  return apiData('/pricing', { query: params });
}

export async function createPricing(payload) {
  return apiData('/pricing', { method: 'POST', body: payload });
}

export async function listAdminUsers(params = {}) {
  return apiRequest('/admin/users', { query: params });
}

export async function createAdminUser(payload) {
  return apiData('/admin/users', { method: 'POST', body: payload });
}

export async function updateAdminUser(id, payload) {
  return apiData(`/admin/users/${id}`, { method: 'PATCH', body: payload });
}

export async function resetUserPassword(id) {
  return apiData(`/admin/users/${id}/reset-password`, { method: 'POST', body: {} });
}

export async function getOrdersReport(params = {}) {
  return apiData('/admin/reports/orders', { query: params });
}

export async function downloadOrdersReportCsv(params = {}) {
  return apiRequest('/admin/reports/orders.csv', { query: params, raw: true });
}

export async function createOrdersExport(filters) {
  return apiData('/admin/reports/orders/export', {
    method: 'POST',
    body: { report_type: 'orders', filters }
  });
}

export async function getExportJob(id) {
  return apiData(`/admin/export-jobs/${id}`);
}
