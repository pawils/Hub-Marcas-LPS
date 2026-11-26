// server/routes/wms-inventario.routes.js
// Módulo Enterprise WMS (Warehouse Management System): Inventarios, Conteo Físico, Kardex, Exportación Excel y Ficha 360°

const express = require('express');
const router = express.Router({ mergeParams: true });
const ExcelJS = require('exceljs');
const pool = require('../db.config');
const logger = require('../utils/logger');
const { resolveNegocioSlug, requireNegocioAuth } = require('../middleware/negocio-auth.middleware');
const {
    PRODUCT_COLUMNS,
    ensureProductColumns,
    generarMatriculaUnica,
    syncCatalogoBaseAInventario
} = require('../services/sku-ean.service');

router.param('negocioSlug', resolveNegocioSlug);

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
        await ensureProductColumns();
        const matriculadosNuevos = await syncCatalogoBaseAInventario(req.negocio.id, req.negocio.slug);
        let codigosCompletados = 0;

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

// 3. GET /api/negocios/:negocioSlug/inventario/resumen — Resumen WMS + Lista de Stock + Kardex reciente
router.get('/:negocioSlug/inventario/resumen', requireNegocioAuth, async (req, res) => {
    try {
        await ensureProductColumns();
        if (req.negocio.slug === 'artesanitas') {
            await syncCatalogoBaseAInventario(req.negocio.id, req.negocio.slug);
        }

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
            { header: 'Costo (S/)', key: 'costo', width: 16 },
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
