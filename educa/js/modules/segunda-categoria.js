// ─────────────────────────────────────────────────────────────
//  SEGUNDA CATEGORÍA — Módulos para contribuyentes de honorarios
//  Ley 21.133 | Tasa retención 2026: 15,25%
// ─────────────────────────────────────────────────────────────

const TASA_RETENCION_HON   = 0.1525;
const TASA_BASE_COTIZACION = 0.80;   // 80% del bruto (Ley 21.133)
const TASA_SALUD_HON       = 0.07;
const TASA_SIS_HON         = 0.0087;
const GASTOS_PRESUNTOS_PCT = 0.30;
const GASTOS_PRESUNTOS_UTA = 15;     // tope 15 UTA

// ── Storage helpers ───────────────────────────────────────────
function _honGet(key) {
    try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; }
}
function _honSet(key, data) { localStorage.setItem(key, JSON.stringify(data)); }

// ── Calculadora de retención ──────────────────────────────────
function honCalcularDesde(monto, desde) {
    let bruto, retencion, liquido;
    if (desde === 'bruto') {
        bruto      = monto;
        retencion  = Math.round(bruto * TASA_RETENCION_HON);
        liquido    = bruto - retencion;
    } else {
        // líquido = bruto*(1-tasa) ⟹ bruto = liquido/(1-tasa)
        bruto     = Math.round(monto / (1 - TASA_RETENCION_HON));
        liquido   = monto;
        retencion = bruto - liquido;
    }
    return { bruto, retencion, liquido };
}

function _honEnLibro() {
    return document.getElementById('view-libro-honorarios')?.classList.contains('active');
}
function _honId(base) {
    return _honEnLibro() ? 'bhe' + base.charAt(0).toUpperCase() + base.slice(1) : 'hon' + base.charAt(0).toUpperCase() + base.slice(1);
}

function honActualizarCalculo() {
    const p     = _honEnLibro() ? 'bhe' : 'hon';
    const raw   = (document.getElementById(p + 'Monto')?.value || '').replace(/\D/g,'');
    const monto = parseInt(raw) || 0;
    const desde = document.getElementById(p + 'Desde')?.value || 'bruto';
    const { bruto, retencion, liquido } = honCalcularDesde(monto, desde);
    _honSet2(p + 'ResBruto',      fmt(bruto));
    _honSet2(p + 'ResRetencion',  fmt(retencion));
    _honSet2(p + 'ResLiquido',    fmt(liquido));
}

// ── Boleta de Honorarios ──────────────────────────────────────
function honEmitirBoleta() {
    const p       = _honEnLibro() ? 'bhe' : 'hon';
    const rut     = document.getElementById(p + 'RutPagador')?.value?.trim();
    const nombre  = document.getElementById(p + 'NombrePagador')?.value?.trim();
    const raw     = (document.getElementById(p + 'Monto')?.value || '').replace(/\D/g,'');
    const monto   = parseInt(raw) || 0;
    const desde   = document.getElementById(p + 'Desde')?.value || 'bruto';
    const fecha   = document.getElementById(p + 'Fecha')?.value || _hoy();
    const folio   = document.getElementById(p + 'Folio')?.value?.trim() || '';
    const concepto= document.getElementById(p + 'Concepto')?.value?.trim() || '';
    const periodo = document.getElementById(p + 'Periodo')?.value || '';

    if (!rut || !nombre) { mostrarToast('Ingresa RUT y nombre del pagador.', 'error'); return; }
    if (!monto)          { mostrarToast('Ingresa un monto válido.',           'error'); return; }

    const tipoRet = document.querySelector('input[name="honTipoRet"]:checked')?.value || 'pagador';
    const { bruto, retencion, liquido } = honCalcularDesde(monto, desde);
    const boletas = _honGet('hon_boletas');
    boletas.push({ id: Date.now(), fecha, folio, rut, nombre, concepto, periodo, bruto, retencion, liquido, estado: 'pendiente', tipoRet });
    _honSet('hon_boletas', boletas);

    [p+'RutPagador', p+'NombrePagador', p+'Monto', p+'Folio', p+'Concepto', p+'Periodo'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
    });
    honActualizarCalculo();
    mostrarToast('Boleta registrada en el Libro de Honorarios.', 'ok');
    if (_honEnLibro()) honRenderLibro();
}

// ── Libro de Honorarios ───────────────────────────────────────
function honRenderLibro() {
    const mes  = parseInt(document.getElementById('honLibroMes')?.value  || '0');
    const anio = parseInt(document.getElementById('honLibroAnio')?.value || _anioActual());
    const todos = _honGet('hon_boletas');

    const filtradas = todos.filter(b => {
        const d = new Date(b.fecha + 'T00:00:00');
        return d.getFullYear() === anio && (mes === 0 || d.getMonth() + 1 === mes);
    });

    const cuerpo = document.getElementById('honLibroBody');
    const pie    = document.getElementById('honLibroTotales');
    if (!cuerpo) return;

    if (!filtradas.length) {
        cuerpo.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:28px;color:var(--text-muted);">Sin boletas en el período.</td></tr>`;
        if (pie) pie.innerHTML = '';
        return;
    }

    let totB = 0, totR = 0, totL = 0;
    cuerpo.innerHTML = filtradas.map(b => {
        totB += b.bruto; totR += b.retencion; totL += b.liquido;
        const eCls     = b.estado === 'pagada' ? 'color:var(--positive)' : 'color:var(--warning)';
        const retBadge = b.tipoRet === 'auto'
            ? `<span style="font-size:11px;background:#fef3c7;color:#92400e;padding:2px 6px;border-radius:4px;font-weight:600;">Auto-ret.</span>`
            : `<span style="font-size:11px;background:var(--sidebar-bg);color:var(--text-muted);padding:2px 6px;border-radius:4px;">Pagador</span>`;
        return `<tr>
            <td>${b.fecha}</td>
            <td style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-muted);">${b.folio || '—'}</td>
            <td style="font-family:'JetBrains Mono',monospace;font-size:11px;">${b.rut}</td>
            <td>${b.nombre}${b.concepto ? `<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${b.concepto}</div>` : ''}</td>
            <td style="font-size:11px;color:var(--text-muted);">${b.periodo || '—'}</td>
            <td class="monto">${fmt(b.bruto)}</td>
            <td class="monto" style="color:var(--negative);">${fmt(b.retencion)}</td>
            <td class="monto" style="color:var(--positive);">${fmt(b.liquido)}</td>
            <td>${retBadge}</td>
            <td><span style="${eCls};font-weight:600;font-size:11px;">${b.estado === 'pagada' ? '✔ Pagada' : '⏳ Pend.'}</span></td>
            <td style="white-space:nowrap;">
                <button onclick="honCambiarEstado(${b.id})" class="hon-btn-mini">${b.estado === 'pagada' ? 'Revertir' : 'Pagada'}</button>
                <button onclick="honEliminarBoleta(${b.id})" class="hon-btn-mini hon-btn-peligro">✕</button>
            </td>
        </tr>`;
    }).join('');

    if (pie) pie.innerHTML = `<tr class="hon-total-row">
        <td colspan="3">Totales del período</td>
        <td class="monto">${fmt(totB)}</td>
        <td class="monto" style="color:var(--negative);">${fmt(totR)}</td>
        <td class="monto" style="color:var(--positive);">${fmt(totL)}</td>
        <td colspan="2"></td>
    </tr>`;
}

