'use strict';
// ─────────────────────────────────────────────────────────────────────────────
//  PARSER XML SII — DTE y EnvioDTE (Chile)
//  Tipos soportados: 33, 34, 39, 41, 52, 56, 61, 110, 111, 112
//  Genera filas listas para insertar en compras.js o ventas.js
// ─────────────────────────────────────────────────────────────────────────────

// ── Tipos de documento ────────────────────────────────────────────────────────
const SII_TIPOS = {
    33:  { nombre: 'Factura electrónica',           libro: 'compras' },
    34:  { nombre: 'Factura no afecta electrónica', libro: 'compras' },
    39:  { nombre: 'Boleta electrónica',             libro: 'ventas'  },
    41:  { nombre: 'Boleta no afecta electrónica',  libro: 'ventas'  },
    52:  { nombre: 'Guía de despacho',               libro: null      },
    56:  { nombre: 'Nota de débito',                 libro: 'compras' },
    61:  { nombre: 'Nota de crédito',                libro: 'compras' },
    110: { nombre: 'Factura de exportación',         libro: 'compras' },
    111: { nombre: 'Nota de débito exportación',     libro: 'compras' },
    112: { nombre: 'Nota de crédito exportación',    libro: 'compras' },
};

// ── Entrada principal ─────────────────────────────────────────────────────────

/**
 * Procesa uno o más archivos XML SII.
 * Devuelve { compras: [], ventas: [], errores: [] }
 */
async function siiProcesarArchivos(files) {
    const resultado = { compras: [], ventas: [], errores: [] };

    for (const file of files) {
        try {
            const texto = await file.text();
            const docs  = siiParsearXML(texto);
            for (const doc of docs) {
                if (doc.error) { resultado.errores.push({ archivo: file.name, error: doc.error }); continue; }
                if (doc.libro === 'compras') resultado.compras.push(doc);
                else if (doc.libro === 'ventas') resultado.ventas.push(doc);
                // null (guía de despacho) se ignora
            }
        } catch (e) {
            resultado.errores.push({ archivo: file.name, error: e.message });
        }
    }

    return resultado;
}

/**
 * Parsea un string XML (DTE o EnvioDTE) y retorna array de documentos normalizados.
 */
function siiParsearXML(xmlStr) {
    const parser = new DOMParser();
    const xml    = parser.parseFromString(xmlStr, 'application/xml');

    const parseErr = xml.querySelector('parsererror');
    if (parseErr) return [{ error: 'XML inválido: ' + parseErr.textContent.slice(0, 120) }];

    // EnvioDTE contiene múltiples DTE
    const dtes = xml.querySelectorAll('DTE');
    if (!dtes.length) return [{ error: 'No se encontraron documentos DTE en el archivo.' }];

    return Array.from(dtes).map(_siiExtraerDTE);
}

// ── Extracción de un DTE ──────────────────────────────────────────────────────

function _siiExtraerDTE(dte) {
    try {
        const enc     = dte.querySelector('Encabezado');
        if (!enc) return { error: 'DTE sin encabezado.' };

        const idDoc   = enc.querySelector('IdDoc');
        const emisor  = enc.querySelector('Emisor');
        const recep   = enc.querySelector('Receptor');
        const totales = enc.querySelector('Totales');

        const tipoDTE = parseInt(_siiVal(idDoc, 'TipoDTE'));
        const folio   = _siiVal(idDoc, 'Folio');
        const fecha   = _siiFecha(_siiVal(idDoc, 'FchEmis'));

        const info    = SII_TIPOS[tipoDTE];
        if (!info) return { error: `Tipo DTE ${tipoDTE} no soportado.` };

        // Montos
        const neto    = _siiNum(totales, 'MntNeto');
        const iva     = _siiNum(totales, 'IVA');
        const exento  = _siiNum(totales, 'MntExe');
        const total   = _siiNum(totales, 'MntTotal') || (neto + iva + exento);

        // Notas de crédito: invertir signo
        const esNC    = tipoDTE === 61 || tipoDTE === 112;
        const factor  = esNC ? -1 : 1;

        const doc = {
            libro:       info.libro,
            tipoDTE,
            tipoNombre:  info.nombre,
            folio,
            fecha,

            // Emisor (proveedor en compras, nosotros en ventas)
            rutEmisor:   _siiVal(emisor, 'RUTEmisor'),
            razEmisor:   _siiVal(emisor, 'RznSoc') || _siiVal(emisor, 'RznSocEmisor'),

            // Receptor
            rutRecep:    _siiVal(recep,  'RUTRecep'),
            razRecep:    _siiVal(recep,  'RznSocRecep'),

            // Montos (enteros CLP)
            neto:        Math.round(neto   * factor),
            iva:         Math.round(iva    * factor),
            exento:      Math.round(exento * factor),
            total:       Math.round(total  * factor),

            // Detalle de líneas (opcional, para referencia)
            lineas:      _siiLineas(dte),

            // Referencia a documentos relacionados
            referencias: _siiReferencias(dte),
        };

        // Glosa automática
        doc.glosa = _siiGlosa(doc);

        return doc;
    } catch (e) {
        return { error: 'Error parseando DTE: ' + e.message };
    }
}

