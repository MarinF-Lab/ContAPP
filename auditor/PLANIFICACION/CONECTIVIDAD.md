# Conectividad entre módulos — Fase 0 (Base)

> Fecha: 2026-11-12 · Alcance: solo conexiones y funciones. **No se cambió el diseño**
> (no hay pantallas ni botones nuevos; los avisos usan `mostrarConfirm`/`mostrarToast` existentes).

## Problemas que corrige

| # | Problema | Dónde estaba |
|---|----------|--------------|
| 1 | Al cambiar de cliente, activos, cartolas, inventario, bodegas, centros de costo, 2ª categoría y cuentas por cobrar/pagar **seguían visibles en el cliente nuevo** y se mezclaban. | `firebase-service.js` solo limpiaba 12 claves |
| 2 | Esos mismos datos **no se respaldaban en la nube**. | `FB_KEYS` |
| 3 | Cambiar de cliente desde el panel, el chip de recientes o al crear un cliente **no limpiaba nada**: el cliente nuevo heredaba datos del anterior y el auto-sync podía subirlos a él. | `seleccionarEmpresa()` |
| 4 | Remuneraciones creaba **un asiento nuevo en cada clic** (gasto duplicado). | `remEnviarAsiento()` |
| 5 | Cinco módulos escribían `core_asientos` cada uno a su manera, sin validar Debe = Haber. | compras, ventas, remuneraciones, activos, cartolas |
| 6 | Prestadores de 2ª categoría separados de Clientes/Proveedores. | `hon_prestadores` |
| 7 | Documentos (`dbDocumentos`), Cartolas, Conciliación y Remuneraciones no recargaban su memoria al cambiar de cliente. | estados en memoria |

## Qué se implementó

### Paso 1 · Respaldo del cliente — `js/core/datos-cliente.js`
- `exportarRespaldoCliente()` descarga un `.json` con las 25 claves del cliente.
- `importarRespaldoCliente(archivo|texto)` valida y restaura (con confirmación).
- **Sin botón todavía** (decisión de diseño pendiente). Se puede llamar desde la consola del navegador.

### Paso 2 · Avisos entre módulos — `ContappEventos`
- `ContappEventos.emitir(nombre, detalle)` / `ContappEventos.escuchar(nombre, fn)`.
- En uso: `cliente:datos-cargados`, `asiento:registrado`, `asiento:anulado`, `contacto:actualizado`.

### Paso 3 · Datos por cliente y en la nube
- Lista única `DATOS_CLIENTE_DOCS` (25 claves; antes 12). `firebase-service.js` la usa para sincronizar, limpiar y cargar.
- `core_datos_empresa_id` registra **de qué cliente son los datos del navegador**.
- `_fbSoltarDatosDeOtroCliente()`: antes de cargar otro cliente sube lo pendiente **al cliente dueño** y limpia. Se llama en `seleccionarEmpresa()` y `fbLoadFromCloud()`.
- Si no se puede subir (sin conexión, sin permiso o datos creados en modo local) **no se borra**: se aparta como "datos sin cliente".
- **Migración (una sola vez):** los datos de las 13 claves nuevas que ya existían se apartan en `core_respaldo_sin_cliente`. Al abrir un cliente se pregunta: "¿Pertenecen a {cliente}?". Si se cancela, se pregunta en el siguiente cliente. Nunca se suben solos.
- `_fbRecargarMemoria()` ahora también recarga Documentos y emite `cliente:datos-cargados`; Cartolas, Conciliación, Remuneraciones y 2ª categoría escuchan y recargan.
- `fbCambiarCuenta()` sube lo pendiente antes de cerrar sesión; `fbLogout()` limpia las 25 claves.

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

## Pendiente (siguientes fases)
- Diseño: botones de exportar/importar respaldo y aviso de tamaño en Configuración.
- Paso 4b: dividir documentos grandes por año.
- Fase 1: Documentos → Compras/Ventas, stock automático, compra → activo fijo, cartola ↔ facturas pendientes, centros de costo en Compras/Ventas/Sueldos.
