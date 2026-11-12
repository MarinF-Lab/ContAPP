# Conectividad entre módulos — Fases 0 y 1

> Fecha: 2026-11-12 · Alcance: solo conexiones y funciones. **No se cambió el diseño**
> (no hay pantallas ni botones nuevos; los avisos usan `mostrarConfirm`/`mostrarToast` existentes).

## Problemas que corrige

| # | Problema | Dónde estaba |
|---|----------|--------------|
| 1 | Al cambiar de cliente, activos, cartolas, inventario, bodegas, centros de costo y 2ª categoría **seguían visibles en el cliente nuevo** y se mezclaban. | `firebase-service.js` solo limpiaba 12 claves |
| 2 | Esos mismos datos **no se respaldaban en la nube**. | `FB_KEYS` |
| 3 | Cambiar de cliente desde el panel, el chip de recientes o al crear un cliente **no limpiaba nada**: el cliente nuevo heredaba datos del anterior y el auto-sync podía subirlos a él. | `seleccionarEmpresa()` |
| 4 | Remuneraciones creaba **un asiento nuevo en cada clic** (gasto duplicado). | `remEnviarAsiento()` |
| 5 | Cinco módulos escribían `core_asientos` cada uno a su manera, sin validar Debe = Haber. | compras, ventas, remuneraciones, activos, cartolas |
| 6 | Prestadores de 2ª categoría separados de Clientes/Proveedores. | `hon_prestadores` |
| 7 | Documentos (`dbDocumentos`), Cartolas, Conciliación y Remuneraciones no recargaban su memoria al cambiar de cliente. | estados en memoria |

## Qué se implementó

### Paso 1 · Respaldo del cliente — `js/core/datos-cliente.js`
- `exportarRespaldoCliente()` descarga un `.json` con las 23 claves del cliente.
- `importarRespaldoCliente(archivo|texto)` valida y restaura (con confirmación).
- Botones en **Configuración → Respaldo del cliente** (agregados en la Fase 1).

### Paso 2 · Avisos entre módulos — `ContappEventos`
- `ContappEventos.emitir(nombre, detalle)` / `ContappEventos.escuchar(nombre, fn)`.
- En uso: `cliente:datos-cargados`, `asiento:registrado`, `asiento:anulado`, `contacto:actualizado`.

### Paso 3 · Datos por cliente y en la nube
- Lista única `DATOS_CLIENTE_DOCS` (23 claves; antes 12). `firebase-service.js` la usa para sincronizar, limpiar y cargar.
- `core_datos_empresa_id` registra **de qué cliente son los datos del navegador**.
- `_fbSoltarDatosDeOtroCliente()`: antes de cargar otro cliente sube lo pendiente **al cliente dueño** y limpia. Se llama en `seleccionarEmpresa()` y `fbLoadFromCloud()`.
- Si no se puede subir (sin conexión, sin permiso o datos creados en modo local) **no se borra**: se aparta como "datos sin cliente".
- **Migración (una sola vez):** los datos de las 13 claves nuevas que ya existían se apartan en `core_respaldo_sin_cliente`. Al abrir un cliente se pregunta: "¿Pertenecen a {cliente}?". Si se cancela, se pregunta en el siguiente cliente. Nunca se suben solos.
- `_fbRecargarMemoria()` ahora también recarga Documentos y emite `cliente:datos-cargados`; Cartolas, Conciliación, Remuneraciones y 2ª categoría escuchan y recargan.
- `fbCambiarCuenta()` sube lo pendiente antes de cerrar sesión; `fbLogout()` limpia las 23 claves.

### Paso 4 · Límite de 1 MB de Firestore
- Antes de subir se mide cada documento. Al 70 % avisa una vez por sesión; sobre el límite **no lo sube** (para no bloquear al resto) y pide exportar respaldo.
- **Pendiente:** dividir asientos/compras/ventas por año antes de tener clientes grandes.

