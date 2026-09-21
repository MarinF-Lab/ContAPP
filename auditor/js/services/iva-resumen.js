// ─────────────────────────────────────────────────────────────
//  RESUMEN IVA — Vista unificada F29
//  Cruza IVA Débito (ventas) con IVA Crédito (compras),
//  reajusta remanente con variación UTM y calcula neto a pagar.
// ─────────────────────────────────────────────────────────────

const IVA_REMANENTE_KEY = 'core_iva_remanente';

// Prefijos fijos de las glosas de los asientos de cierre del F29 — uno por
// caso (deudor/acreedor, ver generarAsientoPagoIVA()/generarAsientoRemanenteIVA()
// más abajo). Se declaran acá porque _ivaMovimientoCuentaPeriodo() también los
// necesita para excluir esos asientos de su propio período (ver comentario en
// esa función).
const IVA_GLOSA_PAGO_PREFIJO      = 'Pago F29 IVA ';
const IVA_GLOSA_REMANENTE_PREFIJO = 'Cierre F29 IVA (remanente a favor) ';

// Tasa de PPM (%) — es una sola tasa vigente (no por mes/año, como el
// remanente): el contribuyente la actualiza cuando el SII se la recalcula
// (normalmente en abril, tras la Operación Renta), y mientras tanto se
// aplica igual mes a mes. Se persiste sola, editable en el panel del F29.
const IVA_PPM_TASA_KEY = 'core_iva_ppm_tasa';

// ─────────────────────────────────────────────────────────────
//  CÁLCULO PRINCIPAL
// ─────────────────────────────────────────────────────────────
function generarIvaResumen() {
    const mes  = parseInt(document.getElementById('selIvaMes')?.value)  || (new Date().getMonth() + 1);
    const anio = parseInt(document.getElementById('selIvaAnio')?.value) || new Date().getFullYear();

    // Refresca la fecha sugerida del asiento solo cuando cambia el período
    // seleccionado — así una fecha editada a mano no se pierde si el usuario
    // vuelve a pulsar "Calcular" para el mismo mes/año (ver comentario en
    // _ivaSyncFechaDefault()).
    _ivaSyncFechaDefault(mes, anio);

    // ── 1-2. IVA Débito/Crédito desde el Libro Mayor ──────────
    // Antes se sumaba el campo "iva" de dbVentas/dbCompras (documentos de
    // origen); ahora se lee el movimiento neto del período directamente de
    // las cuentas ya contabilizadas ("IVA Débito Fiscal"/"IVA Crédito
    // Fiscal") vía recopilarMovimientosPorCuenta() (js/core/contabilidad.js)
    // — mismo criterio de recorte por período que _erRecopilarCuentasPeriodo()
    // en estado-resultados.js, ya que esa función solo soporta un tope
    // superior, no un rango. Esto refleja lo que realmente quedó en el Mayor
    // (incluye asientos manuales, no solo los generados desde Ventas/Compras)
    // y absorbe notas de crédito automáticamente: ya vienen invertidas en el
    // asiento, sin necesitar lógica de ajuste aparte.
    const cuentas    = recopilarMovimientosPorCuenta();
    const movDebito  = _ivaMovimientoCuentaPeriodo(cuentas, 'IVA Débito Fiscal',  mes, anio);
    const movCredito = _ivaMovimientoCuentaPeriodo(cuentas, 'IVA Crédito Fiscal', mes, anio);
    const ivaDebito  = movDebito.haber  - movDebito.debe;  // Pasivo: aumenta en el haber
    const ivaCredito = movCredito.debe  - movCredito.haber; // Activo: aumenta en el debe

    // ── 3. Remanente mes anterior reajustado con UTM ──────────
    // El mes de origen SIEMPRE es el calendario inmediatamente anterior al
    // seleccionado (ver _remanenteEntrante()) — nunca "el último que se
    // guardó", que es la ambigüedad que causaba que reabrir un mes viejo
    // desplazara el remanente de meses posteriores.
    const entrante  = _remanenteEntrante(mes, anio);
    const remanente = entrante.monto;

    const { reajuste, reajusteDetalle } = _calcularReajusteUTM(
        remanente, entrante.mesOrig, entrante.anioOrig, mes, anio
    );
    const remanenteReajustado = remanente + reajuste;

    // ── 4. Crédito total disponible ───────────────────────────
    const creditoTotal = ivaCredito + remanenteReajustado;

    // ── 5. Determinación neto a pagar / remanente a favor ─────
    const diferencia = ivaDebito - creditoTotal;
    const ivaAPagar  = diferencia > 0 ? diferencia : 0;
    const nuevoRemanente = diferencia < 0 ? Math.abs(diferencia) : 0;

    // ── 6. PPM (Pago Provisional Mensual, Art. 84 letra a) LIR) ─
    // No es IVA — es un anticipo del Impuesto a la Renta que se declara y
    // paga en el mismo F29, calculado sobre las ventas/ingresos netos del
    // período (subgrupo "Ingresos Operacionales": Ingresos por Ventas +
    // Ingresos por Servicios, netos de Devoluciones y Descuentos) por una
    // tasa que el contribuyente ingresa a mano (ver IVA_PPM_TASA_KEY) — el
    // SII se la recalcula anualmente, no hay forma de derivarla del Mayor.
    const movVentas  = _ivaVentasNetasPeriodo(cuentas, mes, anio);
    const tasaPPM    = _cargarTasaPPM();
    const ppmMonto   = Math.round(movVentas.neto * tasaPPM / 100);

    // ── Render ────────────────────────────────────────────────
    _renderIvaResumen({
        mes, anio,
        ivaDebito, ivaCredito,
        remanente, reajuste, reajusteDetalle, remanenteReajustado,
        remanenteMesOrig: entrante.mesOrig, remanenteAnioOrig: entrante.anioOrig,
        remanenteTieneRegistro: entrante.tieneRegistro,
        creditoTotal, ivaAPagar, nuevoRemanente,
        movDebito: movDebito.n, movCredito: movCredito.n,
        ventasNetas: movVentas.neto, movVentas: movVentas.n, tasaPPM, ppmMonto,
    });

    // Actualizar KPIs de cabecera
    _ivaSetKPI('ivaKpiDebito',    ivaDebito);
    _ivaSetKPI('ivaKpiCredito',   ivaCredito);
    _ivaSetKPI('ivaKpiRemanente', remanenteReajustado);
    _ivaSetKPI('ivaKpiPpm',       ppmMonto);
    _ivaSetKPI('ivaKpiNeto',      ivaAPagar + ppmMonto, true);
}

