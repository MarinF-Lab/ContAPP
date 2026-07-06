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
function modTab(viewId, tabId) {
    const view = document.getElementById(viewId);
    if (!view) return;
    view.querySelectorAll('.mod-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
    view.querySelectorAll('.mod-tab-panel').forEach(p => p.classList.toggle('active', p.id === tabId));
    // Disparar render de la pestaña activada
    const renderMap = {
        'tab-diario':              () => {},
        'tab-mayor':               () => generarLibroMayor(),
        'tab-balance':             () => generarBalanceGeneral(),
        'tab-balance-clasificado': () => generarBalanceClasificado(),
        'tab-estado-resultados':   () => generarEstadoResultados(),
        'tab-flujo-caja':          () => { _initSelFlujoCajaAnio(); generarFlujoCaja(); },
        // G2 · Comercial
        'tab-ei-compras':          () => renderCompras(),
        'tab-ei-ventas':           () => renderVentas(),
        'tab-ei-honorarios':       () => {},   // formulario estático, sin render inicial
        'tab-trib-iva':            () => { _initIvaSelectores(); generarIvaResumen(); },
        // G3 · Datos
        'tab-cc-cartolas':         () => renderCartolas(),
        'tab-cc-conciliacion':     () => renderReconciliacion(),
        // G4 · RRHH
        'tab-rem-liquidaciones':   () => remInit(),
        'tab-rem-previsional':     () => renderIndicadores(),
        // G5 · Empresa
        'tab-ap-activos':          () => renderActivos(),
        'tab-ap-productos':        () => renderProductos(),
        'tab-aud-informe':         () => renderInforme(),
        'tab-aud-hallazgos':       () => renderHallazgos(),
        // Segunda categoría — G1 Libros Contables
        'view-libro-honorarios':   () => honRenderLibro(),
        'view-libro-ingresos-hon':() => honRenderLibroIngresos(),
        'view-libro-egresos-hon': () => honRenderLibroEgresos(),
        // Segunda categoría — G3 Declaración de Impuestos
        'view-f29-hon':            () => { honGenerarF29(); honRenderPPM(); },
        'view-f22-hon':            () => {},   // formulario estático, cálculo por botón
    };
    if (renderMap[tabId]) renderMap[tabId]();
}

// Dispara el render de la pestaña activa de una vista con tabs
function _fireActiveTab(viewId) {
    const activa = document.querySelector('#' + viewId + ' .mod-tab-btn.active');
    if (activa) modTab(viewId, activa.dataset.tab);
}

// Widget de indicadores económicos en Inicio — colapsable
function toggleIndicadoresWidget() {
    const body    = document.getElementById('widgetIndicadoresBody');
    const chevron = document.getElementById('widgetIndicadoresChevron');
    if (!body) return;
    const abierto = body.style.display !== 'none';
    body.style.display = abierto ? 'none' : '';
    if (chevron) chevron.style.transform = abierto ? 'rotate(-90deg)' : 'rotate(0deg)';
}

function navegar(modulo, elNav) {

    // Cerrar cualquier modal abierto al cambiar de módulo (evita que quede
    // flotando sobre la vista de destino — ej. "Nuevo hallazgo" desde Libro Diario)
    document.querySelectorAll('.modal-overlay').forEach(m => {
        if (getComputedStyle(m).display !== 'none') m.style.display = 'none';
    });

    // Redirigir vistas antiguas a sus nuevas tabs
    const tabRedirects = {
        'diario':              ['estructura-contable',  'tab-diario'],
        'mayor':               ['estructura-contable',  'tab-mayor'],
        'balance':             ['estructura-contable',  'tab-balance'],
        'balance-clasificado': ['reportes-financieros', 'tab-balance-clasificado'],
        'estado-resultados':   ['reportes-financieros', 'tab-estado-resultados'],
        'flujo-caja':          ['reportes-financieros', 'tab-flujo-caja'],
        // G2 · Comercial
        'compras':             ['egresos-ingresos', 'tab-ei-compras'],
        'ventas':              ['egresos-ingresos', 'tab-ei-ventas'],
        'honorarios':          ['egresos-ingresos', 'tab-ei-honorarios'],
        'iva-resumen':         ['tributario-1cat',  'tab-trib-iva'],
        // G3 · Datos
        'cartolas':            ['conciliacion-cartolas', 'tab-cc-cartolas'],
        'reconciliacion':      ['conciliacion-cartolas', 'tab-cc-conciliacion'],
        // G5 · Empresa
        'activos':             ['activos-produccion', 'tab-ap-activos'],
        'productos':           ['activos-produccion', 'tab-ap-productos'],
        'informe':             ['auditoria', 'tab-aud-informe'],
        'hallazgos':           ['auditoria', 'tab-aud-hallazgos'],
        // Segunda categoría
        'libro-honorarios':    ['libros-contables-hon', 'view-libro-honorarios'],
        'libro-ingresos-hon':  ['libros-contables-hon', 'view-libro-ingresos-hon'],
        'libro-egresos-hon':   ['libros-contables-hon', 'view-libro-egresos-hon'],
        'f29-hon':             ['declaracion-impuestos-hon', 'view-f29-hon'],
        'f22-hon':             ['declaracion-impuestos-hon', 'view-f22-hon'],
    };

    // Indicadores económicos: absorbidos como widget en Inicio (sin tabs)
    if (modulo === 'indicadores') { navegar('inicio', elNav); return; }
    if (tabRedirects[modulo]) {
        const [newMod, tabId] = tabRedirects[modulo];
        navegar(newMod, elNav);
        modTab(`view-${newMod}`, tabId);
        return;
    }

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
        'estructura-contable': ['Contabilidad — Estructura Contable', 'Libro Diario, Libro Mayor y Balance General'],
        'reportes-financieros':['Contabilidad — Reportes Financieros','Balance Clasificado, Estado de Resultados y Flujo de Caja'],
        'egresos-ingresos':    ['Comercial — Egresos e Ingresos','Libro de Compras, Libro de Ventas y Boletas de Honorarios'],
        'tributario-1cat':     ['Comercial — Tributario',        'Declaración de impuestos F29 e IVA del período'],
        'conciliacion-cartolas':['Datos — Conciliación y Cartolas','Cartolas bancarias y conciliación de movimientos contra el diario'],
        remuneraciones:        ['RRHH — Remuneraciones',        'Liquidaciones de sueldo, fichas de trabajadores e indicadores previsionales'],
        'activos-produccion':  ['Empresa — Activos y Producción','Activos fijos y catálogo de productos y servicios'],
        auditoria:             ['Empresa — Auditoría',          'Informe de auditoría y hallazgos del período'],
        diario:                ['Libro Diario Automático',      'Procesador lingüístico de operaciones de comercio'],
        mayor:                 ['Libro Mayor General',          'Apertura de movimientos consolidados por cuentas T'],
        balance:               ['Balance de Comprobación',      'Matriz de control financiero de 8 columnas'],
        compras:               ['Libro de Compras',             'Registro de documentos de compra — formato SII Chile'],
        ventas:                ['Libro de Ventas',              'Registro de documentos de venta — formato SII Chile'],
        documentos:            ['Registro de Documentación',    'Archivo de facturas, boletas y honorarios clasificados por categoría'],
        clientes:              ['Clientes y Proveedores',       'Directorio de contactos con historial de transacciones'],
        productos:             ['Productos y Servicios',         'Catálogo del cliente — base para compras, ventas e inventario'],
        activos:               ['Activos Fijos',                 'Registro, depreciación lineal y acelerada SII por bien del activo'],
        cartolas:              ['Cartolas Bancarias',            'Importa extractos bancarios y clasifica movimientos en el diario'],
        'flujo-caja':          ['Flujo de Caja',                'Movimientos de efectivo — Caja y Banco'],
        'balance-clasificado': ['Balance Clasificado',          'Activo, Pasivo y Patrimonio ordenados por liquidez'],
        'estado-resultados':   ['Estado de Resultados',         'Ingresos, costos y resultado del ejercicio'],
        'plan-cuentas':        ['Plan de Cuentas',              'Administración del catálogo contable'],
        reconciliacion:        ['Conciliación Bancaria',        'Cruce de movimientos del extracto bancario contra el diario'],
        configuracion:         ['Configuración',                'Ajustes de la empresa y del sistema'],
        indicadores:           ['Indicadores Económicos',       'UF, UTM, Dólar, Euro y otros indicadores del día'],
        'iva-resumen':         ['Resumen IVA — F29',            'Cruce de débito y crédito fiscal del período'],
        // Segunda categoría
        'libros-contables-hon':      ['Contabilidad — Libros Contables', 'Libro de Honorarios, Libro de Ingresos y Libro de Egresos'],
        'declaracion-impuestos-hon': ['Tributario — Declaración de Impuestos', 'Formulario 29 y Formulario 22'],
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
        hallazgos:             ['Hallazgos de Auditoría',        'Observaciones y hallazgos del período — diferencial Auditor'],
        informe:               ['Informe de Auditoría',          'Generador del documento formal con hallazgos e opinión profesional'],
    };

    if (titulos[modulo]) {
        document.getElementById('txt-modulo-titulo').innerText = titulos[modulo][0];
        document.getElementById('txt-modulo-desc').innerText   = titulos[modulo][1];
    }

    if (modulo === 'inicio')               { calcularKPIs(); renderIndicadores(); }
    if (modulo === 'estructura-contable')  _fireActiveTab('view-estructura-contable');
    if (modulo === 'reportes-financieros') _fireActiveTab('view-reportes-financieros');
    if (modulo === 'egresos-ingresos')     _fireActiveTab('view-egresos-ingresos');
    if (modulo === 'tributario-1cat')      _fireActiveTab('view-tributario-1cat');
    if (modulo === 'conciliacion-cartolas')_fireActiveTab('view-conciliacion-cartolas');
    if (modulo === 'activos-produccion')   _fireActiveTab('view-activos-produccion');
    if (modulo === 'auditoria')            _fireActiveTab('view-auditoria');
    if (modulo === 'plan-cuentas')    renderPlanCuentas();
    if (modulo === 'documentos')            renderDocumentos();
    if (modulo === 'clientes')              renderContactos();
    if (modulo === 'remuneraciones') _fireActiveTab('view-remuneraciones');
    // Segunda categoría
    if (modulo === 'libros-contables-hon')      _fireActiveTab('view-libros-contables-hon');
    if (modulo === 'declaracion-impuestos-hon') _fireActiveTab('view-declaracion-impuestos-hon');
    if (modulo === 'retenciones-hon')    honRenderRetenciones();
    if (modulo === 'prestadores')        honRenderPrestadores();
    if (modulo === 'dj1879')             honRenderDJ1879();
    if (modulo === 'calendario-hon')     honRenderCalendario();
    if (modulo === 'configuracion') {
        cargarConfiguracionForm();
        cargarModulosConfig();
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
        const updateData = { categoria: nuevaCat };
        // Si cambió la categoría, limpiar modulosActivos para evitar claves de otra categoría
        if (catAnterior && catAnterior !== nuevaCat) {
            updateData.modulosActivos = firebase.firestore.FieldValue.delete();
            window.currentUser.modulosActivos = null;
        }
        // categoria solo vive en el doc de empresa, no en el sub-doc de usuario
        empRef.update(updateData).catch(() => {});
    }

    if (typeof aplicarNavegacionPorCategoria === 'function') aplicarNavegacionPorCategoria();
    cargarModulosConfig();

    mostrarToast('Configuración guardada.', 'ok');
}

