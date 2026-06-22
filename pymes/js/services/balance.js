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
            const cuentas = recopilarMovimientosPorCuenta();

            let tDebe = 0, tHaber = 0, tDeudor = 0, tAcreedor = 0;
            let tActivo = 0, tPasivo = 0, tPerdida = 0, tGanancia = 0;

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

                    // Estilo para valores anómalos (saldo contrario a la naturaleza)
                    const estAnomalo = esAnomalio
                        ? 'color:#dc2626;font-weight:600;'
                        : '';
                    const fmtCol = (val) => {
                        if (val === 0) return '<span style="color:#94a3b8;">-</span>';
                        const neg = val < 0;
                        const txt = new Intl.NumberFormat('es-CL').format(Math.round(Math.abs(val)));
                        return `<span style="${neg ? 'color:#dc2626;font-weight:600;' : ''}">${neg ? '(' : ''}${txt}${neg ? ')' : ''}</span>`;
                    };

                    tbody.innerHTML += `<tr${esAnomalio ? ' class="balance-row-anomalo"' : ''}>
                        <td style="font-weight:600;${esAnomalio ? 'color:#dc2626;' : ''}">${cName}${esAnomalio ? ' ⚠' : ''}</td>
                        <td class="monto">${fmt(c.debe)}</td>
                        <td class="monto">${fmt(c.haber)}</td>
                        <td class="monto" style="color:#1d4ed8;">${fmt(sDeudor)}</td>
                        <td class="monto" style="color:#1d4ed8;">${fmt(sAcreedor)}</td>
                        <td class="monto">${fmtCol(activo)}</td>
                        <td class="monto">${fmtCol(pasivo)}</td>
                        <td class="monto">${fmtCol(perdida)}</td>
                        <td class="monto">${fmtCol(ganancia)}</td>
                    </tr>`;
                });

            document.getElementById("balanceTotalesRow").innerHTML = `
                <td>SUBTOTALES</td>
                <td class="monto">${fmt(tDebe)}</td><td class="monto">${fmt(tHaber)}</td>
                <td class="monto">${fmt(tDeudor)}</td><td class="monto">${fmt(tAcreedor)}</td>
                <td class="monto">${fmt(tActivo)}</td><td class="monto">${fmt(tPasivo)}</td>
                <td class="monto">${fmt(tPerdida)}</td><td class="monto">${fmt(tGanancia)}</td>
            `;

            // Resultado del ejercicio (cuadratura)
            const difInventario = tActivo - tPasivo;
            const difResultado  = tGanancia - tPerdida;

            const rActivo   = difInventario < 0 ? Math.abs(difInventario) : 0;
            const rPasivo   = difInventario > 0 ? difInventario : 0;
            const rPerdida  = difResultado  > 0 ? difResultado  : 0;
            const rGanancia = difResultado  < 0 ? Math.abs(difResultado)  : 0;

            document.getElementById("balanceResultadoRow").innerHTML = `
                <td>UTILIDAD / PÉRDIDA DEL EJERCICIO</td>
                <td></td><td></td><td></td><td></td>
                <td class="monto">${fmt(rActivo)}</td><td class="monto">${fmt(rPasivo)}</td>
                <td class="monto">${fmt(rPerdida)}</td><td class="monto">${fmt(rGanancia)}</td>
            `;

            document.getElementById("balanceFinalRow").innerHTML = `
                <td>TOTALES IGUALES</td>
                <td></td><td></td><td></td><td></td>
                <td class="monto">${fmt(tActivo + rActivo)}</td><td class="monto">${fmt(tPasivo + rPasivo)}</td>
                <td class="monto">${fmt(tPerdida + rPerdida)}</td><td class="monto">${fmt(tGanancia + rGanancia)}</td>
            `;
        }
