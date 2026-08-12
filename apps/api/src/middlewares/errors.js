'use strict';
const { dbHealthy } = require('../db/pool');
const { env } = require('../config/env');

// Global error handler + small request logger.
function notFound(req, res) {
  res.status(404).json({ error: 'not found', path: req.path });
}

function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  if (status >= 500) console.error(`[api] ${err.message}\n${err.stack || ''}`);
  res.status(status).json({ error: err.message || 'internal error' });
}

module.exports = { notFound, errorHandler };
