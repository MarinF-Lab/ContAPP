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

const ESQUEMA_CUENTAS = {
    'Caja':                              { tipo: 'Activo',    grupo: 'Activo Circulante',    orden: 1,   naturaleza: 'Debe',  subgrupo: 'Disponible' },
    'Banco':                             { tipo: 'Activo',    grupo: 'Activo Circulante',    orden: 2,   naturaleza: 'Debe',  subgrupo: 'Disponible' },
    'Clientes':                          { tipo: 'Activo',    grupo: 'Activo Circulante',    orden: 3,   naturaleza: 'Debe',  subgrupo: 'Clientes'   },
    'Documentos por Cobrar':             { tipo: 'Activo',    grupo: 'Activo Circulante',    orden: 4,   naturaleza: 'Debe',  subgrupo: 'Clientes'   },
    'Deudores Varios':                   { tipo: 'Activo',    grupo: 'Activo Circulante',    orden: 5,   naturaleza: 'Debe',  subgrupo: 'Clientes'   },
    'Mercaderías':                       { tipo: 'Activo',    grupo: 'Activo Circulante',    orden: 6,   naturaleza: 'Debe'  },
    'Inventario de Productos Terminados':{ tipo: 'Activo',    grupo: 'Activo Circulante',    orden: 7,   naturaleza: 'Debe'  },
    'Anticipos a Proveedores':           { tipo: 'Activo',    grupo: 'Activo Circulante',    orden: 8,   naturaleza: 'Debe'  },
    'Letras por Cobrar':                 { tipo: 'Activo',    grupo: 'Activo Circulante',    orden: 9,   naturaleza: 'Debe',  subgrupo: 'Clientes'   },
    'Anticipos de Remuneraciones':       { tipo: 'Activo',    grupo: 'Activo Circulante',    orden: 11,  naturaleza: 'Debe'  },
    'IVA Crédito Fiscal':                { tipo: 'Activo',    grupo: 'Activo Circulante',    orden: 9,   naturaleza: 'Debe'  },
    'PPM':                               { tipo: 'Activo',    grupo: 'Activo Circulante',    orden: 10,  naturaleza: 'Debe'  },
    'Terrenos':                          { tipo: 'Activo',    grupo: 'Activo No Circulante', orden: 101, naturaleza: 'Debe'  },
    'Edificios':                         { tipo: 'Activo',    grupo: 'Activo No Circulante', orden: 102, naturaleza: 'Debe'  },
    'Muebles y Útiles':                  { tipo: 'Activo',    grupo: 'Activo No Circulante', orden: 103, naturaleza: 'Debe'  },
    'Equipos Computacionales':           { tipo: 'Activo',    grupo: 'Activo No Circulante', orden: 104, naturaleza: 'Debe'  },
    'Vehículos':                         { tipo: 'Activo',    grupo: 'Activo No Circulante', orden: 105, naturaleza: 'Debe'  },
    'Maquinarias':                       { tipo: 'Activo',    grupo: 'Activo No Circulante', orden: 106, naturaleza: 'Debe'  },
    'Instalaciones':                     { tipo: 'Activo',    grupo: 'Activo No Circulante', orden: 107, naturaleza: 'Debe'  },
    'Software':                          { tipo: 'Activo',    grupo: 'Activo No Circulante', orden: 108, naturaleza: 'Debe'  },
    'Marcas y Patentes':                 { tipo: 'Activo',    grupo: 'Activo No Circulante', orden: 109, naturaleza: 'Debe'  },
    'Proveedores':                       { tipo: 'Pasivo',    grupo: 'Pasivo Circulante',    orden: 201, naturaleza: 'Haber' },
    'Acreedores Varios':                 { tipo: 'Pasivo',    grupo: 'Pasivo Circulante',    orden: 202, naturaleza: 'Haber' },
    'Documentos por Pagar':              { tipo: 'Pasivo',    grupo: 'Pasivo Circulante',    orden: 203, naturaleza: 'Haber' },
    'Letras por Pagar':                  { tipo: 'Pasivo',    grupo: 'Pasivo Circulante',    orden: 204, naturaleza: 'Haber' },
    'IVA Débito Fiscal':                 { tipo: 'Pasivo',    grupo: 'Pasivo Circulante',    orden: 204, naturaleza: 'Haber' },
    'Remuneraciones por Pagar':          { tipo: 'Pasivo',    grupo: 'Pasivo Circulante',    orden: 205, naturaleza: 'Haber' },
    'Honorarios por Pagar':              { tipo: 'Pasivo',    grupo: 'Pasivo Circulante',    orden: 206, naturaleza: 'Haber' },
    'Impuestos por Pagar':               { tipo: 'Pasivo',    grupo: 'Pasivo Circulante',    orden: 207, naturaleza: 'Haber' },

    // ── Remuneraciones: AFP (una cuenta por institución) ──────
    'AFP Capital por pagar':             { tipo: 'Pasivo',    grupo: 'Pasivo Circulante',    orden: 210, naturaleza: 'Haber' },
    'AFP Cuprum por pagar':              { tipo: 'Pasivo',    grupo: 'Pasivo Circulante',    orden: 211, naturaleza: 'Haber' },
    'AFP Habitat por pagar':             { tipo: 'Pasivo',    grupo: 'Pasivo Circulante',    orden: 212, naturaleza: 'Haber' },
    'AFP PlanVital por pagar':           { tipo: 'Pasivo',    grupo: 'Pasivo Circulante',    orden: 213, naturaleza: 'Haber' },
    'AFP ProVida por pagar':             { tipo: 'Pasivo',    grupo: 'Pasivo Circulante',    orden: 214, naturaleza: 'Haber' },
    'AFP Modelo por pagar':              { tipo: 'Pasivo',    grupo: 'Pasivo Circulante',    orden: 215, naturaleza: 'Haber' },
    'AFP Uno por pagar':                 { tipo: 'Pasivo',    grupo: 'Pasivo Circulante',    orden: 216, naturaleza: 'Haber' },

    // ── Remuneraciones: Salud (Fonasa e Isapres principales) ──
    'Salud Fonasa por pagar':            { tipo: 'Pasivo',    grupo: 'Pasivo Circulante',    orden: 220, naturaleza: 'Haber' },
    'Salud Banmédica por pagar':         { tipo: 'Pasivo',    grupo: 'Pasivo Circulante',    orden: 221, naturaleza: 'Haber' },
    'Salud Colmena por pagar':           { tipo: 'Pasivo',    grupo: 'Pasivo Circulante',    orden: 222, naturaleza: 'Haber' },
    'Salud Cruz Blanca por pagar':       { tipo: 'Pasivo',    grupo: 'Pasivo Circulante',    orden: 223, naturaleza: 'Haber' },
    'Salud Consalud por pagar':          { tipo: 'Pasivo',    grupo: 'Pasivo Circulante',    orden: 224, naturaleza: 'Haber' },
    'Salud Nueva Masvida por pagar':     { tipo: 'Pasivo',    grupo: 'Pasivo Circulante',    orden: 225, naturaleza: 'Haber' },
    'Salud Vida Tres por pagar':         { tipo: 'Pasivo',    grupo: 'Pasivo Circulante',    orden: 226, naturaleza: 'Haber' },

    // ── Remuneraciones: Leyes sociales y Previred ─────────────
    'Seguro Cesantía por pagar':         { tipo: 'Pasivo',    grupo: 'Pasivo Circulante',    orden: 230, naturaleza: 'Haber' },
    'SIS por pagar':                     { tipo: 'Pasivo',    grupo: 'Pasivo Circulante',    orden: 231, naturaleza: 'Haber' },
    'Seguro Cesantía Empleador por pagar':{ tipo: 'Pasivo',   grupo: 'Pasivo Circulante',    orden: 232, naturaleza: 'Haber' },
    'Mutual por pagar':                  { tipo: 'Pasivo',    grupo: 'Pasivo Circulante',    orden: 233, naturaleza: 'Haber' },
    'Impuesto Único por pagar':          { tipo: 'Pasivo',    grupo: 'Pasivo Circulante',    orden: 234, naturaleza: 'Haber' },
    'Descuentos por pagar':              { tipo: 'Pasivo',    grupo: 'Pasivo Circulante',    orden: 235, naturaleza: 'Haber' },
    'Préstamos Bancarios LP':            { tipo: 'Pasivo',    grupo: 'Pasivo No Circulante', orden: 301, naturaleza: 'Haber' },
    'Hipotecas por Pagar':               { tipo: 'Pasivo',    grupo: 'Pasivo No Circulante', orden: 302, naturaleza: 'Haber' },
    'Obligaciones Financieras LP':       { tipo: 'Pasivo',    grupo: 'Pasivo No Circulante', orden: 303, naturaleza: 'Haber' },
    'Capital':                           { tipo: 'Patrimonio',grupo: 'Patrimonio',           orden: 401, naturaleza: 'Haber' },
    'Capital Social':                    { tipo: 'Patrimonio',grupo: 'Patrimonio',           orden: 402, naturaleza: 'Haber' },
    'Utilidades Retenidas':              { tipo: 'Patrimonio',grupo: 'Patrimonio',           orden: 403, naturaleza: 'Haber' },
    'Resultado del Ejercicio':           { tipo: 'Patrimonio',grupo: 'Patrimonio',           orden: 404, naturaleza: 'Haber' },
    'Costo de Ventas':                   { tipo: 'Pérdida',   grupo: 'Pérdidas',             orden: 501 },
    'Publicidad':                        { tipo: 'Pérdida',   grupo: 'Pérdidas',             orden: 502 },
    'Arriendos':                         { tipo: 'Pérdida',   grupo: 'Pérdidas',             orden: 503 },
    'Sueldos y Salarios':                { tipo: 'Pérdida',   grupo: 'Pérdidas',             orden: 504 },
    'Servicios Básicos':                 { tipo: 'Pérdida',   grupo: 'Pérdidas',             orden: 505 },
    'Honorarios':                        { tipo: 'Pérdida',   grupo: 'Pérdidas',             orden: 506 },
    'Gastos Generales':                  { tipo: 'Pérdida',   grupo: 'Pérdidas',             orden: 507 },
    'Depreciación':                      { tipo: 'Pérdida',   grupo: 'Pérdidas',             orden: 508 },
    'Intereses Pagados':                 { tipo: 'Pérdida',   grupo: 'Pérdidas',             orden: 509 },
    'Comisiones Bancarias':              { tipo: 'Pérdida',   grupo: 'Pérdidas',             orden: 510 },

    // ── Remuneraciones: gastos ─────────────────────────────────
    'Gasto Remuneraciones':              { tipo: 'Pérdida',   grupo: 'Pérdidas',             orden: 520 },
    'Gasto Leyes Sociales':              { tipo: 'Pérdida',   grupo: 'Pérdidas',             orden: 521 },
    'Ingresos por Ventas':               { tipo: 'Ganancia',  grupo: 'Ganancias',            orden: 601 },
    'Ingresos por Servicios':            { tipo: 'Ganancia',  grupo: 'Ganancias',            orden: 602 },
    'Comisiones Ganadas':                { tipo: 'Ganancia',  grupo: 'Ganancias',            orden: 603 },
    'Intereses Ganados':                 { tipo: 'Ganancia',  grupo: 'Ganancias',            orden: 604 },
    'Otros Ingresos':                    { tipo: 'Ganancia',  grupo: 'Ganancias',            orden: 605 },

    // ── Contra Activo (reducen el activo, saldo natural Haber) ──
    'Depreciación Acumulada':            { tipo: 'Contra Activo',    grupo: 'Contra Activo', orden: 701, naturaleza: 'Haber' },
    'Depreciación Acumulada Muebles':    { tipo: 'Contra Activo',    grupo: 'Contra Activo', orden: 702, naturaleza: 'Haber' },
    'Depreciación Acumulada Vehículos':  { tipo: 'Contra Activo',    grupo: 'Contra Activo', orden: 703, naturaleza: 'Haber' },
    'Depreciación Acumulada Edificios':  { tipo: 'Contra Activo',    grupo: 'Contra Activo', orden: 704, naturaleza: 'Haber' },
    'Depreciación Acumulada Maquinarias':{ tipo: 'Contra Activo',    grupo: 'Contra Activo', orden: 705, naturaleza: 'Haber' },
    'Depreciación Acumulada Equipos':    { tipo: 'Contra Activo',    grupo: 'Contra Activo', orden: 706, naturaleza: 'Haber' },
    'Amortización Acumulada':            { tipo: 'Contra Activo',    grupo: 'Contra Activo', orden: 707, naturaleza: 'Haber' },
    'Provisión Deudores Incobrables':    { tipo: 'Contra Activo',    grupo: 'Contra Activo', orden: 708, naturaleza: 'Haber' },
    'Provisión Obsolescencia Inventario':{ tipo: 'Contra Activo',    grupo: 'Contra Activo', orden: 709, naturaleza: 'Haber' },

    // ── Contra Pasivo (reducen el pasivo, saldo natural Debe) ──
    'Descuento en Emisión de Bonos':     { tipo: 'Contra Pasivo',    grupo: 'Contra Pasivo', orden: 801, naturaleza: 'Debe'  },
    'Gastos de Emisión de Deuda':        { tipo: 'Contra Pasivo',    grupo: 'Contra Pasivo', orden: 802, naturaleza: 'Debe'  },

    // ── Contra Patrimonio (reducen el patrimonio, saldo natural Debe) ──
    'Pérdidas Acumuladas':               { tipo: 'Contra Patrimonio',grupo: 'Contra Patrimonio', orden: 901, naturaleza: 'Debe' },
    'Retiro de Socios':                  { tipo: 'Contra Patrimonio',grupo: 'Contra Patrimonio', orden: 902, naturaleza: 'Debe' },
    'Dividendos Decretados':             { tipo: 'Contra Patrimonio',grupo: 'Contra Patrimonio', orden: 903, naturaleza: 'Debe' },
    'Acciones Propias en Cartera':       { tipo: 'Contra Patrimonio',grupo: 'Contra Patrimonio', orden: 904, naturaleza: 'Debe' },
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

    return plan;
}

