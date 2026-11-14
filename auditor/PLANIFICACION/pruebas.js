#!/usr/bin/env node
/**
 * pruebas.js — Todas las pruebas de ContApp Auditor con un solo comando.
 *
 *   npm test                 verificación estática + pruebas de conectividad (Fases 0-3)
 *   npm run test:navegador   lo anterior + pruebas de interacción en Chromium (Playwright)
 *   npm run test:reglas      reglas de Firestore en el emulador (aparte: requiere Java)
 */
const { spawnSync, spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const NAVEGADOR = process.argv.includes('--navegador');
const PUERTO = 8765; // el que usan probar-interaccion.js y capturar-linea-base.js

const PASOS = [
  ['Verificación estática', 'PLANIFICACION/verificar.js'],
  ['Conectividad · Fase 0 (datos por cliente)', 'PLANIFICACION/test-fase0.js'],
  ['Conectividad · Fase 1 (asientos)', 'PLANIFICACION/test-fase1.js'],
  ['Conectividad · Fase 2 (conexiones)', 'PLANIFICACION/test-fase2.js'],
  ['Conectividad · Fase 3 (cierre del mes)', 'PLANIFICACION/test-fase3.js'],
];

function resumen(salida) {
  const lineas = salida.trim().split('\n');
  const r = lineas.filter(l => /Resultado|❌/.test(l));
  return (r.length ? r : lineas.slice(-1)).map(l => '    ' + l.trim()).join('\n');
}

function correr(nombre, archivo) {
  const r = spawnSync(process.execPath, [archivo], { cwd: RAIZ, encoding: 'utf8' });
  const ok = r.status === 0;
  console.log(`${ok ? '✅' : '❌'} ${nombre}\n${resumen((r.stdout || '') + (r.stderr || ''))}`);
  return ok;
}

// Servidor estático mínimo para la prueba en navegador (sin dependencias)
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
function servidor() {
  return http.createServer((req, res) => {
    const ruta = path.normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^([/\\])+/, '');
    const archivo = path.join(RAIZ, ruta || 'index.html');
    if (!archivo.startsWith(RAIZ) || !fs.existsSync(archivo) || fs.statSync(archivo).isDirectory()) {
      res.writeHead(404); res.end(); return;
    }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(archivo)] || 'application/octet-stream' });
    fs.createReadStream(archivo).pipe(res);
  });
}

(async () => {
  let todoOk = true;
  for (const [nombre, archivo] of PASOS) todoOk = correr(nombre, archivo) && todoOk;

  if (NAVEGADOR) {
    const srv = servidor();
    await new Promise((ok, mal) => srv.once('error', mal).listen(PUERTO, ok)).catch(e => {
      console.log(`❌ No se pudo abrir el puerto ${PUERTO}: ${e.message}`); process.exit(1);
    });
    const ok = await new Promise(fin => {
      let salida = '';
      const p = spawn(process.execPath, ['PLANIFICACION/diseno/probar-interaccion.js'], { cwd: RAIZ });
      p.stdout.on('data', d => { salida += d; });
      p.stderr.on('data', d => { salida += d; });
      p.on('close', code => {
        console.log(`${code === 0 ? '✅' : '❌'} Interacción en navegador\n${resumen(salida)}`);
        fin(code === 0);
      });
    });
    srv.close();
    todoOk = ok && todoOk;
  } else {
    console.log('ℹ️  Prueba en navegador: npm run test:navegador · Reglas de Firestore: npm run test:reglas');
  }

  console.log(todoOk ? '\n🎉 Todas las pruebas pasaron.' : '\n⚠️  Hay pruebas con error.');
  process.exit(todoOk ? 0 : 1);
})();
