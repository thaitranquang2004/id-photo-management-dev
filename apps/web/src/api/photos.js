import { apiData } from './client';

export async function uploadPhotos(orderId, files) {
  const formData = new FormData();
  formData.set('order_id', orderId);
  Array.from(files).forEach((file) => formData.append('files', file));
  return apiData('/photos', { method: 'POST', body: formData });
}

export async function batchProcessPhotos(payload) {
  return apiData('/photos/batch-process', { method: 'POST', body: payload });
}

export async function getProcessingJob(id) {
  return apiData(`/processing-jobs/${id}`);
}

export async function approvePhoto(id, notes = '') {
  return apiData(`/photos/${id}/approve`, { method: 'POST', body: { notes } });
}

export async function rejectPhoto(id, reason) {
  return apiData(`/photos/${id}/reject`, { method: 'POST', body: { reason } });
}

export async function overridePhoto(id, payload) {
  return apiData(`/photos/${id}/override`, { method: 'POST', body: payload });
}
