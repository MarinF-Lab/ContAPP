'use strict';
/**
 * informe-auditoria.js — Generador del informe de auditoría
 * Exclusivo ContAPP Auditor: documento formal entregado al cliente.
 *
 * Genera dos formatos:
 *   1. Reporte interno de trabajo (vista en pantalla, sin membrete)
 *   2. Documento formal para el cliente (PDF con membrete, firma)
 *
 * Contenido del informe:
 *   - Identificación del cliente y período auditado
 *   - Resumen de la contabilidad (balance, resultado, IVA)
 *   - Lista de hallazgos del período (desde hallazgos.js)
 *   - Opinión del contador (texto libre)
 *   - Datos del firmante (nombre, RUT, matrícula)
 */

const INF_BORRADOR_KEY = 'aud_informe_borrador';

let _infDatos = {
    opinion: '',
    nombreContador: '',
    rutContador: '',
    matriculaContador: '',
    nombreEstudio: '',
    telefono: '',
    email: '',
};

// ─────────────────────────────────────────────────────────────
//  CARGAR / GUARDAR BORRADOR
// ─────────────────────────────────────────────────────────────

function informeCargarBorrador() {
    const borrador = JSON.parse(localStorage.getItem(INF_BORRADOR_KEY)) || {};
    _infDatos = { ..._infDatos, ...borrador };
}

function informeGuardarBorrador() {
    localStorage.setItem(INF_BORRADOR_KEY, JSON.stringify(_infDatos));
    mostrarToast('Borrador del informe guardado', 'ok');
}

// ─────────────────────────────────────────────────────────────
//  CARGAR DATOS DEL PERÍODO
// ─────────────────────────────────────────────────────────────

function _informeCargarDatos() {
    informeCargarBorrador();

    const empresa = window.empresaActual;
    const periodo = document.getElementById('infPeriodo')?.value || new Date().toISOString().slice(0, 7);

    // Obtener balance del período
    const cuentas = recopilarMovimientosPorCuenta();
    let activos = 0, pasivos = 0, patrimonio = 0, ingresos = 0, gastos = 0;

    Object.keys(cuentas).forEach(name => {
        const c = cuentas[name];
        const tipo = (PLAN_CUENTAS?.[name] ?? ESQUEMA_CUENTAS[name])?.tipo || 'Activo';
        if (tipo === 'Activo') activos += (c.debe - c.haber);
        if (tipo === 'Pasivo') pasivos += (c.haber - c.debe);
        if (tipo === 'Patrimonio') patrimonio += (c.haber - c.debe);
        if (tipo === 'Ganancia') ingresos += (c.haber - c.debe);
        if (tipo === 'Pérdida') gastos += (c.debe - c.haber);
    });

    const resultado = ingresos - gastos;

    // Obtener IVA del período
    const compras = (dbCompras || []).filter(c => {
        if (!c.fecha || c.estado === 'anulada') return false;
        const p = c.fecha.split('/');
        return p.length === 3 && p[1] + '-' + p[2] === periodo;
    });
    const ventas = (dbVentas || []).filter(v => {
        if (!v.fecha || v.estado === 'anulada') return false;
        const p = v.fecha.split('/');
        return p.length === 3 && p[1] + '-' + p[2] === periodo;
    });

    const ivaCompras = compras.reduce((s, c) => s + (c.iva || 0), 0);
    const ivaVentas = ventas.reduce((s, v) => s + (v.iva || 0), 0);

    // Hallazgos del período
    const hallazgos = typeof audHallazgosExportar === 'function' ? audHallazgosExportar() : [];

    return {
        empresa,
        periodo,
        activos,
        pasivos,
        patrimonio,
        ingresos,
        gastos,
        resultado,
        ivaCompras,
        ivaVentas,
        hallazgos,
    };
}

// ─────────────────────────────────────────────────────────────
//  VISTA PREVIA EN PANTALLA
// ─────────────────────────────────────────────────────────────

