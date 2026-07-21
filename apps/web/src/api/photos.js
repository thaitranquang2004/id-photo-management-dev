import { apiData } from './client';

export async function uploadPhotos(orderId, files) {
  const formData = new FormData();
  formData.set('don_hang_id', orderId);
  Array.from(files).forEach((file) => formData.append('files', file));
  return apiData('/photos', { method: 'POST', body: formData });
}

export async function batchProcessPhotos(payload) {
  return apiData('/photos/batch-process', { method: 'POST', body: payload });
}

export async function getProcessingJob(id) {
  return apiData(`/processing-jobs/${id}`);
}

export async function getPhotoDownloadUrl(id) {
  return apiData(`/photos/${id}/download-url`, { method: 'POST', body: {} });
}

export async function approvePhoto(id, notes = '') {
  return apiData(`/photos/${id}/approve`, { method: 'POST', body: { ghi_chu: notes } });
}

export async function rejectPhoto(id, reason) {
  return apiData(`/photos/${id}/reject`, { method: 'POST', body: { ly_do: reason } });
}

export async function requalifyPhoto(id) {
  return apiData(`/photos/${id}/requalify`, { method: 'POST', body: {} });
}
