// ─────────────────────────────────────────────────────────────
//  INDICADORES ECONÓMICOS — API Previred + mindicador.cl
//  Fuente principal: indicadores-api.js (proceso principal de Electron)
// ─────────────────────────────────────────────────────────────

const IND_STORAGE_KEY = 'core_indicadores';
const IND_TTL_MS      = 12 * 60 * 60 * 1000; // 12 horas (igual que la API)

const IND_CONFIG = {
    uf:    { label: 'UF',   nombre: 'Unidad de Fomento',               prefijo: '$', decimales: 2 },
    utm:   { label: 'UTM',  nombre: 'Unidad Tributaria Mensual',       prefijo: '$', decimales: 0 },
    imm:   { label: 'IMM',  nombre: 'Ingreso Mínimo Mensual',          prefijo: '$', decimales: 0 },
    ipc:   { label: 'IPC',  nombre: 'Índice de Precios al Consumidor', prefijo: '', sufijo: '%', decimales: 2 },
    dolar: { label: 'USD',  nombre: 'Dólar Observado',                 prefijo: '$', decimales: 2 },
    euro:  { label: 'EUR',  nombre: 'Euro',                            prefijo: '$', decimales: 2 },
    tasa:  { label: 'TPM',  nombre: 'Tasa Política Monetaria (BCCh)',  prefijo: '', sufijo: '%', decimales: 2 },
};

// ─────────────────────────────────────────────────────────────
//  CONSTANTES PREVIRED (deben declararse antes de cualquier función que las use)
// ─────────────────────────────────────────────────────────────
const _IU_TRAMOS_UTM = [
    { desde: 0,    hasta: 13.5,     tasa: 0     },
    { desde: 13.5, hasta: 30,       tasa: 0.04  },
    { desde: 30,   hasta: 50,       tasa: 0.08  },
    { desde: 50,   hasta: 70,       tasa: 0.135 },
    { desde: 70,   hasta: 90,       tasa: 0.23  },
    { desde: 90,   hasta: 120,      tasa: 0.304 },
    { desde: 120,  hasta: 150,      tasa: 0.354 },
    { desde: 150,  hasta: Infinity, tasa: 0.40  },
];

const _ASIG_FAM = [
    { tramo: 'A', hastaClp: 631976,   montoClp: 22007 },
    { tramo: 'B', hastaClp: 923067,   montoClp: 13505 },
    { tramo: 'C', hastaClp: 1439668,  montoClp: 4267  },
    { tramo: 'D', hastaClp: Infinity, montoClp: 0     },
];

// Tasas AFP dependientes (cargo del trabajador)
const _AFP_TASAS_BASE = {
    Capital:   11.44,
    Cuprum:    11.44,
    Habitat:   11.27,
    PlanVital: 11.16,
    ProVida:   11.45,
    Modelo:    10.58,
    Uno:       10.46,
};

// Tasas AFP independientes (incluye SIS — varía por AFP)
const _AFP_TASAS_IND = {
    Capital:   13.06,
    Cuprum:    13.06,
    Habitat:   12.89,
    PlanVital: 12.78,
    ProVida:   13.07,
    Modelo:    12.20,
    Uno:       12.08,
};

const _AFP_DEP_EMPL = 0.10; // Cargo empleador AFP (fijo por ley)

const _TASAS_BASE = {
    sis:      1.62,
    mutual:   0.90,
    cesTrab:  0.60,
    cesEmpl:  2.40,
    topeAfp:  90.0,
    topeSal:  90.0,
    topeCes: 135.2,
    topeInp:  60.0,
    afp: { ..._AFP_TASAS_BASE },
};

const _IMM_BASE = {
    mayor:  539000,
    menor:  402082,
    noRem:  347434,
    _ref: 'desde 01/01/2026',
};

const PV_CREDS_KEY    = 'core_pv_creds';
const PV_TASAS_KEY    = 'core_pv_tasas';
const PV_TASAS_IND_KEY = 'core_pv_tasas_ind';
const PV_ASIG_KEY     = 'core_pv_asig';
const PV_IMM_KEY      = 'core_pv_imm';

// Topes en UF (etiquetas y cálculo de montos CLP)
const _TOPE_AFP_UF    = 90.0;
const _TOPE_IPS_UF    = 60.0;
const _TOPE_CES_UF    = 135.2;
const _TOPE_SAL_UF    = 90.0;
const _APV_TOPE_MEN_UF = 50.0;
const _APV_TOPE_ANU_UF = 600.0;
const _DEP_CONV_ANU_UF = 900.0;

// ─────────────────────────────────────────────────────────────
//  PERSISTENCIA LOCAL
// ─────────────────────────────────────────────────────────────
function _cargarCacheIndicadores() {
    try { return JSON.parse(localStorage.getItem(IND_STORAGE_KEY)) || {}; }
    catch { return {}; }
}

function _guardarCacheIndicadores(datos) {
    localStorage.setItem(IND_STORAGE_KEY, JSON.stringify(datos));
    window.indicadoresEconomicos = datos;
}

window.indicadoresEconomicos = _cargarCacheIndicadores();

