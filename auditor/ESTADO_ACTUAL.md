# Análisis de estado — ContApp Auditor
> Revisión: 2026-06-24 | Objetivo: dejar al 100% lo existente antes de agregar más

---

## Resumen ejecutivo

El software tiene **19 módulos** implementados con lógica funcional real. Sin embargo, hay una brecha importante entre "el código existe" y "la feature está terminada al 100%". Este análisis identifica exactamente qué falta en cada módulo para considerarlo **production-ready**.

| Prioridad | Cantidad | Descripción |
|-----------|----------|-------------|
| 🔴 Crítico | 2 | Archivos vacíos con TODO — módulos que aparecen definidos pero no hacen nada |
| 🟠 Alto | 6 | Inconsistencias graves de UX o funcionalidad incompleta claramente visible |
| 🟡 Medio | 8 | Flujos incompletos o sin pulir que afectan la experiencia de uso |
| 🟢 Bajo | 5 | Detalles menores de calidad |

---

## 🔴 Crítico — Código vacío que debe implementarse

### 1. `js/auditor/hallazgos.js` — PLACEHOLDER VACÍO

El archivo existe y tiene comentarios detallados describiendo el esquema de datos, pero el cuerpo del módulo es literalmente `// Placeholder — implementación pendiente`. No hay ninguna función.

**Lo que falta:**
- `audHallazgoCrear(tipo, descripcion, modulo)` — agregar observación desde cualquier módulo
- `audHallazgosRender(clienteId, periodo)` — listar hallazgos filtrados
- `audHallazgoResolver(id)` — marcar como resuelto
- Botón "Agregar hallazgo" accesible desde vistas de Diario, Balance, Compras, Ventas

**Impacto:** Sin esto, la funcionalidad de auditoría que diferencia a ContApp de software genérico no existe en absoluto.

---

### 2. `js/auditor/informe-auditoria.js` — PLACEHOLDER VACÍO

Mismo caso. Archivo bien documentado en comentarios pero sin ninguna función implementada.

**Lo que falta:**
- Formulario: opinión del contador (texto libre), nombre, RUT, matrícula
- Vista previa del informe en pantalla
- Exportación PDF con membrete, logo, firma y lista de hallazgos
- Integración con `hallazgos.js` para incluir las observaciones del período

**Impacto:** El producto no puede generar el entregable formal al cliente, que es el producto final de un trabajo de auditoría/contabilidad.

---

## 🟠 Alto — UX rota o flujos incompletos visibles

### 3. `diario.js` — Usa `alert()` en lugar de `mostrarToast()`

El Libro Diario es el módulo más usado de la app. Tiene **8 llamadas a `alert()`** para validaciones:
- "Ingrese glosa válida comercial"
- "Monto comercial no detectado"
- "No se reconoció el tipo de operación contable..."
- "Debe generar un asiento primero"
- "Debe ingresar una fecha"
- (4 más en `guardarAsientoManual`)

Los `alert()` del navegador bloquean el hilo, son feos, no se pueden estilizar y rompen el flujo visual de la app. Todo lo demás usa `mostrarToast()`.

**Fix:** Reemplazar cada `alert()` por `mostrarToast(mensaje, 'error')`. El mensaje largo del tipo de operación no reconocida debe ir como un `<div>` de ayuda debajo del input, no como alert.

---

### 4. `mayor.js` — El libro mayor no muestra la glosa del asiento

El Libro Mayor es fundamental para auditoría. Actualmente cada fila del historial solo muestra `fecha | debe | haber`. Falta la **glosa** y el **número de asiento**, que son los datos que permiten entender cada movimiento.

```
// Código actual — inutilizable para auditoría
filas += `<tr>
    <td>${h.fecha}</td>
    <td class="monto">${fmt(h.debe)}</td>
    <td class="monto">${fmt(h.haber)}</td>
</tr>`;
```

**Fix:** Agregar `h.glosa`, `h.numero` y `h.contacto` al historial que retorna `recopilarMovimientosPorCuenta()` y mostrarlos en la tabla.

---

### 5. `plan-cuentas.js` — Usa `alert()` (4 instancias)

