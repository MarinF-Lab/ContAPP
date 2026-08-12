        // Calcula las filas y totales del balance de 8 columnas — sin nada de
        // HTML/formato de texto, solo números reales. La usa tanto
        // generarBalanceGeneral() (para pintar la tabla) como
        // exportarExcelBalance() (js/services/exportar.js) para armar el
        // Excel con celdas numéricas de verdad en vez de leer el texto ya
        // formateado del DOM (evita duplicar esta lógica en dos lugares).
        // El mes/año se leen acá adentro, del toolbar (#selBalanceMes/
        // #selBalanceAnio, ver index.html) — no como parámetro — para que
        // tanto la pantalla como el Excel exportado queden siempre
        // sincronizados con el período elegido, sin tener que pasárselo entre
        // funciones. El balance queda "acumulado a fin de ese mes" (no solo
        // los movimientos de ese mes) porque un balance es una foto del saldo
        // en un momento dado, no una lista de transacciones del período.
        function _calcularBalance() {
            const mes  = parseInt(document.getElementById('selBalanceMes')?.value)  || (new Date().getMonth() + 1);
            const anio = parseInt(document.getElementById('selBalanceAnio')?.value) || new Date().getFullYear();
            const cuentas = recopilarMovimientosPorCuenta(_finDeMesOrdenable(mes, anio));

            let tDebe = 0, tHaber = 0, tDeudor = 0, tAcreedor = 0;
            let tActivo = 0, tPasivo = 0, tPerdida = 0, tGanancia = 0;
            const filas = [];

            Object.keys(cuentas)
                .sort((a, b) => {
                    const oa = obtenerOrdenCuenta(a);
                    const ob = obtenerOrdenCuenta(b);
                    return oa !== ob ? oa - ob : a.localeCompare(b);
                })
                .forEach(cName => {
                    const c    = cuentas[cName];
                    const tipo = (PLAN_CUENTAS?.[cName] ?? ESQUEMA_CUENTAS[cName])?.tipo ?? 'Activo';

                    // Saldos del mayor (siempre positivos)
                    const sDeudor   = c.debe > c.haber ? c.debe - c.haber : 0;
                    const sAcreedor = c.haber > c.debe ? c.haber - c.debe : 0;

                    // Saldo neto con signo: positivo = deudor, negativo = acreedor
                    const sNeto = c.debe - c.haber;

                    // ── Asignación de columnas según TIPO de cuenta ──────
                    // La columna se determina por la naturaleza contable del tipo,
                    // NO por el saldo actual. Un Activo con saldo acreedor sigue
                    // en la columna Activo (con valor negativo = anomalía).
                    let activo = 0, pasivo = 0, perdida = 0, ganancia = 0;
                    let esAnomalio = false;

                    switch (tipo) {
                        case 'Activo':
                            activo     = sNeto;
                            esAnomalio = sNeto < 0;
                            break;
                        case 'Pasivo':
                            pasivo     = -sNeto; // positivo cuando haber > debe (normal)
                            esAnomalio = sNeto > 0;
                            break;
                        case 'Patrimonio':
                            pasivo     = -sNeto;
                            esAnomalio = sNeto > 0;
                            break;
                        case 'Pérdida':
                            perdida    = sNeto;
                            esAnomalio = sNeto < 0;
                            break;
                        case 'Ganancia':
                            ganancia   = -sNeto;
                            esAnomalio = sNeto > 0;
                            break;
                        // Contra Activo: saldo natural Haber → reduce el Activo (negativo en col. Activo)
                        case 'Contra Activo':
                            activo = sNeto; // sNeto < 0 cuando haber acumula normalmente
                            break;
                        // Contra Pasivo/Patrimonio: saldo natural Debe → reduce col. Pasivo (negativo)
                        case 'Contra Pasivo':
                            pasivo = -sNeto;
                            break;
                        case 'Contra Patrimonio':
                            pasivo = -sNeto;
                            break;
                    }

                    tDebe     += c.debe;    tHaber    += c.haber;
                    tDeudor   += sDeudor;   tAcreedor += sAcreedor;
                    tActivo   += activo;    tPasivo   += pasivo;
                    tPerdida  += perdida;   tGanancia += ganancia;

                    filas.push({
                        cuenta: cName, debe: c.debe, haber: c.haber,
                        deudor: sDeudor, acreedor: sAcreedor,
                        activo, pasivo, perdida, ganancia, esAnomalio,
                    });
                });

            // Resultado del ejercicio (cuadratura)
            const difInventario = tActivo - tPasivo;
            const difResultado  = tGanancia - tPerdida;

            const rActivo   = difInventario < 0 ? Math.abs(difInventario) : 0;
            const rPasivo   = difInventario > 0 ? difInventario : 0;
            const rPerdida  = difResultado  > 0 ? difResultado  : 0;
            const rGanancia = difResultado  < 0 ? Math.abs(difResultado)  : 0;

            return {
                filas,
                subtotales:     { debe: tDebe, haber: tHaber, deudor: tDeudor, acreedor: tAcreedor, activo: tActivo, pasivo: tPasivo, perdida: tPerdida, ganancia: tGanancia },
                resultado:      { activo: rActivo, pasivo: rPasivo, perdida: rPerdida, ganancia: rGanancia },
                totalesIguales: { activo: tActivo + rActivo, pasivo: tPasivo + rPasivo, perdida: tPerdida + rPerdida, ganancia: tGanancia + rGanancia },
            };
        }
        window._calcularBalance = _calcularBalance;

        function generarBalanceGeneral() {
            // ── Alertas de consistencia ───────────────────────────────
            const alertas = (typeof validarConsistenciaContable === 'function')
                ? validarConsistenciaContable()
                : [];

            const divAlertas = document.getElementById('balanceAlertas');
            if (divAlertas) {
                if (alertas.length === 0) {
                    divAlertas.style.display = 'none';
                    divAlertas.innerHTML = '';
                } else {
                    const items = alertas.map(a => {
                        const isError = a.nivel === 'error';
                        const bg    = isError ? '#fef2f2' : '#fffbeb';
                        const bdr   = isError ? '#fca5a5' : '#fcd34d';
                        const icon  = isError ? '⛔' : '⚠️';
                        const title = isError ? '#991b1b' : '#92400e';
                        return `<div style="background:${bg};border:1px solid ${bdr};border-radius:8px;padding:10px 14px;margin-bottom:6px;">
                            <div style="font-weight:700;color:${title};margin-bottom:3px;">${icon} ${a.cuenta}</div>
                            <div style="font-size:13px;color:#374151;">${a.mensaje}</div>
                            <div style="font-size:12px;color:#6b7280;margin-top:4px;">💡 ${a.sugerencia}</div>
                        </div>`;
                    }).join('');
                    divAlertas.innerHTML = `<div style="font-weight:700;font-size:14px;margin-bottom:8px;color:#374151;">
                        Inconsistencias detectadas (${alertas.length})</div>${items}`;
                    divAlertas.style.display = 'block';
                }
            }

            // ── Renderizado de la tabla ───────────────────────────────
            const tbody = document.getElementById("balanceBody");
            tbody.innerHTML = "";

            // Estado vacío — sin ningún asiento en todo el historial
            if (!dbAsientos || dbAsientos.length === 0) {
                tbody.innerHTML = `<tr><td colspan="9">
                    <div class="empty-state" style="text-align:center;padding:40px 20px;">
                        <div style="font-size:40px;margin-bottom:12px;">📒</div>
                        <h3 style="margin:0 0 8px;">Sin movimientos registrados</h3>
                        <p style="color:var(--text-muted);margin:0 0 16px;">El balance se genera automáticamente desde el Libro Diario.</p>
                        <button class="btn btn-primary" onclick="navegar('diario', null)">Ir al Libro Diario</button>
                    </div>
                </td></tr>`;
                return;
            }

            const { filas, subtotales, resultado, totalesIguales } = _calcularBalance();

            // Estado vacío — hay historial, pero nada acumulado hasta el
            // período elegido (ej. se seleccionó un mes anterior al primer
            // asiento registrado).
            if (filas.length === 0) {
                tbody.innerHTML = `<tr><td colspan="9">
                    <div class="empty-state" style="text-align:center;padding:40px 20px;">
                        <div style="font-size:40px;margin-bottom:12px;">📅</div>
                        <h3 style="margin:0 0 8px;">Sin movimientos hasta el período seleccionado</h3>
                        <p style="color:var(--text-muted);margin:0;">Probá con otro mes o año.</p>
                    </div>
                </td></tr>`;
                document.getElementById("balanceTotalesRow").innerHTML = '';
                document.getElementById("balanceResultadoRow").innerHTML = '';
                document.getElementById("balanceFinalRow").innerHTML = '';
                return;
            }

            const fmtCol = (val) => {
                if (val === 0) return '<span style="color:#94a3b8;">-</span>';
                const neg = val < 0;
                const txt = new Intl.NumberFormat('es-CL').format(Math.round(Math.abs(val)));
                return `<span style="${neg ? 'color:#dc2626;font-weight:600;' : ''}">${neg ? '(' : ''}${txt}${neg ? ')' : ''}</span>`;
            };

            filas.forEach(f => {
                tbody.innerHTML += `<tr${f.esAnomalio ? ' class="balance-row-anomalo"' : ''} style="cursor:pointer;" onclick="mayorIrACuenta('${f.cuenta.replace(/'/g, "\\'")}')" title="Ver en el Libro Mayor">
                    <td style="font-weight:600;${f.esAnomalio ? 'color:#dc2626;' : ''}">${f.cuenta}${f.esAnomalio ? ' ⚠' : ''}</td>
                    <td class="monto">${fmt(f.debe)}</td>
                    <td class="monto">${fmt(f.haber)}</td>
                    <td class="monto" style="color:#1d4ed8;">${fmt(f.deudor)}</td>
                    <td class="monto" style="color:#1d4ed8;">${fmt(f.acreedor)}</td>
                    <td class="monto">${fmtCol(f.activo)}</td>
                    <td class="monto">${fmtCol(f.pasivo)}</td>
                    <td class="monto">${fmtCol(f.perdida)}</td>
                    <td class="monto">${fmtCol(f.ganancia)}</td>
                </tr>`;
            });

            document.getElementById("balanceTotalesRow").innerHTML = `
                <td>SUBTOTALES</td>
                <td class="monto">${fmt(subtotales.debe)}</td><td class="monto">${fmt(subtotales.haber)}</td>
                <td class="monto">${fmt(subtotales.deudor)}</td><td class="monto">${fmt(subtotales.acreedor)}</td>
                <td class="monto">${fmt(subtotales.activo)}</td><td class="monto">${fmt(subtotales.pasivo)}</td>
                <td class="monto">${fmt(subtotales.perdida)}</td><td class="monto">${fmt(subtotales.ganancia)}</td>
            `;

            document.getElementById("balanceResultadoRow").innerHTML = `
                <td>UTILIDAD / PÉRDIDA DEL EJERCICIO</td>
                <td></td><td></td><td></td><td></td>
                <td class="monto">${fmt(resultado.activo)}</td><td class="monto">${fmt(resultado.pasivo)}</td>
                <td class="monto">${fmt(resultado.perdida)}</td><td class="monto">${fmt(resultado.ganancia)}</td>
            `;

            document.getElementById("balanceFinalRow").innerHTML = `
                <td>TOTALES IGUALES</td>
                <td></td><td></td><td></td><td></td>
                <td class="monto">${fmt(totalesIguales.activo)}</td><td class="monto">${fmt(totalesIguales.pasivo)}</td>
                <td class="monto">${fmt(totalesIguales.perdida)}</td><td class="monto">${fmt(totalesIguales.ganancia)}</td>
            `;
        }
