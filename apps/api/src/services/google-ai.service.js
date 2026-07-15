const env = require('../config/env');
const { errors } = require('../utils/app-error');

const GEMINI_GENERATE_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

function ensureGoogleAiConfigured() {
  if (!env.GEMINI_API_KEY) {
    throw errors.googleAi('Google AI env chưa được cấu hình');
  }
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

// Safe-assist prompt: the AI is only allowed to touch background, lighting and
// straightening. It must NEVER alter the face/identity — legal requirement for
// ID/passport photos. Cropping/resizing to exact card size is done by Sharp, not here.
function buildSafeAssistPrompt(cardType) {
  const requirements = cardType.yeu_cau ? JSON.stringify(cardType.yeu_cau) : '{}';
  const background = cardType.mau_nen || '#FFFFFF';
  const w = Number(cardType.rong_mm);
  const h = Number(cardType.cao_mm);
  return [
    `You are producing an official ID/passport photo (${cardType.ten}, ${w}x${h} mm, portrait orientation). This is a legal identity document.`,
    'Recompose the supplied photo into a STANDARD head-and-shoulders ID portrait:',
    '- Frame to the head and the top of the shoulders / upper chest ONLY. Remove the full body, crossed arms, waist and legs — do not keep a far/zoomed-out shot.',
    '- The person must be centered horizontally and face straight toward the camera; straighten any head tilt.',
    '- The head (from the top of the hair down to the chin) should fill about 70% of the photo height. Leave a small, even gap of empty background above the hair, and show the tops of the shoulders along the bottom edge.',
    `- Replace the background with a clean, uniform, solid ${background}; remove every object/clutter behind the person.`,
    '- Apply even, neutral, studio-style lighting with correct exposure and white balance. No harsh shadows, glare, vignette, reflections, text, border or watermark.',
    `- Output ONE realistic photograph (not an illustration/cartoon) in portrait aspect ratio ${w}:${h}.`,
    'ABSOLUTE IDENTITY RULE: keep the face 100% faithful to the input. Do NOT beautify, retouch, smooth skin, slim, reshape, change age/weight/expression, or modify eyes/nose/mouth/jaw/ears/eyebrows/hairstyle/glasses/clothing or any facial geometry. You may ONLY change framing/zoom, background and lighting. If a requirement would force altering the face, skip it — preserving identity always wins.',
    `Card requirements JSON (context only, never at the cost of identity): ${requirements}.`
  ].join('\n');
}

function buildQualityCheckPrompt(cardType) {
  const requirements = cardType.yeu_cau ? JSON.stringify(cardType.yeu_cau) : '{}';
  return [
    'You are a strict compliance checker for official ID/passport photos. Analyze the supplied image and report findings ONLY as a single minified JSON object. No markdown, no code fences, no commentary.',
    'Use exactly these keys with boolean/number values:',
    '{"face_detected":true,"face_count":1,"face_centered":true,"face_height_ratio":0.65,"background_uniform":true,"background_matches_required_color":true,"glare_or_strong_shadow":false,"eyes_open":true,"neutral_expression":true,"sufficient_sharpness":true}',
    'face_height_ratio = approximate head/face height divided by total image height (0..1).',
    `Required background color: ${cardType.mau_nen || '#FFFFFF'}. Card type: ${cardType.ten}. Requirements JSON: ${requirements}.`,
    'Respond with JSON only.'
  ].join(' ');
}

function parseJsonLoose(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

// Best-effort AI quality check. Returns structured findings or null on any failure
// (missing key, HTTP error, unparseable output) so deterministic QC can still run.
async function assessQuality({ imageBuffer, mimeType, cardType, model = env.GEMINI_ANALYSIS_MODEL }) {
  if (!env.GEMINI_API_KEY) return null;

  try {
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
            { text: buildQualityCheckPrompt(cardType) },
            {
              inlineData: {
                mimeType: mimeType || 'image/jpeg',
                data: imageBuffer.toString('base64')
              }
            }
          ]
        }],
        generationConfig: { responseModalities: ['TEXT'], temperature: 0 }
      })
    });

    if (!response.ok) return null;

    const payload = await response.json().catch(() => null);
    const text = (payload?.candidates?.[0]?.content?.parts || [])
      .map((part) => part.text || '')
      .join('')
      .trim();

    return parseJsonLoose(text);
  } catch (_error) {
    return null;
  }
}

module.exports = {
  ensureGoogleAiConfigured,
  editImage,
  buildSafeAssistPrompt,
  assessQuality
};
