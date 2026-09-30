/**
 * 传讯页面交互逻辑
 * 依赖：无（纯 JavaScript）
 */

(function () {
  'use strict';

  // 获取 DOM 元素
  const chatMessages = document.getElementById('chatMessages');
  const chatInput = document.getElementById('chatInput');
  const sendBtn = document.getElementById('sendBtn');
  const sosBtn = document.getElementById('sosBtn');

  // ==================== 输入框监听：控制发送按钮可用状态 ====================
  function updateSendBtnState() {
    const hasText = chatInput.value.trim().length > 0;
    sendBtn.disabled = !hasText;
  }

  chatInput.addEventListener('input', updateSendBtnState);

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

    // 4. 模拟对方自动回复（可选，让对话更生动）
    simulateReply(text);
  }

  // 点击发送按钮
  sendBtn.addEventListener('click', sendMessage);

  // 回车发送（桌面端体验）
  chatInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // ==================== 滚动到底部 ====================
  function scrollToBottom() {
    // 使用 requestAnimationFrame 保证在 DOM 更新后滚动
    requestAnimationFrame(function () {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    });
  }

  // ==================== 模拟对方自动回复 ====================
  const autoReplies = [
    '嗯嗯，我在听～',
    '然后呢？',
    '哈哈，这个有意思',
    '我也这么觉得',
    '好呀，都听你的',
    '嗯…让我想想',
    '你说得对',
    '抱抱你 🤗',
    '今天也要开心哦',
    '我一直在的'
  ];

  function simulateReply(userText) {
    // 延迟 800ms ~ 1600ms 后回复
    const delay = 800 + Math.random() * 800;
    setTimeout(function () {
      // 根据用户消息内容，简单匹配一些回复
      let replyText = autoReplies[Math.floor(Math.random() * autoReplies.length)];

      if (userText.includes('你好') || userText.includes('hi') || userText.includes('嗨')) {
        replyText = '你好呀～很高兴见到你 😊';
      } else if (userText.includes('晚安')) {
        replyText = '晚安，做个好梦 🌙';
      } else if (userText.includes('喜欢') || userText.includes('爱')) {
        replyText = '我也喜欢你呀 ❤️';
      } else if (userText.includes('?' ) || userText.includes('？')) {
        replyText = '这个问题嘛…让我想想 🤔';
      }

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

  // ==================== 急救按钮点击 ====================
  sosBtn.addEventListener('click', function () {
    alert('急救功能已触发。\n请联系紧急联系人：110 / 120');
  });

  // ==================== 顶栏图标点击（简单反馈） ====================
  const actionIcons = document.querySelectorAll('.chat-action-icon');
  actionIcons.forEach(function (icon) {
    icon.addEventListener('click', function () {
      const title = icon.getAttribute('title') || '功能';
      // 这里可以扩展为打开对应功能页面
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

})();
