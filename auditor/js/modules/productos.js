'use strict';
// ─────────────────────────────────────────────────────────────────────────────
//  PRODUCTOS Y SERVICIOS — Catálogo por empresa
// ─────────────────────────────────────────────────────────────────────────────

const PROD_KEY = 'core_productos';

const PROD_TIPOS = [
    { id: 'servicio',    label: 'Servicio',    icon: '⚙️' },
    { id: 'mercaderia',  label: 'Mercadería',  icon: '📦' },
    { id: 'insumo',      label: 'Insumo',      icon: '🔧' },
    { id: 'activo_fijo', label: 'Activo Fijo', icon: '🏗' },
];

const PROD_UNIDADES = ['Un','Hr','Kg','Lt','M2','M3','Ml','Cm','Gl','Cj','Par','Set'];

// ── CRUD ──────────────────────────────────────────────────────────────────────

function getProductos() {
    try { return JSON.parse(localStorage.getItem(PROD_KEY) || '[]'); }
    catch(e) { return []; }
}

function saveProductos(arr) {
    localStorage.setItem(PROD_KEY, JSON.stringify(arr));
}

function prodGetById(id) {
    return getProductos().find(function(p){ return String(p.id) === String(id); }) || null;
}

function _prodNuevoId() {
    return 'p' + Date.now();
}

// ── RENDER ────────────────────────────────────────────────────────────────────

function renderProductos() {
    var view = document.getElementById('view-productos');
    if (!view) return;

    if (!document.getElementById('prod-tabla-body')) {
        view.innerHTML =
            '<div class="card" style="margin-bottom:16px;">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">' +
                    '<div>' +
                        '<h2 style="margin:0 0 4px;">Productos y Servicios</h2>' +
                        '<p style="color:var(--text-muted);font-size:12px;margin:0;">Catálogo del cliente — base para compras, ventas e inventario</p>' +
                    '</div>' +
                    '<button class="btn btn-primary" id="prod-btn-agregar">+ Agregar</button>' +
                '</div>' +
                '<div id="prod-kpis" style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:16px;"></div>' +
            '</div>' +
            '<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">' +
                '<input id="prod-busqueda" class="input" style="flex:1;min-width:180px;" placeholder="Buscar por nombre, código o categoría…">' +
                '<select id="prod-filtro-tipo" class="input" style="width:auto;">' +
                    '<option value="todos">Todos los tipos</option>' +
                    PROD_TIPOS.map(function(t){ return '<option value="' + t.id + '">' + t.icon + ' ' + t.label + '</option>'; }).join('') +
                '</select>' +
            '</div>' +
            '<div class="card" style="overflow-x:auto;padding:0;">' +
                '<table style="width:100%;border-collapse:collapse;font-size:13px;">' +
                    '<thead>' +
                        '<tr style="border-bottom:2px solid var(--divider);background:var(--surface);">' +
                            '<th style="padding:10px 12px;text-align:left;font-size:11px;color:var(--text-muted);">CÓDIGO</th>' +
                            '<th style="padding:10px 12px;text-align:left;font-size:11px;color:var(--text-muted);">NOMBRE</th>' +
                            '<th style="padding:10px 12px;text-align:left;font-size:11px;color:var(--text-muted);">TIPO</th>' +
                            '<th style="padding:10px 12px;text-align:left;font-size:11px;color:var(--text-muted);">PROVEEDOR</th>' +
                            '<th style="padding:10px 12px;text-align:right;font-size:11px;color:var(--text-muted);">COSTO</th>' +
                            '<th style="padding:10px 12px;text-align:right;font-size:11px;color:var(--text-muted);">PRECIO VENTA</th>' +
                            '<th style="padding:10px 12px;text-align:right;font-size:11px;color:var(--text-muted);">MARGEN</th>' +
                            '<th style="padding:10px 12px;text-align:center;font-size:11px;color:var(--text-muted);">IVA</th>' +
                            '<th style="padding:10px 12px;text-align:center;font-size:11px;color:var(--text-muted);">ESTADO</th>' +
                            '<th style="padding:10px 12px;"></th>' +
                        '</tr>' +
                    '</thead>' +
                    '<tbody id="prod-tabla-body"></tbody>' +
                '</table>' +
                '<div id="prod-tabla-vacia" style="display:none;text-align:center;padding:48px 24px;color:var(--text-muted);">' +
                    '<div style="font-size:36px;margin-bottom:10px;">📦</div>' +
                    '<p id="prod-vacia-msg">Sin productos aún. Agrega el primer ítem del catálogo.</p>' +
                '</div>' +
            '</div>';

        document.getElementById('prod-btn-agregar').addEventListener('click', function(){ prodAbrirForm(null); });
        document.getElementById('prod-busqueda').addEventListener('input', function(){ window._prodBusqueda = this.value; _prodActualizarTabla(); });
        document.getElementById('prod-filtro-tipo').addEventListener('change', function(){ window._prodFiltroTipo = this.value; _prodActualizarTabla(); });
    }

    _prodActualizarKpis();
    _prodActualizarTabla();
}

