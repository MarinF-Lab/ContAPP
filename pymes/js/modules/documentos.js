'use strict';
/**
 * documentos.js — Registro de Documentación
 * Archivo centralizado de facturas, boletas y honorarios
 * separado por categoría contable.
 */

// ─────────────────────────────────────────────────────────────
//  CATÁLOGO DE CATEGORÍAS
// ─────────────────────────────────────────────────────────────
const DOC_CATEGORIAS = [
    { value: 'todos',           label: 'Todos',             icon: '📁', dir: null       },
    { value: 'compra_materia',  label: 'F. Materia Prima',  icon: '📦', dir: 'entrada'  },
    { value: 'compra_servicio', label: 'F. Servicio',       icon: '🔧', dir: 'entrada'  },
    { value: 'honorarios',      label: 'Honorarios',        icon: '📒', dir: 'entrada'  },
    { value: 'venta_boleta',    label: 'Boletas Venta',     icon: '🧾', dir: 'salida'   },
    { value: 'venta_factura',   label: 'Facturas Venta',    icon: '💰', dir: 'salida'   },
];

const DOC_ESTADOS = [
    { value: 'pendiente', label: 'Pendiente', color: '#f59e0b' },
    { value: 'pagada',    label: 'Pagada',    color: '#10b981' },
    { value: 'anulada',   label: 'Anulada',   color: '#94a3b8' },
];

// ─────────────────────────────────────────────────────────────
//  ESTADO
// ─────────────────────────────────────────────────────────────
let dbDocumentos = JSON.parse(localStorage.getItem('core_documentos') || '[]');

let docState = {
    filtroCategoria: 'todos',
    buscar:          '',
    mesFiltro:       0,     // 0 = todos los meses
    anioFiltro:      new Date().getFullYear(),
    adjuntoTemp:     null,
};

// ─────────────────────────────────────────────────────────────
//  PERSISTENCIA
// ─────────────────────────────────────────────────────────────
function guardarDocumentos() {
    localStorage.setItem('core_documentos', JSON.stringify(dbDocumentos));
}

// ─────────────────────────────────────────────────────────────
//  HELPERS INTERNOS
// ─────────────────────────────────────────────────────────────
function _docCat(value) {
    return DOC_CATEGORIAS.find(c => c.value === value) || DOC_CATEGORIAS[0];
}
function _docEstado(value) {
    return DOC_ESTADOS.find(e => e.value === value) || DOC_ESTADOS[0];
}
function _docHoy() { return new Date().toISOString().slice(0, 10); }
function _docSetVal(id, v) { const e = document.getElementById(id); if (e) e.value = v; }
function _docGetVal(id)    { return document.getElementById(id)?.value?.trim() || ''; }
function _docSetTxt(id, v) { const e = document.getElementById(id); if (e) e.textContent = v; }

function _docFechaStr(isoDate) {
    const [y, m, d] = (isoDate || '').split('-');
    return d && m && y ? `${d}/${m}/${y}` : isoDate || '';
}
function _docMesAnio(fechaStr) {
    const p = (fechaStr || '').split('/');
    if (p.length === 3) return { mes: parseInt(p[1]), anio: parseInt(p[2]) };
    const q = (fechaStr || '').split('-');
    if (q.length === 3) return { mes: parseInt(q[1]), anio: parseInt(q[0]) };
    return { mes: 0, anio: 0 };
}

function _docNombreMes(n) {
    return ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
            'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][n - 1] || 'Todos';
}

// ─────────────────────────────────────────────────────────────
//  FILTRADO
// ─────────────────────────────────────────────────────────────
function _docFiltrados() {
    const { filtroCategoria, buscar, mesFiltro, anioFiltro } = docState;
    return dbDocumentos.filter(d => {
        if (filtroCategoria !== 'todos' && d.categoria !== filtroCategoria) return false;
        const { mes, anio } = _docMesAnio(d.fecha);
        if (anioFiltro && anio !== anioFiltro)                   return false;
        if (mesFiltro  && mes  !== mesFiltro)                    return false;
        if (buscar) {
            const q = buscar.toLowerCase();
            if (!( (d.nombre || '').toLowerCase().includes(q) ||
                   (d.rut    || '').includes(q) ||
                   (d.numero_doc || '').includes(q) ||
                   (d.glosa || '').toLowerCase().includes(q) ))  return false;
        }
        return true;
    });
}

