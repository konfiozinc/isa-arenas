/* Service worker — Calzados ISA Arenas (catálogo) */
const CACHE_NAME = 'isa-arenas-v2';
const PRECACHE_URLS = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './manifest.json',
  './assets/logo/logoisa-128.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const esLocal = url.origin === self.location.origin;

  if (esLocal && url.pathname.includes('/assets/')) {
    // Imágenes y assets: caché primero (se cachean bajo demanda al verse)
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((resp) => {
          const copia = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copia));
          return resp;
        }).catch(() => cached);
      })
    );
  } else {
    // Navegación y shell: red primero, respaldo de caché
    event.respondWith(
      fetch(request).then((resp) => {
        if (esLocal) {
          const copia = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copia));
        }
        return resp;
      }).catch(() => caches.match(request))
    );
  }
});
