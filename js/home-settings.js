/**
 * 主页图片自定义设置（独立模块 - 修正版）
 * - 使用 localforage 持久化
 * - 图片文件使用 Blob URL 保持清晰度
 * - 新增 headerBg（头像下的底图）设置
 */

(function () {
  'use strict';

  var STORE_KEY = 'home_custom_images_v2';
  var BLOB_STORE_KEY = 'home_custom_blobs_v2';

  // ==================== 默认值 ====================
  // 未上传图片前保持白色占位（与早期 home.js 一致），上传后才显示图片
  var DEFAULTS = {
    bg: null,
    avatar: null,
    photo1: null,
    photo2: null,
    photo3: null,
    album: null,
    headerBg: null,   // 头像下的底图（header-card 背景）
    chatBg: null
  };

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

  // 存储文件 Blob（用于上传的本地文件，保持清晰）
  var blobStore = {
    bg: null,
    avatar: null,
    photo1: null,
    photo2: null,
    photo3: null,
    album: null,
    headerBg: null,
    chatBg: null
  };

  // 运行时生成的 ObjectURL（不持久化，每次刷新重建）
  var objectUrls = {
    bg: null,
    avatar: null,
    photo1: null,
    photo2: null,
    photo3: null,
    album: null,
    headerBg: null,
    chatBg: null
  };

  // ==================== 保存 ====================
  function persist() {
    if (typeof localforage === 'undefined') {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(current));
        localStorage.setItem(BLOB_STORE_KEY, JSON.stringify(blobStore));
      } catch (e) {}
      return;
    }
    localforage.setItem(STORE_KEY, current).catch(function (e) {
      console.warn('[home-settings] 保存失败', e);
    });
    // 单独存 Blob（DataURL 也可以）
    localforage.setItem(BLOB_STORE_KEY, blobStore).catch(function (e) {
      console.warn('[home-settings] Blob 保存失败', e);
    });
  }

  // ==================== 加载 ====================
  function load(callback) {
    function applyUrls(data) {
      if (data && typeof data === 'object') {
        Object.keys(current).forEach(function (key) {
          if (data[key] !== undefined && data[key] !== null) {
            current[key] = data[key];
          }
        });
      }
    }

    function applyBlobs(blobs) {
      if (blobs && typeof blobs === 'object') {
        Object.keys(blobStore).forEach(function (key) {
          if (blobs[key]) {
            blobStore[key] = blobs[key];
            // 重建 ObjectURL
            try {
              // 如果存的是 DataURL，直接使用
              if (typeof blobs[key] === 'string' && blobs[key].indexOf('data:') === 0) {
                current[key] = blobs[key];
              } else {
                objectUrls[key] = URL.createObjectURL(blobs[key]);
                current[key] = objectUrls[key];
              }
            } catch (e) {
              console.warn('[home-settings] 重建 URL 失败', key, e);
            }
          }
        });
      }
      applyAll();
      if (callback) callback();
    }

    if (typeof localforage === 'undefined') {
      try {
        var rawUrl = localStorage.getItem(STORE_KEY);
        var rawBlob = localStorage.getItem(BLOB_STORE_KEY);
        applyUrls(rawUrl ? JSON.parse(rawUrl) : null);
        applyBlobs(rawBlob ? JSON.parse(rawBlob) : null);
      } catch (e) {
        applyAll();
        if (callback) callback();
      }
      return;
    }

    // 先加载 URL 配置
    localforage.getItem(STORE_KEY).then(function (data) {
      applyUrls(data);
      // 再加载 Blob
      return localforage.getItem(BLOB_STORE_KEY);
    }).then(function (blobs) {
      applyBlobs(blobs);
    }).catch(function () {
      applyAll();
      if (callback) callback();
    });
  }

  // ==================== 应用到页面 ====================
  function applyAll() {
    // 主页背景图（务必清晰：用 cover + center）
    var bgEl = document.getElementById('bgDream');
    if (bgEl && current.bg) {
      bgEl.style.backgroundImage = "url('" + current.bg + "')";
      bgEl.style.backgroundSize = 'cover';
      bgEl.style.backgroundPosition = 'center';
      bgEl.style.backgroundRepeat = 'no-repeat';
    }

    // 头像
    var avatarEl = document.getElementById('avatarImg');
    if (avatarEl && current.avatar) {
      avatarEl.src = current.avatar;
      avatarEl.style.imageRendering = 'auto';
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
      if (albumIcon) albumIcon.style.display = 'none';
    }

    // 头像下的底图（header-card）
    var headerCard = document.getElementById('headerCard');
    if (headerCard && current.headerBg) {
      headerCard.style.backgroundImage = "url('" + current.headerBg + "')";
      headerCard.style.backgroundSize = 'cover';
      headerCard.style.backgroundPosition = 'center';
      headerCard.style.backgroundRepeat = 'no-repeat';
    }

    // 传讯背景图
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
      var chatMsgs = document.getElementById('chatMessages');
      if (chatMsgs) {
        chatMsgs.style.background = current.chatBg ? 'transparent' : '#ffffff';
      }
    }
  }

  // ==================== 处理上传文件（保持原图清晰度） ====================
  function handleFileUpload(file, key, callback) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (e) {
      var dataUrl = e.target.result;
      // 存 DataURL（localforage 支持存字符串，且不会二次压缩，保持原始清晰度）
      blobStore[key] = dataUrl;
      current[key] = dataUrl;
      persist();
      applyAll();
      if (callback) callback(dataUrl);
    };
    // 直接读取为 DataURL，不做任何压缩，保持原始清晰度
    reader.readAsDataURL(file);
  }

  // ==================== 对外 API ====================
  window.homeSettings = {
    current: current,
    set: function (key, value) {
      current[key] = value;
      blobStore[key] = null;
      persist();
      applyAll();
    },
    setFile: function (key, file, callback) {
      handleFileUpload(file, key, callback);
    },
    setMany: function (obj) {
      Object.keys(obj).forEach(function (k) {
        if (obj[k] === undefined) return;
        current[k] = obj[k];
        if (typeof obj[k] === 'string' && obj[k].indexOf('data:') === 0) {
          blobStore[k] = obj[k];
        } else {
          blobStore[k] = null;
        }
      });
      persist();
      applyAll();
    },
    reset: function (key) {
      if (key) {
        current[key] = DEFAULTS[key];
        blobStore[key] = null;
      } else {
        Object.keys(DEFAULTS).forEach(function (k) {
          current[k] = DEFAULTS[k];
          blobStore[k] = null;
        });
      }
      persist();
      applyAll();
    },
    reload: function () { load(); },
    apply: applyAll
  };

  // ==================== 初始化 ====================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { load(); });
  } else {
    load();
  }

})();
