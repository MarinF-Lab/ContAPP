
let preasientoActual = null;
let asientoEditando = null;

// Filtro de mes/año del historial (#historialDiarioLista) — mismo patrón que
// comprasMes/comprasAnio en js/modules/compras.js. A diferencia del Balance
// (que es un acumulado a un momento dado, ver js/services/balance.js), el
// historial del Diario es una lista de asientos: filtrar por mes muestra
// solo los asientos CON FECHA EN ese mes, no un acumulado.
let diarioHistMes  = new Date().getMonth() + 1;
let diarioHistAnio = new Date().getFullYear();

// ─────────────────────────────────────────────────────────────
//  MAPA DE PALABRAS CLAVE → CUENTA CONTABLE (inicio actividades)
//  Orden de prioridad: de más específico a más genérico.
//  Incluye activos, pasivos, patrimonio y cuentas complementarias.
// ─────────────────────────────────────────────────────────────
const _CUENTA_KEYWORDS = [
    // ── Cuentas complementarias (depreciación) — ANTES que el activo al que refieren ──
    { re: /depreciaci[oó]n\s+acumulada\s+(?:de\s+)?mueble|muebles?.*depreciaci[oó]n\s+acumulada/i,         cuenta: 'Depreciación Acumulada Muebles'           },
    { re: /depreciaci[oó]n\s+acumulada\s+(?:de\s+)?veh[ií]culo|veh[ií]culos?.*depreciaci[oó]n\s+acumulada/i, cuenta: 'Depreciación Acumulada Vehículos'         },
    { re: /depreciaci[oó]n\s+acumulada\s+(?:de\s+)?edificio|edificios?.*depreciaci[oó]n\s+acumulada/i,     cuenta: 'Depreciación Acumulada Edificios'          },
    { re: /depreciaci[oó]n\s+acumulada\s+(?:de\s+)?maquinaria|maquinarias?.*depreciaci[oó]n\s+acumulada/i, cuenta: 'Depreciación Acumulada Maquinarias'        },
    { re: /depreciaci[oó]n\s+acumulada\s+(?:de\s+)?equipo|equipos?.*depreciaci[oó]n\s+acumulada/i,        cuenta: 'Depreciación Acumulada Equipos'            },
    { re: /depreciaci[oó]n\s+acumulada/i,                                                                  cuenta: 'Depreciación Acumulada'                   },
    { re: /amortizaci[oó]n\s+acumulada/i,                                                                  cuenta: 'Amortización Acumulada'                   },

    // ── Patrimonio ──
    { re: /utilidades?\s+retenidas?|resultado\s+acumulado|ganancias?\s+acumuladas?/i,  cuenta: 'Utilidades Retenidas'    },
    { re: /p[eé]rdidas?\s+acumuladas?|d[eé]ficit\s+acumulado/i,                       cuenta: 'Pérdidas Acumuladas'     },
    { re: /resultado\s+del\s+ejercicio|utilidad\s+del\s+ejercicio/i,                  cuenta: 'Resultado del Ejercicio' },
    { re: /capital\s+social/i,                                                         cuenta: 'Capital Social'          },
    { re: /capital/i,                                                                  cuenta: 'Capital'                 },

    // ── Pasivos ──
    { re: /proveedores?|cuentas?\s+por\s+pagar\s+proveedor/i,                         cuenta: 'Proveedores'                  },
    { re: /acreedor|cuentas?\s+por\s+pagar\s+varios/i,                                cuenta: 'Acreedores Varios'            },
    { re: /documentos?\s+por\s+pagar|letras?\s+por\s+pagar/i,                         cuenta: 'Documentos por Pagar'        },
    { re: /iva\s+d[eé]bito\s+fiscal/i,                                                cuenta: 'IVA Débito Fiscal'            },
    { re: /remuneraciones?\s+por\s+pagar|sueldos?\s+por\s+pagar/i,                   cuenta: 'Remuneraciones por Pagar'    },
    { re: /impuestos?\s+por\s+pagar/i,                                                cuenta: 'Impuestos por Pagar'         },
    { re: /pr[eé]stamo\s+bancario.*(corto\s+plazo|\bcp\b)|cr[eé]dito.*(corto\s+plazo|\bcp\b)/i, cuenta: 'Préstamos Bancarios CP' },
    { re: /pr[eé]stamo\s+bancario|cr[eé]dito\s+bancario|hipoteca/i,                  cuenta: 'Préstamos Bancarios LP'      },

    // ── Activos circulantes ──
    { re: /efectivo|caja|contado|en\s+efectivo/i,                                      cuenta: 'Caja'                        },
    { re: /banco|dep[oó]sito|transferencia|cuenta\s+corriente|cheque|en\s+banco/i,    cuenta: 'Banco'                       },
    { re: /clientes?|cuentas?\s+por\s+cobrar|deudores?\s+comerciales?/i,              cuenta: 'Clientes'                    },
    { re: /documentos?\s+por\s+cobrar|letras?\s+por\s+cobrar/i,                       cuenta: 'Documentos por Cobrar'       },
    { re: /deudores?\s+varios/i,                                                       cuenta: 'Deudores Varios'             },
    { re: /mercader[ií]a|inventario|stock/i,                                           cuenta: 'Mercaderías'                 },
    { re: /materia\s+prima|insumo|material/i,                                          cuenta: 'Materias Primas'             },
    { re: /iva\s+cr[eé]dito\s+fiscal/i,                                               cuenta: 'IVA Crédito Fiscal'           },
    { re: /ppm\b|pagos?\s+provisionales/i,                                             cuenta: 'PPM'                         },

    // ── Activos no circulantes ──
    { re: /terreno/i,                                                                   cuenta: 'Terrenos'                    },
    { re: /inmueble|edificio|propiedad|local\s+comercial|oficina|bodega/i,             cuenta: 'Edificios'                   },
    { re: /mueble|escritorio|silla|estanter[ií]a|mobiliario/i,                        cuenta: 'Muebles y Útiles'            },
    { re: /computador|notebook|tablet|laptop|\bpc\b/i,                                 cuenta: 'Equipos Computacionales'     },
    { re: /veh[ií]culo|auto|camioneta|furg[oó]n|cami[oó]n|moto/i,                    cuenta: 'Vehículos'                   },
    { re: /maquinaria|m[aá]quina|equipo\s+industrial/i,                               cuenta: 'Maquinarias'                 },
    { re: /software|licencia|sistema\s+inform[aá]tico/i,                              cuenta: 'Software'                    },
    { re: /marca|patente|propiedad\s+intelectual/i,                                   cuenta: 'Marcas y Patentes'           },
];

// ── Naturaleza contable por defecto para cuentas detectadas ──
// Si la cuenta existe en PLAN_CUENTAS se usa esa naturaleza.
// Si no existe, se infiere por el tipo de cuenta.
const _NATURALEZA_DEFAULT = {
    // Haber: pasivos, patrimonio, depreciación acumulada
    'Proveedores': 'Haber', 'Acreedores Varios': 'Haber',
    'Documentos por Pagar': 'Haber', 'IVA Débito Fiscal': 'Haber',
    'Remuneraciones por Pagar': 'Haber', 'Impuestos por Pagar': 'Haber',
    'Préstamos Bancarios LP': 'Haber', 'Hipotecas por Pagar': 'Haber',
    'Capital': 'Haber', 'Capital Social': 'Haber',
    'Utilidades Retenidas': 'Haber', 'Resultado del Ejercicio': 'Haber',
    'Pérdidas Acumuladas': 'Debe', // excepción: pérdida acumulada va en debe
    'Depreciación Acumulada': 'Haber',
    'Depreciación Acumulada Muebles': 'Haber',
    'Depreciación Acumulada Vehículos': 'Haber',
    'Depreciación Acumulada Edificios': 'Haber',
    'Depreciación Acumulada Maquinarias': 'Haber',
    'Depreciación Acumulada Equipos': 'Haber',
    'Amortización Acumulada': 'Haber',
    'Previsión Social por Pagar': 'Haber',
    'Préstamos Bancarios CP': 'Haber',
};

function _naturalezaCuenta(nombre) {
    // 1. Consultar PLAN_CUENTAS activo (fuente de verdad, incluye cuentas personalizadas)
    const plan = window.PLAN_CUENTAS || {};
    const entrada = plan[nombre];
    if (entrada?.naturaleza) return entrada.naturaleza;
    // 2. Inferir por tipo si existe en el plan pero sin naturaleza explícita
    if (entrada?.tipo) {
        if (entrada.tipo === 'Contra Activo')    return 'Haber';
        if (entrada.tipo === 'Contra Pasivo')    return 'Debe';
        if (entrada.tipo === 'Contra Patrimonio')return 'Debe';
        if (entrada.tipo === 'Activo' || entrada.tipo === 'Pérdida') return 'Debe';
        return 'Haber';
    }
    // 3. Tabla de fallback para cuentas no registradas en el plan
    if (_NATURALEZA_DEFAULT[nombre]) return _NATURALEZA_DEFAULT[nombre];
    // 4. Heurística por nombre
    if (/depreciaci[oó]n\s+acumulada|amortizaci[oó]n\s+acumulada|provisión/i.test(nombre)) return 'Haber';
    if (/proveedor|acreedor|por\s+pagar|capital|utilidad|resultado|patrimonio/i.test(nombre)) return 'Haber';
    return 'Debe'; // activos por defecto
}

function _clasificarCuentaInicial(texto) {
    for (const k of _CUENTA_KEYWORDS) {
        if (k.re.test(texto)) return k.cuenta;
    }
    return null;
}

// Busca en el texto de la glosa el nombre de alguna cuenta PERSONALIZADA del Plan
// de Cuentas (agregada por el usuario, no una del esquema base — esas ya las cubre
// _CUENTA_KEYWORDS). Sin esto, una cuenta recién creada nunca se reconocía fuera del
// flujo "inicio de actividades", así que cualquier glosa que la mencionara caía
// siempre en "Gastos Generales" (o en la cuenta genérica que tocara) en vez de la
// cuenta real que el usuario acaba de dar de alta.
function _buscarCuentaPersonalizadaEnTexto(texto) {
    const plan = window.PLAN_CUENTAS || {};
    const base = new Set(Object.keys(window.ESQUEMA_CUENTAS || {}));
    const t = texto.toLowerCase();
    const candidatas = Object.keys(plan)
        .filter(n => !base.has(n))
        .filter(n => t.includes(n.toLowerCase()))
        .sort((a, b) => b.length - a.length); // nombre más específico (largo) primero
    return candidatas[0] ? { nombre: candidatas[0], datos: plan[candidatas[0]] } : null;
}

// Mantener alias para compatibilidad con código existente
const _ACTIVO_KEYWORDS = _CUENTA_KEYWORDS;
function _clasificarActivoInicial(texto) { return _clasificarCuentaInicial(texto) || 'Caja'; }

// ── Deducción de cuenta de gasto no catalogada ──────────────────
// Cuando la glosa dice "gasto de X por $..." y X no calza con ninguna
// categoría conocida (Publicidad, Arriendos, Seguros, etc.), en vez de
// agruparla bajo "Gastos Generales" se deduce el nombre específico desde
// el propio texto de la glosa. La cuenta resultante no existe todavía en
// el Plan de Cuentas, así que _detectarCuentasNoRegistradas() la atrapa
// automáticamente al guardar el asiento — sin pasos manuales adicionales.
const _SIGLAS_CUENTA = new Set(['sii', 'iva', 'ppm', 'f29', 'f22', 'uf', 'utm', 'dj']);
const _CONECTORES_CUENTA = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'en', 'por', 'a', 'un', 'una']);

function _tituloCuenta(texto) {
    return texto
        .trim()
        .split(/\s+/)
        .map((palabra, i) => {
            const lower = palabra.toLowerCase();
            if (_SIGLAS_CUENTA.has(lower)) return lower.toUpperCase();
            if (i > 0 && _CONECTORES_CUENTA.has(lower)) return lower;
            return lower.charAt(0).toUpperCase() + lower.slice(1);
        })
        .join(' ');
}

function _extraerConceptoGasto(glosa) {
    // Primero el patrón viejo, anclado a "por $" (glosas que sí traen el monto
    // en el texto). Si no hay match, la glosa nueva ya no lleva "$" — se
    // captura hasta el final y se recorta el medio de pago si quedó pegado
    // (ej. "pago de patente al contado" -> concepto "patente").
    const m = glosa.match(/gastos?\s+(?:de|en)\s+([a-záéíóúñ][a-záéíóúñ0-9\s]{2,40}?)\s+por\s+\$/i)
           || glosa.match(/pago\s+(?:de|por)\s+([a-záéíóúñ][a-záéíóúñ0-9\s]{2,40}?)\s+por\s+\$/i)
           || glosa.match(/gastos?\s+(?:de|en)\s+([a-záéíóúñ][a-záéíóúñ0-9\s]{2,40})/i)
           || glosa.match(/pago\s+(?:de|por)\s+([a-záéíóúñ][a-záéíóúñ0-9\s]{2,40})/i);
    if (!m) return null;

    let concepto = m[1].trim().replace(/^(la|el|los|las|un|una|del)\s+/i, '');
    concepto = concepto
        .replace(/\s+(al\s+contado|a\s+cr[eé]dito|con\s+(transferencia|cheque|tarjeta|dep[oó]sito)|en\s+efectivo)\s*$/i, '')
        .trim();
    if (concepto.length < 3) return null;

    return _tituloCuenta(concepto);
}

function _limpiarNumStr(s) {
    return parseInt(String(s).replace(/\./g, '').replace(/,/g, ''), 10) || 0;
}

/**
 * Parsea glosas con múltiples activos y montos para inicio de actividades.
 * Estrategia: encuentra todos los montos, luego clasifica el texto
 * que rodea cada monto para determinar la cuenta contable.
 *
 * Ejemplos soportados:
 *   "capital de $10.000.000 en efectivo y $5.000.000 en banco"
 *   "10000000 efectivo y 5000000 banco"
 *   "$10.000.000 caja, $3.000.000 banco y $2.000.000 en mercaderías"
 */
