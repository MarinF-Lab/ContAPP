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

// Abre un doc de jsPDF (con texto real, no captura) en una pestaña nueva con
// el visor nativo del navegador — el usuario puede revisar, imprimir o
// descargar desde ahí, en vez de forzar la descarga directa. Usado por todos
// los exportarPDFXxx() de "texto real" de este archivo (Diario, Mayor, Balance).
function _abrirPreviewPDF(doc, nombreArchivo) {
    doc.setProperties({ title: nombreArchivo });
    const ventana = window.open(doc.output('bloburl'), '_blank');
    if (!ventana) {
        mostrarToast('El navegador bloqueó la vista previa — permite ventanas emergentes para este sitio.', 'error');
        return false;
    }
    mostrarToast('Vista previa del PDF abierta en una pestaña nueva.', 'ok');
    return true;
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

// Libro Diario — único export con texto real (jsPDF + autoTable) en vez del
// window.print() genérico que usa el resto de exportarPDFXxx() de este
// archivo: ese genérico imprime el DOM en vivo (formulario de "nuevo
// asiento" incluido, botones de editar/anular, etc.), lo que se ve como una
// captura de pantalla mal recortada, no un documento.
function exportarPDFDiario() {
    const asientos = (typeof _asientosDelMesDiario === 'function') ? _asientosDelMesDiario() : [];
    if (!asientos.length) {
        mostrarToast('No hay asientos para exportar en el período seleccionado.', 'error');
        return;
    }

    const ordenados = [...asientos].sort((a, b) =>
        _fechaAsientoOrdenable(a.fecha).localeCompare(_fechaAsientoOrdenable(b.fecha)));

    const body = [];
    // Índice de asiento por fila (paralelo a `body`) — permite que
    // didParseCell distinga dónde termina un asiento y empieza el
    // siguiente, en vez de una tabla plana de números sueltos.
    const grupoPorFila = [];
    let totalDebe = 0, totalHaber = 0;
    ordenados.forEach((as, asIdx) => {
        const anulado = as.estado === 'ANULADO';
        (as.movimientos || []).forEach((m, i) => {
            if (!anulado) { totalDebe += (m.debe || 0); totalHaber += (m.haber || 0); }
            body.push([
                i === 0 ? String(as.numero ?? '') : '',
                i === 0 ? as.fecha : '',
                i === 0 ? (as.glosa || '') + (anulado ? ' (ANULADO)' : '') : '',
                m.cuenta || '',
                m.debe ? fmt(m.debe) : '',
                m.haber ? fmt(m.haber) : '',
            ]);
            grupoPorFila.push(asIdx);
        });
    });
    body.push(['', '', '', 'TOTALES', fmt(totalDebe), fmt(totalHaber)]);

    const cfg     = JSON.parse(localStorage.getItem('core_config') || '{}');
    const empresa = cfg.empresa || 'Mi Empresa';
    const rut     = cfg.rut     || '–';
    const nombreMesTxt = (typeof _nombreMes === 'function') ? _nombreMes(diarioHistMes) : diarioHistMes;

    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text('Libro Diario', 14, 15);
    doc.setFontSize(10);
    doc.text(`${empresa} — RUT: ${rut}`, 14, 21);
    doc.text(`Período: ${nombreMesTxt} ${diarioHistAnio}`, 14, 26);

    doc.autoTable({
        startY: 32,
        head: [['N°', 'Fecha', 'Glosa', 'Cuenta', 'Debe', 'Haber']],
        body,
        // theme:'grid' desactiva el sombreado alterno POR FILA que trae
        // autoTable por defecto (theme 'striped') — ese sombreado no respeta
        // los asientos y se mezclaba con el sombreado por grupo de abajo,
        // dando un resultado sin ningún patrón reconocible.
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [30, 41, 59] },
        columnStyles: {
            0: { cellWidth: 14 }, 1: { cellWidth: 22 },
            4: { halign: 'right', cellWidth: 28 }, 5: { halign: 'right', cellWidth: 28 },
        },
        didParseCell: (data) => {
            const esFilaTotales = data.row.index === body.length - 1;
            if (esFilaTotales) {
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.lineWidth = { top: 0.5, right: 0.1, bottom: 0.1, left: 0.1 };
                return;
            }
            // Sombreado alterno POR ASIENTO (no por fila) — así cada asiento
            // se ve como un bloque propio aunque tenga varias líneas.
            const grupo = grupoPorFila[data.row.index];
            if (grupo % 2 === 1) data.cell.styles.fillColor = [241, 245, 249];
            // Borde superior más marcado al empezar un asiento nuevo — separa
            // visualmente uno del siguiente.
            const grupoAnterior = data.row.index > 0 ? grupoPorFila[data.row.index - 1] : grupo;
            if (grupo !== grupoAnterior) {
                data.cell.styles.lineWidth = { top: 0.4, right: 0.1, bottom: 0.1, left: 0.1 };
                data.cell.styles.lineColor = [100, 116, 139];
            }
        },
    });

    _abrirPreviewPDF(doc, _nombreArchivo(`Libro Diario ${nombreMesTxt} ${diarioHistAnio}`) + '.pdf');
}