### Paso 5 · Registro único de asientos — `js/core/asientos.js`
- `registrarAsiento({ origen, ref, fecha, glosa, movimientos, tipo, extra, buscarLegacy })`
  - valida Debe = Haber (tolerancia $1), cuentas y montos;
  - si existe un asiento ACTIVO con el mismo `origen` + `ref` **lo actualiza** (no duplica);
  - reconoce asientos antiguos sin `origen_ref` mediante `buscarLegacy`;
  - numeración única, guarda y emite `asiento:registrado` (Diario y Mayor se refrescan solos).
- `anularAsientosPorOrigen(origen, ref)` y `buscarAsientoPorOrigen(origen, ref)`.

| Módulo | origen | ref |
|--------|--------|-----|
| Compras (centralización) | `compras` | `AAAA-MM` |
| Ventas (centralización) | `ventas` | `AAAA-MM` |
| Remuneraciones (liquidación) | `remuneraciones` | `trabajadorId\|AAAA-MM` |
| Remuneraciones (finiquito) | `finiquito` | `trabajadorId\|fechaTérmino` |
| Activos (depreciación) | `activos_depreciacion` | `AAAA-MM\|ids del lote` |
| Cartolas | `cartola` | id del movimiento |

> Cambio de comportamiento: un asiento automático **descuadrado ya no se guarda**; se muestra el error.

### Paso 6 · Contactos únicos
- `clientes.js`: `normalizarRut()`, `contactoPorRut()`, `contactoRoles()`, `contactoAsegurar(datos, rol)` (un RUT = un contacto, con roles).
- 2ª categoría: al registrar un prestador se asegura su contacto con rol `prestador`; `honEnlazarPrestadoresConContactos()` enlaza los existentes (idempotente).
- Trabajadores: se enlazan por RUT con `contactoPorRut()` (no se copian).
- `productos.js`: `productoCuentas()` con cuentas por defecto (Existencias / Costo de Ventas / Ingresos por Ventas) para la Fase 1.

## Verificación
```bash
node PLANIFICACION/verificar.js     # 39 ✅ (incluye sección Fase 0)
node PLANIFICACION/test-fase0.js    # 28 pruebas del registro de asientos, migración y respaldo
```
Prueba en navegador (Chromium, modo sin conexión): la app carga sin errores propios, la migración pregunta por los datos huérfanos, reenviar un asiento no duplica y un RUT repetido no crea dos contactos.

**No probado:** el flujo con Firebase real (login y cambio entre dos clientes en la nube). Probar manualmente:
1. Cliente A: registrar 1 activo y 1 boleta de honorarios.
2. Cambiar a cliente B (desde el panel o el chip de recientes): no deben aparecer.
3. Volver a A: deben estar. Abrir en otro navegador: deben estar.
4. Enviar 2 veces la misma liquidación al Diario: 1 solo asiento.

> **Corrección (Fase 1):** en la Fase 0 se agregaron por error `doc_pagar` y `doc_cobrar` a la
> lista de datos por cliente. No son datos guardados (son valores de "medio de pago"), así que nunca
> se subían ni causaban daño; se quitaron de la lista (quedan 23 claves).

---

# Fase 1 — Circuito comercial

> Fecha: 2026-11-12 · Lógica en `js/core/conexiones.js` (se carga después de los módulos).
> Interfaz agregada con los estilos actuales de la app; **no** se aplicó el diseño de los artefactos.

| # | Conexión | Funciones | Interfaz |
|---|----------|-----------|----------|
| C1 | Documentos → Compras/Ventas | `conexDocPasarALibro`, `conexDocSincronizar`, `conexLibroAnulado`, `conexEnlazarDocumentosExistentes` | Botón **📗 Pasar al libro** / marca **En libro** en Documentos |
| C2 | Cartolas ↔ facturas pendientes | `conexCartolaSugerencias`, `conexCartolaAplicarDocumento`, `conexCartolaDesvincular` | Facturas sugeridas en el panel **Clasificar** de Cartolas |
| C3 | Compras/Ventas → Inventario | `conexSincronizarInventario`, `conexCostoVenta`, `invRegistrarPorOrigen`, `invEliminarPorOrigen` | Producto, cantidad y bodega en los formularios de compra y venta |
| C4 | Compras → Activos fijos | `conexSincronizarActivo`, `conexCuentaCargoCompra`, `conexVidaUtilSugerida` | Casilla **Es activo fijo** + cuenta y vida útil en Compras |
| C5 | Centros de costo | líneas `centroCosto` en las centralizaciones y en sueldos | Selector en Compras, Ventas y en el contrato del trabajador |
| + | Respaldo (Fase 0) | `exportarRespaldoCliente`, `importarRespaldoCliente` | Tarjeta en Configuración |

