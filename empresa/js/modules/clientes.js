'use strict';
/**
 * clientes.js — Registro de Clientes y Proveedores
 * Directorio completo con historial de documentos y saldo de cuenta corriente.
 */

let dbContactos = JSON.parse(localStorage.getItem('core_contactos')) || [];

let filtroContactos  = 'todos';
let busqContactos    = '';
let contactoEditando = null;
let tabDetalleActiva = 'info';
let contactoDetalleId = null;

const TIPO_BADGE = {
    cliente:   { label: 'Cliente',      bg: '#d1fae5', color: '#065f46' },
    proveedor: { label: 'Proveedor',    bg: '#fef3c7', color: '#92400e' },
    ambos:     { label: 'Cli./Prov.',   bg: '#dbeafe', color: '#1e40af' },
};

// Normaliza RUT para comparaciones: elimina puntos, guiones y espacios,
// devuelve dígitos + dígito verificador en mayúscula.
function _normRut(rut) {
    return (rut || '').replace(/[^0-9kK]/gi, '').toUpperCase();
}

// Compara dos RUTs ignorando formato
function _rutMatch(a, b) {
    if (!a || !b) return false;
    return _normRut(a) === _normRut(b);
}

const MEDIOS_LABEL = {
    contado:       'Al Contado',
    transferencia: 'Transferencia',
    cheque:        'Cheque',
    tarjeta:       'Tarjeta',
    credito:       'A Crédito',
    doc_pagar:     'Doc. por Pagar',
    doc_cobrar:    'Doc. por Cobrar',
};

// ─────────────────────────────────────────────────────────────
//  PERSISTENCIA
// ─────────────────────────────────────────────────────────────
function guardarContactos() {
    localStorage.setItem('core_contactos', JSON.stringify(dbContactos));
    window.dbContactos = dbContactos;
}

// ─────────────────────────────────────────────────────────────
//  RENDER LISTA
// ─────────────────────────────────────────────────────────────
function renderContactos() {
    const tbody = document.getElementById('tbodyContactos');
    if (!tbody) return;

    const busq  = busqContactos.toLowerCase();
    const lista = dbContactos.filter(c => {
        if (!c.activo) return false;
        if (filtroContactos !== 'todos' && c.tipo !== filtroContactos && c.tipo !== 'ambos') return false;
        if (busq) return (
            (c.rut          || '').toLowerCase().includes(busq) ||
            (c.nombre       || '').toLowerCase().includes(busq) ||
            (c.fantasia      || '').toLowerCase().includes(busq) ||
            (c.giro         || '').toLowerCase().includes(busq)
        );
        return true;
    });

    tbody.innerHTML = '';

    if (!lista.length) {
        tbody.innerHTML = `
        <tr>
            <td colspan="9" style="text-align:center;padding:36px;color:var(--text-muted);">
                ${busq ? `Sin resultados para "<strong>${busq}</strong>"` : 'Sin contactos registrados. Use ➕ Nuevo Contacto.'}
            </td>
        </tr>`;
    } else {
        lista.forEach(c => {
            const badge  = TIPO_BADGE[c.tipo] || TIPO_BADGE.cliente;
            const saldo  = _calcularSaldo(c);
            const tieneDeuda   = saldo.credito > 0;
            const tieneCobrar  = saldo.cobrar  > 0;

            tbody.innerHTML += `
            <tr style="cursor:pointer;" onclick="verDetalleContacto(${c.id})">
                <td style="font-family:monospace;font-size:12px;">${c.rut || '—'}</td>
                <td>
                    <div style="font-weight:600;">${c.nombre}</div>
                    ${c.fantasia ? `<div style="font-size:11px;color:var(--text-muted);">${c.fantasia}</div>` : ''}
                </td>
                <td>
                    <span style="background:${badge.bg};color:${badge.color};
                        padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;">
                        ${badge.label}
                    </span>
                </td>
                <td style="font-size:12px;">${c.tipoEmpresa || '—'}</td>
                <td style="color:var(--text-muted);font-size:12px;">${c.giro || '—'}</td>
                <td style="font-size:12px;">${c.telefono || c.movil || '—'}</td>
                <td style="font-size:12px;">${c.email || '—'}</td>
                <td class="monto" style="font-size:12px;">
                    ${tieneDeuda   ? `<span style="color:#dc2626;font-weight:700;">-$${fmt(saldo.credito)}</span><br>` : ''}
                    ${tieneCobrar  ? `<span style="color:#16a34a;font-weight:700;">+$${fmt(saldo.cobrar)}</span>`  : ''}
                    ${!tieneDeuda && !tieneCobrar ? '<span style="color:#94a3b8;">—</span>' : ''}
                </td>
                <td onclick="event.stopPropagation()">
                    <div class="plan-acciones">
                        <button class="btn-plan btn-plan-editar"
                            onclick="editarContacto(${c.id})">✏️</button>
                        <button class="btn-plan btn-plan-eliminar"
                            onclick="eliminarContacto(${c.id})">🗑️</button>
                    </div>
                </td>
            </tr>`;
        });
    }

    // Contadores en tabs
    const todos  = dbContactos.filter(c => c.activo).length;
    const clis   = dbContactos.filter(c => c.activo && (c.tipo === 'cliente'   || c.tipo === 'ambos')).length;
    const provs  = dbContactos.filter(c => c.activo && (c.tipo === 'proveedor' || c.tipo === 'ambos')).length;
    _setTxt('cntTodos',       todos);
    _setTxt('cntClientes',    clis);
    _setTxt('cntProveedores', provs);
}

