// public/sw.js
// Sprint 6 (Punto 4): Service Worker para PWA Instalable + Notificaciones Web Push (Admin y Comprador)
const CACHE_NAME = 'artesanitas-pwa-v2026-1';
const STATIC_ASSETS = [
  '/',
  '/pedido',
  '/seguimiento',
  '/js/vendor/tailwindcss.3.4.17.js',
  '/imagenes/Artesanitas/logo_artesanitas.peru.jpg'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || req.url.includes('/api/')) return;
  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});

self.addEventListener('push', (event) => {
  let payload = {
    title: 'Artesanitas Perú',
    body: 'Tienes una actualización en tu pedido artesanal.',
    url: '/seguimiento'
  };
  if (event.data) {
    try {
      payload = Object.assign(payload, event.data.json());
    } catch (e) {
      payload.body = event.data.text();
    }
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/imagenes/Artesanitas/logo_artesanitas.peru.jpg',
      badge: '/imagenes/Artesanitas/logo_artesanitas.peru.jpg',
      vibrate: [200, 100, 200],
      data: { url: payload.url || '/seguimiento' }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