// ─────────────────────────────────────────────────────────────
//  RENDER PRINCIPAL
// ─────────────────────────────────────────────────────────────
function renderDocumentos() {
    const cont = document.getElementById('view-documentos');
    if (!cont) return;
    cont.innerHTML = _docHtml();
}

function _docHtml() {
    const docs     = _docFiltrados();
    const activos  = docs.filter(d => d.estado !== 'anulada');
    const totTotal = activos.reduce((s, d) => s + (d.total || 0), 0);
    const totIva   = activos.reduce((s, d) => s + (d.iva   || 0), 0);
    const totNeto  = activos.reduce((s, d) => s + (d.neto  || 0), 0);

    const anios = [...new Set(dbDocumentos.map(d => _docMesAnio(d.fecha).anio).filter(Boolean))].sort().reverse();
    if (!anios.includes(new Date().getFullYear())) anios.unshift(new Date().getFullYear());

    const selAnio = `<select onchange="docSetAnio(this.value)"
        style="padding:7px 12px;border:1px solid var(--divider);border-radius:8px;
               font-size:13px;font-family:inherit;background:var(--input-bg);color:var(--text);">
        ${anios.map(a => `<option value="${a}" ${a === docState.anioFiltro ? 'selected' : ''}>${a}</option>`).join('')}
    </select>`;

    const selMes = `<select onchange="docSetMes(this.value)"
        style="padding:7px 12px;border:1px solid var(--divider);border-radius:8px;
               font-size:13px;font-family:inherit;background:var(--input-bg);color:var(--text);">
        <option value="0" ${!docState.mesFiltro ? 'selected' : ''}>Todos los meses</option>
        ${Array.from({length:12},(_,i)=>i+1).map(m =>
            `<option value="${m}" ${m === docState.mesFiltro ? 'selected' : ''}>${_docNombreMes(m)}</option>`
        ).join('')}
    </select>`;

    // Pestañas de categoría
    const tabs = DOC_CATEGORIAS.map(cat => {
        const count = cat.value === 'todos'
            ? dbDocumentos.filter(d => d.estado !== 'anulada').length
            : dbDocumentos.filter(d => d.categoria === cat.value && d.estado !== 'anulada').length;
        const active = docState.filtroCategoria === cat.value;
        return `<button onclick="docSetCategoria('${cat.value}')"
            style="display:flex;align-items:center;gap:6px;padding:8px 16px;
                   border-radius:8px;font-size:13px;font-family:inherit;cursor:pointer;
                   border:1.5px solid ${active ? 'var(--accent)' : 'var(--divider)'};
                   background:${active ? 'var(--accent)' : 'var(--input-bg)'};
                   color:${active ? '#fff' : 'var(--text)'};font-weight:${active ? '700' : '400'};">
            ${cat.icon} ${cat.label}
            <span style="background:${active ? 'rgba(255,255,255,.25)' : 'var(--divider)'};
                         color:${active ? '#fff' : 'var(--text-muted)'};padding:1px 7px;
                         border-radius:12px;font-size:11px;">${count}</span>
        </button>`;
    }).join('');

    // KPIs
    const kpis = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;margin-bottom:22px;">
        <div style="background:var(--card);border:1px solid var(--card-border);border-radius:12px;padding:16px 20px;">
            <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;">Documentos</div>
            <div style="font-size:24px;font-weight:800;color:var(--text);margin-top:4px;">${activos.length}</div>
        </div>
        <div style="background:var(--card);border:1px solid var(--card-border);border-radius:12px;padding:16px 20px;">
            <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;">Neto total</div>
            <div style="font-size:20px;font-weight:800;color:var(--text);margin-top:4px;">$${fmt(totNeto)}</div>
        </div>
        <div style="background:var(--card);border:1px solid var(--card-border);border-radius:12px;padding:16px 20px;">
            <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;">IVA</div>
            <div style="font-size:20px;font-weight:800;color:#2563eb;margin-top:4px;">$${fmt(totIva)}</div>
        </div>
        <div style="background:var(--card);border:1px solid var(--card-border);border-radius:12px;padding:16px 20px;">
            <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;">Total</div>
            <div style="font-size:20px;font-weight:800;color:var(--positive);margin-top:4px;">$${fmt(totTotal)}</div>
        </div>
    </div>`;

    // Tabla de documentos
    const filas = docs.length ? docs.map(d => {
        const cat    = _docCat(d.categoria);
        const est    = _docEstado(d.estado);
        const esNC   = d.anulada;
        return `<tr style="${d.estado === 'anulada' ? 'opacity:.5;' : ''}">
            <td>
                <div style="display:flex;align-items:center;gap:8px;">
                    <span style="font-size:18px;">${cat.icon}</span>
                    <div>
                        <div style="font-size:12px;font-weight:700;color:var(--text);">${cat.label}</div>
                        <div style="font-size:11px;color:var(--text-muted);">${cat.dir === 'entrada' ? 'Entrada' : cat.dir === 'salida' ? 'Salida' : '—'}</div>
                    </div>
                </div>
            </td>
            <td style="font-family:monospace;font-size:12px;">${d.numero_doc || '—'}</td>
            <td>${d.fecha || '—'}</td>
            <td>
                <div style="font-weight:600;font-size:13px;">${d.nombre || '—'}</div>
                ${d.rut ? `<div style="font-size:11px;color:var(--text-muted);font-family:monospace;">${d.rut}</div>` : ''}
            </td>
            <td class="monto">$${fmt(d.neto || 0)}</td>
            <td class="monto" style="color:#2563eb;">$${fmt(d.iva || 0)}</td>
            <td class="monto" style="font-weight:700;">$${fmt(d.total || 0)}</td>
            <td>
                <span style="background:${est.color}22;color:${est.color};border:1px solid ${est.color}55;
                             padding:3px 9px;border-radius:6px;font-size:11px;font-weight:700;">
                    ${est.label}
                </span>
            </td>
            <td>
                <div style="display:flex;gap:5px;align-items:center;">
                    ${d.adjunto ? `<button onclick="docAbrirAdjunto(${d.id})"
                        style="border:1px solid var(--divider);background:var(--input-bg);
                               border-radius:6px;padding:4px 8px;cursor:pointer;font-size:12px;"
                        title="Ver adjunto">📄</button>` : ''}
                    ${d.estado === 'pendiente' ? `
                    <button onclick="docMarcarPagada(${d.id})"
                        style="border:1px solid #10b98155;background:#10b98111;color:#10b981;
                               border-radius:6px;padding:4px 9px;cursor:pointer;font-size:12px;font-family:inherit;">
                        ✔ Pagar</button>` : ''}
                    ${d.estado !== 'anulada' ? `
                    <button onclick="docAnular(${d.id})"
                        style="border:1px solid #fca5a5;background:var(--negative-soft);
                               border-radius:6px;padding:4px 8px;cursor:pointer;font-size:12px;">
                        Anular</button>` : ''}
                </div>
            </td>
        </tr>`;
    }).join('') : `<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--text-muted);">
        Sin documentos para los filtros seleccionados.
    </td></tr>`;

    return `
