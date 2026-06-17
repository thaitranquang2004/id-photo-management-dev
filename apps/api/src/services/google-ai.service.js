const env = require('../config/env');
const { errors } = require('../utils/app-error');

const GEMINI_MODELS_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_GENERATE_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

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

function firstInlineImage(response) {
  const parts = response?.candidates?.[0]?.content?.parts || [];
  return parts.find((part) => part.inlineData || part.inline_data);
}

async function editImage({ imageBuffer, mimeType, prompt, model = env.GEMINI_IMAGE_MODEL }) {
  ensureGoogleAiConfigured();

  const response = await fetch(`${GEMINI_GENERATE_ENDPOINT}/${model}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': env.GEMINI_API_KEY
    },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: mimeType || 'image/jpeg',
              data: imageBuffer.toString('base64')
            }
          }
        ]
      }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE']
      }
    })
  });

  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { error: { message: text.slice(0, 200) } };
  }

  if (!response.ok) {
    throw errors.googleAi(payload?.error?.message || 'Không thể xử lý ảnh bằng Google AI', {
      status: response.status
    });
  }

  const inlineImage = firstInlineImage(payload);
  const inlineData = inlineImage?.inlineData || inlineImage?.inline_data;
  if (!inlineData?.data) {
    throw errors.googleAi('Google AI không trả về ảnh đã xử lý', { model });
  }

  return {
    buffer: Buffer.from(inlineData.data, 'base64'),
    mime_type: inlineData.mimeType || inlineData.mime_type || 'image/png',
    model
  };
}

module.exports = {
  ensureGoogleAiConfigured,
  listModels,
  assertImageModelAvailable,
  editImage
};
