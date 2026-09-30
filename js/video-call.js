/**
 * 模拟视频通话（独立模块）
 * - 呼叫概率：接通 30%，挂断 70%
 * - 主动来电：每 30 秒判断一次，30% 概率触发
 * - 接通后生成"悬浮挂断条"，支持全局悬浮
 * - 聊天记录生成"系统提示条"（居中、无头像）
 * - 完全独立，不影响任何现有逻辑
 */

(function () {
  'use strict';

  var chatMessages = document.getElementById('chatMessages');
  if (!chatMessages) return;

  // ==================== 状态 ====================
  var callState = {
    active: false,          // 是否在通话/等待中
    connected: false,       // 是否已接通
    timer: null,            // 计时器
    seconds: 0,
    callType: 'outgoing',   // 'outgoing' | 'incoming'
    modal: null,            // 呼叫弹窗
    banner: null,           // 来电横幅
    floatBar: null,         // 悬浮挂断条
    incomingTimer: null,    // 主动来电定时器
    replyTimeout: null      // 等待接通超时
  };

  // ==================== 工具 ====================
  function formatTime(sec) {
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = sec % 60;
    if (h > 0) {
      return h + ':' + (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);
    }
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

  // ==================== 添加通话记录（系统提示条） ====================
  function addCallRecord(text) {
    var row = document.createElement('div');
    row.className = 'message-row call-record';

    var record = document.createElement('div');
    record.className = 'call-record-bubble';
    record.innerHTML = '<i class="fa-solid fa-video"></i> ' + text;

    row.appendChild(record);
    chatMessages.appendChild(row);

    requestAnimationFrame(function () {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    });
  }

  // ==================== 呼叫弹窗 ====================
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

    document.getElementById('callCancelBtn').addEventListener('click', onCancel);
    document.getElementById('callHangupBtn').addEventListener('click', onHangup);
    return modal;
  }

  function openCallModal(callType) {
    var modal = createCallModal();
    document.getElementById('callAvatar').src = getContactAvatar();
    document.getElementById('callName').textContent = getContactName();
    document.getElementById('callStatus').textContent = callType === 'incoming' ? '来电中...' : '正在等待对方接听...';
    document.getElementById('callTimer').textContent = '00:00';

    document.getElementById('callCancelBtn').style.display = callType === 'incoming' ? 'none' : 'flex';
    document.getElementById('callHangupBtn').querySelector('span').textContent = '挂断';

    modal.classList.add('active');
    callState.callType = callType;
  }

  function closeCallModal() {
    if (callState.modal) callState.modal.classList.remove('active');
  }

  // ==================== 悬浮挂断条 ====================
  function createFloatBar() {
    if (callState.floatBar) return callState.floatBar;

    var bar = document.createElement('div');
    bar.id = 'videoCallFloatBar';
    bar.className = 'video-call-float-bar';
    bar.innerHTML =
      '<img class="float-bar-avatar" id="floatBarAvatar" src="" alt="对方">' +
      '<div class="float-bar-info">' +
      '  <div class="float-bar-name" id="floatBarName">Ta</div>' +
      '  <div class="float-bar-timer" id="floatBarTimer">00:00</div>' +
      '</div>' +
      '<button class="float-bar-hangup" id="floatBarHangupBtn" title="挂断">' +
      '  <i class="fa-solid fa-phone-slash"></i>' +
      '</button>';

    document.body.appendChild(bar);
    callState.floatBar = bar;

    document.getElementById('floatBarHangupBtn').addEventListener('click', function () {
      endCallAndRecord();
    });

    return bar;
  }

  function showFloatBar() {
    var bar = createFloatBar();
    document.getElementById('floatBarAvatar').src = getContactAvatar();
    document.getElementById('floatBarName').textContent = getContactName();
    document.getElementById('floatBarTimer').textContent = formatTime(callState.seconds);
    bar.classList.add('active');
  }

  function hideFloatBar() {
    if (callState.floatBar) callState.floatBar.classList.remove('active');
  }

  // ==================== 计时器 ====================
  function startTimer() {
    callState.seconds = 0;
    var timerEl = document.getElementById('callTimer');
    var floatTimerEl = document.getElementById('floatBarTimer');
    if (callState.timer) clearInterval(callState.timer);
    callState.timer = setInterval(function () {
      callState.seconds++;
      var t = formatTime(callState.seconds);
      if (timerEl) timerEl.textContent = t;
      if (floatTimerEl) floatTimerEl.textContent = t;
    }, 1000);
  }

  function stopTimer() {
    if (callState.timer) {
      clearInterval(callState.timer);
      callState.timer = null;
    }
  }

  // ==================== 接通处理 ====================
  function onConnected() {
    callState.connected = true;

    // 关闭呼叫弹窗
    closeCallModal();

    // 显示悬浮挂断条
    showFloatBar();

    // 启动计时器
    startTimer();
  }

  // ==================== 结束通话并记录 ====================
  function endCallAndRecord() {
    stopTimer();
    hideFloatBar();
    closeCallModal();

    var wasConnected = callState.connected;
    var duration = callState.seconds;

    callState.active = false;
    callState.connected = false;

    if (wasConnected) {
      addCallRecord('视频通话 · 已结束 · ' + formatTime(duration));
    } else {
      addCallRecord('视频通话 · 对方暂时没有接听');
    }

    callState.seconds = 0;
  }

  // ==================== 处理取消 ====================
  function onCancel() {
    stopTimer();
    hideFloatBar();
    closeCallModal();
    callState.active = false;
    callState.connected = false;
    callState.seconds = 0;
    addCallRecord('视频通话 · 已取消');
  }

  // ==================== 处理挂断 ====================
  function onHangup() {
    // 来电界面：直接拒接
    if (callState.callType === 'incoming' && !callState.connected) {
      stopTimer();
      hideFloatBar();
      closeCallModal();
      callState.active = false;
      callState.seconds = 0;
      addCallRecord('视频通话 · 未接来电');
      return;
    }

    endCallAndRecord();
  }

  // ==================== 发起呼叫 ====================
  function startCall() {
    if (callState.active) return;
    callState.active = true;
    callState.connected = false;
    callState.callType = 'outgoing';
    callState.seconds = 0;

    openCallModal('outgoing');
    // 弹窗内先显示等待计时
    if (callState.timer) clearInterval(callState.timer);
    var timerEl = document.getElementById('callTimer');
    callState.timer = setInterval(function () {
      callState.seconds++;
      if (timerEl) timerEl.textContent = formatTime(callState.seconds);
    }, 1000);

    // 1.5-3 秒后判断是否接通
    var waitTime = 1500 + Math.random() * 1500;
    callState.replyTimeout = setTimeout(function () {
      if (!callState.active) return;
      if (Math.random() < 0.30) {
        // 接通：关闭弹窗，显示悬浮条，重置计时
        stopTimer();
        callState.seconds = 0;
        onConnected();
      }
      // 未接通：保持弹窗等待
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
      callState.active = true;
      callState.connected = true;
      callState.callType = 'incoming';
      callState.seconds = 0;
      showFloatBar();
      startTimer();
    });

    document.getElementById('bannerDeclineBtn').addEventListener('click', function () {
      hideIncomingBanner();
      addCallRecord('视频通话 · 未接来电');
    });

    return banner;
  }

  function showIncomingBanner() {
    var banner = createIncomingBanner();
    document.getElementById('bannerAvatar').src = getContactAvatar();
    document.getElementById('bannerName').textContent = getContactName();
    banner.classList.add('active');

    var autoTimeout = setTimeout(function () {
      if (banner.classList.contains('active')) {
        hideIncomingBanner();
        addCallRecord('视频通话 · 未接来电');
      }
    }, 8000);

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
      if (callState.active) return;
      if (callState.banner && callState.banner.classList.contains('active')) return;
      if (Math.random() < 0.30) {
        showIncomingBanner();
      }
    }, 30000);

    setTimeout(function () {
      if (!callState.active && !(callState.banner && callState.banner.classList.contains('active'))) {
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
