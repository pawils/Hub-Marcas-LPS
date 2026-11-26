/* public/js/lps-modal.js
 * Sistema de modales y notificaciones branded white-label para Hub Marcas LPS
 * Reemplaza los popups nativos del navegador (alert / confirm) en toda la web y futuros negocios.
 * Configuración opcional por marca: window.LPS_BRAND = { name, primaryColor, accentColor, bgColor, textColor }
 */
(function (global) {
  'use strict';

  var STYLE_ID = 'lps-modal-styles';
  var BACKDROP_ID = 'lps-modal-backdrop';
  var TOAST_CONTAINER_ID = 'lps-toast-container';

  function getBrand() {
    var cfg = global.LPS_BRAND || {};
    return {
      name: cfg.name || 'Artesanitas Perú',
      primaryColor: cfg.primaryColor || '#4A3C31',
      accentColor: cfg.accentColor || '#B87352',
      bgColor: cfg.bgColor || '#FCF8F3',
      textColor: cfg.textColor || '#4A3C31'
    };
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var brand = getBrand();
    var css = [
      '#' + BACKDROP_ID + ' {',
      '  position: fixed; inset: 0; z-index: 99999;',
      '  display: flex; align-items: center; justify-content: center; padding: 1rem;',
      '  background: rgba(28, 22, 18, 0.58); backdrop-filter: blur(4px);',
      '  opacity: 0; transition: opacity 180ms ease-out;',
      '}',
      '#' + BACKDROP_ID + '.lps-open { opacity: 1; }',
      '#' + BACKDROP_ID + ' .lps-modal-card {',
      '  width: 100%; max-width: 440px; border-radius: 1.25rem;',
      '  background: #FFFFFF; color: ' + brand.textColor + ';',
      '  border: 1px solid rgba(74, 60, 49, 0.14);',
      '  box-shadow: 0 24px 60px -12px rgba(28, 22, 18, 0.35);',
      '  overflow: hidden; transform: translateY(10px) scale(0.97);',
      '  transition: transform 180ms ease-out;',
      '  font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;',
      '}',
      '#' + BACKDROP_ID + '.lps-open .lps-modal-card { transform: translateY(0) scale(1); }',
      '.lps-modal-head {',
      '  display: flex; align-items: flex-start; gap: 0.875rem; padding: 1.35rem 1.35rem 0.75rem;',
      '}',
      '.lps-modal-icon {',
      '  flex-shrink: 0; width: 2.5rem; height: 2.5rem; border-radius: 0.875rem;',
      '  display: flex; align-items: center; justify-content: center;',
      '}',
      '.lps-modal-icon.info { background: #F5ECE4; color: ' + brand.accentColor + '; }',
      '.lps-modal-icon.success { background: #E6F4F3; color: #007A78; }',
      '.lps-modal-icon.warning { background: #FEF3C7; color: #B45309; }',
      '.lps-modal-icon.error { background: #FEE2E2; color: #B91C1C; }',
      '.lps-modal-title-wrap { flex: 1; min-width: 0; }',
      '.lps-modal-brand { font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #8C7A6B; margin-bottom: 0.15rem; }',
      '.lps-modal-title { font-size: 1.0625rem; font-weight: 700; line-height: 1.3; margin: 0; color: ' + brand.primaryColor + '; }',
      '.lps-modal-close {',
      '  flex-shrink: 0; width: 2rem; height: 2rem; border-radius: 9999px; border: none;',
      '  background: transparent; color: #8C7A6B; cursor: pointer; display: flex; align-items: center; justify-content: center;',
      '  transition: background 150ms ease, color 150ms ease;',
      '}',
      '.lps-modal-close:hover { background: ' + brand.bgColor + '; color: ' + brand.primaryColor + '; }',
      '.lps-modal-body {',
      '  padding: 0 1.35rem 1.25rem 4.725rem; font-size: 0.9125rem; line-height: 1.55; color: #5C4E43;',
      '  word-break: break-word; white-space: pre-line;',
      '}',
      '@media (max-width: 480px) { .lps-modal-body { padding-left: 1.35rem; } }',
      '.lps-modal-actions {',
      '  display: flex; align-items: center; justify-content: flex-end; gap: 0.625rem;',
      '  padding: 0.875rem 1.35rem; background: ' + brand.bgColor + '; border-top: 1px solid rgba(74, 60, 49, 0.09);',
      '}',
      '.lps-btn {',
      '  display: inline-flex; align-items: center; justify-content: center; gap: 0.375rem;',
      '  border-radius: 0.75rem; padding: 0.6rem 1.15rem; font-size: 0.875rem; font-weight: 600;',
      '  cursor: pointer; border: 1px solid transparent; transition: all 150ms ease;',
      '}',
      '.lps-btn-cancel { background: #FFFFFF; color: ' + brand.primaryColor + '; border-color: rgba(74, 60, 49, 0.22); }',
      '.lps-btn-cancel:hover { background: #F5ECE4; }',
      '.lps-btn-primary { background: ' + brand.primaryColor + '; color: #FFFFFF; }',
      '.lps-btn-primary:hover { filter: brightness(1.1); }',
      '.lps-btn-danger { background: #B91C1C; color: #FFFFFF; }',
      '.lps-btn-danger:hover { background: #991B1B; }',
      '#' + TOAST_CONTAINER_ID + ' {',
      '  position: fixed; top: 1rem; right: 1rem; z-index: 100000;',
      '  display: flex; flex-direction: column; gap: 0.5rem; max-width: 360px; pointer-events: none;',
      '}',
      '.lps-toast {',
      '  pointer-events: auto; display: flex; align-items: center; gap: 0.625rem;',
      '  padding: 0.75rem 1rem; border-radius: 0.875rem; background: #FFFFFF;',
      '  border: 1px solid rgba(74, 60, 49, 0.14); box-shadow: 0 12px 30px -8px rgba(28, 22, 18, 0.25);',
      '  font-family: Inter, system-ui, -apple-system, sans-serif; font-size: 0.85rem; font-weight: 500; color: ' + brand.textColor + ';',
      '  opacity: 0; transform: translateY(-8px); transition: opacity 180ms ease, transform 180ms ease;',
      '}',
      '.lps-toast.lps-open { opacity: 1; transform: translateY(0); }'
    ].join('\n');

    var styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
  }

  function iconSvg(type) {
    if (type === 'success') {
      return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
    }
    if (type === 'error') {
      return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
    }
    if (type === 'warning') {
      return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
    }
    return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
  }

  function closeExisting() {
    var old = document.getElementById(BACKDROP_ID);
    if (old && old.parentNode) old.parentNode.removeChild(old);
  }

  function inferTypeAndTitle(message, explicitType, isConfirm) {
    if (explicitType) {
      var titles = { success: 'Operación completada', error: 'No se pudo completar', warning: 'Atención', info: 'Aviso' };
      return { type: explicitType, title: titles[explicitType] || 'Aviso' };
    }
    var msgLower = String(message || '').toLowerCase();
    if (isConfirm) return { type: 'warning', title: 'Confirmar acción' };
    if (msgLower.includes('error') || msgLower.includes('no se pudo') || msgLower.includes('denegado') || msgLower.includes('expir') || msgLower.includes('ya existe')) {
      return { type: 'error', title: 'Ocurrió un problema' };
    }
    if (msgLower.includes('por favor') || msgLower.includes('ingresa') || msgLower.includes('modifica') || msgLower.includes('no soporta') || msgLower.includes('permiso')) {
      return { type: 'warning', title: 'Atención' };
    }
    if (msgLower.includes('matricul') || msgLower.includes('actualiz') || msgLower.includes('éxito') || msgLower.includes('guard')) {
      return { type: 'success', title: 'Operación completada' };
    }
    return { type: 'info', title: 'Aviso' };
  }

  function openDialog(opts) {
    injectStyles();
    closeExisting();

    var brand = getBrand();
    var isConfirm = Boolean(opts.isConfirm);
    var inferred = inferTypeAndTitle(opts.message, opts.type, isConfirm);
    var type = inferred.type;
    var title = opts.title || inferred.title;
    var message = String(opts.message || '');
    var confirmText = opts.confirmText || (isConfirm ? 'Continuar' : 'Aceptar');
    var cancelText = opts.cancelText || 'Cancelar';

    return new Promise(function (resolve) {
      var backdrop = document.createElement('div');
      backdrop.id = BACKDROP_ID;
      backdrop.setAttribute('role', 'dialog');
      backdrop.setAttribute('aria-modal', 'true');

      var card = document.createElement('div');
      card.className = 'lps-modal-card';

      var head = document.createElement('div');
      head.className = 'lps-modal-head';

      var iconBox = document.createElement('div');
      iconBox.className = 'lps-modal-icon ' + type;
      iconBox.innerHTML = iconSvg(type);

      var titleWrap = document.createElement('div');
      titleWrap.className = 'lps-modal-title-wrap';
      var brandEl = document.createElement('div');
      brandEl.className = 'lps-modal-brand';
      brandEl.textContent = opts.brandName || brand.name;
      var titleEl = document.createElement('h3');
      titleEl.className = 'lps-modal-title';
      titleEl.textContent = title;
      titleWrap.appendChild(brandEl);
      titleWrap.appendChild(titleEl);

      var closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'lps-modal-close';
      closeBtn.setAttribute('aria-label', 'Cerrar');
      closeBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

      head.appendChild(iconBox);
      head.appendChild(titleWrap);
      head.appendChild(closeBtn);

      var body = document.createElement('div');
      body.className = 'lps-modal-body';
      body.textContent = message;

      var actions = document.createElement('div');
      actions.className = 'lps-modal-actions';

      var cancelBtn = null;
      if (isConfirm) {
        cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'lps-btn lps-btn-cancel';
        cancelBtn.textContent = cancelText;
        actions.appendChild(cancelBtn);
      }

      var okBtn = document.createElement('button');
      okBtn.type = 'button';
      okBtn.className = 'lps-btn ' + (opts.danger ? 'lps-btn-danger' : 'lps-btn-primary');
      okBtn.textContent = confirmText;
      actions.appendChild(okBtn);

      card.appendChild(head);
      card.appendChild(body);
      card.appendChild(actions);
      backdrop.appendChild(card);
      document.body.appendChild(backdrop);

      function finish(result) {
        document.removeEventListener('keydown', onKeyDown);
        backdrop.classList.remove('lps-open');
        setTimeout(function () {
          if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
        }, 160);
        resolve(result);
      }

      function onKeyDown(ev) {
        if (ev.key === 'Escape') {
          ev.preventDefault();
          finish(false);
        }
      }

      document.addEventListener('keydown', onKeyDown);
      closeBtn.addEventListener('click', function () { finish(false); });
      if (cancelBtn) cancelBtn.addEventListener('click', function () { finish(false); });
      okBtn.addEventListener('click', function () { finish(true); });
      backdrop.addEventListener('click', function (ev) {
        if (ev.target === backdrop) finish(false);
      });

      requestAnimationFrame(function () {
        backdrop.classList.add('lps-open');
        okBtn.focus();
      });
    });
  }

  function alertDialog(messageOrOpts, maybeType) {
    var opts = typeof messageOrOpts === 'string'
      ? { message: messageOrOpts, type: maybeType }
      : Object.assign({}, messageOrOpts);
    opts.isConfirm = false;
    return openDialog(opts).then(function () { return undefined; });
  }

  function confirmDialog(messageOrOpts, onConfirm) {
    var opts = typeof messageOrOpts === 'string'
      ? { message: messageOrOpts }
      : Object.assign({}, messageOrOpts);
    opts.isConfirm = true;
    return openDialog(opts).then(function (accepted) {
      if (accepted && typeof onConfirm === 'function') {
        onConfirm();
      }
      return accepted;
    });
  }

  function toast(message, type, duration) {
    injectStyles();
    var container = document.getElementById(TOAST_CONTAINER_ID);
    if (!container) {
      container = document.createElement('div');
      container.id = TOAST_CONTAINER_ID;
      document.body.appendChild(container);
    }
    var t = document.createElement('div');
    t.className = 'lps-toast';
    var iconWrap = document.createElement('span');
    iconWrap.style.display = 'inline-flex';
    iconWrap.style.color = type === 'error' ? '#B91C1C' : type === 'warning' ? '#B45309' : type === 'success' ? '#007A78' : getBrand().accentColor;
    iconWrap.innerHTML = iconSvg(type || 'info');
    var text = document.createElement('span');
    text.textContent = String(message || '');
    t.appendChild(iconWrap);
    t.appendChild(text);
    container.appendChild(t);

    requestAnimationFrame(function () { t.classList.add('lps-open'); });
    setTimeout(function () {
      t.classList.remove('lps-open');
      setTimeout(function () {
        if (t.parentNode) t.parentNode.removeChild(t);
      }, 200);
    }, duration || 3500);
  }

  global.LpsModal = {
    alert: alertDialog,
    confirm: confirmDialog,
    toast: toast
  };
})(window);
