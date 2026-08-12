let _mayorFiltrosCuenta  = '';
// Por defecto arranca en el mes actual (no "Todos los períodos") — el Mayor
// debe mostrarse mes a mes salvo que el usuario elija explícitamente ver el
// total acumulado con la opción "Todos los períodos".
let _mayorFiltrosPeriodo = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
})();

// Filtro especial activado por "🔗 Relacionadas": en vez de una sola cuenta,
// restringe la vista a la lista exacta de cuentas que intervienen en un
// asiento puntual. Tiene prioridad sobre _mayorFiltrosCuenta mientras esté
// activo; se limpia al usar los selects normales o el botón "Quitar filtro".
let _mayorCuentasIntervinientes = null;
let _mayorAsientoIntervinienteNumero = null;

// Popover de detalle (singleton, ver #mayorDetallePopover en index.html):
// guarda el id del asiento actualmente mostrado en el popover.
let _mayorDetalleAbiertoId = null;

function _mayorGetPeriodos(cuentas) {
    const set = new Set();
    Object.values(cuentas).forEach(c =>
        c.historial.forEach(h => {
            // h.fecha viene en DD/MM/YYYY — convertir a YYYY-MM ordenable antes
            // de derivar el período (slice directo sobre DD/MM/YYYY da basura).
            const fo = _fechaAsientoOrdenable(h.fecha);
            if (fo) set.add(fo.slice(0, 7));
        })
    );
    // El mes actual siempre debe poder elegirse, aunque todavía no tenga
    // movimientos registrados (es el default del selector).
    const d = new Date();
    set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    return [...set].sort().reverse();
}

function _mayorRenderToolbar(cuentas) {
    const nombres   = Object.keys(cuentas).sort();
    const periodos  = _mayorGetPeriodos(cuentas);

    const opCuentas  = `<option value="">Todas las cuentas</option>` +
        nombres.map(n => `<option value="${n}" ${_mayorFiltrosCuenta === n ? 'selected' : ''}>${n}</option>`).join('');

    const opPeriodos = `<option value="">Todos los períodos</option>` +
        periodos.map(p => `<option value="${p}" ${_mayorFiltrosPeriodo === p ? 'selected' : ''}>${p}</option>`).join('');

    const avisoRelacionadas = _mayorCuentasIntervinientes ? `
        <div style="display:flex;align-items:center;gap:8px;background:var(--info-soft,#e3e9fe);color:var(--info,#587FFC);padding:6px 12px;border-radius:6px;font-size:12.5px;font-weight:600;">
            🔗 Mostrando solo las cuentas del asiento N° ${_mayorAsientoIntervinienteNumero ?? ''}
            <button class="btn btn-secondary" style="padding:3px 9px;font-size:11.5px;" onclick="mayorQuitarFiltroCuentas()">✕ Quitar filtro</button>
        </div>` : '';

    return `<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:16px;grid-column:1/-1;">
        <select id="selMayorCuenta" onchange="_mayorAplicarFiltro()" style="padding:7px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;background:var(--input-bg);color:var(--text);">
            ${opCuentas}
        </select>
        <select id="selMayorPeriodo" onchange="_mayorAplicarFiltro()" style="padding:7px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;background:var(--input-bg);color:var(--text);">
            ${opPeriodos}
        </select>
        ${avisoRelacionadas}
    </div>`;
}

function _mayorAplicarFiltro() {
    _mayorFiltrosCuenta  = document.getElementById('selMayorCuenta')?.value  || '';
    _mayorFiltrosPeriodo = document.getElementById('selMayorPeriodo')?.value || '';
    // Un cambio manual en los selects reemplaza cualquier filtro de "cuentas relacionadas".
    _mayorCuentasIntervinientes = null;
    _mayorAsientoIntervinienteNumero = null;
    generarLibroMayor();
}
window._mayorAplicarFiltro = _mayorAplicarFiltro;