function informeVistaPrevia() {
    const datos = _informeCargarDatos();

    const el = document.getElementById('infPreview');
    if (!el) return;

    const fHoy = new Date().toLocaleDateString('es-CL');
    const periodoLabel = datos.periodo ? datos.periodo.split('-').reverse().join('/') : '—';

    let hallazgosHTML = '';
    if (datos.hallazgos.length) {
        hallazgosHTML = `
        <section style="margin-top:20px;page-break-inside:avoid;">
            <h3 style="color:#1e293b;border-bottom:2px solid #3b82f6;padding-bottom:8px;margin-bottom:12px;">
                📋 Hallazgos y Observaciones
            </h3>
            <table style="width:100%;border-collapse:collapse;font-size:11px;">
                <thead>
                    <tr style="background:#f1f5f9;">
                        <th style="border:1px solid #cbd5e1;padding:8px;text-align:left;">Tipo</th>
                        <th style="border:1px solid #cbd5e1;padding:8px;text-align:left;">Módulo</th>
                        <th style="border:1px solid #cbd5e1;padding:8px;text-align:left;">Descripción</th>
                        <th style="border:1px solid #cbd5e1;padding:8px;text-align:center;width:60px;">Estado</th>
                    </tr>
                </thead>
                <tbody>
                    ${datos.hallazgos.map(h => `
                    <tr>
                        <td style="border:1px solid #cbd5e1;padding:8px;">
                            <span style="background:${h.tipo === 'error' ? '#dc2626' : h.tipo === 'advertencia' ? '#f59e0b' : '#3b82f6'};color:white;padding:2px 6px;border-radius:3px;font-weight:600;font-size:10px;">
                                ${h.tipo.toUpperCase()}
                            </span>
                        </td>
                        <td style="border:1px solid #cbd5e1;padding:8px;">${h.modulo}</td>
                        <td style="border:1px solid #cbd5e1;padding:8px;max-width:300px;">${_esc(h.descripcion)}</td>
                        <td style="border:1px solid #cbd5e1;padding:8px;text-align:center;font-size:10px;">
                            ${h.estado === 'abierto' ? '🔓' : '✅'}
                        </td>
                    </tr>`).join('')}
                </tbody>
            </table>
        </section>`;
    }

    el.innerHTML = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1e293b;max-width:800px;margin:0 auto;padding:20px;">

        <!-- ENCABEZADO -->
        <div style="text-align:center;margin-bottom:24px;padding-bottom:12px;border-bottom:3px solid #1e293b;">
            <h1 style="margin:0;font-size:24px;color:#1e293b;">${_esc(_infDatos.nombreEstudio || 'Estudio Contable')}</h1>
            <p style="margin:4px 0;color:#64748b;font-size:12px;">
                ${_infDatos.email ? _esc(_infDatos.email) : 'contacto@estudio.cl'}
                ${_infDatos.telefono ? ' • ' + _esc(_infDatos.telefono) : ''}
            </p>
        </div>

        <!-- TÍTULO DEL INFORME -->
        <h2 style="text-align:center;color:#0f172a;margin:20px 0 8px;">INFORME DE AUDITORÍA CONTABLE</h2>
        <p style="text-align:center;color:#64748b;margin:0 0 20px;font-size:13px;">Período: ${periodoLabel}</p>

        <!-- DATOS DEL CLIENTE -->
        <section style="margin-bottom:20px;">
            <h3 style="color:#1e293b;border-bottom:1px solid #cbd5e1;padding-bottom:6px;margin-bottom:12px;font-size:14px;">
                📊 Información de la Empresa
            </h3>
            <table style="width:100%;font-size:12px;">
                <tr>
                    <td style="width:150px;font-weight:600;color:#475569;">Razón Social:</td>
                    <td>${_esc(datos.empresa?.nombre || '—')}</td>
                </tr>
                <tr>
                    <td style="font-weight:600;color:#475569;">RUT:</td>
                    <td>${_esc(datos.empresa?.rut || '—')}</td>
                </tr>
                <tr>
                    <td style="font-weight:600;color:#475569;">Período Auditado:</td>
                    <td>${periodoLabel}</td>
                </tr>
                <tr>
                    <td style="font-weight:600;color:#475569;">Fecha del Informe:</td>
                    <td>${fHoy}</td>
                </tr>
            </table>
        </section>

        <!-- RESUMEN FINANCIERO -->
        <section style="margin-bottom:20px;">
            <h3 style="color:#1e293b;border-bottom:1px solid #cbd5e1;padding-bottom:6px;margin-bottom:12px;font-size:14px;">
                💰 Resumen Financiero
            </h3>
            <table style="width:100%;font-size:12px;">
                <tr>
                    <td style="width:250px;font-weight:600;color:#475569;">Activos:</td>
                    <td style="text-align:right;font-family:monospace;">$${fmt(datos.activos)}</td>
                </tr>
                <tr>
                    <td style="font-weight:600;color:#475569;">Pasivos:</td>
                    <td style="text-align:right;font-family:monospace;">$${fmt(datos.pasivos)}</td>
                </tr>
                <tr style="border-top:1px solid #cbd5e1;border-bottom:2px solid #1e293b;">
                    <td style="font-weight:600;color:#1e293b;">Patrimonio:</td>
                    <td style="text-align:right;font-family:monospace;font-weight:600;color:#1e293b;">$${fmt(datos.patrimonio)}</td>
                </tr>
                <tr style="padding-top:8px;">
                    <td style="font-weight:600;color:#475569;">Ingresos del Período:</td>
                    <td style="text-align:right;font-family:monospace;color:#16a34a;font-weight:600;">$${fmt(datos.ingresos)}</td>
                </tr>
                <tr>
                    <td style="font-weight:600;color:#475569;">Gastos del Período:</td>
                    <td style="text-align:right;font-family:monospace;color:#dc2626;font-weight:600;">$${fmt(datos.gastos)}</td>
                </tr>
                <tr style="border-top:1px solid #cbd5e1;border-bottom:2px solid #1e293b;">
                    <td style="font-weight:600;color:#1e293b;">Resultado Neto:</td>
                    <td style="text-align:right;font-family:monospace;font-weight:700;font-size:14px;color:${datos.resultado >= 0 ? '#16a34a' : '#dc2626'};">
                        $${fmt(datos.resultado)}
                    </td>
                </tr>
            </table>
        </section>

        <!-- IVA -->
        <section style="margin-bottom:20px;background:#f8fafc;padding:12px;border-radius:6px;">
            <h4 style="margin:0 0 8px;color:#1e293b;">IVA del Período (19%)</h4>
            <table style="width:100%;font-size:12px;">
                <tr>
                    <td style="width:200px;">IVA Crédito Fiscal (Compras):</td>
                    <td style="text-align:right;font-family:monospace;">$${fmt(datos.ivaCompras)}</td>
                </tr>
                <tr style="border-bottom:1px solid #cbd5e1;">
                    <td>IVA Débito Fiscal (Ventas):</td>
                    <td style="text-align:right;font-family:monospace;">$${fmt(datos.ivaVentas)}</td>
                </tr>
                <tr>
                    <td style="font-weight:600;color:#1e293b;">IVA Neto a:</td>
                    <td style="text-align:right;font-family:monospace;font-weight:600;color:${(datos.ivaVentas - datos.ivaCompras) >= 0 ? '#dc2626' : '#16a34a'};">
                        ${(datos.ivaVentas - datos.ivaCompras) >= 0 ? 'Pagar' : 'Recuperar'} $${fmt(Math.abs(datos.ivaVentas - datos.ivaCompras))}
                    </td>
                </tr>
            </table>
        </section>

        <!-- HALLAZGOS -->
        ${hallazgosHTML}

        <!-- OPINIÓN DEL CONTADOR -->
        <section style="margin-top:20px;page-break-inside:avoid;">
            <h3 style="color:#1e293b;border-bottom:2px solid #3b82f6;padding-bottom:8px;margin-bottom:12px;">
                ✍️ Opinión Profesional
            </h3>
            <div style="background:#f8fafc;padding:12px;border-left:4px solid #3b82f6;border-radius:4px;line-height:1.7;color:#334155;font-size:12px;min-height:80px;">
                ${_esc(_infDatos.opinion || '(Sin opinión registrada)')}</div>
        </section>

        <!-- FIRMA -->
        <section style="margin-top:40px;page-break-inside:avoid;">
            <p style="text-align:center;margin:0;font-weight:700;font-size:13px;color:#1e293b;">
                ${_esc(_infDatos.nombreContador || '—')}
            </p>
            <p style="text-align:center;margin:4px 0;font-size:12px;color:#64748b;">
                RUT: ${_esc(_infDatos.rutContador || '—')}
            </p>
            <p style="text-align:center;margin:4px 0 20px;font-size:12px;color:#64748b;">
                Nº Registro SII: ${_esc(_infDatos.matriculaContador || '—')}
            </p>
            <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:40px;">
                <div style="text-align:center;">
                    <p style="border-top:1px solid #1e293b;margin:0;padding-top:8px;font-size:11px;">Firma del Contador</p>
                </div>
                <div style="text-align:center;">
                    <p style="margin:0;font-size:11px;color:#64748b;">${fHoy}</p>
                </div>
            </div>
        </section>

    </div>`;
}

// ─────────────────────────────────────────────────────────────
//  EXPORTAR PDF
// ─────────────────────────────────────────────────────────────

function informeExportarPDF() {
    const datos = _informeCargarDatos();

    if (!_infDatos.opinion || _infDatos.opinion.length < 10) {
        mostrarToast('Ingrese una opinión (mínimo 10 caracteres)', 'error');
        return;
    }

    if (!_infDatos.nombreContador || !_infDatos.rutContador) {
        mostrarToast('Ingrese nombre y RUT del contador', 'error');
        return;
    }

    const nombreEmpresa = (datos.empresa?.nombre || 'Informe').replace(/[^a-zA-Z0-9]/g, '_');
    const nombreArchivo = `Informe_${nombreEmpresa}_${datos.periodo}.pdf`;

    // Usar jsPDF si está disponible (se carga en exportar.js)
    if (typeof jsPDF === 'undefined') {
        mostrarToast('jsPDF no disponible', 'error');
        return;
    }

    const pdf = new jsPDF('p', 'mm', 'letter');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    let yPos = margin;

    // Encabezado
    pdf.setFontSize(18);
    pdf.setTextColor(30, 41, 59);
    pdf.text(_infDatos.nombreEstudio || 'Estudio Contable', pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    pdf.setFontSize(10);
    pdf.setTextColor(100, 116, 139);
    pdf.text('INFORME DE AUDITORÍA CONTABLE', pageWidth / 2, yPos, { align: 'center' });
    yPos += 6;

    const periodoLabel = datos.periodo ? datos.periodo.split('-').reverse().join('/') : '—';
    pdf.setFontSize(9);
    pdf.text(`Período: ${periodoLabel}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 12;

    // Línea divisoria
    pdf.setDrawColor(30, 41, 59);
    pdf.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;

    // Datos de la empresa
    pdf.setFontSize(11);
    pdf.setTextColor(30, 41, 59);
    pdf.text('Información de la Empresa', margin, yPos);
    yPos += 7;

    pdf.setFontSize(9);
    pdf.setTextColor(71, 85, 105);
    pdf.text(`Razón Social: ${_esc(datos.empresa?.nombre || '—')}`, margin + 2, yPos);
    yPos += 5;
    pdf.text(`RUT: ${_esc(datos.empresa?.rut || '—')}`, margin + 2, yPos);
    yPos += 8;

    // Resumen financiero
    pdf.setFontSize(11);
    pdf.setTextColor(30, 41, 59);
    pdf.text('Resumen Financiero', margin, yPos);
    yPos += 7;

    pdf.setFontSize(9);
    pdf.setTextColor(71, 85, 105);
    const finData = [
        [`Activos:`, `$${fmt(datos.activos)}`],
        [`Pasivos:`, `$${fmt(datos.pasivos)}`],
        [`Patrimonio:`, `$${fmt(datos.patrimonio)}`],
        [`Ingresos:`, `$${fmt(datos.ingresos)}`],
        [`Gastos:`, `$${fmt(datos.gastos)}`],
        [`Resultado Neto:`, `$${fmt(datos.resultado)}`],
    ];

    finData.forEach(([label, value]) => {
        pdf.text(label, margin + 2, yPos);
        pdf.text(value, pageWidth - margin - 2, yPos, { align: 'right' });
        yPos += 5;
    });

    yPos += 5;

    // Hallazgos
    if (datos.hallazgos.length) {
        if (yPos > pageHeight - 40) {
            pdf.addPage();
            yPos = margin;
        }

        pdf.setFontSize(11);
        pdf.setTextColor(30, 41, 59);
        pdf.text('Hallazgos y Observaciones', margin, yPos);
        yPos += 7;

        pdf.setFontSize(8);
        datos.hallazgos.forEach(h => {
            if (yPos > pageHeight - 20) {
                pdf.addPage();
                yPos = margin;
            }

            pdf.setTextColor(71, 85, 105);
            pdf.text(`• [${h.tipo.toUpperCase()}] ${h.modulo}:`, margin + 2, yPos);
            yPos += 4;

            const palabras = h.descripcion.split(' ');
            let linea = '';
            palabras.forEach(palabra => {
                if ((linea + palabra).length > 70) {
                    pdf.text(linea, margin + 4, yPos);
                    yPos += 3;
                    linea = palabra + ' ';
                } else {
                    linea += palabra + ' ';
                }
            });
            if (linea) {
                pdf.text(linea, margin + 4, yPos);
                yPos += 4;
            }
        });

        yPos += 5;
    }

    // Opinión
    if (yPos > pageHeight - 40) {
        pdf.addPage();
        yPos = margin;
    }

    pdf.setFontSize(11);
    pdf.setTextColor(30, 41, 59);
    pdf.text('Opinión Profesional', margin, yPos);
    yPos += 7;

    pdf.setFontSize(9);
    pdf.setTextColor(71, 85, 105);
    const lineasOpinion = pdf.splitTextToSize(_infDatos.opinion, pageWidth - 2 * margin - 2);
    pdf.text(lineasOpinion, margin + 2, yPos);
    yPos += lineasOpinion.length * 5 + 5;

    // Firma
    if (yPos > pageHeight - 30) {
        pdf.addPage();
        yPos = margin;
    }

    yPos = pageHeight - 30;
    pdf.setFontSize(10);
    pdf.setTextColor(30, 41, 59);
    pdf.text(_infDatos.nombreContador, margin, yPos);

    pdf.setFontSize(8);
    pdf.setTextColor(100, 116, 139);
    pdf.text(`RUT: ${_infDatos.rutContador}`, margin, yPos + 4);
    pdf.text(`Nº Registro: ${_infDatos.matriculaContador}`, margin, yPos + 8);

    const fHoy = new Date().toLocaleDateString('es-CL');
    pdf.text(fHoy, pageWidth - margin, yPos + 8, { align: 'right' });

    pdf.save(nombreArchivo);
    mostrarToast(`Informe exportado: ${nombreArchivo}`, 'ok');
}