function honCambiarEstado(id) {
    const boletas = _honGet('hon_boletas');
    const b = boletas.find(x => x.id === id);
    if (b) b.estado = b.estado === 'pagada' ? 'pendiente' : 'pagada';
    _honSet('hon_boletas', boletas);
    honRenderLibro();
}

function honEliminarBoleta(id) {
    if (!confirm('¿Eliminar esta boleta?')) return;
    _honSet('hon_boletas', _honGet('hon_boletas').filter(x => x.id !== id));
    honRenderLibro();
}

// ── Libro de Ingresos ─────────────────────────────────────────
function honAgregarIngreso() {
    const fecha      = document.getElementById('ingFecha')?.value || _hoy();
    const tipo       = document.getElementById('ingTipo')?.value || 'otro';
    const nDoc       = document.getElementById('ingNDoc')?.value?.trim() || '';
    const rutPag     = document.getElementById('ingRutPag')?.value?.trim() || '';
    const nombrePag  = document.getElementById('ingNombrePag')?.value?.trim() || '';
    const desc       = document.getElementById('ingDesc')?.value?.trim() || '';
    const monto      = parseInt((document.getElementById('ingMonto')?.value || '').replace(/\D/g,'')) || 0;
    if (!monto) { mostrarToast('Ingresa el monto.', 'error'); return; }
    const lista = _honGet('hon_ingresos_extra');
    lista.push({ id: Date.now(), fecha, tipo, nDoc, rutPag, nombrePag, desc, monto });
    _honSet('hon_ingresos_extra', lista);
    honRenderLibroIngresos();
    ['ingNDoc','ingRutPag','ingNombrePag','ingDesc','ingMonto'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
    });
    mostrarToast('Ingreso registrado.', 'ok');
}

function honRenderLibroIngresos() {
    const anio   = parseInt(document.getElementById('ingAnio')?.value || _anioActual());
    const cuerpo = document.getElementById('ingBody');
    const pie    = document.getElementById('ingTotales');
    if (!cuerpo) return;

    const ETIQ = {
        BHE: 'Boleta BHE', arriendo: 'Arriendo', servicios: 'Serv. prof.',
        devolucion: 'Devolución', interes: 'Intereses', otro: 'Otro ingreso',
    };

    // BHE desde libro de honorarios
    const bhe = _honGet('hon_boletas')
        .filter(b => new Date(b.fecha+'T00:00:00').getFullYear() === anio)
        .map(b => ({
            id: 'bhe_'+b.id, fecha: b.fecha, tipo: 'BHE',
            nDoc: b.folio||'', rutPag: b.rut||'', nombrePag: b.nombre||'',
            desc: b.concepto||'', bruto: b.bruto, retencion: b.retencion, liquido: b.liquido, esBHE: true,
        }));

    // Ingresos manuales — compatible con entradas antiguas (solo monto)
    const manuales = _honGet('hon_ingresos_extra')
        .filter(x => new Date(x.fecha+'T00:00:00').getFullYear() === anio)
        .map(x => ({
            id: x.id, fecha: x.fecha, tipo: x.tipo||'otro',
            nDoc: x.nDoc||'', rutPag: x.rutPag||'', nombrePag: x.nombrePag||x.desc||'',
            desc: x.desc||'', bruto: x.monto, retencion: 0, liquido: x.monto, esBHE: false,
        }));

    const todos = [...bhe, ...manuales].sort((a,b) => a.fecha.localeCompare(b.fecha));

    let totB = 0, totR = 0, totL = 0;

    if (!todos.length) {
        cuerpo.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:28px;color:var(--text-muted);">Sin ingresos para ${anio}.</td></tr>`;
        if (pie) pie.innerHTML = '';
    } else {
        cuerpo.innerHTML = todos.map(r => {
            totB += r.bruto; totR += r.retencion; totL += r.liquido;
            const tipoBadge = `<span style="font-size:11px;background:var(--sidebar-bg);padding:2px 6px;border-radius:4px;">${ETIQ[r.tipo]||r.tipo}</span>`;
            const acciones  = r.esBHE ? '—' : `<button onclick="honEliminarIngreso(${r.id})" class="hon-btn-mini hon-btn-peligro">✕</button>`;
            return `<tr>
                <td>${r.fecha}</td>
                <td>${tipoBadge}</td>
                <td>${r.nDoc||'—'}</td>
                <td style="font-size:12px;">${r.rutPag||'—'}</td>
                <td>${r.nombrePag||r.desc||'—'}${r.desc && r.nombrePag ? `<br><span style="font-size:11px;color:var(--text-muted);">${r.desc}</span>` : ''}</td>
                <td class="monto">${fmt(r.bruto)}</td>
                <td class="monto" style="color:var(--negative);">${r.retencion ? fmt(r.retencion) : '—'}</td>
                <td class="monto" style="color:var(--positive);">${fmt(r.liquido)}</td>
                <td>${acciones}</td>
            </tr>`;
        }).join('');
        if (pie) pie.innerHTML = `<tr class="hon-total-row">
            <td colspan="5">Totales ${anio}</td>
            <td class="monto">${fmt(totB)}</td>
            <td class="monto" style="color:var(--negative);">${fmt(totR)}</td>
            <td class="monto" style="color:var(--positive);">${fmt(totL)}</td>
            <td></td>
        </tr>`;
    }
    _honSet2('ingKpiBruto', fmt(totB));
    _honSet2('ingKpiRet',   fmt(totR));
    _honSet2('ingKpiLiq',   fmt(totL));
}