// Cuentas + historial ya filtrados por _mayorFiltrosCuenta/_mayorFiltrosPeriodo/
// _mayorCuentasIntervinientes — mismo criterio que generarLibroMayor() usaba
// inline, extraído para reusarlo también en exportarPDFMayor()
// (js/services/exportar.js) sin duplicar el filtro.
function _datosMayorFiltrado() {
    const cuentas = recopilarMovimientosPorCuenta();

    const listaFiltrada = Object.keys(cuentas)
        .filter(n => {
            if (_mayorCuentasIntervinientes) return _mayorCuentasIntervinientes.includes(n);
            return !_mayorFiltrosCuenta || n === _mayorFiltrosCuenta;
        })
        .sort((a, b) => {
            const oa = Number((PLAN_CUENTAS?.[a] ?? ESQUEMA_CUENTAS[a])?.orden ?? 9999);
            const ob = Number((PLAN_CUENTAS?.[b] ?? ESQUEMA_CUENTAS[b])?.orden ?? 9999);
            return oa - ob;
        });

    return listaFiltrada
        .map(cName => {
            const c = cuentas[cName];
            let historialFiltrado = c.historial;
            if (_mayorFiltrosPeriodo) {
                historialFiltrado = c.historial.filter(h => _fechaAsientoOrdenable(h.fecha).slice(0, 7) === _mayorFiltrosPeriodo);
            }
            const debe  = historialFiltrado.reduce((s, h) => s + (h.debe  || 0), 0);
            const haber = historialFiltrado.reduce((s, h) => s + (h.haber || 0), 0);
            return {
                cuenta: cName,
                tipo: (PLAN_CUENTAS && PLAN_CUENTAS[cName]?.tipo) || ESQUEMA_CUENTAS[cName]?.tipo || 'Activo',
                historial: historialFiltrado,
                debe, haber,
                saldoFinal: debe - haber,
            };
        })
        .filter(c => c.historial.length);
}
window._datosMayorFiltrado = _datosMayorFiltrado;

function generarLibroMayor() {
    const contenedor = document.getElementById('contenedorMayor');
    contenedor.innerHTML = '';

    const cuentas = recopilarMovimientosPorCuenta();
    contenedor.innerHTML = _mayorRenderToolbar(cuentas);

    const cuentasFiltradas = _datosMayorFiltrado();

    if (!cuentasFiltradas.length) {
        contenedor.innerHTML += `<div class="card" style="text-align:center;padding:40px;color:var(--text-muted);">Sin movimientos para los filtros seleccionados.</div>`;
        return;
    }

    cuentasFiltradas.forEach(c => {
        let filas = '';

        c.historial.forEach(h => {
            filas += `<tr style="cursor:pointer;" onclick="mayorAbrirDetalle(${h.id}, this)" title="Ver detalle del asiento">
                <td style="font-size:12px;color:var(--text-muted);">${h.numero || '—'}</td>
                <td style="font-size:12px;">${h.fecha || ''}</td>
                <td class="monto">${h.debe ? fmt(h.debe) : ''}</td>
                <td class="monto">${h.haber ? fmt(h.haber) : ''}</td>
            </tr>`;
        });

        const naturaleza = c.saldoFinal >= 0 ? 'DEUDOR' : 'ACREEDOR';

        contenedor.innerHTML += `<div class="card" data-cuenta="${c.cuenta}">
            <div class="cuenta-t-titulo">
                <span>📖 ${c.cuenta}</span>
                <span>[${c.tipo}]</span>
            </div>
            <table class="cont-table" style="font-size:13px;table-layout:fixed;width:100%;">
                <thead>
                    <tr>
                        <th style="width:52px;">N°</th>
                        <th style="width:96px;">Fecha</th>
                        <th class="monto" style="width:120px;">Debe</th>
                        <th class="monto" style="width:120px;">Haber</th>
                    </tr>
                </thead>
                <tbody>${filas}</tbody>
                <tfoot style="background:var(--table-stripe);font-weight:700;">
                    <tr>
                        <td colspan="3" style="padding:10px 16px;">Saldo: ${naturaleza}</td>
                        <td class="monto" style="color:${c.saldoFinal >= 0 ? 'var(--positive,#166534)' : 'var(--negative,#991b1b)'};">${fmt(Math.abs(c.saldoFinal))}</td>
                    </tr>
                </tfoot>
            </table>
        </div>`;
    });
}

// ─────────────────────────────────────────────────────────────
//  TRAZABILIDAD — Balance → Mayor (resaltar, no aislar), Mayor → detalle
//  anclado a la fila (glosa + cuentas relacionadas + editar), Mayor → Diario.
// ─────────────────────────────────────────────────────────────

// Llamado desde una fila del Balance General: aterriza en el Mayor mostrando
// TODAS las cuentas (sin aislar) y resalta la cuenta de origen para ubicarla
// rápido — navegar('mayor', null) redirige internamente a
// modTab('view-estructura-contable','tab-mayor'), que ya dispara
// generarLibroMayor() de forma síncrona, así que el resaltado se aplica justo después.
function mayorIrACuenta(nombreCuenta) {
    _mayorFiltrosCuenta = '';
    _mayorCuentasIntervinientes = null;
    _mayorAsientoIntervinienteNumero = null;
    navegar('mayor', null);
    _mayorResaltarCuenta(nombreCuenta);
}
window.mayorIrACuenta = mayorIrACuenta;

