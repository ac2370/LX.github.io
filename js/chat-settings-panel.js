/**
 * 传讯页面 - 设置面板（独立模块）
 * 本版追加：有消息，轻轻告诉你 —— 通知/保活逻辑
 * - 允许手机系统通知（Notification API）
 * - 站内消息横幅开关（持久化）
 * - 显示消息内容开关（持久化）
 * - 允许他随机来电（持久化，video-call.js 读取）
 * - 后台保活 · 静音循环（AudioContext 循环静音）
 */

(function () {
  'use strict';

  // ==================== 存储 Key ====================
  var STORE_KEY_TAB = 'chat_settings_panel_active_tab';
  var STORE_KEY_THEME = 'chat_settings_theme';
  var STORE_KEY_FONT = 'chat_settings_font';
  var STORE_KEY_BUBBLE = 'chat_settings_bubble';
  var STORE_KEY_CARD_MODE = 'chat_card_mode';
  var STORE_KEY_PUBLIC_GROUPS = 'chat_public_groups';
  var STORE_KEY_PRIVATE_GROUPS = 'chat_private_groups';
  var STORE_KEY_EMOJI_GROUPS = 'chat_emoji_groups';
  var STORE_KEY_STICKER_GROUPS = 'chat_sticker_groups';

  // 通知 & 保活
  var STORE_KEY_BANNER_ENABLED = 'chat_notify_banner_enabled';
  var STORE_KEY_SHOW_CONTENT = 'chat_notify_show_content';
  var STORE_KEY_RANDOM_CALL = 'chat_notify_random_call';
  var STORE_KEY_SILENT_LOOP = 'chat_notify_silent_loop';
  var STORE_KEY_NOTIFY_GRANTED = 'chat_notify_permission_granted';

  var CUSTOM_CSS_STYLE_ID = 'user-custom-bubble-css';

  // ==================== 状态 ====================
  var activeTab = 'appearance';
  var theme = { accentColor: '#6fb1e8' };
  var font = { size: 14, family: 'system', customUrl: '' };
  var bubble = { style: 'standard', customCss: '' };
  var cardMode = 'all';
  var publicGroups = [];
  var privateGroups = [];
  var emojiGroups = [];
  var stickerGroups = [];
  var settingsTrigger = null;

  // 通知 & 保活状态
  var notifyState = {
    bannerEnabled: true,      // 站内消息横幅
    showContent: true,        // 显示消息内容
    randomCall: false,        // 允许他随机来电
    silentLoop: false,        // 后台保活
    permissionGranted: false  // 系统通知权限
  };

  var silentLoopNodes = null; // 静音循环的 AudioContext 节点

  // ==================== 持久化 ====================
  function persist(key, value) {
    if (typeof localforage !== 'undefined') {
      localforage.setItem(key, value).catch(function () {});
    } else {
      try {
        if (typeof value === 'string') localStorage.setItem(key, value);
        else localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {}
    }
  }

  function loadValue(key, callback) {
    if (typeof localforage !== 'undefined') {
      localforage.getItem(key).then(function (val) {
        if (callback) callback(val);
      }).catch(function () { if (callback) callback(null); });
    } else {
      try {
        var raw = localStorage.getItem(key);
        if (raw === null) { callback(null); return; }
        try { callback(JSON.parse(raw)); } catch (e) { callback(raw); }
      } catch (e) { callback(null); }
    }
  }

  function persistTab() { persist(STORE_KEY_TAB, activeTab); }
  function loadTab(cb) {
    loadValue(STORE_KEY_TAB, function (v) {
      if (v && v !== 'profile') activeTab = v;
      else activeTab = 'appearance';
      cb();
    });
  }

  function persistTheme() { persist(STORE_KEY_THEME, theme); }
  function loadTheme(cb) {
    loadValue(STORE_KEY_THEME, function (v) {
      if (v && typeof v === 'object' && v.accentColor) theme.accentColor = v.accentColor;
      cb();
    });
  }
  function persistFont() { persist(STORE_KEY_FONT, font); }
  function loadFont(cb) {
    loadValue(STORE_KEY_FONT, function (v) {
      if (v && typeof v === 'object') {
        if (typeof v.size === 'number') font.size = v.size;
        if (v.family) font.family = v.family;
        if (v.customUrl) font.customUrl = v.customUrl;
      }
      cb();
    });
  }
  function persistBubble() { persist(STORE_KEY_BUBBLE, bubble); }
  function loadBubble(cb) {
    loadValue(STORE_KEY_BUBBLE, function (v) {
      if (v && typeof v === 'object') {
        if (v.style) bubble.style = v.style;
        if (typeof v.customCss === 'string') bubble.customCss = v.customCss;
      }
      cb();
    });
  }
  function persistCardMode() {
    persist(STORE_KEY_CARD_MODE, cardMode);
    window.chatCardMode = cardMode;
  }
  function loadCardMode(cb) {
    loadValue(STORE_KEY_CARD_MODE, function (v) { if (v) cardMode = v; cb(); });
  }
  function persistGroupSelections() {
    persist(STORE_KEY_PUBLIC_GROUPS, publicGroups);
    persist(STORE_KEY_PRIVATE_GROUPS, privateGroups);
    persist(STORE_KEY_EMOJI_GROUPS, emojiGroups);
    persist(STORE_KEY_STICKER_GROUPS, stickerGroups);
    window.chatPublicGroups = publicGroups.slice();
    window.chatPrivateGroups = privateGroups.slice();
    window.chatEmojiGroups = emojiGroups.slice();
    window.chatStickerGroups = stickerGroups.slice();
  }
  function loadGroupSelections(cb) {
    var keys = [
      { store: STORE_KEY_PUBLIC_GROUPS, assign: function (d) { if (Array.isArray(d)) publicGroups = d; } },
      { store: STORE_KEY_PRIVATE_GROUPS, assign: function (d) { if (Array.isArray(d)) privateGroups = d; } },
      { store: STORE_KEY_EMOJI_GROUPS, assign: function (d) { if (Array.isArray(d)) emojiGroups = d; } },
      { store: STORE_KEY_STICKER_GROUPS, assign: function (d) { if (Array.isArray(d)) stickerGroups = d; } }
    ];
    var remaining = keys.length;
    function done() {
      remaining--;
      if (remaining <= 0) {
        window.chatPublicGroups = publicGroups.slice();
        window.chatPrivateGroups = privateGroups.slice();
        window.chatEmojiGroups = emojiGroups.slice();
        window.chatStickerGroups = stickerGroups.slice();
        cb();
      }
    }
    keys.forEach(function (k) {
      loadValue(k.store, function (d) { k.assign(d); done(); });
    });
  }

  // ==================== 通知/保活 持久化 ====================
  function persistNotifyState() {
    persist(STORE_KEY_BANNER_ENABLED, notifyState.bannerEnabled);
    persist(STORE_KEY_SHOW_CONTENT, notifyState.showContent);
    persist(STORE_KEY_RANDOM_CALL, notifyState.randomCall);
    persist(STORE_KEY_SILENT_LOOP, notifyState.silentLoop);
    persist(STORE_KEY_NOTIFY_GRANTED, notifyState.permissionGranted);

    // 同步到 window，供其他模块读取
    window.chatNotifyState = {
      bannerEnabled: notifyState.bannerEnabled,
      showContent: notifyState.showContent,
      randomCall: notifyState.randomCall,
      silentLoop: notifyState.silentLoop,
      permissionGranted: notifyState.permissionGranted
    };
  }

  function loadNotifyState(cb) {
    var remaining = 5;
    function done() {
      remaining--;
      if (remaining <= 0) {
        window.chatNotifyState = {
          bannerEnabled: notifyState.bannerEnabled,
          showContent: notifyState.showContent,
          randomCall: notifyState.randomCall,
          silentLoop: notifyState.silentLoop,
          permissionGranted: notifyState.permissionGranted
        };
        if (cb) cb();
      }
    }
    loadValue(STORE_KEY_BANNER_ENABLED, function (v) { if (typeof v === 'boolean') notifyState.bannerEnabled = v; done(); });
    loadValue(STORE_KEY_SHOW_CONTENT, function (v) { if (typeof v === 'boolean') notifyState.showContent = v; done(); });
    loadValue(STORE_KEY_RANDOM_CALL, function (v) { if (typeof v === 'boolean') notifyState.randomCall = v; done(); });
    loadValue(STORE_KEY_SILENT_LOOP, function (v) { if (typeof v === 'boolean') notifyState.silentLoop = v; done(); });
    loadValue(STORE_KEY_NOTIFY_GRANTED, function (v) { if (typeof v === 'boolean') notifyState.permissionGranted = v; done(); });
  }

  // ==================== 静音循环 ====================
  function startSilentLoop() {
    if (silentLoopNodes) return true;

    try {
      var AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;

      var ctx = new AudioContext();
      var oscillator = ctx.createOscillator();
      var gainNode = ctx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.value = 0; // 0Hz 等于无声
      gainNode.gain.value = 0;

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.start();

      // 某些浏览器需要 resume
      if (ctx.state === 'suspended') {
        ctx.resume().catch(function () {});
      }

      silentLoopNodes = {
        ctx: ctx,
        oscillator: oscillator,
        gainNode: gainNode
      };
      console.log('[静音循环] 已开启');
      return true;
    } catch (e) {
      console.warn('[静音循环] 启动失败:', e);
      return false;
    }
  }

  function stopSilentLoop() {
    if (!silentLoopNodes) return;
    try {
      silentLoopNodes.oscillator.stop();
      silentLoopNodes.oscillator.disconnect();
      silentLoopNodes.gainNode.disconnect();
      if (silentLoopNodes.ctx && silentLoopNodes.ctx.state !== 'closed') {
        silentLoopNodes.ctx.close().catch(function () {});
      }
    } catch (e) {}
    silentLoopNodes = null;
    console.log('[静音循环] 已关闭');
  }

  // ==================== 通知权限 ====================
  function requestNotificationPermission() {
    if (!('Notification' in window)) {
      alert('当前浏览器不支持系统通知');
      return;
    }

    if (Notification.permission === 'granted') {
      notifyState.permissionGranted = true;
      persistNotifyState();
      updateNotifyUI();
      alert('系统通知已开启');
      return;
    }

    if (Notification.permission === 'denied') {
      alert('系统通知已被拒绝。\n请前往 手机设置 → 浏览器 → 通知，手动开启。');
      return;
    }

    Notification.requestPermission().then(function (permission) {
      if (permission === 'granted') {
        notifyState.permissionGranted = true;
        persistNotifyState();
        updateNotifyUI();
        alert('系统通知已开启');
      } else {
        notifyState.permissionGranted = false;
        persistNotifyState();
        updateNotifyUI();
        alert('未开启系统通知。\n如需开启，请前往 手机设置 → 浏览器 → 通知。');
      }
    }).catch(function () {
      alert('无法请求通知权限');
    });
  }

  // ==================== 通知 UI 状态刷新 ====================
  function updateNotifyUI() {
    // 系统通知按钮
    var btn = document.getElementById('dsAllowNotifyBtn');
    if (btn) {
      if (notifyState.permissionGranted || (('Notification' in window) && Notification.permission === 'granted')) {
        btn.innerHTML = '<i class="fa-solid fa-bell"></i> 已开启系统通知';
        btn.style.background = '#e6f5ed';
        btn.style.color = '#4CAF7D';
        btn.style.borderColor = '#c6e8d5';
        btn.disabled = true;
      } else {
        btn.innerHTML = '<i class="fa-solid fa-bell"></i> 允许手机系统通知';
        btn.style.background = '';
        btn.style.color = '';
        btn.style.borderColor = '';
        btn.disabled = false;
      }
    }

    // 三个 Toggle
    var bannerToggle = document.getElementById('dsBannerToggle');
    if (bannerToggle) bannerToggle.checked = notifyState.bannerEnabled;

    var showContentToggle = document.getElementById('dsShowContentToggle');
    if (showContentToggle) showContentToggle.checked = notifyState.showContent;

    var randomCallToggle = document.getElementById('dsRandomCallToggle');
    if (randomCallToggle) randomCallToggle.checked = notifyState.randomCall;

    // 静音循环按钮和状态
    var loopBtn = document.getElementById('dsSilentLoopBtn');
    var loopDesc = document.getElementById('dsSilentLoopDesc');
    if (loopBtn) {
      if (notifyState.silentLoop) {
        loopBtn.innerHTML = '<i class="fa-solid fa-circle-stop"></i> 关闭静音循环';
        loopBtn.style.background = '#e6f5ed';
        loopBtn.style.color = '#4CAF7D';
        loopBtn.style.borderColor = '#c6e8d5';
      } else {
        loopBtn.innerHTML = '<i class="fa-solid fa-circle-play"></i> 开启静音循环';
        loopBtn.style.background = '';
        loopBtn.style.color = '';
        loopBtn.style.borderColor = '';
      }
    }
    if (loopDesc) {
      loopDesc.textContent = notifyState.silentLoop ? '静音循环已开启' : '静音循环未开启';
    }
  }

  // ==================== 颜色工具 ====================
  function hexToRgb(hex) {
    if (!hex) return null;
    var m = String(hex).replace('#', '');
    if (m.length === 3) m = m[0] + m[0] + m[1] + m[1] + m[2] + m[2];
    var num = parseInt(m, 16);
    if (isNaN(num)) return null;
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  }
  function rgba(hex, alpha) {
    var rgb = hexToRgb(hex);
    if (!rgb) return 'rgba(111,177,232,' + alpha + ')';
    return 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',' + alpha + ')';
  }
  function darken(hex, amount) {
    var rgb = hexToRgb(hex);
    if (!rgb) return '#4a86b0';
    return '#' +
      ('0' + Math.max(0, rgb.r - amount).toString(16)).slice(-2) +
      ('0' + Math.max(0, rgb.g - amount).toString(16)).slice(-2) +
      ('0' + Math.max(0, rgb.b - amount).toString(16)).slice(-2);
  }

  // ==================== 主题 ====================
  function applyTheme() {
    var root = document.documentElement;
    var color = theme.accentColor || '#6fb1e8';
    var colorLight = rgba(color, 0.15);
    var colorSoft = rgba(color, 0.25);
    var colorDark = darken(color, 40);

    root.style.setProperty('--accent-color', color);
    root.style.setProperty('--accent-color-light', colorLight);
    root.style.setProperty('--accent-color-soft', colorSoft);
    root.style.setProperty('--accent-color-dark', colorDark);

    var styleId = 'global-theme-vars';
    var styleEl = document.getElementById(styleId);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    styleEl.textContent = [
      '#pageHome .play-btn { background: ' + color + ' !important; box-shadow: 0 3px 10px ' + rgba(color, 0.35) + ' !important; }',
      '#pageHome .tab-btn.active i, #pageHome .tab-btn.active span { color: ' + color + ' !important; }',
      '#pageHome .tab-btn.active { color: ' + color + ' !important; }',
      '#pageHome .function-icon i { color: ' + colorDark + ' !important; }',
      '#pageHome .search-glass i { color: ' + color + ' !important; }',
      '#pageCard .cat-grid-item.active { background: ' + colorLight + ' !important; border-color: ' + color + ' !important; }',
      '#pageCard .cat-grid-item.active i, #pageCard .cat-grid-item.active .cat-label { color: ' + colorDark + ' !important; }',
      '#pageCard .word-card-delete { background: ' + colorLight + ' !important; color: ' + colorDark + ' !important; }',
      '#pageCard .card-action-btn i { color: ' + color + ' !important; }',
      '#pageCard .cat-grid-badge { background: ' + color + ' !important; }',
      '#pageChat .send-btn { background: ' + color + ' !important; box-shadow: 0 3px 10px ' + rgba(color, 0.35) + ' !important; }',
      '#pageChat .send-btn:active { background: ' + colorDark + ' !important; }',
      '#pageChat .chat-action-icon { color: ' + rgba(color, 0.75) + ' !important; }',
      '#pageChat .chat-action-icon:active { color: ' + color + ' !important; }',
      '#pageChat .message-row.self .message-bubble { background: ' + colorSoft + ' !important; }',
      '#chatSettingsPanel .chat-settings-tab.active { background: ' + colorLight + ' !important; color: ' + colorDark + ' !important; }',
      '#chatSettingsPanel .chat-settings-title i { color: ' + color + ' !important; }',
      '#chatSettingsPanel .cs-mode-btn.active { color: ' + colorDark + ' !important; }',
      '#chatSettingsPanel .cs-words-btn i { color: ' + color + ' !important; }',
      '#chatSettingsPanel .cs-group-checkbox input:checked + .cs-group-check-mark { background: ' + color + ' !important; border-color: ' + color + ' !important; }',
      '#chatSettingsPanel .cs-css-apply { background: ' + color + ' !important; border-color: ' + color + ' !important; }',
      '#chatSettingsPanel .cs-font-url-apply { background: ' + colorDark + ' !important; }',
      '.home-settings-btn i, .floating-settings i { color: ' + color + ' !important; }'
    ].join('\n');

    document.querySelectorAll('.tab-btn.active i, .tab-btn.active span').forEach(function (el) {
      el.style.color = color;
    });

    var sendBtn = document.getElementById('sendBtn');
    if (sendBtn) {
      sendBtn.style.background = color;
      sendBtn.style.boxShadow = '0 3px 10px ' + rgba(color, 0.35);
    }
  }

  // ==================== 字体 ====================
  function applyFont() {
    var root = document.documentElement;
    var size = font.size || 14;
    root.style.setProperty('--global-font-size', size + 'px');
    root.style.setProperty('--chat-font-size', size + 'px');

    var styleId = 'global-font-vars';
    var styleEl = document.getElementById(styleId);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    var uiSize = Math.min(size, 16);

    styleEl.textContent = [
      '#pageChat .message-bubble, #pageChat .message-text { font-size: ' + size + 'px !important; }',
      '#pageChat .call-record-bubble { font-size: ' + Math.max(10, size - 3) + 'px !important; }',
      '#pageHome .function-label { font-size: ' + Math.max(10, uiSize - 4) + 'px !important; }',
      '#pageHome h1, #pageHome .header-card h1 { font-size: ' + (uiSize + 4) + 'px !important; }',
      '#pageHome .header-card p { font-size: ' + Math.max(10, uiSize - 2) + 'px !important; }',
      '#pageHome .tab-btn span { font-size: ' + Math.max(10, uiSize - 4) + 'px !important; }',
      '#pageHome .search-glass input { font-size: ' + uiSize + 'px !important; }',
      '#pageHome #songTitle { font-size: ' + uiSize + 'px !important; }',
      '#pageHome #songArtist { font-size: ' + Math.max(10, uiSize - 4) + 'px !important; }',
      '#pageCard .card-topbar-title { font-size: ' + (uiSize + 3) + 'px !important; }',
      '#pageCard .cat-label { font-size: ' + Math.max(10, uiSize - 3) + 'px !important; }',
      '#pageCard .card-action-btn span { font-size: ' + Math.max(10, uiSize - 2) + 'px !important; }',
      '#pageCard .card-group-btn { font-size: ' + Math.max(10, uiSize - 3) + 'px !important; }',
      '#pageCard .card-search-input { font-size: ' + uiSize + 'px !important; }',
      '#pageCard .word-card-text { font-size: ' + uiSize + 'px !important; }',
      '#pageCard .card-group-select { font-size: ' + uiSize + 'px !important; }',
      '#pageCard .card-status-counts { font-size: ' + Math.max(10, uiSize - 3) + 'px !important; }',
      '#chatSettingsPanel .chat-settings-title span { font-size: ' + (uiSize + 2) + 'px !important; }',
      '#chatSettingsPanel .chat-settings-tab span { font-size: ' + Math.max(10, uiSize - 3) + 'px !important; }',
      '#chatSettingsPanel .chat-settings-section-title { font-size: ' + Math.max(10, uiSize - 2) + 'px !important; }',
      '#chatSettingsPanel .cs-group-name { font-size: ' + uiSize + 'px !important; }',
      '#chatSettingsPanel .cs-group-count { font-size: ' + Math.max(10, uiSize - 3) + 'px !important; }',
      '.fa, .fas, .far, .fal, .fad, .fab,',
      '.fa-solid, .fa-regular, .fa-light, .fa-thin, .fa-duotone, .fa-brands,',
      '[class*="fa-"],',
      'i[class*="fa"] {',
      '  font-family: "Font Awesome 6 Free", "Font Awesome 6 Brands", "FontAwesome" !important;',
      '}',
      '.fa-solid, .fas { font-weight: 900 !important; }',
      '.fa-regular, .far { font-weight: 400 !important; }',
      '.fa-brands, .fab { font-family: "Font Awesome 6 Brands", "FontAwesome" !important; font-weight: 400 !important; }'
    ].join('\n');

    document.querySelectorAll('#pageChat .message-bubble, #pageChat .message-text').forEach(function (el) {
      el.style.fontSize = size + 'px';
    });

    var fontFamily = '';
    if (font.family === 'system') {
      fontFamily = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
    } else if (font.family === 'kaiti') {
      fontFamily = '"Kaiti SC", "KaiTi", "楷体", STKaiti, serif';
    } else if (font.family === 'songti') {
      fontFamily = '"Songti SC", "SimSun", "宋体", STSong, serif';
    } else if (font.family === 'heiti') {
      fontFamily = '"Heiti SC", "SimHei", "黑体", STHeiti, sans-serif';
    } else if (font.family === 'custom') {
      fontFamily = '"CustomFont", "PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif';
    }

    if (fontFamily) {
      document.body.style.fontFamily = fontFamily;

      var fontStyleId = 'global-font-family';
      var fontStyleEl = document.getElementById(fontStyleId);
      if (!fontStyleEl) {
        fontStyleEl = document.createElement('style');
        fontStyleEl.id = fontStyleId;
        document.head.appendChild(fontStyleEl);
      }

      fontStyleEl.textContent = [
        'body { font-family: ' + fontFamily + ' !important; }',
        'h1, h2, h3, h4, h5, h6, p, span, div, a, button, input, textarea, select, label {',
        '  font-family: ' + fontFamily + ' !important;',
        '}',
        'i[class*="fa-"], i[class*="fas"], i[class*="far"], i[class*="fab"], i.fa, i.fas, i.far, i.fab,',
        '.fa, .fas, .far, .fab, .fa-solid, .fa-regular, .fa-brands {',
        '  font-family: "Font Awesome 6 Free", "Font Awesome 6 Brands", "FontAwesome" !important;',
        '}'
      ].join('\n');
    }
  }

  // ==================== 字体 URL ====================
  function applyFontUrl() {
    var linkId = 'custom-font-link';
    var existing = document.getElementById(linkId);
    if (existing) existing.remove();
    if (!font.customUrl) return;

    var link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = font.customUrl;
    link.onload = function () {
      document.body.style.fontFamily = '';
      void document.body.offsetHeight;
      applyFont();
      if (font.family === 'custom') applyCustomFontFamily();
    };
    link.onerror = function () {
      console.warn('[chat-settings-panel] 字体加载失败:', font.customUrl);
    };
    document.head.appendChild(link);
    if (font.family === 'custom') applyCustomFontFamily();
  }

  function applyCustomFontFamily() {
    var commonNames = [
      '"CustomFont"', '"Ma Shan Zheng"', '"ZCOOL KuaiLe"', '"Long Cang"',
      '"Liu Jian Mao Cao"', '"Zhi Mang Xing"', '"Noto Sans SC"', '"Noto Serif SC"'
    ];
    var fontFamily = commonNames.join(', ') + ', "PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif';
    document.body.style.fontFamily = fontFamily;

    var fontStyleId = 'global-font-family';
    var fontStyleEl = document.getElementById(fontStyleId);
    if (!fontStyleEl) {
      fontStyleEl = document.createElement('style');
      fontStyleEl.id = fontStyleId;
      document.head.appendChild(fontStyleEl);
    }
    fontStyleEl.textContent = [
      'body { font-family: ' + fontFamily + ' !important; }',
      'h1, h2, h3, h4, h5, h6, p, span, div, a, button, input, textarea, select, label {',
      '  font-family: ' + fontFamily + ' !important;',
      '}',
      'i[class*="fa-"], .fa, .fas, .far, .fab, .fa-solid, .fa-regular, .fa-brands {',
      '  font-family: "Font Awesome 6 Free", "Font Awesome 6 Brands", "FontAwesome" !important;',
      '}'
    ].join('\n');
  }

  // ==================== 气泡样式 ====================
  function applyBubble() {
    var root = document.documentElement;
    var radius = '18px';
    if (bubble.style === 'standard') radius = '18px';
    else if (bubble.style === 'rounded') radius = '10px';
    else if (bubble.style === 'large') radius = '24px';
    else if (bubble.style === 'square') radius = '4px';
    root.style.setProperty('--bubble-radius', radius);

    var styleId = 'bubble-radius-style';
    var styleEl = document.getElementById(styleId);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = '#pageChat .message-bubble { border-radius: ' + radius + ' !important; }';
  }

  // ==================== 自定义 CSS ====================
  function ensureCustomCssStyleTag() {
    var styleEl = document.getElementById(CUSTOM_CSS_STYLE_ID);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = CUSTOM_CSS_STYLE_ID;
      styleEl.type = 'text/css';
      document.head.appendChild(styleEl);
    }
    return styleEl;
  }

  function applyCustomCss() {
    var cssText = (bubble.customCss || '').trim();
    var styleEl = ensureCustomCssStyleTag();
    styleEl.innerHTML = cssText;
    if (styleEl.parentNode !== document.head) {
      document.head.appendChild(styleEl);
    }
  }

  function clearCustomCss() {
    bubble.customCss = '';
    persistBubble();
    var styleEl = ensureCustomCssStyleTag();
    styleEl.innerHTML = '';
  }

  function applyAll() {
    applyTheme();
    applyFont();
    applyFontUrl();
    applyBubble();
    applyCustomCss();
  }

  // ==================== 找到设置图标 ====================
  function findSettingsTrigger() {
    var pageChat = document.getElementById('pageChat');
    if (pageChat) {
      var gears = pageChat.querySelectorAll('.fa-gear, .fa-cog');
      if (gears.length > 0) {
        return gears[gears.length - 1].closest('button, div[role="button"], .tab-btn, .chat-action-icon') || gears[gears.length - 1].parentElement;
      }
    }
    var tabSettings = document.getElementById('tabSettingsHome');
    if (tabSettings) return tabSettings;
    return null;
  }

  function bindSettingsTrigger() {
    if (settingsTrigger && settingsTrigger.dataset.chatSettingsBound) return;
    settingsTrigger = findSettingsTrigger();
    if (!settingsTrigger) return;
    if (settingsTrigger.dataset.chatSettingsBound) return;
    settingsTrigger.dataset.chatSettingsBound = '1';
    settingsTrigger.addEventListener('click', function (e) {
      e.stopImmediatePropagation();
      e.preventDefault();
      openPanel();
    }, true);
  }

  // ==================== 导出/导入（保留原有逻辑） ====================
  function getKeyCategory(key) {
    if (!key) return null;
    var lower = String(key).toLowerCase();
    var chatKeys = ['chat', 'message', 'messages', 'my_contacts', 'my_current_contact', 'group_chat', 'call'];
    var cardKeys = ['carddatabase', 'card', 'my_word_cards', 'my_kaomoji_cards', 'my_place_cards', 'my_mood_cards', 'my_emoji_cards', 'my_status_cards', 'my_card_groups'];
    var mediaKeys = ['home_custom_images', 'avatar', 'piggy', 'piggy_bank'];
    var i;
    for (i = 0; i < chatKeys.length; i++) if (lower.indexOf(chatKeys[i]) >= 0) return 'chat';
    for (i = 0; i < cardKeys.length; i++) if (lower.indexOf(cardKeys[i]) >= 0) return 'cards';
    for (i = 0; i < mediaKeys.length; i++) if (lower.indexOf(mediaKeys[i]) >= 0) return 'media';
    return null;
  }

  function getAllKeys() {
    return new Promise(function (resolve) {
      if (typeof localforage === 'undefined') {
        var keys = [];
        try { for (var i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i)); } catch (e) {}
        resolve(keys);
        return;
      }
      if (typeof localforage.keys === 'function') {
        localforage.keys().then(resolve).catch(function () { resolve([]); });
      } else {
        resolve([]);
      }
    });
  }

  function getItem(key) {
    return new Promise(function (resolve) {
      if (typeof localforage === 'undefined') {
        try {
          var raw = localStorage.getItem(key);
          try { resolve(JSON.parse(raw)); } catch (e) { resolve(raw); }
        } catch (e) { resolve(null); }
        return;
      }
      localforage.getItem(key).then(resolve).catch(function () { resolve(null); });
    });
  }

  function setItem(key, value) {
    return new Promise(function (resolve) {
      if (typeof localforage === 'undefined') {
        try { localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value)); } catch (e) {}
        resolve();
        return;
      }
      localforage.setItem(key, value).then(resolve).catch(function () { resolve(); });
    });
  }

  function openExportPanel() {
    var existing = document.getElementById('dsExportModal');
    if (existing) existing.parentNode.removeChild(existing);

    var modal = document.createElement('div');
    modal.id = 'dsExportModal';
    modal.className = 'ds-export-modal';
    modal.innerHTML = [
      '<div class="ds-export-panel">',
      '  <div class="ds-export-title"><i class="fa-solid fa-file-export"></i> 导出数据</div>',
      '  <div class="ds-export-desc">勾选需要导出的内容</div>',
      '  <label class="ds-export-check">',
      '    <input type="checkbox" id="dsExportChat" checked>',
      '    <span class="ds-export-check-mark"><i class="fa-solid fa-check"></i></span>',
      '    <span class="ds-export-check-label">聊天记录</span>',
      '  </label>',
      '  <label class="ds-export-check">',
      '    <input type="checkbox" id="dsExportCards" checked>',
      '    <span class="ds-export-check-mark"><i class="fa-solid fa-check"></i></span>',
      '    <span class="ds-export-check-label">字卡库（含分组 / 表情包）</span>',
      '  </label>',
      '  <label class="ds-export-check">',
      '    <input type="checkbox" id="dsExportMedia" checked>',
      '    <span class="ds-export-check-mark"><i class="fa-solid fa-check"></i></span>',
      '    <span class="ds-export-check-label">头像与图片</span>',
      '  </label>',
      '  <div class="ds-export-actions">',
      '    <button class="ds-export-btn ds-export-cancel" id="dsExportCancel">取消</button>',
      '    <button class="ds-export-btn ds-export-confirm" id="dsExportConfirm">开始导出</button>',
      '  </div>',
      '</div>'
    ].join('');

    document.body.appendChild(modal);

    document.getElementById('dsExportCancel').addEventListener('click', function () {
      modal.parentNode.removeChild(modal);
    });
    modal.addEventListener('click', function (e) {
      if (e.target === modal) modal.parentNode.removeChild(modal);
    });
    document.getElementById('dsExportConfirm').addEventListener('click', function () {
      var includeChat = document.getElementById('dsExportChat').checked;
      var includeCards = document.getElementById('dsExportCards').checked;
      var includeMedia = document.getElementById('dsExportMedia').checked;
      if (!includeChat && !includeCards && !includeMedia) {
        alert('请至少勾选一项');
        return;
      }
      doExport(includeChat, includeCards, includeMedia);
      modal.parentNode.removeChild(modal);
    });
  }

  function doExport(includeChat, includeCards, includeMedia) {
    getAllKeys().then(function (keys) {
      var result = {
        _meta: {
          app: 'ac2370.github.io',
          type: 'localforage-backup',
          version: 1,
          exportedAt: new Date().toISOString(),
          include: { chat: includeChat, cards: includeCards, media: includeMedia }
        },
        data: {}
      };
      var promises = [];
      keys.forEach(function (key) {
        var cat = getKeyCategory(key);
        var shouldInclude = false;
        if (cat === 'chat') shouldInclude = includeChat;
        else if (cat === 'cards') shouldInclude = includeCards;
        else if (cat === 'media') shouldInclude = includeMedia;
        else shouldInclude = (includeChat || includeCards || includeMedia);
        if (!shouldInclude) return;
        promises.push(getItem(key).then(function (val) { result.data[key] = val; }));
      });
      Promise.all(promises).then(function () {
        var count = Object.keys(result.data).length;
        if (count === 0) { alert('没有匹配到任何数据可以导出'); return; }
        var jsonStr = JSON.stringify(result, null, 2);
        var blob = new Blob([jsonStr], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        var ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        a.href = url;
        a.download = 'chat-backup-' + ts + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      }).catch(function (err) { alert('导出失败：' + err.message); });
    });
  }

  function doImport() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';
    document.body.appendChild(input);

    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      if (!file) { document.body.removeChild(input); return; }
      var reader = new FileReader();
      reader.onload = function (e) {
        try {
          var text = e.target.result;
          var parsed = JSON.parse(text);
          var data = parsed && parsed.data ? parsed.data : parsed;
          if (!data || typeof data !== 'object') { alert('文件格式不正确'); document.body.removeChild(input); return; }
          var keys = Object.keys(data);
          if (keys.length === 0) { alert('文件中没有数据'); document.body.removeChild(input); return; }
          if (!confirm('确定要导入 ' + keys.length + ' 项数据吗？\n（同名 key 会被覆盖）')) { document.body.removeChild(input); return; }
          var promises = keys.map(function (k) { return setItem(k, data[k]); });
          Promise.all(promises).then(function () {
            alert('导入成功！\n共导入 ' + keys.length + ' 项数据。\n\n页面即将刷新以应用更改。');
            setTimeout(function () { window.location.reload(); }, 800);
          }).catch(function (err) { alert('导入失败：' + err.message); });
          document.body.removeChild(input);
        } catch (err) {
          alert('文件解析失败：' + err.message);
          document.body.removeChild(input);
        }
      };
      reader.readAsText(file);
    });

    input.click();
  }

  // ==================== 创建面板 ====================
  function createPanel() {
    if (document.getElementById('chatSettingsPanel')) return;

    var panel = document.createElement('div');
    panel.id = 'chatSettingsPanel';
    panel.className = 'chat-settings-panel';
    panel.innerHTML = [
      '<div class="chat-settings-panel-inner">',

      '  <div class="chat-settings-header">',
      '    <span class="chat-settings-title"><i class="fa-solid fa-sliders"></i> 设置</span>',
      '    <button class="chat-settings-close" id="chatSettingsClose"><i class="fa-solid fa-xmark"></i></button>',
      '  </div>',

      '  <div class="chat-settings-tabs" id="chatSettingsTabs" style="justify-content: space-around;">',
      '    <button class="chat-settings-tab" data-tab="appearance" style="flex: 1 1 0; max-width: 33.33%;">',
      '      <i class="fa-solid fa-palette"></i>',
      '      <span>外观与界面</span>',
      '    </button>',
      '    <button class="chat-settings-tab" data-tab="chat" style="flex: 1 1 0; max-width: 33.33%;">',
      '      <i class="fa-solid fa-comments"></i>',
      '      <span>聊天与字卡</span>',
      '    </button>',
      '    <button class="chat-settings-tab" data-tab="data" style="flex: 1 1 0; max-width: 33.33%;">',
      '      <i class="fa-solid fa-database"></i>',
      '      <span>数据与工具</span>',
      '    </button>',
      '  </div>',

      '  <div class="chat-settings-body">',

      // Tab 1
      '    <div class="chat-settings-tab-panel" data-panel="appearance">',
      '      <div class="chat-settings-section">',
      '        <div class="chat-settings-section-title">全局主题配色</div>',
      '        <div class="cs-theme-colors" id="csThemeColors"></div>',
      '        <div class="cs-custom-color-row">',
      '          <label class="cs-custom-color-btn" for="csCustomColorInput"><i class="fa-solid fa-eye-dropper"></i> 自定义颜色</label>',
      '          <input type="color" id="csCustomColorInput" value="#6fb1e8" style="display:none;">',
      '          <span class="cs-custom-color-value" id="csCustomColorValue">#6fb1e8</span>',
      '        </div>',
      '        <div class="cs-slider-hint">修改后主页、传讯页、字卡库的强调色会同步变化（不影响页面背景）</div>',
      '      </div>',
      '      <div class="chat-settings-section">',
      '        <div class="chat-settings-section-title">文字设置</div>',
      '        <div class="cs-field-label">字体大小</div>',
      '        <div class="cs-slider-row">',
      '          <input type="range" class="cs-slider" id="csFontSizeSlider" min="12" max="24" value="14">',
      '          <span class="cs-slider-value" id="csFontSizeValue">14px</span>',
      '        </div>',
      '        <div class="cs-field-label" style="margin-top:14px;">字体选择</div>',
      '        <select class="cs-font-select" id="csFontSelect">',
      '          <option value="system">系统默认</option>',
      '          <option value="kaiti">楷体</option>',
      '          <option value="songti">宋体</option>',
      '          <option value="heiti">黑体</option>',
      '          <option value="custom">自定义字体</option>',
      '        </select>',
      '        <div class="cs-field-label" style="margin-top:14px;">字体 URL</div>',
      '        <div class="cs-font-url-row">',
      '          <input type="text" class="cs-font-url-input" id="csFontUrlInput" placeholder="粘贴字体 CSS 链接...">',
      '          <button class="cs-font-url-apply" id="csFontUrlApply">应用</button>',
      '        </div>',
      '        <div class="cs-slider-hint">支持 Google Fonts、字体 CDN 等 CSS 链接</div>',
      '      </div>',
      '      <div class="chat-settings-section">',
      '        <div class="chat-settings-section-title">气泡样式</div>',
      '        <div class="cs-bubble-styles" id="csBubbleStyles">',
      '          <button class="cs-bubble-btn active" data-style="standard"><span class="cs-bubble-preview" style="border-radius:18px;"></span><span>标准</span></button>',
      '          <button class="cs-bubble-btn" data-style="rounded"><span class="cs-bubble-preview" style="border-radius:10px;"></span><span>圆角</span></button>',
      '          <button class="cs-bubble-btn" data-style="large"><span class="cs-bubble-preview" style="border-radius:24px;"></span><span>大圆角</span></button>',
      '          <button class="cs-bubble-btn" data-style="square"><span class="cs-bubble-preview" style="border-radius:4px;"></span><span>方形</span></button>',
      '        </div>',
      '        <div class="cs-field-label" style="margin-top:16px;">自定义气泡 CSS</div>',
      '        <textarea class="cs-custom-css-input" id="csCustomCssInput" placeholder="/* 直接输入 CSS，会自动全局生效 */&#10;.message-bubble {&#10;  box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;&#10;  border-radius: 20px !important;&#10;}"></textarea>',
      '        <div class="cs-custom-css-actions">',
      '          <button class="cs-css-btn cs-css-apply" id="csCssApply">应用 CSS</button>',
      '          <button class="cs-css-btn cs-css-clear" id="csCssClear">清空</button>',
      '          <button class="cs-css-btn cs-css-reset" id="csCssReset">恢复默认</button>',
      '        </div>',
      '        <div class="cs-slider-hint" style="margin-top:8px;">提示：这里的 CSS 会直接注入到 &lt;head&gt; 中，不加 #pageChat 前缀也会全局生效</div>',
      '      </div>',
      '    </div>',

      // Tab 2
      '    <div class="chat-settings-tab-panel" data-panel="chat">',
      '      <div class="chat-settings-section">',
      '        <div class="chat-settings-section-title">当前字卡模式</div>',
      '        <div class="cs-mode-switch" id="csModeSwitch">',
      '          <button class="cs-mode-btn active" data-mode="all"><i class="fa-solid fa-layer-group"></i><span>全部字卡</span></button>',
      '          <button class="cs-mode-btn" data-mode="public-only"><i class="fa-solid fa-globe"></i><span>仅公共</span></button>',
      '          <button class="cs-mode-btn" data-mode="private-only"><i class="fa-solid fa-lock"></i><span>仅专属</span></button>',
      '        </div>',
      '        <div class="cs-mode-hint" id="csModeHint">自动回复时 50% 从公共字卡抽取，50% 从专属字卡抽取</div>',
      '      </div>',
      '      <div class="chat-settings-section">',
      '        <div class="cs-words-header"><div class="chat-settings-section-title" style="margin:0;"><i class="fa-solid fa-globe" style="color:#6fb1e8;margin-right:4px;"></i>公共字卡分组<span class="cs-words-count" id="csPublicCount">0</span></div></div>',
      '        <div class="cs-words-hint">勾选的分组视为"公共字卡"，所有联系人都能抽取</div>',
      '        <div class="cs-group-list" id="csPublicGroupList"></div>',
      '      </div>',
      '      <div class="chat-settings-section">',
      '        <div class="cs-words-header"><div class="chat-settings-section-title" style="margin:0;"><i class="fa-solid fa-lock" style="color:#f8b4b4;margin-right:4px;"></i>专属字卡分组<span class="cs-words-count cs-words-count-private" id="csPrivateCount">0</span></div></div>',
      '        <div class="cs-words-hint">勾选的分组视为"当前联系人专属字卡"，只有当前角色能抽取</div>',
      '        <div class="cs-group-list" id="csPrivateGroupList"></div>',
      '      </div>',
      '      <div class="chat-settings-section">',
      '        <div class="cs-words-header"><div class="chat-settings-section-title" style="margin:0;"><i class="fa-regular fa-face-smile" style="color:#7ED3A8;margin-right:4px;"></i>颜文字字卡<span class="cs-words-count" id="csEmojiGroupCount" style="background:#e6f5ed;color:#4CAF7D;">0</span></div></div>',
      '        <div class="cs-words-hint">勾选的字卡分组会加入自动回复的颜文字池</div>',
      '        <div class="cs-group-list" id="csEmojiGroupList"></div>',
      '      </div>',
      '      <div class="chat-settings-section">',
      '        <div class="cs-words-header"><div class="chat-settings-section-title" style="margin:0;"><i class="fa-regular fa-image" style="color:#B78BEA;margin-right:4px;"></i>表情包字卡<span class="cs-words-count" id="csStickerGroupCount" style="background:#f0eaf9;color:#8b6bd1;">0</span></div></div>',
      '        <div class="cs-words-hint">勾选的字卡分组会加入自动回复的表情包池</div>',
      '        <div class="cs-group-list" id="csStickerGroupList"></div>',
      '      </div>',
      '    </div>',

      // Tab 3
      '    <div class="chat-settings-tab-panel" data-panel="data">',

      // 区块一：本机存储
      '      <div class="chat-settings-section">',
      '        <div class="chat-settings-section-title">本机存储</div>',
      '        <div class="ds-storage-progress-wrap">',
      '          <div class="ds-storage-progress-bar">',
      '            <div class="ds-storage-progress-fill" style="width: 1%;"></div>',
      '          </div>',
      '          <div class="ds-storage-progress-text">本机快取已用 <strong>35KB</strong> / 约 5MB（1%）</div>',
      '        </div>',
      '        <div class="ds-storage-card">',
      '          <div class="ds-storage-card-title"><i class="fa-solid fa-database"></i> 大容量库</div>',
      '          <div class="ds-storage-card-desc">聊天记录、表情包、字卡、头像等数据保存在「大容量库」（IndexedDB）</div>',
      '          <div class="ds-storage-card-usage">已用 <strong>247KB</strong> · 可用 <strong>38.4GB</strong></div>',
      '        </div>',
      '        <button class="ds-btn ds-btn-primary ds-btn-full" id="dsCleanCacheBtn">',
      '          <i class="fa-solid fa-broom"></i> 一键整理快取',
      '        </button>',
      '        <div class="ds-btn-hint">不动任何聊天 / 图片</div>',
      '      </div>',

      // 区块二：数据
      '      <div class="chat-settings-section">',
      '        <div class="chat-settings-section-title">数据</div>',
      '        <button class="ds-btn ds-btn-default ds-btn-full" id="dsExportDataBtn">',
      '          <i class="fa-solid fa-file-export"></i> 导出数据...',
      '          <span class="ds-btn-sub">（可勾选内容）</span>',
      '        </button>',
      '        <button class="ds-btn ds-btn-default ds-btn-full" id="dsImportDataBtn">',
      '          <i class="fa-solid fa-file-import"></i> 导入数据',
      '        </button>',
      '        <button class="ds-btn ds-btn-default ds-btn-full" id="dsRollbackBtn">',
      '          <i class="fa-solid fa-clock-rotate-left"></i> 回滚到最近一次正常存档',
      '        </button>',
      '        <button class="ds-btn ds-btn-danger ds-btn-full" id="dsClearChatBtn">',
      '          <i class="fa-solid fa-trash-can"></i> 清空全部聊天记录',
      '        </button>',
      '        <button class="ds-btn ds-btn-danger ds-btn-full" id="dsResetCardLibraryBtn">',
      '          <i class="fa-solid fa-rotate-left"></i> 恢复默认字卡库',
      '        </button>',
      '        <div class="ds-footer-hint">',
      '          「导出数据」里可以分别勾选字卡（含分组 / 表情包 / 拍一拍）和聊天记录（单人 / 群聊），也可以一键全部导出。',
      '        </div>',
      '      </div>',

      // 区块三：通知
      '      <div class="chat-settings-section">',
      '        <div class="chat-settings-section-title">有消息，轻轻告诉你</div>',
      '        <div class="ds-notify-block">',
      '          <div class="ds-notify-label">手机系统通知</div>',
      '          <div class="ds-notify-desc">iPhone 请先用 Safari 添加到主屏幕，再从主屏打开，即可开启系统推送通知。</div>',
      '          <button class="ds-btn ds-btn-soft ds-btn-full" id="dsAllowNotifyBtn">',
      '            <i class="fa-solid fa-bell"></i> 允许手机系统通知',
      '          </button>',
      '        </div>',
      '        <div class="ds-divider"></div>',
      '        <div class="ds-switch-row">',
      '          <div class="ds-switch-info">',
      '            <div class="ds-switch-title">站内消息横幅</div>',
      '            <div class="ds-switch-desc">收到他的回复时，在聊天页以外显示</div>',
      '          </div>',
      '          <label class="ds-toggle">',
      '            <input type="checkbox" id="dsBannerToggle" checked>',
      '            <span class="ds-toggle-slider"></span>',
      '          </label>',
      '        </div>',
      '        <div class="ds-switch-row">',
      '          <div class="ds-switch-info">',
      '            <div class="ds-switch-title">显示消息内容</div>',
      '            <div class="ds-switch-desc">关闭后只显示「你收到了一条新消息」</div>',
      '          </div>',
      '          <label class="ds-toggle">',
      '            <input type="checkbox" id="dsShowContentToggle" checked>',
      '            <span class="ds-toggle-slider"></span>',
      '          </label>',
      '        </div>',
      '        <div class="ds-switch-row">',
      '          <div class="ds-switch-info">',
      '            <div class="ds-switch-title">允许他随机来电</div>',
      '            <div class="ds-switch-desc">可能很快来电... 仅模拟角色来电</div>',
      '          </div>',
      '          <label class="ds-toggle">',
      '            <input type="checkbox" id="dsRandomCallToggle">',
      '            <span class="ds-toggle-slider"></span>',
      '          </label>',
      '        </div>',
      '        <div class="ds-divider"></div>',
      '        <div class="ds-notify-block">',
      '          <div class="ds-notify-label">后台保活 · 静音循环</div>',
      '          <div class="ds-notify-desc" id="dsSilentLoopDesc">静音循环未开启</div>',
      '          <button class="ds-btn ds-btn-soft ds-btn-full" id="dsSilentLoopBtn">',
      '            <i class="fa-solid fa-circle-play"></i> 开启静音循环',
      '          </button>',
      '        </div>',
      '        <div class="ds-footer-hint">',
      '          iOS 仍可能暂停网页或回收进程，建议保留在主屏幕打开。',
      '        </div>',
      '      </div>',

      '    </div>',

      '  </div>',
      '</div>'
    ].join('');

    document.body.appendChild(panel);
    bindPanelEvents();
    renderThemeColors();
    renderBubbleStyles();
    updateNotifyUI();
  }

  var PRESET_COLORS = [
    { name: '红', value: '#F05A5A' },
    { name: '橙', value: '#F5A623' },
    { name: '黄', value: '#FFD54F' },
    { name: '绿', value: '#7ED3A8' },
    { name: '蓝', value: '#6FB1E8' },
    { name: '紫', value: '#B78BEA' },
    { name: '粉', value: '#F8B4B4' },
    { name: '黑', value: '#333333' },
    { name: '白', value: '#FFFFFF' }
  ];

  function renderThemeColors() {
    var container = document.getElementById('csThemeColors');
    if (!container) return;
    container.innerHTML = '';
    PRESET_COLORS.forEach(function (c) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cs-theme-color-btn' + (c.value.toLowerCase() === theme.accentColor.toLowerCase() ? ' active' : '');
      btn.style.background = c.value;
      btn.setAttribute('data-color', c.value);
      btn.title = c.name;
      if (c.value === '#FFFFFF') btn.style.border = '1px solid #e2e8ee';
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        theme.accentColor = c.value;
        persistTheme();
        applyTheme();
        renderThemeColors();
        var valEl = document.getElementById('csCustomColorValue');
        if (valEl) valEl.textContent = c.value;
        var picker = document.getElementById('csCustomColorInput');
        if (picker) picker.value = c.value;
      });
      container.appendChild(btn);
    });
  }

  function renderBubbleStyles() {
    var container = document.getElementById('csBubbleStyles');
    if (!container) return;
    container.querySelectorAll('.cs-bubble-btn').forEach(function (btn) {
      var style = btn.getAttribute('data-style');
      btn.classList.toggle('active', style === bubble.style);
    });
  }

  function fillPanelValues() {
    var valEl = document.getElementById('csCustomColorValue');
    if (valEl) valEl.textContent = theme.accentColor;
    var picker = document.getElementById('csCustomColorInput');
    if (picker) picker.value = theme.accentColor;
    renderThemeColors();

    var slider = document.getElementById('csFontSizeSlider');
    var sizeVal = document.getElementById('csFontSizeValue');
    if (slider) {
      slider.value = font.size;
      if (sizeVal) sizeVal.textContent = font.size + 'px';
    }
    var fontSelect = document.getElementById('csFontSelect');
    if (fontSelect) fontSelect.value = font.family;
    var fontUrlInput = document.getElementById('csFontUrlInput');
    if (fontUrlInput) fontUrlInput.value = font.customUrl || '';
    renderBubbleStyles();
    var cssInput = document.getElementById('csCustomCssInput');
    if (cssInput) cssInput.value = bubble.customCss || '';

    updateNotifyUI();
  }

  function bindPanelEvents() {
    var panel = document.getElementById('chatSettingsPanel');
    if (!panel) return;

    var closeBtn = document.getElementById('chatSettingsClose');
    if (closeBtn) closeBtn.addEventListener('click', closePanel);
    panel.addEventListener('click', function (e) {
      if (e.target === panel) closePanel();
    });

    panel.querySelectorAll('.chat-settings-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        var target = tab.getAttribute('data-tab');
        if (!target) return;
        activeTab = target;
        switchTab(target);
        persistTab();
      });
    });

    // ============ 外观与界面 ============
    var customColorInput = document.getElementById('csCustomColorInput');
    if (customColorInput) {
      customColorInput.addEventListener('input', function () {
        theme.accentColor = customColorInput.value;
        var valEl = document.getElementById('csCustomColorValue');
        if (valEl) valEl.textContent = customColorInput.value;
        persistTheme();
        applyTheme();
        renderThemeColors();
      });
      customColorInput.addEventListener('change', function () {
        theme.accentColor = customColorInput.value;
        persistTheme();
        applyTheme();
      });
    }

    var fontSizeSlider = document.getElementById('csFontSizeSlider');
    var fontSizeValue = document.getElementById('csFontSizeValue');
    if (fontSizeSlider) {
      fontSizeSlider.addEventListener('input', function () {
        var val = parseInt(fontSizeSlider.value, 10);
        font.size = val;
        if (fontSizeValue) fontSizeValue.textContent = val + 'px';
        applyFont();
      });
      fontSizeSlider.addEventListener('change', function () { persistFont(); });
    }

    var fontSelect = document.getElementById('csFontSelect');
    if (fontSelect) {
      fontSelect.addEventListener('change', function () {
        font.family = fontSelect.value;
        persistFont();
        applyFont();
        if (font.customUrl) applyFontUrl();
      });
    }

    var fontUrlInput = document.getElementById('csFontUrlInput');
    var fontUrlApply = document.getElementById('csFontUrlApply');
    if (fontUrlApply && fontUrlInput) {
      fontUrlApply.addEventListener('click', function () {
        var url = fontUrlInput.value.trim();
        if (!url) { alert('请输入字体 CSS 链接'); return; }
        if (!/^https?:\/\//i.test(url)) { alert('请输入完整链接（以 http:// 或 https:// 开头）'); return; }
        font.customUrl = url;
        font.family = 'custom';
        persistFont();
        applyFontUrl();
        applyCustomFontFamily();
        var fs = document.getElementById('csFontSelect');
        if (fs) fs.value = 'custom';
      });
    }

    var bubbleStyles = document.getElementById('csBubbleStyles');
    if (bubbleStyles) {
      bubbleStyles.addEventListener('click', function (e) {
        var btn = e.target.closest('.cs-bubble-btn');
        if (!btn) return;
        var style = btn.getAttribute('data-style');
        if (!style) return;
        bubble.style = style;
        persistBubble();
        applyBubble();
        renderBubbleStyles();
      });
    }

    var cssApply = document.getElementById('csCssApply');
    var cssClear = document.getElementById('csCssClear');
    var cssReset = document.getElementById('csCssReset');
    var cssInput = document.getElementById('csCustomCssInput');

    if (cssApply && cssInput) {
      cssApply.addEventListener('click', function () {
        var cssText = cssInput.value || '';
        bubble.customCss = cssText;
        persistBubble();
        applyCustomCss();
      });
    }
    if (cssClear) {
      cssClear.addEventListener('click', function () {
        if (cssInput) cssInput.value = '';
        clearCustomCss();
      });
    }
    if (cssReset) {
      cssReset.addEventListener('click', function () {
        if (cssInput) cssInput.value = '';
        bubble.customCss = '';
        bubble.style = 'standard';
        persistBubble();
        clearCustomCss();
        applyBubble();
        renderBubbleStyles();
      });
    }

    // ============ 数据与工具：导出/导入 ============
    var exportBtn = document.getElementById('dsExportDataBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', function () { openExportPanel(); });
    }
    var importBtn = document.getElementById('dsImportDataBtn');
    if (importBtn) {
      importBtn.addEventListener('click', function () { doImport(); });
    }

    // ============ 数据与工具：通知/保活 ============

    // 1. 允许手机系统通知
    var allowNotifyBtn = document.getElementById('dsAllowNotifyBtn');
    if (allowNotifyBtn) {
      allowNotifyBtn.addEventListener('click', function () {
        requestNotificationPermission();
      });
    }

    // 2. 站内消息横幅开关
    var bannerToggle = document.getElementById('dsBannerToggle');
    if (bannerToggle) {
      bannerToggle.addEventListener('change', function () {
        notifyState.bannerEnabled = bannerToggle.checked;
        persistNotifyState();
        console.log('[通知] 站内消息横幅:', notifyState.bannerEnabled ? '开启' : '关闭');
      });
    }

    // 3. 显示消息内容开关
    var showContentToggle = document.getElementById('dsShowContentToggle');
    if (showContentToggle) {
      showContentToggle.addEventListener('change', function () {
        notifyState.showContent = showContentToggle.checked;
        persistNotifyState();
        console.log('[通知] 显示消息内容:', notifyState.showContent ? '开启' : '关闭');
      });
    }

    // 4. 允许他随机来电开关
    var randomCallToggle = document.getElementById('dsRandomCallToggle');
    if (randomCallToggle) {
      randomCallToggle.addEventListener('change', function () {
        notifyState.randomCall = randomCallToggle.checked;
        persistNotifyState();
        console.log('[来电] 允许他随机来电:', notifyState.randomCall ? '开启' : '关闭');
      });
    }

    // 5. 静音循环开关
    var silentLoopBtn = document.getElementById('dsSilentLoopBtn');
    if (silentLoopBtn) {
      silentLoopBtn.addEventListener('click', function () {
        if (notifyState.silentLoop) {
          // 关闭
          stopSilentLoop();
          notifyState.silentLoop = false;
          persistNotifyState();
          updateNotifyUI();
        } else {
          // 开启
          var ok = startSilentLoop();
          if (ok) {
            notifyState.silentLoop = true;
            persistNotifyState();
            updateNotifyUI();
          } else {
            alert('静音循环启动失败，可能是浏览器不支持');
          }
        }
      });
    }

    bindChatTabEvents();
  }

  function bindModeSwitch() {
    var switchEl = document.getElementById('csModeSwitch');
    if (!switchEl) return;
    if (switchEl.dataset.bound) return;
    switchEl.dataset.bound = '1';
    switchEl.addEventListener('click', function (e) {
      var btn = e.target.closest('.cs-mode-btn');
      if (!btn) return;
      var mode = btn.getAttribute('data-mode');
      if (!mode) return;
      cardMode = mode;
      persistCardMode();
      switchEl.querySelectorAll('.cs-mode-btn').forEach(function (b) {
        b.classList.toggle('active', b.getAttribute('data-mode') === mode);
      });
      updateModeHint();
    });
  }

  function updateModeHint() {
    var hintEl = document.getElementById('csModeHint');
    if (!hintEl) return;
    if (cardMode === 'public-only') hintEl.textContent = '自动回复时只从勾选为公共的分组中抽取';
    else if (cardMode === 'private-only') hintEl.textContent = '自动回复时只从勾选为专属的分组中抽取';
    else hintEl.textContent = '自动回复时 50% 从公共分组抽取，50% 从专属分组抽取';
  }

  function restoreModeSwitch() {
    var switchEl = document.getElementById('csModeSwitch');
    if (!switchEl) return;
    switchEl.querySelectorAll('.cs-mode-btn').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-mode') === cardMode);
    });
    updateModeHint();
  }

  function renderAllGroupLists() {
    renderReplyGroupLists();
    renderEmojiGroupList();
    renderStickerGroupList();
    updateAllGroupCounts();
  }

  function renderReplyGroupLists() {
    var publicList = document.getElementById('csPublicGroupList');
    var privateList = document.getElementById('csPrivateGroupList');
    if (!publicList || !privateList) return;
    var groups = (typeof window.getGroups === 'function') ? window.getGroups('reply') : [];
    if (groups.length === 0) {
      publicList.innerHTML = '<div class="cs-words-empty">还没有字卡分组，先去字卡收纳盒创建吧~</div>';
      privateList.innerHTML = '<div class="cs-words-empty">还没有字卡分组，先去字卡收纳盒创建吧~</div>';
      return;
    }
    publicList.innerHTML = '';
    privateList.innerHTML = '';
    groups.forEach(function (name) {
      publicList.appendChild(createGroupCheckboxItem(name, 'reply', 'public'));
      privateList.appendChild(createGroupCheckboxItem(name, 'reply', 'private'));
    });
  }

  function renderEmojiGroupList() {
    var list = document.getElementById('csEmojiGroupList');
    if (!list) return;
    var groups = (typeof window.getGroups === 'function') ? window.getGroups('kaomoji') : [];
    if (groups.length === 0) {
      list.innerHTML = '<div class="cs-words-empty">还没有颜文字分组，先去字卡收纳盒创建吧~</div>';
      return;
    }
    list.innerHTML = '';
    groups.forEach(function (name) {
      list.appendChild(createGroupCheckboxItem(name, 'kaomoji', 'emoji'));
    });
  }

  function renderStickerGroupList() {
    var list = document.getElementById('csStickerGroupList');
    if (!list) return;
    var stickerArr = (window.cardDatabase && window.cardDatabase.get)
      ? (window.cardDatabase.get('sticker') || []) : [];
    if (stickerArr.length === 0) {
      list.innerHTML = '<div class="cs-words-empty">还没有表情包，先去字卡收纳盒添加吧~</div>';
      return;
    }
    list.innerHTML = '';
    list.appendChild(createGroupCheckboxItem('表情包（全部）', 'sticker', 'sticker'));
  }

  function createGroupCheckboxItem(groupName, category, type) {
    var item = document.createElement('div');
    item.className = 'cs-group-item';
    var isChecked = false;
    if (type === 'public') isChecked = publicGroups.indexOf(groupName) >= 0;
    else if (type === 'private') isChecked = privateGroups.indexOf(groupName) >= 0;
    else if (type === 'emoji') isChecked = emojiGroups.indexOf(groupName) >= 0;
    else if (type === 'sticker') isChecked = stickerGroups.indexOf(groupName) >= 0;
    if (isChecked) item.classList.add('checked');

    var color = '#5C7CFA';
    if (typeof window.getGroupColor === 'function') color = window.getGroupColor(groupName, category);

    var count = 0;
    if (category === 'sticker') {
      count = (window.cardDatabase && window.cardDatabase.get)
        ? (window.cardDatabase.get('sticker') || []).length : 0;
    } else {
      if (typeof window.getCardsInGroup === 'function') {
        count = window.getCardsInGroup(groupName, category).length;
      }
    }

    item.innerHTML =
      '<label class="cs-group-checkbox">' +
      '  <input type="checkbox" data-group="' + escapeAttr(groupName) + '" data-type="' + type + '" data-cat="' + category + '"' + (isChecked ? ' checked' : '') + '>' +
      '  <span class="cs-group-check-mark"><i class="fa-solid fa-check"></i></span>' +
      '</label>' +
      '<span class="cs-group-color-dot" style="background:' + color + '"></span>' +
      '<div class="cs-group-info">' +
      '  <div class="cs-group-name">' + escapeHtml(groupName) + '</div>' +
      '  <div class="cs-group-count">' + count + ' 条</div>' +
      '</div>';

    var checkbox = item.querySelector('input[type="checkbox"]');
    checkbox.addEventListener('change', function () {
      handleGroupCheckboxChange(groupName, type, checkbox.checked, item);
    });
    item.addEventListener('click', function (e) {
      if (e.target.closest('.cs-group-checkbox')) return;
      checkbox.checked = !checkbox.checked;
      handleGroupCheckboxChange(groupName, type, checkbox.checked, item);
    });
    return item;
  }

  function handleGroupCheckboxChange(groupName, type, checked, itemEl) {
    var targetArr = null;
    if (type === 'public') targetArr = publicGroups;
    else if (type === 'private') targetArr = privateGroups;
    else if (type === 'emoji') targetArr = emojiGroups;
    else if (type === 'sticker') targetArr = stickerGroups;
    if (!targetArr) return;

    var idx = targetArr.indexOf(groupName);
    if (checked && idx < 0) targetArr.push(groupName);
    else if (!checked && idx >= 0) targetArr.splice(idx, 1);
    if (itemEl) itemEl.classList.toggle('checked', checked);
    persistGroupSelections();
    updateAllGroupCounts();
    if (typeof window.refreshCardUI === 'function') window.refreshCardUI();
  }

  function updateAllGroupCounts() {
    var pubCount = document.getElementById('csPublicCount');
    var priCount = document.getElementById('csPrivateCount');
    var emoCount = document.getElementById('csEmojiGroupCount');
    var stiCount = document.getElementById('csStickerGroupCount');
    if (pubCount) pubCount.textContent = publicGroups.length;
    if (priCount) priCount.textContent = privateGroups.length;
    if (emoCount) emoCount.textContent = emojiGroups.length;
    if (stiCount) stiCount.textContent = stickerGroups.length;
  }

  function bindChatTabEvents() { bindModeSwitch(); }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }
  function escapeAttr(str) {
    if (!str) return '';
    return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function switchTab(tabName) {
    var panel = document.getElementById('chatSettingsPanel');
    if (!panel) return;
    if (tabName === 'profile' || !tabName) {
      tabName = 'appearance';
      activeTab = 'appearance';
    }
    panel.querySelectorAll('.chat-settings-tab').forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-tab') === tabName);
    });
    panel.querySelectorAll('.chat-settings-tab-panel').forEach(function (p) {
      p.classList.toggle('active', p.getAttribute('data-panel') === tabName);
    });
    if (tabName === 'appearance') fillPanelValues();
    if (tabName === 'chat') { restoreModeSwitch(); renderAllGroupLists(); }
    if (tabName === 'data') updateNotifyUI();
  }

  function openPanel() {
    createPanel();
    var panel = document.getElementById('chatSettingsPanel');
    if (!panel) return;
    switchTab(activeTab);
    fillPanelValues();
    updateNotifyUI();
    panel.classList.add('active');
  }
  function closePanel() {
    var panel = document.getElementById('chatSettingsPanel');
    if (panel) panel.classList.remove('active');
  }

  function init() {
    ensureCustomCssStyleTag();
    createPanel();
    bindSettingsTrigger();

    loadTab(function () {
      loadTheme(function () {
        loadFont(function () {
          loadBubble(function () {
            loadCardMode(function () {
              window.chatCardMode = cardMode;
              loadGroupSelections(function () {
                loadNotifyState(function () {
                  applyTheme();
                  applyFont();
                  applyFontUrl();
                  applyBubble();
                  if (bubble.customCss) applyCustomCss();
                  fillPanelValues();
                  updateNotifyUI();
                  switchTab(activeTab);

                  // 如果之前开启了静音循环，自动恢复
                  if (notifyState.silentLoop) {
                    var ok = startSilentLoop();
                    if (!ok) {
                      notifyState.silentLoop = false;
                      persistNotifyState();
                      updateNotifyUI();
                    }
                  }
                });
              });
            });
          });
        });
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  setTimeout(bindSettingsTrigger, 300);
  setTimeout(bindSettingsTrigger, 800);
  setTimeout(bindSettingsTrigger, 1500);
  setTimeout(bindSettingsTrigger, 3000);

  window.chatSettingsPanel = {
    open: openPanel,
    close: closePanel,
    switchTab: switchTab,
    applyTheme: applyTheme,
    applyFont: applyFont,
    applyFontUrl: applyFontUrl,
    applyCustomFontFamily: applyCustomFontFamily,
    applyBubble: applyBubble,
    applyCustomCss: applyCustomCss,
    clearCustomCss: clearCustomCss,
    ensureCustomCssStyleTag: ensureCustomCssStyleTag,
    applyAll: applyAll,
    refreshGroupCheckboxes: renderAllGroupLists,
    refreshGroupLists: renderAllGroupLists,
    exportData: openExportPanel,
    importData: doImport,
    // 暴露通知状态
    getNotifyState: function () { return notifyState; },
    requestNotification: requestNotificationPermission,
    startSilentLoop: startSilentLoop,
    stopSilentLoop: stopSilentLoop
  };

  window.setCustomBubbleCss = function (cssText) {
    bubble.customCss = cssText || '';
    persistBubble();
    applyCustomCss();
    return '已注入，长度 ' + (cssText || '').length;
  };

  /* ============ 消息时间戳开关 ============ */
(function () {
  var toggle = document.getElementById('toggleShowMessageTime');
  if (!toggle) return;

  // 初始化状态
  var show = true;
  try {
    var v = localStorage.getItem('show_message_time');
    if (v === '0') show = false;
  } catch (e) {}
  toggle.checked = show;

  // 切换
  toggle.addEventListener('change', function () {
    var val = toggle.checked ? '1' : '0';
    try { localStorage.setItem('show_message_time', val); } catch (e) {}
    if (typeof window.applyChatTimeDisplay === 'function') {
      window.applyChatTimeDisplay();
    }
  });
})();
  
})();
