function generarLibroMayor() {

const contenedor = document.getElementById("contenedorMayor");
contenedor.innerHTML = "";

let cuentas = recopilarMovimientosPorCuenta();

Object.keys(cuentas)

.sort((a, b) => {
    const oa = Number((PLAN_CUENTAS?.[a] ?? ESQUEMA_CUENTAS[a])?.orden ?? 9999);
    const ob = Number((PLAN_CUENTAS?.[b] ?? ESQUEMA_CUENTAS[b])?.orden ?? 9999);
    return oa - ob;
})

.forEach(cName => {

    let c = cuentas[cName];

    let saldoDeudor = c.debe > c.haber
        ? c.debe - c.haber
        : 0;

    let saldoAcreedor = c.haber > c.debe
        ? c.haber - c.debe
        : 0;

    let filas = "";

    c.historial.forEach(h => {

        filas += `<tr>
            <td>${h.fecha}</td>
            <td class="monto">${fmt(h.debe)}</td>
            <td class="monto">${fmt(h.haber)}</td>
        </tr>`;

    });

    contenedor.innerHTML += `<div class="card">

        <div class="cuenta-t-titulo">
            <span>📖 ${cName}</span>
            <span>[${(PLAN_CUENTAS && PLAN_CUENTAS[cName]?.tipo) || ESQUEMA_CUENTAS[cName]?.tipo || "Activo"}]</span>
        </div>

        <table class="cont-table" style="font-size:13px;">

            <thead>
                <tr>
                    <th>Fecha</th>
                    <th class="monto">Debe</th>
                    <th class="monto">Haber</th>
                </tr>
            </thead>

            <tbody>
                ${filas}
            </tbody>

            <tfoot style="background:#f8fafc;font-weight:600;">

                <tr>
                    <td>Sumas:</td>
                    <td class="monto">${fmt(c.debe)}</td>
                    <td class="monto">${fmt(c.haber)}</td>
                </tr>

                ${
                    saldoDeudor > 0
                    ? `<tr>
                            <td colspan="2">Saldo Deudor</td>
                            <td class="monto">${fmt(saldoDeudor)}</td>
                       </tr>`
                    : saldoAcreedor > 0
                    ? `<tr>
                            <td colspan="2">Saldo Acreedor</td>
                            <td class="monto">${fmt(saldoAcreedor)}</td>
                       </tr>`
                    : `<tr>
                            <td colspan="3" style="text-align:center;">
                                Cuenta Saldada
                            </td>
                       </tr>`
                }

            </tfoot>

        </table>

    </div>`;

});


}


        
