'use strict';
/**
 * cartolas.js — Importador de Cartolas Bancarias
 * Importa extractos bancarios en CSV/XLSX, permite clasificar
 * movimientos contra el plan de cuentas y genera asientos de
 * doble partida en el Libro Diario.
 * Bancos soportados: Banco de Chile, BancoEstado, Santander,
 *                    BCI, Scotiabank, Itaú, Genérico.
 */

// ─────────────────────────────────────────────────────────────
//  ESTADO DEL MÓDULO
// ─────────────────────────────────────────────────────────────
let _dbCartola = JSON.parse(localStorage.getItem('core_cartola_movs')) || [];

let _cartolaFiltroMes   = new Date().getMonth() + 1;
let _cartolaFiltroAnio  = new Date().getFullYear();
let _cartolaFiltroTipo  = 'todos';     // 'todos' | 'cargo' | 'abono'
let _cartolaFiltroEstado = 'todos';   // 'todos' | 'pendiente' | 'clasificado' | 'ignorado'
let _cartolaBancoSel    = 'bancochile';
let _cartolaFilaAbierta = null;        // id del movimiento con panel inline abierto

const BANCOS = [
    { value: 'bancochile',  label: 'Banco de Chile'  },
    { value: 'bancoestado', label: 'BancoEstado'      },
    { value: 'santander',   label: 'Santander'        },
    { value: 'bci',         label: 'BCI'              },
    { value: 'scotiabank',  label: 'Scotiabank'       },
    { value: 'itau',        label: 'Itaú'             },
    { value: 'generico',    label: 'Genérico'         },
];

// ─────────────────────────────────────────────────────────────
//  UTILIDADES
// ─────────────────────────────────────────────────────────────

/** Escapa caracteres HTML para inserción segura en innerHTML */
function _cEsc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** Formatea número como moneda chilena (punto de miles, sin decimales) */
function _cFmt(n) {
    const num = Number(n) || 0;
    if (num === 0) return '—';
    return '$ ' + Math.abs(num).toLocaleString('es-CL', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    });
}

/**
 * Normaliza montos chilenos.
 * Ej: "1.234.567" → 1234567   "1.234,56" → 1234.56   "$1.234" → 1234
 */
function _parseMonto(raw) {
    if (!raw && raw !== 0) return 0;
    let s = String(raw).trim().replace(/\s/g, '').replace(/\$/g, '');
    if (!s || s === '-' || s === '') return 0;
    // Detectar si usa coma como decimal (formato europeo/chileno mixto)
    const tieneComaDecimal = /,\d{1,2}$/.test(s) && s.indexOf('.') !== -1;
    if (tieneComaDecimal) {
        // 1.234,56 → 1234.56
        s = s.replace(/\./g, '').replace(',', '.');
    } else {
        // 1.234.567 o 1,234,567 → limpiar separadores de miles
        s = s.replace(/\./g, '').replace(/,/g, '');
    }
    const n = parseFloat(s);
    return isNaN(n) ? 0 : Math.abs(n);
}

/**
 * Normaliza fechas chilenas a YYYY-MM-DD.
 * Acepta: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, YYYYMMDD
 */
function _parseDate(raw) {
    if (!raw) return '';
    const s = String(raw).trim();
    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    // YYYYMMDD
    if (/^\d{8}$/.test(s)) {
        return s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6, 8);
    }
    // DD/MM/YYYY o DD-MM-YYYY
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (m) {
        const d = m[1].padStart(2, '0');
        const mo = m[2].padStart(2, '0');
        return m[3] + '-' + mo + '-' + d;
    }
    return s; // devolver tal cual si no se reconoce
}

/** Genera un ID único para movimiento */
function _mkId() {
    return 'mv' + Date.now() + Math.random().toString(36).slice(2, 8);
}

