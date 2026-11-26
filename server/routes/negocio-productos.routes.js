// server/routes/negocio-productos.routes.js
// Catálogo E-Commerce + Ficha Técnica (SKU, EAN, Stock, Promociones) + Jerarquía Retail (Línea, Sublínea, Sub-sublínea)
// para análisis de BI/IA en negocios aliados (Piloto: Artesanitas Perú).
// Las imágenes se comprimen a WebP en el cliente y se almacenan de forma persistente en PostgreSQL
// servidas con cabeceras ETag + Cache-Control Immutable para distribución por Cloudflare Edge CDN.

const express = require('express');
const router = express.Router({ mergeParams: true });
const multer = require('multer');
const crypto = require('crypto');
const ExcelJS = require('exceljs');
const pool = require('../db.config');
const logger = require('../utils/logger');
const { resolveNegocioSlug, requireNegocioAuth } = require('../middleware/negocio-auth.middleware');
const { isSafeImageMime, setSafeBinaryHeaders } = require('../utils/security');
const { PRODUCTOS_CATALOGO, getProductoPorSlug } = require('../data/artesanitas-productos');

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

/**
 * Genera un SKU Numérico Corto Estructurado (4 a 5 dígitos estilo Retail / PLU):
 * - 1er dígito (Línea): 1=Vajilla, 2=Decoración/Maceteros, 3=Kits Creativos, 4=Sets de Regalo
 * - 2do dígito (Sub-línea): 0=Tazas, 1=Set Taza+Plato, 2=Platos/Bowls, 3=Teteras/Azucareras, 4=Adornos, 5=Jarrones/Macetas
 * - Últimos dígitos: Correlativo único (01..99+), ej: 1001, 1002, 1205, 2401
 */
function buildAutoSku(negocioSlug, linea, sublinea, correlativo = null) {
    const l = String(linea || '').toLowerCase();
    const s = String(sublinea || '').toLowerCase();
    let d1 = '1';
    if (l.includes('decora') || l.includes('macet')) d1 = '2';
    else if (l.includes('kit')) d1 = '3';
    else if (l.includes('set') || l.includes('regalo')) d1 = '4';

    let d2 = '0';
    if (s.includes('set') || (s.includes('taza') && s.includes('plato'))) d2 = '1';
    else if (s.includes('plato') || s.includes('bowl')) d2 = '2';
    else if (s.includes('tetera') || s.includes('azucar') || s.includes('vasito')) d2 = '3';
    else if (s.includes('adorno') || s.includes('figura')) d2 = '4';
    else if (s.includes('jarron') || s.includes('jarrón') || s.includes('macet')) d2 = '5';

    const num = correlativo
        ? String(correlativo).padStart(2, '0')
        : String(Math.floor(10 + Math.random() * 89));
    return `${d1}${d2}${num}`;
}

/**
 * Calcula el 13° dígito verificador oficial GS1 (Módulo 10) para un código de barras EAN-13
 * a partir de los primeros 12 dígitos (ej. 775 Perú + empresa + correlativo).
 */
function calcularDigitoVerificadorEan13(base12) {
    const clean12 = String(base12 || '').replace(/\D/g, '').padEnd(12, '0').slice(0, 12);
    let sum = 0;
    for (let i = 0; i < 12; i++) {
        const digit = parseInt(clean12[i], 10);
        sum += (i % 2 === 0) ? digit : digit * 3;
    }
    const mod = sum % 10;
    const check = mod === 0 ? 0 : (10 - mod);
    return `${clean12}${check}`;
}

function buildAutoEan13(negocioId = 1, secuenciaNum = null) {
    // Prefijo GS1 Perú: 775 + código marca (4 dígitos) + correlativo ítem (5 dígitos) + 1 dígito verificador = 13 dígitos
    const brandCode = String(2600 + (Number(negocioId) % 900)).padStart(4, '0').slice(0, 4);
    const itemSeq = secuenciaNum
        ? String(secuenciaNum).padStart(5, '0').slice(-5)
        : String(Math.floor(10000 + Math.random() * 89999));
    return calcularDigitoVerificadorEan13(`775${brandCode}${itemSeq}`);
}

