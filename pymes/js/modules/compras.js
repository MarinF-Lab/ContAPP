'use strict';
/**
 * compras.js — Libro de Compras (formato SII Chile)
 * Registro detallado de documentos de compra y generación
 * de asiento centralizado mensual en el Libro Diario.
 */

let dbCompras = JSON.parse(localStorage.getItem('core_compras')) || [];

let comprasMes  = new Date().getMonth() + 1;
let comprasAnio = new Date().getFullYear();

const TIPOS_DOC_COMPRA = [
    { value: 'factura',      label: 'Factura',              afecta_iva: true  },
    { value: 'nota_debito',  label: 'Nota de Débito',       afecta_iva: true  },
    { value: 'nota_credito', label: 'Nota de Crédito',      afecta_iva: true  },
    { value: 'liquidacion',  label: 'Liquid.-Factura',      afecta_iva: true  },
    { value: 'boleta',       label: 'Boleta',               afecta_iva: false },
    { value: 'guia',         label: 'Guía de Despacho',     afecta_iva: false },
];

const MEDIOS_PAGO_COMPRA = [
    { value: 'credito',        label: 'A Crédito',              cuenta: 'Proveedores'          },
    { value: 'contado',        label: 'Al Contado (Efectivo)',  cuenta: 'Caja'                 },
    { value: 'transferencia',  label: 'Transferencia Bancaria', cuenta: 'Banco'                },
    { value: 'cheque',         label: 'Cheque',                 cuenta: 'Banco'                },
    { value: 'tarjeta_debito', label: 'Tarjeta Débito',         cuenta: 'Banco'                },
    { value: 'tarjeta_credito',label: 'Tarjeta Crédito',        cuenta: 'Banco'                },
    { value: 'letra',          label: 'Letra de Cambio',        cuenta: 'Letras por Pagar'     },
    { value: 'compensacion',   label: 'Compensación',           cuenta: 'Proveedores'          },
    { value: 'doc_pagar',      label: 'Doc. por Pagar',         cuenta: 'Documentos por Pagar' },
];

function _cuentaAbono(medioPago) {
    const mp = MEDIOS_PAGO_COMPRA.find(m => m.value === medioPago);
    return mp ? mp.cuenta : 'Proveedores';
}

function _labelMedioPagoCompra(v) {
    return MEDIOS_PAGO_COMPRA.find(m => m.value === v)?.label || v || '—';
}

// ─────────────────────────────────────────────────────────────
//  PERSISTENCIA
// ─────────────────────────────────────────────────────────────
function guardarCompras() {
    localStorage.setItem('core_compras', JSON.stringify(dbCompras));
    window.dbCompras = dbCompras;
}

// ─────────────────────────────────────────────────────────────
//  FILTRO
// ─────────────────────────────────────────────────────────────
function getComprasMes() {
    return dbCompras.filter(c => {
        if (!c.fecha || !c.fecha.includes('/')) return false;
        const [, m, a] = c.fecha.split('/');
        return parseInt(m) === comprasMes && parseInt(a) === comprasAnio;
    });
}

