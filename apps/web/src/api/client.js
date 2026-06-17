const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1').replace(/\/$/, '');

let accessTokenProvider = async () => null;

export class ApiError extends Error {
  constructor({ status, code, message, details }) {
    super(message || 'Có lỗi xảy ra');
    this.name = 'ApiError';
    this.status = status;
    this.code = code || 'API_ERROR';
    this.details = details || {};
  }
}

export function setAccessTokenProvider(provider) {
  accessTokenProvider = provider;
}

function buildUrl(path, query) {
  const url = new URL(`${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`);
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });
  return url;
}

async function parseJson(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_error) {
    return null;
  }
}

export async function apiRequest(path, options = {}) {
  const {
    method = 'GET',
    query,
    body,
    headers = {},
    signal,
    raw = false
  } = options;
  const token = await accessTokenProvider();
  const isFormData = body instanceof FormData;
  const requestHeaders = {
    Accept: raw ? '*/*' : 'application/json',
    ...headers
  };

  if (!isFormData && body !== undefined && body !== null) {
    requestHeaders['Content-Type'] = 'application/json';
  }
  if (token) {
    requestHeaders.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(buildUrl(path, query), {
    method,
    headers: requestHeaders,
    body: isFormData ? body : body !== undefined && body !== null ? JSON.stringify(body) : undefined,
    signal
  });

  if (raw) {
    if (!response.ok) {
      throw new ApiError({
        status: response.status,
        code: 'HTTP_ERROR',
        message: 'Không tải được dữ liệu từ backend'
      });
    }
    return response;
  }

  const payload = await parseJson(response);
  if (!response.ok || payload?.success === false) {
    const apiError = payload?.error || {};
    throw new ApiError({
      status: response.status,
      code: apiError.code,
      message: apiError.message || 'Backend trả về lỗi',
      details: apiError.details
    });
  }

  if (payload?.success === true) {
    return {
      data: payload.data,
      pagination: payload.pagination
    };
  }

  return { data: payload, pagination: null };
}

export async function apiData(path, options) {
  const result = await apiRequest(path, options);
  return result.data;
}
