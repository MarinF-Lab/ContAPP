# Arquitectura de Módulos — ContApp Auditor
**Versión:** 2.0 — Rediseño post-QA  
**Fecha:** 2026-06-26  
**Estado:** Aprobada por usuario ✅

---

## Contexto

ContApp Auditor tenía 35 vistas independientes en el sidebar. El resultado era un sidebar sobrecargado poco profesional comparado con referencias del mercado chileno (Chipax). Este documento define la nueva arquitectura: 6 grupos funcionales con módulos internos con pestañas, sin pérdida de funcionalidad.

---

## PRIMERA CATEGORÍA

### Inicio
- Dashboard con KPIs del cliente activo
- **Widget de indicadores económicos** (UF, UTM, tipo de cambio, tasas) — embebido aquí, NO como módulo separado del sidebar

---

### Grupo 1: Contabilidad

| # | Módulo | Pestañas / Contenido | Vistas actuales que absorbe |
|---|--------|---------------------|-----------------------------|
| 1 | **Estructura Contable** | Libro Diario · Libro Mayor · Balance General | `view-diario`, `view-mayor`, `view-balance` |
| 2 | **Reportes Financieros** | Balance Clasificado · Estado de Resultados · Flujo de Caja | `view-balance-clasificado`, `view-estado-resultados`, `view-flujo-caja` |

---

### Grupo 2: Comercial

| # | Módulo | Pestañas / Contenido | Vistas actuales que absorbe |
|---|--------|---------------------|-----------------------------|
| 1 | **Egresos e Ingresos** | Libro de Compras · Libro de Ventas · Boletas de Honorarios | `view-compras`, `view-ventas`, `view-honorarios` (boletas) |
| 2 | **Tributario** | Declaración de Impuestos (F29 + IVA Resumen) | `view-iva-resumen`, lógica F29 de primera categoría |

---

### Grupo 3: Datos

| # | Módulo | Pestañas / Contenido | Vistas actuales que absorbe |
|---|--------|---------------------|-----------------------------|
| 1 | **Documentación** | Facturas · Boletas · Boletas de Honorarios · Contratos | `view-documentos` (actualmente vacío — construir) |
| 2 | **Conciliación y Cartolas** | Cartolas bancarias · Conciliación bancaria | `view-cartolas`, `view-reconciliacion` |
| 3 | **Clientes y Proveedores** | Registro y gestión | `view-clientes` |

---

### Grupo 4: RRHH

| # | Módulo | Pestañas / Contenido | Vistas actuales que absorbe |
|---|--------|---------------------|-----------------------------|
| 1 | **Remuneraciones** | Liquidaciones · Indicadores previsionales · Tasas (AFP, salud, etc.) | `view-remuneraciones` + contenido de `view-indicadores` (solo tasas laborales) |

> Los indicadores económicos y tributarios (UF, UTM, tipo de cambio) se muestran en el Inicio, no aquí.

---

### Grupo 5: Empresa

| # | Módulo | Pestañas / Contenido | Vistas actuales que absorbe |
|---|--------|---------------------|-----------------------------|
| 1 | **Activos y Producción** | Activos fijos · Activos totales · Gestión de costos y producción | `view-activos`, `view-productos` |
| 2 | **Auditoría** | Informes · Hallazgos · Opiniones | `view-informe`, `view-hallazgos` |

---

### Configuración
Sin cambios estructurales. `view-configuracion` como está.

---

## SEGUNDA CATEGORÍA

### Inicio
- Dashboard con KPIs del cliente activo
- Widget de indicadores económicos (igual que Primera Categoría)

---

### Grupo 1: Contabilidad

| # | Módulo | Contenido | Vistas actuales que absorbe |
|---|--------|----------|-----------------------------|
| 1 | **Libro de Honorarios** | Registro de emitidos/recibidos | `view-libro-honorarios` |
| 2 | **Libro de Ingresos** | Detalle ingresos | `view-libro-ingresos-hon` |
| 3 | **Libro de Egresos** | Detalle egresos | `view-libro-egresos-hon` |


