if (window.UISettings) {
  (function (UISettings) {
    function rerenderIfRelevantPage() {
      var route = location.hash.slice(2) || 'today';
      if (route !== 'settings' && route !== 'notifications' && route !== 'notifications-settings') return;
      if (window.App && App.renderPage) App.renderPage();
    }

    UISettings.enableSystemNotifications = function () {
      if (!window.AppNotifications) return;
      AppNotifications.requestSystemPermission().then(function (result) {
        App.toast(result && result.success ? '已开启系统通知' : (result && result.error ? result.error : '开启失败'));
        rerenderIfRelevantPage();
      });
    };

    UISettings.disableSystemNotifications = function () {
      if (!window.AppNotifications) return;
      AppNotifications.disableSystemNotifications().then(function (result) {
        App.toast(result && result.success ? '已关闭系统通知' : (result && result.error ? result.error : '关闭失败'));
        rerenderIfRelevantPage();
      });
    };

    UISettings.markAllNotificationsRead = function () {
      if (!window.AppNotifications) return;
      AppNotifications.markAllRead().then(function () {
        App.toast('已全部标记为已读');
        rerenderIfRelevantPage();
      });
    };

    UISettings.toggleRecordNotifications = function (checked) {
      if (!window.AppNotifications || !AppNotifications.setRecordNotificationsEnabled) return;
      AppNotifications.setRecordNotificationsEnabled(checked).then(function (result) {
        App.toast(result && result.success
          ? (checked ? '已开启家庭记录提醒' : '已关闭家庭记录提醒')
          : (result && result.error ? result.error : '设置失败'));
        rerenderIfRelevantPage();
      });
    };

    UISettings.openNotification = function (itemId) {
      if (!window.AppNotifications) return;
      AppNotifications.openItem(itemId).then(function () {
        rerenderIfRelevantPage();
      });
    };

    window.addEventListener('baby-notifications-changed', function () {
      rerenderIfRelevantPage();
    });
  })(window.UISettings);
}
