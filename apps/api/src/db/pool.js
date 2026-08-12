'use strict';
const mysql = require('mysql2/promise');
const { env } = require('../config/env');

let pool = null;
let dbReady = null;

// On first use, make sure the target database exists (fresh TiDB Serverless or
// a brand-new MariaDB). Best-effort: if it fails we still try to bring the pool
// up so compute/DSA endpoints stay available.
function ensureDatabase() {
  if (dbReady) return dbReady;
  dbReady = (async () => {
    const admin = await mysql.createConnection({
      host: env.db.host,
      port: env.db.port,
      user: env.db.user,
      password: env.db.password,
      ssl: env.db.ssl,
      connectTimeout: 10000,
    });
    try {
      await admin.query(`CREATE DATABASE IF NOT EXISTS \`${env.db.database}\``);
    } finally {
      await admin.end();
    }
  })();
  return dbReady;
}

// Lazily-created pool so the API boots even if MySQL is down (DSA
// endpoints are pure compute and stay up).
async function getPool() {
  if (pool) return pool;
  await ensureDatabase().catch(() => {});
  pool = mysql.createPool({
    ...env.db,
    connectTimeout: 10000,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4',
  });
  return pool;
}

async function query(sql, params = []) {
  const p = await getPool();
  const [rows] = await p.execute(sql, params);
  return rows;
}

async function dbHealthy() {
  try {
    const p = await getPool();
    const [rows] = await p.query('SELECT 1 AS ok');
    return rows[0]?.ok === 1;
  } catch {
    return false;
  }
}

module.exports = { getPool, query, dbHealthy };
