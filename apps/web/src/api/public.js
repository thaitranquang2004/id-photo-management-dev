import { apiData } from './client';

export async function lookupCustomer(params) {
  return apiData('/public/customer-lookup', { query: params });
}

export async function getPublicPhotoDownloadUrl(photoId, payload) {
  return apiData(`/public/photos/${photoId}/download-url`, { method: 'POST', body: payload });
}

export async function createPublicReprintRequest(payload) {
  return apiData('/public/reprint-requests', { method: 'POST', body: payload });
}
