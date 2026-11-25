// public/js/taller-artesano.js
// Sprint 3 (Punto 3): Mini-Portal Móvil para Artesanos Tercerizados (Magic Link)
// Soporta múltiples solicitudes simultáneas de distintos clientes, especificaciones técnicas
// (cotización, onzas, tamaños, colores, logos), flujo Modelado -> 1° Horno -> 2° Horno -> Pintado -> QA -> Envío a Taller.
(function () {
  const NEGOCIO = 'artesanitas';
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token') || '';

  const errorBox = document.getElementById('portal-error');
  const dashboard = document.getElementById('portal-dashboard');
  const headerNombre = document.getElementById('header-artesano-nombre');
  const btnReload = document.getElementById('btn-reload-portal');
  const btnWaAdmin = document.getElementById('btn-wa-admin');
  const solicitudesContainer = document.getElementById('solicitudes-container');
  const solicitudesEmpty = document.getElementById('solicitudes-empty');

  let solicitudesCache = [];
  let filtroActual = 'todos';
  let whatsappTaller = '51929938466';

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  const ETAPAS_ARTESANO = [
    { key: 'recibido', short: '1. Recibido', label: '1. Solicitud recibida' },
    { key: 'modelado', short: '2. Modelado', label: '2. En Modelado (arcilla, onzas y forma)' },
    { key: 'primer_horno', short: '3. 1° Horno', label: '3. Primer Horno (Bizcocho)' },
    { key: 'segundo_horno', short: '4. 2° Horno', label: '4. Segundo Horno (Alta temp.)' },
    { key: 'pintado_acabados', short: '5. Pintado', label: '5. Pintado, Logos y Detalles' },
    { key: 'listo_revision_qa', short: '6. Listo p/ QA', label: '6. Listo para Revisión QA Artesanitas' },
    { key: 'enviado_taller', short: '7. Enviado Taller', label: '7. Enviado al Taller Artesanitas' }
  ];

  function semaforoFecha(fechaCompromiso, etapa) {
    if (etapa === 'enviado_taller') {
      return {
        color: 'bg-green-100 text-green-800 border-green-300',
        dot: '🟢',
        texto: 'Entregado a Taller Artesanitas',
        urgente: false
      };
    }
    if (!fechaCompromiso) {
      return {
        color: 'bg-stone-100 text-stone-700 border-stone-300',
        dot: '⚪',
        texto: 'Fecha por confirmar con Admin',
        urgente: false
      };
    }
    const clean = String(fechaCompromiso).slice(0, 10);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const parts = clean.split('-');
    const compDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    const diffDays = Math.ceil((compDate - hoy) / (1000 * 60 * 60 * 24));
    const fechaFmt = compDate.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' });

    if (diffDays < 0) {
      return {
        color: 'bg-red-100 text-red-800 border-red-300',
        dot: '🔴',
        texto: `Atrasado (${Math.abs(diffDays)}d) · Venció ${fechaFmt}`,
        urgente: true
      };
    }
    if (diffDays <= 2) {
      return {
        color: 'bg-amber-100 text-amber-900 border-amber-300',
        dot: '🟡',
        texto: diffDays === 0 ? `Vence HOY (${fechaFmt})` : `Vence en ${diffDays}d (${fechaFmt})`,
        urgente: true
      };
    }
    return {
      color: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      dot: '🟢',
      texto: `A tiempo · Entrega: ${fechaFmt} (${diffDays}d)`,
      urgente: false
    };
  }

  function renderQaBanner(sol) {
    const chk = sol.qa_checklist || {};
    const badges = [
      { label: 'Onzas / Capacidad', ok: !!chk.onzas },
      { label: 'Logos / Marca', ok: !!chk.logos },
      { label: 'Colores / Esmalte', ok: !!chk.colores },
      { label: 'Medidas / Acabados', ok: !!chk.acabados }
    ];

    if (sol.qa_estado === 'aprobado') {
      return `
        <div class="bg-green-50 border border-green-200 rounded-2xl p-3.5 space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-extrabold text-green-800">✅ Control de Calidad (QA) Aprobado por Artesanitas</span>
            <span class="text-[10px] font-bold bg-green-700 text-white px-2 py-0.5 rounded-full">Autorizado para envío</span>
          </div>
          <p class="text-[11px] text-green-700">El administrador verificó que las onzas, logos, colores y medidas cumplen exactamente con lo solicitado. Ya puedes enviarlo al taller de Artesanitas.</p>
          ${sol.qa_observaciones ? `<p class="text-[11px] font-medium text-green-900 bg-white/80 p-2 rounded-xl border border-green-200">Nota Admin: ${escapeHtml(sol.qa_observaciones)}</p>` : ''}
        </div>
      `;
    }

    if (sol.qa_estado === 'observado') {
      return `
        <div class="bg-red-50 border-2 border-red-200 rounded-2xl p-3.5 space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-extrabold text-red-800">⚠️ Observación de Control de Calidad (QA Artesanitas)</span>
            <span class="text-[10px] font-bold bg-red-600 text-white px-2 py-0.5 rounded-full">Corregir detalle</span>
          </div>
          <p class="text-xs font-semibold text-red-700">${escapeHtml(sol.qa_observaciones || 'El administrador indicó revisar variación en onzas, logo o color antes de enviar al taller.')}</p>
          <div class="flex flex-wrap gap-1.5 pt-1">
            ${badges.map(b => `<span class="text-[10px] px-2 py-0.5 rounded-full font-semibold ${b.ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">${b.ok ? '✓' : '✗'} ${b.label}</span>`).join('')}
          </div>
        </div>
      `;
    }

    if (sol.etapa_artesano === 'listo_revision_qa') {
      return `
        <div class="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 space-y-1.5">
          <span class="text-xs font-bold text-amber-900 block">⏳ Pendiente de Validación QA por Administrador de Artesanitas</span>
          <p class="text-[11px] text-amber-800">Informaste que el pedido está listo. El administrador revisará que no existan variaciones en onzas, logos o colores para autorizar el envío al taller.</p>
        </div>
      `;
    }

    return '';
  }

  function renderSolicitudes() {
    if (!solicitudesContainer) return;

    const filtradas = solicitudesCache.filter(s => {
      if (filtroActual === 'hornos') return ['recibido', 'modelado', 'primer_horno', 'segundo_horno'].includes(s.etapa_artesano);
      if (filtroActual === 'pintado') return s.etapa_artesano === 'pintado_acabados';
      if (filtroActual === 'qa') return ['listo_revision_qa', 'enviado_taller'].includes(s.etapa_artesano);
      return true;
    });

    if (solicitudesEmpty) {
      solicitudesEmpty.classList.toggle('hidden', filtradas.length > 0);
    }

    solicitudesContainer.innerHTML = filtradas.map((sol, idx) => {
      const sem = semaforoFecha(sol.fecha_compromiso_artesano, sol.etapa_artesano);
      const etapaIdx = ETAPAS_ARTESANO.findIndex(e => e.key === sol.etapa_artesano);
      const itemsHtml = Array.isArray(sol.items) && sol.items.length > 0
        ? sol.items.map(it => `
            <div class="flex items-center gap-2.5 bg-[#F9F6F0] p-2.5 rounded-xl border border-[#EBE5DE]">
              ${it.imagen ? `<img src="${escapeHtml(it.imagen)}" alt="${escapeHtml(it.nombre)}" onerror="this.style.display='none'" class="w-11 h-11 rounded-lg object-cover border border-[#EBE5DE] shrink-0">` : ''}
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5">
                  <span class="bg-[#B87352] text-white text-xs font-extrabold px-2 py-0.5 rounded-md">${Number(it.cantidad || 1)} und.</span>
                  <span class="font-bold text-xs sm:text-sm text-[#4A3C31] truncate">${escapeHtml(it.nombre)}</span>
                </div>
              </div>
            </div>
          `).join('')
        : `
            <div class="flex items-center gap-2 bg-[#F9F6F0] p-2.5 rounded-xl border border-[#EBE5DE]">
              <span class="bg-[#B87352] text-white text-xs font-extrabold px-2 py-0.5 rounded-md">${Number(sol.cantidad || 1)} und.</span>
              <span class="font-bold text-xs sm:text-sm text-[#4A3C31]">${escapeHtml(sol.producto_nombre)}</span>
            </div>
          `;

      const waMsg = `Hola Admin Artesanitas! Soy del taller artesano. Consulto sobre la solicitud #${idx + 1} (${sol.codigo_pedido} - ${sol.producto_nombre}). Etapa actual: ${sol.etapa_artesano}.`;

      return `
        <article class="bg-white rounded-3xl border border-[#EBE5DE] shadow-xs overflow-hidden">
          <!-- Cabecera con N° de Solicitud, Código de Orden y Semáforo -->
          <div class="p-4 sm:p-5 bg-gradient-to-r from-[#F9F6F0] to-white border-b border-[#EBE5DE] flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-2.5">
              <span class="w-7 h-7 rounded-xl bg-[#4A3C31] text-white text-xs font-extrabold flex items-center justify-center">
                #${idx + 1}
              </span>
              <div>
                <div class="flex items-center gap-2">
                  <span class="font-mono font-extrabold text-sm sm:text-base text-[#4A3C31]">${escapeHtml(sol.codigo_pedido)}</span>
                  <span class="text-xs font-bold text-[#B87352] bg-[#B87352]/10 px-2 py-0.5 rounded-full">
                    ${Number(sol.cantidad || 1)} ${Number(sol.cantidad || 1) === 1 ? 'pieza' : 'piezas'}
                  </span>
                </div>
                <span class="text-[11px] text-[#8C7A6B]">Solicitud de Cliente asignada por Admin Artesanitas</span>
              </div>
            </div>
            <span class="text-xs font-bold px-3 py-1 rounded-full border ${sem.color}">
              ${sem.dot} ${escapeHtml(sem.texto)}
            </span>
          </div>

          <div class="p-4 sm:p-5 space-y-4">
            <!-- Piezas a producir -->
            <div class="space-y-2">
              <span class="text-[11px] font-bold uppercase tracking-wider text-[#8C7A6B] block">Piezas Solicitadas</span>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                ${itemsHtml}
              </div>
            </div>

            <!-- Ficha de Especificaciones del Administrador (Cotización, Tamaños/Onzas, Colores, Logos) -->
            <div class="bg-[#FAF4EE] border border-[#B87352]/30 rounded-2xl p-3.5 sm:p-4 space-y-2">
              <div class="flex items-center justify-between gap-2">
                <span class="text-xs font-extrabold text-[#4A3C31] uppercase tracking-wider flex items-center gap-1.5">
                  <span>📋 Detalles y Especificaciones del Administrador</span>
                </span>
                ${sol.cotizacion_artesano !== null ? `
                  <span class="bg-white border border-[#B87352]/40 text-[#008f6b] font-extrabold text-xs px-2.5 py-1 rounded-xl">
                    Cotización Taller: S/ ${Number(sol.cotizacion_artesano).toFixed(2)}
                  </span>
                ` : ''}
              </div>
              <p class="text-xs sm:text-sm text-[#4A3C31] whitespace-pre-line leading-relaxed bg-white/90 p-3 rounded-xl border border-[#EBE5DE]">
                ${sol.especificaciones_artesano
                  ? escapeHtml(sol.especificaciones_artesano)
                  : 'Verificar medidas estándar, capacidad en onzas, colores de esmalte y detalles de acabado según muestra oficial de Artesanitas.'}
              </p>
            </div>

            ${renderQaBanner(sol)}

            <!-- Botonera de Etapas de Producción en 1 Toque -->
            <div class="space-y-2 pt-1">
              <div class="flex items-center justify-between">
                <span class="text-[11px] font-bold uppercase tracking-wider text-[#8C7A6B]">Actualizar Etapa de Producción (1 toque)</span>
                <span class="text-xs font-bold text-[#B87352]">
                  ${escapeHtml((ETAPAS_ARTESANO[etapaIdx] && ETAPAS_ARTESANO[etapaIdx].label) || '1. Solicitud recibida')}
                </span>
              </div>

              <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5">
                ${ETAPAS_ARTESANO.map((et, i) => {
                  const isCurrent = et.key === sol.etapa_artesano;
                  const isDone = i < etapaIdx;
                  const btnCls = isCurrent
                    ? 'bg-[#B87352] text-white border-[#B87352] shadow-sm font-extrabold'
                    : isDone
                      ? 'bg-[#008f6b]/10 text-[#008f6b] border-[#008f6b]/30 font-semibold hover:bg-[#008f6b]/20'
                      : 'bg-[#F9F6F0] text-[#4A3C31] border-[#D5C9BD] font-medium hover:border-[#B87352]';
                  return `
                    <button type="button"
                      data-pedido-id="${sol.id}"
                      data-etapa="${et.key}"
                      class="btn-set-etapa py-2.5 px-2 rounded-xl border text-[11px] text-center transition-all cursor-pointer ${btnCls}">
                      ${isDone ? '✓ ' : ''}${escapeHtml(et.short)}
                    </button>
                  `;
                }).join('')}
              </div>
            </div>

            <!-- Acciones Rápidas de Reporte a Artesanitas -->
            <div class="pt-2 border-t border-[#F1EDE7] flex flex-wrap items-center justify-between gap-2">
              <a href="https://wa.me/${whatsappTaller}?text=${encodeURIComponent(waMsg)}"
                target="_blank" rel="noreferrer"
                class="text-xs font-semibold text-[#008f6b] hover:underline flex items-center gap-1">
                <span>📲 Enviar foto de avance / consultar a Admin por WhatsApp</span>
              </a>
              ${sol.etapa_artesano !== 'listo_revision_qa' && sol.etapa_artesano !== 'enviado_taller' ? `
                <button type="button" data-pedido-id="${sol.id}" data-etapa="listo_revision_qa"
                  class="btn-set-etapa bg-[#4A3C31] hover:bg-[#B87352] text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-colors cursor-pointer">
                  🔍 Informar: Listo para Revisión QA
                </button>
              ` : ''}
            </div>
          </div>
        </article>
      `;
    }).join('');

    solicitudesContainer.querySelectorAll('.btn-set-etapa').forEach(btn => {
      btn.addEventListener('click', async () => {
        const pedidoId = btn.dataset.pedidoId;
        const nuevaEtapa = btn.dataset.etapa;
        btn.disabled = true;
        const originalText = btn.textContent;
        btn.textContent = 'Guardando...';
        try {
          const res = await fetch(`/api/negocios/${NEGOCIO}/artesano-portal/${encodeURIComponent(token)}/pedido/${pedidoId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ etapa_artesano: nuevaEtapa })
          });
          const data = await res.json();
          if (res.ok && data.success) {
            await cargarPortal();
          } else {
            alert(data.message || 'No se pudo actualizar la etapa.');
            btn.disabled = false;
            btn.textContent = originalText;
          }
        } catch {
          alert('Error de conexión.');
          btn.disabled = false;
          btn.textContent = originalText;
        }
      });
    });
  }

  async function cargarPortal() {
    if (!token) {
      if (errorBox) errorBox.classList.remove('hidden');
      if (dashboard) dashboard.classList.add('hidden');
      return;
    }

    try {
      const res = await fetch(`/api/negocios/${NEGOCIO}/artesano-portal/${encodeURIComponent(token)}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (errorBox) errorBox.classList.remove('hidden');
        if (dashboard) dashboard.classList.add('hidden');
        return;
      }

      if (errorBox) errorBox.classList.add('hidden');
      if (dashboard) dashboard.classList.remove('hidden');

      if (data.artesano && headerNombre) {
        headerNombre.textContent = `Taller: ${data.artesano.nombre}`;
      }
      if (data.negocio && data.negocio.whatsapp_taller) {
        whatsappTaller = String(data.negocio.whatsapp_taller).replace(/\D/g, '');
        if (btnWaAdmin) btnWaAdmin.href = `https://wa.me/${whatsappTaller}`;
      }

      solicitudesCache = Array.isArray(data.solicitudes) ? data.solicitudes : [];

      const activos = solicitudesCache.filter(s => s.etapa_artesano !== 'enviado_taller').length;
      const urgentes = solicitudesCache.filter(s => semaforoFecha(s.fecha_compromiso_artesano, s.etapa_artesano).urgente).length;
      const enQa = solicitudesCache.filter(s => s.etapa_artesano === 'listo_revision_qa').length;
      const totalCotizado = solicitudesCache.reduce((sum, s) => sum + Number(s.cotizacion_artesano || 0), 0);

      const elAct = document.getElementById('kpi-art-activos'); if (elAct) elAct.textContent = activos;
      const elUrg = document.getElementById('kpi-art-urgentes'); if (elUrg) elUrg.textContent = urgentes;
      const elQa = document.getElementById('kpi-art-qa'); if (elQa) elQa.textContent = enQa;
      const elCot = document.getElementById('kpi-art-cotizacion'); if (elCot) elCot.textContent = `S/ ${totalCotizado.toFixed(2)}`;

      renderSolicitudes();
    } catch {
      if (errorBox) errorBox.classList.remove('hidden');
    }
  }

  document.querySelectorAll('.btn-art-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      filtroActual = btn.dataset.filter || 'todos';
      document.querySelectorAll('.btn-art-filter').forEach(b => {
        const active = b === btn;
        b.className = active
          ? 'btn-art-filter px-3.5 py-2 rounded-xl text-xs font-bold bg-[#4A3C31] text-white cursor-pointer'
          : 'btn-art-filter px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-[#D5C9BD] text-[#4A3C31] cursor-pointer';
      });
      renderSolicitudes();
    });
  });

  if (btnReload) btnReload.addEventListener('click', cargarPortal);

  cargarPortal();
})();
