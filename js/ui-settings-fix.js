var UISettings = (function () {
  function render(container) {
    Promise.all([
      DB.getBabies(),
      DB.getMeta('currentBabyId'),
      DB.getMeta('homeButtons'),
      DB.getMeta('familyCode'),
      Sync.listPendingJoinRequests(),
      Sync.listFamilyMembers(),
      DB.getMeta('authUserId')
    ]).then(function (results) {
      var babies = results[0] || [];
      var currentBabyId = results[1] || null;
      var buttons = results[2] || DEFAULT_HOME_BUTTONS;
      var familyCode = results[3];
      var pendingRequests = results[4] || [];
      var memberState = results[5] || { success: true, members: [] };
      var authUserId = results[6] || null;
      var members = memberState.members || [];
      var currentMember = findCurrentMember(members, authUserId);
      var isCreator = !!(currentMember && currentMember.is_creator);
      var html = '';

      html += '<div class="log-header"><h2 style="font-size:1.2rem">璁剧疆</h2></div>';

      html += '<div class="settings-section-title">瀹濆疂妗ｆ</div>';
      html += '<div class="settings-group">';
      babies.forEach(function (baby) {
        var isCurrentBaby = !!(currentBabyId && baby.id === currentBabyId) || (!currentBabyId && babies[0] && babies[0].id === baby.id);
        html += '<div class="baby-card" data-baby-id="' + baby.id + '" onclick="UISettings.editBaby(\'' + baby.id + '\')" style="cursor:pointer;' + (isCurrentBaby ? 'background:linear-gradient(180deg, rgba(99,102,241,.045), rgba(99,102,241,.015));box-shadow:inset 0 0 0 1px rgba(99,102,241,.10);' : '') + '">';
        html += '<div class="baby-avatar">' + escapeHtml(baby.avatar || '馃嵓') + '</div>';
        html += '<div class="baby-info" style="flex:1">';
        html += '<div class="bi-name">' + escapeHtml(baby.name || '瀹濆疂') + (isCurrentBaby ? '<span style="display:inline-flex;align-items:center;margin-left:8px;padding:1px 7px;border-radius:999px;background:rgba(99,102,241,.08);color:rgba(79,70,229,.82);font-size:.68rem;font-weight:600;letter-spacing:.01em;vertical-align:middle">当前查看中</span>' : '') + '</div>';
        html += '<div class="bi-birthday">' + escapeHtml(formatBabySubtitle(baby)) + '</div>';
        html += '</div><span class="si-arrow">鈥?/span></div>';
      });
      html += '<div class="settings-item" onclick="UISettings.addBaby()" style="cursor:pointer;justify-content:center;color:var(--primary);font-weight:600">+ 娣诲姞瀹濆疂</div>';
      html += '</div>';

      html += '<div class="settings-section-title">棣栭〉鎸夐挳</div>';
      html += '<div class="settings-group">';
      Object.keys(EVENT_TYPES).forEach(function (key) {
        var eventType = EVENT_TYPES[key];
        var active = buttons.indexOf(key) >= 0;
        html += '<div class="settings-item">';
        html += '<div class="si-label">' + escapeHtml(eventType.icon + ' ' + eventType.label) + '</div>';
        html += '<label class="switch"><input type="checkbox" ' + (active ? 'checked' : '') + ' onchange="UISettings.toggleButton(\'' + key + '\', this.checked)"><span class="slider"></span></label>';
        html += '</div>';
      });
      html += '</div>';

      html += '<div class="settings-section-title">瀹跺涵鍏变韩</div>';
      html += '<div class="settings-group">';
      html += renderSyncStatusBlock();
      html += '<div class="settings-item" onclick="UISettings.manualSync()" style="cursor:pointer;color:var(--primary);font-weight:600">绔嬪嵆鍚屾</div>';
      if (familyCode) {
        html += '<div class="settings-item"><div class="si-label">瀹跺涵鐮?/div><div class="si-value" style="font-weight:700;letter-spacing:2px">' + escapeHtml(familyCode) + '</div></div>';
        html += '<div class="settings-item" onclick="UISettings.copyFamilyCode()" style="cursor:pointer;color:var(--primary);font-weight:600">澶嶅埗瀹跺涵鐮?/div>';
      } else {
        html += '<div class="settings-item" onclick="UISettings.createFamilyLocal()" style="cursor:pointer;color:var(--primary);font-weight:600">鐢熸垚瀹跺涵鐮?/div>';
      }
      html += '<div class="settings-item" onclick="UISettings.joinFamily()" style="cursor:pointer;color:var(--primary);font-weight:600">杈撳叆瀹跺涵鐮佸姞鍏?/div>';
      html += '</div>';

      if (familyCode) {
        html += '<div class="settings-section-title">鎴愬憳绠＄悊</div>';
        html += '<div class="settings-group">';
        if (!Sync.isConfigured()) {
          html += '<div class="settings-item" style="display:block">';
          html += '<div class="si-label">褰撳墠涓烘湰鍦版ā寮?/div>';
          html += '<div class="ti-detail" style="margin-top:6px">鎴愬憳绠＄悊闇€瑕佹帴鍏?Supabase 鍚庝娇鐢ㄣ€?/div>';
          html += '</div>';
        } else if (!memberState.success) {
          html += '<div class="settings-item" style="display:block">';
          html += '<div class="si-label">鎴愬憳鍒楄〃鍔犺浇澶辫触</div>';
          html += '<div class="ti-detail" style="margin-top:6px">' + escapeHtml(memberState.error || '请稍后重试') + '</div>';
          html += '</div>';
        } else if (members.length === 0) {
          html += '<div class="settings-item" style="display:block"><div class="si-label">鏆傛棤鎴愬憳</div></div>';
        } else {
          members.forEach(function (member) {
            html += renderMemberItem(member, authUserId, isCreator);
          });
        }
        html += '</div>';

        if (currentMember) {
          html += '<div class="settings-section-title">瀹跺涵鎿嶄綔</div>';
          html += '<div class="settings-group">';
          html += '<div class="settings-item" onclick="UISettings.openEditMember(\'' + currentMember.id + '\')" style="cursor:pointer"><div class="si-label">淇敼鎴戠殑绉板懠</div><span class="si-arrow">鈥?/span></div>';
          html += '<div class="settings-item" onclick="UISettings.leaveFamily()" style="cursor:pointer;color:var(--danger);font-weight:700">閫€鍑哄綋鍓嶅搴紙璋ㄦ厧锛?/div>';
          html += '</div>';
        }
      }

      if (pendingRequests.length > 0) {
        html += '<div class="settings-section-title">鍔犲叆瀹℃牳</div>';
        html += '<div class="settings-group">';
        pendingRequests.forEach(function (request) {
          html += '<div class="settings-item" style="display:block">';
          html += '<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">';
          html += '<div>';
          html += '<div class="si-label" style="font-weight:700">' + escapeHtml(request.display_name || request.role || '???') + '</div>';
          html += '<div class="ti-detail" style="margin-top:6px">???' + escapeHtml(request.display_name || request.role || '???') + '</div>';
          html += '<div class="ti-detail">???' + escapeHtml(formatJoinRequesterAccount(request)) + '</div>';
          html += '<div class="ti-detail">?????' + escapeHtml(formatDateTime(request.created_at)) + '</div>';
          html += '</div>';
          html += '<div style="display:flex;gap:8px;flex-shrink:0">';
          html += '<button class="btn-secondary" style="padding:8px 12px" onclick="UISettings.reviewJoinRequest(\'' + request.id + '\', \'reject\')">鎷掔粷</button>';
          html += '<button class="btn-primary" style="padding:8px 12px" onclick="UISettings.reviewJoinRequest(\'' + request.id + '\', \'approve\')">鍚屾剰</button>';
          html += '</div></div></div>';
        });
        html += '</div>';
      }

      html += '<div class="settings-section-title">澶囦唤</div>';
      html += '<div class="settings-group">';
      html += '<div class="settings-item" onclick="UISettings.exportData()" style="cursor:pointer"><div class="si-label">瀵煎嚭鍏ㄩ儴鏁版嵁</div><span class="si-arrow">鈥?/span></div>';
      html += '<div class="settings-item" onclick="document.getElementById(\'import-file\').click()" style="cursor:pointer"><div class="si-label">瀵煎叆澶囦唤</div><span class="si-arrow">鈥?/span></div>';
      html += '</div>';
      html += '<input type="file" id="import-file" accept=".json" style="display:none" onchange="UISettings.importData(event)">';

      container.innerHTML = html;
    });
  }

  function renderWelcome(container) {
    Promise.all([
      DB.getMeta('pendingJoinCode'),
      DB.getMeta('pendingJoinRequestedAt')
    ]).then(function (meta) {
      var pendingJoinCode = meta[0];
      var pendingJoinRequestedAt = meta[1];
      if (pendingJoinCode && Sync.isConfigured()) {
        return Sync.getJoinRequestStatus(pendingJoinCode).then(function (state) {
          if (state && state.success && state.status === 'approved' && state.request) {
            container.innerHTML = '<div class="welcome-page compact"><div class="welcome-section compact"><div class="welcome-title">鍔犲叆宸查€氳繃</div><div class="welcome-desc">姝ｅ湪鍚屾瀹跺涵鏁版嵁锛岃绋嶅€欍€?/div></div></div>';
            return finishApprovedJoin(state.request);
          }
          renderWelcomeContent(container, pendingJoinCode, pendingJoinRequestedAt, state);
          return null;
        });
      }
      renderWelcomeContent(container, pendingJoinCode, pendingJoinRequestedAt, null);
      return null;
    });
  }

  function renderWelcomeContent(container, pendingJoinCode, pendingJoinRequestedAt, joinState) {
    var html = '<div class="welcome-page compact">';
    html += '<div class="welcome-hero compact"><div class="welcome-badge">馃嵓 瀹濆疂鐓ф姢璁板綍</div><h1>绗?2 姝ワ細閫夋嫨浣犺杩涘叆鐨勫搴?/h1><p>鑰佺敤鎴蜂細鑷姩鍥炲埌鍘熷搴€傚彧鏈夊綋鍓嶈处鍙疯繕娌℃湁鍔犲叆浠讳綍瀹跺涵鏃讹紝鎵嶉渶瑕佸湪杩欓噷鍒涘缓鎴栧姞鍏ュ搴€?/p></div>';

    if (pendingJoinCode) {
      html += renderPendingJoinBlock(pendingJoinCode, pendingJoinRequestedAt, joinState);
    }

    html += '<div class="welcome-section compact" style="border:1px solid rgba(99,102,241,.18);background:linear-gradient(180deg, rgba(99,102,241,.08), rgba(99,102,241,.02));box-shadow:0 10px 24px rgba(99,102,241,.08)">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px">';
    html += '<div class="welcome-title" style="margin:0">鏂规 A锛氭垜鏄涓€涓娇鐢ㄧ殑浜?/div>';
    html += '<div style="padding:4px 10px;border-radius:999px;background:rgba(99,102,241,.12);color:var(--primary-dark);font-size:.78rem;font-weight:700">鍒涘缓瀹跺涵</div>';
    html += '</div>';
    html += '<div class="welcome-desc">鍒涘缓涓€涓柊瀹跺涵銆傚垱寤哄畬鎴愬悗浼氱敓鎴?6 浣嶅搴爜锛屽浜虹敤杩欎釜瀹跺涵鐮佺敵璇峰姞鍏ャ€?/div>';
    html += '<div class="form-row compact-row">';
    html += '<div class="form-group"><label class="form-label">瀹濆疂灏忓悕</label><input type="text" class="form-input" id="welcome-baby-name" placeholder="濡傦細璞嗚眴"><div class="field-error" id="welcome-baby-name-error" aria-live="polite"></div></div>';
    html += '<div class="form-group"><label class="form-label">鍑虹敓鏃ユ湡</label><input type="date" class="form-input" id="welcome-baby-birthday"><div class="field-error" id="welcome-baby-birthday-error" aria-live="polite"></div></div>';
    html += '</div>';
    html += '<div class="form-group compact-group"><label class="form-label">浣犵殑绉板懠</label>';
    html += renderRoleChips('UISettings.pickCreateRole');
    html += '<input type="text" class="form-input" id="welcome-create-role" placeholder="涔熷彲鑷畾涔夛紝濡傦細澶栧﹩" oninput="UISettings.inputCreateRole(this)"><div class="field-error" id="welcome-create-role-error" aria-live="polite"></div></div>';
    html += '<button class="btn-primary" onclick="UISettings.createFamilyFromWelcome()">鍒涘缓鏂板搴?/button>';
    html += '<div class="welcome-desc" style="margin-top:10px">閫傜敤鍦烘櫙锛氫綘鏄疂瀹濊褰曠殑鍙戣捣浜猴紝杩樻病鏈変换浣曞浜哄厛寤鸿繃瀹跺涵銆?/div>';
    html += '</div>';

    html += '<div class="welcome-divider compact"><span>濡傛灉涓嶆槸浣犲厛寮€濮?/span></div>';

    html += '<div class="welcome-section compact" style="border:1px solid rgba(16,185,129,.20);background:linear-gradient(180deg, rgba(16,185,129,.08), rgba(16,185,129,.02));box-shadow:0 10px 24px rgba(16,185,129,.07)">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px">';
    html += '<div class="welcome-title" style="margin:0">鏂规 B锛氬浜哄凡缁忓垱寤轰簡瀹跺涵</div>';
    html += '<div style="padding:4px 10px;border-radius:999px;background:rgba(16,185,129,.12);color:#047857;font-size:.78rem;font-weight:700">鍔犲叆瀹跺涵</div>';
    html += '</div>';
    html += '<div class="welcome-desc">杈撳叆瀹朵汉鍙戠粰浣犵殑 6 浣嶅搴爜銆傛彁浜ゅ悗浼氳繘鍏ュ緟瀹℃牳锛岄€氳繃鍚庝綘灏辫兘鐪嬪埌鍚屼竴浠藉搴褰曘€?/div>';
    html += '<div class="form-row compact-row join-row">';
    html += '<div class="form-group"><label class="form-label">6 浣嶅搴爜</label><input type="text" class="form-input welcome-code" id="welcome-join-code" maxlength="6" placeholder="濡傦細123456" value="' + escapeAttr(pendingJoinCode || '') + '"><div class="field-error" id="welcome-join-code-error" aria-live="polite"></div></div>';
    html += '<div class="form-group join-btn-wrap"><label class="form-label">&nbsp;</label><button class="btn-primary join-btn" onclick="UISettings.joinFamilyFromWelcome()">鐢宠鍔犲叆瀹跺涵</button></div>';
    html += '</div>';
    html += '<div class="form-group compact-group"><label class="form-label">浣犵殑绉板懠</label>';
    html += renderRoleChips('UISettings.pickRole');
    html += '<input type="text" class="form-input" id="welcome-role" placeholder="涔熷彲鑷畾涔夛紝濡傦細濂跺ザ" oninput="UISettings.inputJoinRole(this)"><div class="field-error" id="welcome-role-error" aria-live="polite"></div></div>';
    html += '<div class="welcome-desc" style="margin-top:10px">閫傜敤鍦烘櫙锛氬彟涓€浣嶅浜哄凡缁忓紑濮嬭褰曪紝浣犵幇鍦ㄥ彧鏄姞鍏ュ悓涓€涓搴€?/div>';
    html += '<div id="welcome-join-error"></div>';
    html += '</div>';

    html += '</div>';
    container.innerHTML = html;
  }

  function renderPendingJoinBlock(pendingJoinCode, pendingJoinRequestedAt, joinState) {
    var status = joinState && joinState.status ? joinState.status : 'pending';
    var title = '浣犵殑鍔犲叆鐢宠姝ｅ湪绛夊緟澶勭悊';
    var detail = '??? ' + escapeHtml(pendingJoinCode) + ' ???????????????????????????????';
    var accent = 'rgba(245,158,11,.16)';
    var accentText = '#b45309';
    var border = 'rgba(245,158,11,.24)';
    var shadow = 'rgba(245,158,11,.08)';

    if (status === 'rejected') {
      title = '杩欐鍔犲叆鐢宠鏈€氳繃';
      detail = '?????????????????????';
      accent = 'rgba(239,68,68,.14)';
      accentText = '#b91c1c';
      border = 'rgba(239,68,68,.22)';
      shadow = 'rgba(239,68,68,.08)';
    } else if (status === 'approved') {
      title = '鍔犲叆鐢宠宸查€氳繃';
      detail = '???????????';
      accent = 'rgba(16,185,129,.14)';
      accentText = '#047857';
      border = 'rgba(16,185,129,.22)';
      shadow = 'rgba(16,185,129,.08)';
    } else if (status === 'none') {
      title = '娌℃湁鎵惧埌鐢宠璁板綍';
      detail = '????????????????????';
      accent = 'rgba(107,114,128,.14)';
      accentText = '#374151';
      border = 'rgba(107,114,128,.20)';
      shadow = 'rgba(107,114,128,.07)';
    }

    var html = '<div class="welcome-section compact" style="border:1px solid ' + border + ';background:linear-gradient(180deg, ' + accent + ', rgba(255,255,255,.9));box-shadow:0 10px 24px ' + shadow + '">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px">';
    html += '<div class="welcome-title" style="margin:0">' + title + '</div>';
    html += '<div style="padding:4px 10px;border-radius:999px;background:' + accent + ';color:' + accentText + ';font-size:.78rem;font-weight:700">' + escapeHtml(getJoinStatusLabel(status)) + '</div>';
    html += '</div>';
    html += '<div class="welcome-desc">' + detail + '</div>';
    if (pendingJoinRequestedAt) {
      html += '<div class="welcome-desc" style="margin-top:8px">?????' + escapeHtml(formatDateTime(pendingJoinRequestedAt)) + '</div>';
    }
    html += '<div style="display:flex;gap:10px;margin-top:12px">';
    html += '<button class="btn-secondary" onclick="UISettings.checkJoinRequestStatus()">鍒锋柊鐢宠鐘舵€?/button>';
    if (status === 'rejected' || status === 'none') {
      html += '<button class="btn-secondary" onclick="UISettings.clearPendingJoinRequest()">娓呴櫎璁板綍</button>';
    }
    html += '</div></div>';
    return html;
  }

  function getJoinStatusLabel(status) {
    if (status === 'approved') return '宸查€氳繃';
    if (status === 'rejected') return '鏈€氳繃';
    if (status === 'none') return '闇€閲嶈瘯';
    return '???';
  }

  function renderRoleChips(handlerName) {
    var roles = ['濡堝', '鐖哥埜', '濂跺ザ', '鐖风埛', '鏈堝珎'];
    var html = '<div class="role-chips compact">';
    roles.forEach(function (role) {
      html += '<button type="button" class="role-chip" onclick="' + handlerName + '(\'' + role + '\', this)">' + role + '</button>';
    });
    html += '</div>';
    return html;
  }

  function formatJoinRequesterAccount(request) {
    var email = request && request.requester_email ? String(request.requester_email).trim() : '';
    if (email) return email;
    var account = request && request.requester_user ? String(request.requester_user) : '';
    if (!account) return '未提供';
    if (account.length <= 12) return account;
    return account.slice(0, 8) + '...' + account.slice(-6);
  }

  function renderMemberItem(member, authUserId, isCreator) {
    var name = member.display_name || member.role || '鎴愬憳';
    var creatorTag = member.is_creator
      ? '<span style="display:inline-block;margin-left:8px;padding:2px 8px;border-radius:999px;background:#eef2ff;color:var(--primary-dark);font-size:.72rem;font-weight:700">鍒涘缓鑰?/span>'
      : '';
    var canEdit = !!(isCreator || (authUserId && member.auth_user === authUserId));
    var html = '<div class="settings-item" style="display:block">';
    html += '<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">';
    html += '<div style="flex:1">';
    html += '<div class="si-label" style="font-weight:700">' + escapeHtml(name) + creatorTag + '</div>';
    html += '<div class="ti-detail" style="margin-top:6px">???' + escapeHtml(name) + '</div>';
    html += '<div class="ti-detail">?????' + escapeHtml(formatDateTime(member.created_at)) + '</div>';
    if (canEdit) {
      html += '<button class="btn-secondary" style="margin-top:8px;padding:8px 12px" onclick="UISettings.openEditMember(\'' + member.id + '\')">淇敼绉板懠</button>';
    }
    if (isCreator && !member.is_creator) {
      html += '<button class="btn-secondary" style="margin-top:8px;padding:8px 12px" onclick="UISettings.transferCreator(\'' + member.id + '\')">杞鍒涘缓鑰?/button>';
      html += '<button class="btn-danger" style="margin-top:8px;padding:0;text-align:right" onclick="UISettings.removeMember(\'' + member.id + '\')">绉婚櫎鎴愬憳</button>';
    }
    if (member.is_creator) {
      html += '<div class="ti-detail" style="margin-top:6px">鍒涘缓鑰呬笉鍙Щ闄わ紝闇€鍏堣浆璁┿€?/div>';
    }
    html += '</div></div></div>';
    return html;
  }

  function renderSyncStatusBlock() {
    var status = Sync.getSyncStatus();
    var modeLabel = '鏈湴妯″紡';
    var detail = '????? Supabase??????????';

    if (status.mode === 'cloud-ready') {
      modeLabel = status.syncing ? '????' : '?????';
      detail = '??? Supabase????????????????????????';
    } else if (status.mode === 'auth-required') {
      modeLabel = '浜戠宸查厤缃紝绛夊緟鐧诲綍';
      detail = '???????? Supabase?????????????????????????????????';
    } else if (status.mode === 'cloud-pending') {
      modeLabel = '?????';
      detail = status.lastError
        ? ('??? Supabase?????????' + status.lastError)
        : '???? Supabase ??????????';
    }

    if (status.lastSync) {
      detail += ' ?????' + new Date(status.lastSync).toLocaleString('zh-CN') + '?';
    }
    if (status.lastError && status.mode === 'cloud-ready') {
      detail += ' ?????' + status.lastError + '?';
    }

    return '<div class="settings-item" style="display:block">'
      + '<div class="si-label" style="margin-bottom:6px">鍚屾鐘舵€?/div>'
      + '<div class="si-value" style="font-weight:700;color:var(--text)">' + escapeHtml(modeLabel) + '</div>'
      + '<div class="ti-detail" style="margin-top:6px">' + escapeHtml(detail) + '</div>'
      + '</div>';
  }

  function pickCreateRole(role, btn) {
    var input = document.getElementById('welcome-create-role');
    if (input) input.value = role;
    toggleRoleChip(btn, '#welcome-create-role');
  }

  function pickRole(role, btn) {
    var input = document.getElementById('welcome-role');
    if (input) input.value = role;
    toggleRoleChip(btn, '#welcome-role');
  }

  function inputCreateRole() {
    toggleRoleChip(null, '#welcome-create-role');
  }

  function inputJoinRole() {
    toggleRoleChip(null, '#welcome-role');
  }

  function toggleRoleChip(btn, inputSelector) {
    var input = document.querySelector(inputSelector);
    if (!input) return;
    var group = input.parentElement;
    if (!group) return;
    var chips = group.querySelectorAll('.role-chip');
    chips.forEach(function (chip) { chip.classList.remove('active'); });
    if (btn) btn.classList.add('active');
  }

  function createFamilyFromWelcome() {
    var name = getInputValue('welcome-baby-name').trim();
    var birthday = getInputValue('welcome-baby-birthday');
    var role = getInputValue('welcome-create-role').trim();
    if (!name || !birthday) {
      App.toast('璇峰～鍐欏疂瀹濆皬鍚嶅拰鍑虹敓鏃ユ湡');
      return;
    }
    if (!role) {
      App.toast('???????');
      return;
    }

    DB.setMeta('memberRole', role).then(function () {
      return DB.setMeta('memberDisplayName', role);
    }).then(function () {
      return createFamilyLocal(true);
    }).then(function (code) {
      if (!code) return null;
      return upsertBaby({ name: name, birthday: birthday, avatar: '馃嵓' }).then(function (baby) {
        return DB.setMeta('currentBabyId', baby.id).then(function () {
          return DB.setMeta('onboardingCompleted', true);
        }).then(function () {
          return { code: code, baby: baby };
        });
      });
    }).then(function (result) {
      if (!result) return;
      return Sync.sync({ silent: true }).catch(function () {}).then(function () {
        showFamilyCodeSuccess(result.code);
      });
    });
  }

  function joinFamilyFromWelcome() {
    var code = getInputValue('welcome-join-code').trim();
    var role = getInputValue('welcome-role').trim();
    if (!/^\d{6}$/.test(code)) {
      renderJoinError('璇疯緭鍏?6 浣嶅搴爜');
      return;
    }
    if (!role) {
      renderJoinError('???????');
      return;
    }

    DB.setMeta('memberRole', role).then(function () {
      return DB.setMeta('memberDisplayName', role);
    }).then(function () {
      return Sync.joinFamily(code, { role: role, displayName: role });
    }).then(function (result) {
      if (!result || !result.success) {
        renderJoinError(result && result.error ? result.error : '鎻愪氦鐢宠澶辫触锛岃閲嶈瘯');
        return null;
      }
      if (result.already_member) {
        return Sync.getJoinRequestStatus(code).then(function (state) {
          if (state && state.request && state.request.status === 'approved') {
            return finishApprovedJoin(state.request);
          }
          App.toast('?????????');
          return null;
        });
      }
      App.toast(result.local_placeholder ? '??????????' : '???????????????');
      App.renderPage();
      return null;
    });
  }

  function finishApprovedJoin(request) {
    return Sync.activateApprovedJoin(request).then(function (result) {
      if (!result || !result.success) {
        App.toast(result && result.error ? result.error : '鍔犲叆瀹跺涵澶辫触');
        return null;
      }
      return Promise.all([
        DB.setMeta('onboardingCompleted', true),
        Sync.sync({ silent: true }).catch(function () {}),
        DB.getBabies()
      ]).then(function (values) {
        var babies = values[2] || [];
        if (babies.length === 0) {
          openBabyCreateAfterJoin();
          return null;
        }
        return DB.getMeta('currentBabyId').then(function (currentBabyId) {
          if (currentBabyId) return null;
          return DB.setMeta('currentBabyId', babies[0].id);
        }).then(function () {
          App.navigate('today');
          App.renderPage();
          App.toast('?????');
        });
      });
    });
  }

  function checkJoinRequestStatus() {
    DB.getMeta('pendingJoinCode').then(function (code) {
      if (!code) {
        App.toast('娌℃湁寰呮煡璇㈢殑鐢宠');
        return null;
      }
      return Sync.getJoinRequestStatus(code).then(function (state) {
        if (state && state.success && state.status === 'approved' && state.request) {
          return finishApprovedJoin(state.request);
        }
        App.renderPage();
        if (state && state.status === 'pending') App.toast('鐢宠浠嶅湪绛夊緟瀹℃牳');
        else if (state && state.status === 'rejected') App.toast('鐢宠宸茶鎷掔粷');
        return null;
      });
    });
  }

  function clearPendingJoinRequest() {
    DB.setMeta('pendingJoinCode', null).then(function () {
      return DB.setMeta('pendingJoinRequestedAt', null);
    }).then(function () {
      clearJoinError();
      App.renderPage();
    });
  }

  function reviewJoinRequest(requestId, action) {
    Sync.reviewJoinRequest(requestId, action).then(function (result) {
      if (!result || !result.success) {
        App.toast(result && result.error ? result.error : '审核失败');
        return;
      }
      App.toast(action === 'approve' ? '已同意加入申请' : '已拒绝加入申请');
      App.renderPage();
    });
  }

  function removeMember(memberId) {
    if (!confirm('???????????????????????????')) return;
    Sync.removeFamilyMember(memberId).then(function (result) {
      if (!result || !result.success) {
        App.toast(result && result.error ? result.error : '绉婚櫎澶辫触');
        return;
      }
      App.toast('?????');
      App.renderPage();
    });
  }

  function openEditMember(memberId) {
    Sync.listFamilyMembers().then(function (result) {
      var members = result && result.members ? result.members : [];
      var member = members.filter(function (item) { return item.id === memberId; })[0] || null;
      if (!member) {
        App.toast('?????');
        return;
      }
      var html = '<div class="modal-overlay" onclick="if(event.target===this)UIToday.closeModal()"><div class="modal-sheet">';
      html += '<div class="modal-handle"></div><div class="modal-title">淇敼鎴愬憳绉板懠</div>';
      html += '<div class="form-group"><label class="form-label">绉板懠</label><input type="text" class="form-input" id="member-display-name" value="' + escapeAttr(member.display_name || member.role || '') + '" placeholder="濡傦細濂跺ザ"><div class="field-error" id="member-display-name-error" aria-live="polite"></div></div>';
      html += '<button class="btn-primary" onclick="UISettings.saveMemberProfile(\'' + member.id + '\', \'' + escapeJs(member.auth_user || '') + '\')">淇濆瓨</button>';
      html += '</div></div>';
      document.body.insertAdjacentHTML('beforeend', html);
    });
  }

  function saveMemberProfile(memberId, memberAuthUser) {
    var title = getInputValue('member-display-name').trim();
    if (!title) {
      App.toast('?????');
      return;
    }
    Sync.updateFamilyMember(memberId, {
      displayName: title,
      role: title
    }).then(function (result) {
      if (!result || !result.success) {
        App.toast(result && result.error ? result.error : '淇敼澶辫触');
        return;
      }
      return DB.getMeta('authUserId').then(function (authUserId) {
        if (authUserId && memberAuthUser && authUserId === memberAuthUser) {
          return DB.setMeta('memberDisplayName', result.member && result.member.display_name ? result.member.display_name : title).then(function () {
            return DB.setMeta('memberRole', result.member && result.member.role ? result.member.role : title);
          });
        }
        return null;
      }).then(function () {
        UIToday.closeModal();
        App.toast('淇敼鎴愬姛');
        App.renderPage();
      });
    });
  }

  function transferCreator(memberId) {
    if (!confirm('纭鎶婂搴垱寤鸿€呰韩浠借浆璁╃粰杩欎釜鎴愬憳鍚楋紵')) return;
    Sync.transferFamilyCreator(memberId).then(function (result) {
      if (!result || !result.success) {
        App.toast(result && result.error ? result.error : '杞澶辫触');
        return;
      }
      App.toast('??????');
      App.renderPage();
    });
  }

  function leaveFamily() {
    if (!confirm('?????????????????????????????')) return;
    Sync.leaveFamily().then(function (result) {
      if (!result || !result.success) {
        App.toast(result && result.error ? result.error : '??????');
        return;
      }
      return DB.setMeta('familyId', null).then(function () {
        return DB.setMeta('familyCode', null);
      }).then(function () {
        return DB.setLastSyncAt(null);
      }).then(function () {
        App.toast('???????');
        App.navigate('welcome');
        App.renderPage();
      });
    });
  }

  function renderJoinError(msg) {
    var el = document.getElementById('welcome-join-error');
    if (!el) return;
    var html = '<div class="welcome-error">' + escapeHtml(msg) + '</div>';
    html += '<div class="welcome-error-actions">';
    html += '<button class="btn-secondary" onclick="UISettings.clearJoinError()">閲嶆柊杈撳叆</button>';
    html += '<button class="btn-secondary" onclick="UISettings.focusCreateFamily()">鍒涘缓鏂板搴?/button>';
    html += '</div>';
    el.innerHTML = html;
  }

  function clearJoinError() {
    var el = document.getElementById('welcome-join-error');
    if (el) el.innerHTML = '';
    var input = document.getElementById('welcome-join-code');
    if (input) input.focus();
  }

  function focusCreateFamily() {
    clearJoinError();
    var input = document.getElementById('welcome-baby-name');
    if (input) input.focus();
  }

  function openBabyCreateAfterJoin() {
    var html = '<div class="modal-overlay" onclick="if(event.target===this)UIToday.closeModal()"><div class="modal-sheet">';
    html += '<div class="modal-handle"></div><div class="modal-title">杩欎釜瀹跺涵杩樻病鏈夊疂瀹?/div>';
    html += '<div class="form-group"><label class="form-label">瀹濆疂灏忓悕</label><input type="text" class="form-input" id="join-baby-name" placeholder="濡傦細璞嗚眴"><div class="field-error" id="join-baby-name-error" aria-live="polite"></div></div>';
    html += '<div class="form-group"><label class="form-label">鍑虹敓鏃ユ湡</label><input type="date" class="form-input" id="join-baby-birthday"><div class="field-error" id="join-baby-birthday-error" aria-live="polite"></div></div>';
    html += '<button class="btn-primary" onclick="UISettings.finishJoinCreateBaby()">淇濆瓨骞惰繘鍏ヤ粖鏃ラ〉</button>';
    html += '</div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
  }

  function finishJoinCreateBaby() {
    var name = getInputValue('join-baby-name').trim();
    var birthday = getInputValue('join-baby-birthday');
    if (!name || !birthday) {
      App.toast('璇峰～鍐欏疂瀹濆皬鍚嶅拰鍑虹敓鏃ユ湡');
      return;
    }
    upsertBaby({ name: name, birthday: birthday, avatar: '馃嵓' }).then(function (baby) {
      return DB.setMeta('currentBabyId', baby.id).then(function () {
        return DB.setMeta('onboardingCompleted', true);
      });
    }).then(function () {
      return Sync.sync({ silent: true }).catch(function () {});
    }).then(function () {
      UIToday.closeModal();
      App.navigate('today');
      App.renderPage();
      App.toast('宸茶繘鍏ヤ粖鏃ラ〉');
    });
  }

  function showFamilyCodeSuccess(code) {
    var html = '<div class="modal-overlay" onclick="if(event.target===this)return"><div class="modal-sheet">';
    html += '<div class="modal-handle"></div>';
    html += '<div style="border:1px solid rgba(99,102,241,.18);background:linear-gradient(180deg, rgba(99,102,241,.08), rgba(99,102,241,.02));box-shadow:0 10px 24px rgba(99,102,241,.08);border-radius:20px;padding:18px">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px">';
    html += '<div class="modal-title" style="margin:0">绗?3 姝ワ細鎶婂搴爜鍙戠粰瀹朵汉</div>';
    html += '<div style="padding:4px 10px;border-radius:999px;background:rgba(99,102,241,.12);color:var(--primary-dark);font-size:.78rem;font-weight:700">鍒涘缓鎴愬姛</div>';
    html += '</div>';
    html += '<div class="welcome-desc" style="margin-bottom:14px">浣犵殑瀹跺涵宸茬粡鍒涘缓濂戒簡銆傚浜鸿緭鍏ヨ繖 6 浣嶅搴爜鐢宠鍔犲叆锛岄€氳繃鍚庡氨鑳藉拰浣犲叡浜悓涓€浠借褰曘€?/div>';
    html += '<div class="family-code-box">' + escapeHtml(code) + '</div>';
    html += '<div class="family-code-tip">寤鸿鐜板湪灏辨妸瀹跺涵鐮佸彂缁欏彟涓€鍙版墜鏈恒€傚鏂规彁浜ょ敵璇峰悗锛屼綘鍙互鍦ㄨ缃〉瀹℃牳銆?/div>';
    html += '<button class="btn-primary" onclick="UISettings.copyFamilyCodeAndEnter()">澶嶅埗瀹跺涵鐮佸苟杩涘叆浠婃棩椤?/button>';
    html += '<button class="btn-secondary" style="margin-top:8px" onclick="UISettings.enterTodayAfterOnboarding()">绋嶅悗鍐嶅彂锛屽厛杩涘叆浠婃棩椤?/button>';
    html += '</div>';
    html += '</div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
  }

  function copyFamilyCodeAndEnter() {
    DB.getMeta('familyCode').then(function (code) {
      if (navigator.clipboard && code) {
        navigator.clipboard.writeText(code).catch(function () {});
      }
      enterTodayAfterOnboarding();
    });
  }

  function enterTodayAfterOnboarding() {
    UIToday.closeModal();
    App.navigate('today');
    App.renderPage();
    App.toast('宸茶繘鍏ヤ粖鏃ラ〉');
  }

  function addBaby() {
    showBabyForm(null);
  }

  function editBaby(id) {
    DB.getBaby(id).then(function (baby) {
      showBabyForm(baby);
    });
  }

  function showBabyForm(baby) {
    var isEdit = !!baby;
    var current = baby || { name: '', birthday: '', avatar: '馃嵓' };
    var avatars = ['馃嵓', '馃悾', '馃懚', '馃専', '馃Ц', '馃惀', '馃惢'];
    var html = '<div class="modal-overlay" onclick="if(event.target===this)UIToday.closeModal()"><div class="modal-sheet">';
    html += '<div class="modal-handle"></div><div class="modal-title">' + (isEdit ? '缂栬緫瀹濆疂' : '娣诲姞瀹濆疂') + '</div>';
    html += '<div class="form-group"><label class="form-label">澶村儚</label><div style="display:flex;gap:8px;flex-wrap:wrap">';
    avatars.forEach(function (avatar) {
      var selected = current.avatar === avatar ? 'border:2px solid var(--primary);background:var(--c-sleep)' : '';
      html += '<button onclick="document.getElementById(\'baby-avatar\').value=\'' + avatar + '\';UISettings._selectAvatar(this)" style="font-size:1.5rem;padding:8px;border-radius:10px;' + selected + '" data-avatar="' + avatar + '">' + avatar + '</button>';
    });
    html += '</div><input type="hidden" id="baby-avatar" value="' + escapeAttr(current.avatar) + '"></div>';
    html += '<div class="form-group"><label class="form-label">灏忓悕</label><input type="text" class="form-input" id="baby-name" value="' + escapeAttr(current.name || '') + '" placeholder="濡傦細璞嗚眴"><div class="field-error" id="baby-name-error" aria-live="polite"></div></div>';
    html += '<div class="form-group"><label class="form-label">鍑虹敓鏃ユ湡</label><input type="date" class="form-input" id="baby-birthday" value="' + escapeAttr(current.birthday || '') + '"><div class="field-error" id="baby-birthday-error" aria-live="polite"></div></div>';
    html += '<button class="btn-primary" onclick="UISettings.saveBaby(' + (isEdit ? '\'' + current.id + '\'' : 'null') + ')">淇濆瓨</button>';
    if (isEdit) {
      html += '<button class="btn-danger" style="margin-top:8px" onclick="UISettings.deleteBaby(\'' + current.id + '\')">鍒犻櫎姝ゅ疂瀹?/button>';
    }
    html += '</div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
  }

  function _selectAvatar(btn) {
    var siblings = btn.parentElement.querySelectorAll('button');
    siblings.forEach(function (item) {
      item.style.border = '1px solid transparent';
      item.style.background = '';
    });
    btn.style.border = '2px solid var(--primary)';
    btn.style.background = 'var(--c-sleep)';
  }

  function upsertBaby(baby) {
    if (baby.id) return DB.upsertBaby(baby);
    return DB.upsertBaby({
      name: baby.name,
      birthday: baby.birthday,
      avatar: baby.avatar || '馃嵓'
    });
  }

  function saveBaby(id) {
    var baby = {
      name: getInputValue('baby-name'),
      birthday: getInputValue('baby-birthday'),
      avatar: getInputValue('baby-avatar') || '馃嵓'
    };
    if (id) baby.id = id;

    upsertBaby(baby).then(function (saved) {
      return DB.getMeta('currentBabyId').then(function (currentBabyId) {
        if (!currentBabyId) return DB.setMeta('currentBabyId', saved.id);
        return null;
      });
    }).then(function () {
      UIToday.closeModal();
      App.toast('???');
      App.renderPage();
    });
  }

  function deleteBaby(id) {
    if (!confirm('鍒犻櫎姝ゅ疂瀹濆悗锛岀浉鍏宠褰曚篃浼氫竴璧烽殣钘忥紝纭缁х画鍚楋紵')) return;
    DB.deleteBaby(id).then(function () {
      return DB.getMeta('currentBabyId');
    }).then(function (currentBabyId) {
      if (currentBabyId === id) return DB.setMeta('currentBabyId', null);
      return null;
    }).then(function () {
      UIToday.closeModal();
      App.toast('???');
      App.renderPage();
    });
  }

  function toggleButton(type, on) {
    DB.getMeta('homeButtons').then(function (buttons) {
      buttons = buttons || DEFAULT_HOME_BUTTONS.slice();
      if (on && buttons.indexOf(type) < 0) buttons.push(type);
      if (!on) buttons = buttons.filter(function (item) { return item !== type; });
      return DB.setMeta('homeButtons', buttons);
    }).then(function () {
      App.toast(on ? '宸叉坊鍔犲埌棣栭〉' : '宸蹭粠棣栭〉绉婚櫎');
    });
  }

  function createFamilyLocal(silent) {
    return DB.getMeta('memberRole').then(function (role) {
      return Sync.createFamily({ role: role || 'parent', displayName: role || null });
    }).then(function (result) {
      if (!result || !result.success || !result.code) {
        App.toast(result && result.error ? result.error : '鍒涘缓瀹跺涵澶辫触');
        return null;
      }
      return DB.setMeta('familyCode', result.code).then(function () {
        if (!silent) {
          App.toast('???????' + result.code);
          App.renderPage();
        }
        return result.code;
      });
    });
  }

  function createFamily() {
    return createFamilyLocal(false);
  }

  function copyFamilyCode() {
    DB.getMeta('familyCode').then(function (code) {
      if (!code) return;
      if (navigator.clipboard) navigator.clipboard.writeText(code).catch(function () {});
      App.toast('瀹跺涵鐮佸凡澶嶅埗');
    });
  }

  function joinFamily() {
    App.navigate('welcome');
    App.renderPage();
    setTimeout(function () {
      var input = document.getElementById('welcome-join-code');
      if (input) input.focus();
    }, 50);
  }

  function manualSync() {
    App.toast('姝ｅ湪鍚屾');
    Sync.sync().then(function (result) {
      App.renderPage();
      if (result && result.error) App.toast('鍚屾澶辫触');
      else App.toast('鍚屾瀹屾垚');
    });
  }

  function exportData() {
    DB.exportAll().then(function (data) {
      var json = JSON.stringify(data, null, 2);
      var blob = new Blob([json], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url;
      link.download = 'babycare-backup-' + new Date().toISOString().slice(0, 10) + '.json';
      link.click();
      URL.revokeObjectURL(url);
      App.toast('???');
    });
  }

  function importData(event) {
    var file = event.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var data = JSON.parse(e.target.result);
        if (!data.babies || !data.events) throw new Error('invalid_backup');
        DB.importAll(data).then(function () {
          App.toast('瀵煎叆鎴愬姛');
          App.renderPage();
        });
      } catch (err) {
        App.toast('瀵煎叆澶辫触锛屾枃浠舵牸寮忎笉姝ｇ‘');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  function formatBabySubtitle(baby) {
    var parts = [];
    if (baby.birthday) parts.push(baby.birthday);
    var days = Calc.daysSinceBirth(baby.birthday);
    if (days != null) parts.push('?? ' + days + ' ?');
    return parts.join(' ? ') || '???';
  }

  function formatDateTime(value) {
    if (!value) return '鏈煡';
    return new Date(value).toLocaleString('zh-CN');
  }

  function findCurrentMember(members, authUserId) {
    return members.filter(function (member) {
      return !!(authUserId && member.auth_user === authUserId);
    })[0] || null;
  }

  function getInputValue(id) {
    var el = document.getElementById(id);
    return el ? String(el.value || '') : '';
  }

  function escapeAttr(value) {
    return String(value || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  function escapeHtml(value) {
    return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function escapeJs(value) {
    return String(value || '').replace(/\\/g, '\\\\').replace(/'/g, '\\\'');
  }

  return {
    render: render,
    renderWelcome: renderWelcome,
    addBaby: addBaby,
    editBaby: editBaby,
    saveBaby: saveBaby,
    deleteBaby: deleteBaby,
    _selectAvatar: _selectAvatar,
    toggleButton: toggleButton,
    createFamily: createFamily,
    createFamilyLocal: createFamilyLocal,
    joinFamily: joinFamily,
    pickRole: pickRole,
    createFamilyFromWelcome: createFamilyFromWelcome,
    joinFamilyFromWelcome: joinFamilyFromWelcome,
    clearJoinError: clearJoinError,
    focusCreateFamily: focusCreateFamily,
    finishJoinCreateBaby: finishJoinCreateBaby,
    copyFamilyCode: copyFamilyCode,
    copyFamilyCodeAndEnter: copyFamilyCodeAndEnter,
    enterTodayAfterOnboarding: enterTodayAfterOnboarding,
    exportData: exportData,
    importData: importData,
    pickCreateRole: pickCreateRole,
    inputCreateRole: inputCreateRole,
    inputJoinRole: inputJoinRole,
    manualSync: manualSync,
    checkJoinRequestStatus: checkJoinRequestStatus,
    clearPendingJoinRequest: clearPendingJoinRequest,
    reviewJoinRequest: reviewJoinRequest,
    removeMember: removeMember,
    openEditMember: openEditMember,
    saveMemberProfile: saveMemberProfile,
    transferCreator: transferCreator,
    leaveFamily: leaveFamily
  };
})();