// Movimiento neto (debe/haber) de una cuenta del Mayor dentro de un mes/año —
// mismo criterio de recorte por período que _erRecopilarCuentasPeriodo() en
// estado-resultados.js (recopilarMovimientosPorCuenta() solo soporta un tope
// superior, no un rango, así que se re-filtra el historial completo de la
// cuenta por fecha). Excluye los propios asientos de cierre del F29 (glosa
// con alguno de los dos prefijos, deudor o acreedor): esos asientos se
// contabilizan dentro del MISMO mes que declaran (fecha = último día del
// período) para dejar las cuentas de IVA en $0 al cerrar — si no se
// excluyeran, reabrir el resumen de un período ya cerrado mostraría el
// débito/crédito cancelado por su propio asiento de cierre en vez del
// movimiento real del mes.
function _ivaMovimientoCuentaPeriodo(cuentas, nombreCuenta, mes, anio) {
    const c = cuentas[nombreCuenta];
    if (!c) return { debe: 0, haber: 0, n: 0 };
    const filtrado = c.historial.filter(h => {
        const glosa = h.glosa || '';
        if (glosa.startsWith(IVA_GLOSA_PAGO_PREFIJO) || glosa.startsWith(IVA_GLOSA_REMANENTE_PREFIJO)) return false;
        const fo = _fechaAsientoOrdenable(h.fecha);
        return fo && fo.slice(0, 4) === String(anio) && fo.slice(5, 7) === String(mes).padStart(2, '0');
    });
    return {
        debe:  filtrado.reduce((s, h) => s + (h.debe  || 0), 0),
        haber: filtrado.reduce((s, h) => s + (h.haber || 0), 0),
        n: filtrado.length,
    };
}

// Ventas/ingresos netos del período para la base del PPM: suma el
// movimiento neto (Haber − Debe, naturaleza normal de una cuenta de
// Ganancia) de TODAS las cuentas clasificadas en el subgrupo "Ingresos
// Operacionales" — hoy "Ingresos por Ventas", "Ingresos por Servicios" y
// "Devoluciones y Descuentos" (esta última con naturaleza Debe, así que
// resta sola dentro de la misma suma Haber−Debe). Se recorre por
// clasificación en vez de nombre fijo porque la cuenta de ingreso que usa
// Ventas es elegible por el usuario (ver #ventaCtaIngreso en ventas.js) y
// puede no llamarse "Ingresos por Ventas".
function _ivaVentasNetasPeriodo(cuentas, mes, anio) {
    let neto = 0, n = 0;
    Object.keys(cuentas).forEach(nombre => {
        const info = (window.PLAN_CUENTAS?.[nombre]) ?? window.ESQUEMA_CUENTAS?.[nombre];
        if (info?.subgrupo !== 'Ingresos Operacionales') return;
        const mov = _ivaMovimientoCuentaPeriodo(cuentas, nombre, mes, anio);
        neto += mov.haber - mov.debe;
        n += mov.n;
    });
    return { neto, n };
}

