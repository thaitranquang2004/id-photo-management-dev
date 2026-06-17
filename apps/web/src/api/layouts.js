import { apiData } from './client';

export async function validateLayoutConfig(payload) {
  return apiData('/layouts/validate-config', { method: 'POST', body: payload });
}

export async function previewLayout(payload) {
  return apiData('/layouts/preview', { method: 'POST', body: payload });
}

export async function generateLayout(payload) {
  return apiData('/layouts/generate', { method: 'POST', body: payload });
}

export async function getLayout(id) {
  return apiData(`/layouts/${id}`);
}

export async function getLayoutDownloadUrl(id) {
  return apiData(`/layouts/${id}/download-url`, { method: 'POST', body: {} });
}