// ─────────────────────────────────────────────────────────────
//  MODAL CREAR / EDITAR
// ─────────────────────────────────────────────────────────────
function abrirNuevoContacto() {
    contactoEditando = null;
    _limpiarFormContacto();
    _setTxt('tituloModalContacto', 'Nuevo Contacto');
    document.getElementById('modalContacto').style.display = 'flex';
}

function editarContacto(id) {
    const c = dbContactos.find(x => x.id === id);
    if (!c) return;
    contactoEditando = id;
    _setTxt('tituloModalContacto', 'Editar Contacto');

    _cSetVal('ctcRut',         c.rut         || '');
    _cSetVal('ctcTipo',        c.tipo        || 'cliente');
    _cSetVal('ctcTipoEmpresa', c.tipoEmpresa || 'EIRL');
    _cSetVal('ctcNombre',      c.nombre      || '');
    _cSetVal('ctcFantasia',    c.fantasia    || '');
    _cSetVal('ctcGiro',        c.giro        || '');
    _cSetVal('ctcCategoria',   c.categoria   || '');
    _cSetVal('ctcTelefono',    c.telefono    || '');
    _cSetVal('ctcMovil',       c.movil       || '');
    _cSetVal('ctcEmail',       c.email       || '');
    _cSetVal('ctcDireccion',   c.direccion   || '');
    _cSetVal('ctcComuna',      c.comuna      || '');
    _cSetVal('ctcRegion',      c.region      || '');

    const notas = document.getElementById('ctcNotas');
    if (notas) notas.value = c.notas || '';

    document.getElementById('modalContacto').style.display = 'flex';
}

function cerrarModalContacto() {
    document.getElementById('modalContacto').style.display = 'none';
}

function _limpiarFormContacto() {
    ['ctcRut','ctcNombre','ctcFantasia','ctcGiro',
     'ctcTelefono','ctcMovil','ctcEmail',
     'ctcDireccion','ctcComuna'].forEach(id => _cSetVal(id, ''));
    _cSetVal('ctcTipo',        'cliente');
    _cSetVal('ctcTipoEmpresa', 'EIRL');
    _cSetVal('ctcCategoria',   '');
    _cSetVal('ctcRegion',      '');
    const notas = document.getElementById('ctcNotas');
    if (notas) notas.value = '';
}

function guardarContacto() {
    const nombre = _cGetVal('ctcNombre');
    if (!nombre) return mostrarToast('Ingrese el nombre o razón social.', 'error');

    const datos = {
        rut:         _cGetVal('ctcRut'),
        tipo:        _cGetVal('ctcTipo')        || 'cliente',
        tipoEmpresa: _cGetVal('ctcTipoEmpresa') || '',
        nombre,
        fantasia:    _cGetVal('ctcFantasia'),
        giro:        _cGetVal('ctcGiro'),
        categoria:   _cGetVal('ctcCategoria'),
        telefono:    _cGetVal('ctcTelefono'),
        movil:       _cGetVal('ctcMovil'),
        email:       _cGetVal('ctcEmail'),
        direccion:   _cGetVal('ctcDireccion'),
        comuna:      _cGetVal('ctcComuna'),
        region:      _cGetVal('ctcRegion'),
        notas:       document.getElementById('ctcNotas')?.value?.trim() || '',
        activo:      true,
    };

    if (contactoEditando) {
        const idx = dbContactos.findIndex(c => c.id === contactoEditando);
        if (idx >= 0) dbContactos[idx] = { ...dbContactos[idx], ...datos };
    } else {
        if (datos.rut && dbContactos.some(c => c.activo && c.rut === datos.rut)) {
            return mostrarToast(`Ya existe un contacto con RUT ${datos.rut}.`, 'error');
        }
        dbContactos.push({ id: Date.now(), ...datos });
    }

    guardarContactos();
    cerrarModalContacto();
    renderContactos();
    mostrarToast(contactoEditando ? 'Contacto actualizado.' : 'Contacto registrado.', 'ok');
}