function _extraerActivosIniciales(glosa) {
    const resultados = [];

    // 1. Encontrar todos los montos y sus posiciones.
    //    Regex captura dos formatos:
    //      - Con puntos chilenos:  10.000.000  (requiere al menos un grupo .ddd)
    //      - Sin puntos (raw):     10000000    (mínimo 4 dígitos = >= 1.000)
    const montoRe = /\$?\s*(\d{1,3}(?:\.\d{3})+|\d{4,})/g;
    const montos  = [];
    let m;
    while ((m = montoRe.exec(glosa)) !== null) {
        const num = _limpiarNumStr(m[1]);
        if (num >= 1000) {
            montos.push({ monto: num, idx: m.index, fin: m.index + m[0].length });
        }
    }

    if (!montos.length) return resultados;

    // 2. Para cada monto, buscar la cuenta en el texto circundante.
    //    Estrategia: buscar PRIMERO en el texto que va DESPUÉS del número
    //    (hasta el siguiente número), ya que el patrón más común es
    //    "$10.000.000 en efectivo y $5.000.000 en banco".
    //    Si no hay keyword después, buscar en el texto ANTES del número
    //    para cubrir "efectivo $10.000.000 y banco $5.000.000".
    montos.forEach((entry, i) => {
        const despues = glosa.slice(entry.fin, montos[i + 1]?.idx ?? glosa.length);
        const antes   = glosa.slice(i === 0 ? 0 : montos[i - 1].fin, entry.idx);

        // Buscar también en nombres de cuentas del plan personalizado del usuario
        const planCuentasNombres = Object.keys(window.PLAN_CUENTAS || {});

        let cuenta = null;

        // 1. Prioridad: texto DESPUÉS del número (patrón más común)
        cuenta = _clasificarCuentaInicial(despues);

        // 2. Si no, buscar nombre exacto de cuenta del plan en el texto después
        if (!cuenta) {
            for (const nombre of planCuentasNombres) {
                if (despues.toLowerCase().includes(nombre.toLowerCase())) {
                    cuenta = nombre; break;
                }
            }
        }

        // 3. Texto ANTES del número
        if (!cuenta) cuenta = _clasificarCuentaInicial(antes);

        // 4. Nombre exacto de cuenta del plan en el texto antes
        if (!cuenta) {
            for (const nombre of planCuentasNombres) {
                if (antes.toLowerCase().includes(nombre.toLowerCase())) {
                    cuenta = nombre; break;
                }
            }
        }

        if (!cuenta) cuenta = 'Caja'; // fallback

        const existing = resultados.find(r => r.cuenta === cuenta);
        if (existing) existing.monto += entry.monto;
        else resultados.push({ cuenta, monto: entry.monto });
    });

    return resultados.filter(r => r.monto > 0);
}

// ── "Pago a Proveedores/Acreedores" y "Cobro a Clientes" — paga o cobra el
//    saldo TOTAL pendiente de esas cuentas en vez de un monto escrito a
//    mano (no aplica extraerFlujoDinero/montoTotal, por eso se resuelve
//    aparte y antes que el resto de procesarGlosa()). Se puede combinar más
//    de una cuenta en la misma frase, ej. "pago a proveedores y acreedores
//    al contado" → un solo asiento con una línea por cuenta y una
//    contrapartida combinada según el medio de pago al final.
//    El saldo sale de sumar todo el historial de movimientos —
//    recopilarMovimientosPorCuenta() (js/core/contabilidad.js), mismo
//    cálculo que usa el Mayor — natural acreedora para Proveedores/
//    Acreedores Varios (haber-debe), deudora para Clientes (debe-haber).

function _saldoCuentaActual(nombreCuenta, esPasivo) {
    const mov = recopilarMovimientosPorCuenta()[nombreCuenta];
    if (!mov) return 0;
    return esPasivo ? (mov.haber - mov.debe) : (mov.debe - mov.haber);
}

function _detectarMedioPagoSimple(g) {
    if (/cr[eé]dito/.test(g))        return 'credito';
    if (/transferencia/.test(g))     return 'transferencia';
    if (/cheque/.test(g))            return 'cheque';
    if (/banco|dep[oó]sito/.test(g)) return 'banco';
    if (/tarjeta/.test(g))           return 'tarjeta';
    return 'contado';
}

// true si la glosa matcheaba este patrón (se haya podido generar el asiento
// o no) — procesarGlosa() no debe seguir con el parser genérico en ese caso.
function _procesarGlosaSaldoCuentas(glosa) {
    const g = glosa.toLowerCase().trim();
    const esPago  = /^(pago|pagamos)\s+a\s+/.test(g);
    const esCobro = /^(cobro|cobramos)\s+a\s+/.test(g);
    if (!esPago && !esCobro) return false;

    const cuentas = [];
    if (esPago) {
        if (/proveedor/.test(g)) cuentas.push({ cuenta: 'Proveedores', esPasivo: true });
        if (/acreedor/.test(g))  cuentas.push({ cuenta: 'Acreedores Varios', esPasivo: true });
    } else if (/client/.test(g)) {
        cuentas.push({ cuenta: 'Clientes', esPasivo: false });
    }
    if (!cuentas.length) return false;

    const cuentaMedio = clasificarCuentaFinanciera(_detectarMedioPagoSimple(g), 'compra', false);

    const lineas = [];
    let total = 0;
    for (const { cuenta, esPasivo } of cuentas) {
        const saldo = Math.round(_saldoCuentaActual(cuenta, esPasivo));
        if (saldo <= 0) {
            mostrarToast(`No hay saldo pendiente en "${cuenta}".`, 'error');
            return true;
        }
        lineas.push({ cuenta, monto: saldo });
        total += saldo;
    }

    const debe  = esPago ? lineas : [{ cuenta: cuentaMedio, monto: total }];
    const haber = esPago ? [{ cuenta: cuentaMedio, monto: total }] : lineas;

    document.getElementById('montoAsiento').value = total;

    _calcItemsPendientesInventario = null;
    _calcItemsPendientesCatalogo   = null;

    preasientoActual = { glosa, debe, haber, cuentasHint: {} };
    renderPreasiento();
    return true;
}

function procesarGlosa() {

    const glosa =
        document.getElementById("glosaInput")
        .value
        .trim();

    if (!glosa)
        return mostrarToast('Ingresa una glosa válida.', 'error');

    if (_procesarGlosaSaldoCuentas(glosa)) return;

    // El monto viene primero del campo separado #montoAsiento (así la glosa no
    // necesita llevar el peso en el texto, ej. "Pago de patente al contado");
    // si no se llenó, se mantiene compatibilidad con glosas viejas que sí
    // traen "$X" en el texto.
    let montoTotal = _limpiarNumStr(document.getElementById('montoAsiento')?.value) || extraerMontoTotal(glosa);

    if (!montoTotal)
        return mostrarToast('Ingresa el monto en el campo "Monto". Ej: "Pago de patente al contado".', 'error');

    let tipo = "desconocido";

    const g = glosa.toLowerCase();

    // Cuenta personalizada del Plan de Cuentas mencionada por nombre en la glosa —
    // si es de tipo Pérdida (gasto), se calcula antes de la cadena de detección de
    // tipo para que tenga prioridad sobre el catch-all genérico de "compra" más
    // abajo (que de otro modo contabilizaría, ej., "Viáticos" como compra de
    // Mercaderías) y para reconocer frases que no usan ninguna de las palabras
    // clave fijas ("Pagué viáticos por $30.000", sin la palabra "gasto").
    const _cuentaPersonalDetectada = _buscarCuentaPersonalizadaEnTexto(glosa);

    // Detección de tipo — orden de prioridad de mayor a menor especificidad
    if (/inicio de actividades|inicia actividades|constituci[oó]n|capital inicial|aporte inicial/i.test(g))
        tipo = "inicio_actividades";

    else if (/abre cuenta corriente|apertura cuenta corriente|se abre cuenta corriente/i.test(g))
        tipo = "apertura_cuenta_corriente";

    else if (/dep[oó]sito|depositamos|depositar|deposit[eé]|ingres[ao] (?:al?|en) banco/i.test(g))
        tipo = "deposito";

    else if (/retiro|retiramos|retirar|retire|sac[ao] (?:del?|desde) banco|cobr[ao] cheque/i.test(g))
        tipo = "retiro";

    else if (/venta|vendemos/i.test(g))
        tipo = "venta";

    else if (_cuentaPersonalDetectada && _cuentaPersonalDetectada.datos.tipo === 'Pérdida')
        tipo = "gasto";

    else if (/(compra|compramos|adquisici[oó]n)/i.test(g) &&
             /internet|tel[eé]fono|luz|electricidad|agua|servicios?\s+b[aá]sicos?|seguro|mantenimiento|reparaci[oó]n|comisi[oó]n|publicidad|marketing|arriendo|alquiler|data\s*show|proyector/i.test(g))
        tipo = "gasto";

    else if (/compra|compramos|adquisici[oó]n/i.test(g))
        tipo = "compra";

    else if (/cobro|cobramos|recaudaci[oó]n|nos pagan/i.test(g))
        tipo = "cobro";

    else if (/gasto|publicidad|arriendo|alquiler|sueldo|honorario|luz|agua|tel[eé]fono|internet|servicios/i.test(g))
        tipo = "gasto";

    else if (/pago a|pagamos a|abono a|pago de factura|pago de deuda|pago proveedor|pago parcial/i.test(g))
        tipo = "pago_deuda";

    else if (/pr[eé]stamo bancario|recibimos pr[eé]stamo|nos otorgan.*cr[eé]dito|cr[eé]dito del banco|otorgan.*pr[eé]stamo/i.test(g))
        tipo = "prestamo_recibido";

    else if (/pago.*cuota|cuota.*pr[eé]stamo|cuota.*cr[eé]dito|amortiza|pago.*pr[eé]stamo bancario/i.test(g))
        tipo = "pago_prestamo";

    else if (/remunera|pago.*sueldos|sueldos.*mes|liquidaci[oó]n.*sueld|pago.*remuner/i.test(g))
        tipo = "remuneraciones";

    else if (/nota.*cr[eé]dito|nc.*proveedor|proveedor.*emite.*nc|recibimos.*nc/i.test(g))
        tipo = "nota_credito_compra";

    else if (/devoluci[oó]n.*venta|cliente.*devuelve|nos devuelven|devoluci[oó]n.*mercanc/i.test(g))
        tipo = "devolucion_venta";

    else if (/traspaso|transferencia.*entre.*cuenta|de.*caja.*a.*banco|de.*banco.*a.*caja/i.test(g))
        tipo = "traspaso";

    // Catch-all de "pago de X" genérico (ej. "pago de patente al contado") —
    // va al final, con la prioridad más baja, para no interceptar los "pago..."
    // más específicos de arriba (cuota, remuneraciones, factura/deuda, etc.).
    // Sin esto, una glosa nueva (sin monto en el texto) que no calce con
    // ninguna palabra clave fija quedaba en "Tipo de operación no reconocido".
    else if (/^pagu[eé]\s|^pago\s+(de|por)\s/i.test(g.trim()))
        tipo = "gasto";

    if (tipo === "desconocido") {
        mostrarToast('Tipo de operación no reconocido. Revisa el acordeón de ayuda debajo del campo.', 'error');
        const ayuda = document.getElementById('glosaAyuda');
        if (ayuda) ayuda.open = true;
        return;
    }

    let debe = [];
    let haber = [];
    let cuentasHint = {}; // clasificación conocida de cuentas deducidas dinámicamente (ver tipo "gasto")

    let flujos =
        extraerFlujoDinero(
            glosa,
            montoTotal,
            tipo
        );

    if (tipo === "venta") {

        let neto =
            Math.round(montoTotal / factorIva());

        let iva =
            montoTotal - neto;

        let costo =
            extraerCostoExplicito(glosa);

        if (
            costo === 0 &&
            extraerUtilidad(glosa) > 0
        ) {
            costo =
                Math.round(
                    montoTotal /
                    (
                        1 +
                        extraerUtilidad(glosa) / 100
                    )
                );
        }

        flujos.forEach(f => {
            debe.push({
                cuenta: f.cuenta,
                monto: f.monto
            });
        });

        if (costo > 0) {
            debe.push({
                cuenta: "Costo de Ventas",
                monto: costo
            });
        }

        haber.push({
            cuenta: "Ingresos por Ventas",
            monto: neto
        });

        haber.push({
            cuenta: "IVA Débito Fiscal",
            monto: iva
        });

        if (costo > 0) {
            haber.push({
                cuenta: "Mercaderías",
                monto: costo
            });
        }
    }
    
if (tipo === "deposito") {
    // Dinero entra al Banco → ¿de dónde viene?
    let origen = "Caja"; // por defecto: desde caja
    if (/cliente|cobro|cobranza/i.test(g))              origen = "Clientes";
    else if (/capital|aporte|socio/i.test(g))           origen = "Capital";
    else if (/pr[eé]stamo|cr[eé]dito bancario/i.test(g)) origen = "Préstamos Bancarios LP";
    else if (/doc|cheque|letra/i.test(g))               origen = "Documentos por Cobrar";
    debe.push ({ cuenta: "Banco", monto: montoTotal });
    haber.push({ cuenta: origen,  monto: montoTotal });
}

else if (tipo === "retiro") {
    // Dinero sale del Banco → ¿a dónde va?
    let destino = "Caja";
    if (/proveedor|pago/i.test(g)) destino = "Proveedores";
    else if (/socio|due[ñn]o/i.test(g)) destino = "Capital";
    debe.push ({ cuenta: destino, monto: montoTotal });
    haber.push({ cuenta: "Banco", monto: montoTotal });
}

else if(tipo === "apertura_cuenta_corriente"){

    let origen = "Caja";

    if(
        /cheque/i.test(g)
    ){
        origen = "Banco";
    }

    if(
        /clientes/i.test(g)
    ){
        origen = "Clientes";
    }

    debe.push({
        cuenta: "Banco",
        monto: montoTotal
    });

    haber.push({
        cuenta: origen,
        monto: montoTotal
    });

}

    if(tipo === "inicio_actividades"){

    // Extrae todos los pares (monto, cuenta) de la glosa.
    // Cada cuenta puede ser activo (→ DEBE) o pasivo/patrimonio/depreciación (→ HABER).
    // La ecuación contable se forma por la naturaleza de cada cuenta detectada.
    const cuentasDetectadas = _extraerActivosIniciales(glosa);

    if (cuentasDetectadas.length) {
        let totalDebe  = 0;
        let totalHaber = 0;

        cuentasDetectadas.forEach(a => {
            const naturaleza = _naturalezaCuenta(a.cuenta);
            if (naturaleza === 'Haber') {
                haber.push({ cuenta: a.cuenta, monto: a.monto });
                totalHaber += a.monto;
            } else {
                debe.push({ cuenta: a.cuenta, monto: a.monto });
                totalDebe += a.monto;
            }
        });

        // Si no se detectó ninguna cuenta de patrimonio/pasivo en el haber,
        // calcular la diferencia y asignar a Capital como ajuste automático.
        const tieneHaber = haber.length > 0;
        if (!tieneHaber) {
            haber.push({ cuenta: 'Capital', monto: totalDebe });
        } else if (totalDebe !== totalHaber) {
            // Diferencia: agregar al Capital si el debe es mayor, o ajustar.
            const diff = totalDebe - totalHaber;
            if (diff > 0) {
                const capExiste = haber.find(h => h.cuenta === 'Capital');
                if (capExiste) capExiste.monto += diff;
                else haber.push({ cuenta: 'Capital', monto: diff });
            }
        }
    } else {
        // Fallback: monto único con cuenta genérica
        debe.push({ cuenta: 'Caja',    monto: montoTotal });
        haber.push({ cuenta: 'Capital', monto: montoTotal });
    }

}

    else if (tipo === "compra") {

        let neto =
            Math.round(montoTotal / factorIva());

        let iva =
            montoTotal - neto;

        let activo = "Mercaderías";

        if (/muebles|sillas/i.test(g))
            activo = "Muebles y Útiles";

        if (/maquinaria/i.test(g))
            activo = "Maquinarias";

        if (/computador|notebook/i.test(g))
            activo = "Equipos Computacionales";

        debe.push({
            cuenta: activo,
            monto: neto
        });

        debe.push({
            cuenta: "IVA Crédito Fiscal",
            monto: iva
        });

        flujos.forEach(f => {
            haber.push({
                cuenta: f.cuenta,
                monto: f.monto
            });
        });
    }

    else if (tipo === "cobro") {

        flujos.forEach(f => {
            debe.push({
                cuenta: f.cuenta,
                monto: f.monto
            });
        });

        haber.push({
            cuenta: "Clientes",
            monto: montoTotal
        });
    }

    else if (tipo === "pago_deuda") {

        let cuenta =
            g.includes("proveedor")
            ? "Proveedores"
            : "Acreedores Varios";

        debe.push({
            cuenta,
            monto: montoTotal
        });

        flujos.forEach(f => {
            haber.push({
                cuenta: f.cuenta,
                monto: f.monto
            });
        });
    }

    else if (tipo === "gasto") {

        let cuentaGasto =
            "Gastos Generales";

        // Prioridad máxima: si la glosa nombra una cuenta de gasto que el usuario
        // ya registró en el Plan de Cuentas, usarla directo — sin esto, una cuenta
        // recién creada nunca se reconocía y todo caía en "Gastos Generales".
        if (_cuentaPersonalDetectada && _cuentaPersonalDetectada.datos.tipo === 'Pérdida')
            cuentaGasto = _cuentaPersonalDetectada.nombre;

        else if (/publicidad|marketing/i.test(g))
            cuentaGasto = "Publicidad";

        else if (/arriendo|alquiler/i.test(g))
            cuentaGasto = "Arriendos";

        else if (/sueldo/i.test(g))
            cuentaGasto = "Sueldos y Salarios";

        else if (/honorario/i.test(g))
            cuentaGasto = "Honorarios";

        else if (/tel[eé]fono|internet|servicios b[aá]sicos/i.test(g))
            cuentaGasto = "Servicios Básicos";

        else if (/luz|electricidad/i.test(g))
            cuentaGasto = "Servicios Básicos";

        else if (/agua/i.test(g))
            cuentaGasto = "Servicios Básicos";

        else if (/seguro/i.test(g))
            cuentaGasto = "Seguros";

        else if (/mantenimiento|reparaci[oó]n/i.test(g))
            cuentaGasto = "Gastos de Mantenimiento";

        else if (/comisi[oó]n/i.test(g))
            cuentaGasto = "Comisiones Pagadas";

        else {
            const concepto = _extraerConceptoGasto(glosa);
            if (concepto) {
                cuentaGasto = concepto;
                cuentasHint[cuentaGasto] = { tipo: 'Pérdida', grupo: 'Pérdidas', subgrupo: 'Costos y Gastos Operacionales' };
            }
        }

        if (/factura|iva/i.test(g)) {

            let neto =
                Math.round(montoTotal / factorIva());

            let iva =
                montoTotal - neto;

            debe.push({
                cuenta: cuentaGasto,
                monto: neto
            });

            debe.push({
                cuenta: "IVA Crédito Fiscal",
                monto: iva
            });

        } else {

            debe.push({
                cuenta: cuentaGasto,
                monto: montoTotal
            });

        }

        flujos.forEach(f => {
            haber.push({
                cuenta: f.cuenta,
                monto: f.monto
            });
        });
    }

    // ── Tipos nuevos 2.2 ──────────────────────────────────────

    else if (tipo === "prestamo_recibido") {
        const esCortoPlazo = /corto plazo|cp\b/i.test(g);
        debe.push({ cuenta: "Banco", monto: montoTotal });
        haber.push({ cuenta: esCortoPlazo ? "Préstamos Bancarios CP" : "Préstamos Bancarios LP", monto: montoTotal });
    }

    else if (tipo === "pago_prestamo") {
        // Detectar intereses si se mencionan: "intereses $X" o "interés de $X"
        const interesMatch = g.match(/inter[eé]s[es]*\s*(?:de\s*)?\$?\s*([\d.,]+(?:\.\d{3})*)/i);
        let intereses = 0;
        if (interesMatch) {
            intereses = parseInt(interesMatch[1].replace(/\./g, '').replace(/,/g, ''));
            if (isNaN(intereses)) intereses = 0;
        }
        const capital = Math.max(montoTotal - intereses, 0);
        if (capital > 0) debe.push({ cuenta: "Préstamos Bancarios LP", monto: capital });
        if (intereses > 0) debe.push({ cuenta: "Intereses Pagados", monto: intereses });
        haber.push({ cuenta: "Banco", monto: montoTotal });
    }

    else if (tipo === "remuneraciones") {
        // Versión simplificada: bruto → sueldos / banco (líquido)
        // Previsión = ~20% estimado si no se especifica
        const prevision = Math.round(montoTotal * 0.20);
        const liquido   = montoTotal - prevision;
        debe.push({ cuenta: "Sueldos y Salarios", monto: montoTotal });
        haber.push({ cuenta: "Banco",                    monto: liquido   });
        haber.push({ cuenta: "Previsión Social por Pagar", monto: prevision });
    }

    else if (tipo === "nota_credito_compra") {
        // NC de proveedor: reduce deuda con proveedor y crédito fiscal
        const neto = Math.round(montoTotal / factorIva());
        const iva  = montoTotal - neto;
        debe.push({ cuenta: "Proveedores",        monto: montoTotal });
        haber.push({ cuenta: "Mercaderías",        monto: neto       });
        haber.push({ cuenta: "IVA Crédito Fiscal", monto: iva        });
    }

    else if (tipo === "devolucion_venta") {
        // Cliente devuelve: reversa parcial de venta
        const neto = Math.round(montoTotal / factorIva());
        const iva  = montoTotal - neto;
        debe.push({ cuenta: "Devoluciones y Descuentos", monto: neto });
        debe.push({ cuenta: "IVA Débito Fiscal",         monto: iva  });
        flujos.forEach(f => haber.push({ cuenta: f.cuenta, monto: f.monto }));
        if (!flujos.length) haber.push({ cuenta: "Clientes", monto: montoTotal });
    }

    else if (tipo === "traspaso") {
        // Movimiento entre cuentas: caja→banco o banco→caja
        const aBanco = /de.*caja.*a.*banco|caja.*banco/i.test(g);
        debe.push ({ cuenta: aBanco ? "Banco" : "Caja", monto: montoTotal });
        haber.push({ cuenta: aBanco ? "Caja" : "Banco", monto: montoTotal });
    }

    // Glosa generada a mano (no vino de la calculadora) — cualquier ítem
    // pendiente de una generación anterior con la calculadora ya no aplica.
    _calcItemsPendientesInventario = null;
    _calcItemsPendientesCatalogo   = null;

    preasientoActual = {
        glosa,
        debe,
        haber,
        cuentasHint
    };

    renderPreasiento();
}

