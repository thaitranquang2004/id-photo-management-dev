import { apiData } from './client';

export async function listPayments(orderId) {
  return apiData(`/orders/${orderId}/payments`);
}

export async function recordPayment(orderId, payload) {
  return apiData(`/orders/${orderId}/payments`, { method: 'POST', body: payload });
}
