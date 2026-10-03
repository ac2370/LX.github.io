/* ============================================================
   envelope.js —— 信箱页面（占位版）
   当前只做：
     - 主页"信箱"按钮 → 切换到 #pageEnvelope
     - 返回按钮 → 回主页
     - 内部 Tab 切换（仅切换 UI 显示）
   完整逻辑（写信、寄出、回信、删除、localStorage）后续补。
   ============================================================ */
(function () {
  'use strict';

  console.log('envelope loaded');

  // ==================== 页面切换 ====================
  var btnEnvelope = document.getElementById('btnEnvelope');
  var envBackBtn  = document.getElementById('envBackBtn');

  if (btnEnvelope) {
    btnEnvelope.addEventListener('click', function (e) {
      e.preventDefault();
      if (window.showPage && window.pageEnvelope) {
        window.showPage(window.pageEnvelope);
      } else if (window.showPage) {
        var p = document.getElementById('pageEnvelope');
        if (p) window.showPage(p);
      }
    });
  }

  if (envBackBtn) {
    envBackBtn.addEventListener('click', function () {
      if (window.showPage && window.pageHome) {
        window.showPage(window.pageHome);
      }
    });
  }

  // ==================== Tab 切换 ====================
  var tabs       = document.querySelectorAll('.env-tab');
  var viewSent   = document.getElementById('envViewSent');
  var viewInbox  = document.getElementById('envViewInbox');
  var envFooter  = document.querySelector('#pageEnvelope .env-footer');

  function applyTabUI(name) {
    // 列表切换
    if (viewSent)  viewSent.classList.toggle('active',  name === 'sent');
    if (viewInbox) viewInbox.classList.toggle('active', name === 'inbox');

    // 底部"提笔写信"按钮：只在"寄出的信"时显示
    if (envFooter) {
      envFooter.style.display = (name === 'sent') ? '' : 'none';
    }
  }

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      var name = tab.getAttribute('data-tab');
      tabs.forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');
      applyTabUI(name);
    });
  });

  // 初始状态：默认"寄出的信" → 显示按钮
  applyTabUI('sent');

  // ==================== 写信 / 阅读 弹层占位 ====================
  var writeModal = document.getElementById('envWriteModal');
  var readModal  = document.getElementById('envReadModal');
  var writeBtn   = document.getElementById('envWriteBtn');
  var writeClose = document.getElementById('envWriteClose');
  var writeCancel = document.getElementById('envWriteCancel');

  if (writeBtn && writeModal) {
    writeBtn.addEventListener('click', function () {
      writeModal.classList.add('active');
    });
  }
  if (writeClose && writeModal) {
    writeClose.addEventListener('click', function () {
      writeModal.classList.remove('active');
    });
  }
  if (writeCancel && writeModal) {
    writeCancel.addEventListener('click', function () {
      writeModal.classList.remove('active');
    });
  }
  if (writeModal) {
    writeModal.addEventListener('click', function (e) {
      if (e.target === writeModal) writeModal.classList.remove('active');
    });
  }

  if (readModal) {
    readModal.addEventListener('click', function (e) {
      if (e.target === readModal) readModal.classList.remove('active');
    });
  }
  var readClose = document.getElementById('envReadClose');
  if (readClose && readModal) {
    readClose.addEventListener('click', function () {
      readModal.classList.remove('active');
    });
  }

  // 占位：点击"封 · 寄出"先提示，等下一步实现
  var writeSend = document.getElementById('envWriteSend');
  if (writeSend) {
    writeSend.addEventListener('click', function () {
      alert('寄信功能开发中（下一步实现）');
    });
  }

})();
