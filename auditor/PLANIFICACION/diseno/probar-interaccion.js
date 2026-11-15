#!/usr/bin/env node
/**
 * probar-interaccion.js — Pruebas en navegador de las correcciones de interacción
 * (gestor de modales, teclado, tema, avisos, Inicio sin conexión).
 * Uso: desde auditor/: python3 -m http.server 8765 &  luego  node PLANIFICACION/diseno/probar-interaccion.js
 * Con --capturas guarda capturas en PLANIFICACION/diseno/correcciones/.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'correcciones') + '/';
const CAPTURAS = process.argv.includes('--capturas'); // sin el flag no reescribe las capturas
if (CAPTURAS) fs.mkdirSync(OUT, { recursive: true });

const fuente = fs.readFileSync(path.join(__dirname, 'capturar-linea-base.js'), 'utf8');
const SEED = fuente.slice(fuente.indexOf('const SEED = () =>') + 'const SEED = '.length, fuente.indexOf('\nconst PANTALLAS')).trim().replace(/;$/, '');

let ok = 0, mal = 0;
function check(nombre, cond, extra) {
  if (cond) { ok++; console.log('  ✅ ' + nombre); }
  else { mal++; console.log('  ❌ ' + nombre + (extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); }
}
const espera = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await chromium.launch();
  const errs = [];

  // ── 1. Tema del sistema sin preferencia guardada ──
  console.log('Tema');
  for (const esquema of ['dark', 'light']) {
    const c = await b.newContext({ colorScheme: esquema });
    const p = await c.newPage();
    await p.goto('http://localhost:8765/index.html');
    await espera(1500);
    const r = await p.evaluate(() => ({
      t: document.documentElement.dataset.theme,
      cs: document.documentElement.style.colorScheme,
      meta: document.querySelector('meta[name="theme-color"]').content,
    }));
    check(`sistema ${esquema} → tema ${esquema} y color-scheme`, r.t === esquema && r.cs === esquema, r);
    check('meta theme-color sigue el fondo', /^#|rgb/.test(r.meta), r.meta);
    await c.close();
  }

  // ── 2. App con datos (modo sin conexión: Firebase bloqueado aquí) ──
  const ctx = await b.newContext({ viewport: { width: 1366, height: 860 } });
  await ctx.addInitScript(`window.__TEMA__='light';(${SEED})()`);
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(e.message + ' @ ' + (e.stack || '').split('\n').slice(0, 3).join(' | ')));
  await p.goto('http://localhost:8765/index.html');
  await espera(8000);

  console.log('Inicio sin conexión (H1)');
  const grupos = await p.evaluate(() => document.querySelectorAll('#homeHubTiles .hh-grupo').length);
  check('el centro de mando muestra grupos sin refrescar a mano', grupos >= 3, grupos);
  if (CAPTURAS) await p.screenshot({ path: OUT + '01-inicio.jpg', type: 'jpeg', quality: 70 });

  console.log('Consola "¿Qué quieres hacer hoy?"');
  let r = await p.evaluate(() => ({
    hay: !!document.getElementById('cmdConsola'),
    antesDelHub: (() => { const c = document.getElementById('homeConsola'), h = document.getElementById('homeHubTiles');
                          return !!(c && h && (c.compareDocumentPosition(h) & Node.DOCUMENT_POSITION_FOLLOWING)); })(),
    sugerencias: document.querySelectorAll('#consolaSugList .sugi').length,
  }));
  check('consola encima del centro de mando, con sugerencias del día', r.hay && r.antesDelHub && r.sugerencias > 0, r);
  r = await p.evaluate(() => getComputedStyle(document.querySelector('#homeConsola .consola-sug')).display);
  check('consola compacta: las sugerencias se ocultan hasta usar el campo', r === 'none', r);
  await p.focus('#cmdConsola');
  await espera(100);
  r = await p.evaluate(() => getComputedStyle(document.querySelector('#homeConsola .consola-sug')).display);
  check('al enfocar el campo se despliegan las sugerencias', r !== 'none', r);
  await p.click('#cmdConsola');
  await p.keyboard.type('pagué 50.000 de arriendo');
  await p.keyboard.press('Enter');
  await espera(500);
  r = await p.evaluate(() => ({ vista: document.querySelector('.view.active')?.id, glosa: document.getElementById('glosaInput')?.value }));
  check('frase con monto → Libro Diario con la glosa escrita', r.vista === 'view-estructura-contable' && r.glosa === 'pagué 50.000 de arriendo', r);
  await p.evaluate(() => { document.getElementById('glosaInput').value = ''; navegar('inicio'); });
  await espera(300);
  await p.fill('#cmdConsola', 'conciliar el banco');
  await espera(100);
  r = await p.evaluate(() => [...document.querySelectorAll('#consolaSugList .sugi b')].map(b => b.textContent));
  check('palabras clave → área relacionada', r[0] === 'Conciliar el banco', r);
  await p.keyboard.press('Escape');
  r = await p.evaluate(() => document.getElementById('cmdConsola').value);
  check('Escape limpia la consola', r === '', r);

  console.log('Teclado');
  const tile = await p.evaluate(() => {
    const b = document.querySelector('#homeHubTiles .hh-mod');
    return b && { tag: b.tagName, txt: b.textContent.trim() };
  });
  check('los módulos del centro de mando son botones (alcanzables con teclado)', tile && tile.tag === 'BUTTON', tile);
  await p.focus('#homeHubTiles .hh-mod');
  await p.keyboard.press('Enter');
  await espera(400);
  const vistaMod = await p.evaluate(() => document.querySelector('.view.active')?.id);
  check('Enter en un módulo del centro de mando lo abre (un clic, sin panel intermedio)', vistaMod && vistaMod !== 'view-inicio', vistaMod);
  await p.evaluate(() => navegar('inicio'));
  await espera(300);
  const ayuda = await p.evaluate(() => [...document.querySelectorAll('button.icon-btn')].filter(b => !b.getAttribute('aria-label') && !b.textContent.trim()).length);
  check('botones de ícono con nombre accesible', ayuda === 0, ayuda);

  console.log('Modal de compra');
  await p.evaluate(() => { navegar('compras'); });
  await espera(500);
  await p.focus('body');
  await p.evaluate(() => { abrirNuevaCompra(); });
  await espera(60);
  const anim = await p.evaluate(() => getComputedStyle(document.querySelector('#modalCompra > *')).animationName);
  check('entrada animada', anim === 'cm-caja-in', anim);
  await espera(250);
  if (CAPTURAS) await p.screenshot({ path: OUT + '02-modal-compra.jpg', type: 'jpeg', quality: 70 });
  r = await p.evaluate(() => ({
    foco: document.getElementById('modalCompra').contains(document.activeElement),
    tag: document.activeElement.tagName,
    scroll: document.documentElement.classList.contains('cm-sin-scroll'),
    aria: document.getElementById('modalCompra').getAttribute('aria-modal'),
  }));
  check('foco al primer campo del modal', r.foco && /INPUT|SELECT|TEXTAREA/.test(r.tag), r);
  check('scroll del fondo bloqueado y aria-modal', r.scroll && r.aria === 'true', r);
  for (let i = 0; i < 80; i++) await p.keyboard.press('Tab');
  r = await p.evaluate(() => document.getElementById('modalCompra').contains(document.activeElement));
  check('Tab no se escapa del modal (80 tabs)', r);
  await p.keyboard.press('Shift+Tab');
  r = await p.evaluate(() => document.getElementById('modalCompra').contains(document.activeElement));
  check('Shift+Tab tampoco', r);

  console.log('Confirmación sobre el modal');
  await p.evaluate(() => mostrarConfirm('¿Descartar los cambios?', () => {}, { titulo: 'Prueba' }));
  await espera(250);
  r = await p.evaluate(() => {
    const c = document.querySelector('.modal-confirm'), m = document.getElementById('modalCompra');
    return { zc: +getComputedStyle(c).zIndex, zm: +getComputedStyle(m).zIndex, foco: c.contains(document.activeElement) };
  });
  check('la confirmación queda encima y con foco', r.zc > r.zm && r.foco, r);
  if (CAPTURAS) await p.screenshot({ path: OUT + '03-confirmacion.jpg', type: 'jpeg', quality: 70 });
  await p.keyboard.press('Escape');
  await espera(200);
  r = await p.evaluate(() => ({
    confirm: !!document.querySelector('.modal-confirm'),
    compra: getComputedStyle(document.getElementById('modalCompra')).display,
  }));
  check('Escape cierra solo la confirmación', !r.confirm && r.compra !== 'none', r);

  await p.keyboard.press('Escape');
  await espera(40);
  r = await p.evaluate(() => ({ cls: document.getElementById('modalCompra').className, d: getComputedStyle(document.getElementById('modalCompra')).display }));
  check('Escape cierra el modal con salida suave', r.cls.includes('cm-saliendo') && r.d !== 'none', r);
  await espera(200);
  r = await p.evaluate(() => ({
    d: getComputedStyle(document.getElementById('modalCompra')).display,
    scroll: document.documentElement.classList.contains('cm-sin-scroll'),
    abiertos: ContappModales.abiertos().length,
  }));
  check('tras la salida queda oculto y el scroll liberado', r.d === 'none' && !r.scroll && r.abiertos === 0, r);

  console.log('Reabrir durante la salida');
  await p.evaluate(() => { abrirNuevaCompra(); });
  await espera(250);
  await p.evaluate(() => { cerrarModalCompra(); setTimeout(() => abrirNuevaCompra(), 40); });
  await espera(400);
  r = await p.evaluate(() => ({ d: getComputedStyle(document.getElementById('modalCompra')).display, cls: document.getElementById('modalCompra').className, n: ContappModales.abiertos().length }));
  check('reabrir a los 40 ms deja el modal abierto', r.d !== 'none' && !r.cls.includes('cm-saliendo') && r.n === 1, r);
  await p.evaluate(() => cerrarModalCompra());
  await espera(300);

  console.log('Avisos');
  await p.evaluate(() => mostrarToast('Aviso informativo de prueba', 'info'));
  await espera(250);
  r = await p.evaluate(() => { const t = document.getElementById('toast-global'); return { cls: t.className, live: t.getAttribute('aria-live'), role: t.getAttribute('role') }; });
  check('aviso info no se ve como error y es anunciado', r.cls.includes('t-info') && r.live === 'polite' && r.role === 'status', r);
  if (CAPTURAS) await p.screenshot({ path: OUT + '04-aviso.jpg', type: 'jpeg', quality: 70 });

  console.log('Pantallas');
  await p.evaluate(() => navegar('cartolas'));
  await espera(800);
  r = await p.evaluate(() => { const b = document.querySelector('.btn-clasificar'); return b && getComputedStyle(b).borderRadius; });
  check('botones de Cartolas con estilo de la app', r && r !== '0px', r);
  if (CAPTURAS) await p.screenshot({ path: OUT + '05-cartolas.jpg', type: 'jpeg', quality: 70 });
  await p.evaluate(() => navegar('mayor'));
  await espera(800);
  if (CAPTURAS) await p.screenshot({ path: OUT + '06-mayor.jpg', type: 'jpeg', quality: 70 });
  await p.evaluate(() => { document.documentElement.setAttribute('data-theme', 'dark'); });
  await espera(300);
  if (CAPTURAS) await p.screenshot({ path: OUT + '07-mayor-oscuro.jpg', type: 'jpeg', quality: 70 });
  await p.evaluate(() => { document.documentElement.setAttribute('data-theme', 'light'); navegar('remuneraciones'); });
  await espera(800);
  const hayRem = await p.evaluate(() => typeof remAbrirModal === 'function');
  if (hayRem) {
    await p.evaluate(() => remAbrirModal());
    await espera(300);
    await p.evaluate(() => {
      const b = [...document.querySelectorAll('#rem-modal button')].find(x => /remModalSec/.test(x.getAttribute('onclick') || ''));
      if (b) b.click();
    });
    await espera(30);
    r = await p.evaluate(() => {
      const m = document.getElementById('rem-modal');
      return { anim: m && getComputedStyle(m.firstElementChild).animationName, n: ContappModales.abiertos().length };
    });
    check('Remuneraciones: cambiar de sección no repite la entrada', r.anim === 'none' && r.n === 1, r);
    await p.mouse.click(5, 5);
    await espera(200);
    r = await p.evaluate(() => !!document.getElementById('rem-modal') && getComputedStyle(document.getElementById('rem-modal')).display !== 'none');
    check('Remuneraciones: clic fuera no cierra el formulario', r);
    await p.keyboard.press('Escape');
    await espera(250);
    r = await p.evaluate(() => !document.getElementById('rem-modal') || getComputedStyle(document.getElementById('rem-modal')).display === 'none');
    check('Remuneraciones: Escape cierra el formulario', r);
  }

  console.log('Login');
  await p.evaluate(() => _fbShowLogin());
  await espera(300);
  r = await p.evaluate(() => ({
    social: document.querySelectorAll('.lsocial button').length,
    tbar: !!document.querySelector('.login-tbar'),
    recordar: !!document.getElementById('loginRecordar'),
  }));
  check('login sin botones que no hacen nada (Google/Microsoft) y con "Recordarme" real', r.social === 0 && r.tbar && r.recordar, r);
  await p.fill('#loginEmail', '');
  await p.click('.lrow .link-btn');
  await espera(200);
  r = await p.evaluate(() => document.getElementById('loginError').textContent);
  check('"¿Olvidaste tu contraseña?" sin correo pide escribirlo', /correo/i.test(r), r);
  await p.evaluate(() => { document.getElementById('login-overlay').style.display = 'none'; });

  console.log('Errores de página:', errs.length ? errs : 'ninguno');
  if (errs.length) mal++;
  console.log(`\nResultado: ${ok} OK, ${mal} con error`);
  await b.close();
  process.exit(mal ? 1 : 0);
})();
