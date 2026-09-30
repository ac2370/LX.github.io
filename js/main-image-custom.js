/**
 * 主页图片自定义逻辑（独立模块）
 * - 支持设置：主页背景图、我的头像、对方(梦角)头像、主页底图、音乐黑胶唱片封面
 * - 每一项支持：粘贴 URL / 上传本地文件
 * - 使用 localforage 持久化（Base64 或 URL 字符串）
 * - 严格不修改主页结构，只通过 id 定位
 */

(function () {
  'use strict';

  // ==================== 存储 Key ====================
  var STORE_KEY = 'main_custom_images_v1';

  // ==================== 图片项配置 ====================
  // targetId 对应 DOM 中的元素 id
  // type: 'img' 表示直接替换 src；'bg' 表示替换 backgroundImage
  var IMAGE_ITEMS = [
    { key: 'homeBg',      label: '主页背景图',      targetId: 'bgDream',        type: 'bg'  },
    { key: 'myAvatar',    label: '我的头像',        targetId: 'avatarImg',      type: 'img' },
    { key: 'partnerAvatar', label: '对方（梦角）头像', targetId: 'chatAvatar',   type: 'img' },
    { key: 'homeHeaderBg', label: '主页底图（顶部矩形背景图）', targetId: 'headerCard', type: 'bg' },
    { key: 'albumCover',  label: '音乐播放器黑胶唱片封面', targetId: 'albumCover', type: 'img' }
  ];

  // ==================== 当前图片数据 ====================
  var imageData = {
    homeBg: '',
    myAvatar: '',
    partnerAvatar: '',
    homeHeaderBg: '',
    albumCover: ''
  };

  // ==================== 工具 ====================
  function hasLocalforage() {
    return typeof localforage !== 'undefined';
  }

  function saveData() {
    if (hasLocalforage()) {
      localforage.setItem(STORE_KEY, imageData).catch(function (e) {
        console.warn('[main-image] 保存失败', e);
      });
    } else {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(imageData)); } catch (e) {}
    }
  }

  function loadData(callback) {
    function apply(data) {
      if (data && typeof data === 'object') {
        Object.keys(imageData).forEach(function (k) {
          if (data[k]) imageData[k] = data[k];
        });
      }
      if (callback) callback();
    }
    if (hasLocalforage()) {
      localforage.getItem(STORE_KEY).then(apply).catch(function () { apply(null); });
    } else {
      try {
        var raw = localStorage.getItem(STORE_KEY);
        apply(raw ? JSON.parse(raw) : null);
      } catch (e) { apply(null); }
    }
  }

  // ==================== 应用图片到页面 ====================
  function applyImage(item, value) {
    if (!value) return;
    var el = document.getElementById(item.targetId);
    if (!el) return;

    if (item.type === 'bg') {
      el.style.backgroundImage = "url('" + value + "')";
      el.style.backgroundSize = 'cover';
      el.style.backgroundPosition = 'center';
      el.style.backgroundRepeat = 'no-repeat';
    } else if (item.type === 'img') {
      el.src = value;
      // 如果是黑胶封面，确保显示
      if (item.key === 'albumCover') {
        el.style.display = 'block';
        var albumIcon = document.getElementById('albumIcon');
        if (albumIcon) albumIcon.style.display = 'none';
      }
    }
  }

  function applyAll() {
    IMAGE_ITEMS.forEach(function (item) {
      var value = imageData[item.key];
      if (value) applyImage(item, value);
    });
  }

  // ==================== 动态创建设置面板 ====================
  function createSettingsPanel() {
    if (document.getElementById('mainImageSettingsModal')) return;

    // 面板 DOM
    var modal = document.createElement('div');
    modal.id = 'mainImageSettingsModal';
    modal.className = 'main-image-modal';

    var itemsHtml = '';
    IMAGE_ITEMS.forEach(function (item) {
      itemsHtml +=
        '<div class="main-image-item" data-key="' + item.key + '">' +
          '<div class="main-image-item-label">' + item.label + '</div>' +
          '<div class="main-image-item-preview">' +
            '<div class="main-image-preview-box" id="preview-' + item.key + '">' +
              '<i class="fa-regular fa-image"></i>' +
            '</div>' +
          '</div>' +
          '<div class="main-image-url-row">' +
            '<input type="text" class="main-image-url-input" id="url-' + item.key + '" placeholder="粘贴图片 URL...">' +
            '<button class="main-image-url-btn" data-key="' + item.key + '" data-act="applyUrl">应用</button>' +
          '</div>' +
          '<div class="main-image-file-row">' +
            '<label class="main-image-file-btn" for="file-' + item.key + '">' +
              '<i class="fa-solid fa-upload"></i>上传图片' +
            '</label>' +
            '<input type="file" class="main-image-file-input" id="file-' + item.key + '" accept="image/*" data-key="' + item.key + '">' +
            '<button class="main-image-reset-btn" data-key="' + item.key + '" data-act="reset">' +
              '<i class="fa-solid fa-rotate-left"></i>恢复默认' +
            '</button>' +
          '</div>' +
        '</div>';
    });

    modal.innerHTML =
      '<div class="main-image-panel">' +
        '<div class="main-image-header">' +
          '<span class="main-image-title"><i class="fa-solid fa-image"></i> 主页图片设置</span>' +
          '<button class="main-image-close" id="mainImageCloseBtn"><i class="fa-solid fa-xmark"></i></button>' +
        '</div>' +
        '<div class="main-image-body">' + itemsHtml + '</div>' +
      '</div>';

    document.body.appendChild(modal);

    // 关闭
    document.getElementById('mainImageCloseBtn').addEventListener('click', closePanel);
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closePanel();
    });

    // URL 应用按钮
    modal.querySelectorAll('[data-act="applyUrl"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-key');
        var input = document.getElementById('url-' + key);
        var url = input.value.trim();
        if (!url) { alert('请粘贴图片链接'); return; }
        imageData[key] = url;
        saveData();
        var item = IMAGE_ITEMS.filter(function (x) { return x.key === key; })[0];
        if (item) applyImage(item, url);
        updatePreview(key, url);
        input.value = '';
      });
    });

    // 上传文件
    modal.querySelectorAll('.main-image-file-input').forEach(function (input) {
      input.addEventListener('change', function () {
        var key = input.getAttribute('data-key');
        var file = input.files && input.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) { alert('请选择图片文件'); return; }
        var reader = new FileReader();
        reader.onload = function (e) {
          var dataUrl = e.target.result;
          imageData[key] = dataUrl;
          saveData();
          var item = IMAGE_ITEMS.filter(function (x) { return x.key === key; })[0];
          if (item) applyImage(item, dataUrl);
          updatePreview(key, dataUrl);
        };
        reader.readAsDataURL(file);
        input.value = '';
      });
    });

    // 恢复默认
    modal.querySelectorAll('[data-act="reset"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-key');
        if (!confirm('确定恢复默认图片吗？')) return;
        imageData[key] = '';
        saveData();
        // 恢复：主页背景图 / 底图 / 头像 / 黑胶
        var item = IMAGE_ITEMS.filter(function (x) { return x.key === key; })[0];
        if (!item) return;
        var el = document.getElementById(item.targetId);
        if (!el) return;
        if (item.key === 'homeBg') {
          el.style.backgroundImage = "url('https://picsum.photos/1200/1800?random=10')";
        } else if (item.key === 'myAvatar') {
          el.src = 'https://picsum.photos/100/100?random=1';
        } else if (item.key === 'partnerAvatar') {
          el.src = 'https://picsum.photos/200/200?random=99';
        } else if (item.key === 'homeHeaderBg') {
          el.style.backgroundImage = "url('https://picsum.photos/600/200?random=12')";
        } else if (item.key === 'albumCover') {
          el.src = '';
          el.style.display = 'none';
          var albumIcon = document.getElementById('albumIcon');
          if (albumIcon) albumIcon.style.display = 'block';
        }
        updatePreview(key, '');
      });
    });

    // 初始化预览
    IMAGE_ITEMS.forEach(function (item) {
      updatePreview(item.key, imageData[item.key]);
    });
  }

  function updatePreview(key, value) {
    var box = document.getElementById('preview-' + key);
    if (!box) return;
    if (value) {
      box.innerHTML = '<img src="' + value + '" alt="预览">';
    } else {
      box.innerHTML = '<i class="fa-regular fa-image"></i>';
    }
  }

  // ==================== 打开 / 关闭面板 ====================
  function openPanel() {
    var modal = document.getElementById('mainImageSettingsModal');
    if (!modal) { createSettingsPanel(); modal = document.getElementById('mainImageSettingsModal'); }
    // 刷新预览
    IMAGE_ITEMS.forEach(function (item) {
      updatePreview(item.key, imageData[item.key]);
    });
    modal.classList.add('active');
  }
  function closePanel() {
    var modal = document.getElementById('mainImageSettingsModal');
    if (modal) modal.classList.remove('active');
  }

  // ==================== 绑定触发入口 ====================
  function bindTrigger() {
    // 在主页底部 Tab 栏的"设置"按钮上，添加一个浮动小齿轮作为入口
    // 或者复用已有的"设置"按钮（tabSettingsHome）
    var tabSettings = document.getElementById('tabSettingsHome');
    if (tabSettings && !tabSettings.dataset.imageBound) {
      tabSettings.dataset.imageBound = '1';
      // 在原有按钮上叠加一个长按/双击打开图片设置的行为
      // 为不破坏原有点击逻辑，我们给按钮添加一个额外的浮动小按钮
    }

    // 创建浮动入口按钮
    if (!document.getElementById('mainImageEntryBtn')) {
      var btn = document.createElement('button');
      btn.id = 'mainImageEntryBtn';
      btn.className = 'main-image-entry-btn';
      btn.innerHTML = '<i class="fa-solid fa-image"></i>';
      btn.title = '主页图片设置';
      btn.addEventListener('click', openPanel);
      document.body.appendChild(btn);
    }
  }

  // ==================== 动态注入样式 ====================
  function injectStyles() {
    if (document.getElementById('mainImageStyles')) return;
    var style = document.createElement('style');
    style.id = 'mainImageStyles';
    style.textContent = `
      /* 浮动入口按钮 */
      .main-image-entry-btn {
        position: fixed;
        right: 20px;
        bottom: 160px;
        z-index: 60;
        width: 48px;
        height: 48px;
        border-radius: 9999px;
        background: rgba(255, 255, 255, 0.75);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.8);
        box-shadow: 0 6px 18px rgba(0, 20, 30, 0.12);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #333;
        font-size: 18px;
        cursor: pointer;
        transition: transform 0.15s ease;
      }
      .main-image-entry-btn:active {
        transform: scale(0.92);
      }

      /* 设置面板 */
      .main-image-modal {
        position: fixed;
        inset: 0;
        z-index: 500;
        display: none;
        align-items: flex-end;
        justify-content: center;
        background: rgba(20, 30, 40, 0.35);
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
      }
      .main-image-modal.active { display: flex; }

      .main-image-panel {
        width: 100%;
        max-width: 430px;
        max-height: 85vh;
        background: #ffffff;
        border-radius: 28px 28px 0 0;
        box-shadow: 0 -8px 30px rgba(0, 20, 30, 0.18);
        display: flex;
        flex-direction: column;
        animation: mainImageSlideUp 0.28s ease;
        overflow: hidden;
      }
      @keyframes mainImageSlideUp {
        from { transform: translateY(100%); }
        to { transform: translateY(0); }
      }

      .main-image-header {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 18px 20px 12px 20px;
        border-bottom: 1px solid #f0f3f6;
      }
      .main-image-title {
        font-size: 17px;
        font-weight: 700;
        color: #333;
        letter-spacing: 0.5px;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .main-image-title i {
        color: #f8b4b4;
      }
      .main-image-close {
        width: 30px;
        height: 30px;
        border-radius: 9999px;
        background: #f5f6f8;
        border: none;
        color: #55606b;
        font-size: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: background 0.15s ease;
      }
      .main-image-close:active { background: #e8ecf0; }

      .main-image-body {
        flex: 1;
        overflow-y: auto;
        padding: 16px 20px 24px 20px;
        scrollbar-width: none;
        -ms-overflow-style: none;
      }
      .main-image-body::-webkit-scrollbar { display: none; }

      .main-image-item {
        padding: 14px 0;
        border-bottom: 1px solid #f5f7fa;
      }
      .main-image-item:last-child { border-bottom: none; }

      .main-image-item-label {
        font-size: 14px;
        font-weight: 700;
        color: #333;
        margin-bottom: 10px;
      }

      .main-image-item-preview {
        margin-bottom: 10px;
      }
      .main-image-preview-box {
        width: 100%;
        height: 100px;
        border-radius: 14px;
        background: #f5f6f8;
        border: 1px dashed #d8dfe6;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        color: #c0ccd6;
        font-size: 24px;
      }
      .main-image-preview-box img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .main-image-url-row {
        display: flex;
        gap: 8px;
        margin-bottom: 8px;
      }
      .main-image-url-input {
        flex: 1;
        min-width: 0;
        padding: 10px 12px;
        border-radius: 12px;
        border: 1px solid #e2e8ee;
        background: #fafbfc;
        font-size: 13px;
        color: #333;
        outline: none;
        transition: border 0.2s ease, box-shadow 0.2s ease;
      }
      .main-image-url-input:focus {
        border-color: #f8b4b4;
        box-shadow: 0 0 0 3px rgba(248, 180, 180, 0.15);
      }
      .main-image-url-input::placeholder { color: #b6c2cd; }

      .main-image-url-btn {
        flex-shrink: 0;
        padding: 0 16px;
        border-radius: 12px;
        background: #f8b4b4;
        color: #fff;
        border: none;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: opacity 0.15s ease, transform 0.1s ease;
      }
      .main-image-url-btn:active {
        transform: scale(0.96);
        opacity: 0.9;
      }

      .main-image-file-row {
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .main-image-file-btn {
        flex: 1;
        padding: 10px 12px;
        border-radius: 12px;
        background: #fafbfc;
        border: 1px solid #eef1f4;
        color: #55606b;
        font-size: 13px;
        font-weight: 600;
        text-align: center;
        cursor: pointer;
        transition: background 0.15s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
      }
      .main-image-file-btn:active { background: #f2f6fa; }
      .main-image-file-input { display: none; }

      .main-image-reset-btn {
        flex-shrink: 0;
        padding: 10px 12px;
        border-radius: 12px;
        background: #fafbfc;
        border: 1px solid #eef1f4;
        color: #8899a6;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.15s ease;
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .main-image-reset-btn:active { background: #f2f6fa; }
    `;
    document.head.appendChild(style);
  }

  // ==================== 初始化 ====================
  function init() {
    injectStyles();
    bindTrigger();
    loadData(function () {
      applyAll();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 暴露给外部
  window.openMainImageSettings = openPanel;

})();
