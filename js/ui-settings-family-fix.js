var UISettings = (function (BaseUISettings) {
  function render(container) {
    Promise.all([
      Sync.getAuthState(),
      DB.getMeta('familyId'),
      DB.getMeta('familyCode')
    ]).then(function (values) {
      var authState = values[0] || { loggedIn: false };
      var familyId = values[1] || null;
      var familyCode = values[2] || null;
      if (authState.loggedIn && (!familyId || !familyCode)) {
        return Sync.restoreFamilyContext({ silent: true }).catch(function () {
          return null;
        }).then(function () {
          return BaseUISettings.render(container);
        });
      }
      return BaseUISettings.render(container);
    });
  }

  function addBaby() {
    ensureFamilyReady().then(function (ready) {
      if (!ready) return;
      BaseUISettings.addBaby();
    });
  }

  function editBaby(id) {
    ensureFamilyReady().then(function (ready) {
      if (!ready) return;
      BaseUISettings.editBaby(id);
    });
  }

  function saveBaby(id) {
    ensureFamilyReady().then(function (ready) {
      if (!ready) return;
      BaseUISettings.saveBaby(id);
    });
  }

  function ensureFamilyReady() {
    return Promise.all([
      Sync.getAuthState(),
      DB.getMeta('familyId'),
      DB.getMeta('familyCode')
    ]).then(function (values) {
      var authState = values[0] || { loggedIn: false };
      var familyId = values[1] || null;
      var familyCode = values[2] || null;
      if (!authState.loggedIn) {
        App.toast('请先登录');
        App.navigate('login');
        App.renderPage();
        return false;
      }
      if (familyId && familyCode) return true;
      return Sync.restoreFamilyContext({ silent: true }).then(function (result) {
        if (result && result.hasFamily) return true;
        App.toast('当前没有恢复到家庭，请先重新进入家庭');
        App.navigate('welcome');
        App.renderPage();
        return false;
      }).catch(function () {
        App.toast('当前没有恢复到家庭，请先重新进入家庭');
        App.navigate('welcome');
        App.renderPage();
        return false;
      });
    });
  }

  var next = {};
  Object.keys(BaseUISettings).forEach(function (key) {
    next[key] = BaseUISettings[key];
  });
  next.render = render;
  next.addBaby = addBaby;
  next.editBaby = editBaby;
  next.saveBaby = saveBaby;
  return next;
})(UISettings);