// Libro Mayor — mismo formato que exportarPDFDiario(): texto real (jsPDF +
// autoTable), sombreado alterno por CUENTA (no por fila suelta), borde al
// empezar cada cuenta nueva, saldo final en negrita, vista previa en pestaña
// nueva. Reusa _datosMayorFiltrado() (js/services/mayor.js) — mismos filtros
// de cuenta/período que la pantalla.
function exportarPDFMayor() {
    const cuentasFiltradas = (typeof _datosMayorFiltrado === 'function') ? _datosMayorFiltrado() : [];
    if (!cuentasFiltradas.length) {
        mostrarToast('No hay movimientos para exportar con los filtros seleccionados.', 'error');
        return;
    }

    const cfg     = JSON.parse(localStorage.getItem('core_config') || '{}');
    const empresa = cfg.empresa || 'Mi Empresa';
    const rut     = cfg.rut     || '–';
    const periodoTxt = (typeof _mayorFiltrosPeriodo !== 'undefined' && _mayorFiltrosPeriodo) ? _mayorFiltrosPeriodo : 'Todos los períodos';
    const cuentaTxt  = (typeof _mayorFiltrosCuenta !== 'undefined' && _mayorFiltrosCuenta) ? _mayorFiltrosCuenta : 'Todas las cuentas';

    const body = [];
    const grupoPorFila = []; // índice de cuenta por fila
    const filaSaldo = [];    // true en la fila de "Saldo" de cada cuenta (negrita)
    cuentasFiltradas.forEach((c, cIdx) => {
        c.historial.forEach((h, i) => {
            body.push([
                i === 0 ? c.cuenta : '',
                h.numero != null ? String(h.numero) : '—',
                h.fecha || '',
                h.debe ? fmt(h.debe) : '',
                h.haber ? fmt(h.haber) : '',
            ]);
            grupoPorFila.push(cIdx);
            filaSaldo.push(false);
        });
        const naturaleza = c.saldoFinal >= 0 ? 'DEUDOR' : 'ACREEDOR';
        body.push(['', '', `Saldo ${naturaleza}`, '', fmt(Math.abs(c.saldoFinal))]);
        grupoPorFila.push(cIdx);
        filaSaldo.push(true);
    });

    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text('Libro Mayor', 14, 15);
    doc.setFontSize(10);
    doc.text(`${empresa} — RUT: ${rut}`, 14, 21);
    doc.text(`Período: ${periodoTxt}  ·  Cuenta: ${cuentaTxt}`, 14, 26);

    doc.autoTable({
        startY: 32,
        head: [['Cuenta', 'N°', 'Fecha', 'Debe', 'Haber']],
        body,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [30, 41, 59] },
        columnStyles: {
            1: { cellWidth: 16 }, 2: { cellWidth: 24 },
            3: { halign: 'right', cellWidth: 32 }, 4: { halign: 'right', cellWidth: 32 },
        },
        didParseCell: (data) => {
            const grupo = grupoPorFila[data.row.index];
            if (grupo === undefined) return; // fila de encabezado
            if (grupo % 2 === 1) data.cell.styles.fillColor = [241, 245, 249];
            if (filaSaldo[data.row.index]) data.cell.styles.fontStyle = 'bold';
            const grupoAnterior = data.row.index > 0 ? grupoPorFila[data.row.index - 1] : grupo;
            if (grupo !== grupoAnterior) {
                data.cell.styles.lineWidth = { top: 0.4, right: 0.1, bottom: 0.1, left: 0.1 };
                data.cell.styles.lineColor = [100, 116, 139];
            }
        },
    });

    _abrirPreviewPDF(doc, _nombreArchivo('Libro Mayor') + '.pdf');
}

// Balance de Comprobación (8 columnas) — mismo formato de texto real que
// arriba. Reusa _calcularBalance() (js/services/balance.js), ya construida
// esta sesión con datos numéricos puros (misma fuente que exportarExcelBalance()).
function exportarPDFBalance() {
    if (typeof _calcularBalance !== 'function') {
        mostrarToast('No se pudo calcular el balance.', 'error');
        return;
    }
    const { filas, subtotales, resultado, totalesIguales } = _calcularBalance();
    if (!filas.length) {
        mostrarToast('No hay movimientos para exportar.', 'error');
        return;
    }

    const cfg     = JSON.parse(localStorage.getItem('core_config') || '{}');
    const empresa = cfg.empresa || 'Mi Empresa';
    const rut     = cfg.rut     || '–';
    const mesSel  = parseInt(document.getElementById('selBalanceMes')?.value)  || null;
    const anioSel = document.getElementById('selBalanceAnio')?.value || '';
    const periodoTxt = mesSel
        ? `Al fin de ${(typeof _nombreMes === 'function' ? _nombreMes(mesSel) : mesSel)} ${anioSel}`
        : 'Histórico completo';

    // Igual convención que la pantalla/Excel: 0 en blanco, negativo entre
    // paréntesis (las columnas Activo/Pasivo/Pérdida/Ganancia pueden ir
    // negativas en una cuenta con saldo anómalo).
    const fmtColPdf = (v) => {
        if (!v) return '';
        return v < 0 ? `(${fmt(Math.abs(v))})` : fmt(v);
    };

    const body = [];
    const filaAnomalia = [];
    filas.forEach(f => {
        body.push([
            (f.esAnomalio ? '⚠ ' : '') + f.cuenta,
            f.debe ? fmt(f.debe) : '',
            f.haber ? fmt(f.haber) : '',
            f.deudor ? fmt(f.deudor) : '',
            f.acreedor ? fmt(f.acreedor) : '',
            fmtColPdf(f.activo), fmtColPdf(f.pasivo), fmtColPdf(f.perdida), fmtColPdf(f.ganancia),
        ]);
        filaAnomalia.push(!!f.esAnomalio);
    });
    const filaSubtotales = body.length;
    body.push(['SUBTOTALES', fmt(subtotales.debe), fmt(subtotales.haber), fmt(subtotales.deudor), fmt(subtotales.acreedor), fmt(subtotales.activo), fmt(subtotales.pasivo), fmt(subtotales.perdida), fmt(subtotales.ganancia)]);
    body.push(['UTILIDAD / PÉRDIDA DEL EJERCICIO', '', '', '', '', fmt(resultado.activo), fmt(resultado.pasivo), fmt(resultado.perdida), fmt(resultado.ganancia)]);
    body.push(['TOTALES IGUALES', '', '', '', '', fmt(totalesIguales.activo), fmt(totalesIguales.pasivo), fmt(totalesIguales.perdida), fmt(totalesIguales.ganancia)]);

    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text('Balance de Comprobación', 14, 15);
    doc.setFontSize(10);
    doc.text(`${empresa} — RUT: ${rut}`, 14, 21);
    doc.text(periodoTxt, 14, 26);

    doc.autoTable({
        startY: 32,
        head: [['Cuenta', 'Debe', 'Haber', 'Deudor', 'Acreedor', 'Activo', 'Pasivo', 'Pérdida', 'Ganancia']],
        body,
        theme: 'grid',
        styles: { fontSize: 7.5, cellPadding: 2 },
        headStyles: { fillColor: [30, 41, 59] },
        bodyStyles: { halign: 'right' },
        columnStyles: { 0: { cellWidth: 42, halign: 'left' } },
        didParseCell: (data) => {
            const esFilaTotal = data.row.index >= filaSubtotales;
            if (esFilaTotal) {
                data.cell.styles.fontStyle = 'bold';
                if (data.row.index === filaSubtotales) data.cell.styles.lineWidth = { top: 0.5, right: 0.1, bottom: 0.1, left: 0.1 };
                return;
            }
            if (filaAnomalia[data.row.index]) data.cell.styles.textColor = [220, 38, 38];
            if (data.row.index % 2 === 1) data.cell.styles.fillColor = [248, 250, 252];
        },
    });

    _abrirPreviewPDF(doc, _nombreArchivo('Balance de Comprobación') + '.pdf');
}

