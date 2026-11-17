# Integración de Diseño — ID Contable Auditor (estado vivo)

> **Documento vivo y corto a propósito.** Se lee al iniciar cada sesión: qué se está haciendo, qué
> está decidido y cuál es el próximo paso. El registro de la integración anterior (jul-sep 2026,
> prototipo `new desing.html`) está en `archivo/HISTORIAL_INTEGRACION_2026-07_a_09.md`.

## Referencias
| Qué | Dónde |
|-----|-------|
| Diseño a seguir | `PLANIFICACION/diseno/referencia-contapp-consola.html` (artefacto "ContApp Consola") |
| Auditoría inicial y capturas del "antes" | `PLANIFICACION/diseno/LINEA_BASE_DISENO.md`, `diseno/linea-base/` |
| Conectividad entre módulos (Fases 0-3) | `PLANIFICACION/CONECTIVIDAD.md` |
| Pruebas | `npm test` · `npm run test:navegador` · `npm run test:reglas` (ver `PLANIFICACION/pruebas.js`) |

## Marca (2026-11-15)
- El producto se llama **ID Contable**; el isotipo es el de **ID Studio** (marca madre). Debajo del
  nombre va la versión: **Auditor** (activo), Educa o Empresa. La versión sale de
  `PRODUCTO.version` (`js/core/helpers.js`) y se pinta en todo elemento `[data-marca-version]`.
- Se cambiaron solo los textos visibles (pestaña, `manifest.json`, login, barra de Inicio, Mis
  clientes, planes, PDF/Excel, mensajes). **No** se renombran identificadores internos
  (`ContappEventos`, `ContappModales`, `ContappIconos`), claves `contapp_*` de localStorage/Firestore
  ni el formato `contapp-respaldo-cliente`: cambiarlos perdería los datos guardados.
- "ContApp Consola" sigue siendo el nombre del artefacto de referencia de diseño.

## Arquitectura vigente (resumen)
- **Navegación:** `js/services/menu.js` arma el menú desde los catálogos de módulos
  (`js/categorias/primera.js` grupos G1-G5, `segunda.js` G1-G4) filtrando por los módulos activos
  del cliente; `home-hub.js` dibuja el centro de mando de Inicio; `navegar()`/`modTab()` en `app.js`.
- **Datos por cliente:** `js/core/datos-cliente.js` (lista única de datos, dueño de los datos en el
  navegador) + sincronización con Firestore `empresas/{id}/modulos/{doc}` en `firebase-service.js`.
- **Asientos y conexiones:** `js/core/asientos.js` (registro único, idempotente), `conexiones.js`
  (eventos entre módulos), `cierre.js` (checklist del mes). Detalle en `CONECTIVIDAD.md`.
- **Interacción:** `js/core/modales.js` (gestor global de modales y teclado).
- **Accesos:** titular / invitado / acceso por código — `licencia.js`, `auth-manager.js`,
  `firestore.rules` (v3).

## Rediseño 2026-11 — carcasa "ContApp Consola" (paleta del logo)

> Referencia: `PLANIFICACION/diseno/referencia-contapp-consola.html` · Línea base y auditoría: `PLANIFICACION/diseno/LINEA_BASE_DISENO.md`
> Decisiones aprobadas: artefacto como referencia · paleta del logo (opción a) · fuentes actuales
> (opción a) · la consola "¿Qué quieres hacer hoy?" va encima del centro de mando (no lo reemplaza).

| Etapa | Qué incluye | Estado |
|-------|-------------|--------|
| 0 | Referencia en el repo, auditoría (`web-design-guidelines`, `ui-ux-pro-max`), capturas de línea base claro/oscuro, inventario de colores fijos | ✅ 2026-11-14 |
| 1 | Paleta del logo en `css/variables.css` (ambos temas, contraste AA verificado), texto sobre acento/estados por token, isotipo en login y cabecera | ✅ 2026-11-15 |
| 2 | Reemplazar colores fijos de JS/estilos en línea por variables | ✅ 2026-11-15 |
| 3 | Pantallas: login, Mis clientes (avance de cierre por tarjeta), Inicio con "¿Qué quieres hacer hoy?" sobre el centro de mando | ✅ 2026-11-15 |
| 4 | Componentes comunes: botones, tarjetas, tablas, formularios, modales, pestañas e íconos SVG | ✅ 2026-11-15 |
| 5 | Movimiento y móvil (`mobile-native`), `prefers-reduced-motion` | ✅ 2026-11-15 |
| 6 | Revisión final: `web-design-guidelines`, `break-ui` (datos extremos), `emil-design-eng`, capturas finales, pruebas | ✅ 2026-11-15 |