// ─────────────────────────────────────────────────────────────
//  REAJUSTE UTM
// ─────────────────────────────────────────────────────────────
// El reajuste compara la UTM del mes de ORIGEN del remanente contra la UTM
// del mes que se está DECLARANDO (mesActual/anioActual — el período
// seleccionado en el F29, no la fecha de hoy) — ambas se leen del mismo
// historial (ver utm_historial en indicadores.js). Antes se usaba la UTM
// EN VIVO (window.indicadoresEconomicos, "la de hoy") como "UTM actual" sin
// importar qué período se estuviera calculando: para el mes calendario real
// eso coincide, pero para cualquier período anterior compara contra la UTM
// de HOY en vez de la del propio período — sobrestima brutalmente el
// reajuste cuanto más atrás quede el período (ej. declarar Diciembre 2024
// meses o años después de esa fecha real). Se mantiene la UTM en vivo solo
// como respaldo cuando el período declarado ES el mes calendario actual y
// el historial de ese mes todavía no se grabó (recién capturada, antes de
// que actualizarIndicadores() la persista).
function _calcularReajusteUTM(monto, mesOrig, anioOrig, mesActual, anioActual) {
    if (!monto) return { reajuste: 0, reajusteDetalle: null };

    const cache   = JSON.parse(localStorage.getItem('core_indicadores') || '{}');
    const histUTM = cache?.utm_historial || {};
    const keyOrig   = `${anioOrig}-${String(mesOrig).padStart(2,'0')}`;
    const keyActual = `${anioActual}-${String(mesActual).padStart(2,'0')}`;

    const utmOrig = parseFloat(histUTM[keyOrig]);
    let   utmActual = parseFloat(histUTM[keyActual]);
    if (isNaN(utmActual)) {
        const hoy = new Date();
        if (mesActual === hoy.getMonth() + 1 && anioActual === hoy.getFullYear()) {
            utmActual = parseFloat(window.indicadoresEconomicos?.utm?.valor);
        }
    }

    if (!utmActual || isNaN(utmActual)) {
        return {
            reajuste: 0,
            reajusteDetalle: `UTM de ${mesActual}/${anioActual} no disponible en caché. Reajuste calculado en $0.`,
        };
    }

    if (!utmOrig || isNaN(utmOrig)) {
        // Sin dato histórico: reajuste estimado con 0% (no penaliza al contribuyente)
        return {
            reajuste: 0,
            reajusteDetalle: `UTM de ${mesOrig}/${anioOrig} no disponible en caché. Reajuste calculado en $0.`,
        };
    }

    const factor   = utmActual / utmOrig;
    const reajuste = Math.round(monto * (factor - 1));

    return {
        reajuste,
        reajusteDetalle:
            `UTM ${mesOrig}/${anioOrig}: $${fmt(utmOrig)} → UTM ${mesActual}/${anioActual}: $${fmt(utmActual)} ` +
            `(factor ${factor.toFixed(4)}) → reajuste: $${fmt(Math.abs(reajuste))}`,
    };
}

// ─────────────────────────────────────────────────────────────
//  PERSISTENCIA REMANENTE — historial indexado por mes de ORIGEN
// ─────────────────────────────────────────────────────────────
// Antes se guardaba un único objeto global {monto, mes, anio} — "el
// remanente más reciente, sea cual sea el mes que lo produjo". Eso
// funcionaba mientras los meses se cerraran en orden estricto, pero
// reabrir y regenerar el cierre de un mes ANTERIOR (para corregir algo,
// o solo para revisar) sobrescribía ese único valor con el resultado de
// ese mes viejo — desplazando/duplicando el traspaso hacia meses
// posteriores que ya lo habían consumido. Ahora se guarda un historial
// {'YYYY-MM': monto} indexado por el mes que LO PRODUJO al cerrar: cada
// mes solo lee y escribe su propia clave, así que reabrir un mes anterior
// nunca puede corromper el de otro mes.
function _claveRemanente(mes, anio) {
    return `${anio}-${String(mes).padStart(2, '0')}`;
}

