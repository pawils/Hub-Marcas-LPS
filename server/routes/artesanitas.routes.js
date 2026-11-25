// server/routes/artesanitas.routes.js
// Páginas individuales de producto para Artesanitas Perú.
// Objetivo: que cada producto tenga su propio link (ej. /producto/taza-stich)
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
            `SELECT p.slug, p.nombre, p.precio, p.precio_oferta, p.etiqueta_promo, p.sku, p.ean,
                    p.stock_actual, p.politica_sin_stock, p.linea, p.sublinea, p.coleccion,
                    p.tamano_dimensiones, p.color, p.caracteristicas, p.descripcion, p.imagenes
             FROM negocio_productos p
             JOIN negocios n ON n.id = p.negocio_id
             WHERE n.slug = 'artesanitas' AND p.slug = $1 AND p.activo = TRUE`,
            [slug]
        );
        if (rows.length > 0) {
            const p = rows[0];
            const hasPromo = p.precio_oferta && Number(p.precio_oferta) > 0 && Number(p.precio_oferta) < Number(p.precio);
            return {
                slug: p.slug,
                nombre: p.nombre,
                precio: hasPromo ? Number(p.precio_oferta) : Number(p.precio),
                precio_regular: Number(p.precio),
                has_promo: hasPromo,
                etiqueta_promo: p.etiqueta_promo || '',
                sku: p.sku || '',
                ean: p.ean || '',
                stock_actual: Number(p.stock_actual || 0),
                politica_sin_stock: p.politica_sin_stock || 'preventa',
                coleccion: p.coleccion || 'Catálogo Artesanitas',
                detalles: [
                    p.tamano_dimensiones ? `Medidas / Capacidad: ${p.tamano_dimensiones}` : null,
                    p.color ? `Color: ${p.color}` : null,
                    p.caracteristicas ? `${p.caracteristicas}` : null
                ].filter(Boolean),
                descripcion: p.descripcion || '',
                imagenes: p.imagenes || []
            };
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

// GET /producto/:slug (Shopify-Grade Product Detail Page con Carrito Persistente y Reserva Directa)
router.get('/producto/:slug', async (req, res, next) => {
    const producto = await buscarProductoPorSlug(req.params.slug);
    if (!producto) return next();

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const pageUrl = `${baseUrl}/producto/${producto.slug}`;
    const mainImage = (Array.isArray(producto.imagenes) && producto.imagenes[0]) || '/imagenes/Artesanitas/logo_artesanitas.peru.jpg';
    const imageUrl = mainImage.startsWith('http') ? mainImage : `${baseUrl}${mainImage}`;
    const precioTexto = `S/ ${Number(producto.precio).toFixed(2)}`;
    const title = `${producto.nombre} - Artesanitas Perú`;
    const agotado = producto.stock_actual !== undefined && Number(producto.stock_actual) <= 0 && producto.politica_sin_stock === 'agotado';

    const galeria = (producto.imagenes && producto.imagenes.length ? producto.imagenes : [mainImage])
        .map((src, i) => `
          <img src="${escapeHtml(src)}" alt="${escapeHtml(producto.nombre)}"
            class="w-full h-full object-cover ${i === 0 ? '' : 'hidden'} product-img" data-idx="${i}" />`)
        .join('');

    const dots = (producto.imagenes && producto.imagenes.length > 1)
        ? `<div class="flex justify-center gap-2 mt-4">${producto.imagenes
            .map((_, i) => `<button class="w-2.5 h-2.5 rounded-full ${i === 0 ? 'bg-[#B87352]' : 'bg-[#D5C9BD]'} product-dot cursor-pointer" data-idx="${i}"></button>`)
            .join('')}</div>`
        : '';

    const prodJsonSafe = JSON.stringify({
        slug: producto.slug,
        nombre: producto.nombre,
        precio: Number(producto.precio),
        reserva: 20.00,
        imagen: mainImage
    }).replace(/</g, '\\u003c');

    res.send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(producto.descripcion)}">
  <link rel="canonical" href="${pageUrl}">
  <link rel="manifest" href="/manifest.json">

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
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@500;600;700&display=swap" rel="stylesheet">
  <script src="/js/vendor/tailwindcss.3.4.17.js"></script>
</head>
<body class="bg-[#F9F6F0] text-[#4A3C31]" style="font-family:'Inter',sans-serif;">
  <div class="max-w-md mx-auto min-h-screen flex flex-col px-6 py-8">
    <div class="flex items-center justify-between mb-6">
      <a href="/#catalogo" class="text-sm font-medium text-[#8C7A6B] hover:text-[#B87352] transition-colors inline-flex items-center gap-1.5">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><polyline points="15 18 9 12 15 6"/></svg>
        Ver catálogo completo
      </a>
      ${esReserva ? `<a href="/pedido" class="text-xs font-bold text-[#B87352] bg-[#B87352]/10 px-3 py-1.5 rounded-full">Ir a Mi Reserva</a>` : ''}
    </div>

    <div class="relative aspect-[4/5] rounded-3xl overflow-hidden bg-[#EBE5DE] shadow-sm">
      ${galeria}
      <div class="absolute top-3 left-3 flex flex-col gap-1.5">
        ${producto.etiqueta_promo ? `<span class="bg-[#008f6b] text-white text-[10px] font-bold uppercase px-2.5 py-1 rounded-full shadow">${escapeHtml(producto.etiqueta_promo)}</span>` : ''}
        ${producto.stock_actual > 0
            ? `<span class="bg-white/90 text-[#008f6b] text-[10px] font-bold px-2.5 py-1 rounded-full shadow">En Stock (${producto.stock_actual} disponibles)</span>`
            : (agotado
                ? `<span class="bg-red-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow">Agotado</span>`
                : (esReserva ? `<span class="bg-white/90 text-[#4A3C31] text-[10px] font-semibold px-2.5 py-1 rounded-full shadow">A pedido · Preventa S/ 20</span>` : ''))}
      </div>
    </div>
    ${dots}

    <div class="mt-6 space-y-3">
      ${producto.sku ? `<div class="text-[11px] font-mono text-[#8C7A6B]">SKU: ${escapeHtml(producto.sku)}${producto.ean ? ' · EAN: ' + escapeHtml(producto.ean) : ''}</div>` : ''}
      <h1 class="text-2xl font-bold" style="font-family:'Playfair Display',serif;">${escapeHtml(producto.nombre)}</h1>
      <div class="flex items-baseline gap-2">
        <p class="text-2xl font-bold text-[#B87352]">${precioTexto}</p>
        ${producto.has_promo ? `<span class="text-sm line-through text-[#8C7A6B]">S/ ${Number(producto.precio_regular).toFixed(2)}</span>` : ''}
        ${esReserva ? `<span class="text-xs font-semibold text-[#007A78] bg-[#007A78]/10 px-2.5 py-0.5 rounded-full">Reserva con S/ 20.00</span>` : ''}
      </div>
      <p class="text-[#8C7A6B] text-sm leading-relaxed whitespace-pre-line">${escapeHtml(producto.descripcion)}</p>
      ${Array.isArray(producto.detalles) && producto.detalles.length
            ? `<div class="bg-[#EBE5DE] rounded-xl px-4 py-3 space-y-1.5">${producto.detalles.map((d) => `<p class="flex items-center gap-2 text-xs sm:text-sm text-[#4A3C31]">${escapeHtml(d)}</p>`).join('')}</div>`
            : ''}
    </div>

    <div class="mt-8 space-y-3">
      ${(agotado || !esReserva) ? '' : `
      <button type="button" id="btn-pdp-add-cart"
        class="w-full bg-[#4A3C31] hover:bg-[#322821] text-white py-3.5 rounded-xl flex items-center justify-center gap-2 font-bold transition-all shadow-md cursor-pointer">
        <span class="flex items-center justify-center gap-2"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg> + Agregar a mi reserva</span>
      </button>
      <a href="/pedido?producto=${encodeURIComponent(producto.slug)}"
        class="w-full bg-[#B87352] text-white py-4 rounded-xl flex items-center justify-center gap-2 font-semibold hover:bg-[#A36244] transition-all shadow-md">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5">
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <path d="M16 10a4 4 0 0 1-8 0"></path>
        </svg>
        Reservar Ahora (S/ 20 por Plin)
      </a>
      `}
      <a href="${urlWhatsapp(producto)}" target="_blank" rel="noreferrer"
        class="w-full bg-white text-[#4A3C31] border border-[#D5C9BD] py-3.5 rounded-xl flex items-center justify-center gap-2 font-medium hover:bg-[#F9F6F0] transition-colors shadow-2xs">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4 text-[#B87352]"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
        Consultar por WhatsApp
      </a>
    </div>
  </div>

  <script>
    (function () {
      var prod = ${prodJsonSafe};
      var btnAdd = document.getElementById('btn-pdp-add-cart');
      if (btnAdd) {
        btnAdd.addEventListener('click', function () {
          try {
            var key = 'artesanitas_cart_v1';
            var raw = localStorage.getItem(key);
            var cart = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(cart)) cart = [];
            var idx = cart.findIndex(function (i) { return i && i.slug === prod.slug; });
            if (idx > -1) {
              cart[idx].cantidad = Math.min(50, (Number(cart[idx].cantidad) || 1) + 1);
            } else {
              cart.push({ slug: prod.slug, nombre: prod.nombre, precio: prod.precio, reserva: 20, cantidad: 1, imagen: prod.imagen });
            }
            localStorage.setItem(key, JSON.stringify(cart));
            btnAdd.innerHTML = '<span class="flex items-center justify-center gap-2"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-4 h-4"><polyline points="20 6 9 17 4 12"/></svg> ¡Agregado! Redirigiendo a tu reserva...</span>';
            btnAdd.classList.replace('bg-[#4A3C31]', 'bg-[#007A78]');
            setTimeout(function () { window.location.href = '/pedido'; }, 700);
          } catch (e) {
            window.location.href = '/pedido?producto=' + encodeURIComponent(prod.slug);
          }
        });
      }
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
