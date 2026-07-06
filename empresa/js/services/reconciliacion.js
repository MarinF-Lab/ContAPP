// ─────────────────────────────────────────────────────────────
//  CONCILIACIÓN BANCARIA
//  Importa CSV/Excel del banco, cruza contra asientos del diario
//  con cuenta Banco, y muestra diferencias.
// ─────────────────────────────────────────────────────────────

const REC_KEY = 'core_reconciliacion';

// Formatos conocidos de bancos chilenos (detección por cabeceras)
const REC_FORMATOS = [
    {
        nombre: 'Banco de Chile',
        cabeceras: ['fecha', 'descripcion', 'cargo', 'abono', 'saldo'],
        mapeo: { fecha: 'fecha', desc: 'descripcion', cargo: 'cargo', abono: 'abono' },
    },
    {
        nombre: 'Santander',
        cabeceras: ['fecha', 'descripcion', 'monto', 'saldo'],
        mapeo: { fecha: 'fecha', desc: 'descripcion', cargo: null, abono: 'monto' },
        montoSignado: true,
    },
    {
        nombre: 'BCI',
        cabeceras: ['fecha', 'detalle', 'cargo', 'abono', 'saldo'],
        mapeo: { fecha: 'fecha', desc: 'detalle', cargo: 'cargo', abono: 'abono' },
    },
    {
        nombre: 'Banco Estado',
        cabeceras: ['fecha movimiento', 'descripcion', 'debe', 'haber', 'saldo'],
        mapeo: { fecha: 'fecha movimiento', desc: 'descripcion', cargo: 'debe', abono: 'haber' },
    },
    {
        nombre: 'Scotiabank',
        cabeceras: ['fecha', 'glosa', 'cargo', 'abono', 'saldo'],
        mapeo: { fecha: 'fecha', desc: 'glosa', cargo: 'cargo', abono: 'abono' },
    },
    {
        nombre: 'Itaú',
        cabeceras: ['fecha', 'descripcion', 'debito', 'credito', 'saldo'],
        mapeo: { fecha: 'fecha', desc: 'descripcion', cargo: 'debito', abono: 'credito' },
    },
];

// Estado en memoria
let _recState = {
    periodo:      '',           // 'YYYY-MM'
    cuentaBanco:  'Banco',      // nombre de cuenta en plan de cuentas
    saldoExtracto: null,        // saldo final según banco
    transacciones: [],          // filas importadas del archivo
    mapeo:        null,         // columnas detectadas
    montoSignado: false,        // monto único con signo (+ abono, - cargo)
    conciliados:  {},           // { idBanco: asientoId }
};

// ── Persistencia ──────────────────────────────────────────────

function _recGuardar() {
    localStorage.setItem(REC_KEY, JSON.stringify(_recState));
}

function _recCargar() {
    try {
        const s = JSON.parse(localStorage.getItem(REC_KEY) || 'null');
        if (s) _recState = { ..._recState, ...s };
    } catch { /* ignorar */ }
}

// ── Render principal ──────────────────────────────────────────

