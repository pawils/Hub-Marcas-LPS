// server/utils/logger.js — Logger estructurado ultraligero para Railway
module.exports = {
  info: (msg, meta = {}) => console.log(`[INFO] ${msg}`, Object.keys(meta).length ? JSON.stringify(meta) : ''),
  warn: (msg, meta = {}) => console.warn(`[WARN] ${msg}`, Object.keys(meta).length ? JSON.stringify(meta) : ''),
  error: (msg, meta = {}) => console.error(`[ERROR] ${msg}`, Object.keys(meta).length ? JSON.stringify(meta) : '')
};
