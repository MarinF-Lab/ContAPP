# Bugs críticos — ContApp Auditor
> Prioridad sobre cualquier sprint. Actualizado: 2026-06-25 tras análisis profundo.

---

## BUG-1 — Cartolas en blanco ✅ CORREGIDO
**Causa:** `renderCartolas()` buscaba `id="seccion-cartolas"` pero HTML tiene `id="view-cartolas"`.
**Fix aplicado:** `cartolas.js` línea 686 — verificado en código.

---

## BUG-2 — Libro Mayor sin tabla ❌ CRÍTICO

**Síntoma:** Al navegar al Libro Mayor, solo aparecen los filtros (selectores de cuenta y período) pero no hay tabla de movimientos.

**Causa raíz (confirmada):**
`mayor.js` tiene solo 63 líneas y la función `generarLibroMayor()` está truncada. El código termina en el interior de un `forEach` sin construir el HTML de la tabla:

```js
listaFiltrada.forEach(cName => {
    const c = cuentas[cName];
    // ← ARCHIVO TERMINA AQUÍ. No hay <table>, <th>, <td>, ni saldo.
```

Los datos SÍ existen — `recopilarMovimientosPorCuenta()` en `contabilidad.js` ya incluye `glosa` y `numero` en cada movimiento del historial. Solo falta el render.

**Fix requerido:** Completar `generarLibroMayor()` con:
- Cabecera: `N° | Fecha | Glosa | Debe | Haber | Saldo`
- Filas: iterar `c.historial`, filtrar por período si aplica, calcular saldo acumulado
- Filtro de período integrado al render

**Verificación:** Mayor debe mostrar tabla con columnas N°, Fecha, Glosa, Debe, Haber, Saldo al tener asientos en localStorage.

---

## BUG-3 — `audAbrirCrearHallazgo()` llamada sin existir ❌ CRÍTICO

**Síntoma:** Al hacer click en "Agregar Hallazgo" en Diario, Compras o Ventas, ocurre un error JS silencioso (`audAbrirCrearHallazgo is not defined`).

**Causa:** `index.html` llama a la función en tres lugares (líneas 469, 603, 701) pero la función no está implementada en `hallazgos.js`.

**Fix:** Implementar `audAbrirCrearHallazgo(modulo)` como parte del Sprint 1.

---

## BUG-4 — `view-informe` inaccesible desde UI ❌ MODERADO

**Síntoma:** La vista del Informe de Auditoría existe en HTML (`id="view-informe"`) pero no hay ningún enlace en el sidebar que permita navegar a ella. El usuario no puede acceder.

**Fix:** Agregar item en el sidebar dentro del grupo "Auditoría":
```html
<div class="nav-item" onclick="navegar('informe', this)">
    <span class="nav-icon">📄</span>
    <span class="nav-text">Informe</span>
</div>
```

---

## BUG-5 — `sii-rcv.js` usa `alert()` nativo ❌ MENOR

**Síntoma:** Al hacer click en "¿Cómo crear un proxy?" en la vista RCV, aparece un `alert()` nativo del browser con instrucciones largas. Bloquea el hilo y es difícil de leer.

**Causa:** `sii-rcv.js` línea 385 — `alert(\`Cómo crear un proxy...\`)`.

**Fix:** Reemplazar por un modal o panel colapsable con las instrucciones.

---

## Historial

| Fecha | Bug | Estado |
|-------|-----|--------|
| 2026-06-25 | BUG-1 Cartolas en blanco (ID mismatch) | ✅ Corregido |
| 2026-06-25 | BUG-2 Mayor sin tabla (`mayor.js` truncado) | ❌ Activo |
| 2026-06-25 | BUG-3 `audAbrirCrearHallazgo()` no existe | ❌ Activo |
| 2026-06-25 | BUG-4 `view-informe` sin link sidebar | ❌ Activo |
| 2026-06-25 | BUG-5 `alert()` en sii-rcv.js | ❌ Activo |