function eliminarContacto(id) {
    const c = dbContactos.find(x => x.id === id);
    if (!c) return;
    if (!confirm(`¿Eliminar "${c.nombre}"?`)) return;
    c.activo = false;
    guardarContactos();
    renderContactos();
    mostrarToast('Contacto eliminado.', 'ok');
}

// ─────────────────────────────────────────────────────────────
//  MODAL DETALLE
// ─────────────────────────────────────────────────────────────
function verDetalleContacto(id) {
    const c = dbContactos.find(x => x.id === id);
    if (!c) return;
    contactoDetalleId = id;

    _setTxt('detalleNombre', c.nombre + (c.fantasia ? ` — ${c.fantasia}` : ''));
    _setTxt('detalleRut',    c.rut || '—');
    _setTxt('detalleTipo',   TIPO_BADGE[c.tipo]?.label || c.tipo);
    _setTxt('detalleGiro',   c.giro || '—');
    _setTxt('detalleTel',    [c.telefono, c.movil].filter(Boolean).join(' / ') || '—');
    _setTxt('detalleEmail',  c.email || '—');
    _setTxt('detalleDirec',  [c.direccion, c.comuna, c.region].filter(Boolean).join(', ') || '—');

    tabDetalleActiva = 'info';
    _renderTabDetalle(c);
    document.getElementById('modalDetalleContacto').style.display = 'flex';
}

function cerrarDetalleContacto() {
    document.getElementById('modalDetalleContacto').style.display = 'none';
    contactoDetalleId = null;
}

function cambiarTabDetalle(tab) {
    tabDetalleActiva = tab;
    const c = contactoDetalleId ? dbContactos.find(x => x.id === contactoDetalleId) : null;
    if (c) _renderTabDetalle(c);
}

function _renderTabDetalle(c) {
    document.querySelectorAll('.tab-detalle-btn').forEach(b => {
        b.classList.toggle('tab-active', b.dataset.tab === tabDetalleActiva);
        b.setAttribute('onclick', `cambiarTabDetalle('${b.dataset.tab}')`);
    });

    const panel = document.getElementById('panelDetalleContenido');
    if (!panel) return;

    switch (tabDetalleActiva) {
        case 'info':    panel.innerHTML = _tabInfo(c);    break;
        case 'compras': panel.innerHTML = _tabDocs(c, 'compras'); break;
        case 'ventas':  panel.innerHTML = _tabDocs(c, 'ventas');  break;
        case 'saldo':   panel.innerHTML = _tabSaldo(c);   break;
    }
}

// ── Tab Información ─────────────────────────────────────────
function _tabInfo(c) {
    const fila = (label, val) => val
        ? `<tr><td class="ctc-info-label">${label}</td><td>${val}</td></tr>`
        : '';

    return `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start;">

        <div>
            <div class="ctc-info-bloque-title">Identificación</div>
            <table class="ctc-info-table">
                ${fila('RUT',          c.rut)}
                ${fila('Tipo Empresa', c.tipoEmpresa)}
                ${fila('Giro',         c.giro)}
                ${fila('Categoría',    c.categoria)}
            </table>
        </div>

        <div>
            <div class="ctc-info-bloque-title">Contacto y Ubicación</div>
            <table class="ctc-info-table">
                ${fila('Teléfono',      c.telefono)}
                ${fila('Móvil',         c.movil)}
                ${fila('Email',         c.email)}
                ${fila('Dirección',     c.direccion)}
                ${fila('Ciudad/Comuna', c.comuna)}
                ${fila('Región',        c.region)}
            </table>
        </div>

    </div>
    ${c.notas ? `
    <div style="margin-top:16px;padding:14px 16px;background:#f8fafc;border-radius:10px;
                border-left:3px solid var(--primary);">
        <div style="font-weight:700;font-size:11px;color:var(--text-muted);
                    letter-spacing:.05em;text-transform:uppercase;margin-bottom:6px;">Notas</div>
        <div style="font-size:14px;line-height:1.6;">${c.notas.replace(/\n/g, '<br>')}</div>
    </div>` : ''}`;
}

