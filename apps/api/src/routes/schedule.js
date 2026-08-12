'use strict';
const router = require('express').Router();
const { optimize } = require('../services/scheduler');

const DEMO_CATALOG = [
  { name: 'Back Squat', muscle: 'quads', sets: 5, timePerSetMin: 3, priority: 1.0, fatigueCost: 8 },
  { name: 'Bench Press', muscle: 'chest', sets: 5, timePerSetMin: 3, priority: 0.9, fatigueCost: 6 },
  { name: 'Deadlift', muscle: 'posterior', sets: 3, timePerSetMin: 4, priority: 1.0, fatigueCost: 10 },
  { name: 'OHP', muscle: 'shoulders', sets: 4, timePerSetMin: 3, priority: 0.7, fatigueCost: 5 },
  { name: 'Barbell Row', muscle: 'back', sets: 4, timePerSetMin: 3, priority: 0.8, fatigueCost: 7 },
  { name: 'Lunges', muscle: 'glutes', sets: 3, timePerSetMin: 2, priority: 0.6, fatigueCost: 5 },
  { name: 'Incline Press', muscle: 'chest', sets: 3, timePerSetMin: 2, priority: 0.5, fatigueCost: 4 },
  { name: 'Pull-up', muscle: 'back', sets: 4, timePerSetMin: 2, priority: 0.7, fatigueCost: 6 },
  { name: 'Hip Thrust', muscle: 'glutes', sets: 4, timePerSetMin: 2, priority: 0.6, fatigueCost: 6 },
  { name: 'Curl', muscle: 'biceps', sets: 3, timePerSetMin: 1.5, priority: 0.3, fatigueCost: 2 },
  { name: 'Lateral Raise', muscle: 'shoulders', sets: 4, timePerSetMin: 1.5, priority: 0.3, fatigueCost: 2 },
  { name: 'Plank', muscle: 'core', sets: 3, timePerSetMin: 1, priority: 0.4, fatigueCost: 3 },
];

// POST /api/schedule/optimize
// body: { catalog?, days?, fatigueOverrides? }
router.post('/schedule/optimize', (req, res) => {
  const { catalog, days, fatigueOverrides } = req.body || {};

  // apply fatigue overrides (e.g. sore quads → higher fatigueCost)
  let blocks = catalog || DEMO_CATALOG;
  if (fatigueOverrides) {
    blocks = blocks.map((b) =>
      fatigueOverrides[b.muscle] ? { ...b, fatigueCost: b.fatigueCost + fatigueOverrides[b.muscle] } : b,
    );
  }

  const result = optimize({ catalog: blocks, days });
  res.json(result);
});

module.exports = router;