function cargarConfiguracion() {
    const cfg = JSON.parse(localStorage.getItem('core_config')) || {};
    aplicarConfiguracion(cfg);
}

function cargarModulosConfig() {
    if (typeof audRenderizarToggleModulos !== 'function') return;
    const categoria    = window.currentUser?.categoria || 'primera';
    const modulosActivos = window.currentUser?.modulosActivos || null;
    audRenderizarToggleModulos('cfgModulosContainer', categoria, modulosActivos);
}

async function guardarModulosConfig() {
    if (typeof audLeerModulosFormulario !== 'function') return;
    const categoria = window.currentUser?.categoria || 'primera';
    const modulos   = audLeerModulosFormulario(categoria, 'cfgModulosContainer');

    // Protección: si todos quedaron en false, probablemente los checkboxes no están
    // renderizados en este momento. Usar defaults en lugar de guardar todo apagado.
    const hayAlgunoActivo = Object.values(modulos).some(v => v === true);
    if (!hayAlgunoActivo) {
        mostrarToast('No se detectaron módulos activos. Recarga la página e intenta de nuevo.', 'error');
        return;
    }


    // Persistir en localStorage como fuente de verdad local (funciona offline también)
    if (window.currentUser) window.currentUser.modulosActivos = modulos;
    localStorage.setItem('_modulosActivos', JSON.stringify({ categoria, modulos }));
    try { localStorage.setItem('_fb_perfil_local', JSON.stringify(window.currentUser)); } catch {}

    if (window._fbDb && window.currentUser?.empresaId) {
        try {
            await window._fbDb.collection('empresas')
                .doc(window.currentUser.empresaId)
                .update({ modulosActivos: modulos });
        } catch (e) {
            // Fallo silencioso — datos ya guardados en localStorage
        }
    }

    if (typeof audAplicarModulos === 'function') {
        audAplicarModulos(modulos, categoria);
    }
    mostrarToast('Módulos actualizados.', 'ok');
}

