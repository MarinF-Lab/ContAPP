// ─────────────────────────────────────────────────────────────
//  RESUMEN IVA — Vista unificada F29
//  Cruza IVA Débito (ventas) con IVA Crédito (compras),
//  reajusta remanente con variación UTM y calcula neto a pagar.
// ─────────────────────────────────────────────────────────────

const IVA_REMANENTE_KEY = 'core_iva_remanente';

// ─────────────────────────────────────────────────────────────
//  CÁLCULO PRINCIPAL
// ─────────────────────────────────────────────────────────────
function generarIvaResumen() {
    const mes  = parseInt(document.getElementById('selIvaMes')?.value)  || (new Date().getMonth() + 1);
    const anio = parseInt(document.getElementById('selIvaAnio')?.value) || new Date().getFullYear();

    // ── 1. IVA Débito desde Libro de Ventas ───────────────────
    const _enPeriodo = (doc) => {
        if (doc.estado === 'anulada') return false;
        // Preferir campos directos; si no existen, parsear fecha "DD/MM/YYYY"
        if (doc.mes != null && doc.anio != null)
            return parseInt(doc.mes) === mes && parseInt(doc.anio) === anio;
        const p = (doc.fecha || '').split('/');
        return p.length === 3 && parseInt(p[1]) === mes && parseInt(p[2]) === anio;
    };

    const ventas  = (window.dbVentas  || []).filter(_enPeriodo);
    const ivaDebito = ventas.reduce((s, v) => s + (parseFloat(v.iva) || 0), 0);

    // ── 2. IVA Crédito desde Libro de Compras ─────────────────
    const compras = (window.dbCompras || []).filter(_enPeriodo);
    const ivaCredito = compras.reduce((s, c) => s + (parseFloat(c.iva) || 0), 0);

    // ── 3. Remanente mes anterior reajustado con UTM ──────────
    const remData  = _cargarRemanente();
    const remanente        = remData?.monto || 0;
    const remanenteMesOrig = remData?.mes   || mes;
    const remanenteAnioOrig= remData?.anio  || anio;

    const { reajuste, reajusteDetalle } = _calcularReajusteUTM(
        remanente, remanenteMesOrig, remanenteAnioOrig, mes, anio
    );
    const remanenteReajustado = remanente + reajuste;

    // ── 4. Crédito total disponible ───────────────────────────
    const creditoTotal = ivaCredito + remanenteReajustado;

    // ── 5. Determinación neto a pagar / remanente a favor ─────
    const diferencia = ivaDebito - creditoTotal;
    const ivaAPagar  = diferencia > 0 ? diferencia : 0;
    const nuevoRemanente = diferencia < 0 ? Math.abs(diferencia) : 0;

    // ── Render ────────────────────────────────────────────────
    _renderIvaResumen({
        mes, anio,
        ivaDebito, ivaCredito,
        remanente, reajuste, reajusteDetalle, remanenteReajustado,
        creditoTotal, ivaAPagar, nuevoRemanente,
        totalVentas: ventas.length, totalCompras: compras.length,
    });

    // Actualizar KPIs de cabecera
    _ivaSetKPI('ivaKpiDebito',    ivaDebito);
    _ivaSetKPI('ivaKpiCredito',   ivaCredito);
    _ivaSetKPI('ivaKpiRemanente', remanenteReajustado);
    _ivaSetKPI('ivaKpiNeto',      ivaAPagar, true);
}

