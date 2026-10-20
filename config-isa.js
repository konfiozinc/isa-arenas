/* ═══════════════════════════════════════════════════════════════════
   CALZADOS ISA ARENAS · configuración única del proyecto

   Fuente de verdad para el sitio público y el panel. Aquí se cambia:
     · la marca y el WhatsApp,
     · el proyecto Firebase dedicado de ISA (Auth + Firestore),
     · Cloudinary (subida de fotos sin secretos, preset sin firma),
     · el modo de ejecución: 'produccion' (por defecto) o 'emulador'
       (desarrollo/pruebas locales: añade ?emulador=1 a la URL).

   ⚠️ SECRETOS: apiKey/AppId de Firebase Web son públicos por diseño
   (identifican la app, no autorizan por sí solos: la autorización la dan
   las Reglas de Firestore y Firebase Auth). NO pongas aquí claves de
   servicio, tokens de admin ni contraseñas.
   ═══════════════════════════════════════════════════════════════════ */

// Permite forzar emulador para desarrollo/pruebas: index.html?emulador=1
const __q = new URLSearchParams(window.location.search);
const __modo = __q.get('emulador') === '1' ? 'emulador' : 'produccion';

window.CONFIG_ISA = {
  marca: 'Calzados ISA Arenas',
  eslogan: 'Catálogo mayorista de calzado',
  whatsapp: '573103255067',          // 310 325 5067
  telefono: '310 325 5067',
  minimoPares: 6,                    // venta al por mayor: mínimo de pares por pedido
  cloudinary: {
    cloudName: 'f07x0wga',           // Cloudinary de la agencia
    // Firmador de subidas (Cloudflare Worker). Firma en servidor sin exponer
    // el API Secret; valida token Firebase + rol antes de firmar.
    signerUrl: 'https://isa-arenas-firmador.konfiozinc.workers.dev',
    // Subida HABILITADA vía firmador (se desactiva sola si falta signerUrl).
    habilitado: true
  },
  firebase: {
    apiKey: 'AIzaSyDWGO2YtkELMRTYYSb4Rq2Mc40dpyMQYso',
    authDomain: 'isa-arenas.firebaseapp.com',
    projectId: 'isa-arenas',
    storageBucket: 'isa-arenas.firebasestorage.app',
    messagingSenderId: '37485490647',
    appId: '1:37485490647:web:c5faf32c60e283a6c4db92'
  },
  // 'produccion' apunta al proyecto real de ISA; 'emulador' (o ?emulador=1)
  // usa Auth y Firestore locales sin tocar producción.
  modo: __modo,
  emulador: { host: '127.0.0.1', firestore: 8080, auth: 9099 },
  roles: { isa: 'isa', konfio: 'konfio' }
};
