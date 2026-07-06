'use strict';
/**
 * autocomplete.js — Componente de autocompletado para campos de cuenta.
 *
 * Uso:
 *   initAutocomplete(inputEl, () => ['Caja','Banco',...], (val) => callback)
 *
 * Teclado:
 *   Escribir  → filtra y muestra dropdown
 *   Tab       → cicla por las sugerencias (la primera coincidencia queda en el campo)
 *   Enter     → confirma la selección actual y mueve al siguiente campo
 *   Esc       → cierra el dropdown sin confirmar
 *   ↑ / ↓    → navega por la lista
 *   Click     → selecciona la opción
 */

(function () {

    // Un solo dropdown global reutilizado por todos los inputs
    let activeInput   = null;
    let suggestions   = [];
    let selectedIdx   = -1;
    let onSelectCb    = null;
    let justSelected  = false;   // evita que blur re-invoque onSelect tras elegir

    // ─── Crear el dropdown ───────────────────────────────────────
    const dropdown = document.createElement('div');
    dropdown.id = 'autocomplete-dropdown';
    dropdown.className = 'autocomplete-dropdown';
    dropdown.style.display = 'none';
    document.body.appendChild(dropdown);

    // ─── Posicionamiento ─────────────────────────────────────────
    function posicionar(input) {
        const rect = input.getBoundingClientRect();
        dropdown.style.top   = (rect.bottom + window.scrollY + 2) + 'px';
        dropdown.style.left  = (rect.left   + window.scrollX)     + 'px';
        dropdown.style.width = Math.max(rect.width, 220)           + 'px';
    }

    // ─── Renderizar items ────────────────────────────────────────
    function renderDropdown() {
        if (!suggestions.length) { cerrar(); return; }

        dropdown.innerHTML = suggestions
            .slice(0, 10)
            .map((s, i) => {
                // resaltar la parte que coincide
                const val  = activeInput ? activeInput.value.trim() : '';
                const idx  = s.toLowerCase().indexOf(val.toLowerCase());
                let label  = s;
                if (idx >= 0 && val) {
                    label = s.slice(0, idx)
                          + `<strong>${s.slice(idx, idx + val.length)}</strong>`
                          + s.slice(idx + val.length);
                }
                return `<div class="ac-item${i === selectedIdx ? ' ac-item-active' : ''}"
                             data-idx="${i}">${label}</div>`;
            })
            .join('');

        posicionar(activeInput);
        dropdown.style.display = 'block';

        dropdown.querySelectorAll('.ac-item').forEach(el => {
            el.addEventListener('mousedown', e => {
                e.preventDefault();
                elegir(parseInt(el.dataset.idx));
            });
        });
    }

    function marcar(idx) {
        selectedIdx = idx;
        dropdown.querySelectorAll('.ac-item').forEach((el, i) => {
            el.classList.toggle('ac-item-active', i === idx);
        });
        if (activeInput && suggestions[idx] !== undefined) {
            activeInput.value = suggestions[idx];
        }
    }

    // ─── Seleccionar y cerrar ────────────────────────────────────
    function elegir(idx) {
        if (idx < 0 || idx >= suggestions.length) return;
        justSelected = true;
        const val = suggestions[idx];
        if (onSelectCb) onSelectCb(val);
        // El callback puede haber cambiado activeInput.value; no sobreescribir
        cerrar();
        // Mover foco al siguiente input del mismo modal
        moverFoco(activeInput, 1);
    }

    function cerrar() {
        dropdown.style.display = 'none';
        suggestions  = [];
        selectedIdx  = -1;
    }

    // ─── Mover foco al siguiente input en el modal ───────────────
    function moverFoco(desde, delta) {
        if (!desde) return;
        const modal  = desde.closest('.modal-box');
        if (!modal) return;
        const inputs = Array.from(modal.querySelectorAll('input, select, button'))
            .filter(el => !el.disabled && el.offsetParent !== null);
        const i = inputs.indexOf(desde);
        if (i >= 0 && inputs[i + delta]) inputs[i + delta].focus();
    }

    // ─── Función pública ─────────────────────────────────────────
    function initAutocomplete(input, getOpciones, onSelect) {

        input.setAttribute('autocomplete', 'off');

        input.addEventListener('input', () => {
            activeInput = input;
            onSelectCb  = onSelect;
            const val   = input.value.trim().toLowerCase();
            if (!val) { cerrar(); return; }

            suggestions  = getOpciones()
                .filter(o => o.toLowerCase().includes(val))
                .sort((a, b) => {
                    // priorizar las que empiezan con el texto
                    const ai = a.toLowerCase().indexOf(val);
                    const bi = b.toLowerCase().indexOf(val);
                    return ai - bi || a.localeCompare(b);
                });

            selectedIdx = suggestions.length ? 0 : -1;
            if (selectedIdx === 0) {
                // mostrar ghost: no modificar el value, solo resaltar
            }
            renderDropdown();
        });

        input.addEventListener('keydown', e => {
            // Si el dropdown está cerrado, no interceptar Tab/Enter/flechas
            if (dropdown.style.display === 'none') return;

            if (e.key === 'Tab') {
                e.preventDefault();
                if (!suggestions.length) return;
                // Ciclar por las sugerencias
                const max = Math.min(suggestions.length, 10);
                selectedIdx = (selectedIdx + 1) % max;
                marcar(selectedIdx);
                return;
            }

            if (e.key === 'Enter') {
                e.preventDefault();
                if (selectedIdx >= 0) elegir(selectedIdx);
                else if (suggestions.length) elegir(0);
                return;
            }

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                selectedIdx = Math.min(selectedIdx + 1, Math.min(suggestions.length, 10) - 1);
                marcar(selectedIdx);
                return;
            }

            if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectedIdx = Math.max(selectedIdx - 1, 0);
                marcar(selectedIdx);
                return;
            }

            if (e.key === 'Escape') {
                cerrar();
                return;
            }
        });

        input.addEventListener('focus', () => {
            activeInput = input;
            onSelectCb  = onSelect;
            const val   = input.value.trim().toLowerCase();
            if (val && !suggestions.length) {
                const opciones = getOpciones()
                    .filter(o => o.toLowerCase().includes(val));
                if (opciones.length) {
                    suggestions = opciones;
                    selectedIdx = 0;
                    renderDropdown();
                }
            }
        });

        input.addEventListener('blur', () => {
            // Delay para permitir el click en el dropdown
            setTimeout(() => {
                if (!justSelected && onSelect && input.value) onSelect(input.value);
                justSelected = false;
                cerrar();
            }, 180);
        });
    }

    // Cerrar si se hace click fuera
    document.addEventListener('mousedown', e => {
        if (e.target !== dropdown && !dropdown.contains(e.target)) {
            cerrar();
        }
    });

    window.initAutocomplete = initAutocomplete;

})();
