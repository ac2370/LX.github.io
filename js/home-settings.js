/**
 * 主页图片自定义 · 数据层（重写版）
 * - 8 个字段：bg / avatar / headerBg / photo1-3 / album / chatBg
 * - 只用 localStorage 持久化（简单可靠）
 * - applyAll() 把值写回 DOM
 */

(function () {
  'use strict';

  var STORE_KEY = 'home_images_v3';

    var DEFAULTS = {
    bg:       '',
    avatar:   '',
    headerBg: '',
    photo1:   '',
    photo2:   '',
    photo3:   '',
    album:    '',
    chatBg:   ''
  };

  var current = Object.assign({}, DEFAULTS);

  // ==================== 存储 ====================
  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(current));
    } catch (e) {
      console.warn('[home-settings] 保存失败（可能超出配额）', e);
    }
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        var d = JSON.parse(raw);
        Object.keys(DEFAULTS).forEach(function (k) {
          if (d[k] !== undefined && d[k] !== null) current[k] = d[k];
        });
      }
    } catch (e) {}
    applyAll();
  }

  // ==================== 应用到页面 ====================
  function applyAll() {
    // 1. 主页背景
    var bgEl = document.getElementById('bgDream');
    if (bgEl) {
      if (current.bg) {
        bgEl.style.backgroundImage = 'url("' + current.bg + '")';
        bgEl.style.backgroundSize = 'cover';
        bgEl.style.backgroundPosition = 'center';
        bgEl.style.backgroundRepeat = 'no-repeat';
      } else {
        bgEl.style.backgroundImage = '';
      }
    }

    // 2. 头像（空时清空 src，让背景色透出）
    var avEl = document.getElementById('avatarImg');
    if (avEl) avEl.src = current.avatar || '';

    // 3. 头像下的底图
    var hdEl = document.getElementById('headerCard');
    if (hdEl) {
      if (current.headerBg) {
        hdEl.style.backgroundImage = 'url("' + current.headerBg + '")';
        hdEl.style.backgroundSize = 'cover';
        hdEl.style.backgroundPosition = 'center';
        hdEl.style.backgroundRepeat = 'no-repeat';
      } else {
        hdEl.style.backgroundImage = '';
      }
    }

    // 4. 三张展示图（空时清空 src）
    var p1 = document.getElementById('photo1');
    if (p1) p1.src = current.photo1 || '';
    var p2 = document.getElementById('photo2');
    if (p2) p2.src = current.photo2 || '';
    var p3 = document.getElementById('photo3');
    if (p3) p3.src = current.photo3 || '';

    // 5. 黑胶封面：有图显示图，无图显示默认图标
    var alEl = document.getElementById('albumCover');
    var alIcon = document.getElementById('albumIcon');
    if (current.album) {
      if (alEl) {
        alEl.src = current.album;
        alEl.style.display = 'block';
      }
      if (alIcon) alIcon.style.display = 'none';
    } else {
      if (alEl) {
        alEl.src = '';
        alEl.style.display = 'none';
      }
      if (alIcon) alIcon.style.display = '';
    }

    // 6. 传讯背景
    var chatEl = document.getElementById('pageChat');
    if (chatEl) {
      if (current.chatBg) {
        chatEl.style.backgroundImage = 'url("' + current.chatBg + '")';
        chatEl.style.backgroundSize = 'cover';
        chatEl.style.backgroundPosition = 'center';
        chatEl.style.backgroundRepeat = 'no-repeat';
      } else {
        chatEl.style.backgroundImage = '';
      }
    }
  }

  // ==================== 文件上传 ====================
  function handleFile(file, key, cb) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (e) {
      var dataUrl = e.target.result;
      current[key] = dataUrl;
      save();
      applyAll();
      if (cb) cb(dataUrl);
    };
    reader.onerror = function () {
      console.warn('[home-settings] 文件读取失败');
    };
    reader.readAsDataURL(file);
  }

  // ==================== API ====================
  window.homeSettings = {
    current: current,

    set: function (key, val) {
      current[key] = val;
      save();
      applyAll();
    },

    setFile: function (key, file, cb) {
      handleFile(file, key, cb);
    },

    setMany: function (obj) {
      Object.keys(obj).forEach(function (k) {
        if (obj[k] !== undefined) current[k] = obj[k];
      });
      save();
      applyAll();
    },

    reset: function (key) {
      if (key) {
        current[key] = DEFAULTS[key];
      } else {
        Object.keys(DEFAULTS).forEach(function (k) { current[k] = DEFAULTS[k]; });
      }
      save();
      applyAll();
    },

    reload: load,
    apply: applyAll
  };

  // ==================== 初始化 ====================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }

  console.log('[home-settings] v3 已加载');

})();