function renderReconciliacion() {
    _recCargar();

    const root = document.getElementById('rec-root');
    if (!root) return;

    // Periodo por defecto: mes actual
    if (!_recState.periodo) {
        const hoy = new Date();
        _recState.periodo = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
    }

    // Cuentas bancarias disponibles (plan de cuentas, tipo Activo)
    const cuentasBanco = _recCuentasBanco();

    root.innerHTML = `
    <div style="padding:20px 24px;">

        <!-- Encabezado -->
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap;">
            <h2 style="margin:0;font-size:18px;font-weight:700;color:var(--text);">Conciliación Bancaria</h2>
            <div style="flex:1"></div>
            <button class="btn" onclick="recNuevaPeriodo()" style="font-size:12px;">+ Nueva conciliación</button>
        </div>

        <!-- Controles -->
        <div class="card" style="padding:16px;margin-bottom:16px;display:flex;gap:16px;flex-wrap:wrap;align-items:flex-end;">
            <div style="display:flex;flex-direction:column;gap:4px;">
                <label style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;">Período</label>
                <input type="month" id="recPeriodo" value="${_recState.periodo}"
                    style="padding:7px 10px;border:1px solid var(--divider);border-radius:8px;background:var(--input-bg);color:var(--text);font-size:13px;"
                    onchange="recCambiarPeriodo(this.value)">
            </div>
            <div style="display:flex;flex-direction:column;gap:4px;">
                <label style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;">Cuenta banco</label>
                <select id="recCuentaBanco"
                    style="padding:7px 10px;border:1px solid var(--divider);border-radius:8px;background:var(--input-bg);color:var(--text);font-size:13px;"
                    onchange="recCambiarCuenta(this.value)">
                    ${cuentasBanco.map(c => `<option value="${c}" ${c === _recState.cuentaBanco ? 'selected' : ''}>${c}</option>`).join('')}
                </select>
            </div>
            <div style="display:flex;flex-direction:column;gap:4px;">
                <label style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;">Saldo extracto ($)</label>
                <input type="text" id="recSaldoExtracto"
                    value="${_recState.saldoExtracto != null ? fmt(_recState.saldoExtracto) : ''}"
                    placeholder="0"
                    style="padding:7px 10px;border:1px solid var(--divider);border-radius:8px;background:var(--input-bg);color:var(--text);font-size:13px;width:140px;"
                    oninput="recActualizarSaldo(this.value)">
            </div>
        </div>

        <!-- Zona de importación -->
        ${_recState.transacciones.length === 0 ? _recHtmlImport() : ''}

        <!-- Tabla de conciliación -->
        ${_recState.transacciones.length > 0 ? _recHtmlTabla() : ''}

    </div>`;
}

function _recHtmlImport() {
    return `
    <div id="recDropZone"
        style="border:2px dashed var(--divider);border-radius:12px;padding:48px 24px;text-align:center;cursor:pointer;transition:.2s;background:var(--table-stripe);"
        ondragover="event.preventDefault();this.style.borderColor='var(--accent)'"
        ondragleave="this.style.borderColor='var(--divider)'"
        ondrop="recOnDrop(event)"
        onclick="document.getElementById('recFileInput').click()">
        <div style="font-size:36px;margin-bottom:12px;">📂</div>
        <div style="font-size:15px;font-weight:600;color:var(--text);margin-bottom:6px;">Arrastra el estado de cuenta aquí</div>
        <div style="font-size:13px;color:var(--text-muted);">o haz clic para seleccionar — Excel (.xlsx) o CSV (.csv)</div>
        <div style="margin-top:16px;font-size:11px;color:var(--text-subtle);">
            Bancos detectados automáticamente: Banco de Chile · Santander · BCI · Banco Estado · Scotiabank · Itaú
        </div>
    </div>
    <input type="file" id="recFileInput" accept=".xlsx,.xls,.csv" style="display:none" onchange="recOnFile(this)">

    <!-- Mapeador manual (oculto hasta que se necesite) -->
    <div id="recMapeoManual" style="display:none;margin-top:16px;"></div>`;
}

