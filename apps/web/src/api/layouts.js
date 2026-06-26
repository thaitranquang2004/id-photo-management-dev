import { apiData } from './client';

export async function getLayoutDownloadUrl(id) {
  return apiData(`/layouts/${id}/download-url`, { method: 'POST', body: {} });
}
