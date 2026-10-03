/* ============================================================
   router.js —— 页面切换 / 底部导航 / 全局页面路由
   挂载：window.showPage, window.pageHome, window.pageCard,
         window.pageChat, window.pageCompanion,
         window.pageCompanionActive, window.pageImportantDay
   ============================================================ */
(function () {
  'use strict';

  // ==================== 页面节点 ====================
  var pageHome            = document.getElementById('pageHome');
  var pageCard            = document.getElementById('pageCard');
  var pageChat            = document.getElementById('pageChat');
  var pageCompanion       = document.getElementById('pageCompanion');
  var pageCompanionActive = document.getElementById('pageCompanionActive');
  var pageImportantDay    = document.getElementById('pageImportantDay');
  var pageMood            = document.getElementById('pageMood');
  var pageEnvelope        = document.getElementById('pageEnvelope');

  // 所有需要参与切换的页面集合（自动收集所有 .page）
  var allPages = Array.prototype.slice.call(document.querySelectorAll('.page'));

  // ==================== 核心切换 ====================
  function hideAll() {
    allPages.forEach(function (p) {
      p.classList.remove('active');
    });
  }

  function showPage(page) {
    if (!page) return;

    // 1) 先移除所有页面的 .active
    hideAll();

    // 2) 再给目标页面添加 .active
    page.classList.add('active');

    // 3) 回到顶部，避免继承上一页滚动位置
    try { window.scrollTo(0, 0); } catch (e) {}
  }

  // 兜底：页面加载完成后，确保只有一个页面处于 active
  // （防止 HTML 里手滑给多个 .page 加了 active）
  (function ensureSingleActive() {
    var actives = document.querySelectorAll('.page.active');
    if (actives.length > 1) {
      // 保留第一个，移除其余
      for (var i = 1; i < actives.length; i++) {
        actives[i].classList.remove('active');
      }
    }
    // 如果一个 active 都没有，就把主页激活
    if (document.querySelectorAll('.page.active').length === 0 && pageHome) {
      pageHome.classList.add('active');
    }
  })();

  // ==================== 底部导航 ====================
  var tabCard = document.getElementById('tabCard');
  if (tabCard) {
    tabCard.addEventListener('click', function (e) {
      e.preventDefault();
      showPage(pageCard);
      if (window.refreshCardUI) window.refreshCardUI();
    });
  }

  var tabMessage = document.getElementById('tabMessage');
  if (tabMessage) {
    tabMessage.addEventListener('click', function (e) {
      e.preventDefault();
      showPage(pageChat);
      if (window.initChatPage) window.initChatPage();
    });
  }

  // ==================== 返回主页 ====================
  var cardBackBtn = document.getElementById('cardBackBtn');
  if (cardBackBtn) {
    cardBackBtn.addEventListener('click', function () {
      showPage(pageHome);
    });
  }

  var homeReturnBtn = document.getElementById('homeReturnBtn');
  if (homeReturnBtn) {
    homeReturnBtn.addEventListener('click', function () {
      showPage(pageHome);
    });
  }

  // ==================== 其它 tab 按钮的 active 状态 ====================
  document.querySelectorAll('.tab-btn').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      // tabCard / tabMessage 的切换逻辑上面已单独处理，这里只负责 active 高亮
      if (btn.id === 'tabCard' || btn.id === 'tabMessage') return;
      e.preventDefault();
      document.querySelectorAll('.tab-btn').forEach(function (b) {
        b.classList.remove('active');
      });
      btn.classList.add('active');
    });
  });

  // ==================== 挂载到 window ====================
  window.showPage            = showPage;
  window.hideAllPages        = hideAll;
  window.pageHome            = pageHome;
  window.pageCard            = pageCard;
  window.pageChat            = pageChat;
  window.pageCompanion       = pageCompanion;
  window.pageCompanionActive = pageCompanionActive;
  window.pageImportantDay    = pageImportantDay;
  window.pageMood            = pageMood;
  window.pageEnvelope        = pageEnvelope;

})();
