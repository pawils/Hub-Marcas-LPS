// server/routes/negocio-pedidos.routes.js
// Sistema E-Commerce de pedidos, preventas, tracking en vivo y Mercado Pago multi-marca
// para negocios aliados (Piloto: Artesanitas Perú).

const express = require('express');
const router = express.Router({ mergeParams: true });
const crypto = require('crypto');
const multer = require('multer');
const ExcelJS = require('exceljs');
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const pool = require('../db.config');
const logger = require('../utils/logger');
const emailService = require('../utils/email.service');
const { resolveNegocioSlug, requireNegocioAuth, getNegocioMpCredentials } = require('../middleware/negocio-auth.middleware');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('El comprobante debe ser una imagen.'));
        }
        cb(null, true);
    }
});

const pedidoLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { success: false, message: 'Demasiados intentos de pedido. Intenta en 15 minutos.' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: ipKeyGenerator
});

const trackingLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    message: { success: false, message: 'Demasiadas consultas de seguimiento. Intenta en unos minutos.' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: ipKeyGenerator
});

router.param('negocioSlug', resolveNegocioSlug);

function sanitizeText(val) {
    return String(val || '').trim();
}

function neutralizeFormula(val) {
    const s = val === null || val === undefined ? '' : String(val);
    return /^[=+\-@\t]/.test(s) ? `'${s}` : s;
}

