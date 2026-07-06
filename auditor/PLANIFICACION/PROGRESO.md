# ContApp Auditor — Progreso del proyecto
> Archivo vivo: actualizar al completar cada tarea.
> Última actualización: 2026-06-25
> Referencia completa: [INVENTARIO_COMPLETO.md](./INVENTARIO_COMPLETO.md)

---

## 🎯 PRÓXIMO PASO (actualizar tras cada tarea)

**Sprint activo:** Arquitectura de Módulos — Sprint refactor sidebar
**Estado:** ✅ Primera Y Segunda Categoría 100% completas. `verificar.js`: 26/26 ✅.
**Próxima tarea sugerida:** Ninguna pendiente del sprint de arquitectura — definir siguiente prioridad de producto
**Referencia:** `PLANIFICACION/ARQUITECTURA_MODULOS.md`

**Segunda Categoría completada (2026-07-06):**
- ✅ Sidebar reestructurado: G1 CONTABILIDAD · G2 DATOS · G3 TRIBUTARIO · G4 EMPRESA (antes: CONTABILIDAD/COMERCIAL/TRIBUTARIO sin badges ni consolidación)
- ✅ `view-libros-contables-hon` con 3 tabs: Libro de Honorarios | Libro de Ingresos | Libro de Egresos
- ✅ `view-declaracion-impuestos-hon` con 2 tabs: Formulario 29 | Formulario 22
- ✅ G2 Datos reutiliza módulos compartidos con primera categoría (Documentación, Conciliación y Cartolas, Clientes/Prov. — vistas category-agnostic) + Prestadores (propio de 2ª cat., no cubierto por el doc de arquitectura pero mantenido por ser funcionalidad real en uso, base de DJ1879)
- ✅ Los paneles de tabs reutilizan los ids legacy (`view-libro-honorarios`, `view-f29-hon`, etc.) en vez de ids nuevos tipo `tab-x`, porque `segunda-categoria.js::_honEnLibro()` depende de `getElementById('view-libro-honorarios').classList.contains('active')` — verificado que sigue funcionando tras el refactor
- ✅ Catálogo de módulos por cliente (`CAT2_MODULOS`) y grupos de nav (`CAT2_IDS_MOSTRAR/OCULTAR`, `gruposSegunda` en permisos.js) actualizados a los 7 módulos consolidados — aplicando la lección aprendida en primera categoría, se corrigió esto en el mismo cambio en vez de después
- ✅ Verificado: toggle por categoría (primera↔segunda) sin regresión, redirects legacy (`libro-honorarios`, `f22-hon`, etc.) funcionan, catálogo de activación por cliente funciona, 0 errores JS
- ⚠️ Fuera de scope (huérfanos preexistentes, no parte del doc de arquitectura): DJ1879, Calendario Tributario, Cotizaciones Previsionales, Gastos Presuntos, Retenciones — sin ítem de sidebar, no tocados
- ✅ `verificar.js`: 26/26 ✅

