document.getElementById('fechaAsiento').valueAsDate = new Date();

// ─────────────────────────────────────────────────────────────
//  ESQUEMA BASE Y ORDEN
// ─────────────────────────────────────────────────────────────
const ORDEN_CUENTAS = [
    'Activo Circulante',
    'Activo No Circulante',
    'Pasivo Circulante',
    'Pasivo No Circulante',
    'Patrimonio',
    'Pérdidas',
    'Ganancias',
    'Contra Activo',
    'Contra Pasivo',
    'Contra Patrimonio',
];

// Subgrupos válidos por cada grupo — usados para poblar el selector del modal
// y como referencia canónica de `_inferirSubgrupo()`.
const _SUBGRUPOS_POR_GRUPO = {
    'Activo Circulante':    ['Disponible', 'Clientes', 'Existencias', 'Impuestos por Recuperar', 'Otros Activos Circulantes'],
    'Activo No Circulante': ['Propiedad Planta y Equipo', 'Intangibles'],
    'Pasivo Circulante':    ['Proveedores', 'Obligaciones Laborales', 'Impuestos por Pagar', 'Otros Pasivos Circulantes'],
    'Pasivo No Circulante': ['Obligaciones Financieras'],
    'Patrimonio':           ['Capital', 'Resultados Acumulados'],
    'Pérdidas':             ['Costos y Gastos Operacionales', 'Gastos Financieros'],
    'Ganancias':            ['Ingresos Operacionales', 'Ingresos No Operacionales'],
    'Contra Activo':        ['Depreciación y Amortización', 'Provisiones'],
    'Contra Pasivo':        ['Descuentos de Pasivo'],
    'Contra Patrimonio':    ['Resultados Negativos'],
};
window._SUBGRUPOS_POR_GRUPO = _SUBGRUPOS_POR_GRUPO;

