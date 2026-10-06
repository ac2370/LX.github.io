/* ============================================================
   session-chat.js —— 传讯多会话（联系人 / 群聊）分桶与隔离
   ------------------------------------------------------------
   作用：
     1. 会话选择页 #pageChatHome（联系人 | 群聊 双 Tab）渲染
     2. 单聊消息按联系人分桶（buckets['c:<id>']），落盘 chat_messages_v1
     3. 群聊复用 group-chat.js（消息本就按群分桶，落盘 group_chat_data）
     4. 进入 / 切换 / 返回会话，重建各自消息区，互不串扰
   解耦说明：
     - 联系人列表不再有"持久选中高亮"
     - 进入会话不再写全局 my_current_contact，也不动角色面板当前角色
     - 传讯自己的"当前会话"由 state.currentKey 维护
   本次新增（为词云选人 + 收藏持久化做准备）：
     - 每条消息加唯一 msgId
     - DOM 行挂 data-msgid，便于反查
     - genMsgId / toggleFav / getMessagesOf / getFavoritedOf
     - record / recordReply 支持传入 msgId（不传则自动生成，兼容老调用）
   依赖：
     - group-chat.js（window.groupChat.enter / exit / getCurrentGroup / getGroups）
     - role-panel.js（my_contacts / contactChanged 广播）
   ============================================================ */
