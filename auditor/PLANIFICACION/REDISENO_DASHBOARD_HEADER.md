# Rediseño de Header + Dashboard — Instrucciones de implementación

> Estado: 📝 Planificado — pendiente de implementar.
> Alcance acordado con el usuario: **solo visual/funcional de datos existentes**. No incluye Sucursal (multi-sucursal) ni un flujo de aprobación real que toque Libro Mayor/Balance (ambos quedaron explícitamente fuera de alcance).

## Contexto

El usuario compartió un mockup de un dashboard contable ("CONTAPP Gestión Contable") con: sidebar oscuro navy, un header con selectores de Empresa/Ejercicio/Periodo + búsqueda global + notificaciones/avatar, una fila de tabs horizontal bajo el header, y un dashboard con tarjetas de gráficos (Estado financiero, Flujo de caja, Indicadores clave, Composición de activos) y tablas (IVA Débito Fiscal, Aging de cuentas por cobrar, Últimos movimientos).

Este documento formaliza el plan de implementación para que quede versionado y se pueda retomar en cualquier sesión de trabajo, siguiendo el protocolo de `CLAUDE.md`.

**Conflicto con reglas del proyecto (autorizado explícitamente por el usuario):**
- `CLAUDE.md` marca "Dashboard" como módulo *production-ready — NO tocar*. El usuario pidió explícitamente rediseñarlo — se autoriza tocar solo `view-inicio` y `js/services/dashboard.js`, no Balance ni Libro Mayor.
- `CLAUDE.md` dice "no instalar dependencias nuevas". El usuario eligió explícitamente usar una librería de gráficos vía CDN (Chart.js) en vez de seguir generando SVG a mano. Es la única dependencia nueva a agregar.

## Decisiones de alcance (confirmadas con el usuario)

| Tema | Decisión |
|---|---|
| Apps afectadas | Solo `ContAPP/auditor` (no educa/empresa/public/pymes) |
| Sucursal (multi-sucursal) | **Fuera de alcance** — no agregar selector ni modelo de datos |
| Ejercicio (año fiscal) y Periodo (rango de fechas) | Deben ser filtros **reales**, no decorativos |
| Estado Aprobado/Pendiente en "Últimos movimientos" | **Solo visual** — sin flujo de aprobación nuevo, sin tocar Libro Mayor/Balance |
| Gráficos | Chart.js vía CDN (mantener las funciones SVG existentes para las vistas que aún las usan) |
| Ritmo | Implementación completa en un solo pase, con verificación visual al final en el preview |

## Fase 1 — Header + tema oscuro por defecto

**Archivo:** `index.html` (bloque `.top-header`, líneas ~222-262)

- Agregar selectores **Ejercicio** (año) y **Periodo** (rango de fechas, `<input type="date">` x2) junto al selector de Empresa existente (reutilizar el botón "🏢 Cambiar" ya wireado a `cambiarEmpresa()` en `js/services/firebase-service.js:539`).
- Ejercicio se puebla con los años distintos presentes en `dbAsientos` (+ el año actual si no hay datos).
- Guardar el filtro seleccionado en un estado global simple, ej. `window._filtroGlobal = { ejercicio, desde, hasta }`, persistido en `localStorage`.
- Agregar iconos de notificación/ayuda y un avatar con iniciales derivadas de `currentUser.email`.
- **Tema oscuro por defecto:** en `index.html` línea 28 (`var t = localStorage.getItem('appTheme') || 'light';`) y línea 2 (`<html data-theme="light">`), cambiar el fallback a `'dark'`. No tocar `toggleTheme()` (línea ~3037) — el usuario debe poder seguir alternando a claro.
- Revisar `--table-header` y `--table-hover`, referenciadas en `main.css` (`.cartola-tabla`) pero no definidas en `variables.css` — agregarlas en ambos modos.

## Fase 2 — Tabs del Dashboard

**Archivo:** `index.html` (`view-inicio`, líneas 272-441) + `js/services/app.js` (`modTab`, `navegar`, patrón ya usado en `view-estructura-contable`)

