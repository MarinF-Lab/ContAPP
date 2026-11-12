#!/usr/bin/env node
/**
 * verificar.js — Verificación estática del Sprint activo
 * Uso: node PLANIFICACION/verificar.js
 *
 * Comprueba que las funciones declaradas en el plan existen realmente
 * en el código fuente. No reemplaza las pruebas de browser, pero atrapa
 * el error más común: marcar como completo sin implementar.
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let errores = 0;
let ok = 0;

function leer(rel) {
    const full = path.join(ROOT, rel);
    if (!fs.existsSync(full)) return '';
    return fs.readFileSync(full, 'utf8');
}

function check(descripcion, condicion) {
    if (condicion) {
        console.log(`  ✅ ${descripcion}`);
        ok++;
    } else {
        console.log(`  ❌ ${descripcion}`);
        errores++;
    }
}

function tieneFunc(archivo, nombreFuncion) {
    const codigo = leer(archivo);
    // Acepta: function foo(, foo = function(, foo = (, foo: function(
    const patron = new RegExp(`function\\s+${nombreFuncion}\\s*\\(|${nombreFuncion}\\s*[=:]\\s*(async\\s*)?function|${nombreFuncion}\\s*[=:]\\s*(async\\s*)?\\(`);
    return patron.test(codigo);
}

function tieneContenido(archivo, minLineas = 30) {
    const codigo = leer(archivo);
    const lineas = codigo.split('\n').filter(l => l.trim() && !l.trim().startsWith('//')).length;
    return lineas >= minLineas;
}

function tieneString(archivo, texto) {
    return leer(archivo).includes(texto);
}

// ─────────────────────────────────────────────────────────────
console.log('\n══ SPRINT 1 — Inventario y Activos (Centros de Costo / Bodegas / Movimientos / Activos Fijos / Productos) ══');

check('centros-costo.js tiene contenido real (≥20 líneas de código)',
    tieneContenido('js/modules/centros-costo.js', 20));

check('renderCentrosCosto() está implementada',
    tieneFunc('js/modules/centros-costo.js', 'renderCentrosCosto'));

check('bodegas.js tiene contenido real (≥20 líneas de código)',
    tieneContenido('js/modules/bodegas.js', 20));

check('renderBodegas() está implementada',
    tieneFunc('js/modules/bodegas.js', 'renderBodegas'));

check('inventario.js tiene contenido real (≥20 líneas de código)',
    tieneContenido('js/modules/inventario.js', 20));

check('renderMovimientosInventario() está implementada',
    tieneFunc('js/modules/inventario.js', 'renderMovimientosInventario'));

check('index.html tiene la sección fusionada de Inventario y Activos',
    tieneString('index.html', 'view-inventario-activos') &&
    tieneString('index.html', 'tab-ap-activos') &&
    tieneString('index.html', 'tab-ap-productos'));

check('la calculadora del Diario registra movimientos de inventario',
    tieneString('js/services/diario.js', 'registrarMovimientoInventario') ||
    tieneString('js/services/diario.js', 'invRegistrarMovimiento'));

// ─────────────────────────────────────────────────────────────
console.log('\n══ SPRINT 2 — UX ══');

check('diario.js no tiene alert() sueltos',
    !/(return\s+alert\(|^\s*alert\()/m.test(leer('js/services/diario.js')));

check('plan-cuentas.js no tiene alert() sueltos',
    !/(return\s+alert\(|^\s*alert\()/m.test(leer('js/core/plan-cuentas.js')));

check('mayor.js muestra glosa (campo glosa en el render)',
    tieneString('js/services/mayor.js', 'glosa'));

check('mayor.js tiene filtro por cuenta o período',
    tieneString('js/services/mayor.js', 'selMayorCuenta') ||
    tieneString('js/services/mayor.js', 'filtro') ||
    tieneString('js/services/mayor.js', 'periodo'));

// ─────────────────────────────────────────────────────────────
console.log('\n══ SPRINT 3 — Módulos ══');

check('documentos.js tiene _docEditandoId',
    tieneString('js/modules/documentos.js', '_docEditandoId'));

check('documentos.js tiene editarDocumento()',
    tieneFunc('js/modules/documentos.js', 'editarDocumento'));

check('cartolas.js llama guardarCartolas() al clasificar',
    tieneString('js/modules/cartolas.js', 'guardarCartolas'));

// ─────────────────────────────────────────────────────────────
console.log('\n══ SPRINT 4 — Reportes ══');

check('balance.js tiene estado vacío (empty-state o Sin movimientos)',
    tieneString('js/services/balance.js', 'empty-state') ||
    tieneString('js/services/balance.js', 'Sin movimientos'));

check('iva-resumen.js calcula el IVA desde el Libro Mayor (recopilarMovimientosPorCuenta)',
    tieneString('js/services/iva-resumen.js', 'recopilarMovimientosPorCuenta'));

check('activos.js tiene periodos_depreciados',
    tieneString('js/modules/activos.js', 'periodos_depreciados'));

// ─────────────────────────────────────────────────────────────
console.log('\n══ SPRINT 5 — Integraciones ══');

check('reconciliacion.js tiene selector de cuenta bancaria',
    tieneString('js/services/reconciliacion.js', 'recCuentaBanco') ||
    tieneString('js/services/reconciliacion.js', 'cuentaBanco'));

check('helpers.js tiene logger condicional (const log o const DEBUG)',
    tieneString('js/core/helpers.js', 'const log') ||
    tieneString('js/core/helpers.js', 'const DEBUG'));

// ─────────────────────────────────────────────────────────────
console.log('\n══ FASE 0 — Conectividad entre módulos (ver CONECTIVIDAD.md) ══');

check('datos-cliente.js define la lista única de datos por cliente',
    tieneString('js/core/datos-cliente.js', 'DATOS_CLIENTE_DOCS'));

for (const k of ['core_activos', 'core_cartola_movs', 'core_inventario_movimientos', 'hon_boletas', 'doc_pagar']) {
    check(`"${k}" se sincroniza por cliente`, tieneString('js/core/datos-cliente.js', `'${k}'`));
}

check('firebase-service.js usa la lista única (no una lista propia)',
    tieneString('js/services/firebase-service.js', 'DATOS_CLIENTE_KEYS'));

check('seleccionarEmpresa() suelta los datos del cliente anterior',
    tieneFunc('js/services/firebase-service.js', '_fbSoltarDatosDeOtroCliente') &&
    tieneString('js/services/firebase-service.js', 'await _fbSoltarDatosDeOtroCliente(empresaId)'));

check('respaldo del cliente: exportar e importar',
    tieneFunc('js/core/datos-cliente.js', 'exportarRespaldoCliente') &&
    tieneFunc('js/core/datos-cliente.js', 'importarRespaldoCliente'));

check('registro único de asientos implementado',
    tieneFunc('js/core/asientos.js', 'registrarAsiento') &&
    tieneFunc('js/core/asientos.js', 'anularAsientosPorOrigen'));

for (const m of ['compras', 'ventas', 'remuneraciones', 'activos', 'cartolas']) {
    check(`${m}.js registra sus asientos por registrarAsiento()`,
        tieneString(`js/modules/${m}.js`, 'registrarAsiento('));
}

check('ningún módulo escribe core_asientos directo',
    ['compras', 'ventas', 'remuneraciones', 'activos', 'cartolas']
        .every(m => !tieneString(`js/modules/${m}.js`, "setItem('core_asientos'")));

check('contactos únicos por RUT (contactoAsegurar)',
    tieneFunc('js/modules/clientes.js', 'contactoAsegurar'));

check('prestadores enlazados con Contactos',
    tieneString('js/modules/segunda-categoria.js', "contactoAsegurar("));

check('index.html carga datos-cliente.js y asientos.js antes de los módulos',
    (() => {
        const html = leer('index.html');
        const iD = html.indexOf('js/core/datos-cliente.js'), iA = html.indexOf('js/core/asientos.js');
        const iM = html.indexOf('js/modules/compras.js');
        return iD > 0 && iA > 0 && iD < iM && iA < iM;
    })());

// ─────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(50));
console.log(`Resultado: ${ok} ✅  |  ${errores} ❌`);

if (errores > 0) {
    console.log('\n⚠️  HAY TAREAS MARCADAS COMO COMPLETADAS QUE NO LO ESTÁN.');
    console.log('   Revisa los ❌ antes de continuar con el siguiente sprint.\n');
    process.exit(1);
} else {
    console.log('\n🎉 Todo verificado correctamente.\n');
    process.exit(0);
}
