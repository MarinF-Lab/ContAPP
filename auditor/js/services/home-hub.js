'use strict';
// ─────────────────────────────────────────────────────────────────────────────
//  HOME HUB — navegación de Inicio: tarjetas planas por grupo + panel lateral
//  de módulos en chips. Reemplaza el abanico/pulpo (.home-fan/.group-card) de
//  menu.js. La interacción (tocar grupo → panel con chips, hint al pasar el
//  cursor) está adaptada de auditor - copia (js/services/kluster-hub.js,
//  abrirPulpo()), descartando toda la geometría de gemas/Voronoi
//  (klGemSvg/klFacetsOf/klShadeOf/klBuildModules/klRecomputeCells) y la
//  animación de fragmentos volando — acá el panel simplemente aparece
//  centrado con fade/scale (ver css/home-hub.css, .hh-overlay/.hh-panel).
//
//  También arma el riel de 3 secciones de #view-inicio (Centro de mando /
//  Financiero y actividad / Configuración): a diferencia del prototipo
//  (PLANIFICACION/kluster-rediseno.html, transform:translateY + handlers de
//  wheel/touch manuales), acá se usa scroll-snap nativo — la Sección 2 es el
//  dashboard real, mucho más alto que un viewport, así que interceptar la
//  rueda por completo le rompería el scroll interno; además un transform en
//  el contenedor rompería el position:fixed de #modalEditarEmpresa, anidado
//  adentro.
// ─────────────────────────────────────────────────────────────────────────────

// 5 colores — igual a la cantidad máxima de grupos hoy (primera categoría,
// G1-G5); segunda categoría (3 grupos) simplemente usa los 3 primeros.
const HOME_HUB_ACCENTS = ['var(--blue)', 'var(--coral)', 'var(--ok)', 'var(--warn)', 'var(--navy)']; // todos con contraste AA como texto

// ── Sección 1: grupos de módulos reales ─────────────────────────────────────
// Etapa 3 (revisión de Inicio): cada grupo es una tarjeta compacta con sus
// módulos como botones directos (un clic, sin panel intermedio), como la referencia.
const _hhIco = n => (window.ContappIconos ? ContappIconos.svg(n) : '');
const _hhEsc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function _hhTarjetaGrupo({ icono, titulo, sub, color, items }) {
    return `<div class="hh-grupo" style="--gcolor:${color}">
        <div class="hh-grupo-h"><span class="ic">${icono}</span><h3>${_hhEsc(titulo)}<small>${_hhEsc(sub)}</small></h3></div>
        <div class="hh-mods">${items.map(it => `<button type="button" class="hh-mod" onclick="${it.accion}" ${it.hint ? `title="${_hhEsc(it.hint)}"` : ''}>
            <span>${_hhEsc(it.label)}</span>${_hhIco('flecha')}</button>`).join('')}</div>
    </div>`;
}

function renderHomeHubTiles(menu) {
    const cont = document.getElementById('homeHubTiles');
    if (!cont) return;
    cont.innerHTML = menu.map((g, i) => _hhTarjetaGrupo({
        icono: window.ContappIconos ? ContappIconos.grupo(g.label) : g.icono,
        titulo: g.label,
        sub: `${g.modulos.length} módulo${g.modulos.length === 1 ? '' : 's'}`,
        color: HOME_HUB_ACCENTS[i] || 'var(--coral)',
        items: g.modulos.map(m => ({
            label: etiquetaCortaModulo(m.label),
            hint: (MENU_SUBSECCIONES[m.id] || []).join(' · '),
            accion: `irAModuloDesdeHome('${m.id}')`,
        })),
    })).join('');
}

function abrirGrupoHome(grupoId, tileEl) {
    const grupo = construirMenu().find(g => g.id === grupoId);
    if (!grupo) return;
    _abrirHomeHubPanel({
        icono: grupo.icono,
        titulo: `${grupo.modulos.length} módulo${grupo.modulos.length === 1 ? '' : 's'}`,
        accent: tileEl?.style.getPropertyValue('--accent'),
        items: grupo.modulos.map(m => ({
            icono: m.icono,
            label: etiquetaCortaModulo(m.label),
            hint: (MENU_SUBSECCIONES[m.id] || []).join(' · '),
            onSelect: () => irAModuloDesdeHome(m.id),
        })),
    });
}

function cerrarGrupoHome() {
    document.getElementById('hhOverlay')?.classList.remove('abierto');
}

function irAModuloDesdeHome(id) {
    cerrarGrupoHome();
    navegar(id);
}