// ── Tab Documentos (compras o ventas) ───────────────────────
function _tabDocs(c, tipo) {
    const esCompra = tipo === 'compras';
    const docs = esCompra
        ? (window.dbCompras || []).filter(d => _rutMatch(d.rut_proveedor, c.rut) ||
              (!c.rut && d.nombre_proveedor && c.nombre &&
               d.nombre_proveedor.trim().toLowerCase() === c.nombre.trim().toLowerCase()))
        : (window.dbVentas  || []).filter(d => _rutMatch(d.rut_cliente, c.rut) ||
              (!c.rut && d.nombre_cliente && c.nombre &&
               d.nombre_cliente.trim().toLowerCase() === c.nombre.trim().toLowerCase()));

    if (!docs.length) return `
        <div style="text-align:center;padding:40px;color:var(--text-muted);">
            <div style="font-size:32px;margin-bottom:8px;">${esCompra ? '🛒' : '💰'}</div>
            Sin ${esCompra ? 'compras' : 'ventas'} registradas para este contacto.
        </div>`;

    let totExento = 0, totNeto = 0, totIva = 0, totTotal = 0;

    const filas = docs.map(d => {
        const anulada = d.estado === 'anulada';
        if (!anulada) {
            totExento += d.exento || 0;
            totNeto   += d.neto   || 0;
            totIva    += d.iva    || 0;
            totTotal  += d.total  || 0;
        }
        const estadoColor = {
            pendiente: '#f59e0b', pagada: '#16a34a', cobrada: '#16a34a', anulada: '#ef4444'
        };
        return `<tr class="${anulada ? 'fila-anulada' : ''}">
            <td>${d.fecha}</td>
            <td><span class="badge-doc ${esCompra ? 'badge-doc-compra' : 'badge-doc-venta'}"
                style="font-size:11px;">${d.tipo_doc?.replace('_',' ')}</span></td>
            <td style="font-family:monospace;font-size:12px;">${d.numero_doc || '—'}</td>
            <td style="font-size:12px;color:#64748b;">${MEDIOS_LABEL[d.medio_pago] || d.medio_pago || '—'}</td>
            <td class="monto">${d.exento ? '$' + fmt(d.exento) : '—'}</td>
            <td class="monto">$${fmt(d.neto   || 0)}</td>
            <td class="monto">$${fmt(d.iva    || 0)}</td>
            <td class="monto" style="font-weight:700;">$${fmt(d.total || 0)}</td>
            <td>
                <span style="font-size:11px;font-weight:700;color:${estadoColor[d.estado] || '#64748b'};">
                    ${d.estado || '—'}
                </span>
            </td>
            <td style="font-size:12px;color:var(--text-muted);max-width:140px;
                       overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"
                title="${d.glosa || ''}">${d.glosa || '—'}</td>
        </tr>`;
    }).join('');

    return `
    <div style="overflow-x:auto;">
        <table class="cont-table" style="font-size:12px;">
            <thead>
                <tr>
                    <th style="width:90px;">Fecha</th>
                    <th style="width:110px;">Tipo Doc.</th>
                    <th style="width:80px;">N° Doc.</th>
                    <th style="width:110px;">Medio Pago</th>
                    <th class="monto" style="width:85px;">Exento</th>
                    <th class="monto" style="width:95px;">Neto</th>
                    <th class="monto" style="width:85px;">IVA</th>
                    <th class="monto" style="width:100px;">Total</th>
                    <th style="width:75px;">Estado</th>
                    <th>Glosa</th>
                </tr>
            </thead>
            <tbody>${filas}</tbody>
            <tfoot>
                <tr class="fila-totales">
                    <td colspan="4" style="text-align:right;padding:10px 14px;font-weight:700;">
                        TOTALES (${docs.filter(d => d.estado !== 'anulada').length} documentos)
                    </td>
                    <td class="monto">$${fmt(totExento)}</td>
                    <td class="monto">$${fmt(totNeto)}</td>
                    <td class="monto">$${fmt(totIva)}</td>
                    <td class="monto" style="font-weight:800;font-size:14px;">$${fmt(totTotal)}</td>
                    <td colspan="2"></td>
                </tr>
            </tfoot>
        </table>
    </div>`;
}