## Cómo funciona

**C1 · Documentos como bandeja de entrada**
- Facturas de compra (materia prima y servicio) → Libro de Compras; facturas y boletas de venta → Libro de Ventas. Honorarios no (van por 2ª categoría).
- Si el libro ya tiene el mismo documento (RUT + folio + tipo) **solo se enlazan**, no se duplica. Los documentos antiguos se enlazan solos al cargar.
- Documento sin desglose: se asume afecto y se calcula neto e IVA desde el total.
- Editar, pagar o anular el documento actualiza el libro; anular en el libro anula el documento.

**C2 · Pagos y cobros conciliados**
- Al clasificar un cargo se sugieren las facturas de compra **pendientes por el mismo monto** (±$1); un abono sugiere facturas de venta. Orden: RUT o nombre del proveedor en la glosa del banco, folio, cercanía de fecha.
- "Es este pago": el movimiento queda clasificado contra la cuenta del medio de pago (Proveedores/Clientes), la factura y su documento quedan **pagados** y el saldo del contacto baja. "Quitar vínculo" lo deshace. Ignorar o eliminar el movimiento también lo deshace.

**C3 · Stock y costo de venta**
- Compra con producto = ingreso; venta = egreso (al revés en notas de crédito). Un movimiento por documento: editar lo actualiza, anular lo elimina.
- La centralización de ventas agrega **Costo de Ventas / Mercaderías** = cantidad × precio de costo del catálogo (mismo criterio que la calculadora del Diario). Sin costo en el catálogo no se inventa.
- La compra con producto se carga a la cuenta de inventario del producto (por defecto Mercaderías).

**C4 · Activo fijo desde la compra**
- La ficha se crea con nombre (glosa), fecha de la factura, valor neto + exento, proveedor y la vida útil sugerida (equipos computacionales 6, vehículos 7, muebles 7, maquinarias 15…; editable).
- En la centralización esa compra va a la cuenta del activo, no a la cuenta de cargo del mes.
- Anular la compra deja el activo **inactivo** (no se borra por si ya tiene depreciación).

**C5 · Centros de costo**
- Las centralizaciones agrupan por cuenta **y** centro de costo (campo `centroCosto` en el movimiento, el mismo que usa la calculadora del Diario).
- Remuneraciones: el centro de costo del contrato va en las líneas de gasto (sueldo y leyes sociales) y en el finiquito.

## Verificación
```bash
node PLANIFICACION/verificar.js     # 50 ✅ (secciones Fase 0 y Fase 1)
node PLANIFICACION/test-fase0.js    # 28 pruebas
node PLANIFICACION/test-fase1.js    # 39 pruebas (carga compras.js, ventas.js e inventario.js reales)
```
Prueba en navegador (Chromium, sin conexión): Documentos → "Pasar al libro" crea la compra; el formulario de compra muestra bodegas, centros de costo y los campos de activo fijo; Cartolas sugiere la factura y al aceptarla queda pagada junto con su documento; la tarjeta de respaldo aparece en Configuración. Sin errores de la app en consola.

**No probado:** con Firebase real ni con datos reales de un cliente.

## Pendiente
- Paso 4b (Fase 0): dividir documentos grandes por año.
- Fase 2: pago de sueldos y Previred con la cartola; boletas de honorarios recibidas → retención en F29.
- Fase 3: checklist de cierre por cliente y trazabilidad Balance → asiento → documento.
- Diseño: aplicar el diseño de los artefactos (al final, con aprobación).
