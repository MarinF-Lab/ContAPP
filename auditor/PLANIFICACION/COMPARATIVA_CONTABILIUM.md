# Comparativa — ContApp Auditor vs Contabilium

> Fecha: 2026-07-26 | Fuente: `Mapa_Interactivo_Contabilium.html` (mapa de funciones exportado
> desde una prueba gratuita real de Contabilium, cuenta Isaac Marin #100977, plan Prueba).
> Complementa (no reemplaza) `ANALISIS_MERCADO.md` — ese doc compara contra Defontana/SoftwareUno/
> ContaCloud y tiene ~1 mes, algunas de sus afirmaciones ya quedaron desactualizadas por la
> auditoría funcional del 2026-07-24/25 (ver nota al final).

---

## Resumen ejecutivo

Contabilium y Auditor **no son el mismo tipo de producto**, aunque compiten por el mismo
comprador (contador/dueño de pyme chilena). Contabilium es un **ERP comercial que emite
documentos** (factura electrónica con folios SII propios, POS, e-commerce). Auditor es una
**herramienta de registro, cierre contable y auditoría** para contadores que llevan la
contabilidad de terceros — no emite documentos, los registra y audita.

La brecha más grande de Contabilium en su propio mapa (Contabilidad completa: libro diario,
mayor, balance, asientos manuales) está **bloqueada en su plan gratis** ("BLOQUEADO en Plan
Prueba — requiere Plan Full o superior") — es exactamente el terreno donde Auditor ya es fuerte
hoy, gratis.

---

## Dónde Auditor gana — revisado con más rigor (2026-07-26, segunda pasada)

La primera versión de esta tabla marcaba features como "✅ gana Auditor" solo por confirmar que
el archivo existe y está enganchado a un botón. Eso no es lo mismo que "funciona bien" o "hace lo
que promete". Segunda pasada, verificando profundidad real de cada una:

| Feature | Estado real verificado | Contabilium |
|---|---|---|
| Contabilidad completa (diario/mayor/balance/EERR) | ✅ Real y gratis — es la ventaja más sólida y menos discutible | 🔒 bloqueado, plan pago |
| Remuneraciones (finiquitos, Previred, indicadores) | ✅ Código extenso y conectado. Sin verificar: exactitud de las fórmulas tributarias (F29/F22/DJ1879 en Segunda Categoría) contra normativa SII real | ❌ sin módulo de RRHH/nómina |
| Panel de estudio (multi-cliente, kanban, calendario) | ✅ Real y enganchado (`firebase-service.js` lo inicializa al cargar clientes) | ❌ mono-empresa |
| Activos Fijos con "depreciación automática" | ⚠️ **Corregido**: no es automática. La vida útil se tipea a mano, sin tabla oficial SII por categoría de bien — es una calculadora, no un motor normativo | ❌ no aparece en el mapa |
| "Multi-cliente" como diferencial | ⚠️ **Corregido**: `multi-cliente.js` es solo color/etiqueta + toggle de módulos visibles por cliente — configuración cosmética, no aislamiento de datos sofisticado | ❌ mono-empresa |
| Auditoría (hallazgos + informe con IA) | ⚠️ **Corregido, era el más sobrevalorado**: `audHallazgoCrear()` es 100% manual, no hay motor de detección automática de inconsistencias. El "informe con IA" solo redacta en prosa lo que ya se cargó a mano — con hallazgos vacíos, no dice nada real | ❌ no existe en el mapa |
| IA integrada (análisis de reportes + chat) | ⚠️ **Corregido**: el código funciona, pero (1) depende de una key de Gemini paga — la cuenta actual está en cuota 0, hoy no responde nada; (2) `iaCheckAntesDeGuardar`/`iaVerificarAsiento` existen pero deliberadamente no están conectadas al guardado real — no hay ninguna verificación automática hoy, todo es manual por botón | ❌ nada equivalente, pero Contabilium tampoco depende de terceros pagos para su funcionalidad base |
| Conciliación bancaria (Cartolas↔Conciliación) | ⚠️ Confirmado que corre sin errores; **no evaluado** si el auto-match realmente empareja bien movimientos reales fuera de los datos de prueba | ⚠️ Contabilium tampoco tiene conciliación automática vía API — ambos son manuales acá |

---

## Dónde Contabilium gana (gaps reales de Auditor)

| Feature | Contabilium | Auditor | Costo de cerrar el gap |
|---|---|---|---|
| Multi-bodega / depósitos, traslados, stock mínimo, kardex | ✅ módulo Inventarios completo | ❌ [`productos.js`](../js/modules/productos.js) no tiene concepto de bodega | Gratis — solo lógica/UI |
| Tesorería: cheques, arqueo de caja, multi-moneda | ✅ módulo Tesorería | ❌ Cartolas/Conciliación cubre solo bancos | Gratis — solo lógica/UI |
| Pipeline pre-venta: cotización → orden de venta → factura | ✅ | ❌ Auditor va directo al documento ya emitido | Gratis, pero cambia el flujo de Ventas |
| Órdenes de compra → comprobante | ✅ | ❌ | Gratis, cambia el flujo de Compras |
| Combos y variantes de producto (talla/color) | ✅ | ❌ no encontrado en `productos.js` | Gratis |
| 32 reportes de gestión (rentabilidad, comisiones, ranking, sucursal) | ✅ | Parcial — fuerte en tributario/contable, débil en comercial/gerencial | Gratis pero grande |
| Integraciones e-commerce (Mercado Libre, Shopify, etc.) | ✅ | ❌ no aplica al caso de uso | **Pago** (APIs de terceros) — fuera de alcance |
| Facturación electrónica con folios SII propios | ✅ | ❌ Auditor no emite, solo registra | **Pago** (certificación SII) — cambio de producto, no un fix |
| Descarga automática RCV desde el SII | ✅ | 🔜 [`sii-rcv.js`](../js/services/sii-rcv.js) existe pero requiere proxy (bloqueado por CORS del SII) | Requiere backend/proxy — ver `ANALISIS_MERCADO.md` |

---

## Recomendación (con la restricción actual: sin gastar en integraciones pagas)

De los gaps de arriba, los únicos que se resuelven **sin ningún costo externo** (pura lógica
JS, sin API de terceros ni certificación) y que además tienen sentido para el usuario real de
Auditor (contador/estudio, no un e-commerce) son:

1. **Bodegas / multi-depósito** en Productos y Activos.
2. **Cheques + arqueo de caja** dentro de Tesorería/Cartolas.

Quedan **fuera de alcance por ahora** (requieren dinero real o cambian el producto de raíz):
- Facturación electrónica con folios SII — Auditor dejaría de ser "registrador" para pasar a
  "emisor", es un cambio de modelo de negocio, no un fix.
- Integraciones e-commerce — no corresponde al público objetivo de Auditor (contadores/estudios,
  no tiendas online).
- Descarga automática del RCV del SII — técnicamente lista salvo por el proxy CORS, que si se
  monta gratis (ej. Cloudflare Worker free tier) sí sería viable sin costo. Evaluar aparte.

---

## Nota sobre `ANALISIS_MERCADO.md`

Ese documento (2026-06-25) marca como brechas activas dos cosas que **ya cambiaron** en la
auditoría funcional del 2026-07-24/25 y deberían leerse actualizadas:
- *"IA integrada ❌ Solo desktop"* → ya no es cierto. `ia.js` fue restaurado y funciona 100% en
  web/PWA vía Gemini (ver `AUDITORIA_FUNCIONAL.md`, hallazgo #1).
- *"Panel del estudio 🔜 Fase 2"* → ya existe y está implementado (`panel-estudio.js`).

El resto de ese análisis (DTE, integración SII real, riesgos de localStorage) sigue vigente.

---

## Conclusión honesta (tras la corrección del 2026-07-26)

La primera versión de este documento sobrevendía el estado de Auditor comparándolo por
existencia de archivos, no por profundidad real. Con más rigor, la ventaja competitiva sólida y
verificada de Auditor es en realidad **una sola cosa concreta**: contabilidad completa (diario,
mayor, balance, EERR) gratis, mientras Contabilium la bloquea en su plan pago. Remuneraciones y
Panel de Estudio también son reales. El resto de lo que se presentaba como diferencial —
auditoría con IA, depreciación "automática", multi-cliente como arquitectura— está sobrestimado
frente a lo que el código realmente hace hoy.

Esto cambia la pregunta de fondo: antes de sumar features nuevas para igualar a Contabilium
(bodegas, cheques), hay una decisión pendiente sobre si conviene primero **cerrar la brecha entre
lo que el producto promete y lo que realmente hace** en sus propios diferenciales (ej.: ¿vale la
pena construir un motor real de detección de hallazgos, o dejar claro en la UI que es un log
manual? ¿Se verifican las fórmulas de F29/F22 contra la normativa SII?).

## Pendiente / próximo paso

Sin código tocado todavía. Dos caminos posibles, sin decidir aún:
1. Sumar gaps gratuitos frente a Contabilium (bodegas o cheques/arqueo).
2. Primero verificar/reforzar lo que ya se vende como diferencial propio (fórmulas tributarias de
   Segunda Categoría, y si vale la pena que "Hallazgos" siga siendo puramente manual).
