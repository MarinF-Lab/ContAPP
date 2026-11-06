# Integración de Diseño — ContApp Auditor

> **Objetivo:** que la app termine **visual y funcionalmente igual** al prototipo
> `Diseño de apps/new desing.html`, con **todas las funciones del prototipo migradas y
> funcionando sobre datos reales** (no placeholders ni datos de ejemplo).
>
> **Fuentes de verdad:**
> - `Diseño de apps/new desing.html` — prototipo HTML/CSS/JS autocontenido, el diseño final.
> - `Diseño de apps/integracion-diseno.md` — guía de integración (tokens, mapeo de pantallas,
>   qué es maqueta vs. lógica portable, orden sugerido en su sección 8).
> - `Diseño de apps/funcionalidades.md` — inventario pantalla por pantalla de lo que hace el
>   prototipo.
>
> Este documento reemplaza a `ARQUITECTURA_MODULOS.md`/`DISEÑO_UI.md` como sprint activo
> mientras dure la integración — ver `PROGRESO.md` → "PRÓXIMO PASO".

---

## Estado por paso (orden de `integracion-diseno.md` sección 8)

| # | Paso | Estado | Archivos principales |
|---|------|--------|----------------------|
| 1 | Tokens de color y tipografía | ✅ Completo | `css/variables.css`, `css/auditor.css` |
| 2 | Mecanismo de tema claro/oscuro | ✅ Completo | `index.html` (script inline `applyTheme/toggleTheme/initTheme`) |
| 3 | Pantalla de Login | ✅ Completo | `index.html` (`#login-overlay`), `icons/brand/` |
| 4 | Topbar + selector de módulo | ✅ Completo | `index.html` (`#app-topbar`), `js/services/menu.js` |
| 5 | Home — navegación abanico/pulpo | ✅ Completo | `index.html` (`#view-inicio`), `js/services/menu.js` |
| 6 | Gráficos SVG a mano → librería real | ✅ Completo | `js/services/dashboard.js`, Chart.js vía CDN |
| 7 | Conectar datos reales en placeholders | 🔲 Pendiente | revisar qué queda placeholder tras el paso 6 |

`node PLANIFICACION/verificar.js` → 26/26 ✅ en todo momento durante esta integración (no se ha
tocado lógica de negocio, solo capa visual/de interacción — ver excepciones explícitas más abajo).

---

## Decisión de arquitectura: 3 grupos de módulos, no 5

El prototipo (`funcionalidades.md`) agrupa los módulos en **3 grupos**: Comercial / Contabilidad /
Empresa. El proyecto, antes de esta integración, tenía una arquitectura de **5 grupos (G1-G5)**
aprobada e implementada en una sesión anterior (`git log`: "consolida arquitectura de módulos").

**Decisión del usuario:** adoptar los 3 grupos del prototipo tal cual, no adaptar el prototipo a 5.

Esto significó reescribir los catálogos de módulos por cliente — la función central del producto
(activar/desactivar módulos por cliente) — sin perder ningún módulo:

- `js/categorias/primera.js` — `CAT1_MODULOS` reescrito: cada módulo ahora tiene
  `grupo: 'Comercial' | 'Contabilidad' | 'Empresa'` (antes `'G1 · Contabilidad'`, etc.) + un
  campo `icono` nuevo (emoji, ver sección de iconos abajo). Se eliminaron `CAT1_IDS_MOSTRAR`/
  `CAT1_IDS_OCULTAR` (ids de grupos de sidebar que ya no existen).
- `js/categorias/segunda.js` — mismo tratamiento para `CAT2_MODULOS` (Segunda Categoría).
- `js/services/permisos.js` — `aplicarNavegacionPorCategoria()` ya no manipula ids de
  `nav-grupo-*` del sidebar (no existen); delega el filtrado real a `refrescarMenuNavegacion()`.
- `cat1AplicarModulos()`/`cat2AplicarModulos()` — antes tocaban directamente el DOM del sidebar;
  ahora solo llaman a `refrescarMenuNavegacion()` (en `menu.js`), que reconstruye el menú desde
  cero filtrando por categoría + módulos activos del cliente.

**Pendiente:** el `<aside class="sidebar">` original (35 vistas con ids `nav-grupo-*`) sigue en el
DOM de `index.html`, ahora inerte — nada lo controla ni lo muestra. Queda pendiente eliminarlo del
HTML una vez se confirme que la navegación nueva (Home + topbar) cubre el 100% de los casos de uso
(ver "Pendientes" al final).

---

## `js/services/menu.js` — nueva fuente única de verdad de navegación

Archivo nuevo. Reemplaza el patrón `menu`/`moduleTabs` hardcodeados del prototipo por datos reales:

- `construirMenu()` — lee `CAT1_MODULOS`/`CAT2_MODULOS` según la categoría tributaria del cliente
  activo (`window.currentUser.categoria`) y filtra por sus módulos activos
  (`window.currentUser.modulosActivos`, o los defaults del catálogo si no hay override). Devuelve
  `[{ id, label, icono, desc, modulos:[{id,label,icono}] }]` — un array de exactamente 3 grupos
  (o menos, si un cliente no tiene módulos activos de algún grupo).
- `refrescarMenuNavegacion()` — punto único que re-renderiza toda la UI de navegación dependiente
  del menú (Home + topbar). Se llama cada vez que cambia la categoría tributaria o el set de
  módulos activos del cliente (ya estaba cableado a estos eventos vía `permisos.js`/`categorias/*.js`).
- `renderHomeGroups(menu)` / `toggleGrupoHome(i)` / `cerrarGrupoHome()` / `irAModuloDesdeHome(id)`
  — navegación abanico/pulpo de Inicio. El cálculo radial de tentáculos (arco, radio base, capas
  por distancia al centro) es el mismo algoritmo trigonométrico del prototipo
  (`renderHomeGroups()`/`toggleGroup()` en `new desing.html` líneas 874-975), portado literalmente
  — es lógica pura, no depende de datos hardcodeados.
- `renderModuleSwitch(menu)` / `toggleModulePanel()` / `cerrarModulePanel()` — dropdown de
  selector de módulo en el topbar, mismo patrón de abrir/cerrar + click-fuera del prototipo.
- `actualizarTopbarModulo(modulo)` — no existe en el prototipo (ahí la pantalla Home y App eran
  literalmente pantallas distintas, `showScreen()`). Se creó porque este proyecto es una SPA de
  una sola pantalla con vistas (`.view.active`), no un swap de 3 pantallas — ver adaptación abajo.
  Alterna entre `#home-header` (marca/saludo/tema/config/salir) y `#app-topbar`
  (volver a Inicio/selector de módulo/filtros/búsqueda) según si el módulo activo es `'inicio'`.
- `MENU_SUBSECCIONES` — mapa módulo → sub-secciones reales (los tabs que ya existen en cada vista,
  ej. `estructura-contable` → Libro Diario/Mayor/Balance/Plan de Cuentas), mostradas en el panel
  `.tentacle-data` al pasar el cursor. Son nombres reales de tabs existentes, no datos inventados.

### Adaptación clave: pantallas del prototipo → vistas de la SPA existente

El prototipo tiene 3 `<div id="screen-*">` alternados con `showScreen()`. Este proyecto ya es una
SPA con `navegar(modulo)` que togglea `.view.active` — reescribir todo el enrutamiento a un modelo
de "3 pantallas" habría sido un cambio de arquitectura mucho más grande y riesgoso que lo que pedía
el paso 4/5. En su lugar:

- **Home** = `#view-inicio` (una vista más, como cualquier otra) con dos capas superpuestas:
  - `.home-fan` (`#homeFan`, fijo/`position:fixed`) — el abanico de tarjetas, flota sobre todo.
  - `.home-body > .home-bg-dash` (`#homeBgDash`) — el dashboard real existente (hero de empresa,
    KPIs, gráficos, indicadores económicos, últimos asientos) **sin modificar su contenido ni sus
    ids** — solo se envolvió en el contenedor nuevo. Esto es intencional: es exactamente el
    "dashboard de fondo" que describe el prototipo, pero ya corría sobre datos reales antes de
    esta integración (no había que inventarlo).
- **App** (cualquier módulo) = el resto de `.view`s existentes, sin cambios de contenido — solo
  cambia el header que las envuelve (`#app-topbar` en vez del `.top-header` anterior).
- `navegar()` (en `js/services/app.js`) gana una sola línea al final:
  `actualizarTopbarModulo(modulo)` — es el punto de enganche entre el router existente y el header
  nuevo.

### Iconografía: emoji en vez de sprite SVG