// ─────────────────────────────────────────────────────────────
//  PARSEAR RESPUESTA MERCADO → formato interno de cards
// ─────────────────────────────────────────────────────────────
function _parsearMercado(mercado) {
    if (!mercado) return {};
    const out = {};
    const fmtFecha = f => f ? new Date(f).toLocaleDateString('es-CL') : '—';

    if (mercado.uf_oficial?.valor != null) {
        out.uf = { valor: mercado.uf_oficial.valor, fecha: fmtFecha(mercado.uf_oficial.fecha), fuente: mercado.fuente || 'mindicador.cl' };
    }
    if (mercado.utm_oficial != null) {
        const utmEntry = (mercado.indices || []).find(i => i.key === 'utm') || {};
        out.utm = { valor: mercado.utm_oficial, fecha: fmtFecha(utmEntry.fecha), fuente: mercado.fuente || 'mindicador.cl' };
    }
    if (mercado.dolar != null) {
        out.dolar = { valor: mercado.dolar, fecha: fmtFecha(mercado.fecha), fuente: mercado.fuente || 'mindicador.cl' };
    }
    if (mercado.euro != null) {
        out.euro = { valor: mercado.euro, fecha: fmtFecha(mercado.fecha), fuente: mercado.fuente || 'mindicador.cl' };
    }
    if (mercado.sueldo_minimo != null) {
        out.imm = { valor: mercado.sueldo_minimo, fecha: fmtFecha(mercado.fecha), fuente: mercado.fuente || 'mindicador.cl' };
    }

    for (const ind of (mercado.indices || [])) {
        if (ind.key === 'ipc') {
            out.ipc  = { valor: ind.valor, fecha: fmtFecha(ind.fecha), fuente: mercado.fuente || 'mindicador.cl' };
        }
        if (ind.key === 'tpm') {
            out.tasa = { valor: ind.valor, fecha: fmtFecha(ind.fecha), fuente: mercado.fuente || 'mindicador.cl' };
        }
    }

    return out;
}

// ─────────────────────────────────────────────────────────────
//  APLICAR DATOS PREVIRED → localStorage (sin pisar ediciones manuales)
// ─────────────────────────────────────────────────────────────
function _aplicarPrevired(previred) {
    if (!previred || previred._diagnostico?.extraccion_vacia) return;

    // ── Tasas AFP ────────────────────────────────────────────
    const afpNuevo = {};
    for (const [nombre, datos] of Object.entries(previred.afp_tasas || {})) {
        if (datos.cargo_trabajador != null) afpNuevo[_capitalize(nombre)] = datos.cargo_trabajador;
    }

    // ── SIS (tasa empleador) ──────────────────────────────────
    const sisTasa = previred.tasa_sis;

    // ── Rentas mínimas → IMM ──────────────────────────────────
    const rentas = previred.rentas_minimas || {};
    const immMayor = rentas.general             || null;
    const immMenor = rentas.menores_mayores     || null;
    const immNoRem = rentas.no_remuneracionales || null;

    // ── Asignación familiar ───────────────────────────────────
    const asigRaw = previred.asignacion_familiar || [];

    // Guardar tasas (solo si vinieron datos)
    if (Object.keys(afpNuevo).length > 0 || sisTasa != null) {
        const tasasActuales = _pvTasasActivas();
        const nuevasTasas = { ...tasasActuales };
        if (Object.keys(afpNuevo).length > 0) nuevasTasas.afp = { ...tasasActuales.afp, ...afpNuevo };
        if (sisTasa != null) nuevasTasas.sis = sisTasa;
        localStorage.setItem(PV_TASAS_KEY, JSON.stringify(nuevasTasas));
    }

    // Guardar IMM
    if (immMayor || immMenor || immNoRem) {
        const immActual = _immActivo();
        const nuevaImm = {
            mayor: immMayor || immActual.mayor,
            menor: immMenor || immActual.menor,
            noRem: immNoRem || immActual.noRem,
            _ref:  previred.utm_uta?.periodo ? `Vigente al ${previred.utm_uta.periodo}` : immActual._ref,
            _actualizadoEn: new Date().toLocaleDateString('es-CL'),
            _fuentePrevired: true,
        };
        localStorage.setItem(PV_IMM_KEY, JSON.stringify(nuevaImm));
    }

    // Guardar asignación familiar
    if (asigRaw.length >= 3) {
        const tramoA = asigRaw.find(a => a.tramo && a.tramo.includes('1')) || asigRaw[0] || {};
        const tramoB = asigRaw.find(a => a.tramo && a.tramo.includes('2')) || asigRaw[1] || {};
        const tramoC = asigRaw.find(a => a.tramo && a.tramo.includes('3')) || asigRaw[2] || {};

        const extraerHasta = req => {
            const m = (req || '').match(/[\d.]+/g);
            if (!m) return null;
            const nums = m.map(x => parseInt(x.replace(/\./g, ''), 10)).filter(n => n > 1000);
            return nums.length ? Math.max(...nums) : null;
        };

        const hastaA = extraerHasta(tramoA.requisito);
        const hastaB = extraerHasta(tramoB.requisito);
        const hastaC = extraerHasta(tramoC.requisito);

        if (hastaA && tramoA.monto != null) {
            const asig = {
                hastaA, montoA: tramoA.monto,
                hastaB: hastaB || 0, montoB: tramoB.monto || 0,
                hastaC: hastaC || 0, montoC: tramoC.monto || 0,
                _actualizadoEn: new Date().toLocaleDateString('es-CL'),
                _fuentePrevired: true,
            };
            localStorage.setItem(PV_ASIG_KEY, JSON.stringify(asig));
        }
    }

    _pvCargarTasasUI();
    _sincronizarTasasConREM();
}

