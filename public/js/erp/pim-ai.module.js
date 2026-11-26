/* public/js/erp/pim-ai.module.js
 * Módulo PIM · Gestor Dinámico de Colecciones E-Commerce 2026 & Redactor Multimodal Gemini IA
 */
(function (global) {
  'use strict';

  var COLECCIONES_KEY = 'lps_custom_collections_v1';

  function getColeccionesDisponibles(inventarioCache) {
    var base = ['Catálogo General', 'Colección Navidad', 'Colección Van Gogh', 'Colección Rapunzel', 'Regalos & Temporada'];
    var custom = [];
    try {
      var raw = JSON.parse(localStorage.getItem(COLECCIONES_KEY) || '[]');
      if (Array.isArray(raw)) custom = raw;
    } catch {}
    var fromDb = (inventarioCache || []).map(function (p) { return (p.coleccion || '').trim(); }).filter(Boolean);
    var merged = [];
    var seen = new Set();
    base.concat(custom, fromDb).forEach(function (c) {
      var clean = String(c || '').trim();
      var k = clean.toLowerCase();
      if (clean && !seen.has(k)) {
        seen.add(k);
        merged.push(clean);
      }
    });
    return merged;
  }

  function syncColeccionesDisponibles(inventarioCache) {
    var escapeHtml = global.LpsErp ? global.LpsErp.escapeHtml : function (s) { return String(s || ''); };
    var lista = getColeccionesDisponibles(inventarioCache);
    ['mat-coleccion', 'ficha-coleccion'].forEach(function (selId) {
      var sel = document.getElementById(selId);
      if (!sel) return;
      var prev = sel.value;
      sel.innerHTML = lista.map(function (c) { return '<option value="' + escapeHtml(c) + '">' + escapeHtml(c) + '</option>'; }).join('');
      if (prev && lista.includes(prev)) sel.value = prev;
    });
    var dl = document.getElementById('lps-colecciones-list');
    if (dl) {
      dl.innerHTML = lista.map(function (c) { return '<option value="' + escapeHtml(c) + '"></option>'; }).join('');
    }
    var invColSel = document.getElementById('filtro-inv-coleccion');
    if (invColSel) {
      var prevInv = invColSel.value;
      invColSel.innerHTML = '<option value="">Todas las colecciones</option>' +
        lista.map(function (c) { return '<option value="' + escapeHtml(c) + '">' + escapeHtml(c) + '</option>'; }).join('');
      if (prevInv && lista.includes(prevInv)) invColSel.value = prevInv;
    }
  }

  function bindBotonesCrearColeccion(getInventarioCache) {
    document.querySelectorAll('.btn-crear-coleccion').forEach(function (btn) {
      if (btn.dataset.boundCol === '1') return;
      btn.dataset.boundCol = '1';
      btn.addEventListener('click', async function () {
        var targetId = btn.dataset.targetColeccion;
        var val = await window.LpsModal.prompt({
          title: 'Crear nueva colección',
          message: 'Ingresa el nombre de la nueva colección (ej: Colección Invierno, Día de la Madre, Regalos Corporativos):',
          placeholder: 'Ej: Colección Invierno',
          confirmText: 'Crear Colección',
          maxLength: 60
        });
        var nombreCol = String(val || '').trim();
        if (!nombreCol) return;

        var custom = [];
        try {
          var raw = JSON.parse(localStorage.getItem(COLECCIONES_KEY) || '[]');
          if (Array.isArray(raw)) custom = raw;
        } catch {}
        if (!custom.some(function (c) { return c.toLowerCase() === nombreCol.toLowerCase(); })) {
          custom.push(nombreCol);
          localStorage.setItem(COLECCIONES_KEY, JSON.stringify(custom));
        }
        syncColeccionesDisponibles(typeof getInventarioCache === 'function' ? getInventarioCache() : []);

        var targetEl = targetId ? document.getElementById(targetId) : null;
        if (targetEl) {
          targetEl.value = nombreCol;
          targetEl.dispatchEvent(new Event('input'));
        }
        window.LpsModal.toast('Colección "' + nombreCol + '" creada y seleccionada.', 'success');
      });
    });
  }

  async function solicitarDescripcionIa(opts) {
    var file = opts.file;
    var productoId = opts.productoId;
    var btnEl = opts.btnEl;
    var descEl = opts.descEl;
    var colorEl = opts.colorEl;
    var carEl = opts.carEl;
    var onMeta = opts.onMeta;
    var apiFetch = opts.apiFetch;
    var comprimir = global.LpsErp.comprimirImagenWeb;

    if (!file && !productoId) {
      await window.LpsModal.alert('Primero selecciona al menos una foto del producto para que la IA pueda analizarla.', 'warning');
      return;
    }
    var origHtml = btnEl.innerHTML;
    btnEl.disabled = true;
    btnEl.textContent = 'Analizando imagen con IA...';
    try {
      var fd = new FormData();
      if (productoId) fd.append('producto_id', productoId);
      fd.append('nombre', opts.nombre || '');
      fd.append('linea', opts.linea || '');
      fd.append('sublinea', opts.sublinea || '');
      fd.append('coleccion', opts.coleccion || '');
      if (file) {
        var optIaFile = await comprimir(file);
        fd.append('imagenes', optIaFile);
      }
      var res = await apiFetch('/productos/ia-descripcion', { method: 'POST', body: fd });
      var data = await res.json();
      if (res.ok && data.success) {
        if (descEl && data.descripcion) descEl.value = data.descripcion;
        if (colorEl && !colorEl.value.trim() && data.color) colorEl.value = data.color;
        if (carEl && !carEl.value.trim() && data.caracteristicas) carEl.value = data.caracteristicas;
        if (typeof onMeta === 'function') onMeta(data);
        window.LpsModal.toast('Descripción generada con IA según la imagen.', 'success');
      } else {
        await window.LpsModal.alert(data.message || 'No se pudo generar la descripción con IA.', 'error');
      }
    } catch {
      await window.LpsModal.alert('Error de conexión al consultar la IA.', 'error');
    } finally {
      btnEl.disabled = false;
      btnEl.innerHTML = origHtml;
    }
  }

  if (global.LpsErp) {
    global.LpsErp.registerModule('pimAi', {
      getColeccionesDisponibles: getColeccionesDisponibles,
      syncColeccionesDisponibles: syncColeccionesDisponibles,
      bindBotonesCrearColeccion: bindBotonesCrearColeccion,
      solicitarDescripcionIa: solicitarDescripcionIa
    });
  }
})(window);
