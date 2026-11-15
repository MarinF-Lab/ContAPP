#!/usr/bin/env node
/**
 * probar-movil.js — Comprobaciones de uso en celular (Etapa 5, guía mobile-native).
 * Emula un iPhone con pantalla táctil (Playwright). Verifica lo que se puede medir desde código;
 * el hover pegado, el zoom de iOS, la muesca y el teclado se confirman en un teléfono real.
 * Uso (desde auditor/, servidor en :8765): node PLANIFICACION/diseno/probar-movil.js [--capturas]
 */
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');

const fuente = fs.readFileSync(path.join(__dirname, 'capturar-linea-base.js'), 'utf8');
const SEED = fuente.slice(fuente.indexOf('const SEED = () =>') + 'const SEED = '.length,
  fuente.indexOf('\nconst PANTALLAS')).trim().replace(/;$/, '');
const OUT = path.join(__dirname, 'etapa5') + '/';
const CAPTURAS = process.argv.includes('--capturas');
if (CAPTURAS) fs.mkdirSync(OUT, { recursive: true });

let ok = 0, mal = 0;
const check = (n, c, x) => { if (c) { ok++; console.log('  ✅ ' + n); } else { mal++; console.log('  ❌ ' + n + (x !== undefined ? ' → ' + JSON.stringify(x) : '')); } };
const espera = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await chromium.launch();
  const errs = [];
  for (const tema of ['light', 'dark']) {
    const ctx = await b.newContext({ ...devices['iPhone 13'] });
    await ctx.addInitScript(`window.__TEMA__='${tema}';(${SEED})()`);
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://localhost:8765/index.html');
    await espera(6500);
    console.log(`Celular · tema ${tema}`);

    if (tema === 'light') {
      const r = await p.evaluate(() => ({
        viewport: document.querySelector('meta[name="viewport"]').content,
        themes: document.querySelectorAll('meta[name="theme-color"]').length,
        tap: getComputedStyle(document.documentElement).webkitTapHighlightColor,
        overscroll: getComputedStyle(document.documentElement).overscrollBehaviorY,
        hoverMouse: matchMedia('(hover: hover) and (pointer: fine)').matches,
        touch: getComputedStyle(document.querySelector('button')).touchAction,
      }));
      check('viewport-fit=cover y sin bloquear el zoom', /viewport-fit=cover/.test(r.viewport) && !/user-scalable=no|maximum-scale/.test(r.viewport), r.viewport);
      check('theme-color para tema claro y oscuro', r.themes === 2, r.themes);
      check('sin destello al tocar', /rgba\(0, 0, 0, 0\)|transparent/.test(r.tap), r.tap);
      check('sin "tirar para recargar" sobre la app', r.overscroll === 'none', r.overscroll);
      check('táctil: los :hover de mouse no aplican', r.hoverMouse === false, r.hoverMouse);
      check('botones sin espera de doble toque (touch-action: manipulation)', r.touch === 'manipulation', r.touch);
    }

    // Pantallas principales: sin desplazamiento horizontal
    for (const [nombre, fn] of [
      ['inicio', () => navegar('inicio')], ['diario', () => navegar('diario')], ['compras', () => navegar('compras')],
      ['documentos', () => navegar('documentos')], ['cartolas', () => navegar('cartolas')],
      ['remuneraciones', () => navegar('remuneraciones')], ['activos', () => navegar('activos')],
      ['configuracion', () => navegar('configuracion')],
    ]) {
      await p.evaluate(fn); await espera(400);
      const ancho = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      check(`${nombre}: sin desplazamiento horizontal`, ancho <= 1, ancho);
      if (CAPTURAS) await p.screenshot({ path: `${OUT}${nombre}-${tema === 'light' ? 'claro' : 'oscuro'}.jpg`, type: 'jpeg', quality: 72 });
    }

    if (tema === 'light') {
      // Campos de 16px (iOS hace zoom con menos)
      await p.evaluate(() => { navegar('compras'); abrirNuevaCompra(); });
      await espera(400);
      const tam = await p.evaluate(() => [...document.querySelectorAll('#modalCompra input:not([type=checkbox]), #modalCompra select')]
        .filter(e => e.offsetWidth).map(e => parseFloat(getComputedStyle(e).fontSize)));
      check('campos del formulario con letra ≥ 16px', tam.length && Math.min(...tam) >= 16, Math.min(...tam));
      await p.evaluate(() => cerrarModalCompra()); await espera(300);

      // Hover pegado: tocar un botón secundario no lo deja "resaltado"
      await p.evaluate(() => navegar('compras')); await espera(300);
      const sel = '#view-egresos-ingresos .btn-export-print';
      const antes = await p.evaluate(s => getComputedStyle(document.querySelector(s)).backgroundColor, sel);
      await p.tap('#view-egresos-ingresos .btn-export-print').catch(() => {});
      await espera(250);
      await p.evaluate(() => { document.querySelectorAll('.modal-overlay, .modal-confirm').forEach(m => m.style.display = 'none'); });
      const despues = await p.evaluate(s => getComputedStyle(document.querySelector(s)).backgroundColor, sel);
      check('tocar un botón no lo deja resaltado (hover pegado)', antes === despues, { antes, despues });

      // Respuesta al presionar (escala en :active)
      const t = await p.evaluate(() => {
        const r = [...document.styleSheets].flatMap(s => { try { return [...s.cssRules]; } catch (e) { return []; } })
          .find(r => r.selectorText && r.selectorText.includes('.btn:active') && /scale/.test(r.cssText));
        return !!r;
      });
      check('los botones reaccionan al presionar (:active)', t);
    }
    await ctx.close();
  }
  check('sin errores de página', errs.length === 0, errs);
  console.log(`\nResultado: ${ok} OK, ${mal} con error`);
  await b.close();
  process.exit(mal ? 1 : 0);
})();