async function generarMatriculaUnica(negocioId, negocioSlug, linea, sublinea) {
    const { rows: countRows } = await pool.query(
        `SELECT COUNT(*)::int AS total, COALESCE(MAX(id), 0)::int AS max_id FROM negocio_productos WHERE negocio_id = $1`,
        [negocioId]
    );
    let seq = (countRows[0]?.max_id || countRows[0]?.total || 0) + 1;

    for (let intento = 0; intento < 20; intento++) {
        const candidateSku = buildAutoSku(negocioSlug, linea, sublinea, seq + intento);
        const candidateEan = buildAutoEan13(negocioId, seq + intento);
        const { rows: dup } = await pool.query(
            `SELECT id FROM negocio_productos WHERE negocio_id = $1 AND (sku = $2 OR ean = $3) LIMIT 1`,
            [negocioId, candidateSku, candidateEan]
        );
        if (dup.length === 0) {
            return { sku: candidateSku, ean: candidateEan };
        }
    }
    return {
        sku: buildAutoSku(negocioSlug, linea, sublinea),
        ean: buildAutoEan13(negocioId)
    };
}

function cleanProductTitle(texto) {
    return String(texto || '')
        .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F\u200D]/gu, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 150);
}

const PRODUCT_COLUMNS = `
    id, slug, nombre, precio, precio_oferta, etiqueta_promo, costo_artesano, moneda,
    sku, ean, stock_actual, stock_minimo, politica_sin_stock, vender_sin_stock, fecha_entrega_estimada,
    linea, sublinea, sub_sublinea, coleccion,
    tipo_producto, modelo, color, tamano_dimensiones, caracteristicas,
    ubicacion_almacen, unidad_medida, ultimo_conteo_at,
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
    const fechaEntregaEst = req.body.fecha_entrega_estimada ? String(req.body.fecha_entrega_estimada).trim().slice(0, 10) : null;
    const cleanLinea = String(linea || 'Vajilla Artesanal').trim().slice(0, 80);
    const cleanSublinea = String(sublinea || 'Tazas & Mugs').trim().slice(0, 80);
    const cleanSubSublinea = String(sub_sublinea || 'Cerámica Pintada a Mano').trim().slice(0, 80);
    const cleanColeccion = String(coleccion || 'Catálogo General').trim().slice(0, 80);
    const cleanUbicacion = String(req.body.ubicacion_almacen || 'Almacén Principal Trujillo').trim().slice(0, 80);

    try {
        const autoCodes = await generarMatriculaUnica(req.negocio.id, req.negocio.slug, cleanLinea, cleanSublinea);
        const cleanSku = String(sku || '').trim().slice(0, 60) || autoCodes.sku;
        const cleanEan = String(ean || '').trim().slice(0, 20) || autoCodes.ean;
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
                Number.isFinite(costoNum) && costoNum >= 0 ? costoNum : null,
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
        logger.error('Negocios: error creando producto', { error: error.message });
        res.status(500).json({ success: false, message: 'Error interno al crear producto.' });
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

// ── SISTEMA WMS SHOPIFY: INVENTARIOS, CONTEO FÍSICO, KARDEX Y MATRÍCULA SKU + EAN-13 ──

// 1. POST /api/negocios/:negocioSlug/inventario/generar-codigos — Genera un nuevo par { sku, ean } oficial GS1
router.post('/:negocioSlug/inventario/generar-codigos', requireNegocioAuth, async (req, res) => {
    try {
        const { linea, sublinea } = req.body;
        const codes = await generarMatriculaUnica(
            req.negocio.id,
            req.negocio.slug,
            linea || 'Vajilla Artesanal',
            sublinea || 'Tazas & Mugs'
        );
        res.json({ success: true, sku: codes.sku, ean: codes.ean });
    } catch (error) {
        logger.error('Inventario: error generando SKU y EAN-13', { error: error.message });
        res.status(500).json({ success: false, message: 'Error al generar códigos.' });
    }
});

// 2. POST /api/negocios/:negocioSlug/inventario/matricular-masivo —
// Matricula todos los productos del catálogo estático/preventa en negocio_productos y asigna SKU + EAN-13 a los que les falte
router.post('/:negocioSlug/inventario/matricular-masivo', requireNegocioAuth, async (req, res) => {
    try {
        let matriculadosNuevos = 0;
        let codigosCompletados = 0;

        // A. Traer productos del catálogo estático (PRODUCTOS_CATALOGO) que aún no estén en negocio_productos
        const catalogoBase = [
            ...(Array.isArray(PRODUCTOS_CATALOGO) ? PRODUCTOS_CATALOGO : []),
            { slug: 'taza-navidad-papa-noel', nombre: 'Taza Navideña Papá Noel', precio: 59.90, coleccion: 'Colección Navidad 2026', imagenes: ['/imagenes/Artesanitas/reservas_navidad_2026/Taza_navidad_papa_noel_1.jpeg'] },
            { slug: 'taza-muneco-de-nieve', nombre: 'Taza Muñeco de Nieve', precio: 59.90, coleccion: 'Colección Navidad 2026', imagenes: ['/imagenes/Artesanitas/reservas_navidad_2026/Taza_muneco_de_nieve_1.jpeg'] },
            { slug: 'taza-arbolito-chocolatosa', nombre: 'Taza Arbolito Chocolatosa', precio: 59.90, coleccion: 'Colección Navidad 2026', imagenes: ['/imagenes/Artesanitas/reservas_navidad_2026/Taza_arbolito_Chocolatosa.jpeg'] },
            { slug: 'taza-arbolito-rosa', nombre: 'Taza Arbolito Rosa', precio: 59.90, coleccion: 'Colección Navidad 2026', imagenes: ['/imagenes/Artesanitas/reservas_navidad_2026/Taza_arbolito_Rosa.jpeg'] },
            { slug: 'taza-piston-cup', nombre: 'Taza Piston Cup', precio: 59.00, coleccion: 'Personajes & Licencias', imagenes: ['/imagenes/Artesanitas/Fotos/Taza_Piston_1.jpeg'] },
            { slug: 'adorno-paltita', nombre: 'Adorno Paltita', precio: 35.00, linea: 'Decoración & Maceteros', sublinea: 'Adornos con Plantita', coleccion: 'Catálogo General', imagenes: ['/imagenes/Artesanitas/Fotos/Adorno_Paltita_1.jpeg'] },
            { slug: 'adorno-oso-sentado', nombre: 'Adorno Oso sentado', precio: 32.00, linea: 'Decoración & Maceteros', sublinea: 'Adornos con Plantita', coleccion: 'Catálogo General', imagenes: ['/imagenes/Artesanitas/Fotos/Adorno_oso_sentado_1.jpeg'] },
            { slug: 'adorno-munequitas', nombre: 'Adorno muñequitas', precio: 29.00, linea: 'Decoración & Maceteros', sublinea: 'Adornos con Plantita', coleccion: 'Catálogo General', imagenes: ['/imagenes/Artesanitas/Fotos/Adorno_munequita_con_plantita_1.jpeg'] },
            { slug: 'platos-uva', nombre: 'Platos uva', precio: 29.00, linea: 'Vajilla Artesanal', sublinea: 'Platos & Bowls', coleccion: 'Catálogo General', imagenes: ['/imagenes/Artesanitas/Fotos/Platos uva.jpeg'] },
            { slug: 'plato-morado-full', nombre: 'Plato morado full', precio: 32.00, linea: 'Vajilla Artesanal', sublinea: 'Platos & Bowls', coleccion: 'Catálogo General', imagenes: ['/imagenes/Artesanitas/Fotos/Plato morado full.jpeg'] }
        ];

        for (const item of catalogoBase) {
            if (!item || !item.slug) continue;
            const { rows: exists } = await pool.query(
                `SELECT id FROM negocio_productos WHERE negocio_id = $1 AND slug = $2 LIMIT 1`,
                [req.negocio.id, item.slug]
            );
            if (exists.length === 0) {
                const lin = item.linea || (item.slug.includes('adorno') || item.slug.includes('elefantito') || item.slug.includes('jarron') ? 'Decoración & Maceteros' : 'Vajilla Artesanal');
                const sub = item.sublinea || (item.slug.includes('plato') && !item.slug.includes('taza') ? 'Platos & Bowls' : (item.slug.includes('tetera') || item.slug.includes('azucarera') ? 'Teteras & Azucareras' : 'Tazas & Mugs'));
                const col = item.coleccion || (item.slug.includes('navidad') || item.slug.includes('arbolito') ? 'Colección Navidad 2026' : (item.slug.includes('van-gogh') ? 'Colección Van Gogh' : (item.slug.includes('rapunzel') ? 'Colección Rapunzel' : 'Catálogo General')));
                const codes = await generarMatriculaUnica(req.negocio.id, req.negocio.slug, lin, sub);

                const { rows: ins } = await pool.query(
                    `INSERT INTO negocio_productos (
                        negocio_id, slug, nombre, precio, sku, ean, stock_actual, stock_minimo,
                        politica_sin_stock, linea, sublinea, sub_sublinea, coleccion,
                        tipo_producto, descripcion, imagenes, ubicacion_almacen, activo
                     ) VALUES ($1, $2, $3, $4, $5, $6, 0, 2, 'preventa', $7, $8, 'Cerámica Pintada a Mano', $9, 'Cerámica', $10, $11, 'Almacén Principal Trujillo', TRUE)
                     ON CONFLICT (negocio_id, slug) DO NOTHING
                     RETURNING id`,
                    [
                        req.negocio.id,
                        item.slug,
                        item.nombre,
                        Number(item.precio || 59.90),
                        codes.sku,
                        codes.ean,
                        lin,
                        sub,
                        col,
                        item.descripcion || '',
                        JSON.stringify(item.imagenes || [])
                    ]
                );
                if (ins.length > 0) {
                    matriculadosNuevos++;
                    await pool.query(
                        `INSERT INTO negocio_inventario_movimientos (negocio_id, producto_id, tipo_movimiento, cantidad_anterior, delta, cantidad_nueva, ubicacion, motivo_referencia, usuario)
                         VALUES ($1, $2, 'matricula_inicial', 0, 0, 0, 'Almacén Principal Trujillo', $3, 'admin')`,
                        [req.negocio.id, ins[0].id, `Auto-matrícula SKU ${codes.sku} · EAN ${codes.ean}`]
                    ).catch(() => {});
                }
            }
        }

        // B. Asignar SKU numérico estructurado o EAN-13 a cualquier producto existente con código vacío o formato alfanumérico antiguo
        const { rows: sinCodigo } = await pool.query(
            `SELECT id, linea, sublinea, sku, ean FROM negocio_productos
             WHERE negocio_id = $1 AND (sku IS NULL OR TRIM(sku) = '' OR sku ~ '[A-Za-z]' OR ean IS NULL OR TRIM(ean) = '')
             ORDER BY id ASC`,
            [req.negocio.id]
        );

        for (const p of sinCodigo) {
            const codes = await generarMatriculaUnica(req.negocio.id, req.negocio.slug, p.linea, p.sublinea);
            const skuIsNumeric = p.sku && /^\d{4,8}$/.test(p.sku.trim());
            const finalSku = skuIsNumeric ? p.sku.trim() : codes.sku;
            const finalEan = (p.ean && p.ean.trim()) ? p.ean.trim() : codes.ean;
            await pool.query(
                `UPDATE negocio_productos SET sku = $1, ean = $2 WHERE id = $3 AND negocio_id = $4`,
                [finalSku, finalEan, p.id, req.negocio.id]
            );
            codigosCompletados++;
        }

        res.json({
            success: true,
            matriculados_nuevos: matriculadosNuevos,
            codigos_completados: codigosCompletados,
            message: `Matrícula completada: ${matriculadosNuevos} productos nuevos incorporados al almacén y ${codigosCompletados} códigos SKU/EAN-13 generados.`
        });
    } catch (error) {
        logger.error('Inventario: error en matricular-masivo', { error: error.message });
        res.status(500).json({ success: false, message: 'Error al matricular catálogo.' });
    }
});

// 3. GET /api/negocios/:negocioSlug/inventario/resumen — Resumen WMS Shopify + Lista de Stock + Kardex reciente
router.get('/:negocioSlug/inventario/resumen', requireNegocioAuth, async (req, res) => {
    try {
        // Completar códigos EAN-13 / SKU numérico corto faltantes o alfanuméricos antiguos de forma transparente
        const { rows: faltantes } = await pool.query(
            `SELECT id, linea, sublinea, sku, ean FROM negocio_productos
             WHERE negocio_id = $1 AND (sku IS NULL OR TRIM(sku) = '' OR sku ~ '[A-Za-z]' OR ean IS NULL OR TRIM(ean) = '')
             ORDER BY id ASC`,
            [req.negocio.id]
        );
        for (const f of faltantes) {
            const c = await generarMatriculaUnica(req.negocio.id, req.negocio.slug, f.linea, f.sublinea);
            const skuNumeric = f.sku && /^\d{4,8}$/.test(f.sku.trim()) ? f.sku.trim() : c.sku;
            await pool.query(
                `UPDATE negocio_productos SET sku = $1, ean = COALESCE(NULLIF(TRIM(ean), ''), $2) WHERE id = $3`,
                [skuNumeric, c.ean, f.id]
            );
        }

        const { rows: productos } = await pool.query(
            `SELECT ${PRODUCT_COLUMNS}
             FROM negocio_productos
             WHERE negocio_id = $1
             ORDER BY stock_actual DESC, nombre ASC`,
            [req.negocio.id]
        );

        const { rows: movimientos } = await pool.query(
            `SELECT m.id, m.producto_id, m.tipo_movimiento, m.cantidad_anterior, m.delta, m.cantidad_nueva,
                    m.costo_unitario, m.ubicacion, m.motivo_referencia, m.usuario, m.created_at,
                    p.nombre AS producto_nombre, p.sku AS producto_sku, p.ean AS producto_ean
             FROM negocio_inventario_movimientos m
             JOIN negocio_productos p ON p.id = m.producto_id
             WHERE m.negocio_id = $1
             ORDER BY m.created_at DESC
             LIMIT 60`,
            [req.negocio.id]
        );

        const totalSkus = productos.length;
        const unidadesEnStock = productos.reduce((acc, p) => acc + Math.max(0, Number(p.stock_actual || 0)), 0);
        const valorCosto = productos.reduce((acc, p) => acc + (Math.max(0, Number(p.stock_actual || 0)) * Number(p.costo_artesano || 0)), 0);
        const valorRetail = productos.reduce((acc, p) => {
            const pr = (p.precio_oferta && Number(p.precio_oferta) > 0 && Number(p.precio_oferta) < Number(p.precio))
                ? Number(p.precio_oferta)
                : Number(p.precio || 0);
            return acc + (Math.max(0, Number(p.stock_actual || 0)) * pr);
        }, 0);
        const bajoStock = productos.filter(p => Number(p.stock_actual || 0) <= Number(p.stock_minimo || 1)).length;

        res.json({
            success: true,
            kpis: {
                total_skus: totalSkus,
                unidades_en_stock: unidadesEnStock,
                valor_costo_soles: Number(valorCosto.toFixed(2)),
                valor_retail_soles: Number(valorRetail.toFixed(2)),
                alertas_bajo_stock: bajoStock
            },
            productos,
            kardex: movimientos
        });
    } catch (error) {
        logger.error('Inventario: error cargando resumen WMS', { error: error.message });
        res.status(500).json({ success: false, message: 'Error al cargar el inventario.' });
    }
});

// 4. POST /api/negocios/:negocioSlug/inventario/movimiento — Registrar Conteo Físico, Entrada de Mercadería o Ajuste/Merma
router.post('/:negocioSlug/inventario/movimiento', requireNegocioAuth, async (req, res) => {
    try {
        const { producto_id, tipo_movimiento, cantidad, costo_unitario, ubicacion, motivo_referencia } = req.body;
        const prodId = parseInt(producto_id, 10);
        const cantInput = parseInt(cantidad, 10);

        if (!Number.isInteger(prodId) || Number.isNaN(cantInput)) {
            return res.status(400).json({ success: false, message: 'Selecciona un producto y una cantidad válida.' });
        }

        const { rows: prodRows } = await pool.query(
            `SELECT id, nombre, sku, ean, stock_actual, costo_artesano, ubicacion_almacen
             FROM negocio_productos
             WHERE id = $1 AND negocio_id = $2`,
            [prodId, req.negocio.id]
        );
        if (prodRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Producto no encontrado en el almacén.' });
        }

        const prod = prodRows[0];
        const stockAnterior = Number(prod.stock_actual || 0);
        let stockNuevo = stockAnterior;
        let delta = 0;

        const cleanTipo = ['entrada_mercaderia', 'conteo_fisico', 'salida_venta', 'ajuste_merma', 'recepcion_artesano'].includes(tipo_movimiento)
            ? tipo_movimiento
            : 'conteo_fisico';

        if (cleanTipo === 'conteo_fisico') {
            stockNuevo = Math.max(0, cantInput);
            delta = stockNuevo - stockAnterior;
        } else if (cleanTipo === 'entrada_mercaderia' || cleanTipo === 'recepcion_artesano') {
            delta = Math.max(0, cantInput);
            stockNuevo = stockAnterior + delta;
        } else if (cleanTipo === 'ajuste_merma' || cleanTipo === 'salida_venta') {
            delta = -Math.abs(cantInput);
            stockNuevo = Math.max(0, stockAnterior + delta);
            delta = stockNuevo - stockAnterior;
        }

        const cleanUbicacion = ubicacion ? String(ubicacion).trim().slice(0, 80) : (prod.ubicacion_almacen || 'Almacén Principal Trujillo');
        const costoNum = (costo_unitario !== undefined && costo_unitario !== '' && costo_unitario !== null)
            ? parseFloat(costo_unitario)
            : (prod.costo_artesano !== null ? Number(prod.costo_artesano) : null);

        const { rows: updatedRows } = await pool.query(
            `UPDATE negocio_productos
             SET stock_actual = $1,
                 ubicacion_almacen = $2,
                 costo_artesano = COALESCE($3, costo_artesano),
                 ultimo_conteo_at = CASE WHEN $4 = 'conteo_fisico' THEN NOW() ELSE ultimo_conteo_at END
             WHERE id = $5 AND negocio_id = $6
             RETURNING ${PRODUCT_COLUMNS}`,
            [stockNuevo, cleanUbicacion, Number.isFinite(costoNum) ? costoNum : null, cleanTipo, prod.id, req.negocio.id]
        );

        await pool.query(
            `INSERT INTO negocio_inventario_movimientos (
                negocio_id, producto_id, tipo_movimiento, cantidad_anterior, delta, cantidad_nueva,
                costo_unitario, ubicacion, motivo_referencia, usuario
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'admin')`,
            [
                req.negocio.id,
                prod.id,
                cleanTipo,
                stockAnterior,
                delta,
                stockNuevo,
                Number.isFinite(costoNum) ? costoNum : null,
                cleanUbicacion,
                motivo_referencia ? String(motivo_referencia).trim().slice(0, 200) : `Ajuste ${cleanTipo}`
            ]
        );

        res.json({
            success: true,
            producto: updatedRows[0],
            movimiento: {
                producto_id: prod.id,
                tipo_movimiento: cleanTipo,
                cantidad_anterior: stockAnterior,
                delta,
                cantidad_nueva: stockNuevo
            }
        });
    } catch (error) {
        logger.error('Inventario: error registrando movimiento', { error: error.message });
        res.status(500).json({ success: false, message: 'No se pudo registrar el movimiento de inventario.' });
    }
});

// 5. POST /api/negocios/:negocioSlug/inventario/conteo-masivo — Guardar hoja completa de Conteo Físico de Mercadería
router.post('/:negocioSlug/inventario/conteo-masivo', requireNegocioAuth, async (req, res) => {
    try {
        const items = Array.isArray(req.body.conteos) ? req.body.conteos : [];
        const motivo = String(req.body.motivo || 'Conteo físico general de almacén').trim().slice(0, 200);
        if (items.length === 0) {
            return res.status(400).json({ success: false, message: 'No se enviaron conteos para procesar.' });
        }

        let actualizados = 0;
        for (const it of items) {
            const prodId = parseInt(it.producto_id, 10);
            const conteoFisico = parseInt(it.stock_fisico, 10);
            if (!Number.isInteger(prodId) || Number.isNaN(conteoFisico) || conteoFisico < 0) continue;

            const { rows: pRows } = await pool.query(
                `SELECT id, stock_actual, costo_artesano, ubicacion_almacen FROM negocio_productos WHERE id = $1 AND negocio_id = $2`,
                [prodId, req.negocio.id]
            );
            if (pRows.length === 0) continue;
            const p = pRows[0];
            const ant = Number(p.stock_actual || 0);
            const delta = conteoFisico - ant;

            await pool.query(
                `UPDATE negocio_productos SET stock_actual = $1, ultimo_conteo_at = NOW() WHERE id = $2 AND negocio_id = $3`,
                [conteoFisico, p.id, req.negocio.id]
            );
            await pool.query(
                `INSERT INTO negocio_inventario_movimientos (
                    negocio_id, producto_id, tipo_movimiento, cantidad_anterior, delta, cantidad_nueva,
                    costo_unitario, ubicacion, motivo_referencia, usuario
                 ) VALUES ($1, $2, 'conteo_fisico', $3, $4, $5, $6, $7, $8, 'admin')`,
                [req.negocio.id, p.id, ant, delta, conteoFisico, p.costo_artesano, p.ubicacion_almacen || 'Almacén Principal Trujillo', motivo]
            );
            actualizados++;
        }

        res.json({
            success: true,
            actualizados,
            message: `Se registró el conteo físico de ${actualizados} productos en el Kardex.`
        });
    } catch (error) {
        logger.error('Inventario: error en conteo-masivo', { error: error.message });
        res.status(500).json({ success: false, message: 'Error al guardar el conteo físico masivo.' });
    }
});

// 6. GET /api/negocios/:negocioSlug/inventario/export.xlsx — Exportar Inventario Maestro (SKU, EAN-13, Stock, Valorización) + Kardex
router.get('/:negocioSlug/inventario/export.xlsx', requireNegocioAuth, async (req, res) => {
    try {
        const { rows: productos } = await pool.query(
            `SELECT ${PRODUCT_COLUMNS} FROM negocio_productos WHERE negocio_id = $1 ORDER BY linea ASC, sublinea ASC, nombre ASC`,
            [req.negocio.id]
        );
        const { rows: kardex } = await pool.query(
            `SELECT m.*, p.sku, p.ean, p.nombre AS producto_nombre
             FROM negocio_inventario_movimientos m
             JOIN negocio_productos p ON p.id = m.producto_id
             WHERE m.negocio_id = $1
             ORDER BY m.created_at DESC
             LIMIT 300`,
            [req.negocio.id]
        );

        const workbook = new ExcelJS.Workbook();
        const sheetInv = workbook.addWorksheet('Inventario y Matricula SKU-EAN');
        sheetInv.columns = [
            { header: 'SKU Interno', key: 'sku', width: 20 },
            { header: 'Código EAN-13', key: 'ean', width: 18 },
            { header: 'Producto', key: 'nombre', width: 32 },
            { header: 'Línea', key: 'linea', width: 22 },
            { header: 'Sub-línea', key: 'sublinea', width: 22 },
            { header: 'Colección', key: 'coleccion', width: 22 },
            { header: 'Stock Físico', key: 'stock', width: 14 },
            { header: 'Stock Mín.', key: 'stockMin', width: 12 },
            { header: 'Costo Artesano (S/)', key: 'costo', width: 18 },
            { header: 'Precio Venta (S/)', key: 'precio', width: 18 },
            { header: 'Valor Costo Total (S/)', key: 'valCosto', width: 20 },
            { header: 'Valor Venta Total (S/)', key: 'valVenta', width: 20 },
            { header: 'Ubicación Almacén', key: 'ubicacion', width: 26 },
            { header: 'Política Sin Stock', key: 'politica', width: 16 }
        ];
        sheetInv.getRow(1).font = { bold: true };

        for (const p of productos) {
            const st = Math.max(0, Number(p.stock_actual || 0));
            const c = Number(p.costo_artesano || 0);
            const pr = (p.precio_oferta && Number(p.precio_oferta) > 0 && Number(p.precio_oferta) < Number(p.precio))
                ? Number(p.precio_oferta)
                : Number(p.precio || 0);
            sheetInv.addRow({
                sku: p.sku || '',
                ean: p.ean || '',
                nombre: p.nombre,
                linea: p.linea || '',
                sublinea: p.sublinea || '',
                coleccion: p.coleccion || '',
                stock: st,
                stockMin: Number(p.stock_minimo || 1),
                costo: c,
                precio: pr,
                valCosto: Number((st * c).toFixed(2)),
                valVenta: Number((st * pr).toFixed(2)),
                ubicacion: p.ubicacion_almacen || 'Almacén Principal Trujillo',
                politica: p.politica_sin_stock || 'preventa'
            });
        }

        const sheetKardex = workbook.addWorksheet('Kardex Movimientos');
        sheetKardex.columns = [
            { header: 'Fecha / Hora', key: 'fecha', width: 22 },
            { header: 'SKU', key: 'sku', width: 20 },
            { header: 'EAN-13', key: 'ean', width: 18 },
            { header: 'Producto', key: 'producto', width: 30 },
            { header: 'Tipo Movimiento', key: 'tipo', width: 22 },
            { header: 'Stock Anterior', key: 'ant', width: 15 },
            { header: 'Variación (Delta)', key: 'delta', width: 16 },
            { header: 'Stock Nuevo', key: 'nuevo', width: 15 },
            { header: 'Ubicación', key: 'ubicacion', width: 24 },
            { header: 'Referencia / Motivo', key: 'motivo', width: 32 }
        ];
        sheetKardex.getRow(1).font = { bold: true };

        for (const m of kardex) {
            sheetKardex.addRow({
                fecha: new Date(m.created_at).toLocaleString('es-PE', { timeZone: 'America/Lima' }),
                sku: m.sku || '',
                ean: m.ean || '',
                producto: m.producto_nombre || '',
                tipo: m.tipo_movimiento,
                ant: Number(m.cantidad_anterior),
                delta: Number(m.delta),
                nuevo: Number(m.cantidad_nueva),
                ubicacion: m.ubicacion || '',
                motivo: m.motivo_referencia || ''
            });
        }

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${req.negocio.slug}-inventario-kardex.xlsx"`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        logger.error('Inventario: error exportando Excel de inventario', { error: error.message });
        res.status(500).json({ success: false, message: 'Error al exportar inventario.' });
    }
});

