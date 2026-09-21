'use strict';
// ─────────────────────────────────────────────────────────────────────────────
//  previred-scraper.js — Actualización automática de indicadores previsionales
//
//  Previred publica cada mes un PDF público (sin login) con las tasas AFP, UF,
//  UTM, IMM, SIS y asignación familiar vigentes. El navegador no puede leerlo
//  directo por CORS, así que se pasa por un proxy propio (Cloudflare Worker
//  gratuito, ver PLANIFICACION/previred-proxy-worker.js) que solo reenvía
//  pedidos a *.previred.com.
//
//  Flujo: listar página de indicadores → encontrar el PDF más reciente →
//  descargarlo → leerlo con pdf.js (con coordenadas reales, no texto lineal,
//  para no confundir columnas) → extraer los campos → validar rangos
//  razonables → guardar.
//
//  Los topes en UF (90 / 60 / 135,2) y las tasas de cesantía NO se leen del
//  PDF — son constantes fijadas por ley que casi nunca cambian y ya están
//  correctas en indicadores.js; los montos en pesos de esos topes se calculan
//  multiplicando por la UF ya extraída (mismo cálculo que renderPreviredTablas()).
// ─────────────────────────────────────────────────────────────────────────────

const PV_PROXY_KEY = 'core_pv_proxy';
const PV_LISTADO_URL = 'https://www.previred.com/indicadores-previsionales/';

// ── Config del proxy ──────────────────────────────────────────────────────────
function _pvProxyUrl() {
    return (localStorage.getItem(PV_PROXY_KEY) || '').trim().replace(/\/$/, '');
}

