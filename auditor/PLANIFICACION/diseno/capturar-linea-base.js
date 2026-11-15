#!/usr/bin/env node
/**
 * capturar-linea-base.js — Capturas de 19 pantallas en tema claro y oscuro (Etapa 0 / Etapa 6).
 * Uso: desde auditor/: python3 -m http.server 8765 &  luego  node PLANIFICACION/diseno/capturar-linea-base.js
 * Requiere Playwright (require('playwright')). Guarda JPG en PLANIFICACION/diseno/linea-base/.
 */
const { chromium } = require('playwright');
const OUT = require('path').join(__dirname, process.argv[2] || 'linea-base') + '/';
require('fs').mkdirSync(OUT, { recursive: true });
const SEED = () => {
  if (sessionStorage.getItem('seeded')) return;
  sessionStorage.setItem('seeded', '1');
  const S = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  localStorage.setItem('core_migracion_aislamiento_v1', 'x');
  localStorage.setItem('core_datos_empresa_id', 'EMP_A');
  localStorage.setItem('appTheme', window.__TEMA__);
  S('core_periodo_trabajo', { mes: 10, anio: 2026 });
  S('_fb_perfil_local', {uid:'u1',email:'demo@estudio.cl',rol:'admin',categoria:'primera',empresaId:'EMP_A',empresaNombre:'Transportes Cordillera Ltda.'});
  S('core_config', {empresa:'Transportes Cordillera Ltda.', rut:'77.105.228-1'});
  const A = (id, n, f, g, movs, extra) => ({ id, numero:n, estado:'ACTIVO', fecha:f, glosa:g, movimientos:movs, ...(extra||{}) });
  S('core_asientos', [
    A(1,1,'01/10/2026','Aporte de capital',[{cuenta:'Banco',debe:20000000,haber:0},{cuenta:'Capital',debe:0,haber:20000000}]),
    A(2,2,'31/10/2026','Centralización Compras Octubre 2026 — 3 doc(s)',[{cuenta:'Mercaderías',debe:1500000,haber:0},{cuenta:'IVA Crédito Fiscal',debe:285000,haber:0},{cuenta:'Proveedores',debe:0,haber:1785000}],{origen:'compras',origen_ref:'2026-10'}),
    A(3,3,'31/10/2026','Centralización Ventas Octubre 2026 — 2 doc(s)',[{cuenta:'Clientes',debe:3570000,haber:0},{cuenta:'Ingresos por Ventas',debe:0,haber:3000000},{cuenta:'IVA Débito Fiscal',debe:0,haber:570000}],{origen:'ventas',origen_ref:'2026-10'}),
    A(4,4,'15/10/2026','Pago arriendo oficina',[{cuenta:'Arriendos',debe:850000,haber:0},{cuenta:'Banco',debe:0,haber:850000}]),
  ]);
  S('core_compras', [
    {id:11,fecha:'02/10/2026',mes:10,anio:2026,tipo_doc:'factura',numero_doc:'41221',rut_proveedor:'76.111.111-1',nombre_proveedor:'Molinera del Sur S.A.',medio_pago:'credito',exento:0,neto:1000000,iva:190000,total:1190000,estado:'pagada'},
    {id:12,fecha:'05/10/2026',mes:10,anio:2026,tipo_doc:'factura',numero_doc:'8812',rut_proveedor:'76.222.222-2',nombre_proveedor:'Distribuidora Andes Ltda.',medio_pago:'credito',exento:0,neto:380000,iva:72200,total:452200,estado:'pendiente'},
    {id:13,fecha:'09/10/2026',mes:10,anio:2026,tipo_doc:'factura',numero_doc:'19004',rut_proveedor:'76.333.333-3',nombre_proveedor:'Envases Pacífico SpA',medio_pago:'transferencia',exento:0,neto:120000,iva:22800,total:142800,estado:'pagada'}]);
  S('core_ventas', [
    {id:21,fecha:'10/10/2026',mes:10,anio:2026,tipo_doc:'factura',numero_doc:'301',rut_cliente:'78.000.000-1',nombre_cliente:'Cafetería Sur',medio_pago:'credito',exento:0,neto:2000000,iva:380000,total:2380000,estado:'pendiente'},
    {id:22,fecha:'18/10/2026',mes:10,anio:2026,tipo_doc:'factura',numero_doc:'302',rut_cliente:'78.111.111-2',nombre_cliente:'Minimarket Norte',medio_pago:'transferencia',exento:0,neto:1000000,iva:190000,total:1190000,estado:'pagada'}]);
  S('core_documentos', [
    {id:31,categoria:'compra_materia',fecha:'20/10/2026',numero_doc:'555',rut:'76.111.111-1',nombre:'Molinera del Sur S.A.',neto:100000,iva:19000,total:119000,estado:'pendiente'},
    {id:32,categoria:'honorarios',fecha:'22/10/2026',numero_doc:'88',rut:'15.000.000-1',nombre:'Diseñadora Paz',neto:500000,iva:0,total:500000,estado:'pendiente'}]);
  S('core_cartola_movs', [
    {id:'m1',fecha:'2026-10-05',descripcion:'TRANSF MOLINERA DEL SUR',cargo:1190000,abono:0,banco:'bci',estado:'pendiente'},
    {id:'m2',fecha:'2026-10-15',descripcion:'ARRIENDO OFICINA',cargo:850000,abono:0,banco:'bci',estado:'ignorado',cuenta_banco:'Banco',cuenta_contrapartida:'Arriendos'}]);
  S('rem_trabajadores', [{id:'t1',nombre:'Ana Soto',rut:'12.345.678-5',cargo:'Administrativa',sueldoBruto:900000,afp:'Habitat',sistemaSalud:'Fonasa',tipoContrato:'indefinido',fechaIngreso:'2024-01-01'}]);
  S('core_activos', [{id:'a1',nombre:'Notebook contabilidad',fecha_adquisicion:'2026-03-01',valor_adquisicion:800000,vida_util_anos:6,metodo:'lineal',cuenta_activo:'Equipos Computacionales',activo:true}]);
  S('core_contactos', [{id:1,rut:'76.111.111-1',nombre:'Molinera del Sur S.A.',tipo:'proveedor',activo:true},{id:2,rut:'78.000.000-1',nombre:'Cafetería Sur',tipo:'cliente',activo:true}]);
};
const PANTALLAS = [
  ['01-inicio-centro-de-mando', p => p.evaluate(() => { navegar('inicio'); irASeccion && irASeccion(0); })],
  ['02-inicio-financiero', p => p.evaluate(() => { navegar('inicio'); irASeccion(1); })],
  ['03-inicio-configuracion', p => p.evaluate(() => { navegar('inicio'); irASeccion(2); })],
  ['04-libro-diario', p => p.evaluate(() => navegar('diario'))],
  ['05-libro-mayor', p => p.evaluate(() => navegar('mayor'))],
  ['06-balance', p => p.evaluate(() => navegar('balance'))],
  ['07-estado-resultados', p => p.evaluate(() => navegar('estado-resultados'))],
  ['08-libro-compras', p => p.evaluate(() => navegar('compras'))],
  ['09-libro-ventas', p => p.evaluate(() => navegar('ventas'))],
  ['10-iva-f29', p => p.evaluate(() => navegar('iva-resumen'))],
  ['11-documentos', p => p.evaluate(() => navegar('documentos'))],
  ['12-cartolas', p => p.evaluate(() => navegar('cartolas'))],
  ['13-conciliacion', p => p.evaluate(() => navegar('reconciliacion'))],
  ['14-remuneraciones', p => p.evaluate(() => navegar('remuneraciones'))],
  ['15-activos-fijos', p => p.evaluate(() => navegar('activos'))],
  ['16-clientes-proveedores', p => p.evaluate(() => navegar('clientes'))],
  ['17-configuracion', p => p.evaluate(() => navegar('configuracion'))],
  ['18-modal-compra', p => p.evaluate(() => { navegar('compras'); abrirNuevaCompra(); })],
];
(async () => {
  const b = await chromium.launch();
  const errs = [];
  for (const tema of ['light', 'dark']) {
    const ctx = await b.newContext({ viewport: { width: 1366, height: 860 } });
    await ctx.addInitScript(`window.__TEMA__='${tema}';(${SEED.toString()})()`);
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(tema + ': ' + e.message));
    await p.goto('http://localhost:8765/index.html');
    await p.waitForTimeout(8000);
    for (const [nombre, fn] of PANTALLAS) {
      try { await fn(p); } catch (e) { errs.push(nombre + ': ' + e.message); }
      await p.waitForTimeout(700);
      await p.screenshot({ path: OUT + `${nombre}-${tema === 'light' ? 'claro' : 'oscuro'}.jpg`, type: 'jpeg', quality: 62 });
    }
    await ctx.close();
    // Login: sin datos locales (Firebase no responde en este entorno)
    const c2 = await b.newContext({ viewport: { width: 1366, height: 860 } });
    await c2.addInitScript(`try{localStorage.setItem('appTheme','${tema}')}catch(e){}`);
    const p2 = await c2.newPage();
    await p2.goto('http://localhost:8765/index.html'); await p2.waitForTimeout(7500);
    await p2.screenshot({ path: OUT + `00-login-${tema === 'light' ? 'claro' : 'oscuro'}.jpg`, type: 'jpeg', quality: 62 });
    await c2.close();
  }
  console.log('ERRORES:', errs.length ? errs.join('\n') : 'ninguno');
  await b.close();
})();
