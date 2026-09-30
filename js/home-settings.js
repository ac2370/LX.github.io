/**
 * 主页图片自定义设置（独立模块）
 * - 使用 localforage 持久化
 * - 只影响主页的图片，以及传讯背景图
 * - 不影响任何现有逻辑
 */

(function () {
  'use strict';

  // ==================== 存储 Key ====================
  var STORE_KEY = 'home_custom_images';

  // ==================== 默认图片 ====================
  var DEFAULTS = {
    bg: 'https://picsum.photos/1200/1800?random=10',
    avatar: 'https://picsum.photos/100/100?random=1',
    photo1: 'https://picsum.photos/200/200?random=2',
    photo2: 'https://picsum.photos/200/200?random=3',
    photo3: 'https://picsum.photos/200/200?random=4',
    album: null, // 音乐黑胶封面，null 表示使用默认歌曲封面
    headerBg: null, // 头部卡片背景（可选）
    chatBg: null // 传讯页面背景图
  };

  // ==================== 当前值 ====================
  var current = {
    bg: DEFAULTS.bg,
    avatar: DEFAULTS.avatar,
    photo1: DEFAULTS.photo1,
    photo2: DEFAULTS.photo2,
    photo3: DEFAULTS.photo3,
    album: null,
    headerBg: null,
    chatBg: null
  };

  // ==================== 保存 ====================
  function persist() {
    if (typeof localforage !== 'undefined') {
      localforage.setItem(STORE_KEY, current).catch(function (e) {
        console.warn('[home-settings] 保存失败', e);
      });
    } else {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(current)); } catch (e) {}
    }
  }

  // ==================== 加载 ====================
  function load(callback) {
    function apply(data) {
      if (data && typeof data === 'object') {
        Object.keys(current).forEach(function (key) {
          if (data[key] !== undefined && data[key] !== null) {
            current[key] = data[key];
          }
        });
      }
      applyAll();
      if (callback) callback();
    }

    if (typeof localforage !== 'undefined') {
      localforage.getItem(STORE_KEY).then(function (data) {
        apply(data);
      }).catch(function () {
        apply(null);
      });
    } else {
      try {
        var raw = localStorage.getItem(STORE_KEY);
        apply(raw ? JSON.parse(raw) : null);
      } catch (e) {
        apply(null);
      }
    }
  }

  // ==================== 应用到页面 ====================
  function applyAll() {
    // 主页背景
    var bgEl = document.getElementById('bgDream');
    if (bgEl && current.bg) {
      bgEl.style.backgroundImage = "url('" + current.bg + "')";
    }
    // 头像
    var avatarEl = document.getElementById('avatarImg');
    if (avatarEl && current.avatar) {
      avatarEl.src = current.avatar;
    }
    // 三张展示图
    var p1 = document.getElementById('photo1');
    if (p1 && current.photo1) p1.src = current.photo1;
    var p2 = document.getElementById('photo2');
    if (p2 && current.photo2) p2.src = current.photo2;
    var p3 = document.getElementById('photo3');
    if (p3 && current.photo3) p3.src = current.photo3;
    // 音乐黑胶封面
    if (current.album) {
      var albumCover = document.getElementById('albumCover');
      var albumIcon = document.getElementById('albumIcon');
      if (albumCover) {
        albumCover.src = current.album;
        albumCover.style.display = 'block';
      }
      if (albumIcon) {
        albumIcon.style.display = 'none';
      }
    }
    // 头部卡片背景（可选）
    var headerCard = document.getElementById('headerCard');
    if (headerCard && current.headerBg) {
      headerCard.style.backgroundImage = "url('" + current.headerBg + "')";
    }
    // 传讯页面背景
    var pageChat = document.getElementById('pageChat');
    if (pageChat) {
      if (current.chatBg) {
        pageChat.style.backgroundImage = "url('" + current.chatBg + "')";
        pageChat.style.backgroundSize = 'cover';
        pageChat.style.backgroundPosition = 'center';
        pageChat.style.backgroundRepeat = 'no-repeat';
      } else {
        pageChat.style.backgroundImage = '';
      }
      // 聊天消息区背景透明，让背景图透出
      var chatMsgs = document.getElementById('chatMessages');
      if (chatMsgs) {
        chatMsgs.style.background = current.chatBg ? 'transparent' : '#ffffff';
      }
    }
  }

  // ==================== 对外 API ====================
  window.homeSettings = {
    current: current,
    set: function (key, value) {
      current[key] = value;
      persist();
      applyAll();
    },
    setMany: function (obj) {
      Object.keys(obj).forEach(function (k) {
        current[k] = obj[k];
      });
      persist();
      applyAll();
    },
    reset: function () {
      Object.keys(DEFAULTS).forEach(function (k) {
        current[k] = DEFAULTS[k];
      });
      persist();
      applyAll();
    },
    reload: function () {
      load();
    },
    apply: applyAll
  };

  // ==================== 初始化 ====================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { load(); });
  } else {
    load();
  }

})();