// ─────────────────────────────────────────────────────────────
//  REAJUSTE UTM
// ─────────────────────────────────────────────────────────────
function _calcularReajusteUTM(monto, mesOrig, anioOrig, mesActual, anioActual) {
    if (!monto) return { reajuste: 0, reajusteDetalle: null };

    const ind = window.indicadoresEconomicos;
    const utmActual = parseFloat(ind?.utm?.valor);

    // Intentar obtener UTM del mes de origen desde el historial del caché
    const cache = JSON.parse(localStorage.getItem('core_indicadores') || '{}');
    const histUTM = cache?.utm_historial || {};
    const keyOrig = `${anioOrig}-${String(mesOrig).padStart(2,'0')}`;
    const utmOrig = parseFloat(histUTM[keyOrig]);

    if (!utmActual || isNaN(utmActual)) {
        return {
            reajuste: 0,
            reajusteDetalle: 'UTM del período actual no disponible — actualiza los indicadores.',
        };
    }

    if (!utmOrig || isNaN(utmOrig)) {
        // Sin dato histórico: reajuste estimado con 0% (no penaliza al contribuyente)
        return {
            reajuste: 0,
            reajusteDetalle: `UTM de ${mesOrig}/${anioOrig} no disponible en caché. Reajuste calculado en $0.`,
        };
    }

    const factor   = utmActual / utmOrig;
    const reajuste = Math.round(monto * (factor - 1));

    return {
        reajuste,
        reajusteDetalle:
            `UTM ${mesOrig}/${anioOrig}: $${fmt(utmOrig)} → UTM actual: $${fmt(utmActual)} ` +
            `(factor ${factor.toFixed(4)}) → reajuste: $${fmt(Math.abs(reajuste))}`,
    };
}

// ─────────────────────────────────────────────────────────────
//  PERSISTENCIA REMANENTE
// ─────────────────────────────────────────────────────────────
function _cargarRemanente() {
    try { return JSON.parse(localStorage.getItem(IVA_REMANENTE_KEY)) || null; }
    catch { return null; }
}

function guardarRemanenteIVA() {
    const monto = parseFloat(document.getElementById('ivaInputRemanente')?.value || '0');
    const mes   = parseInt(document.getElementById('ivaRemMes')?.value)  || (new Date().getMonth() + 1);
    const anio  = parseInt(document.getElementById('ivaRemAnio')?.value) || new Date().getFullYear();
    if (isNaN(monto) || monto < 0) {
        mostrarToast('Ingresa un monto de remanente válido.', 'error');
        return;
    }
    localStorage.setItem(IVA_REMANENTE_KEY, JSON.stringify({ monto, mes, anio }));
    mostrarToast('Remanente guardado correctamente.', 'ok');
    generarIvaResumen();
}