// ─────────────────────────────────────────────────────────────
//  RENDER PRINCIPAL
// ─────────────────────────────────────────────────────────────
function renderCompras() {
    _poblarSelectoresCompras();
    _poblarCuentasCompras();

    const tbody = document.getElementById('tbodyCompras');
    if (!tbody) return;

    const datos = getComprasMes();
    tbody.innerHTML = '';

    let corr = 1;
    let totExento = 0, totNeto = 0, totIva = 0, totTotal = 0;

    if (!datos.length) {
        tbody.innerHTML = `
        <tr>
            <td colspan="12" style="text-align:center;padding:36px;color:var(--text-muted);">
                Sin documentos registrados para ${_nombreMes(comprasMes)} ${comprasAnio}
            </td>
        </tr>`;
    } else {
        datos.forEach(c => {
            const info    = TIPOS_DOC_COMPRA.find(t => t.value === c.tipo_doc) || { label: c.tipo_doc };
            const anulada = c.estado === 'anulada';

            if (!anulada) {
                const _nc = c.tipo_doc === 'nota_credito' ? -1 : 1;
                totExento += _nc * (c.exento || 0);
                totNeto   += _nc * (c.neto   || 0);
                totIva    += _nc * (c.iva    || 0);
                totTotal  += _nc * (c.total  || 0);
            }

            tbody.innerHTML += `
            <tr class="${anulada ? 'fila-anulada' : ''}">
                <td class="monto" style="color:#94a3b8;">${anulada ? '—' : corr++}</td>
                <td><span class="badge-doc badge-doc-compra">${info.label}</span></td>
                <td class="monto">${c.numero_doc || '—'}</td>
                <td>${c.fecha}</td>
                <td style="font-family:monospace;font-size:12px;">${c.rut_proveedor || ''}</td>
                <td style="max-width:180px;">${c.nombre_proveedor || ''}</td>
                <td style="font-size:12px;color:#64748b;">${_labelMedioPagoCompra(c.medio_pago)}</td>
                <td class="monto">${c.exento ? '$' + fmt(c.exento) : '—'}</td>
                <td class="monto">$${fmt(c.neto   || 0)}</td>
                <td class="monto">$${fmt(c.iva    || 0)}</td>
                <td class="monto" style="font-weight:700;">$${fmt(c.total || 0)}</td>
                <td>
                    ${anulada
                        ? `<span class="badge-inactivo">Anulada</span>`
                        : `<button class="btn-plan btn-plan-eliminar"
                                onclick="anularCompra(${c.id})">Anular</button>`
                    }
                </td>
            </tr>`;
        });
    }

    // Totales en tfoot
    const tfoot = document.getElementById('tfootCompras');
    if (tfoot) {
        tfoot.innerHTML = `
        <tr class="fila-totales">
            <td colspan="7" style="text-align:right;padding:12px 16px;font-weight:700;">
                TOTALES — ${_nombreMes(comprasMes)} ${comprasAnio}
            </td>
            <td class="monto">$${fmt(totExento)}</td>
            <td class="monto">$${fmt(totNeto)}</td>
            <td class="monto">$${fmt(totIva)}</td>
            <td class="monto" style="font-weight:800;font-size:15px;">$${fmt(totTotal)}</td>
            <td></td>
        </tr>`;
    }

    // KPIs del resumen
    _setTxt('comprasResNeto',   '$' + fmt(totNeto));
    _setTxt('comprasResIva',    '$' + fmt(totIva));
    _setTxt('comprasResTotal',  '$' + fmt(totTotal));

    // Resumen IVA Crédito Fiscal
    const _ncIvaCF = datos
        .filter(c => c.estado !== 'anulada' && c.tipo_doc === 'nota_credito')
        .reduce((s, c) => s + (c.iva || 0), 0);
    _renderResumenIvaCF(totExento, totNeto, totIva, _ncIvaCF);
}

function _renderResumenIvaCF(exento, neto, iva, ncIva) {
    const div = document.getElementById('resumenIvaCompras');
    if (!div) return;
    const ncIvaAmt = ncIva || 0;
    div.innerHTML = `
    <table class="cont-table" style="font-size:13px;max-width:500px;">
        <thead>
            <tr><th colspan="2">Resumen IVA — ${_nombreMes(comprasMes)} ${comprasAnio}</th></tr>
        </thead>
        <tbody>
            <tr><td>Compras Afectas (Neto)</td>
                <td class="monto">$${fmt(neto)}</td></tr>
            <tr><td>Compras Exentas</td>
                <td class="monto">$${fmt(exento)}</td></tr>
            ${ncIvaAmt > 0 ? `<tr style="color:#dc2626;font-size:12px;">
                <td>IVA Notas de Crédito recibidas (${ivaPct()}%)</td>
                <td class="monto">-$${fmt(ncIvaAmt)}</td></tr>` : ''}
            <tr><td style="color:#2563eb;font-weight:600;">IVA Crédito Fiscal Neto (${ivaPct()}%)</td>
                <td class="monto" style="color:#2563eb;font-weight:700;">$${fmt(iva)}</td></tr>
        </tbody>
        <tfoot>
            <tr style="font-weight:800;">
                <td>Total Compras Neto del Mes</td>
                <td class="monto">$${fmt(neto + exento + iva)}</td>
            </tr>
        </tfoot>
    </table>`;
}

// ─────────────────────────────────────────────────────────────
//  MODAL — NUEVA COMPRA
// ─────────────────────────────────────────────────────────────
function abrirNuevaCompra() {
    _limpiarFormCompra();
    document.getElementById('modalCompra').style.display = 'flex';
}

function cerrarModalCompra() {
    document.getElementById('modalCompra').style.display = 'none';
}

// Adjunto temporal mientras el modal está abierto
let _compraAdjuntoTemp = null;

function _limpiarFormCompra() {
    _setVal('compraFecha',      _hoy());
    _setVal('compraTipoDoc',    'factura');
    _setVal('compraNumDoc',     '');
    _setVal('compraRut',        '');
    _setVal('compraNombre',     '');
    _setVal('compraMedioPago',  'credito');
    _setVal('compraExento',     '');
    _setVal('compraNeto',       '');
    _setVal('compraIva',        '');
    _setVal('compraTotal',      '');
    _setVal('compraGlosa',      '');
    _setVal('compraEstado',     'pendiente');
    _compraAdjuntoTemp = null;
    _actualizarBadgeAdjuntoCompra();
    _actualizarEtiquetaIva();
}

