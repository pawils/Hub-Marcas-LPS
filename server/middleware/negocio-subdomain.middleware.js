// server/middleware/negocio-subdomain.middleware.js
// Enrutador Multi-Tenant por Subdominio (Hub Aliados Los Pilares 2026)
//
// Arquitectura 100% Encapsulada por Marca:
// Cada marca vive íntegramente dentro de public/<slug>/ (incluyendo su propio html, js/, imagenes/, css/).
// En public/ SOLO existen carpetas de marcas (ej. public/artesanitas, public/latiendacafe).

const path = require('path');
const fs = require('fs');

const PUBLIC_DIR = path.resolve(__dirname, '../../public');
const RESERVED_SUBDOMAINS = new Set(['www', 'aula', 'api', 'admin', 'mail', 'ftp', 'lospilares']);
const VALID_SLUG_REGEX = /^[a-z0-9-]{2,60}$/;

function extractSubdomainSlug(req) {
  const rawHost = (req.headers['x-forwarded-host'] || req.hostname || req.headers.host || '')
    .toString()
    .split(',')[0]
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, '');

  if (!rawHost.endsWith('.lospilares.pe')) return null;

  const sub = rawHost.slice(0, -'.lospilares.pe'.length);
  if (!sub || sub.includes('.') || RESERVED_SUBDOMAINS.has(sub)) return null;
  if (!VALID_SLUG_REGEX.test(sub)) return null;

  return sub;
}

function negocioSubdomainMiddleware(req, res, next) {
  const tenantSlug = extractSubdomainSlug(req);
  if (!tenantSlug) return next();

  // No reescribir llamadas a /api/ o rutas que ya vienen prefijadas con /<tenantSlug>/
  if (
    req.path.startsWith('/api/') ||
    req.path === `/${tenantSlug}` ||
    req.path.startsWith(`/${tenantSlug}/`)
  ) {
    req.tenantSubdomain = tenantSlug;
    return next();
  }

  const tenantDir = path.resolve(PUBLIC_DIR, tenantSlug);
  if (!tenantDir.startsWith(PUBLIC_DIR + path.sep) || !fs.existsSync(tenantDir) || !fs.statSync(tenantDir).isDirectory()) {
    return next();
  }

  // Contención estricta contra Path Traversal
  const cleanReqPath = req.path === '/' ? '/index.html' : req.path;
  const targetCandidate = path.resolve(tenantDir, '.' + cleanReqPath);

  if (!targetCandidate.startsWith(tenantDir)) {
    return res.status(400).send('Solicitud inválida.');
  }

  req.tenantSubdomain = tenantSlug;
  const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  req.url = `/${tenantSlug}${req.path === '/' ? '/' : req.path}${query}`;
  next();
}

module.exports = { negocioSubdomainMiddleware, extractSubdomainSlug, VALID_SLUG_REGEX };