function renderPreasiento() {

    if (!preasientoActual)
        return;

    const tbody =
        document.getElementById(
            "diarioPreasientoBody"
        );

    tbody.innerHTML = "";

    let totalDebe = 0;
    let totalHaber = 0;

    preasientoActual.debe.forEach(p => {
        totalDebe += p.monto;
        tbody.innerHTML += `
        <tr>
            <td class="cuenta-debe">${p.cuenta}</td>
            <td class="monto">${fmt(p.monto)}</td>
            <td class="monto">-</td>
        </tr>`;
    });

    preasientoActual.haber.forEach(p => {
        totalHaber += p.monto;
        tbody.innerHTML += `
        <tr>
            <td class="cuenta-haber">${p.cuenta}</td>
            <td class="monto">-</td>
            <td class="monto">${fmt(p.monto)}</td>
        </tr>`;
    });

    // Fila de totales
    const cuadrado = Math.abs(totalDebe - totalHaber) < 1;
    tbody.innerHTML += `
    <tr style="border-top:2px solid var(--border);font-weight:700;background:${cuadrado ? '#f0fdf4' : '#fef2f2'};">
        <td style="font-size:12px;color:${cuadrado ? 'var(--positive)' : 'var(--negative)'};">
            ${cuadrado ? '⚖️ Cuadrado' : '❌ Descuadrado'}
        </td>
        <td class="monto" style="color:var(--text);">$${fmt(totalDebe)}</td>
        <td class="monto" style="color:var(--text);">$${fmt(totalHaber)}</td>
    </tr>`;

    const badge = document.getElementById("badgePreasiento");
    const btnAsiento = document.getElementById("btnGuardarAsiento");
    btnAsiento.innerText = asientoEditando ? "💾 Actualizar Asiento" : "💾 Registrar Asiento";
    if (cuadrado) {
        badge.innerText  = `⚖️ Cuadrado: $${fmt(totalDebe)}`;
        badge.className  = "totales-badge ok";
        btnAsiento.disabled = false;
    } else {
        badge.innerText  = `❌ Descuadrado — Debe: $${fmt(totalDebe)} | Haber: $${fmt(totalHaber)}`;
        badge.className  = "totales-badge error";
        btnAsiento.disabled = true;
    }

    if (typeof evaluarImpactoDisponible === 'function') {
        const movsPendientes = [
            ...preasientoActual.debe.map(p => ({ cuenta: p.cuenta, debe: p.monto, haber: 0 })),
            ...preasientoActual.haber.map(p => ({ cuenta: p.cuenta, debe: 0, haber: p.monto })),
        ];
        const impactos = evaluarImpactoDisponible(movsPendientes, { excluirAsientoId: asientoEditando });
        _renderAlertaDisponible('alertaDisponiblePreasiento', impactos);
    }
}

// El botón único de la glosa cambia de "Generar Asiento" a "Registrar/Actualizar
// Asiento" una vez hay un preasiento en pantalla (ver renderPreasiento()); este
// dispatcher decide qué acción corresponde según ese estado.
function manejarBotonAsiento() {
    if (preasientoActual) guardarAsiento();
    else procesarGlosa();
}

// Enter en la glosa: generar el preasiento es inofensivo (solo actualiza la
// vista previa), pero registrar el asiento en el Diario no lo es — si el
// usuario ya generó y presiona Enter de nuevo por error (ej. doble Enter
// seguido), no debe guardarse sin más. Se pide confirmación explícita antes
// de registrar; generar sigue siendo instantáneo.
function manejarEnterGlosa() {
    if (preasientoActual) {
        mostrarConfirm(
            '¿Confirmas registrar este asiento en el Diario?',
            () => guardarAsiento(),
            { titulo: asientoEditando ? 'Confirmar actualización' : 'Confirmar asiento', textoBtn: asientoEditando ? 'Actualizar' : 'Registrar' }
        );
    } else {
        procesarGlosa();
    }
}

// Si el usuario edita el texto de la glosa mientras el botón ya está en modo
// "Registrar/Actualizar", el preasiento en pantalla ya no corresponde al texto
// actual — se descarta y el botón vuelve a modo "Generar" para forzar una
// nueva generación antes de poder guardar.
function _resetBotonAsientoSiCambioGlosa() {
    _calcItemsPendientesInventario = null;
    _calcItemsPendientesCatalogo   = null;
    if (!preasientoActual) return;
    preasientoActual = null;
    const btnAsiento = document.getElementById("btnGuardarAsiento");
    btnAsiento.innerText = "Generar Asiento →";
    btnAsiento.disabled = false;
    document.getElementById("diarioPreasientoBody").innerHTML = "";
    const badge = document.getElementById("badgePreasiento");
    badge.innerText = "Balance: Cuadrado $0";
    badge.className = "totales-badge error";
}

