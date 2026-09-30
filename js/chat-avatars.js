/**
 * 传讯消息头像（独立模块）
 * - 每条"接收"消息左侧显示对方头像
 * - 每条"发送"消息右侧显示我的头像
 * - 不影响任何现有聊天逻辑
 * - 通过 MutationObserver 监听消息列表变化，自动为每条消息加上头像
 */

(function () {
  'use strict';

  var chatMessages = document.getElementById('chatMessages');
  if (!chatMessages) return;

  // ==================== 获取对方头像 ====================
  function getContactAvatar() {
    var chatAvatar = document.getElementById('chatAvatar');
    if (chatAvatar && chatAvatar.src) return chatAvatar.src;
    // 从 localStorage 读取当前联系人
    try {
      var contacts = JSON.parse(localStorage.getItem('my_contacts') || '[]');
      var currentId = localStorage.getItem('my_current_contact');
      if (Array.isArray(contacts)) {
        var cur = contacts.find(function (c) { return c.id === currentId; }) || contacts[0];
        if (cur && cur.avatar) return cur.avatar;
      }
    } catch (e) {}
    return 'https://picsum.photos/200/200?random=99';
  }

  // ==================== 获取我的头像 ====================
  function getMyAvatar() {
    // 优先从主页头像读取
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
    if (!row || row.querySelector('.chat-msg-avatar')) return;

    var isSelf = row.classList.contains('self');
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
      // 自己：头像放在气泡右边
      row.appendChild(avatar);
    } else {
      // 对方：头像放在气泡左边
      row.insertBefore(avatar, row.firstChild);
    }
  }

  // ==================== 扫描所有消息 ====================
  function scanAllMessages() {
    chatMessages.querySelectorAll('.message-row').forEach(function (row) {
      // 跳过三点输入气泡（typingRow 也算 other，但也加头像更自然）
      addAvatarToRow(row);
    });
  }

  // ==================== 监听 DOM 变化 ====================
  var observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      mutation.addedNodes.forEach(function (node) {
        if (node.nodeType === 1) {
          if (node.classList && node.classList.contains('message-row')) {
            // 延迟一点，确保内容渲染完成
            setTimeout(function () { addAvatarToRow(node); }, 0);
          } else if (node.querySelectorAll) {
            node.querySelectorAll('.message-row').forEach(function (row) {
              setTimeout(function () { addAvatarToRow(row); }, 0);
            });
          }
        }
      });
    });
  });

  observer.observe(chatMessages, { childList: true, subtree: true });

  // ==================== 监听联系人或头像变化 ====================
  // 当主页头像更新时，重新应用所有头像
  window.addEventListener('storage', function (e) {
    if (e.key === 'home_custom_images' || e.key === 'my_contacts' || e.key === 'my_current_contact') {
      refreshAllAvatars();
    }
  });

  function refreshAllAvatars() {
    // 移除所有旧头像，重新添加
    chatMessages.querySelectorAll('.chat-msg-avatar').forEach(function (a) { a.remove(); });
    scanAllMessages();
  }

  // 监听 cardDatabase 就绪（无关但保留）
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
