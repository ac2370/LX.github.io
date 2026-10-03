/* ============================================================
   chat-extras.js —— 传讯页扩展功能（拍一拍）
   触发：双击 #chatAvatar（280ms 内两次点击）
   流程：
     - 双击头像 → 打开"拍一拍字卡选择弹窗"
     - 从 window.getPatCards() 读取拍一拍字卡
     - 点某条 → 关闭弹窗 → 插入居中系统提示气泡
     - 延迟 2~5 秒 → 从 window.getReplyCards() 抽 1 条，以对方气泡发送
   依赖：
     - window.getPatCards / window.getReplyCards（card.js）
     - window.chatNotify（可选，notify-keepalive.js）
     - #chatAvatar / #chatMessages / #chatName（传讯页 DOM）
   ============================================================ */
(function () {
  'use strict';

  // ==================== 通用工具 ====================
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  function randomPick(arr) {
    if (!arr || arr.length === 0) return null;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function getContactName() {
    var nameEl = document.getElementById('chatName');
    if (nameEl && nameEl.textContent.trim()) return nameEl.textContent.trim();
    return 'Ta';
  }

  // ==================== 拍一拍：入口 ====================
  function initPatFeature() {
    var chatAvatar   = document.getElementById('chatAvatar');
    var chatMessages = document.getElementById('chatMessages');
    if (!chatAvatar || !chatMessages) return;

    // ---------- 双击检测 ----------
    // 说明：单击不拦截，让 role-panel.js 打开角色面板；
    //       双击时阻止事件继续传播，避免触发两次单击。
    var DBLCLICK_DELAY = 280;
    var lastClickTime = 0;

    chatAvatar.addEventListener('click', function (e) {
      var now = Date.now();
      if (now - lastClickTime < DBLCLICK_DELAY) {
        // 双击 → 拍一拍
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        lastClickTime = 0;
        openPatModal();
      } else {
        // 单击 → 不拦截，让 role-panel.js 处理（打开角色面板）
        lastClickTime = now;
      }
    }, true /* 捕获阶段，先于 role-panel.js 的监听 */);

    // ---------- 弹窗 DOM ----------
    var modal = document.createElement('div');
    modal.className = 'pat-modal';
    modal.id = 'patModal';
    modal.innerHTML =
      '<div class="pat-panel">' +
        '<div class="pat-header">' +
          '<span class="pat-title" id="patTitle">拍一拍 Ta</span>' +
          '<button class="pat-close" id="patClose" type="button"><i class="fa-solid fa-xmark"></i></button>' +
        '</div>' +
        '<div class="pat-body" id="patBody"></div>' +
        '<div class="pat-footer">' +
          '<button class="pat-btn pat-cancel" id="patCancel" type="button">取消</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);

    var patTitle  = modal.querySelector('#patTitle');
    var patBody   = modal.querySelector('#patBody');
    var patClose  = modal.querySelector('#patClose');
    var patCancel = modal.querySelector('#patCancel');

    // ---------- 打开 ----------
    function openPatModal() {
      var cards = (typeof window.getPatCards === 'function') ? window.getPatCards() : [];
      if (!Array.isArray(cards)) cards = [];

      patTitle.textContent = '拍一拍 ' + getContactName();

      if (cards.length === 0) {
        patBody.innerHTML =
          '<div class="pat-empty">' +
            '<i class="fa-solid fa-hand"></i>' +
            '<div>还没有拍一拍字卡</div>' +
            '<div class="pat-empty-hint">去字卡库 → 拍一拍 添加几句吧</div>' +
          '</div>';
      } else {
        var html = '';
        cards.forEach(function (text, idx) {
          html += '<div class="pat-item" data-idx="' + idx + '">' +
            '<i class="fa-solid fa-hand-point-right pat-item-icon"></i>' +
            '<span class="pat-item-text">' + escapeHtml(text) + '</span>' +
            '</div>';
        });
        patBody.innerHTML = html;

        patBody.querySelectorAll('.pat-item').forEach(function (el) {
          el.addEventListener('click', function () {
            var i = parseInt(el.getAttribute('data-idx'), 10);
            var picked = cards[i];
            if (picked) sendPat(picked);
            closePatModal();
          });
        });
      }

      modal.classList.add('active');
    }

    // ---------- 关闭 ----------
    function closePatModal() {
      modal.classList.remove('active');
    }

    patClose.addEventListener('click', closePatModal);
    patCancel.addEventListener('click', closePatModal);
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closePatModal();
    });

    // ---------- 发送 ----------
    function sendPat(text) {
      var contactName = getContactName();

      // 1) 居中系统提示气泡（复用 .system-call-event + .call-record-bubble）
      var sysRow = document.createElement('div');
      sysRow.className = 'message-row system-call-event';
      var sysBubble = document.createElement('div');
      sysBubble.className = 'call-record-bubble';
      sysBubble.innerHTML =
        '<i class="fa-solid fa-hand"></i>' +
        '<span>你拍了拍 ' + escapeHtml(contactName) + '：' + escapeHtml(text) + '</span>';
      sysRow.appendChild(sysBubble);
      chatMessages.appendChild(sysRow);
      scrollChatToBottom();

      // 2) 延迟 2~5 秒，从"回复"分类抽 1 条，以对方气泡发送
      var delay = 2000 + Math.floor(Math.random() * 3000);
      setTimeout(function () {
        var replies = (typeof window.getReplyCards === 'function') ? window.getReplyCards() : [];
        if (!Array.isArray(replies) || replies.length === 0) return;

        var replyText = randomPick(replies);
        if (!replyText) return;

        var row = document.createElement('div');
        row.className = 'message-row other';
        var bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        bubble.textContent = replyText;
        row.appendChild(bubble);
        chatMessages.appendChild(row);
        scrollChatToBottom();

        // 通知模块联动
        if (window.chatNotify && typeof window.chatNotify.show === 'function') {
          try { window.chatNotify.show(contactName, replyText); } catch (e) {}
        }
      }, delay);
    }

    function scrollChatToBottom() {
      requestAnimationFrame(function () {
        chatMessages.scrollTop = chatMessages.scrollHeight;
      });
    }

    // 供外部调用（仅当需要主动打开时用）
    window.openPatModal = openPatModal;
    window.closePatModal = closePatModal;
  }

  // ==================== 初始化 ====================
  function init() {
    initPatFeature();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
