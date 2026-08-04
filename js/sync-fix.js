var Sync = (function (BaseSync) {
  var authState = {
    configured: false,
    loggedIn: false,
    user: null,
    email: ''
  };

  function init() {
    return BaseSync.init().then(function () {
      return refreshAuthState();
    }).then(function (state) {
      if (state.loggedIn) {
        return restoreFamilyContext({ silent: true }).catch(function () {
          return state;
        });
      }
      return clearFamilyContextLocal().then(function () {
        return state;
      });
    });
  }

  function isConfigured() {
    return BaseSync.isConfigured();
  }

  function isReady() {
    return BaseSync.isReady();
  }

  function isLoggedIn() {
    return !!authState.loggedIn;
  }

  function getClient() {
    return BaseSync.getClient();
  }

  function getAuthState() {
    return refreshAuthState();
  }

  function getSyncStatus() {
    var baseStatus = BaseSync.getSyncStatus();
    return Object.assign({}, baseStatus, {
      loggedIn: !!authState.loggedIn,
      email: authState.email || '',
      mode: !BaseSync.isConfigured()
        ? 'local-only'
        : (authState.loggedIn ? baseStatus.mode : 'auth-required')
    });
  }

  function sendLoginCode(email) {
    email = String(email || '').trim();
    if (!email) return Promise.resolve({ success: false, error: '请输入邮箱' });
    return ensureClientReady().then(function (client) {
      return client.auth.signInWithOtp({
        email: email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: location.origin + location.pathname
        }
      });
    }).then(function (result) {
      if (result.error) throw result.error;
      return { success: true };
    }).catch(function (error) {
      return { success: false, error: normalizeAuthError(error) };
    });
  }

  function signInWithPassword(email, password) {
    email = String(email || '').trim();
    password = String(password || '');
    if (!email || !password) {
      return Promise.resolve({ success: false, error: '请输入邮箱和密码' });
    }
    return ensureClientReady().then(function (client) {
      return client.auth.signInWithPassword({
        email: email,
        password: password
      });
    }).then(function (result) {
      if (result.error) throw result.error;
      return refreshAuthState();
    }).then(function () {
      return restoreFamilyContext();
    }).then(function (restoreResult) {
      if (restoreResult && restoreResult.success === false) {
        return {
          success: false,
          hasFamily: false,
          error: restoreResult.error || '鐧诲綍鎴愬姛锛屼絾鎭㈠鍘熷搴け璐?'
        };
      }
      return {
        success: true,
        hasFamily: !!(restoreResult && restoreResult.hasFamily)
      };
    }).catch(function (error) {
      return { success: false, error: normalizeAuthError(error) };
    });
  }

  function resetPassword(email) {
    email = String(email || '').trim();
    if (!email) {
      return Promise.resolve({ success: false, error: '请输入邮箱' });
    }
    return ensureClientReady().then(function (client) {
      return client.auth.resetPasswordForEmail(email, {
        redirectTo: location.origin + location.pathname
      });
    }).then(function (result) {
      if (result.error) throw result.error;
      return { success: true };
    }).catch(function (error) {
      return { success: false, error: normalizeAuthError(error) };
    });
  }

  function setPassword(password) {
    password = String(password || '');
    if (password.length < 6) {
      return Promise.resolve({ success: false, error: '密码至少 6 位' });
    }
    return ensureLoggedIn().then(function () {
      return ensureClientReady();
    }).then(function (client) {
      return client.auth.updateUser({
        password: password
      });
    }).then(function (result) {
      if (result.error) throw result.error;
      return { success: true };
    }).catch(function (error) {
      return { success: false, error: normalizeAuthError(error) };
    });
  }

  function verifyLoginCode(email, code) {
    email = String(email || '').trim();
    code = String(code || '').trim();
    if (!email || !code) {
      return Promise.resolve({ success: false, error: '请输入邮箱和验证码' });
    }
    return ensureClientReady().then(function (client) {
      return client.auth.verifyOtp({
        email: email,
        token: code,
        type: 'email'
      });
    }).then(function (result) {
      if (result.error) throw result.error;
      return refreshAuthState();
    }).then(function () {
      return restoreFamilyContext();
    }).then(function (restoreResult) {
      return {
        success: true,
        hasFamily: !!(restoreResult && restoreResult.hasFamily)
      };
    }).catch(function (error) {
      return { success: false, error: normalizeAuthError(error) };
    });
  }

  function signOut() {
    return ensureClientReady().then(function (client) {
      return client.auth.signOut();
    }).then(function (result) {
      if (result && result.error) throw result.error;
      authState = {
        configured: BaseSync.isConfigured(),
        loggedIn: false,
        user: null,
        email: ''
      };
      return DB.setMeta('authUserId', null);
    }).then(function () {
      return clearFamilyContextLocal();
    }).then(function () {
      return { success: true };
    }).catch(function (error) {
      return { success: false, error: normalizeAuthError(error) };
    });
  }

  function restoreFamilyContext(options) {
    options = options || {};
    return refreshAuthState().then(function (state) {
      if (!state.loggedIn) {
        return clearFamilyContextLocal().then(function () {
          return { success: true, hasFamily: false };
        });
      }
      return ensureClientReady().then(function (client) {
        return client.rpc('get_my_membership');
      }).then(function (result) {
        if (result.error) throw result.error;
        var row = Array.isArray(result.data) ? result.data[0] : result.data;
        if (!row) {
          return clearFamilyContextLocal().then(function () {
            return { success: true, hasFamily: false };
          });
        }
        var familyId = row.family_id || row.result_family_id || null;
        var familyCode = row.family_code || row.result_family_code || null;
        var memberRole = row.role || row.result_role || '';
        var memberDisplayName = row.display_name || row.result_display_name || memberRole || '';
        return DB.setMeta('familyId', familyId).then(function () {
          return DB.setMeta('familyCode', familyCode);
        }).then(function () {
          return DB.setMeta('memberRole', memberRole || null);
        }).then(function () {
          return DB.setMeta('memberDisplayName', memberDisplayName || null);
        }).then(function () {
          return DB.setMeta('onboardingCompleted', true);
        }).then(function () {
          return DB.setMeta('pendingJoinCode', null);
        }).then(function () {
          return DB.setMeta('pendingJoinRequestedAt', null);
        }).then(function () {
          return DB.setLastSyncAt(null);
        }).then(function () {
          return BaseSync.sync({ silent: true }).catch(function () {});
        }).then(function () {
          return {
            success: true,
            hasFamily: true,
            familyId: familyId,
            familyCode: familyCode
          };
        });
      }).catch(function (error) {
        return {
          success: false,
          hasFamily: false,
          error: normalizeAuthError(error)
        };
      });
    });
  }

  function createFamily(options) {
    return ensureLoggedIn().then(function () {
      return BaseSync.createFamily(options);
    }).then(function (result) {
      if (result && result.success) {
        return DB.setMeta('onboardingCompleted', true).then(function () {
          return result;
        });
      }
      return result;
    }).catch(function () {
      return { success: false, error: '请先登录' };
    });
  }

  function joinFamily(code, options) {
    return ensureLoggedIn().then(function () {
      return BaseSync.joinFamily(code, options);
    }).catch(function () {
      return { success: false, error: '请先登录' };
    });
  }

  function getJoinRequestStatus(code) {
    return ensureLoggedIn().then(function () {
      return BaseSync.getJoinRequestStatus(code);
    }).catch(function () {
      return { success: false, error: '请先登录' };
    });
  }

  function activateApprovedJoin(request) {
    return ensureLoggedIn().then(function () {
      return BaseSync.activateApprovedJoin(request);
    });
  }

  function listPendingJoinRequests() {
    return ensureLoggedIn().then(function () {
      return BaseSync.listPendingJoinRequests();
    }).catch(function () {
      return [];
    });
  }

  function reviewJoinRequest(requestId, action) {
    return ensureLoggedIn().then(function () {
      return BaseSync.reviewJoinRequest(requestId, action);
    }).catch(function () {
      return { success: false, error: '请先登录' };
    });
  }

  function listFamilyMembers() {
    return ensureLoggedIn().then(function () {
      return BaseSync.listFamilyMembers();
    }).catch(function () {
      return { success: true, members: [] };
    });
  }

  function removeFamilyMember(memberId) {
    return ensureLoggedIn().then(function () {
      return BaseSync.removeFamilyMember(memberId);
    }).catch(function () {
      return { success: false, error: '请先登录' };
    });
  }

  function updateFamilyMember(memberId, options) {
    return ensureLoggedIn().then(function () {
      return BaseSync.updateFamilyMember(memberId, options);
    }).catch(function () {
      return { success: false, error: '请先登录' };
    });
  }

  function transferFamilyCreator(memberId) {
    return ensureLoggedIn().then(function () {
      return BaseSync.transferFamilyCreator(memberId);
    }).catch(function () {
      return { success: false, error: '请先登录' };
    });
  }

  function leaveFamily() {
    return ensureLoggedIn().then(function () {
      return BaseSync.leaveFamily();
    }).then(function (result) {
      if (!result || !result.success) return result;
      return clearFamilyContextLocal().then(function () {
        return result;
      });
    }).catch(function () {
      return { success: false, error: '请先登录' };
    });
  }

  function sync(options) {
    return ensureLoggedIn().then(function () {
      return BaseSync.sync(options);
    }).catch(function () {
      return {
        synced: 0,
        skipped: true,
        reason: 'not_authenticated'
      };
    });
  }

  function onStateChange(listener) {
    if (BaseSync.onStateChange) return BaseSync.onStateChange(listener);
    return function () {};
  }

  function refreshAuthState() {
    if (!BaseSync.isConfigured()) {
      authState = {
        configured: false,
        loggedIn: false,
        user: null,
        email: ''
      };
      return Promise.resolve(authState);
    }
    return ensureClientReady().then(function (client) {
      return client.auth.getUser();
    }).then(function (result) {
      var user = result && result.data ? result.data.user : null;
      if (user && isAnonymousUser(user)) {
        return getClient().auth.signOut().catch(function () {
          return null;
        }).then(function () {
          user = null;
          return persistAuthState(user);
        });
      }
      return persistAuthState(user);
    }).catch(function () {
      return persistAuthState(null);
    });
  }

  function persistAuthState(user) {
    authState = {
      configured: BaseSync.isConfigured(),
      loggedIn: !!(user && user.id && user.email),
      user: user || null,
      email: user && user.email ? user.email : ''
    };
    return DB.setMeta('authUserId', authState.loggedIn && user ? user.id : null).catch(function () {
      return null;
    }).then(function () {
      return authState;
    });
  }

  function ensureClientReady() {
    if (BaseSync.isReady() && BaseSync.getClient()) return Promise.resolve(BaseSync.getClient());
    return BaseSync.init().then(function () {
      if (!BaseSync.getClient()) throw new Error('sync_not_ready');
      return BaseSync.getClient();
    });
  }

  function ensureLoggedIn() {
    return refreshAuthState().then(function (state) {
      if (state.loggedIn) return state;
      throw new Error('auth_required');
    });
  }

  function isAnonymousUser(user) {
    if (!user) return false;
    if (user.is_anonymous) return true;
    return !user.email;
  }

  function clearFamilyContextLocal() {
    return DB.setMeta('familyId', null).then(function () {
      return DB.setMeta('familyCode', null);
    }).then(function () {
      return DB.setMeta('onboardingCompleted', false);
    }).then(function () {
      return DB.setMeta('currentBabyId', null);
    }).then(function () {
      return DB.setLastSyncAt(null);
    });
  }

  function normalizeAuthError(error) {
    var message = error && error.message ? error.message : String(error || '');
    if (/invalid.*token/i.test(message) || /token.*expired/i.test(message) || /otp_expired/i.test(message)) {
      return '验证码错误或已过期';
    }
    if (/email.*invalid/i.test(message)) {
      return '邮箱格式不正确';
    }
    if (/security purposes|rate limit/i.test(message)) {
      return '验证码发送过于频繁，请稍后再试';
    }
    if (/invalid login credentials/i.test(message)) {
      return '邮箱或密码错误';
    }
    if (/password should be at least/i.test(message)) {
      return '密码至少 6 位';
    }
    if (/auth_required/i.test(message)) {
      return '请先登录';
    }
    return message || '登录失败，请重试';
  }

  return {
    init: init,
    isConfigured: isConfigured,
    isReady: isReady,
    isLoggedIn: isLoggedIn,
    getClient: getClient,
    getAuthState: getAuthState,
    getSyncStatus: getSyncStatus,
    sendLoginCode: sendLoginCode,
    signInWithPassword: signInWithPassword,
    resetPassword: resetPassword,
    setPassword: setPassword,
    verifyLoginCode: verifyLoginCode,
    signOut: signOut,
    restoreFamilyContext: restoreFamilyContext,
    sync: sync,
    onStateChange: onStateChange,
    createFamily: createFamily,
    joinFamily: joinFamily,
    getJoinRequestStatus: getJoinRequestStatus,
    activateApprovedJoin: activateApprovedJoin,
    listPendingJoinRequests: listPendingJoinRequests,
    reviewJoinRequest: reviewJoinRequest,
    listFamilyMembers: listFamilyMembers,
    removeFamilyMember: removeFamilyMember,
    updateFamilyMember: updateFamilyMember,
    transferFamilyCreator: transferFamilyCreator,
    leaveFamily: leaveFamily
  };
})(Sync);