// Balance Clasificado — mismo formato de texto real. Reusa
// _calcularBalanceClasificado() (js/services/balance-clasificado.js). Las
// dos columnas de pantalla (Activo | Pasivo+Patrimonio) van apiladas en una
// sola tabla continua — un jsPDF/autoTable de dos tablas lado a lado
// requeriría posicionamiento manual por X, no vale la complejidad acá.
function exportarPDFBalanceClasificado() {
    if (typeof _calcularBalanceClasificado !== 'function') {
        mostrarToast('No se pudo calcular el balance clasificado.', 'error');
        return;
    }
    const { mes, anio, secciones, totalActivo, totalPasPat, cuadra, liquidez } = _calcularBalanceClasificado();
    const hayDatos = Object.values(secciones).some(s => s.items.length);
    if (!hayDatos) {
        mostrarToast('No hay movimientos para exportar.', 'error');
        return;
    }

    const cfg     = JSON.parse(localStorage.getItem('core_config') || '{}');
    const empresa = cfg.empresa || 'Mi Empresa';
    const rut     = cfg.rut     || '–';
    const nombreMesTxt = (typeof _nombreMes === 'function') ? _nombreMes(mes) : mes;

    const body = [];
    const rowMeta = [];
    const agregarSeccion = (titulo, seccion) => {
        if (!seccion.items.length) return;
        body.push([titulo, '']);
        rowMeta.push({ tipo: 'header' });
        [...seccion.items]
            .sort((a, b) => (b.esContra ? -1 : Math.abs(b.saldo)) - (a.esContra ? -1 : Math.abs(a.saldo)))
            .forEach(it => {
                const esContra = !!it.esContra, esAnom = !!it.esAnomalio;
                const prefijo = esContra ? '(-) ' : (esAnom ? '⚠ ' : '');
                const montoStr = (esAnom && !esContra) ? `(${fmt(Math.abs(it.saldo))})` : `$${fmt(Math.abs(it.saldo))}`;
                body.push([`   ${prefijo}${it.nombre}`, montoStr]);
                rowMeta.push({ tipo: 'item', color: (esContra || esAnom) ? [220, 38, 38] : null, italic: esContra });
            });
        body.push([`Total ${titulo}`, `$${fmt(seccion.total)}`]);
        rowMeta.push({ tipo: 'subtotal' });
    };

    agregarSeccion('Activo Circulante',    secciones['Activo Circulante']);
    agregarSeccion('Activo No Circulante', secciones['Activo No Circulante']);
    body.push(['TOTAL ACTIVO', `$${fmt(totalActivo)}`]);
    rowMeta.push({ tipo: 'total' });

    agregarSeccion('Pasivo Circulante',    secciones['Pasivo Circulante']);
    agregarSeccion('Pasivo No Circulante', secciones['Pasivo No Circulante']);
    agregarSeccion('Patrimonio',           secciones['Patrimonio']);
    body.push(['TOTAL PASIVO + PATRIMONIO', `$${fmt(totalPasPat)}`]);
    rowMeta.push({ tipo: 'total' });

    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text('Balance Clasificado', 14, 15);
    doc.setFontSize(10);
    doc.text(`${empresa} — RUT: ${rut}`, 14, 21);
    doc.text(`Al fin de ${nombreMesTxt} ${anio}`, 14, 26);
    doc.text(
        `${cuadra ? 'Cuadrado' : 'Descuadrado'} — Activo $${fmt(totalActivo)} · Pasivo+Patrimonio $${fmt(totalPasPat)}`,
        14, 31
    );

    doc.autoTable({
        startY: 37,
        head: [['Cuenta', 'Monto']],
        body,
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 2.5 },
        headStyles: { fillColor: [30, 41, 59] },
        columnStyles: { 1: { halign: 'right', cellWidth: 40 } },
        didParseCell: (data) => {
            const meta = rowMeta[data.row.index];
            if (!meta) return;
            if (meta.tipo === 'header') {
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.fillColor = [226, 232, 240];
            } else if (meta.tipo === 'subtotal') {
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.fillColor = [248, 250, 252];
            } else if (meta.tipo === 'total') {
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.fillColor = [30, 41, 59];
                data.cell.styles.textColor = 255;
            }
            if (meta.color) data.cell.styles.textColor = meta.color;
            if (meta.italic) data.cell.styles.fontStyle = 'italic';
        },
    });

    // Indicadores de liquidez debajo de la tabla
    const finalY = doc.lastAutoTable.finalY + 8;
    doc.setFontSize(10);
    doc.text('Indicadores de liquidez', 14, finalY);
    doc.setFontSize(9);
    const { razonCorriente, pruebaAcida, capitalTrabajo } = liquidez;
    doc.text(`Razón corriente: ${razonCorriente !== null ? razonCorriente.toFixed(2) : '—'}`, 14, finalY + 6);
    doc.text(`Prueba ácida: ${pruebaAcida !== null ? pruebaAcida.toFixed(2) : '—'}`, 14, finalY + 12);
    doc.text(`Capital de trabajo: $${fmt(capitalTrabajo)}`, 14, finalY + 18);

    _abrirPreviewPDF(doc, _nombreArchivo('Balance Clasificado') + '.pdf');
}

