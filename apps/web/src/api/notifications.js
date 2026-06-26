import { apiData } from './client';

export async function listNotifications(query) {
  return apiData('/notifications', { query });
}
