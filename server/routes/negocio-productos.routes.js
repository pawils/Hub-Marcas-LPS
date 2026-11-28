// server/routes/negocio-productos.routes.js
// Catálogo E-Commerce + Ficha Técnica (SKU, EAN, Stock, Promociones) + Jerarquía Retail (Línea, Sublínea, Sub-sublínea)
// para análisis de BI/IA en negocios aliados (Piloto: Artesanitas Perú).
// Las imágenes se comprimen a WebP en el cliente y se almacenan de forma persistente en PostgreSQL
// servidas con cabeceras ETag + Cache-Control Immutable para distribución por Cloudflare Edge CDN.

const express = require('express');
const router = express.Router({ mergeParams: true });
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const pool = require('../db.config');
const logger = require('../utils/logger');
const { resolveNegocioSlug, requireNegocioAuth } = require('../middleware/negocio-auth.middleware');
const { isSafeImageMime, setSafeBinaryHeaders } = require('../utils/security');
const { getProductoPorSlug } = require('../data/artesanitas-productos');
const {
    PRODUCT_COLUMNS,
    ensureProductColumns,
    slugify,
    slugUnico,
    buildAutoSku,
    generarMatriculaUnica,
    cleanProductTitle,
    syncCatalogoBaseAInventario
} = require('../services/sku-ean.service');

router.param('negocioSlug', resolveNegocioSlug);

