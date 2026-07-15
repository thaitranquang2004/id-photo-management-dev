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

export async function getPublicCardTypes() {
  return apiData('/public/card-types');
}

// Kiểm tra chất lượng 1 ảnh so với chuẩn của loại thẻ; không lưu trữ, trả feedback tức thời.
export async function checkPublicPhotoQuality({ file, loai_the_id }) {
  const formData = new FormData();
  formData.append('file', file);
  formData.set('loai_the_id', loai_the_id);
  return apiData('/public/photos/qc-check', { method: 'POST', body: formData });
}