function _capitalize(s) {
    if (!s) return s;
    return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─────────────────────────────────────────────────────────────
//  ACTUALIZACIÓN PRINCIPAL
// ─────────────────────────────────────────────────────────────
async function actualizarIndicadores(forzar = false) {
    const elFecha  = document.getElementById('indFechaActualizacion');
    const elEstado = document.getElementById('indEstadoConexion');

    if (elFecha)  elFecha.textContent = 'Actualizando…';
    if (elEstado) elEstado.innerHTML  = '<span style="color:var(--accent);">⟳ Consultando Previred y mindicador.cl…</span>';

    let mercadoDatos = {};
    let fuenteLabel  = '—';
    let previredOk   = false;

    try {
        const result = await window.electronAPI.indicadores.todo(forzar);

        // ── Mercado ───────────────────────────────────────────
        if (result.mercado) {
            mercadoDatos = _parsearMercado(result.mercado);
            fuenteLabel  = result.mercado.fuente || 'mindicador.cl';
        }

        // ── Previred ──────────────────────────────────────────
        if (result.previred) {
            _aplicarPrevired(result.previred);
            previredOk = !result.previred._diagnostico?.extraccion_vacia;

            // UTM de Previred como fuente alternativa si mindicador no la trajo
            if (!mercadoDatos.utm && result.previred.utm_uta?.utm) {
                mercadoDatos.utm = {
                    valor: result.previred.utm_uta.utm,
                    fecha: result.previred.utm_uta.periodo || '—',
                    fuente: 'previred.com',
                };
            }
            // UF del día desde Previred si mindicador no la trajo
            if (!mercadoDatos.uf && result.previred.uf?.length > 0) {
                const ufHoy = result.previred.uf[0];
                mercadoDatos.uf = {
                    valor: ufHoy.valor,
                    fecha: ufHoy.periodo || '—',
                    fuente: 'previred.com',
                };
            }
            // IMM desde rentas mínimas de Previred
            if (!mercadoDatos.imm && result.previred.rentas_minimas?.general) {
                mercadoDatos.imm = {
                    valor: result.previred.rentas_minimas.general,
                    fecha: result.previred.utm_uta?.periodo || '—',
                    fuente: 'previred.com',
                };
            }
        }

        const clavesOk = Object.keys(mercadoDatos).length > 0;

        if (!clavesOk) {
            if (elFecha)  elFecha.textContent = 'Sin conexión — mostrando caché.';
            if (elEstado) elEstado.innerHTML  =
                `<span style="color:var(--negative);font-size:12px;">⚠ No se pudo conectar con los servicios</span>`;
        } else {
            const ahora     = new Date().toLocaleString('es-CL');
            const cacheAct  = _cargarCacheIndicadores();
            const fusionado = { ...cacheAct, ...mercadoDatos };
            fusionado._actualizadoEn = ahora;
            fusionado._fuente        = fuenteLabel + (previredOk ? ' + previred.com' : '');
            _guardarCacheIndicadores(fusionado);

            if (elFecha)  elFecha.textContent = `Última actualización: ${ahora}`;
            if (elEstado) elEstado.innerHTML  = `<span style="color:var(--positive);font-size:12px;">✅ ${fusionado._fuente}</span>`;
        }

    } catch (e) {
        if (elFecha)  elFecha.textContent = 'Error al actualizar. Mostrando caché.';
        if (elEstado) elEstado.innerHTML  =
            `<span style="color:var(--negative);font-size:12px;">Sin conexión — ${e.message}</span>`;
    }

    renderIndicadores();
}

// ─────────────────────────────────────────────────────────────
//  AUTO-ACTUALIZACIÓN AL INICIAR (una vez cada 12 h)
// ─────────────────────────────────────────────────────────────
function _autoActualizarSiNecesario() {
    const cache = _cargarCacheIndicadores();
    const keysFaltantes = Object.keys(IND_CONFIG).filter(k => !cache[k]);
    if (!cache._actualizadoEn || keysFaltantes.length > 0) {
        actualizarIndicadores();
        return;
    }
    const ultima = new Date(cache._actualizadoEn.replace(/(\d{2})\/(\d{2})\/(\d{4}),\s*(.*)/, '$3-$2-$1T$4'));
    if (isNaN(ultima.getTime()) || (Date.now() - ultima.getTime()) > IND_TTL_MS) {
        actualizarIndicadores();
    }
}

setTimeout(_autoActualizarSiNecesario, 1500);

// ─────────────────────────────────────────────────────────────
//  RENDER DE CARDS
// ─────────────────────────────────────────────────────────────
function renderIndicadores() {
    const cache = _cargarCacheIndicadores();
    window.indicadoresEconomicos = cache;

    Object.entries(IND_CONFIG).forEach(([key, cfg]) => {
        const dato  = cache[key];
        const elVal  = document.getElementById(`indVal${_capFirst(key)}`);
        const elFec  = document.getElementById(`indFec${_capFirst(key)}`);
        const elCard = document.getElementById(`card${_capFirst(key)}`);
        if (!elVal) return;

        if (dato?.valor != null) {
            const v = parseFloat(dato.valor);
            elVal.textContent = (cfg.prefijo || '')
                + new Intl.NumberFormat('es-CL', {
                    minimumFractionDigits: cfg.decimales,
                    maximumFractionDigits: cfg.decimales,
                  }).format(v)
                + (cfg.sufijo || '');
            if (elFec) {
                elFec.textContent = dato.fecha + (dato.fuente ? ` · ${dato.fuente}` : '');
            }
            if (elCard && dato.variacion != null) {
                const dv = parseFloat(dato.variacion);
                elCard.style.setProperty('--ind-var-color',
                    dv > 0 ? 'var(--positive)' : dv < 0 ? 'var(--negative)' : 'var(--text-muted)');
                elCard.setAttribute('data-variacion',
                    (dv > 0 ? '▲ +' : dv < 0 ? '▼ ' : '') +
                    Math.abs(dv).toFixed(cfg.decimales) + (cfg.sufijo || ''));
            }
        } else {
            elVal.textContent = '—';
            if (elFec) elFec.textContent = 'Sin datos · presiona Actualizar';
        }
    });

    const elFecha = document.getElementById('indFechaActualizacion');
    if (elFecha && !elFecha.textContent.includes('Actualizando')) {
        elFecha.textContent = cache._actualizadoEn
            ? `Última actualización: ${cache._actualizadoEn}`
            : 'Sin datos cargados — presiona Actualizar';
    }

    const elEstado = document.getElementById('indEstadoConexion');
    if (elEstado && !elEstado.innerHTML.includes('⟳')) {
        elEstado.innerHTML = `<span style="color:var(--text-muted);font-size:12px;">Fuente: ${cache._fuente || 'mindicador.cl + previred.com'}</span>`;
    }

    if (cache.imm?.valor && typeof REM !== 'undefined') {
        REM.IMM           = Math.round(cache.imm.valor);
        REM.SUELDO_MINIMO = REM.IMM;
    }

    _pvCargarCredsUI();
    _pvCargarTasasUI();
    _sincronizarTasasConREM();
    renderPreviredTablas();
}

const _ID_SUFIJO = { uf: 'UF', utm: 'UTM', imm: 'IMM', ipc: 'IPC', dolar: 'Dolar', euro: 'Euro', tasa: 'Tasa' };
function _capFirst(s) { return _ID_SUFIJO[s] || (s.charAt(0).toUpperCase() + s.slice(1)); }

// ─────────────────────────────────────────────────────────────
//  PREVIRED — tablas dinámicas
// ─────────────────────────────────────────────────────────────
function _pvTasasActivas() {
    try {
        const saved = JSON.parse(localStorage.getItem(PV_TASAS_KEY) || 'null');
        if (!saved) return _TASAS_BASE;
        return {
            sis:     saved.sis     ?? _TASAS_BASE.sis,
            mutual:  saved.mutual  ?? _TASAS_BASE.mutual,
            cesTrab: saved.cesTrab ?? _TASAS_BASE.cesTrab,
            cesEmpl: saved.cesEmpl ?? _TASAS_BASE.cesEmpl,
            topeAfp: saved.topeAfp ?? _TASAS_BASE.topeAfp,
            topeSal: saved.topeSal ?? _TASAS_BASE.topeSal,
            topeCes: saved.topeCes ?? _TASAS_BASE.topeCes,
            topeInp: saved.topeInp ?? _TASAS_BASE.topeInp,
            afp: { ..._TASAS_BASE.afp, ...(saved.afp || {}) },
        };
    } catch { return _TASAS_BASE; }
}

function _asigFamActiva() {
    try {
        const saved = JSON.parse(localStorage.getItem(PV_ASIG_KEY) || 'null');
        if (!saved) return _ASIG_FAM;
        return [
            { tramo: 'A', hastaClp: saved.hastaA ?? _ASIG_FAM[0].hastaClp, montoClp: saved.montoA ?? _ASIG_FAM[0].montoClp },
            { tramo: 'B', hastaClp: saved.hastaB ?? _ASIG_FAM[1].hastaClp, montoClp: saved.montoB ?? _ASIG_FAM[1].montoClp },
            { tramo: 'C', hastaClp: saved.hastaC ?? _ASIG_FAM[2].hastaClp, montoClp: saved.montoC ?? _ASIG_FAM[2].montoClp },
            { tramo: 'D', hastaClp: Infinity, montoClp: 0 },
        ];
    } catch { return _ASIG_FAM; }
}
window.asigFamActiva = _asigFamActiva;

function _immActivo() {
    try {
        const saved = JSON.parse(localStorage.getItem(PV_IMM_KEY) || 'null');
        if (!saved) return _IMM_BASE;
        return {
            mayor: saved.mayor ?? _IMM_BASE.mayor,
            menor: saved.menor ?? _IMM_BASE.menor,
            noRem: saved.noRem ?? _IMM_BASE.noRem,
            _ref:  saved._ref  ?? _IMM_BASE._ref,
        };
    } catch { return _IMM_BASE; }
}
window.immActivo = _immActivo;
window.pvTasasActivas = _pvTasasActivas;

function _afpIndActivas() {
    try {
        const saved = JSON.parse(localStorage.getItem(PV_TASAS_IND_KEY) || 'null');
        if (!saved) return { ..._AFP_TASAS_IND };
        return Object.fromEntries(
            Object.keys(_AFP_TASAS_IND).map(k => [k, saved[k] ?? _AFP_TASAS_IND[k]])
        );
    } catch { return { ..._AFP_TASAS_IND }; }
}
window.afpIndActivas = _afpIndActivas;

// ─────────────────────────────────────────────────────────────
//  PREVIRED — panel UI
// ─────────────────────────────────────────────────────────────
function _pvSetEstado(msg, tipo) {
    const el = document.getElementById('pvEstado');
    if (!el) return;
    const color = { ok: 'var(--positive)', error: 'var(--negative)', info: 'var(--text-muted)' }[tipo] || 'var(--text-muted)';
    el.style.color = color;
    el.textContent = msg;
}

function _pvSetTasasEstado(msg, tipo) {
    const el = document.getElementById('pvTasasEstado');
    if (!el) return;
    const color = { ok: 'var(--positive)', error: 'var(--negative)', info: 'var(--text-muted)' }[tipo] || 'var(--text-muted)';
    el.style.color = color;
    el.textContent = msg;
}

function _pvCargarCredsUI() {
    try {
        const creds = JSON.parse(localStorage.getItem(PV_CREDS_KEY) || 'null');
        if (creds?.rut && document.getElementById('pvRut')) {
            document.getElementById('pvRut').value = creds.rut;
            const badge = document.getElementById('previredBadge');
            if (badge) badge.style.display = creds.conectado ? 'inline' : 'none';
            if (creds.conectado) _pvSetEstado(`✅ Conectado como ${creds.rut} · ${creds.empresa || ''}`, 'ok');
        }
    } catch {}
}

function _pvCargarTasasUI() {
    const t  = _pvTasasActivas();
    const af = _asigFamActiva();
    const set    = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    const setFmt = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val ? parseInt(val, 10).toLocaleString('es-CL') : '';
    };
    set('pvSis',      t.sis);
    set('pvMutual',   t.mutual);
    set('pvCesTrab',  t.cesTrab);
    set('pvCesEmpl',  t.cesEmpl);
    set('pvTopeAfp',  t.topeAfp);
    set('pvTopeSal',  t.topeSal);
    set('pvTopeCes',  t.topeCes);
    set('pvTopeInp',  t.topeInp);

    const imm = _immActivo();
    setFmt('pvImmMayor', imm.mayor);
    setFmt('pvImmMenor', imm.menor);
    setFmt('pvImmNoRem', imm.noRem);
    const pvImmRef = document.getElementById('pvImmRef');
    if (pvImmRef) pvImmRef.textContent = imm._ref || '';

    setFmt('pvAfHastaA', af[0].hastaClp);
    setFmt('pvAfMontoA', af[0].montoClp);
    setFmt('pvAfHastaB', af[1].hastaClp);
    setFmt('pvAfMontoB', af[1].montoClp);
    setFmt('pvAfHastaC', af[2].hastaClp);
    setFmt('pvAfMontoC', af[2].montoClp);

    const grid = document.getElementById('pvAfpGrid');
    if (!grid) return;
    const tInd = _afpIndActivas();
    grid.innerHTML = Object.entries(t.afp).map(([nombre, tasa]) => `
        <div style="margin-bottom:10px;">
            <div style="font-weight:700;font-size:12px;margin-bottom:4px;color:var(--text);">${nombre}</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
                <div>
                    <label class="pv-label" style="font-size:10px;">Dep. Trabajador %</label>
                    <input id="pvAfp_${nombre}" type="number" step="0.01" min="0" value="${tasa}" class="pv-input">
                </div>
                <div>
                    <label class="pv-label" style="font-size:10px;">Independiente %</label>
                    <input id="pvAfpInd_${nombre}" type="number" step="0.01" min="0" value="${tInd[nombre] ?? ''}" class="pv-input">
                </div>
            </div>
        </div>`).join('');
}

