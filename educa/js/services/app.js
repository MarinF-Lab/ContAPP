let dbAsientos = JSON.parse(localStorage.getItem('core_asientos')) || [];
window.dbAsientos = dbAsientos;

// ─────────────────────────────────────────────────────────────
//  SIDEBAR RESPONSIVE — drawer toggle
// ─────────────────────────────────────────────────────────────
function toggleSidebar() {
    const sb      = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const abierto = sb.classList.toggle('sidebar-open');
    if (overlay) overlay.style.display = abierto ? 'block' : 'none';
}

function cerrarSidebar() {
    const sb      = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    sb.classList.remove('sidebar-open');
    if (overlay) overlay.style.display = 'none';
}

// ─────────────────────────────────────────────────────────────
//  NAVEGACIÓN SPA
// ─────────────────────────────────────────────────────────────
function navegar(modulo, elNav) {

    // En móvil, cerrar el drawer al navegar
    if (window.innerWidth <= 860) cerrarSidebar();

    // Marcar ítem activo en el sidebar
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const navEl = elNav || (typeof event !== 'undefined' && event && event.currentTarget);
    if (navEl) navEl.classList.add('active');

    // Mostrar la vista correcta
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const vista = document.getElementById(`view-${modulo}`);
    if (vista) vista.classList.add('active');

    // Resetear scroll al tope al cambiar de módulo
    const vc = document.querySelector('.view-container');
    if (vc) vc.scrollTop = 0;

    const titulos = {
        inicio:                ['Panel de Inicio',              'Resumen financiero consolidado en tiempo real'],
        diario:                ['Libro Diario Automático',      'Procesador lingüístico de operaciones de comercio'],
        mayor:                 ['Libro Mayor General',          'Apertura de movimientos consolidados por cuentas T'],
        balance:               ['Balance de Comprobación',      'Matriz de control financiero de 8 columnas'],
        compras:               ['Libro de Compras',             'Registro de documentos de compra — formato SII Chile'],
        ventas:                ['Libro de Ventas',              'Registro de documentos de venta — formato SII Chile'],
        documentos:            ['Registro de Documentación',    'Archivo de facturas, boletas y honorarios clasificados por categoría'],
        clientes:              ['Clientes y Proveedores',       'Directorio de contactos con historial de transacciones'],
        'flujo-caja':          ['Flujo de Caja',                'Movimientos de efectivo — Caja y Banco'],
        'balance-clasificado': ['Balance Clasificado',          'Activo, Pasivo y Patrimonio ordenados por liquidez'],
        'estado-resultados':   ['Estado de Resultados',         'Ingresos, costos y resultado del ejercicio'],
        'plan-cuentas':        ['Plan de Cuentas',              'Administración del catálogo contable'],
        configuracion:         ['Configuración',                'Ajustes de la empresa y del sistema'],
        indicadores:           ['Indicadores Económicos',       'UF, UTM, Dólar, Euro y otros indicadores del día'],
        'iva-resumen':         ['Resumen IVA — F29',            'Cruce de débito y crédito fiscal del período'],
        auditoria:             ['Log de Auditoría',             'Historial de acciones del sistema — solo administradores'],
        remuneraciones:        ['Remuneraciones',               'Liquidaciones de sueldo, fichas de trabajadores y planilla Previred'],
        // Segunda categoría
        'libro-ingresos-hon':  ['Libro de Ingresos',            'Registro de todos los ingresos del año: boletas BHE y otros'],
        'libro-egresos-hon':   ['Libro de Egresos',             'Registro de gastos deducibles — alimenta el F22 como gastos efectivos'],
        'libro-honorarios':    ['Libro de Honorarios',          'Registro de boletas BHE emitidas con estado de pago y retenciones'],
        honorarios:            ['Boleta de Honorarios',         'Emitir boletas con cálculo automático de retención 15,25%'],
        'cotizaciones-hon':    ['Cotizaciones Previsionales',   'Estimación de AFP, Salud y SIS sobre base 80% del bruto'],
        'gastos-presuntos':    ['Gastos Presuntos vs Efectivos','Comparación para optimizar base imponible del F22'],
        'retenciones-hon':     ['Retenciones Recibidas',        'Retenciones enteradas por pagadores — alimenta el F22'],
        'f29-hon':             ['Formulario 29',                'PPM voluntario y retenciones pagadas a prestadores'],
        'f22-hon':             ['Formulario 22',                'Estimación del impuesto anual (IGC) con proyección de devolución o pago'],
        dj1879:                ['DJ 1879',                      'Declaración de honorarios pagados a prestadores independientes'],
        'calendario-hon':      ['Calendario Tributario',        'Vencimientos F22 y DJ 1879 con alertas de anticipación'],
        prestadores:           ['Prestadores / Terceros',       'Personas a quienes pagas honorarios — base para DJ 1879'],
    };

    if (titulos[modulo]) {
        document.getElementById('txt-modulo-titulo').innerText = titulos[modulo][0];
        document.getElementById('txt-modulo-desc').innerText   = titulos[modulo][1];
    }

    if (modulo === 'inicio')        calcularKPIs();
    if (modulo === 'mayor')         generarLibroMayor();
    if (modulo === 'balance')       generarBalanceGeneral();
    if (modulo === 'plan-cuentas')  renderPlanCuentas();
    if (modulo === 'compras')               renderCompras();
    if (modulo === 'ventas')                renderVentas();
    if (modulo === 'documentos')            renderDocumentos();
    if (modulo === 'clientes')              renderContactos();
    if (modulo === 'flujo-caja')            { _initSelFlujoCajaAnio(); generarFlujoCaja(); }
    if (modulo === 'balance-clasificado')   generarBalanceClasificado();
    if (modulo === 'estado-resultados')     generarEstadoResultados();
    if (modulo === 'remuneraciones') remInit();
    if (modulo === 'indicadores')      { renderIndicadores(); renderPreviredTablas(); }
    if (modulo === 'iva-resumen')      { _initIvaSelectores(); generarIvaResumen(); }
    if (modulo === 'auditoria')        cargarAuditLog();
    // Segunda categoría
    if (modulo === 'libro-ingresos-hon') honRenderLibroIngresos();
    if (modulo === 'libro-egresos-hon')  honRenderLibroEgresos();
    if (modulo === 'libro-honorarios')   honRenderLibro();
    if (modulo === 'retenciones-hon')    honRenderRetenciones();
    if (modulo === 'f29-hon')            { honGenerarF29(); honRenderPPM(); }
    if (modulo === 'prestadores')        honRenderPrestadores();
    if (modulo === 'dj1879')             honRenderDJ1879();
    if (modulo === 'calendario-hon')     honRenderCalendario();
    if (modulo === 'configuracion') {
        cargarConfiguracionForm();
        if (typeof aplicarPermisos === 'function') aplicarPermisos();
        if (typeof aplicarNavegacionPorCategoria === 'function') aplicarNavegacionPorCategoria();
        if (typeof iaVerificarKeyAlCargar === 'function') iaVerificarKeyAlCargar();
    }
}

