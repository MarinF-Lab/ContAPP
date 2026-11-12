'use strict';
// ─────────────────────────────────────────────────────────────
//  REGISTRO ÚNICO DE ASIENTOS — Fase 0 de conectividad
//
//  Todos los módulos que generan asientos automáticos (Compras, Ventas,
//  Remuneraciones, Activos fijos, Cartolas) los registran por aquí:
//    • Cada asiento guarda su ORIGEN (módulo) y su REFERENCIA (documento,
//      mes, trabajador+período, movimiento…).
//    • Si ya existe un asiento ACTIVO con el mismo origen+referencia, se
//      ACTUALIZA en vez de crear otro → reenviar no duplica.
//    • Valida que Debe = Haber antes de guardar.
//    • Numeración única con _nextNumeroAsiento() (helpers.js).
//    • Guarda en core_asientos y avisa con 'asiento:registrado' para que
//      Diario y Mayor se actualicen solos.
//
//  dbAsientos (app.js) es un `let` global: se resuelve en tiempo de
//  llamada, por eso este archivo puede cargarse antes que app.js.
// ─────────────────────────────────────────────────────────────

const ASIENTO_TOLERANCIA = 1; // pesos de diferencia aceptados por redondeo

function _asientosArr() {
    if (typeof dbAsientos !== 'undefined' && Array.isArray(dbAsientos)) return dbAsientos;
    if (Array.isArray(window.dbAsientos)) return window.dbAsientos;
    window.dbAsientos = JSON.parse(localStorage.getItem('core_asientos') || '[]');
    return window.dbAsientos;
}

function _asientosGuardar(arr) {
    localStorage.setItem('core_asientos', JSON.stringify(arr));
}

function _asientoNuevoId(arr) {
    let id = Date.now();
    const usados = new Set(arr.map(a => a.id));
    while (usados.has(id)) id++;
    return id;
}

/** Suma Debe y Haber de una lista de movimientos {cuenta, debe, haber}. */
function totalesMovimientos(movimientos) {
    return (movimientos || []).reduce((t, m) => {
        t.debe  += Number(m.debe)  || 0;
        t.haber += Number(m.haber) || 0;
        return t;
    }, { debe: 0, haber: 0 });
}

/** Busca el asiento ACTIVO de un origen+referencia. */
function buscarAsientoPorOrigen(origen, ref) {
    if (!origen || ref == null) return null;
    const r = String(ref);
    return _asientosArr().find(a => a.estado !== 'ANULADO' && a.origen === origen && String(a.origen_ref) === r) || null;
}

/**
 * Registra (o actualiza) un asiento automático.
 *
 * @param {Object} p
 * @param {string} p.origen        módulo: 'compras' | 'ventas' | 'remuneraciones' | 'finiquito' | 'activos_depreciacion' | 'cartola' | …
 * @param {string} p.ref           referencia única dentro del origen
 * @param {string} p.fecha         DD/MM/AAAA
 * @param {string} p.glosa
 * @param {Array}  p.movimientos   [{ cuenta, debe, haber, glosa? }]
 * @param {string} [p.tipo]        tipo que entiende el Diario (default 'diario')
 * @param {Object} [p.extra]       campos adicionales a guardar en el asiento
 * @param {Function} [p.buscarLegacy] predicado para encontrar asientos antiguos
 *                                 creados antes de que existiera `origen`
 * @param {boolean} [p.silencioso] no guardar ni avisar (para lotes)
 * @returns {{ok:boolean, error?:string, asiento?:Object, actualizado?:boolean}}
 */
