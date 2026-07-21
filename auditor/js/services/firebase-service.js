// ─────────────────────────────────────────────────────────────
//  FIREBASE SERVICE — Auth + Firestore sync
//  Proyecto: contapp-auditor
// ─────────────────────────────────────────────────────────────

// Login real reactivado (2026-07-16) — mientras se probaba el nuevo diseño se
// entraba directo en modo offline/local vía _fbEntrarModoOffline(). El flag
// se conserva por si hace falta volver a desactivarlo puntualmente.
const LOGIN_DESACTIVADO_TEMPORAL = false;

const FB_CONFIG = {
    apiKey:            "AIzaSyCXOdGxHzccm624-p2FIYgVKsJAhwONFDk",
    authDomain:        "contapp-auditor.firebaseapp.com",
    projectId:         "contapp-auditor",
    storageBucket:     "contapp-auditor.firebasestorage.app",
    messagingSenderId: "449801913268",
    appId:             "1:449801913268:web:166038705a5fd563e3a8e1",
};

const FB_KEYS = [
    'core_asientos', 'core_compras', 'core_ventas',
    'core_contactos', 'core_plan_cuentas', 'core_config',
    'core_reconciliacion', 'core_documentos',
    'rem_trabajadores', 'rem_liquidaciones', 'rem_vacaciones',
    'core_productos',
];

// Mapeo localStorage key → ID del documento en la subcollección modulos/
const FB_KEY_TO_DOC = {
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
};

let _fbAuth    = null;
let _fbDb      = null;
let _fbUser    = null;
let _syncTimer = null;
let _syncBusy  = false;

// ── Modo offline ──────────────────────────────────────────────
let _modoOffline = false;
const FB_OFFLINE_TIMEOUT = 6000; // ms sin respuesta de Firebase → modo offline

function _fbEntrarModoOffline() {
    if (_modoOffline) return;
    _modoOffline = true;

    // Cargar perfil local guardado
    try {
        const perfilLocal = JSON.parse(localStorage.getItem('_fb_perfil_local') || 'null');
        window.currentUser = perfilLocal || {
            uid: 'local', email: 'local@offline', rol: 'admin',
            categoria: 'primera', empresaId: 'local',
        };
        // Si el perfil no tenía modulosActivos, intentar desde la clave dedicada
        if (!window.currentUser.modulosActivos) {
            const loc = JSON.parse(localStorage.getItem('_modulosActivos') || 'null');
            if (loc?.modulos) window.currentUser.modulosActivos = loc.modulos;
        }
    } catch { window.currentUser = { uid: 'local', email: 'local@offline', rol: 'admin', categoria: 'primera', empresaId: 'local' }; }

    // Mostrar app con banner offline (saltar el selector de empresa)
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('wizardOverlay').style.display = 'none';
    document.body.classList.remove('empresa-mode');
    document.getElementById('view-empresa')?.classList.remove('active');
    document.getElementById('view-inicio')?.classList.add('active');
    document.getElementById('fb-user-email').textContent   = window.currentUser.email + (LOGIN_DESACTIVADO_TEMPORAL ? ' (login desactivado)' : ' (sin conexión)');
    document.getElementById('fb-user-bar').style.display     = 'flex';

    // Badge offline en topbar (no aplica si el login está desactivado a propósito)
    const bar = document.getElementById('fb-user-bar');
    if (!LOGIN_DESACTIVADO_TEMPORAL && bar && !document.getElementById('offlineBadge')) {
        const badge = document.createElement('span');
        badge.id = 'offlineBadge';
        badge.textContent = '🔴 Sin conexión';
        badge.style.cssText = 'font-size:11px;font-weight:700;color:var(--negative);background:var(--negative-soft);border:1px solid var(--negative);border-radius:20px;padding:2px 9px;';
        bar.insertBefore(badge, bar.firstChild);
    }

    if (typeof aplicarPermisos               === 'function') aplicarPermisos();
    if (typeof aplicarNavegacionPorCategoria === 'function') aplicarNavegacionPorCategoria();
    if (typeof verificarCertificadoGuardado  === 'function') verificarCertificadoGuardado();
    if (typeof _fbRefrescarUI                === 'function') _fbRefrescarUI();
    if (typeof actualizarTopbarModulo        === 'function') actualizarTopbarModulo('inicio');

    if (!LOGIN_DESACTIVADO_TEMPORAL) mostrarToast('Modo sin conexión — trabajando con datos locales.', 'info');
}

