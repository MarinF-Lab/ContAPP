// ─────────────────────────────────────────────────────────────
//  DASHBOARD FINANCIERO
// ─────────────────────────────────────────────────────────────
function calcularKPIs() {
    const cuentas  = recopilarMovimientosPorCuenta();
    let activos    = 0, pasivos = 0, ingresos = 0, gastos = 0, patrimonio = 0;

    Object.keys(cuentas).forEach(name => {
        const c    = cuentas[name];
        const tipo = ESQUEMA_CUENTAS[name]?.tipo || 'Activo';
        if (tipo === 'Activo')     activos    += (c.debe - c.haber);
        if (tipo === 'Pasivo')     pasivos    += (c.haber - c.debe);
        if (tipo === 'Patrimonio') patrimonio += (c.haber - c.debe);
        if (tipo === 'Ganancia')   ingresos   += (c.haber - c.debe);
        if (tipo === 'Pérdida')    gastos     += (c.debe  - c.haber);
    });

    const resultado = ingresos - gastos;

    const setKPI = (id, val, color) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerText = '$' + fmt(Math.abs(val));
        if (color) el.style.color = val >= 0 ? 'var(--positive)' : 'var(--negative)';
    };

    setKPI('kpi-activos',    activos);
    setKPI('kpi-pasivos',    pasivos);
    setKPI('kpi-ingresos',   ingresos);
    setKPI('kpi-resultado',  resultado, true);

    // Panel de onboarding si no hay datos
    const sinDatos = (!dbAsientos || dbAsientos.length === 0) && (!window.dbCompras || window.dbCompras.length === 0);
    const onbEl = document.getElementById('dash-onboarding');
    const chartsEl = document.getElementById('dash-charts-area');
    if (sinDatos) {
        if (onbEl) {
            onbEl.style.display = 'block';
            onbEl.innerHTML = `
            <div class="card" style="padding:28px 32px;text-align:center;max-width:520px;margin:32px auto;">
                <div style="font-size:36px;margin-bottom:12px;">👋</div>
                <h3 style="margin:0 0 8px;">Empieza aquí</h3>
                <p style="color:var(--text-muted);margin:0 0 20px;">Sigue estos pasos para configurar tu empresa.</p>
                <div style="text-align:left;display:flex;flex-direction:column;gap:12px;">
                    <div style="display:flex;align-items:center;gap:12px;">
                        <span style="font-size:18px;">1.</span>
                        <button class="btn btn-secondary" style="flex:1;" onclick="navegar('plan-cuentas', null)">Ingresa el plan de cuentas</button>
                    </div>
                    <div style="display:flex;align-items:center;gap:12px;">
                        <span style="font-size:18px;">2.</span>
                        <button class="btn btn-secondary" style="flex:1;" onclick="navegar('compras', null)">Registra tus primeras compras</button>
                    </div>
                    <div style="display:flex;align-items:center;gap:12px;">
                        <span style="font-size:18px;">3.</span>
                        <button class="btn btn-secondary" style="flex:1;" onclick="navegar('ventas', null)">Registra tus primeras ventas</button>
                    </div>
                    <div style="display:flex;align-items:center;gap:12px;">
                        <span style="font-size:18px;">4.</span>
                        <button class="btn btn-primary" style="flex:1;" onclick="navegar('diario', null)">Genera tu primer asiento</button>
                    </div>
                </div>
            </div>`;
        }
        if (chartsEl) chartsEl.style.display = 'none';
        return;
    }
    if (onbEl) onbEl.style.display = 'none';
    if (chartsEl) chartsEl.style.display = '';

    // Renderizar gráficos del dashboard
    _renderDashboardCharts(cuentas, ingresos, gastos, activos, pasivos, patrimonio, resultado);
    _renderUltimosAsientos();
    _renderTopCuentas(cuentas);
}

// ── Gráficos del dashboard (Chart.js — paso 6 de la integración de diseño,
//    reemplaza los SVG dibujados a mano que había antes) ───────────────────
const _dashCharts = { barras: null, donutActivos: null, donutResultado: null };