function registrarAsiento(p) {
    const { origen, ref, fecha, glosa } = p || {};
    const movimientos = (p?.movimientos || []).filter(m => (Number(m.debe) || 0) > 0 || (Number(m.haber) || 0) > 0);

    if (!origen || ref == null || ref === '') return { ok: false, error: 'Falta el origen o la referencia del asiento.' };
    if (!fecha)                return { ok: false, error: 'Falta la fecha del asiento.' };
    if (!movimientos.length)   return { ok: false, error: 'El asiento no tiene movimientos con monto.' };
    if (movimientos.some(m => !m.cuenta)) return { ok: false, error: 'Hay movimientos sin cuenta.' };

    const t = totalesMovimientos(movimientos);
    if (Math.abs(t.debe - t.haber) > ASIENTO_TOLERANCIA) {
        return { ok: false, error: `El asiento no cuadra: Debe ${Math.round(t.debe)} ≠ Haber ${Math.round(t.haber)}.` };
    }

    const arr = _asientosArr();
    let existente = buscarAsientoPorOrigen(origen, ref);
    if (!existente && typeof p.buscarLegacy === 'function') {
        // Asientos antiguos: sin origen_ref (algunos ya traían `origen`, p.ej. cartola)
        existente = arr.find(a => a.estado !== 'ANULADO' && a.origen_ref == null &&
            (!a.origen || a.origen === origen) && p.buscarLegacy(a)) || null;
    }

    const campos = {
        fecha,
        glosa:       glosa || '',
        movimientos,
        total_debe:  t.debe,
        total_haber: t.haber,
        origen,
        origen_ref:  String(ref),
        tipo:        p.tipo || (existente && existente.tipo) || 'diario',
        ...(p.extra || {}),
    };

    let asiento, actualizado;
    if (existente) {
        asiento = Object.assign(existente, campos, { updated_at: Date.now() });
        actualizado = true;
    } else {
        asiento = {
            id:         _asientoNuevoId(arr),
            numero:     _nextNumeroAsiento(),
            estado:     'ACTIVO',
            created_at: Date.now(),
            ...campos,
        };
        arr.push(asiento);
        actualizado = false;
    }

    if (!p.silencioso) {
        _asientosGuardar(arr);
        ContappEventos.emitir('asiento:registrado', { asiento, actualizado, origen, ref: String(ref) });
    }
    return { ok: true, asiento, actualizado };
}

/** Guarda y avisa después de varios registrarAsiento({silencioso:true}). */
function confirmarLoteAsientos(origen, asientos) {
    _asientosGuardar(_asientosArr());
    ContappEventos.emitir('asiento:registrado', { lote: true, origen, asientos: asientos || [] });
}

/**
 * Anula los asientos activos de un origen (y referencia, si se indica).
 * Se usa cuando se elimina el documento que los originó.
 * @returns {number} cantidad anulada
 */
function anularAsientosPorOrigen(origen, ref, motivo) {
    const r = ref == null ? null : String(ref);
    const afectados = _asientosArr().filter(a =>
        a.estado !== 'ANULADO' && a.origen === origen && (r === null || String(a.origen_ref) === r));
    afectados.forEach(a => {
        a.estado = 'ANULADO';
        a.anulado_motivo = motivo || 'Documento de origen eliminado';
        a.anulado_at = Date.now();
    });
    if (afectados.length) {
        _asientosGuardar(_asientosArr());
        ContappEventos.emitir('asiento:anulado', { asientos: afectados, origen, ref: r });
    }
    return afectados.length;
}

// Un solo lugar refresca las vistas contables cuando cambia un asiento.
function _asientosRefrescarVistas() {
    if (typeof renderHistorialDiario === 'function') renderHistorialDiario();
    if (typeof generarLibroMayor     === 'function') generarLibroMayor();
}
ContappEventos.escuchar('asiento:registrado', _asientosRefrescarVistas);
ContappEventos.escuchar('asiento:anulado',    _asientosRefrescarVistas);

window.registrarAsiento        = registrarAsiento;
window.confirmarLoteAsientos   = confirmarLoteAsientos;
window.anularAsientosPorOrigen = anularAsientosPorOrigen;
window.buscarAsientoPorOrigen  = buscarAsientoPorOrigen;
window.totalesMovimientos      = totalesMovimientos;
