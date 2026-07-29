var UIToday = (function (BaseUIToday) {
  var pumpSheetUnsub = null;

  function openRecord(type) {
    if (type === 'pump') {
      ensureCurrentBabyId().then(function (babyId) {
        if (!babyId) {
          App.toast('请先添加或选择宝宝');
          App.navigate('settings');
          App.renderPage();
          return;
        }

        var active = Timer.getActive('pump');
        if (!active || active.babyId !== babyId) {
          var ok = Timer.start('pump', babyId);
          if (!ok) {
            active = Timer.getActive('pump');
          } else {
            App.toast('吸奶计时已开始');
            App.renderPage();
            active = Timer.getActive('pump');
          }
        }

        if (!active) {
          App.toast('吸奶计时启动失败');
          return;
        }

        openPumpRunningSheet();
      });
      return;
    }

    if (type === 'sleep') {
      ensureCurrentBabyId().then(function (babyId) {
        if (!babyId) {
          App.toast('请先添加或选择宝宝');
          App.navigate('settings');
          App.renderPage();
          return;
        }
        var ok = Timer.start('sleep', babyId);
        if (!ok) {
          App.toast('该计时已在进行中');
          return;
        }
        App.toast('睡眠计时已开始');
        App.renderPage();
      });
      return;
    }

    return BaseUIToday.openRecord(type);
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

  function openPumpRunningSheet() {
    closePumpRunningSheet();
    var html = '<div class="modal-overlay pump-running-overlay" onclick="if(event.target===this)UIToday.closePumpRunningSheet()"><div class="modal-sheet">';
    html += '<div class="modal-handle"></div>';
    html += '<div class="modal-title">⏺ 吸奶进行中</div>';
    html += '<div class="welcome-desc" id="pump-running-sub" style="margin-bottom:10px">正在记录本次吸奶时长</div>';
    html += '<div style="font-size:2.1rem;font-weight:800;line-height:1.1;text-align:center;margin:8px 0 16px" id="pump-running-time">00:00</div>';
    html += '<div style="display:flex;flex-direction:column;gap:8px">';
    html += '<button class="btn-secondary" id="pump-running-pause-btn" onclick="UIToday.togglePumpRunningPause()">暂停</button>';
    html += '<button class="btn-danger" onclick="UIToday.stopPumpFromSheet()">结束并记录</button>';
    html += '<button class="btn-secondary" onclick="UIToday.closePumpRunningSheet()">先收起</button>';
    html += '</div></div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
    bindPumpRunningState();
  }

  function bindPumpRunningState() {
    if (pumpSheetUnsub) {
      pumpSheetUnsub();
      pumpSheetUnsub = null;
    }

    function renderPumpState() {
      var overlay = document.querySelector('.modal-overlay.pump-running-overlay');
      if (!overlay) {
        if (pumpSheetUnsub) {
          pumpSheetUnsub();
          pumpSheetUnsub = null;
        }
        return;
      }

      var state = Timer.getActive('pump');
      if (!state) {
        closePumpRunningSheet();
        return;
      }

      var timeEl = document.getElementById('pump-running-time');
      var subEl = document.getElementById('pump-running-sub');
      var pauseBtn = document.getElementById('pump-running-pause-btn');
      if (timeEl) timeEl.textContent = Timer.formatElapsed(state.elapsed || 0);
      if (subEl) subEl.textContent = state.isPaused ? '当前已暂停，可继续本次吸奶' : '正在记录本次吸奶时长';
      if (pauseBtn) pauseBtn.textContent = state.isPaused ? '继续' : '暂停';
    }

    pumpSheetUnsub = Timer.onTick(function () {
      renderPumpState();
    });
    renderPumpState();
  }

  function closePumpRunningSheet() {
    if (pumpSheetUnsub) {
      pumpSheetUnsub();
      pumpSheetUnsub = null;
    }
    var overlay = document.querySelector('.modal-overlay.pump-running-overlay');
    if (overlay) overlay.remove();
  }

  function togglePumpRunningPause() {
    var state = Timer.getActive('pump');
    if (!state) {
      closePumpRunningSheet();
      return;
    }
    if (state.isPaused) {
      Timer.resume('pump');
      App.toast('已继续吸奶计时');
    } else {
      Timer.pause('pump');
      App.toast('已暂停吸奶计时');
    }
    bindPumpRunningState();
  }

  function stopPumpFromSheet() {
    closePumpRunningSheet();
    BaseUIToday.stopTimer('pump');
  }

  var next = {};
  Object.keys(BaseUIToday).forEach(function (key) {
    next[key] = BaseUIToday[key];
  });
  next.openRecord = openRecord;
  next.openPumpRunningSheet = openPumpRunningSheet;
  next.closePumpRunningSheet = closePumpRunningSheet;
  next.togglePumpRunningPause = togglePumpRunningPause;
  next.stopPumpFromSheet = stopPumpFromSheet;
  return next;
})(UIToday);
