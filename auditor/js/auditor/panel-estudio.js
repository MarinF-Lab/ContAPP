'use strict';
// ─────────────────────────────────────────────────────────────────────────────
//  PANEL ESTUDIO — F2.1 Panel global · F2.2 Kanban · F2.3 Calendario tributario
//  ContAPP Auditor
// ─────────────────────────────────────────────────────────────────────────────

let _panelView     = 'lista';   // 'lista' | 'kanban' | 'calendario'
let _panelFiltro   = '';
let _panelClientes = [];
const _panelPeriodo = () => {
    const hoy = new Date();
    return `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}`;
};

// ── Calendario tributario chileno (fechas fijas) ──────────────────────────────
const OBLIGACIONES_TRIBUTARIAS = [
    { id: 'f29',    label: 'F29 / IVA',       dia: 20, tipo: 'mensual',  color: '#ef4444' },
    { id: 'cot',    label: 'Cotizaciones',     dia: 13, tipo: 'mensual',  color: '#f59e0b' },
    { id: 'f22',    label: 'F22 Renta',        mes: 3,  dia: 30, tipo: 'anual', color: '#8b5cf6' },
    { id: 'dj1879', label: 'DJ 1879 Hon.',     mes: 2,  dia: 31, tipo: 'anual', color: '#3b82f6' },
];

function panelGetAlertas(hoy) {
    const alertas = [];
    const a = hoy.getFullYear();
    const m = hoy.getMonth();
    const d = hoy.getDate();

    OBLIGACIONES_TRIBUTARIAS.forEach(ob => {
        let fecha;
        if (ob.tipo === 'mensual') {
            fecha = new Date(a, m, ob.dia);
            // Si ya pasó este mes, siguiente mes
            if (fecha < hoy) fecha = new Date(a, m + 1, ob.dia);
        } else {
            fecha = new Date(a, ob.mes, ob.dia);
            if (fecha < hoy) fecha = new Date(a + 1, ob.mes, ob.dia);
        }
        const dias = Math.ceil((fecha - hoy) / 86400000);
        if (dias <= 15) {
            alertas.push({
                ...ob,
                dias,
                urgencia: dias <= 3 ? 'critica' : dias <= 7 ? 'alta' : 'normal',
            });
        }
    });
    return alertas.sort((a, b) => a.dias - b.dias);
}

// ── Kanban estados ────────────────────────────────────────────────────────────
const KANBAN_ESTADOS = [
    { id: 'pendiente',   label: 'Pendiente',    color: '#6b7280' },
    { id: 'en-proceso',  label: 'En Proceso',   color: '#f59e0b' },
    { id: 'por-revisar', label: 'Por Revisar',  color: '#3b82f6' },
    { id: 'cerrado',     label: 'Cerrado',       color: '#10b981' },
];

function panelKanbanGetEstado(cliente) {
    const estados = cliente.kanbanEstados || {};
    return estados[_panelPeriodo()] || 'pendiente';
}

async function panelKanbanSetEstado(clienteId, estado) {
    const periodo = _panelPeriodo();
    // Actualizar en memoria
    const c = _panelClientes.find(x => x.id === clienteId);
    if (c) {
        c.kanbanEstados = c.kanbanEstados || {};
        c.kanbanEstados[periodo] = estado;
    }
    // Persistir en Firestore
    try {
        if (window._fbDb) {
            await window._fbDb.collection('empresas').doc(clienteId)
                .update({ [`kanbanEstados.${periodo}`]: estado });
        }
    } catch(e) {}
    panelEstudioRender();
}

// ── Time tracking ─────────────────────────────────────────────────────────────
const TT_KEY = 'core_timetrack';
let _ttActivo = null; // { clienteId, inicio }

function panelTTEntradas() {
    try { return JSON.parse(localStorage.getItem(TT_KEY) || '[]'); } catch { return []; }
}
function panelTTGuardar(entradas) {
    localStorage.setItem(TT_KEY, JSON.stringify(entradas));
}
function panelTTHoyCliente(clienteId) {
    const hoy = new Date().toISOString().slice(0,10);
    return panelTTEntradas()
        .filter(e => e.clienteId === clienteId && (e.inicio || '').startsWith(hoy))
        .reduce((s, e) => s + (e.minutos || 0), 0);
}
function panelTTStart(clienteId) {
    if (_ttActivo) panelTTStop();
    _ttActivo = { clienteId, inicio: new Date().toISOString() };
    mostrarToast('Timer iniciado', 'ok');
    panelEstudioRender();
}
function panelTTStop() {
    if (!_ttActivo) return;
    const fin = new Date();
    const minutos = Math.round((fin - new Date(_ttActivo.inicio)) / 60000);
    if (minutos > 0) {
        const entradas = panelTTEntradas();
        entradas.push({ clienteId: _ttActivo.clienteId, inicio: _ttActivo.inicio, fin: fin.toISOString(), minutos });
        panelTTGuardar(entradas);
    }
    _ttActivo = null;
    mostrarToast('Timer detenido', 'ok');
    panelEstudioRender();
}