// 7. GET /api/negocios/:negocioSlug/inventario/producto/:id/ficha — Ficha Técnica Maestra 360° + Kardex individual + Métricas de Venta
router.get('/:negocioSlug/inventario/producto/:id/ficha', requireNegocioAuth, async (req, res) => {
    try {
        const prodId = parseInt(req.params.id, 10);
        if (!Number.isInteger(prodId)) {
            return res.status(400).json({ success: false, message: 'ID de producto inválido.' });
        }
        const { rows: prodRows } = await pool.query(
            `SELECT ${PRODUCT_COLUMNS} FROM negocio_productos WHERE id = $1 AND negocio_id = $2`,
            [prodId, req.negocio.id]
        );
        if (prodRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Producto no encontrado.' });
        }
        const producto = prodRows[0];

        const { rows: kardex } = await pool.query(
            `SELECT id, tipo_movimiento, cantidad_anterior, delta, cantidad_nueva, costo_unitario, ubicacion, motivo_referencia, usuario, created_at
             FROM negocio_inventario_movimientos
             WHERE negocio_id = $1 AND producto_id = $2
             ORDER BY created_at DESC
             LIMIT 100`,
            [req.negocio.id, prodId]
        );

        const totalSalidas = kardex
            .filter(m => m.tipo_movimiento === 'salida_venta')
            .reduce((acc, m) => acc + Math.abs(Number(m.delta || 0)), 0);
        const totalEntradas = kardex
            .filter(m => m.tipo_movimiento === 'entrada_mercaderia' || m.tipo_movimiento === 'recepcion_artesano')
            .reduce((acc, m) => acc + Math.max(0, Number(m.delta || 0)), 0);

        const precioEff = (producto.precio_oferta && Number(producto.precio_oferta) > 0 && Number(producto.precio_oferta) < Number(producto.precio))
            ? Number(producto.precio_oferta)
            : Number(producto.precio || 0);
        const costoEff = Number(producto.costo_artesano || 0);
        const margenUnitario = Number((precioEff - costoEff).toFixed(2));
        const margenPct = precioEff > 0 ? Math.round((margenUnitario / precioEff) * 100) : 0;
        const stockAct = Number(producto.stock_actual || 0);
        const stockMin = Number(producto.stock_minimo || 1);
        const estadoStock = stockAct <= 0 ? 'agotado' : (stockAct <= stockMin ? 'bajo' : 'ok');

        res.json({
            success: true,
            producto,
            kardex,
            resumen: {
                total_salidas_venta: totalSalidas,
                total_entradas: totalEntradas,
                total_movimientos: kardex.length,
                margen_unitario: margenUnitario,
                margen_pct: margenPct,
                estado_stock: estadoStock
            }
        });
    } catch (error) {
        logger.error('Inventario: error obteniendo ficha 360 de producto', { error: error.message });
        res.status(500).json({ success: false, message: 'No se pudo cargar la ficha del producto.' });
    }
});

module.exports = router;
