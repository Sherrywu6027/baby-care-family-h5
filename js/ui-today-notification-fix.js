if (window.UIToday) {
  (function (UIToday) {
    var originalRenderWithBaby = UIToday.renderWithBaby;

    function renderReminderCard() {
      if (!window.AppNotifications) return;

      var state = AppNotifications.getState();
      var syncPill = document.getElementById('today-sync-pill');
      if (!syncPill) return;

      var existing = document.getElementById('today-notification-card');
      if (existing) existing.remove();
      if (!state.unreadCount) return;

      syncPill.insertAdjacentHTML(
        'afterend',
        '<button id="today-notification-card" class="today-notification-card" onclick="App.navigate(\'settings\')">' +
          '<span class="today-notification-icon">🔔</span>' +
          '<span class="today-notification-text">有 ' + state.unreadCount + ' 条家庭提醒待处理</span>' +
          '<span class="today-notification-arrow">去查看 →</span>' +
        '</button>'
      );
    }

    UIToday.renderWithBaby = function (container, babyId) {
      var result = originalRenderWithBaby.call(this, container, babyId);
      setTimeout(renderReminderCard, 0);
      setTimeout(renderReminderCard, 160);
      return result;
    };

    window.addEventListener('baby-notifications-changed', function () {
      renderReminderCard();
    });
  })(window.UIToday);
}
