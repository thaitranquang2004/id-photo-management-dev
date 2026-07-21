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

export async function listOnlineFilePricing() {
  return apiData('/pricing/online-file');
}

export async function createOnlineFilePricing(payload) {
  return apiData('/pricing/online-file', { method: 'POST', body: payload });
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

export async function getOrdersReport(params = {}) {
  return apiData('/admin/reports/orders', { query: params });
}

export async function purgeOldAssets() {
  return apiData('/admin/maintenance/purge-assets', { method: 'POST', body: {} });
}

export async function listKhungGioChupAdmin() { return apiData('/admin/khung-gio-chup'); }
export async function updateKhungGioChup(id, payload) { return apiData(`/admin/khung-gio-chup/${id}`, { method: 'PATCH', body: payload }); }
