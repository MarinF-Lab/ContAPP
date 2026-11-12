'use strict';
// ─────────────────────────────────────────────────────────────
//  CIERRE Y TRAZABILIDAD — Fase 3 de conectividad (ver PLANIFICACION/CONECTIVIDAD.md)
//
//  1. Checklist de cierre del mes por cliente (se calcula solo, con los
//     enlaces de las Fases 0-2: origen de asientos, documentos, pagos).
//  2. Resumen del checklist en la ficha del cliente en Firebase
//     (empresas/{id}.cierreResumen.{AAAA-MM}) para que el panel del estudio
//     muestre el avance de TODOS los clientes, no solo del abierto.
//  3. Cierre del período: marcar un mes como cerrado. Si después se modifica
//     algo de ese mes, la app AVISA (no bloquea) y lo deja registrado.
//  4. Trazabilidad: desde un asiento ir a su documento de origen.
//
//  Se carga después de conexiones.js.
// ─────────────────────────────────────────────────────────────

const CIERRES_KEY = 'core_cierres';
const CI_MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// ── Utilidades ────────────────────────────────────────────────
function ciPeriodoDe(fecha) {
    const s = String(fecha || '');
    let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);          // DD/MM/AAAA
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}`;
    m = s.match(/^(\d{4})-(\d{2})/);                            // AAAA-MM-DD
    return m ? `${m[1]}-${m[2]}` : '';
}
function ciEtiquetaPeriodo(p) {
    const [y, m] = String(p || '').split('-');
    return CI_MESES[parseInt(m, 10) - 1] ? `${CI_MESES[parseInt(m, 10) - 1]} ${y}` : String(p || '');
}
function ciPeriodoActual() {
    const pt = typeof periodoTrabajo === 'function' ? periodoTrabajo() : null;
    const d = new Date();
    const anio = (pt && pt.anio) || d.getFullYear();
    const mes  = (pt && pt.mes)  || d.getMonth() + 1;
    return `${anio}-${String(mes).padStart(2, '0')}`;
}
function _ciArr(nombre) {
    try {
        switch (nombre) {
            case 'compras':    return typeof dbCompras    !== 'undefined' ? dbCompras    : [];
            case 'ventas':     return typeof dbVentas     !== 'undefined' ? dbVentas     : [];
            case 'documentos': return typeof dbDocumentos !== 'undefined' ? dbDocumentos : [];
            case 'cartola':    return typeof _dbCartola   !== 'undefined' ? _dbCartola   : [];
            case 'asientos':   return typeof dbAsientos   !== 'undefined' ? dbAsientos   : [];
        }
    } catch (e) { /* ignorar */ }
    return [];
}
function _ciLS(key) {
    try { return JSON.parse(localStorage.getItem(key) || '[]') || []; } catch (e) { return []; }
}

/** Firma de un conjunto de documentos del libro: cambia si se agrega, quita o edita un monto. */
function cierreFirmaLibro(registros) {
    const regs = (registros || []).filter(r => r.estado !== 'anulada');
    const total = regs.reduce((t, r) => t + Math.round(Number(r.total) || 0), 0);
    return `${regs.length}|${total}`;
}

// ═════════════════════════════════════════════════════════════
//  CIERRES (estado por período)
// ═════════════════════════════════════════════════════════════
function cierresGet() {
    try { return JSON.parse(localStorage.getItem(CIERRES_KEY) || '{}') || {}; } catch (e) { return {}; }
}
function _cierresSave(obj) { localStorage.setItem(CIERRES_KEY, JSON.stringify(obj)); }

function cierreEstaCerrado(p) {
    const c = cierresGet()[p];
    return !!(c && c.cerrado);
}

/** Marca el período como cerrado (con lo que falte, si el contador decide cerrar igual). */
function cierreCerrarPeriodo(p) {
    p = p || ciPeriodoActual();
    const chk = cierreChecklist(p);
    const todos = cierresGet();
    todos[p] = {
        ...(todos[p] || {}),
        cerrado: true,
        fecha_cierre: new Date().toISOString(),
        por: window.currentUser?.email || '',
        avance_al_cerrar: chk.avance,
        pendientes_al_cerrar: chk.items.filter(i => i.estado === 'pendiente').map(i => i.label),
        modificaciones: 0,
        ultima_modificacion: null,
    };
    _cierresSave(todos);
    ContappEventos.emitir('cierre:cambiado', { periodo: p, cerrado: true });
    return todos[p];
}

function cierreReabrirPeriodo(p) {
    p = p || ciPeriodoActual();
    const todos = cierresGet();
    if (!todos[p]) return null;
    todos[p] = { ...todos[p], cerrado: false, reabierto: new Date().toISOString(), reabierto_por: window.currentUser?.email || '' };
    _cierresSave(todos);
    ContappEventos.emitir('cierre:cambiado', { periodo: p, cerrado: false });
    return todos[p];
}

// Un aviso por período cada pocos segundos (un lote de asientos no repite el toast)
const _ciUltimoAviso = {};

/**
 * Si la fecha cae en un período cerrado: avisa (no bloquea) y registra la
 * modificación. Devuelve true si el período estaba cerrado.
 */
function cierreAvisarSiCerrado(fecha, contexto) {
    const p = ciPeriodoDe(fecha);
    if (!p || !cierreEstaCerrado(p)) return false;
    const todos = cierresGet();
    todos[p].modificaciones = (todos[p].modificaciones || 0) + 1;
    todos[p].ultima_modificacion = { fecha: new Date().toISOString(), contexto: contexto || '', por: window.currentUser?.email || '' };
    _cierresSave(todos);
    const ahora = Date.now();
    if (!_ciUltimoAviso[p] || ahora - _ciUltimoAviso[p] > 4000) {
        _ciUltimoAviso[p] = ahora;
        if (typeof mostrarToast === 'function') {
            mostrarToast(`⚠️ ${ciEtiquetaPeriodo(p)} está cerrado. El cambio${contexto ? ' en ' + contexto : ''} se guardó, pero modifica un período ya cerrado.`, 'info');
        }
    }
    return true;
}

// ═════════════════════════════════════════════════════════════
//  CHECKLIST DE CIERRE
// ═════════════════════════════════════════════════════════════
function _ciItem(id, label, estado, detalle, ir) { return { id, label, estado, detalle: detalle || '', ir: ir || '' }; }
const _ciActivo = a => a && a.estado !== 'ANULADO';
const _ciFmt = n => '$' + Math.round(Number(n) || 0).toLocaleString('es-CL');

function _ciItemLibro(libro, p) {
    const etiqueta = libro === 'compras' ? 'Compras' : 'Ventas';
    const regs = _ciArr(libro).filter(r => r.estado !== 'anulada' && ciPeriodoDe(r.fecha) === p);
    const id = 'centralizar-' + libro;
    const label = `${etiqueta} del mes centralizadas`;
    if (!regs.length) return _ciItem(id, label, 'na', `Sin ${etiqueta.toLowerCase()} en el mes`, libro);
    const [y, m] = p.split('-');
    const glosaBase = `Centralización ${etiqueta} ${CI_MESES[parseInt(m, 10) - 1]} ${y}`;
    const as = buscarAsientoPorOrigen(libro, p) ||
        _ciArr('asientos').find(a => _ciActivo(a) && a.glosa && a.glosa.startsWith(glosaBase)) || null;
    if (!as) return _ciItem(id, label, 'pendiente', `${regs.length} documento(s) sin centralizar`, libro);
    if (as.firma && as.firma !== cierreFirmaLibro(regs)) {
        return _ciItem(id, label, 'pendiente', 'Hay cambios después de centralizar: vuelve a generar el asiento', libro);
    }
    return _ciItem(id, label, 'ok', `Asiento N°${as.numero} · ${regs.length} documento(s)`, libro);
}

function _ciItemDocumentos(p) {
    const docs = _ciArr('documentos').filter(d => d.estado !== 'anulada' && ciPeriodoDe(d.fecha) === p);
    const label = 'Documentos registrados en libros';
    if (!docs.length) return _ciItem('documentos', label, 'na', 'Sin documentos en el mes', 'documentos');
    const sinLibro = docs.filter(d => d.categoria !== 'honorarios' && typeof conexDocDestino === 'function' && conexDocDestino(d) && !d.libro_id);
    const sinCont  = docs.filter(d => d.categoria === 'honorarios' && !d.contabilizado);
    const partes = [];
    if (sinLibro.length) partes.push(`${sinLibro.length} factura(s) sin pasar al libro`);
    if (sinCont.length)  partes.push(`${sinCont.length} boleta(s) de honorarios sin contabilizar`);
    return partes.length
        ? _ciItem('documentos', label, 'pendiente', partes.join(' · '), 'documentos')
        : _ciItem('documentos', label, 'ok', `${docs.length} documento(s) al día`, 'documentos');
}

function _ciItemCartola(p) {
    const movs = _ciArr('cartola').filter(mv => ciPeriodoDe(mv.fecha) === p);
    const label = 'Cartola importada y contabilizada';
    if (!movs.length) return _ciItem('cartola', label, 'pendiente', 'No hay cartola importada para el mes', 'cartolas');
    const sinClasificar = movs.filter(mv => mv.estado === 'pendiente').length;
    const sinAsiento    = movs.filter(mv => mv.estado === 'clasificado').length;
    const partes = [];
    if (sinClasificar) partes.push(`${sinClasificar} movimiento(s) sin clasificar`);
    if (sinAsiento)    partes.push(`${sinAsiento} clasificado(s) sin asiento (usa "Generar asientos")`);
    return partes.length
        ? _ciItem('cartola', label, 'pendiente', partes.join(' · '), 'cartolas')
        : _ciItem('cartola', label, 'ok', `${movs.length} movimiento(s) procesados`, 'cartolas');
}

function _ciItemConciliacion(p) {
    const label = 'Conciliación bancaria cuadrada';
    const e = typeof recEstadoPeriodo === 'function' ? recEstadoPeriodo(p) : null;
    if (!e) return _ciItem('conciliacion', label, 'pendiente', 'Concilia el banco de este mes', 'reconciliacion');
    if (e.diferencia == null) return _ciItem('conciliacion', label, 'pendiente', 'Falta el saldo final del extracto', 'reconciliacion');
    if (Math.abs(e.diferencia) >= 1) return _ciItem('conciliacion', label, 'pendiente', `Diferencia de ${_ciFmt(e.diferencia)}`, 'reconciliacion');
    if (e.pendientes > 0) return _ciItem('conciliacion', label, 'pendiente', `${e.pendientes} movimiento(s) del banco sin conciliar`, 'reconciliacion');
    return _ciItem('conciliacion', label, 'ok', 'Saldo del banco = saldo de libros', 'reconciliacion');
}

function _ciTrabajadoresActivos(p) {
    const [y, m] = p.split('-').map(Number);
    const ini = `${p}-01`;
    const fin = `${p}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
    return _ciLS('rem_trabajadores').filter(t =>
        (!t.fechaIngreso || t.fechaIngreso <= fin) && (!t.fechaTermino || t.fechaTermino >= ini));
}

