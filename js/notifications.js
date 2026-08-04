var AppNotifications = (function () {
  var READ_IDS_KEY = 'notificationReadIds';
  var KNOWN_IDS_KEY = 'notificationKnownIds';
  var SYSTEM_ENABLED_KEY = 'notificationSystemEnabled';
  var RECORD_ENABLED_KEY = 'notificationRecordEnabled';
  var MAX_RECORD_ITEMS = 20;
  var MAX_RECORD_AGE_MS = 7 * 24 * 60 * 60 * 1000;
  var listeners = [];
  var pollTimer = null;
  var initialized = false;
  var refreshing = null;
  var state = {
    items: [],
    unreadCount: 0,
    permission: getPermissionState(),
    systemEnabled: false,
    supported: isSystemNotificationSupported(),
    recordEnabled: true
  };

  function init() {
    if (!pollTimer) {
      pollTimer = setInterval(function () {
        refresh({ allowSystem: true }).catch(function () {});
      }, 30000);
    }
    return refresh({ prime: true, allowSystem: false });
  }

  function refresh(options) {
    options = options || {};
    if (refreshing) return refreshing;

    refreshing = Promise.all([
      Sync.getAuthState ? Sync.getAuthState() : Promise.resolve({ loggedIn: false }),
      DB.getMeta('familyId'),
      DB.getMeta('pendingJoinCode'),
      DB.getMeta('authUserId'),
      DB.getMeta(READ_IDS_KEY),
      DB.getMeta(KNOWN_IDS_KEY),
      DB.getMeta(SYSTEM_ENABLED_KEY),
      DB.getMeta(RECORD_ENABLED_KEY)
    ]).then(function (results) {
      var authState = results[0] || { loggedIn: false };
      var familyId = results[1] || null;
      var pendingJoinCode = results[2] || null;
      var authUserId = results[3] || null;
      var readIds = normalizeIdList(results[4]);
      var knownIds = normalizeIdList(results[5]);
      var systemEnabled = results[6] === true;
      var recordEnabled = results[7] !== false;

      state.permission = getPermissionState();
      state.supported = isSystemNotificationSupported();
      state.systemEnabled = systemEnabled;
      state.recordEnabled = recordEnabled;

      if (!authState.loggedIn || !Sync.isConfigured || !Sync.isConfigured()) {
        return persistState([], readIds, [], systemEnabled, recordEnabled, options);
      }

      return Promise.all([
        familyId ? Sync.listPendingJoinRequests() : Promise.resolve([]),
        pendingJoinCode ? Sync.getJoinRequestStatus(pendingJoinCode) : Promise.resolve(null),
        familyId && recordEnabled ? buildRecordNotificationItems(familyId, authUserId) : Promise.resolve([])
      ]).then(function (payload) {
        var pendingRequests = payload[0] || [];
        var joinState = payload[1] || null;
        var recordItems = payload[2] || [];
        var items = buildNotificationItems(pendingRequests, joinState, pendingJoinCode, recordItems);
        return persistState(items, readIds, knownIds, systemEnabled, recordEnabled, options);
      });
    }).catch(function () {
      return state;
    }).finally(function () {
      refreshing = null;
    });

    return refreshing;
  }

  function persistState(items, readIds, knownIds, systemEnabled, recordEnabled, options) {
    options = options || {};
    var currentIds = items.map(function (item) { return item.id; });
    var filteredReadIds = readIds.filter(function (id) {
      return currentIds.indexOf(id) >= 0;
    });
    var nextKnownIds = currentIds.slice();
    var shouldNotify = initialized && options.allowSystem !== false;
    var newItems = items.filter(function (item) {
      return knownIds.indexOf(item.id) < 0;
    });

    return Promise.all([
      DB.setMeta(READ_IDS_KEY, filteredReadIds),
      DB.setMeta(KNOWN_IDS_KEY, nextKnownIds),
      DB.setMeta(SYSTEM_ENABLED_KEY, !!systemEnabled),
      DB.setMeta(RECORD_ENABLED_KEY, recordEnabled !== false)
    ]).catch(function () {
      return null;
    }).then(function () {
      state.items = items.map(function (item) {
        return Object.assign({}, item, {
          unread: filteredReadIds.indexOf(item.id) < 0
        });
      });
      state.unreadCount = state.items.filter(function (item) {
        return item.unread;
      }).length;
      state.permission = getPermissionState();
      state.supported = isSystemNotificationSupported();
      state.systemEnabled = !!systemEnabled;
      state.recordEnabled = recordEnabled !== false;
      initialized = true;
      emitChange();
      if (shouldNotify) return maybeNotify(newItems);
      return null;
    }).then(function () {
      return state;
    });
  }

  function buildNotificationItems(pendingRequests, joinState, pendingJoinCode, recordItems) {
    var items = [];

    (pendingRequests || []).forEach(function (request) {
      items.push({
        id: 'join-request-pending:' + request.id,
        type: 'join-request-pending',
        title: '新的加入申请',
        body: buildPendingRequestBody(request),
        createdAt: request.created_at || nowIso(),
        actionLabel: '去审核',
        request: request
      });
    });

    if (joinState && joinState.request && (joinState.status === 'approved' || joinState.status === 'rejected')) {
      items.push({
        id: 'join-request-status:' + joinState.request.id + ':' + joinState.status,
        type: joinState.status === 'approved' ? 'join-request-approved' : 'join-request-rejected',
        title: joinState.status === 'approved' ? '加入申请已通过' : '加入申请未通过',
        body: buildJoinStatusBody(joinState.request, pendingJoinCode),
        createdAt: joinState.request.reviewed_at || joinState.request.created_at || nowIso(),
        actionLabel: joinState.status === 'approved' ? '进入家庭' : '我知道了',
        request: joinState.request
      });
    }

    (recordItems || []).forEach(function (item) {
      items.push(item);
    });

    items.sort(function (a, b) {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return items;
  }

  function buildRecordNotificationItems(familyId, authUserId) {
    return DB.getBabies().then(function (babies) {
      var familyBabies = (babies || []).filter(function (baby) {
        return !familyId || baby.family_id === familyId;
      });
      var babyNameMap = {};
      familyBabies.forEach(function (baby) {
        babyNameMap[baby.id] = baby.name || '宝宝';
      });

      return Promise.all(familyBabies.map(function (baby) {
        return DB.getAllEvents(baby.id);
      })).then(function (groups) {
        var now = Date.now();
        var events = [];
        groups.forEach(function (group) {
          (group || []).forEach(function (event) {
            if (!event || event.deleted_at) return;
            if (familyId && event.family_id !== familyId) return;
            if (!event.recorded_by_user || event.recorded_by_user === authUserId) return;
            var createdMs = getEventCreatedMs(event);
            if (!createdMs || (now - createdMs) > MAX_RECORD_AGE_MS) return;
            events.push(event);
          });
        });

        events.sort(function (a, b) {
          return getEventCreatedMs(b) - getEventCreatedMs(a);
        });

        return events.slice(0, MAX_RECORD_ITEMS).map(function (event) {
          var memberName = event.recorded_by_name || '家人';
          var babyName = babyNameMap[event.baby_id] || '宝宝';
          return {
            id: 'family-record:' + event.id,
            type: 'family-record',
            title: memberName + '新增了一条记录',
            body: babyName + ' · ' + buildRecordBody(event),
            createdAt: event.created_at || event.updated_at || event.start_time || nowIso(),
            actionLabel: '去查看',
            route: '#/log',
            eventId: event.id
          };
        });
      });
    });
  }

  function buildRecordBody(event) {
    var summary = '';
    if (window.Calc && typeof Calc.eventDescription === 'function') {
      summary = Calc.eventDescription(event);
    }
    summary = String(summary || '').trim();
    if (summary) return summary;
    return getEventTypeLabel(event && event.type);
  }

  function buildPendingRequestBody(request) {
    var name = request.display_name || request.role || '新成员';
    var account = request.requester_email || request.requester_user || '';
    var parts = [name + ' 申请加入家庭'];
    if (account) parts.push('账号：' + account);
    return parts.join(' · ');
  }

  function buildJoinStatusBody(request, pendingJoinCode) {
    var code = request.family_code || pendingJoinCode || '';
    if (request.status === 'approved') {
      return code ? ('家庭码 ' + code + ' 已同意你加入') : '家庭创建者已同意你加入';
    }
    return code ? ('家庭码 ' + code + ' 的加入申请未通过') : '你的加入申请未通过';
  }

  function maybeNotify(items) {
    if (!items || !items.length) return Promise.resolve();
    if (!state.supported || !state.systemEnabled || state.permission !== 'granted') {
      return Promise.resolve();
    }

    return Promise.all(items.map(function (item) {
      return showSystemNotification(item).catch(function () {
        return null;
      });
    })).then(function () {
      return null;
    });
  }

  function showSystemNotification(item) {
    var title = item.title || '家庭提醒';
    var options = {
      body: item.body || '',
      tag: item.id,
      data: {
        notificationId: item.id,
        route: getSystemNotificationRoute(item)
      }
    };

    if ('serviceWorker' in navigator) {
      return navigator.serviceWorker.getRegistration().then(function (registration) {
        if (registration && registration.showNotification) {
          return registration.showNotification(title, options);
        }
        if (typeof Notification === 'function') {
          new Notification(title, options);
        }
        return null;
      });
    }

    if (typeof Notification === 'function') {
      new Notification(title, options);
    }
    return Promise.resolve();
  }

  function getSystemNotificationRoute(item) {
    if (!item) return '#/today';
    if (item.type === 'join-request-pending') return '#/settings';
    if (item.type === 'join-request-rejected') return '#/welcome';
    if (item.type === 'family-record') return '#/log';
    return '#/today';
  }

  function getState() {
    return {
      items: state.items.slice(),
      unreadCount: state.unreadCount,
      permission: state.permission,
      systemEnabled: state.systemEnabled,
      supported: state.supported,
      recordEnabled: state.recordEnabled
    };
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') return function () {};
    listeners.push(listener);
    listener(getState());
    return function () {
      listeners = listeners.filter(function (entry) {
        return entry !== listener;
      });
    };
  }

  function emitChange() {
    var snapshot = getState();
    listeners.slice().forEach(function (listener) {
      try {
        listener(snapshot);
      } catch (error) {}
    });
    window.dispatchEvent(new CustomEvent('baby-notifications-changed', {
      detail: snapshot
    }));
  }

  function markAllRead() {
    var ids = state.items.map(function (item) { return item.id; });
    state.items = state.items.map(function (item) {
      return Object.assign({}, item, { unread: false });
    });
    state.unreadCount = 0;
    return DB.setMeta(READ_IDS_KEY, ids).catch(function () {
      return null;
    }).then(function () {
      emitChange();
      return getState();
    });
  }

  function markRead(id) {
    if (!id) return Promise.resolve(getState());
    return DB.getMeta(READ_IDS_KEY).then(function (readIds) {
      var next = normalizeIdList(readIds);
      if (next.indexOf(id) < 0) next.push(id);
      return DB.setMeta(READ_IDS_KEY, next);
    }).catch(function () {
      return null;
    }).then(function () {
      return refresh({ allowSystem: false });
    });
  }

  function requestSystemPermission() {
    if (!isSystemNotificationSupported()) {
      return Promise.resolve({ success: false, error: '当前浏览器不支持系统通知' });
    }
    return Promise.resolve(Notification.requestPermission()).then(function (permission) {
      state.permission = permission;
      if (permission !== 'granted') {
        return DB.setMeta(SYSTEM_ENABLED_KEY, false).then(function () {
          state.systemEnabled = false;
          emitChange();
          return {
            success: false,
            error: permission === 'denied' ? '浏览器已拒绝系统通知' : '你还没有允许系统通知'
          };
        });
      }
      return DB.setMeta(SYSTEM_ENABLED_KEY, true).then(function () {
        state.systemEnabled = true;
        emitChange();
        return { success: true };
      });
    }).catch(function (error) {
      return {
        success: false,
        error: error && error.message ? error.message : '开启系统通知失败'
      };
    });
  }

  function disableSystemNotifications() {
    return DB.setMeta(SYSTEM_ENABLED_KEY, false).then(function () {
      state.systemEnabled = false;
      emitChange();
      return { success: true };
    }).catch(function () {
      return { success: false, error: '关闭系统通知失败' };
    });
  }

  function setRecordNotificationsEnabled(enabled) {
    var nextValue = enabled !== false;
    return DB.setMeta(RECORD_ENABLED_KEY, nextValue).then(function () {
      state.recordEnabled = nextValue;
      return refresh({ allowSystem: false });
    }).then(function () {
      return { success: true, enabled: nextValue };
    }).catch(function (error) {
      return {
        success: false,
        error: error && error.message ? error.message : '更新家庭记录提醒失败'
      };
    });
  }

  function openItem(itemId) {
    var item = state.items.filter(function (entry) {
      return entry.id === itemId;
    })[0] || null;
    if (!item) return Promise.resolve({ success: false, error: '提醒不存在' });

    return markRead(itemId).then(function () {
      if (item.type === 'join-request-approved' && item.request) {
        return Sync.activateApprovedJoin(item.request).then(function (result) {
          if (result && result.success) {
            App.toast('已进入原家庭');
            App.navigate('today');
            return result;
          }
          App.toast(result && result.error ? result.error : '进入家庭失败');
          return result;
        });
      }

      if (item.type === 'join-request-rejected') {
        return Promise.all([
          DB.setMeta('pendingJoinCode', null),
          DB.setMeta('pendingJoinRequestedAt', null)
        ]).then(function () {
          App.navigate('welcome');
          return { success: true };
        });
      }

      if (item.type === 'family-record') {
        App.navigate('log');
        return { success: true };
      }

      App.navigate('settings');
      return { success: true };
    });
  }

  function getPermissionState() {
    if (!isSystemNotificationSupported()) return 'unsupported';
    return Notification.permission || 'default';
  }

  function isSystemNotificationSupported() {
    return typeof Notification !== 'undefined';
  }

  function normalizeIdList(value) {
    return Array.isArray(value) ? value.filter(Boolean).map(String) : [];
  }

  function getEventCreatedMs(event) {
    return new Date(event && (event.created_at || event.updated_at || event.start_time) || 0).getTime() || 0;
  }

  function getEventTypeLabel(type) {
    if (window.EVENT_TYPES && EVENT_TYPES[type] && EVENT_TYPES[type].label) {
      return EVENT_TYPES[type].label;
    }
    return String(type || '记录');
  }

  function nowIso() {
    return new Date().toISOString();
  }

  return {
    init: init,
    refresh: refresh,
    getState: getState,
    subscribe: subscribe,
    markAllRead: markAllRead,
    markRead: markRead,
    openItem: openItem,
    requestSystemPermission: requestSystemPermission,
    disableSystemNotifications: disableSystemNotifications,
    setRecordNotificationsEnabled: setRecordNotificationsEnabled
  };
})();
