var UIToday = (function (BaseUIToday) {
  function render(container) {
    DB.getMeta('currentBabyId').then(function (babyId) {
      if (babyId) {
        BaseUIToday.render(container);
        return;
      }
      return DB.getMeta('familyId').then(function (familyId) {
        if (!familyId) {
          App.showOnboarding();
          return;
        }
        renderRecoveringState(container);
        return Sync.sync({ silent: true }).catch(function () {
          return null;
        }).then(function () {
          return DB.getBabies();
        }).then(function (babies) {
          var firstBaby = (babies || [])[0] || null;
          if (firstBaby) {
            return DB.setMeta('currentBabyId', firstBaby.id).then(function () {
              App.renderPage();
            });
          }
          renderEmptyFamilyState(container);
          return null;
        });
      });
    });
  }

  function renderRecoveringState(container) {
    if (!container) return;
    container.innerHTML = '<div class="welcome-page compact"><div class="welcome-section compact"><div class="welcome-title">正在恢复家庭数据</div><div class="welcome-desc">已识别到原来的家庭，正在同步宝宝和记录，请稍候。</div></div></div>';
  }

  function renderEmptyFamilyState(container) {
    if (!container) return;
    var html = '<div class="welcome-page compact">';
    html += '<div class="welcome-section compact">';
    html += '<div class="welcome-title">已进入原家庭</div>';
    html += '<div class="welcome-desc">当前家庭里还没有可用的宝宝档案，请先添加宝宝后再开始记录。</div>';
    html += '<button class="btn-primary" onclick="App.navigate(\'settings\');App.renderPage()">去添加宝宝</button>';
    html += '</div></div>';
    container.innerHTML = html;
  }

  var next = {};
  Object.keys(BaseUIToday).forEach(function (key) {
    next[key] = BaseUIToday[key];
  });
  next.render = render;
  return next;
})(UIToday);
