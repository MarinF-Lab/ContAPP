'use strict';
// ─────────────────────────────────────────────────────────────────────────────
//  MENU — fuente única de verdad para la navegación (Home abanico + topbar)
//  Reemplaza al sidebar estático: en vez de mostrar/ocultar DOM fijo, construye
//  en memoria la lista de grupos → módulos visibles (según categoría tributaria
//  + módulos activos por cliente) y la entrega a quien la necesite renderizar.
//  Ver Diseño de apps/integracion-diseno.md sección 7.
// ─────────────────────────────────────────────────────────────────────────────

const MENU_GRUPOS_ORDEN = ['Comercial', 'Contabilidad', 'Empresa'];

const MENU_GRUPOS_META = {
    Comercial:    { icono: '🤝', desc: 'Clientes, documentos y conciliación' },
    Contabilidad: { icono: '📚', desc: 'Libros, reportes y tributario' },
    Empresa:      { icono: '🏢', desc: 'RRHH, activos y auditoría' },
};

// Construye [{ id, label, icono, desc, modulos:[{id,label,icono}] }] a partir
// del catálogo activo (CAT1_MODULOS/CAT2_MODULOS), filtrando por lo que el
// cliente actual tiene realmente activado.
function construirMenu() {
    const cat        = window.currentUser?.categoria || 'primera';
    const esSegunda  = cat === 'segunda';
    const catalogo   = esSegunda ? (window.CAT2_MODULOS || []) : (window.CAT1_MODULOS || []);
    const defaults   = esSegunda ? cat2ModulosDefecto() : cat1ModulosDefecto();
    const efectivos  = window.currentUser?.modulosActivos || defaults;

    const grupos = {};
    catalogo.forEach(m => {
        const activo = m.id in efectivos ? efectivos[m.id] : m.defecto;
        if (!activo) return;
        if (!grupos[m.grupo]) grupos[m.grupo] = [];
        grupos[m.grupo].push({ id: m.id, label: m.label, icono: m.icono || '📄' });
    });

    return MENU_GRUPOS_ORDEN
        .filter(g => grupos[g] && grupos[g].length)
        .map(g => ({
            id: g.toLowerCase(),
            label: g,
            icono: MENU_GRUPOS_META[g]?.icono || '📁',
            desc: MENU_GRUPOS_META[g]?.desc || '',
            modulos: grupos[g],
        }));
}

// Punto único que dispara el re-render de toda UI de navegación dependiente
// del menú (Home abanico, selector de módulo en topbar). Se llama cada vez
// que cambia la categoría tributaria o el set de módulos activos del cliente.
function refrescarMenuNavegacion() {
    const menu = construirMenu();
    renderHomeGroups(menu);
    renderModuleSwitch(menu);
}

// Sub-secciones reales por módulo — mostradas en el panel .tentacle-data al
// pasar el cursor (ver integracion-diseno.md 5.1). Son los tabs reales que ya
// existen en cada vista (modTab()/renderMap en app.js), no datos inventados.
const MENU_SUBSECCIONES = {
    'estructura-contable':       ['Libro Diario', 'Libro Mayor', 'Balance General', 'Plan de Cuentas'],
    'reportes-financieros':      ['Balance Clasificado', 'Estado de Resultados', 'Flujo de Caja'],
    'egresos-ingresos':          ['Libro de Compras', 'Libro de Ventas', 'Boletas de Honorarios'],
    'tributario-1cat':           ['Declaración de Impuestos (F29/IVA)'],
    'conciliacion-cartolas':     ['Cartolas Bancarias', 'Conciliación Bancaria'],
    remuneraciones:              ['Liquidaciones', 'Indicadores Previsionales'],
    'activos-produccion':        ['Activos Fijos', 'Productos y Servicios'],
    auditoria:                   ['Informe de Auditoría', 'Hallazgos'],
    'libros-contables-hon':      ['Libro de Honorarios', 'Libro de Ingresos', 'Libro de Egresos'],
    'declaracion-impuestos-hon': ['Formulario 29', 'Formulario 22'],
    'auditoria-hon':             ['Informe de Auditoría', 'Hallazgos'],
};

