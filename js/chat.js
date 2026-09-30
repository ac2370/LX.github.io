/**
 * 传讯页面聊天逻辑
 * - 从 window.replyCards 中随机抽取字卡作为回复
 * - 遵循 window.replySettings 中的等待时间、回复条数、引用、颜文字等设置
 * - 支持“三点输入气泡”动画
 */

(function () {
  'use strict';

  // ==================== DOM ====================
  const chatMessages = document.getElementById('chatMessages');
  const chatInput = document.getElementById('chatInput');
  const sendBtn = document.getElementById('sendBtn');
  const sosBtn = document.getElementById('sosBtn');

  if (!chatMessages || !chatInput || !sendBtn) return;

  // 防止重复初始化
  if (window._chatInitialized) return;
  window._chatInitialized = true;

  // ==================== 工具 ====================
  function scrollToBottom() {
    requestAnimationFrame(function () {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    });
  }

  function getSettings() {
    return window.replySettings || {
      normalReply: true,
      minWait: 3,
      maxWait: 12,
      minCount: 0,
      maxCount: 3,
      kaomoji: false,
      typingBubble: true,
      quote: false
    };
  }

  function getCards() {
    return (window.replyCards && window.replyCards.length > 0)
      ? window.replyCards
      : ['今天天气很好', '在想你'];
  }

  // 随机整数
  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // 随机抽取不重复的 N 条
  function pickRandom(arr, n) {
    const copy = arr.slice();
    const result = [];
    n = Math.min(n, copy.length);
    for (let i = 0; i < n; i++) {
      const idx = Math.floor(Math.random() * copy.length);
      result.push(copy.splice(idx, 1)[0]);
    }
    return result;
  }

  // 颜文字库
  const KAOMOJI = ['(｡･ω･｡)', '(◍•ᴗ•◍)', '(￣▽￣)', '(´▽`ʃ♡ƪ)', '(๑•̀ㅂ•́)و✧', '(=^･ω･^=)'];

  // ==================== 消息渲染 ====================
  function addSelfMessage(text) {
    const row = document.createElement('div');
    row.className = 'message-row self';
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.textContent = text;
    row.appendChild(bubble);
    chatMessages.appendChild(row);
    scrollToBottom();
  }

  function addOtherMessage(text, quoteText) {
    const row = document.createElement('div');
    row.className = 'message-row other';
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';

    if (quoteText) {
      const quoteEl = document.createElement('span');
      quoteEl.className = 'message-quote';
      quoteEl.textContent = '> ' + quoteText;
      bubble.appendChild(quoteEl);
    }

    const textNode = document.createElement('span');
    textNode.textContent = text;
    bubble.appendChild(textNode);

    row.appendChild(bubble);
    chatMessages.appendChild(row);
    scrollToBottom();
  }

  function showTypingBubble() {
    const row = document.createElement('div');
    row.className = 'message-row other';
    row.id = 'typingBubbleRow';
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble typing-bubble';
    bubble.innerHTML = '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>';
    row.appendChild(bubble);
    chatMessages.appendChild(row);
    scrollToBottom();
  }

  function removeTypingBubble() {
    const el = document.getElementById('typingBubbleRow');
    if (el) el.remove();
  }

  // ==================== 回复逻辑 ====================
  let replyTimer = null;
  let lastUserMessage = '';

  function handleUserSend(text) {
    lastUserMessage = text;
    addSelfMessage(text);

    // 清空输入
    chatInput.value = '';
    updateSendBtnState();

    // 取消上一次未完成的回复
    if (replyTimer) {
      clearTimeout(replyTimer);
      replyTimer = null;
    }
    removeTypingBubble();

    const settings = getSettings();

    // 若关闭正常字卡回复，则不回复
    if (!settings.normalReply) {
      console.log('[传讯] 正常字卡回复已关闭，不回复');
      return;
    }

    // 计算等待时间
    let minWait = Number(settings.minWait) || 3;
    let maxWait = Number(settings.maxWait) || 12;
    if (minWait > maxWait) { const t = minWait; minWait = maxWait; maxWait = t; }
    const waitMs = randInt(minWait * 1000, maxWait * 1000);

    // 回复条数
    let minCount = Number(settings.minCount) || 0;
    let maxCount = Number(settings.maxCount) || 3;
    if (minCount > maxCount) { const t = minCount; minCount = maxCount; maxCount = t; }
    let count = randInt(minCount, maxCount);
    if (count < 1 && maxCount >= 1) count = 1; // 至少回复一条，避免无反馈

    // 第一步：等待后显示输入气泡
    replyTimer = setTimeout(function () {
      // 是否显示输入气泡
      if (settings.typingBubble) {
        showTypingBubble();
      }

      // 三点气泡显示 1-2 秒后，再输出实际内容
      const typingDelay = randInt(1000, 2000);
      replyTimer = setTimeout(function () {
        removeTypingBubble();

        // 抽取字卡
        const cards = getCards();
        const picked = pickRandom(cards, count);

        // 逐条输出（每条间隔 300-600ms）
        let i = 0;
        function outputNext() {
          if (i >= picked.length) {
            replyTimer = null;
            return;
          }
          let text = picked[i];

          // 随机附加颜文字
          if (settings.kaomoji && Math.random() < 0.5) {
            const km = KAOMOJI[Math.floor(Math.random() * KAOMOJI.length)];
            text += ' ' + km;
          }

          // 随机引用
          let quoteText = null;
          if (settings.quote && lastUserMessage && Math.random() < 0.4) {
            // 截取前 20 字
            quoteText = lastUserMessage.length > 20
              ? lastUserMessage.slice(0, 20) + '...'
              : lastUserMessage;
          }

          addOtherMessage(text, quoteText);

          i++;
          if (i < picked.length) {
            replyTimer = setTimeout(outputNext, randInt(300, 600));
          } else {
            replyTimer = null;
          }
        }
        outputNext();
      }, typingDelay);
    }, waitMs);
  }

  // ==================== 输入框 ====================
  function updateSendBtnState() {
    sendBtn.disabled = chatInput.value.trim().length === 0;
  }
  chatInput.addEventListener('input', updateSendBtnState);
  chatInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const text = chatInput.value.trim();
      if (text) handleUserSend(text);
    }
  });
  sendBtn.addEventListener('click', function () {
    const text = chatInput.value.trim();
    if (text) handleUserSend(text);
  });

  // ==================== 急救 ====================
  if (sosBtn) {
    sosBtn.addEventListener('click', function () {
      alert('急救功能已触发。\n请联系紧急联系人：110 / 120');
    });
  }

  // ==================== 顶栏图标 ====================
  document.querySelectorAll('.chat-action-icon').forEach(function (icon) {
    icon.addEventListener('click', function () {
      console.log('点击了：' + (icon.getAttribute('title') || '功能'));
    });
  });
  document.querySelectorAll('.input-left-icons i').forEach(function (icon) {
    icon.addEventListener('click', function () {
      console.log('点击了：' + (icon.getAttribute('title') || '功能'));
    });
  });

  // ==================== 初始化 ====================
  updateSendBtnState();
  scrollToBottom();

})();
