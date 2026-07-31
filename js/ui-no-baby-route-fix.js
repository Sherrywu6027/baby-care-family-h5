window.UIEmptyBabyState = (function () {
  function render(container, options) {
    if (!container) return;
    options = options || {};

    var title = options.title || '还没有宝宝档案';
    var desc = options.desc || '先添加宝宝，之后就可以开始记录。';
    var cta = options.cta || '去添加宝宝';
    var note = options.note || '添加后会自动进入对应页面，不需要再手动返回。';

    var html = '<div class="empty-route-page">';
    html += '<div class="empty-route-card">';
    html += '<div class="empty-route-badge">宝宝档案</div>';
    html += '<div class="empty-route-title">' + title + '</div>';
    html += '<div class="empty-route-desc">' + desc + '</div>';
    html += '<button class="btn-primary empty-route-btn" onclick="UIToday.openAddBabyFlow()">' + cta + '</button>';
    html += '<div class="empty-route-note">' + note + '</div>';
    html += '</div></div>';
    container.innerHTML = html;
  }

  return {
    render: render
  };
})();

var UILog = (function (BaseUILog) {
  function render(container) {
    DB.getMeta('currentBabyId').then(function (babyId) {
      if (babyId) {
        BaseUILog.render(container);
        return;
      }
      DB.getMeta('familyId').then(function (familyId) {
        if (!familyId) {
          App.showOnboarding();
          return;
        }
        UIEmptyBabyState.render(container, {
          title: '还没有宝宝档案',
          desc: '先添加宝宝，后续记录才会显示在这里。',
          cta: '去添加宝宝'
        });
      });
    });
  }

  var next = {};
  Object.keys(BaseUILog).forEach(function (key) {
    next[key] = BaseUILog[key];
  });
  next.render = render;
  return next;
})(UILog);

var UIStats = (function (BaseUIStats) {
  function render(container) {
    DB.getMeta('currentBabyId').then(function (babyId) {
      if (babyId) {
        BaseUIStats.render(container);
        return;
      }
      DB.getMeta('familyId').then(function (familyId) {
        if (!familyId) {
          App.showOnboarding();
          return;
        }
        UIEmptyBabyState.render(container, {
          title: '还没有宝宝档案',
          desc: '先添加宝宝，添加后就可以查看统计和成长记录。',
          cta: '去添加宝宝'
        });
      });
    });
  }

  var next = {};
  Object.keys(BaseUIStats).forEach(function (key) {
    next[key] = BaseUIStats[key];
  });
  next.render = render;
  return next;
})(UIStats);
