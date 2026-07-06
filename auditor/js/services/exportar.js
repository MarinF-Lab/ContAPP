'use strict';
// ─────────────────────────────────────────────────────────────────────────────
//  EXPORTAR — PDF (print), Excel (SheetJS), Impresión
//  Web-native: funciona sin Electron. Electron usa su propia API si está.
// ─────────────────────────────────────────────────────────────────────────────

// ── Encabezados ───────────────────────────────────────────────────────────────
function _getEncabezadoHTML(nombreReporte) {
    const cfg     = JSON.parse(localStorage.getItem('core_config') || '{}');
    const empresa = cfg.empresa || 'Mi Empresa';
    const rut     = cfg.rut     || '–';
    const periodo = cfg.periodo || new Date().getFullYear();
    const usuario = window.currentUser?.email || 'Usuario local';
    const fecha   = new Date().toLocaleString('es-CL');
    return `
    <div class="print-encabezado">
        <div class="print-enc-left">
            <div class="print-enc-soft">ContApp Auditor</div>
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
        `ContApp Auditor — ${empresa}`,
        `RUT: ${rut}  |  Período: ${periodo}`,
        `Reporte: ${nombreReporte}`,
        `Generado el ${fecha} por ${usuario}`,
    ];
}

// ── Helpers DOM → datos ───────────────────────────────────────────────────────
function _tablaAFilas(tablaSelector) {
    const filas = [];
    document.querySelectorAll(`${tablaSelector} tbody tr`).forEach(tr => {
        const fila = [];
        tr.querySelectorAll('td').forEach(td => fila.push(td.innerText.trim()));
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

function _nombreArchivo(reporte) {
    const cfg = JSON.parse(localStorage.getItem('core_config') || '{}');
    const emp = (cfg.empresa || 'empresa').replace(/[^a-zA-Z0-9]/g, '_');
    const fecha = new Date().toLocaleDateString('es-CL').replace(/\//g, '-');
    return `${reporte}_${emp}_${fecha}`;
}

// ── PDF ───────────────────────────────────────────────────────────────────────
async function exportarPDF(nombreReporte) {
    if (window.electronAPI?.pdf) {
        const encDiv = document.getElementById('printEncabezado');
        if (encDiv) { encDiv.innerHTML = _getEncabezadoHTML(nombreReporte); encDiv.style.display = 'block'; }
        document.body.setAttribute('data-imprimiendo', '');
        try {
            const ruta = await window.electronAPI.pdf.exportar(_nombreArchivo(nombreReporte));
            if (ruta) mostrarToast('PDF guardado.', 'ok');
        } catch(e) {
            mostrarToast('Error PDF: ' + e.message, 'error');
        } finally {
            document.body.removeAttribute('data-imprimiendo');
            if (encDiv) encDiv.style.display = 'none';
        }
    } else {
        imprimirReporte(nombreReporte);
    }
}

// ── Impresión ─────────────────────────────────────────────────────────────────
function imprimirReporte(nombreReporte) {
    const encDiv = document.getElementById('printEncabezado');
    if (encDiv) { encDiv.innerHTML = _getEncabezadoHTML(nombreReporte); encDiv.style.display = 'block'; }
    window.print();
    if (encDiv) setTimeout(() => { encDiv.style.display = 'none'; }, 500);
}

// ── Excel (SheetJS web-native) ────────────────────────────────────────────────
async function exportarExcel(nombreReporte, headers, filas, hoja) {
    if (window.electronAPI?.excel) {
        try {
            const ruta = await window.electronAPI.excel.exportar({
                encabezado: _getEncabezadoExcel(nombreReporte),
                headers, rows: filas,
                nombre: _nombreArchivo(nombreReporte),
                hoja: hoja || nombreReporte,
            });
            if (ruta) mostrarToast('Excel guardado.', 'ok');
        } catch(e) {
            mostrarToast('Error Excel: ' + e.message, 'error');
        }
        return;
    }

    if (typeof XLSX === 'undefined') {
        mostrarToast('SheetJS no disponible.', 'error');
        return;
    }

    const enc   = _getEncabezadoExcel(nombreReporte);
    const datos = [
        ...enc.map(e => [e]),
        [],
        headers,
        ...filas,
    ];
    const ws = XLSX.utils.aoa_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, (hoja || nombreReporte).substring(0, 31));
    XLSX.writeFile(wb, _nombreArchivo(nombreReporte) + '.xlsx');
    mostrarToast('Excel descargado.', 'ok');
}

// ── Primera categoría ─────────────────────────────────────────────────────────
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
    exportarExcel('Libro Mayor',
        _tablaAHeaders('#view-mayor .cont-table'),
        _tablaAFilas('#view-mayor .cont-table'), 'Mayor');
}
function exportarExcelBalance() {
    exportarExcel('Balance de Comprobación',
        _tablaAHeaders('#view-balance .cont-table'),
        _tablaAFilas('#view-balance .cont-table'), 'Balance');
}
function exportarExcelBalanceClasificado() {
    exportarExcel('Balance Clasificado',
        _tablaAHeaders('#view-balance-clasificado .cont-table'),
        _tablaAFilas('#view-balance-clasificado .cont-table'), 'Bal. Clasificado');
}
function exportarExcelEstadoResultados() {
    exportarExcel('Estado de Resultados',
        _tablaAHeaders('#view-estado-resultados .cont-table'),
        _tablaAFilas('#view-estado-resultados .cont-table'), 'Est. Resultados');
}
function exportarExcelFlujoCaja() {
    exportarExcel('Flujo de Caja',
        _tablaAHeaders('#view-flujo-caja .cont-table'),
        _tablaAFilas('#view-flujo-caja .cont-table'), 'Flujo Caja');
}
function exportarExcelCompras() {
    exportarExcel('Libro de Compras',
        _tablaAHeaders('#view-compras .cont-table'),
        _tablaAFilas('#view-compras .cont-table'), 'Compras');
}
function exportarExcelVentas() {
    exportarExcel('Libro de Ventas',
        _tablaAHeaders('#view-ventas .cont-table'),
        _tablaAFilas('#view-ventas .cont-table'), 'Ventas');
}
function exportarExcelContactos() {
    exportarExcel('Contactos',
        _tablaAHeaders('#view-clientes .cont-table'),
        _tablaAFilas('#view-clientes .cont-table'), 'Contactos');
}

// ── Segunda categoría ─────────────────────────────────────────────────────────
function exportarPDFHonorarios()     { exportarPDF('Libro de Honorarios'); }
function exportarPDFLibroIngresos()  { exportarPDF('Libro de Ingresos'); }
function exportarPDFLibroEgresos()   { exportarPDF('Libro de Egresos'); }
function exportarPDFF29()            { exportarPDF('Formulario 29'); }
function exportarPDFF22()            { exportarPDF('Formulario 22'); }
function exportarPDFPrestadores()    { exportarPDF('Prestadores'); }
function exportarPDFDJ1879()         { exportarPDF('DJ 1879'); }

function imprimirHonorarios()    { imprimirReporte('Libro de Honorarios'); }
function imprimirLibroIngresos() { imprimirReporte('Libro de Ingresos'); }
function imprimirLibroEgresos()  { imprimirReporte('Libro de Egresos'); }
function imprimirF29()           { imprimirReporte('Formulario 29'); }
function imprimirF22()           { imprimirReporte('Formulario 22'); }
function imprimirPrestadores()   { imprimirReporte('Prestadores'); }
function imprimirDJ1879()        { imprimirReporte('DJ 1879'); }

function exportarExcelHonorarios() {
    exportarExcel('Libro de Honorarios',
        _tablaAHeaders('#view-libro-honorarios .cont-table'),
        _tablaAFilas('#view-libro-honorarios .cont-table'), 'Honorarios');
}
function exportarExcelLibroIngresos() {
    exportarExcel('Libro de Ingresos',
        _tablaAHeaders('#view-libro-ingresos-hon .cont-table'),
        _tablaAFilas('#view-libro-ingresos-hon .cont-table'), 'Ingresos');
}
function exportarExcelLibroEgresos() {
    exportarExcel('Libro de Egresos',
        _tablaAHeaders('#view-libro-egresos-hon .cont-table'),
        _tablaAFilas('#view-libro-egresos-hon .cont-table'), 'Egresos');
}
function exportarExcelPrestadores() {
    exportarExcel('Prestadores',
        _tablaAHeaders('#view-prestadores .cont-table'),
        _tablaAFilas('#view-prestadores .cont-table'), 'Prestadores');
}
function exportarExcelDJ1879() {
    exportarExcel('DJ 1879',
        _tablaAHeaders('#view-dj1879 .cont-table'),
        _tablaAFilas('#view-dj1879 .cont-table'), 'DJ1879');
}

// ── Adjuntos (solo Electron) ──────────────────────────────────────────────────
async function adjuntarArchivo(onResult) {
    if (!window.electronAPI?.archivo) {
        mostrarToast('Adjuntar archivos solo disponible en la app de escritorio.', 'error');
        return;
    }
    const resultado = await window.electronAPI.archivo.adjuntar();
    if (resultado) onResult(resultado);
}

function abrirAdjunto(ruta) {
    if (!ruta || !window.electronAPI?.archivo) return;
    window.electronAPI.archivo.abrir(ruta).then(err => {
        if (err) mostrarToast('No se pudo abrir el archivo.', 'error');
    });
}

// ── Genéricas (reciben tableId + título) ──────────────────────────────────────
function exportarPDFGenerico(tableId, titulo) {
    exportarPDF(titulo);
}
function exportarExcelGenerico(tableId, titulo) {
    exportarExcel(titulo,
        _tablaAHeaders('#' + tableId),
        _tablaAFilas('#' + tableId), titulo);
}

// ── Expose ────────────────────────────────────────────────────────────────────
window.exportarPDFGenerico           = exportarPDFGenerico;
window.exportarExcelGenerico         = exportarExcelGenerico;
window.exportarPDF                   = exportarPDF;
window.imprimirReporte               = imprimirReporte;
window.exportarExcel                 = exportarExcel;

// Primera categoría
window.exportarPDFMayor              = exportarPDFMayor;
window.exportarPDFBalance            = exportarPDFBalance;
window.exportarPDFBalanceClasificado = exportarPDFBalanceClasificado;
window.exportarPDFEstadoResultados   = exportarPDFEstadoResultados;
window.exportarPDFFlujoCaja          = exportarPDFFlujoCaja;
window.exportarPDFCompras            = exportarPDFCompras;
window.exportarPDFVentas             = exportarPDFVentas;
window.imprimirMayor                 = imprimirMayor;
window.imprimirBalance               = imprimirBalance;
window.imprimirBalanceClasificado    = imprimirBalanceClasificado;
window.imprimirEstadoResultados      = imprimirEstadoResultados;
window.imprimirFlujoCaja             = imprimirFlujoCaja;
window.imprimirCompras               = imprimirCompras;
window.imprimirVentas                = imprimirVentas;
window.exportarExcelMayor            = exportarExcelMayor;
window.exportarExcelBalance          = exportarExcelBalance;
window.exportarExcelBalanceClasificado = exportarExcelBalanceClasificado;
window.exportarExcelEstadoResultados = exportarExcelEstadoResultados;
window.exportarExcelFlujoCaja        = exportarExcelFlujoCaja;
window.exportarExcelCompras          = exportarExcelCompras;
window.exportarExcelVentas           = exportarExcelVentas;
window.exportarExcelContactos        = exportarExcelContactos;

// Segunda categoría
window.exportarPDFHonorarios         = exportarPDFHonorarios;
window.exportarPDFLibroIngresos      = exportarPDFLibroIngresos;
window.exportarPDFLibroEgresos       = exportarPDFLibroEgresos;
window.exportarPDFF29                = exportarPDFF29;
window.exportarPDFF22                = exportarPDFF22;
window.exportarPDFPrestadores        = exportarPDFPrestadores;
window.exportarPDFDJ1879             = exportarPDFDJ1879;
window.imprimirHonorarios            = imprimirHonorarios;
window.imprimirLibroIngresos         = imprimirLibroIngresos;
window.imprimirLibroEgresos          = imprimirLibroEgresos;
window.imprimirF29                   = imprimirF29;
window.imprimirF22                   = imprimirF22;
window.imprimirPrestadores           = imprimirPrestadores;
window.imprimirDJ1879                = imprimirDJ1879;
window.exportarExcelHonorarios       = exportarExcelHonorarios;
window.exportarExcelLibroIngresos    = exportarExcelLibroIngresos;
window.exportarExcelLibroEgresos     = exportarExcelLibroEgresos;
window.exportarExcelPrestadores      = exportarExcelPrestadores;
window.exportarExcelDJ1879           = exportarExcelDJ1879;

window.adjuntarArchivo               = adjuntarArchivo;
window.abrirAdjunto                  = abrirAdjunto;
