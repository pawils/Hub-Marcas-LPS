# Plan Maestro de Ingeniería Full-Stack 2026 — E-Commerce & ERP (`Artesanitas` + Ecosistema `Hub Marcas LPS`)

Este documento detalla la arquitectura técnica, tablas de base de datos, archivos a intervenir y orden de ejecución de las **7 Implementaciones de Alto Impacto 2026**.

---

## Orden de Ejecución Recomendado (Sprints por Prioridad de Negocio)

| Sprint | Módulo | Impacto Principal | Archivos Clave en `Artesanitas/` |
| :---: | :--- | :--- | :--- |
| **Sprint 1** | **Punto 6: Carrito Persistente (`LocalStorage`) + Cajón Flotante en Catálogo** | Aumenta conversión de visitantes de Instagram/TikTok que eligen varias piezas desde el catálogo principal. | `public/index.html`, `public/js/catalogo.js`, `public/pedido.html`, `public/js/pedido.js` |
| **Sprint 2** | **Punto 5: Dashboard BI & Rentabilidad por Línea y Artesano** | Visibilidad financiera en tiempo real: Margen Bruto, Saldos por Cobrar, Ranking por Línea Retail y Puntualidad de Artesanos. | `server/routes/negocio-pedidos.routes.js`, `public/registros.html`, `public/js/registros.js` |
| **Sprint 3** | **Punto 3: Mini-Portal de Proveedores (Magic Link para Artesanos Tercerizados)** | Elimina retrasos: cada artesano ve sus piezas pendientes desde su celular y reporta entrega con 1 botón sin ver precios de venta. | `server/migrate.js`, `server/routes/negocio-pedidos.routes.js`, `public/taller-artesano.html`, `public/js/taller-artesano.js` |
| **Sprint 4** | **Punto 2: Meta Conversions API (CAPI Server-Side)** | Reduce el costo por compra en Instagram/Facebook Ads (20%–30%) al evitar el bloqueo del Pixel en iOS/Safari. | `server/migrate.js`, `server/routes/negocio-pedidos.routes.js`, `server/utils/meta-capi.service.js` |
| **Sprint 5** | **Punto 1: Validación de Vouchers Yape/Plin con Visión IA (Anti-Fraude)** | Lectura automática de Monto, N° de Operación y Fecha en el comprobante subido; bloqueo de vouchers duplicados. | `server/migrate.js`, `server/utils/voucher-ai.service.js`, `server/routes/negocio-pedidos.routes.js`, `public/js/registros.js` |
| **Sprint 6** | **Punto 4: PWA Instalable + Notificaciones Web Push (Admin y Comprador)** | El admin recibe alerta sonora en su celular por cada reserva nueva; el cliente recibe aviso Push cuando sale su guía Shalom. | `public/manifest.json`, `public/sw.js`, `server/routes/negocio-pedidos.routes.js` |
| **Sprint 7** | **Punto 7: Motor White-Label (`brand.config.json`) para Nuevas Marcas en 15 min** | Permite clonar este proyecto para un nuevo cliente (`latiendacafe.lospilares.pe`) cambiando un solo archivo de configuración. | `brand.config.json`, `server/routes/negocio-talleres.routes.js`, `public/js/catalogo.js` |

---

## Detalle Técnico de los 7 Puntos

### Punto 1 (Sprint 5): Validación Inteligente de Vouchers Yape / Plin con Visión IA
1. **Base de Datos (`negocio_pedidos`):**
   - `voucher_nro_operacion VARCHAR(40)` (con índice único parcial para detectar vouchers reutilizados).
   - `voucher_monto_detectado NUMERIC(10,2)`
   - `voucher_entidad_detectada VARCHAR(40)` (`'Yape' | 'Plin' | 'BCP' | 'Interbank'`)
   - `voucher_verificacion_ia VARCHAR(30)` (`'verificado' | 'monto_difiere' | 'duplicado' | 'pendiente'`)
2. **Backend (`server/utils/voucher-ai.service.js`):**
   - Envía el `buffer` del comprobante a `Gemini 2.5 Flash` (si `GEMINI_API_KEY` está configurada) solicitando JSON estructurado `{ nro_operacion, monto, fecha, billetera }`.
   - Compara `monto` contra `monto_pagado` esperado y verifica que `nro_operacion` no exista en ningún otro pedido.
3. **Frontend (`public/registros.html`):**
   - Muestra insignia verde `🤖 IA: Op #12345678 · S/ 20.00 (OK)` o alerta amarilla/roja si el número de operación ya se usó antes.

### Punto 2 (Sprint 4): Meta Conversions API (CAPI Server-Side)
1. **Base de Datos (`negocios`):**
   - `meta_capi_token TEXT` (Token de Conversions API del Administrador de Eventos de Meta de la marca).
