/* ─────────────────────────────────────────────────────────────
   CONSOLA "¿Qué quieres hacer hoy?" — Inicio, encima del centro de mando
   (Etapa 3 del rediseño; referencia: PLANIFICACION/diseno/referencia-contapp-consola.html)

   · Vacía: muestra lo pendiente del cierre del mes del cliente abierto (cierre.js).
   · Al escribir: sugiere áreas de la app según palabras clave (catálogo ACCIONES),
     solo de los módulos que el cliente tiene activos (construirMenu()).
   · Si la frase trae un monto, propone llevarla al Libro Diario y deja la glosa escrita.
   · Teclado: ↑/↓ elige, Enter abre, Escape limpia.
   ───────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    const ICONOS = {
        libro:    '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11M9 8h6"/>',
        swap:     '<path d="M4 8h14l-3-3M20 16H6l3 3"/>',
        datos:    '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',
        personas: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 5a3 3 0 0 1 0 6M21 20c0-2.6-1.6-4.8-4-5.6"/>',
        caja:     '<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/>',
        grafico:  '<path d="M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6"/>',
        check:    '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
        edificio: '<path d="M5 21V5l7-2v18M12 8h7v13M8 9h1M8 13h1M8 17h1M15 12h1M15 16h1M3 21h18"/>',
        nube:     '<path d="M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9z"/>',
    };
    const ico = n => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${ICONOS[n] || ICONOS.libro}</svg>`;

    // mod = destino de navegar(); req = módulo del catálogo que debe estar activo
    const ACCIONES = [
        { t: 'Calcular el F29 del mes', a: 'Comercial › Tributario (F29 / IVA)', ic: 'swap', mod: 'iva-resumen', req: 'tributario-1cat',
          kw: 'iva f29 impuesto impuestos declarar declaracion sii ppm remanente credito debito fiscal cuanto pago formulario' },
        { t: 'Registrar una factura de compra', a: 'Comercial › Libro de Compras', ic: 'swap', mod: 'compras', req: 'egresos-ingresos',
          kw: 'compra compras factura proveedor gasto gastos comprar mercaderia insumos' },
        { t: 'Registrar una venta', a: 'Comercial › Libro de Ventas', ic: 'swap', mod: 'ventas', req: 'egresos-ingresos',
          kw: 'venta ventas vender factura boleta cliente emitir ingreso ingresos' },
        { t: 'Boletas de honorarios', a: 'Comercial › Boletas de Honorarios', ic: 'swap', mod: 'honorarios', req: 'egresos-ingresos',
          kw: 'honorario honorarios boleta retencion prestador servicios profesionales' },
        { t: 'Pasar documentos recibidos al libro', a: 'Datos › Documentación', ic: 'datos', mod: 'documentos', req: 'documentos',
          kw: 'documento documentos xml bandeja recibida recibidas pdf adjunto honorarios contabilizar' },
        { t: 'Importar la cartola del banco', a: 'Datos › Cartolas bancarias', ic: 'datos', mod: 'cartolas', req: 'conciliacion-cartolas',
          kw: 'cartola banco extracto movimientos transferencia transferencias importar pagos cobros' },
        { t: 'Conciliar el banco', a: 'Datos › Conciliación bancaria', ic: 'datos', mod: 'reconciliacion', req: 'conciliacion-cartolas',
          kw: 'conciliar conciliacion banco saldo cuadrar diferencia extracto' },
        { t: 'Calcular y pagar sueldos', a: 'RRHH › Remuneraciones', ic: 'personas', mod: 'remuneraciones', req: 'remuneraciones',
          kw: 'sueldo sueldos liquidacion liquidaciones remuneracion remuneraciones trabajador trabajadores nomina pagar gratificacion horas extra finiquito vacaciones' },
        { t: 'Revisar cotizaciones e indicadores Previred', a: 'RRHH › Indicadores previsionales', ic: 'personas', mod: 'remuneraciones', req: 'remuneraciones',
          kw: 'previred cotizacion cotizaciones afp salud fonasa isapre cesantia mutual sis uf utm indicadores' },
        { t: 'Registrar un asiento en el Libro Diario', a: 'Contabilidad › Libro Diario', ic: 'libro', mod: 'diario', req: 'estructura-contable',
          kw: 'asiento asientos diario glosa registrar movimiento ajuste contabilizar' },
        { t: 'Revisar una cuenta en el Libro Mayor', a: 'Contabilidad › Libro Mayor', ic: 'libro', mod: 'mayor', req: 'estructura-contable',
          kw: 'mayor cuenta cuentas saldo movimientos detalle' },
        { t: 'Ver el balance', a: 'Contabilidad › Balance general', ic: 'libro', mod: 'balance', req: 'estructura-contable',
          kw: 'balance ocho columnas comprobacion cuadrado debe haber' },
        { t: 'Editar el plan de cuentas', a: 'Contabilidad › Plan de cuentas', ic: 'libro', mod: 'plan-cuentas', req: 'estructura-contable',
          kw: 'plan cuentas cuenta nueva codigo crear' },
        { t: 'Ver el estado de resultados', a: 'Contabilidad › Reportes financieros', ic: 'grafico', mod: 'estado-resultados', req: 'reportes-financieros',
          kw: 'resultado resultados utilidad perdida ganancia margen rentabilidad' },
        { t: 'Ver el flujo de caja', a: 'Contabilidad › Reportes financieros', ic: 'grafico', mod: 'flujo-caja', req: 'reportes-financieros',
          kw: 'flujo caja liquidez efectivo plata dinero' },
        { t: 'Registrar o depreciar un activo fijo', a: 'Empresa › Inventario y activos', ic: 'caja', mod: 'activos', req: 'inventario-activos',
          kw: 'activo activos fijo depreciacion depreciar equipo computador vehiculo maquinaria mueble' },
        { t: 'Revisar el stock', a: 'Empresa › Inventario y activos', ic: 'caja', mod: 'movimientos-inventario', req: 'inventario-activos',
          kw: 'stock inventario producto productos bodega bodegas existencias kardex' },
        { t: 'Ver saldos de clientes y proveedores', a: 'Datos › Clientes y proveedores', ic: 'datos', mod: 'clientes', req: 'clientes',
          kw: 'cliente clientes proveedor proveedores deuda deudas cobrar cobranza rut contacto saldo' },
        // Segunda categoría
        { t: 'Libro de honorarios', a: 'Contabilidad › Libros contables', ic: 'libro', mod: 'libro-honorarios', req: 'libros-contables-hon',
          kw: 'honorario honorarios libro boleta boletas retencion' },
        { t: 'Calcular el F29 de honorarios', a: 'Tributario › Declaración de impuestos', ic: 'swap', mod: 'f29-hon', req: 'declaracion-impuestos-hon',
          kw: 'iva f29 impuesto impuestos declarar retencion mensual' },
        { t: 'Preparar el F22 (renta anual)', a: 'Tributario › Declaración de impuestos', ic: 'swap', mod: 'f22-hon', req: 'declaracion-impuestos-hon',
          kw: 'f22 renta anual declaracion operacion abril global complementario' },
        // Siempre disponibles
        { t: 'Revisar el cierre del mes', a: 'Inicio › Cierre del mes', ic: 'check', accion: 'cierre',
          kw: 'cierre cerrar mes pendiente pendientes falta checklist revisar' },
        { t: 'Cambiar de cliente', a: 'Mis clientes', ic: 'edificio', accion: 'clientes',
          kw: 'cambiar cliente empresa empresas cartera estudio otro' },
        { t: 'Descargar un respaldo del cliente', a: 'Configuración › Respaldo del cliente', ic: 'nube', mod: 'configuracion',
          kw: 'respaldo backup exportar descargar copia seguridad nube sincronizar configuracion' },
    ];

    const STOP = new Set(['que', 'quiero', 'hacer', 'necesito', 'como', 'los', 'las', 'del', 'para', 'con', 'una', 'uno',
        'unos', 'mis', 'por', 'este', 'esta', 'hoy', 'ver', 'tengo', 'debo', 'donde', 'cual', 'cuales', 'sobre', 'todo',
        'todos', 'algo', 'mes']);
    const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const tieneMonto = q => /\d{1,3}(\.\d{3})+|\d{4,}/.test(q);

    function modulosActivos() {
        try { return new Set(construirMenu().flatMap(g => g.modulos.map(m => m.id))); }
        catch (e) { return null; }
    }
    function disponibles() {
        const act = modulosActivos();
        return ACCIONES.filter(a => !a.req || !act || act.has(a.req));
    }

    function puntaje(acc, q) {
        const toks = norm(q).split(/[^a-z0-9ñ]+/).filter(w => w.length >= 3 && !STOP.has(w));
        if (!toks.length) return 0;
        const palabras = norm(acc.t + ' ' + acc.kw + ' ' + acc.a).split(/[^a-z0-9ñ]+/);
        let s = 0;
        toks.forEach(w => {
            if (palabras.includes(w)) s += 3;
            else if (w.length >= 4 && palabras.some(k => k.length >= 4 && (k.startsWith(w.slice(0, 4)) || w.startsWith(k.slice(0, 4))))) s += 1;
        });
        return s;
    }

    // Sugerencias del día: lo pendiente del cierre del cliente abierto
    function sugerenciasHoy() {
        if (typeof cierreChecklist !== 'function') return [];
        let c;
        try { c = cierreChecklist(); } catch (e) { return []; }
        const ICONO_DE = { compras: 'swap', ventas: 'swap', 'iva-resumen': 'swap', documentos: 'datos', cartolas: 'datos',
                           reconciliacion: 'datos', remuneraciones: 'personas', activos: 'caja', balance: 'libro', diario: 'libro' };
        const pend = c.items.filter(i => i.estado === 'pendiente').slice(0, 4).map(i => ({
            t: i.label, a: 'Pendiente del cierre de ' + c.etiqueta, ic: ICONO_DE[i.ir] || 'check', mod: i.ir || null,
            accion: i.ir ? null : 'cierre', tag: i.detalle,
        }));
        pend.push({ t: 'Revisar el cierre del mes', a: 'Inicio › Cierre de ' + c.etiqueta, ic: 'check', accion: 'cierre',
                    tag: c.cerrado ? 'Cerrado' : c.avance + '%' });
        return pend;
    }

    let sugs = [], sel = 0;
    const $ = id => document.getElementById(id);

    function nombreCliente() {
        return window.currentUser?.empresaNombre ||
            (() => { try { return JSON.parse(localStorage.getItem('core_config') || '{}').empresa; } catch (e) { return ''; } })() || 'tu cliente';
    }

    function render() {
        const input = $('cmdConsola');
        if (!input) return;
        const q = input.value.trim();
        let titulo;
        if (!q) {
            sugs = sugerenciasHoy();
            titulo = sugs.length ? 'Sugerencias para hoy en ' + nombreCliente() : '';
        } else {
            sugs = disponibles().map(a => ({ ...a, s: puntaje(a, q) })).filter(a => a.s > 0)
                .sort((x, y) => y.s - x.s).slice(0, 5);
            const act = modulosActivos();
            if (tieneMonto(q) && (!act || act.has('estructura-contable'))) {
                sugs = [{ t: `Registrar «${q}» en el Libro Diario`, a: 'Contabilidad › Libro Diario (motor de glosas)', ic: 'libro',
                          mod: 'diario', glosa: q, tag: 'Arma el asiento' }, ...sugs.filter(a => a.mod !== 'diario')].slice(0, 5);
            }
            titulo = sugs.length ? 'Áreas relacionadas' : '';
            if (!sugs.length) {
                // Coincide con un módulo que este cliente no tiene activo: decirlo y llevar a activarlo
                const inactivos = ACCIONES.filter(a => a.req && act && !act.has(a.req))
                    .map(a => ({ ...a, s: puntaje(a, q) })).filter(a => a.s > 0).sort((x, y) => y.s - x.s).slice(0, 3)
                    .map(a => ({ ...a, mod: 'configuracion', glosa: null, tag: 'Módulo no activo · activar' }));
                if (inactivos.length) { sugs = inactivos; titulo = 'Está en un módulo que este cliente no tiene activo'; }
            }
        }
        sel = 0;
        $('consolaSugTitulo').textContent = titulo;
        $('consolaSugList').innerHTML = sugs.length ? sugs.map((a, i) => `
            <li class="sugi" role="option" id="consola-sug-${i}" aria-selected="${i === sel}" data-i="${i}">
                <span class="ic">${ico(a.ic)}</span>
                <span class="sugi-txt"><b>${esc(a.t)}</b><span class="a">${esc(a.a)}</span></span>
                ${a.tag ? `<span class="tag">${esc(a.tag)}</span>` : '<span></span>'}
            </li>`).join('')
            : (q ? '<li class="sug-vacio">No encontré un área para eso. Prueba con palabras como sueldos, IVA, banco, compras o cierre.</li>' : '');
        input.setAttribute('aria-activedescendant', sugs.length ? 'consola-sug-0' : '');
    }

    function marcar(i) {
        if (!sugs.length) return;
        sel = (i + sugs.length) % sugs.length;
        document.querySelectorAll('#consolaSugList .sugi').forEach((li, k) => li.setAttribute('aria-selected', k === sel));
        $('cmdConsola').setAttribute('aria-activedescendant', 'consola-sug-' + sel);
        document.getElementById('consola-sug-' + sel)?.scrollIntoView({ block: 'nearest' });
    }

    function ejecutar(a) {
        if (!a) return;
        if (a.accion === 'cierre') { if (typeof cierreAbrirChecklist === 'function') cierreAbrirChecklist(); return; }
        if (a.accion === 'clientes') { if (typeof cambiarEmpresa === 'function') cambiarEmpresa(); return; }
        if (!a.mod || typeof navegar !== 'function') return;
        navegar(a.mod);
        if (a.glosa) {
            // Deja la frase escrita en el motor de glosas del Diario
            setTimeout(() => {
                const g = document.getElementById('glosaInput');
                if (!g) return;
                g.value = a.glosa;
                g.dispatchEvent(new Event('input', { bubbles: true }));
                g.focus();
            }, 200);
        }
        const input = $('cmdConsola');
        if (input) { input.value = ''; render(); }
    }

    function montar() {
        const cont = $('homeConsola');
        if (!cont || cont.dataset.montada) return;
        cont.dataset.montada = '1';
        cont.innerHTML = `
            <div class="consola-globo" aria-hidden="true">
                <svg viewBox="0 0 400 400"><g fill="none" stroke-width="1.4">
                    <circle cx="200" cy="200" r="190"/><ellipse cx="200" cy="200" rx="190" ry="62"/>
                    <ellipse cx="200" cy="110" rx="160" ry="40"/><ellipse cx="200" cy="290" rx="160" ry="40"/>
                    <line x1="200" y1="10" x2="200" y2="390"/>
                    <ellipse class="mer" cx="200" cy="200" rx="120" ry="190"/><ellipse class="mer b" cx="200" cy="200" rx="120" ry="190"/>
                </g></svg>
            </div>
            <div class="consola-in">
                <h2>¿Qué quieres hacer hoy?</h2>
                <p class="sub">Escríbelo con tus palabras y te muestro dónde hacerlo.</p>
                <form class="consola-prompt" id="consolaForm" autocomplete="off" role="search">
                    <svg class="chev" viewBox="0 0 22 26" aria-hidden="true"><path d="M4 4l13 9-13 9"/></svg>
                    <label for="cmdConsola" class="sr-only">¿Qué quieres hacer hoy?</label>
                    <input id="cmdConsola" type="text" spellcheck="false"
                           placeholder="Ej.: pagar los sueldos, cuánto IVA pago, conciliar el banco"
                           role="combobox" aria-expanded="true" aria-controls="consolaSugList" aria-autocomplete="list">
                    <button class="consola-go" type="submit">Ir</button>
                </form>
            </div>
            <div class="consola-sug">
                <div class="sug-t" id="consolaSugTitulo"></div>
                <ul class="suglist" id="consolaSugList" role="listbox" aria-labelledby="consolaSugTitulo"></ul>
            </div>`;
        const input = $('cmdConsola');
        input.addEventListener('input', render);
        input.addEventListener('focus', () => { if (!input.value) render(); });
        input.addEventListener('keydown', e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); marcar(sel + 1); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); marcar(sel - 1); }
            else if (e.key === 'Escape' && input.value) { e.preventDefault(); input.value = ''; render(); }
        });
        $('consolaSugList').addEventListener('click', e => {
            const li = e.target.closest('.sugi'); if (li) ejecutar(sugs[+li.dataset.i]);
        });
        $('consolaForm').addEventListener('submit', e => { e.preventDefault(); ejecutar(sugs[sel]); });
        render();
    }

    function refrescar() { montar(); const i = $('cmdConsola'); if (i && !i.value) render(); }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refrescar);
    else refrescar();
    if (window.ContappEventos) {
        ['cliente:datos-cargados', 'cierre:cambiado', 'asiento:registrado', 'libro:guardado', 'documento:en-libro']
            .forEach(ev => ContappEventos.escuchar(ev, refrescar));
    }

    window.consolaRefrescar = refrescar;
    window.CONSOLA_ACCIONES = ACCIONES;   // para pruebas
    window.consolaPuntaje = puntaje;
})();
