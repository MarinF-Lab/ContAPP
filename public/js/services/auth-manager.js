// ─────────────────────────────────────────────────────────────
//  AUTH MANAGER
//  Wizard: solo email + contraseña (2 pasos).
//  Empresa: crear / unirse con código desde el selector de empresa.
// ─────────────────────────────────────────────────────────────

let _wizData = {};
let _wizPaso = 1;

// ── Wizard de registro ────────────────────────────────────────

function wizardAbrir() {
    _wizData = {};
    _wizPaso = 1;
    document.getElementById('login-overlay').style.display  = 'none';
    document.getElementById('wizardOverlay').style.display  = 'flex';
    _wizMostrarPaso(1);
}

function wizardCerrar() {
    document.getElementById('wizardOverlay').style.display = 'none';
    document.getElementById('login-overlay').style.display  = 'flex';
}

function _wizMostrarPaso(paso) {
    document.querySelectorAll('#wizardOverlay .wiz-step').forEach(el => el.style.display = 'none');
    const el = document.getElementById(`wizStep${paso}`);
    if (el) el.style.display = 'block';

    document.querySelectorAll('#wizardOverlay .wiz-dot').forEach((d, i) => {
        d.classList.toggle('wiz-dot-active', i + 1 === paso);
        d.classList.toggle('wiz-dot-done',   i + 1 <  paso);
    });

    // Paso 2 = último → mostrar botón "Crear Cuenta"
    const btnSig = document.getElementById('wizBtnSig');
    const btnFin = document.getElementById('wizBtnFin');
    if (btnSig) btnSig.style.display = paso === 2 ? 'none' : '';
    if (btnFin) btnFin.style.display = paso === 2 ? ''     : 'none';

    const err = document.getElementById('wizError');
    if (err) err.textContent = '';
}

function wizardSiguiente() {
    const err = document.getElementById('wizError');
    if (err) err.textContent = '';

    if (_wizPaso === 1) {
        const oficina = document.getElementById('wizNombreOficina').value.trim();
        const email   = document.getElementById('wizEmail').value.trim();
        const pass    = document.getElementById('wizPass').value;
        const pass2   = document.getElementById('wizPass2').value;
        if (!oficina) { if (err) err.textContent = 'Ingresa el nombre de tu oficina o estudio contable.'; return; }
        if (!email || !pass) { if (err) err.textContent = 'Ingresa correo y contraseña.'; return; }
        if (pass.length < 6) { if (err) err.textContent = 'La contraseña debe tener al menos 6 caracteres.'; return; }
        if (pass !== pass2)  { if (err) err.textContent = 'Las contraseñas no coinciden.'; return; }
        _wizData.email         = email;
        _wizData.pass          = pass;
        _wizData.nombreOficina = oficina;
        _wizPaso = 2;
        // Mostrar resumen
        const cont = document.getElementById('wizResumenCont');
        if (cont) cont.innerHTML = `
            <div class="wiz-resumen-fila"><span>Oficina</span><strong>${oficina}</strong></div>
            <div class="wiz-resumen-fila"><span>Correo titular</span><strong>${email}</strong></div>`;
        _wizMostrarPaso(2);
    }
}

function wizardAtras() {
    if (_wizPaso <= 1) { wizardCerrar(); return; }
    _wizPaso--;
    _wizMostrarPaso(_wizPaso);
}

async function wizardFinalizar() {
    const err = document.getElementById('wizError');
    const btn = document.getElementById('wizBtnFin');
    if (btn) { btn.disabled = true; btn.textContent = 'Creando cuenta…'; }
    if (err) err.textContent = '';

    try {
        // 1. Crear cuenta en Firebase Auth
        const cred = await _fbAuth.createUserWithEmailAndPassword(_wizData.email, _wizData.pass);
        const uid  = cred.user.uid;

        // 2. Crear perfil del titular
        //    estado de pago: 'pendiente_pago' hasta que el webhook del gateway
        //    lo marque 'activo' (integración futura).
        await _fbDb.collection('perfiles').doc(uid).set({
            email:          _wizData.email,
            nombreOficina:  _wizData.nombreOficina || '',
            empresas:       [],
            plan:           'auditor',
            estado:         'pendiente_pago',
            canInvite:      true,
            codigosActivos: [],
            invitados:      [],
            creadoEn:       firebase.firestore.FieldValue.serverTimestamp(),
        });

        // onAuthStateChanged → _fbCargarPerfil → _fbShowEmpresaSelector
        document.getElementById('wizardOverlay').style.display = 'none';

    } catch(e) {
        if (err) err.textContent = _fbErrMsg ? _fbErrMsg(e.code) : e.message;
        if (btn) { btn.disabled = false; btn.textContent = 'Crear Cuenta'; }
    }
}

