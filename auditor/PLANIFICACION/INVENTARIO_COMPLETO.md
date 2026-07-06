# ContApp Auditor — Inventario Completo del Estado Real
> Generado: 2026-06-25 | Actualizar con cada revisión profunda.
> **Este archivo refleja lo que realmente existe en el código**, no lo que dice PROGRESO.md.

---

## Resumen ejecutivo

| Área | Estado real |
|------|------------|
| Módulos funcionales | 30 archivos JS, 6 CSS + HTML |
| Funciones implementadas | ~180 funciones en producción |
| Módulos vacíos (stub) | 2 (`hallazgos.js`, `informe-auditoria.js`) |
| Bugs críticos resueltos | 1/2 (BUG-1 cartolas ✅, BUG-2 reconciliación ⬜) |
| Paleta D-8 aplicada | ✅ (`variables.css` actualizado) |
| Sprint 1 real | ❌ 40% — funciones core sin implementar |
| Sprint 2 real | ❌ 90% — falta columna Glosa en Mayor |
| Sprint 3 real | ✅ 100% — completado |
| Sprint 4 real | ✅ 100% — completado |
| Sprint 5 real | ❌ 55% — faltan 5 ítems |

---

## MÓDULOS — Inventario función a función

### js/auditor/ — Exclusivo Auditor

#### `hallazgos.js` — ⚠️ STUB (23 líneas)
| Función | Estado | Notas |
|---------|--------|-------|
| `AUD_HALLAZGOS_KEY` | ✅ var declarada | Solo la constante |
| `_audHallazgos` | ✅ var declarada | Array vacío |
| `_audPeriodoFiltro` | ✅ var declarada | String vacío |
| `audHallazgosCargar()` | ❌ No existe | |
| `audHallazgoCrear()` | ❌ No existe | Llamada desde HTML sin función |
| `audHallazgoResolver()` | ❌ No existe | |
| `audHallazgosRender()` | ❌ No existe | `view-hallazgos` vacío |
| `audHallazgosExportar()` | ❌ No existe | |
| `audAbrirCrearHallazgo()` | ❌ No existe | HTML la llama 3 veces |

> **Riesgo:** Los botones "Agregar Hallazgo" en Diario/Compras/Ventas llaman a `audAbrirCrearHallazgo()` que no existe → error JS silencioso.

#### `informe-auditoria.js` — ⚠️ STUB (25 líneas)
| Función | Estado | Notas |
|---------|--------|-------|
| `INF_BORRADOR_KEY` | ✅ var declarada | |
| `_infDatos` | ✅ var declarada | Objeto vacío |
| `informeCargarDatos()` | ❌ No existe | |
| `informeVistaPrevia()` | ❌ No existe | `view-informe` vacío |
| `informeExportarPDF()` | ❌ No existe | |
| `informeGuardarBorrador()` | ❌ No existe | |

> **Nota:** `view-informe` existe en HTML pero NO hay enlace en el sidebar → inaccesible desde UI.

#### `licencia.js` — ✅ Funcional (65 líneas)
| Función | Estado |
|---------|--------|
| Gestión de estado de licencia | ✅ |
| Verificación de período de prueba | ✅ |

> **Bug conocido:** trata usuarios `pendiente_pago` como activos (deuda técnica DT-5).

#### `multi-cliente.js` — ✅ Funcional (148 líneas)
| Función | Estado |
|---------|--------|
| Panel de selección de cliente | ✅ |
| Cambio de contexto de empresa | ✅ |
| Cards con color picker | ✅ |

---

### js/core/ — Lógica compartida

#### `helpers.js` — ✅ Funcional (280 líneas)
| Función | Estado | Notas |
|---------|--------|-------|
| `fmt(num)` | ✅ | Formato CLP |
| `limpiarNum(str)` | ✅ | Parse montos |
| `tasaIva()`, `factorIva()`, `ivaPct()` | ✅ | Cálculo IVA |
| `fmtMoneyInput(el)` | ✅ | Formato en tiempo real |
| `ufAPesos()`, `utmAPesos()` | ✅ | Conversión UF/UTM |
| `exportarERP()`, `importarERP()` | ✅ | Backup JSON |
| `guardarRespaldoAutomatico()` | ✅ | |
| Logger condicional `const log` | ❌ No existe | **S5 pendiente** |

