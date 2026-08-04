var TimeUtil = (function () {
  var DAY_MS = 24 * 60 * 60 * 1000;
  var DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  var WEEKDAY_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    weekday: 'short'
  });
  var LABEL_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: 'numeric',
    day: 'numeric'
  });

  function toDate(input) {
    return input instanceof Date ? new Date(input.getTime()) : new Date(input);
  }

  function formatToParts(input) {
    var parts = DATE_FORMATTER.formatToParts(toDate(input));
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

  function parseDateKey(dateKey) {
    var segs = String(dateKey || '').split('-');
    return {
      year: Number(segs[0]) || 0,
      month: Number(segs[1]) || 1,
      day: Number(segs[2]) || 1
    };
  }

  function todayChinaDate() {
    return formatToParts(Date.now()).dateKey;
  }

  function getChinaDayRange(dateKey) {
    var parts = parseDateKey(dateKey);
    var startMs = Date.UTC(parts.year, parts.month - 1, parts.day, -8, 0, 0, 0);
    return {
      startMs: startMs,
      endMs: startMs + DAY_MS - 1
    };
  }

  function shiftChinaDate(dateKey, offsetDays) {
    var range = getChinaDayRange(dateKey);
    return formatToParts(range.startMs + ((Number(offsetDays) || 0) * DAY_MS)).dateKey;
  }

  function makeLocalIsoFromChinaDateTime(dateKey, timeValue) {
    return new Date(String(dateKey || '') + 'T' + String(timeValue || '00:00')).toISOString();
  }

  function getEventChinaDateKey(event) {
    return formatToParts(event && event.start_time ? event.start_time : Date.now()).dateKey;
  }

  function formatChinaDateLabel(dateKey) {
    var range = getChinaDayRange(dateKey);
    var date = new Date(range.startMs);
    var weekday = WEEKDAY_FORMATTER.format(date).replace(/^周/, '');
    var monthDay = LABEL_FORMATTER.format(date).replace(/\//g, '月').replace(/\/?$/, '');
    var cleanMonthDay = monthDay.indexOf('日') >= 0 ? monthDay : monthDay + '日';
    return cleanMonthDay + ' ' + weekday;
  }

  function getChinaWeekdayLabel(input) {
    return WEEKDAY_FORMATTER.format(toDate(input));
  }

  function formatChinaDateTime(input) {
    return new Date(input).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  }

  return {
    todayChinaDate: todayChinaDate,
    toChinaDateParts: formatToParts,
    getChinaDayRange: getChinaDayRange,
    shiftChinaDate: shiftChinaDate,
    makeLocalIsoFromChinaDateTime: makeLocalIsoFromChinaDateTime,
    getEventChinaDateKey: getEventChinaDateKey,
    formatChinaDateLabel: formatChinaDateLabel,
    getChinaWeekdayLabel: getChinaWeekdayLabel,
    formatChinaDateTime: formatChinaDateTime
  };
})();