// ── Inicialización ────────────────────────────────────────────
function fbInit() {
    if (LOGIN_DESACTIVADO_TEMPORAL) {
        // fbInit() se llama en un <script> inline que corre ANTES de que
        // menu.js/categorias/*.js (cargados más abajo en index.html) existan —
        // aplicarNavegacionPorCategoria() los necesita. Diferir a DOMContentLoaded
        // para que todo el resto de scripts ya esté cargado.
        document.addEventListener('DOMContentLoaded', _fbEntrarModoOffline);
        return;
    }
    try {
        if (!firebase.apps.length) firebase.initializeApp(FB_CONFIG);
        _fbAuth = firebase.auth();
        _fbDb   = firebase.firestore();
        window._fbDb = _fbDb;

        // Persistencia offline con IndexedDB — los datos sobreviven recargas sin conexión.
        // synchronizeTabs permite múltiples pestañas del mismo usuario.
        _fbDb.enablePersistence({ synchronizeTabs: true }).catch(err => {
            if (err.code !== 'failed-precondition' && err.code !== 'unimplemented') {
                console.warn('Firestore persistence error:', err.code);
            }
        });

        // Sync inmediato al cerrar o cambiar pestaña — evita perder el último cambio
        window.addEventListener('beforeunload', () => {
            if (_fbUser && window.currentUser?.empresaId) _fbAutoSync();
        });
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden' && _fbUser && window.currentUser?.empresaId) {
                _fbAutoSync();
            }
        });

        // Timeout: si Firebase no responde en FB_OFFLINE_TIMEOUT ms,
        // comprobar si hay datos locales y entrar en modo offline
        const offlineTimer = setTimeout(() => {
            if (!_fbUser && !_modoOffline) {
                const tieneDatos = localStorage.getItem('core_asientos') ||
                                   localStorage.getItem('core_config');
                if (tieneDatos) {
                    _fbEntrarModoOffline();
                }
                // Sin datos locales: mantener pantalla de login con aviso
                else {
                    const errEl = document.getElementById('loginError');
                    if (errEl) errEl.textContent = '⚠️ Sin conexión — inicia sesión cuando tengas internet.';
                }
            }
        }, FB_OFFLINE_TIMEOUT);

        _fbAuth.onAuthStateChanged(user => {
            clearTimeout(offlineTimer); // Firebase respondió → cancelar timeout
            _fbOnAuthChange(user);
        });

        _fbInterceptLocalStorage();
        return true;
    } catch(e) {
        console.error('Firebase init error:', e);
        _fbEntrarModoOffline();
        return false;
    }
}

// ── Interceptar localStorage para auto-sync ──────────────────
function _fbInterceptLocalStorage() {
    const _orig = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function(key, value) {
        _orig(key, value);
        if (FB_KEYS.includes(key) && _fbUser) {
            clearTimeout(_syncTimer);
            _syncTimer = setTimeout(_fbAutoSync, 2500);
        }
    };
}

async function _fbAutoSync() {
    if (_syncBusy || !_fbUser) return;
    _syncBusy = true;
    const empresaId = window.currentUser?.empresaId || _fbUser.uid;
    try {
        const modulosRef = _fbDb.collection('empresas').doc(empresaId).collection('modulos');
        const writes = FB_KEYS
            .map(k => ({ k, v: localStorage.getItem(k) }))
            .filter(({ v }) => v !== null)
            .map(({ k, v }) => modulosRef.doc(FB_KEY_TO_DOC[k]).set({ data: v }));
        await Promise.all(writes);
        _fbSetSyncIcon('✅');
    } catch(e) {
        console.warn('Auto-sync error:', e.message);
        _fbSetSyncIcon('⚠️');
    } finally {
        _syncBusy = false;
    }
}

function _fbSetSyncIcon(icon) {
    const el = document.getElementById('fbSyncIcon');
    if (!el) return;
    el.textContent = icon;
    setTimeout(() => { el.textContent = '☁'; }, 3000);
}

// ── Auth state ────────────────────────────────────────────────
async function _fbOnAuthChange(user) {
    _fbUser = user;
    if (user) {
        // Si estábamos en modo offline, volver al modo online
        if (_modoOffline) {
            _modoOffline = false;
            const badge = document.getElementById('offlineBadge');
            if (badge) badge.remove();
            mostrarToast('Conexión restaurada — sincronizando…', 'ok');
        }

        // Rescatar la empresa que estaba seleccionada antes de la recarga,
        // verificando que pertenezca a este mismo usuario.
        let empresaIdGuardado = null;
        try {
            const perfLocal = JSON.parse(localStorage.getItem('_fb_perfil_local') || 'null');
            if (perfLocal?.empresaId && perfLocal.uid === user.uid) {
                empresaIdGuardado = perfLocal.empresaId;
            }
        } catch { /* ignorar JSON inválido */ }

        // Entrada directa por código (sesión anónima): no carga perfil propio,
        // arma currentUser con los clientes del titular y entra al selector.
        if (user.isAnonymous && window._audCodeEntry) {
            const codigo = window._audCodeEntry;
            window._audCodeEntry = null;
            const res = (typeof _audEntrarConCodigo === 'function')
                ? await _audEntrarConCodigo(codigo, user)
                : { ok: false, error: 'No disponible.' };
            if (!res.ok) {
                const errEl = document.getElementById('loginCodigoError');
                if (errEl) errEl.textContent = res.error;
                _fbSetLoading(false);
                await _fbAuth.signOut();
                return;
            }
            await _fbShowEmpresaSelector();
            fbLoadFromCloud().then(() => { _fbRefrescarUI(); });
            return;
        }

        await _fbCargarPerfil(user);

        // Si el usuario ya tenía una empresa seleccionada y sigue siendo suya, entrar directo.
        // seleccionarEmpresa() ya llama a fbLoadFromCloud() y _fbRefrescarUI().
        if (empresaIdGuardado && (window.currentUser.empresas || []).includes(empresaIdGuardado)) {
            await seleccionarEmpresa(empresaIdGuardado);
        } else {
            // Primera vez o empresa ya no disponible → mostrar selector.
            await _fbShowEmpresaSelector();
            fbLoadFromCloud().then(() => { _fbRefrescarUI(); });
        }
    } else {
        // Solo ir a login si NO estamos en modo offline
        if (!_modoOffline) {
            window.currentUser = null;
            _fbShowLogin();
        }
    }
}

