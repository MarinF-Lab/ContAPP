'use strict';
// ─────────────────────────────────────────────────────────────
//  CONEXIONES ENTRE MÓDULOS — Fase 1 (circuito comercial)
//  Ver PLANIFICACION/CONECTIVIDAD.md
//
//  C1 · Documentos → Compras/Ventas (bandeja de entrada, sin doble digitación)
//  C2 · Cartolas ↔ facturas pendientes (pago/cobro conciliado)
//  C3 · Compras/Ventas → Inventario (stock y costo de venta)
//  C4 · Compras → Activos fijos
//  C5 · Centro de costo en Compras, Ventas y Remuneraciones
//
//  Fase 2 (personas y honorarios):
//  P1 · Sueldos ↔ Cartola (liquidación individual o nómina completa)
//  P2 · Previred ↔ Cartola (asiento que cancela AFP, salud, cesantía, SIS, mutual)
//  P3 · Boletas de honorarios recibidas → asiento con retención (va al F29)
//  P4 · Pago de honorarios ↔ Cartola
//  P5 · Trabajador ↔ Contacto (por RUT)
//
//  Se carga DESPUÉS de los módulos: usa dbDocumentos, dbCompras, dbVentas,
//  _dbCartola, getProductos, getActivos… en tiempo de llamada.
// ─────────────────────────────────────────────────────────────

// ── Utilidades ────────────────────────────────────────────────
function _cxRut(r) { return String(r || '').replace(/[^0-9kK]/g, '').toUpperCase(); }
function _cxTxt(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ');
}
function _cxFechaISO(dma) {
    const p = String(dma || '').split('/');
    return p.length === 3 ? `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}` : String(dma || '');
}
function _cxFechaDMA(iso) {
    const p = String(iso || '').split('-');
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : String(iso || '');
}
function _cxMesAnio(dma) {
    const p = String(dma || '').split('/');
    return p.length === 3 ? { mes: parseInt(p[1], 10), anio: parseInt(p[2], 10) } : { mes: 0, anio: 0 };
}
function _cxNuevoId(arr) {
    let id = Date.now();
    const usados = new Set((arr || []).map(x => x.id));
    while (usados.has(id)) id++;
    return id;
}

const CX_LIBROS = {
    compras: {
        arr:    () => (typeof dbCompras !== 'undefined' ? dbCompras : (window.dbCompras || [])),
        guardar: () => { if (typeof guardarCompras === 'function') guardarCompras(); },
        render:  () => { if (typeof renderCompras === 'function') renderCompras(); },
        rut:    r => r.rut_proveedor,
        nombre: r => r.nombre_proveedor,
        rol:    'proveedor',
        cuentaContraparte: r => (typeof _cuentaAbono === 'function' ? _cuentaAbono(r.medio_pago) : 'Proveedores'),
    },
    ventas: {
        arr:    () => (typeof dbVentas !== 'undefined' ? dbVentas : (window.dbVentas || [])),
        guardar: () => { if (typeof guardarVentas === 'function') guardarVentas(); },
        render:  () => { if (typeof renderVentas === 'function') renderVentas(); },
        rut:    r => r.rut_cliente,
        nombre: r => r.nombre_cliente,
        rol:    'cliente',
        cuentaContraparte: r => (typeof _cuentaDebito === 'function' ? _cuentaDebito(r.medio_pago) : 'Clientes'),
    },
};

function conexRegistroLibro(libro, id) {
    const L = CX_LIBROS[libro];
    if (!L) return null;
    return L.arr().find(r => String(r.id) === String(id)) || null;
}

function _cxDocs() {
    return typeof dbDocumentos !== 'undefined' ? dbDocumentos : [];
}
function _cxGuardarDocs() {
    if (typeof guardarDocumentos === 'function') guardarDocumentos();
}

// ═════════════════════════════════════════════════════════════
//  C1 · DOCUMENTOS → COMPRAS / VENTAS
// ═════════════════════════════════════════════════════════════
const CX_DOC_DESTINO = {
    compra_materia:  { libro: 'compras', tipo_doc: 'factura' },
    compra_servicio: { libro: 'compras', tipo_doc: 'factura' },
    venta_factura:   { libro: 'ventas',  tipo_doc: 'factura' },
    venta_boleta:    { libro: 'ventas',  tipo_doc: 'boleta'  },
    // honorarios: van por Segunda categoría / retenciones (Fase 2)
};

function conexDocDestino(doc) {
    return doc ? (CX_DOC_DESTINO[doc.categoria] || null) : null;
}

/** Registro del libro que corresponde al documento (por enlace o por RUT + folio + tipo). */
function _cxBuscarEnLibro(doc, dest) {
    const L = CX_LIBROS[dest.libro];
    const arr = L.arr();
    if (doc.libro_id) {
        const r = arr.find(x => String(x.id) === String(doc.libro_id));
        if (r) return r;
    }
    const folio = String(doc.numero_doc || '').trim();
    if (!folio) return null;
    const rutDoc = _cxRut(doc.rut);
    return arr.find(r =>
        r.estado !== 'anulada' &&
        String(r.numero_doc || '').trim() === folio &&
        r.tipo_doc === dest.tipo_doc &&
        (rutDoc ? _cxRut(L.rut(r)) === rutDoc : _cxTxt(L.nombre(r)) === _cxTxt(doc.nombre))
    ) || null;
}

function _cxEnlazar(doc, dest, reg) {
    doc.libro    = dest.libro;
    doc.libro_id = reg.id;
    reg.doc_id   = doc.id;
}

/**
 * Pasa un documento al Libro de Compras o Ventas. Si ya existe el mismo
 * documento en el libro (RUT + folio + tipo) solo los enlaza.
 * @returns {{ok, error?, registro?, enlazado?: boolean, libro?: string}}
 */
