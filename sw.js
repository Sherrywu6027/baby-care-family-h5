const CACHE = 'babycare-v4';
const ASSETS = ['./', './index.html', './css/styles.css',
  './js/config.js', './js/db.js', './js/calc.js', './js/timer.js',
  './js/sync.js', './js/ui-today.js', './js/ui-log.js', './js/ui-stats.js',
  './js/ui-settings.js', './js/app.js'];

const NETWORK_FIRST = [
  './',
  './index.html',
  './css/styles.css',
  './js/config.js',
  './js/db.js',
  './js/calc.js',
  './js/timer.js',
  './js/sync.js',
  './js/ui-today.js',
  './js/ui-log.js',
  './js/ui-stats.js',
  './js/ui-settings.js',
  './js/app.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

function isNetworkFirstRequest(request) {
  const url = new URL(request.url);
  if (request.mode === 'navigate') return true;
  return NETWORK_FIRST.some(path => url.pathname.endsWith(path.replace('./', '/')) || url.pathname === '/' && path === './');
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  if (isNetworkFirstRequest(e.request)) {
    e.respondWith(
      fetch(e.request).then(resp => {
        if (resp.ok && e.request.url.startsWith(self.location.origin)) {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => caches.match(e.request).then(cached => cached))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => {
      return cached || fetch(e.request).then(resp => {
        if (resp.ok && e.request.url.startsWith(self.location.origin)) {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => cached);
    })
  );
});
