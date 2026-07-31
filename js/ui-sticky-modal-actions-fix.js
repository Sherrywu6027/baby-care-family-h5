;(function () {
  function isManagedOverlay(overlay) {
    if (!overlay || !overlay.classList) return false;
    return !(
      overlay.classList.contains('settings-confirm-overlay') ||
      overlay.classList.contains('settings-busy-overlay') ||
      overlay.classList.contains('settings-action-result-overlay')
    );
  }

  function shouldEnhanceSheet(sheet) {
    if (!sheet) return false;
    if (sheet.dataset.stickyActionsBound === '1') return false;
    if (sheet.querySelectorAll('.form-group').length < 2) return false;
    var directButtons = getDirectActionButtons(sheet);
    return directButtons.length > 0;
  }

  function getDirectActionButtons(sheet) {
    return Array.prototype.slice.call(sheet.children).filter(function (child) {
      return child.tagName === 'BUTTON' &&
        (child.classList.contains('btn-primary') ||
         child.classList.contains('btn-secondary') ||
         child.classList.contains('btn-danger'));
    });
  }

  function enhanceSheet(sheet) {
    if (!shouldEnhanceSheet(sheet)) return;

    var buttons = getDirectActionButtons(sheet);
    if (!buttons.length) return;

    var actionBox = document.createElement('div');
    actionBox.className = 'modal-sticky-actions';

    buttons.forEach(function (button, index) {
      if (index > 0) button.style.marginTop = '';
      actionBox.appendChild(button);
    });

    sheet.appendChild(actionBox);
    sheet.classList.add('has-sticky-actions');
    sheet.dataset.stickyActionsBound = '1';
  }

  function scan() {
    var overlays = document.querySelectorAll('.modal-overlay');
    Array.prototype.forEach.call(overlays, function (overlay) {
      if (!isManagedOverlay(overlay)) return;
      var sheet = overlay.querySelector('.modal-sheet');
      if (sheet) enhanceSheet(sheet);
    });
  }

  var observer = new MutationObserver(function () {
    scan();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scan);
  } else {
    scan();
  }
})();