const fmtFecha = (d) => d ? new Date(d).toLocaleDateString('es-PE', { timeZone: 'America/Lima', day: 'numeric', month: 'short', year: 'numeric' }) : '';
const fmtFechaHora = (d) => d ? new Date(d).toLocaleString('es-PE', { timeZone: 'America/Lima', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

function uploadComprobante(req, res, next) {
    upload.single('comprobante')(req, res, (err) => {
        if (err) {
            const message = err.code === 'LIMIT_FILE_SIZE'
                ? 'El comprobante no debe pesar más de 5MB.'
                : err.message || 'Error al subir el comprobante.';
            return res.status(400).json({ success: false, message });
        }
        next();
    });
}

// Genera un código único legible para seguimiento (ej: ART-2026-8F4B)
async function generarCodigoPedidoUnico(negocioSlug) {
    const prefix = String(negocioSlug || 'NEG').replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase() || 'NEG';
    const year = new Date().getFullYear();
    for (let intento = 0; intento < 8; intento++) {
        const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
        const codigo = `${prefix}-${year}-${suffix}`;
        const { rows } = await pool.query(`SELECT id FROM negocio_pedidos WHERE codigo_pedido = $1`, [codigo]);
        if (rows.length === 0) return codigo;
    }
    return `${prefix}-${year}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

const FECHA_ENTREGA_OFICIAL = '2026-12-10';

const PRODUCTOS_PREVENTA = {
    // ── Colección Navidad 2026 (S/ 59.90) ──
    'taza-navidad-papa-noel': {
        slug: 'taza-navidad-papa-noel',
        nombre: 'Taza Navideña Papá Noel',
        precio: 59.90,
        reserva: 20.00,
        fecha_entrega: FECHA_ENTREGA_OFICIAL,
        imagen: '/imagenes/Artesanitas/reservas_navidad_2026/Taza_navidad_papa_noel_1.jpeg',
        descripcion: 'Hermosa taza artesanal con la figura de Papá Noel modelada y pintada a mano en cerámica fina.'
    },
    'taza-muneco-de-nieve': {
        slug: 'taza-muneco-de-nieve',
        nombre: 'Taza Muñeco de Nieve',
        precio: 59.90,
        reserva: 20.00,
        fecha_entrega: FECHA_ENTREGA_OFICIAL,
        imagen: '/imagenes/Artesanitas/reservas_navidad_2026/Taza_muneco_de_nieve_1.jpeg',
        descripcion: 'Taza artesanal con detalles de Muñeco de Nieve modelado y pintado a mano en cerámica de alta temperatura.'
    },
    'taza-arbolito-chocolatosa': {
        slug: 'taza-arbolito-chocolatosa',
        nombre: 'Taza Arbolito Chocolatosa',
        precio: 59.90,
        reserva: 20.00,
        fecha_entrega: FECHA_ENTREGA_OFICIAL,
        imagen: '/imagenes/Artesanitas/reservas_navidad_2026/Taza_arbolito_Chocolatosa.jpeg',
        descripcion: 'Hermosa taza artesanal con relieve de árbol de Navidad en tono chocolate cálido, modelada y pintada a mano.'
    },
    'taza-arbolito-rosa': {
        slug: 'taza-arbolito-rosa',
        nombre: 'Taza Arbolito Rosa',
        precio: 59.90,
        reserva: 20.00,
        fecha_entrega: FECHA_ENTREGA_OFICIAL,
        imagen: '/imagenes/Artesanitas/reservas_navidad_2026/Taza_arbolito_Rosa.jpeg',
        descripcion: 'Delicado diseño artesanal con relieve de árbol de Navidad en tono rosa pastel, modelada y esmaltada a mano.'
    },
    // ── Colección Van Gogh & Especiales ──
    'taza-van-gogh': {
        slug: 'taza-van-gogh',
        nombre: 'Taza Van Gogh',
        precio: 69.00,
        reserva: 20.00,
        fecha_entrega: FECHA_ENTREGA_OFICIAL,
        imagen: '/imagenes/Artesanitas/Fotos/Taza_Van_Gogh_0.jpeg',
        descripcion: 'Cerámica pintada a mano inspirada en el arte de Van Gogh.'
    },
    'azucarera-van-gogh': {
        slug: 'azucarera-van-gogh',
        nombre: 'Azucarera Van Gogh',
        precio: 65.00,
        reserva: 20.00,
        fecha_entrega: FECHA_ENTREGA_OFICIAL,
        imagen: '/imagenes/Artesanitas/Fotos/Azucarera_Van_Gogh_0.jpeg',
        descripcion: 'Inspirada en las pinceladas de Van Gogh, azucarera de cerámica pintada a mano que aporta arte y elegancia a tu mesa.'
    },
    'vasito-van-gogh': {
        slug: 'vasito-van-gogh',
        nombre: 'Vasito Van Gogh',
        precio: 59.00,
        reserva: 20.00,
        fecha_entrega: FECHA_ENTREGA_OFICIAL,
        imagen: '/imagenes/Artesanitas/Fotos/vasito_van_gogh_0.jpeg',
        descripcion: 'Disfruta tus bebidas favoritas en este vasito de cerámica pintado a mano inspirado en la obra de Van Gogh.'
    },
    'taza-piston-cup': {
        slug: 'taza-piston-cup',
        nombre: 'Taza Piston Cup',
        precio: 59.00,
        reserva: 20.00,
        fecha_entrega: FECHA_ENTREGA_OFICIAL,
        imagen: '/imagenes/Artesanitas/Fotos/Taza_Piston_1.jpeg',
        descripcion: 'Taza de cerámica artesanal temática de Cars inspirada en la Piston Cup, modelada y pintada a mano.'
    },
    'taza-copa-piston': {
        slug: 'taza-piston-cup',
        nombre: 'Taza Copa Pistón',
        precio: 59.00,
        reserva: 20.00,
        fecha_entrega: FECHA_ENTREGA_OFICIAL,
        imagen: '/imagenes/Artesanitas/Fotos/Taza_Piston_1.jpeg',
        descripcion: 'Taza de cerámica artesanal temática inspirada en la Copa Pistón, modelada y esmaltada a mano.'
    },
    // ── Nuevos Adornos y Catálogo General ──
    'adorno-paltita': {
        slug: 'adorno-paltita',
        nombre: 'Adorno Paltita',
        precio: 35.00,
        reserva: 20.00,
        fecha_entrega: FECHA_ENTREGA_OFICIAL,
        imagen: '/imagenes/Artesanitas/Fotos/Adorno_Paltita_1.jpeg',
        descripcion: 'Adorno y macetero artesanal en forma de paltita con lazo, modelado y pintado a mano.'
    },
    'adorno-oso-sentado': {
        slug: 'adorno-oso-sentado',
        nombre: 'Adorno Oso sentado',
        precio: 32.00,
        reserva: 20.00,
        fecha_entrega: FECHA_ENTREGA_OFICIAL,
        imagen: '/imagenes/Artesanitas/Fotos/Adorno_oso_sentado_1.jpeg',
        descripcion: 'Tierno adorno y macetero de osito sentado con detalles de corazones pintados a mano.'
    },
    'adorno-munequitas': {
        slug: 'adorno-munequitas',
        nombre: 'Adorno muñequitas',
        precio: 29.00,
        reserva: 20.00,
        fecha_entrega: FECHA_ENTREGA_OFICIAL,
        imagen: '/imagenes/Artesanitas/Fotos/Adorno_munequita_con_plantita_1.jpeg',
        descripcion: 'Delicado adorno de muñequita con corona de flores y plantita, modelado y pintado a mano.'
    },
    'taza-snoopy': {
        slug: 'taza-snoopy',
        nombre: 'Taza Snoopy',
        precio: 55.00,
        reserva: 20.00,
        fecha_entrega: FECHA_ENTREGA_OFICIAL,
        imagen: '/imagenes/Artesanitas/Fotos/taza_snoopy_0.jpeg',
        descripcion: 'Taza temática artesanal inspirada en Snoopy, modelada y esmaltada con cariño.'
    },
    // ── Colores enteros Rapunzel (sin plato - S/ 65.00) ──
    'taza-rapunzel-morada-sin-plato': {
        slug: 'taza-rapunzel-morada-sin-plato',
        nombre: 'Taza Rapunzel Morada (sin plato)',
        precio: 65.00,
        reserva: 20.00,
        fecha_entrega: FECHA_ENTREGA_OFICIAL,
        imagen: '/imagenes/Artesanitas/Fotos/Taza_Rapunzel_Morada_sinplato_1.jpeg',
        descripcion: 'Pieza artesanal inspirada en Rapunzel, en color morado entero (sin plato), modelada y pintada a mano.'
    },
    'taza-rapunzel-rosa-flamenco-sin-plato': {
        slug: 'taza-rapunzel-rosa-flamenco-sin-plato',
        nombre: 'Taza Rapunzel Rosa Flamenco (sin plato)',
        precio: 65.00,
        reserva: 20.00,
        fecha_entrega: FECHA_ENTREGA_OFICIAL,
        imagen: '/imagenes/Artesanitas/Fotos/Taza_Rapunzel_RosaFlamenco_sinplato_1.jpeg',
        descripcion: 'Pieza artesanal inspirada en Rapunzel, en tono rosa flamenco entero (sin plato), modelada y pintada a mano.'
    },
    'taza-rapunzel-palo-rosa-sin-plato': {
        slug: 'taza-rapunzel-palo-rosa-sin-plato',
        nombre: 'Taza Rapunzel Palo Rosa (sin plato)',
        precio: 65.00,
        reserva: 20.00,
        fecha_entrega: FECHA_ENTREGA_OFICIAL,
        imagen: '/imagenes/Artesanitas/Fotos/Taza_Rapunzel_Palo_Rosa_sin_plato_1.jpeg',
        descripcion: 'Pieza artesanal inspirada en Rapunzel, en tono palo rosa entero (sin plato), modelada y pintada a mano.'
    },
    'taza-stich': {
        slug: 'taza-stich',
        nombre: 'Taza Stich',
        precio: 65.00,
        reserva: 20.00,
        fecha_entrega: FECHA_ENTREGA_OFICIAL,
        imagen: '/imagenes/Artesanitas/Fotos/taza_stich_2.jpeg',
        descripcion: 'Taza de cerámica artesanal temática de Stich pintada a mano con detalle "OHANA", modelada en cerámica fina.'
    },
    'taza-stich-sin-plato': {
        slug: 'taza-stich',
        nombre: 'Taza Stich',
        precio: 65.00,
        reserva: 20.00,
        fecha_entrega: FECHA_ENTREGA_OFICIAL,
        imagen: '/imagenes/Artesanitas/Fotos/taza_stich_2.jpeg',
        descripcion: 'Taza de cerámica artesanal temática de Stich pintada a mano con detalle "OHANA", modelada en cerámica fina.'
    },
    // ── Taza con detalles (con líneas - S/ 69.90) ──
    'taza-rapunzel-morada-lineas': {
        slug: 'taza-rapunzel-morada-lineas',
        nombre: 'Taza Rapunzel Morada con líneas',
        precio: 69.90,
        reserva: 20.00,
        fecha_entrega: FECHA_ENTREGA_OFICIAL,
        imagen: '/imagenes/Artesanitas/Fotos/taza_Rapunzel_Morada_con_lineas_1.jpeg',
        descripcion: 'Pieza artesanal inspirada en Rapunzel en color morado con líneas texturizadas, modelada y pintada a mano.'
    },
    'taza-rapunzel-palo-rosa-lineas': {
        slug: 'taza-rapunzel-palo-rosa-lineas',
        nombre: 'Taza Rapunzel Palo Rosa con líneas',
        precio: 69.90,
        reserva: 20.00,
        fecha_entrega: FECHA_ENTREGA_OFICIAL,
        imagen: '/imagenes/Artesanitas/Fotos/Taza_Rapunzel_PaloRosa_con-lineas_1.jpeg',
        descripcion: 'Pieza artesanal inspirada en Rapunzel en color palo rosa con líneas texturizadas, modelada y pintada a mano.'
    },
    // ── Taza + Platito (S/ 89.90 y S/ 99.00) ──
    'taza-rapunzel-morada-plato': {
        slug: 'taza-rapunzel-morada-plato',
        nombre: 'Taza Rapunzel Morada + plato',
        precio: 89.90,
        reserva: 20.00,
        fecha_entrega: FECHA_ENTREGA_OFICIAL,
        imagen: '/imagenes/Artesanitas/Fotos/Taza_Rapunzel_Morada_con_plato_1.jpeg',
        descripcion: 'Set de Taza Rapunzel morada + platito a juego modelado y esmaltado a mano.'
    },
    'taza-rapunzel-palo-rosa-plato': {
        slug: 'taza-rapunzel-palo-rosa-plato',
        nombre: 'Taza Rapunzel Palo Rosa + plato',
        precio: 89.90,
        reserva: 20.00,
        fecha_entrega: FECHA_ENTREGA_OFICIAL,
        imagen: '/imagenes/Artesanitas/Fotos/Taza_Rapunzel_PaloRosa_Con-Plato_1.jpeg',
        descripcion: 'Set de Taza Rapunzel palo rosa + platito a juego modelado y esmaltado a mano.'
    },
    'taza-rapunzel-morada-lineas-plato': {
        slug: 'taza-rapunzel-morada-lineas-plato',
        nombre: 'Taza Rapunzel Morada con líneas + plato',
        precio: 99.00,
        reserva: 20.00,
        fecha_entrega: FECHA_ENTREGA_OFICIAL,
        imagen: '/imagenes/Artesanitas/Fotos/Taza_Rapunzel_Morada_con_lineas_y_plato_1.jpeg',
        descripcion: 'Set exclusivo de Taza Rapunzel morada con líneas texturizadas + platito artesanal a juego.'
    },
    'taza-rapunzel-palo-rosa-lineas-plato': {
        slug: 'taza-rapunzel-palo-rosa-lineas-plato',
        nombre: 'Taza Rapunzel Palo Rosa con líneas + plato',
        precio: 99.00,
        reserva: 20.00,
        fecha_entrega: FECHA_ENTREGA_OFICIAL,
        imagen: '/imagenes/Artesanitas/Fotos/Taza_Rapunzel_PaloRosa_con_lineas_y_plato_1.jpeg',
        descripcion: 'Set exclusivo de Taza Rapunzel palo rosa con líneas texturizadas + platito artesanal a juego.'
    },
    // Aliases retrocompatibles
    'taza-rapunzel-sin-plato': {
        slug: 'taza-rapunzel-morada-sin-plato',
        nombre: 'Taza Rapunzel Morada (sin plato)',
        precio: 65.00,
        reserva: 20.00,
        fecha_entrega: FECHA_ENTREGA_OFICIAL,
        imagen: '/imagenes/Artesanitas/Fotos/Taza_Rapunzel_Morada_sinplato_1.jpeg',
        descripcion: 'Pieza artesanal inspirada en Rapunzel, sola y en color entero (sin plato), modelada y pintada a mano.'
    },
    'taza-rapunzel-lineas': {
        slug: 'taza-rapunzel-morada-lineas',
        nombre: 'Taza Rapunzel Morada con líneas',
        precio: 69.90,
        reserva: 20.00,
        fecha_entrega: FECHA_ENTREGA_OFICIAL,
        imagen: '/imagenes/Artesanitas/Fotos/taza_Rapunzel_Morada_con_lineas_1.jpeg',
        descripcion: 'Pieza artesanal inspirada en Rapunzel con detalle de líneas texturizadas, modelada y pintada a mano.'
    },
    'taza-rapunzel-con-plato': {
        slug: 'taza-rapunzel-palo-rosa-plato',
        nombre: 'Taza Rapunzel Palo Rosa + plato',
        precio: 89.90,
        reserva: 20.00,
        fecha_entrega: FECHA_ENTREGA_OFICIAL,
        imagen: '/imagenes/Artesanitas/Fotos/Taza_Rapunzel_PaloRosa_Con-Plato_1.jpeg',
        descripcion: 'Set completo: Taza artesanal inspirada en Rapunzel + platito a juego modelado y esmaltado a mano.'
    },
    'taza-rapunzel': {
        slug: 'taza-rapunzel-morada-sin-plato',
        nombre: 'Taza Rapunzel Morada (sin plato)',
        precio: 65.00,
        reserva: 20.00,
        fecha_entrega: FECHA_ENTREGA_OFICIAL,
        imagen: '/imagenes/Artesanitas/Fotos/Taza_Rapunzel_Morada_sinplato_1.jpeg',
        descripcion: 'Pieza artesanal inspirada en Rapunzel, sola y en color entero (sin plato), modelada y pintada a mano.'
    },
    'taza-rapunzel-palo-rosa': {
        slug: 'taza-rapunzel-palo-rosa-plato',
        nombre: 'Taza Rapunzel Palo Rosa + plato',
        precio: 89.90,
        reserva: 20.00,
        fecha_entrega: FECHA_ENTREGA_OFICIAL,
        imagen: '/imagenes/Artesanitas/Fotos/Taza_Rapunzel_PaloRosa_Con-Plato_1.jpeg',
        descripcion: 'Set completo: Taza artesanal inspirada en Rapunzel + platito a juego modelado y esmaltado a mano.'
    },
    'taza-rapunzel-moradito': {
        slug: 'taza-rapunzel-moradito',
        nombre: 'Taza Rapunzel Moradito',
        precio: 95.00,
        reserva: 20.00,
        fecha_entrega: FECHA_ENTREGA_OFICIAL,
        imagen: '/imagenes/Artesanitas/Fotos/Taza Rapunzel Moradito 95.jpeg',
        descripcion: 'Set completo: Taza artesanal inspirada en Rapunzel + platito a juego modelado y esmaltado a mano.'
    },
    'copa-pistone': {
        slug: 'taza-piston-cup',
        nombre: 'Taza Piston Cup',
        precio: 59.00,
        reserva: 20.00,
        fecha_entrega: FECHA_ENTREGA_OFICIAL,
        imagen: '/imagenes/Artesanitas/Fotos/Taza_Piston_1.jpeg',
        descripcion: 'Taza de cerámica artesanal temática de Cars inspirada en la Piston Cup, modelada y pintada a mano.'
    },
    'taza-copa-pistone': {
        slug: 'taza-piston-cup',
        nombre: 'Taza Piston Cup',
        precio: 59.00,
        reserva: 20.00,
        fecha_entrega: FECHA_ENTREGA_OFICIAL,
        imagen: '/imagenes/Artesanitas/Fotos/Taza_Piston_1.jpeg',
        descripcion: 'Taza de cerámica artesanal temática de Cars inspirada en la Piston Cup, modelada y pintada a mano.'
    },
    'piston-cup': {
        slug: 'taza-piston-cup',
        nombre: 'Taza Piston Cup',
        precio: 59.00,
        reserva: 20.00,
        fecha_entrega: FECHA_ENTREGA_OFICIAL,
        imagen: '/imagenes/Artesanitas/Fotos/Taza_Piston_1.jpeg',
        descripcion: 'Taza de cerámica artesanal temática de Cars inspirada en la Piston Cup, modelada y pintada a mano.'
    }
};

// ── 0. GET /api/negocios/:negocioSlug/pedidos/productos — Público: Listar productos disponibles ──
router.get('/:negocioSlug/pedidos/productos', async (req, res) => {
    try {
        const productos = [
            PRODUCTOS_PREVENTA['taza-navidad-papa-noel'],
            PRODUCTOS_PREVENTA['taza-muneco-de-nieve'],
            PRODUCTOS_PREVENTA['taza-arbolito-chocolatosa'],
            PRODUCTOS_PREVENTA['taza-arbolito-rosa'],
            PRODUCTOS_PREVENTA['taza-van-gogh'],
            PRODUCTOS_PREVENTA['taza-rapunzel-sin-plato'],
            PRODUCTOS_PREVENTA['taza-rapunzel-lineas'],
            PRODUCTOS_PREVENTA['taza-rapunzel-con-plato'],
            PRODUCTOS_PREVENTA['taza-piston-cup']
        ];
        const mpCreds = getNegocioMpCredentials(req.negocio);
        res.json({ success: true, mp_habilitado: mpCreds.enabled, productos });
    } catch (error) {
        logger.error('Negocios: error listando productos preventa', { error: error.message });
        res.status(500).json({ success: false, message: 'Error interno.' });
    }
});

// ── 0B. GET /api/negocios/:negocioSlug/pedidos/seguimiento — Público: Rastrear pedido por Código o DNI ──
router.get('/:negocioSlug/pedidos/seguimiento', trackingLimiter, async (req, res) => {
    try {
        const rawQuery = sanitizeText(req.query.q || req.query.codigo || req.query.dni || '');
        if (!rawQuery || rawQuery.length < 4) {
            return res.status(400).json({
                success: false,
                message: 'Ingresa tu Código de Pedido (ej. ART-2026-...) o tu DNI de 8 dígitos.'
            });
        }

        const isDni = /^\d{8}$/.test(rawQuery);
        const mpCreds = getNegocioMpCredentials(req.negocio);

        const query = isDni
            ? `SELECT id, codigo_pedido, producto_slug, producto_nombre, COALESCE(cantidad, 1) AS cantidad,
                      COALESCE(items, '[]'::jsonb) AS items, producto_precio, monto_reserva, costo_envio,
                      tipo_entrega, fecha_entrega, sede_shalom, estado_pago, monto_pagado, estado_pedido,
                      guia_envio, COALESCE(empresa_envio, 'Shalom') AS empresa_envio, created_at, updated_at,
                      (producto_precio - monto_pagado) AS saldo_pendiente
               FROM negocio_pedidos
               WHERE negocio_id = $1 AND dni = $2
               ORDER BY created_at DESC
               LIMIT 10`
            : `SELECT id, codigo_pedido, producto_slug, producto_nombre, COALESCE(cantidad, 1) AS cantidad,
                      COALESCE(items, '[]'::jsonb) AS items, producto_precio, monto_reserva, costo_envio,
                      tipo_entrega, fecha_entrega, sede_shalom, estado_pago, monto_pagado, estado_pedido,
                      guia_envio, COALESCE(empresa_envio, 'Shalom') AS empresa_envio, created_at, updated_at,
                      (producto_precio - monto_pagado) AS saldo_pendiente
               FROM negocio_pedidos
               WHERE negocio_id = $1 AND UPPER(codigo_pedido) = UPPER($2)
               ORDER BY created_at DESC
               LIMIT 5`;

        const { rows } = await pool.query(query, [req.negocio.id, rawQuery]);

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No encontramos pedidos con ese código o DNI. Verifica los datos ingresados.'
            });
        }

        const pedidos = rows.map(r => ({
            ...r,
            codigo_pedido: r.codigo_pedido || `ART-${new Date(r.created_at).getFullYear()}-${String(r.id).padStart(4, '0')}`,
            mp_habilitado: mpCreds.enabled
        }));

        res.json({ success: true, pedidos });
    } catch (error) {
        logger.error('Negocios: error en seguimiento de pedido', { error: error.message });
        res.status(500).json({ success: false, message: 'Error al consultar el seguimiento.' });
    }
});

// ── 1. POST /api/negocios/:negocioSlug/pedidos — Público: Registrar Reserva de Pedido ──
router.post('/:negocioSlug/pedidos', pedidoLimiter, uploadComprobante, async (req, res) => {
    try {
        const {
            producto_slug,
            tipo_entrega,
            nombre,
            dni,
            whatsapp,
            sede_shalom,
            direccion_adicional,
            notas
        } = req.body;

        const cleanTipoEntrega = (tipo_entrega === 'recojo_local' || tipo_entrega === 'local') ? 'recojo_local' : 'provincia';
        const cleanNombre = sanitizeText(nombre);
        const cleanDni = sanitizeText(dni).replace(/\D/g, '');
        const cleanWhatsapp = sanitizeText(whatsapp);
        let cleanSedeShalom = sanitizeText(sede_shalom);
        const cleanDireccion = sanitizeText(direccion_adicional);
        const cleanNotas = sanitizeText(notas);

        if (!cleanNombre || cleanNombre.length < 2) {
            return res.status(400).json({ success: false, message: 'Ingresa tu nombre completo.' });
        }
        if (!cleanDni || cleanDni.length !== 8) {
            return res.status(400).json({ success: false, message: 'El DNI debe tener exactamente 8 dígitos numéricos.' });
        }
        if (!cleanWhatsapp || cleanWhatsapp.length < 6) {
            return res.status(400).json({ success: false, message: 'Ingresa un número de WhatsApp válido.' });
        }

        let parsedItems = [];
        if (req.body.items) {
            try {
                const raw = (typeof req.body.items === 'string') ? JSON.parse(req.body.items) : req.body.items;
                if (Array.isArray(raw)) parsedItems = raw;
            } catch (e) {}
        }

        let itemsValidados = [];
        if (parsedItems.length > 0) {
            for (const item of parsedItems) {
                const s = item.slug ? sanitizeText(item.slug).toLowerCase() : '';
                let pInfo = PRODUCTOS_PREVENTA[s];
                if (!pInfo && s) {
                    const { rows: pRows } = await pool.query(
                        `SELECT slug, nombre, precio, descripcion, imagenes FROM negocio_productos WHERE negocio_id = $1 AND slug = $2 AND activo = TRUE`,
                        [req.negocio.id, s]
                    );
                    if (pRows.length > 0) {
                        const pr = pRows[0];
                        pInfo = {
                            slug: pr.slug,
                            nombre: pr.nombre,
                            precio: Number(pr.precio),
                            reserva: 20.00,
                            fecha_entrega: FECHA_ENTREGA_OFICIAL,
                            imagen: (pr.imagenes && pr.imagenes[0]) || '/imagenes/Artesanitas/logo_artesanitas.peru.jpg',
                            descripcion: pr.descripcion || ''
                        };
                    }
                }
                if (pInfo) {
                    const rawItemCant = parseInt(item.cantidad, 10);
                    const cant = (!Number.isNaN(rawItemCant) && rawItemCant >= 1) ? Math.min(rawItemCant, 50) : 1;
                    itemsValidados.push({
                        slug: pInfo.slug,
                        nombre: pInfo.nombre,
                        precio: Number(pInfo.precio),
                        reserva: Number(pInfo.reserva || 20.00),
                        cantidad: cant,
                        imagen: pInfo.imagen || ''
                    });
                }
            }
        }

        if (itemsValidados.length === 0) {
            const pSlug = producto_slug ? sanitizeText(producto_slug).toLowerCase() : '';
            let prodInfo = PRODUCTOS_PREVENTA[pSlug];

            if (!prodInfo && pSlug) {
                const { rows: prodRows } = await pool.query(
                    `SELECT slug, nombre, precio, descripcion, imagenes FROM negocio_productos WHERE negocio_id = $1 AND slug = $2 AND activo = TRUE`,
                    [req.negocio.id, pSlug]
                );
                if (prodRows.length > 0) {
                    const pr = prodRows[0];
                    prodInfo = {
                        slug: pr.slug,
                        nombre: pr.nombre,
                        precio: Number(pr.precio),
                        reserva: 20.00,
                        fecha_entrega: FECHA_ENTREGA_OFICIAL,
                        imagen: (pr.imagenes && pr.imagenes[0]) || '/imagenes/Artesanitas/logo_artesanitas.peru.jpg',
                        descripcion: pr.descripcion || ''
                    };
                }
            }

            if (!prodInfo) {
                return res.status(400).json({ success: false, message: 'Por favor selecciona el producto que deseas reservar.' });
            }

            const rawCantidad = parseInt(req.body.cantidad, 10);
            const cleanCantidad = (!Number.isNaN(rawCantidad) && rawCantidad >= 1) ? Math.min(rawCantidad, 50) : 1;

            itemsValidados.push({
                slug: prodInfo.slug,
                nombre: prodInfo.nombre,
                precio: Number(prodInfo.precio),
                reserva: Number(prodInfo.reserva || 20.00),
                cantidad: cleanCantidad,
                imagen: prodInfo.imagen || ''
            });
        }

        const totalCantidad = itemsValidados.reduce((sum, i) => sum + i.cantidad, 0);
        const pPrecioTotal = itemsValidados.reduce((sum, i) => sum + (i.precio * i.cantidad), 0);
        const pReservaTotal = itemsValidados.reduce((sum, i) => sum + (i.reserva * i.cantidad), 0);
        const pNombreResumen = itemsValidados.map(i => `${i.cantidad > 1 ? `${i.cantidad}x ` : ''}${i.nombre}`).join(' + ');
        const pSlugPrincipal = itemsValidados[0].slug;
        const pFechaEntrega = FECHA_ENTREGA_OFICIAL;
        let pEnvio = 0.00;

        if (cleanTipoEntrega === 'provincia') {
            if (!cleanSedeShalom || cleanSedeShalom.length < 3) {
                return res.status(400).json({ success: false, message: 'Ingresa la sede de agencia Shalom para tu envío a provincia.' });
            }
            pEnvio = 10.00;
        } else {
            cleanSedeShalom = 'Recojo en Local (Taller Trujillo)';
            pEnvio = 0.00;
        }

        const codigoPedido = await generarCodigoPedidoUnico(req.negocio.slug);
        const file = req.file;

        const insertQuery = `
            INSERT INTO negocio_pedidos (
                negocio_id, codigo_pedido, producto_slug, producto_nombre, cantidad, items, producto_precio,
                monto_reserva, costo_envio, tipo_entrega, fecha_entrega,
                nombre, dni, whatsapp, sede_shalom, direccion_adicional,
                estado_pago, monto_pagado, estado_pedido,
                origen, notas
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7,
                $8, $9, $10, $11,
                $12, $13, $14, $15, $16,
                $17, $18, $19,
                $20, $21
            )
            RETURNING id, codigo_pedido, producto_nombre, cantidad, items, fecha_entrega, nombre, dni, whatsapp, tipo_entrega, sede_shalom, monto_reserva, created_at
        `;

        const { rows } = await pool.query(insertQuery, [
            req.negocio.id, codigoPedido, pSlugPrincipal, pNombreResumen, totalCantidad, JSON.stringify(itemsValidados), pPrecioTotal,
            pReservaTotal, pEnvio, cleanTipoEntrega, pFechaEntrega,
            cleanNombre, cleanDni, cleanWhatsapp, cleanSedeShalom, cleanDireccion || null,
            'parcial', pReservaTotal, 'reservado',
            'formulario', cleanNotas || null
        ]);

        const pedido = rows[0];

        if (req.negocio.email_notif && typeof emailService.sendNegocioPedidoEmail === 'function') {
            emailService.sendNegocioPedidoEmail({
                to: req.negocio.email_notif,
                nombre: cleanNombre,
                dni: cleanDni,
                whatsapp: cleanWhatsapp,
                tipoEntrega: cleanTipoEntrega,
                sedeShalom: cleanSedeShalom,
                direccion: cleanDireccion || null,
                productoNombre: pNombreResumen,
                cantidad: totalCantidad,
                items: itemsValidados,
                precioTotal: pPrecioTotal,
                montoReserva: pReservaTotal,
                costoEnvio: pEnvio,
                fechaEntrega: pFechaEntrega,
                comprobante: file || null
            }).catch(err => logger.error('Negocios: error enviando email de pedido', { error: err.message }));
        }

        res.status(201).json({
            success: true,
            message: `¡Tu reserva (${pedido.codigo_pedido}) para ${pNombreResumen} ha sido registrada con éxito! Puedes rastrear el estado de tu pedido en cualquier momento con tu código o DNI.`,
            pedido: {
                id: pedido.id,
                codigo_pedido: pedido.codigo_pedido,
                seguimiento_url: `/artesanitas/seguimiento?codigo=${encodeURIComponent(pedido.codigo_pedido)}`,
                nombre: pedido.nombre,
                producto: pedido.producto_nombre,
                cantidad: pedido.cantidad,
                items: pedido.items,
                tipo_entrega: pedido.tipo_entrega,
                fecha_entrega: pedido.fecha_entrega
            }
        });
    } catch (error) {
        logger.error('Negocios: error registrando pedido', { error: error.message, stack: error.stack });
        res.status(500).json({ success: false, message: 'Ocurrió un error al registrar el pedido. Intenta nuevamente.' });
    }
});

// ── 1B. POST /api/negocios/:negocioSlug/pedidos/:codigo/checkout-mp — Checkout Mercado Pago con cuenta PROPIA del negocio ──
router.post('/:negocioSlug/pedidos/:codigo/checkout-mp', pedidoLimiter, async (req, res) => {
    try {
        const mpCreds = getNegocioMpCredentials(req.negocio);
        if (!mpCreds.enabled) {
            return res.status(400).json({
                success: false,
                message: `La pasarela de Mercado Pago aún no está activada para ${req.negocio.nombre}. Puedes completar tu pago por Yape/Plin o WhatsApp.`
            });
        }

        const codigo = sanitizeText(req.params.codigo).toUpperCase();
        const { rows } = await pool.query(
            `SELECT id, codigo_pedido, producto_nombre, producto_precio, monto_pagado, costo_envio, nombre, estado_pago
             FROM negocio_pedidos
             WHERE negocio_id = $1 AND UPPER(codigo_pedido) = $2`,
            [req.negocio.id, codigo]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Pedido no encontrado.' });
        }

        const pedido = rows[0];
        const saldoPendiente = Math.max(0, Number(pedido.producto_precio) - Number(pedido.monto_pagado));
        if (!(saldoPendiente > 0)) {
            return res.status(400).json({ success: false, message: 'Este pedido ya se encuentra pagado al 100%.' });
        }

        // Instancia Mercado Pago EXCLUSIVA con el token del negocio aliado (nunca mezcla con Los Pilares)
        const mpClient = new MercadoPagoConfig({
            accessToken: mpCreds.accessToken,
            options: { timeout: 5000 }
        });
        const preference = new Preference(mpClient);

        const host = req.get('host');
        const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
        const baseUrl = `${protocol}://${host}`;
        const trackingUrl = `${baseUrl}/artesanitas/seguimiento?codigo=${encodeURIComponent(pedido.codigo_pedido)}`;

        const prefData = {
            body: {
                items: [
                    {
                        id: pedido.codigo_pedido,
                        title: `Saldo Pedido ${pedido.codigo_pedido} - ${pedido.producto_nombre}`,
                        description: `${req.negocio.nombre} - Pago de saldo pendiente`,
                        quantity: 1,
                        unit_price: Number(saldoPendiente.toFixed(2)),
                        currency_id: 'PEN'
                    }
                ],
                payer: {
                    name: pedido.nombre || 'Cliente'
                },
                back_urls: {
                    success: `${trackingUrl}&mp=approved`,
                    failure: `${trackingUrl}&mp=failure`,
                    pending: `${trackingUrl}&mp=pending`
                },
                external_reference: `${req.negocio.slug}:${pedido.codigo_pedido}`,
                statement_descriptor: mpCreds.descriptor,
                notification_url: `${baseUrl}/api/negocios/${req.negocio.slug}/webhooks/mercadopago`
            }
        };

        if (protocol === 'https') {
            prefData.body.auto_return = 'approved';
        }

        const response = await preference.create(prefData);
        await pool.query(
            `UPDATE negocio_pedidos SET mp_preference_id = $1, updated_at = NOW() WHERE id = $2`,
            [response.id, pedido.id]
        );

        res.json({
            success: true,
            init_point: response.init_point,
            preferenceId: response.id
        });
    } catch (error) {
        logger.error('Negocios: error creando preferencia Mercado Pago', { error: error.message });
        res.status(500).json({ success: false, message: 'No se pudo generar el pago con Mercado Pago.' });
    }
});