- Envolver el contenido de `view-inicio` con el patrón `.mod-header` + `.mod-tabs` + `.mod-tab-panel` ya usado en el resto de la app (ver `view-estructura-contable` como referencia).
- Tabs: **Dashboard** (contenido nuevo, ver Fase 3) / Análisis financiero / Flujo de caja / Ventas / Compras / Indicadores / Reportes.
- Las 6 tabs no-Dashboard **no duplican funcionalidad**: usan el mismo mecanismo de `tabRedirects` que ya existe en `navegar()` (`app.js` línea ~82) para apuntar a vistas ya construidas (`view-reportes-financieros`, `view-egresos-ingresos` tab Ventas/Compras, `view-tributario-1cat`, etc.).

## Fase 3 — Tarjetas del Dashboard

**Archivo:** `js/services/dashboard.js` (reemplaza el contenido de `calcularKPIs()` desde la línea 73 en adelante — mantener la firma de la función porque `app.js` y `firebase-service.js:308` la llaman externamente)

Agregar el script de Chart.js en `index.html` antes de `dashboard.js`:
```html
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
```

Nuevas funciones de render (mantener las funciones SVG actuales — `_svgDonut`, `_renderBarrasMensuales` — solo se usan dentro de `dashboard.js`, se pueden reemplazar sin afectar otras vistas):

| Tarjeta | Función nueva | Fuente de datos real |
|---|---|---|
| Estado financiero (line chart) | `_renderChartEstadoFinanciero()` | Agregación mensual de `dbAsientos` por Ingresos/Egresos (misma lógica que `_renderBarrasMensuales`, extendida a 4 series) |
| Flujo de caja (bar chart) | `_renderChartFlujoCaja()` | Clasificar movimientos de Caja/Banco por grupo de cuenta (operacional = default, inversión = Activo No Circulante, financiamiento = Préstamos/Capital) |
| Indicadores clave + sparklines | `_renderIndicadoresClave()` | Reutilizar `_calcularLiquidezDash()` + agregar margen bruto, rotación de activos, ROA; sparkline = últimos 6 meses de cada indicador |
| Composición de activos | `_renderComposicionActivos()` | Reutilizar el patrón HTML/CSS de `_renderTopCuentas()` (barra segmentada, no Chart.js) agrupando por Activo Circulante/Fijo/Otros/Inversiones |
| IVA Débito Fiscal | `_renderIvaDashboardCard()` | Reutilizar `generarIvaResumen()` de `js/services/iva-resumen.js:12` (ya calcula `ivaDebito`, `ivaCredito`, totales) |
| Aging de cuentas por cobrar | `_renderAgingCuentasPorCobrar()` | Filtrar `dbVentas` donde `medio_pago === 'credito'` y `estado !== 'pagado'` (campos reales en `js/modules/ventas.js:384,390`), bucketear por días transcurridos desde `venta.fecha` (0-30/31-60/61-90/+90). No hay campo de fecha de vencimiento explícito — se usa la fecha del documento como base, es una simplificación conocida. |
| Últimos movimientos | `_renderUltimosMovimientos()` | Extiende `_renderUltimosAsientos()` a tabla completa (Documento/Cliente-Proveedor/Debe/Haber). Columna Estado: **solo visual** — `Anulado` (rojo) si `asiento.estado === 'ANULADO'`, si no `Aprobado` (verde). No inventar estados intermedios falsos. |

**Importante — ciclo de vida de Chart.js:** como los paneles se re-renderizan limpiando `innerHTML`, cada instancia de Chart.js debe guardarse en una variable (ej. `window._chartEstadoFinanciero`) y llamarse `.destroy()` antes de crear una nueva, o quedan gráficos fantasma / fugas de memoria.

**Filtro Ejercicio/Periodo:** todas las funciones de la tabla anterior deben leer `window._filtroGlobal` para acotar los datos (año + rango de fechas) en vez de usar `new Date().getFullYear()` hardcodeado como hace hoy `_renderBarrasMensuales()` (línea 141).

## Verificación

1. Regresión de parsing de glosas (ya cubierta por la batería de 22 casos probada en esta sesión) — no debería verse afectada por este cambio, pero re-ejecutar si se toca `diario.js`.
2. Confirmar visualmente en el preview (`npx serve . -p 8080`, o el server ya activo): sidebar oscuro por defecto, header con Ejercicio/Periodo funcionando, tabs del dashboard, las 7 tarjetas con datos reales de la empresa actual.
3. Confirmar que Libro Mayor y Balance General **no cambian** (no se tocó su lógica de filtrado).
4. Responsive: revisar en viewport móvil (375px) que el header y las tarjetas no rompan el layout (mismo criterio usado para el fix de Plan de Cuentas en esta sesión).
