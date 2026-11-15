#!/usr/bin/env node
/**
 * datos-extremos.js — Prueba de datos extremos (skill break-ui), solo para desarrollo.
 * Carga en localStorage un conjunto de "peor caso realista" (mismo formato que los datos de ejemplo
 * de capturar-linea-base.js) y recorre las pantallas a 1366 y 390 px, en claro y oscuro.
 * Estados: demo · peor · vacio · uno · mil (1.000 compras).
 * Uso (servidor en :8765): node PLANIFICACION/diseno/datos-extremos.js [estado...]
 * Capturas en PLANIFICACION/diseno/extremos/<estado>/.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// ── Conjuntos de datos (se inyectan en la página: deben ser JSON puro) ──────────────
const LARGO = 'Sociedad Comercializadora e Inversiones Agrícolas del Valle de Aconcagua y Quillota Limitada';
const PROV = [
  ['76.111.111-1', 'Distribuidora Mayorista de Productos Alimenticios e Insumos Industriales Hermanos Fernández-Bustamante SpA'],
  ['76.222.222-2', 'Jo'],
  ['77.333.333-K', "Ferretería <El Tornillo> & Hijos de José O'Higgins Ltda."],
  ['76.444.444-4', 'Ñandú Comercial Ñuñoa'],
  ['96.555.555-5', 'Empresa Nacional de Telecomunicaciones Móviles, Fijas, Satelitales y de Servicios Digitales S.A.'],
];
function compra(i, base) {
  const [rut, nom] = PROV[i % PROV.length];
  const neto = base[i % base.length];
  return { id: 100 + i, fecha: `${String(1 + (i % 28)).padStart(2, '0')}/10/2026`, mes: 10, anio: 2026, tipo_doc: i % 7 === 3 ? 'nota_credito' : 'factura',
    numero_doc: String(9000000000 + i * 37), rut_proveedor: rut, nombre_proveedor: nom, medio_pago: ['credito', 'transferencia', 'efectivo', 'cheque'][i % 4],
    exento: i % 5 === 0 ? 125000000 : 0, neto, iva: Math.round(neto * 0.19), total: Math.round(neto * 1.19) + (i % 5 === 0 ? 125000000 : 0),
    estado: ['pagada', 'pendiente', 'anulada'][i % 3], glosa: i === 0 ? 'Pago factura correspondiente a despacho de harina tipo 4 lote 2026-10-A, bodega Quilicura, con descuento por pronto pago del 3,5% acordado con el área comercial' : '' };
}
const MONTOS = [1234567890, 1, -1190000, 0, 999999999, 45000];

const ESTADOS = {
  demo: null,   // datos de ejemplo de capturar-linea-base.js
  peor: {
    empresa: LARGO, rut: '76.123.456-K',
    compras: Array.from({ length: 6 }, (_, i) => compra(i, MONTOS)),
    documentos: [
      { id: 31, categoria: 'compra_materia', fecha: '20/10/2026', numero_doc: '9000000123456', rut: PROV[0][0], nombre: PROV[0][1], neto: 1234567890, iva: 234567899, total: 1469135789, estado: 'pendiente' },
      { id: 32, categoria: 'honorarios', fecha: '22/10/2026', numero_doc: '1', rut: '15.000.000-1', nombre: 'María de los Ángeles Fernández-Bustamante Echeverría', neto: 1, iva: 0, total: 1, estado: 'pagada' },
      { id: 33, categoria: 'venta_factura', fecha: '23/10/2026', numero_doc: '88', rut: PROV[2][0], nombre: PROV[2][1], neto: 0, iva: 0, total: 0, estado: 'anulada' },
    ],
    trabajadores: [
      { id: 't1', nombre: 'María de los Ángeles Fernández-Bustamante Echeverría', rut: '12.345.678-5', cargo: 'Encargada de administración, finanzas y recursos humanos de la sucursal Quilicura', sueldoBruto: 12500000, afp: 'PlanVital', sistemaSalud: 'Isapre Colmena Golden Cross', tipoContrato: 'plazo_fijo', fechaIngreso: '2024-01-01' },
      { id: 't2', nombre: 'Jo', rut: '9.876.543-K', cargo: '', sueldoBruto: 529000, afp: 'Habitat', sistemaSalud: 'Fonasa', tipoContrato: 'indefinido', fechaIngreso: '2026-10-31' },
      { id: 't3', nombre: "Seán O'Brien-Ó Súilleabháin", rut: '25.111.222-3', cargo: 'Operario', sueldoBruto: 0, afp: 'Modelo', sistemaSalud: 'Fonasa', tipoContrato: 'indefinido', fechaIngreso: '2026-03-15' },
    ],
    contactos: [
      { id: 1, rut: PROV[0][0], nombre: PROV[0][1], tipo: 'proveedor', email: 'bartholomew.fitzgerald@northwind-industries-holdings.example.com', telefono: '+56 9 8765 4321', giro: 'Venta al por mayor de alimentos, bebidas, tabaco, insumos agrícolas e industriales', activo: true },
      { id: 2, rut: PROV[1][0], nombre: PROV[1][1], tipo: 'cliente', activo: true },
      { id: 3, rut: PROV[2][0], nombre: PROV[2][1], tipo: 'ambos', email: 'a@b.test', activo: true },
    ],
    asientoGlosa: 'Centralización Compras Octubre 2026 — 1.284 doc(s) de proveedores nacionales y extranjeros con diferencias de cambio',
    cuentaLarga: 'Provisión por Deterioro de Deudores Comerciales y Otras Cuentas por Cobrar Corrientes',
  },
  vacio: { empresa: 'Mi Empresa', rut: '', compras: [], documentos: [], trabajadores: [], contactos: [], sinAsientos: true },
  uno: { empresa: 'Uno SpA', rut: '76.000.001-1', compras: [compra(1, [45000])], documentos: [{ id: 1, categoria: 'honorarios', fecha: '22/10/2026', numero_doc: '1', rut: '15.000.000-1', nombre: 'Ana', neto: 1, iva: 0, total: 1, estado: 'pendiente' }],
         trabajadores: [{ id: 't1', nombre: 'Ana', rut: '12.345.678-5', cargo: 'Administrativa', sueldoBruto: 529000, afp: 'Habitat', sistemaSalud: 'Fonasa', tipoContrato: 'indefinido', fechaIngreso: '2024-01-01' }],
         contactos: [{ id: 1, rut: '76.111.111-1', nombre: 'Ana', tipo: 'cliente', activo: true }] },
  mil: { empresa: 'Transportes Cordillera Ltda.', rut: '77.105.228-1', compras: Array.from({ length: 1000 }, (_, i) => compra(i, [1000000, 380000, 120000, 45000])) },
};

// Siembra: igual que el demo de capturar-linea-base.js y luego pisa con el estado elegido
function sembrar(estado, d) {
  if (sessionStorage.getItem('seeded')) return;
  sessionStorage.setItem('seeded', '1');
  const S = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  localStorage.setItem('core_migracion_aislamiento_v1', 'x');
  localStorage.setItem('core_datos_empresa_id', 'EMP_A');
  localStorage.setItem('appTheme', window.__TEMA__);
  S('core_periodo_trabajo', { mes: 10, anio: 2026 });
  const emp = d ? d.empresa : 'Transportes Cordillera Ltda.';
  S('_fb_perfil_local', { uid: 'u1', email: 'bartholomew.fitzgerald@northwind-industries-holdings.example.com', rol: 'admin', categoria: 'primera', empresaId: 'EMP_A', empresaNombre: emp });
  S('core_config', { empresa: emp, rut: d ? d.rut : '77.105.228-1' });
  const A = (id, n, f, g, movs, extra) => ({ id, numero: n, estado: 'ACTIVO', fecha: f, glosa: g, movimientos: movs, ...(extra || {}) });
  const cta = d && d.cuentaLarga ? d.cuentaLarga : 'Arriendos';
  S('core_asientos', d && d.sinAsientos ? [] : [
    A(1, 1, '01/10/2026', 'Aporte de capital', [{ cuenta: 'Banco', debe: 20000000000, haber: 0 }, { cuenta: 'Capital', debe: 0, haber: 20000000000 }]),
    A(2, 2, '31/10/2026', d && d.asientoGlosa ? d.asientoGlosa : 'Centralización Compras Octubre 2026', [{ cuenta: 'Mercaderías', debe: 1500000, haber: 0 }, { cuenta: 'IVA Crédito Fiscal', debe: 285000, haber: 0 }, { cuenta: 'Proveedores', debe: 0, haber: 1785000 }], { origen: 'compras', origen_ref: '2026-10' }),
    A(3, 3, '15/10/2026', 'Ajuste', [{ cuenta: cta, debe: 850000, haber: 0 }, { cuenta: 'Banco', debe: 0, haber: 850000 }]),
  ]);
  if (d) {
    if (d.compras) S('core_compras', d.compras);
    if (d.documentos) S('core_documentos', d.documentos);
    if (d.trabajadores) S('rem_trabajadores', d.trabajadores);
    if (d.contactos) S('core_contactos', d.contactos);
  }
}

const PANTALLAS = [
  ['inicio', p => p.evaluate(() => navegar('inicio'))],
  ['compras', p => p.evaluate(() => navegar('compras'))],
  ['documentos', p => p.evaluate(() => navegar('documentos'))],
  ['remuneraciones', p => p.evaluate(() => { navegar('remuneraciones'); })],
  ['clientes', p => p.evaluate(() => navegar('clientes'))],
  ['diario', p => p.evaluate(() => navegar('diario'))],
  ['mayor', p => p.evaluate(() => navegar('mayor'))],
  ['mis-clientes', p => p.evaluate(est => {
    const per = (() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); })();
    const C = est === 'vacio' ? [] : est === 'uno' ? [{ id: 'A', empresa: 'Uno SpA', rut: '76.000.001-1', categoria: 'primera' }] : [
      { id: 'A', empresa: 'Sociedad Comercializadora e Inversiones Agrícolas del Valle de Aconcagua y Quillota Limitada', rut: '76.123.456-K', categoria: 'primera', cierreResumen: { [per]: { avance: 1, pendientes: ['Documentos registrados en libros', 'Cartola importada y contabilizada', 'Conciliación bancaria cuadrada', 'Sueldos enviados al Libro Diario'], cerrado: false, modificaciones: 12 } } },
      { id: 'B', empresa: 'Jo', categoria: 'segunda' },
      { id: 'C', empresa: "Ferretería <El Tornillo> & Hijos de José O'Higgins Ltda.", rut: '77.333.333-K', categoria: 'primera', cierreResumen: { [per]: { avance: 100, pendientes: [], cerrado: true } } },
      ...Array.from({ length: est === 'mil' ? 60 : 3 }, (_, i) => ({ id: 'Z' + i, empresa: 'Cliente ' + (i + 1), rut: '76.' + String(100 + i) + '.000-1', categoria: 'primera' })),
    ];
    document.querySelectorAll('.view.active').forEach(v => v.classList.remove('active'));
    document.getElementById('view-empresa').classList.add('active');
    document.getElementById('home-header').style.display = 'none';
    panelEstudioInicializar(C);
  }, p.__estado)],
];

(async () => {
  const pedidos = process.argv.slice(2).filter(a => ESTADOS.hasOwnProperty(a));
  const estados = pedidos.length ? pedidos : ['peor', 'vacio', 'uno', 'mil'];
  const b = await chromium.launch();
  const hallazgos = [];
  for (const est of estados) {
    const OUT = path.join(__dirname, 'extremos', est) + '/';
    fs.mkdirSync(OUT, { recursive: true });
    for (const [tema, ancho] of [['light', 1366], ['dark', 390]]) {
      const ctx = await b.newContext({ viewport: { width: ancho, height: 860 } });
      await ctx.addInitScript(`window.__TEMA__='${tema}';(${sembrar.toString()})(${JSON.stringify(est)}, ${JSON.stringify(ESTADOS[est])})`);
      const p = await ctx.newPage();
      p.__estado = est;
      const errs = [];
      p.on('pageerror', e => errs.push(e.message));
      await p.goto('http://localhost:8765/index.html');
      await p.waitForTimeout(6500);
      for (const [nombre, fn] of PANTALLAS) {
        const t0 = Date.now();
        await fn(p).catch(e => errs.push(nombre + ': ' + e.message));
        await p.waitForTimeout(500);
        const ms = Date.now() - t0 - 500;
        const r = await p.evaluate(() => {
          const visible = el => { const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
          const fuera = [...document.querySelectorAll('.view.active *, #panelEstudioContainer *')].filter(el => {
            if (!visible(el) || el.children.length) return false;
            const b = el.getBoundingClientRect();
            if (b.right <= innerWidth + 1) return false;
            for (let x = el.parentElement; x; x = x.parentElement) { const o = getComputedStyle(x).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') return false; }
            return true;
          }).slice(0, 4).map(el => el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '') + ' «' + (el.textContent || '').trim().slice(0, 40) + '»');
          const crudo = /\b(undefined|NaN|null)\b|\[object Object\]/.exec(document.querySelector('.view.active, #panelEstudioContainer')?.innerText || '');
          const plural = /\b1 (documentos|módulos|trabajadores|clientes|movimientos|secciones)\b/.exec(document.querySelector('.view.active')?.innerText || '');
          return { scroll: document.documentElement.scrollWidth - innerWidth, fuera, crudo: crudo && crudo[0], plural: plural && plural[0] };
        });
        if (r.scroll > 1) hallazgos.push([est, tema, ancho, nombre, 'desplazamiento horizontal de página ' + r.scroll + 'px']);
        if (r.fuera.length) hallazgos.push([est, tema, ancho, nombre, 'se sale de la pantalla: ' + r.fuera.join(' · ')]);
        if (r.crudo) hallazgos.push([est, tema, ancho, nombre, 'texto crudo: ' + r.crudo]);
        if (r.plural) hallazgos.push([est, tema, ancho, nombre, 'plural incorrecto: ' + r.plural]);
        if (est === 'mil' && ms > 1500) hallazgos.push([est, tema, ancho, nombre, `tarda ${ms} ms en dibujar`]);
        await p.screenshot({ path: `${OUT}${nombre}-${ancho}.jpg`, type: 'jpeg', quality: 70 });
      }
      errs.forEach(e => hallazgos.push([est, tema, ancho, '—', 'error de página: ' + e]));
      await ctx.close();
    }
  }
  await b.close();
  console.log(hallazgos.length ? hallazgos.map(h => h.join(' | ')).join('\n') : 'Sin hallazgos automáticos');
  console.log(`\nHallazgos automáticos: ${hallazgos.length} · capturas en PLANIFICACION/diseno/extremos/`);
})();