// ─────────────────────────────────────────────────────────────
//  VISTA PRINCIPAL
// ─────────────────────────────────────────────────────────────

function renderInforme() {
    informeCargarBorrador();

    const el = document.getElementById('view-informe');
    if (!el) return;

    const empresa = window.empresaActual;
    const periodo = new Date().toISOString().slice(0, 7);

    el.innerHTML = `
    <div style="padding:20px;max-width:1400px;margin:0 auto;">

        <h2 style="margin-top:0;">📄 Generador de Informe de Auditoría</h2>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">

            <!-- PANEL DE FORMULARIO -->
            <div>
                <div class="card">
                    <h3 style="margin-top:0;">Datos del Informe</h3>

                    <div class="form-grupo">
                        <label>Período a Auditar</label>
                        <input type="month" id="infPeriodo" value="${periodo}">
                    </div>

                    <div class="form-grupo">
                        <label>Nombre del Estudio *</label>
                        <input type="text" id="infNombreEstudio" placeholder="Ej: Estudio Contable XYZ"
                            value="${_infDatos.nombreEstudio}" onchange="audInfActualizarDatos()">
                    </div>

                    <div class="form-grupo">
                        <label>Teléfono</label>
                        <input type="text" id="infTelefono" placeholder="Ej: +56 9 1234 5678"
                            value="${_infDatos.telefono}" onchange="audInfActualizarDatos()">
                    </div>

                    <div class="form-grupo">
                        <label>Email</label>
                        <input type="email" id="infEmail" placeholder="Ej: contacto@estudio.cl"
                            value="${_infDatos.email}" onchange="audInfActualizarDatos()">
                    </div>

                    <hr style="margin:16px 0;border:none;border-top:1px solid var(--border);">

                    <div class="form-grupo">
                        <label>Nombre Contador *</label>
                        <input type="text" id="infNombreContador" placeholder="Ej: Juan Pérez López"
                            value="${_infDatos.nombreContador}" onchange="audInfActualizarDatos()">
                    </div>

                    <div class="form-grupo">
                        <label>RUT Contador *</label>
                        <input type="text" id="infRutContador" placeholder="Ej: 12.345.678-9"
                            value="${_infDatos.rutContador}" onchange="audInfActualizarDatos()">
                    </div>

                    <div class="form-grupo">
                        <label>Matrícula SII (Nº Registro)</label>
                        <input type="text" id="infMatriculaContador" placeholder="Ej: 12345"
                            value="${_infDatos.matriculaContador}" onchange="audInfActualizarDatos()">
                    </div>

                    <hr style="margin:16px 0;border:none;border-top:1px solid var(--border);">

                    <div class="form-grupo">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                            <label style="margin:0;">Opinión Profesional * (mín. 10 caracteres)</label>
                            ${_iaGetKey ? `<button type="button" class="btn btn-secondary" style="font-size:12px;padding:5px 10px;" onclick="audInfGenerarConIA()">✨ Generar con IA</button>` : ''}
                        </div>
                        <textarea id="infOpinion" rows="6" placeholder="Escriba su opinión sobre la contabilidad del período…"
                            onchange="audInfActualizarDatos()">${_infDatos.opinion}</textarea>
                    </div>

                    <div style="display:flex;gap:8px;margin-top:16px;">
                        <button class="btn btn-secondary" onclick="audInfGuardarBorrador()">💾 Guardar Borrador</button>
                        <button class="btn btn-primary" onclick="informeExportarPDF()">📥 Exportar PDF</button>
                    </div>
                </div>
            </div>

            <!-- PANEL DE VISTA PREVIA -->
            <div>
                <div class="card" style="max-height:800px;overflow-y:auto;">
                    <h3 style="margin-top:0;margin-bottom:12px;">Vista Previa</h3>
                    <button class="btn btn-primary" style="margin-bottom:12px;width:100%;" onclick="informeVistaPrevia()">
                        🔄 Actualizar vista previa
                    </button>
                    <div id="infPreview" style="background:#fff;padding:12px;border:1px solid var(--border);border-radius:4px;font-size:12px;"></div>
                </div>
            </div>

        </div>

    </div>`;

    informeVistaPrevia();
}

