// public/artesanitas/js/pedido.js
// Lógica modular del formulario de preventas y reservas de Artesanitas Perú
(function () {
  const NEGOCIO = 'artesanitas';

  // Catálogo oficial de preventas con todas las variaciones
  const CATALOGO_PREVENTA = {
    'taza-navidad-papa-noel': {
      slug: 'taza-navidad-papa-noel',
      nombre: 'Taza Navideña Papá Noel',
      precio: 59.90,
      reserva: 20.00,
      fecha: '10 de Diciembre',
      imagen: '/imagenes/Artesanitas/reservas_navidad_2026/Taza_navidad_papa_noel_1.jpeg',
      descripcion: 'Hermosa taza artesanal con la figura de Papá Noel modelada y pintada a mano en cerámica fina, edición especial de Navidad.'
    },
    'taza-muneco-de-nieve': {
      slug: 'taza-muneco-de-nieve',
      nombre: 'Taza Muñeco de Nieve',
      precio: 59.90,
      reserva: 20.00,
      fecha: '10 de Diciembre',
      imagen: '/imagenes/Artesanitas/reservas_navidad_2026/Taza_muneco_de_nieve_1.jpeg',
      descripcion: 'Taza artesanal con detalles de Muñeco de Nieve modelado y pintado a mano en cerámica de alta temperatura.'
    },
    'taza-arbolito-chocolatosa': {
      slug: 'taza-arbolito-chocolatosa',
      nombre: 'Taza Arbolito Chocolatosa',
      precio: 59.90,
      reserva: 20.00,
      fecha: '10 de Diciembre',
      imagen: '/imagenes/Artesanitas/reservas_navidad_2026/Taza_arbolito_Chocolatosa.jpeg',
      descripcion: 'Hermosa taza artesanal con relieve de árbol de Navidad en tono chocolate cálido, modelada y pintada a mano.'
    },
    'taza-arbolito-rosa': {
      slug: 'taza-arbolito-rosa',
      nombre: 'Taza Arbolito Rosa',
      precio: 59.90,
      reserva: 20.00,
      fecha: '10 de Diciembre',
      imagen: '/imagenes/Artesanitas/reservas_navidad_2026/Taza_arbolito_Rosa.jpeg',
      descripcion: 'Delicado diseño artesanal con relieve de árbol de Navidad en tono rosa pastel, modelada y esmaltada a mano.'
    },
    
    
    
    
    
    
    
    
    

    'taza-van-gogh': {
      slug: 'taza-van-gogh',
      nombre: 'Taza Van Gogh',
      precio: 69.00,
      reserva: 20.00,
      fecha: '10 de Diciembre',
      imagen: '/imagenes/Artesanitas/Fotos/Taza_Van_Gogh_0.jpeg',
      descripcion: 'Cerámica pintada a mano inspirada en el arte de Van Gogh.'
    },
    'azucarera-van-gogh': {
      slug: 'azucarera-van-gogh',
      nombre: 'Azucarera Van Gogh',
      precio: 65.00,
      reserva: 20.00,
      fecha: '10 de Diciembre',
      imagen: '/imagenes/Artesanitas/Fotos/Azucarera_Van_Gogh_0.jpeg',
      descripcion: 'Inspirada en las pinceladas de Van Gogh, azucarera de cerámica pintada a mano que aporta arte y elegancia a tu mesa.'
    },
    'vasito-van-gogh': {
      slug: 'vasito-van-gogh',
      nombre: 'Vasito Van Gogh',
      precio: 59.00,
      reserva: 20.00,
      fecha: '10 de Diciembre',
      imagen: '/imagenes/Artesanitas/Fotos/vasito_van_gogh_0.jpeg',
      descripcion: 'Disfruta tus bebidas favoritas en este vasito de cerámica pintado a mano inspirado en la obra de Van Gogh.'
    },
    'taza-piston-cup': {
      slug: 'taza-piston-cup',
      nombre: 'Taza Piston Cup',
      precio: 59.00,
      reserva: 20.00,
      fecha: '10 de Diciembre',
      imagen: '/imagenes/Artesanitas/Fotos/Taza_Piston_1.jpeg',
      descripcion: 'Taza de cerámica artesanal temática de Cars inspirada en la Piston Cup, modelada y pintada a mano.'
    },
    // ── Colores enteros (sin plato - S/ 65.00) ──
    'taza-rapunzel-morada-sin-plato': {
      slug: 'taza-rapunzel-morada-sin-plato',
      nombre: 'Taza Rapunzel Morada (sin plato)',
      precio: 65.00,
      reserva: 20.00,
      fecha: '10 de Diciembre',
      imagen: '/imagenes/Artesanitas/Fotos/Taza_Rapunzel_Morada_sinplato_1.jpeg',
      descripcion: 'Pieza artesanal inspirada en Rapunzel, en color morado entero (sin plato), modelada y pintada a mano.'
    },
    'taza-rapunzel-rosa-flamenco-sin-plato': {
      slug: 'taza-rapunzel-rosa-flamenco-sin-plato',
      nombre: 'Taza Rapunzel Rosa Flamenco (sin plato)',
      precio: 65.00,
      reserva: 20.00,
      fecha: '10 de Diciembre',
      imagen: '/imagenes/Artesanitas/Fotos/Taza_Rapunzel_RosaFlamenco_sinplato_1.jpeg',
      descripcion: 'Pieza artesanal inspirada en Rapunzel, en tono rosa flamenco entero (sin plato), modelada y pintada a mano.'
    },
    'taza-rapunzel-palo-rosa-sin-plato': {
      slug: 'taza-rapunzel-palo-rosa-sin-plato',
      nombre: 'Taza Rapunzel Palo Rosa (sin plato)',
      precio: 65.00,
      reserva: 20.00,
      fecha: '10 de Diciembre',
      imagen: '/imagenes/Artesanitas/Fotos/Taza_Rapunzel_Palo_Rosa_sin_plato_1.jpeg',
      descripcion: 'Pieza artesanal inspirada en Rapunzel, en tono palo rosa entero (sin plato), modelada y pintada a mano.'
    },
    'taza-stich': {
      slug: 'taza-stich',
      nombre: 'Taza Stich',
      precio: 65.00,
      reserva: 20.00,
      fecha: '10 de Diciembre',
      imagen: '/imagenes/Artesanitas/Fotos/taza_stich_2.jpeg',
      descripcion: 'Taza de cerámica artesanal temática de Stich pintada a mano con detalle "OHANA", modelada en cerámica fina.'
    },
    'taza-stich-sin-plato': {
      slug: 'taza-stich',
      nombre: 'Taza Stich',
      precio: 65.00,
      reserva: 20.00,
      fecha: '10 de Diciembre',
      imagen: '/imagenes/Artesanitas/Fotos/taza_stich_2.jpeg',
      descripcion: 'Taza de cerámica artesanal temática de Stich pintada a mano con detalle "OHANA", modelada en cerámica fina.'
    },
    // ── Taza con detalles (con líneas - S/ 69.90) ──
    'taza-rapunzel-morada-lineas': {
      slug: 'taza-rapunzel-morada-lineas',
      nombre: 'Taza Rapunzel Morada con líneas',
      precio: 69.90,
      reserva: 20.00,
      fecha: '10 de Diciembre',
      imagen: '/imagenes/Artesanitas/Fotos/taza_Rapunzel_Morada_con_lineas_1.jpeg',
      descripcion: 'Pieza artesanal inspirada en Rapunzel en color morado con líneas texturizadas, modelada y pintada a mano.'
    },
    'taza-rapunzel-palo-rosa-lineas': {
      slug: 'taza-rapunzel-palo-rosa-lineas',
      nombre: 'Taza Rapunzel Palo Rosa con líneas',
      precio: 69.90,
      reserva: 20.00,
      fecha: '10 de Diciembre',
      imagen: '/imagenes/Artesanitas/Fotos/Taza_Rapunzel_PaloRosa_con-lineas_1.jpeg',
      descripcion: 'Pieza artesanal inspirada en Rapunzel en color palo rosa con líneas texturizadas, modelada y pintada a mano.'
    },
    // ── Taza + Platito (S/ 89.90 y S/ 99.00) ──
    'taza-rapunzel-morada-plato': {
      slug: 'taza-rapunzel-morada-plato',
      nombre: 'Taza Rapunzel Morada + plato',
      precio: 89.90,
      reserva: 20.00,
      fecha: '10 de Diciembre',
      imagen: '/imagenes/Artesanitas/Fotos/Taza_Rapunzel_Morada_con_plato_1.jpeg',
      descripcion: 'Set de Taza Rapunzel morada + platito a juego modelado y esmaltado a mano.'
    },
    'taza-rapunzel-moradito': {
      slug: 'taza-rapunzel-moradito',
      nombre: 'Taza Rapunzel Moradito',
      precio: 95.00,
      reserva: 20.00,
      fecha: '10 de Diciembre',
      imagen: '/imagenes/Artesanitas/Fotos/Taza Rapunzel Moradito 95.jpeg',
      descripcion: 'Taza Rapunzel morada con platito, con esmalte morado vibrante.'
    },
    'taza-rapunzel-palo-rosa-plato': {
      slug: 'taza-rapunzel-palo-rosa-plato',
      nombre: 'Taza Rapunzel Palo Rosa + plato',
      precio: 89.90,
      reserva: 20.00,
      fecha: '10 de Diciembre',
      imagen: '/imagenes/Artesanitas/Fotos/Taza_Rapunzel_PaloRosa_Con-Plato_1.jpeg',
      descripcion: 'Set de Taza Rapunzel palo rosa + platito a juego modelado y esmaltado a mano.'
    },
    'taza-rapunzel-morada-lineas-plato': {
      slug: 'taza-rapunzel-morada-lineas-plato',
      nombre: 'Taza Rapunzel Morada con líneas + plato',
      precio: 99.00,
      reserva: 20.00,
      fecha: '10 de Diciembre',
      imagen: '/imagenes/Artesanitas/Fotos/Taza_Rapunzel_Morada_con_lineas_y_plato_1.jpeg',
      descripcion: 'Set exclusivo de Taza Rapunzel morada con líneas texturizadas + platito artesanal a juego.'
    },
    'taza-rapunzel-palo-rosa-lineas-plato': {
      slug: 'taza-rapunzel-palo-rosa-lineas-plato',
      nombre: 'Taza Rapunzel Palo Rosa con líneas + plato',
      precio: 99.00,
      reserva: 20.00,
      fecha: '10 de Diciembre',
      imagen: '/imagenes/Artesanitas/Fotos/Taza_Rapunzel_PaloRosa_con_lineas_y_plato_1.jpeg',
      descripcion: 'Set exclusivo de Taza Rapunzel palo rosa con líneas texturizadas + platito artesanal a juego.'
    },
    'taza-rapunzel': {
      slug: 'taza-rapunzel-morada-sin-plato',
      nombre: 'Taza Rapunzel Morada (sin plato)',
      precio: 65.00,
      reserva: 20.00,
      fecha: '10 de Diciembre',
      imagen: '/imagenes/Artesanitas/Fotos/Taza_Rapunzel_Morada_sinplato_1.jpeg',
      descripcion: 'Pieza artesanal inspirada en Rapunzel, en color morado entero (sin plato), modelada y pintada a mano.'
    },
    'palo-rosa-lb': {
      slug: 'palo-rosa-lb',
      nombre: 'Palo Rosa LB (Colección Rapunzel)',
      precio: 69.00,
      reserva: 20.00,
      fecha: '10 de Diciembre',
      imagen: '/imagenes/Artesanitas/Fotos/Taza_Rapunzel_PaloRosa_con-lineas_1.jpeg',
      descripcion: 'Taza artesanal con líneas texturizadas en tono palo rosa, acabado único hecho a mano.'
    },
    'palo-rosa-full': {
      slug: 'taza-rapunzel-palo-rosa-sin-plato',
      nombre: 'Taza Rapunzel Palo Rosa (sin plato)',
      precio: 65.00,
      reserva: 20.00,
      fecha: '10 de Diciembre',
      imagen: '/imagenes/Artesanitas/Fotos/Taza_Rapunzel_Palo_Rosa_sin_plato_1.jpeg',
      descripcion: 'Taza artesanal en color palo rosa entero, acabado suave y diseño elegante.'
    },
    'morada-full': {
      slug: 'taza-rapunzel-morada-sin-plato',
      nombre: 'Taza Rapunzel Morada (sin plato)',
      precio: 65.00,
      reserva: 20.00,
      fecha: '10 de Diciembre',
      imagen: '/imagenes/Artesanitas/Fotos/Taza_Rapunzel_Morada_sinplato_1.jpeg',
      descripcion: 'Taza artesanal en color morado entero, modelada con esmalte satinado.'
    },
    'morada-con-lineas': {
      slug: 'taza-rapunzel-morada-lineas',
      nombre: 'Taza Rapunzel Morada con líneas',
      precio: 69.90,
      reserva: 20.00,
      fecha: '10 de Diciembre',
      imagen: '/imagenes/Artesanitas/Fotos/taza_Rapunzel_Morada_con_lineas_1.jpeg',
      descripcion: 'Taza artesanal morada con líneas texturizadas en relieve.'
    },
    'vaso-van-gogh': {
      slug: 'vasito-van-gogh',
      nombre: 'Vasito Van Gogh',
      precio: 59.00,
      reserva: 20.00,
      fecha: '10 de Diciembre',
      imagen: '/imagenes/Artesanitas/Fotos/vasito_van_gogh_0.jpeg',
      descripcion: 'Vasito de cerámica inspirado en Van Gogh, ideal para café, té o infusiones especiales.'
    },
    'taza-copa-piston': {
      slug: 'taza-piston-cup',
      nombre: 'Taza Copa Pistón',
      precio: 59.00,
      reserva: 20.00,
      fecha: '10 de Diciembre',
      imagen: '/imagenes/Artesanitas/Fotos/Taza_Piston_1.jpeg',
      descripcion: 'Taza de cerámica artesanal temática inspirada en la Copa Pistón, modelada y esmaltada a mano.'
    }
  };

  const ALIASES = {
    'taza-navidad-papa-noel': 'taza-navidad-papa-noel',
    'papa-noel': 'taza-navidad-papa-noel',
    'taza-muneco-de-nieve': 'taza-muneco-de-nieve',
    'muneco-de-nieve': 'taza-muneco-de-nieve',
    'taza-muñeco-de-nieve': 'taza-muneco-de-nieve',
    'muñeco-de-nieve': 'taza-muneco-de-nieve',
    'taza-arbolito-chocolatosa': 'taza-arbolito-chocolatosa',
    'arbolito-chocolatosa': 'taza-arbolito-chocolatosa',
    'taza-arbolito-rosa': 'taza-arbolito-rosa',
    'arbolito-rosa': 'taza-arbolito-rosa',
    
    
    'taza-navidad': 'taza-navidad-papa-noel',
    'navidad-papa-noel': 'taza-navidad-papa-noel',
    'navidad': 'taza-navidad-papa-noel',

    'taza-rapunzel': 'taza-rapunzel-morada-sin-plato',
    'taza-rapunzel-sin-plato': 'taza-rapunzel-morada-sin-plato',
    'taza-rapunzel-lineas': 'taza-rapunzel-morada-lineas',
    'taza-rapunzel-con-plato': 'taza-rapunzel-palo-rosa-plato',
    'taza-rapunzel-palo-rosa': 'taza-rapunzel-palo-rosa-plato',
    'taza-rapunzel-moradito': 'taza-rapunzel-moradito',
    'rapunzel': 'taza-rapunzel-morada-sin-plato',
    'rapunzel-morada': 'taza-rapunzel-morada-sin-plato',
    'rapunzel-rosa-flamenco': 'taza-rapunzel-rosa-flamenco-sin-plato',
    'rapunzel-palo-rosa': 'taza-rapunzel-palo-rosa-sin-plato',
    'rapunzel-lineas': 'taza-rapunzel-morada-lineas',
    'rapunzel-plato': 'taza-rapunzel-palo-rosa-plato',
    'taza-stich-sin-plato': 'taza-stich',
    'stich': 'taza-stich',
    'taza-copa-pistone': 'taza-piston-cup',
    'copa-pistone': 'taza-piston-cup',
    'piston-cup': 'taza-piston-cup',
    'pistone': 'taza-piston-cup',
    'taza-van-gogh': 'taza-van-gogh',
    'van-gogh': 'taza-van-gogh',
    'azucarera-van-gogh': 'azucarera-van-gogh',
    'azucarera': 'azucarera-van-gogh',
    'vasito-van-gogh': 'vasito-van-gogh',
    'vasito': 'vasito-van-gogh'
  };

  const form = document.getElementById('pedido-form');
  const successState = document.getElementById('success-state');
  const successMessage = document.getElementById('success-message');
  const btnSuccessWhatsapp = document.getElementById('btn-success-whatsapp');
  const formError = document.getElementById('form-error');
  const submitBtn = document.getElementById('submit-btn');

  const productoSelect = document.getElementById('producto-select');
  const rapunzelVariantsContainer = document.getElementById('rapunzel-variants-container');
  const productCardEmpty = document.getElementById('product-card-empty');
  const productCardSelected = document.getElementById('product-card-selected');
  const previewProductImg = document.getElementById('preview-product-img');
  const previewProductTitle = document.getElementById('preview-product-title');
  const previewProductDesc = document.getElementById('preview-product-desc');
  const previewProductPrice = document.getElementById('preview-product-price');

  const desgloseEnvioTxt = document.getElementById('desglose-envio-txt');
  const desgloseSaldoTxt = document.getElementById('desglose-saldo-txt');
  const desgloseReservaTxt = document.getElementById('desglose-reserva-txt');
  const previewEntregaTxt = document.getElementById('preview-entrega-txt');

  const btnCopyNumber = document.getElementById('btn-copy-number');
  const copyText = document.getElementById('copy-text');
  const btnToggleQr = document.getElementById('btn-toggle-qr');
  const qrContainer = document.getElementById('qr-container');
  const qrChevron = document.getElementById('qr-chevron');

  const dropzoneArea = document.getElementById('dropzone-area');
  const dropzoneFileState = document.getElementById('dropzone-file-state');
  const comprobanteInput = document.getElementById('comprobante-input');
  const btnChangeFile = document.getElementById('btn-change-file');

  const radioEntregas = document.querySelectorAll('input[name="tipo_entrega"]');
  const optProvincia = document.getElementById('opt-provincia');
  const optLocal = document.getElementById('opt-local');
  const shalomFieldsContainer = document.getElementById('shalom-fields-container');
  const tallerInfoContainer = document.getElementById('taller-info-container');
  const sedeShalomInput = document.getElementById('sede-shalom-input');
  const dniInput = document.getElementById('dni-input');

  let productoActual = null;
  let cantidadSeleccion = 1;
  let itemsReserva = [];

  const cantidadInput = document.getElementById('cantidad-input');
  const btnCantidadMenos = document.getElementById('btn-cantidad-menos');
  const btnCantidadMas = document.getElementById('btn-cantidad-mas');
  const btnAgregarItem = document.getElementById('btn-agregar-item');
  const btnAgregarText = document.getElementById('btn-agregar-text');
  const btnAgregarOtro = document.getElementById('btn-agregar-otro');

  const itemsReservaContainer = document.getElementById('items-reserva-container');
  const listaItemsReserva = document.getElementById('lista-items-reserva');
  const badgeTotalPiezas = document.getElementById('badge-total-piezas');
  const cartTotalPiezasTxt = document.getElementById('cart-total-piezas-txt');
  const cartTotalReservaTxt = document.getElementById('cart-total-reserva-txt');

  const desgloseItemsLista = document.getElementById('desglose-items-lista');
  const desgloseTotalPiezasTxt = document.getElementById('desglose-total-piezas-txt');
  const desgloseSubtotalTxt = document.getElementById('desglose-subtotal-txt');

  // ── Stepper de Cantidad del Producto en Inspección ──
  if (btnCantidadMenos) {
    btnCantidadMenos.addEventListener('click', () => {
      if (cantidadSeleccion > 1) {
        cantidadSeleccion -= 1;
        if (cantidadInput) cantidadInput.value = cantidadSeleccion;
      }
    });
  }

  if (btnCantidadMas) {
    btnCantidadMas.addEventListener('click', () => {
      if (cantidadSeleccion < 50) {
        cantidadSeleccion += 1;
        if (cantidadInput) cantidadInput.value = cantidadSeleccion;
      }
    });
  }

  // ── Botón Agregar a mi Reserva ──
  if (btnAgregarItem) {
    btnAgregarItem.addEventListener('click', () => {
      if (!productoActual) {
        showError('Por favor selecciona primero un modelo para agregarlo.', productoSelect);
        return;
      }
      agregarItemAReserva(productoActual, cantidadSeleccion);
    });
  }

  if (btnAgregarOtro) {
    btnAgregarOtro.addEventListener('click', () => {
      if (productoSelect) {
        productoSelect.value = '';
        productoSelect.focus();
      }
      if (productCardEmpty) productCardEmpty.classList.remove('hidden');
      if (productCardSelected) productCardSelected.classList.add('hidden');
      if (rapunzelVariantsContainer) rapunzelVariantsContainer.classList.add('hidden');
      productoActual = null;
      cantidadSeleccion = 1;
      if (cantidadInput) cantidadInput.value = '1';
      
      const p1Header = document.querySelector('#pedido-form h3');
      if (p1Header) p1Header.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  const CART_STORAGE_KEY = 'artesanitas_cart_v1';
  const CUSTOMER_STORAGE_KEY = 'artesanitas_customer_v1';

  function guardarCarritoLocalStorage() {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(itemsReserva));
    } catch (e) {}
  }

  function cargarCarritoLocalStorage() {
    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(item => item && item.slug && Number(item.cantidad) > 0 && item.modalidad !== 'compra_directa')
        .map(item => {
          const ref = CATALOGO_PREVENTA[ALIASES[item.slug] || item.slug];
          if (!ref && item.modalidad !== 'reserva') return null;
          const cant = Math.min(50, Math.max(1, parseInt(item.cantidad, 10) || 1));
          if (ref && !CATALOGO_PREVENTA[item.slug]) {
            CATALOGO_PREVENTA[item.slug] = ref;
          } else if (!ref && !CATALOGO_PREVENTA[item.slug]) {
            CATALOGO_PREVENTA[item.slug] = {
              slug: item.slug,
              nombre: item.nombre || item.slug,
              precio: Number(item.precio) || 59.90,
              reserva: Number(item.reserva) || 20.00,
              fecha: '10 de Diciembre',
              imagen: item.imagen || '/imagenes/Artesanitas/logo_artesanitas.peru.jpg',
              descripcion: item.descripcion || 'Pieza artesanal modelada y pintada a mano por Artesanitas Perú.'
            };
          }
          const finalProd = CATALOGO_PREVENTA[item.slug] || ref;
          return {
            slug: finalProd.slug,
            nombre: finalProd.nombre,
            precio: Number(finalProd.precio) || Number(item.precio) || 59.90,
            reserva: Number(finalProd.reserva) || Number(item.reserva) || 20.00,
            cantidad: cant,
            imagen: finalProd.imagen || item.imagen || '/imagenes/Artesanitas/logo_artesanitas.peru.jpg',
            descripcion: finalProd.descripcion || item.descripcion || ''
          };
        })
        .filter(Boolean);
    } catch (e) {
      return [];
    }
  }

  function guardarDatosClienteLocalStorage() {
    try {
      const nombreEl = document.getElementById('nombre-input');
      const whatsappEl = document.getElementById('whatsapp-input');
      const direccionEl = document.getElementById('direccion-input');
      const tipoEntrega = document.querySelector('input[name="tipo_entrega"]:checked')?.value || 'provincia';
      const payload = {
        nombre: nombreEl ? nombreEl.value : '',
        dni: dniInput ? dniInput.value : '',
        whatsapp: whatsappEl ? whatsappEl.value : '',
        tipo_entrega: tipoEntrega,
        sede_shalom: sedeShalomInput ? sedeShalomInput.value : '',
        direccion_adicional: direccionEl ? direccionEl.value : ''
      };
      localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {}
  }

  function hidratarDatosClienteLocalStorage() {
    try {
      const raw = localStorage.getItem(CUSTOMER_STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object') return;
      const nombreEl = document.getElementById('nombre-input');
      const whatsappEl = document.getElementById('whatsapp-input');
      const direccionEl = document.getElementById('direccion-input');
      if (nombreEl && data.nombre && !nombreEl.value) nombreEl.value = data.nombre;
      if (dniInput && data.dni && !dniInput.value) dniInput.value = String(data.dni).replace(/\D/g, '').slice(0, 8);
      if (whatsappEl && data.whatsapp && !whatsappEl.value) whatsappEl.value = data.whatsapp;
      if (sedeShalomInput && data.sede_shalom && !sedeShalomInput.value) sedeShalomInput.value = data.sede_shalom;
      if (direccionEl && data.direccion_adicional && !direccionEl.value) direccionEl.value = data.direccion_adicional;
      if (data.tipo_entrega === 'local' || data.tipo_entrega === 'provincia') {
        const targetRadio = document.querySelector(`input[name="tipo_entrega"][value="${data.tipo_entrega}"]`);
        if (targetRadio && !targetRadio.checked) {
          targetRadio.checked = true;
          targetRadio.dispatchEvent(new Event('change'));
        }
      }
    } catch (e) {}
  }

  function agregarItemAReserva(prod, cant) {
    const existingIndex = itemsReserva.findIndex(item => item.slug === prod.slug);
    if (existingIndex > -1) {
      itemsReserva[existingIndex].cantidad += cant;
    } else {
      itemsReserva.push({
        slug: prod.slug,
        nombre: prod.nombre,
        precio: Number(prod.precio) || 0,
        reserva: Number(prod.reserva) || 20.00,
        cantidad: cant,
        imagen: prod.imagen,
        descripcion: prod.descripcion || ''
      });
    }

    // Feedback visual animado en el botón
    if (btnAgregarItem && btnAgregarText) {
      const originalHtml = btnAgregarText.innerHTML;
      btnAgregarItem.classList.add('bg-[#007A78]', 'hover:bg-[#00635D]');
      btnAgregarItem.classList.remove('bg-[#B87352]', 'hover:bg-[#a36344]');
      btnAgregarText.textContent = '¡Agregado a tu Reserva!';
      setTimeout(() => {
        btnAgregarItem.classList.remove('bg-[#007A78]', 'hover:bg-[#00635D]');
        btnAgregarItem.classList.add('bg-[#B87352]', 'hover:bg-[#a36344]');
        btnAgregarText.innerHTML = originalHtml || 'Agregar a mi Reserva';
      }, 1400);
    }

    // Resetear stepper de inspección a 1
    cantidadSeleccion = 1;
    if (cantidadInput) cantidadInput.value = '1';

    guardarCarritoLocalStorage();
    renderItemsReserva();
    actualizarTotales();
    hideError();
  }

  function eliminarItem(slug) {
    itemsReserva = itemsReserva.filter(item => item.slug !== slug);
    guardarCarritoLocalStorage();
    renderItemsReserva();
    actualizarTotales();
  }

  function modificarCantidadItem(slug, delta) {
    const item = itemsReserva.find(i => i.slug === slug);
    if (!item) return;
    item.cantidad += delta;
    if (item.cantidad <= 0) {
      eliminarItem(slug);
    } else {
      if (item.cantidad > 50) item.cantidad = 50;
      guardarCarritoLocalStorage();
      renderItemsReserva();
      actualizarTotales();
    }
  }

  function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  // ── Renderizado del Carrito de Piezas Seleccionadas ──
  function renderItemsReserva() {
    if (!listaItemsReserva || !itemsReservaContainer) return;

    if (itemsReserva.length === 0) {
      itemsReservaContainer.classList.add('hidden');
      if (listaItemsReserva) listaItemsReserva.innerHTML = '';
      if (desgloseItemsLista) desgloseItemsLista.innerHTML = '<p class="text-xs text-[#8C7A6B] italic">No has seleccionado ninguna pieza aún.</p>';
      return;
    }

    itemsReservaContainer.classList.remove('hidden');

    const totalPiezas = itemsReserva.reduce((sum, item) => sum + item.cantidad, 0);
    if (badgeTotalPiezas) badgeTotalPiezas.textContent = `${totalPiezas} ${totalPiezas === 1 ? 'pieza' : 'piezas'}`;
    if (cartTotalPiezasTxt) cartTotalPiezasTxt.textContent = totalPiezas;
    if (desgloseTotalPiezasTxt) desgloseTotalPiezasTxt.textContent = `${totalPiezas} ${totalPiezas === 1 ? 'pieza' : 'piezas'}`;

    // 1. Render en Paso 1 (Lista interactiva de piezas agregadas)
    listaItemsReserva.innerHTML = itemsReserva.map(item => `
      <div class="flex items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-[#EBE5DE] shadow-2xs hover:border-[#D5C9BD] transition-all">
        <div class="flex items-center gap-3 min-w-0">
          <img src="${escapeHtml(item.imagen)}" alt="${escapeHtml(item.nombre)}"
            class="w-12 h-12 rounded-xl object-cover border border-[#EBE5DE] shrink-0 bg-[#F9F6F0]">
          <div class="min-w-0">
            <h5 class="text-xs sm:text-sm font-bold text-[#4A3C31] leading-snug truncate" title="${escapeHtml(item.nombre)}">
              ${escapeHtml(item.nombre)}
            </h5>
            <span class="text-[11px] text-[#8C7A6B] block">S/ ${item.precio.toFixed(2)} c/u</span>
          </div>
        </div>

        <div class="flex items-center gap-2 sm:gap-3 shrink-0">
          <!-- Mini Stepper (- 1 +) -->
          <div class="flex items-center bg-[#F9F6F0] rounded-xl border border-[#D5C9BD] p-0.5 shadow-2xs">
            <button type="button" class="btn-item-menos w-6 h-6 rounded-lg bg-white hover:bg-[#B87352] hover:text-white text-[#4A3C31] font-bold text-xs flex items-center justify-center transition-all cursor-pointer select-none"
              data-slug="${escapeHtml(item.slug)}" aria-label="Disminuir">
              −
            </button>
            <span class="w-6 sm:w-7 text-center font-bold text-xs text-[#4A3C31] select-none">
              ${item.cantidad}
            </span>
            <button type="button" class="btn-item-mas w-6 h-6 rounded-lg bg-white hover:bg-[#B87352] hover:text-white text-[#4A3C31] font-bold text-xs flex items-center justify-center transition-all cursor-pointer select-none"
              data-slug="${escapeHtml(item.slug)}" aria-label="Aumentar">
              +
            </button>
          </div>

          <div class="text-right min-w-[62px]">
            <span class="text-xs font-bold text-[#B87352] block">
              S/ ${(item.precio * item.cantidad).toFixed(2)}
            </span>
            <span class="text-[10px] text-[#007A78] font-medium block">
              Res: S/ ${(item.reserva * item.cantidad).toFixed(2)}
            </span>
          </div>

          <!-- Botón Eliminar -->
          <button type="button" class="btn-item-eliminar p-1.5 rounded-lg text-[#8C7A6B] hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
            data-slug="${escapeHtml(item.slug)}" title="Quitar pieza">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4">
              <path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      </div>
    `).join('');

    // Eventos de botones en lista Paso 1
    listaItemsReserva.querySelectorAll('.btn-item-menos').forEach(btn => {
      btn.addEventListener('click', () => modificarCantidadItem(btn.dataset.slug, -1));
    });
    listaItemsReserva.querySelectorAll('.btn-item-mas').forEach(btn => {
      btn.addEventListener('click', () => modificarCantidadItem(btn.dataset.slug, 1));
    });
    listaItemsReserva.querySelectorAll('.btn-item-eliminar').forEach(btn => {
      btn.addEventListener('click', () => eliminarItem(btn.dataset.slug));
    });

    // 2. Render en Paso 3 (Desglose final transparente)
    if (desgloseItemsLista) {
      desgloseItemsLista.innerHTML = itemsReserva.map(item => `
        <div class="flex items-center justify-between text-xs text-[#4A3C31] bg-white p-2.5 rounded-xl border border-[#EBE5DE]">
          <div class="flex items-center gap-2 min-w-0">
            <img src="${escapeHtml(item.imagen)}" alt="${escapeHtml(item.nombre)}" class="w-7 h-7 rounded-lg object-cover border border-[#EBE5DE] shrink-0 bg-[#F9F6F0]">
            <span class="font-medium truncate">
              <strong>${item.cantidad}x</strong> ${escapeHtml(item.nombre)}
            </span>
          </div>
          <span class="font-bold text-[#B87352] shrink-0 ml-2">
            S/ ${(item.precio * item.cantidad).toFixed(2)}
          </span>
        </div>
      `).join('');
    }
  }

  // ── Cálculo Global y Reactivo de Totales ──
  function actualizarTotales() {
    const totalPiezas = itemsReserva.reduce((sum, item) => sum + item.cantidad, 0);
    const subtotal = itemsReserva.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
    const totalReserva = itemsReserva.reduce((sum, item) => sum + (item.reserva * item.cantidad), 0);
    const saldoTotal = Math.max(0, subtotal - totalReserva);

    // Badges en cabecera de Paso 1 y Resumen
    const badgeReserva = document.getElementById('badge-reserva-plin');
    if (badgeReserva) {
      if (totalPiezas > 0) {
        badgeReserva.textContent = `Reserva con S/ ${totalReserva.toFixed(2)} por Plin`;
      } else {
        badgeReserva.textContent = 'Reserva con S/ 20 por Plin';
      }
    }

    if (cartTotalReservaTxt) {
      cartTotalReservaTxt.textContent = `S/ ${totalReserva.toFixed(2)}`;
    }

    // Desglose de Paso 3
    if (desgloseSubtotalTxt) {
      desgloseSubtotalTxt.textContent = `S/ ${subtotal.toFixed(2)}`;
    }
    if (desgloseSaldoTxt) {
      desgloseSaldoTxt.textContent = `S/ ${saldoTotal.toFixed(2)} (al entregar)`;
    }
    if (desgloseReservaTxt) {
      desgloseReservaTxt.textContent = `S/ ${totalReserva.toFixed(2)}`;
    }

    // Labels de Plin y QR
    const labelComprobante = document.getElementById('label-comprobante-plin');
    if (labelComprobante) {
      if (totalReserva > 0) {
        labelComprobante.innerHTML = `Adjunta tu Comprobante de Plin (S/ ${totalReserva.toFixed(2)}) <span class="text-red-500">*</span>`;
      } else {
        labelComprobante.innerHTML = `Adjunta tu Comprobante de Plin <span class="text-red-500">*</span>`;
      }
    }

    const qrMontoTxt = document.getElementById('qr-monto-reserva-txt');
    if (qrMontoTxt) {
      qrMontoTxt.textContent = totalReserva > 0 ? `S/ ${totalReserva.toFixed(2)}` : 'S/ 20.00';
    }

    const dropzoneHint = document.getElementById('dropzone-hint-txt');
    if (dropzoneHint) {
      dropzoneHint.textContent = totalReserva > 0 
        ? `Captura de Plin por S/ ${totalReserva.toFixed(2)} (JPG, PNG hasta 5MB)`
        : `Captura de Plin (JPG, PNG hasta 5MB)`;
    }
  }

  // ── Restricción DNI 8 dígitos numéricos en tiempo real ──
  if (dniInput) {
    dniInput.addEventListener('input', () => {
      dniInput.value = dniInput.value.replace(/\D/g, '').slice(0, 8);
    });
  }

  // ── Selección y Render de Producto en Inspección ──
  function seleccionarProducto(slug) {
    const key = ALIASES[slug] || slug;
    const prod = CATALOGO_PREVENTA[key];
    if (!prod) return;

    productoActual = prod;
    cantidadSeleccion = 1;
    if (cantidadInput) cantidadInput.value = '1';

    const isRapunzelVariant = prod.slug.startsWith('taza-rapunzel');
    
    // Sincronizar select nativo (los 4 productos principales)
    if (productoSelect) {
      productoSelect.value = isRapunzelVariant ? 'taza-rapunzel' : prod.slug;
    }

    // Actualizar tarjeta visual
    if (previewProductImg) {
      previewProductImg.src = prod.imagen;
      previewProductImg.alt = prod.nombre;
    }
    if (previewProductTitle) previewProductTitle.textContent = prod.nombre;
    if (previewProductDesc) previewProductDesc.textContent = prod.descripcion;
    if (previewProductPrice) previewProductPrice.textContent = `S/ ${prod.precio.toFixed(2)}`;

    const previewProductCategory = document.getElementById('preview-product-category');
    const previewTagBadge = document.getElementById('preview-tag-badge');

    // ── Clasificación visual y descripción del acabado en primer plano ──
    let categoryText = 'Cerámica Artesanal';
    let tagBadgeText = 'Foto Real en Primer Plano';

    if (prod.slug.includes('sin-plato')) {
      tagBadgeText = 'Color Entero · Sin Plato';
      categoryText = 'Colección Rapunzel · Sin Plato';
    } else if (prod.slug.includes('lineas-plato')) {
      tagBadgeText = 'Set Exclusivo · Líneas + Plato';
      categoryText = 'Colección Rapunzel · Set Completo';
    } else if (prod.slug.includes('lineas')) {
      tagBadgeText = 'Relieve · Con Líneas';
      categoryText = 'Colección Rapunzel · Acabado Texturizado';
    } else if (prod.slug.includes('plato')) {
      tagBadgeText = 'Set Artesanal · Taza + Plato';
      categoryText = 'Colección Rapunzel · Set con Platito';
    } else if (prod.slug === 'taza-stich') {
      tagBadgeText = 'Edición Ohana · Taza Artesanal';
      categoryText = 'Edición Especial Stich';
    } else if (prod.slug === 'taza-van-gogh') {
      tagBadgeText = 'Noche Estrellada · Arte Cerámico';
      categoryText = 'Colección Grandes Maestros';
    } else if (prod.slug === 'azucarera-van-gogh') {
      tagBadgeText = 'Azucarera Artesanal · Colección Van Gogh';
      categoryText = 'Colección Grandes Maestros';
    } else if (prod.slug === 'vasito-van-gogh') {
      tagBadgeText = 'Vasito de Cerámica · Colección Van Gogh';
      categoryText = 'Colección Grandes Maestros';
            } else if (prod.slug === 'taza-muneco-de-nieve') {
      tagBadgeText = 'Edición Navidad · Muñeco de Nieve';
      categoryText = 'Colección Navidad 2026';
    } else if (prod.slug === 'taza-navidad') {
      tagBadgeText = 'Edición Especial Navidad';
      categoryText = 'Colección Navidad 2026';
        } else if (prod.slug === 'taza-muneco-de-nieve') {
      tagBadgeText = 'Edición Navidad · Muñeco de Nieve';
      categoryText = 'Colección Navidad 2026';
    } else if (prod.slug === 'taza-navidad-1') {
      tagBadgeText = 'Edición Especial Navidad · Modelo 1';
      categoryText = 'Colección Navidad 2026';
    } else if (prod.slug === 'taza-navidad-2') {
      tagBadgeText = 'Edición Especial Navidad · Modelo 2';
      categoryText = 'Colección Navidad 2026';
        } else if (prod.slug === 'taza-navidad-papa-noel') {
      tagBadgeText = 'Edición Navidad · Papá Noel';
      categoryText = 'Colección Navidad 2026';
    } else if (prod.slug === 'taza-muneco-de-nieve') {
      tagBadgeText = 'Edición Navidad · Muñeco de Nieve';
      categoryText = 'Colección Navidad 2026';
    } else if (prod.slug === 'taza-arbolito-chocolatosa') {
      tagBadgeText = 'Edición Navidad · Arbolito Chocolatosa';
      categoryText = 'Colección Navidad 2026';
    } else if (prod.slug === 'taza-arbolito-rosa') {
      tagBadgeText = 'Edición Navidad · Arbolito Rosa';
      categoryText = 'Colección Navidad 2026';
    } else if (prod.slug === 'taza-piston-cup') {
      tagBadgeText = 'Copa Pistón · Edición Cars';
      categoryText = 'Colección Dinámica';
    }

    if (previewProductCategory) previewProductCategory.textContent = categoryText;
    if (previewTagBadge) previewTagBadge.textContent = tagBadgeText;

    if (productCardEmpty) productCardEmpty.classList.add('hidden');
    if (productCardSelected) productCardSelected.classList.remove('hidden');

    // Mostrar / ocultar variantes de Rapunzel si corresponde
    if (isRapunzelVariant) {
      if (rapunzelVariantsContainer) rapunzelVariantsContainer.classList.remove('hidden');
      const allVariantBtns = document.querySelectorAll('.btn-rapunzel-variant');
      allVariantBtns.forEach(btn => {
        const isMatch = btn.dataset.variant === prod.slug;
        btn.classList.toggle('border-[#B87352]', isMatch);
        btn.classList.toggle('bg-[#B87352]/10', isMatch);
        btn.classList.toggle('ring-2', isMatch);
        btn.classList.toggle('ring-[#B87352]/50', isMatch);
        btn.classList.toggle('shadow-sm', isMatch);
        btn.classList.toggle('border-[#D5C9BD]', !isMatch);
        btn.classList.toggle('bg-white', !isMatch);
      });
    } else {
      if (rapunzelVariantsContainer) rapunzelVariantsContainer.classList.add('hidden');
    }

    // Auto-agregar el primer producto si la lista de reserva está vacía para máxima comodidad
    if (itemsReserva.length === 0) {
      agregarItemAReserva(prod, 1);
    }

    hideError();
  }

  // Eventos botones de variantes Rapunzel
  document.querySelectorAll('.btn-rapunzel-variant').forEach(btn => {
    btn.addEventListener('click', () => {
      seleccionarProducto(btn.dataset.variant);
    });
  });

  // ── Lightbox HD Modal ──
  const modalLightbox = document.getElementById('modal-lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxTitle = document.getElementById('lightbox-title');
  const lightboxDesc = document.getElementById('lightbox-desc');
  const lightboxPrice = document.getElementById('lightbox-price');
  const lightboxBadge = document.getElementById('lightbox-badge');
  const btnCloseLightbox = document.getElementById('btn-close-lightbox');
  const btnOpenLightbox = document.getElementById('btn-open-lightbox');

  function openLightbox() {
    if (!productoActual || !modalLightbox) return;
    if (lightboxImg) lightboxImg.src = productoActual.imagen;
    if (lightboxTitle) lightboxTitle.textContent = productoActual.nombre;
    if (lightboxDesc) lightboxDesc.textContent = productoActual.descripcion;
    if (lightboxPrice) lightboxPrice.textContent = `S/ ${productoActual.precio.toFixed(2)}`;

    let tagBadgeText = 'Foto Real en Primer Plano';
    if (productoActual.slug.includes('sin-plato')) tagBadgeText = 'Color Entero · Sin Plato';
    else if (productoActual.slug.includes('lineas-plato')) tagBadgeText = 'Set Exclusivo · Líneas + Plato';
    else if (productoActual.slug.includes('lineas')) tagBadgeText = 'Relieve · Con Líneas';
    else if (productoActual.slug.includes('plato')) tagBadgeText = 'Set Artesanal · Taza + Plato';
    else if (productoActual.slug === 'taza-stich') tagBadgeText = 'Edición Ohana';
    else if (productoActual.slug === 'taza-van-gogh') tagBadgeText = 'Noche Estrellada';
    else if (productoActual.slug === 'azucarera-van-gogh') tagBadgeText = 'Azucarera Van Gogh';
    else if (productoActual.slug === 'vasito-van-gogh') tagBadgeText = 'Vasito Van Gogh';
        
                else if (productoActual.slug === 'taza-navidad-papa-noel') tagBadgeText = 'Edición Papá Noel';
    else if (productoActual.slug === 'taza-muneco-de-nieve') tagBadgeText = 'Edición Muñeco de Nieve';
    else if (productoActual.slug === 'taza-arbolito-chocolatosa') tagBadgeText = 'Edición Arbolito Chocolatosa';
    else if (productoActual.slug === 'taza-arbolito-rosa') tagBadgeText = 'Edición Arbolito Rosa';
    else if (productoActual.slug === 'taza-piston-cup') tagBadgeText = 'Copa Pistón';

    if (lightboxBadge) lightboxBadge.textContent = tagBadgeText;

    modalLightbox.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    if (!modalLightbox) return;
    modalLightbox.classList.add('hidden');
    document.body.style.overflow = '';
  }

  if (btnOpenLightbox) btnOpenLightbox.addEventListener('click', openLightbox);
  if (btnCloseLightbox) btnCloseLightbox.addEventListener('click', closeLightbox);
  if (modalLightbox) {
    modalLightbox.addEventListener('click', (e) => {
      if (e.target === modalLightbox) closeLightbox();
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalLightbox && !modalLightbox.classList.contains('hidden')) {
      closeLightbox();
    }
  });

  // Evento Select Nativo
  if (productoSelect) {
    productoSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val === 'taza-rapunzel') {
        seleccionarProducto('taza-rapunzel-morada-sin-plato');
      } else {
        seleccionarProducto(val);
      }
    });
  }

  // ── Selección de Tipo de Entrega ──
  radioEntregas.forEach(radio => {
    radio.addEventListener('change', () => {
      const val = radio.value;
      const isProvincia = (val === 'provincia');

      if (optProvincia) {
        optProvincia.classList.toggle('border-[#B87352]', isProvincia);
        optProvincia.classList.toggle('bg-[#F9F6F0]', isProvincia);
        optProvincia.classList.toggle('border-[#EBE5DE]', !isProvincia);
        optProvincia.classList.toggle('bg-white', !isProvincia);
      }
      if (optLocal) {
        optLocal.classList.toggle('border-[#B87352]', !isProvincia);
        optLocal.classList.toggle('bg-[#F9F6F0]', !isProvincia);
        optLocal.classList.toggle('border-[#EBE5DE]', isProvincia);
        optLocal.classList.toggle('bg-white', isProvincia);
      }

      if (shalomFieldsContainer) shalomFieldsContainer.classList.toggle('hidden', !isProvincia);
      if (tallerInfoContainer) tallerInfoContainer.classList.toggle('hidden', isProvincia);

      if (sedeShalomInput) {
        if (isProvincia) {
          sedeShalomInput.setAttribute('required', 'true');
        } else {
          sedeShalomInput.removeAttribute('required');
        }
      }

      if (desgloseEnvioTxt) {
        desgloseEnvioTxt.textContent = isProvincia ? 'S/ 10.00 (Delivery Shalom)' : 'S/ 0.00 (Recojo en Taller Trujillo)';
      }
      if (previewEntregaTxt) {
        previewEntregaTxt.innerHTML = isProvincia ? '<strong>Envío:</strong> Shalom Provincia' : '<strong>Recojo:</strong> Taller Trujillo (Gratis)';
      }
    });
  });

  function showError(msg, targetEl) {
    if (formError) {
      formError.textContent = msg;
      formError.classList.remove('hidden');
      formError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    if (targetEl) {
      try {
        targetEl.focus();
      } catch (e) {}
    }
  }
  function hideError() {
    if (formError) formError.classList.add('hidden');
  }

  // ── Copiar Número de Plin con 1 Clic ──
  if (btnCopyNumber) {
    btnCopyNumber.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText('923282069');
        if (copyText) copyText.textContent = '¡Copiado!';
        btnCopyNumber.classList.add('bg-[#00635D]');
        setTimeout(() => {
          if (copyText) copyText.textContent = 'Copiar';
          btnCopyNumber.classList.remove('bg-[#00635D]');
        }, 2000);
      } catch (err) {
        const temp = document.createElement('input');
        temp.value = '923282069';
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        document.body.removeChild(temp);
        if (copyText) copyText.textContent = '¡Copiado!';
        setTimeout(() => {
          if (copyText) copyText.textContent = 'Copiar';
        }, 2000);
      }
    });
  }

  // ── Toggle Visualizador de QR ──
  if (btnToggleQr && qrContainer) {
    btnToggleQr.addEventListener('click', () => {
      const isHidden = qrContainer.classList.contains('hidden');
      qrContainer.classList.toggle('hidden', !isHidden);
      if (qrChevron) {
        qrChevron.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
      }
    });
  }

  // ── Manejo de Comprobante (Dropzone) ──
  if (dropzoneArea && comprobanteInput) {
    dropzoneArea.addEventListener('click', (e) => {
      if (e.target !== btnChangeFile && !btnChangeFile?.contains(e.target)) {
        comprobanteInput.click();
      }
    });

    if (btnChangeFile) {
      btnChangeFile.addEventListener('click', (e) => {
        e.stopPropagation();
        comprobanteInput.click();
      });
    }

    dropzoneArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzoneArea.classList.add('border-[#007A78]', 'bg-[#007A78]/5');
    });

    dropzoneArea.addEventListener('dragleave', () => {
      dropzoneArea.classList.remove('border-[#007A78]', 'bg-[#007A78]/5');
    });

    dropzoneArea.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzoneArea.classList.remove('border-[#007A78]', 'bg-[#007A78]/5');
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
      showError('El comprobante no debe pesar más de 5MB.', dropzoneArea);
      if (comprobanteInput) comprobanteInput.value = '';
      return;
    }
    hideError();

    const fileNameTxt = document.getElementById('file-name-txt');
    const fileSizeTxt = document.getElementById('file-size-txt');
    const filePreviewImg = document.getElementById('file-preview-img');
    const dropzoneEmptyState = document.getElementById('dropzone-empty-state');

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

  // ── Generador y Descarga Automática de Comprobante / Orden de Compra (PDF / Imprimible) ──
  let ultimoPedidoRegistrado = null;

  function generarComprobanteCompraPDF(pedido, autoPrint) {
    if (!pedido) return;
    const win = window.open('', '_blank', 'width=820,height=920');
    if (!win) return;

    const items = Array.isArray(pedido.items) ? pedido.items : [];
    const esPagoCompleto = pedido.estado_pago === 'completo' || Number(pedido.monto_pagado) >= Number(pedido.precio_total);
    const fechaEmision = new Date(pedido.created_at || Date.now()).toLocaleString('es-PE', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    const subtotal = Number(pedido.precio_total || 0);
    const envio = Number(pedido.costo_envio || 0);
    const pagadoHoy = Number(pedido.monto_pagado || 0);
    const saldo = Math.max(0, (subtotal + (esPagoCompleto ? envio : 0)) - pagadoHoy);

    const rowsHtml = items.map(it => {
      const sub = (Number(it.precio || 0) * Number(it.cantidad || 1)).toFixed(2);
      const mod = (it.modalidad === 'compra_directa' || Number(it.reserva) >= Number(it.precio)) ? 'Compra Directa (100%)' : 'Preventa (Reserva S/ 20)';
      return '<tr>' +
        '<td style="padding:10px;border-bottom:1px solid #EBE5DE;"><strong>' + escapeHtml(it.nombre || '') + '</strong><br><span style="font-size:11px;color:#8C7A6B;font-family:monospace;">' + (it.sku ? 'SKU: ' + escapeHtml(it.sku) + ' · ' : '') + mod + '</span></td>' +
        '<td style="padding:10px;border-bottom:1px solid #EBE5DE;text-align:center;font-weight:bold;">' + Number(it.cantidad || 1) + '</td>' +
        '<td style="padding:10px;border-bottom:1px solid #EBE5DE;text-align:right;">S/ ' + Number(it.precio || 0).toFixed(2) + '</td>' +
        '<td style="padding:10px;border-bottom:1px solid #EBE5DE;text-align:right;font-weight:bold;">S/ ' + sub + '</td>' +
        '</tr>';
    }).join('');

    win.document.write('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Comprobante ' + escapeHtml(pedido.codigo_pedido) + ' - Artesanitas Perú</title>');
    win.document.write('<style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#4A3C31;background:#F9F6F0;margin:0;padding:24px;}.card{max-width:680px;margin:0 auto;background:#fff;border:1px solid #D5C9BD;border-radius:20px;padding:32px;box-shadow:0 10px 25px rgba(74,60,49,0.06);}.badge{display:inline-block;background:#007A78;color:#fff;font-size:11px;font-weight:800;padding:4px 10px;border-radius:99px;text-transform:uppercase;letter-spacing:0.05em;}table{width:100%;border-collapse:collapse;margin-top:16px;font-size:13px;}th{background:#F1EDE7;color:#8C7A6B;text-transform:uppercase;font-size:11px;padding:10px;text-align:left;}@media print{body{background:#fff;padding:0;}.card{box-shadow:none;border:none;}.no-print{display:none!important;}}</style></head><body>');
    win.document.write('<div class="card">');
    win.document.write('<div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #EBE5DE;padding-bottom:18px;">');
    win.document.write('<div><h1 style="margin:0;font-size:24px;color:#4A3C31;">Artesanitas Perú</h1><p style="margin:4px 0 0;font-size:12px;color:#8C7A6B;">Cerámica Artesanal Hecha a Mano · Trujillo, Perú</p><p style="margin:2px 0 0;font-size:11px;color:#8C7A6B;">Web: artesanitas.lospilares.pe · WhatsApp: +51 929 938 466</p></div>');
    win.document.write('<div style="text-align:right;"><span class="badge">' + (esPagoCompleto ? 'Comprobante Compra Directa' : 'Comprobante de Reserva') + '</span><p style="margin:8px 0 2px;font-family:monospace;font-size:18px;font-weight:900;color:#B87352;">' + escapeHtml(pedido.codigo_pedido) + '</p><p style="margin:0;font-size:11px;color:#8C7A6B;">' + escapeHtml(fechaEmision) + '</p></div>');
    win.document.write('</div>');
    win.document.write('<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;background:#F9F6F0;padding:16px;border-radius:14px;margin-top:18px;font-size:12px;">');
    win.document.write('<div><strong style="color:#8C7A6B;text-transform:uppercase;font-size:10px;">Datos del Cliente:</strong><p style="margin:4px 0 2px;font-weight:bold;font-size:14px;">' + escapeHtml(pedido.nombre || '') + '</p><p style="margin:0;color:#8C7A6B;">DNI: ' + escapeHtml(pedido.dni || '') + ' · Tel: ' + escapeHtml(pedido.whatsapp || '') + '</p></div>');
    win.document.write('<div><strong style="color:#8C7A6B;text-transform:uppercase;font-size:10px;">Modalidad de Entrega:</strong><p style="margin:4px 0 2px;font-weight:bold;">' + (pedido.tipo_entrega === 'provincia' ? 'Envío Nacional por Agencia Shalom' : 'Recojo en Taller Trujillo') + '</p><p style="margin:0;color:#8C7A6B;">Destino: ' + escapeHtml(pedido.sede_shalom || 'Taller Trujillo') + '</p></div>');
    win.document.write('</div>');
    win.document.write('<table><thead><tr><th>Descripción de Pieza / SKU</th><th style="text-align:center;">Cant.</th><th style="text-align:right;">P. Unit</th><th style="text-align:right;">Subtotal</th></tr></thead><tbody>' + rowsHtml + '</tbody></table>');
    win.document.write('<div style="margin-top:20px;border-top:2px solid #EBE5DE;padding-top:16px;display:flex;justify-content:space-between;align-items:flex-start;">');
    win.document.write('<div style="font-size:11px;color:#007A78;background:#007A7812;padding:10px 14px;border-radius:12px;max-width:320px;"><strong>✓ Descarga de Inventario Automática:</strong><br>Las unidades de tu pedido han sido descontadas y asignadas automáticamente en nuestro almacén con el código <strong>' + escapeHtml(pedido.codigo_pedido) + '</strong>.</div>');
    win.document.write('<div style="text-align:right;font-size:13px;min-width:220px;">');
    win.document.write('<div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span style="color:#8C7A6B;">Valor de las piezas:</span><strong>S/ ' + subtotal.toFixed(2) + '</strong></div>');
    if (envio > 0) {
      win.document.write('<div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span style="color:#8C7A6B;">Envío Agencia Shalom:</span><strong>S/ ' + envio.toFixed(2) + '</strong></div>');
    }
    win.document.write('<div style="display:flex;justify-content:space-between;margin-bottom:6px;color:#007A78;font-size:15px;"><span><strong>Abonado Hoy:</strong></span><strong>S/ ' + pagadoHoy.toFixed(2) + '</strong></div>');
    win.document.write('<div style="display:flex;justify-content:space-between;color:#B87352;"><span>Saldo pendiente:</span><strong>S/ ' + saldo.toFixed(2) + '</strong></div>');
    win.document.write('</div></div>');
    win.document.write('<div class="no-print" style="margin-top:24px;text-align:center;"><button onclick="window.print()" style="background:#4A3C31;color:#fff;border:none;padding:12px 24px;border-radius:12px;font-weight:bold;cursor:pointer;">Guardar como PDF / Imprimir Comprobante</button></div>');
    win.document.write('</div></body></html>');
    win.document.close();
    if (autoPrint) {
      setTimeout(function () { win.focus(); win.print(); }, 450);
    }
  }

  // ── Envío del Formulario ──
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideError();

      // Si no hay items en el carrito pero el usuario tiene un producto visualizado, agregarlo automáticamente
      if (itemsReserva.length === 0 && productoActual) {
        agregarItemAReserva(productoActual, cantidadSeleccion || 1);
      }

      if (itemsReserva.length === 0) {
        showError('Por favor, selecciona al menos un producto para tu reserva.', productoSelect);
        return;
      }

      const tipoEntrega = document.querySelector('input[name="tipo_entrega"]:checked')?.value || 'local';
      const nombreInput = document.getElementById('nombre-input');
      const nombre = nombreInput ? nombreInput.value.trim() : '';
      const dni = dniInput ? dniInput.value.trim() : '';
      const whatsappInput = document.getElementById('whatsapp-input');
      const whatsapp = whatsappInput ? whatsappInput.value.trim() : '';
      const sedeShalom = sedeShalomInput ? sedeShalomInput.value.trim() : '';
      const direccion = document.getElementById('direccion-input')?.value.trim() || '';
      const file = comprobanteInput ? comprobanteInput.files[0] : null;

      if (!nombre) return showError('Por favor, ingresa tu nombre completo.', nombreInput);
      if (!dni || dni.length !== 8) return showError('Por favor, ingresa un DNI válido de exactamente 8 dígitos.', dniInput);
      if (!whatsapp || whatsapp.length < 8) return showError('Por favor, ingresa tu número de WhatsApp.', whatsappInput);
      if (tipoEntrega === 'provincia' && (!sedeShalom || sedeShalom.length < 3)) {
        return showError('Por favor, indica la sede de Shalom para el envío a provincia.', sedeShalomInput);
      }
      if (!file) return showError('Por favor, adjunta la captura de tu pago de reserva por Plin.', dropzoneArea);

      const totalPiezas = itemsReserva.reduce((sum, item) => sum + item.cantidad, 0);
      const totalReservaVal = itemsReserva.reduce((sum, item) => sum + (item.reserva * item.cantidad), 0);

      const formData = new FormData();
      formData.append('items', JSON.stringify(itemsReserva));
      formData.append('producto_slug', itemsReserva[0].slug);
      formData.append('cantidad', totalPiezas);
      formData.append('tipo_entrega', tipoEntrega);
      formData.append('nombre', nombre);
      formData.append('dni', dni);
      formData.append('whatsapp', whatsapp);
      if (tipoEntrega === 'provincia') {
        formData.append('sede_shalom', sedeShalom);
      } else {
        formData.append('sede_shalom', 'Recojo en Local (Taller Trujillo)');
      }
      if (direccion) formData.append('direccion_adicional', direccion);
      formData.append('comprobante', file);

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `
          <svg class="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Registrando reserva...</span>
        `;
      }

      try {
        const res = await fetch(`/api/negocios/${NEGOCIO}/pedidos`, {
          method: 'POST',
          body: formData
        });
        const data = await res.json();

        if (res.ok && data.success) {
          const codPedido = data.pedido && data.pedido.codigo_pedido ? data.pedido.codigo_pedido : '';
          const metaEventId = data.meta_event_id || codPedido;
          if (typeof fbq === 'function') {
            fbq(
              'trackSingle',
              '851775257895823',
              'Purchase',
              { value: totalReservaVal, currency: 'PEN', content_ids: itemsReserva.map(i => i.slug), content_type: 'product' },
              { eventID: metaEventId }
            );
          }
          if (data.message && successMessage) successMessage.textContent = data.message;
          const trackingBox = document.getElementById('success-tracking-box');
          const codEl = document.getElementById('success-codigo-pedido');
          const btnTracking = document.getElementById('btn-success-tracking');
          if (codPedido) {
            if (codEl) codEl.textContent = codPedido;
            if (trackingBox) trackingBox.classList.remove('hidden');
            if (btnTracking) btnTracking.href = `/seguimiento?codigo=${encodeURIComponent(codPedido)}`;
          }

          const itemsSummary = itemsReserva.map(i => `${i.cantidad > 1 ? `${i.cantidad}x ` : ''}${i.nombre}`).join(', ');
          if (btnSuccessWhatsapp) {
            const codTxt = codPedido ? ` (Código: ${codPedido})` : '';
            btnSuccessWhatsapp.href = `https://wa.me/51929938466?text=${encodeURIComponent(`Hola! Acabo de reservar en preventa desde la web${codTxt}: ${itemsSummary}. Mi nombre es ${nombre}.`)}`;
          }

          ultimoPedidoRegistrado = data.pedido;
          const btnPdf = document.getElementById('btn-descargar-comprobante-pdf');
          if (btnPdf) {
            btnPdf.onclick = () => generarComprobanteCompraPDF(ultimoPedidoRegistrado, true);
          }
          // Descarga / apertura automática del comprobante oficial de compra
          setTimeout(() => generarComprobanteCompraPDF(ultimoPedidoRegistrado, true), 400);

          // Limpiar carrito persistente tras registrar la reserva con éxito
          itemsReserva = [];
          try {
            localStorage.removeItem(CART_STORAGE_KEY);
          } catch (e) {}

          form.classList.add('hidden');
          if (successState) successState.classList.remove('hidden');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          showError(data.message || 'Ocurrió un error. Intenta de nuevo.');
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              <span>Confirmar Reserva de Pedido</span>
            `;
          }
        }
      } catch (err) {
        showError('Error de conexión. Intenta de nuevo.');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            <span>Confirmar Reserva de Pedido</span>
          `;
        }
      }
    });
  }

  // ── Hidratación de Carrito Persistente (Sprint 1: LocalStorage) + Parámetro URL (?producto=...) ──
  ['nombre-input', 'dni-input', 'whatsapp-input', 'sede-shalom-input', 'direccion-input'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', guardarDatosClienteLocalStorage);
  });
  radioEntregas.forEach(r => r.addEventListener('change', guardarDatosClienteLocalStorage));
  hidratarDatosClienteLocalStorage();

  const storedCart = cargarCarritoLocalStorage();
  if (storedCart.length > 0) {
    itemsReserva = storedCart;
    renderItemsReserva();
    actualizarTotales();
  }

  // Cargar únicamente los productos dinámicos que pertenezcan a Colecciones de Reserva (Navidad, Rapunzel, Van Gogh)
  fetch(`/api/negocios/${NEGOCIO}/productos`)
    .then(r => r.ok ? r.json() : { productos: [] })
    .then(data => {
      const lista = (data && data.productos) || [];
      const optgroupNav = document.getElementById('optgroup-coleccion-navidad');
      const optgroupPrev = document.getElementById('optgroup-colecciones-preventa');
      lista.forEach(p => {
        if (!p || !p.slug) return;
        const col = String(p.coleccion || '').toLowerCase();
        const esNavidad = /navid/i.test(col) || p.slug.startsWith('taza-navidad');
        const esOtraReserva = /rapunzel|van\s*gogh/i.test(col) || p.slug.startsWith('taza-rapunzel') || Boolean(CATALOGO_PREVENTA[p.slug]);
        if (!esNavidad && !esOtraReserva) return;

        const precioFinal = (p.precio_oferta && Number(p.precio_oferta) > 0 && Number(p.precio_oferta) < Number(p.precio))
          ? Number(p.precio_oferta)
          : Number(p.precio);
        if (!CATALOGO_PREVENTA[p.slug]) {
          CATALOGO_PREVENTA[p.slug] = {
            slug: p.slug,
            nombre: p.nombre,
            precio: precioFinal || 59.90,
            reserva: 20.00,
            fecha: '10 de Diciembre',
            imagen: (Array.isArray(p.imagenes) && p.imagenes[0]) || '/imagenes/Artesanitas/logo_artesanitas.peru.jpg',
            descripcion: p.descripcion || 'Pieza artesanal modelada y pintada a mano.'
          };
        }
        const targetGroup = esNavidad ? optgroupNav : optgroupPrev;
        if (targetGroup && !productoSelect?.querySelector(`option[value="${p.slug}"]`)) {
          const opt = document.createElement('option');
          opt.value = p.slug;
          opt.textContent = `${p.nombre} (S/ ${(precioFinal || 59.90).toFixed(2)})`;
          targetGroup.appendChild(opt);
        }
      });

      const params = new URLSearchParams(window.location.search);
      const prodParam = params.get('producto');
      if (prodParam) {
        const key = ALIASES[prodParam] || prodParam;
        seleccionarProducto(key);
        if (storedCart.length > 0 && !itemsReserva.some(i => i.slug === (CATALOGO_PREVENTA[key]?.slug || key)) && CATALOGO_PREVENTA[key]) {
          agregarItemAReserva(CATALOGO_PREVENTA[key], 1);
        }
      } else if (itemsReserva.length > 0) {
        seleccionarProducto(itemsReserva[itemsReserva.length - 1].slug);
      }
    })
    .catch(() => {
      const params = new URLSearchParams(window.location.search);
      const prodParam = params.get('producto');
      if (prodParam) {
        seleccionarProducto(prodParam);
      } else if (itemsReserva.length > 0) {
        seleccionarProducto(itemsReserva[itemsReserva.length - 1].slug);
      }
    });
})();