// ── Tab Estado de Cuenta ─────────────────────────────────────
function _tabSaldo(c) {
    const saldo = _calcularSaldo(c);

    const comprasPend = (window.dbCompras || []).filter(d =>
        _rutMatch(d.rut_proveedor, c.rut) && d.estado === 'pendiente' && d.medio_pago === 'credito'
    );
    const ventasPend = (window.dbVentas || []).filter(d =>
        _rutMatch(d.rut_cliente, c.rut) && d.estado === 'pendiente' && d.medio_pago === 'credito'
    );

    const filasPend = (docs, esCompra) => docs.map(d => `
        <tr>
            <td>${d.fecha}</td>
            <td><span class="badge-doc ${esCompra ? 'badge-doc-compra' : 'badge-doc-venta'}"
                style="font-size:11px;">${d.tipo_doc?.replace('_',' ')}</span></td>
            <td style="font-family:monospace;font-size:12px;">${d.numero_doc || '—'}</td>
            <td class="monto" style="font-weight:700;color:${esCompra ? '#dc2626' : '#16a34a'};">
                $${fmt(d.total || 0)}
            </td>
        </tr>`).join('');

    return `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
        <div class="kpi-card" style="border-left:4px solid var(--negative);">
            <div class="kpi-label">Saldo pendiente (deuda proveedor)</div>
            <div class="kpi-valor" style="color:var(--negative);">$${fmt(saldo.credito)}</div>
            ${saldo.pagosProveedor > 0 ? `<div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Pagos registrados en diario: $${fmt(saldo.pagosProveedor)}</div>` : ''}
        </div>
        <div class="kpi-card" style="border-left:4px solid var(--positive);">
            <div class="kpi-label">Saldo pendiente (por cobrar cliente)</div>
            <div class="kpi-valor" style="color:var(--positive);">$${fmt(saldo.cobrar)}</div>
            ${saldo.cobrosCliente > 0 ? `<div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Cobros registrados en diario: $${fmt(saldo.cobrosCliente)}</div>` : ''}
        </div>
        <div class="kpi-card">
            <div class="kpi-label">Total histórico compras</div>
            <div class="kpi-valor">$${fmt(saldo.totalCompras)}</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">Total histórico ventas</div>
            <div class="kpi-valor">$${fmt(saldo.totalVentas)}</div>
        </div>
    </div>

    ${comprasPend.length ? `
    <div style="margin-bottom:16px;">
        <div style="font-weight:700;font-size:13px;margin-bottom:8px;color:#dc2626;">
            Compras pendientes de pago (${comprasPend.length})
        </div>
        <table class="cont-table" style="font-size:12px;">
            <thead><tr><th>Fecha</th><th>Tipo</th><th>N° Doc.</th><th class="monto">Total</th></tr></thead>
            <tbody>${filasPend(comprasPend, true)}</tbody>
        </table>
    </div>` : ''}

    ${ventasPend.length ? `
    <div>
        <div style="font-weight:700;font-size:13px;margin-bottom:8px;color:#16a34a;">
            Ventas pendientes de cobro (${ventasPend.length})
        </div>
        <table class="cont-table" style="font-size:12px;">
            <thead><tr><th>Fecha</th><th>Tipo</th><th>N° Doc.</th><th class="monto">Total</th></tr></thead>
            <tbody>${filasPend(ventasPend, false)}</tbody>
        </table>
    </div>` : ''}

    ${!comprasPend.length && !ventasPend.length ?
        `<div style="text-align:center;padding:20px;color:var(--text-muted);">
            ✅ Sin deudas ni cuentas por cobrar pendientes.
        </div>` : ''}`;
}

