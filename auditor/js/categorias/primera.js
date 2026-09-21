'use strict';
// ─────────────────────────────────────────────────────────────────────────────
//  PRIMERA CATEGORÍA — Catálogo y lógica exclusiva de 1ª Categoría Tributaria
//  Contabilidad completa: libros, reportes, comercial, RRHH, tributario.
// ─────────────────────────────────────────────────────────────────────────────

// Grupos restaurados a la división histórica G1-G5 (previa a la consolidación
// a 3 grupos de la integración de diseño — ver git 67061db "rediseño de
// arquitectura de módulos", y PLANIFICACION/INTEGRACION_DISENO.md sección
// "Decisión de arquitectura: 3 grupos de módulos, no 5"). El G5 original
// también incluía "Auditoría (Informe/Hallazgos)" — ese módulo ya no existe
// en el catálogo (no hay vista ni navegación asociada), así que Empresa
// quedó solo con Inventario y Activos.
const CAT1_MODULOS = [
    { id: 'estructura-contable',   label: 'Estructura Contable (Diario/Mayor/Balance)',      grupo: 'Contabilidad', icono: '📝', defecto: true  }, // G1
    { id: 'reportes-financieros',  label: 'Reportes Financieros',                            grupo: 'Contabilidad', icono: '📊', defecto: true  }, // G1
    { id: 'egresos-ingresos',      label: 'Egresos e Ingresos (Compras/Ventas/Honorarios)',  grupo: 'Comercial',    icono: '🔁', defecto: true  }, // G2
    { id: 'tributario-1cat',       label: 'Tributario (F29 / IVA)',                          grupo: 'Comercial',    icono: '🧾', defecto: true  }, // G2
    { id: 'documentos',            label: 'Documentación',                                   grupo: 'Datos',        icono: '📁', defecto: true  }, // G3
    { id: 'conciliacion-cartolas', label: 'Conciliación y Cartolas',                          grupo: 'Datos',        icono: '🏦', defecto: true  }, // G3
    { id: 'clientes',              label: 'Clientes / Prov.',                                 grupo: 'Datos',        icono: '🤝', defecto: true  }, // G3
    { id: 'remuneraciones',        label: 'Remuneraciones',                                  grupo: 'RRHH',         icono: '👷', defecto: false }, // G4
    { id: 'inventario-activos',    label: 'Inventario y Activos',                            grupo: 'Empresa',      icono: '📦', defecto: true  }, // G5
];

// ── Defaults ──────────────────────────────────────────────────────────────────
function cat1ModulosDefecto() {
    return Object.fromEntries(CAT1_MODULOS.map(m => [m.id, m.defecto]));
}

// ── Aplicar módulos activos ───────────────────────────────────────────────────
// Antes tocaba directamente el DOM del sidebar (nav-grupo-*/data-modulo); ese
// sidebar ya no existe (reemplazado por Home abanico + selector de módulo en
// topbar, ver menu.js). Ahora solo persiste el estado y pide un re-render del
// menú compartido — construirMenu() en menu.js es quien filtra por activos.
function cat1AplicarModulos(modulosActivos) {
    if (typeof refrescarMenuNavegacion === 'function') refrescarMenuNavegacion();
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
