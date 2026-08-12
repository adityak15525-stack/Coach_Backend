'use strict';
// GET /api/catalog/exercises — the 3D form library (every muscle task).
const router = require('express').Router();
const { CATALOG, MUSCLE_GROUPS } = require('../services/exerciseCatalog');

router.get('/catalog/exercises', (req, res) => {
  res.json({ muscleGroups: MUSCLE_GROUPS, total: CATALOG.length });
});

module.exports = router;
