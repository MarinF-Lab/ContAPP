'use strict';
// ─────────────────────────────────────────────────────────────────────────────
//  SII RCV — Descarga automática del Registro de Compras y Ventas
//
//  La API del SII requiere autenticación con RUT + clave tributaria.
//  Limitación web: el SII no tiene CORS habilitado, por lo que las llamadas
//  directas desde el browser son bloqueadas. Solución:
//    - Electron: fetch directo (sin CORS)
//    - Web: proxy configurable (Cloudflare Worker, nginx local, etc.)
//
//  Proxy mínimo (Cloudflare Worker gratuito, 5 líneas):
//    export default { fetch: req => fetch(new URL(req.url).searchParams.get('url'),
//      { headers: { cookie: new URL(req.url).searchParams.get('cookie') } }) }
// ─────────────────────────────────────────────────────────────────────────────

const SII_BASE        = 'https://hercules.sii.cl';
const SII_RCV_BASE    = 'https://www4.sii.cl';
const SII_RCV_KEY     = 'sii_rcv_config';   // config local (proxy URL, no guarda clave)

// ── Config ────────────────────────────────────────────────────────────────────

function _rcvCfg() {
    try { return JSON.parse(localStorage.getItem(SII_RCV_KEY) || '{}'); } catch { return {}; }
}
function _rcvGuardarCfg(cfg) {
    localStorage.setItem(SII_RCV_KEY, JSON.stringify(cfg));
}

function _rcvProxyUrl(url, cookie) {
    const cfg = _rcvCfg();
    if (window.electronAPI) return url;   // Electron: sin proxy
    const proxy = cfg.proxyUrl;
    if (!proxy) return null;
    return `${proxy}?url=${encodeURIComponent(url)}&cookie=${encodeURIComponent(cookie || '')}`;
}

// ── Autenticación SII ─────────────────────────────────────────────────────────

/**
 * Autentica en el SII y devuelve el token de sesión.
 * rut: '76123456' (sin DV), dv: '7', clave: 'miClave'
 */
