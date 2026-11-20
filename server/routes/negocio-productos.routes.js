// server/routes/negocio-productos.routes.js
// Catálogo E-Commerce + Ficha Técnica (SKU, EAN, Stock, Promociones) + Jerarquía Retail (Línea, Sublínea, Sub-sublínea)
// para análisis de BI/IA en negocios aliados (Piloto: Artesanitas Perú).
// Las imágenes se comprimen a WebP en el cliente y se almacenan de forma persistente en PostgreSQL
// servidas con cabeceras ETag + Cache-Control Immutable para distribución por Cloudflare Edge CDN.

const express = require('express');
const router = express.Router({ mergeParams: true });
const multer = require('multer');
const crypto = require('crypto');
const pool = require('../db.config');
const logger = require('../utils/logger');
const { resolveNegocioSlug, requireNegocioAuth } = require('../middleware/negocio-auth.middleware');
const { getProductoPorSlug } = require('../data/artesanitas-productos');

router.param('negocioSlug', resolveNegocioSlug);

const storage = multer.memoryStorage();

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024, files: 6 },
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Cada archivo debe ser una imagen.'));
        }
        cb(null, true);
    }
});

function uploadImagenes(req, res, next) {
    upload.array('imagenes', 6)(req, res, (err) => {
        if (err) {
            const message = err.code === 'LIMIT_FILE_SIZE'
                ? 'Cada foto no debe pesar más de 10MB.'
                : err.code === 'LIMIT_FILE_COUNT'
                    ? 'Máximo 6 fotos por producto.'
                    : err.message || 'Error al subir las fotos.';
            return res.status(400).json({ success: false, message });
        }
        next();
    });
}

function slugify(texto) {
    return String(texto || '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 100);
}

async function slugUnico(negocioId, base, excluirId = null) {
    let slug = base || 'producto';
    let intento = 1;
    while (true) {
        const { rows } = await pool.query(
            `SELECT id FROM negocio_productos WHERE negocio_id = $1 AND slug = $2 ${excluirId ? 'AND id != $3' : ''}`,
            excluirId ? [negocioId, slug, excluirId] : [negocioId, slug]
        );
        if (rows.length === 0) return slug;
        intento += 1;
        slug = `${base}-${intento}`;
    }
}

function buildAutoSku(negocioSlug, linea, sublinea) {
    const p1 = String(negocioSlug || 'ART').slice(0, 3).toUpperCase();
    const p2 = String(linea || 'VAJ').replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase() || 'GEN';
    const p3 = String(sublinea || 'TAZ').replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase() || 'PRD';
    const rnd = crypto.randomBytes(2).toString('hex').toUpperCase();
    return `${p1}-${p2}-${p3}-${rnd}`;
}

const PRODUCT_COLUMNS = `
    id, slug, nombre, precio, precio_oferta, etiqueta_promo, costo_artesano, moneda,
    sku, ean, stock_actual, stock_minimo, politica_sin_stock,
    linea, sublinea, sub_sublinea, coleccion,
    tipo_producto, modelo, color, tamano_dimensiones, caracteristicas,
    descripcion, imagenes, activo, created_at
`;

// ── PÚBLICO ──────────────────────────────────────────────────────────────────

// GET /api/negocios/:negocioSlug/productos — productos activos con ficha técnica y stock
router.get('/:negocioSlug/productos', async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT ${PRODUCT_COLUMNS}
             FROM negocio_productos
             WHERE negocio_id = $1 AND activo = TRUE
             ORDER BY created_at DESC`,
            [req.negocio.id]
        );
        res.json({ success: true, productos: rows });
    } catch (error) {
        logger.error('Negocios: error listando productos', { error: error.message });
        res.status(500).json({ success: false, message: 'Error interno.' });
    }
});

// GET /api/negocios/:negocioSlug/productos/:id/foto/:posicion — Entrega pública optimizada con caché CDN Cloudflare
router.get('/:negocioSlug/productos/:id/foto/:posicion', async (req, res) => {
    const { id, posicion } = req.params;
    const posNum = parseInt(posicion, 10) || 0;
    try {
        const { rows } = await pool.query(
            `SELECT mime_type, foto_data, created_at
             FROM negocio_producto_fotos
             WHERE producto_id = $1 AND negocio_id = $2 AND posicion = $3`,
            [id, req.negocio.id, posNum]
        );
        if (rows.length === 0) {
            return res.status(404).send('Foto no encontrada');
        }

        const foto = rows[0];
        const etag = `"${crypto.createHash('md5').update(foto.foto_data).digest('hex')}"`;

        if (req.headers['if-none-match'] === etag) {
            return res.status(304).end();
        }

        res.setHeader('Content-Type', foto.mime_type || 'image/webp');
        res.setHeader('ETag', etag);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.send(foto.foto_data);
    } catch (error) {
        logger.error('Negocios: error sirviendo foto de producto', { error: error.message, id, posicion });
        res.status(500).send('Error al obtener foto');
    }
});

// ── PANEL DEL NEGOCIO (ERP & CATÁLOGO) ───────────────────────────────────────

// GET /api/negocios/:negocioSlug/productos/admin — todos los productos con ficha completa
router.get('/:negocioSlug/productos/admin', requireNegocioAuth, async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT ${PRODUCT_COLUMNS}
             FROM negocio_productos
             WHERE negocio_id = $1
             ORDER BY created_at DESC`,
            [req.negocio.id]
        );
        res.json({ success: true, productos: rows });
    } catch (error) {
        logger.error('Negocios: error listando productos (admin)', { error: error.message });
        res.status(500).json({ success: false, message: 'Error interno.' });
    }
});

