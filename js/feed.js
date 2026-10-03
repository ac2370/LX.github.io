/* ============================================================
   feed.js —— 朋友圈
   数据：localforage 键 'feedData'
     { [contactId]: { posts: [] } }
     单条动态：{ id, role, authorName, authorAvatar, content, ts, likes, comments, favorites }
     评论：{ id, authorName, content, ts, replies: [] }
   功能：
     - 你发动态
     - TA 自动发动态（15~60 分钟检查一次，30% 概率）
     - TA 对你动态做三件套反应（点赞 / 评论 / 收藏）
     - 主页"朋友圈"入口红点提醒
   依赖：
     - window.showPage / window.pageFeed / window.pageHome（router.js）
     - window.getReplyCards（card.js）
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

  // ★ 测试用：所有互动延迟 = 5 秒
  //   正式版：
  //     reactionDelay = randomInt(1000, 60000);      // 1~60 秒
  //     autoPostCheckMin = 15 * 60 * 1000;            // 15 分钟
  //     autoPostCheckMax = 60 * 60 * 1000;            // 60 分钟
  var TEST_REACTION_DELAY_MS   = randomInt(1000, 60000)
  var TEST_AUTO_POST_MIN_MS    = 15 * 60 * 1000
  var TEST_AUTO_POST_MAX_MS    = 60 * 60 * 1000
  var AUTO_POST_PROBABILITY    = 0.30;

  // 三件套概率
  var LIKE_PROBABILITY     = 0.60;
  var COMMENT_PROBABILITY  = 0.70;
  var FAVORITE_PROBABILITY = 0.30;

  // 红点标记键
  var LS_UNREAD_DOT_KEY = 'feed_unread_dot';

  // ==================== DOM ====================
  var btnFeed         = document.getElementById('btnFeed');
  var feedBackBtn     = document.getElementById('feedBackBtn');
  var feedSettingsBtn = document.getElementById('feedSettingsBtn');

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
  var feedData = {};
  var dataReady = false;
  var currentContactId = null;
  var currentContact   = null;

  var autoPostTimer = null;
  var autoPostScheduled = false;

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

  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function randomPick(arr) {
    if (!arr || arr.length === 0) return null;
    return arr[Math.floor(Math.random() * arr.length)];
  }

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

  // 回复字卡池
  function getReplyPool() {
    if (typeof window.getReplyCards === 'function') {
      var arr = window.getReplyCards();
      if (Array.isArray(arr) && arr.length > 0) return arr.slice();
    }
    return [];
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
      feedData = (data && typeof data === 'object') ? data : {};
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

  // ==================== 我的头像 / 名字 ====================
  function getMyAvatar() {
    var avatarImg = document.getElementById('avatarImg');
    if (avatarImg && avatarImg.src) return avatarImg.src;
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
    try {
      var raw = localStorage.getItem('home_custom_images');
      if (raw) {
        var data = JSON.parse(raw);
        if (data && data.myName) return data.myName;
      }
    } catch (e) {}
    return '我';
  }

  function getTaName() {
    return (currentContact && currentContact.name) || 'Ta';
  }
  function getTaAvatar() {
    return (currentContact && currentContact.avatar) || DEFAULT_CONTACT.avatar;
  }

  // ==================== 更新头部 ====================
  function updateHeader() {
    if (feedHeaderAvatar) {
      feedHeaderAvatar.src = getTaAvatar();
      feedHeaderAvatar.alt = getTaName();
    }
    if (feedHeaderName) {
      feedHeaderName.textContent = getTaName();
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
    var avatar = post.authorAvatar || (post.role === 'me' ? getMyAvatar() : getTaAvatar());
    var name   = post.authorName || (post.role === 'me' ? getMyName() : getTaName());
    var time   = formatRelativeTime(post.ts || Date.now());

    var likes = Array.isArray(post.likes) ? post.likes : [];
    var comments = Array.isArray(post.comments) ? post.comments : [];
    var favorites = Array.isArray(post.favorites) ? post.favorites : [];

    var liked = likes.indexOf('me') >= 0;
    var favorited = favorites.indexOf('me') >= 0;

    var html = '<div class="feed-card" data-id="' + escapeHtml(post.id) + '">';

    html += '<div class="feed-card-head">' +
      '<img class="feed-card-avatar" src="' + escapeHtml(avatar) + '" alt="">' +
      '<div class="feed-card-meta">' +
        '<div class="feed-card-name">' + escapeHtml(name) + '</div>' +
        '<div class="feed-card-time">' + escapeHtml(time) + '</div>' +
      '</div>' +
    '</div>';

    html += '<div class="feed-card-content">' + escapeHtml(post.content || '') + '</div>';

    // 点赞列表
    if (likes.length > 0) {
      var likeNames = likes.map(function (l) {
        if (l === 'me') return getMyName();
        if (l === 'ta') return getTaName();
        return String(l);
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
      if (idx >= 0) post.likes.splice(idx, 1);
      else post.likes.push('me');
      saveData().then(renderList);
    } else if (act === 'favorite') {
      if (!Array.isArray(post.favorites)) post.favorites = [];
      var fi = post.favorites.indexOf('me');
      if (fi >= 0) post.favorites.splice(fi, 1);
      else post.favorites.push('me');
      saveData().then(renderList);
    } else if (act === 'comment') {
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

  // ==================== 红点 ====================
  function showUnreadDot() {
    try { localStorage.setItem(LS_UNREAD_DOT_KEY, '1'); } catch (e) {}
    applyUnreadDot();
  }
  function clearUnreadDot() {
    try { localStorage.removeItem(LS_UNREAD_DOT_KEY); } catch (e) {}
    applyUnreadDot();
  }
  function applyUnreadDot() {
    if (!btnFeed) return;
    var has = false;
    try { has = localStorage.getItem(LS_UNREAD_DOT_KEY) === '1'; } catch (e) {}

    // 找/建红点元素
    var dot = btnFeed.querySelector('.feed-unread-dot');
    if (has) {
      if (!dot) {
        dot = document.createElement('span');
        dot.className = 'feed-unread-dot';
        btnFeed.appendChild(dot);
      }
    } else {
      if (dot && dot.parentNode) dot.parentNode.removeChild(dot);
    }
  }

  // ==================== 传讯页系统消息 ====================
  function pushChatSystemMessage(text) {
    var chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    var row = document.createElement('div');
    row.className = 'message-row system-call-event';
    var bubble = document.createElement('div');
    bubble.className = 'call-record-bubble';
    bubble.innerHTML = '<i class="fa-solid fa-users"></i><span>' + escapeHtml(text) + '</span>';
    row.appendChild(bubble);
    chatMessages.appendChild(row);
    requestAnimationFrame(function () {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    });
  }

  // ==================== TA 自动发动态 ====================
  function maybeAutoPostFor(contactId) {
    if (!contactId) return;
    if (!feedData[contactId]) feedData[contactId] = { posts: [] };
    if (!Array.isArray(feedData[contactId].posts)) feedData[contactId].posts = [];

    // 30% 概率触发
    if (Math.random() > AUTO_POST_PROBABILITY) return;

    var pool = getReplyPool();
    if (pool.length === 0) return;

    // 抽 1~3 句
    var count = randomInt(1, 3);
    if (count > pool.length) count = pool.length;

    var picked = [];
    var usedIdx = {};
    for (var i = 0; i < count; i++) {
      var idx;
      var tries = 0;
      do {
        idx = Math.floor(Math.random() * pool.length);
        tries++;
      } while (usedIdx[idx] && tries < 20);
      usedIdx[idx] = true;
      picked.push(String(pool[idx]).trim());
    }
    var content = picked.join(' ');

    // 用该联系人的名字/头像
    var contacts = loadContacts();
    var c = contacts.find(function (x) { return x.id === contactId; }) || contacts[0];
    var name = (c && c.name) || 'Ta';
    var avatar = (c && c.avatar) || DEFAULT_CONTACT.avatar;

    feedData[contactId].posts.push({
      id: genId('post'),
      role: 'ta',
      authorName: name,
      authorAvatar: avatar,
      content: content,
      ts: Date.now(),
      likes: [],
      comments: [],
      favorites: []
    });

    saveData().then(function () {
      // 若当前就在该联系人朋友圈，直接刷新
      if (currentContactId === contactId) {
        renderList();
      }
      // 红点
      showUnreadDot();
      // 传讯页系统消息
      pushChatSystemMessage(name + ' 发布了一条朋友圈动态');
    });
  }

  function scheduleAutoPost() {
    if (autoPostScheduled) return;
    autoPostScheduled = true;

    function tick() {
      // 对当前联系人做一次判断
      resolveCurrentContact();
      maybeAutoPostFor(currentContactId);

      var next = randomInt(TEST_AUTO_POST_MIN_MS, TEST_AUTO_POST_MAX_MS);
      autoPostTimer = setTimeout(tick, next);
    }

    var firstDelay = randomInt(TEST_AUTO_POST_MIN_MS, TEST_AUTO_POST_MAX_MS);
    autoPostTimer = setTimeout(tick, firstDelay);
  }

  // ==================== TA 三件套反应 ====================
  function reactToMyPost(postId) {
    if (!currentContactId) return;
    var bucket = getCurrentBucket();
    var post = bucket.posts.find(function (p) { return p.id === postId; });
    if (!post) return;

    var taName = getTaName();

    // 1) 点赞 60%
    if (Math.random() < LIKE_PROBABILITY) {
      setTimeout(function () {
        var b = getCurrentBucket();
        var p = b.posts.find(function (x) { return x.id === postId; });
        if (!p) return;
        if (!Array.isArray(p.likes)) p.likes = [];
        if (p.likes.indexOf('ta') < 0) {
          p.likes.push('ta');
          saveData().then(function () {
            if (currentContactId && document.getElementById('pageFeed') && document.getElementById('pageFeed').classList.contains('active')) {
              renderList();
            }
            showUnreadDot();
          });
        }
      }, TEST_REACTION_DELAY_MS);
    }

    // 2) 评论 70%
    if (Math.random() < COMMENT_PROBABILITY) {
      setTimeout(function () {
        var pool = getReplyPool();
        var commentText = pool.length > 0 ? String(randomPick(pool)).trim() : '真不错~';

        var b = getCurrentBucket();
        var p = b.posts.find(function (x) { return x.id === postId; });
        if (!p) return;
        if (!Array.isArray(p.comments)) p.comments = [];
        p.comments.push({
          id: genId('cmt'),
          authorName: taName,
          content: commentText,
          ts: Date.now(),
          replies: []
        });
        saveData().then(function () {
          if (currentContactId && document.getElementById('pageFeed') && document.getElementById('pageFeed').classList.contains('active')) {
            renderList();
          }
          showUnreadDot();
        });
      }, TEST_REACTION_DELAY_MS);
    }

    // 3) 收藏 30%
    if (Math.random() < FAVORITE_PROBABILITY) {
      setTimeout(function () {
        var b = getCurrentBucket();
        var p = b.posts.find(function (x) { return x.id === postId; });
        if (!p) return;
        if (!Array.isArray(p.favorites)) p.favorites = [];
        if (p.favorites.indexOf('ta') < 0) {
          p.favorites.push('ta');
          saveData().then(function () {
            if (currentContactId && document.getElementById('pageFeed') && document.getElementById('pageFeed').classList.contains('active')) {
              renderList();
            }
            showUnreadDot();
          });
        }
      }, TEST_REACTION_DELAY_MS);
    }
  }

  // ==================== 页面切换 ====================
  function enterFeed() {
    resolveCurrentContact();
    updateHeader();
    // 进页面清除红点
    clearUnreadDot();
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
      if (!text) { alert('请输入内容'); return; }
      if (!currentContactId) { alert('请先选择一个联系人'); return; }

      var postId = genId('post');
      var bucket = getCurrentBucket();
      bucket.posts.push({
        id: postId,
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
        var body = document.querySelector('#pageFeed .feed-body');
        if (body) body.scrollTop = 0;
        // 触发 TA 三件套反应
        reactToMyPost(postId);
      });
    });
  }

  // ==================== 监听联系人切换 ====================
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
    applyUnreadDot();
    loadData().then(function () {
      renderList();
      // 启动 TA 自动发动态的定时器
      scheduleAutoPost();
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
    getData: function () { return feedData; },
    // 测试用：立刻让 TA 发一条动态
    forceAutoPost: function () {
      resolveCurrentContact();
      var old = AUTO_POST_PROBABILITY;
      // 直接调用核心逻辑，跳过概率（相当于必发）
      var pool = getReplyPool();
      if (pool.length === 0) {
        console.warn('[feed] 没有回复字卡，无法自动发帖');
        return;
      }
      var count = randomInt(1, 3);
      if (count > pool.length) count = pool.length;
      var picked = [];
      var usedIdx = {};
      for (var i = 0; i < count; i++) {
        var idx;
        var tries = 0;
        do {
          idx = Math.floor(Math.random() * pool.length);
          tries++;
        } while (usedIdx[idx] && tries < 20);
        usedIdx[idx] = true;
        picked.push(String(pool[idx]).trim());
      }
      var content = picked.join(' ');

      if (!feedData[currentContactId]) feedData[currentContactId] = { posts: [] };
      feedData[currentContactId].posts.push({
        id: genId('post'),
        role: 'ta',
        authorName: getTaName(),
        authorAvatar: getTaAvatar(),
        content: content,
        ts: Date.now(),
        likes: [],
        comments: [],
        favorites: []
      });
      saveData().then(function () {
        if (document.getElementById('pageFeed') && document.getElementById('pageFeed').classList.contains('active')) {
          renderList();
        }
        showUnreadDot();
        pushChatSystemMessage(getTaName() + ' 发布了一条朋友圈动态');
      });
      // 恢复
      AUTO_POST_PROBABILITY = old;
    }
  };

})();
