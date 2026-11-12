#!/usr/bin/env node
/**
 * test-fase0.js — Pruebas de la Fase 0 de conectividad (sin navegador)
 * Uso: node PLANIFICACION/test-fase0.js
 *
 * Carga js/core/datos-cliente.js y js/core/asientos.js en un entorno simulado
 * (localStorage, document, mostrarToast) y comprueba:
 *   - registrarAsiento(): no duplica, valida Debe=Haber, reconoce asientos antiguos
 *   - anularAsientosPorOrigen()
 *   - migración de datos huérfanos y su asignación a un cliente
 *   - respaldo: armar y validar
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

function crearEntorno(storageInicial = {}) {
    const store = { ...storageInicial };
    const localStorage = {
        getItem: k => (k in store ? store[k] : null),
        setItem: (k, v) => { store[k] = String(v); },
        removeItem: k => { delete store[k]; },
    };
    const listeners = {};
    const document = {
        addEventListener: (n, fn) => { (listeners[n] = listeners[n] || []).push(fn); },
        removeEventListener: (n, fn) => { listeners[n] = (listeners[n] || []).filter(f => f !== fn); },
        dispatchEvent: ev => { (listeners[ev.type] || []).forEach(fn => fn(ev)); return true; },
    };
    class CustomEvent { constructor(type, init) { this.type = type; this.detail = init?.detail; } }
    const ctx = {
        console, localStorage, document, CustomEvent, TextEncoder, JSON, Math, Date, Set, Array, Object, String, Number,
        mostrarToast: () => {}, mostrarConfirm: (m, fn) => { ctx._ultimoConfirm = { m, fn }; },
        setTimeout: fn => fn(),
        window: null, currentUser: null,
    };
    ctx.window = ctx;
    vm.createContext(ctx);
    // Mismo _nextNumeroAsiento que helpers.js
    vm.runInContext(`
        let dbAsientos = JSON.parse(localStorage.getItem('core_asientos') || '[]');
        window.dbAsientos = dbAsientos;
        function _nextNumeroAsiento() {
            const nums = (dbAsientos || []).map(a => a.numero).filter(n => typeof n === 'number' && isFinite(n));
            return nums.length ? Math.max(...nums) + 1 : 1;
        }`, ctx);
    for (const f of ['js/core/datos-cliente.js', 'js/core/asientos.js']) {
        vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
    }
    return { ctx, store };
}

const mov = (debe, haber) => [
    { cuenta: 'Gasto Remuneraciones', debe, haber: 0 },
    { cuenta: 'Banco', debe: 0, haber },
];

// ─────────────────────────────────────────────────────────────
console.log('\n══ Registro único de asientos ══');
{
    const { ctx, store } = crearEntorno();
    const r = vm.runInContext('registrarAsiento', ctx);
    const base = { origen: 'remuneraciones', ref: '7|2026-10', fecha: '31/10/2026', glosa: 'Sueldo', movimientos: mov(1000, 1000) };

    const a1 = r(base);
    check('crea el asiento', a1.ok && !a1.actualizado && a1.asiento.numero === 1);
    const a2 = r({ ...base, movimientos: mov(1500, 1500) });
    const arr = JSON.parse(store.core_asientos);
    check('reenviar la misma liquidación NO duplica', arr.length === 1);
    check('reenviar actualiza el monto y conserva el número', a2.actualizado && arr[0].total_debe === 1500 && arr[0].numero === 1);

    const a3 = r({ ...base, ref: '8|2026-10' });
    check('otra referencia crea otro asiento con número siguiente', a3.ok && a3.asiento.numero === 2);

    const malo = r({ ...base, ref: 'x', movimientos: mov(1000, 900) });
    check('rechaza un asiento descuadrado', !malo.ok && /no cuadra/.test(malo.error));
    check('el asiento descuadrado no se guardó', JSON.parse(store.core_asientos).length === 2);

    const sinRef = r({ ...base, ref: '' });
    check('rechaza un asiento sin referencia', !sinRef.ok);

    let avisos = 0;
    vm.runInContext('ContappEventos', ctx).escuchar('asiento:registrado', () => avisos++);
    r({ ...base, ref: '9|2026-10' });
    check('avisa "asiento:registrado"', avisos === 1);

    const n = vm.runInContext('anularAsientosPorOrigen', ctx)('remuneraciones', '7|2026-10');
    const tras = JSON.parse(store.core_asientos);
    check('anula por origen + referencia', n === 1 && tras.find(a => a.origen_ref === '7|2026-10').estado === 'ANULADO');
    const reAlta = r(base);
    check('tras anular, registrar de nuevo crea uno nuevo', reAlta.ok && !reAlta.actualizado);
}

console.log('\n══ Asientos antiguos (sin origen) ══');
{
    const legacy = [{ id: 1, numero: 5, estado: 'ACTIVO', fecha: '31/10/2026', glosa: 'Centralización Compras Octubre 2026 — 3 doc(s)', movimientos: mov(10, 10) }];
    const { ctx, store } = crearEntorno({ core_asientos: JSON.stringify(legacy) });
    const res = vm.runInContext('registrarAsiento', ctx)({
        origen: 'compras', ref: '2026-10', fecha: '31/10/2026', glosa: 'Centralización Compras Octubre 2026 — 4 doc(s)',
        movimientos: mov(20, 20), buscarLegacy: a => a.glosa.startsWith('Centralización Compras Octubre 2026'),
    });
    const arr = JSON.parse(store.core_asientos);
    check('reconoce el asiento antiguo y lo actualiza', res.actualizado && arr.length === 1 && arr[0].numero === 5);
    check('el asiento antiguo queda con origen y referencia', arr[0].origen === 'compras' && arr[0].origen_ref === '2026-10');

    const cart = [{ id: 2, numero: 6, estado: 'ACTIVO', origen: 'cartola', ref_mv: 'mv1', fecha: '01/10/2026', movimientos: mov(5, 5) }];
    const e2 = crearEntorno({ core_asientos: JSON.stringify(cart) });
    const res2 = vm.runInContext('registrarAsiento', e2.ctx)({
        origen: 'cartola', ref: 'mv1', fecha: '01/10/2026', glosa: 'x', movimientos: mov(5, 5), buscarLegacy: a => a.ref_mv === 'mv1',
    });
    check('reconoce asientos de cartola antiguos (con origen pero sin referencia)', res2.actualizado && JSON.parse(e2.store.core_asientos).length === 1);
}

console.log('\n══ Datos por cliente: migración de huérfanos ══');
{
    const { ctx, store } = crearEntorno({
        core_asientos: '[{"id":1}]',                              // clave antigua: no se toca
        core_activos:  '[{"id":10,"nombre":"Notebook"}]',          // clave nueva: se aparta
        hon_boletas:   '[{"id":20},{"id":21}]',
        core_bodegas:  '[]',                                       // vacía: solo se borra
    });
    check('las claves nuevas se apartan del navegador', store.core_activos === undefined && store.hon_boletas === undefined);
    check('las claves antiguas no se tocan', store.core_asientos === '[{"id":1}]');
    check('queda la marca de migración hecha', !!store.core_migracion_aislamiento_v1);
    const h = JSON.parse(store.core_respaldo_sin_cliente);
    check('el respaldo guarda los datos apartados', !!h.datos.core_activos && !!h.datos.hon_boletas && !h.datos.core_bodegas);

    ctx.currentUser = { empresaId: 'A', empresaNombre: 'Cliente A' };
    vm.runInContext('datosClienteOfrecerHuerfanos()', ctx);
    check('pregunta si se asignan al cliente abierto', ctx._ultimoConfirm && /Cliente A/.test(ctx._ultimoConfirm.m));
    ctx._ultimoConfirm = null;
    vm.runInContext('datosClienteOfrecerHuerfanos()', ctx);
    check('no vuelve a preguntar al mismo cliente', ctx._ultimoConfirm === null);

    store.core_activos = '[{"id":11,"nombre":"Camioneta"}]';   // el cliente B ya trae un activo
    ctx.currentUser = { empresaId: 'B', empresaNombre: 'Cliente B' };
    vm.runInContext('datosClienteOfrecerHuerfanos()', ctx);
    ctx._ultimoConfirm.fn();
    const act = JSON.parse(store.core_activos);
    check('al aceptar, une los datos sin perder los del cliente', act.length === 2);
    check('el respaldo de huérfanos se elimina', store.core_respaldo_sin_cliente === undefined);
}

console.log('\n══ Apartar datos que no se pudieron subir ══');
{
    const { ctx, store } = crearEntorno({ core_migracion_aislamiento_v1: 'x', core_asientos: '[{"id":1}]', core_activos: '[{"id":3}]' });
    const r = vm.runInContext("datosClienteApartarComoHuerfanos('local')", ctx);
    vm.runInContext('datosClienteLimpiar()', ctx);
    const h = JSON.parse(store.core_respaldo_sin_cliente);
    check('aparta todas las claves con datos', r && !!h.datos.core_asientos && !!h.datos.core_activos);
    check('limpiar borra todas las claves del cliente', store.core_asientos === undefined && store.core_activos === undefined);
}

console.log('\n══ Respaldo del cliente ══');
{
    const { ctx } = crearEntorno({ core_migracion_aislamiento_v1: 'x', core_asientos: '[{"id":1}]', hon_ppm: '[{"id":2}]', otra_cosa: '1' });
    const resp = vm.runInContext('datosClienteArmarRespaldo()', ctx);
    check('incluye claves de cliente', Array.isArray(resp.datos.core_asientos) && Array.isArray(resp.datos.hon_ppm));
    check('excluye claves ajenas', !('otra_cosa' in resp.datos));
    const v = vm.runInContext('(o) => datosClienteValidarRespaldo(o)', ctx)(JSON.parse(JSON.stringify(resp)));
    check('un respaldo válido pasa la validación', v.ok);
    const malo = vm.runInContext('(o) => datosClienteValidarRespaldo(o)', ctx)({ formato: 'otro' });
    check('un archivo ajeno se rechaza', !malo.ok);
    const lista = vm.runInContext('DATOS_CLIENTE_KEYS', ctx);
    check('la lista de datos por cliente tiene 23 claves', lista.length === 23);
}

console.log(`\nResultado: ${ok} OK, ${fallos} con error\n`);
process.exit(fallos ? 1 : 0);
