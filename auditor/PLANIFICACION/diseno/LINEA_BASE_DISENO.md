# Línea base de diseño — ContApp Auditor (Etapa 0)

> Fecha: 2026-11-14 · Rama base: `main` (con Fases 0-3 de conectividad unidas)
> Referencia del rediseño: `PLANIFICACION/diseno/referencia-contapp-consola.html`
> Herramientas: skills `web-design-guidelines` (reglas de interfaz web, versión publicada de
> vercel-labs/web-interface-guidelines) y `ui-ux-pro-max` (contraste y accesibilidad), capturas con
> Chromium/Playwright, mediciones con scripts.
> **Esta etapa no cambió la app**: solo documentación, referencia y capturas.

---

## 1. Capturas del "antes"

Carpeta `PLANIFICACION/diseno/linea-base/` — 19 pantallas × tema claro y oscuro (38 JPG, 1366×860),
con datos de ejemplo (cliente "Transportes Cordillera Ltda.", octubre 2026):

| # | Pantalla | # | Pantalla |
|---|----------|---|----------|
| 00 | Login* | 10 | IVA y F29 |
| 01 | Inicio · centro de mando | 11 | Documentos |
| 02 | Inicio · financiero y actividad | 12 | Cartolas |
| 03 | Inicio · configuración | 13 | Conciliación bancaria |
| 04 | Libro Diario | 14 | Remuneraciones |
| 05 | Libro Mayor | 15 | Activos fijos |
| 06 | Balance | 16 | Clientes y proveedores |
| 07 | Estado de resultados | 17 | Configuración |
| 08 | Libro de Compras | 18 | Formulario "Registrar compra" |
| 09 | Libro de Ventas | | |

\* En el entorno de captura Firebase no carga (CDN bloqueado), así que la app entra en modo sin
conexión y **no muestra el login**; la captura 00 muestra la cabecera vacía. Capturar el login real
requiere un navegador con acceso a Firebase.

---

## 2. Hallazgos principales

### H1 · Centro de mando vacío cuando Firebase no carga (funcional, importante)
Si el SDK de Firebase no carga (primera apertura sin conexión, CDN caído o bloqueado), `fbInit()`
entra en `_fbEntrarModoOffline()` **en el script inline**, antes de que existan `menu.js` y
`categorias/*.js`. Resultado: Inicio muestra "Selecciona un grupo de módulos" **sin ningún grupo**.
Comprobado: tras cargar la página, llamar `refrescarMenuNavegacion()` dibuja los 4 grupos.
**Arreglo propuesto (cambio aparte, no visual):** diferir `_fbEntrarModoOffline` a `DOMContentLoaded`
también en el `catch` de `fbInit()` (como ya se hace con `LOGIN_DESACTIVADO_TEMPORAL`).

### H2 · Contraste insuficiente en el tema claro (paleta actual)
| Combinación | Contraste | AA (4,5:1) |
|-------------|-----------|------------|
| Texto `#1E1E5D` / fondo | 13,92 | ✅ |
| Texto secundario / tarjeta | 6,17 | ✅ |
| Texto tenue `#9498B8` / tarjeta | 2,82 | ❌ |
| **Acento coral `#FF8692` / tarjeta** (enlaces, montos, pestañas) | 2,31 | ❌ |
| **Blanco sobre coral** (botón principal) | 2,31 | ❌ |
| Verde positivo / tarjeta | 2,64 | ❌ |
| Ámbar advertencia / tarjeta | 1,99 | ❌ |
| Rojo negativo / tarjeta | 3,28 | ❌ |
| Oscuro: texto tenue / tarjeta | 3,72 | ❌ |

La paleta de la referencia (logo) ya está ajustada: **todas sus combinaciones pasan 4,5:1 en ambos
temas** (magenta `#A03A63`, gris de texto `#4A5C6C`, verde `#1C6E50`, ámbar `#875A0C` en claro).

