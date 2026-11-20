// server/db.config.js — Pool PostgreSQL optimizado para Railway Hobby Plan (bajo consumo RAM)
const { Pool } = require('pg');
require('dotenv').config();

const isLocal = (process.env.DATABASE_URL || '').includes('localhost') || (process.env.DATABASE_URL || '').includes('127.0.0.1');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false },
  max: 8,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

pool.on('error', (err) => {
  console.error('[DB Pool Error]', err.message);
});

module.exports = pool;