// ── Selector de empresa: abrir formularios inline ─────────────

function empAbrirCrear() {
    document.getElementById('empCrearForm').style.display  = 'block';
    document.getElementById('empCodigoForm').style.display = 'none';
    document.getElementById('empCrearError').textContent   = '';
    document.getElementById('empRut').value    = '';
    document.getElementById('empNombre').value = '';
    document.getElementById('empGiro').value   = '';

    // Reset campos extendidos
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    setVal('empDireccion', '');
    setVal('empTelefono',  '');
    setVal('empEmail',     '');
    setVal('empNotas',     '');

    // Categoría por defecto: primera
    const radPrimera = document.querySelector('input[name="empCategoria"][value="primera"]');
    if (radPrimera) radPrimera.checked = true;

    // Inicializar color picker y toggles de módulos
    if (typeof audRenderizarColorPicker   === 'function') audRenderizarColorPicker('empColorPicker', null);
    if (typeof audRenderizarToggleModulos === 'function') audRenderizarToggleModulos('empModulosContainer', 'primera', null);
}

function empAbrirCodigo() {
    document.getElementById('empCodigoForm').style.display = 'block';
    document.getElementById('empCrearForm').style.display  = 'none';
    document.getElementById('empCodigoError').textContent  = '';
    document.getElementById('empCodigo').value = '';
}

function empCerrarForms() {
    document.getElementById('empCrearForm').style.display  = 'none';
    document.getElementById('empCodigoForm').style.display = 'none';
}

// ── Crear nueva empresa ───────────────────────────────────────

async function empGuardarNueva() {
    const err       = document.getElementById('empCrearError');
    const btn       = document.querySelector('#empCrearForm .login-btn');
    const nombre    = document.getElementById('empNombre').value.trim();
    const rut       = document.getElementById('empRut').value.trim();
    const giro      = document.getElementById('empGiro').value.trim();
    const categoria = document.querySelector('input[name="empCategoria"]:checked')?.value || 'primera';
    const direccion = document.getElementById('empDireccion')?.value.trim() || '';
    const telefono  = document.getElementById('empTelefono')?.value.trim()  || '';
    const email     = document.getElementById('empEmail')?.value.trim()     || '';
    const notas     = document.getElementById('empNotas')?.value.trim()     || '';
    const color     = window._empColorSeleccionado || '#3b82f6';
    const modulosActivos = (typeof audLeerModulosFormulario === 'function')
        ? audLeerModulosFormulario(categoria)
        : null;

    err.textContent = '';

    // Los invitados comparten los clientes del titular; no pueden crear nuevos.
    if (window.currentUser?.esInvitado) {
        err.textContent = 'Tu cuenta es de invitado. Solo el titular puede agregar clientes nuevos.';
        return;
    }

    if (!nombre)  { err.textContent = 'Ingresa el nombre de la empresa.'; return; }
    if (!rut)     { err.textContent = 'Ingresa el RUT de la empresa.';    return; }
    if (typeof validarRutChileno === 'function' && !validarRutChileno(rut)) {
        err.textContent = 'RUT inválido. Verifica el dígito verificador.';
        return;
    }

    if (btn) { btn.disabled = true; btn.textContent = 'Creando…'; }

    try {
        const user      = window.currentUser;
        const uid       = user.uid;
        const empresaId = `${uid}_${Date.now()}`; // id único por empresa

        // Crear documento empresa con todos los campos extendidos
        await _fbDb.collection('empresas').doc(empresaId).set({
            empresa:       nombre,
            rut,
            giro:          giro || '',
            categoria,
            direccion,
            telefono,
            email,
            notas,
            color,
            modulosActivos: modulosActivos || {},
            esPropio:      false,
            estado:        'activo',
            creadoEn:      firebase.firestore.FieldValue.serverTimestamp(),
        });

        // Registrar al usuario como admin de esta empresa
        await _fbDb.collection('empresas').doc(empresaId)
            .collection('usuarios').doc(uid).set({
                email:    user.email,
                rol:      'admin',
                categoria,
                creadoEn: firebase.firestore.FieldValue.serverTimestamp(),
            });

        // Agregar empresaId al array del perfil
        const nuevasEmpresas = [...(user.empresas || []), empresaId];
        await _fbDb.collection('perfiles').doc(uid).update({ empresas: nuevasEmpresas });
        window.currentUser.empresas = nuevasEmpresas;
        localStorage.setItem('_fb_perfil_local', JSON.stringify(window.currentUser));

        if (typeof audit === 'function') audit('crear_empresa', 'empresa', { nombre, rut, empresaId });

        mostrarToast(`Cliente "${nombre}" creado.`, 'ok');
        empCerrarForms();

        // Seleccionar directamente la empresa recién creada
        if (typeof seleccionarEmpresa === 'function') seleccionarEmpresa(empresaId);

    } catch(e) {
        err.textContent = 'Error: ' + e.message;
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Crear cliente'; }
    }
}