function conexDocPasarALibro(docId) {
    const doc = _cxDocs().find(d => String(d.id) === String(docId));
    if (!doc) return { ok: false, error: 'Documento no encontrado.' };
    if (doc.estado === 'anulada') return { ok: false, error: 'El documento está anulado.' };
    const dest = conexDocDestino(doc);
    if (!dest) return { ok: false, error: 'Las boletas de honorarios se registran en Segunda categoría; no van al Libro de Compras.' };

    const L = CX_LIBROS[dest.libro];
    const existente = _cxBuscarEnLibro(doc, dest);
    if (existente) {
        _cxEnlazar(doc, dest, existente);
        L.guardar(); _cxGuardarDocs();
        return { ok: true, registro: existente, enlazado: true, libro: dest.libro };
    }

    const total = Math.round(Number(doc.total) || 0);
    let neto = Math.round(Number(doc.neto) || 0);
    let iva  = Math.round(Number(doc.iva)  || 0);
    // Documento sin desglose: se asume afecto (factura/boleta con IVA 19%)
    if (neto + iva === 0 && total > 0) { neto = Math.round(total / 1.19); iva = total - neto; }
    const exento = Math.max(0, total - neto - iva);
    const { mes, anio } = _cxMesAnio(doc.fecha);
    const pagada = doc.estado === 'pagada';

    const reg = {
        id:          _cxNuevoId(L.arr()),
        fecha:       doc.fecha,
        mes, anio,
        tipo_doc:    dest.tipo_doc,
        numero_doc:  doc.numero_doc || '',
        medio_pago:  pagada ? 'transferencia' : 'credito',
        exento, neto, iva, total,
        glosa:       doc.glosa || '',
        estado:      pagada ? 'pagada' : 'pendiente',
        adjunto:     doc.adjunto || null,
        asiento_id:  null,
        origen:      'documentos',
    };
    if (dest.libro === 'compras') { reg.rut_proveedor = doc.rut || ''; reg.nombre_proveedor = doc.nombre; }
    else                          { reg.rut_cliente   = doc.rut || ''; reg.nombre_cliente   = doc.nombre; }

    L.arr().push(reg);
    _cxEnlazar(doc, dest, reg);
    L.guardar(); _cxGuardarDocs();
    if (doc.rut && typeof contactoAsegurar === 'function') {
        contactoAsegurar({ rut: doc.rut, nombre: doc.nombre, origen: 'documentos' }, L.rol);
    }
    ContappEventos.emitir('documento:en-libro', { doc, registro: reg, libro: dest.libro });
    return { ok: true, registro: reg, enlazado: false, libro: dest.libro };
}

/** Lleva al libro los cambios de un documento enlazado (edición, pago, anulación). */
function conexDocSincronizar(docId) {
    const doc = _cxDocs().find(d => String(d.id) === String(docId));
    if (doc && doc.categoria === 'honorarios' && doc.contabilizado) return conexHonorarioSincronizar(doc);
    if (!doc || !doc.libro || !doc.libro_id) return false;
    const L = CX_LIBROS[doc.libro];
    const reg = conexRegistroLibro(doc.libro, doc.libro_id);
    if (!L || !reg) return false;

    if (doc.estado === 'anulada') {
        reg.estado = 'anulada';
    } else {
        const total = Math.round(Number(doc.total) || 0);
        let neto = Math.round(Number(doc.neto) || 0);
        let iva  = Math.round(Number(doc.iva)  || 0);
        if (neto + iva === 0 && total > 0) { neto = Math.round(total / 1.19); iva = total - neto; }
        Object.assign(reg, {
            fecha: doc.fecha, ..._cxMesAnio(doc.fecha),
            numero_doc: doc.numero_doc || '', neto, iva, total,
            exento: Math.max(0, total - neto - iva),
            glosa: doc.glosa || reg.glosa || '',
        });
        if (doc.libro === 'compras') { reg.rut_proveedor = doc.rut || ''; reg.nombre_proveedor = doc.nombre; }
        else                         { reg.rut_cliente   = doc.rut || ''; reg.nombre_cliente   = doc.nombre; }
        if (doc.estado === 'pagada' && reg.estado === 'pendiente') reg.estado = 'pagada';
    }
    L.guardar();
    conexSincronizarInventario(doc.libro, reg);
    if (doc.libro === 'compras' && (reg.es_activo_fijo || reg.activo_id)) { conexSincronizarActivo(reg); L.guardar(); }
    return true;
}

/** Al anular un registro del libro, anular también su documento enlazado. */
function conexLibroAnulado(libro, id) {
    const reg = conexRegistroLibro(libro, id);
    if (reg) conexSincronizarInventario(libro, reg);
    if (reg && reg.es_activo_fijo) conexSincronizarActivo(reg);
    if (!reg || !reg.doc_id) return false;
    const doc = _cxDocs().find(d => String(d.id) === String(reg.doc_id));
    if (!doc || doc.estado === 'anulada') return false;
    doc.estado = 'anulada';
    _cxGuardarDocs();
    return true;
}

/** Enlaza documentos antiguos con sus registros del libro (no crea registros). */
function conexEnlazarDocumentosExistentes() {
    let n = 0;
    _cxDocs().forEach(doc => {
        if (doc.libro_id || doc.estado === 'anulada') return;
        const dest = conexDocDestino(doc);
        if (!dest) return;
        const reg = _cxBuscarEnLibro(doc, dest);
        if (reg && !reg.doc_id) { _cxEnlazar(doc, dest, reg); n++; }
    });
    if (n) { _cxGuardarDocs(); CX_LIBROS.compras.guardar(); CX_LIBROS.ventas.guardar(); }
    return n;
}

// ═════════════════════════════════════════════════════════════
//  C2 · CARTOLAS ↔ FACTURAS PENDIENTES
// ═════════════════════════════════════════════════════════════
const CX_TOLERANCIA_PAGO = 1;

function _cxCartolaArr() {
    return typeof _dbCartola !== 'undefined' ? _dbCartola : (window.dbCartolaMov || []);
}
function _cxCartolaGuardar() {
    if (typeof guardarCartolas === 'function') guardarCartolas();
}

/** Puntaje de coincidencia entre la glosa del banco y un nombre/RUT/folio. */
function _cxPuntaje(mv, nombre, rut, folio, fechaDMA) {
    const desc = _cxTxt(mv.descripcion);
    const descDigitos = String(mv.descripcion || '').replace(/[^0-9kK]/g, '').toUpperCase();
    let score = 1;
    const r = _cxRut(rut);
    if (r && r.length > 3 && descDigitos.includes(r.slice(0, -1))) score += 3;
    if (_cxTxt(nombre).split(' ').filter(w => w.length >= 4).some(w => desc.includes(w))) score += 2;
    if (folio && desc.includes(String(folio))) score += 2;
    if (fechaDMA) {
        const dias = Math.abs((new Date(mv.fecha || Date.now()) - new Date(_cxFechaISO(fechaDMA))) / 864e5) || 0;
        score -= Math.min(dias, 365) / 365;
    }
    return Math.round(score * 100) / 100;
}