function _cargarHistorialRemanente() {
    let datos;
    try { datos = JSON.parse(localStorage.getItem(IVA_REMANENTE_KEY)) || {}; }
    catch { datos = {}; }

    // Migración desde el formato viejo (objeto plano {monto, mes, anio},
    // no un mapa de claves de período) — se detecta por tener "monto" como
    // propiedad propia en vez de solo claves "YYYY-MM".
    if (datos && typeof datos.monto === 'number' && typeof datos.mes === 'number') {
        const migrado = { [_claveRemanente(datos.mes, datos.anio)]: datos.monto };
        localStorage.setItem(IVA_REMANENTE_KEY, JSON.stringify(migrado));
        return migrado;
    }
    return datos || {};
}

function _guardarRemanenteOrigen(mes, anio, monto) {
    const historial = _cargarHistorialRemanente();
    historial[_claveRemanente(mes, anio)] = monto;
    localStorage.setItem(IVA_REMANENTE_KEY, JSON.stringify(historial));
}

// El remanente que ENTRA a un período siempre es el que dejó el mes
// calendario inmediatamente anterior — nunca "el último que se guardó",
// que es justo la ambigüedad que causaba el traspaso duplicado.
function _remanenteEntrante(mes, anio) {
    const mesOrig  = mes === 1 ? 12 : mes - 1;
    const anioOrig = mes === 1 ? anio - 1 : anio;
    const historial = _cargarHistorialRemanente();
    const clave = _claveRemanente(mesOrig, anioOrig);
    return {
        monto: historial[clave] || 0,
        mesOrig, anioOrig,
        tieneRegistro: clave in historial,
    };
}

function guardarRemanenteIVA() {
    const monto = parseFloat(document.getElementById('ivaInputRemanente')?.value || '0');
    const mes   = parseInt(document.getElementById('ivaRemMes')?.value)  || (new Date().getMonth() + 1);
    const anio  = parseInt(document.getElementById('ivaRemAnio')?.value) || new Date().getFullYear();
    if (isNaN(monto) || monto < 0) {
        mostrarToast('Ingresa un monto de remanente válido.', 'error');
        return;
    }
    _guardarRemanenteOrigen(mes, anio, monto);
    mostrarToast(`Remanente de ${_nombreMes(mes)} ${anio} guardado correctamente.`, 'ok');
    generarIvaResumen();
}

// ─────────────────────────────────────────────────────────────
//  PERSISTENCIA TASA PPM
// ─────────────────────────────────────────────────────────────
function _cargarTasaPPM() {
    const v = parseFloat(localStorage.getItem(IVA_PPM_TASA_KEY));
    return isNaN(v) ? 0 : v;
}

// Se llama en cada tecleo del input de tasa (#ivaInputTasaPPM, fuera de
// #ivaResumenCont — ver comentario en _renderIvaResumen()). Guarda y
// recalcula de inmediato para que el monto de PPM se actualice en vivo.
function _ivaOnCambioTasaPPM(valor) {
    const tasa = parseFloat(valor);
    localStorage.setItem(IVA_PPM_TASA_KEY, String(isNaN(tasa) ? 0 : tasa));
    generarIvaResumen();
}
window._ivaOnCambioTasaPPM = _ivaOnCambioTasaPPM;

// ─────────────────────────────────────────────────────────────
//  FECHA DEL ASIENTO (editable)
// ─────────────────────────────────────────────────────────────
// El input #ivaFechaAsiento vive fuera de #ivaResumenCont (ver
// _renderIvaResumen()) para que reescribir el resumen en cada cálculo no le
// haga perder el foco/valor mientras el usuario lo edita. Su valor por
// defecto (día 1 del mes siguiente, el mismo criterio que ya usaba
// _ivaFechaCierre()) solo se repone cuando cambia el período seleccionado
// — así una fecha editada a mano sobrevive a un nuevo clic en "Calcular"
// para el mismo mes/año.
function _ivaSyncFechaDefault(mes, anio) {
    const el = document.getElementById('ivaFechaAsiento');
    if (!el) return;
    const periodoKey = `${anio}-${mes}`;
    if (el.dataset.periodo !== periodoKey) {
        const [dd, mm, yyyy] = _ivaFechaCierre(mes, anio).split('/');
        el.value = `${yyyy}-${mm}-${dd}`;
        el.dataset.periodo = periodoKey;
    }
}

// Lee la fecha del asiento desde el input editable, convertida de
// YYYY-MM-DD (formato nativo de <input type="date">) a DD/MM/YYYY (formato
// interno de dbAsientos) — mismo criterio que guardarAsientoManual() en
// diario.js. Si el input está vacío, cae al mismo cálculo de siempre.
function _ivaFechaAsientoElegida(mes, anio) {
    const valor = document.getElementById('ivaFechaAsiento')?.value;
    if (!valor) return _ivaFechaCierre(mes, anio);
    const [yyyy, mm, dd] = valor.split('-');
    return `${dd}/${mm}/${yyyy}`;
}