async function _fbCargarPerfil(user) {
    try {
        const snap = await _fbDb.collection('perfiles').doc(user.uid).get();
        if (snap.exists) {
            const data = snap.data();

            // ── Migración: formato antiguo tenía empresaId único ──
            if (data.empresaId && !data.empresas) {
                data.empresas = [data.empresaId];
                await _fbDb.collection('perfiles').doc(user.uid)
                    .update({ empresas: data.empresas });
            }

            window.currentUser = { uid: user.uid, email: user.email, ...data };

            // ── Modelo Auditor: invitado vinculado al perfil del titular ──
            // El invitado no tiene clientes propios; ve los del titular que pagó.
            if (data.vinculadoA) {
                try {
                    const tSnap = await _fbDb.collection('perfiles').doc(data.vinculadoA).get();
                    if (tSnap.exists) {
                        const t = tSnap.data();
                        window.currentUser.empresas    = t.empresas || [];
                        window.currentUser.esInvitado  = true;
                        window.currentUser.canInvite   = false;
                        window.currentUser.titularUid  = data.vinculadoA;
                        window.currentUser.titularEmail = t.email || '';
                    }
                } catch(e) { console.warn('No se pudo cargar el perfil del titular:', e.message); }
            } else {
                window.currentUser.esTitular = true;
                window.currentUser.canInvite = (data.canInvite !== false);
            }
        } else {
            // Usuario sin perfil → crear perfil mínimo
            window.currentUser = {
                uid: user.uid, email: user.email,
                empresas: [], rol: 'admin', categoria: 'primera',
            };
            await _fbDb.collection('perfiles').doc(user.uid).set({
                email:    user.email,
                empresas: [],
                creadoEn: firebase.firestore.FieldValue.serverTimestamp(),
            });
        }
    } catch(e) {
        console.warn('Error cargando perfil:', e.message);
        window.currentUser = {
            uid: user.uid, email: user.email,
            empresas: [], rol: 'admin', categoria: 'primera',
        };
    }
    localStorage.setItem('_fb_perfil_local', JSON.stringify(window.currentUser));
}

function _fbRefrescarUI() {
    if (typeof calcularKPIs          === 'function') calcularKPIs();
    if (typeof renderIndicadores     === 'function') renderIndicadores();
    if (typeof renderHistorialDiario === 'function') renderHistorialDiario();
    if (typeof renderCompras         === 'function') renderCompras();
    if (typeof renderVentas          === 'function') renderVentas();
    if (typeof cargarConfiguracion   === 'function') cargarConfiguracion();
}

function _fbShowApp(user) {
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('wizardOverlay').style.display = 'none';
    document.body.classList.remove('empresa-mode');
    document.getElementById('fb-user-email').textContent = user?.email || window.currentUser?.email || '';
    document.getElementById('fb-user-bar').style.display = 'flex';
    // Si la vista activa es empresa, navegar a inicio
    const empView = document.getElementById('view-empresa');
    if (empView?.classList.contains('active')) {
        empView.classList.remove('active');
        document.getElementById('view-inicio')?.classList.add('active');
    }
    // El login normal aterriza en Inicio (vista activa por HTML por defecto),
    // pero navegar() nunca se dispara — el título quedaba con el texto estático.
    if (document.getElementById('view-inicio')?.classList.contains('active')) {
        const t = document.getElementById('txt-modulo-titulo');
        const d = document.getElementById('txt-modulo-desc');
        if (t) t.innerText = 'Panel de Inicio';
        if (d) d.innerText = 'Resumen financiero consolidado en tiempo real';
    }
    if (typeof verificarCertificadoGuardado === 'function') verificarCertificadoGuardado();
    if (typeof aplicarPermisos               === 'function') aplicarPermisos();
    if (typeof aplicarNavegacionPorCategoria === 'function') aplicarNavegacionPorCategoria();
    // navegar() no se dispara en el aterrizaje normal de login (ver comentario arriba),
    // así que el header Home/topbar no se actualizaría solo — se fuerza aquí.
    if (typeof actualizarTopbarModulo === 'function') actualizarTopbarModulo('inicio');
}

function _fbShowLogin() {
    document.getElementById('login-overlay').style.display = 'flex';
    document.getElementById('fb-user-bar').style.display   = 'none';
    document.body.classList.remove('empresa-mode');
    document.getElementById('loginError').textContent = '';
}