function adjuntarArchivoCompra() {
    if (typeof adjuntarArchivo === 'function') {
        adjuntarArchivo(resultado => {
            _compraAdjuntoTemp = resultado;
            _actualizarBadgeAdjuntoCompra();
            // 6.1 — Leer factura con IA automáticamente
            if (resultado && typeof iaLeerFactura === 'function') {
                iaLeerFactura(resultado.ruta, resultado.nombre, 'compra');
            }
        });
    }
}

function abrirAdjuntoCompra() {
    if (_compraAdjuntoTemp?.ruta && typeof abrirAdjunto === 'function') {
        abrirAdjunto(_compraAdjuntoTemp.ruta);
    }
}

function eliminarAdjuntoCompra() {
    _compraAdjuntoTemp = null;
    _actualizarBadgeAdjuntoCompra();
}

function _actualizarBadgeAdjuntoCompra() {
    const badge = document.getElementById('compraAdjuntoBadge');
    const btnEl = document.getElementById('compraAdjuntoEliminar');
    if (!badge) return;
    if (_compraAdjuntoTemp) {
        badge.textContent = '📄 ' + _compraAdjuntoTemp.nombre;
        badge.style.display = 'inline-flex';
        if (btnEl) btnEl.style.display = 'inline-block';
    } else {
        badge.style.display = 'none';
        if (btnEl) btnEl.style.display = 'none';
    }
}

function _actualizarEtiquetaIva() {
    const tipo    = document.getElementById('compraTipoDoc')?.value;
    const infoDoc = TIPOS_DOC_COMPRA.find(t => t.value === tipo);
    const filaIva = document.getElementById('filaIvaCompra');
    if (filaIva) filaIva.style.display = infoDoc?.afecta_iva === false ? 'none' : '';
}

// ─── CÁLCULOS BIDIRECCIONALES ────────────────────────────────
// Cualquiera de los 3 campos recalcula los otros dos.

function calcularDesdeTotalCompra() {
    const total  = parseFloat(document.getElementById('compraTotal')?.value)   || 0;
    const exento = parseFloat(document.getElementById('compraExento')?.value)  || 0;
    if (total <= 0) return;
    const afecto = Math.max(0, total - exento);
    const neto   = Math.round(afecto / factorIva());
    const iva    = afecto - neto;
    _setVal('compraNeto', neto);
    _setVal('compraIva',  iva);
}

function calcularDesdeNetoCompra() {
    const neto   = parseFloat(document.getElementById('compraNeto')?.value)    || 0;
    const exento = parseFloat(document.getElementById('compraExento')?.value)  || 0;
    if (neto <= 0) return;
    const iva   = Math.round(neto * tasaIva());
    _setVal('compraIva',   iva);
    _setVal('compraTotal', neto + iva + exento);
}

function calcularDesdeIvaCompra() {
    const iva    = parseFloat(document.getElementById('compraIva')?.value)     || 0;
    const exento = parseFloat(document.getElementById('compraExento')?.value)  || 0;
    if (iva <= 0) return;
    const neto  = Math.round(iva / tasaIva());
    _setVal('compraNeto',  neto);
    _setVal('compraTotal', neto + iva + exento);
}

function calcularDesdeExentoCompra() {
    const neto   = parseFloat(document.getElementById('compraNeto')?.value)    || 0;
    const iva    = parseFloat(document.getElementById('compraIva')?.value)     || 0;
    const exento = parseFloat(document.getElementById('compraExento')?.value)  || 0;
    _setVal('compraTotal', neto + iva + exento);
}

// Alias legacy
function calcularDesdeTotal()   { calcularDesdeTotalCompra(); }
function calcularDesdeNetoIva() { calcularDesdeNetoCompra();  }

