// public/js/checkout.js
// Módulo Dedicado de Checkout Venta Directa E-Commerce 2026 — Artesanitas Perú
// Embudos Meta Pixel: InitiateCheckout -> Lead (captura de contacto) -> Purchase (100% + CAPI 1:1)
// Con descarga automática de stock en PostgreSQL y generación automática de Comprobante PDF.

(function () {
  'use strict';

  var NEGOCIO = 'artesanitas';
  var CART_STORAGE_KEY = 'artesanitas_cart_v1';
  var CUSTOMER_STORAGE_KEY = 'artesanitas_customer_v1';

  var CATALOGO_BASE = {
    'taza-formula-1': { slug: 'taza-formula-1', sku: '1028', nombre: 'Taza Fórmula 1', precio: 69.00, imagen: '/imagenes/Artesanitas/Fotos/taza_formula1_1.jpg' },
    'taza-corazon-y-plato': { slug: 'taza-corazon-y-plato', sku: '1105', nombre: 'Taza corazón y plato', precio: 75.00, imagen: '/imagenes/Artesanitas/Fotos/taza_corazón_y_ plato.jpeg' },
    'taza-castellana': { slug: 'taza-castellana', sku: '1006', nombre: 'Taza Castellana', precio: 55.00, imagen: '/imagenes/Artesanitas/Fotos/taza_castellana.jpeg' },
    'taza-lavanda-abejita': { slug: 'taza-lavanda-abejita', sku: '1007', nombre: 'Taza lavanda abejita', precio: 55.00, imagen: '/imagenes/Artesanitas/Fotos/taza_lavanda_abejita.jpeg' },
    'taza-stich-celeste': { slug: 'taza-stich-celeste', sku: '1008', nombre: 'Taza Stich celeste', precio: 65.00, imagen: '/imagenes/Artesanitas/Fotos/Taza_Stich_sin_plato_1.jpeg' },
    'taza-stich-azul': { slug: 'taza-stich-azul', sku: '1009', nombre: 'Taza Stich azul', precio: 65.00, imagen: '/imagenes/Artesanitas/Fotos/taza_stich_1.jpeg' },
    'taza-runner': { slug: 'taza-runner', sku: '1010', nombre: 'Taza Runner', precio: 42.00, imagen: '/imagenes/Artesanitas/Fotos/taza_runner_1.jpeg' },
    'tetera-corazon': { slug: 'tetera-corazon', sku: '1311', nombre: 'Tetera Corazón', precio: 85.00, imagen: '/imagenes/Artesanitas/Fotos/tetera_corazon_1.jpeg' },
    'palo-rosa-lb': { slug: 'palo-rosa-lb', sku: '1012', nombre: 'Palo Rosa LB', precio: 69.00, imagen: '/imagenes/Artesanitas/Fotos/Taza_Rapunzel_PaloRosa_con-lineas_1.jpeg' },
    'taza-rosada': { slug: 'taza-rosada', sku: '1013', nombre: 'Taza rosada', precio: 65.00, imagen: '/imagenes/Artesanitas/Fotos/Taza_Rapunzel_Rosada_sinplato_1.jpeg' },
    'taza-snoopy': { slug: 'taza-snoopy', sku: '1014', nombre: 'Taza Snoopy', precio: 55.00, imagen: '/imagenes/Artesanitas/Fotos/taza_snoopy_0.jpeg' },
    'taza-shrek': { slug: 'taza-shrek', sku: '1015', nombre: 'Taza Shrek', precio: 69.00, imagen: '/imagenes/Artesanitas/Fotos/taza_shrek_2.jpg' },
    'platos-uva': { slug: 'platos-uva', sku: '1216', nombre: 'Platos uva', precio: 29.00, imagen: '/imagenes/Artesanitas/Fotos/platos_uva_1.jpeg' },
    'plato-morado-full': { slug: 'plato-morado-full', sku: '1217', nombre: 'Plato morado full', precio: 32.00, imagen: '/imagenes/Artesanitas/Fotos/plato_morado_full_1.jpeg' },
    'adorno-paltita': { slug: 'adorno-paltita', sku: '2418', nombre: 'Adorno Paltita', precio: 35.00, imagen: '/imagenes/Artesanitas/Fotos/Adorno_Paltita_1.jpeg' },
    'adorno-oso-sentado': { slug: 'adorno-oso-sentado', sku: '2419', nombre: 'Adorno Oso sentado', precio: 32.00, imagen: '/imagenes/Artesanitas/Fotos/Adorno_oso_sentado_1.jpeg' },
    'adorno-munequitas': { slug: 'adorno-munequitas', sku: '2420', nombre: 'Adorno muñequitas', precio: 29.00, imagen: '/imagenes/Artesanitas/Fotos/Adorno_munequita_con_plantita_1.jpeg' },
    'elefantitos-decorativos': { slug: 'elefantitos-decorativos', sku: '2421', nombre: 'Elefantitos decorativos', precio: 49.00, imagen: '/imagenes/Artesanitas/Fotos/elefantitos_decorativos_1.jpg' },
    'jarron-prada': { slug: 'jarron-prada', sku: '2522', nombre: 'Jarrón Prada', precio: 85.00, imagen: '/imagenes/Artesanitas/Fotos/jarron_prada.jpeg' },
    'taza-perry-el-ornitorrinco': { slug: 'taza-perry-el-ornitorrinco', sku: '1023', nombre: 'Taza Perry el Ornitorrinco', precio: 65.00, imagen: '/imagenes/Artesanitas/Fotos/taza_perry_el_ornitorrinco_1.jpg' },
    'tazas-caspianas': { slug: 'tazas-caspianas', sku: '1124', nombre: 'Tazas Caspianas', precio: 69.00, imagen: '/imagenes/Artesanitas/Fotos/tazas_caspianas_1.jpeg' },
    'corazon-de-ceramica-para-pintar': { slug: 'corazon-de-ceramica-para-pintar', sku: '3025', nombre: 'Corazón de Cerámica para Pintar', precio: 65.00, imagen: '/imagenes/Artesanitas/Fotos/corazon_ceramica_para_pintar_1.jpeg' },
    'taza-artesanal-con-salpicado': { slug: 'taza-artesanal-con-salpicado', sku: '1026', nombre: 'Taza artesanal con salpicado', precio: 52.00, imagen: '/imagenes/Artesanitas/Fotos/taza_artesanal_con_salpicado_1.jpeg' },
    'set-de-2-tazas-personalizadas': { slug: 'set-de-2-tazas-personalizadas', sku: '4127', nombre: 'Set de 2 tazas personalizadas', precio: 149.00, imagen: '/imagenes/Artesanitas/Fotos/set_de_2_tazas_personalizadas_1.jpeg' }
  };

  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function loadCart() {
    try {
      var raw = localStorage.getItem(CART_STORAGE_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter(function (i) { return i && i.slug && i.cantidad > 0; }) : [];
    } catch (e) {
      return [];
    }
  }

  function saveCart(items) {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch (e) {}
  }

  var cartItems = loadCart();
  var leadTracked = false;
  var initiateTracked = false;
  var ultimoPedidoConfirmado = null;
  var mpHabilitado = false;

  function getTipoEntrega() {
    var r = document.querySelector('input[name="tipo_entrega"]:checked');
    return r ? r.value : 'local';
  }

  function getMetodoPago() {
    var r = document.querySelector('input[name="metodo_pago"]:checked');
    return r ? r.value : 'plin_yape';
  }

  function renderCheckoutCart() {
    var listEl = document.getElementById('chk-cart-items');
    var badgeEl = document.getElementById('chk-badge-count');
    var subEl = document.getElementById('chk-subtotal');
    var envEl = document.getElementById('chk-envio');
    var totEl = document.getElementById('chk-total');
    var qrMontoEl = document.getElementById('chk-qr-monto');
    var mpMontoEl = document.getElementById('chk-mp-monto');
    var submitTxt = document.getElementById('chk-submit-text');

    var totalQty = cartItems.reduce(function (s, i) { return s + Number(i.cantidad || 1); }, 0);
    var subtotal = cartItems.reduce(function (s, i) { return s + (Number(i.precio || 0) * Number(i.cantidad || 1)); }, 0);
    var esProvincia = getTipoEntrega() === 'provincia';
    var envio = (totalQty > 0 && esProvincia) ? 10.00 : 0.00;
    var totalPagar = subtotal + envio;

    if (badgeEl) badgeEl.textContent = totalQty + ' ' + (totalQty === 1 ? 'pieza' : 'piezas');
    if (subEl) subEl.textContent = 'S/ ' + subtotal.toFixed(2);
    if (envEl) {
      envEl.textContent = esProvincia ? 'S/ 10.00 (Agencia Shalom)' : 'Gratis (Retiro en Taller)';
      envEl.className = esProvincia ? 'font-bold text-[#B87352]' : 'font-bold text-[#137333]';
    }
    if (totEl) totEl.textContent = 'S/ ' + totalPagar.toFixed(2);
    if (qrMontoEl) qrMontoEl.textContent = 'S/ ' + totalPagar.toFixed(2);
    if (mpMontoEl) mpMontoEl.textContent = 'S/ ' + totalPagar.toFixed(2);
    if (submitTxt) {
      if (totalQty <= 0) {
        submitTxt.textContent = 'Agrega una pieza al carro para continuar';
      } else if (getMetodoPago() === 'mercadopago') {
        submitTxt.textContent = 'Pagar S/ ' + totalPagar.toFixed(2) + ' con Mercado Pago';
      } else {
        submitTxt.textContent = 'Confirmar Compra (S/ ' + totalPagar.toFixed(2) + ') y Descargar PDF';
      }
    }

    if (!listEl) return;

    if (cartItems.length === 0) {
      listEl.innerHTML =
        '<div class="text-center py-8 px-4 bg-[#F9F6F0] rounded-2xl border border-dashed border-[#D5C9BD] space-y-2">' +
        '<p class="text-sm font-bold text-[#333c48]">Tu carro de compras está vacío</p>' +
        '<p class="text-xs text-[#8C7A6B]">Selecciona una pieza en el selector de abajo o vuelve al catálogo para agregar productos.</p>' +
        '<a href="/#catalogo" class="inline-block mt-2 bg-[#333c48] text-white text-xs font-bold px-4 py-2 rounded-full">Ver Catálogo</a>' +
        '</div>';
      return;
    }

    listEl.innerHTML = cartItems.map(function (item) {
      var slugAttr = escapeHtml(item.slug).replace(/'/g, "\\'");
      var sub = (Number(item.precio || 0) * Number(item.cantidad || 1)).toFixed(2);
      var catInfo = CATALOGO_BASE[item.slug] || {};
      var stockDisp = typeof catInfo.stock_actual === 'number' ? catInfo.stock_actual : null;
      var stockLabel = catInfo.agotado
        ? '<span class="text-[10px] font-bold text-red-600">Sin stock disponible</span>'
        : (stockDisp !== null && stockDisp > 0
          ? '<span class="text-[10px] font-bold text-[#137333]">Stock inmediato (' + stockDisp + ' disp.)</span>'
          : '<span class="text-[10px] font-bold text-[#137333]">Despacho inmediato</span>');
      return '' +
        '<div class="flex items-center justify-between gap-3 p-3 rounded-2xl bg-[#F9F6F0] border border-[#EBE5DE]">' +
        '<div class="flex items-center gap-3 min-w-0">' +
        '<img src="' + escapeHtml(item.imagen || '/imagenes/Artesanitas/logo_artesanitas.peru.jpg') + '" alt="' + escapeHtml(item.nombre) + '" onerror="this.onerror=null;this.src=\'/imagenes/Artesanitas/logo_artesanitas.peru.jpg\';" class="w-14 h-14 rounded-xl object-cover border border-[#D5C9BD] bg-white shrink-0">' +
        '<div class="min-w-0">' +
        '<h4 class="text-xs sm:text-sm font-bold text-[#333c48] truncate">' + escapeHtml(item.nombre) + '</h4>' +
        '<span class="text-[11px] text-[#8C7A6B] block">S/ ' + Number(item.precio).toFixed(2) + ' c/u' + (item.sku ? ' · SKU ' + escapeHtml(item.sku) : '') + '</span>' +
        stockLabel +
        '</div>' +
        '</div>' +
        '<div class="flex flex-col items-end gap-1.5 shrink-0">' +
        '<div class="flex items-center gap-1.5">' +
        '<span class="text-xs sm:text-sm font-extrabold text-[#333c48]">S/ ' + sub + '</span>' +
        '<button type="button" data-del-slug="' + slugAttr + '" class="btn-chk-del text-[#8C7A6B] hover:text-red-600 p-1 cursor-pointer" title="Eliminar producto">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5"><path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
        '</button>' +
        '</div>' +
        '<div class="flex items-center gap-1 bg-white rounded-full border border-[#D5C9BD] p-0.5">' +
        '<button type="button" data-step-slug="' + slugAttr + '" data-delta="-1" class="btn-chk-step w-6 h-6 rounded-full hover:bg-[#333c48] hover:text-white text-[#333c48] font-bold text-xs flex items-center justify-center cursor-pointer">−</button>' +
        '<span class="w-6 text-center font-extrabold text-xs text-[#333c48]">' + Number(item.cantidad) + '</span>' +
        '<button type="button" data-step-slug="' + slugAttr + '" data-delta="1" class="btn-chk-step w-6 h-6 rounded-full hover:bg-[#333c48] hover:text-white text-[#333c48] font-bold text-xs flex items-center justify-center cursor-pointer">+</button>' +
        '</div>' +
        '</div>' +
        '</div>';
    }).join('');

    listEl.querySelectorAll('.btn-chk-step').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var s = btn.getAttribute('data-step-slug');
        var d = parseInt(btn.getAttribute('data-delta'), 10);
        changeItemQty(s, d);
      });
    });

    listEl.querySelectorAll('.btn-chk-del').forEach(function (btn) {
      btn.addEventListener('click', function () {
        removeItem(btn.getAttribute('data-del-slug'));
      });
    });

    if (!initiateTracked && cartItems.length > 0 && typeof fbq === 'function') {
      initiateTracked = true;
      try {
        fbq('trackSingle', '851775257895823', 'InitiateCheckout', {
          content_ids: cartItems.map(function (i) { return i.slug; }),
          num_items: totalQty,
          value: totalPagar,
          currency: 'PEN'
        });
      } catch (e) {}
    }
  }

  function addOrIncrementProduct(prod, qty) {
    if (!prod || !prod.slug) return;
    var idx = -1;
    for (var i = 0; i < cartItems.length; i++) {
      if (cartItems[i].slug === prod.slug) { idx = i; break; }
    }
    if (idx > -1) {
      cartItems[idx].cantidad = Math.min(50, Number(cartItems[idx].cantidad || 1) + (qty || 1));
      cartItems[idx].modalidad = 'compra_directa';
      cartItems[idx].reserva = Number(prod.precio);
    } else {
      cartItems.push({
        slug: prod.slug,
        sku: prod.sku || '1001',
        nombre: prod.nombre,
        precio: Number(prod.precio),
        reserva: Number(prod.precio),
        modalidad: 'compra_directa',
        cantidad: qty || 1,
        imagen: prod.imagen || '/imagenes/Artesanitas/logo_artesanitas.peru.jpg'
      });
    }
    saveCart(cartItems);
    renderCheckoutCart();
  }

  function changeItemQty(slug, delta) {
    for (var i = 0; i < cartItems.length; i++) {
      if (cartItems[i].slug === slug) {
        cartItems[i].cantidad = Number(cartItems[i].cantidad || 1) + delta;
        if (cartItems[i].cantidad <= 0) {
          cartItems.splice(i, 1);
        }
        break;
      }
    }
    saveCart(cartItems);
    renderCheckoutCart();
  }

  function removeItem(slug) {
    cartItems = cartItems.filter(function (i) { return i.slug !== slug; });
    saveCart(cartItems);
    renderCheckoutCart();
  }

  // ── Persistencia de Datos del Cliente & Evento Meta Pixel Lead ──
  function hydrateCustomerData() {
    try {
      var raw = localStorage.getItem(CUSTOMER_STORAGE_KEY);
      if (!raw) return;
      var d = JSON.parse(raw);
      if (d.nombre) document.getElementById('chk-nombre').value = d.nombre;
      if (d.dni) document.getElementById('chk-dni').value = d.dni;
      if (d.whatsapp) document.getElementById('chk-whatsapp').value = d.whatsapp;
      if (d.sede_shalom) document.getElementById('chk-sede-shalom').value = d.sede_shalom;
      if (d.direccion_adicional) document.getElementById('chk-direccion').value = d.direccion_adicional;
    } catch (e) {}
  }

  function checkAndTrackLead() {
    var nom = (document.getElementById('chk-nombre')?.value || '').trim();
    var dni = (document.getElementById('chk-dni')?.value || '').replace(/\D/g, '');
    var wa = (document.getElementById('chk-whatsapp')?.value || '').replace(/\D/g, '');

    try {
      localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify({
        nombre: nom,
        dni: dni,
        whatsapp: wa,
        sede_shalom: document.getElementById('chk-sede-shalom')?.value || '',
        direccion_adicional: document.getElementById('chk-direccion')?.value || '',
        tipo_entrega: getTipoEntrega()
      }));
    } catch (e) {}

    var isComplete = nom.length >= 3 && dni.length === 8 && wa.length === 9;
    var badge = document.getElementById('chk-lead-badge');
    if (badge) badge.classList.toggle('hidden', !isComplete);

    if (isComplete && !leadTracked) {
      leadTracked = true;
      if (typeof fbq === 'function') {
        var val = cartItems.reduce(function (s, i) { return s + (Number(i.precio || 0) * Number(i.cantidad || 1)); }, 0);
        try {
          fbq('trackSingle', '851775257895823', 'Lead', {
            content_name: 'Checkout Venta Directa Artesanitas',
            value: val,
            currency: 'PEN'
          });
        } catch (e) {}
      }
    }
  }

  // ── Generador Automático de Comprobante PDF de Compra Directa ──
  function abrirComprobantePDF(pedido) {
    if (!pedido) return;
    var win = window.open('', '_blank', 'width=820,height=920');
    if (!win) return;

    var items = Array.isArray(pedido.items) ? pedido.items : [];
    var subtotal = Number(pedido.precio_total || 0);
    var envio = Number(pedido.costo_envio || 0);
    var pagado = Number(pedido.monto_pagado || (subtotal + envio));
    var fecha = new Date(pedido.created_at || Date.now()).toLocaleString('es-PE', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    var rowsHtml = items.map(function (it) {
      var sub = (Number(it.precio || 0) * Number(it.cantidad || 1)).toFixed(2);
      return '<tr>' +
        '<td style="padding:10px;border-bottom:1px solid #EBE5DE;"><strong>' + escapeHtml(it.nombre || '') + '</strong><br><span style="font-size:11px;color:#8C7A6B;font-family:monospace;">' + (it.sku ? 'SKU: ' + escapeHtml(it.sku) + ' · ' : '') + 'Venta Directa 100%</span></td>' +
        '<td style="padding:10px;border-bottom:1px solid #EBE5DE;text-align:center;font-weight:bold;">' + Number(it.cantidad || 1) + '</td>' +
        '<td style="padding:10px;border-bottom:1px solid #EBE5DE;text-align:right;">S/ ' + Number(it.precio || 0).toFixed(2) + '</td>' +
        '<td style="padding:10px;border-bottom:1px solid #EBE5DE;text-align:right;font-weight:bold;">S/ ' + sub + '</td>' +
        '</tr>';
    }).join('');

    win.document.write('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Comprobante ' + escapeHtml(pedido.codigo_pedido) + '</title>');
    win.document.write('<style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#333c48;background:#F9F6F0;margin:0;padding:24px;}.card{max-width:680px;margin:0 auto;background:#fff;border:1px solid #D5C9BD;border-radius:20px;padding:32px;}table{width:100%;border-collapse:collapse;margin-top:16px;font-size:13px;}th{background:#F1EDE7;color:#8C7A6B;text-transform:uppercase;font-size:11px;padding:10px;text-align:left;}@media print{body{background:#fff;padding:0;}.card{border:none;}.no-print{display:none!important;}}</style></head><body>');
    win.document.write('<div class="card">');
    win.document.write('<div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #EBE5DE;padding-bottom:16px;">');
    win.document.write('<div><h1 style="margin:0;font-size:22px;color:#4A3C31;">Artesanitas Perú</h1><p style="margin:4px 0 0;font-size:12px;color:#8C7A6B;">Comprobante Oficial de Compra Online · Hub Marcas Los Pilares</p></div>');
    win.document.write('<div style="text-align:right;"><span style="background:#137333;color:#fff;font-size:10px;font-weight:800;padding:4px 10px;border-radius:99px;text-transform:uppercase;">PAGADO 100%</span><p style="margin:8px 0 2px;font-family:monospace;font-size:18px;font-weight:900;color:#B87352;">' + escapeHtml(pedido.codigo_pedido) + '</p><p style="margin:0;font-size:11px;color:#8C7A6B;">' + escapeHtml(fecha) + '</p></div>');
    win.document.write('</div>');
    win.document.write('<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;background:#F9F6F0;padding:14px;border-radius:14px;margin-top:16px;font-size:12px;">');
    win.document.write('<div><strong style="color:#8C7A6B;font-size:10px;text-transform:uppercase;">Comprador:</strong><p style="margin:4px 0 2px;font-weight:bold;">' + escapeHtml(pedido.nombre) + '</p><p style="margin:0;color:#8C7A6B;">DNI: ' + escapeHtml(pedido.dni) + ' · WhatsApp: ' + escapeHtml(pedido.whatsapp) + '</p></div>');
    win.document.write('<div><strong style="color:#8C7A6B;font-size:10px;text-transform:uppercase;">Despacho:</strong><p style="margin:4px 0 2px;font-weight:bold;">' + (pedido.tipo_entrega === 'provincia' ? 'Envío Agencia Shalom' : 'Retiro en Taller Trujillo') + '</p><p style="margin:0;color:#8C7A6B;">' + escapeHtml(pedido.sede_shalom || 'Taller Trujillo') + '</p></div>');
    win.document.write('</div>');
    win.document.write('<table><thead><tr><th>Producto / SKU</th><th style="text-align:center;">Cant.</th><th style="text-align:right;">P. Unit</th><th style="text-align:right;">Subtotal</th></tr></thead><tbody>' + rowsHtml + '</tbody></table>');
    win.document.write('<div style="margin-top:18px;border-top:2px solid #EBE5DE;padding-top:14px;display:flex;justify-content:space-between;align-items:flex-start;">');
    win.document.write('<div style="font-size:11px;color:#137333;background:#e6f4ea;padding:10px 14px;border-radius:12px;max-width:310px;"><strong>✓ Inventario Descargado Automáticamente:</strong><br>Las unidades de esta orden fueron descontadas en tiempo real del Kardex de Almacén.</div>');
    win.document.write('<div style="text-align:right;font-size:13px;min-width:210px;">');
    win.document.write('<div style="display:flex;justify-content:space-between;margin-bottom:5px;"><span>Subtotal:</span><strong>S/ ' + subtotal.toFixed(2) + '</strong></div>');
    win.document.write('<div style="display:flex;justify-content:space-between;margin-bottom:5px;"><span>Envío:</span><strong>S/ ' + envio.toFixed(2) + '</strong></div>');
    win.document.write('<div style="display:flex;justify-content:space-between;font-size:16px;color:#137333;"><span><strong>Total Pagado:</strong></span><strong>S/ ' + pagado.toFixed(2) + '</strong></div>');
    win.document.write('</div></div>');
    win.document.write('<div class="no-print" style="margin-top:22px;text-align:center;"><button onclick="window.print()" style="background:#333c48;color:#fff;border:none;padding:12px 24px;border-radius:99px;font-weight:bold;cursor:pointer;">Guardar PDF / Imprimir Comprobante</button></div>');
    win.document.write('</div></body></html>');
    win.document.close();
    setTimeout(function () { win.focus(); win.print(); }, 400);
  }

  // ── Inicialización DOM ──
  document.addEventListener('DOMContentLoaded', function () {
    // 1. Poblar selector rápido de catálogo
    var quickSelect = document.getElementById('chk-quick-add-select');
    var quickBtn = document.getElementById('chk-quick-add-btn');

    function populateQuickAdd() {
      if (!quickSelect) return;
      quickSelect.innerHTML = '<option value="">— Selecciona una pieza para agregar al carro —</option>';
      Object.keys(CATALOGO_BASE).forEach(function (slug) {
        var p = CATALOGO_BASE[slug];
        var opt = document.createElement('option');
        opt.value = p.slug;
        opt.textContent = p.nombre + ' — S/ ' + Number(p.precio).toFixed(2) + (p.sku ? ' (SKU ' + p.sku + ')' : '');
        quickSelect.appendChild(opt);
      });
    }
    populateQuickAdd();

    // Sincronizar con productos dinámicos de la BD
    fetch('/api/negocios/' + NEGOCIO + '/productos')
      .then(function (r) { return r.ok ? r.json() : { productos: [] }; })
      .then(function (data) {
        var prods = (data && data.productos) || [];
        prods.forEach(function (p) {
          if (!p || !p.slug) return;
          var pr = (p.precio_oferta && Number(p.precio_oferta) > 0 && Number(p.precio_oferta) < Number(p.precio)) ? Number(p.precio_oferta) : Number(p.precio);
          CATALOGO_BASE[p.slug] = {
            slug: p.slug,
            sku: p.sku || '1001',
            nombre: p.nombre,
            precio: pr,
            stock_actual: Number(p.stock_actual || 0),
            agotado: Number(p.stock_actual || 0) <= 0 && p.politica_sin_stock === 'agotado',
            imagen: (Array.isArray(p.imagenes) && p.imagenes[0]) || (CATALOGO_BASE[p.slug] && CATALOGO_BASE[p.slug].imagen) || '/imagenes/Artesanitas/logo_artesanitas.peru.jpg'
          };
        });
        populateQuickAdd();
        renderCheckoutCart();

        // Si viene ?producto=slug en la URL y aún no está en el carro, agregarlo
        var params = new URLSearchParams(window.location.search);
        var prodParam = params.get('producto');
        if (prodParam && CATALOGO_BASE[prodParam]) {
          var exists = cartItems.some(function (i) { return i.slug === prodParam; });
          if (!exists) {
            addOrIncrementProduct(CATALOGO_BASE[prodParam], 1);
          }
        }
      })
      .catch(function () {});

    // Si viene ?producto=slug en la URL, agregarlo de inmediato desde CATALOGO_BASE
    var params = new URLSearchParams(window.location.search);
    var prodParam = params.get('producto');
    if (prodParam && CATALOGO_BASE[prodParam]) {
      var already = cartItems.some(function (i) { return i.slug === prodParam; });
      if (!already) {
        addOrIncrementProduct(CATALOGO_BASE[prodParam], 1);
      }
    }

    if (quickBtn && quickSelect) {
      quickBtn.addEventListener('click', function () {
        var val = quickSelect.value;
        if (val && CATALOGO_BASE[val]) {
          addOrIncrementProduct(CATALOGO_BASE[val], 1);
          quickSelect.value = '';
        }
      });
    }

    // 2. Hidratar datos de cliente y escuchar cambios para disparar Lead
    hydrateCustomerData();
    ['chk-nombre', 'chk-dni', 'chk-whatsapp', 'chk-sede-shalom', 'chk-direccion'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('input', checkAndTrackLead);
    });

    var dniEl = document.getElementById('chk-dni');
    if (dniEl) {
      dniEl.addEventListener('input', function () {
        dniEl.value = dniEl.value.replace(/\D/g, '').slice(0, 8);
      });
    }
    var waEl = document.getElementById('chk-whatsapp');
    if (waEl) {
      waEl.addEventListener('input', function () {
        waEl.value = waEl.value.replace(/\D/g, '').slice(0, 9);
      });
    }

    // 3. Cambio de método de entrega
    var radios = document.querySelectorAll('input[name="tipo_entrega"]');
    var shalomFields = document.getElementById('chk-shalom-fields');
    var lblLocal = document.getElementById('lbl-entrega-local');
    var lblProv = document.getElementById('lbl-entrega-provincia');

    radios.forEach(function (r) {
      r.addEventListener('change', function () {
        var isProv = getTipoEntrega() === 'provincia';
        if (shalomFields) shalomFields.classList.toggle('hidden', !isProv);
        if (lblLocal) {
          lblLocal.className = 'relative flex items-start gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ' +
            (!isProv ? 'border-[#333c48] bg-[#F9F6F0]/60' : 'border-[#D5C9BD] bg-white');
        }
        if (lblProv) {
          lblProv.className = 'relative flex items-start gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ' +
            (isProv ? 'border-[#333c48] bg-[#F9F6F0]/60' : 'border-[#D5C9BD] bg-white');
        }
        renderCheckoutCart();
      });
    });

    function aplicarMetodoPagoUI() {
      var isMp = getMetodoPago() === 'mercadopago';
      var panelPlin = document.getElementById('chk-panel-plin');
      var panelMp = document.getElementById('chk-panel-mp');
      var lblPlin = document.getElementById('lbl-pago-plin');
      var lblMp = document.getElementById('lbl-pago-mp');
      if (panelPlin) panelPlin.classList.toggle('hidden', isMp);
      if (panelMp) panelMp.classList.toggle('hidden', !isMp);
      if (lblPlin) {
        lblPlin.className = 'relative flex items-start gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ' +
          (!isMp ? 'border-[#333c48] bg-[#F9F6F0]/60' : 'border-[#D5C9BD] bg-white');
      }
      if (lblMp) {
        lblMp.className = 'relative flex items-start gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ' +
          (mpHabilitado ? (isMp ? 'border-[#009ee3] bg-[#009ee3]/5' : 'border-[#D5C9BD] bg-white') : 'border-[#D5C9BD] bg-white opacity-60 cursor-not-allowed');
      }
      renderCheckoutCart();
    }

    document.querySelectorAll('input[name="metodo_pago"]').forEach(function (r) {
      r.addEventListener('change', aplicarMetodoPagoUI);
    });

    // Consultar configuración de Mercado Pago para Artesanitas
    fetch('/api/negocios/' + NEGOCIO + '/checkout/config')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (cfg) {
        var radioMp = document.getElementById('radio-pago-mp');
        var badgeMp = document.getElementById('chk-mp-status-badge');
        var descMp = document.getElementById('chk-mp-desc');
        if (cfg && cfg.mp_habilitado) {
          mpHabilitado = true;
          if (radioMp) radioMp.disabled = false;
          if (badgeMp) {
            badgeMp.textContent = 'Disponible';
            badgeMp.className = 'text-[10px] font-bold bg-[#009ee3]/15 text-[#0073a8] px-2 py-0.5 rounded-full';
          }
        } else {
          mpHabilitado = false;
          if (radioMp) radioMp.disabled = true;
          if (badgeMp) {
            badgeMp.textContent = 'Próximamente';
            badgeMp.className = 'text-[10px] font-bold bg-[#F1EDE7] text-[#8C7A6B] px-2 py-0.5 rounded-full';
          }
          if (descMp) descMp.textContent = 'Usa Yape o Plin QR mientras completamos activación de tarjeta.';
        }
        aplicarMetodoPagoUI();
      })
      .catch(function () {});

    // Manejar retorno de Mercado Pago (?mp=approved|pending|failure&codigo=ART-...)
    var urlParamsMp = new URLSearchParams(window.location.search);
    var mpStatusParam = urlParamsMp.get('mp');
    var codigoMpParam = urlParamsMp.get('codigo');

    // 4. Copiar teléfono Plin
    var copyBtn = document.getElementById('chk-copy-phone');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        if (navigator.clipboard) {
          navigator.clipboard.writeText('929938466');
          copyBtn.textContent = '¡Copiado!';
          setTimeout(function () { copyBtn.textContent = 'Copiar'; }, 1500);
        }
      });
    }

    // 5. Archivo de comprobante
    var fileInput = document.getElementById('chk-comprobante');
    var fileLabel = document.getElementById('chk-file-label');
    if (fileInput && fileLabel) {
      fileInput.addEventListener('change', function () {
        var f = fileInput.files && fileInput.files[0];
        if (f) {
          fileLabel.textContent = '✓ ' + f.name;
          fileLabel.classList.add('text-[#137333]');
        }
      });
    }

    // 6. Envío del Checkout (Venta Directa 100%)
    var form = document.getElementById('checkout-form');
    var errBox = document.getElementById('chk-error-box');
    var submitBtn = document.getElementById('chk-submit-btn');

    function showError(msg) {
      if (!errBox) return;
      errBox.textContent = msg;
      errBox.classList.remove('hidden');
      errBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    if (mpStatusParam === 'failure') {
      showError('El pago con Mercado Pago no se completó o fue cancelado. Puedes reintentar o pagar directamente con Yape / Plin QR sin perder tu carro.');
    } else if ((mpStatusParam === 'approved' || mpStatusParam === 'pending') && codigoMpParam) {
      fetch('/api/negocios/' + NEGOCIO + '/pedidos/seguimiento?codigo=' + encodeURIComponent(codigoMpParam))
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
          var ped = d && d.pedidos && d.pedidos[0];
          if (!ped) return;
          ultimoPedidoConfirmado = {
            codigo_pedido: ped.codigo_pedido,
            nombre: ped.nombre || 'Cliente Artesanitas',
            dni: ped.dni || '',
            whatsapp: ped.whatsapp || '',
            tipo_entrega: ped.tipo_entrega,
            sede_shalom: ped.sede_shalom,
            items: ped.items,
            precio_total: Number(ped.producto_precio || 0),
            costo_envio: Number(ped.costo_envio || 0),
            monto_pagado: Number(ped.monto_pagado || ped.producto_precio || 0),
            created_at: ped.created_at
          };
          cartItems = [];
          saveCart([]);
          document.getElementById('checkout-main-grid').classList.add('hidden');
          var successBox = document.getElementById('checkout-success-box');
          if (successBox) successBox.classList.remove('hidden');
          var badgeSuc = document.getElementById('chk-success-badge');
          if (badgeSuc && mpStatusParam === 'pending') {
            badgeSuc.textContent = 'Pago en Validación Mercado Pago';
          }
          document.getElementById('chk-success-code').textContent = ped.codigo_pedido;
          document.getElementById('chk-btn-tracking').href = '/seguimiento?codigo=' + encodeURIComponent(ped.codigo_pedido);
          var btnPdf = document.getElementById('chk-btn-download-pdf');
          if (btnPdf) btnPdf.onclick = function () { abrirComprobantePDF(ultimoPedidoConfirmado); };

          if (mpStatusParam === 'approved' && typeof fbq === 'function') {
            try {
              fbq(
                'trackSingle',
                '851775257895823',
                'Purchase',
                {
                  value: Number(ped.monto_pagado || ped.producto_precio || 0),
                  currency: 'PEN',
                  content_ids: Array.isArray(ped.items) ? ped.items.map(function (i) { return i.slug; }) : [ped.producto_slug],
                  content_type: 'product'
                },
                { eventID: ped.codigo_pedido }
              );
            } catch (e) {}
          }
        })
        .catch(function () {});
    }

    if (form) {
      form.addEventListener('submit', async function (e) {
        e.preventDefault();
        if (errBox) errBox.classList.add('hidden');

        if (cartItems.length === 0) {
          return showError('Tu carro de compras está vacío. Agrega al menos una pieza para continuar.');
        }

        var nombre = (document.getElementById('chk-nombre')?.value || '').trim();
        var dni = (document.getElementById('chk-dni')?.value || '').replace(/\D/g, '');
        var whatsapp = (document.getElementById('chk-whatsapp')?.value || '').replace(/\D/g, '');
        var tipoEntrega = getTipoEntrega();
        var sedeShalom = (document.getElementById('chk-sede-shalom')?.value || '').trim();
        var direccion = (document.getElementById('chk-direccion')?.value || '').trim();
        var metodoPago = getMetodoPago();
        var file = fileInput && fileInput.files ? fileInput.files[0] : null;

        if (nombre.length < 3) return showError('Por favor ingresa tu nombre y apellidos completos.');
        if (dni.length !== 8) return showError('Ingresa un número de DNI válido de 8 dígitos.');
        if (whatsapp.length !== 9) return showError('Ingresa un número de celular / WhatsApp válido de 9 dígitos.');
        if (tipoEntrega === 'provincia' && sedeShalom.length < 3) {
          return showError('Indica la ciudad y sede de agencia Shalom para el despacho.');
        }

        checkAndTrackLead();

        var itemsPayload = cartItems.map(function (i) {
          return {
            slug: i.slug,
            sku: i.sku || '',
            nombre: i.nombre,
            precio: Number(i.precio),
            reserva: Number(i.precio),
            modalidad: 'compra_directa',
            cantidad: Number(i.cantidad || 1),
            imagen: i.imagen || ''
          };
        });

        // Flujo Mercado Pago
        if (metodoPago === 'mercadopago') {
          var origMpHtml = submitBtn.innerHTML;
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<span>Conectando con Mercado Pago...</span>';
          try {
            var mpRes = await fetch('/api/negocios/' + NEGOCIO + '/checkout/mercadopago', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                items: itemsPayload,
                producto_slug: cartItems[0].slug,
                nombre: nombre,
                dni: dni,
                whatsapp: whatsapp,
                tipo_entrega: tipoEntrega,
                sede_shalom: tipoEntrega === 'provincia' ? sedeShalom : 'Recojo en Local (Taller Trujillo)',
                direccion_adicional: direccion || ''
              })
            });
            var mpData = await mpRes.json();
            if (mpRes.ok && mpData.success && mpData.init_point) {
              window.location.href = mpData.init_point;
              return;
            }
            showError(mpData.message || 'No se pudo iniciar el pago con Mercado Pago.');
          } catch (mpErr) {
            showError('Error de conexión con la pasarela de pago.');
          }
          submitBtn.disabled = false;
          submitBtn.innerHTML = origMpHtml;
          return;
        }

        // Flujo Yape / Plin QR
        if (!file) {
          return showError('Por favor adjunta la captura de tu pago por Yape o Plin para procesar tu compra.');
        }

        var fd = new FormData();
        fd.append('modalidad_pago', 'completo');
        fd.append('producto_slug', cartItems[0].slug);
        fd.append('cantidad', String(cartItems.reduce(function (s, i) { return s + Number(i.cantidad || 1); }, 0)));
        fd.append('items', JSON.stringify(itemsPayload));
        fd.append('nombre', nombre);
        fd.append('dni', dni);
        fd.append('whatsapp', whatsapp);
        fd.append('tipo_entrega', tipoEntrega);
        fd.append('sede_shalom', tipoEntrega === 'provincia' ? sedeShalom : 'Recojo en Local (Taller Trujillo)');
        if (direccion) fd.append('direccion_adicional', direccion);
        fd.append('comprobante', file);

        var origHtml = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Procesando compra y descargando stock...</span>';

        try {
          var res = await fetch('/api/negocios/' + NEGOCIO + '/pedidos', {
            method: 'POST',
            body: fd
          });
          var data = await res.json();

          if (res.ok && data.success && data.pedido) {
            ultimoPedidoConfirmado = data.pedido;
            var cod = data.pedido.codigo_pedido;

            // Evento Purchase Meta Pixel 100% deduplicado con Meta CAPI Server-Side
            if (typeof fbq === 'function') {
              try {
                fbq(
                  'trackSingle',
                  '851775257895823',
                  'Purchase',
                  {
                    value: Number(data.pedido.monto_pagado || data.pedido.precio_total || 0),
                    currency: 'PEN',
                    content_ids: cartItems.map(function (i) { return i.slug; }),
                    content_type: 'product'
                  },
                  { eventID: data.meta_event_id || cod }
                );
              } catch (e) {}
            }

            // Limpiar carro tras compra exitosa
            cartItems = [];
            saveCart([]);

            document.getElementById('checkout-main-grid').classList.add('hidden');
            var successBox = document.getElementById('checkout-success-box');
            if (successBox) successBox.classList.remove('hidden');
            document.getElementById('chk-success-code').textContent = cod;
            document.getElementById('chk-btn-tracking').href = '/seguimiento?codigo=' + encodeURIComponent(cod);

            var btnPdf = document.getElementById('chk-btn-download-pdf');
            if (btnPdf) {
              btnPdf.onclick = function () { abrirComprobantePDF(ultimoPedidoConfirmado); };
            }

            window.scrollTo({ top: 0, behavior: 'smooth' });
            setTimeout(function () { abrirComprobantePDF(ultimoPedidoConfirmado); }, 400);
          } else {
            showError(data.message || 'No se pudo completar la compra. Verifica los datos e intenta nuevamente.');
            submitBtn.disabled = false;
            submitBtn.innerHTML = origHtml;
          }
        } catch (err) {
          showError('Error de conexión al procesar la compra. Intenta nuevamente.');
          submitBtn.disabled = false;
          submitBtn.innerHTML = origHtml;
        }
      });
    }

    renderCheckoutCart();
  });
})();
