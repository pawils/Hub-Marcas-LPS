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

function showShareToast() {
  var toast = document.getElementById('share-toast');
  if (!toast) return;
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
    var path = '/artesanitas/producto/' + p.slug;
    var nombre = escapeHtml(p.nombre);
    var nombreJs = nombre.replace(/'/g, "\\'");
    var hasPromo = p.precio_oferta && Number(p.precio_oferta) > 0 && Number(p.precio_oferta) < Number(p.precio);
    var stockNum = Number(p.stock_actual || 0);
    var agotado = stockNum <= 0 && p.politica_sin_stock === 'agotado';
    var promoBadge = hasPromo
      ? '<span class="bg-[#008f6b] text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow">' + escapeHtml(p.etiqueta_promo || 'Oferta') + '</span>'
      : (p.etiqueta_promo ? '<span class="bg-[#B87352] text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow">' + escapeHtml(p.etiqueta_promo) + '</span>' : '');
    var stockBadge = stockNum > 0
      ? '<span class="bg-white/90 backdrop-blur-sm text-[#008f6b] text-[10px] font-bold px-2.5 py-1 rounded-full shadow">En Stock (' + stockNum + ')</span>'
      : (agotado
          ? '<span class="bg-red-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow">Agotado</span>'
          : '<span class="bg-white/90 backdrop-blur-sm text-[#4A3C31] text-[10px] font-semibold px-2.5 py-1 rounded-full shadow">A pedido / Preventa</span>');
    var precioHtml = hasPromo
      ? '<div class="text-right shrink-0"><span class="text-xs line-through text-[#8C7A6B] block">S/ ' + Number(p.precio).toFixed(2) + '</span><span class="font-bold text-[#008f6b]">S/ ' + Number(p.precio_oferta).toFixed(2) + '</span></div>'
      : '<span class="font-bold text-[#B87352] shrink-0">S/ ' + Number(p.precio).toFixed(2) + '</span>';
    var fichaSpecs = [];
    if (p.tamano_dimensiones) fichaSpecs.push(escapeHtml(p.tamano_dimensiones));
    if (p.color) fichaSpecs.push('Color: ' + escapeHtml(p.color));
    if (p.caracteristicas) fichaSpecs.push(escapeHtml(p.caracteristicas));
    var specsHtml = fichaSpecs.length > 0
      ? '<p class="text-xs text-[#B87352] font-medium mt-1.5">' + fichaSpecs.join(' · ') + '</p>'
      : '';
    return '' +
      '<div class="group flex flex-col space-y-5">' +
      '<div class="relative aspect-[4/5] overflow-hidden rounded-2xl bg-[#EBE5DE]">' +
      '<img src="' + escapeHtml(img) + '" alt="' + nombre + '" loading="lazy" onerror="this.onerror=null; this.src=\'/imagenes/Artesanitas/logo_artesanitas.peru.jpg\';" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />' +
      '<div class="absolute inset-0 bg-[#4A3C31]/0 group-hover:bg-[#4A3C31]/10 transition-colors duration-300"></div>' +
      '<div class="absolute top-3 left-3 z-10 flex flex-col gap-1.5 items-start">' + promoBadge + stockBadge + '</div>' +
      '<div class="absolute top-3 right-3 z-10 flex flex-col gap-2">' +
      '<button type="button" onclick="copyProductoLink(\'' + path + '\')" class="w-8 h-8 rounded-full bg-white/85 backdrop-blur-sm flex items-center justify-center shadow hover:bg-white transition-all cursor-pointer" title="Copiar link de este producto" aria-label="Copiar link de este producto">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5 text-[#4A3C31]"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>' +
      '</button>' +
      '<button type="button" onclick="shareProducto(\'' + path + '\', \'' + nombreJs + '\')" class="w-8 h-8 rounded-full bg-white/85 backdrop-blur-sm flex items-center justify-center shadow hover:bg-white transition-all cursor-pointer" title="Compartir este producto" aria-label="Compartir este producto">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5 text-[#4A3C31]"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>' +
      '</button>' +
      '</div>' +
      (agotado ? '' : '<a href="/artesanitas/pedido?producto=' + encodeURIComponent(p.slug) + '" class="absolute bottom-4 left-4 right-4 bg-[#F9F6F0]/95 backdrop-blur-sm text-[#4A3C31] py-3.5 rounded-xl flex items-center justify-center gap-2 opacity-100 translate-y-0 md:opacity-0 md:translate-y-4 md:group-hover:opacity-100 md:group-hover:translate-y-0 transition-all duration-300 font-medium shadow-lg hover:bg-[#B87352] hover:text-white z-10">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg> ' + (stockNum > 0 ? 'Comprar Online' : 'Reservar Pieza') +
      '</a>') +
      '</div>' +
      '<div class="flex flex-col flex-grow">' +
      '<div class="flex justify-between items-start gap-4 mb-2">' +
      '<h3 class="font-serif text-lg font-medium text-[#4A3C31] leading-tight">' + nombre + '</h3>' +
      precioHtml +
      '</div>' +
      '<p class="text-sm text-[#8C7A6B] leading-relaxed whitespace-pre-line">' + escapeHtml(p.descripcion || '') + '</p>' +
      specsHtml +
      '</div>' +
      '</div>';
  }

  function cargarProductosDinamicos() {
    var contenedor = document.getElementById('productos-dinamicos');
    if (!contenedor) return;
    fetch('/api/negocios/artesanitas/productos')
      .then(function (res) { return res.ok ? res.json() : { productos: [] }; })
      .then(function (data) {
        var productos = (data && data.productos) || [];
        contenedor.innerHTML = productos.map(cardHtml).join('');
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
})();