// ── Unirse con código de invitación ──────────────────────────

// Canje del código (núcleo reutilizable). Requiere sesión autenticada:
// el usuario ya debe existir (login). Devuelve { ok, error?, titularUid? }.
// Reutilizado tanto por el login (firebase-service.fbLogin) como por el
// selector de clientes (empVerificarCodigo).
async function _audCanjearCodigo(codigo) {
    codigo = (codigo || '').trim().toUpperCase();
    if (codigo.length !== 6) return { ok: false, error: 'El código debe tener 6 caracteres.' };
    if (!_fbDb || !window.currentUser) return { ok: false, error: 'Debes iniciar sesión primero.' };

    const snap = await _fbDb.collection('invitaciones').doc(codigo).get();
    if (!snap.exists) return { ok: false, error: 'Código inválido o no existe.' };

    const inv = snap.data();
    if (inv.usada) return { ok: false, error: 'Este código ya fue utilizado.' };
    if (inv.expira.toDate() < new Date()) return { ok: false, error: 'El código expiró. Solicita uno nuevo.' };

    const uid        = window.currentUser.uid;
    const titularUid = inv.titularUid;
    if (!titularUid)        return { ok: false, error: 'Código no válido para esta versión.' };
    if (titularUid === uid) return { ok: false, error: 'No puedes usar tu propio código de invitación.' };

    // Vincular el perfil del invitado al titular (verá todos sus clientes)
    await _fbDb.collection('perfiles').doc(uid).update({
        vinculadoA: titularUid,
        canInvite:  false,
    });
    // Marcar invitación como usada
    await _fbDb.collection('invitaciones').doc(codigo).update({
        usada: true, usadaPor: uid,
        usadaEn: firebase.firestore.FieldValue.serverTimestamp(),
    });
    // Mover el código de "activos" a "invitados" en el perfil del titular
    await _fbDb.collection('perfiles').doc(titularUid).update({
        codigosActivos: firebase.firestore.FieldValue.arrayRemove(codigo),
        invitados:      firebase.firestore.FieldValue.arrayUnion(uid),
    });

    return { ok: true, titularUid };
}

// Entrada directa con código (sesión anónima). El código es una LLAVE DE
// ACCESO reutilizable al perfil del titular: no se consume, solo se invalida
// si el titular lo revoca. Arma window.currentUser con los clientes del titular.
async function _audEntrarConCodigo(codigo, authUser) {
    codigo = (codigo || '').trim().toUpperCase();
    if (codigo.length !== 6) return { ok: false, error: 'El código debe tener 6 caracteres.' };
    if (!_fbDb) return { ok: false, error: 'Sin conexión.' };

    const snap = await _fbDb.collection('invitaciones').doc(codigo).get();
    if (!snap.exists) return { ok: false, error: 'Código inválido o no existe.' };
    const inv = snap.data();
    if (inv.revocada) return { ok: false, error: 'Este código fue revocado por el titular.' };

    const titularUid = inv.titularUid;
    if (!titularUid) return { ok: false, error: 'Código no válido para esta versión.' };

    const tSnap = await _fbDb.collection('perfiles').doc(titularUid).get();
    if (!tSnap.exists) return { ok: false, error: 'La cuenta del titular ya no existe.' };
    const t = tSnap.data();

    window.currentUser = {
        uid:          authUser.uid,
        email:        'Invitado',
        esInvitado:   true,
        canInvite:    false,
        accesoPorCodigo: true,
        titularUid,
        titularEmail: t.email || '',
        empresas:     t.empresas || [],
        rol:          'asistente',
        categoria:    'primera',
    };
    localStorage.setItem('_fb_perfil_local', JSON.stringify(window.currentUser));
    return { ok: true, titularUid };
}

