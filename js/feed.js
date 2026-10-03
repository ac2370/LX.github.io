/* ============================================================
   feed.js —— 朋友圈
   数据：localforage 键 'feedData'
     { [contactId]: { posts: [] } }
     单条动态：{ id, role, authorName, authorAvatar, content, ts, likes, comments, favorites }
     评论：{ id, authorName, content, ts, replies: [] }
   依赖：
     - window.showPage / window.pageFeed / window.pageHome（router.js）
     - localStorage: my_contacts / my_current_contact
   ============================================================ */
(function () {
  'use strict';

  console.log('feed loaded');

  // ==================== 常量 ====================
  var STORE_KEY = 'feedData';
  var LS_CONTACTS_KEY = 'my_contacts';
  var LS_CURRENT_KEY  = 'my_current_contact';

  var DEFAULT_CONTACT = {
    id: 'default_ta',
    name: 'Ta',
    avatar: 'https://picsum.photos/200/200?random=99'
  };

  // ==================== DOM ====================
  var btnFeed        = document.getElementById('btnFeed');
  var feedBackBtn    = document.getElementById('feedBackBtn');
  var feedSettingsBtn = document.getElementById('feedSettingsBtn');

  var feedCover        = document.getElementById('feedCover');
  var feedHeaderAvatar = document.getElementById('feedHeaderAvatar');
  var feedHeaderName   = document.getElementById('feedHeaderName');

  var feedPostBar    = document.getElementById('feedPostBar');
  var feedPostAvatar = document.getElementById('feedPostAvatar');

  var feedList  = document.getElementById('feedList');
  var feedEmpty = document.getElementById('feedEmpty');

  // 发帖弹层
  var postModal  = document.getElementById('feedPostModal');
  var postClose  = document.getElementById('feedPostClose');
  var postCancel = document.getElementById('feedPostCancel');
  var postSubmit = document.getElementById('feedPostSubmit');
  var postText   = document.getElementById('feedPostText');

  // ==================== 状态 ====================
  var feedData = {};             // { [contactId]: { posts: [] } }
  var dataReady = false;
  var currentContactId = null;
  var currentContact   = null;

  // ==================== 工具 ====================
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  function genId(prefix) {
    return (prefix || 'id') + '_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
  }

  // 相对时间
  function formatRelativeTime(ts) {
    var now = Date.now();
    var diff = now - ts;
    if (diff < 0) diff = 0;

    var sec = Math.floor(diff / 1000);
    if (sec < 60) return '刚刚';

    var min = Math.floor(sec / 60);
    if (min < 60) return min + ' 分钟前';

    var hour = Math.floor(min / 60);
    if (hour < 24) return hour + ' 小时前';

    var day = Math.floor(hour / 24);
    if (day < 7) return day + ' 天前';

    var d = new Date(ts);
    var y = d.getFullYear();
    var m = (d.getMonth() + 1).toString().padStart(2, '0');
    var dd = d.getDate().toString().padStart(2, '0');
    var nowYear = new Date().getFullYear();
    if (y === nowYear) return m + '-' + dd;
    return y + '-' + m + '-' + dd;
  }

  // ==================== 联系人 ====================
  function loadContacts() {
    try {
      var raw = localStorage.getItem(LS_CONTACTS_KEY);
      if (raw) {
        var arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length > 0) {
          return arr.filter(function (c) { return c && c.id; });
        }
      }
    } catch (e) {}
    return [Object.assign({}, DEFAULT_CONTACT)];
  }

  function resolveCurrentContact() {
    var contacts = loadContacts();
    var cid = null;
    try { cid = localStorage.getItem(LS_CURRENT_KEY); } catch (e) {}
    if (cid && contacts.some(function (c) { return c.id === cid; })) {
      currentContactId = cid;
    } else {
      currentContactId = contacts[0].id;
    }
    currentContact = contacts.find(function (c) { return c.id === currentContactId; }) || contacts[0];
  }

  // ==================== 数据读写 ====================
  function loadData() {
    if (typeof localforage === 'undefined') {
      dataReady = true;
      return Promise.resolve();
    }
    return localforage.getItem(STORE_KEY).then(function (data) {
      if (data && typeof data === 'object') {
        feedData = data;
      } else {
        feedData = {};
      }
      dataReady = true;
    }).catch(function () {
      feedData = {};
      dataReady = true;
    });
  }

  function saveData() {
    if (typeof localforage === 'undefined') return Promise.resolve();
    return localforage.setItem(STORE_KEY, feedData).catch(function (e) {
      console.warn('[feed] 保存失败', e);
    });
  }

  function getCurrentBucket() {
    if (!currentContactId) return { posts: [] };
    if (!feedData[currentContactId]) {
      feedData[currentContactId] = { posts: [] };
    }
    if (!Array.isArray(feedData[currentContactId].posts)) {
      feedData[currentContactId].posts = [];
    }
    return feedData[currentContactId];
  }

  // ==================== 我的头像 ====================
  function getMyAvatar() {
    // 优先从主页头像读取
    var avatarImg = document.getElementById('avatarImg');
    if (avatarImg && avatarImg.src) return avatarImg.src;
    // 从 homeSettings 读取
    if (window.homeSettings && window.homeSettings.current && window.homeSettings.current.avatar) {
      return window.homeSettings.current.avatar;
    }
    try {
      var raw = localStorage.getItem('home_custom_images');
      if (raw) {
        var data = JSON.parse(raw);
        if (data && data.avatar) return data.avatar;
      }
    } catch (e) {}
    return 'https://picsum.photos/100/100?random=1';
  }

  function getMyName() {
    // 尝试从 home settings 读；找不到就用"我"
    try {
      var raw = localStorage.getItem('home_custom_images');
      if (raw) {
        var data = JSON.parse(raw);
        if (data && data.myName) return data.myName;
      }
    } catch (e) {}
    return '我';
  }

  // ==================== 更新头部 ====================
  function updateHeader() {
    if (feedHeaderAvatar) {
      feedHeaderAvatar.src = (currentContact && currentContact.avatar) || DEFAULT_CONTACT.avatar;
      feedHeaderAvatar.alt = (currentContact && currentContact.name) || 'Ta';
    }
    if (feedHeaderName) {
      feedHeaderName.textContent = (currentContact && currentContact.name) || 'Ta';
    }
    if (feedPostAvatar) {
      feedPostAvatar.src = getMyAvatar();
    }
  }

  // ==================== 渲染列表 ====================
  function renderList() {
    if (!feedList) return;
    var bucket = getCurrentBucket();
    var posts = bucket.posts.slice().sort(function (a, b) {
      return (b.ts || 0) - (a.ts || 0);
    });

    if (posts.length === 0) {
      feedList.innerHTML = '';
      if (feedEmpty) feedEmpty.style.display = 'block';
      return;
    }
    if (feedEmpty) feedEmpty.style.display = 'none';

    var html = '';
    posts.forEach(function (post) {
      html += renderPostCard(post);
    });
    feedList.innerHTML = html;

    bindPostEvents();
  }

  function renderPostCard(post) {
    var avatar = post.authorAvatar || (post.role === 'me' ? getMyAvatar() : (currentContact && currentContact.avatar) || DEFAULT_CONTACT.avatar);
    var name   = post.authorName || (post.role === 'me' ? getMyName() : (currentContact && currentContact.name) || 'Ta');
    var time   = formatRelativeTime(post.ts || Date.now());

    var likes = Array.isArray(post.likes) ? post.likes : [];
    var comments = Array.isArray(post.comments) ? post.comments : [];
    var favorites = Array.isArray(post.favorites) ? post.favorites : [];

    // 是否已点赞 / 已收藏（用 "me" 判断）
    var liked = likes.indexOf('me') >= 0;
    var favorited = favorites.indexOf('me') >= 0;

    var html = '<div class="feed-card" data-id="' + escapeHtml(post.id) + '">';

    // 头
    html += '<div class="feed-card-head">' +
      '<img class="feed-card-avatar" src="' + escapeHtml(avatar) + '" alt="">' +
      '<div class="feed-card-meta">' +
        '<div class="feed-card-name">' + escapeHtml(name) + '</div>' +
        '<div class="feed-card-time">' + escapeHtml(time) + '</div>' +
      '</div>' +
    '</div>';

    // 正文
    html += '<div class="feed-card-content">' + escapeHtml(post.content || '') + '</div>';

    // 点赞列表
    if (likes.length > 0) {
      var likeNames = likes.map(function (l) {
        return l === 'me' ? getMyName() : ((currentContact && currentContact.name) || 'Ta');
      }).join('、');
      html += '<div class="feed-likes">' +
        '<i class="fa-solid fa-heart"></i>' +
        '<span>' + escapeHtml(likeNames) + ' 觉得很赞</span>' +
        '</div>';
    }

    // 评论区
    if (comments.length > 0) {
      html += '<div class="feed-comments">';
      comments.forEach(function (c) {
        html += renderComment(c);
      });
      html += '</div>';
    }

    // 操作按钮
    html += '<div class="feed-card-actions">' +
      '<button class="feed-action-btn' + (liked ? ' active' : '') + '" data-act="like">' +
        '<i class="fa-' + (liked ? 'solid' : 'regular') + ' fa-heart"></i>' +
        '<span>' + (liked ? '已赞' : '点赞') + '</span>' +
      '</button>' +
      '<button class="feed-action-btn" data-act="comment">' +
        '<i class="fa-regular fa-comment"></i>' +
        '<span>评论</span>' +
      '</button>' +
      '<button class="feed-action-btn' + (favorited ? ' active' : '') + '" data-act="favorite">' +
        '<i class="fa-' + (favorited ? 'solid' : 'regular') + ' fa-star"></i>' +
        '<span>' + (favorited ? '已收藏' : '收藏') + '</span>' +
      '</button>' +
    '</div>';

    html += '</div>';
    return html;
  }

  function renderComment(c) {
    var html = '<div class="feed-comment-item">' +
      '<span class="feed-comment-name">' + escapeHtml(c.authorName || '我') + '</span>' +
      '：' + escapeHtml(c.content || '') +
      '<span class="feed-comment-time">' + escapeHtml(formatRelativeTime(c.ts || Date.now())) + '</span>' +
    '</div>';

    // 楼中楼（简单支持）
    if (Array.isArray(c.replies) && c.replies.length > 0) {
      c.replies.forEach(function (r) {
        html += '<div class="feed-comment-item" style="padding-left:16px;">' +
          '<span class="feed-comment-name">' + escapeHtml(r.authorName || '我') + '</span>' +
          '：' + escapeHtml(r.content || '') +
          '<span class="feed-comment-time">' + escapeHtml(formatRelativeTime(r.ts || Date.now())) + '</span>' +
        '</div>';
      });
    }
    return html;
  }

  // ==================== 事件绑定 ====================
  function bindPostEvents() {
    if (!feedList) return;
    feedList.querySelectorAll('.feed-card').forEach(function (card) {
      var postId = card.getAttribute('data-id');
      card.querySelectorAll('.feed-action-btn').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          var act = btn.getAttribute('data-act');
          handleAction(act, postId);
        });
      });
    });
  }

  function handleAction(act, postId) {
    var bucket = getCurrentBucket();
    var post = bucket.posts.find(function (p) { return p.id === postId; });
    if (!post) return;

    if (act === 'like') {
      if (!Array.isArray(post.likes)) post.likes = [];
      var idx = post.likes.indexOf('me');
      if (idx >= 0) {
        post.likes.splice(idx, 1);
      } else {
        post.likes.push('me');
      }
      saveData().then(renderList);
    } else if (act === 'favorite') {
      if (!Array.isArray(post.favorites)) post.favorites = [];
      var fi = post.favorites.indexOf('me');
      if (fi >= 0) {
        post.favorites.splice(fi, 1);
      } else {
        post.favorites.push('me');
      }
      saveData().then(renderList);
    } else if (act === 'comment') {
      // 评论功能下一步实现，先占位
      var txt = prompt('写点什么：');
      if (!txt) return;
      var t = txt.trim();
      if (!t) return;
      if (!Array.isArray(post.comments)) post.comments = [];
      post.comments.push({
        id: genId('cmt'),
        authorName: getMyName(),
        content: t,
        ts: Date.now(),
        replies: []
      });
      saveData().then(renderList);
    }
  }

  // ==================== 页面切换 ====================
  function enterFeed() {
    resolveCurrentContact();
    updateHeader();
    // 数据加载完成后再渲染
    if (dataReady) {
      renderList();
    } else {
      loadData().then(renderList);
    }
  }

  if (btnFeed) {
    btnFeed.addEventListener('click', function (e) {
      e.preventDefault();
      if (window.showPage && window.pageFeed) {
        window.showPage(window.pageFeed);
      } else if (window.showPage) {
        var p = document.getElementById('pageFeed');
        if (p) window.showPage(p);
      }
      enterFeed();
    });
  }

  if (feedBackBtn) {
    feedBackBtn.addEventListener('click', function () {
      if (window.showPage && window.pageHome) {
        window.showPage(window.pageHome);
      }
    });
  }

  if (feedSettingsBtn) {
    feedSettingsBtn.addEventListener('click', function () {
      // 设置功能下一步实现
      alert('朋友圈设置开发中');
    });
  }

  // ==================== 发帖弹层 ====================
  function openPostModal() {
    if (postText) postText.value = '';
    if (postModal) postModal.classList.add('active');
    setTimeout(function () { if (postText) postText.focus(); }, 100);
  }
  function closePostModal() {
    if (postModal) postModal.classList.remove('active');
  }

  if (feedPostBar) feedPostBar.addEventListener('click', openPostModal);
  if (postClose)   postClose.addEventListener('click', closePostModal);
  if (postCancel)  postCancel.addEventListener('click', closePostModal);
  if (postModal) {
    postModal.addEventListener('click', function (e) {
      if (e.target === postModal) closePostModal();
    });
  }

  // ==================== 发布 ====================
  if (postSubmit) {
    postSubmit.addEventListener('click', function () {
      var text = postText ? postText.value.trim() : '';
      if (!text) {
        alert('请输入内容');
        return;
      }
      if (!currentContactId) {
        alert('请先选择一个联系人');
        return;
      }

      var bucket = getCurrentBucket();
      bucket.posts.push({
        id: genId('post'),
        role: 'me',
        authorName: getMyName(),
        authorAvatar: getMyAvatar(),
        content: text,
        ts: Date.now(),
        likes: [],
        comments: [],
        favorites: []
      });

      saveData().then(function () {
        closePostModal();
        renderList();
        // 滚到底部（刚发的在最上面，所以其实滚到顶）
        var body = document.querySelector('#pageFeed .feed-body');
        if (body) body.scrollTop = 0;
      });
    });
  }

  // ==================== 监听联系人切换 ====================
  // 同标签页切联系人不会触发 storage 事件；进入页面时会重新读
  window.addEventListener('storage', function (e) {
    if (e.key === LS_CURRENT_KEY || e.key === LS_CONTACTS_KEY) {
      var pageFeed = document.getElementById('pageFeed');
      if (pageFeed && pageFeed.classList.contains('active')) {
        enterFeed();
      }
    }
  });

  // ==================== 初始化 ====================
  function init() {
    resolveCurrentContact();
    updateHeader();
    loadData().then(function () {
      renderList();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 暴露接口
  window.feed = {
    enter: enterFeed,
    refresh: function () {
      resolveCurrentContact();
      updateHeader();
      renderList();
    },
    getData: function () { return feedData; }
  };

})();
