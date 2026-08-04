var UIStats = (function () {
  var currentRange = 'week';

  function render(container) {
    DB.getMeta('currentBabyId').then(function (babyId) {
      if (!babyId) {
        App.showOnboarding();
        return;
      }

      DB.getBaby(babyId).then(function (baby) {
        var html = '<div class="log-header"><h2 style="font-size:1.2rem">统计</h2></div>';
        if (baby && baby.birthday) {
          var days = Calc.daysSinceBirth(baby.birthday);
          html += '<div class="stats-card" style="text-align:center">';
          html += '<div style="font-size:2rem">' + (baby.avatar || '👶') + '</div>';
          html += '<div style="font-size:1.1rem;font-weight:700;margin-top:4px">' + escapeHtml(baby.name || '宝宝') + '</div>';
          html += '<div style="font-size:.8rem;color:var(--text-sub);margin-top:2px">出生第 ' + days + ' 天</div>';
          html += '</div>';
        }
        html += '<div class="stats-tabs">';
        html += '<button class="' + (currentRange === 'day' ? 'active' : '') + '" onclick="UIStats.setRange(\'day\', this)">今日</button>';
        html += '<button class="' + (currentRange === 'week' ? 'active' : '') + '" onclick="UIStats.setRange(\'week\', this)">本周</button>';
        html += '<button class="' + (currentRange === 'month' ? 'active' : '') + '" onclick="UIStats.setRange(\'month\', this)">本月</button>';
        html += '</div>';
        html += '<div id="stats-content"></div>';
        html += '<div class="section-title" style="margin-top:16px">身高体重记录</div>';
        html += '<div id="growth-content"></div>';
        container.innerHTML = html;
        loadStats(babyId);
        loadGrowth(babyId);
      });
    });
  }

  function setRange(range, btn) {
    currentRange = range;
    DB.getMeta('currentBabyId').then(function (babyId) {
      loadStats(babyId);
    });
    var tabs = document.querySelectorAll('.stats-tabs button');
    Array.prototype.forEach.call(tabs, function (tab) {
      tab.classList.remove('active');
    });
    if (btn) btn.classList.add('active');
  }

  function loadStats(babyId) {
    var days = currentRange === 'day' ? 1 : (currentRange === 'week' ? 7 : 30);
    var dateStrs = Calc.getLastNDays(days);
    Calc.calcMultiDay(babyId, dateStrs).then(function (results) {
      var el = document.getElementById('stats-content');
      if (!el) return;

      var totalMl = 0;
      var totalFeedCount = 0;
      var totalSleepMin = 0;
      var totalDiaper = 0;
      results.forEach(function (result) {
        totalMl += result.ml || 0;
        totalFeedCount += result.feedCount || 0;
        totalSleepMin += result.sleepMin || 0;
        totalDiaper += result.diaperCount || 0;
      });

      var html = '';
      html += '<div class="summary-row">';
      html += '<div class="summary-card"><div class="val">' + totalMl + '</div><div class="lbl">已知奶量(ml)</div></div>';
      html += '<div class="summary-card"><div class="val">' + totalFeedCount + '</div><div class="lbl">喂养次数</div></div>';
      html += '<div class="summary-card"><div class="val">' + totalDiaper + '</div><div class="lbl">尿布次数</div></div>';
      html += '</div>';

      if (days > 1) {
        html += '<div class="stats-card">';
        html += '<div class="sc-title">睡眠总时长</div>';
        html += '<div class="sc-value">' + Calc.formatSeconds(Math.round(totalSleepMin * 60)) + '</div>';
        html += '<div class="sc-unit">平均每天 ' + Calc.formatSeconds(Math.round((totalSleepMin / days) * 60)) + '</div>';
        html += '</div>';

        html += buildDailyBarCard('每日喝奶量(ml)', results, function (result) {
          return result.ml || 0;
        }, function (value) {
          return value + 'ml';
        }, '');

        html += buildDailyBarCard('每日睡眠', results, function (result) {
          return result.sleepMin || 0;
        }, function (value) {
          return Calc.formatSeconds(Math.round(value * 60));
        }, 'background:var(--c-sleep);');
      } else {
        html += '<div class="stats-card"><div class="sc-title">睡眠时长</div><div class="sc-value">' + Calc.formatSeconds(Math.round(totalSleepMin * 60)) + '</div></div>';
      }

      el.innerHTML = html;
    });
  }

  function buildDailyBarCard(title, results, valueGetter, titleGetter, barStyle) {
    var maxValue = Math.max.apply(null, results.map(function (result) {
      return valueGetter(result) || 0;
    })) || 1;
    var html = '<div class="stats-card"><div class="sc-title">' + title + '</div><div class="bar-chart">';
    results.forEach(function (result) {
      var value = valueGetter(result) || 0;
      var label = result.date.slice(5).replace('-', '/');
      var height = Math.round((value / maxValue) * 80) + 4;
      html += '<div class="bar-col"><div class="bar" style="height:' + height + 'px;' + barStyle + '" title="' + titleGetter(value) + '"></div><div class="bar-label">' + label + '</div></div>';
    });
    html += '</div></div>';
    return html;
  }

  function loadGrowth(babyId) {
    DB.getAllEvents(babyId).then(function (events) {
      var el = document.getElementById('growth-content');
      if (!el) return;

      var growthRecords = events.filter(function (event) {
        return event.type === 'weight'
          && ((event.weight_kg != null && Number(event.weight_kg) > 0)
            || (event.height_cm != null && Number(event.height_cm) > 0));
      }).reverse();

      if (growthRecords.length === 0) {
        el.innerHTML = '<div class="stats-card"><div class="sc-title">暂无身高体重记录</div><div style="font-size:.8rem;color:var(--text-sub);margin-top:4px">在首页添加“身高体重”记录后，这里会自动汇总展示。</div></div>';
        return;
      }

      var html = '<div class="stats-card"><div class="sc-title">成长记录</div>';
      growthRecords.forEach(function (event) {
        var metrics = [];
        if (event.height_cm != null && Number(event.height_cm) > 0) metrics.push(Number(event.height_cm).toFixed(1) + 'cm');
        if (event.weight_kg != null && Number(event.weight_kg) > 0) metrics.push(Number(event.weight_kg).toFixed(2) + 'kg');

        html += '<div class="weight-record-row">';
        html += '<div><div class="weight-record-date">' + TimeUtil.getEventChinaDateKey(event).slice(5).replace('-', '/') + '</div>';
        html += '<div class="weight-record-note">' + escapeHtml(event.note || '') + '</div>';
        if (event.extra_note) html += '<div class="weight-record-note">备注：' + escapeHtml(event.extra_note) + '</div>';
        html += '</div>';
        html += '<div class="weight-record-value">' + metrics.join(' / ') + '</div>';
        html += '</div>';
      });
      html += '</div>';
      el.innerHTML = html;
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
    setRange: setRange
  };
})();