function honEliminarIngreso(id) {
    if (!confirm('¿Eliminar este ingreso?')) return;
    _honSet('hon_ingresos_extra', _honGet('hon_ingresos_extra').filter(x => x.id !== id));
    honRenderLibroIngresos();
}

// ── Libro de Egresos ──────────────────────────────────────────
function honCalcIvaEgreso() {
    const neto   = parseInt((document.getElementById('egrMonto')?.value || '').replace(/\D/g,'')) || 0;
    const conIva = document.getElementById('egrConIva')?.checked;
    const iva    = conIva ? Math.round(neto * 0.19) : 0;
    const el     = document.getElementById('egrIva');
    if (el) el.value = iva ? fmt(iva) : '';
}

function honAgregarEgreso() {
    const fecha      = document.getElementById('egrFecha')?.value || _hoy();
    const desc       = document.getElementById('egrDesc')?.value?.trim();
    const cat        = document.getElementById('egrCat')?.value || 'otro';
    const tipoDoc    = document.getElementById('egrTipoDoc')?.value || 'otro';
    const nDoc       = document.getElementById('egrNDoc')?.value?.trim() || '';
    const rutProv    = document.getElementById('egrRutProv')?.value?.trim() || '';
    const nombreProv = document.getElementById('egrNombreProv')?.value?.trim() || '';
    const neto       = parseInt((document.getElementById('egrMonto')?.value || '').replace(/\D/g,'')) || 0;
    const conIva     = document.getElementById('egrConIva')?.checked;
    const iva        = conIva ? Math.round(neto * 0.19) : 0;
    const total      = neto + iva;

    if (!desc || !neto) { mostrarToast('Completa descripción y monto neto.', 'error'); return; }

    const lista = _honGet('hon_egresos');
    lista.push({ id: Date.now(), fecha, tipoDoc, nDoc, rutProv, nombreProv, desc, cat, neto, iva, total });
    _honSet('hon_egresos', lista);
    honRenderLibroEgresos();
    ['egrDesc','egrMonto','egrNDoc','egrRutProv','egrNombreProv'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
    });
    const chk = document.getElementById('egrConIva'); if (chk) chk.checked = false;
    const ivaEl = document.getElementById('egrIva'); if (ivaEl) ivaEl.value = '';
    mostrarToast('Egreso registrado.', 'ok');
}

function honRenderLibroEgresos() {
    const anio    = parseInt(document.getElementById('egrAnio')?.value || _anioActual());
    const filtCat = document.getElementById('egrFiltroCat')?.value || '';
    let filtrados = _honGet('hon_egresos')
        .filter(x => new Date(x.fecha+'T00:00:00').getFullYear() === anio)
        .sort((a,b) => a.fecha.localeCompare(b.fecha));
    if (filtCat) filtrados = filtrados.filter(x => x.cat === filtCat);

    const cuerpo = document.getElementById('egrBody');
    const pie    = document.getElementById('egrTotales');
    if (!cuerpo) return;

    const ETIQ_CAT = { materiales:'Materiales', servicios:'Servicios', tecnologia:'Tecnología', capacitacion:'Capacitación', arriendo:'Arriendo', transporte:'Transporte', otro:'Otro' };
    const ETIQ_DOC = { factura:'Factura', boleta:'Boleta', boleta_honorarios:'Bol. Hon.', recibo:'Recibo', otro:'Otro' };

    let totNeto = 0, totIva = 0, totTotal = 0;

    if (!filtrados.length) {
        cuerpo.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:28px;color:var(--text-muted);">Sin egresos para ${anio}.</td></tr>`;
        if (pie) pie.innerHTML = '';
    } else {
        cuerpo.innerHTML = filtrados.map(e => {
            const neto  = e.neto  ?? e.monto ?? 0;
            const iva   = e.iva   ?? 0;
            const total = e.total ?? neto;
            totNeto += neto; totIva += iva; totTotal += total;
            const prov = e.nombreProv
                ? `${e.nombreProv}${e.rutProv ? `<div style="font-size:10px;color:var(--text-muted);">${e.rutProv}</div>` : ''}`
                : (e.rutProv || '—');
            return `<tr>
                <td>${e.fecha}</td>
                <td><span style="font-size:11px;background:var(--sidebar-bg);padding:2px 5px;border-radius:4px;">${ETIQ_DOC[e.tipoDoc]||'—'}</span></td>
                <td style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-muted);">${e.nDoc||'—'}</td>
                <td style="font-size:12px;">${prov}</td>
                <td>${e.desc}</td>
                <td><span style="font-size:11px;background:var(--sidebar-bg);padding:2px 5px;border-radius:4px;">${ETIQ_CAT[e.cat]||e.cat}</span></td>
                <td class="monto">${fmt(neto)}</td>
                <td class="monto" style="color:var(--text-muted);">${iva ? fmt(iva) : '—'}</td>
                <td class="monto" style="color:var(--negative);font-weight:600;">${fmt(total)}</td>
                <td><button onclick="honEliminarEgreso(${e.id})" class="hon-btn-mini hon-btn-peligro">✕</button></td>
            </tr>`;
        }).join('');
        if (pie) pie.innerHTML = `<tr class="hon-total-row">
            <td colspan="6">Total egresos ${anio}${filtCat ? ` — ${ETIQ_CAT[filtCat]}` : ''}</td>
            <td class="monto">${fmt(totNeto)}</td>
            <td class="monto" style="color:var(--text-muted);">${totIva ? fmt(totIva) : '—'}</td>
            <td class="monto" style="color:var(--negative);">${fmt(totTotal)}</td>
            <td></td>
        </tr>`;
    }
    _honSet2('egrKpiTotal', fmt(totTotal));
    _honSet2('egrKpiCount', String(filtrados.length));
}

