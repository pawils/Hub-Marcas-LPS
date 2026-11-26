// server/services/sku-ean.service.js
// Servicio centralizado GS1 EAN-13, SKU Numérico Retail, Esquema de Producto y Sincronización de Catálogo Base
// Arquitectura Modular Hub Marcas LPS (WMS + PIM)

const pool = require('../db.config');
const logger = require('../utils/logger');
const { PRODUCTOS_CATALOGO } = require('../data/artesanitas-productos');

const PRODUCT_COLUMNS = `
    id, slug, nombre, precio, precio_oferta, etiqueta_promo, costo_artesano, moneda,
    sku, ean, stock_actual, stock_minimo, politica_sin_stock, vender_sin_stock, fecha_entrega_estimada,
    linea, sublinea, sub_sublinea, coleccion,
    tipo_producto, modelo, color, tamano_dimensiones, caracteristicas,
    ubicacion_almacen, unidad_medida, ultimo_conteo_at,
    descripcion, imagenes, activo, created_at
`;

let _productColsEnsured = null;
async function ensureProductColumns() {
    if (!_productColsEnsured) {
        _productColsEnsured = pool.query(`
            ALTER TABLE negocio_productos ADD COLUMN IF NOT EXISTS vender_sin_stock BOOLEAN NOT NULL DEFAULT FALSE;
            ALTER TABLE negocio_productos ADD COLUMN IF NOT EXISTS fecha_entrega_estimada DATE;
        `).catch((err) => {
            _productColsEnsured = null;
            logger.warn('Negocios: no se pudo asegurar columnas de producto', { error: err.message });
        });
    }
    return _productColsEnsured;
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
    const seq = (countRows[0]?.max_id || countRows[0]?.total || 0) + 1;

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

async function syncCatalogoBaseAInventario(negocioId, negocioSlug) {
    let matriculadosNuevos = 0;
    const { rows: existingRows } = await pool.query(
        `SELECT slug FROM negocio_productos WHERE negocio_id = $1`,
        [negocioId]
    );
    const existingSlugs = new Set(existingRows.map(r => r.slug));

    const catalogoBase = [
        ...(Array.isArray(PRODUCTOS_CATALOGO) ? PRODUCTOS_CATALOGO : []),
        { slug: 'taza-navidad-papa-noel', nombre: 'Taza Navideña Papá Noel', precio: 59.90, coleccion: 'Colección Navidad', imagenes: ['/imagenes/Artesanitas/reservas_navidad_2026/Taza_navidad_papa_noel_1.jpeg'] },
        { slug: 'taza-muneco-de-nieve', nombre: 'Taza Muñeco de Nieve', precio: 59.90, coleccion: 'Colección Navidad', imagenes: ['/imagenes/Artesanitas/reservas_navidad_2026/Taza_muneco_de_nieve_1.jpeg'] },
        { slug: 'taza-arbolito-chocolatosa', nombre: 'Taza Arbolito Chocolatosa', precio: 59.90, coleccion: 'Colección Navidad', imagenes: ['/imagenes/Artesanitas/reservas_navidad_2026/Taza_arbolito_Chocolatosa.jpeg'] },
        { slug: 'taza-arbolito-rosa', nombre: 'Taza Arbolito Rosa', precio: 59.90, coleccion: 'Colección Navidad', imagenes: ['/imagenes/Artesanitas/reservas_navidad_2026/Taza_arbolito_Rosa.jpeg'] },
        { slug: 'taza-piston-cup', nombre: 'Taza Piston Cup', precio: 59.00, coleccion: 'Personajes & Licencias', imagenes: ['/imagenes/Artesanitas/Fotos/Taza_Piston_1.jpeg'] },
        { slug: 'adorno-paltita', nombre: 'Adorno Paltita', precio: 35.00, linea: 'Decoración & Maceteros', sublinea: 'Adornos con Plantita', coleccion: 'Catálogo General', imagenes: ['/imagenes/Artesanitas/Fotos/Adorno_Paltita_1.jpeg'] },
        { slug: 'adorno-oso-sentado', nombre: 'Adorno Oso sentado', precio: 32.00, linea: 'Decoración & Maceteros', sublinea: 'Adornos con Plantita', coleccion: 'Catálogo General', imagenes: ['/imagenes/Artesanitas/Fotos/Adorno_oso_sentado_1.jpeg'] },
        { slug: 'adorno-munequitas', nombre: 'Adorno muñequitas', precio: 29.00, linea: 'Decoración & Maceteros', sublinea: 'Adornos con Plantita', coleccion: 'Catálogo General', imagenes: ['/imagenes/Artesanitas/Fotos/Adorno_munequita_con_plantita_1.jpeg'] },
        { slug: 'platos-uva', nombre: 'Platos uva', precio: 29.00, linea: 'Vajilla Artesanal', sublinea: 'Platos & Bowls', coleccion: 'Catálogo General', imagenes: ['/imagenes/Artesanitas/Fotos/Platos uva.jpeg'] },
        { slug: 'plato-morado-full', nombre: 'Plato morado full', precio: 32.00, linea: 'Vajilla Artesanal', sublinea: 'Platos & Bowls', coleccion: 'Catálogo General', imagenes: ['/imagenes/Artesanitas/Fotos/Plato morado full.jpeg'] }
    ];

    for (const item of catalogoBase) {
        if (!item || !item.slug || existingSlugs.has(item.slug)) continue;
        existingSlugs.add(item.slug);
        const lin = item.linea || (item.slug.includes('adorno') || item.slug.includes('elefantito') || item.slug.includes('jarron') ? 'Decoración & Maceteros' : 'Vajilla Artesanal');
        const sub = item.sublinea || (item.slug.includes('plato') && !item.slug.includes('taza') ? 'Platos & Bowls' : (item.slug.includes('tetera') || item.slug.includes('azucarera') ? 'Teteras & Azucareras' : 'Tazas & Mugs'));
        const col = item.coleccion || (item.slug.includes('navidad') || item.slug.includes('arbolito') ? 'Colección Navidad' : (item.slug.includes('van-gogh') ? 'Colección Van Gogh' : (item.slug.includes('rapunzel') ? 'Colección Rapunzel' : 'Catálogo General')));
        const codes = await generarMatriculaUnica(negocioId, negocioSlug, lin, sub);

        const { rows: ins } = await pool.query(
            `INSERT INTO negocio_productos (
                negocio_id, slug, nombre, precio, sku, ean, stock_actual, stock_minimo,
                politica_sin_stock, linea, sublinea, sub_sublinea, coleccion,
                tipo_producto, descripcion, imagenes, ubicacion_almacen, activo
             ) VALUES ($1, $2, $3, $4, $5, $6, 0, 2, 'preventa', $7, $8, 'Cerámica Pintada a Mano', $9, 'Cerámica', $10, $11, 'Almacén Principal Trujillo', TRUE)
             ON CONFLICT (negocio_id, slug) DO NOTHING
             RETURNING id`,
            [
                negocioId,
                item.slug,
                cleanProductTitle(item.nombre),
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
                [negocioId, ins[0].id, `Auto-matrícula SKU ${codes.sku} · EAN ${codes.ean}`]
            ).catch(() => {});
        }
    }
    return matriculadosNuevos;
}

module.exports = {
    PRODUCT_COLUMNS,
    ensureProductColumns,
    slugify,
    slugUnico,
    buildAutoSku,
    calcularDigitoVerificadorEan13,
    buildAutoEan13,
    generarMatriculaUnica,
    cleanProductTitle,
    syncCatalogoBaseAInventario
};