// ── Selector de empresa ───────────────────────────────────────

async function _fbShowEmpresaSelector() {
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('wizardOverlay').style.display = 'none';
    document.getElementById('fb-user-bar').style.display  = 'flex';
    document.getElementById('fb-user-email').textContent  = window.currentUser?.email || '';

    // Activar vista empresa dentro del layout normal
    document.querySelectorAll('.view.active').forEach(v => v.classList.remove('active'));
    document.getElementById('view-empresa')?.classList.add('active');
    document.body.classList.add('empresa-mode');

    const emailEl = document.getElementById('empUserEmail');
    if (emailEl) emailEl.textContent = window.currentUser?.email || '';

    await _fbCargarListaEmpresas();
}

async function _fbCargarListaEmpresas() {
    const lista    = document.getElementById('empLista');
    const empresas = window.currentUser?.empresas || [];

    if (!empresas.length) {
        lista.innerHTML = `
            <div class="emp-empty">
                <div class="emp-empty-icon">🏢</div>
                <div>Aún no tienes clientes registrados.</div>
                <div style="font-size:12px;margin-top:6px;color:var(--text-muted);">
                    Crea un cliente nuevo o únete con un código de invitación.
                </div>
            </div>`;
        return;
    }

    lista.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:8px 0;">Cargando…</div>';

    try {
        const cards = await Promise.all(empresas.map(async id => {
            try {
                const empDoc = await _fbDb.collection('empresas').doc(id).get();
                if (!empDoc.exists) return null;
                return { id, ...empDoc.data() };
            } catch { return null; }
        }));

        const validas = cards.filter(Boolean);
        if (!validas.length) {
            lista.innerHTML = '<div class="emp-empty"><div class="emp-empty-icon">⚠️</div><div>No se pudieron cargar los clientes.</div></div>';
            return;
        }

        // Ordenar: esPropio primero, luego el resto por nombre
        validas.sort((a, b) => {
            if (a.esPropio && !b.esPropio) return -1;
            if (!a.esPropio && b.esPropio) return 1;
            return (a.empresa || '').localeCompare(b.empresa || '', 'es');
        });

        // Panel estudio enriquecido (F2.1/F2.2/F2.3)
        if (typeof panelEstudioInicializar === 'function') {
            panelEstudioInicializar(validas);
        } else if (typeof audRenderizarTarjeta === 'function') {
            lista.style.display = '';
            lista.innerHTML = validas.map(e => audRenderizarTarjeta(e)).join('');
        } else {
            lista.style.display = '';
            lista.innerHTML = validas.map(e => {
                const catLabel = e.categoria === 'segunda' ? '2ª Categoría' : '1ª Categoría';
                return `
                <div class="emp-item" onclick="seleccionarEmpresa('${e.id}')">
                    <div class="emp-item-top">
                        <div class="emp-item-nombre">${e.empresa || '(Sin nombre)'}</div>
                    </div>
                    <div class="emp-item-meta">
                        <span>🪪 ${e.rut || '—'}</span>
                        <span>📂 ${catLabel}</span>
                        ${e.giro ? `<span>📋 ${e.giro}</span>` : ''}
                    </div>
                </div>`;
            }).join('');
        }

    } catch(e) {
        lista.innerHTML = `<div class="emp-empty" style="color:var(--negative);">Error cargando clientes: ${e.message}</div>`;
    }
}

