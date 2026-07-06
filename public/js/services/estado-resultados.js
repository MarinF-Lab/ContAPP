// ─────────────────────────────────────────────────────────────
//  ESTADO DE RESULTADOS — 4 niveles de utilidad
// ─────────────────────────────────────────────────────────────

const COSTOS_CUENTAS    = ['Costo de Ventas'];
const GASTOS_FIN_CUENTAS = [
    'Intereses Pagados', 'Intereses y Gastos Financieros',
    'Comisiones Bancarias', 'Gastos Financieros',
];

function generarEstadoResultados() {
    const cuentas = recopilarMovimientosPorCuenta();

    const ingresos    = [];
    const costoVentas = [];
    const gastosOp    = [];
    const gastosFin   = [];

    Object.entries(cuentas).forEach(([nombre, mov]) => {
        const info = (PLAN_CUENTAS && PLAN_CUENTAS[nombre]) || ESQUEMA_CUENTAS[nombre];
        if (!info) return;

        if (info.tipo === 'Ganancia') {
            const monto = mov.haber - mov.debe;
            if (monto !== 0) ingresos.push({ nombre, monto });
        } else if (info.tipo === 'Pérdida') {
            const monto = mov.debe - mov.haber;
            if (monto !== 0) {
                if      (COSTOS_CUENTAS.includes(nombre))    costoVentas.push({ nombre, monto });
                else if (GASTOS_FIN_CUENTAS.includes(nombre)) gastosFin.push({ nombre, monto });
                else                                          gastosOp.push({ nombre, monto });
            }
        }
    });

    const totIngresos  = ingresos.reduce((s, x) => s + x.monto, 0);
    const totCosto     = costoVentas.reduce((s, x) => s + x.monto, 0);
    const utilBruta    = totIngresos - totCosto;
    const totGastosOp  = gastosOp.reduce((s, x) => s + x.monto, 0);
    const utilOp       = utilBruta - totGastosOp;
    const totGastosFin = gastosFin.reduce((s, x) => s + x.monto, 0);
    const utilAntesImp = utilOp - totGastosFin;

    // Tasa de impuesto desde el selector
    const tasa     = parseFloat(document.getElementById('erTasaImpuesto')?.value || '0.27');
    const impuesto = utilAntesImp > 0 ? Math.round(utilAntesImp * tasa) : 0;
    const utilNeta = utilAntesImp - impuesto;

    // ── Renderizado ──────────────────────────────────────────
    const clr = (v) => v >= 0 ? 'var(--positive)' : 'var(--negative)';

    const filaItem = (nombre, monto, indent) => `
        <div class="er-fila${indent ? ' er-indent' : ''}">
            <span>${nombre}</span>
            <span style="color:${clr(monto)};font-family:'JetBrains Mono',monospace;">$${fmt(Math.abs(monto))}</span>
        </div>`;

    const filaTitulo = (texto) => `<div class="er-titulo">${texto}</div>`;

    const filaTotal = (texto, monto, destacado) => {
        const clsFinal = destacado
            ? (monto >= 0 ? ' er-total-final er-total-positivo' : ' er-total-final er-total-negativo')
            : '';
        const colorMonto = destacado ? 'inherit' : clr(monto);
        const signo = destacado ? (monto >= 0 ? '+' : '-') : '';
        return `<div class="er-total${clsFinal}">
            <span>${texto}</span>
            <span style="color:${colorMonto};font-family:'JetBrains Mono',monospace;">${signo}$${fmt(Math.abs(monto))}</span>
        </div>`;
    };

    let html = '';

    // Ingresos
    html += filaTitulo('Ingresos Operacionales');
    ingresos.forEach(x => { html += filaItem(x.nombre, x.monto, true); });
    html += filaTotal('Total Ingresos', totIngresos);

    // Costo de ventas
    if (costoVentas.length) {
        html += filaTitulo('Costo de Ventas');
        costoVentas.forEach(x => { html += filaItem(x.nombre, -x.monto, true); });
        html += filaTotal('Total Costo de Ventas', -totCosto);
    }

    html += filaTotal('UTILIDAD BRUTA', utilBruta);

    // Gastos operacionales
    html += filaTitulo('Gastos Operacionales');
    if (gastosOp.length) {
        gastosOp.forEach(x => { html += filaItem(x.nombre, -x.monto, true); });
    } else {
        html += `<div class="er-fila er-indent" style="color:var(--text-muted);">Sin gastos operacionales registrados</div>`;
    }
    html += filaTotal('Total Gastos Operacionales', -totGastosOp);

    html += filaTotal('UTILIDAD OPERACIONAL', utilOp);

    // Gastos financieros
    if (gastosFin.length) {
        html += filaTitulo('Gastos Financieros');
        gastosFin.forEach(x => { html += filaItem(x.nombre, -x.monto, true); });
        html += filaTotal('Total Gastos Financieros', -totGastosFin);
    }

    html += filaTotal('UTILIDAD ANTES DE IMPUESTO', utilAntesImp);

    // Impuesto a la renta
    if (tasa > 0) {
        html += filaTitulo(`Impuesto a la Renta (${Math.round(tasa * 100)}%)`);
        html += filaItem('Impuesto a la Renta', -impuesto, true);
    }

    html += filaTotal('UTILIDAD NETA DEL EJERCICIO', utilNeta, true);

    const cont = document.getElementById('estadoResultadosCont');
    if (cont) cont.innerHTML = html ||
        `<div style="padding:32px;text-align:center;color:var(--text-muted);">Sin movimientos registrados.</div>`;

    // KPIs
    _erSetKPI('erKpiIngresos',   totIngresos);
    _erSetKPI('erKpiCostos',    -totCosto);
    _erSetKPI('erKpiGastos',    -totGastosOp);
    _erSetKPI('erKpiAntesImp',   utilAntesImp);
    _erSetKPI('erKpiResultado',  utilNeta);
}

function _erSetKPI(id, val) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = '$' + fmt(Math.abs(val));
    el.style.color = val >= 0 ? 'var(--positive)' : 'var(--negative)';
}
