'use strict';
// ─────────────────────────────────────────────────────────────────────────────
//  ia.js — Integración Google Gemini (gratuito, REST directo)
//  API key almacenada en localStorage. No se envía a servidores propios.
// ─────────────────────────────────────────────────────────────────────────────

const _IA_KEY_LS   = '_gemini_key';
const _IA_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent';
const _IA_FALLBACK = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent';

// ── Gestión de key ────────────────────────────────────────────────────────────

function _iaGetKey() {
    return localStorage.getItem(_IA_KEY_LS) || '';
}

function iaGuardarApiKey() {
    const input = document.getElementById('iaApiKeyInput');
    const key   = (input?.value || '').trim();
    if (!key) { mostrarToast('Ingresa una API key válida.', 'error'); return; }
    localStorage.setItem(_IA_KEY_LS, key);
    if (input) input.value = '';
    iaVerificarKeyAlCargar();
    mostrarToast('API key de Gemini guardada.', 'ok');
}

function iaBorrarApiKey() {
    mostrarConfirm('¿Eliminar la API key de Gemini?', () => {
        localStorage.removeItem(_IA_KEY_LS);
        iaVerificarKeyAlCargar();
        mostrarToast('API key eliminada.', 'ok');
    });
}

function iaVerificarKeyAlCargar() {
    const el  = document.getElementById('iaKeyEstado');
    const key = _iaGetKey();
    if (el) {
        if (key) {
            const oculta = key.slice(0, 6) + '••••••••••••' + key.slice(-4);
            el.innerHTML = `<span style="color:var(--positive,#166534);">✅ Key configurada: <code>${oculta}</code></span>`;
        } else {
            el.textContent = '⚠️ Sin API key — ingresa tu key de Google AI Studio para activar las funciones de IA.';
        }
    }
    // Mostrar/ocultar botones IA de glosa (tab principal del Diario y modal de Asiento Manual)
    ['btnIaGlosaPrincipal', 'btnIaGlosaManual'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.style.display = key ? '' : 'none';
    });
}

// ── Llamada base ──────────────────────────────────────────────────────────────

async function _iaConsultar(prompt, maxTokens = 1024) {
    const key = _iaGetKey();
    if (!key) {
        mostrarToast('Configura tu API key de Gemini en Configuración → IA.', 'error');
        return null;
    }
    const body = JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: maxTokens }
    });
    const headers = { 'Content-Type': 'application/json', 'X-goog-api-key': key };

    // Intenta con el modelo primario; si falla con 404 prueba el fallback
    for (const url of [_IA_ENDPOINT, _IA_FALLBACK]) {
        try {
            const res  = await fetch(url, { method: 'POST', headers, body });
            if (res.status === 404) continue;          // modelo no disponible, probar fallback
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                mostrarToast('Gemini: ' + (err?.error?.message || `Error HTTP ${res.status}`), 'error');
                return null;
            }
            const data = await res.json();
            return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
        } catch {
            mostrarToast('Error de red al consultar Gemini.', 'error');
            return null;
        }
    }
    mostrarToast('Modelo Gemini no disponible. Verifica tu key.', 'error');
    return null;
}

// ── Funciones de dominio contable ─────────────────────────────────────────────

async function iaAlertasTribu() {
    const cfg     = JSON.parse(localStorage.getItem('core_config') || '{}');
    const empresa = cfg.empresa || 'la empresa';
    const rut     = cfg.rut     ? ` (RUT ${cfg.rut})`     : '';
    const giro    = cfg.giro    ? `, giro: ${cfg.giro}`    : '';
    const periodo = cfg.periodo ? `, período: ${cfg.periodo}` : '';

    mostrarToast('Consultando Gemini…', 'info');
    const respuesta = await _iaConsultar(
        `Eres un contador chileno experto en tributación. Analiza la situación de ` +
        `${empresa}${rut}${giro}${periodo} y lista en formato de viñetas las ` +
        `obligaciones tributarias mensuales y anuales más comunes ante el SII, ` +
        `incluyendo fechas típicas de vencimiento. Responde en español, sé conciso y práctico.`
    );
    if (respuesta) _iaMostrarResultado('⚠️ Alertas Tributarias', respuesta);
}

