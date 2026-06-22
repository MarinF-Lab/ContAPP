'use strict';
// ─────────────────────────────────────────────────────────────
//  MULTI-CLIENTE — Sistema de gestión de clientes del auditor
//  ContAPP Auditor
// ─────────────────────────────────────────────────────────────

// ── Paleta de colores para etiquetas de cliente ──────────────
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

// ── Catálogo de módulos por categoría tributaria ──────────────
const AUD_MODULOS = {
    primera: [
        { id: 'diario',              label: 'Libro Diario',       grupo: 'Contabilidad', defecto: true  },
        { id: 'mayor',               label: 'Libro Mayor',        grupo: 'Contabilidad', defecto: true  },
        { id: 'plan-cuentas',        label: 'Plan de Cuentas',    grupo: 'Contabilidad', defecto: true  },
        { id: 'balance',             label: 'Balance',            grupo: 'Reportes',     defecto: true  },
        { id: 'balance-clasificado', label: 'Bal. Clasificado',   grupo: 'Reportes',     defecto: true  },
        { id: 'estado-resultados',   label: 'Est. Resultados',    grupo: 'Reportes',     defecto: true  },
        { id: 'flujo-caja',          label: 'Flujo de Caja',      grupo: 'Reportes',     defecto: true  },
        { id: 'compras',             label: 'Compras',            grupo: 'Comercial',    defecto: true  },
        { id: 'ventas',              label: 'Ventas',             grupo: 'Comercial',    defecto: true  },
        { id: 'documentos',          label: 'Documentación',      grupo: 'Comercial',    defecto: true  },
        { id: 'clientes',            label: 'Clientes / Prov.',   grupo: 'Comercial',    defecto: true  },
        { id: 'remuneraciones',      label: 'Remuneraciones',     grupo: 'RRHH',         defecto: false },
        { id: 'indicadores',         label: 'Indicadores',        grupo: 'Tributario',   defecto: true  },
        { id: 'iva-resumen',         label: 'Resumen IVA / F29',  grupo: 'Tributario',   defecto: true  },
        { id: 'auditoria',           label: 'Auditoría',          grupo: 'Sistema',      defecto: false },
    ],
    segunda: [
        { id: 'libro-honorarios',   label: 'Libro de Honorarios', grupo: 'Contabilidad', defecto: true  },
        { id: 'libro-egresos-hon',  label: 'Libro de Egresos',    grupo: 'Contabilidad', defecto: true  },
        { id: 'libro-ingresos-hon', label: 'Libro de Ingresos',   grupo: 'Contabilidad', defecto: true  },
        { id: 'clientes',           label: 'Clientes / Prov.',    grupo: 'Comercial',    defecto: true  },
        { id: 'prestadores',        label: 'Prestadores',         grupo: 'Comercial',    defecto: true  },
        { id: 'indicadores',        label: 'Indicadores',         grupo: 'Tributario',   defecto: true  },
        { id: 'f29-hon',            label: 'Formulario 29',       grupo: 'Tributario',   defecto: true  },
        { id: 'f22-hon',            label: 'Formulario 22',       grupo: 'Tributario',   defecto: true  },
        { id: 'auditoria',          label: 'Auditoría',           grupo: 'Sistema',      defecto: false },
    ],
};

// ── Módulos por defecto para una categoría ───────────────────
function audModulosDefecto(categoria) {
    const lista = AUD_MODULOS[categoria] || AUD_MODULOS.primera;
    return Object.fromEntries(lista.map(m => [m.id, m.defecto]));
}