// El prototipo diseña los tentáculos como chips cortos de 1-3 palabras
// ("Estructura contable", "Tributario"). Los labels reales del catálogo son
// más descriptivos y traen detalle entre paréntesis ("Estructura Contable
// (Diario/Mayor/Balance)") — con nowrap eso arma pills demasiado anchas y la
// distribución radial (pensada para chips cortos) los hace solaparse. Se usa
// el label corto (sin el paréntesis) solo en el chip; el label completo queda
// como title/tooltip y el detalle real sigue disponible en MENU_SUBSECCIONES.
function etiquetaCortaModulo(label) {
    return label.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

// ── Home: navegación abanico/pulpo ──────────────────────────────────────────
// Ported de Diseño de apps/new desing.html (renderHomeGroups/toggleGroup),
// adaptado para leer el menú real (construirMenu()) en vez del array
// hardcodeado del prototipo. Asume 3 grupos (Comercial/Contabilidad/Empresa) —
// mismo supuesto que el prototipo original.
const HOME_FAN_TILTS   = ['-6deg', '0deg', '6deg'];
const HOME_FAN_LIFTS   = ['18px', '0px', '18px'];
const HOME_FAN_ACCENTS = ['var(--blue)', 'var(--coral)', 'var(--periwinkle)'];

function renderHomeGroups(menu) {
    const cardsEl = document.getElementById('homeFanCards');
    if (!cardsEl) return;

    cardsEl.innerHTML = menu.map((g, gi) => {
        const n = g.modulos.length;
        const arc        = Math.min(172, 55 + n * 32);
        const baseRadius = 165 + (n > 3 ? 20 : 0);
        const ringGap    = 88;
        const maxTier    = Math.floor((n - 1) / 2);
        const startAngle = -arc / 2;
        const step       = n > 1 ? arc / (n - 1) : 0;

        const tentaculos = g.modulos.map((m, i) => {
            const angle = startAngle + step * i;
            const rad   = angle * Math.PI / 180;
            const tier  = maxTier - Math.floor(Math.abs(i - (n - 1) / 2));
            const radius = baseRadius + tier * ringGap;
            const tx = Math.round(Math.sin(rad) * radius);
            const ty = Math.round(-radius - Math.cos(rad) * 22 + 22);
            const secs = MENU_SUBSECCIONES[m.id] || [];
            const zBase = Math.round(20 - Math.abs(i - (n - 1) / 2) * 4);
            return `<button class="tentacle" style="--tx:${tx}px;--ty:${ty}px;--i:${i};--z:${zBase}" title="${m.label}" onclick="event.stopPropagation();irAModuloDesdeHome('${m.id}')">
                <span class="t-ic">${m.icono}</span>${etiquetaCortaModulo(m.label)}
                ${secs.length ? `<div class="tentacle-data" onclick="event.stopPropagation()">
                    <div class="td-title">Secciones</div>
                    <ul class="td-list">${secs.map(s => `<li>${s}</li>`).join('')}</ul>
                </div>` : ''}
            </button>`;
        }).join('');

        return `<div class="group-card" style="--tilt:${HOME_FAN_TILTS[gi] || '0deg'};--lift:${HOME_FAN_LIFTS[gi] || '0px'};--accent:${HOME_FAN_ACCENTS[gi] || 'var(--coral)'}" onclick="toggleGrupoHome(${gi})">
            <div class="gc-ic">${g.icono}</div>
            <div class="gc-title">${g.label}</div>
            <div class="gc-count">${n} módulo${n === 1 ? '' : 's'} · toca para explorar</div>
            <div class="tentacles">${tentaculos}</div>
        </div>`;
    }).join('');
}

function toggleGrupoHome(gi) {
    const fan = document.getElementById('homeFan');
    const bg  = document.getElementById('homeBgDash');
    if (!fan) return;
    const cards = fan.querySelectorAll('.group-card');
    const card  = cards[gi];
    if (!card) return;
    const yaExpandido = card.classList.contains('expanded');
    cards.forEach(c => c.classList.remove('expanded'));
    if (!yaExpandido) {
        card.classList.add('expanded');
        fan.classList.add('has-expanded');
        if (bg) bg.classList.add('blurred');
    } else {
        fan.classList.remove('has-expanded');
        if (bg) bg.classList.remove('blurred');
    }
}

function cerrarGrupoHome() {
    const fan = document.getElementById('homeFan');
    if (!fan) return;
    fan.querySelectorAll('.group-card').forEach(c => c.classList.remove('expanded'));
    fan.classList.remove('has-expanded');
    const bg = document.getElementById('homeBgDash');
    if (bg) bg.classList.remove('blurred');
}

function irAModuloDesdeHome(id) {
    cerrarGrupoHome();
    navegar(id);
}

// ── Topbar: selector de módulo (dropdown) ───────────────────────────────────
function renderModuleSwitch(menu) {
    const panel = document.getElementById('modulePanel');
    if (!panel) return;
    const activo = window._moduloActivo || '';
    panel.innerHTML = menu.map(g => `
        <div class="mp-group">
            <div class="mp-glabel">${g.label}</div>
            ${g.modulos.map(m => `<div class="mp-item ${m.id === activo ? 'active' : ''}" onclick="event.stopPropagation();cerrarModulePanel();navegar('${m.id}')">
                <span class="mp-ic">${m.icono}</span>${m.label}
            </div>`).join('')}
        </div>`).join('')
        + `<div class="mp-group">
            <div class="mp-item ${activo === 'configuracion' ? 'active' : ''}" onclick="event.stopPropagation();cerrarModulePanel();navegar('configuracion')">
                <span class="mp-ic">⚙️</span>Configuración
            </div>
        </div>`;
}

function toggleModulePanel(ev) {
    if (ev) ev.stopPropagation();
    const panel = document.getElementById('modulePanel');
    if (!panel) return;
    const abrir = !panel.classList.contains('open');
    if (abrir) renderModuleSwitch(construirMenu());
    panel.classList.toggle('open', abrir);
}

function cerrarModulePanel() {
    const panel = document.getElementById('modulePanel');
    if (panel) panel.classList.remove('open');
}

// Busca label/icono de un módulo dentro del menú actual (para el label del
// selector en el topbar). 'inicio'/'configuracion' se resuelven aparte.
function buscarInfoModulo(id) {
    if (id === 'configuracion') return { label: 'Configuración', icono: '⚙️' };
    if (id === 'inicio')        return { label: 'Inicio', icono: '🏠' };
    for (const g of construirMenu()) {
        const f = g.modulos.find(m => m.id === id);
        if (f) return { label: f.label, icono: f.icono };
    }
    return { label: id, icono: '📄' };
}

// Muestra/oculta home-header vs app-topbar según el módulo activo, y
// actualiza el label del selector de módulo. Se llama al final de navegar().
function actualizarTopbarModulo(modulo) {
    window._moduloActivo = modulo;
    const esInicio   = modulo === 'inicio';
    const homeHeader = document.getElementById('home-header');
    const appTopbar  = document.getElementById('app-topbar');
    const pageTitle  = document.getElementById('pageTitleBar');
    const backHome   = document.getElementById('btnBackHome');
    const modSwitch  = document.getElementById('moduleSwitch');
    if (homeHeader) homeHeader.style.display = esInicio ? 'flex' : 'none';
    if (appTopbar)  appTopbar.style.display  = esInicio ? 'none' : '';
    if (pageTitle)  pageTitle.style.display  = esInicio ? 'none' : '';
    if (backHome)   backHome.style.display   = esInicio ? 'none' : '';
    if (modSwitch)  modSwitch.style.display  = esInicio ? 'none' : '';
    if (!esInicio) {
        const info = buscarInfoModulo(modulo);
        const lbl = document.getElementById('msLabel');
        const ic  = document.getElementById('msIcon');
        if (lbl) lbl.textContent = info.label;
        if (ic)  ic.textContent  = info.icono;
        renderModuleSwitch(construirMenu());
    }
}

// Panel de notificaciones del topbar — contenido de ejemplo (decorativo, sin
// datos reales de notificaciones todavía), igual que en new desing.html.
function toggleNotifPanel(ev) {
    if (ev) ev.stopPropagation();
    const panel = document.getElementById('notifPanel');
    if (panel) panel.classList.toggle('open');
}

// Menú de usuario (email, Modo Prueba, Cambiar empresa, Sync, Salir) — mismo
// patrón click-to-open que el selector de módulo y notificaciones.
function toggleUserMenu(ev) {
    if (ev) ev.stopPropagation();
    const panel = document.getElementById('userMenuPanel');
    if (panel) panel.classList.toggle('open');
}

// Chip "cambiar de cliente" en el header de Inicio — mismo patrón dropdown.
// La carga de la lista (Firestore) es responsabilidad de firebase-service.js
// (_fbRenderHomeClientSwitch), acá solo se abre/cierra el panel.
function toggleHomeClientSwitch(ev) {
    if (ev) ev.stopPropagation();
    const panel = document.getElementById('homeClientPanel');
    if (!panel) return;
    const abriendo = !panel.classList.contains('open');
    panel.classList.toggle('open');
    if (abriendo && typeof _fbRenderHomeClientSwitch === 'function') _fbRenderHomeClientSwitch();
}

// Cerrar dropdowns del topbar al hacer click fuera (mismo patrón para
// selector de módulo, notificaciones y menú de usuario: click-fuera + stopPropagation interno)
document.addEventListener('click', (e) => {
    const panel = document.getElementById('modulePanel');
    if (panel && panel.classList.contains('open') && !e.target.closest('.module-switch')) {
        panel.classList.remove('open');
    }
    const notif = document.getElementById('notifPanel');
    if (notif && notif.classList.contains('open') && !e.target.closest('.notif-panel') && !e.target.closest('[onclick*="toggleNotifPanel"]')) {
        notif.classList.remove('open');
    }
    const userPanel = document.getElementById('userMenuPanel');
    if (userPanel && userPanel.classList.contains('open') && !e.target.closest('.user-menu')) {
        userPanel.classList.remove('open');
    }
    const hcsPanel = document.getElementById('homeClientPanel');
    if (hcsPanel && hcsPanel.classList.contains('open') && !e.target.closest('.home-client-switch')) {
        hcsPanel.classList.remove('open');
    }
});

window.MENU_GRUPOS_ORDEN       = MENU_GRUPOS_ORDEN;
window.construirMenu           = construirMenu;
window.refrescarMenuNavegacion = refrescarMenuNavegacion;
window.renderHomeGroups        = renderHomeGroups;
window.toggleGrupoHome         = toggleGrupoHome;
window.cerrarGrupoHome         = cerrarGrupoHome;
window.irAModuloDesdeHome      = irAModuloDesdeHome;
window.toggleNotifPanel        = toggleNotifPanel;
window.toggleUserMenu          = toggleUserMenu;
window.toggleHomeClientSwitch  = toggleHomeClientSwitch;
window.renderModuleSwitch      = renderModuleSwitch;
window.toggleModulePanel       = toggleModulePanel;
window.cerrarModulePanel       = cerrarModulePanel;
window.actualizarTopbarModulo  = actualizarTopbarModulo;
