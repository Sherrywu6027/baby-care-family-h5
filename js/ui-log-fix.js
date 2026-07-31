var UILog = (function () {
  var currentFilter = 'all';
  var currentDateFilter = '';

  function render(container) {
    DB.getMeta('currentBabyId').then(function (babyId) {
      if (!babyId) { App.showOnboarding(); return; }
      var html = '<div class="log-header"><h2 style="font-size:1.2rem">全部记录</h2></div>';
      html += '<div class="log-date-bar">';
      html += '<input type="date" class="log-date-input" id="log-date-filter" value="' + currentDateFilter + '" onchange="UILog.setDateFilter(this.value)">';
      html += '<button class="log-date-reset' + (currentDateFilter ? '' : ' ghost') + '" onclick="UILog.clearDateFilter()">全部日期</button>';
      html += '</div>';
      html += '<div class="log-filter">';
      html += filterChip('all', '全部', currentFilter === 'all');
      Object.keys(EVENT_TYPES).forEach(function (key) {
        var t = EVENT_TYPES[key];
        html += filterChip(key, t.icon + ' ' + t.label, currentFilter === key);
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
    DB.getMeta('currentBabyId').then(function (babyId) { loadEvents(babyId); });
    var chips = document.querySelectorAll('.log-filter button');
    chips.forEach(function (c) { c.classList.remove('active'); });
    if (btn) btn.classList.add('active');
  }

  function setDateFilter(dateStr) {
    currentDateFilter = dateStr || '';
    DB.getMeta('currentBabyId').then(function (babyId) { loadEvents(babyId); });
    syncDateFilterUi();
  }

  function clearDateFilter() {
    currentDateFilter = '';
    DB.getMeta('currentBabyId').then(function (babyId) { loadEvents(babyId); });
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
      var filtered = currentFilter === 'all' ? events : events.filter(function (e) { return e.type === currentFilter; });
      if (currentDateFilter) {
        filtered = filtered.filter(function (e) {
          return new Date(e.start_time).toISOString().slice(0, 10) === currentDateFilter;
        });
      }
      if (filtered.length === 0) {
        el.innerHTML = '<div class="empty-state"><div class="es-icon">📋</div><div class="es-text">暂无记录</div></div>';
        return;
      }
      var groups = {};
      filtered.forEach(function (e) {
        var d = new Date(e.start_time).toISOString().slice(0, 10);
        if (!groups[d]) groups[d] = [];
        groups[d].push(e);
      });
      var weekdays = ['日', '一', '二', '三', '四', '五', '六'];
      var html = '';
      Object.keys(groups).sort(function (a, b) { return b.localeCompare(a); }).forEach(function (dateStr) {
        var d = new Date(dateStr);
        html += '<div class="section-title" style="margin-top:12px">' + (d.getMonth() + 1) + '月' + d.getDate() + '日 周' + weekdays[d.getDay()] + '</div>';
        groups[dateStr].forEach(function (e) {
          var t = EVENT_TYPES[e.type] || { icon: '•', label: e.type, color: 'var(--text)' };
          html += '<div class="timeline-item" onclick="UILog.editEvent(\'' + e.id + '\')" style="cursor:pointer">';
          html += '<div class="ti-time">' + formatTimelineTime(e) + '</div>';
          html += '<div class="ti-icon">' + t.icon + '</div>';
          html += '<div class="ti-text"><div class="ti-type" style="color:' + t.color + '">' + Calc.eventDescription(e) + '</div>';
          if (e.note) html += '<div class="ti-detail">备注：' + e.note + '</div>';
          if (e.extra_note) html += '<div class="ti-detail">补充备注：' + e.extra_note + '</div>';
          html += '<div class="ti-detail">' + buildRecorderText(e) + '</div>';
          html += '</div><span class="ti-arrow">›</span></div>';
        });
      });
      el.innerHTML = html;
    });
  }

  function buildRecorderText(event) {
    var name = event && event.recorded_by_name ? event.recorded_by_name : '历史记录';
    var timeSource = event && (event.created_at || event.updated_at || event.start_time);
    var time = timeSource ? new Date(timeSource).toLocaleString('zh-CN') : '未知时间';
    return '添加人：' + name + ' · 添加时间：' + time;
  }

  function formatTimelineTime(event) {
    if (!event) return '--:--';
    var timeSource = event.type === 'weight'
      ? (event.created_at || event.updated_at || event.start_time)
      : event.start_time;
    return timeSource ? Calc.formatTime(timeSource) : '--:--';
  }

  function editEvent(id) {
    DB.getEvent(id).then(function (e) {
      if (!e) return;
      var t = EVENT_TYPES[e.type] || { icon: '•', label: e.type };
      var d = new Date(e.start_time);
      var dateStr = d.toISOString().slice(0, 10);
      var timeStr = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
      var html = '<div class="modal-overlay" onclick="if(event.target===this)UIToday.closeModal()"><div class="modal-sheet">';
      html += '<div class="modal-handle"></div><div class="modal-title">' + t.icon + ' ' + t.label + ' · 编辑</div>';
      if (e.type === 'weight') {
        html += '<div class="form-group"><label class="form-label">日期</label><input type="date" class="form-input" id="edit-date" value="' + dateStr + '"></div>';
      } else {
        html += '<div class="form-row"><div class="form-group"><label class="form-label">日期</label><input type="date" class="form-input" id="edit-date" value="' + dateStr + '"></div><div class="form-group"><label class="form-label">时间</label><input type="time" class="form-input" id="edit-time" value="' + timeStr + '"></div></div>';
      }

      if (e.type === 'formula' || e.type === 'milk_bottle' || e.type === 'pump') {
        html += '<div class="form-group"><label class="form-label">容量 (ml)</label><input type="number" class="form-input" id="edit-amount" value="' + (e.amount_ml || '') + '" inputmode="numeric"></div>';
      }
      if (e.type === 'diaper') {
        var currentAmount = e.stool_amount || (e.stool ? 1 : 0);
        html += '<div class="form-group"><label class="form-label">大便量（直接点图标，可留空）</label><div class="stool-scale">';
        for (var i = 1; i <= 5; i++) {
          var activeClass = i <= currentAmount ? ' active' : '';
          html += '<button type="button" class="stool-icon-btn' + activeClass + '" data-value="' + i + '" onclick="UILog.setEditStoolAmount(' + i + ')" aria-pressed="' + (i <= currentAmount ? 'true' : 'false') + '">💩</button>';
        }
        html += '</div><input type="hidden" id="edit-stool-amount" value="' + currentAmount + '"></div>';
      }
      if (e.type === 'sleep' || e.type === 'pump') {
        html += '<div class="form-group"><label class="form-label">时长（分钟）</label><input type="number" class="form-input" id="edit-duration" value="' + (e.duration_min || '') + '" inputmode="numeric"></div>';
      }
      if (e.type === 'milk_direct') {
        html += '<div class="form-row"><div class="form-group"><label class="form-label">左胸（分钟）</label><input type="number" class="form-input" id="edit-left" value="' + (e.left_min || 0) + '" inputmode="numeric" oninput="UILog.refreshEditDirectTotal()"></div><div class="form-group"><label class="form-label">右胸（分钟）</label><input type="number" class="form-input" id="edit-right" value="' + (e.right_min || 0) + '" inputmode="numeric" oninput="UILog.refreshEditDirectTotal()"></div></div>';
        html += '<div class="form-group"><label class="form-label">总时长（自动计算）</label><input type="text" class="form-input" id="edit-direct-total" value="' + ((e.left_min || 0) + (e.right_min || 0)) + ' 分钟" disabled></div>';
      }
      if (e.type === 'weight') {
        html += '<div class="form-group"><label class="form-label">身高（cm，可选）</label><input type="number" step="0.1" class="form-input" id="edit-height" value="' + (e.height_cm || '') + '"></div>';
        html += '<div class="form-group"><label class="form-label">体重（kg，可选）</label><input type="number" step="0.01" class="form-input" id="edit-weight" value="' + (e.weight_kg || '') + '"></div>';
      }

      html += '<div class="form-group"><label class="form-label">备注</label><input type="text" class="form-input" id="edit-note" value="' + (e.note || '') + '"></div>';
      if (e.type === 'weight') html += '<div class="form-group"><label class="form-label">补充备注</label><input type="text" class="form-input" id="edit-extra-note" value="' + (e.extra_note || '') + '"></div>';
      html += '<button class="btn-primary" onclick="UILog.saveEdit(\'' + id + '\')">保存修改</button>';
      html += '<button class="btn-danger" style="margin-top:8px" onclick="UILog.deleteEvent(\'' + id + '\')">删除此记录</button>';
      html += '</div></div>';
      document.body.insertAdjacentHTML('beforeend', html);
    });
  }

  function refreshEditDirectTotal() {
    var left = parseInt(document.getElementById('edit-left').value) || 0;
    var right = parseInt(document.getElementById('edit-right').value) || 0;
    document.getElementById('edit-direct-total').value = (left + right) + ' 分钟';
  }

  function saveEdit(id) {
    var updates = {};
    var dateStr = document.getElementById('edit-date').value;
    var timeInput = document.getElementById('edit-time');
    var timeStr = timeInput ? timeInput.value : '12:00';
    var startDate = new Date(dateStr + 'T' + timeStr);
    updates.start_time = startDate.toISOString();

    var amt = document.getElementById('edit-amount');
    if (amt) updates.amount_ml = parseInt(amt.value) || 0;

    var stoolAmountInput = document.getElementById('edit-stool-amount');
    if (stoolAmountInput) {
      var stoolAmount = parseInt(stoolAmountInput.value) || 0;
      updates.stool = stoolAmount > 0;
      updates.stool_amount = stoolAmount > 0 ? stoolAmount : null;
    }

    var dur = document.getElementById('edit-duration');
    if (dur) {
      updates.duration_min = parseInt(dur.value) || 0;
      updates.duration_sec = updates.duration_min * 60;
      updates.end_time = new Date(startDate.getTime() + updates.duration_sec * 1000).toISOString();
    }

    var left = document.getElementById('edit-left');
    var right = document.getElementById('edit-right');
    if (left && right) {
      updates.left_min = parseInt(left.value) || 0;
      updates.right_min = parseInt(right.value) || 0;
      updates.duration_min = updates.left_min + updates.right_min;
      updates.left_sec = updates.left_min * 60;
      updates.right_sec = updates.right_min * 60;
      updates.duration_sec = updates.left_sec + updates.right_sec;
      updates.end_time = new Date(startDate.getTime() + updates.duration_sec * 1000).toISOString();
    }

    var height = document.getElementById('edit-height');
    if (height) {
      var heightValue = parseFloat(height.value);
      updates.height_cm = (!isNaN(heightValue) && heightValue > 0) ? heightValue : null;
    }

    var weight = document.getElementById('edit-weight');
    if (weight) {
      var weightValue = parseFloat(weight.value);
      updates.weight_kg = (!isNaN(weightValue) && weightValue > 0) ? weightValue : null;
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
      App.toast('已修改');
      App.renderPage();
    });
  }

  function deleteEvent(id) {
    if (!confirm('确认删除这条记录？')) return;
    DB.deleteEvent(id).then(function () {
      UIToday.closeModal();
      App.toast('已删除');
      App.renderPage();
    });
  }

  function setEditStoolAmount(value) {
    var input = document.getElementById('edit-stool-amount');
    if (!input) return;
    var current = parseInt(input.value) || 0;
    var next = current === value ? 0 : value;
    input.value = String(next);
    var buttons = document.querySelectorAll('.stool-icon-btn');
    buttons.forEach(function (button) {
      var buttonValue = parseInt(button.getAttribute('data-value')) || 0;
      var active = buttonValue <= next;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  return {
    render: render,
    setFilter: setFilter,
    setDateFilter: setDateFilter,
    clearDateFilter: clearDateFilter,
    editEvent: editEvent,
    saveEdit: saveEdit,
    deleteEvent: deleteEvent,
    setEditStoolAmount: setEditStoolAmount,
    refreshEditDirectTotal: refreshEditDirectTotal
  };
})();