let PLAN_CUENTAS = _inicializarPlanCuentas();
window.PLAN_CUENTAS = PLAN_CUENTAS;

function guardarPlanCuentas() {
    localStorage.setItem('core_plan_cuentas', JSON.stringify(PLAN_CUENTAS));
}

function existeCuenta(nombre) { return !!PLAN_CUENTAS[nombre]; }
function obtenerCuenta(nombre) { return PLAN_CUENTAS[nombre] || null; }

function crearCuenta(nombre, tipo, grupo, orden) {
    if (PLAN_CUENTAS[nombre]) { alert('La cuenta ya existe.'); return false; }
    PLAN_CUENTAS[nombre] = {
        tipo, grupo, orden,
        codigo: '',
        naturaleza: _naturalezaPorTipo(tipo),
        estado: 'ACTIVA',
        editable: true,
    };
    guardarPlanCuentas();
    return true;
}

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
                        <th style="width:100px;">Estado</th>
                        <th style="width:160px;">Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${filas || `<tr><td colspan="5" style="text-align:center;padding:20px;color:#94a3b8;">Sin cuentas en este grupo</td></tr>`}
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

function abrirNuevaCuenta() {
    cuentaEditando = null;
    document.getElementById('tituloModalCuenta').innerText = 'Nueva Cuenta';
    document.getElementById('cuentaCodigo').value  = '';
    document.getElementById('cuentaNombre').value  = '';
    document.getElementById('cuentaTipo').value    = 'Activo';
    document.getElementById('cuentaGrupo').value   = 'Activo Circulante';
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
        alert(`No se puede eliminar "${nombre}" porque tiene movimientos registrados en el Libro Diario.`);
        return;
    }
    const esSistema = CUENTAS_SISTEMA.has(nombre);
    const msg = esSistema
        ? `"${nombre}" es una cuenta del sistema.\n¿Confirma que desea eliminarla de todas formas?`
        : `¿Eliminar la cuenta "${nombre}"?\nEsta acción no se puede deshacer.`;
    if (!confirm(msg)) return;
    delete PLAN_CUENTAS[nombre];
    guardarPlanCuentas();
    renderPlanCuentas();
    mostrarToast(`Cuenta "${nombre}" eliminada.`, 'ok');
}

