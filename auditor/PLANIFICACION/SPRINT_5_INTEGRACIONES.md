# Sprint 5 — Integraciones internas
> Estimado: 1 sesión | Prioridad: Media — mejoras de flujo entre módulos existentes

---

## Tarea 5.1 — `productos.js`: Autocompletar en Compras y Ventas

### Problema
`prodAbrirSelector()` existe y permite seleccionar un producto, pero no hay integración real con el formulario de compras o ventas. Al seleccionar un producto, nada se rellena automáticamente.

### Fix: flujo completo

**En `compras.js`:**
Al hacer click en el selector de producto (si existe algún campo de búsqueda de producto en el formulario):
```js
function _onProductoSeleccionadoCompra(prod) {
    _setVal('compraNombreProveedor', prod.proveedor_habitual || '');
    _setVal('compraRutProveedor',    prod.rut_proveedor     || '');
    _setVal('compraNeto',            prod.precio_costo       || '');
    // Calcular IVA automáticamente si el campo está disponible
}
```

**En `ventas.js`:**
```js
function _onProductoSeleccionadoVenta(prod) {
    _setVal('ventaNombreCliente', '');  // cliente se mantiene manual
    _setVal('ventaNeto',          prod.precio_venta || '');
    _setVal('ventaDescripcion',   prod.nombre       || '');
}
```

**Si el formulario no tiene campo de búsqueda de producto**, agregar un botón "Seleccionar producto" junto al campo de descripción/nombre en el formulario de compra y venta.

### Campos del catálogo de productos disponibles para autocompletar
Revisar `productos.js` para confirmar los nombres exactos de los campos. Según el código: `nombre`, `precio_costo`, `precio_venta`, `proveedor_habitual`, posiblemente `rut_proveedor`.

---

## Tarea 5.2 — `reconciliacion.js`: Soporte multi-cuenta bancaria

### Problema
La conciliación filtra los asientos del diario buscando movimientos de la cuenta `"Banco"`. Una empresa con cuenta corriente + cuenta RUT + cuenta de ahorro no puede conciliar cada una por separado.

### Fix
Agregar un `<select>` en el toolbar de la conciliación:
```
[Cuenta bancaria: ▼ Banco / Banco BCI / Banco Santander / Todas]
```

**Cómo obtener las opciones:** leer el Plan de Cuentas (`PLAN_CUENTAS`) y filtrar las cuentas cuyo tipo sea de activo bancario. Alternativamente, permitir que el usuario escriba el nombre de la cuenta a conciliar.

**Cambio en el filtro de asientos:**
```js
// Actualmente hardcoded:
const esBanco = (cuenta) => cuenta.toLowerCase().includes('banco');

// Con multi-cuenta:
const cuentaSeleccionada = document.getElementById('selCuentaBanco').value;
const esBanco = (cuenta) => cuenta === cuentaSeleccionada;
```

**Persistence:** guardar la última cuenta seleccionada en localStorage `core_recon_cuenta_activa`.

---

## Tarea 5.3 — `flujo-caja.js`: Override de categorías por cuenta

### Problema
La clasificación de cuentas en operacional/inversión/financiamiento está hardcodeada en la función de categorización. Si una empresa tiene una cuenta que se clasifica mal automáticamente, no hay forma de corregirlo.

### Fix: tabla de overrides en localStorage

```js
// localStorage key: core_fc_overrides
// Estructura:
[
  { cuenta: 'Publicidad Digital', categoria: 'operacional' },
  { cuenta: 'Prestamos Bancarios', categoria: 'financiamiento' },
]
```

**En la función que clasifica:**
```js
function _clasificarCuenta(nombreCuenta) {
    const overrides = _cargarFcOverrides();
    const override = overrides.find(o => o.cuenta === nombreCuenta);
    if (override) return override.categoria;
    // ... lógica actual de clasificación
}
```

**UI:** En la vista del Flujo de Caja, agregar debajo de cada tabla de categoría un botón "⚙️ Configurar clasificación". Al hacer click, abre un panel con la tabla de overrides (agregar/editar/eliminar).

---

## Tarea 5.4 — Limpieza global de `console.log` en producción

### Estado actual
14 instancias de `console.log` activas en el codebase. Las más problemáticas:
- `firebase-service.js` — logs de sincronización que exponen estructura interna
- `remuneraciones.js` — logs de cálculo de liquidaciones

### Fix recomendado: logger condicional
Agregar en `helpers.js`:
```js
const DEBUG = window.location.hostname === 'localhost' || window.location.search.includes('debug=1');
const log   = (...args) => DEBUG && console.log('[ContApp]', ...args);
const warn  = (...args) => DEBUG && console.warn('[ContApp]', ...args);
```

Reemplazar `console.log(...)` → `log(...)` en todo el codebase. Esto permite debugging en desarrollo sin contaminar producción.

---

## Tarea 5.5 — `clientes.js`: Aclarar `consultarSII()`

### Problema
El botón "Consultar SII" existe en cada contacto pero la función hace una búsqueda que no funciona de forma fiable en web (CORS). El usuario hace click y parece que falla sin razón.

### Fix (sin backend)
Cambiar el comportamiento de `consultarSII()`:
- Si está en entorno Electron (futuro): mantener la lógica actual o mejorarla
- Si está en web/PWA: mostrar un toast informativo: "La consulta al SII requiere la app de escritorio o un proxy configurado. Puedes buscar manualmente en [sii.cl]."
- Opcionalmente: abrir `https://zeus.sii.cl/cvc/stc/stc.html` en una nueva pestaña con el RUT pre-rellenado en la URL si la API lo permite

---

## Criterio de finalización del Sprint 5

- [ ] Al seleccionar un producto en el formulario de compras, se autocompletan nombre, RUT y precio de costo
- [ ] Al seleccionar un producto en el formulario de ventas, se autocompletan nombre y precio de venta
- [ ] La conciliación bancaria tiene selector de cuenta bancaria y filtra correctamente
- [ ] El flujo de caja permite overrides por cuenta persistidos en localStorage
- [ ] `console.log` en producción reemplazados por logger condicional o eliminados
- [ ] `consultarSII()` muestra estado real (no disponible en web) en lugar de fallar silenciosamente
