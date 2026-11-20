// server/routes/negocio-talleres.routes.js
// Sistema de inscripción a talleres para negocios invitados (piloto: Artesanitas
// Perú). Público + panel propio del negocio, sin depender del admin-panel ni del
// sistema de auth del club — login usuario/contraseña propio (tabla
// negocio_usuarios), y sus rutas van prefijadas por su slug
// (/api/negocios/:negocioSlug/...) para que agregar un segundo negocio no
// requiera cambiar rutas, solo una fila nueva.
const express = require('express');
const router = express.Router({ mergeParams: true });
const multer = require('multer');
const ExcelJS = require('exceljs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const pool = require('../db.config');
const logger = require('../utils/logger');
const emailService = require('../utils/email.service');
const { NEGOCIOS_JWT_SECRET, TOKEN_EXPIRES_IN, resolveNegocioSlug, requireNegocioAuth } = require('../middleware/negocio-auth.middleware');

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

// 5 envíos por IP cada 15 min — mismo patrón anti-spam que contact.routes.js
const inscripcionLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { success: false, message: 'Demasiados intentos. Intenta en 15 minutos.' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: ipKeyGenerator
});

// Resuelve :negocioSlug una sola vez por request y lo cuelga en req.negocio
// (lógica compartida en middleware/negocio-auth.middleware.js)
router.param('negocioSlug', resolveNegocioSlug);

// 10 intentos por IP cada 15 min — anti fuerza bruta, mismo criterio que el login del club
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { success: false, message: 'Demasiados intentos. Intenta en 15 minutos.' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: ipKeyGenerator
});

// POST /api/negocios/auth/login — global, no depende de :negocioSlug (el usuario
// puede ser superadmin, sin negocio fijo)
router.post('/auth/login', loginLimiter, async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Usuario y contraseña requeridos.' });
    }
    try {
        const { rows } = await pool.query(
            `SELECT u.id, u.password_hash, u.role, u.negocio_id, n.slug AS negocio_slug, n.nombre AS negocio_nombre
             FROM negocio_usuarios u
             LEFT JOIN negocios n ON n.id = u.negocio_id
             WHERE u.username = $1`,
            [String(username).trim().toLowerCase()]
        );
        const user = rows[0];
        const validPassword = user ? await bcrypt.compare(password, user.password_hash) : false;
        if (!validPassword) {
            return res.status(401).json({ success: false, message: 'Usuario o contraseña incorrectos.' });
        }

        const token = jwt.sign(
            { userId: user.id, role: user.role, negocioId: user.negocio_id },
            NEGOCIOS_JWT_SECRET,
            { expiresIn: TOKEN_EXPIRES_IN }
        );
        res.json({ success: true, token, role: user.role, negocioSlug: user.negocio_slug, negocioNombre: user.negocio_nombre });
    } catch (error) {
        logger.error('Negocios: error en login', { error: error.message });
        res.status(500).json({ success: false, message: 'Error interno.' });
    }
});

// POST /api/negocios/auth/change-password — requiere sesión válida + contraseña actual
router.post('/auth/change-password', async (req, res) => {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ success: false, message: 'No autenticado.' });

    let payload;
    try {
        payload = jwt.verify(token, NEGOCIOS_JWT_SECRET);
    } catch {
        return res.status(401).json({ success: false, message: 'Sesión inválida o expirada.' });
    }

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 8) {
        return res.status(400).json({ success: false, message: 'La nueva contraseña debe tener al menos 8 caracteres.' });
    }

    try {
        const { rows } = await pool.query('SELECT password_hash FROM negocio_usuarios WHERE id = $1', [payload.userId]);
        if (rows.length === 0) return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });

        const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
        if (!valid) return res.status(401).json({ success: false, message: 'Contraseña actual incorrecta.' });

        const newHash = await bcrypt.hash(newPassword, 10);
        await pool.query('UPDATE negocio_usuarios SET password_hash = $1 WHERE id = $2', [newHash, payload.userId]);
        res.json({ success: true, message: 'Contraseña actualizada correctamente.' });
    } catch (error) {
        logger.error('Negocios: error cambiando contraseña', { error: error.message });
        res.status(500).json({ success: false, message: 'Error interno.' });
    }
});

// ── PÚBLICO ──────────────────────────────────────────────────────────────────

