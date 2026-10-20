/* ═══════════════════════════════════════════════════════════════════
   CALZADOS ISA ARENAS · configuración única del proyecto

   Fuente de verdad para el sitio público y el panel. Aquí se cambia:
     · la marca y el WhatsApp,
     · el proyecto Firebase (Auth + Firestore),
     · Cloudinary (subida de fotos sin secretos, preset sin firma),
     · el modo de ejecución: 'emulador' (desarrollo local) o 'produccion'.

   ⚠️ SECRETOS: los apiKey/AppId de Firebase Web son públicos por diseño
   (identifican la app, no autorizan por sí solos: la autorización la dan
   las Reglas de Firestore y Firebase Auth). No pongas aquí claves de
   servicio, tokens de admin ni contraseñas.

   PENDIENTE AL DESPLEGAR (no tocar antes de autorización): sustituir los
   marcadores API_KEY_ISA / APP_ID_ISA por los valores reales del proyecto
   Firebase dedicado de ISA, y cambiar `modo` a 'produccion'.
   ═══════════════════════════════════════════════════════════════════ */
window.CONFIG_ISA = {
  marca: 'Calzados ISA Arenas',
  eslogan: 'Boutique digital de calzado',
  whatsapp: '573103255067',          // 310 325 5067
  telefono: '310 325 5067',
  cloudinary: {
    cloudName: 'f07x0wga',           // Cloudinary de la agencia (sin firma)
    uploadPreset: 'menu-digital'
  },
  firebase: {
    apiKey: 'API_KEY_ISA',
    authDomain: 'isa-arenas.firebaseapp.com',
    projectId: 'isa-arenas',
    storageBucket: 'isa-arenas.appspot.com',
    messagingSenderId: '000000000000',
    appId: 'APP_ID_ISA'
  },
  // 'emulador' usa Auth y Firestore locales (nada toca producción).
  modo: 'emulador',
  emulador: { host: '127.0.0.1', firestore: 8080, auth: 9099 },
  roles: { isa: 'isa', konfio: 'konfio' }
};