function _mayorResaltarCuenta(nombreCuenta) {
    const cards = document.querySelectorAll('#contenedorMayor .card[data-cuenta]');
    let objetivo = null;
    cards.forEach(c => { if (c.dataset.cuenta === nombreCuenta) objetivo = c; });
    if (!objetivo) return;
    objetivo.scrollIntoView({ behavior: 'smooth', block: 'center' });
    objetivo.classList.add('mayor-cuenta-resaltada');
    setTimeout(() => objetivo.classList.remove('mayor-cuenta-resaltada'), 2200);
}

// Click en una fila del Mayor: abre un popover anclado a esa fila (no una fila
// nueva, no un modal de pantalla completa) con la glosa del asiento y los
// botones "🔗 Relacionadas"/"✏️ Editar" — la vista normal de la tabla
// (N°/Fecha/Debe/Haber) no cambia ni se desplaza.
function mayorAbrirDetalle(idAsiento, filaEl) {
    const asiento = (window.dbAsientos || []).find(a => a.id === idAsiento);
    if (!asiento) return;

    _mayorDetalleAbiertoId = idAsiento;

    const pop = document.getElementById('mayorDetallePopover');
    document.getElementById('mayorDetalleGlosaTexto').textContent = asiento.glosa || '—';

    const rect  = filaEl.getBoundingClientRect();
    const ancho = Math.min(300, window.innerWidth * 0.9);
    let left = rect.left;
    left = Math.max(16, Math.min(left, window.innerWidth - ancho - 16));
    pop.style.width = ancho + 'px';
    pop.style.left  = left + 'px';
    pop.style.top   = (rect.bottom + 6) + 'px';
    pop.style.display = 'flex';

    // Listener de "click afuera cierra" — se registra una sola vez.
    if (!_mayorPopoverListenerRegistrado) {
        document.addEventListener('click', _mayorClickAfueraPopover, true);
        _mayorPopoverListenerRegistrado = true;
    }
}
window.mayorAbrirDetalle = mayorAbrirDetalle;

let _mayorPopoverListenerRegistrado = false;

function _mayorClickAfueraPopover(e) {
    const pop = document.getElementById('mayorDetallePopover');
    if (!pop || pop.style.display === 'none') return;
    if (pop.contains(e.target)) return; // click dentro del popover
    // Click en la fila que abre el popover se maneja con su propio onclick
    // (reabre/reposiciona); cualquier otro click afuera cierra.
    if (e.target.closest('#contenedorMayor tbody tr')) return;
    mayorCerrarPopoverDetalle();
}

function mayorCerrarPopoverDetalle() {
    const pop = document.getElementById('mayorDetallePopover');
    if (pop) pop.style.display = 'none';
    _mayorDetalleAbiertoId = null;
}
window.mayorCerrarPopoverDetalle = mayorCerrarPopoverDetalle;

// Botón "🔗 Relacionadas" del popover: filtra el Mayor dejando solo las
// cuentas que participan en el asiento actualmente abierto en el popover.
function mayorFiltrarCuentasIntervinientes() {
    const asiento = (window.dbAsientos || []).find(a => a.id === _mayorDetalleAbiertoId);
    if (!asiento) return;
    mayorCerrarPopoverDetalle();
    _mayorFiltrosCuenta = '';
    _mayorCuentasIntervinientes = [...new Set((asiento.movimientos || []).map(m => m.cuenta))];
    _mayorAsientoIntervinienteNumero = asiento.numero || '';
    generarLibroMayor();
}
window.mayorFiltrarCuentasIntervinientes = mayorFiltrarCuentasIntervinientes;

function mayorQuitarFiltroCuentas() {
    _mayorCuentasIntervinientes = null;
    _mayorAsientoIntervinienteNumero = null;
    generarLibroMayor();
}
window.mayorQuitarFiltroCuentas = mayorQuitarFiltroCuentas;

// Botón "✏️ Editar" del popover: salta directo al Libro Diario en modo edición.
function mayorEditarAsiento() {
    const id = _mayorDetalleAbiertoId;
    if (id == null) return;
    mayorCerrarPopoverDetalle();
    modTab('view-estructura-contable', 'tab-diario');
    editarAsiento(id);
}
window.mayorEditarAsiento = mayorEditarAsiento;
