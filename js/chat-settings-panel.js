/**
 * 传讯页面 - 设置面板（独立模块）
 * - 绑定到底部导航栏现有的"设置"齿轮图标
 * - Tab 1：个人资料（占位）
 * - Tab 2：外观与界面（主题配色 + 文字设置 + 气泡样式 + 自定义 CSS）
 * - Tab 3：聊天与字卡（分组勾选模式）
 * - Tab 4：数据与工具（占位）
 * - 完全独立，不影响任何现有逻辑
 */

(function () {
  'use strict';

  // ==================== 存储 Key ====================
  var STORE_KEY_TAB = 'chat_settings_panel_active_tab';
  var STORE_KEY_THEME = 'chat_settings_theme';
  var STORE_KEY_FONT = 'chat_settings_font';
  var STORE_KEY_BUBBLE = 'chat_settings_bubble';
  var STORE_KEY_CUSTOM_CSS = 'chat_settings_custom_css';
  var STORE_KEY_CARD_MODE = 'chat_card_mode';
  var STORE_KEY_PUBLIC_GROUPS = 'chat_public_groups';
  var STORE_KEY_PRIVATE_GROUPS = 'chat_private_groups';
  var STORE_KEY_EMOJI_GROUPS = 'chat_emoji_groups';
  var STORE_KEY_STICKER_GROUPS = 'chat_sticker_groups';

  // ==================== 状态 ====================
  var activeTab = 'profile';

  // 主题配色
  var theme = {
    accentColor: '#6fb1e8',    // 主色调
    primaryBg: ''              // 主页背景色（可选）
  };

  // 文字设置
  var font = {
    size: 14,                  // 聊天气泡文字大小 px
    family: 'system',          // 'system' | 'kaiti' | 'songti' | 'heiti' | 'custom'
    customUrl: ''              // 自定义字体 CSS 链接
  };

  // 气泡样式
  var bubble = {
    style: 'standard',         // 'standard' | 'rounded' | 'large' | 'square'
    customCss: ''              // 用户自定义 CSS
  };

  // 字卡模式
  var cardMode = 'all';

  // 分组勾选状态
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
        // 尝试 JSON parse
        try { callback(JSON.parse(raw)); } catch (e) { callback(raw); }
      } catch (e) { if (callback) callback(null); }
    }
  }

  // ==================== 持久化：Tab ====================
  function persistTab() { persist(STORE_KEY_TAB, activeTab); }
  function loadTab(callback) { loadValue(STORE_KEY_TAB, function (val) { if (val) activeTab = val; callback(); }); }

  // ==================== 持久化：主题 ====================
  function persistTheme() { persist(STORE_KEY_THEME, theme); }
  function loadTheme(callback) {
    loadValue(STORE_KEY_THEME, function (val) {
      if (val && typeof val === 'object') {
        if (val.accentColor) theme.accentColor = val.accentColor;
        if (val.primaryBg) theme.primaryBg = val.primaryBg;
      }
      callback();
    });
  }

  // ==================== 持久化：字体 ====================
  function persistFont() { persist(STORE_KEY_FONT, font); }
  function loadFont(callback) {
    loadValue(STORE_KEY_FONT, function (val) {
      if (val && typeof val === 'object') {
        if (typeof val.size === 'number') font.size = val.size;
        if (val.family) font.family = val.family;
        if (val.customUrl) font.customUrl = val.customUrl;
      }
      callback();
    });
  }

  // ==================== 持久化：气泡 ====================
  function persistBubble() { persist(STORE_KEY_BUBBLE, bubble); }
  function loadBubble(callback) {
    loadValue(STORE_KEY_BUBBLE, function (val) {
      if (val && typeof val === 'object') {
        if (val.style) bubble.style = val.style;
        if (typeof val.customCss === 'string') bubble.customCss = val.customCss;
      }
      callback();
    });
  }

  // ==================== 持久化：字卡模式 ====================
  function persistCardMode() {
    persist(STORE_KEY_CARD_MODE, cardMode);
    window.chatCardMode = cardMode;
  }
  function loadCardMode(callback) {
    loadValue(STORE_KEY_CARD_MODE, function (val) {
      if (val) cardMode = val;
      callback();
    });
  }

  // ==================== 持久化：分组勾选 ====================
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

  function loadGroupSelections(callback) {
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
        if (callback) callback();
      }
    }
    keys.forEach(function (k) {
      loadValue(k.store, function (d) { k.assign(d); done(); });
    });
  }

  // ==================== 应用主题配色 ====================
  function applyTheme() {
    var root = document.documentElement;
    var color = theme.accentColor || '#6fb1e8';

    // 计算衍生色
    var rgb = hexToRgb(color);
    var lighter = rgb ? 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',0.15)' : 'rgba(111,177,232,0.15)';
    var darker = rgb ? 'rgba(' + Math.max(0, rgb.r - 40) + ',' + Math.max(0, rgb.g - 40) + ',' + Math.max(0, rgb.b - 40) + ',1)' : '#4a86b0';

    // 注入到 CSS 变量
    root.style.setProperty('--accent-color', color);
    root.style.setProperty('--accent-color-light', lighter);
    root.style.setProperty('--accent-color-dark', darker);
    root.style.setProperty('--theme-accent', color);

    if (theme.primaryBg) {
      root.style.setProperty('--primary-bg', theme.primaryBg);
    }

    // 应用到关键元素
    var sendBtn = document.getElementById('sendBtn');
    if (sendBtn) {
      sendBtn.style.background = color;
      sendBtn.style.boxShadow = '0 3px 10px ' + lighter;
    }

    var tabActive = document.querySelectorAll('.tab-btn.active i, .tab-btn.active span');
    tabActive.forEach(function (el) { el.style.color = color; });

    // 全局（主页等）——给 body 加 CSS 变量
    document.body.style.setProperty('--global-accent', color);

    // 应用主页相关元素
    var homeSendBtn = document.querySelectorAll('#pageHome .play-btn');
    homeSendBtn.forEach(function (el) {
      // 保留原样式，只微调颜色
    });
  }

  function hexToRgb(hex) {
    if (!hex) return null;
    var m = hex.replace('#', '');
    if (m.length === 3) {
      m = m[0] + m[0] + m[1] + m[1] + m[2] + m[2];
    }
    var num = parseInt(m, 16);
    if (isNaN(num)) return null;
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255
    };
  }

  // ==================== 应用文字设置 ====================
  function applyFont() {
    var root = document.documentElement;
    var body = document.body;

    // 1. 字体大小
    var size = font.size || 14;
    root.style.setProperty('--chat-font-size', size + 'px');
    document.querySelectorAll('#pageChat .message-bubble').forEach(function (el) {
      el.style.fontSize = size + 'px';
    });

    // 2. 字体
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
      fontFamily = '"CustomFont", ' + '-apple-system, BlinkMacSystemFont, sans-serif';
    }

    if (fontFamily) {
      body.style.fontFamily = fontFamily;
    }

    // 3. 自定义字体 URL
    var fontLinkId = 'custom-font-link';
    var existing = document.getElementById(fontLinkId);
    if (existing) existing.remove();

    if (font.family === 'custom' && font.customUrl) {
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

  // ==================== 应用自定义 CSS ====================
  function applyCustomCss() {
    var styleId = 'chat-custom-css';
    var existing = document.getElementById(styleId);
    if (existing) existing.remove();

    if (bubble.customCss && bubble.customCss.trim()) {
      var style = document.createElement('style');
      style.id = styleId;
      style.textContent = bubble.customCss;
      document.head.appendChild(style);
    }
  }

  // ==================== 应用所有设置 ====================
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

      // 顶部标题
      '  <div class="chat-settings-header">',
      '    <span class="chat-settings-title"><i class="fa-solid fa-sliders"></i> 设置</span>',
      '    <button class="chat-settings-close" id="chatSettingsClose"><i class="fa-solid fa-xmark"></i></button>',
      '  </div>',

      // 选项卡
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

      // 内容区
      '  <div class="chat-settings-body">',

      // Tab 1: 个人资料（占位）
      '    <div class="chat-settings-tab-panel" data-panel="profile">',
      '      <div class="chat-settings-section-title">个人资料</div>',
      '      <div class="chat-settings-placeholder">',
      '        <i class="fa-solid fa-user"></i>',
      '        <p>修改我和对方的昵称、头像等</p>',
      '      </div>',
      '    </div>',

      // Tab 2: 外观与界面（全新内容）
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
      '        <div class="cs-slider-hint">修改后主页、字卡库等页面的主色调会同步变化</div>',
      '      </div>',

      // 区块 2：文字设置
      '      <div class="chat-settings-section">',
      '        <div class="chat-settings-section-title">文字设置</div>',

      // 字体大小滑块
      '        <div class="cs-field-label">字体大小</div>',
      '        <div class="cs-slider-row">',
      '          <input type="range" class="cs-slider" id="csFontSizeSlider" min="12" max="24" value="14">',
      '          <span class="cs-slider-value" id="csFontSizeValue">14px</span>',
      '        </div>',

      // 字体选择
      '        <div class="cs-field-label" style="margin-top:14px;">字体选择</div>',
      '        <select class="cs-font-select" id="csFontSelect">',
      '          <option value="system">系统默认</option>',
      '          <option value="kaiti">楷体</option>',
      '          <option value="songti">宋体</option>',
      '          <option value="heiti">黑体</option>',
      '          <option value="custom">自定义字体</option>',
      '        </select>',

      // 自定义字体 URL
      '        <div class="cs-field-label" style="margin-top:14px;">字体 URL</div>',
      '        <div class="cs-font-url-row">',
      '          <input type="text" class="cs-font-url-input" id="csFontUrlInput" placeholder="粘贴字体 CSS 链接...">',
      '          <button class="cs-font-url-apply" id="csFontUrlApply">应用</button>',
      '        </div>',
      '      </div>',

      // 区块 3：气泡样式与自定义 CSS
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
      '        <textarea class="cs-custom-css-input" id="csCustomCssInput" placeholder="/* 在这里输入自定义 CSS，例如： */&#10;.message-bubble {&#10;  box-shadow: 0 4px 12px rgba(0,0,0,0.1);&#10;}"></textarea>',
      '        <div class="cs-custom-css-actions">',
      '          <button class="cs-css-btn cs-css-apply" id="csCssApply">应用 CSS</button>',
      '          <button class="cs-css-btn cs-css-clear" id="csCssClear">清空</button>',
      '          <button class="cs-css-btn cs-css-reset" id="csCssReset">恢复默认</button>',
      '        </div>',
      '      </div>',

      '    </div>',

      // Tab 3: 聊天与字卡（分组勾选模式）
      '    <div class="chat-settings-tab-panel" data-panel="chat">',

      // 区块 1：字卡模式
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

      // 区块 2：公共字卡分组
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

      // 区块 3：专属字卡分组
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

      // 区块 4：颜文字勾选
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

      // 区块 5：表情包勾选
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

      // Tab 4: 数据与工具（占位）
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

  // ==================== 渲染气泡样式选择器 ====================
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
    // 主题色
    var valEl = document.getElementById('csCustomColorValue');
    if (valEl) valEl.textContent = theme.accentColor;
    var picker = document.getElementById('csCustomColorInput');
    if (picker) picker.value = theme.accentColor;
    renderThemeColors();

    // 字体大小
    var slider = document.getElementById('csFontSizeSlider');
    var sizeVal = document.getElementById('csFontSizeValue');
    if (slider) {
      slider.value = font.size;
      if (sizeVal) sizeVal.textContent = font.size + 'px';
    }

    // 字体选择
    var fontSelect = document.getElementById('csFontSelect');
    if (fontSelect) fontSelect.value = font.family;

    // 字体 URL
    var fontUrlInput = document.getElementById('csFontUrlInput');
    if (fontUrlInput) fontUrlInput.value = font.customUrl || '';

    // 气泡样式
    renderBubbleStyles();

    // 自定义 CSS
    var cssInput = document.getElementById('csCustomCssInput');
    if (cssInput) cssInput.value = bubble.customCss || '';
  }

  // ==================== 事件绑定 ====================
  function bindPanelEvents() {
    var panel = document.getElementById('chatSettingsPanel');
    if (!panel) return;

    // 关闭
    var closeBtn = document.getElementById('chatSettingsClose');
    if (closeBtn) closeBtn.addEventListener('click', closePanel);
    panel.addEventListener('click', function (e) {
      if (e.target === panel) closePanel();
    });

    // Tab 切换
    panel.querySelectorAll('.chat-settings-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        var target = tab.getAttribute('data-tab');
        if (!target) return;
        activeTab = target;
        switchTab(target);
        persistTab();
      });
    });

    // ============ 外观 Tab 的交互 ============

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

    // 6. 自定义 CSS 应用
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

    // ============ 聊天与字卡 Tab 的交互 ============
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