**Limpieza + Revisión completa de Primera Categoría (2026-07-06):**
- ✅ Eliminado "Hon. Estudio" de SISTEMA (nav item + `view-honorarios-estudio` + modal + script `honorarios-estudio.js` + referencias en app.js) — feature confirmada como no utilizada
- ✅ Recorridas las 20 pestañas de los 8 módulos con tabs (G1-G5) vía DOM: todas renderizan contenido, 0 errores JS
- ✅ **Bug corregido**: dashboard de Inicio mostraba el título estático "Sistema Contable" en vez de "Panel de Inicio" al iniciar sesión — `_fbShowApp()`/`_fbRefrescarUI()` (`firebase-service.js`) nunca llamaban a `navegar('inicio')` ni `renderIndicadores()`. Corregido para setear título/desc y refrescar el widget de indicadores al mostrar la app.
- ✅ **QA-01 corregido**: modal "Nuevo hallazgo" (y cualquier `.modal-overlay`) persistía flotando al navegar a otro módulo. Fix general en `navegar()`: cierra todo modal-overlay visible al cambiar de vista.
- ✅ **QA-02 corregido**: FAB de chat IA (fixed, bottom:28px/right:28px) se superponía ~15px con la columna de acciones (botón "Anular") al final de las tablas. Fix: `.view.active` con `padding-bottom: 110px` (antes 40px) para dar despeje. Verificado: 55px de margen limpio tras el fix.
- ✅ **QA-03 verificado como ya resuelto**: "Generar Asiento" con glosa vacía SÍ muestra toast de error ("Ingresa una glosa válida.") — no reproduce, ya estaba corregido de una sesión previa.
- ✅ Falso positivo en `verificar.js` corregido: el check de "selector de cuenta bancaria" en reconciliación buscaba strings que no coincidían con el código real (`recCuentaBanco`/`cuentaBanco`) — la función siempre existió, solo era un check desactualizado.
- ✅ `verificar.js`: **26/26 ✅** (primera vez sin ningún ❌ en esta sesión)

**G5 Empresa + Indicadores→Inicio completados (2026-07-06):**
- ✅ Nuevo grupo sidebar **G5 · EMPRESA**: Activos y Producción · Auditoría
- ✅ `view-activos-produccion` con 2 tabs: Activos Fijos | Productos y Servicios
- ✅ `view-auditoria` con 2 tabs: Informe | Hallazgos
- ✅ `_initModulosEmpresa()` reubica los shells legacy (view-activos, view-productos, view-informe, view-hallazgos)
- ✅ tabRedirects: activos/productos → activos-produccion; informe/hallazgos → auditoria
- ✅ Indicadores económicos (UF/UTM/IPC/TPM/USD/EUR) movidos a widget colapsable en `view-inicio` (`toggleIndicadoresWidget()`); `view-indicadores` eliminado
- ✅ Redirect especial: `navegar('indicadores')` → `inicio` (sin tabs, caso distinto a tabRedirects)
- ✅ Grupo TAX (Indicadores standalone) eliminado del sidebar de primera categoría
- ✅ **Bug crítico encontrado y corregido**: `permisos.js::aplicarNavegacionPorCategoria()`, `categorias/primera.js::CAT1_MODULOS/IDS` y `categorias/segunda.js::CAT2_MODULOS/IDS` referenciaban ids de grupo (`nav-grupo-crm`, `nav-grupo-tributario`) y `data-modulo` antiguos (diario/compras/activos/hallazgos/indicadores...) que ya no existían tras la consolidación G1-G5. Esto rompía silenciosamente: (a) el toggle de visibilidad por categoría (primera/segunda), y (b) el catálogo de activación/desactivación de módulos por cliente — la función central del producto. Ambos catálogos fueron reescritos con los 10 módulos consolidados actuales, agrupados G1-G5.
- ✅ **Paridad segunda categoría**: se agregó grupo `nav-grupo-empresa-hon` (oculto) con ítem "Auditoría" para no perder acceso a Informe/Hallazgos al sacarlos del grupo SISTEMA (antes visible en ambas categorías)
- ✅ Verificado por DOM: tabs, redirects, widget de Inicio, toggle por categoría, y catálogo de módulos por cliente — todos funcionando. 0 errores JS
- ⚠️ Nuevamente requirió limpiar service worker tras cada cambio de app.js (PWA cachea agresivo)