async function resetearModulosConfig() {
    mostrarConfirm('¿Restablecer todos los módulos a sus valores por defecto?', async () => {
        const categoria = window.currentUser?.categoria || 'primera';
        const modulos   = (typeof audModulosDefecto === 'function') ? audModulosDefecto(categoria) : null;
        if (!modulos) return;

        if (window._fbDb && window.currentUser?.empresaId) {
            try {
                await window._fbDb.collection('empresas')
                    .doc(window.currentUser.empresaId)
                    .update({ modulosActivos: modulos });
                if (window.currentUser) window.currentUser.modulosActivos = modulos;
            } catch (e) {
                mostrarToast('Error al restablecer módulos.', 'error');
                return;
            }
        }

        if (typeof audAplicarModulos === 'function') audAplicarModulos(modulos, categoria);
        if (typeof audRenderizarToggleModulos === 'function') {
            audRenderizarToggleModulos('cfgModulosContainer', categoria, modulos);
        }
        mostrarToast('Módulos restablecidos a valores por defecto.', 'ok');
    });
}

window.cargarModulosConfig  = cargarModulosConfig;
window.guardarModulosConfig = guardarModulosConfig;
window.resetearModulosConfig = resetearModulosConfig;

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

function mostrarConfirm(mensaje, onConfirm, { titulo = '¿Confirmar?', textoBtn = 'Confirmar', tipo = 'danger' } = {}) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-confirm';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:99998;display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `
        <div style="background:var(--card-bg,#fff);border-radius:12px;padding:28px 32px;max-width:420px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,.2);">
            <h3 style="margin:0 0 12px;font-size:16px;">${titulo}</h3>
            <p style="margin:0 0 24px;color:var(--text-muted,#555);font-size:14px;line-height:1.5;">${mensaje}</p>
            <div style="display:flex;gap:10px;justify-content:flex-end;">
                <button id="_confirmCancelar" class="btn btn-secondary">Cancelar</button>
                <button id="_confirmAceptar" class="btn btn-danger">${textoBtn}</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    const cerrar = () => document.body.removeChild(overlay);
    overlay.querySelector('#_confirmCancelar').onclick = cerrar;
    overlay.querySelector('#_confirmAceptar').onclick = () => { cerrar(); onConfirm(); };
    overlay.addEventListener('click', e => { if (e.target === overlay) cerrar(); });
}

