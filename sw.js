// Offline support: the app's files are served from the cache straight away
// and refreshed from the network in the background, so updates show up on the next launch.

const CACHE = 'photick-v3';
const FILES = [
  './',
  'index.html',
  'style.css',
  'js/app.js',
  'js/wheel.js',
  'js/wheel-view.js',
  'js/i18n.js',
  'data/topics.json',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  // `reload` skips the browser's HTTP cache, so a new version never mixes with old files.
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request, { ignoreSearch: true });
    const fresh = fetch(request)
      .then((res) => {
        if (res.ok) cache.put(request, res.clone());
        return res;
      })
      .catch(() => undefined);
    event.waitUntil(fresh);
    return cached ?? (await fresh) ?? Response.error();
  })());
});
