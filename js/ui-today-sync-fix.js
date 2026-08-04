if (window.UIToday) {
  (function (UIToday) {
    function queueSync(reason) {
      setTimeout(function () {
        if (window.App && App.requestSync) App.requestSync(reason);
      }, 80);
    }

    var originalSaveRecord = UIToday.saveRecord;
    UIToday.saveRecord = function (type) {
      originalSaveRecord(type);
      setTimeout(function () {
        window.dispatchEvent(new CustomEvent('baby-today-record-saved'));
      }, 60);
      queueSync('today-save-record');
    };

    var originalSavePump = UIToday.savePump;
    UIToday.savePump = function () {
      originalSavePump();
      setTimeout(function () {
        window.dispatchEvent(new CustomEvent('baby-today-record-saved'));
      }, 60);
      queueSync('today-save-pump');
    };

    var originalSaveDirectManual = UIToday.saveDirectManual;
    UIToday.saveDirectManual = function () {
      originalSaveDirectManual();
      setTimeout(function () {
        window.dispatchEvent(new CustomEvent('baby-today-record-saved'));
      }, 60);
      queueSync('today-save-direct-manual');
    };

    var originalStopTimer = UIToday.stopTimer;
    UIToday.stopTimer = function (type) {
      originalStopTimer(type);
      setTimeout(function () {
        window.dispatchEvent(new CustomEvent('baby-today-record-saved'));
      }, 60);
      queueSync('today-stop-timer-' + String(type || 'unknown'));
    };
  })(window.UIToday);
}
