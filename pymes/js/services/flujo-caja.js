// ─────────────────────────────────────────────────────────────
//  FLUJO DE CAJA — clasificado en 3 actividades
// ─────────────────────────────────────────────────────────────
const CUENTAS_EFECTIVO = ['Caja', 'Banco', 'Caja Chica'];

// Cuentas contraparte que determinan la categoría del movimiento
const CUENTAS_INVERSION = new Set([
    'Terrenos', 'Edificios', 'Muebles y Útiles', 'Equipos Computacionales',
    'Vehículos', 'Maquinarias', 'Instalaciones', 'Software',
    'Marcas y Patentes', 'Depreciación Acumulada',
]);
const CUENTAS_FINANCIAMIENTO = new Set([
    'Capital', 'Capital Social', 'Utilidades Retenidas', 'Resultado del Ejercicio',
    'Préstamos Bancarios LP', 'Hipotecas por Pagar', 'Obligaciones Financieras LP',
    'Documentos por Cobrar', 'Documentos por Pagar',
    'Letras por Cobrar', 'Letras por Pagar',
]);

function _clasificarAsiento(asiento) {
    // Determina categoría según las cuentas NO-efectivo del asiento
    const contrapartes = asiento.movimientos
        .map(m => m.cuenta)
        .filter(c => !CUENTAS_EFECTIVO.includes(c));

    for (const c of contrapartes) {
        if (CUENTAS_INVERSION.has(c))     return 'inversion';
        if (CUENTAS_FINANCIAMIENTO.has(c)) return 'financiamiento';
    }
    return 'operacional';
}

function generarFlujoCaja() {
    const anio = parseInt(document.getElementById('selFlujoCajaAnio')?.value) || new Date().getFullYear();

    const secciones = {
        operacional:    { label: 'Actividades Operacionales',  icon: '⚙️',  lineas: [], total: 0 },
        inversion:      { label: 'Actividades de Inversión',   icon: '🏗️', lineas: [], total: 0 },
        financiamiento: { label: 'Actividades de Financiamiento', icon: '🏦', lineas: [], total: 0 },
    };

    let totEntradas = 0, totSalidas = 0;
    const mesesGrafico = Array.from({length: 12}, () => ({ entrada: 0, salida: 0 }));

    (window.dbAsientos || []).forEach(a => {
        if (a.estado === 'ANULADO') return;
        const partes = a.fecha ? a.fecha.split('/') : [];
        if (partes.length < 3) return;
        const [d, m, y] = partes;
        if (parseInt(y) !== anio) return;

        const cat  = _clasificarAsiento(a);
        const sec  = secciones[cat];
        const idx  = parseInt(m) - 1;

        a.movimientos.forEach(mov => {
            if (!CUENTAS_EFECTIVO.includes(mov.cuenta)) return;
            const entrada = mov.debe  || 0;
            const salida  = mov.haber || 0;
            const neto    = entrada - salida;
            sec.total += neto;
            totEntradas += entrada;
            totSalidas  += salida;
            mesesGrafico[idx].entrada += entrada;
            mesesGrafico[idx].salida  += salida;
            sec.lineas.push({
                fechaSort: `${y}${m}${d}`,
                fecha: a.fecha,
                cuenta: mov.cuenta,
                glosa: a.glosa,
                contacto: a.contacto || '',
                entrada,
                salida,
                neto,
            });
        });
    });

    // Ordenar líneas por fecha dentro de cada sección
    Object.values(secciones).forEach(s =>
        s.lineas.sort((a, b) => a.fechaSort.localeCompare(b.fechaSort))
    );

    // ── Render tabla por secciones ────────────────────────────
    let html = '';
    Object.values(secciones).forEach(sec => {
        const colorTotal = sec.total >= 0 ? 'var(--positive)' : 'var(--negative)';
        const signoTotal = sec.total >= 0 ? '+' : '-';

        // Encabezado de sección (solo título, sin monto)
        html += `
        <tr class="fc-seccion-header">
            <td colspan="5" style="
                background:var(--sidebar);color:var(--text);
                font-weight:700;font-size:13px;padding:10px 14px;
                border-top:2px solid var(--divider);
            ">${sec.icon} ${sec.label}</td>
        </tr>`;

        if (!sec.lineas.length) {
            html += `<tr><td colspan="5" style="text-align:center;padding:12px;color:var(--text-muted);font-size:12px;">Sin movimientos</td></tr>`;
        } else {
            sec.lineas.forEach(l => {
                const cls = l.neto > 0 ? 'color:var(--positive);' : (l.neto < 0 ? 'color:var(--negative);' : '');
                const signoNeto = l.neto >= 0 ? '+' : '-';
                html += `<tr>
                    <td>${l.fecha}</td>
                    <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                        ${l.glosa}
                        ${l.contacto ? `<span style="font-size:11px;color:var(--accent);margin-left:6px;">👤 ${l.contacto}</span>` : ''}
                    </td>
                    <td class="monto" style="color:var(--positive);">${l.entrada > 0 ? '$' + fmt(l.entrada) : ''}</td>
                    <td class="monto" style="color:var(--negative);">${l.salida  > 0 ? '$' + fmt(l.salida)  : ''}</td>
                    <td class="monto" style="${cls}font-weight:600;">${signoNeto}$${fmt(Math.abs(l.neto))}</td>
                </tr>`;
            });
        }

        // Fila de total al PIE de la sección
        html += `
        <tr>
            <td colspan="4" style="font-weight:700;padding:9px 14px;background:var(--table-stripe);font-size:13px;">
                Subtotal ${sec.label}
            </td>
            <td class="monto" style="font-weight:700;font-size:14px;color:${colorTotal};background:var(--table-stripe);">
                ${signoTotal}$${fmt(Math.abs(sec.total))}
            </td>
        </tr>`;
    });

    const tbody = document.getElementById('tbodyFlujoCaja');
    if (tbody) {
        tbody.innerHTML = html || `<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-muted);">Sin movimientos de efectivo para ${anio}</td></tr>`;
    }

    // KPIs
    _setFlujoCajaKPI('fcEntradas',      totEntradas);
    _setFlujoCajaKPI('fcSalidas',       totSalidas);
    _setFlujoCajaKPI('fcNeto',          totEntradas - totSalidas);
    _setFlujoCajaKPI('fcOperacional',   secciones.operacional.total);
    _setFlujoCajaKPI('fcInversion',     secciones.inversion.total);
    _setFlujoCajaKPI('fcFinanciamiento',secciones.financiamiento.total);

    // Gráfico mensual
    _renderGraficoFlujoCaja(mesesGrafico);
}

