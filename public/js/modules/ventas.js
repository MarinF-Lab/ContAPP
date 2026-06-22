'use strict';
/**
 * ventas.js — Libro de Ventas (formato SII Chile)
 * Registro detallado de documentos de venta y generación
 * de asiento centralizado mensual en el Libro Diario.
 */

let dbVentas = JSON.parse(localStorage.getItem('core_ventas')) || [];

let ventasMes  = new Date().getMonth() + 1;
let ventasAnio = new Date().getFullYear();

const TIPOS_DOC_VENTA = [
    { value: 'factura',       label: 'Factura',         afecta_iva: true  },
    { value: 'boleta',        label: 'Boleta',          afecta_iva: true  },
    { value: 'nota_debito',   label: 'Nota de Débito',  afecta_iva: true  },
    { value: 'nota_credito',  label: 'Nota de Crédito', afecta_iva: true  },
    { value: 'factura_exenta',label: 'Factura Exenta',  afecta_iva: false },
    { value: 'boleta_exenta', label: 'Boleta Exenta',   afecta_iva: false },
];

const MEDIOS_PAGO_VENTA = [
    { value: 'credito',        label: 'A Crédito',              cuenta: 'Clientes'                  },
    { value: 'contado',        label: 'Al Contado (Efectivo)',  cuenta: 'Caja'                      },
    { value: 'transferencia',  label: 'Transferencia Bancaria', cuenta: 'Banco'                     },
    { value: 'cheque',         label: 'Cheque',                 cuenta: 'Banco'                     },
    { value: 'tarjeta_debito', label: 'Tarjeta Débito',         cuenta: 'Banco'                     },
    { value: 'tarjeta_credito',label: 'Tarjeta Crédito',        cuenta: 'Banco'                     },
    { value: 'letra',          label: 'Letra de Cambio',        cuenta: 'Letras por Cobrar'         },
    { value: 'compensacion',   label: 'Compensación',           cuenta: 'Clientes'                  },
    { value: 'doc_cobrar',     label: 'Doc. por Cobrar',        cuenta: 'Documentos por Cobrar'     },
];

function _cuentaDebito(medioPago) {
    const mp = MEDIOS_PAGO_VENTA.find(m => m.value === medioPago);
    return mp ? mp.cuenta : 'Clientes';
}

function _labelMedioPagoVenta(v) {
    return MEDIOS_PAGO_VENTA.find(m => m.value === v)?.label || v || '—';
}

// ─────────────────────────────────────────────────────────────
//  PERSISTENCIA
// ─────────────────────────────────────────────────────────────
function guardarVentas() {
    localStorage.setItem('core_ventas', JSON.stringify(dbVentas));
    window.dbVentas = dbVentas;
}

// ─────────────────────────────────────────────────────────────
//  FILTRO
// ─────────────────────────────────────────────────────────────
function getVentasMes() {
    return dbVentas.filter(v => {
        if (!v.fecha || !v.fecha.includes('/')) return false;
        const [, m, a] = v.fecha.split('/');
        return parseInt(m) === ventasMes && parseInt(a) === ventasAnio;
    });
}

