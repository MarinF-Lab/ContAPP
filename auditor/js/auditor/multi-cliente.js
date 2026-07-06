'use strict';
// ─────────────────────────────────────────────────────────────────────────────
//  MULTI-CLIENTE — Gestión de clientes + despachador de categorías
//  ContAPP Auditor
//
//  La lógica de módulos vive en:
//    js/categorias/primera.js  →  CAT1_*, cat1*
//    js/categorias/segunda.js  →  CAT2_*, cat2*
//  Este archivo solo enruta llamadas al archivo correcto según la categoría
//  y contiene los elementos de UI compartidos (color picker, tarjeta, topbar).
// ─────────────────────────────────────────────────────────────────────────────

// ── Paleta de colores para etiquetas de cliente ───────────────────────────────
const AUD_COLORES = [
    { valor: '#3b82f6', nombre: 'Azul'    },
    { valor: '#10b981', nombre: 'Verde'   },
    { valor: '#f59e0b', nombre: 'Ámbar'   },
    { valor: '#ef4444', nombre: 'Rojo'    },
    { valor: '#8b5cf6', nombre: 'Violeta' },
    { valor: '#ec4899', nombre: 'Rosa'    },
    { valor: '#06b6d4', nombre: 'Cian'    },
    { valor: '#f97316', nombre: 'Naranja' },
    { valor: '#84cc16', nombre: 'Lima'    },
    { valor: '#6b7280', nombre: 'Gris'    },
];

// ── AUD_MODULOS — proxy de compatibilidad hacia los catálogos separados ───────
// Los archivos externos (firebase-service.js) acceden a AUD_MODULOS[categoria].
// Aquí lo exponemos como objeto simple que delega a cada catálogo.
const AUD_MODULOS = {
    get primera() { return typeof CAT1_MODULOS !== 'undefined' ? CAT1_MODULOS : []; },
    get segunda()  { return typeof CAT2_MODULOS !== 'undefined' ? CAT2_MODULOS : []; },
};

// ── Despachador: defaults ─────────────────────────────────────────────────────
function audModulosDefecto(categoria) {
    if (categoria === 'segunda') return cat2ModulosDefecto();
    return cat1ModulosDefecto();
}

// ── Despachador: aplicar al sidebar ──────────────────────────────────────────
function audAplicarModulos(modulosActivos, categoria) {
    if (categoria === 'segunda') {
        cat2AplicarModulos(modulosActivos);
    } else {
        cat1AplicarModulos(modulosActivos);
    }
}

// ── Despachador: renderizar checkboxes ───────────────────────────────────────
function audRenderizarToggleModulos(containerId, categoria, modulosActivos) {
    if (categoria === 'segunda') {
        cat2RenderizarToggles(containerId, modulosActivos);
    } else {
        cat1RenderizarToggles(containerId, modulosActivos);
    }
}

// ── Despachador: leer formulario ──────────────────────────────────────────────
function audLeerModulosFormulario(categoria, containerId) {
    if (categoria === 'segunda') return cat2LeerFormulario(containerId);
    return cat1LeerFormulario(containerId);
}

// ── Actualiza los toggles al cambiar categoría en el formulario de empresa ───
function audOnCategoriaChange(categoria) {
    audRenderizarToggleModulos('empModulosContainer', categoria, null);
}

// ── Color picker ──────────────────────────────────────────────────────────────
function audRenderizarColorPicker(containerId, colorSeleccionado) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const defecto = colorSeleccionado || AUD_COLORES[0].valor;
    window._empColorSeleccionado = defecto;
    container.innerHTML = AUD_COLORES.map(c => `
        <div class="aud-color-dot ${c.valor === defecto ? 'aud-color-dot-sel' : ''}"
             style="background:${c.valor}"
             data-color="${c.valor}"
             title="${c.nombre}"
             onclick="audSeleccionarColor(this,'${c.valor}')"></div>
    `).join('');
}

function audSeleccionarColor(el, color) {
    document.querySelectorAll('#empColorPicker .aud-color-dot')
        .forEach(d => d.classList.remove('aud-color-dot-sel'));
    el.classList.add('aud-color-dot-sel');
    window._empColorSeleccionado = color;
}

// ── Tarjeta de cliente para el selector ──────────────────────────────────────
function audRenderizarTarjeta(cliente) {
    const color   = cliente.color || '#3b82f6';
    const inicial = ((cliente.empresa || cliente.nombre || '?')[0] || '?').toUpperCase();
    const nombre  = cliente.empresa || cliente.nombre || '(Sin nombre)';
    const cat     = cliente.categoria || 'primera';

    return `
        <div class="emp-item aud-emp-item${cliente.esPropio ? ' aud-propio' : ''}"
             onclick="seleccionarEmpresa('${cliente.id}')">
            <div class="aud-emp-avatar" style="background:${color}">${inicial}</div>
            <div class="aud-emp-info">
                <div class="aud-emp-nombre">
                    ${nombre}
                    ${cliente.esPropio ? '<span class="aud-badge-propio">Mi Oficina</span>' : ''}
                </div>
                <div class="aud-emp-meta">
                    ${cliente.rut  ? `<span>🪪 ${cliente.rut}</span>`  : ''}
                    ${cliente.giro ? `<span>📋 ${cliente.giro}</span>` : ''}
                    <span class="aud-cat-badge aud-cat-${cat}">${cat === 'primera' ? '1ª Cat.' : '2ª Cat.'}</span>
                </div>
            </div>
            <div class="aud-emp-arrow">›</div>
        </div>
    `;
}

// ── Indicador de cliente activo en el topbar ──────────────────────────────────
function audActualizarIndicadorCliente(nombreCliente, color, esPropio) {
    let ind = document.getElementById('audClienteIndicador');
    if (!ind) {
        const bar = document.getElementById('fb-user-bar');
        if (!bar) return;
        ind = document.createElement('div');
        ind.id = 'audClienteIndicador';
        ind.style.cssText = 'display:flex;align-items:center;gap:6px;cursor:pointer;';
        ind.setAttribute('onclick', "cambiarEmpresa()");
        ind.setAttribute('title', 'Cambiar cliente');
        bar.insertBefore(ind, bar.firstChild);
    }
    const dot   = color ? `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0;"></span>` : '';
    const label = esPropio ? '⭐ Mi Oficina' : (nombreCliente || 'Cliente');
    ind.innerHTML = `${dot}<span style="font-size:12px;font-weight:600;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${label}</span><span style="font-size:10px;color:var(--text-muted);">▾</span>`;
}

// ── Expose ────────────────────────────────────────────────────────────────────
window.AUD_COLORES                   = AUD_COLORES;
window.AUD_MODULOS                   = AUD_MODULOS;
window.audModulosDefecto             = audModulosDefecto;
window.audAplicarModulos             = audAplicarModulos;
window.audRenderizarToggleModulos    = audRenderizarToggleModulos;
window.audLeerModulosFormulario      = audLeerModulosFormulario;
window.audOnCategoriaChange          = audOnCategoriaChange;
window.audRenderizarColorPicker      = audRenderizarColorPicker;
window.audSeleccionarColor           = audSeleccionarColor;
window.audRenderizarTarjeta          = audRenderizarTarjeta;
window.audActualizarIndicadorCliente = audActualizarIndicadorCliente;
