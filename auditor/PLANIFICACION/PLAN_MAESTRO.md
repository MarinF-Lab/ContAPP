# ContApp Auditor — Plan Maestro
> Versión: 1.0 | Fecha: 2026-06-25 | Alcance: desde estado actual hasta producto completo
> **Regla de oro:** no agregar features nuevas hasta que el sprint en curso esté al 100%.

---

## Estado actual en una frase

El software tiene 19 módulos con lógica funcional real, pero 2 están completamente vacíos (los que definen el diferencial de auditoría), al menos 12 tienen brechas visibles, y el modelo de pago no está conectado. Hay que terminar lo que hay antes de crecer.

---

## Archivos nuevos

- [`BUGS_CRITICOS.md`](./BUGS_CRITICOS.md) — bugs que rompen funcionalidad existente (resolver primero)
- [`DISEÑO_UI.md`](./DISEÑO_UI.md) — guía visual y checklist de revisión por sprint

---

## Mapa de trabajo

```
✅ DONE         → Sprints 1-5: Core contable completo
✅ DONE         → Fase 2: Panel del estudio contable
─────────────────────────────────────────────────
AHORA           → Sprint IA: Integración Gemini (limpieza + rebuild)
─────────────────────────────────────────────────
DESPUÉS         → Fase 3: Automatización tributaria SII (requiere confirmación explícita)
                → Fase 4: Colaboración y escala
                → Fase 5: IA avanzada (predicción, benchmarking)
```

---

## Resumen de sprints (corto plazo)

| Sprint | Foco | Archivos clave | Estimado |
|--------|------|---------------|----------|
| S1 | Implementar hallazgos e informe de auditoría | `hallazgos.js`, `informe-auditoria.js` | 1 sesión |
| S2 | Limpiar UX: alerts, Mayor con glosa | `diario.js`, `mayor.js`, `plan-cuentas.js` | 1 sesión |
| S3 | Módulos incompletos: editar docs, cartolas, remuneraciones | `documentos.js`, `cartolas.js`, `remuneraciones.js` | 1 sesión |
| S4 | Reportes: vacíos, NC automáticas, exportación DJ1879 | `balance.js`, `dashboard.js`, `iva-resumen.js`, `segunda-categoria.js` | 1 sesión |
| S5 | Integraciones: productos↔compras/ventas, multi-cuenta, FC | `productos.js`, `reconciliacion.js`, `flujo-caja.js`, `activos.js` | 1 sesión |

---

## Resumen de fases (largo plazo)

| Fase | Foco | Complejidad | Prerrequisito |
|------|------|-------------|---------------|
| F2 | Panel del estudio contable (Kanban, calendario, time tracking) | Alta | Sprints 1-5 terminados |
| F3 | Automatización tributaria SII (RCV, DTE, F29 auto) | Muy alta | Fase 2 + equipo backend |
| F4 | Colaboración y escala (notificaciones, móvil, API) | Alta | Fase 3 |
| F5 | Inteligencia financiera (predicción, benchmarking) | Alta | Fase 4 |

---

## Deuda técnica horizontal (aplica a todos los sprints)

Estos problemas no son de un módulo específico, son del sistema completo. Se deben ir resolviendo en paralelo con los sprints:

1. **confirm() nativo del browser** — hay 30+ llamadas a `confirm()` en todo el codebase. Igual de feo que `alert()`, bloquea el hilo. Reemplazar por un modal de confirmación propio reutilizable (`mostrarConfirm(mensaje, callback)`).

2. **console.log en producción** — 14 instancias activas. Reemplazar por un logger condicional: `const log = (...a) => DEBUG && console.log(...a)`.

3. **IA mezclada (RESUELTO en Sprint IA)** — `ia.js` (Claude/Electron) e `ia-gemini.js` (Gemini) en conflicto. Sprint IA los reemplaza por un único archivo limpio con Gemini gratuito.

4. **localStorage como almacenamiento primario** — funciona bien para pocos datos, pero con clientes con 1-2 años de movimientos puede saturarse (~5MB por origen). La migración a IndexedDB está pendiente y es necesaria antes de escalar.

5. **Modelo de pago no conectado** — `auth-manager.js` crea perfiles con `estado: 'pendiente_pago'`, pero `licencia.js` los trata como activos. Conectar webhook de pago (Stripe/Transbank) es necesario antes de monetizar.

---

## Lo que se conserva sin tocar

Los siguientes módulos están production-ready y no necesitan intervención en ningún sprint:

- Libro de Compras y Ventas (CRUD + centralización)
- Clientes / Proveedores (CRM completo)
- Dashboard (KPIs + gráficos)
- Balance de Comprobación y Balance Clasificado
- Estado de Resultados
- Autenticación y roles
- Multi-empresa y sync Firebase
- Exportación PDF/Excel
- Búsqueda global Ctrl+K
- PWA (manifest + service worker)
- Indicadores económicos (UF, UTM, Previred)
- Multi-cliente (`multi-cliente.js`, `licencia.js`)

---

## Archivos de referencia

- [`SPRINT_IA_GEMINI.md`](./SPRINT_IA_GEMINI.md) — integración Gemini: limpieza + rebuild + integraciones (ACTIVO)
- [`SPRINT_1_CRITICO.md`](./SPRINT_1_CRITICO.md) — hallazgos + informe de auditoría
- [`SPRINT_2_UX.md`](./SPRINT_2_UX.md) — alerts, mayor, plan de cuentas
- [`SPRINT_3_MODULOS.md`](./SPRINT_3_MODULOS.md) — documentos, cartolas, remuneraciones
- [`SPRINT_4_REPORTES.md`](./SPRINT_4_REPORTES.md) — balance vacío, NC, DJ1879, activos
- [`SPRINT_5_INTEGRACIONES.md`](./SPRINT_5_INTEGRACIONES.md) — productos, reconciliación, flujo caja
- [`FASES_2_5.md`](./FASES_2_5.md) — roadmap largo plazo
- [`ANALISIS_MERCADO.md`](./ANALISIS_MERCADO.md) — brechas vs competencia, fortalezas reales
