var UIToday = (function (baseUIToday) {
  if (!baseUIToday) return baseUIToday;

  var pumpSheetUnsub = null;
  var sleepSheetUnsub = null;
  var directSheetUnsub = null;

  function openRecord(type) {
    if (type === 'pump') return ensureTimerStarted('pump', '吸奶', openPumpRunningSheet);
    if (type === 'sleep') return ensureTimerStarted('sleep', '睡眠', openSleepRunningSheet);
    if (type === 'milk_direct') return openDirectTimer();
    return baseUIToday.openRecord(type);
  }

  function openTimerDetail(type) {
    if (type === 'pump') return openPumpRunningSheet();
    if (type === 'sleep') return openSleepRunningSheet();
    if (type === 'milk_direct') return openDirectTimer();
    return baseUIToday.openTimerDetail(type);
  }

  function ensureTimerStarted(type, label, openSheetFn) {
    return ensureCurrentBabyId().then(function (babyId) {
      if (!babyId) {
        App.toast('请先添加或选择宝宝');
        App.navigate('settings');
        App.renderPage();
        return;
      }

      var active = Timer.getActive(type);
      if (!active) {
        var ok = Timer.start(type, babyId);
        if (!ok) {
          App.toast(label + '计时启动失败');
          return;
        }
        App.toast(label + '计时已开始');
        App.renderPage();
      }

      openSheetFn();
    });
  }

  function ensureCurrentBabyId() {
    return DB.getMeta('currentBabyId').then(function (babyId) {
      if (babyId) return babyId;
      return DB.getBabies().then(function (babies) {
        var firstBaby = (babies || [])[0] || null;
        if (!firstBaby || !firstBaby.id) return null;
        return DB.setMeta('currentBabyId', firstBaby.id).then(function () {
          return firstBaby.id;
        });
      });
    });
  }

  function renderSimpleRunningSheet(options) {
    var html = '';
    html += '<div class="modal-overlay ' + options.overlayClass + '" onclick="if(event.target===this)UIToday.' + options.closeMethod + '()">';
    html += '<div class="modal-sheet">';
    html += '<div class="modal-handle"></div>';
    html += '<div class="modal-title">' + options.title + '</div>';
    html += '<div class="welcome-desc" id="' + options.descId + '" style="margin-bottom:10px">正在记录本次时长</div>';
    html += '<div style="font-size:2.1rem;font-weight:800;line-height:1.1;text-align:center;margin:8px 0 16px" id="' + options.timeId + '">00:00</div>';
    html += '<div style="display:flex;flex-direction:column;gap:8px">';
    html += '<button class="btn-secondary" id="' + options.pauseId + '" onclick="UIToday.' + options.pauseMethod + '()">暂停计时</button>';
    html += '<button class="btn-danger" onclick="UIToday.' + options.stopMethod + '()">结束并记录</button>';
    html += '<button class="btn-secondary" onclick="UIToday.' + options.closeMethod + '()">先收起</button>';
    html += '</div></div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
  }

  function openPumpRunningSheet() {
    closePumpRunningSheet();
    renderSimpleRunningSheet({
      overlayClass: 'pump-running-overlay',
      title: '🍼 吸奶进行中',
      descId: 'pump-running-sub',
      timeId: 'pump-running-time',
      pauseId: 'pump-running-pause-btn',
      pauseMethod: 'togglePumpRunningPause',
      stopMethod: 'stopPumpFromSheet',
      closeMethod: 'closePumpRunningSheet'
    });
    bindPumpRunningState();
  }

  function openSleepRunningSheet() {
    closeSleepRunningSheet();
    renderSimpleRunningSheet({
      overlayClass: 'sleep-running-overlay',
      title: '😴 睡眠进行中',
      descId: 'sleep-running-sub',
      timeId: 'sleep-running-time',
      pauseId: 'sleep-running-pause-btn',
      pauseMethod: 'toggleSleepRunningPause',
      stopMethod: 'stopSleepFromSheet',
      closeMethod: 'closeSleepRunningSheet'
    });
    bindSleepRunningState();
  }

  function openDirectTimer() {
    return ensureCurrentBabyId().then(function (babyId) {
      if (!babyId) {
        App.toast('请先添加或选择宝宝');
        App.navigate('settings');
        App.renderPage();
        return;
      }

      var active = Timer.getActive('milk_direct');
      if (active) {
        openDirectRunningSheet();
        return;
      }

      openDirectStartSheet();
    });
  }

  function openDirectStartSheet() {
    closeDirectStartSheet();

    var html = '';
    html += '<div class="modal-overlay direct-start-overlay" onclick="if(event.target===this)UIToday.closeDirectStartSheet()">';
    html += '<div class="modal-sheet">';
    html += '<div class="modal-handle"></div>';
    html += '<div class="modal-title">🤱 母乳亲喂</div>';
    html += '<div class="welcome-desc" style="margin-bottom:12px">开始前先选择本次从哪一侧开始。</div>';
    html += '<div class="breast-side-picker direct-page-side-picker">';
    html += '<button class="side-picker-btn active" id="direct-start-side-left" onclick="UIToday.selectStartSide(\'left\', this)">左侧开始</button>';
    html += '<button class="side-picker-btn" id="direct-start-side-right" onclick="UIToday.selectStartSide(\'right\', this)">右侧开始</button>';
    html += '</div>';
    html += '<input type="hidden" id="direct-start-side" value="left">';
    html += '<div style="display:flex;flex-direction:column;gap:8px;margin-top:14px">';
    html += '<button class="btn-primary" onclick="UIToday.startDirectTimer()">现在开始</button>';
    html += '<button class="btn-secondary" onclick="UIToday.openDirectPresetStartSheet()">从过去开始</button>';
    html += '<button class="btn-secondary" onclick="UIToday.openDirectManualEntry()">手动补录</button>';
    html += '<button class="btn-secondary" onclick="UIToday.closeDirectStartSheet()">先收起</button>';
    html += '</div></div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
  }

  function closeDirectStartSheet() {
    removeOverlay('.modal-overlay.direct-start-overlay');
  }

  function openDirectRunningSheet() {
    closeDirectRunningSheet();

    var html = '';
    html += '<div class="modal-overlay direct-running-overlay" onclick="if(event.target===this)UIToday.closeDirectRunningSheet()">';
    html += '<div class="modal-sheet">';
    html += '<div class="modal-handle"></div>';
    html += '<div class="modal-title">🤱 亲喂进行中</div>';
    html += '<div class="welcome-desc" id="direct-running-sub" style="margin-bottom:10px">正在记录本次亲喂时长</div>';
    html += '<div style="font-size:2.1rem;font-weight:800;line-height:1.1;text-align:center;margin:8px 0 16px" id="direct-running-time">00:00</div>';
    html += '<div class="direct-sides" style="margin-bottom:12px">';
    html += '<div class="direct-side"><div class="side-name">左侧</div><div class="side-val" id="direct-running-left">00:00</div></div>';
    html += '<div class="direct-side"><div class="side-name">右侧</div><div class="side-val" id="direct-running-right">00:00</div></div>';
    html += '</div>';
    html += '<div class="welcome-desc" id="direct-running-current-side" style="margin-bottom:12px;text-align:center">当前：左侧</div>';
    html += '<div style="display:flex;flex-direction:column;gap:8px">';
    html += '<button class="btn-secondary" onclick="UIToday.openTimerBackfillSheet(\'milk_direct\')">改为从过去开始</button>';
    html += '<button class="btn-secondary" onclick="UIToday.switchBreastSideFromSheet()">切到另一侧</button>';
    html += '<button class="btn-secondary" id="direct-running-pause-btn" onclick="UIToday.toggleDirectRunningPause()">暂停计时</button>';
    html += '<button class="btn-danger" onclick="UIToday.stopDirectFromSheet()">结束并记录</button>';
    html += '<button class="btn-secondary" onclick="UIToday.closeDirectRunningSheet()">先收起</button>';
    html += '</div></div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
    bindDirectRunningState();
  }

  function bindPumpRunningState() {
    if (pumpSheetUnsub) {
      pumpSheetUnsub();
      pumpSheetUnsub = null;
    }

    function render() {
      if (!document.querySelector('.modal-overlay.pump-running-overlay')) {
        clearPumpRunningBind();
        return;
      }

      var state = Timer.getActive('pump');
      if (!state) {
        closePumpRunningSheet();
        return;
      }
      refreshPumpRunningState(state);
    }

    pumpSheetUnsub = Timer.onTick(render);
    render();
  }

  function bindSleepRunningState() {
    if (sleepSheetUnsub) {
      sleepSheetUnsub();
      sleepSheetUnsub = null;
    }

    function render() {
      if (!document.querySelector('.modal-overlay.sleep-running-overlay')) {
        clearSleepRunningBind();
        return;
      }

      var state = Timer.getActive('sleep');
      if (!state) {
        closeSleepRunningSheet();
        return;
      }
      refreshSleepRunningState(state);
    }

    sleepSheetUnsub = Timer.onTick(render);
    render();
  }

  function bindDirectRunningState() {
    if (directSheetUnsub) {
      directSheetUnsub();
      directSheetUnsub = null;
    }

    function render() {
      if (!document.querySelector('.modal-overlay.direct-running-overlay')) {
        clearDirectRunningBind();
        return;
      }

      var state = Timer.getActive('milk_direct');
      if (!state) {
        closeDirectRunningSheet();
        return;
      }
      refreshDirectRunningState(state);
    }

    directSheetUnsub = Timer.onTick(render);
    render();
  }

  function refreshPumpRunningState(active) {
    refreshSimpleRunningState({
      state: active || Timer.getActive('pump'),
      timeId: 'pump-running-time',
      descId: 'pump-running-sub',
      pauseId: 'pump-running-pause-btn',
      runningText: '正在记录本次吸奶时长',
      pausedText: '当前已暂停，可以继续本次吸奶'
    });
  }

  function refreshSleepRunningState(active) {
    refreshSimpleRunningState({
      state: active || Timer.getActive('sleep'),
      timeId: 'sleep-running-time',
      descId: 'sleep-running-sub',
      pauseId: 'sleep-running-pause-btn',
      runningText: '正在记录本次睡眠时长',
      pausedText: '当前已暂停，可以继续本次睡眠'
    });
  }

  function refreshSimpleRunningState(options) {
    var state = options.state;
    if (!state) return;

    var timeEl = document.getElementById(options.timeId);
    var descEl = document.getElementById(options.descId);
    var pauseBtn = document.getElementById(options.pauseId);

    if (timeEl) timeEl.textContent = Timer.formatElapsed(state.elapsed || 0);
    if (descEl) descEl.textContent = state.isPaused ? options.pausedText : options.runningText;
    if (pauseBtn) pauseBtn.textContent = state.isPaused ? '继续计时' : '暂停计时';
  }

  function refreshDirectRunningState(active) {
    var state = active || Timer.getActive('milk_direct');
    if (!state) return;

    var timeEl = document.getElementById('direct-running-time');
    var subEl = document.getElementById('direct-running-sub');
    var currentSideEl = document.getElementById('direct-running-current-side');
    var leftEl = document.getElementById('direct-running-left');
    var rightEl = document.getElementById('direct-running-right');
    var pauseBtn = document.getElementById('direct-running-pause-btn');

    if (timeEl) timeEl.textContent = Timer.formatElapsedSeconds(state.totalSec || 0);
    if (subEl) subEl.textContent = state.isPaused ? '当前已暂停，可以继续本次亲喂' : '正在记录本次亲喂时长';
    if (currentSideEl) currentSideEl.textContent = '当前：' + (state.currentSide === 'right' ? '右侧' : '左侧');
    if (leftEl) leftEl.textContent = Calc.formatSeconds(state.leftSec || 0);
    if (rightEl) rightEl.textContent = Calc.formatSeconds(state.rightSec || 0);
    if (pauseBtn) pauseBtn.textContent = state.isPaused ? '继续计时' : '暂停计时';
  }

  function closePumpRunningSheet() {
    clearPumpRunningBind();
    removeOverlay('.modal-overlay.pump-running-overlay');
  }

  function closeSleepRunningSheet() {
    clearSleepRunningBind();
    removeOverlay('.modal-overlay.sleep-running-overlay');
  }

  function closeDirectRunningSheet() {
    clearDirectRunningBind();
    removeOverlay('.modal-overlay.direct-running-overlay');
  }

  function clearPumpRunningBind() {
    if (pumpSheetUnsub) {
      pumpSheetUnsub();
      pumpSheetUnsub = null;
    }
  }

  function clearSleepRunningBind() {
    if (sleepSheetUnsub) {
      sleepSheetUnsub();
      sleepSheetUnsub = null;
    }
  }

  function clearDirectRunningBind() {
    if (directSheetUnsub) {
      directSheetUnsub();
      directSheetUnsub = null;
    }
  }

  function toggleSimpleRunningPause(type, closeFn, bindFn, label) {
    var state = Timer.getActive(type);
    if (!state) {
      closeFn();
      return;
    }

    if (state.isPaused) {
      Timer.resume(type);
      App.toast('已继续' + label + '计时');
    } else {
      Timer.pause(type);
      App.toast('已暂停' + label + '计时');
    }
    bindFn();
  }

  function togglePumpRunningPause() {
    toggleSimpleRunningPause('pump', closePumpRunningSheet, bindPumpRunningState, '吸奶');
  }

  function toggleSleepRunningPause() {
    toggleSimpleRunningPause('sleep', closeSleepRunningSheet, bindSleepRunningState, '睡眠');
  }

  function toggleDirectRunningPause() {
    toggleSimpleRunningPause('milk_direct', closeDirectRunningSheet, bindDirectRunningState, '亲喂');
  }

  function stopPumpFromSheet() {
    closePumpRunningSheet();
    baseUIToday.stopTimer('pump');
  }

  function stopSleepFromSheet() {
    closeSleepRunningSheet();
    baseUIToday.stopTimer('sleep');
  }

  function stopDirectFromSheet() {
    closeDirectRunningSheet();
    baseUIToday.stopTimer('milk_direct');
  }

  function switchBreastSideFromSheet() {
    var state = Timer.switchBreastSide();
    if (!state) {
      closeDirectRunningSheet();
      return;
    }
    App.toast('已切到' + (state.currentSide === 'right' ? '右侧' : '左侧'));
    App.renderPage();
    bindDirectRunningState();
  }

  function startDirectTimer(startMs) {
    return ensureCurrentBabyId().then(function (babyId) {
      if (!babyId) {
        App.toast('请先添加或选择宝宝');
        return;
      }

      var sideInput = document.getElementById('direct-start-side');
      var side = sideInput ? (sideInput.value || 'left') : 'left';
      var ok = Timer.start('milk_direct', babyId, { side: side });
      if (!ok) {
        App.toast('亲喂计时已在进行中');
        openDirectRunningSheet();
        return;
      }

      if (typeof startMs === 'number' && isFinite(startMs) && startMs < Date.now()) {
        Timer.adjustStartTime('milk_direct', startMs);
        App.toast('已按 ' + formatTimeForToast(startMs) + ' 作为开始时间');
      } else {
        App.toast('亲喂计时已开始');
      }

      closeDirectStartSheet();
      App.renderPage();
      setTimeout(openDirectRunningSheet, 0);
    });
  }

  function selectStartSide(side, btn) {
    var input = document.getElementById('direct-start-side');
    if (input) input.value = side;

    var buttons = document.querySelectorAll('.side-picker-btn');
    Array.prototype.forEach.call(buttons, function (button) {
      button.classList.remove('active');
    });
    if (btn) btn.classList.add('active');
  }

  function formatTimeForToast(ms) {
    return new Date(ms).toLocaleTimeString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function removeOverlay(selector) {
    var overlay = document.querySelector(selector);
    if (overlay) overlay.remove();
  }

  var next = {};
  Object.keys(baseUIToday).forEach(function (key) {
    next[key] = baseUIToday[key];
  });
  next.openRecord = openRecord;
  next.openTimerDetail = openTimerDetail;
  next.openPumpRunningSheet = openPumpRunningSheet;
  next.closePumpRunningSheet = closePumpRunningSheet;
  next.togglePumpRunningPause = togglePumpRunningPause;
  next.stopPumpFromSheet = stopPumpFromSheet;
  next.refreshPumpRunningState = refreshPumpRunningState;
  next.openSleepRunningSheet = openSleepRunningSheet;
  next.closeSleepRunningSheet = closeSleepRunningSheet;
  next.toggleSleepRunningPause = toggleSleepRunningPause;
  next.stopSleepFromSheet = stopSleepFromSheet;
  next.refreshSleepRunningState = refreshSleepRunningState;
  next.openDirectTimer = openDirectTimer;
  next.openDirectStartSheet = openDirectStartSheet;
  next.closeDirectStartSheet = closeDirectStartSheet;
  next.openDirectRunningSheet = openDirectRunningSheet;
  next.closeDirectRunningSheet = closeDirectRunningSheet;
  next.toggleDirectRunningPause = toggleDirectRunningPause;
  next.stopDirectFromSheet = stopDirectFromSheet;
  next.switchBreastSideFromSheet = switchBreastSideFromSheet;
  next.refreshDirectRunningState = refreshDirectRunningState;
  next.startDirectTimer = startDirectTimer;
  next.selectStartSide = selectStartSide;
  return next;
})(UIToday);
