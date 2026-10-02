/**
 * 模拟视频通话（独立模块）
 * - 独立封装：CSS 动态注入，DOM 动态挂载
 * - 通话窗口：可拖拽移动 + 右下角拉伸调整大小，默认 280x440
 * - 来电悬浮卡片：#call-incoming-overlay（全屏遮罩 + 毛玻璃 + 脉冲光圈）
 * - 最小化胶囊：#call-mini-pill（可拖拽、显示计时器）
 * - 聊天记录：window._addCallEvent(icon, label, detail)
 * - 概率：主动呼叫 35% 拒绝 / 65% 接通；来电 25% 触发；来电 30% 自动拒绝
 * - 完全独立，不影响任何现有逻辑
 */

(function () {
  'use strict';

  if (window.__videoCallFeatureLoaded) return;
  window.__videoCallFeatureLoaded = true;

  // ==================== 常量 ====================
  var DEFAULT_W = 280;
  var DEFAULT_H = 440;
  var MIN_W = 220;
  var MIN_H = 340;
  var RANDOM_CALL_MIN_MS = 15 * 60 * 1000;   // 15 分钟
  var RANDOM_CALL_MAX_MS = 60 * 60 * 1000;   // 60 分钟
  var RANDOM_CALL_PROBABILITY = 0.25;        // 触发概率
  var OUTGOING_REJECT_PROBABILITY = 0.35;    // 主动呼叫被拒概率
  var OUTGOING_REJECT_DELAY_MIN = 4000;      // 4s
  var OUTGOING_REJECT_DELAY_MAX = 12000;     // 12s
  var OUTGOING_CONNECT_DELAY_MIN = 1400;     // 1.4s
  var OUTGOING_CONNECT_DELAY_MAX = 2800;     // 2.8s
  var INCOMING_AUTO_REJECT_PROBABILITY = 0.30; // 来电 30% 自动拒绝
  var INCOMING_AUTO_REJECT_MIN = 4000;       // 4s
  var INCOMING_AUTO_REJECT_MAX = 6000;       // 6s
  var INCOMING_AUTO_MISS_DELAY = 22000;      // 22s 自动未接

  // ==================== 状态 ====================
  var state = {
    active: false,        // 是否有通话进行中
    connected: false,     // 是否已接通
    minimized: false,     // 是否已最小化为胶囊
    seconds: 0,           // 通话计时
    timerId: null,        // 计时器
    mode: 'outgoing',     // 'outgoing' | 'incoming'
    randomCallTimer: null,// 随机来电定时器
    pendingTimeoutIds: [],// 待清理的 timeout
    incomingAutoReject: null,
    incomingAutoMiss: null,
    // 窗口位置/尺寸
    win: { x: null, y: null, w: DEFAULT_W, h: DEFAULT_H },
    // 拖拽状态
    drag: null,
    // 拉伸状态
    resize: null
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

  function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function getContactAvatar() {
    var chatAvatar = document.getElementById('chatAvatar');
    if (chatAvatar && chatAvatar.src) return chatAvatar.src;
    try {
      var contacts = JSON.parse(localStorage.getItem('my_contacts') || '[]');
      var cid = localStorage.getItem('my_current_contact');
      var cur = contacts.find(function (c) { return c.id === cid; }) || contacts[0];
      if (cur && cur.avatar) return cur.avatar;
    } catch (e) {}
    return 'https://picsum.photos/200/200?random=99';
  }

  function getContactName() {
    var chatName = document.getElementById('chatName');
    if (chatName && chatName.textContent) return chatName.textContent;
    return 'Ta';
  }

  // ==================== 向聊天窗口添加通话记录 ====================
   function _addCallEvent(icon, label, detail) {
    if (typeof window._addCallEvent === 'function' && window._addCallEvent !== _addCallEvent) {
      try { window._addCallEvent(icon, label, detail); return; } catch (e) {}
    }

    var chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;

    // 系统消息行：只包含一个居中的提示条，无任何头像
    var row = document.createElement('div');
    row.className = 'message-row call-record system-call-event';

    var bubble = document.createElement('div');
    bubble.className = 'call-record-bubble';

    var iconHtml = icon ? '<i class="' + icon + '"></i> ' : '';
    var text = [label, detail].filter(function (x) { return x; }).join(' · ');
    bubble.innerHTML = iconHtml + text;

    row.appendChild(bubble);
    chatMessages.appendChild(row);

    // 兜底：移除可能被其他脚本添加的头像
    setTimeout(function () {
      var avatars = row.querySelectorAll('.chat-msg-avatar');
      avatars.forEach(function (a) { a.remove(); });
    }, 50);

    requestAnimationFrame(function () {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    });
  }
  window._addCallEvent = _addCallEvent;

  // ==================== 注入 CSS ====================
  function injectCSS() {
    if (document.getElementById('video-call-styles')) return;

    var css = [
      /* ============ 通话窗口 ============ */
      '.vc-window {',
      '  position: fixed;',
      '  z-index: 650;',
      '  width: ' + DEFAULT_W + 'px;',
      '  height: ' + DEFAULT_H + 'px;',
      '  background: linear-gradient(160deg, #1a2430 0%, #0f1620 100%);',
      '  border-radius: 24px;',
      '  box-shadow: 0 20px 60px rgba(0, 20, 30, 0.45);',
      '  overflow: hidden;',
      '  user-select: none;',
      '  display: flex;',
      '  flex-direction: column;',
      '  touch-action: none;',
      '  opacity: 0;',
      '  transform: scale(0.92);',
      '  transition: opacity 0.22s ease, transform 0.22s ease;',
      '  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;',
      '}',
      '.vc-window.vc-show { opacity: 1; transform: scale(1); }',
      '.vc-window.vc-hidden { display: none !important; }',

      /* 顶部拖拽条 */
      '.vc-drag-bar {',
      '  flex-shrink: 0;',
      '  height: 36px;',
      '  cursor: move;',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: space-between;',
      '  padding: 0 14px;',
      '  color: rgba(255,255,255,0.85);',
      '  font-size: 12px;',
      '  font-weight: 600;',
      '  background: rgba(255,255,255,0.04);',
      '  border-bottom: 1px solid rgba(255,255,255,0.06);',
      '}',
      '.vc-drag-bar-title {',
      '  display: flex; align-items: center; gap: 6px;',
      '  letter-spacing: 0.5px;',
      '}',
      '.vc-drag-bar-actions {',
      '  display: flex; align-items: center; gap: 8px;',
      '}',
      '.vc-icon-btn {',
      '  width: 22px; height: 22px;',
      '  border-radius: 9999px;',
      '  background: rgba(255,255,255,0.1);',
      '  color: rgba(255,255,255,0.85);',
      '  border: none;',
      '  display: flex; align-items: center; justify-content: center;',
      '  font-size: 11px;',
      '  cursor: pointer;',
      '  transition: background 0.15s ease;',
      '}',
      '.vc-icon-btn:hover { background: rgba(255,255,255,0.2); }',
      '.vc-icon-btn:active { transform: scale(0.92); }',

      /* 视频区 */
      '.vc-video-area {',
      '  flex: 1;',
      '  position: relative;',
      '  overflow: hidden;',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '}',
      '.vc-remote-avatar-wrap {',
      '  position: absolute;',
      '  inset: 0;',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  z-index: 1;',
      '}',
      '.vc-remote-avatar {',
      '  width: 140px; height: 140px;',
      '  border-radius: 9999px;',
      '  object-fit: cover;',
      '  border: 3px solid rgba(255,255,255,0.2);',
      '  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);',
      '}',
      '.vc-connecting-overlay {',
      '  position: absolute;',
      '  inset: 0;',
      '  display: flex;',
      '  flex-direction: column;',
      '  align-items: center;',
      '  justify-content: center;',
      '  gap: 16px;',
      '  color: #fff;',
      '  z-index: 2;',
      '  background: rgba(0,0,0,0.35);',
      '  backdrop-filter: blur(8px);',
      '  -webkit-backdrop-filter: blur(8px);',
      '}',
      '.vc-connecting-spinner {',
      '  width: 44px; height: 44px;',
      '  border-radius: 9999px;',
      '  border: 3px solid rgba(255,255,255,0.2);',
      '  border-top-color: #6fb1e8;',
      '  animation: vc-spin 0.9s linear infinite;',
      '}',
      '@keyframes vc-spin { to { transform: rotate(360deg); } }',
      '.vc-connecting-text {',
      '  font-size: 13px;',
      '  color: rgba(255,255,255,0.85);',
      '  letter-spacing: 0.5px;',
      '}',
      '.vc-connected-overlay {',
      '  position: absolute;',
      '  inset: 0;',
      '  display: none;',
      '  flex-direction: column;',
      '  align-items: center;',
      '  justify-content: center;',
      '  gap: 8px;',
      '  color: #fff;',
      '  z-index: 2;',
      '  background: rgba(0,0,0,0.2);',
      '  backdrop-filter: blur(4px);',
      '  -webkit-backdrop-filter: blur(4px);',
      '}',
      '.vc-connected-overlay.vc-show { display: flex; }',
      '.vc-connected-timer {',
      '  font-size: 26px;',
      '  font-weight: 700;',
      '  font-variant-numeric: tabular-nums;',
      '  letter-spacing: 1px;',
      '  color: #8fd1a3;',
      '}',
      '.vc-connected-label {',
      '  font-size: 11px;',
      '  color: rgba(255,255,255,0.7);',
      '  letter-spacing: 2px;',
      '  text-transform: uppercase;',
      '}',
      /* 本地小窗 */
      '.vc-local-avatar {',
      '  position: absolute;',
      '  right: 10px; bottom: 10px;',
      '  width: 72px; height: 100px;',
      '  border-radius: 12px;',
      '  object-fit: cover;',
      '  border: 2px solid rgba(255,255,255,0.3);',
      '  box-shadow: 0 6px 20px rgba(0,0,0,0.4);',
      '  z-index: 3;',
      '}',

      /* 底部操作栏 */
      '.vc-action-bar {',
      '  flex-shrink: 0;',
      '  height: 74px;',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  gap: 26px;',
      '  background: rgba(255,255,255,0.05);',
      '  border-top: 1px solid rgba(255,255,255,0.08);',
      '}',
      '.vc-action-btn {',
      '  width: 46px; height: 46px;',
      '  border-radius: 9999px;',
      '  border: none;',
      '  display: flex; align-items: center; justify-content: center;',
      '  font-size: 18px;',
      '  color: #fff;',
      '  cursor: pointer;',
      '  transition: transform 0.12s ease, background 0.15s ease;',
      '}',
      '.vc-action-btn:active { transform: scale(0.9); }',
      '.vc-btn-hangup { background: #f05a5a; box-shadow: 0 4px 14px rgba(240, 90, 90, 0.5); }',
      '.vc-btn-hangup:hover { background: #d94a4a; }',
      '.vc-btn-mute { background: rgba(255,255,255,0.15); }',
      '.vc-btn-mute:hover { background: rgba(255,255,255,0.25); }',
      '.vc-btn-minimize { background: rgba(255,255,255,0.15); }',
      '.vc-btn-minimize:hover { background: rgba(255,255,255,0.25); }',

      /* 右下角拉伸把手 */
      '.vc-resize-handle {',
      '  position: absolute;',
      '  right: 0; bottom: 0;',
      '  width: 20px; height: 20px;',
      '  cursor: nwse-resize;',
      '  z-index: 5;',
      '}',
      '.vc-resize-handle::before {',
      '  content: "";',
      '  position: absolute;',
      '  right: 4px; bottom: 4px;',
      '  width: 10px; height: 10px;',
      '  border-right: 2px solid rgba(255,255,255,0.4);',
      '  border-bottom: 2px solid rgba(255,255,255,0.4);',
      '  border-radius: 0 0 3px 0;',
      '}',

      /* ============ 来电悬浮卡片 ============ */
      '#call-incoming-overlay {',
      '  position: fixed;',
      '  inset: 0;',
      '  z-index: 900;',
      '  display: none;',
      '  align-items: center;',
      '  justify-content: center;',
      '  padding: 20px;',
      '  background: rgba(15, 22, 30, 0.55);',
      '  backdrop-filter: blur(14px);',
      '  -webkit-backdrop-filter: blur(14px);',
      '  opacity: 0;',
      '  transition: opacity 0.25s ease;',
      '  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;',
      '}',
      '#call-incoming-overlay.vc-show { display: flex; opacity: 1; }',

      '.vc-incoming-card {',
      '  width: 100%;',
      '  max-width: 320px;',
      '  background: rgba(255, 255, 255, 0.96);',
      '  backdrop-filter: blur(20px);',
      '  -webkit-backdrop-filter: blur(20px);',
      '  border-radius: 28px;',
      '  border: 1px solid rgba(255,255,255,0.9);',
      '  box-shadow: 0 20px 60px rgba(0, 20, 30, 0.35);',
      '  padding: 28px 22px 22px 22px;',
      '  text-align: center;',
      '  animation: vc-pop-in 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);',
      '}',
      '@keyframes vc-pop-in {',
      '  from { opacity: 0; transform: scale(0.9); }',
      '  to { opacity: 1; transform: scale(1); }',
      '}',

      '.vc-incoming-avatar-wrap {',
      '  position: relative;',
      '  width: 96px; height: 96px;',
      '  margin: 0 auto 16px auto;',
      '  display: flex; align-items: center; justify-content: center;',
      '}',
      '.vc-incoming-avatar {',
      '  width: 96px; height: 96px;',
      '  border-radius: 9999px;',
      '  object-fit: cover;',
      '  border: 3px solid #ffffff;',
      '  box-shadow: 0 8px 24px rgba(150, 180, 210, 0.35);',
      '  position: relative; z-index: 2;',
      '}',
      '.vc-pulse-ring {',
      '  position: absolute;',
      '  inset: 0;',
      '  border-radius: 9999px;',
      '  border: 2px solid rgba(111, 177, 232, 0.6);',
      '  animation: vc-pulse 1.8s ease-out infinite;',
      '  z-index: 1;',
      '}',
      '.vc-pulse-ring.vc-pulse-2 { animation-delay: 0.6s; }',
      '.vc-pulse-ring.vc-pulse-3 { animation-delay: 1.2s; }',
      '@keyframes vc-pulse {',
      '  0% { transform: scale(1); opacity: 0.8; }',
      '  100% { transform: scale(1.7); opacity: 0; }',
      '}',

      '.vc-incoming-name {',
      '  font-size: 18px;',
      '  font-weight: 700;',
      '  color: #333;',
      '  margin-bottom: 4px;',
      '}',
      '.vc-incoming-text {',
      '  font-size: 12px;',
      '  color: #8899a6;',
      '  margin-bottom: 22px;',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  gap: 5px;',
      '}',
      '.vc-incoming-text i { color: #6fb1e8; }',
      '.vc-incoming-actions {',
      '  display: flex;',
      '  gap: 16px;',
      '  justify-content: center;',
      '}',
      '.vc-incoming-btn {',
      '  flex: 1;',
      '  max-width: 120px;',
      '  padding: 12px 0;',
      '  border-radius: 16px;',
      '  border: none;',
      '  display: flex;',
      '  flex-direction: column;',
      '  align-items: center;',
      '  gap: 4px;',
      '  font-size: 12px;',
      '  font-weight: 600;',
      '  cursor: pointer;',
      '  transition: transform 0.12s ease, opacity 0.15s ease;',
      '}',
      '.vc-incoming-btn:active { transform: scale(0.95); }',
      '.vc-incoming-btn i { font-size: 18px; }',
      '.vc-btn-accept {',
      '  background: #6fb1e8;',
      '  color: #fff;',
      '  box-shadow: 0 4px 14px rgba(111, 177, 232, 0.5);',
      '}',
      '.vc-btn-decline {',
      '  background: #f8b4b4;',
      '  color: #fff;',
      '  box-shadow: 0 4px 14px rgba(248, 180, 180, 0.5);',
      '}',

      /* ============ 最小化胶囊 ============ */
      '#call-mini-pill {',
      '  position: fixed;',
      '  z-index: 700;',
      '  display: none;',
      '  align-items: center;',
      '  gap: 8px;',
      '  padding: 8px 10px 8px 8px;',
      '  background: rgba(30, 30, 30, 0.88);',
      '  backdrop-filter: blur(16px);',
      '  -webkit-backdrop-filter: blur(16px);',
      '  border-radius: 9999px;',
      '  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);',
      '  color: #fff;',
      '  cursor: grab;',
      '  user-select: none;',
      '  touch-action: none;',
      '  transition: transform 0.12s ease;',
      '  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif;',
      '}',
      '#call-mini-pill.vc-show { display: flex; }',
      '#call-mini-pill:active { cursor: grabbing; }',
      '#call-mini-pill.vc-dragging { transform: scale(1.04); }',
      '.vc-mini-avatar {',
      '  width: 32px; height: 32px;',
      '  border-radius: 9999px;',
      '  object-fit: cover;',
      '  border: 1.5px solid rgba(255,255,255,0.3);',
      '}',
      '.vc-mini-info {',
      '  display: flex;',
      '  flex-direction: column;',
      '  gap: 1px;',
      '  min-width: 0;',
      '}',
      '.vc-mini-name {',
      '  font-size: 11px;',
      '  color: rgba(255,255,255,0.75);',
      '  font-weight: 500;',
      '  max-width: 80px;',
      '  overflow: hidden;',
      '  text-overflow: ellipsis;',
      '  white-space: nowrap;',
      '}',
      '.vc-mini-timer {',
      '  font-size: 12px;',
      '  font-weight: 700;',
      '  color: #8fd1a3;',
      '  font-variant-numeric: tabular-nums;',
      '  letter-spacing: 0.5px;',
      '}',
      '.vc-mini-hangup {',
      '  width: 30px; height: 30px;',
      '  border-radius: 9999px;',
      '  background: #f05a5a;',
      '  color: #fff;',
      '  border: none;',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  font-size: 12px;',
      '  cursor: pointer;',
      '  flex-shrink: 0;',
      '  box-shadow: 0 2px 8px rgba(240, 90, 90, 0.5);',
      '}',
      '.vc-mini-hangup:active { transform: scale(0.9); }',

      /* 通话记录气泡 */
      '.message-row.call-record {',
      '  justify-content: center !important;',
      '  display: flex;',
      '  margin-bottom: 12px;',
      '}',
      '.call-record-bubble {',
      '  display: inline-flex;',
      '  align-items: center;',
      '  gap: 5px;',
      '  padding: 6px 14px;',
      '  background: #f0f3f6;',
      '  border-radius: 14px;',
      '  font-size: 11px;',
      '  color: #8899a6;',
      '  font-weight: 500;',
      '  max-width: 80%;',
      '  text-align: center;',
      '  line-height: 1.4;',
      '}',
      '.call-record-bubble i {',
      '  color: #f8b4b4;',
      '  font-size: 11px;',
      '  flex-shrink: 0;',
      '}',
      'body.theme-dark .call-record-bubble {',
      '  background: #2a3038;',
      '  color: var(--theme-text-muted, #b8c2cc);',
      '}',
      '.message-row.call-record .chat-msg-avatar { display: none !important; }'
    ].join('\n');

    var style = document.createElement('style');
    style.id = 'video-call-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ==================== 创建通话窗口 ====================
  function createCallWindow() {
    if (document.getElementById('vc-window')) return;

    var win = document.createElement('div');
    win.id = 'vc-window';
    win.className = 'vc-window vc-hidden';
    win.innerHTML = [
      '<div class="vc-drag-bar" id="vcDragBar">',
      '  <div class="vc-drag-bar-title">',
      '    <i class="fa-solid fa-video"></i>',
      '    <span id="vcTitleName">Ta</span>',
      '  </div>',
      '  <div class="vc-drag-bar-actions">',
      '    <button class="vc-icon-btn" id="vcMinimizeBtn" title="最小化">',
      '      <i class="fa-solid fa-window-minimize"></i>',
      '    </button>',
      '    <button class="vc-icon-btn" id="vcCloseBtn" title="关闭">',
      '      <i class="fa-solid fa-xmark"></i>',
      '    </button>',
      '  </div>',
      '</div>',
      '<div class="vc-video-area">',
      '  <div class="vc-remote-avatar-wrap">',
      '    <img class="vc-remote-avatar" id="vcRemoteAvatar" src="" alt="对方">',
      '  </div>',
      '  <div class="vc-connecting-overlay" id="vcConnectingOverlay">',
      '    <div class="vc-connecting-spinner"></div>',
      '    <div class="vc-connecting-text" id="vcConnectingText">正在连接...</div>',
      '  </div>',
      '  <div class="vc-connected-overlay" id="vcConnectedOverlay">',
      '    <div class="vc-connected-timer" id="vcConnectedTimer">00:00</div>',
      '    <div class="vc-connected-label">正在通话中</div>',
      '  </div>',
      '  <img class="vc-local-avatar" id="vcLocalAvatar" src="" alt="我">',
      '</div>',
      '<div class="vc-action-bar">',
      '  <button class="vc-action-btn vc-btn-mute" id="vcMuteBtn" title="静音">',
      '    <i class="fa-solid fa-microphone"></i>',
      '  </button>',
      '  <button class="vc-action-btn vc-btn-hangup" id="vcHangupBtn" title="挂断">',
      '    <i class="fa-solid fa-phone-slash"></i>',
      '  </button>',
      '  <button class="vc-action-btn vc-btn-minimize" id="vcMinimizeBtn2" title="最小化">',
      '    <i class="fa-solid fa-window-minimize"></i>',
      '  </button>',
      '</div>',
      '<div class="vc-resize-handle" id="vcResizeHandle"></div>'
    ].join('');

    document.body.appendChild(win);

    // 初始化头像
    document.getElementById('vcRemoteAvatar').src = getContactAvatar();
    document.getElementById('vcLocalAvatar').src = getMyAvatar();
    document.getElementById('vcTitleName').textContent = getContactName();

    // 绑定事件
    bindWindowEvents();
  }

  function getMyAvatar() {
    var avatarImg = document.getElementById('avatarImg');
    if (avatarImg && avatarImg.src) return avatarImg.src;
    return 'https://picsum.photos/100/100?random=1';
  }

  // ==================== 通话窗口拖拽 ====================
  function bindWindowEvents() {
    var win = document.getElementById('vc-window');
    var dragBar = document.getElementById('vcDragBar');
    var resizeHandle = document.getElementById('vcResizeHandle');

    // 拖拽移动
    dragBar.addEventListener('pointerdown', function (e) {
      if (e.target.closest('.vc-icon-btn')) return;
      var rect = win.getBoundingClientRect();
      state.drag = {
        startX: e.clientX,
        startY: e.clientY,
        origX: rect.left,
        origY: rect.top
      };
      dragBar.setPointerCapture(e.pointerId);
    });

    dragBar.addEventListener('pointermove', function (e) {
      if (!state.drag) return;
      var dx = e.clientX - state.drag.startX;
      var dy = e.clientY - state.drag.startY;
      var newX = Math.max(0, Math.min(window.innerWidth - win.offsetWidth, state.drag.origX + dx));
      var newY = Math.max(0, Math.min(window.innerHeight - win.offsetHeight, state.drag.origY + dy));
      win.style.left = newX + 'px';
      win.style.top = newY + 'px';
      win.style.right = 'auto';
      win.style.bottom = 'auto';
      state.win.x = newX;
      state.win.y = newY;
    });

    dragBar.addEventListener('pointerup', function (e) {
      state.drag = null;
      try { dragBar.releasePointerCapture(e.pointerId); } catch (err) {}
    });
    dragBar.addEventListener('pointercancel', function () {
      state.drag = null;
    });

    // 右下角拉伸
    resizeHandle.addEventListener('pointerdown', function (e) {
      e.stopPropagation();
      var rect = win.getBoundingClientRect();
      state.resize = {
        startX: e.clientX,
        startY: e.clientY,
        origW: rect.width,
        origH: rect.height
      };
      resizeHandle.setPointerCapture(e.pointerId);
    });

    resizeHandle.addEventListener('pointermove', function (e) {
      if (!state.resize) return;
      var dx = e.clientX - state.resize.startX;
      var dy = e.clientY - state.resize.startY;
      var newW = Math.max(MIN_W, Math.min(window.innerWidth - 20, state.resize.origW + dx));
      var newH = Math.max(MIN_H, Math.min(window.innerHeight - 20, state.resize.origH + dy));
      win.style.width = newW + 'px';
      win.style.height = newH + 'px';
      state.win.w = newW;
      state.win.h = newH;
    });

    resizeHandle.addEventListener('pointerup', function (e) {
      state.resize = null;
      try { resizeHandle.releasePointerCapture(e.pointerId); } catch (err) {}
    });
    resizeHandle.addEventListener('pointercancel', function () {
      state.resize = null;
    });

    // 最小化
    document.getElementById('vcMinimizeBtn').addEventListener('click', minimizeWindow);
    document.getElementById('vcMinimizeBtn2').addEventListener('click', minimizeWindow);

    // 关闭
    document.getElementById('vcCloseBtn').addEventListener('click', function () {
      if (state.connected) {
        endCall();
      } else {
        cancelCall();
      }
    });

    // 挂断
    document.getElementById('vcHangupBtn').addEventListener('click', function () {
      if (state.connected) {
        endCall();
      } else {
        cancelCall();
      }
    });

    // 静音按钮（视觉切换）
    var muteBtn = document.getElementById('vcMuteBtn');
    var muted = false;
    muteBtn.addEventListener('click', function () {
      muted = !muted;
      var icon = muteBtn.querySelector('i');
      if (muted) {
        icon.className = 'fa-solid fa-microphone-slash';
        muteBtn.style.background = 'rgba(240, 90, 90, 0.4)';
      } else {
        icon.className = 'fa-solid fa-microphone';
        muteBtn.style.background = '';
      }
    });
  }

  // ==================== 显示/隐藏窗口 ====================
  function showWindow(mode) {
    var win = document.getElementById('vc-window');
    if (!win) return;

    // 默认位置：居中偏上
    if (state.win.x === null) {
      state.win.x = Math.max(10, (window.innerWidth - state.win.w) / 2);
      state.win.y = Math.max(10, (window.innerHeight - state.win.h) / 2 - 30);
    }
    win.style.left = state.win.x + 'px';
    win.style.top = state.win.y + 'px';
    win.style.width = state.win.w + 'px';
    win.style.height = state.win.h + 'px';
    win.style.right = 'auto';
    win.style.bottom = 'auto';

    win.classList.remove('vc-hidden');
    // 触发动画
    requestAnimationFrame(function () {
      win.classList.add('vc-show');
    });

    // 更新头像和名字
    document.getElementById('vcRemoteAvatar').src = getContactAvatar();
    document.getElementById('vcLocalAvatar').src = getMyAvatar();
    document.getElementById('vcTitleName').textContent = getContactName();

    // 显示"正在连接"
    document.getElementById('vcConnectingOverlay').style.display = 'flex';
    document.getElementById('vcConnectedOverlay').classList.remove('vc-show');
    document.getElementById('vcConnectingText').textContent = mode === 'incoming' ? '正在接通...' : '正在连接...';
  }

  function hideWindow() {
    var win = document.getElementById('vc-window');
    if (!win) return;
    win.classList.remove('vc-show');
    setTimeout(function () {
      win.classList.add('vc-hidden');
    }, 220);
  }

  // ==================== 计时器 ====================
  function startTimer() {
    state.seconds = 0;
    if (state.timerId) clearInterval(state.timerId);
    state.timerId = setInterval(function () {
      state.seconds++;
      var t = formatTime(state.seconds);
      var timerEl = document.getElementById('vcConnectedTimer');
      if (timerEl) timerEl.textContent = t;
      var miniTimer = document.getElementById('vcMiniTimer');
      if (miniTimer) miniTimer.textContent = t;
    }, 1000);
  }

  function stopTimer() {
    if (state.timerId) {
      clearInterval(state.timerId);
      state.timerId = null;
    }
  }

  function clearPendingTimeouts() {
    state.pendingTimeoutIds.forEach(function (id) { clearTimeout(id); });
    state.pendingTimeoutIds = [];
    if (state.incomingAutoReject) { clearTimeout(state.incomingAutoReject); state.incomingAutoReject = null; }
    if (state.incomingAutoMiss) { clearTimeout(state.incomingAutoMiss); state.incomingAutoMiss = null; }
  }

  // ==================== 接通处理 ====================
  function onConnected() {
    state.connected = true;

    // 隐藏"正在连接"，显示"通话中"
    document.getElementById('vcConnectingOverlay').style.display = 'none';
    document.getElementById('vcConnectedOverlay').classList.add('vc-show');

    // 启动计时器
    startTimer();
  }

  // ==================== 发起呼叫 ====================
  function startCall() {
    if (state.active) return;

    state.active = true;
    state.connected = false;
    state.mode = 'outgoing';
    state.seconds = 0;
    state.minimized = false;
    clearPendingTimeouts();

    showWindow('outgoing');

    // 决定：拒绝 or 接通
    if (Math.random() < OUTGOING_REJECT_PROBABILITY) {
      // 35% 概率被拒
      var rejectDelay = rand(OUTGOING_REJECT_DELAY_MIN, OUTGOING_REJECT_DELAY_MAX);
      var tid = setTimeout(function () {
        if (!state.active || state.connected) return;
        var rejected = Math.random() < 0.5;
        hideWindow();
        state.active = false;
        state.connected = false;
        if (rejected) {
          _addCallEvent('fa-solid fa-video', '视频通话 · 对方拒绝了通话');
        } else {
          _addCallEvent('fa-solid fa-video', '视频通话 · 对方暂时没有接听');
        }
      }, rejectDelay);
      state.pendingTimeoutIds.push(tid);
    } else {
      // 65% 概率接通
      var connectDelay = rand(OUTGOING_CONNECT_DELAY_MIN, OUTGOING_CONNECT_DELAY_MAX);
      var tid2 = setTimeout(function () {
        if (!state.active || state.connected) return;
        onConnected();
      }, connectDelay);
      state.pendingTimeoutIds.push(tid2);
    }
  }

  // ==================== 取消呼叫 ====================
  function cancelCall() {
    clearPendingTimeouts();
    stopTimer();
    hideWindow();
    state.active = false;
    state.connected = false;
    state.seconds = 0;
    _addCallEvent('fa-solid fa-video', '视频通话 · 已取消');
  }

  // ==================== 结束通话 ====================
  function endCall() {
    clearPendingTimeouts();
    stopTimer();
    hideWindow();
    hideMiniPill();

    var wasConnected = state.connected;
    var duration = state.seconds;

    state.active = false;
    state.connected = false;
    state.seconds = 0;
    state.minimized = false;

    if (wasConnected) {
      _addCallEvent('fa-solid fa-video', '视频通话 · 已结束 · ' + formatTime(duration));
    } else {
      _addCallEvent('fa-solid fa-video', '视频通话 · 对方暂时没有接听');
    }
  }

  // ==================== 最小化/恢复 ====================
  function minimizeWindow() {
    if (!state.connected) return;
    state.minimized = true;
    hideWindow();
    showMiniPill();
  }

  function restoreWindow() {
    if (!state.connected) return;
    state.minimized = false;
    hideMiniPill();
    showWindow('outgoing');
    // 恢复"通话中"界面
    document.getElementById('vcConnectingOverlay').style.display = 'none';
    document.getElementById('vcConnectedOverlay').classList.add('vc-show');
    document.getElementById('vcConnectedTimer').textContent = formatTime(state.seconds);
  }

  // ==================== 最小化胶囊 ====================
  function createMiniPill() {
    if (document.getElementById('call-mini-pill')) return;

    var pill = document.createElement('div');
    pill.id = 'call-mini-pill';
    pill.innerHTML = [
      '<img class="vc-mini-avatar" id="vcMiniAvatar" src="" alt="对方">',
      '<div class="vc-mini-info">',
      '  <div class="vc-mini-name" id="vcMiniName">Ta</div>',
      '  <div class="vc-mini-timer" id="vcMiniTimer">00:00</div>',
      '</div>',
      '<button class="vc-mini-hangup" id="vcMiniHangup" title="挂断">',
      '  <i class="fa-solid fa-phone-slash"></i>',
      '</button>'
    ].join('');
    document.body.appendChild(pill);

    // 挂断
    document.getElementById('vcMiniHangup').addEventListener('click', function (e) {
      e.stopPropagation();
      endCall();
    });

    // 点击胶囊（除挂断按钮）恢复窗口
    pill.addEventListener('click', function (e) {
      if (e.target.closest('#vcMiniHangup')) return;
      // 如果正在拖拽，不恢复
      if (pill.dataset.dragging === '1') return;
      restoreWindow();
    });

    // 拖拽
    var dragStart = null;
    var origX = 0, origY = 0;
    pill.addEventListener('pointerdown', function (e) {
      if (e.target.closest('#vcMiniHangup')) return;
      var rect = pill.getBoundingClientRect();
      dragStart = { x: e.clientX, y: e.clientY };
      origX = rect.left;
      origY = rect.top;
      pill.dataset.dragging = '0';
      pill.setPointerCapture(e.pointerId);
      pill.classList.add('vc-dragging');
    });
    pill.addEventListener('pointermove', function (e) {
      if (!dragStart) return;
      var dx = e.clientX - dragStart.x;
      var dy = e.clientY - dragStart.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        pill.dataset.dragging = '1';
      }
      var newX = Math.max(0, Math.min(window.innerWidth - pill.offsetWidth, origX + dx));
      var newY = Math.max(0, Math.min(window.innerHeight - pill.offsetHeight, origY + dy));
      pill.style.left = newX + 'px';
      pill.style.top = newY + 'px';
      pill.style.right = 'auto';
      pill.style.bottom = 'auto';
    });
    pill.addEventListener('pointerup', function (e) {
      dragStart = null;
      pill.classList.remove('vc-dragging');
      try { pill.releasePointerCapture(e.pointerId); } catch (err) {}
      setTimeout(function () {
        pill.dataset.dragging = '0';
      }, 50);
    });
    pill.addEventListener('pointercancel', function () {
      dragStart = null;
      pill.classList.remove('vc-dragging');
    });
  }

  function showMiniPill() {
    createMiniPill();
    var pill = document.getElementById('call-mini-pill');
    document.getElementById('vcMiniAvatar').src = getContactAvatar();
    document.getElementById('vcMiniName').textContent = getContactName();
    document.getElementById('vcMiniTimer').textContent = formatTime(state.seconds);

    // 默认位置：右上角
    if (!pill.style.left) {
      pill.style.left = (window.innerWidth - 160) + 'px';
      pill.style.top = '16px';
    }

    pill.classList.add('vc-show');
  }

  function hideMiniPill() {
    var pill = document.getElementById('call-mini-pill');
    if (pill) pill.classList.remove('vc-show');
  }

  // ==================== 来电悬浮卡片 ====================
  function createIncomingOverlay() {
    if (document.getElementById('call-incoming-overlay')) return;

    var overlay = document.createElement('div');
    overlay.id = 'call-incoming-overlay';
    overlay.innerHTML = [
      '<div class="vc-incoming-card">',
      '  <div class="vc-incoming-avatar-wrap">',
      '    <div class="vc-pulse-ring"></div>',
      '    <div class="vc-pulse-ring vc-pulse-2"></div>',
      '    <div class="vc-pulse-ring vc-pulse-3"></div>',
      '    <img class="vc-incoming-avatar" id="vcIncomingAvatar" src="" alt="对方">',
      '  </div>',
      '  <div class="vc-incoming-name" id="vcIncomingName">Ta</div>',
      '  <div class="vc-incoming-text"><i class="fa-solid fa-video"></i> 邀请你视频通话</div>',
      '  <div class="vc-incoming-actions">',
      '    <button class="vc-incoming-btn vc-btn-decline" id="vcIncomingDecline">',
      '      <i class="fa-solid fa-phone-slash"></i><span>拒绝</span>',
      '    </button>',
      '    <button class="vc-incoming-btn vc-btn-accept" id="vcIncomingAccept">',
      '      <i class="fa-solid fa-phone"></i><span>接听</span>',
      '    </button>',
      '  </div>',
      '</div>'
    ].join('');
    document.body.appendChild(overlay);

    document.getElementById('vcIncomingAccept').addEventListener('click', function () {
      acceptIncoming();
    });
    document.getElementById('vcIncomingDecline').addEventListener('click', function () {
      declineIncoming();
    });
  }

  function showIncomingCall() {
    if (state.active) return;
    state.active = true;
    state.connected = false;
    state.mode = 'incoming';
    state.seconds = 0;
    clearPendingTimeouts();

    createIncomingOverlay();
    var overlay = document.getElementById('call-incoming-overlay');
    document.getElementById('vcIncomingAvatar').src = getContactAvatar();
    document.getElementById('vcIncomingName').textContent = getContactName();
    overlay.classList.add('vc-show');

    // 30% 概率自动拒绝（4-6 秒）
    if (Math.random() < INCOMING_AUTO_REJECT_PROBABILITY) {
      var autoRejectDelay = rand(INCOMING_AUTO_REJECT_MIN, INCOMING_AUTO_REJECT_MAX);
      state.incomingAutoReject = setTimeout(function () {
        if (overlay.classList.contains('vc-show')) {
          // 模拟对方挂断
          overlay.classList.remove('vc-show');
          state.active = false;
          _addCallEvent('fa-solid fa-video', '视频通话 · 对方已挂断');
        }
      }, autoRejectDelay);
    } else {
      // 22 秒后自动未接
      state.incomingAutoMiss = setTimeout(function () {
        if (overlay.classList.contains('vc-show')) {
          overlay.classList.remove('vc-show');
          state.active = false;
          _addCallEvent('fa-solid fa-video', '视频通话 · 未接来电');
        }
      }, INCOMING_AUTO_MISS_DELAY);
    }
  }

  function acceptIncoming() {
    clearPendingTimeouts();
    var overlay = document.getElementById('call-incoming-overlay');
    if (overlay) overlay.classList.remove('vc-show');

    state.connected = false;
    state.mode = 'incoming';
    showWindow('incoming');

    // 接通前随机延迟
    var connectDelay = rand(OUTGOING_CONNECT_DELAY_MIN, OUTGOING_CONNECT_DELAY_MAX);
    var tid = setTimeout(function () {
      onConnected();
    }, connectDelay);
    state.pendingTimeoutIds.push(tid);
  }

  function declineIncoming() {
    clearPendingTimeouts();
    var overlay = document.getElementById('call-incoming-overlay');
    if (overlay) overlay.classList.remove('vc-show');
    state.active = false;
    state.connected = false;
    _addCallEvent('fa-solid fa-video', '视频通话 · 已拒绝');
  }

  // ==================== 随机来电调度 ====================
  function scheduleRandomCall() {
    if (state.randomCallTimer) clearTimeout(state.randomCallTimer);

    var delay = rand(RANDOM_CALL_MIN_MS, RANDOM_CALL_MAX_MS);
    state.randomCallTimer = setTimeout(function () {
      // 如果当前没有通话，按概率触发来电
      if (!state.active) {
        if (Math.random() < RANDOM_CALL_PROBABILITY) {
          showIncomingCall();
        }
      }
      // 递归调度下一次
      scheduleRandomCall();
    }, delay);
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

  // ==================== 初始化 ====================
  function init() {
    injectCSS();
    createCallWindow();
    createMiniPill();
    createIncomingOverlay();
    bindVideoCallIcon();
    scheduleRandomCall();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 延迟再绑定一次，确保图标存在
  setTimeout(bindVideoCallIcon, 500);
  setTimeout(bindVideoCallIcon, 1500);
  setTimeout(bindVideoCallIcon, 3000);

  // 窗口大小变化时，确保窗口不超出
  window.addEventListener('resize', function () {
    var win = document.getElementById('vc-window');
    if (!win || win.classList.contains('vc-hidden')) return;
    var rect = win.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      win.style.left = Math.max(0, window.innerWidth - rect.width - 10) + 'px';
    }
    if (rect.bottom > window.innerHeight) {
      win.style.top = Math.max(0, window.innerHeight - rect.height - 10) + 'px';
    }
  });

  // ==================== 暴露给外部 ====================
  window.callFeature = {
    startCall: startCall,
    endCall: endCall,
    cancelCall: cancelCall,
    showIncomingCall: showIncomingCall,
    restoreWindow: restoreWindow,
    minimizeWindow: minimizeWindow,
    _addCallEvent: _addCallEvent,
    // 调试接口
    _state: state
  };

  // 兼容老代码调用
  window.videoCall = window.callFeature;

})();