const ESQUEMA_CUENTAS = {
    'Caja':                              { tipo: 'Activo',    grupo: 'Activo Circulante',    orden: 1,   naturaleza: 'Debe',  subgrupo: 'Disponible' },
    'Banco':                             { tipo: 'Activo',    grupo: 'Activo Circulante',    orden: 2,   naturaleza: 'Debe',  subgrupo: 'Disponible' },
    'Clientes':                          { tipo: 'Activo',    grupo: 'Activo Circulante',    orden: 3,   naturaleza: 'Debe',  subgrupo: 'Clientes'   },
    'Documentos por Cobrar':             { tipo: 'Activo',    grupo: 'Activo Circulante',    orden: 4,   naturaleza: 'Debe',  subgrupo: 'Clientes'   },
    'Deudores Varios':                   { tipo: 'Activo',    grupo: 'Activo Circulante',    orden: 5,   naturaleza: 'Debe',  subgrupo: 'Clientes'   },
    'Mercaderías':                       { tipo: 'Activo',    grupo: 'Activo Circulante',    orden: 6,   naturaleza: 'Debe',  subgrupo: 'Existencias' },
    'Inventario de Productos Terminados':{ tipo: 'Activo',    grupo: 'Activo Circulante',    orden: 7,   naturaleza: 'Debe',  subgrupo: 'Existencias' },
    'Materias Primas':                   { tipo: 'Activo',    grupo: 'Activo Circulante',    orden: 12,  naturaleza: 'Debe',  subgrupo: 'Existencias' },
    'Anticipos a Proveedores':           { tipo: 'Activo',    grupo: 'Activo Circulante',    orden: 8,   naturaleza: 'Debe',  subgrupo: 'Otros Activos Circulantes' },
    'Letras por Cobrar':                 { tipo: 'Activo',    grupo: 'Activo Circulante',    orden: 9,   naturaleza: 'Debe',  subgrupo: 'Clientes'   },
    'Anticipos de Remuneraciones':       { tipo: 'Activo',    grupo: 'Activo Circulante',    orden: 11,  naturaleza: 'Debe',  subgrupo: 'Otros Activos Circulantes' },
    'IVA Crédito Fiscal':                { tipo: 'Activo',    grupo: 'Activo Circulante',    orden: 9,   naturaleza: 'Debe',  subgrupo: 'Impuestos por Recuperar' },
    'PPM':                               { tipo: 'Activo',    grupo: 'Activo Circulante',    orden: 10,  naturaleza: 'Debe',  subgrupo: 'Impuestos por Recuperar' },
    'Terrenos':                          { tipo: 'Activo',    grupo: 'Activo No Circulante', orden: 101, naturaleza: 'Debe',  subgrupo: 'Propiedad Planta y Equipo' },
    'Edificios':                         { tipo: 'Activo',    grupo: 'Activo No Circulante', orden: 102, naturaleza: 'Debe',  subgrupo: 'Propiedad Planta y Equipo' },
    'Muebles y Útiles':                  { tipo: 'Activo',    grupo: 'Activo No Circulante', orden: 103, naturaleza: 'Debe',  subgrupo: 'Propiedad Planta y Equipo' },
    'Equipos Computacionales':           { tipo: 'Activo',    grupo: 'Activo No Circulante', orden: 104, naturaleza: 'Debe',  subgrupo: 'Propiedad Planta y Equipo' },
    'Vehículos':                         { tipo: 'Activo',    grupo: 'Activo No Circulante', orden: 105, naturaleza: 'Debe',  subgrupo: 'Propiedad Planta y Equipo' },
    'Maquinarias':                       { tipo: 'Activo',    grupo: 'Activo No Circulante', orden: 106, naturaleza: 'Debe',  subgrupo: 'Propiedad Planta y Equipo' },
    'Instalaciones':                     { tipo: 'Activo',    grupo: 'Activo No Circulante', orden: 107, naturaleza: 'Debe',  subgrupo: 'Propiedad Planta y Equipo' },
    'Software':                          { tipo: 'Activo',    grupo: 'Activo No Circulante', orden: 108, naturaleza: 'Debe',  subgrupo: 'Intangibles' },
    'Marcas y Patentes':                 { tipo: 'Activo',    grupo: 'Activo No Circulante', orden: 109, naturaleza: 'Debe',  subgrupo: 'Intangibles' },
    'Proveedores':                       { tipo: 'Pasivo',    grupo: 'Pasivo Circulante',    orden: 201, naturaleza: 'Haber', subgrupo: 'Proveedores' },
    'Acreedores Varios':                 { tipo: 'Pasivo',    grupo: 'Pasivo Circulante',    orden: 202, naturaleza: 'Haber', subgrupo: 'Otros Pasivos Circulantes' },
    'Documentos por Pagar':              { tipo: 'Pasivo',    grupo: 'Pasivo Circulante',    orden: 203, naturaleza: 'Haber', subgrupo: 'Proveedores' },
    'Letras por Pagar':                  { tipo: 'Pasivo',    grupo: 'Pasivo Circulante',    orden: 204, naturaleza: 'Haber', subgrupo: 'Proveedores' },
    'IVA Débito Fiscal':                 { tipo: 'Pasivo',    grupo: 'Pasivo Circulante',    orden: 204, naturaleza: 'Haber', subgrupo: 'Impuestos por Pagar' },
    'Remuneraciones por Pagar':          { tipo: 'Pasivo',    grupo: 'Pasivo Circulante',    orden: 205, naturaleza: 'Haber', subgrupo: 'Obligaciones Laborales' },
    'Honorarios por Pagar':              { tipo: 'Pasivo',    grupo: 'Pasivo Circulante',    orden: 206, naturaleza: 'Haber', subgrupo: 'Otros Pasivos Circulantes' },
    'Impuestos por Pagar':               { tipo: 'Pasivo',    grupo: 'Pasivo Circulante',    orden: 207, naturaleza: 'Haber', subgrupo: 'Impuestos por Pagar' },
    'Préstamos Bancarios CP':            { tipo: 'Pasivo',    grupo: 'Pasivo Circulante',    orden: 208, naturaleza: 'Haber', subgrupo: 'Otros Pasivos Circulantes' },

    // ── Remuneraciones: AFP (una cuenta por institución) ──────
    'AFP Capital por pagar':             { tipo: 'Pasivo',    grupo: 'Pasivo Circulante',    orden: 210, naturaleza: 'Haber', subgrupo: 'Obligaciones Laborales' },
    'AFP Cuprum por pagar':              { tipo: 'Pasivo',    grupo: 'Pasivo Circulante',    orden: 211, naturaleza: 'Haber', subgrupo: 'Obligaciones Laborales' },
    'AFP Habitat por pagar':             { tipo: 'Pasivo',    grupo: 'Pasivo Circulante',    orden: 212, naturaleza: 'Haber', subgrupo: 'Obligaciones Laborales' },
    'AFP PlanVital por pagar':           { tipo: 'Pasivo',    grupo: 'Pasivo Circulante',    orden: 213, naturaleza: 'Haber', subgrupo: 'Obligaciones Laborales' },
    'AFP ProVida por pagar':             { tipo: 'Pasivo',    grupo: 'Pasivo Circulante',    orden: 214, naturaleza: 'Haber', subgrupo: 'Obligaciones Laborales' },
    'AFP Modelo por pagar':              { tipo: 'Pasivo',    grupo: 'Pasivo Circulante',    orden: 215, naturaleza: 'Haber', subgrupo: 'Obligaciones Laborales' },
    'AFP Uno por pagar':                 { tipo: 'Pasivo',    grupo: 'Pasivo Circulante',    orden: 216, naturaleza: 'Haber', subgrupo: 'Obligaciones Laborales' },

    // ── Remuneraciones: Salud (Fonasa e Isapres principales) ──
    'Salud Fonasa por pagar':            { tipo: 'Pasivo',    grupo: 'Pasivo Circulante',    orden: 220, naturaleza: 'Haber', subgrupo: 'Obligaciones Laborales' },
    'Salud Banmédica por pagar':         { tipo: 'Pasivo',    grupo: 'Pasivo Circulante',    orden: 221, naturaleza: 'Haber', subgrupo: 'Obligaciones Laborales' },
    'Salud Colmena por pagar':           { tipo: 'Pasivo',    grupo: 'Pasivo Circulante',    orden: 222, naturaleza: 'Haber', subgrupo: 'Obligaciones Laborales' },
    'Salud Cruz Blanca por pagar':       { tipo: 'Pasivo',    grupo: 'Pasivo Circulante',    orden: 223, naturaleza: 'Haber', subgrupo: 'Obligaciones Laborales' },
    'Salud Consalud por pagar':          { tipo: 'Pasivo',    grupo: 'Pasivo Circulante',    orden: 224, naturaleza: 'Haber', subgrupo: 'Obligaciones Laborales' },
    'Salud Nueva Masvida por pagar':     { tipo: 'Pasivo',    grupo: 'Pasivo Circulante',    orden: 225, naturaleza: 'Haber', subgrupo: 'Obligaciones Laborales' },
    'Salud Vida Tres por pagar':         { tipo: 'Pasivo',    grupo: 'Pasivo Circulante',    orden: 226, naturaleza: 'Haber', subgrupo: 'Obligaciones Laborales' },

    // ── Remuneraciones: Leyes sociales y Previred ─────────────
    'Seguro Cesantía por pagar':         { tipo: 'Pasivo',    grupo: 'Pasivo Circulante',    orden: 230, naturaleza: 'Haber', subgrupo: 'Obligaciones Laborales' },
    'SIS por pagar':                     { tipo: 'Pasivo',    grupo: 'Pasivo Circulante',    orden: 231, naturaleza: 'Haber', subgrupo: 'Obligaciones Laborales' },
    'Seguro Cesantía Empleador por pagar':{ tipo: 'Pasivo',   grupo: 'Pasivo Circulante',    orden: 232, naturaleza: 'Haber', subgrupo: 'Obligaciones Laborales' },
    'Mutual por pagar':                  { tipo: 'Pasivo',    grupo: 'Pasivo Circulante',    orden: 233, naturaleza: 'Haber', subgrupo: 'Obligaciones Laborales' },
    'Impuesto Único por pagar':          { tipo: 'Pasivo',    grupo: 'Pasivo Circulante',    orden: 234, naturaleza: 'Haber', subgrupo: 'Impuestos por Pagar' },
    'Descuentos por pagar':              { tipo: 'Pasivo',    grupo: 'Pasivo Circulante',    orden: 235, naturaleza: 'Haber', subgrupo: 'Obligaciones Laborales' },
    'Previsión Social por Pagar':        { tipo: 'Pasivo',    grupo: 'Pasivo Circulante',    orden: 236, naturaleza: 'Haber', subgrupo: 'Obligaciones Laborales' },
    'Préstamos Bancarios LP':            { tipo: 'Pasivo',    grupo: 'Pasivo No Circulante', orden: 301, naturaleza: 'Haber', subgrupo: 'Obligaciones Financieras' },
    'Hipotecas por Pagar':               { tipo: 'Pasivo',    grupo: 'Pasivo No Circulante', orden: 302, naturaleza: 'Haber', subgrupo: 'Obligaciones Financieras' },
    'Obligaciones Financieras LP':       { tipo: 'Pasivo',    grupo: 'Pasivo No Circulante', orden: 303, naturaleza: 'Haber', subgrupo: 'Obligaciones Financieras' },
    'Capital':                           { tipo: 'Patrimonio',grupo: 'Patrimonio',           orden: 401, naturaleza: 'Haber', subgrupo: 'Capital' },
    'Capital Social':                    { tipo: 'Patrimonio',grupo: 'Patrimonio',           orden: 402, naturaleza: 'Haber', subgrupo: 'Capital' },
    'Utilidades Retenidas':              { tipo: 'Patrimonio',grupo: 'Patrimonio',           orden: 403, naturaleza: 'Haber', subgrupo: 'Resultados Acumulados' },
    'Resultado del Ejercicio':           { tipo: 'Patrimonio',grupo: 'Patrimonio',           orden: 404, naturaleza: 'Haber', subgrupo: 'Resultados Acumulados' },
    'Costo de Ventas':                   { tipo: 'Pérdida',   grupo: 'Pérdidas',             orden: 501, subgrupo: 'Costos y Gastos Operacionales' },
    'Publicidad':                        { tipo: 'Pérdida',   grupo: 'Pérdidas',             orden: 502, subgrupo: 'Costos y Gastos Operacionales' },
    'Arriendos':                         { tipo: 'Pérdida',   grupo: 'Pérdidas',             orden: 503, subgrupo: 'Costos y Gastos Operacionales' },
    'Sueldos y Salarios':                { tipo: 'Pérdida',   grupo: 'Pérdidas',             orden: 504, subgrupo: 'Costos y Gastos Operacionales' },
    'Servicios Básicos':                 { tipo: 'Pérdida',   grupo: 'Pérdidas',             orden: 505, subgrupo: 'Costos y Gastos Operacionales' },
    'Honorarios':                        { tipo: 'Pérdida',   grupo: 'Pérdidas',             orden: 506, subgrupo: 'Costos y Gastos Operacionales' },
    'Gastos Generales':                  { tipo: 'Pérdida',   grupo: 'Pérdidas',             orden: 507, subgrupo: 'Costos y Gastos Operacionales' },
    'Depreciación':                      { tipo: 'Pérdida',   grupo: 'Pérdidas',             orden: 508, subgrupo: 'Costos y Gastos Operacionales' },
    'Intereses Pagados':                 { tipo: 'Pérdida',   grupo: 'Pérdidas',             orden: 509, subgrupo: 'Gastos Financieros' },
    'Comisiones Bancarias':              { tipo: 'Pérdida',   grupo: 'Pérdidas',             orden: 510, subgrupo: 'Gastos Financieros' },
    'Seguros':                           { tipo: 'Pérdida',   grupo: 'Pérdidas',             orden: 511, subgrupo: 'Costos y Gastos Operacionales' },
    'Gastos de Mantenimiento':           { tipo: 'Pérdida',   grupo: 'Pérdidas',             orden: 512, subgrupo: 'Costos y Gastos Operacionales' },
    'Comisiones Pagadas':                { tipo: 'Pérdida',   grupo: 'Pérdidas',             orden: 513, subgrupo: 'Costos y Gastos Operacionales' },

    // ── Remuneraciones: gastos ─────────────────────────────────
    'Gasto Remuneraciones':              { tipo: 'Pérdida',   grupo: 'Pérdidas',             orden: 520, subgrupo: 'Costos y Gastos Operacionales' },
    'Gasto Leyes Sociales':              { tipo: 'Pérdida',   grupo: 'Pérdidas',             orden: 521, subgrupo: 'Costos y Gastos Operacionales' },
    'Ingresos por Ventas':               { tipo: 'Ganancia',  grupo: 'Ganancias',            orden: 601, subgrupo: 'Ingresos Operacionales' },
    'Ingresos por Servicios':            { tipo: 'Ganancia',  grupo: 'Ganancias',            orden: 602, subgrupo: 'Ingresos Operacionales' },
    // Devoluciones y Descuentos es una contra-cuenta de ingresos: naturaleza Debe explícita
    // (mismo patrón que 'Pérdidas Acumuladas' en Contra Patrimonio, más abajo).
    'Devoluciones y Descuentos':         { tipo: 'Ganancia',  grupo: 'Ganancias',            orden: 606, naturaleza: 'Debe', subgrupo: 'Ingresos Operacionales' },
    'Comisiones Ganadas':                { tipo: 'Ganancia',  grupo: 'Ganancias',            orden: 603, subgrupo: 'Ingresos No Operacionales' },
    'Intereses Ganados':                 { tipo: 'Ganancia',  grupo: 'Ganancias',            orden: 604, subgrupo: 'Ingresos No Operacionales' },
    'Otros Ingresos':                    { tipo: 'Ganancia',  grupo: 'Ganancias',            orden: 605, subgrupo: 'Ingresos No Operacionales' },

    // ── Contra Activo (reducen el activo, saldo natural Haber) ──
    'Depreciación Acumulada':            { tipo: 'Contra Activo',    grupo: 'Contra Activo', orden: 701, naturaleza: 'Haber', subgrupo: 'Depreciación y Amortización' },
    'Depreciación Acumulada Muebles':    { tipo: 'Contra Activo',    grupo: 'Contra Activo', orden: 702, naturaleza: 'Haber', subgrupo: 'Depreciación y Amortización' },
    'Depreciación Acumulada Vehículos':  { tipo: 'Contra Activo',    grupo: 'Contra Activo', orden: 703, naturaleza: 'Haber', subgrupo: 'Depreciación y Amortización' },
    'Depreciación Acumulada Edificios':  { tipo: 'Contra Activo',    grupo: 'Contra Activo', orden: 704, naturaleza: 'Haber', subgrupo: 'Depreciación y Amortización' },
    'Depreciación Acumulada Maquinarias':{ tipo: 'Contra Activo',    grupo: 'Contra Activo', orden: 705, naturaleza: 'Haber', subgrupo: 'Depreciación y Amortización' },
    'Depreciación Acumulada Equipos':    { tipo: 'Contra Activo',    grupo: 'Contra Activo', orden: 706, naturaleza: 'Haber', subgrupo: 'Depreciación y Amortización' },
    'Amortización Acumulada':            { tipo: 'Contra Activo',    grupo: 'Contra Activo', orden: 707, naturaleza: 'Haber', subgrupo: 'Depreciación y Amortización' },
    'Provisión Deudores Incobrables':    { tipo: 'Contra Activo',    grupo: 'Contra Activo', orden: 708, naturaleza: 'Haber', subgrupo: 'Provisiones' },
    'Provisión Obsolescencia Inventario':{ tipo: 'Contra Activo',    grupo: 'Contra Activo', orden: 709, naturaleza: 'Haber', subgrupo: 'Provisiones' },

    // ── Contra Pasivo (reducen el pasivo, saldo natural Debe) ──
    'Descuento en Emisión de Bonos':     { tipo: 'Contra Pasivo',    grupo: 'Contra Pasivo', orden: 801, naturaleza: 'Debe',  subgrupo: 'Descuentos de Pasivo' },
    'Gastos de Emisión de Deuda':        { tipo: 'Contra Pasivo',    grupo: 'Contra Pasivo', orden: 802, naturaleza: 'Debe',  subgrupo: 'Descuentos de Pasivo' },

    // ── Contra Patrimonio (reducen el patrimonio, saldo natural Debe) ──
    'Pérdidas Acumuladas':               { tipo: 'Contra Patrimonio',grupo: 'Contra Patrimonio', orden: 901, naturaleza: 'Debe', subgrupo: 'Resultados Negativos' },
    'Retiro de Socios':                  { tipo: 'Contra Patrimonio',grupo: 'Contra Patrimonio', orden: 902, naturaleza: 'Debe', subgrupo: 'Resultados Negativos' },
    'Dividendos Decretados':             { tipo: 'Contra Patrimonio',grupo: 'Contra Patrimonio', orden: 903, naturaleza: 'Debe', subgrupo: 'Resultados Negativos' },
    'Acciones Propias en Cartera':       { tipo: 'Contra Patrimonio',grupo: 'Contra Patrimonio', orden: 904, naturaleza: 'Debe', subgrupo: 'Resultados Negativos' },
};