// ─────────────────────────────────────────────────────────────
//  RENDER HTML
// ─────────────────────────────────────────────────────────────
function _renderIvaResumen(d) {
    const cont = document.getElementById('ivaResumenCont');
    if (!cont) return;

    const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                   'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const nomMes = meses[d.mes - 1] || d.mes;

    const fila = (label, monto, sub, clrForce) => {
        const color = clrForce || (monto >= 0 ? 'var(--positive)' : 'var(--negative)');
        return `
        <div class="iva-fila">
            <div>
                <span class="iva-fila-label">${label}</span>
                ${sub ? `<div class="iva-fila-sub">${sub}</div>` : ''}
            </div>
            <span class="iva-fila-monto" style="color:${color};">
                $${fmt(Math.abs(monto))}
            </span>
        </div>`;
    };

    const divider = (titulo) =>
        `<div class="iva-divider">${titulo}</div>`;

    const totalBox = (label, monto, pagar) => `
        <div class="iva-total-box ${pagar ? 'iva-total-pagar' : 'iva-total-favor'}">
            <span>${label}</span>
            <span style="font-family:'JetBrains Mono',monospace;font-size:20px;font-weight:800;">
                $${fmt(Math.abs(monto))}
            </span>
        </div>`;

    let html = `
    <div style="font-size:13px;color:var(--text-muted);margin-bottom:16px;">
        Período: <strong>${nomMes} ${d.anio}</strong> ·
        calculado desde el Libro Mayor (cuentas IVA Débito/Crédito Fiscal)
    </div>`;

    html += divider('IVA Débito Fiscal — Libro Mayor');
    html += fila('IVA Débito del período', d.ivaDebito, `${d.movDebito} movimiento${d.movDebito === 1 ? '' : 's'} en el Mayor`, 'var(--negative)');

    html += divider('IVA Crédito Fiscal — Libro Mayor');
    html += fila('IVA Crédito del período', d.ivaCredito, `${d.movCredito} movimiento${d.movCredito === 1 ? '' : 's'} en el Mayor`, 'var(--positive)');

    if (d.remanente > 0) {
        const nomMesOrig = meses[d.remanenteMesOrig - 1] || d.remanenteMesOrig;
        html += fila(
            'Remanente mes anterior',
            d.remanente,
            `Originado en el cierre de ${nomMesOrig} ${d.remanenteAnioOrig}`,
            'var(--positive)'
        );
        html += fila(
            'Reajuste UTM',
            d.reajuste,
            d.reajusteDetalle || 'Sin datos UTM',
            d.reajuste >= 0 ? 'var(--positive)' : 'var(--negative)'
        );
        html += fila('Remanente reajustado', d.remanenteReajustado, null, 'var(--positive)');
    }

    html += fila('Total Crédito disponible', d.creditoTotal, null, 'var(--positive)');

    html += divider('Determinación IVA a Declarar');

    if (d.ivaAPagar > 0) {
        html += totalBox(`IVA neto a PAGAR — F29 línea 39`, d.ivaAPagar, true);
        html += `<div style="font-size:12px;color:var(--text-muted);margin-top:8px;">
            Débito $${fmt(d.ivaDebito)} − Crédito total $${fmt(d.creditoTotal)} = <strong>$${fmt(d.ivaAPagar)} a pagar</strong>
        </div>`;
    } else {
        html += totalBox(`Remanente a FAVOR — arrastrar al mes siguiente`, d.nuevoRemanente, false);
        html += `<div style="font-size:12px;color:var(--text-muted);margin-top:8px;">
            Crédito total $${fmt(d.creditoTotal)} − Débito $${fmt(d.ivaDebito)} = <strong>$${fmt(d.nuevoRemanente)} a favor</strong>
        </div>`;
    }

    html += divider('PPM — Pago Provisional Mensual (Renta)');
    html += fila('Ventas netas del período', d.ventasNetas, `${d.movVentas} movimiento${d.movVentas === 1 ? '' : 's'} en cuentas de Ingresos Operacionales`, 'var(--text)');
    html += `
    <div class="iva-fila">
        <div>
            <span class="iva-fila-label">Tasa PPM aplicada</span>
            <div class="iva-fila-sub">Editable en el panel de abajo</div>
        </div>
        <span class="iva-fila-monto" style="color:var(--text);">${d.tasaPPM.toFixed(2)}%</span>
    </div>`;
    html += fila('PPM determinado', d.ppmMonto, null, 'var(--negative)');

    const totalDeclarar = d.ivaAPagar + d.ppmMonto;
    html += `<div class="iva-total-box iva-total-pagar" style="margin-top:10px;">
        <span>Total a pagar en el F29 (IVA + PPM)</span>
        <span style="font-family:'JetBrains Mono',monospace;font-size:20px;font-weight:800;">
            $${fmt(totalDeclarar)}
        </span>
    </div>`;

    if (d.ivaAPagar > 0) {
        html += `<button class="btn btn-primary" style="margin-top:12px;"
            onclick="generarAsientoPagoIVA(${d.mes}, ${d.anio}, ${d.ivaDebito}, ${d.ivaCredito}, ${d.remanente}, ${d.reajuste}, ${d.ivaAPagar}, ${d.ppmMonto})">
            📝 Generar asiento de pago en el Diario
        </button>`;
    } else {
        html += `<button class="btn btn-primary" style="margin-top:12px;"
            onclick="generarAsientoRemanenteIVA(${d.mes}, ${d.anio}, ${d.ivaDebito}, ${d.ivaCredito}, ${d.remanente}, ${d.reajuste}, ${d.nuevoRemanente}, ${d.ppmMonto})">
            📝 Generar asiento de cierre en el Diario
        </button>`;
    }

    cont.innerHTML = html;
}

