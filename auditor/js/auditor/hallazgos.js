'use strict';
/**
 * hallazgos.js — Lista de observaciones y hallazgos por cliente/período
 * Exclusivo ContAPP Auditor: diferencial que define el producto.
 *
 * Estructura en localStorage: aud_hallazgos → array de {
 *   id,
 *   clienteId,
 *   periodo,                ← "YYYY-MM"
 *   tipo,                   ← 'error' | 'advertencia' | 'sugerencia'
 *   descripcion,
 *   modulo,                 ← 'diario' | 'compras' | 'ventas' | 'balance' | 'remuneraciones' | 'otro'
 *   estado,                 ← 'abierto' | 'resuelto'
 *   fechaDeteccion,         ← ISO string (Date.now() al crear)
 *   fechaResolucion,        ← ISO string | null
 * }
 */

const AUD_HALLAZGOS_KEY = 'aud_hallazgos';

let _audHallazgos = [];
let _audPeriodoFiltro = '';

// ─────────────────────────────────────────────────────────────
//  CARGAR / GUARDAR
// ─────────────────────────────────────────────────────────────

function audHallazgosCargar() {
    _audHallazgos = JSON.parse(localStorage.getItem(AUD_HALLAZGOS_KEY)) || [];
}

function _audHallazgoGuardar() {
    localStorage.setItem(AUD_HALLAZGOS_KEY, JSON.stringify(_audHallazgos));
}

// ─────────────────────────────────────────────────────────────
//  CRUD
// ─────────────────────────────────────────────────────────────

function audHallazgoCrear(tipo, descripcion, modulo) {
    if (!tipo || !descripcion || !modulo) {
        mostrarToast('Ingrese tipo, descripción y módulo', 'error');
        return false;
    }

    const empresa = window.empresaActual;
    if (!empresa || !empresa.id) {
        mostrarToast('Seleccione una empresa primero', 'error');
        return false;
    }

    const periodo = _audPeriodoFiltro || new Date().toISOString().slice(0, 7);

    const hallazgo = {
        id: Date.now(),
        clienteId: empresa.id,
        periodo,
        tipo,
        descripcion: descripcion.trim(),
        modulo,
        estado: 'abierto',
        fechaDeteccion: new Date().toISOString(),
        fechaResolucion: null,
    };

    _audHallazgos.push(hallazgo);
    _audHallazgoGuardar();
    mostrarToast(`Hallazgo "${tipo}" agregado`, 'ok');
    audHallazgosRender();
    return true;
}

function audHallazgoResolver(id) {
    const h = _audHallazgos.find(x => x.id === id);
    if (!h) return;

    h.estado = 'resuelto';
    h.fechaResolucion = new Date().toISOString();
    _audHallazgoGuardar();
    mostrarToast('Hallazgo marcado como resuelto', 'ok');
    audHallazgosRender();
}

function audHallazgoEliminar(id) {
    const h = _audHallazgos.find(x => x.id === id);
    if (!h) return;

    mostrarConfirm(`¿Eliminar hallazgo "${h.tipo}" de ${h.modulo}?`, () => {
        _audHallazgos = _audHallazgos.filter(x => x.id !== id);
        _audHallazgoGuardar();
        mostrarToast('Hallazgo eliminado', 'ok');
        audHallazgosRender();
    });
}

// ─────────────────────────────────────────────────────────────
//  FILTRADO Y EXPORTACIÓN
// ─────────────────────────────────────────────────────────────

function _audHallazgosObtenerFiltrados() {
    const empresa = window.empresaActual;
    if (!empresa || !empresa.id) return [];

    return _audHallazgos.filter(h =>
        h.clienteId === empresa.id &&
        (!_audPeriodoFiltro || h.periodo === _audPeriodoFiltro)
    );
}

function audHallazgosExportar() {
    return _audHallazgosObtenerFiltrados();
}

// ─────────────────────────────────────────────────────────────
//  RENDER
// ─────────────────────────────────────────────────────────────

