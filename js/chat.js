/**
 * 传讯聊天逻辑
 * - 自动回复：从 publicGroups / privateGroups 抽取文字
 * - 颜文字：从 emojiGroups 抽取
 * - 表情包：从 stickerGroups 抽取
 * - 保持原有等待时间、连发、三点气泡、随机引用机制
 * - 聊天礼物卡：side === 'self' 走方框卡片，其余走礼物卡
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

    var validPublic = filterValid(publicGroups);
    var validPrivate = filterValid(privateGroups);

    if (validPublic.length === 0 && validPrivate.length === 0) {
      var allGroups = getAllGroupsOfCategory('reply');
      var fallback = pickFromGroups(allGroups, 'reply');
      if (fallback) return { text: fallback, source: 'fallback' };
      return null;
    }

    if (validPublic.length === 0) {
      var privateText = pickFromGroups(validPrivate, 'reply');
      if (privateText) return { text: privateText, source: 'private' };
      return null;
    }

    if (validPrivate.length === 0) {
      var publicText = pickFromGroups(validPublic, 'reply');
      if (publicText) return { text: publicText, source: 'public' };
      return null;
    }

    if (Math.random() < 0.5) {
      var pt = pickFromGroups(validPublic, 'reply');
      if (pt) return { text: pt, source: 'public' };
      var pt2 = pickFromGroups(validPrivate, 'reply');
      if (pt2) return { text: pt2, source: 'private' };
    } else {
      var pv = pickFromGroups(validPrivate, 'reply');
      if (pv) return { text: pv, source: 'private' };
      var pv2 = pickFromGroups(validPublic, 'reply');
      if (pv2) return { text: pv2, source: 'public' };
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

  // ==================== 创建消息行 ====================
  function createMessageRow(type, content) {
    const row = document.createElement('div');
    row.className = 'message-row ' + type;

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';

    if (typeof content === 'string') {
      bubble.textContent = content;
    } else if (content && content.type === 'image') {
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

    if (!settings.normalReply) {
      console.log('[传讯] 正常字卡回复已关闭');
      return;
    }

    var selections = getGroupSelections();
    var hasAnyText = false;
    var allGroups = getAllGroupsOfCategory('reply');
    allGroups.forEach(function (g) {
      var cards = window.getCardsInGroup(g, 'reply');
      if (Array.isArray(cards) && cards.length > 0) hasAnyText = true;
    });

    if (!hasAnyText) {
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
          if (!picked) break;
          var content = picked.text;

          if (settings.kaomoji) {
            var emojiText = pickOneEmoji();
            if (emojiText) {
              content = content + ' ' + emojiText;
            }
          }

          if (settings.quote && lastUserMessage && Math.random() < 0.35) {
            content = { quote: lastUserMessage, text: content };
          }

          replies.push({ type: 'text', content: content });
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
          var fallbackText = pickFromGroups(getAllGroupsOfCategory('reply'), 'reply');
          if (fallbackText) {
            replies.push({ type: 'text', content: fallbackText });
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
  };

  window.triggerChatAutoReply = triggerAutoReply;

  window.addEventListener('chatAutoReply', function () {
    triggerAutoReply();
  });

  // ==================== 聊天礼物卡（供心意市集调用） ====================

  // 在聊天记录里插入一张礼物卡
  // record: { id, giftId, name, price, emoji, wish, side, claimed, tm }
  window.chatAddGift = function (record) {
    if (!record || !chatMessages) return;

    // ---- 分支 A：Ta 给自己买的（side === 'self'）→ 方框卡片，无领取按钮 ----
    if (record.side === 'self') {
      var selfRow = document.createElement('div');
      selfRow.className = 'message-row other';
      selfRow.setAttribute('data-gift-id', record.id);

      var box = document.createElement('div');
      box.className = 'chat-gift-box';

      var priceTextSelf = '¥' + ((record.price || 0) / 100);

      box.innerHTML =
        '<div class="chat-gift-box-head">' +
          '<span class="chat-gift-box-bar"></span>' +
          '<span class="chat-gift-box-title">Ta 给自己买了一件心意</span>' +
        '</div>' +
        '<div class="chat-gift-box-body">' +
          '<div class="chat-gift-box-emoji">' + (record.emoji || '🎁') + '</div>' +
          '<div class="chat-gift-box-info">' +
            '<div class="chat-gift-box-name">' + (record.name || '心意') + '</div>' +
            '<div class="chat-gift-box-price">' + priceTextSelf + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="chat-gift-box-foot">收进了 Ta 的心意柜</div>';

      selfRow.appendChild(box);
      chatMessages.appendChild(selfRow);
      chatMessages.scrollTop = chatMessages.scrollHeight;
      return;
    }

    // ---- 分支 B：其他礼物（我送的 / Ta 送我的）→ 原礼物卡，带领取按钮 ----
    var row = document.createElement('div');
    row.className = 'message-row ' + (record.side === 'in' ? 'other' : 'self');
    row.setAttribute('data-gift-id', record.id);

    var card = document.createElement('div');
    card.className = 'chat-gift-card';

    var priceText = '¥' + ((record.price || 0) / 100);

    card.innerHTML =
      '<div class="chat-gift-emoji">' + (record.emoji || '🎁') + '</div>' +
      '<div class="chat-gift-name">' + (record.name || '心意') + '</div>' +
      '<div class="chat-gift-price">' + priceText + '</div>' +
      (record.wish ? '<div class="chat-gift-wish">' + record.wish + '</div>' : '') +
      '<button class="chat-gift-btn' + (record.claimed ? ' claimed' : '') + '">' +
        (record.claimed ? '已领取' : '领取') +
      '</button>';

    var btn = card.querySelector('.chat-gift-btn');
    if (!record.claimed) {
      btn.addEventListener('click', function () {
        btn.disabled = true;
        btn.classList.add('claimed');
        btn.textContent = '已领取';
        if (window.market && typeof window.market.claimGift === 'function') {
          try { window.market.claimGift(record.id); } catch (e) {}
        }
      });
    } else {
      btn.disabled = true;
    }

    row.appendChild(card);
    chatMessages.appendChild(row);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  };

  // 追加一条普通文本消息（供 market 让 TA 回复用）
  window.chatAddTextMessage = function (type, text) {
    if (!chatMessages) return;
    var row = document.createElement('div');
    row.className = 'message-row ' + (type || 'other');
    var bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.textContent = text;
    row.appendChild(bubble);
    chatMessages.appendChild(row);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  };

  // 让 market 能够同步"礼物已领取"到聊天礼物卡
  window.chatMarkGiftClaimed = function (giftRecordId) {
    if (!chatMessages) return;
    var row = chatMessages.querySelector('[data-gift-id="' + giftRecordId + '"]');
    if (!row) return;
    var btn = row.querySelector('.chat-gift-btn');
    if (btn && !btn.classList.contains('claimed')) {
      btn.classList.add('claimed');
      btn.textContent = '已领取';
      btn.disabled = true;
    }
  };

  updateSendBtnState();
  scrollToBottom();

})();