// ── Asientos de cierre del F29 — dos casos según cuál sea mayor:
//
//   Deudor (débito > crédito):   IVA Débito = IVA Crédito + IVA por Pagar
//   Acreedor (crédito > débito): IVA Débito + Remanente   = IVA Crédito
//
// En ambos, "remanente" es el saldo YA contabilizado en la cuenta "Remanente
// Crédito Fiscal IVA" (arrastrado de un cierre acreedor anterior) que se
// consume/cierra este período — nunca se vuelve a sumar a "IVA Crédito
// Fiscal", así que esa cuenta solo refleja crédito fiscal real del período.
// El reajuste UTM (_calcularReajusteUTM()) va en su propia línea en los dos
// casos, separado del crédito fiscal — no es IVA, es una corrección
// monetaria — reusando cuentas ya existentes en el plan de cuentas
// ("Otros Ingresos" si es a favor, "Gastos Financieros" si es en contra).
// El historial en localStorage (ver _remanenteEntrante()/_guardarRemanenteOrigen(),
// indexado por mes de origen) sigue siendo la fuente para el mes/año que
// necesita _calcularReajusteUTM() (no hay forma simple de derivarlo del
// Mayor); el asiento es un reflejo contable en paralelo, no un reemplazo de
// esa persistencia.

function _ivaMovimientosReajuste(reajuste) {
    if (reajuste > 0) return [{ cuenta: 'Otros Ingresos', debe: 0, haber: reajuste }];
    if (reajuste < 0) return [{ cuenta: 'Gastos Financieros', debe: -reajuste, haber: 0 }];
    return [];
}

// El F29 se declara y paga en el mes SIGUIENTE al período que cubre (plazo
// SII), no el último día del propio período — por defecto el asiento de
// cierre se fecha el día 1 del mes siguiente (el usuario puede editar esa
// fecha en #ivaFechaAsiento, ver _ivaFechaAsientoElegida()). La exclusión
// por glosa en _ivaMovimientoCuentaPeriodo() sigue siendo necesaria pase lo
// que pase con la fecha, porque excluye por prefijo de glosa, no por
// fecha: sin ella, este asiento contaminaría el cálculo de cualquier
// período en el que caiga su fecha, en vez de solo afectar al que declara.
function _ivaFechaCierre(mes, anio) {
    const mesSig  = mes === 12 ? 1 : mes + 1;
    const anioSig = mes === 12 ? anio + 1 : anio;
    return `01/${String(mesSig).padStart(2, '0')}/${anioSig}`;
}