function audHallazgosRender() {
    const el = document.getElementById('audHallazgosTabla');
    if (!el) return;

    const datos = _audHallazgosObtenerFiltrados();
    const empresa = window.empresaActual;

    if (!datos.length) {
        el.innerHTML = `
        <tr>
            <td colspan="8" style="text-align:center;padding:40px;color:var(--text-muted);">
                📋 Sin hallazgos registrados para ${empresa?.nombre || 'empresa'} en ${_audPeriodoFiltro || 'periodo actual'}
            </td>
        </tr>`;
        _audActualizarKPIs();
        return;
    }

    el.innerHTML = datos.map(h => {
        const colorTipo = h.tipo === 'error' ? '#dc2626' :
                          h.tipo === 'advertencia' ? '#f59e0b' :
                          h.tipo === 'sugerencia' ? '#3b82f6' : '#64748b';

        const estadoLabel = h.estado === 'abierto' ? '🔓 Abierto' : '✅ Resuelto';
        const estadoColor = h.estado === 'abierto' ? '#f59e0b' : '#16a34a';

        const fecha = new Date(h.fechaDeteccion).toLocaleDateString('es-CL');
        const fechaResol = h.fechaResolucion ? new Date(h.fechaResolucion).toLocaleDateString('es-CL') : '—';

        return `
        <tr>
            <td style="text-align:center;">
                <span style="background:${colorTipo};color:white;padding:4px 10px;border-radius:4px;font-size:11px;font-weight:600;">
                    ${h.tipo.toUpperCase()}
                </span>
            </td>
            <td>${h.modulo}</td>
            <td style="max-width:350px;">${_esc(h.descripcion)}</td>
            <td style="text-align:center;">
                <span style="background:${estadoColor};color:white;padding:4px 8px;border-radius:4px;font-size:11px;font-weight:600;">
                    ${estadoLabel}
                </span>
            </td>
            <td style="font-size:12px;color:var(--text-muted);">${fecha}</td>
            <td style="font-size:12px;color:var(--text-muted);">${fechaResol}</td>
            <td style="white-space:nowrap;">
                ${h.estado === 'abierto'
                    ? `<button class="btn btn-primary" style="padding:4px 10px;font-size:12px;" onclick="audHallazgoResolver(${h.id})">✓ Resolver</button>`
                    : ''}
            </td>
            <td style="white-space:nowrap;">
                <button class="btn btn-secondary" style="padding:4px 10px;font-size:12px;" onclick="audHallazgoEliminar(${h.id})">🗑 Eliminar</button>
            </td>
        </tr>`;
    }).join('');

    _audActualizarKPIs();
}

function _audActualizarKPIs() {
    const datos = _audHallazgosObtenerFiltrados();
    const abiertos = datos.filter(h => h.estado === 'abierto').length;
    const resueltos = datos.filter(h => h.estado === 'resuelto').length;
    const errores = datos.filter(h => h.tipo === 'error').length;
    const advertencias = datos.filter(h => h.tipo === 'advertencia').length;
    const sugerencias = datos.filter(h => h.tipo === 'sugerencia').length;

    const _set = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };

    _set('audKPIAbiertos', abiertos);
    _set('audKPIResueltos', resueltos);
    _set('audKPIErrores', errores);
    _set('audKPIAdvertencias', advertencias);
    _set('audKPISugerencias', sugerencias);
    _set('audKPITotal', datos.length);
}

// ─────────────────────────────────────────────────────────────
//  MODAL CREAR HALLAZGO RÁPIDO
// ─────────────────────────────────────────────────────────────

function audAbrirCrearHallazgo(moduloSugerido) {
    const modal = document.getElementById('audHallazgoModal') || _audCrearModal();

    document.getElementById('audHallazgoModalModulo').value = moduloSugerido || 'otro';
    document.getElementById('audHallazgoModalTipo').value = 'advertencia';
    document.getElementById('audHallazgoModalDescripcion').value = '';

    modal.style.display = 'flex';
}

function audCerrarCrearHallazgo() {
    const modal = document.getElementById('audHallazgoModal');
    if (modal) modal.style.display = 'none';
}

function audGuardarNuevoHallazgo() {
    const tipo = document.getElementById('audHallazgoModalTipo')?.value;
    const modulo = document.getElementById('audHallazgoModalModulo')?.value;
    const descripcion = document.getElementById('audHallazgoModalDescripcion')?.value;

    if (audHallazgoCrear(tipo, descripcion, modulo)) {
        audCerrarCrearHallazgo();
    }
}

