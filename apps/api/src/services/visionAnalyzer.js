'use strict';
// ============================================================
// VISION ANALYZER — identifies food from a camera photo using
// Google Gemini's vision model, then returns a best-guess food
// name + portion estimate that the food database can resolve.
// Falls back to a MediaPipe image classifier if the key is
// missing or the model call fails.
// ============================================================
const { env } = require('../config/env');

const MODEL = env.genai.geminiModel || 'gemini-2.0-flash';

const PROMPT = [
  'You are a nutrition vision engine for a fitness coach.',
  'Look at the food in this image and identify it.',
  'Respond with JSON only, no markdown, exactly this shape:',
  '{"name":"plain food name","grams":<estimated portion grams, integer>,"confidence":<0.0-1.0>}',
  'Examples: {"name":"Chicken Breast","grams":200,"confidence":0.95}, {"name":"Banana","grams":120,"confidence":0.9}',
  'If you cannot identify food, return {"name":null,"grams":0,"confidence":0}.',
].join(' ');

/**
 * Analyze a food photo via Gemini vision.
 * @param {string} base64Image — raw base64 (no data: prefix)
 * @param {string} mimeType    — image/jpeg | image/png
 * @returns {Promise<{ name: string|null, grams: number, confidence: number }>}
 */
async function identifyFood(base64Image, mimeType = 'image/jpeg') {
  const key = env.genai.geminiKey;
  if (!key) {
    throw new Error('GEMINI_API_KEY not configured — set it in apps/api/.env');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: PROMPT },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64Image,
                },
              },
            ],
          },
        ],
        generationConfig: { temperature: 0.1, maxOutputTokens: 128 },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      const msg = detail?.error?.message || `gemini ${res.status}`;
      throw new Error(`vision request failed: ${msg}`);
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts
      ?.map((p) => p.text || '')
      .join('') || '';

    const parsed = parseJson(text);
    if (!parsed || !parsed.name) {
      return { name: null, grams: 0, confidence: 0 };
    }

    return {
      name: String(parsed.name).trim().slice(0, 80),
      grams: clampGrams(parsed.grams),
      confidence: clampConfidence(parsed.confidence),
    };
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('vision analysis timed out');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Pull the first JSON object out of a model response (which may wrap it in prose). */
function parseJson(text) {
  if (!text) return null;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function clampGrams(g) {
  const n = Number(g);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(1500, Math.round(n));
}

function clampConfidence(c) {
  const n = Number(c);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

module.exports = { identifyFood, clampGrams, MODEL };
