// ─────────────────────────────────────────────────────────────
//  EXPORTAR — PDF, Excel, Impresión y Archivos Adjuntos
//  Fase 5: todas las exportaciones pasan por este módulo.
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
//  ENCABEZADO PROFESIONAL (5.5)
// ─────────────────────────────────────────────────────────────
function _getEncabezadoHTML(nombreReporte) {
    const cfg     = JSON.parse(localStorage.getItem('core_config') || '{}');
    const empresa = cfg.empresa   || 'Mi Empresa';
    const rut     = cfg.rut       || '–';
    const periodo = cfg.periodo   || new Date().getFullYear();
    const usuario = window.currentUser?.email || 'Usuario local';
    const fecha   = new Date().toLocaleString('es-CL');

    return `
    <div class="print-encabezado">
        <div class="print-enc-left">
            <div class="print-enc-soft">ContApp ERP Forge</div>
            <div class="print-enc-empresa">${empresa}</div>
            <div class="print-enc-rut">RUT: ${rut}</div>
        </div>
        <div class="print-enc-right">
            <div class="print-enc-reporte">${nombreReporte}</div>
            <div class="print-enc-meta">Período: ${periodo}</div>
            <div class="print-enc-meta">Generado: ${fecha}</div>
            <div class="print-enc-meta">Usuario: ${usuario}</div>
        </div>
    </div>
    <div class="print-enc-divider"></div>`;
}

function _getEncabezadoExcel(nombreReporte) {
    const cfg     = JSON.parse(localStorage.getItem('core_config') || '{}');
    const empresa = cfg.empresa || 'Mi Empresa';
    const rut     = cfg.rut     || '–';
    const periodo = cfg.periodo || new Date().getFullYear();
    const usuario = window.currentUser?.email || 'Usuario local';
    const fecha   = new Date().toLocaleString('es-CL');
    return [
        `ContApp ERP Forge — ${empresa}`,
        `RUT: ${rut}  |  Período: ${periodo}`,
        `Reporte: ${nombreReporte}`,
        `Generado el ${fecha} por ${usuario}`,
    ];
}

// ─────────────────────────────────────────────────────────────
//  PDF (5.2)
// ─────────────────────────────────────────────────────────────
async function exportarPDF(nombreReporte) {
    if (!window.electronAPI?.pdf) {
        mostrarToast('PDF solo disponible en la app de escritorio.', 'error');
        return;
    }
    const encDiv = document.getElementById('printEncabezado');
    if (encDiv) {
        encDiv.innerHTML  = _getEncabezadoHTML(nombreReporte);
        encDiv.style.display = 'block';
    }
    document.body.setAttribute('data-imprimiendo', '');

    try {
        const cfg    = JSON.parse(localStorage.getItem('core_config') || '{}');
        const nombre = `${nombreReporte}_${cfg.empresa || 'empresa'}_${new Date().toLocaleDateString('es-CL').replace(/\//g, '-')}`;
        const ruta   = await window.electronAPI.pdf.exportar(nombre);
        if (ruta) mostrarToast(`PDF guardado correctamente.`, 'ok');
    } catch(e) {
        mostrarToast('Error al generar PDF: ' + e.message, 'error');
    } finally {
        document.body.removeAttribute('data-imprimiendo');
        if (encDiv) encDiv.style.display = 'none';
    }
}

// ─────────────────────────────────────────────────────────────
//  IMPRESIÓN (5.3)
// ─────────────────────────────────────────────────────────────
function imprimirReporte(nombreReporte) {
    const encDiv = document.getElementById('printEncabezado');
    if (encDiv) {
        encDiv.innerHTML  = _getEncabezadoHTML(nombreReporte);
        encDiv.style.display = 'block';
    }
    window.print();
    if (encDiv) setTimeout(() => { encDiv.style.display = 'none'; }, 500);
}

// ─────────────────────────────────────────────────────────────
//  EXCEL (5.4)
// ─────────────────────────────────────────────────────────────
async function exportarExcel(nombreReporte, headers, filas, hoja) {
    if (!window.electronAPI?.excel) {
        mostrarToast('Excel solo disponible en la app de escritorio.', 'error');
        return;
    }
    const cfg    = JSON.parse(localStorage.getItem('core_config') || '{}');
    const nombre = `${nombreReporte}_${cfg.empresa || 'empresa'}_${new Date().toLocaleDateString('es-CL').replace(/\//g, '-')}`;
    try {
        const ruta = await window.electronAPI.excel.exportar({
            encabezado: _getEncabezadoExcel(nombreReporte),
            headers,
            rows: filas,
            nombre,
            hoja: hoja || nombreReporte,
        });
        if (ruta) mostrarToast(`Excel guardado correctamente.`, 'ok');
    } catch(e) {
        mostrarToast('Error al generar Excel: ' + e.message, 'error');
    }
}

// ─────────────────────────────────────────────────────────────
//  HELPER: extraer tabla del DOM → filas para Excel
// ─────────────────────────────────────────────────────────────
function _tablaAFilas(tablaSelector) {
    const filas = [];
    document.querySelectorAll(`${tablaSelector} tbody tr`).forEach(tr => {
        const fila = [];
        tr.querySelectorAll('td').forEach(td => {
            // Limpiar: quitar símbolos de moneda, dejar número limpio si aplica
            fila.push(td.innerText.trim());
        });
        if (fila.some(c => c !== '')) filas.push(fila);
    });
    return filas;
}

function _tablaAHeaders(tablaSelector) {
    const headers = [];
    const thRow = document.querySelector(`${tablaSelector} thead tr`);
    if (thRow) thRow.querySelectorAll('th').forEach(th => headers.push(th.innerText.trim()));
    return headers;
}

