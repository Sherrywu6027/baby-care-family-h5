var UISettings = (function () {
  function render(container) {
    Promise.all([
      DB.getBabies(),
      DB.getMeta('homeButtons'),
      DB.getMeta('familyCode'),
      Sync.listPendingJoinRequests(),
      Sync.listFamilyMembers(),
      DB.getMeta('authUserId')
    ]).then(function (results) {
      var babies = results[0] || [];
      var buttons = results[1] || DEFAULT_HOME_BUTTONS;
      var familyCode = results[2];
      var pendingRequests = results[3] || [];
      var memberState = results[4] || { success: true, members: [] };
      var authUserId = results[5] || null;
      var members = memberState.members || [];
      var currentMember = findCurrentMember(members, authUserId);
      var isCreator = !!(currentMember && currentMember.is_creator);
      var html = '';

      html += '<div class="log-header"><h2 style="font-size:1.2rem">设置</h2></div>';

      html += '<div class="settings-section-title">宝宝档案</div>';
      html += '<div class="settings-group">';
      babies.forEach(function (baby) {
        html += '<div class="baby-card" data-baby-id="' + baby.id + '" onclick="UISettings.editBaby(\'' + baby.id + '\')" style="cursor:pointer">';
        html += '<div class="baby-avatar">' + escapeHtml(baby.avatar || '🍼') + '</div>';
        html += '<div class="baby-info" style="flex:1">';
        html += '<div class="bi-name">' + escapeHtml(baby.name || '宝宝') + '</div>';
        html += '<div class="bi-birthday">' + escapeHtml(formatBabySubtitle(baby)) + '</div>';
        html += '</div><span class="si-arrow">›</span></div>';
      });
      html += '<div class="settings-item" onclick="UISettings.addBaby()" style="cursor:pointer;justify-content:center;color:var(--primary);font-weight:600">+ 添加宝宝</div>';
      html += '</div>';

      html += '<div class="settings-section-title">首页按钮</div>';
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

      html += '<div class="settings-section-title">家庭共享</div>';
      html += '<div class="settings-group">';
      html += renderSyncStatusBlock();
      html += '<div class="settings-item" onclick="UISettings.manualSync()" style="cursor:pointer;color:var(--primary);font-weight:600">立即同步</div>';
      if (familyCode) {
        html += '<div class="settings-item"><div class="si-label">家庭码</div><div class="si-value" style="font-weight:700;letter-spacing:2px">' + escapeHtml(familyCode) + '</div></div>';
        html += '<div class="settings-item" onclick="UISettings.copyFamilyCode()" style="cursor:pointer;color:var(--primary);font-weight:600">复制家庭码</div>';
      } else {
        html += '<div class="settings-item" onclick="UISettings.createFamilyLocal()" style="cursor:pointer;color:var(--primary);font-weight:600">生成家庭码</div>';
      }
      html += '<div class="settings-item" onclick="UISettings.joinFamily()" style="cursor:pointer;color:var(--primary);font-weight:600">输入家庭码加入</div>';
      html += '</div>';

      if (familyCode) {
        html += '<div class="settings-section-title">成员管理</div>';
        html += '<div class="settings-group">';
        if (!Sync.isConfigured()) {
          html += '<div class="settings-item" style="display:block">';
          html += '<div class="si-label">当前为本地模式</div>';
          html += '<div class="ti-detail" style="margin-top:6px">成员管理需要接入 Supabase 后使用。</div>';
          html += '</div>';
        } else if (!memberState.success) {
          html += '<div class="settings-item" style="display:block">';
          html += '<div class="si-label">成员列表加载失败</div>';
          html += '<div class="ti-detail" style="margin-top:6px">' + escapeHtml(memberState.error || '请稍后重试') + '</div>';
          html += '</div>';
        } else if (members.length === 0) {
          html += '<div class="settings-item" style="display:block"><div class="si-label">暂无成员</div></div>';
        } else {
          members.forEach(function (member) {
            html += renderMemberItem(member, authUserId, isCreator);
          });
        }
        html += '</div>';

        if (currentMember) {
          html += '<div class="settings-section-title">家庭操作</div>';
          html += '<div class="settings-group">';
          html += '<div class="settings-item" onclick="UISettings.openEditMember(\'' + currentMember.id + '\')" style="cursor:pointer"><div class="si-label">修改我的称呼</div><span class="si-arrow">›</span></div>';
          html += '<div class="settings-item" onclick="UISettings.leaveFamily()" style="cursor:pointer;color:var(--danger);font-weight:700">退出当前家庭（谨慎）</div>';
          html += '</div>';
        }
      }

      if (pendingRequests.length > 0) {
        html += '<div class="settings-section-title">加入审核</div>';
        html += '<div class="settings-group">';
        pendingRequests.forEach(function (request) {
          html += '<div class="settings-item" style="display:block">';
          html += '<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">';
          html += '<div>';
          html += '<div class="si-label" style="font-weight:700">' + escapeHtml(request.display_name || request.role || '新成员') + '</div>';
          html += '<div class="ti-detail" style="margin-top:6px">称呼：' + escapeHtml(request.display_name || request.role || '未填写') + '</div>';
          html += '<div class="ti-detail">申请时间：' + escapeHtml(formatDateTime(request.created_at)) + '</div>';
          html += '</div>';
          html += '<div style="display:flex;gap:8px;flex-shrink:0">';
          html += '<button class="btn-secondary" style="padding:8px 12px" onclick="UISettings.reviewJoinRequest(\'' + request.id + '\', \'reject\')">拒绝</button>';
          html += '<button class="btn-primary" style="padding:8px 12px" onclick="UISettings.reviewJoinRequest(\'' + request.id + '\', \'approve\')">同意</button>';
          html += '</div></div></div>';
        });
        html += '</div>';
      }

      html += '<div class="settings-section-title">备份</div>';
      html += '<div class="settings-group">';
      html += '<div class="settings-item" onclick="UISettings.exportData()" style="cursor:pointer"><div class="si-label">导出全部数据</div><span class="si-arrow">›</span></div>';
      html += '<div class="settings-item" onclick="document.getElementById(\'import-file\').click()" style="cursor:pointer"><div class="si-label">导入备份</div><span class="si-arrow">›</span></div>';
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
            container.innerHTML = '<div class="welcome-page compact"><div class="welcome-section compact"><div class="welcome-title">加入已通过</div><div class="welcome-desc">正在同步家庭数据，请稍候。</div></div></div>';
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
    html += '<div class="welcome-hero compact"><div class="welcome-badge">🍼 宝宝照护记录</div><h1>第 2 步：选择你要进入的家庭</h1><p>老用户会自动回到原家庭。只有当前账号还没有加入任何家庭时，才需要在这里创建或加入家庭。</p></div>';

    if (pendingJoinCode) {
      html += renderPendingJoinBlock(pendingJoinCode, pendingJoinRequestedAt, joinState);
    }

    html += '<div class="welcome-section compact" style="border:1px solid rgba(99,102,241,.18);background:linear-gradient(180deg, rgba(99,102,241,.08), rgba(99,102,241,.02));box-shadow:0 10px 24px rgba(99,102,241,.08)">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px">';
    html += '<div class="welcome-title" style="margin:0">方案 A：我是第一个使用的人</div>';
    html += '<div style="padding:4px 10px;border-radius:999px;background:rgba(99,102,241,.12);color:var(--primary-dark);font-size:.78rem;font-weight:700">创建家庭</div>';
    html += '</div>';
    html += '<div class="welcome-desc">创建一个新家庭。创建完成后会生成 6 位家庭码，家人用这个家庭码申请加入。</div>';
    html += '<div class="form-row compact-row">';
    html += '<div class="form-group"><label class="form-label">宝宝小名</label><input type="text" class="form-input" id="welcome-baby-name" placeholder="如：豆豆"></div>';
    html += '<div class="form-group"><label class="form-label">出生日期</label><input type="date" class="form-input" id="welcome-baby-birthday"></div>';
    html += '</div>';
    html += '<div class="form-group compact-group"><label class="form-label">你的称呼</label>';
    html += renderRoleChips('UISettings.pickCreateRole');
    html += '<input type="text" class="form-input" id="welcome-create-role" placeholder="也可自定义，如：外婆" oninput="UISettings.inputCreateRole(this)"></div>';
    html += '<button class="btn-primary" onclick="UISettings.createFamilyFromWelcome()">创建新家庭</button>';
    html += '<div class="welcome-desc" style="margin-top:10px">适用场景：你是宝宝记录的发起人，还没有任何家人先建过家庭。</div>';
    html += '</div>';

    html += '<div class="welcome-divider compact"><span>如果不是你先开始</span></div>';

    html += '<div class="welcome-section compact" style="border:1px solid rgba(16,185,129,.20);background:linear-gradient(180deg, rgba(16,185,129,.08), rgba(16,185,129,.02));box-shadow:0 10px 24px rgba(16,185,129,.07)">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px">';
    html += '<div class="welcome-title" style="margin:0">方案 B：家人已经创建了家庭</div>';
    html += '<div style="padding:4px 10px;border-radius:999px;background:rgba(16,185,129,.12);color:#047857;font-size:.78rem;font-weight:700">加入家庭</div>';
    html += '</div>';
    html += '<div class="welcome-desc">输入家人发给你的 6 位家庭码。提交后会进入待审核，通过后你就能看到同一份家庭记录。</div>';
    html += '<div class="form-row compact-row join-row">';
    html += '<div class="form-group"><label class="form-label">6 位家庭码</label><input type="text" class="form-input welcome-code" id="welcome-join-code" maxlength="6" placeholder="如：123456" value="' + escapeAttr(pendingJoinCode || '') + '"></div>';
    html += '<div class="form-group join-btn-wrap"><label class="form-label">&nbsp;</label><button class="btn-primary join-btn" onclick="UISettings.joinFamilyFromWelcome()">申请加入家庭</button></div>';
    html += '</div>';
    html += '<div class="form-group compact-group"><label class="form-label">你的称呼</label>';
    html += renderRoleChips('UISettings.pickRole');
    html += '<input type="text" class="form-input" id="welcome-role" placeholder="也可自定义，如：奶奶" oninput="UISettings.inputJoinRole(this)"></div>';
    html += '<div class="welcome-desc" style="margin-top:10px">适用场景：另一位家人已经开始记录，你现在只是加入同一个家庭。</div>';
    html += '<div id="welcome-join-error"></div>';
    html += '</div>';

    html += '</div>';
    container.innerHTML = html;
  }

  function renderPendingJoinBlock(pendingJoinCode, pendingJoinRequestedAt, joinState) {
    var status = joinState && joinState.status ? joinState.status : 'pending';
    var title = '你的加入申请正在等待处理';
    var detail = '家庭码 ' + escapeHtml(pendingJoinCode) + ' 已提交，等待家庭创建者审核。审核通过后，你会自动进入这个家庭。';
    var accent = 'rgba(245,158,11,.16)';
    var accentText = '#b45309';
    var border = 'rgba(245,158,11,.24)';
    var shadow = 'rgba(245,158,11,.08)';

    if (status === 'rejected') {
      title = '这次加入申请未通过';
      detail = '你可以先和家人确认家庭码，再重新提交申请。';
      accent = 'rgba(239,68,68,.14)';
      accentText = '#b91c1c';
      border = 'rgba(239,68,68,.22)';
      shadow = 'rgba(239,68,68,.08)';
    } else if (status === 'approved') {
      title = '加入申请已通过';
      detail = '正在为你同步家庭数据。';
      accent = 'rgba(16,185,129,.14)';
      accentText = '#047857';
      border = 'rgba(16,185,129,.22)';
      shadow = 'rgba(16,185,129,.08)';
    } else if (status === 'none') {
      title = '没有找到申请记录';
      detail = '可能还没有提交成功，你可以重新提交申请。';
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
      html += '<div class="welcome-desc" style="margin-top:8px">申请时间：' + escapeHtml(formatDateTime(pendingJoinRequestedAt)) + '</div>';
    }
    html += '<div style="display:flex;gap:10px;margin-top:12px">';
    html += '<button class="btn-secondary" onclick="UISettings.checkJoinRequestStatus()">刷新申请状态</button>';
    if (status === 'rejected' || status === 'none') {
      html += '<button class="btn-secondary" onclick="UISettings.clearPendingJoinRequest()">清除记录</button>';
    }
    html += '</div></div>';
    return html;
  }

  function getJoinStatusLabel(status) {
    if (status === 'approved') return '已通过';
    if (status === 'rejected') return '未通过';
    if (status === 'none') return '需重试';
    return '待审核';
  }

  function renderRoleChips(handlerName) {
    var roles = ['妈妈', '爸爸', '奶奶', '爷爷', '月嫂'];
    var html = '<div class="role-chips compact">';
    roles.forEach(function (role) {
      html += '<button type="button" class="role-chip" onclick="' + handlerName + '(\'' + role + '\', this)">' + role + '</button>';
    });
    html += '</div>';
    return html;
  }

  function renderMemberItem(member, authUserId, isCreator) {
    var name = member.display_name || member.role || '成员';
    var creatorTag = member.is_creator
      ? '<span style="display:inline-block;margin-left:8px;padding:2px 8px;border-radius:999px;background:#eef2ff;color:var(--primary-dark);font-size:.72rem;font-weight:700">创建者</span>'
      : '';
    var canEdit = !!(isCreator || (authUserId && member.auth_user === authUserId));
    var html = '<div class="settings-item" style="display:block">';
    html += '<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">';
    html += '<div style="flex:1">';
    html += '<div class="si-label" style="font-weight:700">' + escapeHtml(name) + creatorTag + '</div>';
    html += '<div class="ti-detail" style="margin-top:6px">称呼：' + escapeHtml(name) + '</div>';
    html += '<div class="ti-detail">加入时间：' + escapeHtml(formatDateTime(member.created_at)) + '</div>';
    if (canEdit) {
      html += '<button class="btn-secondary" style="margin-top:8px;padding:8px 12px" onclick="UISettings.openEditMember(\'' + member.id + '\')">修改称呼</button>';
    }
    if (isCreator && !member.is_creator) {
      html += '<button class="btn-secondary" style="margin-top:8px;padding:8px 12px" onclick="UISettings.transferCreator(\'' + member.id + '\')">转让创建者</button>';
      html += '<button class="btn-danger" style="margin-top:8px;padding:0;text-align:right" onclick="UISettings.removeMember(\'' + member.id + '\')">移除成员</button>';
    }
    if (member.is_creator) {
      html += '<div class="ti-detail" style="margin-top:6px">创建者不可移除，需先转让。</div>';
    }
    html += '</div></div></div>';
    return html;
  }

  function renderSyncStatusBlock() {
    var status = Sync.getSyncStatus();
    var modeLabel = '本地模式';
    var detail = '当前未连接 Supabase，数据只保存在本机。';

    if (status.mode === 'cloud-ready') {
      modeLabel = status.syncing ? '正在同步' : '云端已连接';
      detail = '已连接 Supabase，可创建家庭、提交加入申请，并在多设备间同步。';
    } else if (status.mode === 'auth-required') {
      modeLabel = '云端已配置，等待登录';
      detail = '当前项目已经连接 Supabase，但你还没有完成登录。登录后才能恢复家庭、提交加入申请和同步数据。';
    } else if (status.mode === 'cloud-pending') {
      modeLabel = '云端待就绪';
      detail = status.lastError
        ? ('已配置 Supabase，但当前连接失败：' + status.lastError)
        : '已检测到 Supabase 配置，正在等待连接。';
    }

    if (status.lastSync) {
      detail += ' 最近同步：' + new Date(status.lastSync).toLocaleString('zh-CN') + '。';
    }
    if (status.lastError && status.mode === 'cloud-ready') {
      detail += ' 最近错误：' + status.lastError + '。';
    }

    return '<div class="settings-item" style="display:block">'
      + '<div class="si-label" style="margin-bottom:6px">同步状态</div>'
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
      App.toast('请填写宝宝小名和出生日期');
      return;
    }
    if (!role) {
      App.toast('请填写你的称呼');
      return;
    }

    DB.setMeta('memberRole', role).then(function () {
      return DB.setMeta('memberDisplayName', role);
    }).then(function () {
      return createFamilyLocal(true);
    }).then(function (code) {
      if (!code) return null;
      return upsertBaby({ name: name, birthday: birthday, avatar: '🍼' }).then(function (baby) {
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
      renderJoinError('请输入 6 位家庭码');
      return;
    }
    if (!role) {
      renderJoinError('请填写你的称呼');
      return;
    }

    DB.setMeta('memberRole', role).then(function () {
      return DB.setMeta('memberDisplayName', role);
    }).then(function () {
      return Sync.joinFamily(code, { role: role, displayName: role });
    }).then(function (result) {
      if (!result || !result.success) {
        renderJoinError(result && result.error ? result.error : '提交申请失败，请重试');
        return null;
      }
      if (result.already_member) {
        return Sync.getJoinRequestStatus(code).then(function (state) {
          if (state && state.request && state.request.status === 'approved') {
            return finishApprovedJoin(state.request);
          }
          App.toast('你已经在这个家庭中');
          return null;
        });
      }
      App.toast(result.local_placeholder ? '本地演示模式下已加入' : '申请已提交，等待家庭创建者审核');
      App.renderPage();
      return null;
    });
  }

  function finishApprovedJoin(request) {
    return Sync.activateApprovedJoin(request).then(function (result) {
      if (!result || !result.success) {
        App.toast(result && result.error ? result.error : '加入家庭失败');
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
          App.toast('已加入家庭');
        });
      });
    });
  }

  function checkJoinRequestStatus() {
    DB.getMeta('pendingJoinCode').then(function (code) {
      if (!code) {
        App.toast('没有待查询的申请');
        return null;
      }
      return Sync.getJoinRequestStatus(code).then(function (state) {
        if (state && state.success && state.status === 'approved' && state.request) {
          return finishApprovedJoin(state.request);
        }
        App.renderPage();
        if (state && state.status === 'pending') App.toast('申请仍在等待审核');
        else if (state && state.status === 'rejected') App.toast('申请已被拒绝');
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
    if (!confirm('确认移除这个成员吗？移除后对方将无法继续访问当前家庭。')) return;
    Sync.removeFamilyMember(memberId).then(function (result) {
      if (!result || !result.success) {
        App.toast(result && result.error ? result.error : '移除失败');
        return;
      }
      App.toast('成员已移除');
      App.renderPage();
    });
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
      html += '<div class="form-group"><label class="form-label">称呼</label><input type="text" class="form-input" id="member-display-name" value="' + escapeAttr(member.display_name || member.role || '') + '" placeholder="如：奶奶"></div>';
      html += '<button class="btn-primary" onclick="UISettings.saveMemberProfile(\'' + member.id + '\', \'' + escapeJs(member.auth_user || '') + '\')">保存</button>';
      html += '</div></div>';
      document.body.insertAdjacentHTML('beforeend', html);
    });
  }

  function saveMemberProfile(memberId, memberAuthUser) {
    var title = getInputValue('member-display-name').trim();
    if (!title) {
      App.toast('请填写称呼');
      return;
    }
    Sync.updateFamilyMember(memberId, {
      displayName: title,
      role: title
    }).then(function (result) {
      if (!result || !result.success) {
        App.toast(result && result.error ? result.error : '修改失败');
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
        App.toast('修改成功');
        App.renderPage();
      });
    });
  }

  function transferCreator(memberId) {
    if (!confirm('确认把家庭创建者身份转让给这个成员吗？')) return;
    Sync.transferFamilyCreator(memberId).then(function (result) {
      if (!result || !result.success) {
        App.toast(result && result.error ? result.error : '转让失败');
        return;
      }
      App.toast('已转让创建者');
      App.renderPage();
    });
  }

  function leaveFamily() {
    if (!confirm('确认退出当前家庭吗？退出后你将无法继续同步这个家庭的数据。')) return;
    Sync.leaveFamily().then(function (result) {
      if (!result || !result.success) {
        App.toast(result && result.error ? result.error : '退出家庭失败');
        return;
      }
      return DB.setMeta('familyId', null).then(function () {
        return DB.setMeta('familyCode', null);
      }).then(function () {
        return DB.setLastSyncAt(null);
      }).then(function () {
        App.toast('已退出当前家庭');
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
    html += '<button class="btn-secondary" onclick="UISettings.clearJoinError()">重新输入</button>';
    html += '<button class="btn-secondary" onclick="UISettings.focusCreateFamily()">创建新家庭</button>';
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
    html += '<div class="modal-handle"></div><div class="modal-title">这个家庭还没有宝宝</div>';
    html += '<div class="form-group"><label class="form-label">宝宝小名</label><input type="text" class="form-input" id="join-baby-name" placeholder="如：豆豆"></div>';
    html += '<div class="form-group"><label class="form-label">出生日期</label><input type="date" class="form-input" id="join-baby-birthday"></div>';
    html += '<button class="btn-primary" onclick="UISettings.finishJoinCreateBaby()">保存并进入今日页</button>';
    html += '</div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
  }

  function finishJoinCreateBaby() {
    var name = getInputValue('join-baby-name').trim();
    var birthday = getInputValue('join-baby-birthday');
    if (!name || !birthday) {
      App.toast('请填写宝宝小名和出生日期');
      return;
    }
    upsertBaby({ name: name, birthday: birthday, avatar: '🍼' }).then(function (baby) {
      return DB.setMeta('currentBabyId', baby.id).then(function () {
        return DB.setMeta('onboardingCompleted', true);
      });
    }).then(function () {
      return Sync.sync({ silent: true }).catch(function () {});
    }).then(function () {
      UIToday.closeModal();
      App.navigate('today');
      App.renderPage();
      App.toast('已进入今日页');
    });
  }

  function showFamilyCodeSuccess(code) {
    var html = '<div class="modal-overlay" onclick="if(event.target===this)return"><div class="modal-sheet">';
    html += '<div class="modal-handle"></div>';
    html += '<div style="border:1px solid rgba(99,102,241,.18);background:linear-gradient(180deg, rgba(99,102,241,.08), rgba(99,102,241,.02));box-shadow:0 10px 24px rgba(99,102,241,.08);border-radius:20px;padding:18px">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px">';
    html += '<div class="modal-title" style="margin:0">第 3 步：把家庭码发给家人</div>';
    html += '<div style="padding:4px 10px;border-radius:999px;background:rgba(99,102,241,.12);color:var(--primary-dark);font-size:.78rem;font-weight:700">创建成功</div>';
    html += '</div>';
    html += '<div class="welcome-desc" style="margin-bottom:14px">你的家庭已经创建好了。家人输入这 6 位家庭码申请加入，通过后就能和你共享同一份记录。</div>';
    html += '<div class="family-code-box">' + escapeHtml(code) + '</div>';
    html += '<div class="family-code-tip">建议现在就把家庭码发给另一台手机。对方提交申请后，你可以在设置页审核。</div>';
    html += '<button class="btn-primary" onclick="UISettings.copyFamilyCodeAndEnter()">复制家庭码并进入今日页</button>';
    html += '<button class="btn-secondary" style="margin-top:8px" onclick="UISettings.enterTodayAfterOnboarding()">稍后再发，先进入今日页</button>';
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
    App.toast('已进入今日页');
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
    var current = baby || { name: '', birthday: '', avatar: '🍼' };
    var avatars = ['🍼', '🐣', '👶', '🌟', '🧸', '🐥', '🐻'];
    var html = '<div class="modal-overlay" onclick="if(event.target===this)UIToday.closeModal()"><div class="modal-sheet">';
    html += '<div class="modal-handle"></div><div class="modal-title">' + (isEdit ? '编辑宝宝' : '添加宝宝') + '</div>';
    html += '<div class="form-group"><label class="form-label">头像</label><div style="display:flex;gap:8px;flex-wrap:wrap">';
    avatars.forEach(function (avatar) {
      var selected = current.avatar === avatar ? 'border:2px solid var(--primary);background:var(--c-sleep)' : '';
      html += '<button onclick="document.getElementById(\'baby-avatar\').value=\'' + avatar + '\';UISettings._selectAvatar(this)" style="font-size:1.5rem;padding:8px;border-radius:10px;' + selected + '" data-avatar="' + avatar + '">' + avatar + '</button>';
    });
    html += '</div><input type="hidden" id="baby-avatar" value="' + escapeAttr(current.avatar) + '"></div>';
    html += '<div class="form-group"><label class="form-label">小名</label><input type="text" class="form-input" id="baby-name" value="' + escapeAttr(current.name || '') + '" placeholder="如：豆豆"></div>';
    html += '<div class="form-group"><label class="form-label">出生日期</label><input type="date" class="form-input" id="baby-birthday" value="' + escapeAttr(current.birthday || '') + '"></div>';
    html += '<button class="btn-primary" onclick="UISettings.saveBaby(' + (isEdit ? '\'' + current.id + '\'' : 'null') + ')">保存</button>';
    if (isEdit) {
      html += '<button class="btn-danger" style="margin-top:8px" onclick="UISettings.deleteBaby(\'' + current.id + '\')">删除此宝宝</button>';
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
      avatar: baby.avatar || '🍼'
    });
  }

  function saveBaby(id) {
    var baby = {
      name: getInputValue('baby-name'),
      birthday: getInputValue('baby-birthday'),
      avatar: getInputValue('baby-avatar') || '🍼'
    };
    if (id) baby.id = id;

    upsertBaby(baby).then(function (saved) {
      return DB.getMeta('currentBabyId').then(function (currentBabyId) {
        if (!currentBabyId) return DB.setMeta('currentBabyId', saved.id);
        return null;
      });
    }).then(function () {
      UIToday.closeModal();
      App.toast('已保存');
      App.renderPage();
    });
  }

  function deleteBaby(id) {
    if (!confirm('删除此宝宝后，相关记录也会一起隐藏，确认继续吗？')) return;
    DB.deleteBaby(id).then(function () {
      return DB.getMeta('currentBabyId');
    }).then(function (currentBabyId) {
      if (currentBabyId === id) return DB.setMeta('currentBabyId', null);
      return null;
    }).then(function () {
      UIToday.closeModal();
      App.toast('已删除');
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
      App.toast(on ? '已添加到首页' : '已从首页移除');
    });
  }

  function createFamilyLocal(silent) {
    return DB.getMeta('memberRole').then(function (role) {
      return Sync.createFamily({ role: role || 'parent', displayName: role || null });
    }).then(function (result) {
      if (!result || !result.success || !result.code) {
        App.toast(result && result.error ? result.error : '创建家庭失败');
        return null;
      }
      return DB.setMeta('familyCode', result.code).then(function () {
        if (!silent) {
          App.toast('家庭码已生成：' + result.code);
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
      App.toast('家庭码已复制');
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
    App.toast('正在同步');
    Sync.sync().then(function (result) {
      App.renderPage();
      if (result && result.error) App.toast('同步失败');
      else App.toast('同步完成');
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
      App.toast('已导出');
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
          App.toast('导入成功');
          App.renderPage();
        });
      } catch (err) {
        App.toast('导入失败，文件格式不正确');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  function formatBabySubtitle(baby) {
    var parts = [];
    if (baby.birthday) parts.push(baby.birthday);
    var days = Calc.daysSinceBirth(baby.birthday);
    if (days != null) parts.push('出生 ' + days + ' 天');
    return parts.join(' · ') || '未设置';
  }

  function formatDateTime(value) {
    if (!value) return '未知';
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
