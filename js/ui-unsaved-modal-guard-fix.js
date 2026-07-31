;(function () {
  var allowNextHashChange = false;
  var lastStableHash = location.hash || '#/today';

  function getLatestFormOverlay() {
    var overlays = document.querySelectorAll('.modal-overlay');
    for (var i = overlays.length - 1; i >= 0; i -= 1) {
      var overlay = overlays[i];
      if (
        overlay.classList.contains('settings-confirm-overlay') ||
        overlay.classList.contains('settings-busy-overlay') ||
        overlay.classList.contains('settings-action-result-overlay')
      ) {
        continue;
      }
      if (overlay.querySelector('input, textarea, select')) return overlay;
    }
    return null;
  }

  function collectFields(overlay, selectors) {
    if (!overlay) return [];
    var query = selectors && selectors.length ? selectors.join(',') : 'input, textarea, select';
    return Array.prototype.slice.call(overlay.querySelectorAll(query)).filter(function (field) {
      return field && !field.disabled;
    });
  }

  function serializeFields(fields) {
    return fields.map(function (field) {
      var key = field.id || field.name || field.type || field.tagName;
      if (field.type === 'checkbox' || field.type === 'radio') {
        return key + ':' + (field.checked ? '1' : '0');
      }
      return key + ':' + String(field.value || '');
    }).join('|');
  }

  function closeOverlay(overlay) {
    if (overlay) overlay.remove();
  }

  function showDiscardConfirm(options, onConfirm) {
    var message = options.message || '当前内容还没有保存，关闭后会丢失，确认继续吗？';
    if (window.UISettings && UISettings.openConfirmSheet) {
      UISettings.openConfirmSheet({
        title: options.title || '放弃本次填写',
        message: message,
        confirmText: options.confirmText || '确认放弃',
        danger: true,
        onConfirm: onConfirm
      });
      return;
    }

    if (confirm(message)) onConfirm();
  }

  function getGuardedOverlay() {
    var overlay = getLatestFormOverlay();
    if (!overlay || !overlay.__unsavedGuardMeta) return null;
    return overlay;
  }

  function isOverlayDirty(overlay) {
    if (!overlay || !overlay.__unsavedGuardMeta) return false;
    var meta = overlay.__unsavedGuardMeta;
    var currentFields = collectFields(overlay, meta.options && meta.options.selectors);
    return serializeFields(currentFields) !== meta.initialSignature;
  }

  function isCurrentModalDirty() {
    return isOverlayDirty(getGuardedOverlay());
  }

  function confirmDiscardCurrentModal(onConfirm) {
    var overlay = getGuardedOverlay();
    if (!overlay) {
      if (typeof onConfirm === 'function') onConfirm();
      return true;
    }

    var proceed = function () {
      closeOverlay(overlay);
      if (typeof onConfirm === 'function') onConfirm();
    };

    if (!isOverlayDirty(overlay)) {
      proceed();
      return true;
    }

    showDiscardConfirm(overlay.__unsavedGuardMeta.options || {}, proceed);
    return false;
  }

  function bindUnsavedGuard(options) {
    var overlay = getLatestFormOverlay();
    if (!overlay || overlay.dataset.unsavedGuardBound === '1') return;

    var fields = collectFields(overlay, options && options.selectors);
    if (!fields.length) return;

    overlay.__unsavedGuardMeta = {
      options: options || {},
      initialSignature: serializeFields(fields)
    };
    overlay.dataset.unsavedGuardBound = '1';
    overlay.setAttribute('onclick', '');
    overlay.onclick = function (event) {
      if (event.target !== overlay) return;

      if (!isOverlayDirty(overlay)) {
        closeOverlay(overlay);
        return;
      }

      showDiscardConfirm(overlay.__unsavedGuardMeta.options || {}, function () {
        closeOverlay(overlay);
      });
    };
  }

  function wrapMethod(target, methodName, guardOptionsFactory) {
    if (!target || typeof target[methodName] !== 'function') return;
    var original = target[methodName];
    target[methodName] = function () {
      var result = original.apply(this, arguments);
      var args = arguments;
      setTimeout(function () {
        var options = typeof guardOptionsFactory === 'function'
          ? guardOptionsFactory.apply(null, args)
          : (guardOptionsFactory || {});
        bindUnsavedGuard(options);
      }, 0);
      return result;
    };
  }

  function setStableHash(hash) {
    lastStableHash = hash || '#/today';
  }

  function navigateWithGuard(targetHash) {
    var nextHash = targetHash || '#/today';
    if (location.hash === nextHash) return;

    if (!isCurrentModalDirty()) {
      allowNextHashChange = true;
      location.hash = nextHash;
      return;
    }

    confirmDiscardCurrentModal(function () {
      allowNextHashChange = true;
      location.hash = nextHash;
    });
  }

  wrapMethod(window.UIToday, 'openRecord', function (type) {
    return {
      title: type === 'weight' ? '放弃本次身高体重记录' : '放弃本次记录',
      message: '当前填写内容还没有保存，关闭后会丢失，确认继续吗？',
      confirmText: '确认放弃'
    };
  });

  wrapMethod(window.UIToday, 'openDirectManualEntry', {
    title: '放弃本次亲喂补录',
    message: '当前亲喂补录内容还没有保存，关闭后会丢失，确认继续吗？',
    confirmText: '确认放弃'
  });

  wrapMethod(window.UILog, 'editEvent', {
    title: '放弃本次修改',
    message: '当前修改内容还没有保存，关闭后会丢失，确认继续吗？',
    confirmText: '确认放弃'
  });

  wrapMethod(window.UISettings, 'openBabyForm', function (baby) {
    return {
      title: baby ? '放弃编辑宝宝' : '放弃添加宝宝',
      message: '当前宝宝资料还没有保存，关闭后会丢失，确认继续吗？',
      confirmText: '确认放弃'
    };
  });

  wrapMethod(window.UISettings, 'openEditMember', {
    title: '放弃修改成员称呼',
    message: '当前成员称呼还没有保存，关闭后会丢失，确认继续吗？',
    confirmText: '确认放弃'
  });

  if (window.App && typeof App.navigate === 'function') {
    var originalNavigate = App.navigate;
    App.navigate = function (route) {
      if (!getGuardedOverlay()) return originalNavigate.call(this, route);
      navigateWithGuard('#/' + route);
    };
  }

  window.addEventListener('hashchange', function () {
    var currentHash = location.hash || '#/today';

    if (allowNextHashChange) {
      allowNextHashChange = false;
      setStableHash(currentHash);
      return;
    }

    if (!getGuardedOverlay() || !isCurrentModalDirty()) {
      setStableHash(currentHash);
      return;
    }

    if (currentHash === lastStableHash) return;

    var pendingHash = currentHash;
    allowNextHashChange = true;
    location.hash = lastStableHash;

    window.setTimeout(function () {
      allowNextHashChange = false;
      confirmDiscardCurrentModal(function () {
        allowNextHashChange = true;
        location.hash = pendingHash;
      });
    }, 0);
  });

  window.UnsavedModalGuard = {
    getLatestFormOverlay: getLatestFormOverlay,
    isCurrentModalDirty: isCurrentModalDirty,
    confirmDiscardCurrentModal: confirmDiscardCurrentModal,
    navigateWithGuard: navigateWithGuard,
    setStableHash: setStableHash
  };
})();
