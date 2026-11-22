// server/db.config.js — Pool PostgreSQL con autodetección SSL / Red Privada Railway
const { Pool } = require('pg');
require('dotenv').config();

process.env.TZ = 'America/Lima';

const connStr = process.env.DATABASE_URL || '';
const isLocal = connStr.includes('localhost') || connStr.includes('127.0.0.1');

function createPool(useSsl) {
  return new Pool({
    connectionString: connStr,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  });
}

let activePool = createPool(!isLocal);
let fallbackPool = null;

activePool.on('error', (err) => {
  console.error('[DB Pool Error]', err.message);
});

async function query(text, params) {
  try {
    return await activePool.query(text, params);
  } catch (err) {
    // Si el contenedor Postgres interno de Railway (.railway.internal) no tiene SSL habilitado,
    // conmuta automáticamente a conexión directa sin SSL sin tumbar el servidor.
    if (err && /does not support SSL|SSL off|no pg_hba\.conf/i.test(err.message || '') && !fallbackPool) {
      console.warn('[DB Pool] Conmutando automáticamente a conexión interna Railway sin SSL...');
      fallbackPool = createPool(false);
      fallbackPool.on('error', (e) => console.error('[DB Fallback Pool Error]', e.message));
      activePool = fallbackPool;
      return await activePool.query(text, params);
    }
    throw err;
  }
}

module.exports = {
  query,
  connect: () => activePool.connect(),
  get pool() {
    return activePool;
  }
};
