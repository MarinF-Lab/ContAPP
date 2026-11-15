// Pruebas de firestore.rules v3 con el emulador de Firestore (flujos reales de
// auth-manager.js / firebase-service.js: titular, invitado, acceso por código, ataques).
// Uso, desde auditor/:  npm run test:reglas   (requiere Java; descarga el emulador la 1.ª vez)
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, getDocs,
  serverTimestamp, Timestamp, arrayRemove, arrayUnion, deleteField,
} from 'firebase/firestore';

const RULES = process.argv[2] || 'firestore.rules';
const env = await initializeTestEnvironment({
  projectId: 'contapp-reglas',
  firestore: { rules: readFileSync(RULES, 'utf8'), host: '127.0.0.1', port: 8080 },
});

const T  = 'TitularUid0000000000000001';      // titular (uid estilo Firebase)
const G  = 'InvitadoUid000000000000002';      // invitado registrado
const X  = 'AtacanteUid000000000000003';      // cuenta registrada ajena
const A  = 'AnonimoUid0000000000000004';      // sesión anónima con código
const L  = 'LegacyUid00000000000000005';      // miembro de empresa antigua
const E  = `${T}_1731600000000`;              // cliente del titular (id nuevo)
const EL = 'EMP_LEGACY';                       // cliente con id antiguo
const futuro = Timestamp.fromDate(new Date(Date.now() + 48 * 3600e3));

const reg  = uid => env.authenticatedContext(uid, { email: uid + '@x.cl', firebase: { sign_in_provider: 'password' } }).firestore();
const anon = uid => env.authenticatedContext(uid, { firebase: { sign_in_provider: 'anonymous' } }).firestore();

let ok = 0, mal = 0;
async function caso(nombre, debe, fn) {
  try { await (debe ? assertSucceeds(fn()) : assertFails(fn())); ok++; console.log(`  ✅ ${nombre}`); }
  catch (e) { mal++; console.log(`  ❌ ${nombre} → ${e.message.split('\n')[0]}`); }
}

async function sembrar() {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async c => {
    const db = c.firestore();
    await setDoc(doc(db, 'perfiles', T), { email: 't@x.cl', empresas: [E], codigosActivos: ['ABC123'], invitados: [], estado: 'pendiente_pago', plan: 'auditor', canInvite: true });
    await setDoc(doc(db, 'invitaciones', 'ABC123'), { titularUid: T, titularEmail: 't@x.cl', usada: false, revocada: false, expira: futuro });
    await setDoc(doc(db, 'empresas', E), { empresa: 'Transportes Cordillera' });
    await setDoc(doc(db, 'empresas', E, 'usuarios', T), { rol: 'admin' });
    await setDoc(doc(db, 'empresas', E, 'modulos', 'asientos'), { data: [] });
    await setDoc(doc(db, 'empresas', EL), { empresa: 'Antigua' });
    await setDoc(doc(db, 'empresas', EL, 'usuarios', L), { rol: 'admin' });
    await setDoc(doc(db, 'perfiles', X), { email: 'x@x.cl', empresas: [] });
    await setDoc(doc(db, 'perfiles', G), { email: 'g@x.cl', empresas: [] });
  });
}

// ── Titular ─────────────────────────────────────────────────
await sembrar();
console.log('Titular');
const t = reg(T);
await caso('wizard: crear perfil propio pendiente de pago', true, () =>
  setDoc(doc(reg('NuevoUid00000000000000099'), 'perfiles', 'NuevoUid00000000000000099'), { email: 'n@x.cl', empresas: [], plan: 'auditor', estado: 'pendiente_pago', canInvite: true, codigosActivos: [], invitados: [], creadoEn: serverTimestamp() }));
await caso('registro mínimo (_fbCargarPerfil) sin estado', true, () =>
  setDoc(doc(reg('NuevoUid00000000000000098'), 'perfiles', 'NuevoUid00000000000000098'), { email: 'n@x.cl', empresas: [], creadoEn: serverTimestamp() }));
await caso('✗ crear perfil ya "activo" (saltarse el pago)', false, () =>
  setDoc(doc(reg('NuevoUid00000000000000097'), 'perfiles', 'NuevoUid00000000000000097'), { email: 'n@x.cl', estado: 'activo' }));