// Escribe (o actualiza) un asiento en dbAsientos con el mismo patrón de
// idempotencia por prefijo de glosa que generarAsientoCompras()/
// generarAsientoVentas() (js/modules/compras.js, ventas.js): reclick
// actualiza el mismo asiento en vez de duplicarlo.
function _ivaEscribirAsientoCierre(glosaBase, fecha, movimientos) {
    const idxExist = dbAsientos.findIndex(a => a.glosa && a.glosa.startsWith(glosaBase));
    let asiento;
    if (idxExist >= 0) {
        asiento = Object.assign(dbAsientos[idxExist], { fecha, glosa: glosaBase, movimientos });
        mostrarToast(`Asiento N°${asiento.numero} actualizado en el Libro Diario.`, 'ok');
    } else {
        asiento = { id: Date.now(), numero: _nextNumeroAsiento(), estado: 'ACTIVO', fecha, glosa: glosaBase, movimientos };
        dbAsientos.push(asiento);
        mostrarToast(`Asiento N°${asiento.numero} creado en el Libro Diario.`, 'ok');
    }
    localStorage.setItem('core_asientos', JSON.stringify(dbAsientos));
    if (typeof renderHistorialDiario === 'function') renderHistorialDiario();
    if (typeof generarLibroMayor === 'function') generarLibroMayor();
    if (typeof generarBalanceGeneral === 'function') generarBalanceGeneral();
}

// Caso deudor: IVA Débito = IVA Crédito + IVA por Pagar. Reconoce el pasivo
// "IVA por Pagar" en vez de acreditar Banco directo — separa "declarar el
// F29" de "pagarlo"; el pago real es un asiento aparte (Debe IVA por Pagar /
// Haber Banco) cuando corresponda, no automático acá. El PPM (si hay tasa
// configurada) va en el MISMO asiento — el F29 es una sola declaración —
// como Debe "PPM" (activo, recuperable en el F22 anual) / Haber "Impuestos
// por Pagar" (mismo criterio que "IVA por Pagar": se reconoce la
// obligación, no se asume pago en efectivo inmediato).
function generarAsientoPagoIVA(mes, anio, ivaDebito, ivaCredito, remanente, reajuste, ivaAPagar, ppmMonto = 0) {
    const movimientos = [];
    if (ivaDebito > 0)  movimientos.push({ cuenta: 'IVA Débito Fiscal', debe: ivaDebito, haber: 0 });
    if (ivaCredito > 0) movimientos.push({ cuenta: 'IVA Crédito Fiscal', debe: 0, haber: ivaCredito });
    if (remanente > 0)  movimientos.push({ cuenta: 'Remanente Crédito Fiscal IVA', debe: 0, haber: remanente });
    movimientos.push(..._ivaMovimientosReajuste(reajuste));
    movimientos.push({ cuenta: 'IVA por Pagar', debe: 0, haber: ivaAPagar });
    if (ppmMonto > 0) {
        movimientos.push({ cuenta: 'PPM', debe: ppmMonto, haber: 0 });
        movimientos.push({ cuenta: 'Impuestos por Pagar', debe: 0, haber: ppmMonto });
    }

    const glosaBase = `${IVA_GLOSA_PAGO_PREFIJO}${_nombreMes(mes)} ${anio}`;
    _ivaEscribirAsientoCierre(glosaBase, _ivaFechaAsientoElegida(mes, anio), movimientos);
}
window.generarAsientoPagoIVA = generarAsientoPagoIVA;

// Caso acreedor: IVA Débito + Remanente = IVA Crédito.
//
// El remanente ANTERIOR (reajustado por UTM, en su propia línea de reajuste
// aparte) y el resultado de ESTE mes se SUMAN para formar el nuevo remanente
// — eso ya lo hace generarIvaResumen() (creditoTotal = ivaCredito +
// remanenteReajustado; nuevoRemanente = creditoTotal - ivaDebito). Lo que
// antes confundía era la FORMA del asiento: se registraban dos líneas
// opuestas a la MISMA cuenta "Remanente Crédito Fiscal IVA" (Haber por el
// saldo anterior que se cierra, Debe por el saldo nuevo que se dota),
// pareciendo una resta cuando en realidad solo eran el cierre y la
// reapertura de un mismo saldo. Se registra en UNA sola línea neta
// (nuevoRemanente − remanente): mismo efecto en el Mayor, cuadratura
// intacta, sin la cuenta repetida en direcciones opuestas dentro del mismo
// asiento.
// El nuevo remanente se guarda indexado por ESTE mes (el que se acaba de
// cerrar, ver _guardarRemanenteOrigen()) — nunca pisa el de otro mes, así
// que reabrir y regenerar un cierre antiguo no puede desplazar/duplicar el
// traspaso de meses posteriores que ya lo consumieron.
// El PPM (si hay tasa configurada) sigue debiéndose aunque el IVA quede en
// remanente — mismo par Debe "PPM" / Haber "Impuestos por Pagar" que en
// generarAsientoPagoIVA().
function generarAsientoRemanenteIVA(mes, anio, ivaDebito, ivaCredito, remanente, reajuste, nuevoRemanente, ppmMonto = 0) {
    const movimientos = [];
    if (ivaDebito > 0)  movimientos.push({ cuenta: 'IVA Débito Fiscal', debe: ivaDebito, haber: 0 });
    if (ivaCredito > 0) movimientos.push({ cuenta: 'IVA Crédito Fiscal', debe: 0, haber: ivaCredito });
    movimientos.push(..._ivaMovimientosReajuste(reajuste));

    const netoRemanente = nuevoRemanente - remanente;
    if (netoRemanente > 0) movimientos.push({ cuenta: 'Remanente Crédito Fiscal IVA', debe: netoRemanente, haber: 0 });
    if (netoRemanente < 0) movimientos.push({ cuenta: 'Remanente Crédito Fiscal IVA', debe: 0, haber: -netoRemanente });
    if (ppmMonto > 0) {
        movimientos.push({ cuenta: 'PPM', debe: ppmMonto, haber: 0 });
        movimientos.push({ cuenta: 'Impuestos por Pagar', debe: 0, haber: ppmMonto });
    }

    const glosaBase = `${IVA_GLOSA_REMANENTE_PREFIJO}${_nombreMes(mes)} ${anio}`;
    _ivaEscribirAsientoCierre(glosaBase, _ivaFechaAsientoElegida(mes, anio), movimientos);

    const mesSig  = mes === 12 ? 1 : mes + 1;
    const anioSig = mes === 12 ? anio + 1 : anio;
    _guardarRemanenteOrigen(mes, anio, nuevoRemanente);
    mostrarToast(`Remanente de $${fmt(nuevoRemanente)} guardado (origen ${_nombreMes(mes)} ${anio}). Se aplicará en ${mesSig}/${anioSig}.`, 'ok');
}
window.generarAsientoRemanenteIVA = generarAsientoRemanenteIVA;

