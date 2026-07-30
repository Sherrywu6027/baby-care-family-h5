var UISettings = (function (BaseUISettings) {
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
      var familyCode = results[3] || null;
      var pendingRequests = results[4] || [];
      var memberState = results[5] || { success: true, members: [] };
      var authUserId = results[6] || null;
      var members = memberState.members || [];
      var currentMember = findCurrentMember(members, authUserId);
      var isCreator = !!(currentMember && currentMember.is_creator);
      var html = '';

      html += '<div class="log-header"><h2 style="font-size:1.2rem">设置</h2></div>';

      html += '<div class="settings-section-title">宝宝档案</div>';
      html += '<div class="settings-group">';
      babies.forEach(function (baby, index) {
        var isCurrentBaby = !!(currentBabyId && baby.id === currentBabyId) || (!currentBabyId && index === 0);
        html += renderBabyCard(baby, isCurrentBaby);
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
          html += '<div class="settings-item" style="display:block"><div class="si-label">当前为本地模式</div><div class="ti-detail" style="margin-top:6px">成员管理需要连接 Supabase 后使用。</div></div>';
        } else if (!memberState.success) {
          html += '<div class="settings-item" style="display:block"><div class="si-label">成员列表加载失败</div><div class="ti-detail" style="margin-top:6px">' + escapeHtml(memberState.error || '请稍后重试') + '</div></div>';
        } else if (!members.length) {
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
          html += renderPendingRequestItem(request);
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

  function renderBabyCard(baby, isCurrentBaby) {
    var style = isCurrentBaby
      ? 'cursor:pointer;background:linear-gradient(180deg, rgba(99,102,241,.045), rgba(99,102,241,.015));box-shadow:inset 0 0 0 1px rgba(99,102,241,.10);'
      : 'cursor:pointer';
    var html = '';
    html += '<div class="baby-card" data-baby-id="' + escapeAttr(baby.id) + '" onclick="UISettings.editBaby(\'' + escapeJs(baby.id) + '\')" style="' + style + '">';
    html += '<div class="baby-avatar">' + escapeHtml(baby.avatar || '👶') + '</div>';
    html += '<div class="baby-info" style="flex:1">';
    html += '<div class="bi-name">' + escapeHtml(baby.name || '宝宝');
    if (isCurrentBaby) {
      html += '<span style="display:inline-flex;align-items:center;margin-left:8px;padding:1px 7px;border-radius:999px;background:rgba(99,102,241,.08);color:rgba(79,70,229,.82);font-size:.68rem;font-weight:600;letter-spacing:.01em;vertical-align:middle">当前查看中</span>';
    }
    html += '</div>';
    html += '<div class="bi-birthday">' + escapeHtml(formatBabySubtitle(baby)) + '</div>';
    html += '</div><span class="si-arrow">›</span></div>';
    return html;
  }

  function renderPendingRequestItem(request) {
    var name = request.display_name || request.role || '新成员';
    var role = request.display_name || request.role || '未填写';
    var html = '';
    html += '<div class="settings-item" style="display:block">';
    html += '<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">';
    html += '<div>';
    html += '<div class="si-label" style="font-weight:700">' + escapeHtml(name) + '</div>';
    html += '<div class="ti-detail" style="margin-top:6px">称呼：' + escapeHtml(role) + '</div>';
    html += '<div class="ti-detail">账号：' + escapeHtml(formatJoinRequesterAccount(request)) + '</div>';
    html += '<div class="ti-detail">申请时间：' + escapeHtml(formatDateTime(request.created_at)) + '</div>';
    html += '</div>';
    html += '<div style="display:flex;gap:8px;flex-shrink:0">';
    html += '<button class="btn-secondary" style="padding:8px 12px" onclick="UISettings.reviewJoinRequest(\'' + escapeJs(request.id) + '\', \'reject\')">拒绝</button>';
    html += '<button class="btn-primary" style="padding:8px 12px" onclick="UISettings.reviewJoinRequest(\'' + escapeJs(request.id) + '\', \'approve\')">同意</button>';
    html += '</div></div></div>';
    return html;
  }

  function renderMemberItem(member, authUserId, isCreator) {
    var name = member.display_name || member.role || '成员';
    var canEdit = !!(isCreator || (authUserId && member.auth_user === authUserId));
    var creatorTag = member.is_creator
      ? '<span style="display:inline-block;margin-left:8px;padding:2px 8px;border-radius:999px;background:#eef2ff;color:var(--primary-dark);font-size:.72rem;font-weight:700">创建者</span>'
      : '';
    var html = '<div class="settings-item" style="display:block">';
    html += '<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">';
    html += '<div style="flex:1">';
    html += '<div class="si-label" style="font-weight:700">' + escapeHtml(name) + creatorTag + '</div>';
    html += '<div class="ti-detail" style="margin-top:6px">称呼：' + escapeHtml(name) + '</div>';
    html += '<div class="ti-detail">加入时间：' + escapeHtml(formatDateTime(member.created_at)) + '</div>';
    if (canEdit) {
      html += '<button class="btn-secondary" style="margin-top:8px;padding:8px 12px" onclick="UISettings.openEditMember(\'' + escapeJs(member.id) + '\')">修改称呼</button>';
    }
    if (isCreator && !member.is_creator) {
      html += '<button class="btn-secondary" style="margin-top:8px;padding:8px 12px" onclick="UISettings.transferCreator(\'' + escapeJs(member.id) + '\')">转让创建者</button>';
      html += '<button class="btn-danger" style="margin-top:8px;padding:0;text-align:right" onclick="UISettings.removeMember(\'' + escapeJs(member.id) + '\')">移除成员</button>';
    }
    if (member.is_creator) {
      html += '<div class="ti-detail" style="margin-top:6px">创建者不可移除，如需退出请先转让。</div>';
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
      detail = '已连接 Supabase，可以创建家庭、提交加入申请，并在多设备间同步。';
    } else if (status.mode === 'cloud-pending-auth') {
      modeLabel = '等待登录';
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

  function findCurrentMember(members, authUserId) {
    return (members || []).filter(function (member) {
      return !!(authUserId && member.auth_user === authUserId);
    })[0] || null;
  }

  function formatJoinRequesterAccount(request) {
    var email = request && request.requester_email ? String(request.requester_email).trim() : '';
    if (email) return email;
    var account = request && request.requester_user ? String(request.requester_user) : '';
    if (!account) return '未提供';
    if (account.length <= 12) return account;
    return account.slice(0, 8) + '...' + account.slice(-6);
  }

  function formatBabySubtitle(baby) {
    var parts = [];
    if (baby && baby.birthday) parts.push(baby.birthday);
    var days = Calc.daysSinceBirth(baby && baby.birthday);
    if (days != null) parts.push('出生 ' + days + ' 天');
    return parts.join(' · ') || '未设置';
  }

  function formatDateTime(value) {
    if (!value) return '未知';
    return new Date(value).toLocaleString('zh-CN');
  }

  function escapeAttr(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeJs(value) {
    return String(value || '')
      .replace(/\\/g, '\\\\')
      .replace(/'/g, '\\\'');
  }

  var next = {};
  Object.keys(BaseUISettings).forEach(function (key) {
    next[key] = BaseUISettings[key];
  });
  next.render = render;
  return next;
})(UISettings);