await caso('✗ cambiarse el estado a "activo"', false, () => updateDoc(doc(t, 'perfiles', T), { estado: 'activo' }));
await caso('✗ borrarse el estado', false, () => updateDoc(doc(t, 'perfiles', T), { estado: deleteField() }));
const E2 = `${T}_1731600009999`;
await caso('crear cliente con su prefijo', true, () => setDoc(doc(t, 'empresas', E2), { empresa: 'Nueva', estado: 'activo' }));
await caso('inscribirse como admin del cliente', true, () => setDoc(doc(t, 'empresas', E2, 'usuarios', T), { rol: 'admin', email: 't@x.cl' }));
await caso('agregar el cliente a su perfil', true, () => updateDoc(doc(t, 'perfiles', T), { empresas: [E, E2] }));
await caso('leer y sincronizar módulos', true, async () => { await getDoc(doc(t, 'empresas', E, 'modulos', 'asientos')); await setDoc(doc(t, 'empresas', E, 'modulos', 'compras'), { data: [{ id: 1 }] }); });
await caso('✗ módulo con campos extra', false, () => setDoc(doc(t, 'empresas', E, 'modulos', 'compras'), { data: [], otro: 1 }));
await caso('actualizar kanban/cierre/módulos activos del cliente', true, () => updateDoc(doc(t, 'empresas', E), { 'kanbanEstados.2026-10': 'revision', 'cierreResumen.2026-10': { pct: 50 }, modulosActivos: {} }));
await caso('crear invitación', true, () => setDoc(doc(t, 'invitaciones', 'QWE987'), { titularUid: T, titularEmail: 't@x.cl', email: '', expira: futuro, usada: false, revocada: false, creadaEn: serverTimestamp() }));
await caso('registrar el código en su perfil', true, () => updateDoc(doc(t, 'perfiles', T), { codigosActivos: ['ABC123', 'QWE987'] }));
await caso('✗ pasar de 4 invitaciones', false, () => updateDoc(doc(t, 'perfiles', T), { codigosActivos: ['ABC123', 'QWE987', 'A1', 'A2', 'A3'] }));
await caso('✗ crear invitación a nombre de otro', false, () => setDoc(doc(reg(X), 'invitaciones', 'ZZZ111'), { titularUid: T, usada: false, expira: futuro }));

// ── Invitado registrado ─────────────────────────────────────
await sembrar();
console.log('Invitado registrado (canje de código)');
const g = reg(G);
await caso('✗ antes del canje: leer el cliente', false, () => getDoc(doc(g, 'empresas', E)));
await caso('✗ antes del canje: inscribirse como admin (hueco de v2)', false, () => setDoc(doc(g, 'empresas', E, 'usuarios', G), { rol: 'admin' }));
await caso('leer la invitación por código', true, () => getDoc(doc(g, 'invitaciones', 'ABC123')));
await caso('canje 1/3: vincular su perfil', true, () => updateDoc(doc(g, 'perfiles', G), { vinculadoA: T, canInvite: false }));
await caso('✗ canje con usadaPor ajeno', false, () => updateDoc(doc(g, 'invitaciones', 'ABC123'), { usada: true, usadaPor: X, usadaEn: serverTimestamp() }));
await caso('canje 2/3: marcar invitación usada', true, () => updateDoc(doc(g, 'invitaciones', 'ABC123'), { usada: true, usadaPor: G, usadaEn: serverTimestamp() }));
await caso('✗ otro intenta colarse en invitados con el código de G', false, () => updateDoc(doc(reg(X), 'perfiles', T), { codigosActivos: arrayRemove('ABC123'), invitados: arrayUnion(X) }));
await caso('✗ otro se agrega a invitados sin quitar código (hueco de v2)', false, () => updateDoc(doc(reg(X), 'perfiles', T), { invitados: arrayUnion(X) }));
await caso('canje 3/3: perfil del titular (código → invitados)', true, () => updateDoc(doc(g, 'perfiles', T), { codigosActivos: arrayRemove('ABC123'), invitados: arrayUnion(G) }));
await caso('leer el perfil del titular', true, () => getDoc(doc(g, 'perfiles', T)));
await caso('leer el cliente del titular', true, () => getDoc(doc(g, 'empresas', E)));
await caso('✗ inscribirse como admin', false, () => setDoc(doc(g, 'empresas', E, 'usuarios', G), { rol: 'admin' }));
await caso('inscribirse como asistente', true, () => setDoc(doc(g, 'empresas', E, 'usuarios', G), { rol: 'asistente', email: 'g@x.cl', creadoEn: serverTimestamp() }));
await caso('sincronizar módulos', true, () => setDoc(doc(g, 'empresas', E, 'modulos', 'ventas'), { data: [] }));
await caso('✗ subirse el rol a admin', false, () => updateDoc(doc(g, 'empresas', E, 'usuarios', G), { rol: 'admin' }));
await caso('✗ crear clientes propios siendo invitado', false, () => setDoc(doc(g, 'empresas', `${G}_1731600000001`), { empresa: 'Mía' }));
await caso('✗ crear invitaciones siendo invitado', false, () => setDoc(doc(g, 'invitaciones', 'GGG111'), { titularUid: G, usada: false, revocada: false, expira: futuro }));
await caso('auditoría: registrar acción propia', true, () => addDoc(collection(g, 'empresas', E, 'audit_log'), { ts: serverTimestamp(), uid: G, email: 'g@x.cl', rol: 'asistente', accion: 'x', modulo: 'y', detalle: {} }));
await caso('✗ auditoría a nombre de otro', false, () => addDoc(collection(g, 'empresas', E, 'audit_log'), { ts: serverTimestamp(), uid: T, accion: 'x' }));
await caso('✗ leer auditoría sin ser admin', false, () => getDocs(collection(g, 'empresas', E, 'audit_log')));
await caso('titular: subir a G a contador', true, () => updateDoc(doc(t, 'empresas', E, 'usuarios', G), { rol: 'contador' }));
await caso('titular: leer auditoría', true, () => getDocs(collection(t, 'empresas', E, 'audit_log')));
await caso('titular: sacar a G de invitados', true, () => updateDoc(doc(t, 'perfiles', T), { invitados: [] }));
await caso('✗ G ya no lee el cliente', false, () => getDoc(doc(g, 'empresas', E)));
await caso('✗ G ya no sincroniza', false, () => setDoc(doc(g, 'empresas', E, 'modulos', 'ventas'), { data: [] }));

