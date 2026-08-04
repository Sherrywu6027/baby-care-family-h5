var UIToday = (function () {
  var countdownTimer = null;
  var unsubsTimer = null;
  var directTimerUnsub = null;
  var syncLabel = '刚刚更新';

  function render(container) {
    DB.getMeta('currentBabyId').then(function (babyId) {
      if (!babyId) {
        App.showOnboarding();
        return;
      }
      renderWithBaby(container, babyId);
    });
  }

  function renderLoading(container) {
    container.innerHTML = ''
      + '<div class="today-header">'
      + '<div class="today-date">' + Calc.formatDateLabel() + '<span class="weekday">' + Calc.getWeekday() + '</span></div>'
      + '</div>'
      + '<div class="today-sync-pill" id="today-sync-pill">' + syncLabel + '</div>'
      + '<div class="today-skeleton-card"><div class="today-skeleton-line w-40"></div><div class="today-skeleton-line w-70"></div></div>'
      + '<div class="today-skeleton-grid"><div class="today-skeleton-box"></div><div class="today-skeleton-box"></div><div class="today-skeleton-box"></div></div>'
      + '<div class="today-skeleton-card"><div class="today-skeleton-line w-50"></div><div class="today-skeleton-line w-85"></div><div class="today-skeleton-line w-75"></div></div>';
  }

  function renderWithBaby(container, babyId) {
    DB.getBaby(babyId).then(function (baby) {
      DB.getMeta('homeButtons').then(function (buttons) {
        buttons = buttons || DEFAULT_HOME_BUTTONS;
        bindSyncStatus();

        var html = '';
        html += '<div class="today-header">';
        html += '<div class="today-date">' + Calc.formatDateLabel() + '<span class="weekday">' + Calc.getWeekday() + '</span></div>';
        html += '<button class="baby-switch" onclick="UIToday.showBabyPicker()">' + (baby && baby.avatar ? baby.avatar : '🍼') + ' ' + (baby && baby.name ? baby.name : '宝宝') + ' ▼</button>';
        html += '</div>';
        html += '<div class="today-sync-pill" id="today-sync-pill">' + syncLabel + '</div>';
        html += '<div id="active-timers-area"></div>';
        html += '<div class="summary-row" id="summary-row"></div>';
        html += '<div class="quick-grid" id="quick-grid"></div>';
        html += '<div class="section-title">最近记录 <span style="font-weight:400"><a href="#/log" style="color:var(--primary);text-decoration:none">全部 →</a></span></div>';
        html += '<div class="timeline" id="recent-timeline"></div>';
        container.innerHTML = html;

        renderQuickButtons(buttons);
        renderRecentTimeline(babyId);
        startSummary(babyId);
        startActiveTimers(babyId);
      });
    });
  }

  function bindSyncStatus() {
    if (bindSyncStatus.done) return;
    bindSyncStatus.done = true;
    window.addEventListener('baby-sync-state', function (event) {
      syncLabel = event && event.detail && event.detail.label ? event.detail.label : '刚刚更新';
      var pill = document.getElementById('today-sync-pill');
      if (pill) pill.textContent = syncLabel;
    });
  }

  function renderQuickButtons(buttons) {
    var grid = document.getElementById('quick-grid');
    if (!grid) return;
    var html = '';
    buttons.forEach(function (type) {
      var eventType = EVENT_TYPES[type];
      if (!eventType) return;
      html += '<button class="quick-btn" style="background:' + eventType.bg + ';color:' + eventType.color + '" onclick="UIToday.openRecord(\'' + type + '\')">';
      html += '<span class="qb-icon">' + eventType.icon + '</span><span class="qb-label">' + eventType.label + '</span></button>';
    });
    grid.innerHTML = html;
  }

  function renderRecentTimeline(babyId) {
    DB.getEventsByDay(babyId, TimeUtil.todayChinaDate()).then(function (events) {
      var el = document.getElementById('recent-timeline');
      if (!el) return;
      if (!events || events.length === 0) {
        el.innerHTML = '<div class="empty-state"><div class="es-icon">📝</div><div class="es-text">今天还没有记录</div></div>';
        return;
      }

      var html = '';
      events.slice(0, 5).forEach(function (event) {
        var eventType = EVENT_TYPES[event.type] || { icon: '•', label: event.type };
        html += '<div class="timeline-item">';
        html += '<div class="ti-time">' + Calc.formatTime(event.start_time) + '</div>';
        html += '<div class="ti-icon">' + eventType.icon + '</div>';
        html += '<div class="ti-text"><div class="ti-type">' + Calc.eventDescription(event) + '</div>';
        if (event.note) html += '<div class="ti-detail">备注：' + escapeHtml(event.note) + '</div>';
        html += '<div class="ti-detail">' + buildRecorderText(event) + '</div>';
        html += '</div></div>';
      });
      el.innerHTML = html;
    });
  }

  function buildRecorderText(event) {
    var name = event && event.recorded_by_name ? event.recorded_by_name : '历史记录';
    var timeSource = event && (event.created_at || event.updated_at || event.start_time);
    var time = timeSource ? TimeUtil.formatChinaDateTime(timeSource) : '未知时间';
    return '添加人：' + escapeHtml(name) + ' · 添加时间：' + time;
  }

  function startSummary(babyId) {
    Calc.calcToday(babyId).then(function (summary) {
      var el = document.getElementById('summary-row');
      if (!el) return;
      var html = '';
      html += summaryCard((summary.feedMl || 0) + 'ml', '已知奶量 · 喂奶 ' + (summary.feedCount || 0) + ' 次');
      html += summaryCard((summary.directCount || 0) + '次 / ' + Calc.formatSeconds(summary.directSec || 0), '亲喂');
      html += summaryCard((summary.diaperCount || 0) + '次 / 💩' + (Number(summary.diaperStoolAmount) || 0), '尿布 · 大便 ' + (summary.diaperStool || 0) + ' 次');
      el.innerHTML = html;
    });
  }

  function summaryCard(value, label) {
    return '<div class="summary-card"><div class="val">' + value + '</div><div class="lbl">' + label + '</div></div>';
  }

  function startActiveTimers(babyId) {
    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = null;
    if (unsubsTimer) {
      unsubsTimer();
      unsubsTimer = null;
    }

    function renderTimers(states) {
      var area = document.getElementById('active-timers-area');
      if (!area) return;

      states = (states || []).filter(function (state) {
        return state && state.babyId === babyId;
      });
      states = states.slice().sort(function (a, b) {
        return Timer.priorityOf(a.type) - Timer.priorityOf(b.type);
      });

      if (states.length === 0) {
        if (area.dataset.mode !== 'countdown') {
          area.innerHTML = '<div class="countdown-card placeholder" id="countdown-card"><div class="label">距离上次喝奶</div><div class="time" id="countdown-time">--</div><div class="sub" id="countdown-sub"></div></div>';
          area.dataset.mode = 'countdown';
          area.dataset.signature = '';
          startCountdown(babyId);
        }
        return;
      }

      var main = states[0];
      var others = states.slice(1);
      var signature = states.map(function (state) { return state.type; }).join('|');
      if (area.dataset.mode !== 'timers' || area.dataset.signature !== signature) {
        area.innerHTML = buildActiveTimersHtml(main, others);
        area.dataset.mode = 'timers';
        area.dataset.signature = signature;
      }
      updateActiveTimersContent(main, others);
    }

    unsubsTimer = Timer.onTick(renderTimers);
  }

  function buildActiveTimersHtml(main, others) {
    var eventType = EVENT_TYPES[main.type];
    var html = '<div class="active-main-card" id="active-main-card" style="background:' + eventType.bg + ';color:' + eventType.color + '">';

    if (main.type === 'milk_direct') {
      html += '<div class="active-main-top"><div><div class="label">🤱 进行中的亲喂</div><div class="sub" id="active-main-sub"></div></div><button class="mini-link-btn" onclick="UIToday.openDirectTimer()">回到计时</button></div>';
      html += '<div class="active-main-time" id="active-main-time"></div>';
      html += '<div class="direct-sides"><div class="direct-side"><div class="side-name">左侧</div><div class="side-val" id="active-main-left"></div></div><div class="direct-side"><div class="side-name">右侧</div><div class="side-val" id="active-main-right"></div></div></div>';
      html += '<div class="active-main-actions"><button class="btn-ghost-inline" id="active-main-pause-btn" onclick="UIToday.toggleTimerPause(\'milk_direct\')"></button><button class="btn-danger-inline" onclick="UIToday.stopTimer(\'milk_direct\')">结束本次</button></div>';
    } else {
      html += '<div class="active-main-top"><div><div class="label">' + eventType.icon + ' 进行中</div><div class="sub" id="active-main-sub"></div></div><button class="mini-link-btn" onclick="UIToday.openTimerDetail(\'' + main.type + '\')">查看详情</button></div>';
      html += '<div class="active-main-time" id="active-main-time"></div>';
      html += '<div class="active-main-actions"><button class="btn-ghost-inline" id="active-main-pause-btn" onclick="UIToday.toggleTimerPause(\'' + main.type + '\')"></button><button class="btn-danger-inline" onclick="UIToday.stopTimer(\'' + main.type + '\')">结束本次</button></div>';
    }
    html += '</div>';

    if (others.length > 0) {
      html += '<div class="active-mini-list">';
      others.forEach(function (state) {
        html += '<div class="active-mini-card">';
        html += '<button class="mini-timer-main" onclick="UIToday.openTimerDetail(\'' + state.type + '\')"><span id="mini-timer-state-' + state.type + '"></span><strong id="mini-timer-time-' + state.type + '"></strong></button>';
        html += '<button class="mini-timer-action" id="mini-timer-action-' + state.type + '" onclick="UIToday.toggleTimerPause(\'' + state.type + '\')"></button>';
        html += '</div>';
      });
      html += '</div>';
    }

    return html;
  }

  function updateActiveTimersContent(main, others) {
    var mainSub = document.getElementById('active-main-sub');
    var mainTime = document.getElementById('active-main-time');
    var mainPauseBtn = document.getElementById('active-main-pause-btn');

    if (main.type === 'milk_direct') {
      setNodeText(mainSub, main.isPaused ? '已暂停' : ('当前：' + (main.currentSide === 'right' ? '右侧' : '左侧')));
    } else {
      setNodeText(mainSub, main.isPaused ? '已暂停' : '');
    }

    setNodeText(
      mainTime,
      Timer.formatElapsedSeconds(main.type === 'milk_direct' ? (main.totalSec || 0) : (main.elapsedSec || 0))
    );
    setNodeText(mainPauseBtn, main.isPaused ? '继续' : '暂停');

    if (main.type === 'milk_direct') {
      setNodeText(document.getElementById('active-main-left'), Calc.formatSeconds(main.leftSec || 0));
      setNodeText(document.getElementById('active-main-right'), Calc.formatSeconds(main.rightSec || 0));
    }

    (others || []).forEach(function (state) {
      var eventType = EVENT_TYPES[state.type];
      setNodeText(
        document.getElementById('mini-timer-state-' + state.type),
        eventType.icon + ' ' + eventType.label + (state.isPaused ? '（已暂停）' : '进行中')
      );
      setNodeText(
        document.getElementById('mini-timer-time-' + state.type),
        Timer.formatElapsed(state.elapsed || state.totalMs)
      );
      setNodeText(
        document.getElementById('mini-timer-action-' + state.type),
        state.isPaused ? '继续' : '暂停'
      );
    });
  }

  function setNodeText(node, text) {
    if (!node) return;
    if (node.textContent !== text) node.textContent = text;
  }

  function startCountdown(babyId) {
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }

    function update() {
      Calc.timeSinceLastFeed(babyId).then(function (ms) {
        var card = document.getElementById('countdown-card');
        var time = document.getElementById('countdown-time');
        var sub = document.getElementById('countdown-sub');
        if (!card || !time || !sub) return;

        if (ms == null) {
          card.className = 'countdown-card placeholder';
          setNodeText(time, '--');
          setNodeText(sub, '还没有喝奶记录');
          return;
        }

        card.className = 'countdown-card';
        setNodeText(time, Calc.formatCountdown(ms));
        var min = Math.floor(ms / 60000);
        if (min < 60) {
          setNodeText(sub, min + ' 分钟前喝过');
        } else {
          setNodeText(sub, Math.floor(min / 60) + ' 小时 ' + (min % 60) + ' 分钟前');
        }
      });
    }

    update();
    countdownTimer = setInterval(update, 1000);
  }

  function showBabyPicker() {
    DB.getBabies().then(function (babies) {
      var html = '<div class="modal-overlay" onclick="if(event.target===this)UIToday.closeModal()"><div class="modal-sheet">';
      html += '<div class="modal-handle"></div><div class="modal-title">选择宝宝</div>';
      babies.forEach(function (baby) {
        html += '<div class="baby-card" onclick="UIToday.switchBaby(\'' + baby.id + '\')" style="cursor:pointer">';
        html += '<div class="baby-avatar">' + (baby.avatar || '🍼') + '</div>';
        html += '<div class="baby-info"><div class="bi-name">' + escapeHtml(baby.name || '宝宝') + '</div><div class="bi-birthday">' + escapeHtml(baby.birthday || '') + '</div></div></div>';
      });
      html += '<button class="btn-primary" style="margin-top:12px" onclick="UIToday.openAddBabyFlow()">管理宝宝</button>';
      html += '</div></div>';
      document.body.insertAdjacentHTML('beforeend', html);
    });
  }

  function switchBaby(id) {
    DB.setMeta('currentBabyId', id).then(function () {
      closeModal();
      App.renderPage();
    });
  }

  function openAddBabyFlow() {
    closeModal();
    if (window.UISettings && UISettings.addBaby) UISettings.addBaby();
  }

  function openRecord(type) {
    if (type === 'milk_direct') {
      openDirectTimer();
      return;
    }

    if (type === 'pump' || type === 'sleep') {
      DB.getMeta('currentBabyId').then(function (babyId) {
        var ok = Timer.start(type, babyId);
        if (!ok) App.toast('该计时已在进行中');
        else App.toast(EVENT_TYPES[type].label + '计时已开始');
      });
      return;
    }

    var eventType = EVENT_TYPES[type];
    var now = TimeUtil.toChinaDateParts(Date.now());
    var timeStr = getCurrentChinaTimeValue();
    var dateStr = now.dateKey;
    if (type === 'weight') {
      openWeightRecordSheet(eventType, dateStr);
      return;
    }

    var html = '<div class="modal-overlay" onclick="if(event.target===this)UIToday.closeModal()"><div class="modal-sheet">';
    html += '<div class="modal-handle"></div><div class="modal-title">' + eventType.icon + ' ' + eventType.label + '</div>';

    if (type === 'weight') {
      html += '<div class="form-group"><label class="form-label">日期</label><input type="date" class="form-input" id="rec-date" value="' + dateStr + '"></div>';
    } else {
      html += '<div class="form-row"><div class="form-group"><label class="form-label">日期</label><input type="date" class="form-input" id="rec-date" value="' + dateStr + '"></div><div class="form-group"><label class="form-label">时间</label><input type="time" class="form-input" id="rec-time" value="' + timeStr + '"></div></div>';
    }

    if (type === 'formula' || type === 'milk_bottle') {
      html += '<div class="form-group"><label class="form-label">容量（ml）</label><input type="number" class="form-input" id="rec-amount" placeholder="如：140" inputmode="numeric"></div>';
    }

    if (type === 'diaper') {
      html += '<div class="form-group"><label class="form-label">大便量（直接点图标，可留空）</label><div class="stool-scale">';
      for (var i = 1; i <= 5; i++) {
        html += '<button type="button" class="stool-icon-btn" data-value="' + i + '" onclick="UIToday.setStoolAmount(' + i + ')">💩</button>';
      }
      html += '</div><input type="hidden" id="rec-stool-amount" value="0"></div>';
    }

    if (type === 'weight') {
      html += '<div class="form-group"><label class="form-label">身高（cm，可选）</label><input type="number" step="0.1" class="form-input" id="rec-height" placeholder="如：61.5" inputmode="decimal" oninput="UIToday.refreshGrowthReference()"></div>';
      html += '<div class="form-group"><label class="form-label">体重（kg，可选）</label><input type="number" step="0.01" class="form-input" id="rec-weight" placeholder="如：5.80" inputmode="decimal" oninput="UIToday.refreshGrowthReference()"></div>';
      html += '<div class="weight-ref-card" id="weight-ref-card">会根据宝宝月龄显示中国婴幼儿身高和体重参考；本记录只保存日期。</div>';
    }

    html += '<div class="form-group"><label class="form-label">备注（可选）</label><input type="text" class="form-input" id="rec-note" placeholder="如：夜奶、配方调整"></div>';
    html += '<button class="btn-primary" onclick="UIToday.saveRecord(\'' + type + '\')">保存</button>';
    html += '</div></div>';
    document.body.insertAdjacentHTML('beforeend', html);

    if (type === 'weight') renderWeightReference();
  }

  function openWeightRecordSheet(eventType, dateStr) {
    var html = '<div class="modal-overlay" onclick="if(event.target===this)UIToday.dismissRecordModal()"><div class="modal-sheet growth-entry-sheet">';
    html += '<div class="modal-handle"></div>';
    html += '<div class="modal-title-row"><div class="modal-title">' + eventType.icon + ' ' + eventType.label + '</div><button type="button" class="modal-close-btn" aria-label="关闭" onclick="UIToday.dismissRecordModal()">&times;</button></div>';
    html += '<div class="sheet-caption">只记录日期，身高和体重至少填一项即可。</div>';
    html += '<div class="form-group"><label class="form-label">日期</label><input type="date" class="form-input" id="rec-date" value="' + dateStr + '"></div>';
    html += '<div class="growth-form-row"><div class="form-group"><label class="form-label">身高（cm）</label><input type="number" step="0.1" class="form-input" id="rec-height" placeholder="如 61.5" inputmode="decimal" oninput="UIToday.refreshGrowthReference()"></div><div class="form-group"><label class="form-label">体重（kg）</label><input type="number" step="0.01" class="form-input" id="rec-weight" placeholder="如 5.80" inputmode="decimal" oninput="UIToday.refreshGrowthReference()"></div></div>';
    html += '<div class="weight-ref-card compact" id="weight-ref-card">会根据宝宝月龄显示中国婴幼儿身高和体重参考；本记录只保存日期。</div>';
    html += '<button type="button" class="note-toggle-btn" onclick="UIToday.toggleWeightNoteField()">补充备注</button>';
    html += '<div class="weight-note-wrap" id="weight-note-wrap" hidden><div class="form-group" style="margin-bottom:0"><label class="form-label">备注</label><input type="text" class="form-input" id="rec-note" placeholder="如：体检、居家称重"></div></div>';
    html += '<div class="sheet-actions sticky-sheet-actions"><button type="button" class="btn-secondary" onclick="UIToday.dismissRecordModal()">取消</button><button type="button" class="btn-primary" onclick="UIToday.saveRecord(\'weight\')">保存</button></div>';
    html += '</div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
    renderWeightReference();
  }

  function toggleWeightNoteField() {
    var wrap = document.getElementById('weight-note-wrap');
    if (!wrap) return;
    var isHidden = wrap.hasAttribute('hidden');
    if (isHidden) {
      wrap.removeAttribute('hidden');
      var noteInput = document.getElementById('rec-note');
      if (noteInput) noteInput.focus();
      return;
    }
    wrap.setAttribute('hidden', 'hidden');
  }

  function dismissRecordModal() {
    if (window.UnsavedModalGuard && typeof window.UnsavedModalGuard.confirmDiscardCurrentModal === 'function') {
      window.UnsavedModalGuard.confirmDiscardCurrentModal();
      return;
    }
    closeModal();
  }

  function openDirectTimer() {
    location.hash = '#/direct-timer';
  }

  function renderDirectTimerPage(container) {
    cleanupTransientViews();
    DB.getMeta('currentBabyId').then(function (babyId) {
      if (!babyId) {
        App.showOnboarding();
        return;
      }
      return DB.getBaby(babyId).then(function (baby) {
        var active = Timer.getActive('milk_direct');
        if (active && active.babyId !== babyId) active = null;
        container.innerHTML = buildDirectTimerPageHtml(baby, active);
        if (active) bindDirectTimerLiveState(babyId);
      });
    });
  }

  function buildDirectTimerPageHtml(baby, active) {
    var html = '';
    html += '<div class="direct-page">';
    html += '<div class="direct-page-top"><button class="page-back-btn" onclick="App.navigate(\'today\')">← 返回今日</button><button class="page-link-btn" onclick="UIToday.openDirectManualEntry()">手动补录</button></div>';
    html += '<div class="direct-page-hero">';
    html += '<div class="direct-page-kicker">🤱 母乳亲喂</div>';
    html += '<h2>' + escapeHtml((baby && baby.name ? baby.name : '宝宝') + ' 的亲喂记录') + '</h2>';
    html += '<p>先选开始侧，喂到一半随手切边，结束后自动保存左右侧时长。</p>';
    html += '</div>';

    if (!active) {
      html += '<div class="direct-page-card">';
      html += '<div class="direct-page-title">开始前先选一侧</div>';
      html += '<div class="breast-side-picker direct-page-side-picker"><button class="side-picker-btn active" id="start-side-left" onclick="UIToday.selectStartSide(\'left\', this)">左侧开始</button><button class="side-picker-btn" id="start-side-right" onclick="UIToday.selectStartSide(\'right\', this)">右侧开始</button></div>';
      html += '<input type="hidden" id="direct-start-side" value="left">';
      html += '<button class="btn-primary" onclick="UIToday.startDirectTimer()">开始计时</button>';
      html += '<div class="direct-page-tip">另一侧可以为 0；结束时会自动生成左右侧明细。</div>';
      html += '</div>';
    } else {
      html += '<div class="direct-page-card direct-page-running">';
      html += '<div class="direct-running-header"><div><div class="direct-page-title">正在亲喂</div><div class="direct-running-sub" id="direct-current-side">当前：' + (active.currentSide === 'right' ? '右侧' : '左侧') + '</div></div><div class="direct-live-dot"></div></div>';
      html += '<div class="direct-page-total" id="direct-total-elapsed">' + Timer.formatElapsedSeconds(active.totalSec || 0) + '</div>';
      html += '<div class="direct-sides direct-page-sides"><div class="direct-side"><div class="side-name">左侧</div><div class="side-val" id="direct-left-value">' + Calc.formatSeconds(active.leftSec || 0) + '</div></div><div class="direct-side"><div class="side-name">右侧</div><div class="side-val" id="direct-right-value">' + Calc.formatSeconds(active.rightSec || 0) + '</div></div></div>';
      html += '<button class="btn-secondary" type="button" onclick="UIToday.openTimerBackfillSheet(\'milk_direct\')" style="width:100%;margin-top:12px">改为从过去开始</button>';
      html += '<div class="active-main-actions direct-page-actions"><button class="btn-ghost-inline" onclick="UIToday.switchBreastSide(false)">切到另一侧</button><button class="btn-danger-inline" onclick="UIToday.stopTimer(\'milk_direct\')">结束并保存</button></div>';
      html += '<button class="btn-text-inline" onclick="UIToday.cancelDirectTimer()">放弃本次</button>';
      html += '<div class="direct-page-tip">结束后会自动保存本次亲喂；记录页里还能再改单侧时长。</div>';
      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  function bindDirectTimerLiveState(babyId) {
    if (directTimerUnsub) directTimerUnsub();
    directTimerUnsub = Timer.onTick(function (states) {
      var currentRoute = location.hash.slice(2) || 'today';
      if (currentRoute !== 'direct-timer') return;
      var state = (states || []).filter(function (item) {
        return item && item.type === 'milk_direct' && item.babyId === babyId;
      })[0];
      if (!state) {
        App.renderPage();
        return;
      }
      setNodeText(document.getElementById('direct-total-elapsed'), Timer.formatElapsedSeconds(state.totalSec || 0));
      setNodeText(document.getElementById('direct-left-value'), Calc.formatSeconds(state.leftSec || 0));
      setNodeText(document.getElementById('direct-right-value'), Calc.formatSeconds(state.rightSec || 0));
      setNodeText(document.getElementById('direct-current-side'), '当前：' + (state.currentSide === 'right' ? '右侧' : '左侧'));
    });
  }

  function cleanupTransientViews() {
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
    if (unsubsTimer) {
      unsubsTimer();
      unsubsTimer = null;
    }
    if (directTimerUnsub) {
      directTimerUnsub();
      directTimerUnsub = null;
    }
    closeModal();
  }

  function selectStartSide(side, btn) {
    document.getElementById('direct-start-side').value = side;
    var buttons = document.querySelectorAll('.side-picker-btn');
    buttons.forEach(function (button) {
      button.classList.remove('active');
    });
    if (btn) btn.classList.add('active');
  }

  function startDirectTimer() {
    DB.getMeta('currentBabyId').then(function (babyId) {
      var sideInput = document.getElementById('direct-start-side');
      var side = sideInput ? (sideInput.value || 'left') : 'left';
      var ok = Timer.start('milk_direct', babyId, { side: side });
      if (ok) {
        App.toast('母乳亲喂已开始');
        App.renderPage();
      } else {
        App.toast('亲喂计时已在进行中');
      }
    });
  }

  function openDirectRunningModal(state) {
    state = state || Timer.getActive('milk_direct');
    if (!state) return;
    openDirectTimer();
  }

  function openDirectManualEntry(existing) {
    existing = existing || null;
    closeModal();

    var left = existing ? (existing.left_min || 0) : 0;
    var right = existing ? (existing.right_min || 0) : 0;
    var total = left + right;
    var now = TimeUtil.toChinaDateParts(Date.now());
    var timeStr = getCurrentChinaTimeValue();
    var dateStr = now.dateKey;

    var html = '<div class="modal-overlay" onclick="if(event.target===this)UIToday.closeModal()"><div class="modal-sheet">';
    html += '<div class="modal-handle"></div><div class="modal-title">🤱 手动补录亲喂</div>';
    html += '<div class="form-row"><div class="form-group"><label class="form-label">日期</label><input type="date" class="form-input" id="direct-date" value="' + dateStr + '"></div><div class="form-group"><label class="form-label">时间</label><input type="time" class="form-input" id="direct-time" value="' + timeStr + '"></div></div>';
    html += '<div class="form-row"><div class="form-group"><label class="form-label">左侧（分钟）</label><input type="number" class="form-input" id="direct-left" value="' + left + '" inputmode="numeric" oninput="UIToday.refreshDirectTotal()"></div><div class="form-group"><label class="form-label">右侧（分钟）</label><input type="number" class="form-input" id="direct-right" value="' + right + '" inputmode="numeric" oninput="UIToday.refreshDirectTotal()"></div></div>';
    html += '<div class="form-group"><label class="form-label">总时长（自动计算）</label><input type="text" class="form-input" id="direct-total" value="' + total + ' 分钟" disabled></div>';
    html += '<div class="form-group"><label class="form-label">备注（可选）</label><input type="text" class="form-input" id="direct-note" placeholder="如：夜奶"></div>';
    html += '<button class="btn-primary" onclick="UIToday.saveDirectManual()">保存</button>';
    html += '</div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
  }

  function refreshDirectTotal() {
    var left = parseInt(document.getElementById('direct-left').value, 10) || 0;
    var right = parseInt(document.getElementById('direct-right').value, 10) || 0;
    document.getElementById('direct-total').value = (left + right) + ' 分钟';
  }

  function saveDirectManual() {
    var left = parseInt(document.getElementById('direct-left').value, 10) || 0;
    var right = parseInt(document.getElementById('direct-right').value, 10) || 0;
    var total = left + right;
    if (total <= 0) {
      App.toast('至少填写一侧时长');
      return;
    }

    var totalSec = total * 60;
    var dateStr = document.getElementById('direct-date').value;
    var timeStr = document.getElementById('direct-time').value;
    var startDate = new Date(dateStr + 'T' + timeStr);
    var startISO = TimeUtil.makeLocalIsoFromChinaDateTime(dateStr, timeStr);
    var endISO = new Date(startDate.getTime() + totalSec * 1000).toISOString();
    var note = document.getElementById('direct-note').value;

    DB.getMeta('currentBabyId').then(function (babyId) {
      return DB.addEvent({
        type: 'milk_direct',
        baby_id: babyId,
        start_time: startISO,
        end_time: endISO,
        duration_sec: totalSec,
        duration_min: total,
        left_sec: left * 60,
        right_sec: right * 60,
        left_min: left,
        right_min: right,
        note: note || ''
      });
    }).then(function () {
      closeModal();
      if (App.requestSync) App.requestSync('direct-save');
      App.toast('已记录亲喂');
      if ((location.hash.slice(2) || 'today') === 'direct-timer') App.renderPage();
      else App.navigate('today');
    });
  }

  function saveRecord(type) {
    var dateStr = document.getElementById('rec-date').value;
    var timeInput = document.getElementById('rec-time');
    var timeStr = timeInput ? timeInput.value : '12:00';
    var startISO = TimeUtil.makeLocalIsoFromChinaDateTime(dateStr, timeStr);
    var event = { type: type, start_time: startISO, baby_id: null };

    var amountInput = document.getElementById('rec-amount');
    if (amountInput) event.amount_ml = parseInt(amountInput.value, 10) || 0;

    var stoolAmountInput = document.getElementById('rec-stool-amount');
    if (stoolAmountInput) {
      var stoolAmount = parseInt(stoolAmountInput.value, 10) || 0;
      event.stool = stoolAmount > 0;
      event.stool_amount = stoolAmount > 0 ? stoolAmount : null;
    }

    var noteInput = document.getElementById('rec-note');
    if (noteInput && type !== 'weight') event.note = noteInput.value;
    if (noteInput && type === 'weight' && noteInput.value) event.extra_note = noteInput.value;

    DB.getMeta('currentBabyId').then(function (babyId) {
      event.baby_id = babyId;

      if (type === 'weight') {
        var heightInput = document.getElementById('rec-height');
        var weightInput = document.getElementById('rec-weight');
        var heightValue = heightInput ? parseFloat(heightInput.value) : NaN;
        var weightValue = weightInput ? parseFloat(weightInput.value) : NaN;
        var hasHeight = !isNaN(heightValue) && heightValue > 0;
        var hasWeight = !isNaN(weightValue) && weightValue > 0;

        if (!hasHeight && !hasWeight) {
          App.toast('请至少填写身高或体重');
          return null;
        }

        if (hasHeight) event.height_cm = heightValue;
        if (hasWeight) event.weight_kg = weightValue;

        return buildGrowthReferenceNote(hasHeight ? heightValue : null, hasWeight ? weightValue : null).then(function (growthNote) {
          event.note = growthNote || '';
          return DB.addEvent(event);
        });
      }

      return DB.addEvent(event);
    }).then(function (saved) {
      if (!saved) return;
      closeModal();
      App.toast('已记录');
      App.renderPage();
    });
  }

  function renderWeightReference() {
    DB.getMeta('currentBabyId').then(function (babyId) {
      return DB.getBaby(babyId);
    }).then(function (baby) {
      refreshGrowthReferenceWithBaby(baby);
    });
  }

  function refreshGrowthReference() {
    DB.getMeta('currentBabyId').then(function (babyId) {
      return DB.getBaby(babyId);
    }).then(function (baby) {
      refreshGrowthReferenceWithBaby(baby);
    });
  }

  function refreshGrowthReferenceWithBaby(baby) {
    var el = document.getElementById('weight-ref-card');
    if (!el) return;

    var heightInput = document.getElementById('rec-height');
    var weightInput = document.getElementById('rec-weight');
    var heightValue = heightInput ? parseFloat(heightInput.value) : NaN;
    var weightValue = weightInput ? parseFloat(weightInput.value) : NaN;
    var hasHeight = !isNaN(heightValue) && heightValue > 0;
    var hasWeight = !isNaN(weightValue) && weightValue > 0;

    if (!baby || !baby.birthday) {
      if (hasHeight || hasWeight) {
        var parts = [];
        if (hasHeight) parts.push(heightValue.toFixed(1) + 'cm');
        if (hasWeight) parts.push(weightValue.toFixed(2) + 'kg');
        el.textContent = parts.join(' · ');
      } else {
        el.textContent = '设置出生日期后可显示中国婴幼儿身高和体重参考；本记录只保存日期。';
      }
      return;
    }

    var months = Calc.getAgeMonths(baby.birthday) || 0;
    var heightRef = Calc.getChineseHeightReference(months);
    var weightRef = Calc.getChineseWeightReference(months);

    if (hasHeight && hasWeight) {
      el.innerHTML = '身高：' + escapeHtml(Calc.buildHeightReferenceText(heightValue, baby.birthday)) + '<br>体重：' + escapeHtml(Calc.buildWeightReferenceText(weightValue, baby.birthday));
      return;
    }
    if (hasHeight) {
      el.textContent = '身高：' + Calc.buildHeightReferenceText(heightValue, baby.birthday);
      return;
    }
    if (hasWeight) {
      el.textContent = '体重：' + Calc.buildWeightReferenceText(weightValue, baby.birthday);
      return;
    }

    el.innerHTML = '当前约 ' + months + ' 个月<br>身高参考：' + heightRef.min.toFixed(1) + ' - ' + heightRef.max.toFixed(1) + ' cm<br>体重参考：' + weightRef.min.toFixed(1) + ' - ' + weightRef.max.toFixed(1) + ' kg';
  }

  function buildWeightReferenceNote(weightValue) {
    return DB.getMeta('currentBabyId').then(function (babyId) {
      return DB.getBaby(babyId);
    }).then(function (baby) {
      return Calc.buildWeightReferenceText(weightValue, baby && baby.birthday);
    });
  }

  function buildGrowthReferenceNote(heightValue, weightValue) {
    return DB.getMeta('currentBabyId').then(function (babyId) {
      return DB.getBaby(babyId);
    }).then(function (baby) {
      return Calc.buildGrowthReferenceText(heightValue, weightValue, baby && baby.birthday);
    });
  }

  function getCurrentChinaTimeValue() {
    return new Date().toLocaleTimeString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function stopTimer(type) {
    var result = Timer.stop(type);
    if (!result) return;

    if (result.type === 'pump') {
      window._pendingTimerEvent = {
        type: result.type,
        baby_id: result.babyId,
        start_time: result.startTime,
        end_time: result.endTime,
        duration_sec: result.durationSec,
        duration_min: result.durationMin
      };
      openPumpResult(window._pendingTimerEvent);
      return;
    }

    if (result.type === 'milk_direct') {
      DB.addEvent({
        type: 'milk_direct',
        baby_id: result.babyId,
        start_time: result.startTime,
        end_time: result.endTime,
        duration_sec: result.durationSec,
        duration_min: result.durationMin,
        left_sec: result.left_sec,
        right_sec: result.right_sec,
        left_min: result.left_min,
        right_min: result.right_min
      }).then(function () {
        closeModal();
        App.toast('已记录亲喂');
        if ((location.hash.slice(2) || 'today') === 'today') App.renderPage();
        else App.navigate('today');
      });
      return;
    }

    DB.addEvent({
      type: result.type,
      baby_id: result.babyId,
      start_time: result.startTime,
      end_time: result.endTime,
      duration_min: result.durationMin
    }).then(function () {
      closeModal();
      App.toast('已记录 ' + Calc.formatMin(result.durationMin));
      App.renderPage();
    });
  }

  function openPumpResult(event) {
    var html = '<div class="modal-overlay" onclick="if(event.target===this)UIToday.closeModal()"><div class="modal-sheet">';
    html += '<div class="modal-handle"></div><div class="modal-title">🍼 吸奶完成</div>';
    html += '<div class="form-group"><label class="form-label">吸奶时长</label><input type="text" class="form-input" value="' + Calc.formatSeconds(event.duration_sec || Math.round((event.duration_min || 0) * 60)) + '" disabled></div>';
    html += '<div class="form-group"><label class="form-label">吸出奶量（ml）</label><input type="number" class="form-input" id="pump-amount" placeholder="如：120" inputmode="numeric"></div>';
    html += '<div class="form-group"><label class="form-label">备注（可选）</label><input type="text" class="form-input" id="pump-note" placeholder=""></div>';
    html += '<button class="btn-primary" onclick="UIToday.savePump()">保存</button>';
    html += '</div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
  }

  function savePump() {
    var amountInput = document.getElementById('pump-amount');
    var noteInput = document.getElementById('pump-note');
    if (!window._pendingTimerEvent) return;

    window._pendingTimerEvent.amount_ml = parseInt(amountInput.value, 10) || 0;
    if (noteInput.value) window._pendingTimerEvent.note = noteInput.value;

    DB.addEvent(window._pendingTimerEvent).then(function () {
      window._pendingTimerEvent = null;
      closeModal();
      App.toast('已记录吸奶');
      App.renderPage();
    });
  }

  function switchBreastSide(reopen) {
    var state = Timer.switchBreastSide();
    if (!state) return;
    App.toast('已切到' + (state.currentSide === 'right' ? '右侧' : '左侧'));
    App.renderPage();
    if (reopen) openDirectRunningModal(state);
  }

  function cancelDirectTimer() {
    var active = Timer.getActive('milk_direct');
    if (!active) {
      App.navigate('today');
      return;
    }
    if (!confirm('确认放弃这次亲喂计时？本次未保存的数据会丢失。')) return;
    Timer.cancel('milk_direct');
    App.toast('已取消本次亲喂');
    App.navigate('today');
  }

  function toggleTimerPause(type) {
    var state = Timer.getActive(type);
    if (!state) return;
    var next = state.isPaused ? Timer.resume(type) : Timer.pause(type);
    if (!next) return;
    App.toast(state.isPaused ? '已继续计时' : '已暂停计时');
  }

  function openTimerDetail(type) {
    if (type === 'milk_direct') {
      openDirectRunningModal();
      return;
    }
    App.toast('这个计时先支持暂停和结束，详情页后面再补。');
  }

  function setStoolAmount(value) {
    var input = document.getElementById('rec-stool-amount');
    if (!input) return;
    var current = parseInt(input.value, 10) || 0;
    var next = current === value ? 0 : value;
    input.value = String(next);

    var buttons = document.querySelectorAll('.stool-icon-btn');
    buttons.forEach(function (button) {
      var buttonValue = parseInt(button.getAttribute('data-value'), 10) || 0;
      var active = buttonValue <= next;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function closeModal() {
    var overlays = document.querySelectorAll('.modal-overlay');
    overlays.forEach(function (overlay) {
      overlay.remove();
    });
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  return {
    render: render,
    renderLoading: renderLoading,
    renderWithBaby: renderWithBaby,
    showBabyPicker: showBabyPicker,
    switchBaby: switchBaby,
    openAddBabyFlow: openAddBabyFlow,
    openRecord: openRecord,
    saveRecord: saveRecord,
    stopTimer: stopTimer,
    savePump: savePump,
    setStoolAmount: setStoolAmount,
    closeModal: closeModal,
    dismissRecordModal: dismissRecordModal,
    openDirectTimer: openDirectTimer,
    selectStartSide: selectStartSide,
    startDirectTimer: startDirectTimer,
    switchBreastSide: switchBreastSide,
    toggleTimerPause: toggleTimerPause,
    openTimerDetail: openTimerDetail,
    openDirectManualEntry: openDirectManualEntry,
    refreshDirectTotal: refreshDirectTotal,
    saveDirectManual: saveDirectManual,
    renderDirectTimerPage: renderDirectTimerPage,
    cleanupTransientViews: cleanupTransientViews,
    cancelDirectTimer: cancelDirectTimer,
    toggleWeightNoteField: toggleWeightNoteField,
    refreshGrowthReference: refreshGrowthReference,
    buildWeightReferenceNote: buildWeightReferenceNote
  };
})();