function _prodActualizarKpis() {
    var kpisEl = document.getElementById('prod-kpis');
    if (!kpisEl) return;
    var productos  = getProductos();
    var filtroTipo = window._prodFiltroTipo || 'todos';

    var html = '<div onclick="prodFiltrarTipo(\'todos\')" style="cursor:pointer;padding:10px;border-radius:8px;border:2px solid ' +
        (filtroTipo === 'todos' ? 'var(--accent)' : 'var(--divider)') + ';text-align:center;">' +
        '<div style="font-size:18px;font-weight:700;">' + productos.length + '</div>' +
        '<div style="font-size:11px;color:var(--text-muted);">Total</div></div>';

    PROD_TIPOS.forEach(function(t) {
        var cnt = productos.filter(function(p){ return p.tipo === t.id; }).length;
        html += '<div onclick="prodFiltrarTipo(\'' + t.id + '\')" style="cursor:pointer;padding:10px;border-radius:8px;border:2px solid ' +
            (filtroTipo === t.id ? 'var(--accent)' : 'var(--divider)') + ';text-align:center;">' +
            '<div style="font-size:14px;">' + t.icon + '</div>' +
            '<div style="font-size:18px;font-weight:700;">' + cnt + '</div>' +
            '<div style="font-size:11px;color:var(--text-muted);">' + t.label + '</div></div>';
    });

    kpisEl.innerHTML = html;
}

function _calcMargen(costo, precio) {
    if (!precio || precio <= 0) return null;
    if (!costo  || costo  <= 0) return null;
    return Math.round(((precio - costo) / precio) * 100);
}

