var DB = (function () {
  var DB_NAME = 'babycare';
  var DB_VERSION = 2;
  var db = null;

  function open() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        var database = req.result;
        var eventsStore = database.objectStoreNames.contains('events')
          ? req.transaction.objectStore('events')
          : database.createObjectStore('events', { keyPath: 'id' });
        var babiesStore = database.objectStoreNames.contains('babies')
          ? req.transaction.objectStore('babies')
          : database.createObjectStore('babies', { keyPath: 'id' });
        if (!database.objectStoreNames.contains('meta')) {
          database.createObjectStore('meta', { keyPath: 'key' });
        }

        ensureIndex(eventsStore, 'baby_id', 'baby_id');
        ensureIndex(eventsStore, 'start_time', 'start_time');
        ensureIndex(eventsStore, 'type', 'type');
        ensureIndex(eventsStore, 'sync_status', 'sync_status');
        ensureIndex(eventsStore, 'updated_at', 'updated_at');
        ensureIndex(babiesStore, 'sync_status', 'sync_status');
        ensureIndex(babiesStore, 'updated_at', 'updated_at');
      };
      req.onsuccess = function () {
        db = req.result;
        migrateLegacyIds().then(function () {
          resolve(db);
        }).catch(function (error) {
          reject(error);
        });
      };
      req.onerror = function () {
        reject(req.error);
      };
    });
  }

  function ensureIndex(store, name, keyPath) {
    if (!store.indexNames.contains(name)) {
      store.createIndex(name, keyPath, { unique: false });
    }
  }

  function tx(store, mode) {
    return db.transaction(store, mode).objectStore(store);
  }

  function req2promise(req) {
    return new Promise(function (resolve, reject) {
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function genId(prefix) {
    return createUuid();
  }

  function createUuid() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (ch) {
      var rand = Math.random() * 16 | 0;
      var value = ch === 'x' ? rand : (rand & 0x3 | 0x8);
      return value.toString(16);
    });
  }

  function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
  }

  function compareIso(a, b) {
    var aTime = a ? new Date(a).getTime() : 0;
    var bTime = b ? new Date(b).getTime() : 0;
    if (aTime === bTime) return 0;
    return aTime > bTime ? 1 : -1;
  }

  function isPending(status) {
    return status === 'pending_create' || status === 'pending_update' || status === 'pending_delete';
  }

  function getFamilyAndClient() {
    return Promise.all([getMeta('familyId'), getMeta('clientId')]);
  }

  function getRecorderMeta() {
    return Promise.all([
      getMeta('memberDisplayName'),
      getMeta('memberRole'),
      getMeta('authUserId')
    ]).then(function (values) {
      return {
        recordedByName: values[0] || values[1] || '未命名成员',
        recordedByUser: values[2] || null
      };
    });
  }

  function normalizeRemoteRecord(record) {
    var next = Object.assign({}, record);
    next.sync_status = next.sync_status || 'synced';
    next.last_synced_at = next.last_synced_at || next.updated_at || nowIso();
    return next;
  }

  function addEvent(event) {
    var rec = Object.assign({}, event);
    if (!rec.id) rec.id = genId('evt');
    return Promise.all([getFamilyAndClient(), getRecorderMeta()]).then(function (results) {
      var meta = results[0];
      var recorder = results[1];
      var familyId = meta[0];
      var clientId = meta[1];
      var stamp = nowIso();
      rec.family_id = rec.family_id || familyId || null;
      rec.client_id = rec.client_id || clientId || null;
      rec.recorded_by_user = rec.recorded_by_user || recorder.recordedByUser;
      rec.recorded_by_name = rec.recorded_by_name || recorder.recordedByName;
      rec.created_at = rec.created_at || stamp;
      rec.updated_at = stamp;
      rec.deleted_at = rec.deleted_at || null;
      rec.last_synced_at = null;
      rec.sync_status = rec.sync_status || 'pending_create';
      return req2promise(tx('events', 'readwrite').put(rec)).then(function () {
        return rec;
      });
    });
  }

  function updateEvent(id, updates) {
    return getEvent(id).then(function (old) {
      if (!old) return null;
      var nextStatus = old.sync_status === 'pending_create' ? 'pending_create' : 'pending_update';
      var merged = Object.assign({}, old, updates, {
        updated_at: nowIso(),
        sync_status: nextStatus
      });
      return req2promise(tx('events', 'readwrite').put(merged)).then(function () {
        return merged;
      });
    });
  }

  function softDeleteEvent(id) {
    return getEvent(id).then(function (old) {
      if (!old) return null;
      var stamp = nowIso();
      var next = Object.assign({}, old, {
        deleted_at: stamp,
        updated_at: stamp,
        sync_status: 'pending_delete'
      });
      return req2promise(tx('events', 'readwrite').put(next)).then(function () {
        return next;
      });
    });
  }

  function deleteEvent(id) {
    return softDeleteEvent(id);
  }

  function getEventCreatedSortTime(event) {
    if (!event) return 0;
    return new Date(event.created_at || event.updated_at || event.start_time || 0).getTime() || 0;
  }

  function getEvent(id) {
    return req2promise(tx('events', 'readonly').get(id));
  }

  function getEventsByDay(babyId, dateStr) {
    return new Promise(function (resolve, reject) {
      var range = window.TimeUtil
        ? TimeUtil.getChinaDayRange(dateStr)
        : {
            startMs: new Date(dateStr + 'T00:00:00').getTime(),
            endMs: new Date(dateStr + 'T23:59:59.999').getTime()
          };
      var idx = tx('events', 'readonly').index('baby_id');
      var results = [];
      var req = idx.openCursor(IDBKeyRange.only(babyId));
      req.onsuccess = function (e) {
        var cursor = e.target.result;
        if (cursor) {
          var record = cursor.value;
          var st = new Date(record.start_time).getTime();
          if (!record.deleted_at && st >= range.startMs && st <= range.endMs) results.push(record);
          cursor.continue();
        } else {
          results.sort(function (a, b) { return getEventCreatedSortTime(b) - getEventCreatedSortTime(a); });
          resolve(results);
        }
      };
      req.onerror = function () { reject(req.error); };
    });
  }

  function getAllEvents(babyId) {
    return new Promise(function (resolve, reject) {
      var idx = tx('events', 'readonly').index('baby_id');
      var results = [];
      var req = idx.openCursor(IDBKeyRange.only(babyId));
      req.onsuccess = function (e) {
        var cursor = e.target.result;
        if (cursor) {
          if (!cursor.value.deleted_at) results.push(cursor.value);
          cursor.continue();
        } else {
          results.sort(function (a, b) { return getEventCreatedSortTime(b) - getEventCreatedSortTime(a); });
          resolve(results);
        }
      };
      req.onerror = function () { reject(req.error); };
    });
  }

  function getRecentFeeds(babyId, limit) {
    return new Promise(function (resolve, reject) {
      var idx = tx('events', 'readonly').index('baby_id');
      var results = [];
      var req = idx.openCursor(IDBKeyRange.only(babyId));
      req.onsuccess = function (e) {
        var cursor = e.target.result;
        if (cursor) {
          var record = cursor.value;
          if (!record.deleted_at && FEED_TYPES.indexOf(record.type) >= 0) results.push(record);
          cursor.continue();
        } else {
          results.sort(function (a, b) { return getFeedSortTime(b) - getFeedSortTime(a); });
          resolve(results.slice(0, limit || 5));
        }
      };
      req.onerror = function () { reject(req.error); };
    });
  }

  function getFeedSortTime(event) {
    if (!event) return 0;
    var startMs = new Date(event.start_time).getTime() || 0;
    if (event.end_time) return new Date(event.end_time).getTime() || startMs;
    if (event.type === 'milk_direct') return startMs + getDirectFeedDurationMs(event);
    return startMs;
  }

  function getDirectFeedDurationMs(event) {
    if (!event) return 0;
    if (needsLegacyDirectManualFix(event)) {
      var legacyMinutes = (Number(event.left_min) || 0) + (Number(event.right_min) || 0) || (Number(event.duration_min) || 0);
      return Math.round(legacyMinutes * 3600000);
    }
    if (event.duration_sec != null) return Math.max(0, Math.round(Number(event.duration_sec) || 0) * 1000);
    if (event.left_sec != null || event.right_sec != null) {
      return Math.max(0, Math.round(((Number(event.left_sec) || 0) + (Number(event.right_sec) || 0)) * 1000));
    }
    if (event.duration_min != null) return Math.max(0, Math.round((Number(event.duration_min) || 0) * 60000));
    return 0;
  }

  function needsLegacyDirectManualFix(event) {
    return !!(event && event.type === 'milk_direct' && !event.end_time && event.duration_min != null && Number(event.duration_min) > 0 && Number(event.duration_min) < 1);
  }

  function getBabies() {
    return new Promise(function (resolve, reject) {
      var store = tx('babies', 'readonly');
      var results = [];
      var req = store.openCursor();
      req.onsuccess = function (e) {
        var cursor = e.target.result;
        if (cursor) {
          if (!cursor.value.deleted_at) results.push(cursor.value);
          cursor.continue();
        } else {
          results.sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); });
          resolve(results);
        }
      };
      req.onerror = function () { reject(req.error); };
    });
  }

  function getBaby(id) {
    return req2promise(tx('babies', 'readonly').get(id));
  }

  function upsertBaby(baby) {
    var rec = Object.assign({}, baby);
    if (!rec.id) rec.id = genId('baby');
    return getFamilyAndClient().then(function (meta) {
      var familyId = meta[0];
      var clientId = meta[1];
      return getBaby(rec.id).then(function (old) {
        var stamp = nowIso();
        rec.family_id = rec.family_id || old && old.family_id || familyId || null;
        rec.client_id = rec.client_id || old && old.client_id || clientId || null;
        rec.created_at = rec.created_at || old && old.created_at || stamp;
        rec.updated_at = stamp;
        rec.deleted_at = rec.deleted_at || null;
        rec.last_synced_at = old && old.last_synced_at || null;
        rec.sync_status = old ? (old.sync_status === 'pending_create' ? 'pending_create' : 'pending_update') : 'pending_create';
        return req2promise(tx('babies', 'readwrite').put(rec)).then(function () {
          return rec;
        });
      });
    });
  }

  function softDeleteBaby(id) {
    return getBaby(id).then(function (old) {
      if (!old) return null;
      var stamp = nowIso();
      var next = Object.assign({}, old, {
        deleted_at: stamp,
        updated_at: stamp,
        sync_status: 'pending_delete'
      });
      return req2promise(tx('babies', 'readwrite').put(next)).then(function () {
        return getAllEventsRaw().then(function (events) {
          var chain = Promise.resolve();
          events.forEach(function (event) {
            if (event.baby_id === id && !event.deleted_at) {
              chain = chain.then(function () { return softDeleteEvent(event.id); });
            }
          });
          return chain.then(function () { return next; });
        });
      });
    });
  }

  function deleteBaby(id) {
    return softDeleteBaby(id);
  }

  function getPendingEvents() {
    return getAllEventsRaw().then(function (events) {
      return events.filter(function (event) { return isPending(event.sync_status); });
    });
  }

  function getPendingBabies() {
    return getAllBabiesRaw().then(function (babies) {
      return babies.filter(function (baby) { return isPending(baby.sync_status); });
    });
  }

  function markEventSynced(id, remoteUpdatedAt, remoteDeletedAt) {
    return getEvent(id).then(function (old) {
      if (!old) return null;
      old.updated_at = remoteUpdatedAt || old.updated_at;
      old.deleted_at = typeof remoteDeletedAt === 'undefined' ? old.deleted_at : remoteDeletedAt;
      old.sync_status = 'synced';
      old.last_synced_at = remoteUpdatedAt || nowIso();
      return req2promise(tx('events', 'readwrite').put(old)).then(function () {
        return old;
      });
    });
  }

  function markBabySynced(id, remoteUpdatedAt, remoteDeletedAt) {
    return getBaby(id).then(function (old) {
      if (!old) return null;
      old.updated_at = remoteUpdatedAt || old.updated_at;
      old.deleted_at = typeof remoteDeletedAt === 'undefined' ? old.deleted_at : remoteDeletedAt;
      old.sync_status = 'synced';
      old.last_synced_at = remoteUpdatedAt || nowIso();
      return req2promise(tx('babies', 'readwrite').put(old)).then(function () {
        return old;
      });
    });
  }

  function mergeRemoteEvents(events) {
    var chain = Promise.resolve();
    (events || []).forEach(function (event) {
      chain = chain.then(function () { return mergeRemoteEvent(event); });
    });
    return chain;
  }

  function mergeRemoteEvent(remote) {
    return getEvent(remote.id).then(function (local) {
      var normalized = normalizeRemoteRecord(remote);
      if (!local) {
        return req2promise(tx('events', 'readwrite').put(normalized));
      }
      if (isPending(local.sync_status)) {
        var winner = compareIso(local.updated_at, remote.updated_at);
        if (winner > 0) {
          local.sync_status = 'conflict';
          return req2promise(tx('events', 'readwrite').put(local));
        }
        if (winner < 0) normalized.sync_status = 'conflict';
      }
      if (compareIso(remote.updated_at, local.updated_at) >= 0) {
        return req2promise(tx('events', 'readwrite').put(normalized));
      }
      return null;
    });
  }

  function mergeRemoteBabies(babies) {
    var chain = Promise.resolve();
    (babies || []).forEach(function (baby) {
      chain = chain.then(function () { return mergeRemoteBaby(baby); });
    });
    return chain;
  }

  function mergeRemoteBaby(remote) {
    return getBaby(remote.id).then(function (local) {
      var normalized = normalizeRemoteRecord(remote);
      if (!local) {
        return req2promise(tx('babies', 'readwrite').put(normalized));
      }
      if (isPending(local.sync_status)) {
        var winner = compareIso(local.updated_at, remote.updated_at);
        if (winner > 0) {
          local.sync_status = 'conflict';
          return req2promise(tx('babies', 'readwrite').put(local));
        }
        if (winner < 0) normalized.sync_status = 'conflict';
      }
      if (compareIso(remote.updated_at, local.updated_at) >= 0) {
        return req2promise(tx('babies', 'readwrite').put(normalized));
      }
      return null;
    });
  }

  function getMeta(key) {
    return req2promise(tx('meta', 'readonly').get(key)).then(function (record) {
      return record ? record.value : null;
    });
  }

  function setMeta(key, value) {
    return req2promise(tx('meta', 'readwrite').put({ key: key, value: value }));
  }

  function getLastSyncAt() {
    return getMeta('lastSyncAt');
  }

  function setLastSyncAt(value) {
    return setMeta('lastSyncAt', value);
  }

  function getAllEventsRaw() {
    return new Promise(function (resolve, reject) {
      var store = tx('events', 'readonly');
      var results = [];
      var req = store.openCursor();
      req.onsuccess = function (e) {
        var cursor = e.target.result;
        if (cursor) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      req.onerror = function () { reject(req.error); };
    });
  }

  function getAllBabiesRaw() {
    return new Promise(function (resolve, reject) {
      var store = tx('babies', 'readonly');
      var results = [];
      var req = store.openCursor();
      req.onsuccess = function (e) {
        var cursor = e.target.result;
        if (cursor) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      req.onerror = function () { reject(req.error); };
    });
  }

  function getAllMeta() {
    return new Promise(function (resolve, reject) {
      var store = tx('meta', 'readonly');
      var results = {};
      var req = store.openCursor();
      req.onsuccess = function (e) {
        var cursor = e.target.result;
        if (cursor) {
          results[cursor.value.key] = cursor.value.value;
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      req.onerror = function () { reject(req.error); };
    });
  }

  function migrateLegacyIds() {
    return Promise.all([
      getAllBabiesRaw(),
      getAllEventsRaw(),
      getAllMeta()
    ]).then(function (results) {
      var babies = results[0];
      var events = results[1];
      var meta = results[2] || {};
      var babyIdMap = {};
      var eventIdMap = {};
      var changed = false;

      babies.forEach(function (baby) {
        if (!isUuid(baby.id)) {
          babyIdMap[baby.id] = createUuid();
          changed = true;
        }
      });

      events.forEach(function (event) {
        if (!isUuid(event.id)) {
          eventIdMap[event.id] = createUuid();
          changed = true;
        }
        if (event.baby_id && babyIdMap[event.baby_id]) {
          changed = true;
        }
      });

      if (meta.currentBabyId && babyIdMap[meta.currentBabyId]) {
        changed = true;
      }

      if (!changed) return null;

      return new Promise(function (resolve, reject) {
        var transaction = db.transaction(['babies', 'events', 'meta'], 'readwrite');
        var babiesStore = transaction.objectStore('babies');
        var eventsStore = transaction.objectStore('events');
        var metaStore = transaction.objectStore('meta');

        babies.forEach(function (baby) {
          var oldId = baby.id;
          var nextId = babyIdMap[oldId];
          if (!nextId) return;
          var nextBaby = Object.assign({}, baby, { id: nextId });
          babiesStore.put(nextBaby);
          babiesStore.delete(oldId);
        });

        events.forEach(function (event) {
          var oldEventId = event.id;
          var nextEventId = eventIdMap[oldEventId];
          var nextBabyId = babyIdMap[event.baby_id] || event.baby_id || null;
          var nextEvent = Object.assign({}, event, {
            id: nextEventId || oldEventId,
            baby_id: nextBabyId
          });

          if (nextEventId) {
            eventsStore.put(nextEvent);
            eventsStore.delete(oldEventId);
            return;
          }

          if (nextBabyId !== event.baby_id) {
            eventsStore.put(nextEvent);
          }
        });

        if (meta.currentBabyId && babyIdMap[meta.currentBabyId]) {
          metaStore.put({ key: 'currentBabyId', value: babyIdMap[meta.currentBabyId] });
        }

        transaction.oncomplete = function () {
          resolve({
            migratedBabies: Object.keys(babyIdMap).length,
            migratedEvents: Object.keys(eventIdMap).length
          });
        };
        transaction.onerror = function () {
          reject(transaction.error);
        };
        transaction.onabort = function () {
          reject(transaction.error || new Error('legacy_id_migration_aborted'));
        };
      });
    });
  }

  function exportAll() {
    return Promise.all([
      getAllEventsRaw(),
      getAllBabiesRaw(),
      getAllMeta()
    ]).then(function (results) {
      return {
        version: 2,
        exported_at: nowIso(),
        babies: results[1],
        events: results[0],
        meta: results[2]
      };
    });
  }

  function importAll(data) {
    var chain = Promise.resolve();
    (data.babies || []).forEach(function (baby) {
      chain = chain.then(function () { return req2promise(tx('babies', 'readwrite').put(baby)); });
    });
    (data.events || []).forEach(function (event) {
      chain = chain.then(function () { return req2promise(tx('events', 'readwrite').put(event)); });
    });
    Object.keys(data.meta || {}).forEach(function (key) {
      chain = chain.then(function () { return req2promise(tx('meta', 'readwrite').put({ key: key, value: data.meta[key] })); });
    });
    return chain.then(function () {
      return migrateLegacyIds();
    });
  }

  return {
    open: open,
    addEvent: addEvent,
    updateEvent: updateEvent,
    deleteEvent: deleteEvent,
    softDeleteEvent: softDeleteEvent,
    getEvent: getEvent,
    getEventsByDay: getEventsByDay,
    getAllEvents: getAllEvents,
    getRecentFeeds: getRecentFeeds,
    getBabies: getBabies,
    getBaby: getBaby,
    upsertBaby: upsertBaby,
    deleteBaby: deleteBaby,
    softDeleteBaby: softDeleteBaby,
    getPendingEvents: getPendingEvents,
    getPendingBabies: getPendingBabies,
    markEventSynced: markEventSynced,
    markBabySynced: markBabySynced,
    mergeRemoteEvents: mergeRemoteEvents,
    mergeRemoteBabies: mergeRemoteBabies,
    getMeta: getMeta,
    setMeta: setMeta,
    getLastSyncAt: getLastSyncAt,
    setLastSyncAt: setLastSyncAt,
    exportAll: exportAll,
    importAll: importAll
  };
})();