2. **Backend (`server/utils/meta-capi.service.js`):**
   - Al crearse un pedido en `POST /api/negocios/:slug/pedidos`, genera un `event_id` único (`codigo_pedido`), hashea con `SHA-256` el teléfono (`51` + WhatsApp) y nombre del cliente, y envía el evento `Purchase` / `Lead` a `https://graph.facebook.com/v21.0/<PIXEL_ID>/events`.
   - Devuelve el mismo `event_id` al navegador para deduplicación perfecta con el Pixel web.

### Punto 3 (Sprint 3): Mini-Portal para el Artesano Tercerizado (`Magic Link`)
1. **Base de Datos (`negocio_artesanos`):**
   - `id SERIAL PRIMARY KEY`, `negocio_id INT`, `nombre VARCHAR(120)`, `whatsapp VARCHAR(25)`, `access_token VARCHAR(64) UNIQUE`, `activo BOOLEAN`.
2. **Backend (`GET /api/negocios/:slug/artesano-portal/:token` y `PATCH /api/negocios/:slug/artesano-portal/:token/pedido/:id`):**
   - Devuelve únicamente los pedidos asignados a ese artesano (`producto_nombre`, `cantidad`, `items`, `notas_taller`, `fecha_compromiso_artesano`, `estado_pedido`), **ocultando precios de venta al cliente, DNI y teléfono del comprador**.
   - Permite al artesano marcar: `En producción (Modelado/Pintado)` o `Listo para entregar a taller Artesanitas`.
3. **Frontend (`public/taller-artesano.html`):**
   - Vista móvil ultraligera con semáforo de fechas de entrega (Rojo: atrasado, Ámbar: vence en 48h, Verde: a tiempo) y botón de actualización en 1 toque.

### Punto 4 (Sprint 6): Web Push Notifications + PWA Instalable
1. **Archivos PWA (`public/manifest.json` y `public/sw.js`):**
   - Permite instalar `Artesanitas` y `/registros` como aplicación en Android/iOS.
2. **Suscripciones Push (`negocio_push_subscriptions`):**
   - Guarda suscripciones VAPID tanto del rol `admin` (recibe alerta en cada nueva reserva) como del `comprador` asociada a su `codigo_pedido` (recibe notificación Push automática cuando el admin ingresa su `guia_envio` de Shalom o cambia el estado a `enviado`).

### Punto 5 (Sprint 2): Dashboard BI & Rentabilidad por Línea y Artesano
1. **Endpoint Analítico (`GET /api/negocios/:slug/bi-resumen`):**
   - Calcula en una sola consulta SQL agregada:
     - **Ventas Totales ($S/$)**, **Total Abonado ($S/$)**, **Saldos por Cobrar ($S/$)**, **Costo Total de Artesanos ($S/$)** y **Margen Bruto Real ($S/$ y %)**.
     - **Ventas por Jerarquía Retail:** Agrupación por `linea`, `sublinea` y `coleccion`.
     - **KPI de Artesanos:** Pedidos asignados, entregados a tiempo vs. atrasados y pago acumulado por artesano.
2. **Vista en Panel (`public/registros.html`):**
   - Nueva pestaña **`📊 BI & Rentabilidad`** con tarjetas financieras, barras de progreso por colección y tabla de rendimiento de artesanos.

### Punto 6 (Sprint 1): Carrito Persistente (`LocalStorage`) + Cajón Flotante en Catálogo
1. **En `public/index.html` y `public/js/catalogo.js`:**
   - Agrega botón **`+ Agregar a mi reserva`** en todas las tarjetas del catálogo y una burbuja flotante inferior **`🛒 Mi Reserva (N piezas · S/ XX)`**.
   - Guarda la selección en `localStorage.getItem('artesanitas_cart_v1')`.
2. **En `public/pedido.html` y `public/js/pedido.js`:**
   - Al abrir `/pedido`, hidrata automáticamente todas las piezas guardadas en el carrito + persiste los datos del cliente (Nombre, DNI, WhatsApp, Sede Shalom) por si recarga la página antes de adjuntar su voucher.

### Punto 7 (Sprint 7): Motor White-Label (`brand.config.json`)
1. **Archivo `brand.config.json`:**
   - Centraliza `slug`, `nombre`, `subdominio`, `whatsapp`, `metaPixelId`, `colores` (`primario`, `fondo`, `texto`), `cuentasPago` (`yapeQr`, `plinQr`, `titular`) y `modalidadesEntrega`.
2. **Beneficio Comercial:**
   - Para lanzar una nueva marca en `Hub Marcas LPS/<NuevaMarca>`, solo se edita `brand.config.json` y se despliega en menos de 15 minutos.
