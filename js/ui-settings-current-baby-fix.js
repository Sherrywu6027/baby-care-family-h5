var UISettings = (function (BaseUISettings) {
  function render(container) {
    BaseUISettings.render(container);
  }

  function injectCurrentBabyCard(container) {
    if (!container) return;
    if (container.querySelector('.settings-current-baby')) return;

    Promise.all([
      DB.getBabies(),
      DB.getMeta('currentBabyId')
    ]).then(function (values) {
      var babies = values[0] || [];
      var currentBabyId = values[1] || null;
      var currentBaby = findCurrentBaby(babies, currentBabyId);

      var group = findBabyGroup(container);
      if (!group) return;

      var card = document.createElement('div');
      card.className = 'settings-item settings-current-baby';
      card.style.gap = '12px';
      card.style.alignItems = 'center';
      card.style.background = 'linear-gradient(180deg, rgba(99,102,241,.06), rgba(99,102,241,.02))';
      card.innerHTML = buildCurrentBabyHtml(currentBaby);
      group.insertBefore(card, group.firstChild);
    }).catch(function () {
      return null;
    });
  }

  function findBabyGroup(container) {
    var groups = container.querySelectorAll('.settings-group');
    return Array.prototype.slice.call(groups).filter(function (group) {
      return !!group.querySelector('.baby-card, [onclick*="UISettings.addBaby"]');
    })[0] || null;
  }

  function findCurrentBaby(babies, currentBabyId) {
    babies = babies || [];
    if (!currentBabyId) return babies[0] || null;
    return babies.filter(function (baby) {
      return baby && baby.id === currentBabyId;
    })[0] || babies[0] || null;
  }

  function buildCurrentBabyHtml(currentBaby) {
    var avatar = currentBaby && currentBaby.avatar ? currentBaby.avatar : '馃嵓';
    var name = currentBaby && currentBaby.name ? currentBaby.name : '还没有选中宝宝';
    var subtitle = currentBaby
      ? formatBabySubtitle(currentBaby)
      : '首页、记录和统计会跟随这里显示的宝宝';

    var html = '';
    html += '<div class="baby-avatar" style="flex:0 0 auto">' + escapeHtml(avatar) + '</div>';
    html += '<div style="flex:1;min-width:0">';
    html += '<div class="si-label" style="font-weight:700">当前正在查看的宝宝</div>';
    html += '<div style="margin-top:4px;font-size:.92rem;font-weight:700;color:var(--text)">' + escapeHtml(name) + '</div>';
    html += '<div class="ti-detail" style="margin-top:4px">' + escapeHtml(subtitle) + '</div>';
    html += '</div>';
    return html;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  var next = {};
  Object.keys(BaseUISettings).forEach(function (key) {
    next[key] = BaseUISettings[key];
  });
  next.render = render;
  return next;
})(UISettings);
