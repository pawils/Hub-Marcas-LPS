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

// Comparte el link de un producto: usa el share sheet nativo del dispositivo
// (WhatsApp, Instagram, etc.) si está disponible; si no, copia el link al portapapeles.
function shareProducto(path, nombre) {
  var url = window.location.origin + path;
  if (navigator.share) {
    navigator.share({ title: nombre, text: 'Mira esta pieza de Artesanitas: ' + nombre, url: url }).catch(function () { });
    return;
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(showShareToast).catch(function () {
      window.open(url, '_blank');
    });
    return;
  }
  window.open(url, '_blank');
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

  function cardHtml(p) {
    var img = resolverFotoProducto(p);
    var path = '/producto/' + p.slug;
    var nombre = escapeHtml(p.nombre);
    var nombreJs = nombre.replace(/'/g, "\\'");
    var hasPromo = p.precio_oferta && Number(p.precio_oferta) > 0 && Number(p.precio_oferta) < Number(p.precio);
    var stockNum = Number(p.stock_actual || 0);
    var agotado = stockNum <= 0 && p.politica_sin_stock === 'agotado';
    var promoBadge = hasPromo
      ? '<span class="bg-[#008f6b] text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow">' + escapeHtml(p.etiqueta_promo || 'Oferta') + '</span>'
      : (p.etiqueta_promo ? '<span class="bg-[#B87352] text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow">' + escapeHtml(p.etiqueta_promo) + '</span>' : '');
    var isRes = esProductoReserva(p.slug, p.politica_sin_stock);
    var stockBadge = stockNum > 0
      ? '<span class="bg-white/90 backdrop-blur-sm text-[#008f6b] text-[10px] font-bold px-2.5 py-1 rounded-full shadow">En Stock (' + stockNum + ')</span>'
      : (agotado
          ? '<span class="bg-red-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow">Agotado</span>'
          : (isRes ? '<span class="bg-white/90 backdrop-blur-sm text-[#4A3C31] text-[10px] font-semibold px-2.5 py-1 rounded-full shadow">Preventa · S/ 20</span>' : '<span class="bg-white/90 backdrop-blur-sm text-[#007A78] text-[10px] font-bold px-2.5 py-1 rounded-full shadow">Compra Directa</span>'));
    var precioHtml = hasPromo
      ? '<div class="text-right shrink-0"><span class="text-xs line-through text-[#8C7A6B] block">S/ ' + Number(p.precio).toFixed(2) + '</span><span class="font-bold text-[#008f6b]">S/ ' + Number(p.precio_oferta).toFixed(2) + '</span></div>'
      : '<span class="font-bold text-[#B87352] shrink-0">S/ ' + Number(p.precio).toFixed(2) + '</span>';
    var fichaSpecs = [];
    if (p.sku) fichaSpecs.push('SKU: ' + escapeHtml(p.sku));
    if (p.tamano_dimensiones) fichaSpecs.push(escapeHtml(p.tamano_dimensiones));
    if (p.color) fichaSpecs.push('Color: ' + escapeHtml(p.color));
    if (p.caracteristicas) fichaSpecs.push(escapeHtml(p.caracteristicas));
    var specsHtml = fichaSpecs.length > 0
      ? '<p class="text-xs text-[#B87352] font-medium mt-1.5">' + fichaSpecs.join(' · ') + '</p>'
      : '';
    var precioEfectivo = hasPromo ? Number(p.precio_oferta) : Number(p.precio);
    var reservaUnit = isRes ? 20.00 : precioEfectivo;
    var modalidadStr = isRes ? 'reserva' : 'compra_directa';
    var imgJs = escapeHtml(img).replace(/'/g, "\\'");
    var slugJs = escapeHtml(p.slug).replace(/'/g, "\\'");
    var imgsList = (Array.isArray(p.imagenes) && p.imagenes.length > 0) ? p.imagenes : [img];

    // Registrar en el diccionario de Quick-View
    registerProductInStore({
      slug: p.slug,
      sku: p.sku || '',
      nombre: p.nombre,
      precio: precioEfectivo,
      reserva: reservaUnit,
      modalidad: modalidadStr,
      stock_actual: stockNum,
      agotado: agotado,
      imagenes: imgsList,
      descripcion: p.descripcion || '',
      tamano_dimensiones: p.tamano_dimensiones || '',
      color: p.color || '',
      caracteristicas: p.caracteristicas || ''
    });

    return '' +
      '<div class="group flex flex-col space-y-5" data-slug="' + escapeHtml(p.slug) + '">' +
      '<div class="relative aspect-[4/5] overflow-hidden rounded-2xl bg-[#EBE5DE]">' +
      '<img src="' + escapeHtml(img) + '" alt="' + nombre + '" loading="lazy" onclick="window.ArtesanitasQuickView && window.ArtesanitasQuickView.open(\'' + slugJs + '\')" onerror="this.onerror=null; this.src=\'/imagenes/Artesanitas/logo_artesanitas.peru.jpg\';" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 cursor-pointer" />' +
      '<div class="absolute inset-0 bg-[#4A3C31]/0 group-hover:bg-[#4A3C31]/10 transition-colors duration-300 pointer-events-none"></div>' +
      '<div class="absolute top-3 left-3 z-10 flex flex-col gap-1.5 items-start pointer-events-none">' + promoBadge + stockBadge + '</div>' +
      '<div class="absolute top-3 right-3 z-10 flex flex-col gap-2">' +
      '<button type="button" onclick="window.ArtesanitasQuickView && window.ArtesanitasQuickView.open(\'' + slugJs + '\')" class="w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow hover:bg-white transition-all cursor-pointer" title="Ver Ficha y Detalles del Producto" aria-label="Ver Ficha">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5 text-[#4A3C31]"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>' +
      '</button>' +
      '<button type="button" onclick="copyProductoLink(\'' + path + '\')" class="w-8 h-8 rounded-full bg-white/85 backdrop-blur-sm flex items-center justify-center shadow hover:bg-white transition-all cursor-pointer" title="Copiar link de este producto" aria-label="Copiar link de este producto">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5 text-[#4A3C31]"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>' +
      '</button>' +
      '<button type="button" onclick="shareProducto(\'' + path + '\', \'' + nombreJs + '\')" class="w-8 h-8 rounded-full bg-white/85 backdrop-blur-sm flex items-center justify-center shadow hover:bg-white transition-all cursor-pointer" title="Compartir este producto" aria-label="Compartir este producto">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5 text-[#4A3C31]"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>' +
      '</button>' +
      '</div>' +
      (agotado ? '' : '<div class="absolute bottom-3 left-3 right-3 z-10 flex flex-col gap-1.5 opacity-100 translate-y-0 md:opacity-0 md:translate-y-4 md:group-hover:opacity-100 md:group-hover:translate-y-0 transition-all duration-300">' +
      '<button type="button" onclick="window.ArtesanitasCart.addItem({slug:\'' + slugJs + '\',nombre:\'' + nombreJs + '\',precio:' + precioEfectivo.toFixed(2) + ',reserva:' + reservaUnit.toFixed(2) + ',modalidad:\'' + modalidadStr + '\',imagen:\'' + imgJs + '\'}, this)" class="w-full bg-[#4A3C31] hover:bg-[#322821] text-white py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold shadow-lg transition-all cursor-pointer">' +
      '<span>' + (isRes ? '+ Agregar a mi reserva' : '+ Agregar al Carrito') + '</span>' +
      '</button>' +
      '<a href="/pedido?producto=' + encodeURIComponent(p.slug) + (isRes ? '' : '&modo=compra') + '" class="w-full bg-[#B87352] hover:bg-[#A36244] text-white py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 text-xs font-semibold shadow transition-all">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg> ' + (isRes ? 'Reservar ahora (S/ 20)' : 'Comprar Ahora (S/ ' + precioEfectivo.toFixed(2) + ')') +
      '</a>' +
      '</div>') +
      '</div>' +
      '<div class="flex flex-col flex-grow">' +
      '<div class="flex justify-between items-start gap-4 mb-1.5">' +
      '<h3 onclick="window.ArtesanitasQuickView && window.ArtesanitasQuickView.open(\'' + slugJs + '\')" class="font-serif text-lg font-medium text-[#4A3C31] hover:text-[#B87352] leading-tight cursor-pointer transition-colors">' + nombre + '</h3>' +
      precioHtml +
      '</div>' +
      '<p class="text-sm text-[#8C7A6B] leading-relaxed whitespace-pre-line line-clamp-2">' + escapeHtml(p.descripcion || '') + '</p>' +
      specsHtml +
      '<div class="mt-3 grid grid-cols-2 gap-2">' +
      '<button type="button" onclick="window.ArtesanitasQuickView && window.ArtesanitasQuickView.open(\'' + slugJs + '\')" class="py-2 px-3 rounded-xl border border-[#D5C9BD] bg-white hover:bg-[#F9F6F0] text-[#4A3C31] text-xs font-semibold transition-all flex items-center justify-center gap-1 cursor-pointer">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5 text-[#B87352]"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg> Ver Detalles' +
      '</button>' +
      (agotado ? '<span class="py-2 px-3 rounded-xl bg-red-50 text-red-700 text-xs font-bold text-center">Agotado</span>' :
      '<button type="button" onclick="window.ArtesanitasCart.addItem({slug:\'' + slugJs + '\',nombre:\'' + nombreJs + '\',precio:' + precioEfectivo.toFixed(2) + ',reserva:' + reservaUnit.toFixed(2) + ',modalidad:\'' + modalidadStr + '\',imagen:\'' + imgJs + '\'}, this)" class="py-2 px-3 rounded-xl border border-[#B87352]/40 bg-[#B87352]/10 hover:bg-[#B87352] text-[#B87352] hover:text-white text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer">' +
      '<span>' + (isRes ? '+ Reservar' : '+ Al Carrito') + '</span>' +
      '</button>') +
      '</div>' +
      '</div>' +
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

  // Diccionario global de productos para Vista Rápida (Shopify Quick-View)
  var PRODUCTOS_STORE_MAP = {};

  function registerProductInStore(data) {
    if (!data || !data.slug) return;
    var existing = PRODUCTOS_STORE_MAP[data.slug] || {};
    PRODUCTOS_STORE_MAP[data.slug] = {
      slug: data.slug,
      sku: data.sku || existing.sku || '1001',
      nombre: data.nombre || existing.nombre || data.slug,
      precio: Number(data.precio || existing.precio || 59.90),
      reserva: Number(data.reserva || existing.reserva || 59.90),
      modalidad: data.modalidad || existing.modalidad || (esProductoReserva(data.slug) ? 'reserva' : 'compra_directa'),
      stock_actual: data.stock_actual !== undefined ? Number(data.stock_actual) : (existing.stock_actual !== undefined ? existing.stock_actual : 5),
      agotado: Boolean(data.agotado),
      imagenes: (Array.isArray(data.imagenes) && data.imagenes.length > 0) ? data.imagenes : (existing.imagenes || ['/imagenes/Artesanitas/logo_artesanitas.peru.jpg']),
      descripcion: data.descripcion || existing.descripcion || 'Pieza artesanal modelada y esmaltada a mano en cerámica de alta temperatura.',
      tamano_dimensiones: data.tamano_dimensiones || existing.tamano_dimensiones || '12 oz (350 ml) · Medida estándar artesanal',
      color: data.color || existing.color || 'Esmaltado artesanal pintado a mano',
      caracteristicas: data.caracteristicas || existing.caracteristicas || 'Apto para bebidas calientes · Envío seguro a todo el Perú'
    };
  }

  // ── Modal Vista Rápida (Shopify Quick-View) ──
  var qvCurrentSlug = null;
  var qvCurrentQty = 1;

  window.ArtesanitasQuickView = {
    open: function (slug) {
      var prod = PRODUCTOS_STORE_MAP[slug];
      if (!prod) return;
      qvCurrentSlug = slug;
      qvCurrentQty = 1;

      var modal = document.getElementById('product-quickview-modal');
      if (!modal) return;

      var isRes = prod.modalidad === 'reserva';
      document.getElementById('qv-sku').textContent = 'SKU: ' + (prod.sku || '1001');
      document.getElementById('qv-title').textContent = prod.nombre;
      document.getElementById('qv-price').textContent = 'S/ ' + Number(prod.precio).toFixed(2);
      document.getElementById('qv-desc').textContent = prod.descripcion;
      document.getElementById('qv-qty').textContent = '1';
      document.getElementById('qv-link-pdp').href = '/producto/' + encodeURIComponent(prod.slug);
      document.getElementById('qv-link-wa').href = waLink(prod.nombre + ' (SKU ' + (prod.sku || '') + ')');

      var modeBadge = document.getElementById('qv-mode-badge');
      var stockBadge = document.getElementById('qv-stock-badge');
      var payHint = document.getElementById('qv-payment-hint');
      var btnAddTxt = document.getElementById('qv-btn-add-text');
      var btnBuyTxt = document.getElementById('qv-btn-buy-text');

      if (isRes) {
        modeBadge.textContent = 'Colección en Preventa';
        modeBadge.className = 'bg-[#B87352] text-white text-[10px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full shadow';
        stockBadge.textContent = 'Reserva hoy con S/ 20.00';
        payHint.textContent = 'Reserva con S/ 20.00 · Saldo al entregar';
        btnAddTxt.textContent = 'Agregar a Mi Reserva';
        btnBuyTxt.textContent = 'Reservar Ahora (S/ 20)';
      } else {
        modeBadge.textContent = 'Compra Directa Online';
        modeBadge.className = 'bg-[#007A78] text-white text-[10px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full shadow';
        stockBadge.textContent = prod.stock_actual > 0 ? ('En Stock (' + prod.stock_actual + ' disp.) · Envío Inmediato') : 'Disponible para Despacho';
        payHint.textContent = 'Pago 100% Online · Descarga Automática de Stock';
        btnAddTxt.textContent = 'Agregar al Carrito';
        btnBuyTxt.textContent = 'Comprar Ahora (S/ ' + Number(prod.precio).toFixed(2) + ')';
      }

      var specsEl = document.getElementById('qv-specs');
      if (specsEl) {
        specsEl.innerHTML =
          '<div class="flex items-center justify-between"><span class="text-[#8C7A6B]">Código SKU:</span><span class="font-mono font-bold">' + escapeHtml(prod.sku || '1001') + '</span></div>' +
          '<div class="flex items-center justify-between"><span class="text-[#8C7A6B]">Medidas / Capacidad:</span><span class="font-semibold">' + escapeHtml(prod.tamano_dimensiones) + '</span></div>' +
          '<div class="flex items-center justify-between"><span class="text-[#8C7A6B]">Acabado / Color:</span><span class="font-semibold">' + escapeHtml(prod.color) + '</span></div>' +
          '<div class="flex items-center justify-between"><span class="text-[#8C7A6B]">Detalle:</span><span class="font-semibold">' + escapeHtml(prod.caracteristicas) + '</span></div>' +
          '<div class="flex items-center justify-between"><span class="text-[#8C7A6B]">Logística:</span><span class="font-semibold">Envío Shalom (S/ 10) o Recojo en Trujillo</span></div>';
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
        window.location.href = '/pedido?producto=' + encodeURIComponent(prod.slug) + (isRes ? '' : '&modo=compra');
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

  // ── Sprint 1: Carrito Persistente Dual (Compra Directa 100% + Reserva Preventa S/ 20) ──
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

  function updateCartUI() {
    var floatingBar = document.getElementById('cart-floating-bar');
    var bubbleBadge = document.getElementById('cart-bubble-badge');
    var bubbleText = document.getElementById('cart-bubble-text');
    var drawerItemsEl = document.getElementById('cart-drawer-items');
    var drawerSubtotalEl = document.getElementById('cart-drawer-subtotal');
    var drawerReservaEl = document.getElementById('cart-drawer-reserva');
    var drawerSubtitleEl = document.getElementById('cart-drawer-subtitle');
    var drawerPayLabel = document.getElementById('cart-drawer-pay-label');
    var drawerCtaLabel = document.getElementById('cart-drawer-cta-label');

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
    if (bubbleText) {
      bubbleText.textContent = 'Mi Carrito (' + totalPiezas + ' ' + (totalPiezas === 1 ? 'pieza' : 'piezas') + ' · S/ ' + totalPrecio.toFixed(2) + ')';
    }
    if (drawerSubtotalEl) drawerSubtotalEl.textContent = 'S/ ' + totalPrecio.toFixed(2);
    if (drawerReservaEl) drawerReservaEl.textContent = 'S/ ' + totalPagarHoy.toFixed(2);
    if (drawerPayLabel) {
      drawerPayLabel.textContent = (totalPagarHoy >= totalPrecio)
        ? 'Total a pagar hoy (Compra 100%):'
        : 'Monto a abonar hoy (Compra + Reserva):';
    }
    if (drawerCtaLabel) {
      drawerCtaLabel.textContent = tieneCompraDirecta ? 'Proceder al Pago / Checkout' : 'Completar mi Reserva Ahora';
    }
    if (drawerSubtitleEl) {
      drawerSubtitleEl.textContent = totalPiezas > 0
        ? totalPiezas + ' ' + (totalPiezas === 1 ? 'pieza en tu carrito' : 'piezas en tu carrito') + ' · Descarga de stock automática'
        : 'Tu carrito está vacío';
    }

    if (drawerItemsEl) {
      if (cartItems.length === 0) {
        drawerItemsEl.innerHTML =
          '<div class="text-center py-12 px-4 space-y-3">' +
          '<div class="w-14 h-14 rounded-full bg-[#EBE5DE] text-[#8C7A6B] flex items-center justify-center mx-auto"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="w-7 h-7"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg></div>' +
          '<p class="text-sm font-bold text-[#4A3C31]">Tu carrito está vacío</p>' +
          '<p class="text-xs text-[#8C7A6B]">Agrega piezas de Compra Directa o de Preventa para finalizar tu pedido online.</p>' +
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
            '<span class="text-[10px] font-semibold ' + (esRes ? 'text-[#B87352]' : 'text-[#007A78]') + ' block">' +
            (esRes ? ('Preventa · Adelanto: S/ ' + hoyItem.toFixed(2)) : ('Compra Directa · Pago: S/ ' + hoyItem.toFixed(2))) +
            '</span>' +
            '</div>' +
            '</div>' +
            '<div class="flex flex-col items-end gap-1.5 shrink-0">' +
            '<span class="text-xs font-bold text-[#4A3C31]">S/ ' + subItem.toFixed(2) + '</span>' +
            '<div class="flex items-center gap-1 bg-[#F9F6F0] rounded-xl border border-[#D5C9BD] p-0.5">' +
            '<button type="button" onclick="window.ArtesanitasCart.changeQty(\'' + slugAttr + '\', -1)" class="w-6 h-6 rounded-lg bg-white hover:bg-[#B87352] hover:text-white text-[#4A3C31] font-bold text-xs flex items-center justify-center transition-colors cursor-pointer">−</button>' +
            '<span class="w-6 text-center font-bold text-xs text-[#4A3C31]">' + Number(item.cantidad) + '</span>' +
            '<button type="button" onclick="window.ArtesanitasCart.changeQty(\'' + slugAttr + '\', 1)" class="w-6 h-6 rounded-lg bg-white hover:bg-[#B87352] hover:text-white text-[#4A3C31] font-bold text-xs flex items-center justify-center transition-colors cursor-pointer">+</button>' +
            '</div>' +
            '</div>' +
            '</div>';
        }).join('');
      }
    }
  }

  window.ArtesanitasCart = {
    addItem: function (prod, btnEl) {
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

      if (btnEl) {
        var prevHtml = btnEl.innerHTML;
        btnEl.innerHTML = '<span class="flex items-center justify-center gap-1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-3.5 h-3.5"><polyline points="20 6 9 17 4 12"/></svg> ¡Agregado!</span>';
        btnEl.classList.add('bg-[#007A78]', 'text-white', 'border-[#007A78]');
        setTimeout(function () {
          btnEl.innerHTML = prevHtml;
          btnEl.classList.remove('bg-[#007A78]', 'border-[#007A78]');
        }, 1200);
      }
      showShareToast(esRes ? 'Pieza agregada a Mi Reserva' : 'Pieza agregada al Carrito de Compra');
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

  // Inyecta Vista Rápida (Quick-View), SKU Numérico y Compra Directa / Reserva en todas las tarjetas del catálogo
  function injectCartButtonsOnStaticCards() {
    var cards = document.querySelectorAll('#coleccion-navidad .group, #catalogo [data-slug], #coleccion-van-gogh .group');
    var seqCounter = 1;

    cards.forEach(function (card) {
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
      var autoSku = prefixNum + String(seqCounter++).padStart(2, '0');

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
      var imagen = allImgs[0] || '/imagenes/Artesanitas/logo_artesanitas.peru.jpg';

      var descEl = card.querySelector('p');
      var descripcion = descEl ? descEl.textContent.trim().replace(/\s+/g, ' ') : '';

      registerProductInStore({
        slug: slug,
        sku: autoSku,
        nombre: nombre,
        precio: precio,
        reserva: isRes ? 20.00 : precio,
        modalidad: isRes ? 'reserva' : 'compra_directa',
        imagenes: allImgs,
        descripcion: descripcion
      });

      // Hacer que el título abra el modal Vista Rápida
      if (titleEl) {
        titleEl.classList.add('cursor-pointer', 'hover:text-[#B87352]', 'transition-colors');
        titleEl.title = 'Ver ficha completa y detalles del producto';
        titleEl.addEventListener('click', function () {
          window.ArtesanitasQuickView.open(slug);
        });
      }

      // Agregar botón de Vista Rápida (ojo) junto a copiar/compartir
      var topRightBar = card.querySelector('.absolute.top-3.right-3');
      if (topRightBar && !topRightBar.querySelector('.btn-qv-eye')) {
        var eyeBtn = document.createElement('button');
        eyeBtn.type = 'button';
        eyeBtn.className = 'btn-qv-eye w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow hover:bg-white transition-all cursor-pointer';
        eyeBtn.title = 'Vista Rápida y Ficha Técnica';
        eyeBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5 text-[#4A3C31]"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
        eyeBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          window.ArtesanitasQuickView.open(slug);
        });
        topRightBar.insertBefore(eyeBtn, topRightBar.firstChild);
      }

      var infoContainer = card.querySelector('.flex.flex-col.flex-grow');
      if (infoContainer) {
        // Mostrar badge de SKU numérico y modalidad
        var metaRow = document.createElement('div');
        metaRow.className = 'flex items-center justify-between gap-2 mt-2 pt-2 border-t border-[#EBE5DE]/70 text-[11px]';
        metaRow.innerHTML =
          '<span class="font-mono font-bold text-[#8C7A6B] bg-[#F9F6F0] px-2 py-0.5 rounded border border-[#EBE5DE]" data-card-sku="' + slug + '">SKU: ' + autoSku + '</span>' +
          '<button type="button" class="btn-card-ver-ficha font-bold text-[#B87352] hover:underline flex items-center gap-1 cursor-pointer">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3 h-3"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>' +
          '<span>Ver Ficha y Detalles</span>' +
          '</button>';
        metaRow.querySelector('.btn-card-ver-ficha').addEventListener('click', function () {
          window.ArtesanitasQuickView.open(slug);
        });
        infoContainer.appendChild(metaRow);

        var actionGrid = document.createElement('div');
        actionGrid.className = 'mt-2.5 grid grid-cols-2 gap-2';

        var btnAdd = document.createElement('button');
        btnAdd.type = 'button';
        btnAdd.className = 'py-2.5 px-3 rounded-xl border border-[#4A3C31] bg-[#4A3C31] hover:bg-[#322821] text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs';
        btnAdd.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg><span>' + (isRes ? '+ Mi Reserva' : '+ Al Carrito') + '</span>';
        btnAdd.addEventListener('click', function () {
          var currentData = PRODUCTOS_STORE_MAP[slug] || {};
          window.ArtesanitasCart.addItem({
            slug: slug,
            sku: currentData.sku || autoSku,
            nombre: currentData.nombre || nombre,
            precio: currentData.precio || precio,
            reserva: isRes ? 20.00 : (currentData.precio || precio),
            modalidad: isRes ? 'reserva' : 'compra_directa',
            imagen: imagen
          }, btnAdd);
        });

        var btnBuyNow = document.createElement('a');
        btnBuyNow.href = '/pedido?producto=' + encodeURIComponent(slug) + (isRes ? '' : '&modo=compra');
        btnBuyNow.className = 'py-2.5 px-3 rounded-xl bg-[#B87352] hover:bg-[#A36244] text-white text-xs font-bold transition-all flex items-center justify-center gap-1 shadow-2xs text-center';
        btnBuyNow.innerHTML = '<span>' + (isRes ? 'Reservar (S/ 20)' : 'Comprar Ahora') + '</span>';

        actionGrid.appendChild(btnAdd);
        actionGrid.appendChild(btnBuyNow);
        infoContainer.appendChild(actionGrid);
      }
    });
  }

  injectCartButtonsOnStaticCards();
  updateCartUI();

  function cargarProductosDinamicos() {
    var contenedor = document.getElementById('productos-dinamicos');
    fetch('/api/negocios/artesanitas/productos')
      .then(function (res) { return res.ok ? res.json() : { productos: [] }; })
      .then(function (data) {
        var productos = (data && data.productos) || [];
        var nuevosDinamicos = [];
        productos.forEach(function (p) {
          // Si el producto ya existe como tarjeta estática en el DOM, sincronizar su SKU numérico, stock y ficha
          var staticCard = document.querySelector('[data-slug="' + p.slug + '"]');
          var precioEf = (p.precio_oferta && Number(p.precio_oferta) > 0 && Number(p.precio_oferta) < Number(p.precio)) ? Number(p.precio_oferta) : Number(p.precio);
          var isRes = esProductoReserva(p.slug, p.politica_sin_stock);
          registerProductInStore({
            slug: p.slug,
            sku: p.sku,
            nombre: p.nombre,
            precio: precioEf,
            reserva: isRes ? 20.00 : precioEf,
            modalidad: isRes ? 'reserva' : 'compra_directa',
            stock_actual: Number(p.stock_actual || 0),
            agotado: Number(p.stock_actual || 0) <= 0 && p.politica_sin_stock === 'agotado',
            imagenes: Array.isArray(p.imagenes) && p.imagenes.length > 0 ? p.imagenes : undefined,
            descripcion: p.descripcion,
            tamano_dimensiones: p.tamano_dimensiones,
            color: p.color,
            caracteristicas: p.caracteristicas
          });
          if (staticCard) {
            var skuBadge = staticCard.querySelector('[data-card-sku="' + p.slug + '"]');
            if (skuBadge && p.sku) skuBadge.textContent = 'SKU: ' + p.sku;
          } else {
            nuevosDinamicos.push(p);
          }
        });
        if (contenedor) {
          contenedor.innerHTML = nuevosDinamicos.map(cardHtml).join('');
        }
      })
      .catch(function () { });
  }

  function ocultarProductosEstaticosPausados() {
    fetch('/api/negocios/artesanitas/productos-estaticos-pausados')
      .then(function (res) { return res.ok ? res.json() : { slugs: [] }; })
      .then(function (data) {
        var slugs = (data && data.slugs) || [];
        slugs.forEach(function (slug) {
          var el = document.querySelector('[data-slug="' + slug + '"]');
          if (el) el.style.display = 'none';
        });
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
