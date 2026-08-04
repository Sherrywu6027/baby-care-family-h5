var App = (function () {
  var main = null;
  var toastTimer = null;
  var lastAutoSyncAt = 0;
  var restoringRoute = false;
  var lastSyncLabel = '刚刚更新';
  var TODAY_SNAPSHOT_KEY = 'baby_today_html_snapshot_v1';
  var todaySnapshotObserver = null;

  function init() {
    main = document.getElementById('main');
    renderBootLoading();

    DB.open().then(function () {
      return Sync.init();
    }).then(function () {
      if (window.AppNotifications && AppNotifications.init) {
        return AppNotifications.init();
      }
      return null;
    }).catch(function () {
      return null;
    }).finally(function () {
      registerServiceWorker();
      bindGlobalSyncListeners();
      handleRoute();
      window.addEventListener('hashchange', handleRoute);
      window.addEventListener('online', function () {
        requestSync('online');
      });
      window.addEventListener('focus', function () {
        requestSync('focus');
      });
      window.addEventListener('pageshow', function () {
        requestSync('pageshow');
      });
      window.addEventListener('pagehide', captureTodaySnapshotFromDom);
      window.addEventListener('baby-today-record-saved', scheduleTodaySnapshotCapture);
      if (navigator.serviceWorker) {
        navigator.serviceWorker.addEventListener('message', function (event) {
          var data = event && event.data ? event.data : {};
          if (data.type === 'baby-notification-open' && data.route) {
            location.hash = data.route;
          }
        });
      }
      document.addEventListener('visibilitychange', function () {
        if (!document.hidden) {
          requestSync('visibilitychange');
          scheduleTodaySnapshotCapture();
        }
      });
    });
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || location.protocol.indexOf('http') !== 0) return;
    navigator.serviceWorker.getRegistrations().then(function (registrations) {
      return Promise.all((registrations || []).map(function (registration) {
        return registration.unregister();
      }));
    }).then(function () {
      return caches.keys().then(function (keys) {
        return Promise.all((keys || []).map(function (key) {
          return caches.delete(key);
        }));
      });
    }).catch(function () {}).finally(function () {
      navigator.serviceWorker.register('./sw.js?v=20260804-14').catch(function () {});
    });
  }

  function handleRoute() {
    if (main && !hasMeaningfulMainContent()) {
      renderBootLoading();
    }

    if (window.UIToday && UIToday.cleanupTransientViews) UIToday.cleanupTransientViews();

    Promise.all([
      Sync.getAuthState(),
      DB.getMeta('onboardingCompleted'),
      DB.getMeta('familyId')
    ]).then(function (values) {
      var authState = values[0] || { loggedIn: false };
      var done = !!(values[1] || values[2]);

      if (authState.loggedIn && !done && !restoringRoute) {
        restoringRoute = true;
        location.hash = '#/today';
        if (window.UIToday && UIToday.renderLoading) UIToday.renderLoading(main);

        return Sync.restoreFamilyContext({ silent: true }).then(function () {
          return Promise.all([
            DB.getMeta('onboardingCompleted'),
            DB.getMeta('familyId')
          ]);
        }).then(function (restoredValues) {
          var restoredDone = !!(restoredValues[0] || restoredValues[1]);
          restoringRoute = false;
          if (restoredDone !== done) {
            handleRoute();
            return;
          }
          routeWithState(authState, restoredDone);
        }).catch(function () {
          restoringRoute = false;
          routeWithState(authState, done);
        });
      }

      routeWithState(authState, done);
    });
  }

  function routeWithState(authState, done) {
    authState = authState || { loggedIn: false };
    done = !!done;

    var hash = location.hash.slice(2) || 'today';
    if (!authState.loggedIn && hash !== 'login') {
      location.hash = '#/login';
      hash = 'login';
    } else if (authState.loggedIn && !done) {
      location.hash = restoringRoute ? '#/today' : '#/welcome';
      hash = restoringRoute ? 'today' : 'welcome';
    } else if (authState.loggedIn && done && hash === 'login') {
      location.hash = '#/today';
      hash = 'today';
    }

    var navs = document.querySelectorAll('.bottom-nav button');
    navs.forEach(function (nav) {
      nav.classList.remove('active');
      nav.style.display = authState.loggedIn && done ? '' : 'none';
    });
    if (authState.loggedIn && done) {
      var activeNav = document.querySelector('.bottom-nav button[data-route="' + hash + '"]');
      if (activeNav) activeNav.classList.add('active');
    }

    maybeAutoSync(authState.loggedIn && done, hash);

    switch (hash) {
      case 'login':
        showLogin();
        break;
      case 'welcome':
        showOnboarding();
        break;
      case 'today':
        if (done) {
          startTodaySnapshotObserver();
          UIToday.render(main);
          scheduleTodaySnapshotCapture();
        } else {
          stopTodaySnapshotObserver();
          UIToday.renderLoading(main);
        }
        break;
      case 'direct-timer':
        stopTodaySnapshotObserver();
        UIToday.renderDirectTimerPage(main);
        break;
      case 'log':
        stopTodaySnapshotObserver();
        UILog.render(main);
        break;
      case 'stats':
        stopTodaySnapshotObserver();
        UIStats.render(main);
        break;
      case 'settings':
        stopTodaySnapshotObserver();
        UISettings.render(main);
        break;
      case 'notifications':
        stopTodaySnapshotObserver();
        if (window.UINotifications && UINotifications.render) {
          UINotifications.render(main);
        }
        break;
      case 'notifications-settings':
        stopTodaySnapshotObserver();
        if (window.UINotifications && UINotifications.renderSettings) {
          UINotifications.renderSettings(main);
        }
        break;
      default:
        stopTodaySnapshotObserver();
        if (authState.loggedIn) {
          done ? UIToday.render(main) : showOnboarding();
        } else {
          showLogin();
        }
        break;
    }
  }

  function maybeAutoSync(done, hash) {
    if (!done) return;
    if (hash !== 'today' && hash !== 'settings' && hash !== 'notifications' && hash !== 'notifications-settings' && hash !== 'log' && hash !== 'stats') return;
    var now = Date.now();
    if (now - lastAutoSyncAt < 15000) return;
    lastAutoSyncAt = now;
    requestSync('auto-route');
  }

  function renderPage() {
    handleRoute();
  }

  function renderBootLoading() {
    if (!main) return;

    var snapshotHtml = readTodaySnapshotHtml();
    if (snapshotHtml) {
      main.innerHTML = snapshotHtml;
      return;
    }

    if (window.UIToday && UIToday.renderLoading) {
      UIToday.renderLoading(main);
      return;
    }

    main.innerHTML = ''
      + '<div class="today-skeleton-card"><div class="today-skeleton-line w-40"></div><div class="today-skeleton-line w-70"></div></div>'
      + '<div class="today-skeleton-grid"><div class="today-skeleton-box"></div><div class="today-skeleton-box"></div><div class="today-skeleton-box"></div></div>'
      + '<div class="today-skeleton-card"><div class="today-skeleton-line w-50"></div><div class="today-skeleton-line w-85"></div><div class="today-skeleton-line w-75"></div></div>';
  }

  function hasMeaningfulMainContent() {
    if (!main) return false;
    return !!String(main.innerHTML || '').trim();
  }

  function scheduleTodaySnapshotCapture() {
    setTimeout(captureTodaySnapshotFromDom, 80);
    setTimeout(captureTodaySnapshotFromDom, 260);
    setTimeout(captureTodaySnapshotFromDom, 700);
  }

  function startTodaySnapshotObserver() {
    if (!main || todaySnapshotObserver) return;
    todaySnapshotObserver = new MutationObserver(function () {
      captureTodaySnapshotFromDom();
    });
    todaySnapshotObserver.observe(main, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  function stopTodaySnapshotObserver() {
    if (!todaySnapshotObserver) return;
    todaySnapshotObserver.disconnect();
    todaySnapshotObserver = null;
  }

  function captureTodaySnapshotFromDom() {
    if (!main) return;
    var currentRoute = location.hash.slice(2) || 'today';
    if (currentRoute !== 'today') return;

    var html = String(main.innerHTML || '').trim();
    if (!html) return;
    if (html.indexOf('today-skeleton-card') >= 0) return;
    if (html.indexOf('empty-route-page') >= 0) return;

    try {
      localStorage.setItem(TODAY_SNAPSHOT_KEY, html);
    } catch (error) {}
  }

  function readTodaySnapshotHtml() {
    try {
      return localStorage.getItem(TODAY_SNAPSHOT_KEY) || '';
    } catch (error) {
      return '';
    }
  }

  function showOnboarding() {
    UISettings.renderWelcome(main);
  }

  function showLogin() {
    if (window.UILogin && UILogin.render) UILogin.render(main);
  }

  function toast(message) {
    var existing = document.querySelector('.toast');
    if (existing) existing.remove();
    if (toastTimer) clearTimeout(toastTimer);

    var el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.innerHTML = '<div class="toast-inner">' + escapeHtml(message) + '</div>';
    document.body.appendChild(el);

    requestAnimationFrame(function () {
      el.classList.add('show');
    });

    toastTimer = setTimeout(function () {
      el.classList.remove('show');
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 220);
    }, 2200);
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function navigate(route) {
    applyPendingNavState(route);
    renderRouteTransition(route);
    location.hash = '#/' + route;
  }

  function applyPendingNavState(route) {
    var navs = document.querySelectorAll('.bottom-nav button');
    navs.forEach(function (nav) {
      nav.classList.remove('active');
    });
    var activeNav = document.querySelector('.bottom-nav button[data-route="' + route + '"]');
    if (activeNav) activeNav.classList.add('active');
  }

  function renderRouteTransition(route) {
    if (!main) return;
    if (route === 'settings' || route === 'notifications' || route === 'notifications-settings' || route === 'log' || route === 'stats') {
      main.innerHTML = ''
        + '<div class="today-skeleton-card"><div class="today-skeleton-line w-40"></div><div class="today-skeleton-line w-70"></div></div>'
        + '<div class="today-skeleton-card"><div class="today-skeleton-line w-85"></div><div class="today-skeleton-line w-75"></div><div class="today-skeleton-line w-50"></div></div>'
        + '<div class="today-skeleton-card"><div class="today-skeleton-line w-70"></div><div class="today-skeleton-line w-85"></div></div>';
    }
  }

  function requestSync(reason) {
    return Sync.sync({ silent: true, reason: reason }).catch(function () {
      return null;
    }).then(function (result) {
      if (window.AppNotifications && AppNotifications.refresh) {
        return AppNotifications.refresh({ allowSystem: true }).then(function () {
          return result;
        }).catch(function () {
          return result;
        });
      }
      return result;
    });
  }

  function bindGlobalSyncListeners() {
    if (!Sync.onStateChange) return;
    Sync.onStateChange(function (state) {
      var label = mapSyncLabel(state);
      lastSyncLabel = label;
      window.dispatchEvent(new CustomEvent('baby-sync-state', {
        detail: { state: state, label: label }
      }));
    });
  }

  function mapSyncLabel(state) {
    if (state === 'syncing') return '同步中';
    if (state === 'offline') return '离线，稍后自动同步';
    if (state === 'error') return '同步失败，可稍后重试';
    return '刚刚更新';
  }

  return {
    init: init,
    renderPage: renderPage,
    showOnboarding: showOnboarding,
    showLogin: showLogin,
    toast: toast,
    navigate: navigate,
    requestSync: requestSync,
    getLastSyncLabel: function () {
      return lastSyncLabel;
    }
  };
})();

document.addEventListener('DOMContentLoaded', App.init);