// ─────────────────────────────────────────────────────────────
//  EXPORTACIONES ESPECÍFICAS POR MÓDULO
// ─────────────────────────────────────────────────────────────

function exportarPDFMayor()              { exportarPDF('Libro Mayor'); }
function exportarPDFBalance()            { exportarPDF('Balance de Comprobación'); }
function exportarPDFBalanceClasificado() { exportarPDF('Balance Clasificado'); }
function exportarPDFEstadoResultados()   { exportarPDF('Estado de Resultados'); }
function exportarPDFFlujoCaja()          { exportarPDF('Flujo de Caja'); }
function exportarPDFCompras()            { exportarPDF('Libro de Compras'); }
function exportarPDFVentas()             { exportarPDF('Libro de Ventas'); }

function imprimirMayor()              { imprimirReporte('Libro Mayor'); }
function imprimirBalance()            { imprimirReporte('Balance de Comprobación'); }
function imprimirBalanceClasificado() { imprimirReporte('Balance Clasificado'); }
function imprimirEstadoResultados()   { imprimirReporte('Estado de Resultados'); }
function imprimirFlujoCaja()          { imprimirReporte('Flujo de Caja'); }
function imprimirCompras()            { imprimirReporte('Libro de Compras'); }
function imprimirVentas()             { imprimirReporte('Libro de Ventas'); }

function exportarExcelMayor() {
    const h = _tablaAHeaders('#view-mayor .cont-table');
    const f = _tablaAFilas('#view-mayor .cont-table');
    exportarExcel('Libro Mayor', h, f, 'Mayor');
}
function exportarExcelBalance() {
    const h = _tablaAHeaders('#view-balance .cont-table');
    const f = _tablaAFilas('#view-balance .cont-table');
    exportarExcel('Balance de Comprobación', h, f, 'Balance');
}
function exportarExcelBalanceClasificado() {
    const h = _tablaAHeaders('#view-balance-clasificado .cont-table');
    const f = _tablaAFilas('#view-balance-clasificado .cont-table');
    exportarExcel('Balance Clasificado', h, f, 'Bal. Clasificado');
}
function exportarExcelEstadoResultados() {
    const h = _tablaAHeaders('#view-estado-resultados .cont-table');
    const f = _tablaAFilas('#view-estado-resultados .cont-table');
    exportarExcel('Estado de Resultados', h, f, 'Est. Resultados');
}
function exportarExcelFlujoCaja() {
    const h = _tablaAHeaders('#view-flujo-caja .cont-table');
    const f = _tablaAFilas('#view-flujo-caja .cont-table');
    exportarExcel('Flujo de Caja', h, f, 'Flujo Caja');
}
function exportarExcelCompras() {
    const h = _tablaAHeaders('#view-compras .cont-table');
    const f = _tablaAFilas('#view-compras .cont-table');
    exportarExcel('Libro de Compras', h, f, 'Compras');
}
function exportarExcelVentas() {
    const h = _tablaAHeaders('#view-ventas .cont-table');
    const f = _tablaAFilas('#view-ventas .cont-table');
    exportarExcel('Libro de Ventas', h, f, 'Ventas');
}
function exportarExcelContactos() {
    const h = _tablaAHeaders('#view-clientes .cont-table');
    const f = _tablaAFilas('#view-clientes .cont-table');
    exportarExcel('Contactos', h, f, 'Contactos');
}

// ─────────────────────────────────────────────────────────────
//  ADJUNTAR ARCHIVOS (5.1)
// ─────────────────────────────────────────────────────────────
async function adjuntarArchivo(onResult) {
    if (!window.electronAPI?.archivo) {
        mostrarToast('Adjuntar archivos solo disponible en la app de escritorio.', 'error');
        return;
    }
    const resultado = await window.electronAPI.archivo.adjuntar();
    if (resultado) onResult(resultado);
}

function abrirAdjunto(ruta) {
    if (!ruta) return;
    if (window.electronAPI?.archivo) {
        window.electronAPI.archivo.abrir(ruta).then(err => {
            if (err) mostrarToast('No se pudo abrir el archivo.', 'error');
        });
    }
}

// Exponer globalmente
window.exportarPDF                   = exportarPDF;
window.exportarPDFMayor              = exportarPDFMayor;
window.exportarPDFBalance            = exportarPDFBalance;
window.exportarPDFBalanceClasificado = exportarPDFBalanceClasificado;
window.exportarPDFEstadoResultados   = exportarPDFEstadoResultados;
window.exportarPDFFlujoCaja          = exportarPDFFlujoCaja;
window.exportarPDFCompras            = exportarPDFCompras;
window.exportarPDFVentas             = exportarPDFVentas;

window.imprimirMayor              = imprimirMayor;
window.imprimirBalance            = imprimirBalance;
window.imprimirBalanceClasificado = imprimirBalanceClasificado;
window.imprimirEstadoResultados   = imprimirEstadoResultados;
window.imprimirFlujoCaja          = imprimirFlujoCaja;
window.imprimirCompras            = imprimirCompras;
window.imprimirVentas             = imprimirVentas;

window.exportarExcelMayor              = exportarExcelMayor;
window.exportarExcelBalance            = exportarExcelBalance;
window.exportarExcelBalanceClasificado = exportarExcelBalanceClasificado;
window.exportarExcelEstadoResultados   = exportarExcelEstadoResultados;
window.exportarExcelFlujoCaja          = exportarExcelFlujoCaja;
window.exportarExcelCompras            = exportarExcelCompras;
window.exportarExcelVentas             = exportarExcelVentas;
window.exportarExcelContactos          = exportarExcelContactos;

window.adjuntarArchivo = adjuntarArchivo;
window.abrirAdjunto    = abrirAdjunto;