// POST /api/negocios/:negocioSlug/productos — crear producto con Ficha Técnica y Jerarquía Retail
router.post('/:negocioSlug/productos', requireNegocioAuth, uploadImagenes, async (req, res) => {
    const {
        nombre, precio, precio_oferta, etiqueta_promo, costo_artesano, moneda,
        sku, ean, stock_actual, stock_minimo, politica_sin_stock,
        linea, sublinea, sub_sublinea, coleccion,
        tipo_producto, modelo, color, tamano_dimensiones, caracteristicas,
        descripcion
    } = req.body;

    const cleanNombre = String(nombre || '').trim().slice(0, 150);
    const precioNum = parseFloat(precio);

    if (!cleanNombre || !Number.isFinite(precioNum) || precioNum < 0) {
        return res.status(400).json({ success: false, message: 'Nombre y precio regular válido son obligatorios.' });
    }

    const ofertaNum = (precio_oferta !== undefined && precio_oferta !== '') ? parseFloat(precio_oferta) : null;
    const costoNum = (costo_artesano !== undefined && costo_artesano !== '') ? parseFloat(costo_artesano) : null;
    const stockNum = Number.isFinite(parseInt(stock_actual, 10)) ? Math.max(0, parseInt(stock_actual, 10)) : 0;
    const stockMinNum = Number.isFinite(parseInt(stock_minimo, 10)) ? Math.max(0, parseInt(stock_minimo, 10)) : 1;
    const cleanLinea = String(linea || 'Vajilla Artesanal').trim().slice(0, 80);
    const cleanSublinea = String(sublinea || 'Tazas & Mugs').trim().slice(0, 80);
    const cleanSubSublinea = String(sub_sublinea || 'Cerámica Pintada a Mano').trim().slice(0, 80);
    const cleanColeccion = String(coleccion || 'Catálogo General').trim().slice(0, 80);
    const cleanSku = String(sku || '').trim().slice(0, 60) || buildAutoSku(req.negocio.slug, cleanLinea, cleanSublinea);

    try {
        const slug = await slugUnico(req.negocio.id, slugify(cleanNombre));
        const files = req.files || [];

        const { rows } = await pool.query(
            `INSERT INTO negocio_productos (
                negocio_id, slug, nombre, precio, precio_oferta, etiqueta_promo, costo_artesano, moneda,
                sku, ean, stock_actual, stock_minimo, politica_sin_stock,
                linea, sublinea, sub_sublinea, coleccion,
                tipo_producto, modelo, color, tamano_dimensiones, caracteristicas,
                descripcion, imagenes
             )
             VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8,
                $9, $10, $11, $12, $13,
                $14, $15, $16, $17,
                $18, $19, $20, $21, $22,
                $23, '[]'::jsonb
             )
             RETURNING ${PRODUCT_COLUMNS}`,
            [
                req.negocio.id, slug, cleanNombre, precioNum,
                Number.isFinite(ofertaNum) && ofertaNum > 0 ? ofertaNum : null,
                etiqueta_promo ? String(etiqueta_promo).trim().slice(0, 40) : null,
                Number.isFinite(costoNum) && costoNum >= 0 ? costoNum : null,
                moneda || 'PEN',
                cleanSku,
                ean ? String(ean).trim().slice(0, 20) : null,
                stockNum,
                stockMinNum,
                politica_sin_stock === 'agotado' ? 'agotado' : 'preventa',
                cleanLinea, cleanSublinea, cleanSubSublinea, cleanColeccion,
                tipo_producto ? String(tipo_producto).trim().slice(0, 60) : 'Taza',
                modelo ? String(modelo).trim().slice(0, 80) : null,
                color ? String(color).trim().slice(0, 60) : null,
                tamano_dimensiones ? String(tamano_dimensiones).trim().slice(0, 120) : null,
                caracteristicas ? String(caracteristicas).trim() : null,
                descripcion || null
            ]
        );

        const producto = rows[0];
        const imagenesUrls = [];

        for (let i = 0; i < files.length; i++) {
            const f = files[i];
            await pool.query(
                `INSERT INTO negocio_producto_fotos (producto_id, negocio_id, posicion, mime_type, foto_data)
                 VALUES ($1, $2, $3, $4, $5)`,
                [producto.id, req.negocio.id, i, f.mimetype || 'image/webp', f.buffer]
            );
            imagenesUrls.push(`/api/negocios/${req.negocio.slug}/productos/${producto.id}/foto/${i}`);
        }

        if (imagenesUrls.length > 0) {
            const { rows: updatedRows } = await pool.query(
                `UPDATE negocio_productos SET imagenes = $1 WHERE id = $2
                 RETURNING ${PRODUCT_COLUMNS}`,
                [JSON.stringify(imagenesUrls), producto.id]
            );
            producto.imagenes = updatedRows[0].imagenes;
        }

        res.status(201).json({ success: true, producto });
    } catch (error) {
        logger.error('Negocios: error creando producto', { error: error.message });
        res.status(500).json({ success: false, message: 'Error interno al crear producto.' });
    }
});

