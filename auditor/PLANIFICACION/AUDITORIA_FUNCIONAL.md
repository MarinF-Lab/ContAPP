# Auditoría Funcional — ContApp Auditor (2026-07-24)

> Pedido explícito del usuario: "examen funcional e integral de todo el programa" — encontrar
> apartados visuales sin funciones definidas o mal ejecutadas, y corregirlos. A diferencia de
> `INTEGRACION_DISENO.md` (que documenta la migración visual al prototipo `new desing.html`), este
> documento cubre **bugs funcionales reales** encontrados en el código ya existente, sin relación
> con el diseño.

## Metodología

Se lanzaron 3 sub-agentes de solo lectura en paralelo:
1. Inventario completo de los 258 `onclick=`/`onchange=`/`oninput=` en `index.html`, cruzados
   contra las funciones realmente definidas en `js/**/*.js`.
2. Búsqueda de implementaciones stub/placeholder, TODOs, y colisiones de nombres de función en
   todo el árbol `js/`.
3. Auditoría módulo por módulo (Activos, Conciliación+Cartolas, Remuneraciones, Segunda Categoría,
   Auditoría, Clientes/Productos) leyendo cada vista junto a su JS y probando el flujo completo.

Cada hallazgo se verificó leyendo el código real (no se confió ciegamente en el resumen del
agente) antes de corregir, y cada corrección se probó en browser inyectando datos de prueba en
memoria (nunca se tocaron datos reales del usuario).

---

## Hallazgos corregidos

### 1. Función de IA completamente muerta (12 funciones, 13 botones)

**Causa**: `js/services/ia.js` en Auditor tenía 213 líneas; la misma app en los proyectos hermanos
(`pymes/`, `public/`, `empresa/`, `educa/`) tiene 671 — nunca se portaron ~450 líneas. Afectaba:
"Analizar con IA" (Balance General, Balance Clasificado, Estado de Resultados, Flujo de Caja),
"Comparar períodos", el modal de alerta de asiento duplicado/monto inusual, y el chat flotante de
IA completo (botón "✨" siempre visible).

**Corrección**: se **adaptaron** (no copiaron literalmente) las funciones faltantes al backend
real de Auditor — Gemini vía REST directo desde el navegador (`_iaConsultar(prompt, maxTokens)`,
un solo string de entrada/salida) — a diferencia de la app hermana, que usa Claude vía IPC de
Electron con un formato de mensajes estructurado. Se reescribió cada función para ese formato:

- `iaAnalizarBalance/BalanceClasificado/EstadoResultados/FlujoCaja` + `iaAnalizarReporte()`: en vez
  de reconstruir la tabla como JSON (frágil, depende de la estructura HTML interna exacta de cada
  reporte), se usa `_iaContenedorATexto(selector)` — toma el texto visible tal como lo ve el
  usuario (`innerText`). Más simple y robusto: funciona igual sin importar si el reporte usa
  `<table>`, tarjetas de KPI, o ambos.
- `iaCompararPeriodos()`: misma lógica de agregación por cuenta que la app hermana, adaptada a
  `dbAsientos` real de Auditor y al call de Gemini de un solo string.
- `iaAbrirChat/iaCerrarChat/iaEnviarChat/iaChatKeydown/iaLimpiarChat`: chat conversacional real,
  con contexto de datos reales del sistema (empresa, compras/ventas del mes, UF/UTM) enviado en
  cada mensaje.
- `iaConfirmarAlerta/iaCancelarAlerta/_iaModalAlerta` + `iaVerificarAsiento/iaCheckAntesDeGuardar`:
  quedan disponibles y funcionales, pero **deliberadamente no conectadas** al guardado real de
  asientos en `diario.js` — activarlas ahí agregaría una consulta a Gemini (latencia + costo de
  API) antes de cada guardado, hoy instantáneo. Es una decisión de producto, no parte de este
  arreglo.