#### `plan-cuentas.js` — ✅ Funcional (503 líneas)
| Función | Estado |
|---------|--------|
| CRUD completo de cuentas | ✅ |
| `renderPlanCuentas()` | ✅ |
| Modal agregar/editar cuenta | ✅ |
| `alert()` eliminados | ✅ |

#### `contabilidad.js` — ✅ Funcional (57 líneas)
| Función | Estado | Notas |
|---------|--------|-------|
| `recopilarMovimientosPorCuenta()` | ✅ | Incluye `glosa` y `numero` en historial |
| `validarConsistenciaContable()` | ✅ | Detecta saldos imposibles |

#### `db.js` — ✅ Funcional (82 líneas)
| Función | Estado |
|---------|--------|
| Acceso a localStorage | ✅ |
| Variables globales `dbAsientos`, `dbCompras`, etc. | ✅ |

#### `busqueda-global.js` — ✅ Funcional (501 líneas)
| Función | Estado |
|---------|--------|
| Ctrl+K búsqueda global | ✅ |
| Indexación de todos los módulos | ✅ |

#### `parser-sii.js` — ✅ Funcional (390 líneas)
| Función | Estado |
|---------|--------|
| `siiParsearXML()` | ✅ |
| `siiDocACompra()`, `siiDocAVenta()` | ✅ |
| Importador drag&drop | ✅ |

#### `autocomplete.js` — ✅ Funcional (214 líneas)
| Función | Estado |
|---------|--------|
| Autocomplete genérico de cuentas | ✅ |

#### `parser.js` — ✅ Funcional (111 líneas)

---

### js/modules/ — Vistas de módulos

#### `activos.js` — ✅ Completo (659 líneas)
| Función | Estado | Notas |
|---------|--------|-------|
| CRUD activos fijos | ✅ |
| Cálculo de depreciación | ✅ |
| `periodos_depreciados[]` | ✅ | Array que previene doble dep. |
| Anti-doble depreciación | ✅ | Validación pre-cálculo (línea 589) |
| Columna "Último período" | ✅ | Visible en tabla (línea 264) |

#### `cartolas.js` — ✅ Completo (888 líneas)
| Función | Estado | Notas |
|---------|--------|-------|
| `renderCartolas()` | ✅ | **BUG-1 corregido** → `view-cartolas` |
| `guardarCartolas()` | ✅ | Llamada al clasificar |
| `cartolasImportarArchivo()` | ✅ | CSV/OFX |
| `cartolasGenerarAsientos()` | ✅ | |
| Panel de clasificación | ✅ | Persiste al cerrar |

#### `clientes.js` — ✅ Completo (666 líneas)
| Función | Estado |
|---------|--------|
| CRUD completo clientes/proveedores | ✅ |
| Ficha detalle | ✅ |

#### `compras.js` — ✅ Funcional (554 líneas)
| Función | Estado | Notas |
|---------|--------|-------|
| CRUD compras | ✅ |
| Centralización al Diario | ✅ |
| Autocomplete de productos | ❌ | **S5 pendiente** |

#### `ventas.js` — ✅ Funcional (543 líneas)
| Función | Estado | Notas |
|---------|--------|-------|
| CRUD ventas | ✅ |
| Centralización al Diario | ✅ |
| Autocomplete de productos | ❌ | **S5 pendiente** |

#### `documentos.js` — ✅ Completo (539 líneas)
| Función | Estado | Notas |
|---------|--------|-------|
| `guardarDocumentos()` | ✅ |
| `renderDocumentos()` | ✅ |
| `editarDocumento(id)` | ✅ | Implementada (Sprint 3) |
| `_docEditandoId` | ✅ | Persiste ID en edición |
| Lógica update/insert | ✅ |
| Botón Editar en tabla | ✅ |

