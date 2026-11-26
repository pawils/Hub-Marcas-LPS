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

  // 5 etapas simples y claras para el cliente final
  const STAGES = [
    {
      key: 'ingresado_produccion',
      title: '1. Pedido ingresado a producción',
      desc: 'Tu pedido fue confirmado e ingresó a modelado y horneado artesanal.'
    },
    {
      key: 'acabados_pintado',
      title: '2. En proceso de acabados o pintado',
      desc: 'Tus piezas están en pintura a mano, personalización de detalles y control de calidad.'
    },
    {
      key: 'pedido_listo',
      title: '3. Pedido listo',
      desc: 'Tu pedido superó el control de calidad en el taller de Artesanitas y está listo para despacho.'
    },
    {
      key: 'en_envio',
      title: '4. En envío por agencia, Shalom u otra courier',
      desc: 'Tu pedido va en camino hacia tu ciudad de destino con embalaje protector.'
    },
    {
      key: 'post_venta',
      title: '5. Post venta',
      desc: '¡Pedido entregado! Estamos atentos a tu experiencia con tus piezas Artesanitas.'
    }
  ];

  function getStageIndex(p) {
    const estado = typeof p === 'string' ? p : (p && p.estado_pedido);
    const etapaArt = (p && p.etapa_artesano) || '';

    if (estado === 'entregado' || estado === 'post_venta') return 4;
    if (estado === 'enviado') return 3;
    if (estado === 'recibido_taller' || etapaArt === 'enviado_taller') return 2;
    if (estado === 'en_produccion' || etapaArt === 'pintado_acabados' || etapaArt === 'listo_revision_qa') return 1;
    return 0; // cotizado, reservado, encargado_artesano (modelado, 1° horno, 2° horno)
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
    const currentIdx = getStageIndex(p);
    const esLocal = p.tipo_entrega === 'recojo_local';
    const saldo = Math.max(0, Number(p.saldo_pendiente || 0));
    const total = Number(p.producto_precio || 0);
    const pagado = Number(p.monto_pagado || 0);
    const envio = Number(p.costo_envio || 0);
    const empresaCourier = p.empresa_envio || 'Shalom';
    const destinoTxt = p.ciudad_destino
      ? `${p.ciudad_destino}${p.sede_shalom ? ' · ' + p.sede_shalom : ''}`
      : (p.sede_shalom || 'Taller Trujillo');

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
      : `<div class="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
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
              <div class="p-3 rounded-2xl ${boxClass} flex flex-col justify-between">
                <div class="space-y-1.5">
                  <span class="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${badgeClass}">
                    ${done ? '✓' : idx + 1}
                  </span>
                  <h4 class="font-serif font-bold text-xs text-[#4A3C31] leading-snug">${escapeHtml(st.title.replace(/^\d+\.\s*/, ''))}</h4>
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
             <span class="text-[10px] font-bold uppercase tracking-wider text-[#742284] flex items-center gap-1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14v10Z"/><circle cx="17" cy="18.5" r="2.5"/><circle cx="7" cy="18.5" r="2.5"/></svg> Guía / Ticket de Envío (${escapeHtml(empresaCourier)})</span>
             <p class="text-base sm:text-lg font-mono font-extrabold text-[#4A3C31] mt-0.5">${escapeHtml(p.guia_envio)}</p>
             <span class="text-xs text-[#8C7A6B]">Ciudad / Agencia destino: ${escapeHtml(destinoTxt)}</span>
           </div>
           <a href="https://rastrea.shalom.pe/" target="_blank" rel="noreferrer"
             class="bg-[#742284] hover:bg-[#5b1968] text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors text-center shrink-0">
             Abrir Rastreo ${escapeHtml(empresaCourier)} ↗
           </a>
         </div>`
      : '';

    const waMsg = `Hola Artesanitas! Consulto por mi pedido con código ${p.codigo_pedido} (${p.producto_nombre}).`;

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
            <span class="text-sm sm:text-base font-bold text-[#F9F6F0] flex items-center gap-1.5"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg> ${escapeHtml(fmtFecha(p.fecha_entrega))}</span>
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
                    <span class="flex items-center justify-center gap-1.5"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg> Pagar Saldo con Mercado Pago (S/ ${saldo.toFixed(2)})</span>
                  </button>
                ` : ''}
                <button type="button" data-push-codigo="${escapeHtml(p.codigo_pedido)}"
                  class="btn-activar-push w-full bg-[#4A3C31] hover:bg-[#322821] text-white font-semibold py-2.5 px-4 rounded-xl text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer">
                  <span class="flex items-center justify-center gap-1.5"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg> Recibir alerta Push cuando salga mi envío</span>
                </button>
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

      // Sprint 6: Suscripción Web Push del comprador asociada a su codigo_pedido
      resultsContainer.querySelectorAll('.btn-activar-push').forEach(btn => {
        btn.addEventListener('click', async () => {
          const cod = btn.dataset.pushCodigo;
          if (!('serviceWorker' in navigator) || !('Notification' in window)) {
            await window.LpsModal.alert('Tu navegador no soporta notificaciones Web Push.', 'warning');
            return;
          }
          try {
            const perm = await Notification.requestPermission();
            if (perm !== 'granted') {
              await window.LpsModal.alert('Permiso de notificaciones denegado.', 'warning');
              return;
            }
            const reg = await navigator.serviceWorker.register('/sw.js');
            let sub = await reg.pushManager.getSubscription();
            if (!sub) {
              const keyRes = await fetch(`/api/negocios/${NEGOCIO}/push/vapid-public-key`);
              const keyData = await keyRes.json();
              if (keyData && keyData.publicKey) {
                const padding = '='.repeat((4 - (keyData.publicKey.length % 4)) % 4);
                const base64 = (keyData.publicKey + padding).replace(/-/g, '+').replace(/_/g, '/');
                const rawData = window.atob(base64);
                const appServerKey = Uint8Array.from([...rawData].map(ch => ch.charCodeAt(0)));
                sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appServerKey });
              }
            }
            if (sub) {
              await fetch(`/api/negocios/${NEGOCIO}/push/subscribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rol: 'comprador', codigo_pedido: cod, subscription: sub.toJSON() })
              });
            }
            btn.textContent = 'Alertas Push activadas en este dispositivo';
            btn.classList.replace('bg-[#4A3C31]', 'bg-[#007A78]');
          } catch {
            btn.textContent = 'Notificaciones del navegador activadas';
          }
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
              await window.LpsModal.alert(mpData.message || 'No se pudo iniciar Mercado Pago.', 'error');
              btn.disabled = false;
              btn.textContent = 'Pagar Saldo con Mercado Pago';
            }
          } catch {
            await window.LpsModal.alert('Error de conexión con la pasarela.', 'error');
            btn.disabled = false;
            btn.textContent = 'Pagar Saldo con Mercado Pago';
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
