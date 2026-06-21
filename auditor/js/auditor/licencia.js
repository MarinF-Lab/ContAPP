'use strict';
/**
 * licencia.js — Modelo de cuentas y licencia de ContAPP Auditor
 *
 * MODELO (ver memoria auditor-licencia-model):
 *   • El servicio es de pago. Solo el correo que pagó es TITULAR.
 *   • El titular puede crear hasta MAX_INVITADOS (4) códigos de invitación.
 *   • Cada invitado que canjea un código queda `vinculadoA` al perfil del
 *     titular y ve TODOS sus clientes — sin pagar.
 *   • Los invitados NO pueden invitar ni crear clientes nuevos de pago.
 *
 * Estructura en Firestore:
 *   perfiles/{uid} → {
 *     email, empresas:[...],          // clientes (solo titular)
 *     canInvite, codigosActivos:[],   // titular
 *     invitados:[uid...],             // titular (máx 4)
 *     vinculadoA: <titularUid|null>,  // invitado
 *     estado: 'activo'|'pendiente',   // pago (futuro, webhook)
 *   }
 *   invitaciones/{codigo} → { titularUid, titularEmail, expira, usada, usadaPor }
 *
 * La lógica de crear/canjear vive en auth-manager.js; aquí van los helpers
 * de consulta de estado que usa la UI para mostrar/ocultar acciones.
 */

const AUD_MAX_INVITADOS = 4;

// ¿La cuenta actual es el titular de pago?
function audEsTitular() {
    const u = window.currentUser;
    return !!u && !u.esInvitado && u.canInvite !== false;
}

// ¿La cuenta actual entró con código de invitación?
function audEsInvitado() {
    return !!window.currentUser?.esInvitado;
}

// Cupos de invitación que quedan (códigos pendientes + invitados ya vinculados).
function audCuposRestantes() {
    const u = window.currentUser;
    if (!u) return 0;
    const usados = (u.codigosActivos?.length || 0) + (u.invitados?.length || 0);
    return Math.max(0, AUD_MAX_INVITADOS - usados);
}

// ¿Puede generar más códigos de invitación?
function audPuedeInvitar() {
    return audEsTitular() && audCuposRestantes() > 0;
}

// ¿La licencia está activa? (pago — por ahora no se fuerza el bloqueo)
function audLicenciaActiva() {
    const u = window.currentUser;
    if (!u) return false;
    if (u.esInvitado) return true;                  // el invitado hereda el acceso del titular
    return u.estado ? u.estado === 'activo' : true; // sin estado aún → permitir
}

window.AUD_MAX_INVITADOS = AUD_MAX_INVITADOS;
window.audEsTitular      = audEsTitular;
window.audEsInvitado     = audEsInvitado;
window.audCuposRestantes = audCuposRestantes;
window.audPuedeInvitar   = audPuedeInvitar;
window.audLicenciaActiva = audLicenciaActiva;
