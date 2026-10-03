/* ============================================================
   feed.js —— 朋友圈（占位版）
   当前只做：
     - 主页"朋友圈"按钮 → 切换到 #pageFeed
     - 返回按钮 → 回主页
     - 发帖输入框 → 打开 / 关闭发帖弹层（不提交）
   完整逻辑（发帖、点赞、评论、收藏、联系人联动）后续补。
   ============================================================ */
(function () {
  'use strict';

  console.log('feed loaded');

  // ==================== 页面切换 ====================
  var btnFeed     = document.getElementById('btnFeed');
  var feedBackBtn = document.getElementById('feedBackBtn');

  if (btnFeed) {
    btnFeed.addEventListener('click', function (e) {
      e.preventDefault();
      if (window.showPage && window.pageFeed) {
        window.showPage(window.pageFeed);
      } else if (window.showPage) {
        var p = document.getElementById('pageFeed');
        if (p) window.showPage(p);
      }
    });
  }

  if (feedBackBtn) {
    feedBackBtn.addEventListener('click', function () {
      if (window.showPage && window.pageHome) {
        window.showPage(window.pageHome);
      }
    });
  }

  // ==================== 发帖弹层（占位） ====================
  var postBar    = document.getElementById('feedPostBar');
  var postModal  = document.getElementById('feedPostModal');
  var postClose  = document.getElementById('feedPostClose');
  var postCancel = document.getElementById('feedPostCancel');
  var postSubmit = document.getElementById('feedPostSubmit');
  var postText   = document.getElementById('feedPostText');

  function openPostModal() {
    if (postText) postText.value = '';
    if (postModal) postModal.classList.add('active');
    setTimeout(function () { if (postText) postText.focus(); }, 100);
  }
  function closePostModal() {
    if (postModal) postModal.classList.remove('active');
  }

  if (postBar)    postBar.addEventListener('click', openPostModal);
  if (postClose)  postClose.addEventListener('click', closePostModal);
  if (postCancel) postCancel.addEventListener('click', closePostModal);
  if (postModal) {
    postModal.addEventListener('click', function (e) {
      if (e.target === postModal) closePostModal();
    });
  }

  if (postSubmit) {
    postSubmit.addEventListener('click', function () {
      var text = postText ? postText.value.trim() : '';
      if (!text) { alert('请输入内容'); return; }
      alert('发帖功能开发中（下一步实现）');
    });
  }

})();
