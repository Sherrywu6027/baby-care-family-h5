# Pump Backfill Start Time Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep one-tap pump timer start, but let the user revise the current pump session to a past start time on the same day from the running timer page.

**Architecture:** Reuse the existing `Timer` local-storage state as the source of truth for active pump timing. Add one focused timer mutation API for pump-only start-time adjustment, then expose it through a new mobile bottom-sheet flow in a separate `ui-today` fix layer so the legacy mojibake-heavy base file stays low-risk.

**Tech Stack:** Static HTML, vanilla JavaScript, localStorage-backed timer state in `js/timer.js`, existing H5 modal/sheet patterns in `js/ui-today-fix.js`, hash routing in `js/app.js`, CSS in `css/*.css`.

## Global Constraints

- Only cover `pump` timer in this round.
- Do not expand this round to `sleep` or `milk_direct`.
- Keep the current one-tap `pump` start flow unchanged.
- The revised start time must be interpreted as today in `Asia/Shanghai`.
- Do not support cross-day backfill in the active timer.
- Do not support future times.
- Use mobile bottom-sheet interaction, not browser `prompt`/`confirm`.
- If a legacy file is risky to edit directly, add a later-loaded fix layer instead.

---

## File Map

- Modify: `js/timer.js`
  - Owns active timer state, persistence, elapsed-time calculation, and new pump start-time adjustment API.
- Create: `js/ui-today-pump-backfill-fix.js`
  - Owns the pump-running-page secondary action, bottom sheet, validation, timer mutation call, and immediate UI refresh.
- Modify: `js/ui-today-fix.js`
  - Only if needed for a stable hook point on the pump-running page; otherwise leave it untouched.
- Modify: `css/state-ui-fix.css`
  - Styles the new bottom sheet content and inline error state.
- Modify: `index.html`
  - Loads the new `js/ui-today-pump-backfill-fix.js` after existing today fix layers.

### Task 1: Add Pump Start-Time Adjustment To Timer State

**Files:**
- Modify: `js/timer.js`

**Interfaces:**
- Consumes:
  - Existing `timers.pump` shape: `{ type, babyId, startTime, pausedMs, pauseStartedAt, isPaused }`
  - Existing `persist(): void`
  - Existing `getActive(type?: string): object | null`
- Produces:
  - `Timer.adjustPumpStartTime(startMs: number): object | null`
  - Updated `Timer` export including `adjustPumpStartTime`

- [ ] **Step 1: Add a focused pump timer mutator in `js/timer.js`**

```js
function adjustPumpStartTime(startMs) {
  var timer = timers.pump;
  if (!timer) return null;
  if (!startMs || !isFinite(startMs)) return null;

  timer.startTime = startMs;
  persist();
  return getActive('pump');
}
```

- [ ] **Step 2: Expose the new API from the `Timer` return object**

```js
return {
  start: start,
  stop: stop,
  cancel: cancel,
  pause: pause,
  resume: resume,
  adjustPumpStartTime: adjustPumpStartTime,
  getActive: getActive,
  getAllActive: getAllActive,
  switchBreastSide: switchBreastSide,
  onTick: onTick,
  formatElapsed: formatElapsed,
  formatElapsedSeconds: formatElapsedSeconds,
  priorityOf: priorityOf
};
```

- [ ] **Step 3: Verify the timer module still parses**

Run:

```powershell
node --check js/timer.js
```

Expected:
- PASS with no syntax output.

- [ ] **Step 4: Commit**

```bash
git add js/timer.js
git commit -m "feat: allow adjusting active pump timer start time"
```

### Task 2: Add Pump Backfill Bottom Sheet On The Running Timer Page

**Files:**
- Create: `js/ui-today-pump-backfill-fix.js`
- Modify: `index.html`
- Modify: `css/state-ui-fix.css`

**Interfaces:**
- Consumes:
  - `Timer.getActive('pump'): { startTime: number, elapsedSec: number, isPaused: boolean } | null`
  - `Timer.adjustPumpStartTime(startMs: number): object | null`
  - `TimeUtil.todayChinaDate(): string`
  - `TimeUtil.makeLocalIsoFromChinaDateTime(dateKey: string, timeValue: string): string`
  - `UIToday.closeModal(): void`
  - `App.toast(message: string): void`
- Produces:
  - `UIToday.openPumpBackfillSheet(): void`
  - `UIToday.savePumpBackfillStartTime(): void`
  - `UIToday.refreshPumpBackfillUi(state?: object): void`

- [ ] **Step 1: Load a new later-running fix file in `index.html`**

```html
<script src="./js/ui-today-sync-fix.js?v=20260803-1"></script>
<script src="./js/ui-today-age-summary-fix.js?v=20260803-1"></script>
<script src="./js/ui-today-pump-backfill-fix.js?v=20260803-1"></script>
<script src="./js/ui-today-pump-start-fix.js?v=20260729-2"></script>
```

