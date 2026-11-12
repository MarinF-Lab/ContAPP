#!/usr/bin/env node
/**
 * test-fase1.js — Pruebas de la Fase 1 de conectividad (sin navegador)
 * Uso: node PLANIFICACION/test-fase1.js
 *
 * Carga los módulos reales (compras.js, ventas.js, inventario.js) junto con
 * datos-cliente.js, asientos.js y conexiones.js en un entorno simulado, y
 * comprueba las 5 conexiones del circuito comercial.
 */
const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const ROOT = path.join(__dirname, '..');
let ok = 0, fallos = 0;
function check(desc, cond) {
    if (cond) { ok++; console.log(`  ✅ ${desc}`); }
    else      { fallos++; console.log(`  ❌ ${desc}`); }
}

function crearEntorno() {
    const store = { core_migracion_aislamiento_v1: 'x' };
    const localStorage = {
        getItem: k => (k in store ? store[k] : null),
        setItem: (k, v) => { store[k] = String(v); },
        removeItem: k => { delete store[k]; },
    };
    const listeners = {};
    const document = {
        addEventListener: (n, fn) => { (listeners[n] = listeners[n] || []).push(fn); },
        removeEventListener: () => {},
        dispatchEvent: ev => { (listeners[ev.type] || []).forEach(fn => fn(ev)); return true; },
        getElementById: () => null,
        querySelector: () => null,
    };
    class CustomEvent { constructor(type, init) { this.type = type; this.detail = init?.detail; } }
    const ctx = {
        console, localStorage, document, CustomEvent, TextEncoder, JSON, Math, Date, Set, Array, Object, String, Number,
        toasts: [], setTimeout: fn => fn(),
    };
    ctx.window = ctx;
    ctx.mostrarToast = (m, t) => ctx.toasts.push({ m, t });
    ctx.mostrarConfirm = (m, fn) => fn();
    vm.createContext(ctx);

    // Globales que en la app vienen de helpers.js, periodo.js, app.js, productos.js…
    vm.runInContext(`
        function periodoTrabajo() { return { mes: 10, anio: 2026 }; }
        let dbAsientos = [];
        window.dbAsientos = dbAsientos;
        function _nextNumeroAsiento() {
            const nums = dbAsientos.map(a => a.numero).filter(n => typeof n === 'number');
            return nums.length ? Math.max(...nums) + 1 : 1;
        }
        let PRODUCTOS = [
            { id: 'p1', nombre: 'Harina 25kg', precio_costo: 10000, precio_venta: 15000 },
            { id: 'p2', nombre: 'Sin costo', precio_costo: 0 },
        ];
        function getProductos() { return PRODUCTOS; }
        function productoCuentas(p) { return { cuenta_inventario: 'Mercaderías', cuenta_costo: 'Costo de Ventas', cuenta_venta: 'Ingresos por Ventas' }; }
        let ACTIVOS = [];
        function getActivos() { return JSON.parse(JSON.stringify(ACTIVOS)); }
        function saveActivos(a) { ACTIVOS = a; }
        let dbDocumentos = [];
        function guardarDocumentos() { localStorage.setItem('core_documentos', JSON.stringify(dbDocumentos)); }
        let _dbCartola = [];
        function guardarCartolas() { localStorage.setItem('core_cartola_movs', JSON.stringify(_dbCartola)); }
        let CONTACTOS = [];
        function contactoPorRut(r) { return CONTACTOS.find(c => c.rut === r) || null; }
        function contactoAsegurar(d, rol) { let c = contactoPorRut(d.rut); if (!c) { c = { id: CONTACTOS.length + 1, ...d, roles: [rol] }; CONTACTOS.push(c); } return c; }
        let PLAN_CUENTAS = { 'Vehículos': { grupo: 'Activo No Circulante' }, 'Equipos Computacionales': { grupo: 'Activo No Circulante' }, 'Banco': { grupo: 'Activo Circulante' } };
        function audit() {}
    `, ctx);

    for (const f of ['js/core/datos-cliente.js', 'js/core/asientos.js', 'js/modules/inventario.js',
                     'js/modules/compras.js', 'js/modules/ventas.js', 'js/core/conexiones.js']) {
        vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
    }
    // Evitar render/DOM de los módulos durante las pruebas
    vm.runInContext(`renderCompras = () => {}; renderVentas = () => {};`, ctx);
    const run = code => vm.runInContext(code, ctx);
    return { ctx, store, run };
}