function _ttFmt(min) {
    if (!min) return '—';
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h ? `${h}h ${m}m` : `${m}m`;
}

// ── Render principal ───────────────────────────────────────────────────────────
function panelEstudioInicializar(clientes) {
    _panelClientes = clientes;
    window._panelClientesCache = clientes; // para honorarios-estudio.js
    _panelFiltro   = '';
    _panelView     = 'lista';
    panelEstudioRender();
}

function panelEstudioRender() {
    const hoy      = new Date();
    const alertas  = panelGetAlertas(hoy);
    const periodo  = _panelPeriodo();
    const filtrados = _panelFiltro
        ? _panelClientes.filter(c =>
            (c.empresa||'').toLowerCase().includes(_panelFiltro.toLowerCase()) ||
            (c.rut||'').toLowerCase().includes(_panelFiltro.toLowerCase())
          )
        : _panelClientes;

    const mesLabel = new Date(periodo + '-01').toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });

    const kpiHtml = `
    <div class="panel-kpi-bar">
        <div class="panel-kpi-item">
            <span class="panel-kpi-num">${_panelClientes.length}</span>
            <span class="panel-kpi-lbl">Clientes</span>
        </div>
        <div class="panel-kpi-item">
            <span class="panel-kpi-num ${alertas.filter(a=>a.urgencia==='critica').length ? 'panel-kpi-alerta' : ''}">${alertas.length}</span>
            <span class="panel-kpi-lbl">Obligaciones próximas</span>
        </div>
        <div class="panel-kpi-item">
            <span class="panel-kpi-num panel-kpi-ok">${_panelClientes.filter(c => panelKanbanGetEstado(c) === 'cerrado').length}</span>
            <span class="panel-kpi-lbl">Cerrados ${mesLabel}</span>
        </div>
        ${_ttActivo ? `<div class="panel-kpi-item panel-kpi-timer-activo" onclick="panelTTStop()">
            <span class="panel-kpi-num">⏱</span>
            <span class="panel-kpi-lbl">Timer activo — clic para detener</span>
        </div>` : ''}
    </div>`;

    const searchHtml = `
    <div class="panel-toolbar">
        <input class="panel-search" type="search" placeholder="Buscar cliente…"
               value="${_panelFiltro}"
               oninput="panelSetFiltro(this.value)">
        <div class="panel-view-tabs">
            <button class="panel-tab ${_panelView==='lista'?'panel-tab-activo':''}" onclick="panelSetView('lista')">☰ Lista</button>
            <button class="panel-tab ${_panelView==='kanban'?'panel-tab-activo':''}" onclick="panelSetView('kanban')">⬜ Kanban</button>
            <button class="panel-tab ${_panelView==='calendario'?'panel-tab-activo':''}" onclick="panelSetView('calendario')">📅 Calendario</button>
        </div>
    </div>`;

    let contentHtml = '';
    if (_panelView === 'lista') {
        contentHtml = panelRenderLista(filtrados, alertas);
    } else if (_panelView === 'kanban') {
        contentHtml = panelRenderKanban(filtrados);
    } else {
        contentHtml = panelRenderCalendario(alertas);
    }

    const container = document.getElementById('panelEstudioContainer');
    if (!container) return;
    container.innerHTML = kpiHtml + searchHtml + contentHtml;
}

