// ─────────────────────────────────────────────────────────────
//  AUDITORÍA — Registro inmutable de acciones importantes
//  Destino: empresas/{empresaId}/audit_log/{id}
//  Solo administradores pueden consultar el log.
// ─────────────────────────────────────────────────────────────

async function audit(accion, modulo, detalle) {
    const user = window.currentUser;
    if (!user || !_fbDb) return;
    try {
        await _fbDb
            .collection('empresas').doc(user.empresaId)
            .collection('audit_log')
            .add({
                ts:     firebase.firestore.FieldValue.serverTimestamp(),
                uid:    user.uid,
                email:  user.email || '',
                rol:    user.rol   || 'lectura',
                accion,
                modulo,
                detalle: detalle || {},
            });
    } catch(e) {
        console.warn('Audit write error:', e.message);
    }
}

async function cargarAuditLog() {
    const user = window.currentUser;

    // Diagnóstico: muestra el rol real para detectar el problema
    if (!puedeAdministrar()) {
        const rolReal = user?.rol ?? '(sin rol)';
        const uid     = user?.uid ?? '(sin uid)';
        mostrarToast(`Sin permisos — rol actual: "${rolReal}" (uid: ${uid})`, 'error');
        console.warn('[Audit] currentUser:', window.currentUser);
        return;
    }
    if (!user || !_fbDb) { mostrarToast('Sin sesión activa o sin conexión a Firebase.', 'error'); return; }

    const cont = document.getElementById('auditLogCont');
    if (cont) cont.innerHTML = '<p style="color:var(--text-muted);padding:16px;">Cargando…</p>';

    try {
        const snap = await _fbDb
            .collection('empresas').doc(user.empresaId)
            .collection('audit_log')
            .orderBy('ts', 'desc')
            .limit(250)
            .get();
        _renderAuditLog(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch(e) {
        mostrarToast('Error cargando auditoría: ' + e.message, 'error');
    }
}

function _renderAuditLog(entries) {
    const cont = document.getElementById('auditLogCont');
    if (!cont) return;
    if (!entries.length) {
        cont.innerHTML = '<p style="color:var(--text-muted);padding:16px;">Sin registros de auditoría.</p>';
        return;
    }
    const rows = entries.map(e => {
        const ts  = e.ts?.toDate ? e.ts.toDate().toLocaleString('es-CL') : '–';
        const det = typeof e.detalle === 'object'
            ? Object.entries(e.detalle).map(([k,v]) => `${k}: ${v}`).join(' | ').slice(0, 100)
            : String(e.detalle || '').slice(0, 100);
        return `<tr>
            <td style="white-space:nowrap;font-size:12px;">${ts}</td>
            <td style="font-size:12px;">${e.email || e.uid}</td>
            <td><span class="badge">${e.rol || '–'}</span></td>
            <td>${e.modulo}</td>
            <td><strong>${e.accion}</strong></td>
            <td style="font-size:11px;color:var(--text-muted);">${det}</td>
        </tr>`;
    }).join('');
    cont.innerHTML = `
        <div style="overflow-x:auto;">
        <table class="cont-table">
            <thead><tr>
                <th>Fecha / Hora</th><th>Usuario</th><th>Rol</th>
                <th>Módulo</th><th>Acción</th><th>Detalle</th>
            </tr></thead>
            <tbody>${rows}</tbody>
        </table>
        </div>`;
}

window.audit          = audit;
window.cargarAuditLog = cargarAuditLog;
