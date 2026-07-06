/* ══════════════════════════════════════════════════════════
   MÓDULO REMUNERACIONES — vanilla JS
   Datos en localStorage: rem_trabajadores, rem_liquidaciones
══════════════════════════════════════════════════════════ */

const REM = {
    IMM:          539000,   // se sobreescribe con el valor live de indicadores al iniciar
    SUELDO_MINIMO: 539000,
    get TOPE_GRATIF() { return Math.round(this.IMM * 4.75 / 12); },
    UTM: 68000,
    TASAS_AFP: {
        'Capital': 11.44, 'Cuprum': 11.44, 'Habitat': 11.27,
        'PlanVital': 11.16, 'ProVida': 11.45, 'Modelo': 10.58, 'Uno': 10.49,
    },
    ASIG_FAMILIAR: [
        { hasta: 631976,   monto: 22007 },
        { hasta: 923067,   monto: 13505 },
        { hasta: 1439668,  monto: 4267  },
        { hasta: Infinity, monto: 0     },
    ],
    TABLA_IU: [
        { desde: 0,    hasta: 13.5,     tasa: 0,     rebaja: 0       },
        { desde: 13.5, hasta: 30,       tasa: 0.04,  rebaja: 32400   },
        { desde: 30,   hasta: 50,       tasa: 0.08,  rebaja: 152400  },
        { desde: 50,   hasta: 70,       tasa: 0.135, rebaja: 427400  },
        { desde: 70,   hasta: 90,       tasa: 0.23,  rebaja: 1092400 },
        { desde: 90,   hasta: 120,      tasa: 0.304, rebaja: 1758400 },
        { desde: 120,  hasta: 150,      tasa: 0.354, rebaja: 2358400 },
        { desde: 150,  hasta: Infinity, tasa: 0.40,  rebaja: 3058400 },
    ],
};

let remState = {
    tab: 'trabajadores',
    trabajadores: [],
    liquidaciones: [],
    periodo: '',
    buscar: '',
    trabSelId: null,
    modalData: null,
    modalSeccion: 'identidad',
    borrador: {},   // { [trabId]: { horasSemanales, horasExtra, comisiones, ... } }
};

// ── Helpers ───────────────────────────────────────────────────
const fmt$ = n => '$ ' + Math.round(n || 0).toLocaleString('es-CL');

function fmtRut(raw) {
    const r = (raw || '').replace(/[^0-9kK]/g, '').toUpperCase();
    if (r.length < 2) return r;
    const dv = r.slice(-1);
    let body = r.slice(0, -1), num = '';
    for (let i = body.length - 1, c = 0; i >= 0; i--, c++) {
        if (c > 0 && c % 3 === 0) num = '.' + num;
        num = body[i] + num;
    }
    return num + '-' + dv;
}

function fmtPeriodo(p) {
    if (!p) return '';
    const [y, m] = p.split('-');
    const M = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    return M[parseInt(m) - 1] + ' ' + y;
}

function periodoActual() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function remFmtMonto(inp) {
    const raw = inp.value.replace(/\./g, '').replace(/[^\d]/g, '');
    if (!raw) { inp.value = ''; return; }
    inp.value = Number(raw).toLocaleString('es-CL');
}

function parseMonto(str) {
    return parseInt((str || '0').replace(/\./g, '').replace(/[^\d]/g, '')) || 0;
}

function remFmtRutInp(inp) {
    inp.value = fmtRut(inp.value);
}

const COLORES = ['#3b82f6','#8b5cf6','#06b6d4','#10b981','#f59e0b',
                 '#ef4444','#ec4899','#6366f1','#84cc16','#f97316'];
