/**
 * 主页图片自定义设置面板（独立模块）
 * - 动态注入设置按钮和面板
 * - 不修改任何现有 HTML 结构
 * - 只挂在主页 #pageHome 上
 */

(function () {
  'use strict';

  // ==================== 创建设置按钮 ====================
  function createSettingsButton() {
    // 防止重复创建
    if (document.getElementById('homeSettingsBtn')) return;

    var btn = document.createElement('button');
    btn.id = 'homeSettingsBtn';
    btn.className = 'home-settings-btn';
    btn.title = '自定义主页图片';
    btn.innerHTML = '<i class="fa-solid fa-palette"></i>';

    // 挂在主页容器内（只出现在主页）
    var pageHome = document.getElementById('pageHome');
    if (pageHome) {
      pageHome.appendChild(btn);
    }

    btn.addEventListener('click', function () {
      openPanel();
    });
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

    // 关闭
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

    // 文件选择预览（不立即应用，等保存）
    var pendingFiles = {};
    function bindFile(inputId, nameId, key) {
      var input = document.getElementById(inputId);
      var nameEl = document.getElementById(nameId);
      if (!input) return;
      input.addEventListener('change', function () {
        var file = input.files && input.files[0];
        if (file) {
          nameEl.textContent = file.name;
          var reader = new FileReader();
          reader.onload = function (e) {
            pendingFiles[key] = e.target.result;
          };
          reader.readAsDataURL(file);
        } else {
          nameEl.textContent = '未选择文件';
          delete pendingFiles[key];
        }
      });
    }

    bindFile('hsBgFile', 'hsBgName', 'bg');
    bindFile('hsAvatarFile', 'hsAvatarName', 'avatar');
    bindFile('hsPhoto1File', 'hsPhoto1Name', 'photo1');
    bindFile('hsPhoto2File', 'hsPhoto2Name', 'photo2');
    bindFile('hsPhoto3File', 'hsPhoto3Name', 'photo3');
    bindFile('hsAlbumFile', 'hsAlbumName', 'album');
    bindFile('hsChatBgFile', 'hsChatBgName', 'chatBg');

    // 恢复默认传讯背景
    var resetChatBg = document.getElementById('hsChatBgReset');
    if (resetChatBg) {
      resetChatBg.addEventListener('click', function () {
        pendingFiles.chatBg = null;
        var urlInput = document.getElementById('hsChatBgUrl');
        if (urlInput) urlInput.value = '';
        var nameEl = document.getElementById('hsChatBgName');
        if (nameEl) nameEl.textContent = '未选择文件';
        window.homeSettings.set('chatBg', null);
      });
    }

    // 保存
    var saveBtn = document.getElementById('homeSettingsSave');
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        var updates = {};

        // 优先使用本地文件（pendingFiles），否则用 URL 输入
        function pick(fileKey, urlId) {
          if (pendingFiles[fileKey]) return pendingFiles[fileKey];
          var urlEl = document.getElementById(urlId);
          if (urlEl && urlEl.value.trim()) return urlEl.value.trim();
          return undefined;
        }

        var bg = pick('bg', 'hsBgUrl');
        if (bg !== undefined) updates.bg = bg;

        var avatar = pick('avatar', 'hsAvatarUrl');
        if (avatar !== undefined) updates.avatar = avatar;

        var p1 = pick('photo1', 'hsPhoto1Url');
        if (p1 !== undefined) updates.photo1 = p1;

        var p2 = pick('photo2', 'hsPhoto2Url');
        if (p2 !== undefined) updates.photo2 = p2;

        var p3 = pick('photo3', 'hsPhoto3Url');
        if (p3 !== undefined) updates.photo3 = p3;

        var album = pick('album', 'hsAlbumUrl');
        if (album !== undefined) updates.album = album;

        var chatBg = pick('chatBg', 'hsChatBgUrl');
        if (chatBg !== undefined) updates.chatBg = chatBg;
        else if (pendingFiles.chatBg === null) updates.chatBg = null;

        if (window.homeSettings) {
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

    // 用当前值填充输入框
    var cur = window.homeSettings ? window.homeSettings.current : {};

    function setVal(id, val) {
      var el = document.getElementById(id);
      if (el) el.value = val || '';
    }

    setVal('hsBgUrl', cur.bg);
    setVal('hsAvatarUrl', cur.avatar);
    setVal('hsPhoto1Url', cur.photo1);
    setVal('hsPhoto2Url', cur.photo2);
    setVal('hsPhoto3Url', cur.photo3);
    setVal('hsAlbumUrl', cur.album);
    setVal('hsChatBgUrl', cur.chatBg);

    // 重置文件名
    ['hsBgName', 'hsAvatarName', 'hsPhoto1Name', 'hsPhoto2Name', 'hsPhoto3Name', 'hsAlbumName', 'hsChatBgName'].forEach(function (id) {
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
    // 预创建面板（隐藏状态），确保事件绑定
    createSettingsPanel();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