// ─────────────────────────────────────────────────────────────
//  PERSISTENCIA
// ─────────────────────────────────────────────────────────────
function _guardarCartola() {
    localStorage.setItem('core_cartola_movs', JSON.stringify(_dbCartola));
    window.dbCartolaMov = _dbCartola;
}

function guardarCartolas(movs) {
    if (movs) {
        localStorage.setItem('core_cartola_movs', JSON.stringify(movs));
        window.dbCartolaMov = movs;
    } else {
        _guardarCartola();
    }
}
window.guardarCartolas = guardarCartolas;

// ─────────────────────────────────────────────────────────────
//  PARSERS POR BANCO
// ─────────────────────────────────────────────────────────────

/**
 * Divide una línea CSV respetando comillas dobles.
 */
function _csvSplit(line, sep) {
    sep = sep || ',';
    const result = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            inQ = !inQ;
        } else if (ch === sep && !inQ) {
            result.push(cur.trim());
            cur = '';
        } else {
            cur += ch;
        }
    }
    result.push(cur.trim());
    return result;
}

/**
 * Detecta el separador de un CSV (coma o punto y coma).
 */
function _detectSep(headerLine) {
    const semicolons = (headerLine.match(/;/g) || []).length;
    const commas     = (headerLine.match(/,/g) || []).length;
    return semicolons > commas ? ';' : ',';
}

/**
 * Normaliza un nombre de columna para comparación.
 */
function _normCol(s) {
    return String(s).toLowerCase()
        .replace(/[áàä]/g, 'a')
        .replace(/[éèë]/g, 'e')
        .replace(/[íìï]/g, 'i')
        .replace(/[óòö]/g, 'o')
        .replace(/[úùü]/g, 'u')
        .replace(/[ñ]/g, 'n')
        .replace(/[^a-z0-9]/g, '');
}

/**
 * Parsea texto CSV según banco y devuelve array de movimientos normalizados.
 */
function _parsearCSV(texto, banco) {
    const lineas = texto.split(/\r?\n/).filter(l => l.trim() !== '');
    if (lineas.length < 2) throw new Error('El archivo no contiene datos suficientes.');

    // Detectar separador
    const sep = (banco === 'santander') ? ';' : _detectSep(lineas[0]);

    const headers = _csvSplit(lineas[0], sep).map(h => h.replace(/^"|"$/g, '').trim());
    const hNorm   = headers.map(_normCol);

    // Mapeo de columnas por banco y por nombres genéricos
    function _idx(candidates) {
        for (const c of candidates) {
            const i = hNorm.indexOf(_normCol(c));
            if (i !== -1) return i;
        }
        return -1;
    }

    const iDate = _idx(['fecha', 'date']);
    const iDesc = _idx(['descripcion', 'descripción', 'description', 'glosa', 'detalle']);
    const iCargo = (banco === 'scotiabank')
        ? _idx(['debito', 'débito', 'cargo', 'cargos'])
        : _idx(['cargo', 'cargos', 'debito', 'débito']);
    const iAbono = (banco === 'scotiabank')
        ? _idx(['credito', 'crédito', 'abono', 'abonos'])
        : _idx(['abono', 'abonos', 'credito', 'crédito']);
    const iSaldo = _idx(['saldo', 'balance']);

    if (iDate === -1 || iDesc === -1) {
        throw new Error(
            'No se encontraron columnas de Fecha o Descripción en el archivo. ' +
            'Columnas detectadas: ' + headers.join(', ')
        );
    }

    const movimientos = [];
    for (let i = 1; i < lineas.length; i++) {
        const cols = _csvSplit(lineas[i], sep).map(c => c.replace(/^"|"$/g, '').trim());
        if (cols.length < 2) continue;

        const fecha = _parseDate(cols[iDate] || '');
        const descripcion = cols[iDesc] || '';
        const cargo = iCargo !== -1 ? _parseMonto(cols[iCargo]) : 0;
        const abono = iAbono !== -1 ? _parseMonto(cols[iAbono]) : 0;
        const saldo = iSaldo !== -1 ? _parseMonto(cols[iSaldo]) : 0;

        if (!fecha && !descripcion) continue; // fila vacía o de resumen

        movimientos.push({
            id:                  _mkId(),
            banco:               banco,
            fecha:               fecha,
            descripcion:         descripcion,
            cargo:               cargo,
            abono:               abono,
            saldo:               saldo,
            cuenta_banco:        '',
            cuenta_contrapartida:'',
            estado:              'pendiente',
            origen:              'importacion',
            created_at:          Date.now()
        });
    }
    return movimientos;
}

