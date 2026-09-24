import { Client, handle_file } from '@gradio/client';

const SPACE_ID = process.env.HF_SPACE_ID || 'yisol/IDM-VTON';
const HF_TOKEN = process.env.HF_TOKEN || undefined;
const MAX_DATA_URL_CHARS = 4_000_000;

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.end(JSON.stringify(body));
}

function parseDataUrl(value) {
  if (typeof value !== 'string' || !value.startsWith('data:image/')) {
    throw new Error('Expected an image data URL.');
  }
  if (value.length > MAX_DATA_URL_CHARS) {
    throw new Error('Image is too large. Capture a smaller frame or use a smaller garment image.');
  }
  const match = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) throw new Error('Invalid image data URL.');
  return Buffer.from(match[2], 'base64');
}

function isHttpUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

function findResultUrl(value) {
  if (!value) return null;
  if (typeof value === 'string') return isHttpUrl(value) ? value : null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findResultUrl(item);
      if (found) return found;
    }
    return null;
  }
  if (typeof value === 'object') {
    for (const key of ['url', 'image', 'path']) {
      if (typeof value[key] === 'string' && isHttpUrl(value[key])) return value[key];
    }
    for (const child of Object.values(value)) {
      const found = findResultUrl(child);
      if (found) return found;
    }
  }
  return null;
}

function normalizeBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, 204, {});
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed.' });

  try {
    const payload = normalizeBody(req);
    const { personImage, garmentImage, garmentDescription, garmentType } = payload;

    if (typeof personImage !== 'string') throw new Error('personImage is required.');
    if (!(typeof garmentImage === 'string' && (garmentImage.startsWith('data:image/') || isHttpUrl(garmentImage)))) {
      throw new Error('garmentImage must be an image data URL or http(s) URL.');
    }

    const personFile = handle_file(parseDataUrl(personImage));
    const garmentFile = garmentImage.startsWith('data:image/')
      ? handle_file(parseDataUrl(garmentImage))
      : handle_file(garmentImage);

    const client = await Client.connect(
      SPACE_ID,
      HF_TOKEN ? { token: HF_TOKEN } : undefined
    );

    const result = await client.predict('/tryon', [
      { background: personFile, layers: [], composite: null },
      garmentFile,
      String(garmentDescription || 'a fashion garment'),
      true,
      false,
      30,
      42
    ]);

    const resultUrl = findResultUrl(result?.data);
    if (!resultUrl) {
      return json(res, 502, {
        error: 'IDM-VTON returned no result image.',
        provider: SPACE_ID
      });
    }

    return json(res, 200, {
      ok: true,
      resultUrl,
      provider: SPACE_ID,
      garmentType: garmentType || 'top'
    });
  } catch (error) {
    console.error('VTON error:', error);
    return json(res, 502, {
      error: `IDM-VTON backend error: ${error?.message || 'Unknown upstream error.'}`,
      provider: SPACE_ID
    });
  }
}