// ─────────────────────────────────────────────────────────────
//  RENDER PRINCIPAL
// ─────────────────────────────────────────────────────────────
function renderVentas() {
    _poblarSelectoresVentas();
    _poblarCuentasVentas();

    const tbody = document.getElementById('tbodyVentas');
    if (!tbody) return;

    const datos = getVentasMes();
    tbody.innerHTML = '';

    let corr = 1;
    let totExento = 0, totNeto = 0, totIva = 0, totTotal = 0;
    let totFacturas = 0, totBoletas = 0;

    if (!datos.length) {
        tbody.innerHTML = `
        <tr>
            <td colspan="12" style="text-align:center;padding:36px;color:var(--text-muted);">
                Sin documentos registrados para ${_vNombreMes(ventasMes)} ${ventasAnio}
            </td>
        </tr>`;
    } else {
        datos.forEach(v => {
            const info    = TIPOS_DOC_VENTA.find(t => t.value === v.tipo_doc) || { label: v.tipo_doc };
            const anulada = v.estado === 'anulada';

            if (!anulada) {
                const _nc = v.tipo_doc === 'nota_credito' ? -1 : 1;
                totExento += _nc * (v.exento || 0);
                totNeto   += _nc * (v.neto   || 0);
                totIva    += _nc * (v.iva    || 0);
                totTotal  += _nc * (v.total  || 0);
                if (v.tipo_doc === 'factura') totFacturas += v.total || 0;
                if (v.tipo_doc === 'boleta')  totBoletas  += v.total || 0;
            }

            tbody.innerHTML += `
            <tr class="${anulada ? 'fila-anulada' : ''}">
                <td class="monto" style="color:#94a3b8;">${anulada ? '—' : corr++}</td>
                <td><span class="badge-doc badge-doc-venta">${info.label}</span></td>
                <td class="monto">${v.numero_doc || '—'}</td>
                <td>${v.fecha}</td>
                <td style="font-family:monospace;font-size:12px;">${v.rut_cliente || ''}</td>
                <td style="max-width:180px;">${v.nombre_cliente || ''}</td>
                <td style="font-size:12px;color:#64748b;">${_labelMedioPagoVenta(v.medio_pago)}</td>
                <td class="monto">${v.exento ? '$' + fmt(v.exento) : '—'}</td>
                <td class="monto">$${fmt(v.neto   || 0)}</td>
                <td class="monto">$${fmt(v.iva    || 0)}</td>
                <td class="monto" style="font-weight:700;">$${fmt(v.total || 0)}</td>
                <td>
                    ${anulada
                        ? `<span class="badge-inactivo">Anulada</span>`
                        : `<button class="btn-plan btn-plan-eliminar"
                                onclick="anularVenta(${v.id})">Anular</button>`
                    }
                </td>
            </tr>`;
        });
    }

    // Totales en tfoot
    const tfoot = document.getElementById('tfootVentas');
    if (tfoot) {
        tfoot.innerHTML = `
        <tr class="fila-totales">
            <td colspan="7" style="text-align:right;padding:12px 16px;font-weight:700;">
                TOTALES — ${_vNombreMes(ventasMes)} ${ventasAnio}
            </td>
            <td class="monto">$${fmt(totExento)}</td>
            <td class="monto">$${fmt(totNeto)}</td>
            <td class="monto">$${fmt(totIva)}</td>
            <td class="monto" style="font-weight:800;font-size:15px;">$${fmt(totTotal)}</td>
            <td></td>
        </tr>`;
    }

    // KPIs
    _vSetTxt('ventasResNeto',      '$' + fmt(totNeto));
    _vSetTxt('ventasResIva',       '$' + fmt(totIva));
    _vSetTxt('ventasResTotal',     '$' + fmt(totTotal));
    _vSetTxt('ventasResFacturas',  '$' + fmt(totFacturas));
    _vSetTxt('ventasResBoletas',   '$' + fmt(totBoletas));

    // Resumen F29
    const _ncIvaDF = datos
        .filter(v => v.estado !== 'anulada' && v.tipo_doc === 'nota_credito')
        .reduce((s, v) => s + (v.iva || 0), 0);
    _renderResumenF29(totNeto, totIva, totExento, _ncIvaDF);
}

function _renderResumenF29(neto, iva, exento, ncIva) {
    const div = document.getElementById('resumenF29');
    if (!div) return;
    const ncIvaAmt = ncIva || 0;
    div.innerHTML = `
    <table class="cont-table" style="font-size:13px;max-width:500px;">
        <thead>
            <tr><th colspan="2">Resumen IVA — ${_vNombreMes(ventasMes)} ${ventasAnio}</th></tr>
        </thead>
        <tbody>
            <tr><td>Ventas Afectas (Neto)</td>    <td class="monto">$${fmt(neto)}</td></tr>
            <tr><td>Ventas Exentas</td>            <td class="monto">$${fmt(exento)}</td></tr>
            ${ncIvaAmt > 0 ? `<tr style="color:#dc2626;font-size:12px;">
                <td>IVA Notas de Crédito emitidas (${ivaPct()}%)</td>
                <td class="monto">-$${fmt(ncIvaAmt)}</td></tr>` : ''}
            <tr><td style="color:#dc2626;font-weight:600;">IVA Débito Fiscal Neto (${ivaPct()}%)</td>
                <td class="monto" style="color:#dc2626;font-weight:700;">$${fmt(iva)}</td></tr>
        </tbody>
        <tfoot>
            <tr style="font-weight:800;">
                <td>Total Ventas Neto</td>
                <td class="monto">$${fmt(neto + exento + iva)}</td>
            </tr>
        </tfoot>
    </table>`;
}

