// ─────────────────────────────────────────────────────────────
//  ia.js — Integración Claude API (Fase 6)
//  Todas las llamadas van al main process via IPC.
//  Nunca se expone la API key en el renderer.
// ─────────────────────────────────────────────────────────────

const IA_DISPONIBLE = () => !!window.electronAPI?.ia;

// Wrapper genérico — muestra toast de error si no hay key o no hay Electron
async function _iaConsultar(opts) {
    if (!IA_DISPONIBLE()) {
        mostrarToast('IA solo disponible en la app de escritorio.', 'error');
        return null;
    }
    const keySet = await window.electronAPI.ia.getKeySet();
    if (!keySet) {
        mostrarToast('Configura tu API key de Claude en Configuración → IA.', 'error');
        return null;
    }
    try {
        return await window.electronAPI.ia.consultar(opts);
    } catch (e) {
        mostrarToast('Error IA: ' + e.message, 'error');
        return null;
    }
}

// ─────────────────────────────────────────────────────────────
//  6.1 — LECTURA DE FACTURAS ADJUNTAS
// ─────────────────────────────────────────────────────────────

// Llamada desde compras.js / ventas.js tras adjuntar un archivo.
// tipo: 'compra' | 'venta'
async function iaLeerFactura(rutaArchivo, nombreArchivo, tipo) {
    if (!rutaArchivo) return;

    const esImagen = /\.(jpg|jpeg|png)$/i.test(nombreArchivo);
    const esPdf    = /\.pdf$/i.test(nombreArchivo);
    if (!esImagen && !esPdf) {
        mostrarToast('Solo se puede analizar PDF, JPG o PNG.', 'error');
        return;
    }

    mostrarToast('Analizando documento con IA…', 'info');

    // Leer el archivo como base64 desde el main process
    let b64;
    try {
        b64 = await window.electronAPI.archivo.leerBase64(rutaArchivo);
    } catch (e) {
        mostrarToast('No se pudo leer el archivo adjunto.', 'error');
        return;
    }
    if (!b64) return;

    const mediaType = esPdf ? 'application/pdf'
        : nombreArchivo.toLowerCase().endsWith('png') ? 'image/png'
        : 'image/jpeg';

    const promptTexto = `Analiza esta factura chilena y extrae en formato JSON los siguientes campos:
rut_emisor, razon_social, tipo_documento (valores posibles: factura, boleta, nota_credito, nota_debito, liquidacion, guia),
numero_documento, fecha (formato DD/MM/YYYY), neto (número entero), iva (número entero), bruto (número entero).
Si algún campo no está visible responde null para ese campo.
Responde SOLO con el JSON, sin explicaciones adicionales.`;

    const resultado = await _iaConsultar({
        max_tokens: 512,
        json: true,
        messages: [{
            role: 'user',
            content: [
                {
                    type: esPdf ? 'document' : 'image',
                    source: { type: 'base64', media_type: mediaType, data: b64 },
                },
                { type: 'text', text: promptTexto },
            ],
        }],
    });

    if (!resultado?.ok || !resultado.data) {
        mostrarToast('No se pudieron extraer los datos del documento.', 'error');
        return;
    }

    const d = resultado.data;
    _iaRellenarFormulario(d, tipo);
    mostrarToast('Formulario completado con IA. Revisa los datos antes de guardar.', 'ok');
}

