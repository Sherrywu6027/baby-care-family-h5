var UILogin = (function () {
  function render(container) {
    Sync.getAuthState().then(function (authState) {
      if (authState && authState.loggedIn) {
        App.renderPage();
        return;
      }

      var html = '<div class="welcome-page compact">';
      html += '<div class="welcome-hero compact">';
      html += '<div class="welcome-badge">账号登录</div>';
      html += '<h1>先登录，再进入你的家庭</h1>';
      html += '<p>首次使用请直接注册；已有账号直接输入邮箱和密码登录。登录成功后会自动恢复你原来的家庭和记录。</p>';
      html += '</div>';

      html += '<div class="welcome-section compact" style="border:1px solid rgba(99,102,241,.18);background:linear-gradient(180deg, rgba(99,102,241,.08), rgba(99,102,241,.02));box-shadow:0 10px 24px rgba(99,102,241,.08)">';
      html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px">';
      html += '<div class="welcome-title" style="margin:0">首次使用：注册账号</div>';
      html += '<div style="padding:4px 10px;border-radius:999px;background:rgba(99,102,241,.12);color:var(--primary-dark);font-size:.78rem;font-weight:700">直接注册</div>';
      html += '</div>';
      html += '<div class="welcome-desc">没有账号时，在这里填写邮箱和密码即可注册。注册成功后会继续进入创建家庭或加入家庭流程。</div>';
      html += renderField('signup-email', '邮箱', 'email', '如：name@example.com', 'email');
      html += renderField('signup-password', '密码', 'password', '至少 6 位', 'new-password');
      html += '<button class="btn-primary" onclick="UILogin.signUp()">注册并进入</button>';
      html += '</div>';

      html += '<div class="welcome-divider compact"><span>或</span></div>';

      html += '<div class="welcome-section compact" style="border:1px solid rgba(16,185,129,.20);background:linear-gradient(180deg, rgba(16,185,129,.08), rgba(16,185,129,.02));box-shadow:0 10px 24px rgba(16,185,129,.07)">';
      html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px">';
      html += '<div class="welcome-title" style="margin:0">已有账号：密码登录</div>';
      html += '<div style="padding:4px 10px;border-radius:999px;background:rgba(16,185,129,.12);color:#047857;font-size:.78rem;font-weight:700">直接进入</div>';
      html += '</div>';
      html += '<div class="welcome-desc">如果这个邮箱之前已经注册并加入过家庭，登录后会优先恢复原来的家庭，再进入今天页面。</div>';
      html += renderField('login-email', '邮箱', 'email', '如：name@example.com', 'email');
      html += renderField('login-password', '密码', 'password', '请输入密码', 'current-password');
      html += '<button class="btn-primary" onclick="UILogin.passwordLogin()">密码登录</button>';
      html += '<button class="btn-secondary" style="margin-top:10px" onclick="UILogin.resetPassword()">忘记密码，发送重置邮件</button>';
      html += '</div>';

      html += '<div id="login-hint" style="margin-top:12px"></div>';
      html += '<div id="login-error" style="margin-top:12px"></div>';
      html += '</div>';

      container.innerHTML = html;
      bindFieldFeedback(container);
    });
  }

  function renderField(id, label, type, placeholder, autocomplete) {
    return ''
      + '<div class="form-group compact-group" id="' + id + '-group">'
      + '<label class="form-label" for="' + id + '">' + label + '</label>'
      + '<input type="' + type + '" class="form-input" id="' + id + '" placeholder="' + placeholder + '" autocapitalize="off" autocomplete="' + autocomplete + '">'
      + '<div class="field-error" id="' + id + '-error" aria-live="polite"></div>'
      + '</div>';
  }

  function bindFieldFeedback(container) {
    var ids = ['signup-email', 'signup-password', 'login-email', 'login-password'];
    ids.forEach(function (id) {
      var el = container.querySelector('#' + id);
      if (!el) return;
      el.addEventListener('input', function () {
        clearFieldError(id);
        clearError();
      });
      el.addEventListener('blur', function () {
        validateSingleField(id);
      });
    });
  }

  function signUp() {
    clearAllErrors();
    var email = getValue('signup-email').trim();
    var password = getValue('signup-password').trim();

    var hasError = false;
    if (!email) {
      setFieldError('signup-email', '请输入邮箱');
      hasError = true;
    } else if (!isEmail(email)) {
      setFieldError('signup-email', '邮箱格式不正确');
      hasError = true;
    }
    if (!password) {
      setFieldError('signup-password', '请输入密码');
      hasError = true;
    } else if (password.length < 6) {
      setFieldError('signup-password', '密码至少 6 位');
      hasError = true;
    }
    if (hasError) return;

    renderHint('正在注册...');
    Sync.signUpWithPassword(email, password).then(function (result) {
      if (!result || !result.success) {
        renderHint('');
        handleSubmitError('signup', result && result.error ? result.error : '注册失败');
        return;
      }
      App.toast(result.hasFamily ? '已恢复原家庭' : '注册成功');
      if (result.hasFamily) App.navigate('today');
      App.renderPage();
    });
  }

  function passwordLogin() {
    clearAllErrors();
    var email = getValue('login-email').trim();
    var password = getValue('login-password').trim();

    var hasError = false;
    if (!email) {
      setFieldError('login-email', '请输入邮箱');
      hasError = true;
    } else if (!isEmail(email)) {
      setFieldError('login-email', '邮箱格式不正确');
      hasError = true;
    }
    if (!password) {
      setFieldError('login-password', '请输入密码');
      hasError = true;
    }
    if (hasError) return;

    renderHint('正在登录...');
    Sync.signInWithPassword(email, password).then(function (result) {
      if (!result || !result.success) {
        renderHint('');
        handleSubmitError('login', result && result.error ? result.error : '密码登录失败');
        return;
      }
      App.toast(result.hasFamily ? '已恢复原家庭' : '登录成功');
      if (result.hasFamily) App.navigate('today');
      App.renderPage();
    });
  }

  function resetPassword() {
    clearAllErrors();
    var email = getValue('login-email').trim() || getValue('signup-email').trim();
    var targetId = getValue('login-email').trim() ? 'login-email' : 'signup-email';

    if (!email) {
      setFieldError('login-email', '请先输入邮箱');
      return;
    }
    if (!isEmail(email)) {
      setFieldError(targetId, '邮箱格式不正确');
      return;
    }

    renderHint('正在发送重置邮件...');
    Sync.resetPassword(email).then(function (result) {
      if (!result || !result.success) {
        renderHint('');
        handleSubmitError(targetId.indexOf('signup') === 0 ? 'signup' : 'login', result && result.error ? result.error : '重置邮件发送失败');
        return;
      }
      renderHint('重置邮件已发送。请按邮件提示设置新密码，然后再回来登录。');
      App.toast('重置邮件已发送');
    });
  }

  function validateSingleField(id) {
    var value = getValue(id).trim();
    if (!value) return;
    if (id.indexOf('email') > -1 && !isEmail(value)) {
      setFieldError(id, '邮箱格式不正确');
      return false;
    }
    if (id.indexOf('password') > -1 && id.indexOf('signup') === 0 && value.length < 6) {
      setFieldError(id, '密码至少 6 位');
      return false;
    }
    clearFieldError(id);
    return true;
  }

  function handleSubmitError(scope, message) {
    var targetId = pickFieldForError(scope, message);
    if (targetId) {
      setFieldError(targetId, message);
      return;
    }
    renderError(message);
  }

  function pickFieldForError(scope, message) {
    var text = String(message || '');
    if (/邮箱|email/i.test(text)) return scope === 'signup' ? 'signup-email' : 'login-email';
    if (/密码|password/i.test(text)) return scope === 'signup' ? 'signup-password' : 'login-password';
    return '';
  }

  function setFieldError(id, msg) {
    var input = document.getElementById(id);
    var error = document.getElementById(id + '-error');
    if (input) input.classList.add('input-error');
    if (error) error.textContent = msg;
  }

  function clearFieldError(id) {
    var input = document.getElementById(id);
    var error = document.getElementById(id + '-error');
    if (input) input.classList.remove('input-error');
    if (error) error.textContent = '';
  }

  function clearAllErrors() {
    ['signup-email', 'signup-password', 'login-email', 'login-password'].forEach(clearFieldError);
    clearError();
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

  function getValue(id) {
    var el = document.getElementById(id);
    return el ? String(el.value || '') : '';
  }

  function isEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ''));
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
    signUp: signUp,
    passwordLogin: passwordLogin,
    resetPassword: resetPassword
  };
})();
