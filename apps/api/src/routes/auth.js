'use strict';
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../db/pool');
const { env } = require('../config/env');
const { validateEmail, sendWelcomeEmail } = require('../services/mailer');
const { authLimiter } = require('../utils/rateLimiter');

function sign(user, expiresIn = '15m') {
  return jwt.sign({ sub: user.id, name: user.display_name, email: user.email }, env.jwtSecret, { expiresIn });
}

function signRefreshToken(user) {
  return jwt.sign({ sub: user.id }, env.jwtSecret, { expiresIn: '7d' });
}

function publicUser(u) {
  return { id: u.id, email: u.email, display_name: u.display_name, created_at: u.created_at };
}

// The neural voice coach greets a brand-new athlete on the phone.
function greetingScript(displayName) {
  return `Welcome to Neural Coach, ${displayName}. Your form engine is calibrated and your split is compiling. Let's build something strong.`;
}

// POST /api/auth/register
router.post('/auth/register', authLimiter, async (req, res, next) => {
  try {
    const { email, password, displayName } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });

    // 1) validate the address before doing anything else
    let clean;
    try {
      clean = await validateEmail(email);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
    if (String(password).length < 6) return res.status(400).json({ error: 'password must be at least 6 characters' });

    const hash = await bcrypt.hash(password, 10);
    const name = (displayName || clean.split('@')[0]).slice(0, 80);
    let result;
    try {
      result = await query(
        'INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)',
        [clean, hash, name],
      );
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'email already registered' });
      if (err.code === 'ECONNREFUSED') return res.status(503).json({ error: 'database offline' });
      throw err;
    }

    const user = { id: result.insertId, email: clean, display_name: name, created_at: new Date() };

    // 2) fire the first-run welcome email (never blocks registration)
    // Retry once if the first attempt fails to ensure delivery
    sendWelcomeEmail(clean, name).catch(err => {
      console.error('Welcome email failed, retrying once:', err);
      setTimeout(() => sendWelcomeEmail(clean, name).catch(() => {}), 5000);
    });

    // 3) hand back tokens + a voice-greeting script the app can speak
    res.status(201).json({
      token: sign(user, '15m'),
      refreshToken: signRefreshToken(user),
      user: publicUser(user),
      greeting: greetingScript(name.split(' ')[0] || name),
    });
  } catch (err) {
    if (err.code === 'ECONNREFUSED') return res.status(503).json({ error: 'database offline' });
    next(err);
  }
});

// POST /api/auth/login
router.post('/auth/login', authLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email).trim())) {
      return res.status(400).json({ error: 'invalid email address' });
    }

    const rows = await query('SELECT * FROM users WHERE email = ?', [String(email).trim().toLowerCase()]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'invalid credentials' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'invalid credentials' });

    res.json({
      token: sign(user, '15m'),
      refreshToken: signRefreshToken(user),
      user: publicUser(user)
    });
  } catch (err) {
    if (err.code === 'ECONNREFUSED') return res.status(503).json({ error: 'database offline' });
    next(err);
  }
});

// GET /api/auth/me — token sanity check (used to hydrate the app on boot)
router.get('/auth/me', async (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'not authenticated' });
  try {
    const rows = await query('SELECT id, email, display_name, created_at FROM users WHERE id = ?', [req.user.sub]);
    if (!rows[0]) return res.status(401).json({ error: 'not authenticated' });
    res.json({ user: publicUser(rows[0]) });
  } catch (err) {
    if (err.code === 'ECONNREFUSED') return res.status(503).json({ error: 'database offline' });
    next(err);
  }
});

module.exports = router;