function guardarAsiento() {

    if (!preasientoActual) {
        mostrarToast('Primero genera el asiento desde la glosa.', 'error');
        return;
    }

    const fecha =
        document.getElementById(
            "fechaAsiento"
        ).value;

    if (!fecha) {
        mostrarToast('Selecciona la fecha del asiento.', 'error');
        return;
    }

    const f = fecha.split("-");

const _contactoVal = (document.getElementById('contactoAsiento')?.value || '').trim();

const asiento = {

    id:
        asientoEditando || Date.now(),

    numero:
        asientoEditando
        ? dbAsientos.find(
            a => a.id === asientoEditando
          )?.numero
        : _nextNumeroAsiento(),

    estado: "ACTIVO",

        fecha:
            `${f[2]}/${f[1]}/${f[0]}`,

        glosa:
            preasientoActual.glosa,

        contacto: _contactoVal || null,

        // Si vino de la calculadora, se guarda cómo se armó (ver calcGenerar())
        // para poder reabrirla al editar — ver editarAsiento().
        ...(preasientoActual._calcOrigen ? { _calcOrigen: preasientoActual._calcOrigen } : {}),

        movimientos: [

            // centroCosto/bodega/vencimiento solo los agrega la calculadora de
            // productos (ver calcGenerar()) — se preservan si vienen, sin
            // agregar campos vacíos al resto de los asientos normales.
            ...preasientoActual.debe.map(m => ({
                cuenta: m.cuenta,
                debe: m.monto,
                haber: 0,
                ...(m.centroCosto ? { centroCosto: m.centroCosto } : {}),
                ...(m.bodega ? { bodega: m.bodega } : {}),
                ...(m.vencimiento ? { vencimiento: m.vencimiento } : {}),
            })),

            ...preasientoActual.haber.map(m => ({
                cuenta: m.cuenta,
                debe: 0,
                haber: m.monto,
                ...(m.centroCosto ? { centroCosto: m.centroCosto } : {}),
                ...(m.bodega ? { bodega: m.bodega } : {}),
                ...(m.vencimiento ? { vencimiento: m.vencimiento } : {}),
            }))
        ]
    };

    const verificarSaldoYGuardar = () => {
        const impactos = (typeof evaluarImpactoDisponible === 'function')
            ? evaluarImpactoDisponible(asiento.movimientos, { excluirAsientoId: asientoEditando })
            : [];
        if (impactos.length) {
            _confirmarSaldoInsuficiente(impactos, () => _persistirAsientoDiario(asiento));
        } else {
            _persistirAsientoDiario(asiento);
        }
    };

    const faltantes = _detectarCuentasNoRegistradas(asiento.movimientos);
    if (faltantes.length) {
        _confirmarYCrearCuentasFaltantes(faltantes, verificarSaldoYGuardar, preasientoActual.cuentasHint || {});
    } else {
        verificarSaldoYGuardar();
    }
}

function _persistirAsientoDiario(asiento) {

    // Capturado antes de que se resetee más abajo — decide si los efectos
    // secundarios de la calculadora (inventario, catálogos) tratan esto como
    // una edición o como un alta nueva.
    const esEdicion = !!asientoEditando;

    if (asientoEditando) {

        const index =
            dbAsientos.findIndex(
                a => a.id === asientoEditando
            );

        if (index >= 0)
            dbAsientos[index] = asiento;

    } else {

        dbAsientos.push(asiento);

    }

    localStorage.setItem(
        "core_asientos",
        JSON.stringify(dbAsientos)
    );

    // Si es una edición, primero se borran los movimientos de inventario que
    // ya existían para este asientoId — sea porque cambiaron de cantidad o
    // porque ya no corresponden (ej. se sacó la bodega al editar). Si no se
    // hiciera esto, reabrir y regenerar sumaría stock de nuevo en vez de
    // corregirlo.
    if (esEdicion) {
        const movPrevios = getMovimientosInventario();
        if (movPrevios.some(m => m.asientoId === asiento.id)) {
            saveMovimientosInventario(movPrevios.filter(m => m.asientoId !== asiento.id));
        }
    }

    // Recién acá existe el id real del asiento — si venía de la calculadora
    // con ítems producto+bodega, ahora sí se pueden registrar los movimientos
    // de inventario vinculados a este asiento (ver calcGenerar()).
    if (_calcItemsPendientesInventario) {
        const fPartes = (asiento.fecha || '').split('/'); // DD/MM/YYYY -> YYYY-MM-DD
        const fechaIso = fPartes.length === 3 ? `${fPartes[2]}-${fPartes[1]}-${fPartes[0]}` : undefined;
        const { tipoInventario, items } = _calcItemsPendientesInventario;
        items.forEach(f => {
            invRegistrarMovimiento({
                tipo: tipoInventario,
                producto: f.producto,
                cantidad: f.cantidad,
                bodega: f.bodega,
                centroCosto: f.centroCosto,
                fecha: fechaIso,
                glosa: asiento.glosa,
                asientoId: asiento.id,
            });
        });
        _calcItemsPendientesInventario = null;
    }

    // Igual idea: recién ahora que el asiento es real se suman los productos
    // nuevos al catálogo de Productos y/o los activos fijos nuevos a Activos
    // (ver calcGenerar()) — nunca en el preview. Solo en altas nuevas: si es
    // una edición no se vuelve a sincronizar (evita duplicar el Activo fijo
    // creado la primera vez — no tiene el mismo dedupe-por-nombre que
    // Productos, y podría ya venir editado a mano en el módulo Activos).
    if (_calcItemsPendientesCatalogo && !esEdicion) {
        const fPartes = (asiento.fecha || '').split('/'); // DD/MM/YYYY -> YYYY-MM-DD
        const fechaIso = fPartes.length === 3 ? `${fPartes[2]}-${fPartes[1]}-${fPartes[0]}` : new Date().toISOString().slice(0, 10);
        const { productosNuevos, activosNuevos } = _calcItemsPendientesCatalogo;

        if (productosNuevos.length) {
            const arr = getProductos();
            let cambiado = false;
            productosNuevos.forEach(p => {
                const existente = arr.find(x => x.nombre.trim().toLowerCase() === p.nombre.toLowerCase());
                if (existente) {
                    // No pisa un costo que el usuario ya haya cargado a mano.
                    if (!existente.precio_costo && p.costoUnitario > 0) {
                        existente.precio_costo = p.costoUnitario;
                        cambiado = true;
                    }
                    return;
                }
                arr.push({
                    id: _prodNuevoId(),
                    nombre: p.nombre,
                    descripcion: '',
                    codigo: '',
                    tipo: 'producto',
                    categoria: '',
                    iva: p.afectoIva ? 'afecto' : 'exento',
                    precio_costo: p.costoUnitario,
                    precio_venta: 0,
                    unidad: 'Un',
                    proveedor_id: '',
                    proveedor_nombre: '',
                    cuenta_venta: '',
                    cuenta_compra: 'Mercaderías',
                    activo: true,
                    created_at: Date.now(),
                });
                cambiado = true;
            });
            if (cambiado) saveProductos(arr);
        }

        if (activosNuevos.length) {
            const arr = getActivos();
            activosNuevos.forEach(a => {
                arr.push({
                    id: _activoNuevoId(),
                    nombre: `${a.nombre} (x${a.cantidad})`,
                    descripcion: 'Generado automáticamente desde la calculadora del Diario.',
                    fecha_adquisicion: fechaIso,
                    valor_adquisicion: a.valorNeto,
                    vida_util_anos: 7,
                    metodo: 'lineal',
                    cuenta_activo: a.cuenta,
                    cuenta_dep_acumulada: '',
                    cuenta_gasto_dep: '',
                    proveedor_id: '',
                    proveedor_nombre: '',
                    activo: true,
                    created_at: Date.now(),
                });
            });
            saveActivos(arr);
        }

        _calcItemsPendientesCatalogo = null;
    } else {
        _calcItemsPendientesCatalogo = null;
    }

    asientoEditando = null;
    preasientoActual = null;

    document.getElementById("glosaInput").value = "";
    const _ca = document.getElementById('contactoAsiento');
    if (_ca) _ca.value = '';
    const _ma = document.getElementById('montoAsiento');
    if (_ma) _ma.value = '';

    // Vuelve a modo "Generar Asiento" — listo para la próxima glosa, no depende
    // del balance del asiento recién guardado.
    document.getElementById("btnGuardarAsiento").disabled = false;

    document.getElementById("btnGuardarAsiento").innerText =
        "Generar Asiento →";

    document.getElementById("diarioPreasientoBody").innerHTML =
        `<tr>
            <td colspan="3" style="text-align:center;padding:20px;">
                ✓ Transacción asentada correctamente
            </td>
        </tr>`;

    if (typeof _renderAlertaDisponible === 'function') _renderAlertaDisponible('alertaDisponiblePreasiento', []);

    renderHistorialDiario();

    if (typeof generarLibroMayor === "function")
        generarLibroMayor();

    if (typeof generarBalanceGeneral === "function")
        generarBalanceGeneral();
}

function editarAsiento(id) {

    const asiento =
        dbAsientos.find(
            a => a.id === id
        );

    if (!asiento)
        return;

    asientoEditando = id;
    if (typeof renderIndicadorDisponible === 'function') renderIndicadorDisponible();

    const p =
        asiento.fecha.split("/");

    document.getElementById(
        "fechaAsiento"
    ).value =
        `${p[2]}-${p[1]}-${p[0]}`;

    document.getElementById(
        "glosaInput"
    ).value =
        asiento.glosa;

    const _caEdit = document.getElementById('contactoAsiento');
    if (_caEdit) { _caEdit.value = asiento.contacto || ''; _poblarContactosDL(); }

    preasientoActual = {

        glosa: asiento.glosa,

        debe: asiento.movimientos
            .filter(m => m.debe > 0)
            .map(m => ({
                cuenta: m.cuenta,
                monto: m.debe
            })),

        haber: asiento.movimientos
            .filter(m => m.haber > 0)
            .map(m => ({
                cuenta: m.cuenta,
                monto: m.haber
            }))
    };

    renderPreasiento();

    // Si el asiento se armó con "Varios productos", se reabre la calculadora
    // pre-poblada con los mismos ítems — permite editar cada producto en vez
    // de tener que rehacer todo desde la glosa de texto (ver calcGenerar()).
    if (asiento._calcOrigen) {
        const origen = asiento._calcOrigen;
        calcTipoActual       = origen.tipo;
        filasCalculadora     = origen.items.map(it => ({ ...it }));
        calcPagoDividido     = origen.pagoDividido;
        calcMedioUnico       = origen.medioUnico;
        calcDiasCreditoUnico = origen.diasCreditoUnico;
        calcModoSplit        = origen.modoSplit;
        calcSplitsPago       = origen.splitsPago.map(s => ({ ...s }));
        document.getElementById('calcTipo').value = calcTipoActual;
        document.getElementById('calcPanel').style.display = 'flex';
        document.getElementById('btnCalcAbrir').style.display = 'none';
        calcRenderItems();
        mostrarToast('Este asiento se armó con la calculadora — podés editar cada producto y volver a generar.', 'info');
    } else if (asiento._origenManual) {
        // Se creó con "✏ Asiento Manual" — se reabre ese mismo modal con sus
        // líneas cuenta/debe/haber editables, en vez de la vista de glosa de
        // texto (que no puede reconstruir líneas armadas a mano).
        _abrirAsientoManualParaEditar(asiento);
    }

    document.getElementById(
        "btnGuardarAsiento"
    ).innerText =
        "💾 Actualizar Asiento";

    document.getElementById(
        "btnGuardarAsiento"
    ).disabled = false;
}

function anularAsiento(id){

    const asiento =
        dbAsientos.find(
            a => a.id === id
        );

    if(!asiento){
        return;
    }

    mostrarConfirm(`¿Desea anular el asiento N°${asiento.numero}?`, () => {
        asiento.estado = "ANULADO";

        localStorage.setItem(
            "core_asientos",
            JSON.stringify(dbAsientos)
        );

        renderHistorialDiario();

        if(typeof generarLibroMayor === "function"){
            generarLibroMayor();
        }

        if(typeof generarBalanceGeneral === "function"){
            generarBalanceGeneral();
        }
    });
}

// Solo se ofrece sobre asientos ya ANULADOS (ver renderHistorialDiario) — a
// diferencia de anular, esto saca el registro por completo y cierra el hueco
// en el correlativo: todos los asientos con numero mayor se corren uno hacia
// abajo, así el correlativo activo queda contiguo otra vez (1,2,3…, sin
// saltos). Si en cambio se deja anulado sin eliminar, su numero sigue
// contando tal cual — ver anularAsiento() — y el correlativo total conserva
// ese hueco como constancia de auditoría.
function eliminarAsiento(id) {

    const asiento =
        dbAsientos.find(
            a => a.id === id
        );

    if (!asiento) return;

    mostrarConfirm(`¿Eliminar definitivamente el asiento N°${asiento.numero}? Esta acción no se puede deshacer.`, () => {
        const numeroEliminado = asiento.numero;

        const idx = dbAsientos.findIndex(a => a.id === id);
        if (idx >= 0) dbAsientos.splice(idx, 1);

        // Corre hacia abajo el numero de todo lo que quedó después del
        // eliminado, para que el correlativo activo no arrastre el hueco.
        if (typeof numeroEliminado === 'number' && !isNaN(numeroEliminado)) {
            dbAsientos.forEach(a => {
                if (typeof a.numero === 'number' && a.numero > numeroEliminado) {
                    a.numero -= 1;
                }
            });
        }

        localStorage.setItem(
            "core_asientos",
            JSON.stringify(dbAsientos)
        );

        // Movimientos de inventario que este asiento haya generado (ver
        // calcGenerar()/_persistirAsientoDiario()) quedarían apuntando a un
        // asientoId inexistente si no se limpian acá.
        if (typeof getMovimientosInventario === 'function') {
            const movs = getMovimientosInventario();
            if (movs.some(m => m.asientoId === id)) {
                saveMovimientosInventario(movs.filter(m => m.asientoId !== id));
            }
        }

        renderHistorialDiario();

        if (typeof generarLibroMayor === "function") {
            generarLibroMayor();
        }

        if (typeof generarBalanceGeneral === "function") {
            generarBalanceGeneral();
        }

        mostrarToast('Asiento eliminado.', 'ok');
    });
}

// Suma Debe/Haber de todos los asientos ACTIVOS del mes filtrado (los
// ANULADOS no cuentan, mismo criterio que recopilarMovimientosPorCuenta() en
// js/core/contabilidad.js) y pinta los KPI del toolbar del historial.
function _actualizarKpisHistorialDiario(delMes) {
    const elDebe   = document.getElementById('diarioHistTotalDebe');
    const elHaber  = document.getElementById('diarioHistTotalHaber');
    const elLabel  = document.getElementById('diarioHistEstadoLabel');
    const elEstado = document.getElementById('diarioHistEstadoVal');
    if (!elDebe || !elHaber || !elEstado) return;

    let tDebe = 0, tHaber = 0;
    delMes.forEach(as => {
        if (as.estado === 'ANULADO') return;
        (as.movimientos || []).forEach(m => {
            tDebe  += (m.debe  || 0);
            tHaber += (m.haber || 0);
        });
    });

    elDebe.textContent  = '$' + fmt(tDebe);
    elHaber.textContent = '$' + fmt(tHaber);

    const cuadrado = Math.abs(tDebe - tHaber) < 1;
    elLabel.textContent = cuadrado ? '⚖️ Cuadrado' : '❌ Descuadrado';
    elEstado.textContent = '$' + fmt(Math.max(tDebe, tHaber));
    elEstado.style.color = cuadrado ? 'var(--positive)' : 'var(--negative)';
}

