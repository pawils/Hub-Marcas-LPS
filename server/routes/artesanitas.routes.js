// server/routes/artesanitas.routes.js
// Páginas individuales de producto para Artesanitas Perú.
// Objetivo: que cada producto tenga su propio link (ej. /artesanitas-peru/producto/taza-stich)
// con meta tags Open Graph propias, para que al compartirse en redes sociales / WhatsApp
// se vea la foto y el nombre de ESE producto (no el preview genérico del catálogo).
//
// El catálogo (public/artesanitas-peru.html) se renderiza dinámico desde
// negocio_productos (ver server/routes/negocio-productos.routes.js); esta
// ruta primero busca ahí (productos nuevos, cargados desde el panel) y si no
// encuentra cae al archivo estático (productos viejos, cargados a mano antes
// de que existiera el panel) -- así los links ya compartidos no se rompen.

const express = require('express');
const router = express.Router();
const pool = require('../db.config');
const { getProductoPorSlug, urlWhatsapp } = require('../data/artesanitas-productos');

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

async function buscarProductoPorSlug(slug) {
    try {
        const { rows } = await pool.query(
            `SELECT p.slug, p.nombre, p.precio, p.descripcion, p.imagenes
             FROM negocio_productos p
             JOIN negocios n ON n.id = p.negocio_id
             WHERE n.slug = 'artesanitas' AND p.slug = $1 AND p.activo = TRUE`,
            [slug]
        );
        if (rows.length > 0) {
            const p = rows[0];
            return { slug: p.slug, nombre: p.nombre, precio: Number(p.precio), descripcion: p.descripcion || '', imagenes: p.imagenes || [] };
        }

        // Si es un producto "de código" (catálogo estático) pausado desde el
        // panel, no debe verse aunque siga presente en el archivo estático.
        const { rows: pausado } = await pool.query(
            `SELECT e.activo FROM negocio_productos_estaticos e
             JOIN negocios n ON n.id = e.negocio_id
             WHERE n.slug = 'artesanitas' AND e.slug = $1`,
            [slug]
        );
        if (pausado.length > 0 && !pausado[0].activo) {
            return null;
        }
    } catch (error) {
        // Si la BD no responde, no debe tumbar la página -- solo cae al archivo estático.
    }
    return getProductoPorSlug(slug);
}

