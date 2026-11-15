#!/usr/bin/env node
/**
 * contraste.js — Mide el contraste (WCAG) de las combinaciones de colores de css/variables.css
 * en tema claro y oscuro. Falla si algún texto no llega a 4,5:1 (AA).
 * Uso: node PLANIFICACION/diseno/contraste.js   (también corre con `npm test`)
 */
const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '..', '..', 'css', 'variables.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');

function bloque(selector) {
  const i = css.indexOf(selector + ' {');
  const cuerpo = css.slice(i, css.indexOf('}', i));
  const vars = {};
  for (const m of cuerpo.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) vars[m[1]] = m[2].trim();
  return vars;
}
const claro = bloque(':root');
const oscuro = { ...claro, ...bloque('[data-theme="dark"]') };

function resolver(vars, nombre, prof = 0) {
  const v = vars[nombre];
  if (!v || prof > 10) return null;
  const ref = v.match(/^var\((--[\w-]+)(?:,\s*([^)]+))?\)$/);
  if (ref) return resolver(vars, ref[1], prof + 1) || (ref[2] || null);
  return /^#[0-9a-f]{6}$/i.test(v) ? v : null;
}
function lum(hex) {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const contraste = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

// [texto, fondo] — lo que la app realmente combina
const PARES = [];
for (const fondo of ['--card', '--bg', '--table-stripe']) {
  for (const texto of ['--text', '--text-muted', '--text-subtle', '--accent', '--positive', '--negative', '--warning', '--info']) {
    PARES.push([texto, fondo]);
  }
}
PARES.push(['--on-accent', '--accent'], ['--on-accent', '--primary-hover'],
  ['--on-state', '--negative'], ['--on-state', '--positive'], ['--on-state', '--info'], ['--on-state', '--warning'],
  ['--positive', '--positive-soft'], ['--negative', '--negative-soft'], ['--warning', '--warning-soft'],
  ['--info', '--info-soft'], ['--accent', '--accent-soft'], ['--text', '--accent-soft'],
  ['--text', '--positive-soft'], ['--text', '--negative-soft'], ['--text', '--warning-soft'],
  ['--text', '--input-bg'], ['--text-subtle', '--input-bg'], ['--on-screen', '--screen']);

let ok = 0, mal = 0;
for (const [nombreTema, vars] of [['claro', claro], ['oscuro', oscuro]]) {
  console.log(`\n══ Tema ${nombreTema} ══`);
  for (const [t, f] of PARES) {
    const a = resolver(vars, t), b = resolver(vars, f);
    if (!a || !b) { console.log(`  ❌ ${t} / ${f}: no se pudo resolver el color`); mal++; continue; }
    const r = contraste(a, b);
    if (r >= 4.5) ok++; else { mal++; console.log(`  ❌ ${r.toFixed(2)}  ${t} (${a}) sobre ${f} (${b})`); }
  }
}
console.log(`\nResultado: ${ok} OK, ${mal} con error (mínimo AA 4,5:1)`);
process.exit(mal ? 1 : 0);