window.mostrarConfirm = mostrarConfirm;

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
//  G2 · COMERCIAL — reubicar contenido legacy dentro de tabs
//  Mueve los nodos de las vistas legacy a los paneles de pestañas,
//  preservando IDs y handlers. Se ejecuta una sola vez al cargar.
// ─────────────────────────────────────────────────────────────
function _initModulosComerciales() {
    const mover = (fromId, toId) => {
        const from = document.getElementById(fromId);
        const to   = document.getElementById(toId);
        if (from && to && !to.dataset.mounted && from.children.length) {
            while (from.firstChild) to.appendChild(from.firstChild);
            to.dataset.mounted = '1';
        }
    };
    mover('view-compras',     'tab-ei-compras');
    mover('view-ventas',      'tab-ei-ventas');
    mover('view-honorarios',  'tab-ei-honorarios');
    mover('view-iva-resumen', 'tab-trib-iva');
}

// ─────────────────────────────────────────────────────────────
//  G3 · DATOS — reubicar contenido legacy dentro de tabs
//  Cartolas: se mueve el nodo shell (renderCartolas lo puebla por id).
//  Conciliación: se mueve rec-root (renderReconciliacion lo puebla por id).
// ─────────────────────────────────────────────────────────────
function _initModulosDatos() {
    const cartNode = document.getElementById('view-cartolas');
    const cartTo   = document.getElementById('tab-cc-cartolas');
    if (cartNode && cartTo && cartNode.parentElement !== cartTo) {
        cartNode.classList.remove('view');   // ya no es vista de primer nivel
        cartTo.appendChild(cartNode);
    }
    const recRoot = document.getElementById('rec-root');
    const recTo   = document.getElementById('tab-cc-conciliacion');
    if (recRoot && recTo && recRoot.parentElement !== recTo) {
        recTo.appendChild(recRoot);
    }
}