function _iaRellenarFormulario(d, tipo) {
    const pfx = tipo === 'compra' ? 'compra' : 'venta';

    if (d.fecha) {
        // Convertir DD/MM/YYYY → YYYY-MM-DD para el input[type=date]
        const parts = String(d.fecha).split('/');
        if (parts.length === 3) {
            const iso = `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
            const el = document.getElementById(`${pfx}Fecha`);
            if (el) el.value = iso;
        }
    }
    if (d.tipo_documento) {
        const el = document.getElementById(`${pfx}TipoDoc`);
        if (el) el.value = d.tipo_documento;
    }
    if (d.numero_documento) {
        const el = document.getElementById(`${pfx}NumDoc`);
        if (el) el.value = d.numero_documento;
    }
    if (d.rut_emisor) {
        const el = document.getElementById(`${pfx}Rut`);
        if (el) el.value = d.rut_emisor;
    }
    if (d.razon_social) {
        const el = document.getElementById(`${pfx}Nombre`);
        if (el) el.value = d.razon_social;
    }
    if (d.neto != null) {
        const el = document.getElementById(`${pfx}Neto`);
        if (el) { el.value = d.neto; }
    }
    if (d.iva != null) {
        const el = document.getElementById(`${pfx}Iva`);
        if (el) { el.value = d.iva; }
    }
    if (d.bruto != null) {
        const el = document.getElementById(`${pfx}Total`);
        if (el) { el.value = d.bruto; }
    }
    // Mostrar badge visual de que la IA completó el form
    const badge = document.getElementById(`${pfx}IaBadge`);
    if (badge) badge.style.display = 'inline-flex';
}

// ─────────────────────────────────────────────────────────────
//  6.2 — FALLBACK IA PARA PARSER DE GLOSAS
// ─────────────────────────────────────────────────────────────

async function iaInterpretarGlosa(glosa) {
    const cuentas = Object.keys(window.PLAN_CUENTAS || {})
        .filter(c => window.PLAN_CUENTAS[c].estado !== 'INACTIVA')
        .slice(0, 80) // limitar contexto
        .join(', ');

    const resultado = await _iaConsultar({
        max_tokens: 600,
        json: true,
        system: `Eres un contador experto en contabilidad chilena según PCGA y NIC.
Propones asientos contables correctos y cuadrados (Debe = Haber).
Responde SOLO con JSON válido, sin explicaciones.`,
        messages: [{
            role: 'user',
            content: `Glosa: "${glosa}"

Plan de cuentas disponible: ${cuentas}

Genera el asiento contable. Responde con este JSON exacto:
{
  "debe": [{"cuenta": "NombreCuenta", "monto": 12345}, ...],
  "haber": [{"cuenta": "NombreCuenta", "monto": 12345}, ...]
}
Usa solo cuentas del plan de cuentas listado. Los montos deben ser números enteros. Debe = Haber.`,
        }],
    });

    if (!resultado?.ok || !resultado.data) return null;

    const d = resultado.data;
    // Validar que cuadre
    if (!Array.isArray(d.debe) || !Array.isArray(d.haber)) return null;
    const totD = d.debe.reduce((s, x) => s + (x.monto || 0), 0);
    const totH = d.haber.reduce((s, x) => s + (x.monto || 0), 0);
    if (Math.abs(totD - totH) > 1) {
        mostrarToast('La IA generó un asiento que no cuadra. Revisalo manualmente.', 'error');
        return null;
    }
    return d;
}

// Botón "Intentar con IA" del diario — llamado desde diario.js
async function iaTentarGlosa() {
    const glosa = document.getElementById('glosaInput')?.value?.trim();
    if (!glosa) return;

    const btn = document.getElementById('btnIaGlosa');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Consultando IA…'; }

    const asiento = await iaInterpretarGlosa(glosa);

    if (btn) { btn.disabled = false; btn.textContent = '✨ Intentar con IA'; }

    if (!asiento) return;

    // Inyectar en preasientoActual (definido en diario.js)
    window.preasientoActual = { glosa, debe: asiento.debe, haber: asiento.haber };
    if (typeof renderPreasiento === 'function') renderPreasiento();

    const badge = document.getElementById('badgeIaGlosa');
    if (badge) { badge.style.display = 'inline'; }
    mostrarToast('Asiento propuesto por IA. Revisa y confirma antes de guardar.', 'ok');
}

// ─────────────────────────────────────────────────────────────
//  6.3 — SUGERENCIA DE CUENTA EN ASIENTO MANUAL
// ─────────────────────────────────────────────────────────────

let _iaSugerenciaTimeout = null;

async function iaSugerirCuenta(descripcion, filaIdx) {
    if (!descripcion || descripcion.length < 5) return;
    clearTimeout(_iaSugerenciaTimeout);
    _iaSugerenciaTimeout = setTimeout(async () => {
        const cuentas = Object.keys(window.PLAN_CUENTAS || {})
            .filter(c => window.PLAN_CUENTAS[c].estado !== 'INACTIVA')
            .slice(0, 60).join(', ');

        const resultado = await _iaConsultar({
            max_tokens: 80,
            json: true,
            messages: [{
                role: 'user',
                content: `Dado el concepto contable: "${descripcion}", ¿qué cuenta del plan de cuentas es más apropiada?
Plan de cuentas: ${cuentas}
Responde SOLO con JSON: {"cuenta": "NombreCuenta"}`,
            }],
        });

        if (!resultado?.ok || !resultado.data?.cuenta) return;
        _iaMostrarSugerenciaCuenta(resultado.data.cuenta, filaIdx);
    }, 800);
}

function _iaMostrarSugerenciaCuenta(cuenta, filaIdx) {
    const cont = document.getElementById(`iaSugerencia_${filaIdx}`);
    if (!cont) return;
    cont.innerHTML = `<span class="ia-sugerencia-chip" onclick="iaAceptarSugerencia('${cuenta.replace(/'/g,"\\'")}', ${filaIdx})">
        ✨ ${cuenta}
    </span>`;
    cont.style.display = 'block';
}

function iaAceptarSugerencia(cuenta, filaIdx) {
    if (typeof filasManual !== 'undefined' && filasManual[filaIdx] !== undefined) {
        filasManual[filaIdx].cuenta = cuenta;
        if (typeof renderFilasManual === 'function') renderFilasManual();
    }
}

// ─────────────────────────────────────────────────────────────
//  6.4 — DETECCIÓN DE DUPLICADOS / MONTOS INUSUALES
// ─────────────────────────────────────────────────────────────

async function iaVerificarAsiento(asiento) {
    const asientosRecientes = (window.dbAsientos || [])
        .filter(a => a.estado === 'ACTIVO')
        .slice(-30)
        .map(a => ({ glosa: a.glosa, total: a.movimientos.reduce((s, m) => s + m.debe, 0) }));

    const resultado = await _iaConsultar({
        max_tokens: 250,
        json: true,
        system: 'Eres un auditor contable. Analiza si el asiento propuesto es inusual o duplicado.',
        messages: [{
            role: 'user',
            content: `Asiento nuevo:
Glosa: "${asiento.glosa}"
Total: $${asiento.movimientos.reduce((s,m)=>s+m.debe,0).toLocaleString('es-CL')}
Cuentas: ${asiento.movimientos.map(m=>m.cuenta).join(', ')}

Últimos 30 asientos del período: ${JSON.stringify(asientosRecientes)}

Responde con JSON: {"alerta": true/false, "tipo": "duplicado"|"monto_inusual"|"ok", "mensaje": "texto breve"}`,
        }],
    });

    if (!resultado?.ok || !resultado.data) return null;
    return resultado.data;
}

// Llamado antes de guardar — muestra modal si hay alerta
async function iaCheckAntesDeGuardar(asiento, onConfirmar) {
    const alerta = await iaVerificarAsiento(asiento);
    if (!alerta || !alerta.alerta) {
        onConfirmar();
        return;
    }
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

// ─────────────────────────────────────────────────────────────
//  6.5 — ANÁLISIS NARRATIVO DE REPORTES
// ─────────────────────────────────────────────────────────────

async function iaAnalizarReporte(tipoReporte, datos) {
    _iaModalAnalisisAbrir(tipoReporte);

    const prompts = {
        'balance': `Analiza este Balance General chileno y entrega: situación patrimonial general, principales activos y pasivos, solidez financiera. Usa lenguaje claro para un empresario PYME. Máximo 5 párrafos.`,
        'balance-clasificado': `Analiza este Balance Clasificado chileno. Calcula e interpreta: razón corriente (activo corriente/pasivo corriente), razón de endeudamiento (pasivo total/activo total). Alerta si algún ratio es crítico. Lenguaje simple para PYME. Máximo 5 párrafos.`,
        'estado-resultados': `Analiza este Estado de Resultados chileno. Incluye: análisis de utilidad neta, margen bruto estimado, tendencia y recomendaciones. Lenguaje simple para empresario PYME. Máximo 5 párrafos.`,
        'flujo-caja': `Analiza este Flujo de Caja anual chileno. Identifica: meses con flujo negativo, tendencia de liquidez operacional, alertas críticas y sugerencias de mejora. Lenguaje simple para PYME. Máximo 5 párrafos.`,
    };

    const prompt = prompts[tipoReporte] || 'Analiza este reporte contable chileno y entrega conclusiones relevantes para una PYME.';
    const cfg = JSON.parse(localStorage.getItem('core_config') || '{}');

    const resultado = await _iaConsultar({
        max_tokens: 1200,
        system: `Eres un contador y analista financiero experto en empresas chilenas (PYME).
Empresa: ${cfg.empresa || 'N/A'} | RUT: ${cfg.rut || 'N/A'} | Período: ${cfg.periodo || new Date().getFullYear()}.
Responde en español con análisis útil, concreto y sin tecnicismos innecesarios.`,
        messages: [{
            role: 'user',
            content: `${prompt}\n\nDatos del reporte:\n${JSON.stringify(datos, null, 2)}`,
        }],
    });

    if (!resultado?.ok) {
        _iaModalAnalisisMostrar('No se pudo obtener el análisis. Verifica tu API key e intenta de nuevo.');
        return;
    }
    _iaModalAnalisisMostrar(resultado.texto);
}

function _iaModalAnalisisAbrir(titulo) {
    const modal = document.getElementById('iaModalAnalisis');
    const titEl = document.getElementById('iaModalAnalisisTit');
    const cuerpo = document.getElementById('iaModalAnalisisCuerpo');
    if (!modal) return;
    if (titEl) titEl.textContent = '✨ Análisis IA — ' + titulo;
    if (cuerpo) cuerpo.innerHTML = '<div class="ia-loading">Analizando con Claude…</div>';
    modal.style.display = 'flex';
}

function _iaModalAnalisisMostrar(texto) {
    const cuerpo = document.getElementById('iaModalAnalisisCuerpo');
    if (!cuerpo) return;
    // Convertir saltos de línea en párrafos
    cuerpo.innerHTML = texto
        .split('\n\n').filter(p => p.trim())
        .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
        .join('');
}

function iaCerrarAnalisis() {
    const modal = document.getElementById('iaModalAnalisis');
    if (modal) modal.style.display = 'none';
}

// Helpers para obtener datos del DOM de cada reporte
function _iaTablaADatos(selector) {
    const datos = [];
    document.querySelectorAll(`${selector} tbody tr`).forEach(tr => {
        const fila = {};
        const ths  = document.querySelectorAll(`${selector} thead th`);
        tr.querySelectorAll('td').forEach((td, i) => {
            const key = ths[i]?.innerText?.trim() || `col${i}`;
            fila[key] = td.innerText.trim();
        });
        if (Object.values(fila).some(v => v)) datos.push(fila);
    });
    return datos;
}

function iaAnalizarBalance()             { iaAnalizarReporte('balance',           _iaTablaADatos('#view-balance .cont-table')); }
function iaAnalizarBalanceClasificado()  { iaAnalizarReporte('balance-clasificado', _iaTablaADatos('#view-balance-clasificado .cont-table')); }
function iaAnalizarEstadoResultados()    { iaAnalizarReporte('estado-resultados',  _iaTablaADatos('#view-estado-resultados .cont-table')); }
function iaAnalizarFlujoCaja() {
    const kpis = {
        entradas:      document.getElementById('fcEntradas')?.textContent,
        salidas:       document.getElementById('fcSalidas')?.textContent,
        operacional:   document.getElementById('fcOperacional')?.textContent,
        inversion:     document.getElementById('fcInversion')?.textContent,
        financiamiento:document.getElementById('fcFinanciamiento')?.textContent,
    };
    const tabla = _iaTablaADatos('#view-flujo-caja .cont-table');
    iaAnalizarReporte('flujo-caja', { kpis, detalle: tabla });
}

// ─────────────────────────────────────────────────────────────
//  6.6 — COMPARACIÓN DE PERÍODOS
// ─────────────────────────────────────────────────────────────

async function iaCompararPeriodos(reporte) {
    const per1 = document.getElementById('iaCompPer1')?.value;
    const per2 = document.getElementById('iaCompPer2')?.value;
    if (!per1 || !per2 || per1 === per2) {
        mostrarToast('Selecciona dos períodos distintos.', 'error');
        return;
    }

    _iaModalAnalisisAbrir(`Comparación ${per1} vs ${per2}`);

    const asientos = window.dbAsientos || [];
    const _resumen = (anio) => {
        const movs = asientos
            .filter(a => a.estado === 'ACTIVO' && a.fecha?.endsWith('/' + anio))
            .flatMap(a => a.movimientos);
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

    const resultado = await _iaConsultar({
        max_tokens: 1400,
        system: `Eres un analista financiero experto en PYME chilenas. Compara dos períodos contables y entrega conclusiones claras. Responde en español.`,
        messages: [{
            role: 'user',
            content: `Compara los dos períodos del reporte: ${reporte}

Período ${per1}:
${JSON.stringify(r1, null, 2)}

Período ${per2}:
${JSON.stringify(r2, null, 2)}

Incluye: variaciones significativas en ingresos y gastos, tendencia general, alertas y recomendaciones. Máximo 6 párrafos.`,
        }],
    });

    if (!resultado?.ok) {
        _iaModalAnalisisMostrar('No se pudo obtener el análisis comparativo.');
        return;
    }
    _iaModalAnalisisMostrar(resultado.texto);
}

// ─────────────────────────────────────────────────────────────
//  6.7 — ASISTENTE FINANCIERO CONVERSACIONAL
// ─────────────────────────────────────────────────────────────

let _iaChatHistorial = [];

function iaAbrirChat() {
    document.getElementById('iaChatPanel').style.display = 'flex';
    document.getElementById('iaChatInput')?.focus();
}

function iaCerrarChat() {
    document.getElementById('iaChatPanel').style.display = 'none';
}

async function iaEnviarChat() {
    const input = document.getElementById('iaChatInput');
    const msg   = input?.value?.trim();
    if (!msg) return;
    input.value = '';

    _iaChatAgregarMensaje('user', msg);
    _iaChatHistorial.push({ role: 'user', content: msg });

    const typing = _iaChatAgregarMensaje('assistant', '…');

    // Contexto del sistema con datos reales
    const cfg        = JSON.parse(localStorage.getItem('core_config') || '{}');
    const asientos   = window.dbAsientos || [];
    const compras    = window.dbCompras  || [];
    const ventas     = window.dbVentas   || [];
    const indicadores = window.indicadoresEconomicos || {};

    const contexto = {
        empresa: cfg.empresa, rut: cfg.rut, periodo: cfg.periodo,
        totalAsientos: asientos.filter(a=>a.estado==='ACTIVO').length,
        totalComprasMes: compras.filter(c=>c.estado!=='anulada').reduce((s,c)=>s+c.total,0),
        totalVentasMes:  ventas.filter(v=>v.estado!=='anulada').reduce((s,v)=>s+v.total,0),
        uf: indicadores.uf?.valor, utm: indicadores.utm?.valor,
    };

    const resultado = await _iaConsultar({
        max_tokens: 600,
        system: `Eres un asistente financiero y contable experto en PYME chilenas.
Tienes acceso a los datos reales del sistema del usuario.
Datos del sistema: ${JSON.stringify(contexto)}
Responde en español de forma concisa y útil. Si no tienes suficientes datos, dilo claramente.`,
        messages: _iaChatHistorial.slice(-10), // últimas 10 interacciones
    });

    const respuesta = resultado?.texto || 'No pude obtener una respuesta en este momento.';
    typing.textContent = respuesta;
    _iaChatHistorial.push({ role: 'assistant', content: respuesta });
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

function iaChatKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); iaEnviarChat(); }
}

function iaLimpiarChat() {
    _iaChatHistorial = [];
    const cont = document.getElementById('iaChatMensajes');
    if (cont) cont.innerHTML = '<div class="ia-chat-bienvenida">👋 Hola, soy tu asistente financiero. Pregúntame cualquier cosa sobre tu contabilidad.</div>';
}

// ─────────────────────────────────────────────────────────────
//  6.8 — DETECCIÓN DE INCONSISTENCIAS ENTRE LIBROS
// ─────────────────────────────────────────────────────────────

async function iaVerificarConsistencia() {
    _iaModalAnalisisAbrir('Verificación de Consistencia');

    const asientos = (window.dbAsientos || []).filter(a => a.estado === 'ACTIVO');
    const compras  = (window.dbCompras  || []).filter(c => c.estado !== 'anulada');
    const ventas   = (window.dbVentas   || []).filter(v => v.estado !== 'anulada');

    // Calcular saldos del diario
    const saldos = {};
    asientos.flatMap(a => a.movimientos).forEach(m => {
        if (!saldos[m.cuenta]) saldos[m.cuenta] = { debe: 0, haber: 0 };
        saldos[m.cuenta].debe  += m.debe  || 0;
        saldos[m.cuenta].haber += m.haber || 0;
    });

    const ivaCompras = compras.reduce((s, c) => s + (c.iva || 0), 0);
    const ivaVentas  = ventas.reduce((s, v) => s + (v.iva || 0), 0);
    const ivaCF_diario = (saldos['IVA Crédito Fiscal']?.debe || 0)  - (saldos['IVA Crédito Fiscal']?.haber || 0);
    const ivaDF_diario = (saldos['IVA Débito Fiscal']?.haber || 0)  - (saldos['IVA Débito Fiscal']?.debe || 0);

    const verificaciones = {
        'IVA Crédito Fiscal': { libro: ivaCompras, diario: ivaCF_diario, diff: Math.abs(ivaCompras - ivaCF_diario) },
        'IVA Débito Fiscal':  { libro: ivaVentas,  diario: ivaDF_diario, diff: Math.abs(ivaVentas  - ivaDF_diario) },
    };

    const totalCompras = compras.reduce((s,c) => s+c.total, 0);
    const totalVentas  = ventas.reduce((s,v)  => s+v.total, 0);

    const resultado = await _iaConsultar({
        max_tokens: 900,
        system: 'Eres un auditor contable. Analiza las posibles inconsistencias entre los libros contables y el diario.',
        messages: [{
            role: 'user',
            content: `Verifica las siguientes inconsistencias contables:

Comparación IVA:
${JSON.stringify(verificaciones, null, 2)}

Totales libros: Compras $${totalCompras.toLocaleString('es-CL')} | Ventas $${totalVentas.toLocaleString('es-CL')}

Saldos del diario (cuentas relevantes):
${JSON.stringify(Object.fromEntries(Object.entries(saldos).filter(([k]) => k.includes('IVA') || k.includes('Proveedor') || k.includes('Cliente'))), null, 2)}

Entrega un análisis claro indicando qué está bien, qué tiene discrepancias y posibles causas. Máximo 4 párrafos.`,
        }],
    });

    _iaModalAnalisisMostrar(resultado?.texto || 'No se pudo completar la verificación.');
}

// ─────────────────────────────────────────────────────────────
//  6.9 — ALERTAS DE OBLIGACIONES TRIBUTARIAS
// ─────────────────────────────────────────────────────────────

async function iaAlertasTribu() {
    const cfg      = JSON.parse(localStorage.getItem('core_config') || '{}');
    const compras  = (window.dbCompras || []).filter(c => c.estado !== 'anulada');
    const ventas   = (window.dbVentas  || []).filter(v => v.estado !== 'anulada');
    const asientos = (window.dbAsientos || []).filter(a => a.estado === 'ACTIVO');

    const hoy   = new Date();
    const mes   = hoy.getMonth() + 1;
    const anio  = hoy.getFullYear();
    const diaF29 = 12; // Vencimiento estándar F29 (día 12 del mes siguiente)

    const ivaVentas  = ventas.filter(v=>v.mes===mes&&v.anio===anio).reduce((s,v)=>s+(v.iva||0),0);
    const ivaCompras = compras.filter(c=>c.mes===mes&&c.anio===anio).reduce((s,c)=>s+(c.iva||0),0);
    const ivaPagar   = Math.max(0, ivaVentas - ivaCompras);

    const previsionPagar = asientos
        .filter(a => {
            const p = a.fecha?.split('/');
            return p && parseInt(p[1])===mes && parseInt(p[2])===anio;
        })
        .flatMap(a => a.movimientos)
        .filter(m => m.cuenta === 'Previsión Social por Pagar')
        .reduce((s, m) => s + (m.haber - m.debe), 0);

    const resultado = await _iaConsultar({
        max_tokens: 700,
        system: `Eres un asesor tributario experto en obligaciones de PYME chilenas.`,
        messages: [{
            role: 'user',
            content: `Analiza las obligaciones tributarias pendientes para la empresa:
Empresa: ${cfg.empresa || 'N/A'} | Período actual: ${mes}/${anio}

IVA Débito Fiscal del mes: $${ivaVentas.toLocaleString('es-CL')}
IVA Crédito Fiscal del mes: $${ivaCompras.toLocaleString('es-CL')}
IVA neto a pagar estimado: $${ivaPagar.toLocaleString('es-CL')}
Provisiones previsionales registradas: $${Math.max(0,previsionPagar).toLocaleString('es-CL')}
Fecha vencimiento F29: ${diaF29} del próximo mes

Genera una lista de alertas con: F29 (vencimiento y monto), cotizaciones previsionales, impuesto renta estimado (si aplica). Formato claro para PYME. Máximo 4 párrafos.`,
        }],
    });

    if (!resultado?.ok) return;

    // Mostrar en el dashboard
    const alCont = document.getElementById('iaAlertasTribuCont');
    if (alCont) {
        alCont.innerHTML = resultado.texto
            .split('\n\n').filter(p=>p.trim())
            .map(p => `<p>${p.replace(/\n/g,'<br>')}</p>`)
            .join('');
        document.getElementById('iaAlertasTribuCard').style.display = 'block';
    }
}

// ─────────────────────────────────────────────────────────────
//  CONFIGURACIÓN DE API KEY (UI en Configuración)
// ─────────────────────────────────────────────────────────────

async function iaGuardarApiKey() {
    const key = document.getElementById('iaApiKeyInput')?.value?.trim();
    if (!key) { mostrarToast('Ingresa una API key válida.', 'error'); return; }
    await window.electronAPI.ia.setKey(key);
    document.getElementById('iaApiKeyInput').value = '';
    document.getElementById('iaKeyEstado').textContent = '✅ API key guardada correctamente.';
    document.getElementById('iaKeyEstado').style.color = 'var(--positive)';
    mostrarToast('API key guardada.', 'ok');
}

async function iaBorrarApiKey() {
    await window.electronAPI.ia.borrarKey();
    document.getElementById('iaKeyEstado').textContent = '⚠️ API key eliminada.';
    document.getElementById('iaKeyEstado').style.color = 'var(--negative)';
}

async function iaVerificarKeyAlCargar() {
    const set = await window.electronAPI?.ia?.getKeySet?.();
    const el  = document.getElementById('iaKeyEstado');
    if (!el) return;
    el.textContent = set ? '✅ API key configurada.' : '⚠️ Sin API key — funciones de IA desactivadas.';
    el.style.color = set ? 'var(--positive)' : 'var(--text-muted)';
}