<div style="padding:4px 0;">

    <!-- KPIs -->
    ${kpis}

    <!-- Filtros y búsqueda -->
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap;">
        <input placeholder="Buscar por nombre, RUT o N° doc…"
            value="${docState.buscar.replace(/"/g,'&quot;')}"
            oninput="docBuscar(this.value)"
            style="flex:1;min-width:200px;padding:9px 14px;border:1px solid var(--divider);
                   border-radius:8px;font-size:13px;font-family:inherit;
                   background:var(--input-bg);color:var(--text);">
        ${selMes}
        ${selAnio}
        <button class="btn btn-primary" style="padding:9px 18px;font-size:13px;white-space:nowrap;"
            onclick="abrirNuevoDocumento()">
            + Nuevo documento
        </button>
    </div>

    <!-- Tabs de categoría -->
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px;">
        ${tabs}
    </div>

    <!-- Tabla -->
    <div style="background:var(--card);border:1px solid var(--card-border);border-radius:12px;overflow:hidden;">
        <table class="cont-table" style="margin:0;">
            <thead>
                <tr>
                    <th>Categoría</th>
                    <th>N° Doc.</th>
                    <th>Fecha</th>
                    <th>Proveedor / Cliente</th>
                    <th class="monto">Neto</th>
                    <th class="monto">IVA</th>
                    <th class="monto">Total</th>
                    <th>Estado</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>${filas}</tbody>
        </table>
    </div>
