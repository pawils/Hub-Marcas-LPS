/* exported copyProductoLink, shareProducto, toggleMenu */
// public/artesanitas/js/catalogo.js
// Lógica modular del catálogo, sliders y render dinámico de Artesanitas

// Copia solo la URL del producto (sin texto) — ideal para pegar en Stories/bio de
// Instagram, donde el sticker de link necesita una URL limpia, sin caption al inicio.
function copyProductoLink(path) {
  var url = window.location.origin + path;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(showShareToast).catch(function () {
      window.open(url, '_blank');
    });
    return;
  }
  window.open(url, '_blank');
}

// Comparte o copia el link de un producto (Estándar E-Commerce 2026: 1 solo botón inteligente)
// En móvil abre el share sheet nativo y en desktop copia el link limpio al portapapeles con confirmación visual.
function shareProducto(path, nombre) {
  var url = window.location.origin + path;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(function () {
      showShareToast('Enlace del producto copiado al portapapeles');
    }).catch(function () {});
  }
  if (navigator.share && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent || '')) {
    navigator.share({ title: nombre, text: 'Mira esta pieza de Artesanitas Perú: ' + nombre, url: url }).catch(function () { });
    return;
  }
  if (!navigator.clipboard) {
    window.open(url, '_blank');
  }
}

function showShareToast(customText) {
  var toast = document.getElementById('share-toast');
  if (!toast) return;
  var toastTxt = document.getElementById('share-toast-text');
  if (toastTxt) {
    toastTxt.textContent = typeof customText === 'string' && customText ? customText : 'Link copiado al portapapeles';
  }
  toast.classList.remove('opacity-0', 'pointer-events-none');
  toast.classList.add('opacity-100');
  clearTimeout(toast._hideTimeout);
  toast._hideTimeout = setTimeout(function () {
    toast.classList.add('opacity-0', 'pointer-events-none');
    toast.classList.remove('opacity-100');
  }, 2200);
}

// Evento de conversión "Contacto" — solo al Pixel propio de Artesanitas
document.addEventListener('click', function (e) {
  var link = e.target.closest('a[href*="wa.me/51929938466"]');
  if (!link || typeof fbq === 'undefined') return;
  fbq('trackSingle', '851775257895823', 'Contact');
});

// Hero Slider (banner rotativo)
(function () {
  var slides = document.querySelectorAll('.art-hero-slide');
  if (slides.length === 0) return;
  var dots = document.querySelectorAll('.art-slider-dot');
  var prevBtn = document.querySelector('.art-slider-arrow.prev');
  var nextBtn = document.querySelector('.art-slider-arrow.next');
  var current = 0;
  var count = slides.length;
  var interval;

  function goTo(index) {
    slides[current].classList.remove('active');
    if (dots[current]) dots[current].classList.remove('active');
    current = (index + count) % count;
    slides[current].classList.add('active');
    if (dots[current]) dots[current].classList.add('active');
  }

  function next() { goTo(current + 1); }
  function prev() { goTo(current - 1); }
  function start() { stop(); interval = setInterval(next, 9000); }
  function stop() { if (interval) clearInterval(interval); }

  if (nextBtn) nextBtn.addEventListener('click', function () { next(); start(); });
  if (prevBtn) prevBtn.addEventListener('click', function () { prev(); start(); });
  dots.forEach(function (dot, i) {
    dot.addEventListener('click', function () { goTo(i); start(); });
  });

  var slider = document.getElementById('artHeroSlider');
  if (slider) {
    var startX = 0, endX = 0;
    slider.addEventListener('touchstart', function (e) {
      startX = e.changedTouches[0].screenX;
    }, { passive: true });
    slider.addEventListener('touchend', function (e) {
      endX = e.changedTouches[0].screenX;
      var delta = endX - startX;
      if (Math.abs(delta) < 40) return;
      if (delta < 0) next(); else prev();
      start();
    }, { passive: true });
  }
  start();
})();

function toggleMenu() {
  var menu = document.getElementById('mobile-menu');
  var b1 = document.getElementById('bar1');
  var b2 = document.getElementById('bar2');
  var b3 = document.getElementById('bar3');
  if (!menu) return;
  var open = !menu.classList.contains('hidden');
  menu.classList.toggle('hidden');
  if (b1) b1.style.transform = open ? '' : 'translateY(8px) rotate(45deg)';
  if (b2) b2.style.opacity = open ? '1' : '0';
  if (b3) b3.style.transform = open ? '' : 'translateY(-8px) rotate(-45deg)';
}

function slideTo(id, index) {
  var track = document.getElementById(id);
  if (!track) return;
  var count = track.children.length;
  if (index < 0) index = 0;
  if (index > count - 1) index = count - 1;
  var slidePercent = 100 / count;
  track.style.transform = 'translateX(-' + (index * slidePercent) + '%)';
  track.dataset.current = index;
  var left = document.getElementById(id + '-dot-0');
  var right = document.getElementById(id + '-dot-1');
  if (left) left.style.opacity = index > 0 ? '1' : '0.4';
  if (right) right.style.opacity = index < count - 1 ? '1' : '0.4';
}

function slidePrev(id) {
  var track = document.getElementById(id);
  if (!track) return;
  slideTo(id, (parseInt(track.dataset.current) || 0) - 1);
}

function slideNext(id) {
  var track = document.getElementById(id);
  if (!track) return;
  slideTo(id, (parseInt(track.dataset.current) || 0) + 1);
}

function initSlider(id) {
  var track = document.getElementById(id);
  if (!track) return;
  var count = track.children.length;
  track.style.width = (count * 100) + '%';
  for (var i = 0; i < track.children.length; i++) {
    track.children[i].style.width = (100 / count) + '%';
  }
  track.dataset.current = '0';
  var startX = 0, startY = 0;
  var isDragging = false, isHorizontal = null;

  track.addEventListener('touchstart', function (e) {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    isDragging = true;
    isHorizontal = null;
  }, { passive: true });

  track.addEventListener('touchmove', function (e) {
    if (!isDragging) return;
    var dx = Math.abs(e.touches[0].clientX - startX);
    var dy = Math.abs(e.touches[0].clientY - startY);
    if (isHorizontal === null) isHorizontal = dx > dy;
    if (isHorizontal) e.preventDefault();
  }, { passive: false });

  track.addEventListener('touchend', function (e) {
    if (!isDragging || !isHorizontal) { isDragging = false; return; }
    isDragging = false;
    var diff = startX - e.changedTouches[0].clientX;
    if (Math.abs(diff) < 30) return;
    if (diff > 0) slideNext(id);
    if (diff < 0) slidePrev(id);
  });

  track.addEventListener('mousedown', function (e) {
    startX = e.clientX; isDragging = true; e.preventDefault();
  });
  track.addEventListener('mouseup', function (e) {
    if (!isDragging) return;
    isDragging = false;
    var diff = startX - e.clientX;
    if (Math.abs(diff) < 30) return;
    if (diff > 0) slideNext(id);
    if (diff < 0) slidePrev(id);
  });
  track.addEventListener('mouseleave', function () { isDragging = false; });
}

initSlider('slider-stich');
initSlider('slider-tetera');
initSlider('slider-vangogh');
initSlider('slider-azucarera-vangogh');
initSlider('slider-vasito-vangogh');
initSlider('slider-snoopy');
initSlider('slider-taza-navidad');

