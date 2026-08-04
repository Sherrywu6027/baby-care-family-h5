/**
 * calc.js - pure frontend calculation helpers
 */
var Calc = (function () {
  var FEED_FUTURE_GRACE_MS = 60 * 1000;

  function timeSinceLastFeed(babyId) {
    return DB.getRecentFeeds(babyId, 10).then(function (feeds) {
      if (!feeds || feeds.length === 0) return null;
      var nowMs = Date.now();
      var chosen = pickLatestValidFeed(feeds, nowMs);
      if (!chosen) return null;
      return Math.max(0, nowMs - chosen.refMs);
    });
  }

  function pickLatestValidFeed(feeds, nowMs) {
    var fallbackFuture = null;
    for (var i = 0; i < feeds.length; i += 1) {
      var event = feeds[i];
      var refMs = getFeedReferenceTime(event).getTime();
      if (!refMs) continue;
      if (refMs <= nowMs + FEED_FUTURE_GRACE_MS) {
        return {
          event: event,
          refMs: refMs
        };
      }
      if (!fallbackFuture || refMs < fallbackFuture.refMs) {
        fallbackFuture = {
          event: event,
          refMs: refMs
        };
      }
    }
    return fallbackFuture;
  }

  function calcToday(babyId) {
    var today = window.TimeUtil ? TimeUtil.todayChinaDate() : new Date().toISOString().slice(0, 10);
    return DB.getEventsByDay(babyId, today).then(function (events) {
      var summary = {
        feedMl: 0,
        feedCount: 0,
        sleepMin: 0,
        diaperCount: 0,
        diaperStool: 0,
        diaperStoolAmount: 0,
        pumpMl: 0,
        pumpCount: 0,
        weightCount: 0,
        directMin: 0,
        directCount: 0,
        directSec: 0
      };
      events.forEach(function (event) {
        switch (event.type) {
          case 'formula':
          case 'milk_bottle':
            summary.feedMl += (event.amount_ml || 0);
            summary.feedCount++;
            break;
          case 'milk_direct':
            summary.feedCount++;
            summary.directCount++;
            summary.directSec += getDurationSec(event);
            summary.directMin += event.duration_min != null ? event.duration_min : (getDurationSec(event) / 60);
            break;
          case 'sleep':
            summary.sleepMin += event.duration_min != null ? event.duration_min : (getDurationSec(event) / 60);
            break;
          case 'diaper':
            summary.diaperCount++;
            if (event.stool || event.stool_amount) {
              summary.diaperStool++;
              summary.diaperStoolAmount += Number(event.stool_amount) || 1;
            }
            break;
          case 'pump':
            summary.pumpMl += (event.amount_ml || 0);
            summary.pumpCount++;
            break;
          case 'weight':
            summary.weightCount++;
            break;
        }
      });
      return summary;
    });
  }

  function formatDuration(ms) {
    if (ms == null) return '--';
    var totalMin = Math.floor(ms / 60000);
    var hours = Math.floor(totalMin / 60);
    var mins = totalMin % 60;
    if (hours > 0) return hours + 'h' + (mins > 0 ? ' ' + mins + 'm' : '');
    return mins + 'm';
  }

  function formatMin(min) {
    if (!min || min <= 0) return '0m';
    return formatSeconds(Math.round(min * 60));
  }

  function formatSeconds(totalSec) {
    if (!totalSec || totalSec <= 0) return '0s';
    var hours = Math.floor(totalSec / 3600);
    var mins = Math.floor((totalSec % 3600) / 60);
    var secs = totalSec % 60;
    var parts = [];
    if (hours > 0) parts.push(hours + 'h');
    if (mins > 0) parts.push(mins + 'm');
    if (secs > 0 || parts.length === 0) parts.push(secs + 's');
    return parts.join(' ');
  }

  function formatCountdown(ms) {
    if (ms == null) return '--';
    var totalSec = Math.floor(ms / 1000);
    var hours = Math.floor(totalSec / 3600);
    var mins = Math.floor((totalSec % 3600) / 60);
    var secs = totalSec % 60;
    if (hours > 0) return hours + ':' + String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
    return String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
  }

  function formatTime(isoStr) {
    if (window.TimeUtil && TimeUtil.formatChinaDateTime) {
      var text = TimeUtil.formatChinaDateTime(isoStr);
      var match = /(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(text);
      if (match) {
        return String(match[1]).padStart(2, '0') + ':' + String(match[2]).padStart(2, '0');
      }
    }
    var date = new Date(isoStr);
    return String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
  }

  function formatDateLabel(date) {
    if (window.TimeUtil) {
      var dateKey = date ? TimeUtil.toChinaDateParts(date).dateKey : TimeUtil.todayChinaDate();
      return TimeUtil.formatChinaDateLabel(dateKey).replace(/\s.+$/, '');
    }
    var value = date || new Date();
    return (value.getMonth() + 1) + '月' + value.getDate() + '日';
  }

  function getWeekday(date) {
    if (window.TimeUtil) {
      return TimeUtil.getChinaWeekdayLabel(date || new Date());
    }
    var value = date || new Date();
    return '周' + ['日', '一', '二', '三', '四', '五', '六'][value.getDay()];
  }

  function getLastNDays(n) {
    var days = [];
    if (window.TimeUtil) {
      var today = TimeUtil.todayChinaDate();
      for (var i = n - 1; i >= 0; i--) {
        days.push(TimeUtil.shiftChinaDate(today, -i));
      }
      return days;
    }
    for (var j = n - 1; j >= 0; j--) {
      var date = new Date();
      date.setDate(date.getDate() - j);
      days.push(date.toISOString().slice(0, 10));
    }
    return days;
  }

  function calcMultiDay(babyId, dateStrs) {
    return Promise.all(dateStrs.map(function (dateKey) {
      return DB.getEventsByDay(babyId, dateKey).then(function (events) {
        var ml = 0;
        var feedCount = 0;
        var sleepMin = 0;
        var diaperCount = 0;
        events.forEach(function (event) {
          switch (event.type) {
            case 'formula':
              ml += (event.amount_ml || 0);
              feedCount++;
              break;
            case 'milk_bottle':
              ml += (event.amount_ml || 0);
              feedCount++;
              break;
            case 'milk_direct':
              feedCount++;
              break;
            case 'sleep':
              sleepMin += event.duration_min != null ? event.duration_min : (getDurationSec(event) / 60);
              break;
            case 'diaper':
              diaperCount++;
              break;
          }
        });
        return {
          date: dateKey,
          ml: ml,
          feedCount: feedCount,
          sleepMin: sleepMin,
          diaperCount: diaperCount
        };
      });
    }));
  }

  function daysSinceBirth(birthday) {
    if (!birthday) return null;
    var birthRange = window.TimeUtil ? TimeUtil.getChinaDayRange(birthday) : null;
    var birthMs = birthRange ? birthRange.startMs : new Date(birthday).getTime();
    var nowRange = window.TimeUtil ? TimeUtil.getChinaDayRange(TimeUtil.todayChinaDate()) : null;
    var nowMs = nowRange ? nowRange.startMs : Date.now();
    return Math.max(0, Math.floor((nowMs - birthMs) / 86400000));
  }

  function getAgeMonths(birthday) {
    var days = daysSinceBirth(birthday);
    if (days == null) return null;
    return Math.max(0, Math.floor(days / 30));
  }

  function getChineseWeightReference(months) {
    var table = [
      { m: 0, min: 2.5, max: 4.8 },
      { m: 1, min: 3.4, max: 5.8 },
      { m: 2, min: 4.3, max: 6.9 },
      { m: 3, min: 5.0, max: 7.6 },
      { m: 4, min: 5.6, max: 8.2 },
      { m: 5, min: 6.0, max: 8.7 },
      { m: 6, min: 6.4, max: 9.2 },
      { m: 9, min: 7.1, max: 10.2 },
      { m: 12, min: 7.7, max: 11.1 }
    ];
    var pick = table[0];
    table.forEach(function (item) {
      if (months >= item.m) pick = item;
    });
    return pick;
  }

  function getChineseHeightReference(months) {
    var table = [
      { m: 0, min: 46.0, max: 54.0 },
      { m: 1, min: 50.0, max: 58.4 },
      { m: 2, min: 53.2, max: 61.8 },
      { m: 3, min: 55.8, max: 64.8 },
      { m: 4, min: 58.0, max: 67.2 },
      { m: 5, min: 59.9, max: 69.1 },
      { m: 6, min: 61.4, max: 70.8 },
      { m: 9, min: 65.2, max: 74.8 },
      { m: 12, min: 68.6, max: 78.5 }
    ];
    var pick = table[0];
    table.forEach(function (item) {
      if (months >= item.m) pick = item;
    });
    return pick;
  }

  function buildHeightReferenceText(heightValue, birthday) {
    if (!birthday) return heightValue.toFixed(1) + 'cm';
    var months = getAgeMonths(birthday) || 0;
    var ref = getChineseHeightReference(months);
    var status = heightValue < ref.min ? '偏低' : (heightValue > ref.max ? '偏高' : '接近参考');
    return heightValue.toFixed(1) + 'cm / ' + months + '个月中国参考 ' + ref.min.toFixed(1) + '-' + ref.max.toFixed(1) + 'cm / ' + status;
  }

  function buildWeightReferenceText(weightValue, birthday) {
    if (!birthday) return weightValue.toFixed(2) + 'kg';
    var months = getAgeMonths(birthday) || 0;
    var ref = getChineseWeightReference(months);
    var status = weightValue < ref.min ? '偏低' : (weightValue > ref.max ? '偏高' : '接近参考');
    return weightValue.toFixed(2) + 'kg / ' + months + '个月中国参考 ' + ref.min.toFixed(1) + '-' + ref.max.toFixed(1) + 'kg / ' + status;
  }

  function buildGrowthReferenceText(heightValue, weightValue, birthday) {
    var parts = [];
    if (heightValue != null && !isNaN(heightValue) && heightValue > 0) {
      parts.push(buildHeightReferenceText(heightValue, birthday));
    }
    if (weightValue != null && !isNaN(weightValue) && weightValue > 0) {
      parts.push(buildWeightReferenceText(weightValue, birthday));
    }
    return parts.join(' / ');
  }

  function getFeedReferenceTime(event) {
    var startMs = new Date(event.start_time).getTime() || Date.now();
    if (event.end_time) return new Date(event.end_time);
    if (event.type === 'milk_direct') {
      return new Date(startMs + getDurationMs(event));
    }
    return new Date(startMs);
  }

  function getDurationMs(event) {
    if (!event) return 0;
    if (needsLegacyDirectManualFix(event)) {
      var legacyMinutes = ((Number(event.left_min) || 0) + (Number(event.right_min) || 0)) || (Number(event.duration_min) || 0);
      return Math.round(legacyMinutes * 3600000);
    }
    return getDurationSec(event) * 1000;
  }

  function needsLegacyDirectManualFix(event) {
    return !!(event && event.type === 'milk_direct' && !event.end_time && event.duration_min != null && Number(event.duration_min) > 0 && Number(event.duration_min) < 1);
  }

  function getDurationSec(event) {
    if (!event) return 0;
    if (event.duration_sec != null) return Number(event.duration_sec) || 0;
    if (event.left_sec != null || event.right_sec != null) return (Number(event.left_sec) || 0) + (Number(event.right_sec) || 0);
    if (event.duration_min != null) return Math.round(Number(event.duration_min || 0) * 60);
    return 0;
  }

  function eventDescription(event) {
    var type = EVENT_TYPES[event.type] || { label: event.type };
    if (event.type === 'milk_direct') {
      var totalSec = getDurationSec(event);
      var leftSec = event.left_sec != null ? (Number(event.left_sec) || 0) : Math.round(Number(event.left_min || 0) * 60);
      var rightSec = event.right_sec != null ? (Number(event.right_sec) || 0) : Math.round(Number(event.right_min || 0) * 60);
      return type.label + ' / ' + formatSeconds(totalSec) + '（左 ' + formatSeconds(leftSec) + ' / 右 ' + formatSeconds(rightSec) + '）';
    }
    if (event.type === 'weight') {
      var growthParts = [];
      if (event.height_cm != null && Number(event.height_cm) > 0) growthParts.push(Number(event.height_cm).toFixed(1) + 'cm');
      if (event.weight_kg != null && Number(event.weight_kg) > 0) growthParts.push(Number(event.weight_kg).toFixed(2) + 'kg');
      if (growthParts.length === 0) growthParts.push('未填写');
      return type.label + ' / ' + growthParts.join(' / ');
    }
    var parts = [type.label];
    if (event.amount_ml) parts.push(event.amount_ml + 'ml');
    if (event.duration_sec != null || event.duration_min != null) parts.push(formatSeconds(getDurationSec(event)));
    if (event.stool || event.stool_amount) parts.push('💩' + (event.stool_amount ? event.stool_amount : ''));
    if (event.note && event.type !== 'weight') parts.push(event.note);
    return parts.join(' / ');
  }

  return {
    timeSinceLastFeed: timeSinceLastFeed,
    calcToday: calcToday,
    formatDuration: formatDuration,
    formatMin: formatMin,
    formatSeconds: formatSeconds,
    formatCountdown: formatCountdown,
    formatTime: formatTime,
    formatDateLabel: formatDateLabel,
    getWeekday: getWeekday,
    getLastNDays: getLastNDays,
    calcMultiDay: calcMultiDay,
    daysSinceBirth: daysSinceBirth,
    getAgeMonths: getAgeMonths,
    getChineseWeightReference: getChineseWeightReference,
    getChineseHeightReference: getChineseHeightReference,
    buildHeightReferenceText: buildHeightReferenceText,
    buildWeightReferenceText: buildWeightReferenceText,
    buildGrowthReferenceText: buildGrowthReferenceText,
    eventDescription: eventDescription
  };
})();
