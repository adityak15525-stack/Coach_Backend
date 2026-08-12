'use strict';
// ============================================================
// LIVE SESSION — WebSocket for frame streaming.
// Client: { type:'frame', exerciseId, sessionId, landmarks:[33x4] }
// Server: { type:'verdict', ...analyzeFrame }
// Frames are processed as fast as they arrive (<50µs each) but
// verdicts are only pushed at a capped rate to keep the UI calm.
// ============================================================
const { WebSocketServer } = require('ws');
const { analyzeFrame } = require('../services/formEngine');
const cues = require('../services/coachCues');
const { verify } = require('jsonwebtoken');
const { env } = require('../config/env');

const VERDICT_RATE = 12; // verdicts/sec max per client

function attachLiveSession(server) {
  const wss = new WebSocketServer({ server, path: '/live-session' });

  wss.on('connection', (ws, req) => {
    // optional JWT via ?token= in the WS URL
    const token = new URL(req.url, 'http://localhost').searchParams.get('token');
    const user = token ? verify(token, env.jwtSecret) : { sub: 'anon' };

    const state = {
      sessionId: `sess-${Date.now()}`,
      frames: 0,
      lastVerdictTs: 0,
      exerciseId: null,
      window: 0,
    };

    const send = (obj) => { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj)); };

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type !== 'frame') return;
        state.frames++;
        if (msg.exerciseId) state.exerciseId = msg.exerciseId;
        if (msg.sessionId) state.sessionId = msg.sessionId;
        if (!state.exerciseId || !msg.landmarks) return;

        const verdict = analyzeFrame({
          exerciseId: state.exerciseId,
          landmarks: msg.landmarks,
          sessionId: state.sessionId,
        });

        // throttle verdict pushes to VERDICT_RATE
        const now = Date.now();
        if (now - state.lastVerdictTs >= 1000 / VERDICT_RATE) {
          state.lastVerdictTs = now;
          send({ type: 'verdict', ...verdict, frames: state.frames });
        }

        // always surface high-severity cues immediately
        if (verdict.verdict === 'severe' || verdict.verdict === 'moderate') {
          cues.enqueue({ text: verdict.advice, severity: verdict.verdict, ref: { exerciseId: state.exerciseId } });
          send({ type: 'cue', cue: cues.peekCue(), pending: cues.pendingCount() });
        }
      } catch {
        send({ type: 'error', message: 'malformed frame' });
      }
    });

    ws.on('close', () => {
      /* session teardown hooks here (flush to MySQL) */
    });

    send({ type: 'connected', sessionId: state.sessionId, verdictsPerSec: VERDICT_RATE });
  });

  return wss;
}

module.exports = { attachLiveSession };
