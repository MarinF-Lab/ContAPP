#!/usr/bin/env node
/**
 * revisar-texto.js — Revisa que el texto no quede pegado a los bordes ni se salga de su caja.
 * Recorre todas las vistas y sus pestañas (más algunos formularios), en tema claro y oscuro,
 * a 1366px y 390px de ancho. Para cada texto visible mide:
 *   · separación con el borde/fondo de la caja que lo contiene (< 4px = "pegado")
 *   · desborde: el texto se sale de su caja o queda cortado
 * Agrupa los hallazgos por componente (clases CSS) para saber qué estilo arreglar.
 *
 * Uso (desde auditor/, con un servidor en el puerto 8765):
 *   node PLANIFICACION/diseno/revisar-texto.js            → resumen
 *   node PLANIFICACION/diseno/revisar-texto.js --json f   → además guarda el detalle en f
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const fuente = fs.readFileSync(path.join(__dirname, 'capturar-linea-base.js'), 'utf8');
const SEED = fuente.slice(fuente.indexOf('const SEED = () =>') + 'const SEED = '.length,
  fuente.indexOf('\nconst PANTALLAS')).trim().replace(/;$/, '');
const iJson = process.argv.indexOf('--json');
const SALIDA_JSON = iJson > -1 ? process.argv[iJson + 1] : null;

const VISTAS = ['inicio', 'diario', 'mayor', 'balance', 'estado-resultados', 'compras', 'ventas',
  'iva-resumen', 'documentos', 'cartolas', 'remuneraciones', 'activos', 'clientes', 'configuracion'];
const FORMULARIOS = [
  ['compras', 'abrirNuevaCompra()'],
  ['ventas', "typeof abrirNuevaVenta === 'function' && abrirNuevaVenta()"],
  ['remuneraciones', "typeof remAbrirModal === 'function' && remAbrirModal()"],
  ['clientes', "typeof abrirModalContacto === 'function' && abrirModalContacto()"],
];

// Se ejecuta en la página: devuelve hallazgos de la pantalla actual
function medir() {
  const MIN = 4;
  const visible = el => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false;
    }
    return true;
  };
  const transparente = c => c === 'rgba(0, 0, 0, 0)' || c === 'transparent';
  // ¿Esta caja dibuja un límite visible? (borde, fondo propio distinto del de su padre, sombra)
  function esCaja(el) {
    const s = getComputedStyle(el);
    const borde = ['Top', 'Right', 'Bottom', 'Left'].some(l => parseFloat(s['border' + l + 'Width']) > 0 &&
      !transparente(s['border' + l + 'Color']) && s['border' + l + 'Style'] !== 'none');
    let fondo = !transparente(s.backgroundColor);
    if (fondo && el.parentElement) {
      // fondo igual al del contenedor visible más cercano = no marca un límite
      for (let p = el.parentElement; p; p = p.parentElement) {
        const bg = getComputedStyle(p).backgroundColor;
        if (!transparente(bg)) { if (bg === s.backgroundColor) fondo = false; break; }
      }
    }
    return borde || fondo || (s.boxShadow !== 'none' && !s.boxShadow.includes('inset'));
  }
  const firma = el => {
    const partes = [];
    for (let e = el, i = 0; e && i < 3 && e !== document.body; e = e.parentElement, i++) {
      const c = (typeof e.className === 'string' ? e.className : '').trim().split(/\s+/).filter(x => x && !/^(active|activo|abierto)$/.test(x)).slice(0, 2).join('.');
      partes.unshift(e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (c ? '.' + c : ''));
    }
    return partes.join(' > ');
  };
  const vista = () => {
    const v = [...document.querySelectorAll('.view.active, .mod-tab-panel.active')].filter(visible).pop();
    return v ? (v.id || v.className) : '?';
  };
  const out = [];
  const raiz = [...document.querySelectorAll('.modal-overlay, .modal-confirm, #rem-modal, #modalDocumento, [data-modal]')]
    .filter(m => getComputedStyle(m).display !== 'none' && visible(m)).pop() || document.body;
  const caminante = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT, {
    acceptNode: n => n.textContent.trim().length > 1 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
  });
  const vistos = new Set();
  let n;
  while ((n = caminante.nextNode())) {
    const el = n.parentElement;
    if (!el || vistos.has(el) || !visible(el)) continue;
    if (/^(SCRIPT|STYLE|OPTION|TITLE|NOSCRIPT)$/.test(el.tagName)) continue;
    if (el.closest('#app-topbar .topbar-icons, .skip-link, #toast-global, svg')) continue;
    vistos.add(el);
    const rango = document.createRange();
    rango.selectNodeContents(n);
    const rects = [...rango.getClientRects()].filter(r => r.width > 1 && r.height > 1);
    if (!rects.length) continue;
    const t = {
      left: Math.min(...rects.map(r => r.left)), right: Math.max(...rects.map(r => r.right)),
      top: Math.min(...rects.map(r => r.top)), bottom: Math.max(...rects.map(r => r.bottom)),
    };
    // Caja que lo contiene
    let caja = null;
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      if (esCaja(e)) { caja = e; break; }
    }
    const texto = n.textContent.trim().replace(/\s+/g, ' ').slice(0, 50);
    if (caja && caja !== document.body) {
      const s = getComputedStyle(caja), r = caja.getBoundingClientRect();
      const bL = parseFloat(s.borderLeftWidth), bR = parseFloat(s.borderRightWidth);
      const bT = parseFloat(s.borderTopWidth), bB = parseFloat(s.borderBottomWidth);
      const sep = {
        izq: t.left - (r.left + bL), der: (r.right - bR) - t.right,
        arr: t.top - (r.top + bT), aba: (r.bottom - bB) - t.bottom,
      };
      // Las celdas de tabla comparten bordes verticales: solo cuentan izq/der
      const lados = caja.tagName === 'TD' || caja.tagName === 'TH' ? ['izq', 'der'] : ['izq', 'der', 'arr', 'aba'];
      const pegados = lados.filter(l => sep[l] < MIN && sep[l] > -50);
      const fuera = lados.filter(l => sep[l] <= -2);
      if (fuera.length) out.push({ tipo: 'desborde', vista: vista(), firma: firma(el), caja: firma(caja), texto, lados: fuera, sep });
      else if (pegados.length) out.push({ tipo: 'pegado', vista: vista(), firma: firma(el), caja: firma(caja), texto, lados: pegados, sep });
    }
    // Texto cortado (overflow oculto sin puntos suspensivos) o que se sale horizontalmente
    const s = getComputedStyle(el);
    if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0 && s.overflowX !== 'visible' && s.textOverflow !== 'ellipsis' &&
        !/^(auto|scroll)$/.test(s.overflowX)) {
      out.push({ tipo: 'cortado', vista: vista(), firma: firma(el), caja: firma(el), texto, lados: [], sep: { falta: el.scrollWidth - el.clientWidth } });
    }
  }
  // Scroll horizontal de la página completa
  if (document.documentElement.scrollWidth > window.innerWidth + 1) {
    out.push({ tipo: 'scroll-horizontal', vista: vista(), firma: 'página', caja: 'página', texto: '', lados: [], sep: { ancho: document.documentElement.scrollWidth } });
  }
  return out;
}

(async () => {
  const b = await chromium.launch();
  const todos = [];
  for (const tema of ['light', 'dark']) {
    for (const ancho of [1366, 390]) {
      const ctx = await b.newContext({ viewport: { width: ancho, height: 860 } });
      await ctx.addInitScript(`window.__TEMA__='${tema}';(${SEED})()`);
      const p = await ctx.newPage();
      await p.goto('http://localhost:8765/index.html');
      await p.waitForTimeout(6500);
      const anotar = (hall, extra) => hall.forEach(h => todos.push({ ...h, tema, ancho, ...extra }));
      for (const v of VISTAS) {
        await p.evaluate(v => { navegar(v); }, v).catch(() => {});
        await p.waitForTimeout(450);
        const nTabs = await p.evaluate(() => [...document.querySelectorAll('.view.active .mod-tab-btn')].filter(b => b.offsetWidth).length);
        for (let i = 0; i < Math.max(nTabs, 1); i++) {
          if (nTabs) {
            await p.evaluate(i => [...document.querySelectorAll('.view.active .mod-tab-btn')].filter(b => b.offsetWidth)[i].click(), i);
            await p.waitForTimeout(350);
          }
          if (v === 'inicio') {
            for (const s of [0, 1, 2]) {
              await p.evaluate(s => window.irASeccion && irASeccion(s), s); await p.waitForTimeout(350);
              anotar(await p.evaluate(medir), { pantalla: 'inicio-' + s });
            }
            break;
          }
          anotar(await p.evaluate(medir), { pantalla: v + '#' + i });
        }
      }
      for (const [v, abrir] of FORMULARIOS) {
        await p.evaluate(v => navegar(v), v); await p.waitForTimeout(350);
        await p.evaluate(abrir).catch(() => {}); await p.waitForTimeout(400);
        anotar(await p.evaluate(medir), { pantalla: 'form:' + v });
        await p.keyboard.press('Escape'); await p.waitForTimeout(250);
      }
      await ctx.close();
    }
  }
  await b.close();

  // Agrupar por componente
  const grupos = new Map();
  for (const h of todos) {
    const k = h.tipo + ' | ' + h.firma + ' | ' + h.lados.join(',');
    if (!grupos.has(k)) grupos.set(k, { ...h, veces: 0, pantallas: new Set(), contextos: new Set() });
    const g = grupos.get(k); g.veces++; g.pantallas.add(h.pantalla); g.contextos.add(h.tema[0] + h.ancho);
  }
  const lista = [...grupos.values()].sort((a, b) => b.pantallas.size - a.pantallas.size || b.veces - a.veces);
  const porTipo = {};
  lista.forEach(g => { porTipo[g.tipo] = (porTipo[g.tipo] || 0) + 1; });
  console.log('Componentes con problemas por tipo:', porTipo, '· hallazgos totales:', todos.length);
  for (const g of lista) {
    console.log(`\n[${g.tipo}] ${g.firma}  lados:${g.lados.join(',') || '-'}  ×${g.veces}  en ${g.pantallas.size} pantalla(s) [${[...g.contextos].join(' ')}]`);
    console.log(`   caja: ${g.caja} · "${g.texto}" · sep ${JSON.stringify(Object.fromEntries(Object.entries(g.sep).map(([k, v]) => [k, Math.round(v)])))}`);
    console.log(`   pantallas: ${[...g.pantallas].slice(0, 6).join(', ')}${g.pantallas.size > 6 ? ' …' : ''}`);
  }
  if (SALIDA_JSON) fs.writeFileSync(SALIDA_JSON, JSON.stringify(lista.map(g => ({ ...g, pantallas: [...g.pantallas], contextos: [...g.contextos] })), null, 1));
})();
