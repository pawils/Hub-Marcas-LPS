// server/routes/artesanitas.routes.js
// Páginas individuales de producto para Artesanitas Perú (/producto/:slug).
// Incluye meta tags Open Graph, compra directa 100% online o reserva preventa,
// y pantalla de respaldo con identidad de marca Artesanitas Perú · Los Pilares
// cuando un producto está pausado o no existe (evitando pantallas de error genéricas).

const express = require('express');
const router = express.Router();
const pool = require('../db.config');
const { getProductoPorSlug, urlWhatsapp } = require('../data/artesanitas-productos');

function escapeHtml(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

const RESERVA_SLUGS_EXACT = new Set([
    'taza-navidad-papa-noel',
    'taza-muneco-de-nieve',
    'taza-arbolito-chocolatosa',
    'taza-arbolito-rosa',
    'taza-rapunzel',
    'taza-stich',
    'taza-van-gogh',
    'taza-piston-cup',
    'azucarera-van-gogh',
    'vasito-van-gogh'
]);

function esProductoReserva(slug, _politica, coleccion) {
    if (!slug) return false;
    const s = String(slug).toLowerCase();
    const col = String(coleccion || '').toLowerCase();
    if (RESERVA_SLUGS_EXACT.has(s)) return true;
    if (s.startsWith('taza-rapunzel') || s.startsWith('taza-navidad')) return true;
    if (/navid|rapunzel|van\s*gogh/i.test(col)) return true;
    return false;
}

function renderProductoFallbackPage(res, slugRequested = '', statusCode = 404) {
    return res.status(statusCode).send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Artesanitas Perú · Hub Marcas Los Pilares</title>
  <link rel="icon" type="image/jpeg" href="/imagenes/Artesanitas/logo_artesanitas.peru.jpg">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@500;600;700&display=swap" rel="stylesheet">
  <script src="/js/vendor/tailwindcss.3.4.17.js"></script>
</head>
<body class="bg-[#F9F6F0] text-[#4A3C31] min-h-screen flex flex-col justify-between" style="font-family:'Inter',sans-serif;">
  <main class="flex-1 flex items-center justify-center px-6 py-12">
    <div class="max-w-md w-full bg-white rounded-3xl border border-[#EBE5DE] shadow-xl p-8 text-center space-y-6">
      <div class="relative mx-auto w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-[#B87352] to-[#D5C9BD] shadow-md">
        <img src="/imagenes/Artesanitas/logo_artesanitas.peru.jpg" alt="Artesanitas Perú"
          class="w-full h-full object-cover rounded-full border-2 border-white" />
      </div>

      <div class="space-y-2">
        <span class="inline-flex items-center gap-1.5 bg-[#B87352]/10 text-[#B87352] text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">
          Artesanitas Perú · Cerámica Hecha a Mano
        </span>
        <h1 class="text-2xl font-bold text-[#4A3C31]" style="font-family:'Playfair Display',serif;">
          Esta pieza artesanal está en actualización
        </h1>
        <p class="text-sm text-[#8C7A6B] leading-relaxed">
          ${slugRequested ? `La pieza <span class="font-mono font-semibold text-[#4A3C31]">${escapeHtml(slugRequested)}</span> no se encuentra disponible temporalmente o cambió de colección.` : 'La página o pieza que buscas no está disponible en este momento.'}
          Explora nuestro catálogo actualizado con todas las piezas disponibles.
        </p>
      </div>

      <div class="space-y-2.5 pt-2">
        <a href="/#catalogo"
          class="w-full bg-[#4A3C31] hover:bg-[#322821] text-white font-bold py-3.5 px-6 rounded-2xl text-sm transition-all shadow-md flex items-center justify-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          <span>Ver Catálogo de Artesanitas</span>
        </a>
        <a href="https://wa.me/51929938466?text=${encodeURIComponent('Hola Artesanitas! Buscaba información sobre la pieza: ' + (slugRequested || 'Catálogo'))}"
          target="_blank" rel="noreferrer"
          class="w-full bg-[#F9F6F0] hover:bg-[#EBE5DE] text-[#4A3C31] border border-[#D5C9BD] font-semibold py-3 px-6 rounded-2xl text-xs transition-colors flex items-center justify-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4 text-[#B87352]"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
          <span>Consultar con el Taller por WhatsApp</span>
        </a>
      </div>

      <div class="pt-4 border-t border-[#EBE5DE] flex items-center justify-center gap-2 text-[11px] text-[#8C7A6B]">
        <span>Respaldado por</span>
        <strong class="text-[#4A3C31] font-semibold">Los Pilares · Hub de Marcas Aliadas</strong>
      </div>
    </div>
  </main>
</body>
</html>`);
}

async function buscarProductoPorSlug(slug) {
    const cleanSlug = String(slug || '').trim().toLowerCase();
    try {
        const { rows } = await pool.query(
            `SELECT p.slug, p.nombre, p.precio, p.precio_oferta, p.etiqueta_promo, p.sku, p.ean,
                    p.stock_actual, p.politica_sin_stock, p.linea, p.sublinea, p.coleccion,
                    p.tamano_dimensiones, p.color, p.caracteristicas, p.descripcion, p.imagenes
             FROM negocio_productos p
             JOIN negocios n ON n.id = p.negocio_id
             WHERE n.slug = 'artesanitas' AND LOWER(p.slug) = $1 AND p.activo = TRUE`,
            [cleanSlug]
        );
        if (rows.length > 0) {
            const p = rows[0];
            const hasPromo = p.precio_oferta && Number(p.precio_oferta) > 0 && Number(p.precio_oferta) < Number(p.precio);
            const fallbackStatic = getProductoPorSlug(cleanSlug);
            const imgs = (Array.isArray(p.imagenes) && p.imagenes.length > 0)
                ? p.imagenes
                : ((fallbackStatic && fallbackStatic.imagenes) || ['/imagenes/Artesanitas/logo_artesanitas.peru.jpg']);
            return {
                slug: p.slug,
                nombre: p.nombre,
                precio: hasPromo ? Number(p.precio_oferta) : Number(p.precio),
                precio_regular: Number(p.precio),
                has_promo: hasPromo,
                etiqueta_promo: p.etiqueta_promo || '',
                sku: p.sku || '1001',
                ean: p.ean || '',
                stock_actual: Number(p.stock_actual || 0),
                politica_sin_stock: p.politica_sin_stock || 'compra_directa',
                coleccion: p.coleccion || 'Catálogo Artesanitas',
                detalles: [
                    p.tamano_dimensiones ? `Medidas / Capacidad: ${p.tamano_dimensiones}` : null,
                    p.color ? `Color: ${p.color}` : null,
                    p.caracteristicas ? `${p.caracteristicas}` : null
                ].filter(Boolean),
                descripcion: p.descripcion || (fallbackStatic && fallbackStatic.descripcion) || '',
                imagenes: imgs
            };
        }

        const { rows: pausado } = await pool.query(
            `SELECT e.activo FROM negocio_productos_estaticos e
             JOIN negocios n ON n.id = e.negocio_id
             WHERE n.slug = 'artesanitas' AND LOWER(e.slug) = $1`,
            [cleanSlug]
        );
        if (pausado.length > 0 && !pausado[0].activo && cleanSlug !== 'taza-formula-1') {
            return null;
        }
    } catch (error) {
        // Si la BD demora o falla, cae de forma segura al catálogo en memoria
    }
    return getProductoPorSlug(cleanSlug);
}

// GET /producto/:slug (Shopify-Grade Product Detail Page con Carrito Persistente y Compra Directa)
router.get('/producto/:slug', async (req, res) => {
    try {
        const producto = await buscarProductoPorSlug(req.params.slug);
        if (!producto) {
            return renderProductoFallbackPage(res, req.params.slug, 404);
        }

        const esReserva = esProductoReserva(producto.slug, producto.politica_sin_stock, producto.coleccion);
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
                onerror="this.onerror=null;this.src='/imagenes/Artesanitas/logo_artesanitas.peru.jpg';"
                class="w-full h-full object-cover ${i === 0 ? '' : 'hidden'} product-img" data-idx="${i}" />`)
            .join('');

        const dots = (producto.imagenes && producto.imagenes.length > 1)
            ? `<div class="flex justify-center gap-2 mt-4">${producto.imagenes
                .map((_, i) => `<button class="w-2.5 h-2.5 rounded-full ${i === 0 ? 'bg-[#B87352]' : 'bg-[#D5C9BD]'} product-dot cursor-pointer" data-idx="${i}"></button>`)
                .join('')}</div>`
            : '';

        const prodJsonSafe = JSON.stringify({
            slug: producto.slug,
            sku: producto.sku || '1001',
            nombre: producto.nombre,
            precio: Number(producto.precio),
            reserva: esReserva ? 20.00 : Number(producto.precio),
            modalidad: esReserva ? 'reserva' : 'compra_directa',
            imagen: mainImage
        }).replace(/</g, '\\u003c');

        return res.send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(producto.descripcion)}">
  <link rel="canonical" href="${pageUrl}">
  <link rel="icon" type="image/jpeg" href="/imagenes/Artesanitas/logo_artesanitas.peru.jpg">
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
      <a href="${esReserva ? '/pedido' : '/checkout'}" class="text-xs font-bold text-white bg-[#333c48] hover:bg-[#1e242b] px-3.5 py-1.5 rounded-full transition-colors">
        ${esReserva ? 'Ir a Mi Reserva' : 'Ver Carro / Checkout'}
      </a>
    </div>

    <div class="relative aspect-[4/5] rounded-3xl overflow-hidden bg-[#EBE5DE] shadow-sm">
      ${galeria}
      <div class="absolute top-3 left-3 flex flex-col gap-1.5">
        ${producto.etiqueta_promo ? `<span class="bg-[#008f6b] text-white text-[10px] font-bold uppercase px-2.5 py-1 rounded-full shadow">${escapeHtml(producto.etiqueta_promo)}</span>` : ''}
        ${producto.stock_actual > 0
            ? `<span class="bg-white/90 text-[#008f6b] text-[10px] font-bold px-2.5 py-1 rounded-full shadow">En Stock (${producto.stock_actual} disponibles)</span>`
            : (agotado
                ? `<span class="bg-red-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow">Agotado</span>`
                : (esReserva ? `<span class="bg-white/90 text-[#4A3C31] text-[10px] font-semibold px-2.5 py-1 rounded-full shadow">A pedido · Preventa S/ 20</span>` : `<span class="bg-white/90 text-[#007A78] text-[10px] font-bold px-2.5 py-1 rounded-full shadow">Compra Directa · Envío Inmediato</span>`))}
      </div>
    </div>
    ${dots}

    <div class="mt-6 space-y-3">
      ${producto.sku ? `<div class="text-[11px] font-mono font-bold text-[#8C7A6B]">SKU: ${escapeHtml(producto.sku)}${producto.ean ? ' · EAN: ' + escapeHtml(producto.ean) : ''}</div>` : ''}
      <h1 class="text-2xl font-bold" style="font-family:'Playfair Display',serif;">${escapeHtml(producto.nombre)}</h1>
      <div class="flex flex-wrap items-baseline gap-2">
        <p class="text-2xl font-bold text-[#B87352]">${precioTexto}</p>
        ${producto.has_promo ? `<span class="text-sm line-through text-[#8C7A6B]">S/ ${Number(producto.precio_regular).toFixed(2)}</span>` : ''}
        ${esReserva
            ? `<span class="text-xs font-semibold text-[#007A78] bg-[#007A78]/10 px-2.5 py-0.5 rounded-full">Reserva con S/ 20.00</span>`
            : `<span class="text-xs font-semibold text-[#007A78] bg-[#007A78]/10 px-2.5 py-0.5 rounded-full">Compra Directa 100% Online</span>`}
      </div>
      <p class="text-[#8C7A6B] text-sm leading-relaxed whitespace-pre-line">${escapeHtml(producto.descripcion)}</p>
      ${Array.isArray(producto.detalles) && producto.detalles.length
            ? `<div class="bg-[#EBE5DE] rounded-xl px-4 py-3 space-y-1.5">${producto.detalles.map((d) => `<p class="flex items-center gap-2 text-xs sm:text-sm text-[#4A3C31]">${escapeHtml(d)}</p>`).join('')}</div>`
            : ''}
    </div>

    <div class="mt-8 space-y-3">
      ${agotado ? '' : `
      <button type="button" id="btn-pdp-add-cart"
        class="w-full bg-[#333c48] hover:bg-[#1e242b] text-white py-3.5 rounded-full flex items-center justify-center gap-2 font-bold transition-all shadow-md cursor-pointer">
        <span class="flex items-center justify-center gap-2"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg> ${esReserva ? '+ Agregar a mi reserva' : 'Agregar al Carro'}</span>
      </button>
      <a href="${esReserva ? `/pedido?producto=${encodeURIComponent(producto.slug)}` : `/checkout?producto=${encodeURIComponent(producto.slug)}`}"
        class="w-full bg-[#B87352] text-white py-3.5 rounded-full flex items-center justify-center gap-2 font-semibold hover:bg-[#A36244] transition-all shadow-md">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5">
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <path d="M16 10a4 4 0 0 1-8 0"></path>
        </svg>
        ${esReserva ? 'Reservar Ahora (S/ 20 por Plin)' : `Ir a Pagar (${precioTexto})`}
      </a>
      `}
      <a href="${urlWhatsapp(producto)}" target="_blank" rel="noreferrer"
        class="w-full bg-white text-[#4A3C31] border border-[#D5C9BD] py-3.5 rounded-xl flex items-center justify-center gap-2 font-medium hover:bg-[#F9F6F0] transition-colors shadow-2xs">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4 text-[#B87352]"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
        Consultar duda por WhatsApp
      </a>
    </div>
  </div>

  <script>
    (function () {
      var prod = ${prodJsonSafe};
      var esRes = ${esReserva ? 'true' : 'false'};
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
              cart.push({
                slug: prod.slug,
                sku: prod.sku || '1001',
                nombre: prod.nombre,
                precio: prod.precio,
                reserva: esRes ? 20 : prod.precio,
                modalidad: esRes ? 'reserva' : 'compra_directa',
                cantidad: 1,
                imagen: prod.imagen
              });
            }
            localStorage.setItem(key, JSON.stringify(cart));
            btnAdd.innerHTML = '<span class="flex items-center justify-center gap-2"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-4 h-4"><polyline points="20 6 9 17 4 12"/></svg> ¡Agregado a tu Carro!</span>';
            btnAdd.classList.replace('bg-[#333c48]', 'bg-[#137333]');
            setTimeout(function () { window.location.href = esRes ? '/pedido' : '/checkout'; }, 600);
          } catch (e) {
            window.location.href = (esRes ? '/pedido?producto=' : '/checkout?producto=') + encodeURIComponent(prod.slug);
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
    } catch (err) {
        return renderProductoFallbackPage(res, req.params.slug, 200);
    }
});

module.exports = router;
module.exports.renderProductoFallbackPage = renderProductoFallbackPage;