const compra = (o = {}) => ({
    id: o.id || Math.floor(Math.random() * 1e9), fecha: '15/10/2026', mes: 10, anio: 2026,
    tipo_doc: 'factura', numero_doc: '100', rut_proveedor: '76.111.111-1', nombre_proveedor: 'Molino Austral SpA',
    medio_pago: 'credito', exento: 0, neto: 100000, iva: 19000, total: 119000, glosa: '', estado: 'pendiente', ...o,
});

// ─────────────────────────────────────────────────────────────
console.log('\n══ C1 · Documentos → Compras / Ventas ══');
{
    const { run } = crearEntorno();
    run(`dbDocumentos.push(
        { id: 1, categoria: 'compra_materia', fecha: '10/10/2026', numero_doc: '555', rut: '76.111.111-1', nombre: 'Molino Austral SpA', neto: 100000, iva: 19000, total: 119000, estado: 'pendiente' },
        { id: 2, categoria: 'venta_boleta',  fecha: '11/10/2026', numero_doc: '9',   rut: '', nombre: 'Cliente mesón', neto: 0, iva: 0, total: 11900, estado: 'pagada' },
        { id: 3, categoria: 'honorarios',    fecha: '12/10/2026', numero_doc: '7',   rut: '15.000.000-1', nombre: 'Ana', total: 500000, estado: 'pendiente' })`);

    const r1 = run('conexDocPasarALibro(1)');
    const c = run('dbCompras[0]');
    check('pasa una factura de compra al Libro de Compras', r1.ok && !r1.enlazado && run('dbCompras.length') === 1);
    check('copia folio, RUT, neto, IVA y total', c.numero_doc === '555' && c.rut_proveedor === '76.111.111-1' && c.neto === 100000 && c.iva === 19000 && c.total === 119000);
    check('queda enlazado en ambos sentidos', run('dbDocumentos[0].libro_id') === c.id && c.doc_id === 1);
    const r1b = run('conexDocPasarALibro(1)');
    check('pasarlo de nuevo no duplica', r1b.ok && r1b.enlazado && run('dbCompras.length') === 1);

    const r2 = run('conexDocPasarALibro(2)');
    const v = run('dbVentas[0]');
    check('una boleta de venta va al Libro de Ventas', r2.ok && r2.libro === 'ventas' && v.tipo_doc === 'boleta');
    check('sin desglose, calcula neto e IVA desde el total', v.neto === 10000 && v.iva === 1900);
    check('un documento pagado entra como pagado', v.estado === 'pagada' && v.medio_pago === 'transferencia');

    const r3 = run('conexDocPasarALibro(3)');
    check('las boletas de honorarios no van al Libro de Compras', !r3.ok && /Segunda categoría/.test(r3.error));

    run(`dbDocumentos[0].estado = 'pagada'; dbDocumentos[0].total = 120000; conexDocSincronizar(1)`);
    check('editar/pagar el documento actualiza el libro', run('dbCompras[0].estado') === 'pagada' && run('dbCompras[0].total') === 120000);
    run(`dbDocumentos[0].estado = 'anulada'; conexDocSincronizar(1)`);
    check('anular el documento anula su registro en el libro', run('dbCompras[0].estado') === 'anulada');

    run(`dbVentas[0].estado = 'anulada'; conexLibroAnulado('ventas', dbVentas[0].id)`);
    check('anular en el libro anula el documento', run('dbDocumentos[1].estado') === 'anulada');
}

{
    const { run } = crearEntorno();
    run(`dbCompras.push(${JSON.stringify(compra({ id: 50, numero_doc: '777', rut_proveedor: '76.222.222-2' }))});
         dbDocumentos.push({ id: 9, categoria: 'compra_servicio', fecha: '01/10/2026', numero_doc: '777', rut: '76222222-2', nombre: 'X', total: 119000, estado: 'pendiente' })`);
    const n = run('conexEnlazarDocumentosExistentes()');
    check('enlaza documentos antiguos por RUT + folio + tipo (sin crear nada)', n === 1 && run('dbDocumentos[0].libro_id') === 50 && run('dbCompras.length') === 1);
}

