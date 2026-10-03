/* ============================================================
   chat-extras.js —— 传讯页扩展功能
   包含：
     - 拍一拍（双击头像 → 从字卡库"拍一拍"分类选一条发送）
     - 图片 / 表情包面板（原有）
     - 连发模式（原有，若你的版本有）
   依赖：
     - window.getPatCards / window.getReplyCards（card.js）
     - #chatAvatar / #chatMessages（传讯页 DOM）
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

 /* ============================================================
   1. 拍一拍（长按头像 500ms 触发）
   ============================================================ */
var PAT_LONG_PRESS_MS = 500;
var PAT_MOVE_TOLERANCE = 10;   // 手指移动超过 10px 视为滑动，取消长按

function initPatFeature() {
  var chatAvatar = document.getElementById('chatAvatar');
  var chatMessages = document.getElementById('chatMessages');
  if (!chatAvatar || !chatMessages) return;

  // ---------- 长按检测 ----------
  var pressTimer = null;
  var startX = 0, startY = 0;
  var longPressFired = false;

  function startPress(x, y) {
    startX = x; startY = y;
    longPressFired = false;
    pressTimer = setTimeout(function () {
      pressTimer = null;
      longPressFired = true;
      openPatModal();
    }, PAT_LONG_PRESS_MS);
  }

  function cancelPress() {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
  }

  // 触摸
  chatAvatar.addEventListener('touchstart', function (e) {
    var t = e.touches && e.touches[0];
    if (!t) return;
    startPress(t.clientX, t.clientY);
  }, { passive: true });

  chatAvatar.addEventListener('touchmove', function (e) {
    var t = e.touches && e.touches[0];
    if (!t) return;
    if (Math.abs(t.clientX - startX) > PAT_MOVE_TOLERANCE ||
        Math.abs(t.clientY - startY) > PAT_MOVE_TOLERANCE) {
      cancelPress();
    }
  }, { passive: true });

  chatAvatar.addEventListener('touchend', function (e) {
    cancelPress();
    if (longPressFired) {
      // 阻止浏览器补发的 click（否则 role-panel.js 会打开角色面板）
      e.preventDefault();
    }
  });

  chatAvatar.addEventListener('touchcancel', function () {
    cancelPress();
  });

  // 鼠标（桌面端）
  chatAvatar.addEventListener('mousedown', function (e) {
    if (e.button !== 0) return;
    startPress(e.clientX, e.clientY);
  });
  chatAvatar.addEventListener('mousemove', function (e) {
    if (!pressTimer) return;
    if (Math.abs(e.clientX - startX) > PAT_MOVE_TOLERANCE ||
        Math.abs(e.clientY - startY) > PAT_MOVE_TOLERANCE) {
      cancelPress();
    }
  });
  chatAvatar.addEventListener('mouseup', function (e) {
    var wasLongPress = longPressFired;
    cancelPress();
    if (wasLongPress) {
      e.preventDefault();
      e.stopPropagation();
    }
  });
  chatAvatar.addEventListener('mouseleave', function () {
    cancelPress();
  });

  // ★ 关键：在捕获阶段拦截长按后的 click，阻止 role-panel.js 打开角色面板
  chatAvatar.addEventListener('click', function (e) {
    if (longPressFired) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      longPressFired = false;
    }
  }, true);

  // ---------- 弹窗 DOM ----------
  var modal = document.createElement('div');
  modal.className = 'pat-modal';
  modal.id = 'patModal';
  modal.innerHTML =
    '<div class="pat-panel">' +
      '<div class="pat-header">' +
        '<span class="pat-title" id="patTitle">拍一拍 Ta</span>' +
        '<button class="pat-close" id="patClose"><i class="fa-solid fa-xmark"></i></button>' +
      '</div>' +
      '<div class="pat-body" id="patBody"></div>' +
      '<div class="pat-footer">' +
        '<button class="pat-btn pat-cancel" id="patCancel">取消</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(modal);

  var patTitle = modal.querySelector('#patTitle');
  var patBody = modal.querySelector('#patBody');
  var patClose = modal.querySelector('#patClose');
  var patCancel = modal.querySelector('#patCancel');

  function getContactName() {
    var nameEl = document.getElementById('chatName');
    if (nameEl && nameEl.textContent.trim()) return nameEl.textContent.trim();
    return 'Ta';
  }

  function openPatModal() {
    var cards = (typeof window.getPatCards === 'function') ? window.getPatCards() : [];

    patTitle.textContent = '拍一拍 ' + getContactName();

    if (!cards || cards.length === 0) {
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

  function closePatModal() {
    modal.classList.remove('active');
  }

  patClose.addEventListener('click', closePatModal);
  patCancel.addEventListener('click', closePatModal);
  modal.addEventListener('click', function (e) {
    if (e.target === modal) closePatModal();
  });

  function sendPat(text) {
    var contactName = getContactName();

    // 1. 系统提示气泡
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

    // 2. 延迟 2~5 秒回复
    var delay = 2000 + Math.floor(Math.random() * 3000);
    setTimeout(function () {
      var replies = (typeof window.getReplyCards === 'function') ? window.getReplyCards() : [];
      if (!replies || replies.length === 0) return;
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
}

  // ==================== 2. 连发模式（保留原有逻辑，若没有就忽略） ====================
  // 说明：如果你现有的 chat-extras.js 里已有连发相关代码，
  // 请把这部分保留在文件里，不要被我这份覆盖。
  // 这里只展示拍一拍逻辑，其它部分请根据你本地的原文件保留。

  // ==================== 初始化 ====================
  function init() {
    initPatFeature();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 暴露给外部
  window.openPatModal = function () {
    var modal = document.getElementById('patModal');
    if (modal) modal.classList.add('active');
  };

})();
