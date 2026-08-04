# Loading Timezone Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate post-login white screens, unify day-based logic to Beijing time, and make family data refresh automatically with lightweight sync feedback.

**Architecture:** Keep the existing vanilla H5 structure and add three focused layers: a shared Beijing-time utility, a cache-first page restore path, and a sync-status/foreground-refresh path. Reuse existing `DB`, `Sync`, and page modules instead of introducing a new framework or global store.

**Tech Stack:** Static HTML, vanilla JavaScript, IndexedDB wrapper in `js/db.js`, Supabase sync in `js/sync.js`, hash routing in `js/app.js`, CSS in `css/*.css`.

## Global Constraints

- Do not introduce React, Vue, uni-app, Taro, or any bundler-based rewrite.
- Do not add Supabase Realtime in this round.
- Business day grouping must use `Asia/Shanghai`.
- The app must render useful content before remote data recovery finishes.
- Sync state copy must be limited to `刚刚更新`, `同步中`, `离线，稍后自动同步`, `同步失败，可稍后重试`.
- Refresh should prefer local module updates over whole-page flashes.

---

## File Map

- Modify: `js/app.js`
  - Owns app bootstrap, route recovery, foreground refresh hooks, and top-level sync-state broadcast.
- Modify: `js/db.js`
  - Owns cached metadata reads/writes and any page snapshot persistence helpers.
- Create: `js/time.js`
  - Owns all Beijing-time day helpers and replaces ad hoc UTC/local date math.
- Modify: `js/calc.js`
  - Uses shared time helpers for today/7-day calculations.
- Modify: `js/ui-today.js`
  - Uses shared time helpers, renders skeleton/cached state, and updates sync status on the today page.
- Modify: `js/ui-log.js`
  - Uses shared time helpers for daily filtering.
- Modify: `js/ui-stats.js`
  - Uses shared time helpers for grouped stats.
- Modify: `js/sync.js`
  - Exposes sync lifecycle hooks or callback points used by the app shell.
- Modify: `css/state-ui-fix.css`
  - Styles the lightweight sync status and today-page skeleton/loading states.
- Modify: `index.html`
  - Loads the new `js/time.js` before consumers.

### Task 1: Beijing Time Utility And Day-Boundary Unification

**Files:**
- Create: `js/time.js`
- Modify: `js/calc.js`
- Modify: `js/db.js`
- Modify: `js/ui-today.js`
- Modify: `js/ui-log.js`
- Modify: `js/ui-stats.js`
- Modify: `index.html`

**Interfaces:**
- Consumes: existing event records with `start_time`, `end_time`, and current page date strings.
- Produces:
  - `TimeUtil.todayChinaDate(): string`
  - `TimeUtil.toChinaDateParts(date: Date | string | number): { year: number, month: number, day: number, dateKey: string }`
  - `TimeUtil.makeLocalIsoFromChinaDateTime(dateKey: string, timeValue: string): string`
  - `TimeUtil.getChinaDayRange(dateKey: string): { startMs: number, endMs: number }`
  - `TimeUtil.shiftChinaDate(dateKey: string, offsetDays: number): string`
  - `TimeUtil.getEventChinaDateKey(event: { start_time?: string }): string`

- [ ] **Step 1: Add the shared Beijing-time utility module**

