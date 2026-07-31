var UISettings = (function (BaseUISettings) {
  var pendingConfirmAction = null;
  var pendingAfterResult = null;

  function signOut() {
    openConfirmSheet({
      title: '退出登录',
      message: '这只会退出当前账号，不会删除本机记录。下次可以重新登录后继续使用。',
      confirmText: '退出登录',
      danger: true,
      onConfirm: function () {
        openBusySheet('正在退出登录...');
        return Sync.signOut().then(function (result) {
          closeBusySheet();
          if (!result || !result.success) {
            openResultSheet({
              title: '退出失败',
              message: result && result.error ? result.error : '退出登录失败，请稍后重试。',
              danger: true
            });
            return;
          }
          openResultSheet({
            title: '已退出登录',
            message: '当前账号已退出，页面会回到登录页。',
            buttonText: '返回登录',
            onClose: function () {
              App.navigate('login');
              App.renderPage();
            }
          });
        });
      }
    });
  }

  function leaveFamily() {
    openConfirmSheet({
      title: '退出当前家庭',
      message: '退出后，你将无法继续查看和同步这个家庭的数据。',
      confirmText: '退出当前家庭',
      danger: true,
      onConfirm: function () {
        openBusySheet('正在退出家庭...');
        return Sync.leaveFamily().then(function (result) {
          closeBusySheet();
          if (!result || !result.success) {
            openResultSheet({
              title: '退出失败',
              message: result && result.error ? result.error : '退出家庭失败，请稍后重试。',
              danger: true
            });
            return;
          }
          return DB.setLastSyncAt(null).catch(function () {
            return null;
          }).then(function () {
            openResultSheet({
              title: '已退出当前家庭',
              message: '页面将回到家庭选择页。',
              buttonText: '继续',
              onClose: function () {
                App.navigate('welcome');
                App.renderPage();
              }
            });
          });
        });
      }
    });
  }

  function removeMember(memberId) {
    resolveMemberName(memberId).then(function (memberName) {
      openConfirmSheet({
        title: '移除成员',
        message: '确认移除“' + memberName + '”吗？移除后，对方将无法继续访问当前家庭。',
        confirmText: '移除成员',
        danger: true,
        onConfirm: function () {
          openBusySheet('正在移除成员...');
          return Sync.removeFamilyMember(memberId).then(function (result) {
            closeBusySheet();
            if (!result || !result.success) {
              openResultSheet({
                title: '移除失败',
                message: result && result.error ? result.error : '移除成员失败，请稍后重试。',
                danger: true
              });
              return;
            }
            openResultSheet({
              title: '已移除成员',
              message: '成员已从当前家庭中移除。',
              buttonText: '知道了',
              onClose: function () {
                App.renderPage();
              }
            });
          });
        }
      });
    });
  }

  function transferCreator(memberId) {
    resolveMemberName(memberId).then(function (memberName) {
      openConfirmSheet({
        title: '转让创建者',
        message: '确认把家庭创建者身份转给“' + memberName + '”吗？转让后，该成员将拥有家庭管理权限。',
        confirmText: '确认转让',
        danger: false,
        onConfirm: function () {
          openBusySheet('正在转让创建者...');
          return Sync.transferFamilyCreator(memberId).then(function (result) {
            closeBusySheet();
            if (!result || !result.success) {
              openResultSheet({
                title: '转让失败',
                message: result && result.error ? result.error : '转让创建者失败，请稍后重试。',
                danger: true
              });
              return;
            }
            openResultSheet({
              title: '已完成转让',
              message: '家庭创建者身份已更新。',
              buttonText: '刷新页面',
              onClose: function () {
                App.renderPage();
              }
            });
          });
        }
      });
    });
  }

  function deleteBaby(id) {
    var card = document.querySelector('.baby-card[data-baby-id="' + escapeSelector(id) + '"]');
    var babyName = card && card.querySelector('.bi-name')
      ? String(card.querySelector('.bi-name').textContent || '').trim()
      : '这个宝宝';

    openConfirmSheet({
      title: '删除宝宝',
      message: '删除“' + babyName + '”后，相关记录也会一起隐藏。这个操作会同步到家庭数据。',
      confirmText: '确认删除',
      danger: true,
      onConfirm: function () {
        if (card) {
          card.style.transition = 'opacity .18s ease, transform .18s ease, filter .18s ease';
          card.style.opacity = '0.42';
          card.style.transform = 'scale(.985)';
          card.style.filter = 'grayscale(.15)';
          card.style.pointerEvents = 'none';
        }

        UIToday.closeModal();
        openBusySheet('正在删除宝宝...');

        return DB.deleteBaby(id).then(function () {
          return DB.getMeta('currentBabyId');
        }).then(function (currentBabyId) {
          if (currentBabyId !== id) return null;
          return DB.getBabies().then(function (babies) {
            var nextBaby = (babies || [])[0] || null;
            return DB.setMeta('currentBabyId', nextBaby ? nextBaby.id : null);
          });
        }).then(function () {
          return Sync.sync({ silent: true }).catch(function () {
            return null;
          });
        }).then(function () {
          closeBusySheet();
          openResultSheet({
            title: '已删除宝宝',
            message: '宝宝资料和相关记录已更新。',
            buttonText: '知道了',
            autoCloseMs: 700,
            onClose: function () {
              App.renderPage();
            }
          });
        }).catch(function (error) {
          closeBusySheet();
          if (card) {
            card.style.opacity = '';
            card.style.transform = '';
            card.style.filter = '';
            card.style.pointerEvents = '';
          }
          openResultSheet({
            title: '删除失败',
            message: error && error.message ? error.message : '删除宝宝失败，请稍后重试。',
            danger: true
          });
        });
      }
    });
  }

  function openConfirmSheet(options) {
    closeConfirmSheet();
    options = options || {};
    pendingConfirmAction = typeof options.onConfirm === 'function' ? options.onConfirm : null;
    var btnClass = options.danger ? 'btn-danger' : 'btn-primary';
    var overlayClass = 'modal-overlay settings-confirm-overlay' + (options.danger ? ' is-danger' : '');
    var html = '<div class="' + overlayClass + '" onclick="if(event.target===this)UISettings.closeConfirmSheet()"><div class="modal-sheet">';
    html += '<div class="modal-handle"></div>';
    html += '<div class="modal-title">' + escapeHtml(options.title || '请确认') + '</div>';
    html += '<div class="welcome-desc" style="margin-bottom:16px">' + escapeHtml(options.message || '') + '</div>';
    html += '<div style="display:flex;flex-direction:column;gap:8px">';
    html += '<button class="' + btnClass + '" onclick="UISettings._confirmSheetProceed()">' + escapeHtml(options.confirmText || '继续') + '</button>';
    html += '<button class="btn-secondary" onclick="UISettings.closeConfirmSheet()">取消</button>';
    html += '</div></div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
  }

  function closeConfirmSheet() {
    pendingConfirmAction = null;
    var overlay = document.querySelector('.modal-overlay.settings-confirm-overlay');
    if (overlay) overlay.remove();
  }

  function _confirmSheetProceed() {
    var action = pendingConfirmAction;
    closeConfirmSheet();
    if (!action) return;
    Promise.resolve().then(action).catch(function (error) {
      closeBusySheet();
      openResultSheet({
        title: '操作失败',
        message: error && error.message ? error.message : '操作失败，请稍后重试。',
        danger: true
      });
    });
  }

  function openBusySheet(message) {
    closeBusySheet();
    var html = '<div class="modal-overlay settings-busy-overlay"><div class="modal-sheet">';
    html += '<div class="modal-handle"></div>';
    html += '<div class="modal-title">请稍候</div>';
    html += '<div class="welcome-desc" style="margin-bottom:0">' + escapeHtml(message || '正在处理...') + '</div>';
    html += '</div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
  }

  function closeBusySheet() {
    var overlay = document.querySelector('.modal-overlay.settings-busy-overlay');
    if (overlay) overlay.remove();
  }

  function openResultSheet(options) {
    closeResultSheet();
    options = options || {};
    pendingAfterResult = typeof options.onClose === 'function' ? options.onClose : null;
    var btnClass = options.danger ? 'btn-danger' : 'btn-primary';
    var overlayClass = 'modal-overlay settings-action-result-overlay' + (options.danger ? ' is-danger' : '');
    var html = '<div class="' + overlayClass + '" onclick="if(event.target===this)UISettings.closeActionResultSheet()"><div class="modal-sheet">';
    html += '<div class="modal-handle"></div>';
    html += '<div class="modal-title">' + escapeHtml(options.title || '操作结果') + '</div>';
    html += '<div class="welcome-desc" style="margin-bottom:16px">' + escapeHtml(options.message || '') + '</div>';
    html += '<button class="' + btnClass + '" onclick="UISettings.closeActionResultSheet()">' + escapeHtml(options.buttonText || '知道了') + '</button>';
    html += '</div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
    if (options.autoCloseMs && Number(options.autoCloseMs) > 0) {
      window.setTimeout(function () {
        var overlay = document.querySelector('.modal-overlay.settings-action-result-overlay');
        if (overlay) UISettings.closeActionResultSheet();
      }, Number(options.autoCloseMs));
    }
  }

  function closeResultSheet() {
    var overlay = document.querySelector('.modal-overlay.settings-action-result-overlay');
    if (overlay) overlay.remove();
  }

  function closeActionResultSheet() {
    var onClose = pendingAfterResult;
    pendingAfterResult = null;
    closeResultSheet();
    if (onClose) onClose();
  }

  function resolveMemberName(memberId) {
    return Sync.listFamilyMembers().then(function (result) {
      var members = result && result.members ? result.members : [];
      var member = members.filter(function (item) {
        return item.id === memberId;
      })[0] || null;
      return member && (member.display_name || member.role) ? (member.display_name || member.role) : '该成员';
    }).catch(function () {
      return '该成员';
    });
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeSelector(value) {
    return String(value || '').replace(/"/g, '\\"');
  }

  var next = {};
  Object.keys(BaseUISettings).forEach(function (key) {
    next[key] = BaseUISettings[key];
  });
  next.signOut = signOut;
  next.leaveFamily = leaveFamily;
  next.removeMember = removeMember;
  next.transferCreator = transferCreator;
  next.deleteBaby = deleteBaby;
  next.openConfirmSheet = openConfirmSheet;
  next.closeConfirmSheet = closeConfirmSheet;
  next._confirmSheetProceed = _confirmSheetProceed;
  next.openBusySheet = openBusySheet;
  next.closeBusySheet = closeBusySheet;
  next.openResultSheet = openResultSheet;
  next.closeResultSheet = closeResultSheet;
  next.closeActionResultSheet = closeActionResultSheet;
  return next;
})(UISettings);
