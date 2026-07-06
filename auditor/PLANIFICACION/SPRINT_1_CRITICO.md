# Sprint 1 — Crítico: Implementar el núcleo de auditoría
> Estimado: 1 sesión | Prioridad: MÁXIMA — sin esto, ContApp Auditor no tiene su diferencial

---

## Contexto

Los dos archivos en `js/auditor/` son el corazón del producto: lo que diferencia Auditor de cualquier software contable genérico. Actualmente son placeholders con comentarios pero sin ninguna función. Sin ellos, el nombre "Auditor" es solo marketing.

---

## Tarea 1.1 — Implementar `js/auditor/hallazgos.js`

### Qué hace este módulo
Permite al contador registrar observaciones sobre la contabilidad de un cliente durante el período auditado. Estas observaciones se exportan luego al informe formal.

### Estructura de datos (ya definida en el placeholder)
```js
// localStorage key: aud_hallazgos → array de:
{
  id,
  clienteId,
  periodo,           // "YYYY-MM"
  tipo,              // 'error' | 'advertencia' | 'sugerencia'
  descripcion,
  modulo,            // 'diario' | 'compras' | 'ventas' | 'balance' | 'remuneraciones' | 'otro'
  estado,            // 'abierto' | 'resuelto'
  fechaDeteccion,    // ISO string
  fechaResolucion,   // ISO string | null
}
```

### Funciones a implementar

```
audHallazgosCargar()
  → Lee localStorage 'aud_hallazgos'
  → Filtra por clienteId y período activos (window.empresaActual)

audHallazgoCrear(tipo, descripcion, modulo)
  → Genera id con Date.now()
  → Agrega al array y persiste
  → Llama audHallazgosRender()

audHallazgoResolver(id)
  → Cambia estado a 'resuelto', guarda fechaResolucion
  → Persiste y re-renderiza

audHallazgosRender(clienteId, periodo)
  → Tabla HTML con columnas: tipo, módulo, descripción, estado, fecha, acciones
  → Badge de color por tipo (error=rojo, advertencia=amarillo, sugerencia=azul)
  → Botón "Resolver" en hallazgos abiertos
  → Estado vacío si no hay hallazgos

audHallazgosExportar()
  → Retorna array filtrado — lo usa informe-auditoria.js
```

### UI: Botón "Agregar hallazgo" en otros módulos
Una vez implementado hallazgos.js, agregar en los módulos de mayor impacto un botón pequeño o shortcut:
- Libro Diario — botón flotante o en el header de la vista
- Balance — en el toolbar de exportación
- Compras / Ventas — en el toolbar de cada libro
- Remuneraciones — en el panel de liquidación

El botón abre un mini-modal (dropdown) con: tipo, descripción (textarea), módulo pre-rellenado.

### Vista dedicada
Debe existir una vista "Hallazgos" en el menú lateral con:
- Filtros por período, tipo, estado
- KPIs: total abiertos, resueltos, por módulo
- Tabla con todas las observaciones
- Botón "Nuevo hallazgo" manual

---

## Tarea 1.2 — Implementar `js/auditor/informe-auditoria.js`

### Qué hace este módulo
Genera el documento formal que el contador entrega al cliente: el informe de auditoría. Integra datos del período con los hallazgos registrados y la opinión del profesional.

### Contenido del informe (obligatorio)
1. Encabezado: nombre empresa, RUT, período auditado, fecha del informe
2. Resumen contable: balance resumido, resultado del período, IVA
3. Hallazgos del período (desde `audHallazgosExportar()`)
4. Opinión del contador (texto libre, mínimo 100 caracteres)
5. Datos del firmante: nombre, RUT, matrícula (Nº registro SII de contador)
6. Pie: fecha de emisión, sello del estudio

### Funciones a implementar

```
informeCargarDatos()
  → Lee empresa actual, período, balance, resultado, IVA del período
  → Carga hallazgos del período via audHallazgosExportar()
  → Rellena el formulario de opinión si hay borrador guardado

informeGuardarBorrador()
  → Persiste opinión + datos firmante en localStorage 'aud_informe_borrador'

informeVistaPrevia()
  → Renderiza en un <div> el informe completo con estilos de documento formal
  → No PDF aún — solo vista en pantalla

informeExportarPDF()
  → Usa jsPDF (ya disponible en exportar.js)
  → Layout: membrete, secciones, tabla de hallazgos, sección de firma
  → Nombre de archivo: "Informe_[empresa]_[periodo].pdf"
```

### Formulario de la vista
```
[Período auditado]  [Fecha informe]
[Opinión del contador] ← textarea grande, obligatorio
[Nombre contador]  [RUT]  [Matrícula]
[Nombre estudio]   [Teléfono]  [Email]
─────────────────────────────────────
[Vista previa]  [Exportar PDF]
```

### Dependencia
Tarea 1.2 depende de Tarea 1.1. El informe no tiene sentido sin la lista de hallazgos.

---

## Criterio de finalización del Sprint 1

- [ ] `audHallazgosCrear()`, `audHallazgoResolver()`, `audHallazgosRender()` funcionan
- [ ] El botón "Agregar hallazgo" existe en al menos Diario, Compras y Ventas
- [ ] La vista "Hallazgos" es accesible desde el menú lateral
- [ ] `informeVistaPrevia()` muestra el informe con datos reales del período
- [ ] `informeExportarPDF()` genera un PDF descargable con los hallazgos incluidos
- [ ] Ambos módulos persisten datos en localStorage y se filtran por cliente activo