// Asientos del mes/año actualmente filtrados en el historial (diarioHistMes/
// diarioHistAnio) — reusado por renderHistorialDiario() y por
// exportarPDFDiario() (js/services/exportar.js) para no duplicar el filtro.
function _asientosDelMesDiario() {
    return dbAsientos.filter(as => {
        const p = (as.fecha || '').split('/'); // DD/MM/YYYY
        return p.length === 3 && parseInt(p[1], 10) === diarioHistMes && parseInt(p[2], 10) === diarioHistAnio;
    });
}
window._asientosDelMesDiario = _asientosDelMesDiario;

function renderHistorialDiario() {

    if (typeof renderIndicadorDisponible === 'function') renderIndicadorDisponible();

    const div =
        document.getElementById(
            "historialDiarioLista"
        );

    if (!dbAsientos.length) {
        div.innerHTML = "";
        return;
    }

    const delMes = _asientosDelMesDiario();

    _actualizarKpisHistorialDiario(delMes);

    if (!delMes.length) {
        div.innerHTML = `
        <div class="card" style="text-align:center;padding:40px 20px;color:var(--text-muted);">
            <div style="font-size:36px;margin-bottom:10px;">📅</div>
            <p style="margin:0;">Sin asientos registrados en ${_nombreMes(diarioHistMes)} ${diarioHistAnio}.</p>
        </div>`;
        return;
    }

    div.innerHTML = "";

    [...delMes]
    .sort((a,b)=>b.id-a.id)
    .forEach(as => {

        let lineas = "";
        let tDebe = 0, tHaber = 0;

        as.movimientos.forEach(m => {
            tDebe  += (m.debe  || 0);
            tHaber += (m.haber || 0);
            lineas += `
            <tr>
                <td>${m.cuenta}</td>
                <td class="monto">${m.debe  ? '$' + fmt(m.debe)  : '-'}</td>
                <td class="monto">${m.haber ? '$' + fmt(m.haber) : '-'}</td>
            </tr>`;
        });

        const cuadrado = Math.abs(tDebe - tHaber) < 1;
        lineas += `
        <tr style="border-top:2px solid var(--border);font-weight:700;background:${cuadrado ? '#f0fdf4' : '#fef2f2'};">
            <td style="font-size:11px;color:${cuadrado ? 'var(--positive)' : 'var(--negative)'};">
                ${cuadrado ? '⚖️ Cuadrado' : '❌ Descuadrado'}
            </td>
            <td class="monto">$${fmt(tDebe)}</td>
            <td class="monto">$${fmt(tHaber)}</td>
        </tr>`;

        const anulado = as.estado === 'ANULADO';

        div.innerHTML += `
        <div class="card" style="margin-bottom:20px;${anulado ? 'opacity:.5;' : ''}">

            <div style="padding:12px 20px;background:var(--bg);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;border-radius:var(--radius) var(--radius) 0 0;">
                <span style="font-weight:600;">📅 ${as.fecha}</span>
                <span style="color:var(--text-muted);font-size:13px;">"${as.glosa}"</span>
                <div style="display:flex;align-items:center;gap:8px;">
                    ${as.contacto ? `<span style="background:var(--accent-soft);color:var(--accent);padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600;">👤 ${as.contacto}</span>` : ''}
                    ${anulado ? `<span style="background:#fee2e2;color:var(--negative);padding:2px 10px;border-radius:12px;font-size:11px;font-weight:700;">ANULADO</span>` : ''}
                    <span style="font-size:12px;color:var(--text-muted);">N° ${as.numero}</span>
                </div>
            </div>

            ${!anulado ? `
            <div style="padding:8px 12px;display:flex;gap:8px;border-bottom:1px solid var(--border);">
                <button class="btn btn-primary" onclick="editarAsiento(${as.id})">✏️ Editar</button>
                <button class="btn btn-secondary" onclick="anularAsiento(${as.id})">🚫 Anular</button>
            </div>` : `
            <div style="padding:8px 12px;display:flex;gap:8px;border-bottom:1px solid var(--border);">
                <button class="btn btn-danger" onclick="eliminarAsiento(${as.id})">🗑 Eliminar</button>
            </div>`}

            <table class="cont-table">
                <thead>
                    <tr>
                        <th>Cuenta</th>
                        <th class="monto" style="width:150px;">Debe</th>
                        <th class="monto" style="width:150px;">Haber</th>
                    </tr>
                </thead>
                <tbody>${lineas}</tbody>
            </table>

        </div>`;
    });
}

// ─────────────────────────────────────────────────────────────
//  ASIENTO MANUAL
// ─────────────────────────────────────────────────────────────

let filasManual = [];

function _poblarContactosDL() {
    const opts = (window.dbContactos || [])
        .filter(c => c.activo !== false)
        .map(c => `<option value="${c.nombre}${c.rut ? ' — ' + c.rut : ''}">`)
        .join('');
    ['listaContactosAsiento', 'listaContactosManual'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = opts;
    });
}

// Indicador permanente de saldo disponible (Caja/Banco/etc.) — se muestra
// tanto arriba de la calculadora/glosa como dentro del modal de Asiento
// Manual, ya que el modal cubre toda la pantalla. asientoEditando excluye
// el asiento que se está por sobrescribir, si corresponde (ver
// evaluarImpactoDisponible() en contabilidad.js, misma exclusión).
function renderIndicadorDisponible() {
    const destinos = ['diarioDisponibleIndicador', 'manualDisponibleIndicador']
        .map(id => document.getElementById(id))
        .filter(Boolean);
    if (!destinos.length) return;

    const cuentas = (typeof listarCuentasDisponible === 'function') ? listarCuentasDisponible() : [];
    if (!cuentas.length) { destinos.forEach(el => el.innerHTML = ''); return; }

    const saldos = _saldoActualCuentasDisponible(cuentas, asientoEditando || null);

    const html = cuentas.map(c => {
        const saldo = saldos[c] || 0;
        const neg = saldo < 0;
        const montoStr = saldo === 0 ? '0' : fmt(Math.abs(saldo)); // fmt(0) da "-" (ok en tablas, no en este chip)
        return `<span class="disponible-chip${neg ? ' negativo' : ''}">${c}: ${neg ? '-' : ''}$${montoStr} disponible</span>`;
    }).join('');
    destinos.forEach(el => { el.innerHTML = html; });
}
window.renderIndicadorDisponible = renderIndicadorDisponible;

// fmt(0) da "-" (correcto en tablas, se lee como error en un monto suelto).
// Ambas asumen que el llamador ya resolvió el signo (+/-) por su cuenta —
// ver _fmtMontoConSigno() para valores que pueden ser positivos o negativos.
function _fmtMonto(v) { return v === 0 ? '0' : fmt(Math.abs(v)); }
function _fmtMontoConSigno(v) { return (v < 0 ? '-' : '') + '$' + _fmtMonto(v); }

// Pinta el aviso "⚠ Caja quedaría en -$X..." — compartido entre la vista
// previa de la calculadora/glosa (renderPreasiento()) y el Asiento Manual
// (actualizarTotalesManual()), ambos alimentados por evaluarImpactoDisponible().
function _renderAlertaDisponible(elId, impactos) {
    const el = document.getElementById(elId);
    if (!el) return;
    if (!impactos || !impactos.length) {
        el.style.display = 'none';
        el.innerHTML = '';
        return;
    }
    el.style.display = 'block';
    el.className = 'alerta-disponible';
    el.innerHTML = impactos.map(i => {
        const signo = i.delta >= 0 ? '+' : '-';
        return `⚠️ <strong>${i.cuenta}</strong> quedaría en <strong>-$${_fmtMonto(i.saldoProyectado)}</strong>
            (saldo actual ${_fmtMontoConSigno(i.saldoActual)} ${signo} $${_fmtMonto(i.delta)} de este asiento).`;
    }).join('<br>');
}
window._renderAlertaDisponible = _renderAlertaDisponible;

// Confirmación "soft gate" antes de guardar — el usuario puede continuar igual
// (ej. giro en descubierto intencional). Reutiliza evaluarImpactoDisponible()
// como única fuente de verdad, igual que el aviso reactivo de arriba.
function _confirmarSaldoInsuficiente(impactos, onListo) {
    const detalle = impactos.map(i => {
        const signo = i.delta >= 0 ? '+' : '-';
        return `• <strong>${i.cuenta}</strong>: saldo actual ${_fmtMontoConSigno(i.saldoActual)} ${signo} $${_fmtMonto(i.delta)} → quedaría en <strong>-$${_fmtMonto(i.saldoProyectado)}</strong>`;
    }).join('<br>');

    mostrarConfirm(
        `Este asiento dejaría ${impactos.length > 1 ? 'estas cuentas' : 'esta cuenta'} con saldo negativo:<br><br>${detalle}<br><br>` +
        `Si corresponde a un giro en descubierto u otra situación intencional, puedes continuar igual.`,
        onListo,
        { titulo: 'Fondos insuficientes', textoBtn: 'Continuar de todas formas' }
    );
}
window._confirmarSaldoInsuficiente = _confirmarSaldoInsuficiente;

function abrirAsientoManual() {
    if (typeof renderIndicadorDisponible === 'function') renderIndicadorDisponible();
    filasManual = [
        { cuenta: '', debe: 0, haber: 0 },
        { cuenta: '', debe: 0, haber: 0 },
    ];
    renderFilasManual();
    document.getElementById('glosaManual').value = '';
    document.getElementById('fechaManual').value =
        document.getElementById('fechaAsiento').value || '';
    const cm = document.getElementById('contactoManual');
    if (cm) cm.value = '';
    _poblarContactosDL();
    document.getElementById('modalManualTitulo').textContent = '✏️ Asiento Manual';
    document.getElementById('btnGuardarManual').textContent = '💾 Registrar en Diario';
    document.getElementById('modalManual').style.display = 'flex';
}

// Reabre el modal de Asiento Manual pre-poblado con las líneas de un asiento
// ya existente — usado por editarAsiento() cuando ese asiento se creó con
// este mismo modal (ver guardarAsientoManual()). asientoEditando ya viene
// seteado desde editarAsiento(), así que guardarAsientoManual() actualiza en
// vez de crear uno nuevo.
function _abrirAsientoManualParaEditar(asiento) {
    if (typeof renderIndicadorDisponible === 'function') renderIndicadorDisponible();
    filasManual = asiento.movimientos.map(m => ({
        cuenta: m.cuenta,
        debe:   m.debe  || 0,
        haber:  m.haber || 0,
    }));
    if (filasManual.length < 2) filasManual.push({ cuenta: '', debe: 0, haber: 0 });
    renderFilasManual();

    document.getElementById('glosaManual').value = asiento.glosa || '';
    const p = asiento.fecha.split('/');
    document.getElementById('fechaManual').value = `${p[2]}-${p[1]}-${p[0]}`;
    const cm = document.getElementById('contactoManual');
    if (cm) cm.value = asiento.contacto || '';
    _poblarContactosDL();

    document.getElementById('modalManualTitulo').textContent = '✏️ Editar Asiento';
    document.getElementById('btnGuardarManual').textContent = '💾 Actualizar Asiento';
    document.getElementById('modalManual').style.display = 'flex';
}

function cerrarModalManual() {
    document.getElementById('modalManual').style.display = 'none';
}

function agregarFilaManual() {
    filasManual.push({ cuenta: '', debe: 0, haber: 0 });
    renderFilasManual();
}

function eliminarFilaManual(idx) {
    if (filasManual.length <= 2) return;
    filasManual.splice(idx, 1);
    renderFilasManual();
}

function renderFilasManual() {
    const tbody = document.getElementById('tbodyManual');
    if (!tbody) return;

    // Guardar foco actual antes de re-renderizar
    const focusedIdx = document.activeElement?.dataset?.filaIdx;

    tbody.innerHTML = '';

    filasManual.forEach((fila, i) => {
        const tr = document.createElement('tr');

        // ── Cuenta (input con autocomplete) ──────────────────────
        const tdCuenta = document.createElement('td');
        const inputCuenta = document.createElement('input');
        inputCuenta.type        = 'text';
        inputCuenta.className   = 'manual-cuenta-input';
        inputCuenta.value       = fila.cuenta || '';
        inputCuenta.placeholder = 'Escriba la cuenta…';
        inputCuenta.dataset.filaIdx = i;
        inputCuenta.setAttribute('autocomplete', 'off');

        inputCuenta.addEventListener('blur', () => {
            filasManual[i].cuenta = inputCuenta.value.trim();
        });

        initAutocomplete(
            inputCuenta,
            () => Object.keys(PLAN_CUENTAS).filter(c => PLAN_CUENTAS[c].estado !== 'INACTIVA'),
            (val) => { filasManual[i].cuenta = val; }
        );

        tdCuenta.appendChild(inputCuenta);
        tr.appendChild(tdCuenta);

        // ── Debe ─────────────────────────────────────────────────
        const tdDebe = document.createElement('td');
        const inputDebe = document.createElement('input');
        inputDebe.type        = 'number';
        inputDebe.className   = 'manual-debe';
        inputDebe.min         = '0';
        inputDebe.value       = fila.debe || '';
        inputDebe.placeholder = '0';
        inputDebe.addEventListener('input', () => {
            filasManual[i].debe = parseFloat(inputDebe.value) || 0;
            actualizarTotalesManual();
        });
        tdDebe.appendChild(inputDebe);
        tr.appendChild(tdDebe);

        // ── Haber ─────────────────────────────────────────────────
        const tdHaber = document.createElement('td');
        const inputHaber = document.createElement('input');
        inputHaber.type        = 'number';
        inputHaber.className   = 'manual-haber';
        inputHaber.min         = '0';
        inputHaber.value       = fila.haber || '';
        inputHaber.placeholder = '0';
        inputHaber.addEventListener('input', () => {
            filasManual[i].haber = parseFloat(inputHaber.value) || 0;
            actualizarTotalesManual();
        });
        tdHaber.appendChild(inputHaber);
        tr.appendChild(tdHaber);

        // ── Eliminar ──────────────────────────────────────────────
        const tdBtn = document.createElement('td');
        const btn   = document.createElement('button');
        btn.className  = 'btn btn-secondary';
        btn.style.cssText = 'padding:4px 10px;font-size:13px;';
        btn.textContent = '✕';
        btn.addEventListener('click', () => eliminarFilaManual(i));
        tdBtn.appendChild(btn);
        tr.appendChild(tdBtn);

        tbody.appendChild(tr);
    });

    // Restaurar foco si es posible
    if (focusedIdx !== undefined) {
        const inputs = tbody.querySelectorAll('.manual-cuenta-input');
        if (inputs[focusedIdx]) inputs[focusedIdx].focus();
    }

    actualizarTotalesManual();
}