// ── 1C. POST /api/negocios/:negocioSlug/webhooks/mercadopago — Webhook aislado por cuenta del negocio ──
router.post('/:negocioSlug/webhooks/mercadopago', async (req, res) => {
    const mpCreds = getNegocioMpCredentials(req.negocio);
    res.status(200).send('OK');

    if (!mpCreds.enabled) return;

    try {
        const topic = req.query.topic || req.query.type || req.body?.type;
        const rawPaymentId = req.query['data.id'] || req.query.id || req.body?.data?.id;
        if (topic !== 'payment' || !rawPaymentId) return;

        // Validar firma HMAC si el negocio configuró su mp_webhook_secret
        if (mpCreds.webhookSecret) {
            const xSignature = req.headers['x-signature'] || '';
            const xRequestId = req.headers['x-request-id'] || '';
            const parts = {};
            xSignature.split(',').forEach(p => {
                const idx = p.indexOf('=');
                if (idx > -1) parts[p.slice(0, idx).trim()] = p.slice(idx + 1).trim();
            });
            if (!parts.ts || !parts.v1) return;
            const template = `id:${String(rawPaymentId).toLowerCase()};request-id:${xRequestId};ts:${parts.ts}`;
            const expected = crypto.createHmac('sha256', mpCreds.webhookSecret).update(template).digest('hex');
            if (expected !== parts.v1) {
                logger.warn('Negocios MP Webhook: firma HMAC inválida', { negocio: req.negocio.slug });
                return;
            }
        }

        const mpClient = new MercadoPagoConfig({ accessToken: mpCreds.accessToken, options: { timeout: 5000 } });
        const paymentClient = new Payment(mpClient);
        const paymentInfo = await paymentClient.get({ id: String(rawPaymentId) });

        if (paymentInfo.status !== 'approved' || !paymentInfo.external_reference) return;

        const [slugRef, codigoRef] = String(paymentInfo.external_reference).split(':');
        if (slugRef !== req.negocio.slug || !codigoRef) return;

        await pool.query(
            `UPDATE negocio_pedidos
             SET estado_pago = 'completo',
                 monto_pagado = producto_precio,
                 metodo_pago = 'mercadopago',
                 mp_payment_id = $1,
                 updated_at = NOW()
             WHERE negocio_id = $2 AND codigo_pedido = $3 AND estado_pago != 'completo'`,
            [String(rawPaymentId), req.negocio.id, codigoRef]
        );
        logger.info('Negocios MP Webhook: pedido pagado 100%', { negocio: req.negocio.slug, codigo: codigoRef });
    } catch (error) {
        logger.error('Negocios MP Webhook: error procesando pago', { error: error.message, negocio: req.negocio?.slug });
    }
});