const _cxCoincide = (a, b) => Math.abs(Math.round(Number(a) || 0) - Math.round(Number(b) || 0)) <= CX_TOLERANCIA_PAGO;

/**
 * Pagos/cobros pendientes que un movimiento de cartola podría corresponder,
 * ordenados por probabilidad. Un cargo busca facturas de compra, boletas de
 * honorarios, liquidaciones de sueldo, nóminas completas y pagos de Previred;
 * un abono busca facturas de venta.
 * Cada sugerencia: { libro, id, numero_doc, nombre, total, fecha, score, etiqueta }
 */
function conexCartolaSugerencias(mvOId, max = 5) {
    const mv = typeof mvOId === 'object' ? mvOId : _cxCartolaArr().find(x => x.id === mvOId);
    if (!mv) return [];
    const esCargo = (Number(mv.cargo) || 0) > 0;
    const monto = Math.round(Number(mv.cargo) || Number(mv.abono) || 0);
    if (!monto) return [];
    const out = [];

    // Facturas de compra / venta pendientes (Fase 1)
    const libro = esCargo ? 'compras' : 'ventas';
    const L = CX_LIBROS[libro];
    L.arr()
        .filter(r => r.estado === 'pendiente' && r.tipo_doc !== 'nota_credito' && _cxCoincide(r.total, monto))
        .forEach(r => out.push({
            libro, id: r.id, numero_doc: r.numero_doc || '', tipo_doc: r.tipo_doc,
            nombre: L.nombre(r) || '', rut: L.rut(r) || '', total: r.total, fecha: r.fecha,
            score: _cxPuntaje(mv, L.nombre(r), L.rut(r), r.numero_doc, r.fecha),
            etiqueta: `Factura N°${r.numero_doc || '—'} · ${L.nombre(r) || ''}`,
        }));

    if (esCargo) {
        // P4 · Boletas de honorarios contabilizadas y pendientes (por el líquido)
        _cxDocs()
            .filter(d => d.categoria === 'honorarios' && d.contabilizado && d.estado === 'pendiente' &&
                         _cxCoincide(conexHonorarioRetencion(d).liquido, monto))
            .forEach(d => out.push({
                libro: 'honorarios', id: d.id, numero_doc: d.numero_doc || '', nombre: d.nombre || '', rut: d.rut || '',
                total: conexHonorarioRetencion(d).liquido, fecha: d.fecha,
                score: _cxPuntaje(mv, d.nombre, d.rut, d.numero_doc, d.fecha),
                etiqueta: `Boleta de honorarios N°${d.numero_doc || '—'} · ${d.nombre || ''}`,
            }));

        // P1 · Liquidaciones individuales pendientes de pago
        const pendientes = conexRemuneracionesPorPagar();
        pendientes.filter(a => _cxCoincide(a.liquido, monto)).forEach(a => out.push({
            libro: 'remuneraciones', id: a.id, numero_doc: '', nombre: a.trabajador_nombre || a.glosa,
            rut: a.trabajador_rut || '', total: a.liquido, fecha: a.fecha,
            score: _cxPuntaje(mv, a.trabajador_nombre || '', a.trabajador_rut, '', a.fecha) + 0.5,
            etiqueta: `Sueldo ${a.trabajador_nombre || ''} · ${a.periodo || ''}`,
        }));

        // P1 · Nómina completa de un período (una transferencia para varios trabajadores)
        const porPeriodo = {};
        pendientes.forEach(a => { (porPeriodo[a.periodo] = porPeriodo[a.periodo] || []).push(a); });
        Object.entries(porPeriodo).forEach(([periodo, lista]) => {
            if (lista.length < 2) return;
            const total = lista.reduce((t, a) => t + a.liquido, 0);
            if (!_cxCoincide(total, monto)) return;
            const desc = _cxTxt(mv.descripcion);
            out.push({
                libro: 'nomina', id: periodo, numero_doc: '', nombre: `Nómina ${periodo} (${lista.length} trabajadores)`,
                total, fecha: lista[0].fecha,
                score: 2 + (/(remun|sueldo|nomina|nómina)/.test(desc) ? 2 : 0),
                etiqueta: `Nómina ${periodo} · ${lista.length} trabajadores`,
            });
        });

        // P2 · Previred del período
        conexPreviredPorPagar().filter(pv => _cxCoincide(pv.total, monto)).forEach(pv => out.push({
            libro: 'previred', id: pv.periodo, numero_doc: '', nombre: `Previred ${pv.periodo}`,
            total: pv.total, fecha: pv.fecha,
            score: 2 + (/previred/.test(_cxTxt(mv.descripcion)) ? 4 : 0),
            etiqueta: `Cotizaciones Previred · ${pv.periodo}`,
        }));
    }

    return out.sort((x, y) => y.score - x.score).slice(0, max);
}

/**
 * Vincula un movimiento de cartola con lo que paga/cobra.
 *  - compras/ventas/honorarios/remuneraciones/nomina: el movimiento queda
 *    clasificado contra la cuenta por pagar/cobrar y el asiento lo genera
 *    "Generar asientos" de Cartolas, como cualquier otro movimiento.
 *  - previred: el pago cancela varias cuentas a la vez, así que el asiento se
 *    registra aquí mismo y el movimiento queda procesado.
 */