function _audCrearModal() {
    const modal = document.createElement('div');
    modal.id = 'audHallazgoModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
    <div class="modal-box" style="width:480px;">
        <h3>➕ Nuevo hallazgo</h3>

        <div class="form-grupo">
            <label>Tipo</label>
            <select id="audHallazgoModalTipo" style="width:100%;">
                <option value="error">🔴 Error</option>
                <option value="advertencia" selected>🟡 Advertencia</option>
                <option value="sugerencia">💡 Sugerencia</option>
            </select>
        </div>

        <div class="form-grupo">
            <label>Módulo</label>
            <select id="audHallazgoModalModulo" style="width:100%;">
                <option value="diario">Libro Diario</option>
                <option value="compras">Compras</option>
                <option value="ventas">Ventas</option>
                <option value="balance">Balance</option>
                <option value="remuneraciones">Remuneraciones</option>
                <option value="otro" selected>Otro</option>
            </select>
        </div>

        <div class="form-grupo">
            <label>Descripción</label>
            <textarea id="audHallazgoModalDescripcion" rows="4" placeholder="Describe la observación…" style="width:100%;resize:vertical;"></textarea>
        </div>

        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
            <button class="btn btn-secondary" onclick="audCerrarCrearHallazgo()">Cancelar</button>
            <button class="btn btn-primary" onclick="audGuardarNuevoHallazgo()">💾 Guardar hallazgo</button>
        </div>
    </div>`;

    document.body.appendChild(modal);
    return modal;
}

// ─────────────────────────────────────────────────────────────
//  VISTA PRINCIPAL
// ─────────────────────────────────────────────────────────────

function renderHallazgos() {
    audHallazgosCargar();

    const el = document.getElementById('view-hallazgos');
    if (!el) return;

    const empresa = window.empresaActual;
    const periodo = _audPeriodoFiltro || new Date().toISOString().slice(0, 7);

    el.innerHTML = `
    <div style="padding:20px;max-width:1400px;margin:0 auto;">

        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
            <h2>📋 Hallazgos de auditoría</h2>
            <button class="btn btn-primary" onclick="audAbrirCrearHallazgo()">➕ Nuevo hallazgo</button>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:20px;">
            <div class="kpi-card">
                <div style="font-size:12px;color:var(--text-muted);">ABIERTOS</div>
                <div id="audKPIAbiertos" style="font-size:28px;font-weight:700;color:var(--accent);">0</div>
            </div>
            <div class="kpi-card">
                <div style="font-size:12px;color:var(--text-muted);">RESUELTOS</div>
                <div id="audKPIResueltos" style="font-size:28px;font-weight:700;color:var(--positive);">0</div>
            </div>
            <div class="kpi-card">
                <div style="font-size:12px;color:var(--text-muted);">ERRORES</div>
                <div id="audKPIErrores" style="font-size:28px;font-weight:700;color:var(--negative);">0</div>
            </div>
            <div class="kpi-card">
                <div style="font-size:12px;color:var(--text-muted);">ADVERTENCIAS</div>
                <div id="audKPIAdvertencias" style="font-size:28px;font-weight:700;color:#f59e0b;">0</div>
            </div>
            <div class="kpi-card">
                <div style="font-size:12px;color:var(--text-muted);">SUGERENCIAS</div>
                <div id="audKPISugerencias" style="font-size:28px;font-weight:700;color:#3b82f6;">0</div>
            </div>
            <div class="kpi-card">
                <div style="font-size:12px;color:var(--text-muted);">TOTAL</div>
                <div id="audKPITotal" style="font-size:28px;font-weight:700;color:var(--text);">0</div>
            </div>
        </div>

        <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap;">
            <label style="display:flex;align-items:center;gap:8px;">
                <span style="font-size:12px;color:var(--text-muted);">Período:</span>
                <input type="month" id="audPeriodoSelect" value="${periodo}"
                    onchange="audCambiarPeriodo(this.value)"
                    style="border:1px solid var(--border);border-radius:4px;padding:6px;font-size:13px;">
            </label>
        </div>

        <div class="card">
            <table class="cont-table">
                <thead>
                    <tr>
                        <th style="width:80px;">TIPO</th>
                        <th style="width:120px;">MÓDULO</th>
                        <th style="flex:1;">DESCRIPCIÓN</th>
                        <th style="width:100px;text-align:center;">ESTADO</th>
                        <th style="width:100px;">DETECTADO</th>
                        <th style="width:100px;">RESUELTO</th>
                        <th style="width:80px;"></th>
                        <th style="width:80px;"></th>
                    </tr>
                </thead>
                <tbody id="audHallazgosTabla">
                    <tr><td colspan="8" style="text-align:center;padding:20px;">Cargando…</td></tr>
                </tbody>
            </table>
        </div>

    </div>`;

    audHallazgosRender();
}

function audCambiarPeriodo(nuevoPeriodo) {
    _audPeriodoFiltro = nuevoPeriodo;
    audHallazgosRender();
}

// ─────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────

function _esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ─────────────────────────────────────────────────────────────
//  EXPOSE
// ─────────────────────────────────────────────────────────────

window.audHallazgosCargar = audHallazgosCargar;
window.audHallazgoCrear = audHallazgoCrear;
window.audHallazgoResolver = audHallazgoResolver;
window.audHallazgoEliminar = audHallazgoEliminar;
window.audHallazgosExportar = audHallazgosExportar;
window.audHallazgosRender = audHallazgosRender;
window.audAbrirCrearHallazgo = audAbrirCrearHallazgo;
window.audCerrarCrearHallazgo = audCerrarCrearHallazgo;
window.audGuardarNuevoHallazgo = audGuardarNuevoHallazgo;
window.audCambiarPeriodo = audCambiarPeriodo;
window.renderHallazgos = renderHallazgos;