// ── 2. GET /api/negocios/:negocioSlug/pedidos — Admin: Listar Pedidos ──
router.get('/:negocioSlug/pedidos', requireNegocioAuth, async (req, res) => {
    try {
        const { search, estado_pago, estado_pedido, tipo_entrega } = req.query;
        const conditions = ['negocio_id = $1'];
        const params = [req.negocio.id];

        if (tipo_entrega) {
            params.push(tipo_entrega);
            conditions.push(`tipo_entrega = $${params.length}`);
        }

        if (estado_pago) {
            params.push(estado_pago);
            conditions.push(`estado_pago = $${params.length}`);
        }

        if (estado_pedido) {
            params.push(estado_pedido);
            conditions.push(`estado_pedido = $${params.length}`);
        }

        if (search && search.trim()) {
            params.push(`%${search.trim().toLowerCase()}%`);
            const idx = params.length;
            conditions.push(`(LOWER(nombre) LIKE $${idx} OR LOWER(dni) LIKE $${idx} OR LOWER(whatsapp) LIKE $${idx} OR LOWER(sede_shalom) LIKE $${idx} OR LOWER(COALESCE(codigo_pedido, '')) LIKE $${idx} OR LOWER(COALESCE(guia_envio, '')) LIKE $${idx})`);
        }

        const query = `
            SELECT id, codigo_pedido, producto_slug, producto_nombre, COALESCE(cantidad, 1) AS cantidad, COALESCE(items, '[]'::jsonb) AS items, producto_precio, monto_reserva, costo_envio, tipo_entrega, fecha_entrega,
                   nombre, dni, whatsapp, sede_shalom, direccion_adicional,
                   estado_pago, monto_pagado, estado_pedido, guia_envio, COALESCE(empresa_envio, 'Shalom') AS empresa_envio,
                   artesano_nombre, costo_artesano_total, fecha_encargo_artesano, fecha_compromiso_artesano, fecha_recepcion_taller,
                   origen, notas, created_at, updated_at,
                   (producto_precio - monto_pagado) AS saldo_pendiente
            FROM negocio_pedidos
            WHERE ${conditions.join(' AND ')}
            ORDER BY created_at DESC
        `;

        const { rows } = await pool.query(query, params);
        res.json({ success: true, pedidos: rows });
    } catch (error) {
        logger.error('Negocios: error listando pedidos', { error: error.message });
        res.status(500).json({ success: false, message: 'Error interno.' });
    }
});