function conexCartolaAplicarDocumento(mvId, libro, regId) {
    const mv = _cxCartolaArr().find(x => x.id === mvId);
    if (!mv) return { ok: false, error: 'Movimiento no encontrado.' };
    if (mv.doc_vinculado) conexCartolaDesvincular(mvId);
    const vincular = (cuenta, datos) => {
        mv.cuenta_banco         = mv.cuenta_banco || 'Banco';
        mv.cuenta_contrapartida = cuenta;
        if (mv.estado !== 'ignorado') mv.estado = 'clasificado';
        mv.doc_vinculado = { libro, id: regId, ...datos };
    };
    let registro = null;

    if (libro === 'compras' || libro === 'ventas') {
        const reg = conexRegistroLibro(libro, regId);
        if (!reg) return { ok: false, error: 'Factura no encontrada.' };
        const L = CX_LIBROS[libro];
        vincular(L.cuentaContraparte(reg), { numero_doc: reg.numero_doc || '', nombre: L.nombre(reg) || '',
            etiqueta: `Factura N°${reg.numero_doc || '—'} · ${L.nombre(reg) || ''}` });
        reg.estado = 'pagada'; reg.pagado_mov_id = mv.id; reg.fecha_pago = mv.fecha;
        if (reg.doc_id) {
            const doc = _cxDocs().find(d => String(d.id) === String(reg.doc_id));
            if (doc && doc.estado !== 'anulada') { doc.estado = 'pagada'; _cxGuardarDocs(); }
        }
        L.guardar();
        registro = reg;
    } else if (libro === 'honorarios') {
        const doc = _cxDocs().find(d => String(d.id) === String(regId));
        if (!doc) return { ok: false, error: 'Boleta no encontrada.' };
        vincular(CX_CTA_HON_POR_PAGAR, { numero_doc: doc.numero_doc || '', nombre: doc.nombre || '',
            etiqueta: `Boleta de honorarios N°${doc.numero_doc || '—'} · ${doc.nombre || ''}` });
        doc.estado = 'pagada'; doc.pagado_mov_id = mv.id;
        _cxGuardarDocs();
        registro = doc;
    } else if (libro === 'remuneraciones' || libro === 'nomina') {
        const lista = libro === 'remuneraciones'
            ? conexRemuneracionesPorPagar().filter(a => String(a.id) === String(regId))
            : conexRemuneracionesPorPagar().filter(a => a.periodo === regId);
        if (!lista.length) return { ok: false, error: 'No hay liquidaciones pendientes de pago para vincular.' };
        lista.forEach(a => { a.pago_mov_id = mv.id; });
        _cxGuardarAsientos();
        vincular(CX_CTA_REM_POR_PAGAR, { nombre: lista.length === 1 ? (lista[0].trabajador_nombre || '') : `${lista.length} trabajadores`,
            etiqueta: libro === 'nomina' ? `Nómina ${regId} · ${lista.length} trabajadores` : `Sueldo ${lista[0].trabajador_nombre || ''} · ${lista[0].periodo || ''}`,
            asientos: lista.map(a => a.id) });
        registro = lista;
    } else if (libro === 'previred') {
        const r = conexPreviredRegistrarPago(regId, mv);
        if (!r.ok) return r;
        mv.cuenta_banco = mv.cuenta_banco || 'Banco';
        mv.estado = 'ignorado';                // ya tiene su asiento: "Generar asientos" no lo repite
        mv.asiento_directo = { origen: 'previred', ref: regId };
        mv.doc_vinculado = { libro, id: regId, nombre: `Previred ${regId}`, etiqueta: `Cotizaciones Previred · ${regId}` };
        registro = r.asiento;
    } else {
        return { ok: false, error: 'Tipo de pago desconocido.' };
    }

    _cxCartolaGuardar();
    ContappEventos.emitir('pago:conciliado', { mv, libro, registro });
    return { ok: true, movimiento: mv, registro };
}

/** Deshace el vínculo de un movimiento de cartola (lo pagado vuelve a pendiente). */
function conexCartolaDesvincular(mvId) {
    const mv = _cxCartolaArr().find(x => x.id === mvId);
    if (!mv || !mv.doc_vinculado) return false;
    const { libro, id } = mv.doc_vinculado;

    if (libro === 'compras' || libro === 'ventas') {
        const reg = conexRegistroLibro(libro, id);
        if (reg && reg.pagado_mov_id === mv.id) {
            reg.estado = 'pendiente';
            delete reg.pagado_mov_id;
            delete reg.fecha_pago;
            if (reg.doc_id) {
                const doc = _cxDocs().find(d => String(d.id) === String(reg.doc_id));
                if (doc && doc.estado === 'pagada') { doc.estado = 'pendiente'; _cxGuardarDocs(); }
            }
            CX_LIBROS[libro].guardar();
        }
    } else if (libro === 'honorarios') {
        const doc = _cxDocs().find(d => String(d.id) === String(id));
        if (doc && doc.pagado_mov_id === mv.id) { doc.estado = 'pendiente'; delete doc.pagado_mov_id; _cxGuardarDocs(); }
    } else if (libro === 'remuneraciones' || libro === 'nomina') {
        _cxAsientosArr().forEach(a => { if (a.pago_mov_id === mv.id) delete a.pago_mov_id; });
        _cxGuardarAsientos();
    } else if (libro === 'previred') {
        anularAsientosPorOrigen('previred', id, 'Pago Previred desvinculado de la cartola');
        _cxAsientosArr().forEach(a => { if (a.previred_mov_id === mv.id) delete a.previred_mov_id; });
        _cxGuardarAsientos();
        if (mv.asiento_directo) { delete mv.asiento_directo; mv.estado = 'pendiente'; }
    }
    mv.doc_vinculado = null;
    _cxCartolaGuardar();
    return true;
}

// ═════════════════════════════════════════════════════════════
//  C3 · COMPRAS / VENTAS → INVENTARIO
// ═════════════════════════════════════════════════════════════
function _cxProducto(id) {
    if (id == null || id === '' || typeof getProductos !== 'function') return null;
    return getProductos().find(p => String(p.id) === String(id)) || null;
}

/**
 * Crea, actualiza o elimina el movimiento de inventario de una compra/venta
 * con producto. Compra = ingreso, venta = egreso (al revés en notas de crédito).
 */
