var App = (function () {
  var main = null;
  var toastTimer = null;
  var lastAutoSyncAt = 0;
  var restoringRoute = false;

  function init() {
    main = document.getElementById('main');
    DB.open().then(function () {
      return Sync.init();
    }).catch(function () {
      return null;
    }).finally(function () {
      registerServiceWorker();
      handleRoute();
      window.addEventListener('hashchange', handleRoute);
      window.addEventListener('online', function () {
        Sync.sync({ silent: true });
      });
    });
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || location.protocol.indexOf('http') !== 0) return;
    navigator.serviceWorker.getRegistrations().then(function (regs) {
      return Promise.all((regs || []).map(function (reg) { return reg.unregister(); }));
    }).then(function () {
      return caches.keys().then(function (keys) {
        return Promise.all((keys || []).map(function (key) { return caches.delete(key); }));
      });
    }).catch(function () {}).finally(function () {
      navigator.serviceWorker.register('./sw.js?v=20260724-1').catch(function () {});
    });
  }

  function handleRoute() {
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
        return Sync.restoreFamilyContext({ silent: true }).then(function () {
          return Promise.all([
            DB.getMeta('onboardingCompleted'),
            DB.getMeta('familyId')
          ]);
        }).then(function (restoredValues) {
          var restoredDone = !!(restoredValues[0] || restoredValues[1]);
          restoringRoute = false;
          if (!!restoredDone !== done) {
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
    } else if (authState.loggedIn && !done && hash !== 'welcome') {
      location.hash = '#/welcome';
      hash = 'welcome';
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
      case 'login': showLogin(); break;
      case 'welcome': showOnboarding(); break;
      case 'today': UIToday.render(main); break;
      case 'direct-timer': UIToday.renderDirectTimerPage(main); break;
      case 'log': UILog.render(main); break;
      case 'stats': UIStats.render(main); break;
      case 'settings': UISettings.render(main); break;
      default: authState.loggedIn ? (done ? UIToday.render(main) : showOnboarding()) : showLogin();
    }
  }

  function maybeAutoSync(done, hash) {
    if (!done) return;
    if (hash !== 'today' && hash !== 'settings') return;
    var now = Date.now();
    if (now - lastAutoSyncAt < 15000) return;
    lastAutoSyncAt = now;
    Sync.sync({ silent: true });
  }

  function renderPage() {
    handleRoute();
  }

  function showOnboarding() {
    UISettings.renderWelcome(main);
  }

  function showLogin() {
    if (window.UILogin && UILogin.render) UILogin.render(main);
  }

  function toast(msg) {
    var existing = document.querySelector('.toast');
    if (existing) existing.remove();
    if (toastTimer) clearTimeout(toastTimer);
    var el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.innerHTML = '<div class="toast-inner">' + escapeHtml(msg) + '</div>';
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
    location.hash = '#/' + route;
  }

  return {
    init: init,
    renderPage: renderPage,
    showOnboarding: showOnboarding,
    showLogin: showLogin,
    toast: toast,
    navigate: navigate
  };
})();

document.addEventListener('DOMContentLoaded', App.init);
