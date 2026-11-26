/* public/js/erp/wms-scanner.module.js
 * Módulo WMS · Generador de Etiquetas GS1 EAN-13 y Escáner de Cámara Móvil (BarcodeDetector)
 */
(function (global) {
  'use strict';

  var mediaStreamGlobal = null;

  function generarBarrasSvg(codeStr) {
    var clean = String(codeStr || '7752601000018').replace(/[^0-9A-Z]/gi, '') || '7752601000018';
    var bars = [];
    var x = 10;
    bars.push('<rect x="' + x + '" y="6" width="2" height="58" fill="#111"/><rect x="' + (x + 4) + '" y="6" width="2" height="58" fill="#111"/>');
    x += 10;
    for (var i = 0; i < clean.length; i++) {
      var code = clean.charCodeAt(i);
      var w1 = (code % 3) + 1;
      var s1 = ((code >> 1) % 2) + 1;
      var w2 = ((code >> 2) % 3) + 1;
      var s2 = ((code >> 3) % 2) + 1;
      bars.push('<rect x="' + x + '" y="6" width="' + (w1 * 1.8) + '" height="50" fill="#111"/>');
      x += (w1 + s1) * 1.8;
      bars.push('<rect x="' + x + '" y="6" width="' + (w2 * 1.8) + '" height="50" fill="#111"/>');
      x += (w2 + s2) * 1.8;
    }
    bars.push('<rect x="' + x + '" y="6" width="2" height="58" fill="#111"/><rect x="' + (x + 4) + '" y="6" width="2" height="58" fill="#111"/>');
    var totalWidth = Math.ceil(x + 16);
    return '<svg viewBox="0 0 ' + totalWidth + ' 76" class="w-full h-20 mx-auto" xmlns="http://www.w3.org/2000/svg">' +
      '<rect width="100%" height="100%" fill="#FFFFFF"/>' +
      bars.join('') +
      '<text x="' + (totalWidth / 2) + '" y="71" text-anchor="middle" font-family="monospace" font-size="11" font-weight="bold" fill="#111" letter-spacing="2">' + clean + '</text>' +
      '</svg>';
  }

  function abrirModalEtiquetaEan(prod) {
    var modalEtiquetaEan = document.getElementById('modal-etiqueta-ean');
    if (!modalEtiquetaEan || !prod) return;
    var precioFinal = (prod.precio_oferta && Number(prod.precio_oferta) > 0 && Number(prod.precio_oferta) < Number(prod.precio))
      ? Number(prod.precio_oferta)
      : Number(prod.precio || 0);
    var elNom = document.getElementById('etiqueta-prod-nombre'); if (elNom) elNom.textContent = prod.nombre || 'Artesanitas';
    var elLin = document.getElementById('etiqueta-prod-linea'); if (elLin) elLin.textContent = (prod.linea || 'Vajilla') + ' · ' + (prod.sublinea || 'Tazas');
    var elSku = document.getElementById('etiqueta-prod-sku'); if (elSku) elSku.textContent = 'SKU: ' + (prod.sku || 'S/N');
    var elPre = document.getElementById('etiqueta-prod-precio'); if (elPre) elPre.textContent = 'S/ ' + precioFinal.toFixed(2);
    var svgBox = document.getElementById('etiqueta-barcode-svg');
    if (svgBox) svgBox.innerHTML = generarBarrasSvg(prod.ean || prod.sku);
    modalEtiquetaEan.classList.remove('hidden');
  }

  function initCamaraScannerWMS() {
    var btnAbrir = document.getElementById('btn-camara-scanner-wms');
    var modal = document.getElementById('modal-camara-scanner');
    var btnCerrar = document.getElementById('btn-cerrar-camara-scanner');
    var video = document.getElementById('video-camara-scanner');
    var statusEl = document.getElementById('camara-scanner-status');
    var manualInput = document.getElementById('camara-manual-barcode');
    var manualBtn = document.getElementById('btn-camara-manual-submit');

    if (!btnAbrir || !modal) return;

    function cerrarScanner() {
      if (mediaStreamGlobal) {
        mediaStreamGlobal.getTracks().forEach(function (t) { t.stop(); });
        mediaStreamGlobal = null;
      }
      modal.classList.add('hidden');
    }

    if (btnCerrar) btnCerrar.addEventListener('click', cerrarScanner);

    function aplicarFiltroBarcode(code) {
      var searchInput = document.getElementById('filtro-inv-search');
      if (searchInput) {
        searchInput.value = code;
        searchInput.dispatchEvent(new Event('input'));
      }
    }

    btnAbrir.addEventListener('click', function () {
      modal.classList.remove('hidden');
      if (statusEl) statusEl.textContent = 'Activando cámara trasera...';

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (statusEl) statusEl.textContent = 'Cámara no soportada en este navegador. Usa el campo manual.';
        return;
      }

      navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      }).then(function (stream) {
        mediaStreamGlobal = stream;
        if (video) video.srcObject = stream;
        if (statusEl) statusEl.textContent = 'Cámara activa. Escaneando código...';

        if ('BarcodeDetector' in window && video) {
          var detector = new BarcodeDetector({ formats: ['ean_13', 'code_128', 'qr_code'] });
          var intervalId = setInterval(function () {
            if (!mediaStreamGlobal || modal.classList.contains('hidden')) {
              clearInterval(intervalId);
              return;
            }
            detector.detect(video).then(function (barcodes) {
              if (barcodes.length > 0) {
                var code = barcodes[0].rawValue;
                clearInterval(intervalId);
                cerrarScanner();
                aplicarFiltroBarcode(code);
              }
            }).catch(function () {});
          }, 500);
        }
      }).catch(function () {
        if (statusEl) statusEl.textContent = 'No se pudo acceder a la cámara. Usa el ingreso manual abajo.';
      });
    });

    if (manualBtn && manualInput) {
      manualBtn.addEventListener('click', function () {
        var val = (manualInput.value || '').trim();
        if (val) {
          cerrarScanner();
          aplicarFiltroBarcode(val);
        }
      });
      manualInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          manualBtn.click();
        }
      });
    }
  }

  if (global.LpsErp) {
    global.LpsErp.registerModule('wmsScanner', {
      generarBarrasSvg: generarBarrasSvg,
      abrirModalEtiquetaEan: abrirModalEtiquetaEan,
      initCamaraScannerWMS: initCamaraScannerWMS
    });
  }
})(window);