// ─────────────────────────────────────────────────────────────
//  MODAL — NUEVA VENTA
// ─────────────────────────────────────────────────────────────
function abrirNuevaVenta() {
    _limpiarFormVenta();
    document.getElementById('modalVenta').style.display = 'flex';
}

function cerrarModalVenta() {
    document.getElementById('modalVenta').style.display = 'none';
}

// Adjunto temporal mientras el modal está abierto
let _ventaAdjuntoTemp = null;

function _limpiarFormVenta() {
    _vSetVal('ventaFecha',      _vHoy());
    _vSetVal('ventaTipoDoc',    'factura');
    _vSetVal('ventaNumDoc',     '');
    _vSetVal('ventaRut',        '');
    _vSetVal('ventaNombre',     '');
    _vSetVal('ventaMedioPago',  'credito');
    _vSetVal('ventaExento',     '');
    _vSetVal('ventaNeto',       '');
    _vSetVal('ventaIva',        '');
    _vSetVal('ventaTotal',      '');
    _vSetVal('ventaGlosa',      '');
    _vSetVal('ventaEstado',     'pendiente');
    _ventaAdjuntoTemp = null;
    _actualizarBadgeAdjuntoVenta();
}

function adjuntarArchivoVenta() {
    if (typeof adjuntarArchivo === 'function') {
        adjuntarArchivo(resultado => {
            _ventaAdjuntoTemp = resultado;
            _actualizarBadgeAdjuntoVenta();
            // 6.1 — Leer factura con IA automáticamente
            if (resultado && typeof iaLeerFactura === 'function') {
                iaLeerFactura(resultado.ruta, resultado.nombre, 'venta');
            }
        });
    }
}

function abrirAdjuntoVenta() {
    if (_ventaAdjuntoTemp?.ruta && typeof abrirAdjunto === 'function') {
        abrirAdjunto(_ventaAdjuntoTemp.ruta);
    }
}

function eliminarAdjuntoVenta() {
    _ventaAdjuntoTemp = null;
    _actualizarBadgeAdjuntoVenta();
}

function _actualizarBadgeAdjuntoVenta() {
    const badge = document.getElementById('ventaAdjuntoBadge');
    const btnEl = document.getElementById('ventaAdjuntoEliminar');
    if (!badge) return;
    if (_ventaAdjuntoTemp) {
        badge.textContent = '📄 ' + _ventaAdjuntoTemp.nombre;
        badge.style.display = 'inline-flex';
        if (btnEl) btnEl.style.display = 'inline-block';
    } else {
        badge.style.display = 'none';
        if (btnEl) btnEl.style.display = 'none';
    }
}

// ─── CÁLCULOS BIDIRECCIONALES ────────────────────────────────

function calcularDesdeTotalVenta() {
    const total  = parseFloat(document.getElementById('ventaTotal')?.value)   || 0;
    const exento = parseFloat(document.getElementById('ventaExento')?.value)  || 0;
    if (total <= 0) return;
    const afecto = Math.max(0, total - exento);
    const neto   = Math.round(afecto / factorIva());
    const iva    = afecto - neto;
    _vSetVal('ventaNeto', neto);
    _vSetVal('ventaIva',  iva);
}

function calcularDesdeNetoVenta() {
    const neto   = parseFloat(document.getElementById('ventaNeto')?.value)    || 0;
    const exento = parseFloat(document.getElementById('ventaExento')?.value)  || 0;
    if (neto <= 0) return;
    const iva   = Math.round(neto * tasaIva());
    _vSetVal('ventaIva',   iva);
    _vSetVal('ventaTotal', neto + iva + exento);
}

function calcularDesdeIvaVenta() {
    const iva    = parseFloat(document.getElementById('ventaIva')?.value)     || 0;
    const exento = parseFloat(document.getElementById('ventaExento')?.value)  || 0;
    if (iva <= 0) return;
    const neto  = Math.round(iva / tasaIva());
    _vSetVal('ventaNeto',  neto);
    _vSetVal('ventaTotal', neto + iva + exento);
}

function calcularDesdeExentoVenta() {
    const neto   = parseFloat(document.getElementById('ventaNeto')?.value)    || 0;
    const iva    = parseFloat(document.getElementById('ventaIva')?.value)     || 0;
    const exento = parseFloat(document.getElementById('ventaExento')?.value)  || 0;
    _vSetVal('ventaTotal', neto + iva + exento);
}

