// Service worker : l'application fonctionne hors connexion.
// Stratégie « réseau d'abord » : les mises à jour arrivent dès qu'on est en ligne,
// la dernière version mise en cache sert hors connexion.
const CACHE = 'horaires-v7';
const ASSETS = ['./', 'index.html', 'style.css', 'app.js', 'calc.js', 'animations.js', 'farces.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'icon-180.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(cache => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then(hit => hit || (req.mode === 'navigate' ? caches.match('index.html') : undefined)))
  );
});