async function seleccionarEmpresa(empresaId) {
    const lista = document.getElementById('empLista');
    if (lista) lista.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:8px 0;">Cargando datos…</div>';

    try {
        // Cargar rol del usuario en esta empresa
        const [empDoc, usrDoc] = await Promise.all([
            _fbDb.collection('empresas').doc(empresaId).get(),
            _fbDb.collection('empresas').doc(empresaId)
                 .collection('usuarios').doc(window.currentUser.uid).get(),
        ]);

        if (empDoc.exists) {
            const d = empDoc.data();
            window.currentUser.empresaNombre  = d.empresa;
            window.currentUser.categoria      = d.categoria || 'primera';
            window.currentUser.empresaColor   = d.color   || null;
            window.currentUser.empresaEsPropio = d.esPropio || false;

            // Persistir config local de empresa
            const cfg = JSON.parse(localStorage.getItem('core_config') || '{}');
            cfg.empresa   = d.empresa;
            cfg.rut       = d.rut       || '';
            cfg.giro      = d.giro      || '';
            cfg.direccion = d.direccion || '';
            localStorage.setItem('core_config', JSON.stringify(cfg));

            // Aplicar módulos activos al sidebar.
            // Verificar que las claves pertenezcan a la categoría actual; si no coinciden
            // (objeto de otra categoría o vacío), usar null → defaults.
            const categoriaEmpresa = d.categoria || 'primera';
            let modulosActivos = d.modulosActivos || null;

            // Fallback: si Firestore no tiene modulosActivos, intentar desde localStorage
            if (!modulosActivos) {
                try {
                    const loc = JSON.parse(localStorage.getItem('_modulosActivos') || 'null');
                    if (loc?.modulos && loc.categoria === (d.categoria || 'primera')) {
                        modulosActivos = loc.modulos;
                    }
                } catch {}
            }

            if (modulosActivos && typeof modulosActivos === 'object') {
                // Migrar claves antiguas de segunda categoría (antes del renombre)
                if (categoriaEmpresa === 'segunda') {
                    if ('clientes'    in modulosActivos && !('clientes-hon'    in modulosActivos))
                        modulosActivos['clientes-hon']    = modulosActivos['clientes'];
                    if ('indicadores' in modulosActivos && !('indicadores-hon' in modulosActivos))
                        modulosActivos['indicadores-hon'] = modulosActivos['indicadores'];
                }
                // Verificar que al menos una clave corresponda al catálogo actual
                if (typeof AUD_MODULOS !== 'undefined') {
                    const catalogoIds = (AUD_MODULOS[categoriaEmpresa] || AUD_MODULOS.primera)
                        .map(m => m.id);
                    if (!catalogoIds.some(id => id in modulosActivos)) modulosActivos = null;
                }
            }
            window.currentUser.modulosActivos = modulosActivos;
            if (typeof audAplicarModulos === 'function') {
                audAplicarModulos(modulosActivos, categoriaEmpresa);
            }

            // Actualizar indicador de cliente en el topbar
            if (typeof audActualizarIndicadorCliente === 'function') {
                audActualizarIndicadorCliente(d.empresa, d.color, d.esPropio);
            }
        }

        if (usrDoc.exists) {
            // Solo leer el rol del user sub-doc. La categoría es del cliente (empresa),
            // no del usuario — ya fue asignada desde el empDoc arriba y no debe sobreescribirse.
            window.currentUser.rol = usrDoc.data().rol || 'asistente';
        } else {
            // El doc de usuario no existe en esta empresa → crearlo con el rol del perfil
            const rolPerfil = window.currentUser.rol || 'admin';
            await _fbDb.collection('empresas').doc(empresaId)
                .collection('usuarios').doc(window.currentUser.uid).set({
                    email:    window.currentUser.email,
                    rol:      rolPerfil,
                    creadoEn: firebase.firestore.FieldValue.serverTimestamp(),
                });
            window.currentUser.rol = rolPerfil;
        }

        window.currentUser.empresaId = empresaId;
        localStorage.setItem('_fb_perfil_local', JSON.stringify(window.currentUser));
        _empresasRecientesRegistrar(empresaId);
        _homeClientSwitchCargado = false; // la lista quedó desactualizada (cambió el activo/MRU)

        // Cargar datos de esta empresa desde Firestore
        await fbLoadFromCloud();

        // Mostrar la app
        _fbShowApp(_fbUser);
        _fbRefrescarUI();

        mostrarToast(`Cliente: ${window.currentUser.empresaNombre || empresaId}`, 'ok');

    } catch(e) {
        mostrarToast('Error al seleccionar empresa: ' + e.message, 'error');
        await _fbCargarListaEmpresas();
    }
}

async function cambiarEmpresa() {
    // Guardar datos actuales antes de salir
    if (_fbUser && _fbDb) await _fbAutoSync();
    // Limpiar datos locales de la empresa anterior
    FB_KEYS.forEach(k => localStorage.removeItem(k));
    _fbRecargarMemoria();
    // Volver al selector
    await _fbShowEmpresaSelector();
}

// ── Chip "cambiar de cliente" en Inicio — clientes recientes (MRU real) ──────
const EMPRESAS_RECIENTES_KEY = 'contapp-empresas-recientes';
const EMPRESAS_RECIENTES_MAX = 5;

function _empresasRecientesRegistrar(empresaId) {
    if (!empresaId) return;
    let ids = [];
    try { ids = JSON.parse(localStorage.getItem(EMPRESAS_RECIENTES_KEY)) || []; } catch {}
    ids = [empresaId, ...ids.filter(id => id !== empresaId)].slice(0, EMPRESAS_RECIENTES_MAX);
    localStorage.setItem(EMPRESAS_RECIENTES_KEY, JSON.stringify(ids));
}

let _homeClientSwitchCargado = false;