window.ESQUEMA_CUENTAS = ESQUEMA_CUENTAS;

function obtenerOrdenCuenta(nombreCuenta) {
    const grupo  = ESQUEMA_CUENTAS[nombreCuenta]?.grupo || '';
    const orden  = {
        'Activo Circulante': 1, 'Activo No Circulante': 2,
        'Pasivo Circulante': 3, 'Pasivo No Circulante': 4,
        'Patrimonio': 5, 'Pérdidas': 6, 'Ganancias': 7,
        'Contra Activo': 8, 'Contra Pasivo': 9, 'Contra Patrimonio': 10,
    };
    return orden[grupo] || 999;
}

function _naturalezaPorTipo(tipo) {
    // Contra Activo → Haber (reduce el activo)
    if (tipo === 'Contra Activo')    return 'Haber';
    // Contra Pasivo y Contra Patrimonio → Debe (reducen pasivo/patrimonio)
    if (tipo === 'Contra Pasivo')    return 'Debe';
    if (tipo === 'Contra Patrimonio')return 'Debe';
    // Activos y Pérdidas → Debe
    if (tipo === 'Activo' || tipo === 'Pérdida') return 'Debe';
    // Pasivos, Patrimonio, Ganancias → Haber
    return 'Haber';
}

// ─────────────────────────────────────────────────────────────
//  HEURÍSTICAS DE CLASIFICACIÓN AUTOMÁTICA
//  Usadas para completar cuentas del plan sin subgrupo y para
//  inferir la clasificación de cuentas nuevas detectadas en el diario.
// ─────────────────────────────────────────────────────────────

