// public/artesanitas/js/inscripcion.js
// Lógica modular del formulario de inscripción a talleres de Artesanitas
(function () {
  const NEGOCIO = 'artesanitas';
  const params = new URLSearchParams(window.location.search);
  const tallerPreseleccionado = params.get('taller');

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  const loadingState = document.getElementById('loading-state');
  const emptyState = document.getElementById('empty-state');
  const form = document.getElementById('inscripcion-form');
  const successState = document.getElementById('success-state');
  const tallerSelect = document.getElementById('taller-select');
  const acompananteField = document.getElementById('acompanante-field');
  const acompanantesList = document.getElementById('acompanantes-list');
  const btnAgregarAcompanante = document.getElementById('btn-agregar-acompanante');
  const comprobanteInput = document.getElementById('comprobante-input');
  const dropzoneArea = document.getElementById('dropzone-area');
  const dropzoneEmptyState = document.getElementById('dropzone-empty-state');
  const dropzoneFileState = document.getElementById('dropzone-file-state');
  const filePreviewImg = document.getElementById('file-preview-img');
  const fileNameTxt = document.getElementById('file-name-txt');
  const fileSizeTxt = document.getElementById('file-size-txt');
  const btnChangeFile = document.getElementById('btn-change-file');
  const btnCopyNumber = document.getElementById('btn-copy-number');
  const copyText = document.getElementById('copy-text');
  const btnToggleQr = document.getElementById('btn-toggle-qr');
  const qrContainer = document.getElementById('qr-container');
  const qrChevron = document.getElementById('qr-chevron');
  const summaryTallerName = document.getElementById('summary-taller-name');
  const summaryTotalPrice = document.getElementById('summary-total-price');
  const summaryDepositPrice = document.getElementById('summary-deposit-price');
  const formError = document.getElementById('form-error');
  const submitBtn = document.getElementById('submit-btn');

  let talleres = [];

  function showError(msg) {
    if (!formError) return;
    formError.textContent = msg;
    formError.classList.remove('hidden');
  }
  function hideError() {
    if (formError) formError.classList.add('hidden');
  }

  // ── Copiar número al portapapeles ──
  if (btnCopyNumber) {
    btnCopyNumber.addEventListener('click', (e) => {
      e.stopPropagation();
      const numero = '923282069';
      navigator.clipboard.writeText(numero).then(() => {
        if (copyText) copyText.textContent = '¡Copiado!';
        btnCopyNumber.classList.add('bg-[#008f6b]');
        setTimeout(() => {
          if (copyText) copyText.textContent = 'Copiar';
          btnCopyNumber.classList.remove('bg-[#008f6b]');
        }, 2000);
      }).catch(() => {
        if (copyText) copyText.textContent = '923282069';
      });
    });
  }

  // ── Toggle QR ──
  if (btnToggleQr && qrContainer) {
    btnToggleQr.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = qrContainer.classList.contains('hidden');
      qrContainer.classList.toggle('hidden', !isHidden);
      if (qrChevron) qrChevron.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
    });
  }

  // ── Manejo del Dropzone de Comprobante ──
  if (dropzoneArea && comprobanteInput) {
    dropzoneArea.addEventListener('click', () => comprobanteInput.click());
    if (btnChangeFile) {
      btnChangeFile.addEventListener('click', (e) => {
        e.stopPropagation();
        comprobanteInput.click();
      });
    }

    dropzoneArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzoneArea.classList.add('border-[#B87352]', 'bg-[#B87352]/5');
    });

    dropzoneArea.addEventListener('dragleave', () => {
      dropzoneArea.classList.remove('border-[#B87352]', 'bg-[#B87352]/5');
    });

    dropzoneArea.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzoneArea.classList.remove('border-[#B87352]', 'bg-[#B87352]/5');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        comprobanteInput.files = e.dataTransfer.files;
        handleFileSelected(e.dataTransfer.files[0]);
      }
    });

    comprobanteInput.addEventListener('change', () => {
      if (comprobanteInput.files && comprobanteInput.files[0]) {
        handleFileSelected(comprobanteInput.files[0]);
      }
    });
  }

  function handleFileSelected(file) {
    if (file.size > 5 * 1024 * 1024) {
      showError('El comprobante no debe pesar más de 5MB.');
      if (comprobanteInput) comprobanteInput.value = '';
      if (dropzoneEmptyState) dropzoneEmptyState.classList.remove('hidden');
      if (dropzoneFileState) dropzoneFileState.classList.add('hidden');
      return;
    }
    hideError();

    if (fileNameTxt) fileNameTxt.textContent = file.name;
    if (fileSizeTxt) {
      fileSizeTxt.textContent = (file.size / 1024 < 1024) 
        ? (file.size / 1024).toFixed(1) + ' KB' 
        : (file.size / (1024 * 1024)).toFixed(2) + ' MB';
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      if (filePreviewImg) filePreviewImg.src = e.target.result;
      if (dropzoneEmptyState) dropzoneEmptyState.classList.add('hidden');
      if (dropzoneFileState) dropzoneFileState.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  }

  // ── Lista dinámica de acompañantes ──
  function crearFilaAcompanante(esPrimera) {
    const fila = document.createElement('div');
    fila.className = 'flex gap-2';
    fila.innerHTML = `
      <input type="text" maxlength="100" placeholder="Nombre completo"
        class="acompanante-input flex-1 px-4 py-3 rounded-xl border border-[#D5C9BD] bg-[#F9F6F0] text-[#4A3C31] placeholder:text-[#8C7A6B]/60 focus:outline-none focus:border-[#B87352] transition-colors">
      ${esPrimera ? '' : `
      <button type="button" class="btn-quitar-acompanante shrink-0 w-11 h-11 rounded-xl border border-[#D5C9BD] text-[#8C7A6B] hover:text-[#B87352] hover:border-[#B87352] transition-colors flex items-center justify-center">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>`}
    `;
    const btnQuitar = fila.querySelector('.btn-quitar-acompanante');
    if (btnQuitar) btnQuitar.addEventListener('click', () => fila.remove());
    return fila;
  }

  function resetAcompanantes() {
    if (!acompanantesList) return;
    acompanantesList.innerHTML = '';
    acompanantesList.appendChild(crearFilaAcompanante(true));
  }

  if (btnAgregarAcompanante && acompanantesList) {
    btnAgregarAcompanante.addEventListener('click', () => {
      acompanantesList.appendChild(crearFilaAcompanante(false));
    });
  }

  function getAcompanantesValues() {
    if (!acompanantesList) return [];
    return [...acompanantesList.querySelectorAll('.acompanante-input')]
      .map(i => i.value.trim())
      .filter(v => v.length > 0);
  }

  function onTallerChange() {
    if (!tallerSelect) return;
    const taller = talleres.find(t => String(t.id) === tallerSelect.value);
    const esParaNinos = !!(taller && taller.es_para_ninos);
    if (acompananteField) acompananteField.classList.toggle('hidden', !esParaNinos);

    if (taller) {
      if (summaryTallerName) summaryTallerName.textContent = taller.nombre;
      const precioNum = Number(taller.precio || 0);
      if (summaryTotalPrice) summaryTotalPrice.textContent = `S/ ${precioNum.toFixed(2)}`;
      if (summaryDepositPrice) summaryDepositPrice.textContent = `S/ 20.00`;
    }

    if (esParaNinos && acompanantesList && acompanantesList.children.length === 0) {
      resetAcompanantes();
    }
  }

  fetch(`/api/negocios/${NEGOCIO}/talleres`)
    .then(r => r.json())
    .then(data => {
      talleres = (data && data.talleres) || [];
      if (loadingState) loadingState.classList.add('hidden');

      if (talleres.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
        return;
      }

      const defaultOption = `<option value="" disabled ${tallerPreseleccionado ? '' : 'selected'}>-- Selecciona el taller --</option>`;
      const options = talleres.map(t => {
        const fecha = new Date(t.fecha + 'T00:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'long' });
        const precioTxt = t.precio ? ` — S/ ${Number(t.precio).toFixed(0)}` : '';
        return `<option value="${t.id}">${escapeHtml(t.nombre)}${precioTxt} — ${fecha}</option>`;
      }).join('');

      if (tallerSelect) {
        tallerSelect.innerHTML = defaultOption + options;
        if (tallerPreseleccionado && talleres.some(t => String(t.id) === tallerPreseleccionado)) {
          tallerSelect.value = tallerPreseleccionado;
        } else {
          tallerSelect.value = '';
        }
      }

      onTallerChange();
      if (form) form.classList.remove('hidden');
    })
    .catch(() => {
      if (loadingState) loadingState.classList.add('hidden');
      if (emptyState) emptyState.classList.remove('hidden');
    });

  if (tallerSelect) tallerSelect.addEventListener('change', onTallerChange);

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideError();

      if (tallerSelect && !tallerSelect.value) {
        return showError('Por favor, selecciona el taller al que deseas inscribirte.');
      }

      const acompanantesValues = (acompananteField && !acompananteField.classList.contains('hidden')) ? getAcompanantesValues() : [];
      if (acompananteField && !acompananteField.classList.contains('hidden') && acompanantesValues.length === 0) {
        return showError('Ingresa el nombre de al menos un acompañante o madre.');
      }

      const formData = new FormData();
      formData.append('taller_id', tallerSelect ? tallerSelect.value : '');
      formData.append('nombre', document.getElementById('nombre-input')?.value.trim() || '');
      formData.append('edad', document.getElementById('edad-input')?.value || '');
      formData.append('whatsapp', document.getElementById('whatsapp-input')?.value.trim() || '');
      acompanantesValues.forEach(nombre => formData.append('acompanantes', nombre));
      const file = comprobanteInput?.files[0];
      if (file) formData.append('comprobante', file);

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Enviando...';
      }

      try {
        const res = await fetch(`/api/negocios/${NEGOCIO}/inscripciones`, {
          method: 'POST',
          body: formData
        });
        const data = await res.json();

        if (res.ok && data.success) {
          if (typeof fbq === 'function') {
            fbq('trackSingle', '851775257895823', 'Lead');
          }
          const successMsgEl = document.getElementById('success-message');
          if (successMsgEl) successMsgEl.textContent = data.message || 'Te contactaremos por WhatsApp para confirmar tu lugar.';
          form.classList.add('hidden');
          if (successState) successState.classList.remove('hidden');
        } else {
          showError(data.message || 'Ocurrió un error. Intenta de nuevo.');
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Confirmar Inscripción';
          }
        }
      } catch (err) {
        showError('Error de conexión. Intenta de nuevo.');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Confirmar Inscripción';
        }
      }
    });
  }
})();
