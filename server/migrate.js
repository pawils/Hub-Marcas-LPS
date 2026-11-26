// server/migrate.js — Migraciones autónomas del Hub Multi-Tenant Marcas Aliadas LPS
// Esquema 100% idéntico y compatible con las tablas de producción de Artesanitas
const pool = require('./db.config');
const bcrypt = require('bcryptjs');
const logger = require('./utils/logger');
const { syncFromOldDatabase } = require('./sync-from-main-db');

async function runMigrations() {
  try {
    logger.info('Iniciando migraciones del Hub Marcas Aliadas LPS...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS negocios (
        id SERIAL PRIMARY KEY,
        slug VARCHAR(60) UNIQUE NOT NULL,
        nombre VARCHAR(120) NOT NULL,
        access_key VARCHAR(64) NOT NULL,
        email_notif VARCHAR(150),
        meta_pixel_id VARCHAR(40),
        plan_tier VARCHAR(30) DEFAULT 'aliado_free',
        subdominio VARCHAR(80),
        mp_public_key TEXT,
        mp_access_token TEXT,
        mp_webhook_secret TEXT,
        mp_descriptor VARCHAR(30),
        whatsapp_contacto VARCHAR(30) DEFAULT '51929938466',
        activo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS negocio_usuarios (
        id SERIAL PRIMARY KEY,
        username VARCHAR(60) UNIQUE NOT NULL,
        password_hash VARCHAR(100) NOT NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('superadmin', 'negocio')),
        negocio_id INTEGER REFERENCES negocios(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS negocio_talleres (
        id SERIAL PRIMARY KEY,
        negocio_id INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
        nombre VARCHAR(150) NOT NULL,
        fecha DATE NOT NULL,
        hora VARCHAR(60),
        ubicacion VARCHAR(150),
        precio NUMERIC(10, 2),
        moneda VARCHAR(10) DEFAULT 'PEN',
        es_para_ninos BOOLEAN DEFAULT FALSE,
        activo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS negocio_inscripciones (
        id SERIAL PRIMARY KEY,
        taller_id INTEGER NOT NULL REFERENCES negocio_talleres(id) ON DELETE CASCADE,
        nombre VARCHAR(100) NOT NULL,
        edad INTEGER NOT NULL,
        whatsapp VARCHAR(20) NOT NULL,
        acompanantes JSONB NOT NULL DEFAULT '[]'::jsonb,
        origen VARCHAR(20) NOT NULL DEFAULT 'formulario',
        estado_pago VARCHAR(20) NOT NULL DEFAULT 'pendiente',
        monto_pagado NUMERIC(10, 2) NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (taller_id, whatsapp)
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS negocio_productos (
        id SERIAL PRIMARY KEY,
        negocio_id INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
        slug VARCHAR(120) NOT NULL,
        nombre VARCHAR(150) NOT NULL,
        precio NUMERIC(10, 2) NOT NULL,
        precio_oferta NUMERIC(10, 2),
        etiqueta_promo VARCHAR(40),
        costo_artesano NUMERIC(10, 2) DEFAULT 0,
        moneda VARCHAR(10) NOT NULL DEFAULT 'PEN',
        sku VARCHAR(60),
        ean VARCHAR(30),
        stock_actual INTEGER NOT NULL DEFAULT 0,
        stock_minimo INTEGER NOT NULL DEFAULT 1,
        politica_sin_stock VARCHAR(20) NOT NULL DEFAULT 'preventa',
        linea VARCHAR(80) DEFAULT 'Vajilla Artesanal',
        sublinea VARCHAR(80) DEFAULT 'Tazas & Mugs',
        sub_sublinea VARCHAR(80) DEFAULT 'Cerámica Pintada a Mano',
        coleccion VARCHAR(80) DEFAULT 'Catálogo General',
        tipo_producto VARCHAR(60) DEFAULT 'Taza',
        modelo VARCHAR(80),
        color VARCHAR(60),
        tamano_dimensiones VARCHAR(120),
        caracteristicas TEXT,
        descripcion TEXT,
        imagenes JSONB NOT NULL DEFAULT '[]'::jsonb,
        orden INTEGER NOT NULL DEFAULT 0,
        activo BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (negocio_id, slug)
      );
      ALTER TABLE negocio_productos ADD COLUMN IF NOT EXISTS moneda VARCHAR(10) NOT NULL DEFAULT 'PEN';
      ALTER TABLE negocio_productos ADD COLUMN IF NOT EXISTS ubicacion_almacen VARCHAR(80) DEFAULT 'Almacén Principal Trujillo';
      ALTER TABLE negocio_productos ADD COLUMN IF NOT EXISTS unidad_medida VARCHAR(20) DEFAULT 'UND';
      ALTER TABLE negocio_productos ADD COLUMN IF NOT EXISTS ultimo_conteo_at TIMESTAMPTZ;
      ALTER TABLE negocio_productos ADD COLUMN IF NOT EXISTS vender_sin_stock BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE negocio_productos ADD COLUMN IF NOT EXISTS fecha_entrega_estimada DATE;
      CREATE INDEX IF NOT EXISTS idx_negocio_productos_sku ON negocio_productos (negocio_id, sku);
      CREATE INDEX IF NOT EXISTS idx_negocio_productos_ean ON negocio_productos (negocio_id, ean);
    `);

    // Kardex de Movimientos de Inventario y Conteo Físico (Estándar Shopify WMS)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS negocio_inventario_movimientos (
        id SERIAL PRIMARY KEY,
        negocio_id INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
        producto_id INTEGER NOT NULL REFERENCES negocio_productos(id) ON DELETE CASCADE,
        tipo_movimiento VARCHAR(40) NOT NULL DEFAULT 'entrada_mercaderia',
        cantidad_anterior INTEGER NOT NULL DEFAULT 0,
        delta INTEGER NOT NULL DEFAULT 0,
        cantidad_nueva INTEGER NOT NULL DEFAULT 0,
        costo_unitario NUMERIC(10, 2),
        ubicacion VARCHAR(80) DEFAULT 'Almacén Principal Trujillo',
        motivo_referencia TEXT,
        usuario VARCHAR(80) DEFAULT 'admin',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_negocio_inv_mov_negocio ON negocio_inventario_movimientos (negocio_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_negocio_inv_mov_prod ON negocio_inventario_movimientos (producto_id, created_at DESC);
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS negocio_producto_fotos (
        id SERIAL PRIMARY KEY,
        producto_id INTEGER NOT NULL REFERENCES negocio_productos(id) ON DELETE CASCADE,
        negocio_id INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
        posicion INTEGER NOT NULL DEFAULT 0,
        mime_type VARCHAR(50) NOT NULL DEFAULT 'image/webp',
        foto_data BYTEA NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_negocio_producto_fotos_prod ON negocio_producto_fotos (producto_id, posicion);
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS negocio_productos_estaticos (
        id SERIAL PRIMARY KEY,
        negocio_id INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
        slug VARCHAR(120) NOT NULL,
        nombre VARCHAR(150) NOT NULL DEFAULT '',
        activo BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (negocio_id, slug)
      );
      ALTER TABLE negocio_productos_estaticos ADD COLUMN IF NOT EXISTS nombre VARCHAR(150) NOT NULL DEFAULT '';
      ALTER TABLE negocio_productos_estaticos ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS negocio_pedidos (
        id SERIAL PRIMARY KEY,
        negocio_id INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
        codigo_pedido VARCHAR(32),
        producto_slug VARCHAR(120) NOT NULL DEFAULT 'taza-van-gogh',
        producto_nombre VARCHAR(200) NOT NULL DEFAULT 'Taza Van Gogh',
        producto_precio NUMERIC(10, 2) NOT NULL DEFAULT 69.00,
        monto_reserva NUMERIC(10, 2) NOT NULL DEFAULT 20.00,
        costo_envio NUMERIC(10, 2) NOT NULL DEFAULT 10.00,
        tipo_entrega VARCHAR(50) NOT NULL DEFAULT 'provincia',
        fecha_entrega DATE NOT NULL DEFAULT '2026-12-10',
        nombre VARCHAR(150),
        dni VARCHAR(20),
        whatsapp VARCHAR(25),
        sede_shalom TEXT,
        direccion_adicional TEXT,
        estado_pago VARCHAR(20) NOT NULL DEFAULT 'pendiente',
        monto_pagado NUMERIC(10, 2) NOT NULL DEFAULT 20.00,
        estado_pedido VARCHAR(30) NOT NULL DEFAULT 'reservado',
        comprobante_mime VARCHAR(50),
        comprobante_data BYTEA,
        origen VARCHAR(30) NOT NULL DEFAULT 'formulario',
        notas TEXT,
        cantidad INTEGER NOT NULL DEFAULT 1,
        items JSONB DEFAULT '[]'::jsonb,
        guia_envio VARCHAR(80),
        empresa_envio VARCHAR(50) DEFAULT 'Shalom',
        metodo_pago VARCHAR(30) DEFAULT 'plin_yape',
        mp_preference_id VARCHAR(120),
        mp_payment_id VARCHAR(80),
        artesano_nombre VARCHAR(120),
        costo_artesano_total NUMERIC(10, 2),
        fecha_encargo_artesano DATE,
        fecha_compromiso_artesano DATE,
        fecha_recepcion_taller TIMESTAMPTZ,
        fecha_despacho_courier TIMESTAMPTZ,
        fecha_entrega_final TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      -- Self-healing por si la tabla se creó con columnas preliminares en el primer deploy
      ALTER TABLE negocio_pedidos ADD COLUMN IF NOT EXISTS nombre VARCHAR(150);
      ALTER TABLE negocio_pedidos ADD COLUMN IF NOT EXISTS dni VARCHAR(20);
      ALTER TABLE negocio_pedidos ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(25);
      ALTER TABLE negocio_pedidos ADD COLUMN IF NOT EXISTS direccion_adicional TEXT;
      ALTER TABLE negocio_pedidos ADD COLUMN IF NOT EXISTS monto_reserva NUMERIC(10, 2) NOT NULL DEFAULT 20.00;
      ALTER TABLE negocio_pedidos ADD COLUMN IF NOT EXISTS comprobante_mime VARCHAR(50);
      ALTER TABLE negocio_pedidos ADD COLUMN IF NOT EXISTS comprobante_data BYTEA;
      ALTER TABLE negocio_pedidos ADD COLUMN IF NOT EXISTS metodo_pago VARCHAR(30) DEFAULT 'plin_yape';
      ALTER TABLE negocio_pedidos ALTER COLUMN sede_shalom DROP NOT NULL;

      -- Sprint 3: Flujo detallado de Artesanos (Modelado -> 1° Horno -> 2° Horno -> Pintado -> QA Artesanitas -> Envío Taller)
      ALTER TABLE negocio_pedidos ADD COLUMN IF NOT EXISTS artesano_id INTEGER;
      ALTER TABLE negocio_pedidos ADD COLUMN IF NOT EXISTS etapa_artesano VARCHAR(40) DEFAULT 'recibido';
      ALTER TABLE negocio_pedidos ADD COLUMN IF NOT EXISTS especificaciones_artesano TEXT;
      ALTER TABLE negocio_pedidos ADD COLUMN IF NOT EXISTS qa_estado VARCHAR(30) DEFAULT 'pendiente';
      ALTER TABLE negocio_pedidos ADD COLUMN IF NOT EXISTS qa_checklist JSONB DEFAULT '{"onzas":false,"logos":false,"colores":false,"acabados":false}'::jsonb;
      ALTER TABLE negocio_pedidos ADD COLUMN IF NOT EXISTS qa_observaciones TEXT;
      ALTER TABLE negocio_pedidos ADD COLUMN IF NOT EXISTS ciudad_destino VARCHAR(120);

      -- Sprint 4: Meta Conversions API (CAPI Server-Side)
      ALTER TABLE negocios ADD COLUMN IF NOT EXISTS meta_capi_token TEXT;
      ALTER TABLE negocio_pedidos ADD COLUMN IF NOT EXISTS meta_event_id VARCHAR(64);

      -- Sprint 5: Validación Inteligente de Vouchers Yape/Plin con Visión IA (Anti-Fraude)
      ALTER TABLE negocio_pedidos ADD COLUMN IF NOT EXISTS voucher_nro_operacion VARCHAR(40);
      ALTER TABLE negocio_pedidos ADD COLUMN IF NOT EXISTS voucher_monto_detectado NUMERIC(10, 2);
      ALTER TABLE negocio_pedidos ADD COLUMN IF NOT EXISTS voucher_entidad_detectada VARCHAR(40);
      ALTER TABLE negocio_pedidos ADD COLUMN IF NOT EXISTS voucher_verificacion_ia VARCHAR(30) DEFAULT 'pendiente';

      CREATE UNIQUE INDEX IF NOT EXISTS idx_negocio_pedidos_codigo_unique ON negocio_pedidos (codigo_pedido) WHERE codigo_pedido IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_negocio_pedidos_negocio ON negocio_pedidos (negocio_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_negocio_pedidos_dni ON negocio_pedidos (negocio_id, dni);
      CREATE INDEX IF NOT EXISTS idx_negocio_pedidos_voucher_op ON negocio_pedidos (negocio_id, voucher_nro_operacion) WHERE voucher_nro_operacion IS NOT NULL;
    `);

    // Sprint 3: Tabla de Artesanos Tercerizados (Magic Link Portal)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS negocio_artesanos (
        id SERIAL PRIMARY KEY,
        negocio_id INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
        nombre VARCHAR(120) NOT NULL,
        whatsapp VARCHAR(25),
        especialidad VARCHAR(120) DEFAULT 'Modelado y Pintura Cerámica',
        access_token VARCHAR(64) UNIQUE NOT NULL,
        activo BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (negocio_id, nombre)
      );
      CREATE INDEX IF NOT EXISTS idx_negocio_artesanos_token ON negocio_artesanos (access_token);
    `);

    // Sprint 6: Tabla de Suscripciones Web Push (Admin & Comprador por codigo_pedido)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS negocio_push_subscriptions (
        id SERIAL PRIMARY KEY,
        negocio_id INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
        rol VARCHAR(20) NOT NULL DEFAULT 'comprador' CHECK (rol IN ('admin', 'comprador', 'artesano')),
        codigo_pedido VARCHAR(32),
        endpoint TEXT UNIQUE NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        user_agent TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_negocio_push_negocio_rol ON negocio_push_subscriptions (negocio_id, rol);
      CREATE INDEX IF NOT EXISTS idx_negocio_push_codigo ON negocio_push_subscriptions (negocio_id, codigo_pedido);
    `);

    // Quitar NOT NULL de columnas antiguas si existieran del primer deploy
    await pool.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='negocio_pedidos' AND column_name='cliente_nombre') THEN
          ALTER TABLE negocio_pedidos ALTER COLUMN cliente_nombre DROP NOT NULL;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='negocio_pedidos' AND column_name='cliente_dni') THEN
          ALTER TABLE negocio_pedidos ALTER COLUMN cliente_dni DROP NOT NULL;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='negocio_pedidos' AND column_name='cliente_whatsapp') THEN
          ALTER TABLE negocio_pedidos ALTER COLUMN cliente_whatsapp DROP NOT NULL;
        END IF;
      END $$;
    `).catch(() => {});

    // Seed inicial del negocio piloto Artesanitas
    await pool.query(`
      INSERT INTO negocios (slug, nombre, access_key, email_notif, meta_pixel_id, plan_tier, subdominio, mp_descriptor)
      VALUES ('artesanitas', 'Artesanitas Perú', 'artesanitas-2026-panel', 'artesanitas.pe@gmail.com', '851775257895823', 'aliado_free', 'artesanitas.lospilares.pe', 'ARTESANITAS')
      ON CONFLICT (slug) DO NOTHING;
    `);

    const { rows: userCount } = await pool.query('SELECT COUNT(*)::int AS c FROM negocio_usuarios');
    if (userCount[0].c === 0) {
      const superHash = await bcrypt.hash(process.env.SUPERADMIN_INITIAL_PASSWORD || 'Pilares2026!', 10);
      const artHash = await bcrypt.hash(process.env.ARTESANITAS_INITIAL_PASSWORD || 'Artesanitas2026!', 10);
      await pool.query(
        `INSERT INTO negocio_usuarios (username, password_hash, role, negocio_id)
         VALUES ('superadmin', $1, 'superadmin', NULL)
         ON CONFLICT (username) DO NOTHING`,
        [superHash]
      );
      await pool.query(
        `INSERT INTO negocio_usuarios (username, password_hash, role, negocio_id)
         SELECT 'artesanitas', $1, 'negocio', id FROM negocios WHERE slug = 'artesanitas'
         ON CONFLICT (username) DO NOTHING`,
        [artHash]
      );
    }

    // Seed inicial de productos estáticos y de los 6 productos dinámicos de Artesanitas
    const { rows: artRow } = await pool.query(`SELECT id FROM negocios WHERE slug = 'artesanitas' LIMIT 1`);
    if (artRow.length > 0) {
      const artId = artRow[0].id;

      const staticProducts = [
        ['taza-corazon-y-plato', 'Taza corazón y plato', true],
        ['taza-castellana', 'Taza Castellana', true],
        ['elefantitos-decorativos', 'Elefantitos decorativos', true],
        ['taza-lavanda-abejita', 'Taza lavanda abejita', true],
        ['elefantitos-decorativos-variante', 'Elefantitos decorativos (Variante)', true],
        ['jarron-prada', 'Jarrón Prada', true],
        ['jarron-silueta-y-flores', 'Jarrón Silueta y Flores', true],
        ['munequitas', 'Muñequitas', true],
        ['taza-flor', 'Taza Flor', true],
        ['taza-stich', 'Taza Stich', true],
        ['taza-rapunzel-moradito', 'Taza Rapunzel Moradito', true],
        ['taza-runner', 'Taza Runner', true],
        ['taza-rapunzel-palo-rosa', 'Taza Rapunzel Palo Rosa', false],
        ['tetera-corazon', 'Tetera Corazón', false]
      ];
      for (const [slug, nombre, activo] of staticProducts) {
        await pool.query(
          `INSERT INTO negocio_productos_estaticos (negocio_id, slug, nombre, activo)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (negocio_id, slug) DO NOTHING`,
          [artId, slug, nombre, activo]
        );
      }

      // Asegurar siempre que los 6 productos dinámicos principales (incluida Taza Fórmula 1) existan y estén activos
      const initialProducts = [
        {
          slug: 'taza-perry-el-ornitorrinco',
          nombre: 'Taza Perry el Ornitorrinco',
          precio: 65.00,
          sku: '1023',
          descripcion: 'Una taza hecha a mano, inspirada en el divertido e icónico Perry el Ornitorrinco de Phineas y Ferb. Elaborada artesanalmente con detalles cuidadosamente pintados.',
          imagenes: ['/imagenes/Artesanitas/Fotos/taza_perry_el_ornitorrinco_1.jpg']
        },
        {
          slug: 'tazas-caspianas',
          nombre: 'Tazas Caspianas',
          precio: 69.00,
          sku: '1124',
          descripcion: 'Delicadas, sutiles y llenas de encanto. Nuestras tazas rosadas incluyen platito en forma de margarita, perfectas para acompañar tu café, té o bebida favorita.',
          imagenes: ['/imagenes/Artesanitas/Fotos/tazas_caspianas_1.jpeg']
        },
        {
          slug: 'corazon-de-ceramica-para-pintar',
          nombre: 'Corazón de Cerámica para Pintar',
          precio: 65.00,
          sku: '3025',
          descripcion: 'Corazón de cerámica listo para pintar y personalizar a tu estilo. Incluye kit de 5 pinturas y pinceles para disfrutar una tarde creativa.',
          imagenes: ['/imagenes/Artesanitas/Fotos/corazon_ceramica_para_pintar_1.jpeg']
        },
        {
          slug: 'taza-artesanal-con-salpicado',
          nombre: 'Taza artesanal con salpicado',
          precio: 52.00,
          sku: '1026',
          descripcion: 'Taza con estilo minimalista y cálido en tono crema con delicadas salpicaduras oscuras. Hecha a mano e ideal para el día a día.',
          imagenes: ['/imagenes/Artesanitas/Fotos/taza_artesanal_con_salpicado_1.jpeg']
        },
        {
          slug: 'set-de-2-tazas-personalizadas',
          nombre: 'Set de 2 tazas personalizadas',
          precio: 149.00,
          sku: '4127',
          descripcion: 'Un detalle único para compartir. Incluye 2 tazas personalizadas y 2 platitos a juego, aptas para bebidas calientes y microondas.',
          imagenes: ['/imagenes/Artesanitas/Fotos/set_de_2_tazas_personalizadas_1.jpeg']
        },
        {
          slug: 'taza-formula-1',
          nombre: 'Taza Fórmula 1',
          precio: 69.00,
          sku: '1028',
          descripcion: 'Para los amantes de la velocidad y los detalles únicos. Taza de cerámica artesanal de Fórmula 1 apta para bebidas calientes y microondas.',
          imagenes: ['/imagenes/Artesanitas/Fotos/taza_formula1_1.jpg']
        }
      ];

      for (const p of initialProducts) {
        await pool.query(
          `INSERT INTO negocio_productos (
            negocio_id, slug, nombre, precio, sku, stock_actual, stock_minimo,
            politica_sin_stock, linea, sublinea, sub_sublinea, coleccion,
            tipo_producto, descripcion, imagenes, activo
          ) VALUES ($1, $2, $3, $4, $5, 5, 1, 'compra_directa', 'Vajilla Artesanal', 'Tazas & Mugs', 'Cerámica Pintada a Mano', 'Catálogo General', 'Taza', $6, $7, TRUE)
          ON CONFLICT (negocio_id, slug) DO UPDATE SET activo = TRUE`,
          [artId, p.slug, p.nombre, p.precio, p.sku, p.descripcion, JSON.stringify(p.imagenes)]
        );
      }
      // Reactivar también en negocio_productos_estaticos por si estuvo pausada
      await pool.query(
        `DELETE FROM negocio_productos_estaticos WHERE negocio_id = $1 AND slug IN ('taza-formula-1', 'formula-1') AND activo = FALSE`,
        [artId]
      ).catch(() => {});

      // Limpiar emoticonos de títulos en almacén (solo permitidos en descripción)
      const { rows: allProdNames } = await pool.query(`SELECT id, nombre FROM negocio_productos WHERE negocio_id = $1`, [artId]);
      for (const pr of allProdNames) {
        const cleanNom = String(pr.nombre || '')
          .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F\u200D]/gu, '')
          .replace(/\s+/g, ' ')
          .trim();
        if (cleanNom && cleanNom !== pr.nombre) {
          await pool.query(`UPDATE negocio_productos SET nombre = $1 WHERE id = $2`, [cleanNom, pr.id]);
        }
      }
      await pool.query(
        `UPDATE negocio_productos
         SET vender_sin_stock = TRUE,
             fecha_entrega_estimada = COALESCE(fecha_entrega_estimada, '2026-12-10')
         WHERE negocio_id = $1 AND politica_sin_stock = 'preventa' AND vender_sin_stock = FALSE`,
        [artId]
      ).catch(() => {});
    }

    await syncFromOldDatabase();

    logger.info('Migraciones del Hub Marcas Aliadas LPS completadas con éxito.');
  } catch (err) {
    logger.error('Error en migraciones del Hub:', { error: err.message });
  }
}

if (require.main === module) {
  runMigrations().then(() => process.exit(0));
}

module.exports = { runMigrations };