// ── Tarjeta enriquecida ───────────────────────────────────────────────────────
function panelRenderTarjeta(cliente, alertas, modoKanban) {
    const color   = cliente.color || '#3b82f6';
    const inicial = ((cliente.empresa || '?')[0] || '?').toUpperCase();
    const nombre  = cliente.empresa || '(Sin nombre)';
    const cat     = cliente.categoria || 'primera';
    const estado  = panelKanbanGetEstado(cliente);
    const est     = KANBAN_ESTADOS.find(k => k.id === estado) || KANBAN_ESTADOS[0];
    const minHoy  = panelTTHoyCliente(cliente.id);
    const esTimer = _ttActivo?.clienteId === cliente.id;

    const alertaBadges = alertas.map(a => `
        <span class="panel-alerta panel-alerta-${a.urgencia}" title="${a.label}: ${a.dias} día(s)">
            ${a.label} <strong>${a.dias}d</strong>
        </span>`).join('');

    const estadoOpts = KANBAN_ESTADOS.map(k =>
        `<option value="${k.id}" ${k.id === estado ? 'selected' : ''}>${k.label}</option>`
    ).join('');

    return `
    <div class="aud-emp-item panel-card" onclick="seleccionarEmpresa('${cliente.id}')">
        <div class="aud-emp-avatar" style="background:${color}">${inicial}</div>
        <div class="aud-emp-info">
            <div class="aud-emp-nombre">
                ${nombre}
                ${cliente.esPropio ? '<span class="aud-badge-propio">Mi Oficina</span>' : ''}
                <span class="panel-estado-badge" style="background:${est.color}15;color:${est.color};border:1px solid ${est.color}40;">${est.label}</span>
            </div>
            <div class="aud-emp-meta">
                ${cliente.rut  ? `<span>🪪 ${cliente.rut}</span>`  : ''}
                ${cliente.giro ? `<span>📋 ${cliente.giro}</span>` : ''}
                <span class="aud-cat-badge aud-cat-${cat}">${cat === 'primera' ? '1ª Cat.' : '2ª Cat.'}</span>
                ${minHoy ? `<span class="panel-tt-badge ${esTimer?'panel-tt-activo':''}">⏱ ${_ttFmt(minHoy)} hoy</span>` : ''}
            </div>
            ${alertaBadges ? `<div class="panel-alertas-row">${alertaBadges}</div>` : ''}
        </div>
        <div class="panel-card-actions" onclick="event.stopPropagation()">
            <select class="panel-kanban-select"
                    onchange="panelKanbanSetEstado('${cliente.id}', this.value)"
                    title="Estado del período">
                ${estadoOpts}
            </select>
            <button class="panel-tt-btn ${esTimer?'panel-tt-btn-stop':''}"
                    onclick="${esTimer ? 'panelTTStop()' : `panelTTStart('${cliente.id}')`}"
                    title="${esTimer ? 'Detener timer' : 'Iniciar timer'}">
                ${esTimer ? '⏹' : '▶'}
            </button>
        </div>
    </div>`;
}

// ── Vista Lista ───────────────────────────────────────────────────────────────
function panelRenderLista(clientes, alertas) {
    if (!clientes.length) {
        return `<div class="emp-empty"><div class="emp-empty-icon">🔍</div><div>No se encontraron clientes.</div></div>`;
    }
    return `<div class="panel-lista">${clientes.map(c => panelRenderTarjeta(c, alertas)).join('')}</div>`;
}

// ── Vista Kanban ──────────────────────────────────────────────────────────────
function panelRenderKanban(clientes) {
    const periodo = _panelPeriodo();
    const mesLabel = new Date(periodo + '-01').toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });

    const cols = KANBAN_ESTADOS.map(est => {
        const items = clientes.filter(c => panelKanbanGetEstado(c) === est.id);
        const cards = items.map(c => {
            const color   = c.color || '#3b82f6';
            const inicial = ((c.empresa || '?')[0] || '?').toUpperCase();
            const esTimer = _ttActivo?.clienteId === c.id;
            return `
            <div class="panel-kanban-card" onclick="seleccionarEmpresa('${c.id}')">
                <div class="panel-kanban-card-header">
                    <div class="aud-emp-avatar" style="background:${color};width:32px;height:32px;font-size:14px;border-radius:8px;">${inicial}</div>
                    <div style="flex:1;min-width:0;">
                        <div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${c.empresa||'(Sin nombre)'}</div>
                        <div style="font-size:11px;color:var(--text-muted);">${c.rut||''}</div>
                    </div>
                </div>
                <div class="panel-kanban-card-footer" onclick="event.stopPropagation()">
                    <select class="panel-kanban-select panel-kanban-select-sm"
                            onchange="panelKanbanSetEstado('${c.id}', this.value)">
                        ${KANBAN_ESTADOS.map(k=>`<option value="${k.id}" ${k.id===est.id?'selected':''}>${k.label}</option>`).join('')}
                    </select>
                    <button class="panel-tt-btn ${esTimer?'panel-tt-btn-stop':''}"
                            onclick="${esTimer?'panelTTStop()':`panelTTStart('${c.id}')`}">
                        ${esTimer ? '⏹' : '▶'}
                    </button>
                </div>
            </div>`;
        }).join('');

        return `
        <div class="panel-kanban-col">
            <div class="panel-kanban-col-header" style="border-top:3px solid ${est.color};">
                <span style="color:${est.color};font-weight:700;">${est.label}</span>
                <span class="panel-kanban-count">${items.length}</span>
            </div>
            <div class="panel-kanban-cards">
                ${cards || `<div class="panel-kanban-empty">Sin clientes</div>`}
            </div>
        </div>`;
    }).join('');

    return `
    <div class="panel-kanban-periodo">Período: <strong>${mesLabel}</strong></div>
    <div class="panel-kanban-grid">${cols}</div>`;
}

