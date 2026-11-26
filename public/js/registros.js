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
      await window.LpsModal.alert({ title: 'Sesión expirada', message: 'Tu sesión expiró. Vuelve a ingresar.', type: 'warning' });
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
    loadArtesanos();
    loadBiResumen();
    loadInventario();
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
  const tabBtnBi = document.getElementById('tab-btn-bi');
  const tabBtnInventario = document.getElementById('tab-btn-inventario');
  const tabBtnProductos = document.getElementById('tab-btn-productos');
  const tabTalleres = document.getElementById('tab-talleres');
  const tabRegistros = document.getElementById('tab-registros');
  const tabPedidos = document.getElementById('tab-pedidos');
  const tabBi = document.getElementById('tab-bi');
  const tabInventario = document.getElementById('tab-inventario');
  const tabProductos = document.getElementById('tab-productos');

  function activeTabClass(btn, active) {
    if (!btn) return;
    btn.className = active
      ? 'px-3.5 py-2 rounded-lg text-sm font-medium bg-[#B87352] text-white shadow-xs flex items-center gap-1.5 cursor-pointer'
      : 'px-3.5 py-2 rounded-lg text-sm font-medium text-[#8C7A6B] hover:text-[#4A3C31] flex items-center gap-1.5 cursor-pointer';
  }

  function mostrarTab(tab, btn) {
    [tabTalleres, tabRegistros, tabPedidos, tabBi, tabInventario, tabProductos].forEach(t => {
      if (t) t.classList.toggle('hidden', t !== tab);
    });
    [tabBtnTalleres, tabBtnRegistros, tabBtnPedidos, tabBtnBi, tabBtnInventario, tabBtnProductos].forEach(b => {
      if (b) activeTabClass(b, b === btn);
    });
    if (tab === tabBi) {
      loadBiResumen();
    }
    if (tab === tabInventario) {
      loadInventario();
    }
  }

  if (tabBtnTalleres) tabBtnTalleres.addEventListener('click', () => mostrarTab(tabTalleres, tabBtnTalleres));
  if (tabBtnRegistros) tabBtnRegistros.addEventListener('click', () => mostrarTab(tabRegistros, tabBtnRegistros));
  if (tabBtnPedidos) tabBtnPedidos.addEventListener('click', () => mostrarTab(tabPedidos, tabBtnPedidos));
  if (tabBtnBi) tabBtnBi.addEventListener('click', () => mostrarTab(tabBi, tabBtnBi));
  if (tabBtnInventario) tabBtnInventario.addEventListener('click', () => mostrarTab(tabInventario, tabBtnInventario));
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
    if (!res.ok) { await window.LpsModal.alert('Error al exportar.', 'error'); return; }
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
      window.LpsModal.confirm({ title: title || 'Confirmar acción', message: message || title, confirmText, danger: true }).then((ok) => {
        if (ok && onConfirm) onConfirm();
      });
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
    modalMonto.addEventListener('click', (e) => {
      if (e.target === modalMonto || e.target.hasAttribute('data-modal-backdrop')) cerrarModalMonto();
    });
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
      <button type="button" class="btn-quitar-acompanante shrink-0 w-10 h-10 rounded-lg border border-[#D5C9BD] text-[#8C7A6B] hover:text-[#B87352] hover:border-[#B87352] transition-colors flex items-center justify-center">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-4 h-4"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>`}
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
          const ok = await window.LpsModal.confirm({
            title: 'Migrar producto a editable',
            message: `"${btn.dataset.nombre}" pasará a ser un producto editable (arriba en la lista), con su nombre, precio, descripción y fotos actuales. La tarjeta anterior del catálogo se reemplazará por esta. ¿Continuar?`,
            confirmText: 'Sí, migrar'
          });
          if (!ok) return;
          try {
            const res = await apiFetch(`/productos-estaticos/${btn.dataset.slug}/migrar`, { method: 'POST' });
            const data = await res.json();
            if (res.ok && data.success) {
              loadProductos();
            } else {
              await window.LpsModal.alert(data.message || 'Error al migrar el producto.', 'error');
            }
          } catch {
            await window.LpsModal.alert('Error de conexión.', 'error');
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
              <div>${escapeHtml(p.linea || 'Vajilla')} → ${escapeHtml(p.sublinea || 'Tazas')}${p.coleccion ? ' (' + escapeHtml(p.coleccion) + ')' : ''}</div>
              <div class="flex items-center justify-between pt-1">
                <span class="font-semibold ${Number(p.stock_actual) > 0 ? 'text-green-700' : 'text-amber-700'}">
                  Stock: ${Number(p.stock_actual || 0)} und. (${Number(p.stock_actual) > 0 ? 'Entrega inmediata' : (p.politica_sin_stock === 'agotado' ? 'Agotado' : 'En Preventa')})
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
    en_produccion: '4. En Pintura / Acabados',
    recibido_taller: '5. Listo en Taller Artesanitas (QA OK)',
    enviado: '6. Enviado (Shalom / Courier)',
    entregado: '7. Entregado al Cliente',
    post_venta: '8. Post-Venta Completada',
    cancelado: 'Cancelado'
  };
  const ETAPA_ARTESANO_LABELS = {
    recibido: '1. Solicitud recibida',
    modelado: '2. En Modelado (arcilla/onzas)',
    primer_horno: '3. 1° Horno (Bizcocho)',
    segundo_horno: '4. 2° Horno (Alta temp.)',
    pintado_acabados: '5. Pintado y logos',
    listo_revision_qa: '6. Listo p/ Revisión QA',
    enviado_taller: '7. Enviado a Taller Artesanitas'
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
    const filtroVoucher = document.getElementById('filtro-pedido-voucher');
    if (filtroPedidoSearch && filtroPedidoSearch.value.trim()) params.set('search', filtroPedidoSearch.value.trim());
    if (filtroPedidoEntrega && filtroPedidoEntrega.value) params.set('tipo_entrega', filtroPedidoEntrega.value);
    if (filtroPedidoPago && filtroPedidoPago.value) params.set('estado_pago', filtroPedidoPago.value);
    if (filtroVoucher && filtroVoucher.value) params.set('voucher_ia', filtroVoucher.value);
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
                Recojo en Local
              </span>
              <span class="font-semibold text-[#4A3C31] block">Taller Trujillo (Gratis)</span>
            ` : `
              <span class="inline-flex items-center gap-1 bg-[#742284]/10 text-[#742284] text-[11px] font-bold px-2 py-0.5 rounded-md mb-0.5">
                Envío Shalom
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
          <td data-label="Pago" class="px-4 py-3 space-y-1">
            <select data-id="${p.id}" class="select-pedido-pago text-xs font-medium px-2.5 py-1 rounded-lg border-0 ${PAGO_CLASSES[p.estado_pago] || ''}">
              ${pagoOpts}
            </select>
            <div class="text-[11px] text-[#4A3C31] font-medium mt-1">
              Pagado: <strong>S/ ${Number(p.monto_pagado).toFixed(2)}</strong> de S/ ${Number(p.producto_precio).toFixed(2)}
            </div>
            ${Number(p.saldo_pendiente) > 0
              ? `<div class="text-[10px] font-semibold text-red-600">Saldo pendiente: S/ ${Number(p.saldo_pendiente).toFixed(2)}</div>`
              : `<div class="text-[10px] font-semibold text-green-700">Producto pagado 100%</div>`}
            ${(() => {
              const verif = p.voucher_verificacion_ia || 'pendiente';
              const op = p.voucher_nro_operacion ? `Op #${escapeHtml(p.voucher_nro_operacion)}` : 'Sin N° Op';
              const mDet = p.voucher_monto_detectado !== null && p.voucher_monto_detectado !== undefined
                ? ` · S/ ${Number(p.voucher_monto_detectado).toFixed(2)}`
                : '';
              const ent = p.voucher_entidad_detectada ? ` (${escapeHtml(p.voucher_entidad_detectada)})` : '';
              if (verif === 'verificado') {
                return `<div class="inline-block text-[10px] font-bold bg-green-50 text-green-800 border border-green-200 px-2 py-0.5 rounded-md">IA Verificado: ${op}${mDet}${ent} (OK)</div>`;
              }
              if (verif === 'duplicado') {
                return `<div class="inline-block text-[10px] font-extrabold bg-red-100 text-red-800 border border-red-300 px-2 py-0.5 rounded-md">ALERTA IA: Voucher Duplicado (${op})</div>`;
              }
              if (verif === 'monto_difiere') {
                return `<div class="inline-block text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-md">OBSERVACIÓN IA: Monto difiere (${op}${mDet})</div>`;
              }
              return `<div class="inline-block text-[10px] font-medium bg-[#F1EDE7] text-[#8C7A6B] px-2 py-0.5 rounded-md">IA: ${p.voucher_nro_operacion ? op + mDet : 'Pendiente validación'}</div>`;
            })()}
            ${p.tiene_comprobante ? `
              <div>
                <button type="button" data-ver-voucher="${p.id}"
                  class="btn-ver-voucher inline-flex items-center gap-1 text-[10px] font-bold text-[#007A78] hover:underline cursor-pointer">
                  <span class="flex items-center gap-1.5"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg> Ver / Auditar voucher</span>
                </button>
              </div>
            ` : ''}
          </td>
          <td data-label="Estado Pedido" class="px-4 py-3 space-y-1.5 min-w-[290px]">
            <select data-id="${p.id}" class="select-pedido-estado text-xs font-semibold px-2.5 py-1 rounded-lg border-0 w-full ${ESTADO_PEDIDO_CLASSES[p.estado_pedido] || ''}">
              ${estadoOpts}
            </select>
            <div class="bg-[#F9F6F0] p-2.5 rounded-xl border border-[#EBE5DE] space-y-1.5 mt-1 text-left">
              <div class="flex items-center justify-between">
                <span class="text-[10px] font-bold text-[#8C7A6B] uppercase">1. Encargo al Artesano</span>
                <span class="text-[10px] font-bold text-[#B87352]">${escapeHtml(ETAPA_ARTESANO_LABELS[p.etapa_artesano] || '1. Recibido')}</span>
              </div>
              <div class="grid grid-cols-2 gap-1">
                <input type="text" list="lista-artesanos-datalist" data-artesano-id="${p.id}" value="${escapeHtml(p.artesano_nombre || '')}" placeholder="Artesano asignado"
                  class="input-pedido-artesano w-full px-2 py-1 text-[11px] rounded-lg border border-[#D5C9BD] bg-white focus:outline-none focus:border-[#B87352]">
                <input type="number" step="0.01" min="0" data-costo-art-id="${p.id}" value="${p.costo_artesano_total !== null && p.costo_artesano_total !== undefined ? Number(p.costo_artesano_total) : ''}" placeholder="Cotización S/ (Art.)"
                  class="input-pedido-costo-art w-full px-2 py-1 text-[11px] rounded-lg border border-[#D5C9BD] bg-white focus:outline-none focus:border-[#B87352]"
                  title="Cotización / Costo total pactado con el artesano">
              </div>
              <div class="grid grid-cols-2 gap-1">
                <select data-etapa-art-id="${p.id}" class="input-pedido-etapa-art px-1.5 py-1 text-[10px] font-semibold rounded-lg border border-[#D5C9BD] bg-white text-[#4A3C31]">
                  ${Object.keys(ETAPA_ARTESANO_LABELS).map(k => `<option value="${k}" ${(p.etapa_artesano || 'recibido') === k ? 'selected' : ''}>${ETAPA_ARTESANO_LABELS[k]}</option>`).join('')}
                </select>
                <input type="date" data-fecha-art-id="${p.id}" value="${p.fecha_compromiso_artesano ? String(p.fecha_compromiso_artesano).slice(0, 10) : ''}"
                  class="input-pedido-fecha-art px-1.5 py-1 text-[10px] rounded-lg border border-[#D5C9BD] bg-white" title="Fecha compromiso del artesano">
              </div>
              <textarea rows="2" data-espec-art-id="${p.id}" placeholder="Detalles para el artesano: onzas (ej. 12oz), tamaños, colores, logo de marca personalizada, etc."
                class="input-pedido-espec-art w-full px-2 py-1 text-[11px] rounded-lg border border-[#D5C9BD] bg-white focus:outline-none focus:border-[#B87352]">${escapeHtml(p.especificaciones_artesano || '')}</textarea>
              ${(() => {
                if (!p.fecha_compromiso_artesano || ['recibido_taller', 'enviado', 'entregado', 'post_venta', 'cancelado'].includes(p.estado_pedido)) return '';
                const hoy = new Date().toISOString().slice(0, 10);
                const comp = String(p.fecha_compromiso_artesano).slice(0, 10);
                return hoy > comp
                  ? `<div class="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md border border-red-200">Artesano demorado (venció ${comp})</div>`
                  : '';
              })()}

              <!-- 2. Revisión QA Artesanitas (Onzas, Logos, Colores, Medidas) -->
              <div class="pt-1.5 border-t border-[#EBE5DE] space-y-1">
                <div class="flex items-center justify-between">
                  <span class="text-[10px] font-bold text-[#8C7A6B] uppercase">2. Validación QA Artesanitas</span>
                  <select data-qa-estado-id="${p.id}" class="input-pedido-qa-estado text-[10px] font-bold px-1.5 py-0.5 rounded-md border border-[#D5C9BD] ${p.qa_estado === 'aprobado' ? 'bg-green-100 text-green-800' : (p.qa_estado === 'observado' ? 'bg-red-100 text-red-800' : 'bg-white text-[#4A3C31]')}">
                    <option value="pendiente" ${(p.qa_estado || 'pendiente') === 'pendiente' ? 'selected' : ''}>⏳ QA Pendiente</option>
                    <option value="aprobado" ${p.qa_estado === 'aprobado' ? 'selected' : ''}>QA Aprobado (OK)</option>
                    <option value="observado" ${p.qa_estado === 'observado' ? 'selected' : ''}>QA Observado</option>
                  </select>
                </div>
                ${(() => {
                  const chk = (p.qa_checklist && typeof p.qa_checklist === 'object') ? p.qa_checklist : {};
                  return `
                    <div class="grid grid-cols-2 gap-1 text-[10px] text-[#4A3C31] bg-white p-1.5 rounded-lg border border-[#EBE5DE]">
                      <label class="inline-flex items-center gap-1 cursor-pointer"><input type="checkbox" data-qa-onzas="${p.id}" ${chk.onzas ? 'checked' : ''} class="accent-[#008f6b]"> Onzas / Tam.</label>
                      <label class="inline-flex items-center gap-1 cursor-pointer"><input type="checkbox" data-qa-logos="${p.id}" ${chk.logos ? 'checked' : ''} class="accent-[#008f6b]"> Logos / Marca</label>
                      <label class="inline-flex items-center gap-1 cursor-pointer"><input type="checkbox" data-qa-colores="${p.id}" ${chk.colores ? 'checked' : ''} class="accent-[#008f6b]"> Colores</label>
                      <label class="inline-flex items-center gap-1 cursor-pointer"><input type="checkbox" data-qa-acabados="${p.id}" ${chk.acabados ? 'checked' : ''} class="accent-[#008f6b]"> Acabados</label>
                    </div>
                  `;
                })()}
                <input type="text" data-qa-obs-id="${p.id}" value="${escapeHtml(p.qa_observaciones || '')}" placeholder="Observación QA (si varía onzas/logo/color)"
                  class="input-pedido-qa-obs w-full px-2 py-1 text-[10px] rounded-lg border border-[#D5C9BD] bg-white focus:outline-none focus:border-[#B87352]">
              </div>

              <!-- 3. Ciudad Destino, Fecha Entrega Cliente y Guía Courier -->
              <div class="pt-1.5 border-t border-[#EBE5DE] space-y-1">
                <span class="text-[10px] font-bold text-[#8C7A6B] uppercase block">3. Destino, Fecha Cliente & Courier</span>
                <div class="grid grid-cols-2 gap-1">
                  <input type="text" data-ciudad-id="${p.id}" value="${escapeHtml(p.ciudad_destino || '')}" placeholder="Ciudad destino"
                    class="input-pedido-ciudad px-2 py-1 text-[10px] rounded-lg border border-[#D5C9BD] bg-white">
                  <input type="date" data-fecha-cli-id="${p.id}" value="${p.fecha_entrega ? String(p.fecha_entrega).slice(0, 10) : ''}"
                    class="input-pedido-fecha-cli px-1.5 py-1 text-[10px] rounded-lg border border-[#D5C9BD] bg-white" title="Fecha de entrega al cliente según ciudad">
                </div>
                <div class="flex items-center gap-1">
                  <input type="text" data-empresa-id="${p.id}" value="${escapeHtml(p.empresa_envio || 'Shalom')}" placeholder="Courier"
                    class="input-pedido-empresa w-20 px-2 py-1 text-[10px] rounded-lg border border-[#D5C9BD] bg-white" title="Agencia (Shalom, Olva, etc.)">
                  <input type="text" data-guia-id="${p.id}" value="${escapeHtml(p.guia_envio || '')}" placeholder="N° Guía / Ticket"
                    class="input-pedido-guia flex-1 px-2 py-1 text-[11px] font-mono rounded-lg border border-[#D5C9BD] bg-white focus:outline-none focus:border-[#B87352]">
                  <button type="button" data-save-guia="${p.id}"
                    class="btn-guardar-guia text-[10px] font-bold bg-[#4A3C31] text-white px-2.5 py-1 rounded-lg hover:bg-[#B87352] transition-colors cursor-pointer"
                    title="Guardar Artesano, Especificaciones, QA y Guía">
                    Guardar
                  </button>
                </div>
              </div>
            </div>
            <a href="https://wa.me/51${cleanPhone}?text=${encodeURIComponent(`Hola ${p.nombre}! Te escribimos de Artesanitas Perú. El estado de tu pedido (${p.codigo_pedido || ('ART-' + p.id)}) es: ${ESTADO_PEDIDO_LABELS[p.estado_pedido] || p.estado_pedido}${p.ciudad_destino ? ' con destino a ' + p.ciudad_destino : ''}${p.fecha_entrega ? ' (Entrega estimada: ' + String(p.fecha_entrega).slice(0, 10) + ')' : ''}${p.guia_envio ? '. Tu guía ' + (p.empresa_envio || 'Shalom') + ' es: ' + p.guia_envio : ''}. Puedes rastrearlo en vivo aquí: ${window.location.origin}/seguimiento?codigo=${p.codigo_pedido || ''}`)}"
              target="_blank" rel="noreferrer"
              class="inline-flex items-center gap-1 text-[10px] font-semibold text-[#B87352] hover:underline pt-0.5">
              <span class="flex items-center gap-1.5"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg> Comunicar tracking al cliente</span>
            </a>
          </td>
          <td data-label="Acciones" class="px-4 py-3 text-right">
            <button type="button" data-imprimir-guia="${p.id}" class="btn-imprimir-guia-despacho text-xs font-bold text-[#007A78] hover:underline flex items-center gap-1 cursor-pointer justify-end mb-1 ml-auto">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3 h-3"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/></svg> Packing Slip
            </button>
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

    // Eventos guardar Guía Shalom, Artesano, Especificaciones, QA y Destino
    tbody.querySelectorAll('.btn-guardar-guia').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.saveGuia;
        const inputGuia = tbody.querySelector(`.input-pedido-guia[data-guia-id="${id}"]`);
        const inputEmpresa = tbody.querySelector(`.input-pedido-empresa[data-empresa-id="${id}"]`);
        const inputCiudad = tbody.querySelector(`.input-pedido-ciudad[data-ciudad-id="${id}"]`);
        const inputFechaCli = tbody.querySelector(`.input-pedido-fecha-cli[data-fecha-cli-id="${id}"]`);
        const inputArt = tbody.querySelector(`.input-pedido-artesano[data-artesano-id="${id}"]`);
        const inputCostoArt = tbody.querySelector(`.input-pedido-costo-art[data-costo-art-id="${id}"]`);
        const inputEtapaArt = tbody.querySelector(`.input-pedido-etapa-art[data-etapa-art-id="${id}"]`);
        const inputFechaArt = tbody.querySelector(`.input-pedido-fecha-art[data-fecha-art-id="${id}"]`);
        const inputEspecArt = tbody.querySelector(`.input-pedido-espec-art[data-espec-art-id="${id}"]`);
        const inputQaEstado = tbody.querySelector(`.input-pedido-qa-estado[data-qa-estado-id="${id}"]`);
        const inputQaObs = tbody.querySelector(`.input-pedido-qa-obs[data-qa-obs-id="${id}"]`);
        const chkOnzas = tbody.querySelector(`input[data-qa-onzas="${id}"]`);
        const chkLogos = tbody.querySelector(`input[data-qa-logos="${id}"]`);
        const chkColores = tbody.querySelector(`input[data-qa-colores="${id}"]`);
        const chkAcabados = tbody.querySelector(`input[data-qa-acabados="${id}"]`);

        const payload = {
          guia_envio: inputGuia ? inputGuia.value.trim() : '',
          empresa_envio: inputEmpresa ? inputEmpresa.value.trim() : 'Shalom',
          ciudad_destino: inputCiudad ? inputCiudad.value.trim() : '',
          fecha_entrega: inputFechaCli ? inputFechaCli.value : undefined,
          artesano_nombre: inputArt ? inputArt.value.trim() : '',
          costo_artesano_total: inputCostoArt ? inputCostoArt.value.trim() : '',
          etapa_artesano: inputEtapaArt ? inputEtapaArt.value : 'recibido',
          fecha_compromiso_artesano: inputFechaArt ? inputFechaArt.value : '',
          especificaciones_artesano: inputEspecArt ? inputEspecArt.value.trim() : '',
          qa_estado: inputQaEstado ? inputQaEstado.value : 'pendiente',
          qa_observaciones: inputQaObs ? inputQaObs.value.trim() : '',
          qa_checklist: {
            onzas: !!(chkOnzas && chkOnzas.checked),
            logos: !!(chkLogos && chkLogos.checked),
            colores: !!(chkColores && chkColores.checked),
            acabados: !!(chkAcabados && chkAcabados.checked)
          }
        };

        btn.textContent = '...';
        await apiFetch(`/pedidos/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        loadPedidos();
        loadArtesanos();
        loadBiResumen();
      });
    });

    tbody.querySelectorAll('.btn-ver-voucher').forEach(btn => {
      btn.addEventListener('click', () => {
        abrirModalVisorVoucher(btn.dataset.verVoucher);
      });
    });

    // Eventos imprimir packing slip y eliminar pedido
    tbody.querySelectorAll('.btn-imprimir-guia-despacho').forEach(btn => {
      btn.addEventListener('click', () => {
        abrirPackingSlipPedido(btn.dataset.imprimirGuia);
      });
    });

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

  let visorVoucherBlobUrl = null;
  let visorVoucherPedidoId = null;

  function cerrarModalVisorVoucher() {
    const modal = document.getElementById('modal-visor-voucher');
    if (modal) modal.classList.add('hidden');
    if (visorVoucherBlobUrl) {
      URL.revokeObjectURL(visorVoucherBlobUrl);
      visorVoucherBlobUrl = null;
    }
    const imgEl = document.getElementById('visor-voucher-img');
    if (imgEl) imgEl.src = '';
    visorVoucherPedidoId = null;
  }

  async function abrirModalVisorVoucher(pedidoId) {
    const modal = document.getElementById('modal-visor-voucher');
    const ped = pedidosCache.find(p => String(p.id) === String(pedidoId));
    if (!modal || !ped) return;

    visorVoucherPedidoId = ped.id;
    const titEl = document.getElementById('visor-voucher-titulo');
    const infoEl = document.getElementById('visor-voucher-info');
    const iaEl = document.getElementById('visor-voucher-ia-estado');
    const imgEl = document.getElementById('visor-voucher-img');
    const loadingEl = document.getElementById('visor-voucher-loading');

    if (titEl) titEl.textContent = `Comprobante · ${ped.codigo_pedido || ('ART-' + ped.id)}`;
    if (infoEl) infoEl.textContent = `${ped.nombre} · Pagado: S/ ${Number(ped.monto_pagado || 0).toFixed(2)} de S/ ${Number(ped.producto_precio || 0).toFixed(2)}`;
    if (iaEl) {
      const op = ped.voucher_nro_operacion ? `Op #${ped.voucher_nro_operacion}` : 'Sin N° Op';
      const det = ped.voucher_monto_detectado != null ? `S/ ${Number(ped.voucher_monto_detectado).toFixed(2)}` : 'Sin monto';
      iaEl.textContent = `IA: ${(ped.voucher_verificacion_ia || 'pendiente').toUpperCase()} (${op} · ${det})`;
    }
    if (loadingEl) loadingEl.classList.remove('hidden');
    if (imgEl) imgEl.classList.add('hidden');
    modal.classList.remove('hidden');

    try {
      const res = await apiFetch(`/pedidos/${ped.id}/comprobante`);
      if (!res.ok) throw new Error('Error');
      const blob = await res.blob();
      if (visorVoucherBlobUrl) URL.revokeObjectURL(visorVoucherBlobUrl);
      visorVoucherBlobUrl = URL.createObjectURL(blob);
      if (imgEl) {
        imgEl.src = visorVoucherBlobUrl;
        imgEl.classList.remove('hidden');
      }
    } catch {
      if (iaEl) iaEl.textContent = 'No se pudo cargar la imagen del comprobante.';
    } finally {
      if (loadingEl) loadingEl.classList.add('hidden');
    }
  }

  function initVisorVoucherModal() {
    const modal = document.getElementById('modal-visor-voucher');
    const btnCerrar = document.getElementById('btn-cerrar-visor-voucher');
    const btnAprobar = document.getElementById('btn-visor-aprobar-pago');
    const btnObservar = document.getElementById('btn-visor-observar-pago');
    const btnReanalizar = document.getElementById('btn-visor-reanalizar-ia');

    if (btnCerrar) btnCerrar.addEventListener('click', cerrarModalVisorVoucher);
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal || e.target.hasAttribute('data-modal-backdrop')) cerrarModalVisorVoucher();
      });
    }

    if (btnAprobar) {
      btnAprobar.addEventListener('click', async () => {
        if (!visorVoucherPedidoId) return;
        const ped = pedidosCache.find(p => String(p.id) === String(visorVoucherPedidoId));
        const montoTotal = ped ? Number(ped.producto_precio || 0) : undefined;
        await apiFetch(`/pedidos/${visorVoucherPedidoId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            estado_pago: 'completo',
            ...(montoTotal !== undefined ? { monto_pagado: montoTotal } : {}),
            voucher_verificacion_ia: 'verificado'
          })
        });
        cerrarModalVisorVoucher();
        loadPedidos();
      });
    }

    if (btnObservar) {
      btnObservar.addEventListener('click', async () => {
        if (!visorVoucherPedidoId) return;
        await apiFetch(`/pedidos/${visorVoucherPedidoId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ voucher_verificacion_ia: 'monto_difiere' })
        });
        cerrarModalVisorVoucher();
        loadPedidos();
      });
    }

    if (btnReanalizar) {
      btnReanalizar.addEventListener('click', async () => {
        if (!visorVoucherPedidoId) return;
        const orig = btnReanalizar.textContent;
        btnReanalizar.disabled = true;
        btnReanalizar.textContent = 'Analizando con IA...';
        try {
          const res = await apiFetch(`/pedidos/${visorVoucherPedidoId}/reanalizar-voucher`, { method: 'POST' });
          const data = await res.json();
          if (res.ok && data.success && data.voucher) {
            const iaEl = document.getElementById('visor-voucher-ia-estado');
            if (iaEl) {
              iaEl.textContent = `IA: ${String(data.voucher.verificacion_ia || 'pendiente').toUpperCase()} (${data.voucher.nro_operacion || 'Sin N° Op'})`;
            }
            loadPedidos();
          }
        } finally {
          btnReanalizar.disabled = false;
          btnReanalizar.textContent = orig;
        }
      });
    }
  }
  initVisorVoucherModal();

  // Eventos filtros de pedidos
  const filtroPedidoVoucherEl = document.getElementById('filtro-pedido-voucher');
  if (filtroPedidoSearch) filtroPedidoSearch.addEventListener('input', () => loadPedidos());
  if (filtroPedidoEntrega) filtroPedidoEntrega.addEventListener('change', () => loadPedidos());
  if (filtroPedidoPago) filtroPedidoPago.addEventListener('change', () => loadPedidos());
  if (filtroPedidoVoucherEl) filtroPedidoVoucherEl.addEventListener('change', () => loadPedidos());
  if (filtroPedidoEstado) filtroPedidoEstado.addEventListener('change', () => loadPedidos());
  if (btnLimpiarFiltrosPedidos) {
    btnLimpiarFiltrosPedidos.addEventListener('click', () => {
      if (filtroPedidoSearch) filtroPedidoSearch.value = '';
      if (filtroPedidoEntrega) filtroPedidoEntrega.value = '';
      if (filtroPedidoPago) filtroPedidoPago.value = '';
      if (filtroPedidoVoucherEl) filtroPedidoVoucherEl.value = '';
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

  // ── Sprint 2: Dashboard BI & Rentabilidad por Línea y Artesano ──
  const btnRefreshBi = document.getElementById('btn-refresh-bi');
  if (btnRefreshBi) {
    btnRefreshBi.addEventListener('click', () => loadBiResumen());
  }

  async function loadBiResumen() {
    try {
      const res = await apiFetch('/bi-resumen');
      if (!res.ok) return;
      const data = await res.json();
      if (!data || !data.success) return;

      const f = data.finanzas || {};
      const jerarquia = Array.isArray(data.jerarquia_retail) ? data.jerarquia_retail : [];
      const artesanos = Array.isArray(data.artesanos) ? data.artesanos : [];

      const ventasTotales = Number(f.ventas_totales || 0);
      const totalAbonado = Number(f.total_abonado || 0);
      const saldosCobrar = Number(f.saldos_por_cobrar || 0);
      const costoArtesanos = Number(f.costo_total_artesanos || 0);
      const margenSoles = Number(f.margen_bruto_soles || 0);
      const margenPct = Number(f.margen_bruto_pct || 0);
      const totalPedidos = Number(f.total_pedidos || 0);
      const totalPiezas = Number(f.total_piezas || 0);

      const elVentas = document.getElementById('bi-kpi-ventas');
      if (elVentas) elVentas.textContent = `S/ ${ventasTotales.toFixed(2)}`;
      const elPedSub = document.getElementById('bi-kpi-pedidos-sub');
      if (elPedSub) elPedSub.textContent = `${totalPedidos} ${totalPedidos === 1 ? 'pedido activo' : 'pedidos activos'} · ${totalPiezas} ${totalPiezas === 1 ? 'pieza' : 'piezas'}`;

      const elAbonado = document.getElementById('bi-kpi-abonado');
      if (elAbonado) elAbonado.textContent = `S/ ${totalAbonado.toFixed(2)}`;
      const pctCobrado = ventasTotales > 0 ? Math.round((totalAbonado / ventasTotales) * 100) : 0;
      const elAbonadoSub = document.getElementById('bi-kpi-abonado-sub');
      if (elAbonadoSub) elAbonadoSub.textContent = `${pctCobrado}% del valor total recaudado`;

      const elSaldos = document.getElementById('bi-kpi-saldos');
      if (elSaldos) elSaldos.textContent = `S/ ${saldosCobrar.toFixed(2)}`;

      const elCostoArt = document.getElementById('bi-kpi-costo-art');
      if (elCostoArt) elCostoArt.textContent = `S/ ${costoArtesanos.toFixed(2)}`;

      const elMargenSoles = document.getElementById('bi-kpi-margen-soles');
      if (elMargenSoles) elMargenSoles.textContent = `S/ ${margenSoles.toFixed(2)}`;

      const elMargenPct = document.getElementById('bi-kpi-margen-pct');
      if (elMargenPct) {
        elMargenPct.textContent = `${margenPct.toFixed(1)}%`;
        elMargenPct.className = margenPct >= 50
          ? 'bg-[#008f6b] text-white text-[11px] font-extrabold px-2 py-0.5 rounded-full'
          : (margenPct >= 30 ? 'bg-[#B87352] text-white text-[11px] font-extrabold px-2 py-0.5 rounded-full' : 'bg-red-600 text-white text-[11px] font-extrabold px-2 py-0.5 rounded-full');
      }

      // Renderizar barras de progreso por Jerarquía Retail (Línea -> Sub-línea -> Colección)
      const barsContainer = document.getElementById('bi-colecciones-bars');
      const barsEmpty = document.getElementById('bi-colecciones-empty');
      if (barsEmpty) barsEmpty.classList.toggle('hidden', jerarquia.length > 0);
      if (barsContainer) {
        const totalVentasJerarquia = jerarquia.reduce((acc, r) => acc + Number(r.ventas_soles || 0), 0) || 1;
        barsContainer.innerHTML = jerarquia.map(item => {
          const vSoles = Number(item.ventas_soles || 0);
          const cSoles = Number(item.costo_artesano_soles || 0);
          const mSoles = Number(item.margen_soles || 0);
          const sharePct = Math.min(100, Math.round((vSoles / totalVentasJerarquia) * 100));
          const itemMargenPct = vSoles > 0 ? Math.round((mSoles / vSoles) * 100) : 0;

          return `
            <div class="p-3.5 rounded-2xl bg-[#F9F6F0] border border-[#EBE5DE] space-y-2">
              <div class="flex items-start justify-between gap-2">
                <div>
                  <span class="text-[10px] font-bold uppercase tracking-wider text-[#8C7A6B] block">
                    ${escapeHtml(item.linea)} → ${escapeHtml(item.sublinea)}
                  </span>
                  <h4 class="text-sm font-bold text-[#4A3C31]">${escapeHtml(item.coleccion)}</h4>
                </div>
                <div class="text-right shrink-0">
                  <span class="text-sm font-extrabold text-[#4A3C31] block">S/ ${vSoles.toFixed(2)}</span>
                  <span class="text-[11px] text-[#008f6b] font-semibold">Margen: S/ ${mSoles.toFixed(2)} (${itemMargenPct}%)</span>
                </div>
              </div>
              <div class="w-full h-2.5 bg-[#EBE5DE] rounded-full overflow-hidden">
                <div class="h-full bg-gradient-to-r from-[#B87352] to-[#4A3C31] rounded-full transition-all duration-500" style="width: ${Math.max(4, sharePct)}%"></div>
              </div>
              <div class="flex items-center justify-between text-[11px] text-[#8C7A6B]">
                <span><strong>${Number(item.piezas || 0)}</strong> piezas en <strong>${Number(item.pedidos || 0)}</strong> pedidos</span>
                <span>Costo art.: S/ ${cSoles.toFixed(2)} · <strong>${sharePct}%</strong> de ventas</span>
              </div>
            </div>
          `;
        }).join('');
      }

      // Renderizar tabla de rendimiento y puntualidad de artesanos
      const artTbody = document.getElementById('bi-artesanos-tbody');
      const artEmpty = document.getElementById('bi-artesanos-empty');
      if (artEmpty) artEmpty.classList.toggle('hidden', artesanos.length > 0);
      if (artTbody) {
        artTbody.innerHTML = artesanos.map(a => {
          const aTiempo = Number(a.entregados_a_tiempo || 0);
          const atrasados = Number(a.atrasados || 0);
          const enProd = Number(a.en_produccion || 0);
          const evaluados = aTiempo + atrasados;
          const puntualidadPct = evaluados > 0 ? Math.round((aTiempo / evaluados) * 100) : 100;

          return `
            <tr class="hover:bg-[#F9F6F0]/60 transition-colors">
              <td class="py-3 pr-3">
                <div class="font-bold text-[#4A3C31]">${escapeHtml(a.artesano)}</div>
                <span class="text-[11px] text-[#8C7A6B]">${enProd > 0 ? `${enProd} en taller/producción` : 'Al día'}</span>
              </td>
              <td class="py-3 px-2 text-center">
                <span class="font-bold text-[#4A3C31]">${Number(a.pedidos_asignados || 0)}</span>
                <span class="text-xs text-[#8C7A6B] block">${Number(a.piezas_asignadas || 0)} piezas</span>
              </td>
              <td class="py-3 px-2 text-center">
                <div class="inline-flex items-center gap-1.5">
                  <span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-green-50 text-green-700 border border-green-200" title="Entregados a tiempo">
                    ${aTiempo} a tiempo
                  </span>
                  <span class="px-2 py-0.5 rounded-full text-[11px] font-bold ${atrasados > 0 ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-[#F1EDE7] text-[#8C7A6B]'}" title="Pedidos atrasados">
                    ${atrasados} atrasados
                  </span>
                </div>
                <span class="block text-[10px] font-semibold ${atrasados > 0 ? 'text-amber-700' : 'text-[#008f6b]'} mt-0.5">
                  ${evaluados > 0 ? `${puntualidadPct}% puntualidad` : 'En plazo'}
                </span>
              </td>
              <td class="py-3 pl-2 text-right">
                <span class="font-bold text-[#742284] block">S/ ${Number(a.pago_acumulado || 0).toFixed(2)}</span>
                <span class="text-[11px] text-[#8C7A6B]">Ventas: S/ ${Number(a.ventas_generadas || 0).toFixed(2)}</span>
              </td>
            </tr>
          `;
        }).join('');
      }
    } catch (e) {
      console.error('Error cargando resumen BI:', e);
    }
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

  // ── Sprint 3: Directorio de Artesanos Aliados & Magic Links + Sprint 6: Push Admin ──
  const formNuevoArtesano = document.getElementById('form-nuevo-artesano');
  const artesanosListEl = document.getElementById('artesanos-magic-links-list');

  async function loadArtesanos() {
    if (!artesanosListEl) return;
    try {
      const res = await apiFetch('/artesanos');
      if (!res.ok) return;
      const data = await res.json();
      const artesanos = (data && data.artesanos) || [];
      const datalistEl = document.getElementById('lista-artesanos-datalist');
      if (datalistEl) {
        datalistEl.innerHTML = artesanos
          .filter(a => a.activo !== false)
          .map(a => `<option value="${escapeHtml(a.nombre)}">`)
          .join('');
      }
      if (artesanos.length === 0) {
        artesanosListEl.innerHTML = `<p class="text-xs text-[#8C7A6B] italic col-span-full">Aún no hay artesanos registrados. Crea uno arriba o escribe su nombre en cualquier pedido para generar su Magic Link automático.</p>`;
        return;
      }
      artesanosListEl.innerHTML = artesanos.map(a => {
        const magicUrl = `${window.location.origin}/taller-artesano?token=${encodeURIComponent(a.access_token)}`;
        const cleanWa = String(a.whatsapp || '').replace(/\D/g, '');
        const waHref = cleanWa
          ? `https://wa.me/51${cleanWa}?text=${encodeURIComponent(`Hola ${a.nombre}! Aquí tienes tu enlace privado del Portal de Taller de Artesanitas Perú para revisar las especificaciones de tus solicitudes asignadas (cotización, onzas, colores, logos) y reportar avances de horno y pintado: ${magicUrl}`)}`
          : '';
        const isActivo = a.activo !== false;
        return `
          <div class="p-3 rounded-2xl bg-[#F9F6F0] border ${isActivo ? 'border-[#EBE5DE]' : 'border-red-200 opacity-75'} flex flex-col justify-between gap-2">
            <div class="flex items-start justify-between gap-2">
              <div>
                <div class="flex items-center gap-1.5 flex-wrap">
                  <h4 class="text-xs font-bold text-[#4A3C31]">${escapeHtml(a.nombre)}</h4>
                  ${!isActivo ? '<span class="text-[9px] font-extrabold bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">PAUSADO</span>' : ''}
                </div>
                <span class="text-[11px] text-[#8C7A6B]">${Number(a.pedidos_activos || 0)} solicitudes activas · ${Number(a.total_pedidos || 0)} hist.</span>
              </div>
              ${Number(a.pendientes_qa || 0) > 0 ? `
                <span class="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                  ${a.pendientes_qa} p/ QA
                </span>
              ` : ''}
            </div>
            <div class="flex items-center gap-1.5 pt-1">
              <button type="button" data-copy-magic="${escapeHtml(magicUrl)}"
                class="btn-copy-magic flex-1 bg-white hover:bg-[#B87352] text-[#4A3C31] hover:text-white border border-[#D5C9BD] text-[11px] font-bold py-1.5 px-2.5 rounded-xl transition-colors cursor-pointer">
                Copiar Link
              </button>
              <a href="${escapeHtml(magicUrl)}" target="_blank" rel="noreferrer"
                class="bg-white hover:bg-[#4A3C31] text-[#4A3C31] hover:text-white border border-[#D5C9BD] text-[11px] font-bold py-1.5 px-2.5 rounded-xl transition-colors"
                title="Abrir vista del artesano">
                ↗
              </a>
              ${waHref ? `
                <a href="${waHref}" target="_blank" rel="noreferrer"
                  class="bg-[#008f6b] hover:bg-[#007759] text-white text-[11px] font-bold py-1.5 px-2.5 rounded-xl transition-colors"
                  title="Enviar Magic Link por WhatsApp al artesano">
                  WA
                </a>
              ` : ''}
            </div>
            <div class="flex items-center justify-between gap-2 pt-1 border-t border-[#EBE5DE]">
              <button type="button" data-rotar-art="${a.id}" data-rotar-nombre="${escapeHtml(a.nombre)}"
                class="btn-rotar-magic text-[10px] font-bold text-[#8C7A6B] hover:text-[#B87352] hover:underline cursor-pointer">
                Rotar Magic Link
              </button>
              <button type="button" data-toggle-art="${a.id}" data-art-activo="${isActivo}"
                class="btn-toggle-art-activo text-[10px] font-bold ${isActivo ? 'text-red-600' : 'text-[#008f6b]'} hover:underline cursor-pointer">
                ${isActivo ? 'Pausar acceso' : 'Reactivar acceso'}
              </button>
            </div>
          </div>
        `;
      }).join('');

      artesanosListEl.querySelectorAll('.btn-copy-magic').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(btn.dataset.copyMagic);
            const orig = btn.textContent;
            btn.textContent = '¡Link copiado!';
            setTimeout(() => { btn.textContent = orig; }, 1800);
          } catch {}
        });
      });

      artesanosListEl.querySelectorAll('.btn-rotar-magic').forEach(btn => {
        btn.addEventListener('click', () => {
          openConfirmModal({
            title: '¿Rotar Magic Link de seguridad?',
            message: `Se generará un nuevo enlace para "${btn.dataset.rotarNombre}" y el enlace anterior dejará de funcionar inmediatamente.`,
            confirmText: 'Sí, rotar enlace',
            onConfirm: async () => {
              await apiFetch(`/artesanos/${btn.dataset.rotarArt}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rotar_token: true })
              });
              loadArtesanos();
            }
          });
        });
      });

      artesanosListEl.querySelectorAll('.btn-toggle-art-activo').forEach(btn => {
        btn.addEventListener('click', async () => {
          const nuevoEstado = btn.dataset.artActivo !== 'true';
          await apiFetch(`/artesanos/${btn.dataset.toggleArt}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activo: nuevoEstado })
          });
          loadArtesanos();
        });
      });
    } catch (e) {
      console.error('Error cargando artesanos:', e);
    }
  }

  if (formNuevoArtesano) {
    formNuevoArtesano.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nomEl = document.getElementById('na-nombre');
      const waEl = document.getElementById('na-whatsapp');
      const nombre = nomEl ? nomEl.value.trim() : '';
      const whatsapp = waEl ? waEl.value.trim() : '';
      if (!nombre) return;
      try {
        const res = await apiFetch('/artesanos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre, whatsapp })
        });
        if (res.ok) {
          formNuevoArtesano.reset();
          loadArtesanos();
        }
      } catch {}
    });
  }

  const btnPushAdmin = document.getElementById('btn-push-admin');
  if (btnPushAdmin) {
    btnPushAdmin.addEventListener('click', async () => {
      if (!('serviceWorker' in navigator) || !('Notification' in window)) {
        await window.LpsModal.alert('Tu navegador no soporta notificaciones Web Push.', 'warning');
        return;
      }
      try {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') {
          await window.LpsModal.alert('Permiso de notificaciones no concedido.', 'warning');
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
          await apiFetch('/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rol: 'admin', subscription: sub.toJSON() })
          });
        }
        btnPushAdmin.textContent = 'Push Admin Activo';
        btnPushAdmin.classList.replace('bg-[#4A3C31]', 'bg-[#008f6b]');
      } catch {
        btnPushAdmin.textContent = 'Alertas activadas';
      }
    });
  }

  // ── Sistema WMS Shopify: Inventario, Conteo Físico, Kardex y Matrícula SKU / EAN-13 ──
  let inventarioCache = [];
  let kardexCache = [];

  const TIPO_MOV_LABELS = {
    matricula_inicial: 'Matrícula SKU/EAN',
    entrada_mercaderia: 'Entrada Mercadería',
    recepcion_artesano: 'Recepción Artesano',
    conteo_fisico: 'Conteo Físico',
    salida_venta: 'Salida por Venta',
    ajuste_merma: 'Ajuste / Merma'
  };

  async function solicitarCodigosSkuEan(linea, sublinea) {
    try {
      const res = await apiFetch('/inventario/generar-codigos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linea, sublinea })
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  // Botón generar SKU + EAN-13 dentro de la Ficha Técnica de Catálogo
  const btnNpAutoCodigos = document.getElementById('btn-np-autogenerar-codigos');
  if (btnNpAutoCodigos) {
    btnNpAutoCodigos.addEventListener('click', async () => {
      const lin = document.getElementById('np-linea')?.value || 'Vajilla Artesanal';
      const sub = document.getElementById('np-sublinea')?.value || 'Tazas & Mugs';
      const codes = await solicitarCodigosSkuEan(lin, sub);
      if (codes && codes.success) {
        const skuEl = document.getElementById('np-sku'); if (skuEl) skuEl.value = codes.sku;
        const eanEl = document.getElementById('np-ean'); if (eanEl) eanEl.value = codes.ean;
      }
    });
  }

  async function loadInventario() {
    try {
      const res = await apiFetch('/inventario/resumen');
      if (!res.ok) return;
      const data = await res.json();
      if (!data || !data.success) return;

      const k = data.kpis || {};
      inventarioCache = Array.isArray(data.productos) ? data.productos : [];
      kardexCache = Array.isArray(data.kardex) ? data.kardex : [];

      const elSkus = document.getElementById('inv-kpi-skus'); if (elSkus) elSkus.textContent = Number(k.total_skus || 0);
      const elUnid = document.getElementById('inv-kpi-unidades'); if (elUnid) elUnid.textContent = Number(k.unidades_en_stock || 0);
      const elValC = document.getElementById('inv-kpi-valor-costo'); if (elValC) elValC.textContent = `S/ ${Number(k.valor_costo_soles || 0).toFixed(2)}`;
      const elValR = document.getElementById('inv-kpi-valor-retail'); if (elValR) elValR.textContent = `S/ ${Number(k.valor_retail_soles || 0).toFixed(2)}`;
      const alertasCount = Number(k.alertas_bajo_stock || 0);
      const elAlert = document.getElementById('inv-kpi-alertas'); if (elAlert) elAlert.textContent = alertasCount;
      const badgeStockAlerta = document.getElementById('badge-stock-alerta');
      if (badgeStockAlerta) {
        badgeStockAlerta.textContent = alertasCount;
        badgeStockAlerta.classList.toggle('hidden', alertasCount <= 0);
      }

      renderInventarioTable();
      renderKardexTable();
    } catch (e) {
      console.error('Error cargando inventario WMS:', e);
    }
  }

  function inventarioFiltrado() {
    const q = (document.getElementById('filtro-inv-search')?.value || '').trim().toLowerCase();
    const lin = document.getElementById('filtro-inv-linea')?.value || '';
    const st = document.getElementById('filtro-inv-stock')?.value || '';

    return inventarioCache.filter(p => {
      if (lin && p.linea !== lin) return false;
      const stockNum = Number(p.stock_actual || 0);
      const stockMin = Number(p.stock_minimo || 1);
      if (st === 'con_stock' && stockNum <= 0) return false;
      if (st === 'sin_stock' && stockNum > 0) return false;
      if (st === 'bajo_stock' && stockNum > stockMin) return false;
      if (q) {
        const matchSku = (p.sku || '').toLowerCase().includes(q);
        const matchEan = (p.ean || '').toLowerCase().includes(q);
        const matchNom = (p.nombre || '').toLowerCase().includes(q);
        const matchCol = (p.coleccion || '').toLowerCase().includes(q);
        if (!matchSku && !matchEan && !matchNom && !matchCol) return false;
      }
      return true;
    });
  }

  function renderInventarioTable() {
    const tbody = document.getElementById('inventario-tbody');
    const empty = document.getElementById('inventario-empty');
    if (!tbody) return;

    const lista = inventarioFiltrado();
    if (empty) empty.classList.toggle('hidden', lista.length > 0);

    tbody.innerHTML = lista.map(p => {
      const foto = (Array.isArray(p.imagenes) && p.imagenes[0]) || '/imagenes/Artesanitas/logo_artesanitas.peru.jpg';
      const stockNum = Number(p.stock_actual || 0);
      const stockMin = Number(p.stock_minimo || 1);
      const precioFinal = (p.precio_oferta && Number(p.precio_oferta) > 0 && Number(p.precio_oferta) < Number(p.precio))
        ? Number(p.precio_oferta)
        : Number(p.precio || 0);
      const costoNum = Number(p.costo_artesano || 0);
      const ultConteo = p.ultimo_conteo_at
        ? new Date(p.ultimo_conteo_at).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
        : 'Sin conteo';
      const venderSinStock = p.vender_sin_stock === true || p.politica_sin_stock === 'preventa';
      const fechaEst = p.fecha_entrega_estimada ? String(p.fecha_entrega_estimada).slice(0, 10) : '';
      const cleanNombre = String(p.nombre || '')
        .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F\u200D]/gu, '')
        .replace(/\s+/g, ' ')
        .trim();

      return `
        <tr class="hover:bg-[#F9F6F0]/60 transition-colors">
          <td data-label="Producto" class="px-4 py-3">
            <div class="flex items-center gap-3">
              <img src="${escapeHtml(foto)}" alt="${escapeHtml(cleanNombre)}" onerror="this.onerror=null;this.src='/imagenes/Artesanitas/logo_artesanitas.peru.jpg';"
                class="w-11 h-11 rounded-xl object-cover border border-[#EBE5DE] shrink-0 bg-[#F9F6F0]">
              <div class="min-w-0">
                <button type="button" data-ficha-id="${p.id}" class="btn-inv-ver-ficha font-bold text-[#4A3C31] hover:text-[#B87352] hover:underline text-xs sm:text-sm text-left cursor-pointer block">${escapeHtml(cleanNombre)}</button>
                <div class="flex items-center gap-1.5 flex-wrap mt-0.5">
                  <span class="font-mono font-bold text-[10px] text-[#4A3C31] bg-[#F9F6F0] px-1.5 py-0.5 rounded border border-[#EBE5DE]">SKU: ${escapeHtml(p.sku || '----')}</span>
                  <span class="text-[10px] font-semibold text-[#B87352]">${escapeHtml(p.coleccion || 'Catálogo General')}</span>
                </div>
              </div>
            </div>
          </td>
          <td data-label="Stock" class="px-3 py-3 text-center">
            <span class="inline-flex items-center justify-center min-w-[42px] px-2.5 py-1 rounded-xl text-sm font-extrabold ${stockNum > stockMin ? 'bg-green-100 text-green-800 border border-green-200' : (stockNum > 0 ? 'bg-amber-100 text-amber-900 border border-amber-200' : 'bg-[#F1EDE7] text-[#8C7A6B]')}">
              ${stockNum}
            </span>
            <span class="block text-[10px] text-[#8C7A6B] mt-1 whitespace-nowrap">${ultConteo}</span>
          </td>
          <td data-label="Costo" class="px-3 py-3 text-right text-xs font-bold text-[#742284] whitespace-nowrap">
            S/ ${costoNum.toFixed(2)}
          </td>
          <td data-label="PVP" class="px-3 py-3 text-right text-xs font-extrabold text-[#4A3C31] whitespace-nowrap">
            S/ ${precioFinal.toFixed(2)}
          </td>
          <td data-label="Conteo / Ajuste" class="px-4 py-3">
            <div class="flex items-center gap-1.5">
              <div class="inline-flex items-center bg-[#F9F6F0] rounded-xl border border-[#D5C9BD] p-0.5">
                <button type="button" data-quick-out="${p.id}"
                  class="btn-inv-quick-out w-7 h-7 rounded-lg bg-white hover:bg-red-50 text-[#4A3C31] hover:text-red-700 font-extrabold text-sm flex items-center justify-center transition-colors cursor-pointer"
                  title="Reducir 1 unidad (-)">-</button>
                <input type="number" min="0" step="1" value="${stockNum}" data-conteo-prod-id="${p.id}" data-stock-orig="${stockNum}"
                  class="input-inv-conteo-fisico w-14 px-1 py-1 text-xs font-extrabold text-center bg-transparent focus:outline-none">
                <button type="button" data-quick-in="${p.id}"
                  class="btn-inv-quick-in w-7 h-7 rounded-lg bg-white hover:bg-green-50 text-[#4A3C31] hover:text-green-700 font-extrabold text-sm flex items-center justify-center transition-colors cursor-pointer"
                  title="Aumentar 1 unidad (+)">+</button>
              </div>
              <button type="button" data-apply-conteo="${p.id}"
                class="btn-inv-apply-conteo bg-[#007A78] hover:bg-[#00635D] text-white text-[11px] font-bold px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer"
                title="Guardar conteo físico exacto">
                Guardar
              </button>
            </div>
          </td>
          <td data-label="Vender sin Stock" class="px-4 py-3">
            <div class="space-y-1.5">
              <label class="inline-flex items-center gap-1.5 cursor-pointer select-none">
                <input type="checkbox" data-vss-id="${p.id}" ${venderSinStock ? 'checked' : ''}
                  class="chk-inv-vender-sin-stock w-4 h-4 accent-[#007A78] rounded cursor-pointer">
                <span class="text-xs font-semibold text-[#4A3C31]">Vender sin stock</span>
              </label>
              <div class="${venderSinStock ? 'flex' : 'hidden'} items-center gap-1" data-vss-fecha-wrap="${p.id}">
                <input type="date" data-vss-fecha-id="${p.id}" value="${escapeHtml(fechaEst)}"
                  title="Fecha de entrega estimada al cliente"
                  class="input-inv-fecha-entrega px-2 py-1 text-[11px] font-semibold rounded-lg border border-[#B87352]/50 bg-[#F9F6F0] text-[#4A3C31] focus:outline-none focus:border-[#B87352]">
              </div>
            </div>
          </td>
          <td data-label="Ficha 360°" class="px-4 py-3 text-right whitespace-nowrap">
            <button type="button" data-ficha-id="${p.id}"
              class="btn-inv-ver-ficha bg-[#4A3C31] hover:bg-[#B87352] text-white text-[11px] font-bold px-3 py-1.5 rounded-xl transition-colors cursor-pointer inline-flex items-center gap-1">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3 h-3"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>
              Ficha 360°
            </button>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.chk-inv-vender-sin-stock').forEach(chk => {
      chk.addEventListener('change', async () => {
        const prodId = chk.dataset.vssId;
        const wrap = tbody.querySelector(`[data-vss-fecha-wrap="${prodId}"]`);
        const dateInp = tbody.querySelector(`.input-inv-fecha-entrega[data-vss-fecha-id="${prodId}"]`);
        const checked = chk.checked;
        if (wrap) {
          wrap.classList.toggle('hidden', !checked);
          wrap.classList.toggle('flex', checked);
        }
        if (checked && dateInp && !dateInp.value) {
          dateInp.focus();
          return;
        }
        await apiFetch(`/productos/${prodId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vender_sin_stock: checked,
            fecha_entrega_estimada: checked && dateInp ? dateInp.value : null
          })
        });
        loadInventario();
        loadProductos();
      });
    });

    tbody.querySelectorAll('.input-inv-fecha-entrega').forEach(inp => {
      inp.addEventListener('change', async () => {
        const prodId = inp.dataset.vssFechaId;
        const fechaVal = inp.value;
        if (!fechaVal) return;
        await apiFetch(`/productos/${prodId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vender_sin_stock: true,
            fecha_entrega_estimada: fechaVal
          })
        });
        loadInventario();
        loadProductos();
      });
    });

    tbody.querySelectorAll('.btn-inv-apply-conteo').forEach(btn => {
      btn.addEventListener('click', async () => {
        const prodId = btn.dataset.applyConteo;
        const input = tbody.querySelector(`.input-inv-conteo-fisico[data-conteo-prod-id="${prodId}"]`);
        const cant = input ? parseInt(input.value, 10) : 0;
        btn.textContent = '...';
        await apiFetch('/inventario/movimiento', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            producto_id: prodId,
            tipo_movimiento: 'conteo_fisico',
            cantidad: cant,
            motivo_referencia: 'Conteo físico directo en panel'
          })
        });
        loadInventario();
        loadProductos();
      });
    });

    tbody.querySelectorAll('.btn-inv-quick-out').forEach(btn => {
      btn.addEventListener('click', async () => {
        const prodId = btn.dataset.quickOut;
        btn.textContent = '...';
        await apiFetch('/inventario/movimiento', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            producto_id: prodId,
            tipo_movimiento: 'ajuste_merma',
            cantidad: 1,
            motivo_referencia: 'Ajuste rápido / merma (-1)'
          })
        });
        loadInventario();
        loadProductos();
      });
    });

    tbody.querySelectorAll('.btn-inv-quick-in').forEach(btn => {
      btn.addEventListener('click', async () => {
        const prodId = btn.dataset.quickIn;
        btn.textContent = '...';
        await apiFetch('/inventario/movimiento', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            producto_id: prodId,
            tipo_movimiento: 'entrada_mercaderia',
            cantidad: 1,
            motivo_referencia: 'Ingreso rápido de mercadería (+1)'
          })
        });
        loadInventario();
        loadProductos();
      });
    });

    tbody.querySelectorAll('.btn-inv-ver-ficha').forEach(btn => {
      btn.addEventListener('click', () => {
        abrirModalFichaProducto360(btn.dataset.fichaId);
      });
    });

    tbody.querySelectorAll('.btn-inv-ver-etiqueta').forEach(btn => {
      btn.addEventListener('click', () => {
        const prod = inventarioCache.find(x => String(x.id) === String(btn.dataset.etiquetaId));
        if (prod) abrirModalEtiquetaEan(prod);
      });
    });
  }

  function renderKardexTable() {
    const tbody = document.getElementById('kardex-tbody');
    const empty = document.getElementById('kardex-empty');
    if (!tbody) return;
    if (empty) empty.classList.toggle('hidden', kardexCache.length > 0);

    tbody.innerHTML = kardexCache.map(m => {
      const fecha = new Date(m.created_at).toLocaleString('es-PE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      const deltaNum = Number(m.delta || 0);
      const deltaStr = deltaNum > 0 ? `+${deltaNum}` : String(deltaNum);
      const deltaCls = deltaNum > 0 ? 'text-green-700 bg-green-50' : (deltaNum < 0 ? 'text-red-600 bg-red-50' : 'text-[#8C7A6B] bg-[#F1EDE7]');
      return `
        <tr>
          <td class="py-2.5 pr-3 text-[#8C7A6B] whitespace-nowrap">${fecha}</td>
          <td class="py-2.5 px-2">
            <span class="font-mono font-bold text-[#4A3C31] block">${escapeHtml(m.producto_sku || '—')}</span>
            <span class="text-[#8C7A6B]">${escapeHtml(m.producto_nombre || '')}</span>
          </td>
          <td class="py-2.5 px-2 font-semibold text-[#4A3C31]">
            ${escapeHtml(TIPO_MOV_LABELS[m.tipo_movimiento] || m.tipo_movimiento)}
          </td>
          <td class="py-2.5 px-2 text-center font-mono">
            <span>${Number(m.cantidad_anterior)}</span>
            <span class="mx-1 px-1.5 py-0.5 rounded font-bold ${deltaCls}">${deltaStr}</span>
            <span>→ <strong>${Number(m.cantidad_nueva)}</strong></span>
          </td>
          <td class="py-2.5 pl-2 text-[#8C7A6B]">${escapeHtml(m.motivo_referencia || '—')}</td>
        </tr>
      `;
    }).join('');
  }

  // Filtros en vivo de inventario
  ['filtro-inv-search', 'filtro-inv-linea', 'filtro-inv-stock'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', renderInventarioTable);
      el.addEventListener('change', renderInventarioTable);
    }
  });

  // Botón Auto-Matricular Todo el Catálogo con SKU + EAN-13
  const btnInvMatricularMasivo = document.getElementById('btn-inv-matricular-masivo');
  if (btnInvMatricularMasivo) {
    btnInvMatricularMasivo.addEventListener('click', async () => {
      const orig = btnInvMatricularMasivo.textContent;
      btnInvMatricularMasivo.disabled = true;
      btnInvMatricularMasivo.textContent = 'Matriculando catálogo con SKU + EAN-13...';
      try {
        const res = await apiFetch('/inventario/matricular-masivo', { method: 'POST' });
        const data = await res.json();
        if (res.ok && data.success) {
          await loadInventario();
          await loadProductos();
          await window.LpsModal.alert(data.message || 'Catálogo matriculado correctamente.', 'success');
        }
      } catch {
        await window.LpsModal.alert('Error de conexión al matricular catálogo.', 'error');
      } finally {
        btnInvMatricularMasivo.disabled = false;
        btnInvMatricularMasivo.textContent = orig;
      }
    });
  }

  // Guardar Hoja de Conteo Físico Masivo
  const btnInvConteoMasivo = document.getElementById('btn-inv-guardar-conteo-masivo');
  if (btnInvConteoMasivo) {
    btnInvConteoMasivo.addEventListener('click', async () => {
      const inputs = [...document.querySelectorAll('.input-inv-conteo-fisico')];
      const conteos = inputs
        .map(inp => ({
          producto_id: parseInt(inp.dataset.conteoProdId, 10),
          stock_fisico: parseInt(inp.value, 10),
          stock_orig: parseInt(inp.dataset.stockOrig, 10)
        }))
        .filter(c => !Number.isNaN(c.stock_fisico) && c.stock_fisico !== c.stock_orig);

      if (conteos.length === 0) {
        await window.LpsModal.alert('Modifica primero las cantidades físicas contadas en una o más filas para guardar diferencias.', 'warning');
        return;
      }

      const motivo = document.getElementById('inv-motivo-masivo')?.value.trim() || 'Conteo físico general de almacén';
      btnInvConteoMasivo.disabled = true;
      const orig = btnInvConteoMasivo.textContent;
      btnInvConteoMasivo.textContent = 'Guardando conteos...';
      try {
        const res = await apiFetch('/inventario/conteo-masivo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conteos, motivo })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          await loadInventario();
          await loadProductos();
        }
      } finally {
        btnInvConteoMasivo.disabled = false;
        btnInvConteoMasivo.textContent = orig;
      }
    });
  }

  // Exportar Excel de Inventario y Kardex
  const btnInvExportXlsx = document.getElementById('btn-inv-export-xlsx');
  if (btnInvExportXlsx) {
    btnInvExportXlsx.addEventListener('click', () => {
      descargarExport('/inventario/export.xlsx', 'artesanitas-inventario-sku-ean-kardex.xlsx');
    });
  }

  // Formulario de Matrícula Rápida de Mercadería Nueva
  const btnAbrirMatricula = document.getElementById('btn-inv-abrir-matricula');
  const formMatricula = document.getElementById('form-matricula-mercaderia');
  const btnCancelarMatricula = document.getElementById('btn-inv-cancelar-matricula');
  const btnRegenerarCodigos = document.getElementById('btn-inv-regenerar-codigos');
  const matLinea = document.getElementById('mat-linea');
  const matSublinea = document.getElementById('mat-sublinea');

  async function autollenarCodigosMatricula() {
    const codes = await solicitarCodigosSkuEan(
      matLinea ? matLinea.value : 'Vajilla Artesanal',
      matSublinea ? matSublinea.value : 'Tazas & Mugs'
    );
    if (codes && codes.success) {
      const sEl = document.getElementById('mat-sku'); if (sEl) sEl.value = codes.sku;
      const eEl = document.getElementById('mat-ean'); if (eEl) eEl.value = codes.ean;
    }
  }

  if (btnAbrirMatricula && formMatricula) {
    btnAbrirMatricula.addEventListener('click', async () => {
      formMatricula.classList.remove('hidden');
      await autollenarCodigosMatricula();
      document.getElementById('mat-nombre')?.focus();
    });
  }
  if (btnCancelarMatricula && formMatricula) {
    btnCancelarMatricula.addEventListener('click', () => {
      formMatricula.classList.add('hidden');
      formMatricula.reset();
    });
  }
  if (btnRegenerarCodigos) btnRegenerarCodigos.addEventListener('click', autollenarCodigosMatricula);
  if (matLinea) matLinea.addEventListener('change', autollenarCodigosMatricula);
  if (matSublinea) matSublinea.addEventListener('change', autollenarCodigosMatricula);

  if (formMatricula) {
    formMatricula.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btnSubmit = document.getElementById('btn-inv-guardar-matricula');
      const origTxt = btnSubmit ? btnSubmit.textContent : '';
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.textContent = 'Matriculando...';
      }
      try {
        const fd = new FormData();
        fd.append('nombre', document.getElementById('mat-nombre')?.value.trim() || '');
        fd.append('linea', matLinea?.value || 'Vajilla Artesanal');
        fd.append('sublinea', matSublinea?.value || 'Tazas & Mugs');
        fd.append('sku', document.getElementById('mat-sku')?.value.trim() || '');
        fd.append('ean', document.getElementById('mat-ean')?.value.trim() || '');
        fd.append('stock_actual', document.getElementById('mat-stock')?.value || '0');
        fd.append('costo_artesano', document.getElementById('mat-costo')?.value || '');
        fd.append('precio', document.getElementById('mat-precio')?.value || '0');
        fd.append('coleccion', document.getElementById('mat-coleccion')?.value.trim() || 'Catálogo General');
        const imgFile = document.getElementById('mat-imagen')?.files?.[0];
        if (imgFile) {
          const optFile = await comprimirImagenWeb(imgFile);
          fd.append('imagenes', optFile);
        } else {
          fd.append('imagen_url', '/imagenes/Artesanitas/logo_artesanitas.peru.jpg');
        }

        const res = await apiFetch('/productos', { method: 'POST', body: fd });
        let data = {};
        try { data = await res.json(); } catch { data = {}; }
        if (res.ok && data.success) {
          formMatricula.reset();
          formMatricula.classList.add('hidden');
          await loadInventario();
          await loadProductos();
          window.LpsModal.toast('Producto matriculado y registrado en inventario.', 'success');
        } else {
          await window.LpsModal.alert({
            title: 'No se pudo matricular el producto',
            message: data.message || 'Ocurrió un error al guardar la mercadería. Verifica los campos e intenta nuevamente.',
            type: 'error'
          });
        }
      } catch {
        await window.LpsModal.alert({
          title: 'Error de conexión',
          message: 'No pudimos comunicarnos con el servidor para matricular el producto.',
          type: 'error'
        });
      } finally {
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.textContent = origTxt;
        }
      }
    });
  }

  // Generador visual de Código de Barras EAN-13 en SVG e impresión de etiqueta
  const modalEtiquetaEan = document.getElementById('modal-etiqueta-ean');
  const btnCerrarEtiqueta = document.getElementById('btn-cerrar-etiqueta-ean');
  const btnImprimirEtiqueta = document.getElementById('btn-imprimir-etiqueta-ean');

  function generarBarrasSvg(codeStr) {
    const clean = String(codeStr || '7752601000018').replace(/[^0-9A-Z]/gi, '') || '7752601000018';
    const patterns = ['1010011', '1100101', '1001101', '1101001', '1011001', '1100110', '1001110', '1010110', '1101010', '1011010'];
    let bits = '101';
    for (let i = 0; i < clean.length; i++) {
      const idx = clean.charCodeAt(i) % 10;
      bits += patterns[idx];
    }
    bits += '101';
    const barW = 2;
    const width = bits.length * barW;
    let rects = '';
    for (let i = 0; i < bits.length; i++) {
      if (bits[i] === '1') {
        rects += `<rect x="${i * barW}" y="0" width="${barW}" height="48" fill="#4A3C31"/>`;
      }
    }
    return `<svg width="${width}" height="50" viewBox="0 0 ${width} 50" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`;
  }

  function abrirModalEtiquetaEan(prod) {
    if (!modalEtiquetaEan) return;
    const nom = document.getElementById('etiqueta-prod-nombre'); if (nom) nom.textContent = prod.nombre;
    const sku = document.getElementById('etiqueta-prod-sku'); if (sku) sku.textContent = `SKU: ${prod.sku || '—'}`;
    const ean = document.getElementById('etiqueta-prod-ean'); if (ean) ean.textContent = prod.ean || '7752601000018';
    const pr = document.getElementById('etiqueta-prod-precio'); if (pr) pr.textContent = `S/ ${Number(prod.precio_oferta || prod.precio || 0).toFixed(2)}`;
    const svgBox = document.getElementById('etiqueta-barcode-svg');
    if (svgBox) svgBox.innerHTML = generarBarrasSvg(prod.ean || prod.sku);
    modalEtiquetaEan.classList.remove('hidden');
  }

  if (btnCerrarEtiqueta && modalEtiquetaEan) {
    btnCerrarEtiqueta.addEventListener('click', () => modalEtiquetaEan.classList.add('hidden'));
  }
  if (btnImprimirEtiqueta) {
    btnImprimirEtiqueta.addEventListener('click', () => {
      const area = document.getElementById('etiqueta-printable-area');
      if (!area) return;
      const win = window.open('', '_blank', 'width=420,height=320');
      if (!win) return;
      win.document.write(`<html><head><title>Etiqueta SKU/EAN-13</title><style>body{font-family:sans-serif;text-align:center;padding:16px;}</style></head><body>${area.innerHTML}<script>window.onload=function(){window.print();}</script></body></html>`);
      win.document.close();
    });
  }

  // ============================================================================
  // Ficha Técnica Maestra 360° de Producto + Kardex Individual (Shopify Admin)
  // ============================================================================
  function calcularMargenFichaEnVivo() {
    var costo = parseFloat(document.getElementById('ficha-costo')?.value) || 0;
    var precio = parseFloat(document.getElementById('ficha-precio')?.value) || 0;
    var oferta = parseFloat(document.getElementById('ficha-oferta')?.value) || 0;
    var pvp = (oferta > 0 && oferta < precio) ? oferta : precio;
    var ganancia = pvp - costo;
    var pct = pvp > 0 ? Math.round((ganancia / pvp) * 100) : 0;
    var pill = document.getElementById('ficha-margen-pill');
    if (pill) {
      pill.textContent = 'Ganancia: S/ ' + ganancia.toFixed(2) + ' (' + pct + '% margen)';
      pill.className = 'text-xs font-extrabold px-3 py-1 rounded-full border ' +
        (pct >= 40 ? 'bg-green-100 text-green-800 border-green-200' : (pct >= 20 ? 'bg-amber-100 text-amber-900 border-amber-200' : 'bg-red-100 text-red-800 border-red-200'));
    }
  }

  var fichaImagenesExistentes = [];
  var fichaNuevosArchivos = [];

  function renderFichaGaleria() {
    var grid = document.getElementById('ficha-galeria-grid');
    var headerImg = document.getElementById('ficha-img-preview');
    var items = [];
    fichaImagenesExistentes.forEach(function (url, idx) {
      items.push({ kind: 'url', src: url, idx: idx });
    });
    fichaNuevosArchivos.forEach(function (file, idx) {
      items.push({ kind: 'file', src: URL.createObjectURL(file), idx: idx });
    });

    if (headerImg) {
      headerImg.src = items[0] ? items[0].src : '/imagenes/Artesanitas/logo_artesanitas.peru.jpg';
    }
    if (!grid) return;
    if (items.length === 0) {
      grid.innerHTML = '<span class="text-xs text-[#8C7A6B]">Sin imágenes cargadas. Haz clic en "Cambiar / Agregar Imágenes".</span>';
      return;
    }

    grid.innerHTML = items.map(function (item, pos) {
      var badge = pos === 0 ? '<span class="absolute bottom-1 left-1 bg-[#4A3C31]/85 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">Principal</span>' : '';
      return '<div class="relative w-16 h-16 rounded-xl overflow-hidden border border-[#D5C9BD] bg-white shrink-0 group">' +
        '<img src="' + escapeHtml(item.src) + '" alt="Foto ' + (pos + 1) + '" class="w-full h-full object-cover">' +
        badge +
        '<button type="button" data-gal-kind="' + item.kind + '" data-gal-idx="' + item.idx + '" title="Quitar imagen" class="btn-ficha-gal-remove absolute top-1 right-1 w-5 h-5 rounded-full bg-red-600/90 text-white text-[11px] font-bold flex items-center justify-center opacity-90 hover:bg-red-700 cursor-pointer">&times;</button>' +
        '</div>';
    }).join('');

    grid.querySelectorAll('.btn-ficha-gal-remove').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var kind = btn.dataset.galKind;
        var idx = parseInt(btn.dataset.galIdx, 10);
        if (kind === 'url') fichaImagenesExistentes.splice(idx, 1);
        else if (kind === 'file') fichaNuevosArchivos.splice(idx, 1);
        renderFichaGaleria();
      });
    });
  }

  function poblarCamposFicha360(p, kardexList, resumen) {
    document.getElementById('ficha-prod-id').value = p.id;
    fichaImagenesExistentes = Array.isArray(p.imagenes)
      ? p.imagenes.filter(function (u) { return typeof u === 'string' && u.trim(); })
      : [];
    fichaNuevosArchivos = [];
    var fotoInp = document.getElementById('ficha-foto-input');
    if (fotoInp) fotoInp.value = '';
    renderFichaGaleria();

    document.getElementById('ficha-badge-sku').textContent = 'SKU: ' + (p.sku || '----');
    document.getElementById('ficha-badge-ean').textContent = 'EAN: ' + (p.ean || '-------------');
    document.getElementById('ficha-titulo-header').textContent = p.nombre || 'Producto';
    var linkPublico = document.getElementById('ficha-link-publico');
    if (linkPublico) {
      linkPublico.href = '/producto/' + encodeURIComponent(p.slug || '');
      linkPublico.textContent = '/producto/' + (p.slug || '');
    } else {
      var slugHeader = document.getElementById('ficha-slug-header');
      if (slugHeader) slugHeader.textContent = '/producto/' + (p.slug || '');
    }

    document.getElementById('ficha-nombre').value = p.nombre || '';
    document.getElementById('ficha-sku').value = p.sku || '';
    document.getElementById('ficha-ean').value = p.ean || '';
    document.getElementById('ficha-linea').value = p.linea || 'Vajilla Artesanal';
    document.getElementById('ficha-sublinea').value = p.sublinea || 'Tazas & Mugs';
    document.getElementById('ficha-coleccion').value = p.coleccion || 'Catálogo General';
    document.getElementById('ficha-ubicacion').value = p.ubicacion_almacen || 'Almacén Principal Trujillo';

    document.getElementById('ficha-dimensiones').value = p.tamano_dimensiones || '';
    document.getElementById('ficha-color').value = p.color || '';
    document.getElementById('ficha-caracteristicas').value = p.caracteristicas || '';
    document.getElementById('ficha-descripcion').value = p.descripcion || '';

    document.getElementById('ficha-costo').value = p.costo_artesano !== null && p.costo_artesano !== undefined ? Number(p.costo_artesano).toFixed(2) : '';
    document.getElementById('ficha-precio').value = Number(p.precio || 0).toFixed(2);
    document.getElementById('ficha-oferta').value = (p.precio_oferta && Number(p.precio_oferta) > 0) ? Number(p.precio_oferta).toFixed(2) : '';
    var stockMinEl = document.getElementById('ficha-stock-minimo');
    if (stockMinEl) stockMinEl.value = p.stock_minimo !== undefined && p.stock_minimo !== null ? Number(p.stock_minimo) : 1;
    var vssChk = document.getElementById('ficha-vender-sin-stock');
    var vssWrap = document.getElementById('ficha-fecha-entrega-wrap');
    var vssFecha = document.getElementById('ficha-fecha-entrega');
    var permiteVss = p.vender_sin_stock === true || p.politica_sin_stock === 'preventa';
    if (vssChk) vssChk.checked = permiteVss;
    if (vssFecha) vssFecha.value = p.fecha_entrega_estimada ? String(p.fecha_entrega_estimada).slice(0, 10) : '';
    if (vssWrap) {
      vssWrap.classList.toggle('hidden', !permiteVss);
      vssWrap.classList.toggle('flex', permiteVss);
    }
    document.getElementById('ficha-activo').value = p.activo !== false ? 'true' : 'false';

    calcularMargenFichaEnVivo();

    document.getElementById('ficha-kardex-stock').textContent = Number(p.stock_actual || 0) + ' und.';
    document.getElementById('ficha-kardex-entradas').textContent = (resumen && resumen.total_entradas !== undefined ? resumen.total_entradas : 0) + ' und.';
    document.getElementById('ficha-kardex-salidas').textContent = (resumen && resumen.total_salidas_venta !== undefined ? resumen.total_salidas_venta : 0) + ' und.';

    var tbody = document.getElementById('ficha-kardex-tbody');
    if (!tbody) return;
    if (!kardexList || kardexList.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-[#8C7A6B]">Sin movimientos históricos registrados para este SKU.</td></tr>';
      return;
    }
    var labels = {
      matricula_inicial: 'Matrícula SKU/EAN',
      entrada_mercaderia: 'Entrada Mercadería',
      recepcion_artesano: 'Recepción Artesano',
      conteo_fisico: 'Conteo Físico',
      salida_venta: 'Salida por Venta',
      ajuste_merma: 'Ajuste / Merma',
      ajuste_ficha: 'Ajuste Ficha 360°'
    };
    tbody.innerHTML = kardexList.map(function (m) {
      var f = new Date(m.created_at).toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
      var d = Number(m.delta || 0);
      var dStr = d > 0 ? '+' + d : String(d);
      var cls = d > 0 ? 'text-green-700 bg-green-50' : (d < 0 ? 'text-red-700 bg-red-50' : 'text-[#8C7A6B] bg-[#F1EDE7]');
      return '<tr>' +
        '<td class="p-2.5 text-[#8C7A6B] whitespace-nowrap">' + f + '</td>' +
        '<td class="p-2.5 font-semibold text-[#4A3C31]">' + escapeHtml(labels[m.tipo_movimiento] || m.tipo_movimiento) + '</td>' +
        '<td class="p-2.5 text-center font-mono">' + m.cantidad_anterior + ' <span class="px-1.5 py-0.5 rounded font-bold ' + cls + '">' + dStr + '</span> → <strong>' + m.cantidad_nueva + '</strong></td>' +
        '<td class="p-2.5 text-[#8C7A6B]">' + escapeHtml(m.ubicacion || 'Almacén Trujillo') + '</td>' +
        '<td class="p-2.5 text-[#4A3C31]">' + escapeHtml(m.motivo_referencia || '—') + '</td>' +
        '</tr>';
    }).join('');
  }

  async function abrirModalFichaProducto360(prodId) {
    var modal = document.getElementById('modal-ficha-producto');
    if (!modal || !prodId) return;

    var prodLocal = (inventarioCache || []).find(function (x) { return String(x.id) === String(prodId); });
    if (prodLocal) {
      poblarCamposFicha360(prodLocal, []);
    }
    modal.classList.remove('hidden');

    try {
      var res = await apiFetch('/inventario/producto/' + encodeURIComponent(prodId) + '/ficha');
      var data = await res.json();
      if (res.ok && data.success && data.producto) {
        poblarCamposFicha360(data.producto, data.kardex || [], data.resumen || {});
      }
    } catch (e) {
      console.warn('Error cargando ficha 360:', e);
    }
  }

  function initFichaProducto360() {
    var modal = document.getElementById('modal-ficha-producto');
    var btnCerrar = document.getElementById('btn-cerrar-ficha-producto');
    var form = document.getElementById('form-ficha-producto');
    var btnRegenSku = document.getElementById('btn-ficha-regenerar-sku');
    var btnEtiqueta = document.getElementById('btn-ficha-abrir-etiqueta');
    var btnAplicarMov = document.getElementById('btn-ficha-aplicar-mov');

    if (btnCerrar && modal) {
      btnCerrar.addEventListener('click', function () { modal.classList.add('hidden'); });
    }

    ['ficha-costo', 'ficha-precio', 'ficha-oferta'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('input', calcularMargenFichaEnVivo);
    });

    var fotoInpInit = document.getElementById('ficha-foto-input');
    if (fotoInpInit) {
      fotoInpInit.addEventListener('change', function () {
        var picked = Array.from(fotoInpInit.files || []);
        if (picked.length === 0) return;
        fichaImagenesExistentes = fichaImagenesExistentes.filter(function (u) { return !u.includes('logo_artesanitas.peru.jpg'); });
        var espacio = Math.max(0, 6 - (fichaImagenesExistentes.length + fichaNuevosArchivos.length));
        if (espacio === 0) {
          window.LpsModal.alert('Máximo 6 imágenes por producto. Elimina alguna para agregar otra.', 'warning');
          fotoInpInit.value = '';
          return;
        }
        fichaNuevosArchivos = fichaNuevosArchivos.concat(picked.slice(0, espacio));
        fotoInpInit.value = '';
        renderFichaGaleria();
      });
    }

    var btnIaDesc = document.getElementById('btn-ficha-ia-descripcion');
    if (btnIaDesc) {
      btnIaDesc.addEventListener('click', async function () {
        var prodId = document.getElementById('ficha-prod-id')?.value || '';
        if (fichaNuevosArchivos.length === 0 && fichaImagenesExistentes.filter(function (u) { return !u.includes('logo_artesanitas.peru.jpg'); }).length === 0) {
          await window.LpsModal.alert('Primero agrega al menos una foto del producto para que la IA pueda analizarla.', 'warning');
          return;
        }
        var origHtml = btnIaDesc.innerHTML;
        btnIaDesc.disabled = true;
        btnIaDesc.textContent = 'Analizando imagen con IA...';
        try {
          var fd = new FormData();
          fd.append('producto_id', prodId);
          fd.append('nombre', document.getElementById('ficha-nombre')?.value.trim() || '');
          fd.append('linea', document.getElementById('ficha-linea')?.value || '');
          fd.append('sublinea', document.getElementById('ficha-sublinea')?.value.trim() || '');
          fd.append('coleccion', document.getElementById('ficha-coleccion')?.value.trim() || '');
          if (fichaNuevosArchivos[0]) {
            var optIaFile = await comprimirImagenWeb(fichaNuevosArchivos[0]);
            fd.append('imagenes', optIaFile);
          }
          var res = await apiFetch('/productos/ia-descripcion', { method: 'POST', body: fd });
          var data = await res.json();
          if (res.ok && data.success) {
            var descEl = document.getElementById('ficha-descripcion');
            var colEl = document.getElementById('ficha-color');
            var carEl = document.getElementById('ficha-caracteristicas');
            if (descEl && data.descripcion) descEl.value = data.descripcion;
            if (colEl && !colEl.value.trim() && data.color) colEl.value = data.color;
            if (carEl && !carEl.value.trim() && data.caracteristicas) carEl.value = data.caracteristicas;
            window.LpsModal.toast('Descripción generada con IA. Recuerda hacer clic en Guardar Ficha.', 'success');
          } else {
            await window.LpsModal.alert(data.message || 'No se pudo generar la descripción con IA.', 'error');
          }
        } catch {
          await window.LpsModal.alert('Error de conexión al consultar la IA.', 'error');
        } finally {
          btnIaDesc.disabled = false;
          btnIaDesc.innerHTML = origHtml;
        }
      });
    }

    var vssChkInit = document.getElementById('ficha-vender-sin-stock');
    var vssWrapInit = document.getElementById('ficha-fecha-entrega-wrap');
    var vssFechaInit = document.getElementById('ficha-fecha-entrega');
    if (vssChkInit && vssWrapInit) {
      vssChkInit.addEventListener('change', function () {
        var on = vssChkInit.checked;
        vssWrapInit.classList.toggle('hidden', !on);
        vssWrapInit.classList.toggle('flex', on);
        if (on && vssFechaInit && !vssFechaInit.value) vssFechaInit.focus();
      });
    }

    if (btnRegenSku) {
      btnRegenSku.addEventListener('click', async function () {
        var linea = document.getElementById('ficha-linea')?.value || 'Vajilla Artesanal';
        var sublinea = document.getElementById('ficha-sublinea')?.value || 'Tazas & Mugs';
        var res = await apiFetch('/inventario/generar-codigos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ linea: linea, sublinea: sublinea })
        });
        var data = await res.json();
        if (data && data.success) {
          document.getElementById('ficha-sku').value = data.sku;
          if (!document.getElementById('ficha-ean').value) {
            document.getElementById('ficha-ean').value = data.ean;
          }
          document.getElementById('ficha-badge-sku').textContent = 'SKU: ' + data.sku;
        }
      });
    }

    if (btnEtiqueta) {
      btnEtiqueta.addEventListener('click', function () {
        var prodId = document.getElementById('ficha-prod-id')?.value;
        var prod = (inventarioCache || []).find(function (x) { return String(x.id) === String(prodId); });
        if (prod) abrirModalEtiquetaEan(prod);
      });
    }

    if (btnAplicarMov) {
      btnAplicarMov.addEventListener('click', async function () {
        var prodId = document.getElementById('ficha-prod-id')?.value;
        var tipo = document.getElementById('ficha-mov-tipo')?.value || 'entrada_mercaderia';
        var cant = parseInt(document.getElementById('ficha-mov-cant')?.value || '0', 10);
        var motivo = (document.getElementById('ficha-mov-motivo')?.value || '').trim();
        if (!prodId || Number.isNaN(cant) || cant < 0) {
          await window.LpsModal.alert('Ingresa una cantidad válida para el movimiento de almacén.', 'warning');
          return;
        }
        var origTxt = btnAplicarMov.textContent;
        btnAplicarMov.disabled = true;
        btnAplicarMov.textContent = '...';
        try {
          var res = await apiFetch('/inventario/movimiento', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              producto_id: prodId,
              tipo_movimiento: tipo,
              cantidad: cant,
              motivo_referencia: motivo || ('Movimiento rápido desde Ficha 360° (' + tipo + ')')
            })
          });
          var d = await res.json();
          if (res.ok && d.success) {
            var movMot = document.getElementById('ficha-mov-motivo');
            if (movMot) movMot.value = '';
            await loadInventario();
            await loadProductos();
            await abrirModalFichaProducto360(prodId);
          } else {
            await window.LpsModal.alert(d.message || 'No se pudo registrar el movimiento.', 'error');
          }
        } finally {
          btnAplicarMov.disabled = false;
          btnAplicarMov.textContent = origTxt;
        }
      });
    }

    if (form) {
      form.addEventListener('submit', async function (e) {
        e.preventDefault();
        var prodId = document.getElementById('ficha-prod-id')?.value;
        if (!prodId) return;
        var btnSave = document.getElementById('btn-ficha-guardar');
        var msgEl = document.getElementById('ficha-save-msg');
        var orig = btnSave.textContent;
        btnSave.disabled = true;
        btnSave.textContent = 'Guardando...';

        try {
          var fd = new FormData();
          fd.append('nombre', document.getElementById('ficha-nombre').value.trim());
          fd.append('sku', document.getElementById('ficha-sku').value.trim());
          fd.append('ean', document.getElementById('ficha-ean').value.trim());
          fd.append('linea', document.getElementById('ficha-linea').value);
          fd.append('sublinea', document.getElementById('ficha-sublinea').value.trim());
          fd.append('coleccion', document.getElementById('ficha-coleccion').value.trim());
          fd.append('ubicacion_almacen', document.getElementById('ficha-ubicacion').value.trim());
          fd.append('tamano_dimensiones', document.getElementById('ficha-dimensiones').value.trim());
          fd.append('color', document.getElementById('ficha-color').value.trim());
          fd.append('caracteristicas', document.getElementById('ficha-caracteristicas').value.trim());
          fd.append('descripcion', document.getElementById('ficha-descripcion').value.trim());
          fd.append('costo_artesano', document.getElementById('ficha-costo').value);
          fd.append('precio', document.getElementById('ficha-precio').value);
          fd.append('precio_oferta', document.getElementById('ficha-oferta').value);
          var stockMinInp = document.getElementById('ficha-stock-minimo');
          if (stockMinInp) fd.append('stock_minimo', stockMinInp.value || '1');
          var vssChkVal = Boolean(document.getElementById('ficha-vender-sin-stock')?.checked);
          var vssFechaVal = (document.getElementById('ficha-fecha-entrega')?.value || '').trim();
          if (vssChkVal && !vssFechaVal) {
            await window.LpsModal.alert('Por favor indica la fecha de entrega estimada cuando activas "Vender sin stock".', 'warning');
            document.getElementById('ficha-fecha-entrega')?.focus();
            btnSave.disabled = false;
            btnSave.textContent = orig;
            return;
          }
          fd.append('vender_sin_stock', vssChkVal ? 'true' : 'false');
          fd.append('fecha_entrega_estimada', vssChkVal ? vssFechaVal : '');
          fd.append('activo', document.getElementById('ficha-activo').value);

          fd.append('imagenes_existentes', JSON.stringify(fichaImagenesExistentes));
          for (var fIdx = 0; fIdx < fichaNuevosArchivos.length; fIdx++) {
            var optFile = await comprimirImagenWeb(fichaNuevosArchivos[fIdx]);
            fd.append('imagenes', optFile);
          }

          var res = await apiFetch('/productos/' + encodeURIComponent(prodId), {
            method: 'PATCH',
            body: fd
          });
          var data = await res.json();
          if (res.ok && data.success) {
            if (msgEl) {
              msgEl.classList.remove('hidden');
              setTimeout(function () { msgEl.classList.add('hidden'); }, 2500);
            }
            document.getElementById('ficha-badge-sku').textContent = 'SKU: ' + (data.producto.sku || '');
            document.getElementById('ficha-badge-ean').textContent = 'EAN: ' + (data.producto.ean || '');
            fichaImagenesExistentes = Array.isArray(data.producto.imagenes) ? data.producto.imagenes.slice() : [];
            fichaNuevosArchivos = [];
            renderFichaGaleria();
            await loadInventario();
            await loadProductos();
          } else {
            await window.LpsModal.alert(data.message || 'Error al actualizar la ficha del producto.', 'error');
          }
        } finally {
          btnSave.disabled = false;
          btnSave.textContent = orig;
        }
      });
    }
  }

  // ============================================================================
  // Lector de Código de Barras EAN-13 con Cámara (Shopify Mobile WMS)
  // ============================================================================
  var mediaStreamGlobal = null;

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

    btnCerrar && btnCerrar.addEventListener('click', cerrarScanner);

    btnAbrir.addEventListener('click', function () {
      modal.classList.remove('hidden');
      statusEl.textContent = 'Activando cámara trasera...';

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        statusEl.textContent = 'Cámara no soportada en este navegador. Usa el campo manual.';
        return;
      }

      navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      }).then(function (stream) {
        mediaStreamGlobal = stream;
        video.srcObject = stream;
        statusEl.textContent = 'Cámara activa. Escaneando código...';

        if ('BarcodeDetector' in window) {
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
      }).catch(function (err) {
        console.warn('Error accediendo a cámara:', err);
        statusEl.textContent = 'No se pudo acceder a la cámara. Usa el ingreso manual abajo.';
      });
    });

    function aplicarFiltroBarcode(code) {
      var searchInput = document.getElementById('filtro-inv-search');
      if (searchInput) {
        searchInput.value = code;
        searchInput.dispatchEvent(new Event('input'));
      }
    }

    manualBtn && manualBtn.addEventListener('click', function () {
      var val = (manualInput.value || '').trim();
      if (val) {
        cerrarScanner();
        aplicarFiltroBarcode(val);
      }
    });

    manualInput && manualInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        manualBtn.click();
      }
    });
  }

  // ============================================================================
  // Modal Packing Slip / Guía de Despacho & Embalaje Artesanitas (Shopify WMS)
  // ============================================================================
  function initGuiaDespachoLogic() {
    var modal = document.getElementById('modal-guia-despacho');
    var btnCerrar = document.getElementById('btn-cerrar-guia-despacho');
    var btnPrint = document.getElementById('btn-imprimir-guia-doc');

    if (!modal) return;

    btnCerrar && btnCerrar.addEventListener('click', function () {
      modal.classList.add('hidden');
    });

    btnPrint && btnPrint.addEventListener('click', function () {
      var printable = document.getElementById('guia-despacho-printable');
      if (!printable) return;
      var printWin = window.open('', '_blank', 'width=800,height=900');
      printWin.document.write('<html><head><title>Packing Slip Artesanitas</title>');
      printWin.document.write('<style>');
      printWin.document.write('body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; color: #4A3C31; }');
      printWin.document.write('table { width: 100%; border-collapse: collapse; margin-top: 12px; }');
      printWin.document.write('th, td { border: 1px solid #D5C9BD; padding: 8px; text-align: left; font-size: 12px; }');
      printWin.document.write('th { background-color: #F1EDE7; font-weight: bold; }');
      printWin.document.write('.text-right { text-align: right; }');
      printWin.document.write('.font-mono { font-family: monospace; }');
      printWin.document.write('@media print { body { padding: 0; } }');
      printWin.document.write('</style></head><body>');
      printWin.document.write(printable.innerHTML);
      printWin.document.write('</body></html>');
      printWin.document.close();
      printWin.focus();
      setTimeout(function () {
        printWin.print();
        printWin.close();
      }, 350);
    });
  }

  function abrirPackingSlipPedido(pedidoId) {
    var p = (pedidosCache || []).find(function (item) { return String(item.id) === String(pedidoId); });
    if (!p) return;

    var modal = document.getElementById('modal-guia-despacho');
    if (!modal) return;

    document.getElementById('guia-codigo-pedido').textContent = p.codigo_pedido || ('ART-' + p.id);
    document.getElementById('guia-fecha-emision').textContent = 'Emisión: ' + new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
    document.getElementById('guia-destinatario-nombre').textContent = p.nombre || '--';
    document.getElementById('guia-destinatario-dni').textContent = 'DNI: ' + (p.dni || 'No registrado');
    document.getElementById('guia-destinatario-tel').textContent = 'WhatsApp: ' + (p.whatsapp || p.telefono || '--');
    document.getElementById('guia-courier-empresa').textContent = 'Courier: ' + (p.empresa_envio || 'Shalom (Agencia)');
    document.getElementById('guia-courier-ciudad').textContent = 'Ciudad Destino: ' + (p.ciudad_destino || (p.tipo_entrega === 'provincia' ? (p.sede_shalom || 'Por definir') : 'Recojo en Taller Trujillo'));
    document.getElementById('guia-courier-nro-guia').textContent = 'N° Guía: ' + (p.guia_envio || 'Pendiente de emisión');

    var tbody = document.getElementById('guia-items-tbody');
    tbody.innerHTML = '';

    var items = [];
    try {
      if (p.items) {
        items = typeof p.items === 'string' ? JSON.parse(p.items) : p.items;
      } else if (p.items_json) {
        items = typeof p.items_json === 'string' ? JSON.parse(p.items_json) : p.items_json;
      }
    } catch (e) {}

    if (!items || items.length === 0) {
      items = [{
        nombre: p.producto_nombre || 'Pieza Artesanal',
        cantidad: Number(p.cantidad || 1),
        sku: '1001',
        ean: '7752601000018'
      }];
    }

    items.forEach(function (item) {
      var tr = document.createElement('tr');
      tr.innerHTML = '<td class="p-2 font-medium">' + escapeHtml(item.nombre || item.producto_nombre || 'Pieza Artesanal') + '</td>' +
        '<td class="p-2 font-mono text-[11px] text-[#8C7A6B]">' + escapeHtml(item.sku || '1001') + ' / ' + escapeHtml(item.ean || '775...') + '</td>' +
        '<td class="p-2 font-bold text-center">' + (item.cantidad || 1) + ' und.</td>' +
        '<td class="p-2 text-right font-mono font-bold text-[#007A78]">[ ✓ OK ]</td>';
      tbody.appendChild(tr);
    });

    modal.classList.remove('hidden');
  }

  initFichaProducto360();
  initCamaraScannerWMS();
  initGuiaDespachoLogic();

  // Auto-entrada si ya hay una sesión guardada
  if (localStorage.getItem(STORAGE_KEY)) {
    mostrarPanel();
  }
})();
