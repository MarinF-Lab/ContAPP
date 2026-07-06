'use strict';
// ─────────────────────────────────────────────────────────────────────────────
//  PRIMERA CATEGORÍA — Catálogo y lógica exclusiva de 1ª Categoría Tributaria
//  Contabilidad completa: libros, reportes, comercial, RRHH, tributario.
// ─────────────────────────────────────────────────────────────────────────────

const CAT1_MODULOS = [
    { id: 'estructura-contable',   label: 'Estructura Contable (Diario/Mayor/Balance)',      grupo: 'G1 · Contabilidad', defecto: true  },
    { id: 'reportes-financieros',  label: 'Reportes Financieros',                            grupo: 'G1 · Contabilidad', defecto: true  },
    { id: 'egresos-ingresos',      label: 'Egresos e Ingresos (Compras/Ventas/Honorarios)',  grupo: 'G2 · Comercial',    defecto: true  },
    { id: 'tributario-1cat',       label: 'Tributario (F29 / IVA)',                          grupo: 'G2 · Comercial',    defecto: true  },
    { id: 'documentos',            label: 'Documentación',                                   grupo: 'G3 · Datos',        defecto: true  },
    { id: 'conciliacion-cartolas', label: 'Conciliación y Cartolas',                          grupo: 'G3 · Datos',        defecto: true  },
    { id: 'clientes',              label: 'Clientes / Prov.',                                 grupo: 'G3 · Datos',        defecto: true  },
    { id: 'remuneraciones',        label: 'Remuneraciones',                                  grupo: 'G4 · RRHH',         defecto: false },
    { id: 'activos-produccion',    label: 'Activos y Producción',                             grupo: 'G5 · Empresa',      defecto: true  },
    { id: 'auditoria',             label: 'Auditoría',                                        grupo: 'G5 · Empresa',      defecto: true  },
];

// IDs de grupos de nav de primera categoría
const CAT1_IDS_MOSTRAR = [
    'nav-grupo-contabilidad',
    'nav-grupo-comercial',
    'nav-grupo-datos',    // clientes/proveedores + documentación + conciliación de 1ª categoría
    'nav-grupo-rrhh',
    'nav-grupo-empresa',
];

// IDs de grupos de nav de segunda categoría (se ocultan con primera activa)
const CAT1_IDS_OCULTAR = [
    'nav-grupo-contabilidad-hon',
    'nav-grupo-comercial-hon',
    'nav-grupo-tributario-hon',
];

// ── Defaults ──────────────────────────────────────────────────────────────────
function cat1ModulosDefecto() {
    return Object.fromEntries(CAT1_MODULOS.map(m => [m.id, m.defecto]));
}

// ── Aplicar al sidebar ────────────────────────────────────────────────────────
function cat1AplicarModulos(modulosActivos) {
    const efectivos = modulosActivos || cat1ModulosDefecto();

    CAT1_IDS_MOSTRAR.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = '';
    });
    CAT1_IDS_OCULTAR.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    // Scoped a los grupos de primera para no afectar los data-modulo duplicados de segunda
    const scopeGroups = CAT1_IDS_MOSTRAR
        .map(id => document.getElementById(id))
        .filter(Boolean);

    CAT1_MODULOS.forEach(m => {
        const activo = m.id in efectivos ? efectivos[m.id] : m.defecto;
        scopeGroups.forEach(grupo => {
            const navEl = grupo.querySelector(`[data-modulo="${m.id}"]`);
            if (navEl) navEl.style.display = activo ? '' : 'none';
        });
    });

    // Ocultar grupos de primera que queden sin ítems visibles
    CAT1_IDS_MOSTRAR.forEach(id => {
        const grupo = document.getElementById(id);
        if (!grupo) return;
        const items      = grupo.querySelectorAll('.nav-item');
        const hayVisible = [...items].some(el => el.style.display !== 'none');
        const esSistema  = grupo.querySelector('.nav-group-title')?.textContent?.includes('SISTEMA');
        const esInicio   = grupo.classList.contains('nav-group-solo');
        if (!hayVisible && !esSistema && !esInicio) grupo.style.display = 'none';
    });
}

// ── Renderizar checkboxes en un contenedor ────────────────────────────────────
function cat1RenderizarToggles(containerId, modulosActivos) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const grupos = {};
    CAT1_MODULOS.forEach(m => {
        if (!grupos[m.grupo]) grupos[m.grupo] = [];
        grupos[m.grupo].push(m);
    });

    container.innerHTML = `
        <div class="aud-modulos-header">Módulos activos — 1ª Categoría</div>
        <div class="aud-modulos-grid">
            ${Object.entries(grupos).map(([grupo, modulos]) => `
                <div class="aud-mod-grupo">
                    <div class="aud-mod-grupo-titulo">${grupo}</div>
                    ${modulos.map(m => {
                        const activo = modulosActivos
                            ? (m.id in modulosActivos ? modulosActivos[m.id] : m.defecto)
                            : m.defecto;
                        return `
                        <label class="aud-mod-toggle">
                            <input type="checkbox" name="modulo_${m.id}" value="${m.id}"
                                   ${activo ? 'checked' : ''}>
                            <span>${m.label}</span>
                        </label>`;
                    }).join('')}
                </div>
            `).join('')}
        </div>
        <div class="aud-modulos-hint">Puedes cambiar estos ajustes en cualquier momento.</div>
    `;
}

// ── Leer estado de checkboxes desde el formulario ─────────────────────────────
function cat1LeerFormulario(containerId) {
    const scope = containerId ? document.getElementById(containerId) : document;
    if (!scope) return cat1ModulosDefecto();
    return Object.fromEntries(
        CAT1_MODULOS.map(m => {
            const cb = scope.querySelector(`input[name="modulo_${m.id}"]`);
            return [m.id, cb ? cb.checked : m.defecto];
        })
    );
}

// ── Expose ────────────────────────────────────────────────────────────────────
window.CAT1_MODULOS           = CAT1_MODULOS;
window.cat1ModulosDefecto     = cat1ModulosDefecto;
window.cat1AplicarModulos     = cat1AplicarModulos;
window.cat1RenderizarToggles  = cat1RenderizarToggles;
window.cat1LeerFormulario     = cat1LeerFormulario;