- [ ] **Step 2: Create the bottom-sheet open/save flow in `js/ui-today-pump-backfill-fix.js`**

```js
var UIToday = (function (base) {
  if (!base) return base;

  function openPumpBackfillSheet() {
    var active = Timer.getActive('pump');
    if (!active) {
      App.toast('当前没有进行中的吸奶');
      return;
    }

    var now = new Date();
    var currentTime = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    var guessedTime = new Date(active.startTime);
    var defaultTime = String(guessedTime.getHours()).padStart(2, '0') + ':' + String(guessedTime.getMinutes()).padStart(2, '0');
    var html = '';
    html += '<div class="modal-overlay pump-backfill-overlay" onclick="if(event.target===this)UIToday.closeModal()"><div class="modal-sheet">';
    html += '<div class="modal-handle"></div><div class="modal-title">修改本次开始时间</div>';
    html += '<div class="welcome-desc">如果你不是现在才开始吸奶，可以把本次开始时间改成更早或更晚的今天时间。</div>';
    html += '<div class="form-group"><label class="form-label">实际开始时间</label><input type="time" class="form-input" id="pump-backfill-time" value="' + defaultTime + '"></div>';
    html += '<div class="field-error" id="pump-backfill-error" style="display:none"></div>';
    html += '<div class="pump-backfill-current">当前时间 ' + currentTime + '</div>';
    html += '<div class="welcome-actions"><button class="btn-secondary" onclick="UIToday.closeModal()">取消</button><button class="btn-primary" onclick="UIToday.savePumpBackfillStartTime()">确认修改</button></div>';
    html += '</div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
  }

  function savePumpBackfillStartTime() {
    var active = Timer.getActive('pump');
    if (!active) {
      UIToday.closeModal();
      App.toast('当前没有进行中的吸奶');
      return;
    }

    var input = document.getElementById('pump-backfill-time');
    var error = document.getElementById('pump-backfill-error');
    var timeValue = input ? input.value : '';
    if (!timeValue) {
      error.style.display = 'block';
      error.textContent = '请选择开始时间';
      return;
    }

    var dateKey = TimeUtil.todayChinaDate();
    var isoValue = TimeUtil.makeLocalIsoFromChinaDateTime(dateKey, timeValue);
    var startMs = new Date(isoValue).getTime();
    var nowMs = Date.now();
    if (!startMs || startMs >= nowMs) {
      error.style.display = 'block';
      error.textContent = '开始时间必须早于当前时间';
      return;
    }

    var next = Timer.adjustPumpStartTime(startMs);
    if (!next) {
      error.style.display = 'block';
      error.textContent = '开始时间修改失败，请重试';
      return;
    }

    UIToday.closeModal();
    App.toast('已按 ' + timeValue + ' 作为开始时间');
    UIToday.refreshPumpBackfillUi(next);
  }

  base.openPumpBackfillSheet = openPumpBackfillSheet;
  base.savePumpBackfillStartTime = savePumpBackfillStartTime;
  return base;
})(window.UIToday);
```

- [ ] **Step 3: Patch the running pump page to show the new secondary action**

```js
var originalRenderPage = base.renderWithBaby;

function injectPumpBackfillAction() {
  var runningCard = document.querySelector('.active-main-card');
  if (!runningCard) return;
  var state = Timer.getActive('pump');
  if (!state) return;
  if (document.getElementById('pump-backfill-trigger')) return;

  runningCard.insertAdjacentHTML(
    'beforeend',
    '<button class="btn-text-inline" id="pump-backfill-trigger" onclick="UIToday.openPumpBackfillSheet()">改为从过去开始</button>'
  );
}
```

```js
base.renderWithBaby = function (container, babyId) {
  var result = originalRenderPage.call(base, container, babyId);
  setTimeout(injectPumpBackfillAction, 0);
  setTimeout(injectPumpBackfillAction, 120);
  return result;
};
```

- [ ] **Step 4: Add a targeted UI refresh helper so the elapsed time updates immediately**

```js
function refreshPumpBackfillUi(state) {
  state = state || Timer.getActive('pump');
  if (!state) {
    App.renderPage();
    return;
  }

  var mainTime = document.getElementById('active-main-time');
  if (mainTime) mainTime.textContent = Timer.formatElapsedSeconds(state.elapsedSec || 0);

  var trigger = document.getElementById('pump-backfill-trigger');
  if (!trigger) {
    setTimeout(injectPumpBackfillAction, 0);
  }

  if ((location.hash.slice(2) || 'today') === 'today') {
    if (window.UIToday && UIToday.renderWithBaby) {
      DB.getMeta('currentBabyId').then(function (babyId) {
        var root = document.getElementById('main');
        if (root && babyId) UIToday.renderWithBaby(root, babyId);
      });
    }
  }
}

base.refreshPumpBackfillUi = refreshPumpBackfillUi;
```

