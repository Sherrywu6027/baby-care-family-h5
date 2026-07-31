var UITextFix = (function () {
  var observer = null;
  var replacements = [
    ['瀹濆疂鐓ф姢璁板綍', '宝宝照护记录'],
    ['瀹濆疂璁板綍', '宝宝记录'],
    ['璐﹀彿鐧诲綍', '账号登录'],
    ['浠婃棩', '今日'],
    ['璁板綍', '记录'],
    ['缁熻', '统计'],
    ['璁剧疆', '设置'],
    ['鍏ㄩ儴璁板綍', '全部记录'],
    ['鍏ㄩ儴鏃ユ湡', '全部日期'],
    ['鏆傛棤璁板綍', '暂无记录'],
    ['鏈€杩戣褰', '最近记录'],
    ['鍏ㄩ儴', '全部'],
    ['鏃ユ湡', '日期'],
    ['鏃堕棿', '时间'],
    ['澶囨敞', '备注'],
    ['琛ュ厖澶囨敞', '补充备注'],
    ['娣诲姞浜', '添加人'],
    ['娣诲姞鏃堕棿', '添加时间'],
    ['鍘嗗彶璁板綍', '历史记录'],
    ['瀹濆疂', '宝宝'],
    ['瀹濆疂妗ｆ', '宝宝档案'],
    ['娣诲姞瀹濆疂', '添加宝宝'],
    ['缂栬緫瀹濆疂', '编辑宝宝'],
    ['灏忓悕', '小名'],
    ['鍑虹敓鏃ユ湡', '出生日期'],
    ['澶村儚', '头像'],
    ['淇濆瓨', '保存'],
    ['淇濆瓨淇敼', '保存修改'],
    ['鍒犻櫎姝ゅ疂瀹', '删除此宝宝'],
    ['鍒犻櫎杩欐潯璁板綍', '删除这条记录'],
    ['鍒犻櫎', '删除'],
    ['宸插垹闄', '已删除'],
    ['宸蹭繚瀛', '已保存'],
    ['宸蹭慨鏀', '已修改'],
    ['璇风‘璁', '请确认'],
    ['纭', '确认'],
    ['鍙栨秷', '取消'],
    ['缁х画', '继续'],
    ['閫€鍑虹櫥褰', '退出登录'],
    ['閫€鍑哄綋鍓嶅搴', '退出当前家庭'],
    ['瀹跺涵', '家庭'],
    ['瀹跺涵鐮', '家庭码'],
    ['鍒涘缓瀹跺涵', '创建家庭'],
    ['鍔犲叆瀹跺涵', '加入家庭'],
    ['鐢宠鍔犲叆瀹跺涵', '申请加入家庭'],
    ['绉板懠', '称呼'],
    ['淇敼鎴愬憳绉板懠', '修改成员称呼'],
    ['淇敼鎴戠殑绉板懠', '修改我的称呼'],
    ['鎴愬憳', '成员'],
    ['绉婚櫎鎴愬憳', '移除成员'],
    ['杞鍒涘缓鑰', '转让创建者'],
    ['棣栭〉鎸夐挳', '首页按钮'],
    ['绔嬪嵆鍚屾', '立即同步'],
    ['姝ｅ湪鍚屾', '正在同步'],
    ['鍚屾瀹屾垚', '同步完成'],
    ['鍚屾澶辫触', '同步失败'],
    ['澶嶅埗瀹跺涵鐮', '复制家庭码'],
    ['鐢熸垚瀹跺涵鐮', '生成家庭码'],
    ['璁剧疆瀵嗙爜', '设置密码'],
    ['鍙戦€侀噸缃瘑鐮侀偖浠', '发送重置密码邮件'],
    ['璇风◢鍊', '请稍候'],
    ['鎿嶄綔缁撴灉', '操作结果'],
    ['鎿嶄綔澶辫触', '操作失败'],
    ['導出全部数据', '导出全部数据'],
    ['瀵煎嚭鍏ㄩ儴鏁版嵁', '导出全部数据'],
    ['瀵煎叆澶囦唤', '导入备份'],
    ['宸插鍑', '已导出'],
    ['瀵煎叆鎴愬姛', '导入成功'],
    ['瀵煎叆澶辫触', '导入失败'],
    ['馃彔', '📅'],
    ['馃搵', '📝'],
    ['馃搳', '📊'],
    ['鈿欙笍', '⚙️'],
    ['馃嵓', '🍼'],
    ['馃懚', '👶'],
    ['馃専', '🧸'],
    ['馃Ц', '🌼'],
    ['馃惀', '🎀'],
    ['馃惢', '🫧'],
    ['馃', '🫧']
  ];

  function init() {
    repairDocument();
    if (observer) observer.disconnect();
    observer = new MutationObserver(function () {
      repairDocument();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['placeholder', 'value', 'title', 'aria-label']
    });
    window.addEventListener('hashchange', function () {
      window.setTimeout(repairDocument, 20);
    });
  }

  function repairDocument() {
    repairTitle();
    repairTextNodes(document.body);
    repairAttributes(document.body);
  }

  function repairTitle() {
    if (document.title) document.title = replaceText(document.title);
  }

  function repairTextNodes(root) {
    if (!root) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var current;
    while ((current = walker.nextNode())) {
      var next = replaceText(current.nodeValue);
      if (next !== current.nodeValue) current.nodeValue = next;
    }
  }

  function repairAttributes(root) {
    if (!root || !root.querySelectorAll) return;
    var nodes = root.querySelectorAll('*');
    nodes.forEach(function (node) {
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
    var text = String(value || '');
    var next = text;
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
  UITextFix.init();
});
