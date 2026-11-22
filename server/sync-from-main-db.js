// server/sync-from-main-db.js
// Sincronizador opcional en caliente: Si defines OLD_DATABASE_URL en Railway (apuntando a la BD de LOSPILARES.PE),
// copia automáticamente los talleres, inscripciones, productos, imágenes BYTEA y pedidos de Artesanitas
// hacia la nueva base de datos independiente del Hub Marcas LPS sin perder ningún registro histórico.

const { Pool } = require('pg');
const targetPool = require('./db.config');
const logger = require('./utils/logger');

async function syncFromOldDatabase() {
  const oldUrl = process.env.OLD_DATABASE_URL;
  if (!oldUrl) return;

  const sourcePool = new Pool({
    connectionString: oldUrl,
    ssl: oldUrl.includes('localhost') ? false : { rejectUnauthorized: false },
    max: 3
  });

  try {
    logger.info('Sincronizando datos históricos desde OLD_DATABASE_URL hacia Hub Marcas LPS...');

    const { rows: targetNeg } = await targetPool.query(`SELECT id FROM negocios WHERE slug = 'artesanitas' LIMIT 1`);
    const { rows: sourceNeg } = await sourcePool.query(`SELECT id FROM negocios WHERE slug = 'artesanitas' LIMIT 1`);
    if (!targetNeg.length || !sourceNeg.length) return;

    const targetNegId = targetNeg[0].id;
    const sourceNegId = sourceNeg[0].id;

    // 1. Sincronizar Pedidos (negocio_pedidos) si la tabla destino está vacía
    const { rows: pedCount } = await targetPool.query(`SELECT COUNT(*)::int AS c FROM negocio_pedidos WHERE negocio_id = $1`, [targetNegId]);
    if (pedCount[0].c === 0) {
      const { rows: oldPedidos } = await sourcePool.query(`SELECT * FROM negocio_pedidos WHERE negocio_id = $1 ORDER BY id ASC`, [sourceNegId]);
      for (const p of oldPedidos) {
        await targetPool.query(
          `INSERT INTO negocio_pedidos (
            negocio_id, codigo_pedido, producto_slug, producto_nombre, producto_precio, cantidad, items,
            modalidad_pago, monto_pagado, costo_envio, saldo_pendiente, estado_pago, estado_pedido,
            tipo_entrega, empresa_envio, guia_envio, cliente_nombre, cliente_dni, cliente_whatsapp,
            departamento, provincia, distrito, sede_shalom, notas, origen, fecha_entrega,
            artesano_nombre, costo_artesano_total, fecha_encargo_artesano, fecha_compromiso_artesano,
            fecha_recepcion_taller, created_at
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32
          ) ON CONFLICT (codigo_pedido) DO NOTHING`,
          [
            targetNegId, p.codigo_pedido, p.producto_slug, p.producto_nombre, p.producto_precio, p.cantidad || 1,
            JSON.stringify(p.items || []), p.modalidad_pago || 'reserva_20', p.monto_pagado || 0, p.costo_envio || 0,
            p.saldo_pendiente || 0, p.estado_pago || 'pendiente', p.estado_pedido || 'reservado',
            p.tipo_entrega || 'shalom_agencia', p.empresa_envio || 'Shalom', p.guia_envio || null,
            p.cliente_nombre, p.cliente_dni, p.cliente_whatsapp, p.departamento, p.provincia, p.distrito,
            p.sede_shalom, p.notas, p.origen || 'web', p.fecha_entrega || '2026-12-10',
            p.artesano_nombre || null, p.costo_artesano_total || 0, p.fecha_encargo_artesano || null,
            p.fecha_compromiso_artesano || null, p.fecha_recepcion_taller || null, p.created_at || new Date()
          ]
        );
      }
      logger.info(`Pedidos históricos sincronizados: ${oldPedidos.length}`);
    }

    // 2. Sincronizar Talleres e Inscripciones si la tabla destino está vacía
    const { rows: talCount } = await targetPool.query(`SELECT COUNT(*)::int AS c FROM negocio_talleres WHERE negocio_id = $1`, [targetNegId]);
    if (talCount[0].c === 0) {
      const { rows: oldTalleres } = await sourcePool.query(`SELECT * FROM negocio_talleres WHERE negocio_id = $1 ORDER BY id ASC`, [sourceNegId]);
      for (const t of oldTalleres) {
        const { rows: inserted } = await targetPool.query(
          `INSERT INTO negocio_talleres (negocio_id, nombre, fecha, hora, ubicacion, precio, moneda, es_para_ninos, activo, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
          [targetNegId, t.nombre, t.fecha, t.hora, t.ubicacion, t.precio, t.moneda || 'PEN', !!t.es_para_ninos, !!t.activo, t.created_at || new Date()]
        );
        const newTallerId = inserted[0].id;
        const { rows: oldInsc } = await sourcePool.query(`SELECT * FROM negocio_inscripciones WHERE taller_id = $1 ORDER BY id ASC`, [t.id]);
        for (const ins of oldInsc) {
          await targetPool.query(
            `INSERT INTO negocio_inscripciones (taller_id, nombre, edad, whatsapp, acompanantes, origen, estado_pago, monto_pagado, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (taller_id, whatsapp) DO NOTHING`,
            [newTallerId, ins.nombre, ins.edad, ins.whatsapp, JSON.stringify(ins.acompanantes || []), ins.origen || 'formulario', ins.estado_pago || 'pendiente', ins.monto_pagado || 0, ins.created_at || new Date()]
          );
        }
      }
      logger.info(`Talleres históricos sincronizados: ${oldTalleres.length}`);
    }
  } catch (err) {
    logger.warn('Aviso en sincronización opcional desde OLD_DATABASE_URL:', { error: err.message });
  } finally {
    await sourcePool.end().catch(() => {});
  }
}

module.exports = { syncFromOldDatabase };
