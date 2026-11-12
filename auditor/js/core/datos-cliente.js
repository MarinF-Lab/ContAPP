'use strict';
// ─────────────────────────────────────────────────────────────
//  DATOS POR CLIENTE — Fase 0 de conectividad (ver PLANIFICACION/CONECTIVIDAD.md)
//
//  1. DATOS_CLIENTE_DOCS: lista ÚNICA de las claves de localStorage que
//     pertenecen a un cliente. firebase-service.js la usa para sincronizar,
//     limpiar al cambiar de cliente y cargar desde la nube. Antes había 12
//     claves; los módulos de Activos, Cartolas, Inventario, Bodegas, Centros
//     de costo, 2ª categoría y las cuentas por cobrar/pagar quedaban fuera:
//     no se respaldaban y se "heredaban" de un cliente a otro.
//  2. ContappEventos: avisos entre módulos (emitir / escuchar).
//  3. Respaldo completo del cliente (exportar / importar a archivo JSON).
//  4. Migración de datos huérfanos: datos de las claves nuevas que existían
//     en el navegador antes de esta versión no se sabe a qué cliente
//     pertenecen. Se apartan en un respaldo local y se ofrece asignarlos al
//     cliente que el contador abra (nunca se suben solos a la nube).
//
//  Debe cargarse ANTES de los módulos (index.html), porque la migración
//  tiene que correr antes de que cartolas.js lea sus datos a memoria.
// ─────────────────────────────────────────────────────────────

// clave localStorage → id del documento en empresas/{id}/modulos/
const DATOS_CLIENTE_DOCS = {
    // Sincronizadas desde antes
    'core_asientos':       'asientos',
    'core_compras':        'compras',
    'core_ventas':         'ventas',
    'core_contactos':      'contactos',
    'core_plan_cuentas':   'plan_cuentas',
    'core_config':         'config',
    'core_reconciliacion': 'reconciliacion',
    'core_documentos':     'documentos',
    'rem_trabajadores':    'rem_trabajadores',
    'rem_liquidaciones':   'rem_liquidaciones',
    'rem_vacaciones':      'rem_vacaciones',
    'core_productos':      'productos',
    // Nuevas en Fase 0
    'core_activos':                'activos',
    'core_bodegas':                'bodegas',
    'core_centros_costo':          'centros_costo',
    'core_inventario_movimientos': 'inventario_movimientos',
    'core_cartola_movs':           'cartola_movs',
    'doc_pagar':                   'doc_pagar',
    'doc_cobrar':                  'doc_cobrar',
    'hon_boletas':                 'hon_boletas',
    'hon_egresos':                 'hon_egresos',
    'hon_ingresos_extra':          'hon_ingresos_extra',
    'hon_ppm':                     'hon_ppm',
    'hon_prestadores':             'hon_prestadores',
    'hon_retenciones':             'hon_retenciones',
};
const DATOS_CLIENTE_KEYS = Object.keys(DATOS_CLIENTE_DOCS);

// Claves que se agregaron en Fase 0: son las que pueden tener datos huérfanos.
const DATOS_CLIENTE_KEYS_NUEVAS = [
    'core_activos', 'core_bodegas', 'core_centros_costo', 'core_inventario_movimientos',
    'core_cartola_movs', 'doc_pagar', 'doc_cobrar',
    'hon_boletas', 'hon_egresos', 'hon_ingresos_extra', 'hon_ppm', 'hon_prestadores', 'hon_retenciones',
];

// A qué cliente pertenecen los datos que hay ahora en localStorage.
const DATOS_CLIENTE_DUENO_KEY = 'core_datos_empresa_id';
const DATOS_HUERFANOS_KEY     = 'core_respaldo_sin_cliente';
const DATOS_MIGRACION_FLAG    = 'core_migracion_aislamiento_v1';

// Firestore rechaza documentos de más de 1 MiB. Avisar al 70%.
const DATOS_DOC_LIMITE_BYTES = 1048576 - 2048; // margen para el campo y metadatos
const DATOS_DOC_AVISO_BYTES  = Math.round(1048576 * 0.7);