// Infiere el subgrupo de una cuenta ya clasificada (se conoce tipo/grupo).
function _inferirSubgrupo(nombre, tipo, grupo) {
    const n = (nombre || '').toLowerCase();
    switch (grupo) {
        case 'Activo Circulante':
            if (/caja|banco|efectivo/.test(n)) return 'Disponible';
            if (/cliente|documentos?\s+por\s+cobrar|deudor|letras?\s+por\s+cobrar/.test(n)) return 'Clientes';
            if (/mercader|inventario|existencia|materia\s+prima|producto\s+terminado|stock/.test(n)) return 'Existencias';
            if (/iva|ppm|impuesto.*recuperar|cr[eé]dito\s+fiscal/.test(n)) return 'Impuestos por Recuperar';
            return 'Otros Activos Circulantes';
        case 'Activo No Circulante':
            if (/software|marca|patente|intangible|propiedad\s+intelectual/.test(n)) return 'Intangibles';
            return 'Propiedad Planta y Equipo';
        case 'Pasivo Circulante':
            if (/proveedor|documentos?\s+por\s+pagar|letras?\s+por\s+pagar/.test(n)) return 'Proveedores';
            if (/afp|salud|isapre|fonasa|mutual|cesant[ií]a|\bsis\b|previsi[oó]n|remuneraci[oó]n|sueldo/.test(n)) return 'Obligaciones Laborales';
            if (/impuesto|iva/.test(n)) return 'Impuestos por Pagar';
            return 'Otros Pasivos Circulantes';
        case 'Pasivo No Circulante':
            return 'Obligaciones Financieras';
        case 'Patrimonio':
            return /capital/.test(n) ? 'Capital' : 'Resultados Acumulados';
        case 'Pérdidas':
            return /inter[eé]s|comisi[oó]n\s+banc/.test(n) ? 'Gastos Financieros' : 'Costos y Gastos Operacionales';
        case 'Ganancias':
            return /venta|servicio/.test(n) ? 'Ingresos Operacionales' : 'Ingresos No Operacionales';
        case 'Contra Activo':
            return /provisi[oó]n/.test(n) ? 'Provisiones' : 'Depreciación y Amortización';
        case 'Contra Pasivo':
            return 'Descuentos de Pasivo';
        case 'Contra Patrimonio':
            return 'Resultados Negativos';
        default:
            return undefined;
    }
}