function _prodActualizarTabla() {
    var tbody  = document.getElementById('prod-tabla-body');
    var vacia  = document.getElementById('prod-tabla-vacia');
    var msgEl  = document.getElementById('prod-vacia-msg');
    if (!tbody) return;

    var productos  = getProductos();
    var filtroTipo = window._prodFiltroTipo || 'todos';
    var busqueda   = (window._prodBusqueda || '').toLowerCase();

    var filtrados = productos.filter(function(p) {
        var matchTipo = filtroTipo === 'todos' || p.tipo === filtroTipo;
        var matchBusc = !busqueda ||
            (p.nombre          || '').toLowerCase().indexOf(busqueda) >= 0 ||
            (p.codigo          || '').toLowerCase().indexOf(busqueda) >= 0 ||
            (p.categoria       || '').toLowerCase().indexOf(busqueda) >= 0 ||
            (p.proveedor_nombre|| '').toLowerCase().indexOf(busqueda) >= 0;
        return matchTipo && matchBusc;
    });

    if (filtrados.length === 0) {
        tbody.innerHTML = '';
        if (vacia) vacia.style.display = 'block';
        if (msgEl) msgEl.textContent = productos.length === 0
            ? 'Sin productos aún. Agrega el primer ítem del catálogo.'
            : 'Sin resultados para la búsqueda.';
        return;
    }

    if (vacia) vacia.style.display = 'none';

    var html = '';
    filtrados.forEach(function(p) {
        var tipoInfo  = PROD_TIPOS.filter(function(t){ return t.id === p.tipo; })[0] || PROD_TIPOS[0];
        var costoStr  = p.precio_costo > 0 ? '$' + Number(p.precio_costo).toLocaleString('es-CL') : '—';
        var ventaStr  = p.precio_venta > 0 ? '$' + Number(p.precio_venta).toLocaleString('es-CL') + (p.unidad ? ' /' + p.unidad : '') : '—';
        var margen    = _calcMargen(p.precio_costo, p.precio_venta);
        var margenStr, margenColor;
        if (margen === null) {
            margenStr   = '—';
            margenColor = 'var(--text-muted)';
        } else if (margen >= 30) {
            margenStr   = margen + '%';
            margenColor = '#166534';
        } else if (margen >= 10) {
            margenStr   = margen + '%';
            margenColor = '#92400e';
        } else {
            margenStr   = margen + '%';
            margenColor = '#991b1b';
        }

        var ivaBg    = p.iva === 'exento' ? '#f3f4f6' : '#dbeafe';
        var ivaColor = p.iva === 'exento' ? '#6b7280'  : '#1e40af';
        var ivaLabel = p.iva === 'exento' ? 'Exento'   : 'Afecto';
        var staBg    = p.activo !== false  ? '#dcfce7'  : '#fee2e2';
        var staColor = p.activo !== false  ? '#166534'  : '#991b1b';
        var staLabel = p.activo !== false  ? 'Activo'   : 'Inactivo';
        var opacity  = p.activo !== false  ? '' : 'opacity:.55;';
        var provStr  = p.proveedor_nombre || '—';

        html +=
            '<tr style="border-bottom:1px solid var(--divider);' + opacity + '">' +
                '<td style="padding:10px 12px;font-family:monospace;font-size:12px;color:var(--text-muted);">' + (p.codigo || '—') + '</td>' +
                '<td style="padding:10px 12px;">' +
                    '<div style="font-weight:500;">' + (p.nombre || '') + '</div>' +
                    (p.descripcion ? '<div style="font-size:11px;color:var(--text-muted);margin-top:2px;max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + p.descripcion + '</div>' : '') +
                '</td>' +
                '<td style="padding:10px 12px;white-space:nowrap;">' + tipoInfo.icon + ' ' + tipoInfo.label + '</td>' +
                '<td style="padding:10px 12px;font-size:12px;color:var(--text-muted);">' + provStr + '</td>' +
                '<td style="padding:10px 12px;text-align:right;font-family:monospace;font-size:12px;">' + costoStr + '</td>' +
                '<td style="padding:10px 12px;text-align:right;font-family:monospace;font-weight:500;">' + ventaStr + '</td>' +
                '<td style="padding:10px 12px;text-align:right;font-weight:700;color:' + margenColor + ';">' + margenStr + '</td>' +
                '<td style="padding:10px 12px;text-align:center;">' +
                    '<span style="font-size:11px;padding:2px 8px;border-radius:10px;font-weight:600;background:' + ivaBg + ';color:' + ivaColor + ';">' + ivaLabel + '</span>' +
                '</td>' +
                '<td style="padding:10px 12px;text-align:center;">' +
                    '<span style="font-size:11px;padding:2px 8px;border-radius:10px;font-weight:600;background:' + staBg + ';color:' + staColor + ';">' + staLabel + '</span>' +
                '</td>' +
                '<td style="padding:10px 12px;text-align:right;white-space:nowrap;">' +
                    '<button class="btn btn-sm prod-btn-editar" data-id="' + p.id + '" style="margin-right:4px;" title="Editar">✏️</button>' +
                    '<button class="btn btn-sm prod-btn-eliminar" data-id="' + p.id + '" style="color:var(--error);" title="Eliminar">🗑</button>' +
                '</td>' +
            '</tr>';
    });

    tbody.innerHTML = html;

    tbody.querySelectorAll('.prod-btn-editar').forEach(function(btn) {
        btn.addEventListener('click', function(){ prodAbrirForm(this.dataset.id); });
    });
    tbody.querySelectorAll('.prod-btn-eliminar').forEach(function(btn) {
        btn.addEventListener('click', function(){ prodEliminar(this.dataset.id); });
    });
}

// ── FILTROS ───────────────────────────────────────────────────────────────────

function prodFiltrarTipo(tipo) {
    window._prodFiltroTipo = tipo;
    var sel = document.getElementById('prod-filtro-tipo');
    if (sel) sel.value = tipo;
    _prodActualizarKpis();
    _prodActualizarTabla();
}

// ── FORMULARIO ────────────────────────────────────────────────────────────────

function prodAbrirForm(id) {
    document.getElementById('prod-drawer-overlay')?.remove();

    var prod = id ? prodGetById(id) : null;
    var esNuevo = !prod;

    var cats = getProductos().map(function(p){ return p.categoria; }).filter(Boolean);
    cats = cats.filter(function(v,i){ return cats.indexOf(v) === i; });

    var proveedores = _getProveedores();
    var cuentasArr  = Object.keys(window.PLAN_CUENTAS || {}).sort();

    var optTipos = PROD_TIPOS.map(function(t) {
        var sel = prod && prod.tipo === t.id ? ' selected' : (!prod && t.id === 'servicio' ? ' selected' : '');
        return '<option value="' + t.id + '"' + sel + '>' + t.icon + ' ' + t.label + '</option>';
    }).join('');

    var optUnidades = PROD_UNIDADES.map(function(u) {
        return '<option value="' + u + '"' + (prod && prod.unidad === u ? ' selected' : '') + '>' + u + '</option>';
    }).join('');

    var optProveedores = '<option value="">Sin proveedor asignado</option>' + proveedores.map(function(c) {
        return '<option value="' + c.id + '"' + (prod && prod.proveedor_id === String(c.id) ? ' selected' : '') + '>' + c.nombre + '</option>';
    }).join('');

    var optCuentaVenta  = '<option value="">Sin cuenta asignada</option>' + cuentasArr.map(function(n){
        return '<option value="' + n + '"' + (prod && prod.cuenta_venta === n ? ' selected' : '') + '>' + n + '</option>';
    }).join('');

    var optCuentaCompra = '<option value="">Sin cuenta asignada</option>' + cuentasArr.map(function(n){
        return '<option value="' + n + '"' + (prod && prod.cuenta_compra === n ? ' selected' : '') + '>' + n + '</option>';
    }).join('');

    var datalist = cats.map(function(c){ return '<option value="' + c + '">'; }).join('');

    var margenInicial = '';
    if (prod && prod.precio_costo > 0 && prod.precio_venta > 0) {
        var mi = _calcMargen(prod.precio_costo, prod.precio_venta);
        if (mi !== null) margenInicial = mi + '%';
    }

    // Tipo seleccionado para el selector visual
    var tipoActivo = (prod && prod.tipo) || 'servicio';

    // ── Overlay + Drawer ─────────────────────────────────────────────────────
    var overlay = document.createElement('div');
    overlay.id = 'prod-drawer-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9000;display:flex;justify-content:flex-end;';

    // Fondo semitransparente
    var backdrop = document.createElement('div');
    backdrop.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,.3);';
    backdrop.addEventListener('click', prodCerrarForm);

    // Panel drawer
    var drawer = document.createElement('div');
    drawer.style.cssText = [
        'position:relative;z-index:1;',
        'width:480px;max-width:100vw;',
        'height:100%;',
        'background:var(--card);',
        'display:flex;flex-direction:column;',
        'box-shadow:-4px 0 24px rgba(0,0,0,.18);',
        'transform:translateX(100%);transition:transform .22s cubic-bezier(.4,0,.2,1);',
    ].join('');

    drawer.innerHTML =
        // ── Header fijo ──
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid var(--divider);flex-shrink:0;">' +
            '<div>' +
                '<div style="font-size:11px;font-weight:700;letter-spacing:.08em;color:var(--text-muted);text-transform:uppercase;margin-bottom:2px;">' +
                    (esNuevo ? 'Nuevo ítem' : 'Editar ítem') +
                '</div>' +
                '<h3 style="margin:0;font-size:17px;" id="pf-titulo-drawer">' +
                    (prod ? (prod.nombre || 'Sin nombre') : 'Producto o servicio') +
                '</h3>' +
            '</div>' +
            '<button id="prod-btn-cerrar" style="background:none;border:none;cursor:pointer;padding:6px;border-radius:8px;color:var(--text-muted);font-size:20px;line-height:1;display:flex;align-items:center;justify-content:center;" title="Cerrar">✕</button>' +
        '</div>' +

        // ── Cuerpo scrolleable ──
        '<div style="flex:1;overflow-y:auto;padding:24px;" id="pf-body">' +

            // ── Selector visual de tipo ──
            '<div style="margin-bottom:24px;">' +
                '<div style="font-size:11px;font-weight:700;letter-spacing:.08em;color:var(--text-muted);margin-bottom:10px;">TIPO</div>' +
                '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;" id="pf-tipo-cards">' +
                    PROD_TIPOS.map(function(t) {
                        var activo = t.id === tipoActivo;
                        return '<button type="button" class="pf-tipo-card" data-tipo="' + t.id + '" style="' +
                            'border:2px solid ' + (activo ? 'var(--accent)' : 'var(--divider)') + ';' +
                            'background:' + (activo ? 'var(--accent-soft,#eff6ff)' : 'var(--surface)') + ';' +
                            'border-radius:10px;padding:12px 6px;cursor:pointer;text-align:center;transition:all .15s;' +
                            '">' +
                            '<div style="font-size:22px;margin-bottom:4px;">' + t.icon + '</div>' +
                            '<div style="font-size:11px;font-weight:600;color:' + (activo ? 'var(--accent)' : 'var(--text)') + ';">' + t.label + '</div>' +
                        '</button>';
                    }).join('') +
                '</div>' +
                '<input type="hidden" id="pf-tipo" value="' + tipoActivo + '">' +
            '</div>' +

            // ── Nombre + descripción ──
            '<div style="margin-bottom:20px;">' +
                '<label style="font-size:12px;font-weight:600;display:block;margin-bottom:6px;">Nombre <span style="color:var(--error);">*</span></label>' +
                '<input id="pf-nombre" class="input" value="' + (prod ? _esc(prod.nombre) : '') + '" placeholder="Ej: Consultoría contable mensual" style="margin-bottom:10px;">' +
                '<label style="font-size:12px;font-weight:600;display:block;margin-bottom:6px;">Descripción <span style="font-size:11px;font-weight:400;color:var(--text-muted);">(aparece en documentos)</span></label>' +
                '<textarea id="pf-descripcion" class="input" rows="3" style="resize:vertical;" placeholder="Detalle adicional del ítem…">' + (prod ? _esc(prod.descripcion || '') : '') + '</textarea>' +
            '</div>' +

            // ── Código + Categoría ──
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">' +
                '<div>' +
                    '<label style="font-size:12px;font-weight:600;display:block;margin-bottom:6px;">Código interno</label>' +
                    '<input id="pf-codigo" class="input" value="' + (prod ? _esc(prod.codigo || '') : '') + '" placeholder="SRV-001">' +
                '</div>' +
                '<div>' +
                    '<label style="font-size:12px;font-weight:600;display:block;margin-bottom:6px;">Categoría</label>' +
                    '<input id="pf-categoria" class="input" value="' + (prod ? _esc(prod.categoria || '') : '') + '" placeholder="Ej: Servicios profesionales" list="pf-cat-list">' +
                    '<datalist id="pf-cat-list">' + datalist + '</datalist>' +
                '</div>' +
            '</div>' +

            // ── Divider ──
            '<div style="height:1px;background:var(--divider);margin:0 0 20px;"></div>' +

            // ── Precios ──
            '<div style="font-size:11px;font-weight:700;letter-spacing:.08em;color:var(--text-muted);margin-bottom:12px;">PRECIOS Y RENTABILIDAD</div>' +

            // Tarjeta de margen prominente
            '<div id="pf-margen-card" style="border-radius:12px;padding:14px 16px;margin-bottom:14px;background:var(--surface);border:1px solid var(--divider);display:flex;align-items:center;justify-content:space-between;">' +
                '<div>' +
                    '<div style="font-size:11px;color:var(--text-muted);font-weight:600;margin-bottom:2px;">MARGEN BRUTO</div>' +
                    '<div id="pf-margen-valor" style="font-size:28px;font-weight:800;line-height:1;">' +
                        (margenInicial
                            ? '<span style="color:' + _margenColor(_calcMargen(prod && prod.precio_costo, prod && prod.precio_venta)) + ';">' + margenInicial + '</span>'
                            : '<span style="color:var(--text-muted);font-size:14px;font-weight:400;">Ingresa costo y precio</span>') +
                    '</div>' +
                '</div>' +
                '<div id="pf-margen-barra" style="width:80px;height:8px;border-radius:4px;background:var(--divider);overflow:hidden;">' +
                    '<div id="pf-margen-barra-fill" style="height:100%;width:0%;border-radius:4px;background:var(--divider);transition:width .3s,background .3s;"></div>' +
                '</div>' +
            '</div>' +

            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">' +
                '<div>' +
                    '<label style="font-size:12px;font-weight:600;display:block;margin-bottom:6px;">Precio de costo <span style="font-size:11px;font-weight:400;color:var(--text-muted);">neto</span></label>' +
                    '<div style="position:relative;">' +
                        '<span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-weight:600;">$</span>' +
                        '<input id="pf-costo" class="input" type="number" min="0" style="padding-left:24px;" value="' + (prod && prod.precio_costo > 0 ? prod.precio_costo : '') + '" placeholder="0">' +
                    '</div>' +
                '</div>' +
                '<div>' +
                    '<label style="font-size:12px;font-weight:600;display:block;margin-bottom:6px;">Precio de venta <span style="font-size:11px;font-weight:400;color:var(--text-muted);">neto</span></label>' +
                    '<div style="position:relative;">' +
                        '<span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-weight:600;">$</span>' +
                        '<input id="pf-venta" class="input" type="number" min="0" style="padding-left:24px;" value="' + (prod && prod.precio_venta > 0 ? prod.precio_venta : '') + '" placeholder="0">' +
                    '</div>' +
                '</div>' +
            '</div>' +

            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">' +
                '<div>' +
                    '<label style="font-size:12px;font-weight:600;display:block;margin-bottom:6px;">IVA</label>' +
                    '<select id="pf-iva" class="input">' +
                        '<option value="afecto"' + (prod && prod.iva !== 'exento' ? ' selected' : '') + '>Afecto (19%)</option>' +
                        '<option value="exento"' + (prod && prod.iva === 'exento'  ? ' selected' : '') + '>Exento</option>' +
                    '</select>' +
                '</div>' +
                '<div>' +
                    '<label style="font-size:12px;font-weight:600;display:block;margin-bottom:6px;">Unidad de medida</label>' +
                    '<select id="pf-unidad" class="input">' + optUnidades + '</select>' +
                '</div>' +
            '</div>' +

            // ── Divider ──
            '<div style="height:1px;background:var(--divider);margin:0 0 20px;"></div>' +

            // ── Proveedor ──
            '<div style="font-size:11px;font-weight:700;letter-spacing:.08em;color:var(--text-muted);margin-bottom:12px;">PROVEEDOR HABITUAL</div>' +
            '<div style="margin-bottom:20px;">' +
                '<select id="pf-proveedor" class="input">' + optProveedores + '</select>' +
                (proveedores.length === 0
                    ? '<div style="display:flex;align-items:center;gap:6px;margin-top:6px;font-size:11px;color:var(--text-muted);">' +
                        '<span>ℹ️</span><span>Agrega proveedores en <strong>Clientes / Proveedores</strong> para vincularlos aquí.</span>' +
                      '</div>'
                    : '') +
            '</div>' +

            // ── Divider ──
            '<div style="height:1px;background:var(--divider);margin:0 0 20px;"></div>' +

            // ── Cuentas contables ──
            '<div style="font-size:11px;font-weight:700;letter-spacing:.08em;color:var(--text-muted);margin-bottom:12px;">CUENTAS CONTABLES</div>' +
            '<div style="display:grid;grid-template-columns:1fr;gap:10px;margin-bottom:20px;">' +
                '<div>' +
                    '<label style="font-size:12px;font-weight:600;display:block;margin-bottom:6px;">Cuenta de venta / ingreso</label>' +
                    '<select id="pf-cuenta-venta" class="input">' + optCuentaVenta + '</select>' +
                '</div>' +
                '<div>' +
                    '<label style="font-size:12px;font-weight:600;display:block;margin-bottom:6px;">Cuenta de compra / costo</label>' +
                    '<select id="pf-cuenta-compra" class="input">' + optCuentaCompra + '</select>' +
                '</div>' +
            '</div>' +

            // ── Estado ──
            '<label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:14px;border:1px solid var(--divider);border-radius:10px;margin-bottom:8px;">' +
                '<input type="checkbox" id="pf-activo"' + (prod && prod.activo === false ? '' : ' checked') + ' style="width:16px;height:16px;cursor:pointer;">' +
                '<div>' +
                    '<div style="font-size:13px;font-weight:600;">Ítem activo</div>' +
                    '<div style="font-size:11px;color:var(--text-muted);">Los ítems inactivos no aparecen en selectors de compras ni ventas</div>' +
                '</div>' +
            '</label>' +

        '</div>' + // fin body

        // ── Footer fijo ──
        '<div style="padding:16px 24px;border-top:1px solid var(--divider);display:flex;justify-content:space-between;align-items:center;flex-shrink:0;gap:8px;">' +
            '<button id="prod-btn-cancelar" class="btn btn-secondary">Cancelar</button>' +
            '<button id="prod-btn-guardar"  class="btn btn-primary" style="min-width:120px;">💾 Guardar</button>' +
        '</div>';

    overlay.appendChild(backdrop);
    overlay.appendChild(drawer);
    document.body.appendChild(overlay);

    // Animar entrada
    requestAnimationFrame(function(){
        requestAnimationFrame(function(){
            drawer.style.transform = 'translateX(0)';
        });
    });

    // Actualizar título del drawer al escribir nombre
    document.getElementById('pf-nombre').addEventListener('input', function() {
        var t = document.getElementById('pf-titulo-drawer');
        if (t) t.textContent = this.value.trim() || (esNuevo ? 'Producto o servicio' : 'Sin nombre');
    });

    // Selector visual de tipo
    document.getElementById('pf-tipo-cards').addEventListener('click', function(e) {
        var card = e.target.closest('.pf-tipo-card');
        if (!card) return;
        var tipo = card.dataset.tipo;
        document.getElementById('pf-tipo').value = tipo;
        document.querySelectorAll('.pf-tipo-card').forEach(function(c) {
            var activo = c.dataset.tipo === tipo;
            c.style.border = '2px solid ' + (activo ? 'var(--accent)' : 'var(--divider)');
            c.style.background = activo ? 'var(--accent-soft,#eff6ff)' : 'var(--surface)';
            c.querySelector('div:last-child').style.color = activo ? 'var(--accent)' : 'var(--text)';
        });
    });

    // Margen en tiempo real
    function _actualizarMargen() {
        var costo  = parseFloat(document.getElementById('pf-costo').value) || 0;
        var precio = parseFloat(document.getElementById('pf-venta').value) || 0;
        var valEl  = document.getElementById('pf-margen-valor');
        var fillEl = document.getElementById('pf-margen-barra-fill');
        if (!valEl) return;
        var m = _calcMargen(costo, precio);
        if (m === null) {
            valEl.innerHTML = '<span style="color:var(--text-muted);font-size:14px;font-weight:400;">Ingresa costo y precio</span>';
            if (fillEl) { fillEl.style.width = '0%'; fillEl.style.background = 'var(--divider)'; }
            return;
        }
        var color = _margenColor(m);
        valEl.innerHTML = '<span style="color:' + color + ';">' + m + '%</span>';
        if (fillEl) {
            fillEl.style.width  = Math.min(m, 100) + '%';
            fillEl.style.background = color;
        }
    }
    document.getElementById('pf-costo').addEventListener('input', _actualizarMargen);
    document.getElementById('pf-venta').addEventListener('input', _actualizarMargen);

    // Eventos
    document.getElementById('prod-btn-cerrar').addEventListener('click',   prodCerrarForm);
    document.getElementById('prod-btn-cancelar').addEventListener('click', prodCerrarForm);
    document.getElementById('prod-btn-guardar').addEventListener('click',  function(){ prodGuardar(prod ? prod.id : null); });

    setTimeout(function(){ document.getElementById('pf-nombre').focus(); }, 260);
}