// Lee los tokens de color reales de variables.css (se reevalúan en cada
// render para que los gráficos se actualicen solos al cambiar de tema).
function _dashChartColors() {
    const cs = getComputedStyle(document.documentElement);
    const v = (name, fallback) => (cs.getPropertyValue(name) || fallback).trim();
    return {
        periwinkle: v('--periwinkle', '#92A5FD'),
        coral:      v('--coral', '#FF8692'),
        coralDeep:  v('--coral-deep', '#E8687A'),
        navy:       v('--navy', '#1E1E5D'),
        ok:         v('--ok', '#1FB579'),
        ink:        v('--ink', '#1E1E5D'),
        inkSoft:    v('--ink-soft', '#5B5F82'),
        inkFaint:   v('--ink-faint', '#9498B8'),
        rule:       v('--rule', '#E1E4F3'),
        fontMono:   v('--font-mono', "'IBM Plex Mono', monospace"),
        fontSans:   v('--font-sans', "'Manrope', sans-serif"),
    };
}

function _renderDashboardCharts(cuentas, ingresos, gastos, activos, pasivos, patrimonio, resultado) {
    if (typeof Chart === 'undefined') return; // CDN no disponible (offline) — no bloquear el resto del dashboard
    _renderBarrasMensuales();
    _renderDonutActivos(activos, pasivos, patrimonio);
    _renderDonutResultado(ingresos, gastos);
}

// Vuelve a dibujar los 3 gráficos con los colores del tema activo — se llama
// desde applyTheme() en index.html al cambiar entre claro/oscuro.
function refrescarGraficosDashboard() {
    if (typeof Chart === 'undefined' || !document.getElementById('dashBarrasMensuales')) return;
    calcularKPIs();
}
window.refrescarGraficosDashboard = refrescarGraficosDashboard;

