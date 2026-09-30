/**
 * 模拟视频通话（独立模块）
 * - 呼叫概率：接通 30%，挂断 70%
 * - 主动来电：每 30 秒判断一次，30% 概率触发
 * - 聊天记录生成
 * - 完全独立，不影响任何现有逻辑
 */

(function () {
  'use strict';

  var chatMessages = document.getElementById('chatMessages');
  if (!chatMessages) return;

  // ==================== 状态 ====================
  var callState = {
    active: false,       // 是否在通话/等待中
    timer: null,         // 计时器
    seconds: 0,
    callType: 'outgoing', // 'outgoing' | 'incoming'
    modal: null,
    banner: null,
    incomingTimer: null  // 主动来电定时器
  };

  // ==================== 工具 ====================
  function formatTime(sec) {
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);
  }

  function getMyAvatar() {
    var avatarImg = document.getElementById('avatarImg');
    if (avatarImg && avatarImg.src) return avatarImg.src;
    return 'https://picsum.photos/100/100?random=1';
  }

  function getContactAvatar() {
    var chatAvatar = document.getElementById('chatAvatar');
    if (chatAvatar && chatAvatar.src) return chatAvatar.src;
    return 'https://picsum.photos/200/200?random=99';
  }

  function getContactName() {
    var chatName = document.getElementById('chatName');
    if (chatName && chatName.textContent) return chatName.textContent;
    return 'Ta';
  }

  // ==================== 添加聊天记录 ====================
  function addCallRecord(text) {
    var row = document.createElement('div');
    row.className = 'message-row call-record';

    var record = document.createElement('div');
    record.className = 'call-record-bubble';
    record.innerHTML = '<i class="fa-solid fa-video"></i> ' + text;

    row.appendChild(record);
    chatMessages.appendChild(row);

    // 滚动到底部
    requestAnimationFrame(function () {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    });
  }

  // ==================== 创建呼叫弹窗 ====================
  function createCallModal() {
    if (callState.modal) return callState.modal;

    var modal = document.createElement('div');
    modal.id = 'videoCallModal';
    modal.className = 'video-call-modal';
    modal.innerHTML =
      '<div class="video-call-panel">' +
      '  <div class="video-call-avatar-wrap">' +
      '    <img class="video-call-avatar" id="callAvatar" src="" alt="对方">' +
      '  </div>' +
      '  <div class="video-call-name" id="callName">Ta</div>' +
      '  <div class="video-call-status" id="callStatus">正在等待对方接听...</div>' +
      '  <div class="video-call-timer" id="callTimer">00:00</div>' +
      '  <div class="video-call-actions" id="callActions">' +
      '    <button class="video-call-btn video-call-cancel" id="callCancelBtn">' +
      '      <i class="fa-solid fa-xmark"></i><span>取消</span>' +
      '    </button>' +
      '    <button class="video-call-btn video-call-hangup" id="callHangupBtn">' +
      '      <i class="fa-solid fa-phone-slash"></i><span>挂断</span>' +
      '    </button>' +
      '  </div>' +
      '</div>';

    document.body.appendChild(modal);
    callState.modal = modal;

    document.getElementById('callCancelBtn').addEventListener('click', function () {
      onCancel();
    });
    document.getElementById('callHangupBtn').addEventListener('click', function () {
      onHangup();
    });

    return modal;
  }

  // ==================== 打开呼叫弹窗 ====================
  function openCallModal(callType) {
    var modal = createCallModal();
    var avatarEl = document.getElementById('callAvatar');
    var nameEl = document.getElementById('callName');
    var statusEl = document.getElementById('callStatus');
    var timerEl = document.getElementById('callTimer');

    avatarEl.src = getContactAvatar();
    nameEl.textContent = getContactName();
    statusEl.textContent = callType === 'incoming' ? '来电中...' : '正在等待对方接听...';
    timerEl.textContent = '00:00';

    // 重置按钮显示
    document.getElementById('callCancelBtn').style.display = callType === 'incoming' ? 'none' : 'flex';
    document.getElementById('callHangupBtn').querySelector('span').textContent = callType === 'incoming' ? '接听' : '挂断';

    modal.classList.add('active');
    callState.callType = callType;
  }

  function closeCallModal() {
    if (callState.modal) {
      callState.modal.classList.remove('active');
    }
  }

  // ==================== 开始计时 ====================
  function startTimer() {
    callState.seconds = 0;
    var timerEl = document.getElementById('callTimer');
    if (callState.timer) clearInterval(callState.timer);
    callState.timer = setInterval(function () {
      callState.seconds++;
      if (timerEl) timerEl.textContent = formatTime(callState.seconds);
    }, 1000);
  }

  function stopTimer() {
    if (callState.timer) {
      clearInterval(callState.timer);
      callState.timer = null;
    }
  }

  // ==================== 处理取消 ====================
  function onCancel() {
    stopTimer();
    closeCallModal();
    callState.active = false;
    addCallRecord('视频通话 · 已取消');
  }

  // ==================== 处理挂断 ====================
  function onHangup() {
    // 如果当前是来电状态，点击挂断 = 拒绝
    if (callState.callType === 'incoming' && document.getElementById('callHangupBtn').querySelector('span').textContent === '接听') {
      // 来电界面：点击挂断 = 拒接
      stopTimer();
      closeCallModal();
      callState.active = false;
      addCallRecord('视频通话 · 未接来电');
      return;
    }

    stopTimer();
    var wasConnected = document.getElementById('callStatus').textContent === '正在通话中';
    var duration = callState.seconds;
    closeCallModal();
    callState.active = false;

    if (wasConnected) {
      addCallRecord('视频通话 · 已结束 · ' + formatTime(duration));
    } else {
      addCallRecord('视频通话 · 对方暂时没有接听');
    }
  }

  // ==================== 发起呼叫 ====================
  function startCall() {
    if (callState.active) return;
    callState.active = true;
    callState.callType = 'outgoing';

    openCallModal('outgoing');
    startTimer();

    // 随机 1.5-3 秒后判断是否接通
    var waitTime = 1500 + Math.random() * 1500;
    setTimeout(function () {
      if (!callState.active) return; // 用户已取消

      // 30% 概率接通
      if (Math.random() < 0.30) {
        // 接通
        var statusEl = document.getElementById('callStatus');
        if (statusEl) statusEl.textContent = '正在通话中';
      }
      // 70% 概率不接通，保持原样"正在等待对方接听..."
    }, waitTime);
  }

  // ==================== 主动来电横幅 ====================
  function createIncomingBanner() {
    if (callState.banner) return callState.banner;

    var banner = document.createElement('div');
    banner.id = 'incomingBanner';
    banner.className = 'incoming-banner';
    banner.innerHTML =
      '<div class="incoming-banner-avatar-wrap">' +
      '  <img class="incoming-banner-avatar" id="bannerAvatar" src="" alt="对方">' +
      '</div>' +
      '<div class="incoming-banner-info">' +
      '  <div class="incoming-banner-name" id="bannerName">Ta</div>' +
      '  <div class="incoming-banner-text"><i class="fa-solid fa-video"></i> 来电</div>' +
      '</div>' +
      '<div class="incoming-banner-actions">' +
      '  <button class="incoming-banner-btn incoming-banner-accept" id="bannerAcceptBtn">' +
      '    <i class="fa-solid fa-phone"></i>' +
      '  </button>' +
      '  <button class="incoming-banner-btn incoming-banner-decline" id="bannerDeclineBtn">' +
      '    <i class="fa-solid fa-phone-slash"></i>' +
      '  </button>' +
      '</div>';

    document.body.appendChild(banner);
    callState.banner = banner;

    document.getElementById('bannerAcceptBtn').addEventListener('click', function () {
      hideIncomingBanner();
      // 进入通话
      callState.active = true;
      callState.callType = 'incoming';
      openCallModal('incoming');
      // 更新状态为通话中
      var statusEl = document.getElementById('callStatus');
      if (statusEl) statusEl.textContent = '正在通话中';
      startTimer();
      // 修改挂断按钮文案为"挂断"
      var hangupBtn = document.getElementById('callHangupBtn');
      if (hangupBtn) {
        hangupBtn.querySelector('span').textContent = '挂断';
      }
    });

    document.getElementById('bannerDeclineBtn').addEventListener('click', function () {
      hideIncomingBanner();
      addCallRecord('视频通话 · 未接来电');
    });

    return banner;
  }

  function showIncomingBanner() {
    var banner = createIncomingBanner();
    var avatarEl = document.getElementById('bannerAvatar');
    var nameEl = document.getElementById('bannerName');
    avatarEl.src = getContactAvatar();
    nameEl.textContent = getContactName();
    banner.classList.add('active');

    // 8 秒后自动消失（模拟对方挂断）
    var autoTimeout = setTimeout(function () {
      if (banner.classList.contains('active')) {
        hideIncomingBanner();
        addCallRecord('视频通话 · 未接来电');
      }
    }, 8000);

    // 保存 timeout id，hide 时清除
    banner.dataset.autoTimeout = autoTimeout;
  }

  function hideIncomingBanner() {
    var banner = callState.banner;
    if (!banner) return;
    banner.classList.remove('active');
    if (banner.dataset.autoTimeout) {
      clearTimeout(parseInt(banner.dataset.autoTimeout, 10));
      delete banner.dataset.autoTimeout;
    }
  }

  // ==================== 绑定视频通话图标 ====================
  function bindVideoCallIcon() {
    var icons = document.querySelectorAll('.chat-action-icon[title="视频通话"]');
    icons.forEach(function (icon) {
      if (icon.dataset.videoBound) return;
      icon.dataset.videoBound = '1';
      icon.addEventListener('click', function (e) {
        e.stopImmediatePropagation();
        e.preventDefault();
        startCall();
      }, true);
    });
  }

  // ==================== 主动来电定时器 ====================
  function startIncomingTimer() {
    if (callState.incomingTimer) clearInterval(callState.incomingTimer);
    callState.incomingTimer = setInterval(function () {
      // 如果当前正在通话中或已有横幅，不触发
      if (callState.active) return;
      if (callState.banner && callState.banner.classList.contains('active')) return;

      // 30% 概率触发来电
      if (Math.random() < 0.30) {
        showIncomingBanner();
      }
    }, 30000); // 每 30 秒判断一次

    // 首次延迟 15 秒后开始判断（避免一进入页面就弹）
    setTimeout(function () {
      if (!callState.active) {
        if (Math.random() < 0.30) {
          showIncomingBanner();
        }
      }
    }, 15000);
  }

  // ==================== 初始化 ====================
  function init() {
    bindVideoCallIcon();
    startIncomingTimer();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  setTimeout(bindVideoCallIcon, 500);
  setTimeout(bindVideoCallIcon, 1500);

  // 暴露给外部
  window.videoCall = {
    start: startCall,
    showIncoming: showIncomingBanner
  };

})();