async function previredConectar() {
    const rut = document.getElementById('pvRut')?.value.trim();
    if (!rut) { _pvSetEstado('Ingresa el RUT empresa.', 'error'); return; }
    const creds = { rut, conectado: false, empresa: '' };
    localStorage.setItem(PV_CREDS_KEY, JSON.stringify(creds));
    _pvSetEstado('RUT guardado. Actualizando datos desde previred.com…', 'info');
    await actualizarIndicadores(true);
}

function previredBorrar() {
    localStorage.removeItem(PV_CREDS_KEY);
    const el = document.getElementById('pvRut'); if (el) el.value = '';
    const ep = document.getElementById('pvPass'); if (ep) ep.value = '';
    const badge = document.getElementById('previredBadge');
    if (badge) badge.style.display = 'none';
    _pvSetEstado('Credenciales eliminadas.', 'info');
}

function previredGuardarTasas() {
    const num   = id => parseFloat(document.getElementById(id)?.value || '0') || 0;
    const money = id => parseInt((document.getElementById(id)?.value || '0').replace(/\D/g,''), 10) || 0;
    const tasas = {
        sis:     num('pvSis'),
        mutual:  num('pvMutual'),
        cesTrab: num('pvCesTrab'),
        cesEmpl: num('pvCesEmpl'),
        topeAfp: num('pvTopeAfp'),
        topeSal: num('pvTopeSal'),
        topeCes: num('pvTopeCes'),
        topeInp: num('pvTopeInp'),
        afp: {},
    };
    Object.keys(_TASAS_BASE.afp).forEach(nombre => {
        tasas.afp[nombre] = parseFloat(document.getElementById(`pvAfp_${nombre}`)?.value || '0') || _TASAS_BASE.afp[nombre];
    });
    localStorage.setItem(PV_TASAS_KEY, JSON.stringify(tasas));

    const tasasInd = {};
    Object.keys(_AFP_TASAS_IND).forEach(nombre => {
        tasasInd[nombre] = parseFloat(document.getElementById(`pvAfpInd_${nombre}`)?.value || '0') || _AFP_TASAS_IND[nombre];
    });
    localStorage.setItem(PV_TASAS_IND_KEY, JSON.stringify(tasasInd));

    const immData = {
        mayor: money('pvImmMayor') || _IMM_BASE.mayor,
        menor: money('pvImmMenor') || _IMM_BASE.menor,
        noRem: money('pvImmNoRem') || _IMM_BASE.noRem,
        _ref:  document.getElementById('pvImmRef')?.value?.trim() || _IMM_BASE._ref,
        _actualizadoEn: new Date().toLocaleDateString('es-CL'),
    };
    localStorage.setItem(PV_IMM_KEY, JSON.stringify(immData));

    const asig = {
        hastaA: money('pvAfHastaA'), montoA: money('pvAfMontoA'),
        hastaB: money('pvAfHastaB'), montoB: money('pvAfMontoB'),
        hastaC: money('pvAfHastaC'), montoC: money('pvAfMontoC'),
        _actualizadoEn: new Date().toLocaleDateString('es-CL'),
    };
    localStorage.setItem(PV_ASIG_KEY, JSON.stringify(asig));

    _sincronizarTasasConREM();
    renderPreviredTablas();
    _pvSetTasasEstado('✅ Datos guardados y aplicados.', 'ok');
    setTimeout(() => _pvSetTasasEstado('', 'info'), 3000);
}

