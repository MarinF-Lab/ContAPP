# Sprint 2 — UX: Diario, Mayor y validaciones
> Estimado: 1 sesión | Prioridad: Alta — el Libro Diario es el módulo más usado

---

## Contexto

El código tiene dos patrones de UX nativos del browser que se deben eliminar por completo:
- `alert()` — bloquea el hilo, no se puede estilizar, rompe flujo visual
- `confirm()` — mismo problema, pero para confirmaciones destructivas

El sistema ya tiene `mostrarToast()` para notificaciones. Falta construir un modal de confirmación propio para reemplazar los `confirm()`.

---

## Tarea 2.1 — Reemplazar `alert()` en `diario.js`

### Instancias identificadas (8 total)

| Línea | Mensaje actual | Fix |
|-------|---------------|-----|
| 201 | "Ingrese glosa válida comercial" | `mostrarToast('Ingresa una glosa válida.', 'error')` |
| 206 | "Monto comercial no detectado" | `mostrarToast('No se detectó monto. Ej: "compré 50.000 en oficina".', 'error')` |
| 259 | Texto largo de 14 líneas sobre tipos no reconocidos | Reemplazar por `<div class="glosa-ayuda">` inline debajo del input. Ver nota abajo. |
| 706 | "Debe generar un asiento primero" | `mostrarToast('Primero genera el asiento desde la glosa.', 'error')` |
| 716 | "Debe ingresar una fecha" | `mostrarToast('Selecciona la fecha del asiento.', 'error')` |
| 1137 | "Ingrese una glosa para el asiento" | `mostrarToast('La glosa es obligatoria.', 'error')` |
| 1138 | "Ingrese la fecha del asiento" | `mostrarToast('La fecha es obligatoria.', 'error')` |
| 1141 | "El asiento debe tener al menos 2 líneas" | `mostrarToast('Mínimo 2 líneas: una cuenta débito y una crédito.', 'error')` |
| 1145 | "El asiento no cuadra" | `mostrarToast('El asiento no cuadra. Debe = ' + fmt(totD) + ' / Haber = ' + fmt(totH), 'error')` |

**Nota — texto largo línea 259:** El mensaje sobre "tipo de operación no reconocido" tiene 14 líneas de ejemplos. Como toast no cabe. Solución: implementar un `<details><summary>¿Cómo funciona la glosa?</summary>...</details>` colapsable justo debajo del input de glosa, siempre visible pero discreto. El texto del alert actual se convierte en el contenido de ese acordeón.

---

## Tarea 2.2 — Agregar glosa y número al `mayor.js`

### Problema
El historial del Libro Mayor solo muestra `fecha | debe | haber`. En auditoría, la glosa y el número de asiento son los datos clave para entender cada movimiento.

### Qué agregar al render de cada fila
Revisar la función que genera el HTML del historial (alrededor de la línea que itera `c.historial.forEach`). Los datos ya existen en `dbAsientos` — el problema es que `recopilarMovimientosPorCuenta()` no los extrae.

**Columnas de la tabla del Mayor (después del fix):**
```
N° Asiento | Fecha | Glosa | Debe | Haber | Saldo
```

**Qué agregar a cada objeto en `historial`:**
- `numero` — número de asiento del Diario
- `glosa` — texto descriptivo del asiento
- `contacto` — opcional: RUT/nombre del tercero (si aplica)

---

## Tarea 2.3 — Filtro por cuenta y período en `mayor.js`

### Problema
El Libro Mayor muestra todas las cuentas de una vez. Con un año completo de movimientos, la vista se vuelve ilegible.

### UI a agregar (toolbar del Libro Mayor)
```
[Cuenta: ▼ todas las cuentas ]  [Período: ▼ 2025-12 ]  [Buscar]
```

Implementación:
- `<select>` de cuentas: poblar con las cuentas que tienen movimientos (no todo el plan de cuentas)
- `<select>` de período: año/mes en formato "YYYY-MM"
- Al cambiar, re-renderizar el libro filtrando el array de resultados
- Estado vacío si la combinación elegida no tiene movimientos

---

## Tarea 2.4 — Reemplazar `alert()` en `plan-cuentas.js`

### Instancias identificadas (5 total)

| Línea | Mensaje actual | Fix |
|-------|---------------|-----|
| 191 | "La cuenta ya existe" | `mostrarToast('Ya existe una cuenta con ese nombre.', 'error')` |
| 417 | "No se puede eliminar: tiene movimientos" | `mostrarToast('No se puede eliminar "' + nombre + '": tiene movimientos registrados.', 'error')` |
| 442 | "Ingrese el nombre de la cuenta" | `mostrarToast('El nombre de la cuenta es obligatorio.', 'error')` |
| 450 | "El código ya está asignado a..." | `mostrarToast('El código "' + codigo + '" ya pertenece a "' + duplicado + '".', 'error')` |
| 457 | "Ya existe una cuenta con el nombre..." | `mostrarToast('Ya existe una cuenta con ese nombre.', 'error')` |

---

## Tarea 2.5 — Limpiar `remuneraciones.js`

### Problemas identificados
- `alert()` — al menos 7 instancias (validaciones de formulario de trabajador, liquidación, finiquito)
- `console.log` — mezclados con lógica de negocio

**Fix:** Mismo patrón — `mostrarToast()` para validaciones, eliminar o condicionar `console.log`.

> No es necesario mapear línea por línea: buscar y reemplazar `alert(` → `mostrarToast(`, y eliminar las líneas con `console.log` en este archivo.

---

## Tarea 2.6 — Modal de confirmación propio (reemplazar `confirm()`)

### Por qué es necesario
Hay 30+ llamadas a `confirm()` nativo en todo el codebase. El browser muestra un dialog genérico del sistema operativo que:
- No se puede estilizar
- Bloquea el hilo principal
- No se puede usar en iframes/PWA embedidas
- Interrumpe el flujo visual

### Implementación sugerida
Agregar en `helpers.js` (o en un nuevo `js/core/modal.js`) una función:

```js
function mostrarConfirm(mensaje, onConfirm, { titulo = '¿Confirmar?', textoBtn = 'Confirmar', tipo = 'danger' } = {}) {
    // Renderiza un <div class="modal-overlay"> con:
    // - título
    // - párrafo con el mensaje
    // - botón "Cancelar" (cierra el modal)
    // - botón "Confirmar" (ejecuta onConfirm() y cierra)
}
```

Una vez implementada esta función, reemplazar cada `if (!confirm('...')) return;` por:
```js
mostrarConfirm('¿...?', () => {
    // lógica destructiva aquí
});
```

> Este cambio es el de mayor impacto visual por esfuerzo. Un modal propio sube el nivel de profesionalismo de la app instantáneamente.

---

## Criterio de finalización del Sprint 2

- [ ] Cero llamadas a `alert()` en `diario.js`, `plan-cuentas.js`, `remuneraciones.js`
- [ ] El acordeón de ayuda para glosas está en la vista del Diario
- [ ] Libro Mayor muestra: N° asiento, glosa, fecha, debe, haber, saldo
- [ ] Libro Mayor tiene filtro por cuenta y por período
- [ ] `mostrarConfirm()` está implementada y reemplaza al menos los `confirm()` de acciones destructivas mayores (vaciar libro, eliminar empresa, eliminar trabajador)
- [ ] `console.log` de `remuneraciones.js` eliminados