// Infiere {tipo, grupo} para una cuenta totalmente desconocida (auto-alta).
function _inferirTipoGrupoCuenta(nombre) {
    const n = (nombre || '').toLowerCase();

    if (/acumulada|provisi[oó]n/.test(n))
        return { tipo: 'Contra Activo', grupo: 'Contra Activo' };

    if (/por\s+pagar|acreedor/.test(n))
        return { tipo: 'Pasivo', grupo: /largo\s+plazo|\blp\b|hipoteca/.test(n) ? 'Pasivo No Circulante' : 'Pasivo Circulante' };

    if (/pr[eé]stamo|cr[eé]dito\s+banc|obligaci[oó]n\s+financiera/.test(n))
        return { tipo: 'Pasivo', grupo: /corto\s+plazo|\bcp\b/.test(n) ? 'Pasivo Circulante' : 'Pasivo No Circulante' };

    if (/capital|utilidad\s+retenida|resultado\s+del\s+ejercicio|resultado\s+acumulado/.test(n))
        return { tipo: 'Patrimonio', grupo: 'Patrimonio' };

    if (/ingreso|venta|comisi[oó]n\s+ganada|inter[eé]s\s+ganado/.test(n))
        return { tipo: 'Ganancia', grupo: 'Ganancias' };

    if (/gasto|costo|sueldo|remuneraci[oó]n|honorario|arriendo|alquiler|publicidad|comisi[oó]n|seguro|mantenimiento|reparaci[oó]n|servicios?\s+b[aá]sicos?|luz|agua|tel[eé]fono|internet/.test(n))
        return { tipo: 'Pérdida', grupo: 'Pérdidas' };

    if (/terreno|edificio|inmueble|veh[ií]culo|maquinaria|equipo|mueble|software|marca|patente|intangible/.test(n))
        return { tipo: 'Activo', grupo: 'Activo No Circulante' };

    if (/por\s+cobrar|deudor|cliente|mercader|inventario|existencia|materia\s+prima|caja|banco|efectivo/.test(n))
        return { tipo: 'Activo', grupo: 'Activo Circulante' };

    // Fallback razonable — mismo criterio que usa _naturalezaCuenta() en diario.js
    return { tipo: 'Activo', grupo: 'Activo Circulante' };
}

window._inferirSubgrupo        = _inferirSubgrupo;
window._inferirTipoGrupoCuenta = _inferirTipoGrupoCuenta;

// ─────────────────────────────────────────────────────────────
//  PLAN DE CUENTAS (persistido en localStorage)
// ─────────────────────────────────────────────────────────────
// Cargar plan persistido y fusionarlo con el esquema base actualizado.
// El esquema base siempre prevalece en naturaleza, tipo y grupo
// para garantizar consistencia; el usuario solo conserva código, estado y orden.
function _inicializarPlanCuentas() {
    const guardado = JSON.parse(localStorage.getItem('core_plan_cuentas') || 'null');
    if (!guardado) return { ...ESQUEMA_CUENTAS };

    const plan = { ...ESQUEMA_CUENTAS }; // empezar desde el esquema base actualizado

    // Preservar cuentas del usuario que no están en el esquema base
    Object.entries(guardado).forEach(([nombre, datos]) => {
        if (plan[nombre]) {
            // Cuenta del sistema: actualizar solo lo que el usuario puede modificar
            plan[nombre] = {
                ...plan[nombre],          // esquema base (naturaleza, tipo, grupo actualizados)
                codigo:  datos.codigo  || plan[nombre].codigo  || '',
                estado:  datos.estado  || plan[nombre].estado  || 'ACTIVA',
                orden:   datos.orden   ?? plan[nombre].orden,
            };
        } else {
            // Cuenta personalizada: conservar completa
            plan[nombre] = datos;
        }
    });

    _repararPlanCuentas(plan);
    return plan;
}

// Completa el `subgrupo` de cualquier cuenta del plan (sistema o custom) que no lo tenga,
// para que el plan de cuentas quede siempre completo sin intervención del usuario.
// Devuelve true si hubo cambios (para que el caller decida si persistir).
function _repararPlanCuentas(plan) {
    let cambios = false;
    Object.entries(plan).forEach(([nombre, datos]) => {
        if (!datos.subgrupo) {
            const sub = _inferirSubgrupo(nombre, datos.tipo, datos.grupo);
            if (sub) { datos.subgrupo = sub; cambios = true; }
        }
    });
    return cambios;
}
window._repararPlanCuentas = _repararPlanCuentas;

let PLAN_CUENTAS = _inicializarPlanCuentas();
window.PLAN_CUENTAS = PLAN_CUENTAS;

// Planes persistidos de sesiones anteriores al soporte de subgrupo: completar y guardar ya mismo.
if (_repararPlanCuentas(PLAN_CUENTAS)) {
    localStorage.setItem('core_plan_cuentas', JSON.stringify(PLAN_CUENTAS));
}