function previredRestaurarTasas() {
    if (!confirm('¿Restaurar todas las tasas y tramos a los valores predeterminados?')) return;
    localStorage.removeItem(PV_TASAS_KEY);
    localStorage.removeItem(PV_TASAS_IND_KEY);
    localStorage.removeItem(PV_ASIG_KEY);
    localStorage.removeItem(PV_IMM_KEY);
    _pvCargarTasasUI();
    _sincronizarTasasConREM();
    renderPreviredTablas();
    _pvSetTasasEstado('Valores restaurados a predeterminados.', 'info');
}

function _sincronizarTasasConREM() {
    if (typeof REM === 'undefined') return;
    const t   = _pvTasasActivas();
    const imm = _immActivo();
    REM.TASAS_AFP     = { ...t.afp };
    REM.IMM           = imm.mayor;
    REM.SUELDO_MINIMO = imm.mayor;
    window._pvTasas   = t;
    window._pvImm     = imm;
}

function _fmtN(n)   { return Math.round(n).toLocaleString('es-CL'); }
function _fmtClp(n) { return '$ ' + _fmtN(n); }

function _computeTramos(utm) {
    let rebaja = 0;
    return _IU_TRAMOS_UTM.map((t, i) => {
        if (i > 0) {
            rebaja += (_IU_TRAMOS_UTM[i].tasa - _IU_TRAMOS_UTM[i - 1].tasa)
                    * _IU_TRAMOS_UTM[i].desde * utm;
        }
        return {
            desde:    t.desde,
            hasta:    t.hasta,
            tasa:     t.tasa,
            desdeClp: t.desde * utm,
            hastaClp: t.hasta === Infinity ? null : t.hasta * utm,
            rebaja:   Math.round(rebaja),
        };
    });
}

