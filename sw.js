// Network first, so every open shows the latest app and data; the cache is the offline fallback.
const VERSION = 'v3';
const CACHE = 'crypto-radar-' + VERSION;
const SHELL = [
  './', 'index.html', 'portfolio.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/dash.js', 'js/version.js', 'vendor/d3.min.js', 'dashboard/page.html',
  'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('crypto-radar-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok) {
        const copy = res.clone();
        const key = req.url.split('?')[0];
        caches.open(CACHE).then(c => c.put(key, copy));
      }
      return res;
    }).catch(() => caches.match(req.url.split('?')[0]).then(r => r || caches.match('index.html')))
  );
});