// Estado de Resultados — mismo formato de texto real. Reusa
// _calcularEstadoResultados() (js/services/estado-resultados.js) para los 4
// niveles de utilidad; la tasa de impuesto se lee del mismo selector que la
// pantalla (#erTasaImpuesto) para quedar sincronizados.
function exportarPDFEstadoResultados() {
    if (typeof _calcularEstadoResultados !== 'function') {
        mostrarToast('No se pudo calcular el estado de resultados.', 'error');
        return;
    }
    const mes  = parseInt(document.getElementById('selErMes')?.value)  || 0;
    const anio = parseInt(document.getElementById('selErAnio')?.value) || new Date().getFullYear();
    const {
        ingresos, costoVentas, gastosOp, gastosFin,
        totIngresos, totCosto, utilBruta, totGastosOp, utilOp, totGastosFin, utilAntesImp,
    } = _calcularEstadoResultados(mes, anio);

    const tasa     = parseFloat(document.getElementById('erTasaImpuesto')?.value || '0.27');
    const impuesto = utilAntesImp > 0 ? Math.round(utilAntesImp * tasa) : 0;
    const utilNeta = utilAntesImp - impuesto;

    const cfg     = JSON.parse(localStorage.getItem('core_config') || '{}');
    const empresa = cfg.empresa || 'Mi Empresa';
    const rut     = cfg.rut     || '–';
    const nombreMesTxt = (typeof _nombreMes === 'function') ? _nombreMes(mes) : mes;
    const periodoTxt = mes ? `${nombreMesTxt} ${anio}` : `Año completo ${anio}`;

    const body = [];
    const rowMeta = [];
    const filaTitulo = (t) => { body.push([t, '']); rowMeta.push({ tipo: 'titulo' }); };
    const filaItem = (nombre, monto) => {
        body.push([`   ${nombre}`, `$${fmt(Math.abs(monto))}`]);
        rowMeta.push({ tipo: 'item', neg: monto < 0 });
    };
    const filaTotal = (texto, monto, destacado) => {
        body.push([texto, `${destacado ? (monto >= 0 ? '+' : '-') : ''}$${fmt(Math.abs(monto))}`]);
        rowMeta.push({ tipo: destacado ? 'totalFinal' : 'total', neg: monto < 0 });
    };

    filaTitulo('Ingresos Operacionales');
    ingresos.forEach(x => filaItem(x.nombre, x.monto));
    filaTotal('Total Ingresos', totIngresos);

    if (costoVentas.length) {
        filaTitulo('Costo de Ventas');
        costoVentas.forEach(x => filaItem(x.nombre, -x.monto));
        filaTotal('Total Costo de Ventas', -totCosto);
    }
    filaTotal('UTILIDAD BRUTA', utilBruta, true);

    filaTitulo('Gastos Operacionales');
    if (gastosOp.length) gastosOp.forEach(x => filaItem(x.nombre, -x.monto));
    else { body.push(['   Sin gastos operacionales registrados', '']); rowMeta.push({ tipo: 'vacio' }); }
    filaTotal('Total Gastos Operacionales', -totGastosOp);
    filaTotal('UTILIDAD OPERACIONAL', utilOp, true);

    if (gastosFin.length) {
        filaTitulo('Gastos Financieros');
        gastosFin.forEach(x => filaItem(x.nombre, -x.monto));
        filaTotal('Total Gastos Financieros', -totGastosFin);
    }
    filaTotal('UTILIDAD ANTES DE IMPUESTO', utilAntesImp, true);

    if (tasa > 0) {
        filaTitulo(`Impuesto a la Renta (${Math.round(tasa * 100)}%)`);
        filaItem('Impuesto a la Renta', -impuesto);
    }
    filaTotal('UTILIDAD NETA DEL EJERCICIO', utilNeta, true);

    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text('Estado de Resultados', 14, 15);
    doc.setFontSize(10);
    doc.text(`${empresa} — RUT: ${rut}`, 14, 21);
    doc.text(`Período: ${periodoTxt}`, 14, 26);

    doc.autoTable({
        startY: 32,
        head: [['Concepto', 'Monto']],
        body,
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 2.5 },
        headStyles: { fillColor: [30, 41, 59] },
        columnStyles: { 1: { halign: 'right', cellWidth: 40 } },
        didParseCell: (data) => {
            const meta = rowMeta[data.row.index];
            if (!meta) return;
            if (meta.tipo === 'titulo') {
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.fillColor = [226, 232, 240];
            } else if (meta.tipo === 'total') {
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.fillColor = [248, 250, 252];
                if (meta.neg) data.cell.styles.textColor = [220, 38, 38];
            } else if (meta.tipo === 'totalFinal') {
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.fillColor = [30, 41, 59];
                data.cell.styles.textColor = meta.neg ? [252, 165, 165] : 255;
            } else if (meta.tipo === 'item' && meta.neg) {
                data.cell.styles.textColor = [220, 38, 38];
            } else if (meta.tipo === 'vacio') {
                data.cell.styles.textColor = [148, 163, 184];
                data.cell.styles.fontStyle = 'italic';
            }
        },
    });

    _abrirPreviewPDF(doc, _nombreArchivo(`Estado de Resultados ${periodoTxt}`) + '.pdf');
}

