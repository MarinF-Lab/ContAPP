# Sprint 4 — Reportes y tributario
> Estimado: 1 sesión | Prioridad: Media-Alta — afectan la confiabilidad del software

---

## Tarea 4.1 — `balance.js`: Estado vacío

### Problema
Cuando no hay asientos registrados, `balance.js` muestra una tabla vacía sin ningún mensaje. En todas las vistas con listas ya existe el patrón de estado vacío con texto y CTA.

### Fix
Agregar al inicio de la función de render:

```js
if (!dbAsientos || dbAsientos.length === 0) {
    container.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">📒</div>
            <h3>Sin movimientos registrados</h3>
            <p>El balance se genera automáticamente desde el Libro Diario.</p>
            <button onclick="navegarA('diario')">Ir al Libro Diario</button>
        </div>`;
    return;
}
```

---

## Tarea 4.2 — `dashboard.js`: Estado vacío / onboarding

### Problema
Con datos en cero el dashboard muestra KPIs en $0 y gráficos vacíos. Un usuario nuevo no sabe por dónde empezar.

### Fix: panel de onboarding condicional
Detectar si la empresa no tiene datos (`dbAsientos.length === 0 && dbCompras.length === 0`). Si es así, reemplazar los gráficos por un panel de "Empieza aquí" con pasos ordenados:

```
1. Ingresa el plan de cuentas       → [Ir a Plan de Cuentas]
2. Registra tus primeras compras    → [Ir a Compras]
3. Registra tus primeras ventas     → [Ir a Ventas]
4. Genera tu primer asiento         → [Ir al Diario]
```

El panel desaparece automáticamente en cuanto hay datos.

---

## Tarea 4.3 — `iva-resumen.js`: Notas de crédito automáticas

### Problema crítico de exactitud
El cálculo actual suma `iva` de todos los documentos del período sin distinguir tipo. Las Notas de Crédito deben restar del IVA, no sumar.

### Cómo está calculado actualmente
```js
const ivaDebito  = ventas.reduce((s, v) => s + (parseFloat(v.iva) || 0), 0);
const ivaCredito = compras.reduce((s, c) => s + (parseFloat(c.iva) || 0), 0);
```

Las NC de ventas reducen el débito fiscal. Las NC de compras reducen el crédito fiscal. Esto hoy se ignora.

### Fix
Los tipos de documento están en `v.tipo_doc`. Los valores posibles identificados en el código son: `'factura'`, `'boleta'`, `'nota_credito'`, `'nota_debito'`, `'exento'`, `'guia'`.

```js
// Ventas: suma facturas/boletas, resta NC
const ivaDebito = ventas.reduce((s, v) => {
    const iva = parseFloat(v.iva) || 0;
    return v.tipo_doc === 'nota_credito' ? s - iva : s + iva;
}, 0);

// Compras: suma facturas, resta NC
const ivaCredito = compras.reduce((s, c) => {
    const iva = parseFloat(c.iva) || 0;
    return c.tipo_doc === 'nota_credito' ? s - iva : s + iva;
}, 0);
```

**Mostrar en la UI:** agregar una fila en el resumen que muestre cuántas NC hay y el ajuste que aplicaron. Transparencia para el contador.

---

## Tarea 4.4 — `segunda-categoria.js`: Exportación DJ 1879

### Problema
La DJ 1879 se muestra en pantalla pero no tiene botón de exportación. El README ya la marca como `✅ Funcional` con asterisco `*DJ1879 falta exportación PDF`.

### Fix
Las funciones `exportarPDF()` y `exportarExcel()` de `exportar.js` ya están disponibles globalmente. Solo falta llamarlas desde la vista de DJ 1879 con los datos correctos.

1. Agregar botones "Exportar PDF" y "Exportar Excel" al toolbar de la vista DJ 1879
2. La función de exportar PDF debe estructurar la declaración como tabla (RUT | Nombre | Monto honorarios | Retención | Año tributario)
3. La función de exportar Excel debe usar SheetJS con las mismas columnas

---

## Tarea 4.5 — `activos.js`: Prevenir doble depreciación

### Problema
El módulo genera asientos de depreciación mensual pero no registra cuáles meses ya fueron procesados. Un contador podría generar la depreciación de enero dos veces sin advertencia.

### Fix
Modificar la estructura de cada activo para agregar:
```js
{
    // ...campos actuales...
    periodos_depreciados: ['2025-01', '2025-02', '2025-03'],  // nuevo campo
}
```

Al hacer click en "Generar depreciación":
1. Obtener el período seleccionado en formato `'YYYY-MM'`
2. Si `activo.periodos_depreciados.includes(periodo)`, mostrar un toast de advertencia: "La depreciación de [período] ya fue generada para [activo]"
3. Si no, generar el asiento y agregar el período al array

**En la tabla de activos:** agregar una columna "Último período depreciado" que muestre el último elemento del array, o "Nunca" si está vacío.

---

## Tarea 4.6 — `segunda-categoria.js`: Multi-período en F22 y F29

### Problema menor
El F29 y F22 de 2ª categoría muestran datos del mes seleccionado, pero no hay forma de ver un resumen anual consolidado. Para la declaración anual (F22), el contador necesita ver el año completo.

### Fix
Agregar un selector en la vista F22: "Ver período completo del año". Si se activa, calcular los totales del año calendario completo en lugar de un mes específico.

---

## Criterio de finalización del Sprint 4

- [ ] `balance.js` muestra estado vacío con CTA cuando no hay asientos
- [ ] `dashboard.js` muestra panel de onboarding cuando la empresa está sin datos
- [ ] `iva-resumen.js` resta correctamente las NC de ventas del débito fiscal y las NC de compras del crédito fiscal
- [ ] La vista DJ 1879 tiene botones "Exportar PDF" y "Exportar Excel" funcionales
- [ ] `activos.js` previene doble depreciación verificando `periodos_depreciados` antes de generar el asiento
- [ ] La tabla de activos muestra el último período depreciado por activo
