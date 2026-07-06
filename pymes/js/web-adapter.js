'use strict';
/**
 * web-adapter.js — Reemplazo de window.electronAPI para la versión web/PWA.
 *
 * En Electron, window.electronAPI lo expone preload.js vía IPC al proceso
 * principal. En el navegador no existe ese puente, así que aquí lo recreamos
 * con equivalentes web (fetch, Blob, descargas, file pickers).
 *
 * Debe cargarse ANTES que el resto de los scripts que usan electronAPI.
 * Si ya existe (caso Electron), no se sobreescribe.
 */
(function () {
    if (window.electronAPI) return;   // estamos en Electron → no tocar

    // ── Helpers ───────────────────────────────────────────────
    function descargar(blob, nombre) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = nombre || 'descarga';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        return nombre || 'descarga';
    }

    function pickFile() {
        return new Promise(resolve => {
            const input = document.createElement('input');
            input.type = 'file';
            input.onchange = () => {
                const file = input.files[0];
                if (!file) { resolve(null); return; }
                const reader = new FileReader();
                reader.onload = e => resolve({ ruta: e.target.result, nombre: file.name });
                reader.onerror = () => resolve(null);
                reader.readAsDataURL(file);  // ruta = dataURL (base64)
            };
            input.click();
        });
    }

    // ── Indicadores (mindicador.cl — soporta CORS) ────────────
    const MIND = 'https://mindicador.cl/api';
    let _cacheMerc = null;

    async function obtenerMercado(forzar) {
        if (_cacheMerc && !forzar) return { ..._cacheMerc, desde_cache: true };
        const api = await fetch(MIND).then(r => r.json());

        const orden = ['ipc', 'ivp', 'dolar_intercambio', 'tpm', 'imacec', 'tasa_desempleo'];
        const indices = orden
            .filter(k => api[k] && api[k].valor !== undefined)
            .map(k => ({
                key: k, nombre: api[k].nombre, valor: api[k].valor,
                unidad: api[k].unidad_medida, fecha: (api[k].fecha || '').slice(0, 10),
            }));

        let uf_diaria = [], utm_serie = [];
        try {
            const ufS = await fetch(MIND + '/uf').then(r => r.json());
            if (Array.isArray(ufS.serie)) uf_diaria = ufS.serie.slice(0, 5).map(s => ({
                fecha: (s.fecha || '').slice(0, 10),
                periodo: new Date(s.fecha).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' }),
                valor: s.valor,
            }));
        } catch (_) {}
        try {
            const utmS = await fetch(MIND + '/utm').then(r => r.json());
            if (Array.isArray(utmS.serie)) utm_serie = utmS.serie.slice(0, 5).map(s => ({
                fecha: (s.fecha || '').slice(0, 7),
                periodo: new Date(s.fecha).toLocaleDateString('es-CL', { month: 'long', year: 'numeric' }),
                valor: s.valor,
            }));
        } catch (_) {}

        _cacheMerc = {
            fecha: api.fecha || null, fuente: 'mindicador.cl', indices,
            uf_oficial:    api.uf             ? { valor: api.uf.valor,             fecha: (api.uf.fecha   || '').slice(0, 10) } : null,
            utm_oficial:   api.utm            ? api.utm.valor                                                                   : null,
            sueldo_minimo: api.sueldo_minimo  ? api.sueldo_minimo.valor                                                        : null,
            uf_diaria, utm_serie,
            dolar: api.dolar ? api.dolar.valor : null,
            euro:  api.euro  ? api.euro.valor  : null,
        };
        return { ..._cacheMerc, desde_cache: false };
    }

    // ── API web equivalente a electronAPI ─────────────────────
    window.electronAPI = {
        // SQLite no existe en web → la app ya cae a localStorage.
        db: null,

        backup: { crear: async () => null },
        dialog: { guardar: async () => null, abrir: async () => null },

        app: {
            info:     async () => ({ version: '1.0.0-web', plataforma: 'web' }),
            producto: async () => (window.CONTAPP_PRODUCTO || { id: 'auditor', nombre: 'ContAPP Auditor' }),
        },

        archivo: {
            adjuntar:   () => pickFile(),
            abrir:      async (ruta) => { try { window.open(ruta, '_blank'); return null; } catch (e) { return e.message; } },
            leerBase64: async (ruta) => (ruta && ruta.includes(',')) ? ruta.split(',')[1] : ruta,
        },

        // En web: imprimir a PDF con el diálogo del navegador.
        pdf: { exportar: async (nombre) => { window.print(); return nombre || true; } },

        // En web: generar XLSX con SheetJS (cargado por CDN) y descargar.
        excel: {
            exportar: async ({ encabezado, headers, rows, nombre, hoja }) => {
                if (!window.XLSX) { alert('Exportación a Excel no disponible (SheetJS no cargó).'); return null; }
                const aoa = [];
                if (encabezado) [].concat(encabezado).forEach(line => aoa.push([line]));
                if (headers) aoa.push(headers);
                (rows || []).forEach(r => aoa.push(r));
                const ws = window.XLSX.utils.aoa_to_sheet(aoa);
                const wb = window.XLSX.utils.book_new();
                window.XLSX.utils.book_append_sheet(wb, ws, hoja || 'Hoja1');
                const out = window.XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
                return descargar(new Blob([out], { type: 'application/octet-stream' }), (nombre || 'reporte') + '.xlsx');
            },
        },

        // IA: llamada directa a Claude API desde el navegador.
        // La API key se guarda en localStorage (herramienta de uso profesional personal).
        ia: {
            setKey:    async (key) => { if (key) localStorage.setItem('_ia_api_key', key); return true; },
            borrarKey: async ()    => { localStorage.removeItem('_ia_api_key'); return true; },
            getKeySet: async ()    => !!localStorage.getItem('_ia_api_key'),
            consultar: async (opts) => {
                const key = localStorage.getItem('_ia_api_key');
                if (!key) return { ok: false, error: 'Sin API key configurada.' };
                try {
                    const resp = await fetch('https://api.anthropic.com/v1/messages', {
                        method: 'POST',
                        headers: {
                            'x-api-key':                                 key,
                            'anthropic-version':                         '2023-06-01',
                            'anthropic-dangerous-direct-browser-access': 'true',
                            'content-type':                              'application/json',
                        },
                        body: JSON.stringify({
                            model:      opts.model      || 'claude-haiku-4-5-20251001',
                            max_tokens: opts.max_tokens || 1024,
                            messages:   opts.messages,
                            ...(opts.system ? { system: opts.system } : {}),
                        }),
                    });
                    const data = await resp.json();
                    if (!resp.ok) return { ok: false, error: data.error?.message || 'Error API Claude' };
                    const texto = (data.content || []).map(b => b.text || '').join('');
                    let json = null;
                    if (opts.json) {
                        try {
                            const m = texto.match(/```json\s*([\s\S]*?)```/) || texto.match(/(\{[\s\S]*\})/);
                            json = m ? JSON.parse(m[1]) : JSON.parse(texto);
                        } catch (_) {}
                    }
                    return { ok: true, texto, ...(opts.json ? { json } : {}) };
                } catch (e) {
                    return { ok: false, error: e.message };
                }
            },
        },

        http: { get: async (url) => fetch(url).then(r => r.text()) },

        indicadores: {
            previred: async () => null,                       // scraping no posible en navegador
            mercado:  (forzar) => obtenerMercado(forzar),
            todo:     async (forzar) => ({ previred: null, mercado: await obtenerMercado(forzar).catch(() => null) }),
        },

        shell: { openExternal: async (url) => { window.open(url, '_blank'); } },

        on: () => {},   // sin eventos de menú en web
    };

    console.info('[web-adapter] electronAPI web inicializado (modo navegador/PWA).');
})();