function _ciItemSueldos(p) {
    const label = 'Sueldos enviados al Libro Diario';
    const activos = _ciTrabajadoresActivos(p);
    if (!activos.length) return _ciItem('sueldos', label, 'na', 'Sin trabajadores en el mes', 'remuneraciones');
    const enviados = new Set(_ciArr('asientos')
        .filter(a => _ciActivo(a) && a.origen === 'remuneraciones' && a.periodo === p)
        .map(a => String(a.trabajador_id)));
    const faltan = activos.filter(t => !enviados.has(String(t.id)));
    return faltan.length
        ? _ciItem('sueldos', label, 'pendiente', `Faltan ${faltan.length} de ${activos.length}: ${faltan.slice(0, 3).map(t => t.nombre).join(', ')}${faltan.length > 3 ? '…' : ''}`, 'remuneraciones')
        : _ciItem('sueldos', label, 'ok', `${activos.length} trabajador(es)`, 'remuneraciones');
}

function _ciItemPrevired(p) {
    const label = 'Cotizaciones Previred pagadas';
    const hay = _ciArr('asientos').some(a => _ciActivo(a) && a.origen === 'remuneraciones' && a.periodo === p);
    if (!hay) return _ciItem('previred', label, 'na', 'Sin sueldos contabilizados en el mes', 'cartolas');
    const pv = buscarAsientoPorOrigen('previred', p);
    if (pv) return _ciItem('previred', label, 'ok', `Asiento N°${pv.numero}`, 'cartolas');
    const det = typeof conexPreviredDetalle === 'function' ? conexPreviredDetalle(p) : { total: 0 };
    return _ciItem('previred', label, 'pendiente', det.total ? `Pagar ${_ciFmt(det.total)} y conciliarlo en Cartolas` : 'Registra el pago desde Cartolas', 'cartolas');
}

