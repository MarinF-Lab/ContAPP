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

async function iaGenerarTextoInforme(hallazgos) {
    if (!hallazgos?.length) {
        mostrarToast('No hay hallazgos para analizar.', 'error');
        return null;
    }
    const lista = hallazgos.map((h, i) =>
        `${i + 1}. [${h.tipo || 'Observación'}] ${h.descripcion || h.titulo || ''}` +
        (h.recomendacion ? ` — Recomendación: ${h.recomendacion}` : '')
    ).join('\n');

    mostrarToast('Generando conclusión con Gemini…', 'info');
    const respuesta = await _iaConsultar(
        `Eres un auditor contable chileno. Basándote en los siguientes hallazgos de auditoría, ` +
        `redacta un párrafo de conclusión profesional para un informe de auditoría en español.\n\n` +
        `Hallazgos:\n${lista}`
    );
    return respuesta;
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

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', iaVerificarKeyAlCargar);
