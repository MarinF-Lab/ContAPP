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

    // Calcular liquidez
    const _liq = _calcularLiquidezDash(cuentas);

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
    _renderLiquidezDash(_liq);
    _renderDashHallazgos();
    _renderAccesosRapidos();
}

// ── Hallazgos de auditoría abiertos (dato real: aud_hallazgos) ─────────────
function _renderDashHallazgos() {
    const el    = document.getElementById('dashHallazgos');
    const badge = document.getElementById('dashHallazgosBadge');
    if (!el) return;

    let hallazgos = [];
    try { hallazgos = JSON.parse(localStorage.getItem('aud_hallazgos')) || []; } catch {}
    const abiertos = hallazgos
        .filter(h => h.estado === 'abierto')
        .sort((a, b) => new Date(b.fechaDeteccion) - new Date(a.fechaDeteccion));

    if (badge) {
        if (abiertos.length) {
            badge.style.display = 'inline-block';
            badge.textContent = abiertos.length;
            badge.className = 'badge-doc badge-doc-compra'; // reutiliza el pill ámbar de alerta ya existente
        } else {
            badge.style.display = 'none';
        }
    }

    if (!abiertos.length) {
        el.innerHTML = `<div style="padding:10px 0;color:var(--positive);font-size:13px;display:flex;align-items:center;gap:8px;">✅ Sin hallazgos abiertos.</div>`;
        return;
    }

    const iconoTipo = { error: '🔴', advertencia: '🟡', sugerencia: '🔵' };
    el.innerHTML = abiertos.slice(0, 4).map(h => `
        <div class="dash-asiento-row">
            <div class="dash-asiento-info">
                <span>${iconoTipo[h.tipo] || '•'}</span>
                <span class="dash-asiento-fecha">${h.modulo || ''}</span>
            </div>
            <div class="dash-asiento-glosa">${h.descripcion || ''}</div>
        </div>`).join('')
        + `<button class="btn btn-secondary" style="margin-top:10px;font-size:12px;padding:6px 12px;" onclick="navegar('hallazgos')">Ver todos los hallazgos →</button>`;
}

// ── Accesos rápidos — MRU real de navegación (contapp-modulos-recientes) ───
function _renderAccesosRapidos() {
    const el = document.getElementById('dashAccesosRapidos');
    if (!el) return;

    let ids = [];
    try { ids = JSON.parse(localStorage.getItem('contapp-modulos-recientes')) || []; } catch {}
    const titulos = window.MODULO_TITULOS || {};
    const items = ids.map(id => titulos[id] ? { id, label: titulos[id][0] } : null).filter(Boolean).slice(0, 6);

    if (!items.length) {
        el.innerHTML = `<div style="padding:10px 0;color:var(--text-muted);font-size:13px;">Todavía no visitaste otros módulos en esta sesión.</div>`;
        return;
    }

    el.innerHTML = `<div style="display:flex;flex-direction:column;gap:6px;">` +
        items.map(it => `
            <button class="dash-quick-chip" onclick="navegar('${it.id}')">
                <span>${it.label}</span>
                <span class="dash-quick-chip-arrow">→</span>
            </button>`).join('')
        + `</div>`;
}

// ── Liquidez ──────────────────────────────────────────────────
function _calcularLiquidezDash(cuentas) {
    let actCirc = 0, pasCirc = 0, inv = 0;
    const INV = ['Mercaderías','Inventario de Productos Terminados'];
    Object.entries(cuentas).forEach(([nombre, mov]) => {
        const info = ESQUEMA_CUENTAS[nombre] || (PLAN_CUENTAS && PLAN_CUENTAS[nombre]);
        if (!info) return;
        if (info.grupo === 'Activo Circulante') {
            const s = mov.debe - mov.haber;
            actCirc += s;
            if (INV.includes(nombre)) inv += s;
        }
        if (info.grupo === 'Pasivo Circulante') pasCirc += (mov.haber - mov.debe);
    });
    return {
        razonCorriente: pasCirc > 0 ? actCirc / pasCirc : null,
        pruebaAcida:    pasCirc > 0 ? (actCirc - inv) / pasCirc : null,
        capitalTrabajo: actCirc - pasCirc,
    };
}