function _esc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function _margenColor(m) {
    if (m === null || m === undefined) return 'var(--text-muted)';
    return m >= 30 ? '#166534' : m >= 10 ? '#92400e' : '#991b1b';
}

function _getProveedores() {
    try {
        var contactos = JSON.parse(localStorage.getItem('core_contactos') || '[]');
        return contactos.filter(function(c){ return c.activo !== false && (c.tipo === 'proveedor' || c.tipo === 'ambos'); });
    } catch(e) { return []; }
}

function prodCerrarForm() {
    var overlay = document.getElementById('prod-drawer-overlay');
    if (!overlay) return;
    var drawer = overlay.querySelector('div[style*="translateX"]') || overlay.lastChild;
    if (drawer && drawer.style) {
        drawer.style.transform = 'translateX(100%)';
        setTimeout(function(){ overlay.remove(); }, 230);
    } else {
        overlay.remove();
    }
}

function prodGuardar(id) {
    var nombreEl = document.getElementById('pf-nombre');
    if (!nombreEl) return;
    var nombre = nombreEl.value.trim();
    if (!nombre) { mostrarToast('El nombre es obligatorio.', 'error'); return; }

    var provSel = document.getElementById('pf-proveedor');
    var provId  = provSel ? provSel.value : '';
    var provNombre = '';
    if (provId) {
        var provs = _getProveedores();
        var prov  = provs.filter(function(c){ return String(c.id) === String(provId); })[0];
        if (prov) provNombre = prov.nombre || prov.razon_social || '';
    }

    var prod = {
        id:              id ? String(id) : _prodNuevoId(),
        nombre:          nombre,
        descripcion:    (document.getElementById('pf-descripcion').value || '').trim(),
        codigo:         (document.getElementById('pf-codigo').value      || '').trim(),
        tipo:            document.getElementById('pf-tipo').value         || 'servicio',
        categoria:      (document.getElementById('pf-categoria').value   || '').trim(),
        iva:             document.getElementById('pf-iva').value          || 'afecto',
        precio_costo:   parseFloat(document.getElementById('pf-costo').value)  || 0,
        precio_venta:   parseFloat(document.getElementById('pf-venta').value)  || 0,
        unidad:          document.getElementById('pf-unidad').value       || 'Un',
        proveedor_id:    provId,
        proveedor_nombre: provNombre,
        cuenta_venta:    document.getElementById('pf-cuenta-venta').value  || '',
        cuenta_compra:   document.getElementById('pf-cuenta-compra').value || '',
        activo:          document.getElementById('pf-activo').checked,
        created_at:      id ? undefined : Date.now(),
        updated_at:      Date.now(),
    };
    if (!prod.created_at) delete prod.created_at;

    var arr = getProductos();
    var idx = arr.findIndex(function(p){ return String(p.id) === String(id); });
    if (idx >= 0) {
        prod.created_at = arr[idx].created_at;
        arr[idx] = prod;
    } else {
        prod.created_at = Date.now();
        arr.push(prod);
    }

    saveProductos(arr);
    prodCerrarForm();
    _prodActualizarKpis();
    _prodActualizarTabla();
    mostrarToast(idx >= 0 ? 'Producto actualizado.' : 'Producto agregado.', 'ok');
}