// ─────────────────────────────────────────────────────────────
//  RENDER HTML
// ─────────────────────────────────────────────────────────────
function _renderIvaResumen(d) {
    const cont = document.getElementById('ivaResumenCont');
    if (!cont) return;

    const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                   'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const nomMes = meses[d.mes - 1] || d.mes;

    const fila = (label, monto, sub, clrForce) => {
        const color = clrForce || (monto >= 0 ? 'var(--positive)' : 'var(--negative)');
        return `
        <div class="iva-fila">
            <div>
                <span class="iva-fila-label">${label}</span>
                ${sub ? `<div class="iva-fila-sub">${sub}</div>` : ''}
            </div>
            <span class="iva-fila-monto" style="color:${color};">
                $${fmt(Math.abs(monto))}
            </span>
        </div>`;
    };

    const divider = (titulo) =>
        `<div class="iva-divider">${titulo}</div>`;

    const totalBox = (label, monto, pagar) => `
        <div class="iva-total-box ${pagar ? 'iva-total-pagar' : 'iva-total-favor'}">
            <span>${label}</span>
            <span style="font-family:'JetBrains Mono',monospace;font-size:20px;font-weight:800;">
                $${fmt(Math.abs(monto))}
            </span>
        </div>`;

    let html = `
    <div style="font-size:13px;color:var(--text-muted);margin-bottom:16px;">
        Período: <strong>${nomMes} ${d.anio}</strong> ·
        ${d.totalVentas} documentos de venta · ${d.totalCompras} documentos de compra
    </div>`;

    html += divider('IVA Débito Fiscal — Libro de Ventas');
    html += fila('IVA Débito del período', d.ivaDebito, `${d.totalVentas} documentos`, 'var(--negative)');

    html += divider('IVA Crédito Fiscal — Libro de Compras');
    html += fila('IVA Crédito del período', d.ivaCredito, `${d.totalCompras} documentos`, 'var(--positive)');

    if (d.remanente > 0) {
        html += fila(
            'Remanente mes anterior',
            d.remanente,
            d.reajusteDetalle
                ? `Mes origen registrado`
                : 'Sin dato de mes origen',
            'var(--positive)'
        );
        html += fila(
            'Reajuste UTM',
            d.reajuste,
            d.reajusteDetalle || 'Sin datos UTM',
            d.reajuste >= 0 ? 'var(--positive)' : 'var(--negative)'
        );
        html += fila('Remanente reajustado', d.remanenteReajustado, null, 'var(--positive)');
    }

    html += fila('Total Crédito disponible', d.creditoTotal, null, 'var(--positive)');

    html += divider('Determinación IVA a Declarar');

    if (d.ivaAPagar > 0) {
        html += totalBox(`IVA neto a PAGAR — F29 línea 39`, d.ivaAPagar, true);
        html += `<div style="font-size:12px;color:var(--text-muted);margin-top:8px;">
            Débito $${fmt(d.ivaDebito)} − Crédito total $${fmt(d.creditoTotal)} = <strong>$${fmt(d.ivaAPagar)} a pagar</strong>
        </div>`;
    } else {
        html += totalBox(`Remanente a FAVOR — arrastrar al mes siguiente`, d.nuevoRemanente, false);
        html += `<div style="font-size:12px;color:var(--text-muted);margin-top:8px;">
            Crédito total $${fmt(d.creditoTotal)} − Débito $${fmt(d.ivaDebito)} = <strong>$${fmt(d.nuevoRemanente)} a favor</strong>
        </div>`;
        // Botón para guardar el nuevo remanente automáticamente
        html += `<button class="btn btn-primary" style="margin-top:12px;"
            onclick="guardarRemanenteDesdeResumen(${d.nuevoRemanente}, ${d.mes}, ${d.anio})">
            💾 Guardar remanente para el período siguiente
        </button>`;
    }

    cont.innerHTML = html;
}

function guardarRemanenteDesdeResumen(monto, mes, anio) {
    // El remanente se origina en este período y se aplicará al siguiente
    const mesSig  = mes === 12 ? 1 : mes + 1;
    const anioSig = mes === 12 ? anio + 1 : anio;
    localStorage.setItem(IVA_REMANENTE_KEY, JSON.stringify({ monto, mes, anio }));
    mostrarToast(`Remanente de $${fmt(monto)} guardado. Se aplicará en ${mesSig}/${anioSig}.`, 'ok');
}

// ─────────────────────────────────────────────────────────────
//  KPI HELPERS
// ─────────────────────────────────────────────────────────────
function _ivaSetKPI(id, val, esNeto) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = '$' + fmt(Math.abs(val));
    if (esNeto) {
        el.style.color = val > 0 ? 'var(--negative)' : 'var(--positive)';
    } else {
        el.style.color = 'var(--text)';
    }
}

// Inicializar selectores de período al abrir la vista
function _initIvaSelectores() {
    const anio = new Date().getFullYear();
    const mes  = new Date().getMonth() + 1;
    const selA = document.getElementById('selIvaAnio');
    const selM = document.getElementById('selIvaMes');
    if (selA && !selA.value) selA.value = anio;
    if (selM && !selM.value) selM.value = mes;

    // Pre-cargar remanente guardado en los inputs del panel
    const rem = _cargarRemanente();
    if (rem) {
        const elMonto = document.getElementById('ivaInputRemanente');
        const elMes   = document.getElementById('ivaRemMes');
        const elAnio  = document.getElementById('ivaRemAnio');
        if (elMonto) elMonto.value = rem.monto;
        if (elMes)   elMes.value   = rem.mes;
        if (elAnio)  elAnio.value  = rem.anio;
    }
}