// ── Sección 3: Configuración — 3 grupos que cubren las 7 tarjetas reales de
// #view-configuracion (no se duplica ni se modifica esa vista, solo se
// navega a ella y se hace scroll hasta el card correspondiente). ──
const CONFIG_HOME_GRUPOS = [
    { id: 'cfg-empresa', label: 'Empresa', icono: '🏢', modulos: [
        { id: 'cfgCardEmpresa',     label: 'Datos de la empresa',   icono: '🏢' },
        { id: 'cfgCardModulos',     label: 'Módulos activos',       icono: '🧩' },
        { id: 'cfgCardCertificado', label: 'Certificado Digital',   icono: '🔐' },
    ]},
    { id: 'cfg-usuarios', label: 'Usuarios y sesión', icono: '👥', modulos: [
        { id: 'cfgCardUsuarios', label: 'Usuarios de la Empresa', icono: '👥' },
        { id: 'cfgCardSesion',   label: 'Sesión activa',          icono: '👤' },
    ]},
    { id: 'cfg-ia', label: 'IA y sincronización', icono: '✨', modulos: [
        { id: 'cfgCardIA',       label: 'IA — Google Gemini',      icono: '✨' },
        { id: 'cfgCardFirebase', label: 'Sincronización Firebase', icono: '☁️' },
        { id: 'cfgCardRespaldo', label: 'Respaldo del cliente',    icono: '💾' },
    ]},
];

function renderHomeHubConfigTiles() {
    const cont = document.getElementById('homeHubConfigTiles');
    if (!cont) return;
    const ICONO_CFG = { 'cfg-empresa': 'edificio', 'cfg-usuarios': 'personas', 'cfg-ia': 'nube' };
    cont.innerHTML = CONFIG_HOME_GRUPOS.map((g, i) => _hhTarjetaGrupo({
        icono: _hhIco(ICONO_CFG[g.id] || 'engranaje'),
        titulo: g.label,
        sub: `${g.modulos.length} sección${g.modulos.length === 1 ? '' : 'es'}`,
        color: HOME_HUB_ACCENTS[i] || 'var(--coral)',
        items: g.modulos.map(m => ({ label: m.label, accion: `irAConfigDesdeHome('${m.id}')` })),
    })).join('');
}

function abrirConfigGrupoHome(grupoId, tileEl) {
    const grupo = CONFIG_HOME_GRUPOS.find(g => g.id === grupoId);
    if (!grupo) return;
    _abrirHomeHubPanel({
        icono: grupo.icono,
        titulo: grupo.label,
        accent: tileEl?.style.getPropertyValue('--accent'),
        items: grupo.modulos.map(m => ({
            icono: m.icono,
            label: m.label,
            hint: '',
            onSelect: () => irAConfigDesdeHome(m.id),
        })),
    });
}

function irAConfigDesdeHome(anchorId) {
    cerrarGrupoHome();
    navegar('configuracion');
    requestAnimationFrame(() => {
        document.getElementById(anchorId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
}

// ── Panel lateral de chips (compartido por Sección 1 y Sección 3) ──────────
function _abrirHomeHubPanel({ icono, titulo, accent, items }) {
    const overlay = document.getElementById('hhOverlay');
    const panel   = document.getElementById('hhPanel');
    if (!overlay || !panel) return;
    panel.style.setProperty('--gcolor', accent || 'var(--navy)');
    document.getElementById('hhPanelIcon').textContent = icono || '📁';
    document.getElementById('hhPanelTitulo').textContent = titulo || '';
    const hint = document.getElementById('hhPanelHint');
    hint.textContent = '';
    hint.classList.remove('desc-activa');

    const grid = document.getElementById('hhPanelGrid');
    grid.innerHTML = items.map((it, i) => `<div class="hh-chip" style="--i:${i}" data-idx="${i}">
        <span class="hh-chip-nombre">${it.icono ? it.icono + ' ' : ''}${it.label}</span><span class="hh-chip-flecha">›</span>
    </div>`).join('');
    grid.querySelectorAll('.hh-chip').forEach((chipEl, i) => {
        const it = items[i];
        chipEl.addEventListener('click', () => it.onSelect());
        if (it.hint) {
            chipEl.addEventListener('mouseenter', () => { hint.textContent = it.hint; hint.classList.add('desc-activa'); });
            chipEl.addEventListener('mouseleave', () => { hint.textContent = ''; hint.classList.remove('desc-activa'); });
        }
    });

    overlay.classList.add('abierto');
}

// Construye el DOM del overlay/panel una sola vez (no requiere marcado
// estático en index.html — mismo criterio que otros paneles de la app,
// p.ej. modulePanel/notifPanel, pero acá vive fuera de la topbar así que se
// arma directo en <body> para no depender de la profundidad de anidación de
// #view-inicio).
(function _hhInjectPanelDOM() {
    if (document.getElementById('hhOverlay')) return;
    const overlay = document.createElement('div');
    overlay.className = 'hh-overlay';
    overlay.id = 'hhOverlay';
    overlay.innerHTML = `
        <div class="hh-panel" id="hhPanel">
            <div class="hh-cerrar" onclick="cerrarGrupoHome()">✕</div>
            <div class="hh-panel-body">
                <div class="hh-panel-head">
                    <div class="hh-panel-icon" id="hhPanelIcon"></div>
                    <div>
                        <div class="hh-panel-titulo" id="hhPanelTitulo"></div>
                        <div class="hh-panel-hint" id="hhPanelHint"></div>
                    </div>
                </div>
                <div class="hh-panel-grid" id="hhPanelGrid"></div>
            </div>
        </div>`;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrarGrupoHome(); });
    document.body.appendChild(overlay);
})();

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cerrarGrupoHome();
});