function honEliminarEgreso(id) {
    if (!confirm('¿Eliminar este egreso?')) return;
    _honSet('hon_egresos', _honGet('hon_egresos').filter(x => x.id !== id));
    honRenderLibroEgresos();
}

// ── Cotizaciones estimadas ────────────────────────────────────
function honCalcularCotizaciones() {
    const raw   = (document.getElementById('cotBruto')?.value || '').replace(/\D/g,'');
    const bruto = parseInt(raw) || 0;
    const base  = Math.round(bruto * TASA_BASE_COTIZACION);

    const afpNombre = window.currentUser?.afp || '';
    const afpTasas  = window.indicadoresEconomicos?.afpTasas || {};
    const tasaAFP   = (afpTasas[afpNombre] || 11.27) / 100;

    const afpMonto  = Math.round(base * tasaAFP);
    const saludMon  = Math.round(base * TASA_SALUD_HON);
    const sisMon    = Math.round(base * TASA_SIS_HON);
    const total     = afpMonto + saludMon + sisMon;

    _honSet2('cotBase',      fmt(base));
    _honSet2('cotAfpLabel',  `AFP ${afpNombre || 'seleccionada'} (${(tasaAFP*100).toFixed(2)}%)`);
    _honSet2('cotAfp',       fmt(afpMonto));
    _honSet2('cotSalud',     fmt(saludMon));
    _honSet2('cotSIS',       fmt(sisMon));
    _honSet2('cotTotal',     fmt(total));

    const res = document.getElementById('cotResultado');
    if (res) res.style.display = '';
}

// ── Gastos Presuntos vs Efectivos ─────────────────────────────
function honCalcularGastos() {
    const bruto     = parseInt((document.getElementById('gpBruto')?.value     || '').replace(/\D/g,'')) || 0;
    const efectivos = parseInt((document.getElementById('gpEfectivos')?.value || '').replace(/\D/g,'')) || 0;

    const utm  = window.indicadoresEconomicos?.utm || 69069;
    const tope = Math.round(utm * 12 * GASTOS_PRESUNTOS_UTA);
    const pres = Math.min(Math.round(bruto * GASTOS_PRESUNTOS_PCT), tope);
    const dif  = efectivos - pres;

    _honSet2('gpPresuntosCalc', fmt(pres));
    _honSet2('gpTope',          `$${fmt(tope)} (15 UTA con UTM $${fmt(utm)})`);
    _honSet2('gpDiferencia',    fmt(Math.abs(dif)));

    const rec = document.getElementById('gpRecomendacion');
    if (rec) {
        if (Math.abs(dif) < 1) {
            rec.textContent = 'Ambas opciones son equivalentes.';
            rec.style.color = 'var(--text-muted)';
        } else if (efectivos > pres) {
            rec.textContent = `✅ Conviene gastos efectivos — base imponible $${fmt(dif)} menor.`;
            rec.style.color = 'var(--positive)';
        } else {
            rec.textContent = `✅ Conviene gastos presuntos — base imponible $${fmt(-dif)} menor.`;
            rec.style.color = 'var(--positive)';
        }
    }
    document.getElementById('gpResultado')?.removeAttribute('hidden');
}

