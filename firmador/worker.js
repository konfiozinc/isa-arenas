/* ═══════════════════════════════════════════════════════════════════
   CALZADOS ISA ARENAS · Servicio firmador de subidas Cloudinary
   (Cloudflare Worker aislado · plan gratuito)

   Sustituye el preset unsigned por SUBIDA FIRMADA en servidor:

     1. Verifica el token de Firebase Auth (delegado a Firebase, vía
        accounts:lookup) → obtenemos el uid real del solicitante.
     2. Lee `usuarios/{uid}` en Firestore CON el propio token del usuario:
        las reglas ya exigen que el uid coincida (solo el dueño lee su ficha)
        → obtenemos el `rol` sin necesidad de cuenta de servicio.
     3. Si `rol` es `isa` o `konfio`, firma los parámetros Cloudinary
        (carpeta + timestamp) con HMAC-SHA1 usando el API Secret, que vive
        SOLO en variables de entorno (nunca en el navegador ni en el repo).

   Secretos requeridos (npx wrangler secret put):
     CLOUDINARY_API_KEY    (pública, identifica la cuenta Cloudinary)
     CLOUDINARY_API_SECRET (SECRETA: firma las subidas; no va al frontend)
   ═══════════════════════════════════════════════════════════════════ */

const PROYECTO = 'isa-arenas';
const FIREBASE_API_KEY = 'AIzaSyDWGO2YtkELMRTYYSb4Rq2Mc40dpyMQYso'; // pública (web)
const CARPETA = 'isa-arenas';
const ROLES_PERMITIDOS = ['isa', 'konfio'];

// Orígenes autorizados a llamar al firmador desde un navegador.
const ORIGENES = [
  'https://konfiozinc.github.io',
  'http://127.0.0.1:5170',
  'http://localhost:5170',
];

function cors(request) {
  const o = (request.headers.get('Origin') || '').trim();
  const permitido = ORIGENES.indexOf(o) !== -1 ? o : ORIGENES[0];
  return {
    'Access-Control-Allow-Origin': permitido,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
    'Content-Type': 'application/json',
  };
}

// ── Límite suave por IP (por aislado; endurecer con WAF/rate-limit de CF) ──
const LIMITE = 20, VENTANA = 60 * 1000;
const _cubetas = new Map();
function superaLimite(request) {
  const ip = request.headers.get('CF-Connecting-IP') || 'sin-ip';
  const ahora = Date.now();
  const e = _cubetas.get(ip);
  if (e && ahora - e.t0 < VENTANA) { if (e.n >= LIMITE) return true; e.n++; return false; }
  _cubetas.set(ip, { t0: ahora, n: 1 });
  return false;
}

async function uidDeToken(idToken) {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  const j = await r.json();
  if (!r.ok || !j.users || !j.users[0] || !j.users[0].localId) return null;
  return j.users[0].localId;
}

async function rolDe(uid, idToken) {
  const r = await fetch(`https://firestore.googleapis.com/v1/projects/${PROYECTO}/databases/(default)/documents/usuarios/${uid}`, {
    headers: { Authorization: 'Bearer ' + idToken },
  });
  if (!r.ok) return null;
  const j = await r.json();
  const rol = j.fields && j.fields.rol && j.fields.rol.stringValue;
  return rol || null;
}

async function firmaCloudinary(params, apiSecret) {
  const cadena = Object.keys(params).sort().map((k) => k + '=' + params[k]).join('&') + apiSecret;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(apiSecret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(cadena));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default {
  async fetch(request, env) {
    const CORS = cors(request);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Método no permitido' }), { status: 405, headers: CORS });

    const apiSecret = env && env.CLOUDINARY_API_SECRET ? String(env.CLOUDINARY_API_SECRET) : '';
    const apiKey = env && env.CLOUDINARY_API_KEY ? String(env.CLOUDINARY_API_KEY) : '';
    if (!apiSecret || !apiKey) return new Response(JSON.stringify({ error: 'Firmador sin configurar (faltan secretos).' }), { status: 500, headers: CORS });

    if (superaLimite(request)) return new Response(JSON.stringify({ error: 'Demasiadas solicitudes. Intenta de nuevo en un momento.' }), { status: 429, headers: CORS });

    let body;
    try { body = await request.json(); } catch (e) { return new Response(JSON.stringify({ error: 'Cuerpo inválido.' }), { status: 400, headers: CORS }); }
    const idToken = body && typeof body.idToken === 'string' ? body.idToken : '';
    if (!idToken) return new Response(JSON.stringify({ error: 'Falta el token de autenticación.' }), { status: 401, headers: CORS });

    const uid = await uidDeToken(idToken);
    if (!uid) return new Response(JSON.stringify({ error: 'Token inválido o caducado.' }), { status: 401, headers: CORS });

    const rol = await rolDe(uid, idToken);
    if (ROLES_PERMITIDOS.indexOf(rol) === -1) return new Response(JSON.stringify({ error: 'Sin permisos de administrador.' }), { status: 403, headers: CORS });

    const timestamp = String(Math.floor(Date.now() / 1000));
    const params = { folder: CARPETA, timestamp };
    const signature = await firmaCloudinary(params, apiSecret);

    return new Response(JSON.stringify({ signature, timestamp, apiKey, folder: CARPETA }), { headers: CORS });
  },
};
