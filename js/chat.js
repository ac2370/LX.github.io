/**
 * 传讯页面交互逻辑
 * 从 localStorage 的 my_word_cards 中随机读取字卡作为回复
 */

(function () {
  'use strict';

  // 获取 DOM 元素
  const chatMessages = document.getElementById('chatMessages');
  const chatInput = document.getElementById('chatInput');
  const sendBtn = document.getElementById('sendBtn');
  const sosBtn = document.getElementById('sosBtn');

  if (!chatMessages || !chatInput || !sendBtn) return;

  // ==================== 输入框监听 ====================
  function updateSendBtnState() {
    const hasText = chatInput.value.trim().length > 0;
    sendBtn.disabled = !hasText;
  }

  chatInput.addEventListener('input', updateSendBtnState);

  // ==================== 从字卡库随机获取回复 ====================
  function getRandomWordCardReply() {
    try {
      const raw = localStorage.getItem('my_word_cards');
      if (!raw) return '字卡库还没有内容哦，先去添加字卡吧~';
      const cards = JSON.parse(raw);
      if (!Array.isArray(cards) || cards.length === 0) {
        return '字卡库还没有内容哦，先去添加字卡吧~';
      }
      // 随机抽取一条
      const randomIndex = Math.floor(Math.random() * cards.length);
      const card = cards[randomIndex];
      // 兼容字符串和对象两种存储格式
      if (typeof card === 'string') return card;
      if (card && typeof card === 'object' && card.text) return card.text;
      return '字卡库还没有内容哦，先去添加字卡吧~';
    } catch (e) {
      return '字卡库还没有内容哦，先去添加字卡吧~';
    }
  }

  // ==================== 发送消息 ====================
  function sendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;

    // 1. 创建自己的消息气泡
    const row = document.createElement('div');
    row.className = 'message-row self';

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.textContent = text;

    row.appendChild(bubble);
    chatMessages.appendChild(row);

    // 2. 清空输入框
    chatInput.value = '';
    updateSendBtnState();

    // 3. 滚动到底部
    scrollToBottom();

    // 4. 从字卡库随机回复
    simulateReply();
  }

  sendBtn.addEventListener('click', sendMessage);

  chatInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // ==================== 滚动到底部 ====================
  function scrollToBottom() {
    requestAnimationFrame(function () {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    });
  }

  // ==================== 模拟对方回复 ====================
  function simulateReply() {
    // 延迟 600ms ~ 1200ms 后回复，模拟真实感
    const delay = 600 + Math.random() * 600;
    setTimeout(function () {
      const replyText = getRandomWordCardReply();

      const row = document.createElement('div');
      row.className = 'message-row other';

      const bubble = document.createElement('div');
      bubble.className = 'message-bubble';
      bubble.textContent = replyText;

      row.appendChild(bubble);
      chatMessages.appendChild(row);

      scrollToBottom();
    }, delay);
  }

  // ==================== 急救按钮 ====================
  if (sosBtn) {
    sosBtn.addEventListener('click', function () {
      alert('急救功能已触发。\n请联系紧急联系人：110 / 120');
    });
  }

  // ==================== 顶栏图标点击（简单反馈） ====================
  const actionIcons = document.querySelectorAll('.chat-action-icon');
  actionIcons.forEach(function (icon) {
    icon.addEventListener('click', function () {
      const title = icon.getAttribute('title') || '功能';
      console.log('点击了：' + title);
    });
  });

  // ==================== 左侧图标点击（简单反馈） ====================
  const leftIcons = document.querySelectorAll('.input-left-icons i');
  leftIcons.forEach(function (icon) {
    icon.addEventListener('click', function () {
      const title = icon.getAttribute('title') || '功能';
      console.log('点击了：' + title);
    });
  });

  // ==================== 初始化 ====================
  updateSendBtnState();
  scrollToBottom();

  // 暴露给外部调用（切换到传讯页时刷新）
  window.initChatPage = function () {
    scrollToBottom();
    // 更新底部导航角标
    updateNavBadge();
  };

  // ==================== 更新导航角标 ====================
  function updateNavBadge() {
    try {
      const raw = localStorage.getItem('my_word_cards');
      const cards = raw ? JSON.parse(raw) : [];
      const count = Array.isArray(cards) ? cards.length : 0;
      const badge = document.getElementById('navMsgBadge');
      if (badge) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.style.display = count > 0 ? 'flex' : 'none';
      }
    } catch (e) {
      // ignore
    }
  }

  // 监听 localStorage 变化（来自字卡页面的修改）
  window.addEventListener('storage', function (e) {
    if (e.key === 'my_word_cards') {
      updateNavBadge();
    }
  });

  // 页面显示时更新角标
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) {
      updateNavBadge();
    }
  });

  updateNavBadge();

})();
