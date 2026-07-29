var UIStats = (function () {
  var currentRange = 'week';

  function render(container) {
    DB.getMeta('currentBabyId').then(function (babyId) {
      if (!babyId) { App.showOnboarding(); return; }
      DB.getBaby(babyId).then(function (baby) {
        var html = '<div class="log-header"><h2 style="font-size:1.2rem">统计</h2></div>';
        if (baby && baby.birthday) {
          var days = Calc.daysSinceBirth(baby.birthday);
          html += '<div class="stats-card" style="text-align:center">';
          html += '<div style="font-size:2rem">' + (baby.avatar || '🍼') + '</div>';
          html += '<div style="font-size:1.1rem;font-weight:700;margin-top:4px">' + (baby.name || '宝宝') + '</div>';
          html += '<div style="font-size:.8rem;color:var(--text-sub);margin-top:2px">出生 ' + days + ' 天</div>';
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
    DB.getMeta('currentBabyId').then(function (babyId) { loadStats(babyId); });
    var tabs = document.querySelectorAll('.stats-tabs button');
    tabs.forEach(function (t) { t.classList.remove('active'); });
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
      results.forEach(function (r) {
        totalMl += r.ml;
        totalFeedCount += r.feedCount;
        totalSleepMin += r.sleepMin;
        totalDiaper += r.diaperCount;
      });
      var html = '';
      html += '<div class="summary-row">';
      html += '<div class="summary-card"><div class="val">' + totalMl + '</div><div class="lbl">已知奶量(ml)</div></div>';
      html += '<div class="summary-card"><div class="val">' + totalFeedCount + '</div><div class="lbl">喂养次数</div></div>';
      html += '<div class="summary-card"><div class="val">' + totalDiaper + '</div><div class="lbl">尿布次数</div></div>';
      html += '</div>';
      if (days > 1) {
        html += '<div class="stats-card"><div class="sc-title">每日喝奶量 (ml)</div><div class="bar-chart">';
        var maxMl = Math.max.apply(null, results.map(function (r) { return r.ml; })) || 1;
        results.forEach(function (r) {
          var d = new Date(r.date);
          var label = (d.getMonth() + 1) + '/' + d.getDate();
          var height = Math.round((r.ml / maxMl) * 80) + 4;
          html += '<div class="bar-col"><div class="bar" style="height:' + height + 'px" title="' + r.ml + 'ml"></div><div class="bar-label">' + label + '</div></div>';
        });
        html += '</div></div>';
      } else {
        html += '<div class="stats-card"><div class="sc-title">睡眠时长</div><div class="sc-value">' + Calc.formatSeconds(Math.round((totalSleepMin || 0) * 60)) + '</div></div>';
      }
      el.innerHTML = html;
    });
  }

  function loadGrowth(babyId) {
    DB.getAllEvents(babyId).then(function (events) {
      var el = document.getElementById('growth-content');
      if (!el) return;
      var growthRecords = events.filter(function (e) {
        return e.type === 'weight' && ((e.weight_kg != null && Number(e.weight_kg) > 0) || (e.height_cm != null && Number(e.height_cm) > 0));
      }).reverse();
      if (growthRecords.length === 0) {
        el.innerHTML = '<div class="stats-card"><div class="sc-title">暂无身高体重记录</div><div style="font-size:.8rem;color:var(--text-sub);margin-top:4px">在首页添加“身高体重”按钮后即可记录，并对比中国常用婴幼儿身高和体重参考。</div></div>';
        return;
      }
      var html = '<div class="stats-card"><div class="sc-title">成长记录</div>';
      growthRecords.forEach(function (e) {
        var d = new Date(e.start_time);
        var metrics = [];
        if (e.height_cm != null && Number(e.height_cm) > 0) metrics.push(Number(e.height_cm).toFixed(1) + 'cm');
        if (e.weight_kg != null && Number(e.weight_kg) > 0) metrics.push(Number(e.weight_kg).toFixed(2) + 'kg');
        html += '<div class="weight-record-row">';
        html += '<div><div class="weight-record-date">' + (d.getMonth() + 1) + '/' + d.getDate() + '</div><div class="weight-record-note">' + (e.note || '') + '</div>';
        if (e.extra_note) html += '<div class="weight-record-note">补充备注：' + e.extra_note + '</div>';
        html += '</div>';
        html += '<div class="weight-record-value">' + metrics.join(' / ') + '</div>';
        html += '</div>';
      });
      html += '</div>';
      el.innerHTML = html;
    });
  }

  return {
    render: render,
    setRange: setRange
  };
})();
