'use strict';
// ─────────────────────────────────────────────────────────────────────────────
//  HONORARIOS DEL ESTUDIO — F2.5
//  Módulo para que el contador emita boletas a sus propios clientes.
//  Datos en localStorage: core_hon_estudio (array de boletas).
//  Integra con time-tracking de panel-estudio.js.
// ─────────────────────────────────────────────────────────────────────────────

const HON_EST_KEY = 'core_hon_estudio';

function honEstCargar() {
    try { return JSON.parse(localStorage.getItem(HON_EST_KEY) || '[]'); } catch { return []; }
}
function honEstGuardar(data) {
    localStorage.setItem(HON_EST_KEY, JSON.stringify(data));
}
function honEstNuevoId() {
    return 'he_' + Date.now();
}

// ── Render principal ──────────────────────────────────────────────────────────
function honEstRender() {
    const boletas = honEstCargar();
    const hoy     = new Date().toISOString().slice(0, 7); // YYYY-MM

    const totalFact  = boletas.reduce((s, b) => s + (b.monto || 0), 0);
    const totalCobr  = boletas.filter(b => b.estado === 'pagada').reduce((s, b) => s + (b.monto || 0), 0);
    const totalPend  = boletas.filter(b => b.estado !== 'pagada').reduce((s, b) => s + (b.monto || 0), 0);

    const kpis = `
    <div class="hon-est-kpis">
        <div class="kpi-card">
            <div class="kpi-value">${fmt(totalFact)}</div>
            <div class="kpi-label">Total facturado</div>
        </div>
        <div class="kpi-card kpi-card-positive">
            <div class="kpi-value">${fmt(totalCobr)}</div>
            <div class="kpi-label">Cobrado</div>
        </div>
        <div class="kpi-card kpi-card-warning">
            <div class="kpi-value">${fmt(totalPend)}</div>
            <div class="kpi-label">Por cobrar</div>
        </div>
    </div>`;

    const toolbar = `
    <div class="hon-est-toolbar">
        <button class="btn-primary" onclick="honEstAbrirModal()">➕ Nueva Boleta</button>
        ${boletas.length ? `<button class="btn-secondary" onclick="honEstExportarExcel()">📊 Exportar Excel</button>` : ''}
    </div>`;

    const tabla = boletas.length ? `
    <div class="card" style="padding:0;overflow:hidden;">
        <table class="cont-table" style="font-size:13px;">
            <thead><tr>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Concepto</th>
                <th class="monto">Horas</th>
                <th class="monto">Monto</th>
                <th>Estado</th>
                <th></th>
            </tr></thead>
            <tbody>
                ${boletas.slice().reverse().map(b => {
                    const estadoColor = b.estado === 'pagada' ? 'var(--positive,#166534)' :
                                       b.estado === 'emitida' ? '#2563eb' : 'var(--text-muted)';
                    const estadoLabel = { borrador: 'Borrador', emitida: 'Emitida', pagada: 'Pagada' }[b.estado] || b.estado;
                    return `<tr>
                        <td style="white-space:nowrap;">${(b.fechaEmision||'').slice(0,10)}</td>
                        <td>${b.clienteNombre || '—'}</td>
                        <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${b.concepto || ''}</td>
                        <td class="monto">${b.horas ? b.horas + 'h' : '—'}</td>
                        <td class="monto" style="font-weight:600;">${fmt(b.monto || 0)}</td>
                        <td>
                            <span style="font-size:11px;font-weight:700;color:${estadoColor};">${estadoLabel}</span>
                        </td>
                        <td style="white-space:nowrap;">
                            <button class="btn-icon" onclick="honEstAbrirModal('${b.id}')" title="Editar">✏️</button>
                            <button class="btn-icon" onclick="honEstExportarPDF('${b.id}')" title="PDF">📄</button>
                            ${b.estado !== 'pagada' ? `<button class="btn-icon" onclick="honEstMarcarPagada('${b.id}')" title="Marcar pagada">✅</button>` : ''}
                            <button class="btn-icon btn-icon-danger" onclick="honEstEliminar('${b.id}')" title="Eliminar">🗑️</button>
                        </td>
                    </tr>`;
                }).join('')}
            </tbody>
        </table>
    </div>` : `
    <div class="card" style="text-align:center;padding:60px 40px;color:var(--text-muted);">
        <div style="font-size:40px;margin-bottom:12px;">📑</div>
        <div style="font-size:15px;font-weight:600;margin-bottom:6px;">Sin boletas emitidas</div>
        <div style="font-size:13px;">Crea tu primera boleta de honorarios al estudio.</div>
    </div>`;

    document.getElementById('honEstContenido').innerHTML = kpis + toolbar + tabla;
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function honEstAbrirModal(id) {
    const boletas  = honEstCargar();
    const boleta   = id ? boletas.find(b => b.id === id) : null;
    const clientes = (window.currentUser?.empresas || []).length > 0 ?
        (window._panelClientesCache || []) : [];

    // Pre-llenar horas desde time tracking si no hay boleta existente
    let horasSugeridas = 0;
    if (!boleta && typeof panelTTEntradas === 'function') {
        const periodo = new Date().toISOString().slice(0,7);
        const entries = panelTTEntradas();
        const minTotales = entries
            .filter(e => (e.inicio||'').startsWith(periodo))
            .reduce((s, e) => s + (e.minutos || 0), 0);
        horasSugeridas = Math.round(minTotales / 60 * 10) / 10;
    }

    const cfg = JSON.parse(localStorage.getItem('core_config') || '{}');
    const tarifaDefault = cfg.tarifaHora || 0;

    // Opciones de clientes
    const optsClientes = clientes.map(c =>
        `<option value="${c.id}" data-nombre="${c.empresa||''}" ${boleta?.clienteId === c.id ? 'selected' : ''}>${c.empresa||c.id}</option>`
    ).join('');

    const modal = document.getElementById('honEstModal');
    document.getElementById('honEstModalTitulo').textContent = boleta ? 'Editar Boleta' : 'Nueva Boleta';
    document.getElementById('honEstId').value           = boleta?.id || '';
    document.getElementById('honEstClienteId').innerHTML = `<option value="">— Seleccionar cliente —</option>${optsClientes}`;
    if (boleta?.clienteId) document.getElementById('honEstClienteId').value = boleta.clienteId;
    document.getElementById('honEstConcepto').value     = boleta?.concepto  || '';
    document.getElementById('honEstHoras').value        = (boleta?.horas     ?? horasSugeridas) || '';
    document.getElementById('honEstTarifa').value       = (boleta?.tarifa    ?? tarifaDefault)  || '';
    document.getElementById('honEstMonto').value        = boleta?.monto     || '';
    document.getElementById('honEstFecha').value        = boleta?.fechaEmision?.slice(0,10) || new Date().toISOString().slice(0,10);
    document.getElementById('honEstEstado').value       = boleta?.estado    || 'borrador';
    document.getElementById('honEstNotas').value        = boleta?.notas     || '';

    honEstRecalcular();
    modal.style.display = 'flex';
}

function honEstCerrarModal() {
    document.getElementById('honEstModal').style.display = 'none';
}

function honEstRecalcular() {
    const horas  = parseFloat(document.getElementById('honEstHoras').value)  || 0;
    const tarifa = parseFloat(document.getElementById('honEstTarifa').value) || 0;
    if (horas && tarifa) {
        document.getElementById('honEstMonto').value = Math.round(horas * tarifa);
    }
}

function honEstGuardarModal() {
    const id     = document.getElementById('honEstId').value;
    const selEl  = document.getElementById('honEstClienteId');
    const clienteId    = selEl.value;
    const clienteNombre = selEl.options[selEl.selectedIndex]?.dataset.nombre || clienteId;
    const concepto     = document.getElementById('honEstConcepto').value.trim();
    const horas        = parseFloat(document.getElementById('honEstHoras').value)  || 0;
    const tarifa       = parseFloat(document.getElementById('honEstTarifa').value) || 0;
    const monto        = parseFloat(document.getElementById('honEstMonto').value)  || 0;
    const fechaEmision = document.getElementById('honEstFecha').value;
    const estado       = document.getElementById('honEstEstado').value;
    const notas        = document.getElementById('honEstNotas').value.trim();

    if (!concepto) { mostrarToast('El concepto es obligatorio.', 'error'); return; }
    if (!monto)    { mostrarToast('El monto debe ser mayor a 0.', 'error'); return; }

    const boletas = honEstCargar();
    if (id) {
        const idx = boletas.findIndex(b => b.id === id);
        if (idx !== -1) boletas[idx] = { ...boletas[idx], clienteId, clienteNombre, concepto, horas, tarifa, monto, fechaEmision, estado, notas };
    } else {
        boletas.push({ id: honEstNuevoId(), clienteId, clienteNombre, concepto, horas, tarifa, monto, fechaEmision, estado, notas });
    }
    honEstGuardar(boletas);
    honEstCerrarModal();
    honEstRender();
    mostrarToast('Boleta guardada.', 'ok');
}

function honEstMarcarPagada(id) {
    mostrarConfirm('¿Marcar esta boleta como pagada?', () => {
        const boletas = honEstCargar();
        const b = boletas.find(x => x.id === id);
        if (b) { b.estado = 'pagada'; honEstGuardar(boletas); honEstRender(); mostrarToast('Boleta marcada como pagada.', 'ok'); }
    });
}

function honEstEliminar(id) {
    mostrarConfirm('¿Eliminar esta boleta? Esta acción no se puede deshacer.', () => {
        honEstGuardar(honEstCargar().filter(b => b.id !== id));
        honEstRender();
        mostrarToast('Boleta eliminada.', 'ok');
    });
}

// ── Exportar PDF ──────────────────────────────────────────────────────────────
function honEstExportarPDF(id) {
    const boleta = honEstCargar().find(b => b.id === id);
    if (!boleta) return;
    const cfg = JSON.parse(localStorage.getItem('core_config') || '{}');

    if (typeof jsPDF === 'undefined') {
        mostrarToast('jsPDF no disponible.', 'error'); return;
    }
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });

    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('BOLETA DE HONORARIOS', 105, 20, { align: 'center' });

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(cfg.empresa || 'Estudio Contable', 105, 28, { align: 'center' });
    if (cfg.rut)       doc.text(`RUT: ${cfg.rut}`, 105, 33, { align: 'center' });
    if (cfg.direccion) doc.text(cfg.direccion, 105, 38, { align: 'center' });

    doc.setDrawColor(172, 64, 109);
    doc.line(15, 42, 195, 42);

    // Datos boleta
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('CLIENTE:', 15, 52);
    doc.setFont('helvetica', 'normal');
    doc.text(boleta.clienteNombre || '—', 45, 52);

    doc.setFont('helvetica', 'bold');
    doc.text('FECHA:', 140, 52);
    doc.setFont('helvetica', 'normal');
    doc.text(boleta.fechaEmision?.slice(0,10) || '—', 158, 52);

    doc.line(15, 56, 195, 56);

    // Tabla
    doc.setFont('helvetica', 'bold');
    doc.text('Concepto', 15, 63);
    doc.text('Horas', 140, 63);
    doc.text('Tarifa', 160, 63);
    doc.text('Total', 180, 63);
    doc.line(15, 65, 195, 65);

    doc.setFont('helvetica', 'normal');
    const concepto = doc.splitTextToSize(boleta.concepto || '—', 120);
    doc.text(concepto, 15, 72);
    doc.text(boleta.horas ? String(boleta.horas) : '—', 140, 72);
    doc.text(boleta.tarifa ? `$${boleta.tarifa.toLocaleString('es-CL')}` : '—', 158, 72);
    doc.text(`$${(boleta.monto||0).toLocaleString('es-CL')}`, 178, 72);

    doc.line(15, 78, 195, 78);

    // Total
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('TOTAL A COBRAR:', 130, 86);
    doc.text(`$${(boleta.monto||0).toLocaleString('es-CL')}`, 178, 86);

    if (boleta.notas) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Notas: ' + boleta.notas, 15, 96);
    }

    doc.save(`boleta-honorarios-${boleta.id}.pdf`);
    mostrarToast('PDF generado.', 'ok');
}