function guardarPlanCuentas() {
    localStorage.setItem('core_plan_cuentas', JSON.stringify(PLAN_CUENTAS));
}

function existeCuenta(nombre) { return !!PLAN_CUENTAS[nombre]; }
function obtenerCuenta(nombre) { return PLAN_CUENTAS[nombre] || null; }

function crearCuenta(nombre, tipo, grupo, orden, subgrupo) {
    if (PLAN_CUENTAS[nombre]) { mostrarToast('Ya existe una cuenta con ese nombre.', 'error'); return false; }
    const subgrupoFinal = subgrupo || _inferirSubgrupo(nombre, tipo, grupo);
    PLAN_CUENTAS[nombre] = {
        tipo, grupo, orden,
        codigo: '',
        naturaleza: _naturalezaPorTipo(tipo),
        estado: 'ACTIVA',
        editable: true,
        ...(subgrupoFinal ? { subgrupo: subgrupoFinal } : {}),
    };
    guardarPlanCuentas();
    return true;
}

// Devuelve los nombres de cuenta usados en `movimientos` ({cuenta,...}) que no
// existen en el Plan de Cuentas actual.
function _detectarCuentasNoRegistradas(movimientos) {
    const nombres = new Set();
    (movimientos || []).forEach(m => { if (m && m.cuenta) nombres.add(m.cuenta); });
    return [...nombres].filter(nombre => !PLAN_CUENTAS[nombre]);
}
window._detectarCuentasNoRegistradas = _detectarCuentasNoRegistradas;

// Muestra un mostrarConfirm() listando las cuentas nuevas detectadas (con su tipo/grupo
// inferido); si el usuario acepta, las crea y persiste, refresca la UI si está visible,
// y recién ahí invoca onListo(). Si no hay nombres, invoca onListo() directo sin diálogo.
function _confirmarYCrearCuentasFaltantes(nombres, onListo) {
    if (!nombres || !nombres.length) { onListo(); return; }

    const inferencias = nombres.map(n => {
        const { tipo, grupo } = _inferirTipoGrupoCuenta(n);
        return { nombre: n, tipo, grupo, subgrupo: _inferirSubgrupo(n, tipo, grupo) };
    });

    const detalle = inferencias.map(i => `• <strong>${i.nombre}</strong> — ${i.tipo} / ${i.grupo}`).join('<br>');

    mostrarConfirm(
        `Se detectaron ${inferencias.length} cuenta(s) que no están en el Plan de Cuentas:<br><br>${detalle}<br><br>` +
        `¿Deseas crearlas automáticamente con la clasificación indicada y continuar?`,
        () => {
            let siguienteOrden = Math.max(0, ...Object.values(PLAN_CUENTAS).map(c => c.orden || 0)) + 1;
            inferencias.forEach(i => {
                crearCuenta(i.nombre, i.tipo, i.grupo, siguienteOrden++, i.subgrupo);
            });
            if (document.getElementById('listaPlanCuentas')) renderPlanCuentas();
            mostrarToast(`${inferencias.length} cuenta(s) creada(s) en el Plan de Cuentas.`, 'ok');
            onListo();
        },
        { titulo: 'Cuentas nuevas detectadas', textoBtn: 'Crear y continuar' }
    );
}
window._confirmarYCrearCuentasFaltantes = _confirmarYCrearCuentasFaltantes;

// Escanea TODOS los asientos guardados (histórico, excluye ANULADO) y detecta cuentas
// que el Diario ya generó pero que nunca quedaron registradas en el Plan de Cuentas.
function auditarCuentasFaltantes() {
    const asientos = (window.dbAsientos || []).filter(a => a.estado !== 'ANULADO');
    const movimientos = asientos.flatMap(a => a.movimientos || []);
    const faltantes = _detectarCuentasNoRegistradas(movimientos);

    if (!faltantes.length) {
        mostrarToast('Todas las cuentas usadas en el diario ya están registradas en el Plan de Cuentas.', 'ok');
        return;
    }

    _confirmarYCrearCuentasFaltantes(faltantes, () => {});
}
window.auditarCuentasFaltantes = auditarCuentasFaltantes;

function editarCuenta(nombreOriginal, datos) {
    if (!PLAN_CUENTAS[nombreOriginal]) return;
    PLAN_CUENTAS[nombreOriginal] = { ...PLAN_CUENTAS[nombreOriginal], ...datos };
    guardarPlanCuentas();
}

function cambiarEstadoCuenta(nombre) {
    if (!PLAN_CUENTAS[nombre]) return;
    PLAN_CUENTAS[nombre].estado =
        PLAN_CUENTAS[nombre].estado === 'ACTIVA' ? 'INACTIVA' : 'ACTIVA';
    guardarPlanCuentas();
}

function obtenerTodasLasCuentas() {
    return Object.entries(PLAN_CUENTAS)
        .sort((a, b) => (a[1].orden || 999) - (b[1].orden || 999));
}

// ─────────────────────────────────────────────────────────────
//  RENDER PLAN DE CUENTAS — UI MEJORADA
// ─────────────────────────────────────────────────────────────

const BADGE_TIPO = {
    'Activo':           { bg: '#dbeafe', color: '#1e40af' },
    'Pasivo':           { bg: '#fee2e2', color: '#991b1b' },
    'Patrimonio':       { bg: '#fef9c3', color: '#854d0e' },
    'Pérdida':          { bg: '#ffe4e6', color: '#9f1239' },
    'Ganancia':         { bg: '#dcfce7', color: '#166534' },
    'Contra Activo':    { bg: '#e0e7ff', color: '#3730a3' },
    'Contra Pasivo':    { bg: '#fce7f3', color: '#9d174d' },
    'Contra Patrimonio':{ bg: '#fef3c7', color: '#92400e' },
};

let busquedaPlan = '';
let planTabActual = 'activos';

