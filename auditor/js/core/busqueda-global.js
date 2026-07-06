/**
 * busqueda-global.js — Búsqueda global Ctrl+K para ContApp Auditor
 * Requiere: navegar(modulo, null), mostrarToast(mensaje, tipo) globales
 */

(function () {
    'use strict';

    // ─── Constantes ────────────────────────────────────────────────────────────

    var OVERLAY_ID   = 'bg-overlay';
    var INPUT_ID     = 'bg-input';
    var RESULTS_ID   = 'bg-results';
    var DEBOUNCE_MS  = 150;
    var MAX_POR_GRUPO = 5;
    var MAX_TOTAL    = 30;

    var FUENTES = [
        {
            clave:     'core_asientos',
            modulo:    'diario',
            etiqueta:  'Libro Diario',
            icono:     '📝',
            color:     '#4f46e5',
            campos:    ['glosa', 'contacto'],
            titulo:    function (r) { return r.glosa || '(sin glosa)'; },
            subtitulo: function (r) {
                var f = r.fecha ? r.fecha : '';
                return f ? 'Fecha: ' + f : '';
            }
        },
        {
            clave:     'core_compras',
            modulo:    'compras',
            etiqueta:  'Compras',
            icono:     '🛒',
            color:     '#0891b2',
            campos:    ['razon_social', 'rut_proveedor', 'numero_doc'],
            titulo:    function (r) { return r.razon_social || r.rut_proveedor || '(sin nombre)'; },
            subtitulo: function (r) {
                var parts = [];
                if (r.rut_proveedor) parts.push('RUT: ' + r.rut_proveedor);
                if (r.numero_doc)    parts.push('Doc: ' + r.numero_doc);
                return parts.join(' · ');
            }
        },
        {
            clave:     'core_ventas',
            modulo:    'ventas',
            etiqueta:  'Ventas',
            icono:     '💰',
            color:     '#059669',
            campos:    ['razon_social', 'rut_cliente', 'numero_doc'],
            titulo:    function (r) { return r.razon_social || r.rut_cliente || '(sin nombre)'; },
            subtitulo: function (r) {
                var parts = [];
                if (r.rut_cliente) parts.push('RUT: ' + r.rut_cliente);
                if (r.numero_doc)  parts.push('Doc: ' + r.numero_doc);
                return parts.join(' · ');
            }
        },
        {
            clave:     'core_contactos',
            modulo:    'clientes',
            etiqueta:  'Clientes / Contactos',
            icono:     '🤝',
            color:     '#d97706',
            campos:    ['nombre', 'rut', 'giro'],
            titulo:    function (r) { return r.nombre || r.rut || '(sin nombre)'; },
            subtitulo: function (r) {
                var parts = [];
                if (r.rut)  parts.push(r.rut);
                if (r.giro) parts.push(r.giro);
                return parts.join(' · ');
            }
        },
        {
            clave:     'core_productos',
            modulo:    'productos',
            etiqueta:  'Productos',
            icono:     '📦',
            color:     '#7c3aed',
            campos:    ['nombre', 'codigo', 'categoria'],
            titulo:    function (r) { return r.nombre || r.codigo || '(sin nombre)'; },
            subtitulo: function (r) {
                var parts = [];
                if (r.codigo)    parts.push('Cód: ' + r.codigo);
                if (r.categoria) parts.push(r.categoria);
                return parts.join(' · ');
            }
        },
        {
            clave:     'core_activos',
            modulo:    'activos',
            etiqueta:  'Activos Fijos',
            icono:     '🏗️',
            color:     '#be185d',
            campos:    ['nombre', 'descripcion'],
            titulo:    function (r) { return r.nombre || '(sin nombre)'; },
            subtitulo: function (r) { return r.descripcion || ''; }
        }
    ];

    // ─── Utilidades ────────────────────────────────────────────────────────────

    function _bgEsc(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function _leerLS(clave) {
        try {
            var raw = localStorage.getItem(clave);
            if (!raw) return [];
            var parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    }

    function _contiene(valor, termino) {
        if (valor === null || valor === undefined) return false;
        return String(valor).toLowerCase().indexOf(termino) !== -1;
    }

    // ─── Estado interno ────────────────────────────────────────────────────────

    var _debounceTimer  = null;
    var _itemsActivos   = [];   // lista plana de {el, modulo} para navegación con teclado
    var _indiceActivo   = -1;

    // ─── Estilos ───────────────────────────────────────────────────────────────

    function _inyectarEstilos() {
        if (document.getElementById('bg-styles')) return;
        var s = document.createElement('style');
        s.id = 'bg-styles';
        s.textContent =
            '#' + OVERLAY_ID + '{' +
                'position:fixed;inset:0;z-index:10000;' +
                'background:rgba(0,0,0,0.55);' +
                'display:flex;align-items:flex-start;justify-content:center;' +
                'padding-top:10vh;box-sizing:border-box;' +
                'animation:bgFadeIn 0.15s ease;' +
            '}' +
            '@keyframes bgFadeIn{from{opacity:0}to{opacity:1}}' +
            '#bg-panel{' +
                'width:100%;max-width:600px;' +
                'background:#fff;border-radius:12px;' +
                'box-shadow:0 20px 60px rgba(0,0,0,0.35);' +
                'display:flex;flex-direction:column;overflow:hidden;' +
                'max-height:75vh;' +
            '}' +
            '#bg-input-wrap{' +
                'display:flex;align-items:center;gap:10px;' +
                'padding:14px 16px;border-bottom:1px solid #e5e7eb;' +
                'flex-shrink:0;' +
            '}' +
            '#bg-input-wrap span.bg-search-icon{font-size:20px;line-height:1;}' +
            '#' + INPUT_ID + '{' +
                'flex:1;border:none;outline:none;' +
                'font-size:16px;background:transparent;color:#111;' +
            '}' +
            '#' + INPUT_ID + '::placeholder{color:#9ca3af;}' +
            '.bg-hint{font-size:11px;color:#9ca3af;white-space:nowrap;}' +
            '.bg-hint kbd{' +
                'background:#f3f4f6;border:1px solid #d1d5db;' +
                'border-radius:4px;padding:1px 5px;font-size:11px;' +
            '}' +
            '#' + RESULTS_ID + '{overflow-y:auto;flex:1;}' +
            '.bg-grupo-header{' +
                'display:flex;align-items:center;gap:6px;' +
                'padding:8px 16px 4px;' +
                'font-size:11px;font-weight:700;letter-spacing:0.05em;' +
                'text-transform:uppercase;color:#6b7280;' +
                'position:sticky;top:0;background:#fff;z-index:1;' +
            '}' +
            '.bg-grupo-dot{' +
                'width:8px;height:8px;border-radius:50%;display:inline-block;' +
            '}' +
            '.bg-item{' +
                'display:flex;align-items:center;gap:10px;' +
                'padding:9px 16px;cursor:pointer;' +
                'transition:background 0.1s;' +
            '}' +
            '.bg-item:hover,.bg-item.activo{background:#f3f4f6;}' +
            '.bg-item-icono{font-size:18px;flex-shrink:0;width:24px;text-align:center;}' +
            '.bg-item-texto{flex:1;min-width:0;}' +
            '.bg-item-titulo{' +
                'font-size:14px;font-weight:600;color:#111;' +
                'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;' +
            '}' +
            '.bg-item-sub{' +
                'font-size:12px;color:#6b7280;' +
                'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;' +
            '}' +
            '.bg-vacio{' +
                'text-align:center;padding:40px 20px;color:#9ca3af;' +
            '}' +
            '.bg-vacio-icono{font-size:40px;margin-bottom:10px;}' +
            '.bg-vacio p{margin:4px 0;font-size:14px;}' +
            '.bg-separador{height:1px;background:#f3f4f6;margin:2px 0;}';
        document.head.appendChild(s);
    }

    // ─── Construcción del overlay ──────────────────────────────────────────────

    function _construirOverlay() {
        var overlay = document.createElement('div');
        overlay.id = OVERLAY_ID;

        var panel = document.createElement('div');
        panel.id = 'bg-panel';

        // — Cabecera con input —
        var inputWrap = document.createElement('div');
        inputWrap.id = 'bg-input-wrap';

        var iconoSearch = document.createElement('span');
        iconoSearch.className = 'bg-search-icon';
        iconoSearch.textContent = '🔍';

        var input = document.createElement('input');
        input.type = 'text';
        input.id = INPUT_ID;
        input.setAttribute('autocomplete', 'off');
        input.setAttribute('spellcheck', 'false');
        input.placeholder = 'Buscar en toda la app…';

        var hint = document.createElement('span');
        hint.className = 'bg-hint';
        hint.innerHTML = '<kbd>Esc</kbd> para cerrar';

        inputWrap.appendChild(iconoSearch);
        inputWrap.appendChild(input);
        inputWrap.appendChild(hint);

        // — Contenedor de resultados —
        var results = document.createElement('div');
        results.id = RESULTS_ID;
        _mostrarVacioInicial(results);

        panel.appendChild(inputWrap);
        panel.appendChild(results);
        overlay.appendChild(panel);

        return overlay;
    }

    function _mostrarVacioInicial(container) {
        container.innerHTML =
            '<div class="bg-vacio">' +
                '<div class="bg-vacio-icono">🔍</div>' +
                '<p><strong>Busca en toda la app</strong></p>' +
                '<p>Asientos, compras, ventas, contactos, productos, activos…</p>' +
            '</div>';
    }

    // ─── Búsqueda ──────────────────────────────────────────────────────────────

    function _buscar(termino) {
        termino = termino.trim().toLowerCase();
        var resultsEl = document.getElementById(RESULTS_ID);
        if (!resultsEl) return;

        if (termino.length < 2) {
            _mostrarVacioInicial(resultsEl);
            _itemsActivos = [];
            _indiceActivo = -1;
            return;
        }

        var grupos = [];
        var totalResultados = 0;

        for (var fi = 0; fi < FUENTES.length; fi++) {
            var fuente = FUENTES[fi];
            var registros = _leerLS(fuente.clave);
            var encontrados = [];

            for (var ri = 0; ri < registros.length && encontrados.length < MAX_POR_GRUPO; ri++) {
                if (totalResultados >= MAX_TOTAL) break;
                var reg = registros[ri];
                var coincide = false;
                for (var ci = 0; ci < fuente.campos.length; ci++) {
                    if (_contiene(reg[fuente.campos[ci]], termino)) {
                        coincide = true;
                        break;
                    }
                }
                if (coincide) {
                    encontrados.push(reg);
                    totalResultados++;
                }
            }

            if (encontrados.length > 0) {
                grupos.push({ fuente: fuente, items: encontrados });
            }
        }

        _renderResultados(resultsEl, grupos, termino);
    }

    function _renderResultados(container, grupos, termino) {
        _itemsActivos = [];
        _indiceActivo = -1;

        if (grupos.length === 0) {
            container.innerHTML =
                '<div class="bg-vacio">' +
                    '<div class="bg-vacio-icono">😕</div>' +
                    '<p><strong>Sin resultados para &ldquo;' + _bgEsc(termino) + '&rdquo;</strong></p>' +
                    '<p>Intenta con otro término o revisa la ortografía.</p>' +
                '</div>';
            return;
        }

        // Limpiar y reconstruir con nodos DOM (sin innerHTML anidado complejo)
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }

        for (var gi = 0; gi < grupos.length; gi++) {
            var grupo  = grupos[gi];
            var fuente = grupo.fuente;

            // Separador entre grupos
            if (gi > 0) {
                var sep = document.createElement('div');
                sep.className = 'bg-separador';
                container.appendChild(sep);
            }

            // Encabezado del grupo
            var header = document.createElement('div');
            header.className = 'bg-grupo-header';

            var dot = document.createElement('span');
            dot.className = 'bg-grupo-dot';
            dot.style.background = fuente.color;

            var headerTexto = document.createElement('span');
            headerTexto.textContent = fuente.icono + ' ' + fuente.etiqueta;

            header.appendChild(dot);
            header.appendChild(headerTexto);
            container.appendChild(header);

            // Items
            for (var ii = 0; ii < grupo.items.length; ii++) {
                var reg   = grupo.items[ii];
                var item  = document.createElement('div');
                item.className = 'bg-item';
                item.setAttribute('role', 'button');
                item.setAttribute('tabindex', '-1');

                var iconoEl = document.createElement('div');
                iconoEl.className = 'bg-item-icono';
                iconoEl.textContent = fuente.icono;

                var textoEl = document.createElement('div');
                textoEl.className = 'bg-item-texto';

                var tituloEl = document.createElement('div');
                tituloEl.className = 'bg-item-titulo';
                tituloEl.textContent = fuente.titulo(reg);

                var subEl = document.createElement('div');
                subEl.className = 'bg-item-sub';
                subEl.textContent = fuente.subtitulo(reg);

                textoEl.appendChild(tituloEl);
                textoEl.appendChild(subEl);
                item.appendChild(iconoEl);
                item.appendChild(textoEl);

                // Closure para capturar modulo correcto
                (function (modulo) {
                    item.addEventListener('click', function () {
                        busquedaGlobalCerrar();
                        navegar(modulo, null);
                    });
                }(fuente.modulo));

                container.appendChild(item);
                _itemsActivos.push(item);
            }
        }
    }

    // ─── Navegación por teclado ────────────────────────────────────────────────

    function _moverIndice(delta) {
        if (_itemsActivos.length === 0) return;

        if (_indiceActivo >= 0 && _indiceActivo < _itemsActivos.length) {
            _itemsActivos[_indiceActivo].classList.remove('activo');
        }

        _indiceActivo += delta;
        if (_indiceActivo < 0)                        _indiceActivo = _itemsActivos.length - 1;
        if (_indiceActivo >= _itemsActivos.length)    _indiceActivo = 0;

        var el = _itemsActivos[_indiceActivo];
        el.classList.add('activo');
        el.scrollIntoView({ block: 'nearest' });
    }

    function _seleccionarActivo() {
        if (_indiceActivo >= 0 && _indiceActivo < _itemsActivos.length) {
            _itemsActivos[_indiceActivo].click();
        }
    }

    function _onKeydownPanel(e) {
        switch (e.key) {
            case 'Escape':
                e.preventDefault();
                busquedaGlobalCerrar();
                break;
            case 'ArrowDown':
                e.preventDefault();
                _moverIndice(1);
                break;
            case 'ArrowUp':
                e.preventDefault();
                _moverIndice(-1);
                break;
            case 'Enter':
                e.preventDefault();
                _seleccionarActivo();
                break;
        }
    }

    // ─── Apertura / Cierre ─────────────────────────────────────────────────────

    function busquedaGlobalAbrir() {
        if (document.getElementById(OVERLAY_ID)) return; // ya abierto

        _inyectarEstilos();

        var overlay = _construirOverlay();
        document.body.appendChild(overlay);

        // Cerrar al hacer click en el backdrop (fuera del panel)
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) {
                busquedaGlobalCerrar();
            }
        });

        // Listener de teclado sobre el overlay
        overlay.addEventListener('keydown', _onKeydownPanel);

        // Input: debounce de búsqueda
        var input = document.getElementById(INPUT_ID);
        input.addEventListener('input', function () {
            clearTimeout(_debounceTimer);
            var val = input.value;
            _debounceTimer = setTimeout(function () {
                _buscar(val);
            }, DEBOUNCE_MS);
        });

        // Focus automático
        setTimeout(function () { input.focus(); }, 30);
    }

    function busquedaGlobalCerrar() {
        clearTimeout(_debounceTimer);
        _itemsActivos  = [];
        _indiceActivo  = -1;
        var overlay = document.getElementById(OVERLAY_ID);
        if (overlay) {
            document.body.removeChild(overlay);
        }
    }

    // ─── Atajo de teclado global ───────────────────────────────────────────────

    document.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            busquedaGlobalAbrir();
        }
    });

    // ─── Exports ───────────────────────────────────────────────────────────────

    window.busquedaGlobalAbrir  = busquedaGlobalAbrir;
    window.busquedaGlobalCerrar = busquedaGlobalCerrar;

}());
