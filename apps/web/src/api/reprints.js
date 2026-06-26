import { apiData } from './client';

export async function listReprintRequests(query = {}) {
  return apiData('/reprint-requests', { query });
}

export async function getReprintRequest(id) {
  return apiData(`/reprint-requests/${id}`);
}

export async function updateReprintStatus(id, payload) {
  return apiData(`/reprint-requests/${id}/status`, { method: 'PATCH', body: payload });
}

export async function convertReprintToOrder(id, payload = {}) {
  return apiData(`/reprint-requests/${id}/convert`, { method: 'POST', body: payload });
}