// ── Retenciones recibidas ─────────────────────────────────────
function honAgregarRetencion() {
    const rut    = document.getElementById('retRut')?.value?.trim();
    const nombre = document.getElementById('retNombre')?.value?.trim();
    const bruto  = parseInt((document.getElementById('retBruto')?.value || '').replace(/\D/g,'')) || 0;
    const fecha  = document.getElementById('retFecha')?.value || _hoy();

    if (!rut || !nombre || !bruto) { mostrarToast('Completa todos los campos.', 'error'); return; }

    const retencion = Math.round(bruto * TASA_RETENCION_HON);
    const lista = _honGet('hon_retenciones');
    lista.push({ id: Date.now(), fecha, rut, nombre, bruto, retencion });
    _honSet('hon_retenciones', lista);
    honRenderRetenciones();
    ['retRut','retNombre','retBruto'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    mostrarToast('Retención registrada.', 'ok');
}

function honRenderRetenciones() {
    const anio = parseInt(document.getElementById('retAnio')?.value || _anioActual());
    const filtradas = _honGet('hon_retenciones').filter(r =>
        new Date(r.fecha + 'T00:00:00').getFullYear() === anio
    );
    const cuerpo = document.getElementById('retBody');
    const pie    = document.getElementById('retTotales');
    if (!cuerpo) return;

    let totB = 0, totR = 0;
    if (!filtradas.length) {
        cuerpo.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:28px;color:var(--text-muted);">Sin retenciones para ${anio}.</td></tr>`;
        if (pie) pie.innerHTML = '';
    } else {
        cuerpo.innerHTML = filtradas.map(r => {
            totB += r.bruto; totR += r.retencion;
            return `<tr>
                <td>${r.fecha}</td>
                <td style="font-family:'JetBrains Mono',monospace;font-size:12px;">${r.rut}</td>
                <td>${r.nombre}</td>
                <td class="monto">${fmt(r.bruto)}</td>
                <td class="monto" style="color:var(--negative);">${fmt(r.retencion)}</td>
                <td><button onclick="honEliminarRetencion(${r.id})" class="hon-btn-mini hon-btn-peligro">✕</button></td>
            </tr>`;
        }).join('');
        if (pie) pie.innerHTML = `<tr class="hon-total-row">
            <td colspan="3">Totales año ${anio}</td>
            <td class="monto">${fmt(totB)}</td>
            <td class="monto" style="color:var(--negative);">${fmt(totR)}</td>
            <td></td>
        </tr>`;
    }
    _honSet2('retKpiTotal', fmt(totR));
}

function honEliminarRetencion(id) {
    if (!confirm('¿Eliminar esta retención?')) return;
    _honSet('hon_retenciones', _honGet('hon_retenciones').filter(x => x.id !== id));
    honRenderRetenciones();
}

// ── PPM Mensual ───────────────────────────────────────────────
function honRegistrarPPM() {
    const mes   = parseInt(document.getElementById('ppmMes')?.value  || '0');
    const anio  = parseInt(document.getElementById('ppmAnio')?.value || _anioActual());
    const monto = parseInt((document.getElementById('ppmMonto')?.value || '').replace(/\D/g,'')) || 0;

    if (!mes || !monto) { mostrarToast('Completa mes y monto.', 'error'); return; }

    const lista = _honGet('hon_ppm');
    const idx   = lista.findIndex(x => x.mes === mes && x.anio === anio);
    if (idx >= 0) lista[idx].monto = monto;
    else lista.push({ id: Date.now(), mes, anio, monto });
    _honSet('hon_ppm', lista);
    honRenderPPM();
    const el = document.getElementById('ppmMonto'); if (el) el.value = '';
    mostrarToast('PPM registrado.', 'ok');
}

function honRenderPPM() {
    const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const anio = parseInt(document.getElementById('ppmListaAnio')?.value || _anioActual());
    const filtrados = _honGet('hon_ppm').filter(x => x.anio === anio).sort((a,b) => a.mes - b.mes);
    const cuerpo = document.getElementById('ppmBody');
    if (!cuerpo) return;

    let total = 0;
    if (!filtrados.length) {
        cuerpo.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:28px;color:var(--text-muted);">Sin PPM para ${anio}.</td></tr>`;
    } else {
        cuerpo.innerHTML = filtrados.map(p => {
            total += p.monto;
            return `<tr>
                <td>${MESES[p.mes-1]}</td>
                <td class="monto">${fmt(p.monto)}</td>
                <td><button onclick="honEliminarPPM(${p.id})" class="hon-btn-mini hon-btn-peligro">✕</button></td>
            </tr>`;
        }).join('');
    }
    _honSet2('ppmTotal', fmt(total));
}

function honEliminarPPM(id) {
    _honSet('hon_ppm', _honGet('hon_ppm').filter(x => x.id !== id));
    honRenderPPM();
}

// ── F29 Segunda Categoría ─────────────────────────────────────
function honGenerarF29() {
    const mes  = parseInt(document.getElementById('f29honMes')?.value  || new Date().getMonth() + 1);
    const anio = parseInt(document.getElementById('f29honAnio')?.value || _anioActual());

    const ret = _honGet('hon_retenciones').filter(r => {
        const d = new Date(r.fecha + 'T00:00:00');
        return d.getFullYear() === anio && d.getMonth() + 1 === mes;
    });
    const totRet = ret.reduce((s, r) => s + r.retencion, 0);
    const ppm    = _honGet('hon_ppm').find(p => p.mes === mes && p.anio === anio);
    const totPPM = ppm?.monto || 0;

    _honSet2('f29honRetenciones', fmt(totRet));
    _honSet2('f29honPPM',         fmt(totPPM));
    _honSet2('f29honTotal',       fmt(totRet + totPPM));
    document.getElementById('f29honResultado')?.removeAttribute('hidden');
}

// ── F29 Segunda Categoría ─────────────────────────────────────
function honGenerarF29() {
    const mes  = parseInt(document.getElementById('f29honMes')?.value  || new Date().getMonth() + 1);
    const anio = parseInt(document.getElementById('f29honAnio')?.value || _anioActual());

    // PPM voluntario del período (cód. 67)
    const ppm    = _honGet('hon_ppm').find(p => p.mes === mes && p.anio === anio);
    const totPPM = ppm?.monto || 0;

    // Boletas del período
    const boletas = _honGet('hon_boletas').filter(b => {
        const d = new Date(b.fecha+'T00:00:00');
        return d.getFullYear() === anio && d.getMonth()+1 === mes;
    });

    // Auto-retenciones: pagador es persona natural → el prestador declara y paga (cód. 74)
    const totAutoRet = boletas
        .filter(b => b.tipoRet === 'auto')
        .reduce((s, b) => s + b.retencion, 0);

    // Retenciones pagadas a prestadores propios (cód. 72) — cuando esta empresa paga a terceros
    const prestRuts  = new Set(_honGet('hon_prestadores').map(p => p.rut));
    const totRetTerc = boletas
        .filter(b => b.tipoRet !== 'auto' && prestRuts.has(b.rut))
        .reduce((s, b) => s + b.retencion, 0);

    _honSet2('f29honPPM',         fmt(totPPM));
    _honSet2('f29honAutoRet',     fmt(totAutoRet));
    _honSet2('f29honRetenciones', fmt(totRetTerc));
    _honSet2('f29honTotal',       fmt(totPPM + totAutoRet + totRetTerc));

    // Mostrar/ocultar fila auto-retención según si hay monto
    const filaAuto = document.getElementById('f29FilaAutoRet');
    if (filaAuto) filaAuto.style.display = totAutoRet ? '' : 'none';
}

// ── F22 Renta Anual ───────────────────────────────────────────
function honCalcularF22() {
    const anio      = parseInt(document.getElementById('f22Anio')?.value || _anioActual());
    const usarPres  = document.getElementById('f22UsePresuntos')?.checked ?? true;
    const utm       = window.indicadoresEconomicos?.utm || 69069;

    const boletas   = _honGet('hon_boletas').filter(b => new Date(b.fecha + 'T00:00:00').getFullYear() === anio);
    const brutoAnual= boletas.reduce((s,b) => s + b.bruto, 0);

    // Solo boletas donde el pagador retuvo (empresa/persona jurídica) cuentan como crédito en F22
    // Las auto-retenciones ya se pagaron vía F29 y también se acreditan
    const bolAnio   = _honGet('hon_boletas').filter(b => new Date(b.fecha+'T00:00:00').getFullYear() === anio);
    const totRet    = bolAnio.filter(b => !b.tipoRet || b.tipoRet === 'pagador').reduce((s,b) => s + b.retencion, 0);
    const totAutoR  = bolAnio.filter(b => b.tipoRet === 'auto').reduce((s,b) => s + b.retencion, 0);
    const totPPM    = _honGet('hon_ppm').filter(p => p.anio === anio).reduce((s,p) => s + p.monto, 0);
    // Retenciones legacy (módulo anterior) — mantener compatibilidad
    const retEntd   = _honGet('hon_retenciones').filter(r => new Date(r.fecha + 'T00:00:00').getFullYear() === anio);
    const totRetLeg = retEntd.reduce((s,r) => s + r.retencion, 0);

    const baseCot   = Math.round(brutoAnual * TASA_BASE_COTIZACION);
    const afpNombre = window.currentUser?.afp || '';
    const afpTasas  = window.indicadoresEconomicos?.afpTasas || {};
    const tasaAFP   = (afpTasas[afpNombre] || 11.27) / 100;
    const cotizaciones = Math.round(baseCot * (tasaAFP + TASA_SALUD_HON + TASA_SIS_HON));

    const tope     = Math.round(utm * 12 * GASTOS_PRESUNTOS_UTA);
    const presunto = Math.min(Math.round(brutoAnual * GASTOS_PRESUNTOS_PCT), tope);
    const efectivo = parseInt((document.getElementById('f22GastosEfectivos')?.value || '0').replace(/\D/g,'')) || 0;
    const gastos   = usarPres ? presunto : efectivo;

    const base     = Math.max(0, brutoAnual - cotizaciones - gastos);
    const imp      = _calcIGC(base, utm);
    const credRet  = totRet + totAutoR + totRetLeg;
    const cred     = credRet + totPPM;
    const res      = imp - cred;

    _honSet2('f22BrutoAnual',    fmt(brutoAnual));
    _honSet2('f22Cotizaciones',  fmt(cotizaciones));
    _honSet2('f22Gastos',        fmt(gastos));
    _honSet2('f22TipoGastos',    usarPres ? `Presuntos 30% (tope $${fmt(tope)})` : 'Efectivos acreditados');
    _honSet2('f22BaseImponible', fmt(base));
    _honSet2('f22Impuesto',      fmt(imp));
    _honSet2('f22Retenciones',   fmt(credRet));
    _honSet2('f22PPM',           fmt(totPPM));
    _honSet2('f22Creditos',      fmt(cred));

    const resEl = document.getElementById('f22Resultado');
    if (resEl) {
        resEl.textContent = res > 0
            ? `Impuesto a pagar: $${fmt(res)}`
            : `Devolución estimada: $${fmt(Math.abs(res))}`;
        resEl.className = res > 0 ? 'hon-res-neg' : 'hon-res-pos';
    }
    document.getElementById('f22Detalle')?.removeAttribute('hidden');
    const ph = document.getElementById('f22Placeholder'); if (ph) ph.style.display = 'none';
}

function honToggleGastosF22(chk) {
    const campo = document.getElementById('f22GastosEfectivos');
    if (campo) campo.disabled = chk.checked;
}

function honCargarEgresosEnF22() {
    const anio = parseInt(document.getElementById('f22Anio')?.value || _anioActual());
    const total = _honGet('hon_egresos')
        .filter(e => new Date(e.fecha+'T00:00:00').getFullYear() === anio)
        .reduce((s, e) => s + (e.total ?? e.monto ?? 0), 0);
    const campo = document.getElementById('f22GastosEfectivos');
    if (campo) { campo.value = String(total); campo.disabled = false; }
    const chk = document.getElementById('f22UsePresuntos');
    if (chk) chk.checked = false;
    mostrarToast(`Gastos efectivos ${anio}: $${fmt(total)} cargados desde el Libro de Egresos.`, 'ok');
}

// IGC por tramos marginales (2026 aproximado)
function _calcIGC(base, utm) {
    const uta = utm * 12;
    const tramos = [
        { desde:   0,   hasta:  13.5, tasa: 0     },
        { desde:  13.5, hasta:  30,   tasa: 0.04  },
        { desde:  30,   hasta:  50,   tasa: 0.08  },
        { desde:  50,   hasta:  70,   tasa: 0.135 },
        { desde:  70,   hasta:  90,   tasa: 0.23  },
        { desde:  90,   hasta: 120,   tasa: 0.304 },
        { desde: 120,   hasta: 150,   tasa: 0.355 },
        { desde: 150,   hasta: Infinity, tasa: 0.40 },
    ];
    let tax = 0;
    for (const t of tramos) {
        const inf = t.desde * uta;
        const sup = t.hasta === Infinity ? base : t.hasta * uta;
        if (base <= inf) break;
        tax += (Math.min(base, sup) - inf) * t.tasa;
    }
    return Math.max(0, Math.round(tax));
}

// ── Proyección F22 ────────────────────────────────────────────
function honProyectarF22() {
    const utm      = window.indicadoresEconomicos?.utm || 69069;
    const hoy      = new Date();
    const mesActual = hoy.getMonth() + 1; // 1-12
    const anio     = hoy.getFullYear();

    const boletas  = _honGet('hon_boletas').filter(b => new Date(b.fecha + 'T00:00:00').getFullYear() === anio);
    const brutoAcum= boletas.reduce((s,b) => s + b.bruto, 0);
    // Proyectar a 12 meses linealmente
    const proyAnual = mesActual > 0 ? Math.round(brutoAcum * 12 / mesActual) : 0;

    const baseCot  = Math.round(proyAnual * TASA_BASE_COTIZACION);
    const afpNombre= window.currentUser?.afp || '';
    const afpTasas = window.indicadoresEconomicos?.afpTasas || {};
    const tasaAFP  = (afpTasas[afpNombre] || 11.27) / 100;
    const cotProy  = Math.round(baseCot * (tasaAFP + TASA_SALUD_HON + TASA_SIS_HON));

    const tope  = Math.round(utm * 12 * GASTOS_PRESUNTOS_UTA);
    const gProy = Math.min(Math.round(proyAnual * GASTOS_PRESUNTOS_PCT), tope);
    const baseProy = Math.max(0, proyAnual - cotProy - gProy);
    const impProy  = _calcIGC(baseProy, utm);

    const totRetAcum = _honGet('hon_retenciones').filter(r => new Date(r.fecha+'T00:00:00').getFullYear()===anio).reduce((s,r)=>s+r.retencion,0);
    const retProyAnual = mesActual > 0 ? Math.round(totRetAcum * 12 / mesActual) : 0;
    const totPPMAcum = _honGet('hon_ppm').filter(p=>p.anio===anio).reduce((s,p)=>s+p.monto,0);
    const credProy = retProyAnual + totPPMAcum;
    const resProy  = impProy - credProy;

    _honSet2('proyBruto',      fmt(proyAnual));
    _honSet2('proyImpuesto',   fmt(impProy));
    _honSet2('proyCreditos',   fmt(credProy));
    _honSet2('proyMesActual',  `(basado en ${mesActual} mes${mesActual>1?'es':''})`);

    const resEl = document.getElementById('proyResultado');
    if (resEl) {
        resEl.textContent = resProy > 0
            ? `⚠️ Al ritmo actual, pagarías aprox. $${fmt(resProy)} en el F22.`
            : `✅ Al ritmo actual, recibirías devolución de aprox. $${fmt(Math.abs(resProy))}.`;
        resEl.className = resProy > 0 ? 'hon-res-neg' : 'hon-res-pos';
    }
    document.getElementById('proyDetalle')?.removeAttribute('hidden');
}


// ── Prestadores ───────────────────────────────────────────────
function honAgregarPrestador() {
    const rut    = document.getElementById('prestRut')?.value?.trim();
    const nombre = document.getElementById('prestNombre')?.value?.trim();
    const correo = document.getElementById('prestCorreo')?.value?.trim();

    if (!rut || !nombre) { mostrarToast('Ingresa RUT y nombre.', 'error'); return; }

    const lista = _honGet('hon_prestadores');
    if (lista.find(x => x.rut === rut)) { mostrarToast('Ya existe un prestador con ese RUT.', 'error'); return; }
    lista.push({ id: Date.now(), rut, nombre, correo: correo || '' });
    _honSet('hon_prestadores', lista);
    honRenderPrestadores();
    ['prestRut','prestNombre','prestCorreo'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    mostrarToast('Prestador registrado.', 'ok');
}

function honRenderPrestadores() {
    const lista = _honGet('hon_prestadores');
    const cuerpo = document.getElementById('prestBody');
    if (!cuerpo) return;

    if (!lista.length) {
        cuerpo.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:28px;color:var(--text-muted);">Sin prestadores registrados.</td></tr>`;
        return;
    }
    // Calcular totales por prestador desde boletas
    const boletas = _honGet('hon_boletas');
    cuerpo.innerHTML = lista.map(p => {
        const bPrest = boletas.filter(b => b.rut === p.rut);
        const totBruto = bPrest.reduce((s,b) => s + b.bruto, 0);
        return `<tr>
            <td style="font-family:'JetBrains Mono',monospace;font-size:12px;">${p.rut}</td>
            <td>${p.nombre}</td>
            <td>${p.correo || '—'}</td>
            <td class="monto">${fmt(totBruto)}</td>
            <td><button onclick="honEliminarPrestador(${p.id})" class="hon-btn-mini hon-btn-peligro">✕</button></td>
        </tr>`;
    }).join('');
}

function honEliminarPrestador(id) {
    if (!confirm('¿Eliminar este prestador?')) return;
    _honSet('hon_prestadores', _honGet('hon_prestadores').filter(x => x.id !== id));
    honRenderPrestadores();
}

// ── DJ 1879 ───────────────────────────────────────────────────
function honRenderDJ1879() {
    const anio = parseInt(document.getElementById('dj1879Anio')?.value || _anioActual() - 1);
    const prestadores = _honGet('hon_prestadores');
    const cuerpo = document.getElementById('dj1879Body');
    if (!cuerpo) return;

    if (!prestadores.length) {
        cuerpo.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:28px;color:var(--text-muted);">
            Sin prestadores. Agrégalos en el módulo Prestadores/Terceros.</td></tr>`;
        document.getElementById('dj1879Totales')?.innerHTML && (document.getElementById('dj1879Totales').innerHTML = '');
        return;
    }

    const boletas = _honGet('hon_boletas').filter(b => new Date(b.fecha+'T00:00:00').getFullYear() === anio);
    const por_rut = {};
    boletas.forEach(b => {
        if (!por_rut[b.rut]) por_rut[b.rut] = { bruto: 0, retencion: 0 };
        por_rut[b.rut].bruto     += b.bruto;
        por_rut[b.rut].retencion += b.retencion;
    });

    let totB = 0, totR = 0;
    cuerpo.innerHTML = prestadores.map(p => {
        const d = por_rut[p.rut] || { bruto: 0, retencion: 0 };
        totB += d.bruto; totR += d.retencion;
        return `<tr>
            <td style="font-family:'JetBrains Mono',monospace;font-size:12px;">${p.rut}</td>
            <td>${p.nombre}</td>
            <td>${p.correo || '—'}</td>
            <td class="monto">${fmt(d.bruto)}</td>
            <td class="monto" style="color:var(--negative);">${fmt(d.retencion)}</td>
        </tr>`;
    }).join('');

    const pie = document.getElementById('dj1879Totales');
    if (pie) pie.innerHTML = `<tr class="hon-total-row">
        <td colspan="3">Totales año ${anio}</td>
        <td class="monto">${fmt(totB)}</td>
        <td class="monto" style="color:var(--negative);">${fmt(totR)}</td>
    </tr>`;
}

// ── Calendario Tributario ─────────────────────────────────────
function honRenderCalendario() {
    const hoy  = new Date();
    const anio = hoy.getFullYear();
    const MESES= ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

    const eventos = [];

    // F29 mensual — día 12 si hay retenciones o PPM
    for (let m = 1; m <= 12; m++) {
        const tieneRet = _honGet('hon_retenciones').some(r => {
            const d = new Date(r.fecha+'T00:00:00');
            return d.getFullYear() === anio && d.getMonth()+1 === m;
        });
        const tienePPM = _honGet('hon_ppm').some(p => p.mes === m && p.anio === anio);
        if (tieneRet || tienePPM) {
            eventos.push({ fecha: `${anio}-${String(m).padStart(2,'0')}-12`, titulo: `F29 — ${MESES[m-1]}`, tipo: 'f29' });
        }
    }

    // F22 — 30 Abril
    eventos.push({ fecha: `${anio}-04-30`, titulo: `F22 Operación Renta ${anio-1}`, tipo: 'f22' });

    // DJ 1879 — 31 Marzo si hay prestadores
    if (_honGet('hon_prestadores').length) {
        eventos.push({ fecha: `${anio}-03-31`, titulo: `DJ 1879 — Honorarios pagados ${anio-1}`, tipo: 'dj' });
    }

    eventos.sort((a,b) => a.fecha.localeCompare(b.fecha));

    const cont = document.getElementById('calendarCont');
    if (!cont) return;

    cont.innerHTML = eventos.map(v => {
        const fv = new Date(v.fecha + 'T00:00:00');
        const dias = Math.ceil((fv - hoy) / 86400000);
        let estadoTxt = '', color = '';
        if (dias < 0)       { estadoTxt = 'Vencido';          color = 'var(--negative)'; }
        else if (dias <= 7) { estadoTxt = `⚠️ ${dias} días`;  color = '#d97706'; }
        else                { estadoTxt = `${dias} días`;      color = 'var(--text-muted)'; }

        const tipoCls = v.tipo === 'f29' ? 'cal-tipo-f29' : v.tipo === 'f22' ? 'cal-tipo-f22' : 'cal-tipo-dj';
        return `<div class="cal-item">
            <div class="cal-fecha ${tipoCls}">${v.fecha}</div>
            <div class="cal-titulo">${v.titulo}</div>
            <div class="cal-dias" style="color:${color};font-weight:700;">${estadoTxt}</div>
        </div>`;
    }).join('');
}

// ── Helpers internos ──────────────────────────────────────────
function _hoy()        { return new Date().toISOString().slice(0,10); }
function _anioActual() { return new Date().getFullYear(); }
function _honSet2(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }

// ── Inicialización de fechas al cargar la página ─────────────
(function() {
    const hoy = _hoy();
    ['honFecha','bheFecha','retFecha','ingFecha','egrFecha'].forEach(id => {
        const el = document.getElementById(id);
        if (el && !el.value) el.value = hoy;
    });
    const elPeriodo = document.getElementById('honPeriodo');
    if (elPeriodo && !elPeriodo.value) elPeriodo.value = hoy.slice(0, 7);
    const mesActual = new Date().getMonth() + 1;
    const selPPM = document.getElementById('ppmMes');
    if (selPPM) selPPM.value = String(mesActual);
    const selPPMAnio = document.getElementById('ppmAnio');
    if (selPPMAnio) selPPMAnio.value = String(new Date().getFullYear());
})();

// ── Exports globales ──────────────────────────────────────────
window.honActualizarCalculo    = honActualizarCalculo;
window.honEmitirBoleta         = honEmitirBoleta;
window.honRenderLibro          = honRenderLibro;
window.honCambiarEstado        = honCambiarEstado;
window.honEliminarBoleta       = honEliminarBoleta;
window.honAgregarIngreso       = honAgregarIngreso;
window.honRenderLibroIngresos  = honRenderLibroIngresos;
window.honEliminarIngreso      = honEliminarIngreso;
window.honCalcIvaEgreso        = honCalcIvaEgreso;
window.honAgregarEgreso        = honAgregarEgreso;
window.honRenderLibroEgresos   = honRenderLibroEgresos;
window.honEliminarEgreso       = honEliminarEgreso;
window.honCalcularCotizaciones = honCalcularCotizaciones;
window.honCalcularGastos       = honCalcularGastos;
window.honAgregarRetencion     = honAgregarRetencion;
window.honRenderRetenciones    = honRenderRetenciones;
window.honEliminarRetencion    = honEliminarRetencion;
window.honRegistrarPPM         = honRegistrarPPM;
window.honRenderPPM            = honRenderPPM;
window.honEliminarPPM          = honEliminarPPM;
window.honGenerarF29           = honGenerarF29;
window.honCalcularF22          = honCalcularF22;
window.honToggleGastosF22      = honToggleGastosF22;
window.honCargarEgresosEnF22   = honCargarEgresosEnF22;
window.honProyectarF22         = honProyectarF22;
window.honAgregarPrestador     = honAgregarPrestador;
window.honRenderPrestadores    = honRenderPrestadores;
window.honEliminarPrestador    = honEliminarPrestador;
window.honRenderDJ1879         = honRenderDJ1879;
window.honRenderCalendario     = honRenderCalendario;
