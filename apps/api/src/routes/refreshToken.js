'use strict';
const router = require('express').Router();
const jwt = require('jsonwebtoken');
const { query } = require('../db/pool');
const { env } = require('../config/env');
const { authLimiter } = require('../utils/rateLimiter');

// POST /api/auth/refresh
router.post('/auth/refresh', authLimiter, async (req, res, next) => {
  try {
    const { refreshToken } = req.body || {};
    if (!refreshToken) return res.status(400).json({ error: 'refreshToken required' });

    let payload;
    try {
      payload = jwt.verify(refreshToken, env.jwtSecret);
    } catch (err) {
      return res.status(401).json({ error: 'invalid refresh token' });
    }

    const rows = await query('SELECT id, email, display_name, created_at FROM users WHERE id = ?', [payload.sub]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'user not found' });

    res.json({
      token: jwt.sign({ sub: user.id, name: user.display_name, email: user.email }, env.jwtSecret, { expiresIn: '15m' }),
      refreshToken: signRefreshToken(user),
    });
  } catch (err) {
    next(err);
  }
});

function signRefreshToken(user) {
  return jwt.sign({ sub: user.id }, env.jwtSecret, { expiresIn: '7d' });
}

module.exports = router;