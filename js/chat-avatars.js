/**
 * 传讯消息头像（独立模块）
 * - 每条"接收"消息左侧显示对方头像
 * - 每条"发送"消息右侧显示我的头像
 * - 不影响任何现有聊天逻辑
 * - 通过 MutationObserver 监听消息列表变化，自动为每条消息加上头像
 *
 * 解耦说明（本次改动）：
 * - "对方是谁"不再读全局 my_current_contact，
 *   改为读传讯模块自己的当前会话 window.sessionChat.getCurrentContactId()
 * - 监听 sessionChanged 事件（传讯切换会话时触发）刷新头像
 */

(function () {
  'use strict';

  var chatMessages = document.getElementById('chatMessages');
  if (!chatMessages) return;

  // ==================== 当前聊天对象 id（来自传讯模块） ====================
  function getCurrentContactId() {
    // 优先传讯模块自己的当前会话
    if (window.sessionChat && typeof window.sessionChat.getCurrentContactId === 'function') {
      try {
        var id = window.sessionChat.getCurrentContactId();
        if (id) return id;
      } catch (e) {}
    }
    // 兜底：从聊天页顶栏头像/昵称无从取 id 时，退回 my_contacts 第一个
    return null;
  }

  // ==================== 获取对方头像 ====================
  function getContactAvatar() {
    // 1) 传讯当前会话联系人
    var curId = getCurrentContactId();
    try {
      var contacts = JSON.parse(localStorage.getItem('my_contacts') || '[]');
      if (Array.isArray(contacts) && contacts.length > 0) {
        var cur = null;
        if (curId) {
          cur = contacts.find(function (c) { return c.id === curId; });
        }
        // 找不到（或群聊态无单聊 id）时退回第一个，避免头像空白
        if (!cur) cur = contacts[0];
        if (cur && cur.avatar) return cur.avatar;
      }
    } catch (e) {}
    // 2) 回退：聊天页顶栏头像
    var chatAvatar = document.getElementById('chatAvatar');
    if (chatAvatar && chatAvatar.src) return chatAvatar.src;
    return 'https://picsum.photos/200/200?random=99';
  }

  // ==================== 获取「我的」昵称 ====================
  function getMyName() {
    try {
      var raw = localStorage.getItem('my_profile');
      if (raw) {
        var p = JSON.parse(raw);
        if (p && p.name) return p.name;
      }
    } catch (e) {}
    return '我';
  }

  // ==================== 获取我的头像 ====================
  function getMyAvatar() {
    // 优先「我的角色」面板设置（角色面板 → 保存我的资料）
    try {
      var rawProfile = localStorage.getItem('my_profile');
      if (rawProfile) {
        var p = JSON.parse(rawProfile);
        if (p && p.avatar) return p.avatar;
      }
    } catch (e) {}
    // 其次从主页头像读取
    var avatarImg = document.getElementById('avatarImg');
    if (avatarImg && avatarImg.src) return avatarImg.src;
    // 从 homeSettings 读取
    if (window.homeSettings && window.homeSettings.current && window.homeSettings.current.avatar) {
      return window.homeSettings.current.avatar;
    }
    // 从 localStorage 读取
    try {
      var raw = localStorage.getItem('home_custom_images');
      if (raw) {
        var data = JSON.parse(raw);
        if (data && data.avatar) return data.avatar;
      }
    } catch (e) {}
    return 'https://picsum.photos/100/100?random=1';
  }

  // ==================== 为单条消息添加头像 ====================
  function addAvatarToRow(row) {
    if (!row) return;
    // 系统消息（通话记录）不加头像
    if (row.classList.contains('call-record')) return;

    var isSelf = row.classList.contains('self');
    var existing = row.querySelector('.chat-msg-avatar');

    // 已有头像（群聊行由 group-chat.js 自带头像）→ 只需补「我」的昵称标签
    if (existing) {
      if (isSelf && !row.querySelector('.chat-msg-my-name')) {
        var nameTag = document.createElement('span');
        nameTag.className = 'chat-msg-my-name';
        nameTag.textContent = getMyName();
        row.insertBefore(nameTag, existing);
      }
      return;
    }
    if (row.querySelector('.chat-msg-my-name')) return;

    var avatar = document.createElement('img');
    avatar.className = 'chat-msg-avatar';
    avatar.src = isSelf ? getMyAvatar() : getContactAvatar();
    avatar.alt = isSelf ? '我' : '对方';
    avatar.onerror = function () {
      avatar.src = isSelf
        ? 'https://picsum.photos/100/100?random=1'
        : 'https://picsum.photos/200/200?random=99';
    };

    if (isSelf) {
      row.appendChild(avatar);
      if (!row.querySelector('.chat-msg-my-name')) {
        var nameTag2 = document.createElement('span');
        nameTag2.className = 'chat-msg-my-name';
        nameTag2.textContent = getMyName();
        row.insertBefore(nameTag2, avatar);
      }
    } else {
      row.insertBefore(avatar, row.firstChild);
    }
  }

  // ==================== 扫描所有消息 ====================
  function scanAllMessages() {
    chatMessages.querySelectorAll('.message-row').forEach(function (row) {
      // 系统消息（通话记录）不加头像
      if (row.classList.contains('call-record')) return;
      addAvatarToRow(row);
    });
  }

  // ==================== 监听 DOM 变化 ====================
   var observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      mutation.addedNodes.forEach(function (node) {
        if (node.nodeType === 1) {
          if (node.classList && node.classList.contains('message-row')) {
            // 系统消息跳过
            if (!node.classList.contains('call-record')) {
              setTimeout(function () { addAvatarToRow(node); }, 0);
            }
          } else if (node.querySelectorAll) {
            node.querySelectorAll('.message-row').forEach(function (row) {
              if (!row.classList.contains('call-record')) {
                setTimeout(function () { addAvatarToRow(row); }, 0);
              }
            });
          }
        }
      });
    });
  });

  observer.observe(chatMessages, { childList: true, subtree: true });

  // ==================== 监听联系人或头像变化 ====================
  // 当主页头像 / 我的资料 / 联系人列表变化时，重新应用所有头像
  window.addEventListener('storage', function (e) {
    if (e.key === 'home_custom_images' || e.key === 'my_profile' || e.key === 'my_contacts') {
      refreshAllAvatars();
    }
  });

  // 传讯切换会话时（session-chat 广播），刷新头像
  window.addEventListener('sessionChanged', function () {
    refreshAllAvatars();
  });

  function refreshAllAvatars() {
    // 移除所有旧头像和昵称标签，重新添加
    chatMessages.querySelectorAll('.chat-msg-avatar, .chat-msg-my-name').forEach(function (a) { a.remove(); });
    scanAllMessages();
  }

  // 主动刷新（供外部调用）
  window.refreshChatAvatars = refreshAllAvatars;

  // ==================== 初始化 ====================
  function init() {
    scanAllMessages();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 稍后再扫描一次，确保首次渲染的消息也加上头像
  setTimeout(init, 300);
  setTimeout(init, 1000);

})();
