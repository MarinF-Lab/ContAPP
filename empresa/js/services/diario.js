
let preasientoActual = null;
let asientoEditando = null;

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

// Mantener alias para compatibilidad con código existente
const _ACTIVO_KEYWORDS = _CUENTA_KEYWORDS;
function _clasificarActivoInicial(texto) { return _clasificarCuentaInicial(texto) || 'Caja'; }

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

function procesarGlosa() {

    const glosa =
        document.getElementById("glosaInput")
        .value
        .trim();

    if (!glosa)
        return alert("Ingrese glosa válida comercial");

    let montoTotal = extraerMontoTotal(glosa);

    if (!montoTotal)
        return alert("Monto comercial no detectado");

    let tipo = "desconocido";

    const g = glosa.toLowerCase();

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

    if (tipo === "desconocido")
        return alert(
            "No se reconoció el tipo de operación contable.\n\n" +
            "Ejemplos reconocidos:\n" +
            "• Venta de mercadería por $200.000 al contado\n" +
            "• Compra de mercadería por $300.000 a crédito\n" +
            "• Depósito de $500.000 en banco desde caja\n" +
            "• Retiro de $100.000 desde banco a caja\n" +
            "• Cobro a cliente por $150.000 con transferencia\n" +
            "• Pago a proveedor por $80.000 con cheque\n" +
            "• Gasto de arriendo por $200.000 con transferencia\n" +
            "• Recibimos préstamo bancario por $1.000.000\n" +
            "• Pago cuota préstamo $50.000 intereses $5.000\n" +
            "• Pago de remuneraciones por $800.000\n" +
            "• Nota de crédito de proveedor por $100.000\n" +
            "• Devolución de venta cliente por $50.000\n" +
            "• Traspaso de caja a banco por $300.000"
        );

    let debe = [];
    let haber = [];

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

        if (/publicidad|marketing/i.test(g))
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
            cuentaGasto = "Comisiones";

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
        if (intereses > 0) debe.push({ cuenta: "Intereses y Gastos Financieros", monto: intereses });
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

    preasientoActual = {
        glosa,
        debe,
        haber
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
    if (cuadrado) {
        badge.innerText  = `⚖️ Cuadrado: $${fmt(totalDebe)}`;
        badge.className  = "totales-badge ok";
        document.getElementById("btnGuardarAsiento").disabled = false;
    } else {
        badge.innerText  = `❌ Descuadrado — Debe: $${fmt(totalDebe)} | Haber: $${fmt(totalHaber)}`;
        badge.className  = "totales-badge error";
        document.getElementById("btnGuardarAsiento").disabled = true;
    }
}

function guardarAsiento() {

    if (!preasientoActual) {
        alert("Debe generar un asiento primero.");
        return;
    }

    const fecha =
        document.getElementById(
            "fechaAsiento"
        ).value;

    if (!fecha) {
        alert("Debe ingresar una fecha.");
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

        movimientos: [

            ...preasientoActual.debe.map(m => ({
                cuenta: m.cuenta,
                debe: m.monto,
                haber: 0
            })),

            ...preasientoActual.haber.map(m => ({
                cuenta: m.cuenta,
                debe: 0,
                haber: m.monto
            }))
        ]
    };

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

    asientoEditando = null;
    preasientoActual = null;

    document.getElementById("glosaInput").value = "";
    const _ca = document.getElementById('contactoAsiento');
    if (_ca) _ca.value = '';

    document.getElementById("btnGuardarAsiento").disabled = true;

    document.getElementById("btnGuardarAsiento").innerText =
        "💾 Registrar en Diario";

    document.getElementById("diarioPreasientoBody").innerHTML =
        `<tr>
            <td colspan="3" style="text-align:center;padding:20px;">
                ✓ Transacción asentada correctamente
            </td>
        </tr>`;

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

    if(
        !confirm(
            `¿Desea anular el asiento N°${asiento.numero}?`
        )
    ){
        return;
    }

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
}
function renderHistorialDiario() {

    const div =
        document.getElementById(
            "historialDiarioLista"
        );

    if (!dbAsientos.length) {
        div.innerHTML = "";
        return;
    }

    div.innerHTML = "";

    [...dbAsientos]
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
            </div>` : ''}

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

function abrirAsientoManual() {
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
}

function guardarAsientoManual() {
    const glosa = document.getElementById('glosaManual').value.trim();
    const fecha = document.getElementById('fechaManual').value;

    if (!glosa) return alert('Ingrese una glosa para el asiento.');
    if (!fecha) return alert('Ingrese la fecha del asiento.');

    const filasFiltradas = filasManual.filter(f => f.cuenta && (f.debe > 0 || f.haber > 0));
    if (filasFiltradas.length < 2) return alert('El asiento debe tener al menos 2 líneas con cuenta y monto.');

    const totD = filasFiltradas.reduce((s, f) => s + (f.debe  || 0), 0);
    const totH = filasFiltradas.reduce((s, f) => s + (f.haber || 0), 0);
    if (Math.abs(totD - totH) >= 1) return alert('El asiento no cuadra. Verifique Debe y Haber.');

    const f = fecha.split('-');
    const _contactoManualVal = (document.getElementById('contactoManual')?.value || '').trim();
    const asiento = {
        id:     Date.now(),
        numero: _nextNumeroAsiento(),
        estado: 'ACTIVO',
        fecha:  `${f[2]}/${f[1]}/${f[0]}`,
        glosa,
        contacto: _contactoManualVal || null,
        movimientos: filasFiltradas.map(f => ({
            cuenta: f.cuenta,
            debe:   f.debe  || 0,
            haber:  f.haber || 0,
        })),
    };

    dbAsientos.push(asiento);
    localStorage.setItem('core_asientos', JSON.stringify(dbAsientos));

    cerrarModalManual();
    renderHistorialDiario();

    if (typeof generarLibroMayor === 'function')   generarLibroMayor();
    if (typeof generarBalanceGeneral === 'function') generarBalanceGeneral();
}
