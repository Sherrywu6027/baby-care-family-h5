/**
 * calc.js — 计算逻辑（纯前端，离线可用）
 */
var Calc = (function () {

  // 距上次喝奶（毫秒），返回 null 表示无记录
  function timeSinceLastFeed(babyId) {
    return DB.getRecentFeeds(babyId, 1).then(function (feeds) {
      if (!feeds || feeds.length === 0) return null;
      var last = feeds[0];
      var refTime = getFeedReferenceTime(last);
      return Date.now() - refTime.getTime();
    });
  }

  // 今日汇总
  function calcToday(babyId) {
    var today = new Date().toISOString().slice(0, 10);
    return DB.getEventsByDay(babyId, today).then(function (events) {
      var summary = {
        feedMl: 0,
        feedCount: 0,
        sleepMin: 0,
        diaperCount: 0,
        diaperStool: 0,
        pumpMl: 0,
        pumpCount: 0,
        weightCount: 0,
        directMin: 0,
        directCount: 0,
        directSec: 0
      };
      events.forEach(function (e) {
        switch (e.type) {
          case 'formula':
            summary.feedMl += (e.amount_ml || 0);
            summary.feedCount++;
            break;
          case 'milk_bottle':
            summary.feedMl += (e.amount_ml || 0);
            summary.feedCount++;
            break;
          case 'milk_direct':
            summary.feedCount++;
            summary.directCount++;
            summary.directSec += getDurationSec(e);
            summary.directMin += ((e.duration_min != null) ? e.duration_min : (getDurationSec(e) / 60));
            break;
          case 'sleep':
            summary.sleepMin += ((e.duration_min != null) ? e.duration_min : (getDurationSec(e) / 60));
            break;
          case 'diaper':
            summary.diaperCount++;
            if (e.stool || e.stool_amount) summary.diaperStool++;
            break;
          case 'pump':
            summary.pumpMl += (e.amount_ml || 0);
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

  // 格式化毫秒为 "Xh Ym" 或 "Ym"
  function formatDuration(ms) {
    if (ms == null) return '--';
    var totalMin = Math.floor(ms / 60000);
    var h = Math.floor(totalMin / 60);
    var m = totalMin % 60;
    if (h > 0) return h + 'h' + (m > 0 ? ' ' + m + 'm' : '');
    return m + 'm';
  }

  // 格式化分钟为 "Xh Ym"
  function formatMin(min) {
    if (!min || min <= 0) return '0m';
    var totalSec = Math.round(min * 60);
    return formatSeconds(totalSec);
  }

  function formatSeconds(totalSec) {
    if (!totalSec || totalSec <= 0) return '0s';
    var h = Math.floor(totalSec / 3600);
    var m = Math.floor((totalSec % 3600) / 60);
    var s = totalSec % 60;
    var parts = [];
    if (h > 0) parts.push(h + 'h');
    if (m > 0) parts.push(m + 'm');
    if (s > 0 || parts.length === 0) parts.push(s + 's');
    return parts.join(' ');
  }

  // 格式化倒计时（秒级，显示 mm:ss 或 h:mm:ss）
  function formatCountdown(ms) {
    if (ms == null) return '--';
    var totalSec = Math.floor(ms / 1000);
    var h = Math.floor(totalSec / 3600);
    var m = Math.floor((totalSec % 3600) / 60);
    var s = totalSec % 60;
    if (h > 0) return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  // 格式化时间显示 (HH:MM)
  function formatTime(isoStr) {
    var d = new Date(isoStr);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  // 获取日期标签
  function formatDateLabel(date) {
    var d = date || new Date();
    var weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }

  function getWeekday(date) {
    var d = date || new Date();
    return '周' + ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  }

  // 获取最近 N 天的日期数组
  function getLastNDays(n) {
    var days = [];
    for (var i = n - 1; i >= 0; i--) {
      var d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }
    return days;
  }

  // 统计多天数据
  function calcMultiDay(babyId, dateStrs) {
    return Promise.all(dateStrs.map(function (d) {
      return DB.getEventsByDay(babyId, d).then(function (events) {
        var ml = 0, feedCount = 0, sleepMin = 0, diaperCount = 0;
        events.forEach(function (e) {
          switch (e.type) {
            case 'formula': ml += (e.amount_ml || 0); feedCount++; break;
            case 'milk_bottle': ml += (e.amount_ml || 0); feedCount++; break;
            case 'milk_direct': feedCount++; break;
            case 'sleep': sleepMin += ((e.duration_min != null) ? e.duration_min : (getDurationSec(e) / 60)); break;
            case 'diaper': diaperCount++; break;
          }
        });
        return { date: d, ml: ml, feedCount: feedCount, sleepMin: sleepMin, diaperCount: diaperCount };
      });
    }));
  }

  // 计算天数（宝宝出生几天）
  function daysSinceBirth(birthday) {
    if (!birthday) return null;
    var b = new Date(birthday);
    var now = new Date();
    return Math.floor((now - b) / 86400000);
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
    table.forEach(function (item) { if (months >= item.m) pick = item; });
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
    table.forEach(function (item) { if (months >= item.m) pick = item; });
    return pick;
  }

  function buildHeightReferenceText(heightValue, birthday) {
    if (!birthday) return heightValue.toFixed(1) + 'cm';
    var months = getAgeMonths(birthday) || 0;
    var ref = getChineseHeightReference(months);
    var status = heightValue < ref.min ? '偏低' : (heightValue > ref.max ? '偏高' : '接近参考');
    return heightValue.toFixed(1) + 'cm · ' + months + '个月中国参考 ' + ref.min.toFixed(1) + '-' + ref.max.toFixed(1) + 'cm · ' + status;
  }

  function buildWeightReferenceText(weightValue, birthday) {
    if (!birthday) return weightValue.toFixed(2) + 'kg';
    var months = getAgeMonths(birthday) || 0;
    var ref = getChineseWeightReference(months);
    var status = weightValue < ref.min ? '偏低' : (weightValue > ref.max ? '偏高' : '接近参考');
    return weightValue.toFixed(2) + 'kg · ' + months + '个月中国参考 ' + ref.min.toFixed(1) + '-' + ref.max.toFixed(1) + 'kg · ' + status;
  }

  function buildGrowthReferenceText(heightValue, weightValue, birthday) {
    var parts = [];
    if (heightValue != null && !isNaN(heightValue) && heightValue > 0) {
      parts.push(buildHeightReferenceText(heightValue, birthday));
    }
    if (weightValue != null && !isNaN(weightValue) && weightValue > 0) {
      parts.push(buildWeightReferenceText(weightValue, birthday));
    }
    return parts.join(' · ');
  }

  function getFeedReferenceTime(event) {
    var startMs = new Date(event.start_time).getTime() || Date.now();
    if (event.end_time) return new Date(event.end_time);
    if (event.type === 'milk_direct') {
      return new Date(startMs + getDurationMs(event));
    }
    return new Date(startMs);
  }

  function getDurationMs(e) {
    if (!e) return 0;
    if (needsLegacyDirectManualFix(e)) {
      var legacyMinutes = (Number(e.left_min) || 0) + (Number(e.right_min) || 0) || (Number(e.duration_min) || 0);
      return Math.round(legacyMinutes * 3600000);
    }
    return getDurationSec(e) * 1000;
  }

  function needsLegacyDirectManualFix(e) {
    return !!(e && e.type === 'milk_direct' && !e.end_time && e.duration_min != null && Number(e.duration_min) > 0 && Number(e.duration_min) < 1);
  }

  function getDurationSec(e) {
    if (!e) return 0;
    if (e.duration_sec != null) return Number(e.duration_sec) || 0;
    if (e.left_sec != null || e.right_sec != null) return (Number(e.left_sec) || 0) + (Number(e.right_sec) || 0);
    if (e.duration_min != null) return Math.round(Number(e.duration_min || 0) * 60);
    return 0;
  }

  // 生成事件描述文本
  function eventDescription(e) {
    var type = EVENT_TYPES[e.type] || { label: e.type };
    if (e.type === 'milk_direct') {
      var totalSec = getDurationSec(e);
      var leftSec = e.left_sec != null ? (Number(e.left_sec) || 0) : Math.round(Number(e.left_min || 0) * 60);
      var rightSec = e.right_sec != null ? (Number(e.right_sec) || 0) : Math.round(Number(e.right_min || 0) * 60);
      return type.label + ' · ' + formatSeconds(totalSec) + '（左 ' + formatSeconds(leftSec) + ' / 右 ' + formatSeconds(rightSec) + '）';
    }
    if (e.type === 'weight') {
      var growthParts = [];
      if (e.height_cm != null && Number(e.height_cm) > 0) growthParts.push(Number(e.height_cm).toFixed(1) + 'cm');
      if (e.weight_kg != null && Number(e.weight_kg) > 0) growthParts.push(Number(e.weight_kg).toFixed(2) + 'kg');
      if (growthParts.length === 0) growthParts.push('未填写');
      return type.label + ' · ' + growthParts.join(' / ');
    }
    var parts = [type.label];
    if (e.amount_ml) parts.push(e.amount_ml + 'ml');
    if (e.duration_sec != null || e.duration_min != null) parts.push(formatSeconds(getDurationSec(e)));
    if (e.stool || e.stool_amount) parts.push('💩' + (e.stool_amount ? e.stool_amount : ''));
    if (e.note && e.type !== 'weight') parts.push(e.note);
    return parts.join(' · ');
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
