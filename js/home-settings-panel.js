/**
 * 主页图片自定义设置面板（独立模块 - 修正版）
 * - 新增"头像下的底图"设置项
 * - 上传文件使用 Blob/DataURL，保持原图清晰
 *
 * 【修复记录 2026-10-04】
 * - 修复①：上传文件成功后，把新的 DataURL 回填到对应的 URL 输入框，
 *   避免点「保存」时 setMany 用输入框里的旧值覆盖刚上传的新图。
 * - 修复②：change 处理末尾重置 input.value，保证再次选择同一文件
 *   也能触发 change（支持二次修改）。
 * 其余逻辑与原版完全一致。
 */

(function () {
  'use strict';

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
      // 背景图
      '      <div class="hs-row">',
      '        <div class="hs-label"><i class="fa-solid fa-mountain-sun"></i>主页背景图</div>',
      '        <input type="text" class="hs-input" id="hsBgUrl" placeholder="粘贴图片 URL">',
      '        <div class="hs-file-row">',
      '          <label class="hs-file-btn" for="hsBgFile"><i class="fa-solid fa-upload"></i>上传文件</label>',
      '          <input type="file" id="hsBgFile" accept="image/*" style="display:none;">',
      '          <span class="hs-file-name" id="hsBgName">未选择文件</span>',
      '        </div>',
      '      </div>',
      // 头像
      '      <div class="hs-row">',
      '        <div class="hs-label"><i class="fa-solid fa-user"></i>头像</div>',
      '        <input type="text" class="hs-input" id="hsAvatarUrl" placeholder="粘贴图片 URL">',
      '        <div class="hs-file-row">',
      '          <label class="hs-file-btn" for="hsAvatarFile"><i class="fa-solid fa-upload"></i>上传文件</label>',
      '          <input type="file" id="hsAvatarFile" accept="image/*" style="display:none;">',
      '          <span class="hs-file-name" id="hsAvatarName">未选择文件</span>',
      '        </div>',
      '      </div>',
      // 头像下的底图（新增）
      '      <div class="hs-row">',
      '        <div class="hs-label"><i class="fa-solid fa-id-card"></i>头像下的底图</div>',
      '        <input type="text" class="hs-input" id="hsHeaderBgUrl" placeholder="粘贴图片 URL">',
      '        <div class="hs-file-row">',
      '          <label class="hs-file-btn" for="hsHeaderBgFile"><i class="fa-solid fa-upload"></i>上传文件</label>',
      '          <input type="file" id="hsHeaderBgFile" accept="image/*" style="display:none;">',
      '          <span class="hs-file-name" id="hsHeaderBgName">未选择文件</span>',
      '        </div>',
      '      </div>',
      // 展示图1
      '      <div class="hs-row">',
      '        <div class="hs-label"><i class="fa-solid fa-image"></i>展示图 1</div>',
      '        <input type="text" class="hs-input" id="hsPhoto1Url" placeholder="粘贴图片 URL">',
      '        <div class="hs-file-row">',
      '          <label class="hs-file-btn" for="hsPhoto1File"><i class="fa-solid fa-upload"></i>上传文件</label>',
      '          <input type="file" id="hsPhoto1File" accept="image/*" style="display:none;">',
      '          <span class="hs-file-name" id="hsPhoto1Name">未选择文件</span>',
      '        </div>',
      '      </div>',
      // 展示图2
      '      <div class="hs-row">',
      '        <div class="hs-label"><i class="fa-solid fa-image"></i>展示图 2</div>',
      '        <input type="text" class="hs-input" id="hsPhoto2Url" placeholder="粘贴图片 URL">',
      '        <div class="hs-file-row">',
      '          <label class="hs-file-btn" for="hsPhoto2File"><i class="fa-solid fa-upload"></i>上传文件</label>',
      '          <input type="file" id="hsPhoto2File" accept="image/*" style="display:none;">',
      '          <span class="hs-file-name" id="hsPhoto2Name">未选择文件</span>',
      '        </div>',
      '      </div>',
      // 展示图3
      '      <div class="hs-row">',
      '        <div class="hs-label"><i class="fa-solid fa-image"></i>展示图 3</div>',
      '        <input type="text" class="hs-input" id="hsPhoto3Url" placeholder="粘贴图片 URL">',
      '        <div class="hs-file-row">',
      '          <label class="hs-file-btn" for="hsPhoto3File"><i class="fa-solid fa-upload"></i>上传文件</label>',
      '          <input type="file" id="hsPhoto3File" accept="image/*" style="display:none;">',
      '          <span class="hs-file-name" id="hsPhoto3Name">未选择文件</span>',
      '        </div>',
      '      </div>',
      // 音乐黑胶
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

    // 上传文件：立即应用（保持清晰）
    var pending = {};

    // URL 输入框 id 与数据键的对应表（回填用）
    var URL_MAP = {
      bg: 'hsBgUrl',
      avatar: 'hsAvatarUrl',
      headerBg: 'hsHeaderBgUrl',
      photo1: 'hsPhoto1Url',
      photo2: 'hsPhoto2Url',
      photo3: 'hsPhoto3Url',
      album: 'hsAlbumUrl',
      chatBg: 'hsChatBgUrl'
    };

    function bindFile(inputId, nameId, key) {
      var input = document.getElementById(inputId);
      var nameEl = document.getElementById(nameId);
      if (!input) return;
      input.addEventListener('change', function () {
        var file = input.files && input.files[0];
        if (!file) {
          nameEl.textContent = '未选择文件';
          delete pending[key];
          input.value = '';
          return;
        }
        nameEl.textContent = file.name;
        // 立即处理文件（保持清晰度，不做压缩）
        if (window.homeSettings && window.homeSettings.setFile) {
          window.homeSettings.setFile(key, file, function (dataUrl) {
            // 【修复①】上传成功后把新 DataURL 回填到对应 URL 输入框，
            // 防止点「保存」时 setMany 用旧值覆盖刚上传的新图
            var urlEl = document.getElementById(URL_MAP[key]);
            if (urlEl && dataUrl) urlEl.value = dataUrl;
            console.log('[home-settings] 已应用 ' + key);
          });
        }
        // 【修复②】重置 input.value，保证再次选择同一文件也能触发 change
        input.value = '';
      });
    }

    bindFile('hsBgFile', 'hsBgName', 'bg');
    bindFile('hsAvatarFile', 'hsAvatarName', 'avatar');
    bindFile('hsHeaderBgFile', 'hsHeaderBgName', 'headerBg');
    bindFile('hsPhoto1File', 'hsPhoto1Name', 'photo1');
    bindFile('hsPhoto2File', 'hsPhoto2Name', 'photo2');
    bindFile('hsPhoto3File', 'hsPhoto3Name', 'photo3');
    bindFile('hsAlbumFile', 'hsAlbumName', 'album');
    bindFile('hsChatBgFile', 'hsChatBgName', 'chatBg');

    // 恢复默认传讯背景
    var resetChatBg = document.getElementById('hsChatBgReset');
    if (resetChatBg) {
      resetChatBg.addEventListener('click', function () {
        if (window.homeSettings) {
          window.homeSettings.reset('chatBg');
        }
        var urlInput = document.getElementById('hsChatBgUrl');
        if (urlInput) urlInput.value = '';
        var nameEl = document.getElementById('hsChatBgName');
        if (nameEl) nameEl.textContent = '未选择文件';
      });
    }

    // 保存（主要处理 URL 输入）
    var saveBtn = document.getElementById('homeSettingsSave');
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        var updates = {};

        function pickUrl(id) {
          var el = document.getElementById(id);
          if (el && el.value.trim()) return el.value.trim();
          return undefined;
        }

        Object.keys(URL_MAP).forEach(function (key) {
          var v = pickUrl(URL_MAP[key]);
          if (v !== undefined) {
            updates[key] = v;
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
    createSettingsPanel();
    var panel = document.getElementById('homeSettingsPanel');
    if (!panel) return;

    var cur = window.homeSettings ? window.homeSettings.current : {};

    function setVal(id, val) {
      var el = document.getElementById(id);
      if (el) el.value = val || '';
    }

    setVal('hsBgUrl', cur.bg);
    setVal('hsAvatarUrl', cur.avatar);
    setVal('hsHeaderBgUrl', cur.headerBg);
    setVal('hsPhoto1Url', cur.photo1);
    setVal('hsPhoto2Url', cur.photo2);
    setVal('hsPhoto3Url', cur.photo3);
    setVal('hsAlbumUrl', cur.album);
    setVal('hsChatBgUrl', cur.chatBg);

    ['hsBgName', 'hsAvatarName', 'hsHeaderBgName', 'hsPhoto1Name', 'hsPhoto2Name', 'hsPhoto3Name', 'hsAlbumName', 'hsChatBgName'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.textContent = '未选择文件';
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
    createSettingsPanel();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
