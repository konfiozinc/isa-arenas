'use strict';
/* Verifica la lógica de firma Cloudinary (HMAC-SHA1) que usa el firmador.
   Compara la implementación con Web Crypto (la del Worker) contra el HMAC-SHA1
   nativo de Node.js: si coinciden, la firma es correcta. No necesita secretos
   reales (usa una clave de prueba). */
const nodeCrypto = require('node:crypto');

function cadenaFirma(params, apiSecret) {
  return Object.keys(params).sort().map((k) => k + '=' + params[k]).join('&') + apiSecret;
}
async function firmaWebCrypto(params, apiSecret) {
  const enc = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey('raw', enc.encode(apiSecret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const sig = await globalThis.crypto.subtle.sign('HMAC', key, enc.encode(cadenaFirma(params, apiSecret)));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
function firmaNode(params, apiSecret) {
  return nodeCrypto.createHmac('sha1', apiSecret).update(cadenaFirma(params, apiSecret)).digest('hex');
}

(async () => {
  const clavePrueba = 'SECRETO_DE_PRUEBA_NO_REAL';
  const params = { folder: 'isa-arenas', timestamp: '1799999999' };
  const a = await firmaWebCrypto(params, clavePrueba);
  const b = firmaNode(params, clavePrueba);
  const ok = a === b && /^[0-9a-f]{40}$/.test(a);
  console.log('cadena firmada: ' + cadenaFirma(params, clavePrueba));
  console.log('firma Web Crypto: ' + a);
  console.log('firma Node HMAC : ' + b);
  console.log('coinciden: ' + (a === b) + ' | longitud 40 hex: ' + /^[0-9a-f]{40}$/.test(a));
  process.exit(ok ? 0 : 1);
})();