```js
var TimeUtil = (function () {
  var DAY_MS = 24 * 60 * 60 * 1000;

  function getChinaParts(input) {
    var date = input instanceof Date ? input : new Date(input);
    var formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    var parts = formatter.formatToParts(date);
    var map = {};
    parts.forEach(function (part) {
      if (part.type !== 'literal') map[part.type] = part.value;
    });
    return {
      year: Number(map.year),
      month: Number(map.month),
      day: Number(map.day),
      dateKey: map.year + '-' + map.month + '-' + map.day
    };
  }

  function todayChinaDate() {
    return getChinaParts(new Date()).dateKey;
  }

  function getChinaDayRange(dateKey) {
    var segs = String(dateKey || '').split('-');
    var y = Number(segs[0]);
    var m = Number(segs[1]);
    var d = Number(segs[2]);
    var startMs = Date.UTC(y, m - 1, d, -8, 0, 0, 0);
    return { startMs: startMs, endMs: startMs + DAY_MS - 1 };
  }

  function shiftChinaDate(dateKey, offsetDays) {
    var range = getChinaDayRange(dateKey);
    return getChinaParts(range.startMs + (offsetDays * DAY_MS)).dateKey;
  }

  function makeLocalIsoFromChinaDateTime(dateKey, timeValue) {
    return new Date(dateKey + 'T' + timeValue).toISOString();
  }

  function getEventChinaDateKey(event) {
    return getChinaParts((event && event.start_time) || Date.now()).dateKey;
  }

  return {
    todayChinaDate: todayChinaDate,
    toChinaDateParts: getChinaParts,
    getChinaDayRange: getChinaDayRange,
    shiftChinaDate: shiftChinaDate,
    makeLocalIsoFromChinaDateTime: makeLocalIsoFromChinaDateTime,
    getEventChinaDateKey: getEventChinaDateKey
  };
})();
```

- [ ] **Step 2: Load the new module before consumers**

```html
<script src="./js/db.js?v=20260727-1"></script>
<script src="./js/time.js?v=20260803-1"></script>
<script src="./js/calc.js?v=20260803-1"></script>
```

- [ ] **Step 3: Replace UTC-based “today” logic in `js/calc.js`**

```js
var today = TimeUtil.todayChinaDate();
```

```js
for (var i = 6; i >= 0; i--) {
  var dateKey = TimeUtil.shiftChinaDate(today, -i);
  // use dateKey instead of d.toISOString().slice(0, 10)
}
```

- [ ] **Step 4: Replace per-page default date and save-time assembly**

```js
var dateStr = TimeUtil.todayChinaDate();
```

```js
var startISO = TimeUtil.makeLocalIsoFromChinaDateTime(dateStr, timeStr);
```

- [ ] **Step 5: Replace local day-boundary queries in `js/db.js`**

```js
function getEventsByDay(babyId, dateStr) {
  var range = TimeUtil.getChinaDayRange(dateStr);
  return getEventsByBaby(babyId).then(function (events) {
    return (events || []).filter(function (event) {
      var time = new Date(event.start_time).getTime();
      return time >= range.startMs && time <= range.endMs;
    });
  });
}
```

- [ ] **Step 6: Align `js/ui-log.js` and `js/ui-stats.js` with the shared date-key helpers**

```js
var selectedDate = TimeUtil.todayChinaDate();
var groupKey = TimeUtil.getEventChinaDateKey(event);
```

- [ ] **Step 7: Manual verification**

Run:

```powershell
rg "toISOString\\(\\)\\.slice\\(0, 10\\)|T00:00:00|T23:59:59\\.999" E:\OPC\baby\js
```

Expected:
- Old day-grouping patterns no longer appear in active today/log/stats/day-query paths.

Manual browser checks:
1. Create a record at `00:10` Beijing time and confirm it appears in today summary, the log page, and daily stats for the same day.
2. Create a record at `23:50` Beijing time and confirm the same consistency.

- [ ] **Step 8: Commit**

```bash
git add index.html js/time.js js/calc.js js/db.js js/ui-today.js js/ui-log.js js/ui-stats.js
git commit -m "fix: unify baby app day grouping to Beijing time"
```

### Task 2: Cache-First Login Recovery And Today Skeleton

**Files:**
- Modify: `js/app.js`
- Modify: `js/db.js`
- Modify: `js/ui-today.js`
- Modify: `css/state-ui-fix.css`

**Interfaces:**
- Consumes:
  - `DB.getMeta(key): Promise<any>`
  - `Sync.getAuthState(): Promise<{ loggedIn: boolean }>`
  - `Sync.restoreFamilyContext(options): Promise<any>`
