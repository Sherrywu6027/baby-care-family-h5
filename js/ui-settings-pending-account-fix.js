var UISettings = (function (BaseUISettings) {
  function render(container) {
    BaseUISettings.render(container);
    resetMarkers(container);
    scheduleEnhancements(container, 0);
  }

  function resetMarkers(container) {
    if (!container || !container.dataset) return;
    delete container.dataset.accountSectionInserted;
    delete container.dataset.accountSectionPending;
    delete container.dataset.pendingAccountsInjected;
  }

  function scheduleEnhancements(container, attempt) {
    attempt = attempt || 0;
    setTimeout(function () {
      var doneAccount = ensureAccountSection(container);
      var donePending = injectPendingRequestAccounts(container);
      if ((doneAccount && donePending) || attempt >= 8) return;
      scheduleEnhancements(container, attempt + 1);
    }, attempt === 0 ? 0 : 80);
  }

  function ensureAccountSection(container) {
    if (!container) return false;
    if (container.dataset.accountSectionInserted === '1' || container.querySelector('.settings-account-section')) {
      container.dataset.accountSectionInserted = '1';
      return true;
    }
    if (container.dataset.accountSectionPending === '1') return false;

    var anchor = container.querySelector('.log-header');
    if (!anchor || !anchor.parentNode) return false;

    container.dataset.accountSectionPending = '1';
    Sync.getAuthState().then(function (authState) {
      if (!(authState && authState.loggedIn)) return;
      if (container.querySelector('.settings-account-section')) {
        container.dataset.accountSectionInserted = '1';
        return;
      }

      var freshAnchor = container.querySelector('.log-header');
      if (!freshAnchor || !freshAnchor.parentNode) return;

      var section = document.createElement('div');
      section.className = 'settings-account-section';
      section.innerHTML = buildAccountHtml(authState.email || '');
      freshAnchor.parentNode.insertBefore(section, freshAnchor.nextSibling);
      container.dataset.accountSectionInserted = '1';
    }).catch(function () {
      return null;
    }).finally(function () {
      delete container.dataset.accountSectionPending;
    });

    return false;
  }

  function injectPendingRequestAccounts(container) {
    if (!container) return false;
    if (container.dataset.pendingAccountsInjected === '1') return true;

    var pendingGroup = findPendingGroup(container);
    if (!pendingGroup) return false;

    Sync.listPendingJoinRequests().then(function (requests) {
      requests = requests || [];
      if (!requests.length) {
        container.dataset.pendingAccountsInjected = '1';
        return;
      }

      var freshGroup = findPendingGroup(container);
      if (!freshGroup) return;

      var cards = freshGroup.querySelectorAll('.settings-item');
      requests.forEach(function (request, index) {
        var card = cards[index];
        if (!card || card.querySelector('.pending-request-account')) return;

        var timeLine = findTimeLine(card);
        if (!timeLine || !timeLine.parentNode) return;

        var line = document.createElement('div');
        line.className = 'ti-detail pending-request-account';
        line.textContent = '账号：' + formatJoinRequesterAccount(request);
        timeLine.parentNode.insertBefore(line, timeLine);
      });
      container.dataset.pendingAccountsInjected = '1';
    }).catch(function () {
      return null;
    });

    return false;
  }

  function findPendingGroup(container) {
    var titleNodes = Array.prototype.slice.call(container.querySelectorAll('.settings-section-title'));
    var pendingTitle = titleNodes.filter(function (node) {
      return String(node.textContent || '').indexOf('加入审核') >= 0;
    })[0] || null;
    return pendingTitle ? pendingTitle.nextElementSibling : null;
  }

  function findTimeLine(card) {
    var lines = card.querySelectorAll('.ti-detail');
    return Array.prototype.slice.call(lines).filter(function (node) {
      return String(node.textContent || '').indexOf('申请时间') >= 0;
    })[0] || null;
  }

  function formatJoinRequesterAccount(request) {
    var email = request && request.requester_email ? String(request.requester_email).trim() : '';
    if (email) return email;
    var account = request && request.requester_user ? String(request.requester_user) : '';
    if (!account) return '未提供';
    if (account.length <= 12) return account;
    return account.slice(0, 8) + '...' + account.slice(-6);
  }

  function buildAccountHtml(email) {
    var html = '';
    html += '<div class="settings-section-title">账号</div>';
    html += '<div class="settings-group">';
    html += '<div class="settings-item"><div class="si-label">当前邮箱</div><div class="si-value" style="font-weight:600">' + escapeHtml(email || '未登录') + '</div></div>';
    html += '<div class="settings-item" onclick="UISettings.openPasswordDialog()" style="cursor:pointer;color:var(--primary);font-weight:600">设置或修改密码</div>';
    html += '<div class="settings-item" onclick="UISettings.sendPasswordReset()" style="cursor:pointer;color:var(--primary);font-weight:600">发送重置密码邮件</div>';
    html += '<div class="settings-item" onclick="UISettings.signOut()" style="cursor:pointer;color:var(--danger);font-weight:600">仅退出登录</div>';
    if (window.UISettings && UISettings.toggleDiagnosticSection) {
      html += '<div class="settings-item" onclick="UISettings.toggleDiagnosticSection()" style="cursor:pointer;color:#94a3b8;font-size:.86rem">账户恢复与诊断</div>';
    }
    html += '</div>';
    return html;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  var next = {};
  Object.keys(BaseUISettings).forEach(function (key) {
    next[key] = BaseUISettings[key];
  });
  next.render = render;
  return next;
})(UISettings);
