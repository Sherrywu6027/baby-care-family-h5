var UISettings = (function (baseUISettings) {
  var next = {};
  Object.keys(baseUISettings).forEach(function (key) {
    next[key] = baseUISettings[key];
  });
  return next;
})(UISettings);