// ── 3. PATCH /api/negocios/:negocioSlug/pedidos/:id — Admin: Actualizar estado / montos / guía Shalom ──
router.patch('/:negocioSlug/pedidos/:id', requireNegocioAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { estado_pago, monto_pagado, estado_pedido, notas, sede_shalom, guia_envio, empresa_envio, artesano_nombre, fecha_compromiso_artesano, costo_artesano_total } = req.body;

        const updates = ['updated_at = NOW()'];
        const params = [id, req.negocio.id];

        const set = (col, val) => {
            params.push(val);
            updates.push(`${col} = $${params.length}`);
        };

        if (estado_pago !== undefined) {
            if (!['pendiente', 'parcial', 'completo'].includes(estado_pago)) {
                return res.status(400).json({ success: false, message: 'Estado de pago inválido.' });
            }
            set('estado_pago', estado_pago);
        }

        if (monto_pagado !== undefined) {
            const monto = parseFloat(monto_pagado);
            if (Number.isNaN(monto) || monto < 0) {
                return res.status(400).json({ success: false, message: 'Monto pagado inválido.' });
            }
            set('monto_pagado', monto);
        }

        if (estado_pedido !== undefined) {
            if (!['cotizado', 'reservado', 'encargado_artesano', 'en_produccion', 'recibido_taller', 'enviado', 'entregado', 'post_venta', 'cancelado'].includes(estado_pedido)) {
                return res.status(400).json({ success: false, message: 'Estado de pedido inválido.' });
            }
            set('estado_pedido', estado_pedido);
        }

        if (notas !== undefined) set('notas', sanitizeText(notas) || null);
        if (sede_shalom !== undefined) set('sede_shalom', sanitizeText(sede_shalom));
        if (guia_envio !== undefined) set('guia_envio', sanitizeText(guia_envio) || null);
        if (empresa_envio !== undefined) set('empresa_envio', sanitizeText(empresa_envio) || 'Shalom');
        if (artesano_nombre !== undefined) set('artesano_nombre', sanitizeText(artesano_nombre) || null);
        if (fecha_compromiso_artesano !== undefined) set('fecha_compromiso_artesano', sanitizeText(fecha_compromiso_artesano) || null);
        if (costo_artesano_total !== undefined) {
            const cArt = costo_artesano_total === '' || costo_artesano_total === null ? null : parseFloat(costo_artesano_total);
            set('costo_artesano_total', Number.isFinite(cArt) && cArt >= 0 ? cArt : null);
        }
        if (estado_pedido === 'encargado_artesano') {
            updates.push('fecha_encargo_artesano = COALESCE(fecha_encargo_artesano, CURRENT_DATE)');
        }
        if (estado_pedido === 'recibido_taller') {
            updates.push('fecha_recepcion_taller = COALESCE(fecha_recepcion_taller, NOW())');
        }
        if (estado_pedido === 'enviado') {
            updates.push('fecha_despacho_courier = COALESCE(fecha_despacho_courier, NOW())');
        }
        if (estado_pedido === 'entregado') {
            updates.push('fecha_entrega_final = COALESCE(fecha_entrega_final, NOW())');
        }

        if (updates.length === 1) {
            return res.status(400).json({ success: false, message: 'No hay campos para actualizar.' });
        }

        const query = `
            UPDATE negocio_pedidos
            SET ${updates.join(', ')}
            WHERE id = $1 AND negocio_id = $2
            RETURNING id, codigo_pedido, producto_nombre, COALESCE(cantidad, 1) AS cantidad, COALESCE(items, '[]'::jsonb) AS items,
                      estado_pago, monto_pagado, estado_pedido, guia_envio, empresa_envio, artesano_nombre, fecha_compromiso_artesano, fecha_recepcion_taller, notas, sede_shalom,
                      (producto_precio - monto_pagado) AS saldo_pendiente
        `;

        const { rows } = await pool.query(query, params);
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Pedido no encontrado.' });
        }

        res.json({ success: true, pedido: rows[0] });
    } catch (error) {
        logger.error('Negocios: error actualizando pedido', { error: error.message });
        res.status(500).json({ success: false, message: 'Error interno.' });
    }
});

