/* Verificación de CONEXIÓN REAL al proyecto Firebase de ISA (producción).
   No usa emuladores. Comprueba:
     · que el apiKey web es válido (Auth REST),
     · que las reglas desplegadas se comportan igual que en el emulador
       (lectura anónima permitida solo en `publico`; escrituras denegadas;
       autenticado SIN rol no puede escribir).
   Uso: node herramientas/probar-produccion.mjs
   ⚠️ Crea UN usuario de prueba en Auth (email con marca de tiempo). Bórralo
   luego en la consola de Firebase si quieres. La contraseña es aleatoria y
   NO se guarda. */
import { randomBytes } from 'node:crypto';

const API_KEY = 'AIzaSyDWGO2YtkELMRTYYSb4Rq2Mc40dpyMQYso';
const PROYECTO = 'isa-arenas';
const AUTH = 'https://identitytoolkit.googleapis.com/v1';
const FS = `https://firestore.googleapis.com/v1/projects/${PROYECTO}/databases/(default)/documents`;

let pasos = 0, fallos = 0;
const ok = (c, n, d = '') => { pasos++; if (!c) fallos++; console.log(`  [${c ? 'PASA' : '**FALLA**'}] ${n}${d ? ' — ' + d : ''}`); };
const hdr = (token) => token ? { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };

const email = `prueba-conn-${Date.now()}@isa-arenas.com`;
const password = randomBytes(9).toString('base64url') + 'Aa1!';

async function signUp() {
  const r = await fetch(`${AUTH}/accounts:signUp?key=${API_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }) });
  const j = await r.json();
  return { status: r.status, body: j };
}
async function signIn() {
  const r = await fetch(`${AUTH}/accounts:signInWithPassword?key=${API_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }) });
  const j = await r.json();
  return { status: r.status, body: j };
}
async function get(path, token) { return fetch(FS + path, { headers: hdr(token) }); }
async function patch(path, body, token) { return fetch(FS + path, { method: 'PATCH', headers: hdr(token), body: JSON.stringify(body) }); }

(async () => {
  // 1) Auth: apiKey válido (signUp crea el usuario de prueba)
  const up = await signUp();
  const authOk = up.status === 200 && up.body.localId && up.body.idToken;
  ok(authOk, 'Auth real: apiKey válido y sign-up del usuario de prueba', authOk ? email : ('HTTP ' + up.status + ' ' + (up.body.error && up.body.error.message)));

  // 2) sign-in del usuario de prueba → idToken
  const si = await signIn();
  const token = si.body.idToken;
  ok(si.status === 200 && token, 'Auth real: sign-in del usuario de prueba OK');

  // 3) Reglas desplegadas (mismo comportamiento que el emulador)
  const pubAnon = await get('/catalogo/publico', null);
  ok(pubAnon.status !== 403, 'Reglas: lectura anónima de `publico` permitida (vacío)', 'HTTP ' + pubAnon.status);
  const borrAnon = await get('/catalogo/borrador', null);
  ok(borrAnon.status === 403, 'Reglas: lectura anónima de `borrador` DENEGADA', 'HTTP ' + borrAnon.status);
  const writeAnon = await patch('/catalogo/publico', { fields: { _probe: { stringValue: 'x' } } }, null);
  ok(writeAnon.status === 403, 'Reglas: escritura anónima de `publico` DENEGADA', 'HTTP ' + writeAnon.status);

  if (token) {
    const writeRol = await patch('/catalogo/borrador', { fields: { _probe: { stringValue: 'x' } } }, token);
    ok(writeRol.status === 403, 'Reglas: usuario autenticado SIN rol no puede escribir', 'HTTP ' + writeRol.status);
  } else {
    ok(false, 'Reglas: usuario autenticado SIN rol no puede escribir', 'sin token');
  }

  console.log(`\n═══ Resumen producción ═══\n  pasos: ${pasos} · fallos: ${fallos}`);
  console.log(`  Usuario de prueba creado: ${email} (borrar en consola si se desea)`);
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error('ERROR', e); process.exit(2); });
