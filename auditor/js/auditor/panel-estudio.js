'use strict';
// ─────────────────────────────────────────────────────────────────────────────
//  PANEL ESTUDIO — F2.1 Panel global · F2.2 Kanban · F2.3 Calendario tributario
//  ContAPP Auditor
// ─────────────────────────────────────────────────────────────────────────────

let _panelView     = 'tablero'; // 'tablero' | 'lista' | 'calendario'
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
    { id: 'pendiente',   label: 'Pendiente',    color: 'var(--text-subtle)' },
    { id: 'en-proceso',  label: 'En proceso',   color: 'var(--warning)' },
    { id: 'por-revisar', label: 'Por revisar',  color: 'var(--info)' },
    { id: 'cerrado',     label: 'Cerrado',      color: 'var(--positive)' },
];

function panelKanbanGetEstado(cliente) {
    const estados = cliente.kanbanEstados || {};
    if (estados[_panelPeriodo()]) return estados[_panelPeriodo()];   // elegido a mano: manda
    // Fase 3: estado propuesto según el checklist de cierre del cliente
    const r = typeof cierreResumenDeCliente === 'function' ? cierreResumenDeCliente(cliente, _panelPeriodo()) : null;
    if (!r || r.periodo !== _panelPeriodo()) return 'pendiente';
    if (r.cerrado)          return 'cerrado';
    if (r.avance >= 100)    return 'por-revisar';
    if (r.avance > 0)       return 'en-proceso';
    return 'pendiente';
}