**G4 RRHH completado (2026-07-06):**
- ✅ Sidebar RRHH renombrado a **G4**
- ✅ `view-remuneraciones` con 2 tabs: 👷 Liquidaciones | 📋 Indicadores Previsionales
- ✅ Bloque Previred (tasas AFP/salud, topes, config credenciales) movido estáticamente desde `view-indicadores` a `tab-rem-previsional` — sin runtime move, ids preservados
- ✅ `remuneraciones.js::remRender()` ahora apunta a `tab-rem-liquidaciones` (antes `view-remuneraciones`)
- ✅ `view-indicadores` conserva solo tarjetas económicas (UF/UTM/IPC/TPM/USD/EUR) — quedan para futuro widget en Inicio
- ✅ Efecto colateral: se corrigió un `</div>` huérfano preexistente en `view-indicadores` (bug de markup previo al refactor)
- ✅ Verificado por DOM: tabs cambian, `renderIndicadores()` puebla Previred sin depender de que existan las tarjetas económicas (todas las referencias usan guard `if (!el) return`), 0 errores JS

**G3 Datos completado (2026-07-06):**
- ✅ Nuevo grupo sidebar **G3 · DATOS**: Documentación · Conciliación y Cartolas · Clientes/Prov.
- ✅ Documentación (`view-documentos`) y Clientes (`view-clientes`) reubicados como módulos simples
- ✅ `view-conciliacion-cartolas` con 2 tabs: Cartolas Bancarias | Conciliación Bancaria
- ✅ `_initModulosDatos()` mueve el nodo `view-cartolas` (poblado por render vía id) y `rec-root` a los paneles
- ✅ tabRedirects legacy: cartolas/reconciliacion → nuevos tabs
- ✅ Grupo CRM eliminado (Clientes absorbido en DATOS); Documentación removido de COMERCIAL
- ✅ Verificado por DOM: reubicación OK, tabs cambian, redirects OK, render de cartolas/conciliación/docs/clientes OK, 0 errores JS
- ⚠️ Requirió limpiar service worker (PWA cacheaba app.js viejo) — patrón a recordar entre sprints

**G2 Comercial completado (2026-07-06):**
- ✅ Sidebar COMERCIAL (G2): Egresos e Ingresos + Tributario (Documentación/Productos se conservan para G3/G5)
- ✅ `view-egresos-ingresos` con 3 tabs: Compras | Ventas | Boletas de Honorarios
- ✅ `view-tributario-1cat` con tab: Declaración de Impuestos (F29/IVA Resumen)
- ✅ `_initModulosComerciales()` reubica contenido legacy dentro de paneles (preserva IDs/handlers)
- ✅ `_fireActiveTab()` dispara render de pestaña activa al navegar (aplica a G1 y G2)
- ✅ tabRedirects legacy: compras/ventas/honorarios/iva-resumen → nuevos tabs
- ✅ Item "Resumen IVA / F29" removido del grupo TAX (absorbido en Comercial)
- ✅ Verificado por DOM: tabs cambian (block/none), redirects OK, tablas renderizan, 0 errores JS
- ⚠️ Screenshot del preview timeout (posible chart animado); verificación hecha vía inspección DOM

**Completado en esta sesión (2026-07-06):**
- ✅ CSS tab component `.mod-tabs` / `.mod-tab-btn` / `.mod-tab-panel` añadido a `css/main.css`
- ✅ `modTab()` + tabRedirects (diario/mayor/balance/balance-clasificado/estado-resultados/flujo-caja) en `js/services/app.js`
- ✅ Sidebar G1 CONTABILIDAD reestructurado: 2 ítems (Estructura Contable + Reportes Financieros)
- ✅ `view-estructura-contable` creado con 3 tabs: Libro Diario | Libro Mayor | Balance General
- ✅ `view-reportes-financieros` creado con 3 tabs: Balance Clasificado | Estado de Resultados | Flujo de Caja
- ✅ Legacy views vaciados: view-diario, view-mayor, view-balance, view-flujo-caja, view-balance-clasificado, view-estado-resultados
- ✅ Verificado en browser: tabs funcionales, 0 errores JS

