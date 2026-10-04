/**
 * 主页图片自定义 · 面板（重写版）
 * - 调色盘按钮 #homeSettingsBtn
 * - 面板：主页 tab（7 项）+ 传讯背景 tab（1 项）
 * - 每项：URL 输入 + 上传文件
 * - 上传立即应用；保存统一写入 URL
 */

(function () {
  'use strict';

  // 7 个主页设置项 + 1 个传讯背景项
  // key 与 home-settings.js 的 DEFAULTS 对应
  var ITEMS = [
    { key: 'bg',       label: '主页背景图',     icon: 'fa-mountain-sun',     tab: 'home' },
    { key: 'avatar',   label: '头像',           icon: 'fa-user',             tab: 'home' },
    { key: 'headerBg', label: '头像下的底图',   icon: 'fa-id-card',          tab: 'home' },
    { key: 'photo1',   label: '展示图 1',       icon: 'fa-image',            tab: 'home' },
    { key: 'photo2',   label: '展示图 2',       icon: 'fa-image',            tab: 'home' },
    { key: 'photo3',   label: '展示图 3',       icon: 'fa-image',            tab: 'home' },
    { key: 'album',    label: '音乐黑胶封面',   icon: 'fa-music',            tab: 'home' },
    { key: 'chatBg',   label: '传讯背景图',     icon: 'fa-comment-dots',     tab: 'chat' }
  ];

  var panelCreated = false;

  // ==================== 按钮 ====================
  function createButton() {
    if (document.getElementById('homeSettingsBtn')) return;
    var btn = document.createElement('button');
    btn.id = 'homeSettingsBtn';
    btn.className = 'home-settings-btn';
    btn.title = '自定义主页图片';
    btn.innerHTML = '<i class="fa-solid fa-palette"></i>';
    var pageHome = document.getElementById('pageHome');
    if (pageHome) pageHome.appendChild(btn);
    btn.addEventListener('click', openPanel);
  }

  // ==================== 面板 ====================
  function createPanel() {
    if (panelCreated) return;
    panelCreated = true;

    var panel = document.createElement('div');
    panel.id = 'homeSettingsPanel';
    panel.className = 'home-settings-panel';

    var html = '<div class="home-settings-panel-inner">';

    // 头部
    html += '<div class="home-settings-header">';
    html += '<span class="home-settings-title"><i class="fa-solid fa-image"></i> 图片自定义</span>';
    html += '<button class="home-settings-close" id="homeSettingsClose"><i class="fa-solid fa-xmark"></i></button>';
    html += '</div>';

    // Tab
    html += '<div class="home-settings-tabs">';
    html += '<button class="home-settings-tab active" data-tab="home">主页</button>';
    html += '<button class="home-settings-tab" data-tab="chat">传讯背景</button>';
    html += '</div>';

    // 内容
    html += '<div class="home-settings-body">';

    // 主页 tab
    html += '<div class="home-settings-tab-panel active" data-panel="home">';
    ITEMS.filter(function (it) { return it.tab === 'home'; }).forEach(function (it) {
      html += renderItem(it);
    });
    html += '</div>';

    // 传讯背景 tab
    html += '<div class="home-settings-tab-panel" data-panel="chat">';
    ITEMS.filter(function (it) { return it.tab === 'chat'; }).forEach(function (it) {
      html += renderItem(it);
    });
    html += '<div class="hs-hint">设置后，传讯页面的聊天背景会更换为这张图。</div>';
    html += '<button class="hs-reset-btn" id="hsChatBgReset"><i class="fa-solid fa-rotate-left"></i> 恢复默认背景</button>';
    html += '</div>';

    html += '</div>'; // body

    // 底部
    html += '<div class="home-settings-footer">';
    html += '<button class="hs-btn hs-btn-cancel" id="homeSettingsCancel">取消</button>';
    html += '<button class="hs-btn hs-btn-save" id="homeSettingsSave">保存</button>';
    html += '</div>';

    html += '</div>'; // inner

    panel.innerHTML = html;
    document.body.appendChild(panel);

    bindPanelEvents();
  }

  function renderItem(it) {
    var uid = 'hs-' + it.key;
    return '' +
      '<div class="hs-row">' +
        '<div class="hs-label"><i class="fa-solid ' + it.icon + '"></i>' + it.label + '</div>' +
        '<input type="text" class="hs-input" id="' + uid + '-url" placeholder="粘贴图片 URL">' +
        '<div class="hs-file-row">' +
          '<label class="hs-file-btn" for="' + uid + '-file"><i class="fa-solid fa-upload"></i>上传文件</label>' +
          '<input type="file" id="' + uid + '-file" accept="image/*" style="display:none;">' +
          '<span class="hs-file-name" id="' + uid + '-name">未选择文件</span>' +
        '</div>' +
      '</div>';
  }

  // ==================== 事件 ====================
  function bindPanelEvents() {
    var panel = document.getElementById('homeSettingsPanel');
    if (!panel) return;

    // 关闭 / 取消
    var closeBtn = document.getElementById('homeSettingsClose');
    if (closeBtn) closeBtn.addEventListener('click', closePanel);
    var cancelBtn = document.getElementById('homeSettingsCancel');
    if (cancelBtn) cancelBtn.addEventListener('click', closePanel);
    panel.addEventListener('click', function (e) {
      if (e.target === panel) closePanel();
    });

    // Tab
    var tabs = panel.querySelectorAll('.home-settings-tab');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var target = tab.getAttribute('data-tab');
        tabs.forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');
        panel.querySelectorAll('.home-settings-tab-panel').forEach(function (p) {
          p.classList.toggle('active', p.getAttribute('data-panel') === target);
        });
      });
    });

    // 每个设置项：文件上传
    ITEMS.forEach(function (it) {
      var uid = 'hs-' + it.key;
      var fileInput = document.getElementById(uid + '-file');
      var nameEl = document.getElementById(uid + '-name');
      if (!fileInput) return;

      fileInput.addEventListener('change', function () {
        var file = fileInput.files && fileInput.files[0];
        if (!file) {
          if (nameEl) nameEl.textContent = '未选择文件';
          return;
        }
        if (nameEl) nameEl.textContent = file.name;
        if (window.homeSettings && window.homeSettings.setFile) {
          window.homeSettings.setFile(it.key, file, function () {
            console.log('[home-settings] 已应用 ' + it.key);
          });
        }
      });
    });

    // 恢复默认传讯背景
    var resetBtn = document.getElementById('hsChatBgReset');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        if (window.homeSettings) window.homeSettings.reset('chatBg');
        var url = document.getElementById('hs-chatBg-url');
        if (url) url.value = '';
        var name = document.getElementById('hs-chatBg-name');
        if (name) name.textContent = '未选择文件';
      });
    }

    // 保存
    var saveBtn = document.getElementById('homeSettingsSave');
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        var updates = {};
        ITEMS.forEach(function (it) {
          var uid = 'hs-' + it.key;
          var el = document.getElementById(uid + '-url');
          if (el) {
            var v = el.value.trim();
            if (v) updates[it.key] = v;
          }
        });
        if (window.homeSettings && Object.keys(updates).length > 0) {
          window.homeSettings.setMany(updates);
        }
        closePanel();
      });
    }
  }

  // ==================== 打开 / 关闭 ====================
  function openPanel() {
    createPanel();
    var panel = document.getElementById('homeSettingsPanel');
    if (!panel) return;

    var cur = (window.homeSettings && window.homeSettings.current) || {};

    ITEMS.forEach(function (it) {
      var uid = 'hs-' + it.key;
      var urlEl = document.getElementById(uid + '-url');
      if (urlEl) urlEl.value = cur[it.key] || '';
      var nameEl = document.getElementById(uid + '-name');
      if (nameEl) nameEl.textContent = '未选择文件';
    });

    panel.classList.add('active');
  }

  function closePanel() {
    var panel = document.getElementById('homeSettingsPanel');
    if (panel) panel.classList.remove('active');
  }

  // ==================== 初始化 ====================
  function init() {
    createButton();
    // 面板懒创建（openPanel 时创建）
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  console.log('[home-settings-panel] v3 已加载');

})();
