'use strict';
// ─────────────────────────────────────────────────────────────────────────────
//  SEGUNDA CATEGORÍA — Catálogo y lógica exclusiva de 2ª Categoría Tributaria
//  Honorarios / Freelance: libro de honorarios, egresos, ingresos, F29, F22.
//  Los módulos compartidos con primera (clientes, indicadores)
//  están copiados aquí de forma independiente — sin referencia cruzada.
// ─────────────────────────────────────────────────────────────────────────────

const CAT2_MODULOS = [
    { id: 'libros-contables-hon',        label: 'Libros Contables (Honorarios/Ingresos/Egresos)', grupo: 'G1 · Contabilidad', defecto: true },
    { id: 'documentos-hon',              label: 'Documentación',            grupo: 'G2 · Datos', defecto: true },
    { id: 'conciliacion-cartolas-hon',   label: 'Conciliación y Cartolas',  grupo: 'G2 · Datos', defecto: true },
    { id: 'clientes-hon',                label: 'Clientes / Prov.',         grupo: 'G2 · Datos', defecto: true },
    { id: 'prestadores',                 label: 'Prestadores',              grupo: 'G2 · Datos', defecto: true },
    { id: 'declaracion-impuestos-hon',   label: 'Declaración de Impuestos (F29/F22)', grupo: 'G3 · Tributario', defecto: true },
    { id: 'auditoria-hon',               label: 'Auditoría',                grupo: 'G4 · Empresa', defecto: true },
];

// IDs de grupos de nav de segunda categoría
const CAT2_IDS_MOSTRAR = [
    'nav-grupo-contabilidad-hon',
    'nav-grupo-datos-hon',
    'nav-grupo-tributario-hon',
    'nav-grupo-empresa-hon',
];

// IDs de grupos de nav de primera categoría (se ocultan con segunda activa)
const CAT2_IDS_OCULTAR = [
    'nav-grupo-contabilidad',
    'nav-grupo-comercial',
    'nav-grupo-datos',
    'nav-grupo-rrhh',
    'nav-grupo-empresa',
];

// ── Defaults ──────────────────────────────────────────────────────────────────
function cat2ModulosDefecto() {
    return Object.fromEntries(CAT2_MODULOS.map(m => [m.id, m.defecto]));
}

// ── Aplicar al sidebar ────────────────────────────────────────────────────────
function cat2AplicarModulos(modulosActivos) {
    const efectivos = modulosActivos || cat2ModulosDefecto();

    CAT2_IDS_MOSTRAR.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = '';
    });
    CAT2_IDS_OCULTAR.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    // Scoped a los grupos de segunda para no afectar los data-modulo duplicados de primera
    const scopeGroups = CAT2_IDS_MOSTRAR
        .map(id => document.getElementById(id))
        .filter(Boolean);

    CAT2_MODULOS.forEach(m => {
        const activo = m.id in efectivos ? efectivos[m.id] : m.defecto;
        scopeGroups.forEach(grupo => {
            const navEl = grupo.querySelector(`[data-modulo="${m.id}"]`);
            if (navEl) navEl.style.display = activo ? '' : 'none';
        });
    });

    // Ocultar grupos de segunda que queden sin ítems visibles
    CAT2_IDS_MOSTRAR.forEach(id => {
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
function cat2RenderizarToggles(containerId, modulosActivos) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const grupos = {};
    CAT2_MODULOS.forEach(m => {
        if (!grupos[m.grupo]) grupos[m.grupo] = [];
        grupos[m.grupo].push(m);
    });

    container.innerHTML = `
        <div class="aud-modulos-header">Módulos activos — 2ª Categoría</div>
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
function cat2LeerFormulario(containerId) {
    const scope = containerId ? document.getElementById(containerId) : document;
    if (!scope) return cat2ModulosDefecto();
    return Object.fromEntries(
        CAT2_MODULOS.map(m => {
            const cb = scope.querySelector(`input[name="modulo_${m.id}"]`);
            return [m.id, cb ? cb.checked : m.defecto];
        })
    );
}

// ── Expose ────────────────────────────────────────────────────────────────────
window.CAT2_MODULOS           = CAT2_MODULOS;
window.cat2ModulosDefecto     = cat2ModulosDefecto;
window.cat2AplicarModulos     = cat2AplicarModulos;
window.cat2RenderizarToggles  = cat2RenderizarToggles;
window.cat2LeerFormulario     = cat2LeerFormulario;
