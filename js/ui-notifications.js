var UINotifications = (function () {
  function getState() {
    return window.AppNotifications && AppNotifications.getState
      ? AppNotifications.getState()
      : {
          items: [],
          unreadCount: 0,
          permission: 'default',
          systemEnabled: false,
          supported: false,
          recordEnabled: true
        };
  }

  function render(container) {
    if (!container) return;
    var state = getState();

    var html = '';
    html += '<div class="log-header">';
    html += '<h2 style="font-size:1.2rem">消息提醒</h2>';
    html += '<button class="page-link-btn" onclick="App.navigate(\'settings\')">返回设置</button>';
    html += '</div>';

    html += '<div class="stats-card">';
    html += '<div class="notification-header-row">';
    html += '<div>';
    html += '<div class="sc-title">未读提醒</div>';
    html += '<div class="sc-value">' + state.unreadCount + '</div>';
    html += '<div class="sc-unit">这里显示家庭消息明细</div>';
    html += '</div>';
    html += '<div class="notification-icon-actions">';
    html += '<button type="button" class="notification-icon-btn" onclick="App.navigate(\'notifications-settings\')" aria-label="通知设置">';
    html += '<span class="notification-icon-btn-icon">⚙</span>';
    html += '<span class="notification-icon-btn-text">设置</span>';
    html += '</button>';
    if (state.items.length > 0) {
      html += '<button type="button" class="notification-icon-btn" onclick="UISettings.markAllNotificationsRead()" aria-label="全部已读">';
      html += '<span class="notification-icon-btn-icon">✓</span>';
      html += '<span class="notification-icon-btn-text">已读</span>';
      html += '</button>';
    }
    html += '</div>';
    html += '</div>';
    html += '</div>';

    html += '<div class="section-title" style="margin-top:16px">消息明细</div>';
    if (!state.items.length) {
      html += '<div class="stats-card">';
      html += '<div class="sc-title">暂无消息</div>';
      html += '<div class="sc-unit">家庭成员新增记录或加入申请处理后，这里会显示具体内容。</div>';
      html += '</div>';
    } else {
      html += '<div class="settings-group notification-group">';
      state.items.forEach(function (item) {
        html += '<div class="settings-item notification-item" onclick="UISettings.openNotification(\'' + escapeJs(item.id) + '\')" style="cursor:pointer;display:block">';
        html += '<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">';
        html += '<div style="flex:1">';
        html += '<div class="si-label" style="font-weight:700">' + escapeHtml(item.title) + '</div>';
        html += '<div class="ti-detail" style="margin-top:6px">' + escapeHtml(item.body) + '</div>';
        html += '<div class="ti-detail" style="margin-top:6px">' + escapeHtml(formatDateTime(item.createdAt)) + '</div>';
        html += '</div>';
        html += '<div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end;flex-shrink:0">';
        if (item.unread) html += '<span class="notification-dot"></span>';
        html += '</div></div></div>';
      });
      html += '</div>';
    }

    container.innerHTML = html;
  }

  function renderSettings(container) {
    if (!container) return;
    var state = getState();

    var html = '';
    html += '<div class="log-header">';
    html += '<h2 style="font-size:1.2rem">通知设置</h2>';
    html += '<button class="page-link-btn" onclick="App.navigate(\'notifications\')">返回消息</button>';
    html += '</div>';

    html += '<div class="settings-group notification-group">';
    html += '<div class="settings-item">';
    html += '<div style="flex:1">';
    html += '<div class="si-label" style="font-weight:700">家庭记录提醒</div>';
    html += '<div class="si-value">家庭成员新增记录时提醒其他成员</div>';
    html += '</div>';
    html += '<label class="switch"><input type="checkbox" ' + (state.recordEnabled ? 'checked' : '') + ' onchange="UISettings.toggleRecordNotifications(this.checked)"><span class="slider"></span></label>';
    html += '</div>';

    html += '<div class="settings-item" style="display:block">';
    html += '<div style="display:flex;justify-content:space-between;gap:12px;align-items:center">';
    html += '<div>';
    html += '<div class="si-label" style="font-weight:700">系统通知</div>';
    html += '<div class="si-value" style="margin-top:6px">' + escapeHtml(buildPermissionText(state)) + '</div>';
    html += '</div>';
    html += '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">';
    if (state.supported && (!state.systemEnabled || state.permission !== 'granted')) {
      html += '<button class="btn-secondary" style="padding:8px 12px" onclick="UISettings.enableSystemNotifications()">开启系统通知</button>';
    } else if (state.systemEnabled) {
      html += '<button class="btn-secondary" style="padding:8px 12px" onclick="UISettings.disableSystemNotifications()">关闭系统通知</button>';
    }
    html += '</div></div></div>';
    html += '</div>';

    container.innerHTML = html;
  }

  function buildPermissionText(state) {
    if (!state.supported) return '当前浏览器不支持系统通知';
    if (state.permission === 'granted' && state.systemEnabled) return '系统通知已开启';
    if (state.permission === 'denied') return '浏览器已拒绝系统通知';
    if (state.permission === 'granted') return '你已允许通知，但当前处于关闭状态';
    return '站内提醒已开启，你也可以继续开启系统通知';
  }

  function formatDateTime(value) {
    if (!value) return '未知时间';
    if (window.TimeUtil && TimeUtil.formatChinaDateTime) {
      return TimeUtil.formatChinaDateTime(value);
    }
    return new Date(value).toLocaleString('zh-CN');
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

  return {
    render: render,
    renderSettings: renderSettings
  };
})();