const _DATOS_ETIQUETAS = {
    core_activos: 'activos fijos', core_bodegas: 'bodegas', core_centros_costo: 'centros de costo',
    core_inventario_movimientos: 'movimientos de inventario', core_cartola_movs: 'movimientos de cartola',
    doc_pagar: 'documentos por pagar', doc_cobrar: 'documentos por cobrar',
    hon_boletas: 'boletas de honorarios', hon_egresos: 'egresos de honorarios',
    hon_ingresos_extra: 'otros ingresos', hon_ppm: 'registros de PPM',
    hon_prestadores: 'prestadores', hon_retenciones: 'retenciones',
};

// ── Avisos entre módulos ──────────────────────────────────────
// Nombres en uso:
//   'cliente:datos-cargados'  → los datos locales cambiaron de cliente (o se
//                               importaron); cada módulo recarga su memoria.
//   'asiento:registrado'      → { asiento, actualizado, origen, ref }
//   'asiento:anulado'         → { asientos, origen, ref }
const ContappEventos = {
    emitir(nombre, detalle) {
        try { document.dispatchEvent(new CustomEvent('contapp:' + nombre, { detail: detalle || {} })); }
        catch (e) { /* un oyente con error no debe cortar al resto */ }
    },
    escuchar(nombre, fn) {
        const h = ev => { try { fn(ev.detail || {}); } catch (e) { console.warn('[ContappEventos]', nombre, e); } };
        document.addEventListener('contapp:' + nombre, h);
        return () => document.removeEventListener('contapp:' + nombre, h);
    },
};
window.ContappEventos = ContappEventos;

// ── Utilidades ────────────────────────────────────────────────
function datosClienteTamanoBytes(valor) {
    if (valor == null) return 0;
    try { return new TextEncoder().encode(String(valor)).length; }
    catch (e) { return String(valor).length * 2; }
}

function datosClienteDueno() {
    return localStorage.getItem(DATOS_CLIENTE_DUENO_KEY) || null;
}

function datosClienteMarcarDueno(empresaId) {
    if (empresaId) localStorage.setItem(DATOS_CLIENTE_DUENO_KEY, empresaId);
    else localStorage.removeItem(DATOS_CLIENTE_DUENO_KEY);
}

/** Borra del navegador todos los datos del cliente actual (no toca la nube). */
function datosClienteLimpiar() {
    DATOS_CLIENTE_KEYS.forEach(k => localStorage.removeItem(k));
    localStorage.removeItem(DATOS_CLIENTE_DUENO_KEY);
}

function _datosParse(v) {
    if (v == null) return null;
    try { return JSON.parse(v); } catch (e) { return v; }
}

// ── Respaldo completo del cliente ─────────────────────────────
/** Arma el objeto de respaldo con todas las claves del cliente actual. */
function datosClienteArmarRespaldo() {
    const datos = {};
    DATOS_CLIENTE_KEYS.forEach(k => {
        const v = localStorage.getItem(k);
        if (v !== null) datos[k] = _datosParse(v);
    });
    return {
        formato:       'contapp-respaldo-cliente',
        version:       1,
        fecha:         new Date().toISOString(),
        empresaId:     window.currentUser?.empresaId || datosClienteDueno() || null,
        empresaNombre: window.currentUser?.empresaNombre || null,
        datos,
    };
}

