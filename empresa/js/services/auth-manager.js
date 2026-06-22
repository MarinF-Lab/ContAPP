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
        const email = document.getElementById('wizEmail').value.trim();
        const pass  = document.getElementById('wizPass').value;
        const pass2 = document.getElementById('wizPass2').value;
        if (!email || !pass) { if (err) err.textContent = 'Ingresa correo y contraseña.'; return; }
        if (pass.length < 6) { if (err) err.textContent = 'La contraseña debe tener al menos 6 caracteres.'; return; }
        if (pass !== pass2)  { if (err) err.textContent = 'Las contraseñas no coinciden.'; return; }
        _wizData.email = email;
        _wizData.pass  = pass;
        _wizPaso = 2;
        // Mostrar resumen
        const cont = document.getElementById('wizResumenCont');
        if (cont) cont.innerHTML = `
            <div class="wiz-resumen-fila"><span>Correo</span><strong>${email}</strong></div>
            <div class="wiz-resumen-fila" style="color:var(--text-muted);font-size:13px;margin-top:8px;">
                Después de crear tu cuenta podrás registrar o unirte a una empresa.
            </div>`;
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

        // 2. Crear perfil mínimo — sin empresa todavía
        await _fbDb.collection('perfiles').doc(uid).set({
            email:    _wizData.email,
            empresas: [],
            creadoEn: firebase.firestore.FieldValue.serverTimestamp(),
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

    err.textContent = '';

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

        // Crear documento empresa
        await _fbDb.collection('empresas').doc(empresaId).set({
            empresa:  nombre,
            rut,
            giro:     giro || '',
            categoria,
            creadoEn: firebase.firestore.FieldValue.serverTimestamp(),
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

        mostrarToast(`Empresa "${nombre}" creada.`, 'ok');
        empCerrarForms();

        // Seleccionar directamente la empresa recién creada
        if (typeof seleccionarEmpresa === 'function') seleccionarEmpresa(empresaId);

    } catch(e) {
        err.textContent = 'Error: ' + e.message;
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Crear empresa'; }
    }
}

// ── Unirse con código de invitación ──────────────────────────

async function empVerificarCodigo() {
    const err    = document.getElementById('empCodigoError');
    const btn    = document.querySelector('#empCodigoForm .login-btn');
    const codigo = document.getElementById('empCodigo').value.trim().toUpperCase();

    err.textContent = '';
    if (codigo.length !== 6) { err.textContent = 'El código debe tener 6 caracteres.'; return; }

    if (btn) { btn.disabled = true; btn.textContent = 'Verificando…'; }

    try {
        const snap = await _fbDb.collection('invitaciones').doc(codigo).get();
        if (!snap.exists)         { err.textContent = 'Código inválido o no existe.'; return; }

        const inv = snap.data();
        if (inv.usada)            { err.textContent = 'Este código ya fue utilizado.'; return; }
        if (inv.expira.toDate() < new Date()) { err.textContent = 'El código expiró. Solicita uno nuevo.'; return; }

        const user      = window.currentUser;
        const uid       = user.uid;
        const empresaId = inv.empresaId;
        const rol       = inv.rol || 'asistente';
        const categoria = inv.categoria || 'primera';

        // Registrar al usuario en la empresa
        await _fbDb.collection('empresas').doc(empresaId)
            .collection('usuarios').doc(uid).set({
                email: user.email, rol, categoria,
                creadoEn: firebase.firestore.FieldValue.serverTimestamp(),
            });

        // Marcar invitación como usada
        await _fbDb.collection('invitaciones').doc(codigo).update({
            usada: true, usadaPor: uid,
            usadaEn: firebase.firestore.FieldValue.serverTimestamp(),
        });

        // Agregar empresaId al perfil del usuario
        const nuevasEmpresas = [...(user.empresas || []), empresaId];
        await _fbDb.collection('perfiles').doc(uid).update({ empresas: nuevasEmpresas });
        window.currentUser.empresas = nuevasEmpresas;
        localStorage.setItem('_fb_perfil_local', JSON.stringify(window.currentUser));

        mostrarToast('Te uniste a la empresa correctamente.', 'ok');
        empCerrarForms();

        // Entrar directamente a la empresa
        if (typeof seleccionarEmpresa === 'function') seleccionarEmpresa(empresaId);

    } catch(e) {
        err.textContent = 'Error: ' + e.message;
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Verificar código'; }
    }
}

// ── Gestión de invitaciones (solo admin, desde Configuración) ─

async function crearInvitacion() {
    if (!puedeAdministrar()) { mostrarToast('Solo administradores pueden invitar usuarios.', 'error'); return; }
    const email = document.getElementById('invEmail')?.value.trim();
    const rol   = document.getElementById('invRol')?.value;
    if (!email) { mostrarToast('Ingresa el correo del invitado.', 'error'); return; }

    const user = window.currentUser;
    if (!user || !_fbDb) return;

    const codigo = _generarCodigo6();
    const expira = new Date(Date.now() + 48 * 60 * 60 * 1000);

    try {
        await _fbDb.collection('invitaciones').doc(codigo).set({
            empresaId: user.empresaId,
            categoria: user.categoria || 'primera',
            email,
            rol:       rol || 'asistente',
            expira:    firebase.firestore.Timestamp.fromDate(expira),
            usada:     false,
            creadaPor: user.uid,
            creadaEn:  firebase.firestore.FieldValue.serverTimestamp(),
        });
        if (typeof audit === 'function') audit('crear_invitacion', 'usuarios', { email, rol, codigo });

        document.getElementById('invCodigoBox').style.display  = 'block';
        document.getElementById('invCodigoGen').textContent = codigo;
        document.getElementById('invEmail').value = '';
        mostrarToast('Invitación creada. Comparte el código.', 'ok');
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
        await _fbDb.collection('perfiles').doc(uid).update({ rol: nuevoRol });
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
window.crearInvitacion              = crearInvitacion;
window.copiarCodigoInvitacion       = copiarCodigoInvitacion;
window.cargarUsuariosEmpresa        = cargarUsuariosEmpresa;
window.cambiarRolUsuario            = cambiarRolUsuario;
window.cargarCertificado            = cargarCertificado;
window.procesarCertificado          = procesarCertificado;
window.eliminarCertificado          = eliminarCertificado;
window.verificarCertificadoGuardado = verificarCertificadoGuardado;
