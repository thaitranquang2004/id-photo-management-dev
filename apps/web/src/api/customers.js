import { apiData, apiRequest } from './client';

export async function listCustomers(params = {}) {
  const result = await apiRequest('/customers', { query: params });
  return result;
}

export async function searchCustomersByPhone(phone) {
  const result = await listCustomers({ so_dien_thoai: phone, limit: 10 });
  return result.data.customers || [];
}

export async function getCustomer(id) {
  return apiData(`/customers/${id}`);
}

export async function createCustomer(payload) {
  return apiData('/customers', { method: 'POST', body: payload });
}

export async function updateCustomer(id, payload) {
  return apiData(`/customers/${id}`, { method: 'PATCH', body: payload });
}

export async function getCustomerPhotos(id) {
  return apiData(`/customers/${id}/photos`);
}