function prodEliminar(id) {
    mostrarConfirm('¿Eliminar este producto del catálogo?', () => {
        saveProductos(getProductos().filter(function(p){ return String(p.id) !== String(id); }));
        _prodActualizarKpis();
        _prodActualizarTabla();
        mostrarToast('Producto eliminado.', 'ok');
    });
}

// ── Selector reutilizable (para compras/ventas) ───────────────────────────────

function prodAbrirSelector(callback, tipoFiltro) {
    var todos = getProductos().filter(function(p){ return p.activo !== false && (!tipoFiltro || p.tipo === tipoFiltro); });
    window._prodSelectorCallback = callback;
    window._prodSelectorItems    = todos;

    var modal = document.createElement('div');
    modal.id        = 'prod-selector-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML =
        '<div class="modal-box" style="max-width:460px;width:95%;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">' +
                '<h3 style="margin:0;">Seleccionar producto / servicio</h3>' +
                '<button id="prod-sel-cerrar" class="btn btn-sm">✕</button>' +
            '</div>' +
            '<input id="prod-sel-busq" class="input" style="margin-bottom:10px;" placeholder="Buscar…">' +
            '<div id="prod-sel-list" style="max-height:340px;overflow-y:auto;"></div>' +
        '</div>';

    document.body.appendChild(modal);
    modal.style.display = 'flex';
    modal.addEventListener('click', function(e){ if (e.target === modal) prodCerrarSelector(); });
    document.getElementById('prod-sel-cerrar').addEventListener('click', prodCerrarSelector);
    document.getElementById('prod-sel-busq').addEventListener('input',   function(){ prodFiltrarSelector(this.value); });

    _prodRenderSelectorItems(todos);
    setTimeout(function(){ document.getElementById('prod-sel-busq').focus(); }, 50);
}

