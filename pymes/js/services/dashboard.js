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
        if (color) el.style.color = val >= 0 ? '#16a34a' : '#dc2626';
    };

    setKPI('kpi-activos',    activos);
    setKPI('kpi-pasivos',    pasivos);
    setKPI('kpi-ingresos',   ingresos);
    setKPI('kpi-resultado',  resultado, true);

    // Calcular liquidez
    const _liq = _calcularLiquidezDash(cuentas);

    // Renderizar gráficos del dashboard
    _renderDashboardCharts(cuentas, ingresos, gastos, activos, pasivos, patrimonio, resultado);
    _renderUltimosAsientos();
    _renderTopCuentas(cuentas);
    _renderLiquidezDash(_liq);
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
        if (v === null) return '#94a3b8';
        return v >= ok ? '#16a34a' : v >= warn ? '#d97706' : '#dc2626';
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
            <div class="dash-liq-val" style="color:${liq.capitalTrabajo >= 0 ? '#16a34a' : '#dc2626'}">
                $${fmt(Math.abs(liq.capitalTrabajo))}
            </div>
            <div class="dash-liq-meta">${liq.capitalTrabajo >= 0 ? 'Positivo' : 'Negativo'}</div>
        </div>`;
}

// ── Gráficos del dashboard ────────────────────────────────────
function _renderDashboardCharts(cuentas, ingresos, gastos, activos, pasivos, patrimonio, resultado) {
    _renderBarrasMensuales();
    _renderDonutActivos(activos, pasivos, patrimonio);
    _renderDonutResultado(ingresos, gastos);
}

// Barras mensuales: ingresos vs gastos (año actual)
function _renderBarrasMensuales() {
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

    const max = Math.max(...meses.flatMap(m => [m.ing, m.gst]), 1);
    const labels = ['E','F','M','A','M','J','J','A','S','O','N','D'];
    const W = 540, H = 160, padL = 50, padB = 22, barW = 14, gap = 5;
    const gW = barW * 2 + gap + 10;

    let bars = '', xLab = '', yLines = '';
    for (let i = 0; i <= 4; i++) {
        const y = Math.round((H - padB) * (1 - i / 4));
        const v = Math.round(max * i / 4);
        yLines += `<line x1="${padL-4}" y1="${y}" x2="${padL + 12 * gW}" y2="${y}" stroke="#f1f5f9" stroke-width="1"/>`;
        yLines += `<text x="${padL-6}" y="${y+3}" text-anchor="end" font-size="8" fill="#94a3b8">${v>=1e6?(v/1e6).toFixed(1)+'M':v>=1e3?(v/1e3).toFixed(0)+'K':v}</text>`;
    }
    meses.forEach((m, i) => {
        const x = padL + i * gW;
        const hI = Math.round((Math.max(m.ing,0) / max) * (H - padB));
        const hG = Math.round((Math.max(m.gst,0) / max) * (H - padB));
        bars += `<rect x="${x}" y="${H-padB-hI}" width="${barW}" height="${hI}" fill="#3b82f6" rx="2"/>`;
        bars += `<rect x="${x+barW+gap}" y="${H-padB-hG}" width="${barW}" height="${hG}" fill="#f87171" rx="2"/>`;
        xLab += `<text x="${x+barW}" y="${H}" text-anchor="middle" font-size="8" fill="#64748b">${labels[i]}</text>`;
    });

    const svg = `<svg viewBox="0 0 ${W} ${H+8}" xmlns="http://www.w3.org/2000/svg" style="width:100%;">
        ${yLines}${bars}${xLab}
        <rect x="${W-90}" y="6" width="10" height="8" fill="#3b82f6" rx="1"/>
        <text x="${W-77}" y="13" font-size="9" fill="#64748b">Ingresos</text>
        <rect x="${W-90}" y="20" width="10" height="8" fill="#f87171" rx="1"/>
        <text x="${W-77}" y="27" font-size="9" fill="#64748b">Gastos</text>
    </svg>`;

    const el = document.getElementById('dashBarrasMensuales');
    if (el) el.innerHTML = svg;
}

// Donut: distribución Activo vs Pasivo vs Patrimonio
function _renderDonutActivos(activos, pasivos, patrimonio) {
    const el = document.getElementById('dashDonutActivos');
    if (!el) return;
    const total = Math.max(activos + pasivos + patrimonio, 1);
    const datos = [
        { label: 'Activo',     val: Math.max(activos,    0), color: '#3b82f6' },
        { label: 'Pasivo',     val: Math.max(pasivos,    0), color: '#f87171' },
        { label: 'Patrimonio', val: Math.max(patrimonio, 0), color: '#34d399' },
    ].filter(d => d.val > 0);
    el.innerHTML = _svgDonut(datos, total, 'Estructura');
}

// Donut: ingresos vs gastos
function _renderDonutResultado(ingresos, gastos) {
    const el = document.getElementById('dashDonutResultado');
    if (!el) return;
    const total = Math.max(ingresos + gastos, 1);
    const datos = [
        { label: 'Ingresos', val: Math.max(ingresos, 0), color: '#3b82f6' },
        { label: 'Gastos',   val: Math.max(gastos,   0), color: '#f87171' },
    ].filter(d => d.val > 0);
    el.innerHTML = _svgDonut(datos, total, 'Resultado');
}

function _svgDonut(datos, total, titulo) {
    const cx = 70, cy = 65, r = 52, ri = 30;
    let startAngle = -Math.PI / 2;
    let paths = '';
    let legend = '';

    datos.forEach((d, i) => {
        const sweep = (d.val / total) * 2 * Math.PI;
        const endAngle = startAngle + sweep;
        const x1 = cx + r * Math.cos(startAngle);
        const y1 = cy + r * Math.sin(startAngle);
        const x2 = cx + r * Math.cos(endAngle);
        const y2 = cy + r * Math.sin(endAngle);
        const xi1 = cx + ri * Math.cos(startAngle);
        const yi1 = cy + ri * Math.sin(startAngle);
        const xi2 = cx + ri * Math.cos(endAngle);
        const yi2 = cy + ri * Math.sin(endAngle);
        const large = sweep > Math.PI ? 1 : 0;
        paths += `<path d="M${xi1},${yi1} L${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} L${xi2},${yi2} A${ri},${ri} 0 ${large},0 ${xi1},${yi1}" fill="${d.color}" opacity="0.9"/>`;
        legend += `<rect x="145" y="${8 + i * 18}" width="10" height="10" fill="${d.color}" rx="2"/>
            <text x="159" y="${17 + i * 18}" font-size="9.5" fill="#475569">${d.label}</text>
            <text x="220" y="${17 + i * 18}" font-size="9" fill="#64748b" text-anchor="end">$${fmt(d.val)}</text>`;
        startAngle = endAngle;
    });

    return `<svg viewBox="0 0 230 130" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:230px;">
        ${paths}
        <text x="${cx}" y="${cy+4}" text-anchor="middle" font-size="10" font-weight="700" fill="#1e293b">${titulo}</text>
        ${legend}
    </svg>`;
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
            ? `<span style="background:#fee2e2;color:#991b1b;padding:1px 7px;border-radius:10px;font-size:11px;">Anulado</span>`
            : `<span style="background:#dbeafe;color:#1d4ed8;padding:1px 7px;border-radius:10px;font-size:11px;">Activo</span>`;
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
    const colores  = { Activo: '#3b82f6', Pasivo: '#f87171', Patrimonio: '#34d399', Ganancia: '#a78bfa', Pérdida: '#fb923c' };

    el.innerHTML = lista.map(x => {
        const pct = Math.round((x.saldo / maxSaldo) * 100);
        const clr = colores[x.tipo] || '#94a3b8';
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
