'use strict';
const jwt = require('jsonwebtoken');
const { env } = require('../config/env');

// Attach req.user if a valid Bearer token is present (optional-auth).
function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(header.slice(7), env.jwtSecret);
    } catch {
      // fall through as anonymous
    }
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'authentication required' });
  next();
}

module.exports = { optionalAuth, requireAuth };
