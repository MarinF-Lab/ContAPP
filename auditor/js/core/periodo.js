// ─────────────────────────────────────────────────────────────
//  PERÍODO DE TRABAJO — mes/año con el que se está trabajando
// ─────────────────────────────────────────────────────────────
// Un único {mes, anio} guardado en localStorage: todos los selectores de
// período de la app arrancan en él (en vez de volver al mes/año actual al
// recargar) y cada vez que el usuario cambia uno, queda como el nuevo período
// de trabajo. Mes 1-12; "0 = todos los meses" nunca se guarda.

const PERIODO_KEY = 'core_periodo_trabajo';

function periodoTrabajo() {
    try {
        const p = JSON.parse(localStorage.getItem(PERIODO_KEY));
        if (p && p.mes >= 1 && p.mes <= 12 && p.anio >= 2000) return { mes: p.mes, anio: p.anio };
    } catch { /* sin dato válido: cae al mes actual */ }
    const h = new Date();
    return { mes: h.getMonth() + 1, anio: h.getFullYear() };
}

function guardarPeriodoTrabajo(parcial) {
    const actual = periodoTrabajo();
    const mes  = parseInt(parcial.mes,  10);
    const anio = parseInt(parcial.anio, 10);
    const nuevo = {
        mes:  mes  >= 1 && mes  <= 12 ? mes  : actual.mes,
        anio: anio >= 2000            ? anio : actual.anio,
    };
    try { localStorage.setItem(PERIODO_KEY, JSON.stringify(nuevo)); } catch { /* sin storage */ }
}

// Selectores con mes 1-12 y año, ya presentes en index.html o creados al
// renderizar un módulo.
const _PERIODO_IDS_MES = [
    'selDiarioHistMes', 'selBalanceMes', 'selComprasMes', 'selVentasMes', 'selBalanceClasifMes',
    'selErMes', 'selFlujoCajaMes', 'selIvaMes', 'ingMes', 'egrMes', 'honLibroMes', 'retMes',
    'f29honMes', 'ppmMes', 'invFiltroMes', 'sel-mes-cartola', 'recPeriodoMes',
];
const _PERIODO_IDS_ANIO = [
    'selDiarioHistAnio', 'selBalanceAnio', 'selComprasAnio', 'selVentasAnio', 'selBalanceClasifAnio',
    'selErAnio', 'selFlujoCajaAnio', 'selIvaAnio', 'ingAnio', 'egrAnio', 'honLibroAnio', 'retAnio',
    'f29honAnio', 'ppmAnio', 'invFiltroAnio', 'sel-anio-cartola', 'recPeriodoAnio',
];
// El selector de Activos usa mes 0-11 (estilo Date).
const _PERIODO_ID_MES_ACTIVOS  = 'activo-sel-mes';
const _PERIODO_ID_ANIO_ACTIVOS = 'activo-sel-anio';

function _periodoFijarSelect(el, valor) {
    if (!el) return;
    const v = String(valor);
    if (![...el.options].some(o => o.value === v)) return;
    el.value = v;
    // Los inits "solo la primera vez" (dataset.init) no deben pisar lo restaurado.
    el.dataset.init = '1';
}

// Aplica el período de trabajo a los selectores que ya existen en el DOM.
function aplicarPeriodoTrabajo() {
    const p = periodoTrabajo();
    _PERIODO_IDS_MES.forEach(id  => _periodoFijarSelect(document.getElementById(id), p.mes));
    _PERIODO_IDS_ANIO.forEach(id => _periodoFijarSelect(document.getElementById(id), p.anio));
    _periodoFijarSelect(document.getElementById(_PERIODO_ID_MES_ACTIVOS),  p.mes - 1);
    _periodoFijarSelect(document.getElementById(_PERIODO_ID_ANIO_ACTIVOS), p.anio);
}

// Guarda cualquier cambio hecho en esos selectores (también los creados
// dinámicamente: el listener es delegado, en fase de captura).
document.addEventListener('change', (e) => {
    const id = e.target && e.target.id;
    if (!id) return;
    if (_PERIODO_IDS_MES.includes(id))   guardarPeriodoTrabajo({ mes: e.target.value });
    else if (_PERIODO_IDS_ANIO.includes(id)) guardarPeriodoTrabajo({ anio: e.target.value });
    else if (id === _PERIODO_ID_MES_ACTIVOS)  guardarPeriodoTrabajo({ mes: parseInt(e.target.value, 10) + 1 });
    else if (id === _PERIODO_ID_ANIO_ACTIVOS) guardarPeriodoTrabajo({ anio: e.target.value });
}, true);

// Después de que todos los módulos corrieron sus propios defaults.
window.addEventListener('load', aplicarPeriodoTrabajo);

window.periodoTrabajo         = periodoTrabajo;
window.guardarPeriodoTrabajo  = guardarPeriodoTrabajo;
window.aplicarPeriodoTrabajo  = aplicarPeriodoTrabajo;
