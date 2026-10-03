/**
 * 回复设定模态框
 * - 打开 / 关闭
 * - tab 切换
 * - 设置项持久化
 */

(function () {
  'use strict';

  var modal = document.getElementById('replySettingsModal');
  var openBtn = document.getElementById('cardEditBtn');
  var closeBtn = document.getElementById('replySettingsClose');

  if (!modal || !openBtn) {
    console.warn('[reply-settings] 缺少必要 DOM，跳过初始化');
    return;
  }

  function openModal() { modal.classList.add('active'); }
  function closeModal() { modal.classList.remove('active'); }

  openBtn.addEventListener('click', openModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', function (e) {
    if (e.target === modal) closeModal();
  });

  // tab 切换
  var tabBtns = document.querySelectorAll('.reply-tab-btn');
  var panels = {
    rhythm: document.getElementById('panel-rhythm'),
    proactive: document.getElementById('panel-proactive'),
    quote: document.getElementById('panel-quote')
  };
  tabBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var tab = btn.getAttribute('data-tab');
      tabBtns.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      Object.keys(panels).forEach(function (key) {
        if (panels[key]) panels[key].classList.toggle('active', key === tab);
      });
    });
  });
})();
