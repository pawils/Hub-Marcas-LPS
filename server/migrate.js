// server/migrate.js — Migraciones autónomas del Hub Multi-Tenant Marcas Aliadas LPS
const pool = require('./db.config');
const bcrypt = require('bcryptjs');
const logger = require('./utils/logger');

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
        costo_artesano NUMERIC(10, 2) NOT NULL DEFAULT 0,
        sku VARCHAR(60),
        ean VARCHAR(30),
        stock_actual INTEGER NOT NULL DEFAULT 0,
        stock_minimo INTEGER NOT NULL DEFAULT 2,
        politica_sin_stock VARCHAR(20) NOT NULL DEFAULT 'preventa',
        linea VARCHAR(80) NOT NULL DEFAULT 'Hogar y Decoración',
        sublinea VARCHAR(80) NOT NULL DEFAULT 'Vajilla Artesanal',
        sub_sublinea VARCHAR(80) NOT NULL DEFAULT 'Tazas Escultóricas',
        coleccion VARCHAR(80) DEFAULT 'Colección General',
        tipo_producto VARCHAR(60) DEFAULT 'Cerámica Esmaltada',
        modelo VARCHAR(80),
        color VARCHAR(60),
        tamano_dimensiones VARCHAR(80),
        caracteristicas TEXT,
        descripcion TEXT,
        imagenes JSONB NOT NULL DEFAULT '[]'::jsonb,
        orden INTEGER NOT NULL DEFAULT 0,
        activo BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (negocio_id, slug)
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS negocio_producto_imagenes (
        id SERIAL PRIMARY KEY,
        producto_id INTEGER NOT NULL REFERENCES negocio_productos(id) ON DELETE CASCADE,
        orden INTEGER NOT NULL DEFAULT 0,
        mime_type VARCHAR(40) NOT NULL,
        data BYTEA NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS negocio_productos_estaticos (
        negocio_id INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
        slug VARCHAR(120) NOT NULL,
        activo BOOLEAN NOT NULL DEFAULT TRUE,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (negocio_id, slug)
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS negocio_pedidos (
        id SERIAL PRIMARY KEY,
        negocio_id INTEGER NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
        codigo_pedido VARCHAR(32) UNIQUE,
        producto_slug VARCHAR(120) NOT NULL,
        producto_nombre VARCHAR(200) NOT NULL,
        producto_precio NUMERIC(10, 2) NOT NULL,
        cantidad INTEGER NOT NULL DEFAULT 1,
        items JSONB NOT NULL DEFAULT '[]'::jsonb,
        modalidad_pago VARCHAR(20) NOT NULL DEFAULT 'reserva_20',
        monto_pagado NUMERIC(10, 2) NOT NULL DEFAULT 0,
        costo_envio NUMERIC(10, 2) NOT NULL DEFAULT 0,
        saldo_pendiente NUMERIC(10, 2) NOT NULL DEFAULT 0,
        estado_pago VARCHAR(20) NOT NULL DEFAULT 'pendiente',
        estado_pedido VARCHAR(30) NOT NULL DEFAULT 'reservado',
        tipo_entrega VARCHAR(30) NOT NULL DEFAULT 'shalom_agencia',
        empresa_envio VARCHAR(40) DEFAULT 'Shalom',
        guia_envio VARCHAR(60),
        mp_preference_id VARCHAR(120),
        mp_payment_id VARCHAR(80),
        mp_status VARCHAR(40),
        cliente_nombre VARCHAR(150) NOT NULL,
        cliente_dni VARCHAR(15) NOT NULL,
        cliente_whatsapp VARCHAR(25) NOT NULL,
        departamento VARCHAR(80),
        provincia VARCHAR(80),
        distrito VARCHAR(80),
        sede_shalom VARCHAR(200) NOT NULL,
        notas TEXT,
        origen VARCHAR(30) NOT NULL DEFAULT 'web',
        fecha_entrega DATE NOT NULL DEFAULT '2026-12-10',
        artesano_nombre VARCHAR(120),
        costo_artesano_total NUMERIC(10, 2) DEFAULT 0,
        fecha_encargo_artesano DATE,
        fecha_compromiso_artesano DATE,
        fecha_recepcion_taller DATE,
        fecha_despacho_courier DATE,
        fecha_entrega_final DATE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

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

    logger.info('Migraciones del Hub Marcas Aliadas LPS completadas con éxito.');
  } catch (err) {
    logger.error('Error en migraciones del Hub:', { error: err.message });
  }
}

if (require.main === module) {
  runMigrations().then(() => process.exit(0));
}

module.exports = { runMigrations };
