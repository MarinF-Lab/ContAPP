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

check('iva-resumen.js distingue nota_credito al calcular',
    tieneString('js/services/iva-resumen.js', 'nota_credito'));

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
