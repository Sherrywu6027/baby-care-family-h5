var UIToday = (function (BaseToday) {
  function openRecord(type) {
    BaseToday.openRecord(type);
    setTimeout(function () {
      if (type === 'weight') {
        ensureFieldError('rec-height');
        ensureFieldError('rec-weight');
        bindClearOnInput(['rec-height', 'rec-weight']);
      }
      if (type === 'formula' || type === 'milk_bottle') {
        bindClearOnInput(['rec-amount']);
      }
    }, 0);
  }

  function openDirectManualEntry(existing) {
    BaseToday.openDirectManualEntry(existing);
    setTimeout(function () {
      ensureFieldError('direct-left');
      ensureFieldError('direct-right');
      bindClearOnInput(['direct-left', 'direct-right']);
    }, 0);
  }

  function saveDirectManual() {
    ensureFieldError('direct-left');
    ensureFieldError('direct-right');
    clearFormErrors(['direct-left', 'direct-right']);

    var left = parseInt(getValue('direct-left'), 10) || 0;
    var right = parseInt(getValue('direct-right'), 10) || 0;
    if (left + right <= 0) {
      setFieldError('direct-left', '至少填写一侧时长');
      setFieldError('direct-right', '至少填写一侧时长');
      return;
    }

    BaseToday.saveDirectManual();
  }

  function saveRecord(type) {
    if (type === 'weight') {
      ensureFieldError('rec-height');
      ensureFieldError('rec-weight');
      clearFormErrors(['rec-height', 'rec-weight']);
      var heightValue = parseFloat(getValue('rec-height'));
      var weightValue = parseFloat(getValue('rec-weight'));
      var hasHeight = !isNaN(heightValue) && heightValue > 0;
      var hasWeight = !isNaN(weightValue) && weightValue > 0;
      if (!hasHeight && !hasWeight) {
        setFieldError('rec-height', '请至少填写身高或体重');
        setFieldError('rec-weight', '请至少填写身高或体重');
        return;
      }
    }

    BaseToday.saveRecord(type);
  }

  function openPumpResult(event) {
    BaseToday.openPumpResult(event);
    setTimeout(function () {
      bindPumpResultDismissGuard();
      bindClearOnInput(['pump-amount', 'pump-note']);
    }, 0);
  }

  function savePump() {
    BaseToday.savePump();
  }

  function confirmDismissPumpResult() {
    if (window.UISettings && UISettings.openConfirmSheet) {
      UISettings.openConfirmSheet({
        title: '放弃本次吸奶记录',
        message: '当前吸奶结果还没有保存。现在关闭会丢失这次填写的奶量和备注，确认继续吗？',
        confirmText: '确认放弃',
        danger: true,
        onConfirm: function () {
          window._pendingTimerEvent = null;
          if (window.UIToday && UIToday.closeModal) UIToday.closeModal();
        }
      });
      return;
    }

    if (!confirm('当前吸奶结果还没有保存，关闭后会丢失本次填写内容，确认继续吗？')) return;
    window._pendingTimerEvent = null;
    if (window.UIToday && UIToday.closeModal) UIToday.closeModal();
  }

  function bindPumpResultDismissGuard() {
    var amount = document.getElementById('pump-amount');
    if (!amount) return;
    var overlay = amount.closest('.modal-overlay');
    if (!overlay || overlay.dataset.pumpDismissGuardBound === '1') return;
    overlay.dataset.pumpDismissGuardBound = '1';
    overlay.setAttribute('onclick', '');
    overlay.onclick = function (event) {
      if (event.target !== overlay) return;
      confirmDismissPumpResult();
    };
  }

  function cancelDirectTimer() {
    var active = Timer.getActive('milk_direct');
    if (!active) {
      App.navigate('today');
      return;
    }

    if (window.UISettings && UISettings.openConfirmSheet) {
      UISettings.openConfirmSheet({
        title: '放弃本次亲喂',
        message: '本次尚未保存的亲喂计时会丢失，确认现在放弃吗？',
        confirmText: '确认放弃',
        danger: true,
        onConfirm: function () {
          Timer.cancel('milk_direct');
          App.toast('已取消本次亲喂');
          App.navigate('today');
        }
      });
      return;
    }

    BaseToday.cancelDirectTimer();
  }

  var next = {};
  Object.keys(BaseToday).forEach(function (key) {
    next[key] = BaseToday[key];
  });
  next.openRecord = openRecord;
  next.openDirectManualEntry = openDirectManualEntry;
  next.saveDirectManual = saveDirectManual;
  next.saveRecord = saveRecord;
  next.openPumpResult = openPumpResult;
  next.savePump = savePump;
  next.confirmDismissPumpResult = confirmDismissPumpResult;
  next.cancelDirectTimer = cancelDirectTimer;
  return next;
})(UIToday);

