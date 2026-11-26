// server/server.js — Servidor Dedicado de Artesanitas Perú (artesanitas.lospilares.pe)
// Proyecto 100% Independiente dentro de Hub Marcas LPS/Artesanitas
require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');

const { runMigrations } = require('./migrate');
const negocioTalleresRoutes = require('./routes/negocio-talleres.routes');
const negocioProductosRoutes = require('./routes/negocio-productos.routes');
const negocioPedidosRoutes = require('./routes/negocio-pedidos.routes');
const artesanitasRoutes = require('./routes/artesanitas.routes');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');

app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  })
);
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Healthcheck para Railway
app.get(['/api/health', '/health'], (req, res) => {
  res.json({ status: 'ok', service: 'artesanitas-lps', timestamp: new Date().toISOString() });
});

// API (/api/negocios/artesanitas/...)
app.use('/api/negocios', negocioTalleresRoutes);
app.use('/api/negocios', negocioProductosRoutes);
app.use('/api/negocios', negocioPedidosRoutes);

// Redirecciones 301 de URLs históricas hacia rutas limpias en la raíz
app.get(['/artesanitas-registros', '/artesanitas-registros.html', '/artesanitas/registros'], (req, res) => {
  const q = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  res.redirect(301, '/registros' + q);
});
app.get(['/artesanitas-pedido', '/artesanitas-pedido.html', '/artesanitas/pedido'], (req, res) => {
  const q = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  res.redirect(301, '/pedido' + q);
});
app.get(['/artesanitas-seguimiento', '/artesanitas-seguimiento.html', '/artesanitas/seguimiento'], (req, res) => {
  const q = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  res.redirect(301, '/seguimiento' + q);
});
app.get(['/artesanitas-inscripcion', '/artesanitas-inscripcion.html', '/artesanitas/inscripcion'], (req, res) => {
  const q = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  res.redirect(301, '/inscripcion' + q);
});
app.get(['/artesanitas-peru', '/artesanitas-peru.html', '/artesanitas'], (req, res) => {
  const q = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  res.redirect(301, '/' + q);
});

// Páginas Open Graph individuales de producto (/producto/:slug y /artesanitas/producto/:slug)
app.use('/artesanitas-peru', artesanitasRoutes);
app.use('/artesanitas', artesanitasRoutes);
app.use('/', artesanitasRoutes);

// Compatibilidad transparente si algún HTML pide /artesanitas/js/... o /artesanitas/imagenes/...
app.use('/artesanitas', express.static(PUBLIC_DIR, { extensions: ['html'], maxAge: '7d' }));

// Archivos estáticos principales en la raíz (/, /pedido, /seguimiento, /registros, /inscripcion, /imagenes/..., /js/...)
app.use(
  express.static(PUBLIC_DIR, {
    extensions: ['html'],
    maxAge: '7d'
  })
);

// Catch-all 404 con identidad de marca Artesanitas Perú · Los Pilares (evita pantallas genéricas)
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, message: 'Endpoint no encontrado.' });
  }
  if (typeof artesanitasRoutes.renderProductoFallbackPage === 'function') {
    const cleanRef = req.path.replace(/^\/+(producto\/)?/, '');
    return artesanitasRoutes.renderProductoFallbackPage(res, cleanRef, 404);
  }
  return res.redirect('/');
});

// Middleware global 500 anti-caídas para que nunca aparezca la pantalla de Railway al usuario
app.use((err, req, res, _next) => {
  console.error('[Server Error]', err && err.message ? err.message : err);
  if (req.path.startsWith('/api/')) {
    return res.status(500).json({ success: false, message: 'Ocurrió un error procesando la solicitud.' });
  }
  if (typeof artesanitasRoutes.renderProductoFallbackPage === 'function') {
    return artesanitasRoutes.renderProductoFallbackPage(res, '', 200);
  }
  return res.redirect('/');
});

// Protección de proceso Node 20+ para evitar que promesas rechazadas tumben el contenedor en Railway
process.on('unhandledRejection', (reason) => {
  console.error('[UnhandledRejection Intercepted]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[UncaughtException Intercepted]', err && err.message ? err.message : err);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Artesanitas LPS] Servidor activo en puerto ${PORT}`);
  runMigrations().catch((err) => console.error('[Migrate Error]', err.message));
});

if (Number(PORT) !== 3000) {
  app.listen(3000, '0.0.0.0', () => {
    console.log('[Artesanitas LPS] Escuchando también en puerto 3000 para Custom Domain de Railway');
  });
}