// PATCH /api/negocios/:negocioSlug/productos/:id — editar ficha técnica, stock, promoción o fotos
router.patch('/:negocioSlug/productos/:id', requireNegocioAuth, uploadImagenes, async (req, res) => {
    const { id } = req.params;
    const b = req.body;
    const files = req.files || [];

    const fields = [];
    const values = [];
    let i = 1;
    const set = (col, val) => { fields.push(`${col} = $${i++}`); values.push(val); };

    if (b.nombre !== undefined) set('nombre', String(b.nombre).trim().slice(0, 150));
    if (b.precio !== undefined && b.precio !== '') set('precio', parseFloat(b.precio));
    if (b.precio_oferta !== undefined) {
        const ofNum = b.precio_oferta === '' || b.precio_oferta === null ? null : parseFloat(b.precio_oferta);
        set('precio_oferta', Number.isFinite(ofNum) && ofNum > 0 ? ofNum : null);
    }
    if (b.etiqueta_promo !== undefined) set('etiqueta_promo', b.etiqueta_promo ? String(b.etiqueta_promo).trim().slice(0, 40) : null);
    if (b.costo_artesano !== undefined) {
        const cNum = b.costo_artesano === '' || b.costo_artesano === null ? null : parseFloat(b.costo_artesano);
        set('costo_artesano', Number.isFinite(cNum) && cNum >= 0 ? cNum : null);
    }
    if (b.moneda !== undefined) set('moneda', b.moneda);
    if (b.sku !== undefined) set('sku', String(b.sku).trim().slice(0, 60) || null);
    if (b.ean !== undefined) set('ean', String(b.ean).trim().slice(0, 20) || null);
    if (b.stock_actual !== undefined && b.stock_actual !== '') set('stock_actual', Math.max(0, parseInt(b.stock_actual, 10) || 0));
    if (b.stock_minimo !== undefined && b.stock_minimo !== '') set('stock_minimo', Math.max(0, parseInt(b.stock_minimo, 10) || 0));
    if (b.politica_sin_stock !== undefined) set('politica_sin_stock', b.politica_sin_stock === 'agotado' ? 'agotado' : 'preventa');
    if (b.linea !== undefined) set('linea', String(b.linea).trim().slice(0, 80));
    if (b.sublinea !== undefined) set('sublinea', String(b.sublinea).trim().slice(0, 80));
    if (b.sub_sublinea !== undefined) set('sub_sublinea', String(b.sub_sublinea).trim().slice(0, 80));
    if (b.coleccion !== undefined) set('coleccion', String(b.coleccion).trim().slice(0, 80));
    if (b.tipo_producto !== undefined) set('tipo_producto', String(b.tipo_producto).trim().slice(0, 60));
    if (b.modelo !== undefined) set('modelo', String(b.modelo).trim().slice(0, 80) || null);
    if (b.color !== undefined) set('color', String(b.color).trim().slice(0, 60) || null);
    if (b.tamano_dimensiones !== undefined) set('tamano_dimensiones', String(b.tamano_dimensiones).trim().slice(0, 120) || null);
    if (b.caracteristicas !== undefined) set('caracteristicas', String(b.caracteristicas).trim() || null);
    if (b.descripcion !== undefined) set('descripcion', b.descripcion);
    if (b.activo !== undefined) set('activo', b.activo === true || b.activo === 'true');

    try {
        if (files.length > 0) {
            await pool.query(
                `DELETE FROM negocio_producto_fotos WHERE producto_id = $1 AND negocio_id = $2`,
                [id, req.negocio.id]
            );

            const imagenesUrls = [];
            for (let idx = 0; idx < files.length; idx++) {
                const f = files[idx];
                await pool.query(
                    `INSERT INTO negocio_producto_fotos (producto_id, negocio_id, posicion, mime_type, foto_data)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [id, req.negocio.id, idx, f.mimetype || 'image/webp', f.buffer]
                );
                imagenesUrls.push(`/api/negocios/${req.negocio.slug}/productos/${id}/foto/${idx}`);
            }
            set('imagenes', JSON.stringify(imagenesUrls));
        }

        if (fields.length === 0) {
            return res.status(400).json({ success: false, message: 'Nada que actualizar.' });
        }

        values.push(id, req.negocio.id);
        const { rows } = await pool.query(
            `UPDATE negocio_productos SET ${fields.join(', ')}
             WHERE id = $${i++} AND negocio_id = $${i}
             RETURNING ${PRODUCT_COLUMNS}`,
            values
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Producto no encontrado.' });
        }

        res.json({ success: true, producto: rows[0] });
    } catch (error) {
        logger.error('Negocios: error actualizando producto', { error: error.message });
        res.status(500).json({ success: false, message: 'Error interno.' });
    }
});

// DELETE /api/negocios/:negocioSlug/productos/:id
router.delete('/:negocioSlug/productos/:id', requireNegocioAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const { rows } = await pool.query(
            `DELETE FROM negocio_productos WHERE id = $1 AND negocio_id = $2 RETURNING id, nombre`,
            [id, req.negocio.id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Producto no encontrado.' });
        }
        res.json({ success: true });
    } catch (error) {
        logger.error('Negocios: error eliminando producto', { error: error.message });
        res.status(500).json({ success: false, message: 'Error interno.' });
    }
});

// ── PRODUCTOS ESTÁTICOS & MIGRACIÓN A EDITABLES ──

router.get('/:negocioSlug/productos-estaticos/admin', requireNegocioAuth, async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT e.slug, e.nombre, e.activo FROM negocio_productos_estaticos e
             WHERE e.negocio_id = $1
               AND NOT EXISTS (
                 SELECT 1 FROM negocio_productos p
                 WHERE p.negocio_id = e.negocio_id AND p.slug = e.slug
               )
             ORDER BY e.nombre ASC`,
            [req.negocio.id]
        );
        res.json({ success: true, productos: rows });
    } catch (error) {
        logger.error('Negocios: error listando productos estáticos', { error: error.message });
        res.status(500).json({ success: false, message: 'Error interno.' });
    }
});

router.post('/:negocioSlug/productos-estaticos/:slug/migrar', requireNegocioAuth, async (req, res) => {
    const { slug } = req.params;
    const estatico = getProductoPorSlug(slug);
    if (!estatico) {
        return res.status(404).json({ success: false, message: 'Producto no encontrado en el catálogo estático.' });
    }
    try {
        const { rows: actual } = await pool.query(
            `SELECT activo FROM negocio_productos_estaticos WHERE negocio_id = $1 AND slug = $2`,
            [req.negocio.id, slug]
        );
        const activoInicial = actual.length > 0 ? actual[0].activo : true;
        const autoSku = buildAutoSku(req.negocio.slug, 'Vajilla Artesanal', 'Tazas & Mugs');

        const { rows } = await pool.query(
            `INSERT INTO negocio_productos (negocio_id, slug, sku, nombre, precio, moneda, descripcion, imagenes, activo, stock_actual, politica_sin_stock)
             VALUES ($1, $2, $3, $4, $5, 'PEN', $6, $7, $8, 1, 'preventa')
             RETURNING ${PRODUCT_COLUMNS}`,
            [req.negocio.id, slug, autoSku, estatico.nombre, estatico.precio, estatico.descripcion || null, JSON.stringify(estatico.imagenes || []), activoInicial]
        );
        await pool.query(
            `UPDATE negocio_productos_estaticos SET activo = FALSE WHERE negocio_id = $1 AND slug = $2`,
            [req.negocio.id, slug]
        );
        res.status(201).json({ success: true, producto: rows[0] });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ success: false, message: 'Este producto ya fue migrado antes.' });
        }
        logger.error('Negocios: error migrando producto estático', { error: error.message });
        res.status(500).json({ success: false, message: 'Error interno.' });
    }
});

