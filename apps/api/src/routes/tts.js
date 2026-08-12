'use strict';
// POST /api/tts/speak — ElevenLabs text-to-speech proxy.
// The API key lives here, on the server; the mobile app never sees it.
// Returns streaming MP3 audio (or a JSON error) for a coaching script.
const router = require('express').Router();
const { env } = require('../config/env');

const ELEVEN_BASE = 'https://api.elevenlabs.io/v1';

// Accepts both POST (JSON body { text }) and GET (?text=) so the mobile app can
// point an <audio> element straight at the endpoint and stream — playback
// starts as soon as the first MP3 frames arrive instead of after the whole file.
router.post('/tts/speak', ttsHandler);
router.get('/tts/speak', (req, res) => {
  req.body = { text: String(req.query.text || '') };
  return ttsHandler(req, res);
});

async function ttsHandler(req, res) {
  const text = String(req.body?.text || '').trim().slice(0, 1200);
  if (!text) return res.status(400).json({ error: 'text is required' });
  if (!env.tts.elevenLabsKey) {
    return res.status(503).json({
      error: 'ELEVENLABS_API_KEY not configured on the server',
      hint: 'Add it to apps/api/.env to enable the voice coach.',
    });
  }

  const url = `${ELEVEN_BASE}/text-to-speech/${env.tts.voiceId}?output_format=mp3_44100_128`;
  const body = {
    text,
    model_id: env.tts.modelId,
    voice_settings: {
      stability: 0.45, // steady but not robotic
      similarity_boost: 0.75,
      style: 0.0,
      use_speaker_boost: true,
    },
    speed: env.tts.speed, // slow, human pace
  };

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': env.tts.elevenLabsKey,
        'content-type': 'application/json',
        accept: 'audio/mpeg',
      },
      body: JSON.stringify(body),
    });

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => '');
      console.error(`[tts] ElevenLabs ${upstream.status}: ${detail.slice(0, 300)}`);
      return res.status(upstream.status).json({ error: 'TTS upstream error', detail: detail.slice(0, 300) });
    }

    res.setHeader('content-type', 'audio/mpeg');
    res.setHeader('cache-control', 'no-store');
    // Stream audio straight through so long scripts don't buffer entirely.
    const reader = upstream.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();
  } catch (err) {
    console.error(`[tts] ${err.message}`);
    if (!res.headersSent) return res.status(500).json({ error: 'TTS request failed' });
    res.end();
  }
}

module.exports = router;
