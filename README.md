# Hub Marcas Aliadas LPS (`artesanitas.lospilares.pe`)

Proyecto independiente para **Railway** (Proyecto #3 junto a `LOSPILARES.PE` y `Aula Docente LPS`), diseñado con arquitectura Multi-Tenant Zero-Trust 2026 para alojar a **Artesanitas Perú** y futuras marcas aliadas (`*.lospilares.pe`).

## Características Principales
1. **E-commerce Completo + Compresión WebP en Navegador:** Subida de fotos comprimidas automáticamente a `< 80 KB` en formato WebP y servidas con caché inmutable de 1 año en el Edge CDN de Cloudflare.
2. **Jerarquía Retail (BI & IA Ready):** Clasificación por `Línea -> Sub-línea -> Sub-sublínea -> Colección` más `costo_artesano` para análisis de margen bruto.
3. **Ficha Técnica de Producto:** `SKU` (autogenerado o manual), `EAN / Código de barras`, `Stock actual`, `Stock mínimo`, `Política sin stock` (Preventa vs. Agotado), `Precio Oferta / Promoción`, `Tipo`, `Modelo`, `Color`, `Tamaño/Dimensiones` y `Características`.
4. **ERP de Trazabilidad de Artesanos Tercerizados:** Control de `Artesano asignado`, `Costo artesano`, `Fecha encargo`, `Fecha compromiso artesano` (con alerta automática de retraso), `Fecha llegada a taller`, `Guía Shalom` y portal público de seguimiento en vivo (`/seguimiento`).
5. **Pasarela Mercado Pago 100% Independiente:** Cada negocio aliado usa sus propias credenciales (`MP_ACCESS_TOKEN_ARTESANITAS` o columnas en BD) sin mezclar fondos con Los Pilares.
