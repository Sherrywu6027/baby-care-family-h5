if (window.AppNotifications) {
  (function (AppNotifications) {
    function renderSettingsNavBadge() {
      var button = document.querySelector('.bottom-nav button[data-route="settings"]');
      if (!button) return;

      var state = AppNotifications.getState();
      var existing = button.querySelector('.bottom-nav-badge');
      if (existing) existing.remove();

      if (!state.unreadCount) return;

      button.insertAdjacentHTML(
        'beforeend',
        '<span class="bottom-nav-badge">' + (state.unreadCount > 99 ? '99+' : state.unreadCount) + '</span>'
      );
    }

    window.addEventListener('baby-notifications-changed', function () {
      renderSettingsNavBadge();
    });

    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) renderSettingsNavBadge();
    });

    setTimeout(renderSettingsNavBadge, 0);
    setTimeout(renderSettingsNavBadge, 200);
  })(window.AppNotifications);
}