function _setFlujoCajaKPI(id, val) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = (val >= 0 ? '+' : '-') + '$' + fmt(Math.abs(val));
    el.style.color = val >= 0 ? 'var(--positive)' : 'var(--negative)';
}

function _renderGraficoFlujoCaja(meses) {
    const max = Math.max(...meses.flatMap(m => [m.entrada, m.salida]), 1);
    const W = 700, H = 200, padL = 60, padB = 30, barW = 20, barGap = 8;
    const grupW = barW * 2 + barGap + 12;
    const labels = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

    let bars = '', xLabels = '';
    meses.forEach((m, i) => {
        const x  = padL + i * grupW;
        const hE = Math.round((m.entrada / max) * (H - padB));
        const hS = Math.round((m.salida  / max) * (H - padB));
        bars    += `<rect x="${x}" y="${H-padB-hE}" width="${barW}" height="${hE}" fill="#3b82f6" rx="2" opacity="0.85"/>`;
        bars    += `<rect x="${x+barW+barGap}" y="${H-padB-hS}" width="${barW}" height="${hS}" fill="#f87171" rx="2" opacity="0.85"/>`;
        xLabels += `<text x="${x+barW}" y="${H}" text-anchor="middle" font-size="9" fill="#64748b">${labels[i]}</text>`;
    });

    let yLines = '';
    for (let i = 0; i <= 4; i++) {
        const y   = Math.round((H - padB) * (1 - i / 4));
        const val = Math.round(max * i / 4);
        yLines += `<line x1="${padL-4}" y1="${y}" x2="${padL+12*grupW}" y2="${y}" stroke="#e2e8f0" stroke-width="1"/>`;
        yLines += `<text x="${padL-6}" y="${y+4}" text-anchor="end" font-size="9" fill="#94a3b8">$${val >= 1e6 ? (val/1e6).toFixed(1)+'M' : val >= 1e3 ? (val/1e3).toFixed(0)+'K' : val}</text>`;
    }

    const svg = `<svg viewBox="0 0 ${W} ${H+10}" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:${W}px;">
        ${yLines}${bars}${xLabels}
        <rect x="${W-110}" y="8"  width="12" height="10" fill="#3b82f6" rx="2"/>
        <text x="${W-95}"  y="17" font-size="10" fill="#64748b">Entradas</text>
        <rect x="${W-110}" y="24" width="12" height="10" fill="#f87171" rx="2"/>
        <text x="${W-95}"  y="33" font-size="10" fill="#64748b">Salidas</text>
    </svg>`;

    const cont = document.getElementById('graficoFlujoCaja');
    if (cont) cont.innerHTML = svg;
}