// GET /api/negocios/:negocioSlug/talleres — talleres activos, para el selector del formulario.
// Un taller deja de listarse solo 2 días después de su fecha (día del evento +
// 1 día de margen) -- así uno que ya pasó no se queda ofreciéndose para
// inscripción sin que el negocio tenga que acordarse de desactivarlo a mano.
router.get('/:negocioSlug/talleres', async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT id, nombre, fecha, hora, ubicacion, precio, moneda, es_para_ninos
             FROM negocio_talleres
             WHERE negocio_id = $1 AND activo = TRUE AND fecha > CURRENT_DATE - 2
             ORDER BY fecha ASC`,
            [req.negocio.id]
        );
        res.json({ success: true, negocio: { nombre: req.negocio.nombre, meta_pixel_id: req.negocio.meta_pixel_id }, talleres: rows });
    } catch (error) {
        logger.error('Negocios: error listando talleres', { error: error.message });
        res.status(500).json({ success: false, message: 'Error interno.' });
    }
});

// Envuelve multer para devolver 400 con mensaje claro (archivo muy grande / tipo
// inválido) en vez de dejar que el error caiga al handler genérico (500 opaco).
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

// Lógica compartida entre la inscripción pública y el registro manual del panel
// (Instagram/TikTok/llamada — Artesanitas sigue anotando gente a mano por esos
// canales, esto solo evita que se pierda en un chat en vez de quedar en el sistema).
async function crearInscripcion({ negocio, body, file, origen, estadoPago, montoPagado }) {
    const { taller_id, nombre, edad, whatsapp } = body;

    const tallerId = parseInt(taller_id, 10);
    const edadNum = parseInt(edad, 10);
    const cleanNombre = String(nombre || '').trim().slice(0, 100);
    const cleanWhatsapp = String(whatsapp || '').trim().slice(0, 20);

    // multer/busboy: el mismo campo repetido en el FormData llega como array;
    // uno solo, como string; ninguno, undefined. Se normaliza a array siempre.
    const rawAcompanantes = body.acompanantes;
    const acompanantesArray = (Array.isArray(rawAcompanantes) ? rawAcompanantes : (rawAcompanantes ? [rawAcompanantes] : []))
        .map(a => String(a).trim().slice(0, 100))
        .filter(a => a.length > 0)
        .slice(0, 10); // tope defensivo, no hace falta pedir más de 10 acompañantes

    if (!Number.isInteger(tallerId)) return { ok: false, status: 400, message: 'Selecciona un taller válido.' };
    if (!cleanNombre || cleanNombre.length < 2) return { ok: false, status: 400, message: 'Ingresa el nombre completo.' };
    if (!Number.isInteger(edadNum) || edadNum <= 0 || edadNum >= 120) return { ok: false, status: 400, message: 'Ingresa una edad válida.' };
    if (!cleanWhatsapp || cleanWhatsapp.length < 6) return { ok: false, status: 400, message: 'Ingresa un número de WhatsApp válido.' };

    const tallerRes = await pool.query(
        `SELECT id, nombre, fecha, es_para_ninos FROM negocio_talleres
         WHERE id = $1 AND negocio_id = $2 AND activo = TRUE`,
        [tallerId, negocio.id]
    );
    if (tallerRes.rows.length === 0) return { ok: false, status: 404, message: 'Este taller no está disponible.' };
    const taller = tallerRes.rows[0];

    if (taller.es_para_ninos && acompanantesArray.length === 0) {
        return { ok: false, status: 400, message: 'Ingresa el nombre de al menos un acompañante o madre.' };
    }

    const acompanantesFinal = taller.es_para_ninos ? acompanantesArray : [];

    await pool.query(
        `INSERT INTO negocio_inscripciones (taller_id, nombre, edad, whatsapp, acompanantes, origen, estado_pago, monto_pagado)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [taller.id, cleanNombre, edadNum, cleanWhatsapp, JSON.stringify(acompanantesFinal),
         origen, estadoPago, montoPagado]
    );

    logger.info('Negocios: inscripción registrada', { negocio: negocio.slug, taller: taller.nombre, whatsapp: cleanWhatsapp, origen });

    if (negocio.email_notif) {
        emailService.sendNegocioInscripcionEmail({
            to: negocio.email_notif,
            nombre: cleanNombre,
            edad: edadNum,
            whatsapp: cleanWhatsapp,
            tallerNombre: taller.nombre,
            tallerFecha: taller.fecha,
            acompanantes: acompanantesFinal,
            comprobante: file || null
        }).catch(err => {
            logger.error('Negocios: error enviando email de inscripción', { error: err.message });
        });
    }

    return { ok: true };
}