function cerrarModalCuenta() {
    document.getElementById('modalCuenta').style.display = 'none';
}

function guardarCuentaModal() {
    const codigo = document.getElementById('cuentaCodigo').value.trim();
    const nombre = document.getElementById('cuentaNombre').value.trim();
    const tipo   = document.getElementById('cuentaTipo').value;
    const grupo  = document.getElementById('cuentaGrupo').value;
    const estado = document.getElementById('cuentaEstado').value;

    if (!nombre) { alert('Ingrese el nombre de la cuenta.'); return; }

    // Código duplicado (solo si se ingresó código)
    if (codigo) {
        const duplicado = Object.entries(PLAN_CUENTAS).find(([n, c]) =>
            n !== cuentaEditando && c.codigo && c.codigo === codigo
        );
        if (duplicado) {
            alert(`El código "${codigo}" ya está asignado a "${duplicado[0]}".`);
            return;
        }
    }

    // Nombre duplicado en nueva cuenta
    if (!cuentaEditando && PLAN_CUENTAS[nombre]) {
        alert(`Ya existe una cuenta con el nombre "${nombre}".`);
        return;
    }

    const orden = cuentaEditando
        ? PLAN_CUENTAS[cuentaEditando].orden
        : Math.max(0, ...Object.values(PLAN_CUENTAS).map(c => c.orden || 0)) + 1;

    const nombreAnterior = cuentaEditando;
    if (cuentaEditando) delete PLAN_CUENTAS[cuentaEditando];

    PLAN_CUENTAS[nombre] = {
        codigo, tipo, grupo, orden, estado,
        editable: true,
        naturaleza: _naturalezaPorTipo(tipo),
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
