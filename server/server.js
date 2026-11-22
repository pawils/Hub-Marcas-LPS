// server/server.js — Servidor Principal del Hub Multi-Tenant Marcas Aliadas LPS
// Arquitectura 100% Modular: Cada marca está encapsulada en public/<marca>/ (con sus propios html, js e imagenes)
require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');

const { runMigrations } = require('./migrate');
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

// Resuelve todos los archivos (HTML, /js/..., /imagenes/..., /css/...) directamente desde public/<marca>/
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }
  const tenant = req.tenantSubdomain || extractSubdomainSlug(req) || DEFAULT_TENANT;
  const tenantDir = path.resolve(PUBLIC_DIR, tenant);
  if (!tenantDir.startsWith(PUBLIC_DIR + path.sep) || !fs.existsSync(tenantDir) || !fs.statSync(tenantDir).isDirectory()) {
    return next();
  }

  let reqPath = req.path === '/' ? '/index.html' : req.path;
  if (reqPath === `/${tenant}` || reqPath.startsWith(`/${tenant}/`)) {
    reqPath = reqPath.slice(tenant.length + 1) || '/index.html';
  }

  // Soportar URLs limpias sin .html (ej. /pedido, /seguimiento, /registros, /inscripcion)
  if (!path.extname(reqPath)) {
    const htmlCandidate = path.resolve(tenantDir, '.' + reqPath + '.html');
    if (htmlCandidate.startsWith(tenantDir) && fs.existsSync(htmlCandidate) && fs.statSync(htmlCandidate).isFile()) {
      return res.sendFile(htmlCandidate);
    }
  }

  const directCandidate = path.resolve(tenantDir, '.' + reqPath);
  if (directCandidate.startsWith(tenantDir) && fs.existsSync(directCandidate) && fs.statSync(directCandidate).isFile()) {
    const ext = path.extname(directCandidate).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp', '.svg', '.ico', '.gif', '.avif'].includes(ext)) {
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    }
    return res.sendFile(directCandidate);
  }
  next();
});

// Fallback estático por si se accede con ruta explícita /<marca>/...
app.use(
  express.static(PUBLIC_DIR, {
    extensions: ['html'],
    maxAge: '7d'
  })
);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Hub Marcas LPS] Servidor activo en puerto ${PORT} (Tenant por defecto: ${DEFAULT_TENANT})`);
  runMigrations().catch((err) => console.error('[Migrate Error]', err.message));
});

if (Number(PORT) !== 3000) {
  app.listen(3000, '0.0.0.0', () => {
    console.log('[Hub Marcas LPS] Escuchando también en puerto 3000 para Custom Domain de Railway');
  });
}