// Flujo de Caja — mismo formato de texto real. Reusa _calcularFlujoCaja()
// (js/services/flujo-caja.js). La tabla lista el mismo detalle que la
// pantalla (el gráfico de 12 meses no se replica en el PDF, es visual/canvas,
// no datos tabulares).
function exportarPDFFlujoCaja() {
    if (typeof _calcularFlujoCaja !== 'function') {
        mostrarToast('No se pudo calcular el flujo de caja.', 'error');
        return;
    }
    const anio = parseInt(document.getElementById('selFlujoCajaAnio')?.value) || new Date().getFullYear();
    const mes  = parseInt(document.getElementById('selFlujoCajaMes')?.value)  || 0;
    const { secciones, totEntradas, totSalidas } = _calcularFlujoCaja(mes, anio);

    const hayDatos = Object.values(secciones).some(s => s.lineas.length);
    if (!hayDatos) {
        mostrarToast('No hay movimientos de efectivo para exportar.', 'error');
        return;
    }

    const cfg     = JSON.parse(localStorage.getItem('core_config') || '{}');
    const empresa = cfg.empresa || 'Mi Empresa';
    const rut     = cfg.rut     || '–';
    const periodoTxt = mes ? `${(typeof _nombreMes === 'function' ? _nombreMes(mes) : mes)} ${anio}` : `Año ${anio}`;

    const body = [];
    const rowMeta = [];
    Object.values(secciones).forEach(sec => {
        body.push([`${sec.icon} ${sec.label}`, '', '', '', '']);
        rowMeta.push({ tipo: 'seccionHeader' });
        if (!sec.lineas.length) {
            body.push(['', 'Sin movimientos', '', '', '']);
            rowMeta.push({ tipo: 'vacio' });
        } else {
            sec.lineas.forEach(l => {
                body.push([
                    l.fecha,
                    l.glosa + (l.contacto ? ` (${l.contacto})` : ''),
                    l.entrada > 0 ? fmt(l.entrada) : '',
                    l.salida  > 0 ? fmt(l.salida)  : '',
                    `${l.neto >= 0 ? '+' : '-'}$${fmt(Math.abs(l.neto))}`,
                ]);
                rowMeta.push({ tipo: 'item', neg: l.neto < 0 });
            });
        }
        body.push(['', `Subtotal ${sec.label}`, '', '', `${sec.total >= 0 ? '+' : '-'}$${fmt(Math.abs(sec.total))}`]);
        rowMeta.push({ tipo: 'subtotal', neg: sec.total < 0 });
    });

    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text('Flujo de Caja', 14, 15);
    doc.setFontSize(10);
    doc.text(`${empresa} — RUT: ${rut}`, 14, 21);
    doc.text(`Período: ${periodoTxt}  ·  Entradas $${fmt(totEntradas)}  ·  Salidas $${fmt(totSalidas)}  ·  Neto ${(totEntradas - totSalidas) >= 0 ? '+' : '-'}$${fmt(Math.abs(totEntradas - totSalidas))}`, 14, 26);

    doc.autoTable({
        startY: 32,
        head: [['Fecha', 'Glosa', 'Entrada', 'Salida', 'Neto']],
        body,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [30, 41, 59] },
        columnStyles: {
            0: { cellWidth: 24 },
            2: { halign: 'right', cellWidth: 30 }, 3: { halign: 'right', cellWidth: 30 }, 4: { halign: 'right', cellWidth: 30 },
        },
        didParseCell: (data) => {
            const meta = rowMeta[data.row.index];
            if (!meta) return;
            if (meta.tipo === 'seccionHeader') {
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.fillColor = [226, 232, 240];
            } else if (meta.tipo === 'subtotal') {
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.fillColor = [248, 250, 252];
                if (meta.neg) data.cell.styles.textColor = [220, 38, 38];
            } else if (meta.tipo === 'vacio') {
                data.cell.styles.textColor = [148, 163, 184];
                data.cell.styles.fontStyle = 'italic';
            } else if (meta.tipo === 'item' && meta.neg) {
                data.cell.styles.textColor = [220, 38, 38];
            }
        },
    });

    _abrirPreviewPDF(doc, _nombreArchivo(`Flujo de Caja ${periodoTxt}`) + '.pdf');
}

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
// Export dedicado (no pasa por el exportarExcel() genérico de arriba, que
// solo scrapea texto ya formateado del DOM): usa _calcularBalance()
// (js/services/balance.js) para tener los montos como NÚMEROS reales, no
// como strings "$1.234.567" leídos de la pantalla. Así Excel los alinea a
// la derecha, los puede sumar, y se les puede aplicar un formato de número
// con separador de miles y negativos en rojo — el resultado se ve mucho más
// parecido a la tabla real de la app, aunque SheetJS Community (la versión
// gratuita que usa este proyecto) no permite escribir colores de fondo ni
// negrita en las celdas (eso es exclusivo de SheetJS Pro, de pago).
async function exportarExcelBalance() {
    // No se delega a window.electronAPI.excel: en Electron real ese puente
    // lo pone preload.js, pero en web/PWA (el contexto real en el que corre
    // esta app) js/web-adapter.js define el MISMO electronAPI.excel como
    // shim — y por dentro usa el mismo aoa_to_sheet sin números reales ni
    // formato que este export justamente reemplaza. Se genera siempre acá
    // directo con SheetJS para que el formato realmente se aplique.
    if (typeof XLSX === 'undefined') {
        mostrarToast('SheetJS no disponible.', 'error');
        return;
    }
    if (typeof _calcularBalance !== 'function') {
        mostrarToast('No se pudo calcular el balance.', 'error');
        return;
    }

    const { filas, subtotales, resultado, totalesIguales } = _calcularBalance();
    if (!filas.length) {
        mostrarToast('No hay movimientos para exportar.', 'error');
        return;
    }

    const HEADERS = ['CUENTA', 'DEBE', 'HABER', 'DEUDOR', 'ACREEDOR', 'ACTIVO', 'PASIVO', 'PÉRDIDA', 'GANANCIA'];
    const enc     = _getEncabezadoExcel('Balance de Comprobación');

    const datos = enc.map(linea => [linea]);
    datos.push(new Array(HEADERS.length).fill(''));
    const filaEncabezado = datos.length;
    datos.push(HEADERS);

    const filasNumericas = []; // índices de fila (0-based) con celdas de monto
    filas.forEach(f => {
        filasNumericas.push(datos.length);
        datos.push([f.cuenta, f.debe, f.haber, f.deudor, f.acreedor, f.activo, f.pasivo, f.perdida, f.ganancia]);
    });

    filasNumericas.push(datos.length);
    datos.push(['SUBTOTALES', subtotales.debe, subtotales.haber, subtotales.deudor, subtotales.acreedor, subtotales.activo, subtotales.pasivo, subtotales.perdida, subtotales.ganancia]);

    filasNumericas.push(datos.length);
    datos.push(['UTILIDAD / PÉRDIDA DEL EJERCICIO', '', '', '', '', resultado.activo, resultado.pasivo, resultado.perdida, resultado.ganancia]);

    filasNumericas.push(datos.length);
    datos.push(['TOTALES IGUALES', '', '', '', '', totalesIguales.activo, totalesIguales.pasivo, totalesIguales.perdida, totalesIguales.ganancia]);

    const ws = XLSX.utils.aoa_to_sheet(datos);

    // Mismo criterio visual que la pantalla: miles con punto, negativos en
    // rojo entre paréntesis, cero como "-" — todo vía formato de número
    // (cell.z), que SheetJS Community sí escribe (a diferencia del color de
    // fondo/negrita de celda, que es Pro-only).
    const FORMATO_MONTO = '#,##0;[Red](#,##0);"-"';
    filasNumericas.forEach(r => {
        for (let c = 1; c < HEADERS.length; c++) {
            const cell = ws[XLSX.utils.encode_cell({ r, c })];
            if (cell && cell.t === 'n') cell.z = FORMATO_MONTO;
        }
    });

    // Encabezado de empresa fusionado a lo ancho de toda la tabla.
    ws['!merges'] = enc.map((_, i) => ({ s: { r: i, c: 0 }, e: { r: i, c: HEADERS.length - 1 } }));

    // Cuenta más ancha que las columnas de monto.
    ws['!cols'] = [{ wch: 34 }, ...HEADERS.slice(1).map(() => ({ wch: 14 }))];

    // Encabezado de columnas fijo al scrollear.
    ws['!freeze'] = { xSplit: 0, ySplit: filaEncabezado + 1, topLeftCell: 'A' + (filaEncabezado + 2), activePane: 'bottomLeft', state: 'frozen' };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Balance');
    XLSX.writeFile(wb, _nombreArchivo('Balance de Comprobación') + '.xlsx');
    mostrarToast('Excel descargado.', 'ok');
}
// Las 3 funciones de abajo (Balance Clasificado/Estado de Resultados/Flujo de
// Caja) estaban rotas: escaneaban `#view-xxx .cont-table`, pero esas 3 vistas
// son <div> huérfanos vacíos — el contenido real vive en otro contenedor
// (`#balanceClasificadoCont`/`#estadoResultadosCont`/`#tbodyFlujoCaja`) con
// divs propios, no una `<table class="cont-table">`, así que el Excel salía
// vacío o sin datos. Reescritas con datos reales (mismas funciones de
// cómputo puro que ya alimentan los PDF de arriba) en vez de DOM-scraping.
function exportarExcelBalanceClasificado() {
    if (typeof XLSX === 'undefined') { mostrarToast('SheetJS no disponible.', 'error'); return; }
    if (typeof _calcularBalanceClasificado !== 'function') { mostrarToast('No se pudo calcular el balance clasificado.', 'error'); return; }

    const { mes, anio, secciones, totalActivo, totalPasPat, cuadra, liquidez } = _calcularBalanceClasificado();
    if (!Object.values(secciones).some(s => s.items.length)) {
        mostrarToast('No hay movimientos para exportar.', 'error');
        return;
    }

    const nombreMesTxt = (typeof _nombreMes === 'function') ? _nombreMes(mes) : mes;
    const HEADERS = ['CUENTA', 'MONTO'];
    const enc = _getEncabezadoExcel('Balance Clasificado').concat([`Al fin de ${nombreMesTxt} ${anio}`]);

    const datos = enc.map(l => [l]);
    datos.push(new Array(HEADERS.length).fill(''));
    const filaEncabezado = datos.length;
    datos.push(HEADERS);

    const filasNumericas = [];
    const agregarSeccion = (titulo, seccion) => {
        if (!seccion.items.length) return;
        datos.push([titulo, '']);
        [...seccion.items]
            .sort((a, b) => (b.esContra ? -1 : Math.abs(b.saldo)) - (a.esContra ? -1 : Math.abs(a.saldo)))
            .forEach(it => {
                filasNumericas.push(datos.length);
                const prefijo = it.esContra ? '(-) ' : (it.esAnomalio ? '⚠ ' : '');
                datos.push([`  ${prefijo}${it.nombre}`, it.saldo]);
            });
        filasNumericas.push(datos.length);
        datos.push([`Total ${titulo}`, seccion.total]);
    };

    agregarSeccion('Activo Circulante',    secciones['Activo Circulante']);
    agregarSeccion('Activo No Circulante', secciones['Activo No Circulante']);
    filasNumericas.push(datos.length);
    datos.push(['TOTAL ACTIVO', totalActivo]);

    agregarSeccion('Pasivo Circulante',    secciones['Pasivo Circulante']);
    agregarSeccion('Pasivo No Circulante', secciones['Pasivo No Circulante']);
    agregarSeccion('Patrimonio',           secciones['Patrimonio']);
    filasNumericas.push(datos.length);
    datos.push(['TOTAL PASIVO + PATRIMONIO', totalPasPat]);

    datos.push(['', '']);
    datos.push([cuadra ? 'CUADRADO' : 'DESCUADRADO', '']);
    datos.push(['Razón corriente', liquidez.razonCorriente !== null ? liquidez.razonCorriente.toFixed(2) : '—']);
    datos.push(['Prueba ácida', liquidez.pruebaAcida !== null ? liquidez.pruebaAcida.toFixed(2) : '—']);
    filasNumericas.push(datos.length);
    datos.push(['Capital de trabajo', liquidez.capitalTrabajo]);

    const ws = XLSX.utils.aoa_to_sheet(datos);
    const FORMATO_MONTO = '#,##0;[Red](#,##0);"-"';
    filasNumericas.forEach(r => {
        const cell = ws[XLSX.utils.encode_cell({ r, c: 1 })];
        if (cell && cell.t === 'n') cell.z = FORMATO_MONTO;
    });
    ws['!merges'] = enc.map((_, i) => ({ s: { r: i, c: 0 }, e: { r: i, c: HEADERS.length - 1 } }));
    ws['!cols'] = [{ wch: 34 }, { wch: 16 }];
    ws['!freeze'] = { xSplit: 0, ySplit: filaEncabezado + 1, topLeftCell: 'A' + (filaEncabezado + 2), activePane: 'bottomLeft', state: 'frozen' };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bal. Clasificado');
    XLSX.writeFile(wb, _nombreArchivo('Balance Clasificado') + '.xlsx');
    mostrarToast('Excel descargado.', 'ok');
}

