var Sync = (function () {
  var client = null;
  var configured = false;
  var ready = false;
  var syncing = false;
  var syncPromise = null;
  var lastSync = null;
  var lastError = '';
  var stateListeners = [];
  var remoteSchemaMode = 'unknown';
  var loaderPromise = null;
  var CDN_URLS = [
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js',
    'https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.min.js'
  ];

  function init() {
    return ensureClientId().then(function () {
      configured = !!(SUPABASE_CONFIG && SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey);
      lastError = '';
      if (!configured) {
        client = null;
        ready = false;
        return hydrateSyncMeta();
      }
      return hydrateSyncMeta().then(function () {
        return ensureClientLibrary();
      }).then(function () {
        client = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
          },
          global: {
            headers: {
              'x-application-name': 'chuya-h5'
            }
          }
        });
        return ensureSession();
      }).then(function () {
        ready = true;
        return DB.setMeta('syncProvider', 'supabase').catch(function () {});
      }).catch(function (error) {
        client = null;
        ready = false;
        lastError = getErrorMessage(error);
      }).then(function () {
        return getSyncStatus();
      });
    });
  }

  function hydrateSyncMeta() {
    return DB.getLastSyncAt().then(function (value) {
      lastSync = value || null;
    });
  }

  function ensureClientId() {
    return DB.getMeta('clientId').then(function (current) {
      if (current) return current;
      var clientId = 'client_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      return DB.setMeta('clientId', clientId).then(function () { return clientId; });
    });
  }

  function isConfigured() {
    return configured;
  }

  function isReady() {
    return configured && ready && !!client;
  }

  function getClient() {
    return client;
  }

  function getSyncStatus() {
    return {
      configured: configured,
      ready: isReady(),
      online: navigator.onLine,
      hasClient: !!client,
      mode: isReady() ? 'cloud-ready' : (configured ? 'cloud-pending' : 'local-only'),
      syncing: syncing,
      lastSync: lastSync,
      lastError: lastError
    };
  }

  function emitSyncState(state) {
    stateListeners.forEach(function (listener) {
      try {
        listener(state);
      } catch (e) {}
    });
  }

  function onStateChange(listener) {
    if (typeof listener !== 'function') return function () {};
    stateListeners.push(listener);
    return function () {
      stateListeners = stateListeners.filter(function (item) {
        return item !== listener;
      });
    };
  }

  function sync(options) {
    options = options || {};
    if (syncPromise) return syncPromise;
    if (!navigator.onLine) emitSyncState('offline');
    syncPromise = performSync(options).finally(function () {
      syncPromise = null;
      syncing = false;
    });
    return syncPromise;
  }

  function performSync(options) {
    options = options || {};
    syncing = true;
    lastError = '';
    emitSyncState('syncing');

    if (!configured) {
      syncing = false;
      emitSyncState('idle');
      return Promise.resolve({
        synced: 0,
        skipped: true,
        reason: 'not_configured'
      });
    }

    return ensureReady().then(function () {
      return ensureFamilyContext();
    }).then(function (familyId) {
      if (!familyId) {
        return { synced: 0, skipped: true, reason: 'no_family' };
      }
      var ctx = { familyId: familyId, maxUpdatedAt: lastSync };
      return pushPendingChanges(ctx).then(function (pushResult) {
        return pullRemoteChanges(ctx).then(function (pullResult) {
          var finalSyncAt = ctx.maxUpdatedAt || new Date().toISOString();
          lastSync = finalSyncAt;
          return DB.setLastSyncAt(finalSyncAt).then(function () {
          return {
            synced: (pushResult.synced || 0) + (pullResult.synced || 0),
              pushed: pushResult,
              pulled: pullResult,
              lastSync: finalSyncAt,
              silent: !!options.silent
            };
          });
        });
      });
    }).catch(function (error) {
      lastError = getErrorMessage(error);
      emitSyncState(navigator.onLine ? 'error' : 'offline');
      return {
        synced: 0,
        skipped: true,
        reason: 'error',
        error: lastError
      };
    }).then(function (result) {
      if (result && result.reason !== 'error') emitSyncState(navigator.onLine ? 'idle' : 'offline');
      return result;
    });
  }

  function ensureReady() {
    if (isReady()) return Promise.resolve();
    return init().then(function () {
      if (!isReady()) throw new Error(lastError || 'sync_not_ready');
    });
  }

  function ensureFamilyContext() {
    return DB.getMeta('familyId');
  }

  function createFamily(options) {
    options = options || {};
    var role = options.role || 'parent';
    var displayName = typeof options.displayName === 'string' ? options.displayName : null;

    if (!configured) {
      var localCode = generateFamilyCode();
      return DB.setMeta('familyCode', localCode).then(function () {
        return DB.setMeta('familyId', null);
      }).then(function () {
        return {
          success: true,
          code: localCode,
          local_placeholder: true
        };
      });
    }

    return ensureReady().then(function () {
      return client.rpc('create_family', {
        p_role: role,
        p_display_name: displayName
      });
    }).then(function (result) {
      if (result.error) throw result.error;
      var row = Array.isArray(result.data) ? result.data[0] : result.data;
      if (!row || !row.family_id || !row.family_code) {
        throw new Error('create_family returned empty result');
      }
      return DB.setMeta('familyId', row.family_id).then(function () {
        return DB.setMeta('familyCode', row.family_code);
      }).then(function () {
        return DB.setLastSyncAt(null);
      }).then(function () {
        lastSync = null;
        return {
          success: true,
          code: row.family_code,
          familyId: row.family_id
        };
      });
    }).catch(function (error) {
      lastError = getErrorMessage(error);
      return {
        success: false,
        error: lastError
      };
    });
  }

  function joinFamily(code, options) {
    options = options || {};
    var role = options.role || 'parent';
    var displayName = typeof options.displayName === 'string' ? options.displayName : null;

    if (!/^\d{6}$/.test(code || '')) {
      return Promise.resolve({
        success: false,
        error: '请输入 6 位家庭码'
      });
    }

    if (!configured) {
      return DB.setMeta('familyCode', code).then(function () {
        return {
          success: true,
          local_placeholder: true,
          request_status: 'pending'
        };
      });
    }

    return ensureReady().then(function () {
      return client.rpc('request_join_family', {
        p_code: code,
        p_role: role,
        p_display_name: displayName
      });
    }).then(function (result) {
      if (result.error) throw result.error;
      var row = Array.isArray(result.data) ? result.data[0] : result.data;
      var familyId = row ? (row.family_id || row.result_family_id || null) : null;
      var familyCode = row ? (row.family_code || row.result_family_code || null) : null;
      var requestId = row ? (row.request_id || row.result_request_id || null) : null;
      var requestStatus = row ? (row.request_status || row.result_request_status || null) : null;
      if (!row || !familyCode) {
        throw new Error('request_join_family returned empty result');
      }
      return DB.setMeta('pendingJoinCode', familyCode).then(function () {
        return DB.setMeta('pendingJoinRequestedAt', nowIso());
      }).then(function () {
        return {
          success: true,
          familyId: familyId,
          familyCode: familyCode,
          requestId: requestId,
          requestStatus: requestStatus || 'pending',
          already_member: requestStatus === 'already_member'
        };
      });
    }).catch(function (error) {
      lastError = getErrorMessage(error);
      return {
        success: false,
        error: lastError
      };
    });
  }

  function getJoinRequestStatus(code) {
    if (!configured) {
      return Promise.resolve({
        success: true,
        status: 'pending',
        local_placeholder: true,
        familyCode: code || null
      });
    }
    return ensureReady().then(function () {
      var query = client.from('join_requests')
        .select('id, family_id, family_code, role, display_name, status, reviewed_at, created_at')
        .order('created_at', { ascending: false })
        .limit(1);
      if (code) query = query.eq('family_code', code);
      return query;
    }).then(function (result) {
      if (result.error) throw result.error;
      var row = (result.data || [])[0] || null;
      return {
        success: true,
        request: row,
        status: row ? row.status : 'none',
        familyId: row ? row.family_id : null,
        familyCode: row ? row.family_code : code || null
      };
    }).catch(function (error) {
      lastError = getErrorMessage(error);
      return {
        success: false,
        error: lastError
      };
    });
  }

  function activateApprovedJoin(request) {
    if (!request || request.status !== 'approved' || !request.family_id || !request.family_code) {
      return Promise.resolve({
        success: false,
        error: 'join_request_not_approved'
      });
    }
    return DB.setMeta('familyId', request.family_id).then(function () {
      return DB.setMeta('familyCode', request.family_code);
    }).then(function () {
      return DB.setMeta('pendingJoinCode', null);
    }).then(function () {
      return DB.setMeta('pendingJoinRequestedAt', null);
    }).then(function () {
      return DB.setLastSyncAt(null);
    }).then(function () {
      lastSync = null;
      return sync({ silent: true });
    }).then(function () {
      return {
        success: true,
        familyId: request.family_id,
        familyCode: request.family_code
      };
    }).catch(function (error) {
      lastError = getErrorMessage(error);
      return {
        success: false,
        error: lastError
      };
    });
  }

  function listPendingJoinRequests() {
    if (!configured) return Promise.resolve([]);
    return ensureReady().then(function () {
      return DB.getMeta('familyId');
    }).then(function (familyId) {
      if (!familyId) return [];
      return client.from('join_requests')
        .select('id, family_id, family_code, requester_user, requester_email, role, display_name, status, created_at, reviewed_at')
        .eq('family_id', familyId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .then(function (result) {
          if (result.error) throw result.error;
          return result.data || [];
        });
    }).catch(function (error) {
      lastError = getErrorMessage(error);
      return [];
    });
  }

  function reviewJoinRequest(requestId, action) {
    if (!configured) {
      return Promise.resolve({
        success: false,
        error: 'local_mode_no_review'
      });
    }
    return ensureReady().then(function () {
      return client.rpc('review_join_request', {
        p_request_id: requestId,
        p_action: action
      });
    }).then(function (result) {
      if (result.error) throw result.error;
      var row = Array.isArray(result.data) ? result.data[0] : result.data;
      return {
        success: true,
        request: row ? {
          id: row.request_id || row.result_request_id || null,
          family_id: row.family_id || row.result_family_id || null,
          family_code: row.family_code || row.result_family_code || null,
          status: row.request_status || row.result_request_status || null,
          member_id: row.member_id || row.result_member_id || null
        } : null
      };
    }).catch(function (error) {
      lastError = getErrorMessage(error);
      return {
        success: false,
        error: lastError
      };
    });
  }

  function listFamilyMembers() {
    if (!configured) {
      return Promise.resolve({
        success: true,
        members: []
      });
    }
    return ensureReady().then(function () {
      return client.rpc('list_family_members');
    }).then(function (result) {
      if (result.error) throw result.error;
      return {
        success: true,
        members: (result.data || []).map(function (row) {
          return {
            id: row.member_id || row.result_member_id || null,
            family_id: row.family_id || row.result_family_id || null,
            auth_user: row.auth_user || row.result_auth_user || null,
            role: row.role || row.result_role || '',
            display_name: row.display_name || row.result_display_name || '',
            is_creator: row.is_creator != null ? row.is_creator : row.result_is_creator,
            created_at: row.created_at || row.result_created_at || null
          };
        })
      };
    }).catch(function (error) {
      lastError = getErrorMessage(error);
      return {
        success: false,
        error: lastError,
        members: []
      };
    });
  }

  function removeFamilyMember(memberId) {
    if (!configured) {
      return Promise.resolve({
        success: false,
        error: 'local_mode_no_member_management'
      });
    }
    return ensureReady().then(function () {
      return client.rpc('remove_family_member', {
        p_member_id: memberId
      });
    }).then(function (result) {
      if (result.error) throw result.error;
      var row = Array.isArray(result.data) ? result.data[0] : result.data;
      return {
        success: true,
        removed: !!(row && (row.removed || row.result_removed)),
        memberId: row ? (row.member_id || row.result_member_id || memberId) : memberId
      };
    }).catch(function (error) {
      lastError = getErrorMessage(error);
      return {
        success: false,
        error: lastError
      };
    });
  }

  function updateFamilyMember(memberId, options) {
    options = options || {};
    return ensureReady().then(function () {
      return client.rpc('update_family_member', {
        p_member_id: memberId,
        p_role: options.role || null,
        p_display_name: options.displayName || null
      });
    }).then(function (result) {
      if (result.error) throw result.error;
      var row = Array.isArray(result.data) ? result.data[0] : result.data;
      return {
        success: true,
        member: row ? {
          id: row.member_id || row.result_member_id || memberId,
          family_id: row.family_id || row.result_family_id || null,
          role: row.role || row.result_role || '',
          display_name: row.display_name || row.result_display_name || ''
        } : null
      };
    }).catch(function (error) {
      lastError = getErrorMessage(error);
      return {
        success: false,
        error: lastError
      };
    });
  }

  function transferFamilyCreator(memberId) {
    return ensureReady().then(function () {
      return client.rpc('transfer_family_creator', {
        p_member_id: memberId
      });
    }).then(function (result) {
      if (result.error) throw result.error;
      var row = Array.isArray(result.data) ? result.data[0] : result.data;
      return {
        success: true,
        familyId: row ? (row.family_id || row.result_family_id || null) : null,
        memberId: row ? (row.member_id || row.result_member_id || memberId) : memberId,
        creatorUser: row ? (row.creator_user || row.result_creator_user || null) : null
      };
    }).catch(function (error) {
      lastError = getErrorMessage(error);
      return {
        success: false,
        error: lastError
      };
    });
  }

  function leaveFamily() {
    return ensureReady().then(function () {
      return client.rpc('leave_family');
    }).then(function (result) {
      if (result.error) throw result.error;
      var row = Array.isArray(result.data) ? result.data[0] : result.data;
      return {
        success: true,
        familyId: row ? (row.family_id || row.result_family_id || null) : null,
        left: !!(row && (row.left || row.result_left))
      };
    }).catch(function (error) {
      lastError = getErrorMessage(error);
      return {
        success: false,
        error: lastError
      };
    });
  }

  function pushPendingChanges(ctx) {
    return Promise.all([
      DB.getPendingBabies(),
      DB.getPendingEvents()
    ]).then(function (lists) {
      var pendingBabies = lists[0];
      var pendingEvents = lists[1];
      return pushBabies(ctx.familyId, pendingBabies, ctx).then(function (babyCount) {
        return pushEvents(ctx.familyId, pendingEvents, ctx).then(function (eventCount) {
          return { synced: babyCount + eventCount };
        });
      });
    });
  }

  function pushBabies(familyId, babies, ctx) {
    if (!babies.length) return Promise.resolve(0);
    if (remoteSchemaMode === 'legacy') {
      return pushBabiesLegacy(familyId, babies, ctx);
    }
    var payload = babies.map(function (baby) {
      return {
        id: baby.id,
        family_id: baby.family_id || familyId,
        name: baby.name || null,
        birthday: baby.birthday || null,
        avatar: baby.avatar || null,
        sort: baby.sort || 0,
        created_at: baby.created_at || nowIso(),
        updated_at: baby.updated_at || nowIso(),
        deleted_at: baby.deleted_at || null,
        client_id: baby.client_id || null,
        sync_status: baby.deleted_at ? 'deleted' : 'cloud'
      };
    });
    return client.from('babies')
      .upsert(payload, { onConflict: 'id' })
      .select('id, updated_at, deleted_at')
      .then(function (result) {
        if (result.error) {
          if (shouldFallbackToLegacySchema(result.error)) {
            remoteSchemaMode = 'legacy';
            return pushBabiesLegacy(familyId, babies, ctx);
          }
          throw result.error;
        }
        var rows = result.data || [];
        var chain = Promise.resolve();
        rows.forEach(function (row) {
          chain = chain.then(function () {
            rememberMaxUpdatedAt(ctx, row.updated_at);
            return DB.markBabySynced(row.id, row.updated_at, row.deleted_at || null);
          });
        });
        return chain.then(function () { return rows.length; });
      });
  }

  function pushEvents(familyId, events, ctx) {
    if (!events.length) return Promise.resolve(0);
    if (remoteSchemaMode === 'legacy') {
      return pushEventsLegacy(familyId, events, ctx);
    }
    var payload = events.map(function (event) {
      return {
        id: event.id,
        family_id: event.family_id || familyId,
        baby_id: event.baby_id || null,
        type: event.type,
        start_time: event.start_time,
        end_time: event.end_time || null,
        amount_ml: event.amount_ml != null ? event.amount_ml : null,
        duration_sec: event.duration_sec != null ? event.duration_sec : null,
        duration_min: event.duration_min != null ? event.duration_min : null,
        left_sec: event.left_sec != null ? event.left_sec : null,
        right_sec: event.right_sec != null ? event.right_sec : null,
        left_min: event.left_min != null ? event.left_min : null,
        right_min: event.right_min != null ? event.right_min : null,
        stool: event.stool != null ? event.stool : false,
        stool_amount: event.stool_amount != null ? event.stool_amount : null,
        height_cm: event.height_cm != null ? event.height_cm : null,
        weight_kg: event.weight_kg != null ? event.weight_kg : null,
        note: event.note || null,
        extra_note: event.extra_note || null,
        recorded_by_user: event.recorded_by_user || null,
        recorded_by_name: event.recorded_by_name || null,
        created_at: event.created_at || nowIso(),
        updated_at: event.updated_at || nowIso(),
        deleted_at: event.deleted_at || null,
        client_id: event.client_id || null,
        sync_status: event.deleted_at ? 'deleted' : 'cloud'
      };
    });
    return client.from('events')
      .upsert(payload, { onConflict: 'id' })
      .select('id, updated_at, deleted_at')
      .then(function (result) {
        if (result.error) {
          if (shouldFallbackToLegacySchema(result.error)) {
            remoteSchemaMode = 'legacy';
            return pushEventsLegacy(familyId, events, ctx);
          }
          throw result.error;
        }
        var rows = result.data || [];
        var chain = Promise.resolve();
        rows.forEach(function (row) {
          chain = chain.then(function () {
            rememberMaxUpdatedAt(ctx, row.updated_at);
            return DB.markEventSynced(row.id, row.updated_at, row.deleted_at || null);
          });
        });
        return chain.then(function () { return rows.length; });
      });
  }

  function pushBabiesLegacy(familyId, babies, ctx) {
    return pushRowsLegacy('babies', familyId, babies, ctx, {
      buildUpsertPayload: buildLegacyBabyPayload,
      markSynced: DB.markBabySynced
    });
  }

  function pushEventsLegacy(familyId, events, ctx) {
    return pushRowsLegacy('events', familyId, events, ctx, {
      buildUpsertPayload: buildLegacyEventPayload,
      markSynced: DB.markEventSynced
    });
  }

  function pushRowsLegacy(table, familyId, rows, ctx, options) {
    var upserts = rows.filter(function (row) { return !row.deleted_at; });
    var deletes = rows.filter(function (row) { return !!row.deleted_at; });

    return runLegacyDeleteBatch(table, familyId, deletes, ctx, options.markSynced).then(function (deleteCount) {
      if (!upserts.length) return deleteCount;
      var payload = upserts.map(function (row) {
        return options.buildUpsertPayload(row, familyId);
      });
      return client.from(table)
        .upsert(payload, { onConflict: 'id' })
        .select('id, updated_at')
        .then(function (result) {
          if (result.error) throw result.error;
          var remoteRows = result.data || [];
          var chain = Promise.resolve();
          remoteRows.forEach(function (row) {
            chain = chain.then(function () {
              rememberMaxUpdatedAt(ctx, row.updated_at);
              return options.markSynced(row.id, row.updated_at);
            });
          });
          return chain.then(function () {
            return deleteCount + remoteRows.length;
          });
        });
    });
  }

  function runLegacyDeleteBatch(table, familyId, rows, ctx, markSynced) {
    var chain = Promise.resolve(0);
    rows.forEach(function (row) {
      chain = chain.then(function (count) {
        return client.from(table)
          .delete()
          .eq('id', row.id)
          .eq('family_id', row.family_id || familyId)
          .then(function (result) {
            if (result.error) throw result.error;
            rememberMaxUpdatedAt(ctx, row.updated_at);
            return markSynced(row.id, row.updated_at, row.deleted_at).then(function () {
              return count + 1;
            });
          });
      });
    });
    return chain;
  }

  function buildLegacyBabyPayload(baby, familyId) {
    return {
      id: baby.id,
      family_id: baby.family_id || familyId,
      name: baby.name || null,
      birthday: baby.birthday || null,
      avatar: baby.avatar || null,
      sort: baby.sort || 0,
      created_at: baby.created_at || nowIso(),
      updated_at: baby.updated_at || nowIso()
    };
  }

  function buildLegacyEventPayload(event, familyId) {
    return {
      id: event.id,
      family_id: event.family_id || familyId,
      baby_id: event.baby_id || null,
      type: event.type,
      start_time: event.start_time,
      end_time: event.end_time || null,
      amount_ml: event.amount_ml != null ? event.amount_ml : null,
      duration_sec: event.duration_sec != null ? event.duration_sec : null,
      duration_min: event.duration_min != null ? event.duration_min : null,
      left_sec: event.left_sec != null ? event.left_sec : null,
      right_sec: event.right_sec != null ? event.right_sec : null,
      left_min: event.left_min != null ? event.left_min : null,
      right_min: event.right_min != null ? event.right_min : null,
      stool: event.stool != null ? event.stool : false,
      stool_amount: event.stool_amount != null ? event.stool_amount : null,
      height_cm: event.height_cm != null ? event.height_cm : null,
      weight_kg: event.weight_kg != null ? event.weight_kg : null,
      note: event.note || null,
      extra_note: event.extra_note || null,
      recorded_by_user: event.recorded_by_user || null,
      recorded_by_name: event.recorded_by_name || null,
      created_at: event.created_at || nowIso(),
      updated_at: event.updated_at || nowIso()
    };
  }

  function pullRemoteChanges(ctx) {
    var lastSyncAt = lastSync;
    return Promise.all([
      fetchRemoteTable('babies', ctx.familyId, lastSyncAt),
      fetchRemoteTable('events', ctx.familyId, lastSyncAt)
    ]).then(function (lists) {
      var babies = lists[0];
      var events = lists[1];
      babies.forEach(function (row) { rememberMaxUpdatedAt(ctx, row.updated_at); });
      events.forEach(function (row) { rememberMaxUpdatedAt(ctx, row.updated_at); });
      return DB.mergeRemoteBabies(babies).then(function () {
        return DB.mergeRemoteEvents(events);
      }).then(function () {
        return DB.getMeta('currentBabyId');
      }).then(function (currentBabyId) {
        return DB.getBabies().then(function (babiesList) {
          if (!currentBabyId && babiesList.length > 0) {
            return DB.setMeta('currentBabyId', babiesList[0].id);
          }
          return null;
        });
      }).then(function () {
        return { synced: babies.length + events.length };
      });
    });
  }

  function fetchRemoteTable(table, familyId, lastSyncAt) {
    var query = client.from(table).select('*').eq('family_id', familyId).order('updated_at', { ascending: true });
    if (lastSyncAt) query = query.gt('updated_at', lastSyncAt);
    return query.then(function (result) {
      if (result.error) throw result.error;
      return result.data || [];
    });
  }

  function rememberMaxUpdatedAt(ctx, candidate) {
    if (!candidate) return;
    if (!ctx.maxUpdatedAt || new Date(candidate).getTime() > new Date(ctx.maxUpdatedAt).getTime()) {
      ctx.maxUpdatedAt = candidate;
    }
  }

  function ensureSession() {
    if (!client || !client.auth) throw new Error('Supabase client not ready');
    return client.auth.getSession().then(function (result) {
      if (result.error) throw result.error;
      if (result.data && result.data.session) return persistSessionUser(result.data.session);
      return client.auth.signInAnonymously().then(function (signIn) {
        if (signIn.error) throw signIn.error;
        return persistSessionUser(signIn.data ? signIn.data.session : null);
      });
    }).catch(function (error) {
      if (!shouldTryAnonymousFallback(error)) throw error;
      return signInAnonymouslyViaRest();
    });
  }

  function shouldTryAnonymousFallback(error) {
    var msg = getErrorMessage(error);
    return /failed to fetch/i.test(msg) || /networkerror/i.test(msg);
  }

  function signInAnonymouslyViaRest() {
    var baseUrl = String((SUPABASE_CONFIG && SUPABASE_CONFIG.url) || '').replace(/\/$/, '');
    return fetch(baseUrl + '/auth/v1/signup', {
      method: 'POST',
      headers: {
        apikey: SUPABASE_CONFIG.anonKey,
        'Content-Type': 'application/json'
      },
      body: '{}'
    }).then(function (response) {
      if (!response.ok) {
        return response.text().then(function (text) {
          throw new Error(text || 'anonymous_sign_in_failed');
        });
      }
      return response.json();
    }).then(function (data) {
      if (!data || !data.access_token || !data.refresh_token) {
        throw new Error('anonymous_sign_in_missing_token');
      }
      return client.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token
      }).then(function (result) {
        if (result.error) throw result.error;
        return persistSessionUser(result.data ? result.data.session : null);
      });
    });
  }

  function persistSessionUser(session) {
    var userId = session && session.user && session.user.id ? session.user.id : null;
    return DB.setMeta('authUserId', userId).catch(function () {
      return null;
    }).then(function () {
      return session;
    });
  }

  function ensureClientLibrary() {
    if (window.supabase && window.supabase.createClient) {
      return Promise.resolve(window.supabase);
    }
    if (loaderPromise) return loaderPromise;
    loaderPromise = loadClientLibrary(0);
    return loaderPromise;
  }

  function loadClientLibrary(index) {
    if (window.supabase && window.supabase.createClient) {
      return Promise.resolve(window.supabase);
    }
    if (index >= CDN_URLS.length) {
      return Promise.reject(new Error('Supabase browser SDK load failed'));
    }
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[data-supabase-cdn="' + index + '"]');
      if (existing) {
        existing.addEventListener('load', function () { resolve(window.supabase); }, { once: true });
        existing.addEventListener('error', function () {
          loadClientLibrary(index + 1).then(resolve).catch(reject);
        }, { once: true });
        return;
      }

      var script = document.createElement('script');
      script.src = CDN_URLS[index];
      script.async = true;
      script.dataset.supabaseCdn = String(index);
      script.onload = function () {
        if (window.supabase && window.supabase.createClient) resolve(window.supabase);
        else loadClientLibrary(index + 1).then(resolve).catch(reject);
      };
      script.onerror = function () {
        loadClientLibrary(index + 1).then(resolve).catch(reject);
      };
      document.head.appendChild(script);
    });
  }

  function generateFamilyCode() {
    var code = '';
    for (var i = 0; i < 6; i += 1) code += Math.floor(Math.random() * 10);
    return code;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function getErrorMessage(error) {
    if (!error) return '';
    if (typeof error === 'string') return error;
    var message = error.message || String(error);
    return normalizeSyncErrorMessage(message);
  }

  function shouldFallbackToLegacySchema(error) {
    var message = getErrorMessage(error);
    return /Could not find the '.*' column of '.*' in the schema cache/i.test(message);
  }

  function normalizeSyncErrorMessage(message) {
    if (!message) return '';
    if (/stack depth limit exceeded/i.test(message)) {
      return '云端权限函数递归，请在 Supabase 重新执行最新的 supabase/schema.sql。';
    }
    return message;
  }

  return {
    init: init,
    isConfigured: isConfigured,
    isReady: isReady,
    getClient: getClient,
    getSyncStatus: getSyncStatus,
    sync: sync,
    createFamily: createFamily,
    joinFamily: joinFamily,
    getJoinRequestStatus: getJoinRequestStatus,
    activateApprovedJoin: activateApprovedJoin,
    onStateChange: onStateChange,
    listPendingJoinRequests: listPendingJoinRequests,
    reviewJoinRequest: reviewJoinRequest,
    listFamilyMembers: listFamilyMembers,
    removeFamilyMember: removeFamilyMember,
    updateFamilyMember: updateFamilyMember,
    transferFamilyCreator: transferFamilyCreator,
    leaveFamily: leaveFamily
  };
})();