function _renderLiquidezDash(liq) {
    const el = document.getElementById('dashLiquidez');
    if (!el) return;
    function sem(v, ok, warn) {
        if (v === null) return 'var(--ink-faint)';
        return v >= ok ? 'var(--ok)' : v >= warn ? 'var(--warn)' : 'var(--danger)';
    }
    el.innerHTML = `
        <div class="dash-liq-card">
            <div class="dash-liq-label">Razón Corriente</div>
            <div class="dash-liq-val" style="color:${sem(liq.razonCorriente,2,1)}">
                ${liq.razonCorriente !== null ? liq.razonCorriente.toFixed(2) : '—'}
            </div>
            <div class="dash-liq-meta">Ideal ≥ 2</div>
        </div>
        <div class="dash-liq-card">
            <div class="dash-liq-label">Prueba Ácida</div>
            <div class="dash-liq-val" style="color:${sem(liq.pruebaAcida,1,0.7)}">
                ${liq.pruebaAcida !== null ? liq.pruebaAcida.toFixed(2) : '—'}
            </div>
            <div class="dash-liq-meta">Ideal ≥ 1</div>
        </div>
        <div class="dash-liq-card">
            <div class="dash-liq-label">Capital de Trabajo</div>
            <div class="dash-liq-val" style="color:${liq.capitalTrabajo >= 0 ? 'var(--positive)' : 'var(--negative)'}">
                $${fmt(Math.abs(liq.capitalTrabajo))}
            </div>
            <div class="dash-liq-meta">${liq.capitalTrabajo >= 0 ? 'Positivo' : 'Negativo'}</div>
        </div>`;
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

// Últimos 5 asientos
function _renderUltimosAsientos() {
    const el = document.getElementById('dashUltimosAsientos');
    if (!el) return;
    const ultimos = [...(dbAsientos || [])].sort((a, b) => b.id - a.id).slice(0, 5);
    if (!ultimos.length) {
        el.innerHTML = `<div style="color:var(--text-muted);padding:12px;">Sin asientos registrados.</div>`;
        return;
    }
    el.innerHTML = ultimos.map(a => {
        const totDebe = (a.movimientos || []).reduce((s, m) => s + (m.debe || 0), 0);
        const tag = a.estado === 'ANULADO'
            ? `<span style="background:var(--negative-soft);color:var(--negative);padding:1px 7px;border-radius:10px;font-size:11px;">Anulado</span>`
            : `<span style="background:var(--info-soft);color:var(--info);padding:1px 7px;border-radius:10px;font-size:11px;">Activo</span>`;
        return `<div class="dash-asiento-row">
            <div class="dash-asiento-info">
                <span class="dash-asiento-num">N° ${a.numero}</span>
                <span class="dash-asiento-fecha">${a.fecha}</span>
                ${tag}
            </div>
            <div class="dash-asiento-glosa">${a.glosa}</div>
            <div class="dash-asiento-monto">$${fmt(totDebe)}</div>
        </div>`;
    }).join('');
}

// Top 5 cuentas por saldo
function _renderTopCuentas(cuentas) {
    const el = document.getElementById('dashTopCuentas');
    if (!el) return;

    const lista = Object.entries(cuentas)
        .map(([nombre, mov]) => {
            const tipo  = ESQUEMA_CUENTAS[nombre]?.tipo || 'Activo';
            const saldo = tipo === 'Activo' ? mov.debe - mov.haber : mov.haber - mov.debe;
            return { nombre, saldo: Math.abs(saldo), tipo };
        })
        .filter(x => x.saldo > 0)
        .sort((a, b) => b.saldo - a.saldo)
        .slice(0, 6);

    if (!lista.length) {
        el.innerHTML = `<div style="color:var(--text-muted);padding:12px;">Sin movimientos.</div>`;
        return;
    }

    const maxSaldo = lista[0].saldo;
    const colores  = { Activo: 'var(--periwinkle)', Pasivo: 'var(--coral)', Patrimonio: 'var(--navy)', Ganancia: 'var(--ok)', Pérdida: 'var(--danger)' };

    el.innerHTML = lista.map(x => {
        const pct = Math.round((x.saldo / maxSaldo) * 100);
        const clr = colores[x.tipo] || 'var(--ink-faint)';
        return `<div class="dash-cuenta-row">
            <div class="dash-cuenta-label">
                <span>${x.nombre}</span>
                <span style="font-size:11px;color:var(--text-muted);">$${fmt(x.saldo)}</span>
            </div>
            <div class="dash-cuenta-bar-wrap">
                <div class="dash-cuenta-bar" style="width:${pct}%;background:${clr};"></div>
            </div>
        </div>`;
    }).join('');
}