El prototipo usa un objeto `ICONS` con paths SVG inline por nombre de ícono
(`integracion-diseno.md` sección 5.4 ya anticipa esto: "fácil de portar a un componente
`<Icon name=".."/>` si el proyecto usa React/Vue"). Este proyecto es vanilla JS sin ese patrón, y
ya usa emoji como iconografía en todo el sidebar/nav existente (`<span class="nav-icon">🤝</span>`,
etc.). Se adaptó `menu.js`/`CAT1_MODULOS`/`CAT2_MODULOS` para usar emoji directamente (campo
`icono`) en vez de portar el sprite SVG completo — mismo resultado visual/funcional, consistente
con la convención ya existente del proyecto (`integracion-diseno.md` punto 5, "adaptar conservando
el resultado visual/funcional").

---

## Pantalla de Login (paso 3)

`index.html` `#login-overlay` reestructurado a layout de dos columnas (`login-shell` →
`login-left` + `login-right`), con:
- Panel izquierdo: marca, tagline, 3 destacados, isotipo de fondo semi-transparente (distinto
  según tema — `icons/brand/isotipo-light-tone.png` / `isotipo-dark-tone.png`, copiados desde
  `Diseño de apps/`).
- Panel derecho: tarjeta de formulario (`login-card`), fondo de puntos a pantalla completa.
- Botón de tema propio (una de las 3 instancias de `.theme-toggle-btn` en toda la app).
- **Sin tocar:** la lógica real de autenticación (Firebase) — el formulario sigue llamando a las
  mismas funciones reales de siempre.

## Tema claro/oscuro (paso 2)

Portado literalmente del prototipo (`integracion-diseno.md` sección 3): `applyTheme()`/
`toggleTheme()`/`initTheme()`, cualquier botón con clase `.theme-toggle-btn` (hoy 3 instancias:
login, home-header, app-topbar) se sincroniza solo. **Adaptación:** persistencia en
`localStorage['appTheme']` (la clave que ya usaba el proyecto), no `'contapp-theme'` como el
prototipo — para no perder la preferencia ya guardada de usuarios existentes. Es lógica aislada,
no dependía de nada del resto del rediseño.

---

## Fuera del alcance del prototipo (decisiones propias del proyecto)

### Selector de clientes ("Mis Clientes" / `view-empresa`)

No existe en el prototipo — el prototipo asume que ya estás trabajando dentro de una sola empresa.
Este proyecto es multi-cliente (la razón de ser del producto), así que esta pantalla se mantiene
**con su estructura/lógica actual intacta**, y por ahora solo se le actualizaron los colores a la
paleta nueva:

- La mayoría de `.emp-*` (CSS de esta pantalla) ya usaba variables de tema (`var(--text)`,
  `var(--accent)`, etc.) y heredó la paleta nueva automáticamente al remapear los tokens en el
  paso 1 — no requirió cambios.
- Se encontraron y corrigieron colores hardcodeados **obsoletos** que databan de antes incluso del
  rediseño navy/magenta anterior a este, y que rompían la consistencia visual en toda la app (no
  solo en el selector de clientes):
  - `rgba(43,91,246,*)` (azul `#2B5BF6` original) usado como glow de `:focus`/`:hover` en 9 sitios
    (inputs de formularios en general + `.emp-item:hover`) → reemplazado por el coral nuevo
    (`rgba(255,134,146,*)`).
  - `#wizardOverlay` — gradiente de fondo con `#2B5BF6` hardcodeado → reconstruido con
    `var(--navy)`/`var(--navy-light)`/`var(--coral-deep)`.
  - `.ia-chat-fab` — glow con `rgba(172,64,109,*)` (el magenta del rediseño anterior a este) →
    `var(--accent-glow)`/`var(--accent-glow-lg)`.
  - `.btn-danger` — sombra con un rojo (`rgba(229,62,90,*)`) que ya no coincidía con el `--negative`
    actual → recalculado a partir del token vigente.
  - `.nav-group-cat` — fallback de `var(--accent, #3b82f6)` con azul viejo → coral.
  - Badge "🔴 Sin conexión" (`firebase-service.js`) — colores Tailwind hardcodeados → tokens
    `var(--negative)`/`var(--negative-soft)` (también corrige que no se adaptaba a modo oscuro).
- **Explícitamente NO tocado** (son datos funcionales reales, no colores de marca/tema):
  - `AUD_COLORES` en `js/auditor/multi-cliente.js` — paleta de 10 colores que el usuario elige
    para etiquetar clientes. Cambiarla alteraría etiquetas ya guardadas de clientes existentes.
  - `OBLIGACIONES_TRIBUTARIAS` / `KANBAN_ESTADOS` en `js/auditor/panel-estudio.js` — códigos de
    color por tipo de obligación tributaria / estado de kanban. Son semántica de estado, no tema.

### Login — reactivado (2026-07-16)

`js/services/firebase-service.js` — constante `LOGIN_DESACTIVADO_TEMPORAL`, ahora en `false`.
Mientras estuvo en `true`, `fbInit()` saltaba la autenticación real y entraba directo por
`_fbEntrarModoOffline()` (la misma ruta que ya existía para trabajar sin conexión — no se inventó
lógica nueva). Todo el resto de `firebase-service.js` (auth real, selector de empresa, sync a
Firestore) nunca se tocó durante la integración de diseño — el bypass era el único cambio.

Al reactivar, `#login-overlay` vuelve a ser la puerta de entrada real: `fbInit()` llama a
`firebase.initializeApp()`/`firebase.auth()` de verdad, y `_fbOnAuthChange(null)` (sin sesión)
dispara `_fbShowLogin()`, que muestra el overlay (`position:fixed; inset:0; z-index:99999`, cubre
toda la pantalla) con el diseño migrado en el paso 3 y completado en la ronda de `/qa`: tabs
"Iniciar sesión"/"Ingresar con código", campos con iconos, checkbox "Recordarme", enlace
"¿Olvidaste tu contraseña?", botón "Iniciar Sesión" y los botones sociales Google/Microsoft
(decorativos, documentados así en `funcionalidades.md`).

**Bug de caché encontrado al reactivar**: al cambiar la constante, la app seguía entrando en modo
offline como si el flag siguiera en `true`. Causa: `index.html` cargaba
`js/services/firebase-service.js?v=2` — el mismo query string de cache-busting de antes del cambio,
así que el navegador (y el service worker) seguían sirviendo la versión vieja del archivo aunque el
contenido en disco ya era otro. Se corrigió subiendo el sufijo a `?v=3` (mismo patrón que
`main.css?v=5`, `dashboard.js?v=2→v=3` del paso 6) — cualquier edición futura a un archivo con
sufijo de versión debe subir el número o el cambio no se verá reflejado en el navegador.

Verificado en browser (navegación limpia, sin bypass de caché manual): `LOGIN_DESACTIVADO_TEMPORAL`
lee `false`, `currentUser` es `null` al cargar, `#login-overlay` en `display:flex` cubriendo toda
la pantalla, los 8 elementos reales del formulario presentes (tabs, campos, checkbox, enlace, botón
submit, 2 botones sociales, link de registro), sin errores de consola.
`node PLANIFICACION/verificar.js` → 26/26 ✅. Sin commitear.

---

## Bugs encontrados y corregidos durante la integración

1. **Orden de carga de scripts** — `menu.js` se cargaba en `index.html` *después* de
   `firebase-service.js`, pero `fbInit()` dispara (síncronamente, en un `<script>` inline) una
   cadena que termina llamando a `refrescarMenuNavegacion()` (`aplicarNavegacionPorCategoria()` →
   `refrescarMenuNavegacion()`). Como esa función aún no existía en ese momento del parseo, el
   guard `typeof ... === 'function'` la saltaba en silencio — el abanico de Inicio no se pintaba
   nunca en el primer load. Se corrigió diferiendo la llamada de `_fbEntrarModoOffline()` a
   `DOMContentLoaded` (dentro del bloque `LOGIN_DESACTIVADO_TEMPORAL`) en vez de reordenar todos
   los `<script>` del archivo (más seguro — no arriesga otras dependencias de orden no auditadas).
2. Ver sección anterior — 6 colores hardcodeados obsoletos que sobrevivían de rediseños previos.
3. **Sidebar legacy no eliminado, solo inerte** — tras los pasos 4-5 el `<aside class="sidebar">`
   (35 vistas G1-G5) seguía completo en el DOM y ocupando ~278px de layout (`body{display:flex}`),
   duplicando la navegación nueva. Se eliminó por completo (`index.html`, `js/services/app.js`) —
   `toggleSidebar()`/`cerrarSidebar()` habrían lanzado `TypeError` en móvil al quedar `null` el
   `querySelector('.sidebar')`, así que también se limpiaron esas funciones y su único call site
   (`navegar()`). El botón "🧪 Modo Prueba" que vivía en el sidebar se reubicó al `#app-topbar`
   (`.topbar-user-btn`, junto a Cambiar/Sync/Salir) — es una función real (deshabilita
   validaciones SII), no decorativa, no podía perderse.
4. **Tentáculos del abanico solapados/mal distribuidos** — el algoritmo radial portado del
   prototipo es correcto (verificado ángulo por ángulo contra `new desing.html`), pero asume
   labels cortos de 1-3 palabras ("Estructura contable", "Tributario"). Los labels reales del
   catálogo son más descriptivos y traen detalle entre paréntesis ("Estructura Contable
   (Diario/Mayor/Balance)", 43 caracteres vs. ~20 del prototipo) — con `white-space:nowrap` esos
   chips casi duplican el ancho esperado por el algoritmo y se solapan entre sí. Fix:
   `etiquetaCortaModulo()` en `menu.js` recorta el paréntesis final solo para el texto del chip
   (`.tentacle`); el label completo queda como `title` y el detalle real sigue en
   `MENU_SUBSECCIONES`. El selector de módulo del topbar (panel ancho, sí puede mostrar texto
   largo) no se tocó.
5. **Badges "G1 · Contabilidad" / "G2 · Comercial" etc. obsoletos** — el `.mod-header-badge` de
   10 vistas de módulo seguía mostrando el grupo viejo (G1-G5) en vez del grupo nuevo
   (Comercial/Contabilidad/Empresa); en algunos casos el nombre coincidía por casualidad, en otros
   no (ej. `egresos-ingresos` decía "G2 · Comercial" pero su grupo real ahora es "Contabilidad").
   Se corrigieron los 10 badges contra el `grupo` real de `CAT1_MODULOS`/`CAT2_MODULOS`.

---

## Verificación realizada

- `node PLANIFICACION/verificar.js` → 26/26 ✅ en cada paso.
- Pruebas funcionales en browser real (inspección directa del DOM vía JS, ya que el screenshot
  visual del tool de preview falló repetidamente en esta sesión por un problema del tool, no de la
  app):
  - Expandir/colapsar tarjetas de grupo en Home, con blur de fondo y backdrop correctos.
  - Navegar a un módulo desde un tentáculo → vista correcta, título correcto, abanico se cierra.
  - Dropdown de selector de módulo: 3 grupos + Configuración, ítem activo resaltado, cierra al
    click fuera.
  - Botón "Inicio" vuelve a Home; el header alterna correctamente entre `home-header`/`app-topbar`.
  - Sin errores en consola en ningún flujo probado.

---

## Pendientes / próximo paso

1. ~~**Paso 6**~~ ✅ Completo (2026-07-16) — gráficos del dashboard migrados a Chart.js, ver sección
   dedicada más abajo.
2. **Paso 7** — conectar datos reales en lo que siga siendo placeholder después del paso 6.
3. ~~Reactivar `LOGIN_DESACTIVADO_TEMPORAL = false`~~ ✅ Hecho (2026-07-16), ver sección "Login —
   reactivado" más arriba.
4. Revisar si `.plan-tab`/`.rem-tab` (sub-tabs de Plan de Cuentas y Remuneraciones, sistemas de
   tabs separados de `.mod-tab-btn`) también deberían adoptar el estilo de recorte diagonal, o si
   está bien que se queden como tabs tipo "pill" — no estaban en el alcance explícito de esta
   ronda de fixes, quedó sin decidir.

## Completado en la ronda de fixes del 2026-07-16

- Sidebar legacy (`<aside class="sidebar">`, G1-G5) eliminado por completo del DOM — ver "Bugs
  encontrados" #3.
- Distribución de tentáculos del abanico corregida — ver "Bugs encontrados" #4.
- Tabs de módulo (`.mod-tab-btn`) rediseñadas al estilo de recorte diagonal del prototipo
  (`.tab`/`.tabs` en `new desing.html`), remapeado a los tokens del proyecto.
- Badges de grupo obsoletos (`.mod-header-badge`) corregidos en las 10 vistas que los tenían.

## /qa — comparación directa contra new desing.html (2026-07-16)

Se sirvió una copia local del prototipo (`new desing.html`) lado a lado con la app real para
comparar pantalla por pantalla en vez de guiarse solo por la memoria del diseño. Encontrado y
corregido:

- **Login incompleto**: faltaban por completo el checkbox "Recordarme", el enlace "¿Olvidaste tu
  contraseña?" y los botones sociales Google/Microsoft — los tres documentados en
  `funcionalidades.md` como parte del diseño (decorativos, sin acción real). El CSS
  (`.lrow`/`.lremember`/`.ldivider`/`.lsocial`) ya existía en `main.css` desde el paso 3 pero nunca
  se conectó al HTML. Agregado en `index.html`.
- **Topbar de módulo incompleto**: comparado contra la pantalla App del prototipo, faltaban:
  - Chips de contexto **Empresa/Ejercicio** — el dato real ya existía (`headerEmpresa`/
    `headerPeriodo`, ocultos desde el paso 4) pero nunca se mostraba. Ahora visibles como
    `.field`, alimentados por `aplicarConfiguracion()` (mismo dato real, no inventado).
  - **Buscador** — era un simple ícono; se reemplazó por el `.float-search` completo (placeholder +
    atajo `Ctrl K`), conectado a la función real `busquedaGlobalAbrir()` que ya existía.
  - **Notificaciones** — no existían en absoluto. Agregado el panel `.notif-panel` con las 3
    notificaciones de ejemplo del prototipo — `funcionalidades.md` documenta esto explícitamente
    como contenido de ejemplo/decorativo, no datos reales inventados por esta integración.
  - **Ícono de ayuda** — agregado, decorativo (igual que en el prototipo).
- **Verificado y sin cambios necesarios**: modo oscuro (login y Home), tabs de módulo con el
  recorte diagonal, expandir/colapsar grupos del abanico, todo sin errores de consola.

### Conocido y diferido (no corregido en esta ronda)

- **Colisión visual en el estado vacío de Inicio**: cuando la empresa no tiene datos todavía, el
  panel de onboarding ("Empieza aquí… Sigue estos pasos para configurar tu empresa.") queda
  parcialmente tapado por las tarjetas del abanico (`.home-fan` es `position:fixed`, se superpone
  a cualquier contenido del dashboard que caiga en su misma franja vertical del viewport). Solo se
  tapa una línea de subtítulo secundario — el checklist accionable (los 4 pasos numerados) se ve
  completo. Causa raíz: el prototipo asumía un dashboard de referencia mucho más corto que el
  dashboard real de esta app (hero + indicadores + KPIs), por lo que el mismo posicionamiento fijo
  que funciona bien con datos reales choca en el estado vacío. Requiere una decisión de diseño
  (¿mover el abanico más abajo? ¿acortar el panel de onboarding? ¿aceptarlo tal cual?) antes de
  tocarlo — no se resolvió con un ajuste de píxeles a ciegas.

## Auditoría de diseño — botones, tarjetas, bordes y animaciones (2026-07-16)

Ronda pedida explícitamente por el usuario: "auditoría completa de diseño… adaptar pestañas,
botones, bordes, animaciones, todo" usando `new desing.html` como fuente. Las tabs ya estaban
correctas (ver sección anterior). Se auditaron los tres lenguajes visuales restantes en
`css/main.css`/`css/auditor.css` comparando propiedad por propiedad contra el `<style>` del
prototipo:

- **Botones (`.btn-primary`/`.btn-secondary`/`.btn-danger`)**: el prototipo NO usa gradiente ni
  glow difuso — usa color sólido + una sombra dura desplazada (`0 2px 0 var(--coral-deep)`) que
  imita un botón "prensado" en 3D, y se comprime (`translateY(1px)`, sombra a 1px) al hacer click.
  El estilo anterior (`--accent-grad` + `--accent-glow`/`--accent-glow-lg`, `filter:brightness()`)
  era una herencia del sistema de diseño previo ("ID Workshop", ver comentarios que quedaban en el
  CSS). Reescritos los tres para usar el lenguaje de sombra dura del prototipo:
  - `.btn-primary`: coral sólido, `box-shadow: 0 2px 0 var(--coral-deep), var(--shadow-1)`.
  - `.btn-secondary`: alineado a `.btn-outline` del prototipo — borde navy 1.5px en vez de borde
    gris + hover accent; en modo oscuro conserva borde `--divider` (el navy no tiene contraste
    suficiente sobre fondos oscuros, ver `[data-theme="dark"] .btn-secondary` en el prototipo).
  - `.btn-danger`: no existe en el prototipo (no tiene semántica de peligro), así que se mantuvo el
    rojo (`--negative`) pero con la misma familia de sombra dura que `.btn-primary`, para que las
    tres variantes se sientan como un solo sistema de botones.
- **Tarjetas (`.card`, `.kpi-card`)**: `border-radius` estaba en `20px` hardcodeado (herencia
  "ID Workshop"); el prototipo usa el token `--radius-m` (14px) para toda tarjeta/panel. Cambiado
  a `var(--radius-m, 14px)` en ambas clases. `.kpi-card:hover` tenía `translateY(-6px)` — mucho más
  “rebote” que el `translateY(-2px)` del prototipo — normalizado a -2px en ambas. Se agregó la
  barra superior degradada periwinkle→coral que el prototipo revela en hover (`.card::before`,
  opacity 0→1), ausente por completo en el CSS anterior.
- **Bordes / radios (sweep global)**: normalizados a los tokens `--radius-s` (8px, controles/
  inputs/botones pequeños) y `--radius-m` (14px, tarjetas/modales) donde el elemento es
  compartido por toda la app: `input,select,textarea` global, `.modal-box`, `.ctc-modal-box`, y
  **todas** las ocurrencias de `border-radius: 6px` (14 en `main.css`, botones pequeños de
  Plan de Cuentas/cartolas/honorarios/IA-export/etc.) vía sustitución mecánica — riesgo nulo porque
  6px→8px es un cambio de redondeo imperceptible, no de layout.
- **Deliberadamente NO tocado** (fuera del alcance de esta ronda, ver razones):
  - Radios de paneles muy específicos de un solo módulo (`bc-liquidez`, `hon-res-pos/neg`,
    `cal-item`, `panel-cal-*` de Auditor, `emp-item`) — son pantallas que el prototipo ni siquiera
    contempla (no existen en `new desing.html`), así que no hay una referencia real contra la cual
    "coincidir"; tocarlas es puro reordenamiento cosmético sin ganancia de fidelidad al diseño.
  - `.cont-table` (Diario/Mayor — grid de bordes completos en cada celda): el prototipo usa tablas
    sin bordes verticales, solo `border-bottom`. Se dejó el grid completo a propósito: es una tabla
    de libro contable con muchas columnas numéricas donde el grid ayuda a leer alineación de
    columnas; el prototipo no incluye una tabla de este tipo como referencia. Los colores de borde
    ya usan los tokens correctos (`var(--divider)` → `--rule`), solo difiere la estructura.
  - El FAB de acciones rápidas (`.fab`/`.fab-main`/`.fab-menu` con 4 atajos: Nuevo asiento, Nueva
    auditoría, Nota rápida, Agregar atajo) del prototipo no tiene equivalente en la app — el botón
    circular inferior-derecho existente es el FAB de "Asistente IA" (`.ia-chat-fab`), una función
    real distinta. Construir el FAB decorativo del prototipo (con acciones que no existen todavía)
    es trabajo de Paso 7 (conectar funciones reales), no de esta auditoría visual.

Verificado en browser (`localhost:8080`, tema claro y oscuro, vista Home y Estructura Contable):
botones con sombra dura visible, tabs con el recorte diagonal intacto (`clip-path` confirmado por
`getComputedStyle`), tarjetas a 14px de radio. `node PLANIFICACION/verificar.js` → 26/26 ✅ tras
los cambios. Sin commitear — pendiente de revisión del usuario.

## Restructuración de encabezados de módulo (2026-07-16)

El usuario marcó, con capturas del prototipo lado a lado con la app, que pese a que colores/formas
ya coincidían, la **distribución** seguía sin parecerse: el prototipo tiene una topbar de una sola
fila limpia (volver, selector de módulo, chips Empresa/Ejercicio, buscador, iconos) y el título de
página vive aparte, sin duplicarse. La app real tenía tres filas apiladas y con corte visual: fila 1
= volver + selector + **un H1 enorme duplicando el nombre del módulo** + chips; fila 2 = buscador +
`local@offline`/badge `Administrador`/Modo Prueba/Cambiar/Sync/Salir como texto suelto; fila 3 =
otro `<span>` con el mismo nombre del módulo + badge de grupo, antes de las tabs. Tres bordes
distintos, tres densidades de texto distintas — de ahí la sensación de "genérico"/interrumpido.

Causa raíz: `#txt-modulo-titulo`/`#txt-modulo-desc` (el título real y dinámico, ya alimentado por
`titulos[modulo]` en `navegar()` de `app.js`) vivía metido dentro de `.topbar-inner`, compitiendo
por la misma fila que el selector de módulo y los chips; y cada vista tenía además su propio
`.mod-header` estático (título+badge) duplicando esa misma información antes de sus tabs.

Corregido:
- **Topbar** (`index.html` `#app-topbar`): se sacó el bloque `<h1>/<p>` de `.topbar-inner`. Ahora la
  fila es idéntica en estructura al prototipo: volver → selector de módulo → chips Empresa/Ejercicio
  → buscador (`margin-left:auto`) → iconos (notificaciones, ayuda, tema, cuenta).
- **Menú de usuario**: los botones reales (Modo Prueba, Cambiar empresa, Sincronizar, Salir) y el
  email de sesión ya no van sueltos como texto en la topbar — se movieron, sin tocar su lógica
  (mismos ids, mismos `onclick`), dentro de un dropdown detrás de un `.avatar-seal` (mismo patrón
  click-to-open que `.module-switch`/`.notif-panel`: `toggleUserMenu()` nuevo en `menu.js`, con
  cierre al hacer click fuera). El avatar muestra las iniciales reales de la empresa (mismo cálculo
  que `homeAvatarSeal`, ahora también aplicado a `topbarAvatarSeal` en `aplicarConfiguracion()`).
- **Título de página**: el H1/descripción dinámico se reposicionó a una barra propia
  (`.page-title-bar`, nueva) entre la topbar y las tabs de cada vista — se oculta en Inicio igual
  que la topbar (`actualizarTopbarModulo()` en `menu.js` ahora también togglea `#pageTitleBar`).
- **Eliminados los 10 `.mod-header` estáticos** (uno por vista de grupo) que duplicaban el título:
  ya no aportaban nada que el título global no mostrara (y con mejor texto real, p. ej. "Contabilidad
  — Estructura Contable" en vez de solo "Estructura Contable" + badge suelto). CSS muerto
  correspondiente (`.mod-header`/`.mod-header-title`/`.mod-header-badge`) también eliminado de
  `main.css`.

**Desviación consciente vs. el prototipo**: en `new desing.html` el orden es tabs → título de
página, dentro de `.content`. Esta app usa una arquitectura distinta (cada vista es un bloque
estático con sus propias tabs adentro, no una tabla de tabs global re-renderizada por JS como en
el prototipo), así que un único título dinámico compartido no puede insertarse *dentro* de cada
vista sin duplicar lógica de JS por módulo. Se optó por mantenerlo como barra global, posicionada
**antes** de las tabs en vez de después — intercambio de orden menor, no un patrón inventado (es
común en apps profesionales: Linear, Notion y Stripe Dashboard también ponen el título de página
sobre las tabs). El resultado ya no tiene las filas duplicadas/rotas que motivaron el reclamo.

Verificado en browser (`localhost:8080`, 1440px, claro y oscuro): topbar de una sola fila,
dropdown de usuario abre/cierra y conserva los botones reales funcionando, título dinámico correcto
por módulo, Inicio sin restos de la barra de título. `node PLANIFICACION/verificar.js` → 26/26 ✅.
Sin commitear.

## Paso 6 — Gráficos SVG a mano → Chart.js (2026-07-16)

`js/services/dashboard.js` dibujaba dos tipos de gráfico del dashboard de Inicio con `<svg>` armado
a mano (paths/arcos calculados con trigonometría propia): `_renderBarrasMensuales()` (barras
ingresos/gastos por mes) y `_svgDonut()` (usado por los dos donuts: estructura Activo/Pasivo/
Patrimonio y resultado Ingresos/Gastos). Además usaban una paleta de colores vieja hardcodeada
(`#3b82f6`, `#f87171`, `#34d399`, `#a78bfa`, `#fb923c`, `#64748b`...) que nunca se actualizó cuando
se migró la paleta navy/coral/periwinkle en el paso 1.

Reemplazado por `Chart.js` (CDN, `chart.js@4.4.4`, mismo patrón que jsPDF/SheetJS — sin `npm
install`, ver `index.html` `<head>`):
- `#dashBarrasMensuales`/`#dashDonutActivos`/`#dashDonutResultado` pasaron de `<div>` a `<canvas>`
  en `index.html`, con el wrapper con `height` fijo (Chart.js con `maintainAspectRatio:false`
  necesita un contenedor con altura explícita).
- `dashboard.js`: `_dashChartColors()` nueva — lee los tokens reales de `variables.css`
  (`--periwinkle`, `--coral`, `--navy`, `--ok`, `--rule`, `--font-mono`...) vía
  `getComputedStyle(document.documentElement)` en cada render, así los gráficos ya no tienen colores
  fijos y se actualizan solos con el tema. `refrescarGraficosDashboard()` nueva, expuesta en
  `window`, se llama desde `applyTheme()` (script inline de `index.html`) para redibujar con los
  colores correctos al cambiar claro/oscuro.
- Los datasets/valores reales que ya calculaba el código viejo (meses, ingresos, gastos, activos,
  pasivos, patrimonio) se conservan intactos — solo cambió el motor de dibujo, ninguna lógica de
  negocio.
- De paso, se corrigieron los demás colores hardcodeados que quedaban en el mismo archivo
  (`setKPI`, `_calcularLiquidezDash`, badges Activo/Anulado de `_renderUltimosAsientos`, colores por
  tipo de cuenta en `_renderTopCuentas`) para usar los tokens (`var(--positive)`, `var(--ok)`,
  `var(--periwinkle)`, etc.) en vez de hex sueltos — mismo tipo de deuda que se venía limpiando en
  `main.css`/`auditor.css` en la ronda de auditoría de diseño anterior, pero que no se había tocado
  todavía en este archivo por ser JS, no CSS.

**Bug real encontrado y corregido durante la verificación**: con la configuración por defecto de
Chart.js (`animation` activa), los tres gráficos quedaban con el `<canvas>` completamente en blanco
— `Chart.getChart(canvas)` reportaba una instancia válida con los datos correctos, pero
`getImageData()` mostraba 0 píxeles no transparentes incluso más de un segundo después de crearlos.
Diagnosticado descartando causas (el canvas tenía tamaño y posición correctos, `chart.data` tenía
los valores esperados, un canvas aislado de prueba sí pintaba) hasta aislar que llamar
`chart.draw()` manualmente sí pintaba de inmediato — es decir, el primer frame animado, programado
por Chart.js vía `requestAnimationFrame`, nunca se estaba disparando en el entorno de prueba
(pestaña sin foco/en segundo plano del navegador de verificación). Fix: `animation:false` en las
tres configuraciones — pinta de forma síncrona en la construcción, sin depender de rAF. Efecto
secundario positivo: el dashboard ya no "crece" cada vez que se revisita Inicio, más predecible.

Verificado inyectando datos de prueba en memoria del navegador (sin tocar `localStorage` real) y
leyendo los píxeles del canvas directamente: los colores dominantes de cada gráfico coinciden
exactamente con los tokens esperados — `rgb(146,165,253)` = `--periwinkle`, `rgb(255,134,146)` =
`--coral`, `rgb(31,181,121)` = `--ok`, `rgb(232,104,122)` = `--coral-deep` — confirmado en modo
claro y oscuro. `node PLANIFICACION/verificar.js` → 26/26 ✅. Sin commitear.

### Pendientes / próximo paso (actualizado)

1. Paso 7: revisar qué queda placeholder tras el paso 6 (KPIs de Inicio ya son datos reales; el FAB
   de acciones rápidas del prototipo — Nuevo asiento/Nueva auditoría/Nota rápida/Agregar atajo — no
   tiene equivalente real todavía, ver sección anterior).
2. Decisión de diseño sobre la colisión onboarding/abanico (ver sección de arriba).
3. Revisar el ancho del buscador (`.float-search`) en viewports angostos (~800px) — en pruebas se
   ve apretado/envuelve texto; a 1440px se ve correcto. No se tocó todavía porque el prototipo
   tampoco define un breakpoint explícito para esto.
4. Probar el flujo de login real completo con una cuenta Firebase válida (creación de cuenta,
   recuperar contraseña real si se conecta esa función, selector de empresa) — lo verificado hasta
   ahora es que el overlay se activa y se ve correcto; el `happy path` de autenticación en sí no se
   probó end-to-end en este entorno (no hay credenciales de prueba a mano).

## PDF real extendido a Balance Clasificado, Estado de Resultados y Flujo de Caja ✅ (2026-08-11)

Continuación de la extensión del formato de PDF real (jsPDF + autoTable) al resto del grupo
"Reportes Financieros" — mismo patrón que Diario/Mayor/Balance General.

- **Balance Clasificado**: se extrajo `_calcularBalanceClasificado()` en `balance-clasificado.js`
  (mismo criterio que `_calcularBalance()`), separando el cómputo puro (secciones, totales,
  indicadores de liquidez) del renderizado HTML. El PDF apila las dos columnas de pantalla
  (Activo | Pasivo+Patrimonio) en una sola tabla continua con encabezados de sección, cuentas
  Contra/anómalas en rojo, y los indicadores de liquidez como texto debajo de la tabla.
- **Estado de Resultados**: se extrajo `_calcularEstadoResultados(mes, anio)` en
  `estado-resultados.js` (cascada de 4 niveles de utilidad, sin la tasa de impuesto — eso queda
  como supuesto de pantalla/export, no dato del período). El PDF reproduce la misma cascada con
  títulos de sección, montos negativos en rojo, y las 4 líneas de utilidad destacadas.
- **Flujo de Caja**: se extrajo `_calcularFlujoCaja(mes, anio)` en `flujo-caja.js`. El PDF lista
  las 3 secciones de actividades con sus líneas y subtotales — el gráfico de 12 meses no se
  replica (es visual/canvas, no datos tabulares).
- **Bonus fuera de lo pedido pero de bajo costo dado el trabajo de arriba**: se encontraron y
  arreglaron `exportarExcelBalanceClasificado()`, `exportarExcelEstadoResultados()` y
  `exportarExcelFlujoCaja()`, las 3 rotas desde antes de esta sesión — escaneaban
  `#view-xxx .cont-table`, pero esas 3 vistas son `<div>` huérfanos vacíos (el contenido real
  vive en otro contenedor con divs propios, no una tabla), así que el Excel salía vacío. Ahora
  usan las mismas funciones de cómputo puro que los PDF, con celdas numéricas reales (mismo
  criterio que `exportarExcelBalance()`, ya arreglado antes esta sesión).

Verificado en navegador con datos de prueba: los 3 PDF se generan sin error (vista previa en
pestaña nueva), los 3 Excel ahora exportan filas reales con valores numéricos (antes: vacíos) —
confirmado que Balance Clasificado cuadra (Activo = Pasivo+Patrimonio) con números reales de la
celda, no texto scrapeado. `node PLANIFICACION/verificar.js` → 20/20 ✅. Cero errores de consola
nuevos. Datos de prueba limpiados.

## Inicio: hub sin diamantes + riel de 3 secciones con Configuración al final ✅ (2026-08-12)

Rediseño de `#view-inicio` inspirado en la interacción de `auditor - copia` (versión "Kluster",
carpeta local sin trackear) — tocar un grupo de módulos abre un panel lateral con chips — pero
**sin** la geometría de gemas/Voronoi de esa versión (facetas SVG estilo piedra tallada), y con un
riel de 3 secciones (Centro de mando → Financiero y actividad → Configuración) portado
conceptualmente desde un prototipo sin construir dentro de esa misma carpeta
(`PLANIFICACION/kluster-rediseno.html`).

- **`#view-inicio`** pasó de 2 capas superpuestas (`.home-fan` flotando sobre `.home-body`) a 3
  "slides" (`#inSlide0` hub de grupos, `#inSlide1` el dashboard real sin cambios internos,
  `#inSlide2` hub de Configuración) dentro de `#inViewport`, con paginación por
  `scroll-snap-type:y proximity` y un riel de puntos (`#inRail`, 🧭📊⚙️).
- **Nuevos `js/services/home-hub.js` y `css/home-hub.css`**: `renderHomeHubTiles()` (tarjetas
  planas, sin `--tilt`/`--lift`/gemas) reemplaza a `renderHomeGroups()`; `abrirGrupoHome()`
  (overlay + panel centrado con chips, con hint de subsecciones al pasar el cursor — mismo dato
  `MENU_SUBSECCIONES` que ya existía) reemplaza a `toggleGrupoHome()`, adaptado de `abrirPulpo()`
  de auditor copia descartando toda la geometría de gemas (`klGemSvg`/`klFacetsOf`/Voronoi) y la
  animación de fragmentos volando — el panel simplemente aparece con fade/scale.
- **Sección 3 (Configuración)**: `CONFIG_HOME_GRUPOS` colapsa las 7 tarjetas reales de
  `#view-configuracion` en 3 grupos (Empresa / Usuarios y Sesión / IA y Sincronización) — esa vista
  no se duplica ni se modifica, solo se le agregaron 7 ids ancla (`cfgCard*`); tocar un ítem del
  panel navega a Configuración y hace scroll hasta el card real.
- **`css/main.css`**: eliminado el bloque completo del abanico viejo (`.home-fan`, `.group-card`,
  `.tentacles`, `.tentacle-data`, ~85 líneas). **`menu.js`**: eliminadas `renderHomeGroups`/
  `toggleGrupoHome`/`cerrarGrupoHome`/`irAModuloDesdeHome`/`HOME_FAN_*` (sus reemplazos viven en
  `home-hub.js`); `refrescarMenuNavegacion()` ahora llama `renderHomeHubTiles()`.
  **`app.js`**: `navegar()` llama `irASeccion(0)` al entrar a Inicio, para no dejar al usuario
  varado en la Sección 3 si volvió a Inicio después de haber scrolleado hasta ahí.

**Desviación consciente vs. el prototipo**: `kluster-rediseno.html` pagina con
`transform:translateY()` manual + handlers de `wheel`/`touch` que interceptan el scroll por
completo — funciona ahí porque sus secciones son mockups de un viewport exacto, pero la Sección 2
real (el dashboard existente) es mucho más alta que un viewport, así que ese mecanismo le rompería
el scroll interno; además un `transform` en el contenedor rompe el `position:fixed` del modal
"Editar empresa", anidado adentro. Se usó `scroll-snap` nativo en su lugar — mismo resultado
visual, sin esos dos problemas.

**Bug real encontrado y corregido durante la verificación**: `#inViewport` se armó inicialmente con
`height:100%` en cascada desde `#view-inicio`, pero la cadena de ancestros
(`body → .main-content → .view-container`) nunca tiene una altura *definida* en términos de CSS
(`body` usa `min-height:100vh`, no `height:100vh`) — el porcentaje no resolvía contra nada y el hub
crecía al alto de todo su contenido apilado (los 3 slides completos, incluido el dashboard) en vez
de acotarse a una pantalla. Fix: `#inViewport` se dimensiona con
`calc(100dvh - var(--home-header-h))`, midiendo el alto real de `#home-header` por JS
(`_hhMedirHomeHeader()`, misma técnica de anclar a viewport que ya usa `.sidebar{height:100vh}`).
Esa medición se dispara desde `actualizarTopbarModulo()` (único punto que muestra/oculta
`#home-header`) — un `ResizeObserver` sobre el toggle `display:none→flex` no disparaba el callback
de forma confiable en las pruebas, así que se descartó a favor del hook explícito.

Verificado en navegador (claro/oscuro, 1280×800 y mobile 375px, con service worker/caché limpiados
entre pruebas): Inicio abre en la Sección 1 con 3 tarjetas planas; tocar una abre el panel con sus
módulos y el hint de subsecciones al pasar el cursor; elegir un módulo navega correctamente; los
puntos del riel cambian de sección con scroll normal y con `irASeccion()`; la Sección 2 muestra el
dashboard real intacto con su scroll interno normal (no salta de sección en cada tick de rueda); el
modal "Editar empresa" sigue cubriendo toda la pantalla; la Sección 3 muestra 3 tarjetas de
Configuración, tocar un ítem navega a Configuración y hace scroll automático hasta el card real;
volver a Inicio desde otro módulo aterriza siempre en la Sección 1; responsive mobile sin solape
entre el riel y las tarjetas. `node PLANIFICACION/verificar.js` → 20/20 ✅. Sin commitear.

## Dashboard de Inicio (Sección 2) recortado igual al prototipo ✅ (2026-08-12)

El dashboard real (Sección 2, `#inSlide1`) era mucho más grande que la Sección 2 del prototipo
(`auditor - copia/PLANIFICACION/kluster-rediseno.html`, líneas 1362-1401: 2 columnas, KPIs
compactos con delta, un gráfico, un resumen de actividad de una línea, una línea de indicadores y
2 donuts). Se pidió explícitamente recortar todo lo que el prototipo no tiene ("Igual al
prototipo" — la opción más literal de 3 alternativas, confirmada por el usuario tras marcar que
"Eliminar empresa" solo vivía en la tarjeta que se iba a borrar).

**Eliminado** (sin reemplazo, tras confirmar que no rompía nada):
- `dash-hero` (tarjeta de nombre/RUT/versión + botones Editar/Eliminar empresa) y su modal
  `#modalEditarEmpresa` — el nombre de la empresa ya se repite en `#home-header` (persistente en
  las 3 secciones) y los mismos campos de edición ya existen en Configuración → "Configuración
  Empresa". `abrirEditarEmpresa`/`cerrarEditarEmpresa`/`guardarEdicionEmpresa`/
  `eliminarEmpresaActual` (firebase-service.js) se eliminaron por completo: no tenían ningún otro
  caller en toda la app, así que "Eliminar empresa" deja de estar disponible en la UI (queda
  documentado acá, no es un descuido).
- `#dashAccesosRapidos` (MRU de navegación) y `_renderAccesosRapidos()` — duplicaba conceptualmente
  los tiles de grupo de la Sección 1.
- `#dashLiquidez` y `_calcularLiquidezDash()`/`_renderLiquidezDash()` (dashboard.js) — sin otro uso
  en el código (la Liquidez de Balance Clasificado es una función/CSS totalmente aparte, no se
  tocó).
- `#iaAlertasTribuCard` — **resultó ser markup ya muerto** antes de este cambio: el botón real
  ("⚠️ Analizar obligaciones tributarias" en Configuración) llama a `iaAlertasTribu()` (ia.js), que
  muestra el resultado en un modal propio creado por `_iaMostrarResultado()`, no en este card. Se
  confirmó con grep que nada poblaba `#iaAlertasTribuCont`.

**Simplificado** (mismos datos reales, formato más chico):
- `#widgetIndicadores` (6 cards UF/UTM/IPC/TPM/USD/EUR, colapsable, con botón Actualizar) →
  `_renderIndicadoresLinea()` nueva en indicadores.js: una sola línea de texto "UF $X · UTM $Y ·
  USD $Z" (mismos 3 indicadores que el prototipo), leyendo el mismo `window.indicadoresEconomicos`
  que ya alimentaba las cards viejas — el auto-refresh cada 12h (`_autoActualizarSiNecesario`)
  sigue funcionando igual, solo se perdió el botón de refresco manual desde Inicio. Las 6 cards con
  fecha/fuente individual siguen disponibles en Remuneraciones → Indicadores Previsionales.
- `.kpi-grid` (4 cards grandes con ícono) → `.kpi-grid-compacta`/`.kpi-mx` (mismos 4 KPIs e ids
  `kpi-activos/pasivos/ingresos/resultado`, sin cambiar `calcularKPIs()`). El prototipo muestra un
  % de variación por KPI que no existe como dato real en la app — se omitió en vez de inventar una
  cifra.
- `_renderUltimosAsientos()`/`_renderTopCuentas()` (dashboard.js): de listas completas (5
  asientos / 6 cuentas) a un resumen de una línea cada una (`.actividad-mini`, igual al
  prototipo) — "N este mes" (se cuenta por mes, no por día como el mockup, porque en uso real casi
  siempre da 0 registrados hoy) y "Cuenta — $monto" (la de mayor saldo).
- Gráficos (`dashBarrasMensuales`, `dashDonutActivos`, `dashDonutResultado`): sin cambios de lógica,
  solo reordenados dentro del nuevo layout `.s2-grid` (2 columnas) para calzar con el prototipo.

**Fuera de alcance**: `#dash-onboarding` (panel de bienvenida cuando no hay datos) se mantuvo tal
cual — el prototipo no lo tiene porque sus mockups asumen datos ya cargados, pero es un estado
funcional real de la app, no contenido de dashboard a recortar.

**CSS muerto eliminado de `main.css`** (todo confirmado sin otros usos vía grep antes de borrar):
bloque completo "DASHBOARD HERO CARD" (`.dash-hero*`/`.dash-meta-chip*`), `.kpi-grid` (no
`.kpi-card`/`.kpi-icon`/`.kpi-valor`/`.kpi-label`, esas se mantienen: las reutilizan
cartolas.js/remuneraciones.js/clientes.js), sección "INDICADORES ECONÓMICOS" (`.ind-card*`),
sección "LIQUIDEZ — DASHBOARD" (`.dash-liq-*`, sin tocar la sección aparte "LIQUIDEZ — BALANCE
CLASIFICADO"), `.dash-asiento-*`/`.dash-cuenta-*`/`.dash-quick-chip*`, `.ia-alertas-card`. CSS
nuevo agregado a `css/home-hub.css` (`.s2-grid`/`.s2-col`/`.kpi-grid-compacta`/`.kpi-mx*`/
`.in-card`/`.donut-row`/`.actividad-mini`), adaptado del prototipo a los tokens reales de
`variables.css`.

**Bug real encontrado y corregido durante la verificación**: en mobile (375px), `.s2-grid`/
`.kpi-grid-compacta` se desbordaban horizontalmente pese a la media query de `max-width:900px`
que sí colapsaba a 1 columna — el `<canvas>` del gráfico de barras fuerza un ancho mínimo de
contenido, y por default los tracks de CSS Grid no encogen bajo ese mínimo (`min-width:auto`
implícito). Fix: `minmax(0, 1fr)` en vez de `1fr` a secas en `.s2-grid`/`.kpi-grid-compacta` (y sus
overrides responsive), más `min-width:0` en `.s2-col`/`.donut-row .in-card`/`.actividad-mini > div`
— mismo principio que el fix de altura de `#inViewport` de la sección anterior, pero en el eje
horizontal.

Verificado en navegador con datos de prueba inyectados en memoria (`dbAsientos`, nunca en
localStorage): KPIs/gráfico de barras/donuts/línea de indicadores/resumen de últimos asientos y
top cuenta muestran cifras reales y correctas: activos $700.000, pasivos $300.000, ingresos
$500.000, resultado $400.000, "3 este mes", "Caja — $500.000". Tema claro y oscuro correctos.
Mobile 375px sin desborde horizontal tras el fix. Cero errores de consola nuevos (solo los
`ERR_BLOCKED_BY_RESPONSE.NotSameSite` preexistentes, no relacionados). `node
PLANIFICACION/verificar.js` → 20/20 ✅. Sin commitear.

## PDF real extendido a Libro Mayor y Balance de Comprobación ✅ (2026-08-11)

Pedido explícito: aplicar el mismo formato de PDF con texto real (jsPDF + autoTable, sin
`window.print()`) construido para el Libro Diario también al Libro Mayor y al Balance General.

- Se ajustó primero el propio Diario: el sombreado alterno por asiento se veía mezclado porque
  nunca se fijó `theme` en `doc.autoTable()`, y el tema por defecto (`'striped'`) alterna el
  color fila por fila por su cuenta, pisando la lógica de agrupar por asiento. Fix: `theme: 'grid'`
  en las 3 tablas (Diario/Mayor/Balance) para que el único sombreado aplicado sea el mío.
- También se cambió `doc.save(...)` (descarga forzosa) por abrir el PDF en una pestaña nueva
  (`window.open(doc.output('bloburl'))`, con `doc.setProperties({title})` para que el visor
  sugiera un nombre de archivo razonable) — pedido explícito de vista previa antes de
  descargar/imprimir. Extraído a un helper compartido `_abrirPreviewPDF(doc, nombreArchivo)`
  reusado por los 3 exports.
- **Libro Mayor**: se extrajo `_datosMayorFiltrado()` en `mayor.js` (mismo criterio que
  `_asientosDelMesDiario()` para el Diario) — cuentas + historial ya filtrados por
  `_mayorFiltrosCuenta`/`_mayorFiltrosPeriodo`/`_mayorCuentasIntervinientes`, reusado tanto por
  `generarLibroMayor()` (pantalla) como por `exportarPDFMayor()` (nuevo). La tabla agrupa por
  cuenta (mismo sombreado alterno + borde separador que el Diario agrupa por asiento), con la
  fila de "Saldo DEUDOR/ACREEDOR" en negrita al final de cada cuenta.
- **Balance de Comprobación**: `exportarPDFBalance()` reusa `_calcularBalance()` (ya existía,
  construida esta sesión para el Excel) — 9 columnas (Cuenta/Debe/Haber/Deudor/Acreedor/Activo/
  Pasivo/Pérdida/Ganancia), cuentas con saldo anómalo en rojo con ⚠, filas SUBTOTALES/UTILIDAD-
  PÉRDIDA/TOTALES IGUALES en negrita. Al ser una fila por cuenta (sin múltiples líneas como
  Diario/Mayor) el sombreado alterna por fila simple, no por grupo.

Verificado en navegador con datos de prueba: capturando `didParseCell` se confirmó que el
sombreado/negrita/bordes caen exactamente donde correspondía en los 3 reportes (Diario: por
asiento: Mayor: por cuenta; Balance: por fila). `node PLANIFICACION/verificar.js` → 20/20 ✅.
Cero errores de consola nuevos. Datos de prueba limpiados.

## PDF real del Libro Diario + generador de asiento de pago F29/IVA ✅ (2026-08-11)

Tres pedidos del usuario en un mismo mensaje:

1. **"útiles de oficina no es necesario que aparezca"** — resuelto sin tocar código. Era un chip
   del indicador de saldo disponible (sesión anterior): esa cuenta quedó clasificada como
   "Disponible" en el Plan de Cuentas del usuario. El usuario prefirió corregir la clasificación
   él mismo desde Plan de Cuentas en vez de volver el indicador a una lista fija de nombres.
2. **PDF real del Libro Diario.** Confirmado que era el único reporte de la app sin ningún botón
   de exportar, y que TODOS los `exportarPDFXxx()`/`imprimirXxx()` existentes en
   `js/services/exportar.js` terminan en `window.print()` sobre el DOM en vivo (0 usos de
   `jsPDF()` en todo el código pese a estar cargado). Se agregó `jspdf-autotable` (`index.html`)
   y una función nueva, `exportarPDFDiario()`, que arma el PDF con `doc.text()`/`doc.autoTable()`
   — texto real, no una captura. Verificado inspeccionando el PDF generado a bajo nivel: contiene
   operadores de texto (`Tj`/`TJ`) y diccionario `/Font`, sin ningún `/Image` real embebido (el
   único match de "/Image" era el `/ProcSet` estándar de PDF, no una imagen). Se agregó también
   `_asientosDelMesDiario()` en `diario.js` como helper reutilizable (antes el filtro por
   mes/año vivía inline dentro de `renderHistorialDiario()`, sin poder reusarse). Alcance
   acotado al Diario — el resto de los reportes sigue con `window.print()`, no se tocaron.
3. **Generador del asiento de pago F29/IVA.** `js/services/iva-resumen.js` ya calculaba IVA
   Débito/Crédito/remanente/neto a pagar pero no generaba ningún asiento. Se agregó
   `generarAsientoPagoIVA()`, con el mismo patrón de idempotencia por prefijo de glosa que ya usan
   `generarAsientoCompras()`/`generarAsientoVentas()` (reclick actualiza el mismo asiento en vez
   de duplicarlo) — botón "📝 Generar asiento de pago en el Diario" visible solo cuando hay IVA a
   pagar (`d.ivaAPagar > 0`; con remanente a favor no hay nada que pagar, solo aparece el botón
   existente de "Guardar remanente"). El asiento debita IVA Débito Fiscal, acredita IVA Crédito
   Fiscal (incluyendo el remanente reajustado consumido, ya que no existe una cuenta contable
   separada para remanente) y acredita Banco por el neto — verificado en el navegador que tras
   generarlo, ambas cuentas de IVA quedan exactamente en $0 en el Mayor cuando las ventas/compras
   del período ya fueron centralizadas (`generarAsientoVentas()`/`generarAsientoCompras()`).

Verificado en navegador con datos de prueba (ventas/compras del mes, flujo completo de
centralización → generación del asiento de pago, reclick para confirmar idempotencia, caso de
remanente a favor sin botón de pago). Cero errores de consola nuevos.
`node PLANIFICACION/verificar.js` → 20/20 ✅. Datos de prueba limpiados de `localStorage`.

## Monitoreo en tiempo real de saldos + fix del F29 ✅ (2026-08-10)

Pedido explícito del usuario: detectar en tiempo real, mientras se arma un asiento en el Libro
Diario, si algún movimiento dejaría una cuenta como Caja o Banco sin fondos suficientes — no
recién al mirar el Balance más tarde. Alcance acotado a Diario (calculadora, glosa libre, Asiento
Manual); los otros 6 puntos que generan asientos "por lote" (Compras/Ventas/Cartolas/Activos/
Remuneraciones) quedaron fuera a propósito, sin vista previa interactiva donde tuviera sentido.

Implementado en `js/core/contabilidad.js` (`listarCuentasDisponible()`,
`_saldoActualCuentasDisponible()`, `evaluarImpactoDisponible()` — clasificación siempre por
`subgrupo === 'Disponible'`, plan-agnóstico, nunca lista fija de nombres) y `js/services/diario.js`:
- Indicador permanente "Caja: $X disponible" (verde/rojo) en la calculadora/glosa y en el modal
  de Asiento Manual, sincronizado en cada mutación de `dbAsientos` vía `renderHistorialDiario()`.
- Aviso inline antes de guardar (`renderPreasiento()`/`actualizarTotalesManual()`, sin listeners
  nuevos, reusan los re-render existentes).
- Confirmación soft-gate (`mostrarConfirm`) al guardar si el asiento dejaría una cuenta
  "Disponible" negativa — el usuario puede continuar igual (giro en descubierto intencional).
  Encadenada con el gate existente de "cuentas no registradas" (`_confirmarYCrearCuentasFaltantes`)
  para que nunca aparezcan 2 diálogos simultáneos.
- `asientoEditando` excluye el asiento propio del cómputo al editar (agregado también en
  `editarAsiento()`, no solo en el modal manual — encontrado durante la verificación).

Bug encontrado y corregido durante la verificación: `fmt(0)` devuelve `"-"` (correcto en tablas),
pero en los montos sueltos del nuevo indicador/aviso se leía como error — se agregó manejo
explícito de cero y de signo (`_fmtMonto`/`_fmtMontoConSigno`) en vez de asumir siempre valor
absoluto.

De paso se corrigió el reporte de F29 (usuario: "no sirve"), investigado con un agente de
exploración: no era un problema de cálculo (probado con datos de prueba, el IVA Débito/Crédito
calculó bien), sino que ambas pantallas de F29 (Primera Categoría en `iva-resumen.js`, Honorarios
en `segunda-categoria.js`) abrían siempre en Enero/2023 por un guard roto (`!select.value` nunca
es cierto en un `<select>` sin opción `selected`) y nunca inicializaban sus propios selects de
período. Con todo en $0 y en el período equivocado, se veía como roto. Fix: guard con
`dataset.init` (mismo patrón que `_initSelFlujoCajaAnio()` en `app.js`), inicializar también
`f29honMes`/`f29honAnio`, y mostrar "$0" explícito en vez del guión pelado de `fmt(0)` en los KPIs
de cabecera.

Verificado en navegador con datos de prueba (asientos que dejan Caja en negativo, cuenta nueva +
saldo insuficiente en secuencia, modo edición, Asiento Manual, venta/compra de prueba para el
IVA): todo funciona como se diseñó, cero errores de consola nuevos. `node PLANIFICACION/verificar.js`
→ 20/20 ✅. Datos de prueba limpiados de `localStorage`.

## Separación completa por mes/año en todos los reportes ✅ (2026-08-10)

Pedido explícito del usuario: extender el filtro de mes/año (ya construido antes en esta misma
sesión para Balance General, Balance Clasificado y el historial del Libro Diario) a **todos** los
demás registros e informes de la app. Investigación previa con 2 agentes Explore identificó los
gaps reales (la mayoría de Honorarios/Documentos/Cartolas/Conciliación ya estaban cubiertos):

- **Libro Mayor** (`mayor.js`): tenía selector de período pero arrancaba en "Todos los períodos"
  por defecto — se corrigió para que arranque en el mes actual. De paso se encontró y arregló un
  bug real: `_mayorGetPeriodos()` y el filtro de historial asumían fechas en formato ISO
  (`slice(0,7)`), pero `h.fecha` está en `DD/MM/YYYY` — funcionaba "por accidente" porque los
  valores derivados coincidían por prefijo consigo mismos, pero se rompía con cualquier valor
  bien formado (como el mes actual agregado). Ahora usa `_fechaAsientoOrdenable()` para comparar
  correctamente.
- **Estado de Resultados** (`estado-resultados.js`): no tenía ningún filtro (sumaba todo el
  histórico); se agregó selector Mes+Año con opción "Todo el año", vía nueva
  `_erRecopilarCuentasPeriodo()` que re-filtra el `historial` de cada cuenta (no se puede usar el
  cutoff de `recopilarMovimientosPorCuenta()` para un rango, solo para un tope superior).
- **Flujo de Caja** (`flujo-caja.js`): filtraba solo por año; se agregó filtro de mes a la tabla
  (el gráfico sigue mostrando los 12 meses del año, panorama + detalle).
- **Libro de Ingresos/Egresos/Retenciones** (`segunda-categoria.js`): filtraban solo por año; se
  agregó mes, reutilizando la convención "0 = Todos los meses" que ya usaba Libro de Honorarios.
- **Inventario → Movimientos** (`inventario.js`): no tenía ningún filtro de período; se agregó
  mes+año junto a los filtros existentes de producto/bodega.
- **Documentos, Cartolas, Conciliación**: ya filtraban correctamente por mes/año pero con estilos
  propios distintos — se re-estilizaron a la clase compartida `.sel-periodo` (Cartolas: el año
  pasó de `<input type="number">` a `<select>`; Conciliación: el `<input type="month">` nativo
  pasó a dos `<select>` Mes/Año que componen `'YYYY-MM'` y reusan `recCambiarPeriodo()` sin tocar
  su firma) — pedido explícito del usuario en la aprobación del plan.

Principio aplicado (confirmado por el usuario): todo selector nuevo por defecto muestra **el mes
actual**, nunca el acumulado, salvo que exista una opción explícita para ver el total ("Todos los
meses"/"Todo el año"/"Todos los períodos"). Balance General y Balance Clasificado quedaron fuera
de este cambio a propósito — siguen "acumulado a fin de mes" porque un balance es una foto de
saldo en un momento dado, no una lista de movimientos del período.

Verificado en navegador con asientos/registros de prueba en dos meses distintos (julio y agosto
2026) para cada uno de los 7 reportes con cambio funcional: el filtro por defecto muestra solo el
mes actual, cambiar de mes filtra correctamente, y la opción de "total" suma ambos períodos. Sin
errores de consola nuevos. Balance General/Clasificado confirmados sin cambios de comportamiento.
`node PLANIFICACION/verificar.js` → 20/20 ✅. Datos de prueba limpiados de `localStorage`.

## Fusión "Inventario" + "Activos y Producción" ✅ (2026-08-05)

Pedido explícito del usuario: los módulos "Inventario" (Centros de Costo / Bodegas /
Movimientos) y "Activos y Producción" (Activos Fijos / Productos y Servicios) cumplen
funciones conjuntas — la calculadora de ítems del Diario ya sincroniza compras con cuenta
"Mercaderías" hacia Productos y compras con cuenta de Activo No Circulante (ej. "Muebles y
Útiles") hacia Activos Fijos — así que se fusionaron en un solo módulo de nav "Empresa":
**"Inventario y Activos" 📦** (`id: 'inventario-activos'`, `view-inventario-activos`), con 5
tabs en orden: Centros de Costo → Bodegas → Movimientos → Activos Fijos → Productos/Servicios.

De paso se migró Activos/Productos al mismo patrón "tabs-nativo" que ya usaba Inventario
(`renderActivos()`/`renderProductos()` ahora escriben directo en `tab-ap-activos`/
`tab-ap-productos`, sin pasar por los shells legacy `view-activos`/`view-productos` que movía
`_initModulosEmpresa()` — esa función se eliminó por completo, ya no tiene nada que reubicar).

Se mantuvieron los 5 redirects viejos (`activos`, `productos`, `centros-costo`, `bodegas`,
`movimientos-inventario`) apuntando al módulo fusionado, y se agregaron 2 alias nuevos
(`activos-produccion`, `inventario`) para que cualquier enlace/módulo-reciente guardado con el
id viejo siga funcionando.

Verificado en navegador: una sola tarjeta en el abanico de Inicio (antes eran dos), las 5 tabs
renderizan, los 7 ids viejos (5 redirects + 2 alias) aterrizan en la tab correcta, la
sincronización automática Diario→Productos/Activos sigue funcionando y se ve en las tabs
fusionadas, sin ids `view-activos`/`view-productos`/`view-activos-produccion`/`view-inventario`
residuales en el DOM, cero errores de consola. `node PLANIFICACION/verificar.js` → 20/20 ✅.

## Login — reactivado ✅ (2026-07-16)

Ver sección dedicada arriba ("Login — reactivado"). Resumen: `LOGIN_DESACTIVADO_TEMPORAL = false`,
verificado que el overlay real se activa con el diseño completo del prototipo, sin errores de
consola, `verificar.js` en 26/26.

## Mejora del dashboard de Inicio (2026-07-16)

Pedido explícito del usuario: el dashboard de Inicio se sentía "muy genérico" y faltaba una forma
de cambiar de cliente sin salir de Inicio. Antes de tocar código se preguntó (`AskUserQuestion`,
sin prototipo de referencia porque `new desing.html` es de un solo tenant y no contempla esto):
dónde debía vivir el cambio de cliente y qué tan lejos llegar con "menos genérico". Se eligió: (1)
un chip en el header con dropdown de clientes recientes + acceso a "Mis Clientes", y (2) pulido
visual + 1-2 widgets nuevos con **datos reales** (no maqueta).

### Chip de cambio de cliente

`#homeGreetEmpresa` (antes texto estático) ahora vive dentro de `.home-client-switch` — mismo
patrón dropdown que `.module-switch`/`.user-menu` (click para abrir, cierre al click afuera,
`toggleHomeClientSwitch()` en `menu.js`). El panel (`#homeClientPanel`) muestra hasta 5 "clientes
recientes" reales:
- **MRU real, no inventado**: `_empresasRecientesRegistrar(empresaId)` (nuevo, en
  `firebase-service.js`) escribe en `localStorage['contapp-empresas-recientes']` cada vez que
  `seleccionarEmpresa()` completa un cambio de cliente exitoso — mismo evento real que ya disparaba
  el resto del flujo, no se agregó un timer ni heurística inventada.
- `_fbRenderHomeClientSwitch()` (nuevo) cruza esa lista MRU contra `window.currentUser.empresas`
  (el array real de clientes del usuario, ya cargado por `_fbCargarPerfil`), trae nombre/RUT de
  Firestore solo de los que se van a mostrar (no de todos los clientes — evita lecturas de más), y
  se cachea (`_homeClientSwitchCargado`) hasta el próximo cambio de cliente.
- Cada ítem llama a `seleccionarEmpresa(id)` — la función real ya existente, no una versión nueva.
  El botón inferior "Ver todos mis clientes" llama a `cambiarEmpresa()`, también real.
- **Sin conexión / sin multi-cliente**: si `window.currentUser.empresas` no existe o `_fbDb` no
  está disponible (modo offline), el panel muestra un mensaje claro en vez de fallar o quedar vacío
  sin explicación — verificado en browser.

### Widgets nuevos (datos reales)

- **"🔎 Hallazgos de Auditoría"** (`_renderDashHallazgos()` en `dashboard.js`): lee
  `localStorage['aud_hallazgos']` (la misma fuente real que usa el módulo Auditoría → Hallazgos,
  documentada ahí como "diferencial que define el producto"), filtra `estado === 'abierto'`,
  muestra badge con el conteo, hasta 4 más recientes con ícono por tipo (error/advertencia/
  sugerencia) y un botón real a `navegar('hallazgos')`. Estado vacío: "✅ Sin hallazgos abiertos."
  en vez de ocultar la tarjeta.
- **"⚡ Accesos Rápidos"** (`_renderAccesosRapidos()` en `dashboard.js`): MRU real de navegación.
  `_modulosRecientesRegistrar(modulo)` (nuevo, en `app.js`) se llama desde `navegar()` en cada
  cambio de módulo real (excluyendo `inicio`) y escribe en
  `localStorage['contapp-modulos-recientes']`. El label de cada chip sale de `MODULO_TITULOS` — el
  mapa `titulos` que antes vivía *dentro* de `navegar()` (inaccesible desde otros archivos) se
  elevó a constante de módulo (`window.MODULO_TITULOS`) para que `dashboard.js` lo reuse sin
  duplicar la lista — un solo lugar con el texto real de cada módulo, no dos copias que puedan
  desincronizarse.
- Ambos widgets se ubicaron en una fila nueva, arriba de los gráficos (justo después del grid de
  KPIs) — prioriza lo accionable/personal antes que las visualizaciones, que es lo que hace que el
  dashboard se sienta "de este cliente" y no una plantilla.

### Housekeeping de caché

Se subieron los sufijos de versión de todos los scripts tocados en esta ronda
(`app.js?v=2→v=3`, `dashboard.js?v=3→v=4`, `firebase-service.js?v=3→v=4`) y se le agregó uno a
`menu.js` (`?v=2`, no tenía) — este último nunca había tenido cache-busting pese a haberse editado
varias veces en la sesión; agregarlo ahora previene el mismo bug de caché ya encontrado dos veces
antes en esta integración (ver secciones de Paso 6 y de reactivación de login).

Verificado en browser (`localhost:8080`, modo offline con datos sembrados en memoria para no tocar
datos reales, claro y oscuro): badge de hallazgos con conteo correcto, filas con ícono/módulo/
descripción reales, chips de accesos rápidos con el label correcto resuelto desde `MODULO_TITULOS`,
dropdown de cliente se abre/cierra y muestra el mensaje offline correcto sin crashear. Sin errores
de consola. `node PLANIFICACION/verificar.js` → 26/26 ✅. Sin commitear.

### Pendiente / conocido

- No se probó el chip de clientes recientes con una cuenta real multi-cliente (requiere Firestore
  online con al menos 2 clientes reales) — la lógica se verificó leyendo el código y probando la
  ruta de fallback offline; falta la prueba end-to-end con datos reales de Firestore.
- La colisión visual del abanico sobre el dashboard (documentada en la sección de `/qa`) también
  tapa parcialmente los widgets nuevos cuando el abanico está en su posición de reposo — mismo
  problema preexistente, no agravado por esta ronda, sigue pendiente de decisión de diseño.

## F29 (IVA Resumen) calculado desde el Libro Mayor, no desde Ventas/Compras ✅ (2026-08-24)

`generarIvaResumen()` (`js/services/iva-resumen.js`) calculaba el IVA Débito/Crédito sumando el
campo `iva` de los documentos en `dbVentas`/`dbCompras` (con lógica aparte para restar notas de
crédito). Se cambió la fuente a las cuentas ya contabilizadas en el Libro Mayor — "IVA Débito
Fiscal" y "IVA Crédito Fiscal" — vía `recopilarMovimientosPorCuenta()` (`js/core/contabilidad.js`),
mismo criterio de recorte por período que `_erRecopilarCuentasPeriodo()` en
`estado-resultados.js` (esa función solo soporta un tope superior, no un rango, así que se
re-filtra el historial completo de cada cuenta por fecha). El movimiento neto de cada cuenta ya
viene con las notas de crédito invertidas por el propio asiento, así que la lógica de ajuste NC
que existía en `dbVentas`/`dbCompras` se pudo eliminar sin perder ese comportamiento.

**Bug real encontrado y corregido durante la verificación**: el asiento de cierre/pago del F29
(`generarAsientoPagoIVA()`) se contabiliza con fecha en el **mismo mes** que declara (último día
del período), para dejar las cuentas de IVA en $0 al cerrar. Sin exclusión, reabrir el resumen de
un período ya pagado leería también ese asiento de cierre dentro de su propio rango de fechas y el
débito/crédito se cancelaría contra sí mismo, mostrando $0 en vez del monto real declarado. Fix:
`_ivaMovimientoCuentaPeriodo()` excluye cualquier entrada de historial cuya glosa empiece con
`IVA_GLOSA_PAGO_PREFIJO` ('Pago F29 IVA ') — constante nueva, compartida con
`generarAsientoPagoIVA()` (antes esa cadena estaba hardcodeada por separado en las dos funciones).
Verificado inyectando 3 asientos de prueba (venta, compra, nota de crédito de venta) en memoria:
antes de generar el asiento de pago, el resumen mostraba Débito $17.100 / Crédito $9.500 / Neto a
pagar $7.600; después de generarlo, **el resumen del mismo período siguió mostrando los mismos
tres montos** (sin el fix habría caído a $0), mientras que el Mayor sin filtrar sí queda en $0 en
ambas cuentas — confirma que el asiento de cierre cuadra los libros sin corromper el resumen del
período que lo originó.

El render (`_renderIvaResumen()`) también se actualizó: los subtítulos "Libro de Ventas"/"Libro de
Compras" pasaron a "Libro Mayor", y el conteo "N documentos" pasó a "N movimientos en el Mayor"
(cuenta de asientos que tocan cada cuenta en el período, no de documentos de origen). Las líneas
de ajuste explícito por notas de crédito se eliminaron del render por quedar redundantes (el monto
neto ya las refleja).

`node PLANIFICACION/verificar.js` → 20/20 ✅ (se actualizó el check de Sprint 4, que buscaba el
string literal `nota_credito` — ya no existe porque el neteo es automático vía Mayor — por uno que
confirma el nuevo cálculo vía `recopilarMovimientosPorCuenta`). Cero errores de consola nuevos.
Datos de prueba limpiados de `localStorage`. Sin commitear.

### Reajuste UTM del remanente en línea contable propia ✅ (2026-08-24, mismo día)

`generarAsientoPagoIVA()` acreditaba el reajuste UTM (`_calcularReajusteUTM()`) junto con "IVA
Crédito Fiscal" en una sola línea — el asiento no distinguía crédito fiscal real de corrección
monetaria por indexación. Se separó en su propia línea, reusando cuentas ya existentes en el plan
de cuentas (sin tocar `plan-cuentas.js`): **"Otros Ingresos"** (Ganancia) si el reajuste es a favor,
**"Gastos Financieros"** (Pérdida) si es en contra — mismas cuentas que ya usa
`estado-resultados.js` (`GASTOS_FIN_CUENTAS`). "IVA Crédito Fiscal" ahora solo recibe crédito
fiscal real + remanente arrastrado (sin el reajuste).

Requirió cambiar la firma de `generarAsientoPagoIVA(mes, anio, ivaDebito, creditoTotal, ivaAPagar)`
a `(mes, anio, ivaDebito, ivaCredito, remanente, reajuste, ivaAPagar)` — antes el botón del resumen
pasaba `creditoTotal` ya sumado (`ivaCredito + remanente + reajuste`), sin los componentes
individuales necesarios para separarlos en el asiento.

Verificado con datos de prueba (remanente $5.000 desde 07/2026, UTM 68.000→71.649 → reajuste
$268): el asiento generado quedó `IVA Débito Fiscal debe $19.000` / `IVA Crédito Fiscal haber
$5.000` / `Otros Ingresos haber $268` / `Banco haber $13.732` — cuadra (19.000 = 5.000+268+13.732).
Reclick sobre el botón actualiza el mismo asiento en vez de duplicarlo (2 asientos totales, no 3).
`node PLANIFICACION/verificar.js` → 20/20 ✅. Cero errores de consola nuevos. Datos de prueba
limpiados. Sin commitear.

### Asiento de cierre F29 correcto para ambos casos (deudor/acreedor) + fecha real de declaración ✅ (2026-08-24, mismo día)

El usuario pidió explícitamente la estructura contable de cierre para los dos casos posibles del
F29, y que el caso acreedor (remanente a favor) también generara un asiento real — antes solo
`generarAsientoPagoIVA()` (caso deudor) tocaba el Mayor; el caso acreedor
(`guardarRemanenteDesdeResumen()`) únicamente guardaba un número en `localStorage`, sin ningún
reflejo contable.

**2 cuentas nuevas en `js/core/plan-cuentas.js`** (ESQUEMA_CUENTAS): **"IVA por Pagar"** (Pasivo,
Pasivo Circulante, subgrupo "Impuestos por Pagar") y **"Remanente Crédito Fiscal IVA"** (Activo,
Activo Circulante, subgrupo "Impuestos por Recuperar" — mismo subgrupo que "IVA Crédito Fiscal").

**Caso deudor** (`generarAsientoPagoIVA()`, débito > crédito): `IVA Débito = IVA Crédito + IVA por
Pagar`. Cambio de comportamiento confirmado con el usuario: antes acreditaba "Banco" directo
(asumía pago inmediato); ahora reconoce el pasivo "IVA por Pagar" — separa "declarar el F29" de
"pagarlo" (el pago real, Debe IVA por Pagar / Haber Banco, queda como asiento aparte, manual). El
remanente arrastrado que se consume ahora se acredita contra su propia cuenta ("Remanente Crédito
Fiscal IVA"), no contra "IVA Crédito Fiscal" — esa cuenta pasó a reflejar solo crédito fiscal real
del período.

**Caso acreedor** (`generarAsientoRemanenteIVA()`, nueva función, crédito > débito): `IVA Débito +
Remanente = IVA Crédito`. Cierra "IVA Débito Fiscal" e "IVA Crédito Fiscal" del período, consume
(Haber) el remanente anterior contra "Remanente Crédito Fiscal IVA" y dota (Debe) el nuevo
remanente a favor en la misma cuenta — dos líneas separadas en vez de netearlas en una, para que el
asiento sea trazable para un auditor. `localStorage[IVA_REMANENTE_KEY]` se sigue actualizando en
paralelo (sigue siendo la fuente del mes/año de origen que necesita `_calcularReajusteUTM()`, no
hay forma simple de derivarlo del Mayor).

El reajuste UTM (`_calcularReajusteUTM()`) va en su propia línea en los dos casos (ya implementado
en la ronda anterior) — "Otros Ingresos"/"Gastos Financieros" según el signo. `_ivaMovimientosReajuste()`
y `_ivaEscribirAsientoCierre()` (idempotencia por prefijo de glosa) se extrajeron como helpers
compartidos entre ambas funciones.

**Corrección de fecha, pedida aparte por el usuario**: el asiento de cierre databa el último día
del PROPIO período declarado (p. ej. 31/08 para el F29 de agosto) — el F29 real se declara y paga
en el mes SIGUIENTE (plazo SII), así que ahora se fecha el día 1 del mes siguiente
(`_ivaFechaCierre()`, nuevo helper compartido). La exclusión por prefijo de glosa en
`_ivaMovimientoCuentaPeriodo()` sigue siendo necesaria con la fecha corregida — ahora protege al
período SIGUIENTE (el que geográficamente contiene la fecha del asiento) de que ese cierre se
cuente como si fuera actividad propia de ese mes, en vez de proteger al período que declara como
antes.

Verificado con datos de prueba en los dos casos:
- **Deudor**: débito $19.000, remanente $5.000 (reajuste $268) → asiento `IVA Débito Fiscal debe
  $19.000` / `Remanente Crédito Fiscal IVA haber $5.000` / `Otros Ingresos haber $268` / `IVA por
  Pagar haber $13.732` (ya no "Banco"). Fecha `01/09/2026` (mes siguiente). Reabrir agosto tras
  generar el asiento sigue mostrando los mismos $19.000/$19.000; abrir septiembre (donde ahora cae
  el asiento) muestra $0/$0/$0 — no contamina ninguno de los dos períodos.
- **Acreedor**: débito $1.900, crédito $19.000, remanente $5.000 (reajuste $268) → asiento `IVA
  Débito Fiscal debe $1.900` / `Remanente Crédito Fiscal IVA haber $5.000` / `IVA Crédito Fiscal
  haber $19.000` / `Otros Ingresos haber $268` / `Remanente Crédito Fiscal IVA debe $22.368` (el
  nuevo remanente) — cuadra (24.268 = 24.268). `localStorage` queda con `{monto:22368, mes:8,
  anio:2026}`. Reabrir el período tras generar el asiento sigue mostrando $1.900/$19.000/$0.

`node PLANIFICACION/verificar.js` → 20/20 ✅. Cero errores de consola nuevos. Datos de prueba
limpiados de `localStorage`. Sin commitear.

## Proveedores agrupados por plazo de pago (30/60 días) ✅ (2026-08-24, mismo día)

El usuario pidió separar los proveedores en dos grupos según su plazo de pago (30 y 60 días),
dándole prioridad visual a los de 30 días por vencer antes. No existía ningún campo de plazo en el
sistema — ni por proveedor ni por documento de compra — así que se confirmaron 2 decisiones con el
usuario antes de tocar código: el plazo vive **por proveedor** (no por factura, se negocia una vez
por relación comercial) y la separación se muestra **en la pestaña Proveedores existente** del
módulo Contactos (`js/modules/clientes.js`), no en un reporte nuevo.

- **`index.html`**: nuevo campo `<select id="ctcPlazoPago">` (30/60 días) en el modal de
  contacto, junto a Categoría.
- **`clientes.js`**: `plazoPago` (`'30'`/`'60'`, default `'30'`) se agregó al objeto de datos que
  guarda `guardarContacto()`, se precarga en `editarContacto()` y se resetea en
  `_limpiarFormContacto()` — mismo patrón que el resto de los campos del formulario.
- **`renderContactos()`**: cuando `filtroContactos === 'proveedor'`, en vez de la lista plana se
  arman 2 bloques — "🔴 Prioridad — 30 días" primero, "🟡 60 días" después — cada uno con su
  encabezado (deuda total del grupo) y las filas ordenadas por deuda descendente (`_calcularSaldo()`,
  ya existente, reutilizada sin cambios). Contactos sin `plazoPago` guardado (creados antes de este
  cambio) caen en el grupo de 30 días por el default. Se extrajo `_filaContacto(c)` (antes HTML
  inline dentro del `.forEach`) para reusar la misma fila en ambos modos de render sin duplicar
  el HTML. La pestaña "Todos"/"Clientes" no se tocó — la agrupación por plazo solo aplica a
  Proveedores, donde tiene sentido.

Verificado con datos de prueba (3 proveedores: Alfa $119.000/30d, Beta $59.500/60d, Gamma
$238.000/30d): el bloque 30 días mostró "Debe: $357.000" con Gamma primero (mayor deuda) y Alfa
después; el bloque 60 días mostró "Debe: $59.500" con Beta. El campo del formulario carga y guarda
correctamente al editar un contacto existente. `node PLANIFICACION/verificar.js` → 20/20 ✅. Cero
errores de consola nuevos. Datos de prueba limpiados. Sin commitear.

## Restaurada la división histórica de grupos (G1-G5 / G1-G4) sobre el hub actual ✅ (2026-08-24, mismo día)

El usuario pidió volver a la división de módulos previa a la consolidación a 3 grupos (ver sección
"Decisión de arquitectura: 3 grupos de módulos, no 5" al inicio de este documento), pero mostrada
con el mecanismo de selección actual (tiles planas + panel de chips, `home-hub.js`) en vez del
sidebar con pestañas que existía en esa época. `construirMenu()` (`menu.js`) ya soporta cualquier
cantidad de grupos de forma genérica (filtra los que no tienen módulos activos), así que el cambio
fue puramente de datos, sin tocar la lógica de render del hub.

**Hallazgo antes de tocar código**: el G4/G5 histórico incluía "Auditoría (Informe/Hallazgos)" — ese
módulo ya no existe en el catálogo ni en la navegación actual (sin vista, sin `js/auditor/`, la
carpeta que lo contenía). No se pudo restaurar porque el contenido en sí se eliminó del producto en
algún momento posterior a esa arquitectura — el resto de cada grupo se reconstruyó completo.

- **`js/categorias/primera.js`** (`CAT1_MODULOS`) — grupo reasignado por módulo a los G1-G5
  históricos (git `67061db`): Contabilidad (Estructura Contable + Reportes Financieros), Comercial
  (Egresos e Ingresos + Tributario), Datos (Documentación + Conciliación y Cartolas + Clientes/Prov.),
  RRHH (Remuneraciones), Empresa (Inventario y Activos — sin el módulo de Auditoría que ya no existe).
- **`js/categorias/segunda.js`** (`CAT2_MODULOS`) — mismo tratamiento con los G1-G3 históricos (git
  `dbde51e`): Contabilidad (Libros Contables), Datos (Documentación + Conciliación y Cartolas +
  Clientes/Prov. + Prestadores), Tributario (Declaración de Impuestos). El G4 histórico (Empresa/
  Auditoría) no tiene contenido que restaurar por el mismo motivo.
- **`menu.js`**: `MENU_GRUPOS_ORDEN` pasó de `['Comercial','Contabilidad','Empresa']` a
  `['Contabilidad','Comercial','Datos','RRHH','Empresa','Tributario']` — un solo orden combinado
  sirve para ambas categorías porque `construirMenu()` ya filtra los grupos vacíos (segunda
  categoría termina mostrando solo Contabilidad/Datos/Tributario, en ese orden). `MENU_GRUPOS_META`
  se actualizó con ícono + descripción para los 3 grupos nuevos (Datos, RRHH, Tributario) y se
  redefinieron las descripciones de Comercial/Empresa, cuyo significado cambió respecto al esquema
  de 3 grupos (mismo nombre, contenido distinto — es una restauración histórica, no una fusión de
  ambos esquemas).
- **`home-hub.js`**: `HOME_HUB_ACCENTS` pasó de 3 a 5 colores (`--blue/--coral/--periwinkle/--ok/--navy`)
  para que primera categoría (hasta 5 grupos activos a la vez) no repita acento entre tiles.

Verificado en navegador: primera categoría con módulos por defecto muestra 4 tiles (Contabilidad/
Comercial/Datos/Empresa — RRHH no aparece porque Remuneraciones tiene `defecto:false`); activar
Remuneraciones agrega el 5° tile (RRHH) con acento propio (`--ok`) sin romper nada. Panel de
"Comercial" muestra exactamente Egresos e Ingresos + Tributario (contenido del G2 histórico).
Cambiar a segunda categoría muestra 3 tiles (Contabilidad/Datos/Tributario) — panel de "Datos"
muestra los 4 módulos esperados (Documentación/Conciliación y Cartolas/Clientes/Prestadores). La
grilla de "Módulos activos" en Configuración (`cat1RenderizarToggles`, ya agrupaba por `m.grupo`
genéricamente) refleja los mismos 5 grupos sin cambios de código. `node PLANIFICACION/verificar.js`
→ 20/20 ✅. Cero errores de consola nuevos. Estado de prueba (categoría/módulos activos) revertido
al finalizar. Sin commitear.

## PPM en el Resumen IVA (F29), fecha de asiento y tasa PPM editables ✅ (2026-09-14)

Pedido del usuario: el F29 (primera categoría, `js/services/iva-resumen.js`) debía calcular
también el PPM (Pago Provisional Mensual, Art. 84 letra a) LIR — anticipo de Renta que se declara
junto con el IVA en el mismo formulario) sobre las ventas netas del mes, y tanto la fecha del
asiento de cierre como la tasa de PPM debían ser editables (antes la fecha era fija — día 1 del
mes siguiente, `_ivaFechaCierre()` — y no existía cálculo de PPM en esta vista).

- **Ventas netas del período** (`_ivaVentasNetasPeriodo()`, nueva): suma el movimiento neto
  (Haber − Debe) de todas las cuentas del Mayor clasificadas en el subgrupo "Ingresos
  Operacionales" (hoy "Ingresos por Ventas", "Ingresos por Servicios" y "Devoluciones y
  Descuentos", esta última resta sola por tener naturaleza Debe) — por clasificación y no por
  nombre fijo, porque la cuenta de ingreso de Ventas es elegible por el usuario
  (`#ventaCtaIngreso`). Reutiliza `_ivaMovimientoCuentaPeriodo()` ya existente.
- **Tasa PPM**: input editable (`#ivaInputTasaPPM`, `%`), persistida sola en
  `localStorage` (`core_iva_ppm_tasa`, sin mes/año — el SII se la recalcula al contribuyente una
  vez al año, no cambia mes a mes). PPM determinado = ventas netas × tasa, mostrado en el
  detalle y en un nuevo KPI de cabecera ("PPM").
- **Asiento**: el PPM se agrega al MISMO asiento de cierre del F29 (deudor o acreedor, el que
  corresponda) como Debe "PPM" (activo ya existente en `ESQUEMA_CUENTAS`) / Haber "Impuestos por
  Pagar" (pasivo genérico ya existente) — mismo criterio que "IVA por Pagar": se reconoce la
  obligación, no se asume pago en efectivo inmediato. `generarAsientoPagoIVA()`/
  `generarAsientoRemanenteIVA()` reciben `ppmMonto` como parámetro nuevo (default 0, no rompe
  llamadas antiguas).
- **Fecha del asiento editable**: nuevo input `#ivaFechaAsiento` (`<input type="date">`),
  sugerido automáticamente (día 1 del mes siguiente, mismo cálculo que antes) pero editable —
  `_ivaSyncFechaDefault()` solo repone el valor por defecto cuando cambia el período seleccionado
  (vía `dataset.periodo`), así una fecha editada a mano sobrevive a un nuevo clic en "Calcular"
  para el mismo mes/año. `_ivaFechaAsientoElegida()` la lee y convierte a `DD/MM/YYYY` (mismo
  criterio que `guardarAsientoManual()` en `diario.js`).
- **Por qué los dos inputs nuevos viven en una card aparte, fuera de `#ivaResumenCont`**: ese
  contenedor se reescribe completo (`innerHTML`) en cada `generarIvaResumen()` — si los inputs
  vivieran ahí adentro, cada tecleo en la tasa PPM (que dispara `oninput` → recalcular →
  re-render) les haría perder foco/cursor a mitad de escritura.

Verificado en navegador (inyección de asiento de prueba vía consola, mismo método ya usado en la
auditoría de este proyecto): venta de $1.000.000 neto + $190.000 IVA en Sept. 2026 → "Ventas
netas del período" = $1.000.000 correcto; tasa 1,5% → PPM = $15.000, KPI y "Total a pagar en el
F29" = $205.000 (190.000 + 15.000) correctos. Fecha editada a mano (20/10/2026, distinta del
default 01/10/2026) se respeta en el asiento generado. Asiento generado incluye las 4 líneas
esperadas (IVA Débito Fiscal / IVA por Pagar / PPM / Impuestos por Pagar) cuadrado
(Debe = Haber = $205.000). Reclic no duplica (idempotencia por prefijo de glosa preservada).
`node PLANIFICACION/verificar.js` → 20/20 ✅. Sin errores de consola nuevos. Datos de prueba
revertidos al finalizar. `?v=8` en `iva-resumen.js`. Sin commitear.

### Fuera de alcance de este cambio (no pedido)
- La tasa de PPM no se deriva automáticamente (fórmula variable del Art. 84 que el SII recalcula
  con la Operación Renta) — el usuario la ingresa a mano, como ya ocurre con el remanente de IVA.
- No se tocó el F29 de segunda categoría/honorarios (`js/modules/segunda-categoria.js`,
  `honRenderPPM()`) — es un módulo y un concepto de PPM distintos (voluntario, sobre honorarios),
  sin relación con este cambio.

## Historial de UTM para el reajuste de remanente ✅ (2026-09-21)

El usuario aportó la tabla UTM 2024 (SII) para que el reajuste de remanente de crédito fiscal
(`_calcularReajusteUTM()`, iva-resumen.js) tuviera con qué calcular meses de ese año — hasta ahora
`utm_historial` (la clave que esa función siempre había leído) nunca se escribía en ningún lado del
código, así que el reajuste caía SIEMPRE en la rama "sin dato histórico" (reajuste $0), para
cualquier remanente.

- **`js/services/indicadores.js`**: `UTM_HISTORICO_SEED` (tabla 2024 de la captura del usuario) se
  siembra en `cache.utm_historial` al cargar el archivo (`_sembrarHistorialUTM()`, no pisa valores
  ya presentes). Además, `actualizarIndicadores()` ahora graba la UTM del mes en curso en
  `utm_historial[YYYY-MM]` cada vez que hace una consulta en vivo exitosa — el historial se sigue
  completando solo hacia adelante desde ahora, sin depender de que alguien lo siembre a mano mes a
  mes. `?v=5`.
- **Pendiente**: 2025 (y cualquier mes de 2026 anterior a hoy) sigue sin historial — la app recién
  empieza a registrarlo solo desde este cambio en adelante. Si el usuario aporta la misma tabla
  para 2025, se agrega igual a `UTM_HISTORICO_SEED`.

## Fix: remanente de crédito fiscal se corrompía al reabrir un mes anterior ✅ (2026-09-21)

Reporte del usuario: "el remanente de crédito fiscal está mal separado según los meses, lo
guardado se traspasa dos veces". Causa raíz confirmada: `core_iva_remanente` guardaba un único
objeto global `{monto, mes, anio}` — "el remanente más reciente calculado, sea cual sea el mes que
lo produjo" — en vez de un valor por mes. Mientras los meses se cerraran en orden estricto no se
notaba, pero **reabrir y regenerar el cierre de un mes ANTERIOR** (para corregir un dato, o solo
para revisar) sobrescribía ese único valor global con el resultado de ese mes viejo, desplazando o
duplicando el traspaso que meses posteriores ya habían consumido — verificado y reproducido en
consola antes de corregir.

- **`js/services/iva-resumen.js`**: `core_iva_remanente` pasa a guardar un historial
  `{'YYYY-MM': monto}` indexado por el mes que LO PRODUJO al cerrar (`_guardarRemanenteOrigen()`),
  con migración automática y transparente del formato viejo (`_cargarHistorialRemanente()`). El
  remanente que entra a un período ya no se lee "el último guardado" sino siempre
  `_remanenteEntrante(mes, anio)`: el mes calendario inmediatamente anterior al seleccionado —
  determinístico, no depende de qué se tocó por última vez. `generarAsientoRemanenteIVA()` y
  `guardarRemanenteIVA()` (panel manual) escriben en su propia clave, nunca en la de otro mes. El
  detalle del F29 ahora muestra explícitamente "Originado en el cierre de \<mes\> \<año\>" en vez
  del texto genérico anterior. `?v=9`.

Verificado en consola (mismo método de inyección de asientos de prueba ya usado en este proyecto):
Agosto 2026 cierra con remanente a favor $150.000 → Septiembre lo lee correcto y cierra con
$50.000 propio → **reabrir y regenerar Agosto no altera el $50.000 guardado de Septiembre**
(`historial['2026-09']` intacto) ni cambia lo que Septiembre vuelve a leer. Migración probada con
un objeto en formato viejo → se convierte a `{'2026-06': 88000}` sin intervención del usuario.
`node PLANIFICACION/verificar.js` → 20/20 ✅. Sin errores de consola nuevos. Datos de prueba
revertidos al finalizar. Sin commitear.

## Fix: asiento de remanente repetía la misma cuenta en Debe y Haber ✅ (2026-09-21)

El usuario mandó una captura de un asiento real ("Cierre F29 IVA (remanente a favor) Diciembre
2024") y preguntó por qué "Remanente Crédito Fiscal IVA" aparecía dos veces (Debe $1.124.406 /
Haber $856.035) en vez de sumarse — y si no debería haber cuentas distintas para el remanente
anterior vs. el nuevo. Confirmado: el CÁLCULO ya sumaba correctamente (`creditoTotal = ivaCredito +
remanenteReajustado`, el remanente anterior reajustado SÍ se suma al crédito del mes) — lo que
estaba mal era la FORMA del asiento en `generarAsientoRemanenteIVA()`: cerraba el saldo anterior
(Haber) y dotaba el saldo nuevo (Debe) como dos líneas opuestas a la MISMA cuenta, lo que en el
Libro Diario se lee como una resta y no como lo que realmente es (cierre + reapertura del mismo
saldo).

- **`js/services/iva-resumen.js`**: las dos líneas de "Remanente Crédito Fiscal IVA" se
  colapsaron en una sola línea NETA (`nuevoRemanente − remanente`: Debe si el remanente creció,
  Haber si disminuyó) — mismo efecto en el Mayor y misma cuadratura (ambos lados del asiento bajan
  en el mismo monto, la diferencia sigue en $0), sin la cuenta repetida en direcciones opuestas.
  No se agregaron cuentas nuevas (no hacía falta separar "remanente anterior" de "remanente
  nuevo" en el plan de cuentas — es la misma cuenta de balance, solo cambia de saldo). `?v=10`.

Verificado en consola con los montos exactos de la captura del usuario (ivaDebito 2.098.164,
ivaCredito 2.301.100, remanente anterior 856.035, reajuste 65.435, nuevo remanente 1.124.406, PPM
165.644): el asiento ahora tiene UNA sola línea "Remanente Crédito Fiscal IVA" (Debe $268.371 =
1.124.406 − 856.035) y sigue cuadrado (Debe = Haber = $2.532.179, más bajo que antes porque se
neteó el par que se cancelaba, pero la diferencia sigue siendo $0). `node PLANIFICACION/verificar.js`
→ 20/20 ✅. Sin errores de consola nuevos. Datos de prueba revertidos al finalizar. Sin commitear.

## Fix (importante): el reajuste UTM comparaba contra la UTM de HOY, no la del período declarado ✅ (2026-09-21)

Al revisar la misma captura de Diciembre 2024, el detalle mostraba "UTM 11/2024: $66.628 → UTM
actual: $71.721 → reajuste: $65.435". $71.721 es la UTM EN VIVO cacheada hoy (fecha real del
sistema: septiembre 2026) — un salto de ~22 meses, no de 1 mes. `_calcularReajusteUTM()` recibía
`mesActual`/`anioActual` (el período que se está declarando, Diciembre 2024) como parámetros pero
nunca los usaba para buscar la UTM correspondiente — en su lugar tomaba siempre
`window.indicadoresEconomicos.utm.valor`, la UTM real de HOY, sin importar qué período se
estuviera calculando. Para el mes calendario actual eso coincide (por eso no se notaba antes de
tener historial cargado); para cualquier período anterior, sobrestima (o subestima) el reajuste
tanto más cuanto más atrás quede ese período respecto de hoy.

- **`js/services/iva-resumen.js`**: `_calcularReajusteUTM()` ahora busca la UTM de AMBOS extremos
  (mes de origen y mes declarado) en el mismo `utm_historial` — la UTM en vivo solo se usa como
  respaldo cuando el período declarado es el mes calendario real de hoy y su historial todavía no
  se grabó. Con datos reales (UTM Nov/2024 $66.628, Dic/2024 $67.294, seedeadas): el reajuste de
  Diciembre 2024 pasa de $65.435 a **$8.557** (factor 1,0100 en vez de 1,0764) — el remanente
  reajustado pasa de $921.470 a $864.592. `?v=11`.

**Importante para el usuario**: cualquier cierre de remanente a favor ya generado ANTES de este
fix (incluido el de Diciembre 2024 de la captura) quedó con un reajuste sobrestimado — hay que
reabrir esos meses y volver a pulsar "Generar asiento de cierre" para que se recalculen con la UTM
correcta del propio período (la idempotencia por glosa actualiza el mismo asiento, no duplica).

Verificado en consola: `_calcularReajusteUTM(856035, 11, 2024, 12, 2024)` con el historial ya
seedeado (UTM 11/2024 $66.628, 12/2024 $67.294) → reajuste $8.557, detalle "UTM 11/2024: $66.628 →
UTM 12/2024: $67.294 (factor 1.0100)"; confirmado también end-to-end vía `generarIvaResumen()`
(Remanente reajustado $864.592). `node PLANIFICACION/verificar.js` → 20/20 ✅. Sin errores de
consola nuevos. Datos de prueba revertidos al finalizar. Sin commitear.