// Qué grupos de cuentas pertenecen a cada pestaña
const PLAN_TAB_GRUPOS = {
    activos:    ['Activo Circulante', 'Activo No Circulante', 'Contra Activo'],
    pasivos:    ['Pasivo Circulante', 'Pasivo No Circulante', 'Contra Pasivo'],
    patrimonio: ['Patrimonio', 'Contra Patrimonio'],
    resultados: ['Pérdidas', 'Ganancias'],
};

function planSetTab(tab) {
    planTabActual = tab;
    document.querySelectorAll('.rem-tab[id^="planTab-"]').forEach(btn => {
        btn.classList.toggle('active', btn.id === 'planTab-' + tab);
    });
    renderPlanCuentas();
}

function renderPlanCuentas() {
    const contenedor = document.getElementById('listaPlanCuentas');
    if (!contenedor) return;

    const busq   = busquedaPlan.toLowerCase();
    const grupos = PLAN_TAB_GRUPOS[planTabActual] || ORDEN_CUENTAS;

    // Actualizar contadores de cada pestaña
    Object.entries(PLAN_TAB_GRUPOS).forEach(([tab, grps]) => {
        const cnt = document.getElementById('planCnt-' + tab);
        if (!cnt) return;
        const total = Object.values(PLAN_CUENTAS).filter(d => grps.includes(d.grupo)).length;
        cnt.textContent = total ? `(${total})` : '';
    });

    contenedor.innerHTML = '';

    grupos.forEach(grupo => {
        let entradas = Object.entries(PLAN_CUENTAS)
            .filter(([, data]) => data.grupo === grupo)
            .filter(([nombre, data]) => {
                if (!busq) return true;
                return nombre.toLowerCase().includes(busq) ||
                       (data.codigo || '').toLowerCase().includes(busq);
            })
            .sort((a, b) => (a[1].orden || 999) - (b[1].orden || 999));

        if (entradas.length === 0) return; // ocultar grupos vacíos

        const iconoGrupo = {
            'Activo Circulante':    '💵',
            'Activo No Circulante': '🏗️',
            'Pasivo Circulante':    '📋',
            'Pasivo No Circulante': '🏦',
            'Patrimonio':           '🏛️',
            'Pérdidas':             '📉',
            'Ganancias':            '📈',
            'Contra Activo':        '⬇️',
            'Contra Pasivo':        '⬆️',
            'Contra Patrimonio':    '↩️',
        }[grupo] || '📂';

        let filas = '';
        entradas.forEach(([nombre, data]) => {
            const badge  = BADGE_TIPO[data.tipo] || { bg: '#f1f5f9', color: '#334155' };
            const activa = data.estado !== 'INACTIVA';

            filas += `
            <tr style="${!activa ? 'opacity:.5;' : ''}">
                <td style="font-family:monospace;font-size:13px;color:#64748b;">${data.codigo || '—'}</td>
                <td style="font-weight:${activa ? '600' : '400'};">${nombre}</td>
                <td>
                    <span style="
                        background:${badge.bg};color:${badge.color};
                        padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;
                    ">${data.tipo}</span>
                </td>
                <td style="font-size:12px;color:#64748b;">${data.subgrupo || '—'}</td>
                <td>
                    <span class="${activa ? 'badge-activo' : 'badge-inactivo'}">
                        ${activa ? 'Activa' : 'Inactiva'}
                    </span>
                </td>
                <td>
                    <div class="plan-acciones">
                        <button class="btn-plan btn-plan-editar"
                            onclick="editarCuentaUI('${nombre.replace(/'/g,"\\'")}')">✏️ Editar</button>
                        <button class="btn-plan btn-plan-eliminar"
                            onclick="eliminarCuentaUI('${nombre.replace(/'/g,"\\'")}')">🗑️</button>
                    </div>
                </td>
            </tr>`;
        });

        contenedor.innerHTML += `
        <div class="grupo-cuentas" style="margin-bottom:24px;">

            <div style="
                display:flex;align-items:center;gap:10px;
                padding:10px 16px;background:#1e293b;color:white;
                border-radius:8px 8px 0 0;
            ">
                <span style="font-size:18px;">${iconoGrupo}</span>
                <span style="font-weight:700;font-size:15px;">${grupo}</span>
                <span style="
                    background:rgba(255,255,255,.15);
                    color:white;padding:2px 8px;border-radius:12px;
                    font-size:12px;margin-left:auto;
                ">${entradas.length} cuenta${entradas.length !== 1 ? 's' : ''}</span>
            </div>

            <table class="cont-table" style="border-radius:0 0 8px 8px;overflow:hidden;">
                <thead>
                    <tr>
                        <th style="width:110px;">Código</th>
                        <th>Nombre de la Cuenta</th>
                        <th style="width:130px;">Tipo</th>
                        <th style="width:150px;">Subgrupo</th>
                        <th style="width:100px;">Estado</th>
                        <th style="width:160px;">Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${filas || `<tr><td colspan="6" style="text-align:center;padding:20px;color:#94a3b8;">Sin cuentas en este grupo</td></tr>`}
                </tbody>
            </table>
        </div>`;
    });

    if (!contenedor.innerHTML) {
        contenedor.innerHTML = `
        <div style="text-align:center;padding:40px;color:var(--text-muted);">
            ${busq
                ? `No se encontraron cuentas para "<strong>${busq}</strong>" en esta sección.`
                : 'No hay cuentas registradas en esta sección.'}
        </div>`;
    }
}

window.planSetTab = planSetTab;

// ─────────────────────────────────────────────────────────────
//  MODAL CRUD
// ─────────────────────────────────────────────────────────────
let cuentaEditando = null;

// Repuebla el <select> Subgrupo según el Grupo elegido en el modal.
function _actualizarSubgruposModal(subgrupoSeleccionado) {
    const grupo = document.getElementById('cuentaGrupo').value;
    const sel   = document.getElementById('cuentaSubgrupo');
    if (!sel) return;
    const opciones = _SUBGRUPOS_POR_GRUPO[grupo] || [];
    sel.innerHTML = '<option value="">— Otro / Ninguno —</option>' +
        opciones.map(s => `<option value="${s}">${s}</option>`).join('');
    if (subgrupoSeleccionado) sel.value = subgrupoSeleccionado;
}
window._actualizarSubgruposModal = _actualizarSubgruposModal;