// ─────────────────────────────────────────────────────────────
//  CONFIGURACIÓN
// ─────────────────────────────────────────────────────────────
function guardarConfiguracion() {
    const cfg = {
        empresa:   document.getElementById('cfgEmpresa').value,
        rut:       document.getElementById('cfgRut').value,
        periodo:   document.getElementById('cfgPeriodo').value,
        iva:       document.getElementById('cfgIva').value,
        giro:      document.getElementById('cfgGiro').value,
        direccion: document.getElementById('cfgDireccion').value,
    };

    localStorage.setItem('core_config', JSON.stringify(cfg));
    aplicarConfiguracion(cfg);

    // Cambio de categoría tributaria
    const nuevaCat = document.getElementById('cfgCategoria')?.value || 'primera';
    const catAnterior = window.currentUser?.categoria;
    if (window.currentUser) window.currentUser.categoria = nuevaCat;
    localStorage.setItem('_fb_perfil_local', JSON.stringify(window.currentUser));

    if (window._fbDb && window.currentUser?.empresaId) {
        const empRef = window._fbDb.collection('empresas').doc(window.currentUser.empresaId);
        empRef.update({ categoria: nuevaCat }).catch(() => {});
        if (window.currentUser.uid) {
            empRef.collection('usuarios').doc(window.currentUser.uid)
                .update({ categoria: nuevaCat }).catch(() => {});
        }
    }

    if (typeof aplicarNavegacionPorCategoria === 'function') aplicarNavegacionPorCategoria();

    mostrarToast('Configuración guardada.', 'ok');
}

function cargarConfiguracion() {
    const cfg = JSON.parse(localStorage.getItem('core_config')) || {};
    aplicarConfiguracion(cfg);
}

