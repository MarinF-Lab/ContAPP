// ─────────────────────────────────────────────────────────────
//  FLUJO DE CAJA — clasificado en 3 actividades
// ─────────────────────────────────────────────────────────────
const CUENTAS_EFECTIVO = ['Caja', 'Banco', 'Caja Chica'];
const FC_OVERRIDES_KEY = 'core_fc_overrides';

function _cargarFcOverrides() {
    try { return JSON.parse(localStorage.getItem(FC_OVERRIDES_KEY) || '[]'); }
    catch { return []; }
}

function _guardarFcOverrides(overrides) {
    localStorage.setItem(FC_OVERRIDES_KEY, JSON.stringify(overrides));
}

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
    const contrapartes = asiento.movimientos
        .map(m => m.cuenta)
        .filter(c => !CUENTAS_EFECTIVO.includes(c));

    const overrides = _cargarFcOverrides();
    for (const c of contrapartes) {
        const ov = overrides.find(o => o.cuenta === c);
        if (ov) return ov.categoria;
        if (CUENTAS_INVERSION.has(c))      return 'inversion';
        if (CUENTAS_FINANCIAMIENTO.has(c)) return 'financiamiento';
    }
    return 'operacional';
}

// Cómputo puro (sin HTML) del Flujo de Caja — extraído de generarFlujoCaja()
// para reusarlo también en exportarPDFFlujoCaja() (js/services/exportar.js).
function _calcularFlujoCaja(mes, anio) {
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
        const enMes = !mes || (idx + 1) === mes;

        a.movimientos.forEach(mov => {
            if (!CUENTAS_EFECTIVO.includes(mov.cuenta)) return;
            const entrada = mov.debe  || 0;
            const salida  = mov.haber || 0;
            const neto    = entrada - salida;
            // El gráfico siempre muestra los 12 meses del año elegido, sin
            // importar el filtro de mes — da la vista panorámica del año
            // mientras la tabla de abajo muestra el detalle del mes elegido.
            mesesGrafico[idx].entrada += entrada;
            mesesGrafico[idx].salida  += salida;
            if (!enMes) return;
            sec.total += neto;
            totEntradas += entrada;
            totSalidas  += salida;
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

    return { secciones, totEntradas, totSalidas, mesesGrafico };
}
window._calcularFlujoCaja = _calcularFlujoCaja;

function generarFlujoCaja() {
    const anio = parseInt(document.getElementById('selFlujoCajaAnio')?.value) || new Date().getFullYear();
    const mes  = parseInt(document.getElementById('selFlujoCajaMes')?.value)  || 0; // 0 = Todos los meses
    const { secciones, totEntradas, totSalidas, mesesGrafico } = _calcularFlujoCaja(mes, anio);

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
        const _fcLabelPeriodo = mes ? `${_nombreMes(mes)} ${anio}` : anio;
        tbody.innerHTML = html || `<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-muted);">Sin movimientos de efectivo para ${_fcLabelPeriodo}</td></tr>`;
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

// ─────────────────────────────────────────────────────────────
//  OVERRIDES DE CLASIFICACIÓN
// ─────────────────────────────────────────────────────────────

function fcAbrirOverrides() {
    let modal = document.getElementById('fcOverridesModal');
    if (modal) { modal.style.display = 'flex'; _fcRenderOverridesTabla(); return; }

    modal = document.createElement('div');
    modal.id        = 'fcOverridesModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
    <div class="modal-box" style="width:600px;max-height:80vh;display:flex;flex-direction:column;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <h3 style="margin:0;">⚙️ Clasificación de cuentas — Flujo de Caja</h3>
            <button class="btn btn-secondary" onclick="fcCerrarOverrides()">✕</button>
        </div>
        <p style="font-size:12px;color:var(--text-muted);margin:0 0 12px;">
            Sobreescribe la categoría automática de cualquier cuenta en el flujo de caja.
        </p>
        <div style="display:flex;gap:8px;margin-bottom:12px;">
            <input id="fcOvCuenta" class="input" placeholder="Nombre exacto de la cuenta" style="flex:1;">
            <select id="fcOvCategoria" class="input" style="width:180px;">
                <option value="operacional">⚙️ Operacional</option>
                <option value="inversion">🏗️ Inversión</option>
                <option value="financiamiento">🏦 Financiamiento</option>
            </select>
            <button class="btn btn-primary" onclick="fcAgregarOverride()">+ Agregar</button>
        </div>
        <div style="overflow-y:auto;flex:1;" id="fcOvTablaWrap"></div>
        <div style="text-align:right;margin-top:16px;">
            <button class="btn btn-primary" onclick="fcCerrarOverrides();generarFlujoCaja();">Aplicar y cerrar</button>
        </div>
    </div>`;
    document.body.appendChild(modal);
    _fcRenderOverridesTabla();
}

function fcCerrarOverrides() {
    const m = document.getElementById('fcOverridesModal');
    if (m) m.style.display = 'none';
}

function _fcRenderOverridesTabla() {
    const wrap = document.getElementById('fcOvTablaWrap');
    if (!wrap) return;
    const overrides = _cargarFcOverrides();
    if (!overrides.length) {
        wrap.innerHTML = '<p style="text-align:center;padding:20px;color:var(--text-muted);">Sin overrides configurados — la clasificación automática aplica a todas las cuentas.</p>';
        return;
    }
    const icons = { operacional: '⚙️', inversion: '🏗️', financiamiento: '🏦' };
    wrap.innerHTML = `<table class="cont-table" style="font-size:13px;table-layout:fixed;width:100%;">
        <thead><tr>
            <th>Cuenta</th>
            <th style="width:160px;">Categoría</th>
            <th style="width:60px;"></th>
        </tr></thead>
        <tbody>
            ${overrides.map((o, i) => `<tr>
                <td style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${o.cuenta}</td>
                <td>${icons[o.categoria] || ''} ${o.categoria}</td>
                <td><button class="btn btn-secondary" style="padding:2px 8px;font-size:11px;" onclick="fcEliminarOverride(${i})">🗑</button></td>
            </tr>`).join('')}
        </tbody>
    </table>`;
}

function fcAgregarOverride() {
    const cuenta = document.getElementById('fcOvCuenta')?.value?.trim();
    const categoria = document.getElementById('fcOvCategoria')?.value;
    if (!cuenta) return mostrarToast('Ingrese el nombre de la cuenta', 'error');
    const overrides = _cargarFcOverrides();
    const idx = overrides.findIndex(o => o.cuenta === cuenta);
    if (idx >= 0) overrides[idx].categoria = categoria;
    else overrides.push({ cuenta, categoria });
    _guardarFcOverrides(overrides);
    document.getElementById('fcOvCuenta').value = '';
    _fcRenderOverridesTabla();
    mostrarToast(`Override guardado para "${cuenta}"`, 'ok');
}

function fcEliminarOverride(idx) {
    const overrides = _cargarFcOverrides();
    overrides.splice(idx, 1);
    _guardarFcOverrides(overrides);
    _fcRenderOverridesTabla();
    mostrarToast('Override eliminado', 'ok');
}

window.fcAbrirOverrides    = fcAbrirOverrides;
window.fcCerrarOverrides   = fcCerrarOverrides;
window.fcAgregarOverride   = fcAgregarOverride;
window.fcEliminarOverride  = fcEliminarOverride;