// Alias legacy
function calcularDesdeVentaTotal()   { calcularDesdeTotalVenta(); }
function calcularDesdeVentaNetoIva() { calcularDesdeNetoVenta();  }

function guardarVenta() {
    if (typeof puedeEscribir === 'function' && !puedeEscribir()) {
        return mostrarToast('Sin permiso para registrar ventas.', 'error');
    }
    const fecha   = _vGetVal('ventaFecha');
    const tipoDoc = _vGetVal('ventaTipoDoc');
    const nombre  = _vGetVal('ventaNombre');
    const total   = parseFloat(_vGetVal('ventaTotal'))   || 0;
    const neto    = parseFloat(_vGetVal('ventaNeto'))    || 0;
    const iva     = parseFloat(_vGetVal('ventaIva'))     || 0;
    const exento  = parseFloat(_vGetVal('ventaExento'))  || 0;

    if (!fecha)   return mostrarToast('Ingrese la fecha del documento.', 'error');
    if (!tipoDoc) return mostrarToast('Seleccione el tipo de documento.', 'error');
    if (total <= 0) return mostrarToast('El monto total debe ser mayor a 0.', 'error');

    // Validación duplicado
    const numDoc = _vGetVal('ventaNumDoc');
    const rut    = _vGetVal('ventaRut');
    if (numDoc) {
        const dup = dbVentas.find(v =>
            v.estado !== 'anulada' &&
            v.numero_doc === numDoc &&
            v.tipo_doc   === tipoDoc &&
            (rut ? v.rut_cliente === rut : v.nombre_cliente === nombre)
        );
        if (dup) {
            const continuar = confirm(
                `⚠️ Ya existe un documento ${tipoDoc} N°${numDoc} para este cliente (registrado el ${dup.fecha}).\n\n¿Desea registrarlo de todas formas?`
            );
            if (!continuar) return;
        }
    }

    const fd = fecha.split('-');
    const fechaFmt = fd.length === 3 ? `${fd[2]}/${fd[1]}/${fd[0]}` : fecha;
    const mesNum   = fd.length === 3 ? parseInt(fd[1], 10) : ventasMes;
    const anioNum  = fd.length === 3 ? parseInt(fd[0], 10) : ventasAnio;

    const venta = {
        id:             Date.now(),
        fecha:          fechaFmt,
        mes:            mesNum,
        anio:           anioNum,
        tipo_doc:       tipoDoc,
        numero_doc:     _vGetVal('ventaNumDoc'),
        rut_cliente:    _vGetVal('ventaRut'),
        nombre_cliente: nombre,
        medio_pago:     _vGetVal('ventaMedioPago') || 'credito',
        exento,
        neto,
        iva,
        total,
        glosa:          _vGetVal('ventaGlosa'),
        estado:         _vGetVal('ventaEstado') || 'pendiente',
        adjunto:        _ventaAdjuntoTemp || null,
        asiento_id:     null,
    };

    dbVentas.push(venta);
    guardarVentas();
    cerrarModalVenta();
    renderVentas();
    if (typeof audit === 'function') audit('crear', 'ventas', { folio: venta.numero_doc, cliente: nombre, total });
    mostrarToast('Venta registrada correctamente.', 'ok');
}

function anularVenta(id) {
    const v = dbVentas.find(x => x.id === id);
    if (!v) return;
    if (!confirm(`¿Anular ${v.tipo_doc} N°${v.numero_doc || '?'} de ${v.nombre_cliente || 'sin nombre'}?`)) return;
    v.estado = 'anulada';
    guardarVentas();
    renderVentas();
    mostrarToast('Documento anulado.', 'ok');
}

