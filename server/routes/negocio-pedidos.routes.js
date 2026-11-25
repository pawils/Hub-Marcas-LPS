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
const { sendMetaCapiOrderEvent } = require('../utils/meta-capi.service');
const { analizarVoucherConIA } = require('../utils/voucher-ai.service');
const { getVapidPublicKey, savePushSubscription, notifyPushSubscribers } = require('../utils/web-push.service');
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
    },
    // ── Piezas del Catálogo General ──
    'taza-corazon-y-plato': {
        slug: 'taza-corazon-y-plato',
        nombre: 'Taza corazón y plato',
        precio: 75.00,
        reserva: 20.00,
        fecha_entrega: FECHA_ENTREGA_OFICIAL,
        imagen: '/imagenes/Artesanitas/Fotos/taza_corazón_y_ plato.jpeg',
        descripcion: 'Incluye platito. Modelada a mano con esmalte satinado.'
    },
    'taza-castellana': {
        slug: 'taza-castellana',
        nombre: 'Taza Castellana',
        precio: 55.00,
        reserva: 20.00,
        fecha_entrega: FECHA_ENTREGA_OFICIAL,
        imagen: '/imagenes/Artesanitas/Fotos/taza_castellana.jpeg',
        descripcion: 'Incluye platito. Diseño cálido y artesanal para uso diario.'
    },
    'elefantitos-decorativos': {
        slug: 'elefantitos-decorativos',
        nombre: 'Elefantitos decorativos',
        precio: 49.00,
        reserva: 20.00,
        fecha_entrega: FECHA_ENTREGA_OFICIAL,
        imagen: '/imagenes/Artesanitas/Fotos/elefantitos_decorativos_1.jpg',
        descripcion: 'Pieza decorativa para darle un toque especial a tu hogar.'
    },
    'elefantitos-decorativos-variante': {
        slug: 'elefantitos-decorativos-variante',
        nombre: 'Elefantitos decorativos (Variante)',
        precio: 49.00,
        reserva: 20.00,
        fecha_entrega: FECHA_ENTREGA_OFICIAL,
        imagen: '/imagenes/Artesanitas/Fotos/elefantitos_decorativos_2.jpeg',
        descripcion: 'Pieza decorativa con detalles únicos para el hogar.'
    },
    'taza-lavanda-abejita': {
        slug: 'taza-lavanda-abejita',
        nombre: 'Taza lavanda abejita',
        precio: 55.00,
        reserva: 20.00,
        fecha_entrega: FECHA_ENTREGA_OFICIAL,
        imagen: '/imagenes/Artesanitas/Fotos/taza_lavanda_abejita.jpeg',
        descripcion: 'Incluye platito. Diseño pintado a mano con detalles naturales.'
    },
    'jarron-prada': {
        slug: 'jarron-prada',
        nombre: 'Jarrón Prada',
        precio: 85.00,
        reserva: 20.00,
        fecha_entrega: FECHA_ENTREGA_OFICIAL,
        imagen: '/imagenes/Artesanitas/Fotos/jarron_prada.jpeg',
        descripcion: 'Pieza escultural y elegante para decoración de interiores.'
    },
    'munequitas': {
        slug: 'munequitas',
        nombre: 'Muñequitas',
        precio: 45.00,
        reserva: 20.00,
        fecha_entrega: FECHA_ENTREGA_OFICIAL,
        imagen: '/imagenes/Artesanitas/Fotos/muñequitas.jpeg',
        descripcion: 'Figura decorativa modelada y pintada a mano.'
    },
    'taza-stich-celeste': {
        slug: 'taza-stich-celeste',
        nombre: 'Taza Stich celeste',
        precio: 65.00,
        reserva: 20.00,
        fecha_entrega: FECHA_ENTREGA_OFICIAL,
        imagen: '/imagenes/Artesanitas/Fotos/Taza_Stich_sin_plato_1.jpeg',
        descripcion: 'Taza temática en celeste pastel con detalle interno esculpido a mano.'
    },
    'taza-stich-azul': {
        slug: 'taza-stich-azul',
        nombre: 'Taza Stich azul',
        precio: 65.00,
        reserva: 20.00,
        fecha_entrega: FECHA_ENTREGA_OFICIAL,
        imagen: '/imagenes/Artesanitas/Fotos/taza_stich_1.jpeg',
        descripcion: 'Taza temática en azul profundo con mensaje Ohana y figura en relieve.'
    },
    'taza-runner': {
        slug: 'taza-runner',
        nombre: 'Taza Runner',
        precio: 42.00,
        reserva: 20.00,
        fecha_entrega: FECHA_ENTREGA_OFICIAL,
        imagen: '/imagenes/Artesanitas/Fotos/taza_runner_1.jpeg',
        descripcion: 'Taza temática especial de cerámica para apasionados del running.'
    },
    'tetera-corazon': {
        slug: 'tetera-corazon',
        nombre: 'Tetera Corazón',
        precio: 85.00,
        reserva: 20.00,
        fecha_entrega: FECHA_ENTREGA_OFICIAL,
        imagen: '/imagenes/Artesanitas/Fotos/tetera_corazon_1.jpeg',
        descripcion: 'Tetera de cerámica modelada a mano con detalles de corazones.'
    },
    'palo-rosa-lb': {
        slug: 'palo-rosa-lb',
        nombre: 'Palo Rosa LB',
        precio: 69.00,
        reserva: 20.00,
        fecha_entrega: FECHA_ENTREGA_OFICIAL,
        imagen: '/imagenes/Artesanitas/Fotos/Taza_Rapunzel_PaloRosa_con-lineas_1.jpeg',
        descripcion: 'Taza artesanal con líneas texturizadas en tono palo rosa.'
    },
    'palo-rosa-full': {
        slug: 'taza-rapunzel-palo-rosa-sin-plato',
        nombre: 'Taza Rapunzel Palo Rosa (sin plato)',
        precio: 65.00,
        reserva: 20.00,
        fecha_entrega: FECHA_ENTREGA_OFICIAL,
        imagen: '/imagenes/Artesanitas/Fotos/Taza_Rapunzel_Palo_Rosa_sin_plato_1.jpeg',
        descripcion: 'Taza artesanal en color palo rosa entero.'
    },
    'morada-full': {
        slug: 'taza-rapunzel-morada-sin-plato',
        nombre: 'Taza Rapunzel Morada (sin plato)',
        precio: 65.00,
        reserva: 20.00,
        fecha_entrega: FECHA_ENTREGA_OFICIAL,
        imagen: '/imagenes/Artesanitas/Fotos/Taza_Rapunzel_Morada_sinplato_1.jpeg',
        descripcion: 'Taza artesanal en color morado entero.'
    },
    'morada-con-lineas': {
        slug: 'taza-rapunzel-morada-lineas',
        nombre: 'Taza Rapunzel Morada con líneas',
        precio: 69.90,
        reserva: 20.00,
        fecha_entrega: FECHA_ENTREGA_OFICIAL,
        imagen: '/imagenes/Artesanitas/Fotos/taza_Rapunzel_Morada_con_lineas_1.jpeg',
        descripcion: 'Taza artesanal morada con líneas texturizadas en relieve.'
    },
    'taza-rosada': {
        slug: 'taza-rosada',
        nombre: 'Taza rosada',
        precio: 65.00,
        reserva: 20.00,
        fecha_entrega: FECHA_ENTREGA_OFICIAL,
        imagen: '/imagenes/Artesanitas/Fotos/Taza_Rapunzel_Rosada_sinplato_1.jpeg',
        descripcion: 'Taza artesanal en tono rosa pastel delicado.'
    },
    'taza-shrek': {
        slug: 'taza-shrek',
        nombre: 'Taza Shrek',
        precio: 69.00,
        reserva: 20.00,
        fecha_entrega: FECHA_ENTREGA_OFICIAL,
        imagen: '/imagenes/Artesanitas/Fotos/taza_shrek_2.jpg',
        descripcion: 'Taza temática de cerámica inspirada en Shrek.'
    },
    'platos-uva': {
        slug: 'platos-uva',
        nombre: 'Platos uva',
        precio: 29.00,
        reserva: 20.00,
        fecha_entrega: FECHA_ENTREGA_OFICIAL,
        imagen: '/imagenes/Artesanitas/Fotos/Platos uva.jpeg',
        descripcion: 'Plato artesanal en tono uva profundo.'
    },
    'plato-morado-full': {
        slug: 'plato-morado-full',
        nombre: 'Plato morado full',
        precio: 32.00,
        reserva: 20.00,
        fecha_entrega: FECHA_ENTREGA_OFICIAL,
        imagen: '/imagenes/Artesanitas/Fotos/Plato morado full.jpeg',
        descripcion: 'Plato artesanal en color morado entero.'
    },
    'vaso-van-gogh': {
        slug: 'vasito-van-gogh',
        nombre: 'Vasito Van Gogh',
        precio: 59.00,
        reserva: 20.00,
        fecha_entrega: FECHA_ENTREGA_OFICIAL,
        imagen: '/imagenes/Artesanitas/Fotos/vasito_van_gogh_0.jpeg',
        descripcion: 'Vasito de cerámica inspirado en Van Gogh.'
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
                      tipo_entrega, fecha_entrega, sede_shalom, ciudad_destino, estado_pago, monto_pagado, estado_pedido,
                      COALESCE(etapa_artesano, 'recibido') AS etapa_artesano, COALESCE(qa_estado, 'pendiente') AS qa_estado,
                      guia_envio, COALESCE(empresa_envio, 'Shalom') AS empresa_envio, created_at, updated_at,
                      (producto_precio - monto_pagado) AS saldo_pendiente
               FROM negocio_pedidos
               WHERE negocio_id = $1 AND dni = $2
               ORDER BY created_at DESC
               LIMIT 10`
            : `SELECT id, codigo_pedido, producto_slug, producto_nombre, COALESCE(cantidad, 1) AS cantidad,
                      COALESCE(items, '[]'::jsonb) AS items, producto_precio, monto_reserva, costo_envio,
                      tipo_entrega, fecha_entrega, sede_shalom, ciudad_destino, estado_pago, monto_pagado, estado_pedido,
                      COALESCE(etapa_artesano, 'recibido') AS etapa_artesano, COALESCE(qa_estado, 'pendiente') AS qa_estado,
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

        // Sprint 5: Validación Inteligente de Voucher Yape/Plin con Visión IA (Anti-Fraude)
        let voucherAi = {
            nro_operacion: null,
            monto_detectado: null,
            entidad_detectada: null,
            verificacion_ia: 'pendiente'
        };
        if (file && file.buffer) {
            voucherAi = await analizarVoucherConIA({
                fileBuffer: file.buffer,
                mimeType: file.mimetype,
                montoEsperado: pReservaTotal,
                negocioId: req.negocio.id
            });
        }

        const insertQuery = `
            INSERT INTO negocio_pedidos (
                negocio_id, codigo_pedido, producto_slug, producto_nombre, cantidad, items, producto_precio,
                monto_reserva, costo_envio, tipo_entrega, fecha_entrega,
                nombre, dni, whatsapp, sede_shalom, direccion_adicional,
                estado_pago, monto_pagado, estado_pedido,
                origen, notas,
                comprobante_mime, comprobante_data,
                voucher_nro_operacion, voucher_monto_detectado, voucher_entidad_detectada, voucher_verificacion_ia,
                meta_event_id
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7,
                $8, $9, $10, $11,
                $12, $13, $14, $15, $16,
                $17, $18, $19,
                $20, $21,
                $22, $23,
                $24, $25, $26, $27,
                $28
            )
            RETURNING id, codigo_pedido, producto_slug, producto_nombre, cantidad, items, fecha_entrega, nombre, dni, whatsapp, tipo_entrega, sede_shalom, monto_reserva, voucher_verificacion_ia, voucher_nro_operacion, voucher_monto_detectado, created_at
        `;

        const { rows } = await pool.query(insertQuery, [
            req.negocio.id, codigoPedido, pSlugPrincipal, pNombreResumen, totalCantidad, JSON.stringify(itemsValidados), pPrecioTotal,
            pReservaTotal, pEnvio, cleanTipoEntrega, pFechaEntrega,
            cleanNombre, cleanDni, cleanWhatsapp, cleanSedeShalom, cleanDireccion || null,
            'parcial', pReservaTotal, 'reservado',
            'formulario', cleanNotas || null,
            file ? file.mimetype : null, file ? file.buffer : null,
            voucherAi.nro_operacion, voucherAi.monto_detectado, voucherAi.entidad_detectada, voucherAi.verificacion_ia,
            codigoPedido
        ]);

        const pedido = rows[0];

        // Descuento automático de stock estilo Shopify si la pieza está en inventario físico (stock_actual > 0)
        for (const item of itemsValidados) {
            try {
                const { rows: prodStockRows } = await pool.query(
                    `SELECT id, stock_actual, ubicacion_almacen FROM negocio_productos WHERE negocio_id = $1 AND LOWER(slug) = LOWER($2) LIMIT 1`,
                    [req.negocio.id, item.slug]
                );
                if (prodStockRows.length > 0 && Number(prodStockRows[0].stock_actual) > 0) {
                    const pRow = prodStockRows[0];
                    const ant = Number(pRow.stock_actual);
                    const descontar = Math.min(ant, Number(item.cantidad || 1));
                    const nuevo = Math.max(0, ant - descontar);
                    await pool.query(`UPDATE negocio_productos SET stock_actual = $1 WHERE id = $2`, [nuevo, pRow.id]);
                    await pool.query(
                        `INSERT INTO negocio_inventario_movimientos (negocio_id, producto_id, tipo_movimiento, cantidad_anterior, delta, cantidad_nueva, ubicacion, motivo_referencia, usuario)
                         VALUES ($1, $2, 'salida_venta', $3, $4, $5, $6, $7, 'checkout_web')`,
                        [req.negocio.id, pRow.id, ant, -descontar, nuevo, pRow.ubicacion_almacen || 'Almacén Principal Trujillo', `Reserva Web ${pedido.codigo_pedido}`]
                    );
                }
            } catch (invErr) {
                logger.warn('Inventario: no se pudo descontar stock automático', { error: invErr.message });
            }
        }

        // Sprint 4: Meta Conversions API (CAPI Server-Side) con deduplicación 1:1 (event_id = codigo_pedido)
        sendMetaCapiOrderEvent({
            negocio: req.negocio,
            pedido,
            req,
            montoEvento: pReservaTotal
        }).catch(err => logger.error('Negocios: error en Meta CAPI', { error: err.message }));

        // Sprint 6: Notificación Web Push al Administrador por nueva reserva
        notifyPushSubscribers({
            negocioId: req.negocio.id,
            rol: 'admin',
            title: `Nueva Reserva ${pedido.codigo_pedido}`,
            body: `${cleanNombre} reservó ${pNombreResumen} (Abono: S/ ${pReservaTotal.toFixed(2)})`,
            url: '/registros'
        }).catch(() => {});

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
            meta_event_id: pedido.codigo_pedido,
            message: `¡Tu reserva (${pedido.codigo_pedido}) para ${pNombreResumen} ha sido registrada con éxito! Puedes rastrear el estado de tu pedido en cualquier momento con tu código o DNI.`,
            pedido: {
                id: pedido.id,
                codigo_pedido: pedido.codigo_pedido,
                meta_event_id: pedido.codigo_pedido,
                seguimiento_url: `/seguimiento?codigo=${encodeURIComponent(pedido.codigo_pedido)}`,
                nombre: pedido.nombre,
                producto: pedido.producto_nombre,
                cantidad: pedido.cantidad,
                items: pedido.items,
                tipo_entrega: pedido.tipo_entrega,
                fecha_entrega: pedido.fecha_entrega,
                voucher_verificacion_ia: pedido.voucher_verificacion_ia
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

// ── 2B. GET /api/negocios/:negocioSlug/bi-resumen — Admin (Sprint 2): Dashboard BI & Rentabilidad por Línea y Artesano ──
router.get('/:negocioSlug/bi-resumen', requireNegocioAuth, async (req, res) => {
    try {
        const biQuery = `
            WITH pedidos_activos AS (
                SELECT
                    p.id,
                    p.codigo_pedido,
                    p.producto_slug,
                    p.producto_nombre,
                    COALESCE(p.cantidad, 1) AS cantidad,
                    COALESCE(p.items, '[]'::jsonb) AS items,
                    COALESCE(p.producto_precio, 0)::numeric AS producto_precio,
                    COALESCE(p.monto_pagado, 0)::numeric AS monto_pagado,
                    GREATEST(0, COALESCE(p.producto_precio, 0) - COALESCE(p.monto_pagado, 0))::numeric AS saldo_pendiente,
                    COALESCE(p.costo_envio, 0)::numeric AS costo_envio,
                    p.tipo_entrega,
                    p.estado_pago,
                    p.estado_pedido,
                    NULLIF(TRIM(p.artesano_nombre), '') AS artesano_nombre,
                    p.costo_artesano_total,
                    p.fecha_encargo_artesano,
                    p.fecha_compromiso_artesano,
                    p.fecha_recepcion_taller,
                    p.created_at
                FROM negocio_pedidos p
                WHERE p.negocio_id = $1
                  AND p.estado_pedido != 'cancelado'
            ),
            items_expandidos AS (
                SELECT
                    pa.id AS pedido_id,
                    pa.artesano_nombre,
                    pa.costo_artesano_total,
                    pa.cantidad AS pedido_cantidad_total,
                    LOWER(COALESCE(it->>'slug', pa.producto_slug)) AS item_slug,
                    COALESCE(it->>'nombre', pa.producto_nombre) AS item_nombre,
                    GREATEST(1, COALESCE((it->>'cantidad')::int, pa.cantidad, 1)) AS item_cantidad,
                    COALESCE((it->>'precio')::numeric, (pa.producto_precio / GREATEST(1, pa.cantidad)))::numeric AS item_precio_unitario
                FROM pedidos_activos pa
                LEFT JOIN LATERAL jsonb_array_elements(
                    CASE
                        WHEN jsonb_typeof(pa.items) = 'array' AND jsonb_array_length(pa.items) > 0 THEN pa.items
                        ELSE jsonb_build_array(
                            jsonb_build_object(
                                'slug', pa.producto_slug,
                                'nombre', pa.producto_nombre,
                                'cantidad', pa.cantidad,
                                'precio', CASE WHEN pa.cantidad > 0 THEN ROUND(pa.producto_precio / pa.cantidad, 2) ELSE pa.producto_precio END
                            )
                        )
                    END
                ) AS it ON TRUE
            ),
            items_clasificados AS (
                SELECT
                    ie.pedido_id,
                    ie.item_slug,
                    ie.item_nombre,
                    ie.item_cantidad,
                    (ie.item_cantidad * ie.item_precio_unitario)::numeric(12,2) AS subtotal_item,
                    COALESCE(
                        np.costo_artesano * ie.item_cantidad,
                        CASE
                            WHEN ie.costo_artesano_total IS NOT NULL AND ie.pedido_cantidad_total > 0
                            THEN (ie.costo_artesano_total / ie.pedido_cantidad_total) * ie.item_cantidad
                            ELSE 0
                        END
                    )::numeric(12,2) AS costo_artesano_item,
                    COALESCE(
                        NULLIF(TRIM(np.linea), ''),
                        CASE
                            WHEN ie.item_slug LIKE '%adorno%' OR ie.item_slug LIKE '%elefantito%' OR ie.item_slug LIKE '%munequita%' OR ie.item_slug LIKE '%jarron%' THEN 'Decoración & Maceteros'
                            WHEN ie.item_slug LIKE '%pintar%' OR ie.item_slug LIKE '%kit%' THEN 'Kits Creativos'
                            WHEN ie.item_slug LIKE '%set%' OR ie.item_slug LIKE '%plato%' THEN 'Sets de Regalo'
                            ELSE 'Vajilla Artesanal'
                        END
                    ) AS linea,
                    COALESCE(
                        NULLIF(TRIM(np.sublinea), ''),
                        CASE
                            WHEN ie.item_slug LIKE '%tetera%' OR ie.item_slug LIKE '%azucarera%' THEN 'Teteras & Azucareras'
                            WHEN ie.item_slug LIKE '%plato%' AND ie.item_slug NOT LIKE '%taza%' THEN 'Platos & Bowls'
                            WHEN ie.item_slug LIKE '%adorno%' OR ie.item_slug LIKE '%munequita%' OR ie.item_slug LIKE '%elefantito%' THEN 'Adornos con Plantita'
                            WHEN ie.item_slug LIKE '%jarron%' THEN 'Jarrones & Esculturas'
                            WHEN ie.item_slug LIKE '%pintar%' THEN 'Cerámica para Pintar'
                            ELSE 'Tazas & Mugs'
                        END
                    ) AS sublinea,
                    COALESCE(
                        NULLIF(TRIM(np.coleccion), ''),
                        CASE
                            WHEN ie.item_slug LIKE '%navidad%' OR ie.item_slug LIKE '%papa-noel%' OR ie.item_slug LIKE '%muneco-de-nieve%' OR ie.item_slug LIKE '%arbolito%' THEN 'Colección Navidad 2026'
                            WHEN ie.item_slug LIKE '%van-gogh%' THEN 'Colección Van Gogh'
                            WHEN ie.item_slug LIKE '%rapunzel%' OR ie.item_slug LIKE '%palo-rosa%' OR ie.item_slug LIKE '%morada%' THEN 'Colección Rapunzel'
                            WHEN ie.item_slug LIKE '%stich%' OR ie.item_slug LIKE '%piston%' OR ie.item_slug LIKE '%snoopy%' OR ie.item_slug LIKE '%shrek%' OR ie.item_slug LIKE '%perry%' OR ie.item_slug LIKE '%formula%' THEN 'Personajes & Licencias'
                            ELSE 'Catálogo General'
                        END
                    ) AS coleccion
                FROM items_expandidos ie
                LEFT JOIN negocio_productos np
                    ON np.negocio_id = $1 AND LOWER(np.slug) = ie.item_slug
            ),
            costo_por_pedido AS (
                SELECT
                    pa.id,
                    COALESCE(
                        pa.costo_artesano_total,
                        (SELECT SUM(ic.costo_artesano_item) FROM items_clasificados ic WHERE ic.pedido_id = pa.id),
                        0
                    )::numeric(12,2) AS costo_efectivo
                FROM pedidos_activos pa
            ),
            resumen_financiero AS (
                SELECT
                    COUNT(pa.id)::int AS total_pedidos,
                    COALESCE(SUM(pa.cantidad), 0)::int AS total_piezas,
                    COALESCE(SUM(pa.producto_precio), 0)::numeric(12,2) AS ventas_totales,
                    COALESCE(SUM(pa.monto_pagado), 0)::numeric(12,2) AS total_abonado,
                    COALESCE(SUM(pa.saldo_pendiente), 0)::numeric(12,2) AS saldos_por_cobrar,
                    COALESCE(SUM(cpp.costo_efectivo), 0)::numeric(12,2) AS costo_total_artesanos,
                    (COALESCE(SUM(pa.producto_precio), 0) - COALESCE(SUM(cpp.costo_efectivo), 0))::numeric(12,2) AS margen_bruto_soles,
                    CASE
                        WHEN COALESCE(SUM(pa.producto_precio), 0) > 0
                        THEN ROUND(((COALESCE(SUM(pa.producto_precio), 0) - COALESCE(SUM(cpp.costo_efectivo), 0)) / SUM(pa.producto_precio)) * 100, 1)
                        ELSE 0
                    END AS margen_bruto_pct
                FROM pedidos_activos pa
                LEFT JOIN costo_por_pedido cpp ON cpp.id = pa.id
            ),
            jerarquia_agg AS (
                SELECT
                    ic.linea,
                    ic.sublinea,
                    ic.coleccion,
                    COUNT(DISTINCT ic.pedido_id)::int AS pedidos,
                    COALESCE(SUM(ic.item_cantidad), 0)::int AS piezas,
                    COALESCE(SUM(ic.subtotal_item), 0)::numeric(12,2) AS ventas_soles,
                    COALESCE(SUM(ic.costo_artesano_item), 0)::numeric(12,2) AS costo_artesano_soles,
                    (COALESCE(SUM(ic.subtotal_item), 0) - COALESCE(SUM(ic.costo_artesano_item), 0))::numeric(12,2) AS margen_soles
                FROM items_clasificados ic
                GROUP BY ic.linea, ic.sublinea, ic.coleccion
                ORDER BY ventas_soles DESC, piezas DESC
            ),
            artesanos_agg AS (
                SELECT
                    COALESCE(pa.artesano_nombre, 'Sin asignar (Taller propio)') AS artesano,
                    (pa.artesano_nombre IS NOT NULL) AS asignado,
                    COUNT(pa.id)::int AS pedidos_asignados,
                    COALESCE(SUM(pa.cantidad), 0)::int AS piezas_asignadas,
                    COUNT(*) FILTER (
                        WHERE (
                            pa.fecha_recepcion_taller IS NOT NULL
                            AND (pa.fecha_compromiso_artesano IS NULL OR pa.fecha_recepcion_taller::date <= pa.fecha_compromiso_artesano)
                        ) OR (
                            pa.estado_pedido IN ('recibido_taller', 'enviado', 'entregado', 'post_venta')
                            AND (pa.fecha_compromiso_artesano IS NULL OR COALESCE(pa.fecha_recepcion_taller::date, CURRENT_DATE) <= pa.fecha_compromiso_artesano)
                        )
                    )::int AS entregados_a_tiempo,
                    COUNT(*) FILTER (
                        WHERE (
                            pa.fecha_compromiso_artesano IS NOT NULL
                            AND pa.fecha_recepcion_taller IS NOT NULL
                            AND pa.fecha_recepcion_taller::date > pa.fecha_compromiso_artesano
                        ) OR (
                            pa.fecha_compromiso_artesano IS NOT NULL
                            AND pa.fecha_recepcion_taller IS NULL
                            AND pa.estado_pedido NOT IN ('recibido_taller', 'enviado', 'entregado', 'post_venta')
                            AND CURRENT_DATE > pa.fecha_compromiso_artesano
                        )
                    )::int AS atrasados,
                    COUNT(*) FILTER (
                        WHERE pa.estado_pedido NOT IN ('recibido_taller', 'enviado', 'entregado', 'post_venta')
                    )::int AS en_produccion,
                    COALESCE(SUM(cpp.costo_efectivo), 0)::numeric(12,2) AS pago_acumulado,
                    COALESCE(SUM(pa.producto_precio), 0)::numeric(12,2) AS ventas_generadas
                FROM pedidos_activos pa
                LEFT JOIN costo_por_pedido cpp ON cpp.id = pa.id
                GROUP BY COALESCE(pa.artesano_nombre, 'Sin asignar (Taller propio)'), (pa.artesano_nombre IS NOT NULL)
                ORDER BY asignado DESC, pedidos_asignados DESC, ventas_generadas DESC
            )
            SELECT
                (SELECT row_to_json(rf) FROM resumen_financiero rf) AS finanzas,
                COALESCE((SELECT json_agg(ja) FROM jerarquia_agg ja), '[]'::json) AS jerarquia_retail,
                COALESCE((SELECT json_agg(aa) FROM artesanos_agg aa), '[]'::json) AS artesanos;
        `;

        const { rows } = await pool.query(biQuery, [req.negocio.id]);
        const data = rows[0] || {};
        res.json({
            success: true,
            finanzas: data.finanzas || {
                total_pedidos: 0,
                total_piezas: 0,
                ventas_totales: 0,
                total_abonado: 0,
                saldos_por_cobrar: 0,
                costo_total_artesanos: 0,
                margen_bruto_soles: 0,
                margen_bruto_pct: 0
            },
            jerarquia_retail: data.jerarquia_retail || [],
            artesanos: data.artesanos || []
        });
    } catch (error) {
        logger.error('Negocios: error calculando bi-resumen', { error: error.message, stack: error.stack });
        res.status(500).json({ success: false, message: 'Error al calcular métricas BI.' });
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
                   nombre, dni, whatsapp, sede_shalom, ciudad_destino, direccion_adicional,
                   estado_pago, monto_pagado, estado_pedido, guia_envio, COALESCE(empresa_envio, 'Shalom') AS empresa_envio,
                   artesano_id, artesano_nombre, costo_artesano_total, fecha_encargo_artesano, fecha_compromiso_artesano, fecha_recepcion_taller,
                   COALESCE(etapa_artesano, 'recibido') AS etapa_artesano, especificaciones_artesano,
                   COALESCE(qa_estado, 'pendiente') AS qa_estado, COALESCE(qa_checklist, '{"onzas":false,"logos":false,"colores":false,"acabados":false}'::jsonb) AS qa_checklist, qa_observaciones,
                   voucher_nro_operacion, voucher_monto_detectado, voucher_entidad_detectada, COALESCE(voucher_verificacion_ia, 'pendiente') AS voucher_verificacion_ia,
                   (comprobante_data IS NOT NULL) AS tiene_comprobante,
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

// ── 2C. GET /api/negocios/:negocioSlug/pedidos/:id/comprobante — Admin: Ver imagen del comprobante Plin/Yape ──
router.get('/:negocioSlug/pedidos/:id/comprobante', async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT comprobante_mime, comprobante_data FROM negocio_pedidos WHERE id = $1 AND negocio_id = $2`,
            [req.params.id, req.negocio.id]
        );
        if (rows.length === 0 || !rows[0].comprobante_data) {
            return res.status(404).send('Comprobante no disponible.');
        }
        res.setHeader('Content-Type', rows[0].comprobante_mime || 'image/jpeg');
        res.setHeader('Cache-Control', 'private, max-age=3600');
        res.send(rows[0].comprobante_data);
    } catch (error) {
        res.status(500).send('Error al cargar comprobante.');
    }
});

// ── 3. PATCH /api/negocios/:negocioSlug/pedidos/:id — Admin: Actualizar estado / montos / guía Shalom / Artesano & QA ──
router.patch('/:negocioSlug/pedidos/:id', requireNegocioAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            estado_pago, monto_pagado, estado_pedido, notas, sede_shalom, ciudad_destino, fecha_entrega,
            guia_envio, empresa_envio, artesano_id, artesano_nombre, fecha_compromiso_artesano, costo_artesano_total,
            etapa_artesano, especificaciones_artesano, qa_estado, qa_checklist, qa_observaciones,
            voucher_verificacion_ia, voucher_nro_operacion
        } = req.body;

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

        if (etapa_artesano !== undefined) {
            const validEtapas = ['recibido', 'modelado', 'primer_horno', 'segundo_horno', 'pintado_acabados', 'listo_revision_qa', 'enviado_taller'];
            if (validEtapas.includes(etapa_artesano)) {
                set('etapa_artesano', etapa_artesano);
            }
        }

        if (qa_estado !== undefined) {
            if (['pendiente', 'aprobado', 'observado'].includes(qa_estado)) {
                set('qa_estado', qa_estado);
            }
        }

        if (qa_checklist !== undefined && typeof qa_checklist === 'object') {
            set('qa_checklist', JSON.stringify({
                onzas: !!qa_checklist.onzas,
                logos: !!qa_checklist.logos,
                colores: !!qa_checklist.colores,
                acabados: !!qa_checklist.acabados
            }));
        }

        if (qa_observaciones !== undefined) set('qa_observaciones', sanitizeText(qa_observaciones) || null);
        if (especificaciones_artesano !== undefined) set('especificaciones_artesano', sanitizeText(especificaciones_artesano) || null);
        if (ciudad_destino !== undefined) set('ciudad_destino', sanitizeText(ciudad_destino) || null);
        if (fecha_entrega !== undefined && sanitizeText(fecha_entrega)) set('fecha_entrega', sanitizeText(fecha_entrega));
        if (notas !== undefined) set('notas', sanitizeText(notas) || null);
        if (sede_shalom !== undefined) set('sede_shalom', sanitizeText(sede_shalom));
        if (guia_envio !== undefined) set('guia_envio', sanitizeText(guia_envio) || null);
        if (empresa_envio !== undefined) set('empresa_envio', sanitizeText(empresa_envio) || 'Shalom');
        if (voucher_verificacion_ia !== undefined && ['verificado', 'monto_difiere', 'duplicado', 'pendiente'].includes(voucher_verificacion_ia)) {
            set('voucher_verificacion_ia', voucher_verificacion_ia);
        }
        if (voucher_nro_operacion !== undefined) set('voucher_nro_operacion', sanitizeText(voucher_nro_operacion) || null);

        // Si se asigna artesano por nombre o id, sincronizar con negocio_artesanos para que tenga su Magic Link activo
        let resolvedArtesanoId = artesano_id ? parseInt(artesano_id, 10) : undefined;
        let resolvedArtesanoNombre = artesano_nombre !== undefined ? sanitizeText(artesano_nombre) : undefined;

        if (resolvedArtesanoNombre) {
            const tokenSeed = crypto.randomBytes(16).toString('hex');
            const { rows: artRows } = await pool.query(
                `INSERT INTO negocio_artesanos (negocio_id, nombre, access_token, activo)
                 VALUES ($1, $2, $3, TRUE)
                 ON CONFLICT (negocio_id, nombre) DO UPDATE SET activo = TRUE
                 RETURNING id, nombre`,
                [req.negocio.id, resolvedArtesanoNombre, tokenSeed]
            );
            if (artRows.length > 0) {
                resolvedArtesanoId = artRows[0].id;
            }
        } else if (resolvedArtesanoId) {
            const { rows: artRows } = await pool.query(
                `SELECT id, nombre FROM negocio_artesanos WHERE id = $1 AND negocio_id = $2`,
                [resolvedArtesanoId, req.negocio.id]
            );
            if (artRows.length > 0) {
                resolvedArtesanoNombre = artRows[0].nombre;
            }
        }

        if (resolvedArtesanoNombre !== undefined) set('artesano_nombre', resolvedArtesanoNombre || null);
        if (resolvedArtesanoId !== undefined && !Number.isNaN(resolvedArtesanoId)) set('artesano_id', resolvedArtesanoId || null);

        if (fecha_compromiso_artesano !== undefined) set('fecha_compromiso_artesano', sanitizeText(fecha_compromiso_artesano) || null);
        if (costo_artesano_total !== undefined) {
            const cArt = costo_artesano_total === '' || costo_artesano_total === null ? null : parseFloat(costo_artesano_total);
            set('costo_artesano_total', Number.isFinite(cArt) && cArt >= 0 ? cArt : null);
        }
        if (estado_pedido === 'encargado_artesano' || resolvedArtesanoNombre) {
            updates.push('fecha_encargo_artesano = COALESCE(fecha_encargo_artesano, CURRENT_DATE)');
        }
        if (estado_pedido === 'recibido_taller' || etapa_artesano === 'enviado_taller') {
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
                      estado_pago, monto_pagado, estado_pedido, etapa_artesano, especificaciones_artesano,
                      qa_estado, qa_checklist, qa_observaciones, ciudad_destino, fecha_entrega,
                      guia_envio, empresa_envio, artesano_id, artesano_nombre, costo_artesano_total, fecha_compromiso_artesano, fecha_recepcion_taller,
                      voucher_nro_operacion, voucher_monto_detectado, voucher_entidad_detectada, voucher_verificacion_ia,
                      notas, sede_shalom,
                      (producto_precio - monto_pagado) AS saldo_pendiente
        `;

        const { rows } = await pool.query(query, params);
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Pedido no encontrado.' });
        }

        const updated = rows[0];

        // Sprint 6: Notificación Web Push automática al comprador cuando su pedido está listo o tiene guía de envío
        if (updated.codigo_pedido && (guia_envio || estado_pedido === 'enviado' || estado_pedido === 'recibido_taller')) {
            const pushTitle = updated.guia_envio
                ? `Tu pedido ${updated.codigo_pedido} está en envío`
                : `Avance de tu pedido ${updated.codigo_pedido}`;
            const pushBody = updated.guia_envio
                ? `Enviado por ${updated.empresa_envio || 'Shalom'}. Guía: ${updated.guia_envio}.`
                : `Tu pieza artesanal pasó control de calidad y está lista en el taller de Artesanitas.`;
            notifyPushSubscribers({
                negocioId: req.negocio.id,
                rol: 'comprador',
                codigoPedido: updated.codigo_pedido,
                title: pushTitle,
                body: pushBody,
                url: `/seguimiento?codigo=${encodeURIComponent(updated.codigo_pedido)}`
            }).catch(() => {});
        }

        res.json({ success: true, pedido: updated });
    } catch (error) {
        logger.error('Negocios: error actualizando pedido', { error: error.message });
        res.status(500).json({ success: false, message: 'Error interno.' });
    }
});

// ── 3B. SPRINT 3: Gestión de Artesanos Tercerizados y Mini-Portal Magic Link ──

// GET /api/negocios/:negocioSlug/artesanos — Admin: Listar artesanos con su Magic Link y carga de trabajo
router.get('/:negocioSlug/artesanos', requireNegocioAuth, async (req, res) => {
    try {
        // Sincronizar cualquier artesano_nombre existente en negocio_pedidos que aún no tenga fila en negocio_artesanos
        const { rows: distinctNames } = await pool.query(
            `SELECT DISTINCT TRIM(artesano_nombre) AS nombre
             FROM negocio_pedidos
             WHERE negocio_id = $1 AND artesano_nombre IS NOT NULL AND TRIM(artesano_nombre) != ''`,
            [req.negocio.id]
        );
        for (const r of distinctNames) {
            const tok = crypto.randomBytes(16).toString('hex');
            await pool.query(
                `INSERT INTO negocio_artesanos (negocio_id, nombre, access_token, activo)
                 VALUES ($1, $2, $3, TRUE)
                 ON CONFLICT (negocio_id, nombre) DO NOTHING`,
                [req.negocio.id, r.nombre, tok]
            );
        }

        const { rows } = await pool.query(
            `SELECT
                a.id, a.nombre, a.whatsapp, a.especialidad, a.access_token, a.activo, a.created_at,
                COUNT(p.id) FILTER (WHERE p.estado_pedido != 'cancelado')::int AS total_pedidos,
                COUNT(p.id) FILTER (WHERE p.estado_pedido NOT IN ('recibido_taller', 'enviado', 'entregado', 'post_venta', 'cancelado'))::int AS pedidos_activos,
                COUNT(p.id) FILTER (WHERE p.etapa_artesano = 'listo_revision_qa' AND COALESCE(p.qa_estado, 'pendiente') = 'pendiente')::int AS pendientes_qa
             FROM negocio_artesanos a
             LEFT JOIN negocio_pedidos p
               ON p.negocio_id = a.negocio_id AND (p.artesano_id = a.id OR LOWER(TRIM(p.artesano_nombre)) = LOWER(TRIM(a.nombre)))
             WHERE a.negocio_id = $1
             GROUP BY a.id
             ORDER BY a.activo DESC, pedidos_activos DESC, a.nombre ASC`,
            [req.negocio.id]
        );

        res.json({ success: true, artesanos: rows });
    } catch (error) {
        logger.error('Negocios: error listando artesanos', { error: error.message });
        res.status(500).json({ success: false, message: 'Error al listar artesanos.' });
    }
});

// POST /api/negocios/:negocioSlug/artesanos — Admin: Crear o actualizar artesano y generar Magic Link
router.post('/:negocioSlug/artesanos', requireNegocioAuth, async (req, res) => {
    try {
        const cleanNombre = sanitizeText(req.body.nombre).slice(0, 120);
        const cleanWhatsapp = sanitizeText(req.body.whatsapp).slice(0, 25);
        const cleanEspecialidad = sanitizeText(req.body.especialidad || 'Modelado, Horneado y Pintura Cerámica').slice(0, 120);

        if (!cleanNombre || cleanNombre.length < 2) {
            return res.status(400).json({ success: false, message: 'Ingresa el nombre del artesano o taller aliado.' });
        }

        const token = crypto.randomBytes(16).toString('hex');
        const { rows } = await pool.query(
            `INSERT INTO negocio_artesanos (negocio_id, nombre, whatsapp, especialidad, access_token, activo)
             VALUES ($1, $2, $3, $4, $5, TRUE)
             ON CONFLICT (negocio_id, nombre) DO UPDATE
             SET whatsapp = COALESCE(NULLIF(EXCLUDED.whatsapp, ''), negocio_artesanos.whatsapp),
                 especialidad = COALESCE(NULLIF(EXCLUDED.especialidad, ''), negocio_artesanos.especialidad),
                 activo = TRUE
             RETURNING id, nombre, whatsapp, especialidad, access_token, activo`,
            [req.negocio.id, cleanNombre, cleanWhatsapp || null, cleanEspecialidad, token]
        );

        res.status(201).json({ success: true, artesano: rows[0] });
    } catch (error) {
        logger.error('Negocios: error creando artesano', { error: error.message });
        res.status(500).json({ success: false, message: 'Error al guardar el artesano.' });
    }
});

// GET /api/negocios/:negocioSlug/artesano-portal/:token — Público (Magic Link):
// Devuelve TODAS las solicitudes asignadas al artesano (puede tener 3, 5, 10+ solicitudes de distintos clientes),
// con las especificaciones del administrador (cotización pactada con el artesano, tamaños, onzas, colores, logos),
// OCULTANDO precios de venta al cliente final, DNI y WhatsApp del comprador.
router.get('/:negocioSlug/artesano-portal/:token', trackingLimiter, async (req, res) => {
    try {
        const cleanToken = sanitizeText(req.params.token);
        if (!cleanToken || cleanToken.length < 10) {
            return res.status(400).json({ success: false, message: 'Enlace de artesano inválido.' });
        }

        const { rows: artRows } = await pool.query(
            `SELECT id, nombre, whatsapp, especialidad, activo
             FROM negocio_artesanos
             WHERE negocio_id = $1 AND access_token = $2 AND activo = TRUE
             LIMIT 1`,
            [req.negocio.id, cleanToken]
        );

        if (artRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Enlace Magic Link no válido o desactivado.' });
        }

        const artesano = artRows[0];

        // Solo seleccionamos campos técnicos de taller y cotización del artesano (NUNCA producto_precio, dni ni whatsapp del cliente)
        const { rows: pedidos } = await pool.query(
            `SELECT
                p.id,
                p.codigo_pedido,
                p.producto_slug,
                p.producto_nombre,
                COALESCE(p.cantidad, 1) AS cantidad,
                COALESCE(p.items, '[]'::jsonb) AS items,
                p.costo_artesano_total,
                p.fecha_encargo_artesano,
                p.fecha_compromiso_artesano,
                p.fecha_recepcion_taller,
                p.estado_pedido,
                COALESCE(p.etapa_artesano, 'recibido') AS etapa_artesano,
                p.especificaciones_artesano,
                COALESCE(p.qa_estado, 'pendiente') AS qa_estado,
                COALESCE(p.qa_checklist, '{"onzas":false,"logos":false,"colores":false,"acabados":false}'::jsonb) AS qa_checklist,
                p.qa_observaciones,
                p.notas AS notas_taller,
                p.created_at,
                p.updated_at
             FROM negocio_pedidos p
             WHERE p.negocio_id = $1
               AND p.estado_pedido != 'cancelado'
               AND (p.artesano_id = $2 OR LOWER(TRIM(p.artesano_nombre)) = LOWER(TRIM($3)))
             ORDER BY
               CASE WHEN p.estado_pedido IN ('recibido_taller', 'enviado', 'entregado', 'post_venta') THEN 1 ELSE 0 END ASC,
               p.fecha_compromiso_artesano ASC NULLS LAST,
               p.created_at DESC`,
            [req.negocio.id, artesano.id, artesano.nombre]
        );

        // Sanitizar items JSONB para que no expongan el precio de venta retail al cliente final
        const solicitudesSanitizadas = pedidos.map(p => {
            const rawItems = Array.isArray(p.items) ? p.items : [];
            const itemsTaller = rawItems.map(it => ({
                slug: it.slug,
                nombre: it.nombre,
                cantidad: Number(it.cantidad || 1),
                imagen: it.imagen || ''
            }));
            return {
                id: p.id,
                codigo_pedido: p.codigo_pedido || `ART-${p.id}`,
                producto_nombre: p.producto_nombre,
                cantidad: Number(p.cantidad || 1),
                items: itemsTaller,
                cotizacion_artesano: p.costo_artesano_total !== null ? Number(p.costo_artesano_total) : null,
                fecha_encargo_artesano: p.fecha_encargo_artesano,
                fecha_compromiso_artesano: p.fecha_compromiso_artesano,
                fecha_recepcion_taller: p.fecha_recepcion_taller,
                estado_pedido: p.estado_pedido,
                etapa_artesano: p.etapa_artesano,
                especificaciones_artesano: p.especificaciones_artesano || p.notas_taller || '',
                qa_estado: p.qa_estado,
                qa_checklist: p.qa_checklist,
                qa_observaciones: p.qa_observaciones || '',
                updated_at: p.updated_at
            };
        });

        res.json({
            success: true,
            negocio: {
                nombre: req.negocio.nombre,
                whatsapp_taller: req.negocio.whatsapp_contacto || '51929938466'
            },
            artesano,
            solicitudes: solicitudesSanitizadas
        });
    } catch (error) {
        logger.error('Negocios: error en artesano-portal GET', { error: error.message });
        res.status(500).json({ success: false, message: 'Error al cargar el portal del artesano.' });
    }
});

// PATCH /api/negocios/:negocioSlug/artesano-portal/:token/pedido/:id — Público (Magic Link):
// Permite al artesano actualizar la etapa de producción de cualquiera de sus solicitudes asignadas:
// modelado -> primer_horno -> segundo_horno -> pintado_acabados -> listo_revision_qa -> enviado_taller
router.patch('/:negocioSlug/artesano-portal/:token/pedido/:id', trackingLimiter, async (req, res) => {
    try {
        const cleanToken = sanitizeText(req.params.token);
        const pedidoId = parseInt(req.params.id, 10);
        const { etapa_artesano, nota_artesano } = req.body;

        const validEtapas = ['recibido', 'modelado', 'primer_horno', 'segundo_horno', 'pintado_acabados', 'listo_revision_qa', 'enviado_taller'];
        if (!validEtapas.includes(etapa_artesano)) {
            return res.status(400).json({ success: false, message: 'Etapa de producción inválida.' });
        }

        const { rows: artRows } = await pool.query(
            `SELECT id, nombre FROM negocio_artesanos WHERE negocio_id = $1 AND access_token = $2 AND activo = TRUE LIMIT 1`,
            [req.negocio.id, cleanToken]
        );
        if (artRows.length === 0) {
            return res.status(403).json({ success: false, message: 'Acceso no autorizado.' });
        }
        const artesano = artRows[0];

        // Mapear la etapa del artesano al estado_pedido macro del ERP
        let nuevoEstadoPedido = 'encargado_artesano';
        if (['modelado', 'primer_horno', 'segundo_horno'].includes(etapa_artesano)) {
            nuevoEstadoPedido = 'encargado_artesano';
        } else if (['pintado_acabados', 'listo_revision_qa'].includes(etapa_artesano)) {
            nuevoEstadoPedido = 'en_produccion';
        } else if (etapa_artesano === 'enviado_taller') {
            nuevoEstadoPedido = 'recibido_taller';
        }

        const { rows } = await pool.query(
            `UPDATE negocio_pedidos
             SET etapa_artesano = $1,
                 estado_pedido = CASE
                     WHEN estado_pedido IN ('enviado', 'entregado', 'post_venta') THEN estado_pedido
                     ELSE $2
                 END,
                 qa_estado = CASE
                     WHEN $1 = 'listo_revision_qa' AND qa_estado = 'observado' THEN 'pendiente'
                     ELSE qa_estado
                 END,
                 fecha_recepcion_taller = CASE
                     WHEN $1 = 'enviado_taller' THEN COALESCE(fecha_recepcion_taller, NOW())
                     ELSE fecha_recepcion_taller
                 END,
                 notas = CASE
                     WHEN $3::text IS NOT NULL AND $3::text != ''
                     THEN COALESCE(notas || E'\n', '') || '[Artesano]: ' || $3::text
                     ELSE notas
                 END,
                 updated_at = NOW()
             WHERE id = $4
               AND negocio_id = $5
               AND (artesano_id = $6 OR LOWER(TRIM(artesano_nombre)) = LOWER(TRIM($7)))
             RETURNING id, codigo_pedido, producto_nombre, etapa_artesano, estado_pedido, qa_estado, fecha_recepcion_taller`,
            [etapa_artesano, nuevoEstadoPedido, sanitizeText(nota_artesano) || null, pedidoId, req.negocio.id, artesano.id, artesano.nombre]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Solicitud no encontrada para este artesano.' });
        }

        const ped = rows[0];

        // Si el artesano marca "listo_revision_qa" o "enviado_taller", enviar alerta Push al Administrador de Artesanitas
        if (etapa_artesano === 'listo_revision_qa' || etapa_artesano === 'enviado_taller') {
            const msgTitle = etapa_artesano === 'listo_revision_qa'
                ? `Revisión QA requerida (${ped.codigo_pedido})`
                : `Pedido enviado al taller (${ped.codigo_pedido})`;
            const msgBody = etapa_artesano === 'listo_revision_qa'
                ? `${artesano.nombre} terminó ${ped.producto_nombre}. Valida onzas, logos y colores antes del envío.`
                : `${artesano.nombre} despachó ${ped.producto_nombre} hacia el taller de Artesanitas.`;
            notifyPushSubscribers({
                negocioId: req.negocio.id,
                rol: 'admin',
                title: msgTitle,
                body: msgBody,
                url: '/registros'
            }).catch(() => {});
        }

        res.json({ success: true, solicitud: ped });
    } catch (error) {
        logger.error('Negocios: error actualizando etapa en artesano-portal', { error: error.message });
        res.status(500).json({ success: false, message: 'No se pudo actualizar la etapa.' });
    }
});

// ── 4. SPRINT 6: Endpoints de Suscripción Web Push (Admin y Comprador) ──
router.get('/:negocioSlug/push/vapid-public-key', (req, res) => {
    res.json({ success: true, publicKey: getVapidPublicKey() });
});

router.post('/:negocioSlug/push/subscribe', async (req, res) => {
    try {
        const { rol, codigo_pedido, subscription } = req.body;
        const result = await savePushSubscription({
            negocioId: req.negocio.id,
            rol: rol || 'comprador',
            codigoPedido: codigo_pedido || null,
            subscription,
            userAgent: req.headers['user-agent'] || ''
        });
        if (!result.ok) {
            return res.status(400).json({ success: false, message: result.message });
        }
        res.status(201).json({ success: true, message: 'Notificaciones Push activadas.' });
    } catch (error) {
        logger.error('Negocios: error guardando suscripción Push', { error: error.message });
        res.status(500).json({ success: false, message: 'No se pudo activar la notificación Push.' });
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
