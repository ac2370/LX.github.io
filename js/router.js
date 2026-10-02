/* ============================================================
   router.js —— 页面切换 / 底部导航 / 全局页面路由
   挂载：window.showPage, window.pageHome, window.pageCard,
         window.pageChat, window.pageCompanion,
         window.pageCompanionActive, window.pageImportantDay
   ============================================================ */
(function () {
  'use strict';

  // ==================== 页面节点 ====================
  var pageHome             = document.getElementById('pageHome');
  var pageCard             = document.getElementById('pageCard');
  var pageChat             = document.getElementById('pageChat');
  var pageCompanion        = document.getElementById('pageCompanion');
  var pageCompanionActive  = document.getElementById('pageCompanionActive');
  var pageImportantDay     = document.getElementById('pageImportantDay');

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
    hideAll();
    page.classList.add('active');
    // 切换页面后回到顶部，避免继承上一页的滚动位置
    try { window.scrollTo(0, 0); } catch (e) {}
  }

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
  window.pageHome            = pageHome;
  window.pageCard            = pageCard;
  window.pageChat            = pageChat;
  window.pageCompanion       = pageCompanion;
  window.pageCompanionActive = pageCompanionActive;
  window.pageImportantDay    = pageImportantDay;

})();
