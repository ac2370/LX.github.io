/**
 * 传讯聊天逻辑（第 3 步修改版）
 * - 自动回复只从 cardDatabase.reply / emoji 抽取文字
 * - 图片只从 cardDatabase.sticker 抽取
 * - 严格遵守分类隔离：不从地点/心情/状态抽取
 */

(function () {
  'use strict';

  const chatMessages = document.getElementById('chatMessages');
  const chatInput = document.getElementById('chatInput');
  const sendBtn = document.getElementById('sendBtn');

  if (!chatMessages || !chatInput || !sendBtn) return;

  let lastUserMessage = '';

  // ==================== 输入框监听 ====================
  function updateSendBtnState() {
    sendBtn.disabled = chatInput.value.trim().length === 0;
  }
  chatInput.addEventListener('input', updateSendBtnState);

  // ==================== 滚动到底部 ====================
  function scrollToBottom() {
    requestAnimationFrame(function () {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    });
  }

  // ==================== 从 cardDatabase 获取数据 ====================
  function getDB() {
    if (!window.cardDatabase) {
      return { reply: [], emoji: [], sticker: [] };
    }
    return {
      reply: window.cardDatabase.reply || [],
      emoji: window.cardDatabase.emoji || [],
      sticker: window.cardDatabase.sticker || []
    };
  }

  // ==================== 获取回复设定 ====================
  function getSettings() {
    if (typeof window.getReplySettings === 'function') return window.getReplySettings();
    return {
      normalReply: true,
      kaomoji: false,
      typingBubble: true,
      quote: true,
      minWait: 3,
      maxWait: 12,
      minCount: 0,
      maxCount: 3
    };
  }

  // ==================== 随机工具 ====================
  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  function randomPick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ==================== 颜文字库（备用，当 emoji 分类为空时使用） ====================
  const KAOMOJI_FALLBACK = ['(๑•̀ㅂ•́)و✧', '(｡･ω･｡)', '(´• ω •`)', '(*/ω＼*)', '(๑´ㅂ`๑)', 'ฅ^•ﻌ•^ฅ'];

  // ==================== 创建消息行 ====================
  function createMessageRow(type, content) {
    const row = document.createElement('div');
    row.className = 'message-row ' + type;

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';

    if (typeof content === 'string') {
      bubble.textContent = content;
    } else if (content && content.type === 'image') {
      // 图片气泡
      const img = document.createElement('img');
      img.src = content.url;
      img.alt = '表情包';
      img.style.maxWidth = '160px';
      img.style.maxHeight = '160px';
      img.style.borderRadius = '12px';
      img.style.display = 'block';
      bubble.appendChild(img);
    } else if (content && content.quote) {
      // 带引用的文字
      const quoteEl = document.createElement('span');
      quoteEl.className = 'quote-block';
      quoteEl.textContent = '> ' + content.quote;
      bubble.appendChild(quoteEl);
      bubble.appendChild(document.createTextNode(content.text));
    }

    row.appendChild(bubble);
    return row;
  }

  // ==================== 创建三点输入气泡 ====================
  function createTypingRow() {
    const row = document.createElement('div');
    row.className = 'message-row other';
    row.id = 'typingRow';

    const bubble = document.createElement('div');
    bubble.className = 'typing-bubble';
    bubble.innerHTML = '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>';

    row.appendChild(bubble);
    return row;
  }

  // ==================== 发送消息 ====================
  function sendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;

    chatMessages.appendChild(createMessageRow('self', text));
    lastUserMessage = text;

    chatInput.value = '';
    updateSendBtnState();
    scrollToBottom();

    triggerAutoReply();
  }

  sendBtn.addEventListener('click', sendMessage);
  chatInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // ==================== 自动回复核心逻辑 ====================
  function triggerAutoReply() {
    const settings = getSettings();
    const db = getDB();

    // 严格限定：只从 reply 和 emoji 抽文字
    const textPool = [].concat(db.reply, db.emoji);
    const imagePool = db.sticker || [];

    if (!settings.normalReply) {
      console.log('[传讯] 正常字卡回复已关闭');
      return;
    }

    // 如果文字池为空，且图片池也为空，则提示
    if (textPool.length === 0 && imagePool.length === 0) {
      setTimeout(function () {
        const row = createMessageRow('other', '字卡库还没有内容哦，先去添加字卡吧~');
        chatMessages.appendChild(row);
        scrollToBottom();
      }, 800);
      return;
    }

    const minWait = Math.max(1, settings.minWait || 3);
    const maxWait = Math.max(minWait, settings.maxWait || 12);
    const waitMs = randomInt(minWait, maxWait) * 1000;

    console.log('[传讯] 将在 ' + (waitMs / 1000).toFixed(1) + ' 秒后回复');

    const showTyping = settings.typingBubble !== false;

    setTimeout(function () {
      let typingRow = null;
      if (showTyping) {
        typingRow = createTypingRow();
        chatMessages.appendChild(typingRow);
        scrollToBottom();
      }

      const typingDuration = showTyping ? randomInt(1000, 2000) : 0;

      setTimeout(function () {
        if (typingRow && typingRow.parentNode) {
          typingRow.parentNode.removeChild(typingRow);
        }

        // 决定回复条数
        const minCount = Math.max(0, settings.minCount || 0);
        const maxCount = Math.max(minCount, settings.maxCount || 3);
        let replyCount = randomInt(minCount, maxCount);
        if (replyCount === 0) replyCount = 1;

        // 构建回复内容列表
        const replies = [];

        // 文字回复（从 reply + emoji 抽取）
        if (textPool.length > 0) {
          const shuffledText = textPool.slice().sort(function () { return Math.random() - 0.5; });
          for (let i = 0; i < replyCount; i++) {
            if (i >= shuffledText.length) break;
            let content = shuffledText[i];

            // 如果开启颜文字随机附加，且 emoji 分类有内容，则从 emoji 中抽一个附加
            if (settings.kaomoji && db.emoji.length > 0 && Math.random() < 0.5) {
              content = content + ' ' + randomPick(db.emoji);
            }

            // 随机引用上一条用户消息
            if (settings.quote && lastUserMessage && Math.random() < 0.35) {
              content = { quote: lastUserMessage, text: content };
            }

            replies.push({ type: 'text', content: content });
          }
        }

        // 图片回复（从 sticker 抽取）
        if (imagePool.length > 0 && Math.random() < 0.4) {
          const imgUrl = randomPick(imagePool);
          replies.push({ type: 'image', url: imgUrl });
        }

        // 如果一条都没有，兜底
        if (replies.length === 0) {
          if (textPool.length > 0) {
            replies.push({ type: 'text', content: randomPick(textPool) });
          } else if (imagePool.length > 0) {
            replies.push({ type: 'image', url: randomPick(imagePool) });
          }
        }

        // 依次显示回复
        replies.forEach(function (item, index) {
          setTimeout(function () {
            let row;
            if (item.type === 'text') {
              row = createMessageRow('other', item.content);
            } else if (item.type === 'image') {
              row = createMessageRow('other', { type: 'image', url: item.url });
            }
            if (row) {
              chatMessages.appendChild(row);
              scrollToBottom();
            }
          }, index * 500);
        });

      }, typingDuration);
    }, waitMs);
  }

  // ==================== 顶栏图标点击 ====================
  document.querySelectorAll('.chat-action-icon').forEach(function (icon) {
    icon.addEventListener('click', function () {
      if (icon.id === 'fishingIcon') return;
      console.log('点击了：' + (icon.getAttribute('title') || '功能'));
    });
  });

  // ==================== 左侧图标点击 ====================
  document.querySelectorAll('.input-left-icons i').forEach(function (icon) {
    icon.addEventListener('click', function () {
      console.log('点击了：' + (icon.getAttribute('title') || '功能'));
    });
  });

    // ==================== 暴露给外部 ====================
  window.initChatPage = function () {
    scrollToBottom();
  };

  // 暴露自动回复接口，供 chat-extras.js 调用
  window.triggerChatAutoReply = triggerAutoReply;

  // 监听自定义事件（兜底）
  window.addEventListener('chatAutoReply', function () {
    triggerAutoReply();
  });

  updateSendBtnState();
  scrollToBottom();

})();