function avatarColor(s) {
    let h = 0;
    for (let i = 0; i < (s||'').length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xfffffff;
    return COLORES[h % COLORES.length];
}
function iniciales(s) {
    const p = (s || '').trim().split(/\s+/);
    return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : (p[0]?.[0] || '?').toUpperCase();
}
function avatarHtml(nombre, size = 36) {
    const c = avatarColor(nombre), ini = iniciales(nombre);
    return `<div class="rem-avatar" style="background:${c};width:${size}px;height:${size}px;font-size:${Math.round(size*0.37)}px">${ini}</div>`;
}

// ── Persistencia ──────────────────────────────────────────────
function getTrab()   { try { return JSON.parse(localStorage.getItem('rem_trabajadores')||'[]'); } catch { return []; } }
function getLiqs()   { try { return JSON.parse(localStorage.getItem('rem_liquidaciones')||'[]'); } catch { return []; } }
function saveTrab(a) { localStorage.setItem('rem_trabajadores', JSON.stringify(a)); }
function saveLiqs(a) { localStorage.setItem('rem_liquidaciones', JSON.stringify(a)); }

// ── Borrador (variables del período por trabajador) ────────────
function getBorrador(trabId) {
    if (!remState.borrador[trabId]) {
        remState.borrador[trabId] = {
            horasSemanales: 42, horasExtra: 0,
            ventasNetas: 0, pctComision: 0, comisiones: 0,
            participacion: 0,
            tipoGratificacion: 'garantizada_con_tope', gratifPactada: 0,
            colacion: 0, movilizacion: 0, numCargas: 0,
            anticipos: 0, descPrestamo: 0, descOtros: 0,
        };
    }
    return remState.borrador[trabId];
}

// ── Cálculo de liquidación ────────────────────────────────────
function calcularLiquidacion(t, periodo, vars) {
    const v = vars || getBorrador(t.id);

    const diasMes       = Number(t.diasTrabajados || 30);
    const brutoBase     = Number(t.sueldoBruto || 0);
    const sueldoBase    = diasMes < 30 ? Math.round(brutoBase * diasMes / 30) : brutoBase;

    // Horas extraordinarias: valor_hora = SueldoBase / (hSem × 52/12), recargo 50%
    const horasSemanales = Number(v.horasSemanales || 42);
    const numHorasExtra  = Number(v.horasExtra || 0);
    const valorHE = numHorasExtra > 0
        ? Math.round((sueldoBase / (horasSemanales * 52 / 12)) * 1.5 * numHorasExtra) : 0;

    // Comisiones: si hay ventas netas + porcentaje, se calculan automáticamente
    const ventasNetas = Number(v.ventasNetas || 0);
    const pctComision = parseFloat(v.pctComision || 0);
    const comisiones  = (ventasNetas > 0 && pctComision > 0)
        ? Math.round(ventasNetas * pctComision / 100)
        : Number(v.comisiones || 0);
    const participacion = Number(v.participacion || 0);

    // Subtotal imponible sin gratificación (base del cálculo de gratif)
    const imponibleSinGratif = sueldoBase + valorHE + comisiones + participacion;

    // Gratificación
    const tipoGratif = v.tipoGratificacion || 'garantizada_con_tope';
    let gratificacion = 0;
    if (tipoGratif === 'garantizada_con_tope') {
        gratificacion = Math.min(Math.round(imponibleSinGratif * 0.25), REM.TOPE_GRATIF);
    } else if (tipoGratif === 'garantizada_sin_tope') {
        gratificacion = Math.round(imponibleSinGratif * 0.25);
    } else if (tipoGratif === 'pactada') {
        gratificacion = Number(v.gratifPactada || 0);
    }

    const totalImponible = imponibleSinGratif + gratificacion;

    // Haberes no imponibles
    const colacion     = Number(v.colacion     || 0);
    const movilizacion = Number(v.movilizacion || 0);
    const numCargas    = Number(v.numCargas    || 0);
    const _afTramos    = (window.asigFamActiva?.() || REM.ASIG_FAMILIAR).map(t => ({ hasta: t.hastaClp ?? t.hasta, monto: t.montoClp ?? t.monto }));
    const montoAsigFam = numCargas > 0
        ? (_afTramos.find(x => sueldoBase <= x.hasta)?.monto || 0) * numCargas : 0;

    const totalHaberes = totalImponible + colacion + movilizacion + montoAsigFam;

    // Tasas vigentes: preferir las guardadas por el usuario en Previred, si no las de REM
    const _pv        = typeof window.pvTasasActivas === 'function' ? window.pvTasasActivas() : null;
    const afpTasas   = _pv?.afp || REM.TASAS_AFP;
    const sisPct     = _pv?.sis      ?? 1.49;
    const mutualPct  = _pv?.mutual   ?? 0.90;
    const cesTrabPct = _pv?.cesTrab  ?? 0.60;
    const cesEmplPct = _pv?.cesEmpl  ?? 2.40;

    // Topes imponibles en CLP (UF del día × UF límite legal)
    const uf           = window.indicadoresEconomicos?.uf?.valor || 38000;
    const topeAfpClp   = Math.round((_pv?.topeAfp  ?? 90.0)  * uf); // AFP y Salud: 90 UF
    const topeSalClp   = Math.round((_pv?.topeSal  ?? 90.0)  * uf); // mismo tope
    const topeCesClp   = Math.round((_pv?.topeCes  ?? 135.2) * uf); // Cesantía: 135,2 UF
    const topeInpClp   = Math.round((_pv?.topeInp  ?? 60.0)  * uf); // IPS/INP: 60 UF

    // Bases imponibles con tope aplicado
    const baseAfp      = Math.min(totalImponible, topeAfpClp);
    const baseSalud    = Math.min(totalImponible, topeSalClp);
    const baseCes      = Math.min(totalImponible, topeCesClp);

    // Descuentos legales (trabajador) sobre bases topadas
    const afpTasa   = afpTasas[t.afp] || 10.0;
    const saludPct  = Number(t.saludPorcentaje || 7);
    const descAfp   = Math.round(baseAfp   * afpTasa    / 100);
    const descSalud = Math.round(baseSalud * saludPct   / 100);
    const descCes   = Math.round(baseCes   * cesTrabPct / 100);
    const descPrest = Number(v.descPrestamo || 0);
    const descOtros = Number(v.descOtros    || 0);

    // Impuesto Único 2ª Categoría (base = imponible − cotizaciones previsionales)
    const baseIU   = totalImponible - descAfp - descSalud - descCes;
    const enUtm    = baseIU / REM.UTM;
    const tramo    = REM.TABLA_IU.find(x => enUtm >= x.desde && enUtm < x.hasta) || REM.TABLA_IU[0];
    const impUnico = Math.max(0, Math.round(baseIU * tramo.tasa - tramo.rebaja));

    const totalDesc  = descAfp + descSalud + descCes + impUnico + descPrest + descOtros;
    const alcanceLiq = totalHaberes - totalDesc;
    const anticipos  = Number(v.anticipos || 0);
    const liquido    = alcanceLiq - anticipos;

    // Aportes empleador (sobre base topada de cesantía para el empleador)
    const baseCesEmpl = Math.min(totalImponible, topeCesClp);
    const aportSis    = Math.round(totalImponible * sisPct      / 100);
    const aportCes    = Math.round(baseCesEmpl    * cesEmplPct  / 100);
    const aportMut    = Math.round(totalImponible * mutualPct   / 100);
    const aportAfp    = aportSis;
    const costoTotal  = totalHaberes + aportSis + aportCes + aportMut;

    return {
        periodo, trabajadorId: t.id, rut: t.rut,
        nombre: t.nombre, cargo: t.cargo, afp: t.afp,
        sistemaSalud: t.sistemaSalud, banco: t.banco,
        sucursal: t.sucursal, tipoContrato: t.tipoContrato,
        diasTrabajados: diasMes, horasSemanales, horasExtra: numHorasExtra,
        sobresueldo: valorHE,
        sueldoBase, brutoBase,
        ventasNetas, pctComision, comisiones, participacion, gratificacion, tipoGratif,
        imponibleSinGratif, totalImponible,
        // topes aplicados
        topeAfpClp, topeSalClp, topeCesClp,
        baseAfp, baseSalud, baseCes,
        topeAfpAplicado: totalImponible > topeAfpClp,
        topeSalAplicado: totalImponible > topeSalClp,
        topeCesAplicado: totalImponible > topeCesClp,
        colacion, movilizacion, montoAsigFam, numCargas,
        totalHaberes,
        descAfp, afpTasa, descSalud, saludPct,
        descCesantia: descCes, descPrestamo: descPrest, descOtros,
        impUnico, totalDescuentos: totalDesc,
        alcanceLiquido: alcanceLiq, anticipos, liquido,
        aportAfp, aportCesantia: aportCes, aportMutual: aportMut, aportSis,
        costoTotal, bajoMinimo: sueldoBase < REM.SUELDO_MINIMO,
    };
}

// ── Init ──────────────────────────────────────────────────────
function remInit() {
    // Sincronizar IMM y UTM con el caché de indicadores económicos
    const ind = window.indicadoresEconomicos;
    if (ind?.imm?.valor > 0) {
        REM.IMM           = Math.round(ind.imm.valor);
        REM.SUELDO_MINIMO = REM.IMM;
    }
    if (ind?.utm?.valor > 0) {
        REM.UTM = Math.round(ind.utm.valor);
    }

    remState.trabajadores  = getTrab();
    remState.liquidaciones = getLiqs();
    remState.periodo       = periodoActual();
    remState.tab           = 'trabajadores';
    remState.modalData     = null;
    remState.trabSelId     = null;
    remRender();
}

function remRender() {
    const el = document.getElementById('tab-rem-liquidaciones') || document.getElementById('view-remuneraciones');
    if (!el) return;
    el.innerHTML = remHtmlShell();
}

// ══════════════════════════════════════════════════════════════
// SHELL
// ══════════════════════════════════════════════════════════════
function remHtmlShell() {
    const s      = remState;
    const liqPer = s.liquidaciones.filter(l => l.periodo === s.periodo);
    const totalCosto = liqPer.reduce((a,l) => a + l.costoTotal, 0);
    const totalLiq   = liqPer.reduce((a,l) => a + l.liquido,   0);

    const periodos = Array.from({ length: 24 }, (_, i) => {
        const d = new Date(); d.setMonth(d.getMonth() - i);
        const p = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
        return `<option value="${p}" ${p === s.periodo ? 'selected' : ''}>${fmtPeriodo(p)}</option>`;
    }).join('');

    return `
<div class="rem-root">
  <div class="rem-kpi-strip">
    <div class="rem-kpi-card">
      <div class="rem-kpi-icon">👷</div>
      <div class="rem-kpi-val">${s.trabajadores.length}</div>
      <div class="rem-kpi-label">Trabajadores</div>
    </div>
    <div class="rem-kpi-card">
      <div class="rem-kpi-icon">💰</div>
      <div class="rem-kpi-val" style="color:var(--negative)">${fmt$(totalCosto)}</div>
      <div class="rem-kpi-label">Costo empleador</div>
    </div>
    <div class="rem-kpi-card">
      <div class="rem-kpi-icon">💵</div>
      <div class="rem-kpi-val" style="color:var(--positive)">${fmt$(totalLiq)}</div>
      <div class="rem-kpi-label">Total líquido</div>
    </div>
    <div class="rem-kpi-card">
      <div class="rem-kpi-icon">✅</div>
      <div class="rem-kpi-val">${liqPer.length}<span style="font-size:14px;font-weight:500;color:var(--text-muted)"> / ${s.trabajadores.length}</span></div>
      <div class="rem-kpi-label">Liquidados · ${fmtPeriodo(s.periodo)}</div>
    </div>
  </div>

  <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap;">
    <div class="rem-tabs">
      ${[['trabajadores','👤 Trabajadores'],['liquidar','💵 Liquidar'],['libro','📋 Libro'],['vacaciones','🏖 Vacaciones'],['finiquito','📄 Finiquito'],['ia','✨ Auditoría IA']]
        .map(([id,lbl]) => `<button class="rem-tab${s.tab===id?' active':''}" onclick="remSetTab('${id}')">${lbl}</button>`).join('')}
    </div>
    <div style="display:flex;gap:10px;align-items:center;padding-bottom:2px;">
      <select onchange="remSetPeriodo(this.value)"
        style="padding:8px 14px;border:1px solid var(--divider);border-radius:8px;font-size:14px;
               font-family:inherit;background:var(--input-bg);color:var(--text);cursor:pointer;">
        ${periodos}
      </select>
      <button class="btn btn-primary" style="padding:9px 18px;font-size:14px;"
        onclick="remAbrirModal(null)">+ Trabajador</button>
    </div>
  </div>

  <div style="margin-top:28px;" id="rem-body">${remHtmlTab()}</div>
</div>
${remState.modalData !== null ? remHtmlModal() : '<div id="rem-modal" style="display:none;"></div>'}`;
}

function remRefreshBody() {
    const b = document.getElementById('rem-body');
    if (b) b.innerHTML = remHtmlTab();
    _actualizarKPIs();
}

function _actualizarKPIs() {
    const liqPer = remState.liquidaciones.filter(l => l.periodo === remState.periodo);
    const cards  = document.querySelectorAll('.rem-kpi-val');
    if (cards.length < 4) return;
    cards[0].textContent = remState.trabajadores.length;
    cards[1].textContent = fmt$(liqPer.reduce((a,l)=>a+l.costoTotal,0));
    cards[2].textContent = fmt$(liqPer.reduce((a,l)=>a+l.liquido,0));
    cards[3].innerHTML   = liqPer.length +
        `<span style="font-size:14px;font-weight:500;color:var(--text-muted)"> / ${remState.trabajadores.length}</span>`;
}

function remHtmlTab() {
    switch (remState.tab) {
        case 'trabajadores': return remHtmlTrabajadores();
        case 'liquidar':     return remHtmlLiquidar();
        case 'libro':        return remHtmlLibro();
        case 'vacaciones':   return remHtmlVacaciones();
        case 'finiquito':    return remHtmlFiniquito();
        case 'ia':           return remHtmlIA();
        default: return '';
    }
}

// ══════════════════════════════════════════════════════════════
// TAB: TRABAJADORES
// ══════════════════════════════════════════════════════════════
function remHtmlTrabajadores() {
    const { trabajadores, liquidaciones, periodo, buscar } = remState;
    const liqPer    = liquidaciones.filter(l => l.periodo === periodo);
    const filtrados = buscar
        ? trabajadores.filter(t =>
            t.nombre.toLowerCase().includes(buscar.toLowerCase()) || (t.rut||'').includes(buscar))
        : trabajadores;

    const toolbar = `
      <div class="rem-toolbar">
        <input class="rem-search" placeholder="Buscar por nombre o RUT…"
          value="${buscar.replace(/"/g,'&quot;')}" oninput="remBuscar(this.value)">
        <button class="btn btn-primary" style="padding:10px 22px;font-size:14px;"
          onclick="remAbrirModal(null)">+ Nuevo trabajador</button>
      </div>`;

    if (!filtrados.length) return toolbar + `
      <div class="rem-empty">
        <div class="rem-empty-icon">👥</div>
        <p>${buscar ? 'Sin resultados.' : 'No hay trabajadores registrados.'}</p>
        ${!buscar ? '<small>Haz clic en "+ Nuevo trabajador" para comenzar.</small>' : ''}
      </div>`;

    const filas = filtrados.map(t => {
        const yaLiq = liqPer.some(l => l.trabajadorId === t.id);
        return `<tr>
          <td>
            <div style="display:flex;align-items:center;gap:12px;">
              ${avatarHtml(t.nombre, 36)}
              <div>
                <div style="font-weight:600;font-size:14px;">${t.nombre}</div>
                <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">${t.cargo || 'Sin cargo'}</div>
              </div>
            </div>
          </td>
          <td style="font-family:'Courier New',monospace;font-size:13px;">${t.rut || '—'}</td>
          <td><span class="rem-badge rem-badge-gray">${(t.tipoContrato||'—').replace('_',' ')}</span></td>
          <td style="font-size:13px;color:var(--text-muted);">${t.afp||'—'} · ${t.sistemaSalud||'—'} ${t.saludPorcentaje||7}%</td>
          <td style="text-align:right;font-family:'Courier New',monospace;font-weight:600;">${fmt$(t.sueldoBruto)}</td>
          <td>
            <div style="display:flex;gap:6px;align-items:center;">
              <span class="rem-badge ${yaLiq?'rem-badge-ok':'rem-badge-warn'}">${yaLiq?'✔ Liquidado':'Pendiente'}</span>
              ${t.contrato?'<span class="rem-badge rem-badge-gray" title="Contrato adjunto">📎</span>':''}
            </div>
          </td>
          <td>
            <div style="display:flex;gap:6px;">
              <button onclick="remAbrirModal('${t.id}')"
                style="border:1px solid var(--divider);background:var(--input-bg);border-radius:6px;padding:5px 9px;cursor:pointer;font-size:13px;">✏️</button>
              <button onclick="remEliminar('${t.id}')"
                style="border:1px solid #fca5a5;background:var(--negative-soft);border-radius:6px;padding:5px 9px;cursor:pointer;font-size:13px;">🗑</button>
            </div>
          </td>
        </tr>`;
    }).join('');

    return toolbar + `
      <div class="rem-tabla-wrap">
        <table class="rem-tabla">
          <thead>
            <tr>
              <th>Trabajador</th><th>RUT</th><th>Contrato</th>
              <th>AFP · Salud</th><th style="text-align:right;">Sueldo Bruto</th>
              <th>Estado</th><th></th>
            </tr>
          </thead>
          <tbody>${filas}</tbody>
        </table>
      </div>`;
}

// ══════════════════════════════════════════════════════════════
// TAB: LIQUIDAR
// ══════════════════════════════════════════════════════════════
function remHtmlLiquidar() {
    const { trabajadores, liquidaciones, periodo, trabSelId } = remState;
    if (!trabajadores.length) return `
      <div class="rem-empty">
        <div class="rem-empty-icon">💵</div>
        <p>Primero registra trabajadores en la pestaña "Trabajadores".</p>
      </div>`;

    const liqPer    = liquidaciones.filter(l => l.periodo === periodo);
    const pendientes = trabajadores.length - liqPer.length;
    const t         = trabSelId ? trabajadores.find(x => x.id === trabSelId) : null;

    const lista = trabajadores.map(w => {
        const yaLiq = liqPer.some(l => l.trabajadorId === w.id);
        const sel   = w.id === trabSelId;
        return `<div class="rem-worker-item${sel?' sel':''}" onclick="remSelTrab('${w.id}')">
          ${avatarHtml(w.nombre, 34)}
          <div style="flex:1;min-width:0;">
            <div class="rem-worker-nombre">${w.nombre}</div>
            <div class="rem-worker-sub">${fmt$(w.sueldoBruto)}</div>
          </div>
          <span class="rem-badge ${yaLiq?'rem-badge-ok':'rem-badge-warn'}" style="font-size:11px;">${yaLiq?'✔':'Pend.'}</span>
        </div>`;
    }).join('');

    const panelDer = t ? remHtmlVarsYBoleta(t) : `
      <div class="rem-empty">
        <div class="rem-empty-icon">👈</div>
        <p>Selecciona un trabajador para liquidar</p>
      </div>`;

    return `
      <div class="rem-toolbar">
        <div style="font-size:14px;color:var(--text-muted);">
          <strong style="color:var(--text);">${fmtPeriodo(periodo)}</strong>
          · ${liqPer.length} de ${trabajadores.length} liquidados
        </div>
        <button class="btn btn-primary" style="margin-left:auto;padding:10px 22px;font-size:14px;"
          onclick="remLiquidarTodos()">
          ⚡ Liquidar todos (${pendientes} pendientes)
        </button>
      </div>
      <div class="rem-liq-layout">
        <div class="rem-worker-list">${lista}</div>
        <div id="rem-liq-panel">${panelDer}</div>
      </div>`;
}

// ── Panel de variables + boleta ───────────────────────────────
function remHtmlVarsYBoleta(t) {
    const v   = getBorrador(t.id);
    const liq = calcularLiquidacion(t, remState.periodo, v);
    const id  = t.id;

    // Valor de una hora extra calculado (referencia)
    const vhe = v.horasSemanales > 0
        ? Math.round(t.sueldoBruto / (v.horasSemanales * 52 / 12) * 1.5) : 0;

    const montoInpV = (field, label, val, hint='') => `
      <div class="rem-fg">
        <label class="rem-fg-label">${label}</label>
        <input id="remv-${id}-${field}" type="text" inputmode="numeric"
          value="${Number(val||0).toLocaleString('es-CL')}"
          class="rem-input" oninput="remFmtMonto(this)" style="font-family:'Courier New',monospace;">
        ${hint?`<span class="rem-fg-hint">${hint}</span>`:''}
      </div>`;

    const numInpV = (field, label, val, min=0, hint='') => `
      <div class="rem-fg">
        <label class="rem-fg-label">${label}</label>
        <input id="remv-${id}-${field}" type="number" value="${val||0}"
          class="rem-input" min="${min}">
        ${hint?`<span class="rem-fg-hint">${hint}</span>`:''}
      </div>`;

    const tipoGratifSel = `
      <div class="rem-fg">
        <label class="rem-fg-label">Tipo gratificación</label>
        <select id="remv-${id}-tipoGratificacion" class="rem-select"
          onchange="remGratifToggle('${id}')">
          <option value="garantizada_con_tope" ${v.tipoGratificacion==='garantizada_con_tope'?'selected':''}>
            Garantizada con tope (IMM×4.75/12)</option>
          <option value="garantizada_sin_tope" ${v.tipoGratificacion==='garantizada_sin_tope'?'selected':''}>
            Garantizada sin tope (25% imponible)</option>
          <option value="pactada" ${v.tipoGratificacion==='pactada'?'selected':''}>
            Monto pactado empleador</option>
          <option value="ninguna" ${v.tipoGratificacion==='ninguna'?'selected':''}>
            Sin gratificación</option>
        </select>
        <span class="rem-fg-hint">Base: total imponible sin gratif × 25%</span>
      </div>
      <div class="rem-fg" id="remv-${id}-gratifPactada-wrap"
        style="display:${v.tipoGratificacion==='pactada'?'flex':'none'};">
        <label class="rem-fg-label">Monto pactado</label>
        <input id="remv-${id}-gratifPactada" type="text" inputmode="numeric"
          value="${Number(v.gratifPactada||0).toLocaleString('es-CL')}"
          class="rem-input" oninput="remFmtMonto(this)" style="font-family:'Courier New',monospace;">
      </div>`;

    return `
    <div class="rem-liq-detail">

      <!-- Panel variables -->
      <div class="rem-vars-card">
        <div class="rem-vars-head">
          <div style="display:flex;align-items:center;gap:12px;">
            ${avatarHtml(t.nombre, 34)}
            <div>
              <div style="font-weight:700;font-size:14px;">${t.nombre}</div>
              <div style="font-size:12px;color:var(--text-muted);">${t.cargo||''} · Sueldo base: ${fmt$(t.sueldoBruto)}</div>
            </div>
          </div>
          <div style="font-size:13px;color:var(--text-muted);flex-shrink:0;">📅 ${fmtPeriodo(remState.periodo)}</div>
        </div>
        <div class="rem-vars-body">
          <div class="rem-vars-section">Horas de trabajo</div>
          <div class="rem-form-grid">
            ${numInpV('horasSemanales','Horas semanales pactadas',v.horasSemanales,1,'Jornada máxima legal: 42 h/sem.')}
            ${numInpV('horasExtra','Horas extraordinarias',v.horasExtra,0,`Valor 1 h extra: ${fmt$(vhe)}`)}
          </div>
          <div class="rem-vars-section">Remuneración variable imponible</div>
          <div class="rem-form-grid">
            ${montoInpV('ventasNetas','Ventas netas del período',v.ventasNetas,'Si ingresas ventas y %, se calcula automáticamente.')}
            <div class="rem-fg">
              <label class="rem-fg-label">% Comisión</label>
              <input id="remv-${id}-pctComision" type="number" step="0.01" min="0" max="100"
                value="${v.pctComision||0}" class="rem-input" placeholder="Ej: 2.5">
              <span class="rem-fg-hint">% aplicado sobre ventas netas.</span>
            </div>
            ${montoInpV('comisiones','Comisión manual (si no usa ventas + %)',v.comisiones,'Se usa solo si ventas netas = 0.')}
            ${montoInpV('participacion','Participación / bonos imponibles',v.participacion)}
            ${tipoGratifSel}
          </div>
          <div class="rem-vars-section">Haberes no imponibles</div>
          <div class="rem-form-grid">
            ${montoInpV('colacion','Colación',v.colacion)}
            ${montoInpV('movilizacion','Movilización',v.movilizacion)}
            ${numInpV('numCargas','N° cargas familiares',v.numCargas,0,'Asignación FONASA por tramo.')}
          </div>
          <div class="rem-vars-section">Descuentos del período</div>
          <div class="rem-form-grid">
            ${montoInpV('anticipos','Anticipos',v.anticipos,'Descuentan del alcance líquido.')}
            ${montoInpV('descPrestamo','Descuento préstamo',v.descPrestamo)}
            ${montoInpV('descOtros','Otros descuentos',v.descOtros)}
          </div>
          <button class="btn btn-primary" style="width:100%;padding:12px;font-size:14px;margin-top:4px;"
            onclick="remRecalcular('${id}')">
            🔄 Calcular liquidación
          </button>
        </div>
      </div>

      <!-- Boleta -->
      <div id="rem-boleta-${id}">
        ${remHtmlBoleta(liq, t)}
      </div>
    </div>`;
}

function remGratifToggle(trabId) {
    const sel   = document.getElementById(`remv-${trabId}-tipoGratificacion`);
    const wrap  = document.getElementById(`remv-${trabId}-gratifPactada-wrap`);
    if (wrap) wrap.style.display = sel?.value === 'pactada' ? 'flex' : 'none';
}

function remRecalcular(trabId) {
    const t = remState.trabajadores.find(x => x.id === trabId);
    if (!t) return;
    const v = getBorrador(trabId);

    // Leer campos
    const getNum   = f => Number(document.getElementById(`remv-${trabId}-${f}`)?.value || 0);
    const getMonto = f => parseMonto(document.getElementById(`remv-${trabId}-${f}`)?.value || '0');
    const getSel   = f => document.getElementById(`remv-${trabId}-${f}`)?.value || '';

    v.horasSemanales    = getNum('horasSemanales') || 42;
    v.horasExtra        = getNum('horasExtra');
    v.ventasNetas       = getMonto('ventasNetas');
    v.pctComision       = parseFloat(document.getElementById(`remv-${trabId}-pctComision`)?.value || '0') || 0;
    v.comisiones        = getMonto('comisiones');
    v.participacion     = getMonto('participacion');
    v.tipoGratificacion = getSel('tipoGratificacion');
    v.gratifPactada     = getMonto('gratifPactada');
    v.colacion          = getMonto('colacion');
    v.movilizacion      = getMonto('movilizacion');
    v.numCargas         = getNum('numCargas');
    v.anticipos         = getMonto('anticipos');
    v.descPrestamo      = getMonto('descPrestamo');
    v.descOtros         = getMonto('descOtros');

    const liq    = calcularLiquidacion(t, remState.periodo, v);
    const panel  = document.getElementById(`rem-boleta-${trabId}`);
    if (panel) panel.innerHTML = remHtmlBoleta(liq, t);

    // Actualizar referencia valor hora extra
    const vhe    = v.horasSemanales > 0
        ? Math.round(t.sueldoBruto / (v.horasSemanales * 52 / 12) * 1.5) : 0;
    const hint   = document.querySelector(`#remv-${trabId}-horasExtra + .rem-fg-hint`);
    if (hint) hint.textContent = `Valor 1 h extra: ${fmt$(vhe)}`;
}

// ── Boleta ────────────────────────────────────────────────────
function remHtmlBoleta(liq, t) {
    const row  = (lbl, pct, monto, cls='') => `
      <div class="rem-bol-row">
        <span class="rem-bol-concepto">${lbl}</span>
        ${pct != null ? `<span class="rem-bol-pct">${pct}%</span>` : '<span></span>'}
        <span class="rem-bol-monto ${cls}">${fmt$(monto)}</span>
      </div>`;
    const rowD = (lbl, pct, monto) => `
      <div class="rem-bol-row">
        <span class="rem-bol-concepto">${lbl}</span>
        ${pct != null ? `<span class="rem-bol-pct">${pct}%</span>` : '<span></span>'}
        <span class="rem-bol-monto rem-neg">-${fmt$(monto)}</span>
      </div>`;
    const sub  = (lbl, monto, cls='') => `
      <div class="rem-bol-row rem-bol-sub">
        <span>${lbl}</span><span></span>
        <span class="rem-bol-monto ${cls}">${fmt$(monto)}</span>
      </div>`;

    const yaLiq = remState.liquidaciones.some(
        l => l.trabajadorId === liq.trabajadorId && l.periodo === liq.periodo);

    const labelGratif = {
        garantizada_con_tope: `Gratificación garantizada (25%, tope ${fmt$(REM.TOPE_GRATIF)})`,
        garantizada_sin_tope: 'Gratificación garantizada (25% sin tope)',
        pactada:              'Gratificación pactada',
        ninguna:              '',
    }[liq.tipoGratif] || 'Gratificación';

    return `
    <div class="rem-boleta">
      <div class="rem-bol-head">
        ${avatarHtml(liq.nombre, 44)}
        <div style="min-width:0;">
          <div style="font-size:15px;font-weight:800;color:#fff;">${liq.nombre}</div>
          <div style="font-size:12px;color:rgba(255,255,255,.5);margin-top:3px;">
            ${liq.rut||''}${liq.cargo?' · '+liq.cargo:''}${liq.tipoContrato?' · '+(liq.tipoContrato||'').replace('_',' '):''}
          </div>
        </div>
        <div style="text-align:right;white-space:nowrap;flex-shrink:0;">
          <div style="background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);border-radius:8px;
               padding:5px 14px;font-size:13px;font-weight:700;color:rgba(255,255,255,.9);">${fmtPeriodo(liq.periodo)}</div>
          <div style="font-size:10px;color:rgba(255,255,255,.35);margin-top:4px;text-transform:uppercase;letter-spacing:.05em;">Liquidación de sueldo</div>
        </div>
      </div>

      ${liq.bajoMinimo ? `<div class="rem-bol-alerta">⚠️ Sueldo bruto ${fmt$(liq.sueldoBase)} inferior al IMM (${fmt$(REM.IMM)}).</div>` : ''}

      <!-- REMUNERACIÓN IMPONIBLE -->
      <div class="rem-bol-sec-head">
        <span>Remuneración Imponible</span>
        <span>Base previsional: ${fmt$(liq.totalImponible)}</span>
      </div>
      ${row(`Sueldo base${liq.diasTrabajados<30?` (${liq.diasTrabajados} días)`:''}`, null, liq.sueldoBase, 'rem-pos')}
      ${liq.sobresueldo > 0 ? row(`Horas extraordinarias (${liq.horasExtra}h · ${liq.horasSemanales}h/sem · ×150%)`, null, liq.sobresueldo, 'rem-pos') : ''}
      ${liq.ventasNetas > 0 && liq.pctComision > 0
          ? row(`Comisiones (${liq.pctComision}% s/ ventas netas ${fmt$(liq.ventasNetas)})`, null, liq.comisiones, liq.comisiones > 0 ? 'rem-pos' : 'rem-muted')
          : row('Comisiones', null, liq.comisiones, liq.comisiones > 0 ? 'rem-pos' : 'rem-muted')}
      ${row('Participación', null, liq.participacion, liq.participacion > 0 ? 'rem-pos' : 'rem-muted')}
      ${liq.gratificacion > 0 ? row(labelGratif, null, liq.gratificacion, 'rem-pos') : ''}
      ${sub('Total remuneración imponible', liq.totalImponible)}

      <!-- HABERES NO IMPONIBLES -->
      <div class="rem-bol-sec-head">
        <span>Haberes No Imponibles</span>
        <span>No afectan cotizaciones previsionales</span>
      </div>
      ${row('Asignación de colación', null, liq.colacion, liq.colacion > 0 ? 'rem-pos' : 'rem-muted')}
      ${row('Asignación de movilización', null, liq.movilizacion, liq.movilizacion > 0 ? 'rem-pos' : 'rem-muted')}
      ${row(`Asignación familiar (${liq.numCargas} carga${liq.numCargas!==1?'s':''})`, null, liq.montoAsigFam, liq.montoAsigFam > 0 ? 'rem-pos' : 'rem-muted')}
      ${sub('Total haberes no imponibles', liq.colacion + liq.movilizacion + liq.montoAsigFam)}

      <!-- TOTAL HABERES -->
      <div class="rem-bol-sec-head" style="background:var(--positive-soft);color:var(--positive);">
        <span style="font-weight:800;">TOTAL HABERES</span>
        <span style="font-family:'Courier New',monospace;font-weight:800;">${fmt$(liq.totalHaberes)}</span>
      </div>

      <!-- DESCUENTOS -->
      <div class="rem-bol-sec-head">
        <span>Descuentos Legales</span>
        <span>Sobre base imponible: ${fmt$(liq.totalImponible)}</span>
      </div>
      ${rowD(`AFP ${t.afp||''}${liq.topeAfpAplicado ? ` (tope ${fmt$(liq.topeAfpClp)})` : ''}`, liq.afpTasa, liq.descAfp)}
      ${rowD(`Salud ${t.sistemaSalud||''}${liq.topeSalAplicado ? ` (tope ${fmt$(liq.topeSalClp)})` : ''}`, liq.saludPct, liq.descSalud)}
      ${rowD(`Cesantía trabajador${liq.topeCesAplicado ? ` (tope ${fmt$(liq.topeCesClp)})` : ''}`, 0.6, liq.descCesantia)}
      ${rowD('Impuesto Único 2° Categoría', null, liq.impUnico)}
      ${liq.descPrestamo > 0 ? rowD('Descuento préstamo empresa', null, liq.descPrestamo) : ''}
      ${liq.descOtros > 0    ? rowD('Otros descuentos', null, liq.descOtros) : ''}
      ${sub('Total descuentos', liq.totalDescuentos, 'rem-neg')}

      <!-- ALCANCE LÍQUIDO -->
      <div class="rem-bol-row rem-bol-sub" style="background:var(--positive-soft);">
        <span style="color:var(--positive);font-weight:700;">Alcance líquido</span>
        <span></span>
        <span class="rem-bol-monto rem-pos">${fmt$(liq.alcanceLiquido)}</span>
      </div>
      ${liq.anticipos > 0 ? `
      <div class="rem-bol-row">
        <span class="rem-bol-concepto">Anticipos de remuneraciones</span>
        <span></span>
        <span class="rem-bol-monto rem-neg">-${fmt$(liq.anticipos)}</span>
      </div>` : ''}

      <!-- SUELDO LÍQUIDO -->
      <div class="rem-total-liq" style="border-top:2px solid var(--divider);">
        <div class="rem-total-label">Sueldo Líquido a Pagar</div>
        <div class="rem-total-val">${fmt$(liq.liquido)}</div>
        <div class="rem-total-sub">Monto neto a depositar al trabajador</div>
        ${t.banco ? `<div style="font-size:11px;color:var(--positive);margin-top:6px;">🏦 ${t.banco}${t.sucursal?' · '+(t.sucursal||'').replace('_',' '):''}</div>` : ''}
      </div>

      <!-- APORTES PATRONALES -->
      <div class="rem-bol-sec-head" style="border-top:2px solid var(--divider);">
        <span>Aportes Patronales</span>
        <span>No descuentan del trabajador</span>
      </div>
      ${row('SIS — Seguro Invalidez y Sobrevivencia', null, liq.aportSis)}
      ${row('Seguro de cesantía empleador', 2.4, liq.aportCesantia)}
      ${row('Mutual de seguridad', 0.9, liq.aportMutual)}
      <div class="rem-bol-row rem-bol-sub" style="background:var(--negative-soft);">
        <span style="color:var(--negative);font-weight:700;">Costo total empleador</span>
        <span></span>
        <span class="rem-bol-monto rem-neg">${fmt$(liq.costoTotal)}</span>
      </div>

      <!-- ACCIONES -->
      <div class="rem-bol-actions">
        <button onclick="remImprimirBoleta('${liq.trabajadorId}','${liq.periodo}')"
          style="border:1px solid var(--divider);background:var(--input-bg);color:var(--text);
                 padding:10px 18px;border-radius:8px;font-size:14px;cursor:pointer;font-family:inherit;">
          🖨️ Imprimir / PDF
        </button>
        ${!yaLiq
            ? `<button class="btn btn-primary" style="padding:10px 22px;font-size:14px;"
                onclick="remGuardarLiquidacion('${liq.trabajadorId}')">
                💾 Guardar liquidación
               </button>`
            : `<button class="btn btn-primary" style="padding:10px 22px;font-size:14px;"
                onclick="remEnviarAsiento('${liq.trabajadorId}')">
                📒 Generar asiento contable
               </button>
               <span class="rem-badge rem-badge-ok" style="padding:9px 16px;font-size:13px;">✔ Guardada</span>`
        }
      </div>
    </div>`;
}

// ══════════════════════════════════════════════════════════════
// TAB: LIBRO
// ══════════════════════════════════════════════════════════════
function remHtmlLibro() {
    const { liquidaciones } = remState;
    if (!liquidaciones.length) return `
      <div class="rem-empty">
        <div class="rem-empty-icon">📋</div>
        <p>No hay liquidaciones procesadas aún.</p>
      </div>`;

    const periodos = [...new Set(liquidaciones.map(l => l.periodo))].sort().reverse();

    return periodos.map(p => {
        const liqP = liquidaciones.filter(l => l.periodo === p);
        const totB = liqP.reduce((a,l)=>a+l.sueldoBase,0);
        const totL = liqP.reduce((a,l)=>a+l.liquido,0);
        const totC = liqP.reduce((a,l)=>a+l.costoTotal,0);

        const filas = liqP.map(l => `<tr>
          <td>
            <div style="font-weight:600;font-size:14px;">${l.nombre}</div>
            <div style="font-size:11px;color:var(--text-muted);font-family:'Courier New',monospace;margin-top:2px;">${l.rut||''}</div>
          </td>
          <td style="color:var(--text-muted);font-size:13px;">${l.cargo||'—'}</td>
          <td style="text-align:right;font-family:'Courier New',monospace;">${fmt$(l.sueldoBase)}</td>
          <td style="text-align:right;color:var(--negative);font-family:'Courier New',monospace;">-${fmt$(l.descAfp)}</td>
          <td style="text-align:right;color:var(--negative);font-family:'Courier New',monospace;">-${fmt$(l.descSalud)}</td>
          <td style="text-align:right;color:var(--negative);font-family:'Courier New',monospace;">-${fmt$(l.descCesantia)}</td>
          <td style="text-align:right;color:var(--negative);font-family:'Courier New',monospace;">-${fmt$(l.impUnico)}</td>
          <td style="text-align:right;color:var(--positive);font-weight:600;font-family:'Courier New',monospace;">${fmt$(l.liquido)}</td>
          <td style="text-align:right;color:var(--negative);font-weight:600;font-family:'Courier New',monospace;">${fmt$(l.costoTotal)}</td>
        </tr>`).join('');

        return `
        <div class="rem-periodo-card">
          <div class="rem-periodo-head">
            <div style="display:flex;align-items:center;gap:10px;font-weight:700;font-size:15px;">
              📅 ${fmtPeriodo(p)}
              <span class="rem-badge rem-badge-info">${liqP.length} trabajadores</span>
            </div>
            <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
              <span style="font-size:13px;color:var(--text-muted);">Bruto: <strong style="color:var(--text)">${fmt$(totB)}</strong></span>
              <span style="font-size:13px;color:var(--text-muted);">Líquido: <strong style="color:var(--positive)">${fmt$(totL)}</strong></span>
              <span style="font-size:13px;color:var(--text-muted);">Costo emp.: <strong style="color:var(--negative)">${fmt$(totC)}</strong></span>
              <div style="display:flex;gap:8px;">
                <button onclick="remLibroPDF('${p}')"
                  style="padding:7px 14px;font-size:13px;border:1px solid var(--divider);background:var(--input-bg);border-radius:7px;cursor:pointer;color:var(--text);font-family:inherit;">
                  🖨️ PDF
                </button>
                <button class="btn btn-primary" onclick="remPreviredCSV('${p}')"
                  style="padding:7px 14px;font-size:13px;">
                  ⬇️ Previred CSV
                </button>
              </div>
            </div>
          </div>
          <div class="rem-tabla-wrap" style="border-radius:0 0 12px 12px;border:none;box-shadow:none;">
            <table class="rem-tabla">
              <thead>
                <tr>
                  <th>Trabajador</th><th>Cargo</th>
                  <th style="text-align:right;">Bruto</th><th style="text-align:right;">AFP</th>
                  <th style="text-align:right;">Salud</th><th style="text-align:right;">Cesantía</th>
                  <th style="text-align:right;">Imp. Único</th><th style="text-align:right;">Líquido</th>
                  <th style="text-align:right;">Costo Emp.</th>
                </tr>
              </thead>
              <tbody>${filas}</tbody>
              <tfoot>
                <tr>
                  <td colspan="2" style="font-weight:700;">TOTALES</td>
                  <td style="text-align:right;font-weight:700;">${fmt$(totB)}</td>
                  <td colspan="4"></td>
                  <td style="text-align:right;font-weight:700;color:var(--positive);">${fmt$(totL)}</td>
                  <td style="text-align:right;font-weight:700;color:var(--negative);">${fmt$(totC)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>`;
    }).join('');
}

// ══════════════════════════════════════════════════════════════
// TAB: IA
// ══════════════════════════════════════════════════════════════
function remHtmlIA() {
    const { liquidaciones, periodo } = remState;
    const liqPer = liquidaciones.filter(l => l.periodo === periodo);
    return `
    <div class="rem-ia-banner">
      <div style="font-size:26px;flex-shrink:0;">✨</div>
      <div>
        <div style="font-weight:700;font-size:15px;color:var(--accent);margin-bottom:5px;">Auditoría IA — ${fmtPeriodo(periodo)}</div>
        <div style="font-size:14px;color:var(--text);line-height:1.6;">
          Verifica las liquidaciones del período en busca de errores legales, tasas incorrectas y problemas antes de enviar a Previred.
        </div>
      </div>
    </div>
    <div class="rem-toolbar">
      <button class="btn btn-primary" style="padding:10px 20px;font-size:14px;"
        onclick="remAnalizarIA()" ${!liqPer.length?'disabled':''}>
        ✨ Analizar liquidaciones
      </button>
      <button onclick="remVerificarPrevired()"
        style="padding:10px 20px;font-size:14px;border:1px solid var(--divider);background:var(--input-bg);
               color:var(--text);border-radius:8px;cursor:pointer;font-family:inherit;"
        ${!liqPer.length?'disabled':''}>
        ⚖ Verificar planilla Previred
      </button>
      ${!liqPer.length?'<span class="rem-badge rem-badge-warn">Sin liquidaciones en este período</span>':''}
    </div>
    <div id="rem-ia-resultado"></div>`;
}

// ══════════════════════════════════════════════════════════════
// MODAL FICHA TRABAJADOR — 4 secciones (sin Remuneración)
// ══════════════════════════════════════════════════════════════
function remHtmlModal() {
    const t   = remState.modalData;
    const sec = remState.modalSeccion;

    const AFPS = ['Capital','Cuprum','Habitat','PlanVital','ProVida','Modelo','Uno'];
    const SECCIONES = [
        ['identidad','Identificación'],
        ['contrato','Contrato'],
        ['prevision','Previsión'],
        ['banco','Pago y Banco'],
    ];

    const txtInp = (id, label, val, extra='') => `
      <div class="rem-fg">
        <label class="rem-fg-label">${label}</label>
        <input id="rem-f-${id}" type="text" value="${(val||'').toString().replace(/"/g,'&quot;')}"
          class="rem-input" ${extra}>
      </div>`;

    const montoInp = (id, label, val, hint='') => `
      <div class="rem-fg">
        <label class="rem-fg-label">${label}</label>
        <input id="rem-f-${id}" type="text" inputmode="numeric"
          value="${Number(val||0).toLocaleString('es-CL')}"
          class="rem-input" oninput="remFmtMonto(this)" style="font-family:'Courier New',monospace;">
        ${hint?`<span class="rem-fg-hint">${hint}</span>`:''}
      </div>`;

    const selInp = (id, label, opts, val, hint='') => `
      <div class="rem-fg">
        <label class="rem-fg-label">${label}</label>
        <select id="rem-f-${id}" class="rem-select">
          ${opts.map(([v,l])=>`<option value="${v}" ${v===val?'selected':''}>${l}</option>`).join('')}
        </select>
        ${hint?`<span class="rem-fg-hint">${hint}</span>`:''}
      </div>`;

    const colorAv = t.nombre ? avatarColor(t.nombre) : '#94a3b8';
    const iniAv   = t.nombre ? iniciales(t.nombre) : '?';

    const tabNav = SECCIONES.map(([id,lbl]) =>
        `<button type="button" class="rem-form-tab${sec===id?' active':''}"
          onclick="remModalSec('${id}')">${lbl}</button>`).join('');

    let cuerpo = '';

    if (sec === 'identidad') cuerpo = `
      <div class="rem-form-grid">
        <div class="rem-fg">
          <label class="rem-fg-label">RUT *</label>
          <input id="rem-f-rut" type="text" value="${(t.rut||'').replace(/"/g,'&quot;')}"
            class="rem-input" placeholder="12.345.678-9"
            oninput="remFmtRutInp(this)" style="font-family:'Courier New',monospace;">
        </div>
        <div class="rem-fg">
          <label class="rem-fg-label">Cargo / Puesto</label>
          <input id="rem-f-cargo" type="text" value="${(t.cargo||'').replace(/"/g,'&quot;')}"
            class="rem-input" placeholder="Vendedor, Contador…">
        </div>
        <div class="rem-fg" style="grid-column:1/-1">
          <label class="rem-fg-label">Nombre completo *</label>
          <input id="rem-f-nombre" type="text" value="${(t.nombre||'').replace(/"/g,'&quot;')}"
            class="rem-input" placeholder="Juan Pérez González"
            oninput="remActualizarAvatar(this.value)">
        </div>
        ${txtInp('email','Email',t.email,'type="email" placeholder="nombre@empresa.cl"')}
        ${txtInp('telefono','Teléfono',t.telefono,'placeholder="+56 9 1234 5678"')}
        <div class="rem-fg" style="grid-column:1/-1">
          <label class="rem-fg-label">Dirección</label>
          <input id="rem-f-direccion" type="text" value="${(t.direccion||'').replace(/"/g,'&quot;')}"
            class="rem-input" placeholder="Av. Ejemplo 123, Santiago">
        </div>
      </div>`;

    else if (sec === 'contrato') cuerpo = `
      <div class="rem-form-grid">
        ${montoInp('sueldoBruto','Sueldo bruto base *',t.sueldoBruto||0,
            `IMM vigente: ${fmt$(REM.IMM)}`)}
        <div class="rem-fg">
          <label class="rem-fg-label">Días trabajados / mes</label>
          <input id="rem-f-diasTrabajados" type="number" value="${t.diasTrabajados||30}"
            class="rem-input" min="1" max="30">
          <span class="rem-fg-hint">Base 30 días.</span>
        </div>
        ${selInp('tipoContrato','Tipo de contrato',[
            ['indefinido','Indefinido'],['plazo_fijo','Plazo Fijo'],
            ['obra_faena','Obra o Faena'],['part_time','Part Time'],
          ], t.tipoContrato||'indefinido')}
        ${txtInp('fechaIngreso','Fecha de ingreso',t.fechaIngreso,'type="date"')}
        ${(t.tipoContrato && t.tipoContrato !== 'indefinido')
            ? txtInp('fechaTermino','Fecha de término',t.fechaTermino||'','type="date"') : ''}
      </div>
      <div class="rem-form-divider">Documento de contrato (PDF / imagen, máx. 5 MB)</div>
      ${t.contrato
          ? `<div class="rem-contrato-adjunto">
               <span style="font-size:24px;">📎</span>
               <div style="flex:1;min-width:0;">
                 <div style="font-weight:600;font-size:14px;">${t.contratoNombre||'Contrato adjunto'}</div>
               </div>
               <button type="button" onclick="window.open(remState.modalData.contrato,'_blank')"
                 style="padding:7px 14px;font-size:13px;border:1px solid var(--divider);background:var(--input-bg);border-radius:7px;cursor:pointer;">Ver</button>
               <button type="button" onclick="remQuitarContrato()"
                 style="padding:7px 14px;font-size:13px;border:1px solid #fca5a5;background:var(--negative-soft);border-radius:7px;cursor:pointer;">Quitar</button>
             </div>`
          : `<div class="rem-drop-zone" onclick="document.getElementById('rem-file-contrato').click()">
               <input id="rem-file-contrato" type="file" accept=".pdf,.jpg,.jpeg,.png"
                 onchange="remAdjuntarContrato(this)" style="display:none;">
               <div style="font-size:28px;margin-bottom:8px;">📄</div>
               <div style="font-weight:600;font-size:14px;color:var(--text);">Arrastra o haz clic para adjuntar</div>
               <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">PDF, JPG o PNG — máx. 5 MB</div>
             </div>`
      }`;

    else if (sec === 'prevision') cuerpo = `
      <div class="rem-form-grid">
        ${selInp('afp','AFP', AFPS.map(a=>[a,a]), t.afp||'Habitat',
              `Tasa vigente: ${REM.TASAS_AFP[t.afp||'Habitat']}%`)}
        ${selInp('sistemaSalud','Sistema de salud',[['Fonasa','Fonasa'],['Isapre','Isapre']],t.sistemaSalud||'Fonasa')}
        <div class="rem-fg">
          <label class="rem-fg-label">% Cotización salud</label>
          <input id="rem-f-saludPorcentaje" type="number" value="${t.saludPorcentaje||7}"
            class="rem-input" min="7" max="20" step="0.1">
          <span class="rem-fg-hint">Mínimo legal: 7% (Fonasa).</span>
        </div>
        ${selInp('jornada','Tipo de jornada',[['completa','Completa (42h semanales)'],['parcial','Parcial']],t.jornada||'completa')}
        <div style="grid-column:1/-1;background:var(--table-stripe);border-radius:8px;
                    padding:12px 16px;font-size:12px;color:var(--text-muted);line-height:1.6;">
          <strong style="color:var(--text);">Aportes patronales (referencia):</strong><br>
          AFP empleador + SIS: 2.98% · Cesantía empleador: 2.4% · Mutual: 0.9%
        </div>
      </div>`;

    else if (sec === 'banco') cuerpo = `
      <div class="rem-form-grid">
        ${selInp('banco','Banco',[
            ['','Seleccionar…'],
            ...['BancoEstado','Banco de Chile','Santander','BCI','Scotiabank','Itaú','BICE','Security','Falabella','Ripley','HSBC'].map(b=>[b,b])
          ], t.banco||'')}
        ${selInp('sucursal','Tipo de cuenta',[
            ['','Seleccionar…'],
            ['corriente','Cuenta Corriente'],['vista','Cuenta Vista / RUT'],['ahorro','Cuenta de Ahorro'],
          ], t.sucursal||'')}
        ${txtInp('cuentaBancaria','N° de cuenta',t.cuentaBancaria,'placeholder="0000000000"')}
      </div>`;

    return `
    <div id="rem-modal"
      style="position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:5000;
             display:flex;align-items:center;justify-content:center;padding:16px;"
      onclick="if(event.target===this) remCerrarModal()">
      <div style="background:var(--card);border-radius:14px;box-shadow:var(--shadow-lg);
                  max-width:780px;width:100%;max-height:92vh;overflow-y:auto;">
        <div style="padding:18px 24px;border-bottom:1px solid var(--divider);display:flex;
                    align-items:center;justify-content:space-between;font-size:16px;font-weight:700;
                    position:sticky;top:0;background:var(--card);z-index:1;">
          <span>${t.id?'Editar trabajador':'Nuevo trabajador'}</span>
          <button onclick="remCerrarModal()"
            style="border:1px solid var(--divider);background:var(--input-bg);border-radius:6px;
                   padding:5px 12px;cursor:pointer;font-size:14px;font-family:inherit;">✕ Cerrar</button>
        </div>
        <div style="padding:24px;">
          <div style="display:flex;align-items:center;gap:18px;margin-bottom:22px;
                      padding-bottom:18px;border-bottom:1px solid var(--divider);">
            <div id="rem-modal-avatar" class="rem-avatar"
              style="background:${colorAv};width:56px;height:56px;font-size:20px;flex-shrink:0;">
              ${iniAv}
            </div>
            <div>
              <div id="rem-modal-nombre" style="font-size:16px;font-weight:700;color:var(--text);">
                ${t.nombre||(t.id?'Editar trabajador':'Nuevo trabajador')}
              </div>
              <div style="font-size:12px;color:var(--text-muted);margin-top:3px;">
                ${t.cargo||'Sin cargo asignado'}${t.rut?' · '+t.rut:''}
              </div>
            </div>
          </div>
          <div class="rem-form-tabs">${tabNav}</div>
          <div id="rem-modal-cuerpo">${cuerpo}</div>
          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:28px;
                      padding-top:18px;border-top:1px solid var(--divider);">
            <button type="button" onclick="remCerrarModal()"
              style="padding:10px 20px;font-size:14px;border:1px solid var(--divider);
                     background:var(--input-bg);border-radius:8px;cursor:pointer;
                     color:var(--text);font-family:inherit;">Cancelar</button>
            <button type="button" class="btn btn-primary" onclick="remGuardarTrab()"
              style="padding:10px 22px;font-size:14px;">
              💾 ${t.id?'Guardar cambios':'Crear trabajador'}
            </button>
          </div>
        </div>
      </div>
    </div>`;
}

// ══════════════════════════════════════════════════════════════
// ACCIONES
// ══════════════════════════════════════════════════════════════
function remSetTab(tab) {
    remState.tab = tab;
    remState.trabSelId = null;
    remRefreshBody();
    document.querySelectorAll('.rem-tab').forEach(b => {
        const map = { trabajadores:'👤', liquidar:'💵', libro:'📋', ia:'✨' };
        b.classList.toggle('active', b.textContent.trim().startsWith(map[tab]||''));
    });
}

function remSetPeriodo(p) { remState.periodo = p; remState.trabSelId = null; remRefreshBody(); }
function remBuscar(v)     { remState.buscar = v; remRefreshBody(); }

function remSelTrab(id) {
    remState.trabSelId = id;
    const panel = document.getElementById('rem-liq-panel');
    if (panel) {
        const t = remState.trabajadores.find(x => x.id === id);
        panel.innerHTML = t ? remHtmlVarsYBoleta(t)
            : `<div class="rem-empty"><div class="rem-empty-icon">👈</div><p>Selecciona un trabajador</p></div>`;
    }
    document.querySelectorAll('.rem-worker-item').forEach(el => el.classList.remove('sel'));
    event?.currentTarget?.classList?.add('sel');
}

function remAbrirModal(id) {
    if (id) {
        const t = remState.trabajadores.find(x => x.id === id);
        remState.modalData = t ? {...t} : {};
    } else {
        remState.modalData = {
            rut:'', nombre:'', cargo:'', fechaIngreso:'', fechaTermino:'',
            tipoContrato:'indefinido', jornada:'completa',
            sueldoBruto:0, diasTrabajados:30,
            afp:'Habitat', sistemaSalud:'Fonasa', saludPorcentaje:7,
            banco:'', sucursal:'', cuentaBancaria:'',
            email:'', telefono:'', direccion:'',
            contrato:null, contratoNombre:'',
        };
    }
    remState.modalSeccion = 'identidad';
    _renderModal();
}

function remCerrarModal() {
    remState.modalData = null;
    const m = document.getElementById('rem-modal');
    if (m) m.remove();
}

function remModalSec(sec) {
    _recogerFormulario();
    remState.modalSeccion = sec;
    _renderModal();
}

function _renderModal() {
    const old = document.getElementById('rem-modal');
    if (old) old.remove();
    const tmp = document.createElement('div');
    tmp.innerHTML = remHtmlModal();
    document.body.appendChild(tmp.firstElementChild);
}

function remActualizarAvatar(nombre) {
    remState.modalData = remState.modalData || {};
    remState.modalData.nombre = nombre;
    const av = document.getElementById('rem-modal-avatar');
    const nm = document.getElementById('rem-modal-nombre');
    if (av) { av.style.background = nombre ? avatarColor(nombre) : '#94a3b8'; av.textContent = nombre ? iniciales(nombre) : '?'; }
    if (nm) nm.textContent = nombre || 'Nuevo trabajador';
}

function remQuitarContrato() {
    remState.modalData.contrato = null; remState.modalData.contratoNombre = '';
    _renderModal();
}

function remAdjuntarContrato(inp) {
    const file = inp.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { mostrarToast('El archivo no debe superar 5 MB.', 'error'); return; }
    const reader = new FileReader();
    reader.onload = ev => {
        remState.modalData.contrato = ev.target.result;
        remState.modalData.contratoNombre = file.name;
        _renderModal();
    };
    reader.readAsDataURL(file);
}

const CAMPOS_MONTO_MODAL = ['sueldoBruto'];
const CAMPOS_NUM_MODAL   = ['diasTrabajados','saludPorcentaje'];

function _recogerFormulario() {
    const g = id => document.getElementById('rem-f-' + id);
    const todos = ['rut','nombre','cargo','email','telefono','direccion',
                   ...CAMPOS_MONTO_MODAL, ...CAMPOS_NUM_MODAL,
                   'afp','sistemaSalud','jornada','banco','sucursal','cuentaBancaria',
                   'tipoContrato','fechaIngreso','fechaTermino'];
    todos.forEach(f => {
        const el = g(f);
        if (!el) return;
        if (CAMPOS_MONTO_MODAL.includes(f)) remState.modalData[f] = parseMonto(el.value);
        else if (CAMPOS_NUM_MODAL.includes(f)) remState.modalData[f] = Number(el.value);
        else remState.modalData[f] = el.value;
    });
}

function remGuardarTrab() {
    _recogerFormulario();
    const t = remState.modalData;
    if (!t.nombre?.trim())  { mostrarToast('Ingresa el nombre del trabajador.', 'error'); return; }
    if (!t.rut?.trim())     { mostrarToast('Ingresa el RUT del trabajador.', 'error'); return; }
    if (!t.sueldoBruto || t.sueldoBruto <= 0) { mostrarToast('Ingresa el sueldo bruto en la pestaña Contrato.', 'error'); return; }

    let arr = remState.trabajadores;
    if (t.id && arr.some(x => x.id === t.id)) {
        arr = arr.map(x => x.id === t.id ? {...t} : x);
    } else {
        arr = [...arr, {...t, id: Date.now().toString()}];
    }
    saveTrab(arr);
    remState.trabajadores = arr;
    remCerrarModal();
    remRefreshBody();
}

function remEliminar(id) {
    mostrarConfirm('¿Eliminar este trabajador? Esta acción no se puede deshacer.', () => {
        remState.trabajadores = remState.trabajadores.filter(t => t.id !== id);
        if (remState.trabSelId === id) remState.trabSelId = null;
        saveTrab(remState.trabajadores);
        remRefreshBody();
    }, { titulo: 'Eliminar trabajador', textoBtn: 'Sí, eliminar' });
}

function remGuardarLiquidacion(trabId) {
    const t = remState.trabajadores.find(x => x.id === trabId);
    if (!t) return;
    const v   = getBorrador(trabId);
    const liq = calcularLiquidacion(t, remState.periodo, v);
    remState.liquidaciones = [...remState.liquidaciones, liq];
    saveLiqs(remState.liquidaciones);
    // Refrescar solo la boleta sin destruir el panel de variables
    const bPanel = document.getElementById(`rem-boleta-${trabId}`);
    if (bPanel) bPanel.innerHTML = remHtmlBoleta(liq, t);
    _actualizarKPIs();
}

function remLiquidarTodos() {
    const yaExisten = new Set(
        remState.liquidaciones.filter(l => l.periodo === remState.periodo).map(l => l.trabajadorId));
    const nuevas = remState.trabajadores
        .filter(t => !yaExisten.has(t.id))
        .map(t => calcularLiquidacion(t, remState.periodo, getBorrador(t.id)));
    if (!nuevas.length) { mostrarToast('Todos los trabajadores ya fueron liquidados en este período.', 'error'); return; }
    remState.liquidaciones = [...remState.liquidaciones, ...nuevas];
    saveLiqs(remState.liquidaciones);
    remRefreshBody();
}

// Garantiza que una cuenta exista en el plan; la crea si no está.
function _remEnsureCuenta(nombre, tipo, grupo, orden) {
    if (!window.PLAN_CUENTAS || window.PLAN_CUENTAS[nombre]) return;
    window.PLAN_CUENTAS[nombre] = {
        tipo, grupo, orden,
        naturaleza: (tipo === 'Pérdida' || tipo === 'Activo') ? 'Debe' : 'Haber',
        codigo: '', estado: 'ACTIVA', editable: true,
    };
    if (typeof guardarPlanCuentas === 'function') guardarPlanCuentas();
}

function remEnviarAsiento(trabId) {
    const t = remState.trabajadores.find(x => x.id === trabId);
    if (!t) return;

    // Leer inputs del formulario en pantalla (igual que remRecalcular)
    // para garantizar que los valores mostrados en la boleta son los que se contabilizan.
    const getNum   = f => Number(document.getElementById(`remv-${trabId}-${f}`)?.value || 0);
    const getMonto = f => parseMonto(document.getElementById(`remv-${trabId}-${f}`)?.value || '0');
    const getSel   = f => document.getElementById(`remv-${trabId}-${f}`)?.value || '';
    const v = getBorrador(trabId);
    if (document.getElementById(`remv-${trabId}-horasSemanales`)) {
        v.horasSemanales    = getNum('horasSemanales') || 42;
        v.horasExtra        = getNum('horasExtra');
        v.comisiones        = getMonto('comisiones');
        v.participacion     = getMonto('participacion');
        v.tipoGratificacion = getSel('tipoGratificacion') || 'garantizada_con_tope';
        v.gratifPactada     = getMonto('gratifPactada');
        v.colacion          = getMonto('colacion');
        v.movilizacion      = getMonto('movilizacion');
        v.numCargas         = getNum('numCargas');
        v.anticipos         = getMonto('anticipos');
        v.descPrestamo      = getMonto('descPrestamo');
        v.descOtros         = getMonto('descOtros');
    }

    // sueldoBruto puede estar guardado como string formateado en localStorage antiguo
    const sueldoBruto = parseMonto(String(t.sueldoBruto)) || Number(t.sueldoBruto) || 0;
    const liq = calcularLiquidacion({ ...t, sueldoBruto }, remState.periodo, v);

    try {
        const [y, m] = remState.periodo.split('-');
        const ultimo = new Date(parseInt(y), parseInt(m), 0).getDate();
        const fecha  = ultimo.toString().padStart(2,'0') + '/' + m + '/' + y;

        // Formato { cuenta, debe, haber } — requerido por contabilidad.js y diario.js
        const d = (cuenta, monto) => ({ cuenta, debe: Math.round(monto), haber: 0 });
        const h = (cuenta, monto) => ({ cuenta, debe: 0, haber: Math.round(monto) });

        // Nombres dinámicos de AFP y sistema de salud del trabajador
        const nombreAfp   = liq.afp        || 'AFP';
        const nombreSalud = t.sistemaSalud || 'Fonasa';

        // Asegurar que todas las cuentas usadas existan en el plan de cuentas
        const PC = 'Pasivo Circulante';
        const GA = 'Pérdidas';
        _remEnsureCuenta('Gasto Remuneraciones',               'Pérdida', GA,  520);
        _remEnsureCuenta('Gasto Leyes Sociales',               'Pérdida', GA,  521);
        _remEnsureCuenta(`AFP ${nombreAfp} por pagar`,         'Pasivo',  PC,  210);
        _remEnsureCuenta(`Salud ${nombreSalud} por pagar`,     'Pasivo',  PC,  220);
        _remEnsureCuenta('Seguro Cesantía por pagar',          'Pasivo',  PC,  230);
        _remEnsureCuenta('SIS por pagar',                      'Pasivo',  PC,  231);
        _remEnsureCuenta('Seguro Cesantía Empleador por pagar','Pasivo',  PC,  232);
        _remEnsureCuenta('Mutual por pagar',                   'Pasivo',  PC,  233);
        _remEnsureCuenta('Impuesto Único por pagar',           'Pasivo',  PC,  234);
        _remEnsureCuenta('Descuentos por pagar',               'Pasivo',  PC,  235);
        _remEnsureCuenta('Anticipos de Remuneraciones',        'Activo',  'Activo Circulante', 11);

        // Leyes sociales empleador: SIS + Cesantía empleador + Mutual
        const leyesSociales = liq.aportSis + liq.aportCesantia + liq.aportMutual;

        // DEBE: Gasto Remuneraciones = total bruto recibido por el trabajador
        //       (imponible + no imponibles = totalHaberes)
        // DEBE: Gasto Leyes Sociales = obligaciones patronales
        // HABER: cuentas por pagar individuales + Banco (líquido)
        // El asiento cuadra: totalHaberes + leyesSociales = Σ HABER
        const movs = [
            d('Gasto Remuneraciones',               liq.totalHaberes),
            d('Gasto Leyes Sociales',               leyesSociales),
            h(`AFP ${nombreAfp} por pagar`,          liq.descAfp),
            h(`Salud ${nombreSalud} por pagar`,      liq.descSalud),
            h('Seguro Cesantía por pagar',           liq.descCesantia),
            h('SIS por pagar',                       liq.aportSis),
            h('Seguro Cesantía Empleador por pagar', liq.aportCesantia),
            h('Mutual por pagar',                    liq.aportMutual),
        ];
        if (liq.impUnico > 0)
            movs.push(h('Impuesto Único por pagar',      liq.impUnico));
        if (liq.descPrestamo + liq.descOtros > 0)
            movs.push(h('Descuentos por pagar',          liq.descPrestamo + liq.descOtros));
        if (liq.anticipos > 0)
            movs.push(h('Anticipos de Remuneraciones',   liq.anticipos));
        movs.push(h('Banco',                             liq.liquido));

        // Persistir en localStorage
        const arr = JSON.parse(localStorage.getItem('core_asientos') || '[]');
        const _nums = arr.map(a => a.numero).filter(n => typeof n === 'number' && !isNaN(n) && isFinite(n));
        const _nextNum = _nums.length ? Math.max(..._nums) + 1 : 1;
        arr.push({
            id: Date.now(), numero: _nextNum, fecha, tipo: 'remuneraciones',
            glosa: `Remuneraciones ${liq.nombre} ${remState.periodo}`,
            movimientos: movs, estado: 'ACTIVO',
        });
        localStorage.setItem('core_asientos', JSON.stringify(arr));

        // Sincronizar array en memoria y refrescar vista sin recargar
        if (window.dbAsientos) {
            window.dbAsientos.length = 0;
            arr.forEach(a => window.dbAsientos.push(a));
        }
        if (typeof renderHistorialDiario === 'function') renderHistorialDiario();

        mostrarToast('Asiento de remuneraciones generado correctamente.', 'ok');
    } catch(e) { console.error(e); mostrarToast('Error al generar el asiento.', 'err'); }
}

function remAnalizarIA() {
    const liqPer = remState.liquidaciones.filter(l => l.periodo === remState.periodo);
    const alertas = [];
    liqPer.forEach(liq => {
        if (liq.bajoMinimo)
            alertas.push({ tipo:'error', nombre:liq.nombre, msg:`Sueldo ${fmt$(liq.sueldoBase)} bajo el IMM (${fmt$(REM.IMM)}).` });
        const tasaEsp  = REM.TASAS_AFP[liq.afp] || 10;
        const tasaReal = liq.totalImponible > 0 ? (liq.descAfp/liq.totalImponible)*100 : 0;
        if (Math.abs(tasaReal - tasaEsp) > 0.5)
            alertas.push({ tipo:'warning', nombre:liq.nombre, msg:`AFP: tasa aplicada ${tasaReal.toFixed(2)}% difiere de tabla (${tasaEsp}%).` });
        const saludReal = liq.totalImponible > 0 ? (liq.descSalud/liq.totalImponible)*100 : 0;
        if (saludReal < 6.99)
            alertas.push({ tipo:'warning', nombre:liq.nombre, msg:`Salud: ${saludReal.toFixed(2)}% — mínimo legal 7%.` });
        if (liq.liquido < 0)
            alertas.push({ tipo:'error', nombre:liq.nombre, msg:`Sueldo líquido negativo (${fmt$(liq.liquido)}).` });
    });
    const cont = document.getElementById('rem-ia-resultado');
    if (!cont) return;
    if (!alertas.length) {
        cont.innerHTML = `<div style="display:flex;align-items:center;gap:12px;padding:16px 20px;
          background:var(--positive-soft);border:1.5px solid var(--positive);border-radius:12px;
          color:var(--positive);font-weight:600;font-size:14px;margin-top:16px;">
          <span style="font-size:24px;">✅</span>No se detectaron errores.</div>`;
        return;
    }
    cont.innerHTML = `
      <div style="background:var(--card);border:1px solid var(--card-border);border-radius:12px;padding:20px;margin-top:16px;">
        <div style="font-weight:700;font-size:14px;margin-bottom:14px;">⚠️ Alertas
          <span class="rem-badge rem-badge-warn" style="margin-left:8px;">${alertas.length}</span>
        </div>
        ${alertas.map(a=>`
          <div style="display:flex;align-items:flex-start;gap:12px;padding:12px 16px;border-radius:10px;
               margin-bottom:10px;font-size:14px;border-left:4px solid;
               background:${a.tipo==='error'?'var(--negative-soft)':'var(--warning-soft)'};
               border-color:${a.tipo==='error'?'var(--negative)':'var(--warning)'};">
            <span>${a.tipo==='error'?'🔴':'🟡'}</span>
            <span><strong>${a.nombre}:</strong> ${a.msg}</span>
          </div>`).join('')}
      </div>`;
}

function remVerificarPrevired() {
    const liqPer = remState.liquidaciones.filter(l => l.periodo === remState.periodo);
    const issues = [];
    liqPer.forEach(l => {
        if (!l.rut) issues.push(`${l.nombre}: falta RUT`);
        if (l.totalImponible <= 0) issues.push(`${l.nombre}: sueldo imponible inválido`);
    });
    if (issues.length) {
        mostrarToast('Problemas: ' + issues.join(' | '), 'error');
    } else {
        mostrarToast('Planilla Previred verificada — sin errores.', 'ok');
    }
}

function remPreviredCSV(periodo) {
    const liqP  = remState.liquidaciones.filter(l => l.periodo === periodo);
    const header = 'RUT_TRABAJADOR;NOMBRE;AFP;MONTO_AFP_TRABAJADOR;MONTO_AFP_EMPLEADOR;SISTEMA_SALUD;MONTO_SALUD;CESANTIA_TRABAJADOR;CESANTIA_EMPLEADOR;SIS;MUTUAL;SUELDO_IMPONIBLE;SUELDO_LIQUIDO';
    const filas  = liqP.map(l =>
        [l.rut,l.nombre,l.afp,l.descAfp,l.aportAfp,l.sistemaSalud,l.descSalud,
         l.descCesantia,l.aportCesantia,l.aportSis,l.aportMutual,l.totalImponible,l.liquido].join(';'));
    const blob = new Blob([[header,...filas].join('\n')], {type:'text/csv;charset=utf-8;'});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `previred_${periodo}.csv`; a.click();
    URL.revokeObjectURL(url);
}

function remLibroPDF(periodo) {
    const liqP = remState.liquidaciones.filter(l => l.periodo === periodo);
    const totB = liqP.reduce((a,l)=>a+l.sueldoBase,0);
    const totL = liqP.reduce((a,l)=>a+l.liquido,0);
    const totC = liqP.reduce((a,l)=>a+l.costoTotal,0);
    const filas = liqP.map(l =>
        `<tr><td>${l.rut||''}</td><td>${l.nombre}</td><td>${l.cargo||'—'}</td>
         <td class="r">${fmt$(l.sueldoBase)}</td>
         <td class="r neg">-${fmt$(l.descAfp)}</td><td class="r neg">-${fmt$(l.descSalud)}</td>
         <td class="r neg">-${fmt$(l.impUnico)}</td>
         <td class="r pos">${fmt$(l.liquido)}</td>
         <td class="r" style="color:#dc2626">${fmt$(l.costoTotal)}</td></tr>`
    ).join('');
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<title>Libro Remuneraciones ${periodo}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:11px;color:#111;padding:24px}
h2{font-size:17px;color:#1e3a8a;margin-bottom:3px}.sub{color:#64748b;margin-bottom:18px;font-size:11px}
table{width:100%;border-collapse:collapse}th{background:#f1f5f9;padding:7px 9px;border:1px solid #e2e8f0;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.4px}
td{padding:7px 9px;border:1px solid #e2e8f0}.r{text-align:right}.pos{color:#16a34a;font-weight:700}.neg{color:#dc2626}
.total{font-weight:700;background:#f8fafc}</style>
</head><body>
<h2>Libro de Remuneraciones</h2>
<div class="sub">Período: ${fmtPeriodo(periodo)} · ${liqP.length} trabajadores · IMM: ${fmt$(REM.IMM)}</div>
<table><thead><tr><th>RUT</th><th>Nombre</th><th>Cargo</th><th>Bruto</th><th>AFP</th><th>Salud</th><th>Imp. Único</th><th>Líquido</th><th>Costo Emp.</th></tr></thead>
<tbody>${filas}</tbody>
<tfoot><tr class="total"><td colspan="3">TOTALES</td>
<td class="r">${fmt$(totB)}</td><td></td><td></td><td></td>
<td class="r pos">${fmt$(totL)}</td><td class="r neg">${fmt$(totC)}</td></tr></tfoot>
</table></body></html>`;
    const w = window.open('', '_blank', 'width=960,height=760');
    if (w) { w.document.write(html); w.document.close(); w.print(); }
}

function remImprimirBoleta(trabId, periodo) {
    const t = remState.trabajadores.find(x => x.id === trabId);
    if (!t) return;
    const liq = remState.liquidaciones.find(l => l.trabajadorId === trabId && l.periodo === periodo)
             || calcularLiquidacion(t, periodo, getBorrador(trabId));
    const empresa = JSON.parse(localStorage.getItem('core_config')||'{}').empresa || 'Empresa';
    const w = window.open('', '_blank', 'width=780,height=900');
    if (w) { w.document.write(remBuildPDF(liq, t, empresa)); w.document.close(); w.print(); }
}

function remBuildPDF(liq, t, empresa) {
    const f  = (lbl, m, cls='') => `<tr><td>${lbl}</td><td class="r ${cls}">${fmt$(m)}</td></tr>`;
    const fD = (lbl, m, pct='') => `<tr><td>${lbl}${pct?` <small>(${pct}%)</small>`:''}</td><td class="r neg">-${fmt$(m)}</td></tr>`;
    const sub = (lbl, m, cls='') => `<tr class="sub"><td><b>${lbl}</b></td><td class="r ${cls}"><b>${fmt$(m)}</b></td></tr>`;

    const labelGratif = {
        garantizada_con_tope: `Gratificación garantizada (25%, tope ${fmt$(REM.TOPE_GRATIF)})`,
        garantizada_sin_tope: 'Gratificación garantizada (25% sin tope)',
        pactada: 'Gratificación pactada', ninguna: '',
    }[liq.tipoGratif] || 'Gratificación';

    return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<title>Liquidación ${liq.nombre} ${liq.periodo}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:11px;color:#111}
.page{max-width:700px;margin:0 auto;padding:28px}
.head{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:20px;padding-bottom:14px;border-bottom:3px solid #0f172a}
.head h1{font-size:18px;font-weight:800;color:#0f172a}.head p{font-size:11px;color:#64748b;margin-top:3px}
.badge{background:#0f172a;color:#fff;padding:5px 13px;border-radius:5px;font-size:11px;font-weight:700}
table{width:100%;border-collapse:collapse;margin-bottom:12px;font-size:11px}
td{padding:5px 9px;border-bottom:1px solid #f1f5f9}
th{background:#f8fafc;padding:6px 9px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#64748b;border-bottom:1px solid #e2e8f0}
.r{text-align:right}.pos{color:#059669;font-weight:600}.neg{color:#dc2626;font-weight:600}.muted{color:#64748b}
tr.sub td{background:#f8fafc;font-weight:700;border-top:1px solid #e2e8f0;border-bottom:2px solid #e2e8f0}
.liq-box{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 16px;margin-bottom:16px}
.footer{text-align:center;font-size:10px;color:#94a3b8;margin-top:16px}small{color:#94a3b8}</style>
</head><body><div class="page">
<div class="head">
  <div><h1>${empresa}</h1>
    <p>Liquidación de Sueldo — ${fmtPeriodo(liq.periodo)}</p>
    <p style="margin-top:6px"><b>${liq.nombre}</b> · RUT: ${liq.rut||''}${t.cargo?' · '+t.cargo:''}</p></div>
  <div class="badge">${fmtPeriodo(liq.periodo)}</div>
</div>
<table>
  <tr><th colspan="2">Remuneración Imponible <small>Base: ${fmt$(liq.totalImponible)}</small></th></tr>
  ${f(`Sueldo base${liq.diasTrabajados<30?` (${liq.diasTrabajados} días)`:''}`,liq.sueldoBase,'pos')}
  ${liq.sobresueldo>0?f(`Horas extraordinarias (${liq.horasExtra}h · ${liq.horasSemanales}h/sem · ×150%)`,liq.sobresueldo,'pos'):''}
  ${f('Comisiones',liq.comisiones,liq.comisiones>0?'pos':'muted')}
  ${f('Participación',liq.participacion,liq.participacion>0?'pos':'muted')}
  ${liq.gratificacion>0?f(labelGratif,liq.gratificacion,'pos'):''}
  ${sub('Total remuneración imponible',liq.totalImponible,'pos')}
  <tr><th colspan="2">Haberes No Imponibles</th></tr>
  ${f('Colación',liq.colacion,liq.colacion>0?'pos':'muted')}
  ${f('Movilización',liq.movilizacion,liq.movilizacion>0?'pos':'muted')}
  ${f(`Asignación familiar (${liq.numCargas} cargas)`,liq.montoAsigFam,liq.montoAsigFam>0?'pos':'muted')}
  ${sub('TOTAL HABERES',liq.totalHaberes,'pos')}
  <tr><th colspan="2">Descuentos Legales</th></tr>
  ${fD(`AFP ${t.afp||''}`,liq.descAfp,liq.afpTasa)}
  ${fD(`Salud ${t.sistemaSalud||''}`,liq.descSalud,liq.saludPct)}
  ${fD('Cesantía trabajador',liq.descCesantia,'0.6')}
  ${fD('Impuesto Único 2° Categoría',liq.impUnico)}
  ${liq.descPrestamo?fD('Préstamo empresa',liq.descPrestamo):''}
  ${liq.descOtros?fD('Otros descuentos',liq.descOtros):''}
  ${sub('Total descuentos',liq.totalDescuentos,'neg')}
  <tr class="sub" style="background:#f0fdf4"><td><b>Alcance líquido</b></td><td class="r pos"><b>${fmt$(liq.alcanceLiquido)}</b></td></tr>
  ${liq.anticipos>0?`<tr><td>Anticipos</td><td class="r neg">-${fmt$(liq.anticipos)}</td></tr>`:''}
  ${sub('SUELDO LÍQUIDO A PAGAR',liq.liquido,'pos')}
</table>
<div class="liq-box">
  <div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#059669">Sueldo Líquido a Pagar</div>
  <div style="font-size:22px;font-weight:800;color:#059669;margin-top:2px">${fmt$(liq.liquido)}</div>
  ${t.banco?`<div style="font-size:10px;color:#059669;margin-top:2px">🏦 ${t.banco}</div>`:''}
</div>
<table>
  <tr><th colspan="2">Aportes Patronales <small>(no descuentan del trabajador)</small></th></tr>
  <tr><td>SIS — Seg. Invalidez y Sobrevivencia</td><td class="r">${fmt$(liq.aportSis)}</td></tr>
  <tr><td>Cesantía empleador (2.4%)</td><td class="r">${fmt$(liq.aportCesantia)}</td></tr>
  <tr><td>Mutual (0.9%)</td><td class="r">${fmt$(liq.aportMutual)}</td></tr>
  ${sub('Costo total empleador',liq.costoTotal,'neg')}
</table>
<div class="footer">CONTAPP ERP FORGE · IMM: ${fmt$(REM.IMM)} · Generado: ${new Date().toLocaleDateString('es-CL')}</div>
</div></body></html>`;
}

// ══════════════════════════════════════════════════════════════
// VACACIONES
// ══════════════════════════════════════════════════════════════

// Persistencia vacaciones: array de { id, trabId, tipo:'tomada'|'pendiente', dias, desde, hasta, obs }
function getVacaciones()   { try { return JSON.parse(localStorage.getItem('rem_vacaciones') || '[]'); } catch { return []; } }
function saveVacaciones(a) { localStorage.setItem('rem_vacaciones', JSON.stringify(a)); }

// Días legales acumulados desde fecha de ingreso hasta hoy
// Base legal: 15 días hábiles por año trabajado (art. 67 Código del Trabajo)
function vacDiasAcumulados(t) {
    if (!t.fechaIngreso) return 0;
    const ingreso = new Date(t.fechaIngreso);
    const hoy     = new Date();
    const meses   = (hoy.getFullYear() - ingreso.getFullYear()) * 12
                  + (hoy.getMonth() - ingreso.getMonth());
    const diasBase = Number(t.diasVacaciones || 15); // puede ser 20 para trabajadores con 10+ años continuos
    return Math.floor(meses * diasBase / 12);
}

// Días tomados por trabajador
function vacDiasTomados(trabId) {
    return getVacaciones()
        .filter(v => v.trabId === trabId && v.tipo === 'tomada')
        .reduce((s, v) => s + (v.dias || 0), 0);
}

function vacSaldoPendiente(t) {
    return Math.max(0, vacDiasAcumulados(t) - vacDiasTomados(t.id));
}

// Calcular días hábiles entre dos fechas (excluye sábado y domingo)
function vacDiasHabiles(desde, hasta) {
    let count = 0;
    const d = new Date(desde);
    const h = new Date(hasta);
    while (d <= h) {
        const dow = d.getDay();
        if (dow !== 0 && dow !== 6) count++;
        d.setDate(d.getDate() + 1);
    }
    return count;
}

function remHtmlVacaciones() {
    const trabajadores = remState.trabajadores;
    if (!trabajadores.length) return `
      <div class="rem-empty">
        <div class="rem-empty-icon">🏖</div>
        <p>Primero registra trabajadores en la pestaña "Trabajadores".</p>
      </div>`;

    const vacaciones = getVacaciones();
    const sel = remState.vacTrabId || trabajadores[0]?.id;

    const lista = trabajadores.map(t => {
        const saldo = vacSaldoPendiente(t);
        const activo = t.id === sel;
        return `<div class="rem-worker-item${activo ? ' sel' : ''}" onclick="remVacSelTrab('${t.id}')">
          ${avatarHtml(t.nombre, 34)}
          <div style="flex:1;min-width:0;">
            <div class="rem-worker-nombre">${t.nombre}</div>
            <div class="rem-worker-sub">${saldo} días disponibles</div>
          </div>
          <span class="rem-badge ${saldo > 0 ? 'rem-badge-ok' : 'rem-badge-gray'}">${saldo}d</span>
        </div>`;
    }).join('');

    const t = trabajadores.find(x => x.id === sel);
    const panel = t ? remHtmlVacPanel(t, vacaciones) : '';

    return `
    <div class="rem-liq-layout">
      <div class="rem-worker-list">${lista}</div>
      <div id="rem-vac-panel">${panel}</div>
    </div>`;
}

function remHtmlVacPanel(t, vacaciones) {
    const acum   = vacDiasAcumulados(t);
    const tomados= vacDiasTomados(t.id);
    const saldo  = Math.max(0, acum - tomados);
    const historial = vacaciones.filter(v => v.trabId === t.id).sort((a,b) => b.desde.localeCompare(a.desde));

    const pct = acum > 0 ? Math.min(100, Math.round((tomados / acum) * 100)) : 0;

    return `
    <div style="flex:1;min-width:0;">

      <!-- Resumen -->
      <div class="card" style="padding:20px;margin-bottom:16px;">
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px;">
          ${avatarHtml(t.nombre, 44)}
          <div>
            <div style="font-size:15px;font-weight:700;">${t.nombre}</div>
            <div style="font-size:12px;color:var(--text-muted);">
              Ingreso: ${t.fechaIngreso || '—'} · ${t.diasVacaciones || 15} días/año
            </div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px;">
          <div style="background:var(--table-stripe);border-radius:10px;padding:14px;text-align:center;">
            <div style="font-size:24px;font-weight:800;color:var(--text);">${acum}</div>
            <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;font-weight:600;">Acumulados</div>
          </div>
          <div style="background:var(--table-stripe);border-radius:10px;padding:14px;text-align:center;">
            <div style="font-size:24px;font-weight:800;color:var(--negative);">${tomados}</div>
            <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;font-weight:600;">Tomados</div>
          </div>
          <div style="background:var(--positive-soft,#d1fae5);border-radius:10px;padding:14px;text-align:center;">
            <div style="font-size:24px;font-weight:800;color:var(--positive);">${saldo}</div>
            <div style="font-size:11px;color:var(--positive);text-transform:uppercase;font-weight:600;">Disponibles</div>
          </div>
        </div>
        <!-- Barra de progreso -->
        <div style="background:var(--divider);border-radius:999px;height:8px;overflow:hidden;">
          <div style="background:var(--accent);height:100%;width:${pct}%;border-radius:999px;transition:.3s;"></div>
        </div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:6px;">${pct}% de días acumulados utilizados</div>
      </div>

      <!-- Registrar período de vacaciones -->
      <div class="card" style="padding:20px;margin-bottom:16px;">
        <div style="font-size:14px;font-weight:700;margin-bottom:14px;">Registrar período de vacaciones</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
          <div>
            <label style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;display:block;margin-bottom:4px;">Desde</label>
            <input type="date" id="vacDesde"
              style="width:100%;padding:9px 12px;border:1px solid var(--divider);border-radius:8px;
                     background:var(--input-bg);color:var(--text);font-size:13px;box-sizing:border-box;"
              oninput="remVacCalcDias()">
          </div>
          <div>
            <label style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;display:block;margin-bottom:4px;">Hasta</label>
            <input type="date" id="vacHasta"
              style="width:100%;padding:9px 12px;border:1px solid var(--divider);border-radius:8px;
                     background:var(--input-bg);color:var(--text);font-size:13px;box-sizing:border-box;"
              oninput="remVacCalcDias()">
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
          <div id="vacDiasCalc" style="font-size:13px;color:var(--text-muted);">Selecciona las fechas para calcular días hábiles</div>
        </div>
        <div style="margin-bottom:12px;">
          <label style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;display:block;margin-bottom:4px;">Observación</label>
          <input type="text" id="vacObs" placeholder="Opcional…"
            style="width:100%;padding:9px 12px;border:1px solid var(--divider);border-radius:8px;
                   background:var(--input-bg);color:var(--text);font-size:13px;box-sizing:border-box;">
        </div>
        <button class="btn btn-primary" style="width:100%;padding:11px;" onclick="remVacGuardar('${t.id}')">
          + Registrar vacaciones
        </button>
      </div>

      <!-- Historial -->
      ${historial.length ? `
      <div class="card" style="padding:0;overflow:hidden;">
        <div style="padding:14px 18px;border-bottom:1px solid var(--divider);font-size:14px;font-weight:700;">
          Historial
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="background:var(--table-stripe);">
              <th style="padding:9px 14px;text-align:left;color:var(--text-muted);font-weight:600;font-size:11px;text-transform:uppercase;">Desde</th>
              <th style="padding:9px 14px;text-align:left;color:var(--text-muted);font-weight:600;font-size:11px;text-transform:uppercase;">Hasta</th>
              <th style="padding:9px 14px;text-align:right;color:var(--text-muted);font-weight:600;font-size:11px;text-transform:uppercase;">Días</th>
              <th style="padding:9px 14px;text-align:left;color:var(--text-muted);font-weight:600;font-size:11px;text-transform:uppercase;">Obs.</th>
              <th style="padding:9px 14px;"></th>
            </tr>
          </thead>
          <tbody>
            ${historial.map(v => `
            <tr style="border-top:1px solid var(--divider);">
              <td style="padding:9px 14px;">${v.desde}</td>
              <td style="padding:9px 14px;">${v.hasta}</td>
              <td style="padding:9px 14px;text-align:right;font-weight:600;">${v.dias}d</td>
              <td style="padding:9px 14px;color:var(--text-muted);">${v.obs || '—'}</td>
              <td style="padding:9px 14px;text-align:right;">
                <button onclick="remVacEliminar('${v.id}')"
                  style="border:1px solid #fca5a5;background:var(--negative-soft);border-radius:6px;
                         padding:3px 9px;cursor:pointer;font-size:12px;color:var(--negative);">Eliminar</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>` : ''}
    </div>`;
}

function remVacSelTrab(id) {
    remState.vacTrabId = id;
    const t = remState.trabajadores.find(x => x.id === id);
    const panel = document.getElementById('rem-vac-panel');
    if (panel && t) panel.innerHTML = remHtmlVacPanel(t, getVacaciones());
    document.querySelectorAll('.rem-worker-item').forEach(el => el.classList.remove('sel'));
    event?.currentTarget?.classList?.add('sel');
}

function remVacCalcDias() {
    const desde = document.getElementById('vacDesde')?.value;
    const hasta = document.getElementById('vacHasta')?.value;
    const el    = document.getElementById('vacDiasCalc');
    if (!el) return;
    if (!desde || !hasta || desde > hasta) { el.textContent = 'Selecciona las fechas para calcular días hábiles'; return; }
    const dias = vacDiasHabiles(desde, hasta);
    el.innerHTML = `<strong style="font-size:16px;color:var(--accent);">${dias}</strong> días hábiles`;
}

function remVacGuardar(trabId) {
    const desde = document.getElementById('vacDesde')?.value;
    const hasta = document.getElementById('vacHasta')?.value;
    if (!desde || !hasta || desde > hasta) { mostrarToast('Ingresa fechas válidas.', 'error'); return; }

    const dias = vacDiasHabiles(desde, hasta);
    const t    = remState.trabajadores.find(x => x.id === trabId);
    if (!t) return;

    const saldo = vacSaldoPendiente(t);
    const _doRegistrar = () => {
        const arr = getVacaciones();
        arr.push({
            id:     Date.now().toString(),
            trabId,
            tipo:   'tomada',
            desde,
            hasta,
            dias,
            obs:    document.getElementById('vacObs')?.value || '',
        });
        saveVacaciones(arr);
        mostrarToast(`${dias} días registrados.`, 'ok');
        const panel = document.getElementById('rem-vac-panel');
        if (panel) panel.innerHTML = remHtmlVacPanel(t, arr);
    };
    if (dias > saldo) {
        mostrarConfirm(`⚠️ El trabajador solo tiene ${saldo} días disponibles y estás registrando ${dias}. ¿Continuar?`, _doRegistrar);
        return;
    }
    _doRegistrar();
}

function remVacEliminar(id) {
    mostrarConfirm('¿Eliminar este registro de vacaciones?', () => {
        const arr = getVacaciones().filter(v => v.id !== id);
        saveVacaciones(arr);
        remRefreshBody();
    });
}

// ══════════════════════════════════════════════════════════════
// FINIQUITO
// ══════════════════════════════════════════════════════════════

const CAUSALES = [
    { value: '159_1', label: 'Art. 159 N°1 — Mutuo acuerdo',                          indem: false },
    { value: '159_2', label: 'Art. 159 N°2 — Vencimiento del plazo',                  indem: false },
    { value: '159_4', label: 'Art. 159 N°4 — Renuncia voluntaria',                    indem: false },
    { value: '159_5', label: 'Art. 159 N°5 — Conclusión del trabajo o servicio',      indem: false },
    { value: '161',   label: 'Art. 161 — Necesidades de la empresa',                  indem: true  },
    { value: '161_d', label: 'Art. 161 — Desahucio (cargo de confianza)',              indem: true  },
    { value: '160',   label: 'Art. 160 — Despido culpa trabajador (sin indemnización)',indem: false },
];

function remHtmlFiniquito() {
    const trabajadores = remState.trabajadores;
    if (!trabajadores.length) return `
      <div class="rem-empty">
        <div class="rem-empty-icon">📄</div>
        <p>Primero registra trabajadores en la pestaña "Trabajadores".</p>
      </div>`;

    const trabOpts = trabajadores.map(t =>
        `<option value="${t.id}">${t.nombre} — ${t.rut || 'sin RUT'}</option>`
    ).join('');

    const hoy = new Date().toISOString().slice(0, 10);

    return `
    <div style="max-width:680px;">

      <!-- Selector -->
      <div class="card" style="padding:20px;margin-bottom:16px;">
        <div style="font-size:14px;font-weight:700;margin-bottom:14px;">Datos del finiquito</div>
        <div style="display:grid;gap:12px;">

          <div>
            <label style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;display:block;margin-bottom:4px;">Trabajador</label>
            <select id="fiqTrabId" onchange="remFiqRecalcular()"
              style="width:100%;padding:9px 12px;border:1px solid var(--divider);border-radius:8px;
                     background:var(--input-bg);color:var(--text);font-size:13px;box-sizing:border-box;">
              <option value="">— Seleccionar —</option>
              ${trabOpts}
            </select>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div>
              <label style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;display:block;margin-bottom:4px;">Fecha de término</label>
              <input type="date" id="fiqFechaTermino" value="${hoy}" onchange="remFiqRecalcular()"
                style="width:100%;padding:9px 12px;border:1px solid var(--divider);border-radius:8px;
                       background:var(--input-bg);color:var(--text);font-size:13px;box-sizing:border-box;">
            </div>
            <div>
              <label style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;display:block;margin-bottom:4px;">Causal de término</label>
              <select id="fiqCausal" onchange="remFiqRecalcular()"
                style="width:100%;padding:9px 12px;border:1px solid var(--divider);border-radius:8px;
                       background:var(--input-bg);color:var(--text);font-size:13px;box-sizing:border-box;">
                ${CAUSALES.map(c => `<option value="${c.value}">${c.label}</option>`).join('')}
              </select>
            </div>
          </div>

          <div>
            <label style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;display:block;margin-bottom:4px;">¿Se dio aviso previo (30 días)?</label>
            <div style="display:flex;gap:10px;">
              <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;">
                <input type="radio" name="fiqAviso" value="si" checked onchange="remFiqRecalcular()"> Sí
              </label>
              <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;">
                <input type="radio" name="fiqAviso" value="no" onchange="remFiqRecalcular()"> No (pagar indemnización sustitutiva)
              </label>
            </div>
          </div>

        </div>
      </div>

      <!-- Resultado -->
      <div id="fiq-resultado"></div>
    </div>`;
}

function remFiqRecalcular() {
    const trabId  = document.getElementById('fiqTrabId')?.value;
    const fechaT  = document.getElementById('fiqFechaTermino')?.value;
    const causal  = document.getElementById('fiqCausal')?.value;
    const aviso   = document.querySelector('input[name="fiqAviso"]:checked')?.value === 'si';
    const cont    = document.getElementById('fiq-resultado');
    if (!cont) return;
    if (!trabId || !fechaT) { cont.innerHTML = ''; return; }

    const t = remState.trabajadores.find(x => x.id === trabId);
    if (!t) return;

    const calc  = remCalcularFiniquito(t, fechaT, causal, aviso);
    cont.innerHTML = remHtmlFiqResultado(t, calc, fechaT, causal, aviso);
}

function remCalcularFiniquito(t, fechaTermino, causal, avisoPrevio) {
    const ingreso  = new Date(t.fechaIngreso || fechaTermino);
    const termino  = new Date(fechaTermino);

    // Años y meses de servicio
    let anios  = termino.getFullYear() - ingreso.getFullYear();
    let meses  = termino.getMonth()    - ingreso.getMonth();
    let dias   = termino.getDate()     - ingreso.getDate();
    if (dias  < 0) { meses--; }
    if (meses < 0) { anios--; meses += 12; }
    const aniosFrac = anios + meses / 12; // fracción para vacaciones proporcionales

    // Última remuneración base (promedio últimos 3 meses si hay liquidaciones)
    const liqs3 = remState.liquidaciones
        .filter(l => l.trabajadorId === t.id)
        .sort((a,b) => b.periodo.localeCompare(a.periodo))
        .slice(0, 3);
    const baseCalc = liqs3.length
        ? Math.round(liqs3.reduce((s,l) => s + l.totalImponible, 0) / liqs3.length)
        : Number(t.sueldoBruto || 0);

    // ── Indemnización por años de servicio ─────────────────────
    const infoCausal = CAUSALES.find(c => c.value === causal) || CAUSALES[0];
    const correspondeIndem = infoCausal.indem && t.tipoContrato === 'indefinido';
    const aniosIndem = Math.min(11, Math.floor(aniosFrac)); // tope legal 11 años
    const indemAnios = correspondeIndem ? Math.round(baseCalc * aniosIndem) : 0;

    // ── Indemnización sustitutiva de aviso previo ───────────────
    // Art. 161: si no se da aviso con 30 días, pagar 1 mes adicional
    const indemAviso = (!avisoPrevio && infoCausal.indem)
        ? Math.round(baseCalc) : 0;

    // ── Vacaciones proporcionales ───────────────────────────────
    // Días acumulados desde último período completo pagado
    const diasVacBase   = Number(t.diasVacaciones || 15);
    const diasAcumTotal = vacDiasAcumulados(t);
    const diasTomados   = vacDiasTomados(t.id);
    const diasPendientes= Math.max(0, diasAcumTotal - diasTomados);
    // Valor día hábil = sueldo mensual / 30
    const valorDia      = Math.round(baseCalc / 30);
    const vacProporcional = Math.round(diasPendientes * valorDia);

    // ── Feriado proporcional ────────────────────────────────────
    // Meses trabajados en el año en curso × (diasVacBase/12) días
    const inicioAnio    = new Date(termino.getFullYear(), 0, 1);
    const mesesAnio     = termino.getMonth() + (termino.getDate() > 0 ? 1 : 0);
    const diasFeriado   = Math.round(mesesAnio * diasVacBase / 12);
    const feriadoProp   = Math.round(diasFeriado * valorDia);

    // ── Sueldo proporcional al mes (si no terminó en fin de mes) ─
    const diaTermino    = termino.getDate();
    const diasDelMes    = new Date(termino.getFullYear(), termino.getMonth() + 1, 0).getDate();
    const sueldoProp    = diaTermino < diasDelMes
        ? Math.round(baseCalc * diaTermino / diasDelMes) : baseCalc;

    const totalFiniquito = indemAnios + indemAviso + vacProporcional + feriadoProp + sueldoProp;

    return {
        anios, meses, aniosFrac, aniosIndem,
        baseCalc, valorDia,
        correspondeIndem, indemAnios,
        indemAviso, avisoPrevio,
        diasPendientes, vacProporcional,
        diasFeriado, feriadoProp,
        diaTermino, diasDelMes, sueldoProp,
        totalFiniquito,
    };
}

function remHtmlFiqResultado(t, c, fechaTermino, causal, avisoPrevio) {
    const infoCausal = CAUSALES.find(x => x.value === causal) || CAUSALES[0];
    const fila = (lbl, monto, hint = '') => `
      <div style="display:flex;justify-content:space-between;align-items:center;
                  padding:10px 0;border-bottom:1px solid var(--divider);">
        <div>
          <div style="font-size:13px;color:var(--text);">${lbl}</div>
          ${hint ? `<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${hint}</div>` : ''}
        </div>
        <div style="font-size:14px;font-weight:700;font-family:monospace;
                    color:${monto > 0 ? 'var(--positive)' : 'var(--text-muted)'};">
          ${monto > 0 ? fmt$(monto) : '$ 0'}
        </div>
      </div>`;

    return `
    <div class="card" style="padding:20px;margin-bottom:16px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;
                  padding-bottom:14px;border-bottom:2px solid var(--divider);">
        <div>
          <div style="font-size:15px;font-weight:800;">${t.nombre}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:3px;">
            ${t.rut || ''} · ${c.anios} año(s) y ${c.meses} mes(es) de servicio
          </div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">
            Causal: ${infoCausal.label}
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;font-weight:600;">Base de cálculo</div>
          <div style="font-size:18px;font-weight:800;color:var(--accent);">${fmt$(c.baseCalc)}</div>
          <div style="font-size:10px;color:var(--text-muted);">${remState.liquidaciones.filter(l=>l.trabajadorId===t.id).length >= 3 ? 'Prom. últimas 3 liq.' : 'Sueldo bruto'}</div>
        </div>
      </div>

      <!-- Desglose -->
      ${fila(
          `Sueldo proporcional al mes${c.diaTermino < c.diasDelMes ? ` (${c.diaTermino} de ${c.diasDelMes} días)` : ' (mes completo)'}`,
          c.sueldoProp,
          `${c.baseCalc.toLocaleString('es-CL')} / ${c.diasDelMes} × ${c.diaTermino} días`
      )}
      ${fila(
          `Vacaciones proporcionales (${c.diasPendientes} días pendientes)`,
          c.vacProporcional,
          `Valor día: ${fmt$(c.valorDia)}`
      )}
      ${fila(
          `Feriado proporcional (${c.diasFeriado} días del año en curso)`,
          c.feriadoProp,
          `${new Date().getMonth() + 1} meses trabajados en ${new Date().getFullYear()}`
      )}
      ${c.correspondeIndem ? fila(
          `Indemnización por años de servicio (${c.aniosIndem} año${c.aniosIndem !== 1 ? 's' : ''}, tope 11)`,
          c.indemAnios,
          `${fmt$(c.baseCalc)} × ${c.aniosIndem} año(s)`
      ) : `<div style="padding:10px 0;border-bottom:1px solid var(--divider);font-size:13px;color:var(--text-muted);">
        Indemnización por años de servicio — no aplica (${infoCausal.indem ? 'contrato no indefinido' : 'causal sin indemnización'})
      </div>`}
      ${!avisoPrevio && infoCausal.indem ? fila(
          'Indemnización sustitutiva de aviso previo (1 mes)',
          c.indemAviso,
          'Art. 161 — sin aviso de 30 días'
      ) : ''}

      <!-- Total -->
      <div style="background:var(--accent);border-radius:12px;padding:16px 20px;margin-top:16px;
                  display:flex;justify-content:space-between;align-items:center;">
        <div style="color:#fff;font-size:14px;font-weight:700;">TOTAL FINIQUITO</div>
        <div style="color:#fff;font-size:22px;font-weight:800;font-family:monospace;">${fmt$(c.totalFiniquito)}</div>
      </div>

      <!-- Acciones -->
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;">
        <button onclick="remImprimirFiniquito('${t.id}','${fechaTermino}','${causal}',${avisoPrevio})"
          style="padding:10px 20px;border:1px solid var(--divider);background:var(--input-bg);
                 color:var(--text);border-radius:8px;cursor:pointer;font-size:13px;font-family:inherit;">
          🖨️ Imprimir finiquito
        </button>
        <button class="btn btn-primary" style="padding:10px 22px;font-size:13px;"
          onclick="remFiqAsiento('${t.id}','${fechaTermino}','${causal}',${avisoPrevio})">
          📒 Generar asiento contable
        </button>
      </div>
    </div>`;
}

function remImprimirFiniquito(trabId, fechaTermino, causal, avisoPrevio) {
    const t = remState.trabajadores.find(x => x.id === trabId);
    if (!t) return;
    const c = remCalcularFiniquito(t, fechaTermino, causal, avisoPrevio === 'true' || avisoPrevio === true);
    const infoCausal = CAUSALES.find(x => x.value === causal) || CAUSALES[0];
    const empresa = JSON.parse(localStorage.getItem('core_config') || '{}').empresa || 'Empresa';
    const hoy = new Date().toLocaleDateString('es-CL');

    const fila = (lbl, monto) => monto > 0
        ? `<tr><td>${lbl}</td><td style="text-align:right;font-weight:600;">${fmt$(monto)}</td></tr>` : '';

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<title>Finiquito ${t.nombre}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;font-size:11px;color:#111;padding:32px}
.head{margin-bottom:24px;padding-bottom:16px;border-bottom:3px solid #0f172a}
h1{font-size:18px;font-weight:800;color:#0f172a}
.sub{color:#64748b;font-size:11px;margin-top:3px}
table{width:100%;border-collapse:collapse;margin-bottom:16px}
td{padding:7px 10px;border-bottom:1px solid #f1f5f9}
th{background:#f8fafc;padding:7px 10px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;color:#64748b;border-bottom:1px solid #e2e8f0}
.total td{background:#0f172a;color:#fff;font-size:14px;font-weight:800;padding:12px 10px}
.firma{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:48px}
.firma-box{border-top:1px solid #111;padding-top:8px;text-align:center;font-size:10px;color:#64748b}
.legal{font-size:9px;color:#94a3b8;margin-top:24px;line-height:1.5}
</style>
</head><body>
<div class="head">
  <h1>Finiquito de Trabajo</h1>
  <div class="sub">${empresa} · Fecha: ${fechaTermino} · Generado: ${hoy}</div>
</div>
<p style="margin-bottom:16px;font-size:12px;line-height:1.6;">
  Por medio del presente instrumento, <strong>${empresa}</strong> y don/doña <strong>${t.nombre}</strong>,
  RUT <strong>${t.rut || '—'}</strong>, acuerdan poner término a la relación laboral con fecha
  <strong>${fechaTermino}</strong>, en virtud de la causal contemplada en el <strong>${infoCausal.label}</strong>.
</p>
<p style="margin-bottom:16px;font-size:11px;line-height:1.6;color:#64748b;">
  El trabajador prestó servicios desde el <strong>${t.fechaIngreso || '—'}</strong>, con una antigüedad de
  <strong>${c.anios} año(s) y ${c.meses} mes(es)</strong>. Remuneración base de cálculo: <strong>${fmt$(c.baseCalc)}</strong>.
</p>
<table>
  <thead><tr><th>Concepto</th><th style="text-align:right;">Monto</th></tr></thead>
  <tbody>
    ${fila(`Sueldo proporcional al mes (${c.diaTermino} de ${c.diasDelMes} días)`, c.sueldoProp)}
    ${fila(`Vacaciones proporcionales (${c.diasPendientes} días)`, c.vacProporcional)}
    ${fila(`Feriado proporcional (${c.diasFeriado} días)`, c.feriadoProp)}
    ${fila(`Indemnización por años de servicio (${c.aniosIndem} año${c.aniosIndem!==1?'s':''})`, c.indemAnios)}
    ${fila('Indemnización sustitutiva de aviso previo', c.indemAviso)}
  </tbody>
  <tfoot class="total">
    <tr><td>TOTAL A PAGAR</td><td style="text-align:right;">${fmt$(c.totalFiniquito)}</td></tr>
  </tfoot>
</table>
<p style="font-size:11px;margin-bottom:16px;line-height:1.6;">
  Con el pago de la suma indicada, el trabajador declara no tener más acción ni reclamo que ejercer
  en contra del empleador por concepto alguno derivado de la relación laboral que por este instrumento
  se pone término.
</p>
<div class="firma">
  <div class="firma-box">Firma trabajador<br><br>${t.nombre}<br>RUT: ${t.rut || '—'}</div>
  <div class="firma-box">Firma empleador<br><br>${empresa}<br>Representante Legal</div>
</div>
<div class="legal">
  Este documento tiene carácter de finiquito laboral de conformidad con el artículo 177 del Código del Trabajo.
  Para que sea válido, debe ser firmado por ambas partes ante ministro de fe (notario, inspector del trabajo, etc.).
</div>
</body></html>`;

    const w = window.open('', '_blank', 'width=800,height=960');
    if (w) { w.document.write(html); w.document.close(); w.print(); }
}

function remFiqAsiento(trabId, fechaTermino, causal, avisoPrevio) {
    const t = remState.trabajadores.find(x => x.id === trabId);
    if (!t) return;
    const c = remCalcularFiniquito(t, fechaTermino, causal, avisoPrevio === 'true' || avisoPrevio === true);

    const [y, m, d] = fechaTermino.split('-');
    const fecha = `${d}/${m}/${y}`;

    const asientos = JSON.parse(localStorage.getItem('core_asientos') || '[]');
    const nextNum  = asientos.length ? Math.max(...asientos.map(a => a.numero || 0)) + 1 : 1;

    const movs = [];
    const deb = (cuenta, monto) => movs.push({ cuenta, debe: Math.round(monto), haber: 0 });
    const hab = (cuenta, monto) => movs.push({ cuenta, debe: 0, haber: Math.round(monto) });

    _remEnsureCuenta('Gasto Finiquito',                   'Pérdida', 'Pérdidas', 530);
    _remEnsureCuenta('Indemnización por años por pagar',  'Pasivo',  'Pasivo Circulante', 240);
    _remEnsureCuenta('Vacaciones por pagar',              'Pasivo',  'Pasivo Circulante', 241);

    const gastoTotal = c.totalFiniquito;
    deb('Gasto Finiquito', gastoTotal);
    if (c.indemAnios > 0)   hab('Indemnización por años por pagar', c.indemAnios);
    if (c.indemAviso > 0)   hab('Indemnización por años por pagar', c.indemAviso);
    if (c.vacProporcional + c.feriadoProp > 0) hab('Vacaciones por pagar', c.vacProporcional + c.feriadoProp);
    hab('Banco', c.sueldoProp + (c.vacProporcional + c.feriadoProp) * 0); // sueldo se paga directo
    // Ajuste: todo lo que no va a cuentas específicas va a Banco
    const habTotal = movs.filter(m=>m.haber>0).reduce((s,m)=>s+m.haber,0);
    if (gastoTotal > habTotal) hab('Banco', gastoTotal - habTotal);

    asientos.push({
        id: Date.now(), numero: nextNum, fecha,
        tipo: 'finiquito',
        glosa: `Finiquito ${t.nombre} — ${CAUSALES.find(c=>c.value===causal)?.label || causal}`,
        movimientos: movs, estado: 'ACTIVO',
    });
    localStorage.setItem('core_asientos', JSON.stringify(asientos));
    if (window.dbAsientos) { window.dbAsientos.length = 0; asientos.forEach(a => window.dbAsientos.push(a)); }
    if (typeof renderHistorialDiario === 'function') renderHistorialDiario();
    mostrarToast('Asiento de finiquito generado.', 'ok');
}
