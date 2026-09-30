/**
 * 模拟视频通话（独立模块）
 * - 呼叫/接听/挂断
 * - 概率：接通 30%，未接通 70%
 * - 对方主动来电：每 30 秒随机判断一次，30% 概率
 * - 通话记录自动写入聊天界面
 */

(function () {
  'use strict';

  var chatMessages = document.getElementById('chatMessages');
  if (!chatMessages) return;

  // ==================== 状态 ====================
  var callState = 'idle'; // 'idle' | 'calling' | 'connected' | 'ringing'
  var callTimer = null;
  var callSeconds = 0;
  var bannerTimer = null;
  var incomingTimer = null;

  // ==================== 工具 ====================
  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  function formatTime(sec) {
    var m = Math.floor(sec / 60).toString().padStart(2, '0');
    var s = (sec % 60).toString().padStart(2, '0');
    return m + ':' + s;
  }

  function getMyAvatar() {
    var avatarImg = document.getElementById('avatarImg');
    if (avatarImg && avatarImg.src) return avatarImg.src;
    if (window.homeSettings && window.homeSettings.current && window.homeSettings.current.avatar) {
      return window.homeSettings.current.avatar;
    }
    try {
      var raw = localStorage.getItem('home_custom_images');
      if (raw) {
        var data = JSON.parse(raw);
        if (data && data.avatar) return data.avatar;
      }
    } catch (e) {}
    return 'https://picsum.photos/100/100?random=1';
  }

  function getContactAvatar() {
    var chatAvatar = document.getElementById('chatAvatar');
    if (chatAvatar && chatAvatar.src) return chatAvatar.src;
    try {
      var contacts = JSON.parse(localStorage.getItem('my_contacts') || '[]');
      var currentId = localStorage.getItem('my_current_contact');
      if (Array.isArray(contacts)) {
        var cur = contacts.find(function (c) { return c.id === currentId; }) || contacts[0];
        if (cur && cur.avatar) return cur.avatar;
      }
    } catch (e) {}
    return 'https://picsum.photos/200/200?random=99';
  }

  function getContactName() {
    var chatName = document.getElementById('chatName');
    if (chatName && chatName.textContent) return chatName.textContent;
    return 'Ta';
  }

  // ==================== 滚动到底部 ====================
  function scrollToBottom() {
    requestAnimationFrame(function () {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    });
  }

  // ==================== 写入通话记录 ====================
  function addCallRecord(text) {
    var row = document.createElement('div');
    row.className = 'message-row other';

    var bubble = document.createElement('div');
    bubble.className = 'message-bubble call-record-bubble';
    bubble.innerHTML = '<i class="fa-solid fa-video"></i> ' + escapeHtml(text);

    row.appendChild(bubble);

    // 加对方头像
    var avatar = document.createElement('img');
    avatar.className = 'chat-msg-avatar';
    avatar.src = getContactAvatar();
    avatar.alt = '对方';
    avatar.onerror = function () {
      avatar.src = 'https://picsum.photos/200/200?random=99';
    };
    row.insertBefore(avatar, row.firstChild);

    chatMessages.appendChild(row);
    scrollToBottom();
  }

  // ==================== 呼叫弹窗 ====================
  function createCallModal() {
    if (document.getElementById('callModal')) return;

    var modal = document.createElement('div');
    modal.id = 'callModal';
    modal.className = 'call-modal';
    modal.innerHTML =
      '<div class="call-modal-inner">' +
      '  <div class="call-avatar-wrap">' +
      '    <img class="call-avatar" id="callAvatar" src="" alt="对方">' +
      '    <div class="call-avatar-pulse"></div>' +
      '  </div>' +
      '  <div class="call-name" id="callName">Ta</div>' +
      '  <div class="call-status" id="callStatus">正在等待对方接听...</div>' +
      '  <div class="call-timer" id="callTimer">00:00</div>' +
      '  <div class="call-actions">' +
      '    <button class="call-btn call-btn-cancel" id="callCancelBtn" title="取消">' +
      '      <i class="fa-solid fa-xmark"></i>' +
      '    </button>' +
      '    <button class="call-btn call-btn-hangup" id="callHangupBtn" title="挂断">' +
      '      <i class="fa-solid fa-phone-slash"></i>' +
      '    </button>' +
      '  </div>' +
      '</div>';

    document.body.appendChild(modal);

    document.getElementById('callCancelBtn').addEventListener('click', onCancelCall);
    document.getElementById('callHangupBtn').addEventListener('click', onHangupCall);

    // 点击遮罩不关闭（防止误触）
  }

  // ==================== 打开呼叫弹窗 ====================
  function openCallModal() {
    createCallModal();
    var modal = document.getElementById('callModal');
    modal.classList.add('active');

    // 设置头像和名字
    var avatarEl = document.getElementById('callAvatar');
    avatarEl.src = getContactAvatar();
    avatarEl.onerror = function () {
      avatarEl.src = 'https://picsum.photos/200/200?random=99';
    };
    document.getElementById('callName').textContent = getContactName();

    // 重置状态
    document.getElementById('callStatus').textContent = '正在等待对方接听...';
    document.getElementById('callTimer').textContent = '00:00';
    callSeconds = 0;
  }

  function closeCallModal() {
    var modal = document.getElementById('callModal');
    if (modal) modal.classList.remove('active');
    if (callTimer) {
      clearInterval(callTimer);
      callTimer = null;
    }
  }

  // ==================== 开始呼叫 ====================
  function startCall() {
    if (callState !== 'idle') return;
    callState = 'calling';
    openCallModal();

    // 开始计时（等待接听时的计时）
    callTimer = setInterval(function () {
      callSeconds++;
      var timerEl = document.getElementById('callTimer');
      if (timerEl) timerEl.textContent = formatTime(callSeconds);
    }, 1000);

    // 3 秒后随机判断是否接通
    setTimeout(function () {
      if (callState !== 'calling') return;

      var isConnected = Math.random() < 0.3; // 30% 接通

      if (isConnected) {
        callState = 'connected';
        var statusEl = document.getElementById('callStatus');
        if (statusEl) statusEl.textContent = '正在通话中...';
        // 计时器继续
      } else {
        // 未接通：保持等待，用户可手动挂断
        var statusEl2 = document.getElementById('callStatus');
        if (statusEl2) statusEl2.textContent = '对方暂时没有接听...';
      }
    }, 3000);
  }

  // ==================== 用户取消 ====================
  function onCancelCall() {
    if (callState === 'idle') {
      closeCallModal();
      return;
    }
    closeCallModal();
    addCallRecord('视频通话 · 已取消');
    callState = 'idle';
  }

  // ==================== 用户挂断 ====================
  function onHangupCall() {
    if (callState === 'calling') {
      // 未接通状态挂断
      closeCallModal();
      addCallRecord('视频通话 · 对方暂时没有接听');
      callState = 'idle';
    } else if (callState === 'connected') {
      // 已接通挂断
      var duration = formatTime(callSeconds);
      closeCallModal();
      addCallRecord('视频通话 · 已结束 · ' + duration);
      callState = 'idle';
    } else {
      closeCallModal();
      callState = 'idle';
    }
  }

  // ==================== 对方来电横幅 ====================
  function createIncomingBanner() {
    if (document.getElementById('incomingBanner')) return;

    var banner = document.createElement('div');
    banner.id = 'incomingBanner';
    banner.className = 'incoming-banner';
    banner.innerHTML =
      '<img class="incoming-avatar" id="incomingAvatar" src="" alt="对方">' +
      '<div class="incoming-info">' +
      '  <div class="incoming-name" id="incomingName">Ta</div>' +
      '  <div class="incoming-sub">邀请你视频通话...</div>' +
      '</div>' +
      '<div class="incoming-actions">' +
      '  <button class="incoming-btn incoming-accept" id="incomingAccept" title="接听">' +
      '    <i class="fa-solid fa-video"></i>' +
      '  </button>' +
      '  <button class="incoming-btn incoming-reject" id="incomingReject" title="挂断">' +
      '    <i class="fa-solid fa-phone-slash"></i>' +
      '  </button>' +
      '</div>';

    document.body.appendChild(banner);

    document.getElementById('incomingAccept').addEventListener('click', onAcceptIncoming);
    document.getElementById('incomingReject').addEventListener('click', onRejectIncoming);
  }

  function showIncomingBanner() {
    if (callState !== 'idle') return; // 正在通话中不弹
    createIncomingBanner();
    var banner = document.getElementById('incomingBanner');
    var avatarEl = document.getElementById('incomingAvatar');
    avatarEl.src = getContactAvatar();
    avatarEl.onerror = function () {
      avatarEl.src = 'https://picsum.photos/200/200?random=99';
    };
    document.getElementById('incomingName').textContent = getContactName();
    banner.classList.add('active');
    callState = 'ringing';

    // 10 秒自动挂断
    bannerTimer = setTimeout(function () {
      if (callState === 'ringing') {
        hideIncomingBanner();
        addCallRecord('视频通话 · 未接来电');
        callState = 'idle';
      }
    }, 10000);
  }

  function hideIncomingBanner() {
    var banner = document.getElementById('incomingBanner');
    if (banner) banner.classList.remove('active');
    if (bannerTimer) {
      clearTimeout(bannerTimer);
      bannerTimer = null;
    }
  }

  function onAcceptIncoming() {
    hideIncomingBanner();
    callState = 'idle';
    // 进入通话界面
    startCallAsReceiver();
  }

  function onRejectIncoming() {
    hideIncomingBanner();
    addCallRecord('视频通话 · 未接来电');
    callState = 'idle';
  }

  // ==================== 作为接收方进入通话 ====================
  function startCallAsReceiver() {
    callState = 'connected';
    openCallModal();
    document.getElementById('callStatus').textContent = '正在通话中...';
    callSeconds = 0;
    document.getElementById('callTimer').textContent = '00:00';
    if (callTimer) clearInterval(callTimer);
    callTimer = setInterval(function () {
      callSeconds++;
      var timerEl = document.getElementById('callTimer');
      if (timerEl) timerEl.textContent = formatTime(callSeconds);
    }, 1000);
  }

  // ==================== 后台随机来电判断 ====================
  function startIncomingChecker() {
    if (incomingTimer) clearInterval(incomingTimer);
    incomingTimer = setInterval(function () {
      if (callState !== 'idle') return;
      // 30% 概率来电
      if (Math.random() < 0.3) {
        showIncomingBanner();
      }
    }, 30000); // 每 30 秒判断一次
  }

  // ==================== 绑定视频通话图标 ====================
  function bindVideoIcon() {
    // 找到传讯页面的视频通话图标
    var videoIcon = document.querySelector('#pageChat .chat-action-icon[title="视频通话"]');
    if (!videoIcon) return;
    if (videoIcon.dataset.videoBound) return;
    videoIcon.dataset.videoBound = '1';

    videoIcon.addEventListener('click', function (e) {
      e.stopImmediatePropagation();
      e.preventDefault();
      startCall();
    }, true);
  }

  // ==================== 初始化 ====================
  function init() {
    bindVideoIcon();
    startIncomingChecker();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  setTimeout(init, 500);
  setTimeout(init, 1500);

  // 暴露给外部
  window.videoCall = {
    start: startCall,
    end: onHangupCall,
    cancel: onCancelCall
  };

})();
