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

const _AFP_TASAS_BASE = {
    Capital:   11.44,
    Cuprum:    11.44,
    Habitat:   11.27,
    PlanVital: 11.16,
    ProVida:   11.45,
    Modelo:    10.58,
    Uno:       10.49,
};

const _TASAS_BASE = {
    sis:      1.49,
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

const PV_CREDS_KEY  = 'core_pv_creds';
const PV_TASAS_KEY  = 'core_pv_tasas';
const PV_ASIG_KEY   = 'core_pv_asig';
const PV_IMM_KEY    = 'core_pv_imm';

const _TOPE_AFP_UF = 81.6;
const _TOPE_SAL_UF = 126.0;

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
    grid.innerHTML = Object.entries(t.afp).map(([nombre, tasa]) => `
        <div class="pv-field">
            <label class="pv-label">${nombre}</label>
            <input id="pvAfp_${nombre}" type="number" step="0.01" min="0" value="${tasa}" class="pv-input">
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
    const utmFec = cache.utm?.fecha ? ` · UTM: ${cache.utm.fecha}` : '';

    const ref = document.getElementById('previredFechaRef');
    if (ref) ref.textContent = `(UTM: ${_fmtClp(utm)}${utmFec})`;

    const tasas      = _pvTasasActivas();
    const tramos     = _computeTramos(utm);
    const topeAfpClp = Math.round(tasas.topeAfp * uf);
    const topeSalClp = Math.round(tasas.topeSal * uf);

    const tramosHtml = tramos.map((t, i) => {
        const isExento  = t.tasa === 0;
        const desdeStr  = i === 0 ? '0' : _fmtN(t.desdeClp);
        const hastaStr  = t.hasta === Infinity ? 'y más' : _fmtClp(t.hastaClp);
        const tasaStr   = isExento ? 'Exento' : (t.tasa * 100).toFixed(1).replace('.', ',') + '%';
        const rebajaStr = isExento ? '—' : _fmtClp(t.rebaja);
        const utmStr    = t.hasta === Infinity
            ? `${t.desde} UTM en adelante`
            : i === 0 ? `hasta ${t.hasta} UTM` : `${t.desde} – ${t.hasta} UTM`;
        const tasaColor = isExento ? 'var(--positive)' : t.tasa >= 0.30 ? 'var(--negative)' : 'var(--text)';
        return `<tr style="border-bottom:1px solid var(--divider);">
            <td style="padding:7px 10px;font-size:11px;color:var(--text-muted);">${utmStr}</td>
            <td style="padding:7px 10px;text-align:right;font-family:'Courier New',monospace;font-size:12px;">${desdeStr}</td>
            <td style="padding:7px 10px;text-align:right;font-family:'Courier New',monospace;font-size:12px;">${hastaStr}</td>
            <td style="padding:7px 10px;text-align:right;font-family:'Courier New',monospace;font-weight:700;color:${tasaColor};">${tasaStr}</td>
            <td style="padding:7px 10px;text-align:right;font-family:'Courier New',monospace;font-size:12px;color:var(--text-muted);">${rebajaStr}</td>
        </tr>`;
    }).join('');

    const afpHtml = Object.entries(tasas.afp).map(([nombre, trab]) => `
        <tr style="border-bottom:1px solid var(--divider);">
            <td style="padding:8px 14px;font-weight:600;">${nombre}</td>
            <td style="padding:8px 14px;text-align:right;font-family:'Courier New',monospace;">${trab.toFixed(2).replace('.', ',')}%</td>
            <td style="padding:8px 14px;text-align:right;font-family:'Courier New',monospace;color:var(--text-muted);">${tasas.sis.toFixed(2).replace('.', ',')}%</td>
            <td style="padding:8px 14px;text-align:right;font-family:'Courier New',monospace;font-size:12px;color:var(--text-muted);">${_fmtClp(topeAfpClp)}</td>
        </tr>`).join('');

    const _afActiva = _asigFamActiva();
    const asigHtml = _afActiva.map((a, i) => `
        <tr style="border-bottom:${i < _afActiva.length - 1 ? '1px solid var(--divider)' : 'none'};">
            <td style="padding:8px 14px;font-weight:700;color:var(--accent);">Tramo ${a.tramo}</td>
            <td style="padding:8px 14px;text-align:right;font-family:'Courier New',monospace;">
                ${a.hastaClp === Infinity ? 'Sin límite' : _fmtClp(a.hastaClp)}</td>
            <td style="padding:8px 14px;text-align:right;font-family:'Courier New',monospace;font-weight:700;
                color:${a.montoClp > 0 ? 'var(--positive)' : 'var(--text-muted)'};">
                ${_fmtClp(a.montoClp)}</td>
        </tr>`).join('');

    const thStyle = 'padding:7px 12px;text-align:right;font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;border-bottom:1px solid var(--divider);white-space:nowrap;';
    const thL     = thStyle.replace('text-align:right', 'text-align:left');
    const secHead = (emoji, title, sub='') => `
        <div style="padding:12px 16px;background:var(--table-stripe);border-bottom:1px solid var(--divider);font-weight:700;font-size:13px;display:flex;align-items:baseline;gap:8px;">
            ${emoji} ${title}
            ${sub ? `<span style="font-size:11px;font-weight:400;color:var(--text-muted);">${sub}</span>` : ''}
        </div>`;

    el.innerHTML = `

    <!-- IU 2ª Categoría -->
    <div class="card" style="padding:0;overflow:hidden;grid-column:1/-1;">
        ${secHead('📋','Impuesto Único 2ª Categoría — Tramos mensuales',`calculado sobre UTM ${_fmtClp(utm)}`)}
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead><tr style="background:var(--table-stripe);">
                <th style="${thL}">Tramo en UTM</th>
                <th style="${thStyle}">Renta desde (CLP)</th>
                <th style="${thStyle}">Renta hasta (CLP)</th>
                <th style="${thStyle}">Tasa</th>
                <th style="${thStyle}">Rebaja (CLP)</th>
            </tr></thead>
            <tbody>${tramosHtml}</tbody>
            <tfoot><tr style="background:var(--table-stripe);border-top:2px solid var(--divider);">
                <td colspan="5" style="padding:8px 12px;font-size:11px;color:var(--text-muted);">
                    Base imponible = renta imponible − AFP − salud − cesantía.
                    Las rebajas en CLP se recalculan automáticamente con cada actualización de UTM.
                </td>
            </tr></tfoot>
        </table>
    </div>

    <!-- AFP -->
    <div class="card" style="padding:0;overflow:hidden;">
        ${secHead('🏦','AFP — Tasas de cotización','actualizadas automáticamente desde previred.com')}
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead><tr style="background:var(--table-stripe);">
                <th style="${thL}">Institución</th>
                <th style="${thStyle}">Trabajador</th>
                <th style="${thStyle}">SIS (empleador)</th>
                <th style="${thStyle}">Tope (${_TOPE_AFP_UF} UF)</th>
            </tr></thead>
            <tbody>${afpHtml}</tbody>
            <tfoot><tr style="background:var(--table-stripe);border-top:2px solid var(--divider);">
                <td colspan="4" style="padding:8px 14px;font-size:11px;color:var(--text-muted);">
                    Tope imponible AFP: ${_TOPE_AFP_UF} UF = ${_fmtClp(topeAfpClp)} · UF al ${cache.uf?.fecha || '—'}
                </td>
            </tr></tfoot>
        </table>
    </div>

    <!-- Cesantía + Salud -->
    <div style="display:flex;flex-direction:column;gap:16px;">

        <div class="card" style="padding:0;overflow:hidden;">
            ${secHead('🛡️','Seguro de Cesantía')}
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <thead><tr style="background:var(--table-stripe);">
                    <th style="${thL}">Tipo contrato</th>
                    <th style="${thStyle}">Trabajador</th>
                    <th style="${thStyle}">Empleador</th>
                </tr></thead>
                <tbody>
                    <tr style="border-bottom:1px solid var(--divider);">
                        <td style="padding:8px 14px;">Indefinido</td>
                        <td style="padding:8px 14px;text-align:right;font-family:'Courier New',monospace;">0,60%</td>
                        <td style="padding:8px 14px;text-align:right;font-family:'Courier New',monospace;">2,40%</td>
                    </tr>
                    <tr>
                        <td style="padding:8px 14px;">Plazo fijo / obra</td>
                        <td style="padding:8px 14px;text-align:right;font-family:'Courier New',monospace;color:var(--text-muted);">—</td>
                        <td style="padding:8px 14px;text-align:right;font-family:'Courier New',monospace;">3,00%</td>
                    </tr>
                </tbody>
                <tfoot><tr style="background:var(--table-stripe);border-top:2px solid var(--divider);">
                    <td colspan="3" style="padding:8px 14px;font-size:11px;color:var(--text-muted);">
                        Mutual de seguridad (empleador): 0,90%
                    </td>
                </tr></tfoot>
            </table>
        </div>

        <div class="card" style="padding:0;overflow:hidden;">
            ${secHead('🏥','Cotización de Salud')}
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <tbody>
                    <tr style="border-bottom:1px solid var(--divider);">
                        <td style="padding:8px 14px;">Fonasa (mínimo legal)</td>
                        <td style="padding:8px 14px;text-align:right;font-family:'Courier New',monospace;font-weight:700;">7,00%</td>
                    </tr>
                    <tr>
                        <td style="padding:8px 14px;">Isapre</td>
                        <td style="padding:8px 14px;text-align:right;font-size:12px;color:var(--text-muted);">≥ 7% según plan</td>
                    </tr>
                </tbody>
                <tfoot><tr style="background:var(--table-stripe);border-top:2px solid var(--divider);">
                    <td colspan="2" style="padding:8px 14px;font-size:11px;color:var(--text-muted);">
                        Tope: ${_TOPE_SAL_UF} UF = ${_fmtClp(topeSalClp)} · UF al ${cache.uf?.fecha || '—'}
                    </td>
                </tr></tfoot>
            </table>
        </div>

    </div>

    <!-- Asignación Familiar -->
    <div class="card" style="padding:0;overflow:hidden;">
        ${secHead('👨‍👩‍👧','Asignación Familiar FONASA','montos por decreto · actualizados desde previred.com')}
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead><tr style="background:var(--table-stripe);">
                <th style="${thL}">Tramo</th>
                <th style="${thStyle}">Renta bruta hasta</th>
                <th style="${thStyle}">Monto por carga</th>
            </tr></thead>
            <tbody>${asigHtml}</tbody>
            <tfoot><tr style="background:var(--table-stripe);border-top:2px solid var(--divider);">
                <td colspan="3" style="padding:8px 14px;font-size:11px;color:var(--text-muted);">
                    Se aplica sobre la renta bruta mensual. Datos obtenidos automáticamente de previred.com.
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