### H3 · El tema oscuro no sigue al sistema y no avisa al navegador
- `initTheme()` arranca siempre en claro; no lee `prefers-color-scheme`.
- No hay `color-scheme: dark` → barras de desplazamiento e inputs nativos quedan claros en oscuro.
- No hay `<meta name="theme-color">`.

### H4 · Deuda de estilos (lo que impide cambiar la paleta de una vez)
| Métrica | Valor |
|---------|-------|
| Colores fijos (hex/rgba) en JS + HTML + CSS | ~650 (main.css 137, remuneraciones.js 73, index.html 34, auditor.css 28, clientes.js 23, plan-cuentas.js 23…) |
| Atributos `style="..."` en línea | ~1.650 (index.html 480, remuneraciones.js 223, indicadores.js 143, productos.js 121, activos.js 97, reconciliacion.js 87…) |
| Emoji usados como íconos | ~509 |
| Tamaños de letra < 12 px | 262 |

### H5 · Revisión con `web-design-guidelines` (archivos: index.html, main.css, variables.css, menu.js, home-hub.js)
**Accesibilidad**
- `<div>`/`<span>` con `onclick` en vez de `<button>`/`<a>`: index.html:62, 65, 73, 99, 103, 110, 114 (+5);
  menu.js:102, 107; home-hub.js:32, 89, 161 (tarjetas del centro de mando y chips de módulos no son
  alcanzables con teclado).
- Botones solo con ícono sin `aria-label`: index.html:137, 384, 1977, 2719, 2863, 2888 (+5).
- Campos sin `<label for>` ni `aria-label` (aprox., puede incluir falsos positivos con etiqueta
  envolvente): index.html:301, 331, 362, 527, 866, 943 y ~109 más.
- Toasts sin `aria-live="polite"`; falta enlace "saltar al contenido".
- `<img>` sin `alt` (index.html:1421) y sin `width`/`height` (index.html:1421, 2313, 2314).

**Foco**
- `:focus` usado 18 veces y `:focus-visible` 0 veces en main.css.
- `outline: none` sin reemplazo verificado: main.css:320, 1407, 1476, 1811, 2061, 2325 (+7).

**Formularios**
- Campos de correo/contraseña sin `autocomplete`: index.html:1017, 1072, 2119, 2221, 2336, 2345.

**Animación y rendimiento**
- `transition: all`: main.css:316, 983, 1502, 1545, 2285.
- Sin `prefers-reduced-motion` en ningún CSS.
- Fuentes cargadas con `@import` dentro de variables.css:7 (bloquea el render) → usar
  `<link rel="preconnect">` + `<link rel="stylesheet">` en el `<head>`.

**Tipografía**
- `...` en vez de `…`: index.html:528, 2536.

### H6 · Observaciones visuales (de las capturas)
- Cabeceras del Libro Mayor en bloques coral sólidos: mucho peso visual para un dato secundario.
- Botones de acción en Cartolas ("Clasificar", "Ignorar", "Generar asientos") sin estilo de la app.
- Íconos emoji en tarjetas de indicadores (Remuneraciones, Activos) y en el centro de mando.
- Mucho texto de 10-11 px en encabezados de tabla y etiquetas.

---

## 3. Cómo se usa esta línea base
- **Etapa 1** parte por H2/H3 (tokens y tema).
- **Etapa 2** usa la tabla H4 para priorizar archivos.
- **Etapas 3-4** resuelven H5 (botones reales, `aria-label`, foco) a medida que se rediseña cada pantalla.
- **Etapa 6** repite estas capturas y mediciones para comparar antes/después.

Reproducir capturas: desde `auditor/`, `python3 -m http.server 8765` y luego
`node PLANIFICACION/diseno/capturar-linea-base.js` (siembra datos de ejemplo en `localStorage`,
recorre las 19 pantallas con `navegar()` y guarda JPG por tema en `linea-base/`).
