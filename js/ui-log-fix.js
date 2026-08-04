var UILog = (function () {
  var currentFilter = 'all';
  var currentDateFilter = '';

  function render(container) {
    DB.getMeta('currentBabyId').then(function (babyId) {
      if (!babyId) {
        App.showOnboarding();
        return;
      }
      if (!currentDateFilter) currentDateFilter = TimeUtil.todayChinaDate();

      var html = '<div class="log-header"><h2 style="font-size:1.2rem">全部记录</h2></div>';
      html += '<div class="log-date-bar">';
      html += '<input type="date" class="log-date-input" id="log-date-filter" value="' + currentDateFilter + '" onchange="UILog.setDateFilter(this.value)">';
      html += '<button class="log-date-reset' + (currentDateFilter ? '' : ' ghost') + '" onclick="UILog.clearDateFilter()">全部日期</button>';
      html += '</div>';
      html += '<div class="log-filter">';
      html += filterChip('all', '全部', currentFilter === 'all');
      Object.keys(EVENT_TYPES).forEach(function (key) {
        var type = EVENT_TYPES[key];
        html += filterChip(key, type.icon + ' ' + type.label, currentFilter === key);
      });
      html += '</div>';
      html += '<div class="timeline" id="log-timeline"></div>';
      container.innerHTML = html;
      loadEvents(babyId);
    });
  }

  function filterChip(key, label, active) {
    return '<button class="' + (active ? 'active' : '') + '" onclick="UILog.setFilter(\'' + key + '\', this)">' + label + '</button>';
  }

  function setFilter(filter, btn) {
    currentFilter = filter;
    DB.getMeta('currentBabyId').then(function (babyId) {
      loadEvents(babyId);
    });
    var chips = document.querySelectorAll('.log-filter button');
    chips.forEach(function (chip) {
      chip.classList.remove('active');
    });
    if (btn) btn.classList.add('active');
  }

  function setDateFilter(dateStr) {
    currentDateFilter = dateStr || '';
    DB.getMeta('currentBabyId').then(function (babyId) {
      loadEvents(babyId);
    });
    syncDateFilterUi();
  }

  function clearDateFilter() {
    currentDateFilter = '';
    DB.getMeta('currentBabyId').then(function (babyId) {
      loadEvents(babyId);
    });
    syncDateFilterUi();
  }

  function syncDateFilterUi() {
    var input = document.getElementById('log-date-filter');
    if (input) input.value = currentDateFilter || '';
    var resetBtn = document.querySelector('.log-date-reset');
    if (resetBtn) resetBtn.classList.toggle('ghost', !currentDateFilter);
  }

  function loadEvents(babyId) {
    DB.getAllEvents(babyId).then(function (events) {
      var el = document.getElementById('log-timeline');
      if (!el) return;

      var filtered = currentFilter === 'all' ? events : events.filter(function (event) {
        return event.type === currentFilter;
      });

      if (currentDateFilter) {
        filtered = filtered.filter(function (event) {
          return TimeUtil.getEventChinaDateKey(event) === currentDateFilter;
        });
      }

      if (filtered.length === 0) {
        el.innerHTML = '<div class="empty-state"><div class="es-icon">📝</div><div class="es-text">暂无记录</div></div>';
        return;
      }

      var groups = {};
      filtered.forEach(function (event) {
        var dateKey = TimeUtil.getEventChinaDateKey(event);
        if (!groups[dateKey]) groups[dateKey] = [];
        groups[dateKey].push(event);
      });

      var html = '';
      Object.keys(groups).sort(function (a, b) {
        return b.localeCompare(a);
      }).forEach(function (dateKey) {
        html += '<div class="section-title" style="margin-top:12px">' + TimeUtil.formatChinaDateLabel(dateKey) + '</div>';
        groups[dateKey].forEach(function (event) {
          var type = EVENT_TYPES[event.type] || { icon: '•', label: event.type, color: 'var(--text)' };
          html += '<div class="timeline-item timeline-item-clickable" onclick="UILog.editEvent(\'' + event.id + '\')">';
          html += '<div class="ti-time">' + formatTimelineTime(event) + '</div>';
          html += '<div class="ti-icon">' + escapeHtml(type.icon) + '</div>';
          html += '<div class="ti-text"><div class="ti-type" style="color:' + type.color + '">' + escapeHtml(Calc.eventDescription(event)) + '</div>';
          if (event.note) html += '<div class="ti-detail">备注：' + escapeHtml(event.note) + '</div>';
          if (event.extra_note) html += '<div class="ti-detail">补充备注：' + escapeHtml(event.extra_note) + '</div>';
          html += '<div class="ti-detail">' + escapeHtml(buildRecorderText(event)) + '</div>';
          html += '</div>';
          html += '<div class="ti-actions"><button class="timeline-weak-action" onclick="UILog.quickDeleteEvent(\'' + event.id + '\', event)">删除</button><span class="ti-arrow">›</span></div>';
          html += '</div>';
        });
      });

      el.innerHTML = html;
    });
  }

  function buildRecorderText(event) {
    var name = event && event.recorded_by_name ? event.recorded_by_name : '历史记录';
    var timeSource = event && (event.created_at || event.updated_at || event.start_time);
    var time = timeSource ? TimeUtil.formatChinaDateTime(timeSource) : '未知时间';
    return '添加人：' + name + ' / 添加时间：' + time;
  }

  function formatTimelineTime(event) {
    if (!event) return '--:--';
    var timeSource = event.type === 'weight'
      ? (event.created_at || event.updated_at || event.start_time)
      : event.start_time;
    return timeSource ? Calc.formatTime(timeSource) : '--:--';
  }

  function editEvent(id) {
    DB.getEvent(id).then(function (event) {
      if (!event) return;

      var type = EVENT_TYPES[event.type] || { icon: '•', label: event.type };
      var dateStr = TimeUtil.getEventChinaDateKey(event);
      var timeValue = new Date(event.start_time);
      var timeStr = String(timeValue.getHours()).padStart(2, '0') + ':' + String(timeValue.getMinutes()).padStart(2, '0');
      var html = '<div class="modal-overlay" onclick="if(event.target===this)UIToday.closeModal()"><div class="modal-sheet">';
      html += '<div class="modal-handle"></div><div class="modal-title">' + escapeHtml(type.icon) + ' ' + escapeHtml(type.label) + ' / 编辑</div>';

      if (event.type === 'weight') {
        html += '<div class="form-group"><label class="form-label">日期</label><input type="date" class="form-input" id="edit-date" value="' + dateStr + '"></div>';
      } else {
        html += '<div class="form-row"><div class="form-group"><label class="form-label">日期</label><input type="date" class="form-input" id="edit-date" value="' + dateStr + '"></div><div class="form-group"><label class="form-label">时间</label><input type="time" class="form-input" id="edit-time" value="' + timeStr + '"></div></div>';
      }

      if (event.type === 'formula' || event.type === 'milk_bottle' || event.type === 'pump') {
        html += '<div class="form-group"><label class="form-label">容量 (ml)</label><input type="number" class="form-input" id="edit-amount" value="' + (event.amount_ml || '') + '" inputmode="numeric"></div>';
      }

      if (event.type === 'diaper') {
        var currentAmount = event.stool_amount || (event.stool ? 1 : 0);
        html += '<div class="form-group"><label class="form-label">大便量</label><div class="stool-scale">';
        for (var i = 1; i <= 5; i++) {
          var activeClass = i <= currentAmount ? ' active' : '';
          html += '<button type="button" class="stool-icon-btn' + activeClass + '" data-value="' + i + '" onclick="UILog.setEditStoolAmount(' + i + ')" aria-pressed="' + (i <= currentAmount ? 'true' : 'false') + '">💩</button>';
        }
        html += '</div><input type="hidden" id="edit-stool-amount" value="' + currentAmount + '"></div>';
      }

      if (event.type === 'sleep' || event.type === 'pump') {
        html += '<div class="form-group"><label class="form-label">时长（分钟）</label><input type="number" class="form-input" id="edit-duration" value="' + (event.duration_min || '') + '" inputmode="numeric"></div>';
      }

      if (event.type === 'milk_direct') {
        html += '<div class="form-row"><div class="form-group"><label class="form-label">左侧（分钟）</label><input type="number" class="form-input" id="edit-left" value="' + (event.left_min || 0) + '" inputmode="numeric" oninput="UILog.refreshEditDirectTotal()"></div><div class="form-group"><label class="form-label">右侧（分钟）</label><input type="number" class="form-input" id="edit-right" value="' + (event.right_min || 0) + '" inputmode="numeric" oninput="UILog.refreshEditDirectTotal()"></div></div>';
        html += '<div class="form-group"><label class="form-label">总时长</label><input type="text" class="form-input" id="edit-direct-total" value="' + ((event.left_min || 0) + (event.right_min || 0)) + ' 分钟" disabled></div>';
      }

      if (event.type === 'weight') {
        html += '<div class="form-group"><label class="form-label">身高（cm，可选）</label><input type="number" step="0.1" class="form-input" id="edit-height" value="' + (event.height_cm || '') + '"></div>';
        html += '<div class="form-group"><label class="form-label">体重（kg，可选）</label><input type="number" step="0.01" class="form-input" id="edit-weight" value="' + (event.weight_kg || '') + '"></div>';
      }

      html += '<div class="form-group"><label class="form-label">备注</label><input type="text" class="form-input" id="edit-note" value="' + escapeAttr(event.note || '') + '"></div>';
      if (event.type === 'weight') html += '<div class="form-group"><label class="form-label">补充备注</label><input type="text" class="form-input" id="edit-extra-note" value="' + escapeAttr(event.extra_note || '') + '"></div>';
      html += '<button class="btn-primary" onclick="UILog.saveEdit(\'' + id + '\')">保存修改</button>';
      html += '<button class="btn-danger" style="margin-top:8px" onclick="UILog.deleteEvent(\'' + id + '\')">删除此记录</button>';
      html += '</div></div>';
      document.body.insertAdjacentHTML('beforeend', html);
    });
  }

  function refreshEditDirectTotal() {
    var left = parseInt(document.getElementById('edit-left').value, 10) || 0;
    var right = parseInt(document.getElementById('edit-right').value, 10) || 0;
    document.getElementById('edit-direct-total').value = (left + right) + ' 分钟';
  }

  function saveEdit(id) {
    var updates = {};
    var dateStr = document.getElementById('edit-date').value;
    var timeInput = document.getElementById('edit-time');
    var timeStr = timeInput ? timeInput.value : '12:00';
    var startDate = new Date(dateStr + 'T' + timeStr);
    updates.start_time = TimeUtil.makeLocalIsoFromChinaDateTime(dateStr, timeStr);

    var amount = document.getElementById('edit-amount');
    if (amount) updates.amount_ml = parseInt(amount.value, 10) || 0;

    var stoolAmountInput = document.getElementById('edit-stool-amount');
    if (stoolAmountInput) {
      var stoolAmount = parseInt(stoolAmountInput.value, 10) || 0;
      updates.stool = stoolAmount > 0;
      updates.stool_amount = stoolAmount > 0 ? stoolAmount : null;
    }

    var duration = document.getElementById('edit-duration');
    if (duration) {
      updates.duration_min = parseInt(duration.value, 10) || 0;
      updates.duration_sec = updates.duration_min * 60;
      updates.end_time = new Date(startDate.getTime() + updates.duration_sec * 1000).toISOString();
    }

    var left = document.getElementById('edit-left');
    var right = document.getElementById('edit-right');
    if (left && right) {
      updates.left_min = parseInt(left.value, 10) || 0;
      updates.right_min = parseInt(right.value, 10) || 0;
      updates.duration_min = updates.left_min + updates.right_min;
      updates.left_sec = updates.left_min * 60;
      updates.right_sec = updates.right_min * 60;
      updates.duration_sec = updates.left_sec + updates.right_sec;
      updates.end_time = new Date(startDate.getTime() + updates.duration_sec * 1000).toISOString();
    }

    var height = document.getElementById('edit-height');
    if (height) {
      var heightValue = parseFloat(height.value);
      updates.height_cm = !isNaN(heightValue) && heightValue > 0 ? heightValue : null;
    }

    var weight = document.getElementById('edit-weight');
    if (weight) {
      var weightValue = parseFloat(weight.value);
      updates.weight_kg = !isNaN(weightValue) && weightValue > 0 ? weightValue : null;
    }

    if ((height || weight) && !updates.height_cm && !updates.weight_kg) {
      App.toast('请至少填写身高或体重');
      return;
    }

    var note = document.getElementById('edit-note');
    if (note) updates.note = note.value;
    var extraNote = document.getElementById('edit-extra-note');
    if (extraNote) updates.extra_note = extraNote.value;

    DB.updateEvent(id, updates).then(function () {
      UIToday.closeModal();
      if (App.requestSync) App.requestSync('event-edit');
      App.toast('已修改');
      App.renderPage();
    });
  }

  function deleteEvent(id) {
    if (!confirm('确认删除这条记录吗？')) return;
    DB.deleteEvent(id).then(function () {
      UIToday.closeModal();
      if (App.requestSync) App.requestSync('event-delete');
      App.toast('已删除');
      App.renderPage();
    });
  }

  function quickDeleteEvent(id, ev) {
    if (ev) {
      if (typeof ev.preventDefault === 'function') ev.preventDefault();
      if (typeof ev.stopPropagation === 'function') ev.stopPropagation();
    }
    deleteEvent(id);
  }

  function setEditStoolAmount(value) {
    var input = document.getElementById('edit-stool-amount');
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

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }

  return {
    render: render,
    setFilter: setFilter,
    setDateFilter: setDateFilter,
    clearDateFilter: clearDateFilter,
    editEvent: editEvent,
    saveEdit: saveEdit,
    deleteEvent: deleteEvent,
    quickDeleteEvent: quickDeleteEvent,
    setEditStoolAmount: setEditStoolAmount,
    refreshEditDirectTotal: refreshEditDirectTotal
  };
})();
