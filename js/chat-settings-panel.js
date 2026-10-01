/**
 * 传讯页面 - 设置面板（独立模块）
 * - 4 个选项卡：个人资料、外观与界面、聊天与字卡、数据与工具
 * - 内容先留空，仅框架
 * - 完全独立，不影响任何现有逻辑
 */

(function () {
  'use strict';

  var STORE_KEY = 'chat_settings_panel_active_tab';

  // ==================== DOM 引用 ====================
  var pageChat = document.getElementById('pageChat');
  var chatHeader = pageChat ? pageChat.querySelector('.chat-header') : null;

  if (!pageChat || !chatHeader) return;

  // ==================== 状态 ====================
  var activeTab = 'profile'; // 'profile' | 'appearance' | 'chat' | 'data'

  // ==================== 持久化（记住上次所在 Tab） ====================
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

  // ==================== 创建设置按钮（右上角齿轮） ====================
  function createSettingsButton() {
    if (document.getElementById('chatSettingsBtn')) return;

    var btn = document.createElement('button');
    btn.id = 'chatSettingsBtn';
    btn.className = 'chat-settings-btn';
    btn.title = '设置';
    btn.innerHTML = '<i class="fa-solid fa-gear"></i>';

    // 挂到传讯页面顶栏的右上角
    chatHeader.appendChild(btn);

    btn.addEventListener('click', function (e) {
      e.stopImmediatePropagation();
      e.preventDefault();
      openPanel();
    });
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
      '        <p>背景、字体、气泡颜色</p>',
      '      </div>',
      '    </div>',

      // Tab 3: 聊天与字卡
      '    <div class="chat-settings-tab-panel" data-panel="chat">',
      '      <div class="chat-settings-section-title">聊天与字卡</div>',
      '      <div class="chat-settings-placeholder">',
      '        <i class="fa-solid fa-comments"></i>',
      '        <p>回复节奏、字卡机制</p>',
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

    // 关闭
    var closeBtn = document.getElementById('chatSettingsClose');
    if (closeBtn) closeBtn.addEventListener('click', closePanel);

    // 点击遮罩关闭
    panel.addEventListener('click', function (e) {
      if (e.target === panel) closePanel();
    });

    // Tab 切换
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

    // 更新 Tab 按钮
    panel.querySelectorAll('.chat-settings-tab').forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-tab') === tabName);
    });

    // 更新内容面板
    panel.querySelectorAll('.chat-settings-tab-panel').forEach(function (p) {
      p.classList.toggle('active', p.getAttribute('data-panel') === tabName);
    });
  }

  // ==================== 打开/关闭面板 ====================
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
    createSettingsButton();
    createPanel();
    loadTab(function () {
      switchTab(activeTab);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  setTimeout(init, 500);
  setTimeout(init, 1500);

  // 暴露给外部
  window.chatSettingsPanel = {
    open: openPanel,
    close: closePanel,
    switchTab: switchTab
  };

})();