function exportarExcelEstadoResultados() {
    if (typeof XLSX === 'undefined') { mostrarToast('SheetJS no disponible.', 'error'); return; }
    if (typeof _calcularEstadoResultados !== 'function') { mostrarToast('No se pudo calcular el estado de resultados.', 'error'); return; }

    const mes  = parseInt(document.getElementById('selErMes')?.value)  || 0;
    const anio = parseInt(document.getElementById('selErAnio')?.value) || new Date().getFullYear();
    const {
        ingresos, costoVentas, gastosOp, gastosFin,
        totIngresos, totCosto, utilBruta, totGastosOp, utilOp, totGastosFin, utilAntesImp,
    } = _calcularEstadoResultados(mes, anio);
    const tasa     = parseFloat(document.getElementById('erTasaImpuesto')?.value || '0.27');
    const impuesto = utilAntesImp > 0 ? Math.round(utilAntesImp * tasa) : 0;
    const utilNeta = utilAntesImp - impuesto;
    const periodoTxt = mes ? `${(typeof _nombreMes === 'function' ? _nombreMes(mes) : mes)} ${anio}` : `Año completo ${anio}`;

    const HEADERS = ['CONCEPTO', 'MONTO'];
    const enc = _getEncabezadoExcel('Estado de Resultados').concat([`Período: ${periodoTxt}`]);

    const datos = enc.map(l => [l]);
    datos.push(new Array(HEADERS.length).fill(''));
    const filaEncabezado = datos.length;
    datos.push(HEADERS);

    const filasNumericas = [];
    const item = (nombre, monto) => { filasNumericas.push(datos.length); datos.push([`  ${nombre}`, monto]); };
    const total = (texto, monto) => { filasNumericas.push(datos.length); datos.push([texto, monto]); };

    datos.push(['Ingresos Operacionales', '']);
    ingresos.forEach(x => item(x.nombre, x.monto));
    total('Total Ingresos', totIngresos);

    if (costoVentas.length) {
        datos.push(['Costo de Ventas', '']);
        costoVentas.forEach(x => item(x.nombre, -x.monto));
        total('Total Costo de Ventas', -totCosto);
    }
    total('UTILIDAD BRUTA', utilBruta);

    datos.push(['Gastos Operacionales', '']);
    gastosOp.forEach(x => item(x.nombre, -x.monto));
    total('Total Gastos Operacionales', -totGastosOp);
    total('UTILIDAD OPERACIONAL', utilOp);

    if (gastosFin.length) {
        datos.push(['Gastos Financieros', '']);
        gastosFin.forEach(x => item(x.nombre, -x.monto));
        total('Total Gastos Financieros', -totGastosFin);
    }
    total('UTILIDAD ANTES DE IMPUESTO', utilAntesImp);

    if (tasa > 0) {
        datos.push([`Impuesto a la Renta (${Math.round(tasa * 100)}%)`, '']);
        item('Impuesto a la Renta', -impuesto);
    }
    total('UTILIDAD NETA DEL EJERCICIO', utilNeta);

    const ws = XLSX.utils.aoa_to_sheet(datos);
    const FORMATO_MONTO = '#,##0;[Red](#,##0);"-"';
    filasNumericas.forEach(r => {
        const cell = ws[XLSX.utils.encode_cell({ r, c: 1 })];
        if (cell && cell.t === 'n') cell.z = FORMATO_MONTO;
    });
    ws['!merges'] = enc.map((_, i) => ({ s: { r: i, c: 0 }, e: { r: i, c: HEADERS.length - 1 } }));
    ws['!cols'] = [{ wch: 34 }, { wch: 16 }];
    ws['!freeze'] = { xSplit: 0, ySplit: filaEncabezado + 1, topLeftCell: 'A' + (filaEncabezado + 2), activePane: 'bottomLeft', state: 'frozen' };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Est. Resultados');
    XLSX.writeFile(wb, _nombreArchivo('Estado de Resultados') + '.xlsx');
    mostrarToast('Excel descargado.', 'ok');
}

