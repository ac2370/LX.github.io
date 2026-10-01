/**
 * 传讯页面 - 设置面板（独立模块）
 * - 绑定到底部导航栏现有的"设置"齿轮图标
 * - Tab 1：个人资料（占位）
 * - Tab 2：外观与界面（背景图 + 蒙层 + 毛玻璃）
 * - Tab 3：聊天与字卡（占位）
 * - Tab 4：数据与工具（占位）
 * - 完全独立，不影响任何现有逻辑
 */

(function () {
  'use strict';

  var STORE_KEY_TAB = 'chat_settings_panel_active_tab';
  var STORE_KEY_APPEARANCE = 'chat_settings_appearance';

  // ==================== 状态 ====================
  var activeTab = 'profile';
  var appearance = {
    chatBg: null,          // 聊天背景图 URL 或 DataURL
    overlayOpacity: 30,    // 蒙层深浅度 0-100
    glassEffect: true      // 毛玻璃开关
  };

  var settingsTrigger = null;

  // ==================== 持久化 ====================
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

  // ==================== 应用外观到传讯页面 ====================
  function applyAppearance() {
    var pageChat = document.getElementById('pageChat');
    if (!pageChat) return;

    // 确保页面有 overlay 元素
    var overlay = pageChat.querySelector('.chat-bg-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'chat-bg-overlay';
      // 插入到 chat-header 之前（作为第一个子元素）
      pageChat.insertBefore(overlay, pageChat.firstChild);
    }

    // 设置背景图（挂在 pageChat 上，overlay 作为蒙层）
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

    // 蒙层深浅度
    overlay.style.background = 'rgba(0, 0, 0, ' + (appearance.overlayOpacity / 100) + ')';

    // 毛玻璃开关：加到 pageChat 上的类
    if (appearance.glassEffect) {
      pageChat.classList.add('glass-on');
      pageChat.classList.remove('glass-off');
    } else {
      pageChat.classList.add('glass-off');
      pageChat.classList.remove('glass-on');
    }

    // 让聊天消息区透明，让背景图透出
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

      // 区块 1：聊天背景图
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

      // 区块 2：背景蒙层深浅度
      '      <div class="chat-settings-section">',
      '        <div class="chat-settings-section-title">背景蒙层深浅度</div>',
      '        <div class="cs-slider-row">',
      '          <input type="range" class="cs-slider" id="csOverlaySlider" min="0" max="100" value="30">',
      '          <span class="cs-slider-value" id="csOverlayValue">30%</span>',
      '        </div>',
      '        <div class="cs-slider-hint">拖拽滑块调整背景图上方蒙层的深浅度</div>',
      '      </div>',

      // 区块 3：毛玻璃开关
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

      // Tab 3: 聊天与字卡（占位）
      '    <div class="chat-settings-tab-panel" data-panel="chat">',
      '      <div class="chat-settings-section-title">聊天与字卡</div>',
      '      <div class="chat-settings-placeholder">',
      '        <i class="fa-solid fa-comments"></i>',
      '        <p>回复节奏、公共 / 专属字卡机制</p>',
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

    // 1. 上传本地图片
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

    // 2. 粘贴 URL 并应用
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

    // 3. 恢复默认
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

    // 4. 蒙层滑块
    var overlaySlider = document.getElementById('csOverlaySlider');
    var overlayValue = document.getElementById('csOverlayValue');
    if (overlaySlider) {
      overlaySlider.addEventListener('input', function () {
        var val = parseInt(overlaySlider.value, 10);
        appearance.overlayOpacity = val;
        if (overlayValue) overlayValue.textContent = val + '%';
        // 实时预览
        var overlay = document.querySelector('#pageChat .chat-bg-overlay');
        if (overlay) {
          overlay.style.background = 'rgba(0, 0, 0, ' + (val / 100) + ')';
        }
      });
      overlaySlider.addEventListener('change', function () {
        persistAppearance();
      });
    }

    // 5. 毛玻璃开关
    var glassToggle = document.getElementById('csGlassToggle');
    if (glassToggle) {
      glassToggle.addEventListener('change', function () {
        appearance.glassEffect = glassToggle.checked;
        persistAppearance();
        applyAppearance();
      });
    }
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
    // 背景预览
    updateBgPreview();

    // URL 输入框
    var bgUrlInput = document.getElementById('csBgUrlInput');
    if (bgUrlInput) {
      // 如果是 URL（非 DataURL）才显示在输入框
      bgUrlInput.value = (appearance.chatBg && appearance.chatBg.indexOf('data:') !== 0)
        ? appearance.chatBg : '';
    }

    // 蒙层滑块
    var overlaySlider = document.getElementById('csOverlaySlider');
    var overlayValue = document.getElementById('csOverlayValue');
    if (overlaySlider) {
      overlaySlider.value = appearance.overlayOpacity;
      if (overlayValue) overlayValue.textContent = appearance.overlayOpacity + '%';
    }

    // 毛玻璃开关
    var glassToggle = document.getElementById('csGlassToggle');
    if (glassToggle) {
      glassToggle.checked = appearance.glassEffect;
    }
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

    // 切到外观 Tab 时刷新预览
    if (tabName === 'appearance') {
      fillPanelValues();
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
      loadAppearance(function () {
        applyAppearance();
        fillPanelValues();
        switchTab(activeTab);
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
    applyAppearance: applyAppearance
  };

})();