function guardarCompra() {
    if (typeof puedeEscribir === 'function' && !puedeEscribir()) {
        return mostrarToast('Sin permiso para registrar compras.', 'error');
    }
    const fecha   = _getVal('compraFecha');
    const tipoDoc = _getVal('compraTipoDoc');
    const nombre  = _getVal('compraNombre');
    const total   = parseFloat(_getVal('compraTotal'))   || 0;
    const neto    = parseFloat(_getVal('compraNeto'))    || 0;
    const iva     = parseFloat(_getVal('compraIva'))     || 0;
    const exento  = parseFloat(_getVal('compraExento'))  || 0;

    if (!fecha)   return mostrarToast('Ingrese la fecha del documento.', 'error');
    if (!tipoDoc) return mostrarToast('Seleccione el tipo de documento.', 'error');
    if (!nombre)  return mostrarToast('Ingrese la razón social del proveedor.', 'error');
    if (total <= 0) return mostrarToast('El monto total debe ser mayor a 0.', 'error');

    // Validación duplicado
    const numDoc = _getVal('compraNumDoc');
    const rut    = _getVal('compraRut');
    if (numDoc) {
        const dup = dbCompras.find(c =>
            c.estado !== 'anulada' &&
            c.numero_doc === numDoc &&
            c.tipo_doc   === tipoDoc &&
            (rut ? c.rut_proveedor === rut : c.nombre_proveedor === nombre)
        );
        if (dup) {
            const continuar = confirm(
                `⚠️ Ya existe un documento ${tipoDoc} N°${numDoc} para este proveedor (registrado el ${dup.fecha}).\n\n¿Desea registrarlo de todas formas?`
            );
            if (!continuar) return;
        }
    }

    const fd = fecha.split('-');
    const fechaFmt = fd.length === 3 ? `${fd[2]}/${fd[1]}/${fd[0]}` : fecha;
    const mesNum   = fd.length === 3 ? parseInt(fd[1], 10) : comprasMes;
    const anioNum  = fd.length === 3 ? parseInt(fd[0], 10) : comprasAnio;

    const compra = {
        id:               Date.now(),
        fecha:            fechaFmt,
        mes:              mesNum,
        anio:             anioNum,
        tipo_doc:         tipoDoc,
        numero_doc:       _getVal('compraNumDoc'),
        rut_proveedor:    _getVal('compraRut'),
        nombre_proveedor: nombre,
        medio_pago:       _getVal('compraMedioPago') || 'credito',
        exento,
        neto,
        iva,
        total,
        glosa:            _getVal('compraGlosa'),
        estado:           _getVal('compraEstado') || 'pendiente',
        adjunto:          _compraAdjuntoTemp || null,
        asiento_id:       null,
    };

    dbCompras.push(compra);
    guardarCompras();
    cerrarModalCompra();
    renderCompras();
    mostrarToast('Compra registrada correctamente.', 'ok');
    if (typeof audit === 'function') audit('crear', 'compras', { folio: compra.numero_doc, proveedor: nombre, total });
}

function anularCompra(id) {
    const c = dbCompras.find(x => x.id === id);
    if (!c) return;
    if (!confirm(`¿Anular ${c.tipo_doc} N°${c.numero_doc || '?'} de ${c.nombre_proveedor}?`)) return;
    c.estado = 'anulada';
    guardarCompras();
    renderCompras();
    mostrarToast('Documento anulado.', 'ok');
}

