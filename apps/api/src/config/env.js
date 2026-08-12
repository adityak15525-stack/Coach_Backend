require('dotenv').config();

// Parse a full DB connection string (e.g. TiDB Serverless
// mysql://user:pass@host:4000/db) into individual fields.
function parseDatabaseUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    return {
      host: decodeURIComponent(u.hostname),
      port: u.port ? parseInt(u.port, 10) : 3306,
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: u.pathname.replace(/^\//, ''),
    };
  } catch {
    return null;
  }
}

// Build TLS options for mysql2. TiDB Serverless requires SSL; we use the system
// trust store by default, or a provided CA file (DB_SSL_CA) when supplied.
function buildSslOptions() {
  if (process.env.DB_SSL_CA) {
    const fs = require('fs');
    return { ca: fs.readFileSync(process.env.DB_SSL_CA), rejectUnauthorized: true, minVersion: 'TLSv1.2' };
  }
  return { rejectUnauthorized: true, minVersion: 'TLSv1.2' };
}

const dbUrl = parseDatabaseUrl(process.env.DATABASE_URL);
const dbSslEnabled = process.env.DB_SSL === 'true' || !!dbUrl;

module.exports = {
  env: {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '4000', 10),
    jwtSecret: process.env.JWT_SECRET || (() => { throw new Error('JWT_SECRET is not set in .env'); })(),
    db: {
      host: (dbUrl && dbUrl.host) || process.env.DB_HOST || 'localhost',
      port: (dbUrl && dbUrl.port) || parseInt(process.env.DB_PORT || '3306', 10),
      user: (dbUrl && dbUrl.user) || process.env.DB_USER || 'ai_coach',
      password: (dbUrl && dbUrl.password) || process.env.DB_PASSWORD || 'ai_coach',
      database: process.env.DB_NAME || (dbUrl && dbUrl.database) || 'ai_coach',
      ...(dbSslEnabled ? { ssl: buildSslOptions() } : {}),
    },
    agents: {
      baseUrl: process.env.AGENTS_URL || 'http://localhost:8000',
    },
    genai: {
      openaiKey: process.env.OPENAI_API_KEY,
      geminiKey: process.env.GEMINI_API_KEY,
      geminiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    },
    tts: {
      elevenLabsKey: process.env.ELEVENLABS_API_KEY,
      voiceId: process.env.ELEVENLABS_VOICE_ID || 'oWAxZDx7w5VEj9dCyTzz', // KOKORO — sweet girl voice
      modelId: process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2',
      speed: parseFloat(process.env.ELEVENLABS_SPEED || '0.95'), // natural human pace
    },
    email: {
      // Empty SMTP config → welcome emails are logged (dev mode) instead of sent.
      smtpHost: process.env.SMTP_HOST || '',
      smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
      smtpUser: process.env.SMTP_USER || '',
      smtpPass: process.env.SMTP_PASS || '',
      smtpSecure: String(process.env.SMTP_SECURE || '') === 'true',
      from: process.env.MAIL_FROM || 'Neural Coach <no-reply@neuralcoach.app>',
    },
  },
};