### Correcciones previas a la Etapa 1 — ✅ 2026-11-14
Errores reales y de interacción de la línea base (H1, H3, H5, H6), sin tocar lógica contable:
- **H1** Inicio vacío sin conexión → `fbInit()` difiere el modo sin conexión a `DOMContentLoaded`.
- **H3** Tema: sigue a `prefers-color-scheme` mientras el usuario no elija; `color-scheme` y
  `<meta theme-color>` acordes al tema.
- **Modales** (`js/core/modales.js`, nuevo): gestor global que observa todos los modales sin cambiar
  cómo se abren — entrada/salida suaves (160-200 ms, solo fundido con movimiento reducido), Escape
  cierra el de arriba usando su botón Cancelar/Cerrar, foco al primer campo, Tab atrapado, foco
  devuelto, scroll del fondo bloqueado sin salto, apilamiento (confirmación sobre formulario).
  Los formularios altos ahora se desplazan (antes el título quedaba cortado). El formulario de
  trabajador ya no se cierra con un clic fuera ni repite la animación al cambiar de sección.
- **Avisos**: `mostrarToast` usa tokens del tema, `aria-live`, abajo al centro (no tapa el botón
  de la IA). Arreglado: los avisos `info` se veían rojos como errores.
- **Teclado/accesibilidad**: controles con `onclick` operables con Enter/Espacio (role/tabindex),
  `aria-label` en botones de ícono, `:focus-visible`, enlace "Saltar al contenido", `autocomplete`
  en correo/contraseña, `alt`/tamaño en img, "…", sin `transition: all`, `prefers-reduced-motion`,
  fuentes por `<link>` (no `@import`).
- **H6** Botones de Cartolas con estilo de la app (antes nativos); cabeceras del Libro Mayor sin
  bloque coral sólido.
- Prueba en navegador: `npm run test:navegador` (23 comprobaciones, capturas en
  `PLANIFICACION/diseno/correcciones/`).

### Seguridad y orden — ✅ 2026-11-14
- `firestore.rules` v3 + ajustes en `auth-manager.js`/`firebase-service.js` (invitados y acceso por
  código). Pruebas: `npm run test:reglas` (63 casos en el emulador). **Publicar las reglas** en la
  consola de Firebase o con `firebase deploy --only firestore:rules` (lo hace el usuario).
- Eliminadas las carpetas `public/` y `pymes/` (copias antiguas). `PLANIFICACION/` ordenada: lo
  histórico en `archivo/`, el worker de Previred en `herramientas/`, maquetas viejas eliminadas.
- Un solo comando de pruebas: `npm test` (estática + conectividad) y `npm run test:navegador`.

### Etapa 1 — paleta del logo ✅ 2026-11-15
- `css/variables.css` reescrito con la paleta de la referencia. Los nombres antiguos (`--coral`,
  `--navy`, `--periwinkle`, `--blue`) apuntan a la paleta nueva y **cambian con el tema** (antes
  eran fijos: `--navy` como texto quedaba invisible en oscuro).
- Tokens nuevos: `--on-accent` (blanco en claro, navy en oscuro: el blanco no se lee sobre el rosa
  neón) y `--on-state` (texto sobre botones rojo/verde/info). Aplicados en 32 reglas CSS y 8
  estilos en línea que fijaban `color:#fff`.
- 25 colores fijos de la paleta anterior (`rgba(255,134,146…)`, `#587FFC`, `rgba(30,30,93…)`)
  pasados a variables.
- Isotipo del logo (claro/oscuro, `icons/brand/isotipo-*-96.png`) en la cabecera de Inicio y el login.
- Arreglado: la pestaña activa de Remuneraciones no mostraba su texto (mismo color que el fondo,
  por dos hojas de estilo en conflicto) — ya pasaba antes de la Etapa 1.
