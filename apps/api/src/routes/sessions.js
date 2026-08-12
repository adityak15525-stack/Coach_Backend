'use strict';
const router = require('express').Router();
const { autoDeps, buildDayOrder } = require('../services/sessionBuilder');
const volume = require('../services/volumeTracker');
const { runSwarm } = require('../services/agentOrchestrator');

const SAMPLE_PROGRAM = [
  { id: 'w1', name: 'Treadmill Warm-up', muscle: 'whole', kind: 'warmup' },
  { id: 'squat', name: 'Back Squat', muscle: 'quads', kind: 'compound' },
  { id: 'bench', name: 'Bench Press', muscle: 'chest', kind: 'compound' },
  { id: 'row', name: 'Barbell Row', muscle: 'back', kind: 'compound' },
  { id: 'iso-chest', name: 'Chest Fly', muscle: 'chest', kind: 'isolation' },
  { id: 'iso-quads', name: 'Bulgarian Split Squat', muscle: 'quads', kind: 'isolation' },
  { id: 'core', name: 'Plank', muscle: 'core', kind: 'isolation' },
];

// POST /api/sessions/build — order today's exercises (topological sort)
router.post('/sessions/build', (req, res) => {
  const program = req.body?.program || SAMPLE_PROGRAM;
  try {
    const ordered = buildDayOrder(autoDeps(program));
    res.json({ order: ordered.map(({ id, name, muscle }) => ({ id, name, muscle })) });
  } catch (err) {
    res.status(422).json({ error: err.message });
  }
});

// POST /api/sessions/:id/complete — log volume, fire the agent swarm
router.post('/sessions/:id/complete', async (req, res) => {
  const { id } = req.params;
  const { volumeKg = 2000, kcalBurned = 420, formVerdict = { verdict: 'good', deviations: [] } } = req.body || {};

  volume.recordVolume(volumeKg); // Fenwick update O(log n)

  const swarm = await runSwarm({
    userId: req.user?.sub || 'demo-user',
    kcalBurned,
    formVerdict,
    date: new Date().toISOString().slice(0, 10),
  });

  res.json({
    sessionId: id,
    volumeKg,
    kcalBurned,
    swarm,
    agentSource: swarm.source,
  });
});

module.exports = router;
