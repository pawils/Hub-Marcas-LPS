// server/server.js — Servidor Principal del Hub Multi-Tenant Marcas Aliadas LPS
// Proyecto independiente en Railway (artesanitas.lospilares.pe y futuras marcas *.lospilares.pe)
require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');

const { runMigrations } = require('./migrate');
const { syncFromOldDatabase } = require('./sync-from-main-db');
const { negocioSubdomainMiddleware, extractSubdomainSlug } = require('./middleware/negocio-subdomain.middleware');
const negocioTalleresRoutes = require('./routes/negocio-talleres.routes');
const negocioProductosRoutes = require('./routes/negocio-productos.routes');
const negocioPedidosRoutes = require('./routes/negocio-pedidos.routes');
const artesanitasRoutes = require('./routes/artesanitas.routes');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const DEFAULT_TENANT = process.env.DEFAULT_TENANT_SLUG || 'artesanitas';

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
  res.json({ status: 'ok', service: 'hub-marcas-lps', timestamp: new Date().toISOString() });
});

// API Multi-Tenant (/api/negocios/:negocioSlug/...)
app.use('/api/negocios', negocioTalleresRoutes);
app.use('/api/negocios', negocioProductosRoutes);
app.use('/api/negocios', negocioPedidosRoutes);

// Redirecciones 301 de URLs históricas dentro del subdominio artesanitas.lospilares.pe
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
app.get(['/artesanitas-peru', '/artesanitas-peru.html'], (req, res) => {
  const q = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  res.redirect(301, '/' + q);
});

// Páginas Open Graph individuales de producto (/artesanitas/producto/:slug y /producto/:slug)
app.use('/artesanitas-peru', artesanitasRoutes);
app.use('/artesanitas', artesanitasRoutes);
app.use('/', artesanitasRoutes);

// Enrutador por subdominio (ej. artesanitas.lospilares.pe, latiendacafe.lospilares.pe)
app.use(negocioSubdomainMiddleware);

// Si se accede directamente al dominio Railway o a artesanitas.lospilares.pe en la raíz '/',
// sirve los archivos de la marca activa (por defecto: artesanitas)
app.use((req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/imagenes/') || req.path.startsWith('/js/vendor/')) {
    return next();
  }
  const tenant = req.tenantSubdomain || extractSubdomainSlug(req) || DEFAULT_TENANT;
  const candidateDirs = [
    path.join(PUBLIC_DIR, tenant),
    path.join(PUBLIC_DIR, 'aliados', tenant)
  ];
  const tenantDir = candidateDirs.find((d) => fs.existsSync(d) && fs.statSync(d).isDirectory());
  if (!tenantDir) return next();

  // Soportar URLs limpias como /pedido, /seguimiento, /registros, /inscripcion
  let reqPath = req.path === '/' ? '/index.html' : req.path;
  if (reqPath.startsWith(`/${tenant}/`)) {
    reqPath = reqPath.slice(tenant.length + 1) || '/index.html';
  }
  if (!path.extname(reqPath)) {
    const htmlCandidate = path.join(tenantDir, `${reqPath}.html`);
    if (fs.existsSync(htmlCandidate)) {
      return res.sendFile(htmlCandidate);
    }
  }
  const directCandidate = path.join(tenantDir, reqPath);
  if (directCandidate.startsWith(tenantDir) && fs.existsSync(directCandidate) && fs.statSync(directCandidate).isFile()) {
    return res.sendFile(directCandidate);
  }
  next();
});

// Archivos estáticos generales (/imagenes/Artesanitas/..., /js/vendor/..., /artesanitas/...)
app.use(
  express.static(PUBLIC_DIR, {
    extensions: ['html'],
    maxAge: '7d'
  })
);

// Escuchar de inmediato en el puerto para que Railway Proxy nunca devuelva 502 durante el arranque.
// Si Railway inyecta PORT=8080 pero el Custom Domain se configuró apuntando al puerto 3000,
// escuchamos en AMBOS puertos (8080 y 3000) simultáneamente para que siempre responda 200 OK.
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Hub Marcas LPS] Servidor activo en puerto ${PORT} (Tenant por defecto: ${DEFAULT_TENANT})`);
  runMigrations().catch((err) => console.error('[Migrate Error]', err.message));
  // Re-sincronizar reservas nuevas desde lospilares.pe cada 2 minutos mientras convivan ambos dominios
  setInterval(() => {
    syncFromOldDatabase().catch(() => {});
  }, 2 * 60 * 1000);
});

if (Number(PORT) !== 3000) {
  app.listen(3000, '0.0.0.0', () => {
    console.log('[Hub Marcas LPS] Escuchando también en puerto 3000 para Custom Domain de Railway');
  });
}
