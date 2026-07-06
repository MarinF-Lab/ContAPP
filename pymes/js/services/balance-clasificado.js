// ─────────────────────────────────────────────────────────────
//  BALANCE CLASIFICADO
// ─────────────────────────────────────────────────────────────
function generarBalanceClasificado() {
    const cuentas = recopilarMovimientosPorCuenta();

    const secciones = {
        'Activo Circulante':    { items: [], total: 0 },
        'Activo No Circulante': { items: [], total: 0 },
        'Pasivo Circulante':    { items: [], total: 0 },
        'Pasivo No Circulante': { items: [], total: 0 },
        'Patrimonio':           { items: [], total: 0 },
    };

    // Las cuentas Contra se muestran dentro de la sección de su activo/pasivo/patrimonio
    // correspondiente restando, según la convención chilena PCGA.
    // Contra Activo → Activo No Circulante (resta)
    // Contra Pasivo → Pasivo No Circulante (resta)
    // Contra Patrimonio → Patrimonio (resta)
    const SECCION_CONTRA = {
        'Contra Activo':    'Activo No Circulante',
        'Contra Pasivo':    'Pasivo No Circulante',
        'Contra Patrimonio':'Patrimonio',
    };

    let totalResultadoEjercicio = 0;

    Object.entries(cuentas).forEach(([nombre, mov]) => {
        const info = (PLAN_CUENTAS && PLAN_CUENTAS[nombre]) || ESQUEMA_CUENTAS[nombre];
        if (!info) return;

        const tipo  = info.tipo;
        const grupo = info.grupo;

        // ── Cuentas normales ──────────────────────────────────
        if (tipo === 'Activo') {
            const saldo = mov.debe - mov.haber; // positivo = normal, negativo = anomalía
            if (saldo !== 0 && secciones[grupo]) {
                secciones[grupo].items.push({ nombre, saldo, esAnomalio: saldo < 0 });
                secciones[grupo].total += saldo;
            }
        } else if (tipo === 'Pasivo' || tipo === 'Patrimonio') {
            const saldo = mov.haber - mov.debe; // positivo = normal, negativo = anomalía
            if (saldo !== 0 && secciones[grupo]) {
                secciones[grupo].items.push({ nombre, saldo, esAnomalio: saldo < 0 });
                secciones[grupo].total += saldo;
            }
        } else if (tipo === 'Ganancia') {
            totalResultadoEjercicio += (mov.haber - mov.debe);
        } else if (tipo === 'Pérdida') {
            totalResultadoEjercicio -= (mov.debe - mov.haber);

        // ── Cuentas Contra (complementarias) ─────────────────
        // Su saldo natural es el opuesto al activo/pasivo/patrimonio que regulan,
        // por lo que se presentan con signo negativo dentro de su sección.
        } else if (tipo === 'Contra Activo') {
            // Saldo natural Haber: acumula en haber, se muestra restando en activos
            const saldoAcumulado = mov.haber - mov.debe;
            if (saldoAcumulado !== 0) {
                const seccion = SECCION_CONTRA['Contra Activo'];
                secciones[seccion].items.push({ nombre, saldo: -saldoAcumulado, esContra: true });
                secciones[seccion].total -= saldoAcumulado;
            }
        } else if (tipo === 'Contra Pasivo') {
            const saldoAcumulado = mov.debe - mov.haber;
            if (saldoAcumulado !== 0) {
                const seccion = SECCION_CONTRA['Contra Pasivo'];
                secciones[seccion].items.push({ nombre, saldo: -saldoAcumulado, esContra: true });
                secciones[seccion].total -= saldoAcumulado;
            }
        } else if (tipo === 'Contra Patrimonio') {
            const saldoAcumulado = mov.debe - mov.haber;
            if (saldoAcumulado !== 0) {
                const seccion = SECCION_CONTRA['Contra Patrimonio'];
                secciones[seccion].items.push({ nombre, saldo: -saldoAcumulado, esContra: true });
                secciones[seccion].total -= saldoAcumulado;
            }
        }
    });

    // Agregar resultado del ejercicio al patrimonio
    if (totalResultadoEjercicio !== 0) {
        secciones['Patrimonio'].items.push({ nombre: 'Resultado del Ejercicio', saldo: totalResultadoEjercicio });
        secciones['Patrimonio'].total += totalResultadoEjercicio;
    }

    const totalActivo  = secciones['Activo Circulante'].total + secciones['Activo No Circulante'].total;
    const totalPasivo  = secciones['Pasivo Circulante'].total + secciones['Pasivo No Circulante'].total;
    const totalPatrim  = secciones['Patrimonio'].total;
    const totalPasPat  = totalPasivo + totalPatrim;

    function htmlSeccion(titulo, seccion, claseHeader) {
        if (!seccion.items.length) return '';
        const filas = seccion.items
            .sort((a, b) => (b.esContra ? -1 : Math.abs(b.saldo)) - (a.esContra ? -1 : Math.abs(a.saldo)))
            .map(it => {
                const negativo  = it.saldo < 0;
                const esContra  = !!it.esContra;
                const esAnom    = !!it.esAnomalio;
                // Contra: siempre rojo, muestra saldo que ya viene negativo
                // Anomalía: cuenta normal con saldo contrario a su naturaleza
                let colorCuenta = '', colorMonto = '', prefijoCuenta = '', prefijoMonto = '';
                if (esContra) {
                    colorCuenta  = 'color:#dc2626;font-style:italic;padding-left:14px;';
                    colorMonto   = 'color:#dc2626;';
                    prefijoCuenta = '(-) ';
                    prefijoMonto  = '-';
                } else if (esAnom) {
                    colorCuenta  = 'color:#dc2626;font-weight:600;';
                    colorMonto   = 'color:#dc2626;font-weight:600;';
                    prefijoCuenta = '⚠ ';
                    prefijoMonto  = '(';
                }
                const montoStr = `$${fmt(Math.abs(it.saldo))}${esAnom && !esContra ? ')' : ''}`;
                return `<div class="bc-fila" style="${(esContra || esAnom) ? 'opacity:.9;' : ''}">
                    <span class="bc-cuenta" style="${colorCuenta}">${prefijoCuenta}${it.nombre}</span>
                    <span class="bc-monto"  style="${colorMonto}">${prefijoMonto}${montoStr}</span>
                </div>`;
            }).join('');
        return `<div class="bc-seccion">
            <div class="bc-seccion-header ${claseHeader}">${titulo}</div>
            ${filas}
            <div class="bc-fila bc-subtotal">
                <span>Total ${titulo}</span>
                <span>$${fmt(seccion.total)}</span>
            </div>
        </div>`;
    }

    const colActivo = `
        ${htmlSeccion('Activo Circulante',    secciones['Activo Circulante'],    'bc-hdr-act-circ')}
        ${htmlSeccion('Activo No Circulante', secciones['Activo No Circulante'], 'bc-hdr-act-nocirc')}
        <div class="bc-total-col">
            <span>TOTAL ACTIVO</span>
            <span>$${fmt(totalActivo)}</span>
        </div>`;

    const colPasivo = `
        ${htmlSeccion('Pasivo Circulante',    secciones['Pasivo Circulante'],    'bc-hdr-pas-circ')}
        ${htmlSeccion('Pasivo No Circulante', secciones['Pasivo No Circulante'], 'bc-hdr-pas-nocirc')}
        ${htmlSeccion('Patrimonio',           secciones['Patrimonio'],           'bc-hdr-patrimonio')}
        <div class="bc-total-col">
            <span>TOTAL PASIVO + PATRIMONIO</span>
            <span>$${fmt(totalPasPat)}</span>
        </div>`;

    const cuadra = Math.abs(totalActivo - totalPasPat) < 1;

    // ── Indicadores de liquidez ─────────────────────────────────
    const actCirc  = secciones['Activo Circulante'].total;
    const pasCirc  = secciones['Pasivo Circulante'].total;

    // Activos menos líquidos para prueba ácida
    const inventarios = (secciones['Activo Circulante'].items
        .filter(i => ['Mercaderías','Inventario de Productos Terminados'].includes(i.nombre))
        .reduce((s, i) => s + i.saldo, 0));

    const razonCorriente = pasCirc > 0 ? actCirc / pasCirc : null;
    const pruebaAcida    = pasCirc > 0 ? (actCirc - inventarios) / pasCirc : null;
    const capitalTrabajo = actCirc - pasCirc;

    function semaforo(val, ok, warn) {
        if (val === null) return 'color:#94a3b8;';
        if (val >= ok)   return 'color:#16a34a;';
        if (val >= warn) return 'color:#d97706;';
        return 'color:#dc2626;';
    }

    const htmlLiquidez = `
        <div class="bc-liquidez">
            <div class="bc-liq-titulo">📐 Indicadores de Liquidez</div>
            <div class="bc-liq-grid">
                <div class="bc-liq-card">
                    <div class="bc-liq-label">Razón Corriente</div>
                    <div class="bc-liq-val" style="${semaforo(razonCorriente, 2, 1)}">
                        ${razonCorriente !== null ? razonCorriente.toFixed(2) : '—'}
                    </div>
                    <div class="bc-liq-meta">Act. Circ. / Pas. Circ. · Ideal ≥ 2</div>
                </div>
                <div class="bc-liq-card">
                    <div class="bc-liq-label">Prueba Ácida</div>
                    <div class="bc-liq-val" style="${semaforo(pruebaAcida, 1, 0.7)}">
                        ${pruebaAcida !== null ? pruebaAcida.toFixed(2) : '—'}
                    </div>
                    <div class="bc-liq-meta">(Act. Circ. − Inventarios) / Pas. Circ. · Ideal ≥ 1</div>
                </div>
                <div class="bc-liq-card">
                    <div class="bc-liq-label">Capital de Trabajo</div>
                    <div class="bc-liq-val" style="${capitalTrabajo >= 0 ? 'color:#16a34a;' : 'color:#dc2626;'}">
                        $${fmt(capitalTrabajo)}
                    </div>
                    <div class="bc-liq-meta">Act. Circ. − Pas. Circ. · Positivo = solvente</div>
                </div>
            </div>
        </div>`;

    // Exportar para el dashboard
    window._liquidezData = { razonCorriente, pruebaAcida, capitalTrabajo };

    const cont = document.getElementById('balanceClasificadoCont');
    if (!cont) return;

    cont.innerHTML = `
        <div class="bc-cuadratura ${cuadra ? 'bc-ok' : 'bc-error'}">
            ${cuadra ? '⚖️ Cuadrado' : '❌ Descuadrado'} — Activo: $${fmt(totalActivo)}  |  Pasivo+Patrimonio: $${fmt(totalPasPat)}
        </div>
        ${htmlLiquidez}
        <div class="bc-grid">
            <div class="bc-col">${colActivo}</div>
            <div class="bc-col">${colPasivo}</div>
        </div>`;
}
