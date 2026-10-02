/**
 * 传讯页面 - 设置面板（修复版）
 * 修复：
 *  1. FontAwesome 图标不再被全局字体覆盖
 *  2. 主题色只改强调色，不改页面背景
 *  3. 字体大小只影响文字，不影响图标
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

  // ==================== 状态 ====================
  var activeTab = 'profile';
  var theme = { accentColor: '#6fb1e8' };
  var font = { size: 14, family: 'system', customUrl: '' };
  var bubble = { style: 'standard', customCss: '' };
  var cardMode = 'all';
  var publicGroups = [];
  var privateGroups = [];
  var emojiGroups = [];
  var stickerGroups = [];
  var settingsTrigger = null;

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
  function loadTab(cb) { loadValue(STORE_KEY_TAB, function (v) { if (v) activeTab = v; cb(); }); }
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

  // ==================== 【修复 1+2】主题：只改强调色，不改背景 ====================
  function applyTheme() {
    var root = document.documentElement;
    var color = theme.accentColor || '#6fb1e8';
    var colorLight = rgba(color, 0.15);
    var colorSoft = rgba(color, 0.25);
    var colorDark = darken(color, 40);

    // 只写强调色相关变量，绝对不写 --primary-bg / --secondary-bg
    root.style.setProperty('--accent-color', color);
    root.style.setProperty('--accent-color-light', colorLight);
    root.style.setProperty('--accent-color-soft', colorSoft);
    root.style.setProperty('--accent-color-dark', colorDark);

    // 注入主题 style 标签
    var styleId = 'global-theme-vars';
    var styleEl = document.getElementById(styleId);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    styleEl.textContent = [
      /* 主页 —— 只改强调色，不碰背景 */
      '#pageHome .play-btn {',
      '  background: ' + color + ' !important;',
      '  box-shadow: 0 3px 10px ' + rgba(color, 0.35) + ' !important;',
      '}',
      '#pageHome .tab-btn.active i,',
      '#pageHome .tab-btn.active span { color: ' + color + ' !important; }',
      '#pageHome .tab-btn.active { color: ' + color + ' !important; }',
      '#pageHome .function-icon i { color: ' + colorDark + ' !important; }',
      '#pageHome .search-glass i { color: ' + color + ' !important; }',

      /* 字卡库 —— 只改强调色 */
      '#pageCard .cat-grid-item.active {',
      '  background: ' + colorLight + ' !important;',
      '  border-color: ' + color + ' !important;',
      '}',
      '#pageCard .cat-grid-item.active i,',
      '#pageCard .cat-grid-item.active .cat-label { color: ' + colorDark + ' !important; }',
      '#pageCard .word-card-delete {',
      '  background: ' + colorLight + ' !important;',
      '  color: ' + colorDark + ' !important;',
      '}',
      '#pageCard .card-action-btn i { color: ' + color + ' !important; }',
      '#pageCard .cat-grid-badge { background: ' + color + ' !important; }',

      /* 传讯页 */
      '#pageChat .send-btn {',
      '  background: ' + color + ' !important;',
      '  box-shadow: 0 3px 10px ' + rgba(color, 0.35) + ' !important;',
      '}',
      '#pageChat .send-btn:active { background: ' + colorDark + ' !important; }',
      '#pageChat .chat-action-icon { color: ' + rgba(color, 0.75) + ' !important; }',
      '#pageChat .chat-action-icon:active { color: ' + color + ' !important; }',
      '#pageChat .message-row.self .message-bubble { background: ' + colorSoft + ' !important; }',

      /* 设置面板 */
      '#chatSettingsPanel .chat-settings-tab.active {',
      '  background: ' + colorLight + ' !important;',
      '  color: ' + colorDark + ' !important;',
      '}',
      '#chatSettingsPanel .chat-settings-title i { color: ' + color + ' !important; }',
      '#chatSettingsPanel .cs-mode-btn.active { color: ' + colorDark + ' !important; }',
      '#chatSettingsPanel .cs-words-btn i { color: ' + color + ' !important; }',
      '#chatSettingsPanel .cs-group-checkbox input:checked + .cs-group-check-mark {',
      '  background: ' + color + ' !important;',
      '  border-color: ' + color + ' !important;',
      '}',
      '#chatSettingsPanel .cs-css-apply {',
      '  background: ' + color + ' !important;',
      '  border-color: ' + color + ' !important;',
      '}',
      '#chatSettingsPanel .cs-font-url-apply { background: ' + colorDark + ' !important; }',

      /* 全局强调（不涉及背景） */
      '.home-settings-btn i, .floating-settings i { color: ' + color + ' !important; }'
    ].join('\n');

    // 底部导航激活色
    document.querySelectorAll('.tab-btn.active i, .tab-btn.active span').forEach(function (el) {
      el.style.color = color;
    });

    var sendBtn = document.getElementById('sendBtn');
    if (sendBtn) {
      sendBtn.style.background = color;
      sendBtn.style.boxShadow = '0 3px 10px ' + rgba(color, 0.35);
    }
  }

  // ==================== 【修复 1】字体：不覆盖 FontAwesome ====================
  function applyFont() {
    var root = document.documentElement;
    var body = document.body;
    var size = font.size || 14;

    // ---- 1. 全局字号变量 ----
    root.style.setProperty('--global-font-size', size + 'px');
    root.style.setProperty('--chat-font-size', size + 'px');

    // ---- 2. 字号覆盖：只作用于文字元素，绝对不包含 i.fa-* ----
    var styleId = 'global-font-vars';
    var styleEl = document.getElementById(styleId);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    var uiSize = Math.min(size, 16);

    styleEl.textContent = [
      /* 聊天消息 */
      '#pageChat .message-bubble,',
      '#pageChat .message-text { font-size: ' + size + 'px !important; }',
      '#pageChat .call-record-bubble { font-size: ' + Math.max(10, size - 3) + 'px !important; }',

      /* 主页文字（不含 i 图标） */
      '#pageHome .function-label { font-size: ' + Math.max(10, uiSize - 4) + 'px !important; }',
      '#pageHome h1, #pageHome .header-card h1 { font-size: ' + (uiSize + 4) + 'px !important; }',
      '#pageHome .header-card p { font-size: ' + Math.max(10, uiSize - 2) + 'px !important; }',
      '#pageHome .tab-btn span { font-size: ' + Math.max(10, uiSize - 4) + 'px !important; }',
      '#pageHome .search-glass input { font-size: ' + uiSize + 'px !important; }',
      '#pageHome #songTitle { font-size: ' + uiSize + 'px !important; }',
      '#pageHome #songArtist { font-size: ' + Math.max(10, uiSize - 4) + 'px !important; }',

      /* 字卡库文字（不含 i 图标） */
      '#pageCard .card-topbar-title { font-size: ' + (uiSize + 3) + 'px !important; }',
      '#pageCard .cat-label { font-size: ' + Math.max(10, uiSize - 3) + 'px !important; }',
      '#pageCard .card-action-btn span { font-size: ' + Math.max(10, uiSize - 2) + 'px !important; }',
      '#pageCard .card-group-btn { font-size: ' + Math.max(10, uiSize - 3) + 'px !important; }',
      '#pageCard .card-search-input { font-size: ' + uiSize + 'px !important; }',
      '#pageCard .word-card-text { font-size: ' + uiSize + 'px !important; }',
      '#pageCard .card-group-select { font-size: ' + uiSize + 'px !important; }',
      '#pageCard .card-status-counts { font-size: ' + Math.max(10, uiSize - 3) + 'px !important; }',

      /* 设置面板文字（不含 i 图标） */
      '#chatSettingsPanel .chat-settings-title span { font-size: ' + (uiSize + 2) + 'px !important; }',
      '#chatSettingsPanel .chat-settings-tab span { font-size: ' + Math.max(10, uiSize - 3) + 'px !important; }',
      '#chatSettingsPanel .chat-settings-section-title { font-size: ' + Math.max(10, uiSize - 2) + 'px !important; }',
      '#chatSettingsPanel .cs-group-name { font-size: ' + uiSize + 'px !important; }',
      '#chatSettingsPanel .cs-group-count { font-size: ' + Math.max(10, uiSize - 3) + 'px !important; }',

      /* ============ 【核心修复】强制恢复 FontAwesome 图标字体 ============ */
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

    // ---- 3. 直接应用聊天气泡字号（双保险） ----
    document.querySelectorAll('#pageChat .message-bubble, #pageChat .message-text').forEach(function (el) {
      el.style.fontSize = size + 'px';
    });

    // ---- 4. 字体族：只作用于 body 和文字元素，不碰图标 ----
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
      fontFamily = '"CustomFont", "PingFang SC", "Microsoft YaHei", sans-serif';
    }

    if (fontFamily) {
      // 只设置 body 的 fontFamily（不加 !important，避免污染子元素）
      body.style.fontFamily = fontFamily;

      // 注入字体样式：只作用于文字元素，明确排除 FontAwesome
      var fontStyleId = 'global-font-family';
      var fontStyleEl = document.getElementById(fontStyleId);
      if (!fontStyleEl) {
        fontStyleEl = document.createElement('style');
        fontStyleEl.id = fontStyleId;
        document.head.appendChild(fontStyleEl);
      }

      // 【核心】使用 :not([class*="fa-"]) 排除 FontAwesome 图标
      fontStyleEl.textContent = [
        'body { font-family: ' + fontFamily + ' !important; }',
        // 只对没有 fa- 类的元素应用字体
        'h1, h2, h3, h4, h5, h6, p, span, div, a, button, input, textarea, select, label {',
        '  font-family: ' + fontFamily + ' !important;',
        '}',
        // 强制恢复图标字体（优先级更高）
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
    if (!font.customUrl || font.family !== 'custom') return;

    var link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    link.href = font.customUrl;
    link.onload = function () { applyFont(); };
    link.onerror = function () {
      console.warn('[chat-settings-panel] 字体加载失败:', font.customUrl);
    };
    document.head.appendChild(link);
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
  function applyCustomCss() {
    var styleId = 'custom-bubble-css';
    var existing = document.getElementById(styleId);
    if (existing) existing.remove();
    if (!bubble.customCss || !bubble.customCss.trim()) return;

    var style = document.createElement('style');
    style.id = styleId;
    style.textContent = scopeCssToPageChat(bubble.customCss);
    document.head.appendChild(style);
  }

  function scopeCssToPageChat(css) {
    if (!css) return '';
    var hasScope = css.indexOf('#pageChat') >= 0;
    var result = [];
    var regex = /([^{}]+)\{([^{}]*)\}/g;
    var m, lastIndex = 0;
    while ((m = regex.exec(css)) !== null) {
      var selectors = m[1].trim();
      var body = m[2];
      if (selectors && selectors.charAt(0) !== '@') {
        var prefixed = selectors.split(',').map(function (sel) {
          sel = sel.trim();
          if (!sel) return sel;
          if (hasScope) return sel;
          return '#pageChat ' + sel;
        }).join(', ');
        var enhancedBody = body.replace(/([a-zA-Z-]+)\s*:\s*([^;!}]+)(?=\s*[;}])/g, function (_, prop, val) {
          if (val.indexOf('!important') >= 0) return _;
          var skipProps = ['animation', 'transition', 'transform-origin', 'content', 'display', 'position'];
          if (skipProps.indexOf(prop.trim()) >= 0) return _;
          return prop + ': ' + val.trim() + ' !important';
        });
        result.push(prefixed + ' {' + enhancedBody + '}');
      } else {
        result.push(m[0]);
      }
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < css.length) {
      var tail = css.slice(lastIndex);
      if (tail.trim()) result.push(tail);
    }
    return result.join('\n');
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
      '  <div class="chat-settings-tabs" id="chatSettingsTabs">',
      '    <button class="chat-settings-tab" data-tab="profile"><i class="fa-solid fa-user"></i><span>个人资料</span></button>',
      '    <button class="chat-settings-tab" data-tab="appearance"><i class="fa-solid fa-palette"></i><span>外观与界面</span></button>',
      '    <button class="chat-settings-tab" data-tab="chat"><i class="fa-solid fa-comments"></i><span>聊天与字卡</span></button>',
      '    <button class="chat-settings-tab" data-tab="data"><i class="fa-solid fa-database"></i><span>数据与工具</span></button>',
      '  </div>',
      '  <div class="chat-settings-body">',

      '    <div class="chat-settings-tab-panel" data-panel="profile">',
      '      <div class="chat-settings-section-title">个人资料</div>',
      '      <div class="chat-settings-placeholder"><i class="fa-solid fa-user"></i><p>修改我和对方的昵称、头像等</p></div>',
      '    </div>',

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
      '        <textarea class="cs-custom-css-input" id="csCustomCssInput" placeholder="/* 只影响传讯页气泡 */&#10;.message-bubble { box-shadow: 0 4px 12px rgba(0,0,0,0.1); }"></textarea>',
      '        <div class="cs-custom-css-actions">',
      '          <button class="cs-css-btn cs-css-apply" id="csCssApply">应用 CSS</button>',
      '          <button class="cs-css-btn cs-css-clear" id="csCssClear">清空</button>',
      '          <button class="cs-css-btn cs-css-reset" id="csCssReset">恢复默认</button>',
      '        </div>',
      '      </div>',
      '    </div>',

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

      '    <div class="chat-settings-tab-panel" data-panel="data">',
      '      <div class="chat-settings-section-title">数据与工具</div>',
      '      <div class="chat-settings-placeholder"><i class="fa-solid fa-database"></i><p>存钱罐、数据备份</p></div>',
      '    </div>',

      '  </div>',
      '</div>'
    ].join('');

    document.body.appendChild(panel);
    bindPanelEvents();
    renderThemeColors();
    renderBubbleStyles();
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
        applyFontUrl();
      });
    }

    var fontUrlInput = document.getElementById('csFontUrlInput');
    var fontUrlApply = document.getElementById('csFontUrlApply');
    if (fontUrlApply && fontUrlInput) {
      fontUrlApply.addEventListener('click', function () {
        var url = fontUrlInput.value.trim();
        if (!url) { alert('请输入字体 CSS 链接'); return; }
        font.customUrl = url;
        font.family = 'custom';
        persistFont();
        applyFontUrl();
        applyFont();
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
        bubble.customCss = cssInput.value;
        persistBubble();
        applyCustomCss();
      });
    }
    if (cssClear && cssInput) {
      cssClear.addEventListener('click', function () {
        cssInput.value = '';
        bubble.customCss = '';
        persistBubble();
        applyCustomCss();
      });
    }
    if (cssReset && cssInput) {
      cssReset.addEventListener('click', function () {
        cssInput.value = '';
        bubble.customCss = '';
        bubble.style = 'standard';
        persistBubble();
        applyCustomCss();
        applyBubble();
        renderBubbleStyles();
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
    panel.querySelectorAll('.chat-settings-tab').forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-tab') === tabName);
    });
    panel.querySelectorAll('.chat-settings-tab-panel').forEach(function (p) {
      p.classList.toggle('active', p.getAttribute('data-panel') === tabName);
    });
    if (tabName === 'appearance') fillPanelValues();
    if (tabName === 'chat') { restoreModeSwitch(); renderAllGroupLists(); }
  }

  function openPanel() {
    createPanel();
    var panel = document.getElementById('chatSettingsPanel');
    if (!panel) return;
    switchTab(activeTab);
    fillPanelValues();
    panel.classList.add('active');
  }
  function closePanel() {
    var panel = document.getElementById('chatSettingsPanel');
    if (panel) panel.classList.remove('active');
  }

  function init() {
    createPanel();
    bindSettingsTrigger();
    loadTab(function () {
      loadTheme(function () {
        loadFont(function () {
          loadBubble(function () {
            loadCardMode(function () {
              window.chatCardMode = cardMode;
              loadGroupSelections(function () {
                applyAll();
                fillPanelValues();
                switchTab(activeTab);
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
    applyBubble: applyBubble,
    applyCustomCss: applyCustomCss,
    applyAll: applyAll,
    refreshGroupCheckboxes: renderAllGroupLists,
    refreshGroupLists: renderAllGroupLists
  };

})();
