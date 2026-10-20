/* ═══════════════════════════════════════════════════════════════════
   CALZADOS ISA ARENAS · sembrar el entorno de desarrollo
   Crea las cuentas demo y el catálogo inicial SOLO contra los emuladores
   locales (Auth :9099 · Firestore :8080). No toca Firebase de producción.

   Uso (con emuladores ya corriendo):
     node scripts/sembrar-emulador.mjs

   Credenciales demo (ficticias, solo emulador):
     · ISA  → isa@demo.local       / DemoIsa2026    (rol isa)
     · KZF  → admin@konfiozinc.local / DemoKonfio2026 (rol konfio)
   ═══════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';

const HOST = '127.0.0.1';
const AUTH = `http://${HOST}:9099/identitytoolkit.googleapis.com/v1/accounts:signUp`;
const FS_BASE = `http://${HOST}:8080/v1/projects/isa-arenas/databases/(default)/documents`;
const KEY = 'demo-key';

// JSON → formato REST de Firestore
function aCampo(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(aCampo) } };
  const fields = {}; for (const [k, val] of Object.entries(v)) fields[k] = aCampo(val);
  return { mapValue: { fields } };
}
function documento(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) fields[k] = aCampo(v);
  return { fields };
}

async function post(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + (await r.text()).slice(0, 120));
  return r.json();
}
async function signUp(email, password) {
  let j;
  try { j = await post(AUTH + '?key=' + KEY, { email, password, returnSecureToken: true }); }
  catch (e) {
    if (String(e.message).includes('EMAIL_EXISTS')) {
      const r = await fetch(AUTH.replace('signUp', 'signInWithPassword') + '?key=' + KEY, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }) });
      j = await r.json();
    } else throw e;
  }
  return j.localId;
}
async function putUsuario(uid, datos) {
  const r = await fetch(`${FS_BASE}/usuarios/${uid}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer owner' }, body: JSON.stringify(documento(datos)) });
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + (await r.text()).slice(0, 160));
}
async function putCatalogo(docId, obj) {
  const r = await fetch(`${FS_BASE}/catalogo/${docId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer owner' }, body: JSON.stringify(documento(obj)) });
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + (await r.text()).slice(0, 160));
}

const isaUid = await signUp('isa@demo.local', 'DemoIsa2026');
const kzfUid = await signUp('admin@konfiozinc.local', 'DemoKonfio2026');
await putUsuario(isaUid, { email: 'isa@demo.local', nombre: 'ISA ARENAS', rol: 'isa' });
await putUsuario(kzfUid, { email: 'admin@konfiozinc.local', nombre: 'KONFÍO ZINC', rol: 'konfio' });

const catalogo = JSON.parse(fs.readFileSync('content/catalogo.json', 'utf8'));
await putCatalogo('borrador', catalogo);
await putCatalogo('publico', catalogo);

console.log('✓ sembrado: 2 usuarios (isa, konfio) + catálogo borrador/publico');
console.log('  ISA  → isa@demo.local / DemoIsa2026');
console.log('  KZF  → admin@konfiozinc.local / DemoKonfio2026');