**Secuencia pendiente:**
1. ✅ G1 Contabilidad (Estructura Contable + Reportes Financieros)
2. ✅ G2 Comercial: Egresos e Ingresos (Compras/Ventas/Honorarios) + Tributario (IVA Resumen)
3. ✅ G3 Datos: Documentación + Conciliación y Cartolas + Clientes y Prov.
4. ✅ G4 RRHH: Remuneraciones (con tasas laborales de indicadores)
5. ✅ G5 Empresa: Activos y Producción + Auditoría
6. ✅ Widget indicadores económicos en Inicio
7. 🔲 Fix QA: QA-01 modal persistente, QA-02 FAB overlap, QA-03 glosa vacía

---

## Estado general (verificado en código)

```
Sprint 1 — Crítico          ██████████ 100%  [ ✅ Completado — BUG-3/4/5 resueltos ]
Sprint 2 — UX               ██████████ 100%  [ ✅ Completado — tabla Mayor con 6 columnas ]
Sprint 3 — Módulos          ██████████ 100%  [ ✅ Completado — verificado ]
Sprint 4 — Reportes         ██████████ 100%  [ ✅ Completado — verificado ]
Sprint 5 — Integraciones    ██████████ 100%  [ ✅ Completado ]
Fase 2   — Panel estudio    ██████████ 100%  [ ✅ Completado — F2.1/F2.2/F2.3/F2.4/F2.5 implementados ]
Sprint IA — Gemini          ░░░░░░░░░░   0%  [ PLANIFICADO — ver SPRINT_IA_GEMINI.md ]
Fase 3   — SII              ░░░░░░░░░░   0%  [ Bloqueado — requiere F2 + backend + confirmación explícita ]
Fase 4   — Escala           ░░░░░░░░░░   0%  [ Bloqueado ]
Fase 5   — IA avanzada      ░░░░░░░░░░   0%  [ Reemplazado por Sprint IA con Gemini ]
```

---

## Bugs críticos

| # | Bug | Archivo | Línea | Estado |
|---|-----|---------|-------|--------|
| BUG-1 | Cartolas en blanco — ID incorrecto | `cartolas.js` | 686 | ✅ Corregido |
| BUG-2 | `mayor.js` truncado — `generarLibroMayor()` sin tabla HTML | `mayor.js` | 45+ | ✅ Corregido — tabla con `table-layout:fixed` y 6 columnas (N°, Fecha, Glosa, Debe, Haber, Saldo) |
| BUG-3 | `audAbrirCrearHallazgo()` llamada sin existir → error JS | `index.html` | 469,603,701 | ✅ Corregido — función existe en hallazgos.js |
| BUG-4 | `view-informe` sin enlace en sidebar — vista inaccesible | `index.html` | sidebar | ✅ Corregido — añadido nav-item "Informe Auditoría" en SISTEMA |
| BUG-5 | `siiMostrarGuiaProxy()` usa `alert()` nativo | `sii-rcv.js` | 385 | ✅ Corregido — reemplazado por modal inline con código formateado |

---

## Diseño UI

| # | Problema | Estado | Fecha |
|---|----------|--------|-------|
| D-1 | Tablas sin hover | ✅ `.cont-table tbody tr:hover td` con accent-soft | 2026-06-25 |
| D-2 | Botones sin jerarquía visual | ✅ Gradient+glow primario, outline secundario, rojo danger | 2026-06-25 |
| D-3 | Paneles laterales sin sombra | ✅ `4px 0 24px rgba(0,0,0,.12)` en sidebar | 2026-06-25 |
| D-4 | Empty states inconsistentes | ✅ Resuelto en balance y dashboard | 2026-06-25 |
| D-5 | Toasts sin distinción por tipo | ✅ `mostrarToast()` con tipos | 2026-06-25 |
| D-6 | Sidebar font-size < 11px | ✅ nav-group-title elevado a 10.5px | 2026-06-25 |
| D-7 | KPI label debajo del número | ✅ Flex order: valor primero (order:2), label debajo (order:3) | 2026-06-25 |
| D-8 | Paleta navy+magenta en variables.css | ✅ Aplicada | 2026-06-25 |
| D-9 | Diseño no alineado con ID Workshop | ✅ variables.css + main.css alineados: tokens, sombras, radius 20px | 2026-06-25 |
| D-10 | KPI Resultado usa #7B3FF2 fuera del design system | ✅ Añadido --info (#3B7DD8 / dark: #60A5FA) a variables.css; kpi-card-resultado usa var(--info) | 2026-06-25 |