async function siiAutenticar(rut, dv, clave) {
    const url = `${SII_BASE}/cgi_AUT2000/autInicio.cgi`;

    const body = new URLSearchParams({
        rut,
        dv,
        clave,
        referencia: SII_RCV_BASE,
    });

    const fetchUrl = _rcvProxyUrl(url, '');
    if (!fetchUrl) throw new Error('Configura el proxy SII en Ajustes → Integración SII.');

    const resp = await fetch(fetchUrl, {
        method:      'POST',
        body,
        credentials: window.electronAPI ? 'include' : 'omit',
        headers:     { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    if (!resp.ok) throw new Error(`Error de autenticación SII (${resp.status})`);

    // El token viene en el header Set-Cookie como "token=XXXX"
    const setCookie = resp.headers.get('set-cookie') || '';
    const match     = setCookie.match(/token=([^;]+)/);
    if (!match) {
        // También puede venir en el body como redirect con token en URL
        const text = await resp.text();
        const urlMatch = text.match(/token=([A-Za-z0-9+/=_-]{20,})/);
        if (!urlMatch) throw new Error('SII no devolvió token. Verifica RUT y clave.');
        return urlMatch[1];
    }
    return match[1];
}

// ── Descarga RCV ──────────────────────────────────────────────────────────────

/**
 * Descarga el RCV de compras y/o ventas para un período dado.
 * periodo: 'YYYY-MM'
 * tipo: 'COMPRA' | 'VENTA' | 'AMBOS'
 * Retorna { compras: [], ventas: [] } con documentos normalizados
 */
async function siiDescargarRCV(rut, dv, clave, periodo, tipo = 'AMBOS') {
    const token = await siiAutenticar(rut, dv, clave);

    const rutFull = `${rut}-${dv}`;
    const resultado = { compras: [], ventas: [] };

    const tiposADescargar = tipo === 'AMBOS' ? ['COMPRA', 'VENTA'] : [tipo];

    for (const tipoMov of tiposADescargar) {
        const url = `${SII_RCV_BASE}/consdtcinternetui/services/data/rcvConsulta` +
            `?rutContribuyente=${rut}&dvContribuyente=${dv}` +
            `&periodoTributario=${periodo}&tipoMovimiento=${tipoMov}`;

        const fetchUrl = _rcvProxyUrl(url, `token=${token}`);
        if (!fetchUrl) throw new Error('Proxy no configurado.');

        const resp = await fetch(fetchUrl, {
            credentials: window.electronAPI ? 'include' : 'omit',
        });

        if (!resp.ok) throw new Error(`Error descargando RCV ${tipoMov} (${resp.status})`);

        const json = await resp.json();
        const docs = _rcvParsearRespuesta(json, tipoMov, rutFull);

        if (tipoMov === 'COMPRA') resultado.compras = docs;
        else                      resultado.ventas  = docs;
    }

    return resultado;
}

/**
 * Parsea la respuesta JSON del RCV del SII al formato normalizado interno.
 * La estructura real del JSON del SII varía ligeramente entre endpoints;
 * este parser maneja las dos variantes conocidas.
 */
function _rcvParsearRespuesta(json, tipoMov, rutEmpresa) {
    // El SII devuelve { data: { detalleCompra: [...] } } o { detalleVenta: [...] }
    const lista =
        json?.data?.detalleCompra  ||
        json?.data?.detalleVenta   ||
        json?.detalle              ||
        json?.data                 ||
        (Array.isArray(json) ? json : []);

    return lista.map(item => {
        // Campos del RCV JSON del SII (nombres reales del API)
        const tipoDTE = parseInt(item.tipoDoc || item.codDocumento || 0);
        const folio   = String(item.folio || item.nroDocumento || '');
        const fechaRaw= item.fchEmision || item.fechaEmision || item.fchDoc || '';
        const fecha   = _rcvNormalizarFecha(fechaRaw);

        const rutContra = _rcvLimpiarRut(
            tipoMov === 'COMPRA'
                ? (item.rutProveedor || item.rutEmisor || '')
                : (item.rutCliente   || item.rutReceptor || '')
        );
        const razon = tipoMov === 'COMPRA'
            ? (item.razonSocialProveedor || item.razonSocialEmisor || '')
            : (item.razonSocialCliente   || item.razonSocialReceptor || '');

        const neto   = Math.round(parseFloat(item.mntNeto    || 0));
        const iva    = Math.round(parseFloat(item.mntIva     || 0));
        const exento = Math.round(parseFloat(item.mntExento  || 0));
        const total  = Math.round(parseFloat(item.mntTotal   || 0)) || (neto + iva + exento);

        const info  = (window.SII_TIPOS || {})[tipoDTE] || { nombre: `DTE ${tipoDTE}`, libro: tipoMov === 'COMPRA' ? 'compras' : 'ventas' };
        const glosa = `${info.nombre} N°${folio} — ${razon}`;

        return {
            fromRCV:    true,
            libro:      tipoMov === 'COMPRA' ? 'compras' : 'ventas',
            tipoDTE,
            tipoNombre: info.nombre,
            folio,
            fecha,
            rutEmisor:  tipoMov === 'COMPRA' ? rutContra : rutEmpresa,
            razEmisor:  tipoMov === 'COMPRA' ? razon     : '',
            rutRecep:   tipoMov === 'VENTA'  ? rutContra : rutEmpresa,
            razRecep:   tipoMov === 'VENTA'  ? razon     : '',
            neto, iva, exento, total, glosa,
        };
    }).filter(d => d.folio && d.total);
}

function _rcvNormalizarFecha(raw) {
    if (!raw) return '';
    // YYYY-MM-DD → DD/MM/YYYY
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
    // DD/MM/YYYY ya correcto
    if (/^\d{2}\/\d{2}\/\d{4}/.test(raw)) return raw;
    return raw;
}

function _rcvLimpiarRut(rut) {
    return (rut || '').replace(/\./g, '').replace(/^0+/, '');
}

// ── Inserción en módulos ──────────────────────────────────────────────────────

function _rcvInsertar(docs) {
    let newC = 0, newV = 0;

    const compras = docs.filter(d => d.libro === 'compras');
    const ventas  = docs.filter(d => d.libro === 'ventas');

    if (compras.length) {
        const key    = 'core_compras';
        const actual = JSON.parse(localStorage.getItem(key) || '[]');
        const nuevas = compras.map(siiDocACompra).filter(d =>
            !actual.some(a => a.folio === d.folio && a.rut === d.rut)
        );
        localStorage.setItem(key, JSON.stringify([...actual, ...nuevas]));
        newC = nuevas.length;
    }

    if (ventas.length) {
        const key    = 'core_ventas';
        const actual = JSON.parse(localStorage.getItem(key) || '[]');
        const nuevas = ventas.map(siiDocAVenta).filter(d =>
            !actual.some(a => a.folio === d.folio && a.rut === d.rut)
        );
        localStorage.setItem(key, JSON.stringify([...actual, ...nuevas]));
        newV = nuevas.length;
    }

    // También en Documentación
    const docReg = siiRegistrarEnDocumentos(docs);

    return { compras: newC, ventas: newV, documentos: docReg };
}

// ── UI ────────────────────────────────────────────────────────────────────────

function siiAbrirRCV() {
    document.getElementById('sii-rcv-modal')?.remove();

    const cfg     = _rcvCfg();
    const cfgApp  = JSON.parse(localStorage.getItem('core_config') || '{}');
    const rutFull = (cfgApp.rut || '').replace(/\./g, '');
    const partes  = rutFull.split('-');
    const rut     = partes[0] || '';
    const dv      = partes[1] || '';

    const hoy     = new Date();
    const periodo = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;

    const modal = document.createElement('div');
    modal.id    = 'sii-rcv-modal';
    modal.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;
        display:flex;align-items:center;justify-content:center;padding:16px;`;

    modal.innerHTML = `
    <div style="background:var(--card);border-radius:16px;padding:28px;width:100%;max-width:480px;
                box-shadow:0 20px 60px rgba(0,0,0,.3);">

        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
            <div>
                <div style="font-size:17px;font-weight:700;color:var(--text);">Descargar desde SII</div>
                <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">RCV — Registro de Compras y Ventas</div>
            </div>
            <button onclick="document.getElementById('sii-rcv-modal').remove()"
                style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text-muted);">✕</button>
        </div>

        <div style="display:grid;gap:12px;">

            <div style="display:grid;grid-template-columns:1fr 60px;gap:8px;">
                <div>
                    <label style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;display:block;margin-bottom:4px;">RUT empresa</label>
                    <input id="rcvRut" value="${rut}" placeholder="76123456"
                        style="width:100%;padding:9px 12px;border:1px solid var(--divider);border-radius:8px;
                               background:var(--input-bg);color:var(--text);font-size:13px;box-sizing:border-box;">
                </div>
                <div>
                    <label style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;display:block;margin-bottom:4px;">DV</label>
                    <input id="rcvDv" value="${dv}" placeholder="7" maxlength="1"
                        style="width:100%;padding:9px 12px;border:1px solid var(--divider);border-radius:8px;
                               background:var(--input-bg);color:var(--text);font-size:13px;box-sizing:border-box;">
                </div>
            </div>

            <div>
                <label style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;display:block;margin-bottom:4px;">Clave SII</label>
                <input id="rcvClave" type="password" placeholder="Clave tributaria (no se guarda)"
                    style="width:100%;padding:9px 12px;border:1px solid var(--divider);border-radius:8px;
                           background:var(--input-bg);color:var(--text);font-size:13px;box-sizing:border-box;">
                <div style="font-size:10px;color:var(--text-muted);margin-top:4px;">La clave se usa solo para esta descarga y no se almacena.</div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                <div>
                    <label style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;display:block;margin-bottom:4px;">Período</label>
                    <input id="rcvPeriodo" type="month" value="${periodo}"
                        style="width:100%;padding:9px 12px;border:1px solid var(--divider);border-radius:8px;
                               background:var(--input-bg);color:var(--text);font-size:13px;box-sizing:border-box;">
                </div>
                <div>
                    <label style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;display:block;margin-bottom:4px;">Tipo</label>
                    <select id="rcvTipo"
                        style="width:100%;padding:9px 12px;border:1px solid var(--divider);border-radius:8px;
                               background:var(--input-bg);color:var(--text);font-size:13px;box-sizing:border-box;">
                        <option value="AMBOS">Compras y Ventas</option>
                        <option value="COMPRA">Solo Compras</option>
                        <option value="VENTA">Solo Ventas</option>
                    </select>
                </div>
            </div>

            ${!window.electronAPI ? `
            <div>
                <label style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;display:block;margin-bottom:4px;">
                    URL Proxy CORS <span style="color:var(--negative);font-size:10px;">Requerido en web</span>
                </label>
                <input id="rcvProxy" value="${cfg.proxyUrl || ''}" placeholder="https://mi-proxy.workers.dev"
                    style="width:100%;padding:9px 12px;border:1px solid var(--divider);border-radius:8px;
                           background:var(--input-bg);color:var(--text);font-size:13px;box-sizing:border-box;">
                <div style="font-size:10px;color:var(--text-muted);margin-top:4px;">
                    El SII bloquea peticiones desde el browser. Necesitas un proxy que reenvíe las llamadas.
                    <a href="#" onclick="siiMostrarGuiaProxy();return false"
                       style="color:var(--accent);">Ver cómo configurarlo →</a>
                </div>
            </div>` : `
            <div style="background:var(--positive-soft,#d1fae5);border-radius:8px;padding:10px 12px;
                        font-size:12px;color:var(--positive,#059669);">
                ✓ Modo Electron — conexión directa al SII, no necesitas proxy.
            </div>`}

        </div>

        <div id="rcvEstado" style="display:none;margin-top:14px;padding:10px 14px;border-radius:8px;
             font-size:13px;background:var(--table-stripe);color:var(--text-muted);"></div>

        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px;">
            <button onclick="document.getElementById('sii-rcv-modal').remove()"
                style="padding:9px 18px;border:1px solid var(--divider);border-radius:8px;
                       background:none;color:var(--text);cursor:pointer;font-size:13px;">Cancelar</button>
            <button onclick="siiEjecutarDescargaRCV()"
                style="padding:9px 22px;border:none;border-radius:8px;background:var(--accent);
                       color:#fff;cursor:pointer;font-size:13px;font-weight:600;">
                ⬇ Descargar RCV
            </button>
        </div>
    </div>`;

    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

async function siiEjecutarDescargaRCV() {
    const rut    = document.getElementById('rcvRut')?.value.trim().replace(/\./g,'');
    const dv     = document.getElementById('rcvDv')?.value.trim();
    const clave  = document.getElementById('rcvClave')?.value;
    const periodo= document.getElementById('rcvPeriodo')?.value;
    const tipo   = document.getElementById('rcvTipo')?.value || 'AMBOS';
    const proxy  = document.getElementById('rcvProxy')?.value.trim();

    if (!rut || !dv)   return mostrarToast('Ingresa el RUT y DV.', 'error');
    if (!clave)        return mostrarToast('Ingresa la clave SII.', 'error');
    if (!periodo)      return mostrarToast('Selecciona el período.', 'error');
    if (!window.electronAPI && !proxy) return mostrarToast('Configura el proxy CORS.', 'error');

    // Guardar proxy (no la clave)
    if (proxy) _rcvGuardarCfg({ ..._rcvCfg(), proxyUrl: proxy });

    const estadoEl = document.getElementById('rcvEstado');
    const _estado  = msg => { if (estadoEl) { estadoEl.style.display='block'; estadoEl.textContent = msg; } };

    try {
        _estado('🔐 Autenticando en el SII…');
        const res = await siiDescargarRCV(rut, dv, clave, periodo, tipo);

        const total = res.compras.length + res.ventas.length;
        if (!total) {
            _estado('El SII no devolvió documentos para ese período.');
            return;
        }

        _estado(`📥 Insertando ${total} documento(s)…`);
        const ins = _rcvInsertar([...res.compras, ...res.ventas]);

        document.getElementById('sii-rcv-modal')?.remove();
        mostrarToast(
            `RCV descargado: ${ins.compras} compras, ${ins.ventas} ventas importadas.`,
            'ok'
        );

        if (typeof renderCompras    === 'function') renderCompras();
        if (typeof renderVentas     === 'function') renderVentas();
        if (typeof renderDocumentos === 'function') renderDocumentos();

    } catch(e) {
        _estado('❌ ' + e.message);
    }
}

function siiMostrarGuiaProxy() {
    const existente = document.getElementById('siiGuiaProxyModal');
    if (existente) { existente.style.display = 'flex'; return; }

    const modal = document.createElement('div');
    modal.id = 'siiGuiaProxyModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
    <div class="modal-box" style="width:560px;max-height:80vh;overflow-y:auto;">
        <h3 style="margin-top:0;">🔧 Configurar Proxy CORS (Cloudflare Workers)</h3>
        <ol style="line-height:2;color:var(--text-muted);font-size:13px;">
            <li>Ve a <strong>workers.cloudflare.com</strong> → crear cuenta gratis</li>
            <li>Crea un nuevo Worker y pega este código:</li>
        </ol>
        <pre style="background:var(--input-bg);border:1px solid var(--divider);border-radius:8px;padding:12px;font-size:11px;font-family:'JetBrains Mono',monospace;overflow-x:auto;color:var(--text);margin:0 0 12px;">export default {
  async fetch(req) {
    const p = new URL(req.url).searchParams;
    const url = p.get('url');
    const cookie = p.get('cookie') || '';
    if (!url) return new Response('Falta url', { status: 400 });
    return fetch(url, {
      method: req.method,
      headers: { cookie, 'Content-Type': req.headers.get('Content-Type') || '' },
      body: req.method !== 'GET' ? req.body : undefined,
    });
  }
}</pre>
        <ol start="3" style="line-height:2;color:var(--text-muted);font-size:13px;">
            <li>Copia la URL del Worker<br><small style="color:var(--text-subtle);">Ej: https://mi-proxy.tu-usuario.workers.dev</small></li>
            <li>Pégala en el campo <strong>"URL Proxy CORS"</strong> de esta pantalla.</li>
        </ol>
        <div style="text-align:right;margin-top:16px;">
            <button class="btn btn-primary" onclick="document.getElementById('siiGuiaProxyModal').style.display='none'">Entendido</button>
        </div>
    </div>`;
    document.body.appendChild(modal);
}

// ── Expose ────────────────────────────────────────────────────────────────────
window.siiAbrirRCV              = siiAbrirRCV;
window.siiEjecutarDescargaRCV   = siiEjecutarDescargaRCV;
window.siiDescargarRCV          = siiDescargarRCV;
window.siiMostrarGuiaProxy      = siiMostrarGuiaProxy;