El plan de cuentas también usa `alert()` para errores de validación:
- "La cuenta ya existe"
- "No se puede eliminar: tiene movimientos"
- "Ingrese el nombre de la cuenta"
- "El código ya está asignado a..."

**Fix:** Reemplazar por `mostrarToast()`.

---

### 6. `documentos.js` — Sin función editar

Al igual que compras/ventas antes del fix de hoy, el módulo de Documentación solo tiene Crear y Anular. No hay `editarDocumento(id)`.

**Fix:** Mismo patrón que `editarCompra`/`editarVenta`: variable `_docEditandoId`, función `editarDocumento(id)`, botón en cada fila, y `guardarDocumento()` con lógica update/insert.

---

### 7. `remuneraciones.js` — `alert()` y `console.log` en producción

El módulo de remuneraciones tiene 7 instancias de `alert()` / `console.log` mezcladas, lo que es inconsistente con el resto del sistema.

**Fix:** Reemplazar `alert()` por `mostrarToast()` y eliminar los `console.log`.

---

### 8. `cartolas.js` — El panel de clasificación no persiste cambios correctamente

El flujo de importación → clasificación de movimientos está implementado, pero `_abrirPanelClasificacion` abre un panel que asigna una cuenta contrapartida. El problema es que si el usuario cierra la app antes de ejecutar `cartolasGenerarAsientos()`, los movimientos clasificados no se sincronizan a Firebase — solo se guardan en localStorage bajo `core_cartola_movs`.

**Fix:** Llamar `guardarCartolas()` (persistencia localStorage) al cerrar el panel de clasificación de cada movimiento individual, independientemente de si se generan asientos.

---

## 🟡 Medio — Flujos incompletos que afectan la experiencia

### 9. `balance.js` — Sin estado vacío

Cuando no hay asientos registrados, el balance simplemente muestra una tabla vacía sin mensaje. En todas las demás vistas hay un estado vacío con mensaje y CTA.

**Fix:** Detectar `dbAsientos.length === 0` y mostrar un estado vacío con texto "Sin movimientos registrados" y botón para ir al Diario.

### 10. `mayor.js` — Sin filtro por cuenta o período

El Libro Mayor muestra todas las cuentas de una vez. En un año con muchos movimientos, esto es ilegible. No hay forma de filtrar por cuenta específica o período.

**Fix:** Agregar un `<select>` para filtrar por cuenta y un selector de período (mes/año o rango de fechas).

### 11. `reconciliacion.js` — Sin manejo de múltiples cuentas bancarias

La conciliación solo soporta una cuenta banco llamada `"Banco"`. Una empresa con múltiples cuentas bancarias (cuenta corriente + cuenta RUT + cuenta de ahorro) no puede conciliar cada una por separado.

**Fix:** Agregar un selector de cuenta bancaria que filtre los asientos del diario por la cuenta seleccionada.

### 12. `segunda-categoria.js` — DJ 1879 sin exportación

El módulo de DJ 1879 muestra la declaración en pantalla pero no tiene botón de exportación a PDF ni a Excel.

**Fix:** Agregar botones de exportación usando las funciones ya existentes `exportarPDF()` y `exportarExcel()`.

### 13. `productos.js` — Sin vinculación con Compras/Ventas

El catálogo de productos existe y `prodAbrirSelector()` permite seleccionar un producto, pero no hay un flujo documentado ni integrado para autocompletar datos en el formulario de compras o ventas cuando se selecciona un producto.

**Fix:** Al seleccionar producto desde el formulario de compras/ventas, autocompletar nombre, RUT del proveedor habitual, y precio de costo/venta.

### 14. `activos.js` — Sin historial de depreciaciones generadas

El módulo genera asientos de depreciación mensual pero no muestra cuáles meses ya fueron procesados. Un contador podría generar la depreciación de diciembre dos veces sin saberlo.

**Fix:** Guardar en cada activo el array de `periodos_depreciados: ['2025-01', '2025-02', ...]` y verificar antes de generar que el período no esté ya procesado.

### 15. `flujo-caja.js` — Sin categorías personalizables

El flujo de caja clasifica movimientos en tres categorías (operacional, inversión, financiamiento) basado en reglas hardcodeadas. No hay forma de mover una cuenta de categoría si la clasificación automática es incorrecta.

