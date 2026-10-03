/* ============================================================
   market.js —— 心意市集（占位版）
   当前只做：
     - 主页"心意集市"按钮 → 切换到 #pageMarket
     - 返回按钮 → 回主页
     - 顶部 Tab 切换（市集 / 心意柜 / 心愿单）
     - 心意柜子 Tab 切换、心愿单子 Tab 切换（仅切 UI）
   完整逻辑（钱包、商品、下单、心愿增删、记录）后续补。
   ============================================================ */
(function () {
  'use strict';

  console.log('market loaded');

  // ==================== 页面切换 ====================
  var btnMarket   = document.getElementById('btnMarket');
  var mktBackBtn  = document.getElementById('mktBackBtn');

  if (btnMarket) {
    btnMarket.addEventListener('click', function (e) {
      e.preventDefault();
      if (window.showPage && window.pageMarket) {
        window.showPage(window.pageMarket);
      } else if (window.showPage) {
        var p = document.getElementById('pageMarket');
        if (p) window.showPage(p);
      }
    });
  }

  if (mktBackBtn) {
    mktBackBtn.addEventListener('click', function () {
      if (window.showPage && window.pageHome) {
        window.showPage(window.pageHome);
      }
    });
  }

  // ==================== 顶部 Tab 切换 ====================
  var mktTabs = document.querySelectorAll('.mkt-tab');
  var mktViews = {
    shop:     document.getElementById('mktViewShop'),
    cabinet:  document.getElementById('mktViewCabinet'),
    wishlist: document.getElementById('mktViewWishlist')
  };

  mktTabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      var name = tab.getAttribute('data-tab');
      mktTabs.forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');

      Object.keys(mktViews).forEach(function (k) {
        if (mktViews[k]) mktViews[k].classList.toggle('active', k === name);
      });
    });
  });

  // ==================== 心意柜子 Tab ====================
  document.querySelectorAll('#mktViewCabinet .mkt-sub-tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('#mktViewCabinet .mkt-sub-tab').forEach(function (b) {
        b.classList.remove('active');
      });
      btn.classList.add('active');
    });
  });

  // ==================== 心愿单子 Tab ====================
  document.querySelectorAll('#mktViewWishlist .mkt-sub-tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('#mktViewWishlist .mkt-sub-tab').forEach(function (b) {
        b.classList.remove('active');
      });
      btn.classList.add('active');
    });
  });

  // ==================== 钱包按钮占位 ====================
  var walletBtn = document.getElementById('mktWalletBtn');
  if (walletBtn) {
    walletBtn.addEventListener('click', function () {
      alert('修改钱包功能开发中（下一步实现）');
    });
  }

  // 暴露接口
  window.market = {
    enter: function () {
      if (window.showPage && window.pageMarket) {
        window.showPage(window.pageMarket);
      }
    }
  };

})();