---

### Grupo 2: Datos

| # | Módulo | Contenido | Vistas actuales que absorbe |
|---|--------|----------|-----------------------------|
| 1 | **Documentación** | Facturas · Boletas de Honorarios | `view-documentos` (adaptar) |
| 2 | **Conciliación y Cartolas** | Cartolas · Conciliación | `view-cartolas`, `view-reconciliacion` |
| 3 | **Clientes y Proveedores** | Registro y gestión | `view-clientes` |

---

### Grupo 3: Tributario

| # | Módulo | Contenido | Vistas actuales que absorbe |
|---|--------|----------|-----------------------------|
| 1 | **Declaración de Impuestos** | F29 · F22 | `view-f29-hon`, `view-f22-hon` |

---

### Grupo 4: Empresa

| # | Módulo | Contenido | Vistas actuales que absorbe |
|---|--------|----------|-----------------------------|
| 1 | **Auditoría** | Informes · Hallazgos · Opiniones | `view-informe`, `view-hallazgos` |

---

### Configuración
Sin cambios estructurales.

---

## Módulos eliminados como vistas independientes

| Vista eliminada | Motivo | Destino |
|----------------|--------|---------|
| `view-indicadores` | No aporta valor como módulo standalone | Widget en Inicio |
| `view-indicadores-hon` | Duplicado de indicadores para 2ª cat. | Widget en Inicio |
| `view-iva-resumen` | Complementario a compras/ventas | Fusionado en Comercial > Tributario |
| `view-productos` (vacío) | Sin contenido real | Pestaña en Empresa > Activos y Producción |
| `view-documentos` (vacío) | Sin contenido real | Construir desde cero en Datos > Documentación |

---

## Componentes técnicos nuevos requeridos

### 1. Sistema de pestañas `.module-tabs`
No existe en el codebase actual. Requiere:
- `css/main.css` → agregar `.module-tabs`, `.tab-btn`, `.tab-panel`, estados activo/hover
- `js/services/app.js` → función `navTab(moduloId, tabId)` + integración con `navegar()`
- `index.html` → reestructurar vistas con estructura de tabs

### 2. Widget de indicadores en Inicio
- Mover lógica de `js/services/indicadores.js` a un widget embebible
- Mostrar en `view-inicio` como tarjeta colapsable

### 3. Sidebar restructurado
- Primera Cat: 6 ítems de primer nivel (Inicio, 5 grupos, Configuración)
- Segunda Cat: 6 ítems de primer nivel (Inicio, 4 grupos, Configuración)
- Los `nav-group` existentes sirven de base — solo reorganizar

---

## Archivos principales a modificar

| Archivo | Cambio |
|---------|--------|
| `index.html` | Sidebar + todas las vistas con tabs. Mayor cambio del proyecto. |
| `css/main.css` | Componente `.module-tabs` nuevo |
| `js/services/app.js` | `navTab()` + actualizar `navegar()` para tabs |
| `js/services/indicadores.js` | Convertir en widget, no vista |

---

## Criterios de aceptación

1. Primera Categoría: sidebar tiene exactamente 7 ítems (Inicio + 5 grupos + Configuración)
2. Segunda Categoría: sidebar tiene exactamente 6 ítems (Inicio + 4 grupos + Configuración)
3. Sistema de pestañas funciona sin recarga de página
4. Ninguna funcionalidad existente se pierde — solo se reubica
5. Indicadores económicos visibles en Inicio, no en sidebar
6. Activación/desactivación de módulos por cliente sigue funcionando
7. 0 errores JS en consola tras migración
8. Responsive: sidebar colapsable en móvil sin cambios

---

## Fuera de scope de este sprint

- Rediseño visual interno de las vistas (colores, tablas, formularios)
- Integración IA / Gemini
- Módulos SII
- F29/F22 de Segunda Categoría (definir en sprint posterior)
- Módulo "Documentación" — construir contenido real (scope separado)
- Módulo "Activos y Producción" — construir contenido de Producción (scope separado)
