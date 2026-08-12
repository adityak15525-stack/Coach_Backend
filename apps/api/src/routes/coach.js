'use strict';
const router = require('express').Router();
const cues = require('../services/coachCues');

// GET /api/coach/next-cue — the highest-criticality cue waiting to be spoken
router.get('/coach/next-cue', (req, res) => {
  res.json({
    cue: cues.nextCue(),
    pending: cues.pendingCount(),
  });
});

// GET /api/coach/cue-queue — full state (for debugging / UI overlays)
router.get('/coach/cue-queue', (req, res) => {
  res.json({ pending: cues.pendingCount(), history: cues.history.slice(-20) });
});

module.exports = router;
