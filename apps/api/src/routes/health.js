'use strict';
const router = require('express').Router();
const { dbHealthy } = require('../db/pool');
const compute = require('@ai-coach/compute');

router.get('/health', async (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    db: (await dbHealthy()) ? 'connected' : 'unavailable (DSA endpoints still live)',
    compute: { engine: compute.engine },
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
