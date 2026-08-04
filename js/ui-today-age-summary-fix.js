var UIToday = (function (base) {
  if (!base) return base;

  var originalRender = base.render;
  var originalRenderWithBaby = base.renderWithBaby;
  var originalShowBabyPicker = base.showBabyPicker;
  var originalSaveRecord = base.saveRecord;
  var summaryObserver = null;
  var headerObserver = null;
  var recentObserver = null;
  var timerObserver = null;

  function buildBabyAgeText(baby) {
    if (!baby || !baby.birthday) return '';
    var days = Calc.daysSinceBirth(baby.birthday);
    if (days == null) return '';
    return '第 ' + days + ' 天';
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function summaryCard(value, label) {
    return '<div class="summary-card"><div class="val">' + value + '</div><div class="lbl">' + label + '</div></div>';
  }

  function buildDiaperSummaryValue(summary) {
    var count = summary && summary.diaperCount ? summary.diaperCount : 0;
    var stoolAmount = summary && summary.diaperStoolAmount ? Number(summary.diaperStoolAmount) : 0;
    return count + ' 次 / 💩' + stoolAmount;
  }

  function buildDiaperSummaryLabel(summary) {
    var stoolCount = summary && summary.diaperStool ? summary.diaperStool : 0;
    return '尿布 · 大便 ' + stoolCount + ' 次';
  }

  function renderHeaderButton(baby) {
    var switchButton = document.querySelector('.today-header .baby-switch');
    if (!switchButton) return;

    var ageText = buildBabyAgeText(baby);
    switchButton.innerHTML =
      '<span>' + (baby && baby.avatar ? escapeHtml(baby.avatar) : '👶') + ' ' + escapeHtml(baby && baby.name ? baby.name : '宝宝') + '</span>' +
      (ageText ? '<span class="baby-switch-age">' + escapeHtml(ageText) + '</span>' : '') +
      '<span>▾</span>';
  }

  function renderSummary(summary) {
    var summaryRow = document.getElementById('summary-row');
    if (!summaryRow) return;

    var html = '';
    html += summaryCard((summary.feedMl || 0) + 'ml', '已知奶量 · 喂奶 ' + (summary.feedCount || 0) + ' 次');
    html += summaryCard((summary.directCount || 0) + ' 次 / ' + Calc.formatSeconds(summary.directSec || 0), '母乳亲喂');
    html += summaryCard(buildDiaperSummaryValue(summary), buildDiaperSummaryLabel(summary));

    if (summaryRow.innerHTML !== html) summaryRow.innerHTML = html;
  }

  function normalizeTimerSubtext() {
    var mainCard = document.getElementById('active-main-card');
    var sub = document.getElementById('active-main-sub');
    if (!mainCard || !sub) return;

    var isDirect = !!mainCard.querySelector('.mini-link-btn');
    if (!isDirect && sub.textContent && sub.textContent.indexOf('暂停') === -1) {
      sub.textContent = '';
    }
  }

  function enhanceRecentTimeline(babyId) {
    var timeline = document.getElementById('recent-timeline');
    if (!timeline) return;

    DB.getEventsByDay(babyId, TimeUtil.todayChinaDate()).then(function (events) {
      var visibleEvents = (events || []).slice(0, 5);
      var items = timeline.querySelectorAll('.timeline-item');
      Array.prototype.forEach.call(items, function (item, index) {
        var event = visibleEvents[index];
        if (!event) return;

        var existingAction = item.querySelector('.timeline-weak-action');
        if (existingAction) {
          existingAction.setAttribute('onclick', 'UIToday.quickDeleteRecentEvent(\'' + event.id + '\', event)');
          return;
        }

        item.classList.add('timeline-item-with-action');
        item.insertAdjacentHTML(
          'beforeend',
          '<div class="ti-actions"><button class="timeline-weak-action" onclick="UIToday.quickDeleteRecentEvent(\'' + event.id + '\', event)">删除</button></div>'
        );
      });
    }).catch(function () {});
  }

  function quickDeleteRecentEvent(id, ev) {
    if (ev) {
      if (typeof ev.preventDefault === 'function') ev.preventDefault();
      if (typeof ev.stopPropagation === 'function') ev.stopPropagation();
    }
    if (!confirm('确认删除这条记录吗？')) return;
    DB.deleteEvent(id).then(function () {
      if (App.requestSync) App.requestSync('event-delete');
      App.toast('已删除');
      App.renderPage();
    });
  }

  function disconnectObservers() {
    if (summaryObserver) {
      summaryObserver.disconnect();
      summaryObserver = null;
    }
    if (headerObserver) {
      headerObserver.disconnect();
      headerObserver = null;
    }
    if (recentObserver) {
      recentObserver.disconnect();
      recentObserver = null;
    }
    if (timerObserver) {
      timerObserver.disconnect();
      timerObserver = null;
    }
  }

  function attachObservers(babyId) {
    var summaryRow = document.getElementById('summary-row');
    var todayHeader = document.querySelector('.today-header');
    var recentTimeline = document.getElementById('recent-timeline');
    var activeTimersArea = document.getElementById('active-timers-area');

    if (summaryRow && !summaryObserver) {
      summaryObserver = new MutationObserver(function () {
        refreshHeaderAndSummary(babyId);
      });
      summaryObserver.observe(summaryRow, { childList: true, subtree: true });
    }

    if (todayHeader && !headerObserver) {
      headerObserver = new MutationObserver(function () {
        DB.getBaby(babyId).then(function (baby) {
          renderHeaderButton(baby);
        }).catch(function () {});
      });
      headerObserver.observe(todayHeader, { childList: true, subtree: true });
    }

    if (recentTimeline && !recentObserver) {
      recentObserver = new MutationObserver(function () {
        enhanceRecentTimeline(babyId);
      });
      recentObserver.observe(recentTimeline, { childList: true, subtree: true });
    }

    if (activeTimersArea && !timerObserver) {
      timerObserver = new MutationObserver(function () {
        normalizeTimerSubtext();
      });
      timerObserver.observe(activeTimersArea, { childList: true, subtree: true, characterData: true });
    }
  }

  function refreshHeaderAndSummary(babyId) {
    if (!babyId) return;
    Promise.all([DB.getBaby(babyId), Calc.calcToday(babyId)]).then(function (result) {
      var baby = result[0];
      var summary = result[1];
      renderHeaderButton(baby);
      renderSummary(summary);
      normalizeTimerSubtext();
      enhanceRecentTimeline(babyId);
      attachObservers(babyId);
    }).catch(function () {});
  }

  function refreshBabyPicker() {
    DB.getBabies().then(function (babies) {
      var cards = document.querySelectorAll('.modal-overlay .baby-card');
      if (!cards || cards.length === 0) return;

      babies.forEach(function (baby, index) {
        var card = cards[index];
        if (!card) return;
        var birthday = card.querySelector('.bi-birthday');
        if (!birthday) return;

        var ageText = buildBabyAgeText(baby);
        birthday.textContent = ageText ? (ageText + (baby.birthday ? ' · ' + baby.birthday : '')) : (baby.birthday || '');
      });
    }).catch(function () {});
  }

  function afterRender(babyId) {
    disconnectObservers();
    setTimeout(function () { refreshHeaderAndSummary(babyId); }, 0);
    setTimeout(function () { refreshHeaderAndSummary(babyId); }, 120);
    setTimeout(function () { refreshHeaderAndSummary(babyId); }, 400);
  }

  function triggerAfterCurrentRender() {
    DB.getMeta('currentBabyId').then(function (babyId) {
      afterRender(babyId);
    }).catch(function () {});
  }

  function saveDiaperRecord() {
    var dateInput = document.getElementById('rec-date');
    if (!dateInput) return;

    var timeInput = document.getElementById('rec-time');
    var noteInput = document.getElementById('rec-note');
    var stoolAmountInput = document.getElementById('rec-stool-amount');
    var stoolAmount = stoolAmountInput ? (parseInt(stoolAmountInput.value, 10) || 0) : 0;
    var event = {
      type: 'diaper',
      baby_id: null,
      start_time: TimeUtil.makeLocalIsoFromChinaDateTime(dateInput.value, timeInput ? (timeInput.value || '12:00') : '12:00'),
      note: noteInput ? (noteInput.value || '') : '',
      stool: stoolAmount > 0,
      stool_amount: stoolAmount > 0 ? stoolAmount : null
    };

    DB.getMeta('currentBabyId').then(function (babyId) {
      event.baby_id = babyId;
      return DB.addEvent(event);
    }).then(function (saved) {
      if (!saved) return;
      if (base.closeModal) base.closeModal();
      window.dispatchEvent(new CustomEvent('baby-today-record-saved'));
      if (App.requestSync) App.requestSync('today-save-diaper');
      App.toast('已记录');
      App.renderPage();
    }).catch(function (error) {
      if (window.console && console.error) console.error('save diaper failed', error);
      App.toast('保存失败，请重试');
    });
  }

  window.addEventListener('baby-today-record-saved', function () {
    triggerAfterCurrentRender();
  });

  base.render = function (container) {
    var result = originalRender.call(base, container);
    triggerAfterCurrentRender();
    return result;
  };

  base.renderWithBaby = function (container, babyId) {
    var result = originalRenderWithBaby.call(base, container, babyId);
    afterRender(babyId);
    return result;
  };

  base.showBabyPicker = function () {
    var result = originalShowBabyPicker.call(base);
    setTimeout(refreshBabyPicker, 0);
    setTimeout(refreshBabyPicker, 120);
    return result;
  };

  base.saveRecord = function (type) {
    if (type === 'diaper') {
      saveDiaperRecord();
      return;
    }
    return originalSaveRecord.call(base, type);
  };

  base.quickDeleteRecentEvent = quickDeleteRecentEvent;

  return base;
})(window.UIToday);
