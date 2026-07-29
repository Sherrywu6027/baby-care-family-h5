var UILogin = (function () {
  var checkingTimer = null;
  var resendCooldown = 0;
  var resendTimer = null;
  var PASSWORD_NUDGE_KEY = 'password_nudge_shown_v1';

  function render(container) {
    Sync.getAuthState().then(function (authState) {
      if (authState && authState.loggedIn) {
        App.renderPage();
        return;
      }

      stopChecking();

      var html = '<div class="welcome-page compact">';
      html += '<div class="welcome-hero compact">';
      html += '<div class="welcome-badge">账号登录</div>';
      html += '<h1>先登录，系统再帮你找到家庭</h1>';
      html += '<p>首次登录的用户，登录后可以创建家庭或加入家庭；老用户登录后会自动回到原来的家庭和记录。</p>';
      html += '</div>';

      html += '<div class="welcome-section compact" style="border:1px solid rgba(99,102,241,.18);background:linear-gradient(180deg, rgba(99,102,241,.08), rgba(99,102,241,.02));box-shadow:0 10px 24px rgba(99,102,241,.08)">';
      html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px">';
      html += '<div class="welcome-title" style="margin:0">第 1 步：邮箱登录</div>';
      html += '<div style="padding:4px 10px;border-radius:999px;background:rgba(99,102,241,.12);color:var(--primary-dark);font-size:.78rem;font-weight:700">免密登录</div>';
      html += '</div>';
      html += '<div class="welcome-desc">输入常用邮箱，系统会发送一封登录邮件。打开邮件里的链接后，会自动回到这里并继续下一步。</div>';
      html += '<div class="welcome-desc" style="margin-top:10px">如果这个邮箱之前已经加入过家庭，登录后会直接恢复原来的家庭，不需要重新创建。</div>';
      html += '<div class="form-group compact-group"><label class="form-label">邮箱</label><input type="email" class="form-input" id="login-email" placeholder="如：name@example.com"></div>';
      html += '<button class="btn-primary" id="login-send-link-btn" onclick="UILogin.sendLink()">发送登录邮件</button>';
      html += '<button class="btn-secondary" style="margin-top:10px" onclick="UILogin.checkLogin()">我已经点开邮件链接</button>';
      html += '<div class="welcome-desc" style="margin-top:10px">收不到邮件时，先检查垃圾邮箱，或确认登录邮箱是否输入正确。</div>';
      html += '</div>';

      html += '<div class="welcome-divider compact"><span>或者</span></div>';

      html += '<div class="welcome-section compact" style="border:1px solid rgba(16,185,129,.20);background:linear-gradient(180deg, rgba(16,185,129,.08), rgba(16,185,129,.02));box-shadow:0 10px 24px rgba(16,185,129,.07)">';
      html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px">';
      html += '<div class="welcome-title" style="margin:0">第 2 步：密码登录</div>';
      html += '<div style="padding:4px 10px;border-radius:999px;background:rgba(16,185,129,.12);color:#047857;font-size:.78rem;font-weight:700">更快进入</div>';
      html += '</div>';
      html += '<div class="welcome-desc">如果你之前已经在设置页里设置过密码，可以直接用邮箱和密码登录。</div>';
      html += '<div class="form-group compact-group"><label class="form-label">邮箱</label><input type="email" class="form-input" id="password-login-email" placeholder="如：name@example.com"></div>';
      html += '<div class="form-group compact-group"><label class="form-label">密码</label><input type="password" class="form-input" id="password-login-password" placeholder="请输入密码"></div>';
      html += '<button class="btn-primary" onclick="UILogin.passwordLogin()">密码登录</button>';
      html += '<button class="btn-secondary" style="margin-top:10px" onclick="UILogin.resetPassword()">忘记密码，发送重置邮件</button>';
      html += '<div class="welcome-desc" style="margin-top:10px">如果你还没设置过密码，先使用上面的邮箱登录，进入后再到设置页设置密码。</div>';
      html += '</div>';

      html += '<div id="login-hint" style="margin-top:12px"></div>';
      html += '<div id="login-error" style="margin-top:12px"></div>';
      html += '</div>';

      container.innerHTML = html;
      syncCooldownButton();
    });
  }

  function sendLink() {
    if (resendCooldown > 0) {
      renderError('请稍等 ' + resendCooldown + ' 秒后再发送登录邮件');
      return;
    }
    var email = getPrimaryEmail();
    if (!email) {
      renderError('请输入邮箱');
      return;
    }
    clearError();
    renderHint('正在发送登录邮件...');
    App.toast('正在发送登录邮件');
    Sync.sendLoginCode(email).then(function (result) {
      if (!result || !result.success) {
        renderHint('');
        renderError(result && result.error ? result.error : '登录邮件发送失败');
        if (result && result.error && /过于频繁|稍后/.test(result.error)) {
          startCooldown(60);
        }
        return;
      }
      startCooldown(60);
      renderHint('邮件已发送。请打开邮箱，点击邮件里的登录链接，然后回到这里。');
      App.toast('登录邮件已发送');
      startChecking();
    });
  }

  function passwordLogin() {
    var email = getPasswordEmail();
    var password = getValue('password-login-password').trim();
    if (!email || !password) {
      renderError('请输入邮箱和密码');
      return;
    }
    clearError();
    renderHint('正在登录...');
    App.toast('正在登录');
    Sync.signInWithPassword(email, password).then(function (result) {
      if (!result || !result.success) {
        renderHint('');
        renderError(result && result.error ? result.error : '密码登录失败');
        return;
      }
      App.toast(result.hasFamily ? '已恢复原家庭' : '登录成功');
      if (result.hasFamily) App.navigate('today');
      App.renderPage();
    });
  }

  function resetPassword() {
    var email = getPrimaryEmail() || getPasswordEmail();
    if (!email) {
      renderError('请输入邮箱后再发送重置邮件');
      return;
    }
    clearError();
    renderHint('正在发送重置邮件...');
    Sync.resetPassword(email).then(function (result) {
      if (!result || !result.success) {
        renderHint('');
        renderError(result && result.error ? result.error : '重置邮件发送失败');
        return;
      }
      renderHint('重置邮件已发送。请按邮件提示设置新密码，然后回来用密码登录。');
      App.toast('重置邮件已发送');
    });
  }

  function checkLogin() {
    clearError();
    renderHint('正在检查登录状态...');
    Sync.getAuthState().then(function (state) {
      if (state && state.loggedIn) {
        return Sync.restoreFamilyContext();
      }
      return null;
    }).then(function (restoreResult) {
      return Sync.getAuthState().then(function (state) {
        if (!state || !state.loggedIn) {
          renderHint('');
          renderError('还没有检测到登录。请先打开邮件里的登录链接。');
          return;
        }
        App.toast(restoreResult && restoreResult.hasFamily ? '已恢复原家庭' : '登录成功');
        stopChecking();
        App.renderPage();
        promptSetPasswordNudge();
      });
    }).catch(function (error) {
      renderHint('');
      renderError(error && error.message ? error.message : '登录检查失败，请重试');
    });
  }

  function startChecking() {
    stopChecking();
    checkingTimer = setInterval(function () {
      Sync.getAuthState().then(function (state) {
        if (!state || !state.loggedIn) return;
        stopChecking();
        return Sync.restoreFamilyContext({ silent: true }).then(function () {
          App.renderPage();
          promptSetPasswordNudge();
        });
      }).catch(function () {});
    }, 2000);
  }

  function stopChecking() {
    if (!checkingTimer) return;
    clearInterval(checkingTimer);
    checkingTimer = null;
  }

  function startCooldown(seconds) {
    resendCooldown = Math.max(0, Number(seconds) || 0);
    syncCooldownButton();
    if (resendTimer) clearInterval(resendTimer);
    resendTimer = setInterval(function () {
      resendCooldown -= 1;
      if (resendCooldown <= 0) {
        resendCooldown = 0;
        clearInterval(resendTimer);
        resendTimer = null;
      }
      syncCooldownButton();
    }, 1000);
  }

  function syncCooldownButton() {
    var btn = document.getElementById('login-send-link-btn');
    if (!btn) return;
    btn.disabled = resendCooldown > 0;
    btn.textContent = resendCooldown > 0
      ? ('请稍等 ' + resendCooldown + ' 秒')
      : '发送登录邮件';
  }

  function promptSetPasswordNudge() {
    try {
      if (window.sessionStorage && sessionStorage.getItem(PASSWORD_NUDGE_KEY) === '1') return;
      if (window.sessionStorage) sessionStorage.setItem(PASSWORD_NUDGE_KEY, '1');
    } catch (e) {}
    setTimeout(function () {
      var ok = confirm('这次你是通过邮箱登录成功的。现在去设置一个密码吗？设置后下次可以直接用密码登录，避免邮件限流。');
      if (!ok) return;
      App.navigate('settings');
      App.renderPage();
      setTimeout(function () {
        if (window.UISettings && UISettings.openPasswordDialog) {
          UISettings.openPasswordDialog();
        }
      }, 80);
    }, 120);
  }

  function renderHint(msg) {
    var el = document.getElementById('login-hint');
    if (!el) return;
    el.innerHTML = msg ? '<div class="welcome-desc">' + escapeHtml(msg) + '</div>' : '';
  }

  function renderError(msg) {
    var el = document.getElementById('login-error');
    if (!el) return;
    el.innerHTML = '<div class="welcome-error">' + escapeHtml(msg) + '</div>';
  }

  function clearError() {
    var el = document.getElementById('login-error');
    if (el) el.innerHTML = '';
  }

  function getPrimaryEmail() {
    return getValue('login-email').trim() || getValue('password-login-email').trim();
  }

  function getPasswordEmail() {
    return getValue('password-login-email').trim() || getValue('login-email').trim();
  }

  function getValue(id) {
    var el = document.getElementById(id);
    return el ? String(el.value || '') : '';
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  return {
    render: render,
    sendLink: sendLink,
    passwordLogin: passwordLogin,
    resetPassword: resetPassword,
    checkLogin: checkLogin
  };
})();
