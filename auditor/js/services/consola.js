/* ─────────────────────────────────────────────────────────────
   CONSOLA "¿Qué quieres hacer hoy?" — un solo motor para dos lugares:
     · Inicio: encima del centro de mando (#homeConsola).
     · Resto de la app: barra "Buscar o hacer algo" de la cabecera y Ctrl K abren la misma
       consola como paleta (en Inicio, Ctrl K enfoca la consola de la página).
   (Referencia: PLANIFICACION/diseno/referencia-contapp-consola.html)

   · Vacía: muestra lo pendiente del cierre del mes del cliente abierto (cierre.js).
   · Al escribir: áreas de la app según palabras clave (catálogo ACCIONES), solo de los módulos
     activos del cliente, y datos del cliente (asientos, compras, ventas, contactos, productos,
     activos). Reemplaza a la antigua busqueda-global.js.
   · Si la frase trae un monto, propone llevarla al Libro Diario y deja la glosa escrita.
   · Teclado: ↑/↓ elige, Enter abre, Escape limpia (en la paleta, cierra). Sin animación al
     abrir: se usa muchas veces al día y desde el teclado.
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
        doc:      '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
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

    // Datos del cliente abierto donde busca la consola (antes: busqueda-global.js).
    // mod = destino de navegar(); req = módulo del catálogo que debe estar activo.
    const fecha = r => r.fecha || '';
    const FUENTES = [
        { clave: 'core_asientos', grupo: 'Libro Diario', ic: 'libro', mod: 'diario', req: 'estructura-contable',
          campos: ['glosa', 'contacto'], titulo: r => r.glosa || '(sin glosa)',
          sub: r => [r.numero ? 'Asiento N° ' + r.numero : '', r.contacto].filter(Boolean).join(' · '), tag: fecha },
        { clave: 'core_compras', grupo: 'Compras', ic: 'doc', mod: 'compras', req: 'egresos-ingresos',
          campos: ['nombre_proveedor', 'rut_proveedor', 'numero_doc'], titulo: r => r.nombre_proveedor || r.rut_proveedor || '(sin nombre)',
          sub: r => [r.rut_proveedor, r.numero_doc ? 'N° ' + r.numero_doc : '', r.fecha].filter(Boolean).join(' · '),
          tag: r => (typeof fmtPeso === 'function' ? fmtPeso(r.total) : '') },
        { clave: 'core_ventas', grupo: 'Ventas', ic: 'doc', mod: 'ventas', req: 'egresos-ingresos',
          campos: ['nombre_cliente', 'rut_cliente', 'numero_doc'], titulo: r => r.nombre_cliente || r.rut_cliente || '(sin nombre)',
          sub: r => [r.rut_cliente, r.numero_doc ? 'N° ' + r.numero_doc : '', r.fecha].filter(Boolean).join(' · '),
          tag: r => (typeof fmtPeso === 'function' ? fmtPeso(r.total) : '') },
        { clave: 'core_contactos', grupo: 'Clientes y proveedores', ic: 'personas', mod: 'clientes', req: 'clientes',
          campos: ['nombre', 'fantasia', 'rut', 'giro'], titulo: r => r.nombre || r.rut || '(sin nombre)',
          sub: r => [r.rut, r.giro].filter(Boolean).join(' · '), tag: () => '' },
        { clave: 'core_productos', grupo: 'Productos', ic: 'caja', mod: 'productos', req: 'inventario-activos',
          campos: ['nombre', 'codigo', 'categoria'], titulo: r => r.nombre || r.codigo || '(sin nombre)',
          sub: r => [r.codigo ? 'Cód. ' + r.codigo : '', r.categoria].filter(Boolean).join(' · '), tag: () => '' },
        { clave: 'core_activos', grupo: 'Activos fijos', ic: 'caja', mod: 'activos', req: 'inventario-activos',
          campos: ['nombre', 'descripcion'], titulo: r => r.nombre || '(sin nombre)', sub: r => r.descripcion || '', tag: () => '' },
    ];
    const MAX_POR_FUENTE = 3, MAX_DATOS = 9;

    const STOP = new Set(['que', 'quiero', 'hacer', 'necesito', 'como', 'los', 'las', 'del', 'para', 'con', 'una', 'uno',
        'unos', 'mis', 'por', 'este', 'esta', 'hoy', 'ver', 'tengo', 'debo', 'donde', 'cual', 'cuales', 'sobre', 'todo',
        'todos', 'algo', 'mes']);
    const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    // Frase con monto y palabras ("pagué 50.000 de arriendo"); un número solo es un N° de documento o un RUT
    const tieneMonto = q => /\d{1,3}(\.\d{3})+|\d{4,}/.test(q) && /[a-zñáéíóú]{3,}/i.test(q);
    const $ = id => document.getElementById(id);

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

    function leer(clave) {
        try { const v = JSON.parse(localStorage.getItem(clave) || '[]'); return Array.isArray(v) ? v : []; }
        catch (e) { return []; }
    }

    // Registros del cliente que contienen el texto (sin tildes ni mayúsculas), agrupados por libro
    function buscarDatos(q) {
        const t = norm(q.trim());
        if (t.length < 2) return [];
        const act = modulosActivos();
        const out = [];
        for (const f of FUENTES) {
            if (out.length >= MAX_DATOS) break;
            if (f.req && act && !act.has(f.req)) continue;
            let n = 0;
            for (const r of leer(f.clave)) {
                if (n >= MAX_POR_FUENTE || out.length >= MAX_DATOS) break;
                if (!f.campos.some(c => r[c] != null && norm(r[c]).includes(t))) continue;
                out.push({ t: f.titulo(r), a: f.sub(r), ic: f.ic, mod: f.mod, tag: f.tag(r), grupo: f.grupo, dato: { fuente: f.clave, id: r.id, fecha: r.fecha } });
                n++;
            }
        }
        return out;
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

    function nombreCliente() {
        return window.currentUser?.empresaNombre ||
            (() => { try { return JSON.parse(localStorage.getItem('core_config') || '{}').empresa; } catch (e) { return ''; } })() || 'tu cliente';
    }

    // Resultados para una frase: acciones (o el aviso de módulo inactivo) y luego datos del cliente
    function resultados(q) {
        if (!q) {
            const s = sugerenciasHoy();
            return { titulo: s.length ? 'Sugerencias para hoy en ' + nombreCliente() : '', items: s };
        }
        const act = modulosActivos();
        let acciones = disponibles().map(a => ({ ...a, s: puntaje(a, q) })).filter(a => a.s > 0)
            .sort((x, y) => y.s - x.s).slice(0, 5);
        if (tieneMonto(q) && (!act || act.has('estructura-contable'))) {
            acciones = [{ t: `Registrar «${q}» en el Libro Diario`, a: 'Contabilidad › Libro Diario (motor de glosas)', ic: 'libro',
                          mod: 'diario', glosa: q, tag: 'Arma el asiento' }, ...acciones.filter(a => a.mod !== 'diario')].slice(0, 5);
        }
        acciones.forEach(a => { a.grupo = 'Ir a'; });
        const datos = buscarDatos(q);
        if (!acciones.length && !datos.length) {
            // Coincide con un módulo que este cliente no tiene activo: decirlo y llevar a activarlo
            const inactivos = ACCIONES.filter(a => a.req && act && !act.has(a.req))
                .map(a => ({ ...a, s: puntaje(a, q) })).filter(a => a.s > 0).sort((x, y) => y.s - x.s).slice(0, 3)
                .map(a => ({ ...a, mod: 'configuracion', glosa: null, tag: 'Módulo no activo · activar' }));
            if (inactivos.length) return { titulo: 'Está en un módulo que este cliente no tiene activo', items: inactivos };
        }
        return { titulo: '', items: acciones.concat(datos) };
    }

    // Abre el registro encontrado: Compras y Ventas se muestran en el mes del documento
    function abrirDato(d) {
        const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(d.fecha || '');
        try {
            if (m && d.fuente === 'core_compras' && typeof comprasMes !== 'undefined') { comprasMes = +m[2]; comprasAnio = +m[3]; }
            if (m && d.fuente === 'core_ventas' && typeof ventasMes !== 'undefined') { ventasMes = +m[2]; ventasAnio = +m[3]; }
        } catch (e) { /* módulo no cargado: se abre en su mes actual */ }
        if (d.fuente === 'core_contactos' && d.id != null && typeof verDetalleContacto === 'function') {
            setTimeout(() => verDetalleContacto(d.id), 150);
        }
    }

    function ejecutar(a) {
        if (!a) return;
        if (a.accion === 'cierre') { if (typeof cierreAbrirChecklist === 'function') cierreAbrirChecklist(); return; }
        if (a.accion === 'clientes') { if (typeof cambiarEmpresa === 'function') cambiarEmpresa(); return; }
        if (!a.mod || typeof navegar !== 'function') return;
        if (a.dato) abrirDato(a.dato);
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
    }

    // ── Una consola (Inicio o paleta): campo + lista con su propio estado ─────────
    function crearConsola(ids, { alEjecutar, alEscapeVacio } = {}) {
        let sugs = [], sel = 0;
        const input = () => $(ids.input);

        function render() {
            const el = input();
            if (!el) return;
            const q = el.value.trim();
            const r = resultados(q);
            sugs = r.items;
            sel = 0;
            $(ids.titulo).textContent = r.titulo;
            let grupo = null, html = '';
            sugs.forEach((a, i) => {
                if (q && a.grupo && a.grupo !== grupo) { grupo = a.grupo; html += `<li class="sug-grupo" role="presentation">${esc(grupo)}</li>`; }
                html += `
                <li class="sugi" role="option" id="${ids.lista}-${i}" aria-selected="${i === sel}" data-i="${i}">
                    <span class="ic">${ico(a.ic)}</span>
                    <span class="sugi-txt"><b>${esc(a.t)}</b>${a.a ? `<span class="a">${esc(a.a)}</span>` : ''}</span>
                    ${a.tag ? `<span class="tag">${esc(a.tag)}</span>` : '<span></span>'}
                </li>`;
            });
            $(ids.lista).innerHTML = sugs.length ? html
                : (q ? '<li class="sug-vacio">No encontré nada para eso. Prueba con un nombre, un RUT, un N° de documento o palabras como sueldos, IVA, banco o cierre.</li>' : '');
            el.setAttribute('aria-activedescendant', sugs.length ? ids.lista + '-0' : '');
        }

        function marcar(i) {
            if (!sugs.length) return;
            sel = (i + sugs.length) % sugs.length;
            document.querySelectorAll('#' + ids.lista + ' .sugi').forEach((li, k) => li.setAttribute('aria-selected', k === sel));
            input().setAttribute('aria-activedescendant', ids.lista + '-' + sel);
            $(ids.lista + '-' + sel)?.scrollIntoView({ block: 'nearest' });
        }

        function elegir(a) {
            if (!a) return;
            if (alEjecutar) alEjecutar();
            ejecutar(a);
            const el = input();
            if (el && el.isConnected) { el.value = ''; render(); }
        }

        function enlazar() {
            const el = input();
            el.addEventListener('keydown', e => {
                if (e.key === 'ArrowDown') { e.preventDefault(); marcar(sel + 1); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); marcar(sel - 1); }
                else if (e.key === 'Escape') {
                    e.preventDefault(); e.stopPropagation();
                    if (el.value && !alEscapeVacio.siempre) { el.value = ''; render(); }
                    else alEscapeVacio.fn();
                }
            });
            $(ids.lista).addEventListener('mousedown', e => { if (e.target.closest('.sugi')) e.preventDefault(); });
            $(ids.lista).addEventListener('click', e => {
                const li = e.target.closest('.sugi'); if (li) elegir(sugs[+li.dataset.i]);
            });
            $(ids.form).addEventListener('submit', e => { e.preventDefault(); elegir(sugs[sel]); });
        }

        return { render, enlazar };
    }

    const PROMPT = (ids, placeholder, extra) => `
                <form class="consola-prompt" id="${ids.form}" autocomplete="off" role="search">
                    <svg class="chev" viewBox="0 0 22 26" aria-hidden="true"><path d="M4 4l13 9-13 9"/></svg>
                    <label for="${ids.input}" class="sr-only">¿Qué quieres hacer hoy?</label>
                    <input id="${ids.input}" type="text" spellcheck="false" placeholder="${placeholder}"
                           role="combobox" aria-expanded="false" aria-controls="${ids.lista}" aria-autocomplete="list">
                    ${extra}
                </form>`;
    const LISTA = ids => `
            <div class="consola-sug">
                <div class="sug-t" id="${ids.titulo}"></div>
                <ul class="suglist" id="${ids.lista}" role="listbox" aria-labelledby="${ids.titulo}"></ul>
            </div>`;

    // ── Consola de Inicio ──────────────────────────────────────────────────────
    const IDS_INICIO = { input: 'cmdConsola', form: 'consolaForm', titulo: 'consolaSugTitulo', lista: 'consolaSugList' };
    let inicio = null;

    function resumenCierre() {
        const b = $('consolaResumen');
        if (!b) return;
        let c = null;
        try { c = typeof cierreChecklist === 'function' ? cierreChecklist() : null; } catch (e) { c = null; }
        if (!c || !window.currentUser) { b.hidden = true; return; }
        const n = c.items.filter(i => i.estado === 'pendiente').length;
        b.textContent = c.cerrado ? `Cierre de ${c.etiqueta}: cerrado`
            : n ? `${n} pendiente${n === 1 ? '' : 's'} del cierre de ${c.etiqueta} · ${c.avance}%`
                : `Cierre de ${c.etiqueta} al día · ${c.avance}%`;
        b.title = 'Ver sugerencias para hoy';
        b.hidden = false;
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
                <div class="consola-cab">
                    <h2>¿Qué quieres hacer hoy?</h2>
                    <button type="button" class="consola-resumen" id="consolaResumen" hidden></button>
                </div>
                ${PROMPT(IDS_INICIO, 'Ej.: pagar los sueldos, cuánto IVA pago, un proveedor o un RUT', '<button class="consola-go" type="submit">Ir</button>')}
            </div>
            ${LISTA(IDS_INICIO)}`;
        const input = $('cmdConsola');
        // Compacta: la lista se despliega solo mientras se usa el campo
        const abrir = () => { cont.classList.add('abierta'); input.setAttribute('aria-expanded', 'true'); };
        const cerrar = () => { if (input.value) return; cont.classList.remove('abierta'); input.setAttribute('aria-expanded', 'false'); };
        inicio = crearConsola(IDS_INICIO, {
            alEscapeVacio: { siempre: false, fn: () => { input.blur(); cont.classList.remove('abierta'); } },
        });
        inicio.enlazar();
        input.addEventListener('input', () => { abrir(); inicio.render(); });
        input.addEventListener('focus', () => { abrir(); if (!input.value) inicio.render(); });
        cont.addEventListener('focusout', () => setTimeout(() => { if (!cont.contains(document.activeElement)) cerrar(); }, 120));
        $('consolaResumen').addEventListener('click', () => input.focus());
        inicio.render();
    }

    function refrescar() { montar(); resumenCierre(); const i = $('cmdConsola'); if (inicio && i && !i.value) inicio.render(); }

    // ── Paleta: la misma consola sobre cualquier módulo (cabecera y Ctrl K) ───────
    const IDS_PALETA = { input: 'paletaInput', form: 'paletaForm', titulo: 'paletaSugTitulo', lista: 'paletaSugList' };
    let focoPrevio = null;

    function paletaCerrar() {
        const p = $('consolaPaleta');
        if (!p) return;
        p.remove();
        if (focoPrevio && focoPrevio.isConnected && typeof focoPrevio.focus === 'function') focoPrevio.focus();
        focoPrevio = null;
    }

    function enInicio() {
        const v = $('view-inicio'), i = $('cmdConsola');
        return !!(v && v.classList.contains('active') && i && i.offsetParent);
    }

    function paletaAbrir() {
        if (enInicio()) { const i = $('cmdConsola'); i.focus(); i.select(); return; }
        if ($('consolaPaleta')) { $('paletaInput').focus(); return; }
        focoPrevio = document.activeElement;
        const p = document.createElement('div');
        p.id = 'consolaPaleta';
        p.className = 'consola-paleta';
        p.setAttribute('role', 'dialog');
        p.setAttribute('aria-modal', 'true');
        p.setAttribute('aria-label', 'Buscar o hacer algo');
        p.innerHTML = `
            <section class="consola abierta">
                <div class="consola-in">
                    ${PROMPT(IDS_PALETA, 'Busca o escribe qué quieres hacer…', '<kbd class="consola-esc">Esc</kbd>')}
                </div>
                ${LISTA(IDS_PALETA)}
            </section>`;
        document.body.appendChild(p);
        const input = $('paletaInput');
        input.setAttribute('aria-expanded', 'true');
        const c = crearConsola(IDS_PALETA, { alEjecutar: paletaCerrar, alEscapeVacio: { siempre: true, fn: paletaCerrar } });
        c.enlazar();
        input.addEventListener('input', c.render);
        // El foco no sale de la paleta mientras está abierta (Tab no lleva a la página de atrás)
        p.addEventListener('keydown', e => { if (e.key === 'Tab') { e.preventDefault(); input.focus(); } });
        p.addEventListener('mousedown', e => { if (e.target === p) { e.preventDefault(); paletaCerrar(); } });
        c.render();
        input.focus();
    }

    document.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (e.key === 'k' || e.key === 'K')) {
            e.preventDefault();
            paletaAbrir();
        }
    });

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refrescar);
    else refrescar();
    if (window.ContappEventos) {
        ['cliente:datos-cargados', 'cierre:cambiado', 'asiento:registrado', 'libro:guardado', 'documento:en-libro']
            .forEach(ev => ContappEventos.escuchar(ev, refrescar));
    }

    window.consolaRefrescar = refrescar;
    window.consolaAbrir = paletaAbrir;
    window.consolaCerrar = paletaCerrar;
    // Nombres que usaba la búsqueda global (cabecera de index.html y otros llamados)
    window.busquedaGlobalAbrir = paletaAbrir;
    window.busquedaGlobalCerrar = paletaCerrar;
    window.CONSOLA_ACCIONES = ACCIONES;   // para pruebas
    window.consolaPuntaje = puntaje;
    window.consolaBuscarDatos = buscarDatos;
})();
