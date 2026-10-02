/**
 * 传讯页面 - 设置面板（独立模块）
 * - 绑定到底部导航栏现有的"设置"齿轮图标
 * - Tab 1：个人资料（占位）
 * - Tab 2：外观与界面（主题配色 + 文字设置 + 气泡样式 + 自定义 CSS）
 * - Tab 3：聊天与字卡（分组勾选模式）
 * - Tab 4：数据与工具（占位）
 * - 完全独立，不影响任何现有逻辑
 *
 * 本版改动：
 * 1. 全局主题通过 :root CSS 变量同步全站（主页、传讯、字卡库、设置面板）
 * 2. 字体大小同步到 .message-text / .message-bubble
 * 3. 自定义 CSS 使用固定 id="custom-css-style"，并自动加 #pageChat 前缀限定作用域
 * 4. 移除旧版 chat_settings_appearance（背景图/蒙层/毛玻璃）读取逻辑
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

  // 注意：本版不再读取 'chat_settings_appearance'（旧版背景图/蒙层/毛玻璃）
  // 也不主动清除它，避免误删用户数据

  // ==================== 状态 ====================
  var activeTab = 'profile';

  // 主题配色
  var theme = {
    accentColor: '#6fb1e8',
    primaryBg: ''
  };

  // 文字设置
  var font = {
    size: 14,
    family: 'system',
    customUrl: ''
  };

  // 气泡样式
  var bubble = {
    style: 'standard',
    customCss: ''
  };

  // 字卡模式
  var cardMode = 'all';

  // 分组勾选
  var publicGroups = [];
  var privateGroups = [];
  var emojiGroups = [];
  var stickerGroups = [];

  var settingsTrigger = null;

  // ==================== 持久化：通用 ====================
  function persist(key, value) {
    if (typeof localforage !== 'undefined') {
      localforage.setItem(key, value).catch(function () {});
    } else {
      try {
        if (typeof value === 'string') {
          localStorage.setItem(key, value);
        } else {
          localStorage.setItem(key, JSON.stringify(value));
        }
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
        if (raw === null) { if (callback) callback(null); return; }
        try { callback(JSON.parse(raw)); } catch (e) { callback(raw); }
      } catch (e) { if (callback) callback(null); }
    }
  }

  function persistTab() { persist(STORE_KEY_TAB, activeTab); }
  function loadTab(cb) { loadValue(STORE_KEY_TAB, function (v) { if (v) activeTab = v; cb(); }); }

  function persistTheme() { persist(STORE_KEY_THEME, theme); }
  function loadTheme(cb) {
    loadValue(STORE_KEY_THEME, function (v) {
      if (v && typeof v === 'object') {
        if (v.accentColor) theme.accentColor = v.accentColor;
        if (v.primaryBg) theme.primaryBg = v.primaryBg;
      }
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
    loadValue(STORE_KEY_CARD_MODE, function (v) {
      if (v) cardMode = v;
      cb();
    });
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

  // ==================== 工具：颜色 ====================
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

  // ==================== 应用主题（全局同步） ====================
  function applyTheme() {
    var root = document.documentElement;
    var color = theme.accentColor || '#6fb1e8';

    // ---- 1. 基础变量 ----
    root.style.setProperty('--accent-color', color);
    root.style.setProperty('--accent-color-light', rgba(color, 0.15));
    root.style.setProperty('--accent-color-dark', darken(color, 40));
    root.style.setProperty('--theme-accent', color);
    root.style.setProperty('--global-accent', color);

    // 常用衍生变量
    root.style.setProperty('--link-color', darken(color, 20));
    root.style.setProperty('--highlight-color', rgba(color, 0.2));

    if (theme.primaryBg) {
      root.style.setProperty('--primary-bg', theme.primaryBg);
    }

    // ---- 2. 全站主色同步：注入一个专用 style 标签 ----
    var styleId = 'global-theme-vars';
    var styleEl = document.getElementById(styleId);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    styleEl.textContent = [
      /* 主页 */
      '#pageHome .play-btn { background: ' + color + ' !important; box-shadow: 0 3px 10px ' + rgba(color, 0.35) + ' !important; }',
      '#pageHome .tab-btn.active i, #pageHome .tab-btn.active span { color: ' + color + ' !important; }',
      '#pageHome .function-icon i { color: ' + color + ' !important; }',

      /* 字卡库 */
      '#pageCard .cat-grid-item.active { background: ' + rgba(color, 0.12) + ' !important; border-color: ' + color + ' !important; }',
      '#pageCard .cat-grid-item.active i, #pageCard .cat-grid-item.active .cat-label { color: ' + darken(color, 20) + ' !important; }',
      '#pageCard .card-group-select:focus { border-color: ' + color + ' !important; }',
      '#pageCard .word-card-delete { background: ' + rgba(color, 0.12) + ' !important; color: ' + darken(color, 20) + ' !important; }',
      '#pageCard .card-action-btn i { color: ' + color + ' !important; }',

      /* 传讯页 */
      '#pageChat .send-btn { background: ' + color + ' !important; box-shadow: 0 3px 10px ' + rgba(color, 0.35) + ' !important; }',
      '#pageChat .send-btn:active { background: ' + darken(color, 20) + ' !important; }',
      '#pageChat .chat-action-icon { color: ' + rgba(color, 0.75) + ' !important; }',
      '#pageChat .chat-action-icon:active { color: ' + color + ' !important; }',
      '#pageChat .message-row.self .message-bubble { background: ' + rgba(color, 0.35) + ' !important; }',

      /* 设置面板 */
      '#chatSettingsPanel .chat-settings-tab.active { background: ' + rgba(color, 0.15) + ' !important; color: ' + darken(color, 20) + ' !important; }',
      '#chatSettingsPanel .chat-settings-title i { color: ' + color + ' !important; }',
      '#chatSettingsPanel .cs-mode-btn.active { color: ' + darken(color, 20) + ' !important; }',
      '#chatSettingsPanel .cs-words-btn i { color: ' + color + ' !important; }',
      '#chatSettingsPanel .cs-group-checkbox input:checked + .cs-group-check-mark { background: ' + color + ' !important; border-color: ' + color + ' !important; }',

      /* 通用 */
      '.home-settings-btn i { color: ' + color + ' !important; }'
    ].join('\n');

    // ---- 3. 底部导航的激活色 ----
    document.querySelectorAll('.tab-btn.active i, .tab-btn.active span').forEach(function (el) {
      el.style.color = color;
    });

    // ---- 4. 全局发送按钮 ----
    var sendBtn = document.getElementById('sendBtn');
    if (sendBtn) {
      sendBtn.style.background = color;
      sendBtn.style.boxShadow = '0 3px 10px ' + rgba(color, 0.35);
    }

    // ---- 5. body 变量（供其他脚本读取） ----
    document.body.style.setProperty('--global-accent', color);
    document.body.dataset.accentColor = color;
  }

  // ==================== 应用字体（全局同步） ====================
  function applyFont() {
    var root = document.documentElement;
    var body = document.body;
    var size = font.size || 14;

    // ---- 1. 字体大小：设置变量 + 应用到所有气泡 ----
    root.style.setProperty('--chat-font-size', size + 'px');

    // 应用到传讯页气泡（优先使用 .message-text，其次 .message-bubble）
    document.querySelectorAll('#pageChat .message-text').forEach(function (el) {
      el.style.fontSize = size + 'px';
    });
    document.querySelectorAll('#pageChat .message-bubble').forEach(function (el) {
      el.style.fontSize = size + 'px';
    });
    document.querySelectorAll('#pageChat .call-record-bubble').forEach(function (el) {
      el.style.fontSize = Math.max(10, size - 3) + 'px';
    });

    // ---- 2. 字体族 ----
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
      fontFamily = '"CustomFont", ' + '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif';
    }

    if (fontFamily) {
      body.style.fontFamily = fontFamily;
      // 同时设置到 :root，供其他元素读取
      root.style.setProperty('--global-font-family', fontFamily);
    }

    // ---- 3. 自定义字体 URL ----
    var fontLinkId = 'custom-font-link';
    var existing = document.getElementById(fontLinkId);
    if (existing) existing.remove();

    if (font.customUrl) {
      var link = document.createElement('link');
      link.id = fontLinkId;
      link.rel = 'stylesheet';
      link.href = font.customUrl;
      document.head.appendChild(link);
    }
  }

  // ==================== 应用气泡样式 ====================
  function applyBubble() {
    var root = document.documentElement;
    var radius = '18px';
    if (bubble.style === 'standard') radius = '18px';
    else if (bubble.style === 'rounded') radius = '10px';
    else if (bubble.style === 'large') radius = '24px';
    else if (bubble.style === 'square') radius = '4px';

    root.style.setProperty('--bubble-radius', radius);

    document.querySelectorAll('#pageChat .message-bubble').forEach(function (el) {
      el.style.borderRadius = radius;
    });
  }

  // ==================== 应用自定义 CSS（限定作用域） ====================
  function applyCustomCss() {
    var styleId = 'custom-css-style'; // 固定 id，便于复写
    var existing = document.getElementById(styleId);
    if (existing) existing.remove();

    if (!bubble.customCss || !bubble.customCss.trim()) return;

    var raw = bubble.customCss;

    // 自动限定作用域：
    // 如果用户输入的 CSS 里没有 #pageChat，就自动加前缀
    // 让用户的自定义样式只影响传讯页面
    var scoped = scopeCssToPageChat(raw);

    var style = document.createElement('style');
    style.id = styleId;
    style.textContent = scoped;
    document.head.appendChild(style);
  }

  // 简单的 CSS 作用域限定：给顶层选择器加 #pageChat 前缀
  function scopeCssToPageChat(css) {
    if (!css) return '';
    // 如果用户已经手动加了 #pageChat，就不再重复加
    if (css.indexOf('#pageChat') >= 0) return css;

    // 按 } 切分规则块，给每个选择器加前缀
    var result = [];
    // 逐行处理更稳定：找到 "selector {" 这种模式
    var regex = /([^{}]+)\{([^{}]*)\}/g;
    var m;
    var lastIndex = 0;
    while ((m = regex.exec(css)) !== null) {
      var selectors = m[1].trim();
      var body = m[2];
      // 在规则之间保留空白
      if (selectors) {
        var prefixedSelectors = selectors.split(',').map(function (sel) {
          sel = sel.trim();
          if (!sel) return sel;
          // 跳过 @media / @keyframes 之类的 at-rule
          if (sel.charAt(0) === '@') return sel;
          return '#pageChat ' + sel;
        }).join(', ');
        result.push(prefixedSelectors + ' {' + body + '}');
      } else {
        result.push(m[0]);
      }
      lastIndex = regex.lastIndex;
    }
    // 处理未被匹配的尾部（如 @import、注释等）
    if (lastIndex < css.length) {
      var tail = css.slice(lastIndex);
      if (tail.trim()) result.push(tail);
    }
    return result.join('\n');
  }

  // ==================== 应用全部 ====================
  function applyAll() {
    applyTheme();
    applyFont();
    applyBubble();
    applyCustomCss();
  }

  // ==================== 找到设置齿轮图标 ====================
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
      '    <button class="chat-settings-tab" data-tab="profile">',
      '      <i class="fa-solid fa-user"></i>',
      '      <span>个人资料</span>',
      '    </button>',
      '    <button class="chat-settings-tab" data-tab="appearance">',
      '      <i class="fa-solid fa-palette"></i>',
      '      <span>外观与界面</span>',
      '    </button>',
      '    <button class="chat-settings-tab" data-tab="chat">',
      '      <i class="fa-solid fa-comments"></i>',
      '      <span>聊天与字卡</span>',
      '    </button>',
      '    <button class="chat-settings-tab" data-tab="data">',
      '      <i class="fa-solid fa-database"></i>',
      '      <span>数据与工具</span>',
      '    </button>',
      '  </div>',

      '  <div class="chat-settings-body">',

      // Tab 1: 个人资料
      '    <div class="chat-settings-tab-panel" data-panel="profile">',
      '      <div class="chat-settings-section-title">个人资料</div>',
      '      <div class="chat-settings-placeholder">',
      '        <i class="fa-solid fa-user"></i>',
      '        <p>修改我和对方的昵称、头像等</p>',
      '      </div>',
      '    </div>',

      // Tab 2: 外观与界面
      '    <div class="chat-settings-tab-panel" data-panel="appearance">',

      // 区块 1：全局主题配色
      '      <div class="chat-settings-section">',
      '        <div class="chat-settings-section-title">全局主题配色</div>',
      '        <div class="cs-theme-colors" id="csThemeColors"></div>',
      '        <div class="cs-custom-color-row">',
      '          <label class="cs-custom-color-btn" for="csCustomColorInput">',
      '            <i class="fa-solid fa-eye-dropper"></i> 自定义颜色',
      '          </label>',
      '          <input type="color" id="csCustomColorInput" value="#6fb1e8" style="display:none;">',
      '          <span class="cs-custom-color-value" id="csCustomColorValue">#6fb1e8</span>',
      '        </div>',
      '        <div class="cs-slider-hint">修改后主页、传讯页、字卡库、设置面板的主色调会同步变化</div>',
      '      </div>',

      // 区块 2：文字设置
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

      // 区块 3：气泡样式
      '      <div class="chat-settings-section">',
      '        <div class="chat-settings-section-title">气泡样式</div>',
      '        <div class="cs-bubble-styles" id="csBubbleStyles">',
      '          <button class="cs-bubble-btn active" data-style="standard">',
      '            <span class="cs-bubble-preview" style="border-radius:18px;"></span>',
      '            <span>标准</span>',
      '          </button>',
      '          <button class="cs-bubble-btn" data-style="rounded">',
      '            <span class="cs-bubble-preview" style="border-radius:10px;"></span>',
      '            <span>圆角</span>',
      '          </button>',
      '          <button class="cs-bubble-btn" data-style="large">',
      '            <span class="cs-bubble-preview" style="border-radius:24px;"></span>',
      '            <span>大圆角</span>',
      '          </button>',
      '          <button class="cs-bubble-btn" data-style="square">',
      '            <span class="cs-bubble-preview" style="border-radius:4px;"></span>',
      '            <span>方形</span>',
      '          </button>',
      '        </div>',

      '        <div class="cs-field-label" style="margin-top:16px;">自定义气泡 CSS</div>',
      '        <textarea class="cs-custom-css-input" id="csCustomCssInput" placeholder="/* 只影响传讯页气泡，例如： */&#10;.message-bubble {&#10;  box-shadow: 0 4px 12px rgba(0,0,0,0.1);&#10;}"></textarea>',
      '        <div class="cs-custom-css-actions">',
      '          <button class="cs-css-btn cs-css-apply" id="csCssApply">应用 CSS</button>',
      '          <button class="cs-css-btn cs-css-clear" id="csCssClear">清空</button>',
      '          <button class="cs-css-btn cs-css-reset" id="csCssReset">恢复默认</button>',
      '        </div>',
      '      </div>',

      '    </div>',

      // Tab 3: 聊天与字卡
      '    <div class="chat-settings-tab-panel" data-panel="chat">',
      '      <div class="chat-settings-section">',
      '        <div class="chat-settings-section-title">当前字卡模式</div>',
      '        <div class="cs-mode-switch" id="csModeSwitch">',
      '          <button class="cs-mode-btn active" data-mode="all">',
      '            <i class="fa-solid fa-layer-group"></i>',
      '            <span>全部字卡</span>',
      '          </button>',
      '          <button class="cs-mode-btn" data-mode="public-only">',
      '            <i class="fa-solid fa-globe"></i>',
      '            <span>仅公共</span>',
      '          </button>',
      '          <button class="cs-mode-btn" data-mode="private-only">',
      '            <i class="fa-solid fa-lock"></i>',
      '            <span>仅专属</span>',
      '          </button>',
      '        </div>',
      '        <div class="cs-mode-hint" id="csModeHint">自动回复时 50% 从公共字卡抽取，50% 从专属字卡抽取</div>',
      '      </div>',

      '      <div class="chat-settings-section">',
      '        <div class="cs-words-header">',
      '          <div class="chat-settings-section-title" style="margin:0;">',
      '            <i class="fa-solid fa-globe" style="color:#6fb1e8;margin-right:4px;"></i>',
      '            公共字卡分组',
      '            <span class="cs-words-count" id="csPublicCount">0</span>',
      '          </div>',
      '        </div>',
      '        <div class="cs-words-hint">勾选的分组视为"公共字卡"，所有联系人都能抽取</div>',
      '        <div class="cs-group-list" id="csPublicGroupList"></div>',
      '      </div>',

      '      <div class="chat-settings-section">',
      '        <div class="cs-words-header">',
      '          <div class="chat-settings-section-title" style="margin:0;">',
      '            <i class="fa-solid fa-lock" style="color:#f8b4b4;margin-right:4px;"></i>',
      '            专属字卡分组',
      '            <span class="cs-words-count cs-words-count-private" id="csPrivateCount">0</span>',
      '          </div>',
      '        </div>',
      '        <div class="cs-words-hint">勾选的分组视为"当前联系人专属字卡"，只有当前角色能抽取</div>',
      '        <div class="cs-group-list" id="csPrivateGroupList"></div>',
      '      </div>',

      '      <div class="chat-settings-section">',
      '        <div class="cs-words-header">',
      '          <div class="chat-settings-section-title" style="margin:0;">',
      '            <i class="fa-regular fa-face-smile" style="color:#7ED3A8;margin-right:4px;"></i>',
      '            颜文字字卡',
      '            <span class="cs-words-count" id="csEmojiGroupCount" style="background:#e6f5ed;color:#4CAF7D;">0</span>',
      '          </div>',
      '        </div>',
      '        <div class="cs-words-hint">勾选的字卡分组会加入自动回复的颜文字池</div>',
      '        <div class="cs-group-list" id="csEmojiGroupList"></div>',
      '      </div>',

      '      <div class="chat-settings-section">',
      '        <div class="cs-words-header">',
      '          <div class="chat-settings-section-title" style="margin:0;">',
      '            <i class="fa-regular fa-image" style="color:#B78BEA;margin-right:4px;"></i>',
      '            表情包字卡',
      '            <span class="cs-words-count" id="csStickerGroupCount" style="background:#f0eaf9;color:#8b6bd1;">0</span>',
      '          </div>',
      '        </div>',
      '        <div class="cs-words-hint">勾选的字卡分组会加入自动回复的表情包池</div>',
      '        <div class="cs-group-list" id="csStickerGroupList"></div>',
      '      </div>',
      '    </div>',

      // Tab 4: 数据与工具
      '    <div class="chat-settings-tab-panel" data-panel="data">',
      '      <div class="chat-settings-section-title">数据与工具</div>',
      '      <div class="chat-settings-placeholder">',
      '        <i class="fa-solid fa-database"></i>',
      '        <p>存钱罐、数据备份</p>',
      '      </div>',
      '    </div>',

      '  </div>',

      '</div>'
    ].join('');

    document.body.appendChild(panel);

    bindPanelEvents();
    renderThemeColors();
    renderBubbleStyles();
  }

  // ==================== 渲染主题色选择器 ====================
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
      if (c.value === '#FFFFFF') {
        btn.style.border = '1px solid #e2e8ee';
      }
      btn.addEventListener('click', function () {
        theme.accentColor = c.value;
        persistTheme();
        applyTheme();
        renderThemeColors();
        var valEl = document.getElementById('csCustomColorValue');
        if (valEl) valEl.textContent = c.value;
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

  // ==================== 填充面板当前值 ====================
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

  // ==================== 事件绑定 ====================
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

    // 1. 自定义颜色
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
    }

    // 2. 字体大小滑块
    var fontSizeSlider = document.getElementById('csFontSizeSlider');
    var fontSizeValue = document.getElementById('csFontSizeValue');
    if (fontSizeSlider) {
      fontSizeSlider.addEventListener('input', function () {
        var val = parseInt(fontSizeSlider.value, 10);
        font.size = val;
        if (fontSizeValue) fontSizeValue.textContent = val + 'px';
        applyFont();
      });
      fontSizeSlider.addEventListener('change', function () {
        persistFont();
      });
    }

    // 3. 字体选择
    var fontSelect = document.getElementById('csFontSelect');
    if (fontSelect) {
      fontSelect.addEventListener('change', function () {
        font.family = fontSelect.value;
        persistFont();
        applyFont();
      });
    }

    // 4. 字体 URL 应用
    var fontUrlInput = document.getElementById('csFontUrlInput');
    var fontUrlApply = document.getElementById('csFontUrlApply');
    if (fontUrlApply && fontUrlInput) {
      fontUrlApply.addEventListener('click', function () {
        var url = fontUrlInput.value.trim();
        if (!url) { alert('请输入字体 CSS 链接'); return; }
        font.customUrl = url;
        font.family = 'custom';
        persistFont();
        applyFont();
        var fs = document.getElementById('csFontSelect');
        if (fs) fs.value = 'custom';
      });
    }

    // 5. 气泡样式切换
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

    // 6. 自定义 CSS
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

    // 聊天与字卡 Tab
    bindChatTabEvents();
  }

  // ==================== 字卡模式切换 ====================
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
    if (cardMode === 'public-only') {
      hintEl.textContent = '自动回复时只从勾选为公共的分组中抽取';
    } else if (cardMode === 'private-only') {
      hintEl.textContent = '自动回复时只从勾选为专属的分组中抽取';
    } else {
      hintEl.textContent = '自动回复时 50% 从公共分组抽取，50% 从专属分组抽取';
    }
  }

  function restoreModeSwitch() {
    var switchEl = document.getElementById('csModeSwitch');
    if (!switchEl) return;
    switchEl.querySelectorAll('.cs-mode-btn').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-mode') === cardMode);
    });
    updateModeHint();
  }

  // ==================== 渲染分组勾选列表 ====================
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

    var groups = [];
    if (typeof window.getGroups === 'function') {
      groups = window.getGroups('reply');
    }

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
    var groups = [];
    if (typeof window.getGroups === 'function') {
      groups = window.getGroups('kaomoji');
    }
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
      ? (window.cardDatabase.get('sticker') || [])
      : [];
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
    if (typeof window.getGroupColor === 'function') {
      color = window.getGroupColor(groupName, category);
    }

    var count = 0;
    if (category === 'sticker') {
      count = (window.cardDatabase && window.cardDatabase.get)
        ? (window.cardDatabase.get('sticker') || []).length
        : 0;
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

    if (typeof window.refreshCardUI === 'function') {
      window.refreshCardUI();
    }
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

  function bindChatTabEvents() {
    bindModeSwitch();
  }

  // ==================== 工具 ====================
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

  // ==================== 切换 Tab ====================
  function switchTab(tabName) {
    var panel = document.getElementById('chatSettingsPanel');
    if (!panel) return;

    panel.querySelectorAll('.chat-settings-tab').forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-tab') === tabName);
    });

    panel.querySelectorAll('.chat-settings-tab-panel').forEach(function (p) {
      p.classList.toggle('active', p.getAttribute('data-panel') === tabName);
    });

    if (tabName === 'appearance') {
      fillPanelValues();
    }
    if (tabName === 'chat') {
      restoreModeSwitch();
      renderAllGroupLists();
    }
  }

  // ==================== 打开/关闭 ====================
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

  // ==================== 初始化 ====================
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

  // 暴露给外部
  window.chatSettingsPanel = {
    open: openPanel,
    close: closePanel,
    switchTab: switchTab,
    applyTheme: applyTheme,
    applyFont: applyFont,
    applyBubble: applyBubble,
    applyCustomCss: applyCustomCss,
    refreshGroupCheckboxes: renderAllGroupLists,
    refreshGroupLists: renderAllGroupLists
  };

})();