// Barras mensuales: ingresos vs gastos (año actual)
function _renderBarrasMensuales() {
    const canvas = document.getElementById('dashBarrasMensuales');
    if (!canvas) return;
    const anio = new Date().getFullYear();
    const meses = Array.from({length: 12}, () => ({ ing: 0, gst: 0 }));

    (dbAsientos || []).forEach(a => {
        if (a.estado === 'ANULADO') return;
        if (!a.fecha || !a.fecha.includes('/')) return;
        const p = a.fecha.split('/');
        if (p.length < 3 || parseInt(p[2]) !== anio) return;
        const idx = parseInt(p[1]) - 1;
        if (idx < 0 || idx > 11) return;
        (a.movimientos || []).forEach(m => {
            const tipo = (PLAN_CUENTAS?.[m.cuenta] ?? ESQUEMA_CUENTAS[m.cuenta])?.tipo;
            if (tipo === 'Ganancia') meses[idx].ing += ((m.haber || 0) - (m.debe || 0));
            if (tipo === 'Pérdida')  meses[idx].gst += ((m.debe  || 0) - (m.haber || 0));
        });
    });

    const labels = ['E','F','M','A','M','J','J','A','S','O','N','D'];
    const c = _dashChartColors();

    if (_dashCharts.barras) _dashCharts.barras.destroy();
    _dashCharts.barras = new Chart(canvas, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                { label: 'Ingresos', data: meses.map(m => Math.max(m.ing, 0)), backgroundColor: c.periwinkle, borderRadius: 3, maxBarThickness: 14 },
                { label: 'Gastos',   data: meses.map(m => Math.max(m.gst, 0)), backgroundColor: c.coral,      borderRadius: 3, maxBarThickness: 14 },
            ],
        },
        options: {
            responsive: true, maintainAspectRatio: false, animation: false,
            plugins: {
                legend: { position: 'top', align: 'end', labels: { color: c.inkSoft, font: { family: c.fontSans, size: 11 }, boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: 'rectRounded' } },
                tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: $${fmt(ctx.parsed.y)}` } },
            },
            scales: {
                x: { grid: { display: false }, ticks: { color: c.inkFaint, font: { family: c.fontMono, size: 9.5 } } },
                y: { grid: { color: c.rule, borderDash: [3, 3] }, border: { display: false },
                     ticks: { color: c.inkFaint, font: { family: c.fontMono, size: 9 }, callback: (v) => v >= 1e6 ? (v/1e6).toFixed(1)+'M' : v >= 1e3 ? (v/1e3).toFixed(0)+'K' : v } },
            },
        },
    });
}

// Donut: distribución Activo vs Pasivo vs Patrimonio
function _renderDonutActivos(activos, pasivos, patrimonio) {
    const c = _dashChartColors();
    _renderDashDonut('dashDonutActivos', 'donutActivos', [
        { label: 'Activo',     val: Math.max(activos,    0), color: c.periwinkle },
        { label: 'Pasivo',     val: Math.max(pasivos,    0), color: c.coral },
        { label: 'Patrimonio', val: Math.max(patrimonio, 0), color: c.navy },
    ]);
}

// Donut: ingresos vs gastos
function _renderDonutResultado(ingresos, gastos) {
    const c = _dashChartColors();
    _renderDashDonut('dashDonutResultado', 'donutResultado', [
        { label: 'Ingresos', val: Math.max(ingresos, 0), color: c.ok },
        { label: 'Gastos',   val: Math.max(gastos,   0), color: c.coralDeep },
    ]);
}

function _renderDashDonut(canvasId, key, datos) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const c = _dashChartColors();
    const activos_ = datos.filter(d => d.val > 0);
    const data = activos_.length ? activos_ : [{ label: 'Sin datos', val: 1, color: c.rule }];

    if (_dashCharts[key]) _dashCharts[key].destroy();
    _dashCharts[key] = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: data.map(d => d.label),
            datasets: [{ data: data.map(d => d.val), backgroundColor: data.map(d => d.color), borderColor: c.rule, borderWidth: 2 }],
        },
        options: {
            responsive: true, maintainAspectRatio: false, cutout: '62%', animation: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: c.inkSoft, font: { family: c.fontSans, size: 10.5 }, boxWidth: 9, boxHeight: 9, usePointStyle: true, pointStyle: 'circle', padding: 10,
                        generateLabels: (chart) => chart.data.labels.map((label, i) => ({
                            text: `${label} — $${fmt(chart.data.datasets[0].data[i])}`,
                            fillStyle: chart.data.datasets[0].backgroundColor[i],
                            strokeStyle: chart.data.datasets[0].backgroundColor[i],
                            pointStyle: 'circle',
                            index: i,
                        })),
                    },
                },
                tooltip: { enabled: activos_.length > 0 },
            },
        },
    });
}

// Resumen de una línea (formato .actividad-mini, igual al prototipo) — antes
// era una lista completa de los últimos 5 asientos; se cuentan los del mes
// actual en vez de "hoy" porque en uso real casi siempre da 0 registrados hoy.
function _renderUltimosAsientos() {
    const el = document.getElementById('dashUltimosAsientos');
    if (!el) return;
    const activos = (dbAsientos || []).filter(a => a.estado !== 'ANULADO');
    if (!activos.length) {
        el.innerHTML = `<b>Últimos asientos</b>Sin asientos registrados`;
        return;
    }
    const mesActual = new Date().toISOString().slice(0, 7); // YYYY-MM
    const esteMes = activos.filter(a => (_fechaAsientoOrdenable(a.fecha) || '').startsWith(mesActual));
    el.innerHTML = `<b>Últimos asientos</b>${esteMes.length} este mes`;
}

// Resumen de una línea de la cuenta con mayor saldo (formato .actividad-mini,
// igual al prototipo) — antes era una lista completa de las top 6 cuentas.
function _renderTopCuentas(cuentas) {
    const el = document.getElementById('dashTopCuentas');
    if (!el) return;

    const top = Object.entries(cuentas)
        .map(([nombre, mov]) => {
            const tipo  = ESQUEMA_CUENTAS[nombre]?.tipo || 'Activo';
            const saldo = tipo === 'Activo' ? mov.debe - mov.haber : mov.haber - mov.debe;
            return { nombre, saldo: Math.abs(saldo) };
        })
        .filter(x => x.saldo > 0)
        .sort((a, b) => b.saldo - a.saldo)[0];

    el.innerHTML = `<b>Top cuenta</b>${top ? `${top.nombre} — $${fmt(top.saldo)}` : 'Sin movimientos'}`;
}
