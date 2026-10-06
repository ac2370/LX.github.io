/**
 * 消息通知 & 横幅（独立模块）
 * - 从 window.chatNotifyState 读取开关状态
 * - 提供 window.chatNotify.show(title, content, avatarUrl) 供外部调用
 * - 站内横幅 / 系统通知双通道
 *
 * 本次改动：
 * - 横幅 30 秒节流（30 秒内只弹一条，其余静默）
 * - show() 支持传 avatarUrl（用于"后台联系人主动消息"时显示正确头像）
 */

(function () {
  'use strict';

  var bannerEl = null;
  var bannerTimer = null;
  var lastBannerAt = 0;              // 上次弹横幅时间戳
  var BANNER_THROTTLE_MS = 30000;    // 30 秒节流

  // ==================== 读取开关 ====================
  function getState() {
    return window.chatNotifyState || {
      bannerEnabled: true,
      showContent: true,
      permissionGranted: false
    };
  }

  // ==================== 创建横幅 ====================
  function ensureBanner() {
    if (bannerEl && document.body.contains(bannerEl)) return bannerEl;

    bannerEl = document.createElement('div');
    bannerEl.id = 'chat-notify-banner';
    bannerEl.className = 'chat-notify-banner';
    bannerEl.innerHTML = [
      '<img class="chat-notify-avatar" id="chatNotifyAvatar" src="" alt="对方">',
      '<div class="chat-notify-info">',
      '  <div class="chat-notify-name" id="chatNotifyName">Ta</div>',
      '  <div class="chat-notify-content" id="chatNotifyContent"></div>',
      '</div>'
    ].join('');
    document.body.appendChild(bannerEl);

    // 点击横幅 → 跳转到传讯页
    bannerEl.addEventListener('click', function () {
      hideBanner();
      if (typeof window.showPage === 'function') {
        var pageChat = document.getElementById('pageChat');
        if (pageChat) window.showPage(pageChat);
      }
    });

    return bannerEl;
  }

  // ==================== 显示横幅 ====================
  function showBanner(title, content, avatarUrl) {
    var state = getState();
    // 站内横幅开关关闭 → 不显示
    if (!state.bannerEnabled) return;

    // 如果在传讯页面内 → 不显示
    var pageChat = document.getElementById('pageChat');
    if (pageChat && pageChat.classList.contains('active')) return;

    // 30 秒节流：30 秒内只弹一条
    var now = Date.now();
    if (now - lastBannerAt < BANNER_THROTTLE_MS) {
      return;
    }
    lastBannerAt = now;

    var banner = ensureBanner();
    var avatar = document.getElementById('chatNotifyAvatar');
    var nameEl = document.getElementById('chatNotifyName');
    var contentEl = document.getElementById('chatNotifyContent');

    // 头像：优先用传入的（后台联系人主动消息），否则回退当前会话头像
    if (avatar) {
      if (avatarUrl) {
        avatar.src = avatarUrl;
      } else {
        var chatAvatar = document.getElementById('chatAvatar');
        avatar.src = (chatAvatar && chatAvatar.src) || 'https://picsum.photos/200/200?random=99';
      }
    }

    // 名字
    if (nameEl) nameEl.textContent = title || 'Ta';

    // 内容
    if (contentEl) {
      if (state.showContent) {
        contentEl.textContent = content || '收到一条新消息';
      } else {
        contentEl.textContent = '你收到了一条新消息';
      }
    }

    banner.classList.add('active');

    if (bannerTimer) clearTimeout(bannerTimer);
    bannerTimer = setTimeout(function () {
      hideBanner();
    }, 4000);
  }

  function hideBanner() {
    if (bannerEl) bannerEl.classList.remove('active');
    if (bannerTimer) {
      clearTimeout(bannerTimer);
      bannerTimer = null;
    }
  }

  // ==================== 显示系统通知 ====================
  function showSystemNotification(title, content, avatarUrl) {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    // iOS/Android 上，页面在前台时不用弹系统通知（页面本身就能看到）
    if (!document.hidden) return;

    var state = getState();
    if (!state.permissionGranted) return;

    var body = state.showContent ? (content || '收到一条新消息') : '你收到了一条新消息';

    try {
      var n = new Notification(title || 'Ta', {
        body: body,
        icon: avatarUrl || (function () {
          var a = document.getElementById('chatAvatar');
          return a && a.src ? a.src : undefined;
        })()
      });
      n.onclick = function () {
        window.focus();
        if (typeof window.showPage === 'function') {
          var pageChat = document.getElementById('pageChat');
          if (pageChat) window.showPage(pageChat);
        }
        n.close();
      };
      setTimeout(function () { n.close(); }, 5000);
    } catch (e) {
      console.warn('[通知] 系统通知发送失败:', e);
    }
  }

  // ==================== 对外接口 ====================
  window.chatNotify = {
    show: function (title, content, avatarUrl) {
      showBanner(title, content, avatarUrl);
      showSystemNotification(title, content, avatarUrl);
    },
    hideBanner: hideBanner
  };

  console.log('[通知模块] 已加载');

})();
