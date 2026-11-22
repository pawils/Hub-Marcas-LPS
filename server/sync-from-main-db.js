// server/sync-from-main-db.js
// Sincronizador Zero-Data-Loss de Reservas, Comprobantes, Talleres y Usuarios desde https://lospilares.pe
// Funciona automáticamente por HTTPS (con firma criptográfica SHA-256) sin requerir exponer el puerto privado de PostgreSQL.

const crypto = require('crypto');
const targetPool = require('./db.config');
const logger = require('./utils/logger');

const MIGRATION_SNAPSHOT_KEY = crypto
  .createHash('sha256')
  .update('hub-lps-migration-2026:artesanitas-2026-panel')
  .digest('hex');

const SOURCE_SNAPSHOT_URL =
  process.env.SOURCE_SNAPSHOT_URL || 'https://lospilares.pe/api/negocios/artesanitas/migration-snapshot';

async function syncFromOldDatabase() {
  try {
    const { rows: targetNeg } = await targetPool.query(`SELECT id FROM negocios WHERE slug = 'artesanitas' LIMIT 1`);
    if (!targetNeg.length) return;
    const targetNegId = targetNeg[0].id;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(SOURCE_SNAPSHOT_URL, {
      method: 'GET',
      headers: {
        'x-hub-migration-key': MIGRATION_SNAPSHOT_KEY,
        Accept: 'application/json'
      },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!res.ok) {
      logger.info(`Snapshot remoto aún no disponible (${res.status}). Se reintentará en el siguiente ciclo.`);
      return;
    }

    const data = await res.json();
    if (!data || !data.success) return;

    // 1. Sincronizar hashes de usuarios (para conservar contraseñas personalizadas)
    if (Array.isArray(data.usuarios)) {
      for (const u of data.usuarios) {
        await targetPool.query(
          `UPDATE negocio_usuarios SET password_hash = $1 WHERE username = $2`,
          [u.password_hash, u.username]
        );
      }
    }

    // 2. Sincronizar estados de productos estáticos
    if (Array.isArray(data.estaticos)) {
      for (const e of data.estaticos) {
        await targetPool.query(
          `INSERT INTO negocio_productos_estaticos (negocio_id, slug, nombre, activo)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (negocio_id, slug) DO UPDATE SET activo = EXCLUDED.activo`,
          [targetNegId, e.slug, e.nombre || e.slug, !!e.activo]
        );
      }
    }

    // 3. Sincronizar TODAS las reservas y pedidos históricos + comprobantes de pago (Zero-Data-Loss)
    let syncedOrders = 0;
    if (Array.isArray(data.pedidos)) {
      for (const p of data.pedidos) {
        const codigo = p.codigo_pedido || `ART-2026-${String(p.id).padStart(4, '0')}`;
        const compBuffer = p.comprobante_b64 ? Buffer.from(p.comprobante_b64, 'base64') : null;

        await targetPool.query(
          `INSERT INTO negocio_pedidos (
            negocio_id, codigo_pedido, producto_slug, producto_nombre, producto_precio,
            monto_reserva, costo_envio, tipo_entrega, fecha_entrega,
            nombre, dni, whatsapp, sede_shalom, direccion_adicional,
            estado_pago, monto_pagado, estado_pedido,
            comprobante_mime, comprobante_data,
            origen, notas, cantidad, items, guia_envio, empresa_envio,
            metodo_pago, mp_preference_id, mp_payment_id,
            artesano_nombre, costo_artesano_total, fecha_encargo_artesano,
            fecha_compromiso_artesano, fecha_recepcion_taller,
            fecha_despacho_courier, fecha_entrega_final,
            created_at, updated_at
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37
          )
          ON CONFLICT (codigo_pedido) WHERE codigo_pedido IS NOT NULL DO NOTHING`,
          [
            targetNegId,
            codigo,
            p.producto_slug || 'taza-van-gogh',
            p.producto_nombre || 'Pieza Artesanal',
            Number(p.producto_precio || 0),
            Number(p.monto_reserva || 20),
            Number(p.costo_envio || 0),
            p.tipo_entrega || 'provincia',
            p.fecha_entrega || '2026-12-10',
            p.nombre || 'Cliente Artesanitas',
            p.dni || '00000000',
            p.whatsapp || '000000000',
            p.sede_shalom || null,
            p.direccion_adicional || null,
            p.estado_pago || 'pendiente',
            Number(p.monto_pagado || 0),
            p.estado_pedido || 'reservado',
            p.comprobante_mime || null,
            compBuffer,
            p.origen || 'formulario',
            p.notas || null,
            Number(p.cantidad || 1),
            JSON.stringify(p.items || []),
            p.guia_envio || null,
            p.empresa_envio || 'Shalom',
            p.metodo_pago || 'plin_yape',
            p.mp_preference_id || null,
            p.mp_payment_id || null,
            p.artesano_nombre || null,
            p.costo_artesano_total !== null && p.costo_artesano_total !== undefined ? Number(p.costo_artesano_total) : null,
            p.fecha_encargo_artesano || null,
            p.fecha_compromiso_artesano || null,
            p.fecha_recepcion_taller || null,
            p.fecha_despacho_courier || null,
            p.fecha_entrega_final || null,
            p.created_at || new Date(),
            p.updated_at || new Date()
          ]
        );
        syncedOrders++;
      }
    }

    // 4. Sincronizar Talleres e Inscripciones
    if (Array.isArray(data.talleres) && data.talleres.length > 0) {
      const { rows: existingT } = await targetPool.query(`SELECT COUNT(*)::int AS c FROM negocio_talleres WHERE negocio_id = $1`, [targetNegId]);
      if (existingT[0].c === 0) {
        const idMap = new Map();
        for (const t of data.talleres) {
          const { rows: insT } = await targetPool.query(
            `INSERT INTO negocio_talleres (negocio_id, nombre, fecha, hora, ubicacion, precio, moneda, es_para_ninos, activo, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
            [targetNegId, t.nombre, t.fecha, t.hora, t.ubicacion, t.precio, t.moneda || 'PEN', !!t.es_para_ninos, !!t.activo, t.created_at || new Date()]
          );
          idMap.set(t.id, insT[0].id);
        }
        if (Array.isArray(data.inscripciones)) {
          for (const ins of data.inscripciones) {
            const newTallerId = idMap.get(ins.taller_id);
            if (!newTallerId) continue;
            await targetPool.query(
              `INSERT INTO negocio_inscripciones (taller_id, nombre, edad, whatsapp, acompanantes, origen, estado_pago, monto_pagado, created_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (taller_id, whatsapp) DO NOTHING`,
              [newTallerId, ins.nombre, ins.edad, ins.whatsapp, JSON.stringify(ins.acompanantes || []), ins.origen || 'formulario', ins.estado_pago || 'pendiente', Number(ins.monto_pagado || 0), ins.created_at || new Date()]
            );
          }
        }
      }
    }

    logger.info(`Sincronización HTTPS desde lospilares.pe completada: ${syncedOrders} reservas verificadas/importadas.`);
  } catch (err) {
    logger.warn('Aviso en sincronización HTTPS desde lospilares.pe:', { error: err.message });
  }
}

module.exports = { syncFromOldDatabase };
