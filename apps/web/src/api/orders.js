import { apiData, apiRequest } from './client';

export async function listOrders(params = {}) {
  return apiRequest('/orders', { query: params });
}

export async function getOrder(id) {
  return apiData(`/orders/${id}`);
}

export async function createOrder(payload) {
  return apiData('/orders', { method: 'POST', body: payload });
}

export async function startOrderProcessing(id) {
  return apiData(`/orders/${id}/start-processing`, { method: 'POST', body: {} });
}

export async function completeOrder(id, payload = {}) {
  return apiData(`/orders/${id}/complete`, { method: 'POST', body: payload });
}

export async function deliverOrder(id, payload = {}) {
  return apiData(`/orders/${id}/deliver`, { method: 'POST', body: payload });
}

export async function cancelOrder(id, reason) {
  return apiData(`/orders/${id}/cancel`, { method: 'POST', body: { ly_do: reason } });
}

export async function notifyOrderReady(id) {
  return apiData(`/orders/${id}/notify-ready`, { method: 'POST', body: {} });
}