// Puebla #homeClientList con los clientes recientes reales del usuario (orden
// de uso más reciente primero). Se llama al abrir el dropdown la primera vez
// (toggleHomeClientSwitch en menu.js) para no gastar lecturas de Firestore
// de más en cada carga de Inicio.
async function _fbRenderHomeClientSwitch() {
    const listEl = document.getElementById('homeClientList');
    if (!listEl || _homeClientSwitchCargado) return;

    const todas = window.currentUser?.empresas || [];
    if (!todas.length || !_fbDb) {
        listEl.innerHTML = '<div class="hcs-empty">Sin otros clientes disponibles sin conexión.</div>';
        return;
    }

    let recientes = [];
    try { recientes = JSON.parse(localStorage.getItem(EMPRESAS_RECIENTES_KEY)) || []; } catch {}
    // Orden: recientes primero (los que existan en `todas`), luego el resto de `todas`.
    const ordenIds = [...recientes.filter(id => todas.includes(id)), ...todas.filter(id => !recientes.includes(id))]
        .slice(0, EMPRESAS_RECIENTES_MAX);

    listEl.innerHTML = '<div class="hcs-empty">Cargando…</div>';
    try {
        const docs = await Promise.all(ordenIds.map(id => _fbDb.collection('empresas').doc(id).get().catch(() => null)));
        const activoId = window.currentUser?.empresaId;
        const items = ordenIds.map((id, i) => {
            const doc = docs[i];
            if (!doc || !doc.exists) return null;
            const d = doc.data();
            return { id, nombre: d.empresa || '(Sin nombre)', rut: d.rut || '—' };
        }).filter(Boolean);

        if (!items.length) {
            listEl.innerHTML = '<div class="hcs-empty">Sin clientes recientes todavía.</div>';
            return;
        }
        listEl.innerHTML = items.map(it => `
            <button class="hcs-item ${it.id === activoId ? 'active' : ''}" onclick="event.stopPropagation();document.getElementById('homeClientPanel').classList.remove('open');seleccionarEmpresa('${it.id}')">
                <span class="hcs-ic">🏢</span>
                <span class="hcs-item-meta">${it.nombre}<span class="hcs-item-rut">${it.rut}</span></span>
            </button>`).join('');
        _homeClientSwitchCargado = true;
    } catch (e) {
        listEl.innerHTML = '<div class="hcs-empty">No se pudo cargar la lista.</div>';
    }
}
window._fbRenderHomeClientSwitch = _fbRenderHomeClientSwitch;

// ── Editar empresa activa ─────────────────────────────────────
function abrirEditarEmpresa() {
    const cfg = JSON.parse(localStorage.getItem('core_config') || '{}');
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
    set('editEmpNombre',   cfg.empresa  || '');
    set('editEmpRut',      cfg.rut      || '');
    set('editEmpGiro',     cfg.giro     || '');
    set('editEmpDireccion',cfg.direccion|| '');
    const modal = document.getElementById('modalEditarEmpresa');
    if (modal) modal.style.display = 'flex';
}

function cerrarEditarEmpresa() {
    const modal = document.getElementById('modalEditarEmpresa');
    if (modal) modal.style.display = 'none';
}

async function guardarEdicionEmpresa() {
    const nombre    = document.getElementById('editEmpNombre')?.value.trim()    || '';
    const rut       = document.getElementById('editEmpRut')?.value.trim()       || '';
    const giro      = document.getElementById('editEmpGiro')?.value.trim()      || '';
    const direccion = document.getElementById('editEmpDireccion')?.value.trim() || '';

    if (!nombre) { mostrarToast('El nombre de la empresa es obligatorio.', 'error'); return; }

    // Actualizar localStorage
    const cfg = JSON.parse(localStorage.getItem('core_config') || '{}');
    cfg.empresa   = nombre;
    cfg.rut       = rut;
    cfg.giro      = giro;
    cfg.direccion = direccion;
    localStorage.setItem('core_config', JSON.stringify(cfg));

    // Actualizar UI inmediatamente
    if (typeof aplicarConfiguracion === 'function') aplicarConfiguracion(cfg);

    // Persistir en Firestore si hay conexión
    const empresaId = window.currentUser?.empresaId;
    if (_fbDb && empresaId) {
        try {
            await _fbDb.collection('empresas').doc(empresaId).update({ empresa: nombre, rut, giro, direccion });
        } catch(e) {
            console.warn('No se pudo sincronizar con Firestore:', e.message);
        }
    }

    // Actualizar nombre en currentUser
    if (window.currentUser) {
        window.currentUser.empresaNombre = nombre;
        localStorage.setItem('_fb_perfil_local', JSON.stringify(window.currentUser));
    }

    cerrarEditarEmpresa();
    mostrarToast('Empresa actualizada.', 'ok');
}

// ── Eliminar empresa activa ───────────────────────────────────
async function eliminarEmpresaActual() {
    const nombre    = window.currentUser?.empresaNombre || 'esta empresa';
    const empresaId = window.currentUser?.empresaId;

    if (!empresaId) { mostrarToast('No hay empresa activa.', 'error'); return; }

    mostrarConfirm(`¿Eliminar "${nombre}"?\n\nEsta acción eliminará todos los datos de la empresa y no se puede deshacer.`, () => {
    mostrarConfirm(`Confirma nuevamente: ¿eliminar permanentemente "${nombre}"?`, async () => {
    try {
        if (_fbDb && _fbUser) {
            // Quitar empresaId del array del perfil
            const perfRef  = _fbDb.collection('perfiles').doc(_fbUser.uid);
            const empresas = (window.currentUser?.empresas || []).filter(id => id !== empresaId);
            await perfRef.update({ empresas });

            // Eliminar doc de la empresa (los datos de Firestore)
            await _fbDb.collection('empresas').doc(empresaId).delete();
        }

        // Limpiar estado local
        FB_KEYS.forEach(k => localStorage.removeItem(k));
        localStorage.removeItem('core_config');
        if (window.currentUser) {
            window.currentUser.empresaId     = null;
            window.currentUser.empresaNombre = null;
            window.currentUser.empresas      = (window.currentUser.empresas || []).filter(id => id !== empresaId);
            localStorage.setItem('_fb_perfil_local', JSON.stringify(window.currentUser));
        }
        _fbRecargarMemoria();

        mostrarToast('Empresa eliminada.', 'ok');
        // Volver al selector
        await _fbShowEmpresaSelector();

    } catch(e) {
        mostrarToast('Error al eliminar: ' + e.message, 'error');
    }
    });
    });
}

