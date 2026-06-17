const env = require('../config/env');
const { errors } = require('../utils/app-error');

const GEMINI_MODELS_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

function ensureGoogleAiConfigured() {
  if (!env.GEMINI_API_KEY) {
    throw errors.googleAi('Google AI env chưa được cấu hình');
  }
}

async function listModels() {
  ensureGoogleAiConfigured();
  const url = `${GEMINI_MODELS_ENDPOINT}?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;
  const response = await fetch(url);
  const text = await response.text();
  let payload;

  try {
    payload = JSON.parse(text);
  } catch {
    payload = { error: { message: text.slice(0, 200) } };
  }

  if (!response.ok) {
    throw errors.googleAi(payload?.error?.message || 'Không thể kết nối Google AI', {
      status: response.status
    });
  }

  return payload.models || [];
}

async function assertImageModelAvailable(model = env.GEMINI_IMAGE_MODEL) {
  const models = await listModels();
  const modelName = `models/${model}`;
  const found = models.some((item) => item.name === modelName);

  if (!found) {
    throw errors.googleAi('Không tìm thấy Gemini image model trong tài khoản Google AI', { model });
  }

  return { model, model_count: models.length };
}

module.exports = {
  ensureGoogleAiConfigured,
  listModels,
  assertImageModelAvailable
};