// ── 5. DELETE /api/negocios/:negocioSlug/pedidos/:id — Admin: Eliminar pedido ──
router.delete('/:negocioSlug/pedidos/:id', requireNegocioAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { rows } = await pool.query(
            `DELETE FROM negocio_pedidos WHERE id = $1 AND negocio_id = $2 RETURNING id`,
            [id, req.negocio.id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Pedido no encontrado.' });
        }
        res.json({ success: true, message: 'Pedido eliminado correctamente.' });
    } catch (error) {
        logger.error('Negocios: error eliminando pedido', { error: error.message });
        res.status(500).json({ success: false, message: 'Error interno.' });
    }
});

// ── 6. Exportación Excel y CSV ──
async function fetchPedidosParaExport(req) {
    const { search, estado_pago, estado_pedido, tipo_entrega } = req.query;
    const conditions = ['negocio_id = $1'];
    const params = [req.negocio.id];

    if (tipo_entrega) {
        params.push(tipo_entrega);
        conditions.push(`tipo_entrega = $${params.length}`);
    }
    if (estado_pago) {
        params.push(estado_pago);
        conditions.push(`estado_pago = $${params.length}`);
    }
    if (estado_pedido) {
        params.push(estado_pedido);
        conditions.push(`estado_pedido = $${params.length}`);
    }
    if (search && search.trim()) {
        params.push(`%${search.trim().toLowerCase()}%`);
        const idx = params.length;
        conditions.push(`(LOWER(nombre) LIKE $${idx} OR LOWER(dni) LIKE $${idx} OR LOWER(whatsapp) LIKE $${idx} OR LOWER(sede_shalom) LIKE $${idx} OR LOWER(COALESCE(codigo_pedido, '')) LIKE $${idx} OR LOWER(COALESCE(guia_envio, '')) LIKE $${idx})`);
    }

    const { rows } = await pool.query(
        `SELECT id, codigo_pedido, producto_nombre, COALESCE(cantidad, 1) AS cantidad, COALESCE(items, '[]'::jsonb) AS items, producto_precio, monto_reserva, costo_envio, tipo_entrega, fecha_entrega,
                nombre, dni, whatsapp, sede_shalom, direccion_adicional,
                estado_pago, monto_pagado, estado_pedido, guia_envio, origen, notas, created_at,
                (producto_precio - monto_pagado) AS saldo_pendiente
         FROM negocio_pedidos
         WHERE ${conditions.join(' AND ')}
         ORDER BY created_at DESC`,
        params
    );
    return rows;
}