- `PLANIFICACION/diseno/contraste.js` (en `npm test`): 80 combinaciones texto/fondo, todas ≥ 4,5:1
  en ambos temas (la paleta anterior fallaba ~30). Capturas del después en `diseno/etapa1/`.

### Etapa 2 — colores fijos a variables ✅ 2026-11-15
- 446 colores hex sueltos → 67. Reemplazo automático **solo dentro de declaraciones CSS** (hojas de
  estilo, `style="…"`, `el.style.x = …`) según familia (rojo/verde/ámbar/azul/gris/neutro) y tipo
  de propiedad (texto, fondo, borde); en reglas del tema oscuro, los fondos oscuros pasan al tinte
  suave. Más ~60 reemplazos a mano en JS (insignias de tipo de cuenta, estados de documentos,
  clientes/proveedores, activos, productos, márgenes, cuadre del Diario, avisos del Balance,
  gráfico del Flujo de caja).
- Tokens nuevos: `--screen` / `--on-screen` (paneles oscuros en ambos temas, como la "pantalla"
  del artefacto: cabecera de la boleta de sueldo, encabezado del plan de cuentas).
- Arreglos: `auditor.css` redefinía `--accent-soft` con el coral antiguo y pisaba la paleta
  (recuadros rosados "Total mes"/"Cuadrado"); botón "Editar" de Compras/Ventas tomaba el gris
  nativo del navegador; se quitó el truco `[style*="#f1f5f9"]` que forzaba colores en oscuro.
- Ícono de la PWA y favicon con el isotipo (`icons/icon-192.png`, `-512`, `-maskable-512`).
- Quedan a propósito (67): paletas por categoría (color de cada cliente, avatares, plazos del
  estudio, categorías del buscador), texto blanco de avatares, logos de Google/Microsoft, valores
  de respaldo de los gráficos. Capturas del después en `diseno/etapa2/`.

### Revisión de texto pegado a bordes o desbordado ✅ 2026-11-15
- `npm run revisar:texto` (`PLANIFICACION/diseno/revisar-texto.js`): mide en todas las vistas y
  pestañas, ambos temas, 1366 y 390px, la separación entre cada texto y el borde de su caja.
- `.card` no tiene relleno (las tarjetas con tablas van a sangre); las tarjetas de texto usan la
  clase nueva `.card-pad`. Aplicada en Inventario y Activos (5 pestañas), Plan de Cuentas y F29.
- Celular: buscador solo con ícono, avance del cierre fuera de la cabecera de Inicio, indicadores
  de Cartolas en 2 columnas, rejillas de 2 columnas (Honorarios y otras) en 1 columna, tabla de
  Remuneraciones y pestañas del formulario de trabajador desplazables, pestañas de módulo con
  desvanecido a la derecha.
- Quedan solo falsos positivos: píldoras/insignias (3px vertical a propósito), atajo `Ctrl K`,
  celdas de tablas desplazables. Capturas en `diseno/texto/`.

### Etapa 3 — pantallas ✅ 2026-11-15
- **Inicio** (`js/services/consola.js`): consola "¿Qué quieres hacer hoy?" encima del centro de
  mando. Vacía muestra lo pendiente del cierre del cliente (cierre.js); al escribir sugiere áreas
  por palabras clave, solo de módulos activos (si el módulo está inactivo lo dice y lleva a
  Configuración); una frase con monto va al Libro Diario con la glosa escrita. ↑/↓, Enter, Escape.
- **Mis clientes** (`js/auditor/panel-estudio.js`): cabecera con "Agregar cliente" y "Código de
  invitación", franja de resumen por estado y vencimientos, buscador, filtro por categoría, vistas
  Tablero (por defecto; tarjetas con barra de avance del cierre, lo que falta, horas de hoy, estado
  y cronómetro), Lista y Calendario. Arreglo: el buscador perdía el foco al escribir.
- **Login**: panel "pantalla" con globo y tarjeta con barra "> ingresar". Se quitaron los botones
  Google/Microsoft (no hacían nada); "¿Olvidaste tu contraseña?" ahora envía el correo de Firebase
  y "Recordarme" decide si la sesión sobrevive al cerrar el navegador.