var UILog = (function (BaseLog) {
  function editEvent(id) {
    BaseLog.editEvent(id);
    setTimeout(function () {
      ensureFieldError('edit-height');
      ensureFieldError('edit-weight');
      ensureFieldError('edit-left');
      ensureFieldError('edit-right');
      bindClearOnInput(['edit-height', 'edit-weight', 'edit-left', 'edit-right']);
    }, 0);
  }

  function saveEdit(id) {
    clearFormErrors(['edit-height', 'edit-weight', 'edit-left', 'edit-right']);

    var hasHeightInput = !!document.getElementById('edit-height');
    var hasWeightInput = !!document.getElementById('edit-weight');
    if (hasHeightInput || hasWeightInput) {
      var heightValue = parseFloat(getValue('edit-height'));
      var weightValue = parseFloat(getValue('edit-weight'));
      var hasHeight = !isNaN(heightValue) && heightValue > 0;
      var hasWeight = !isNaN(weightValue) && weightValue > 0;
      if (!hasHeight && !hasWeight) {
        setFieldError('edit-height', '请至少填写身高或体重');
        setFieldError('edit-weight', '请至少填写身高或体重');
        return;
      }
    }

    var hasLeft = !!document.getElementById('edit-left');
    var hasRight = !!document.getElementById('edit-right');
    if (hasLeft && hasRight) {
      var left = parseInt(getValue('edit-left'), 10) || 0;
      var right = parseInt(getValue('edit-right'), 10) || 0;
      if (left + right <= 0) {
        setFieldError('edit-left', '至少填写一侧时长');
        setFieldError('edit-right', '至少填写一侧时长');
        return;
      }
    }

    BaseLog.saveEdit(id);
  }

  function deleteEvent(id) {
    if (window.UISettings && UISettings.openConfirmSheet) {
      UISettings.openConfirmSheet({
        title: '删除这条记录',
        message: '删除后将无法恢复，确认继续吗？',
        confirmText: '确认删除',
        danger: true,
        onConfirm: function () {
          DB.deleteEvent(id).then(function () {
            if (window.UIToday && UIToday.closeModal) UIToday.closeModal();
            App.toast('已删除');
            App.renderPage();
          });
        }
      });
      return;
    }

    BaseLog.deleteEvent(id);
  }

  var next = {};
  Object.keys(BaseLog).forEach(function (key) {
    next[key] = BaseLog[key];
  });
  next.editEvent = editEvent;
  next.saveEdit = saveEdit;
  next.deleteEvent = deleteEvent;
  return next;
})(UILog);

function ensureFieldError(id) {
  var input = document.getElementById(id);
  if (!input || !input.parentNode) return;
  if (document.getElementById(id + '-error')) return;
  var error = document.createElement('div');
  error.className = 'field-error';
  error.id = id + '-error';
  error.setAttribute('aria-live', 'polite');
  input.parentNode.appendChild(error);
}

function setFieldError(id, message) {
  ensureFieldError(id);
  var input = document.getElementById(id);
  var error = document.getElementById(id + '-error');
  if (input) input.classList.add('input-error');
  if (error) error.textContent = message || '';
}

function clearFieldError(id) {
  var input = document.getElementById(id);
  var error = document.getElementById(id + '-error');
  if (input) input.classList.remove('input-error');
  if (error) error.textContent = '';
}

function clearFormErrors(ids) {
  (ids || []).forEach(clearFieldError);
}

function bindClearOnInput(ids) {
  (ids || []).forEach(function (id) {
    var input = document.getElementById(id);
    if (!input || input.dataset.fieldErrorBound === '1') return;
    input.dataset.fieldErrorBound = '1';
    input.addEventListener('input', function () {
      clearFieldError(id);
    });
    input.addEventListener('change', function () {
      clearFieldError(id);
    });
  });
}

function getValue(id) {
  var el = document.getElementById(id);
  return el ? String(el.value || '') : '';
}
