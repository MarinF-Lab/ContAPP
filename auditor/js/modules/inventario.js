'use strict';
// ─────────────────────────────────────────────────────────────────────────────
//  INVENTARIO — movimientos de stock (kardex): ingresos y egresos de producto
//  por bodega y centro de costo. El stock actual se DERIVA sumando movimientos
//  (mismo principio que el Libro Mayor deriva saldos sumando asientos — ver
//  recopilarMovimientosPorCuenta() en js/core/contabilidad.js — en vez de un
//  contador aparte que se puede desincronizar).
//
//  Los movimientos se alimentan de dos fuentes:
//  1. Automática: la calculadora de ítems del Diario (js/services/diario.js,
//     calcGenerar()) llama invRegistrarMovimiento() cuando un ítem de una
//     compra/venta trae producto + bodega.
//  2. Manual: botón "+ Registrar movimiento" acá mismo, para ajustes,
//     mermas o conteos físicos que no pasan por el Diario.
// ─────────────────────────────────────────────────────────────────────────────

const INV_KEY = 'core_inventario_movimientos';

const INV_TIPOS = {
    ingreso: { label: 'Ingreso', icon: '📥', color: 'var(--positive, #166534)' },
    egreso:  { label: 'Egreso',  icon: '📤', color: 'var(--negative, #991b1b)' },
};

function getMovimientosInventario() {
    try { return JSON.parse(localStorage.getItem(INV_KEY) || '[]'); }
    catch (e) { return []; }
}

function saveMovimientosInventario(arr) {
    localStorage.setItem(INV_KEY, JSON.stringify(arr));
}

function _invNuevoId() { return 'im' + Date.now() + Math.floor(Math.random() * 1000); }

// Registra un movimiento — usado tanto por el botón manual como por la
// calculadora del Diario (asientoId queda null para movimientos manuales).
function invRegistrarMovimiento({ tipo, producto, cantidad, bodega, centroCosto, fecha, glosa, asientoId }) {
    if (!producto || !cantidad || cantidad <= 0 || (tipo !== 'ingreso' && tipo !== 'egreso')) return null;

    const mov = {
        id: _invNuevoId(),
        tipo,
        producto: producto.trim(),
        cantidad: Number(cantidad),
        bodega: (bodega || '').trim(),
        centroCosto: (centroCosto || '').trim(),
        fecha: fecha || new Date().toISOString().slice(0, 10),
        glosa: glosa || '',
        asientoId: asientoId ?? null,
        created_at: Date.now(),
    };

    const arr = getMovimientosInventario();
    arr.push(mov);
    saveMovimientosInventario(arr);
    return mov;
}

// Stock actual por producto — opcionalmente filtrado a una bodega.
function invStockActual(producto, bodega) {
    const movs = getMovimientosInventario().filter(m =>
        m.producto.toLowerCase() === producto.toLowerCase() &&
        (!bodega || m.bodega.toLowerCase() === bodega.toLowerCase())
    );
    return movs.reduce((s, m) => s + (m.tipo === 'ingreso' ? m.cantidad : -m.cantidad), 0);
}

// Tabla de stock actual agrupada por producto + bodega, para el resumen de arriba.
function _invResumenStock() {
    const movs = getMovimientosInventario();
    const mapa = {};
    movs.forEach(m => {
        const key = m.producto + '||' + m.bodega;
        if (!mapa[key]) mapa[key] = { producto: m.producto, bodega: m.bodega, stock: 0 };
        mapa[key].stock += m.tipo === 'ingreso' ? m.cantidad : -m.cantidad;
    });
    return Object.values(mapa).sort((a, b) => a.producto.localeCompare(b.producto));
}

let _invFiltroProducto = '';
let _invFiltroBodega = '';
// Por defecto el mes actual — "Todos los meses" (0) es la opción explícita
// para ver el total acumulado, igual que en Honorarios/Diario.
let _invFiltroMes  = new Date().getMonth() + 1;
let _invFiltroAnio = new Date().getFullYear();