// ── Exportar Excel ─────────────────────────────────────────────────────────────
function honEstExportarExcel() {
    const boletas = honEstCargar();
    if (!boletas.length || typeof XLSX === 'undefined') { mostrarToast('Sin datos o XLSX no disponible.', 'error'); return; }

    const rows = [['Fecha', 'Cliente', 'Concepto', 'Horas', 'Tarifa', 'Monto', 'Estado', 'Notas']];
    boletas.forEach(b => rows.push([
        b.fechaEmision?.slice(0,10) || '',
        b.clienteNombre || '',
        b.concepto || '',
        b.horas || '',
        b.tarifa || '',
        b.monto || 0,
        b.estado || '',
        b.notas || '',
    ]));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Honorarios Estudio');
    XLSX.writeFile(wb, 'honorarios-estudio.xlsx');
    mostrarToast('Excel exportado.', 'ok');
}

// ── Caché de clientes para el modal ──────────────────────────────────────────
// Se puebla desde panel-estudio cuando carga los clientes
window._panelClientesCache = window._panelClientesCache || [];

// ── Expose ────────────────────────────────────────────────────────────────────
window.honEstRender        = honEstRender;
window.honEstAbrirModal    = honEstAbrirModal;
window.honEstCerrarModal   = honEstCerrarModal;
window.honEstRecalcular    = honEstRecalcular;
window.honEstGuardarModal  = honEstGuardarModal;
window.honEstMarcarPagada  = honEstMarcarPagada;
window.honEstEliminar      = honEstEliminar;
window.honEstExportarPDF   = honEstExportarPDF;
window.honEstExportarExcel = honEstExportarExcel;
