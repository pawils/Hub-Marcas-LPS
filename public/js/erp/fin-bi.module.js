/* public/js/erp/fin-bi.module.js
 * Módulo FIN · Business Intelligence & Rentabilidad por Jerarquía Retail y Artesano
 */
(function (global) {
  'use strict';

  async function loadBiResumen(apiFetch) {
    var escapeHtml = global.LpsErp ? global.LpsErp.escapeHtml : function (s) { return String(s || ''); };
    try {
      var res = await apiFetch('/bi-resumen');
      if (!res.ok) return;
      var data = await res.json();
      if (!data || !data.success) return;

      var f = data.finanzas || {};
      var jerarquia = Array.isArray(data.jerarquia_retail) ? data.jerarquia_retail : [];
      var artesanos = Array.isArray(data.artesanos) ? data.artesanos : [];

      var ventasTotales = Number(f.ventas_totales || 0);
      var totalAbonado = Number(f.total_abonado || 0);
      var saldosCobrar = Number(f.saldos_por_cobrar || 0);
      var costoArtesanos = Number(f.costo_total_artesanos || 0);
      var margenSoles = Number(f.margen_bruto_soles || 0);
      var margenPct = Number(f.margen_bruto_pct || 0);
      var totalPedidos = Number(f.total_pedidos || 0);
      var totalPiezas = Number(f.total_piezas || 0);

      var elVentas = document.getElementById('bi-kpi-ventas');
      if (elVentas) elVentas.textContent = 'S/ ' + ventasTotales.toFixed(2);
      var elPedSub = document.getElementById('bi-kpi-pedidos-sub');
      if (elPedSub) elPedSub.textContent = totalPedidos + ' ' + (totalPedidos === 1 ? 'pedido activo' : 'pedidos activos') + ' · ' + totalPiezas + ' ' + (totalPiezas === 1 ? 'pieza' : 'piezas');

      var elAbonado = document.getElementById('bi-kpi-abonado');
      if (elAbonado) elAbonado.textContent = 'S/ ' + totalAbonado.toFixed(2);
      var pctCobrado = ventasTotales > 0 ? Math.round((totalAbonado / ventasTotales) * 100) : 0;
      var elAbonadoSub = document.getElementById('bi-kpi-abonado-sub');
      if (elAbonadoSub) elAbonadoSub.textContent = pctCobrado + '% del valor total recaudado';

      var elSaldos = document.getElementById('bi-kpi-saldos');
      if (elSaldos) elSaldos.textContent = 'S/ ' + saldosCobrar.toFixed(2);

      var elCostoArt = document.getElementById('bi-kpi-costo-art');
      if (elCostoArt) elCostoArt.textContent = 'S/ ' + costoArtesanos.toFixed(2);

      var elMargenSoles = document.getElementById('bi-kpi-margen-soles');
      if (elMargenSoles) elMargenSoles.textContent = 'S/ ' + margenSoles.toFixed(2);

      var elMargenPct = document.getElementById('bi-kpi-margen-pct');
      if (elMargenPct) {
        elMargenPct.textContent = margenPct.toFixed(1) + '%';
        elMargenPct.className = margenPct >= 50
          ? 'bg-[#008f6b] text-white text-[11px] font-extrabold px-2 py-0.5 rounded-full'
          : (margenPct >= 30 ? 'bg-[#B87352] text-white text-[11px] font-extrabold px-2 py-0.5 rounded-full' : 'bg-red-600 text-white text-[11px] font-extrabold px-2 py-0.5 rounded-full');
      }

      var barsContainer = document.getElementById('bi-colecciones-bars');
      var barsEmpty = document.getElementById('bi-colecciones-empty');
      if (barsEmpty) barsEmpty.classList.toggle('hidden', jerarquia.length > 0);
      if (barsContainer) {
        var totalVentasJerarquia = jerarquia.reduce(function (acc, r) { return acc + Number(r.ventas_soles || 0); }, 0) || 1;
        barsContainer.innerHTML = jerarquia.map(function (item) {
          var vSoles = Number(item.ventas_soles || 0);
          var cSoles = Number(item.costo_artesano_soles || 0);
          var mSoles = Number(item.margen_soles || 0);
          var sharePct = Math.min(100, Math.round((vSoles / totalVentasJerarquia) * 100));
          var itemMargenPct = vSoles > 0 ? Math.round((mSoles / vSoles) * 100) : 0;

          return '<div class="p-3.5 rounded-2xl bg-[#F9F6F0] border border-[#EBE5DE] space-y-2">' +
            '<div class="flex items-start justify-between gap-2">' +
            '<div>' +
            '<span class="text-[10px] font-bold uppercase tracking-wider text-[#8C7A6B] block">' +
            escapeHtml(item.linea) + ' → ' + escapeHtml(item.sublinea) +
            '</span>' +
            '<h4 class="text-sm font-bold text-[#4A3C31]">' + escapeHtml(item.coleccion) + '</h4>' +
            '</div>' +
            '<div class="text-right shrink-0">' +
            '<span class="text-sm font-extrabold text-[#4A3C31] block">S/ ' + vSoles.toFixed(2) + '</span>' +
            '<span class="text-[11px] text-[#008f6b] font-semibold">Margen: S/ ' + mSoles.toFixed(2) + ' (' + itemMargenPct + '%)</span>' +
            '</div>' +
            '</div>' +
            '<div class="w-full h-2.5 bg-[#EBE5DE] rounded-full overflow-hidden">' +
            '<div class="h-full bg-gradient-to-r from-[#B87352] to-[#4A3C31] rounded-full transition-all duration-500" style="width: ' + Math.max(4, sharePct) + '%"></div>' +
            '</div>' +
            '<div class="flex items-center justify-between text-[11px] text-[#8C7A6B]">' +
            '<span><strong>' + Number(item.piezas || 0) + '</strong> piezas en <strong>' + Number(item.pedidos || 0) + '</strong> pedidos</span>' +
            '<span>Costo: S/ ' + cSoles.toFixed(2) + ' · <strong>' + sharePct + '%</strong> de ventas</span>' +
            '</div>' +
            '</div>';
        }).join('');
      }

      var artTbody = document.getElementById('bi-artesanos-tbody');
      var artEmpty = document.getElementById('bi-artesanos-empty');
      if (artEmpty) artEmpty.classList.toggle('hidden', artesanos.length > 0);
      if (artTbody) {
        artTbody.innerHTML = artesanos.map(function (a) {
          var aTiempo = Number(a.entregados_a_tiempo || 0);
          var atrasados = Number(a.atrasados || 0);
          var enProd = Number(a.en_produccion || 0);
          var evaluados = aTiempo + atrasados;
          var puntualidadPct = evaluados > 0 ? Math.round((aTiempo / evaluados) * 100) : 100;

          return '<tr class="hover:bg-[#F9F6F0]/60 transition-colors">' +
            '<td class="py-3 pr-3">' +
            '<div class="font-bold text-[#4A3C31]">' + escapeHtml(a.artesano) + '</div>' +
            '<span class="text-[11px] text-[#8C7A6B]">' + (enProd > 0 ? (enProd + ' en taller/producción') : 'Al día') + '</span>' +
            '</td>' +
            '<td class="py-3 px-2 text-center">' +
            '<span class="font-bold text-[#4A3C31]">' + Number(a.pedidos_asignados || 0) + '</span>' +
            '<span class="text-xs text-[#8C7A6B] block">' + Number(a.piezas_asignadas || 0) + ' piezas</span>' +
            '</td>' +
            '<td class="py-3 px-2 text-center">' +
            '<div class="inline-flex items-center gap-1.5">' +
            '<span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-green-50 text-green-700 border border-green-200">' + aTiempo + ' a tiempo</span>' +
            '<span class="px-2 py-0.5 rounded-full text-[11px] font-bold ' + (atrasados > 0 ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-[#F1EDE7] text-[#8C7A6B]') + '">' + atrasados + ' atrasados</span>' +
            '</div>' +
            '<span class="block text-[10px] font-semibold ' + (atrasados > 0 ? 'text-amber-700' : 'text-[#008f6b]') + ' mt-0.5">' +
            (evaluados > 0 ? (puntualidadPct + '% puntualidad') : 'En plazo') +
            '</span>' +
            '</td>' +
            '<td class="py-3 pl-2 text-right">' +
            '<span class="font-bold text-[#742284] block">S/ ' + Number(a.pago_acumulado || 0).toFixed(2) + '</span>' +
            '<span class="text-[11px] text-[#8C7A6B]">Ventas: S/ ' + Number(a.ventas_generadas || 0).toFixed(2) + '</span>' +
            '</td>' +
            '</tr>';
        }).join('');
      }
    } catch (e) {
      console.error('Error cargando resumen BI:', e);
    }
  }

  if (global.LpsErp) {
    global.LpsErp.registerModule('bi', { loadBiResumen: loadBiResumen });
  }
})(window);