// POST /api/negocios/:negocioSlug/inscripciones — inscripción pública (multipart/form-data)
router.post('/:negocioSlug/inscripciones', inscripcionLimiter, uploadComprobante, async (req, res) => {
    try {
        const result = await crearInscripcion({
            negocio: req.negocio, body: req.body, file: req.file,
            origen: 'formulario', estadoPago: 'pendiente', montoPagado: 0
        });
        if (!result.ok) {
            return res.status(result.status).json({ success: false, message: result.message });
        }
        res.status(201).json({ success: true, message: '¡Inscripción registrada! Te contactaremos por WhatsApp para confirmar.' });
    } catch (error) {
        if (error.code === '23505') { // unique_violation: mismo whatsapp + taller
            return res.status(409).json({ success: false, message: 'Ya tienes una inscripción registrada para este taller con ese WhatsApp.' });
        }
        logger.error('Negocios: error en inscripción', { error: error.message });
        res.status(500).json({ success: false, message: 'Error interno. Intenta de nuevo en un momento.' });
    }
});

// ── PANEL DEL NEGOCIO (protegido por access_key) ─────────────────────────────

// GET /api/negocios/:negocioSlug/talleres/admin — todos los talleres (activos e inactivos)
router.get('/:negocioSlug/talleres/admin', requireNegocioAuth, async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT id, nombre, fecha, hora, ubicacion, precio, moneda, es_para_ninos, activo,
                    (SELECT COUNT(*) FROM negocio_inscripciones WHERE taller_id = negocio_talleres.id) AS inscritos
             FROM negocio_talleres
             WHERE negocio_id = $1
             ORDER BY fecha DESC`,
            [req.negocio.id]
        );
        res.json({ success: true, talleres: rows });
    } catch (error) {
        logger.error('Negocios: error listando talleres (admin)', { error: error.message });
        res.status(500).json({ success: false, message: 'Error interno.' });
    }
});

// POST /api/negocios/:negocioSlug/talleres — crear taller
router.post('/:negocioSlug/talleres', requireNegocioAuth, async (req, res) => {
    const { nombre, fecha, hora, ubicacion, precio, moneda, es_para_ninos } = req.body;

    const cleanNombre = String(nombre || '').trim().slice(0, 150);
    if (!cleanNombre || !fecha) {
        return res.status(400).json({ success: false, message: 'Nombre y fecha son obligatorios.' });
    }

    try {
        const { rows } = await pool.query(
            `INSERT INTO negocio_talleres (negocio_id, nombre, fecha, hora, ubicacion, precio, moneda, es_para_ninos)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING id, nombre, fecha, hora, ubicacion, precio, moneda, es_para_ninos, activo`,
            [req.negocio.id, cleanNombre, fecha, hora || null, ubicacion || null, precio || null, moneda || 'PEN', !!es_para_ninos]
        );
        logger.info('Negocios: taller creado', { negocio: req.negocio.slug, taller: cleanNombre });
        res.status(201).json({ success: true, taller: rows[0] });
    } catch (error) {
        logger.error('Negocios: error creando taller', { error: error.message });
        res.status(500).json({ success: false, message: 'Error interno.' });
    }
});

// PATCH /api/negocios/:negocioSlug/talleres/:id — editar / activar / desactivar
router.patch('/:negocioSlug/talleres/:id', requireNegocioAuth, async (req, res) => {
    const { id } = req.params;
    const { nombre, fecha, hora, ubicacion, precio, moneda, es_para_ninos, activo } = req.body;

    const fields = [];
    const values = [];
    let i = 1;
    const set = (col, val) => { fields.push(`${col} = $${i++}`); values.push(val); };

    if (nombre !== undefined) set('nombre', String(nombre).trim().slice(0, 150));
    if (fecha !== undefined) set('fecha', fecha);
    if (hora !== undefined) set('hora', hora);
    if (ubicacion !== undefined) set('ubicacion', ubicacion);
    if (precio !== undefined) set('precio', precio);
    if (moneda !== undefined) set('moneda', moneda);
    if (es_para_ninos !== undefined) set('es_para_ninos', !!es_para_ninos);
    if (activo !== undefined) set('activo', !!activo);

    if (fields.length === 0) {
        return res.status(400).json({ success: false, message: 'Nada que actualizar.' });
    }

    values.push(id, req.negocio.id);
    try {
        const { rows } = await pool.query(
            `UPDATE negocio_talleres SET ${fields.join(', ')}
             WHERE id = $${i++} AND negocio_id = $${i}
             RETURNING id, nombre, fecha, hora, ubicacion, precio, moneda, es_para_ninos, activo`,
            values
        );
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Taller no encontrado.' });
        }
        logger.info('Negocios: taller actualizado', { negocio: req.negocio.slug, tallerId: id });
        res.json({ success: true, taller: rows[0] });
    } catch (error) {
        logger.error('Negocios: error actualizando taller', { error: error.message });
        res.status(500).json({ success: false, message: 'Error interno.' });
    }
});

// POST /api/negocios/:negocioSlug/inscripciones/manual — registro manual desde el panel
// (Instagram, TikTok, llamada, WhatsApp) — mismo flujo que la pública, sin rate limit
// (ya está detrás de access_key) y con comprobante opcional (el equipo puede no tener
// a mano la captura al momento de tipear el registro).
router.post('/:negocioSlug/inscripciones/manual', requireNegocioAuth, uploadComprobante, async (req, res) => {
    const origenValido = ['whatsapp', 'instagram', 'tiktok', 'llamada', 'otro'].includes(req.body.origen)
        ? req.body.origen : 'otro';
    try {
        const result = await crearInscripcion({
            negocio: req.negocio, body: req.body, file: req.file,
            origen: origenValido, estadoPago: 'pendiente', montoPagado: 0
        });
        if (!result.ok) {
            return res.status(result.status).json({ success: false, message: result.message });
        }
        res.status(201).json({ success: true, message: 'Inscripción registrada.' });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ success: false, message: 'Ya existe una inscripción con ese WhatsApp para este taller.' });
        }
        logger.error('Negocios: error en inscripción manual', { error: error.message });
        res.status(500).json({ success: false, message: 'Error interno.' });
    }
});

// PATCH /api/negocios/:negocioSlug/inscripciones/:id — actualizar estado de pago
router.patch('/:negocioSlug/inscripciones/:id', requireNegocioAuth, async (req, res) => {
    const { id } = req.params;
    const { estado_pago, monto_pagado } = req.body;

    if (estado_pago !== undefined && !['pendiente', 'parcial', 'completo'].includes(estado_pago)) {
        return res.status(400).json({ success: false, message: 'Estado de pago inválido.' });
    }

    const fields = [];
    const values = [];
    let i = 1;
    if (estado_pago !== undefined) { fields.push(`estado_pago = $${i++}`); values.push(estado_pago); }
    if (monto_pagado !== undefined) { fields.push(`monto_pagado = $${i++}`); values.push(monto_pagado); }

    if (fields.length === 0) {
        return res.status(400).json({ success: false, message: 'Nada que actualizar.' });
    }

    values.push(id, req.negocio.id);
    try {
        const { rows } = await pool.query(
            `UPDATE negocio_inscripciones i SET ${fields.join(', ')}
             FROM negocio_talleres t
             WHERE i.taller_id = t.id AND i.id = $${i++} AND t.negocio_id = $${i}
             RETURNING i.id, i.estado_pago, i.monto_pagado`,
            values
        );
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Inscripción no encontrada.' });
        }
        res.json({ success: true, inscripcion: rows[0] });
    } catch (error) {
        logger.error('Negocios: error actualizando estado de pago', { error: error.message });
        res.status(500).json({ success: false, message: 'Error interno.' });
    }
});

// DELETE /api/negocios/:negocioSlug/inscripciones/:id — elimina un registro
// (pruebas, duplicados, errores de tipeo en el registro manual). "inscritos" en
// el listado de talleres es un COUNT(*) en vivo, no una columna aparte -- se
// actualiza solo, sin necesidad de decrementar nada manualmente.
router.delete('/:negocioSlug/inscripciones/:id', requireNegocioAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const { rows } = await pool.query(
            `DELETE FROM negocio_inscripciones i
             USING negocio_talleres t
             WHERE i.taller_id = t.id AND i.id = $1 AND t.negocio_id = $2
             RETURNING i.id`,
            [id, req.negocio.id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Inscripción no encontrada.' });
        }
        logger.info('Negocios: inscripción eliminada', { negocio: req.negocio.slug, inscripcionId: id });
        res.json({ success: true });
    } catch (error) {
        logger.error('Negocios: error eliminando inscripción', { error: error.message });
        res.status(500).json({ success: false, message: 'Error interno.' });
    }
});

// Filtros compartidos entre el listado y el export CSV — mismo patrón que
// charla-running.routes.js (GET /admin/registros?slug=&distancia=&modalidad=&estado=).
// Fechas filtran por fecha de inscripción (created_at), no por fecha del taller,
// porque el uso principal es "¿quién se inscribió esta semana/este mes?".
function buildInscripcionesFilter(req) {
    const { taller_id, estado_pago, origen, desde, hasta } = req.query;
    const where = ['t.negocio_id = $1'];
    const params = [req.negocio.id];

    if (taller_id) { params.push(taller_id); where.push(`i.taller_id = $${params.length}`); }
    if (estado_pago) { params.push(estado_pago); where.push(`i.estado_pago = $${params.length}`); }
    if (origen) { params.push(origen); where.push(`i.origen = $${params.length}`); }
    if (desde) { params.push(desde); where.push(`i.created_at::date >= $${params.length}`); }
    if (hasta) { params.push(hasta); where.push(`i.created_at::date <= $${params.length}`); }

    return { whereSql: where.join(' AND '), params };
}

// GET /api/negocios/:negocioSlug/inscripciones — listar (con nombre del taller)
// Filtros opcionales: ?taller_id=&estado_pago=&origen=&desde=YYYY-MM-DD&hasta=YYYY-MM-DD
router.get('/:negocioSlug/inscripciones', requireNegocioAuth, async (req, res) => {
    try {
        const { whereSql, params } = buildInscripcionesFilter(req);
        const { rows } = await pool.query(
            `SELECT i.id, i.nombre, i.edad, i.whatsapp, i.acompanantes, i.created_at,
                    i.estado_pago, i.monto_pagado, i.origen,
                    t.nombre AS taller_nombre, t.fecha AS taller_fecha, t.precio AS taller_precio,
                    (t.precio - i.monto_pagado) AS saldo_pendiente
             FROM negocio_inscripciones i
             JOIN negocio_talleres t ON t.id = i.taller_id
             WHERE ${whereSql}
             ORDER BY i.created_at DESC`,
            params
        );
        res.json({ success: true, inscripciones: rows });
    } catch (error) {
        logger.error('Negocios: error listando inscripciones', { error: error.message });
        res.status(500).json({ success: false, message: 'Error interno.' });
    }
});

const fmtFecha = (d) => d ? new Date(d).toLocaleDateString('es-PE', { timeZone: 'America/Lima', day: 'numeric', month: 'short', year: 'numeric' }) : '';
const fmtFechaHora = (d) => d ? new Date(d).toLocaleString('es-PE', { timeZone: 'America/Lima', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

// CSV/Excel injection (OWASP): si una celda empieza con = + - @ o tab, Excel/Sheets
// la puede interpretar como fórmula al abrir el archivo -- alguien podría registrarse
// con nombre "=cmd|'/c calc'!A0" o un =HYPERLINK(...) de phishing. nombre/whatsapp/
// acompañante/taller vienen de un formulario público sin autenticar, así que se
// neutraliza con un apóstrofe adelante (fuerza texto plano, no fórmula).
function neutralizeFormula(val) {
    const s = val === null || val === undefined ? '' : String(val);
    return /^[=+\-@\t]/.test(s) ? `'${s}` : s;
}

