// server/utils/meta-capi.service.js
// Sprint 4 (Punto 2): Meta Conversions API (CAPI Server-Side) con deduplicación event_id
const crypto = require('crypto');
const logger = require('./logger');

function sha256Norm(val) {
    if (!val) return null;
    const clean = String(val).trim().toLowerCase();
    if (!clean) return null;
    return crypto.createHash('sha256').update(clean).digest('hex');
}

function normalizePhonePe(whatsapp) {
    const digits = String(whatsapp || '').replace(/\D/g, '');
    if (!digits) return null;
    const withCountry = digits.startsWith('51') && digits.length >= 11 ? digits : `51${digits}`;
    return crypto.createHash('sha256').update(withCountry).digest('hex');
}

/**
 * Envía el evento Purchase y Lead a Meta Conversions API (Graph API v21.0)
 * usando el mismo event_id (codigo_pedido) que recibe el navegador para deduplicación 1:1.
 */
async function sendMetaCapiOrderEvent({ negocio, pedido, req, montoEvento }) {
    const eventId = pedido.codigo_pedido || `ART-${pedido.id}-${Date.now()}`;
    const pixelId = (negocio && negocio.meta_pixel_id) || process.env.META_PIXEL_ID || '851775257895823';
    const capiToken = (negocio && negocio.meta_capi_token) || process.env.META_CAPI_TOKEN;

    if (!capiToken || !pixelId) {
        return { sent: false, eventId, reason: 'no_capi_token_configured' };
    }

    try {
        const parts = String(pedido.nombre || '').trim().split(/\s+/);
        const firstName = parts[0] || '';
        const lastName = parts.slice(1).join(' ') || '';

        const clientIp = (req && (req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip)) || undefined;
        const userAgent = (req && req.headers['user-agent']) || undefined;
        const fbp = (req && req.body && req.body.fbp) || undefined;
        const fbc = (req && req.body && req.body.fbc) || undefined;

        const userData = {
            ph: [normalizePhonePe(pedido.whatsapp)].filter(Boolean),
            fn: [sha256Norm(firstName)].filter(Boolean),
            ln: [sha256Norm(lastName)].filter(Boolean),
            country: [sha256Norm('pe')],
            external_id: [sha256Norm(pedido.dni || pedido.codigo_pedido)].filter(Boolean)
        };
        if (clientIp) userData.client_ip_address = clientIp;
        if (userAgent) userData.client_user_agent = userAgent;
        if (fbp) userData.fbp = fbp;
        if (fbc) userData.fbc = fbc;

        const items = Array.isArray(pedido.items) ? pedido.items : [];
        const contentIds = items.length > 0 ? items.map(i => i.slug) : [pedido.producto_slug || 'artesanitas-pieza'];

        const payload = {
            data: [
                {
                    event_name: 'Purchase',
                    event_time: Math.floor(Date.now() / 1000),
                    event_id: eventId,
                    action_source: 'website',
                    event_source_url: req ? `${req.protocol}://${req.get('host')}/pedido` : 'https://artesanitas.lospilares.pe/pedido',
                    user_data: userData,
                    custom_data: {
                        currency: 'PEN',
                        value: Number(montoEvento || pedido.monto_reserva || 20.00),
                        order_id: pedido.codigo_pedido,
                        content_type: 'product',
                        content_ids: contentIds,
                        content_name: pedido.producto_nombre,
                        num_items: Number(pedido.cantidad || 1)
                    }
                }
            ]
        };

        const url = `https://graph.facebook.com/v21.0/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(capiToken)}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const resJson = await response.json().catch(() => ({}));
        if (!response.ok) {
            logger.warn('Meta CAPI: respuesta no exitosa de Graph API', { status: response.status, error: resJson });
            return { sent: false, eventId, status: response.status };
        }

        logger.info('Meta CAPI: evento Purchase enviado con éxito', { eventId, pixelId });
        return { sent: true, eventId, response: resJson };
    } catch (err) {
        logger.error('Meta CAPI: error enviando evento server-side', { error: err.message });
        return { sent: false, eventId, error: err.message };
    }
}

module.exports = { sendMetaCapiOrderEvent };
