// server/utils/security.js
// Utilidades compartidas de seguridad para Hub Marcas LPS (Artesanitas, lospilares.pe y futuras marcas)
const crypto = require('crypto');

const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif'
]);

const DEFAULT_ALLOWED_ORIGINS = [
  'https://artesanitas.lospilares.pe',
  'https://www.artesanitas.lospilares.pe',
  'https://lospilares.pe',
  'https://www.lospilares.pe',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

function isSafeImageMime(mime) {
  const normalized = String(mime || '').toLowerCase().split(';')[0].trim();
  return ALLOWED_IMAGE_MIMES.has(normalized);
}

function safeTimingEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length === 0 || bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function isAllowedCorsOrigin(origin) {
  if (!origin) return true;
  const cleanOrigin = String(origin).trim();

  if (process.env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(cleanOrigin)) {
    return true;
  }

  const extraOrigins = String(process.env.CORS_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  const allowedSet = new Set([...DEFAULT_ALLOWED_ORIGINS, ...extraOrigins]);
  return allowedSet.has(cleanOrigin);
}

function setSafeBinaryHeaders(res, mimeType) {
  const safeType = isSafeImageMime(mimeType)
    ? String(mimeType).toLowerCase().split(';')[0].trim()
    : 'application/octet-stream';
  res.setHeader('Content-Type', safeType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
}

module.exports = {
  ALLOWED_IMAGE_MIMES,
  isSafeImageMime,
  safeTimingEqual,
  isAllowedCorsOrigin,
  setSafeBinaryHeaders
};