function conexSincronizarInventario(libro, reg) {
    if (!reg || typeof invRegistrarPorOrigen !== 'function') return null;
    const p = _cxProducto(reg.producto_id);
    const cant = Number(reg.cantidad) || 0;
    if (!p || cant <= 0 || reg.estado === 'anulada' || reg.tipo_doc === 'guia') {
        invEliminarPorOrigen(libro, reg.id);
        return null;
    }
    const nc = reg.tipo_doc === 'nota_credito';
    const tipo = libro === 'compras' ? (nc ? 'egreso' : 'ingreso') : (nc ? 'ingreso' : 'egreso');
    const L = CX_LIBROS[libro];
    return invRegistrarPorOrigen({
        origen: libro, ref: reg.id, tipo,
        producto:    p.nombre,
        cantidad:    cant,
        bodega:      reg.bodega || '',
        centroCosto: reg.centro_costo || '',
        fecha:       _cxFechaISO(reg.fecha),
        glosa:       `${reg.tipo_doc || ''} N°${reg.numero_doc || '—'} ${L.nombre(reg) || ''}`.trim(),
    });
}

/** Costo de venta de un registro de ventas con producto (cantidad × costo). */
function conexCostoVenta(reg) {
    const p = _cxProducto(reg && reg.producto_id);
    const cant = Number(reg && reg.cantidad) || 0;
    if (!p || cant <= 0 || !(Number(p.precio_costo) > 0)) return null;
    const ctas = typeof productoCuentas === 'function' ? productoCuentas(p) : { cuenta_costo: 'Costo de Ventas', cuenta_inventario: 'Mercaderías' };
    return { monto: Math.round(cant * Number(p.precio_costo)), cuenta_costo: ctas.cuenta_costo, cuenta_inventario: ctas.cuenta_inventario };
}

// ═════════════════════════════════════════════════════════════
//  C4 · COMPRAS → ACTIVOS FIJOS
// ═════════════════════════════════════════════════════════════
// Vida útil normal (años) por tipo de bien — referencia tabla SII; editable en Activos.
const CX_VIDA_UTIL = [
    [/computa|software/i, 6], [/veh[ií]culo/i, 7], [/mueble|[uú]til/i, 7],
    [/maquinaria/i, 15], [/instalaci/i, 10], [/edificio/i, 50], [/marca|patente/i, 10],
];

function conexCuentasActivoFijo() {
    const plan = (typeof PLAN_CUENTAS !== 'undefined' && PLAN_CUENTAS) || window.PLAN_CUENTAS || {};
    const nombres = Array.isArray(plan)
        ? plan.filter(c => c && c.grupo === 'Activo No Circulante').map(c => c.nombre)
        : Object.keys(plan).filter(k => plan[k] && plan[k].grupo === 'Activo No Circulante');
    const lista = nombres.length ? nombres
        : ['Muebles y Útiles', 'Equipos Computacionales', 'Vehículos', 'Maquinarias', 'Instalaciones', 'Edificios', 'Terrenos', 'Software'];
    // Lo más común primero; Terrenos (no se deprecia) al final.
    const pref = ['Muebles y Útiles', 'Equipos Computacionales', 'Vehículos', 'Maquinarias'];
    return [...pref.filter(n => lista.includes(n)), ...lista.filter(n => !pref.includes(n) && !/terreno/i.test(n)), ...lista.filter(n => /terreno/i.test(n))];
}

function conexVidaUtilSugerida(cuenta) {
    const f = CX_VIDA_UTIL.find(([re]) => re.test(cuenta || ''));
    return f ? f[1] : 7;
}

/**
 * Crea o actualiza la ficha del activo fijo de una compra marcada como activo.
 * Si la compra se anula o se desmarca, el activo queda inactivo (no se borra,
 * por si ya tiene depreciaciones registradas).
 */
function conexSincronizarActivo(reg) {
    if (!reg || typeof getActivos !== 'function' || typeof saveActivos !== 'function') return null;
    const arr = getActivos();
    const idx = reg.activo_id ? arr.findIndex(a => String(a.id) === String(reg.activo_id)) : -1;
    const vigente = reg.es_activo_fijo && reg.estado !== 'anulada' && reg.tipo_doc !== 'nota_credito';

    if (!vigente) {
        if (idx >= 0 && arr[idx].activo !== false) { arr[idx].activo = false; saveActivos(arr); }
        return idx >= 0 ? arr[idx] : null;
    }

    const cuenta = reg.activo_cuenta || 'Muebles y Útiles';
    const prov = typeof contactoPorRut === 'function' ? contactoPorRut(reg.rut_proveedor) : null;
    const datos = {
        nombre:            reg.activo_nombre || reg.glosa || `${reg.tipo_doc || 'Compra'} N°${reg.numero_doc || ''} ${reg.nombre_proveedor || ''}`.trim(),
        fecha_adquisicion: _cxFechaISO(reg.fecha),
        valor_adquisicion: Math.round((Number(reg.neto) || 0) + (Number(reg.exento) || 0)),
        cuenta_activo:     cuenta,
        proveedor_id:      prov ? prov.id : '',
        proveedor_nombre:  reg.nombre_proveedor || '',
        compra_id:         reg.id,
        origen:            'compras',
        activo:            true,
    };
    let activo;
    if (idx >= 0) {
        activo = Object.assign(arr[idx], datos);
    } else {
        activo = {
            id: 'a' + Date.now() + Math.floor(Math.random() * 1000),
            descripcion: reg.glosa || '',
            fecha_fin: '',
            vida_util_anos: Number(reg.activo_vida) || conexVidaUtilSugerida(cuenta),
            metodo: 'lineal',
            cuenta_dep_acumulada: '',
            cuenta_gasto_dep: '',
            created_at: Date.now(),
            ...datos,
        };
        arr.push(activo);
        reg.activo_id = activo.id;
    }
    if (Number(reg.activo_vida) > 0) activo.vida_util_anos = Number(reg.activo_vida);
    saveActivos(arr);
    return activo;
}

/** Cuenta del Debe de una compra en la centralización. */
function conexCuentaCargoCompra(reg, ctaPorDefecto) {
    if (reg.es_activo_fijo) return reg.activo_cuenta || 'Muebles y Útiles';
    const p = _cxProducto(reg.producto_id);
    if (p && typeof productoCuentas === 'function') return productoCuentas(p).cuenta_inventario;
    return ctaPorDefecto;
}

