/**
 * 群聊模式（独立模块）
 * - 新建群聊：自定义群名、添加多个成员（名字 + 头像）
 * - 切换群聊：顶部标题显示群名，聊天区样式区分
 * - 群聊中发送消息：多个成员随机回复
 * - 使用 localforage 持久化
 * - 完全独立，不影响任何现有逻辑
 */

(function () {
  'use strict';

  var chatMessages = document.getElementById('chatMessages');
  var chatInput = document.getElementById('chatInput');
  var sendBtn = document.getElementById('sendBtn');
  if (!chatMessages || !chatInput || !sendBtn) return;

  // ==================== 存储 ====================
  var STORE_KEY = 'group_chat_data';

  // ==================== 状态 ====================
  var state = {
    groups: [],            // [{ id, name, avatar, members: [{id, name, avatar}], messages: [] }]
    currentGroupId: null,  // 当前群聊 id，null 表示普通聊天
    panel: null            // 群聊设置模态框
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

  function load(callback) {
    function apply(d) {
      if (d && typeof d === 'object') {
        state.groups = Array.isArray(d.groups) ? d.groups : [];
        state.currentGroupId = d.currentGroupId || null;
      }
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
      '      <div class="group-members-edit" id="groupNewMembers"></div>' +
      '      <button class="group-add-member-btn" id="groupAddMemberBtn">' +
      '        <i class="fa-solid fa-plus"></i> 添加成员' +
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

    document.getElementById('groupAddMemberBtn').addEventListener('click', addMemberRow);
    document.getElementById('groupSaveBtn').addEventListener('click', saveNewGroup);

    return panel;
  }

  // ==================== 成员编辑行 ====================
  function addMemberRow() {
    var container = document.getElementById('groupNewMembers');
    if (!container) return;

    var row = document.createElement('div');
    row.className = 'group-member-row';

    var avatarId = 'gma_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    var nameId = 'gmn_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

    row.innerHTML =
      '<div class="group-member-avatar-wrap">' +
      '  <img class="group-member-avatar" id="' + avatarId + '" src="https://picsum.photos/100/100?random=' + Math.floor(Math.random() * 1000) + '" alt="成员头像">' +
      '  <input type="file" class="group-member-file" data-avatar-id="' + avatarId + '" accept="image/*" style="display:none;">' +
      '</div>' +
      '<input type="text" class="group-member-name" id="' + nameId + '" placeholder="成员名字...">' +
      '<input type="text" class="group-member-url" placeholder="或粘贴图片URL" data-avatar-id="' + avatarId + '">' +
      '<button class="group-member-del" title="删除"><i class="fa-solid fa-xmark"></i></button>';

    container.appendChild(row);

    // 点击头像上传
    var avatarEl = row.querySelector('.group-member-avatar');
    var fileEl = row.querySelector('.group-member-file');
    avatarEl.addEventListener('click', function () { fileEl.click(); });
    fileEl.addEventListener('change', function () {
      var file = fileEl.files && fileEl.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (e) { avatarEl.src = e.target.result; };
      reader.readAsDataURL(file);
    });

    // 粘贴 URL
    var urlEl = row.querySelector('.group-member-url');
    urlEl.addEventListener('change', function () {
      var v = urlEl.value.trim();
      if (v) avatarEl.src = v;
    });

    // 删除
    row.querySelector('.group-member-del').addEventListener('click', function () {
      row.remove();
    });
  }

  // ==================== 保存新群聊 ====================
  function saveNewGroup() {
    var nameEl = document.getElementById('groupNewName');
    var name = nameEl.value.trim();
    if (!name) { alert('请输入群聊名称'); return; }

    var memberRows = document.querySelectorAll('#groupNewMembers .group-member-row');
    var members = [];
    memberRows.forEach(function (row) {
      var nameInput = row.querySelector('.group-member-name');
      var avatarImg = row.querySelector('.group-member-avatar');
      var memberName = nameInput ? nameInput.value.trim() : '';
      var memberAvatar = avatarImg ? avatarImg.src : '';
      if (memberName) {
        members.push({
          id: uid(),
          name: memberName,
          avatar: memberAvatar || 'https://picsum.photos/100/100?random=' + Math.floor(Math.random() * 1000)
        });
      }
    });

    if (members.length === 0) {
      // 至少放一个默认成员
      members.push({
        id: uid(),
        name: '成员1',
        avatar: 'https://picsum.photos/100/100?random=' + Math.floor(Math.random() * 1000)
      });
    }

    var newGroup = {
      id: uid(),
      name: name,
      avatar: members[0].avatar,
      members: members,
      messages: []
    };
    state.groups.push(newGroup);

    // 清空表单
    nameEl.value = '';
    document.getElementById('groupNewMembers').innerHTML = '';

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
      var item = document.createElement('div');
      item.className = 'group-list-item' + (g.id === state.currentGroupId ? ' active' : '');
      item.innerHTML =
        '<img class="group-list-avatar" src="' + g.avatar + '" alt="' + escapeHtml(g.name) + '">' +
        '<div class="group-list-info">' +
        '  <div class="group-list-name">' + escapeHtml(g.name) + '</div>' +
        '  <div class="group-list-count">' + g.members.length + ' 位成员</div>' +
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

    // 应用群聊模式
    applyGroupMode(g);
  }

  function applyGroupMode(g) {
    // 在 #pageChat 上加 group-mode 类，用于样式区分
    var pageChat = document.getElementById('pageChat');
    if (pageChat) pageChat.classList.add('group-mode');

    // 顶部标题改为群名
    var chatName = document.getElementById('chatName');
    if (chatName) chatName.textContent = g.name;

    // 顶部头像改为群头像
    var chatAvatar = document.getElementById('chatAvatar');
    if (chatAvatar) chatAvatar.src = g.avatar;

    // 清空聊天区，渲染群聊历史消息
    chatMessages.innerHTML = '';
    renderGroupMessages(g);

    // 在群名下方加一个"退出群聊"按钮（如果没有）
    var chatHeader = document.querySelector('#pageChat .chat-header');
    if (chatHeader && !document.getElementById('exitGroupBtn')) {
      var exitBtn = document.createElement('button');
      exitBtn.id = 'exitGroupBtn';
      exitBtn.className = 'exit-group-btn';
      exitBtn.innerHTML = '<i class="fa-solid fa-arrow-left"></i> 退出群聊';
      exitBtn.addEventListener('click', function () {
        state.currentGroupId = null;
        persist();
        exitGroupMode();
      });
      chatHeader.appendChild(exitBtn);
    }

    // 更新输入框 placeholder
    chatInput.placeholder = '在「' + g.name + '」中发言...';
  }

  function exitGroupMode() {
    var pageChat = document.getElementById('pageChat');
    if (pageChat) pageChat.classList.remove('group-mode');

    // 恢复标题和头像（从当前联系人读取）
    try {
      var contacts = JSON.parse(localStorage.getItem('my_contacts') || '[]');
      var currentId = localStorage.getItem('my_current_contact');
      var cur = contacts.find(function (c) { return c.id === currentId; }) || contacts[0];
      if (cur) {
        if (document.getElementById('chatName')) document.getElementById('chatName').textContent = cur.name;
        if (document.getElementById('chatAvatar')) document.getElementById('chatAvatar').src = cur.avatar;
      }
    } catch (e) {}

    // 移除退出按钮
    var exitBtn = document.getElementById('exitGroupBtn');
    if (exitBtn) exitBtn.remove();

    // 清空并恢复单聊欢迎消息
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
      var row = createGroupMessageRow(msg.type, msg);
      chatMessages.appendChild(row);
    });
    requestAnimationFrame(function () {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    });
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
      // 对方成员
      var avatar = document.createElement('img');
      avatar.className = 'chat-msg-avatar';
      avatar.src = msg.avatar || 'https://picsum.photos/100/100?random=1';
      row.appendChild(avatar);

      var wrap = document.createElement('div');
      wrap.className = 'group-msg-wrap';

      var nameEl = document.createElement('div');
      nameEl.className = 'group-msg-name';
      nameEl.textContent = msg.name || '成员';
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

    // 触发群成员回复
    triggerGroupReplies(g);
  }

  // ==================== 群成员随机回复 ====================
  function triggerGroupReplies(g) {
    if (!g || g.members.length === 0) return;

    // 随机 2-4 个成员回复
    var replyCount = 2 + Math.floor(Math.random() * 3);
    var shuffled = g.members.slice().sort(function () { return Math.random() - 0.5; });
    var repliers = shuffled.slice(0, Math.min(replyCount, g.members.length));

    // 回复短语池
    var replyPool = [
      '哈哈哈',
      '我也这么觉得',
      '厉害啊',
      '然后呢？',
      '嗯嗯',
      '有道理',
      '收到！',
      '真的假的',
      '说得好',
      '确实',
      '哈哈哈哈哈',
      '这波可以',
      '我不信',
      '牛！',
      '让我康康'
    ];

    repliers.forEach(function (member, index) {
      var delay = 800 + index * 900 + Math.random() * 800;
      setTimeout(function () {
        var text = replyPool[Math.floor(Math.random() * replyPool.length)];
        var msg = {
          type: 'other',
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
      }, delay);
    });
  }

  // ==================== 拦截发送（群聊模式） ====================
  // 使用捕获阶段拦截
  function interceptSend() {
    var originalSend = sendBtn.onclick;
    // 直接在捕获阶段处理
  }

  // 拦截发送按钮
  sendBtn.addEventListener('click', function (e) {
    if (!state.currentGroupId) return; // 非群聊模式交给原逻辑
    e.stopImmediatePropagation();
    e.preventDefault();
    var text = chatInput.value.trim();
    if (!text) return;
    chatInput.value = '';
    sendBtn.disabled = true;
    sendGroupMessage(text);
  }, true);

  // 拦截回车
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

  // ==================== 绑定群聊图标 ====================
  function bindGroupIcon() {
    // 找到"群聊"图标（我们复用"存钱罐"旁边的图标位，或者新增一个）
    // 由于您没有指定具体是哪个图标，我们使用一个独立的悬浮按钮
    // 但为了不破坏现有结构，我们在传讯页顶栏加一个群聊图标（如果尚未存在）
    var chatActions = document.querySelector('#pageChat .chat-actions');
    if (!chatActions) return;
    if (document.getElementById('groupChatIcon')) return;

    var icon = document.createElement('div');
    icon.className = 'chat-action-icon';
    icon.id = 'groupChatIcon';
    icon.title = '群聊';
    icon.innerHTML = '<i class="fa-solid fa-users"></i>';
    icon.addEventListener('click', function (e) {
      e.stopImmediatePropagation();
      e.preventDefault();
      openGroupPanel();
    }, true);

    // 插到"主页"图标之前
    var homeIcon = chatActions.querySelector('[title="主页"]');
    if (homeIcon) {
      chatActions.insertBefore(icon, homeIcon);
    } else {
      chatActions.appendChild(icon);
    }
  }

  // ==================== 打开/关闭面板 ====================
  function openGroupPanel() {
    createGroupPanel();
    renderGroupList();
    state.panel.classList.add('active');
  }

  function closeGroupPanel() {
    if (state.panel) state.panel.classList.remove('active');
  }

  // ==================== 初始化 ====================
  function init() {
    bindGroupIcon();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      load(init);
    });
  } else {
    load(init);
  }

  setTimeout(function () {
    load(init);
  }, 500);
  setTimeout(function () {
    load(init);
  }, 1500);

  // 暴露给外部
  window.groupChat = {
    open: openGroupPanel,
    enter: enterGroup,
    exit: exitGroupMode,
    getCurrentGroup: getCurrentGroup
  };

})();