(function () {
  'use strict';

  var STORE_KEY = 'chat_messages_v1';   // localforage 优先
  var LS_KEY    = 'chat_messages_v1';   // localStorage 降级

  var state = {
    buckets: {},        // { 'c:<contactId>': [msg, ...] }
    currentKey: null,   // 'c:<id>' 或 'g:<id>' 或 null
    replyTarget: null,  // 对方异步回复要写入的会话 key
    loaded: false
  };

  // ==================== 存储 ====================
  function persist() {
    try {
      var data = { v: 1, buckets: state.buckets };
      if (typeof localforage !== 'undefined') {
        localforage.setItem(STORE_KEY, data).catch(function () {
          try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch (e2) {}
        });
      } else {
        localStorage.setItem(LS_KEY, JSON.stringify(data));
      }
    } catch (e) {}
  }

  function load(callback) {
    function apply(d) {
      if (d && d.buckets && typeof d.buckets === 'object') {
        state.buckets = d.buckets;
      } else if (d && typeof d === 'object') {
        state.buckets = d;
      }
      state.loaded = true;
      if (callback) callback();
    }
    function fallback() {
      try {
        var raw = localStorage.getItem(LS_KEY);
        if (raw) apply(JSON.parse(raw));
        else apply(null);
      } catch (e) { apply(null); }
    }
    if (typeof localforage !== 'undefined') {
      localforage.getItem(STORE_KEY).then(apply).catch(fallback);
    } else {
      fallback();
    }
  }

  // ==================== key 工具 ====================
  function contactKey(id) { return 'c:' + id; }
  function groupKey(id)   { return 'g:' + id; }

  function getBucket(key) {
    if (!state.buckets[key]) state.buckets[key] = [];
    return state.buckets[key];
  }

  // ==================== msgId 生成 ====================
  function genMsgId() {
    return 'm_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
  }

  // ==================== 消息记录 ====================
  function normalize(kind, content, msgId) {
    var m = { t: Date.now(), type: kind, msgId: msgId || genMsgId() };
    if (typeof content === 'string') {
      m.kind = 'text';
      m.text = content;
    } else if (content && content.type === 'image') {
      m.kind = 'image';
      m.url = content.url;
    } else if (content && content.quote) {
      m.kind = 'quote';
      m.quote = content.quote;
      m.text = content.text;
    } else if (content && content.kind) {
      m.kind = content.kind;
      if (content.icon !== undefined) m.icon = content.icon;
      if (content.label !== undefined) m.label = content.label;
      if (content.detail !== undefined) m.detail = content.detail;
      if (content.text !== undefined) m.text = content.text;
      if (content.by !== undefined) m.by = content.by;
    } else {
      m.kind = 'text';
      m.text = String(content == null ? '' : content);
    }
    return m;
  }

  // 同步记录（我发的 / 当前会话产生的），写当前会话
  // 返回本次生成的 msgId（不传 msgId 时自动生成，兼容旧调用）
  function record(kind, content, msgId) {
    if (!state.currentKey || state.currentKey.indexOf('c:') !== 0) return null;
    var m = normalize(kind, content, msgId);
    getBucket(state.currentKey).push(m);
    persist();
    return m.msgId;
  }

  // 异步回复记录：写入「发送消息时的会话」，若用户正看着该会话则即时渲染
  function recordReply(kind, content, msgId) {
    if (!state.replyTarget || state.replyTarget.indexOf('c:') !== 0) return null;
    var m = normalize(kind, content, msgId);
    getBucket(state.replyTarget).push(m);
    persist();
    if (state.currentKey === state.replyTarget) {
      renderCurrent();
    }
    return m.msgId;
  }

  // 写入指定单聊会话的桶（不改变当前会话/回复目标），若正看着该会话则即时渲染
  function recordTo(key, kind, content, msgId) {
    if (!key || key.indexOf('c:') !== 0) return null;
    var m = normalize(kind, content, msgId);
    getBucket(key).push(m);
    persist();
    if (state.currentKey === key) renderCurrent();
    return m.msgId;
  }

  function setReplyTarget(key) {
    state.replyTarget = key || state.currentKey;
  }

  // ==================== 收藏（按 msgId 改桶里消息） ====================
  // key 不传则用当前会话
  function toggleFav(msgId, isFav, key) {
    if (!msgId) return false;
    var k = key || state.currentKey;
    if (!k || k.indexOf('c:') !== 0) return false;
    var bucket = getBucket(k);
    for (var i = 0; i < bucket.length; i++) {
      if (bucket[i].msgId === msgId) {
        bucket[i].fav = !!isFav;
        persist();
        return true;
      }
    }
    return false;
  }

  // ==================== 读取（给 stats 等外部用） ====================
  // 读某联系人全部消息（返回浅拷贝，避免外部直接改内部数组）
  function getMessagesOf(contactId) {
    if (!contactId) return [];
    var bucket = state.buckets[contactKey(contactId)];
    if (!Array.isArray(bucket)) return [];
    return bucket.slice();
  }

  // 读某联系人收藏的消息
  function getFavoritedOf(contactId) {
    return getMessagesOf(contactId).filter(function (m) { return m && m.fav; });
  }

  // ==================== 时间格式化（与 chat.js 一致） ====================
  function formatTime(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    var h = d.getHours();
    var m = d.getMinutes();
    var s = d.getSeconds();
    var ampm = h >= 12 ? 'PM' : 'AM';
    var h12 = h % 12;
    if (h12 === 0) h12 = 12;
    function pad(n) { return n < 10 ? '0' + n : '' + n; }
    return pad(h12) + ':' + pad(m) + ':' + pad(s) + ' ' + ampm;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  // ==================== 重建单条消息行 ====================
  function buildRow(m) {
    var row = document.createElement('div');
    row.className = 'message-row ' + (m.type === 'self' ? 'self' : 'other');
    row.dataset.sender = m.type === 'self' ? 'me' : 'partner';
    row.dataset.type = m.kind || 'text';
    row.dataset.time = String(m.t || Date.now());
    row.dataset.favorited = m.fav ? 'true' : 'false';
    row.dataset.read = 'false';
    // 挂 msgId，便于反查
    if (m.msgId) row.dataset.msgid = m.msgId;

    // 系统行（拍一拍 / 通话记录）：保持 call-record-bubble 外观，不带时间戳
    if (m.kind === 'pat' || m.kind === 'call') {
      row.className = 'message-row system-call-event';
      var sysBubble = document.createElement('div');
      sysBubble.className = 'call-record-bubble';
      if (m.kind === 'pat') {
        sysBubble.innerHTML =
          '<i class="fa-solid fa-hand"></i>' +
          '<span>' + escapeHtml(m.by === 'me' ? ('你拍了拍 ' + (m.name || 'Ta')) : ((m.name || 'Ta') + ' 拍了拍你')) +
          '：' + escapeHtml(m.text || '') + '</span>';
      } else {
        var iconHtml = m.icon ? '<i class="' + m.icon + '"></i> ' : '';
        sysBubble.innerHTML = iconHtml + escapeHtml([m.label, m.detail].filter(function (x) { return x; }).join(' · '));
      }
      row.appendChild(sysBubble);
      return row;
    }

    var bubble = document.createElement('div');
    bubble.className = 'message-bubble';

    if (m.kind === 'image' && m.url) {
      var img = document.createElement('img');
      img.src = m.url;
      img.alt = '表情包';
      img.style.maxWidth = '160px';
      img.style.maxHeight = '160px';
      img.style.borderRadius = '12px';
      img.style.display = 'block';
      img.style.cursor = 'pointer';
      img.onclick = function () { window.open(m.url, '_blank'); };
      bubble.appendChild(img);
    } else if (m.kind === 'quote') {
      var quoteEl = document.createElement('span');
      quoteEl.className = 'quote-block';
      quoteEl.textContent = '> ' + m.quote;
      bubble.appendChild(quoteEl);
      bubble.appendChild(document.createTextNode(m.text || ''));
    } else {
      bubble.textContent = m.text || '';
    }

    row.appendChild(bubble);

    // 时间戳（与 chat.js decorateMessageRow 一致）
    var body = document.createElement('div');
    body.className = 'message-body';
    row.insertBefore(body, bubble);
    body.appendChild(bubble);
    var timeEl = document.createElement('div');
    timeEl.className = 'message-time';
    var timeText = document.createElement('span');
    timeText.className = 'message-time-text';
    timeText.textContent = formatTime(Number(row.dataset.time));
    timeEl.appendChild(timeText);
    body.appendChild(timeEl);

    return row;
  }

  // ==================== 重建当前会话消息区 ====================
  function renderCurrent() {
    var chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    chatMessages.innerHTML = '';
    var arr = state.buckets[state.currentKey] || [];
    if (arr.length === 0) {
      // 顶部横条已显示「和『X』的对话开始了」，这里不再重复渲染欢迎气泡
    } else {
      arr.forEach(function (m) {
        var row = buildRow(m);
        if (row) chatMessages.appendChild(row);
      });
      // 重算已读回执与时间显示
      try {
        if (window.applyChatTimeDisplay) window.applyChatTimeDisplay();
        var ev = new CustomEvent('sessionRendered', { detail: { key: state.currentKey } });
        window.dispatchEvent(ev);
      } catch (e) {}
    }
    requestAnimationFrame(function () {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    });
  }

  function getCurrentContactName() {
    try {
      var id = state.currentKey ? state.currentKey.slice(2) : null;
      var contacts = JSON.parse(localStorage.getItem('my_contacts') || '[]');
      var c = contacts.find(function (x) { return x.id === id; });
      return c ? (c.name || 'Ta') : 'Ta';
    } catch (e) { return 'Ta'; }
  }

  function updateChatHeader(name, avatar) {
    var elName = document.getElementById('chatName');
    var elAvatar = document.getElementById('chatAvatar');
    if (elName) elName.textContent = name || 'Ta';
    if (elAvatar) elAvatar.src = avatar || '';
  }

  // ==================== 进入 / 退出会话 ====================
  function enterContact(id, name, avatar) {
    if (!id) return;

    // 若当前处于群聊态，先退出
    if (window.groupChat && window.groupChat.getCurrentGroup && window.groupChat.getCurrentGroup()) {
      try { window.groupChat.exit(); } catch (e) {}
    }

    state.currentKey = contactKey(id);
    state.replyTarget = state.currentKey;

    // 【解耦】传讯页进入会话时，不再写全局 my_current_contact，
    // 也不动角色面板的"当前角色"标记——角色面板的当前角色独立管理。
    updateChatHeader(name, avatar);
    if (typeof window.refreshChatAvatars === 'function') {
      try { window.refreshChatAvatars(); } catch (e) {}
    }
    // 广播"传讯会话已切换"（供 chat-avatars 等读取方刷新）
    try {
      window.dispatchEvent(new CustomEvent('sessionChanged', { detail: { contactId: id } }));
    } catch (e) {}

    renderCurrent();

    // 同步 chat 输入框 placeholder
    var chatInput = document.getElementById('chatInput');
    if (chatInput) chatInput.placeholder = '输入消息...';
  }

  function enterGroup(id) {
    if (!id) return;
    state.currentKey = groupKey(id);
    state.replyTarget = groupKey(id);
    if (window.groupChat && window.groupChat.enter) {
      try { window.groupChat.enter(id); } catch (e) {}
    }
  }

  // ==================== 会话选择页渲染 ====================
  function renderContacts() {
    var list = document.getElementById('chatHomeContacts');
    if (!list) return;
    var contacts = [];
    try { contacts = JSON.parse(localStorage.getItem('my_contacts') || '[]'); } catch (e) {}
    if (!Array.isArray(contacts)) contacts = [];

    var html = '';
    contacts.forEach(function (c) {
      var sub = getContactSub(c.id);
      html +=
        '<div class="chat-home-item" data-cid="' + escapeHtml(c.id) + '">' +
        '  <img class="chat-home-item-avatar" src="' + escapeHtml(c.avatar || '') + '" alt="">' +
        '  <div class="chat-home-item-main">' +
        '    <div class="chat-home-item-name">' + escapeHtml(c.name || 'Ta') + '</div>' +
        '    <div class="chat-home-item-sub">' + escapeHtml(sub) + '</div>' +
        '  </div>' +
        '  <i class="fa-solid fa-chevron-right chat-home-item-chevron"></i>' +
        '</div>';
    });

    list.innerHTML = html;
    showEmpty('contacts', contacts.length === 0);

    list.querySelectorAll('.chat-home-item').forEach(function (item) {
      item.addEventListener('click', function () {
        var cid = item.getAttribute('data-cid');
        var c = contacts.find(function (x) { return x.id === cid; });
        if (!c) return;
        enterContact(c.id, c.name, c.avatar);
        if (window.showPage) window.showPage('pageChat');
        if (typeof window.rolePanel !== 'undefined' && window.rolePanel.refresh) {
          try { window.rolePanel.refresh(); } catch (e) {}
        }
      });
    });
  }

  function getContactSub(id) {
    var bucket = state.buckets[contactKey(id)];
    if (bucket && bucket.length > 0) {
      var last = bucket[bucket.length - 1];
      if (last.kind === 'image') return '最近：[图片]';
      if (last.kind === 'pat') return '最近：拍了拍';
      if (last.kind === 'call') return '最近：通话记录';
      if (last.kind === 'text' || last.kind === 'quote') return '最近：' + (last.text || '');
      return '最近：一条消息';
    }
    return '点击进入聊天';
  }

  function renderGroups() {
    var list = document.getElementById('chatHomeGroups');
    if (!list) return;

    var groups = [];
    if (window.groupChat && typeof window.groupChat.getGroups === 'function') {
      try { groups = window.groupChat.getGroups() || []; } catch (e) {}
    }
    if (!Array.isArray(groups)) groups = [];

    // 读联系人，用于把 memberIds 解析成有效人数
    var contacts = [];
    try { contacts = JSON.parse(localStorage.getItem('my_contacts') || '[]'); } catch (e) {}
    if (!Array.isArray(contacts)) contacts = [];
    var validIds = {};
    contacts.forEach(function (c) { if (c && c.id) validIds[c.id] = true; });

    var html = '';
    groups.forEach(function (g) {
      // 新结构用 memberIds（过滤已删联系人），旧结构兼容 members
      var memberCount = 0;
      if (Array.isArray(g.memberIds)) {
        memberCount = g.memberIds.filter(function (cid) { return validIds[cid]; }).length;
      } else if (Array.isArray(g.members)) {
        memberCount = g.members.length;
      }
      html +=
        '<div class="chat-home-item" data-gid="' + escapeHtml(g.id) + '">' +
        '  <img class="chat-home-item-avatar" src="' + escapeHtml(g.avatar || '') + '" alt="">' +
        '  <div class="chat-home-item-main">' +
        '    <div class="chat-home-item-name">' + escapeHtml(g.name || '未命名群聊') + '</div>' +
        '    <div class="chat-home-item-sub">' + memberCount + ' 位成员</div>' +
        '  </div>' +
        '  <i class="fa-solid fa-chevron-right chat-home-item-chevron"></i>' +
        '</div>';
    });

    list.innerHTML = html;
    showEmpty('groups', groups.length === 0);

    list.querySelectorAll('.chat-home-item').forEach(function (item) {
      item.addEventListener('click', function () {
        var gid = item.getAttribute('data-gid');
        enterGroup(gid);
        if (window.showPage) window.showPage('pageChat');
      });
    });
  }

  function showEmpty(tab, isEmpty) {
    var emptyEl = document.getElementById('chatHomeEmpty');
    if (!emptyEl) return;
    var tabContacts = document.getElementById('chatHomeTabContacts');
    var activeTab = (tabContacts && tabContacts.classList.contains('active')) ? 'contacts' : 'groups';
    if (!isEmpty || activeTab !== tab) { emptyEl.style.display = 'none'; return; }
    var text = document.getElementById('chatHomeEmptyText');
    if (text) {
      text.textContent = tab === 'contacts'
        ? '还没有联系人 · 点右上角 ＋ 添加'
        : '还没有群聊 · 需要至少 2 位联系人';
    }
    emptyEl.style.display = 'flex';
  }

  function refresh() {
    renderContacts();
    renderGroups();
  }

  // ==================== Tab 切换 ====================
  function bindTabs() {
    var tabContacts = document.getElementById('chatHomeTabContacts');
    var tabGroups = document.getElementById('chatHomeTabGroups');
    var listContacts = document.getElementById('chatHomeContacts');
    var listGroups = document.getElementById('chatHomeGroups');
    if (!tabContacts || !tabGroups) return;

    function activate(tab) {
      tabContacts.classList.toggle('active', tab === 'contacts');
      tabGroups.classList.toggle('active', tab === 'groups');
      if (listContacts) listContacts.style.display = tab === 'contacts' ? 'block' : 'none';
      if (listGroups) listGroups.style.display = tab === 'groups' ? 'block' : 'none';
      if (tab === 'contacts') renderContacts();
      else renderGroups();
    }

    tabContacts.addEventListener('click', function () { activate('contacts'); });
    tabGroups.addEventListener('click', function () { activate('groups'); });
  }

  // ==================== 返回 / 入口 ====================
  function bindNav() {
    var backBtn = document.getElementById('chatHomeBackBtn');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        if (window.showPage) window.showPage('pageHome');
      });
    }

    var chatBackBtn = document.getElementById('chatBackBtn');
    if (chatBackBtn) {
      chatBackBtn.addEventListener('click', function () {
        if (window.showPage) window.showPage('pageChatHome');
        refresh();
      });
    }

    var groupBtn = document.getElementById('chatHomeGroupBtn');
    if (groupBtn) {
      groupBtn.addEventListener('click', function () {
        if (window.groupChat && typeof window.groupChat.open === 'function') {
          try { window.groupChat.open(); } catch (e) {}
        }
      });
    }

    var addBtn = document.getElementById('chatHomeAddBtn');
    if (addBtn) {
      addBtn.addEventListener('click', function () {
        if (window.rolePanel && typeof window.rolePanel.open === 'function') {
          try { window.rolePanel.open(); } catch (e) {}
        }
      });
    }
  }

  // ==================== 监听：联系人切换（角色面板） ====================
  function bindContactChanged() {
    window.addEventListener('contactChanged', function (e) {
      var pageChat = document.getElementById('pageChat');
      var inChat = pageChat && pageChat.classList.contains('active');

      if (inChat) {
        var inGroup = pageChat.classList.contains('group-mode');
        var id = e.detail && e.detail.contactId;
        if (!inGroup && id && state.currentKey !== contactKey(id)) {
          var contacts = [];
          try { contacts = JSON.parse(localStorage.getItem('my_contacts') || '[]'); } catch (err) {}
          var c = contacts.find(function (x) { return x.id === id; });
          if (c) enterContact(c.id, c.name, c.avatar);
        }
        return;
      }

      var pageHome = document.getElementById('pageChatHome');
      if (pageHome && pageHome.classList.contains('active')) {
        refresh();
      }
    });
  }

  // ==================== 初始化 ====================
  function init() {
    bindTabs();
    bindNav();
    bindContactChanged();
    refresh();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { load(init); });
  } else {
    load(init);
  }
  setTimeout(function () { if (!state.loaded) load(init); }, 800);
  setTimeout(function () { if (!state.loaded) load(init); }, 2000);

  // ==================== 暴露 ====================
  window.sessionChat = {
    record: record,
    recordReply: recordReply,
    recordTo: recordTo,
    setReplyTarget: setReplyTarget,
    enterContact: enterContact,
    enterGroup: enterGroup,
    refresh: refresh,
    renderCurrent: renderCurrent,
    getCurrentKey: function () { return state.currentKey; },
    // 当前单聊会话的联系人 id（群聊 / 无会话时返回 null）
    getCurrentContactId: function () {
      if (!state.currentKey || state.currentKey.indexOf('c:') !== 0) return null;
      return state.currentKey.slice(2);
    },
    getBuckets: function () { return state.buckets; },
    // ---------- 本次新增 ----------
    genMsgId: genMsgId,
    toggleFav: toggleFav,
    getMessagesOf: getMessagesOf,
    getFavoritedOf: getFavoritedOf
  };

})();