/**
 * Parsea una hoja XLSX y devuelve movimientos normalizados.
 * Requiere window.XLSX (SheetJS).
 */
function _parsearXLSX(buffer, banco) {
    if (!window.XLSX) throw new Error('SheetJS no está disponible.');
    const wb = window.XLSX.read(buffer, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = window.XLSX.utils.sheet_to_csv(ws);
    return _parsearCSV(rows, banco);
}

// ─────────────────────────────────────────────────────────────
//  IMPORTACIÓN DE ARCHIVO
// ─────────────────────────────────────────────────────────────

/**
 * Punto de entrada público para importar un File.
 * @param {File} file
 * @param {string} banco  valor del selector de banco
 */
function cartolasImportarArchivo(file, banco) {
    if (!file) return;
    banco = banco || _cartolaBancoSel;

    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const esXLSX = (ext === 'xlsx' || ext === 'xls');

    if (esXLSX && !window.XLSX) {
        mostrarToast('SheetJS no está cargado — solo se admite CSV en este momento.', 'error');
        return;
    }

    const reader = new FileReader();

    reader.onerror = function () {
        mostrarToast('No se pudo leer el archivo.', 'error');
    };

    reader.onload = function (e) {
        try {
            let nuevos;
            if (esXLSX) {
                nuevos = _parsearXLSX(new Uint8Array(e.target.result), banco);
            } else {
                nuevos = _parsearCSV(e.target.result, banco);
            }

            if (!nuevos.length) {
                mostrarToast('El archivo no contiene movimientos válidos.', 'error');
                return;
            }

            // Evitar duplicados exactos (misma fecha + descripción + monto)
            let importados = 0;
            nuevos.forEach(function (mv) {
                const existe = _dbCartola.some(function (x) {
                    return x.fecha === mv.fecha &&
                           x.descripcion === mv.descripcion &&
                           x.cargo === mv.cargo &&
                           x.abono === mv.abono &&
                           x.banco === mv.banco;
                });
                if (!existe) {
                    _dbCartola.push(mv);
                    importados++;
                }
            });

            _guardarCartola();
            mostrarToast(
                importados + ' movimiento(s) importado(s). ' +
                (nuevos.length - importados) + ' duplicado(s) omitido(s).',
                'ok'
            );
            _cartolaRefrescar();
        } catch (err) {
            mostrarToast('Error al parsear el archivo: ' + err.message, 'error');
        }
    };

    if (esXLSX) {
        reader.readAsArrayBuffer(file);
    } else {
        reader.readAsText(file, 'UTF-8');
    }
}

// ─────────────────────────────────────────────────────────────
//  FILTRADO
// ─────────────────────────────────────────────────────────────
function _cartolaFiltrados() {
    return _dbCartola.filter(function (mv) {
        // Filtro período
        if (mv.fecha && mv.fecha.length >= 7) {
            const partes = mv.fecha.split('-');
            const anio = parseInt(partes[0]);
            const mes  = parseInt(partes[1]);
            if (anio !== _cartolaFiltroAnio || mes !== _cartolaFiltroMes) return false;
        }
        // Filtro tipo
        if (_cartolaFiltroTipo === 'cargo'  && mv.cargo === 0) return false;
        if (_cartolaFiltroTipo === 'abono'  && mv.abono === 0) return false;
        // Filtro estado
        if (_cartolaFiltroEstado !== 'todos' && mv.estado !== _cartolaFiltroEstado) return false;
        return true;
    });
}

// ─────────────────────────────────────────────────────────────
//  GENERACIÓN DE ASIENTOS
// ─────────────────────────────────────────────────────────────

/**
 * Genera asientos de doble partida para todos los movimientos
 * clasificados del período activo y los guarda en window.dbAsientos.
 */
function cartolasGenerarAsientos() {
    const clasificados = _cartolaFiltrados().filter(function (mv) {
        return mv.estado === 'clasificado' && mv.cuenta_banco && mv.cuenta_contrapartida;
    });

    if (!clasificados.length) {
        mostrarToast('No hay movimientos clasificados en el período seleccionado.', 'error');
        return;
    }

    if (!window.dbAsientos) window.dbAsientos = [];

    let generados = 0;
    clasificados.forEach(function (mv) {
        let debe, haber, monto;
        if (mv.cargo > 0) {
            debe   = mv.cuenta_contrapartida;
            haber  = mv.cuenta_banco;
            monto  = mv.cargo;
        } else {
            debe   = mv.cuenta_banco;
            haber  = mv.cuenta_contrapartida;
            monto  = mv.abono;
        }

        const asiento = {
            id:      'as' + Date.now() + Math.random().toString(36).slice(2, 6),
            fecha:   mv.fecha,
            glosa:   mv.descripcion + ' [cartola ' + mv.banco + ']',
            debe:    debe,
            haber:   haber,
            monto:   monto,
            origen:  'cartola',
            ref_mv:  mv.id,
            created_at: Date.now()
        };

        window.dbAsientos.push(asiento);

        // Marcar movimiento como procesado
        const idx = _dbCartola.findIndex(function (x) { return x.id === mv.id; });
        if (idx !== -1) _dbCartola[idx].estado = 'ignorado';

        generados++;
    });

    // Persistir
    localStorage.setItem('core_asientos', JSON.stringify(window.dbAsientos));
    _guardarCartola();

    mostrarToast(generados + ' asiento(s) generado(s) correctamente.', 'ok');
    _cartolaRefrescar();
}

// ─────────────────────────────────────────────────────────────
//  CLASIFICACIÓN INLINE
// ─────────────────────────────────────────────────────────────

/** Devuelve lista de cuentas del plan de cuentas */
function _listaCuentas() {
    if (!window.PLAN_CUENTAS) return [];
    return Object.keys(window.PLAN_CUENTAS).sort();
}

/** Construye opciones <option> para un select de cuentas */
function _opcionesCuentas(seleccionada) {
    seleccionada = seleccionada || '';
    let html = '<option value="">— Seleccione cuenta —</option>';
    _listaCuentas().forEach(function (c) {
        html += '<option value="' + _cEsc(c) + '"' +
                (c === seleccionada ? ' selected' : '') +
                '>' + _cEsc(c) + '</option>';
    });
    return html;
}

/** Abre el panel de clasificación inline bajo la fila dada */
function _abrirPanelClasificacion(mvId) {
    // Cerrar panel anterior si existía
    if (_cartolaFilaAbierta) {
        const panelViejo = document.getElementById('panel-cl-' + _cartolaFilaAbierta);
        if (panelViejo) panelViejo.remove();
    }

    if (_cartolaFilaAbierta === mvId) {
        _cartolaFilaAbierta = null;
        return;
    }

    _cartolaFilaAbierta = mvId;
    const mv = _dbCartola.find(function (x) { return x.id === mvId; });
    if (!mv) return;

    const fila = document.getElementById('fila-mv-' + mvId);
    if (!fila) return;

    const colspan = 9;
    const panelTr = document.createElement('tr');
    panelTr.id = 'panel-cl-' + mvId;
    panelTr.className = 'cartola-panel-inline';

    const td = document.createElement('td');
    td.colSpan = colspan;

    const div = document.createElement('div');
    div.className = 'cartola-panel-cuerpo';

    const lblBanco = document.createElement('label');
    lblBanco.textContent = 'Cuenta banco:';

    const selBanco = document.createElement('select');
    selBanco.id = 'cl-banco-' + mvId;
    selBanco.innerHTML = _opcionesCuentas(mv.cuenta_banco);

    const lblContra = document.createElement('label');
    lblContra.textContent = 'Contrapartida:';

    const selContra = document.createElement('select');
    selContra.id = 'cl-contra-' + mvId;
    selContra.innerHTML = _opcionesCuentas(mv.cuenta_contrapartida);

    const btnAplicar = document.createElement('button');
    btnAplicar.className = 'btn-cl-aplicar';
    btnAplicar.textContent = '✓ Aplicar';

    const btnCancelar = document.createElement('button');
    btnCancelar.className = 'btn-cl-cancelar';
    btnCancelar.textContent = 'Cancelar';

    btnAplicar.addEventListener('click', function () {
        const cBanco  = selBanco.value;
        const cContra = selContra.value;
        if (!cBanco || !cContra) {
            mostrarToast('Debe seleccionar ambas cuentas.', 'error');
            return;
        }
        const idx = _dbCartola.findIndex(function (x) { return x.id === mvId; });
        if (idx !== -1) {
            _dbCartola[idx].cuenta_banco         = cBanco;
            _dbCartola[idx].cuenta_contrapartida = cContra;
            _dbCartola[idx].estado               = 'clasificado';
        }
        _guardarCartola();
        _cartolaFilaAbierta = null;
        _cartolaRefrescar();
        mostrarToast('Movimiento clasificado.', 'ok');
    });

    btnCancelar.addEventListener('click', function () {
        panelTr.remove();
        _cartolaFilaAbierta = null;
    });

    div.appendChild(lblBanco);
    div.appendChild(selBanco);
    div.appendChild(lblContra);
    div.appendChild(selContra);
    div.appendChild(btnAplicar);
    div.appendChild(btnCancelar);

    td.appendChild(div);
    panelTr.appendChild(td);
    fila.after(panelTr);
}

/** Marca un movimiento como ignorado */
function _ignorarMovimiento(mvId) {
    const idx = _dbCartola.findIndex(function (x) { return x.id === mvId; });
    if (idx !== -1) {
        _dbCartola[idx].estado = 'ignorado';
        _guardarCartola();
        _cartolaRefrescar();
    }
}

/** Elimina un movimiento */
function _eliminarMovimiento(mvId) {
    _dbCartola = _dbCartola.filter(function (x) { return x.id !== mvId; });
    _guardarCartola();
    _cartolaRefrescar();
}

// ─────────────────────────────────────────────────────────────
//  RENDER — TABLA DE MOVIMIENTOS
// ─────────────────────────────────────────────────────────────
function _renderTablaCartola() {
    const tbody = document.getElementById('tbodyCartola');
    if (!tbody) return;

    const datos = _cartolaFiltrados();
    tbody.innerHTML = '';
    _cartolaFilaAbierta = null;

    if (!datos.length) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 9;
        td.className = 'sin-datos';
        td.textContent = 'Sin movimientos para el período y filtros seleccionados.';
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
    }

    datos.forEach(function (mv) {
        const tr = document.createElement('tr');
        tr.id = 'fila-mv-' + mv.id;
        tr.className = 'fila-estado-' + mv.estado;

        const tdFecha = document.createElement('td');
        tdFecha.textContent = mv.fecha || '—';

        const tdBanco = document.createElement('td');
        const bancoObj = BANCOS.find(function (b) { return b.value === mv.banco; });
        tdBanco.textContent = bancoObj ? bancoObj.label : mv.banco;

        const tdDesc = document.createElement('td');
        tdDesc.className = 'celda-desc';
        tdDesc.title = mv.descripcion || '';
        tdDesc.textContent = mv.descripcion || '—';

        const tdCargo = document.createElement('td');
        tdCargo.className = 'celda-monto celda-cargo';
        tdCargo.textContent = mv.cargo > 0 ? _cFmt(mv.cargo) : '';

        const tdAbono = document.createElement('td');
        tdAbono.className = 'celda-monto celda-abono';
        tdAbono.textContent = mv.abono > 0 ? _cFmt(mv.abono) : '';

        const tdCuBanco = document.createElement('td');
        tdCuBanco.textContent = mv.cuenta_banco || '—';

        const tdContra = document.createElement('td');
        tdContra.textContent = mv.cuenta_contrapartida || '—';

        const tdEstado = document.createElement('td');
        const span = document.createElement('span');
        span.className = 'badge-estado badge-' + mv.estado;
        const labelEstado = { pendiente: 'Pendiente', clasificado: 'Clasificado', ignorado: 'Ignorado' };
        span.textContent = labelEstado[mv.estado] || mv.estado;
        tdEstado.appendChild(span);

        const tdAcciones = document.createElement('td');
        tdAcciones.className = 'celda-acciones';

        if (mv.estado !== 'ignorado') {
            const btnCl = document.createElement('button');
            btnCl.className = 'btn-accion btn-clasificar';
            btnCl.textContent = 'Clasificar';
            btnCl.dataset.id = mv.id;
            btnCl.addEventListener('click', function () {
                _abrirPanelClasificacion(mv.id);
            });
            tdAcciones.appendChild(btnCl);

            const btnIgn = document.createElement('button');
            btnIgn.className = 'btn-accion btn-ignorar';
            btnIgn.textContent = 'Ignorar';
            btnIgn.dataset.id = mv.id;
            btnIgn.addEventListener('click', function () {
                _ignorarMovimiento(mv.id);
            });
            tdAcciones.appendChild(btnIgn);
        }

        const btnDel = document.createElement('button');
        btnDel.className = 'btn-accion btn-eliminar';
        btnDel.textContent = '✕';
        btnDel.title = 'Eliminar movimiento';
        btnDel.dataset.id = mv.id;
        btnDel.addEventListener('click', function () {
            mostrarConfirm('¿Eliminar este movimiento?', () => {
                _eliminarMovimiento(mv.id);
            });
        });
        tdAcciones.appendChild(btnDel);

        tr.appendChild(tdFecha);
        tr.appendChild(tdBanco);
        tr.appendChild(tdDesc);
        tr.appendChild(tdCargo);
        tr.appendChild(tdAbono);
        tr.appendChild(tdCuBanco);
        tr.appendChild(tdContra);
        tr.appendChild(tdEstado);
        tr.appendChild(tdAcciones);

        tbody.appendChild(tr);
    });
}

