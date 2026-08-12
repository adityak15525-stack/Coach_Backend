'use strict';
const router = require('express').Router();
const volume = require('../services/volumeTracker');
const { prTimeline } = require('../services/prTimeline');

// GET /api/analytics/volume?from=2026-08-01&to=2026-08-09
router.get('/analytics/volume', (req, res) => {
  const { from, to } = req.query;
  const end = to ? new Date(to) : new Date();
  let start;
  if (from) start = new Date(from);
  else { start = new Date(); start.setDate(start.getDate() - 30); }

  res.json({
    volumeKg: volume.volumeBetween(start, end),
    yearToDateKg: volume.yearToDate(),
    engine: volume.stats().engine,
  });
});

// GET /api/analytics/pr-timeline
router.get('/analytics/pr-timeline', (req, res) => {
  // demo history (production: read workout_sets ordered by date)
  const history = [
    { date: '2026-06-01', weight: 80 }, { date: '2026-06-08', weight: 85 },
    { date: '2026-06-15', weight: 85 }, { date: '2026-06-22', weight: 90 },
    { date: '2026-06-29', weight: 95 }, { date: '2026-07-06', weight: 95 },
    { date: '2026-07-13', weight: 100 }, { date: '2026-07-20', weight: 100 },
    { date: '2026-07-27', weight: 95 }, { date: '2026-08-03', weight: 102.5 },
  ];
  res.json({ timeline: prTimeline(history) });
});

module.exports = router;