function _prodRenderSelectorItems(lista) {
    var cont = document.getElementById('prod-sel-list');
    if (!cont) return;
    if (!lista.length) { cont.innerHTML = '<p style="text-align:center;padding:20px;color:var(--text-muted);">Sin resultados</p>'; return; }

    var html = '';
    lista.forEach(function(p) {
        var tipo   = PROD_TIPOS.filter(function(t){ return t.id === p.tipo; })[0] || PROD_TIPOS[0];
        var precio = p.precio_venta > 0
            ? '$' + Number(p.precio_venta).toLocaleString('es-CL') + '/' + (p.unidad||'Un') + ' · ' + (p.iva==='exento'?'Exento':'+ IVA')
            : '';
        html +=
            '<div class="prod-sel-item" data-id="' + p.id + '" style="padding:10px 12px;border-bottom:1px solid var(--divider);cursor:pointer;">' +
                '<div style="display:flex;justify-content:space-between;">' +
                    '<span style="font-weight:500;">' + p.nombre + (p.codigo ? ' <span style="font-size:11px;color:var(--text-muted);">(' + p.codigo + ')</span>' : '') + '</span>' +
                    '<span style="font-size:11px;color:var(--text-muted);">' + tipo.icon + ' ' + tipo.label + '</span>' +
                '</div>' +
                (precio ? '<div style="font-size:12px;color:var(--text-muted);margin-top:2px;">' + precio + '</div>' : '') +
                (p.descripcion ? '<div style="font-size:11px;color:var(--text-muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + p.descripcion + '</div>' : '') +
            '</div>';
    });
    cont.innerHTML = html;
    cont.querySelectorAll('.prod-sel-item').forEach(function(el) {
        el.addEventListener('click', function(){ prodSeleccionarItem(this.dataset.id); });
    });
}

function prodFiltrarSelector(val) {
    var q = val.toLowerCase();
    var f = (window._prodSelectorItems || []).filter(function(p){
        return p.nombre.toLowerCase().indexOf(q) >= 0 ||
               (p.codigo    || '').toLowerCase().indexOf(q) >= 0 ||
               (p.categoria || '').toLowerCase().indexOf(q) >= 0;
    });
    _prodRenderSelectorItems(f);
}

function prodSeleccionarItem(id) {
    var prod = prodGetById(id);
    var cb = window._prodSelectorCallback;
    prodCerrarSelector();
    if (prod && typeof cb === 'function') cb(prod);
}

function prodCerrarSelector() {
    var m = document.getElementById('prod-selector-modal');
    if (m) m.remove();
    window._prodSelectorCallback = null;
    window._prodSelectorItems    = null;
}

// ── Expose ────────────────────────────────────────────────────────────────────
window.getProductos          = getProductos;
window.prodGetById           = prodGetById;
window.renderProductos       = renderProductos;
window.prodFiltrarTipo       = prodFiltrarTipo;
window.prodGuardar           = prodGuardar;
window.prodEliminar          = prodEliminar;
window.prodAbrirForm         = prodAbrirForm;
window.prodCerrarForm        = prodCerrarForm;
window.prodAbrirSelector     = prodAbrirSelector;
window.prodCerrarSelector    = prodCerrarSelector;
window.prodSeleccionarItem   = prodSeleccionarItem;
window.prodFiltrarSelector   = prodFiltrarSelector;
window.PROD_TIPOS            = PROD_TIPOS;
