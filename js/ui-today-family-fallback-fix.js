var UIToday = (function (baseUIToday) {
  function render(container) {
    DB.getMeta('currentBabyId').then(function (babyId) {
      if (babyId) {
        baseUIToday.render(container);
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
    container.innerHTML = '<div class="welcome-page compact"><div class="welcome-section compact"><div class="welcome-title">正在恢复家庭数据</div><div class="welcome-desc">已识别到你之前加入的家庭，正在同步宝宝和记录，请稍候。</div></div></div>';
  }

  function renderEmptyFamilyState(container) {
    if (window.UIEmptyBabyState && UIEmptyBabyState.render) {
      UIEmptyBabyState.render(container, {
        title: '已进入原家庭',
        desc: '当前家庭里还没有可用的宝宝档案，请先添加宝宝后再开始记录。',
        cta: '去添加宝宝',
        note: '添加成功后会直接回到今日页。'
      });
      return;
    }

    if (!container) return;
    container.innerHTML = '<div class="welcome-page compact"><div class="welcome-section compact"><div class="welcome-title">已进入原家庭</div><div class="welcome-desc">当前家庭里还没有可用的宝宝档案，请先添加宝宝后再开始记录。</div><button class="btn-primary" onclick="UIToday.openAddBabyFlow()">去添加宝宝</button></div></div>';
  }

  var next = {};
  Object.keys(baseUIToday).forEach(function (key) {
    next[key] = baseUIToday[key];
  });
  next.render = render;
  return next;
})(UIToday);