// ─────────────────────────────────────────────────────────────
//  CÁLCULO DE SALDO
// ─────────────────────────────────────────────────────────────
function _calcularSaldo(c) {
    // ── Libros de compras/ventas ──────────────────────────────
    const creditoLibros = (window.dbCompras || [])
        .filter(d => _rutMatch(d.rut_proveedor, c.rut) && d.estado === 'pendiente' && d.medio_pago === 'credito')
        .reduce((s, d) => s + (d.total || 0), 0);

    const cobrarLibros = (window.dbVentas || [])
        .filter(d => _rutMatch(d.rut_cliente, c.rut) && d.estado === 'pendiente' && d.medio_pago === 'credito')
        .reduce((s, d) => s + (d.total || 0), 0);

    // ── Pagos/cobros en el diario vinculados a este contacto ──
    const _matchContacto = (a) => {
        if (!a.contacto || a.estado === 'ANULADO') return false;
        const hay = a.contacto.toLowerCase();
        return hay.includes(c.nombre.toLowerCase()) || (c.rut && hay.includes(c.rut));
    };
    const asientosContacto = (window.dbAsientos || []).filter(_matchContacto);

    // Pagos a proveedores: "Proveedores" va al DEBE → salda deuda
    const pagosProveedor = asientosContacto
        .flatMap(a => a.movimientos)
        .filter(m => m.cuenta === 'Proveedores' || m.cuenta === 'Acreedores Varios')
        .reduce((s, m) => s + (m.debe || 0), 0);

    // Cobros de clientes: "Clientes" va al HABER → cobra factura
    const cobrosCliente = asientosContacto
        .flatMap(a => a.movimientos)
        .filter(m => m.cuenta === 'Clientes')
        .reduce((s, m) => s + (m.haber || 0), 0);

    const credito = Math.max(creditoLibros - pagosProveedor, 0);
    const cobrar  = Math.max(cobrarLibros  - cobrosCliente,  0);

    const totalCompras = (window.dbCompras || [])
        .filter(d => _rutMatch(d.rut_proveedor, c.rut) && d.estado !== 'anulada')
        .reduce((s, d) => s + (d.total || 0), 0);

    const totalVentas = (window.dbVentas || [])
        .filter(d => _rutMatch(d.rut_cliente, c.rut) && d.estado !== 'anulada')
        .reduce((s, d) => s + (d.total || 0), 0);

    return { credito, cobrar, totalCompras, totalVentas, pagosProveedor, cobrosCliente };
}

// ─────────────────────────────────────────────────────────────
//  AUTOCOMPLETE PARA MODALES DE COMPRAS / VENTAS
// ─────────────────────────────────────────────────────────────
function getProveedoresAC() {
    return dbContactos
        .filter(c => c.activo && (c.tipo === 'proveedor' || c.tipo === 'ambos'))
        .map(c => c.rut ? `${c.nombre} — ${c.rut}` : c.nombre);
}

function getClientesAC() {
    return dbContactos
        .filter(c => c.activo && (c.tipo === 'cliente' || c.tipo === 'ambos'))
        .map(c => c.rut ? `${c.nombre} — ${c.rut}` : c.nombre);
}

function _splitNombreRut(val) {
    // Usa lastIndexOf para no romperse si el nombre contiene " — "
    const sep = ' — ';
    const idx = val.lastIndexOf(sep);
    return idx >= 0
        ? { nombre: val.slice(0, idx).trim(), rut: val.slice(idx + sep.length).trim() }
        : { nombre: val.trim(), rut: '' };
}

function seleccionarContactoCompra(val) {
    const { nombre, rut } = _splitNombreRut(val);
    const el    = document.getElementById('compraNombre');
    const rutEl = document.getElementById('compraRut');
    if (el)    el.value    = nombre;
    if (rutEl) { rutEl.value = rut; if (window.fmtRut) window.fmtRut(rutEl); }
}

function seleccionarContactoVenta(val) {
    const { nombre, rut } = _splitNombreRut(val);
    const el    = document.getElementById('ventaNombre');
    const rutEl = document.getElementById('ventaRut');
    if (el)    el.value    = nombre;
    if (rutEl) { rutEl.value = rut; if (window.fmtRut) window.fmtRut(rutEl); }
}

function initContactoAutocomplete() {
    const inputCN = document.getElementById('compraNombre');
    const inputVN = document.getElementById('ventaNombre');
    if (inputCN && typeof initAutocomplete === 'function')
        initAutocomplete(inputCN, getProveedoresAC, seleccionarContactoCompra);
    if (inputVN && typeof initAutocomplete === 'function')
        initAutocomplete(inputVN, getClientesAC,   seleccionarContactoVenta);
}