function cargarConfiguracionForm() {
    const cfg = JSON.parse(localStorage.getItem('core_config')) || {};
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
    set('cfgEmpresa',   cfg.empresa  || '');
    set('cfgRut',       cfg.rut      || '');
    set('cfgPeriodo',   cfg.periodo  || new Date().getFullYear());
    set('cfgIva',       cfg.iva      || '19');
    set('cfgGiro',      cfg.giro     || '');
    set('cfgDireccion', cfg.direccion|| '');
    const selCat = document.getElementById('cfgCategoria');
    if (selCat) selCat.value = window.currentUser?.categoria || 'primera';

    // Datos de sesión activa
    const u = window.currentUser;
    const txt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || '—'; };
    if (u) {
        txt('cfgSesionEmail',   u.email);
        txt('cfgSesionRol',     window.ROLES?.[u.rol]?.label || u.rol || '—');
        txt('cfgSesionEmpresa', u.empresaId || '—');
    }
}

function aplicarConfiguracion(cfg) {
    const txt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || ''; };
    txt('empresaNombre',  cfg.empresa || 'Mi Empresa Ltda.');
    txt('empresaRut',     cfg.rut     || '-');
    txt('empresaPeriodo', cfg.periodo || '-');
    txt('headerEmpresa',  cfg.empresa || 'Mi Empresa Ltda.');

    const hp = document.getElementById('headerPeriodo');
    if (hp) hp.textContent = cfg.periodo ? `Período ${cfg.periodo}` : '';
}

// ─────────────────────────────────────────────────────────────
//  TOAST NOTIFICATIONS
// ─────────────────────────────────────────────────────────────
function mostrarToast(mensaje, tipo = 'ok') {
    let toast = document.getElementById('toast-global');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast-global';
        toast.style.cssText = `
            position:fixed;bottom:30px;right:30px;z-index:99999;
            padding:14px 22px;border-radius:10px;font-size:14px;font-weight:600;
            box-shadow:0 4px 20px rgba(0,0,0,.15);transition:opacity .3s;
        `;
        document.body.appendChild(toast);
    }
    toast.textContent = mensaje;
    toast.style.background = tipo === 'ok' ? '#dcfce7' : '#fee2e2';
    toast.style.color       = tipo === 'ok' ? '#166534' : '#991b1b';
    toast.style.opacity     = '1';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 3000);
}

window.mostrarToast = mostrarToast;

// ─────────────────────────────────────────────────────────────
//  FORMATEADOR DE RUT CHILENO
//  Aplica puntos y guión mientras el usuario escribe.
//  Acepta RUTs de empresa (8 dígitos) y persona (7 dígitos).
// ─────────────────────────────────────────────────────────────
function fmtRut(input) {
    // Guardar posición del cursor para no jumpear al final
    const pos    = input.selectionStart;
    const prevLen = input.value.length;

    // Limpiar todo excepto dígitos y K/k
    let raw = input.value.replace(/[^0-9kK]/g, '').toUpperCase();

    // Limitar a 9 caracteres (8 dígitos + dígito verificador)
    if (raw.length > 9) raw = raw.slice(0, 9);

    let formatted = raw;

    if (raw.length > 1) {
        const dv   = raw.slice(-1);          // último = dígito verificador
        const body = raw.slice(0, -1);       // el resto = número

        // Insertar puntos cada 3 dígitos desde la derecha
        let num = '';
        for (let i = body.length - 1, c = 0; i >= 0; i--, c++) {
            if (c > 0 && c % 3 === 0) num = '.' + num;
            num = body[i] + num;
        }
        formatted = num + '-' + dv;
    }

    input.value = formatted;

    // Restaurar posición del cursor ajustada por el cambio de largo
    const delta = formatted.length - prevLen;
    const newPos = Math.max(0, pos + delta);
    input.setSelectionRange(newPos, newPos);
}

window.fmtRut = fmtRut;

// ─────────────────────────────────────────────────────────────
//  MODO PRUEBA — desactiva validaciones SII y RUT
// ─────────────────────────────────────────────────────────────
window.MODO_PRUEBA = localStorage.getItem('modo_prueba') === '1';

function toggleModoPrueba() {
    window.MODO_PRUEBA = !window.MODO_PRUEBA;
    localStorage.setItem('modo_prueba', window.MODO_PRUEBA ? '1' : '0');
    _aplicarModoPrueba();
    mostrarToast(
        window.MODO_PRUEBA
            ? '🧪 Modo Prueba activado — validaciones SII deshabilitadas.'
            : '✅ Modo Prueba desactivado — validaciones SII activas.',
        window.MODO_PRUEBA ? 'ok' : 'ok'
    );
}

