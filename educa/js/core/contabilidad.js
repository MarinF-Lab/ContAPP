        function recopilarMovimientosPorCuenta() {
            const cuentas = {};
            (dbAsientos || []).forEach(as => {
                if (as.estado === 'ANULADO') return;
                (as.movimientos || []).forEach(m => {
                    if (!m.cuenta) return;
                    if (!cuentas[m.cuenta]) cuentas[m.cuenta] = { debe: 0, haber: 0, historial: [] };
                    cuentas[m.cuenta].debe  += (m.debe  || 0);
                    cuentas[m.cuenta].haber += (m.haber || 0);
                    cuentas[m.cuenta].historial.push({ fecha: as.fecha, debe: m.debe || 0, haber: m.haber || 0 });
                });
            });
            return cuentas;
        }

// ─────────────────────────────────────────────────────────────
//  VALIDACIONES CONTABLES — detecta inconsistencias antes del balance
// ─────────────────────────────────────────────────────────────
function validarConsistenciaContable() {
    const alertas = [];
    const cuentas = recopilarMovimientosPorCuenta();

    Object.entries(cuentas).forEach(([nombre, mov]) => {
        const info = (PLAN_CUENTAS?.[nombre]) ?? ESQUEMA_CUENTAS[nombre];
        if (!info) return;

        const saldoDeudor = mov.debe - mov.haber; // positivo = deudor, negativo = acreedor
        const { subgrupo, tipo } = info;

        // Efectivo/Disponible con saldo acreedor: imposible físicamente
        if (subgrupo === 'Disponible' && saldoDeudor < 0) {
            alertas.push({
                nivel: 'error',
                cuenta: nombre,
                mensaje: `"${nombre}" tiene saldo acreedor de $${new Intl.NumberFormat('es-CL').format(Math.round(Math.abs(saldoDeudor)))}. El efectivo no puede ser negativo.`,
                sugerencia: 'Revise los movimientos. Si corresponde a un giro en descubierto, registre un "Préstamo Bancario CP".',
            });
        }

        // Clientes/Deudores con saldo acreedor: sugiere anticipos mal clasificados
        if (subgrupo === 'Clientes' && saldoDeudor < 0) {
            alertas.push({
                nivel: 'warning',
                cuenta: nombre,
                mensaje: `"${nombre}" tiene saldo acreedor de $${new Intl.NumberFormat('es-CL').format(Math.round(Math.abs(saldoDeudor)))}. Las cuentas de clientes normalmente tienen saldo deudor.`,
                sugerencia: 'Considere reclasificar el exceso a "Anticipos de Clientes" en Pasivo Circulante.',
            });
        }
    });

    return alertas;
}
window.validarConsistenciaContable = validarConsistenciaContable;

function obtenerCuentasOrdenadas(cuentas) {
    return Object.keys(cuentas).sort((a, b) => {
        const ordenA = (PLAN_CUENTAS?.[a] ?? ESQUEMA_CUENTAS[a])?.orden ?? 9999;
        const ordenB = (PLAN_CUENTAS?.[b] ?? ESQUEMA_CUENTAS[b])?.orden ?? 9999;
        return ordenA - ordenB;
    });
}