---

## Sprint 1 — Crítico: hallazgos + informe
> Referencia: [SPRINT_1_CRITICO.md](./SPRINT_1_CRITICO.md)
> ⚠️ Marcado incorrectamente como completo. Estado real verificado: 40%.

| # | Tarea | Estado | Fecha |
|---|-------|--------|-------|
| 1.1a | Variables `AUD_HALLAZGOS_KEY`, `_audHallazgos` declaradas | ✅ Completado | — |
| 1.1b | `audHallazgosCargar()` | ✅ Verificado en código | 2026-06-25 |
| 1.1c | `audHallazgoCrear(tipo, descripcion, modulo)` | ✅ Verificado en código | 2026-06-25 |
| 1.1d | `audHallazgoResolver(id)` | ✅ Verificado en código | 2026-06-25 |
| 1.1e | `audHallazgosRender()` con filtros | ✅ Verificado en código | 2026-06-25 |
| 1.1f | `audHallazgosExportar()` | ✅ Verificado en código | 2026-06-25 |
| 1.1g | `audAbrirCrearHallazgo()` (llamada desde HTML) | ✅ Existe en hallazgos.js — BUG-3 resuelto | 2026-06-25 |
| 1.1h | Botón "Agregar hallazgo" en Diario | ✅ HTML presente | — |
| 1.1i | Botón "Agregar hallazgo" en Compras | ✅ HTML presente | — |
| 1.1j | Botón "Agregar hallazgo" en Ventas | ✅ HTML presente | — |
| 1.1k | Vista "Hallazgos" en menú lateral | ✅ Link en sidebar | — |
| 1.2a | `informeCargarDatos()` + `informeVistaPrevia()` | ✅ Verificado en código | 2026-06-25 |
| 1.2b | `informeExportarPDF()` | ✅ Verificado en código (jsPDF) | 2026-06-25 |
| 1.2c | `informeGuardarBorrador()` | ✅ Verificado en código | 2026-06-25 |
| 1.2d | Link al sidebar para `view-informe` | ✅ Añadido — BUG-4 resuelto | 2026-06-25 |

**Sprint 1 completado:** ✅ Sí — código verificado, BUG-3/4/5 resueltos, confirm() migrado a mostrarConfirm()

---

## Sprint 2 — UX: alerts, Mayor, confirmaciones
> Referencia: [SPRINT_2_UX.md](./SPRINT_2_UX.md)
> ⚠️ Marcado incorrectamente como completo. Estado real: 90%.

| # | Tarea | Estado | Fecha |
|---|-------|--------|-------|
| 2.1a | Reemplazar `alert()` en `diario.js` | ✅ Completado | 2026-06-25 |
| 2.1b | Acordeón ayuda para glosas | ✅ Completado | 2026-06-25 |
| 2.2a | Columna N° en tabla del Mayor | ✅ Completado | 2026-06-25 |
| 2.2b | Columna Glosa en tabla del Mayor | ✅ Completado — `table-layout:fixed` corrige desborde | 2026-06-25 |
| 2.2c | Saldo acumulado en tabla del Mayor | ✅ Completado | 2026-06-25 |
| 2.3a | Filtro por cuenta en Libro Mayor | ✅ Completado | 2026-06-25 |
| 2.3b | Filtro por período en Libro Mayor | ✅ Completado | 2026-06-25 |
| 2.4a | Reemplazar `alert()` en `plan-cuentas.js` | ✅ Completado | 2026-06-25 |
| 2.5a | Reemplazar `alert()` en `remuneraciones.js` | ✅ Completado | 2026-06-25 |
| 2.5b | Eliminar `console.log` en `remuneraciones.js` | ✅ Completado | 2026-06-25 |
| 2.6a | Implementar `mostrarConfirm()` propio | ✅ Completado (en `app.js`) | 2026-06-25 |
| 2.6b | Migrar `confirm()` destructivos → `mostrarConfirm()` | ✅ Completado — 0 nativos restantes (DT-1) | 2026-06-25 |