// ── Helpers de extracción ─────────────────────────────────────────────────────

function _siiVal(nodo, tag) {
    if (!nodo) return '';
    const el = nodo.querySelector(tag);
    return el ? el.textContent.trim() : '';
}

function _siiNum(nodo, tag) {
    const v = parseFloat(_siiVal(nodo, tag));
    return isNaN(v) ? 0 : v;
}

function _siiFecha(raw) {
    // YYYY-MM-DD → DD/MM/YYYY
    if (!raw) return '';
    const p = raw.split('-');
    if (p.length === 3) return `${p[2].padStart(2,'0')}/${p[1].padStart(2,'0')}/${p[0]}`;
    return raw;
}

function _siiLineas(dte) {
    const lineas = [];
    dte.querySelectorAll('Detalle').forEach(d => {
        lineas.push({
            nroLinea: _siiVal(d, 'NroLinDet'),
            nombre:   _siiVal(d, 'NmbItem'),
            cant:     parseFloat(_siiVal(d, 'QtyItem'))  || 1,
            precio:   parseFloat(_siiVal(d, 'PrcItem'))  || 0,
            descuento:parseFloat(_siiVal(d, 'DescuentoPct')) || 0,
            monto:    parseFloat(_siiVal(d, 'MontoItem')) || 0,
        });
    });
    return lineas;
}

function _siiReferencias(dte) {
    const refs = [];
    dte.querySelectorAll('Referencia').forEach(r => {
        refs.push({
            tipo:  _siiVal(r, 'TpoDocRef'),
            folio: _siiVal(r, 'FolioRef'),
            fecha: _siiFecha(_siiVal(r, 'FchRef')),
            razon: _siiVal(r, 'RazonRef'),
        });
    });
    return refs;
}

function _siiGlosa(doc) {
    const contraparte = doc.libro === 'compras' ? doc.razEmisor : doc.razRecep;
    const rut         = doc.libro === 'compras' ? doc.rutEmisor : doc.rutRecep;
    return `${doc.tipoNombre} N°${doc.folio} — ${contraparte || rut}`;
}

// ── Conversión a filas de compras/ventas ──────────────────────────────────────

/**
 * Convierte documento SII normalizado a una fila de libro de compras.
 * Estructura compatible con lo que guarda compras.js
 */
function siiDocACompra(doc) {
    return {
        fecha:      doc.fecha,
        tipo:       doc.tipoNombre,
        folio:      doc.folio,
        rut:        doc.rutEmisor,
        razon:      doc.razEmisor,
        neto:       doc.neto,
        iva:        doc.iva,
        exento:     doc.exento,
        total:      doc.total,
        glosa:      doc.glosa,
        fromSII:    true,
    };
}

/**
 * Convierte documento SII normalizado a una fila de libro de ventas.
 */
function siiDocAVenta(doc) {
    return {
        fecha:      doc.fecha,
        tipo:       doc.tipoNombre,
        folio:      doc.folio,
        rut:        doc.rutRecep,
        razon:      doc.razRecep,
        neto:       doc.neto,
        iva:        doc.iva,
        exento:     doc.exento,
        total:      doc.total,
        glosa:      doc.glosa,
        fromSII:    true,
    };
}

// ── UI: modal de importación SII ──────────────────────────────────────────────

function siiAbrirImportador(libroDestino) {
    // Importación directa: abre el selector de archivo sin modal intermedio.
    // Si ya existe un input previo, reutilizarlo.
    let input = document.getElementById('siiFileInputGlobal');
    if (!input) {
        input = document.createElement('input');
        input.type    = 'file';
        input.id      = 'siiFileInputGlobal';
        input.accept  = '.xml';
        input.multiple= true;
        input.style.display = 'none';
        document.body.appendChild(input);
    }
    // Siempre reasignar onchange para el libro correcto
    input.onchange = () => { siiOnFiles(input, libroDestino); };
    input.value = '';
    input.click();
}

function siiCerrarModal() {
    document.getElementById('sii-modal')?.remove();
    window._siiPendiente = null;
}

function siiOnDrop(e, libro) {
    e.preventDefault();
    document.getElementById('siiDropZone').style.borderColor = 'var(--divider)';
    const files = Array.from(e.dataTransfer?.files || []).filter(f => f.name.endsWith('.xml'));
    if (!files.length) { mostrarToast('Solo se aceptan archivos .xml', 'error'); return; }
    _siiProcesarUI(files, libro);
}