// ─────────────────────────────────────────────────────────────
//  RENDER — KPIs
// ─────────────────────────────────────────────────────────────
function _renderKPIs() {
    const datos = _cartolaFiltrados();
    const total     = datos.length;
    const cargos    = datos.reduce(function (a, mv) { return a + mv.cargo; }, 0);
    const abonos    = datos.reduce(function (a, mv) { return a + mv.abono; }, 0);
    const pendientes = datos.filter(function (mv) { return mv.estado === 'pendiente'; }).length;

    function _set(id, val) {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    }

    _set('kpi-cartola-total',     total);
    _set('kpi-cartola-cargos',    _cFmt(cargos));
    _set('kpi-cartola-abonos',    _cFmt(abonos));
    _set('kpi-cartola-pendientes', pendientes);
}

// ─────────────────────────────────────────────────────────────
//  REFRESCO PARCIAL (sin reconstruir el DOM de la sección)
// ─────────────────────────────────────────────────────────────
function _cartolaRefrescar() {
    _renderKPIs();
    _renderTablaCartola();
}

// ─────────────────────────────────────────────────────────────
//  RENDER PRINCIPAL — inicializa el HTML de la sección una vez
// ─────────────────────────────────────────────────────────────
function renderCartolas() {
    const contenedor = document.getElementById('view-cartolas');
    if (!contenedor) return;

    // Si el esqueleto ya existe, solo refrescar datos
    if (document.getElementById('tbodyCartola')) {
        _cartolaRefrescar();
        return;
    }

    const xlsxDisponible = !!window.XLSX;
    const avisoXLSX = xlsxDisponible
        ? ''
        : '<p class="aviso-xlsx">⚠ SheetJS no detectado — importación XLSX deshabilitada. Solo CSV.</p>';

    // Selector de meses
    const meses = [
        'Enero','Febrero','Marzo','Abril','Mayo','Junio',
        'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
    ];
    let optMeses = '';
    meses.forEach(function (m, i) {
        const v = i + 1;
        optMeses += '<option value="' + v + '"' +
                    (v === _cartolaFiltroMes ? ' selected' : '') +
                    '>' + m + '</option>';
    });

    // Opciones de bancos
    let optBancos = '';
    BANCOS.forEach(function (b) {
        optBancos += '<option value="' + _cEsc(b.value) + '"' +
                     (b.value === _cartolaBancoSel ? ' selected' : '') +
                     '>' + _cEsc(b.label) + '</option>';
    });

    const anioActual = new Date().getFullYear();

    contenedor.innerHTML =
        // ── KPIs ──
        '<div class="cartola-kpis">' +
            '<div class="kpi-card">' +
                '<div class="kpi-label">Total movimientos</div>' +
                '<div class="kpi-valor" id="kpi-cartola-total">0</div>' +
            '</div>' +
            '<div class="kpi-card kpi-cargo">' +
                '<div class="kpi-label">Total cargos</div>' +
                '<div class="kpi-valor" id="kpi-cartola-cargos">—</div>' +
            '</div>' +
            '<div class="kpi-card kpi-abono">' +
                '<div class="kpi-label">Total abonos</div>' +
                '<div class="kpi-valor" id="kpi-cartola-abonos">—</div>' +
            '</div>' +
            '<div class="kpi-card kpi-pendiente">' +
                '<div class="kpi-label">Pendientes</div>' +
                '<div class="kpi-valor" id="kpi-cartola-pendientes">0</div>' +
            '</div>' +
        '</div>' +

        // ── Panel importación ──
        '<div class="cartola-importacion">' +
            '<h3>Importar Cartola</h3>' +
            avisoXLSX +
            '<div class="importacion-controles">' +
                '<label>Banco:' +
                    '<select id="sel-banco-cartola">' + optBancos + '</select>' +
                '</label>' +
                '<div id="dropzone-cartola" class="dropzone-cartola">' +
                    '<span>Arrastra aquí el archivo CSV' + (xlsxDisponible ? ' / XLSX' : '') + '</span>' +
                    '<button id="btn-seleccionar-cartola" type="button">Seleccionar archivo</button>' +
                    '<input type="file" id="input-file-cartola" accept=".csv,.xlsx,.xls" style="display:none">' +
                '</div>' +
            '</div>' +
        '</div>' +

        // ── Filtros y acciones ──
        '<div class="cartola-filtros">' +
            '<label>Mes:' +
                '<select id="sel-mes-cartola">' + optMeses + '</select>' +
            '</label>' +
            '<label>Año:' +
                '<input type="number" id="inp-anio-cartola" value="' + anioActual + '" min="2000" max="2099">' +
            '</label>' +
            '<label>Tipo:' +
                '<select id="sel-tipo-cartola">' +
                    '<option value="todos">Todos</option>' +
                    '<option value="cargo">Solo cargos</option>' +
                    '<option value="abono">Solo abonos</option>' +
                '</select>' +
            '</label>' +
            '<label>Estado:' +
                '<select id="sel-estado-cartola">' +
                    '<option value="todos">Todos</option>' +
                    '<option value="pendiente">Pendiente</option>' +
                    '<option value="clasificado">Clasificado</option>' +
                    '<option value="ignorado">Ignorado</option>' +
                '</select>' +
            '</label>' +
            '<button id="btn-generar-asientos-cartola" class="btn-generar-asientos">Generar asientos</button>' +
        '</div>' +

        // ── Tabla ──
        '<div class="cartola-tabla-wrapper">' +
            '<table class="cartola-tabla" id="tablaCartola">' +
                '<thead>' +
                    '<tr>' +
                        '<th>Fecha</th>' +
                        '<th>Banco</th>' +
                        '<th>Descripción</th>' +
                        '<th class="celda-monto">Cargo</th>' +
                        '<th class="celda-monto">Abono</th>' +
                        '<th>Cuenta banco</th>' +
                        '<th>Contrapartida</th>' +
                        '<th>Estado</th>' +
                        '<th>Acciones</th>' +
                    '</tr>' +
                '</thead>' +
                '<tbody id="tbodyCartola"></tbody>' +
            '</table>' +
        '</div>';

    // ── Eventos ──

    // Selector de banco
    document.getElementById('sel-banco-cartola').addEventListener('change', function () {
        _cartolaBancoSel = this.value;
    });

    // Filtros de período y tipo
    document.getElementById('sel-mes-cartola').addEventListener('change', function () {
        _cartolaFiltroMes = parseInt(this.value);
        _cartolaRefrescar();
    });

    document.getElementById('inp-anio-cartola').addEventListener('change', function () {
        const v = parseInt(this.value);
        if (v >= 2000 && v <= 2099) {
            _cartolaFiltroAnio = v;
            _cartolaRefrescar();
        }
    });

    document.getElementById('sel-tipo-cartola').addEventListener('change', function () {
        _cartolaFiltroTipo = this.value;
        _cartolaRefrescar();
    });

    document.getElementById('sel-estado-cartola').addEventListener('change', function () {
        _cartolaFiltroEstado = this.value;
        _cartolaRefrescar();
    });

    // Botón generar asientos
    document.getElementById('btn-generar-asientos-cartola').addEventListener('click', function () {
        cartolasGenerarAsientos();
    });

    // Botón seleccionar archivo
    document.getElementById('btn-seleccionar-cartola').addEventListener('click', function () {
        document.getElementById('input-file-cartola').click();
    });

    // Input file
    document.getElementById('input-file-cartola').addEventListener('change', function () {
        const f = this.files && this.files[0];
        if (f) {
            const banco = document.getElementById('sel-banco-cartola').value;
            cartolasImportarArchivo(f, banco);
        }
        this.value = ''; // reset para permitir reimportar mismo archivo
    });

    // Drag & drop
    const dropzone = document.getElementById('dropzone-cartola');

    dropzone.addEventListener('dragover', function (e) {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('dropzone-activo');
    });

    dropzone.addEventListener('dragleave', function (e) {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('dropzone-activo');
    });

    dropzone.addEventListener('drop', function (e) {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('dropzone-activo');
        const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) {
            const banco = document.getElementById('sel-banco-cartola').value;
            cartolasImportarArchivo(f, banco);
        }
    });

    // Render inicial de datos
    _cartolaRefrescar();
}

// ─────────────────────────────────────────────────────────────
//  EXPOSE PÚBLICO
// ─────────────────────────────────────────────────────────────
window.renderCartolas            = renderCartolas;
window.cartolasImportarArchivo   = cartolasImportarArchivo;
window.cartolasGenerarAsientos   = cartolasGenerarAsientos;