// ── Riel de 3 secciones (#inViewport) ───────────────────────────────────────
function irASeccion(i) {
    document.getElementById('inSlide' + i)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// #inViewport se dimensiona con calc(100dvh - var(--home-header-h)) (ver
// home-hub.css) en vez de height:100% porque la cadena de ancestros
// (.view-container/.main-content/body) no tiene una altura definida —
// <body> usa min-height:100vh, no height:100vh — así que un porcentaje en
// cascada no resuelve contra nada y el hub terminaba creciendo al alto de
// su contenido. Se mide el alto real de #home-header (varía en responsive)
// y se publica como custom property en :root.
function _hhMedirHomeHeader() {
    const header = document.getElementById('home-header');
    if (!header) return;
    document.documentElement.style.setProperty('--home-header-h', header.getBoundingClientRect().height + 'px');
}

let _hhScrollDebounce = null;
function _hhSincronizarDot() {
    const viewport = document.getElementById('inViewport');
    if (!viewport) return;
    const slides = ['inSlide0', 'inSlide1', 'inSlide2'].map(id => document.getElementById(id));
    const vpTop = viewport.getBoundingClientRect().top;
    let activo = 0, mejor = Infinity;
    slides.forEach((s, i) => {
        if (!s) return;
        const d = Math.abs(s.getBoundingClientRect().top - vpTop);
        if (d < mejor) { mejor = d; activo = i; }
    });
    document.querySelectorAll('#inRail .in-dot').forEach((dot, i) => dot.classList.toggle('activo', i === activo));
}

document.addEventListener('DOMContentLoaded', () => {
    renderHomeHubConfigTiles();
    _hhMedirHomeHeader();
    // Re-medir en resize de ventana (cambios de layout responsive). El toggle
    // display:none↔flex de #home-header en sí se cubre desde
    // actualizarTopbarModulo() (menu.js), que es el único punto que lo muestra/oculta.
    let resizeDebounce = null;
    window.addEventListener('resize', () => {
        clearTimeout(resizeDebounce);
        resizeDebounce = setTimeout(_hhMedirHomeHeader, 120);
    });
    const viewport = document.getElementById('inViewport');
    if (!viewport) return;
    viewport.addEventListener('scroll', () => {
        clearTimeout(_hhScrollDebounce);
        _hhScrollDebounce = setTimeout(_hhSincronizarDot, 80);
    }, { passive: true });
});

// Flechas/PageUp/PageDown navegan el riel, salvo con un campo de formulario
// enfocado (en cualquier parte de la página, no solo dentro de Inicio) o si
// Inicio no es la vista activa.
document.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'PageDown' && e.key !== 'PageUp') return;
    const activo = document.activeElement;
    if (activo && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activo.tagName)) return;
    const viewInicio = document.getElementById('view-inicio');
    if (!viewInicio || !viewInicio.classList.contains('active')) return;
    const dots = document.querySelectorAll('#inRail .in-dot');
    if (!dots.length) return;
    let actual = 0;
    dots.forEach((d, i) => { if (d.classList.contains('activo')) actual = i; });
    if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); irASeccion(Math.min(actual + 1, dots.length - 1)); }
    else { e.preventDefault(); irASeccion(Math.max(actual - 1, 0)); }
});

window._hhMedirHomeHeader       = _hhMedirHomeHeader;
window.renderHomeHubTiles       = renderHomeHubTiles;
window.abrirGrupoHome           = abrirGrupoHome;
window.cerrarGrupoHome          = cerrarGrupoHome;
window.irAModuloDesdeHome       = irAModuloDesdeHome;
window.CONFIG_HOME_GRUPOS       = CONFIG_HOME_GRUPOS;
window.renderHomeHubConfigTiles = renderHomeHubConfigTiles;
window.abrirConfigGrupoHome     = abrirConfigGrupoHome;
window.irAConfigDesdeHome       = irAConfigDesdeHome;
window.irASeccion               = irASeccion;
