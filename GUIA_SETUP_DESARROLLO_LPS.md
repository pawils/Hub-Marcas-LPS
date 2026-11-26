# Guía Estándar de Setup de Desarrollo — Hub Marcas LPS

Estándar oficial de herramientas de editor y análisis estático para **Artesanitas Perú** (`artesanitas.lospilares.pe`), **`lospilares.pe`** y futuras marcas del ecosistema **Hub Marcas LPS**.

---

## 1. Propósito

Este setup garantiza tres pilares de ingeniería antes de que cualquier cambio llegue a producción (Railway):

1. **Seguridad del código en tiempo real:** detectar variables no definidas (`no-undef`), llaves duplicadas (`no-dupe-keys`), redeclaraciones (`no-redeclare`) o código inalcanzable (`no-unreachable`) mientras se escribe, antes del commit.
2. **Escalabilidad ordenada:** separar explícitamente los entornos (`server/**/*.js` en Node.js, `public/js/**/*.js` en navegador y `public/sw.js` en Service Worker) para que cada proyecto del Hub pueda crecer con múltiples módulos sin romper scripts existentes.
3. **Cero peso en producción:** las herramientas de análisis viven únicamente en `devDependencies` de `package.json`. Tanto `Dockerfile` como `nixpacks.toml` instalan dependencias de producción con `--omit=dev`, por lo que Railway no descarga ni ejecuta nada de linting en el servidor final.

---

## 2. Catálogo de Extensiones Clave

### 2.1 Extensiones obligatorias (4)

| Extensión | ID oficial (`publisher.name`) | Rol principal | Valor para seguridad y escalabilidad |
| :--- | :--- | :--- | :--- |
| **ESLint** | `dbaeumer.vscode-eslint` | Análisis estático de JavaScript en tiempo real | Integra ESLint v10 con Flat Config (`eslint.config.js`). Atrapó **13 errores reales** en la primera auditoría de Artesanitas (funciones fuera de scope IIFE en `registros.js`, llaves duplicadas y función faltante en `pedido.js`) que habrían fallado silenciosamente en producción. |
| **Error Lens** | `usernamehw.errorlens` | Diagnóstico visual en línea (`error` y `warning`) | Muestra el mensaje exacto de ESLint directamente al final de la línea con un retardo configurado de `300 ms`, eliminando la necesidad de pasar el cursor sobre subrayados ocultos. |
| **Tailwind CSS IntelliSense** | `bradlc.vscode-tailwindcss` | Autocompletado, vista previa de colores y conflictos CSS | Extensión oficial de Tailwind Labs (descartar bifurcaciones no oficiales como `TimsExperiments`). Funciona incluso con Tailwind cargado por CDN en HTML y templates en JS gracias a `tailwind.config.js` y `classRegex` en `.vscode/settings.json`. |
| **Git History** | `donjayamanne.githistory` | Historial visual de commits, ramas y comparación de diffs | Permite auditar quién, cuándo y qué cambió en cualquier archivo o línea sin el consumo de memoria ni funciones bloqueadas de pago de otras extensiones. |

### 2.2 Extensiones descartadas (y por qué)

Están listadas en `unwantedRecommendations` dentro de `.vscode/extensions.json`:

- **GitLens (`eamodio.gitlens`):** pesada en RAM y gran parte de sus funciones avanzadas son de pago; **Git History** cubre lo necesario de forma ligera.
- **Microsoft Edge Tools (`ms-edgedevtools.vscode-edge-devtools`) y Debugger for Firefox (`firefox-devtools.vscode-firefox-debug`):** redundantes al depurar directamente con DevTools de Chrome / navegador.
- **npm Intellisense (`christian-kohler.npm-intellisense`):** innecesaria para nuestro stack actual con pocos imports explícitos.
- **markdownlint (`davidanson.vscode-markdownlint`):** genera advertencias de estilo innecesarias sobre archivos `.md` internos.

---

## 3. Arquitectura de Configuración (4 Archivos Portables)

Todos los archivos son portables y pueden copiarse tal cual a cualquier repositorio nuevo del Hub:

1. [`eslint.config.js`](./eslint.config.js) — **Flat Config CommonJS (ESLint v10):**
   - Ignora `node_modules/**`, `public/js/vendor/**` y `scripts/**`.
   - Reglas enfocadas exclusivamente en **errores reales** (sin ruido estético de comillas o puntos y coma):
     - Errores (`error`): `no-undef`, `no-dupe-keys`, `no-dupe-args`, `no-duplicate-case`, `no-redeclare`, `no-const-assign`, `no-func-assign`, `valid-typeof`, `use-isnan`.
     - Advertencias (`warn`): `no-unreachable`, `no-self-assign`, `no-unused-vars` (ignorando variables o argumentos con prefijo `_` y `caughtErrors: 'none'`).
   - Entornos separados por carpeta:
     - `server/**/*.js` → `commonjs`, `ecmaVersion: 2022`, `globals.node`.
     - `public/js/**/*.js` → `script`, `ecmaVersion: 2022`, `globals.browser` + globales autorizadas (`fbq`, `Chart`, `heic2any`, `BarcodeDetector`, `tailwind`).
     - `public/sw.js` → `script`, `ecmaVersion: 2022`, `globals.serviceworker`.

2. [`tailwind.config.js`](./tailwind.config.js) — **Índice de rutas para IntelliSense:**
   - Declara `content: ['./public/**/*.html', './public/js/**/*.js', './server/routes/**/*.js']` para activar el autocompletado de **Tailwind CSS IntelliSense** (`bradlc`) aunque el sitio cargue Tailwind vía CDN en el navegador.

3. [`.vscode/settings.json`](./.vscode/settings.json) — **Ajustes del Workspace:**
   - Activa `"eslint.useFlatConfig": true` y `"eslint.validate": ["javascript"]`.
   - Mapea `"tailwindCSS.includeLanguages": { "javascript": "html" }` y `tailwindCSS.experimental.classRegex` para autocompletar clases dentro de strings `class="..."` / `className="..."` generados en JS.
   - Configura Error Lens con niveles `["error", "warning"]` y `"errorLens.delay": 300`.

4. [`.vscode/extensions.json`](./.vscode/extensions.json) — **Recomendaciones automáticas del Workspace:**
   - Al abrir cualquier proyecto nuevo del Hub en VS Code o Antigravity IDE, el editor sugerirá instalar exactamente estas 4 extensiones y evitar las descartadas.

---

## 4. Guía Paso a Paso para Replicar en `lospilares.pe` u Otra Marca Nueva

### Paso 1: Copiar los 4 archivos base
Desde la raíz de `Artesanitas`, copia hacia la raíz del nuevo proyecto (ej. `lospilares.pe`):
- `eslint.config.js`
- `tailwind.config.js`
- `.vscode/settings.json`
- `.vscode/extensions.json`

*(Si el proyecto nuevo usa carpetas distintas a `server/` o `public/js/`, actualiza los arrays `files` en `eslint.config.js` y `content` en `tailwind.config.js`.)*

### Paso 2: Instalar ESLint y `globals` solo en desarrollo
Ejecuta en la terminal del nuevo proyecto:

```powershell
npm install --save-dev eslint globals
```

Verifica en `package.json` que hayan quedado dentro de `"devDependencies"` y **nunca** en `"dependencies"`.

### Paso 3: Agregar el script `"lint"` en `package.json`
Dentro de `"scripts"` en `package.json`:

```json
"lint": "eslint server public/js public/sw.js"
```

*(Ajusta las rutas si el nuevo proyecto no usa `public/sw.js`.)*

### Paso 4: Ejecutar auditoría inicial y corregir errores
```powershell
npm run lint
```
- Todo `error` reportado por ESLint **debe resolverse** antes de hacer `commit`.
- Para funciones HTML globales llamadas vía atributos `onclick="..."` (por ejemplo en `catalogo.js`), decláralas al inicio del archivo con `/* exported nombreFuncion */` para evitar falsos avisos de `no-unused-vars`.

### Paso 5: Checklist de seguridad y escalabilidad antes de cada `git push`
1. **Validar lint y sintaxis Node:**
   ```powershell
   npm run lint; node --check server/server.js
   ```
   *(Nota en Windows PowerShell: encadena comandos con `;`, nunca `&&`.)*
2. **Proteger secretos:** confirmar con `git status --short` que ningún archivo `.env`, credencial o archivo temporal entre al commit.
3. **Cache-busting en frontend:** al modificar scripts en `public/js/*.js`, incrementar el query param `?v=...` en el HTML correspondiente.
4. **Cero impacto en Railway:** confirmar que cualquier librería de testing/linting nueva se instale con `--save-dev` (`npm install --omit=dev` en producción).