function actualizarTotalesManual() {
    const totD = filasManual.reduce((s, f) => s + (f.debe  || 0), 0);
    const totH = filasManual.reduce((s, f) => s + (f.haber || 0), 0);
    const badge = document.getElementById('badgeManual');
    const btn   = document.getElementById('btnGuardarManual');
    if (!badge) return;

    const cuadrado = Math.abs(totD - totH) < 1;
    badge.innerText = cuadrado
        ? `⚖️ Cuadrado: ${fmt(totD)}`
        : `❌ Descuadrado  Debe: ${fmt(totD)}  Haber: ${fmt(totH)}`;
    badge.className = 'totales-badge ' + (cuadrado ? 'ok' : 'error');
    if (btn) btn.disabled = !cuadrado;

    if (typeof evaluarImpactoDisponible === 'function') {
        const movsPendientes = filasManual
            .filter(f => f.cuenta && (f.debe > 0 || f.haber > 0))
            .map(f => ({ cuenta: f.cuenta, debe: f.debe || 0, haber: f.haber || 0 }));
        const impactos = evaluarImpactoDisponible(movsPendientes, { excluirAsientoId: asientoEditando });
        _renderAlertaDisponible('alertaDisponibleManual', impactos);
    }
}

function guardarAsientoManual() {
    const glosa = document.getElementById('glosaManual').value.trim();
    const fecha = document.getElementById('fechaManual').value;

    if (!glosa) return mostrarToast('La glosa es obligatoria.', 'error');
    if (!fecha) return mostrarToast('La fecha es obligatoria.', 'error');

    const filasFiltradas = filasManual.filter(f => f.cuenta && (f.debe > 0 || f.haber > 0));
    if (filasFiltradas.length < 2) return mostrarToast('Mínimo 2 líneas: una cuenta débito y una crédito.', 'error');

    const totD = filasFiltradas.reduce((s, f) => s + (f.debe  || 0), 0);
    const totH = filasFiltradas.reduce((s, f) => s + (f.haber || 0), 0);
    if (Math.abs(totD - totH) >= 1) return mostrarToast('El asiento no cuadra. Debe = $' + fmt(totD) + ' / Haber = $' + fmt(totH), 'error');

    const f = fecha.split('-');
    const _contactoManualVal = (document.getElementById('contactoManual')?.value || '').trim();
    const asiento = {
        id:
            asientoEditando || Date.now(),
        numero:
            asientoEditando
            ? dbAsientos.find(a => a.id === asientoEditando)?.numero
            : _nextNumeroAsiento(),
        estado: 'ACTIVO',
        fecha:  `${f[2]}/${f[1]}/${f[0]}`,
        glosa,
        contacto: _contactoManualVal || null,
        _origenManual: true, // permite reabrir este mismo modal al editar (ver editarAsiento())
        movimientos: filasFiltradas.map(f => ({
            cuenta: f.cuenta,
            debe:   f.debe  || 0,
            haber:  f.haber || 0,
        })),
    };

    const verificarSaldoYGuardar = () => {
        const impactos = (typeof evaluarImpactoDisponible === 'function')
            ? evaluarImpactoDisponible(asiento.movimientos, { excluirAsientoId: asientoEditando })
            : [];
        if (impactos.length) {
            _confirmarSaldoInsuficiente(impactos, () => _persistirAsientoManual(asiento));
        } else {
            _persistirAsientoManual(asiento);
        }
    };

    const faltantes = _detectarCuentasNoRegistradas(asiento.movimientos);
    if (faltantes.length) {
        _confirmarYCrearCuentasFaltantes(faltantes, verificarSaldoYGuardar);
    } else {
        verificarSaldoYGuardar();
    }
}

function _persistirAsientoManual(asiento) {
    if (asientoEditando) {
        const index = dbAsientos.findIndex(a => a.id === asientoEditando);
        if (index >= 0) dbAsientos[index] = asiento;
    } else {
        dbAsientos.push(asiento);
    }
    localStorage.setItem('core_asientos', JSON.stringify(dbAsientos));

    // Limpia también el estado de edición de la página principal — si venía
    // de editarAsiento(), esa vista quedó con la glosa/tabla del asiento
    // viejo y el botón en modo "Actualizar"; ya no corresponde una vez
    // guardado acá.
    asientoEditando = null;
    preasientoActual = null;
    document.getElementById('glosaInput').value = '';
    const _ca = document.getElementById('contactoAsiento');
    if (_ca) _ca.value = '';
    const _ma = document.getElementById('montoAsiento');
    if (_ma) _ma.value = '';
    const btnAsiento = document.getElementById('btnGuardarAsiento');
    if (btnAsiento) { btnAsiento.innerText = 'Generar Asiento →'; btnAsiento.disabled = false; }
    const _tblPreasiento = document.getElementById('diarioPreasientoBody');
    if (_tblPreasiento) {
        _tblPreasiento.innerHTML =
            '<tr><td colspan="3" style="text-align:center;padding:20px;">✓ Transacción asentada correctamente</td></tr>';
    }
    if (typeof _renderAlertaDisponible === 'function') {
        _renderAlertaDisponible('alertaDisponiblePreasiento', []);
        _renderAlertaDisponible('alertaDisponibleManual', []);
    }

    cerrarModalManual();
    renderHistorialDiario();

    if (typeof generarLibroMayor === 'function')   generarLibroMayor();
    if (typeof generarBalanceGeneral === 'function') generarBalanceGeneral();
}

// ─────────────────────────────────────────────────────────────
//  CALCULADORA DE PRODUCTOS — caso especial de más de un producto en la
//  misma operación. Opcional: colapsada por defecto, no reemplaza la glosa
//  normal. Arma debe/haber directo desde los ítems (sin pasar por el parser
//  de texto), así el monto y el medio de pago no dependen de regex — por
//  eso la glosa final puede quedar sin montos en pesos.
// ─────────────────────────────────────────────────────────────

let filasCalculadora = [];
let calcTipoActual = 'compra';

// Ítems de la calculadora con producto+bodega, pendientes de convertirse en
// movimientos de inventario — se completan recién en _persistirAsientoDiario()
// (ahí ya existe el id real del asiento) y se descartan si el usuario edita
// la glosa/monto después de generar o genera un asiento distinto sin pasar
// por la calculadora (ver _resetBotonAsientoSiCambioGlosa() y procesarGlosa()).
let _calcItemsPendientesInventario = null;

// Igual patrón que _calcItemsPendientesInventario: líneas de una compra que,
// según su cuenta contable, deben sumarse al catálogo de Productos
// (cuenta "Mercaderías") o registrarse como Activo Fijo (cuenta de grupo
// "Activo No Circulante", ej. "Muebles y Útiles") — se aplican recién en
// _persistirAsientoDiario(), nunca en el preview de calcGenerar().
let _calcItemsPendientesCatalogo = null;

const _CALC_ETIQUETA_TIPO = { compra: 'Compra', venta: 'Venta', pago: 'Pago', cobro: 'Cobro' };
const _CALC_MEDIO_PAGO_TEXTO = {
    contado: 'al contado', credito: 'a crédito', transferencia: 'con transferencia',
    cheque: 'con cheque', banco: 'con depósito', tarjeta: 'con tarjeta',
};

// "a crédito" -> "a crédito (30 días)" cuando corresponde; el resto de los
// medios de pago no llevan plazo, se devuelven tal cual.
function _calcTextoMedioPago(medioPago, diasCredito) {
    const base = _CALC_MEDIO_PAGO_TEXTO[medioPago];
    return (medioPago === 'credito' && diasCredito) ? `${base} (${diasCredito} días)` : base;
}

// Fila nueva de la calculadora — afectoIva/tipoValor solo importan en
// compra/venta (ver _calcDesglosarItem()); en pago/cobro se ignoran.
function _calcFilaNueva() {
    return { producto: '', cantidad: 1, precio: 0, cuenta: '', centroCosto: '', bodega: '', afectoIva: true, tipoValor: 'bruto', _ivaManual: false };
}

// Medio de pago — es una propiedad de la operación completa, no de cada
// producto (comprás 3 cosas en la misma boleta, pero el pago se reparte a
// nivel del total, no ítem por ítem). calcPagoDividido=false → un solo medio
// (calcMedioUnico) para todo el total. calcPagoDividido=true → se reparte
// entre calcSplitsPago, cada uno con su medio y su valor (según
// calcModoSplit: '%' del total o '$' monto exacto) — ver _calcResolverSplits().
let calcMedioUnico      = 'contado';
// Plazo del crédito en días — solo aplica cuando el medio es 'credito' (acá
// o por fila de split). Se refleja en la glosa ("a crédito (30 días)") y en
// el vencimiento guardado en el movimiento contra Proveedores/Clientes/
// Acreedores Varios — ver _calcCalcularVencimiento() y _calcResolverSplits().
let calcDiasCreditoUnico = 30;
let calcPagoDividido = false;
let calcModoSplit    = 'porcentaje'; // 'porcentaje' | 'monto'
let calcSplitsPago   = [];

function _calcSplitNuevo(medioPago, valor) {
    return { medioPago: medioPago || 'contado', valor: valor || 0, diasCredito: 30 };
}

function calcAbrir() {
    filasCalculadora = [_calcFilaNueva()];
    calcMedioUnico       = 'contado';
    calcDiasCreditoUnico = 30;
    calcPagoDividido = false;
    calcModoSplit    = 'porcentaje';
    calcSplitsPago   = [_calcSplitNuevo('contado', 50), _calcSplitNuevo('credito', 50)];
    document.getElementById('calcTipo').value = calcTipoActual;
    document.getElementById('calcPanel').style.display = 'flex';
    document.getElementById('btnCalcAbrir').style.display = 'none';
    calcRenderItems();
}
window.calcAbrir = calcAbrir;

function calcCerrar() {
    document.getElementById('calcPanel').style.display = 'none';
    document.getElementById('btnCalcAbrir').style.display = '';
}
window.calcCerrar = calcCerrar;

function calcCambiarTipo(valor) {
    calcTipoActual = valor;
    // Los campos de IVA (afecto/exento, bruto/neto) solo se muestran en
    // compra/venta — hay que re-renderizar para que aparezcan/desaparezcan.
    calcRenderItems();
}
window.calcCambiarTipo = calcCambiarTipo;

function calcAgregarItem() {
    filasCalculadora.push(_calcFilaNueva());
    calcRenderItems();
}
window.calcAgregarItem = calcAgregarItem;

function calcEliminarItem(idx) {
    filasCalculadora.splice(idx, 1);
    calcRenderItems();
}
window.calcEliminarItem = calcEliminarItem;