Archivos: `js/services/ia.js` (+~280 líneas), `index.html` (texto "Analizando con Claude…" → "con
Gemini…", coherente con el backend real).

### 2. Colisión de `fmtRut()` rompía el auto-formato de RUT en Remuneraciones

`app.js` y `remuneraciones.js` definían cada uno su propia función global `fmtRut()` con firmas
incompatibles (una espera un elemento DOM, la otra un string) — como todo corre en el mismo scope
global sin módulos, la de `app.js` (se carga después) pisaba a la de `remuneraciones.js`. Cada
tecla en el campo RUT del formulario "agregar trabajador" tiraba `TypeError`.

**Corrección**: renombrada la función interna de `remuneraciones.js` a `_remFmtRutStr()`. Probado
en browser: ya no tira error y formatea correctamente (`12345678` → `1.234.567-8`).

### 3. "Generar asiento dep." en Activos Fijos guardaba el dato pero tiraba error después

Llamaba a `_renderTablaActivos()`, que no existe — el nombre real es `_activoActualizarTabla()`.
El asiento se guardaba en `localStorage` pero el usuario nunca veía el toast de éxito ni la tabla
actualizada. De paso, se corrigió el formato de fecha del asiento generado (ISO `YYYY-MM-01` →
`DD/MM/AAAA`, igual que el resto de la app) y se le agregaron `numero`/`estado: 'ACTIVO'`, que
faltaban y hacían que el asiento apareciera incompleto en Dashboard/Flujo de Caja/Conciliación.

Probado en browser con un activo de prueba: genera el asiento sin error, con la forma correcta.

### 4. Cartolas Bancarias y Conciliación Bancaria no se comunicaban

Se presentan como dos pestañas de la misma vista (`view-conciliacion-cartolas`), pero cada una
guardaba su propio estado por separado (`core_cartola_movs` vs `core_reconciliacion`) sin
comunicarse. Un usuario que importaba un extracto en Cartolas tenía que volver a subir el mismo
archivo en Conciliación para conciliarlo.

**Corrección**: se agregó un puente en `reconciliacion.js` (`recImportarDesdeCartolas()` +
`_recMovsCartolaDelPeriodo()`) que lee directo de `core_cartola_movs`, filtra por el
período/cuenta seleccionados en Conciliación, convierte la fecha (Cartolas usa ISO, Conciliación
usa DD/MM/AAAA) y puebla `_recState.transacciones` — sin tener que volver a subir el archivo. Se
mantiene también la carga directa de archivo en Conciliación (por si el usuario quiere conciliar
sin pasar por Cartolas primero). Aparece como una tarjeta "¿Ya importaste este extracto en
Cartolas Bancarias?" en la zona de importación, con el conteo real de movimientos disponibles.

Además, `cartolasGenerarAsientos()` generaba asientos con una forma de datos distinta al resto de
la app (`{debe, haber, monto}` planos en vez de `{movimientos:[...]}`) — el Libro Diario no tiene
protección contra eso y tiraba `TypeError` apenas aparecía el primer asiento de cartola,
rompiendo la vista para el resto de la sesión. Corregido a la forma estándar, con `numero`/
`estado`/fecha `DD/MM/AAAA` igual que los demás. Este fix también hace que los asientos generados
desde Cartolas ahora sean detectables por Conciliación en su columna "Libro Diario" (antes ni
siquiera calificaban por la forma incorrecta).

Probado en browser end-to-end: importar → clasificar → generar asiento (sin romper Diario) → traer
esos movimientos a Conciliación con el botón nuevo → `renderReconciliacion()` sin error.

### 5. "Generar con IA" en el Informe de Auditoría siempre veía cero hallazgos

`audInfGenerarConIA()` llamaba a `audHallazgosObtener()` — nombre que no existe; la función real es
`audHallazgosExportar()`. Como el chequeo era `typeof ... === 'function'`, fallaba en silencio y
caía siempre al texto genérico de relleno, sin importar cuántos hallazgos reales existieran para
ese cliente/período. Corregido a la referencia correcta.

### 6. Finiquito pagaba dos veces el mismo concepto (confirmado por el usuario como error)

`remCalcularFiniquito()` sumaba `vacProporcional` (días acumulados desde el ingreso hasta hoy,
menos los tomados — cubre todo el período trabajado, incluyendo el año en curso) y `feriadoProp`
(meses trabajados en el año en curso × cuota mensual) como si fueran conceptos distintos. En la ley
laboral chilena el feriado proporcional **es** el pago de la vacación no usada al término — no hay
un concepto adicional que sumar. Como `vacProporcional` ya incluye los meses del año en curso,
sumar `feriadoProp` pagaba ese mismo período dos veces, inflando el monto real a pagar y el asiento
contable.

**Corrección**: se eliminó `feriadoProp`/`diasFeriado` del cálculo, del desglose visual, de la
impresión del finiquito y del asiento contable — queda un solo monto ("Vacaciones / feriado
proporcional"). De paso se limpió código muerto en `remFiqAsiento` (`* 0` que no hacía nada).

### 7. Helper `_esc()` inconsistente entre 4 archivos — riesgo de corromper formularios

`activos.js`/`productos.js` escapan comillas dobles en su `_esc()`; `hallazgos.js`/
`informe-auditoria.js` usaban una variante (truco de `textContent`→`innerHTML`) que no las
escapaba, y por orden de carga esta última ganaba globalmente. Si un nombre de activo/producto
tenía una comilla, podía romper el atributo `value="..."` del formulario generado. Unificadas las
4 copias a la versión que sí escapa comillas.

---

## Housekeeping de caché (recurrente en esta sesión)

Varios de los archivos corregidos (`remuneraciones.js`, `activos.js`, `hallazgos.js`,
`informe-auditoria.js`) nunca habían tenido sufijo de versión (`?v=N`) en su `<script src>`,
pese a haberse editado repetidamente durante la sesión — el navegador servía versiones viejas en
caché sin que el contenido en disco reflejara el cambio. Se les agregó `?v=2` a los 4, mismo
patrón que ya usan `main.css?v=5`, `dashboard.js?v=4`, etc. **Cualquier archivo con sufijo de
versión que se edite en el futuro debe subir el número, o el cambio no se verá en el navegador.**

---

## Deliberadamente fuera de esta ronda (decisiones del usuario)

- **Paywall/licencia sin aplicar** (`audLicenciaActiva()` definida pero nunca llamada — cualquier
  usuario registrado tiene acceso completo sin importar el estado de pago). El usuario decidió
  explícitamente no activarlo en esta ronda por ser una decisión de producto con consecuencias
  reales (podría bloquear el propio uso de prueba o a clientes reales sin webhook de pago
  funcionando).

## Hallazgos de menor prioridad, no corregidos (informativo)

- **Panel de notificaciones decorativo** — ya documentado en `INTEGRACION_DISENO.md`, es diseño
  intencional del prototipo, no un bug.
- **Descarga automática SII RCV requiere proxy externo** — no es un bug, es una limitación real
  (el SII no tiene CORS) que ya está comunicada en el código con un mensaje de error claro.
- **`iva-resumen.js`**: el reajuste UTM cae a $0 silenciosamente si no hay UTM histórica en caché,
  con un mensaje explicativo — bajo impacto, no se tocó.
- **`segunda.js`/`primera.js`**: catálogos de módulos compartidos duplicados sin referencia
  cruzada — riesgo de deriva a futuro, no un bug hoy.

---

## Verificación

`node PLANIFICACION/verificar.js` → 26/26 ✅ tras todos los cambios.

Probado en browser (modo offline, datos de prueba sembrados en memoria — nunca se tocaron datos
reales del usuario, todo limpiado después de cada prueba): RUT sin error en Remuneraciones,
asiento de depreciación con forma correcta en Activos, flujo completo de Cartolas→asiento→
Conciliación sin romper el Diario, los 4 botones "Analizar con IA" + comparación de períodos +
chat completo sin lanzar errores (fallan con gracia por falta de API key, como corresponde),
Informe de Auditoría con la referencia correcta. Sin errores de consola en ningún flujo probado.

Sin commitear — pendiente de revisión del usuario.
