// /public/sw.js — Offline Cache Service Worker
const CACHE_NAME = 'muzikmatch-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/playlist.html',
  '/data/artists.json',
  '/data/playlists.json',
  '/manifest.json',
  '/og-image.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS_TO_CACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('/api/')) return;
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