function calcRenderItems() {
    const cont = document.getElementById('calcTbody');
    if (!cont) return;
    cont.innerHTML = '';

    // Catálogos reales — se releen en cada render para reflejar altas/bajas
    // hechas en Inventario/Productos sin tener que cerrar y reabrir la calculadora.
    const productosActivos = getProductos().filter(p => p.activo !== false);
    const centrosActivos   = getCentrosCosto().filter(c => c.estado !== 'INACTIVO');
    const bodegasActivas   = getBodegas().filter(b => b.estado !== 'INACTIVO');

    const datalist = document.getElementById('calcProductosList');
    if (datalist) {
        datalist.innerHTML = productosActivos.map(p => `<option value="${p.nombre}">`).join('');
    }

    filasCalculadora.forEach((fila, i) => {
        const card = document.createElement('div');
        card.className = 'calc-item-card';
        let selIva = null; // solo existe si el tipo es compra/venta (ver más abajo)

        // ── Encabezado: nombre del producto + eliminar ──────────────
        const head = document.createElement('div');
        head.className = 'calc-item-head';
        const inProducto = document.createElement('input');
        inProducto.type = 'text';
        inProducto.value = fila.producto || '';
        inProducto.placeholder = 'Nombre del producto';
        inProducto.setAttribute('list', 'calcProductosList');
        inProducto.addEventListener('input', () => {
            filasCalculadora[i].producto = inProducto.value;
            // Si coincide con un producto del catálogo, se completan cuenta y
            // precio desde su ficha — solo si el usuario todavía no los tocó,
            // para no pisar lo que ya escribió a mano.
            const match = productosActivos.find(p => p.nombre.trim().toLowerCase() === inProducto.value.trim().toLowerCase());
            if (match) {
                const cuentaCatalogo = calcTipoActual === 'compra' ? match.cuenta_compra : match.cuenta_venta;
                const precioCatalogo = calcTipoActual === 'compra' ? match.precio_costo  : match.precio_venta;
                if (cuentaCatalogo && !filasCalculadora[i].cuenta) {
                    filasCalculadora[i].cuenta = cuentaCatalogo;
                    inCuenta.value = cuentaCatalogo;
                }
                if (precioCatalogo > 0 && !filasCalculadora[i].precio) {
                    filasCalculadora[i].precio = precioCatalogo;
                    inPrecio.value = precioCatalogo;
                    calcActualizarTotal();
                }
                if (selIva && !filasCalculadora[i]._ivaManual) {
                    const catalogoAfecto = match.iva !== 'exento';
                    filasCalculadora[i].afectoIva = catalogoAfecto;
                    selIva.value = catalogoAfecto ? 'afecto' : 'exento';
                }
            }
        });
        head.appendChild(inProducto);
        const btnEliminar = document.createElement('button');
        btnEliminar.type = 'button';
        btnEliminar.textContent = '✕';
        btnEliminar.title = 'Quitar producto';
        btnEliminar.addEventListener('click', () => calcEliminarItem(i));
        head.appendChild(btnEliminar);
        card.appendChild(head);

        // ── Cantidad + Precio ────────────────────────────────────────
        const filaCantPrecio = document.createElement('div');
        filaCantPrecio.className = 'calc-item-2col';
        const inCant = document.createElement('input');
        inCant.type = 'number'; inCant.min = '0'; inCant.placeholder = 'Cant.';
        inCant.value = fila.cantidad || '';
        inCant.addEventListener('input', () => {
            filasCalculadora[i].cantidad = parseFloat(inCant.value) || 0;
            calcActualizarTotal();
        });
        const inPrecio = document.createElement('input');
        inPrecio.type = 'number'; inPrecio.min = '0'; inPrecio.placeholder = 'Precio';
        inPrecio.value = fila.precio || '';
        inPrecio.addEventListener('input', () => {
            filasCalculadora[i].precio = parseFloat(inPrecio.value) || 0;
            calcActualizarTotal();
        });
        filaCantPrecio.appendChild(inCant);
        filaCantPrecio.appendChild(inPrecio);
        card.appendChild(filaCantPrecio);

        // ── Cuenta (autocomplete) ─────────────────────────────────────
        const inCuenta = document.createElement('input');
        inCuenta.type = 'text';
        inCuenta.value = fila.cuenta || '';
        inCuenta.placeholder = 'Cuenta (ej: Mercaderías)';
        inCuenta.setAttribute('autocomplete', 'off');
        inCuenta.addEventListener('blur', () => { filasCalculadora[i].cuenta = inCuenta.value.trim(); });
        initAutocomplete(
            inCuenta,
            () => Object.keys(PLAN_CUENTAS).filter(c => PLAN_CUENTAS[c].estado !== 'INACTIVA'),
            (val) => { filasCalculadora[i].cuenta = val; }
        );
        card.appendChild(inCuenta);

        // ── IVA: afecto/exento + tipo de valor bruto/neto — solo aplica a
        //    compra/venta (pago/cobro nunca calculan IVA, ver calcGenerar()) ──
        if (calcTipoActual === 'compra' || calcTipoActual === 'venta') {
            const filaIva = document.createElement('div');
            filaIva.className = 'calc-item-2col';

            selIva = document.createElement('select');
            [['afecto', 'Afecto a IVA'], ['exento', 'Exento de IVA']].forEach(([val, txt]) => {
                const op = document.createElement('option');
                op.value = val; op.textContent = txt;
                if ((fila.afectoIva !== false) === (val === 'afecto')) op.selected = true;
                selIva.appendChild(op);
            });
            selIva.addEventListener('change', () => {
                filasCalculadora[i].afectoIva = selIva.value === 'afecto';
                filasCalculadora[i]._ivaManual = true;
                calcActualizarTotal();
            });

            const selValor = document.createElement('select');
            [['bruto', 'Bruto (incluye IVA)'], ['neto', 'Neto (sin IVA)']].forEach(([val, txt]) => {
                const op = document.createElement('option');
                op.value = val; op.textContent = txt;
                if ((fila.tipoValor || 'bruto') === val) op.selected = true;
                selValor.appendChild(op);
            });
            selValor.addEventListener('change', () => {
                filasCalculadora[i].tipoValor = selValor.value;
                calcActualizarTotal();
            });

            filaIva.appendChild(selIva);
            filaIva.appendChild(selValor);
            card.appendChild(filaIva);
        }

        // ── Centro de costo + Bodega — selects reales contra los catálogos ──
        const filaCentroBodega = document.createElement('div');
        filaCentroBodega.className = 'calc-item-2col';
        const selCentro = document.createElement('select');
        const optSinCentro = document.createElement('option');
        optSinCentro.value = ''; optSinCentro.textContent = '— Sin centro —';
        selCentro.appendChild(optSinCentro);
        centrosActivos.forEach(c => {
            const op = document.createElement('option');
            op.value = c.nombre; op.textContent = c.nombre;
            if (fila.centroCosto === c.nombre) op.selected = true;
            selCentro.appendChild(op);
        });
        selCentro.addEventListener('change', () => { filasCalculadora[i].centroCosto = selCentro.value; });
        const selBodega = document.createElement('select');
        const optSinBodega = document.createElement('option');
        optSinBodega.value = ''; optSinBodega.textContent = '— Sin bodega —';
        selBodega.appendChild(optSinBodega);
        bodegasActivas.forEach(b => {
            const op = document.createElement('option');
            op.value = b.nombre; op.textContent = b.nombre;
            if (fila.bodega === b.nombre) op.selected = true;
            selBodega.appendChild(op);
        });
        selBodega.addEventListener('change', () => { filasCalculadora[i].bodega = selBodega.value; });
        filaCentroBodega.appendChild(selCentro);
        filaCentroBodega.appendChild(selBodega);
        card.appendChild(filaCentroBodega);

        cont.appendChild(card);
    });

    _calcRenderPago();
    calcActualizarTotal();
}

// Select chico de 30/60/90 días — reutilizado en el medio único y en cada
// fila de split, solo cuando ese medio es 'credito'.
function _calcCrearSelectDias(valorActual, onChange) {
    const sel = document.createElement('select');
    sel.style.width = '110px';
    [30, 60, 90].forEach(dias => {
        const op = document.createElement('option');
        op.value = String(dias);
        op.textContent = dias + ' días';
        if (Number(valorActual) === dias) op.selected = true;
        sel.appendChild(op);
    });
    sel.addEventListener('change', () => onChange(Number(sel.value)));
    return sel;
}

// ── Panel de medio de pago — a nivel de toda la operación, ver comentario
//    junto a calcMedioUnico más arriba. ──────────────────────────────────
function _calcRenderPago() {
    const cont = document.getElementById('calcPagoPanel');
    if (!cont) return;
    cont.innerHTML = '';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;';
    const label = document.createElement('span');
    label.style.cssText = 'font-size:12px;font-weight:700;color:var(--text-muted);';
    label.textContent = 'Medio de pago';
    header.appendChild(label);

    const toggleLbl = document.createElement('label');
    toggleLbl.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;';
    const chkDividir = document.createElement('input');
    chkDividir.type = 'checkbox';
    chkDividir.checked = calcPagoDividido;
    chkDividir.addEventListener('change', () => { calcPagoDividido = chkDividir.checked; _calcRenderPago(); });
    toggleLbl.appendChild(chkDividir);
    toggleLbl.appendChild(document.createTextNode('Dividir en varios medios'));
    header.appendChild(toggleLbl);
    cont.appendChild(header);

    if (!calcPagoDividido) {
        const fila = document.createElement('div');
        fila.style.cssText = 'display:flex;gap:6px;';

        const sel = document.createElement('select');
        sel.style.flex = '1';
        Object.entries(_CALC_MEDIO_PAGO_TEXTO).forEach(([val, txt]) => {
            const op = document.createElement('option');
            op.value = val; op.textContent = txt;
            if (calcMedioUnico === val) op.selected = true;
            sel.appendChild(op);
        });
        sel.addEventListener('change', () => { calcMedioUnico = sel.value; _calcRenderPago(); });
        fila.appendChild(sel);

        if (calcMedioUnico === 'credito') {
            fila.appendChild(_calcCrearSelectDias(calcDiasCreditoUnico, dias => { calcDiasCreditoUnico = dias; }));
        }

        cont.appendChild(fila);
        return;
    }

    // ── Modo: porcentaje del total o monto exacto ──────────────────────
    const modoRow = document.createElement('div');
    modoRow.style.cssText = 'display:flex;gap:14px;font-size:12px;';
    [['porcentaje', '% Porcentaje'], ['monto', '$ Monto']].forEach(([val, txt]) => {
        const lbl = document.createElement('label');
        lbl.style.cssText = 'display:flex;align-items:center;gap:4px;cursor:pointer;';
        const radio = document.createElement('input');
        radio.type = 'radio'; radio.name = 'calcModoSplit'; radio.value = val;
        radio.checked = calcModoSplit === val;
        radio.addEventListener('change', () => { calcModoSplit = val; _calcRenderPago(); });
        lbl.appendChild(radio);
        lbl.appendChild(document.createTextNode(txt));
        modoRow.appendChild(lbl);
    });
    cont.appendChild(modoRow);

    calcSplitsPago.forEach((split, i) => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:6px;align-items:center;';

        const selMedio = document.createElement('select');
        selMedio.style.flex = '1';
        Object.entries(_CALC_MEDIO_PAGO_TEXTO).forEach(([val, txt]) => {
            const op = document.createElement('option');
            op.value = val; op.textContent = txt;
            if (split.medioPago === val) op.selected = true;
            selMedio.appendChild(op);
        });
        selMedio.addEventListener('change', () => { calcSplitsPago[i].medioPago = selMedio.value; _calcRenderPago(); });

        const inValor = document.createElement('input');
        inValor.type = 'number'; inValor.min = '0';
        inValor.style.width = '90px';
        inValor.value = split.valor || '';
        inValor.placeholder = calcModoSplit === 'porcentaje' ? '%' : '$';
        inValor.addEventListener('input', () => {
            calcSplitsPago[i].valor = parseFloat(inValor.value) || 0;
            _calcActualizarResumenSplit();
        });

        const btnDel = document.createElement('button');
        btnDel.type = 'button';
        btnDel.textContent = '✕';
        btnDel.title = 'Quitar medio de pago';
        btnDel.disabled = calcSplitsPago.length <= 2;
        btnDel.addEventListener('click', () => { calcSplitsPago.splice(i, 1); _calcRenderPago(); });

        row.appendChild(selMedio);
        if (split.medioPago === 'credito') {
            row.appendChild(_calcCrearSelectDias(split.diasCredito, dias => { calcSplitsPago[i].diasCredito = dias; }));
        }
        row.appendChild(inValor);
        row.appendChild(btnDel);
        cont.appendChild(row);
    });

    const btnAgregar = document.createElement('button');
    btnAgregar.type = 'button';
    btnAgregar.className = 'btn btn-secondary';
    btnAgregar.style.cssText = 'width:100%;font-size:12px;padding:6px;';
    btnAgregar.textContent = '➕ Agregar medio de pago';
    btnAgregar.addEventListener('click', () => { calcSplitsPago.push(_calcSplitNuevo()); _calcRenderPago(); });
    cont.appendChild(btnAgregar);

    const resumen = document.createElement('div');
    resumen.id = 'calcSplitResumen';
    resumen.style.cssText = 'font-size:11px;';
    cont.appendChild(resumen);
    _calcActualizarResumenSplit();
}

// Muestra si lo repartido en los splits ya cuadra con el 100% / el total —
// se recalcula en cada tecleo, sin esperar a "Generar" para avisar.
function _calcActualizarResumenSplit() {
    const el = document.getElementById('calcSplitResumen');
    if (!el || !calcPagoDividido) return;
    const suma = calcSplitsPago.reduce((s, x) => s + (x.valor || 0), 0);
    if (calcModoSplit === 'porcentaje') {
        el.textContent = `Asignado: ${suma}% de 100%`;
        el.style.color = Math.abs(suma - 100) < 0.01 ? 'var(--text-muted)' : 'var(--negative,#991b1b)';
    } else {
        const total = filasCalculadora.reduce((s, f) => s + _calcDesglosarItem(f).totalPago, 0);
        el.textContent = `Asignado: $${fmt(suma)} de $${fmt(total)}`;
        el.style.color = Math.abs(suma - total) < 1 ? 'var(--text-muted)' : 'var(--negative,#991b1b)';
    }
}

// Fecha de la glosa + días de crédito -> fecha de vencimiento (YYYY-MM-DD).
// undefined si el medio no es crédito o no hay fecha de asiento todavía.
function _calcCalcularVencimiento(diasCredito) {
    if (!diasCredito) return undefined;
    const fechaBase = document.getElementById('fechaAsiento')?.value;
    if (!fechaBase) return undefined;
    const d = new Date(fechaBase + 'T00:00:00');
    d.setDate(d.getDate() + Number(diasCredito));
    return d.toISOString().slice(0, 10);
}

// El efectivo ("contado") siempre se paga en decenas cerradas — no hay
// monedas/billetes bajo $10. Redondea esa línea al múltiplo de 10 más
// cercano y, si hay otro medio de pago en la misma operación, le resta la
// diferencia para que la suma total no cambie (el asiento sigue cuadrando
// sin tocar Mercaderías/IVA). Si el contado es el único medio, no hay otra
// línea de pago que absorba el ajuste acá — queda a cargo de calcGenerar(),
// que lo compensa en la línea de IVA (ver ajusteRedondeoContado).
function _calcRedondearContadoADecena(splits) {
    const idxContado = splits.findIndex(s => s.medioPago === 'contado');
    if (idxContado === -1) return splits;

    const original    = splits[idxContado].monto;
    const redondeado   = Math.round(original / 10) * 10;
    if (redondeado === original) return splits;

    splits[idxContado].monto = redondeado;

    if (splits.length > 1) {
        const delta = redondeado - original;
        const idxOtro = splits.map((_, i) => i).filter(i => i !== idxContado).pop();
        splits[idxOtro].monto -= delta;
    }

    return splits;
}

// Convierte el split configurado en líneas {medioPago, monto, vencimiento}
// concretas contra el total real. En modo porcentaje, la última fila
// absorbe el resto (en vez de redondear cada una) para no dejar diferencias
// de redondeo sueltas entre las cuentas.
function _calcResolverSplits(total) {
    let resultado;
    if (!calcPagoDividido) {
        const diasCredito = calcMedioUnico === 'credito' ? calcDiasCreditoUnico : undefined;
        resultado = [{ medioPago: calcMedioUnico, monto: total, diasCredito, vencimiento: _calcCalcularVencimiento(diasCredito) }];
    } else if (calcModoSplit === 'monto') {
        resultado = calcSplitsPago.map(s => {
            const diasCredito = s.medioPago === 'credito' ? s.diasCredito : undefined;
            return { medioPago: s.medioPago, monto: s.valor || 0, diasCredito, vencimiento: _calcCalcularVencimiento(diasCredito) };
        });
    } else {
        let acumulado = 0;
        resultado = calcSplitsPago.map((s, i) => {
            const esUltimo = i === calcSplitsPago.length - 1;
            const monto = esUltimo ? total - acumulado : Math.round(total * (s.valor || 0) / 100);
            acumulado += monto;
            const diasCredito = s.medioPago === 'credito' ? s.diasCredito : undefined;
            return { medioPago: s.medioPago, monto, diasCredito, vencimiento: _calcCalcularVencimiento(diasCredito) };
        });
    }

    // Solo compra/venta tienen línea de IVA donde absorber el caso de medio
    // único (ver calcGenerar()) — en pago/cobro el efectivo se deja exacto.
    if (calcTipoActual === 'compra' || calcTipoActual === 'venta') {
        resultado = _calcRedondearContadoADecena(resultado);
    }
    return resultado;
}

