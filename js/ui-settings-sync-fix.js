if (window.UISettings) {
  (function (UISettings) {
    function queueSync(reason) {
      setTimeout(function () {
        if (window.App && App.requestSync) App.requestSync(reason);
      }, 120);
    }

    function wrap(name, reason) {
      var original = UISettings[name];
      if (typeof original !== 'function') return;
      UISettings[name] = function () {
        var result = original.apply(this, arguments);
        queueSync(reason);
        return result;
      };
    }

    wrap('reviewJoinRequest', 'settings-review-join-request');
    wrap('removeMember', 'settings-remove-member');
    wrap('saveMemberProfile', 'settings-save-member-profile');
    wrap('transferCreator', 'settings-transfer-creator');
    wrap('leaveFamily', 'settings-leave-family');
    wrap('saveBaby', 'settings-save-baby');
    wrap('deleteBaby', 'settings-delete-baby');
  })(window.UISettings);
}
