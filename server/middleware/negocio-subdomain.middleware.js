// server/middleware/negocio-subdomain.middleware.js
// Enrutador Multi-Tenant por Subdominio (Hub Aliados Los Pilares 2026)
//
// Seguridad Zero-Trust:
// 1. Valida estrictamente el subdominio con /^[a-z0-9-]+$/ (bloquea Path Traversal y caracteres especiales).
// 2. Excluye subdominios reservados del ecosistema principal ('www', 'aula', 'api', 'admin').
// 3. Verifica con path.resolve() que cualquier archivo servido pertenezca estrictamente a la
//    carpeta pública de ese negocio (contención de directorio contra ataques ../).

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
        .replace(/:\d+$/, ''); // quitar puerto si existe

    if (!rawHost.endsWith('.lospilares.pe')) return null;

    const sub = rawHost.slice(0, -'.lospilares.pe'.length);
    if (!sub || sub.includes('.') || RESERVED_SUBDOMAINS.has(sub)) return null;
    if (!VALID_SLUG_REGEX.test(sub)) return null;

    return sub;
}

function negocioSubdomainMiddleware(req, res, next) {
    const tenantSlug = extractSubdomainSlug(req);
    if (!tenantSlug) return next();

    // No reescribir llamadas a /api/, /imagenes/, /js/vendor/ o rutas ya prefijadas con /<tenantSlug>
    if (
        req.path.startsWith('/api/') ||
        req.path.startsWith('/imagenes/') ||
        req.path.startsWith('/js/vendor/') ||
        req.path.startsWith('/css/') ||
        req.path === `/${tenantSlug}` ||
        req.path.startsWith(`/${tenantSlug}/`)
    ) {
        req.tenantSubdomain = tenantSlug;
        return next();
    }

    // Soportar tanto public/aliados/<slug> como public/<slug> (ej. public/artesanitas)
    const candidateDirs = [
        path.resolve(PUBLIC_DIR, 'aliados', tenantSlug),
        path.resolve(PUBLIC_DIR, tenantSlug)
    ];

    const tenantDir = candidateDirs.find((dir) => {
        return dir.startsWith(PUBLIC_DIR + path.sep) && fs.existsSync(dir) && fs.statSync(dir).isDirectory();
    });

    if (!tenantDir) return next();

    // Contención estricta contra Path Traversal
    const relativePrefix = tenantDir.slice(PUBLIC_DIR.length).replace(/\\/g, '/'); // ej. "/artesanitas"
    const cleanReqPath = req.path === '/' ? '/index.html' : req.path;
    const targetCandidate = path.resolve(tenantDir, '.' + cleanReqPath);

    if (!targetCandidate.startsWith(tenantDir)) {
        return res.status(400).send('Solicitud inválida.');
    }

    req.tenantSubdomain = tenantSlug;
    const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    req.url = `${relativePrefix}${req.path === '/' ? '/' : req.path}${query}`;
    next();
}

module.exports = { negocioSubdomainMiddleware, extractSubdomainSlug, VALID_SLUG_REGEX };