const storage = multer.memoryStorage();

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024, files: 6 },
    fileFilter: (req, file, cb) => {
        if (!isSafeImageMime(file.mimetype)) {
            return cb(new Error('Cada archivo debe ser una imagen válida (JPG, PNG, WEBP, GIF o HEIC).'));
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

// ── PÚBLICO ──────────────────────────────────────────────────────────────────

// GET /api/negocios/:negocioSlug/productos — productos activos con ficha técnica y stock
let _initialCatalogSynced = false;
router.get('/:negocioSlug/productos', async (req, res) => {
    try {
        await ensureProductColumns();
        if (req.negocio.slug === 'artesanitas' && !_initialCatalogSynced) {
            _initialCatalogSynced = true;
            await syncCatalogoBaseAInventario(req.negocio.id, req.negocio.slug).catch(() => {
                _initialCatalogSynced = false;
            });
        }
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

        setSafeBinaryHeaders(res, foto.mime_type);
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
        await ensureProductColumns();
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

    const cleanNombre = cleanProductTitle(nombre);
    const precioNum = parseFloat(precio);

    if (!cleanNombre || !Number.isFinite(precioNum) || precioNum < 0) {
        return res.status(400).json({ success: false, message: 'Nombre y precio regular válido son obligatorios.' });
    }

    const ofertaNum = (precio_oferta !== undefined && precio_oferta !== '') ? parseFloat(precio_oferta) : null;
    const costoNum = (costo_artesano !== undefined && costo_artesano !== '') ? parseFloat(costo_artesano) : null;
    const stockNum = Number.isFinite(parseInt(stock_actual, 10)) ? Math.max(0, parseInt(stock_actual, 10)) : 0;
    const stockMinNum = Number.isFinite(parseInt(stock_minimo, 10)) ? Math.max(0, parseInt(stock_minimo, 10)) : 1;
    const venderSinStock = req.body.vender_sin_stock === true || req.body.vender_sin_stock === 'true' || politica_sin_stock === 'preventa';
    const rawFechaEst = req.body.fecha_entrega_estimada ? String(req.body.fecha_entrega_estimada).trim().slice(0, 10) : '';
    const fechaEntregaEst = /^\d{4}-\d{2}-\d{2}$/.test(rawFechaEst) ? rawFechaEst : null;
    const cleanLinea = String(linea || 'Vajilla Artesanal').trim().slice(0, 80);
    const cleanSublinea = String(sublinea || 'Tazas & Mugs').trim().slice(0, 80);
    const cleanSubSublinea = String(sub_sublinea || 'Cerámica Pintada a Mano').trim().slice(0, 80);
    const cleanColeccion = String(coleccion || 'Catálogo General').trim().slice(0, 80);
    const cleanUbicacion = String(req.body.ubicacion_almacen || 'Almacén Principal Trujillo').trim().slice(0, 80);

    try {
        await ensureProductColumns();
        const autoCodes = await generarMatriculaUnica(req.negocio.id, req.negocio.slug, cleanLinea, cleanSublinea);
        const cleanSku = String(sku || '').trim().slice(0, 60) || autoCodes.sku;
        const cleanEan = String(ean || '').trim().slice(0, 20) || autoCodes.ean;

        const { rows: dupCodes } = await pool.query(
            `SELECT id, nombre, sku, ean FROM negocio_productos
             WHERE negocio_id = $1 AND ((sku IS NOT NULL AND sku = $2) OR (ean IS NOT NULL AND ean = $3))
             LIMIT 1`,
            [req.negocio.id, cleanSku, cleanEan]
        );
        if (dupCodes.length > 0) {
            const dup = dupCodes[0];
            const conflictField = dup.sku === cleanSku ? `SKU "${cleanSku}"` : `EAN "${cleanEan}"`;
            return res.status(409).json({
                success: false,
                message: `Ya existe un producto con el ${conflictField} (${dup.nombre}). Haz clic en "Generar nuevo SKU + EAN-13" o usa otro código.`
            });
        }

        const slug = await slugUnico(req.negocio.id, slugify(cleanNombre));
        const files = req.files || [];
        const fallbackImg = req.body.imagen_url ? [String(req.body.imagen_url).trim()] : [];

        const { rows } = await pool.query(
            `INSERT INTO negocio_productos (
                negocio_id, slug, nombre, precio, precio_oferta, etiqueta_promo, costo_artesano, moneda,
                sku, ean, stock_actual, stock_minimo, politica_sin_stock, vender_sin_stock, fecha_entrega_estimada,
                linea, sublinea, sub_sublinea, coleccion,
                tipo_producto, modelo, color, tamano_dimensiones, caracteristicas,
                ubicacion_almacen, descripcion, imagenes
             )
             VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8,
                $9, $10, $11, $12, $13, $14, $15,
                $16, $17, $18, $19,
                $20, $21, $22, $23, $24,
                $25, $26, $27
             )
             RETURNING ${PRODUCT_COLUMNS}`,
            [
                req.negocio.id, slug, cleanNombre, precioNum,
                Number.isFinite(ofertaNum) && ofertaNum > 0 ? ofertaNum : null,
                etiqueta_promo ? String(etiqueta_promo).trim().slice(0, 40) : null,
                Number.isFinite(costoNum) && costoNum >= 0 ? costoNum : 0,
                moneda || 'PEN',
                cleanSku,
                cleanEan,
                stockNum,
                stockMinNum,
                venderSinStock ? 'preventa' : 'agotado',
                venderSinStock,
                venderSinStock ? fechaEntregaEst : null,
                cleanLinea, cleanSublinea, cleanSubSublinea, cleanColeccion,
                tipo_producto ? String(tipo_producto).trim().slice(0, 60) : 'Taza',
                modelo ? String(modelo).trim().slice(0, 80) : null,
                color ? String(color).trim().slice(0, 60) : null,
                tamano_dimensiones ? String(tamano_dimensiones).trim().slice(0, 120) : null,
                caracteristicas ? String(caracteristicas).trim() : null,
                cleanUbicacion,
                descripcion || null,
                JSON.stringify(fallbackImg)
            ]
        );

        const producto = rows[0];

        // Registrar matrícula inicial en el Kardex de Inventario
        await pool.query(
            `INSERT INTO negocio_inventario_movimientos (negocio_id, producto_id, tipo_movimiento, cantidad_anterior, delta, cantidad_nueva, costo_unitario, ubicacion, motivo_referencia, usuario)
             VALUES ($1, $2, 'matricula_inicial', 0, $3, $3, $4, $5, $6, 'admin')`,
            [req.negocio.id, producto.id, stockNum, producto.costo_artesano || null, cleanUbicacion, `Matrícula SKU ${cleanSku} · EAN ${cleanEan}`]
        ).catch(() => {});
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
        logger.error('Negocios: error creando producto', { error: error.message, code: error.code, column: error.column, detail: error.detail });
        if (error.code === '23505') {
            return res.status(409).json({ success: false, message: 'Ya existe un producto registrado con ese nombre, SKU o código EAN.' });
        }
        if (error.code === '23502') {
            return res.status(400).json({ success: false, message: `Falta un dato obligatorio en la base de datos (${error.column || 'campo requerido'}).` });
        }
        if (error.code === '22P02' || error.code === '22007') {
            return res.status(400).json({ success: false, message: 'Verifica que el precio, stock, costo y fechas tengan un formato válido.' });
        }
        res.status(500).json({ success: false, message: `No se pudo crear el producto (${error.code || 'error de base de datos'}).` });
    }
});

// PATCH /api/negocios/:negocioSlug/productos/:id — editar ficha técnica, stock, promoción o fotos
router.patch('/:negocioSlug/productos/:id', requireNegocioAuth, uploadImagenes, async (req, res) => {
    const { id } = req.params;
    const b = req.body;
    const files = req.files || [];

    try {
        const { rows: prevRows } = await pool.query(
            `SELECT id, sku, stock_actual, ubicacion_almacen, costo_artesano
             FROM negocio_productos WHERE id = $1 AND negocio_id = $2`,
            [id, req.negocio.id]
        );
        if (prevRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Producto no encontrado.' });
        }
        const prev = prevRows[0];

        if (b.sku !== undefined) {
            const nuevoSku = String(b.sku).trim().slice(0, 60);
            if (nuevoSku && nuevoSku !== (prev.sku || '')) {
                const { rows: dupSku } = await pool.query(
                    `SELECT id FROM negocio_productos WHERE negocio_id = $1 AND sku = $2 AND id != $3 LIMIT 1`,
                    [req.negocio.id, nuevoSku, id]
                );
                if (dupSku.length > 0) {
                    return res.status(409).json({ success: false, message: `El SKU "${nuevoSku}" ya está asignado a otro producto.` });
                }
            }
        }

        const fields = [];
        const values = [];
        let i = 1;
        const set = (col, val) => { fields.push(`${col} = $${i++}`); values.push(val); };

        if (b.nombre !== undefined) set('nombre', cleanProductTitle(b.nombre));
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
        let nuevoStockFicha = null;
        if (b.stock_actual !== undefined && b.stock_actual !== '') {
            nuevoStockFicha = Math.max(0, parseInt(b.stock_actual, 10) || 0);
            set('stock_actual', nuevoStockFicha);
        }
        if (b.stock_minimo !== undefined && b.stock_minimo !== '') set('stock_minimo', Math.max(0, parseInt(b.stock_minimo, 10) || 0));
        if (b.vender_sin_stock !== undefined) {
            const vss = b.vender_sin_stock === true || b.vender_sin_stock === 'true';
            set('vender_sin_stock', vss);
            set('politica_sin_stock', vss ? 'preventa' : 'agotado');
        } else if (b.politica_sin_stock !== undefined) {
            const pol = ['agotado', 'preventa', 'compra_directa'].includes(b.politica_sin_stock) ? b.politica_sin_stock : 'compra_directa';
            set('politica_sin_stock', pol);
            set('vender_sin_stock', pol === 'preventa');
        }
        if (b.fecha_entrega_estimada !== undefined) {
            const fEst = b.fecha_entrega_estimada ? String(b.fecha_entrega_estimada).trim().slice(0, 10) : null;
            set('fecha_entrega_estimada', fEst || null);
        }
        if (b.ubicacion_almacen !== undefined) set('ubicacion_almacen', String(b.ubicacion_almacen).trim().slice(0, 80) || 'Almacén Principal Trujillo');
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

        if (b.imagenes_existentes !== undefined || files.length > 0) {
            let keptUrls = [];
            if (b.imagenes_existentes !== undefined) {
                try {
                    const parsed = JSON.parse(b.imagenes_existentes);
                    if (Array.isArray(parsed)) {
                        keptUrls = parsed.filter(u => typeof u === 'string' && u.trim());
                    }
                } catch {
                    keptUrls = [];
                }
            } else {
                const { rows: curProdRows } = await pool.query(
                    `SELECT imagenes FROM negocio_productos WHERE id = $1 AND negocio_id = $2`,
                    [id, req.negocio.id]
                );
                const curImgs = curProdRows[0]?.imagenes;
                if (Array.isArray(curImgs)) keptUrls = curImgs;
            }

            if (files.length > 0) {
                keptUrls = keptUrls.filter(u => !u.includes('logo_artesanitas.peru.jpg'));
            }

            const { rows: existingPhotos } = await pool.query(
                `SELECT posicion, mime_type, foto_data FROM negocio_producto_fotos
                 WHERE producto_id = $1 AND negocio_id = $2 ORDER BY posicion ASC`,
                [id, req.negocio.id]
            );
            const photoByPos = new Map(existingPhotos.map(r => [Number(r.posicion), r]));

            const finalEntries = [];
            const fotoPrefix = `/api/negocios/${req.negocio.slug}/productos/${id}/foto/`;

            for (const url of keptUrls) {
                if (finalEntries.length >= 6) break;
                if (url.startsWith(fotoPrefix)) {
                    const posNum = parseInt(url.slice(fotoPrefix.length), 10);
                    const found = photoByPos.get(posNum);
                    if (found) {
                        finalEntries.push({ kind: 'db', mime_type: found.mime_type, buffer: found.foto_data });
                    }
                } else {
                    finalEntries.push({ kind: 'url', url });
                }
            }

            for (const f of files) {
                if (finalEntries.length >= 6) break;
                finalEntries.push({ kind: 'db', mime_type: f.mimetype || 'image/webp', buffer: f.buffer });
            }

            await pool.query(
                `DELETE FROM negocio_producto_fotos WHERE producto_id = $1 AND negocio_id = $2`,
                [id, req.negocio.id]
            );

            const imagenesUrls = [];
            let dbIdx = 0;
            for (const entry of finalEntries) {
                if (entry.kind === 'db') {
                    await pool.query(
                        `INSERT INTO negocio_producto_fotos (producto_id, negocio_id, posicion, mime_type, foto_data)
                         VALUES ($1, $2, $3, $4, $5)`,
                        [id, req.negocio.id, dbIdx, entry.mime_type || 'image/webp', entry.buffer]
                    );
                    imagenesUrls.push(`/api/negocios/${req.negocio.slug}/productos/${id}/foto/${dbIdx}`);
                    dbIdx += 1;
                } else {
                    imagenesUrls.push(entry.url);
                }
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

        if (nuevoStockFicha !== null && nuevoStockFicha !== Number(prev.stock_actual || 0)) {
            const ant = Number(prev.stock_actual || 0);
            const delta = nuevoStockFicha - ant;
            await pool.query(
                `INSERT INTO negocio_inventario_movimientos (
                    negocio_id, producto_id, tipo_movimiento, cantidad_anterior, delta, cantidad_nueva,
                    costo_unitario, ubicacion, motivo_referencia, usuario
                 ) VALUES ($1, $2, 'ajuste_ficha', $3, $4, $5, $6, $7, $8, 'admin')`,
                [
                    req.negocio.id,
                    id,
                    ant,
                    delta,
                    nuevoStockFicha,
                    rows[0].costo_artesano || prev.costo_artesano || null,
                    rows[0].ubicacion_almacen || prev.ubicacion_almacen || 'Almacén Principal Trujillo',
                    'Actualización desde Ficha Técnica 360°'
                ]
            ).catch(() => {});
        }

        res.json({ success: true, producto: rows[0] });
    } catch (error) {
        logger.error('Negocios: error actualizando producto', { error: error.message });
        res.status(500).json({ success: false, message: 'Error interno.' });
    }
});

// POST /api/negocios/:negocioSlug/productos/ia-descripcion — redacta descripción comercial desde la imagen con Gemini 2.5 Flash
router.post('/:negocioSlug/productos/ia-descripcion', requireNegocioAuth, uploadImagenes, async (req, res) => {
    const apiKey = String(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || '').trim();
    if (!apiKey) {
        return res.status(503).json({
            success: false,
            message: 'Falta configurar GEMINI_API_KEY en el servidor para generar descripciones con IA.'
        });
    }

    try {
        let imgBuffer = null;
        let imgMime = 'image/webp';

        if (req.files && req.files.length > 0) {
            imgBuffer = req.files[0].buffer;
            imgMime = req.files[0].mimetype || 'image/webp';
        } else if (req.body.producto_id) {
            const prodId = parseInt(req.body.producto_id, 10);
            const { rows: fotoRows } = await pool.query(
                `SELECT mime_type, foto_data FROM negocio_producto_fotos
                 WHERE producto_id = $1 AND negocio_id = $2
                 ORDER BY posicion ASC LIMIT 1`,
                [prodId, req.negocio.id]
            );
            if (fotoRows.length > 0 && fotoRows[0].foto_data) {
                imgBuffer = fotoRows[0].foto_data;
                imgMime = fotoRows[0].mime_type || 'image/webp';
            } else {
                const { rows: prodRows } = await pool.query(
                    `SELECT imagenes FROM negocio_productos WHERE id = $1 AND negocio_id = $2 LIMIT 1`,
                    [prodId, req.negocio.id]
                );
                const firstUrl = Array.isArray(prodRows[0]?.imagenes) ? prodRows[0].imagenes[0] : '';
                if (firstUrl && firstUrl.startsWith('/imagenes/') && !firstUrl.includes('logo_artesanitas.peru.jpg')) {
                    const publicRoot = path.resolve(__dirname, '..', '..', 'public');
                    const candidate = path.resolve(publicRoot, firstUrl.replace(/^\/+/, ''));
                    if (candidate.startsWith(publicRoot) && fs.existsSync(candidate)) {
                        imgBuffer = fs.readFileSync(candidate);
                        const ext = path.extname(candidate).toLowerCase();
                        imgMime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
                    }
                }
            }
        }

        if (!imgBuffer) {
            return res.status(400).json({
                success: false,
                message: 'Primero selecciona o guarda al menos una foto del producto para que la IA pueda analizarla.'
            });
        }

        const nombre = String(req.body.nombre || '').trim();
        const linea = String(req.body.linea || '').trim();
        const sublinea = String(req.body.sublinea || '').trim();
        const coleccion = String(req.body.coleccion || '').trim();

        const prompt = [
            `Eres copywriter e-commerce senior para la tienda "${req.negocio.nombre || 'Artesanitas Perú'}".`,
            'Analiza con precisión la imagen del producto y redacta una ficha comercial limpia, aireada y escaneable (estándar e-commerce 2026) en español.',
            `Contexto del producto: Nombre="${nombre || 'Producto'}", Línea="${linea || 'General'}", Sublínea="${sublinea || 'General'}", Colección="${coleccion || 'Catálogo General'}".`,
            'Devuelve EXCLUSIVAMENTE un JSON válido (sin markdown ni bloques de código) con esta estructura:',
            '{',
            '  "descripcion": "Usa saltos de línea reales (\\n) para que NO se vea apretado. Estructura exacta:\\n1) Una frase gancho inicial cálida (1-2 líneas) con 1 emoji sutil.\\n\\n2) Tres viñetas breves y escaneables usando • (una por línea):\\n• Diseño y detalles visibles: ...\\n• Acabado y sensación de calidad: ...\\n• Uso ideal o regalo perfecto: ...\\n\\n3) Una línea de cierre breve y cercana con 1 emoji sutil (máx 650 caracteres en total).",',
            '  "color": "Color(es) y acabado principal visible en la foto (ej: Blanco brillante con detalles navideños), máx 60 caracteres",',
            '  "caracteristicas": "2 a 3 atributos clave separados por · (ej: Acabado esmaltado · Diseño temático · Ideal para regalo), máx 120 caracteres"',
            '}'
        ].join('\n');

        const models = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-3-flash-preview', 'gemini-3.8-flash'];
        const payload = JSON.stringify({
            contents: [{
                parts: [
                    { text: prompt },
                    { inline_data: { mime_type: imgMime, data: imgBuffer.toString('base64') } }
                ]
            }],
            generationConfig: {
                temperature: 0.5,
                responseMimeType: 'application/json'
            }
        });

        let aiData = null;
        let lastStatus = 502;
        let lastErrorMsg = '';
        const triedModels = new Set();

        async function callGeminiModel(modelName) {
            const cleanModel = String(modelName || '').replace(/^models\//, '');
            if (!cleanModel || triedModels.has(cleanModel)) return null;
            triedModels.add(cleanModel);

            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${encodeURIComponent(apiKey)}`;
            const aiRes = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: payload
            });
            if (aiRes.ok) {
                return { ok: true, data: await aiRes.json() };
            }
            const status = aiRes.status;
            const errTxt = await aiRes.text().catch(() => '');
            let msg = errTxt.slice(0, 180);
            try {
                const errJson = JSON.parse(errTxt);
                msg = errJson?.error?.message || msg;
            } catch {}
            logger.warn('IA Descripción: Gemini API respondió error', { model: cleanModel, status, error: msg });
            return { ok: false, status, msg };
        }

        for (const model of models) {
            const attempt = await callGeminiModel(model);
            if (!attempt) continue;
            if (attempt.ok) {
                aiData = attempt.data;
                break;
            }
            lastStatus = attempt.status;
            lastErrorMsg = attempt.msg;
            if (lastStatus === 401 || lastStatus === 403) break;
        }

        if (!aiData && (lastStatus === 404 || lastStatus === 400)) {
            const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`).catch(() => null);
            if (listRes && listRes.ok) {
                const listJson = await listRes.json().catch(() => ({}));
                const available = (listJson.models || [])
                    .filter(m =>
                        Array.isArray(m.supportedGenerationMethods) &&
                        m.supportedGenerationMethods.includes('generateContent') &&
                        /gemini/i.test(m.name || '') &&
                        !/embedding|tts|imagen|veo|aqa|robotics|native-audio|lite/i.test(m.name || '')
                    )
                    .sort((a, b) => {
                        const aFlash = /flash/i.test(a.name) ? 0 : 1;
                        const bFlash = /flash/i.test(b.name) ? 0 : 1;
                        return aFlash - bFlash;
                    });
                for (const m of available) {
                    const retry = await callGeminiModel(m.name);
                    if (!retry) continue;
                    if (retry.ok) {
                        aiData = retry.data;
                        break;
                    }
                    lastStatus = retry.status;
                    lastErrorMsg = retry.msg;
                    if (lastStatus === 401 || lastStatus === 403) break;
                }
            }
        }

        if (!aiData) {
            return res.status(502).json({
                success: false,
                message: `Gemini IA (${lastStatus}): ${lastErrorMsg || 'No se pudo obtener respuesta en este momento.'}`
            });
        }
        const rawText = aiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        let parsed = {};
        try {
            parsed = JSON.parse(rawText);
        } catch {
            const jsonMatch = rawText.match(/\{[\s\S]*\}/);
            if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
        }

        if (!parsed.descripcion) {
            return res.status(502).json({ success: false, message: 'La IA no devolvió una descripción válida.' });
        }

        res.json({
            success: true,
            descripcion: String(parsed.descripcion).trim().slice(0, 1000),
            color: parsed.color ? String(parsed.color).trim().slice(0, 80) : '',
            caracteristicas: parsed.caracteristicas ? String(parsed.caracteristicas).trim().slice(0, 160) : ''
        });
    } catch (error) {
        logger.error('IA Descripción: error generando descripción', { error: error.message });
        res.status(500).json({ success: false, message: 'Error al generar la descripción con IA.' });
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