// Desglosa un ítem en neto/iva/totalPago según si es afecto a IVA y si el
// precio ingresado es bruto (con IVA, comportamiento histórico) o neto (sin
// IVA). Pago/Cobro nunca calculan IVA — el precio ingresado ya es el total.
function _calcDesglosarItem(f) {
    const base = (f.cantidad || 0) * (f.precio || 0);
    if (calcTipoActual !== 'compra' && calcTipoActual !== 'venta') {
        return { neto: base, iva: 0, totalPago: base };
    }
    if (f.afectoIva === false) {
        return { neto: base, iva: 0, totalPago: base };
    }
    if (f.tipoValor === 'neto') {
        const totalPago = Math.round(base * factorIva());
        return { neto: base, iva: totalPago - base, totalPago };
    }
    // Bruto (default): el precio ingresado ya incluye IVA.
    const neto = Math.round(base / factorIva());
    return { neto, iva: base - neto, totalPago: base };
}

function calcActualizarTotal() {
    const total = filasCalculadora.reduce((s, f) => s + _calcDesglosarItem(f).totalPago, 0);
    const badge = document.getElementById('calcTotal');
    if (badge) badge.textContent = '$' + fmt(total);
    _calcActualizarResumenSplit();
}

// Agrupa líneas de debe/haber por cuenta, sumando el monto. centroCosto/bodega
// se conservan solo si todas las líneas fusionadas comparten el mismo valor
// (si difieren, una sola línea no puede representarlos y se dejan vacíos).
function _calcFusionarLineas(lineas) {
    const mapa = new Map();
    lineas.forEach(l => {
        const prev = mapa.get(l.cuenta);
        if (prev) {
            prev.monto += l.monto;
            if (prev.centroCosto  !== l.centroCosto)  prev.centroCosto  = undefined;
            if (prev.bodega       !== l.bodega)       prev.bodega       = undefined;
            if (prev.vencimiento  !== l.vencimiento)  prev.vencimiento  = undefined;
        } else {
            mapa.set(l.cuenta, { ...l });
        }
    });
    return Array.from(mapa.values());
}

// {tipo, grupo} de una cuenta — primero contra el Plan de Cuentas real del
// usuario (si ya la registró ahí), si no existe se infiere por el nombre
// (mismo criterio que usa el resto del Diario para cuentas nuevas).
function _calcGrupoCuenta(cuenta) {
    if (window.PLAN_CUENTAS?.[cuenta]?.grupo) return window.PLAN_CUENTAS[cuenta].grupo;
    if (typeof _inferirTipoGrupoCuenta === 'function') return _inferirTipoGrupoCuenta(cuenta).grupo;
    return undefined;
}

function calcGenerar() {
    const items = filasCalculadora.filter(f => f.producto.trim() && f.cantidad > 0 && f.precio > 0);
    if (!items.length) return mostrarToast('Agrega al menos un producto con nombre, cantidad y precio.', 'error');

    _calcItemsPendientesCatalogo = null;
    const montoTotalItems = items.reduce((s, f) => s + _calcDesglosarItem(f).totalPago, 0);

    // El split de pago es a nivel de toda la operación (ver comentario junto
    // a calcMedioUnico) — hay que validar que cuadre antes de generar nada.
    if (calcPagoDividido) {
        const sumaValores = calcSplitsPago.reduce((s, x) => s + (x.valor || 0), 0);
        if (calcSplitsPago.some(s => !s.valor || s.valor <= 0)) {
            return mostrarToast('Cada medio de pago del split debe tener un monto o porcentaje mayor a 0.', 'error');
        }
        if (calcModoSplit === 'porcentaje' && Math.abs(sumaValores - 100) > 0.5) {
            return mostrarToast(`Los porcentajes suman ${sumaValores}% — deben sumar 100%.`, 'error');
        }
        if (calcModoSplit === 'monto' && Math.abs(sumaValores - montoTotalItems) > 1) {
            return mostrarToast(`Los montos del split suman $${fmt(sumaValores)} pero el total es $${fmt(montoTotalItems)}.`, 'error');
        }
    }
    const splitsResueltos = _calcResolverSplits(montoTotalItems);

    const partesGlosa = items.map(f => `${f.cantidad} ${f.producto.trim()}`);
    let glosaTexto = `${_CALC_ETIQUETA_TIPO[calcTipoActual]}: ${partesGlosa.join(', ')}`;
    glosaTexto += !calcPagoDividido
        ? ` — ${_calcTextoMedioPago(calcMedioUnico, calcDiasCreditoUnico)}`
        : ` — ${splitsResueltos.map(s => `$${fmt(s.monto)} ${_calcTextoMedioPago(s.medioPago, s.diasCredito)}`).join(' + ')}`;

    let debe = [], haber = [];
    const cuentasHint = {};

    // Contrapartida por medio de pago — no lleva centro/bodega (no es un producto).
    // esMercaderia decide, en una compra a crédito, si la deuda es "Proveedores"
    // (compra de mercadería, deuda comercial) o "Acreedores Varios" (cualquier
    // otra cosa — activo fijo, gasto, etc.) — mismo criterio que ya usa el parser
    // de glosa libre (ver clasificarCuentaFinanciera() en js/core/parser.js).
    // vencimiento (crédito 30/60/90 días) se conserva por cuenta solo si todos
    // los splits que caen en esa misma cuenta comparten la misma fecha — igual
    // criterio que centroCosto/bodega en _calcFusionarLineas().
    const _flujoPorMedio = (tipoParaClasificar, esMercaderia) => {
        const porMedio = {};
        splitsResueltos.forEach(s => {
            const cuenta = clasificarCuentaFinanciera(s.medioPago, tipoParaClasificar, !!esMercaderia);
            if (!porMedio[cuenta]) porMedio[cuenta] = { monto: 0, vencimiento: s.vencimiento };
            porMedio[cuenta].monto += s.monto;
            if (porMedio[cuenta].vencimiento !== s.vencimiento) porMedio[cuenta].vencimiento = undefined;
        });
        return Object.entries(porMedio).map(([cuenta, v]) => ({ cuenta, monto: v.monto, vencimiento: v.vencimiento }));
    };

    if (calcTipoActual === 'compra' || calcTipoActual === 'venta') {
        let totalIva = 0;
        const lineasProducto = items.map(f => {
            const { neto, iva } = _calcDesglosarItem(f);
            totalIva += iva;
            return {
                cuenta: f.cuenta || (calcTipoActual === 'compra' ? 'Mercaderías' : 'Ingresos por Ventas'),
                monto: neto,
                centroCosto: f.centroCosto || undefined,
                bodega: f.bodega || undefined,
            };
        });
        const cuentaIva = calcTipoActual === 'compra' ? 'IVA Crédito Fiscal' : 'IVA Débito Fiscal';

        // Si el contado (único medio, sin otro que compense) se redondeó a la
        // decena, la suma de splitsResueltos ya no coincide exactamente con
        // montoTotalItems — la diferencia (pocos pesos) se absorbe acá, en el
        // IVA, para que el asiento siga cuadrando (ver
        // _calcRedondearContadoADecena()).
        const ajusteRedondeoContado = splitsResueltos.reduce((s, x) => s + x.monto, 0) - montoTotalItems;
        totalIva += ajusteRedondeoContado;

        // Sin línea de IVA si todos los ítems son exentos (totalIva = 0) — no
        // tiene sentido mostrar una cuenta de IVA en $0.
        const lineaIva = totalIva > 0 ? [{ cuenta: cuentaIva, monto: totalIva }] : [];
        // "Es mercadería" si TODAS las líneas de producto quedaron en la cuenta
        // Mercaderías — si hay alguna cuenta distinta (activo fijo, gasto, etc.)
        // en la misma compra, se trata como deuda no comercial (Acreedores Varios).
        const esMercaderiaCompra = lineasProducto.length > 0 && lineasProducto.every(l => l.cuenta === 'Mercaderías');
        const contrapartida = _flujoPorMedio(calcTipoActual, esMercaderiaCompra);

        if (calcTipoActual === 'compra') {
            debe  = [...lineasProducto, ...lineaIva];
            haber = contrapartida;

            // Sincronizar catálogos según la cuenta de cada línea: "Mercaderías"
            // se suma al catálogo de Productos (si no existe ya, por nombre);
            // cualquier cuenta de grupo "Activo No Circulante" (ej. Muebles y
            // Útiles) se registra como Activo Fijo, un registro por línea.
            // Pendiente hasta que el asiento se registre de verdad (ver
            // _persistirAsientoDiario()) — así no se ensucian los catálogos con
            // cada preview de la calculadora.
            const productosNuevos = [];
            const activosNuevos = [];
            items.forEach((f, idx) => {
                const linea = lineasProducto[idx];
                const costoUnitario = f.cantidad > 0 ? Math.round(linea.monto / f.cantidad) : 0;
                if (linea.cuenta === 'Mercaderías') {
                    productosNuevos.push({ nombre: f.producto.trim(), costoUnitario, afectoIva: f.afectoIva !== false });
                } else if (_calcGrupoCuenta(linea.cuenta) === 'Activo No Circulante') {
                    activosNuevos.push({ nombre: f.producto.trim(), cantidad: f.cantidad, valorNeto: linea.monto, cuenta: linea.cuenta });
                }
            });
            _calcItemsPendientesCatalogo = (productosNuevos.length || activosNuevos.length)
                ? { productosNuevos, activosNuevos }
                : null;
        } else {
            debe  = contrapartida;
            haber = [...lineasProducto, ...lineaIva];

            // Costo de Ventas / Mercaderías — inventario perpetuo: se da de baja el
            // costo de compra de lo vendido (no el precio de venta), para que la
            // utilidad bruta (Ingresos − Costo de Ventas) quede calculable. El costo
            // sale del catálogo de Productos (precio_costo), igual que ya se usa para
            // autocompletar el precio de compra en calcRenderItems().
            const catalogo = getProductos();
            let totalCosto = 0;
            let algunSinCosto = false;
            items.forEach(f => {
                const match = catalogo.find(p => p.nombre.trim().toLowerCase() === f.producto.trim().toLowerCase());
                if (match && match.precio_costo > 0) {
                    totalCosto += f.cantidad * match.precio_costo;
                } else {
                    algunSinCosto = true;
                }
            });
            if (totalCosto > 0) {
                debe.push({ cuenta: 'Costo de Ventas', monto: totalCosto });
                haber.push({ cuenta: 'Mercaderías', monto: totalCosto });
            }
            if (algunSinCosto) {
                mostrarToast('Algunos productos no tienen costo registrado en el catálogo — no se incluyeron en el Costo de Ventas.', 'info');
            }
        }
    } else {
        // Pago/Cobro: sin IVA — una pata contra Proveedores/Clientes (o la cuenta
        // que se haya indicado por ítem), la otra contra el medio de pago.
        const lineasProducto = items.map(f => ({
            cuenta: f.cuenta || (calcTipoActual === 'pago' ? 'Proveedores' : 'Clientes'),
            monto: f.cantidad * f.precio,
            centroCosto: f.centroCosto || undefined,
            bodega: f.bodega || undefined,
        }));
        const contrapartida = _flujoPorMedio(calcTipoActual === 'pago' ? 'compra' : 'venta');

        if (calcTipoActual === 'pago') {
            debe  = lineasProducto;   // se reduce la deuda con el proveedor
            haber = contrapartida;    // sale de caja/banco
        } else {
            debe  = contrapartida;    // entra a caja/banco
            haber = lineasProducto;   // se reduce lo que debía el cliente
        }
    }

    // Varios ítems pueden compartir la misma cuenta (ej. dos productos con
    // cuenta "Mercaderías") — se fusionan en una sola línea con el monto
    // sumado, en vez de repetir la cuenta varias veces en el asiento.
    debe  = _calcFusionarLineas(debe);
    haber = _calcFusionarLineas(haber);

    [...debe, ...haber].forEach(l => {
        if (!window.PLAN_CUENTAS?.[l.cuenta] && typeof _inferirTipoGrupoCuenta === 'function') {
            cuentasHint[l.cuenta] = _inferirTipoGrupoCuenta(l.cuenta);
        }
    });

    document.getElementById('glosaInput').value = glosaTexto;
    document.getElementById('montoAsiento').value = montoTotalItems;

    // Solo compra/venta mueven stock físico (pago/cobro son solo movimiento de
    // caja). Solo ítems con producto Y bodega llenos generan movimiento — el
    // resto de los campos (centroCosto) es opcional. Se guarda acá, pendiente
    // de asientoId real, que recién existe cuando se registra (ver
    // _persistirAsientoDiario()).
    if (calcTipoActual === 'compra' || calcTipoActual === 'venta') {
        const itemsConBodega = items.filter(f => f.bodega && f.bodega.trim());
        _calcItemsPendientesInventario = itemsConBodega.length
            ? { tipoInventario: calcTipoActual === 'compra' ? 'ingreso' : 'egreso', items: itemsConBodega }
            : null;
    } else {
        _calcItemsPendientesInventario = null;
    }

    // Snapshot de cómo se armó este asiento en la calculadora — se guarda en
    // el asiento persistido (ver _persistirAsientoDiario()) para que
    // editarAsiento() pueda reabrir la calculadora con los mismos productos
    // en vez de forzar a rehacer todo desde una glosa de texto plano.
    const _calcOrigen = {
        tipo: calcTipoActual,
        items: items.map(f => ({ ...f })),
        pagoDividido: calcPagoDividido,
        medioUnico: calcMedioUnico,
        diasCreditoUnico: calcDiasCreditoUnico,
        modoSplit: calcModoSplit,
        splitsPago: calcSplitsPago.map(s => ({ ...s })),
    };

    preasientoActual = { glosa: glosaTexto, debe, haber, cuentasHint, _calcOrigen };
    renderPreasiento();
    calcCerrar();
    mostrarToast('Asiento generado desde la calculadora — revisa y registra.', 'ok');
}
window.calcGenerar = calcGenerar;
