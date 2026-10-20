/* ═══════════════════════════════════════════════════════════════════
   CALZADOS ISA ARENAS · crear un usuario administrador (rol isa | konfio)
   SIN contraseñas incrustadas: se pasan por parámetro o variable de entorno.

   LOCAL (emuladores, para desarrollo):
     node scripts/crear-usuario.mjs <email> <rol> [contraseña]
     # rol: 'isa' (admin de su catálogo) o 'konfio' (superadmin)
     # si no pones contraseña, se lee de ISA_PASSWORD / KZF_PASSWORD / PASSWORD
     #   o se pide por teclado.

   PRODUCCIÓN (se recomienda Firebase Console, sin instalar nada):
     1) Firebase Console → Authentication → Add user (correo + contraseña).
     2) Copiar el UID del usuario.
     3) Firestore → crear documento `usuarios/<UID>` con:
          email: "<correo>", nombre: "<nombre>", rol: "isa" | "konfio"
   También puede hacerse con Firebase Admin SDK si se dispone de una clave de
   servicio (NO se versiona aquí): ver sección "Con Admin SDK" al final.

   ⚠️ Nunca escribas contraseñas reales en este archivo ni en el repo.
   ═══════════════════════════════════════════════════════════════════ */
import readline from 'node:readline/promises';

const HOST = '127.0.0.1';
const AUTH = `http://${HOST}:9099/identitytoolkit.googleapis.com/v1/accounts:signUp`;
const SIGNIN = `http://${HOST}:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword`;
const FS = `http://${HOST}:8080/v1/projects/isa-arenas/databases/(default)/documents`;

function aCampo(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(aCampo) } };
  const fields = {}; for (const [k, val] of Object.entries(v)) fields[k] = aCampo(val);
  return { mapValue: { fields } };
}
function documento(obj) { const fields = {}; for (const [k, v] of Object.entries(obj)) fields[k] = aCampo(v); return { fields }; }

const [, , email, rol, passArg] = process.argv;
const ROLES = { isa: 'isa', konfio: 'konfio' };
if (!email || !ROLES[rol]) {
  console.error('Uso: node scripts/crear-usuario.mjs <email> <isa|konfio> [contraseña]');
  process.exit(2);
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Correo no válido: ' + email);
  process.exit(2);
}

const envPass = process.env[rol === 'konfio' ? 'KZF_PASSWORD' : 'ISA_PASSWORD'] || process.env.PASSWORD;
let password = passArg || envPass || '';
if (!password) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  password = await rl.question('Contraseña para ' + email + ': ');
  rl.close();
}
if (password.length < 8) { console.error('La contraseña debe tener al menos 8 caracteres.'); process.exit(2); }

async function post(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + (j.error && j.error.message || '').slice(0, 120));
  return j;
}
async function putUsuario(uid, datos) {
  const r = await fetch(`${FS}/usuarios/${uid}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer owner' }, body: JSON.stringify(documento(datos)) });
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + (await r.text()).slice(0, 160));
}

try {
  let uid;
  try { uid = (await post(AUTH + '?key=demo-key', { email, password })).localId; }
  catch (e) {
    if (String(e.message).includes('EMAIL_EXISTS')) uid = (await post(SIGNIN + '?key=demo-key', { email, password })).localId;
    else throw e;
  }
  await putUsuario(uid, { email, nombre: rol === 'konfio' ? 'KONFÍO ZINC' : email.split('@')[0].toUpperCase(), rol });
  console.log('✓ usuario listo → ' + email + ' (rol ' + rol + ')');
  console.log('  local (emulador): ya puede entrar en el panel.');
  console.log('  producción: sigue el procedimiento con Firebase Console indicado arriba.');
} catch (e) {
  console.error('Error: ' + e.message);
  process.exit(1);
}