// Línea de avance de cierre (Fase 3) para tarjetas de cliente
function _panelAvanceHtml(cliente) {
    const r = typeof cierreResumenDeCliente === 'function' ? cierreResumenDeCliente(cliente, _panelPeriodo()) : null;
    if (!r) return '';
    const color = r.cerrado || r.avance >= 100 ? 'var(--positive)' : 'var(--warning)';
    const lbl = typeof ciEtiquetaPeriodo === 'function' ? ciEtiquetaPeriodo(r.periodo) : r.periodo;
    const pend = (r.pendientes || []).length ? ` · Falta: ${(r.pendientes || []).slice(0, 2).join(', ')}${r.pendientes.length > 2 ? '…' : ''}` : '';
    return `<div style="font-size:11.5px;color:var(--text-muted);margin-top:4px;" title="${(r.pendientes || []).join(' · ')}">
        Cierre ${lbl}: <strong style="color:${color};">${r.cerrado ? 'cerrado' : r.avance + '%'}</strong>${pend}
        ${r.modificaciones ? ` · <span style="color:var(--warning);">⚠️ ${r.modificaciones} cambio(s) tras el cierre</span>` : ''}
    </div>`;
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

// ── Render principal (Etapa 3: "Mis clientes" con avance del cierre por tarjeta) ──
let _panelCat = 'todas';   // 'todas' | 'primera' | 'segunda'

const _pEsc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const _pMes = () => new Date(_panelPeriodo() + '-01T12:00:00').toLocaleDateString('es-CL', { month: 'long' });

function panelEstudioInicializar(clientes) {
    _panelClientes = clientes;
    window._panelClientesCache = clientes; // para honorarios-estudio.js
    _panelFiltro   = '';
    if (!['tablero', 'lista', 'calendario'].includes(_panelView)) _panelView = 'tablero';
    const container = document.getElementById('panelEstudioContainer');
    if (!container) return;
    // Estructura fija (el buscador no se vuelve a crear al escribir: no pierde el foco)
    container.innerHTML = `
        <div class="mc-resumen" id="mcResumen"></div>
        <div class="mc-tools">
            <label class="mc-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
                <span class="sr-only">Buscar cliente</span>
                <input type="search" id="mcBuscar" placeholder="Buscar por nombre o RUT" oninput="panelSetFiltro(this.value)">
            </label>
            <div class="mc-seg" role="group" aria-label="Categoría">
                ${[['todas', 'Todas'], ['primera', '1ª categoría'], ['segunda', '2ª categoría']].map(([v, l]) =>
                    `<button type="button" data-cat="${v}" aria-pressed="${_panelCat === v}" onclick="panelSetCategoria('${v}')">${l}</button>`).join('')}
            </div>
            <div class="mc-seg" role="group" aria-label="Vista">
                ${[['tablero', 'Tablero'], ['lista', 'Lista'], ['calendario', 'Calendario']].map(([v, l]) =>
                    `<button type="button" data-vista="${v}" aria-pressed="${_panelView === v}" onclick="panelSetView('${v}')">${l}</button>`).join('')}
            </div>
        </div>
        <div id="mcContenido"></div>`;
    panelEstudioRender();
}

function panelEstudioRender() {
    const container = document.getElementById('panelEstudioContainer');
    if (!container) return;
    if (!document.getElementById('mcContenido')) { panelEstudioInicializar(_panelClientes); return; }

    const hoy     = new Date();
    const alertas = panelGetAlertas(hoy);
    const q       = _panelFiltro.toLowerCase();
    const filtrados = _panelClientes.filter(c =>
        (_panelCat === 'todas' || (c.categoria || 'primera') === _panelCat) &&
        (!q || (c.empresa || '').toLowerCase().includes(q) || (c.rut || '').toLowerCase().includes(q)));

    // Subtítulo de la cabecera con el mes de cierre
    const sub = document.getElementById('empPageSub');
    if (sub) sub.textContent = `Cierre de ${_pMes()} por empresa. Abre un cliente para trabajar en él.`;

    // Resumen
    const cnt = id => _panelClientes.filter(c => panelKanbanGetEstado(c) === id).length;
    document.getElementById('mcResumen').innerHTML = `
        <div><strong>${_panelClientes.length}</strong><small>clientes</small></div>
        ${KANBAN_ESTADOS.map(e => `<div><strong>${cnt(e.id)}</strong><small><i style="background:${e.color}"></i>${e.label.toLowerCase()}</small></div>`).join('')}
        <div class="${alertas.some(a => a.urgencia === 'critica') ? 'mc-alerta' : ''}"><strong>${alertas.length}</strong><small>vencimientos próximos</small></div>
        ${_ttActivo ? `<div class="mc-timer" role="button" tabindex="0" onclick="panelTTStop()" title="Detener cronómetro"><strong>⏹</strong><small>cronómetro activo · detener</small></div>` : ''}`;

    document.querySelectorAll('.mc-seg [data-vista]').forEach(b => b.setAttribute('aria-pressed', b.dataset.vista === _panelView));
    document.querySelectorAll('.mc-seg [data-cat]').forEach(b => b.setAttribute('aria-pressed', b.dataset.cat === _panelCat));

    const cont = document.getElementById('mcContenido');
    if (_panelView === 'lista')           cont.innerHTML = panelRenderLista(filtrados, alertas);
    else if (_panelView === 'calendario') cont.innerHTML = panelRenderCalendario(alertas);
    else                                  cont.innerHTML = panelRenderKanban(filtrados);
}

// Datos del cierre de un cliente para tarjeta/lista
function _panelCierre(cliente) {
    const r = typeof cierreResumenDeCliente === 'function' ? cierreResumenDeCliente(cliente, _panelPeriodo()) : null;
    if (!r) return { hay: false, avance: 0, txt: 'sin datos aún', pendientes: [], ok: false, cambios: 0 };
    const vigente = r.periodo === _panelPeriodo();
    return {
        hay: true, vigente, avance: r.cerrado ? 100 : (r.avance || 0), cerrado: !!r.cerrado,
        txt: r.cerrado ? 'cerrado' : (r.avance || 0) + '%', pendientes: r.pendientes || [],
        ok: r.cerrado || r.avance >= 100, cambios: r.modificaciones || 0,
        etiqueta: typeof ciEtiquetaPeriodo === 'function' ? ciEtiquetaPeriodo(r.periodo) : r.periodo,
    };
}

// ── Tarjeta del tablero ───────────────────────────────────────────────────────
function panelRenderTarjeta(cliente) {
    const nombre  = cliente.empresa || '(Sin nombre)';
    const cat     = cliente.categoria === 'segunda' ? '2ª' : '1ª';
    const ci      = _panelCierre(cliente);
    const minHoy  = panelTTHoyCliente(cliente.id);
    const esTimer = _ttActivo?.clienteId === cliente.id;
    const estado  = panelKanbanGetEstado(cliente);
    const falta   = ci.pendientes.length ? `Falta: ${_pEsc(ci.pendientes.slice(0, 2).join(', '))}${ci.pendientes.length > 2 ? '…' : ''}` : '';
    return `
    <div class="mc-card" onclick="seleccionarEmpresa('${cliente.id}')" title="Abrir ${_pEsc(nombre)}">
        <span class="mc-n"><i class="mc-color" style="background:${_pEsc(cliente.color || 'var(--info)')}"></i>${_pEsc(nombre)}
            ${cliente.esPropio ? '<span class="mc-propio">Mi oficina</span>' : ''}</span>
        <span class="mc-rut">${_pEsc(cliente.rut || 'sin RUT')}, ${cat} categoría</span>
        <span class="mc-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${ci.avance}" aria-label="Avance del cierre">
            <i class="${ci.ok ? 'ok' : ''}" style="width:${ci.avance}%"></i></span>
        <span class="mc-pie">
            <span>Cierre de ${ci.hay && !ci.vigente ? _pEsc(ci.etiqueta) : _pMes()}: <strong>${ci.txt}</strong></span>
            ${minHoy ? `<span class="mc-horas">${_ttFmt(minHoy)} hoy</span>` : ''}
        </span>
        ${falta ? `<span class="mc-falta">${falta}</span>` : ''}
        ${ci.cambios ? `<span class="mc-cambios">${ci.cambios} cambio(s) después del cierre</span>` : ''}
        <span class="mc-acciones" onclick="event.stopPropagation()">
            <select class="mc-estado" aria-label="Estado de ${_pEsc(nombre)} en el período" onchange="panelKanbanSetEstado('${cliente.id}', this.value)">
                ${KANBAN_ESTADOS.map(k => `<option value="${k.id}" ${k.id === estado ? 'selected' : ''}>${k.label}</option>`).join('')}
            </select>
            <button type="button" class="mc-tt ${esTimer ? 'activo' : ''}" onclick="${esTimer ? 'panelTTStop()' : `panelTTStart('${cliente.id}')`}"
                    aria-label="${esTimer ? 'Detener' : 'Iniciar'} cronómetro de ${_pEsc(nombre)}">${esTimer ? '⏹ Detener' : '▶ Cronómetro'}</button>
        </span>
    </div>`;
}

// ── Vista Lista ───────────────────────────────────────────────────────────────
function panelRenderLista(clientes) {
    if (!clientes.length) return `<p class="mc-vacio">Ningún cliente coincide con la búsqueda.</p>`;
    return `<div class="mc-tablaw"><table class="mc-tabla">
        <thead><tr><th>Empresa</th><th>RUT</th><th>Estado</th><th>Cierre</th><th>Falta</th><th class="r">Horas hoy</th></tr></thead>
        <tbody>${clientes.map(c => {
            const e = KANBAN_ESTADOS.find(k => k.id === panelKanbanGetEstado(c)) || KANBAN_ESTADOS[0];
            const ci = _panelCierre(c);
            return `<tr onclick="seleccionarEmpresa('${c.id}')">
                <td><strong>${_pEsc(c.empresa || '(Sin nombre)')}</strong>${c.esPropio ? ' <span class="mc-propio">Mi oficina</span>' : ''}</td>
                <td class="num">${_pEsc(c.rut || '—')}</td>
                <td><span class="mc-pill"><i style="background:${e.color}"></i>${e.label}</span></td>
                <td class="num">${ci.txt}</td>
                <td class="mc-muted">${_pEsc(ci.pendientes.join(', ') || '—')}</td>
                <td class="r num">${_ttFmt(panelTTHoyCliente(c.id))}</td></tr>`;
        }).join('')}</tbody></table></div>`;
}

// ── Vista Tablero (columnas por estado del período) ───────────────────────────
function panelRenderKanban(clientes) {
    return `<div class="mc-board">${KANBAN_ESTADOS.map(est => {
        const items = clientes.filter(c => panelKanbanGetEstado(c) === est.id);
        return `<div class="mc-col">
            <div class="mc-col-h"><i style="background:${est.color}"></i>${est.label}<span class="c">${items.length}</span></div>
            ${items.length ? items.map(c => panelRenderTarjeta(c)).join('') : '<p class="mc-none">Sin clientes en esta columna.</p>'}
        </div>`;
    }).join('')}</div>`;
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

function panelSetCategoria(cat) {
    _panelCat = cat;
    panelEstudioRender();
}

// ── Expose ────────────────────────────────────────────────────────────────────
window.panelEstudioInicializar = panelEstudioInicializar;
window.panelEstudioRender      = panelEstudioRender;
window.panelSetView            = panelSetView;
window.panelSetFiltro          = panelSetFiltro;
window.panelSetCategoria       = panelSetCategoria;
window.panelKanbanSetEstado    = panelKanbanSetEstado;
window.panelTTStart            = panelTTStart;
window.panelTTStop             = panelTTStop;