function exportarExcelFlujoCaja() {
    if (typeof XLSX === 'undefined') { mostrarToast('SheetJS no disponible.', 'error'); return; }
    if (typeof _calcularFlujoCaja !== 'function') { mostrarToast('No se pudo calcular el flujo de caja.', 'error'); return; }

    const anio = parseInt(document.getElementById('selFlujoCajaAnio')?.value) || new Date().getFullYear();
    const mes  = parseInt(document.getElementById('selFlujoCajaMes')?.value)  || 0;
    const { secciones, totEntradas, totSalidas } = _calcularFlujoCaja(mes, anio);
    if (!Object.values(secciones).some(s => s.lineas.length)) {
        mostrarToast('No hay movimientos de efectivo para exportar.', 'error');
        return;
    }
    const periodoTxt = mes ? `${(typeof _nombreMes === 'function' ? _nombreMes(mes) : mes)} ${anio}` : `Año ${anio}`;

    const HEADERS = ['FECHA', 'GLOSA', 'ENTRADA', 'SALIDA', 'NETO'];
    const enc = _getEncabezadoExcel('Flujo de Caja').concat([`Período: ${periodoTxt}`]);

    const datos = enc.map(l => [l]);
    datos.push(new Array(HEADERS.length).fill(''));
    const filaEncabezado = datos.length;
    datos.push(HEADERS);

    const filasNumericas = [];
    Object.values(secciones).forEach(sec => {
        datos.push([`${sec.icon} ${sec.label}`, '', '', '', '']);
        sec.lineas.forEach(l => {
            filasNumericas.push(datos.length);
            datos.push([l.fecha, l.glosa + (l.contacto ? ` (${l.contacto})` : ''), l.entrada || '', l.salida || '', l.neto]);
        });
        filasNumericas.push(datos.length);
        datos.push(['', `Subtotal ${sec.label}`, '', '', sec.total]);
    });
    filasNumericas.push(datos.length);
    datos.push(['', 'TOTAL NETO', totEntradas, totSalidas, totEntradas - totSalidas]);

    const ws = XLSX.utils.aoa_to_sheet(datos);
    const FORMATO_MONTO = '#,##0;[Red](#,##0);"-"';
    filasNumericas.forEach(r => {
        [2, 3, 4].forEach(c => {
            const cell = ws[XLSX.utils.encode_cell({ r, c })];
            if (cell && cell.t === 'n') cell.z = FORMATO_MONTO;
        });
    });
    ws['!merges'] = enc.map((_, i) => ({ s: { r: i, c: 0 }, e: { r: i, c: HEADERS.length - 1 } }));
    ws['!cols'] = [{ wch: 12 }, { wch: 34 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
    ws['!freeze'] = { xSplit: 0, ySplit: filaEncabezado + 1, topLeftCell: 'A' + (filaEncabezado + 2), activePane: 'bottomLeft', state: 'frozen' };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Flujo Caja');
    XLSX.writeFile(wb, _nombreArchivo('Flujo de Caja') + '.xlsx');
    mostrarToast('Excel descargado.', 'ok');
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
window.exportarPDFDiario             = exportarPDFDiario;
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
