'use strict';
// ============================================================
// MAILER — email validation + first-run welcome email.
//  - format regex (RFC 5322-ish)
//  - MX-record check so `foo@definitely-not-a-domain.xyz` is
//    rejected before we ever send (or fire the greeting)
//  - nodemailer send, with a console fallback in dev when no
//    SMTP is configured, so the flow never hard-fails locally.
// ============================================================
const dns = require('dns').promises;
const nodemailer = require('nodemailer');
const { env } = require('../config/env');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Quick syntactic check first (sync, cheap). */
function isValidEmailFormat(email) {
  return typeof email === 'string' && EMAIL_RE.test(email.trim());
}

const mxCache = new Map(); // domain → true/false (TTL 10 min)

/** DNS MX lookup — does the domain accept mail at all? */
async function hasMxRecord(domain) {
  if (mxCache.has(domain)) return mxCache.get(domain);
  let ok = false;
  try {
    const mx = await dns.resolveMx(domain);
    ok = Array.isArray(mx) && mx.length > 0;
  } catch {
    ok = false;
  }
  mxCache.set(domain, ok);
  setTimeout(() => mxCache.delete(domain), 10 * 60 * 1000).unref?.();
  return ok;
}

/**
 * Full validation: format + deliverability (MX). Throws with a
 * human message if invalid. Returns the trimmed lowercased email.
 */
async function validateEmail(email) {
  const clean = String(email || '').trim().toLowerCase();
  if (!isValidEmailFormat(clean)) {
    const err = new Error('invalid email address');
    err.code = 'EINVAL_EMAIL';
    throw err;
  }
  const domain = clean.split('@')[1];
  if (!(await hasMxRecord(domain))) {
    const err = new Error(`email domain ${domain} does not accept mail`);
    err.code = 'EINVAL_EMAIL';
    throw err;
  }
  return clean;
}

async function createTransporter() {
  const { smtpHost, smtpPort, smtpUser, smtpPass, smtpSecure } = env.email;
  if (!smtpHost) return null; // dev mode → log instead
  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: smtpUser ? { user: smtpUser, pass: smtpPass } : undefined,
  });
}

/**
 * Send the first-run welcome email to a freshly-registered user.
 * Never throws — logs loudly on failure so registration still succeeds.
 */
async function sendWelcomeEmail(to, displayName) {
  const subject = 'Welcome to Neural Coach ⚡ your form engine is armed';
  const html = `
    <div style="font-family:system-ui,sans-serif;background:#05050A;padding:32px;color:#E8EEFF">
      <div style="max-width:520px;margin:0 auto;border:1px solid rgba(34,211,238,.25);border-radius:16px;padding:32px">
        <h1 style="color:#22D3EE;margin:0 0 8px;letter-spacing:2px">NEURAL COACH</h1>
        <p style="color:#8A93B2;margin:0 0 24px">Hyper-adaptive lifting &amp; form coach</p>
        <h2 style="margin:0 0 12px">Welcome aboard, ${displayName} 🔥</h2>
        <p style="line-height:1.7">Your account is live. The KD-Tree form engine is calibrated,
        your dynamic split is compiling, and the agent swarm is standing by.</p>
        <p style="line-height:1.7;margin-top:8px">Next steps:
          1) Explore the 3D form library,
          2) Enter the simulation,
          3) Let the neural voice coach guide your first session.</p>
        <div style="margin-top:24px;padding-top:16px;border-top:1px solid rgba(34,211,238,.2);color:#8A93B2;font-size:12px">
          See you in the gym — NEURAL COACH
        </div>
      </div>
    </div>`;
  const text = `Welcome to Neural Coach, ${displayName}! Your account is live. ` +
    `Explore the 3D form library, enter the simulation, and let the neural voice coach guide your first session.`;

  try {
    const transporter = await createTransporter();
    if (!transporter) {
      console.log(`[mailer] (dev) welcome email → ${to}\n  subject: ${subject}\n  ${text}`);
      return { sent: false, mode: 'logged' };
    }
    await transporter.sendMail({ from: env.email.from, to, subject, html, text });
    return { sent: true, mode: 'smtp' };
  } catch (err) {
    console.error(`[mailer] welcome email failed for ${to}: ${err.message}`);
    return { sent: false, mode: 'error', error: err.message };
  }
}

module.exports = { validateEmail, sendWelcomeEmail, isValidEmailFormat };