async function empVerificarCodigo() {
    const err    = document.getElementById('empCodigoError');
    const btn    = document.querySelector('#empCodigoForm .login-btn');
    const codigo = document.getElementById('empCodigo').value.trim().toUpperCase();

    err.textContent = '';
    if (codigo.length !== 6) { err.textContent = 'El código debe tener 6 caracteres.'; return; }

    if (btn) { btn.disabled = true; btn.textContent = 'Verificando…'; }

    try {
        const res = await _audCanjearCodigo(codigo);
        if (!res.ok) { err.textContent = res.error; return; }

        mostrarToast('Te uniste a la cuenta correctamente.', 'ok');
        empCerrarForms();

        // Recargar el perfil → resuelve vinculadoA y muestra los clientes del titular
        if (typeof _fbCargarPerfil === 'function') await _fbCargarPerfil({ uid: window.currentUser.uid, email: window.currentUser.email });
        if (typeof _fbShowEmpresaSelector === 'function') await _fbShowEmpresaSelector();

    } catch(e) {
        err.textContent = 'Error: ' + e.message;
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Verificar código'; }
    }
}

// ── Gestión de invitaciones (solo admin, desde Configuración) ─

// ContAPP Auditor: la invitación es a nivel de PERFIL (no por empresa).
// El titular de pago genera hasta MAX_INVITADOS códigos; cada invitado que
// los canjea queda vinculado al perfil del titular y ve TODOS sus clientes.
const MAX_INVITADOS = 4;

async function crearInvitacion() {
    const user = window.currentUser;
    if (!user || !_fbDb) return;

    // Solo el titular de pago puede invitar; los invitados no.
    if (user.esInvitado || user.canInvite === false) {
        mostrarToast('Solo el titular de la cuenta puede crear invitaciones.', 'error');
        return;
    }

    // Límite: códigos pendientes + invitados ya vinculados ≤ 4.
    const codigosActivos = user.codigosActivos || [];
    const invitados      = user.invitados      || [];
    if (codigosActivos.length + invitados.length >= MAX_INVITADOS) {
        mostrarToast(`Alcanzaste el máximo de ${MAX_INVITADOS} invitaciones. Para más cupos se requiere otra licencia.`, 'error');
        return;
    }

    const email  = document.getElementById('invEmail')?.value.trim() || '';
    const codigo = _generarCodigo6();
    const expira = new Date(Date.now() + 48 * 60 * 60 * 1000);

    try {
        await _fbDb.collection('invitaciones').doc(codigo).set({
            titularUid:   user.uid,
            titularEmail: user.email,
            email,                       // referencia opcional del invitado
            expira:       firebase.firestore.Timestamp.fromDate(expira),
            usada:        false,
            revocada:     false,         // llave reutilizable hasta que el titular la revoque
            creadaEn:     firebase.firestore.FieldValue.serverTimestamp(),
        });

        // Registrar el código pendiente en el perfil del titular
        const nuevos = [...codigosActivos, codigo];
        await _fbDb.collection('perfiles').doc(user.uid).update({ codigosActivos: nuevos });
        window.currentUser.codigosActivos = nuevos;
        localStorage.setItem('_fb_perfil_local', JSON.stringify(window.currentUser));

        if (typeof audit === 'function') audit('crear_invitacion', 'usuarios', { email, codigo });

        document.getElementById('invCodigoBox').style.display = 'block';
        document.getElementById('invCodigoGen').textContent   = codigo;
        if (document.getElementById('invEmail')) document.getElementById('invEmail').value = '';
        mostrarToast(`Invitación creada (${codigosActivos.length + invitados.length + 1}/${MAX_INVITADOS}). Comparte el código.`, 'ok');
    } catch(e) {
        mostrarToast('Error creando invitación: ' + e.message, 'error');
    }
}

function copiarCodigoInvitacion() {
    const codigo = document.getElementById('invCodigoGen')?.textContent;
    if (!codigo) return;
    navigator.clipboard.writeText(codigo).then(() => mostrarToast('Código copiado al portapapeles.', 'ok'));
}

