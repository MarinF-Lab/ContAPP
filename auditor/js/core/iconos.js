/* ─────────────────────────────────────────────────────────────
   ÍCONOS SVG de la app (trazo, heredan el color del texto) — reemplazan a los
   emoji en Inicio. Mismo juego que la referencia PLANIFICACION/diseno/
   referencia-contapp-consola.html. Uso: ContappIconos.svg('libro')
   ───────────────────────────────────────────────────────────── */
(function () {
    'use strict';
    const P = {
        libro:     '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11M9 8h6"/>',
        swap:      '<path d="M4 8h14l-3-3M20 16H6l3 3"/>',
        datos:     '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',
        personas:  '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 5a3 3 0 0 1 0 6M21 20c0-2.6-1.6-4.8-4-5.6"/>',
        caja:      '<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/>',
        grafico:   '<path d="M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6"/>',
        check:     '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
        edificio:  '<path d="M5 21V5l7-2v18M12 8h7v13M8 9h1M8 13h1M8 17h1M15 12h1M15 16h1M3 21h18"/>',
        nube:      '<path d="M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9z"/>',
        brujula:   '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
        engranaje: '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14.2 3h-4l-.4 2.6a7 7 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7 7 0 0 0 2-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z"/>',
        flecha:    '<path d="M9 6l6 6-6 6"/>',
        recibo:    '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
    };
    // Grupo del menú → ícono
    const GRUPO = { Contabilidad: 'libro', Comercial: 'swap', Datos: 'datos', RRHH: 'personas', Empresa: 'caja', Tributario: 'recibo' };

    function svg(nombre, clase) {
        return `<svg class="${clase || 'ico'}" viewBox="0 0 24 24" aria-hidden="true">${P[nombre] || P.libro}</svg>`;
    }
    window.ContappIconos = { svg, grupo: label => svg(GRUPO[label] || 'libro'), nombres: Object.keys(P) };
})();
