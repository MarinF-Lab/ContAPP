// ─────────────────────────────────────────────────────────────
//  PERMISOS — Control de acceso basado en roles (RBAC)
//  Roles: admin > contador > asistente > lectura
// ─────────────────────────────────────────────────────────────

const ROLES = {
    admin:     { label: 'Administrador', nivel: 4 },
    contador:  { label: 'Contador',      nivel: 3 },
    asistente: { label: 'Asistente',     nivel: 2 },
    lectura:   { label: 'Solo Lectura',  nivel: 1 },
};

function _nivelRol() {
    return ROLES[window.currentUser?.rol]?.nivel || 1;
}

function puedeAdministrar() { return _nivelRol() >= 4; }
function puedeGestionar()   { return _nivelRol() >= 3; }
function puedeEscribir()    { return _nivelRol() >= 2; }
function puedeEditar()      { return _nivelRol() >= 3; }
function puedeEliminar()    { return _nivelRol() >= 3; }

// Oculta/muestra elementos con data-requiere-rol="admin|contador|asistente"
function aplicarPermisos() {
    const nivel = _nivelRol();
    document.querySelectorAll('[data-requiere-rol]').forEach(el => {
        const req = el.getAttribute('data-requiere-rol');
        el.style.display = nivel >= (ROLES[req]?.nivel ?? 99) ? '' : 'none';
    });
    // Mostrar badge de rol en la barra de usuario
    const badge = document.getElementById('fbUserRolBadge');
    if (badge) {
        const rol = window.currentUser?.rol || 'lectura';
        badge.textContent = ROLES[rol]?.label || rol;
        badge.style.display = 'inline';
    }
}

// Oculta módulos que no aplican según categoría tributaria.
// La navegación ya no es un sidebar estático (Home abanico + selector de
// módulo en topbar, ver menu.js) — aquí solo se actualiza el badge y se
// delega el filtrado real (categoría + módulos activos por cliente) a
// construirMenu()/refrescarMenuNavegacion() en menu.js.
function aplicarNavegacionPorCategoria() {
    const cat      = window.currentUser?.categoria || 'primera';
    const esSegunda = cat === 'segunda';

    // Actualizar indicador de categoría en configuración
    const catBadge = document.getElementById('cfgCategoriaBadge');
    if (catBadge) {
        catBadge.textContent = esSegunda ? 'Segunda Categoría' : 'Primera Categoría';
        catBadge.className   = esSegunda ? 'badge badge-segunda' : 'badge badge-primera';
    }

    if (typeof refrescarMenuNavegacion === 'function') refrescarMenuNavegacion();
}

window.ROLES                         = ROLES;
window.puedeAdministrar              = puedeAdministrar;
window.puedeGestionar                = puedeGestionar;
window.puedeEscribir                 = puedeEscribir;
window.puedeEditar                   = puedeEditar;
window.puedeEliminar                 = puedeEliminar;
window.aplicarPermisos               = aplicarPermisos;
window.aplicarNavegacionPorCategoria = aplicarNavegacionPorCategoria;