function _aplicarModoPrueba() {
    const btn = document.getElementById('btnModoPrueba');
    if (!btn) return;
    if (window.MODO_PRUEBA) {
        btn.textContent = '🧪 Modo Prueba: ON';
        btn.classList.add('activo');
    } else {
        btn.textContent = '🧪 Modo Prueba';
        btn.classList.remove('activo');
    }
}

// Sincronizar UI con estado guardado (se ejecuta cuando el script carga)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _aplicarModoPrueba);
} else {
    _aplicarModoPrueba();
}

// ─────────────────────────────────────────────────────────────
//  VALIDACIÓN DE RUT CHILENO — algoritmo módulo 11
// ─────────────────────────────────────────────────────────────
function validarRutChileno(rut) {
    // En modo prueba cualquier RUT se acepta como válido
    if (window.MODO_PRUEBA) return true;
    const raw = (rut || '').replace(/[^0-9kK]/gi, '').toUpperCase();
    if (raw.length < 2) return false;
    const cuerpo = raw.slice(0, -1);
    const dv     = raw.slice(-1);
    if (!/^\d+$/.test(cuerpo)) return false;

    let suma = 0, multiplo = 2;
    for (let i = cuerpo.length - 1; i >= 0; i--) {
        suma += parseInt(cuerpo[i]) * multiplo;
        multiplo = multiplo === 7 ? 2 : multiplo + 1;
    }
    const resto   = suma % 11;
    const dvCalc  = resto === 0 ? '0' : resto === 1 ? 'K' : String(11 - resto);
    return dv === dvCalc;
}

function validarRutInput(input) {
    const elEstado = document.getElementById('ctcRutEstado');
    const btnSII   = document.getElementById('btnConsultarSII');
    const elSII    = document.getElementById('ctcSiiEstado');
    const raw      = (input.value || '').replace(/[^0-9kK]/gi, '');

    // En modo prueba: limpiar estado visual y ocultar botón SII
    if (window.MODO_PRUEBA) {
        if (elEstado) { elEstado.textContent = '🧪 Modo Prueba — RUT libre'; elEstado.style.color = '#854d0e'; }
        if (btnSII)   btnSII.style.display = 'none';
        if (elSII)    elSII.textContent = '';
        input.style.borderColor = raw.length > 2 ? '#fbbf24' : '';
        return;
    }

    if (raw.length < 2) {
        if (elEstado) { elEstado.textContent = ''; elEstado.style.color = ''; }
        if (btnSII)   btnSII.style.display = 'none';
        if (elSII)    elSII.textContent = '';
        return;
    }

    const valido = validarRutChileno(input.value);
    if (elEstado) {
        elEstado.textContent = valido ? '✔ RUT válido' : '✘ RUT inválido';
        elEstado.style.color = valido ? 'var(--positive)' : 'var(--negative)';
    }
    if (btnSII) btnSII.style.display = valido ? 'block' : 'none';
    if (!valido && elSII) elSII.textContent = '';

    input.style.borderColor = raw.length > 2
        ? (valido ? 'var(--positive)' : 'var(--negative)')
        : '';
}

window.validarRutChileno = validarRutChileno;
window.validarRutInput   = validarRutInput;

// ─────────────────────────────────────────────────────────────
//  ARRANQUE
// ─────────────────────────────────────────────────────────────
const _fechaAsientoEl = document.getElementById('fechaAsiento');
if (_fechaAsientoEl) _fechaAsientoEl.valueAsDate = new Date();

cargarConfiguracion();
renderHistorialDiario();
calcularKPIs();

// Autocomplete de contactos en los modales de compras/ventas
if (typeof initContactoAutocomplete === 'function') initContactoAutocomplete();

function _initSelFlujoCajaAnio() {
    const sel = document.getElementById('selFlujoCajaAnio');
    if (sel && !sel.dataset.init) {
        sel.value = new Date().getFullYear();
        sel.dataset.init = '1';
    }
}

function vaciarDiario() {
    if (!confirm('¿Vaciar TODOS los asientos del Libro Diario? Esta acción no se puede deshacer.')) return;
    dbAsientos.length = 0;
    localStorage.setItem('core_asientos', JSON.stringify(dbAsientos));
    renderHistorialDiario();
    mostrarToast('Libro Diario vaciado.', 'ok');
}

// Helper para tabs del directorio de contactos
function _ctcTabActiva(btn) {
    document.querySelectorAll('.ctc-tab').forEach(b => b.classList.remove('ctc-tab-active'));
    btn.classList.add('ctc-tab-active');
}
