var Sync = (function (BaseSync) {
  function signUpWithPassword(email, password) {
    email = String(email || '').trim();
    password = String(password || '');

    if (!email || !password) {
      return Promise.resolve({ success: false, error: '请输入邮箱和密码' });
    }
    if (password.length < 6) {
      return Promise.resolve({ success: false, error: '密码至少 6 位' });
    }

    var client = BaseSync.getClient();
    if (!client) {
      return Promise.resolve({ success: false, error: '登录服务还没准备好，请刷新页面后重试' });
    }

    return client.auth.signUp({
      email: email,
      password: password
    }).then(function (result) {
      if (result && result.error) throw result.error;
      return BaseSync.getAuthState();
    }).then(function (state) {
      if (!state || !state.loggedIn) {
        return {
          success: false,
          hasFamily: false,
          error: '注册请求已提交，但当前没有直接登录成功。请到 Supabase 后台关闭 Confirm Email。'
        };
      }
      return BaseSync.restoreFamilyContext();
    }).then(function (restoreResult) {
      if (restoreResult && restoreResult.success === false) {
        return {
          success: false,
          hasFamily: false,
          error: restoreResult.error || '注册成功，但恢复家庭失败'
        };
      }
      return {
        success: true,
        hasFamily: !!(restoreResult && restoreResult.hasFamily)
      };
    }).catch(function (error) {
      return {
        success: false,
        error: normalizeSignUpError(error)
      };
    });
  }

  function normalizeSignUpError(error) {
    var message = error && error.message ? error.message : String(error || '');
    if (/user already registered/i.test(message) || /already been registered/i.test(message)) {
      return '这个邮箱已经注册过了，请直接登录';
    }
    if (/email not confirmed/i.test(message)) {
      return '当前邮箱还未确认。请先在 Supabase 后台关闭 Confirm Email。';
    }
    if (/password should be at least/i.test(message)) {
      return '密码至少 6 位';
    }
    if (/email.*invalid/i.test(message)) {
      return '邮箱格式不正确';
    }
    return message || '注册失败，请重试';
  }

  var next = {};
  Object.keys(BaseSync).forEach(function (key) {
    next[key] = BaseSync[key];
  });
  next.signUpWithPassword = signUpWithPassword;
  return next;
})(Sync);
