const CACHE = 'babycare-v11';
const ASSETS = ['./', './index.html', './css/styles.css', './css/empty-state-fix.css', './css/state-ui-fix.css',
  './js/config.js', './js/config-fix.js', './js/db.js', './js/time.js', './js/calc.js', './js/timer.js',
  './js/sync.js', './js/sync-fix.js', './js/notifications.js', './js/sync-signup-fix.js',
  './js/ui-today.js', './js/ui-today-fix.js', './js/ui-today-sync-fix.js', './js/ui-today-age-summary-fix.js',
  './js/ui-today-pump-start-fix.js', './js/ui-today-pump-backfill-fix.js', './js/ui-today-family-fallback-fix.js',
  './js/ui-log.js', './js/ui-log-fix.js', './js/ui-stats.js', './js/ui-stats-fix.js',
  './js/ui-no-baby-route-fix.js', './js/ui-login.js', './js/ui-settings.js', './js/ui-settings-fix.js',
  './js/ui-settings-auth-fix.js', './js/ui-settings-current-baby-fix.js', './js/ui-settings-form-fix.js',
  './js/ui-settings-family-fix.js', './js/ui-settings-pending-account-fix.js', './js/ui-settings-mobile-confirm-fix.js',
  './js/ui-settings-sync-fix.js', './js/ui-settings-notification-fix.js', './js/ui-nav-notification-fix.js',
  './js/ui-mobile-interaction-fix.js', './js/ui-unsaved-modal-guard-fix.js', './js/ui-sticky-modal-actions-fix.js',
  './js/ui-feedback-sheet-fix.js', './js/ui-text-fix.js', './js/ui-copy-fix.js', './js/ui-today-notification-fix.js',
  './js/app.js'];

const NETWORK_FIRST = [
  './',
  './index.html',
  './css/styles.css',
  './css/empty-state-fix.css',
  './css/state-ui-fix.css',
  './js/config.js',
  './js/config-fix.js',
  './js/db.js',
  './js/time.js',
  './js/calc.js',
  './js/timer.js',
  './js/sync.js',
  './js/sync-fix.js',
  './js/notifications.js',
  './js/ui-today.js',
  './js/ui-log.js',
  './js/ui-stats.js',
  './js/ui-settings.js',
  './js/ui-settings-fix.js',
  './js/ui-settings-auth-fix.js',
  './js/ui-settings-form-fix.js',
  './js/ui-settings-family-fix.js',
  './js/ui-settings-notification-fix.js',
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
  return NETWORK_FIRST.some(path => url.pathname.endsWith(path.replace('./', '/')) || (url.pathname === '/' && path === './'));
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

self.addEventListener('notificationclick', e => {
  e.notification.close();
  var route = e.notification && e.notification.data && e.notification.data.route
    ? e.notification.data.route
    : '#/settings';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      for (var i = 0; i < clients.length; i += 1) {
        var client = clients[i];
        if ('focus' in client) {
          client.postMessage({ type: 'baby-notification-open', route: route });
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow('./index.html' + route.replace(/^#/, '#'));
      return null;
    })
  );
});