/** Descarga un archivo .json con todos los datos del cliente actual. */
function exportarRespaldoCliente() {
    const resp   = datosClienteArmarRespaldo();
    const nombre = (resp.empresaNombre || resp.empresaId || 'cliente')
        .toString().replace(/[^a-z0-9áéíóúñ_-]+/gi, '_').slice(0, 40);
    const fecha  = resp.fecha.slice(0, 10);
    const blob   = new Blob([JSON.stringify(resp, null, 1)], { type: 'application/json' });
    const url    = URL.createObjectURL(blob);
    const a      = document.createElement('a');
    a.href = url;
    a.download = `respaldo-${nombre}-${fecha}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    if (typeof mostrarToast === 'function') {
        mostrarToast(`Respaldo descargado: ${Object.keys(resp.datos).length} tipos de datos.`, 'ok');
    }
    return resp;
}

/**
 * Valida un respaldo. Devuelve { ok, error, respaldo }.
 * Solo acepta claves conocidas; ignora el resto.
 */
function datosClienteValidarRespaldo(obj) {
    if (!obj || obj.formato !== 'contapp-respaldo-cliente' || typeof obj.datos !== 'object') {
        return { ok: false, error: 'El archivo no es un respaldo de ContApp.' };
    }
    const datos = {};
    Object.keys(obj.datos).forEach(k => { if (DATOS_CLIENTE_DOCS[k]) datos[k] = obj.datos[k]; });
    if (!Object.keys(datos).length) return { ok: false, error: 'El respaldo no trae datos reconocibles.' };
    return { ok: true, respaldo: { ...obj, datos } };
}

/**
 * Restaura un respaldo (File o texto JSON) sobre el cliente abierto.
 * Pide confirmación: reemplaza los datos locales del cliente actual.
 */
function importarRespaldoCliente(archivoOTexto) {
    const aplicar = texto => {
        let obj;
        try { obj = JSON.parse(texto); }
        catch (e) { mostrarToast('El archivo no es un JSON válido.', 'error'); return; }
        const v = datosClienteValidarRespaldo(obj);
        if (!v.ok) { mostrarToast(v.error, 'error'); return; }
        const destino = window.currentUser?.empresaNombre || 'el cliente abierto';
        const origen  = v.respaldo.empresaNombre ? ` (respaldo de ${v.respaldo.empresaNombre})` : '';
        mostrarConfirm(
            `Se reemplazarán los datos de ${destino} con el respaldo del ${String(v.respaldo.fecha).slice(0, 10)}${origen}. ¿Continuar?`,
            () => {
                Object.entries(v.respaldo.datos).forEach(([k, val]) => {
                    localStorage.setItem(k, typeof val === 'string' ? val : JSON.stringify(val));
                });
                ContappEventos.emitir('cliente:datos-cargados', { motivo: 'importacion' });
                mostrarToast('Respaldo restaurado.', 'ok');
            },
            { titulo: 'Restaurar respaldo', textoBtn: 'Restaurar' }
        );
    };
    if (typeof archivoOTexto === 'string') { aplicar(archivoOTexto); return; }
    if (archivoOTexto && typeof archivoOTexto.text === 'function') { archivoOTexto.text().then(aplicar); }
}

// ── Datos huérfanos de versiones anteriores ───────────────────
/**
 * Corre una sola vez por navegador. Aparta los datos de las claves nuevas
 * que ya existían (sin dueño conocido) para que no se suban mezclados al
 * primer cliente que se abra.
 */
function datosClienteMigrarHuerfanos() {
    if (localStorage.getItem(DATOS_MIGRACION_FLAG)) return;
    const datos = {};
    DATOS_CLIENTE_KEYS_NUEVAS.forEach(k => {
        const v = localStorage.getItem(k);
        if (v === null) return;
        const parsed = _datosParse(v);
        if (Array.isArray(parsed) && parsed.length === 0) { localStorage.removeItem(k); return; }
        datos[k] = v;
        localStorage.removeItem(k);
    });
    if (Object.keys(datos).length) {
        localStorage.setItem(DATOS_HUERFANOS_KEY, JSON.stringify({ fecha: new Date().toISOString(), datos, rechazadoPor: [] }));
    }
    localStorage.setItem(DATOS_MIGRACION_FLAG, new Date().toISOString());
}

/**
 * Aparta TODOS los datos del cliente actual como huérfanos (unidos con los que
 * ya hubiera). Se usa cuando hay que limpiar el navegador pero los datos no se
 * pudieron subir a la nube (sin conexión, sin permiso o creados en modo local).
 */
function datosClienteApartarComoHuerfanos(origen) {
    let reg;
    try { reg = JSON.parse(localStorage.getItem(DATOS_HUERFANOS_KEY) || 'null'); } catch (e) { reg = null; }
    reg = reg && reg.datos ? reg : { fecha: new Date().toISOString(), datos: {} };
    let hay = false;
    DATOS_CLIENTE_KEYS.forEach(k => {
        const v = localStorage.getItem(k);
        if (v === null) return;
        const p = _datosParse(v);
        if (Array.isArray(p) && !p.length) return;
        const previo = reg.datos[k] != null ? _datosParse(reg.datos[k]) : null;
        const final  = previo == null ? p : _datosUnirPorId(previo, p);
        reg.datos[k] = typeof final === 'string' ? final : JSON.stringify(final);
        hay = true;
    });
    if (!hay) return false;
    reg.origen = origen || null;
    reg.rechazadoPor = [];   // volver a preguntar en todos los clientes
    localStorage.setItem(DATOS_HUERFANOS_KEY, JSON.stringify(reg));
    return true;
}

function datosClienteResumenHuerfanos() {
    let r;
    try { r = JSON.parse(localStorage.getItem(DATOS_HUERFANOS_KEY) || 'null'); } catch (e) { r = null; }
    if (!r || !r.datos) return null;
    const partes = Object.entries(r.datos).map(([k, v]) => {
        const p = _datosParse(v);
        const n = Array.isArray(p) ? p.length : 1;
        return `${n} ${_DATOS_ETIQUETAS[k] || k}`;
    });
    return { registro: r, texto: partes.join(', ') };
}

/** Une dos arreglos por id (los del respaldo se agregan si no existen). */
function _datosUnirPorId(actual, extra) {
    if (!Array.isArray(actual) || !Array.isArray(extra)) return extra;
    const ids = new Set(actual.map(x => x && x.id));
    return actual.concat(extra.filter(x => !x || x.id == null || !ids.has(x.id)));
}

/** Asigna los datos huérfanos al cliente abierto (une con lo que ya tenga). */
function datosClienteAsignarHuerfanos() {
    const res = datosClienteResumenHuerfanos();
    if (!res) return false;
    Object.entries(res.registro.datos).forEach(([k, v]) => {
        const actual = _datosParse(localStorage.getItem(k));
        const extra  = _datosParse(v);
        const final  = actual == null ? extra : _datosUnirPorId(actual, extra);
        localStorage.setItem(k, typeof final === 'string' ? final : JSON.stringify(final));
    });
    localStorage.removeItem(DATOS_HUERFANOS_KEY);
    ContappEventos.emitir('cliente:datos-cargados', { motivo: 'huerfanos' });
    return true;
}

/**
 * Se llama al terminar de abrir un cliente. Si quedan datos huérfanos y este
 * cliente no los rechazó antes, pregunta si se asignan a él.
 */
function datosClienteOfrecerHuerfanos() {
    const res = datosClienteResumenHuerfanos();
    if (!res || typeof mostrarConfirm !== 'function') return;
    const empresaId = window.currentUser?.empresaId || 'local';
    if ((res.registro.rechazadoPor || []).includes(empresaId)) return;

    // Marcar como "preguntado" a este cliente: si cancela, no se repite para él.
    res.registro.rechazadoPor = [...(res.registro.rechazadoPor || []), empresaId];
    localStorage.setItem(DATOS_HUERFANOS_KEY, JSON.stringify(res.registro));

    const nombre = window.currentUser?.empresaNombre || 'este cliente';
    setTimeout(() => mostrarConfirm(
        `Encontré datos de una versión anterior sin cliente asignado: ${res.texto}. ` +
        `¿Pertenecen a ${nombre}? Si no, cancela y te preguntaré al abrir otro cliente.`,
        () => {
            if (datosClienteAsignarHuerfanos()) mostrarToast(`Datos asignados a ${nombre}.`, 'ok');
        },
        { titulo: 'Datos sin cliente', textoBtn: 'Asignar a este cliente', tipo: 'info' }
    ), 600);
}

// La migración corre al cargar el script (antes que los módulos).
try { datosClienteMigrarHuerfanos(); } catch (e) { console.warn('Migración de datos huérfanos:', e); }

window.DATOS_CLIENTE_DOCS            = DATOS_CLIENTE_DOCS;
window.DATOS_CLIENTE_KEYS            = DATOS_CLIENTE_KEYS;
window.datosClienteLimpiar           = datosClienteLimpiar;
window.datosClienteDueno             = datosClienteDueno;
window.datosClienteMarcarDueno       = datosClienteMarcarDueno;
window.datosClienteTamanoBytes       = datosClienteTamanoBytes;
window.datosClienteArmarRespaldo     = datosClienteArmarRespaldo;
window.exportarRespaldoCliente       = exportarRespaldoCliente;
window.importarRespaldoCliente       = importarRespaldoCliente;
window.datosClienteOfrecerHuerfanos  = datosClienteOfrecerHuerfanos;
window.datosClienteAsignarHuerfanos  = datosClienteAsignarHuerfanos;
window.datosClienteApartarComoHuerfanos = datosClienteApartarComoHuerfanos;