async function iaVerificarConsistencia() {
    mostrarToast('Consultando Gemini…', 'info');
    const respuesta = await _iaConsultar(
        `Eres un auditor contable chileno. Lista en viñetas breves los principales ` +
        `controles de consistencia que se deben verificar entre el Libro Diario, ` +
        `Libro Mayor, Balance de Comprobación y los libros auxiliares de Compras y Ventas. ` +
        `Responde en español.`
    );
    if (respuesta) _iaMostrarResultado('🔍 Verificación de Consistencia', respuesta);
}

async function iaAnalizarGlosa(texto) {
    if (!texto?.trim()) return null;
    const respuesta = await _iaConsultar(
        `Eres un contador chileno. Para la siguiente glosa contable, sugiere el código ` +
        `y nombre de cuenta del Plan de Cuentas chileno más apropiado. ` +
        `Responde SOLO en formato JSON sin explicaciones adicionales: ` +
        `{"codigo":"XXXX","nombre":"Nombre cuenta","tipo":"activo|pasivo|patrimonio|ingreso|gasto"}.\n` +
        `Glosa: "${texto}"`,
        256
    );
    if (!respuesta) return null;
    try {
        const match = respuesta.match(/\{[\s\S]*?\}/);
        return match ? JSON.parse(match[0]) : null;
    } catch { return null; }
}

// ── Integración Libro Diario ──────────────────────────────────────────────────

async function iaSugerirCuentaGlosa(inputId = 'glosaManual', btnId = 'btnIaGlosaManual', divId = 'iaGlosaSugerencia') {
    const glosa = document.getElementById(inputId)?.value?.trim();
    if (!glosa) { mostrarToast('Escribe una glosa primero.', 'error'); return; }

    const btn = document.getElementById(btnId);
    const div = document.getElementById(divId);
    if (btn) btn.disabled = true;

    const resultado = await iaAnalizarGlosa(glosa);

    if (btn) btn.disabled = false;
    if (!resultado) { if (div) div.style.display = 'none'; return; }

    if (div) {
        div.style.display = '';
        div.innerHTML = `✨ Sugerencia: <strong>${resultado.codigo}</strong> — ${resultado.nombre} <em style="opacity:.7">(${resultado.tipo})</em>`;
    }
}

async function iaSugerirCuentaGlosaPrincipal() {
    return iaSugerirCuentaGlosa('glosaInput', 'btnIaGlosaPrincipal', 'iaGlosaSugerenciaPrincipal');
}

// ── Modal de resultado ────────────────────────────────────────────────────────