console.log('\n══ C2 · Cartolas ↔ facturas pendientes ══');
{
    const { run } = crearEntorno();
    run(`dbDocumentos.push({ id: 1, categoria: 'compra_materia', fecha: '10/10/2026', numero_doc: '555', rut: '76.111.111-1', nombre: 'Molino Austral SpA', neto: 100000, iva: 19000, total: 119000, estado: 'pendiente' });
         conexDocPasarALibro(1);
         dbCompras.push(${JSON.stringify(compra({ id: 61, numero_doc: '556', nombre_proveedor: 'Otra Empresa Ltda', rut_proveedor: '77.000.000-0' }))});
         dbCompras.push(${JSON.stringify(compra({ id: 62, numero_doc: '557', total: 50000 }))});
         _dbCartola.push({ id: 'mv1', fecha: '2026-10-20', descripcion: 'TRANSF MOLINO AUSTRAL', cargo: 119000, abono: 0, banco: 'bci', estado: 'pendiente' });`);
    const sug = run(`conexCartolaSugerencias('mv1')`);
    check('sugiere solo facturas pendientes por el mismo monto', sug.length === 2 && sug.every(s => s.total === 119000));
    check('la primera sugerencia es la del proveedor nombrado en la cartola', sug[0].nombre === 'Molino Austral SpA');

    const r = run(`conexCartolaAplicarDocumento('mv1', 'compras', ${JSON.stringify(sug[0].id)})`);
    const mv = run('_dbCartola[0]');
    const c = run(`dbCompras.find(x => x.id === ${JSON.stringify(sug[0].id)})`);
    check('el movimiento queda clasificado contra Proveedores', r.ok && mv.estado === 'clasificado' && mv.cuenta_contrapartida === 'Proveedores' && mv.cuenta_banco === 'Banco');
    check('la factura queda pagada y referenciada al movimiento', c.estado === 'pagada' && c.pagado_mov_id === 'mv1');
    check('el documento enlazado en Documentos también queda pagado', run('dbDocumentos[0].estado') === 'pagada');
    check('una factura pagada ya no se sugiere', run(`conexCartolaSugerencias('mv1')`).every(s => s.id !== c.id));

    run(`conexCartolaDesvincular('mv1')`);
    check('quitar el vínculo devuelve la factura a pendiente', run(`dbCompras.find(x => x.id === ${JSON.stringify(c.id)}).estado`) === 'pendiente' && run('_dbCartola[0].doc_vinculado') === null);
    check('y el documento vuelve a pendiente', run('dbDocumentos[0].estado') === 'pendiente');

    run(`dbVentas.push({ id: 70, fecha: '05/10/2026', tipo_doc: 'factura', numero_doc: '12', rut_cliente: '78.000.000-1', nombre_cliente: 'Cafetería Sur', medio_pago: 'credito', neto: 10000, iva: 1900, total: 11900, estado: 'pendiente' });
         _dbCartola.push({ id: 'mv2', fecha: '2026-10-21', descripcion: 'ABONO CAFETERIA SUR', cargo: 0, abono: 11900, banco: 'bci', estado: 'pendiente' });`);
    const s2 = run(`conexCartolaSugerencias('mv2')`);
    run(`conexCartolaAplicarDocumento('mv2', 'ventas', 70)`);
    check('un abono sugiere y cobra facturas de venta (contra Clientes)', s2[0]?.id === 70 && run(`_dbCartola[1].cuenta_contrapartida`) === 'Clientes' && run('dbVentas[0].estado') === 'pagada');
}

console.log('\n══ C3 · Compras / Ventas → Inventario y costo de venta ══');
{
    const { run } = crearEntorno();
    run(`dbCompras.push(${JSON.stringify(compra({ id: 80, producto_id: 'p1', cantidad: 10, bodega: 'Central' }))});
         conexDespuesDeGuardarLibro('compras', dbCompras[0]);`);
    check('una compra con producto suma stock', run(`invStockActual('Harina 25kg')`) === 10);
    run(`dbVentas.push({ id: 81, fecha: '20/10/2026', mes: 10, anio: 2026, tipo_doc: 'factura', numero_doc: '1', rut_cliente: '', nombre_cliente: 'Panadería', medio_pago: 'credito', neto: 45000, iva: 8550, total: 53550, estado: 'pendiente', producto_id: 'p1', cantidad: 3 });
         conexDespuesDeGuardarLibro('ventas', dbVentas[0]);`);
    check('una venta con producto resta stock', run(`invStockActual('Harina 25kg')`) === 7);
    run(`dbVentas[0].cantidad = 4; conexDespuesDeGuardarLibro('ventas', dbVentas[0]);`);
    check('editar la cantidad actualiza el mismo movimiento (no duplica)', run(`invStockActual('Harina 25kg')`) === 6 &&
        run(`getMovimientosInventario().filter(m => m.origen === 'ventas').length`) === 1);
    run(`dbVentas[0].estado = 'anulada'; conexLibroAnulado('ventas', 81);`);
    check('anular la venta devuelve el stock', run(`invStockActual('Harina 25kg')`) === 10);

    run(`dbVentas[0].estado = 'pendiente'; dbVentas[0].cantidad = 2; conexDespuesDeGuardarLibro('ventas', dbVentas[0]); generarAsientoVentas();`);
    const asV = run(`buscarAsientoPorOrigen('ventas', '2026-10')`);
    const costo = asV && asV.movimientos.find(m => m.cuenta === 'Costo de Ventas');
    const merc  = asV && asV.movimientos.find(m => m.cuenta === 'Mercaderías');
    check('la centralización de ventas incluye el costo de venta (2 × $10.000)', costo && costo.debe === 20000 && merc && merc.haber === 20000);
    check('el asiento de ventas cuadra', asV && Math.abs(asV.total_debe - asV.total_haber) < 1);
    check('sin costo en el catálogo no se inventa costo de venta', run(`conexCostoVenta({ producto_id: 'p2', cantidad: 5 })`) === null);
}

