// public/artesanitas/js/seguimiento.js
// Portal público de seguimiento de pedidos en vivo para Artesanitas Perú
(function () {
  const NEGOCIO = 'artesanitas';
  const WHATSAPP_NUM = '51929938466';

  const form = document.getElementById('tracking-form');
  const queryInput = document.getElementById('tracking-query');
  const btnBuscar = document.getElementById('btn-buscar-tracking');
  const errorBox = document.getElementById('tracking-error');
  const resultsContainer = document.getElementById('tracking-results');

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function showError(msg) {
    if (!errorBox) return;
    errorBox.textContent = msg;
    errorBox.classList.remove('hidden');
  }

  function hideError() {
    if (!errorBox) return;
    errorBox.classList.add('hidden');
  }

  const STAGES = [
    {
      key: 'reservado',
      title: '1. Reserva Confirmada',
      desc: 'Tu pedido está registrado y programado en nuestro calendario de taller.'
    },
    {
      key: 'en_produccion',
      title: '2. En Taller Artesanal',
      desc: 'Tus piezas están siendo modeladas, horneadas y esmaltadas a mano.'
    },
    {
      key: 'enviado',
      title: '3. Despachado / Listo',
      desc: 'Tu pedido fue embalado con protección especial y enviado o puesto a disposición.'
    },
    {
      key: 'entregado',
      title: '4. Entregado',
      desc: '¡Pedido entregado! Gracias por confiar en el arte hecho a mano.'
    }
  ];

  function getStageIndex(estado) {
    // Mapeo de los 8 estados ERP internos a las 4 etapas visibles para el cliente
    const map = {
      cotizado: 0,
      reservado: 0,
      encargado_artesano: 1,
      en_produccion: 1,
      recibido_taller: 1,
      enviado: 2,
      entregado: 3,
      post_venta: 3
    };
    return map[estado] !== undefined ? map[estado] : 0;
  }

  function fmtFecha(dStr) {
    if (!dStr) return '10 de Diciembre 2026';
    const clean = String(dStr).split('T')[0];
    const parts = clean.split('-');
    if (parts.length !== 3) return dStr;
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return d.toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function renderPedidoCard(p) {
    const isCancelled = p.estado_pedido === 'cancelado';
    const currentIdx = getStageIndex(p.estado_pedido);
    const esLocal = p.tipo_entrega === 'recojo_local';
    const saldo = Math.max(0, Number(p.saldo_pendiente || 0));
    const total = Number(p.producto_precio || 0);
    const pagado = Number(p.monto_pagado || 0);
    const envio = Number(p.costo_envio || 0);

    const itemsHtml = Array.isArray(p.items) && p.items.length > 0
      ? p.items.map(it => `
          <div class="flex items-center justify-between py-2 border-b border-[#F1EDE7] last:border-0 text-xs sm:text-sm">
            <div class="flex items-center gap-2">
              <span class="bg-[#B87352]/15 text-[#B87352] font-bold px-2 py-0.5 rounded-lg text-xs">${Number(it.cantidad || 1)}x</span>
              <span class="font-medium text-[#4A3C31]">${escapeHtml(it.nombre)}</span>
            </div>
            <span class="font-semibold text-[#8C7A6B]">S/ ${(Number(it.precio || 0) * Number(it.cantidad || 1)).toFixed(2)}</span>
          </div>
        `).join('')
      : `
          <div class="flex items-center justify-between py-2 text-xs sm:text-sm">
            <div class="flex items-center gap-2">
              <span class="bg-[#B87352]/15 text-[#B87352] font-bold px-2 py-0.5 rounded-lg text-xs">${Number(p.cantidad || 1)}x</span>
              <span class="font-medium text-[#4A3C31]">${escapeHtml(p.producto_nombre)}</span>
            </div>
            <span class="font-semibold text-[#8C7A6B]">S/ ${total.toFixed(2)}</span>
          </div>
        `;

    const timelineHtml = isCancelled
      ? `<div class="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 text-xs sm:text-sm font-medium">
           Este pedido figura como cancelado. Si crees que es un error, contáctanos por WhatsApp indicando tu código <strong>${escapeHtml(p.codigo_pedido)}</strong>.
         </div>`
      : `<div class="grid grid-cols-1 sm:grid-cols-4 gap-3">
          ${STAGES.map((st, idx) => {
            const isFinished = p.estado_pedido === 'entregado' || p.estado_pedido === 'post_venta';
            const done = idx < currentIdx || isFinished;
            const active = idx === currentIdx && !isFinished;
            const boxClass = active
              ? 'border-2 border-[#B87352] bg-[#B87352]/5 shadow-xs'
              : done
                ? 'border border-[#008f6b]/30 bg-[#00D09C]/5'
                : 'border border-[#EBE5DE] bg-[#F9F6F0]/60 opacity-60';
            const badgeClass = active
              ? 'bg-[#B87352] text-white'
              : done
                ? 'bg-[#008f6b] text-white'
                : 'bg-[#D5C9BD] text-[#4A3C31]';
            return `
              <div class="p-3.5 rounded-2xl ${boxClass} flex flex-col justify-between">
                <div class="space-y-1.5">
                  <span class="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${badgeClass}">
                    ${done ? '✓' : idx + 1}
                  </span>
                  <h4 class="font-serif font-bold text-xs sm:text-sm text-[#4A3C31]">${escapeHtml(st.title.replace(/^\d+\.\s*/, ''))}</h4>
                  <p class="text-[11px] text-[#8C7A6B] leading-relaxed">${escapeHtml(st.desc)}</p>
                </div>
                ${active ? `<span class="mt-2 inline-block text-[10px] font-bold uppercase tracking-wider text-[#B87352]">● Etapa Actual</span>` : ''}
              </div>
            `;
          }).join('')}
        </div>`;

    const guiaBlock = p.guia_envio
      ? `<div class="bg-[#742284]/10 border border-[#742284]/25 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
           <div>
             <span class="text-[10px] font-bold uppercase tracking-wider text-[#742284] block">🚚 Guía / Ticket de Envío (${escapeHtml(p.empresa_envio || 'Shalom')})</span>
             <p class="text-base sm:text-lg font-mono font-extrabold text-[#4A3C31] mt-0.5">${escapeHtml(p.guia_envio)}</p>
             <span class="text-xs text-[#8C7A6B]">Destino: ${escapeHtml(p.sede_shalom || 'Agencia Shalom')}</span>
           </div>
           <a href="https://rastrea.shalom.pe/" target="_blank" rel="noreferrer"
             class="bg-[#742284] hover:bg-[#5b1968] text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors text-center shrink-0">
             Abrir Rastreo Shalom ↗
           </a>
         </div>`
      : '';

    const waMsg = `Hola Artesanitas! ✨ Consulto por mi pedido con código ${p.codigo_pedido} (${p.producto_nombre}).`;

    return `
      <article class="bg-white rounded-3xl shadow-sm border border-[#EBE5DE] overflow-hidden">
        <!-- Cabecera del Pedido -->
        <div class="bg-gradient-to-r from-[#4A3C31] to-[#322821] text-white p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <span class="text-[11px] uppercase tracking-widest text-[#D5C9BD] block">Código de Seguimiento</span>
            <div class="flex items-center gap-2 mt-0.5">
              <h2 class="text-xl sm:text-2xl font-mono font-extrabold text-[#F9F6F0]">${escapeHtml(p.codigo_pedido)}</h2>
              <button type="button" data-copy="${escapeHtml(p.codigo_pedido)}"
                class="btn-copy-codigo text-[11px] bg-white/15 hover:bg-white/25 px-2.5 py-1 rounded-lg transition-colors cursor-pointer">
                Copiar
              </button>
            </div>
          </div>
          <div class="text-left sm:text-right">
            <span class="text-[11px] uppercase tracking-widest text-[#D5C9BD] block">Entrega Estimada</span>
            <span class="text-sm sm:text-base font-bold text-[#F9F6F0]">📅 ${escapeHtml(fmtFecha(p.fecha_entrega))}</span>
          </div>
        </div>

        <div class="p-5 sm:p-6 space-y-6">
          <!-- Línea de Tiempo -->
          <div class="space-y-2.5">
            <h3 class="text-xs font-bold uppercase tracking-wider text-[#8C7A6B]">Estado en Tiempo Real</h3>
            ${timelineHtml}
          </div>

          ${guiaBlock}

          <!-- Resumen de Piezas y Pagos -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="bg-[#F9F6F0] rounded-2xl p-4 border border-[#EBE5DE] space-y-2">
              <h4 class="text-xs font-bold uppercase tracking-wider text-[#8C7A6B]">Piezas Reservadas</h4>
              <div class="divide-y divide-[#EBE5DE]">
                ${itemsHtml}
              </div>
              <div class="pt-2 border-t border-[#D5C9BD] text-xs text-[#8C7A6B] space-y-1">
                <div class="flex justify-between">
                  <span>Modalidad de entrega:</span>
                  <strong class="text-[#4A3C31]">${esLocal ? 'Recojo en Taller Trujillo' : 'Envío Agencia Shalom'}</strong>
                </div>
                <div class="flex justify-between">
                  <span>Sede / Destino:</span>
                  <strong class="text-[#4A3C31]">${escapeHtml(p.sede_shalom || 'Taller Trujillo')}</strong>
                </div>
              </div>
            </div>

            <div class="bg-[#F9F6F0] rounded-2xl p-4 border border-[#EBE5DE] flex flex-col justify-between space-y-3">
              <div class="space-y-2">
                <h4 class="text-xs font-bold uppercase tracking-wider text-[#8C7A6B]">Resumen de Cuenta</h4>
                <div class="space-y-1.5 text-xs sm:text-sm">
                  <div class="flex justify-between text-[#8C7A6B]">
                    <span>Total piezas:</span>
                    <span>S/ ${total.toFixed(2)}</span>
                  </div>
                  <div class="flex justify-between text-[#8C7A6B]">
                    <span>Envío (${esLocal ? 'Taller' : 'Shalom'}):</span>
                    <span>S/ ${envio.toFixed(2)}</span>
                  </div>
                  <div class="flex justify-between text-[#008f6b] font-semibold">
                    <span>Monto abonado:</span>
                    <span>- S/ ${pagado.toFixed(2)}</span>
                  </div>
                  <div class="pt-2 border-t border-[#D5C9BD] flex justify-between items-center text-sm sm:text-base font-bold">
                    <span>Saldo pendiente (al entregar):</span>
                    <span class="${saldo > 0 ? 'text-[#B87352]' : 'text-[#008f6b]'}">
                      ${saldo > 0 ? `S/ ${saldo.toFixed(2)}` : '¡Pagado 100%!'}
                    </span>
                  </div>
                </div>
              </div>

              <div class="pt-2 space-y-2">
                ${p.mp_habilitado && saldo > 0 ? `
                  <button type="button" data-codigo="${escapeHtml(p.codigo_pedido)}"
                    class="btn-pagar-mp w-full bg-[#009EE3] hover:bg-[#0089C7] text-white font-semibold py-2.5 px-4 rounded-xl text-xs sm:text-sm transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer">
                    <span>💳 Pagar Saldo con Mercado Pago (S/ ${saldo.toFixed(2)})</span>
                  </button>
                ` : ''}
                <a href="https://wa.me/${WHATSAPP_NUM}?text=${encodeURIComponent(waMsg)}"
                  target="_blank" rel="noreferrer"
                  class="w-full bg-[#008f6b] hover:bg-[#007759] text-white font-semibold py-2.5 px-4 rounded-xl text-xs sm:text-sm transition-all flex items-center justify-center gap-2">
                  <span>Consultar por WhatsApp sobre este pedido</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </article>
    `;
  }

  async function buscarSeguimiento(rawQuery) {
    const q = String(rawQuery || '').trim();
    if (!q || q.length < 4) {
      showError('Ingresa un código de pedido válido (ej. ART-2026-...) o un DNI de 8 dígitos.');
      return;
    }

    hideError();
    if (btnBuscar) {
      btnBuscar.disabled = true;
      btnBuscar.innerHTML = '<span>Buscando...</span>';
    }

    try {
      const res = await fetch(`/api/negocios/${NEGOCIO}/pedidos/seguimiento?q=${encodeURIComponent(q)}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        resultsContainer.innerHTML = '';
        showError(data.message || 'No encontramos pedidos con ese código o DNI.');
        return;
      }

      const pedidos = data.pedidos || [];
      if (pedidos.length === 0) {
        resultsContainer.innerHTML = '';
        showError('No encontramos pedidos registrados con ese código o DNI.');
        return;
      }

      resultsContainer.innerHTML = pedidos.map(renderPedidoCard).join('');

      resultsContainer.querySelectorAll('.btn-copy-codigo').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(btn.dataset.copy);
            btn.textContent = '¡Copiado!';
            setTimeout(() => { btn.textContent = 'Copiar'; }, 2000);
          } catch {}
        });
      });

      resultsContainer.querySelectorAll('.btn-pagar-mp').forEach(btn => {
        btn.addEventListener('click', async () => {
          const codigo = btn.dataset.codigo;
          btn.disabled = true;
          btn.textContent = 'Generando link de Mercado Pago...';
          try {
            const mpRes = await fetch(`/api/negocios/${NEGOCIO}/pedidos/${encodeURIComponent(codigo)}/checkout-mp`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tipo_cobro: 'saldo' })
            });
            const mpData = await mpRes.json();
            if (mpRes.ok && mpData.init_point) {
              window.location.href = mpData.init_point;
            } else {
              alert(mpData.message || 'No se pudo iniciar Mercado Pago.');
              btn.disabled = false;
              btn.textContent = '💳 Pagar Saldo con Mercado Pago';
            }
          } catch {
            alert('Error de conexión con la pasarela.');
            btn.disabled = false;
            btn.textContent = '💳 Pagar Saldo con Mercado Pago';
          }
        });
      });
    } catch {
      showError('Error de conexión al consultar tu pedido. Intenta nuevamente.');
    } finally {
      if (btnBuscar) {
        btnBuscar.disabled = false;
        btnBuscar.innerHTML = '<span>Consultar Estado</span>';
      }
    }
  }

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      buscarSeguimiento(queryInput ? queryInput.value : '');
    });
  }

  // Auto-búsqueda si viene ?codigo= o ?dni= o ?q= en la URL
  const params = new URLSearchParams(window.location.search);
  const initialQuery = params.get('codigo') || params.get('dni') || params.get('q');
  if (initialQuery && queryInput) {
    queryInput.value = initialQuery;
    buscarSeguimiento(initialQuery);
  }
})();
