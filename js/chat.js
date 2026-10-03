/**
 * 传讯聊天逻辑
 * - 自动回复：从 publicGroups / privateGroups 抽取文字
 * - 公共字卡库：合并 window.publicCards 的勾选字卡
 * - 专属字卡库：当前联系人勾选的分组（window.contactCards）优先
 * - 颜文字：从 emojiGroups 抽取
 * - 表情包：从 stickerGroups 抽取
 * - 保持原有等待时间、连发、三点气泡、随机引用机制
 * - 每条消息 DOM 挂 dataset（sender/type/time/favorited）+ 渲染时间戳
 */

(function () {
  'use strict';

  // ==================== 同步通知状态（供 chatNotify 使用） ====================
  if (typeof localforage !== 'undefined') {
    Promise.all([
      localforage.getItem('chat_notify_banner_enabled'),
      localforage.getItem('chat_notify_show_content'),
      localforage.getItem('chat_notify_random_call'),
      localforage.getItem('chat_notify_permission_granted')
    ]).then(function (vals) {
      window.chatNotifyState = {
        bannerEnabled: vals[0] !== false,
        showContent: vals[1] !== false,
        randomCall: vals[2] === true,
        silentLoop: false,
        permissionGranted: vals[3] === true
      };
    }).catch(function () {
      window.chatNotifyState = {
        bannerEnabled: true,
        showContent: true,
        randomCall: false,
        silentLoop: false,
        permissionGranted: false
      };
    });
  } else {
    window.chatNotifyState = {
      bannerEnabled: true,
      showContent: true,
      randomCall: false,
      silentLoop: false,
      permissionGranted: false
    };
  }

  const chatMessages = document.getElementById('chatMessages');
  const chatInput = document.getElementById('chatInput');
  const sendBtn = document.getElementById('sendBtn');

  if (!chatMessages || !chatInput || !sendBtn) return;

  let lastUserMessage = '';

  // ==================== 时间戳显示开关 ====================
  function applyTimeDisplaySetting() {
    if (!chatMessages) return;
    var show = true;
    try {
      var v = localStorage.getItem('show_message_time');
      if (v === '0') show = false;
    } catch (e) {}
    chatMessages.classList.toggle('hide-message-time', !show);
  }
  applyTimeDisplaySetting();

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

  // ==================== 时间格式化 ====================
  function formatTime(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    var h = d.getHours();
    var m = d.getMinutes();
    var s = d.getSeconds();
    var ampm = h >= 12 ? 'PM' : 'AM';
    var h12 = h % 12;
    if (h12 === 0) h12 = 12;
    function pad(n) { return n < 10 ? '0' + n : '' + n; }
    return pad(h12) + ':' + pad(m) + ':' + pad(s) + ' ' + ampm;
  }

  // ==================== 给消息行挂 dataset + 时间戳 ====================
  function decorateMessageRow(row, sender, type, time) {
    if (!row) return;
    row.dataset.sender = sender;
    row.dataset.type = type;
    row.dataset.time = String(time || Date.now());
    if (!row.dataset.favorited) row.dataset.favorited = 'false';

    if (row.querySelector('.message-time')) return;

    var bubble = row.querySelector('.message-bubble');

    var body = document.createElement('div');
    body.className = 'message-body';

    if (bubble) {
      row.insertBefore(body, bubble);
      body.appendChild(bubble);
    } else {
      row.appendChild(body);
    }

    var timeEl = document.createElement('div');
    timeEl.className = 'message-time';
    timeEl.textContent = formatTime(Number(row.dataset.time));
    body.appendChild(timeEl);
  }

  // ==================== 从 localforage 读取用户勾选的分组 ====================
  var groupCache = {
    publicGroups: [],
    privateGroups: [],
    emojiGroups: [],
    stickerGroups: [],
    loaded: false
  };

  function loadGroupSelections(callback) {
    function assign(data) {
      groupCache.publicGroups = Array.isArray(data.publicGroups) ? data.publicGroups : [];
      groupCache.privateGroups = Array.isArray(data.privateGroups) ? data.privateGroups : [];
      groupCache.emojiGroups = Array.isArray(data.emojiGroups) ? data.emojiGroups : [];
      groupCache.stickerGroups = Array.isArray(data.stickerGroups) ? data.stickerGroups : [];
      groupCache.loaded = true;
      if (callback) callback();
    }

    if (typeof localforage === 'undefined') {
      try {
        assign({
          publicGroups: JSON.parse(localStorage.getItem('chat_public_groups') || '[]'),
          privateGroups: JSON.parse(localStorage.getItem('chat_private_groups') || '[]'),
          emojiGroups: JSON.parse(localStorage.getItem('chat_emoji_groups') || '[]'),
          stickerGroups: JSON.parse(localStorage.getItem('chat_sticker_groups') || '[]')
        });
      } catch (e) { assign({}); }
      return;
    }

    Promise.all([
      localforage.getItem('chat_public_groups'),
      localforage.getItem('chat_private_groups'),
      localforage.getItem('chat_emoji_groups'),
      localforage.getItem('chat_sticker_groups')
    ]).then(function (results) {
      assign({
        publicGroups: results[0],
        privateGroups: results[1],
        emojiGroups: results[2],
        stickerGroups: results[3]
      });
    }).catch(function () {
      assign({});
    });
  }

  loadGroupSelections();

  function getGroupSelections() {
    if (window.chatPublicGroups !== undefined || window.chatPrivateGroups !== undefined) {
      return {
        publicGroups: Array.isArray(window.chatPublicGroups) ? window.chatPublicGroups : [],
        privateGroups: Array.isArray(window.chatPrivateGroups) ? window.chatPrivateGroups : [],
        emojiGroups: Array.isArray(window.chatEmojiGroups) ? window.chatEmojiGroups : [],
        stickerGroups: Array.isArray(window.chatStickerGroups) ? window.chatStickerGroups : []
      };
    }
    return {
      publicGroups: groupCache.publicGroups,
      privateGroups: groupCache.privateGroups,
      emojiGroups: groupCache.emojiGroups,
      stickerGroups: groupCache.stickerGroups
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
    if (!arr || arr.length === 0) return null;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ==================== 从分组中抽取字卡 ====================
  function pickFromGroups(groupNames, category) {
    if (!groupNames || groupNames.length === 0) return null;
    if (typeof window.getCardsInGroup !== 'function') return null;

    var validGroups = groupNames.filter(function (g) {
      var cards = window.getCardsInGroup(g, category || 'reply');
      return Array.isArray(cards) && cards.length > 0;
    });

    if (validGroups.length === 0) return null;

    var selectedGroup = randomPick(validGroups);
    var cards = window.getCardsInGroup(selectedGroup, category || 'reply');
    if (!cards || cards.length === 0) return null;

    return randomPick(cards);
  }

  function getAllGroupsOfCategory(category) {
    if (typeof window.getGroups !== 'function') return [];
    return window.getGroups(category || 'reply');
  }

  // ==================== 读「回复」分类下所有字卡（兜底用） ====================
  function getAllReplyCards() {
    var all = [];
    var groups = getAllGroupsOfCategory('reply');
    groups.forEach(function (g) {
      var cards = window.getCardsInGroup ? window.getCardsInGroup(g, 'reply') : [];
      if (Array.isArray(cards)) all = all.concat(cards);
    });
    if (all.length === 0 && typeof window.getReplyCards === 'function') {
      var alt = window.getReplyCards();
      if (Array.isArray(alt)) all = alt;
    }
    return all;
  }

  // ==================== 读公共字卡库（勾选的内置字卡） ====================
  function getPublicReplyCards() {
    if (!window.publicCards) return [];
    if (typeof window.publicCards.isReady === 'function' && !window.publicCards.isReady()) return [];
    if (typeof window.publicCards.getSelectedCards !== 'function') return [];
    try {
      var arr = window.publicCards.getSelectedCards('reply');
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      console.warn('[chat] 读取公共字卡库失败', e);
      return [];
    }
  }

   // ==================== 读专属字卡（当前联系人勾选的分组） ====================
  function getExclusiveReplyCards() {
    try {
      if (!window.contactCards) return [];
      var contactId = null;
      try { contactId = localStorage.getItem('my_current_contact'); } catch (e) {}
      if (!contactId) return [];

      var groups = [];
      if (typeof window.contactCards.getForReply === 'function') {
        groups = window.contactCards.getForReply(contactId) || [];
      } else if (typeof window.contactCards.getFor === 'function') {
        var entry = window.contactCards.getFor(contactId);
        if (Array.isArray(entry)) groups = entry;
        else if (entry && Array.isArray(entry.reply)) groups = entry.reply;
      }
      if (!Array.isArray(groups) || groups.length === 0) return [];
      if (typeof window.getCardsInGroup !== 'function') return [];

      var pool = [];
      groups.forEach(function (g) {
        try {
          var cards = window.getCardsInGroup(g, 'reply');
          if (Array.isArray(cards) && cards.length > 0) {
            pool = pool.concat(cards);
          }
        } catch (e) {
          console.warn('[chat] 读取专属字卡分组失败:', g, e);
        }
      });
      return pool;
    } catch (e) {
      console.warn('[chat] 读取专属字卡失败', e);
      return [];
    }
  }

  // ==================== 抽取一条文字回复 ====================
  function pickOneTextReply() {
    var selections = getGroupSelections();
    var publicGroups = selections.publicGroups;
    var privateGroups = selections.privateGroups;

    function filterValid(groups) {
      if (!groups || groups.length === 0) return [];
      if (typeof window.getCardsInGroup !== 'function') return [];
      return groups.filter(function (g) {
        var cards = window.getCardsInGroup(g, 'reply');
        return Array.isArray(cards) && cards.length > 0;
      });
    }

    // ---------- 0) 专属字卡（当前联系人）优先 ----------
    var exclusive = getExclusiveReplyCards();
    if (exclusive.length > 0) {
      return { text: randomPick(exclusive), source: 'exclusive' };
    }

    var validPublic = filterValid(publicGroups);
    var validPrivate = filterValid(privateGroups);

    // 用户自己勾选的分组都没内容时，优先从公共字卡库抽
    if (validPublic.length === 0 && validPrivate.length === 0) {
      // 1) 公共字卡库（勾选的内置字卡）
      var publicCards = getPublicReplyCards();
      if (publicCards.length > 0) {
        return { text: randomPick(publicCards), source: 'publicCards' };
      }

      // 2) 兜底：用户所有分组
      var allGroups = getAllGroupsOfCategory('reply');
      var fallback = pickFromGroups(allGroups, 'reply');
      if (fallback) return { text: fallback, source: 'fallback' };

      return null;
    }

    // 以下保持原有逻辑
    if (validPublic.length === 0) {
      var privateText = pickFromGroups(validPrivate, 'reply');
      if (privateText) return { text: privateText, source: 'private' };
      // 用户私聊组没内容，试试公共字卡库
      var pub1 = getPublicReplyCards();
      if (pub1.length > 0) return { text: randomPick(pub1), source: 'publicCards' };
      return null;
    }

    if (validPrivate.length === 0) {
      var publicText = pickFromGroups(validPublic, 'reply');
      if (publicText) return { text: publicText, source: 'public' };
      var pub2 = getPublicReplyCards();
      if (pub2.length > 0) return { text: randomPick(pub2), source: 'publicCards' };
      return null;
    }

    if (Math.random() < 0.5) {
      var pt = pickFromGroups(validPublic, 'reply');
      if (pt) return { text: pt, source: 'public' };
      var pt2 = pickFromGroups(validPrivate, 'reply');
      if (pt2) return { text: pt2, source: 'private' };
      var pub3 = getPublicReplyCards();
      if (pub3.length > 0) return { text: randomPick(pub3), source: 'publicCards' };
    } else {
      var pv = pickFromGroups(validPrivate, 'reply');
      if (pv) return { text: pv, source: 'private' };
      var pv2 = pickFromGroups(validPublic, 'reply');
      if (pv2) return { text: pv2, source: 'public' };
      var pub4 = getPublicReplyCards();
      if (pub4.length > 0) return { text: randomPick(pub4), source: 'publicCards' };
    }

    return null;
  }

  // ==================== 抽取颜文字 ====================
  function pickOneEmoji() {
    var selections = getGroupSelections();
    var emojiGroups = selections.emojiGroups;

    if (!emojiGroups || emojiGroups.length === 0) return null;

    return pickFromGroups(emojiGroups, 'kaomoji');
  }

  // ==================== 抽取表情包 ====================
  function pickOneSticker() {
    var selections = getGroupSelections();
    var stickerGroups = selections.stickerGroups;

    if (!stickerGroups || stickerGroups.length === 0) return null;

    var stickerArr = (window.cardDatabase && window.cardDatabase.get)
      ? (window.cardDatabase.get('sticker') || [])
      : [];
    if (stickerArr.length === 0) return null;
    return randomPick(stickerArr);
  }

    // ==================== 从 DOM 取最近 N 条我方消息文本 ====================
  function getRecentSelfMessages(limit) {
    var rows = chatMessages.querySelectorAll('.message-row.self');
    var arr = [];
    // 从后往前取，最多 limit 条
    for (var i = rows.length - 1; i >= 0 && arr.length < (limit || 8); i--) {
      var row = rows[i];
      var bubble = row.querySelector('.message-bubble');
      if (!bubble) continue;
      var img = bubble.querySelector('img');
      if (img && !bubble.textContent.trim()) continue; // 跳过纯图片
      var text = bubble.textContent.trim();
      if (text) arr.push(text);
    }
    return arr;
  }

  // ==================== 随机给我之前的消息贴表情反应 ====================
  var REACTION_EMOJIS = ['❤️', '👍', '😂', '😍', '🤔', '😮', '🥰', '😢', '🔥', '👀'];

  function tryAddReaction() {
    // 概率：30%
    if (Math.random() > 0.3) return;

    // 找最近 8 条我方消息（排除已有反应的）
    var rows = chatMessages.querySelectorAll('.message-row.self');
    var candidates = [];
    for (var i = rows.length - 1; i >= 0 && candidates.length < 8; i--) {
      var row = rows[i];
      if (row.dataset.reaction) continue;      // 已有反应跳过
      if (!row.querySelector('.message-bubble')) continue;
      candidates.push(row);
    }
    if (candidates.length === 0) return;

    var targetRow = randomPick(candidates);
    var emoji = randomPick(REACTION_EMOJIS);
    if (!targetRow || !emoji) return;

    // 标记到 dataset，防止重复贴
    targetRow.dataset.reaction = emoji;

    // 渲染反应气泡（挂到 message-body 上，跟时间戳同级）
    var body = targetRow.querySelector('.message-body');
    if (!body) return;

    // 如果已经有 reaction 容器就不重复创建
    var reactionEl = body.querySelector('.message-reaction');
    if (!reactionEl) {
      reactionEl = document.createElement('div');
      reactionEl.className = 'message-reaction';
      body.appendChild(reactionEl);
    }
    reactionEl.textContent = emoji;
    reactionEl.classList.add('pop'); // 用于 CSS 动画
    setTimeout(function () { reactionEl.classList.remove('pop'); }, 400);
  }
  
  // ==================== 创建消息行 ====================
  function createMessageRow(type, content) {
    const row = document.createElement('div');
    row.className = 'message-row ' + type;

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';

    var contentType = 'text';

    if (typeof content === 'string') {
      bubble.textContent = content;
    } else if (content && content.type === 'image') {
      contentType = 'image';
      const img = document.createElement('img');
      img.src = content.url;
      img.alt = '表情包';
      img.style.maxWidth = '160px';
      img.style.maxHeight = '160px';
      img.style.borderRadius = '12px';
      img.style.display = 'block';
      img.style.cursor = 'pointer';
      img.onclick = function () { window.open(content.url, '_blank'); };
      bubble.appendChild(img);
    } else if (content && content.quote) {
      const quoteEl = document.createElement('span');
      quoteEl.className = 'quote-block';
      quoteEl.textContent = '> ' + content.quote;
      bubble.appendChild(quoteEl);
      bubble.appendChild(document.createTextNode(content.text));
    }

    row.appendChild(bubble);

    var sender = (type === 'self') ? 'me' : 'partner';
    decorateMessageRow(row, sender, contentType, Date.now());

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

    // 如果有引用，组装成带引用的内容
    var content;
    if (currentQuote && currentQuote.text) {
      content = { quote: currentQuote.text, text: text };
      // 发完清掉引用
      currentQuote = null;
      var bar = document.getElementById('quotePreviewBar');
      if (bar) bar.style.display = 'none';
    } else {
      content = text;
    }

    chatMessages.appendChild(createMessageRow('self', content));
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

    if (!settings.normalReply) {
      console.log('[传讯] 正常字卡回复已关闭');
      return;
    }

    // 检查是否有可用字卡（用户字卡 + 公共字卡 + 专属字卡）
    var allCards = getAllReplyCards();
    var publicCards = getPublicReplyCards();
    var exclusiveCards = getExclusiveReplyCards();

    if (
      (!allCards || allCards.length === 0) &&
      (!publicCards || publicCards.length === 0) &&
      (!exclusiveCards || exclusiveCards.length === 0)
    ) {
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

        const minCount = Math.max(0, settings.minCount || 0);
        const maxCount = Math.max(minCount, settings.maxCount || 3);
        let replyCount = randomInt(minCount, maxCount);
        if (replyCount === 0) replyCount = 1;

        var replies = [];

        // 1. 文字回复
        for (var i = 0; i < replyCount; i++) {
          var picked = pickOneTextReply();

          // 兜底：如果分组逻辑读不到，直接从用户字卡 + 公共字卡 + 专属字卡里随机
          if (!picked) {
            var fallbackPool = allCards.concat(publicCards, getExclusiveReplyCards());
            var fb = randomPick(fallbackPool);
            if (fb) picked = { text: fb, source: 'fallback' };
          }

          if (!picked) break;
          var content = picked.text;

          if (settings.kaomoji) {
            var emojiText = pickOneEmoji();
            if (emojiText) {
              content = content + ' ' + emojiText;
            }
          }

                   if (settings.quote) {
            var quotePool = getRecentSelfMessages(8); // 最近 8 条我方消息
            if (quotePool.length > 0 && Math.random() < 0.35) {
              var pickedQuote = randomPick(quotePool);
              content = { quote: pickedQuote, text: content };
            }
          }

          replies.push({ type: 'text', content: content });
        }

                // 1.5 随机贴表情反应
        if (settings.reaction) {
          tryAddReaction();
        }

        // 2. 图片回复
        if (Math.random() < 0.4) {
          var stickerUrl = pickOneSticker();
          if (stickerUrl) {
            replies.push({ type: 'image', url: stickerUrl });
          }
        }

        // 3. 兜底
        if (replies.length === 0) {
          var fallbackPool2 = allCards.concat(publicCards, getExclusiveReplyCards());
          var fb2 = randomPick(fallbackPool2);
          if (fb2) {
            replies.push({ type: 'text', content: fb2 });
          }
        }

        // 依次显示
        replies.forEach(function (item, index) {
          setTimeout(function () {
            var row;
            if (item.type === 'text') {
              row = createMessageRow('other', item.content);
            } else if (item.type === 'image') {
              row = createMessageRow('other', { type: 'image', url: item.url });
            }
            if (row) {
              chatMessages.appendChild(row);
              scrollToBottom();

              if (window.chatNotify && typeof window.chatNotify.show === 'function') {
                var notifyContent;
                if (item.type === 'text') {
                  var c = item.content;
                  notifyContent = typeof c === 'string'
                    ? c
                    : (c && c.text ? c.text : '收到一条新消息');
                } else if (item.type === 'image') {
                  notifyContent = '[图片]';
                } else {
                  notifyContent = '收到一条新消息';
                }
                window.chatNotify.show('Ta', notifyContent);
              }
            }
          }, index * 500);
        });

      }, typingDuration);
    }, waitMs);
  }

  // ==================== 顶栏图标点击（占位） ====================
  document.querySelectorAll('.chat-action-icon').forEach(function (icon) {
    icon.addEventListener('click', function () {
      if (icon.id === 'fishingIcon') return;
      console.log('点击了：' + (icon.getAttribute('title') || '功能'));
    });
  });

  // ==================== 左侧图标点击（占位） ====================
  document.querySelectorAll('.input-left-icons i').forEach(function (icon) {
    icon.addEventListener('click', function () {
      console.log('点击了：' + (icon.getAttribute('title') || '功能'));
    });
  });

  // ==================== 暴露给外部 ====================
  window.initChatPage = function () {
    scrollToBottom();
    if (window.cardDatabase && window.cardDatabase.reload) {
      window.cardDatabase.reload();
    }
    loadGroupSelections();
    applyTimeDisplaySetting();
  };

  window.triggerChatAutoReply = triggerAutoReply;

  window.addEventListener('chatAutoReply', function () {
    triggerAutoReply();
  });

  window.applyChatTimeDisplay = applyTimeDisplaySetting;

  // 兼容外部可能调用 window.getCards
  window.getCards = getAllReplyCards;

    // ==================== 消息操作菜单 ====================
  var currentMenu = null;       // 当前弹出的菜单 DOM
  var currentMenuRow = null;    // 当前操作的消息行

  // 引用状态：null 或 { text: '被引用的文字' }
  var currentQuote = null;

  function closeMsgMenu() {
    if (currentMenu && currentMenu.parentNode) {
      currentMenu.parentNode.removeChild(currentMenu);
    }
    currentMenu = null;
    currentMenuRow = null;
  }

  function getMessageText(row) {
    var bubble = row.querySelector('.message-bubble');
    if (!bubble) return '';
    // 排除图片
    var img = bubble.querySelector('img');
    if (img && !bubble.textContent.trim()) return '[图片]';
    return bubble.textContent.trim();
  }

  function openMsgMenu(row, x, y) {
    closeMsgMenu();
    currentMenuRow = row;

    var menu = document.createElement('div');
    menu.className = 'msg-action-menu';

    var isFav = row.dataset.favorited === 'true';

    menu.innerHTML =
      '<button class="msg-action-btn" data-act="quote" title="引用"><i class="fa-solid fa-reply"></i></button>' +
      '<button class="msg-action-btn' + (isFav ? ' active' : '') + '" data-act="fav" title="收藏">' +
        '<i class="fa-' + (isFav ? 'solid' : 'regular') + ' fa-star"></i>' +
      '</button>' +
      '<button class="msg-action-btn" data-act="withdraw" title="撤回"><i class="fa-solid fa-trash-can"></i></button>';

    document.body.appendChild(menu);
    currentMenu = menu;

    // 定位：浮在消息旁边
    var rect = menu.getBoundingClientRect();
    var mw = rect.width;
    var mh = rect.height;

    var left = x - mw / 2;
    var top = y - mh - 8;

    // 边界处理
    if (left < 8) left = 8;
    if (left + mw > window.innerWidth - 8) left = window.innerWidth - mw - 8;
    if (top < 8) {
      // 上方不够，放下面
      top = y + 8;
    }
    if (top + mh > window.innerHeight - 8) {
      top = window.innerHeight - mh - 8;
    }

    menu.style.left = left + 'px';
    menu.style.top = top + 'px';

    // 按钮事件
    menu.querySelectorAll('.msg-action-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var act = btn.getAttribute('data-act');
        if (act === 'quote') doQuote(row);
        else if (act === 'fav') doFav(row, btn);
        else if (act === 'withdraw') doWithdraw(row);
        // 引用和撤回后关闭菜单；收藏不关闭，让用户看到变化
        if (act !== 'fav') closeMsgMenu();
      });
    });
  }

  // ---------- 引用 ----------
  function doQuote(row) {
    var text = getMessageText(row);
    if (!text) return;
    currentQuote = { text: text };

    var bar = document.getElementById('quotePreviewBar');
    var textEl = document.getElementById('quotePreviewText');
    if (bar && textEl) {
      textEl.textContent = text;
      bar.style.display = 'block';
    }
    // 聚焦输入框
    chatInput.focus();
  }

  // ---------- 收藏 ----------
  function doFav(row, btn) {
    var isFav = row.dataset.favorited === 'true';
    var next = !isFav;
    row.dataset.favorited = next ? 'true' : 'false';

    // 更新按钮图标
    var icon = btn.querySelector('i');
    if (icon) {
      icon.className = 'fa-' + (next ? 'solid' : 'regular') + ' fa-star';
    }
    btn.classList.toggle('active', next);
  }

  // ---------- 撤回 ----------
  function doWithdraw(row) {
    if (!row.parentNode) return;
    // 直接从 DOM 移除
    row.parentNode.removeChild(row);
  }

  // ---------- 引用预览条关闭 ----------
  var quoteClose = document.getElementById('quotePreviewClose');
  if (quoteClose) {
    quoteClose.addEventListener('click', function () {
      currentQuote = null;
      var bar = document.getElementById('quotePreviewBar');
      if (bar) bar.style.display = 'none';
    });
  }

  // ---------- 消息点击 → 弹菜单 ----------
  chatMessages.addEventListener('click', function (e) {
    // 点在菜单上，不处理
    if (e.target.closest('.msg-action-menu')) return;
    // 点在引用预览条或输入栏，不处理
    if (e.target.closest('.quote-preview-bar')) return;
    if (e.target.closest('.chat-input-bar')) return;
    // 点在 typing 气泡上，不处理
    if (e.target.closest('#typingRow')) return;

    var row = e.target.closest('.message-row');
    if (!row) {
      // 点空白处，关闭菜单
      closeMsgMenu();
      return;
    }

    // 点消息，弹菜单
    e.stopPropagation();
    openMsgMenu(row, e.clientX, e.clientY);
  }, true);

  // ---------- 点其他地方关闭菜单 ----------
  document.addEventListener('click', function (e) {
    if (!currentMenu) return;
    if (e.target.closest('.msg-action-menu')) return;
    if (currentMenuRow && currentMenuRow.contains(e.target)) return;
    closeMsgMenu();
  });

  // ---------- 滚动 / 改变窗口时关闭菜单 ----------
  chatMessages.addEventListener('scroll', closeMsgMenu, true);
  window.addEventListener('resize', closeMsgMenu);

  updateSendBtnState();
  scrollToBottom();

})();
