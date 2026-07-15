import { apiData } from './client';

// Public, no-login. fields = plain object; files = array of File.
export async function submitOnlineRequest({ fields, files }) {
  const formData = new FormData();
  Object.entries(fields || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') formData.set(key, value);
  });
  (files || []).forEach((file) => formData.append('files', file));
  return apiData('/public/online-requests', { method: 'POST', body: formData });
}

export async function datLichChup(payload) {
  return apiData('/public/dat-lich-chup', { method: 'POST', body: payload });
}

export async function getKhungGioChup(ngay_hen) {
  return apiData('/public/khung-gio-chup', { query: { ngay_hen } });
}

export async function guiAnhTuXa({ fields, files }) {
  const formData = new FormData();
  Object.entries(fields || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') formData.set(key, value);
  });
  (files || []).forEach((file) => formData.append('files', file));
  return apiData('/public/don-gui-anh', { method: 'POST', body: formData });
}

// Public, no-login. Customer lists all their online requests by phone.
export async function getOnlineRequestStatus(phone) {
  return apiData('/public/online-requests/status', {
    method: 'POST',
    body: { so_dien_thoai: phone }
  });
}

export async function listOnlineRequests(query) {
  return apiData('/online-requests', { query });
}

export async function getOnlineRequest(id) {
  return apiData(`/online-requests/${id}`);
}

export async function acceptOnlineRequest(id) {
  return apiData(`/online-requests/${id}/accept`, { method: 'POST', body: {} });
}

export async function rejectOnlineRequest(id, note) {
  return apiData(`/online-requests/${id}/reject`, { method: 'POST', body: { ghi_chu: note } });
}

export async function convertOnlineRequest(id, payload) {
  return apiData(`/online-requests/${id}/convert`, { method: 'POST', body: payload });
}

export async function listAppointments(query) {
  return apiData('/appointments', { query });
}

export async function updateAppointmentStatus(id, payload) {
  return apiData(`/appointments/${id}/status`, { method: 'PATCH', body: payload });
}
