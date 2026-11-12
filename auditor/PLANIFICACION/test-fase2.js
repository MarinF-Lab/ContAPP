#!/usr/bin/env node
/**
 * test-fase2.js — Pruebas de la Fase 2 de conectividad (sin navegador)
 * Uso: node PLANIFICACION/test-fase2.js
 *
 * Carga los módulos reales (remuneraciones.js, compras.js, ventas.js,
 * inventario.js) con datos-cliente.js, asientos.js y conexiones.js, y prueba:
 *   P1 sueldos ↔ cartola (individual y nómina), P2 Previred ↔ cartola,
 *   P3 boletas de honorarios → asiento con retención → F29,
 *   P4 pago de honorarios ↔ cartola, P5 trabajador ↔ contacto.
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
        getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    };
    class CustomEvent { constructor(type, init) { this.type = type; this.detail = init?.detail; } }
    const ctx = {
        console, localStorage, document, CustomEvent, TextEncoder, JSON, Math, Date, Set, Array, Object, String, Number,
        Intl, parseInt, parseFloat, isNaN, isFinite, setTimeout: fn => fn(), toasts: [],
    };
    ctx.window = ctx;
    ctx.mostrarToast = (m, t) => ctx.toasts.push({ m, t });
    ctx.mostrarConfirm = (m, fn) => fn();
    vm.createContext(ctx);
    vm.runInContext(`
        function periodoTrabajo() { return { mes: 10, anio: 2026 }; }
        let dbAsientos = [];
        window.dbAsientos = dbAsientos;
        function _nextNumeroAsiento() {
            const nums = dbAsientos.map(a => a.numero).filter(n => typeof n === 'number');
            return nums.length ? Math.max(...nums) + 1 : 1;
        }
        function getProductos() { return []; }
        function productoCuentas() { return {}; }
        function getActivos() { return []; } function saveActivos() {}
        function getCentrosCosto() { return []; }
        let dbDocumentos = [];
        function guardarDocumentos() { localStorage.setItem('core_documentos', JSON.stringify(dbDocumentos)); }
        let _dbCartola = [];
        function guardarCartolas() { localStorage.setItem('core_cartola_movs', JSON.stringify(_dbCartola)); }
        let CONTACTOS = [];
        function guardarContactos() {}
        function contactoPorRut(r) { const n = String(r||'').replace(/[^0-9kK]/g,''); return CONTACTOS.find(c => String(c.rut).replace(/[^0-9kK]/g,'') === n) || null; }
        function contactoRoles(c) { return c.roles || []; }
        function contactoAsegurar(d, rol) { let c = contactoPorRut(d.rut); if (!c) { c = { id: CONTACTOS.length + 1, rut: d.rut, nombre: d.nombre, roles: [] }; CONTACTOS.push(c); } if (!c.roles.includes(rol)) c.roles.push(rol); return c; }
        let PLAN_CUENTAS = {};
        window.PLAN_CUENTAS = PLAN_CUENTAS;
        function guardarPlanCuentas() {}
        function parseMonto(v) { return Number(String(v).replace(/[^0-9-]/g, '')) || 0; }
        function audit() {}
    `, ctx);
    for (const f of ['js/core/datos-cliente.js', 'js/core/asientos.js', 'js/core/contabilidad.js',
                     'js/modules/inventario.js', 'js/modules/compras.js', 'js/modules/ventas.js',
                     'js/modules/remuneraciones.js', 'js/services/iva-resumen.js', 'js/core/conexiones.js']) {
        vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
    }
    vm.runInContext(`renderCompras = () => {}; renderVentas = () => {};`, ctx);
    return { ctx, store, run: code => vm.runInContext(code, ctx) };
}

const TRAB = (id, nombre, rut, sueldo) => ({
    id, nombre, rut, sueldoBruto: sueldo, afp: 'Habitat', sistemaSalud: 'Fonasa',
    tipoContrato: 'indefinido', diasTrabajados: 30, fechaIngreso: '2024-01-01',
});

// Liquida y envía al Diario dos trabajadores con el módulo real de Remuneraciones
function liquidarDos(run) {
    run(`remState.periodo = '2026-10';
         remState.trabajadores = [${JSON.stringify(TRAB('t1', 'Ana Soto', '12.345.678-5', 900000))},
                                  ${JSON.stringify(TRAB('t2', 'Luis Rojas', '13.456.789-K', 1200000))}];
         remEnviarAsiento('t1'); remEnviarAsiento('t2');`);
}

// ─────────────────────────────────────────────────────────────
console.log('\n══ P1 · Sueldos: devengo y pago desde la cartola ══');
{
    const { run } = crearEntorno();
    liquidarDos(run);
    const as = run(`dbAsientos.filter(a => a.origen === 'remuneraciones')`);
    check('el módulo real genera un asiento por trabajador', as.length === 2);
    check('el líquido queda en "Remuneraciones por pagar" (ya no directo a Banco)',
        as.every(a => a.movimientos.some(m => m.cuenta === 'Remuneraciones por pagar' && m.haber > 0) && !a.movimientos.some(m => m.cuenta === 'Banco')));
    check('los asientos de sueldo cuadran', as.every(a => Math.abs(a.total_debe - a.total_haber) < 1));
    check('guarda líquido, trabajador y período en el asiento', as.every(a => a.liquido > 0 && a.trabajador_nombre && a.periodo === '2026-10'));
    check('la cuenta se crea en el plan si no existía', !!run(`PLAN_CUENTAS['Remuneraciones por pagar']`));

    const liqAna = as.find(a => a.trabajador_nombre === 'Ana Soto').liquido;
    run(`_dbCartola.push({ id: 'mv1', fecha: '2026-11-02', descripcion: 'TRANSF ANA SOTO', cargo: ${liqAna}, abono: 0, banco: 'bci', estado: 'pendiente' })`);
    const sug = run(`conexCartolaSugerencias('mv1')`);
    check('un cargo por el líquido sugiere el sueldo de ese trabajador', sug[0] && sug[0].libro === 'remuneraciones' && /Ana Soto/.test(sug[0].etiqueta));
    const r = run(`conexCartolaAplicarDocumento('mv1', 'remuneraciones', ${JSON.stringify(sug[0].id)})`);
    check('al aceptar, el movimiento queda contra "Remuneraciones por pagar"', r.ok && run(`_dbCartola[0].cuenta_contrapartida`) === 'Remuneraciones por pagar');
    check('esa liquidación ya no aparece como pendiente', run(`conexRemuneracionesPorPagar().length`) === 1);

    run(`cartolasGenerarAsientos = undefined;`);
    run(`conexCartolaDesvincular('mv1')`);
    check('quitar el vínculo la devuelve a pendiente', run(`conexRemuneracionesPorPagar().length`) === 2);

    const total = as.reduce((t, a) => t + a.liquido, 0);
    run(`_dbCartola.push({ id: 'mv2', fecha: '2026-11-03', descripcion: 'PAGO REMUNERACIONES OCT', cargo: ${total}, abono: 0, banco: 'bci', estado: 'pendiente' })`);
    const sn = run(`conexCartolaSugerencias('mv2')`);
    check('una sola transferencia por la suma sugiere la nómina completa', sn[0] && sn[0].libro === 'nomina' && sn[0].id === '2026-10');
    run(`conexCartolaAplicarDocumento('mv2', 'nomina', '2026-10')`);
    check('la nómina deja pagadas todas las liquidaciones del período', run(`conexRemuneracionesPorPagar().length`) === 0);
}

console.log('\n══ P2 · Previred ↔ cartola ══');
{
    const { run } = crearEntorno();
    liquidarDos(run);
    const det = run(`conexPreviredDetalle('2026-10')`);
    check('suma AFP, salud, cesantía, SIS y mutual del período', det.total > 0 && det.lineas.some(l => /^AFP Habitat/.test(l.cuenta)) && det.lineas.some(l => /^Salud/.test(l.cuenta)));
    check('no incluye impuesto único ni el líquido', !det.lineas.some(l => /Impuesto|Remuneraciones por pagar/.test(l.cuenta)));
    run(`_dbCartola.push({ id: 'mv3', fecha: '2026-11-12', descripcion: 'PAGO PREVIRED', cargo: ${det.total}, abono: 0, banco: 'bci', cuenta_banco: 'Banco', estado: 'pendiente' })`);
    const s = run(`conexCartolaSugerencias('mv3')`);
    check('un cargo por ese total sugiere Previred', s[0] && s[0].libro === 'previred' && s[0].id === '2026-10');
    run(`conexCartolaAplicarDocumento('mv3', 'previred', '2026-10')`);
    const pv = run(`buscarAsientoPorOrigen('previred', '2026-10')`);
    check('registra el asiento: Debe cada cotización, Haber Banco', pv && pv.movimientos.find(m => m.cuenta === 'Banco').haber === det.total && Math.abs(pv.total_debe - pv.total_haber) < 1);
    check('el movimiento queda procesado (Generar asientos no lo repite)', run(`_dbCartola[0].estado`) === 'ignorado');
    check('Previred del período ya no aparece como pendiente', run(`conexPreviredPorPagar().length`) === 0);
    run(`conexCartolaDesvincular('mv3')`);
    check('quitar el vínculo anula el asiento de Previred', run(`buscarAsientoPorOrigen('previred', '2026-10')`) === null && run(`conexPreviredPorPagar().length`) === 1);
}

console.log('\n══ P3 · Boletas de honorarios recibidas → asiento y F29 ══');
{
    const { run } = crearEntorno();
    run(`dbDocumentos.push(
        { id: 1, categoria: 'honorarios', fecha: '15/10/2026', numero_doc: '88', rut: '15.000.000-1', nombre: 'Diseñadora Paz', neto: 1000000, iva: 0, total: 1000000, estado: 'pendiente' },
        { id: 2, categoria: 'honorarios', fecha: '16/10/2026', numero_doc: '89', rut: '16.000.000-2', nombre: 'Asesor Vera', total: 500000, estado: 'pendiente', sin_retencion: true })`);
    const r = run(`conexHonorarioContabilizar(1)`);
    const a = r.asiento;
    check('calcula retención de 15,25% y líquido', r.ok && r.retencion === 152500 && r.liquido === 847500);
    check('asiento: Debe Honorarios / Haber Retención y Honorarios por Pagar',
        a.movimientos.find(m => m.cuenta === 'Honorarios').debe === 1000000 &&
        a.movimientos.find(m => m.cuenta === 'Retención Honorarios por pagar').haber === 152500 &&
        a.movimientos.find(m => m.cuenta === 'Honorarios por Pagar').haber === 847500);
    const ret = run(`_ivaRetencionesPeriodo(recopilarMovimientosPorCuenta(), 10, 2026)`);
    check('el cálculo real del F29 toma la retención del período', ret.total === 152500 &&
        ret.detalle.some(d => d.cuenta === 'Retención Honorarios por pagar'));
    check('la boleta queda marcada como contabilizada', run('dbDocumentos[0].contabilizado') === true);
    check('el prestador queda en Contactos con rol prestador', run(`contactoPorRut('15.000.000-1')?.roles.includes('prestador')`) === true);
    run(`conexHonorarioContabilizar(1)`);
    check('contabilizar de nuevo no duplica', run(`dbAsientos.filter(a => a.origen === 'honorarios').length`) === 1);
    const r2 = run(`conexHonorarioContabilizar(2)`);
    check('boleta "sin retención": todo el bruto queda por pagar', r2.ok && r2.retencion === 0 && !r2.asiento.movimientos.some(m => /Retención/.test(m.cuenta)));
    run(`dbDocumentos[0].total = 1200000; conexDocSincronizar(1)`);
    check('editar la boleta actualiza el asiento', run(`buscarAsientoPorOrigen('honorarios', '1').total_debe`) === 1200000);
    run(`dbDocumentos[0].estado = 'anulada'; conexDocSincronizar(1)`);
    check('anular la boleta anula su asiento', run(`buscarAsientoPorOrigen('honorarios', '1')`) === null);
}

console.log('\n══ P4 · Pago de honorarios ↔ cartola ══');
{
    const { run } = crearEntorno();
    run(`dbDocumentos.push({ id: 5, categoria: 'honorarios', fecha: '15/10/2026', numero_doc: '90', rut: '15.000.000-1', nombre: 'Diseñadora Paz', total: 1000000, estado: 'pendiente' });
         conexHonorarioContabilizar(5);
         _dbCartola.push({ id: 'mv4', fecha: '2026-10-30', descripcion: 'TRANSF DISENADORA PAZ', cargo: 847500, abono: 0, banco: 'bci', estado: 'pendiente' });`);
    const s = run(`conexCartolaSugerencias('mv4')`);
    check('un cargo por el líquido sugiere la boleta', s[0] && s[0].libro === 'honorarios' && s[0].id === 5);
    run(`conexCartolaAplicarDocumento('mv4', 'honorarios', 5)`);
    check('el movimiento queda contra "Honorarios por Pagar" y la boleta pagada',
        run(`_dbCartola[0].cuenta_contrapartida`) === 'Honorarios por Pagar' && run('dbDocumentos[0].estado') === 'pagada');
    run(`conexCartolaDesvincular('mv4')`);
    check('quitar el vínculo devuelve la boleta a pendiente', run('dbDocumentos[0].estado') === 'pendiente');
}

console.log('\n══ P5 · Trabajador ↔ contacto ══');
{
    const { run } = crearEntorno();
    run(`CONTACTOS.push({ id: 9, rut: '12.345.678-5', nombre: 'Ana Soto', roles: ['prestador'] })`);
    const t = run(`(() => { const t = { id: 't1', rut: '12345678-5', nombre: 'Ana Soto' }; conexTrabajadorEnlazar(t); return t; })()`);
    check('si el RUT ya es contacto, se enlaza y suma el rol trabajador', t.contacto_id === 9 && run(`CONTACTOS[0].roles.includes('trabajador')`));
    const t2 = run(`(() => { const t = { id: 't2', rut: '99.999.999-9', nombre: 'Nuevo' }; conexTrabajadorEnlazar(t); return t; })()`);
    check('si no existe, no crea un contacto (un trabajador no es proveedor)', !t2.contacto_id && run('CONTACTOS.length') === 1);
    run(`localStorage.setItem('rem_trabajadores', JSON.stringify([{ id: 't1', rut: '12.345.678-5', nombre: 'Ana Soto' }]))`);
    const h = run(`conexHistorialPorRut('12345678-5')`);
    check('historial por RUT reúne contacto y ficha de trabajador', h.contacto && h.contacto.id === 9 && h.trabajador && h.trabajador.id === 't1');
}

console.log(`\nResultado: ${ok} OK, ${fallos} con error\n`);
process.exit(fallos ? 1 : 0);