// ── Acceso por código (sesión anónima) ──────────────────────
await sembrar();
console.log('Acceso por código (anónimo)');
const a = anon(A);
await caso('✗ leer el perfil del titular sin perfil propio', false, () => getDoc(doc(a, 'perfiles', T)));
await caso('✗ perfil anónimo con código falso', false, () => setDoc(doc(a, 'perfiles', A), { vinculadoA: T, codigoAcceso: 'NOEXIS', anonimo: true }));
await caso('crear perfil anónimo con código vigente', true, () => setDoc(doc(a, 'perfiles', A), { vinculadoA: T, codigoAcceso: 'ABC123', anonimo: true, creadoEn: serverTimestamp() }));
await caso('leer el perfil del titular', true, () => getDoc(doc(a, 'perfiles', T)));
await caso('leer el cliente', true, () => getDoc(doc(a, 'empresas', E)));
await caso('inscribirse como asistente', true, () => setDoc(doc(a, 'empresas', E, 'usuarios', A), { rol: 'asistente', email: 'Invitado' }));
await caso('sincronizar módulos', true, () => setDoc(doc(a, 'empresas', E, 'modulos', 'compras'), { data: [] }));
await caso('✗ crear clientes', false, () => setDoc(doc(a, 'empresas', `${A}_1731600000001`), { empresa: 'x' }));
await caso('✗ cambiar su código de acceso', false, () => updateDoc(doc(a, 'perfiles', A), { codigoAcceso: 'QWE987' }));
await caso('titular revoca el código', true, () => updateDoc(doc(t, 'invitaciones', 'ABC123'), { revocada: true }));
await caso('✗ tras revocar: leer el cliente', false, () => getDoc(doc(a, 'empresas', E)));
await caso('✗ tras revocar: sincronizar', false, () => setDoc(doc(a, 'empresas', E, 'modulos', 'compras'), { data: [] }));

// ── Ajenos y empresas antiguas ──────────────────────────────
await sembrar();
console.log('Ajenos y empresas con id antiguo');
const x = reg(X);
await caso('✗ ajeno lee el cliente', false, () => getDoc(doc(x, 'empresas', E)));
await caso('✗ ajeno lee el perfil del titular', false, () => getDoc(doc(x, 'perfiles', T)));
await caso('✗ ajeno lista perfiles', false, () => getDocs(collection(x, 'perfiles')));
await caso('✗ ajeno lista invitaciones', false, () => getDocs(collection(x, 'invitaciones')));
await caso('✗ ajeno crea cliente con el prefijo del titular', false, () => setDoc(doc(x, 'empresas', `${T}_1731600000002`), { empresa: 'x' }));
await caso('✗ sin sesión: leer cliente', false, () => getDoc(doc(env.unauthenticatedContext().firestore(), 'empresas', E)));
await caso('miembro de empresa antigua: leer', true, () => getDoc(doc(reg(L), 'empresas', EL)));
await caso('miembro de empresa antigua: sincronizar', true, () => setDoc(doc(reg(L), 'empresas', EL, 'modulos', 'asientos'), { data: [] }));
await caso('✗ ajeno se inscribe en empresa antigua', false, () => setDoc(doc(x, 'empresas', EL, 'usuarios', X), { rol: 'admin' }));
await caso('✗ ajeno lee empresa antigua', false, () => getDoc(doc(x, 'empresas', EL)));
await caso('✗ editar/borrar auditoría', false, async () => {
  let id;
  await env.withSecurityRulesDisabled(async c => { id = (await addDoc(collection(c.firestore(), 'empresas', E, 'audit_log'), { uid: T, accion: 'x' })).id; });
  await deleteDoc(doc(t, 'empresas', E, 'audit_log', id));
});

console.log(`\nResultado: ${ok} OK, ${mal} con error`);
await env.cleanup();
process.exit(mal ? 1 : 0);
