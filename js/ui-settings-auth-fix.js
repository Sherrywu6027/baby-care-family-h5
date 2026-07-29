var UISettings = (function (BaseUISettings) {
  var pendingResultClose = null;

  function render(container) {
    BaseUISettings.render(container);
    scheduleAccountSection(container, 0);
  }

  function scheduleAccountSection(container, attempt) {
    attempt = attempt || 0;
    setTimeout(function () {
      injectAccountSection(container, attempt);
    }, attempt === 0 ? 0 : 80);
  }

  function injectAccountSection(container, attempt) {
    if (!container) return;
    Sync.getAuthState().then(function (authState) {
      if (!authState || !authState.loggedIn) return;
      if (container.querySelector('.settings-account-section')) return;
      var anchor = container.querySelector('.log-header');
      if (!anchor || !anchor.parentNode) {
        if ((attempt || 0) < 8) scheduleAccountSection(container, (attempt || 0) + 1);
        return;
      }

      var section = document.createElement('div');
      section.className = 'settings-account-section';
      section.innerHTML = buildAccountHtml(authState.email || '');
      anchor.parentNode.insertBefore(section, anchor.nextSibling);
      injectDiagnosticSection(section);
    });
  }

  function injectDiagnosticSection(section) {
    Promise.all([
      DB.getMeta('authUserId'),
      DB.getMeta('familyId'),
      DB.getMeta('familyCode'),
      loadMembershipDiagnostic()
    ]).then(function (values) {
      var authUserId = values[0] || '';
      var familyId = values[1] || '';
      var familyCode = values[2] || '';
      var diagnostic = values[3] || {};
      var block = document.createElement('div');
      block.className = 'settings-diagnostic-section';
      block.style.display = 'none';
      block.innerHTML = buildDiagnosticHtml({
        authUserId: authUserId,
        familyId: familyId,
        familyCode: familyCode,
        membership: diagnostic.membership,
        error: diagnostic.error
      });
      section.appendChild(block);
    });
  }

  function buildAccountHtml(email) {
    var html = '';
    html += '<div class="settings-section-title">账号</div>';
    html += '<div class="settings-group">';
    html += '<div class="settings-item"><div class="si-label">当前邮箱</div><div class="si-value" style="font-weight:600">' + escapeHtml(email || '未登录') + '</div></div>';
    html += '<div class="settings-item" onclick="UISettings.openPasswordDialog()" style="cursor:pointer;color:var(--primary);font-weight:600">设置或修改密码</div>';
    html += '<div class="settings-item" onclick="UISettings.sendPasswordReset()" style="cursor:pointer;color:var(--primary);font-weight:600">发送重置密码邮件</div>';
    html += '<div class="settings-item" onclick="UISettings.signOut()" style="cursor:pointer;color:var(--danger);font-weight:600">仅退出登录</div>';
    html += '<div class="settings-item" onclick="UISettings.toggleDiagnosticSection()" style="cursor:pointer;color:#94a3b8;font-size:.86rem">账户恢复与诊断</div>';
    html += '</div>';
    return html;
  }

  function buildDiagnosticHtml(state) {
    var membership = state.membership || null;
    var html = '';
    html += '<div class="settings-section-title">恢复诊断</div>';
    html += '<div class="settings-group">';
    html += '<div class="settings-item"><div class="si-label">当前用户 UID</div><div class="si-value" style="font-weight:600;word-break:break-all">' + escapeHtml(state.authUserId || '空') + '</div></div>';
    html += '<div class="settings-item"><div class="si-label">本地 familyId</div><div class="si-value" style="font-weight:600;word-break:break-all">' + escapeHtml(state.familyId || '空') + '</div></div>';
    html += '<div class="settings-item"><div class="si-label">本地 familyCode</div><div class="si-value" style="font-weight:600">' + escapeHtml(state.familyCode || '空') + '</div></div>';
    html += '<div class="settings-item" style="display:block">';
    html += '<div class="si-label">get_my_membership() 结果</div>';
    if (state.error) {
      html += '<div class="ti-detail" style="margin-top:6px;color:var(--danger);word-break:break-all">' + escapeHtml(state.error) + '</div>';
    } else if (!membership) {
      html += '<div class="ti-detail" style="margin-top:6px">空结果。通常表示当前登录 UID 还没有绑定到任何 members.auth_user。</div>';
    } else {
      html += '<div class="ti-detail" style="margin-top:6px;word-break:break-all">family_id: ' + escapeHtml(membership.result_family_id || membership.family_id || '') + '</div>';
      html += '<div class="ti-detail" style="word-break:break-all">family_code: ' + escapeHtml(membership.result_family_code || membership.family_code || '') + '</div>';
      html += '<div class="ti-detail" style="word-break:break-all">member_id: ' + escapeHtml(membership.result_member_id || membership.member_id || '') + '</div>';
      html += '<div class="ti-detail" style="word-break:break-all">auth_user: ' + escapeHtml(membership.result_auth_user || membership.auth_user || '') + '</div>';
      html += '<div class="ti-detail">display_name: ' + escapeHtml(membership.result_display_name || membership.display_name || '') + '</div>';
    }
    html += '</div>';
    html += '<div class="settings-item" onclick="UISettings.repairLocalFamilyContext()" style="cursor:pointer;color:var(--primary);font-weight:600">修复本地家庭信息</div>';
    html += '<div class="settings-item" onclick="App.renderPage()" style="cursor:pointer;color:var(--primary);font-weight:600">刷新诊断信息</div>';
    html += '</div>';
    return html;
  }

  function loadMembershipDiagnostic() {
    var client = Sync.getClient();
    if (!client) {
      return Promise.resolve({
        membership: null,
        error: 'Supabase client 未就绪'
      });
    }
    return client.rpc('get_my_membership').then(function (result) {
      if (result && result.error) {
        return { membership: null, error: result.error.message || String(result.error) };
      }
      var row = Array.isArray(result.data) ? result.data[0] : result.data;
      return { membership: row || null, error: '' };
    }).catch(function (error) {
      return { membership: null, error: error && error.message ? error.message : String(error || '') };
    });
  }

  function openPasswordDialog() {
    closePasswordDialog();
    var html = '<div class="modal-overlay password-settings-overlay" onclick="if(event.target===this)UISettings.closePasswordDialog()"><div class="modal-sheet">';
    html += '<div class="modal-handle"></div><div class="modal-title">设置密码</div>';
    html += '<div class="form-group"><label class="form-label">新密码</label><input type="password" class="form-input" id="account-password" placeholder="至少 6 位"></div>';
    html += '<div class="form-group"><label class="form-label">确认新密码</label><input type="password" class="form-input" id="account-password-confirm" placeholder="再输入一次"></div>';
    html += '<div id="account-password-error" class="welcome-error" style="display:none;margin-bottom:12px"></div>';
    html += '<button class="btn-primary" onclick="UISettings.savePasswordFromDialog()">保存密码</button>';
    html += '<button class="btn-secondary" style="margin-top:8px" onclick="UISettings.closePasswordDialog()">取消</button>';
    html += '</div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
  }

  function closePasswordDialog() {
    var dialog = document.querySelector('.modal-overlay.password-settings-overlay');
    if (dialog) dialog.remove();
  }

  function savePasswordFromDialog() {
    var passwordInput = document.getElementById('account-password');
    var confirmInput = document.getElementById('account-password-confirm');
    var errorEl = document.getElementById('account-password-error');
    var password = passwordInput ? String(passwordInput.value || '') : '';
    var confirmPassword = confirmInput ? String(confirmInput.value || '') : '';

    if (errorEl) {
      errorEl.style.display = 'none';
      errorEl.textContent = '';
    }

    if (password.length < 6) {
      return renderPasswordError('密码至少 6 位');
    }
    if (password !== confirmPassword) {
      return renderPasswordError('两次输入的密码不一致');
    }

    Sync.setPassword(password).then(function (result) {
      if (!result || !result.success) {
        renderPasswordError(result && result.error ? result.error : '设置密码失败');
        return;
      }
      closePasswordDialog();
      openResultSheet({
        title: '密码设置成功',
        message: '下次你可以直接使用邮箱和密码登录，不必再依赖登录邮件。',
        buttonText: '我知道了'
      });
    });
  }

  function renderPasswordError(message) {
    var errorEl = document.getElementById('account-password-error');
    if (!errorEl) {
      App.toast(message);
      return;
    }
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  }

  function sendPasswordReset() {
    Sync.getAuthState().then(function (authState) {
      var email = authState && authState.email ? authState.email : '';
      if (!email) {
        openResultSheet({
          title: '发送失败',
          message: '当前没有可用邮箱。',
          buttonText: '知道了',
          danger: true
        });
        return;
      }
      return Sync.resetPassword(email).then(function (result) {
        if (!result || !result.success) {
          openResultSheet({
            title: '发送失败',
            message: result && result.error ? result.error : '重置密码邮件发送失败，请稍后重试。',
            buttonText: '知道了',
            danger: true
          });
          return;
        }
        openResultSheet({
          title: '重置邮件已发送',
          message: '请前往当前邮箱查看邮件，并按邮件提示重置密码。',
          buttonText: '去邮箱查看'
        });
      });
    });
  }

  function repairLocalFamilyContext() {
    Sync.restoreFamilyContext({ silent: true }).then(function (result) {
      if (result && result.hasFamily) {
        openResultSheet({
          title: '修复成功',
          message: '本地家庭信息已经恢复，页面将刷新显示最新家庭状态。',
          buttonText: '刷新页面',
          onClose: function () {
            App.renderPage();
          }
        });
        return;
      }
      return loadMembershipDiagnostic().then(function (diagnostic) {
        var membership = diagnostic && diagnostic.membership ? diagnostic.membership : null;
        if (!membership) {
          openResultSheet({
            title: '修复失败',
            message: diagnostic && diagnostic.error ? diagnostic.error : '没有查到可恢复的家庭。',
            buttonText: '知道了',
            danger: true
          });
          return;
        }
        var familyId = membership.result_family_id || membership.family_id || null;
        var familyCode = membership.result_family_code || membership.family_code || null;
        if (!familyId || !familyCode) {
          openResultSheet({
            title: '修复失败',
            message: '家庭信息不完整，无法修复本地状态。',
            buttonText: '知道了',
            danger: true
          });
          return;
        }
        return DB.setMeta('familyId', familyId).then(function () {
          return DB.setMeta('familyCode', familyCode);
        }).then(function () {
          return DB.setMeta('onboardingCompleted', true);
        }).then(function () {
          return DB.setMeta('pendingJoinCode', null);
        }).then(function () {
          return DB.setMeta('pendingJoinRequestedAt', null);
        }).then(function () {
          openResultSheet({
            title: '修复成功',
            message: '本地家庭信息已经强制写回，家庭码和成员状态会重新显示。',
            buttonText: '刷新页面',
            onClose: function () {
              App.renderPage();
            }
          });
        });
      });
    }).catch(function (error) {
      openResultSheet({
        title: '修复失败',
        message: error && error.message ? error.message : '修复本地家庭信息失败。',
        buttonText: '知道了',
        danger: true
      });
    });
  }

  function toggleDiagnosticSection() {
    var block = document.querySelector('.settings-diagnostic-section');
    if (!block) return;
    block.style.display = block.style.display === 'none' ? '' : 'none';
    if (block.style.display !== 'none' && block.scrollIntoView) {
      block.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function openResultSheet(options) {
    closeResultSheet();
    options = options || {};
    var btnClass = options.danger ? 'btn-danger' : 'btn-primary';
    var html = '<div class="modal-overlay settings-result-overlay" onclick="if(event.target===this)UISettings.closeResultSheet()"><div class="modal-sheet">';
    html += '<div class="modal-handle"></div>';
    html += '<div class="modal-title">' + escapeHtml(options.title || '操作结果') + '</div>';
    html += '<div class="welcome-desc" style="margin-bottom:16px">' + escapeHtml(options.message || '') + '</div>';
    html += '<button class="' + btnClass + '" onclick="UISettings.closeResultSheet()">' + escapeHtml(options.buttonText || '知道了') + '</button>';
    html += '</div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
    pendingResultClose = typeof options.onClose === 'function' ? options.onClose : null;
  }

  function closeResultSheet() {
    var onClose = pendingResultClose;
    pendingResultClose = null;
    var dialog = document.querySelector('.modal-overlay.settings-result-overlay');
    if (dialog) dialog.remove();
    if (onClose) onClose();
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
  next.openPasswordDialog = openPasswordDialog;
  next.closePasswordDialog = closePasswordDialog;
  next.savePasswordFromDialog = savePasswordFromDialog;
  next.sendPasswordReset = sendPasswordReset;
  next.repairLocalFamilyContext = repairLocalFamilyContext;
  next.toggleDiagnosticSection = toggleDiagnosticSection;
  next.closeResultSheet = closeResultSheet;
  return next;
})(UISettings);
