// Network first, so every open shows the latest app and data; the cache is the offline fallback.
const VERSION = 'v19';
const CACHE = 'crypto-radar-' + VERSION;
const SHELL = [
  './', 'index.html', 'portfolio.html', 'guide.html', 'coin.html', 'js/portfolio.js', 'js/coin.js', 'js/coins.js', 'js/alerts.js', 'js/i18n.js', 'js/wallet-panel.js', 'agents.html', 'js/agents.js', 'safety.json', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/dash.js', 'js/version.js', 'vendor/d3.min.js', 'vendor/fonts/noto-sans-thai-looped-thai-wght-normal.woff2', 'vendor/fonts/noto-sans-thai-looped-latin-wght-normal.woff2', 'dashboard/page.html',
  'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', e => {
  // cache: 'reload' skips the browser's HTTP cache (GitHub Pages allows 10 minutes), so a new version never installs old files.
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
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
  // no-cache: always ask the server (a cheap 304 when unchanged) instead of reusing a copy up to 10 minutes old.
  const fresh = req.mode === 'navigate' ? fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }) : fetch(req, { cache: 'no-cache' });
  e.respondWith(
    fresh.then(res => {
      if (res.ok) {
        const copy = res.clone();
        const key = req.url.split('?')[0];
        caches.open(CACHE).then(c => c.put(key, copy));
      }
      return res;
    }).catch(() => caches.match(req.url.split('?')[0]).then(r => r || caches.match('index.html')))
  );
});

// Tapping a price alert opens (or focuses) the app on the targets list.
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if ('focus' in c) { c.navigate && c.navigate('portfolio.html#targets'); return c.focus(); }
    return self.clients.openWindow('portfolio.html#targets');
  }));
});
