// sw.js: a small service worker for the PWA.
// Network first: a new deploy shows up right away, the cache is only a fallback.
// Requests to /api/ are never cached: every joke is a fresh call.

const CACHE = 'joke-app-v5';
const SHELL = [
  '/', '/auth.js', '/manifest.webmanifest',
  '/assets/logo.svg', '/assets/bg-dots.svg', '/assets/bg-doodles.svg',
  '/assets/mascot-idle.svg', '/assets/mascot-think.svg', '/assets/mascot-joke.svg', '/assets/mascot-error.svg',
  '/assets/icon-192.png', '/assets/icon-512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) {
    return; // let the browser handle it normally
  }
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