function renderMovimientosInventario() {
    const view = document.getElementById('tab-inv-movimientos');
    if (!view) return;

    const movs = getMovimientosInventario()
        .slice()
        .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '') || b.created_at - a.created_at);

    const bodegas = getBodegas();
    const resumen = _invResumenStock();

    const filtrados = movs.filter(m => {
        const okProd = !_invFiltroProducto || m.producto.toLowerCase().includes(_invFiltroProducto.toLowerCase());
        const okBod  = !_invFiltroBodega || m.bodega === _invFiltroBodega;
        const fecha  = m.fecha || '';
        const okMes  = !_invFiltroMes  || fecha.slice(5, 7) === String(_invFiltroMes).padStart(2, '0');
        const okAnio = !_invFiltroAnio || fecha.slice(0, 4) === String(_invFiltroAnio);
        return okProd && okBod && okMes && okAnio;
    });

    view.innerHTML = `
        <div class="card" style="margin-bottom:16px;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px;">
                <div>
                    <h2 style="margin:0 0 4px;">📦 Movimientos de Inventario</h2>
                    <p style="color:var(--text-muted);font-size:12px;margin:0;">Ingresos y egresos de stock — se registran solos desde compras/ventas con producto en la calculadora del Diario, o a mano acá.</p>
                </div>
                <button class="btn btn-primary" onclick="invAbrirForm()">+ Registrar movimiento</button>
            </div>

            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;">
                ${resumen.length ? resumen.map(r => `
                    <div style="padding:10px 12px;border:2px solid var(--border);border-radius:8px;">
                        <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">${r.bodega || 'Sin bodega'}</div>
                        <div style="font-weight:600;font-size:13px;margin:2px 0;">${r.producto}</div>
                        <div style="font-family:monospace;font-size:18px;font-weight:700;color:${r.stock < 0 ? 'var(--negative,#991b1b)' : 'var(--text)'};">${fmt(r.stock)}</div>
                    </div>`).join('') : '<div style="color:var(--text-muted);font-size:13px;padding:8px 0;">Sin movimientos registrados todavía — el stock actual va a aparecer acá.</div>'}
            </div>
        </div>

        <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
            <select id="invFiltroMes" class="sel-periodo" onchange="_invFiltroMes=parseInt(this.value); renderMovimientosInventario();">
                <option value="0" ${_invFiltroMes === 0 ? 'selected' : ''}>Todos los meses</option>
                ${[1,2,3,4,5,6,7,8,9,10,11,12].map(n => `<option value="${n}" ${_invFiltroMes === n ? 'selected' : ''}>${_nombreMes(n)}</option>`).join('')}
            </select>
            <select id="invFiltroAnio" class="sel-periodo" onchange="_invFiltroAnio=parseInt(this.value); renderMovimientosInventario();">
                ${[2023,2024,2025,2026,2027].map(a => `<option value="${a}" ${_invFiltroAnio === a ? 'selected' : ''}>${a}</option>`).join('')}
            </select>
            <input id="invFiltroProducto" class="input" style="flex:1;min-width:180px;padding:9px 14px;border:1px solid var(--border);border-radius:8px;"
                placeholder="🔍 Buscar por producto..." value="${_invFiltroProducto}"
                oninput="_invFiltroProducto=this.value; renderMovimientosInventario();">
            <select id="invFiltroBodega" style="padding:9px 14px;border:1px solid var(--border);border-radius:8px;"
                onchange="_invFiltroBodega=this.value; renderMovimientosInventario();">
                <option value="">Todas las bodegas</option>
                ${bodegas.map(b => `<option value="${b.nombre}" ${_invFiltroBodega === b.nombre ? 'selected' : ''}>${b.nombre}</option>`).join('')}
            </select>
        </div>

        <div class="table-wrapper">
            <table class="cont-table">
                <thead>
                    <tr>
                        <th style="width:100px;">Fecha</th>
                        <th style="width:90px;">Tipo</th>
                        <th>Producto</th>
                        <th style="width:90px;">Cantidad</th>
                        <th>Bodega</th>
                        <th>Centro de costo</th>
                        <th>Glosa</th>
                        <th style="width:90px;">Asiento</th>
                    </tr>
                </thead>
                <tbody>
                    ${filtrados.length ? filtrados.map(m => {
                        const t = INV_TIPOS[m.tipo];
                        return `
                        <tr>
                            <td style="font-size:12px;">${m.fecha}</td>
                            <td><span style="color:${t.color};font-weight:700;">${t.icon} ${t.label}</span></td>
                            <td style="font-weight:600;">${m.producto}</td>
                            <td class="monto">${fmt(m.cantidad)}</td>
                            <td style="font-size:12px;color:var(--text-muted);">${m.bodega || '—'}</td>
                            <td style="font-size:12px;color:var(--text-muted);">${m.centroCosto || '—'}</td>
                            <td style="font-size:12px;color:var(--text-muted);max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${m.glosa || '—'}</td>
                            <td>${m.asientoId != null ? `<button class="btn-plan" onclick="invIrAAsiento(${m.asientoId})" title="Ver/editar el asiento en el Diario">📝 Ver</button>` : '—'}</td>
                        </tr>`;
                    }).join('') : `<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text-muted);">Sin movimientos para el filtro seleccionado.</td></tr>`}
                </tbody>
            </table>
        </div>

        <div id="invModal" class="modal-overlay">
            <div class="modal-box" style="width:440px;">
                <h2>Registrar movimiento manual</h2>
                <div class="form-grid">
                    <label>Tipo</label>
                    <select id="invTipo"><option value="ingreso">📥 Ingreso</option><option value="egreso">📤 Egreso</option></select>
                    <label>Producto</label> <input id="invProducto" placeholder="Nombre del producto" list="invProductosList">
                    <label>Cantidad</label> <input id="invCantidad" type="number" min="0" placeholder="0">
                    <label>Bodega</label>
                    <select id="invBodega"><option value="">— Sin bodega —</option>${bodegas.map(b => `<option value="${b.nombre}">${b.nombre}</option>`).join('')}</select>
                    <label>Centro de costo</label>
                    <select id="invCentroCosto"><option value="">— Sin centro —</option>${getCentrosCosto().map(c => `<option value="${c.nombre}">${c.nombre}</option>`).join('')}</select>
                    <label>Fecha</label> <input id="invFecha" type="date">
                    <label>Glosa</label> <input id="invGlosa" placeholder="Ej: Ajuste por conteo físico">
                </div>
                <datalist id="invProductosList">
                    ${getProductos().map(p => `<option value="${p.nombre}">`).join('')}
                </datalist>
                <div class="modal-actions">
                    <button class="btn btn-primary"   onclick="invGuardarManual()">💾 Guardar</button>
                    <button class="btn btn-secondary" onclick="invCerrarForm()">Cancelar</button>
                </div>
            </div>
        </div>
    `;
}

function invAbrirForm() {
    document.getElementById('invTipo').value = 'ingreso';
    document.getElementById('invProducto').value = '';
    document.getElementById('invCantidad').value = '';
    document.getElementById('invBodega').value = '';
    document.getElementById('invCentroCosto').value = '';
    document.getElementById('invFecha').valueAsDate = new Date();
    document.getElementById('invGlosa').value = '';
    document.getElementById('invModal').style.display = 'flex';
}

function invCerrarForm() {
    document.getElementById('invModal').style.display = 'none';
}

function invGuardarManual() {
    const producto = document.getElementById('invProducto').value.trim();
    const cantidad = parseFloat(document.getElementById('invCantidad').value) || 0;
    if (!producto)      { mostrarToast('El producto es obligatorio.', 'error'); return; }
    if (cantidad <= 0)  { mostrarToast('La cantidad debe ser mayor a 0.', 'error'); return; }

    invRegistrarMovimiento({
        tipo: document.getElementById('invTipo').value,
        producto,
        cantidad,
        bodega: document.getElementById('invBodega').value,
        centroCosto: document.getElementById('invCentroCosto').value,
        fecha: document.getElementById('invFecha').value,
        glosa: document.getElementById('invGlosa').value.trim(),
        asientoId: null,
    });

    invCerrarForm();
    renderMovimientosInventario();
    mostrarToast('Movimiento registrado.', 'ok');
}

// Salta al asiento de origen en el Libro Diario — Inventario y Diario son
// vistas de primer nivel distintas (a diferencia del Mayor, que ya vive
// dentro de la misma vista que el Diario), así que hace falta navegar()
// completo, no solo modTab().
function invIrAAsiento(asientoId) {
    navegar('diario', null);
    editarAsiento(asientoId);
}

// ── Expose ────────────────────────────────────────────────────────────────────
window.getMovimientosInventario   = getMovimientosInventario;
window.saveMovimientosInventario  = saveMovimientosInventario;
window.invRegistrarMovimiento     = invRegistrarMovimiento;
window.invStockActual             = invStockActual;
window.renderMovimientosInventario = renderMovimientosInventario;
window.invAbrirForm               = invAbrirForm;
window.invCerrarForm              = invCerrarForm;
window.invGuardarManual           = invGuardarManual;
window.invIrAAsiento              = invIrAAsiento;