**Fix:** Agregar un override por cuenta: tabla en localStorage `core_fc_overrides` con `{ cuenta: 'Publicidad', categoria: 'operacional' }`.

### 16. `iva-resumen.js` — No refleja las NC automáticamente

Las notas de crédito registradas en el libro de compras/ventas no se cruzan automáticamente con el F29. El contador debe ingresar manualmente los ajustes.

**Fix:** Al calcular el resumen F29, leer `dbCompras` y `dbVentas` del mes seleccionado y cruzar automáticamente las NC con el débito/crédito fiscal.

---

## 🟢 Bajo — Detalles de calidad

### 17. Libro Diario — El mensaje "tipo no reconocido" es un `alert()` de 14 líneas
El texto de ayuda es demasiado largo para un `alert()`. Debería ser un tooltip o acordeón debajo del input de glosa que muestre ejemplos sin bloquear la UI.

### 18. Dashboard — Sin estado vacío
Cuando no hay datos, el dashboard muestra KPIs en $0 y gráficos vacíos. Debería mostrar un estado onboarding con guías de "empieza aquí".

### 19. `console.log` en producción
Hay `console.log` en `remuneraciones.js` y `firebase-service.js`. Deben eliminarse o reemplazarse por un logger condicional `if (DEBUG)`.

### 20. `clientes.js` — `consultarSII()` sin implementación real
La función existe y tiene el botón en la UI, pero hace una búsqueda básica que no funciona de forma fiable sin CORS. Debería mostrar el estado real (no disponible en web, requiere proxy).

### 21. `sii-rcv.js` — Guía de proxy sin actualizar
La guía de configuración del proxy SII muestra instrucciones genéricas. En Chile los proxies para SII son específicos y cambian. Debería redirigir a documentación externa.

---

## Plan de acción recomendado

Orden sugerido para dejar el software al 100% antes de agregar más:

```
Sprint 1 — Crítico (estimado: 1 sesión)
  ✦ Implementar hallazgos.js (estructura de datos + CRUD básico)
  ✦ Implementar informe-auditoria.js (formulario + PDF)

Sprint 2 — Diario y Mayor (estimado: 1 sesión)
  ✦ Reemplazar todos los alert() del diario por mostrarToast()
  ✦ Agregar glosa + número al historial del Libro Mayor
  ✦ Agregar filtro por cuenta al Libro Mayor

Sprint 3 — Módulos incompletos (estimado: 1 sesión)
  ✦ editarDocumento() en documentos.js
  ✦ Limpiar alert() de plan-cuentas.js y remuneraciones.js
  ✦ Persistencia correcta en cartolas.js al clasificar

Sprint 4 — Reportes (estimado: 1 sesión)
  ✦ Estado vacío en balance.js y dashboard.js
  ✦ NC automáticas en iva-resumen.js
  ✦ Exportación DJ 1879 en segunda categoría
  ✦ Prevenir doble depreciación en activos.js

Sprint 5 — Integraciones internas (estimado: 1 sesión)
  ✦ Vinculación productos ↔ compras/ventas
  ✦ Soporte multi-cuenta en reconciliación bancaria
  ✦ Override categorías flujo de caja
```

---

## Módulos que SÍ están al 100%

Los siguientes módulos no tienen brechas identificadas y pueden considerarse production-ready:

- ✅ Libro de Compras (CRUD completo con centralización)
- ✅ Libro de Ventas (CRUD completo con centralización)
- ✅ Clientes / Proveedores (CRUD completo con saldo histórico)
- ✅ Productos y Servicios (catálogo con margen en tiempo real)
- ✅ Activos Fijos (depreciación lineal y acelerada)
- ✅ Dashboard (KPIs + 3 tipos de gráficos + liquidez)
- ✅ Balance de Comprobación
- ✅ Balance Clasificado
- ✅ Estado de Resultados
- ✅ Indicadores Económicos (UF, UTM, Previred)
- ✅ Autenticación y roles
- ✅ Multi-empresa y sincronización Firebase
- ✅ Exportación PDF/Excel
- ✅ Búsqueda global Ctrl+K
- ✅ 2ª Categoría (honorarios, egresos, ingresos, F22, F29, DJ1879*)
  *DJ1879 falta exportación PDF
