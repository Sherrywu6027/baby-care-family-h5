if (window.UISettings) {
  (function (UISettings) {
    var originalRender = UISettings.render;

    function buildPermissionText(state) {
      if (!state.supported) return '当前浏览器不支持系统通知';
      if (state.permission === 'granted' && state.systemEnabled) return '系统通知已开启';
      if (state.permission === 'denied') return '浏览器已拒绝系统通知';
      if (state.permission === 'granted') return '你已允许通知，但当前处于关闭状态';
      return '站内提醒已开启，你也可以继续开启系统通知';
    }

    function renderNotificationSection() {
      var container = document.getElementById('settings-notification-anchor');
      if (!container || !window.AppNotifications) return;

      var state = AppNotifications.getState();
      var html = '';
      html += '<div class="settings-section-title">消息提醒</div>';
      html += '<div class="settings-group notification-group">';
      html += '<div class="settings-item" style="display:block">';
      html += '<div style="display:flex;justify-content:space-between;gap:12px;align-items:center">';
      html += '<div>';
      html += '<div class="si-label" style="font-weight:700">站内提醒';
      if (state.unreadCount > 0) {
        html += '<span class="notification-badge">' + state.unreadCount + '</span>';
      }
      html += '</div>';
      html += '<div class="ti-detail" style="margin-top:6px">' + escapeHtml(buildPermissionText(state)) + '</div>';
      html += '</div>';
      html += '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">';
      if (state.supported && (!state.systemEnabled || state.permission !== 'granted')) {
        html += '<button class="btn-secondary" style="padding:8px 12px" onclick="UISettings.enableSystemNotifications()">开启系统通知</button>';
      } else if (state.systemEnabled) {
        html += '<button class="btn-secondary" style="padding:8px 12px" onclick="UISettings.disableSystemNotifications()">关闭系统通知</button>';
      }
      if (state.items.length > 0) {
        html += '<button class="btn-secondary" style="padding:8px 12px" onclick="UISettings.markAllNotificationsRead()">全部已读</button>';
      }
      html += '</div></div></div>';

      if (!state.items.length) {
        html += '<div class="settings-item" style="display:block">';
        html += '<div class="si-label">暂无家庭提醒</div>';
        html += '<div class="ti-detail" style="margin-top:6px">有人申请加入家庭，或者你的加入申请被审核后，这里会出现提醒。</div>';
        html += '</div>';
      } else {
        state.items.forEach(function (item) {
          html += '<div class="settings-item notification-item" onclick="UISettings.openNotification(\'' + escapeJs(item.id) + '\')" style="cursor:pointer;display:block">';
          html += '<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">';
          html += '<div style="flex:1">';
          html += '<div class="si-label" style="font-weight:700">' + escapeHtml(item.title) + '</div>';
          html += '<div class="ti-detail" style="margin-top:6px">' + escapeHtml(item.body) + '</div>';
          html += '<div class="ti-detail" style="margin-top:6px">' + escapeHtml(formatDateTime(item.createdAt)) + '</div>';
          html += '</div>';
          html += '<div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end;flex-shrink:0">';
          if (item.unread) {
            html += '<span class="notification-dot"></span>';
          }
          html += '<span class="si-arrow">' + escapeHtml(item.actionLabel || '查看') + ' →</span>';
          html += '</div></div></div>';
        });
      }

      html += '</div>';
      container.innerHTML = html;
    }

    function ensureAnchor(container) {
      if (!container) return;
      if (document.getElementById('settings-notification-anchor')) return;
      var host = container.querySelector('.log-header');
      if (host) {
        host.insertAdjacentHTML('afterend', '<div id="settings-notification-anchor"></div>');
      }
    }

    function escapeHtml(value) {
      return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function escapeJs(value) {
      return String(value || '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, '\\\'');
    }

    function formatDateTime(value) {
      if (!value) return '未知时间';
      return new Date(value).toLocaleString('zh-CN');
    }

    UISettings.render = function (container) {
      var result = originalRender.call(this, container);
      setTimeout(function () {
        ensureAnchor(container);
        renderNotificationSection();
      }, 0);
      setTimeout(function () {
        ensureAnchor(container);
        renderNotificationSection();
      }, 160);
      return result;
    };

    UISettings.enableSystemNotifications = function () {
      if (!window.AppNotifications) return;
      AppNotifications.requestSystemPermission().then(function (result) {
        App.toast(result && result.success ? '系统通知已开启' : (result && result.error ? result.error : '开启失败'));
        renderNotificationSection();
      });
    };

    UISettings.disableSystemNotifications = function () {
      if (!window.AppNotifications) return;
      AppNotifications.disableSystemNotifications().then(function (result) {
        App.toast(result && result.success ? '系统通知已关闭' : (result && result.error ? result.error : '关闭失败'));
        renderNotificationSection();
      });
    };

    UISettings.markAllNotificationsRead = function () {
      if (!window.AppNotifications) return;
      AppNotifications.markAllRead().then(function () {
        App.toast('已全部标记为已读');
        renderNotificationSection();
      });
    };

    UISettings.openNotification = function (itemId) {
      if (!window.AppNotifications) return;
      AppNotifications.openItem(itemId).then(function () {
        renderNotificationSection();
      });
    };

    window.addEventListener('baby-notifications-changed', function () {
      renderNotificationSection();
    });
  })(window.UISettings);
}