- Produces:
  - `DB.saveMeta('todaySnapshot', snapshot): Promise<void>`
  - `DB.getMeta('todaySnapshot'): Promise<object | null>`
  - `UIToday.render(main, options?): void`
  - `UIToday.captureSnapshot(): Promise<object | null>`

- [ ] **Step 1: Add snapshot persistence helpers in `js/db.js` if missing**

```js
function setMeta(key, value) {
  return put('meta', { key: key, value: value, updated_at: new Date().toISOString() });
}

function getMeta(key) {
  return get('meta', key).then(function (row) {
    return row ? row.value : null;
  });
}
```

- [ ] **Step 2: Extend `UIToday` to support loading-state and snapshot rendering**

```js
function render(root, options) {
  options = options || {};
  if (options.loading) return renderLoading(root, options.snapshot || null);
  return renderLive(root, options);
}
```

```js
function renderLoading(root, snapshot) {
  root.innerHTML = snapshot
    ? buildTodaySnapshotHtml(snapshot, true)
    : buildTodaySkeletonHtml();
}
```

- [ ] **Step 3: Save today snapshots after successful today-page render**

```js
function persistTodaySnapshot(snapshot) {
  return DB.setMeta('todaySnapshot', snapshot).catch(function () {});
}
```

```js
var snapshot = collectTodaySnapshot(viewModel);
persistTodaySnapshot(snapshot);
```

- [ ] **Step 4: Change login recovery flow in `js/app.js`**

```js
Promise.all([
  Sync.getAuthState(),
  DB.getMeta('onboardingCompleted'),
  DB.getMeta('familyId'),
  DB.getMeta('todaySnapshot')
]).then(function (values) {
  var authState = values[0] || { loggedIn: false };
  var done = !!(values[1] || values[2]);
  var snapshot = values[3] || null;

  if (authState.loggedIn && restoringRoute) {
    UIToday.render(main, { loading: true, snapshot: snapshot });
  }
});
```

- [ ] **Step 5: Ensure logged-in users with restored family go directly to today**

```js
if (authState.loggedIn && done && hash === 'login') {
  location.hash = '#/today';
  hash = 'today';
}
```

```js
if (authState.loggedIn && !done && !restoringRoute) {
  UIToday.render(main, { loading: true, snapshot: snapshot });
}
```

- [ ] **Step 6: Add styles for today skeleton and stale snapshot state**

```css
.today-skeleton,
.today-sync-pill {
  border-radius: 16px;
}

.today-skeleton-line {
  height: 12px;
  background: linear-gradient(90deg, #eef2ff, #e5e7eb, #eef2ff);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.2s linear infinite;
}
```

- [ ] **Step 7: Manual verification**

Manual browser checks:
1. Login with an existing family account and confirm the app goes to today instead of an empty screen or family-selection dead end.
2. Refresh immediately after login and confirm the main area shows either cached data or a skeleton, never a blank container.
3. Clear local cache, log in again, and confirm the app shows the today skeleton until data loads.

- [ ] **Step 8: Commit**

```bash
git add js/app.js js/db.js js/ui-today.js css/state-ui-fix.css
git commit -m "fix: show cached today state during login recovery"
```

### Task 3: Save-Triggered Sync, Foreground Refresh, And Lightweight Sync Status

**Files:**
- Modify: `js/app.js`
- Modify: `js/sync.js`
- Modify: `js/ui-today.js`
- Modify: `js/ui-log.js`
- Modify: `js/ui-settings.js`
- Modify: `css/state-ui-fix.css`

**Interfaces:**
- Consumes:
  - `Sync.sync(options): Promise<any>`
  - existing create/update/delete flows in page modules
- Produces:
  - `Sync.onStateChange(listener: function): function`
  - `App.requestSync(reason: string): Promise<void>`
  - `App.publishSyncState(state: 'idle' | 'syncing' | 'offline' | 'error'): void`

