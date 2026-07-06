# Sprint 3 — Módulos incompletos
> Estimado: 1 sesión | Prioridad: Alta — flujos rotos visibles al usuario

---

## Tarea 3.1 — `documentos.js`: Agregar función editar

### Problema
El módulo de Documentación tiene Crear y Anular, pero no Editar. Si el usuario registra mal un documento, debe anularlo y crear uno nuevo — proceso innecesariamente costoso.

### Patrón a seguir (idéntico a `compras.js` y `ventas.js`)
Ambos libros ya tienen la implementación de editar. Documentos debe replicarla:

1. **Variable de control**
   ```js
   let _docEditandoId = null;
   ```

2. **Función `editarDocumento(id)`**
   - Busca el documento por id en el array
   - Rellena el formulario con sus datos (mismo patrón que `editarCompra`)
   - Establece `_docEditandoId = id`
   - Muestra el panel lateral del formulario

3. **Modificar `guardarDocumento()`**
   ```js
   if (_docEditandoId) {
       // update del objeto existente
   } else {
       // insert nuevo
   }
   _docEditandoId = null;
   ```

4. **Botón "Editar" en cada fila** de la tabla de documentos (icono lápiz, igual que en compras/ventas)

### Importante
Al editar, no cambiar el `id` ni el `estado` del documento. Solo los campos editables: tipo, número, nombre, RUT, monto, fecha, medio de pago, notas.

---

## Tarea 3.2 — `cartolas.js`: Persistencia al clasificar movimientos individuales

### Problema
El flujo es: importar CSV → clasificar cada movimiento → generar asientos. Si el usuario cierra la app después de clasificar pero antes de generar asientos, los estados de clasificación se pierden.

### Causa técnica
Los movimientos se guardan en `localStorage` bajo `core_cartola_movs`, pero `_abrirPanelClasificacion()` modifica el objeto en memoria y solo persiste cuando se llama `cartolasGenerarAsientos()` o `guardarCartolas()` explícitamente.

### Fix
Al cerrar el panel de clasificación individual (botón "Guardar clasificación" o al hacer click fuera del panel), llamar inmediatamente:

```js
function _cerrarPanelClasificacion() {
    guardarCartolas(); // ← agregar esta línea
    // ... resto del cierre del panel
}
```

**También:** si el movimiento ya tenía una clasificación asignada y el usuario la cambia, la actualización debe reflejarse en la tabla principal sin necesidad de recargar.

---

## Tarea 3.3 — Reglas de clasificación automática para cartolas (nueva feature menor)

### Contexto
En el README Fase 1 está pendiente: "Motor de reglas keyword→cuenta para auto-clasificar movimientos de cartolas".

### Propuesta de implementación simple (no requiere backend)
Guardar en `localStorage` una tabla `core_cartola_reglas`:
```js
[
  { keyword: 'AFP HABITAT', cuenta: 'Cotizaciones AFP', tipo: 'contains' },
  { keyword: 'ISAPRE', cuenta: 'Cotizaciones Salud', tipo: 'contains' },
  { keyword: 'SII', cuenta: 'Impuestos por Pagar', tipo: 'contains' },
]
```

Al importar una cartola, antes de mostrar los movimientos, iterar las reglas y pre-clasificar los que hagan match. El usuario puede modificar la clasificación sugerida.

**UI:** Una tabla "Reglas de clasificación" en la vista de Cartolas, donde el usuario puede agregar/editar/eliminar reglas. Funciona como configuración persistente por empresa.

> Este es el único item de Fase 1 del README que no está en otro sprint y que no requiere trabajo de backend.

---

## Criterio de finalización del Sprint 3

- [ ] `documentos.js` tiene botón "Editar" en cada fila y `guardarDocumento()` maneja el update
- [ ] Al clasificar un movimiento de cartola, el estado persiste aunque la app se cierre antes de generar asientos
- [ ] (Opcional) La vista de Cartolas tiene una tabla de reglas de clasificación automática