// ─────────────────────────────────────────────────────────────
//  G5 · EMPRESA — reubicar contenido legacy dentro de tabs
//  Todos son shells poblados por su render vía getElementById('view-x').
// ─────────────────────────────────────────────────────────────
function _initModulosEmpresa() {
    const mover = (fromId, toId) => {
        const from = document.getElementById(fromId);
        const to   = document.getElementById(toId);
        if (from && to && from.parentElement !== to) {
            from.classList.remove('view');
            to.appendChild(from);
        }
    };
    mover('view-activos',   'tab-ap-activos');
    mover('view-productos', 'tab-ap-productos');
    mover('view-informe',   'tab-aud-informe');
    mover('view-hallazgos', 'tab-aud-hallazgos');
}

// ─────────────────────────────────────────────────────────────
//  SEGUNDA CATEGORÍA — reubicar contenido legacy dentro de tabs
//  A diferencia de G1-G5, los paneles conservan el id original
//  (view-libro-honorarios, view-f29-hon, etc.) porque el código de
//  segunda-categoria.js chequea `.classList.contains('active')`
//  sobre esos ids exactos (ej. _honEnLibro()).
// ─────────────────────────────────────────────────────────────
function _initModulosSegunda() {
    const moverPanel = (nodeId, wrapperId, activo) => {
        const node    = document.getElementById(nodeId);
        const wrapper = document.getElementById(wrapperId);
        if (node && wrapper && node.parentElement !== wrapper) {
            node.classList.remove('view');
            node.classList.add('mod-tab-panel');
            if (activo) node.classList.add('active');
            wrapper.appendChild(node);
        }
    };
    moverPanel('view-libro-honorarios',    'view-libros-contables-hon',        true);
    moverPanel('view-libro-ingresos-hon',  'view-libros-contables-hon',        false);
    moverPanel('view-libro-egresos-hon',   'view-libros-contables-hon',        false);
    moverPanel('view-f29-hon',             'view-declaracion-impuestos-hon',   true);
    moverPanel('view-f22-hon',             'view-declaracion-impuestos-hon',   false);
}

function _initModulosTabs() {
    _initModulosComerciales();
    _initModulosDatos();
    _initModulosEmpresa();
    _initModulosSegunda();
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _initModulosTabs);
} else {
    _initModulosTabs();
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
    mostrarConfirm('¿Vaciar TODOS los asientos del Libro Diario? Esta acción no se puede deshacer.', () => {
        dbAsientos.length = 0;
        localStorage.setItem('core_asientos', JSON.stringify(dbAsientos));
        renderHistorialDiario();
        mostrarToast('Libro Diario vaciado.', 'ok');
    }, { titulo: 'Vaciar Libro Diario', textoBtn: 'Sí, vaciar' });
}

// Helper para tabs del directorio de contactos
function _ctcTabActiva(btn) {
    document.querySelectorAll('.ctc-tab').forEach(b => b.classList.remove('ctc-tab-active'));
    btn.classList.add('ctc-tab-active');
}
