#!/usr/bin/env node
/**
 * test-fase3.js — Pruebas de la Fase 3 (cierre y trazabilidad), sin navegador
 * Uso: node PLANIFICACION/test-fase3.js
 *
 * Carga los módulos reales (compras, ventas, remuneraciones, conciliación,
 * panel del estudio) con conexiones.js y cierre.js, y comprueba:
 *   checklist de cierre · resumen para el panel · cierre del período (solo
 *   avisa) · trazabilidad asiento → origen · estado propuesto en el panel.
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

function crearEntorno(categoria = 'primera') {
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
        getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    };
    class CustomEvent { constructor(type, init) { this.type = type; this.detail = init?.detail; } }
    const ctx = {
        console, localStorage, document, CustomEvent, TextEncoder, JSON, Math, Date, Set, Array, Object, String, Number,
        Intl, parseInt, parseFloat, isNaN, isFinite, Promise, toasts: [], navegaciones: [], firestore: [],
        setTimeout: fn => fn(), clearTimeout: () => {},
    };
    ctx.window = ctx;
    ctx.mostrarToast = (m, t) => ctx.toasts.push({ m, t });
    ctx.mostrarConfirm = (m, fn) => fn();
    ctx.navegar = mod => ctx.navegaciones.push(mod);
    ctx.currentUser = { empresaId: 'EMP1', email: 'contador@estudio.cl', categoria };
    ctx._fbDb = { collection: () => ({ doc: id => ({ update: async data => { ctx.firestore.push({ id, data }); } }) }) };
    vm.createContext(ctx);
    vm.runInContext(`
        let PERIODO = { mes: 10, anio: 2026 };
        function periodoTrabajo() { return PERIODO; }
        function guardarPeriodoTrabajo(p) { PERIODO = { ...PERIODO, ...p }; }
        let dbAsientos = [];
        window.dbAsientos = dbAsientos;
        function _nextNumeroAsiento() {
            const nums = dbAsientos.map(a => a.numero).filter(n => typeof n === 'number');
            return nums.length ? Math.max(...nums) + 1 : 1;
        }
        function getProductos() { return []; }
        function productoCuentas() { return {}; }
        let ACTIVOS = [];
        function getActivos() { return ACTIVOS; } function saveActivos(a) { ACTIVOS = a; }
        function _calcDepMes(a, anio, mes) { return a.cuota || 0; }
        function getCentrosCosto() { return []; }
        let dbDocumentos = [];
        function guardarDocumentos() { localStorage.setItem('core_documentos', JSON.stringify(dbDocumentos)); }
        function editarDocumento(id) { window.docAbierto = id; }
        let _dbCartola = [];
        let _cartolaFiltroMes = 10, _cartolaFiltroAnio = 2026;
        function _cartolaRefrescar() {}
        function guardarCartolas() { localStorage.setItem('core_cartola_movs', JSON.stringify(_dbCartola)); }
        let CONTACTOS = [];
        function guardarContactos() {}
        function contactoPorRut(r) { return null; }
        function contactoRoles(c) { return []; }
        function contactoAsegurar() { return null; }
        let PLAN_CUENTAS = {};
        window.PLAN_CUENTAS = PLAN_CUENTAS;
        function guardarPlanCuentas() {}
        function parseMonto(v) { return Number(String(v).replace(/[^0-9-]/g, '')) || 0; }
        function audit() {}
    `, ctx);
    for (const f of ['js/core/datos-cliente.js', 'js/core/asientos.js', 'js/core/contabilidad.js',
                     'js/modules/inventario.js', 'js/modules/compras.js', 'js/modules/ventas.js',
                     'js/modules/remuneraciones.js', 'js/services/reconciliacion.js',
                     'js/core/conexiones.js', 'js/core/cierre.js', 'js/auditor/panel-estudio.js']) {
        vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
    }
    vm.runInContext(`renderCompras = () => {}; renderVentas = () => {}; renderReconciliacion = () => {};`, ctx);
    return { ctx, store, run: code => vm.runInContext(code, ctx) };
}

const item = (run, id) => run(`cierreChecklist('2026-10').items.find(i => i.id === '${id}')`);
const compra = (id, total) => ({ id, fecha: '15/10/2026', mes: 10, anio: 2026, tipo_doc: 'factura', numero_doc: String(id),
    rut_proveedor: '76.111.111-1', nombre_proveedor: 'Proveedor', medio_pago: 'credito', exento: 0,
    neto: Math.round(total / 1.19), iva: total - Math.round(total / 1.19), total, estado: 'pendiente' });

// ─────────────────────────────────────────────────────────────
console.log('\n══ Checklist de cierre (1ª categoría) ══');
{
    const { run } = crearEntorno();
    const c0 = run(`cierreChecklist('2026-10')`);
    check('tiene los 10 puntos de 1ª categoría', c0.items.length === 10);
    check('sin compras ni ventas, esos puntos no aplican', item(run, 'centralizar-compras').estado === 'na' && item(run, 'centralizar-ventas').estado === 'na');

    run(`dbCompras.push(${JSON.stringify(compra(1, 119000))})`);
    check('compras sin centralizar → pendiente', item(run, 'centralizar-compras').estado === 'pendiente');
    run(`generarAsientoCompras()`);
    check('al centralizar → listo', item(run, 'centralizar-compras').estado === 'ok');
    run(`dbCompras.push(${JSON.stringify(compra(2, 59500))})`);
    const ic = item(run, 'centralizar-compras');
    check('una factura nueva después de centralizar → pendiente otra vez', ic.estado === 'pendiente' && /cambios después/.test(ic.detalle));
    run(`generarAsientoCompras()`);
    check('re-centralizar lo deja listo', item(run, 'centralizar-compras').estado === 'ok');

    run(`dbDocumentos.push({ id: 9, categoria: 'compra_materia', fecha: '20/10/2026', numero_doc: '9', rut: '76.111.111-1', nombre: 'Proveedor', total: 11900, estado: 'pendiente' })`);
    check('factura en Documentos sin pasar al libro → pendiente', item(run, 'documentos').estado === 'pendiente');
    run(`conexDocPasarALibro(9)`);
    check('al pasarla al libro → listo', item(run, 'documentos').estado === 'ok');

    check('sin cartola del mes → pendiente', item(run, 'cartola').estado === 'pendiente');
    run(`_dbCartola.push({ id: 'm1', fecha: '2026-10-05', descripcion: 'x', cargo: 1000, abono: 0, banco: 'bci', estado: 'pendiente' })`);
    check('movimiento sin clasificar → pendiente', /sin clasificar/.test(item(run, 'cartola').detalle));
    run(`_dbCartola[0].estado = 'ignorado'`);
    check('todos los movimientos procesados → listo', item(run, 'cartola').estado === 'ok');

    run(`_recState.periodo = '2026-10'; _recState.transacciones = [{ _id: 't1' }]; _recState.conciliados = { t1: 1 }; _recState.saldoExtracto = 0;`);
    check('conciliación con diferencia 0 y todo conciliado → listo', item(run, 'conciliacion').estado === 'ok');
    run(`_recState.periodo = '2026-11'; _recState.transacciones = [];`);
    check('el resultado de octubre se recuerda al pasar a otro mes', item(run, 'conciliacion').estado === 'ok');

    run(`localStorage.setItem('rem_trabajadores', JSON.stringify([
            { id: 't1', nombre: 'Ana', rut: '1-9', sueldoBruto: 900000, afp: 'Habitat', sistemaSalud: 'Fonasa', fechaIngreso: '2024-01-01' },
            { id: 't2', nombre: 'Luis', rut: '2-7', sueldoBruto: 800000, afp: 'Habitat', sistemaSalud: 'Fonasa', fechaIngreso: '2024-01-01' },
            { id: 't3', nombre: 'Ex', rut: '3-5', sueldoBruto: 800000, fechaIngreso: '2020-01-01', fechaTermino: '2026-08-31' }]));
         remState.periodo = '2026-10'; remState.trabajadores = JSON.parse(localStorage.getItem('rem_trabajadores'));
         remEnviarAsiento('t1');`);
    const is = item(run, 'sueldos');
    check('sueldos: cuenta solo trabajadores vigentes y avisa cuál falta', is.estado === 'pendiente' && /1 de 2/.test(is.detalle) && /Luis/.test(is.detalle));
    run(`remEnviarAsiento('t2')`);
    check('con todos enviados → listo', item(run, 'sueldos').estado === 'ok');
    check('Previred sin pagar → pendiente con el monto', item(run, 'previred').estado === 'pendiente' && /\$/.test(item(run, 'previred').detalle));
    run(`conexPreviredRegistrarPago('2026-10', { id: 'pv', fecha: '2026-11-12', cuenta_banco: 'Banco' })`);
    check('Previred pagado → listo', item(run, 'previred').estado === 'ok');

    run(`ACTIVOS.push({ id: 'a1', nombre: 'Notebook', activo: true, cuota: 10000, periodos_depreciados: [] })`);
    check('activo sin depreciar en el mes → pendiente', item(run, 'depreciacion').estado === 'pendiente');
    run(`ACTIVOS[0].periodos_depreciados.push('2026-10')`);
    check('depreciado → listo', item(run, 'depreciacion').estado === 'ok');

    check('F29 sin registrar → pendiente', item(run, 'f29').estado === 'pendiente');
    run(`registrarAsiento({ origen: 'manual_test', ref: 'f29', fecha: '20/11/2026', glosa: 'Pago F29 IVA Octubre 2026',
          movimientos: [{ cuenta: 'IVA Débito Fiscal', debe: 100, haber: 0 }, { cuenta: 'Banco', debe: 0, haber: 100 }] })`);
    check('F29 registrado → listo', item(run, 'f29').estado === 'ok');

    check('balance cuadrado → listo', item(run, 'balance').estado === 'ok');
    run(`dbAsientos.push({ id: 999, numero: 999, estado: 'ACTIVO', fecha: '25/10/2026', glosa: 'malo', movimientos: [{ cuenta: 'Caja', debe: 10, haber: 0 }] })`);
    check('un asiento descuadrado → pendiente con su número', item(run, 'balance').estado === 'pendiente' && /999/.test(item(run, 'balance').detalle));
    run(`dbAsientos.pop()`);

    const c = run(`cierreChecklist('2026-10')`);
    check('avance = listos / puntos que aplican', c.aplican > 0 && c.avance === Math.round(c.listos / c.aplican * 100));
}

console.log('\n══ Checklist de 2ª categoría ══');
{
    const { run } = crearEntorno('segunda');
    run(`localStorage.setItem('hon_boletas', JSON.stringify([{ id: 1, fecha: '2026-10-10', bruto: 500000 }]))`);
    const c = run(`cierreChecklist('2026-10')`);
    check('usa los puntos de honorarios (boletas, PPM, cartola)', c.items.map(i => i.id).join(',') === 'boletas,ppm,cartola');
    check('boletas del mes → listo; PPM sin registrar → pendiente', c.items[0].estado === 'ok' && c.items[1].estado === 'pendiente');
    run(`localStorage.setItem('hon_ppm', JSON.stringify([{ id: 1, mes: 10, anio: 2026, monto: 12000 }]))`);
    check('PPM registrado → listo', item(run, 'ppm').estado === 'ok');
}

console.log('\n══ Cierre del período (solo avisa) ══');
{
    const { ctx, run } = crearEntorno();
    run(`cierreCerrarPeriodo('2026-10')`);
    check('el período queda cerrado con fecha y usuario', run(`cierreEstaCerrado('2026-10')`) && run(`cierresGet()['2026-10'].por`) === 'contador@estudio.cl');
    ctx.toasts.length = 0;
    const r = run(`registrarAsiento({ origen: 'manual_test', ref: 'x1', fecha: '28/10/2026', glosa: 'Ajuste',
          movimientos: [{ cuenta: 'Caja', debe: 500, haber: 0 }, { cuenta: 'Banco', debe: 0, haber: 500 }] })`);
    check('NO bloquea: el asiento se guarda igual', r.ok && run(`dbAsientos.some(a => a.origen_ref === 'x1')`));
    check('avisa que el período está cerrado', ctx.toasts.some(t => /Octubre 2026 está cerrado/.test(t.m)));
    check('registra la modificación posterior al cierre', run(`cierresGet()['2026-10'].modificaciones`) === 1);
    ctx.toasts.length = 0;
    run(`registrarAsiento({ origen: 'manual_test', ref: 'x2', fecha: '05/11/2026', glosa: 'Otro mes',
          movimientos: [{ cuenta: 'Caja', debe: 1, haber: 0 }, { cuenta: 'Banco', debe: 0, haber: 1 }] })`);
    check('un mes abierto no genera aviso', !ctx.toasts.some(t => /está cerrado/.test(t.m)));
    run(`cierreReabrirPeriodo('2026-10')`);
    check('reabrir quita el cierre', !run(`cierreEstaCerrado('2026-10')`));
    check('los cierres se respaldan por cliente (están en la lista de datos)', run(`DATOS_CLIENTE_KEYS.includes('core_cierres')`));
}

console.log('\n══ Resumen para el panel del estudio ══');
{
    const { ctx, run } = crearEntorno();
    run(`window._panelClientesCache = [{ id: 'EMP1', empresa: 'Cliente 1' }]`);
    vm.runInContext(`cierreSincronizarResumen(true)`, ctx);
    const cache = run(`window._panelClientesCache[0].cierreResumen`);
    check('actualiza la copia en memoria del panel', cache && cache['2026-10'] && typeof cache['2026-10'].avance === 'number');
    check('escribe empresas/{id}.cierreResumen.{período} en Firebase', ctx.firestore.length === 1 && ctx.firestore[0].id === 'EMP1' &&
        'cierreResumen.2026-10' in ctx.firestore[0].data);
    const res = ctx.firestore[0].data['cierreResumen.2026-10'];
    check('el resumen trae avance, pendientes y estado de cierre', 'avance' in res && Array.isArray(res.pendientes) && 'cerrado' in res);

    const cli = (r) => JSON.stringify({ id: 'X', cierreResumen: { [run('_panelPeriodo()')]: r } });
    check('panel: 100% sin cerrar se propone "Por revisar"', run(`panelKanbanGetEstado(${cli({ avance: 100, cerrado: false })})`) === 'por-revisar');
    check('panel: avance parcial se propone "En proceso"', run(`panelKanbanGetEstado(${cli({ avance: 40, cerrado: false })})`) === 'en-proceso');
    check('panel: período cerrado se propone "Cerrado"', run(`panelKanbanGetEstado(${cli({ avance: 70, cerrado: true })})`) === 'cerrado');
    const p = run('_panelPeriodo()');
    check('panel: el estado elegido a mano manda sobre el propuesto',
        run(`panelKanbanGetEstado({ id: 'X', kanbanEstados: { '${p}': 'pendiente' }, cierreResumen: { '${p}': { avance: 100 } } })`) === 'pendiente');
    check('panel: sin resumen del mes, usa el más reciente anterior para mostrar',
        run(`cierreResumenDeCliente({ cierreResumen: { '2026-08': { avance: 50 }, '2026-09': { avance: 80 } } }, '2026-10').periodo`) === '2026-09');
}

console.log('\n══ Trazabilidad: asiento → documento de origen ══');
{
    const { ctx, run } = crearEntorno();
    run(`dbCompras.push(${JSON.stringify(compra(1, 119000))}); generarAsientoCompras();`);
    const idC = run(`buscarAsientoPorOrigen('compras', '2026-10').id`);
    run(`cierreIrAOrigen(${idC})`);
    check('asiento de compras → abre el Libro de Compras de ese mes', ctx.navegaciones.pop() === 'compras' && run('comprasMes') === 10 && run('comprasAnio') === 2026);

    run(`dbDocumentos.push({ id: 5, categoria: 'honorarios', fecha: '15/10/2026', numero_doc: '1', rut: '15.000.000-1', nombre: 'Paz', total: 100000, estado: 'pendiente' });
         conexHonorarioContabilizar(5);`);
    run(`cierreIrAOrigen(buscarAsientoPorOrigen('honorarios', '5').id)`);
    check('asiento de honorarios → abre la boleta en Documentos', ctx.navegaciones.pop() === 'documentos' && run('window.docAbierto') === 5);

    run(`_dbCartola.push({ id: 'mvX', fecha: '2026-10-09', descripcion: 'x', cargo: 500, abono: 0, banco: 'bci', estado: 'clasificado', cuenta_banco: 'Banco', cuenta_contrapartida: 'Gastos Generales' });`);
    run(`registrarAsiento({ origen: 'cartola', ref: 'mvX', fecha: '09/10/2026', glosa: 'x', movimientos: [{ cuenta: 'Gastos Generales', debe: 500, haber: 0 }, { cuenta: 'Banco', debe: 0, haber: 500 }] })`);
    run(`cierreIrAOrigen(buscarAsientoPorOrigen('cartola', 'mvX').id)`);
    check('asiento de cartola → abre Cartolas', ctx.navegaciones.pop() === 'cartolas');

    run(`dbAsientos.push({ id: 777, numero: 77, estado: 'ACTIVO', fecha: '01/10/2026', glosa: 'Manual', movimientos: [] })`);
    const r = run(`cierreIrAOrigen(777)`);
    check('asiento manual: avisa que no tiene documento de origen', r === false && ctx.toasts.some(t => /no tiene un documento de origen/.test(t.m)));
}

console.log(`\nResultado: ${ok} OK, ${fallos} con error\n`);
process.exit(fallos ? 1 : 0);
