// public/artesanitas/js/registros.js
// Lógica modular del panel de gestión de Artesanitas Perú (Talleres, Registros, Pedidos y Catálogo)
(function () {
  const NEGOCIO = 'artesanitas';
  const STORAGE_KEY = 'artesanitas_panel_token';

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  // Mostrar/ocultar contraseña
  document.querySelectorAll('.toggle-password-link').forEach(btn => {
    const input = document.getElementById(btn.dataset.target);
    if (!input) return;
    btn.addEventListener('click', () => {
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      btn.setAttribute('aria-pressed', String(!showing));
      btn.textContent = showing ? 'Mostrar contraseña' : 'Ocultar contraseña';
    });
  });

  const keyGate = document.getElementById('key-gate');
  const panel = document.getElementById('panel');
  const usernameInput = document.getElementById('username-input');
  const keyInput = document.getElementById('key-input');
  const keyError = document.getElementById('key-error');
  const keySubmit = document.getElementById('key-submit');

  function apiUrl(path) {
    return `/api/negocios/${NEGOCIO}${path}`;
  }

  async function apiFetch(path, options = {}) {
    const token = localStorage.getItem(STORAGE_KEY);
    const res = await fetch(apiUrl(path), {
      ...options,
      headers: { ...(options.headers || {}), ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
    });
    if (res.status === 401) {
      localStorage.removeItem(STORAGE_KEY);
      alert('Tu sesión expiró. Vuelve a ingresar.');
      location.reload();
      throw new Error('No autenticado');
    }
    return res;
  }

  function mostrarPanel(negocioNombre) {
    if (keyGate) keyGate.classList.add('hidden');
    if (panel) panel.classList.remove('hidden');
    if (negocioNombre && document.getElementById('panel-negocio-nombre')) {
      document.getElementById('panel-negocio-nombre').textContent = negocioNombre;
    }
    loadTalleres();
    loadRegistros();
    loadPedidos();
    loadProductos();
  }

  async function login(username, password) {
    if (keyError) keyError.classList.add('hidden');
    try {
      const res = await fetch('/api/negocios/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (keyError) {
          keyError.textContent = data.message || 'Usuario o contraseña incorrectos.';
          keyError.classList.remove('hidden');
        }
        return;
      }
      localStorage.setItem(STORAGE_KEY, data.token);
      mostrarPanel(data.negocioNombre);
    } catch {
      if (keyError) {
        keyError.textContent = 'Error de conexión.';
        keyError.classList.remove('hidden');
      }
    }
  }

  if (keySubmit) {
    keySubmit.addEventListener('click', () => {
      const username = usernameInput ? usernameInput.value.trim() : '';
      const password = keyInput ? keyInput.value : '';
      if (username && password) login(username, password);
    });
  }
  [usernameInput, keyInput].forEach(el => {
    if (el) el.addEventListener('keypress', (e) => { if (e.key === 'Enter' && keySubmit) keySubmit.click(); });
  });

  const btnCerrarSesion = document.getElementById('btn-cerrar-sesion');
  if (btnCerrarSesion) {
    btnCerrarSesion.addEventListener('click', () => {
      localStorage.removeItem(STORAGE_KEY);
      location.reload();
    });
  }

  // ── Tabs ──
  const tabBtnTalleres = document.getElementById('tab-btn-talleres');
  const tabBtnRegistros = document.getElementById('tab-btn-registros');
  const tabBtnPedidos = document.getElementById('tab-btn-pedidos');
  const tabBtnProductos = document.getElementById('tab-btn-productos');
  const tabTalleres = document.getElementById('tab-talleres');
  const tabRegistros = document.getElementById('tab-registros');
  const tabPedidos = document.getElementById('tab-pedidos');
  const tabProductos = document.getElementById('tab-productos');

  function activeTabClass(btn, active) {
    if (!btn) return;
    btn.className = active
      ? 'px-3.5 py-2 rounded-lg text-sm font-medium bg-[#B87352] text-white shadow-xs cursor-pointer'
      : 'px-3.5 py-2 rounded-lg text-sm font-medium text-[#8C7A6B] hover:text-[#4A3C31] cursor-pointer';
  }

  function mostrarTab(tab, btn) {
    [tabTalleres, tabRegistros, tabPedidos, tabProductos].forEach(t => {
      if (t) t.classList.toggle('hidden', t !== tab);
    });
    [tabBtnTalleres, tabBtnRegistros, tabBtnPedidos, tabBtnProductos].forEach(b => {
      if (b) activeTabClass(b, b === btn);
    });
  }

  if (tabBtnTalleres) tabBtnTalleres.addEventListener('click', () => mostrarTab(tabTalleres, tabBtnTalleres));
  if (tabBtnRegistros) tabBtnRegistros.addEventListener('click', () => mostrarTab(tabRegistros, tabBtnRegistros));
  if (tabBtnPedidos) tabBtnPedidos.addEventListener('click', () => mostrarTab(tabPedidos, tabBtnPedidos));
  if (tabBtnProductos) tabBtnProductos.addEventListener('click', () => mostrarTab(tabProductos, tabBtnProductos));

  // ── Talleres ──
  let talleresAdminCache = [];
  let editingTallerId = null;

  async function loadTalleres() {
    try {
      const res = await apiFetch('/talleres/admin');
      const data = await res.json();
      talleresAdminCache = (data && data.talleres) || [];

      const filtroTaller = document.getElementById('filtro-taller');
      if (filtroTaller) {
        const seleccionActual = filtroTaller.value;
        filtroTaller.innerHTML = '<option value="">Todos</option>' +
          talleresAdminCache.map(t => `<option value="${t.id}">${escapeHtml(t.nombre)}</option>`).join('');
        filtroTaller.value = seleccionActual;
      }

      renderTalleresTable();
    } catch (e) {
      console.error('Error cargando talleres:', e);
    }
  }

  function talleresFiltrados() {
    const estado = document.getElementById('filtro-taller-estado')?.value || '';
    const ninos = document.getElementById('filtro-taller-ninos')?.value || '';
    const desde = document.getElementById('filtro-taller-desde')?.value || '';
    const hasta = document.getElementById('filtro-taller-hasta')?.value || '';

    return talleresAdminCache.filter(t => {
      if (estado === 'activo' && !t.activo) return false;
      if (estado === 'inactivo' && t.activo) return false;
      if (ninos === 'si' && !t.es_para_ninos) return false;
      if (ninos === 'no' && t.es_para_ninos) return false;
      const fechaTaller = t.fecha ? t.fecha.slice(0, 10) : '';
      if (desde && fechaTaller < desde) return false;
      if (hasta && fechaTaller > hasta) return false;
      return true;
    });
  }

  function renderTalleresTable() {
    const talleres = talleresFiltrados();
    const tbody = document.getElementById('talleres-tbody');
    const empty = document.getElementById('talleres-empty');
    if (empty) empty.classList.toggle('hidden', talleres.length > 0);
    if (!tbody) return;

    tbody.innerHTML = talleres.map(t => {
      const fecha = t.fecha ? new Date(t.fecha.slice(0, 10) + 'T00:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
      return `
        <tr class="border-b border-[#F1EDE7] last:border-0">
          <td data-label="Taller" class="px-4 py-3 font-medium">${escapeHtml(t.nombre)}</td>
          <td data-label="Fecha" class="px-4 py-3 text-[#8C7A6B]">${fecha}${t.hora ? ' · ' + escapeHtml(t.hora) : ''}</td>
          <td data-label="Precio" class="px-4 py-3 text-[#8C7A6B]">${t.precio ? 'S/ ' + Number(t.precio).toFixed(2) : '—'}</td>
          <td data-label="Niños" class="px-4 py-3 text-[#8C7A6B]">${t.es_para_ninos ? 'Sí' : 'No'}</td>
          <td data-label="Inscritos" class="px-4 py-3 text-[#8C7A6B]">${t.inscritos}</td>
          <td data-label="Estado" class="px-4 py-3">
            <span class="text-xs font-medium px-2.5 py-1 rounded-full ${t.activo ? 'bg-green-50 text-green-700' : 'bg-[#F1EDE7] text-[#8C7A6B]'}">
              ${t.activo ? 'Activo' : 'Inactivo'}
            </span>
          </td>
          <td data-label="Acciones" class="px-4 py-3 text-right whitespace-nowrap">
            <button data-id="${t.id}" class="btn-editar-taller text-xs font-medium text-[#B87352] hover:underline mr-3 cursor-pointer">
              Editar
            </button>
            <button data-id="${t.id}" data-activo="${t.activo}" class="btn-toggle-taller text-xs font-medium text-[#B87352] hover:underline cursor-pointer">
              ${t.activo ? 'Desactivar' : 'Activar'}
            </button>
          </td>
        </tr>`;
    }).join('');

    tbody.querySelectorAll('.btn-toggle-taller').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const nuevoActivo = btn.dataset.activo !== 'true';
        await apiFetch(`/talleres/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activo: nuevoActivo })
        });
        loadTalleres();
      });
    });

    tbody.querySelectorAll('.btn-editar-taller').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = talleresAdminCache.find(x => String(x.id) === btn.dataset.id);
        if (!t) return;
        abrirFormTaller(t);
      });
    });
  }

  [document.getElementById('filtro-taller-estado'), document.getElementById('filtro-taller-ninos'), document.getElementById('filtro-taller-desde'), document.getElementById('filtro-taller-hasta')].forEach(el => {
    if (el) el.addEventListener('change', () => renderTalleresTable());
  });
  const btnLimpiarTalleres = document.getElementById('btn-limpiar-filtros-talleres');
  if (btnLimpiarTalleres) {
    btnLimpiarTalleres.addEventListener('click', () => {
      const fe = document.getElementById('filtro-taller-estado'); if (fe) fe.value = '';
      const fn = document.getElementById('filtro-taller-ninos'); if (fn) fn.value = '';
      const fd = document.getElementById('filtro-taller-desde'); if (fd) fd.value = '';
      const fh = document.getElementById('filtro-taller-hasta'); if (fh) fh.value = '';
      renderTalleresTable();
    });
  }

  const btnNuevoTaller = document.getElementById('btn-nuevo-taller');
  const formNuevoTaller = document.getElementById('form-nuevo-taller');
  const formTallerTitulo = document.getElementById('form-taller-titulo');
  const btnGuardarTaller = document.getElementById('btn-guardar-taller');
  const btnCancelarTaller = document.getElementById('btn-cancelar-taller');
  const ntError = document.getElementById('nt-error');

  function abrirFormTaller(taller) {
    editingTallerId = taller ? taller.id : null;
    if (formTallerTitulo) formTallerTitulo.textContent = taller ? 'Editar Taller' : 'Nuevo Taller';
    if (btnGuardarTaller) btnGuardarTaller.textContent = taller ? 'Guardar Cambios' : 'Crear Taller';

    const niNombre = document.getElementById('nt-nombre'); if (niNombre) niNombre.value = taller ? taller.nombre : '';
    const niFecha = document.getElementById('nt-fecha'); if (niFecha) niFecha.value = taller ? taller.fecha.slice(0, 10) : '';
    const niHora = document.getElementById('nt-hora'); if (niHora) niHora.value = taller ? (taller.hora || '') : '';
    const niUbicacion = document.getElementById('nt-ubicacion'); if (niUbicacion) niUbicacion.value = taller ? (taller.ubicacion || '') : '';
    const niPrecio = document.getElementById('nt-precio'); if (niPrecio) niPrecio.value = taller ? (taller.precio ?? '') : '';
    const niNinos = document.getElementById('nt-ninos'); if (niNinos) niNinos.checked = taller ? !!taller.es_para_ninos : false;

    if (ntError) ntError.classList.add('hidden');
    if (formNuevoTaller) formNuevoTaller.classList.remove('hidden');
    if (btnNuevoTaller) btnNuevoTaller.classList.add('hidden');
  }

  function cerrarFormTaller() {
    if (formNuevoTaller) {
      formNuevoTaller.classList.add('hidden');
      formNuevoTaller.reset();
    }
    if (btnNuevoTaller) btnNuevoTaller.classList.remove('hidden');
    editingTallerId = null;
    if (ntError) ntError.classList.add('hidden');
  }

  if (btnNuevoTaller) btnNuevoTaller.addEventListener('click', () => abrirFormTaller());
  if (btnCancelarTaller) btnCancelarTaller.addEventListener('click', cerrarFormTaller);

  if (formNuevoTaller) {
    formNuevoTaller.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (ntError) ntError.classList.add('hidden');

      const body = {
        nombre: document.getElementById('nt-nombre')?.value.trim() || '',
        fecha: document.getElementById('nt-fecha')?.value || '',
        hora: document.getElementById('nt-hora')?.value.trim() || '',
        ubicacion: document.getElementById('nt-ubicacion')?.value.trim() || '',
        precio: document.getElementById('nt-precio')?.value || null,
        es_para_ninos: !!document.getElementById('nt-ninos')?.checked
      };

      try {
        const res = await apiFetch(editingTallerId ? `/talleres/${editingTallerId}` : '/talleres', {
          method: editingTallerId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        const data = await res.json();
        if (res.ok && data.success) {
          cerrarFormTaller();
          loadTalleres();
        } else {
          if (ntError) {
            ntError.textContent = data.message || 'Error al guardar el taller.';
            ntError.classList.remove('hidden');
          }
        }
      } catch {
        if (ntError) {
          ntError.textContent = 'Error de conexión.';
          ntError.classList.remove('hidden');
        }
      }
    });
  }

  // ── Registros ──
  const ORIGEN_LABELS = { formulario: 'Formulario', whatsapp: 'WhatsApp', instagram: 'Instagram', tiktok: 'TikTok', llamada: 'Llamada', otro: 'Otro' };
  const PAGO_LABELS = { pendiente: 'Pendiente', parcial: 'Parcial', completo: 'Completo' };
  const PAGO_CLASSES = { pendiente: 'bg-[#F1EDE7] text-[#8C7A6B]', parcial: 'bg-amber-50 text-amber-700', completo: 'bg-green-50 text-green-700' };

  const filtroTallerSel = document.getElementById('filtro-taller');
  const filtroOrigenSel = document.getElementById('filtro-origen');
  const filtroPagoSel = document.getElementById('filtro-pago');
  const filtroDesdeInput = document.getElementById('filtro-desde');
  const filtroHastaInput = document.getElementById('filtro-hasta');

  function filtrosQuery() {
    const params = new URLSearchParams();
    if (filtroTallerSel && filtroTallerSel.value) params.set('taller_id', filtroTallerSel.value);
    if (filtroOrigenSel && filtroOrigenSel.value) params.set('origen', filtroOrigenSel.value);
    if (filtroPagoSel && filtroPagoSel.value) params.set('estado_pago', filtroPagoSel.value);
    if (filtroDesdeInput && filtroDesdeInput.value) params.set('desde', filtroDesdeInput.value);
    if (filtroHastaInput && filtroHastaInput.value) params.set('hasta', filtroHastaInput.value);
    return params.toString();
  }

  async function descargarExport(path, filename) {
    const res = await apiFetch(path);
    if (!res.ok) { alert('Error al exportar.'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const btnExportCsv = document.getElementById('btn-exportar-csv');
  if (btnExportCsv) {
    btnExportCsv.addEventListener('click', () => {
      const qs = filtrosQuery();
      descargarExport('/inscripciones/export' + (qs ? `?${qs}` : ''), 'artesanitas-inscripciones.csv');
    });
  }
  const btnExportXlsx = document.getElementById('btn-exportar-xlsx');
  if (btnExportXlsx) {
    btnExportXlsx.addEventListener('click', () => {
      const qs = filtrosQuery();
      descargarExport('/inscripciones/export.xlsx' + (qs ? `?${qs}` : ''), 'artesanitas-inscripciones.xlsx');
    });
  }

  [filtroTallerSel, filtroOrigenSel, filtroPagoSel, filtroDesdeInput, filtroHastaInput].forEach(el => {
    if (el) el.addEventListener('change', () => loadRegistros());
  });
  const btnLimpiarRegistros = document.getElementById('btn-limpiar-filtros');
  if (btnLimpiarRegistros) {
    btnLimpiarRegistros.addEventListener('click', () => {
      if (filtroTallerSel) filtroTallerSel.value = '';
      if (filtroOrigenSel) filtroOrigenSel.value = '';
      if (filtroPagoSel) filtroPagoSel.value = '';
      if (filtroDesdeInput) filtroDesdeInput.value = '';
      if (filtroHastaInput) filtroHastaInput.value = '';
      loadRegistros();
    });
  }

  let registrosCache = [];

  async function loadRegistros() {
    try {
      const qs = filtrosQuery();
      const res = await apiFetch('/inscripciones' + (qs ? `?${qs}` : ''));
      const data = await res.json();
      const registros = (data && data.inscripciones) || [];
      registrosCache = registros;
      const tbody = document.getElementById('registros-tbody');
      const empty = document.getElementById('registros-empty');
      if (empty) empty.classList.toggle('hidden', registros.length > 0);
      if (!tbody) return;

      tbody.innerHTML = registros.map(r => {
        const inscritoEl = new Date(r.created_at).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        const pagoOpts = Object.keys(PAGO_LABELS).map(k =>
          `<option value="${k}" ${r.estado_pago === k ? 'selected' : ''}>${PAGO_LABELS[k]}</option>`).join('');
        return `
          <tr class="border-b border-[#F1EDE7] last:border-0">
            <td data-label="Nombre" class="px-4 py-3 font-medium">${escapeHtml(r.nombre)}</td>
            <td data-label="Edad" class="px-4 py-3 text-[#8C7A6B]">${Number(r.edad)}</td>
            <td data-label="WhatsApp" class="px-4 py-3 text-[#8C7A6B]">${escapeHtml(r.whatsapp)}</td>
            <td data-label="Acompañante" class="px-4 py-3 text-[#8C7A6B]">${Array.isArray(r.acompanantes) && r.acompanantes.length ? escapeHtml(r.acompanantes.join(', ')) : '—'}</td>
            <td data-label="Taller" class="px-4 py-3 text-[#8C7A6B]">${escapeHtml(r.taller_nombre)}</td>
            <td data-label="Canal" class="px-4 py-3 text-[#8C7A6B]">${escapeHtml(ORIGEN_LABELS[r.origen] || r.origen)}</td>
            <td data-label="Pago" class="px-4 py-3">
              <select data-id="${r.id}" class="select-pago text-xs font-medium px-2 py-1 rounded-full border-0 ${PAGO_CLASSES[r.estado_pago] || ''}">
                ${pagoOpts}
              </select>
              <button data-id="${r.id}" class="btn-editar-monto block text-[10px] text-[#B87352] hover:underline mt-1 cursor-pointer">
                Pagado: S/ ${Number(r.monto_pagado).toFixed(2)}${r.taller_precio !== null ? ' de S/ ' + Number(r.taller_precio).toFixed(2) : ''}
              </button>
              ${r.saldo_pendiente !== null ? (Number(r.saldo_pendiente) > 0
                ? `<div class="text-[10px] font-semibold text-red-600 mt-0.5">Falta: S/ ${Number(r.saldo_pendiente).toFixed(2)}</div>`
                : `<div class="text-[10px] font-semibold text-green-700 mt-0.5">Pagado completo</div>`) : ''}
            </td>
            <td data-label="Inscrito el" class="px-4 py-3 text-[#8C7A6B]">${inscritoEl}</td>
            <td data-label="Acciones" class="px-4 py-3 text-right">
              <button data-id="${r.id}" data-nombre="${escapeHtml(r.nombre)}" class="btn-eliminar-inscripcion text-xs font-medium text-red-600 hover:underline cursor-pointer">
                Eliminar
              </button>
            </td>
          </tr>`;
      }).join('');

      tbody.querySelectorAll('.select-pago').forEach(sel => {
        sel.addEventListener('change', async () => {
          await apiFetch(`/inscripciones/${sel.dataset.id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estado_pago: sel.value })
          });
          loadRegistros();
        });
      });
      tbody.querySelectorAll('.btn-editar-monto').forEach(btn => {
        btn.addEventListener('click', () => {
          const registro = registrosCache.find(r => String(r.id) === btn.dataset.id);
          if (registro) abrirModalMonto(registro);
        });
      });
      tbody.querySelectorAll('.btn-eliminar-inscripcion').forEach(btn => {
        btn.addEventListener('click', () => {
          openConfirmModal({
            title: '¿Eliminar inscripción?',
            message: `Se eliminará el registro de "${btn.dataset.nombre}". Esta acción no se puede deshacer.`,
            confirmText: 'Sí, eliminar',
            onConfirm: async () => {
              await apiFetch(`/inscripciones/${btn.dataset.id}`, { method: 'DELETE' });
              loadRegistros();
            }
          });
        });
      });
    } catch (e) {
      console.error('Error cargando registros:', e);
    }
  }

  // ── Modal de Confirmación Premium ──
  const modalConfirmacion = document.getElementById('modal-confirmacion');
  const modalConfirmTitulo = document.getElementById('modal-confirm-titulo');
  const modalConfirmMensaje = document.getElementById('modal-confirm-mensaje');
  const btnCancelarConfirm = document.getElementById('btn-cancelar-confirm');
  const btnAceptarConfirm = document.getElementById('btn-aceptar-confirm');
  let onConfirmCallback = null;

  function openConfirmModal({ title, message, confirmText = 'Sí, eliminar', onConfirm }) {
    if (!modalConfirmacion) {
      if (confirm(message || title)) onConfirm && onConfirm();
      return;
    }
    if (modalConfirmTitulo) modalConfirmTitulo.textContent = title || '¿Estás seguro?';
    if (modalConfirmMensaje) modalConfirmMensaje.textContent = message || 'Esta acción no se puede deshacer.';
    if (btnAceptarConfirm) btnAceptarConfirm.textContent = confirmText;
    onConfirmCallback = onConfirm;
    modalConfirmacion.classList.remove('hidden');
  }

  function closeConfirmModal() {
    if (modalConfirmacion) modalConfirmacion.classList.add('hidden');
    onConfirmCallback = null;
  }

  if (btnCancelarConfirm) btnCancelarConfirm.addEventListener('click', closeConfirmModal);
  if (modalConfirmacion) {
    modalConfirmacion.addEventListener('click', (e) => {
      if (e.target === modalConfirmacion) closeConfirmModal();
    });
  }
  if (btnAceptarConfirm) {
    btnAceptarConfirm.addEventListener('click', async () => {
      if (typeof onConfirmCallback === 'function') {
        const cb = onConfirmCallback;
        closeConfirmModal();
        await cb();
      } else {
        closeConfirmModal();
      }
    });
  }

  // ── Modal: actualizar monto pagado (Ultra Premium) ──
  const modalMonto = document.getElementById('modal-monto');
  const modalMontoInput = document.getElementById('modal-monto-input');
  const modalMontoError = document.getElementById('modal-monto-error');
  const btnCerrarModalMonto = document.getElementById('btn-cerrar-modal-monto');
  let editandoMontoId = null;

  function abrirModalMonto(registro) {
    editandoMontoId = registro.id;
    const nm = document.getElementById('modal-monto-nombre'); if (nm) nm.textContent = registro.nombre;
    const pr = document.getElementById('modal-monto-precio'); if (pr) pr.textContent = registro.taller_precio !== null
      ? 'S/ ' + Number(registro.taller_precio).toFixed(2) : '—';
    const pa = document.getElementById('modal-monto-pagado-actual'); if (pa) pa.textContent = 'S/ ' + Number(registro.monto_pagado).toFixed(2);
    const fa = document.getElementById('modal-monto-falta'); if (fa) fa.textContent = registro.saldo_pendiente !== null
      ? 'S/ ' + Number(registro.saldo_pendiente).toFixed(2) : '—';
    if (modalMontoInput) modalMontoInput.value = registro.monto_pagado;
    if (modalMontoError) modalMontoError.classList.add('hidden');
    if (modalMonto) modalMonto.classList.remove('hidden');
    if (modalMontoInput) modalMontoInput.focus();
  }

  function cerrarModalMonto() {
    if (modalMonto) modalMonto.classList.add('hidden');
    editandoMontoId = null;
  }

  if (btnCerrarModalMonto) btnCerrarModalMonto.addEventListener('click', cerrarModalMonto);
  const btnCancMonto = document.getElementById('btn-cancelar-monto');
  if (btnCancMonto) btnCancMonto.addEventListener('click', cerrarModalMonto);
  if (modalMonto) {
    modalMonto.addEventListener('click', (e) => { if (e.target === modalMonto) cerrarModalMonto(); });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalMonto && !modalMonto.classList.contains('hidden')) cerrarModalMonto();
    if (e.key === 'Escape' && modalConfirmacion && !modalConfirmacion.classList.contains('hidden')) closeConfirmModal();
  });

  const btnGuardarMonto = document.getElementById('btn-guardar-monto');
  if (btnGuardarMonto) {
    btnGuardarMonto.addEventListener('click', async () => {
      const nuevo = parseFloat(modalMontoInput.value);
      if (isNaN(nuevo) || nuevo < 0) {
        if (modalMontoError) {
          modalMontoError.textContent = 'Ingresa un monto válido.';
          modalMontoError.classList.remove('hidden');
        }
        return;
      }
      await apiFetch(`/inscripciones/${editandoMontoId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monto_pagado: nuevo })
      });
      cerrarModalMonto();
      loadRegistros();
    });
  }
  if (modalMontoInput) {
    modalMontoInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && btnGuardarMonto) btnGuardarMonto.click();
    });
  }

  // ── Registro manual (WhatsApp / Instagram / TikTok / llamada) ──
  const btnNuevaInscripcion = document.getElementById('btn-nueva-inscripcion');
  const formInscripcionManual = document.getElementById('form-inscripcion-manual');
  const btnCancelarInscripcion = document.getElementById('btn-cancelar-inscripcion');
  const imError = document.getElementById('im-error');
  const imTallerSelect = document.getElementById('im-taller');
  const imAcompananteField = document.getElementById('im-acompanante-field');
  const imAcompanantesList = document.getElementById('im-acompanantes-list');
  const imBtnAgregarAcompanante = document.getElementById('im-btn-agregar-acompanante');
  let talleresParaSelect = [];

  function crearFilaAcompananteManual(esPrimera) {
    const fila = document.createElement('div');
    fila.className = 'flex gap-2';
    fila.innerHTML = `
      <input type="text" maxlength="100" placeholder="Nombre completo"
        class="im-acompanante-input flex-1 px-3 py-2.5 rounded-lg border border-[#D5C9BD] bg-[#F9F6F0] focus:outline-none focus:border-[#B87352]">
      ${esPrimera ? '' : `
      <button type="button" class="btn-quitar-acompanante shrink-0 w-10 h-10 rounded-lg border border-[#D5C9BD] text-[#8C7A6B] hover:text-[#B87352] hover:border-[#B87352] transition-colors flex items-center justify-center">✕</button>`}
    `;
    const btnQuitar = fila.querySelector('.btn-quitar-acompanante');
    if (btnQuitar) btnQuitar.addEventListener('click', () => fila.remove());
    return fila;
  }
  function resetAcompanantesManual() {
    if (!imAcompanantesList) return;
    imAcompanantesList.innerHTML = '';
    imAcompanantesList.appendChild(crearFilaAcompananteManual(true));
  }
  if (imBtnAgregarAcompanante && imAcompanantesList) {
    imBtnAgregarAcompanante.addEventListener('click', () => {
      imAcompanantesList.appendChild(crearFilaAcompananteManual(false));
    });
  }
  function getAcompanantesManualValues() {
    if (!imAcompanantesList) return [];
    return [...imAcompanantesList.querySelectorAll('.im-acompanante-input')]
      .map(i => i.value.trim())
      .filter(v => v.length > 0);
  }

  if (btnNuevaInscripcion) {
    btnNuevaInscripcion.addEventListener('click', async () => {
      if (formInscripcionManual) formInscripcionManual.classList.remove('hidden');
      btnNuevaInscripcion.classList.add('hidden');
      const res = await apiFetch('/talleres/admin');
      const data = await res.json();
      talleresParaSelect = ((data && data.talleres) || []).filter(t => t.activo);
      if (imTallerSelect) {
        imTallerSelect.innerHTML = talleresParaSelect.map(t => `<option value="${t.id}">${escapeHtml(t.nombre)}</option>`).join('');
      }
      toggleAcompanante();
    });
  }
  if (btnCancelarInscripcion) {
    btnCancelarInscripcion.addEventListener('click', () => {
      if (formInscripcionManual) {
        formInscripcionManual.classList.add('hidden');
        formInscripcionManual.reset();
      }
      if (btnNuevaInscripcion) btnNuevaInscripcion.classList.remove('hidden');
      if (imError) imError.classList.add('hidden');
    });
  }

  function toggleAcompanante() {
    if (!imTallerSelect) return;
    const taller = talleresParaSelect.find(t => String(t.id) === imTallerSelect.value);
    const esParaNinos = !!(taller && taller.es_para_ninos);
    if (imAcompananteField) imAcompananteField.classList.toggle('hidden', !esParaNinos);
    if (imAcompanantesList && imAcompanantesList.children.length === 0) resetAcompanantesManual();
  }
  if (imTallerSelect) imTallerSelect.addEventListener('change', toggleAcompanante);

  if (formInscripcionManual) {
    formInscripcionManual.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (imError) imError.classList.add('hidden');

      const formData = new FormData();
      formData.append('taller_id', imTallerSelect?.value || '');
      formData.append('nombre', document.getElementById('im-nombre')?.value.trim() || '');
      formData.append('edad', document.getElementById('im-edad')?.value || '');
      formData.append('whatsapp', document.getElementById('im-whatsapp')?.value.trim() || '');
      formData.append('origen', document.getElementById('im-origen')?.value || '');
      if (imAcompananteField && !imAcompananteField.classList.contains('hidden')) {
        getAcompanantesManualValues().forEach(nombre => formData.append('acompanantes', nombre));
      }
      const file = document.getElementById('im-comprobante')?.files[0];
      if (file) formData.append('comprobante', file);

      try {
        const res = await apiFetch('/inscripciones/manual', { method: 'POST', body: formData });
        const data = await res.json();
        if (res.ok && data.success) {
          formInscripcionManual.reset();
          formInscripcionManual.classList.add('hidden');
          if (btnNuevaInscripcion) btnNuevaInscripcion.classList.remove('hidden');
          loadRegistros();
          loadTalleres();
        } else {
          if (imError) {
            imError.textContent = data.message || 'Error al registrar.';
            imError.classList.remove('hidden');
          }
        }
      } catch {
        if (imError) {
          imError.textContent = 'Error de conexión.';
          imError.classList.remove('hidden');
        }
      }
    });
  }

  // ── Productos ──
  let productosAdminCache = [];
  let editingProductoId = null;

  async function loadProductos() {
    try {
      const res = await apiFetch('/productos/admin');
      const data = await res.json();
      productosAdminCache = (data && data.productos) || [];
      renderProductosGrid();
      loadProductosEstaticos();
    } catch (e) {
      console.error('Error cargando productos:', e);
    }
  }

  // ── Productos "de código" (catálogo estático viejo) ──
  async function loadProductosEstaticos() {
    try {
      const res = await apiFetch('/productos-estaticos/admin');
      const data = await res.json();
      const productos = (data && data.productos) || [];
      const lista = document.getElementById('productos-estaticos-lista');
      if (!lista) return;

      lista.innerHTML = productos.map(p => `
        <div class="flex items-center justify-between gap-3 px-4 py-3">
          <span class="text-sm font-medium">${escapeHtml(p.nombre)}</span>
          <div class="flex items-center gap-3 shrink-0">
            <span class="text-xs font-medium px-2.5 py-1 rounded-full ${p.activo ? 'bg-green-50 text-green-700' : 'bg-[#F1EDE7] text-[#8C7A6B]'}">
              ${p.activo ? 'Activo' : 'Inactivo'}
            </span>
            <button data-slug="${p.slug}" data-activo="${p.activo}" class="btn-toggle-producto-estatico text-xs font-medium text-[#B87352] hover:underline whitespace-nowrap cursor-pointer">
              ${p.activo ? 'Desactivar' : 'Activar'}
            </button>
            <button data-slug="${p.slug}" data-nombre="${escapeHtml(p.nombre)}" class="btn-migrar-producto-estatico text-xs font-medium text-[#4A3C31] hover:underline whitespace-nowrap cursor-pointer">
              Migrar a editable
            </button>
          </div>
        </div>`).join('');

      lista.querySelectorAll('.btn-toggle-producto-estatico').forEach(btn => {
        btn.addEventListener('click', async () => {
          const nuevoActivo = btn.dataset.activo !== 'true';
          await apiFetch(`/productos-estaticos/${btn.dataset.slug}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activo: nuevoActivo })
          });
          loadProductosEstaticos();
        });
      });

      lista.querySelectorAll('.btn-migrar-producto-estatico').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm(`"${btn.dataset.nombre}" pasará a ser un producto editable (arriba en la lista), con su nombre/precio/descripción/fotos actuales. La tarjeta vieja del catálogo se reemplaza por esta -- ¿continuar?`)) return;
          try {
            const res = await apiFetch(`/productos-estaticos/${btn.dataset.slug}/migrar`, { method: 'POST' });
            const data = await res.json();
            if (res.ok && data.success) {
              loadProductos();
            } else {
              alert(data.message || 'Error al migrar el producto.');
            }
          } catch {
            alert('Error de conexión.');
          }
        });
      });
    } catch (e) {
      console.error('Error cargando productos estáticos:', e);
    }
  }

  function productosFiltrados() {
    const estado = document.getElementById('filtro-producto-estado')?.value || '';
    return productosAdminCache.filter(p => {
      if (estado === 'activo' && !p.activo) return false;
      if (estado === 'inactivo' && p.activo) return false;
      return true;
    });
  }

  function renderProductosGrid() {
    const productos = productosFiltrados();
    const grid = document.getElementById('productos-grid');
    const empty = document.getElementById('productos-empty');
    if (empty) empty.classList.toggle('hidden', productos.length > 0);
    if (!grid) return;

    grid.innerHTML = productos.map(p => {
      const foto = Array.isArray(p.imagenes) && p.imagenes[0] ? p.imagenes[0] : '';
      return `
        <div class="bg-white rounded-2xl border border-[#EBE5DE] overflow-hidden shadow-xs hover:shadow-md transition-shadow">
          <div class="aspect-square bg-[#F1EDE7] relative overflow-hidden">
            ${foto ? `<img src="${escapeHtml(foto)}" alt="${escapeHtml(p.nombre)}" onerror="this.onerror=null; this.src='/imagenes/Artesanitas/logo_artesanitas.peru.jpg';" class="w-full h-full object-cover">` : `<div class="w-full h-full flex items-center justify-center text-xs text-[#8C7A6B]">Sin foto</div>`}
          </div>
          <div class="p-4 space-y-1.5">
            <div class="flex items-start justify-between gap-2">
              <h4 class="font-medium text-sm leading-snug">${escapeHtml(p.nombre)}</h4>
              <span class="shrink-0 text-[10px] font-medium px-2 py-1 rounded-full ${p.activo ? 'bg-green-50 text-green-700' : 'bg-[#F1EDE7] text-[#8C7A6B]'}">
                ${p.activo ? 'Activo' : 'Inactivo'}
              </span>
            </div>
            <div class="flex items-baseline gap-2">
              ${p.precio_oferta && Number(p.precio_oferta) > 0
                ? `<span class="text-[#B87352] font-bold text-base">S/ ${Number(p.precio_oferta).toFixed(2)}</span>
                   <span class="text-xs text-[#8C7A6B] line-through">S/ ${Number(p.precio).toFixed(2)}</span>`
                : `<span class="text-[#B87352] font-bold text-base">S/ ${Number(p.precio).toFixed(2)}</span>`}
              ${p.etiqueta_promo ? `<span class="text-[10px] bg-[#B87352]/15 text-[#B87352] font-bold px-2 py-0.5 rounded-full">${escapeHtml(p.etiqueta_promo)}</span>` : ''}
            </div>
            <div class="text-[11px] text-[#8C7A6B] space-y-0.5 pt-1">
              <div class="font-mono text-[10px] text-[#4A3C31]">SKU: ${escapeHtml(p.sku || '—')}${p.ean ? ' · EAN: ' + escapeHtml(p.ean) : ''}</div>
              <div>📂 ${escapeHtml(p.linea || 'Vajilla')} → ${escapeHtml(p.sublinea || 'Tazas')}${p.coleccion ? ' (' + escapeHtml(p.coleccion) + ')' : ''}</div>
              <div class="flex items-center justify-between pt-1">
                <span class="font-semibold ${Number(p.stock_actual) > 0 ? 'text-green-700' : 'text-amber-700'}">
                  📦 Stock: ${Number(p.stock_actual || 0)} und. (${Number(p.stock_actual) > 0 ? 'Entrega inmediata' : (p.politica_sin_stock === 'agotado' ? 'Agotado' : 'En Preventa')})
                </span>
              </div>
            </div>
            <div class="flex gap-3 pt-1.5">
              <button data-id="${p.id}" class="btn-editar-producto text-xs font-medium text-[#B87352] hover:underline cursor-pointer">Editar / Cambiar Fotos</button>
              <button data-id="${p.id}" data-activo="${p.activo}" class="btn-toggle-producto text-xs font-medium text-[#8C7A6B] hover:underline cursor-pointer">
                ${p.activo ? 'Desactivar' : 'Activar'}
              </button>
              <button data-id="${p.id}" data-nombre="${escapeHtml(p.nombre)}" class="btn-eliminar-producto text-xs font-medium text-red-600 hover:underline cursor-pointer">Eliminar</button>
            </div>
          </div>
        </div>`;
    }).join('');

    grid.querySelectorAll('.btn-toggle-producto').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const nuevoActivo = btn.dataset.activo !== 'true';
        await apiFetch(`/productos/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activo: nuevoActivo })
        });
        loadProductos();
      });
    });
    grid.querySelectorAll('.btn-editar-producto').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = productosAdminCache.find(x => String(x.id) === btn.dataset.id);
        if (!p) return;
        abrirFormProducto(p);
      });
    });
    grid.querySelectorAll('.btn-eliminar-producto').forEach(btn => {
      btn.addEventListener('click', () => {
        openConfirmModal({
          title: '¿Eliminar producto?',
          message: `Se eliminará "${btn.dataset.nombre}" y sus fotos del catálogo. Esta acción no se puede deshacer.`,
          confirmText: 'Sí, eliminar',
          onConfirm: async () => {
            await apiFetch(`/productos/${btn.dataset.id}`, { method: 'DELETE' });
            loadProductos();
          }
        });
      });
    });
  }

  const filtroProdEstado = document.getElementById('filtro-producto-estado');
  if (filtroProdEstado) filtroProdEstado.addEventListener('change', () => renderProductosGrid());
  const btnLimpiarProd = document.getElementById('btn-limpiar-filtros-productos');
  if (btnLimpiarProd) {
    btnLimpiarProd.addEventListener('click', () => {
      if (filtroProdEstado) filtroProdEstado.value = '';
      renderProductosGrid();
    });
  }

  const btnNuevoProducto = document.getElementById('btn-nuevo-producto');
  const formNuevoProducto = document.getElementById('form-nuevo-producto');
  const formProductoTitulo = document.getElementById('form-producto-titulo');
  const btnGuardarProducto = document.getElementById('btn-guardar-producto');
  const btnCancelarProducto = document.getElementById('btn-cancelar-producto');
  const npError = document.getElementById('np-error');
  const npImagenesActuales = document.getElementById('np-imagenes-actuales');
  const npFotosHint = document.getElementById('np-fotos-hint');

  // Helper de compresión automática con Canvas en el navegador
  async function comprimirImagenWeb(file, maxDimension = 1200, quality = 0.82) {
    return new Promise((resolve) => {
      if (!file.type || !file.type.startsWith('image/')) return resolve(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob((blob) => {
            if (!blob) return resolve(file);
            const nuevoFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + '.webp', {
              type: 'image/webp',
              lastModified: Date.now()
            });
            resolve(nuevoFile);
          }, 'image/webp', quality);
        };
        img.onerror = () => resolve(file);
        img.src = e.target.result;
      };
      reader.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    });
  }

  function abrirFormProducto(producto) {
    editingProductoId = producto ? producto.id : null;
    if (formProductoTitulo) formProductoTitulo.textContent = producto ? 'Editar Producto / Cambiar Fotos' : 'Nuevo Producto';
    if (btnGuardarProducto) btnGuardarProducto.textContent = producto ? 'Guardar Cambios' : 'Crear Producto';

    const niNombre = document.getElementById('np-nombre'); if (niNombre) niNombre.value = producto ? producto.nombre : '';
    const niPrecio = document.getElementById('np-precio'); if (niPrecio) niPrecio.value = producto ? producto.precio : '';
    const niOferta = document.getElementById('np-precio-oferta'); if (niOferta) niOferta.value = producto && producto.precio_oferta ? producto.precio_oferta : '';
    const niPromoTag = document.getElementById('np-etiqueta-promo'); if (niPromoTag) niPromoTag.value = producto && producto.etiqueta_promo ? producto.etiqueta_promo : '';
    const niCosto = document.getElementById('np-costo-artesano'); if (niCosto) niCosto.value = producto && producto.costo_artesano ? producto.costo_artesano : '';
    const niSku = document.getElementById('np-sku'); if (niSku) niSku.value = producto && producto.sku ? producto.sku : '';
    const niEan = document.getElementById('np-ean'); if (niEan) niEan.value = producto && producto.ean ? producto.ean : '';
    const niStock = document.getElementById('np-stock'); if (niStock) niStock.value = producto && producto.stock_actual !== undefined ? producto.stock_actual : 0;
    const niPolStock = document.getElementById('np-politica-stock'); if (niPolStock) niPolStock.value = producto && producto.politica_sin_stock ? producto.politica_sin_stock : 'preventa';
    const niLinea = document.getElementById('np-linea'); if (niLinea) niLinea.value = producto && producto.linea ? producto.linea : 'Vajilla Artesanal';
    const niSublinea = document.getElementById('np-sublinea'); if (niSublinea) niSublinea.value = producto && producto.sublinea ? producto.sublinea : 'Tazas & Mugs';
    const niSubSub = document.getElementById('np-sub-sublinea'); if (niSubSub) niSubSub.value = producto && producto.sub_sublinea ? producto.sub_sublinea : '';
    const niCol = document.getElementById('np-coleccion'); if (niCol) niCol.value = producto && producto.coleccion ? producto.coleccion : '';
    const niTipo = document.getElementById('np-tipo'); if (niTipo) niTipo.value = producto && producto.tipo_producto ? producto.tipo_producto : '';
    const niModelo = document.getElementById('np-modelo'); if (niModelo) niModelo.value = producto && producto.modelo ? producto.modelo : '';
    const niColor = document.getElementById('np-color'); if (niColor) niColor.value = producto && producto.color ? producto.color : '';
    const niTamano = document.getElementById('np-tamano'); if (niTamano) niTamano.value = producto && producto.tamano_dimensiones ? producto.tamano_dimensiones : '';
    const niCaract = document.getElementById('np-caracteristicas'); if (niCaract) niCaract.value = producto && producto.caracteristicas ? producto.caracteristicas : '';
    const niDesc = document.getElementById('np-descripcion'); if (niDesc) niDesc.value = producto ? (producto.descripcion || '') : '';
    const niImg = document.getElementById('np-imagenes'); if (niImg) niImg.value = '';

    if (producto && Array.isArray(producto.imagenes) && producto.imagenes.length) {
      if (npImagenesActuales) {
        npImagenesActuales.innerHTML = producto.imagenes.map(src =>
          `<img src="${escapeHtml(src)}" onerror="this.onerror=null; this.src='/imagenes/Artesanitas/logo_artesanitas.peru.jpg';" class="w-14 h-14 object-cover rounded-lg border border-[#EBE5DE]">`).join('');
      }
      if (npFotosHint) npFotosHint.textContent = '(puedes seleccionar fotos nuevas para reemplazar las anteriores y guardarlas de forma permanente)';
    } else {
      if (npImagenesActuales) npImagenesActuales.innerHTML = '';
      if (npFotosHint) npFotosHint.textContent = '(hasta 6 fotos, la primera es la principal. Se optimizan automáticamente al guardar)';
    }

    if (npError) npError.classList.add('hidden');
    if (formNuevoProducto) formNuevoProducto.classList.remove('hidden');
    if (btnNuevoProducto) btnNuevoProducto.classList.add('hidden');
    if (formNuevoProducto) formNuevoProducto.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function cerrarFormProducto() {
    if (formNuevoProducto) {
      formNuevoProducto.classList.add('hidden');
      formNuevoProducto.reset();
    }
    if (btnNuevoProducto) btnNuevoProducto.classList.remove('hidden');
    if (npImagenesActuales) npImagenesActuales.innerHTML = '';
    editingProductoId = null;
    if (npError) npError.classList.add('hidden');
  }

  if (btnNuevoProducto) btnNuevoProducto.addEventListener('click', () => abrirFormProducto());
  if (btnCancelarProducto) btnCancelarProducto.addEventListener('click', cerrarFormProducto);

  if (formNuevoProducto) {
    formNuevoProducto.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (npError) npError.classList.add('hidden');

      const inputFiles = document.getElementById('np-imagenes')?.files || [];
      if (!editingProductoId && inputFiles.length === 0) {
        if (npError) {
          npError.textContent = 'Sube al menos una foto para el nuevo producto.';
          npError.classList.remove('hidden');
        }
        return;
      }

      const textoOriginalBtn = btnGuardarProducto ? btnGuardarProducto.textContent : '';
      if (btnGuardarProducto) {
        btnGuardarProducto.disabled = true;
        btnGuardarProducto.textContent = 'Optimizando fotos y guardando...';
      }

      try {
        const filesArray = [...inputFiles];
        const filesOptimizados = await Promise.all(filesArray.map(f => comprimirImagenWeb(f)));

        const formData = new FormData();
        formData.append('nombre', document.getElementById('np-nombre')?.value.trim() || '');
        formData.append('precio', document.getElementById('np-precio')?.value || '');
        formData.append('precio_oferta', document.getElementById('np-precio-oferta')?.value || '');
        formData.append('etiqueta_promo', document.getElementById('np-etiqueta-promo')?.value.trim() || '');
        formData.append('costo_artesano', document.getElementById('np-costo-artesano')?.value || '');
        formData.append('sku', document.getElementById('np-sku')?.value.trim() || '');
        formData.append('ean', document.getElementById('np-ean')?.value.trim() || '');
        formData.append('stock_actual', document.getElementById('np-stock')?.value || '0');
        formData.append('politica_sin_stock', document.getElementById('np-politica-stock')?.value || 'preventa');
        formData.append('linea', document.getElementById('np-linea')?.value || 'Vajilla Artesanal');
        formData.append('sublinea', document.getElementById('np-sublinea')?.value || 'Tazas & Mugs');
        formData.append('sub_sublinea', document.getElementById('np-sub-sublinea')?.value.trim() || '');
        formData.append('coleccion', document.getElementById('np-coleccion')?.value.trim() || '');
        formData.append('tipo_producto', document.getElementById('np-tipo')?.value.trim() || '');
        formData.append('modelo', document.getElementById('np-modelo')?.value.trim() || '');
        formData.append('color', document.getElementById('np-color')?.value.trim() || '');
        formData.append('tamano_dimensiones', document.getElementById('np-tamano')?.value.trim() || '');
        formData.append('caracteristicas', document.getElementById('np-caracteristicas')?.value.trim() || '');
        formData.append('descripcion', document.getElementById('np-descripcion')?.value.trim() || '');
        filesOptimizados.forEach(f => formData.append('imagenes', f));

        const res = await apiFetch(editingProductoId ? `/productos/${editingProductoId}` : '/productos', {
          method: editingProductoId ? 'PATCH' : 'POST',
          body: formData
        });
        const data = await res.json();
        if (res.ok && data.success) {
          cerrarFormProducto();
          loadProductos();
        } else {
          if (npError) {
            npError.textContent = data.message || 'Error al guardar el producto.';
            npError.classList.remove('hidden');
          }
        }
      } catch {
        if (npError) {
          npError.textContent = 'Error de conexión al guardar.';
          npError.classList.remove('hidden');
        }
      } finally {
        if (btnGuardarProducto) {
          btnGuardarProducto.disabled = false;
          btnGuardarProducto.textContent = textoOriginalBtn;
        }
      }
    });
  }

  // ── Pedidos & Preventas ──
  const ESTADO_PEDIDO_LABELS = {
    cotizado: '1. Cotizado / Solicitud',
    reservado: '2. Reserva Confirmada',
    encargado_artesano: '3. Encargado a Artesano',
    en_produccion: '4. En Pintura / Taller',
    recibido_taller: '5. Listo en Taller Artesanitas',
    enviado: '6. Enviado (Shalom / Courier)',
    entregado: '7. Entregado al Cliente',
    post_venta: '8. Post-Venta Completada',
    cancelado: 'Cancelado'
  };
  const ESTADO_PEDIDO_CLASSES = {
    cotizado: 'bg-stone-100 text-stone-700 border border-stone-200',
    reservado: 'bg-amber-100 text-amber-800 border border-amber-200',
    encargado_artesano: 'bg-orange-100 text-orange-800 border border-orange-200',
    en_produccion: 'bg-blue-100 text-blue-800 border border-blue-200',
    recibido_taller: 'bg-teal-100 text-teal-800 border border-teal-200',
    enviado: 'bg-purple-100 text-purple-800 border border-purple-200',
    entregado: 'bg-green-100 text-green-800 border border-green-200',
    post_venta: 'bg-emerald-100 text-emerald-900 border border-emerald-300',
    cancelado: 'bg-red-100 text-red-800 border border-red-200'
  };

  const filtroPedidoSearch = document.getElementById('filtro-pedido-search');
  const filtroPedidoEntrega = document.getElementById('filtro-pedido-entrega');
  const filtroPedidoPago = document.getElementById('filtro-pedido-pago');
  const filtroPedidoEstado = document.getElementById('filtro-pedido-estado');
  const btnLimpiarFiltrosPedidos = document.getElementById('btn-limpiar-filtros-pedidos');
  const badgePedidosCount = document.getElementById('badge-pedidos-count');

  function filtrosPedidosQuery() {
    const params = new URLSearchParams();
    if (filtroPedidoSearch && filtroPedidoSearch.value.trim()) params.set('search', filtroPedidoSearch.value.trim());
    if (filtroPedidoEntrega && filtroPedidoEntrega.value) params.set('tipo_entrega', filtroPedidoEntrega.value);
    if (filtroPedidoPago && filtroPedidoPago.value) params.set('estado_pago', filtroPedidoPago.value);
    if (filtroPedidoEstado && filtroPedidoEstado.value) params.set('estado_pedido', filtroPedidoEstado.value);
    return params.toString();
  }

  let pedidosCache = [];

  async function loadPedidos() {
    try {
      const qs = filtrosPedidosQuery();
      const res = await apiFetch('/pedidos' + (qs ? `?${qs}` : ''));
      const data = await res.json();
      pedidosCache = (data && data.pedidos) || [];

      // Actualizar KPIs
      const total = pedidosCache.length;
      const recaudado = pedidosCache.reduce((acc, p) => acc + Number(p.monto_pagado || 0), 0);
      const saldo = pedidosCache.reduce((acc, p) => acc + Math.max(0, Number(p.saldo_pendiente || 0)), 0);
      const provinciaCount = pedidosCache.filter(p => p.tipo_entrega === 'provincia').length;
      const localCount = pedidosCache.filter(p => p.tipo_entrega === 'recojo_local').length;

      const kpT = document.getElementById('kpi-pedidos-total'); if (kpT) kpT.textContent = total;
      const kpR = document.getElementById('kpi-pedidos-recaudado'); if (kpR) kpR.textContent = `S/ ${recaudado.toFixed(2)}`;
      const kpS = document.getElementById('kpi-pedidos-saldo'); if (kpS) kpS.textContent = `S/ ${saldo.toFixed(2)}`;
      const kpE = document.getElementById('kpi-pedidos-envios'); if (kpE) kpE.textContent = `${provinciaCount} Shalom / ${localCount} Taller`;

      if (badgePedidosCount) {
        if (total > 0) {
          badgePedidosCount.textContent = total;
          badgePedidosCount.classList.remove('hidden');
        } else {
          badgePedidosCount.classList.add('hidden');
        }
      }

      renderPedidosTable();
    } catch (err) {
      console.error('Error cargando pedidos:', err);
    }
  }

  function renderPedidosTable() {
    const tbody = document.getElementById('pedidos-tbody');
    const empty = document.getElementById('pedidos-empty');
    if (empty) empty.classList.toggle('hidden', pedidosCache.length > 0);
    if (!tbody) return;

    tbody.innerHTML = pedidosCache.map(p => {
      const registradoEl = new Date(p.created_at).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      let fechaEntrega = '19 Sep';
      if (p.fecha_entrega) {
        const rawDateStr = String(p.fecha_entrega).split('T')[0];
        const parts = rawDateStr.split('-');
        if (parts.length === 3) {
          const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
          fechaEntrega = d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' });
        }
      }
      const cleanPhone = String(p.whatsapp).replace(/\D/g, '');
      const esLocal = (p.tipo_entrega === 'recojo_local');

      const pagoOpts = Object.keys(PAGO_LABELS).map(k =>
        `<option value="${k}" ${p.estado_pago === k ? 'selected' : ''}>${PAGO_LABELS[k]}</option>`).join('');

      const estadoOpts = Object.keys(ESTADO_PEDIDO_LABELS).map(k =>
        `<option value="${k}" ${p.estado_pedido === k ? 'selected' : ''}>${ESTADO_PEDIDO_LABELS[k]}</option>`).join('');

      return `
        <tr class="border-b border-[#F1EDE7] last:border-0 hover:bg-[#F9F6F0]/40 transition-colors">
          <td data-label="Cliente / DNI" class="px-4 py-3">
            <div class="inline-block bg-[#4A3C31] text-[#F9F6F0] font-mono font-bold text-[10px] px-2 py-0.5 rounded-md mb-1">
              ${escapeHtml(p.codigo_pedido || ('ART-' + p.id))}
            </div>
            <div class="font-bold text-[#4A3C31]">${escapeHtml(p.nombre)}</div>
            <div class="text-xs text-[#8C7A6B] font-mono">DNI: ${escapeHtml(p.dni)}</div>
            <div class="text-[10px] text-[#8C7A6B]/80">${registradoEl}</div>
          </td>
          <td data-label="WhatsApp" class="px-4 py-3">
            <a href="https://wa.me/51${cleanPhone}" target="_blank" rel="noreferrer"
              class="inline-flex items-center gap-1 text-xs font-semibold text-[#008f6b] hover:underline bg-[#00D09C]/10 px-2.5 py-1 rounded-lg">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
              <span>${escapeHtml(p.whatsapp)}</span>
            </a>
          </td>
          <td data-label="Entrega / Sede" class="px-4 py-3 text-xs">
            ${esLocal ? `
              <span class="inline-flex items-center gap-1 bg-[#00D09C]/10 text-[#008f6b] text-[11px] font-bold px-2 py-0.5 rounded-md mb-0.5">
                📍 Recojo en Local
              </span>
              <span class="font-semibold text-[#4A3C31] block">Taller Trujillo (Gratis)</span>
            ` : `
              <span class="inline-flex items-center gap-1 bg-[#742284]/10 text-[#742284] text-[11px] font-bold px-2 py-0.5 rounded-md mb-0.5">
                🚚 Envío Shalom
              </span>
              <span class="font-semibold text-[#4A3C31] block">${escapeHtml(p.sede_shalom)}</span>
            `}
            ${p.direccion_adicional ? `<span class="text-[#8C7A6B] text-[11px] block">${escapeHtml(p.direccion_adicional)}</span>` : ''}
          </td>
          <td data-label="Producto / Fecha" class="px-4 py-3 text-xs">
            ${p.items && Array.isArray(p.items) && p.items.length > 0 ? `
              <div class="space-y-1">
                ${p.items.map(it => `
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="bg-[#B87352]/15 text-[#B87352] font-extrabold text-[11px] px-1.5 py-0.5 rounded-md border border-[#B87352]/30">${it.cantidad}x</span>
                    <strong class="text-[#B87352]">${escapeHtml(it.nombre)}</strong>
                  </div>
                `).join('')}
              </div>
            ` : `
              <div class="flex items-center gap-1.5 flex-wrap">
                ${p.cantidad && Number(p.cantidad) > 1 ? `<span class="bg-[#B87352]/15 text-[#B87352] font-extrabold text-[11px] px-1.5 py-0.5 rounded-md border border-[#B87352]/30">${p.cantidad}x</span>` : ''}
                <strong class="text-[#B87352]">${escapeHtml(p.producto_nombre)}</strong>
              </div>
            `}
            <span class="text-[#8C7A6B] block mt-1">Entrega: ${fechaEntrega}</span>
            <span class="text-[10px] text-[#742284] block font-medium">
              ${esLocal ? 'Envío: S/ 0.00 (Taller)' : `Flete Shalom: S/ ${Number(p.costo_envio).toFixed(2)}`}
            </span>
          </td>
          <td data-label="Pago" class="px-4 py-3">
            <select data-id="${p.id}" class="select-pedido-pago text-xs font-medium px-2.5 py-1 rounded-lg border-0 ${PAGO_CLASSES[p.estado_pago] || ''}">
              ${pagoOpts}
            </select>
            <div class="text-[11px] text-[#4A3C31] font-medium mt-1">
              Pagado: <strong>S/ ${Number(p.monto_pagado).toFixed(2)}</strong> de S/ ${Number(p.producto_precio).toFixed(2)}
            </div>
            ${Number(p.saldo_pendiente) > 0
              ? `<div class="text-[10px] font-semibold text-red-600">Saldo pendiente: S/ ${Number(p.saldo_pendiente).toFixed(2)}</div>`
              : `<div class="text-[10px] font-semibold text-green-700">Producto pagado 100%</div>`}
          </td>
          <td data-label="Estado Pedido" class="px-4 py-3 space-y-1.5">
            <select data-id="${p.id}" class="select-pedido-estado text-xs font-semibold px-2.5 py-1 rounded-lg border-0 ${ESTADO_PEDIDO_CLASSES[p.estado_pedido] || ''}">
              ${estadoOpts}
            </select>
            <div class="bg-[#F9F6F0] p-2 rounded-xl border border-[#EBE5DE] space-y-1.5 mt-1">
              <div class="text-[10px] font-bold text-[#8C7A6B] uppercase">Trazabilidad Artesano & Envío</div>
              <input type="text" data-artesano-id="${p.id}" value="${escapeHtml(p.artesano_nombre || '')}" placeholder="Artesano asignado"
                class="input-pedido-artesano w-full px-2 py-1 text-[11px] rounded-lg border border-[#D5C9BD] bg-white focus:outline-none focus:border-[#B87352]">
              <div class="flex items-center gap-1">
                <span class="text-[10px] text-[#8C7A6B] shrink-0">Entrega artesano:</span>
                <input type="date" data-fecha-art-id="${p.id}" value="${p.fecha_compromiso_artesano ? String(p.fecha_compromiso_artesano).slice(0, 10) : ''}"
                  class="input-pedido-fecha-art flex-1 px-1.5 py-0.5 text-[10px] rounded-lg border border-[#D5C9BD] bg-white">
              </div>
              ${(() => {
                if (!p.fecha_compromiso_artesano || ['recibido_taller', 'enviado', 'entregado', 'post_venta', 'cancelado'].includes(p.estado_pedido)) return '';
                const hoy = new Date().toISOString().slice(0, 10);
                const comp = String(p.fecha_compromiso_artesano).slice(0, 10);
                return hoy > comp
                  ? `<div class="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md border border-red-200">⚠️ Artesano demorado (venció ${comp})</div>`
                  : '';
              })()}
              <div class="flex items-center gap-1">
                <input type="text" data-guia-id="${p.id}" value="${escapeHtml(p.guia_envio || '')}" placeholder="N° Guía Shalom"
                  class="input-pedido-guia flex-1 px-2 py-1 text-[11px] font-mono rounded-lg border border-[#D5C9BD] bg-white focus:outline-none focus:border-[#B87352]">
                <button type="button" data-save-guia="${p.id}"
                  class="btn-guardar-guia text-[10px] font-bold bg-[#4A3C31] text-white px-2.5 py-1 rounded-lg hover:bg-[#B87352] transition-colors cursor-pointer"
                  title="Guardar Artesano, Fecha y Guía Shalom">
                  Guardar
                </button>
              </div>
            </div>
            <a href="https://wa.me/51${cleanPhone}?text=${encodeURIComponent(`Hola ${p.nombre}! ✨ Te escribimos de Artesanitas Perú. El estado de tu pedido (${p.codigo_pedido || ('ART-' + p.id)}) es: ${ESTADO_PEDIDO_LABELS[p.estado_pedido] || p.estado_pedido}${p.guia_envio ? '. Tu guía Shalom es: ' + p.guia_envio : ''}. Puedes rastrearlo en vivo aquí: ${window.location.origin}/seguimiento?codigo=${p.codigo_pedido || ''}`)}"
              target="_blank" rel="noreferrer"
              class="inline-flex items-center gap-1 text-[10px] font-semibold text-[#B87352] hover:underline pt-0.5">
              <span>📲 Enviar link de tracking</span>
            </a>
          </td>
          <td data-label="Acciones" class="px-4 py-3 text-right">
            <button data-id="${p.id}" data-nombre="${escapeHtml(p.nombre)}" class="btn-eliminar-pedido text-xs font-medium text-red-600 hover:underline cursor-pointer">
              Eliminar
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Eventos en selects de pago
    tbody.querySelectorAll('.select-pedido-pago').forEach(sel => {
      sel.addEventListener('change', async () => {
        const id = sel.dataset.id;
        const estado_pago = sel.value;
        const pedido = pedidosCache.find(p => String(p.id) === String(id));
        let monto_pagado = pedido ? Number(pedido.monto_pagado) : 20;
        if (estado_pago === 'completo' && pedido) monto_pagado = Number(pedido.producto_precio);
        if (estado_pago === 'pendiente') monto_pagado = 0;

        await apiFetch(`/pedidos/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ estado_pago, monto_pagado })
        });
        loadPedidos();
      });
    });

    // Eventos en selects de estado pedido
    tbody.querySelectorAll('.select-pedido-estado').forEach(sel => {
      sel.addEventListener('change', async () => {
        const id = sel.dataset.id;
        await apiFetch(`/pedidos/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ estado_pedido: sel.value })
        });
        loadPedidos();
      });
    });

    // Eventos guardar Guía Shalom
    tbody.querySelectorAll('.btn-guardar-guia').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.saveGuia;
        const inputGuia = tbody.querySelector(`.input-pedido-guia[data-guia-id="${id}"]`);
        const inputArt = tbody.querySelector(`.input-pedido-artesano[data-artesano-id="${id}"]`);
        const inputFechaArt = tbody.querySelector(`.input-pedido-fecha-art[data-fecha-art-id="${id}"]`);
        const guia_envio = inputGuia ? inputGuia.value.trim() : '';
        const artesano_nombre = inputArt ? inputArt.value.trim() : '';
        const fecha_compromiso_artesano = inputFechaArt ? inputFechaArt.value : '';
        btn.textContent = '...';
        await apiFetch(`/pedidos/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guia_envio, artesano_nombre, fecha_compromiso_artesano })
        });
        loadPedidos();
      });
    });

    // Eventos eliminar pedido
    tbody.querySelectorAll('.btn-eliminar-pedido').forEach(btn => {
      btn.addEventListener('click', () => {
        openConfirmModal({
          title: '¿Eliminar reserva de pedido?',
          message: `Se cancelará y eliminará la reserva de "${btn.dataset.nombre}". Esta acción no se puede deshacer.`,
          confirmText: 'Sí, eliminar',
          onConfirm: async () => {
            await apiFetch(`/pedidos/${btn.dataset.id}`, { method: 'DELETE' });
            loadPedidos();
          }
        });
      });
    });
  }

  // Eventos filtros de pedidos
  if (filtroPedidoSearch) filtroPedidoSearch.addEventListener('input', () => loadPedidos());
  if (filtroPedidoEntrega) filtroPedidoEntrega.addEventListener('change', () => loadPedidos());
  if (filtroPedidoPago) filtroPedidoPago.addEventListener('change', () => loadPedidos());
  if (filtroPedidoEstado) filtroPedidoEstado.addEventListener('change', () => loadPedidos());
  if (btnLimpiarFiltrosPedidos) {
    btnLimpiarFiltrosPedidos.addEventListener('click', () => {
      if (filtroPedidoSearch) filtroPedidoSearch.value = '';
      if (filtroPedidoEntrega) filtroPedidoEntrega.value = '';
      if (filtroPedidoPago) filtroPedidoPago.value = '';
      if (filtroPedidoEstado) filtroPedidoEstado.value = '';
      loadPedidos();
    });
  }

  // Exportar Pedidos CSV / Excel
  const btnExpPedCsv = document.getElementById('btn-exportar-pedidos-csv');
  if (btnExpPedCsv) {
    btnExpPedCsv.addEventListener('click', () => {
      const qs = filtrosPedidosQuery();
      descargarExport('/pedidos/export' + (qs ? `?${qs}` : ''), 'artesanitas-pedidos.csv');
    });
  }
  const btnExpPedXlsx = document.getElementById('btn-exportar-pedidos-xlsx');
  if (btnExpPedXlsx) {
    btnExpPedXlsx.addEventListener('click', () => {
      const qs = filtrosPedidosQuery();
      descargarExport('/pedidos/export.xlsx' + (qs ? `?${qs}` : ''), 'artesanitas-pedidos.xlsx');
    });
  }

  // ── Cambiar contraseña ──
  const btnCambiarPassword = document.getElementById('btn-cambiar-password');
  const formCambiarPassword = document.getElementById('form-cambiar-password');
  const btnCancelarPassword = document.getElementById('btn-cancelar-password');
  const cpError = document.getElementById('cp-error');
  const cpSuccess = document.getElementById('cp-success');

  if (btnCambiarPassword && formCambiarPassword) {
    btnCambiarPassword.addEventListener('click', () => {
      formCambiarPassword.classList.toggle('hidden');
    });
  }
  if (btnCancelarPassword && formCambiarPassword) {
    btnCancelarPassword.addEventListener('click', () => {
      formCambiarPassword.classList.add('hidden');
      formCambiarPassword.reset();
      if (cpError) cpError.classList.add('hidden');
      if (cpSuccess) cpSuccess.classList.add('hidden');
    });
  }

  if (formCambiarPassword) {
    formCambiarPassword.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (cpError) cpError.classList.add('hidden');
      if (cpSuccess) cpSuccess.classList.add('hidden');

      try {
        const token = localStorage.getItem(STORAGE_KEY);
        const res = await fetch('/api/negocios/auth/change-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            currentPassword: document.getElementById('cp-actual')?.value || '',
            newPassword: document.getElementById('cp-nueva')?.value || ''
          })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          if (cpSuccess) cpSuccess.classList.remove('hidden');
          formCambiarPassword.reset();
        } else {
          if (cpError) {
            cpError.textContent = data.message || 'Error al cambiar la contraseña.';
            cpError.classList.remove('hidden');
          }
        }
      } catch {
        if (cpError) {
          cpError.textContent = 'Error de conexión.';
          cpError.classList.remove('hidden');
        }
      }
    });
  }

  // Auto-entrada si ya hay una sesión guardada
  if (localStorage.getItem(STORAGE_KEY)) {
    mostrarPanel();
  }
})();