// ── Login / Register / Logout ─────────────────────────────────
// Alternar entre los modos del login: 'sesion' | 'codigo'
function loginModo(modo) {
    const esCodigo = modo === 'codigo';
    document.getElementById('loginFormSesion').style.display = esCodigo ? 'none' : 'flex';
    document.getElementById('loginFormCodigo').style.display = esCodigo ? 'flex' : 'none';
    document.getElementById('loginTabSesion').classList.toggle('login-tab-active', !esCodigo);
    document.getElementById('loginTabCodigo').classList.toggle('login-tab-active',  esCodigo);
    const err = document.getElementById(esCodigo ? 'loginCodigoError' : 'loginError');
    if (err) err.textContent = '';
}

async function fbLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const pass  = document.getElementById('loginPass').value;
    const errEl = document.getElementById('loginError');
    errEl.textContent = '';
    if (!email || !pass) { errEl.textContent = 'Ingrese correo y contraseña.'; return; }
    _fbSetLoading(true, 'Ingresando…');
    try {
        await _fbAuth.signInWithEmailAndPassword(email, pass);
    } catch(e) {
        errEl.textContent = _fbErrMsg(e.code);
        _fbSetLoading(false);
    }
}

// Entrada directa con código: sesión anónima vinculada al perfil del titular.
// Requiere tener habilitado el proveedor "Anónimo" en Firebase Auth.
async function fbIngresarConCodigo() {
    const codigo = (document.getElementById('loginCodigo')?.value || '').trim().toUpperCase();
    const errEl  = document.getElementById('loginCodigoError');
    errEl.textContent = '';
    if (codigo.length !== 6) { errEl.textContent = 'El código debe tener 6 caracteres.'; return; }

    window._audCodeEntry = codigo;        // lo procesa el handler de auth
    _fbSetLoading(true, 'Ingresando con código…');
    try {
        await _fbAuth.signInAnonymously();
    } catch(e) {
        window._audCodeEntry = null;
        errEl.textContent = (e.code === 'auth/operation-not-allowed')
            ? 'El acceso por código no está habilitado. Contacta al administrador.'
            : ('Error: ' + e.message);
        _fbSetLoading(false);
    }
}

async function fbRegister() {
    const email   = document.getElementById('loginEmail').value.trim();
    const pass    = document.getElementById('loginPass').value;
    const empresa = document.getElementById('loginEmpresa')?.value?.trim() || '';
    const errEl   = document.getElementById('loginError');
    errEl.textContent = '';
    if (!email || !pass)  { errEl.textContent = 'Ingrese correo y contraseña.'; return; }
    if (pass.length < 6)  { errEl.textContent = 'La contraseña debe tener al menos 6 caracteres.'; return; }
    _fbSetLoading(true, 'Creando cuenta…');
    try {
        await _fbAuth.createUserWithEmailAndPassword(email, pass);
        // Si se indicó empresa, guardarla en config
        if (empresa) {
            const cfg = JSON.parse(localStorage.getItem('core_config') || '{}');
            cfg.empresa = empresa;
            localStorage.setItem('core_config', JSON.stringify(cfg));
        }
    } catch(e) {
        errEl.textContent = _fbErrMsg(e.code);
        _fbSetLoading(false);
    }
}

async function fbLogout() {
    mostrarConfirm('¿Cerrar sesión?', async () => {
        // Sync final antes de salir
        await fbSyncToCloud();
        await _fbAuth.signOut();
        // Limpiar datos locales de la sesión
        FB_KEYS.forEach(k => localStorage.removeItem(k));
        location.reload();
    });
}

// ── Sync manual ───────────────────────────────────────────────
async function fbSyncToCloud() {
    if (!_fbUser || !_fbDb) { mostrarToast('Sin sesión activa.', 'error'); return; }
    await _fbAutoSync();
    mostrarToast('✅ Sincronizado con la nube.', 'ok');
}