function renderPreviredTablas() {
    const el = document.getElementById('previred-tablas');
    if (!el) return;

    const cache  = window.indicadoresEconomicos || {};
    const utm    = cache.utm?.valor || 68000;
    const uf     = cache.uf?.valor  || 38000;
    const utmFec = cache.utm?.fecha ? ` · UTM al ${cache.utm.fecha}` : '';

    const ref = document.getElementById('previredFechaRef');
    if (ref) ref.textContent = `(UTM: ${_fmtClp(utm)}${utmFec})`;

    const tasas      = _pvTasasActivas();
    const tasasInd   = _afpIndActivas();
    const tramos     = _computeTramos(utm);
    const topeAfpClp = Math.round(tasas.topeAfp * uf);
    const topeInpClp = Math.round(tasas.topeInp * uf);
    const topeCesClp = Math.round(tasas.topeCes * uf);
    const topeSalClp = Math.round(tasas.topeSal * uf);
    const apvMenClp  = Math.round(_APV_TOPE_MEN_UF * uf);
    const apvAnuClp  = Math.round(_APV_TOPE_ANU_UF * uf);
    const depConvClp = Math.round(_DEP_CONV_ANU_UF * uf);
    const imm        = _immActivo();
    const _afActiva  = _asigFamActiva();

    // Estilos
    const PV  = '#5b4886';
    const PVL = '#f0ebfa';
    const PVB = '#d8cdf0';
    const mono = "font-family:'Courier New',monospace;";

    const secHead = (title, sub = '') => `
        <div style="padding:10px 14px;background:${PV};color:#fff;font-weight:700;font-size:13px;display:flex;align-items:baseline;gap:8px;">
            ${title}${sub ? `<span style="font-size:11px;font-weight:400;opacity:.82;">${sub}</span>` : ''}
        </div>`;
    const thR = `padding:7px 10px;text-align:right;font-size:11px;font-weight:700;color:${PV};border-bottom:2px solid ${PVB};white-space:nowrap;`;
    const thL = `padding:7px 10px;text-align:left;font-size:11px;font-weight:700;color:${PV};border-bottom:2px solid ${PVB};white-space:nowrap;`;
    const tr0 = `border-bottom:1px solid ${PVB};`;
    const foot = `padding:7px 12px;font-size:11px;color:var(--text-muted);`;
    const card = `class="card" style="padding:0;overflow:hidden;"`;

    // AFP rows
    const afpHtml = Object.entries(tasas.afp).map(([nom, trab]) => {
        const ind   = tasasInd[nom] ?? _AFP_TASAS_IND[nom] ?? 0;
        const empl  = _AFP_DEP_EMPL;
        const total = trab + empl;
        return `<tr style="${tr0}">
            <td style="padding:7px 12px;font-weight:600;">${nom}</td>
            <td style="padding:7px 12px;text-align:right;${mono}">${trab.toFixed(2).replace('.', ',')}%</td>
            <td style="padding:7px 12px;text-align:right;${mono}color:var(--text-muted);">${empl.toFixed(2).replace('.', ',')}%</td>
            <td style="padding:7px 12px;text-align:right;${mono}font-weight:700;">${total.toFixed(2).replace('.', ',')}%</td>
            <td style="padding:7px 12px;text-align:right;${mono}color:${PV};font-weight:600;">${ind.toFixed(2).replace('.', ',')}%</td>
        </tr>`;
    }).join('');

    // Asig familiar rows
    const asigHtml = _afActiva.map((a, i) => `
        <tr style="${i < _afActiva.length - 1 ? tr0 : ''}">
            <td style="padding:7px 12px;font-weight:700;color:${PV};">Tramo ${a.tramo}</td>
            <td style="padding:7px 12px;text-align:right;${mono}font-size:12px;">
                ${a.hastaClp === Infinity ? 'Sin límite' : '≤ ' + _fmtClp(a.hastaClp)}</td>
            <td style="padding:7px 12px;text-align:right;${mono}font-weight:700;color:${a.montoClp > 0 ? 'var(--positive)' : 'var(--text-muted)'};">
                ${_fmtClp(a.montoClp)}</td>
        </tr>`).join('');

    // IU tramos
    const tramosHtml = tramos.map((t, i) => {
        const isEx  = t.tasa === 0;
        const desde = i === 0 ? '$ 0' : _fmtClp(t.desdeClp);
        const hasta = t.hasta === Infinity ? 'y más' : _fmtClp(t.hastaClp);
        const tStr  = isEx ? 'Exento' : (t.tasa * 100).toFixed(1).replace('.', ',') + '%';
        const rStr  = isEx ? '—' : _fmtClp(t.rebaja);
        const uStr  = t.hasta === Infinity ? `${t.desde} UTM en adelante`
                    : i === 0 ? `0 – ${t.hasta} UTM` : `${t.desde} – ${t.hasta} UTM`;
        const tc    = isEx ? 'var(--positive)' : t.tasa >= 0.30 ? 'var(--negative)' : 'var(--text)';
        return `<tr style="${tr0}">
            <td style="padding:7px 10px;font-size:11px;color:var(--text-muted);">${uStr}</td>
            <td style="padding:7px 10px;text-align:right;${mono}font-size:12px;">${desde}</td>
            <td style="padding:7px 10px;text-align:right;${mono}font-size:12px;">${hasta}</td>
            <td style="padding:7px 10px;text-align:right;${mono}font-weight:700;color:${tc};">${tStr}</td>
            <td style="padding:7px 10px;text-align:right;${mono}font-size:12px;color:var(--text-muted);">${rStr}</td>
        </tr>`;
    }).join('');

    el.innerHTML = `

    <!-- AFP -->
    <div ${card} style="padding:0;overflow:hidden;grid-column:1/-1;">
        ${secHead('AFP — Tasas de cotización', `tope dependientes: ${tasas.topeAfp} UF = ${_fmtClp(topeAfpClp)}`)}
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead><tr style="background:${PVL};">
                <th style="${thL}">AFP</th>
                <th style="${thR}">Dep. Trabajador</th>
                <th style="${thR}">Dep. Empleador</th>
                <th style="${thR}">Dep. Total</th>
                <th style="${thR}">Independiente</th>
            </tr></thead>
            <tbody>
                ${afpHtml}
                <tr style="${tr0}background:${PVL};">
                    <td style="padding:7px 12px;font-weight:600;color:var(--text-muted);">SIS (cargo empleador)</td>
                    <td style="padding:7px 12px;text-align:right;color:var(--text-muted);">—</td>
                    <td style="padding:7px 12px;text-align:right;${mono}font-weight:700;">${tasas.sis.toFixed(2).replace('.', ',')}%</td>
                    <td style="padding:7px 12px;text-align:right;color:var(--text-muted);">—</td>
                    <td style="padding:7px 12px;text-align:right;color:var(--text-muted);">—</td>
                </tr>
                <tr style="background:${PVL};">
                    <td style="padding:7px 12px;font-weight:600;color:var(--text-muted);">Seguro Social (empleador)</td>
                    <td style="padding:7px 12px;text-align:right;color:var(--text-muted);">—</td>
                    <td style="padding:7px 12px;text-align:right;${mono}font-weight:700;">${tasas.mutual.toFixed(2).replace('.', ',')}%</td>
                    <td style="padding:7px 12px;text-align:right;color:var(--text-muted);">—</td>
                    <td style="padding:7px 12px;text-align:right;color:var(--text-muted);">—</td>
                </tr>
            </tbody>
            <tfoot><tr style="background:${PVL};border-top:1px solid ${PVB};">
                <td colspan="5" style="${foot}">
                    IPS (ex-INP): tope ${tasas.topeInp} UF = ${_fmtClp(topeInpClp)} &nbsp;·&nbsp; UF al ${cache.uf?.fecha || '—'}: ${_fmtClp(uf)}
                </td>
            </tr></tfoot>
        </table>
    </div>

    <!-- IMM -->
    <div ${card}>
        ${secHead('IMM — Ingreso Mínimo Mensual')}
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead><tr style="background:${PVL};">
                <th style="${thL}">Trabajador</th>
                <th style="${thR}">Monto mensual</th>
            </tr></thead>
            <tbody>
                <tr style="${tr0}">
                    <td style="padding:8px 12px;">Mayor de 18 y menor de 65 años</td>
                    <td style="padding:8px 12px;text-align:right;${mono}font-weight:700;">${_fmtClp(imm.mayor)}</td>
                </tr>
                <tr style="${tr0}">
                    <td style="padding:8px 12px;">Menor de 18 / mayor de 65 / Discapacitados</td>
                    <td style="padding:8px 12px;text-align:right;${mono}font-weight:700;">${_fmtClp(imm.menor)}</td>
                </tr>
                <tr>
                    <td style="padding:8px 12px;">Fines no remuneracionales</td>
                    <td style="padding:8px 12px;text-align:right;${mono}font-weight:700;">${_fmtClp(imm.noRem)}</td>
                </tr>
            </tbody>
            <tfoot><tr style="background:${PVL};border-top:1px solid ${PVB};">
                <td colspan="2" style="${foot}">${imm._ref || ''}</td>
            </tr></tfoot>
        </table>
    </div>

    <!-- Seguro de Cesantía -->
    <div ${card}>
        ${secHead('Seguro de Cesantía', `tope ${tasas.topeCes} UF = ${_fmtClp(topeCesClp)}`)}
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead><tr style="background:${PVL};">
                <th style="${thL}">Tipo de contrato</th>
                <th style="${thR}">Trabajador</th>
                <th style="${thR}">Empleador</th>
            </tr></thead>
            <tbody>
                <tr style="${tr0}">
                    <td style="padding:8px 12px;">Indefinido</td>
                    <td style="padding:8px 12px;text-align:right;${mono}">0,60%</td>
                    <td style="padding:8px 12px;text-align:right;${mono}">2,40%</td>
                </tr>
                <tr style="${tr0}">
                    <td style="padding:8px 12px;">Plazo fijo / obra o faena</td>
                    <td style="padding:8px 12px;text-align:right;${mono}color:var(--text-muted);">—</td>
                    <td style="padding:8px 12px;text-align:right;${mono}">3,00%</td>
                </tr>
                <tr style="${tr0}">
                    <td style="padding:8px 12px;">Indefinido ≥ 11 años (empleador)</td>
                    <td style="padding:8px 12px;text-align:right;${mono}color:var(--text-muted);">—</td>
                    <td style="padding:8px 12px;text-align:right;${mono}">0,80%</td>
                </tr>
                <tr>
                    <td style="padding:8px 12px;">Casa particular</td>
                    <td style="padding:8px 12px;text-align:right;${mono}color:var(--text-muted);">—</td>
                    <td style="padding:8px 12px;text-align:right;${mono}">3,00%</td>
                </tr>
            </tbody>
        </table>
    </div>

    <!-- Trabajos Pesados -->
    <div ${card}>
        ${secHead('Trabajos Pesados')}
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead><tr style="background:${PVL};">
                <th style="${thL}">Calificación</th>
                <th style="${thR}">Total</th>
                <th style="${thR}">Empleador</th>
                <th style="${thR}">Trabajador</th>
            </tr></thead>
            <tbody>
                <tr style="${tr0}">
                    <td style="padding:8px 12px;">Trabajo pesado</td>
                    <td style="padding:8px 12px;text-align:right;${mono}font-weight:700;">4,00%</td>
                    <td style="padding:8px 12px;text-align:right;${mono}">2,00%</td>
                    <td style="padding:8px 12px;text-align:right;${mono}">2,00%</td>
                </tr>
                <tr>
                    <td style="padding:8px 12px;">Trabajo menos pesado</td>
                    <td style="padding:8px 12px;text-align:right;${mono}font-weight:700;">2,00%</td>
                    <td style="padding:8px 12px;text-align:right;${mono}">1,00%</td>
                    <td style="padding:8px 12px;text-align:right;${mono}">1,00%</td>
                </tr>
            </tbody>
            <tfoot><tr style="background:${PVL};border-top:1px solid ${PVB};">
                <td colspan="4" style="${foot}">Tope imponible AFP: ${tasas.topeAfp} UF = ${_fmtClp(topeAfpClp)}</td>
            </tr></tfoot>
        </table>
    </div>

    <!-- APV + Depósito Convenido -->
    <div ${card}>
        ${secHead('APV — Ahorro Previsional Voluntario')}
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead><tr style="background:${PVL};">
                <th style="${thL}">Período</th>
                <th style="${thR}">Tope en UF</th>
                <th style="${thR}">Equivalente CLP</th>
            </tr></thead>
            <tbody>
                <tr style="${tr0}">
                    <td style="padding:8px 12px;">Mensual</td>
                    <td style="padding:8px 12px;text-align:right;${mono}font-weight:700;">${_APV_TOPE_MEN_UF} UF</td>
                    <td style="padding:8px 12px;text-align:right;${mono}color:var(--text-muted);">${_fmtClp(apvMenClp)}</td>
                </tr>
                <tr>
                    <td style="padding:8px 12px;">Anual</td>
                    <td style="padding:8px 12px;text-align:right;${mono}font-weight:700;">${_APV_TOPE_ANU_UF} UF</td>
                    <td style="padding:8px 12px;text-align:right;${mono}color:var(--text-muted);">${_fmtClp(apvAnuClp)}</td>
                </tr>
            </tbody>
        </table>
        ${secHead('Depósito Convenido')}
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <tbody>
                <tr>
                    <td style="padding:8px 12px;">Tope anual</td>
                    <td style="padding:8px 12px;text-align:right;${mono}font-weight:700;">${_DEP_CONV_ANU_UF} UF</td>
                    <td style="padding:8px 12px;text-align:right;${mono}color:var(--text-muted);">${_fmtClp(depConvClp)}</td>
                </tr>
            </tbody>
        </table>
    </div>

    <!-- Cotización de Salud -->
    <div ${card}>
        ${secHead('Salud — Distribución cotización 7%', `tope ${tasas.topeSal} UF = ${_fmtClp(topeSalClp)}`)}
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead><tr style="background:${PVL};">
                <th style="${thL}">Destino</th>
                <th style="${thR}">Tasa</th>
                <th style="${thR}">Base</th>
            </tr></thead>
            <tbody>
                <tr style="${tr0}">
                    <td style="padding:8px 12px;font-weight:600;">Cotización legal mínima</td>
                    <td style="padding:8px 12px;text-align:right;${mono}font-weight:700;">7,00%</td>
                    <td style="padding:8px 12px;text-align:right;font-size:12px;color:var(--text-muted);">R. Imponible</td>
                </tr>
                <tr style="${tr0}">
                    <td style="padding:8px 12px;">CCAF (distribución de la cotización)</td>
                    <td style="padding:8px 12px;text-align:right;${mono}">4,20%</td>
                    <td style="padding:8px 12px;text-align:right;font-size:12px;color:var(--text-muted);">R. Imponible</td>
                </tr>
                <tr style="${tr0}">
                    <td style="padding:8px 12px;">FONASA (distribución de la cotización)</td>
                    <td style="padding:8px 12px;text-align:right;${mono}">2,80%</td>
                    <td style="padding:8px 12px;text-align:right;font-size:12px;color:var(--text-muted);">R. Imponible</td>
                </tr>
                <tr>
                    <td style="padding:8px 12px;color:var(--text-muted);">Isapre</td>
                    <td style="padding:8px 12px;text-align:right;font-size:12px;color:var(--text-muted);">≥ 7% según plan</td>
                    <td style="padding:8px 12px;text-align:right;font-size:12px;color:var(--text-muted);">R. Imponible</td>
                </tr>
            </tbody>
        </table>
    </div>

    <!-- Asignación Familiar -->
    <div ${card}>
        ${secHead('Asignación Familiar FONASA', 'montos por decreto')}
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead><tr style="background:${PVL};">
                <th style="${thL}">Tramo</th>
                <th style="${thR}">Renta bruta hasta</th>
                <th style="${thR}">Monto por carga</th>
            </tr></thead>
            <tbody>${asigHtml}</tbody>
            <tfoot><tr style="background:${PVL};border-top:1px solid ${PVB};">
                <td colspan="3" style="${foot}">
                    Tramo D (renta &gt; $ 1.439.668): $ 0 — sin derecho a asignación
                </td>
            </tr></tfoot>
        </table>
    </div>

    <!-- IU 2ª Categoría -->
    <div ${card} style="padding:0;overflow:hidden;grid-column:1/-1;">
        ${secHead('Impuesto Único 2ª Categoría — Tramos mensuales', `UTM: ${_fmtClp(utm)}`)}
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead><tr style="background:${PVL};">
                <th style="${thL}">Tramo en UTM</th>
                <th style="${thR}">Renta desde</th>
                <th style="${thR}">Renta hasta</th>
                <th style="${thR}">Tasa</th>
                <th style="${thR}">Rebaja</th>
            </tr></thead>
            <tbody>${tramosHtml}</tbody>
            <tfoot><tr style="background:${PVL};border-top:1px solid ${PVB};">
                <td colspan="5" style="${foot}">
                    Base imponible = renta imponible − AFP − salud − cesantía. Las rebajas se recalculan automáticamente con la UTM vigente.
                </td>
            </tr></tfoot>
        </table>
    </div>`;

    if (typeof REM !== 'undefined') {
        REM.UTM      = Math.round(utm);
        REM.TABLA_IU = tramos.map(t => ({
            desde: t.desde, hasta: t.hasta, tasa: t.tasa, rebaja: t.rebaja,
        }));
    }
}

window.renderPreviredTablas = renderPreviredTablas;