// ═════════════════════════════════════════════════════════════
//  Después de guardar una compra o venta (lo llaman compras.js / ventas.js)
// ═════════════════════════════════════════════════════════════
function conexDespuesDeGuardarLibro(libro, reg) {
    if (!reg) return;
    conexSincronizarInventario(libro, reg);
    if (libro === 'compras' && (reg.es_activo_fijo || reg.activo_id)) {
        conexSincronizarActivo(reg);
        CX_LIBROS.compras.guardar();
    }
    const L = CX_LIBROS[libro];
    if (L.rut(reg) && typeof contactoAsegurar === 'function') {
        contactoAsegurar({ rut: L.rut(reg), nombre: L.nombre(reg), origen: libro }, L.rol);
    }
    ContappEventos.emitir('libro:guardado', { libro, registro: reg });
}

// ═════════════════════════════════════════════════════════════
//  FORMULARIOS DE COMPRA / VENTA — campos de conexión
//  (los campos están en index.html dentro de #modalCompra / #modalVenta,
//   con prefijo 'compra' o 'venta')
// ═════════════════════════════════════════════════════════════
function _cxEl(id) { return document.getElementById(id); }

function _cxOpciones(lista, sel, vacio) {
    const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    return `<option value="">${vacio}</option>` +
        lista.map(n => `<option value="${esc(n)}"${n === sel ? ' selected' : ''}>${esc(n)}</option>`).join('');
}

function conexFormPoblar(prefijo, reg) {
    const r = reg || {};
    const bodegas = typeof getBodegas === 'function' ? getBodegas().filter(b => b.estado !== 'inactiva' && b.estado !== 'inactivo').map(b => b.nombre) : [];
    const centros = typeof getCentrosCosto === 'function' ? getCentrosCosto().filter(c => c.estado !== 'inactivo' && c.estado !== 'inactiva').map(c => c.nombre) : [];
    const selB = _cxEl(prefijo + 'Bodega');
    const selC = _cxEl(prefijo + 'CentroCosto');
    if (selB) selB.innerHTML = _cxOpciones(bodegas, r.bodega || '', 'Sin bodega');
    if (selC) selC.innerHTML = _cxOpciones(centros, r.centro_costo || '', 'Sin centro de costo');

    const p = _cxProducto(r.producto_id);
    if (_cxEl(prefijo + 'ProductoId'))     _cxEl(prefijo + 'ProductoId').value = p ? p.id : '';
    if (_cxEl(prefijo + 'ProductoNombre')) _cxEl(prefijo + 'ProductoNombre').value = p ? p.nombre : '';
    if (_cxEl(prefijo + 'Cantidad'))       _cxEl(prefijo + 'Cantidad').value = r.cantidad || '';

    if (prefijo === 'compra') {
        const chk = _cxEl('compraEsActivo');
        if (chk) chk.checked = !!r.es_activo_fijo;
        const selA = _cxEl('compraActivoCuenta');
        if (selA) selA.innerHTML = conexCuentasActivoFijo().map(n =>
            `<option value="${n}"${n === (r.activo_cuenta || '') ? ' selected' : ''}>${n}</option>`).join('');
        if (_cxEl('compraActivoVida')) _cxEl('compraActivoVida').value = r.activo_vida || '';
        conexFormToggleActivo();
    }
}

function conexFormLeer(prefijo) {
    const v = id => (_cxEl(prefijo + id)?.value || '').trim();
    const datos = {
        producto_id:  v('ProductoId') || null,
        cantidad:     Number(v('Cantidad')) || 0,
        bodega:       v('Bodega'),
        centro_costo: v('CentroCosto'),
    };
    if (!datos.producto_id) datos.cantidad = 0;
    if (prefijo === 'compra') {
        datos.es_activo_fijo = !!_cxEl('compraEsActivo')?.checked;
        datos.activo_cuenta  = datos.es_activo_fijo ? v('ActivoCuenta') : '';
        datos.activo_vida    = datos.es_activo_fijo ? (Number(v('ActivoVida')) || 0) : 0;
    }
    return datos;
}

function conexFormProducto(prefijo, prod) {
    if (_cxEl(prefijo + 'ProductoId'))     _cxEl(prefijo + 'ProductoId').value = prod ? prod.id : '';
    if (_cxEl(prefijo + 'ProductoNombre')) _cxEl(prefijo + 'ProductoNombre').value = prod ? prod.nombre : '';
    const cant = _cxEl(prefijo + 'Cantidad');
    if (cant && prod && !Number(cant.value)) cant.value = 1;
    if (cant && !prod) cant.value = '';
}

function conexFormToggleActivo() {
    const on = !!_cxEl('compraEsActivo')?.checked;
    const box = _cxEl('compraActivoCampos');
    if (box) box.style.display = on ? '' : 'none';
    const sel = _cxEl('compraActivoCuenta');
    const vida = _cxEl('compraActivoVida');
    if (on && sel && vida && !vida.value) vida.placeholder = String(conexVidaUtilSugerida(sel.value));
}

// ═════════════════════════════════════════════════════════════
//  FASE 2 · PERSONAS Y HONORARIOS
// ═════════════════════════════════════════════════════════════
const CX_CTA_REM_POR_PAGAR = 'Remuneraciones por pagar';
const CX_CTA_HON_GASTO     = 'Honorarios';
const CX_CTA_HON_POR_PAGAR = 'Honorarios por Pagar';
const CX_CTA_HON_RETENCION = 'Retención Honorarios por pagar';  // empieza con "Retención" → la toma el F29
const CX_TASA_RET_HON      = 0.1525;                            // Ley 21.133, 2026

// Cuentas de Previred: lo que se paga en una sola planilla.
const CX_RE_PREVIRED = /^(AFP .+|Salud .+|Seguro Cesantía|Seguro Cesantía Empleador|SIS|Mutual) por pagar$/i;

function _cxAsientosArr() {
    return typeof dbAsientos !== 'undefined' ? dbAsientos : (window.dbAsientos || []);
}
function _cxGuardarAsientos() {
    localStorage.setItem('core_asientos', JSON.stringify(_cxAsientosArr()));
}

/** Crea la cuenta en el plan si no existe (mismo criterio que remuneraciones.js). */
function conexAsegurarCuenta(nombre, tipo, grupo, orden) {
    const plan = (typeof PLAN_CUENTAS !== 'undefined' && PLAN_CUENTAS) || window.PLAN_CUENTAS;
    if (!plan || Array.isArray(plan) || plan[nombre]) return;
    plan[nombre] = {
        tipo, grupo, orden,
        naturaleza: (tipo === 'Pérdida' || tipo === 'Activo') ? 'Debe' : 'Haber',
        codigo: '', estado: 'ACTIVA', editable: true,
    };
    if (typeof guardarPlanCuentas === 'function') guardarPlanCuentas();
}

