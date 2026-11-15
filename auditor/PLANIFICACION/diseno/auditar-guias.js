#!/usr/bin/env node
/**
 * auditar-guias.js — Revisión con las reglas de web-design-guidelines (vercel-labs/web-interface-guidelines)
 * sobre la app real en el navegador (después de que modales.js agrega roles y nombres accesibles)
 * y sobre el código fuente. Uso (servidor en :8765): node PLANIFICACION/diseno/auditar-guias.js
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const RAIZ = path.join(__dirname, '..', '..');
const fuente = fs.readFileSync(path.join(__dirname, 'capturar-linea-base.js'), 'utf8');
const SEED = fuente.slice(fuente.indexOf('const SEED = () =>') + 'const SEED = '.length,
  fuente.indexOf('\nconst PANTALLAS')).trim().replace(/;$/, '');

const VISTAS = ['inicio', 'diario', 'mayor', 'balance', 'plan-cuentas', 'estado-resultados', 'flujo-caja', 'compras', 'ventas',
  'honorarios', 'iva-resumen', 'documentos', 'cartolas', 'reconciliacion', 'remuneraciones', 'activos', 'productos',
  'centros-costo', 'bodegas', 'movimientos-inventario', 'clientes', 'configuracion'];

function medir() {
  const vis = el => { const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false;
    for (let e = el; e; e = e.parentElement) { const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden') return false; } return true; };
  const nombre = el => (el.getAttribute('aria-label') || '').trim() || (el.getAttribute('aria-labelledby') ? 'x' : '') ||
    (el.labels && el.labels.length ? 'x' : '') || (el.getAttribute('title') || '').trim();
  const sig = el => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
  const out = [];
  document.querySelectorAll('input:not([type=hidden]), select, textarea').forEach(el => {
    if (!vis(el)) return;
    if (!nombre(el)) out.push(['Formularios', 'campo sin <label> ni aria-label', sig(el) + (el.placeholder ? ` (placeholder «${el.placeholder.slice(0, 30)}»)` : '')]);
  });
  document.querySelectorAll('button, [role=button], a').forEach(el => {
    if (!vis(el)) return;
    const txt = (el.innerText || '').replace(/[\s✕×▾▸›‹←→↑↓⋯…]+/g, '').trim();
    if (!txt && !nombre(el)) out.push(['Accesibilidad', 'botón solo con ícono sin aria-label', sig(el)]);
  });
  document.querySelectorAll('[onclick]').forEach(el => {
    if (!vis(el) || /^(BUTTON|A|INPUT|SELECT|LABEL|OPTION)$/.test(el.tagName)) return;
    if (/^\s*event\.stopPropagation\(\);?\s*$/.test(el.getAttribute('onclick'))) return;
    if ((el.tagName !== 'TR' && el.getAttribute('role') !== 'button') || el.tabIndex < 0) out.push(['Accesibilidad', '<div>/<span> con onclick sin role/tabindex', sig(el)]);
  });
  document.querySelectorAll('img').forEach(el => {
    if (!vis(el)) return;
    if (!el.hasAttribute('alt')) out.push(['Imágenes', 'img sin alt', sig(el)]);
    if (!el.getAttribute('width') || !el.getAttribute('height')) out.push(['Imágenes', 'img sin width/height', sig(el) + ' ' + (el.getAttribute('src') || '').slice(-30)]);
  });
  document.querySelectorAll('select').forEach(el => {
    if (!vis(el)) return; const s = getComputedStyle(el);
    if (s.backgroundColor === 'rgba(0, 0, 0, 0)') out.push(['Tema', 'select sin background-color explícito', sig(el)]);
  });
  return out;
}

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1366, height: 860 } });
  await ctx.addInitScript(`window.__TEMA__='light';(${SEED})()`);
  const p = await ctx.newPage();
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(6500);
  const hall = new Map();
  for (const v of VISTAS) {
    await p.evaluate(v => navegar(v), v).catch(() => {}); await p.waitForTimeout(450);
    for (const [cat, regla, el] of await p.evaluate(medir)) {
      const k = cat + '|' + regla + '|' + el;
      if (!hall.has(k)) hall.set(k, { cat, regla, el, vistas: new Set() });
      hall.get(k).vistas.add(v);
    }
  }
  for (const [v, abrir] of [['compras', 'abrirNuevaCompra()'], ['ventas', 'abrirNuevaVenta && abrirNuevaVenta()'], ['clientes', 'abrirModalContacto && abrirModalContacto()']]) {
    await p.evaluate(v => navegar(v), v); await p.waitForTimeout(300);
    await p.evaluate(abrir).catch(() => {}); await p.waitForTimeout(400);
    for (const [cat, regla, el] of await p.evaluate(medir)) {
      const k = cat + '|' + regla + '|' + el;
      if (!hall.has(k)) hall.set(k, { cat, regla, el, vistas: new Set() });
      hall.get(k).vistas.add('form:' + v);
    }
    await p.keyboard.press('Escape'); await p.waitForTimeout(250);
  }
  await b.close();

  // Reglas sobre el código fuente
  const css = ['main.css', 'home-hub.css', 'auditor.css', 'remuneraciones.css', 'variables.css'].map(f => fs.readFileSync(path.join(RAIZ, 'css', f), 'utf8')).join('\n');
  const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
  const fuenteChecks = [
    ['Animación', '`transition: all`', (css.match(/transition:\s*all/g) || []).length],
    ['Animación', 'sin prefers-reduced-motion', /prefers-reduced-motion/.test(css) ? 0 : 1],
    ['Foco', ':focus-visible definido', /:focus-visible/.test(css) ? 0 : 1],
    ['Tipografía', '"..." en vez de "…" (index.html)', (html.match(/\.\.\.(?![\w$.\[{(])/g) || []).filter(Boolean).length],
    ['Anti-patrón', 'user-scalable=no / maximum-scale', /user-scalable=no|maximum-scale/.test(html) ? 1 : 0],
    ['Tema', 'color-scheme definido', /color-scheme/.test(css) ? 0 : 1],
    ['Áreas seguras', 'env(safe-area-inset-*)', /safe-area-inset/.test(css) ? 0 : 1],
    ['Accesibilidad', 'enlace "saltar al contenido"', /skip-link/.test(html) ? 0 : 1],
    ['Tipografía', 'text-wrap: balance en títulos', /text-wrap:\s*balance/.test(css) ? 0 : 1],
    ['Tipografía', 'tabular-nums en cifras', /tabular-nums/.test(css) ? 0 : 1],
  ];

  const lista = [...hall.values()];
  const porRegla = {};
  lista.forEach(h => { porRegla[h.cat + ' · ' + h.regla] = (porRegla[h.cat + ' · ' + h.regla] || 0) + 1; });
  console.log('== En la app (22 vistas + 3 formularios) ==');
  Object.entries(porRegla).forEach(([r, n]) => console.log(`  ${n.toString().padStart(3)}  ${r}`));
  if (process.argv.includes('--detalle')) lista.forEach(h => console.log(`     ${h.cat} · ${h.regla}: ${h.el}  [${[...h.vistas].slice(0, 3).join(', ')}]`));
  console.log('== En el código ==');
  fuenteChecks.forEach(([c, r, n]) => console.log(`  ${n ? '❌' : '✅'} ${c} · ${r}${n ? ' (' + n + ')' : ''}`));
  const total = lista.length + fuenteChecks.filter(c => c[2]).length;
  console.log(`\nHallazgos: ${total}`);
})();