router.get('/:negocioSlug/pedidos/export', requireNegocioAuth, async (req, res) => {
    try {
        const rows = await fetchPedidosParaExport(req);
        const escapeCsv = (val) => {
            const s = neutralizeFormula(val);
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        };

        const header = ['Código Pedido', 'Nombre', 'DNI', 'WhatsApp', 'Tipo Entrega', 'Sede Shalom / Local', 'Guía Shalom', 'Dirección Ref', 'Producto', 'Cant.', 'Fecha Entrega', 'Precio Total', 'Reserva Pagada', 'Saldo Pendiente', 'Costo Envío', 'Estado Pago', 'Estado Pedido', 'Fecha Registro', 'Notas'];
        const lines = [header.join(',')];

        for (const r of rows) {
            lines.push([
                escapeCsv(r.codigo_pedido || `ART-${r.id}`),
                escapeCsv(r.nombre), escapeCsv(r.dni), escapeCsv(r.whatsapp),
                escapeCsv(r.tipo_entrega === 'recojo_local' ? 'Recojo en Local (Trujillo)' : 'Envío a Provincia (Shalom)'),
                escapeCsv(r.sede_shalom), escapeCsv(r.guia_envio || ''), escapeCsv(r.direccion_adicional || ''),
                escapeCsv(r.producto_nombre), escapeCsv(r.cantidad || 1), escapeCsv(fmtFecha(r.fecha_entrega)), escapeCsv(r.producto_precio),
                escapeCsv(r.monto_pagado), escapeCsv(r.saldo_pendiente), escapeCsv(r.costo_envio),
                escapeCsv(r.estado_pago), escapeCsv(r.estado_pedido), escapeCsv(fmtFechaHora(r.created_at)), escapeCsv(r.notas || '')
            ].join(','));
        }

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${req.negocio.slug}-pedidos.csv"`);
        res.send('\uFEFF' + lines.join('\n'));
    } catch (error) {
        logger.error('Negocios: error exportando CSV pedidos', { error: error.message });
        res.status(500).json({ success: false, message: 'Error interno.' });
    }
});

