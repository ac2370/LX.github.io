/**
 * 传讯页面 - 设置面板（独立模块）
 * - 绑定到底部导航栏现有的"设置"齿轮图标
 * - 4 个选项卡：个人资料、外观与界面、聊天与字卡、数据与工具
 * - 内容先留空，仅框架
 * - 完全独立，不影响任何现有逻辑
 */

(function () {
  'use strict';

  var STORE_KEY = 'chat_settings_panel_active_tab';

  // ==================== DOM 引用 ====================
  // 找到传讯页面底部导航栏的"设置"齿轮图标
  // 它位于底部"字卡"图标右侧（传讯页有自己独立的一套底部导航）
  var settingsTrigger = null;

  // ==================== 状态 ====================
  var activeTab = 'profile';

  // ==================== 持久化 ====================
  function persistTab() {
    if (typeof localforage !== 'undefined') {
      localforage.setItem(STORE_KEY, activeTab).catch(function () {});
    } else {
      try { localStorage.setItem(STORE_KEY, activeTab); } catch (e) {}
    }
  }

  function loadTab(callback) {
    if (typeof localforage !== 'undefined') {
      localforage.getItem(STORE_KEY).then(function (val) {
        if (val) activeTab = val;
        if (callback) callback();
      }).catch(function () { if (callback) callback(); });
    } else {
      try {
        var raw = localStorage.getItem(STORE_KEY);
        if (raw) activeTab = raw;
      } catch (e) {}
      if (callback) callback();
    }
  }

  // ==================== 找到设置齿轮图标 ====================
  function findSettingsTrigger() {
    // 优先级 1: 传讯页面内的"设置"图标
    // 底部导航栏的 id 是 tabSettingsHome，但它在主页底部
    // 传讯页有自己的图标布局

    // 先找传讯页 #pageChat 内所有可能的齿轮图标
    var pageChat = document.getElementById('pageChat');
    if (pageChat) {
      // 搜索页面内所有 fa-gear 图标
      var gears = pageChat.querySelectorAll('.fa-gear, .fa-cog');
      if (gears.length > 0) {
        // 取最后一个（通常在底部导航栏）
        return gears[gears.length - 1].closest('button, div[role="button"], .tab-btn, .chat-action-icon') || gears[gears.length - 1].parentElement;
      }
    }

    // 兜底：全局搜索 tabSettingsHome（主页底部的设置）
    var tabSettings = document.getElementById('tabSettingsHome');
    if (tabSettings) return tabSettings;

    return null;
  }

  // ==================== 绑定设置图标 ====================
  function bindSettingsTrigger() {
    if (settingsTrigger && settingsTrigger.dataset.chatSettingsBound) return;

    settingsTrigger = findSettingsTrigger();
    if (!settingsTrigger) return;

    if (settingsTrigger.dataset.chatSettingsBound) return;
    settingsTrigger.dataset.chatSettingsBound = '1';

    // 保存原始的点击行为（如果有）不影响它，只额外添加
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
      '      <div class="chat-settings-section-title">外观与界面</div>',
      '      <div class="chat-settings-placeholder">',
      '        <i class="fa-solid fa-palette"></i>',
      '        <p>背景、字体、气泡颜色、背景蒙层、毛玻璃开关</p>',
      '      </div>',
      '    </div>',

      // Tab 3: 聊天与字卡
      '    <div class="chat-settings-tab-panel" data-panel="chat">',
      '      <div class="chat-settings-section-title">聊天与字卡</div>',
      '      <div class="chat-settings-placeholder">',
      '        <i class="fa-solid fa-comments"></i>',
      '        <p>回复节奏、公共 / 专属字卡机制</p>',
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

    var tabs = panel.querySelectorAll('.chat-settings-tab');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var target = tab.getAttribute('data-tab');
        if (!target) return;
        activeTab = target;
        switchTab(target);
        persistTab();
      });
    });
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
  }

  // ==================== 打开/关闭 ====================
  function openPanel() {
    createPanel();
    var panel = document.getElementById('chatSettingsPanel');
    if (!panel) return;
    switchTab(activeTab);
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
      switchTab(activeTab);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 多次尝试绑定（因为某些图标是动态生成的）
  setTimeout(bindSettingsTrigger, 300);
  setTimeout(bindSettingsTrigger, 800);
  setTimeout(bindSettingsTrigger, 1500);
  setTimeout(bindSettingsTrigger, 3000);

  // 暴露给外部
  window.chatSettingsPanel = {
    open: openPanel,
    close: closePanel,
    switchTab: switchTab
  };

})();
