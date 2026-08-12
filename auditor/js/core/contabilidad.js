        // "DD/MM/YYYY" (formato de asiento.fecha en toda la app) -> "YYYY-MM-DD"
        // comparable con strings — mismo día siempre queda con el mismo largo
        // porque f/persistirAsientoDiario ya guarda día y mes con cero a la
        // izquierda.
        function _fechaAsientoOrdenable(fechaDDMMYYYY) {
            const p = (fechaDDMMYYYY || '').split('/');
            return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : '';
        }
        window._fechaAsientoOrdenable = _fechaAsientoOrdenable;

        // Último día calendario de mes/año (reutiliza el truco "día 0 del mes
        // siguiente" que ya usa _ultimoDia() en compras.js) devuelto como
        // "YYYY-MM-DD" — listo para pasarle a recopilarMovimientosPorCuenta()
        // como corte de "balance a fin de [mes]".
        function _finDeMesOrdenable(mes, anio) {
            const ultimoDia = new Date(anio, mes, 0).getDate();
            return `${anio}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;
        }
        window._finDeMesOrdenable = _finDeMesOrdenable;

        // hastaFecha (opcional, "YYYY-MM-DD"): si viene, solo suma asientos con
        // fecha <= hastaFecha — así el Balance puede mostrar el acumulado "a
        // fin de [mes]" sin afectar a los demás llamadores (Mayor, IA de
        // saldos, validación de consistencia, etc.), que siguen viendo el
        // histórico completo al no pasar el parámetro.
        function recopilarMovimientosPorCuenta(hastaFecha) {
            const cuentas = {};
            (dbAsientos || []).forEach(as => {
                if (as.estado === 'ANULADO') return;
                if (hastaFecha && _fechaAsientoOrdenable(as.fecha) > hastaFecha) return;
                (as.movimientos || []).forEach(m => {
                    if (!m.cuenta) return;
                    if (!cuentas[m.cuenta]) cuentas[m.cuenta] = { debe: 0, haber: 0, historial: [] };
                    cuentas[m.cuenta].debe  += (m.debe  || 0);
                    cuentas[m.cuenta].haber += (m.haber || 0);
                    cuentas[m.cuenta].historial.push({ id: as.id, fecha: as.fecha, debe: m.debe || 0, haber: m.haber || 0, numero: as.numero || '', glosa: as.glosa || '' });
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

// ─────────────────────────────────────────────────────────────
//  SALDOS DE CUENTAS "DISPONIBLE" — validación de asientos pendientes
//  (Diario: calculadora, glosa libre, Asiento Manual)
// ─────────────────────────────────────────────────────────────

// Cuentas ACTIVAS del Plan de Cuentas con subgrupo 'Disponible' — plan-agnóstico,
// nunca una lista fija de nombres (ver CUENTAS_EFECTIVO en flujo-caja.js, el
// antipatrón frágil que esto evita).
function listarCuentasDisponible() {
    return Object.entries(PLAN_CUENTAS)
        .filter(([, info]) => info.subgrupo === 'Disponible' && info.estado !== 'INACTIVA')
        .map(([nombre]) => nombre)
        .sort((a, b) => (PLAN_CUENTAS[a]?.orden ?? 9999) - (PLAN_CUENTAS[b]?.orden ?? 9999));
}
window.listarCuentasDisponible = listarCuentasDisponible;

// Saldo actual (debe-haber acumulado, histórico completo, ANULADO excluido).
// excluirAsientoId: al editar un asiento existente, excluye SUS movimientos ya
// guardados del cómputo (el caller le suma después el delta de la versión
// editada) para no contarlo dos veces.
function _saldoActualCuentasDisponible(nombresCuenta, excluirAsientoId) {
    const set = new Set(nombresCuenta);
    const saldos = {};
    set.forEach(n => { saldos[n] = 0; });
    (dbAsientos || []).forEach(as => {
        if (as.estado === 'ANULADO') return;
        if (excluirAsientoId != null && as.id === excluirAsientoId) return;
        (as.movimientos || []).forEach(m => {
            if (!m.cuenta || !set.has(m.cuenta)) return;
            saldos[m.cuenta] += (m.debe || 0) - (m.haber || 0);
        });
    });
    return saldos;
}
window._saldoActualCuentasDisponible = _saldoActualCuentasDisponible;

// Dado un array de movimientos normalizados [{cuenta, debe, haber}] de un
// asiento PENDIENTE (aún no guardado), devuelve las cuentas 'Disponible' que
// quedarían negativas — fuente única de verdad para el aviso reactivo y el
// gate de confirmación antes de guardar (ver diario.js).
function evaluarImpactoDisponible(movimientos, options = {}) {
    const { excluirAsientoId = null } = options;
    const deltaPorCuenta = {};
    (movimientos || []).forEach(m => {
        if (!m || !m.cuenta) return;
        const info = PLAN_CUENTAS?.[m.cuenta] ?? ESQUEMA_CUENTAS[m.cuenta];
        if (!info || info.subgrupo !== 'Disponible') return;
        deltaPorCuenta[m.cuenta] = (deltaPorCuenta[m.cuenta] || 0) + (m.debe || 0) - (m.haber || 0);
    });
    const cuentasTocadas = Object.keys(deltaPorCuenta);
    if (!cuentasTocadas.length) return [];
    const saldosActuales = _saldoActualCuentasDisponible(cuentasTocadas, excluirAsientoId);
    return cuentasTocadas
        .map(cuenta => {
            const saldoActual = saldosActuales[cuenta] || 0;
            const delta = deltaPorCuenta[cuenta];
            return { cuenta, saldoActual, delta, saldoProyectado: saldoActual + delta };
        })
        .filter(r => r.saldoProyectado < 0);
}
window.evaluarImpactoDisponible = evaluarImpactoDisponible;

function obtenerCuentasOrdenadas(cuentas) {
    return Object.keys(cuentas).sort((a, b) => {
        const ordenA = (PLAN_CUENTAS?.[a] ?? ESQUEMA_CUENTAS[a])?.orden ?? 9999;
        const ordenB = (PLAN_CUENTAS?.[b] ?? ESQUEMA_CUENTAS[b])?.orden ?? 9999;
        return ordenA - ordenB;
    });
}