// Consulta compartida entre el export CSV y el export Excel — mismos filtros, misma forma de fila.
async function fetchInscripcionesParaExport(req) {
    const { whereSql, params } = buildInscripcionesFilter(req);
    const { rows } = await pool.query(
        `SELECT i.nombre, i.edad, i.whatsapp, i.acompanantes, i.created_at,
                i.estado_pago, i.monto_pagado, i.origen,
                t.nombre AS taller_nombre, t.fecha AS taller_fecha, t.precio AS taller_precio,
                (t.precio - i.monto_pagado) AS saldo_pendiente
         FROM negocio_inscripciones i
         JOIN negocio_talleres t ON t.id = i.taller_id
         WHERE ${whereSql}
         ORDER BY i.created_at DESC`,
        params
    );
    return rows;
}

// Cada nombre de la lista se neutraliza por separado antes de unirlos -- si se
// unieran primero, un nombre malicioso en el medio de la lista no quedaría al
// inicio de la celda y neutralizeFormula() no lo detectaría.
const acompanantesTexto = (acompanantes) =>
    Array.isArray(acompanantes) ? acompanantes.map(neutralizeFormula).join('; ') : '';

// GET /api/negocios/:negocioSlug/inscripciones/export — CSV (respeta los mismos filtros que el listado)
router.get('/:negocioSlug/inscripciones/export', requireNegocioAuth, async (req, res) => {
    try {
        const rows = await fetchInscripcionesParaExport(req);

        const escapeCsv = (val) => {
            const s = neutralizeFormula(val);
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        };

        const header = ['Nombre', 'Edad', 'WhatsApp', 'Acompañantes', 'Taller', 'Fecha Taller', 'Fecha Inscripción', 'Precio Taller', 'Estado de Pago', 'Monto Pagado', 'Saldo Pendiente', 'Origen'];
        const lines = [header.join(',')];
        for (const r of rows) {
            lines.push([
                escapeCsv(r.nombre), escapeCsv(r.edad), escapeCsv(r.whatsapp),
                escapeCsv(acompanantesTexto(r.acompanantes)), escapeCsv(r.taller_nombre),
                escapeCsv(fmtFecha(r.taller_fecha)), escapeCsv(fmtFechaHora(r.created_at)),
                escapeCsv(r.taller_precio), escapeCsv(r.estado_pago), escapeCsv(r.monto_pagado),
                escapeCsv(r.saldo_pendiente), escapeCsv(r.origen)
            ].join(','));
        }

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${req.negocio.slug}-inscripciones.csv"`);
        res.send('﻿' + lines.join('\n')); // BOM para que Excel abra bien los acentos
    } catch (error) {
        logger.error('Negocios: error exportando CSV', { error: error.message });
        res.status(500).json({ success: false, message: 'Error interno.' });
    }
});

