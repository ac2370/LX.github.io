/**
 * 传讯页面 - 设置面板（独立模块）
 * - 绑定到底部导航栏现有的"设置"齿轮图标
 * - Tab 1：个人资料（占位）
 * - Tab 2：外观与界面（背景图 + 蒙层 + 毛玻璃）
 * - Tab 3：聊天与字卡（分组勾选模式）
 * - Tab 4：数据与工具（占位）
 * - 完全独立，不影响任何现有逻辑
 */

(function () {
  'use strict';

  var STORE_KEY_TAB = 'chat_settings_panel_active_tab';
  var STORE_KEY_APPEARANCE = 'chat_settings_appearance';
  var STORE_KEY_CARD_MODE = 'chat_card_mode';
  var STORE_KEY_PUBLIC_GROUPS = 'chat_public_groups';
  var STORE_KEY_PRIVATE_GROUPS = 'chat_private_groups';
  var STORE_KEY_EMOJI_GROUPS = 'chat_emoji_groups';   // 颜文字勾选
  var STORE_KEY_STICKER_GROUPS = 'chat_sticker_groups'; // 表情包勾选

  // ==================== 状态 ====================
  var activeTab = 'profile';
  var appearance = {
    chatBg: null,
    overlayOpacity: 30,
    glassEffect: true
  };
  var cardMode = 'all';           // 'all' | 'public-only' | 'private-only'

  // 分组勾选状态
  var publicGroups = [];          // 回复分类：勾选为公共的字卡分组
  var privateGroups = [];         // 回复分类：勾选为专属的字卡分组
  var emojiGroups = [];           // 颜文字分类：勾选的分组
  var stickerGroups = [];         // 表情包分类：勾选的分组

  var settingsTrigger = null;

  // ==================== 持久化：Tab ====================
  function persistTab() {
    if (typeof localforage !== 'undefined') {
      localforage.setItem(STORE_KEY_TAB, activeTab).catch(function () {});
    } else {
      try { localStorage.setItem(STORE_KEY_TAB, activeTab); } catch (e) {}
    }
  }

  function loadTab(callback) {
    if (typeof localforage !== 'undefined') {
      localforage.getItem(STORE_KEY_TAB).then(function (val) {
        if (val) activeTab = val;
        if (callback) callback();
      }).catch(function () { if (callback) callback(); });
    } else {
      try {
        var raw = localStorage.getItem(STORE_KEY_TAB);
        if (raw) activeTab = raw;
      } catch (e) {}
      if (callback) callback();
    }
  }

  // ==================== 持久化：外观 ====================
  function persistAppearance() {
    if (typeof localforage !== 'undefined') {
      localforage.setItem(STORE_KEY_APPEARANCE, appearance).catch(function () {});
    } else {
      try { localStorage.setItem(STORE_KEY_APPEARANCE, JSON.stringify(appearance)); } catch (e) {}
    }
  }

  function loadAppearance(callback) {
    function apply(data) {
      if (data && typeof data === 'object') {
        if (data.chatBg !== undefined) appearance.chatBg = data.chatBg;
        if (typeof data.overlayOpacity === 'number') appearance.overlayOpacity = data.overlayOpacity;
        if (typeof data.glassEffect === 'boolean') appearance.glassEffect = data.glassEffect;
      }
      if (callback) callback();
    }
    if (typeof localforage !== 'undefined') {
      localforage.getItem(STORE_KEY_APPEARANCE).then(apply).catch(function () { apply(null); });
    } else {
      try {
        var raw = localStorage.getItem(STORE_KEY_APPEARANCE);
        apply(raw ? JSON.parse(raw) : null);
      } catch (e) { apply(null); }
    }
  }

  // ==================== 持久化：字卡模式 ====================
  function persistCardMode() {
    if (typeof localforage !== 'undefined') {
      localforage.setItem(STORE_KEY_CARD_MODE, cardMode).catch(function () {});
    } else {
      try { localStorage.setItem(STORE_KEY_CARD_MODE, cardMode); } catch (e) {}
    }
    window.chatCardMode = cardMode;
  }

  function loadCardMode(callback) {
    if (typeof localforage !== 'undefined') {
      localforage.getItem(STORE_KEY_CARD_MODE).then(function (val) {
        if (val) cardMode = val;
        if (callback) callback();
      }).catch(function () { if (callback) callback(); });
    } else {
      try {
        var raw = localStorage.getItem(STORE_KEY_CARD_MODE);
        if (raw) cardMode = raw;
      } catch (e) {}
      if (callback) callback();
    }
  }

  // ==================== 持久化：分组勾选 ====================
  function persistGroupSelections() {
    if (typeof localforage !== 'undefined') {
      localforage.setItem(STORE_KEY_PUBLIC_GROUPS, publicGroups).catch(function () {});
      localforage.setItem(STORE_KEY_PRIVATE_GROUPS, privateGroups).catch(function () {});
      localforage.setItem(STORE_KEY_EMOJI_GROUPS, emojiGroups).catch(function () {});
      localforage.setItem(STORE_KEY_STICKER_GROUPS, stickerGroups).catch(function () {});
    } else {
      try {
        localStorage.setItem(STORE_KEY_PUBLIC_GROUPS, JSON.stringify(publicGroups));
        localStorage.setItem(STORE_KEY_PRIVATE_GROUPS, JSON.stringify(privateGroups));
        localStorage.setItem(STORE_KEY_EMOJI_GROUPS, JSON.stringify(emojiGroups));
        localStorage.setItem(STORE_KEY_STICKER_GROUPS, JSON.stringify(stickerGroups));
      } catch (e) {}
    }
    // 暴露给外部（供 chat.js 使用）
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
      if (typeof localforage !== 'undefined') {
        localforage.getItem(k.store).then(function (d) {
          k.assign(d);
          done();
        }).catch(function () { k.assign(null); done(); });
      } else {
        try {
          var raw = localStorage.getItem(k.store);
          k.assign(raw ? JSON.parse(raw) : null);
        } catch (e) { k.assign(null); }
        done();
      }
    });
  }

  // ==================== 应用外观到传讯页面 ====================
  function applyAppearance() {
    var pageChat = document.getElementById('pageChat');
    if (!pageChat) return;

    var overlay = pageChat.querySelector('.chat-bg-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'chat-bg-overlay';
      pageChat.insertBefore(overlay, pageChat.firstChild);
    }

    if (appearance.chatBg) {
      pageChat.style.backgroundImage = "url('" + appearance.chatBg + "')";
      pageChat.style.backgroundSize = 'cover';
      pageChat.style.backgroundPosition = 'center';
      pageChat.style.backgroundRepeat = 'no-repeat';
      overlay.style.display = 'block';
    } else {
      pageChat.style.backgroundImage = '';
      overlay.style.display = 'none';
    }

    overlay.style.background = 'rgba(0, 0, 0, ' + (appearance.overlayOpacity / 100) + ')';

    if (appearance.glassEffect) {
      pageChat.classList.add('glass-on');
      pageChat.classList.remove('glass-off');
    } else {
      pageChat.classList.add('glass-off');
      pageChat.classList.remove('glass-on');
    }

    var chatMessages = document.getElementById('chatMessages');
    if (chatMessages) {
      chatMessages.style.background = appearance.chatBg ? 'transparent' : '';
    }
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

      // Tab 2: 外观与界面（完整内容）
      '    <div class="chat-settings-tab-panel" data-panel="appearance">',
      '      <div class="chat-settings-section">',
      '        <div class="chat-settings-section-title">聊天背景图</div>',
      '        <div class="cs-bg-preview" id="csBgPreview">',
      '          <div class="cs-bg-preview-empty" id="csBgPreviewEmpty">',
      '            <i class="fa-regular fa-image"></i>',
      '            <span>暂无背景</span>',
      '          </div>',
      '        </div>',
      '        <div class="cs-bg-actions">',
      '          <label class="cs-bg-upload-btn" for="csBgFileInput">',
      '            <i class="fa-solid fa-upload"></i> 上传本地图片',
      '          </label>',
      '          <input type="file" id="csBgFileInput" accept="image/*" style="display:none;">',
      '          <button class="cs-bg-clear-btn" id="csBgClearBtn">',
      '            <i class="fa-solid fa-rotate-left"></i> 恢复默认',
      '          </button>',
      '        </div>',
      '        <div class="cs-bg-url-row">',
      '          <input type="text" class="cs-bg-url-input" id="csBgUrlInput" placeholder="或粘贴图片 URL...">',
      '          <button class="cs-bg-url-apply" id="csBgUrlApply">应用</button>',
      '        </div>',
      '      </div>',
      '      <div class="chat-settings-section">',
      '        <div class="chat-settings-section-title">背景蒙层深浅度</div>',
      '        <div class="cs-slider-row">',
      '          <input type="range" class="cs-slider" id="csOverlaySlider" min="0" max="100" value="30">',
      '          <span class="cs-slider-value" id="csOverlayValue">30%</span>',
      '        </div>',
      '        <div class="cs-slider-hint">拖拽滑块调整背景图上方蒙层的深浅度</div>',
      '      </div>',
      '      <div class="chat-settings-section">',
      '        <div class="chat-settings-section-title">毛玻璃效果</div>',
      '        <div class="cs-toggle-row">',
      '          <div class="cs-toggle-info">',
      '            <div class="cs-toggle-title">气泡与输入框毛玻璃</div>',
      '            <div class="cs-toggle-desc">开启后气泡和输入框会有背景模糊效果</div>',
      '          </div>',
      '          <label class="cs-toggle-switch">',
      '            <input type="checkbox" id="csGlassToggle" checked>',
      '            <span class="cs-toggle-slider"></span>',
      '          </label>',
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
    var bgFileInput = document.getElementById('csBgFileInput');
    if (bgFileInput) {
      bgFileInput.addEventListener('change', function () {
        var file = bgFileInput.files && bgFileInput.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function (e) {
          appearance.chatBg = e.target.result;
          persistAppearance();
          applyAppearance();
          updateBgPreview();
        };
        reader.readAsDataURL(file);
      });
    }

    var bgUrlInput = document.getElementById('csBgUrlInput');
    var bgUrlApply = document.getElementById('csBgUrlApply');
    if (bgUrlApply && bgUrlInput) {
      bgUrlApply.addEventListener('click', function () {
        var url = bgUrlInput.value.trim();
        if (!url) { alert('请输入图片 URL'); return; }
        appearance.chatBg = url;
        persistAppearance();
        applyAppearance();
        updateBgPreview();
      });
    }

    var bgClearBtn = document.getElementById('csBgClearBtn');
    if (bgClearBtn) {
      bgClearBtn.addEventListener('click', function () {
        appearance.chatBg = null;
        persistAppearance();
        applyAppearance();
        updateBgPreview();
        if (bgUrlInput) bgUrlInput.value = '';
      });
    }

    var overlaySlider = document.getElementById('csOverlaySlider');
    var overlayValue = document.getElementById('csOverlayValue');
    if (overlaySlider) {
      overlaySlider.addEventListener('input', function () {
        var val = parseInt(overlaySlider.value, 10);
        appearance.overlayOpacity = val;
        if (overlayValue) overlayValue.textContent = val + '%';
        var overlay = document.querySelector('#pageChat .chat-bg-overlay');
        if (overlay) {
          overlay.style.background = 'rgba(0, 0, 0, ' + (val / 100) + ')';
        }
      });
      overlaySlider.addEventListener('change', function () {
        persistAppearance();
      });
    }

    var glassToggle = document.getElementById('csGlassToggle');
    if (glassToggle) {
      glassToggle.addEventListener('change', function () {
        appearance.glassEffect = glassToggle.checked;
        persistAppearance();
        applyAppearance();
      });
    }

    // ============ 聊天与字卡 Tab 的交互 ============
    bindChatTabEvents();
  }

  // ==================== 更新背景预览 ====================
  function updateBgPreview() {
    var preview = document.getElementById('csBgPreview');
    var empty = document.getElementById('csBgPreviewEmpty');
    if (!preview) return;
    if (appearance.chatBg) {
      preview.style.backgroundImage = "url('" + appearance.chatBg + "')";
      preview.style.backgroundSize = 'cover';
      preview.style.backgroundPosition = 'center';
      if (empty) empty.style.display = 'none';
    } else {
      preview.style.backgroundImage = '';
      if (empty) empty.style.display = 'flex';
    }
  }

  // ==================== 填充面板当前值 ====================
  function fillPanelValues() {
    updateBgPreview();

    var bgUrlInput = document.getElementById('csBgUrlInput');
    if (bgUrlInput) {
      bgUrlInput.value = (appearance.chatBg && appearance.chatBg.indexOf('data:') !== 0)
        ? appearance.chatBg : '';
    }

    var overlaySlider = document.getElementById('csOverlaySlider');
    var overlayValue = document.getElementById('csOverlayValue');
    if (overlaySlider) {
      overlaySlider.value = appearance.overlayOpacity;
      if (overlayValue) overlayValue.textContent = appearance.overlayOpacity + '%';
    }

    var glassToggle = document.getElementById('csGlassToggle');
    if (glassToggle) {
      glassToggle.checked = appearance.glassEffect;
    }
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

  // 渲染回复分类的公共/专属两个列表
  function renderReplyGroupLists() {
    var publicList = document.getElementById('csPublicGroupList');
    var privateList = document.getElementById('csPrivateGroupList');
    if (!publicList || !privateList) return;

    // 读取分组（category = 'reply'）
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

  // 渲染颜文字分组列表
  function renderEmojiGroupList() {
    var list = document.getElementById('csEmojiGroupList');
    if (!list) return;

    var groups = [];
    if (typeof window.getGroups === 'function') {
      // 颜文字在 card.js 中的分类名是 'kaomoji'
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

  // 渲染表情包分组列表
  function renderStickerGroupList() {
    var list = document.getElementById('csStickerGroupList');
    if (!list) return;

    // 表情包当前不分组的，只有 cardDatabase.sticker 一个数组
    // 但为了与分组概念统一，我们可以把它视为"默认分组"
    var stickerArr = (window.cardDatabase && window.cardDatabase.get)
      ? (window.cardDatabase.get('sticker') || [])
      : [];

    if (stickerArr.length === 0) {
      list.innerHTML = '<div class="cs-words-empty">还没有表情包，先去字卡收纳盒添加吧~</div>';
      return;
    }

    list.innerHTML = '';
    // 用一个虚拟分组名 "表情包"
    list.appendChild(createGroupCheckboxItem('表情包（全部）', 'sticker', 'sticker'));
  }

  // 创建单个分组勾选行
  function createGroupCheckboxItem(groupName, category, type) {
    var item = document.createElement('div');
    item.className = 'cs-group-item';

    // 判断是否已勾选
    var isChecked = false;
    if (type === 'public') {
      isChecked = publicGroups.indexOf(groupName) >= 0;
    } else if (type === 'private') {
      isChecked = privateGroups.indexOf(groupName) >= 0;
    } else if (type === 'emoji') {
      isChecked = emojiGroups.indexOf(groupName) >= 0;
    } else if (type === 'sticker') {
      isChecked = stickerGroups.indexOf(groupName) >= 0;
    }

    if (isChecked) item.classList.add('checked');

    // 获取颜色
    var color = '#5C7CFA';
    if (typeof window.getGroupColor === 'function') {
      color = window.getGroupColor(groupName, category);
    }

    // 获取字卡数量
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

    // 绑定勾选
    var checkbox = item.querySelector('input[type="checkbox"]');
    checkbox.addEventListener('change', function () {
      handleGroupCheckboxChange(groupName, type, checkbox.checked, item);
    });

    // 整行可点击
    item.addEventListener('click', function (e) {
      if (e.target.closest('.cs-group-checkbox')) return;
      checkbox.checked = !checkbox.checked;
      handleGroupCheckboxChange(groupName, type, checkbox.checked, item);
    });

    return item;
  }

  // 处理勾选变化
  function handleGroupCheckboxChange(groupName, type, checked, itemEl) {
    var targetArr = null;
    if (type === 'public') targetArr = publicGroups;
    else if (type === 'private') targetArr = privateGroups;
    else if (type === 'emoji') targetArr = emojiGroups;
    else if (type === 'sticker') targetArr = stickerGroups;

    if (!targetArr) return;

    var idx = targetArr.indexOf(groupName);
    if (checked && idx < 0) {
      targetArr.push(groupName);
    } else if (!checked && idx >= 0) {
      targetArr.splice(idx, 1);
    }

    if (itemEl) {
      itemEl.classList.toggle('checked', checked);
    }

    persistGroupSelections();
    updateAllGroupCounts();

    // 刷新字卡库
    if (typeof window.refreshCardUI === 'function') {
      window.refreshCardUI();
    }
  }

  // 更新计数
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

  // ==================== 绑定聊天 Tab 事件 ====================
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
      loadCardMode(function () {
        window.chatCardMode = cardMode;
        loadGroupSelections(function () {
          loadAppearance(function () {
            applyAppearance();
            fillPanelValues();
            switchTab(activeTab);
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
    applyAppearance: applyAppearance,
    refreshGroupCheckboxes: renderAllGroupLists,
    refreshGroupLists: renderAllGroupLists
  };

})();
