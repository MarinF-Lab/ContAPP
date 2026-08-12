'use strict';
// ─────────────────────────────────────────────────────────────────────────────
//  CENTROS DE COSTO — catálogo simple por empresa
//  Mismo patrón CRUD que productos.js (getX/saveX/xGetById + localStorage).
//  Se usa para clasificar los ítems de la calculadora del Diario (ver
//  js/services/diario.js, calcRenderItems/calcGenerar).
// ─────────────────────────────────────────────────────────────────────────────

const CC_KEY = 'core_centros_costo';

function getCentrosCosto() {
    try { return JSON.parse(localStorage.getItem(CC_KEY) || '[]'); }
    catch (e) { return []; }
}

function saveCentrosCosto(arr) {
    localStorage.setItem(CC_KEY, JSON.stringify(arr));
}

function ccGetById(id) {
    return getCentrosCosto().find(c => String(c.id) === String(id)) || null;
}

function ccGetByNombre(nombre) {
    const n = (nombre || '').trim().toLowerCase();
    if (!n) return null;
    return getCentrosCosto().find(c => (c.nombre || '').trim().toLowerCase() === n) || null;
}

// Sufijo random: dos centros creados en el mismo milisegundo colisionarían.
function _ccNuevoId() { return 'cc' + Date.now() + Math.floor(Math.random() * 1000); }

let _ccEditando = null;

function renderCentrosCosto() {
    const view = document.getElementById('tab-inv-centros');
    if (!view) return;
    const items = getCentrosCosto().sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));

    view.innerHTML = `
        <div class="card" style="margin-bottom:16px;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
                <div>
                    <h2 style="margin:0 0 4px;">🏢 Centros de Costo</h2>
                    <p style="color:var(--text-muted);font-size:12px;margin:0;">Clasificación para asignar gastos e ingresos por área — disponible desde la calculadora de ítems del Diario.</p>
                </div>
                <button class="btn btn-primary" onclick="ccAbrirForm(null)">+ Agregar</button>
            </div>
        </div>
        <div class="table-wrapper">
            <table class="cont-table">
                <thead>
                    <tr><th style="width:120px;">Código</th><th>Nombre</th><th style="width:110px;">Estado</th><th style="width:140px;">Acciones</th></tr>
                </thead>
                <tbody>
                    ${items.length ? items.map(c => `
                        <tr style="${c.estado === 'INACTIVO' ? 'opacity:.5;' : ''}">
                            <td style="font-family:monospace;font-size:13px;color:#64748b;">${c.codigo || '—'}</td>
                            <td style="font-weight:600;">${c.nombre}</td>
                            <td><span class="${c.estado !== 'INACTIVO' ? 'badge-activo' : 'badge-inactivo'}">${c.estado !== 'INACTIVO' ? 'Activo' : 'Inactivo'}</span></td>
                            <td>
                                <div class="plan-acciones">
                                    <button class="btn-plan btn-plan-editar" onclick="ccAbrirForm('${c.id}')">✏️ Editar</button>
                                    <button class="btn-plan btn-plan-eliminar" onclick="ccEliminar('${c.id}')">🗑️</button>
                                </div>
                            </td>
                        </tr>`).join('') : `<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--text-muted);">Sin centros de costo aún.</td></tr>`}
                </tbody>
            </table>
        </div>

        <div id="ccModal" class="modal-overlay">
            <div class="modal-box" style="width:420px;">
                <h2 id="ccModalTitulo">Nuevo Centro de Costo</h2>
                <div class="form-grid">
                    <label>Código</label>  <input id="ccCodigo" placeholder="Ej: CC-01">
                    <label>Nombre</label>  <input id="ccNombre" placeholder="Ej: Administración">
                    <label>Estado</label>
                    <select id="ccEstado"><option value="ACTIVO">ACTIVA</option><option value="INACTIVO">INACTIVA</option></select>
                </div>
                <div class="modal-actions">
                    <button class="btn btn-primary"   onclick="ccGuardar()">💾 Guardar</button>
                    <button class="btn btn-secondary" onclick="ccCerrarForm()">Cancelar</button>
                </div>
            </div>
        </div>
    `;
}

function ccAbrirForm(id) {
    _ccEditando = id;
    const cc = id ? ccGetById(id) : null;
    document.getElementById('ccModalTitulo').innerText = cc ? 'Editar Centro de Costo' : 'Nuevo Centro de Costo';
    document.getElementById('ccCodigo').value = cc?.codigo || '';
    document.getElementById('ccNombre').value = cc?.nombre || '';
    document.getElementById('ccEstado').value = cc?.estado || 'ACTIVO';
    document.getElementById('ccModal').style.display = 'flex';
}

function ccCerrarForm() {
    document.getElementById('ccModal').style.display = 'none';
    _ccEditando = null;
}

function ccGuardar() {
    const nombre = document.getElementById('ccNombre').value.trim();
    if (!nombre) { mostrarToast('El nombre es obligatorio.', 'error'); return; }

    const arr = getCentrosCosto();
    const dup = arr.find(c => c.nombre.trim().toLowerCase() === nombre.toLowerCase() && String(c.id) !== String(_ccEditando));
    if (dup) { mostrarToast('Ya existe un centro de costo con ese nombre.', 'error'); return; }

    const datos = {
        codigo: document.getElementById('ccCodigo').value.trim(),
        nombre,
        estado: document.getElementById('ccEstado').value,
    };

    if (_ccEditando) {
        const idx = arr.findIndex(c => String(c.id) === String(_ccEditando));
        if (idx >= 0) arr[idx] = { ...arr[idx], ...datos };
    } else {
        arr.push({ id: _ccNuevoId(), ...datos, created_at: Date.now() });
    }

    saveCentrosCosto(arr);
    renderCentrosCosto();
    mostrarToast(_ccEditando ? 'Centro de costo actualizado.' : 'Centro de costo creado.', 'ok');
}

function ccEliminar(id) {
    mostrarConfirm('¿Eliminar este centro de costo?', () => {
        saveCentrosCosto(getCentrosCosto().filter(c => String(c.id) !== String(id)));
        renderCentrosCosto();
        mostrarToast('Centro de costo eliminado.', 'ok');
    });
}

// ── Expose ────────────────────────────────────────────────────────────────────
window.getCentrosCosto   = getCentrosCosto;
window.saveCentrosCosto  = saveCentrosCosto;
window.ccGetById         = ccGetById;
window.ccGetByNombre     = ccGetByNombre;
window.renderCentrosCosto = renderCentrosCosto;
window.ccAbrirForm       = ccAbrirForm;
window.ccCerrarForm      = ccCerrarForm;
window.ccGuardar         = ccGuardar;
window.ccEliminar        = ccEliminar;