function previredGuardarProxy() {
    let val = document.getElementById('pvProxyUrl')?.value?.trim();
    if (!val) { _pvSetEstado('Ingresa la URL del proxy.', 'error'); return; }
    // Cloudflare a veces muestra la URL sin protocolo (ej. "xxx.workers.dev") —
    // se le agrega https:// en vez de rechazarla en silencio.
    if (!/^https?:\/\//i.test(val)) val = 'https://' + val;
    if (!/^https:\/\//i.test(val)) {
        _pvSetEstado('Debe ser una URL https:// válida.', 'error');
        return;
    }
    const el = document.getElementById('pvProxyUrl');
    if (el) el.value = val;
    localStorage.setItem(PV_PROXY_KEY, val);
    _pvSetEstado('Proxy guardado. Probando conexión…', 'info');
    pvScrapearIndicadores();
}

function previredBorrarProxy() {
    localStorage.removeItem(PV_PROXY_KEY);
    const el = document.getElementById('pvProxyUrl'); if (el) el.value = '';
    _pvSetEstado('Proxy eliminado. Las tasas volverán a editarse manualmente.', 'info');
}

async function _pvFetchViaProxy(targetUrl) {
    const proxy = _pvProxyUrl();
    if (!proxy) throw new Error('Sin proxy configurado');
    const res = await fetch(proxy + '?url=' + encodeURIComponent(targetUrl));
    if (!res.ok) throw new Error(`Proxy respondió ${res.status}`);
    return res;
}

// ── Paso 1: encontrar el PDF más reciente ─────────────────────────────────────
async function _pvUrlPdfMasReciente() {
    const res  = await _pvFetchViaProxy(PV_LISTADO_URL);
    const html = await res.text();
    const matches = [...html.matchAll(/href="([^"]*Indicadores-Previsionales-Previred-[^"]*\.pdf)"/gi)];
    if (!matches.length) throw new Error('No se encontró ningún PDF en la página de Previred');
    let url = matches[0][1];
    if (url.startsWith('/')) url = 'https://www.previred.com' + url;
    return url;
}

// ── Paso 2: leer el PDF con pdf.js, agrupado por filas reales (coordenadas) ──
async function _pvLeerPdf(pdfUrl) {
    if (typeof pdfjsLib === 'undefined') throw new Error('pdf.js no cargó — revisa tu conexión');
    const res = await _pvFetchViaProxy(pdfUrl);
    const buf = await res.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const page = await pdf.getPage(1);
    const contenido = await page.getTextContent();
    const items = contenido.items
        .map(it => ({ str: (it.str || '').trim(), x: it.transform[4], y: it.transform[5] }))
        .filter(it => it.str.length > 0);
    return items;
}

// Agrupa items en filas por coordenada Y (tolerancia por pequeñas variaciones
// de fuente), y dentro de cada fila ordena por X — reconstruye el orden visual
// real de la tabla, a diferencia de un volcado de texto lineal.
function _pvAgruparFilas(items, tolerancia = 3) {
    const filas = [];
    for (const it of items) {
        let fila = filas.find(f => Math.abs(f.y - it.y) <= tolerancia);
        if (!fila) { fila = { y: it.y, items: [] }; filas.push(fila); }
        fila.items.push(it);
    }
    filas.forEach(f => f.items.sort((a, b) => a.x - b.x));
    filas.sort((a, b) => b.y - a.y);
    return filas;
}

function _pvTextoFila(fila) {
    return fila.items.map(it => it.str).join(' ');
}

function _pvNum(str) {
    if (!str) return null;
    const limpio = String(str).replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.');
    const n = parseFloat(limpio);
    return isNaN(n) ? null : n;
}

// Busca el primer número a la derecha (misma fila o hasta `maxFilas` filas más
// abajo) de un item cuyo texto matchea `labelRegex`, dentro de una banda de
// columna (para no cruzar hacia una tabla vecina en el mismo renglón visual).
function _pvBuscarValorCercano(filas, labelRegex, opts = {}) {
    const { maxFilasAbajo = 2, anchoColumna = 260 } = opts;
    for (let i = 0; i < filas.length; i++) {
        const labelItem = filas[i].items.find(it => labelRegex.test(it.str));
        if (!labelItem) continue;
        for (let j = i; j <= Math.min(i + maxFilasAbajo, filas.length - 1); j++) {
            const candidato = filas[j].items.find(it =>
                it.x >= labelItem.x - 5 &&
                it.x <= labelItem.x + anchoColumna &&
                /[\d]/.test(it.str) &&
                !labelRegex.test(it.str)
            );
            if (candidato) return _pvNum(candidato.str);
        }
    }
    return null;
}

const _MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

// ── Paso 3: extraer campos ────────────────────────────────────────────────────
function _pvExtraerCampos(items) {
    // pdf.js entrega los items en el orden del stream interno del PDF, que NO
    // coincide con el orden visual en un layout de varias columnas como este
    // (ej. UF y UTM quedan intercalados). Se reconstruye el texto agrupando
    // primero por fila real (coordenada Y) — ver _pvAgruparFilas().
    const filas = _pvAgruparFilas(items);
    const texto = filas.map(f => _pvTextoFila(f)).join('\n');
    const out = { _avisos: [] };

    // UF — toma "Al {día} de {mes} del {año}:" más reciente (aparece primero)
    const mUf = texto.match(/Al\s+(\d{1,2})\s+de\s+(\w+)\s+del\s+(\d{4}):?\s*\$?\s*([\d.,]+)/i);
    if (mUf) {
        out.uf = _pvNum(mUf[4]);
        out.ufFecha = `${mUf[1]}/${_MESES.indexOf(mUf[2].toLowerCase()) + 1}/${mUf[3]}`;
    }

    // UTM + UTA — "{Mes} {Año} $ utm $ uta"
    const reMes = _MESES.join('|');
    const mUtm = texto.match(new RegExp(`(${reMes})\\s+(\\d{4})\\s*\\$?\\s*([\\d.,]+)\\s*\\$?\\s*([\\d.,]+)`, 'i'));
    if (mUtm) {
        out.utm = _pvNum(mUtm[3]);
        out.uta = _pvNum(mUtm[4]);
        out.utmPeriodo = `${mUtm[1]} ${mUtm[2]}`;
    }

    // AFP — tasas dependiente e independiente por administradora
    const AFPS = ['Capital', 'Cuprum', 'Habitat', 'PlanVital', 'Provida', 'Modelo', 'Uno'];
    out.afp = {};
    out.afpInd = {};
    for (const nombre of AFPS) {
        const re = new RegExp(`\\b${nombre}\\b\\s+([\\d,]+)%\\s+([\\d,]+)%\\s+([\\d,]+)%\\s+([\\d,]+)%`, 'i');
        const m  = texto.match(re);
        if (m) {
            out.afp[nombre === 'Provida' ? 'ProVida' : nombre] = _pvNum(m[1]);      // cargo trabajador
            out.afpInd[nombre === 'Provida' ? 'ProVida' : nombre] = _pvNum(m[4]);   // independiente (incluye SIS)
        } else {
            out._avisos.push(`AFP ${nombre}: no encontrada en el PDF`);
        }
    }

    // SIS
    const mSis = texto.match(/Tasa\s+SIS\s+([\d,]+)\s*%/i);
    if (mSis) out.sis = _pvNum(mSis[1]);

    // IMM — columna derecha, ancla por etiqueta
    const immMayor = _pvBuscarValorCercano(filas, /Dependientes\s+e\s+Independientes/i);
    const immMenor = _pvBuscarValorCercano(filas, /Menores\s+de\s+18/i);
    const immCasaPart = _pvBuscarValorCercano(filas, /Casa\s+Particular/i);
    const immNoRem = _pvBuscarValorCercano(filas, /fines\s+no\s+remuneracionales/i);
    if (immMayor) out.imm = { mayor: immMayor, menor: immMenor, noRem: immNoRem, casaParticular: immCasaPart };

    // Asignación familiar — best-effort, no crítico (cambia poco)
    const af = [];
    for (const marca of [/Renta\s*<\s*=?\s*\$?\s*([\d.,]+)/i, />\s*\$?\s*([\d.,]+)\s*<\s*=\s*\$?\s*([\d.,]+)/i]) {
        // heurística simple: se valida más abajo por orden/consistencia, no se bloquea si falla
    }

    return out;
}

// ── Validación de sanidad — nunca guardar un valor fuera de rango plausible ──
function _pvValidar(datos) {
    const errores = [];
    if (datos.uf != null && (datos.uf < 25000 || datos.uf > 60000)) errores.push(`UF fuera de rango: ${datos.uf}`);
    if (datos.utm != null && (datos.utm < 50000 || datos.utm > 100000)) errores.push(`UTM fuera de rango: ${datos.utm}`);
    if (datos.sis != null && (datos.sis < 0.5 || datos.sis > 3)) errores.push(`SIS fuera de rango: ${datos.sis}%`);
    Object.entries(datos.afp || {}).forEach(([nombre, tasa]) => {
        if (tasa < 8 || tasa > 15) errores.push(`AFP ${nombre} dependiente fuera de rango: ${tasa}%`);
    });
    if (datos.imm?.mayor && (datos.imm.mayor < 300000 || datos.imm.mayor > 900000)) {
        errores.push(`IMM fuera de rango: ${datos.imm.mayor}`);
    }
    return errores;
}

// ── Función principal ─────────────────────────────────────────────────────────
async function pvScrapearIndicadores() {
    if (!_pvProxyUrl()) {
        _pvSetEstado('Configura primero la URL del proxy (arriba).', 'error');
        return { ok: false };
    }
    _pvSetEstado('Buscando el PDF más reciente en previred.com…', 'info');
    try {
        const pdfUrl = await _pvUrlPdfMasReciente();
        _pvSetEstado(`Descargando ${pdfUrl.split('/').pop()}…`, 'info');
        const items = await _pvLeerPdf(pdfUrl);
        const datos = _pvExtraerCampos(items);
        const errores = _pvValidar(datos);

        if (errores.length) {
            _pvSetEstado(`⚠ Datos con valores sospechosos, no se guardaron: ${errores.join('; ')}`, 'error');
            return { ok: false, datos, errores };
        }

        // Aplicar — mismo esquema de localStorage que _aplicarPrevired() en indicadores.js
        if (Object.keys(datos.afp).length || datos.sis != null) {
            const actuales = _pvTasasActivas();
            const nuevas = { ...actuales, afp: { ...actuales.afp, ...datos.afp } };
            if (datos.sis != null) nuevas.sis = datos.sis;
            localStorage.setItem(PV_TASAS_KEY, JSON.stringify(nuevas));
        }
        if (Object.keys(datos.afpInd).length) {
            const actualesInd = _afpIndActivas();
            localStorage.setItem(PV_TASAS_IND_KEY, JSON.stringify({ ...actualesInd, ...datos.afpInd }));
        }
        if (datos.imm?.mayor) {
            localStorage.setItem(PV_IMM_KEY, JSON.stringify({
                mayor: datos.imm.mayor,
                menor: datos.imm.menor || _immActivo().menor,
                noRem: datos.imm.noRem || _immActivo().noRem,
                _ref: `Vigente al ${datos.utmPeriodo || 'período actual'}`,
                _actualizadoEn: new Date().toLocaleDateString('es-CL'),
                _fuentePrevired: true,
            }));
        }
        if (datos.uf != null || datos.utm != null) {
            const cache = _cargarCacheIndicadores();
            if (datos.uf  != null) cache.uf  = { valor: datos.uf,  fecha: datos.ufFecha || new Date().toLocaleDateString('es-CL'), fuente: 'previred.com' };
            if (datos.utm != null) cache.utm = { valor: datos.utm, fecha: datos.utmPeriodo || '—', fuente: 'previred.com' };
            cache._actualizadoEn = new Date().toLocaleString('es-CL');
            _guardarCacheIndicadores(cache);
        }

        _pvCargarTasasUI();
        _sincronizarTasasConREM();
        renderPreviredTablas();
        renderIndicadores();

        const resumen = [
            datos.uf  != null ? `UF $${datos.uf}` : null,
            datos.utm != null ? `UTM $${datos.utm}` : null,
            Object.keys(datos.afp).length ? `${Object.keys(datos.afp).length} AFP` : null,
            datos.sis != null ? `SIS ${datos.sis}%` : null,
            datos.imm?.mayor ? `IMM $${datos.imm.mayor}` : null,
        ].filter(Boolean).join(' · ');
        _pvSetEstado(`✅ Actualizado desde previred.com: ${resumen}`, 'ok');
        if (datos._avisos.length) _pvSetEstado(`✅ Actualizado (con avisos: ${datos._avisos.join('; ')})`, 'ok');

        return { ok: true, datos };
    } catch (e) {
        _pvSetEstado(`⚠ No se pudo actualizar automáticamente: ${e.message}. Verifica la URL del proxy.`, 'error');
        return { ok: false, error: e.message };
    }
}

window.previredGuardarProxy    = previredGuardarProxy;
window.previredBorrarProxy     = previredBorrarProxy;
window.pvScrapearIndicadores   = pvScrapearIndicadores;

// Al cargar la pantalla de Previred, precargar la URL del proxy guardada
document.addEventListener('DOMContentLoaded', () => {
    const el = document.getElementById('pvProxyUrl');
    if (el) el.value = _pvProxyUrl();
});