function _recHtmlTabla() {
    const txs        = _recState.transacciones;
    const asientos   = _recAsientosDelPeriodo();
    const conciliados = _recState.conciliados || {};

    // Separar conciliados de pendientes
    const txConc  = txs.filter(t => conciliados[t._id] != null);
    const txPend  = txs.filter(t => conciliados[t._id] == null);

    // Asientos pendientes (no vinculados)
    const idsUsados  = new Set(Object.values(conciliados));
    const asientosPend = asientos.filter(a => !idsUsados.has(a.id));

    // Saldos
    const saldoLibros = _recSaldoLibros(asientos);
    const saldoBanco  = _recState.saldoExtracto;
    const diferencia  = saldoBanco != null ? saldoBanco - saldoLibros : null;

    const mono = "font-family:'JetBrains Mono','Courier New',monospace;";
    const fmtM = n => n == null ? '—' : (n < 0 ? '-' : '') + '$' + fmt(Math.abs(n));

    return `
    <!-- Barra de resumen -->
    <div class="card" style="padding:14px 20px;margin-bottom:16px;display:flex;gap:24px;flex-wrap:wrap;align-items:center;">
        <div>
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin-bottom:2px;">Saldo en libros</div>
            <div style="font-size:16px;font-weight:700;color:var(--text);${mono}">${fmtM(saldoLibros)}</div>
        </div>
        <div>
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin-bottom:2px;">Saldo extracto banco</div>
            <div style="font-size:16px;font-weight:700;color:var(--text);${mono}">${saldoBanco != null ? fmtM(saldoBanco) : '—'}</div>
        </div>
        <div>
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin-bottom:2px;">Diferencia</div>
            <div style="font-size:16px;font-weight:700;${mono};color:${diferencia === 0 ? 'var(--positive)' : diferencia == null ? 'var(--text-muted)' : 'var(--negative)'}">
                ${diferencia != null ? fmtM(diferencia) : '—'}
            </div>
        </div>
        <div style="flex:1"></div>
        <div style="font-size:12px;color:var(--text-muted);">
            ${txConc.length}/${txs.length} conciliados &nbsp;·&nbsp;
            ${txPend.length} banco pendientes &nbsp;·&nbsp;
            ${asientosPend.length} libro pendientes
        </div>
        <button class="btn btn-sm" onclick="recAutoMatch()" title="Conciliación automática por fecha y monto">⚡ Auto-conciliar</button>
        <button class="btn btn-sm" style="background:var(--negative-soft);color:var(--negative);" onclick="recLimpiar()">✕ Limpiar</button>
    </div>

    <!-- Tabla de tres columnas -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">

        <!-- Columna banco -->
        <div class="card" style="padding:0;overflow:hidden;">
            <div style="padding:10px 14px;background:var(--accent);color:#fff;font-weight:700;font-size:12px;display:flex;justify-content:space-between;">
                <span>🏦 EXTRACTO BANCO (${txPend.length} pendientes)</span>
            </div>
            <div style="max-height:460px;overflow-y:auto;">
                ${txPend.length === 0
                    ? '<div style="padding:24px;text-align:center;color:var(--positive);font-size:13px;">✓ Todos conciliados</div>'
                    : txPend.map(t => _recRowBanco(t, asientosPend)).join('')}
            </div>
        </div>

        <!-- Columna libro -->
        <div class="card" style="padding:0;overflow:hidden;">
            <div style="padding:10px 14px;background:var(--accent);color:#fff;font-weight:700;font-size:12px;display:flex;justify-content:space-between;">
                <span>📝 LIBRO DIARIO (${asientosPend.length} pendientes)</span>
            </div>
            <div style="max-height:460px;overflow-y:auto;">
                ${asientosPend.length === 0
                    ? '<div style="padding:24px;text-align:center;color:var(--positive);font-size:13px;">✓ Todos conciliados</div>'
                    : asientosPend.map(a => _recRowAsiento(a)).join('')}
            </div>
        </div>

    </div>

    <!-- Conciliados -->
    ${txConc.length > 0 ? `
    <div class="card" style="padding:0;overflow:hidden;margin-top:16px;">
        <div style="padding:10px 14px;background:var(--positive);color:#fff;font-weight:700;font-size:12px;">
            ✓ CONCILIADOS (${txConc.length})
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
            <thead>
                <tr style="background:var(--table-stripe);">
                    <th style="padding:7px 12px;text-align:left;color:var(--text-muted);font-weight:600;">Fecha banco</th>
                    <th style="padding:7px 12px;text-align:left;color:var(--text-muted);font-weight:600;">Descripción banco</th>
                    <th style="padding:7px 12px;text-align:right;color:var(--text-muted);font-weight:600;">Monto</th>
                    <th style="padding:7px 12px;text-align:left;color:var(--text-muted);font-weight:600;">Asiento</th>
                    <th style="padding:7px 12px;text-align:left;color:var(--text-muted);font-weight:600;">Glosa</th>
                    <th style="padding:7px 12px;"></th>
                </tr>
            </thead>
            <tbody>
                ${txConc.map(t => {
                    const a = asientos.find(x => x.id === conciliados[t._id]);
                    const monto = t.abono > 0 ? t.abono : -t.cargo;
                    return `<tr style="border-top:1px solid var(--divider);">
                        <td style="padding:7px 12px;">${t.fecha}</td>
                        <td style="padding:7px 12px;color:var(--text-muted);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${t.descripcion}</td>
                        <td style="padding:7px 12px;text-align:right;font-family:'JetBrains Mono',monospace;color:${monto>=0?'var(--positive)':'var(--negative)'};">${fmtM(monto)}</td>
                        <td style="padding:7px 12px;color:var(--text-muted);">${a ? '#' + a.numero : '—'}</td>
                        <td style="padding:7px 12px;color:var(--text-muted);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${a ? a.glosa : '—'}</td>
                        <td style="padding:7px 12px;text-align:right;">
                            <button onclick="recDesligar('${t._id}')" style="font-size:10px;padding:2px 8px;border:none;border-radius:4px;background:var(--negative-soft);color:var(--negative);cursor:pointer;">✕</button>
                        </td>
                    </tr>`;
                }).join('')}
            </tbody>
        </table>
    </div>` : ''}`;
}