// ─────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────

function audInfActualizarDatos() {
    _infDatos.nombreEstudio = document.getElementById('infNombreEstudio')?.value || '';
    _infDatos.telefono = document.getElementById('infTelefono')?.value || '';
    _infDatos.email = document.getElementById('infEmail')?.value || '';
    _infDatos.nombreContador = document.getElementById('infNombreContador')?.value || '';
    _infDatos.rutContador = document.getElementById('infRutContador')?.value || '';
    _infDatos.matriculaContador = document.getElementById('infMatriculaContador')?.value || '';
    _infDatos.opinion = document.getElementById('infOpinion')?.value || '';
}

async function audInfGenerarConIA() {
    const hallazgos = typeof audHallazgosObtener === 'function' ? audHallazgosObtener() : [];
    const texto = await iaGenerarTextoInforme(hallazgos.length ? hallazgos : [
        { tipo: 'Observación', descripcion: 'Contabilidad del período sin hallazgos críticos registrados.' }
    ]);
    if (!texto) return;
    const ta = document.getElementById('infOpinion');
    if (ta) { ta.value = texto; audInfActualizarDatos(); }
}

function audInfGuardarBorrador() {
    audInfActualizarDatos();
    informeGuardarBorrador();
    informeVistaPrevia();
}

function _esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ─────────────────────────────────────────────────────────────
//  EXPOSE
// ─────────────────────────────────────────────────────────────

window.informeCargarBorrador = informeCargarBorrador;
window.informeGuardarBorrador = informeGuardarBorrador;
window.informeVistaPrevia = informeVistaPrevia;
window.informeExportarPDF = informeExportarPDF;
window.renderInforme = renderInforme;
window.audInfActualizarDatos = audInfActualizarDatos;
window.audInfGuardarBorrador = audInfGuardarBorrador;