function _ciItemDepreciacion(p) {
    const label = 'Depreciación del mes generada';
    if (typeof getActivos !== 'function') return _ciItem('depreciacion', label, 'na', '', 'activos');
    const [y, m] = p.split('-').map(Number);
    const deprec = getActivos().filter(a => a.activo !== false &&
        (typeof _calcDepMes === 'function' ? _calcDepMes(a, y, m - 1) > 0 : false));
    if (!deprec.length) return _ciItem('depreciacion', label, 'na', 'Sin activos que depreciar en el mes', 'activos');
    const faltan = deprec.filter(a => !(a.periodos_depreciados || []).includes(p));
    return faltan.length
        ? _ciItem('depreciacion', label, 'pendiente', `${faltan.length} activo(s) sin depreciar`, 'activos')
        : _ciItem('depreciacion', label, 'ok', `${deprec.length} activo(s)`, 'activos');
}

function _ciItemF29(p) {
    const label = 'F29 calculado y registrado';
    const [y, m] = p.split('-');
    const sufijo = `${CI_MESES[parseInt(m, 10) - 1]} ${y}`;
    const as = _ciArr('asientos').find(a => _ciActivo(a) && a.glosa &&
        (a.glosa.startsWith('Pago F29 IVA ' + sufijo) || a.glosa.startsWith('Cierre F29 IVA (remanente a favor) ' + sufijo)));
    return as
        ? _ciItem('f29', label, 'ok', `Asiento N°${as.numero}`, 'iva-resumen')
        : _ciItem('f29', label, 'pendiente', 'Calcula el F29 y registra su asiento en Resumen IVA', 'iva-resumen');
}

