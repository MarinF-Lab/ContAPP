# ID Contable Auditor — Protocolo de trabajo para Claude Code

SaaS contable multi-cliente para estudios contables chilenos (PWA, JS puro, Firebase).
Marca: **ID Contable** (isotipo de ID Studio) con la versión debajo: **Auditor** · Educa · Empresa.
No renombrar identificadores internos `Contapp*` ni claves `contapp_*` (se perderían datos).
Este es el único producto activo del repo (`educa/` y `empresa/` están en pausa).

---

## ⚡ Inicio de sesión

```
1. Leer PLANIFICACION/INTEGRACION_DISENO.md (corto: estado, decisiones y "Pendientes / próximo paso")
2. Ejecutar: npm test
3. Comenzar la tarea indicada por el usuario (o el próximo paso pendiente)
```

No asumas el estado del código — verifícalo. El historial antiguo (jul-sep 2026) está en
`PLANIFICACION/archivo/` y **no** se lee al iniciar; consúltalo solo si hace falta contexto.

---

## Preferencias del usuario

- Respuestas **breves, precisas y en español**.
- **Antes de cada acción solicitada: planificar y esperar confirmación.** No programar, borrar ni
  publicar sin aprobación explícita.
- Ser objetivo: señalar fallas y riesgos aunque no se hayan preguntado.

---

## 🔁 Loop de trabajo

```
[ PLAN breve → confirmación del usuario ]
      ↓
[ HACER TAREA ]
      ↓
[ VERIFICAR ]  npm test  (+ npm run test:navegador si cambió la interfaz,
               + npm run test:reglas si cambió firestore.rules o el acceso)
               + revisión visual contra PLANIFICACION/diseno/referencia-contapp-consola.html
      ↓
[ ACTUALIZAR PLANIFICACION/INTEGRACION_DISENO.md ]  marcar ✅ con fecha, actualizar "Pendientes"
      ↓
[ INFORMAR AL USUARIO con el próximo paso y esperar ]
```

---

## Reglas obligatorias

- **Referencia de diseño:** `PLANIFICACION/diseno/referencia-contapp-consola.html` (artefacto
  "ContApp Consola", aprobado). Si migrar el diseño requiere tocar un módulo, se toca.
- **Decisiones de diseño aprobadas (2026-11):** paleta del logo (claro: gris niebla `#DCE3E9`,
  superficie `#EEF2F5`, tinta `#0F1B26`, acero `#8FA5B3`, magenta `#A03A63`; oscuro: navy `#131D2A`,
  rosa neón `#FF5A8A`) con contraste AA · fuentes actuales (Space Grotesk / Manrope / IBM Plex Mono)
  · la consola **"¿Qué quieres hacer hoy?"** va **encima** del centro de mando, no lo reemplaza ·
  íconos SVG en vez de emoji.
- **El rediseño es solo capa visual:** no cambia lógica contable; `npm test` debe seguir pasando.
- **No usar** `alert()`, `confirm()` ni `console.log()` en código nuevo:
  notificaciones → `mostrarToast(mensaje, tipo)` · confirmaciones → `mostrarConfirm(mensaje, callback)`.
- **Modales:** abrirlos como siempre (`style.display = 'flex'` o `appendChild`); `js/core/modales.js`
  agrega animación, Escape, foco y bloqueo de scroll. Para quitar uno creado por JS con salida
  suave: `modalQuitar(el)`. Los formularios no se cierran con clic fuera.
- **Cambios en JS/CSS:** subir `?v=N` en `index.html` y `CACHE` en `service-worker.js`.
- **No marcar un paso como completado** sin pasar las pruebas y sin revisión visual; si algo no
  coincide con el diseño, dejarlo explícito en `INTEGRACION_DISENO.md`.
- **Seguridad:** el acceso a datos lo deciden `firestore.rules` (v3) — titular, invitado o acceso
  por código. Todo cambio de acceso se prueba con `npm run test:reglas`. Las reglas las publica el
  usuario (consola de Firebase o `firebase deploy --only firestore:rules`).

---

## Stack — no agregar dependencias a la app

- Vanilla JS ES6+ con `<script>` clásicos (comparten el ámbito global), sin frameworks ni build.
- jsPDF, SheetJS, Chart.js y Firebase (Auth + Firestore) vía CDN.
- CSS: `css/variables.css` (tokens) y `css/main.css` (componentes).
- Las dependencias de `package.json` son **solo de desarrollo** (pruebas).

---

## Mapa de archivos

```
js/core/        → datos-cliente, asientos, conexiones, cierre, modales, plan-cuentas, helpers…
js/services/    → app, menu, home-hub, diario, mayor, balance, IVA, firebase-service, auth-manager…
js/modules/     → compras, ventas, documentos, cartolas, remuneraciones, activos, inventario…
js/categorias/  → catálogos de módulos por categoría tributaria (grupos del centro de mando)
js/auditor/     → licencia, multi-cliente, panel del estudio
css/            → variables.css, main.css, home-hub.css, remuneraciones.css, auditor.css
herramientas/   → previred-proxy-worker.js (Cloudflare Worker, lo enlaza la app)
PLANIFICACION/  → INTEGRACION_DISENO.md (estado vivo), CONECTIVIDAD.md, pruebas, diseno/, archivo/
firestore.rules → reglas v3 · firebase.json → emulador y despliegue de reglas
```

---

## Pruebas — comandos exactos (desde `auditor/`)

```bash
npm test                 # verificar.js (estática) + contraste AA + test-fase0..3.js (conectividad)
npm run test:navegador   # + interacción en Chromium (modales, teclado, tema, avisos) + celular emulado
npm run test:reglas      # firestore.rules en el emulador (requiere Java; 63 casos)
npm run revisar:texto    # texto pegado a bordes o desbordado (servidor en :8765; ~10 min)
```

Capturas: `node PLANIFICACION/diseno/capturar-linea-base.js <carpeta>` (con un servidor en el
puerto 8765) para comparar contra la línea base `PLANIFICACION/diseno/linea-base/` (Etapa 1: `etapa1/`).

---

## Skills de diseño — OBLIGATORIAS en todo trabajo visual

El usuario instaló estas skills para que el trabajo visual sea mejor: **usarlas siempre** que la
tarea toque la interfaz (pantallas, componentes, colores, tipografía, movimiento, celular).
Invocarlas con la herramienta Skill **antes** de escribir código y aplicar sus reglas.

| Cuándo | Skills |
|--------|--------|
| Antes de diseñar o rediseñar una pantalla | `frontend-design`, `ui-ux-pro-max`, `apple-design`, `learn-taste` |
| Al elegir componentes o patrones | `pick-ui-library`, `prototype` |
| Al revisar una pantalla terminada | `web-design-guidelines`, `emil-design-eng`, `break-ui` (datos extremos: nombres largos, montos enormes, listas vacías) |
| Al agregar o ajustar movimiento | `animate`, `choreograph`, `find-animation-opportunities`, `animation-vocabulary` |
| Al revisar movimiento existente | `review-animations`, `improve-animations`, `remove-animations`, `animation-performance` |
| Celular, gestos y avisos | `mobile-native`, `gestures`, `ask-sonner` (solo como referencia de patrones: la app no usa React) |

- En cada respuesta sobre trabajo visual, **decir qué skills se usaron** en esa tarea.
- No usar `animate-expo`, `write-swift` ni `synced`: son para React Native, Swift y otro tipo de
  proyecto.
- Para revisar cambios de código: `code-review`.
- Las skills no reemplazan la preferencia del usuario: **planificar y esperar confirmación** antes
  de cada acción.