// ─────────────────────────────────────────────────────────────
//  ASIENTO CENTRALIZADO DE VENTAS
// ─────────────────────────────────────────────────────────────
function generarAsientoVentas() {
    const datos = getVentasMes().filter(v => v.estado !== 'anulada');

    if (!datos.length) {
        return mostrarToast('No hay documentos activos para centralizar.', 'error');
    }

    const normales  = datos.filter(v => v.tipo_doc !== 'nota_credito');
    const notasCred = datos.filter(v => v.tipo_doc === 'nota_credito');

    const ctaIngreso = document.getElementById('ventaCtaIngreso')?.value || 'Ingresos por Ventas';

    const movMap = {};
    const addMov = (cuenta, debe, haber) => {
        if (!movMap[cuenta]) movMap[cuenta] = { cuenta, debe: 0, haber: 0 };
        movMap[cuenta].debe  += debe;
        movMap[cuenta].haber += haber;
    };

    // Ventas normales: DEBE cuentas cobro, HABER Ingresos + IVA DF
    const totNeto   = normales.reduce((s, v) => s + (v.neto   || 0), 0);
    const totIva    = normales.reduce((s, v) => s + (v.iva    || 0), 0);
    const totExento = normales.reduce((s, v) => s + (v.exento || 0), 0);
    normales.forEach(v => addMov(_cuentaDebito(v.medio_pago), v.total || 0, 0));
    if (totNeto + totExento > 0) addMov(ctaIngreso, 0, totNeto + totExento);
    if (totIva > 0)              addMov('IVA Débito Fiscal', 0, totIva);

    // Notas de crédito emitidas: HABER cuentas cobro, DEBE Ingresos + IVA DF
    const ncNeto   = notasCred.reduce((s, v) => s + (v.neto   || 0), 0);
    const ncIva    = notasCred.reduce((s, v) => s + (v.iva    || 0), 0);
    const ncExento = notasCred.reduce((s, v) => s + (v.exento || 0), 0);
    notasCred.forEach(v => addMov(_cuentaDebito(v.medio_pago), 0, v.total || 0));
    if (ncNeto + ncExento > 0) addMov(ctaIngreso, ncNeto + ncExento, 0);
    if (ncIva  > 0)            addMov('IVA Débito Fiscal', ncIva, 0);

    const totTotal = normales.reduce((s, v) => s + (v.total || 0), 0)
                   - notasCred.reduce((s, v) => s + (v.total || 0), 0);

    const movimientos = Object.values(movMap).filter(m => m.debe > 0 || m.haber > 0);

    const fechaUltimo = `${String(_vUltimoDia(ventasMes, ventasAnio)).padStart(2,'0')}/${String(ventasMes).padStart(2,'0')}/${ventasAnio}`;

    const clientesUnicos  = [...new Set(datos.map(v => v.nombre_cliente).filter(Boolean))];
    const contactoResumen = clientesUnicos.length === 1
        ? clientesUnicos[0]
        : `${clientesUnicos.length} clientes`;

    const glosaBase = `Centralización Ventas ${_vNombreMes(ventasMes)} ${ventasAnio}`;
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
function _poblarSelectoresVentas() {
    const selMes  = document.getElementById('selVentasMes');
    const selAnio = document.getElementById('selVentasAnio');
    if (selMes  && parseInt(selMes.value)  !== ventasMes)  selMes.value  = ventasMes;
    if (selAnio && parseInt(selAnio.value) !== ventasAnio) selAnio.value = ventasAnio;
}

function _poblarCuentasVentas() {
    const cuentas = Object.keys(PLAN_CUENTAS).filter(n => PLAN_CUENTAS[n].estado !== 'INACTIVA');
    const sel = document.getElementById('ventaCtaIngreso');
    if (sel && !sel.dataset.poblado) {
        const valorActual = sel.value;
        sel.innerHTML = cuentas.map(c => `<option value="${c}">${c}</option>`).join('');
        if (valorActual) sel.value = valorActual;
        sel.dataset.poblado = '1';
    }
    const ing = document.getElementById('ventaCtaIngreso');
    if (ing && !ing.value) ing.value = 'Ingresos por Ventas';
}

function _vNombreMes(n) {
    return ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
            'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][n - 1] || '';
}

function _vUltimoDia(mes, anio) { return new Date(anio, mes, 0).getDate(); }
function _vHoy()                { return new Date().toISOString().slice(0, 10); }
function _vSetVal(id, v)        { const e = document.getElementById(id); if (e) e.value = v; }
function _vGetVal(id)           { return document.getElementById(id)?.value?.trim() || ''; }
function _vSetTxt(id, v)        { const e = document.getElementById(id); if (e) e.textContent = v; }

function vaciarLibroVentas() {
    if (!confirm('¿Vaciar TODO el libro de ventas? Esta acción no se puede deshacer.')) return;
    dbVentas.length = 0;
    localStorage.setItem('core_ventas', JSON.stringify(dbVentas));
    window.dbVentas = dbVentas;
    renderVentas();
    mostrarToast('Libro de ventas vaciado.', 'ok');
}

window.dbVentas = dbVentas;