- Tokens `--screen-2`, `--screen-line`, `--screen-dim`, `--screen-accent` (AA verificado).
- **Revisión de Inicio (pedida por el usuario)**: consola compacta (título, resumen de una línea
  y campo; la lista de sugerencias solo al usar el campo); centro de mando como la referencia
  (título a la izquierda, tarjetas de grupo a todo el ancho con íconos SVG y sus módulos como
  botones directos, sin panel intermedio); Configuración igual (+ acceso a "Respaldo del
  cliente"); Financiero sin fondo punteado ni emoji, indicadores en franja y paneles planos; riel
  de secciones con íconos SVG. Íconos compartidos en `js/core/iconos.js`.
- Capturas en `diseno/etapa3/`. Pruebas: 6 casos nuevos en el navegador, 3 en `verificar.js`.

### Etapa 4 — componentes e íconos ✅ 2026-11-15
- **Componentes** (`css/main.css`, sección "SISTEMA DE COMPONENTES"): botones radio 10px sin sombra
  dura; secundario neutro; peligro en contorno rojo (relleno solo en la confirmación final);
  exportación y botones de tabla neutros. Pestañas de módulo y de Remuneraciones subrayadas con el
  acento (decisión `.rem-tab`: subrayada; `.plan-tab`: control segmentado). Tablas sin bordes
  verticales ni cebra, encabezado gris de 13px. Campos con borde visible. Tarjetas y modales radio
  16-18px sin sombra ni salto. Estados como píldora con punto.
- **Íconos**: 54 íconos SVG como máscaras CSS (`<i class=cxi-nombre></i>`, sin comillas para poder
  usarse dentro de textos de JS); `js/core/iconos.js` para SVG en línea (selector de módulo,
  Inicio). Emoji: de ~509 a 237. Reemplazados en botones, estados, indicadores y categorías;
  quitados de pestañas, títulos y opciones de listas. Los que quedan están en avisos/mensajes,
  comentarios del código, datos internos y exportación a PDF.
- Arreglo de colores con transparencia en hexadecimal de 8 dígitos (`#10b98155`) que la Etapa 2 no
  detectaba (Documentos, panel del estudio).
- Capturas en `diseno/etapa4/`.

### Etapa 5 — móvil y movimiento ✅ 2026-11-15
- **Celular** (guía `mobile-native`): `viewport-fit=cover` + `interactive-widget`; `theme-color` por
  esquema; sin destello al tocar; sin "tirar para recargar"; `touch-action: manipulation` (sin
  espera de doble toque); etiquetas de botones no seleccionables; campos a 16px en pantallas
  táctiles (iOS hacía zoom); márgenes de muesca/barra de inicio en aviso, botón de IA y cabeceras;
  `100vh` → `100dvh`. **96 estados `:hover` limitados a dispositivos con mouse** (en táctil quedaban
  pegados); los que muestran/ocultan algo se dejan. Barra superior en celular: casa + módulo con
  nombre corto + búsqueda en una fila, íconos en otra; menos espacio antes del contenido.
- **Movimiento**: respuesta al presionar en botones (escala 0,97, 80 ms); sugerencias de la consola
  con un desliz corto de entrada; el globo de la consola ya no gira en Inicio (solo en el login).
  Duraciones existentes ya estaban en 100-250 ms.
- Prueba `PLANIFICACION/diseno/probar-movil.js` (en `npm run test:navegador`): 26 comprobaciones con
  iPhone emulado. **Falta confirmar en un teléfono real**: hover pegado, zoom de iOS, muesca, teclado
  y "tirar para recargar" no se reproducen bien en emulación.

### Etapa 6 — revisión final ✅ 2026-11-15
- **`web-design-guidelines`** (`diseno/auditar-guias.js`, app real en 22 vistas + 3 formularios):
  97 → **0 hallazgos**. Campos con etiqueta visible ahora asociada, botones de solo ícono con
  nombre, aviso de cambios sin guardar (Escape, cambiar de módulo, cerrar pestaña), títulos
  equilibrados.
- **`break-ui`** (`diseno/datos-extremos.js`, estados demo/peor/vacío/uno/mil; capturas en
  `diseno/extremos/`):
  - Libros con 1.000 compras: **55 s → < 1,5 s** (`innerHTML +=` en bucle → `insertAdjacentHTML`
    en Compras, Ventas, Clientes, Balance, Diario, Mayor y Plan de Cuentas).
  - Nombres, glosas y descripciones escapados al mostrarse (`escHTML()` en `helpers.js`, 53
    lugares): "Ferretería <El Tornillo> & Hijos" se perdía y un XML del SII podía inyectar HTML.
    Las confirmaciones escapan el mensaje y solo permiten `<br>`/`<strong>`.
  - Montos: `fmtPeso()` en todo el sistema (111 lugares): cero como "—" y negativos "-$1.000"
    (antes "$-" y "$-1.000").
  - Celular: Libro Mayor cabe en 360 px; indicadores de Remuneraciones en 2 columnas
    (`remuneraciones.css` pisaba la regla de `main.css`).
  - Razón social en 2 líneas con el nombre completo en `title` (Compras, Ventas, Documentos); RUT
    sin partirse; empresa larga cortada con "…" en la barra; acciones de Documentos en una fila.
- **`emil-design-eng`**: curvas como tokens (`--ease-out`, `--ease-drawer`); salida de modales
  sin `ease-in`; sugerencias de la consola sin animación (uso diario y por teclado); tarjetas de
  datos sin elevarse al pasar el mouse; cronómetro activo con indicador fijo (sin pulso infinito).
- **Métricas antes → después del rediseño:** colores fijos 446 → 58 · emoji ~509 → 237 ·
  contraste AA 94/94 (antes fallaban ~30) · `style=` en línea ~1.650 → 1.645 y textos < 12 px
  262 → 264 (sin cambio: no eran objetivo de ninguna etapa).
- Pruebas: `npm run test:navegador` 376/376 · `revisar:texto` solo falsos positivos (insignias,
  `Ctrl K`, celdas de tablas desplazables) · capturas finales en `diseno/etapa6/`.
- **Frágil:** los libros no tienen paginación; con montos de miles de millones la tabla de Compras
  a 1366 px se desplaza horizontalmente para ver la columna de acciones.

### Consola y búsqueda unificadas ✅ 2026-11-17
- Un solo motor (`js/services/consola.js`) para la consola de Inicio y la barra "Busca o escribe
  qué hacer" de la cabecera (Ctrl K). Se eliminó `js/core/busqueda-global.js`.
- Resultados en grupos: **Ir a** (acciones de los módulos activos, o "Registrar en el Diario" si la
  frase trae un monto y palabras) y **datos del cliente** (Libro Diario, Compras, Ventas, Clientes y
  proveedores, Productos, Activos). Vacía: sugerencias del día (pendientes del cierre).
- En Inicio, Ctrl K enfoca la consola; en los módulos abre la misma consola como paleta, sin
  animación (Escape cierra y devuelve el foco). Elegir una compra o venta abre el libro en el mes
  del documento; un contacto abre su detalle.
- Corregido: la búsqueda por nombre en Compras y Ventas no encontraba nada (buscaba `razon_social`;
  los libros guardan `nombre_proveedor` / `nombre_cliente`).
- Pruebas: 7 nuevas en `probar-interaccion.js` (41/41) · `web-design-guidelines` 0 hallazgos ·
  capturas en `diseno/consola-unificada/`. Reglas v3 publicadas por el usuario (2026-11-17).

### Pendientes / próximo paso
1. Probar en un teléfono real (iOS y Android) lo marcado en la Etapa 5.
2. Probar con Firebase real: titular, invitado y código; "¿Olvidaste tu contraseña?" y
   "Recordarme" (aquí Firebase no carga). Reglas v3 ya publicadas.
3. Revisar en INAPI que "ID Contable" esté libre como marca, y el dominio.
4. Si se quiere entrar con Google/Microsoft: activar los proveedores en Firebase Auth y programarlo.
5. Sin pantalla para **revocar códigos o sacar invitados** (las reglas v3 ya lo permiten:
   `invitaciones/{codigo}.revocada = true` o quitar el uid de `perfiles/{titular}.invitados`).
6. Panel de notificaciones de la barra superior con avisos fijos de ejemplo (no lee datos reales).
7. Paginación de libros (Compras, Ventas, Diario) para meses con miles de documentos.
8. Licencia: un perfil sin campo `estado` pasa el control (`licencia.js`); definir al integrar el cobro.