// GET /api/negocios/:negocioSlug/inscripciones/export.xlsx — Excel real (respeta los mismos filtros)
router.get('/:negocioSlug/inscripciones/export.xlsx', requireNegocioAuth, async (req, res) => {
    try {
        const rows = await fetchInscripcionesParaExport(req);

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Inscripciones');
        sheet.columns = [
            { header: 'Nombre', key: 'nombre', width: 24 },
            { header: 'Edad', key: 'edad', width: 8 },
            { header: 'WhatsApp', key: 'whatsapp', width: 16 },
            { header: 'Acompañantes', key: 'acompanante', width: 26 },
            { header: 'Taller', key: 'taller', width: 34 },
            { header: 'Fecha Taller', key: 'fechaTaller', width: 16 },
            { header: 'Fecha Inscripción', key: 'fechaInscripcion', width: 20 },
            { header: 'Precio Taller', key: 'precioTaller', width: 14 },
            { header: 'Estado de Pago', key: 'estadoPago', width: 14 },
            { header: 'Monto Pagado', key: 'montoPagado', width: 14 },
            { header: 'Saldo Pendiente', key: 'saldoPendiente', width: 16 },
            { header: 'Origen', key: 'origen', width: 12 }
        ];
        sheet.getRow(1).font = { bold: true };

        for (const r of rows) {
            sheet.addRow({
                nombre: neutralizeFormula(r.nombre),
                edad: r.edad,
                whatsapp: neutralizeFormula(r.whatsapp),
                acompanante: acompanantesTexto(r.acompanantes),
                taller: neutralizeFormula(r.taller_nombre),
                fechaTaller: fmtFecha(r.taller_fecha),
                fechaInscripcion: fmtFechaHora(r.created_at),
                precioTaller: r.taller_precio !== null ? Number(r.taller_precio) : null,
                estadoPago: r.estado_pago,
                montoPagado: Number(r.monto_pagado),
                saldoPendiente: r.saldo_pendiente !== null ? Number(r.saldo_pendiente) : null,
                origen: r.origen
            });
        }

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${req.negocio.slug}-inscripciones.xlsx"`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        logger.error('Negocios: error exportando Excel', { error: error.message });
        res.status(500).json({ success: false, message: 'Error interno.' });
    }
});

module.exports = router;
