// server/create-brand.js — Generador Automático de Nueva Marca Aliada en Hub Marcas LPS
// Uso: node server/create-brand.js <slug> "<Nombre de la Marca>"
// Ejemplo: node server/create-brand.js latiendacafe "La Tienda Café"

const fs = require('fs');
const path = require('path');

const slug = (process.argv[2] || '').trim().toLowerCase();
const nombre = (process.argv[3] || slug).trim();

if (!slug || !/^[a-z0-9-]{2,50}$/.test(slug) || ['artesanitas', 'www', 'aula', 'api', 'admin'].includes(slug)) {
  console.error('Uso: node server/create-brand.js <slug-en-minusculas> "<Nombre de la Marca>"');
  console.error('Ejemplo: node server/create-brand.js latiendacafe "La Tienda Café"');
  process.exit(1);
}

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const brandDir = path.join(PUBLIC_DIR, slug);
const brandJsDir = path.join(brandDir, 'js');
const brandImgDir = path.join(PUBLIC_DIR, 'imagenes', slug);

fs.mkdirSync(brandJsDir, { recursive: true });
fs.mkdirSync(brandImgDir, { recursive: true });

const indexHtml = path.join(brandDir, 'index.html');
if (!fs.existsSync(indexHtml)) {
  fs.writeFileSync(
    indexHtml,
    `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${nombre} — Marca Aliada Los Pilares</title>
  <script src="/js/vendor/tailwindcss.3.4.17.js"></script>
</head>
<body class="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center p-6">
  <main class="max-w-xl w-full bg-white rounded-3xl shadow-sm border border-slate-200 p-8 text-center space-y-4">
    <span class="inline-block text-xs font-bold uppercase tracking-widest text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full">
      Subdominio Oficial · ${slug}.lospilares.pe
    </span>
    <h1 class="text-3xl font-extrabold tracking-tight">${nombre}</h1>
    <p class="text-slate-600 text-sm">
      Espacio web independiente alojado en el Hub Marcas Aliadas Los Pilares.
    </p>
  </main>
</body>
</html>
`,
    'utf8'
  );
}

console.log(`✅ Marca "${nombre}" creada con éxito y 100% separada de Artesanitas:`);
console.log(`   📁 Carpeta Web HTML/JS : public/${slug}/`);
console.log(`   🖼️ Carpeta Imágenes    : public/imagenes/${slug}/`);
console.log(`   🌐 Subdominio en vivo  : https://${slug}.lospilares.pe`);
