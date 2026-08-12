'use strict';
// ─────────────────────────────────────────────────────────────────────────────
//  SEGUNDA CATEGORÍA — Catálogo y lógica exclusiva de 2ª Categoría Tributaria
//  Honorarios / Freelance: libro de honorarios, egresos, ingresos, F29, F22.
//  Los módulos compartidos con primera (clientes, indicadores)
//  están copiados aquí de forma independiente — sin referencia cruzada.
// ─────────────────────────────────────────────────────────────────────────────

const CAT2_MODULOS = [
    { id: 'libros-contables-hon',        label: 'Libros Contables (Honorarios/Ingresos/Egresos)', grupo: 'Contabilidad', icono: '📒', defecto: true },
    { id: 'declaracion-impuestos-hon',   label: 'Declaración de Impuestos (F29/F22)', grupo: 'Contabilidad', icono: '🧾', defecto: true },
    { id: 'documentos-hon',              label: 'Documentación',            grupo: 'Comercial', icono: '📁', defecto: true },
    { id: 'conciliacion-cartolas-hon',   label: 'Conciliación y Cartolas',  grupo: 'Comercial', icono: '🏦', defecto: true },
    { id: 'clientes-hon',                label: 'Clientes / Prov.',         grupo: 'Comercial', icono: '🤝', defecto: true },
    { id: 'prestadores',                 label: 'Prestadores',              grupo: 'Comercial', icono: '👤', defecto: true },
];

// ── Defaults ──────────────────────────────────────────────────────────────────
function cat2ModulosDefecto() {
    return Object.fromEntries(CAT2_MODULOS.map(m => [m.id, m.defecto]));
}

// ── Aplicar módulos activos ───────────────────────────────────────────────────
// Ver nota equivalente en primera.js — el sidebar que esto tocaba ya no existe;
// ahora solo se pide un re-render del menú compartido (menu.js).
function cat2AplicarModulos(modulosActivos) {
    if (typeof refrescarMenuNavegacion === 'function') refrescarMenuNavegacion();
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