function _recRowBanco(t, asientosCandidatos) {
    const monto   = t.abono > 0 ? t.abono : -t.cargo;
    const mono    = "font-family:'JetBrains Mono','Courier New',monospace;";
    const fmtM    = n => (n < 0 ? '-$' : '$') + fmt(Math.abs(n));
    // Sugerir asiento más parecido por monto y fecha
    const sugerido = _recSugerirAsiento(t, asientosCandidatos);

    return `
    <div style="padding:10px 14px;border-bottom:1px solid var(--divider);">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
            <div style="flex:1;min-width:0;">
                <div style="font-size:11px;color:var(--text-muted);">${t.fecha}</div>
                <div style="font-size:12px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${t.descripcion}">${t.descripcion}</div>
            </div>
            <div style="font-weight:700;font-size:13px;${mono};color:${monto>=0?'var(--positive)':'var(--negative)'};white-space:nowrap;">${fmtM(monto)}</div>
        </div>
        ${sugerido ? `
        <div style="margin-top:6px;display:flex;align-items:center;gap:6px;background:var(--accent-soft);border-radius:6px;padding:5px 8px;">
            <span style="font-size:11px;color:var(--accent);">Sugerido: #${sugerido.numero} — ${sugerido.glosa.slice(0,40)}</span>
            <button onclick="recLigar('${t._id}', ${sugerido.id})"
                style="margin-left:auto;font-size:11px;padding:2px 10px;border:none;border-radius:4px;background:var(--accent);color:#fff;cursor:pointer;">Ligar</button>
        </div>` : ''}
        <div style="margin-top:6px;">
            <select onchange="if(this.value) recLigar('${t._id}', parseInt(this.value))"
                style="font-size:11px;padding:3px 6px;border:1px solid var(--divider);border-radius:6px;background:var(--input-bg);color:var(--text);width:100%;">
                <option value="">— Ligar a asiento manualmente —</option>
                ${asientosCandidatos.map(a => `<option value="${a.id}">#${a.numero} ${a.fecha} — ${a.glosa.slice(0,45)}</option>`).join('')}
            </select>
        </div>
    </div>`;
}

function _recRowAsiento(a) {
    const monto = _recMontoAsientoBanco(a);
    const mono  = "font-family:'JetBrains Mono','Courier New',monospace;";
    const fmtM  = n => (n < 0 ? '-$' : '$') + fmt(Math.abs(n));
    return `
    <div style="padding:10px 14px;border-bottom:1px solid var(--divider);">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
            <div style="flex:1;min-width:0;">
                <div style="font-size:11px;color:var(--text-muted);">${a.fecha} &nbsp;·&nbsp; #${a.numero}</div>
                <div style="font-size:12px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${a.glosa}">${a.glosa}</div>
            </div>
            <div style="font-weight:700;font-size:13px;${mono};color:${monto>=0?'var(--positive)':'var(--negative)'};">${fmtM(monto)}</div>
        </div>
    </div>`;
}

// ── Importación de archivo ────────────────────────────────────

function recOnDrop(e) {
    e.preventDefault();
    document.getElementById('recDropZone').style.borderColor = 'var(--divider)';
    const file = e.dataTransfer?.files?.[0];
    if (file) _recProcesarArchivo(file);
}

function recOnFile(input) {
    const file = input.files?.[0];
    if (file) _recProcesarArchivo(file);
    input.value = '';
}

async function _recProcesarArchivo(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    let filas = [];

    try {
        if (ext === 'csv') {
            const texto = await file.text();
            filas = _recParsearCSV(texto);
        } else {
            // Excel via SheetJS
            const buf  = await file.arrayBuffer();
            const wb   = XLSX.read(buf, { type: 'array', cellDates: true });
            const ws   = wb.Sheets[wb.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
            filas = data.map(row => row.map(c => String(c ?? '').trim()));
        }
    } catch(e) {
        mostrarToast('Error leyendo el archivo: ' + e.message, 'error');
        return;
    }

    if (filas.length < 2) { mostrarToast('El archivo está vacío o no tiene datos.', 'error'); return; }

    // Detectar formato
    const cabeceras = filas[0].map(c => c.toLowerCase().trim());
    const formato   = _recDetectarFormato(cabeceras);

    if (formato) {
        _recAplicarFormato(filas, formato);
    } else {
        // Mostrar mapeador manual
        _recMostrarMapeoManual(filas);
    }
}

function _recParsearCSV(texto) {
    // Soporta separadores ; y ,
    const sep = texto.includes(';') ? ';' : ',';
    return texto.split('\n')
        .map(l => l.trim())
        .filter(Boolean)
        .map(l => l.split(sep).map(c => c.trim().replace(/^"|"$/g, '')));
}

function _recDetectarFormato(cabeceras) {
    for (const f of REC_FORMATOS) {
        const coincide = f.cabeceras.every(c => cabeceras.some(h => h.includes(c)));
        if (coincide) return f;
    }
    return null;
}

function _recAplicarFormato(filas, formato) {
    const cabeceras = filas[0].map(c => c.toLowerCase().trim());
    const idx = key => cabeceras.findIndex(h => h.includes(key));

    const iF = idx(formato.mapeo.fecha);
    const iD = idx(formato.mapeo.desc);
    const iC = formato.mapeo.cargo ? idx(formato.mapeo.cargo) : -1;
    const iA = formato.mapeo.abono ? idx(formato.mapeo.abono) : -1;

    const txs = [];
    filas.slice(1).forEach((row, i) => {
        if (row.every(c => !c)) return; // fila vacía
        const fechaRaw = row[iF] || '';
        const fecha    = _recNormalizarFecha(fechaRaw);
        if (!fecha) return; // fila no es transacción

        let cargo = 0, abono = 0;
        if (formato.montoSignado && iA >= 0) {
            const monto = _recParseNum(row[iA]);
            if (monto < 0) cargo = Math.abs(monto);
            else abono = monto;
        } else {
            if (iC >= 0) cargo = _recParseNum(row[iC]);
            if (iA >= 0) abono = _recParseNum(row[iA]);
        }

        txs.push({
            _id:         `tx_${i}`,
            fecha,
            descripcion: (row[iD] || '').slice(0, 120),
            cargo,
            abono,
        });
    });

    if (!txs.length) { mostrarToast('No se encontraron transacciones válidas en el archivo.', 'error'); return; }

    _recState.transacciones = txs;
    _recState.conciliados   = {};
    _recState.mapeo         = formato.nombre;
    _recGuardar();

    mostrarToast(`${txs.length} movimientos importados (${formato.nombre}).`, 'ok');
    renderReconciliacion();

    // Auto-conciliar al importar
    recAutoMatch(false);
}

function _recMostrarMapeoManual(filas) {
    const cabeceras = filas[0];
    const opciones  = cabeceras.map((c, i) => `<option value="${i}">${c || 'Columna ' + (i+1)}</option>`).join('');
    const sel       = (lbl, id) => `
        <div style="display:flex;flex-direction:column;gap:3px;">
            <label style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;">${lbl}</label>
            <select id="${id}" style="padding:6px 8px;border:1px solid var(--divider);border-radius:6px;background:var(--input-bg);color:var(--text);font-size:12px;">
                <option value="">— No usar —</option>${opciones}
            </select>
        </div>`;

    const box = document.getElementById('recMapeoManual');
    if (!box) return;
    box.style.display = 'block';
    box.innerHTML = `
    <div class="card" style="padding:16px;">
        <div style="font-weight:700;font-size:13px;margin-bottom:12px;color:var(--text);">Formato no reconocido — mapea las columnas manualmente</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-bottom:14px;">
            ${sel('Fecha', 'recMapFecha')}
            ${sel('Descripción', 'recMapDesc')}
            ${sel('Cargo / Débito', 'recMapCargo')}
            ${sel('Abono / Crédito', 'recMapAbono')}
        </div>
        <button class="btn" onclick="recAplicarMapeoManual(${JSON.stringify(filas).replace(/</g,'&lt;')})">Importar con este mapeo</button>
    </div>`;

    // Pre-seleccionar por heurística
    const cab = cabeceras.map(c => c.toLowerCase());
    const presel = (id, palabras) => {
        const idx = cab.findIndex(c => palabras.some(p => c.includes(p)));
        if (idx >= 0) document.getElementById(id).value = idx;
    };
    setTimeout(() => {
        presel('recMapFecha',  ['fecha', 'date']);
        presel('recMapDesc',   ['desc', 'glosa', 'detalle', 'concepto']);
        presel('recMapCargo',  ['cargo', 'debito', 'debe', 'egreso']);
        presel('recMapAbono',  ['abono', 'credito', 'haber', 'ingreso']);
    }, 0);
}

function recAplicarMapeoManual(filas) {
    const iF = parseInt(document.getElementById('recMapFecha')?.value ?? -1);
    const iD = parseInt(document.getElementById('recMapDesc')?.value  ?? -1);
    const iC = parseInt(document.getElementById('recMapCargo')?.value ?? -1);
    const iA = parseInt(document.getElementById('recMapAbono')?.value ?? -1);

    if (isNaN(iF) || iF < 0) { mostrarToast('Selecciona la columna de fecha.', 'error'); return; }

    const txs = [];
    filas.slice(1).forEach((row, i) => {
        if (row.every(c => !c)) return;
        const fecha = _recNormalizarFecha(row[iF] || '');
        if (!fecha) return;
        txs.push({
            _id:         `tx_${i}`,
            fecha,
            descripcion: iD >= 0 ? (row[iD] || '').slice(0,120) : '',
            cargo:       iC >= 0 ? _recParseNum(row[iC]) : 0,
            abono:       iA >= 0 ? _recParseNum(row[iA]) : 0,
        });
    });

    if (!txs.length) { mostrarToast('No se encontraron transacciones.', 'error'); return; }
    _recState.transacciones = txs;
    _recState.conciliados   = {};
    _recState.mapeo         = 'Manual';
    _recGuardar();
    mostrarToast(`${txs.length} movimientos importados.`, 'ok');
    renderReconciliacion();
    recAutoMatch(false);
}

// ── Auto-match ────────────────────────────────────────────────

function recAutoMatch(mostrarMsg = true) {
    const txs      = _recState.transacciones;
    const asientos = _recAsientosDelPeriodo();
    const usados   = new Set(Object.values(_recState.conciliados));
    let nuevos     = 0;

    txs.forEach(t => {
        if (_recState.conciliados[t._id] != null) return; // ya ligado
        const candidatos = asientos.filter(a => !usados.has(a.id));
        const match      = _recSugerirAsiento(t, candidatos);
        if (match && _recMontosCoinciden(t, match)) {
            _recState.conciliados[t._id] = match.id;
            usados.add(match.id);
            nuevos++;
        }
    });

    _recGuardar();
    if (mostrarMsg) mostrarToast(`Auto-conciliación: ${nuevos} nuevas coincidencias.`, 'ok');
    renderReconciliacion();
}

function _recSugerirAsiento(tx, candidatos) {
    // Buscar por monto exacto primero, luego por fecha ±1 día
    const montoTx = tx.abono > 0 ? tx.abono : tx.cargo;
    const fechaTx = _recFechaDate(tx.fecha);

    let mejor = null, mejorScore = -1;
    for (const a of candidatos) {
        const montoA  = Math.abs(_recMontoAsientoBanco(a));
        const fechaA  = _recFechaDate(a.fecha);
        const diffMs  = fechaTx && fechaA ? Math.abs(fechaTx - fechaA) : Infinity;
        const diffDias = diffMs / 86400000;

        if (Math.abs(montoTx - montoA) > 1) continue; // monto no coincide
        if (diffDias > 3) continue; // fecha muy alejada

        const score = 10 - diffDias; // más puntos si la fecha es más cercana
        if (score > mejorScore) { mejorScore = score; mejor = a; }
    }
    return mejor;
}

function _recMontosCoinciden(tx, asiento) {
    const montoTx = tx.abono > 0 ? tx.abono : tx.cargo;
    return Math.abs(montoTx - Math.abs(_recMontoAsientoBanco(asiento))) <= 1;
}

// ── Acciones de conciliación ──────────────────────────────────

function recLigar(idTx, idAsiento) {
    _recState.conciliados[idTx] = idAsiento;
    _recGuardar();
    renderReconciliacion();
}

function recDesligar(idTx) {
    delete _recState.conciliados[idTx];
    _recGuardar();
    renderReconciliacion();
}

function recCambiarPeriodo(val) {
    _recState.periodo = val;
    _recState.conciliados = {};
    _recGuardar();
    renderReconciliacion();
}

function recCambiarCuenta(val) {
    _recState.cuentaBanco = val;
    _recState.conciliados = {};
    _recGuardar();
    renderReconciliacion();
}

function recActualizarSaldo(val) {
    const num = _recParseNum(val);
    _recState.saldoExtracto = num || null;
    _recGuardar();
    // Solo actualizar el resumen sin re-renderizar todo
    const dif = document.querySelector('#rec-root [style*="diferencia"]');
    // Re-render lightweight: solo el bloque de saldos
    const saldoLibros = _recSaldoLibros(_recAsientosDelPeriodo());
    if (num) {
        const diferencia = num - saldoLibros;
        // Actualizar sin re-render completo
        renderReconciliacion();
    }
}

function recNuevaPeriodo() {
    if (!confirm('¿Limpiar los datos actuales e iniciar una nueva conciliación?')) return;
    _recState.transacciones = [];
    _recState.conciliados   = {};
    _recState.saldoExtracto = null;
    _recGuardar();
    renderReconciliacion();
}

function recLimpiar() {
    if (!confirm('¿Eliminar todos los movimientos importados y las conciliaciones?')) return;
    _recState.transacciones = [];
    _recState.conciliados   = {};
    _recGuardar();
    renderReconciliacion();
}

// ── Helpers de datos ──────────────────────────────────────────

function _recCuentasBanco() {
    try {
        const plan = JSON.parse(localStorage.getItem('core_plan_cuentas') || '{}');
        const bancarias = Object.keys(plan).filter(c => {
            const info = plan[c];
            return info?.tipo === 'Activo' &&
                /banco|cuenta corriente|cta\.?\s*cte|cuenta\s*vista/i.test(c);
        });
        if (!bancarias.length) return ['Banco'];
        return bancarias;
    } catch { return ['Banco']; }
}

function _recAsientosDelPeriodo() {
    try {
        const asientos = JSON.parse(localStorage.getItem('core_asientos') || '[]');
        if (!_recState.periodo) return asientos;

        const [anio, mes] = _recState.periodo.split('-').map(Number);
        const cuenta = _recState.cuentaBanco;

        return asientos.filter(a => {
            // Filtrar por período (fecha DD/MM/YYYY)
            const partes = (a.fecha || '').split('/');
            if (partes.length < 3) return false;
            const aAnio = parseInt(partes[2]);
            const aMes  = parseInt(partes[1]);
            if (aAnio !== anio || aMes !== mes) return false;
            // Filtrar: debe tener al menos un movimiento que toque la cuenta banco
            return (a.movimientos || []).some(m => _cuentaEsBanco(m.cuenta, cuenta));
        });
    } catch { return []; }
}

function _cuentaEsBanco(nombreMovimiento, cuentaSeleccionada) {
    if (!nombreMovimiento) return false;
    if (cuentaSeleccionada && cuentaSeleccionada !== 'Banco') {
        return nombreMovimiento.toLowerCase() === cuentaSeleccionada.toLowerCase();
    }
    return /banco|cuenta corriente|cta\.?\s*cte|cuenta\s*vista/i.test(nombreMovimiento);
}

function _recMontoAsientoBanco(asiento) {
    const cuenta = _recState.cuentaBanco;
    let total = 0;
    (asiento.movimientos || []).forEach(m => {
        if (_cuentaEsBanco(m.cuenta, cuenta)) {
            total += (m.debe || 0) - (m.haber || 0);
        }
    });
    return total;
}

function _recSaldoLibros(asientos) {
    return asientos.reduce((sum, a) => sum + _recMontoAsientoBanco(a), 0);
}

function _recNormalizarFecha(raw) {
    if (!raw) return null;
    raw = String(raw).trim().replace(/\./g, '/');

    // DD/MM/YYYY o D/M/YYYY
    let m = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (m) {
        const anio = m[3].length === 2 ? '20' + m[3] : m[3];
        return `${m[1].padStart(2,'0')}/${m[2].padStart(2,'0')}/${anio}`;
    }

    // YYYY-MM-DD
    m = raw.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (m) return `${m[3].padStart(2,'0')}/${m[2].padStart(2,'0')}/${m[1]}`;

    // Fecha Excel (número de serie)
    const n = parseFloat(raw);
    if (!isNaN(n) && n > 40000 && n < 60000) {
        const d = new Date((n - 25569) * 86400 * 1000);
        return `${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}/${d.getUTCFullYear()}`;
    }

    return null;
}

function _recFechaDate(str) {
    if (!str) return null;
    const p = str.split('/');
    if (p.length < 3) return null;
    return new Date(`${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`);
}

function _recParseNum(val) {
    if (val == null) return 0;
    const s = String(val).trim()
        .replace(/[$\s]/g, '')
        .replace(/\./g, '')
        .replace(',', '.');
    return parseFloat(s) || 0;
}

// ── Exports ───────────────────────────────────────────────────

window.renderReconciliacion    = renderReconciliacion;
window.recOnDrop               = recOnDrop;
window.recOnFile               = recOnFile;
window.recAplicarMapeoManual   = recAplicarMapeoManual;
window.recAutoMatch            = recAutoMatch;
window.recLigar                = recLigar;
window.recDesligar             = recDesligar;
window.recCambiarPeriodo       = recCambiarPeriodo;
window.recCambiarCuenta        = recCambiarCuenta;
window.recActualizarSaldo      = recActualizarSaldo;
window.recNuevaPeriodo         = recNuevaPeriodo;
window.recLimpiar              = recLimpiar;
