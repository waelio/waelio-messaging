// Simple PWA Service Worker for waelio-messaging (source)
// NOTE: This file is copied to public/ during build.

const SW_VERSION = 'v1';
const CACHE_NAME = `waelio-messaging-${SW_VERSION}`;
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/client.js',
  '/components/waelio-message.js',
  '/site.webmanifest',
  '/favicon.ico',
  '/favicon.svg',
  '/favicon-16x16.png',
  '/favicon-32x32.png',
  '/favicon-48x48.png',
  '/favicon-64x64.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith('waelio-messaging-') && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

function isWebSocketRequest(req) {
  return req.headers && (req.headers.get('upgrade') === 'websocket');
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || isWebSocketRequest(req)) {
    return;
  }

  const url = new URL(req.url);

  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          return fresh;
        } catch (e) {
          const cache = await caches.open(CACHE_NAME);
          const cached = await cache.match('/index.html');
          return cached || new Response('Offline', { status: 503, statusText: 'Offline' });
        }
      })()
    );
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const fresh = await fetch(req);
          if (fresh && fresh.ok && (fresh.type === 'basic' || fresh.type === 'cors')) {
            cache.put(req, fresh.clone());
          }
          return fresh;
        } catch (e) {
          return cached || new Response('Offline', { status: 503, statusText: 'Offline' });
        }
      })()
    );
  }
});
