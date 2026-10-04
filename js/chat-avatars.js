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
    if (!row) return;
    // 系统消息（通话记录）不加头像
    if (row.classList.contains('call-record')) return;
    if (row.querySelector('.chat-msg-avatar')) return;

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
      row.appendChild(avatar);
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

/* ============================================================
   角色面板 · 「我的角色」区块
   ============================================================ */
.rp-my-block {
  padding: 14px 16px;
  margin-bottom: 14px;
  background: #fdf5f5;
  border: 1px solid #f8d8d8;
  border-radius: 18px;
}

.rp-my-title {
  font-size: 13px;
  font-weight: 700;
  color: #e58b8b;
  margin-bottom: 10px;
  letter-spacing: 0.5px;
}

.rp-my-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.rp-my-avatar-wrap {
  position: relative;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  overflow: visible;
  cursor: pointer;
  flex-shrink: 0;
}

.rp-my-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid #fff;
  box-shadow: 0 2px 8px rgba(248, 180, 180, 0.35);
  display: block;
}

.rp-my-avatar-badge {
  position: absolute;
  right: -2px;
  bottom: -2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #f8b4b4;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  border: 2px solid #fff;
}

.rp-my-name {
  flex: 1;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid #f0d8d8;
  background: #fff;
  font-size: 14px;
  color: #333;
  outline: none;
  box-sizing: border-box;
}
.rp-my-name:focus {
  border-color: #f8b4b4;
  box-shadow: 0 0 0 3px rgba(248, 180, 180, 0.15);
}

.rp-my-save {
  width: 100%;
  padding: 11px 0;
  border-radius: 14px;
  border: none;
  background: #f8b4b4;
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s ease, transform 0.1s ease;
  box-shadow: 0 4px 12px rgba(248, 180, 180, 0.35);
}
.rp-my-save:active {
  opacity: 0.85;
  transform: scale(0.97);
}

body.theme-dark .rp-my-block {
  background: rgba(248, 180, 180, 0.08);
  border-color: rgba(248, 180, 180, 0.2);
}
body.theme-dark .rp-my-name {
  background: var(--theme-input-bg);
  border-color: var(--theme-input-border);
  color: var(--theme-text);
}
body.theme-dark .rp-my-avatar {
  border-color: rgba(38, 44, 52, 0.97);
}
body.theme-dark .rp-my-avatar-badge {
  border-color: rgba(38, 44, 52, 0.97);
}