// Productos cargados desde el panel admin (negocio_productos)
(function () {
  var WHATSAPP_NUM = '51929938466';

  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function waLink(nombre) {
    var texto = 'Hola! Me gustaría consultar por la pieza: ' + nombre;
    return 'https://wa.me/' + WHATSAPP_NUM + '?text=' + encodeURIComponent(texto);
  }

  var FOTOS_CATALOGO_MAP = {
    'taza-formula-1': '/imagenes/Artesanitas/Fotos/taza_formula1_1.jpg',
    'formula-1': '/imagenes/Artesanitas/Fotos/taza_formula1_1.jpg',
    'set-de-2-tazas-personalizadas': '/imagenes/Artesanitas/Fotos/set_de_2_tazas_personalizadas_1.jpeg',
    'tazas-personalizadas': '/imagenes/Artesanitas/Fotos/set_de_2_tazas_personalizadas_1.jpeg',
    'taza-artesanal-con-salpicado': '/imagenes/Artesanitas/Fotos/taza_artesanal_con_salpicado_1.jpeg',
    'taza-salpicado': '/imagenes/Artesanitas/Fotos/taza_artesanal_con_salpicado_1.jpeg',
    'corazon-de-ceramica-para-pintar': '/imagenes/Artesanitas/Fotos/corazon_ceramica_para_pintar_1.jpeg',
    'corazon-para-pintar': '/imagenes/Artesanitas/Fotos/corazon_ceramica_para_pintar_1.jpeg',
    'tazas-caspianas': '/imagenes/Artesanitas/Fotos/tazas_caspianas_1.jpeg',
    'taza-perry': '/imagenes/Artesanitas/Fotos/taza_perry_el_ornitorrinco_1.jpg',
    'taza-perry-el-ornitorrinco': '/imagenes/Artesanitas/Fotos/taza_perry_el_ornitorrinco_1.jpg',
    'palo-rosa-lb': '/imagenes/Artesanitas/Fotos/Taza_Rapunzel_PaloRosa_con-lineas_1.jpeg',
    'palo-rosa-full': '/imagenes/Artesanitas/Fotos/Taza_Rapunzel_Palo_Rosa_sin_plato_1.jpeg',
    'morada-full': '/imagenes/Artesanitas/Fotos/Taza_Rapunzel_Morada_sinplato_1.jpeg',
    'morada-con-lineas': '/imagenes/Artesanitas/Fotos/taza_Rapunzel_Morada_con_lineas_1.jpeg',
    'taza-stich-celeste': '/imagenes/Artesanitas/Fotos/Taza_Stich_sin_plato_1.jpeg',
    'taza-stich-azul': '/imagenes/Artesanitas/Fotos/taza_stich_1.jpeg',
    'taza-snoopy': '/imagenes/Artesanitas/Fotos/taza_snoopy_0.jpeg',
    'taza-van-gogh': '/imagenes/Artesanitas/Fotos/Taza_Van_Gogh_0.jpeg',
    'vaso-van-gogh': '/imagenes/Artesanitas/Fotos/vasito_van_gogh_0.jpeg',
    'taza-shrek': '/imagenes/Artesanitas/Fotos/taza_shrek_2.jpg',
    'platos-uva': '/imagenes/Artesanitas/Fotos/platos_uva_1.jpeg',
    'plato-morado-full': '/imagenes/Artesanitas/Fotos/plato_morado_full_1.jpeg',
    'taza-rosada': '/imagenes/Artesanitas/Fotos/Taza_Rapunzel_Rosada_sinplato_1.jpeg',
    'adorno-paltita': '/imagenes/Artesanitas/Fotos/Adorno_Paltita_1.jpeg',
    'taza-copa-piston': '/imagenes/Artesanitas/Fotos/Taza_Piston_1.jpeg',
    'taza-piston-cup': '/imagenes/Artesanitas/Fotos/Taza_Piston_1.jpeg',
    'adorno-oso-sentado': '/imagenes/Artesanitas/Fotos/Adorno_oso_sentado_1.jpeg',
    'adorno-munequitas': '/imagenes/Artesanitas/Fotos/Adorno_munequita_con_plantita_1.jpeg'
  };

  function resolverFotoProducto(p) {
    var rawImg = (p.imagenes && p.imagenes[0]) || '';
    // Si ya apunta a un archivo estático directo (/imagenes/Artesanitas/...)
    if (rawImg && rawImg.indexOf('/imagenes/Artesanitas/') === 0) {
      return rawImg;
    }

    var slug = (p.slug || '').toLowerCase();
    var nom = (p.nombre || '').toLowerCase();

    // Mapeo directo por slug o por coincidencia
    if (FOTOS_CATALOGO_MAP[slug]) return FOTOS_CATALOGO_MAP[slug];
    if (nom.indexOf('formula') !== -1 || nom.indexOf('fórmula') !== -1) return '/imagenes/Artesanitas/Fotos/taza_formula1_1.jpg';
    if (nom.indexOf('personalizada') !== -1) return '/imagenes/Artesanitas/Fotos/set_de_2_tazas_personalizadas_1.jpeg';
    if (nom.indexOf('salpicado') !== -1) return '/imagenes/Artesanitas/Fotos/taza_artesanal_con_salpicado_1.jpeg';
    if (nom.indexOf('coraz') !== -1 && nom.indexOf('pintar') !== -1) return '/imagenes/Artesanitas/Fotos/corazon_ceramica_para_pintar_1.jpeg';
    if (nom.indexOf('caspiana') !== -1) return '/imagenes/Artesanitas/Fotos/tazas_caspianas_1.jpeg';
    if (nom.indexOf('perry') !== -1) return '/imagenes/Artesanitas/Fotos/taza_perry_el_ornitorrinco_1.jpg';

    if (rawImg) return rawImg;
    return '/imagenes/Artesanitas/logo_artesanitas.peru.jpg';
  }

  function classifyCategoryBySlug(slug, nombre) {
    var s = String(slug || '').toLowerCase() + ' ' + String(nombre || '').toLowerCase();
    if (s.indexOf('adorno') !== -1 || s.indexOf('elefant') !== -1 || s.indexOf('jarron') !== -1 || s.indexOf('jarrón') !== -1 || s.indexOf('macet') !== -1 || s.indexOf('munequita') !== -1) return 'decoracion';
    if (s.indexOf('tetera') !== -1 || s.indexOf('azucarera') !== -1 || s.indexOf('vasito') !== -1) return 'teteras';
    if ((s.indexOf('plato') !== -1 || s.indexOf('platito') !== -1 || s.indexOf('caspiana') !== -1 || s.indexOf('set') !== -1) && s.indexOf('taza') !== -1 && s.indexOf('sin-plato') === -1) return 'sets';
    if (s.indexOf('plato') !== -1 && s.indexOf('taza') === -1) return 'platos';
    return 'tazas';
  }

  // Renderiza el bloque inferior de acción estilo Saga Falabella (Botón Agregar al Carro o Stepper - 1 + en vivo)
  function renderFalabellaActionHtml(slug, isRes, agotado) {
    if (agotado) {
      return '<button type="button" disabled class="w-full rounded-full bg-[#EBE5DE] text-[#8C7A6B] font-bold text-xs sm:text-sm py-2.5 px-4 cursor-not-allowed">Agotado</button>';
    }
    var itemInCart = null;
    for (var i = 0; i < cartItems.length; i++) {
      if (cartItems[i].slug === slug) { itemInCart = cartItems[i]; break; }
    }
    var slugAttr = escapeHtml(slug).replace(/'/g, "\\'");

    if (itemInCart && itemInCart.cantidad > 0) {
      var targetUrl = isRes ? ('/pedido?producto=' + encodeURIComponent(slug)) : '/checkout';
      return '' +
        '<div class="space-y-1.5">' +
        '<div class="flex items-center justify-between bg-[#333c48] text-white rounded-full p-1 shadow-sm">' +
        '<button type="button" onclick="window.ArtesanitasCart.changeQty(\'' + slugAttr + '\', -1)" class="w-8 h-8 rounded-full bg-white/15 hover:bg-white/30 text-white font-extrabold text-sm flex items-center justify-center transition-colors cursor-pointer" aria-label="Quitar 1">−</button>' +
        '<span class="text-xs font-extrabold tracking-wide px-2">' + itemInCart.cantidad + ' en tu carro</span>' +
        '<button type="button" onclick="window.ArtesanitasCart.changeQty(\'' + slugAttr + '\', 1)" class="w-8 h-8 rounded-full bg-white/15 hover:bg-white/30 text-white font-extrabold text-sm flex items-center justify-center transition-colors cursor-pointer" aria-label="Sumar 1">+</button>' +
        '</div>' +
        '<a href="' + targetUrl + '" class="w-full rounded-full bg-[#008f6b] hover:bg-[#007759] text-white font-bold text-[11px] py-1.5 px-3 flex items-center justify-center gap-1 transition-all shadow-2xs">' +
        '<span>' + (isRes ? 'Completar Reserva →' : 'Ir a Pagar (Checkout) →') + '</span>' +
        '</a>' +
        '</div>';
    }

    if (isRes) {
      return '' +
        '<div class="grid grid-cols-2 gap-1.5">' +
        '<button type="button" onclick="window.ArtesanitasCart.addBySlug(\'' + slugAttr + '\', this)" class="w-full rounded-full bg-[#333c48] hover:bg-[#1e242b] text-white font-bold text-xs py-2.5 px-3 transition-all cursor-pointer shadow-xs">+ Reserva</button>' +
        '<a href="/pedido?producto=' + encodeURIComponent(slug) + '" class="w-full rounded-full bg-[#B87352] hover:bg-[#A36244] text-white font-bold text-xs py-2.5 px-3 transition-all text-center shadow-xs flex items-center justify-center">Reservar S/ 20</a>' +
        '</div>';
    }

    return '' +
      '<button type="button" onclick="window.ArtesanitasCart.addBySlug(\'' + slugAttr + '\', this)" ' +
      'class="w-full rounded-full bg-[#333c48] hover:bg-[#1e242b] text-white font-bold text-xs sm:text-sm py-2.5 px-5 transition-all cursor-pointer shadow-xs flex items-center justify-center gap-2">' +
      '<span>Agregar al Carro</span>' +
      '</button>';
  }

  function buildFalabellaCardBodyHtml(prod) {
    var slug = prod.slug;
    var slugJs = escapeHtml(slug).replace(/'/g, "\\'");
    var nombre = escapeHtml(prod.nombre);
    var nombreJs = nombre.replace(/'/g, "\\'");
    var path = '/producto/' + slug;
    var isRes = prod.modalidad === 'reserva';
    var precioNum = Number(prod.precio || 59.90);
    var precioRegular = Number(prod.precio_regular || precioNum);
    var hasPromo = precioRegular > precioNum;
    var discountPct = hasPromo ? Math.round(((precioRegular - precioNum) / precioRegular) * 100) : 0;

    var pillsHtml = isRes
      ? '<span class="inline-block bg-[#fef3c7] text-[#92400e] text-[11px] font-bold px-2 py-0.5 rounded">Preventa · Reserva S/ 20</span>' +
        '<span class="inline-block bg-[#e6f4ea] text-[#137333] text-[11px] font-bold px-2 py-0.5 rounded">Entrega 10 Dic</span>'
      : '<span class="inline-block bg-[#e6f4ea] text-[#137333] text-[11px] font-bold px-2 py-0.5 rounded">Despacho inmediato</span>' +
        '<span class="inline-block bg-[#e6f4ea] text-[#137333] text-[11px] font-bold px-2 py-0.5 rounded">Retira o Envío Shalom</span>';

    return '' +
      '<div class="flex flex-col flex-grow justify-between pt-3 px-1 space-y-2.5">' +
      '<div class="space-y-1">' +
      '<!-- Marca + Icono Compartir (Estilo Saga Falabella) -->' +
      '<div class="flex items-center justify-between gap-2">' +
      '<span class="text-[11px] font-bold uppercase tracking-wider text-[#8C7A6B]">ARTESANITAS PERÚ</span>' +
      '<button type="button" onclick="shareProducto(\'' + path + '\', \'' + nombreJs + '\')" class="text-[#8C7A6B] hover:text-[#B87352] p-1 rounded-full hover:bg-[#EBE5DE]/60 transition-colors cursor-pointer" title="Compartir o copiar link de esta pieza">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="w-4 h-4"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>' +
      '</button>' +
      '</div>' +

      '<!-- Título del Producto (Clicable para abrir Ficha Rápida) -->' +
      '<h3 onclick="window.ArtesanitasQuickView && window.ArtesanitasQuickView.open(\'' + slugJs + '\')" ' +
      'class="font-sans text-[15px] font-bold text-[#333c48] hover:text-[#B87352] leading-snug cursor-pointer transition-colors line-clamp-2">' +
      nombre +
      '</h3>' +

      '<!-- Vendedor + SKU Numérico -->' +
      '<div class="flex items-center gap-1.5 text-[11px] text-[#8C7A6B]">' +
      '<span>Por Artesanitas</span>' +
      '<span class="inline-flex items-center justify-center w-3.5 h-3.5 rounded-xs bg-[#82c91e] text-white font-serif font-bold text-[10px] leading-none">A</span>' +
      '<span class="font-mono text-[10px] text-[#8C7A6B] ml-auto" data-card-sku="' + escapeHtml(slug) + '">SKU ' + escapeHtml(prod.sku || '1001') + '</span>' +
      '</div>' +

      '<!-- Precio y Descuento -->' +
      '<div class="pt-0.5 flex items-center gap-2">' +
      '<span class="text-lg font-extrabold text-[#333c48]">S/ ' + precioNum.toFixed(2) + '</span>' +
      (hasPromo ? '<span class="bg-[#e02020] text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded">-' + discountPct + '%</span>' : '') +
      '</div>' +
      (hasPromo ? '<div class="text-xs text-[#8C7A6B] line-through">S/ ' + precioRegular.toFixed(2) + '</div>' : '') +

      '<!-- Píldoras Verdes de Entrega -->' +
      '<div class="flex flex-wrap gap-1.5 pt-1">' +
      pillsHtml +
      '</div>' +

      '<!-- Estrellas + Link Ficha -->' +
      '<div class="flex items-center justify-between pt-1 text-xs">' +
      '<div class="flex items-center gap-1">' +
      '<span class="text-[#f59f00] tracking-tight">★★★★★</span>' +
      '<span class="text-[11px] text-[#8C7A6B]">(5.0)</span>' +
      '</div>' +
      '<button type="button" onclick="window.ArtesanitasQuickView && window.ArtesanitasQuickView.open(\'' + slugJs + '\')" class="text-[11px] font-semibold text-[#B87352] hover:underline cursor-pointer">Ver detalles</button>' +
      '</div>' +
      '</div>' +

      '<!-- Botón Agregar al Carro (o Stepper en vivo) + Link Discreto WhatsApp Debajo -->' +
      '<div class="pt-2 space-y-1.5">' +
      '<div data-cart-action-slot="' + escapeHtml(slug) + '">' +
      renderFalabellaActionHtml(slug, isRes, prod.agotado) +
      '</div>' +
      '<a href="' + waLink(prod.nombre + ' (SKU ' + (prod.sku || '') + ')') + '" target="_blank" rel="noreferrer" ' +
      'class="w-full py-1 text-[11px] text-[#8C7A6B] hover:text-[#4A3C31] flex items-center justify-center gap-1 transition-colors">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3 h-3 text-[#008f6b]"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>' +
      '<span>Consultar duda por WhatsApp</span>' +
      '</a>' +
      '</div>' +
      '</div>';
  }

  function cardHtml(p) {
    var img = resolverFotoProducto(p);
    var nombreLimpio = cleanProductTitle(p.nombre);
    var nombre = escapeHtml(nombreLimpio);
    var hasPromo = p.precio_oferta && Number(p.precio_oferta) > 0 && Number(p.precio_oferta) < Number(p.precio);
    var stockNum = Number(p.stock_actual || 0);
    var permiteSinStock = p.vender_sin_stock === true || p.politica_sin_stock === 'preventa';
    var agotado = stockNum <= 0 && !permiteSinStock;
    var isRes = esProductoReserva(p.slug, p.politica_sin_stock);
    var precioEfectivo = hasPromo ? Number(p.precio_oferta) : Number(p.precio);
    var reservaUnit = isRes ? 20.00 : precioEfectivo;
    var modalidadStr = isRes ? 'reserva' : 'compra_directa';
    var slugJs = escapeHtml(p.slug).replace(/'/g, "\\'");
    var imgsList = (Array.isArray(p.imagenes) && p.imagenes.length > 0) ? p.imagenes : [img];
    var cat = classifyCategoryBySlug(p.slug, nombreLimpio);

    var prodObj = {
      slug: p.slug,
      sku: p.sku || '1029',
      nombre: nombreLimpio,
      precio: precioEfectivo,
      precio_regular: Number(p.precio),
      reserva: reservaUnit,
      modalidad: modalidadStr,
      categoria: cat,
      stock_actual: stockNum,
      vender_sin_stock: permiteSinStock,
      fecha_entrega_estimada: p.fecha_entrega_estimada || null,
      agotado: agotado,
      coleccion: p.coleccion || 'Catálogo General',
      imagenes: imgsList,
      descripcion: p.descripcion || '',
      tamano_dimensiones: p.tamano_dimensiones || '',
      color: p.color || '',
      caracteristicas: p.caracteristicas || ''
    };
    registerProductInStore(prodObj);

    return '' +
      '<div class="group flex flex-col bg-white rounded-3xl p-3.5 border border-[#EBE5DE] shadow-2xs hover:shadow-md transition-all" data-slug="' + escapeHtml(p.slug) + '" data-cat="' + cat + '" data-coleccion="' + escapeHtml((p.coleccion || '').toLowerCase()) + '" data-price="' + precioEfectivo + '" data-name="' + nombre.toLowerCase() + '" data-sku="' + escapeHtml(prodObj.sku) + '">' +
      '<div class="relative aspect-[4/5] overflow-hidden rounded-2xl bg-[#F9F6F0] cursor-pointer" onclick="window.ArtesanitasQuickView && window.ArtesanitasQuickView.open(\'' + slugJs + '\')">' +
      '<img src="' + escapeHtml(img) + '" alt="' + nombre + '" loading="lazy" onerror="this.onerror=null; this.src=\'/imagenes/Artesanitas/logo_artesanitas.peru.jpg\';" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />' +
      '</div>' +
      buildFalabellaCardBodyHtml(prodObj) +
      '</div>';
  }

  var RESERVA_SLUGS_EXACT = {
    'taza-navidad-papa-noel': true,
    'taza-muneco-de-nieve': true,
    'taza-arbolito-chocolatosa': true,
    'taza-arbolito-rosa': true,
    'taza-rapunzel': true,
    'taza-stich': true,
    'taza-van-gogh': true,
    'taza-piston-cup': true,
    'azucarera-van-gogh': true,
    'vasito-van-gogh': true
  };

  function esProductoReserva(slug, politica) {
    if (!slug) return false;
    var s = String(slug).toLowerCase();
    if (RESERVA_SLUGS_EXACT[s]) return true;
    if (s.indexOf('taza-rapunzel') === 0 || s.indexOf('taza-navidad') === 0) return true;
    return politica === 'preventa';
  }

  var PRODUCTOS_STORE_MAP = {};

  function cleanProductTitle(str) {
    return String(str || '')
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F\u200D]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function formatFechaEntregaCorta(iso) {
    if (!iso) return '';
    var parts = String(iso).slice(0, 10).split('-');
    if (parts.length !== 3) return '';
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function registerProductInStore(data) {
    if (!data || !data.slug) return;
    var existing = PRODUCTOS_STORE_MAP[data.slug] || {};
    var cleanNom = cleanProductTitle(data.nombre || existing.nombre || data.slug);
    PRODUCTOS_STORE_MAP[data.slug] = {
      slug: data.slug,
      sku: data.sku || existing.sku || '1001',
      nombre: cleanNom,
      precio: Number(data.precio || existing.precio || 59.90),
      precio_regular: Number(data.precio_regular || data.precio || existing.precio || 59.90),
      reserva: Number(data.reserva || existing.reserva || 59.90),
      modalidad: data.modalidad || existing.modalidad || (esProductoReserva(data.slug) ? 'reserva' : 'compra_directa'),
      categoria: data.categoria || existing.categoria || classifyCategoryBySlug(data.slug, cleanNom),
      stock_actual: data.stock_actual !== undefined ? Number(data.stock_actual) : (existing.stock_actual !== undefined ? existing.stock_actual : 5),
      vender_sin_stock: data.vender_sin_stock !== undefined ? Boolean(data.vender_sin_stock) : Boolean(existing.vender_sin_stock),
      fecha_entrega_estimada: data.fecha_entrega_estimada !== undefined ? data.fecha_entrega_estimada : (existing.fecha_entrega_estimada || null),
      agotado: Boolean(data.agotado),
      imagenes: (Array.isArray(data.imagenes) && data.imagenes.length > 0) ? data.imagenes : (existing.imagenes || ['/imagenes/Artesanitas/logo_artesanitas.peru.jpg']),
      descripcion: data.descripcion || existing.descripcion || 'Pieza artesanal modelada y esmaltada a mano en cerámica de alta temperatura.',
      tamano_dimensiones: data.tamano_dimensiones || existing.tamano_dimensiones || '12 oz (350 ml) · Medida estándar artesanal',
      color: data.color || existing.color || 'Esmaltado artesanal pintado a mano',
      caracteristicas: data.caracteristicas || existing.caracteristicas || 'Apto para bebidas calientes y microondas · Envío seguro a todo el Perú'
    };
  }

  // ── Modal Vista Rápida (Shopify Quick-View PDP) ──
  var qvCurrentQty = 1;

  window.ArtesanitasQuickView = {
    open: function (slug) {
      var prod = PRODUCTOS_STORE_MAP[slug];
      if (!prod) return;
      qvCurrentQty = 1;

      var modal = document.getElementById('product-quickview-modal');
      if (!modal) return;

      var isRes = prod.modalidad === 'reserva';
      document.getElementById('qv-sku').textContent = 'SKU: ' + (prod.sku || '1001');
      document.getElementById('qv-title').textContent = cleanProductTitle(prod.nombre);
      document.getElementById('qv-price').textContent = 'S/ ' + Number(prod.precio).toFixed(2);
      document.getElementById('qv-desc').textContent = prod.descripcion;
      document.getElementById('qv-qty').textContent = '1';
      document.getElementById('qv-link-pdp').href = '/producto/' + encodeURIComponent(prod.slug);
      document.getElementById('qv-link-wa').href = waLink(cleanProductTitle(prod.nombre) + ' (SKU ' + (prod.sku || '') + ')');

      var modeBadge = document.getElementById('qv-mode-badge');
      var stockBadge = document.getElementById('qv-stock-badge');
      var payHint = document.getElementById('qv-payment-hint');
      var btnAddTxt = document.getElementById('qv-btn-add-text');
      var btnBuyTxt = document.getElementById('qv-btn-buy-text');
      var fechaEstFmt = formatFechaEntregaCorta(prod.fecha_entrega_estimada);

      if (prod.agotado) {
        modeBadge.textContent = 'Sin Stock';
        modeBadge.className = 'bg-[#4A3C31] text-white text-[10px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full shadow';
        stockBadge.textContent = 'Agotado temporalmente';
        payHint.textContent = 'Consulta por WhatsApp próxima reposición';
        btnAddTxt.textContent = 'Agotado';
        btnBuyTxt.textContent = 'Consultar Reposición';
      } else if (isRes) {
        modeBadge.textContent = prod.stock_actual <= 0 && prod.vender_sin_stock ? 'Disponible a Pedido' : 'Colección en Preventa';
        modeBadge.className = 'bg-[#B87352] text-white text-[10px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full shadow';
        stockBadge.textContent = fechaEstFmt ? ('Entrega estimada: ' + fechaEstFmt) : 'Reserva hoy con S/ 20.00';
        payHint.textContent = fechaEstFmt ? ('Compra o reserva · Entrega: ' + fechaEstFmt) : 'Reserva con S/ 20.00 · Saldo al entregar';
        btnAddTxt.textContent = 'Agregar a Reserva';
        btnBuyTxt.textContent = 'Reservar Ahora (S/ 20)';
      } else {
        modeBadge.textContent = 'Venta Directa Online';
        modeBadge.className = 'bg-[#137333] text-white text-[10px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full shadow';
        stockBadge.textContent = prod.stock_actual > 0
          ? ('En Stock (' + prod.stock_actual + ' disp.) · Despacho Inmediato')
          : (fechaEstFmt ? ('A pedido · Entrega: ' + fechaEstFmt) : 'Disponible para Despacho Inmediato');
        payHint.textContent = 'Pago 100% Online · Descarga Automática de Stock';
        btnAddTxt.textContent = 'Agregar al Carro';
        btnBuyTxt.textContent = 'Ir a Pagar (S/ ' + Number(prod.precio).toFixed(2) + ')';
      }

      var specsEl = document.getElementById('qv-specs');
      if (specsEl) {
        specsEl.innerHTML =
          '<div class="grid grid-cols-[125px_1fr] sm:grid-cols-[145px_1fr] gap-2 items-start"><span class="text-[#8C7A6B]">Código SKU:</span><span class="font-mono font-bold text-[#4A3C31]">' + escapeHtml(prod.sku || '1001') + '</span></div>' +
          '<div class="grid grid-cols-[125px_1fr] sm:grid-cols-[145px_1fr] gap-2 items-start"><span class="text-[#8C7A6B]">Medidas / Capacidad:</span><span class="font-semibold text-[#4A3C31]">' + escapeHtml(prod.tamano_dimensiones) + '</span></div>' +
          '<div class="grid grid-cols-[125px_1fr] sm:grid-cols-[145px_1fr] gap-2 items-start"><span class="text-[#8C7A6B]">Acabado / Color:</span><span class="font-semibold text-[#4A3C31]">' + escapeHtml(prod.color) + '</span></div>' +
          '<div class="grid grid-cols-[125px_1fr] sm:grid-cols-[145px_1fr] gap-2 items-start"><span class="text-[#8C7A6B]">Detalle:</span><span class="font-semibold text-[#4A3C31]">' + escapeHtml(prod.caracteristicas) + '</span></div>' +
          (fechaEstFmt && prod.stock_actual <= 0 ? ('<div class="grid grid-cols-[125px_1fr] sm:grid-cols-[145px_1fr] gap-2 items-start"><span class="text-[#8C7A6B]">Entrega Estimada:</span><span class="font-bold text-[#B87352]">' + escapeHtml(fechaEstFmt) + '</span></div>') : '') +
          '<div class="grid grid-cols-[125px_1fr] sm:grid-cols-[145px_1fr] gap-2 items-start"><span class="text-[#8C7A6B]">Logística:</span><span class="font-semibold text-[#4A3C31]">Envío Shalom (S/ 10) o Retiro en Taller Trujillo</span></div>';
      }

      var mainImg = document.getElementById('qv-main-img');
      var thumbsEl = document.getElementById('qv-thumbs');
      var imgs = prod.imagenes || ['/imagenes/Artesanitas/logo_artesanitas.peru.jpg'];
      if (mainImg) mainImg.src = imgs[0];

      if (thumbsEl) {
        thumbsEl.innerHTML = imgs.map(function (src, idx) {
          return '<button type="button" data-qv-img="' + escapeHtml(src) + '" class="qv-thumb-btn w-14 h-14 rounded-xl overflow-hidden border-2 ' + (idx === 0 ? 'border-[#B87352]' : 'border-white/70') + ' shrink-0 bg-white cursor-pointer transition-all">' +
            '<img src="' + escapeHtml(src) + '" class="w-full h-full object-cover" />' +
            '</button>';
        }).join('');
        thumbsEl.querySelectorAll('.qv-thumb-btn').forEach(function (b) {
          b.addEventListener('click', function () {
            if (mainImg) mainImg.src = b.getAttribute('data-qv-img');
            thumbsEl.querySelectorAll('.qv-thumb-btn').forEach(function (x) { x.classList.replace('border-[#B87352]', 'border-white/70'); });
            b.classList.replace('border-white/70', 'border-[#B87352]');
          });
        });
      }

      var btnAdd = document.getElementById('qv-btn-add-cart');
      var btnBuy = document.getElementById('qv-btn-buy-now');

      btnAdd.onclick = function () {
        for (var k = 0; k < qvCurrentQty; k++) {
          window.ArtesanitasCart.addItem({
            slug: prod.slug,
            sku: prod.sku,
            nombre: prod.nombre,
            precio: prod.precio,
            reserva: isRes ? 20.00 : prod.precio,
            modalidad: prod.modalidad,
            imagen: imgs[0]
          }, k === 0 ? btnAdd : null);
        }
      };

      btnBuy.onclick = function () {
        for (var k = 0; k < qvCurrentQty; k++) {
          window.ArtesanitasCart.addItem({
            slug: prod.slug,
            sku: prod.sku,
            nombre: prod.nombre,
            precio: prod.precio,
            reserva: isRes ? 20.00 : prod.precio,
            modalidad: prod.modalidad,
            imagen: imgs[0]
          });
        }
        window.location.href = isRes ? ('/pedido?producto=' + encodeURIComponent(prod.slug)) : '/checkout';
      };

      modal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    },
    close: function () {
      var modal = document.getElementById('product-quickview-modal');
      if (modal) modal.classList.add('hidden');
      document.body.style.overflow = '';
    },
    stepQty: function (delta) {
      qvCurrentQty = Math.max(1, Math.min(20, qvCurrentQty + delta));
      var el = document.getElementById('qv-qty');
      if (el) el.textContent = String(qvCurrentQty);
    }
  };

  // ── Carrito Persistente E-Commerce 2026 (Sincronizado con Header, Tarjetas y Drawer) ──
  var CART_STORAGE_KEY = 'artesanitas_cart_v1';

  function loadCartFromStorage() {
    try {
      var raw = localStorage.getItem(CART_STORAGE_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter(function (i) { return i && i.slug && i.cantidad > 0; }) : [];
    } catch (e) {
      return [];
    }
  }

  function saveCartToStorage(items) {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch (e) {}
  }

  var cartItems = loadCartFromStorage();

  function refreshCardActionSlots() {
    var slots = document.querySelectorAll('[data-cart-action-slot]');
    slots.forEach(function (slot) {
      var slug = slot.getAttribute('data-cart-action-slot');
      var prod = PRODUCTOS_STORE_MAP[slug];
      var isRes = prod ? (prod.modalidad === 'reserva') : esProductoReserva(slug);
      var agotado = prod ? Boolean(prod.agotado) : false;
      slot.innerHTML = renderFalabellaActionHtml(slug, isRes, agotado);
    });
  }

  function updateCartUI() {
    var floatingBar = document.getElementById('cart-floating-bar');
    var bubbleBadge = document.getElementById('cart-bubble-badge');
    var navBadge = document.getElementById('nav-cart-badge');
    var bubbleText = document.getElementById('cart-bubble-text');
    var drawerItemsEl = document.getElementById('cart-drawer-items');
    var drawerSubtotalEl = document.getElementById('cart-drawer-subtotal');
    var drawerReservaEl = document.getElementById('cart-drawer-reserva');
    var drawerSubtitleEl = document.getElementById('cart-drawer-subtitle');
    var drawerPayLabel = document.getElementById('cart-drawer-pay-label');
    var drawerCtaLabel = document.getElementById('cart-drawer-cta-label');
    var drawerCheckoutBtn = document.getElementById('cart-drawer-checkout-btn');

    var totalPiezas = cartItems.reduce(function (acc, item) { return acc + (Number(item.cantidad) || 0); }, 0);
    var totalPrecio = cartItems.reduce(function (acc, item) { return acc + ((Number(item.precio) || 0) * (Number(item.cantidad) || 0)); }, 0);
    var totalPagarHoy = cartItems.reduce(function (acc, item) {
      var esRes = item.modalidad === 'reserva' || (item.modalidad !== 'compra_directa' && esProductoReserva(item.slug));
      var unitHoy = esRes ? (Number(item.reserva) || 20) : Number(item.precio || 0);
      return acc + (unitHoy * (Number(item.cantidad) || 0));
    }, 0);

    var tieneCompraDirecta = cartItems.some(function (item) {
      return item.modalidad === 'compra_directa' || !esProductoReserva(item.slug);
    });

    if (floatingBar) {
      if (totalPiezas > 0) {
        floatingBar.classList.remove('hidden');
      } else {
        floatingBar.classList.add('hidden');
      }
    }

    if (bubbleBadge) bubbleBadge.textContent = String(totalPiezas);
    if (navBadge) navBadge.textContent = String(totalPiezas);
    if (bubbleText) {
      bubbleText.textContent = 'Carro (' + totalPiezas + ' ' + (totalPiezas === 1 ? 'pieza' : 'piezas') + ' · S/ ' + totalPrecio.toFixed(2) + ')';
    }
    if (drawerSubtotalEl) drawerSubtotalEl.textContent = 'S/ ' + totalPrecio.toFixed(2);
    if (drawerReservaEl) drawerReservaEl.textContent = 'S/ ' + totalPagarHoy.toFixed(2);
    if (drawerPayLabel) {
      drawerPayLabel.textContent = (totalPagarHoy >= totalPrecio)
        ? 'Total a pagar (Venta Directa 100%):'
        : 'Monto a pagar hoy:';
    }
    if (drawerCheckoutBtn) {
      drawerCheckoutBtn.href = tieneCompraDirecta ? '/checkout' : '/pedido';
    }
    if (drawerCtaLabel) {
      drawerCtaLabel.textContent = tieneCompraDirecta ? 'Ir a Pagar (Checkout Venta Directa)' : 'Completar Reserva de Preventa';
    }
    if (drawerSubtitleEl) {
      drawerSubtitleEl.textContent = totalPiezas > 0
        ? totalPiezas + ' ' + (totalPiezas === 1 ? 'pieza en tu carro' : 'piezas en tu carro') + ' · Puedes sumar (+) o quitar (−)'
        : 'Tu carro de compras está vacío';
    }

    refreshCardActionSlots();

    if (drawerItemsEl) {
      if (cartItems.length === 0) {
        drawerItemsEl.innerHTML =
          '<div class="text-center py-12 px-4 space-y-3">' +
          '<div class="w-14 h-14 rounded-full bg-[#EBE5DE] text-[#8C7A6B] flex items-center justify-center mx-auto"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="w-7 h-7"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg></div>' +
          '<p class="text-sm font-bold text-[#4A3C31]">Tu carro de compras está vacío</p>' +
          '<p class="text-xs text-[#8C7A6B]">Haz clic en "Agregar al Carro" en cualquier pieza del catálogo para comprar online.</p>' +
          '</div>';
      } else {
        drawerItemsEl.innerHTML = cartItems.map(function (item) {
          var slugAttr = escapeHtml(item.slug).replace(/'/g, "\\'");
          var esRes = item.modalidad === 'reserva' || (item.modalidad !== 'compra_directa' && esProductoReserva(item.slug));
          var subItem = (Number(item.precio) || 0) * (Number(item.cantidad) || 1);
          var hoyItem = (esRes ? (Number(item.reserva) || 20) : Number(item.precio || 0)) * (Number(item.cantidad) || 1);
          return '' +
            '<div class="bg-white p-3.5 rounded-2xl border border-[#EBE5DE] shadow-2xs flex items-center justify-between gap-3">' +
            '<div class="flex items-center gap-3 min-w-0">' +
            '<img src="' + escapeHtml(item.imagen || '/imagenes/Artesanitas/logo_artesanitas.peru.jpg') + '" alt="' + escapeHtml(item.nombre) + '" onerror="this.onerror=null;this.src=\'/imagenes/Artesanitas/logo_artesanitas.peru.jpg\';" class="w-14 h-14 rounded-xl object-cover border border-[#EBE5DE] shrink-0 bg-[#F9F6F0]" />' +
            '<div class="min-w-0">' +
            '<h4 class="text-xs sm:text-sm font-bold text-[#4A3C31] truncate">' + escapeHtml(item.nombre) + '</h4>' +
            '<span class="text-[11px] text-[#8C7A6B] block">S/ ' + Number(item.precio).toFixed(2) + ' c/u</span>' +
            '<span class="text-[10px] font-semibold ' + (esRes ? 'text-[#B87352]' : 'text-[#137333]') + ' block">' +
            (esRes ? ('Preventa · Adelanto: S/ ' + hoyItem.toFixed(2)) : ('Venta Directa · S/ ' + hoyItem.toFixed(2))) +
            '</span>' +
            '</div>' +
            '</div>' +
            '<div class="flex flex-col items-end gap-1.5 shrink-0">' +
            '<div class="flex items-center gap-2">' +
            '<span class="text-xs font-bold text-[#333c48]">S/ ' + subItem.toFixed(2) + '</span>' +
            '<button type="button" onclick="window.ArtesanitasCart.removeItem(\'' + slugAttr + '\')" class="text-[#8C7A6B] hover:text-red-600 p-1 cursor-pointer" title="Quitar del carro">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5"><path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
            '</button>' +
            '</div>' +
            '<div class="flex items-center gap-1 bg-[#F9F6F0] rounded-full border border-[#D5C9BD] p-0.5">' +
            '<button type="button" onclick="window.ArtesanitasCart.changeQty(\'' + slugAttr + '\', -1)" class="w-6 h-6 rounded-full bg-white hover:bg-[#333c48] hover:text-white text-[#4A3C31] font-bold text-xs flex items-center justify-center transition-colors cursor-pointer">−</button>' +
            '<span class="w-6 text-center font-bold text-xs text-[#4A3C31]">' + Number(item.cantidad) + '</span>' +
            '<button type="button" onclick="window.ArtesanitasCart.changeQty(\'' + slugAttr + '\', 1)" class="w-6 h-6 rounded-full bg-white hover:bg-[#333c48] hover:text-white text-[#4A3C31] font-bold text-xs flex items-center justify-center transition-colors cursor-pointer">+</button>' +
            '</div>' +
            '</div>' +
            '</div>';
        }).join('');
      }
    }
  }

  window.ArtesanitasCart = {
    addBySlug: function (slug, btnEl) {
      var prod = PRODUCTOS_STORE_MAP[slug];
      if (!prod) return;
      var imgs = prod.imagenes || ['/imagenes/Artesanitas/logo_artesanitas.peru.jpg'];
      this.addItem({
        slug: prod.slug,
        sku: prod.sku,
        nombre: prod.nombre,
        precio: prod.precio,
        reserva: prod.modalidad === 'reserva' ? 20.00 : prod.precio,
        modalidad: prod.modalidad,
        imagen: imgs[0]
      }, btnEl);
    },
    addItem: function (prod, _btnEl) {
      if (!prod || !prod.slug) return;
      var esRes = prod.modalidad ? (prod.modalidad === 'reserva') : esProductoReserva(prod.slug);
      var precioNum = Number(prod.precio) || 59.90;
      var reservaNum = esRes ? (Number(prod.reserva) || 20.00) : precioNum;
      var modalidadFinal = esRes ? 'reserva' : 'compra_directa';

      var idx = -1;
      for (var i = 0; i < cartItems.length; i++) {
        if (cartItems[i].slug === prod.slug) { idx = i; break; }
      }
      if (idx > -1) {
        cartItems[idx].cantidad = Math.min(50, (Number(cartItems[idx].cantidad) || 1) + 1);
        cartItems[idx].modalidad = modalidadFinal;
        cartItems[idx].reserva = reservaNum;
      } else {
        cartItems.push({
          slug: prod.slug,
          sku: prod.sku || '',
          nombre: prod.nombre || prod.slug,
          precio: precioNum,
          reserva: reservaNum,
          modalidad: modalidadFinal,
          cantidad: 1,
          imagen: prod.imagen || '/imagenes/Artesanitas/logo_artesanitas.peru.jpg',
          descripcion: prod.descripcion || ''
        });
      }
      saveCartToStorage(cartItems);
      updateCartUI();

      if (typeof fbq === 'function') {
        try {
          fbq('trackSingle', '851775257895823', 'AddToCart', {
            content_ids: [prod.slug],
            content_name: prod.nombre,
            value: precioNum,
            currency: 'PEN'
          });
        } catch (e) {}
      }
      showShareToast('Agregado a tu Carro de Compras');
    },
    removeItem: function (slug) {
      cartItems = cartItems.filter(function (i) { return i.slug !== slug; });
      saveCartToStorage(cartItems);
      updateCartUI();
    },
    changeQty: function (slug, delta) {
      for (var i = 0; i < cartItems.length; i++) {
        if (cartItems[i].slug === slug) {
          cartItems[i].cantidad = (Number(cartItems[i].cantidad) || 1) + delta;
          if (cartItems[i].cantidad <= 0) {
            cartItems.splice(i, 1);
          } else if (cartItems[i].cantidad > 50) {
            cartItems[i].cantidad = 50;
          }
          break;
        }
      }
      saveCartToStorage(cartItems);
      updateCartUI();
    },
    clearCart: function () {
      cartItems = [];
      saveCartToStorage(cartItems);
      updateCartUI();
      this.closeDrawer();
    },
    openDrawer: function () {
      var overlay = document.getElementById('cart-drawer-overlay');
      if (overlay) overlay.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    },
    closeDrawer: function () {
      var overlay = document.getElementById('cart-drawer-overlay');
      if (overlay) overlay.classList.add('hidden');
      document.body.style.overflow = '';
    }
  };

  // Transforma todas las tarjetas del catálogo al diseño limpio Saga Falabella 2026:
  // 1. Limpia por completo la imagen (quita botones de WhatsApp o íconos superpuestos) y activa el click para abrir la Ficha Quick-View.
  // 2. Renderiza debajo de la imagen el bloque comercial estilo Falabella con "Agregar al Carro" y stepper interactivo (- 1 +).
  function injectCartButtonsOnStaticCards() {
    var cards = document.querySelectorAll('#coleccion-navidad .group, #catalogo [data-slug], #coleccion-van-gogh .group');
    var seqCounter = 1;

    cards.forEach(function (card) {
      try {
      if (card.dataset.cartBound === 'true') return;
      card.dataset.cartBound = 'true';

      var slug = card.getAttribute('data-slug') || '';
      if (!slug) {
        var linkPedido = card.querySelector('a[href*="/pedido?producto="]');
        if (linkPedido) {
          var m = linkPedido.getAttribute('href').match(/producto=([^&]+)/);
          if (m && m[1]) slug = decodeURIComponent(m[1]);
        }
      }
      if (!slug) {
        var btnCopy = card.querySelector('button[onclick*="copyProductoLink"]');
        if (btnCopy) {
          var mc = btnCopy.getAttribute('onclick').match(/\/producto\/([^'"]+)/);
          if (mc && mc[1]) slug = mc[1];
        }
      }
      if (!slug) return;
      card.setAttribute('data-slug', slug);

      var isRes = esProductoReserva(slug);
      var prefixNum = (slug.indexOf('adorno') !== -1 || slug.indexOf('elefant') !== -1 || slug.indexOf('jarron') !== -1) ? '24' : (slug.indexOf('plato') !== -1 ? '12' : (slug.indexOf('tetera') !== -1 || slug.indexOf('azucar') !== -1 ? '13' : '10'));
      var autoSku = (slug === 'taza-formula-1') ? '1028' : (prefixNum + String(seqCounter++).padStart(2, '0'));

      var titleEl = card.querySelector('h3, h4');
      var nombre = titleEl ? titleEl.textContent.trim() : slug;

      var precio = 59.90;
      var spans = card.querySelectorAll('span');
      for (var i = 0; i < spans.length; i++) {
        var txt = spans[i].textContent.trim();
        var mp = txt.match(/S\/\s*(\d+(?:\.\d+)?)/);
        if (mp && !spans[i].classList.contains('line-through')) {
          precio = parseFloat(mp[1]);
          break;
        }
      }

      var allImgs = [];
      card.querySelectorAll('img').forEach(function (im) {
        var s = im.getAttribute('src');
        if (s && allImgs.indexOf(s) === -1) allImgs.push(s);
      });

      var descEl = card.querySelector('p');
      var descripcion = descEl ? descEl.textContent.trim().replace(/\s+/g, ' ') : '';
      var cat = classifyCategoryBySlug(slug, nombre);

      var prodObj = {
        slug: slug,
        sku: autoSku,
        nombre: nombre,
        precio: precio,
        precio_regular: precio,
        reserva: isRes ? 20.00 : precio,
        modalidad: isRes ? 'reserva' : 'compra_directa',
        categoria: cat,
        agotado: false,
        imagenes: allImgs,
        descripcion: descripcion
      };
      registerProductInStore(prodObj);

      card.setAttribute('data-cat', cat);
      card.setAttribute('data-price', String(precio));
      card.setAttribute('data-name', nombre.toLowerCase());
      card.setAttribute('data-sku', autoSku);
      card.classList.add('bg-white', 'rounded-3xl', 'p-3.5', 'border', 'border-[#EBE5DE]', 'shadow-2xs', 'hover:shadow-md', 'transition-all');

      // 1. Limpiar por completo el contenedor de la imagen y habilitar click directo a la Ficha Quick-View
      var imgBox = card.querySelector('.relative.overflow-hidden');
      if (imgBox) {
        imgBox.classList.add('cursor-pointer');
        // Eliminar botones flotantes de WhatsApp, reserva o íconos superpuestos sobre la foto
        imgBox.querySelectorAll('a, .absolute.top-3.right-3, .absolute.bottom-3, .absolute.bottom-4').forEach(function (el) {
          el.remove();
        });
        // Asegurar que la capa de brillo hover no bloquee el click en la foto
        imgBox.querySelectorAll('.absolute.inset-0').forEach(function (ov) {
          ov.classList.add('pointer-events-none');
        });

        var downX = 0;
        var downY = 0;
        imgBox.addEventListener('pointerdown', function (e) {
          downX = e.clientX;
          downY = e.clientY;
        });
        imgBox.addEventListener('click', function (e) {
          if (e.target && e.target.closest && e.target.closest('button, a')) return;
          if (Math.abs((e.clientX || 0) - downX) > 12 || Math.abs((e.clientY || 0) - downY) > 12) return;
          window.ArtesanitasQuickView.open(slug);
        });
      }

      // 2. Reemplazar el cuerpo inferior por la estructura limpia estilo Saga Falabella
      var infoContainer = card.querySelector('.flex.flex-col.flex-grow');
      if (infoContainer) {
        infoContainer.outerHTML = buildFalabellaCardBodyHtml(prodObj);
      }
      } catch (cardErr) {
        if (window.console) console.warn('[Catalogo] tarjeta omitida:', cardErr && cardErr.message);
      }
    });
  }

  // ── Buscador en Vivo, Filtros por Categoría y Ordenamiento ──
  var activeCategory = 'todos';

  function applyCatalogFilters() {
    var searchInput = document.getElementById('catalog-search-input');
    var clearBtn = document.getElementById('catalog-search-clear');
    var sortSelect = document.getElementById('catalog-sort-select');
    var countLabel = document.getElementById('catalog-count-label');

    var q = searchInput ? searchInput.value.trim().toLowerCase() : '';
    if (clearBtn) clearBtn.classList.toggle('hidden', !q);

    var sortMode = sortSelect ? sortSelect.value : 'default';
    var catalogSection = document.getElementById('catalogo');
    if (!catalogSection) return;

    var grid = catalogSection.querySelector('.grid');
    var cards = Array.prototype.slice.call(catalogSection.querySelectorAll('[data-slug]'));
    var visibleCount = 0;

    cards.forEach(function (card) {
      if (card.dataset.paused === 'true') {
        card.style.display = 'none';
        return;
      }
      var slug = card.getAttribute('data-slug') || '';
      var cat = card.getAttribute('data-cat') || 'tazas';
      var colAttr = (card.getAttribute('data-coleccion') || '').toLowerCase();
      var name = card.getAttribute('data-name') || '';
      var sku = (card.getAttribute('data-sku') || '').toLowerCase();
      var prod = PRODUCTOS_STORE_MAP[slug] || {};
      var desc = (prod.descripcion || '').toLowerCase();
      var colProd = (prod.coleccion || colAttr || '').toLowerCase();

      var matchCat = (activeCategory === 'todos') ||
        (activeCategory === 'navidad' ? (colProd.indexOf('navid') !== -1 || slug.indexOf('navid') !== -1) : (cat === activeCategory));
      var matchQuery = !q || name.indexOf(q) !== -1 || slug.indexOf(q) !== -1 || sku.indexOf(q) !== -1 || desc.indexOf(q) !== -1 || colProd.indexOf(q) !== -1;

      if (matchCat && matchQuery) {
        card.style.display = '';
        visibleCount++;
      } else {
        card.style.display = 'none';
      }
    });

    if (grid && sortMode !== 'default') {
      var sorted = cards.slice().sort(function (a, b) {
        var pa = parseFloat(a.getAttribute('data-price') || '0');
        var pb = parseFloat(b.getAttribute('data-price') || '0');
        var na = a.getAttribute('data-name') || '';
        var nb = b.getAttribute('data-name') || '';
        if (sortMode === 'price-asc') return pa - pb;
        if (sortMode === 'price-desc') return pb - pa;
        if (sortMode === 'name-asc') return na.localeCompare(nb);
        return 0;
      });
      var dynBox = document.getElementById('productos-dinamicos');
      sorted.forEach(function (c) {
        if (dynBox && c.parentElement === dynBox) return;
        grid.insertBefore(c, dynBox || null);
      });
    }

    if (countLabel) {
      countLabel.textContent = 'Mostrando ' + visibleCount + ' ' + (visibleCount === 1 ? 'pieza artesanal' : 'piezas artesanales');
    }
  }

  function initStoreToolbar() {
    var searchInput = document.getElementById('catalog-search-input');
    var clearBtn = document.getElementById('catalog-search-clear');
    var sortSelect = document.getElementById('catalog-sort-select');
    var pills = document.querySelectorAll('.cat-filter-pill');

    if (searchInput) {
      searchInput.addEventListener('input', applyCatalogFilters);
    }
    if (clearBtn && searchInput) {
      clearBtn.addEventListener('click', function () {
        searchInput.value = '';
        applyCatalogFilters();
        searchInput.focus();
      });
    }
    if (sortSelect) {
      sortSelect.addEventListener('change', applyCatalogFilters);
    }
    pills.forEach(function (btn) {
      btn.addEventListener('click', function () {
        activeCategory = btn.getAttribute('data-cat') || 'todos';
        pills.forEach(function (p) {
          p.className = 'cat-filter-pill bg-[#F9F6F0] hover:bg-[#EBE5DE] text-[#4A3C31] border border-[#D5C9BD] text-xs font-semibold px-3.5 py-1.5 rounded-full transition-all cursor-pointer';
        });
        btn.className = 'cat-filter-pill bg-[#333c48] text-white text-xs font-bold px-3.5 py-1.5 rounded-full transition-all cursor-pointer';
        applyCatalogFilters();
      });
    });
  }

  function goToCatalogResults() {
    var sec = document.getElementById('catalog-toolbar') || document.getElementById('catalogo');
    if (sec) {
      var y = sec.getBoundingClientRect().top + window.pageYOffset - 150;
      window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
    }
  }

  function initHeaderSearch() {
    var main = document.getElementById('catalog-search-input');
    var clearMainBtn = document.getElementById('catalog-search-clear');
    var heroClearBtn = document.getElementById('hero-search-clear');
    var ids = ['hero-search-input', 'nav-search-input-m', 'nav-search-input'];

    function toggleHeroClear(value) {
      if (!heroClearBtn) return;
      var hasVal = Boolean(value && String(value).trim().length > 0);
      heroClearBtn.classList.toggle('hidden', !hasVal);
      heroClearBtn.classList.toggle('flex', hasVal);
    }

    function sync(value, origin) {
      ids.forEach(function (id) {
        var el = document.getElementById(id);
        if (el && el !== origin) el.value = value;
      });
      if (main && main !== origin) main.value = value;
      toggleHeroClear(value);
      applyCatalogFilters();
    }

    ids.forEach(function (id) {
      var input = document.getElementById(id);
      if (!input) return;
      input.addEventListener('input', function () { sync(input.value, input); });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); sync(input.value, input); goToCatalogResults(); input.blur(); }
      });
    });

    if (heroClearBtn) {
      heroClearBtn.addEventListener('click', function () {
        sync('', null);
        var heroInput = document.getElementById('hero-search-input');
        if (heroInput) heroInput.focus();
      });
    }

    var btnMap = {
      'hero-search-btn': 'hero-search-input',
      'nav-search-btn-m': 'nav-search-input-m',
      'nav-search-btn': 'nav-search-input'
    };
    Object.keys(btnMap).forEach(function (btnId) {
      var b = document.getElementById(btnId);
      if (!b) return;
      b.addEventListener('click', function () {
        var src = document.getElementById(btnMap[btnId]);
        if (src) sync(src.value, src);
        goToCatalogResults();
      });
    });

    document.querySelectorAll('.hero-search-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        var q = chip.getAttribute('data-query') || '';
        sync(q, null);
        goToCatalogResults();
      });
    });

    if (main) {
      main.addEventListener('input', function () {
        ids.forEach(function (id) { var el = document.getElementById(id); if (el) el.value = main.value; });
        toggleHeroClear(main.value);
      });
    }
    if (clearMainBtn) {
      clearMainBtn.addEventListener('click', function () {
        ids.forEach(function (id) { var el = document.getElementById(id); if (el) el.value = ''; });
        toggleHeroClear('');
      });
    }
  }

  window.ArtesanitasStore = {
    focusSearch: function () {
      var isMobile = window.matchMedia && window.matchMedia('(max-width: 767px)').matches;
      if (isMobile) {
        var mobEl = document.getElementById('nav-search-input-m') || document.getElementById('hero-search-input') || document.getElementById('catalog-search-input');
        if (mobEl) mobEl.focus();
        return;
      }
      var sec = document.getElementById('hero-search-bar');
      var heroEl = document.getElementById('hero-search-input') || document.getElementById('catalog-search-input');
      if (sec) {
        var y = sec.getBoundingClientRect().top + window.pageYOffset - 100;
        window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
      }
      if (heroEl) {
        setTimeout(function () { heroEl.focus(); }, 260);
      }
    }
  };

  try { injectCartButtonsOnStaticCards(); } catch (e1) { if (window.console) console.warn('[Catalogo] inject', e1); }
  try { initStoreToolbar(); } catch (e2) { if (window.console) console.warn('[Catalogo] toolbar', e2); }
  try { initHeaderSearch(); } catch (e3) { if (window.console) console.warn('[Catalogo] header search', e3); }
  try { updateCartUI(); } catch (e4) { if (window.console) console.warn('[Catalogo] cart', e4); }
  try { applyCatalogFilters(); } catch (e5) { if (window.console) console.warn('[Catalogo] filters', e5); }

  function cargarProductosDinamicos() {
    var contenedor = document.getElementById('productos-dinamicos');
    fetch('/api/negocios/artesanitas/productos')
      .then(function (res) { return res.ok ? res.json() : { productos: [] }; })
      .then(function (data) {
        var productos = (data && data.productos) || [];
        var nuevosDinamicos = [];
        productos.forEach(function (p) {
          var staticCard = document.querySelector('[data-slug="' + p.slug + '"]');
          var precioEf = (p.precio_oferta && Number(p.precio_oferta) > 0 && Number(p.precio_oferta) < Number(p.precio)) ? Number(p.precio_oferta) : Number(p.precio);
          var permiteSinStock = p.vender_sin_stock === true || p.politica_sin_stock === 'preventa';
          var isRes = esProductoReserva(p.slug, p.politica_sin_stock);
          var agotado = Number(p.stock_actual || 0) <= 0 && !permiteSinStock;
          registerProductInStore({
            slug: p.slug,
            sku: p.sku,
            nombre: cleanProductTitle(p.nombre),
            precio: precioEf,
            precio_regular: Number(p.precio),
            reserva: isRes ? 20.00 : precioEf,
            modalidad: isRes ? 'reserva' : 'compra_directa',
            stock_actual: Number(p.stock_actual || 0),
            vender_sin_stock: permiteSinStock,
            fecha_entrega_estimada: p.fecha_entrega_estimada || null,
            agotado: agotado,
            imagenes: Array.isArray(p.imagenes) && p.imagenes.length > 0 ? p.imagenes : undefined,
            descripcion: p.descripcion,
            tamano_dimensiones: p.tamano_dimensiones,
            color: p.color,
            caracteristicas: p.caracteristicas
          });
          if (staticCard) {
            if (p.sku) {
              staticCard.setAttribute('data-sku', p.sku);
              var skuBadge = staticCard.querySelector('[data-card-sku="' + p.slug + '"]');
              if (skuBadge) skuBadge.textContent = 'SKU ' + p.sku;
            }
          } else {
            nuevosDinamicos.push(p);
          }
        });
        if (contenedor) {
          contenedor.innerHTML = nuevosDinamicos.map(cardHtml).join('');
        }
        var navDinamicosBox = document.getElementById('coleccion-navidad-dinamicos');
        if (navDinamicosBox) {
          var navItems = nuevosDinamicos.filter(function (p) {
            return /navid/i.test(p.coleccion || '');
          });
          navDinamicosBox.innerHTML = navItems.map(cardHtml).join('');
        }
        refreshCardActionSlots();
        applyCatalogFilters();
      })
      .catch(function () { });
  }

  function ocultarProductosEstaticosPausados() {
    fetch('/api/negocios/artesanitas/productos-estaticos-pausados')
      .then(function (res) { return res.ok ? res.json() : { slugs: [] }; })
      .then(function (data) {
        var slugs = (data && data.slugs) || [];
        slugs.forEach(function (slug) {
          if (slug === 'taza-formula-1') return;
          var el = document.querySelector('[data-slug="' + slug + '"]');
          if (el) {
            el.dataset.paused = 'true';
            el.style.display = 'none';
          }
        });
        applyCatalogFilters();
      })
      .catch(function () { });
  }

  cargarProductosDinamicos();
  ocultarProductosEstaticosPausados();

  // Sprint 6: Registrar Service Worker PWA
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function () {});
    });
  }

  // Sprint 7: Motor White-Label (brand.config.json)
  fetch('/api/negocios/artesanitas/brand-config')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) {
      if (!data || !data.brand) return;
      window.ARTESANITAS_BRAND = data.brand;
      if (data.brand.whatsapp) {
        WHATSAPP_NUM = String(data.brand.whatsapp).replace(/\D/g, '') || WHATSAPP_NUM;
      }
      if (data.brand.colores && data.brand.colores.primario) {
        document.documentElement.style.setProperty('--brand-primario', data.brand.colores.primario);
      }
    })
    .catch(function () {});
})();
