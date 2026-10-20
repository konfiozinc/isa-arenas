'use strict';
/* Verificación directa de las REGLAS de Firestore (no del panel): comprueba
   acceso autorizado y denegado contra el emulador real, usando los idToken de
   los usuarios demo del emulador de Auth. No necesita Playwright.
   Uso (con emuladores ya corriendo): node herramientas/probar-reglas.cjs
   Re-semilla con `node scripts/sembrar-emulador.mjs` antes si hace falta. */
const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key';
const FS = 'http://127.0.0.1:8080/v1/projects/isa-arenas/databases/(default)/documents';
let pasos = 0, fallos = 0;
const ok = (c, n, d = '') => { pasos++; if (!c) fallos++; console.log(`  [${c ? 'PASA' : '**FALLA**'}] ${n}${d ? ' — ' + d : ''}`); };

async function signIn(email, password) {
  const r = await fetch(AUTH, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }) });
  if (!r.ok) throw new Error('signIn ' + r.status);
  const j = await r.json();
  return { uid: j.localId, token: j.idToken };
}
function hdr(token) { return token ? { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' }; }
async function get(path, token) { return fetch(FS + path, { headers: hdr(token) }); }
async function patch(path, body, token) { return fetch(FS + path, { method: 'PATCH', headers: hdr(token), body: JSON.stringify(body) }); }

(async () => {
  const isa = await signIn('isa@demo.local', 'DemoIsa2026');
  const kzf = await signIn('admin@konfiozinc.local', 'DemoKonfio2026');

  // ── Catálogo: lectura pública, escritura solo admin ──
  ok((await get('/catalogo/publico', null)).status === 200, 'público: lectura anónima permitida');
  ok((await get('/catalogo/borrador', null)).status === 403, 'borrador: lectura anónima DENEGADA');
  ok((await patch('/catalogo/publico', { fields: { _probe: { stringValue: 'x' } } }, null)).status === 403, 'público: escritura anónima DENEGADA');
  ok((await patch('/catalogo/borrador', { fields: { _probe: { stringValue: 'x' } } }, null)).status === 403, 'borrador: escritura anónima DENEGADA');

  ok((await get('/catalogo/borrador', isa.token)).status === 200, 'borrador: lectura ISA (admin) permitida');
  ok((await patch('/catalogo/borrador', { fields: { _probe: { stringValue: 'ok' } } }, isa.token)).status === 200, 'borrador: escritura ISA (admin) permitida');
  ok((await patch('/catalogo/publico', { fields: { _probe: { stringValue: 'ok' } } }, kzf.token)).status === 200, 'público: publicación KONFÍO (superadmin) permitida');

  // ── Usuarios: separación de roles ──
  ok((await get('/usuarios/' + isa.uid, isa.token)).status === 200, 'usuarios: ISA lee su propia ficha');
  ok((await get('/usuarios', isa.token)).status === 403, 'usuarios: ISA NO puede listar (requiere superadmin)');
  ok((await patch('/usuarios/' + isa.uid, { fields: { rol: { stringValue: 'konfio' } } }, isa.token)).status === 403, 'usuarios: ISA NO puede cambiar roles');
  ok((await get('/usuarios', kzf.token)).status === 200, 'usuarios: KONFÍO (superadmin) sí lista');

  console.log(`\n═══ Resumen reglas ═══\n  pasos: ${pasos} · fallos: ${fallos}`);
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error('ERROR', e); process.exit(2); });
