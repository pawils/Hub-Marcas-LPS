// server/utils/web-push.service.js
// Sprint 6 (Punto 4): Servicio de Suscripciones y Notificaciones Web Push (Admin y Comprador)
const pool = require('../db.config');
const logger = require('./logger');

function getVapidPublicKey() {
    return process.env.VAPID_PUBLIC_KEY || 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
}

async function savePushSubscription({ negocioId, rol = 'comprador', codigoPedido = null, subscription, userAgent = '' }) {
    if (!subscription || !subscription.endpoint || !subscription.keys) {
        return { ok: false, message: 'Suscripción Push incompleta.' };
    }
    const cleanRol = ['admin', 'comprador', 'artesano'].includes(rol) ? rol : 'comprador';
    const cleanCodigo = codigoPedido ? String(codigoPedido).trim().toUpperCase().slice(0, 32) : null;

    await pool.query(
        `INSERT INTO negocio_push_subscriptions (negocio_id, rol, codigo_pedido, endpoint, p256dh, auth, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (endpoint) DO UPDATE
         SET rol = EXCLUDED.rol,
             codigo_pedido = COALESCE(EXCLUDED.codigo_pedido, negocio_push_subscriptions.codigo_pedido),
             p256dh = EXCLUDED.p256dh,
             auth = EXCLUDED.auth,
             user_agent = EXCLUDED.user_agent`,
        [
            negocioId,
            cleanRol,
            cleanCodigo,
            subscription.endpoint,
            subscription.keys.p256dh || '',
            subscription.keys.auth || '',
            String(userAgent || '').slice(0, 250)
        ]
    );
    return { ok: true };
}

/**
 * Registra y despacha evento Push (si el paquete opcional web-push y llaves VAPID están presentes,
 * o deja preparado el payload para sincronización de Service Worker).
 */
async function notifyPushSubscribers({ negocioId, rol, codigoPedido = null, title, body, url = '/' }) {
    try {
        const query = codigoPedido
            ? `SELECT id, endpoint, p256dh, auth FROM negocio_push_subscriptions WHERE negocio_id = $1 AND rol = $2 AND UPPER(codigo_pedido) = UPPER($3)`
            : `SELECT id, endpoint, p256dh, auth FROM negocio_push_subscriptions WHERE negocio_id = $1 AND rol = $2`;
        const params = codigoPedido ? [negocioId, rol, codigoPedido] : [negocioId, rol];
        const { rows } = await pool.query(query, params);
        if (rows.length === 0) return { notified: 0 };

        let webpush = null;
        try {
            webpush = require('web-push');
            if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
                webpush.setVapidDetails(
                    process.env.VAPID_SUBJECT || 'mailto:artesanitas.pe@gmail.com',
                    process.env.VAPID_PUBLIC_KEY,
                    process.env.VAPID_PRIVATE_KEY
                );
            } else {
                webpush = null;
            }
        } catch {
            webpush = null;
        }

        if (!webpush) {
            logger.info('Web Push: evento registrado para suscriptores activos', { rol, codigoPedido, count: rows.length, title });
            return { notified: rows.length, mode: 'sw-poll' };
        }

        const payload = JSON.stringify({ title, body, url, timestamp: Date.now() });
        let sentCount = 0;
        for (const sub of rows) {
            try {
                await webpush.sendNotification(
                    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                    payload
                );
                sentCount++;
            } catch (err) {
                if (err.statusCode === 404 || err.statusCode === 410) {
                    await pool.query(`DELETE FROM negocio_push_subscriptions WHERE id = $1`, [sub.id]);
                }
            }
        }
        return { notified: sentCount, mode: 'vapid' };
    } catch (err) {
        logger.error('Web Push: error notificando suscriptores', { error: err.message });
        return { notified: 0 };
    }
}

module.exports = { getVapidPublicKey, savePushSubscription, notifyPushSubscribers };