// ── Vista Calendario ──────────────────────────────────────────────────────────
function panelRenderCalendario(alertas) {
    const hoy = new Date();
    const a   = hoy.getFullYear();
    const m   = hoy.getMonth();

    // Construir el mes completo
    const primerDia    = new Date(a, m, 1).getDay(); // 0=dom
    const diasEnMes    = new Date(a, m + 1, 0).getDate();
    const mesLabel     = hoy.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });

    // Mapa dia → alertas
    const alertasPorDia = {};
    OBLIGACIONES_TRIBUTARIAS.forEach(ob => {
        let fecha;
        if (ob.tipo === 'mensual') {
            fecha = new Date(a, m, ob.dia);
        } else {
            fecha = new Date(a, ob.mes, ob.dia);
        }
        if (fecha.getMonth() === m && fecha.getFullYear() === a) {
            const d = fecha.getDate();
            if (!alertasPorDia[d]) alertasPorDia[d] = [];
            alertasPorDia[d].push(ob);
        }
    });

    const encab = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
        .map(d => `<div class="panel-cal-enc">${d}</div>`).join('');

    // Celdas vacías al inicio
    const offset = primerDia; // semana empieza en domingo
    let celdas = '';
    for (let i = 0; i < offset; i++) {
        celdas += `<div class="panel-cal-cel panel-cal-vacia"></div>`;
    }
    for (let d = 1; d <= diasEnMes; d++) {
        const esHoy    = d === hoy.getDate();
        const obs      = alertasPorDia[d] || [];
        const badges   = obs.map(ob =>
            `<div class="panel-cal-badge" style="background:${ob.color}20;color:${ob.color};border:1px solid ${ob.color}40;">${ob.label}</div>`
        ).join('');
        celdas += `
        <div class="panel-cal-cel ${esHoy?'panel-cal-hoy':''} ${obs.length?'panel-cal-con-ob':''}">
            <div class="panel-cal-dia">${d}</div>
            ${badges}
        </div>`;
    }

    const proximasHtml = alertas.length ? `
    <div class="panel-cal-proximas">
        <div class="panel-cal-sec-title">Próximas obligaciones</div>
        ${alertas.map(a => `
        <div class="panel-cal-ob-item">
            <span class="panel-cal-ob-dot" style="background:${a.color}"></span>
            <span class="panel-cal-ob-label">${a.label}</span>
            <span class="panel-cal-ob-dias panel-alerta-${a.urgencia}">${a.dias === 0 ? '¡Hoy!' : `${a.dias} día(s)`}</span>
        </div>`).join('')}
    </div>` : `<div class="panel-cal-proximas"><em style="color:var(--text-muted);font-size:13px;">Sin obligaciones en los próximos 15 días.</em></div>`;

    return `
    <div class="panel-cal-layout">
        <div class="panel-cal-wrap">
            <div class="panel-cal-mes-label">${mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1)}</div>
            <div class="panel-cal-grid">
                ${encab}
                ${celdas}
            </div>
        </div>
        ${proximasHtml}
    </div>`;
}

// ── Helpers de estado ─────────────────────────────────────────────────────────
function panelSetView(view) {
    _panelView = view;
    panelEstudioRender();
}

function panelSetFiltro(valor) {
    _panelFiltro = valor;
    panelEstudioRender();
}

// ── Expose ────────────────────────────────────────────────────────────────────
window.panelEstudioInicializar = panelEstudioInicializar;
window.panelEstudioRender      = panelEstudioRender;
window.panelSetView            = panelSetView;
window.panelSetFiltro          = panelSetFiltro;
window.panelKanbanSetEstado    = panelKanbanSetEstado;
window.panelTTStart            = panelTTStart;
window.panelTTStop             = panelTTStop;