// ── P3 · Boletas de honorarios recibidas ─────────────────────
/** Bruto, retención y líquido de una boleta de honorarios (Documentos). */
function conexHonorarioRetencion(doc) {
    const bruto = Math.round(Number(doc && doc.total) || 0);
    const tasa  = typeof TASA_RETENCION_HON === 'number' ? TASA_RETENCION_HON : CX_TASA_RET_HON;
    const retencion = doc && doc.sin_retencion ? 0 : Math.round(bruto * tasa);
    return { bruto, retencion, liquido: bruto - retencion, tasa };
}

/**
 * Registra el asiento de una boleta de honorarios recibida:
 *   Debe  Honorarios (bruto)
 *   Haber Retención Honorarios por pagar (15,25%) → se declara en el F29
 *   Haber Honorarios por Pagar (líquido)          → se cancela al pagar (cartola)
 * Reenviar actualiza el mismo asiento. El prestador queda en Contactos.
 */
function conexHonorarioContabilizar(docId) {
    const doc = _cxDocs().find(d => String(d.id) === String(docId));
    if (!doc) return { ok: false, error: 'Documento no encontrado.' };
    if (doc.categoria !== 'honorarios') return { ok: false, error: 'Solo las boletas de honorarios se contabilizan así.' };
    if (doc.estado === 'anulada') return { ok: false, error: 'La boleta está anulada.' };
    const { bruto, retencion, liquido } = conexHonorarioRetencion(doc);
    if (bruto <= 0) return { ok: false, error: 'La boleta no tiene monto.' };

    conexAsegurarCuenta(CX_CTA_HON_GASTO,     'Pérdida', 'Pérdidas',          506);
    conexAsegurarCuenta(CX_CTA_HON_POR_PAGAR, 'Pasivo',  'Pasivo Circulante', 206);
    conexAsegurarCuenta(CX_CTA_HON_RETENCION, 'Pasivo',  'Pasivo Circulante', 236);

    const movimientos = [{ cuenta: CX_CTA_HON_GASTO, debe: bruto, haber: 0 }];
    if (retencion > 0) movimientos.push({ cuenta: CX_CTA_HON_RETENCION, debe: 0, haber: retencion });
    movimientos.push({ cuenta: CX_CTA_HON_POR_PAGAR, debe: 0, haber: liquido });

    const res = registrarAsiento({
        origen: 'honorarios', ref: doc.id, fecha: doc.fecha,
        glosa: `Boleta de honorarios N°${doc.numero_doc || '—'} ${doc.nombre || ''}`.trim(),
        movimientos,
        extra: { doc_id: doc.id, prestador_rut: doc.rut || '', bruto, retencion, liquido, contacto: doc.nombre || '' },
    });
    if (!res.ok) return res;
    doc.contabilizado = true;
    _cxGuardarDocs();
    if (doc.rut && typeof contactoAsegurar === 'function') {
        contactoAsegurar({ rut: doc.rut, nombre: doc.nombre, origen: 'honorarios' }, 'prestador');
    }
    return { ok: true, asiento: res.asiento, actualizado: res.actualizado, bruto, retencion, liquido };
}

/** Lleva al asiento los cambios de una boleta ya contabilizada (o la anula). */
function conexHonorarioSincronizar(doc) {
    if (doc.estado === 'anulada') {
        anularAsientosPorOrigen('honorarios', doc.id, 'Boleta de honorarios anulada');
        doc.contabilizado = false;
        _cxGuardarDocs();
        return true;
    }
    return conexHonorarioContabilizar(doc.id).ok;
}

// ── P1 · Sueldos por pagar ───────────────────────────────────
/**
 * Asientos de remuneraciones ACTIVOS con líquido en "Remuneraciones por pagar"
 * que todavía no tienen pago vinculado. Los asientos antiguos (líquido directo
 * a Banco) se consideran pagados y no aparecen.
 */
function conexRemuneracionesPorPagar() {
    return _cxAsientosArr().filter(a =>
        a.estado !== 'ANULADO' && a.origen === 'remuneraciones' && !a.pago_mov_id &&
        (a.movimientos || []).some(m => m.cuenta === CX_CTA_REM_POR_PAGAR && (Number(m.haber) || 0) > 0)
    ).map(a => {
        if (!a.liquido) {
            const m = a.movimientos.find(x => x.cuenta === CX_CTA_REM_POR_PAGAR);
            a.liquido = Math.round(Number(m && m.haber) || 0);
        }
        return a;
    });
}

// ── P2 · Previred ────────────────────────────────────────────
/** Cotizaciones de un período: suma por cuenta de los asientos de sueldo. */
function conexPreviredDetalle(periodo) {
    const porCuenta = {};
    const asientos = _cxAsientosArr().filter(a =>
        a.estado !== 'ANULADO' && a.origen === 'remuneraciones' && a.periodo === periodo);
    asientos.forEach(a => (a.movimientos || []).forEach(m => {
        if (!CX_RE_PREVIRED.test(m.cuenta || '')) return;
        porCuenta[m.cuenta] = (porCuenta[m.cuenta] || 0) + (Number(m.haber) || 0) - (Number(m.debe) || 0);
    }));
    const lineas = Object.entries(porCuenta).filter(([, v]) => v > 0).map(([cuenta, monto]) => ({ cuenta, monto: Math.round(monto) }));
    return { periodo, asientos, lineas, total: lineas.reduce((t, l) => t + l.monto, 0) };
}

/** Períodos con cotizaciones sin pagar (uno por período con sueldos contabilizados). */
function conexPreviredPorPagar() {
    const periodos = [...new Set(_cxAsientosArr()
        .filter(a => a.estado !== 'ANULADO' && a.origen === 'remuneraciones' && a.periodo)
        .map(a => a.periodo))];
    return periodos
        .filter(p => !buscarAsientoPorOrigen('previred', p))
        .map(p => {
            const d = conexPreviredDetalle(p);
            const [y, m] = p.split('-');
            const ult = new Date(parseInt(y, 10), parseInt(m, 10), 0).getDate();
            return { ...d, fecha: `${String(ult).padStart(2, '0')}/${m}/${y}` };
        })
        .filter(d => d.total > 0);
}

