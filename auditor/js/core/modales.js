/* ─────────────────────────────────────────────────────────────
   GESTOR GLOBAL DE MODALES — solo capa de interacción, sin lógica contable.

   Los módulos siguen abriendo/cerrando sus modales como siempre
   (style.display = 'flex'/'none', o appendChild/remove). Este archivo los
   observa y les agrega, a todos por igual:
     · entrada suave (CSS en main.css, sección "Gestor de modales") y salida
       suave en los que se cierran con display:none
     · Escape cierra solo el modal de arriba (pulsa su botón Cancelar/Cerrar,
       así se ejecuta la misma limpieza que con el mouse)
     · foco al primer campo, Tab no se escapa del modal y el foco vuelve al
       elemento que lo abrió
     · bloqueo del scroll de la página de fondo sin salto de diseño
     · apilamiento: un modal nuevo siempre queda sobre el anterior
   ───────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    var SEL = '.modal-overlay, .modal-confirm, #modalDocumento, #rem-modal, ' +
              '#activo-drawer-overlay, #prod-drawer-overlay, #sii-rcv-modal, [data-modal]';
    var ENFOCABLES = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), ' +
                     'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    var SALIDA_MS = 120;

    var pila = [];               // modales abiertos; el último es el de arriba
    var estado = new WeakMap();  // modal → { focoPrevio, display, timer }
    var observador;

    // Cambios hechos por el propio gestor: se descartan sus registros para no
    // reinterpretarlos como "el módulo abrió/cerró el modal".
    function sinObservar(fn) {
        fn();
        if (observador) observador.takeRecords();
    }

    function movimientoReducido() {
        return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }
    function estaAbierto(el) {
        return el.isConnected && !el.classList.contains('cm-saliendo') &&
               getComputedStyle(el).display !== 'none';
    }
    function esVisible(el) {
        return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    }
    function enfocables(modal) {
        return Array.prototype.filter.call(modal.querySelectorAll(ENFOCABLES), esVisible);
    }

    // ── Scroll del fondo ──────────────────────────────────────
    function bloquearScroll() {
        var de = document.documentElement;
        if (de.classList.contains('cm-sin-scroll')) return;
        var barra = window.innerWidth - de.clientWidth;
        de.style.setProperty('--cm-barra', barra > 0 ? barra + 'px' : '0px');
        de.classList.add('cm-sin-scroll');
    }
    function liberarScroll() {
        document.documentElement.classList.remove('cm-sin-scroll');
    }

    // ── Abrir ─────────────────────────────────────────────────
    function alAbrir(modal) {
        var st = estado.get(modal) || {};
        st.focoPrevio = document.activeElement;
        st.display = getComputedStyle(modal).display;
        estado.set(modal, st);

        var anterior = pila[pila.length - 1];
        pila.push(modal);
        bloquearScroll();

        if (!modal.hasAttribute('role')) modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        if (!modal.hasAttribute('aria-labelledby') && !modal.hasAttribute('aria-label')) {
            var titulo = modal.querySelector('h1, h2, h3');
            if (titulo) {
                if (!titulo.id) titulo.id = 'cm-titulo-' + Math.random().toString(36).slice(2, 8);
                modal.setAttribute('aria-labelledby', titulo.id);
            }
        }

        // Un modal abierto desde otro (ej. confirmación sobre un formulario) va encima
        if (anterior) {
            var zPrev = parseInt(getComputedStyle(anterior).zIndex, 10) || 0;
            var zMio  = parseInt(getComputedStyle(modal).zIndex, 10) || 0;
            if (zMio <= zPrev) modal.style.zIndex = String(zPrev + 1);
        }

        // Foco al primer campo, salvo que el módulo ya haya enfocado algo adentro
        requestAnimationFrame(function () {
            if (!estaAbierto(modal) || modal.contains(document.activeElement)) return;
            var lista = enfocables(modal);
            var campo = lista.find(function (el) {
                return /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) && !el.readOnly;
            }) || lista[0];
            if (campo) campo.focus({ preventScroll: true });
        });
    }

    // ── Cerrar ────────────────────────────────────────────────
    function alCerrar(modal, animar) {
        var i = pila.indexOf(modal);
        if (i === -1) return;
        pila.splice(i, 1);
        if (!pila.length) liberarScroll();

        var st = estado.get(modal) || {};
        var activo = document.activeElement;
        if (!activo || activo === document.body || modal.contains(activo) || !activo.isConnected) {
            var destino = st.focoPrevio;
            if (destino && destino.isConnected && esVisible(destino) && typeof destino.focus === 'function') {
                destino.focus({ preventScroll: true });
            } else if (pila.length) {
                var arriba = enfocables(pila[pila.length - 1])[0];
                if (arriba) arriba.focus({ preventScroll: true });
            }
        }

        // Salida suave: el módulo ya puso display:none; se muestra 120 ms más
        // con la animación de salida y luego se oculta de verdad.
        if (animar && modal.isConnected && !movimientoReducido() && st.display && st.display !== 'none') {
            // Con prioridad !important: si el módulo vuelve a poner style.display
            // (aunque sea el mismo valor) el atributo cambia y se detecta la reapertura.
            sinObservar(function () {
                modal.style.setProperty('display', st.display, 'important');
                modal.classList.add('cm-saliendo');
            });
            clearTimeout(st.timer);
            st.timer = setTimeout(function () {
                st.timer = null;
                sinObservar(function () {
                    modal.classList.remove('cm-saliendo');
                    modal.style.display = 'none';
                });
            }, SALIDA_MS);
        }
    }

    // Si el módulo vuelve a abrir el modal durante la salida, se cancela la salida
    function cancelarSalida(modal) {
        var st = estado.get(modal);
        if (!st || !st.timer) return false;
        clearTimeout(st.timer);
        st.timer = null;
        sinObservar(function () {
            modal.classList.remove('cm-saliendo');
            if (modal.style.getPropertyPriority('display') === 'important') {
                modal.style.setProperty('display', modal.style.getPropertyValue('display'));
            }
        });
        return true;
    }

    function sincronizar(modal) {
        var abierto = estaAbierto(modal);
        var enPila = pila.indexOf(modal) !== -1;
        if (abierto && !enPila) alAbrir(modal);
        else if (!abierto && enPila) alCerrar(modal, modal.isConnected);
    }

    // ── Observador ────────────────────────────────────────────
    function recolectar(nodo, salida) {
        if (nodo.nodeType !== 1) return;
        if (nodo.matches(SEL)) salida.push(nodo);
        if (nodo.querySelectorAll) Array.prototype.push.apply(salida, nodo.querySelectorAll(SEL));
    }

    observador = new MutationObserver(function (registros) {
        var tocados = [];
        registros.forEach(function (r) {
            if (r.type === 'childList') {
                r.addedNodes.forEach(function (n) { recolectar(n, tocados); hacerOperable(n); });
                r.removedNodes.forEach(function (n) {
                    if (n.nodeType !== 1) return;
                    pila.slice().forEach(function (m) {
                        if ((m === n || n.contains(m)) && !m.isConnected) alCerrar(m, false);
                    });
                });
            } else if (r.target.matches && r.target.matches(SEL)) {
                var st = estado.get(r.target);
                // El módulo lo volvió a abrir durante la salida: se cancela la salida
                if (st && st.timer && r.target.style.getPropertyPriority('display') !== 'important') {
                    cancelarSalida(r.target);
                    sincronizar(r.target);
                    return;
                }
                if (tocados.indexOf(r.target) === -1) tocados.push(r.target);
            }
        });
        tocados.forEach(sincronizar);
    });

    // ── Teclado: Escape y Tab ─────────────────────────────────
    function botonCerrar(modal) {
        var botones = Array.prototype.filter.call(modal.querySelectorAll('button, [role="button"]'), esVisible);
        return botones.find(function (b) { return b.hasAttribute('data-cerrar'); }) ||
               botones.find(function (b) { return /cerrar|cancelar/i.test(b.getAttribute('onclick') || ''); }) ||
               botones.find(function (b) {
                   var t = (b.textContent || '').trim().toLowerCase();
                   return t === '✕' || t === '×' || t === 'x' || t === 'cancelar' || t === 'cerrar' ||
                          t === '✕ cerrar' || /^(cerrar|cancelar)\b/.test(b.getAttribute('aria-label') || '');
               });
    }

    document.addEventListener('keydown', function (e) {
        var arriba = pila[pila.length - 1];
        if (!arriba || e.defaultPrevented) return;

        if (e.key === 'Escape') {
            var b = botonCerrar(arriba);
            if (b) { e.preventDefault(); b.click(); }
            return;
        }

        if (e.key === 'Tab') {
            var lista = enfocables(arriba);
            if (!lista.length) { e.preventDefault(); return; }
            var primero = lista[0], ultimo = lista[lista.length - 1];
            var activo = document.activeElement;
            if (!arriba.contains(activo)) {
                e.preventDefault();
                (e.shiftKey ? ultimo : primero).focus();
            } else if (e.shiftKey && activo === primero) {
                e.preventDefault(); ultimo.focus();
            } else if (!e.shiftKey && activo === ultimo) {
                e.preventDefault(); primero.focus();
            }
        }
    });

    // Quitar un modal creado por JS con la misma salida suave
    function modalQuitar(modal, despues) {
        if (!modal || !modal.isConnected) { if (despues) despues(); return; }
        if (movimientoReducido()) { modal.remove(); if (despues) despues(); return; }
        modal.classList.add('cm-saliendo');
        setTimeout(function () { modal.remove(); if (despues) despues(); }, SALIDA_MS);
    }

    // ── Operable con teclado ──────────────────────────────────
    // Muchos controles son <div>/<span>/<tr> con onclick: no reciben foco ni
    // responden a Enter/Espacio. Se les da role="button" y tabindex, y los
    // botones que solo tienen un ícono toman su title como nombre accesible.
    var CLICABLES = '[onclick]:not(button):not(a):not(input):not(select):not(textarea):not(label):not(option)';
    function soloDetiene(el) {
        return /^\s*event\.stopPropagation\(\);?\s*$/.test(el.getAttribute('onclick') || '');
    }
    function hacerOperable(raiz) {
        if (!raiz || raiz.nodeType !== 1) return;
        var lista = raiz.matches(CLICABLES) ? [raiz] : [];
        Array.prototype.push.apply(lista, raiz.querySelectorAll(CLICABLES));
        lista.forEach(function (el) {
            if (soloDetiene(el) || el.hasAttribute('tabindex')) return;
            el.setAttribute('tabindex', '0');
            if (!el.hasAttribute('role') && el.tagName !== 'TR') el.setAttribute('role', 'button');
        });
        var botones = raiz.tagName === 'BUTTON' ? [raiz] : raiz.querySelectorAll('button:not([aria-label])');
        Array.prototype.forEach.call(botones, function (b) {
            if (b.hasAttribute('aria-label')) return;
            var texto = (b.textContent || '').replace(/[\s✕×▾▸›‹←→↑↓⋯…]+/g, '').replace(/\p{Extended_Pictographic}/gu, '');
            if (!texto && b.title) b.setAttribute('aria-label', b.title);
            else if (!texto && /^\s*[✕×]\s*$/.test(b.textContent || '')) b.setAttribute('aria-label', 'Cerrar');
        });
    }
    document.addEventListener('keydown', function (e) {
        if (e.defaultPrevented || (e.key !== 'Enter' && e.key !== ' ')) return;
        var el = e.target;
        if (!el || el.nodeType !== 1 || !el.matches(CLICABLES) || soloDetiene(el)) return;
        e.preventDefault();
        el.click();
    });

    function iniciar() {
        hacerOperable(document.body);
        document.querySelectorAll(SEL).forEach(sincronizar);
        observador.observe(document.body, {
            childList: true, subtree: true,
            attributes: true, attributeFilter: ['style', 'class', 'hidden']
        });
    }

    window.ContappModales = { quitar: modalQuitar, abiertos: function () { return pila.slice(); } };
    window.modalQuitar = modalQuitar;

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
    else iniciar();
})();