- [ ] **Step 1: Add sync lifecycle events in `js/sync.js`**

```js
var listeners = [];

function emitSyncState(state) {
  listeners.forEach(function (listener) {
    try { listener(state); } catch (e) {}
  });
}

function onStateChange(listener) {
  listeners.push(listener);
  return function unsubscribe() {
    listeners = listeners.filter(function (item) { return item !== listener; });
  };
}
```

- [ ] **Step 2: Emit sync states around `Sync.sync()`**

```js
if (!navigator.onLine) {
  emitSyncState('offline');
  return Promise.resolve();
}

emitSyncState('syncing');
return doSyncWork().then(function (result) {
  emitSyncState('idle');
  return result;
}).catch(function (error) {
  emitSyncState('error');
  throw error;
});
```

- [ ] **Step 3: Centralize app-level sync requests in `js/app.js`**

```js
function requestSync(reason) {
  return Sync.sync({ silent: true, reason: reason }).catch(function () {});
}
```

```js
window.addEventListener('focus', function () { requestSync('focus'); });
window.addEventListener('pageshow', function () { requestSync('pageshow'); });
document.addEventListener('visibilitychange', function () {
  if (!document.hidden) requestSync('visibilitychange');
});
```

- [ ] **Step 4: Publish lightweight sync copy from the app shell**

```js
function mapSyncCopy(state) {
  if (state === 'syncing') return '同步中';
  if (state === 'offline') return '离线，稍后自动同步';
  if (state === 'error') return '同步失败，可稍后重试';
  return '刚刚更新';
}
```

```js
Sync.onStateChange(function (state) {
  window.dispatchEvent(new CustomEvent('baby-sync-state', {
    detail: { state: state, label: mapSyncCopy(state) }
  }));
});
```

- [ ] **Step 5: Update save/edit/delete flows to request sync immediately**

```js
return DB.saveEvent(payload).then(function () {
  App.requestSync('event-save');
  return refreshCurrentView();
});
```

```js
return DB.deleteBaby(id).then(function () {
  App.requestSync('baby-delete');
  return rerenderSettingsSection();
});
```

- [ ] **Step 6: Render the sync pill in active pages**

```js
window.addEventListener('baby-sync-state', function (event) {
  syncLabel = event.detail && event.detail.label ? event.detail.label : '刚刚更新';
  renderSyncPill(syncLabel);
});
```

```css
.today-sync-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  font-size: 12px;
  color: #475569;
  background: #f8fafc;
}
```

- [ ] **Step 7: Manual verification**

Manual browser checks:
1. Save a record on device A and confirm the current page shows `同步中`, then `刚刚更新`.
2. Bring device B back to the foreground and confirm new data appears without manually tapping a sync button.
3. Disconnect the network, save locally, and confirm the page shows `离线，稍后自动同步`.
4. Reconnect the network and confirm the page returns to `同步中` then `刚刚更新`.

- [ ] **Step 8: Commit**

```bash
git add js/app.js js/sync.js js/ui-today.js js/ui-log.js js/ui-settings.js css/state-ui-fix.css
git commit -m "fix: auto refresh family data with sync status"
```

## Self-Review

### Spec coverage

- 登录空白：Task 2 covers cached render, skeleton state, direct-to-today recovery.
- 北京时间分日：Task 1 covers shared date utility and all daily pages.
- 自动同步：Task 3 covers save-triggered sync, foreground refresh, and lightweight sync feedback.

No spec gaps remain for this round.

### Placeholder scan

- No `TODO`, `TBD`, or “implement later” placeholders remain.
- Each task lists concrete files, interfaces, code snippets, verification, and commit messages.

### Type consistency

- Shared time helper names are defined once in Task 1 and reused consistently.
- Snapshot helpers use `DB.setMeta/getMeta`.
- Sync events use `Sync.onStateChange`, `App.requestSync`, and `baby-sync-state` consistently across tasks.
