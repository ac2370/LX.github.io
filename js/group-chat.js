/**
 * 群聊模式（独立模块）
 * - 新建群聊：从「已添加联系人」中多选成员（不再手填）
 * - 群成员只存联系人 id，显示时实时从 my_contacts 查名字/头像
 * - 联系人被删除 → 自动从所有群成员中移除
 * - 群聊中发送消息：多个成员随机回复
 * - 使用 localforage 持久化
 *
 * 本次改造：
 * - 成员从手填改为「从 my_contacts 勾选」
 * - 群数据结构：memberIds: [contactId, ...]
 * - 旧结构（成员是对象）初始化时清空
 * - 退出群聊恢复顶栏改用 sessionChat 的当前会话
 */

(function () {
  'use strict';

  var chatMessages = document.getElementById('chatMessages');
  var chatInput = document.getElementById('chatInput');
  var sendBtn = document.getElementById('sendBtn');
  if (!chatMessages || !chatInput || !sendBtn) return;

  // ==================== 存储 ====================
  var STORE_KEY = 'group_chat_data';
  var LS_CONTACTS_KEY = 'my_contacts';

  // ==================== 状态 ====================
  var state = {
    groups: [],            // [{ id, name, avatar, memberIds: [cid], messages: [] }]
    currentGroupId: null,  // 当前群聊 id，null 表示普通聊天
    panel: null,           // 群聊设置模态框
    pendingMemberIds: []   // 新建群时暂存的已选成员 id
  };

  // ==================== 持久化 ====================
  function persist() {
    var data = {
      groups: state.groups,
      currentGroupId: state.currentGroupId
    };
    if (typeof localforage !== 'undefined') {
      localforage.setItem(STORE_KEY, data).catch(function () {});
    } else {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (e) {}
    }
  }

  // 判断群结构是否为旧结构（成员是对象数组而非 id 数组）
  function isLegacyGroup(g) {
    if (!g) return false;
    if (!Array.isArray(g.members)) return false;
    // 旧结构：members[0] 是对象（有 name/avatar 字段）
    return typeof g.members[0] === 'object';
  }

  function load(callback) {
    function apply(d) {
      var needRewrite = false;
      if (d && typeof d === 'object') {
        state.groups = Array.isArray(d.groups) ? d.groups : [];
        state.currentGroupId = d.currentGroupId || null;

        // 【3C】清空旧结构群聊：只要有任何一个是旧结构，全部清空
        var hasLegacy = state.groups.some(isLegacyGroup);
        if (hasLegacy) {
          state.groups = [];
          state.currentGroupId = null;
          needRewrite = true;
          console.log('[group-chat] 检测到旧结构群聊，已按约定清空');
        }
      }
      if (needRewrite) persist();
      if (callback) callback();
    }
    if (typeof localforage !== 'undefined') {
      localforage.getItem(STORE_KEY).then(apply).catch(function () { apply(null); });
    } else {
      try {
        var raw = localStorage.getItem(STORE_KEY);
        apply(raw ? JSON.parse(raw) : null);
      } catch (e) { apply(null); }
    }
  }

  // ==================== 联系人读取 ====================
  function loadContacts() {
    try {
      var arr = JSON.parse(localStorage.getItem(LS_CONTACTS_KEY) || '[]');
      if (Array.isArray(arr)) return arr.filter(function (c) { return c && c.id; });
    } catch (e) {}
    return [];
  }

  function getContactById(id) {
    if (!id) return null;
    var contacts = loadContacts();
    return contacts.find(function (c) { return c.id === id; }) || null;
  }

  // 群成员 id 列表 → 联系人对象列表（查不到的丢弃）
  function resolveMembers(group) {
    if (!group || !Array.isArray(group.memberIds)) return [];
    var contacts = loadContacts();
    var map = {};
    contacts.forEach(function (c) { map[c.id] = c; });
    var result = [];
    group.memberIds.forEach(function (cid) {
      if (map[cid]) result.push(map[cid]);
    });
    return result;
  }

  // 【2B】联系人被删除 → 从所有群成员里移除
  function pruneDeletedMembers() {
    var contacts = loadContacts();
    var validIds = {};
    contacts.forEach(function (c) { validIds[c.id] = true; });

    var changed = false;
    state.groups.forEach(function (g) {
      if (!Array.isArray(g.memberIds)) return;
      var next = g.memberIds.filter(function (cid) { return validIds[cid]; });
      if (next.length !== g.memberIds.length) {
        g.memberIds = next;
        changed = true;
      }
    });
    if (changed) persist();
    return changed;
  }

  // ==================== 工具 ====================
  function uid() {
    return 'g_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

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
    return 'https://picsum.photos/100/100?random=1';
  }

  function getCurrentGroup() {
    if (!state.currentGroupId) return null;
    return state.groups.find(function (g) { return g.id === state.currentGroupId; }) || null;
  }

  // ==================== 群聊设置模态框 ====================
  function createGroupPanel() {
    if (state.panel) return state.panel;

    var panel = document.createElement('div');
    panel.id = 'groupChatPanel';
    panel.className = 'group-chat-modal';
    panel.innerHTML =
      '<div class="group-chat-panel">' +
      '  <div class="group-chat-header">' +
      '    <span class="group-chat-title"><i class="fa-solid fa-users"></i> 群聊设置</span>' +
      '    <button class="group-chat-close" id="groupChatClose"><i class="fa-solid fa-xmark"></i></button>' +
      '  </div>' +
      '  <div class="group-chat-body">' +
      '    <div class="group-new-box">' +
      '      <div class="group-new-title">新建群聊</div>' +
      '      <input type="text" class="group-new-input" id="groupNewName" placeholder="群聊名称...">' +
      '      <div class="group-picked-members" id="groupPickedMembers"></div>' +
      '      <button class="group-add-member-btn" id="groupPickMembersBtn">' +
      '        <i class="fa-solid fa-user-plus"></i> 选择成员' +
      '      </button>' +
      '      <button class="group-save-btn" id="groupSaveBtn">' +
      '        <i class="fa-solid fa-check"></i> 创建群聊' +
      '      </button>' +
      '    </div>' +
      '    <div class="group-list-title">已创建的群聊</div>' +
      '    <div class="group-list" id="groupList"></div>' +
      '  </div>' +
      '</div>';

    document.body.appendChild(panel);
    state.panel = panel;

    document.getElementById('groupChatClose').addEventListener('click', closeGroupPanel);
    panel.addEventListener('click', function (e) {
      if (e.target === panel) closeGroupPanel();
    });

    document.getElementById('groupPickMembersBtn').addEventListener('click', openMemberPicker);
    document.getElementById('groupSaveBtn').addEventListener('click', saveNewGroup);

    return panel;
  }

  // ==================== 已选成员预览（新建群区） ====================
  function renderPickedMembers() {
    var box = document.getElementById('groupPickedMembers');
    if (!box) return;

    var ids = state.pendingMemberIds || [];
    if (ids.length === 0) {
      box.innerHTML = '<div class="group-picked-empty">还没有选择成员</div>';
      return;
    }

    var html = '';
    ids.forEach(function (cid) {
      var c = getContactById(cid);
      if (!c) return;
      var avatar = c.avatar
        ? '<img src="' + escapeHtml(c.avatar) + '" alt="">'
        : '<span class="group-picked-avatar-text">' + escapeHtml((c.name || '?').slice(0, 1)) + '</span>';
      html += '<div class="group-picked-item" data-cid="' + escapeHtml(cid) + '">' +
        '<div class="group-picked-avatar">' + avatar + '</div>' +
        '<div class="group-picked-name">' + escapeHtml(c.name || '未命名') + '</div>' +
        '<button class="group-picked-remove" data-cid="' + escapeHtml(cid) + '" title="移除"><i class="fa-solid fa-xmark"></i></button>' +
        '</div>';
    });
    box.innerHTML = html;

    box.querySelectorAll('.group-picked-remove').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var cid = btn.getAttribute('data-cid');
        state.pendingMemberIds = state.pendingMemberIds.filter(function (x) { return x !== cid; });
        renderPickedMembers();
      });
    });
  }

  // ==================== 联系人多选弹层 ====================
  function openMemberPicker() {
    var old = document.getElementById('groupMemberPicker');
    if (old && old.parentNode) old.parentNode.removeChild(old);

    var contacts = loadContacts();
    if (contacts.length === 0) {
      alert('还没有联系人，请先到传讯页右上角添加');
      return;
    }

    var selected = {};
    (state.pendingMemberIds || []).forEach(function (cid) { selected[cid] = true; });

    var listHtml = '';
    contacts.forEach(function (c) {
      var avatar = c.avatar
        ? '<img class="gmp-avatar" src="' + escapeHtml(c.avatar) + '" alt="">'
        : '<span class="gmp-avatar gmp-avatar-text">' + escapeHtml((c.name || '?').slice(0, 1)) + '</span>';
      listHtml +=
        '<div class="gmp-item" data-cid="' + escapeHtml(c.id) + '">' +
        '  <div class="gmp-check"><i class="fa-solid fa-check"></i></div>' +
        avatar +
        '  <div class="gmp-name">' + escapeHtml(c.name || '未命名') + '</div>' +
        '</div>';
    });

    var modal = document.createElement('div');
    modal.id = 'groupMemberPicker';
    modal.className = 'gmp-modal';
    modal.innerHTML =
      '<div class="gmp-panel">' +
        '<div class="gmp-title">选择群成员</div>' +
        '<div class="gmp-list">' + listHtml + '</div>' +
        '<div class="gmp-footer">' +
          '<button class="gmp-cancel">取消</button>' +
          '<button class="gmp-confirm">确定</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);
    requestAnimationFrame(function () { modal.classList.add('active'); });

    // 初始化选中态
    modal.querySelectorAll('.gmp-item').forEach(function (item) {
      var cid = item.getAttribute('data-cid');
      if (selected[cid]) item.classList.add('checked');
      item.addEventListener('click', function () {
        if (selected[cid]) {
          delete selected[cid];
          item.classList.remove('checked');
        } else {
          selected[cid] = true;
          item.classList.add('checked');
        }
      });
    });

    function close() {
      modal.classList.remove('active');
      setTimeout(function () {
        if (modal.parentNode) modal.parentNode.removeChild(modal);
      }, 200);
    }

    modal.querySelector('.gmp-cancel').addEventListener('click', close);
    modal.querySelector('.gmp-confirm').addEventListener('click', function () {
      state.pendingMemberIds = Object.keys(selected);
      close();
      renderPickedMembers();
    });
    modal.addEventListener('click', function (e) {
      if (e.target === modal) close();
    });
  }

  // ==================== 保存新群聊 ====================
  function saveNewGroup() {
    var nameEl = document.getElementById('groupNewName');
    var name = nameEl.value.trim();
    if (!name) { alert('请输入群聊名称'); return; }

    var memberIds = (state.pendingMemberIds || []).slice();
    if (memberIds.length < 2) {
      alert('群聊至少需要 2 位成员');
      return;
    }

    // 第一个成员的头像作为群头像（取不到就默认）
    var first = getContactById(memberIds[0]);
    var groupAvatar = (first && first.avatar) || 'https://picsum.photos/100/100?random=1';

    var newGroup = {
      id: uid(),
      name: name,
      avatar: groupAvatar,
      memberIds: memberIds,
      messages: []
    };
    state.groups.push(newGroup);

    // 清空表单
    nameEl.value = '';
    state.pendingMemberIds = [];
    renderPickedMembers();

    persist();
    renderGroupList();
    alert('群聊「' + name + '」已创建');
  }

  // ==================== 渲染群聊列表 ====================
  function renderGroupList() {
    var list = document.getElementById('groupList');
    if (!list) return;

    if (state.groups.length === 0) {
      list.innerHTML = '<div class="group-empty">还没有群聊，创建一个吧~</div>';
      return;
    }

    list.innerHTML = '';
    state.groups.forEach(function (g) {
      var members = resolveMembers(g);
      var memberCount = members.length;

      var item = document.createElement('div');
      item.className = 'group-list-item' + (g.id === state.currentGroupId ? ' active' : '');
      item.innerHTML =
        '<img class="group-list-avatar" src="' + escapeHtml(g.avatar || '') + '" alt="' + escapeHtml(g.name) + '">' +
        '<div class="group-list-info">' +
        '  <div class="group-list-name">' + escapeHtml(g.name) + '</div>' +
        '  <div class="group-list-count">' + memberCount + ' 位成员</div>' +
        '</div>' +
        '<button class="group-list-del" title="删除"><i class="fa-solid fa-trash-can"></i></button>';

      item.addEventListener('click', function (e) {
        if (e.target.closest('.group-list-del')) return;
        enterGroup(g.id);
      });

      item.querySelector('.group-list-del').addEventListener('click', function (e) {
        e.stopPropagation();
        if (!confirm('确定删除群聊「' + g.name + '」吗？')) return;
        state.groups = state.groups.filter(function (x) { return x.id !== g.id; });
        if (state.currentGroupId === g.id) {
          state.currentGroupId = null;
          exitGroupMode();
        }
        persist();
        renderGroupList();
      });

      list.appendChild(item);
    });
  }

  // ==================== 进入/退出群聊 ====================
  function enterGroup(groupId) {
    var g = state.groups.find(function (x) { return x.id === groupId; });
    if (!g) return;
    state.currentGroupId = groupId;
    persist();

    closeGroupPanel();

    applyGroupMode(g);
  }

  function applyGroupMode(g) {
    var pageChat = document.getElementById('pageChat');
    if (pageChat) pageChat.classList.add('group-mode');

    var chatName = document.getElementById('chatName');
    if (chatName) chatName.textContent = g.name;

    var chatAvatar = document.getElementById('chatAvatar');
    if (chatAvatar) chatAvatar.src = g.avatar;

    chatMessages.innerHTML = '';
    renderGroupMessages(g);

    chatInput.placeholder = '在「' + g.name + '」中发言...';
  }

  function exitGroupMode() {
    var pageChat = document.getElementById('pageChat');
    if (pageChat) pageChat.classList.remove('group-mode');

    // 【6 改】恢复顶栏：用传讯当前会话的人，不再读 my_current_contact
    try {
      var curId = null;
      if (window.sessionChat && typeof window.sessionChat.getCurrentContactId === 'function') {
        curId = window.sessionChat.getCurrentContactId();
      }
      var contacts = loadContacts();
      var cur = null;
      if (curId) cur = contacts.find(function (c) { return c.id === curId; });
      if (!cur) cur = contacts[0];
      if (cur) {
        var nameEl = document.getElementById('chatName');
        var avatarEl = document.getElementById('chatAvatar');
        if (nameEl) nameEl.textContent = cur.name || 'Ta';
        if (avatarEl) avatarEl.src = cur.avatar || '';
      }
    } catch (e) {}

    var exitBtn = document.getElementById('exitGroupBtn');
    if (exitBtn) exitBtn.remove();

    chatMessages.innerHTML = '';
    var welcome = document.createElement('div');
    welcome.className = 'message-row other';
    welcome.innerHTML = '<div class="message-bubble">你好呀，我是 Ta 👋</div>';
    chatMessages.appendChild(welcome);

    chatInput.placeholder = '输入消息...';
  }

  // ==================== 渲染群聊消息 ====================
  function renderGroupMessages(g) {
    if (!g) return;
    g.messages.forEach(function (msg) {
      var row;
      if (msg && msg.type === 'system') {
        row = createGroupSystemRow(msg.text || '');
      } else {
        row = createGroupMessageRow(msg.type, msg);
      }
      if (row) chatMessages.appendChild(row);
    });
    requestAnimationFrame(function () {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    });
  }

    // 群聊系统条（居中灰条，如"你拍了拍 小明：xxx"）
  function createGroupSystemRow(text) {
    var row = document.createElement('div');
    row.className = 'message-row system-call-event';
    var bubble = document.createElement('div');
    bubble.className = 'call-record-bubble';
    bubble.innerHTML = '<i class="fa-solid fa-hand"></i><span>' + escapeHtml(text) + '</span>';
    row.appendChild(bubble);
    return row;
  }
  
  // ==================== 群聊消息行（带成员头像和名字） ====================
  function createGroupMessageRow(type, msg) {
    var row = document.createElement('div');
    row.className = 'message-row group-msg ' + type;

    if (type === 'self') {
      var bubbleSelf = document.createElement('div');
      bubbleSelf.className = 'message-bubble';
      if (msg.type === 'image') {
        var imgSelf = document.createElement('img');
        imgSelf.src = msg.url;
        imgSelf.style.maxWidth = '160px';
        imgSelf.style.borderRadius = '12px';
        imgSelf.style.display = 'block';
        bubbleSelf.appendChild(imgSelf);
      } else {
        bubbleSelf.textContent = msg.text || '';
      }
      row.appendChild(bubbleSelf);

      var myAvatar = document.createElement('img');
      myAvatar.className = 'chat-msg-avatar';
      myAvatar.src = getMyAvatar();
      row.appendChild(myAvatar);
    } else {
      // 对方成员：msg.memberId 若在，实时取最新头像；否则用快照
      var memberId = msg.memberId;
      var live = memberId ? getContactById(memberId) : null;
      var avatarSrc = (live && live.avatar) || msg.avatar || 'https://picsum.photos/100/100?random=1';
      var displayName = (live && live.name) || msg.name || '成员';

      var avatar = document.createElement('img');
      avatar.className = 'chat-msg-avatar';
      avatar.src = avatarSrc;
      row.appendChild(avatar);

      var wrap = document.createElement('div');
      wrap.className = 'group-msg-wrap';

      var nameEl = document.createElement('div');
      nameEl.className = 'group-msg-name';
      nameEl.textContent = displayName;
      wrap.appendChild(nameEl);

      var bubble = document.createElement('div');
      bubble.className = 'message-bubble';
      if (msg.type === 'image') {
        var img = document.createElement('img');
        img.src = msg.url;
        img.style.maxWidth = '160px';
        img.style.borderRadius = '12px';
        img.style.display = 'block';
        bubble.appendChild(img);
      } else {
        bubble.textContent = msg.text || '';
      }
      wrap.appendChild(bubble);
      row.appendChild(wrap);
    }

    return row;
  }

  // ==================== 群聊发送消息 ====================
  function sendGroupMessage(content) {
    var g = getCurrentGroup();
    if (!g) return;

    var msg = { type: 'self', text: content };
    g.messages.push(msg);
    chatMessages.appendChild(createGroupMessageRow('self', msg));
    requestAnimationFrame(function () {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    });
    persist();

    // 显示"思念送達中"浮层（随机挑一个群成员的头像）
    if (window.showTypingFloat) {
      var members = resolveMembers(g);
      var pick = members.length > 0 ? members[Math.floor(Math.random() * members.length)] : null;
      window.showTypingFloat(pick ? pick.avatar : '');
    }

    triggerGroupReplies(g);
  }

  // ==================== 群成员随机回复 ====================
   function triggerGroupReplies(g) {
    if (!g) return;
    var members = resolveMembers(g);
    if (members.length === 0) {
      if (window.hideTypingFloat) window.hideTypingFloat();
      return;
    }

    var replyCount = 2 + Math.floor(Math.random() * 3);
    var shuffled = members.slice().sort(function () { return Math.random() - 0.5; });
    var repliers = shuffled.slice(0, Math.min(replyCount, members.length));

    var replyPool = [
      '哈哈哈', '我也这么觉得', '厉害啊', '然后呢？', '嗯嗯',
      '有道理', '收到！', '真的假的', '说得好', '确实',
      '哈哈哈哈哈', '这波可以', '我不信', '牛！', '让我康康'
    ];

    repliers.forEach(function (member, index) {
      var delay = 800 + index * 900 + Math.random() * 800;
      setTimeout(function () {
        var text = replyPool[Math.floor(Math.random() * replyPool.length)];
        var msg = {
          type: 'other',
          memberId: member.id,
          name: member.name,
          avatar: member.avatar,
          text: text
        };
        g.messages.push(msg);
        chatMessages.appendChild(createGroupMessageRow('other', msg));
        requestAnimationFrame(function () {
          chatMessages.scrollTop = chatMessages.scrollHeight;
        });
        persist();

        // 【新增】最后一条回复渲染完 → 隐藏浮层
        if (index === repliers.length - 1) {
          setTimeout(function () {
            if (window.hideTypingFloat) window.hideTypingFloat();
          }, 300);
        }
      }, delay);
    });
  }

  // ==================== 拦截发送（群聊模式） ====================
  sendBtn.addEventListener('click', function (e) {
    if (!state.currentGroupId) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    var text = chatInput.value.trim();
    if (!text) return;
    chatInput.value = '';
    sendBtn.disabled = true;
    sendGroupMessage(text);
  }, true);

  chatInput.addEventListener('keydown', function (e) {
    if (!state.currentGroupId) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.stopImmediatePropagation();
      e.preventDefault();
      var text = chatInput.value.trim();
      if (!text) return;
      chatInput.value = '';
      sendBtn.disabled = true;
      sendGroupMessage(text);
    }
  }, true);

  // ==================== 打开/关闭面板 ====================
  function openGroupPanel() {
    createGroupPanel();
    state.pendingMemberIds = [];
    renderPickedMembers();
    renderGroupList();
    state.panel.classList.add('active');
  }

  function closeGroupPanel() {
    if (state.panel) state.panel.classList.remove('active');
  }

  // ==================== 联系人变化监听（删除即移除） ====================
  function bindContactPrune() {
    // storage 变化（跨标签）
    window.addEventListener('storage', function (e) {
      if (e.key === LS_CONTACTS_KEY) {
        if (pruneDeletedMembers()) {
          if (state.panel && state.panel.classList.contains('active')) {
            renderGroupList();
          }
        }
      }
    });
    // 同标签内，角色面板发 contactChanged
    window.addEventListener('contactChanged', function () {
      if (pruneDeletedMembers()) {
        if (state.panel && state.panel.classList.contains('active')) {
          renderGroupList();
        }
      }
    });
  }

  // ==================== 初始化 ====================
  function init() {
    bindContactPrune();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      load(init);
    });
  } else {
    load(init);
  }

  setTimeout(function () { load(init); }, 500);
  setTimeout(function () { load(init); }, 1500);

  // ==================== 暴露 ====================
  window.groupChat = {
    open: openGroupPanel,
    enter: enterGroup,
    exit: exitGroupMode,
    getCurrentGroup: getCurrentGroup,
    getGroups: function () { return state.groups.slice(); },
    // 追加一条系统消息到指定群（用于拍一拍等），并落盘 + 渲染
    appendSystemMessage: function (groupId, text) {
      var g = state.groups.find(function (x) { return x.id === groupId; });
      if (!g) return false;
      var msg = { type: 'system', text: text };
      g.messages.push(msg);
      // 若正在看这个群，实时渲染
      if (state.currentGroupId === groupId && chatMessages) {
        var row = createGroupSystemRow(text);
        chatMessages.appendChild(row);
        requestAnimationFrame(function () {
          chatMessages.scrollTop = chatMessages.scrollHeight;
        });
      }
      persist();
      return true;
    }
  };

})();