#### `productos.js` — ✅ Funcional (697 líneas)
| Función | Estado | Notas |
|---------|--------|-------|
| CRUD productos/servicios | ✅ |
| `prodGetById(id)` | ✅ | Disponible para autocomplete |
| Integración con compras/ventas | ❌ | **S5 pendiente** |

#### `remuneraciones.js` — ✅ Funcional (2176 líneas)
| Función | Estado | Notas |
|---------|--------|-------|
| Liquidaciones de sueldo | ✅ |
| AFP/Salud/cotizaciones | ✅ |
| `alert()` eliminados | ✅ |
| `console.log` eliminados | ✅ |

#### `segunda-categoria.js` — ✅ Completo (870 líneas)
| Función | Estado | Notas |
|---------|--------|-------|
| Emisión de boletas honorarios | ✅ |
| Cálculo retención 2ª categoría | ✅ |
| DJ 1879 | ✅ | Vista implementada |
| Exportar DJ1879 PDF | ✅ | `exportarPDFGenerico()` en HTML |
| Exportar DJ1879 Excel | ✅ | `exportarExcelGenerico()` en HTML |

---

### js/services/ — Servicios de la app

#### `app.js` — ✅ Funcional (445 líneas)
| Función | Estado | Notas |
|---------|--------|-------|
| `navegar()` | ✅ | Router de vistas |
| `mostrarConfirm()` | ✅ | Modal propio, reemplaza `confirm()` |
| `mostrarToast()` | ✅ | Toasts por tipo |
| Configuración global | ✅ |

#### `diario.js` — ✅ Funcional (1159 líneas — binario por encoding)
| Función | Estado | Notas |
|---------|--------|-------|
| Entrada de asientos | ✅ |
| Procesamiento de glosas | ✅ |
| `alert()` eliminados | ✅ |
| Botón "Agregar Hallazgo" | ✅ | HTML presente |

#### `mayor.js` — ⚠️ Parcial (63 líneas)
| Función | Estado | Notas |
|---------|--------|-------|
| `generarLibroMayor()` | ⚠️ | Existe pero **incompleta** — no renderiza tabla |
| Filtro por cuenta | ✅ | `selMayorCuenta` |
| Filtro por período | ✅ | `selMayorPeriodo` |
| Columna Glosa en tabla | ❌ | `recopilarMovimientosPorCuenta()` la tiene pero mayor.js no la muestra |
| Columna N° en tabla | ❌ | Misma situación |
| Saldo acumulado | ❌ | No calculado |
| **El archivo está truncado** | ❌ | Solo tiene toolbar + inicio del forEach, sin cierre |

> **Bug nuevo:** `mayor.js` está incompleto — la función `generarLibroMayor()` termina en el interior del `forEach` sin construir la tabla HTML.

#### `balance.js` — ✅ Completo (156 líneas)
| Función | Estado | Notas |
|---------|--------|-------|
| Balance de comprobación | ✅ |
| Empty state | ✅ | "Sin movimientos registrados" |

#### `balance-clasificado.js` — ✅ Completo (212 líneas)

#### `dashboard.js` — ✅ Completo (254 líneas)
| Función | Estado | Notas |
|---------|--------|-------|
| `calcularKPIs()` | ✅ |
| Panel de onboarding | ✅ | `dash-onboarding` en HTML |

#### `estado-resultados.js` — ✅ Completo (133 líneas)

#### `exportar.js` — ✅ Completo (307 líneas)
| Función | Estado |
|---------|--------|
| PDF para todos los reportes | ✅ |
| Excel para todos los reportes | ✅ |

#### `flujo-caja.js` — ⚠️ Parcial (188 líneas)
| Función | Estado | Notas |
|---------|--------|-------|
| `generarFlujoCaja()` | ✅ |
| Overrides por categoría | ❌ | **S5 pendiente** |
| `core_fc_overrides` localStorage | ❌ | |

#### `ia.js` — ⚠️ Funcional solo en Electron (671 líneas)
| Función | Estado | Notas |
|---------|--------|-------|
| Análisis IA de reportes | ✅ Electron | Falla silenciosamente en web |
| `iaAnalizarBalance()` etc. | ✅ Electron | |
| Proxy web | ❌ | No implementado |