// ─────────────────────────────────────────────────────────────
//  KPI HELPERS
// ─────────────────────────────────────────────────────────────
function _ivaSetKPI(id, val, esNeto) {
    const el = document.getElementById(id);
    if (!el) return;
    // fmt() muestra "-" para 0 (correcto en tablas), pero en un KPI de
    // cabecera un guión pelado se lee como error — mostrar "$0" explícito.
    el.textContent = val === 0 ? '$0' : '$' + fmt(Math.abs(val));
    if (esNeto) {
        el.style.color = val > 0 ? 'var(--negative)' : 'var(--positive)';
    } else {
        el.style.color = 'var(--text)';
    }
}

// Inicializar selectores de período al abrir la vista — solo la PRIMERA vez
// (dataset.init como centinela, ver _initSelFlujoCajaAnio() en app.js): un
// <select> sin opción "selected" igual devuelve un .value truthy (el primer
// <option>), así que "!selA.value" nunca detectaba "todavía sin inicializar"
// y esta vista quedaba siempre en Enero/2023 al abrir.
function _initIvaSelectores() {
    const anio = new Date().getFullYear();
    const mes  = new Date().getMonth() + 1;
    const selA = document.getElementById('selIvaAnio');
    const selM = document.getElementById('selIvaMes');
    if (selA && !selA.dataset.init) { selA.value = anio; selA.dataset.init = '1'; }
    if (selM && !selM.dataset.init) { selM.value = mes;  selM.dataset.init = '1'; }

    // Pre-cargar en el panel manual el remanente ENTRANTE del período
    // actualmente seleccionado (mes/año de origen = mes calendario anterior
    // al seleccionado) — solo la primera vez, para no pisar lo que el
    // usuario esté editando a mano si vuelve a esta vista.
    const selMActual = document.getElementById('selIvaMes');
    const selAActual = document.getElementById('selIvaAnio');
    const elMonto = document.getElementById('ivaInputRemanente');
    if (elMonto && !elMonto.dataset.init) {
        const mesSel  = parseInt(selMActual?.value)  || mes;
        const anioSel = parseInt(selAActual?.value)  || anio;
        const entrante = _remanenteEntrante(mesSel, anioSel);
        const elMes  = document.getElementById('ivaRemMes');
        const elAnio = document.getElementById('ivaRemAnio');
        elMonto.value = entrante.monto || '';
        if (elMes)  elMes.value  = entrante.mesOrig;
        if (elAnio) elAnio.value = entrante.anioOrig;
        elMonto.dataset.init = '1';
    }

    // Pre-cargar tasa de PPM guardada
    const elTasaPPM = document.getElementById('ivaInputTasaPPM');
    if (elTasaPPM && !elTasaPPM.dataset.init) {
        elTasaPPM.value = _cargarTasaPPM();
        elTasaPPM.dataset.init = '1';
    }
}