// ─────────────────────────────────────────────────────────────
//  ASIENTO CENTRALIZADO DE COMPRAS
// ─────────────────────────────────────────────────────────────
function generarAsientoCompras() {
    const datos = getComprasMes().filter(c => c.estado !== 'anulada');

    if (!datos.length) {
        return mostrarToast('No hay documentos activos para centralizar.', 'error');
    }

    const normales  = datos.filter(c => c.tipo_doc !== 'nota_credito');
    const notasCred = datos.filter(c => c.tipo_doc === 'nota_credito');

    const ctaCargo = document.getElementById('compraCtaCargo')?.value || 'Mercaderías';

    const movMap = {};
    const addMov = (cuenta, debe, haber) => {
        if (!movMap[cuenta]) movMap[cuenta] = { cuenta, debe: 0, haber: 0 };
        movMap[cuenta].debe  += debe;
        movMap[cuenta].haber += haber;
    };

    // Documentos normales: DEBE Mercaderías + IVA CF, HABER cuentas de pago
    const totNeto   = normales.reduce((s, c) => s + (c.neto   || 0), 0);
    const totIva    = normales.reduce((s, c) => s + (c.iva    || 0), 0);
    const totExento = normales.reduce((s, c) => s + (c.exento || 0), 0);
    if (totNeto + totExento > 0) addMov(ctaCargo, totNeto + totExento, 0);
    if (totIva  > 0)             addMov('IVA Crédito Fiscal', totIva, 0);
    normales.forEach(c => addMov(_cuentaAbono(c.medio_pago), 0, c.total || 0));

    // Notas de crédito recibidas: HABER Mercaderías + IVA CF, DEBE cuentas de pago
    const ncNeto   = notasCred.reduce((s, c) => s + (c.neto   || 0), 0);
    const ncIva    = notasCred.reduce((s, c) => s + (c.iva    || 0), 0);
    const ncExento = notasCred.reduce((s, c) => s + (c.exento || 0), 0);
    if (ncNeto + ncExento > 0) addMov(ctaCargo, 0, ncNeto + ncExento);
    if (ncIva  > 0)            addMov('IVA Crédito Fiscal', 0, ncIva);
    notasCred.forEach(c => addMov(_cuentaAbono(c.medio_pago), c.total || 0, 0));

    // totales para la glosa
    const totTotal = normales.reduce((s, c) => s + (c.total || 0), 0)
                   - notasCred.reduce((s, c) => s + (c.total || 0), 0);

    const movimientos = Object.values(movMap).filter(m => m.debe > 0 || m.haber > 0);

    const fechaUltimo = `${String(_ultimoDia(comprasMes, comprasAnio)).padStart(2,'0')}/${String(comprasMes).padStart(2,'0')}/${comprasAnio}`;

    const proveedoresUnicos = [...new Set(datos.map(c => c.nombre_proveedor).filter(Boolean))];
    const contactoResumen   = proveedoresUnicos.length === 1
        ? proveedoresUnicos[0]
        : `${proveedoresUnicos.length} proveedores`;

    const glosaBase = `Centralización Compras ${_nombreMes(comprasMes)} ${comprasAnio}`;
    const idxExist  = dbAsientos.findIndex(a => a.glosa && a.glosa.startsWith(glosaBase));

    let asiento;
    if (idxExist >= 0) {
        asiento = Object.assign(dbAsientos[idxExist], {
            fecha:       fechaUltimo,
            glosa:       `${glosaBase} — ${datos.length} doc(s)`,
            contacto:    contactoResumen,
            movimientos,
        });
        mostrarToast(`Asiento N°${asiento.numero} actualizado en el Libro Diario.`, 'ok');
    } else {
        asiento = {
            id:          Date.now(),
            numero:      _nextNumeroAsiento(),
            estado:      'ACTIVO',
            fecha:       fechaUltimo,
            glosa:       `${glosaBase} — ${datos.length} doc(s)`,
            contacto:    contactoResumen,
            movimientos,
        };
        dbAsientos.push(asiento);
        mostrarToast(`Asiento N°${asiento.numero} creado en el Libro Diario.`, 'ok');
    }

    localStorage.setItem('core_asientos', JSON.stringify(dbAsientos));
    if (typeof renderHistorialDiario === 'function') renderHistorialDiario();
    if (typeof generarLibroMayor     === 'function') generarLibroMayor();
}

// ─────────────────────────────────────────────────────────────
//  HELPERS INTERNOS
// ─────────────────────────────────────────────────────────────
function _poblarSelectoresCompras() {
    const selMes  = document.getElementById('selComprasMes');
    const selAnio = document.getElementById('selComprasAnio');
    if (selMes  && parseInt(selMes.value)  !== comprasMes)  selMes.value  = comprasMes;
    if (selAnio && parseInt(selAnio.value) !== comprasAnio) selAnio.value = comprasAnio;
}

function _poblarCuentasCompras() {
    const cuentas = Object.keys(PLAN_CUENTAS).filter(n => PLAN_CUENTAS[n].estado !== 'INACTIVA');
    const sel = document.getElementById('compraCtaCargo');
    if (sel && !sel.dataset.poblado) {
        const valorActual = sel.value;
        sel.innerHTML = cuentas.map(c => `<option value="${c}">${c}</option>`).join('');
        if (valorActual) sel.value = valorActual;
        sel.dataset.poblado = '1';
    }
    const cargo = document.getElementById('compraCtaCargo');
    if (cargo && !cargo.value) cargo.value = 'Mercaderías';
}

function _nombreMes(n) {
    return ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
            'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][n - 1] || '';
}

function _ultimoDia(mes, anio) { return new Date(anio, mes, 0).getDate(); }
function _hoy() { return new Date().toISOString().slice(0, 10); }
function _setVal(id, v) { const e = document.getElementById(id); if (e) e.value = v; }
function _getVal(id)    { return document.getElementById(id)?.value?.trim() || ''; }
function _setTxt(id, v) { const e = document.getElementById(id); if (e) e.textContent = v; }

function vaciarLibroCompras() {
    if (!confirm('¿Vaciar TODO el libro de compras? Esta acción no se puede deshacer.')) return;
    dbCompras.length = 0;
    localStorage.setItem('core_compras', JSON.stringify(dbCompras));
    window.dbCompras = dbCompras;
    renderCompras();
    mostrarToast('Libro de compras vaciado.', 'ok');
}

window.dbCompras = dbCompras;