- [ ] **Step 5: Add bottom-sheet and inline-error styles in `css/state-ui-fix.css`**

```css
.pump-backfill-current {
  margin-top: 8px;
  color: var(--text-sub);
  font-size: 0.8rem;
}

.pump-backfill-overlay .welcome-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 16px;
}
```

- [ ] **Step 6: Verify new files parse and load cleanly**

Run:

```powershell
node --check js/ui-today-pump-backfill-fix.js
```

Expected:
- PASS with no syntax output.

Manual browser checks:
1. Tap `吸奶` and confirm the timer still starts immediately.
2. On the running timer card, confirm `改为从过去开始` appears.
3. Open the sheet, leave the time blank, and confirm the inline error appears.
4. Choose a future time and confirm the inline error says the start time must be earlier than now.

- [ ] **Step 7: Commit**

```bash
git add index.html js/ui-today-pump-backfill-fix.js css/state-ui-fix.css
git commit -m "feat: add pump backfill start time sheet"
```

### Task 3: Keep Saved Pump Records Consistent With The Revised Start Time

**Files:**
- Modify: `js/ui-today-fix.js`
- Modify: `js/ui-today-sync-fix.js`

**Interfaces:**
- Consumes:
  - `Timer.stop('pump'): { startTime: string, endTime: string, durationSec: number, durationMin: number, type: string, babyId: string }`
  - Existing `DB.addEvent(event): Promise<any>`
  - Existing `App.requestSync(reason?: string): void`
- Produces:
  - Saved `pump` event uses adjusted `start_time`
  - Existing save path still triggers best-effort sync after success

- [ ] **Step 1: Confirm the pump save path keeps using `Timer.stop('pump')` output unchanged**

```js
DB.addEvent({
  type: result.type,
  baby_id: result.babyId,
  start_time: result.startTime,
  end_time: result.endTime,
  duration_sec: result.durationSec,
  duration_min: result.durationMin
})
```

- [ ] **Step 2: If `duration_sec` is missing from the active pump save path, add it explicitly**

```js
window._pendingTimerEvent = {
  type: result.type,
  baby_id: result.babyId,
  start_time: result.startTime,
  end_time: result.endTime,
  duration_sec: result.durationSec,
  duration_min: result.durationMin
};
```

- [ ] **Step 3: Keep save-triggered sync behavior intact after successful pump save**

```js
var originalSavePump = UIToday.savePump;
UIToday.savePump = function () {
  var result = originalSavePump.apply(this, arguments);
  if (App.requestSync) App.requestSync('today-save-pump');
  return result;
};
```

- [ ] **Step 4: Verify record consistency manually**

Manual browser checks:
1. Start a pump timer.
2. Change the start time to 10 minutes earlier.
3. Wait at least 5 seconds.
4. End and save the pump record.
5. Open the saved record in the log and confirm the displayed duration is about 10 minutes plus those extra seconds.

- [ ] **Step 5: Run syntax checks on touched runtime files**

Run:

```powershell
node --check js/ui-today-fix.js
node --check js/ui-today-sync-fix.js
```

Expected:
- PASS with no syntax output for both files.

- [ ] **Step 6: Commit**

```bash
git add js/ui-today-fix.js js/ui-today-sync-fix.js
git commit -m "fix: preserve adjusted pump start time when saving"
```

### Task 4: Final Regression Pass

**Files:**
- Modify: `docs/superpowers/specs/2026-08-03-pump-backfill-start-design.md` only if implementation reveals a necessary spec clarification

**Interfaces:**
- Consumes:
  - `Timer.adjustPumpStartTime(startMs: number): object | null`
  - `UIToday.openPumpBackfillSheet(): void`
  - `UIToday.savePumpBackfillStartTime(): void`
- Produces:
  - Verified shipped behavior for the accepted scope

- [ ] **Step 1: Run the full syntax sweep for the feature files**

Run:

```powershell
node --check js/timer.js
node --check js/ui-today-pump-backfill-fix.js
node --check js/ui-today-fix.js
node --check js/ui-today-sync-fix.js
```

Expected:
- PASS with no syntax output.

- [ ] **Step 2: Run the accepted-scope browser regression**

Manual checks:
1. Pump one-tap start still works.
2. Pump running card shows `改为从过去开始`.
3. Valid past-today time updates the live elapsed time immediately.
4. Refreshing the page keeps the revised active pump session.
5. Ending and saving writes the corrected duration.
6. Sleep timer flow is unchanged.
7. Direct breastfeeding flow is unchanged.

- [ ] **Step 3: Commit the finished feature**

```bash
git add js/timer.js js/ui-today-pump-backfill-fix.js js/ui-today-fix.js js/ui-today-sync-fix.js css/state-ui-fix.css index.html
git commit -m "feat: support backfilling active pump timer start time"
```