router.patch('/:negocioSlug/productos-estaticos/:slug', requireNegocioAuth, async (req, res) => {
    const { activo } = req.body;
    if (activo !== true && activo !== false && activo !== 'true' && activo !== 'false') {
        return res.status(400).json({ success: false, message: 'Falta el campo activo.' });
    }
    try {
        const { rows } = await pool.query(
            `UPDATE negocio_productos_estaticos SET activo = $1
             WHERE negocio_id = $2 AND slug = $3
             RETURNING slug, nombre, activo`,
            [activo === true || activo === 'true', req.negocio.id, req.params.slug]
        );
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Producto no encontrado.' });
        }
        res.json({ success: true, producto: rows[0] });
    } catch (error) {
        logger.error('Negocios: error actualizando producto estático', { error: error.message });
        res.status(500).json({ success: false, message: 'Error interno.' });
    }
});

router.get('/:negocioSlug/productos-estaticos-pausados', async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT slug FROM negocio_productos_estaticos WHERE negocio_id = $1 AND activo = FALSE`,
            [req.negocio.id]
        );
        res.json({ success: true, slugs: rows.map(r => r.slug) });
    } catch (error) {
        logger.error('Negocios: error listando productos estáticos pausados', { error: error.message });
        res.status(500).json({ success: false, message: 'Error interno.' });
    }
});

module.exports = router;