function _ciItemBalance(p) {
    const label = 'Balance cuadrado';
    const [y, m] = p.split('-').map(Number);
    const finOrd = `${p}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
    const asientos = _ciArr('asientos').filter(a => {
        if (!_ciActivo(a)) return false;
        const pp = ciPeriodoDe(a.fecha);
        return pp && `${pp}-01` <= finOrd;
    });
    if (!asientos.length) return _ciItem('balance', label, 'pendiente', 'No hay asientos hasta este mes', 'balance');
    let debe = 0, haber = 0;
    const descuadrados = asientos.filter(a => {
        const t = (a.movimientos || []).reduce((s, x) => { s.d += Number(x.debe) || 0; s.h += Number(x.haber) || 0; return s; }, { d: 0, h: 0 });
        debe += t.d; haber += t.h;
        return Math.abs(t.d - t.h) >= 1;
    });
    if (descuadrados.length) return _ciItem('balance', label, 'pendiente', `${descuadrados.length} asiento(s) descuadrado(s): N° ${descuadrados.slice(0, 5).map(a => a.numero).join(', ')}`, 'diario');
    if (Math.abs(debe - haber) >= 1) return _ciItem('balance', label, 'pendiente', `Debe ${_ciFmt(debe)} ≠ Haber ${_ciFmt(haber)}`, 'balance');
    return _ciItem('balance', label, 'ok', `Debe = Haber = ${_ciFmt(debe)}`, 'balance');
}

// ── 2ª categoría ─────────────────────────────────────────────
function _ciItemsSegunda(p) {
    const [y, m] = p.split('-').map(Number);
    const boletas = _ciLS('hon_boletas').filter(b => ciPeriodoDe(b.fecha) === p);
    const ppm = _ciLS('hon_ppm').find(x => Number(x.mes) === m && Number(x.anio) === y);
    return [
        boletas.length
            ? _ciItem('boletas', 'Boletas de honorarios del mes', 'ok', `${boletas.length} boleta(s)`, 'libro-honorarios')
            : _ciItem('boletas', 'Boletas de honorarios del mes', 'na', 'Sin boletas en el mes', 'libro-honorarios'),
        ppm
            ? _ciItem('ppm', 'PPM del mes registrado', 'ok', _ciFmt(ppm.monto), 'f29-hon')
            : _ciItem('ppm', 'PPM del mes registrado', 'pendiente', 'Registra el PPM en F29 de honorarios', 'f29-hon'),
        _ciItemCartola(p),
    ];
}

/**
 * Checklist de cierre del período para el cliente abierto.
 * @returns {{periodo, etiqueta, categoria, items, aplican, listos, avance, pendientes, cerrado, cierre}}
 */
function cierreChecklist(p) {
    p = p || ciPeriodoActual();
    const categoria = window.currentUser?.categoria || 'primera';
    const items = categoria === 'segunda' ? _ciItemsSegunda(p) : [
        _ciItemLibro('compras', p),
        _ciItemLibro('ventas', p),
        _ciItemDocumentos(p),
        _ciItemCartola(p),
        _ciItemConciliacion(p),
        _ciItemSueldos(p),
        _ciItemPrevired(p),
        _ciItemDepreciacion(p),
        _ciItemF29(p),
        _ciItemBalance(p),
    ];
    const aplican = items.filter(i => i.estado !== 'na');
    const listos  = aplican.filter(i => i.estado === 'ok').length;
    const cierre  = cierresGet()[p] || null;
    return {
        periodo: p, etiqueta: ciEtiquetaPeriodo(p), categoria, items,
        aplican: aplican.length, listos,
        avance: aplican.length ? Math.round(listos / aplican.length * 100) : 100,
        pendientes: aplican.filter(i => i.estado === 'pendiente').map(i => i.label),
        cerrado: !!(cierre && cierre.cerrado), cierre,
    };
}

// ═════════════════════════════════════════════════════════════
//  RESUMEN EN FIREBASE (para el panel del estudio)
// ═════════════════════════════════════════════════════════════
let _ciTimerResumen = null;

function cierreResumen(p) {
    const c = cierreChecklist(p);
    return {
        avance: c.avance, listos: c.listos, aplican: c.aplican,
        pendientes: c.pendientes.slice(0, 6), cerrado: c.cerrado,
        modificaciones: (c.cierre && c.cierre.modificaciones) || 0,
        actualizado: Date.now(),
    };
}

/** Guarda el resumen del período de trabajo en la ficha del cliente (con espera de 3 s). */
function cierreSincronizarResumen(inmediato) {
    clearTimeout(_ciTimerResumen);
    const correr = async () => {
        const empresaId = window.currentUser?.empresaId;
        if (!empresaId || empresaId === 'local') return false;
        const p = ciPeriodoActual();
        const resumen = cierreResumen(p);
        // Actualizar la copia en memoria del panel para verlo sin recargar
        const cache = window._panelClientesCache;
        const cli = Array.isArray(cache) ? cache.find(c => c.id === empresaId) : null;
        if (cli) { cli.cierreResumen = cli.cierreResumen || {}; cli.cierreResumen[p] = resumen; }
        if (!window._fbDb || (typeof navigator !== 'undefined' && navigator.onLine === false)) return false;
        try {
            await window._fbDb.collection('empresas').doc(empresaId).update({ [`cierreResumen.${p}`]: resumen });
            return true;
        } catch (e) { console.warn('Resumen de cierre:', e.message); return false; }
    };
    if (inmediato) return correr();
    _ciTimerResumen = setTimeout(correr, 3000);
    return null;
}

/**
 * Resumen a mostrar en el panel para un cliente: el del período pedido o, si
 * no hay, el más reciente anterior (con su período para mostrarlo).
 */
function cierreResumenDeCliente(cliente, p) {
    const r = cliente && cliente.cierreResumen;
    if (!r) return null;
    if (r[p]) return { periodo: p, ...r[p] };
    const prev = Object.keys(r).filter(k => k <= p).sort().pop();
    return prev ? { periodo: prev, ...r[prev] } : null;
}

// ═════════════════════════════════════════════════════════════
//  TRAZABILIDAD: asiento → documento de origen
// ═════════════════════════════════════════════════════════════
function _ciIrAPeriodo(p) {
    const [y, m] = String(p || '').split('-').map(Number);
    if (y && m && typeof guardarPeriodoTrabajo === 'function') guardarPeriodoTrabajo({ mes: m, anio: y });
}

/** Navega al documento/módulo que originó un asiento. */
function cierreIrAOrigen(asientoId) {
    const a = _ciArr('asientos').find(x => String(x.id) === String(asientoId));
    if (!a) return false;
    const toast = (m, t) => typeof mostrarToast === 'function' && mostrarToast(m, t || 'info');
    const nav = (mod, extra) => { navegar(mod); if (extra) setTimeout(extra, 150); };
    switch (a.origen) {
        case 'compras':
        case 'ventas': {
            const [y, m] = String(a.origen_ref || ciPeriodoDe(a.fecha)).split('-').map(Number);
            if (a.origen === 'compras' && typeof comprasMes !== 'undefined') { comprasMes = m; comprasAnio = y; }
            if (a.origen === 'ventas'  && typeof ventasMes  !== 'undefined') { ventasMes  = m; ventasAnio  = y; }
            nav(a.origen, () => (a.origen === 'compras' ? renderCompras() : renderVentas()));
            toast(`Documentos de ${a.origen} de ${ciEtiquetaPeriodo(`${y}-${String(m).padStart(2, '0')}`)} que forman el asiento N°${a.numero}.`);
            return true;
        }
        case 'honorarios':
            nav('documentos', () => { if (typeof editarDocumento === 'function') editarDocumento(a.doc_id || Number(a.origen_ref)); });
            return true;
        case 'remuneraciones':
        case 'finiquito':
            if (a.periodo) _ciIrAPeriodo(a.periodo);
            nav('remuneraciones');
            toast(`Liquidación de ${a.trabajador_nombre || 'trabajador'}${a.periodo ? ' · ' + ciEtiquetaPeriodo(a.periodo) : ''}.`);
            return true;
        case 'activos_depreciacion':
            nav('activos');
            toast(`Depreciación ${a.periodo_depreciacion ? ciEtiquetaPeriodo(a.periodo_depreciacion) : ''} de ${(a.activos_ids || []).length} activo(s).`);
            return true;
        case 'cartola':
        case 'previred': {
            const mvId = a.origen === 'cartola' ? (a.ref_mv || a.origen_ref) : a.cartola_mov_id;
            const mv = mvId ? _ciArr('cartola').find(x => x.id === mvId) : null;
            nav('cartolas', () => {
                if (mv && typeof _cartolaRefrescar === 'function') {
                    const [y, m] = String(mv.fecha).split('-').map(Number);
                    if (typeof _cartolaFiltroMes !== 'undefined') { _cartolaFiltroMes = m; _cartolaFiltroAnio = y; }
                    _cartolaRefrescar();
                    const fila = document.getElementById('fila-mv-' + mv.id);
                    if (fila) { fila.scrollIntoView({ block: 'center' }); fila.style.outline = '2px solid var(--accent)'; }
                }
            });
            return true;
        }
        default:
            toast('Este asiento se registró a mano en el Libro Diario: no tiene un documento de origen.');
            return false;
    }
}

// ═════════════════════════════════════════════════════════════
//  TARJETA DE CIERRE (Inicio → Financiero y actividad)
// ═════════════════════════════════════════════════════════════
const _CI_ICONO = {
    ok:        '<span style="color:var(--positive);font-weight:700;">✔</span>',
    pendiente: '<span style="color:var(--warning);font-weight:700;">●</span>',
    na:        '<span style="color:var(--text-muted);">–</span>',
};
const _ciEsc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

let _ciAbierta = false;

// Campo "Cierre" de la barra superior: visible en todas las pantallas.
// También en la cabecera de Inicio ("Bienvenido de nuevo · Cliente · Cierre …").
function _ciRenderCampoTopbar(c) {
    const box  = document.getElementById('fieldCierreBox');
    const val  = document.getElementById('fieldCierre');
    const home = document.getElementById('homeCierre');
    const sep  = document.getElementById('homeCierreSep');
    if (!c) {
        [box, home, sep].forEach(e => { if (e) e.style.display = 'none'; });
        return;
    }
    const [y, m] = c.periodo.split('-');
    const mes = (CI_MESES[parseInt(m, 10) - 1] || '').slice(0, 3);
    const color = c.cerrado || c.avance === 100 ? 'var(--positive)' : 'var(--warning)';
    const estado = `<strong style="color:${color};">${c.cerrado ? '🔒 cerrado' : c.avance + '%'}</strong>`;
    const titulo = c.pendientes.length ? 'Falta: ' + c.pendientes.join(' · ') : 'Ver el checklist de cierre del mes';
    if (box && val) { val.innerHTML = `${mes} ${y} · ${estado}`; box.title = titulo; box.style.display = ''; }
    if (home) { home.innerHTML = `Cierre ${mes} ${y}: ${estado}`; home.title = titulo; home.style.display = ''; }
    if (sep) sep.style.display = '';
}

/** Lleva a Inicio → sección "Financiero y actividad" con el checklist desplegado. */
function cierreAbrirChecklist() {
    _ciAbierta = true;
    if (typeof navegar === 'function') navegar('inicio');
    cierreRenderTarjeta();
    setTimeout(() => {
        if (typeof irASeccion === 'function') irASeccion(1);
        else document.getElementById('cierreCard')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
}

function cierreRenderTarjeta() {
    const el = document.getElementById('cierreCard');
    if (!window.currentUser) { if (el) el.innerHTML = ''; _ciRenderCampoTopbar(null); return; }
    const c = cierreChecklist();
    _ciRenderCampoTopbar(c);
    if (!el) return;
    const color = c.cerrado ? 'var(--positive)' : c.avance === 100 ? 'var(--positive)' : 'var(--warning)';
    const filas = c.items.map(i => `
        <div style="display:grid;grid-template-columns:18px 1fr auto;gap:10px;align-items:start;padding:7px 0;border-top:1px solid var(--border);">
            <div>${_CI_ICONO[i.estado]}</div>
            <div style="min-width:0;">
                <div style="font-size:13px;font-weight:600;${i.estado === 'na' ? 'color:var(--text-muted);' : ''}">${_ciEsc(i.label)}</div>
                ${i.detalle ? `<div style="font-size:12px;color:var(--text-muted);">${_ciEsc(i.detalle)}</div>` : ''}
            </div>
            ${i.estado === 'pendiente' && i.ir ? `<button class="btn btn-secondary" style="padding:3px 10px;font-size:12px;height:auto;" onclick="navegar('${i.ir}')">Ir</button>` : '<span></span>'}
        </div>`).join('');
    const cierre = c.cierre;
    const avisoMods = c.cerrado && cierre && cierre.modificaciones
        ? `<div style="font-size:12px;color:var(--warning);margin-top:6px;">⚠️ ${cierre.modificaciones} cambio(s) después del cierre${cierre.ultima_modificacion?.contexto ? ' · último en ' + _ciEsc(cierre.ultima_modificacion.contexto) : ''}.</div>`
        : '';
    el.innerHTML = `
    <div class="card" style="padding:16px 18px;margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;cursor:pointer;" onclick="cierreToggleTarjeta()">
            <div style="display:flex;align-items:center;gap:10px;">
                <strong style="font-size:15px;">✅ Cierre de ${_ciEsc(c.etiqueta)}</strong>
                ${c.cerrado ? `<span style="background:var(--positive-soft);color:var(--positive);border:1px solid var(--positive);padding:2px 9px;border-radius:12px;font-size:11px;font-weight:700;">CERRADO</span>` : ''}
            </div>
            <div style="display:flex;align-items:center;gap:10px;">
                <span style="font-size:13px;color:var(--text-muted);">${c.listos} de ${c.aplican} listos</span>
                <strong style="color:${color};">${c.avance}%</strong>
                <span style="color:var(--text-muted);">${_ciAbierta ? '▲' : '▼'}</span>
            </div>
        </div>
        <div style="height:6px;border-radius:6px;background:var(--border);margin-top:10px;overflow:hidden;">
            <div style="height:100%;width:${c.avance}%;background:${color};"></div>
        </div>
        ${avisoMods}
        <div style="${_ciAbierta ? '' : 'display:none;'}margin-top:10px;">
            ${filas}
            <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;flex-wrap:wrap;">
                ${c.cerrado
                    ? `<button class="btn btn-secondary" data-requiere-rol="contador" onclick="cierreAccionReabrir()">🔓 Reabrir ${_ciEsc(c.etiqueta)}</button>`
                    : `<button class="btn btn-primary" data-requiere-rol="contador" onclick="cierreAccionCerrar()">🔒 Cerrar ${_ciEsc(c.etiqueta)}</button>`}
            </div>
        </div>
    </div>`;
    if (typeof aplicarPermisos === 'function') aplicarPermisos();
}

function cierreToggleTarjeta() { _ciAbierta = !_ciAbierta; cierreRenderTarjeta(); }

function cierreAccionCerrar() {
    const c = cierreChecklist();
    const pend = c.items.filter(i => i.estado === 'pendiente');
    const msg = pend.length
        ? `Quedan ${pend.length} punto(s) pendiente(s): ${pend.map(i => i.label).join(', ')}. ¿Cerrar ${c.etiqueta} igual? Si después se modifica algo del mes, la app avisará.`
        : `¿Cerrar ${c.etiqueta}? Si después se modifica algo del mes, la app avisará.`;
    mostrarConfirm(msg, () => {
        cierreCerrarPeriodo(c.periodo);
        mostrarToast(`${c.etiqueta} cerrado.`, 'ok');
    }, { titulo: 'Cerrar período', textoBtn: 'Cerrar período' });
}

function cierreAccionReabrir() {
    const p = ciPeriodoActual();
    mostrarConfirm(`¿Reabrir ${ciEtiquetaPeriodo(p)}?`, () => {
        cierreReabrirPeriodo(p);
        mostrarToast(`${ciEtiquetaPeriodo(p)} reabierto.`, 'ok');
    }, { titulo: 'Reabrir período', textoBtn: 'Reabrir' });
}

// ═════════════════════════════════════════════════════════════
//  Avisos de período cerrado y actualización automática
// ═════════════════════════════════════════════════════════════
const _ciCtx = { compras: 'Libro de Compras', ventas: 'Libro de Ventas', remuneraciones: 'Remuneraciones',
                 finiquito: 'Remuneraciones', activos_depreciacion: 'Activos fijos', cartola: 'Cartolas',
                 previred: 'Cartolas (Previred)', honorarios: 'Documentos (honorarios)' };

ContappEventos.escuchar('asiento:registrado', d => {
    if (d.asiento) cierreAvisarSiCerrado(d.asiento.fecha, _ciCtx[d.origen] || 'Libro Diario');
    else (d.asientos || []).forEach(a => cierreAvisarSiCerrado(a.fecha, _ciCtx[d.origen] || 'Libro Diario'));
});
ContappEventos.escuchar('asiento:anulado', d => (d.asientos || []).forEach(a => cierreAvisarSiCerrado(a.fecha, 'anulación de asiento')));
ContappEventos.escuchar('libro:guardado',  d => d.registro && cierreAvisarSiCerrado(d.registro.fecha, _ciCtx[d.libro]));
ContappEventos.escuchar('documento:en-libro', d => d.doc && cierreAvisarSiCerrado(d.doc.fecha, 'Documentos'));

function _ciRefrescar() {
    try { cierreRenderTarjeta(); } catch (e) { console.warn('Tarjeta de cierre:', e); }
    cierreSincronizarResumen();
}
['asiento:registrado', 'asiento:anulado', 'libro:guardado', 'documento:en-libro', 'pago:conciliado',
 'cliente:datos-cargados', 'cierre:cambiado'].forEach(n => ContappEventos.escuchar(n, _ciRefrescar));
document.addEventListener('DOMContentLoaded', () => setTimeout(_ciRefrescar, 0));

window.ciPeriodoDe                = ciPeriodoDe;
window.ciEtiquetaPeriodo          = ciEtiquetaPeriodo;
window.cierreFirmaLibro           = cierreFirmaLibro;
window.cierresGet                 = cierresGet;
window.cierreEstaCerrado          = cierreEstaCerrado;
window.cierreCerrarPeriodo        = cierreCerrarPeriodo;
window.cierreReabrirPeriodo       = cierreReabrirPeriodo;
window.cierreAvisarSiCerrado      = cierreAvisarSiCerrado;
window.cierreChecklist            = cierreChecklist;
window.cierreResumen              = cierreResumen;
window.cierreSincronizarResumen   = cierreSincronizarResumen;
window.cierreResumenDeCliente     = cierreResumenDeCliente;
window.cierreIrAOrigen            = cierreIrAOrigen;
window.cierreRenderTarjeta        = cierreRenderTarjeta;
window.cierreToggleTarjeta        = cierreToggleTarjeta;
window.cierreAbrirChecklist       = cierreAbrirChecklist;
window.cierreAccionCerrar         = cierreAccionCerrar;
window.cierreAccionReabrir        = cierreAccionReabrir;