function siiOnFiles(input, libro) {
    const files = Array.from(input.files || []);
    input.value = '';
    if (!files.length) return;
    _siiProcesarUI(files, libro);
}

async function _siiProcesarUI(files, libro) {
    // Importación directa — sin modal de confirmación
    mostrarToast(`Procesando ${files.length} archivo(s)…`, 'info');

    const res = await siiProcesarArchivos(files);
    window._siiPendiente = { res, libro };

    if (res.errores.length && !res.compras.length && !res.ventas.length) {
        mostrarToast('Error en el XML: ' + res.errores[0].error, 'error');
        siiCerrarModal();
        return;
    }

    await siiConfirmarImport();
}

async function siiConfirmarImport() {
    const { res, libro } = window._siiPendiente || {};
    if (!res) return;

    let importadosC = 0, importadosV = 0;
    const todosLos = [...res.compras, ...res.ventas];

    // Insertar en compras
    if (res.compras.length && (libro === 'auto' || libro === 'compras')) {
        const key    = 'core_compras';
        const actual = JSON.parse(localStorage.getItem(key) || '[]');
        const nuevas = res.compras.map(siiDocACompra).filter(d =>
            !actual.some(a => a.folio === d.folio && a.rut === d.rut)
        );
        localStorage.setItem(key, JSON.stringify([...actual, ...nuevas]));
        importadosC = nuevas.length;
    }

    // Insertar en ventas
    if (res.ventas.length && (libro === 'auto' || libro === 'ventas')) {
        const key    = 'core_ventas';
        const actual = JSON.parse(localStorage.getItem(key) || '[]');
        const nuevas = res.ventas.map(siiDocAVenta).filter(d =>
            !actual.some(a => a.folio === d.folio && a.rut === d.rut)
        );
        localStorage.setItem(key, JSON.stringify([...actual, ...nuevas]));
        importadosV = nuevas.length;
    }

    // Registrar también en el módulo Documentos
    const docReg = siiRegistrarEnDocumentos(todosLos);

    const total = importadosC + importadosV;
    const dupes = (res.compras.length + res.ventas.length) - total;

    siiCerrarModal();
    mostrarToast(
        `${total} documento(s) importado(s)${dupes ? ` (${dupes} ya existían)` : ''}. ${docReg} registrado(s) en Documentación.`,
        total > 0 ? 'ok' : 'warn'
    );

    // Re-renderizar vistas activas
    if (typeof renderCompras    === 'function') renderCompras();
    if (typeof renderVentas     === 'function') renderVentas();
    if (typeof renderDocumentos === 'function') renderDocumentos();
}

/**
 * Registra los documentos SII en el módulo Documentos (core_documentos).
 * Retorna la cantidad efectivamente insertada (sin duplicados).
 */
function siiRegistrarEnDocumentos(docs) {
    const KEY    = 'core_documentos';
    const actual = JSON.parse(localStorage.getItem(KEY) || '[]');
    let insertados = 0;

    docs.forEach(doc => {
        // Evitar duplicados por folio + RUT emisor/receptor
        const rut = doc.libro === 'compras' ? doc.rutEmisor : doc.rutRecep;
        const ya  = actual.some(d => d.numero_doc === doc.folio && d.rut === rut);
        if (ya) return;

        actual.push({
            id:         Date.now() + Math.random(),
            categoria:  _siiCategoria(doc),
            fecha:      doc.fecha,
            numero_doc: doc.folio,
            rut,
            nombre:     doc.libro === 'compras' ? doc.razEmisor : doc.razRecep,
            neto:       doc.neto,
            iva:        doc.iva,
            exento:     doc.exento,
            total:      doc.total,
            estado:     'pendiente',
            glosa:      doc.glosa,
            adjunto:    null,
            fromSII:    true,
            tipoDTE:    doc.tipoDTE,
            created_at: Date.now(),
        });
        insertados++;
    });

    localStorage.setItem(KEY, JSON.stringify(actual));
    return insertados;
}

function _siiCategoria(doc) {
    // Mapea tipo DTE a categoría del módulo Documentos
    const t = doc.tipoDTE;
    if (t === 39 || t === 41) return 'venta_boleta';
    if (doc.libro === 'ventas') return 'venta_factura';
    if (t === 33 || t === 34 || t === 110) return 'compra_servicio';
    return 'compra_materia';
}

// ── Expose ────────────────────────────────────────────────────────────────────
window.siiParsearXML        = siiParsearXML;
window.siiProcesarArchivos  = siiProcesarArchivos;
window.siiDocACompra        = siiDocACompra;
window.siiDocAVenta         = siiDocAVenta;
window.siiAbrirImportador   = siiAbrirImportador;
window.siiCerrarModal       = siiCerrarModal;
window.siiOnDrop            = siiOnDrop;
window.siiOnFiles           = siiOnFiles;
window.siiConfirmarImport   = siiConfirmarImport;
