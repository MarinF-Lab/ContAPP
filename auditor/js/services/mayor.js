let _mayorFiltrosCuenta  = '';
let _mayorFiltrosPeriodo = '';

function _mayorGetPeriodos(cuentas) {
    const set = new Set();
    Object.values(cuentas).forEach(c =>
        c.historial.forEach(h => {
            if (h.fecha) set.add(h.fecha.slice(0, 7));
        })
    );
    return [...set].sort().reverse();
}

function _mayorRenderToolbar(cuentas) {
    const nombres   = Object.keys(cuentas).sort();
    const periodos  = _mayorGetPeriodos(cuentas);

    const opCuentas  = `<option value="">Todas las cuentas</option>` +
        nombres.map(n => `<option value="${n}" ${_mayorFiltrosCuenta === n ? 'selected' : ''}>${n}</option>`).join('');

    const opPeriodos = `<option value="">Todos los períodos</option>` +
        periodos.map(p => `<option value="${p}" ${_mayorFiltrosPeriodo === p ? 'selected' : ''}>${p}</option>`).join('');

    return `<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:16px;grid-column:1/-1;">
        <select id="selMayorCuenta" onchange="_mayorAplicarFiltro()" style="padding:7px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;background:var(--input-bg);color:var(--text);">
            ${opCuentas}
        </select>
        <select id="selMayorPeriodo" onchange="_mayorAplicarFiltro()" style="padding:7px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;background:var(--input-bg);color:var(--text);">
            ${opPeriodos}
        </select>
    </div>`;
}

function _mayorAplicarFiltro() {
    _mayorFiltrosCuenta  = document.getElementById('selMayorCuenta')?.value  || '';
    _mayorFiltrosPeriodo = document.getElementById('selMayorPeriodo')?.value || '';
    generarLibroMayor();
}

function generarLibroMayor() {
    const contenedor = document.getElementById('contenedorMayor');
    contenedor.innerHTML = '';

    let cuentas = recopilarMovimientosPorCuenta();

    contenedor.innerHTML = _mayorRenderToolbar(cuentas);

    let listaFiltrada = Object.keys(cuentas)
        .filter(n => !_mayorFiltrosCuenta || n === _mayorFiltrosCuenta)
        .sort((a, b) => {
            const oa = Number((PLAN_CUENTAS?.[a] ?? ESQUEMA_CUENTAS[a])?.orden ?? 9999);
            const ob = Number((PLAN_CUENTAS?.[b] ?? ESQUEMA_CUENTAS[b])?.orden ?? 9999);
            return oa - ob;
        });

    if (!listaFiltrada.length) {
        contenedor.innerHTML += `<div class="card" style="text-align:center;padding:40px;color:var(--text-muted);">Sin movimientos para los filtros seleccionados.</div>`;
        return;
    }

    listaFiltrada.forEach(cName => {
        const c = cuentas[cName];

        let historialFiltrado = c.historial;
        if (_mayorFiltrosPeriodo) {
            historialFiltrado = c.historial.filter(h => (h.fecha || '').startsWith(_mayorFiltrosPeriodo));
        }

        let saldoAcum = 0;
        let filas = '';

        historialFiltrado.forEach(h => {
            saldoAcum += (h.debe || 0) - (h.haber || 0);
            filas += `<tr>
                <td style="font-size:12px;color:var(--text-muted);">${h.numero || '—'}</td>
                <td>${h.fecha || ''}</td>
                <td style="max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;">${h.glosa || ''}</td>
                <td class="monto">${h.debe ? fmt(h.debe) : ''}</td>
                <td class="monto">${h.haber ? fmt(h.haber) : ''}</td>
                <td class="monto" style="font-weight:600;color:${saldoAcum >= 0 ? 'var(--positive,#166534)' : 'var(--negative,#991b1b)'};">${fmt(Math.abs(saldoAcum))}</td>
            </tr>`;
        });

        if (!filas) return;

        const debe  = historialFiltrado.reduce((s, h) => s + (h.debe  || 0), 0);
        const haber = historialFiltrado.reduce((s, h) => s + (h.haber || 0), 0);
        const saldoFinal = debe - haber;

        contenedor.innerHTML += `<div class="card">
            <div class="cuenta-t-titulo">
                <span>📖 ${cName}</span>
                <span>[${(PLAN_CUENTAS && PLAN_CUENTAS[cName]?.tipo) || ESQUEMA_CUENTAS[cName]?.tipo || 'Activo'}]</span>
            </div>
            <table class="cont-table" style="font-size:13px;table-layout:fixed;width:100%;">
                <thead>
                    <tr>
                        <th style="width:52px;">N°</th>
                        <th style="width:96px;">Fecha</th>
                        <th>Glosa</th>
                        <th class="monto" style="width:110px;">Debe</th>
                        <th class="monto" style="width:110px;">Haber</th>
                        <th class="monto" style="width:110px;">Saldo</th>
                    </tr>
                </thead>
                <tbody>${filas}</tbody>
                <tfoot style="background:var(--table-stripe);font-weight:600;">
                    <tr>
                        <td colspan="3" style="padding:10px 16px;">Sumas:</td>
                        <td class="monto">${fmt(debe)}</td>
                        <td class="monto">${fmt(haber)}</td>
                        <td class="monto">${fmt(Math.abs(saldoFinal))}</td>
                    </tr>
                </tfoot>
            </table>
        </div>`;
    });
}

window._mayorAplicarFiltro = _mayorAplicarFiltro;