function _iaMostrarResultado(titulo, texto) {
    const lineas = texto.split('\n').map(l => {
        l = l.trim();
        if (!l) return '';
        if (l.startsWith('* ') || l.startsWith('- ') || l.startsWith('• '))
            return `<li style="margin-bottom:6px;">${l.slice(2)}</li>`;
        if (/^\*\*(.+)\*\*$/.test(l))
            return `<strong>${l.replace(/\*\*/g, '')}</strong>`;
        return `<p style="margin-bottom:6px;">${l}</p>`;
    });
    const html = lineas.join('').replace(/(<li[^>]*>[\s\S]*?<\/li>\s*)+/g,
        m => `<ul style="padding-left:20px;margin:8px 0;">${m}</ul>`);

    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
    modal.innerHTML = `
        <div style="background:var(--bg);border-radius:12px;padding:28px;max-width:640px;width:100%;max-height:80vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.3);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                <h2 style="margin:0;font-size:16px;">${titulo}</h2>
                <button onclick="this.closest('[style*=fixed]').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text-muted);">×</button>
            </div>
            <div style="font-size:13px;line-height:1.6;color:var(--text);">${html}</div>
            <div style="margin-top:16px;text-align:right;">
                <button class="btn btn-secondary" onclick="this.closest('[style*=fixed]').remove()">Cerrar</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

// ── Modal de alerta (duplicado / monto inusual) ───────────────────────────────
// iaVerificarAsiento()/iaCheckAntesDeGuardar() quedan disponibles pero
// deliberadamente NO están conectadas al guardado real de asientos en
// diario.js — hacerlo agregaría una consulta a Gemini (latencia + costo de
// API) antes de cada guardado, hoy instantáneo. Es una decisión de producto,
// no parte de este arreglo (que solo restaura las funciones que faltaban).

async function iaVerificarAsiento(asiento) {
    const asientosRecientes = (window.dbAsientos || [])
        .filter(a => a.estado === 'ACTIVO')
        .slice(-30)
        .map(a => ({ glosa: a.glosa, total: (a.movimientos || []).reduce((s, m) => s + (m.debe || 0), 0) }));
    const totalNuevo = (asiento.movimientos || []).reduce((s, m) => s + (m.debe || 0), 0);

    const respuesta = await _iaConsultar(
        `Eres un auditor contable chileno. Analiza si el siguiente asiento contable nuevo parece ` +
        `duplicado o tiene un monto inusual comparado con los últimos 30 asientos del período. ` +
        `Responde SOLO en formato JSON sin explicaciones adicionales: ` +
        `{"alerta":true|false,"mensaje":"texto breve en español"}.\n\n` +
        `Asiento nuevo:\nGlosa: "${asiento.glosa}"\nTotal: $${totalNuevo.toLocaleString('es-CL')}\n` +
        `Cuentas: ${(asiento.movimientos || []).map(m => m.cuenta).join(', ')}\n\n` +
        `Últimos 30 asientos del período: ${JSON.stringify(asientosRecientes)}`,
        300
    );
    if (!respuesta) return null;
    try {
        const match = respuesta.match(/\{[\s\S]*?\}/);
        return match ? JSON.parse(match[0]) : null;
    } catch { return null; }
}

async function iaCheckAntesDeGuardar(asiento, onConfirmar) {
    const alerta = await iaVerificarAsiento(asiento);
    if (!alerta || !alerta.alerta) { onConfirmar(); return; }
    _iaModalAlerta(alerta.mensaje, onConfirmar);
}

function _iaModalAlerta(mensaje, onConfirmar) {
    const modal = document.getElementById('iaModalAlerta');
    const msgEl = document.getElementById('iaModalAlertaMsg');
    if (!modal || !msgEl) { onConfirmar(); return; }
    msgEl.textContent = mensaje;
    modal.style.display = 'flex';
    window._iaConfirmarCb = onConfirmar;
}

function iaConfirmarAlerta() {
    document.getElementById('iaModalAlerta').style.display = 'none';
    if (typeof window._iaConfirmarCb === 'function') window._iaConfirmarCb();
    window._iaConfirmarCb = null;
}

function iaCancelarAlerta() {
    document.getElementById('iaModalAlerta').style.display = 'none';
    window._iaConfirmarCb = null;
}

// ── Análisis narrativo de reportes ────────────────────────────────────────────
// A diferencia de la app hermana (que arma un JSON tabla por tabla), acá se
// toma el texto tal como se ve en pantalla (innerText) del contenedor del
// reporte — más simple y robusto: funciona igual sin importar la estructura
// HTML interna exacta de cada reporte (tabla, tarjetas de KPI, etc.).
function _iaContenedorATexto(selector, maxLen = 6000) {
    const el = document.querySelector(selector);
    if (!el) return '';
    return el.innerText.trim().slice(0, maxLen);
}

async function iaAnalizarReporte(tipoReporte, datosTexto) {
    _iaModalAnalisisAbrir(tipoReporte);
    if (!datosTexto) {
        _iaModalAnalisisMostrar('No hay datos generados en este reporte todavía — genera el reporte primero.');
        return;
    }

    const prompts = {
        'balance':             'Analiza este Balance General chileno y entrega: situación patrimonial general, principales activos y pasivos, solidez financiera. Usa lenguaje claro para un empresario. Máximo 5 párrafos.',
        'balance-clasificado': 'Analiza este Balance Clasificado chileno. Calcula e interpreta razón corriente y razón de endeudamiento a partir de los montos mostrados. Alerta si algún ratio es crítico. Lenguaje simple. Máximo 5 párrafos.',
        'estado-resultados':   'Analiza este Estado de Resultados chileno. Incluye análisis de utilidad neta, márgenes y recomendaciones. Lenguaje simple. Máximo 5 párrafos.',
        'flujo-caja':          'Analiza este Flujo de Caja chileno. Identifica meses con flujo negativo, tendencia de liquidez y alertas críticas. Lenguaje simple. Máximo 5 párrafos.',
    };
    const prompt = prompts[tipoReporte] || 'Analiza este reporte contable chileno y entrega conclusiones relevantes.';
    const cfg = JSON.parse(localStorage.getItem('core_config') || '{}');

    const respuesta = await _iaConsultar(
        `Eres un contador y analista financiero experto en empresas chilenas. ` +
        `Empresa: ${cfg.empresa || 'N/A'} | RUT: ${cfg.rut || 'N/A'} | Período: ${cfg.periodo || new Date().getFullYear()}.\n` +
        `Responde en español, con análisis útil y concreto, sin tecnicismos innecesarios.\n\n` +
        `${prompt}\n\nDatos del reporte (texto tal como se ve en pantalla):\n${datosTexto}`,
        1200
    );

    if (!respuesta) {
        _iaModalAnalisisMostrar('No se pudo obtener el análisis. Verifica tu API key e intenta de nuevo.');
        return;
    }
    _iaModalAnalisisMostrar(respuesta);
}

function _iaModalAnalisisAbrir(titulo) {
    const modal        = document.getElementById('iaModalAnalisis');
    const titEl        = document.getElementById('iaModalAnalisisTit');
    const cuerpo       = document.getElementById('iaModalAnalisisCuerpo');
    const filaPeriodos = document.getElementById('iaCompRowPeriodos');
    if (!modal) return;
    if (titEl)  titEl.textContent = '✨ Análisis IA — ' + titulo;
    if (cuerpo) cuerpo.innerHTML  = '<div class="ia-loading">Analizando con Gemini…</div>';
    if (filaPeriodos) filaPeriodos.style.display = 'none'; // solo se usa en iaCompararPeriodos
    modal.style.display = 'flex';
}

function _iaModalAnalisisMostrar(texto) {
    const cuerpo = document.getElementById('iaModalAnalisisCuerpo');
    if (!cuerpo) return;
    cuerpo.innerHTML = texto
        .split('\n\n').filter(p => p.trim())
        .map(p => `<p style="margin-bottom:10px;">${p.replace(/\n/g, '<br>')}</p>`)
        .join('');
}

function iaCerrarAnalisis() {
    const modal = document.getElementById('iaModalAnalisis');
    if (modal) modal.style.display = 'none';
}

function iaAnalizarBalance() {
    iaAnalizarReporte('balance', _iaContenedorATexto('#tab-balance .card'));
}
function iaAnalizarBalanceClasificado() {
    iaAnalizarReporte('balance-clasificado', _iaContenedorATexto('#balanceClasificadoCont'));
}
function iaAnalizarEstadoResultados() {
    const kpis    = _iaContenedorATexto('#tab-estado-resultados .libro-toolbar');
    const detalle = _iaContenedorATexto('#estadoResultadosCont');
    iaAnalizarReporte('estado-resultados', [kpis, detalle].filter(Boolean).join('\n\n'));
}
function iaAnalizarFlujoCaja() {
    const kpis  = _iaContenedorATexto('#tab-flujo-caja .libro-toolbar');
    const tabla = _iaContenedorATexto('#tab-flujo-caja table.cont-table');
    iaAnalizarReporte('flujo-caja', [kpis, tabla].filter(Boolean).join('\n\n'));
}

// ── Comparación de períodos ────────────────────────────────────────────────

async function iaCompararPeriodos(reporte) {
    const per1 = document.getElementById('iaCompPer1')?.value;
    const per2 = document.getElementById('iaCompPer2')?.value;
    if (!per1 || !per2 || per1 === per2) {
        mostrarToast('Selecciona dos períodos distintos.', 'error');
        return;
    }

    _iaModalAnalisisAbrir(`Comparación ${per1} vs ${per2}`);
    const filaPeriodos = document.getElementById('iaCompRowPeriodos');
    if (filaPeriodos) filaPeriodos.style.display = ''; // este flujo sí necesita los selectores visibles

    const asientos = window.dbAsientos || [];
    const _resumen = (anio) => {
        const movs = asientos
            .filter(a => a.estado === 'ACTIVO' && a.fecha?.endsWith('/' + anio))
            .flatMap(a => a.movimientos || []);
        const cuentas = {};
        movs.forEach(m => {
            if (!cuentas[m.cuenta]) cuentas[m.cuenta] = { debe: 0, haber: 0 };
            cuentas[m.cuenta].debe  += m.debe  || 0;
            cuentas[m.cuenta].haber += m.haber || 0;
        });
        return cuentas;
    };
    const r1 = _resumen(per1);
    const r2 = _resumen(per2);

    const respuesta = await _iaConsultar(
        `Eres un analista financiero experto en empresas chilenas. Compara dos períodos contables ` +
        `del reporte "${reporte}" y entrega conclusiones claras en español.\n\n` +
        `Período ${per1}:\n${JSON.stringify(r1, null, 2)}\n\n` +
        `Período ${per2}:\n${JSON.stringify(r2, null, 2)}\n\n` +
        `Incluye variaciones significativas en ingresos y gastos, tendencia general, alertas y ` +
        `recomendaciones. Máximo 6 párrafos.`,
        1400
    );

    if (!respuesta) { _iaModalAnalisisMostrar('No se pudo obtener el análisis comparativo.'); return; }
    _iaModalAnalisisMostrar(respuesta);
}

// ── Asistente financiero conversacional (chat flotante) ───────────────────────

let _iaChatHistorial = [];

function iaAbrirChat() {
    const panel = document.getElementById('iaChatPanel');
    if (panel) panel.style.display = 'flex';
    document.getElementById('iaChatInput')?.focus();
}

function iaCerrarChat() {
    const panel = document.getElementById('iaChatPanel');
    if (panel) panel.style.display = 'none';
}

function iaChatKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); iaEnviarChat(); }
}

function iaLimpiarChat() {
    _iaChatHistorial = [];
    const cont = document.getElementById('iaChatMensajes');
    if (cont) cont.innerHTML = '<div class="ia-chat-bienvenida">👋 Hola, soy tu asistente financiero.<br>Pregúntame sobre tu contabilidad.</div>';
}

function _iaChatAgregarMensaje(rol, texto) {
    const cont = document.getElementById('iaChatMensajes');
    if (!cont) return document.createElement('span');
    const div = document.createElement('div');
    div.className = `ia-chat-msg ia-chat-${rol}`;
    div.textContent = texto;
    cont.appendChild(div);
    cont.scrollTop = cont.scrollHeight;
    return div;
}

async function iaEnviarChat() {
    const input = document.getElementById('iaChatInput');
    const msg   = input?.value?.trim();
    if (!msg) return;
    input.value = '';

    _iaChatAgregarMensaje('user', msg);
    _iaChatHistorial.push({ rol: 'Usuario', texto: msg });
    const typing = _iaChatAgregarMensaje('assistant', '…');

    const cfg         = JSON.parse(localStorage.getItem('core_config') || '{}');
    const asientos    = window.dbAsientos || [];
    const compras     = window.dbCompras  || [];
    const ventas      = window.dbVentas   || [];
    const indicadores = window.indicadoresEconomicos || {};

    const contexto = {
        empresa: cfg.empresa, rut: cfg.rut, periodo: cfg.periodo,
        totalAsientos:   asientos.filter(a => a.estado === 'ACTIVO').length,
        totalComprasMes: compras.filter(c => c.estado !== 'anulada').reduce((s, c) => s + (c.total || 0), 0),
        totalVentasMes:  ventas.filter(v => v.estado !== 'anulada').reduce((s, v) => s + (v.total || 0), 0),
        uf: indicadores.uf?.valor, utm: indicadores.utm?.valor,
    };
    const historialTexto = _iaChatHistorial.slice(-10).map(h => `${h.rol}: ${h.texto}`).join('\n');

    const respuesta = await _iaConsultar(
        `Eres un asistente financiero y contable experto en empresas chilenas. ` +
        `Tienes acceso a los datos reales del sistema del usuario: ${JSON.stringify(contexto)}\n` +
        `Responde en español, de forma concisa y útil. Si no tienes suficientes datos, dilo claramente.\n\n` +
        `Conversación:\n${historialTexto}`,
        600
    );

    const texto = respuesta || 'No pude obtener una respuesta en este momento.';
    typing.textContent = texto;
    _iaChatHistorial.push({ rol: 'Asistente', texto });
}

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', iaVerificarKeyAlCargar);
