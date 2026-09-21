'use strict';
// ─────────────────────────────────────────────────────────────────────────────
//  MENU — fuente única de verdad para la navegación (Home abanico + topbar)
//  Reemplaza al sidebar estático: en vez de mostrar/ocultar DOM fijo, construye
//  en memoria la lista de grupos → módulos visibles (según categoría tributaria
//  + módulos activos por cliente) y la entrega a quien la necesite renderizar.
//  Ver Diseño de apps/integracion-diseno.md sección 7.
// ─────────────────────────────────────────────────────────────────────────────

// Orden restaurado a la división histórica G1-G5 de primera categoría
// (Contabilidad→Comercial→Datos→RRHH→Empresa) + Tributario, exclusivo de
// segunda categoría, al final — ver comentario en CAT1_MODULOS/CAT2_MODULOS
// (js/categorias/*.js) para el detalle de qué módulo va en cada grupo.
// construirMenu() ya filtra los grupos sin módulos activos, así que un mismo
// orden combinado sirve para ambas categorías sin duplicar la lista.
const MENU_GRUPOS_ORDEN = ['Contabilidad', 'Comercial', 'Datos', 'RRHH', 'Empresa', 'Tributario'];

const MENU_GRUPOS_META = {
    Contabilidad: { icono: '📚', desc: 'Libros contables y reportes financieros' },
    Comercial:    { icono: '🔁', desc: 'Egresos, ingresos y tributario' },
    Datos:        { icono: '🗂️', desc: 'Documentación, conciliación y contactos' },
    RRHH:         { icono: '👷', desc: 'Remuneraciones y previsión' },
    Empresa:      { icono: '🏢', desc: 'Inventario y activos' },
    Tributario:   { icono: '🧾', desc: 'Declaración de impuestos' },
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
    if (typeof renderHomeHubTiles === 'function') renderHomeHubTiles(menu);
    renderModuleSwitch(menu);
}

// Sub-secciones reales por módulo — mostradas como hint en el panel .hh-panel-hint
// (home-hub.js) al pasar el cursor sobre un chip. Son los tabs reales que ya
// existen en cada vista (modTab()/renderMap en app.js), no datos inventados.
const MENU_SUBSECCIONES = {
    'estructura-contable':       ['Libro Diario', 'Libro Mayor', 'Balance General', 'Plan de Cuentas'],
    'reportes-financieros':      ['Balance Clasificado', 'Estado de Resultados', 'Flujo de Caja'],
    'egresos-ingresos':          ['Libro de Compras', 'Libro de Ventas', 'Boletas de Honorarios'],
    'tributario-1cat':           ['Declaración de Impuestos (F29/IVA)'],
    'conciliacion-cartolas':     ['Cartolas Bancarias', 'Conciliación Bancaria'],
    remuneraciones:              ['Liquidaciones', 'Indicadores Previsionales'],
    'inventario-activos':        ['Centros de Costo', 'Bodegas', 'Movimientos', 'Activos Fijos', 'Productos y Servicios'],
    'libros-contables-hon':      ['Libro de Honorarios', 'Libro de Ingresos', 'Libro de Egresos'],
    'declaracion-impuestos-hon': ['Formulario 29', 'Formulario 22'],
};

// Los labels reales del catálogo traen detalle entre paréntesis ("Estructura
// Contable (Diario/Mayor/Balance)") que arma chips demasiado anchos en la
// grilla de 2 columnas del panel (home-hub.js, .hh-panel-grid). Se usa el
// label corto (sin el paréntesis) en el chip; el detalle real sigue
// disponible en MENU_SUBSECCIONES como hint al pasar el cursor.
function etiquetaCortaModulo(label) {
    return label.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

// ── Home: navegación por hub (tarjetas planas + panel de módulos) ─────────
// Ver js/services/home-hub.js: renderHomeHubTiles/abrirGrupoHome/cerrarGrupoHome/
// irAModuloDesdeHome reemplazan a renderHomeGroups/toggleGrupoHome/cerrarGrupoHome/
// irAModuloDesdeHome de la navegación abanico/pulpo anterior.

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
    if (esInicio && typeof _hhMedirHomeHeader === 'function') _hhMedirHomeHeader();
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
window.toggleNotifPanel        = toggleNotifPanel;
window.toggleUserMenu          = toggleUserMenu;
window.toggleHomeClientSwitch  = toggleHomeClientSwitch;
window.renderModuleSwitch      = renderModuleSwitch;
window.toggleModulePanel       = toggleModulePanel;
window.cerrarModulePanel       = cerrarModulePanel;
window.actualizarTopbarModulo  = actualizarTopbarModulo;
