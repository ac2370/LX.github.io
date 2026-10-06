/**
 * 传讯聊天逻辑
 * - 自动回复：从 publicGroups / privateGroups 抽取文字
 * - 公共字卡库：合并 window.publicCards 的勾选字卡
 * - 专属字卡库：当前联系人勾选的分组（window.contactCards）优先
 * - 引用优化：从最近 8 条我方消息里随机引用
 * - 已读回执：发消息后 1.5~4s 标已读，气泡下方显示单勾
 * - 已读不回：开启后，20% 概率只已读不回复
 * - 问卷卡片：appendSurveyCardToChat / syncSurveyCard
 * - 每条消息 DOM 挂 dataset（sender/type/time/favorited/read）+ 渲染时间戳
 *
 * 调试开关：window.CHAT_DEBUG = true 可打印详细日志
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

  // ==================== 调试日志 ====================
  function dlog() {
    if (window.CHAT_DEBUG) {
      try { console.log.apply(console, arguments); } catch (e) {}
    }
  }

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

    // 时间戳：包一层 .message-time-text，回执可以插在 .message-time 里
    var timeEl = document.createElement('div');
    timeEl.className = 'message-time';

    var timeText = document.createElement('span');
    timeText.className = 'message-time-text';
    timeText.textContent = formatTime(Number(row.dataset.time));
    timeEl.appendChild(timeText);

    body.appendChild(timeEl);
  }

  // ==================== 从 localforage 读取用户勾选的分组 ====================
  // 注意：emojiGroups 已移除（颜文字功能下线）
  var groupCache = {
    publicGroups: [],
    privateGroups: [],
    stickerGroups: [],
    loaded: false
  };

  function loadGroupSelections(callback) {
    function assign(data) {
      groupCache.publicGroups = Array.isArray(data.publicGroups) ? data.publicGroups : [];
      groupCache.privateGroups = Array.isArray(data.privateGroups) ? data.privateGroups : [];
      groupCache.stickerGroups = Array.isArray(data.stickerGroups) ? data.stickerGroups : [];
      groupCache.loaded = true;
      if (callback) callback();
    }

    if (typeof localforage === 'undefined') {
      try {
        assign({
          publicGroups: JSON.parse(localStorage.getItem('chat_public_groups') || '[]'),
          privateGroups: JSON.parse(localStorage.getItem('chat_private_groups') || '[]'),
          stickerGroups: JSON.parse(localStorage.getItem('chat_sticker_groups') || '[]')
        });
      } catch (e) { assign({}); }
      return;
    }

    Promise.all([
      localforage.getItem('chat_public_groups'),
      localforage.getItem('chat_private_groups'),
      localforage.getItem('chat_sticker_groups')
    ]).then(function (results) {
      assign({
        publicGroups: results[0],
        privateGroups: results[1],
        stickerGroups: results[2]
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
        stickerGroups: Array.isArray(window.chatStickerGroups) ? window.chatStickerGroups : []
      };
    }
    return {
      publicGroups: groupCache.publicGroups,
      privateGroups: groupCache.privateGroups,
      stickerGroups: groupCache.stickerGroups
    };
  }

  // ==================== 获取回复设定 ====================
  function getSettings() {
    if (typeof window.getReplySettings === 'function') return window.getReplySettings();
    return {
      normalReply: true,
      typingBubble: true,
      quote: true,
      minWait: 3,
      maxWait: 12,
      minCount: 0,
      maxCount: 3,
      readStatus: false,
      readNoReply: false
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
      var publicCards = getPublicReplyCards();
      if (publicCards.length > 0) {
        return { text: randomPick(publicCards), source: 'publicCards' };
      }

      var allGroups = getAllGroupsOfCategory('reply');
      var fallback = pickFromGroups(allGroups, 'reply');
      if (fallback) return { text: fallback, source: 'fallback' };

      return null;
    }

    if (validPublic.length === 0) {
      var privateText = pickFromGroups(validPrivate, 'reply');
      if (privateText) return { text: privateText, source: 'private' };
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
    for (var i = rows.length - 1; i >= 0 && arr.length < (limit || 8); i--) {
      var row = rows[i];
      var bubble = row.querySelector('.message-bubble');
      if (!bubble) continue;
      var img = bubble.querySelector('img');
      if (img && !bubble.textContent.trim()) continue;
      var text = bubble.textContent.trim();
      if (text) arr.push(text);
    }
    return arr;
  }

  // ==================== 创建消息行 ====================
   function createMessageRow(type, content, msgId) {
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
    if (msgId) row.dataset.msgid = msgId;

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

  // ==================== 已读标记 ====================
  var readMarkTimer = null;

  function scheduleReadMark() {
    if (readMarkTimer) return;
    var delay = 1500 + Math.floor(Math.random() * 2500);
    readMarkTimer = setTimeout(function () {
      readMarkTimer = null;
      markAllSelfAsRead();
    }, delay);
  }

  function markAllSelfAsRead() {
    var rows = chatMessages.querySelectorAll('.message-row.self');
    var changed = false;

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      if (row.dataset.read === 'true') continue;
      row.dataset.read = 'true';
      changed = true;
    }

    if (!changed) return;
    updateReadReceipts();
  }

  function updateReadReceipts() {
    var settings = getSettings();
    var showReadStatus = !!settings.readStatus;

    var rows = chatMessages.querySelectorAll('.message-row.self');
    var arr = Array.prototype.slice.call(rows);

    arr.forEach(function (row, idx) {
      // 先移除旧的回执
      var existing = row.querySelector('.message-read-receipt');
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

      if (!showReadStatus) return;

      // 判断是否是发送者分组的最后一条
      var next = arr[idx + 1];
      if (next) {
        var curTime = parseInt(row.dataset.time || '0', 10);
        var nextTime = parseInt(next.dataset.time || '0', 10);
        if (nextTime - curTime < 60000) return;
      }

      // 只有已读的才显示
      if (row.dataset.read !== 'true') return;

      var body = row.querySelector('.message-body');
      if (!body) return;

      var timeEl = body.querySelector('.message-time');
      if (!timeEl) return;

      var receipt = document.createElement('span');
      receipt.className = 'message-read-receipt';
      receipt.innerHTML = '<i class="fa-solid fa-check"></i>';
      receipt.title = '已读';
      timeEl.appendChild(receipt);
    });
  }

  // ==================== 发送消息 ====================
  function sendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;

    var content;
    if (currentQuote && currentQuote.text) {
      content = { quote: currentQuote.text, text: text };
      currentQuote = null;
      var bar = document.getElementById('quotePreviewBar');
      if (bar) bar.style.display = 'none';
    } else {
      content = text;
    }

      var msgId = (window.sessionChat && window.sessionChat.genMsgId)
      ? window.sessionChat.genMsgId()
      : ('m_' + Date.now() + '_' + Math.floor(Math.random() * 100000));
    var newRow = createMessageRow('self', content, msgId);
    newRow.dataset.read = 'false';
    chatMessages.appendChild(newRow);
    lastUserMessage = text;

    // 会话分桶：记录我方消息（异步回复将写入同一会话）
    if (window.sessionChat) {
      window.sessionChat.setReplyTarget(window.sessionChat.getCurrentKey());
      window.sessionChat.record('self', content, msgId);
    }

    chatInput.value = '';
    updateSendBtnState();
    scrollToBottom();

    // ① 启动已读延迟标记
    scheduleReadMark();

    // ② 判断「已读不回」
    var settings = getSettings();
    var shouldIgnore = false;
    if (settings.readNoReply) {
      if (Math.random() < 0.2) {
        shouldIgnore = true;
      }
    }

    if (!shouldIgnore) {
      triggerAutoReply();
    } else {
      dlog('[传讯] 已读不回命中，跳过回复');
    }
  }

  sendBtn.addEventListener('click', sendMessage);
  chatInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

    // 主动消息：发给「非当前会话」的联系人（简化逻辑）
  function triggerAutoReplyForOther(contactId, settings) {
    if (!contactId) return;
    if (!settings.normalReply) return;

    // 1. 抽一条文字回复
    var picked = pickOneTextReply();
    if (!picked) {
      // 兜底：从可用字卡里抽
      var pool = getAllReplyCards().concat(getPublicReplyCards(), getExclusiveReplyCards());
      var fb = randomPick(pool);
      if (!fb) return;
      picked = { text: fb };
    }
    var text = picked.text;
    if (!text) return;

    // 2. 写进该联系人的会话桶
    var key = 'c:' + contactId;
    if (window.sessionChat && typeof window.sessionChat.recordTo === 'function') {
      try {
        window.sessionChat.recordTo(key, 'other', text);
      } catch (e) {
        console.warn('[chat] 主动消息写桶失败', e);
        return;
      }
    } else {
      return;
    }

    // 3. 弹横幅（用该联系人的名字/头像）
    try {
      var contacts = JSON.parse(localStorage.getItem('my_contacts') || '[]');
      var c = contacts.find(function (x) { return x.id === contactId; });
      var name = c ? (c.name || 'Ta') : 'Ta';
      if (window.chatNotify && typeof window.chatNotify.show === 'function') {
        window.chatNotify.show(name, text);
      }
    } catch (e) {}
  }

  // ==================== 自动回复核心逻辑 ====================
  function triggerAutoReply(targetContactId) {
    const settings = getSettings();

    // ========== 主动消息分支：目标是「非当前会话」的联系人 ==========
    // 简化逻辑：只抽 1 条文字，写进他的桶 + 弹通知，不动当前 DOM
    if (targetContactId && window.sessionChat && typeof window.sessionChat.getCurrentContactId === 'function') {
      var currentCid = window.sessionChat.getCurrentContactId();
      if (targetContactId !== currentCid) {
        triggerAutoReplyForOther(targetContactId, settings);
        return;
      }
    }
    // ========== 以下走原逻辑（发给当前会话） ==========

    if (!settings.normalReply) {
      dlog('[传讯] 正常字卡回复已关闭');
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
              var _mid = (window.sessionChat && window.sessionChat.genMsgId)
          ? window.sessionChat.genMsgId()
          : ('m_' + Date.now() + '_' + Math.floor(Math.random() * 100000));
        const row = createMessageRow('other', '字卡库还没有内容哦，先去添加字卡吧~', _mid);
        chatMessages.appendChild(row);
        if (window.sessionChat) {
          try { window.sessionChat.recordReply('other', '字卡库还没有内容哦，先去添加字卡吧~', _mid); } catch (e) {}
        }
        scrollToBottom();
      }, 800);
      return;
    }

    const minWait = Math.max(1, settings.minWait || 3);
    const maxWait = Math.max(minWait, settings.maxWait || 12);
    const waitMs = randomInt(minWait, maxWait) * 1000;

    dlog('[传讯] 将在 ' + (waitMs / 1000).toFixed(1) + ' 秒后回复');

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

        // 回复路径也标一次已读（兜底）
        markAllSelfAsRead();

        const minCount = Math.max(0, settings.minCount || 0);
        const maxCount = Math.max(minCount, settings.maxCount || 3);
        let replyCount = randomInt(minCount, maxCount);
        if (replyCount === 0) replyCount = 1;

        var replies = [];

        // 1. 文字回复
        for (var i = 0; i < replyCount; i++) {
          var picked = pickOneTextReply();

          if (!picked) {
            var fallbackPool = allCards.concat(publicCards, getExclusiveReplyCards());
            var fb = randomPick(fallbackPool);
            if (fb) picked = { text: fb, source: 'fallback' };
          }

          if (!picked) break;
          var content = picked.text;

          if (settings.quote) {
            var quotePool = getRecentSelfMessages(8);
            if (quotePool.length > 0 && Math.random() < 0.35) {
              var pickedQuote = randomPick(quotePool);
              content = { quote: pickedQuote, text: content };
            }
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
          var fallbackPool2 = allCards.concat(publicCards, getExclusiveReplyCards());
          var fb2 = randomPick(fallbackPool2);
          if (fb2) {
            replies.push({ type: 'text', content: fb2 });
          }
        }

        // 依次显示
              replies.forEach(function (item, index) {
          setTimeout(function () {
            var msgId = (window.sessionChat && window.sessionChat.genMsgId)
              ? window.sessionChat.genMsgId()
              : ('m_' + Date.now() + '_' + Math.floor(Math.random() * 100000));
            var row;
            if (item.type === 'text') {
              row = createMessageRow('other', item.content, msgId);
            } else if (item.type === 'image') {
              row = createMessageRow('other', { type: 'image', url: item.url }, msgId);
            }
            if (row) {
              chatMessages.appendChild(row);
              scrollToBottom();

              // 会话分桶：记录对方回复（写入发送时所在的会话）
              if (window.sessionChat) {
                try {
                  if (item.type === 'text') {
                    window.sessionChat.recordReply('other', item.content, msgId);
                  } else if (item.type === 'image') {
                    window.sessionChat.recordReply('other', { type: 'image', url: item.url }, msgId);
                  }
                } catch (e) {}
              }

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

  // ==================== 追加对方文字到聊天（供外部调用） ====================
   window.appendTaTextToChat = function (text) {
    if (!text || typeof text !== 'string') return;
    var msgId = (window.sessionChat && window.sessionChat.genMsgId)
      ? window.sessionChat.genMsgId()
      : ('m_' + Date.now() + '_' + Math.floor(Math.random() * 100000));
    var row = createMessageRow('other', text, msgId);
    chatMessages.appendChild(row);
    if (window.sessionChat) {
      try { window.sessionChat.record('other', text, msgId); } catch (e) {}
    }
    scrollToBottom();

    if (window.chatNotify && typeof window.chatNotify.show === 'function') {
      try { window.chatNotify.show('Ta', text); } catch (e) {}
    }
  };

  // ==================== 追加问卷卡片到聊天（供外部调用） ====================
  window.appendSurveyCardToChat = function (survey) {
    if (!survey || !survey.id) return;

    // 卡片 DOM
    var row = document.createElement('div');
    row.className = 'message-row other msg-survey-row';
    row.dataset.surveyId = survey.id;
    row.dataset.surveyStatus = survey.status || 'unanswered';

    var bubble = document.createElement('div');
    bubble.className = 'message-bubble msg-survey-bubble';

      var qCount = (survey.qs || []).length;
    var title = survey.title || 'Ta 的问卷';
    var isAnswered = survey.status === 'answered';

    var html = '';
    html += '<div class="msg-survey-head">';
    html += '  <i class="fa-solid fa-clipboard-question"></i>';
    html += '  <span class="msg-survey-tag">问卷</span>';
    html += '</div>';
    html += '<div class="msg-survey-title">' + escapeHtmlSafe(title) + '</div>';
    html += '<div class="msg-survey-meta">' + qCount + ' 题 · 点击作答</div>';

    // 只保留状态标签
    html += '<div class="msg-survey-foot">';
    if (isAnswered) {
      html += '  <span class="msg-survey-status done"><i class="fa-solid fa-check-circle"></i> 已作答</span>';
    } else {
      html += '  <span class="msg-survey-status pending"><i class="fa-regular fa-circle"></i> 待作答</span>';
    }
    html += '</div>';

    bubble.innerHTML = html;

    // 点击气泡 → 打开作答页
    bubble.addEventListener('click', function () {
      if (typeof window.openTaSurveyAnswer === 'function') {
        window.openTaSurveyAnswer(survey.id);
      } else {
        if (typeof window.dreamSurvey !== 'undefined' && window.dreamSurvey.openList) {
          window.dreamSurvey.openList();
        }
      }
    });

    row.appendChild(bubble);

    // 挂 dataset（时间戳、发送者等）
    row.dataset.sender = 'partner';
    row.dataset.type = 'ask-survey-from-ta';
    row.dataset.time = String(Date.now());
    row.dataset.favorited = 'false';

    // 手动挂时间戳
    var body = document.createElement('div');
    body.className = 'message-body';
    row.insertBefore(body, bubble);
    body.appendChild(bubble);

    var timeEl = document.createElement('div');
    timeEl.className = 'message-time';
    var timeText = document.createElement('span');
    timeText.className = 'message-time-text';
    timeText.textContent = formatTime(Date.now());
    timeEl.appendChild(timeText);
    body.appendChild(timeEl);

    chatMessages.appendChild(row);
    scrollToBottom();

    // 通知
    if (window.chatNotify && typeof window.chatNotify.show === 'function') {
      try { window.chatNotify.show('Ta', '想问你几个问题'); } catch (e) {}
    }
  };

  // ==================== 回写问卷卡片状态（供作答提交后调用） ====================
  window.syncSurveyCard = function (surveyId) {
    if (!surveyId) return;
    if (!window.dreamSurveyFromTa) return;

    var s = window.dreamSurveyFromTa.findById(surveyId);
    if (!s) return;

      var rows = chatMessages.querySelectorAll('.msg-survey-row');
    rows.forEach(function (row) {
      if (row.dataset.surveyId !== surveyId) return;

      // 更新 dataset 状态
      row.dataset.surveyStatus = s.status || 'unanswered';

      var isAnswered = s.status === 'answered';

      var bubble = row.querySelector('.msg-survey-bubble');
      if (!bubble) return;

      // 更新状态标签
      var statusEl = bubble.querySelector('.msg-survey-status');
      if (statusEl) {
        if (isAnswered) {
          statusEl.className = 'msg-survey-status done';
          statusEl.innerHTML = '<i class="fa-solid fa-check-circle"></i> 已作答';
        } else {
          statusEl.className = 'msg-survey-status pending';
          statusEl.innerHTML = '<i class="fa-regular fa-circle"></i> 待作答';
        }
      }
    });
  };

  // 供卡片内部使用的转义
  function escapeHtmlSafe(s) {
    if (!s) return '';
    return String(s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

    // ==================== 追加我方问卷卡片到聊天（供 A6 调用） ====================
  window.appendMySurveyCardToChat = function (survey) {
    if (!survey || !survey.id) return;

    var row = document.createElement('div');
    row.className = 'message-row self msg-survey-row msg-survey-row-self';
    row.dataset.surveyId = survey.id;
    row.dataset.surveyStatus = survey.status || 'sent';

    var bubble = document.createElement('div');
    bubble.className = 'message-bubble msg-survey-bubble';

    var qCount = (survey.qs || []).length;
    var title = survey.title || '我的问卷';

    var html = '';
    html += '<div class="msg-survey-head">';
    html += '  <i class="fa-solid fa-paper-plane"></i>';
    html += '  <span class="msg-survey-tag">我发出的问卷</span>';
    html += '</div>';
    html += '<div class="msg-survey-title">' + escapeHtmlSafe(title) + '</div>';
    html += '<div class="msg-survey-meta">' + qCount + ' 题</div>';

    html += '<div class="msg-survey-foot">';
    html += '  <span class="msg-survey-status pending" data-status="sent">' +
              '<i class="fa-solid fa-hourglass-half"></i> 等待 Ta 作答' +
            '</span>';
    html += '</div>';

    bubble.innerHTML = html;

    // 我方卡片：点击不打开作答页（Ta 的问卷才点开作答）
    // 只显示，不做点击交互

    row.appendChild(bubble);

    row.dataset.sender = 'me';
    row.dataset.type = 'survey-from-me';
    row.dataset.time = String(Date.now());
    row.dataset.favorited = 'false';

    var body = document.createElement('div');
    body.className = 'message-body';
    row.insertBefore(body, bubble);
    body.appendChild(bubble);

    var timeEl = document.createElement('div');
    timeEl.className = 'message-time';
    var timeText = document.createElement('span');
    timeText.className = 'message-time-text';
    timeText.textContent = formatTime(Date.now());
    timeEl.appendChild(timeText);
    body.appendChild(timeEl);

    chatMessages.appendChild(row);
    scrollToBottom();
  };

  // ==================== 回写我方问卷卡片状态 ====================
  window.syncMySurveyCard = function (surveyId) {
    if (!surveyId) return;
    if (!window.dreamSurveyFromMe) return;

    // 直接读 localStorage（因为 dream-survey-from-me 的 upsert 已经写盘了）
    var list = [];
    try {
      var raw = localStorage.getItem('dream_survey_list');
      if (raw) list = JSON.parse(raw) || [];
    } catch (e) {}

    var s = list.find(function (x) { return x.id === surveyId; });
    if (!s) return;

    var rows = chatMessages.querySelectorAll('.msg-survey-row-self');
    rows.forEach(function (row) {
      if (row.dataset.surveyId !== surveyId) return;
      row.dataset.surveyStatus = s.status || 'sent';

      var statusEl = row.querySelector('.msg-survey-status');
      if (!statusEl) return;

      var qCount = (s.qs || []).length;
      var answeredCount = 0;
      if (Array.isArray(s.answers)) {
        answeredCount = s.answers.filter(function (a) {
          if (!a) return false;
          var v = a.value;
          if (Array.isArray(v)) return v.length > 0;
          return v !== undefined && v !== null && String(v).trim() !== '';
        }).length;
      }

      if (s.status === 'done') {
        statusEl.className = 'msg-survey-status done';
        statusEl.innerHTML = '<i class="fa-solid fa-check-circle"></i> Ta 已交卷';
      } else if (s.status === 'sent') {
        if (answeredCount > 0) {
          statusEl.className = 'msg-survey-status doing';
          statusEl.innerHTML = '<i class="fa-solid fa-pen"></i> 作答中 ' + answeredCount + '/' + qCount;
        } else {
          statusEl.className = 'msg-survey-status pending';
          statusEl.innerHTML = '<i class="fa-solid fa-hourglass-half"></i> 等待 Ta 作答';
        }
      } else {
        // draft（被撤回后的状态，此时卡片通常已被删，不走这里）
        statusEl.className = 'msg-survey-status pending';
        statusEl.innerHTML = '<i class="fa-regular fa-circle"></i> 待发出';
      }
    });
  };

  // ==================== 顶栏图标点击（占位） ====================
  document.querySelectorAll('.chat-action-icon').forEach(function (icon) {
    icon.addEventListener('click', function () {
      if (icon.id === 'fishingIcon') return;
      dlog('点击了：' + (icon.getAttribute('title') || '功能'));
    });
  });

  // ==================== 左侧图标点击 ====================
  document.querySelectorAll('.input-left-icons i').forEach(function (icon) {
    // 「让 Ta 继续说」手动触发
    if (icon.id === 'continueBtn') {
      icon.addEventListener('click', function (e) {
        e.stopImmediatePropagation();
        e.preventDefault();
        triggerAutoReply();
      });
      return;
    }
    // 其它图标：占位日志
    icon.addEventListener('click', function () {
      dlog('点击了：' + (icon.getAttribute('title') || '功能'));
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

  window.getCards = getAllReplyCards;

  // ==================== 消息操作菜单 ====================
  var currentMenu = null;
  var currentMenuRow = null;

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

    var rect = menu.getBoundingClientRect();
    var mw = rect.width;
    var mh = rect.height;

    var left = x - mw / 2;
    var top = y - mh - 8;

    if (left < 8) left = 8;
    if (left + mw > window.innerWidth - 8) left = window.innerWidth - mw - 8;
    if (top < 8) {
      top = y + 8;
    }
    if (top + mh > window.innerHeight - 8) {
      top = window.innerHeight - mh - 8;
    }

    menu.style.left = left + 'px';
    menu.style.top = top + 'px';

    menu.querySelectorAll('.msg-action-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var act = btn.getAttribute('data-act');
        if (act === 'quote') doQuote(row);
        else if (act === 'fav') doFav(row, btn);
        else if (act === 'withdraw') doWithdraw(row);
        if (act !== 'fav') closeMsgMenu();
      });
    });
  }

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
    chatInput.focus();
  }

   function doFav(row, btn) {
    var isFav = row.dataset.favorited === 'true';
    var next = !isFav;
    row.dataset.favorited = next ? 'true' : 'false';

    var icon = btn.querySelector('i');
    if (icon) {
      icon.className = 'fa-' + (next ? 'solid' : 'regular') + ' fa-star';
    }
    btn.classList.toggle('active', next);

    // 同步写存储（按 msgId）
    var msgId = row.dataset.msgid;
    if (msgId && window.sessionChat && typeof window.sessionChat.toggleFav === 'function') {
      try { window.sessionChat.toggleFav(msgId, next); } catch (e) {}
    }
  }

  function doWithdraw(row) {
    if (!row.parentNode) return;

    // 如果是我发出的问卷卡片 → 同步把问卷回 draft
    var surveyId = row.dataset.surveyId;
    var rowType = row.dataset.type;
    if (surveyId && rowType === 'survey-from-me') {
      if (window.dreamSurveyFromMe && typeof window.dreamSurveyFromMe.onCardWithdrawn === 'function') {
        try { window.dreamSurveyFromMe.onCardWithdrawn(surveyId); } catch (e) {
          console.warn('[chat] 撤回问卷联动失败', e);
        }
      }
    }

    row.parentNode.removeChild(row);
  }

  var quoteClose = document.getElementById('quotePreviewClose');
  if (quoteClose) {
    quoteClose.addEventListener('click', function () {
      currentQuote = null;
      var bar = document.getElementById('quotePreviewBar');
      if (bar) bar.style.display = 'none';
    });
  }

  chatMessages.addEventListener('click', function (e) {
    if (e.target.closest('.msg-action-menu')) return;
    if (e.target.closest('.quote-preview-bar')) return;
    if (e.target.closest('.chat-input-bar')) return;
    if (e.target.closest('#typingRow')) return;

      // 问卷卡片点击
    var surveyRow = e.target.closest('.msg-survey-row');
    if (surveyRow) {
      // 我方卡片（我发出的问卷）：不打开作答页，让它走消息菜单（可以撤回）
      if (surveyRow.classList.contains('msg-survey-row-self')) {
        // 落到下面的 openMsgMenu 分支
      } else {
        // Ta 的问卷卡片：打开作答页
        e.stopPropagation();
        var sid = surveyRow.dataset.surveyId;
        if (sid && typeof window.openTaSurveyAnswer === 'function') {
          window.openTaSurveyAnswer(sid);
        }
        return;
      }
    }

    var row = e.target.closest('.message-row');
    if (!row) {
      closeMsgMenu();
      return;
    }

    e.stopPropagation();
    openMsgMenu(row, e.clientX, e.clientY);
  }, true);

  document.addEventListener('click', function (e) {
    if (!currentMenu) return;
    if (e.target.closest('.msg-action-menu')) return;
    if (currentMenuRow && currentMenuRow.contains(e.target)) return;
    closeMsgMenu();
  });

  chatMessages.addEventListener('scroll', closeMsgMenu, true);
  window.addEventListener('resize', closeMsgMenu);

  // 设置变更时刷新回执
  window.addEventListener('replySettingsChanged', function () {
    updateReadReceipts();
  });

  updateSendBtnState();
  scrollToBottom();
  setTimeout(updateReadReceipts, 100);

})();