/** Registra el pago de Previred de un período: Debe cada cotización, Haber Banco. */
function conexPreviredRegistrarPago(periodo, mv) {
    const d = conexPreviredDetalle(periodo);
    if (!d.total) return { ok: false, error: `No hay cotizaciones por pagar en ${periodo}.` };
    const cuentaBanco = (mv && mv.cuenta_banco) || 'Banco';
    const fecha = mv && mv.fecha ? _cxFechaDMA(mv.fecha) : d.asientos[0]?.fecha;
    const res = registrarAsiento({
        origen: 'previred', ref: periodo, fecha,
        glosa: `Pago cotizaciones Previred ${periodo}`,
        movimientos: [
            ...d.lineas.map(l => ({ cuenta: l.cuenta, debe: l.monto, haber: 0 })),
            { cuenta: cuentaBanco, debe: 0, haber: d.total },
        ],
        extra: { periodo, cartola_mov_id: mv ? mv.id : null },
    });
    if (!res.ok) return res;
    if (mv) { d.asientos.forEach(a => { a.previred_mov_id = mv.id; }); _cxGuardarAsientos(); }
    return { ok: true, asiento: res.asiento, total: d.total };
}

// ── P5 · Trabajador ↔ Contacto ───────────────────────────────
/**
 * Enlaza un trabajador con su contacto (mismo RUT). No crea contactos: un
 * trabajador no es cliente ni proveedor; solo si ya existe (p.ej. también
 * emite boletas) se le agrega el rol 'trabajador'.
 */
function conexTrabajadorEnlazar(t) {
    if (!t || !t.rut || typeof contactoPorRut !== 'function') return null;
    const c = contactoPorRut(t.rut);
    if (!c) return null;
    const roles = new Set(typeof contactoRoles === 'function' ? contactoRoles(c) : (c.roles || []));
    if (!roles.has('trabajador')) {
        roles.add('trabajador');
        c.roles = [...roles];
        if (typeof guardarContactos === 'function') guardarContactos();
    }
    t.contacto_id = c.id;
    return c;
}

/** Todo lo que existe para un RUT, desde un solo lugar. */
function conexHistorialPorRut(rut) {
    const n = _cxRut(rut);
    if (!n) return null;
    const eq = r => _cxRut(r) === n;
    const trabajadores = (() => { try { return JSON.parse(localStorage.getItem('rem_trabajadores') || '[]'); } catch { return []; } })();
    return {
        contacto:      typeof contactoPorRut === 'function' ? contactoPorRut(rut) : null,
        trabajador:    trabajadores.find(t => eq(t.rut)) || null,
        compras:       CX_LIBROS.compras.arr().filter(r => eq(r.rut_proveedor)),
        ventas:        CX_LIBROS.ventas.arr().filter(r => eq(r.rut_cliente)),
        honorarios:    _cxDocs().filter(d => d.categoria === 'honorarios' && eq(d.rut)),
        remuneraciones: _cxAsientosArr().filter(a => a.origen === 'remuneraciones' && eq(a.trabajador_rut)),
    };
}

// ═════════════════════════════════════════════════════════════
//  Arranque y recarga por cliente
// ═════════════════════════════════════════════════════════════
function _cxAlCargarDatos() {
    try { conexEnlazarDocumentosExistentes(); } catch (e) { console.warn('Enlace documentos:', e); }
    try {
        const trab = JSON.parse(localStorage.getItem('rem_trabajadores') || '[]');
        let cambio = false;
        trab.forEach(t => { const antes = t.contacto_id; conexTrabajadorEnlazar(t); if (t.contacto_id !== antes) cambio = true; });
        if (cambio) localStorage.setItem('rem_trabajadores', JSON.stringify(trab));
    } catch (e) { console.warn('Enlace trabajadores:', e); }
}
ContappEventos.escuchar('cliente:datos-cargados', _cxAlCargarDatos);
document.addEventListener('DOMContentLoaded', _cxAlCargarDatos);

window.conexDocDestino                  = conexDocDestino;
window.conexDocPasarALibro              = conexDocPasarALibro;
window.conexDocSincronizar              = conexDocSincronizar;
window.conexLibroAnulado                = conexLibroAnulado;
window.conexEnlazarDocumentosExistentes = conexEnlazarDocumentosExistentes;
window.conexRegistroLibro               = conexRegistroLibro;
window.conexCartolaSugerencias          = conexCartolaSugerencias;
window.conexCartolaAplicarDocumento     = conexCartolaAplicarDocumento;
window.conexCartolaDesvincular          = conexCartolaDesvincular;
window.conexSincronizarInventario       = conexSincronizarInventario;
window.conexCostoVenta                  = conexCostoVenta;
window.conexCuentasActivoFijo           = conexCuentasActivoFijo;
window.conexVidaUtilSugerida            = conexVidaUtilSugerida;
window.conexSincronizarActivo           = conexSincronizarActivo;
window.conexCuentaCargoCompra           = conexCuentaCargoCompra;
window.conexDespuesDeGuardarLibro       = conexDespuesDeGuardarLibro;
window.conexFormPoblar                  = conexFormPoblar;
window.conexFormLeer                    = conexFormLeer;
window.conexFormProducto                = conexFormProducto;
window.conexFormToggleActivo            = conexFormToggleActivo;
window.conexAsegurarCuenta              = conexAsegurarCuenta;
window.conexHonorarioRetencion          = conexHonorarioRetencion;
window.conexHonorarioContabilizar       = conexHonorarioContabilizar;
window.conexRemuneracionesPorPagar      = conexRemuneracionesPorPagar;
window.conexPreviredDetalle             = conexPreviredDetalle;
window.conexPreviredPorPagar            = conexPreviredPorPagar;
window.conexPreviredRegistrarPago       = conexPreviredRegistrarPago;
window.conexTrabajadorEnlazar           = conexTrabajadorEnlazar;
window.conexHistorialPorRut             = conexHistorialPorRut;
window.CX_CTA_REM_POR_PAGAR             = CX_CTA_REM_POR_PAGAR;