console.log('\n══ C4 · Compras → Activos fijos ══');
{
    const { run } = crearEntorno();
    run(`dbCompras.push(${JSON.stringify(compra({ id: 90, glosa: 'Notebook contabilidad', neto: 800000, iva: 152000, total: 952000, es_activo_fijo: true, activo_cuenta: 'Equipos Computacionales' }))});
         conexDespuesDeGuardarLibro('compras', dbCompras[0]);`);
    const a = run('ACTIVOS[0]');
    check('una compra marcada como activo crea su ficha', run('ACTIVOS.length') === 1 && a.nombre === 'Notebook contabilidad');
    check('con valor neto, fecha de la factura y cuenta elegida', a.valor_adquisicion === 800000 && a.fecha_adquisicion === '2026-10-15' && a.cuenta_activo === 'Equipos Computacionales');
    check('vida útil sugerida según el tipo de bien (equipos computacionales: 6)', a.vida_util_anos === 6);
    check('la compra queda enlazada a su activo', run('dbCompras[0].activo_id') === a.id);
    run(`dbCompras[0].neto = 750000; conexDespuesDeGuardarLibro('compras', dbCompras[0]);`);
    check('editar la compra actualiza el activo (no crea otro)', run('ACTIVOS.length') === 1 && run('ACTIVOS[0].valor_adquisicion') === 750000);
    check('en la centralización la compra va a la cuenta del activo', run(`conexCuentaCargoCompra(dbCompras[0], 'Mercaderías')`) === 'Equipos Computacionales');
    run(`dbCompras[0].estado = 'anulada'; conexLibroAnulado('compras', 90);`);
    check('anular la compra deja el activo inactivo (no lo borra)', run('ACTIVOS.length') === 1 && run('ACTIVOS[0].activo') === false);
}

console.log('\n══ C5 · Centros de costo en la centralización ══');
{
    const { run } = crearEntorno();
    run(`dbCompras.push(${JSON.stringify(compra({ id: 100, neto: 100000, iva: 19000, total: 119000, centro_costo: 'Sucursal Norte' }))});
         dbCompras.push(${JSON.stringify(compra({ id: 101, numero_doc: '101', neto: 50000, iva: 9500, total: 59500, centro_costo: 'Sucursal Sur' }))});
         dbCompras.push(${JSON.stringify(compra({ id: 102, numero_doc: '102', neto: 10000, iva: 1900, total: 11900, producto_id: 'p1', cantidad: 1 }))});
         generarAsientoCompras();`);
    const as = run(`buscarAsientoPorOrigen('compras', '2026-10')`);
    const norte = as.movimientos.find(m => m.centroCosto === 'Sucursal Norte');
    const sur   = as.movimientos.find(m => m.centroCosto === 'Sucursal Sur');
    check('cada centro de costo queda en su propia línea', norte && norte.debe === 100000 && sur && sur.debe === 50000);
    check('la compra con producto va a la cuenta de inventario del producto', as.movimientos.some(m => m.cuenta === 'Mercaderías' && !m.centroCosto && m.debe === 10000));
    check('el asiento de compras cuadra', Math.abs(as.total_debe - as.total_haber) < 1);
    check('IVA crédito fiscal total en una sola línea', as.movimientos.filter(m => m.cuenta === 'IVA Crédito Fiscal').length === 1 &&
        as.movimientos.find(m => m.cuenta === 'IVA Crédito Fiscal').debe === 19000 + 9500 + 1900);
}

console.log(`\nResultado: ${ok} OK, ${fallos} con error\n`);
process.exit(fallos ? 1 : 0);
