var UISettings = (function (BaseUISettings) {
  function manualSync() {
    if (!(window.UISettings && UISettings.openResultSheet)) {
      BaseUISettings.manualSync();
      return;
    }

    UISettings.openBusySheet('正在同步家庭数据...');
    Sync.sync().then(function (result) {
      UISettings.closeBusySheet();
      App.renderPage();
      if (result && result.error) {
        UISettings.openResultSheet({
          title: '同步失败',
          message: result.error || '同步失败，请稍后重试。',
          danger: true
        });
        return;
      }
      UISettings.openResultSheet({
        title: '同步完成',
        message: '当前设备上的最新数据已经刷新。',
        buttonText: '知道了',
        autoCloseMs: 900
      });
    }).catch(function (error) {
      UISettings.closeBusySheet();
      UISettings.openResultSheet({
        title: '同步失败',
        message: error && error.message ? error.message : '同步失败，请稍后重试。',
        danger: true
      });
    });
  }

  function exportData() {
    if (!(window.UISettings && UISettings.openResultSheet)) {
      BaseUISettings.exportData();
      return;
    }

    UISettings.openBusySheet('正在导出数据...');
    DB.exportAll().then(function (data) {
      var json = JSON.stringify(data, null, 2);
      var blob = new Blob([json], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url;
      link.download = 'babycare-backup-' + new Date().toISOString().slice(0, 10) + '.json';
      link.click();
      URL.revokeObjectURL(url);
      UISettings.closeBusySheet();
      UISettings.openResultSheet({
        title: '导出完成',
        message: '备份文件已经开始下载。',
        buttonText: '知道了',
        autoCloseMs: 900
      });
    }).catch(function (error) {
      UISettings.closeBusySheet();
      UISettings.openResultSheet({
        title: '导出失败',
        message: error && error.message ? error.message : '导出失败，请稍后重试。',
        danger: true
      });
    });
  }

  function importData(event) {
    var file = event && event.target ? event.target.files[0] : null;
    if (!file) return;

    if (!(window.UISettings && UISettings.openResultSheet)) {
      BaseUISettings.importData(event);
      return;
    }

    UISettings.openBusySheet('正在导入备份...');
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var data = JSON.parse(e.target.result);
        if (!data.babies || !data.events) throw new Error('invalid_backup');
        DB.importAll(data).then(function () {
          UISettings.closeBusySheet();
          UISettings.openResultSheet({
            title: '导入成功',
            message: '备份数据已恢复，页面将刷新显示最新内容。',
            buttonText: '刷新页面',
            onClose: function () {
              App.renderPage();
            }
          });
        }).catch(function (error) {
          UISettings.closeBusySheet();
          UISettings.openResultSheet({
            title: '导入失败',
            message: error && error.message ? error.message : '导入失败，请稍后重试。',
            danger: true
          });
        });
      } catch (err) {
        UISettings.closeBusySheet();
        UISettings.openResultSheet({
          title: '导入失败',
          message: '备份文件格式不正确。',
          danger: true
        });
      }
      if (event.target) event.target.value = '';
    };
    reader.readAsText(file);
  }

  var next = {};
  Object.keys(BaseUISettings).forEach(function (key) {
    next[key] = BaseUISettings[key];
  });
  next.manualSync = manualSync;
  next.exportData = exportData;
  next.importData = importData;
  return next;
})(UISettings);

var UIToday = (function (BaseToday) {
  function savePump() {
    BaseToday.savePump();
    deferToastToResult('已记录吸奶');
  }

  function saveDirectManual() {
    BaseToday.saveDirectManual();
    deferToastToResult('已记录亲喂');
  }

  function saveRecord(type) {
    BaseToday.saveRecord(type);
    if (type === 'weight') {
      deferToastToResult('已记录成长数据');
    }
  }

  function stopTimer(type) {
    BaseToday.stopTimer(type);
    if (type === 'milk_direct') {
      deferToastToResult('已记录亲喂');
    } else if (type === 'sleep' || type === 'pump') {
      // `pump` has its own result modal first; no extra sheet here.
      if (type === 'sleep') deferToastToResult('已记录计时');
    }
  }

  function deferToastToResult(message) {
    if (!(window.UISettings && UISettings.openResultSheet)) return;
    window.setTimeout(function () {
      var modalStillOpen = document.querySelector('.modal-overlay');
      if (modalStillOpen) return;
      UISettings.openResultSheet({
        title: '保存成功',
        message: message,
        buttonText: '知道了',
        autoCloseMs: 700
      });
    }, 60);
  }

  var next = {};
  Object.keys(BaseToday).forEach(function (key) {
    next[key] = BaseToday[key];
  });
  next.savePump = savePump;
  next.saveDirectManual = saveDirectManual;
  next.saveRecord = saveRecord;
  next.stopTimer = stopTimer;
  return next;
})(UIToday);