**Sprint 2 completado:** ✅ Sí — todas las tareas verificadas en código

---

## Sprint 3 — Módulos incompletos ✅ VERIFICADO COMPLETO
> Verificado directamente en código. Archivo [SPRINT_3_MODULOS.md](./SPRINT_3_MODULOS.md) archivado.

| # | Tarea | Estado | Fecha |
|---|-------|--------|-------|
| 3.1a | `_docEditandoId` en `documentos.js` | ✅ Verificado | 2026-06-25 |
| 3.1b | `editarDocumento(id)` | ✅ Verificado | 2026-06-25 |
| 3.1c | Lógica update/insert en `guardarDocumento()` | ✅ Verificado | 2026-06-25 |
| 3.1d | Botón Editar en tabla documentos | ✅ Verificado | 2026-06-25 |
| 3.2a | `guardarCartolas()` al clasificar | ✅ Verificado | 2026-06-25 |
| 3.2b | BUG-1 cartolas corregido | ✅ Verificado línea 686 | 2026-06-25 |

**Sprint 3 completado:** ✅ Sí

---

## Sprint 4 — Reportes y tributario ✅ VERIFICADO COMPLETO
> Verificado directamente en código. Archivo [SPRINT_4_REPORTES.md](./SPRINT_4_REPORTES.md) archivado.

| # | Tarea | Estado | Fecha |
|---|-------|--------|-------|
| 4.1a | Empty state en `balance.js` | ✅ Verificado línea 38 | 2026-06-25 |
| 4.2a | Panel onboarding en `dashboard.js` | ✅ Verificado | 2026-06-25 |
| 4.3a | NC ventas restan débito fiscal | ✅ Verificado `iva-resumen.js` | 2026-06-25 |
| 4.3b | NC compras restan crédito fiscal | ✅ Verificado | 2026-06-25 |
| 4.3c | Detalle NC en UI del F29 | ✅ Verificado línea 186 | 2026-06-25 |
| 4.4a | Botón PDF DJ 1879 | ✅ Verificado `index.html` | 2026-06-25 |
| 4.4b | Botón Excel DJ 1879 | ✅ Verificado `index.html` | 2026-06-25 |
| 4.5a | Campo `periodos_depreciados` | ✅ Verificado `activos.js` | 2026-06-25 |
| 4.5b | Validación anti-doble depreciación | ✅ Verificado línea 589 | 2026-06-25 |
| 4.5c | Columna "Último período" en tabla activos | ✅ Verificado línea 264 | 2026-06-25 |

**Sprint 4 completado:** ✅ Sí

---

## Sprint 5 — Integraciones internas
> Referencia: [SPRINT_5_INTEGRACIONES.md](./SPRINT_5_INTEGRACIONES.md)