// ── Aplicar módulos activos al sidebar ───────────────────────
// Llama a esto después de seleccionarEmpresa() para ajustar
// qué ítems del menú son visibles según la config del cliente.
function audAplicarModulos(modulosActivos, categoria) {
    // Si no hay config, mostrar todo según categoría (comportamiento legacy)
    if (!modulosActivos) {
        if (typeof aplicarNavegacionPorCategoria === 'function') {
            aplicarNavegacionPorCategoria();
        }
        return;
    }

    // Ocultar/mostrar grupos de primera y segunda categoría
    const esPrimera = (categoria || 'primera') === 'primera';
    const gruposPrimera = [
        '#nav-grupo-contabilidad', '#nav-grupo-informes',
        '#nav-grupo-comercial',    '#nav-grupo-crm',
        '#nav-grupo-rrhh',         '#nav-grupo-tributario',
    ];
    const gruposSegunda = [
        '#nav-grupo-contabilidad-hon',
        '#nav-grupo-comercial-hon',
        '#nav-grupo-tributario-hon',
    ];
    gruposPrimera.forEach(sel => {
        const el = document.querySelector(sel);
        if (el) el.style.display = esPrimera ? '' : 'none';
    });
    gruposSegunda.forEach(sel => {
        const el = document.querySelector(sel);
        if (el) el.style.display = esPrimera ? 'none' : '';
    });

    // Aplicar toggle por módulo individual
    Object.entries(modulosActivos).forEach(([modulo, activo]) => {
        const navEl = document.querySelector(`[data-modulo="${modulo}"]`);
        if (navEl) navEl.style.display = activo ? '' : 'none';
    });

    // Ocultar grupos que queden completamente vacíos
    document.querySelectorAll('.nav-group').forEach(grupo => {
        const items = grupo.querySelectorAll('.nav-item');
        const hayVisible = [...items].some(el => el.style.display !== 'none');
        // Mantener el grupo visible solo si tiene ítems visibles
        // (no ocultamos el grupo Inicio ni Sistema)
        const esSistema  = grupo.querySelector('.nav-group-title')?.textContent?.includes('SISTEMA');
        const esInicio   = grupo.classList.contains('nav-group-solo');
        if (!hayVisible && !esSistema && !esInicio) {
            grupo.style.display = 'none';
        } else {
            grupo.style.display = '';
        }
    });
}

// ── Color picker ─────────────────────────────────────────────
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

// ── Toggles de módulos ───────────────────────────────────────
function audRenderizarToggleModulos(containerId, categoria, modulosActivos) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const lista    = AUD_MODULOS[categoria] || AUD_MODULOS.primera;
    const defaults = modulosActivos || audModulosDefecto(categoria);

    // Agrupar por grupo
    const grupos = {};
    lista.forEach(m => {
        if (!grupos[m.grupo]) grupos[m.grupo] = [];
        grupos[m.grupo].push(m);
    });

    container.innerHTML = `
        <div class="aud-modulos-header">Módulos activos para este cliente</div>
        <div class="aud-modulos-grid">
            ${Object.entries(grupos).map(([grupo, modulos]) => `
                <div class="aud-mod-grupo">
                    <div class="aud-mod-grupo-titulo">${grupo}</div>
                    ${modulos.map(m => `
                        <label class="aud-mod-toggle">
                            <input type="checkbox" name="modulo_${m.id}" value="${m.id}"
                                   ${defaults[m.id] ? 'checked' : ''}>
                            <span>${m.label}</span>
                        </label>
                    `).join('')}
                </div>
            `).join('')}
        </div>
        <div class="aud-modulos-hint">Puedes cambiar estos ajustes en cualquier momento.</div>
    `;
}

function audLeerModulosFormulario(categoria) {
    const lista = AUD_MODULOS[categoria] || AUD_MODULOS.primera;
    const result = {};
    lista.forEach(m => {
        const cb = document.querySelector(`input[name="modulo_${m.id}"]`);
        result[m.id] = cb ? cb.checked : false;
    });
    return result;
}

// Actualiza los toggles cuando el usuario cambia la categoría
function audOnCategoriaChange(categoria) {
    audRenderizarToggleModulos('empModulosContainer', categoria, null);
}

// ── Tarjeta de cliente para el selector ─────────────────────
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

// ── Indicador de cliente activo en el topbar ─────────────────
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

// Expose
window.AUD_COLORES                  = AUD_COLORES;
window.AUD_MODULOS                  = AUD_MODULOS;
window.audModulosDefecto            = audModulosDefecto;
window.audAplicarModulos            = audAplicarModulos;
window.audRenderizarColorPicker     = audRenderizarColorPicker;
window.audSeleccionarColor          = audSeleccionarColor;
window.audRenderizarToggleModulos   = audRenderizarToggleModulos;
window.audLeerModulosFormulario     = audLeerModulosFormulario;
window.audOnCategoriaChange         = audOnCategoriaChange;
window.audRenderizarTarjeta         = audRenderizarTarjeta;
window.audActualizarIndicadorCliente = audActualizarIndicadorCliente;