</div>

<!-- Modal nuevo documento -->
<div id="modalDocumento" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);
     z-index:5000;align-items:center;justify-content:center;padding:16px;">
    <div style="background:var(--card);border-radius:14px;box-shadow:var(--shadow-lg);
                max-width:640px;width:100%;max-height:92vh;overflow-y:auto;">
        <div style="padding:16px 22px;border-bottom:1px solid var(--divider);
                    display:flex;justify-content:space-between;align-items:center;
                    font-size:15px;font-weight:700;">
            <span>Nuevo documento</span>
            <button onclick="cerrarModalDocumento()"
                style="border:1px solid var(--divider);background:var(--input-bg);
                       border-radius:6px;padding:4px 12px;cursor:pointer;font-family:inherit;">✕</button>
        </div>
        <div style="padding:22px;display:grid;gap:14px;">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
                <div>
                    <label class="ctc-label">Categoría *</label>
                    <select id="docCategoria" class="ctc-input"
                        onchange="docActualizarFormulario()">
                        ${DOC_CATEGORIAS.filter(c=>c.value!=='todos').map(c=>
                            `<option value="${c.value}">${c.icon} ${c.label}</option>`
                        ).join('')}
                    </select>
                </div>
                <div>
                    <label class="ctc-label">Fecha *</label>
                    <input id="docFecha" type="date" class="ctc-input">
                </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
                <div>
                    <label class="ctc-label">N° Documento</label>
                    <input id="docNumeroDoc" type="text" class="ctc-input" placeholder="001, F-1234…">
                </div>
                <div>
                    <label class="ctc-label">RUT</label>
                    <input id="docRut" type="text" class="ctc-input" placeholder="12.345.678-9">
                </div>
            </div>
            <div>
                <label class="ctc-label" id="docNombreLabel">Proveedor / Emisor *</label>
                <input id="docNombre" type="text" class="ctc-input" placeholder="Razón social">
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;">
                <div>
                    <label class="ctc-label">Neto</label>
                    <input id="docNeto" type="number" class="ctc-input" placeholder="0"
                        oninput="docCalcDesdeNeto()">
                </div>
                <div id="docFilaIva">
                    <label class="ctc-label">IVA (${ivaPct()}%)</label>
                    <input id="docIva" type="number" class="ctc-input" placeholder="0"
                        oninput="docCalcDesdeIva()">
                </div>
                <div>
                    <label class="ctc-label">Total *</label>
                    <input id="docTotal" type="number" class="ctc-input" placeholder="0"
                        oninput="docCalcDesdeTotal()">
                </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
                <div>
                    <label class="ctc-label">Estado</label>
                    <select id="docEstado" class="ctc-input">
                        ${DOC_ESTADOS.map(e=>`<option value="${e.value}">${e.label}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label class="ctc-label">Glosa</label>
                    <input id="docGlosa" type="text" class="ctc-input" placeholder="Descripción…">
                </div>
            </div>
            <!-- Adjunto -->
            <div>
                <label class="ctc-label">Documento adjunto (PDF / imagen)</label>
                <div style="display:flex;gap:8px;align-items:center;">
                    <button onclick="docAdjuntarArchivo()"
                        style="padding:8px 14px;border:1.5px dashed var(--divider);border-radius:8px;
                               background:var(--input-bg);cursor:pointer;font-size:13px;font-family:inherit;">
                        📎 Adjuntar archivo
                    </button>
                    <span id="docAdjuntoBadge" style="display:none;font-size:12px;
                          background:var(--accent-soft);color:var(--accent);padding:4px 10px;
                          border-radius:6px;border:1px solid var(--accent-border);">
                    </span>
                </div>
            </div>
        </div>
        <div style="padding:16px 22px;border-top:1px solid var(--divider);
                    display:flex;justify-content:flex-end;gap:10px;">
            <button onclick="cerrarModalDocumento()"
                style="padding:9px 18px;border:1px solid var(--divider);background:var(--input-bg);
                       border-radius:8px;cursor:pointer;font-family:inherit;font-size:13px;color:var(--text);">
                Cancelar
            </button>
            <button class="btn btn-primary" onclick="guardarDocumento()"
                style="padding:9px 22px;font-size:13px;">
                💾 Guardar documento
            </button>
        </div>
    </div>
</div>`;
}

// ─────────────────────────────────────────────────────────────
//  MODAL — NUEVO DOCUMENTO
// ─────────────────────────────────────────────────────────────
function abrirNuevoDocumento() {
    _docSetVal('docCategoria',  docState.filtroCategoria !== 'todos' ? docState.filtroCategoria : 'compra_materia');
    _docSetVal('docFecha',      _docHoy());
    _docSetVal('docNumeroDoc',  '');
    _docSetVal('docRut',        '');
    _docSetVal('docNombre',     '');
    _docSetVal('docNeto',       '');
    _docSetVal('docIva',        '');
    _docSetVal('docTotal',      '');
    _docSetVal('docEstado',     'pendiente');
    _docSetVal('docGlosa',      '');
    docState.adjuntoTemp = null;
    _docActualizarBadge();
    docActualizarFormulario();
    document.getElementById('modalDocumento').style.display = 'flex';
}

function cerrarModalDocumento() {
    document.getElementById('modalDocumento').style.display = 'none';
}

function docActualizarFormulario() {
    const cat = _docGetVal('docCategoria');
    const info = _docCat(cat);
    const esHonorios = cat === 'honorarios';
    const esVenta = info.dir === 'salida';
    const lblEl = document.getElementById('docNombreLabel');
    if (lblEl) lblEl.textContent = esVenta ? 'Cliente *' : 'Proveedor / Emisor *';
    // Honorarios no generan IVA
    const filaIva = document.getElementById('docFilaIva');
    if (filaIva) filaIva.style.opacity = esHonorios ? '.4' : '1';
}

function docCalcDesdeNeto() {
    const cat    = _docGetVal('docCategoria');
    const neto   = parseFloat(document.getElementById('docNeto')?.value) || 0;
    const esHon  = cat === 'honorarios';
    if (neto <= 0 || esHon) { _docSetVal('docIva', 0); _docSetVal('docTotal', neto); return; }
    const iva    = Math.round(neto * tasaIva());
    _docSetVal('docIva',   iva);
    _docSetVal('docTotal', neto + iva);
}

function docCalcDesdeIva() {
    const iva   = parseFloat(document.getElementById('docIva')?.value) || 0;
    if (iva <= 0) return;
    const neto  = Math.round(iva / tasaIva());
    _docSetVal('docNeto',  neto);
    _docSetVal('docTotal', neto + iva);
}

function docCalcDesdeTotal() {
    const cat   = _docGetVal('docCategoria');
    const total = parseFloat(document.getElementById('docTotal')?.value) || 0;
    const esHon = cat === 'honorarios';
    if (total <= 0) return;
    if (esHon) { _docSetVal('docNeto', total); _docSetVal('docIva', 0); return; }
    const neto  = Math.round(total / factorIva());
    _docSetVal('docNeto', neto);
    _docSetVal('docIva',  total - neto);
}

function docAdjuntarArchivo() {
    if (typeof adjuntarArchivo === 'function') {
        adjuntarArchivo(res => {
            docState.adjuntoTemp = res;
            _docActualizarBadge();
        });
    }
}

function _docActualizarBadge() {
    const badge = document.getElementById('docAdjuntoBadge');
    if (!badge) return;
    if (docState.adjuntoTemp) {
        badge.textContent = '📄 ' + docState.adjuntoTemp.nombre;
        badge.style.display = 'inline-block';
    } else {
        badge.style.display = 'none';
    }
}

function guardarDocumento() {
    const categoria  = _docGetVal('docCategoria');
    const fecha      = _docGetVal('docFecha');
    const nombre     = _docGetVal('docNombre');
    const total      = parseFloat(_docGetVal('docTotal')) || 0;

    if (!fecha)   return mostrarToast('Ingrese la fecha del documento.', 'error');
    if (!nombre)  return mostrarToast('Ingrese el nombre del proveedor o cliente.', 'error');
    if (total <= 0) return mostrarToast('El monto total debe ser mayor a 0.', 'error');

    const neto  = parseFloat(_docGetVal('docNeto')) || 0;
    const iva   = parseFloat(_docGetVal('docIva'))  || 0;

    const doc = {
        id:         Date.now(),
        categoria,
        fecha:      _docFechaStr(fecha),
        numero_doc: _docGetVal('docNumeroDoc'),
        rut:        _docGetVal('docRut'),
        nombre,
        neto,
        iva,
        total,
        estado:     _docGetVal('docEstado') || 'pendiente',
        glosa:      _docGetVal('docGlosa'),
        adjunto:    docState.adjuntoTemp || null,
        created_at: Date.now(),
    };

    dbDocumentos.push(doc);
    guardarDocumentos();
    cerrarModalDocumento();
    renderDocumentos();
    mostrarToast('Documento registrado correctamente.', 'ok');
    if (typeof audit === 'function') audit('crear', 'documentos', { categoria, nombre, total });
}

// ─────────────────────────────────────────────────────────────
//  ACCIONES
// ─────────────────────────────────────────────────────────────
function docMarcarPagada(id) {
    const d = dbDocumentos.find(x => x.id === id);
    if (!d) return;
    d.estado = 'pagada';
    guardarDocumentos();
    renderDocumentos();
    mostrarToast('Documento marcado como pagado.', 'ok');
}

function docAnular(id) {
    const d = dbDocumentos.find(x => x.id === id);
    if (!d) return;
    if (!confirm(`¿Anular documento N°${d.numero_doc || '?'} de ${d.nombre}?`)) return;
    d.estado = 'anulada';
    guardarDocumentos();
    renderDocumentos();
    mostrarToast('Documento anulado.', 'ok');
}

function docAbrirAdjunto(id) {
    const d = dbDocumentos.find(x => x.id === id);
    if (!d?.adjunto) return;
    if (d.adjunto.ruta && typeof abrirAdjunto === 'function') abrirAdjunto(d.adjunto.ruta);
    else if (d.adjunto.base64) {
        const a = document.createElement('a');
        a.href     = d.adjunto.base64;
        a.download = d.adjunto.nombre || 'documento';
        a.click();
    }
}

// ─────────────────────────────────────────────────────────────
//  FILTROS
// ─────────────────────────────────────────────────────────────
function docSetCategoria(v) { docState.filtroCategoria = v; renderDocumentos(); }
function docBuscar(v)       { docState.buscar = v; renderDocumentos(); }
function docSetMes(v)       { docState.mesFiltro  = parseInt(v) || 0; renderDocumentos(); }
function docSetAnio(v)      { docState.anioFiltro = parseInt(v) || 0; renderDocumentos(); }