function abrirNuevaCuenta() {
    cuentaEditando = null;
    document.getElementById('tituloModalCuenta').innerText = 'Nueva Cuenta';
    document.getElementById('cuentaCodigo').value  = '';
    document.getElementById('cuentaNombre').value  = '';
    document.getElementById('cuentaTipo').value    = 'Activo';
    document.getElementById('cuentaGrupo').value   = 'Activo Circulante';
    _actualizarSubgruposModal();
    document.getElementById('cuentaEstado').value  = 'ACTIVA';
    document.getElementById('modalCuenta').style.display = 'flex';
}

function editarCuentaUI(nombre) {
    const cuenta = PLAN_CUENTAS[nombre];
    if (!cuenta) return;
    cuentaEditando = nombre;
    document.getElementById('tituloModalCuenta').innerText    = 'Editar Cuenta';
    document.getElementById('cuentaCodigo').value  = cuenta.codigo || '';
    document.getElementById('cuentaNombre').value  = nombre;
    document.getElementById('cuentaTipo').value    = cuenta.tipo;
    document.getElementById('cuentaGrupo').value   = cuenta.grupo;
    _actualizarSubgruposModal(cuenta.subgrupo);
    document.getElementById('cuentaEstado').value  = cuenta.estado || 'ACTIVA';
    document.getElementById('modalCuenta').style.display = 'flex';
}

// Cuentas del esquema base — se pueden editar pero no eliminar si tienen movimientos
const CUENTAS_SISTEMA = new Set(Object.keys(ESQUEMA_CUENTAS));

function _cuentaTieneMovimientos(nombre) {
    const asientos = window.dbAsientos || [];
    return asientos.some(a =>
        a.estado !== 'ANULADO' &&
        Array.isArray(a.movimientos) &&
        a.movimientos.some(m => m.cuenta === nombre)
    );
}

function eliminarCuentaUI(nombre) {
    if (_cuentaTieneMovimientos(nombre)) {
        mostrarToast(`No se puede eliminar "${nombre}": tiene movimientos registrados.`, 'error');
        return;
    }
    const esSistema = CUENTAS_SISTEMA.has(nombre);
    const msg = esSistema
        ? `"${nombre}" es una cuenta del sistema.\n¿Confirma que desea eliminarla de todas formas?`
        : `¿Eliminar la cuenta "${nombre}"?\nEsta acción no se puede deshacer.`;
    mostrarConfirm(msg, () => {
        delete PLAN_CUENTAS[nombre];
        guardarPlanCuentas();
        renderPlanCuentas();
        mostrarToast(`Cuenta "${nombre}" eliminada.`, 'ok');
    });
}

function cerrarModalCuenta() {
    document.getElementById('modalCuenta').style.display = 'none';
}

function guardarCuentaModal() {
    const codigo      = document.getElementById('cuentaCodigo').value.trim();
    const nombre      = document.getElementById('cuentaNombre').value.trim();
    const tipo        = document.getElementById('cuentaTipo').value;
    const grupo       = document.getElementById('cuentaGrupo').value;
    const subgrupoSel = document.getElementById('cuentaSubgrupo')?.value || '';
    const estado      = document.getElementById('cuentaEstado').value;

    if (!nombre) { mostrarToast('El nombre de la cuenta es obligatorio.', 'error'); return; }

    // Código duplicado (solo si se ingresó código)
    if (codigo) {
        const duplicado = Object.entries(PLAN_CUENTAS).find(([n, c]) =>
            n !== cuentaEditando && c.codigo && c.codigo === codigo
        );
        if (duplicado) {
            mostrarToast(`El código "${codigo}" ya pertenece a "${duplicado[0]}".`, 'error');
            return;
        }
    }

    // Nombre duplicado en nueva cuenta
    if (!cuentaEditando && PLAN_CUENTAS[nombre]) {
        mostrarToast('Ya existe una cuenta con ese nombre.', 'error');
        return;
    }

    const orden = cuentaEditando
        ? PLAN_CUENTAS[cuentaEditando].orden
        : Math.max(0, ...Object.values(PLAN_CUENTAS).map(c => c.orden || 0)) + 1;

    const nombreAnterior = cuentaEditando;
    if (cuentaEditando) delete PLAN_CUENTAS[cuentaEditando];

    const subgrupo = subgrupoSel || _inferirSubgrupo(nombre, tipo, grupo);

    PLAN_CUENTAS[nombre] = {
        codigo, tipo, grupo, orden, estado,
        editable: true,
        naturaleza: _naturalezaPorTipo(tipo),
        ...(subgrupo ? { subgrupo } : {}),
    };

    // Si se renombró una cuenta, actualizar referencias en asientos existentes
    if (nombreAnterior && nombreAnterior !== nombre) {
        _renombrarCuentaEnAsientos(nombreAnterior, nombre);
    }

    guardarPlanCuentas();
    renderPlanCuentas();
    cerrarModalCuenta();
    mostrarToast(cuentaEditando ? 'Cuenta actualizada.' : 'Cuenta creada.', 'ok');
}

// Propaga el renombrado a todos los asientos del Libro Diario
function _renombrarCuentaEnAsientos(viejo, nuevo) {
    try {
        const asientos = JSON.parse(localStorage.getItem('core_asientos') || '[]');
        let cambios = 0;
        asientos.forEach(a => {
            if (!Array.isArray(a.movimientos)) return;
            a.movimientos.forEach(m => {
                if (m.cuenta === viejo) { m.cuenta = nuevo; cambios++; }
            });
        });
        if (cambios > 0) {
            localStorage.setItem('core_asientos', JSON.stringify(asientos));
            if (typeof dbAsientos !== 'undefined') {
                dbAsientos.length = 0;
                asientos.forEach(a => dbAsientos.push(a));
            }
            mostrarToast(`Cuenta renombrada en ${cambios} movimiento(s) del Libro Diario.`, 'ok');
        }
    } catch(e) { console.warn('Error renombrando en asientos:', e); }
}
