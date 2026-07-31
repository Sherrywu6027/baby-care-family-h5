var UICopyFix = (function () {
  var observer = null;
  var replacements = [
    ['操作结果', '处理结果'],
    ['操作失败', '处理失败'],
    ['请稍候', '处理中'],
    ['同步完成', '同步成功'],
    ['当前设备上的最新数据已经刷新。', '当前页面已经同步到最新数据。'],
    ['同步失败，请稍后重试。', '这次同步没有成功，请稍后再试。'],
    ['导出完成', '备份已导出'],
    ['导出失败', '备份导出失败'],
    ['导入成功', '备份已恢复'],
    ['导入失败', '备份恢复失败'],
    ['备份数据已恢复，页面将刷新显示最新内容。', '备份数据已经恢复，刷新后就能看到最新内容。'],
    ['刷新页面', '立即刷新'],
    ['保存成功', '已保存'],
    ['已记录吸奶', '吸奶记录已保存'],
    ['已记录亲喂', '亲喂记录已保存'],
    ['已记录成长数据', '成长记录已保存'],
    ['已记录计时', '计时记录已保存'],
    ['退出登录失败，请稍后重试。', '退出登录没有成功，请稍后再试。'],
    ['退出家庭失败，请稍后重试。', '退出家庭没有成功，请稍后再试。'],
    ['移除成员失败，请稍后重试。', '移除成员没有成功，请稍后再试。'],
    ['转让创建者失败，请稍后重试。', '转让创建者没有成功，请稍后再试。'],
    ['删除宝宝失败，请稍后重试。', '删除宝宝没有成功，请稍后再试。'],
    ['成员已从当前家庭中移除。', '该成员已经从当前家庭移除。'],
    ['家庭创建者身份已更新。', '家庭创建者已经切换完成。'],
    ['宝宝资料和相关记录已更新。', '宝宝资料已经删除，相关记录也已同步更新。'],
    ['当前账号已退出，页面会回到登录页。', '当前账号已退出，页面会回到登录页。'],
    ['页面将回到家庭选择页。', '页面将回到家庭选择页。'],
    ['这个家庭还没有宝宝', '当前家庭还没有宝宝'],
    ['今天还没有记录', '今天还没有新增记录'],
    ['先添加宝宝，后续记录才会显示在这里。', '先添加宝宝，之后的记录会显示在这里。'],
    ['先添加宝宝，添加后就可以查看统计和成长记录。', '先添加宝宝，添加后就可以查看统计和成长记录。']
  ];

  function init() {
    apply();
    if (observer) observer.disconnect();
    observer = new MutationObserver(function () {
      apply();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['placeholder', 'value', 'title', 'aria-label']
    });
    window.addEventListener('hashchange', function () {
      window.setTimeout(apply, 20);
    });
  }

  function apply() {
    if (!document.body) return;
    replaceTextNodes(document.body);
    replaceAttributes(document.body);
  }

  function replaceTextNodes(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var node;
    while ((node = walker.nextNode())) {
      var next = replaceText(node.nodeValue);
      if (next !== node.nodeValue) node.nodeValue = next;
    }
  }

  function replaceAttributes(root) {
    if (!root.querySelectorAll) return;
    root.querySelectorAll('*').forEach(function (node) {
      ['placeholder', 'title', 'aria-label', 'value'].forEach(function (attr) {
        if (!node.hasAttribute || !node.hasAttribute(attr)) return;
        if (attr === 'value' && !/^(button|submit|reset)$/i.test(String(node.type || ''))) return;
        var value = node.getAttribute(attr);
        var next = replaceText(value);
        if (next !== value) node.setAttribute(attr, next);
      });
    });
  }

  function replaceText(value) {
    var next = String(value || '');
    replacements.forEach(function (entry) {
      next = next.split(entry[0]).join(entry[1]);
    });
    return next;
  }

  return {
    init: init
  };
})();

document.addEventListener('DOMContentLoaded', function () {
  UICopyFix.init();
});
