/* ============================================================
   feed.js —— 朋友圈（完整版）
   数据：localforage 键 'feedData'
     { [contactId]: { posts: [] } }
     单条动态：{ id, role, authorName, authorAvatar, content, ts, likes, comments, favorites }
     评论：{ id, authorName, content, ts, replies: [] }
     楼中楼：{ id, authorName, content, ts, to }
   通知：localforage 键 'feedNotices'
     [{ id, type: 'like'|'comment'|'reply', postId, content, ts, isNew: true }]
   封面背景：localStorage 键 'feedCoverBg_<contactId>'
   功能：
     - 你发动态 / TA 自动发动态 / TA 三件套反应
     - 你评论 TA 的动态（TA 60% 概率回复）
     - 你回复评论（TA 60% 概率回复）
     - 通知列表（点铃铛按钮弹出）
     - 删除自己的动态
     - 顶部 ➕ 按钮触发发帖弹层
     - 换背景（上传本地图片 / 粘贴 URL）
   依赖：
     - window.showPage / window.pageFeed / window.pageHome
     - window.getReplyCards（card.js）
     - localStorage: my_contacts / my_current_contact
   ============================================================ */
(function () {
  'use strict';

  console.log('feed loaded');

  // ==================== 常量 ====================
  var STORE_KEY        = 'feedData';
  var NOTICE_KEY       = 'feedNotices';
  var LS_CONTACTS_KEY  = 'my_contacts';
  var LS_CURRENT_KEY   = 'my_current_contact';

  var DEFAULT_CONTACT = {
    id: 'default_ta',
    name: 'Ta',
    avatar: 'https://picsum.photos/200/200?random=99'
  };

  // ★ 测试用
  var TEST_REACTION_DELAY_MS      = randomInt(1000, 60000);
  var TEST_COMMENT_REPLY_DELAY_MS = randomInt(1000, 60000);
  var TEST_AUTO_POST_MIN_MS       = 15 * 60 * 1000;
  var TEST_AUTO_POST_MAX_MS       = 60 * 60 * 1000;

  // 概率
  var AUTO_POST_PROBABILITY = 0.30;
  var LIKE_PROBABILITY      = 0.60;
  var COMMENT_PROBABILITY   = 0.70;
  var FAVORITE_PROBABILITY  = 0.30;
  var TA_REPLY_TO_MY_COMMENT_PROB = 0.60;

  // 主页入口红点
  var LS_UNREAD_DOT_KEY = 'feed_unread_dot';

  // ==================== DOM ====================
  var btnFeed         = document.getElementById('btnFeed');
  var feedBackBtn     = document.getElementById('feedBackBtn');
  var feedSettingsBtn = document.getElementById('feedSettingsBtn');   // 铃铛
  var feedAddBtn      = document.getElementById('feedAddBtn');        // ➕

  var feedCover = document.getElementById('feedCover');
  // 注意：#feedCoverChangeBtn 已删除，改为点击 #feedCover 触发

  var feedHeaderAvatar = document.getElementById('feedHeaderAvatar');
  var feedHeaderName   = document.getElementById('feedHeaderName');

  var feedList  = document.getElementById('feedList');
  var feedEmpty = document.getElementById('feedEmpty');

  // 发帖弹层
  var postModal  = document.getElementById('feedPostModal');
  var postClose  = document.getElementById('feedPostClose');
  var postCancel = document.getElementById('feedPostCancel');
  var postSubmit = document.getElementById('feedPostSubmit');
  var postText   = document.getElementById('feedPostText');

  // ==================== 状态 ====================
  var feedData    = {};
  var feedNotices = [];
  var dataReady   = false;

  var currentContactId = null;
  var currentContact   = null;

  var autoPostTimer     = null;
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
    // 朋友圈不跟随聊天当前联系人：固定第一位联系人（Ta），避免切联系人影响朋友圈署名
    currentContactId = contacts[0].id;
    currentContact = contacts.find(function (c) { return c.id === currentContactId; }) || contacts[0];
  }

  // ==================== 数据 ====================
  function loadData() {
    if (typeof localforage === 'undefined') {
      dataReady = true;
      return Promise.resolve();
    }
    return Promise.all([
      localforage.getItem(STORE_KEY),
      localforage.getItem(NOTICE_KEY)
    ]).then(function (results) {
      feedData = (results[0] && typeof results[0] === 'object') ? results[0] : {};
      feedNotices = Array.isArray(results[1]) ? results[1] : [];
      dataReady = true;
    }).catch(function () {
      feedData = {};
      feedNotices = [];
      dataReady = true;
    });
  }

  function saveData() {
    if (typeof localforage === 'undefined') return Promise.resolve();
    return localforage.setItem(STORE_KEY, feedData).catch(function (e) {
      console.warn('[feed] 保存失败', e);
    });
  }

  function saveNotices() {
    if (typeof localforage === 'undefined') return Promise.resolve();
    return localforage.setItem(NOTICE_KEY, feedNotices).catch(function (e) {
      console.warn('[feed] 通知保存失败', e);
    });
  }

  function getCurrentBucket() {
    // 朋友圈是「我的朋友圈」：统一存一个桶，不按联系人分桶
    var bucketId = 'my';
    if (!feedData[bucketId]) feedData[bucketId] = { posts: [] };
    if (!Array.isArray(feedData[bucketId].posts)) feedData[bucketId].posts = [];
    return feedData[bucketId];
  }

  // ==================== 我的头像 / 名字（优先「我的角色」面板设置） ====================
  function getMyAvatar() {
    try {
      var rawProfile = localStorage.getItem('my_profile');
      if (rawProfile) {
        var p = JSON.parse(rawProfile);
        if (p && p.avatar) return p.avatar;
      }
    } catch (e) {}
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
      var rawProfile = localStorage.getItem('my_profile');
      if (rawProfile) {
        var p = JSON.parse(rawProfile);
        if (p && p.name) return p.name;
      }
    } catch (e) {}
    try {
      var raw = localStorage.getItem('home_custom_images');
      if (raw) {
        var data = JSON.parse(raw);
        if (data && data.myName) return data.myName;
      }
    } catch (e) {}
    // 回退：主页昵称（h1「阿晏」）
    var h1 = document.querySelector('h1');
    if (h1 && h1.textContent && h1.textContent.trim()) return h1.textContent.trim();
    return '我';
  }

  function getTaName() {
    return (currentContact && currentContact.name) || 'Ta';
  }
  function getTaAvatar() {
    return (currentContact && currentContact.avatar) || DEFAULT_CONTACT.avatar;
  }

  // ==================== 封面背景（固定「我的朋友圈」一份） ====================
  function coverKey() {
    return 'feedCoverBg_my';
  }

  function loadCoverBg() {
    var url = '';
    try {
      var v = localStorage.getItem(coverKey());
      if (v) url = v;
    } catch (e) {}
    return url;
  }

  function saveCoverBg(url) {
    try {
      localStorage.setItem(coverKey(), url);
    } catch (e) {}
  }

   function applyCoverBg() {
    if (!feedCover) return;
    var url = loadCoverBg();
    if (url) {
      feedCover.style.backgroundImage = 'url("' + url + '")';
      feedCover.style.backgroundSize = 'cover';
      feedCover.style.backgroundPosition = 'center';
      feedCover.style.backgroundRepeat = 'no-repeat';
    } else {
      feedCover.style.backgroundImage = '';
      feedCover.style.backgroundSize = '';
      feedCover.style.backgroundPosition = '';
      feedCover.style.backgroundRepeat = '';
    }
  }

  function openCoverModal() {
    var old = document.getElementById('feedCoverModal');
    if (old && old.parentNode) old.parentNode.removeChild(old);

    var modal = document.createElement('div');
    modal.id = 'feedCoverModal';
    modal.className = 'feed-cover-modal';
    modal.innerHTML =
      '<div class="feed-cover-panel">' +
        '<div class="feed-cover-title">换朋友圈背景</div>' +
        '<button class="feed-cover-option" id="feedCoverUpload">' +
          '<i class="fa-solid fa-upload"></i> 上传本地图片' +
        '</button>' +
        '<button class="feed-cover-option" id="feedCoverUrl">' +
          '<i class="fa-solid fa-link"></i> 粘贴图片 URL' +
        '</button>' +
        '<button class="feed-cover-cancel" id="feedCoverCancel">取消</button>' +
      '</div>';

    document.body.appendChild(modal);
    requestAnimationFrame(function () { modal.classList.add('active'); });

    function closeModal() {
      modal.classList.remove('active');
      setTimeout(function () {
        if (modal.parentNode) modal.parentNode.removeChild(modal);
      }, 250);
    }

    document.getElementById('feedCoverUpload').addEventListener('click', function () {
      closeModal();
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.style.display = 'none';
      document.body.appendChild(input);
      input.addEventListener('change', function () {
        var file = input.files && input.files[0];
        if (!file) { document.body.removeChild(input); return; }
        var reader = new FileReader();
        reader.onload = function (ev) {
          var dataUrl = ev.target.result;
          saveCoverBg(dataUrl);
          applyCoverBg();
          document.body.removeChild(input);
        };
        reader.readAsDataURL(file);
      });
      input.click();
    });

    document.getElementById('feedCoverUrl').addEventListener('click', function () {
      closeModal();
      var url = prompt('请输入图片 URL：');
      if (!url) return;
      url = url.trim();
      if (!url) return;
      saveCoverBg(url);
      applyCoverBg();
    });

    document.getElementById('feedCoverCancel').addEventListener('click', closeModal);
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeModal();
    });
  }

  // ==================== 头部（我的朋友圈） ====================
  function updateHeader() {
    if (feedHeaderAvatar) {
      feedHeaderAvatar.src = getMyAvatar();
      feedHeaderAvatar.alt = getMyName();
    }
    if (feedHeaderName) feedHeaderName.textContent = getMyName();
    // 副标题「XX 的朋友圈」→「我的朋友圈」
    var sub = document.querySelector('#pageFeed .feed-header-sub');
    if (sub) sub.textContent = '我的朋友圈';
    applyCoverBg();
  }

  // ==================== 渲染 ====================
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

    if (comments.length > 0) {
      html += '<div class="feed-comments">';
      comments.forEach(function (c) {
        html += renderComment(c, post.id);
      });
      html += '</div>';
    }

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
      '</button>';

    if (post.role === 'me') {
      html += '<button class="feed-action-btn feed-action-del" data-act="delete">' +
        '<i class="fa-solid fa-trash-can"></i>' +
        '<span>删除</span>' +
      '</button>';
    }

    html += '</div>';
    html += '</div>';
    return html;
  }

  function renderComment(c, postId) {
    var html = '<div class="feed-comment-item" data-cid="' + escapeHtml(c.id) + '">' +
      '<span class="feed-comment-name">' + escapeHtml(c.authorName || '我') + '</span>' +
      '：' + escapeHtml(c.content || '') +
      '<span class="feed-comment-time">' + escapeHtml(formatRelativeTime(c.ts || Date.now())) + '</span>' +
      '<button class="feed-comment-reply-btn" data-act="reply" data-cid="' + escapeHtml(c.id) + '" data-post="' + escapeHtml(postId) + '">回复</button>' +
    '</div>';

    if (Array.isArray(c.replies) && c.replies.length > 0) {
      c.replies.forEach(function (r) {
        var toHtml = r.to ? '<span class="feed-comment-to">回复 ' + escapeHtml(r.to) + '</span>' : '';
        html += '<div class="feed-comment-item" style="padding-left:16px;" data-rid="' + escapeHtml(r.id) + '">' +
          '<span class="feed-comment-name">' + escapeHtml(r.authorName || '我') + '</span>' +
          '：' + toHtml + escapeHtml(r.content || '') +
          '<span class="feed-comment-time">' + escapeHtml(formatRelativeTime(r.ts || Date.now())) + '</span>' +
          '<button class="feed-comment-reply-btn" data-act="reply" data-cid="' + escapeHtml(c.id) + '" data-post="' + escapeHtml(postId) + '">回复</button>' +
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
          handleAction(btn.getAttribute('data-act'), postId);
        });
      });

      card.querySelectorAll('.feed-comment-reply-btn').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          var parentCid = btn.getAttribute('data-cid');
          var pid = btn.getAttribute('data-post');
          openCommentInput(pid, parentCid);
        });
      });
    });
  }

  // ==================== 评论输入 ====================
  function openCommentInput(postId, parentCommentId) {
    var toName = '';
    if (parentCommentId) {
      var bucket = getCurrentBucket();
      var post = bucket.posts.find(function (p) { return p.id === postId; });
      if (post) {
        var c = (post.comments || []).find(function (x) { return x.id === parentCommentId; });
        if (c) toName = c.authorName || '';
      }
    }
    var tip = toName ? ('回复 ' + toName + '：') : '写点什么：';
    var text = prompt(tip);
    if (text === null) return;
    var t = text.trim();
    if (!t) return;

    var bucket = getCurrentBucket();
    var post = bucket.posts.find(function (p) { return p.id === postId; });
    if (!post) return;

    if (!parentCommentId) {
      if (!Array.isArray(post.comments)) post.comments = [];
      post.comments.push({
        id: genId('cmt'),
        authorName: getMyName(),
        content: t,
        ts: Date.now(),
        replies: []
      });
      saveData().then(function () {
        renderList();
        if (Math.random() < TA_REPLY_TO_MY_COMMENT_PROB) {
          scheduleTaReplyToComment(postId, null);
        }
      });
    } else {
      var parent = (post.comments || []).find(function (x) { return x.id === parentCommentId; });
      if (!parent) return;
      if (!Array.isArray(parent.replies)) parent.replies = [];
      parent.replies.push({
        id: genId('rep'),
        authorName: getMyName(),
        content: t,
        ts: Date.now(),
        to: toName || ''
      });
      saveData().then(function () {
        renderList();
        if (Math.random() < TA_REPLY_TO_MY_COMMENT_PROB) {
          scheduleTaReplyToComment(postId, parentCommentId);
        }
      });
    }
  }

  // ==================== TA 回复评论 ====================
  function scheduleTaReplyToComment(postId, parentCommentId) {
    setTimeout(function () {
      var pool = getReplyPool();
      var replyText = pool.length > 0 ? String(randomPick(pool)).trim() : '嗯嗯~';

      var bucket = getCurrentBucket();
      var post = bucket.posts.find(function (p) { return p.id === postId; });
      if (!post) return;

      var taName = getTaName();

      if (!parentCommentId) {
        if (!Array.isArray(post.comments)) post.comments = [];
        post.comments.push({
          id: genId('cmt'),
          authorName: taName,
          content: replyText,
          ts: Date.now(),
          replies: []
        });
        addNotice('comment', postId, replyText);
      } else {
        var parent = (post.comments || []).find(function (x) { return x.id === parentCommentId; });
        if (!parent) return;
        if (!Array.isArray(parent.replies)) parent.replies = [];
        parent.replies.push({
          id: genId('rep'),
          authorName: taName,
          content: replyText,
          ts: Date.now(),
          to: getMyName()
        });
        addNotice('reply', postId, replyText);
      }

      saveData().then(function () {
        if (document.getElementById('pageFeed') &&
            document.getElementById('pageFeed').classList.contains('active')) {
          renderList();
        }
        updateNoticeBadge();
        showUnreadDot();
      });
    }, TEST_COMMENT_REPLY_DELAY_MS);
  }

  // ==================== 主操作分发 ====================
  function handleAction(act, postId) {
    if (act === 'delete') { deletePost(postId); return; }

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
      openCommentInput(postId, null);
    }
  }

  // ==================== 删除动态 ====================
  function deletePost(postId) {
    var bucket = getCurrentBucket();
    var post = bucket.posts.find(function (p) { return p.id === postId; });
    if (!post) return;
    if (!confirm('确定删除这条动态吗？')) return;

    bucket.posts = bucket.posts.filter(function (p) { return p.id !== postId; });
    feedNotices = feedNotices.filter(function (n) { return n.postId !== postId; });
    saveNotices();
    saveData().then(function () {
      renderList();
      updateNoticeBadge();
    });
  }

  // ==================== 通知 ====================
  function addNotice(type, postId, content) {
    feedNotices.unshift({
      id: genId('ntc'),
      type: type,
      postId: postId,
      content: content || '',
      ts: Date.now(),
      isNew: true
    });
    saveNotices();
    updateNoticeBadge();
    showUnreadDot();
  }

  function updateNoticeBadge() {
    if (!feedSettingsBtn) return;
    var unread = feedNotices.filter(function (n) { return n.isNew; }).length;

    var dot = feedSettingsBtn.querySelector('.feed-notice-dot');
    if (unread > 0) {
      if (!dot) {
        dot = document.createElement('span');
        dot.className = 'feed-notice-dot';
        feedSettingsBtn.appendChild(dot);
      }
      dot.textContent = unread > 99 ? '99+' : unread;
    } else {
      if (dot && dot.parentNode) dot.parentNode.removeChild(dot);
    }
  }

  function markAllNoticesRead() {
    var changed = false;
    feedNotices.forEach(function (n) {
      if (n.isNew) { n.isNew = false; changed = true; }
    });
    if (changed) saveNotices();
    updateNoticeBadge();
  }

  // ==================== 通知弹窗 ====================
  function openNoticeModal() {
    var old = document.getElementById('feedNoticeModal');
    if (old && old.parentNode) old.parentNode.removeChild(old);

    var modal = document.createElement('div');
    modal.id = 'feedNoticeModal';
    modal.className = 'feed-notice-modal';
    modal.innerHTML =
      '<div class="feed-notice-panel">' +
        '<div class="feed-notice-header">' +
          '<span class="feed-notice-title">通知</span>' +
          '<button class="feed-notice-close" id="feedNoticeClose"><i class="fa-solid fa-xmark"></i></button>' +
        '</div>' +
        '<div class="feed-notice-body" id="feedNoticeBody"></div>' +
        '<div class="feed-notice-footer">' +
          '<button class="feed-notice-clear" id="feedNoticeClear">清空全部</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);
    requestAnimationFrame(function () { modal.classList.add('active'); });

    var body = document.getElementById('feedNoticeBody');

    if (feedNotices.length === 0) {
      body.innerHTML =
        '<div class="feed-notice-empty">' +
          '<i class="fa-regular fa-bell"></i>' +
          '<div>暂无通知</div>' +
        '</div>';
    } else {
      var html = '';
      feedNotices.forEach(function (n) {
        var typeText = n.type === 'like' ? '点赞了你的动态'
                     : n.type === 'comment' ? '评论了你的动态'
                     : '回复了你的评论';
        var extra = n.content ? '：' + escapeHtml(n.content) : '';
        html += '<div class="feed-notice-item' + (n.isNew ? ' new' : '') + '">' +
          '<div class="feed-notice-icon ' + n.type + '"><i class="fa-solid fa-' +
            (n.type === 'like' ? 'heart' : n.type === 'comment' ? 'comment' : 'reply') +
          '"></i></div>' +
          '<div class="feed-notice-main">' +
            '<div class="feed-notice-line"><b>' + escapeHtml(getTaName()) + '</b> ' + typeText + extra + '</div>' +
            '<div class="feed-notice-time">' + escapeHtml(formatRelativeTime(n.ts)) + '</div>' +
          '</div>' +
        '</div>';
      });
      body.innerHTML = html;
    }

    document.getElementById('feedNoticeClose').addEventListener('click', function () {
      closeNoticeModal();
    });
    document.getElementById('feedNoticeClear').addEventListener('click', function () {
      if (!confirm('清空所有通知？')) return;
      feedNotices = [];
      saveNotices();
      updateNoticeBadge();
      closeNoticeModal();
    });
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeNoticeModal();
    });

    markAllNoticesRead();
  }

  function closeNoticeModal() {
    var modal = document.getElementById('feedNoticeModal');
    if (modal) {
      modal.classList.remove('active');
      setTimeout(function () {
        if (modal.parentNode) modal.parentNode.removeChild(modal);
      }, 250);
    }
  }

  // ==================== 红点（主页入口） ====================
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

  // ==================== 联系人们自动发动态（发到同一个朋友圈，与我的动态混在一起） ====================
  function maybeAutoPost() {
    if (!dataReady) return;
    if (Math.random() > AUTO_POST_PROBABILITY) return;

    var pool = getReplyPool();
    if (pool.length === 0) return;

    var count = randomInt(1, 3);
    if (count > pool.length) count = pool.length;

    var picked = [];
    var usedIdx = {};
    for (var i = 0; i < count; i++) {
      var idx, tries = 0;
      do {
        idx = Math.floor(Math.random() * pool.length);
        tries++;
      } while (usedIdx[idx] && tries < 20);
      usedIdx[idx] = true;
      picked.push(String(pool[idx]).trim());
    }
    var content = picked.join(' ');

    // 随机选一位联系人作为发帖人
    var contacts = loadContacts();
    var c = randomPick(contacts) || contacts[0];
    var name = (c && c.name) || 'Ta';
    var avatar = (c && c.avatar) || DEFAULT_CONTACT.avatar;

    var bucket = getCurrentBucket();
    bucket.posts.push({
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
      if (document.getElementById('pageFeed') &&
          document.getElementById('pageFeed').classList.contains('active')) {
        renderList();
      }
      showUnreadDot();
      pushChatSystemMessage(name + ' 发布了一条朋友圈动态');
    });
  }

  function scheduleAutoPost() {
    if (autoPostScheduled) return;
    autoPostScheduled = true;

    function tick() {
      resolveCurrentContact();
      maybeAutoPost();
      var next = randomInt(TEST_AUTO_POST_MIN_MS, TEST_AUTO_POST_MAX_MS);
      autoPostTimer = setTimeout(tick, next);
    }

    var first = randomInt(TEST_AUTO_POST_MIN_MS, TEST_AUTO_POST_MAX_MS);
    autoPostTimer = setTimeout(tick, first);
  }

  // ==================== TA 三件套反应 ====================
  function reactToMyPost(postId) {
    if (!currentContactId) return;
    var bucket = getCurrentBucket();
    var post = bucket.posts.find(function (p) { return p.id === postId; });
    if (!post) return;

    var taName = getTaName();

    // 1) 点赞
    if (Math.random() < LIKE_PROBABILITY) {
      setTimeout(function () {
        var b = getCurrentBucket();
        var p = b.posts.find(function (x) { return x.id === postId; });
        if (!p) return;
        if (!Array.isArray(p.likes)) p.likes = [];
        if (p.likes.indexOf('ta') < 0) {
          p.likes.push('ta');
          addNotice('like', postId, '');
          saveData().then(function () {
            if (document.getElementById('pageFeed') &&
                document.getElementById('pageFeed').classList.contains('active')) {
              renderList();
            }
          });
        }
      }, TEST_REACTION_DELAY_MS);
    }

    // 2) 评论
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
        addNotice('comment', postId, commentText);
        saveData().then(function () {
          if (document.getElementById('pageFeed') &&
              document.getElementById('pageFeed').classList.contains('active')) {
            renderList();
          }
        });
      }, TEST_REACTION_DELAY_MS);
    }

    // 3) 收藏
    if (Math.random() < FAVORITE_PROBABILITY) {
      setTimeout(function () {
        var b = getCurrentBucket();
        var p = b.posts.find(function (x) { return x.id === postId; });
        if (!p) return;
        if (!Array.isArray(p.favorites)) p.favorites = [];
        if (p.favorites.indexOf('ta') < 0) {
          p.favorites.push('ta');
          saveData().then(function () {
            if (document.getElementById('pageFeed') &&
                document.getElementById('pageFeed').classList.contains('active')) {
              renderList();
            }
          });
        }
      }, TEST_REACTION_DELAY_MS);
    }
  }

  // ==================== 页面切换 ====================
  function enterFeed() {
    resolveCurrentContact();
    updateHeader();
    clearUnreadDot();
    updateNoticeBadge();
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

  // 顶部铃铛 → 通知弹窗
  if (feedSettingsBtn) {
    feedSettingsBtn.addEventListener('click', function () {
      openNoticeModal();
    });
  }

  // 顶部 ➕ → 发帖弹层
  if (feedAddBtn) {
    feedAddBtn.addEventListener('click', function () {
      openPostModal();
    });
  }

   // 点击封面 → 打开"更换封面"选项面板
  if (feedCover) {
    feedCover.addEventListener('click', function (e) {
      e.preventDefault();
      openCoverModal();
    });
  }

  // ==================== 发帖 ====================
  function openPostModal() {
    if (postText) postText.value = '';
    if (postModal) postModal.classList.add('active');
    setTimeout(function () { if (postText) postText.focus(); }, 100);
  }
  function closePostModal() {
    if (postModal) postModal.classList.remove('active');
  }

  if (postClose)   postClose.addEventListener('click', closePostModal);
  if (postCancel)  postCancel.addEventListener('click', closePostModal);
  if (postModal) {
    postModal.addEventListener('click', function (e) {
      if (e.target === postModal) closePostModal();
    });
  }

  if (postSubmit) {
    postSubmit.addEventListener('click', function () {
      var text = postText ? postText.value.trim() : '';
      if (!text) { alert('请输入内容'); return; }

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
        reactToMyPost(postId);
      });
    });
  }

  // ==================== 联系人切换监听 ====================
  // 只监听联系人列表变化（新增/删除联系人时刷新）；点击联系人切换聊天不再影响朋友圈
  window.addEventListener('storage', function (e) {
    if (e.key === LS_CONTACTS_KEY) {
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
      updateNoticeBadge();
      scheduleAutoPost();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ==================== 暴露接口 ====================
  window.feed = {
    enter: enterFeed,
    refresh: function () {
      resolveCurrentContact();
      updateHeader();
      renderList();
      updateNoticeBadge();
    },
    getData: function () { return feedData; },
    getNotices: function () { return feedNotices; },
    forceAutoPost: function () {
      resolveCurrentContact();
      var pool = getReplyPool();
      if (pool.length === 0) { console.warn('[feed] 没有回复字卡'); return; }
      var count = randomInt(1, 3);
      if (count > pool.length) count = pool.length;
      var picked = [];
      var usedIdx = {};
      for (var i = 0; i < count; i++) {
        var idx, tries = 0;
        do {
          idx = Math.floor(Math.random() * pool.length);
          tries++;
        } while (usedIdx[idx] && tries < 20);
        usedIdx[idx] = true;
        picked.push(String(pool[idx]).trim());
      }
      var content = picked.join(' ');
      // 随机选一位联系人作为发帖人（同自动发帖逻辑），发到统一朋友圈
      var fContacts = loadContacts();
      var fC = randomPick(fContacts) || fContacts[0];
      var fName = (fC && fC.name) || 'Ta';
      var fAvatar = (fC && fC.avatar) || DEFAULT_CONTACT.avatar;
      var bucket = getCurrentBucket();
      bucket.posts.push({
        id: genId('post'),
        role: 'ta',
        authorName: fName,
        authorAvatar: fAvatar,
        content: content,
        ts: Date.now(),
        likes: [],
        comments: [],
        favorites: []
      });
      saveData().then(function () {
        if (document.getElementById('pageFeed') &&
            document.getElementById('pageFeed').classList.contains('active')) {
          renderList();
        }
        showUnreadDot();
        pushChatSystemMessage(fName + ' 发布了一条朋友圈动态');
      });
    }
  };

})();
