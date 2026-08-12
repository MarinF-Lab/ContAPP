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