| # | Tarea | Estado | Fecha |
|---|-------|--------|-------|
| 5.1a | Autocomplete producto → Compras | ✅ Completado — botón + callback + bug prodSeleccionarItem corregido | 2026-06-25 |
| 5.1b | Autocomplete producto → Ventas | ✅ Completado — botón + callback | 2026-06-25 |
| 5.2a | Selector cuenta bancaria en reconciliación | ✅ Verificado en código | 2026-06-25 |
| 5.2b | Filtrar asientos por cuenta seleccionada | ✅ Verificado — `_cuentaEsBanco()` en `_recAsientosDelPeriodo()` | 2026-06-25 |
| 5.2c | Persistir cuenta activa | ✅ Verificado — persiste dentro de `core_reconciliacion` state | 2026-06-25 |
| 5.3a | `core_fc_overrides` en localStorage | ✅ Completado | 2026-06-25 |
| 5.3b | Aplicar overrides en flujo de caja | ✅ Completado — `_clasificarAsiento()` revisa overrides primero | 2026-06-25 |
| 5.3c | Panel UI para overrides | ✅ Completado — modal con CRUD completo, botón en toolbar | 2026-06-25 |
| 5.4a | Logger condicional en `helpers.js` | ✅ Completado — `log()`/`warn()` condicional por hostname | 2026-06-25 |
| 5.4b | Reemplazar `console.log` globales | ✅ Ya hecho (0 instancias) | 2026-06-25 |
| 5.5a | `sii-rcv.js` línea 385: reemplazar `alert()` | ✅ Corregido — BUG-5 resuelto | 2026-06-25 |

**Sprint 5 completado:** ✅ Sí — todas las tareas implementadas y verificadas

---

## Deuda técnica horizontal

| # | Tarea | Estado | Notas |
|---|-------|--------|-------|
| DT-1 | `confirm()` → `mostrarConfirm()` (29 restantes) | ⚠️ Parcial | `mostrarConfirm()` existe |
| DT-2 | Logger condicional global | ✅ Resuelto | 0 `console.log` activos |
| DT-3 | IA disponible en web | ⬜ Pendiente | Requiere proxy backend |
| DT-4 | localStorage → IndexedDB | ⬜ Pendiente | |
| DT-5 | Webhook de pago | ⬜ Pendiente | |

---

## Fases largas

| Fase | Hito | Estado |
|------|------|--------|
| F2 | Panel global de clientes | ✅ Completado — F2.1 lista enriquecida con KPIs, search y estado por cliente |
| F2 | Kanban por período | ✅ Completado — F2.2 4 columnas, estado persistido en Firestore |
| F2 | Calendario tributario | ✅ Completado — F2.3 fechas F29/Cotizaciones/F22/DJ1879, vista mensual |
| F2 | Time tracking por cliente | ✅ Completado — F2.4 timer start/stop, resumen diario en tarjeta |
| F3 | Proxy backend SII | ⬜ Pendiente |
| F3 | Descarga RCV automática | ⬜ Pendiente |
| F3 | DTE / Factura Electrónica | ⬜ Pendiente |
| F4 | App móvil (Capacitor) | ⬜ Pendiente |
| F4 | Portal del cliente | ⬜ Pendiente |
| F5 | Proyección flujo de caja con IA | ⬜ Pendiente |
| F5 | Alertas inteligentes anomalías | ⬜ Pendiente |

---

## Historial de cambios

| Fecha | Descripción |
|-------|-------------|
| 2026-06-25 | Archivo creado. Estado inicial. |
| 2026-06-25 | Sprint 1 marcado ✅ incorrectamente por Claude Code — revertido. |
| 2026-06-25 | Sprint 2 marcado ✅ incorrectamente por Claude Code — revertido a 90%. |
| 2026-06-25 | Análisis profundo del código. S3 y S4 verificados ✅. 5 bugs documentados. INVENTARIO_COMPLETO.md creado. |
| 2026-06-25 | Design review completo. D-1 a D-9 resueltos. variables.css y main.css alineados con ID Workshop (marinf-lab.github.io). |

---

## Leyenda

| Símbolo | Significado |
|---------|-------------|
| ⬜ Pendiente | No iniciado |
| ⚠️ Parcial | Iniciado pero incompleto |
| ✅ Completado | Verificado en código fuente |
| ❌ No existe / Falla | Verificado que no existe o está roto |