#### `indicadores.js` — ✅ Completo (969 líneas)
| Función | Estado |
|---------|--------|
| UF, UTM, IPC en tiempo real | ✅ |
| Tasas Previred | ✅ |

#### `iva-resumen.js` — ✅ Completo (252 líneas)
| Función | Estado | Notas |
|---------|--------|-------|
| `generarIvaResumen()` | ✅ |
| Distinción nota_credito | ✅ | NC restan débito/crédito fiscal |
| Detalle NC en UI | ✅ | Muestra ajuste por NC |

#### `reconciliacion.js` — ⚠️ Parcial (740 líneas)
| Función | Estado | Notas |
|---------|--------|-------|
| Carga de extracto bancario | ✅ |
| Auto-match asientos | ✅ |
| Ligar/desligar movimientos | ✅ |
| Selector de cuenta bancaria | ✅ | `cuentaBanco` en `_recState` |
| Multi-cuenta (múltiples bancos) | ⚠️ | Un selector existe, pero no persiste en `core_recon_cuenta_activa` |

#### `sii-rcv.js` — ⚠️ Parcial (412 líneas)
| Función | Estado | Notas |
|---------|--------|-------|
| Descarga RCV via proxy | ✅ | Funciona con proxy configurado |
| `consultarSII()` web | ⚠️ | Muestra guía de proxy pero usa `alert()` (línea 385) |
| Sin CORS en web directo | ✅ documentado | |

#### `auth-manager.js` — ✅ Completo (529 líneas)
#### `firebase-service.js` — ✅ Completo (849 líneas)
#### `permisos.js` — ✅ Completo (85 líneas)
#### `audit.js` — ✅ Funcional (91 líneas)

---

## CSS — Estado actual

| Archivo | Líneas | Estado |
|---------|--------|--------|
| `variables.css` | 115 | ✅ **Paleta D-8 aplicada** — navy+magenta |
| `main.css` | — | ✅ Usa variables automáticamente |
| `auditor.css` | — | ✅ Estilos específicos del auditor |
| `remuneraciones.css` | — | ✅ Estilos del módulo |

### Tokens de color actuales (post D-8)
```
Modo claro:  --accent: #AC406D (magenta) | --bg: #E8ECF0 | --text: #0A1922
Modo oscuro: --accent: #F95A8A (rosa)    | --bg: #121F30 | --text: #CAD8E2
```

---

## HTML — Vistas registradas en index.html

| Vista | ID en HTML | ¿Tiene contenido? | ¿Sidebar link? |
|-------|-----------|-------------------|---------------|
| Dashboard | `view-inicio` | ✅ | ✅ |
| Diario | `view-diario` | ✅ | ✅ |
| Libro Mayor | `view-mayor` | ✅ | ✅ |
| Conciliación | `view-reconciliacion` | ✅ | ✅ |
| Balance Comprobación | `view-balance` | ✅ | ✅ |
| Compras | `view-compras` | ✅ | ✅ |
| Ventas | `view-ventas` | ✅ | ✅ |
| Plan de Cuentas | `view-plan-cuentas` | ✅ | ✅ |
| Documentos | `view-documentos` | ✅ | ✅ |
| Productos | `view-productos` | ⬜ renderizado por JS | ✅ |
| Activos | `view-activos` | ⬜ renderizado por JS | ✅ |
| Cartolas | `view-cartolas` | ⬜ renderizado por JS | ✅ |
| Clientes | `view-clientes` | ✅ | ✅ |
| **Hallazgos** | `view-hallazgos` | ⬜ vacío | ✅ |
| **Informe** | `view-informe` | ⬜ vacío | ❌ SIN LINK |
| Configuración | `view-configuracion` | ✅ | ✅ |
| Flujo de Caja | `view-flujo-caja` | ✅ | ✅ |
| Balance Clasificado | `view-balance-clasificado` | ✅ | ✅ |
| Estado de Resultados | `view-estado-resultados` | ✅ | ✅ |
| Indicadores | `view-indicadores` | ✅ | ✅ |
| IVA Resumen / F29 | `view-iva-resumen` | ✅ | ✅ |
| Remuneraciones | `view-remuneraciones` | ⬜ renderizado por JS | ✅ |
| Honorarios | `view-honorarios` | ✅ | ✅ |
| DJ 1879 | `view-dj1879` | ✅ con exportar PDF/Excel | ✅ |

