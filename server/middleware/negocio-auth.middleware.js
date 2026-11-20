// server/middleware/negocio-auth.middleware.js
// Auth compartida entre TODOS los sub-sistemas de negocios invitados (talleres,
// productos, y los que vengan después) -- login usuario/contraseña propio
// (tabla negocio_usuarios), independiente del admin-panel y del sistema de
// auth del club. Extraído de negocio-talleres.routes.js (que fue el primero
// en implementarlo) para que negocio-productos.routes.js use exactamente la
// misma lógica en vez de una copia que se puede desalinear con el tiempo.
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../db.config');
const logger = require('../utils/logger');

// Secreto derivado del JWT_SECRET del club pero distinto -- así un token de este
// sistema nunca es válido en las rutas del club (o viceversa) aunque compartan
// la misma env var de origen (no requiere una nueva variable en Railway).
const NEGOCIOS_JWT_SECRET = crypto.createHash('sha256').update(`${process.env.JWT_SECRET}:negocios`).digest('hex');
const TOKEN_EXPIRES_IN = '12h';
const VALID_SLUG_REGEX = /^[a-z0-9-]{2,60}$/;

// Obtiene las credenciales de Mercado Pago EXCLUSIVAS del negocio aliado.
// NUNCA usa process.env.MP_ACCESS_TOKEN de Los Pilares para evitar mezclar cuentas/fondos.
function getNegocioMpCredentials(negocio) {
    if (!negocio || !negocio.slug) return { enabled: false, accessToken: null, publicKey: null, webhookSecret: null, descriptor: null };
    const envSuffix = negocio.slug.toUpperCase().replace(/[^A-Z0-9]/g, '_');
    const accessToken = negocio.mp_access_token || process.env[`MP_ACCESS_TOKEN_${envSuffix}`] || null;
    const publicKey = negocio.mp_public_key || process.env[`MP_PUBLIC_KEY_${envSuffix}`] || null;
    const webhookSecret = negocio.mp_webhook_secret || process.env[`MP_WEBHOOK_SECRET_${envSuffix}`] || null;
    const descriptor = (negocio.mp_descriptor || negocio.nombre || 'TIENDA ALIADA').slice(0, 13).toUpperCase();
    return {
        enabled: Boolean(accessToken),
        accessToken,
        publicKey,
        webhookSecret,
        descriptor
    };
}

// Resuelve :negocioSlug una sola vez por request y lo cuelga en req.negocio.
// Se registra con router.param('negocioSlug', ...) en cada router que lo use
// (Express no comparte params handlers entre routers distintos).
async function resolveNegocioSlug(req, res, next, slug) {
    const cleanSlug = String(slug || '').trim().toLowerCase();
    if (!VALID_SLUG_REGEX.test(cleanSlug)) {
        return res.status(400).json({ success: false, message: 'Identificador de negocio inválido.' });
    }
    try {
        const { rows } = await pool.query(
            `SELECT id, slug, nombre, email_notif, meta_pixel_id,
                    plan_tier, subdominio, whatsapp_contacto,
                    mp_public_key, mp_access_token, mp_webhook_secret, mp_descriptor
             FROM negocios WHERE slug = $1 AND activo = TRUE`,
            [cleanSlug]
        );
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Negocio no encontrado.' });
        }
        req.negocio = rows[0];
        next();
    } catch (error) {
        logger.error('Negocios: error cargando negocio', { error: error.message, slug: cleanSlug });
        res.status(500).json({ success: false, message: 'Error interno.' });
    }
}

// Requiere sesión válida (login usuario/contraseña). superadmin entra a cualquier
// negocio; una cuenta 'negocio' solo entra al suyo (negocioId debe coincidir con
// req.negocio.id, resuelto por resolveNegocioSlug arriba).
function requireNegocioAuth(req, res, next) {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
        return res.status(401).json({ success: false, message: 'No autenticado.' });
    }
    try {
        const payload = jwt.verify(token, NEGOCIOS_JWT_SECRET);
        if (payload.role !== 'superadmin' && payload.negocioId !== req.negocio.id) {
            return res.status(403).json({ success: false, message: 'No autorizado para este negocio.' });
        }
        req.negocioUser = payload;
        next();
    } catch {
        return res.status(401).json({ success: false, message: 'Sesión inválida o expirada.' });
    }
}

module.exports = { NEGOCIOS_JWT_SECRET, TOKEN_EXPIRES_IN, resolveNegocioSlug, requireNegocioAuth, getNegocioMpCredentials };
