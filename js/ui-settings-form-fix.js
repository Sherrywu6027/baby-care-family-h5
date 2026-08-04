var UISettings = (function (baseUISettings) {
  function renderWelcome(container) {
    baseUISettings.renderWelcome(container);
    setTimeout(enhanceWelcomeForms, 0);
  }

  function enhanceWelcomeForms() {
    ensureFieldError('welcome-baby-name');
    ensureFieldError('welcome-baby-birthday');
    ensureFieldError('welcome-create-role');
    ensureFieldError('welcome-join-code');
    ensureFieldError('welcome-role');
    bindClearOnInput([
      'welcome-baby-name',
      'welcome-baby-birthday',
      'welcome-create-role',
      'welcome-join-code',
      'welcome-role'
    ]);
  }

  function createFamilyFromWelcome() {
    enhanceWelcomeForms();
    clearFormErrors(['welcome-baby-name', 'welcome-baby-birthday', 'welcome-create-role']);

    var name = getValue('welcome-baby-name').trim();
    var birthday = getValue('welcome-baby-birthday');
    var role = getValue('welcome-create-role').trim();

    if (!name) setFieldError('welcome-baby-name', '请填写宝宝小名');
    if (!birthday) setFieldError('welcome-baby-birthday', '请选择出生日期');
    if (!role) setFieldError('welcome-create-role', '请填写你的称呼');
    if (!name || !birthday || !role) return;

    baseUISettings.createFamilyFromWelcome();
  }

  function joinFamilyFromWelcome() {
    enhanceWelcomeForms();
    clearFormErrors(['welcome-join-code', 'welcome-role']);

    var code = getValue('welcome-join-code').trim();
    var role = getValue('welcome-role').trim();

    if (!/^\d{6}$/.test(code)) {
      setFieldError('welcome-join-code', '请输入 6 位家庭码');
      return;
    }
    if (!role) {
      setFieldError('welcome-role', '请填写你的称呼');
      return;
    }

    baseUISettings.joinFamilyFromWelcome();
  }

  function addBaby() {
    openBabyForm(null);
  }

  function editBaby(id) {
    DB.getBaby(id).then(function (baby) {
      openBabyForm(baby || null);
    });
  }

  function openBabyForm(baby) {
    var isEdit = !!baby;
    var current = baby || { name: '', birthday: '', avatar: '👶' };
    var avatars = ['👶', '🍼', '👧', '🧸', '🌙', '🎀', '👦'];
    var html = '<div class="modal-overlay" onclick="if(event.target===this)UIToday.closeModal()"><div class="modal-sheet">';
    html += '<div class="modal-handle"></div><div class="modal-title">' + (isEdit ? '编辑宝宝' : '添加宝宝') + '</div>';
    html += '<div class="form-group"><label class="form-label">头像</label><div style="display:flex;gap:8px;flex-wrap:wrap">';
    avatars.forEach(function (avatar) {
      var selected = current.avatar === avatar ? 'border:2px solid var(--primary);background:var(--c-sleep)' : '';
      html += '<button type="button" onclick="document.getElementById(\'baby-avatar\').value=\'' + avatar + '\';UISettings._selectAvatar(this)" style="font-size:1.5rem;padding:8px;border-radius:10px;' + selected + '" data-avatar="' + avatar + '">' + avatar + '</button>';
    });
    html += '</div><input type="hidden" id="baby-avatar" value="' + escapeAttr(current.avatar) + '"></div>';
    html += '<div class="form-group"><label class="form-label">小名</label><input type="text" class="form-input" id="baby-name" value="' + escapeAttr(current.name || '') + '" placeholder="如：豆豆"><div class="field-error" id="baby-name-error" aria-live="polite"></div></div>';
    html += '<div class="form-group"><label class="form-label">出生日期</label><input type="date" class="form-input" id="baby-birthday" value="' + escapeAttr(current.birthday || '') + '"><div class="field-error" id="baby-birthday-error" aria-live="polite"></div></div>';
    html += '<button class="btn-primary" onclick="UISettings.saveBaby(' + (isEdit ? '\'' + current.id + '\'' : 'null') + ')">保存</button>';
    if (isEdit) {
      html += '<button class="btn-danger" style="margin-top:8px" onclick="UISettings.deleteBaby(\'' + current.id + '\')">删除此宝宝</button>';
    }
    html += '</div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
    bindClearOnInput(['baby-name', 'baby-birthday']);
  }

  function saveBaby(id) {
    clearFormErrors(['baby-name', 'baby-birthday']);
    var name = getValue('baby-name').trim();
    var birthday = getValue('baby-birthday');

    if (!name) setFieldError('baby-name', '请填写宝宝小名');
    if (!birthday) setFieldError('baby-birthday', '请选择出生日期');
    if (!name || !birthday) return;

    baseUISettings.saveBaby(id);
  }

  function openEditMember(memberId) {
    Sync.listFamilyMembers().then(function (result) {
      var members = result && result.members ? result.members : [];
      var member = members.filter(function (item) { return item.id === memberId; })[0] || null;
      if (!member) {
        App.toast('未找到成员');
        return;
      }
      var html = '<div class="modal-overlay" onclick="if(event.target===this)UIToday.closeModal()"><div class="modal-sheet">';
      html += '<div class="modal-handle"></div><div class="modal-title">修改成员称呼</div>';
      html += '<div class="form-group"><label class="form-label">称呼</label><input type="text" class="form-input" id="member-display-name" value="' + escapeAttr(member.display_name || member.role || '') + '" placeholder="如：奶奶"><div class="field-error" id="member-display-name-error" aria-live="polite"></div></div>';
      html += '<button class="btn-primary" onclick="UISettings.saveMemberProfile(\'' + member.id + '\', \'' + escapeJs(member.auth_user || '') + '\')">保存</button>';
      html += '</div></div>';
      document.body.insertAdjacentHTML('beforeend', html);
      bindClearOnInput(['member-display-name']);
    });
  }

  function saveMemberProfile(memberId, memberAuthUser) {
    clearFormErrors(['member-display-name']);
    var title = getValue('member-display-name').trim();
    if (!title) {
      setFieldError('member-display-name', '请填写称呼');
      return;
    }
    baseUISettings.saveMemberProfile(memberId, memberAuthUser);
  }

  function finishJoinCreateBaby() {
    ensureFieldError('join-baby-name');
    ensureFieldError('join-baby-birthday');
    bindClearOnInput(['join-baby-name', 'join-baby-birthday']);
    clearFormErrors(['join-baby-name', 'join-baby-birthday']);

    var name = getValue('join-baby-name').trim();
    var birthday = getValue('join-baby-birthday');
    if (!name) setFieldError('join-baby-name', '请填写宝宝小名');
    if (!birthday) setFieldError('join-baby-birthday', '请选择出生日期');
    if (!name || !birthday) return;

    baseUISettings.finishJoinCreateBaby();
  }

  function ensureFieldError(id) {
    var input = document.getElementById(id);
    if (!input || !input.parentNode) return;
    if (document.getElementById(id + '-error')) return;
    var error = document.createElement('div');
    error.className = 'field-error';
    error.id = id + '-error';
    error.setAttribute('aria-live', 'polite');
    input.parentNode.appendChild(error);
  }

  function setFieldError(id, message) {
    ensureFieldError(id);
    var input = document.getElementById(id);
    var error = document.getElementById(id + '-error');
    if (input) input.classList.add('input-error');
    if (error) error.textContent = message || '';
  }

  function clearFieldError(id) {
    var input = document.getElementById(id);
    var error = document.getElementById(id + '-error');
    if (input) input.classList.remove('input-error');
    if (error) error.textContent = '';
  }

  function clearFormErrors(ids) {
    (ids || []).forEach(clearFieldError);
  }

  function bindClearOnInput(ids) {
    (ids || []).forEach(function (id) {
      var input = document.getElementById(id);
      if (!input || input.dataset.fieldErrorBound === '1') return;
      input.dataset.fieldErrorBound = '1';
      input.addEventListener('input', function () {
        clearFieldError(id);
      });
      input.addEventListener('change', function () {
        clearFieldError(id);
      });
    });
  }

  function getValue(id) {
    var el = document.getElementById(id);
    return el ? String(el.value || '') : '';
  }

  function escapeAttr(value) {
    return String(value || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  function escapeJs(value) {
    return String(value || '').replace(/\\/g, '\\\\').replace(/'/g, '\\\'');
  }

  var next = {};
  Object.keys(baseUISettings).forEach(function (key) {
    next[key] = baseUISettings[key];
  });
  next.renderWelcome = renderWelcome;
  next.createFamilyFromWelcome = createFamilyFromWelcome;
  next.joinFamilyFromWelcome = joinFamilyFromWelcome;
  next.addBaby = addBaby;
  next.editBaby = editBaby;
  next.saveBaby = saveBaby;
  next.openEditMember = openEditMember;
  next.saveMemberProfile = saveMemberProfile;
  next.finishJoinCreateBaby = finishJoinCreateBaby;
  return next;
})(UISettings);