> **BUG detectado:** `view-informe` existe pero NO hay enlace en el sidebar — la vista del Informe de Auditoría es inaccesible desde la UI.

---

## Deuda técnica — Estado real

| # | Deuda | Estado | Notas |
|---|-------|--------|-------|
| DT-1 | `confirm()` nativo (30+) | ⚠️ 29 restantes | `mostrarConfirm()` existe pero no se migró todo |
| DT-2 | `console.log` en producción | ✅ Resuelto | 0 instancias activas |
| DT-3 | IA solo en Electron | ⬜ Pendiente | Requiere proxy backend |
| DT-4 | localStorage → IndexedDB | ⬜ Pendiente | |
| DT-5 | Webhook de pago | ⬜ Pendiente | |

---

## Bugs vigentes

| # | Bug | Archivo | Línea | Estado |
|---|-----|---------|-------|--------|
| BUG-1 | Cartolas en blanco | `cartolas.js` | 686 | ✅ Corregido |
| BUG-2 | `mayor.js` truncado sin tabla | `mayor.js` | 45+ | ❌ Activo — función incompleta |
| BUG-3 | `audAbrirCrearHallazgo()` llamada sin existir | `index.html` | 469,603,701 | ❌ Activo — error JS |
| BUG-4 | `view-informe` sin link en sidebar | `index.html` | — | ❌ Activo — vista inaccesible |
| BUG-5 | `siiMostrarGuiaProxy()` usa `alert()` | `sii-rcv.js` | 385 | ❌ Activo |

---

## Sprints — Estado real verificado

| Sprint | Descripción | Estado real | % |
|--------|-------------|-------------|---|
| S1 | hallazgos.js + informe-auditoria.js | ❌ Pendiente | 40% |
| S2 | UX alerts + Mayor glosa | ❌ Casi completo | 90% |
| S3 | Módulos: docs, cartolas | ✅ Completo | 100% |
| S4 | Reportes: balance, NC, DJ1879, activos | ✅ Completo | 100% |
| S5 | Integraciones: autocomplete, FC, logger, SII | ❌ Pendiente | 55% |

---

## Tareas mínimas restantes para cerrar sprints

### Para cerrar S1 (alta prioridad)
1. Implementar 5 funciones en `hallazgos.js`
2. Implementar 4 funciones en `informe-auditoria.js`
3. Agregar link al sidebar para `view-informe`

### Para cerrar S2 (1 ítem)
1. Completar `mayor.js` — el forEach está incompleto, agregar columnas N°, Glosa, Debe, Haber, Saldo

### Para cerrar S5 (5 ítems)
1. Autocomplete producto → compra/venta
2. Persistir `core_recon_cuenta_activa` en reconciliación
3. Sistema `core_fc_overrides` en flujo-caja.js
4. Logger condicional en helpers.js
5. Reemplazar `alert()` en sii-rcv.js línea 385

---

## Diseño UI — Estado

| # | Ítem | Estado |
|---|------|--------|
| D-1 | Hover en tablas | ⬜ Sin verificar en browser |
| D-2 | Jerarquía botones | ⬜ Sin verificar en browser |
| D-3 | Sombra paneles laterales | ⬜ Sin verificar en browser |
| D-4 | Empty states consistentes | ✅ Aplicado en balance y dashboard |
| D-5 | Toasts por tipo | ✅ `mostrarToast()` con tipos |
| D-6 | Font-size sidebar mínimo 11px | ⬜ Sin verificar |
| D-7 | KPI label arriba del número | ⬜ Sin verificar |
| D-8 | Paleta navy+magenta | ✅ Aplicada en `variables.css` |