async function cargarUsuariosEmpresa() {
    if (!puedeAdministrar()) return;
    const user = window.currentUser;
    if (!user || !_fbDb) return;

    try {
        const snap = await _fbDb
            .collection('empresas').doc(user.empresaId)
            .collection('usuarios').get();
        const cont = document.getElementById('usuariosListaCont');
        if (!cont) return;
        if (snap.empty) { cont.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">Solo tú en esta empresa.</p>'; return; }
        cont.innerHTML = snap.docs.map(d => {
            const u = d.data();
            return `<div class="inv-usuario-fila">
                <span>${u.email}</span>
                <span class="badge">${window.ROLES?.[u.rol]?.label || u.rol}</span>
                <button class="btn btn-sm" onclick="cambiarRolUsuario('${d.id}', '${u.email}')">Cambiar rol</button>
            </div>`;
        }).join('');
    } catch(e) { console.warn('Error cargando usuarios:', e); }
}

async function cambiarRolUsuario(uid, email) {
    if (!puedeAdministrar()) return;
    const nuevoRol = prompt(`Nuevo rol para ${email}:\nadmin | contador | asistente | lectura`);
    if (!nuevoRol || !window.ROLES[nuevoRol]) { mostrarToast('Rol inválido.', 'error'); return; }
    const user = window.currentUser;
    try {
        await _fbDb.collection('empresas').doc(user.empresaId).collection('usuarios').doc(uid).update({ rol: nuevoRol });
        if (typeof audit === 'function') audit('cambiar_rol', 'usuarios', { uid, email, nuevoRol });
        mostrarToast('Rol actualizado.', 'ok');
        cargarUsuariosEmpresa();
    } catch(e) { mostrarToast('Error: ' + e.message, 'error'); }
}

// ── Certificado digital ───────────────────────────────────────

function cargarCertificado() {
    const input = document.getElementById('certFileInput');
    if (input) input.click();
}

async function procesarCertificado(input) {
    const file = input.files[0];
    if (!file) return;
    if (!file.name.endsWith('.pfx') && !file.name.endsWith('.p12')) {
        mostrarToast('El certificado debe ser un archivo .pfx o .p12', 'error');
        return;
    }
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const bytes  = new Uint8Array(e.target.result);
            const base64 = btoa(String.fromCharCode(...bytes));
            if (window.electronAPI?.guardarCertificado) {
                await window.electronAPI.guardarCertificado(base64);
            } else {
                localStorage.setItem('core_certificado_b64',    base64);
                localStorage.setItem('core_certificado_nombre', file.name);
            }
            _actualizarEstadoCertificado(file.name, true);
            mostrarToast('Certificado cargado correctamente.', 'ok');
            if (typeof audit === 'function') audit('cargar_certificado', 'configuracion', { nombre: file.name });
        } catch(err) {
            mostrarToast('Error procesando certificado: ' + err.message, 'error');
        }
    };
    reader.readAsArrayBuffer(file);
}

function _actualizarEstadoCertificado(nombre, valido) {
    const box = document.getElementById('certEstadoBox');
    if (!box) return;
    box.style.display = 'block';
    box.innerHTML = valido
        ? `<span style="color:var(--positive);">✔ Certificado cargado: <strong>${nombre}</strong></span>`
        : `<span style="color:var(--text-muted);">Sin certificado digital cargado.</span>`;
}

function eliminarCertificado() {
    if (!confirm('¿Eliminar el certificado digital almacenado?')) return;
    localStorage.removeItem('core_certificado_b64');
    localStorage.removeItem('core_certificado_nombre');
    if (window.electronAPI?.eliminarCertificado) window.electronAPI.eliminarCertificado();
    _actualizarEstadoCertificado('', false);
    mostrarToast('Certificado eliminado.', 'ok');
}

function verificarCertificadoGuardado() {
    const nombre = localStorage.getItem('core_certificado_nombre');
    if (nombre) _actualizarEstadoCertificado(nombre, true);
}

// ── Helpers ───────────────────────────────────────────────────

function _generarCodigo6() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}

window.wizardAbrir                  = wizardAbrir;
window.wizardCerrar                 = wizardCerrar;
window.wizardSiguiente              = wizardSiguiente;
window.wizardAtras                  = wizardAtras;
window.wizardFinalizar              = wizardFinalizar;
window.empAbrirCrear                = empAbrirCrear;
window.empAbrirCodigo               = empAbrirCodigo;
window.empCerrarForms               = empCerrarForms;
window.empGuardarNueva              = empGuardarNueva;
window.empVerificarCodigo           = empVerificarCodigo;
window._audCanjearCodigo            = _audCanjearCodigo;
window._audEntrarConCodigo          = _audEntrarConCodigo;
window.crearInvitacion              = crearInvitacion;
window.copiarCodigoInvitacion       = copiarCodigoInvitacion;
window.cargarUsuariosEmpresa        = cargarUsuariosEmpresa;
window.cambiarRolUsuario            = cambiarRolUsuario;
window.cargarCertificado            = cargarCertificado;
window.procesarCertificado          = procesarCertificado;
window.eliminarCertificado          = eliminarCertificado;
window.verificarCertificadoGuardado = verificarCertificadoGuardado;