async function fbLoadFromCloud() {
    if (!_fbUser || !_fbDb) return;
    const empresaId = window.currentUser?.empresaId || _fbUser.uid;
    const _orig = Object.getPrototypeOf(localStorage).setItem;
    try {
        const modulosRef = _fbDb.collection('empresas').doc(empresaId).collection('modulos');

        // Leer todos los documentos de la subcollección en paralelo
        const snaps = await Promise.all(
            FB_KEYS.map(k => modulosRef.doc(FB_KEY_TO_DOC[k]).get())
        );

        let cargadoDesdeSubcoleccion = false;
        snaps.forEach((snap, i) => {
            if (snap.exists && snap.data().data) {
                _orig.call(localStorage, FB_KEYS[i], snap.data().data);
                cargadoDesdeSubcoleccion = true;
            }
        });

        // Migración: si no había datos en subcollección, buscar en el doc raíz (estructura antigua)
        if (!cargadoDesdeSubcoleccion) {
            const rootDoc = await _fbDb.collection('empresas').doc(empresaId).get();
            if (rootDoc.exists) {
                const rootData = rootDoc.data();
                const hayDatosViejos = FB_KEYS.some(k => rootData[k]);
                if (hayDatosViejos) {
                    FB_KEYS.forEach(k => {
                        if (rootData[k]) _orig.call(localStorage, k, rootData[k]);
                    });
                    // Migrar al nuevo formato y limpiar campos del doc raíz
                    _fbAutoSync().then(() => {
                        const removeOldFields = {};
                        FB_KEYS.forEach(k => { removeOldFields[k] = firebase.firestore.FieldValue.delete(); });
                        _fbDb.collection('empresas').doc(empresaId).update(removeOldFields).catch(() => {});
                    });
                }
            }
        }

        _fbRecargarMemoria();
    } catch(e) {
        console.error('Error cargando desde la nube:', e);
    }
}

function _fbRecargarMemoria() {
    try {
        if (typeof dbAsientos !== 'undefined') {
            const a = JSON.parse(localStorage.getItem('core_asientos') || '[]');
            dbAsientos.length = 0; a.forEach(x => dbAsientos.push(x));
        }
        if (window.dbCompras) {
            const c = JSON.parse(localStorage.getItem('core_compras') || '[]');
            window.dbCompras.length = 0; c.forEach(x => window.dbCompras.push(x));
        }
        if (window.dbVentas) {
            const v = JSON.parse(localStorage.getItem('core_ventas') || '[]');
            window.dbVentas.length = 0; v.forEach(x => window.dbVentas.push(x));
        }
        if (window.dbContactos) {
            const ct = JSON.parse(localStorage.getItem('core_contactos') || '[]');
            window.dbContactos.length = 0; ct.forEach(x => window.dbContactos.push(x));
        }
    } catch(e) {
        console.warn('Error recargando memoria:', e);
    }
}

// ── Cambiar cuenta (logout sin limpiar datos locales de empresa) ──
async function fbCambiarCuenta() {
    mostrarConfirm('¿Cambiar de cuenta? Se cerrará la sesión actual. Los datos locales se conservan.', async () => {
        await _fbAuth.signOut();
        location.reload();
    });
}

// ── Toggle registro/login ────────────────────────────────────
function fbToggleForm() {
    const reg = document.getElementById('loginRegRow');
    const btn = document.getElementById('btnLoginSubmit');
    const lnk = document.getElementById('loginToggleLink');
    const esRegistro = reg.style.display === 'none' || reg.style.display === '';
    if (esRegistro) {
        reg.style.display = 'block';
        btn.textContent = 'Crear cuenta';
        btn.onclick = fbRegister;
        lnk.textContent = '¿Ya tienes cuenta? Inicia sesión';
    } else {
        reg.style.display = 'none';
        btn.textContent = 'Iniciar Sesión';
        btn.onclick = fbLogin;
        lnk.textContent = '¿No tienes cuenta? Regístrate';
    }
}

// ── Helpers ───────────────────────────────────────────────────
function _fbSetLoading(on, texto) {
    const btn = document.getElementById('btnLoginSubmit');
    if (!btn) return;
    btn.disabled    = on;
    btn.textContent = on ? (texto || 'Conectando…') : 'Iniciar Sesión';
}

function _fbErrMsg(code) {
    const msgs = {
        'auth/user-not-found':         'Correo no registrado.',
        'auth/wrong-password':         'Contraseña incorrecta.',
        'auth/invalid-email':          'Correo inválido.',
        'auth/email-already-in-use':   'Este correo ya está registrado.',
        'auth/weak-password':          'Contraseña muy débil (mín. 6 caracteres).',
        'auth/network-request-failed': 'Sin conexión a internet.',
        'auth/invalid-credential':     'Correo o contraseña incorrectos.',
        'auth/too-many-requests':      'Demasiados intentos. Espere un momento.',
    };
    return msgs[code] || 'Error: ' + code;
}

window.seleccionarEmpresa    = seleccionarEmpresa;
window.cambiarEmpresa        = cambiarEmpresa;
window.abrirEditarEmpresa    = abrirEditarEmpresa;
window.cerrarEditarEmpresa   = cerrarEditarEmpresa;
window.guardarEdicionEmpresa = guardarEdicionEmpresa;
window.eliminarEmpresaActual = eliminarEmpresaActual;

window.fbLogin          = fbLogin;
window.fbRegister       = fbRegister;
window.fbLogout         = fbLogout;
window.fbSyncToCloud    = fbSyncToCloud;
window.fbCambiarCuenta  = fbCambiarCuenta;