router.get('/:negocioSlug/pedidos/export.xlsx', requireNegocioAuth, async (req, res) => {
    try {
        const rows = await fetchPedidosParaExport(req);
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Pedidos y Preventas');

        sheet.columns = [
            { header: 'Código Pedido', key: 'codigoPedido', width: 18 },
            { header: 'Nombre', key: 'nombre', width: 24 },
            { header: 'DNI', key: 'dni', width: 14 },
            { header: 'WhatsApp', key: 'whatsapp', width: 16 },
            { header: 'Tipo Entrega', key: 'tipoEntrega', width: 24 },
            { header: 'Sede Shalom / Local', key: 'sedeShalom', width: 28 },
            { header: 'Guía Shalom', key: 'guiaEnvio', width: 18 },
            { header: 'Dirección / Ref', key: 'direccion', width: 20 },
            { header: 'Producto', key: 'producto', width: 24 },
            { header: 'Cant.', key: 'cantidad', width: 10 },
            { header: 'Fecha Entrega', key: 'fechaEntrega', width: 16 },
            { header: 'Precio Total', key: 'precioTotal', width: 14 },
            { header: 'Monto Pagado', key: 'montoPagado', width: 14 },
            { header: 'Saldo Pendiente', key: 'saldoPendiente', width: 16 },
            { header: 'Costo Envío', key: 'costoEnvio', width: 14 },
            { header: 'Estado Pago', key: 'estadoPago', width: 14 },
            { header: 'Estado Pedido', key: 'estadoPedido', width: 16 },
            { header: 'Fecha Registro', key: 'fechaRegistro', width: 20 },
            { header: 'Notas', key: 'notas', width: 24 }
        ];
        sheet.getRow(1).font = { bold: true };

        for (const r of rows) {
            sheet.addRow({
                codigoPedido: neutralizeFormula(r.codigo_pedido || `ART-${r.id}`),
                nombre: neutralizeFormula(r.nombre),
                dni: neutralizeFormula(r.dni),
                whatsapp: neutralizeFormula(r.whatsapp),
                tipoEntrega: r.tipo_entrega === 'recojo_local' ? 'Recojo en Local (Trujillo)' : 'Envío a Provincia (Shalom)',
                sedeShalom: neutralizeFormula(r.sede_shalom),
                guiaEnvio: neutralizeFormula(r.guia_envio || ''),
                direccion: neutralizeFormula(r.direccion_adicional || ''),
                producto: neutralizeFormula(r.producto_nombre),
                cantidad: Number(r.cantidad || 1),
                fechaEntrega: fmtFecha(r.fecha_entrega),
                precioTotal: Number(r.producto_precio),
                montoPagado: Number(r.monto_pagado),
                saldoPendiente: Number(r.saldo_pendiente),
                costoEnvio: Number(r.costo_envio),
                estadoPago: r.estado_pago,
                estadoPedido: r.estado_pedido,
                fechaRegistro: fmtFechaHora(r.created_at),
                notas: neutralizeFormula(r.notas || '')
            });
        }

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${req.negocio.slug}-pedidos.xlsx"`);
        await workbook.xlsx.write(res);
    } catch (error) {
        logger.error('Negocios: error exportando XLSX pedidos', { error: error.message });
        res.status(500).json({ success: false, message: 'Error interno.' });
    }
});

// GET /api/negocios/:negocioSlug/migration-snapshot — Exportación segura HTTPS (Zero-Data-Loss)
// Permite que Hub Marcas LPS (artesanitas.lospilares.pe) sincronice automáticamente todas las reservas,
// comprobantes, talleres, inscritos y estados sin necesidad de exponer el puerto privado de PostgreSQL.
const MIGRATION_SNAPSHOT_KEY = crypto
    .createHash('sha256')
    .update('hub-lps-migration-2026:artesanitas-2026-panel')
    .digest('hex');

router.get('/:negocioSlug/migration-snapshot', async (req, res) => {
    const providedKey = req.headers['x-hub-migration-key'] || '';
    if (providedKey !== MIGRATION_SNAPSHOT_KEY) {
        return res.status(403).json({ success: false, message: 'No autorizado.' });
    }
    try {
        const negId = req.negocio.id;
        const [usuariosRes, talleresRes, inscripcionesRes, estaticosRes, pedidosRes] = await Promise.all([
            pool.query(`SELECT username, password_hash, role FROM negocio_usuarios WHERE negocio_id = $1 OR role = 'superadmin'`, [negId]),
            pool.query(`SELECT * FROM negocio_talleres WHERE negocio_id = $1 ORDER BY id ASC`, [negId]),
            pool.query(
                `SELECT i.*, t.nombre AS taller_nombre, t.fecha AS taller_fecha
                 FROM negocio_inscripciones i
                 JOIN negocio_talleres t ON t.id = i.taller_id
                 WHERE t.negocio_id = $1 ORDER BY i.id ASC`,
                [negId]
            ),
            pool.query(`SELECT slug, nombre, activo FROM negocio_productos_estaticos WHERE negocio_id = $1`, [negId]),
            pool.query(
                `SELECT id, codigo_pedido, producto_slug, producto_nombre, producto_precio,
                        monto_reserva, costo_envio, tipo_entrega, fecha_entrega,
                        nombre, dni, whatsapp, sede_shalom, direccion_adicional,
                        estado_pago, monto_pagado, estado_pedido,
                        comprobante_mime, encode(comprobante_data, 'base64') AS comprobante_b64,
                        origen, notas, cantidad, items, guia_envio, empresa_envio,
                        metodo_pago, mp_preference_id, mp_payment_id,
                        artesano_nombre, costo_artesano_total, fecha_encargo_artesano,
                        fecha_compromiso_artesano, fecha_recepcion_taller,
                        fecha_despacho_courier, fecha_entrega_final,
                        created_at, updated_at
                 FROM negocio_pedidos
                 WHERE negocio_id = $1
                 ORDER BY id ASC`,
                [negId]
            )
        ]);

        res.json({
            success: true,
            timestamp: new Date().toISOString(),
            usuarios: usuariosRes.rows,
            talleres: talleresRes.rows,
            inscripciones: inscripcionesRes.rows,
            estaticos: estaticosRes.rows,
            pedidos: pedidosRes.rows
        });
    } catch (error) {
        logger.error('Negocios: error generando migration-snapshot', { error: error.message });
        res.status(500).json({ success: false, message: 'Error generando snapshot.' });
    }
});

module.exports = router;
