var UIToday = (function (baseUIToday) {
  if (!baseUIToday) return baseUIToday;

  var BACKFILL_OVERLAY_CLASS = 'timer-backfill-overlay';
  var originalOpenRecord = baseUIToday.openRecord;

  function openRecord(type) {
    var result = originalOpenRecord.apply(this, arguments);
    if (type === 'pump' || type === 'sleep') {
      scheduleRunningSheetRefresh(type);
    }
    return result;
  }

  function openPumpRunningSheet() {
    baseUIToday.openPumpRunningSheet();
    scheduleRunningSheetRefresh('pump');
  }

  function openSleepRunningSheet() {
    baseUIToday.openSleepRunningSheet();
    scheduleRunningSheetRefresh('sleep');
  }

  function closePumpRunningSheet() {
    closeTimerBackfillSheet();
    baseUIToday.closePumpRunningSheet();
  }

  function closeSleepRunningSheet() {
    closeTimerBackfillSheet();
    baseUIToday.closeSleepRunningSheet();
  }

  function stopPumpFromSheet() {
    closeTimerBackfillSheet();
    baseUIToday.stopPumpFromSheet();
  }

  function stopSleepFromSheet() {
    closeTimerBackfillSheet();
    baseUIToday.stopSleepFromSheet();
  }

  function startDirectTimer(startMs) {
    return baseUIToday.startDirectTimer.apply(this, arguments);
  }

  function scheduleRunningSheetRefresh(type) {
    setTimeout(function () {
      injectBackfillEntry(type);
      refreshTimerRunningState(type);
    }, 0);
    setTimeout(function () {
      injectBackfillEntry(type);
      refreshTimerRunningState(type);
    }, 120);
  }

  function injectBackfillEntry(type) {
    var overlay = document.querySelector(getOverlaySelector(type));
    if (!overlay) return;

    var pauseButton = overlay.querySelector(getPauseButtonSelector(type));
    if (!pauseButton || !pauseButton.parentNode) return;

    var buttonId = getBackfillButtonId(type);
    if (document.getElementById(buttonId)) return;

    var button = document.createElement('button');
    button.type = 'button';
    button.id = buttonId;
    button.className = 'btn-secondary timer-backfill-open-btn';
    button.textContent = '改为从过去开始';
    button.onclick = function () {
      openTimerBackfillSheet(type);
    };

    pauseButton.parentNode.insertBefore(button, pauseButton);
  }

  function openDirectPresetStartSheet() {
    openStandaloneStartSheet({
      title: '按过去时间开始亲喂',
      desc: '仅支持选择今天更早的开始时间，确认后会直接启动亲喂计时。',
      confirmText: '确认开始',
      onConfirm: function (startMs) {
        startDirectTimer(startMs);
        return true;
      }
    });
  }

  function openTimerBackfillSheet(type) {
    var active = Timer.getActive(type);
    if (!active) {
      App.toast(getTimerLabel(type) + '计时已结束');
      return;
    }

    openStandaloneStartSheet({
      title: '修改本次开始时间',
      desc: '仅支持补录今天的开始时间，而且不能晚于当前时间。',
      defaultTime: active.startTime || Date.now(),
      confirmText: '确认修改',
      onConfirm: function (startMs, timeValue) {
        var nextActive = Timer.adjustStartTime(type, startMs);
        if (!nextActive) {
          setTimerBackfillError('开始时间修改失败，请稍后重试');
          return false;
        }
        refreshTimerRunningState(type, nextActive);
        App.toast('已按 ' + timeValue + ' 作为开始时间');
        return true;
      }
    });
  }

  function openStandaloneStartSheet(options) {
    options = options || {};
    closeTimerBackfillSheet();

    var defaultTime = options.defaultTime || Date.now();
    var html = '';
    html += '<div class="modal-overlay ' + BACKFILL_OVERLAY_CLASS + '" onclick="if(event.target===this)UIToday.closeTimerBackfillSheet()">';
    html += '<div class="modal-sheet timer-backfill-sheet">';
    html += '<div class="modal-handle"></div>';
    html += '<div class="modal-title">' + escapeHtml(options.title || '设置开始时间') + '</div>';
    html += '<div class="welcome-desc timer-backfill-desc">' + escapeHtml(options.desc || '') + '</div>';
    html += '<label class="timer-backfill-field" for="timer-backfill-time-input">';
    html += '<span class="timer-backfill-label">开始时间</span>';
    html += '<input id="timer-backfill-time-input" class="timer-backfill-input" type="time" step="60" max="' + escapeAttr(formatChinaTime(Date.now())) + '" value="' + escapeAttr(formatChinaTime(defaultTime)) + '">';
    html += '</label>';
    html += '<div class="field-error timer-backfill-error" id="timer-backfill-error" aria-live="polite"></div>';
    html += '<div class="timer-backfill-current">当前时间 ' + formatChinaTime(Date.now()) + '</div>';
    html += '<div class="timer-backfill-actions">';
    html += '<button type="button" class="btn-secondary" onclick="UIToday.closeTimerBackfillSheet()">取消</button>';
    html += '<button type="button" class="btn-primary" id="timer-backfill-confirm-btn">' + escapeHtml(options.confirmText || '确认') + '</button>';
    html += '</div></div></div>';

    document.body.insertAdjacentHTML('beforeend', html);

    var input = document.getElementById('timer-backfill-time-input');
    var confirmButton = document.getElementById('timer-backfill-confirm-btn');
    if (input) {
      input.focus();
      input.addEventListener('input', clearTimerBackfillError);
      input.addEventListener('change', clearTimerBackfillError);
    }
    if (confirmButton) {
      confirmButton.onclick = function () {
        confirmStandaloneStart(options.onConfirm);
      };
    }
  }

  function confirmStandaloneStart(onConfirm) {
    var input = document.getElementById('timer-backfill-time-input');
    if (!input) return;

    var timeValue = String(input.value || '').trim();
    if (!timeValue) {
      setTimerBackfillError('请选择开始时间');
      return;
    }

    var startMs = parseChinaTodayTimeToMs(timeValue);
    if (startMs == null) {
      setTimerBackfillError('开始时间无效，请重新选择');
      return;
    }

    if (startMs >= Date.now()) {
      setTimerBackfillError('开始时间必须早于当前时间');
      return;
    }

    var result = typeof onConfirm === 'function' ? onConfirm(startMs, timeValue) : true;
    if (result === false) return;

    closeTimerBackfillSheet();
  }

  function closeTimerBackfillSheet() {
    var overlay = document.querySelector('.modal-overlay.' + BACKFILL_OVERLAY_CLASS);
    if (overlay) overlay.remove();
  }

  function clearTimerBackfillError() {
    var errorEl = document.getElementById('timer-backfill-error');
    if (errorEl) errorEl.textContent = '';
  }

  function setTimerBackfillError(message) {
    var errorEl = document.getElementById('timer-backfill-error');
    if (errorEl) errorEl.textContent = message;
  }

  function refreshTimerRunningState(type, active) {
    if (type === 'pump' && baseUIToday.refreshPumpRunningState) {
      baseUIToday.refreshPumpRunningState(active);
      return;
    }
    if (type === 'sleep' && baseUIToday.refreshSleepRunningState) {
      baseUIToday.refreshSleepRunningState(active);
      return;
    }
    if (type === 'milk_direct' && baseUIToday.refreshDirectRunningState) {
      baseUIToday.refreshDirectRunningState(active);
    }
  }

  function getTimerLabel(type) {
    var eventType = EVENT_TYPES[type];
    return eventType ? eventType.label : '计时';
  }

  function getOverlaySelector(type) {
    return type === 'sleep'
      ? '.modal-overlay.sleep-running-overlay'
      : '.modal-overlay.pump-running-overlay';
  }

  function getPauseButtonSelector(type) {
    return type === 'sleep' ? '#sleep-running-pause-btn' : '#pump-running-pause-btn';
  }

  function getBackfillButtonId(type) {
    return 'timer-backfill-open-btn-' + type;
  }

  function formatChinaTime(input) {
    return new Date(input || Date.now()).toLocaleTimeString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function parseChinaTodayTimeToMs(timeValue) {
    var match = /^(\d{2}):(\d{2})$/.exec(String(timeValue || ''));
    if (!match) return null;

    var hours = Number(match[1]);
    var minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) return null;

    var today = TimeUtil.toChinaDateParts(Date.now());
    return Date.UTC(today.year, today.month - 1, today.day, hours - 8, minutes, 0, 0);
  }

  function escapeAttr(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  var next = {};
  Object.keys(baseUIToday).forEach(function (key) {
    next[key] = baseUIToday[key];
  });
  next.openRecord = openRecord;
  next.openPumpRunningSheet = openPumpRunningSheet;
  next.openSleepRunningSheet = openSleepRunningSheet;
  next.closePumpRunningSheet = closePumpRunningSheet;
  next.closeSleepRunningSheet = closeSleepRunningSheet;
  next.stopPumpFromSheet = stopPumpFromSheet;
  next.stopSleepFromSheet = stopSleepFromSheet;
  next.startDirectTimer = startDirectTimer;
  next.openDirectPresetStartSheet = openDirectPresetStartSheet;
  next.openTimerBackfillSheet = openTimerBackfillSheet;
  next.closeTimerBackfillSheet = closeTimerBackfillSheet;
  return next;
})(UIToday);
