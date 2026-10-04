/**
 * 主页图片自定义设置面板（重写版）
 * - 确保面板只创建一次
 * - 每个设置项独立绑定（key ↔ input 一一对应）
 * - 上传文件后立即应用 + 回填文件名
 * - 保存时收集所有 URL 统一写入
 */

(function () {
  'use strict';

  // 8 个设置项：key → { urlId, fileId, nameId }
  var FIELDS = [
    { key: 'bg',       urlId: 'hsBgUrl',       fileId: 'hsBgFile',       nameId: 'hsBgName' },
    { key: 'avatar',   urlId: 'hsAvatarUrl',   fileId: 'hsAvatarFile',   nameId: 'hsAvatarName' },
    { key: 'headerBg', urlId: 'hsHeaderBgUrl', fileId: 'hsHeaderBgFile', nameId: 'hsHeaderBgName' },
    { key: 'photo1',   urlId: 'hsPhoto1Url',   fileId: 'hsPhoto1File',   nameId: 'hsPhoto1Name' },
    { key: 'photo2',   urlId: 'hsPhoto2Url',   fileId: 'hsPhoto2File',   nameId: 'hsPhoto2Name' },
    { key: 'photo3',   urlId: 'hsPhoto3Url',   fileId: 'hsPhoto3File',   nameId: 'hsPhoto3Name' },
    { key: 'album',    urlId: 'hsAlbumUrl',    fileId: 'hsAlbumFile',    nameId: 'hsAlbumName' },
    { key: 'chatBg',   urlId: 'hsChatBgUrl',   fileId: 'hsChatBgFile',   nameId: 'hsChatBgName' }
  ];

  // ==================== 创建设置按钮 ====================
  function createSettingsButton() {
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

  // ==================== 创建设置面板 ====================
  function createSettingsPanel() {
    // 已存在就直接返回，避免重复创建
    if (document.getElementById('homeSettingsPanel')) return;

    var panel = document.createElement('div');
    panel.id = 'homeSettingsPanel';
    panel.className = 'home-settings-panel';
    panel.innerHTML = [
      '<div class="home-settings-panel-inner">',
      '  <div class="home-settings-header">',
      '    <span class="home-settings-title"><i class="fa-solid fa-image"></i> 图片自定义</span>',
      '    <button class="home-settings-close" id="homeSettingsClose"><i class="fa-solid fa-xmark"></i></button>',
      '  </div>',
      '  <div class="home-settings-tabs">',
      '    <button class="home-settings-tab active" data-tab="home">主页</button>',
      '    <button class="home-settings-tab" data-tab="chat">传讯背景</button>',
      '  </div>',
      '  <div class="home-settings-body">',
      // ============ 主页 Tab ============
      '    <div class="home-settings-tab-panel active" data-panel="home">',
      '      <div class="hs-row">',
      '        <div class="hs-label"><i class="fa-solid fa-mountain-sun"></i>主页背景图</div>',
      '        <input type="text" class="hs-input" id="hsBgUrl" placeholder="粘贴图片 URL">',
      '        <div class="hs-file-row">',
      '          <label class="hs-file-btn" for="hsBgFile"><i class="fa-solid fa-upload"></i>上传文件</label>',
      '          <input type="file" id="hsBgFile" accept="image/*" style="display:none;">',
      '          <span class="hs-file-name" id="hsBgName">未选择文件</span>',
      '        </div>',
      '      </div>',
      '      <div class="hs-row">',
      '        <div class="hs-label"><i class="fa-solid fa-user"></i>头像</div>',
      '        <input type="text" class="hs-input" id="hsAvatarUrl" placeholder="粘贴图片 URL">',
      '        <div class="hs-file-row">',
      '          <label class="hs-file-btn" for="hsAvatarFile"><i class="fa-solid fa-upload"></i>上传文件</label>',
      '          <input type="file" id="hsAvatarFile" accept="image/*" style="display:none;">',
      '          <span class="hs-file-name" id="hsAvatarName">未选择文件</span>',
      '        </div>',
      '      </div>',
      '      <div class="hs-row">',
      '        <div class="hs-label"><i class="fa-solid fa-id-card"></i>头像下的底图</div>',
      '        <input type="text" class="hs-input" id="hsHeaderBgUrl" placeholder="粘贴图片 URL">',
      '        <div class="hs-file-row">',
      '          <label class="hs-file-btn" for="hsHeaderBgFile"><i class="fa-solid fa-upload"></i>上传文件</label>',
      '          <input type="file" id="hsHeaderBgFile" accept="image/*" style="display:none;">',
      '          <span class="hs-file-name" id="hsHeaderBgName">未选择文件</span>',
      '        </div>',
      '      </div>',
      '      <div class="hs-row">',
      '        <div class="hs-label"><i class="fa-solid fa-image"></i>展示图 1</div>',
      '        <input type="text" class="hs-input" id="hsPhoto1Url" placeholder="粘贴图片 URL">',
      '        <div class="hs-file-row">',
      '          <label class="hs-file-btn" for="hsPhoto1File"><i class="fa-solid fa-upload"></i>上传文件</label>',
      '          <input type="file" id="hsPhoto1File" accept="image/*" style="display:none;">',
      '          <span class="hs-file-name" id="hsPhoto1Name">未选择文件</span>',
      '        </div>',
      '      </div>',
      '      <div class="hs-row">',
      '        <div class="hs-label"><i class="fa-solid fa-image"></i>展示图 2</div>',
      '        <input type="text" class="hs-input" id="hsPhoto2Url" placeholder="粘贴图片 URL">',
      '        <div class="hs-file-row">',
      '          <label class="hs-file-btn" for="hsPhoto2File"><i class="fa-solid fa-upload"></i>上传文件</label>',
      '          <input type="file" id="hsPhoto2File" accept="image/*" style="display:none;">',
      '          <span class="hs-file-name" id="hsPhoto2Name">未选择文件</span>',
      '        </div>',
      '      </div>',
      '      <div class="hs-row">',
      '        <div class="hs-label"><i class="fa-solid fa-image"></i>展示图 3</div>',
      '        <input type="text" class="hs-input" id="hsPhoto3Url" placeholder="粘贴图片 URL">',
      '        <div class="hs-file-row">',
      '          <label class="hs-file-btn" for="hsPhoto3File"><i class="fa-solid fa-upload"></i>上传文件</label>',
      '          <input type="file" id="hsPhoto3File" accept="image/*" style="display:none;">',
      '          <span class="hs-file-name" id="hsPhoto3Name">未选择文件</span>',
      '        </div>',
      '      </div>',
      '      <div class="hs-row">',
      '        <div class="hs-label"><i class="fa-solid fa-music"></i>音乐黑胶封面</div>',
      '        <input type="text" class="hs-input" id="hsAlbumUrl" placeholder="粘贴图片 URL">',
      '        <div class="hs-file-row">',
      '          <label class="hs-file-btn" for="hsAlbumFile"><i class="fa-solid fa-upload"></i>上传文件</label>',
      '          <input type="file" id="hsAlbumFile" accept="image/*" style="display:none;">',
      '          <span class="hs-file-name" id="hsAlbumName">未选择文件</span>',
      '        </div>',
      '      </div>',
      '    </div>',
      // ============ 传讯背景 Tab ============
      '    <div class="home-settings-tab-panel" data-panel="chat">',
      '      <div class="hs-row">',
      '        <div class="hs-label"><i class="fa-solid fa-comment-dots"></i>传讯背景图</div>',
      '        <input type="text" class="hs-input" id="hsChatBgUrl" placeholder="粘贴图片 URL">',
      '        <div class="hs-file-row">',
      '          <label class="hs-file-btn" for="hsChatBgFile"><i class="fa-solid fa-upload"></i>上传文件</label>',
      '          <input type="file" id="hsChatBgFile" accept="image/*" style="display:none;">',
      '          <span class="hs-file-name" id="hsChatBgName">未选择文件</span>',
      '        </div>',
      '      </div>',
      '      <div class="hs-hint">设置后，传讯页面的聊天背景会更换为这张图。聊天消息气泡仍保持原有样式。</div>',
      '      <button class="hs-reset-btn" id="hsChatBgReset"><i class="fa-solid fa-rotate-left"></i> 恢复默认背景</button>',
      '    </div>',
      '  </div>',
      '  <div class="home-settings-footer">',
      '    <button class="hs-btn hs-btn-cancel" id="homeSettingsCancel">取消</button>',
      '    <button class="hs-btn hs-btn-save" id="homeSettingsSave">保存</button>',
      '  </div>',
      '</div>'
    ].join('');

    document.body.appendChild(panel);

    bindPanelEvents();
  }

  // ==================== 面板事件绑定 ====================
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

    // Tab 切换
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

    // ==================== 每个设置项：文件上传 ====================
    FIELDS.forEach(function (field) {
      var input = document.getElementById(field.fileId);
      var nameEl = document.getElementById(field.nameId);
      if (!input) return;

      input.addEventListener('change', function () {
        var file = input.files && input.files[0];
        if (!file) {
          if (nameEl) nameEl.textContent = '未选择文件';
          return;
        }
        if (nameEl) nameEl.textContent = file.name;
        // 立即应用
        if (window.homeSettings && window.homeSettings.setFile) {
          window.homeSettings.setFile(field.key, file, function () {
            console.log('[home-settings] 已应用 ' + field.key);
          });
        }
      });
    });

    // 恢复默认传讯背景
    var resetChatBg = document.getElementById('hsChatBgReset');
    if (resetChatBg) {
      resetChatBg.addEventListener('click', function () {
        if (window.homeSettings) window.homeSettings.reset('chatBg');
        var urlInput = document.getElementById('hsChatBgUrl');
        if (urlInput) urlInput.value = '';
        var nameEl = document.getElementById('hsChatBgName');
        if (nameEl) nameEl.textContent = '未选择文件';
      });
    }

    // ==================== 保存（收集所有 URL） ====================
    var saveBtn = document.getElementById('homeSettingsSave');
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        var updates = {};
        FIELDS.forEach(function (field) {
          var el = document.getElementById(field.urlId);
          if (el) {
            var v = el.value.trim();
            if (v) updates[field.key] = v;
          }
        });

        if (window.homeSettings && Object.keys(updates).length > 0) {
          window.homeSettings.setMany(updates);
        }
        closePanel();
      });
    }
  }

  // ==================== 打开/关闭面板 ====================
  function openPanel() {
    // 确保面板存在（只创建一次）
    createSettingsPanel();
    var panel = document.getElementById('homeSettingsPanel');
    if (!panel) return;

    var cur = (window.homeSettings && window.homeSettings.current) || {};

    // 回填当前值
    FIELDS.forEach(function (field) {
      var el = document.getElementById(field.urlId);
      if (el) el.value = cur[field.key] || '';
      var nameEl = document.getElementById(field.nameId);
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
    createSettingsButton();
    // 注意：面板懒创建（在 openPanel 时创建），这里不预先创建
    // 避免"面板已被创建但事件绑了两次"的问题
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