// GET /artesanitas-peru/producto/:slug
router.get('/producto/:slug', async (req, res, next) => {
    const producto = await buscarProductoPorSlug(req.params.slug);
    if (!producto) return next(); // 404 estándar si el slug no existe

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const pageUrl = `${baseUrl}/artesanitas-peru/producto/${producto.slug}`;
    const imageUrl = `${baseUrl}${producto.imagenes[0]}`;
    const precioTexto = `S/ ${producto.precio.toFixed(2)}`;
    const title = `${producto.nombre} - Artesanitas Perú`;

    const galeria = producto.imagenes
        .map((src, i) => `
          <img src="${escapeHtml(src)}" alt="${escapeHtml(producto.nombre)}"
            class="w-full ${i === 0 ? '' : 'hidden'} product-img" data-idx="${i}" />`)
        .join('');

    const dots = producto.imagenes.length > 1
        ? `<div class="flex justify-center gap-2 mt-4">${producto.imagenes
            .map((_, i) => `<button class="w-2.5 h-2.5 rounded-full ${i === 0 ? 'bg-[#B87352]' : 'bg-[#D5C9BD]'} product-dot" data-idx="${i}"></button>`)
            .join('')}</div>`
        : '';

    res.send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(producto.descripcion)}">
  <link rel="canonical" href="${pageUrl}">

  <!-- Open Graph: vista previa al compartir en WhatsApp / Instagram / Facebook -->
  <meta property="og:type" content="product">
  <meta property="og:title" content="${escapeHtml(producto.nombre)}">
  <meta property="og:description" content="${escapeHtml(producto.descripcion)} Precio: ${precioTexto}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:site_name" content="Artesanitas Perú">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(producto.nombre)}">
  <meta name="twitter:description" content="${escapeHtml(producto.descripcion)}">
  <meta name="twitter:image" content="${imageUrl}">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Playfair+Display:wght@500;600&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-[#F9F6F0] text-[#4A3C31]" style="font-family:'Inter',sans-serif;">
  <div class="max-w-md mx-auto min-h-screen flex flex-col px-6 py-10">
    <a href="/artesanitas-peru#catalogo" class="text-sm text-[#8C7A6B] hover:text-[#B87352] transition-colors mb-6 inline-flex items-center gap-1.5">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><polyline points="15 18 9 12 15 6"/></svg>
      Ver catálogo completo
    </a>

    <div class="relative aspect-[4/5] rounded-3xl overflow-hidden bg-[#EBE5DE] shadow-sm">
      ${galeria}
    </div>
    ${dots}

    <div class="mt-8 space-y-3">
      <h1 class="text-2xl" style="font-family:'Playfair Display',serif;">${escapeHtml(producto.nombre)}</h1>
      <p class="text-2xl font-bold text-[#B87352]">${precioTexto}</p>
      <p class="text-[#8C7A6B] leading-relaxed whitespace-pre-line">${escapeHtml(producto.descripcion)}</p>
      ${Array.isArray(producto.detalles) && producto.detalles.length
            ? `<div class="bg-[#EBE5DE] rounded-xl px-4 py-3 space-y-1.5">${producto.detalles.map((d) => `<p class="flex items-center gap-2 text-sm text-[#4A3C31]">${escapeHtml(d)}</p>`).join('')}</div>`
            : ''}
    </div>

    ${['taza-navidad-papa-noel', 'taza-muneco-de-nieve', 'taza-arbolito-chocolatosa', 'taza-arbolito-rosa', 'taza-van-gogh', 'taza-piston-cup', 'taza-rapunzel', 'taza-rapunzel-sin-plato', 'taza-rapunzel-lineas', 'taza-rapunzel-con-plato', 'taza-rapunzel-palo-rosa', 'taza-rapunzel-moradito'].includes(producto.slug) ? `
    <div class="mt-8 space-y-3">
      <a href="/artesanitas/pedido?producto=${producto.slug}"
        class="w-full bg-[#B87352] text-white py-4 rounded-xl flex items-center justify-center gap-2 font-semibold hover:bg-[#A36244] transition-all shadow-md">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5">
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <path d="M16 10a4 4 0 0 1-8 0"></path>
        </svg>
        Reservar en Preventa (S/ 20)
      </a>
      <a href="${urlWhatsapp(producto)}" target="_blank" rel="noreferrer"
        class="w-full bg-white text-[#4A3C31] border border-[#D5C9BD] py-3.5 rounded-xl flex items-center justify-center gap-2 font-medium hover:bg-[#F9F6F0] transition-colors shadow-2xs">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4 text-[#B87352]"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
        Consultar por WhatsApp
      </a>
    </div>
    ` : `
    <a href="${urlWhatsapp(producto)}" target="_blank" rel="noreferrer"
      class="mt-8 bg-[#4A3C31] text-white py-4 rounded-xl flex items-center justify-center gap-2 font-medium hover:bg-[#322821] transition-colors shadow-md">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
      Comprar por WhatsApp
    </a>
    `}
  </div>

  <script>
    (function () {
      var imgs = document.querySelectorAll('.product-img');
      var dots = document.querySelectorAll('.product-dot');
      if (imgs.length < 2) return;
      dots.forEach(function (dot) {
        dot.addEventListener('click', function () {
          var idx = dot.dataset.idx;
          imgs.forEach(function (img) { img.classList.toggle('hidden', img.dataset.idx !== idx); });
          dots.forEach(function (d) { d.classList.toggle('bg-[#B87352]', d === dot); d.classList.toggle('bg-[#D5C9BD]', d !== dot); });
        });
      });
    })();
  </script>
</body>
</html>`);
});

module.exports = router;
