/* public/js/erp/erp-core.js
 * Hub Marcas LPS · Enterprise ERP Micro-Kernel & Hash Router (Silicon Valley Standard)
 * Gestiona enrutamiento por URL hash (#pedidos, #inventario, #catalogo, #bi, #talleres, #registros),
 * atajos de teclado ejecutivos (Alt+1..6, / para buscar), compresión WebP y utilidades compartidas.
 */
(function (global) {
  'use strict';

  var ACTIVE_MODULE_KEY = 'lps_erp_active_module_v1';
  var modulesRegistry = {};

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function cleanProductTitle(texto) {
    return String(texto || '')
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F\u200D]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async function comprimirImagenWeb(file) {
    let sourceFile = file;
    const isHeic = /\.(heic|heif)$/i.test(file.name) || file.type === 'image/heic' || file.type === 'image/heif';
    if (isHeic && typeof heic2any === 'function') {
      const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 });
      const blob = Array.isArray(converted) ? converted[0] : converted;
      sourceFile = new File([blob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' });
    }
    return new Promise(function (resolve, reject) {
      const img = new Image();
      const url = URL.createObjectURL(sourceFile);
      img.onload = function () {
        URL.revokeObjectURL(url);
        const MAX_SIDE = 1200;
        let w = img.width;
        let h = img.height;
        if (w > MAX_SIDE || h > MAX_SIDE) {
          if (w > h) { h = Math.round((h * MAX_SIDE) / w); w = MAX_SIDE; }
          else { w = Math.round((w * MAX_SIDE) / h); h = MAX_SIDE; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(function (blob) {
          if (!blob) return reject(new Error('No se pudo procesar la imagen'));
          const baseName = sourceFile.name.replace(/\.[^.]+$/, '');
          resolve(new File([blob], baseName + '.webp', { type: 'image/webp' }));
        }, 'image/webp', 0.84);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('Imagen inválida'));
      };
      img.src = url;
    });
  }

  function initErpRouter(tabMap) {
    // tabMap: { pedidos: { btn, tab }, inventario: { btn, tab }, catalogo: { btn, tab }, bi: { btn, tab }, talleres: { btn, tab }, registros: { btn, tab } }
    var keys = Object.keys(tabMap);

    function applyHashRoute() {
      var rawHash = (window.location.hash || '').replace(/^#/, '').toLowerCase();
      var chosen = tabMap[rawHash] ? rawHash : (localStorage.getItem(ACTIVE_MODULE_KEY) || 'pedidos');
      if (!tabMap[chosen]) chosen = keys[0];
      var entry = tabMap[chosen];
      if (entry && entry.btn) {
        entry.btn.click();
      }
    }

    keys.forEach(function (k) {
      var entry = tabMap[k];
      if (!entry || !entry.btn) return;
      entry.btn.addEventListener('click', function () {
        localStorage.setItem(ACTIVE_MODULE_KEY, k);
        if (window.location.hash !== '#' + k) {
          history.replaceState(null, '', '#' + k);
        }
      });
    });

    window.addEventListener('hashchange', applyHashRoute);

    // Atajos de teclado ejecutivos: Alt+1..6 para cambiar de módulo, '/' para enfocar el buscador del módulo activo
    document.addEventListener('keydown', function (ev) {
      var tag = (ev.target && ev.target.tagName) ? ev.target.tagName.toLowerCase() : '';
      var isTyping = tag === 'input' || tag === 'textarea' || tag === 'select' || (ev.target && ev.target.isContentEditable);

      if (ev.altKey && !ev.ctrlKey && !ev.metaKey) {
        var idx = parseInt(ev.key, 10) - 1;
        if (idx >= 0 && idx < keys.length) {
          var targetEntry = tabMap[keys[idx]];
          if (targetEntry && targetEntry.btn) {
            ev.preventDefault();
            targetEntry.btn.click();
          }
        }
      } else if (ev.key === '/' && !isTyping) {
        var cur = localStorage.getItem(ACTIVE_MODULE_KEY) || 'pedidos';
        var searchMap = {
          pedidos: 'filtro-pedido-search',
          inventario: 'filtro-inv-search',
          catalogo: 'filtro-producto-search',
          registros: 'filtro-search'
        };
        var searchId = searchMap[cur];
        var searchEl = searchId ? document.getElementById(searchId) : null;
        if (searchEl) {
          ev.preventDefault();
          searchEl.focus();
        }
      }
    });

    setTimeout(applyHashRoute, 0);
  }

  global.LpsErp = {
    escapeHtml: escapeHtml,
    cleanProductTitle: cleanProductTitle,
    comprimirImagenWeb: comprimirImagenWeb,
    initErpRouter: initErpRouter,
    registerModule: function (name, api) {
      modulesRegistry[name] = api;
      global.LpsErp[name] = api;
    },
    getModule: function (name) {
      return modulesRegistry[name];
    }
  };
})(window);
