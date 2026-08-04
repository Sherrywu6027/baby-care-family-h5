/**
 * timer.js — 计时器（吸奶/亲喂/睡眠）
 * 支持多计时并行；亲喂支持左右胸切换；状态持久化到 localStorage
 */
var Timer = (function () {
  var STORAGE_KEY = 'babycare_active_timers_v2';
  var timers = {};
  var tickCallbacks = [];
  var intervalId = null;

  function load() {
    try {
      timers = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {};
    } catch (err) {
      timers = {};
    }
    ensureTicking();
  }

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(timers));
    ensureTicking();
  }

  function ensureTicking() {
    var hasActive = Object.keys(timers).some(function (key) { return !!timers[key] && !timers[key].isPaused; });
    if (hasActive && !intervalId) {
      intervalId = setInterval(tick, 1000);
    } else if (!hasActive && intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    tick();
  }

  function start(type, babyId, meta) {
    meta = meta || {};
    if (timers[type]) return false;
    var now = Date.now();
    if (type === 'milk_direct') {
      var side = meta.side === 'right' ? 'right' : 'left';
      timers[type] = {
        type: type,
        babyId: babyId,
        startTime: now,
        pausedMs: 0,
        pauseStartedAt: null,
        isPaused: false,
        currentSide: side,
        segments: [
          { side: side, startTime: now, endTime: null, pausedMs: 0, pauseStartedAt: null, isPaused: false }
        ]
      };
    } else {
      timers[type] = {
        type: type,
        babyId: babyId,
        startTime: now,
        pausedMs: 0,
        pauseStartedAt: null,
        isPaused: false
      };
    }
    persist();
    return true;
  }

  function switchBreastSide() {
    var timer = timers.milk_direct;
    if (!timer) return null;
    if (timer.isPaused) resume('milk_direct');
    var now = Date.now();
    var currentSegment = timer.segments[timer.segments.length - 1];
    if (currentSegment && !currentSegment.endTime) currentSegment.endTime = now;
    var nextSide = timer.currentSide === 'left' ? 'right' : 'left';
    timer.currentSide = nextSide;
    timer.segments.push({ side: nextSide, startTime: now, endTime: null, pausedMs: 0, pauseStartedAt: null, isPaused: false });
    persist();
    return getActive('milk_direct');
  }

  function pause(type) {
    type = type || firstActiveType();
    var timer = timers[type];
    if (!timer || timer.isPaused) return null;
    var now = Date.now();
    timer.isPaused = true;
    timer.pauseStartedAt = now;
    if (type === 'milk_direct') {
      var currentSegment = timer.segments[timer.segments.length - 1];
      if (currentSegment && !currentSegment.isPaused && !currentSegment.endTime) {
        currentSegment.isPaused = true;
        currentSegment.pauseStartedAt = now;
      }
    }
    persist();
    return getActive(type);
  }

  function resume(type) {
    type = type || firstActiveType();
    var timer = timers[type];
    if (!timer || !timer.isPaused) return null;
    var now = Date.now();
    timer.pausedMs += Math.max(0, now - (timer.pauseStartedAt || now));
    timer.pauseStartedAt = null;
    timer.isPaused = false;
    if (type === 'milk_direct') {
      var currentSegment = timer.segments[timer.segments.length - 1];
      if (currentSegment && currentSegment.isPaused && !currentSegment.endTime) {
        currentSegment.pausedMs = (currentSegment.pausedMs || 0) + Math.max(0, now - (currentSegment.pauseStartedAt || now));
        currentSegment.pauseStartedAt = null;
        currentSegment.isPaused = false;
      }
    }
    persist();
    return getActive(type);
  }

  function stop(type) {
    type = type || firstActiveType();
    if (!type || !timers[type]) return null;
    var timer = timers[type];
    var now = Date.now();
    var result;
    if (type === 'milk_direct') {
      result = buildDirectResult(timer, now);
    } else {
      var durationSec = calcRoundedSeconds(now - timer.startTime);
      result = {
        type: timer.type,
        babyId: timer.babyId,
        startTime: new Date(timer.startTime).toISOString(),
        endTime: new Date(now).toISOString(),
        durationSec: durationSec,
        durationMin: calcMinutesFromSeconds(durationSec)
      };
    }
    delete timers[type];
    persist();
    return result;
  }

  function cancel(type) {
    type = type || firstActiveType();
    if (!type || !timers[type]) return;
    delete timers[type];
    persist();
  }

  function adjustStartTime(type, startMs) {
    var timer = timers[type];
    if (!timer) return null;
    if (typeof startMs !== 'number' || !isFinite(startMs)) return null;
    if (type === 'milk_direct') {
      return adjustDirectStartTime(timer, startMs);
    }
    timer.startTime = startMs;
    persist();
    return getActive(type);
  }

  function adjustDirectStartTime(timer, startMs) {
    var delta = startMs - timer.startTime;
    if (!delta) return getActive('milk_direct');

    timer.startTime = startMs;
    (timer.segments || []).forEach(function (segment) {
      if (!segment) return;
      if (typeof segment.startTime === 'number') segment.startTime += delta;
      if (typeof segment.endTime === 'number') segment.endTime += delta;
    });

    persist();
    return getActive('milk_direct');
  }

  function adjustPumpStartTime(startMs) {
    return adjustStartTime('pump', startMs);
  }

  function getActive(type) {
    if (type) return toPublicState(timers[type]);
    return toPublicState(timers[firstActiveType()]);
  }

  function getAllActive() {
    return Object.keys(timers)
      .filter(function (key) { return !!timers[key]; })
      .map(function (key) { return toPublicState(timers[key]); })
      .sort(function (a, b) { return priorityOf(a.type) - priorityOf(b.type); });
  }

  function firstActiveType() {
    var list = Object.keys(timers).filter(function (key) { return !!timers[key]; });
    if (list.length === 0) return null;
    list.sort(function (a, b) { return priorityOf(a) - priorityOf(b); });
    return list[0];
  }

  function priorityOf(type) {
    if (type === 'milk_direct') return 1;
    if (type === 'pump') return 2;
    if (type === 'sleep') return 3;
    return 9;
  }

  function toPublicState(timer) {
    if (!timer) return null;
    if (timer.type === 'milk_direct') {
      var summary = summarizeDirect(timer, Date.now());
      var leftSec = calcRoundedSeconds(summary.leftMs);
      var rightSec = calcRoundedSeconds(summary.rightMs);
      var totalSec = leftSec + rightSec;
      return {
        type: timer.type,
        babyId: timer.babyId,
        startTime: timer.startTime,
        elapsed: summary.totalMs,
        isPaused: !!timer.isPaused,
        currentSide: timer.currentSide,
        leftMs: summary.leftMs,
        rightMs: summary.rightMs,
        totalMs: summary.totalMs,
        leftSec: leftSec,
        rightSec: rightSec,
        totalSec: totalSec,
        leftMin: calcMinutesFromSeconds(leftSec),
        rightMin: calcMinutesFromSeconds(rightSec),
        totalMin: calcMinutesFromSeconds(totalSec)
      };
    }
    var elapsedMs = calcElapsedMs(timer, Date.now());
    return {
      type: timer.type,
      babyId: timer.babyId,
      startTime: timer.startTime,
      elapsed: elapsedMs,
      elapsedSec: calcRoundedSeconds(elapsedMs),
      isPaused: !!timer.isPaused
    };
  }

  function summarizeDirect(timer, now) {
    var leftMs = 0;
    var rightMs = 0;
    (timer.segments || []).forEach(function (segment) {
      var duration = calcSegmentElapsedMs(segment, now);
      if (segment.side === 'right') rightMs += duration;
      else leftMs += duration;
    });
    return {
      leftMs: leftMs,
      rightMs: rightMs,
      totalMs: leftMs + rightMs
    };
  }

  function calcElapsedMs(timer, now) {
    if (!timer) return 0;
    var pausedCarry = timer.pausedMs || 0;
    var currentPause = timer.isPaused ? Math.max(0, now - (timer.pauseStartedAt || now)) : 0;
    return Math.max(0, now - timer.startTime - pausedCarry - currentPause);
  }

  function calcSegmentElapsedMs(segment, now) {
    if (!segment) return 0;
    var end = segment.endTime || now;
    var pausedCarry = segment.pausedMs || 0;
    var currentPause = segment.isPaused ? Math.max(0, now - (segment.pauseStartedAt || now)) : 0;
    return Math.max(0, end - segment.startTime - pausedCarry - currentPause);
  }

  function buildDirectResult(timer, now) {
    var summary = summarizeDirect(timer, now);
    var leftSec = calcRoundedSeconds(summary.leftMs);
    var rightSec = calcRoundedSeconds(summary.rightMs);
    var totalSec = leftSec + rightSec;
    return {
      type: 'milk_direct',
      babyId: timer.babyId,
      startTime: new Date(timer.startTime).toISOString(),
      endTime: new Date(now).toISOString(),
      durationSec: totalSec,
      durationMin: calcMinutesFromSeconds(totalSec),
      left_sec: leftSec,
      right_sec: rightSec,
      left_min: calcMinutesFromSeconds(leftSec),
      right_min: calcMinutesFromSeconds(rightSec)
    };
  }

  function calcRoundedSeconds(ms) {
    if (!ms || ms <= 0) return 0;
    return Math.max(1, Math.round(ms / 1000));
  }

  function calcMinutesFromSeconds(sec) {
    if (!sec || sec <= 0) return 0;
    return sec / 60;
  }

  function calcRoundedMinutes(ms) {
    if (!ms || ms <= 0) return 0;
    return Math.max(1, Math.round(ms / 60000));
  }

  function tick() {
    var states = getAllActive();
    tickCallbacks.forEach(function (cb) { cb(states); });
  }

  function onTick(cb) {
    tickCallbacks.push(cb);
    cb(getAllActive());
    return function () {
      tickCallbacks = tickCallbacks.filter(function (f) { return f !== cb; });
    };
  }

  function formatElapsed(ms) {
    var totalSec = Math.floor(ms / 1000);
    return formatElapsedSeconds(totalSec);
  }

  function formatElapsedSeconds(totalSec) {
    totalSec = Math.max(0, Math.floor(Number(totalSec) || 0));
    var h = Math.floor(totalSec / 3600);
    var m = Math.floor((totalSec % 3600) / 60);
    var s = totalSec % 60;
    if (h > 0) return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  load();

  return {
    start: start,
    stop: stop,
    cancel: cancel,
    adjustStartTime: adjustStartTime,
    adjustPumpStartTime: adjustPumpStartTime,
    pause: pause,
    resume: resume,
    getActive: getActive,
    getAllActive: getAllActive,
    switchBreastSide: switchBreastSide,
    onTick: onTick,
    formatElapsed: formatElapsed,
    formatElapsedSeconds: formatElapsedSeconds,
    priorityOf: priorityOf
  };
})();
