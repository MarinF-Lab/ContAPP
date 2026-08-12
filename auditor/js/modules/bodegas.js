'use strict';
// ─────────────────────────────────────────────────────────────────────────────
//  BODEGAS — catálogo simple por empresa
//  Mismo patrón CRUD que centros-costo.js / productos.js.
//  Se usa para clasificar los ítems de la calculadora del Diario y como
//  ubicación de los movimientos de inventario (ver inventario.js).
// ─────────────────────────────────────────────────────────────────────────────

const BOD_KEY = 'core_bodegas';

function getBodegas() {
    try { return JSON.parse(localStorage.getItem(BOD_KEY) || '[]'); }
    catch (e) { return []; }
}

function saveBodegas(arr) {
    localStorage.setItem(BOD_KEY, JSON.stringify(arr));
}

function bodGetById(id) {
    return getBodegas().find(b => String(b.id) === String(id)) || null;
}

function bodGetByNombre(nombre) {
    const n = (nombre || '').trim().toLowerCase();
    if (!n) return null;
    return getBodegas().find(b => (b.nombre || '').trim().toLowerCase() === n) || null;
}

// Sufijo random: dos bodegas creadas en el mismo milisegundo colisionarían.
function _bodNuevoId() { return 'bod' + Date.now() + Math.floor(Math.random() * 1000); }

let _bodEditando = null;

function renderBodegas() {
    const view = document.getElementById('tab-inv-bodegas');
    if (!view) return;
    const items = getBodegas().sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));

    view.innerHTML = `
        <div class="card" style="margin-bottom:16px;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
                <div>
                    <h2 style="margin:0 0 4px;">🏬 Bodegas</h2>
                    <p style="color:var(--text-muted);font-size:12px;margin:0;">Ubicaciones físicas donde entra y sale stock — disponible desde la calculadora de ítems del Diario.</p>
                </div>
                <button class="btn btn-primary" onclick="bodAbrirForm(null)">+ Agregar</button>
            </div>
        </div>
        <div class="table-wrapper">
            <table class="cont-table">
                <thead>
                    <tr><th style="width:120px;">Código</th><th>Nombre</th><th>Ubicación</th><th style="width:110px;">Estado</th><th style="width:140px;">Acciones</th></tr>
                </thead>
                <tbody>
                    ${items.length ? items.map(b => `
                        <tr style="${b.estado === 'INACTIVO' ? 'opacity:.5;' : ''}">
                            <td style="font-family:monospace;font-size:13px;color:#64748b;">${b.codigo || '—'}</td>
                            <td style="font-weight:600;">${b.nombre}</td>
                            <td style="font-size:13px;color:var(--text-muted);">${b.ubicacion || '—'}</td>
                            <td><span class="${b.estado !== 'INACTIVO' ? 'badge-activo' : 'badge-inactivo'}">${b.estado !== 'INACTIVO' ? 'Activo' : 'Inactivo'}</span></td>
                            <td>
                                <div class="plan-acciones">
                                    <button class="btn-plan btn-plan-editar" onclick="bodAbrirForm('${b.id}')">✏️ Editar</button>
                                    <button class="btn-plan btn-plan-eliminar" onclick="bodEliminar('${b.id}')">🗑️</button>
                                </div>
                            </td>
                        </tr>`).join('') : `<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-muted);">Sin bodegas aún.</td></tr>`}
                </tbody>
            </table>
        </div>

        <div id="bodModal" class="modal-overlay">
            <div class="modal-box" style="width:420px;">
                <h2 id="bodModalTitulo">Nueva Bodega</h2>
                <div class="form-grid">
                    <label>Código</label>    <input id="bodCodigo" placeholder="Ej: BOD-01">
                    <label>Nombre</label>    <input id="bodNombre" placeholder="Ej: Bodega Central">
                    <label>Ubicación</label> <input id="bodUbicacion" placeholder="Ej: Santiago, dirección o referencia">
                    <label>Estado</label>
                    <select id="bodEstado"><option value="ACTIVO">ACTIVA</option><option value="INACTIVO">INACTIVA</option></select>
                </div>
                <div class="modal-actions">
                    <button class="btn btn-primary"   onclick="bodGuardar()">💾 Guardar</button>
                    <button class="btn btn-secondary" onclick="bodCerrarForm()">Cancelar</button>
                </div>
            </div>
        </div>
    `;
}

function bodAbrirForm(id) {
    _bodEditando = id;
    const bod = id ? bodGetById(id) : null;
    document.getElementById('bodModalTitulo').innerText = bod ? 'Editar Bodega' : 'Nueva Bodega';
    document.getElementById('bodCodigo').value = bod?.codigo || '';
    document.getElementById('bodNombre').value = bod?.nombre || '';
    document.getElementById('bodUbicacion').value = bod?.ubicacion || '';
    document.getElementById('bodEstado').value = bod?.estado || 'ACTIVO';
    document.getElementById('bodModal').style.display = 'flex';
}

function bodCerrarForm() {
    document.getElementById('bodModal').style.display = 'none';
    _bodEditando = null;
}

function bodGuardar() {
    const nombre = document.getElementById('bodNombre').value.trim();
    if (!nombre) { mostrarToast('El nombre es obligatorio.', 'error'); return; }

    const arr = getBodegas();
    const dup = arr.find(b => b.nombre.trim().toLowerCase() === nombre.toLowerCase() && String(b.id) !== String(_bodEditando));
    if (dup) { mostrarToast('Ya existe una bodega con ese nombre.', 'error'); return; }

    const datos = {
        codigo: document.getElementById('bodCodigo').value.trim(),
        nombre,
        ubicacion: document.getElementById('bodUbicacion').value.trim(),
        estado: document.getElementById('bodEstado').value,
    };

    if (_bodEditando) {
        const idx = arr.findIndex(b => String(b.id) === String(_bodEditando));
        if (idx >= 0) arr[idx] = { ...arr[idx], ...datos };
    } else {
        arr.push({ id: _bodNuevoId(), ...datos, created_at: Date.now() });
    }

    saveBodegas(arr);
    renderBodegas();
    mostrarToast(_bodEditando ? 'Bodega actualizada.' : 'Bodega creada.', 'ok');
}

function bodEliminar(id) {
    mostrarConfirm('¿Eliminar esta bodega?', () => {
        saveBodegas(getBodegas().filter(b => String(b.id) !== String(id)));
        renderBodegas();
        mostrarToast('Bodega eliminada.', 'ok');
    });
}

// ── Expose ────────────────────────────────────────────────────────────────────
window.getBodegas      = getBodegas;
window.saveBodegas     = saveBodegas;
window.bodGetById      = bodGetById;
window.bodGetByNombre  = bodGetByNombre;
window.renderBodegas   = renderBodegas;
window.bodAbrirForm    = bodAbrirForm;
window.bodCerrarForm   = bodCerrarForm;
window.bodGuardar      = bodGuardar;
window.bodEliminar     = bodEliminar;
