'use strict';
const router = require('express').Router();
const { analyzeFrame } = require('../services/formEngine');
const { enqueue } = require('../services/coachCues');

// POST /api/form/analyze
// body: { exerciseId, landmarks: [[x,y,z,v] x 33], sessionId? }
router.post('/form/analyze', (req, res) => {
  const { exerciseId, landmarks, sessionId } = req.body || {};
  if (!exerciseId || !Array.isArray(landmarks) || !landmarks.length) {
    return res.status(400).json({ error: 'exerciseId and landmarks[] required' });
  }
  const verdict = analyzeFrame({ exerciseId, landmarks, sessionId: sessionId || 'anon' });

  // any deviation escalates into a queued coaching cue
  if (verdict.verdict !== 'perfect') {
    enqueue({ text: verdict.advice, severity: verdict.verdict, ref: { exerciseId, sessionId } });
  }

  res.json({
    ...verdict,
    engine: 'kd-tree-nns',
    latencyHint: 'sub-50µs per frame natively',
  });
});

module.exports = router;