// ─────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────
function _cSetVal(id, v)  { const e = document.getElementById(id); if (e) e.value = v; }
function _cGetVal(id)     { return document.getElementById(id)?.value?.trim() || ''; }
function _setTxt(id, v)   { const e = document.getElementById(id); if (e) e.textContent = v; }

function vaciarContactos() {
    if (!confirm('¿Vaciar TODO el directorio de contactos? Esta acción no se puede deshacer.')) return;
    dbContactos.length = 0;
    localStorage.setItem('core_contactos', JSON.stringify(dbContactos));
    window.dbContactos = dbContactos;
    renderContactos();
    mostrarToast('Directorio de contactos vaciado.', 'ok');
}

window.dbContactos = dbContactos;

// ─────────────────────────────────────────────────────────────
//  CONSULTA SII POR RUT — zeus.sii.cl
// ─────────────────────────────────────────────────────────────
async function consultarSII() {
    if (window.MODO_PRUEBA) {
        mostrarToast('🧪 Modo Prueba activo — consulta SII deshabilitada.', 'ok');
        return;
    }
    const rut    = _cGetVal('ctcRut');
    const elSII  = document.getElementById('ctcSiiEstado');
    const btnSII = document.getElementById('btnConsultarSII');

    if (!validarRutChileno(rut)) {
        if (elSII) { elSII.style.color = 'var(--negative)'; elSII.textContent = 'RUT inválido.'; }
        return;
    }

    const raw  = rut.replace(/[^0-9kK]/gi, '').toUpperCase();
    const dv   = raw.slice(-1);
    const body = raw.slice(0, -1);

    if (elSII)  { elSII.style.color = 'var(--accent)'; elSII.textContent = '⟳ Consultando SII…'; }
    if (btnSII) btnSII.disabled = true;

    try {
        const url = `https://zeus.sii.cl/cvc_cgi/stc/getstc?RUT=${body}&DV=${dv}`;
        const res = await fetch(url, { cache: 'no-cache' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const html  = await res.text();
        const parser = new DOMParser();
        const doc   = parser.parseFromString(html, 'text/html');
        const datos = _parsearRespuestaSII(doc);

        if (!datos) throw new Error('No se encontró información para este RUT.');

        if (datos.razonSocial) _cSetVal('ctcNombre',   datos.razonSocial);
        if (datos.giro)        _cSetVal('ctcGiro',      datos.giro);
        if (datos.direccion)   _cSetVal('ctcDireccion', datos.direccion);
        if (datos.comuna)      _cSetVal('ctcComuna',    datos.comuna);

        if (elSII) {
            elSII.style.color = 'var(--positive)';
            elSII.textContent = '✅ Datos cargados desde SII — puedes editarlos antes de guardar.';
        }
    } catch (e) {
        if (elSII) {
            elSII.style.color = 'var(--negative)';
            elSII.innerHTML   =
                `No se pudo consultar automáticamente (${e.message}). ` +
                `<a href="https://www.sii.cl/servicios_online/1047-busqueda_rut-1705.html" ` +
                `   target="_blank" rel="noopener" ` +
                `   style="color:var(--accent);text-decoration:underline;">Buscar en SII ↗</a>`;
        }
    } finally {
        if (btnSII) btnSII.disabled = false;
    }
}

function _parsearRespuestaSII(doc) {
    const texto = doc.body?.innerText || doc.body?.textContent || '';
    if (!texto || /no\s+encontrado|no\s+existe|rut\s+incorrecto/i.test(texto)) return null;

    const celdas   = [...doc.querySelectorAll('td')].map(td => td.textContent.trim());
    const _buscar  = (terminos) => {
        const idx = celdas.findIndex(c => terminos.some(t => c.toLowerCase().includes(t)));
        return idx >= 0 && idx + 1 < celdas.length ? celdas[idx + 1] : null;
    };
    const extraer  = (patron) => { const m = texto.match(patron); return m?.[1]?.trim() || null; };

    return {
        razonSocial: _buscar(['razón social', 'razon social']) || extraer(/razón social[:\s]+([^\n\r]+)/i),
        giro:        _buscar(['giro'])                          || extraer(/giro[:\s]+([^\n\r]+)/i),
        direccion:   _buscar(['direcci'])                       || extraer(/direcci[oó]n[:\s]+([^\n\r]+)/i),
        comuna:      _buscar(['comuna'])                        || null,
    };
}
