/**
 * 字卡收纳盒 + 传讯聊天逻辑
 * - 分类切换：回复、颜文字、地点、心情、表情包、状态
 * - 每个分类独立渲染自己的内容
 * - 传讯自动回复从回复字卡中随机抽取
 */

(function () {
  'use strict';

  // ==================== 存储 Key ====================
  const KEY_REPLY = 'my_word_cards';       // 回复
  const KEY_KAOMOJI = 'my_kaomoji_cards';  // 颜文字
  const KEY_PLACE = 'my_place_cards';      // 地点
  const KEY_MOOD = 'my_mood_cards';        // 心情
  const KEY_EMOJI = 'my_emoji_cards';      // 表情包（图片 URL 数组）
  const KEY_STATUS = 'my_status_cards';    // 状态

  // ==================== DOM 引用 ====================
  // 分类
  const catItems = document.querySelectorAll('.cat-grid-item');
  const panels = {
    reply: document.getElementById('panel-reply'),
    kaomoji: document.getElementById('panel-kaomoji'),
    place: document.getElementById('panel-place'),
    mood: document.getElementById('panel-mood'),
    emoji: document.getElementById('panel-emoji'),
    status: document.getElementById('panel-status')
  };

  // 徽章
  const badges = {
    reply: document.getElementById('badgeReply'),
    kaomoji: document.getElementById('badgeKaomoji'),
    place: document.getElementById('badgePlace'),
    mood: document.getElementById('badgeMood'),
    emoji: document.getElementById('badgeEmoji'),
    status: document.getElementById('badgeStatus')
  };

  const cardStatusCounts = document.getElementById('cardStatusCounts');

  // 通用弹窗
  const simpleModal = document.getElementById('simpleModal');
  const simpleModalTitleText = document.getElementById('simpleModalTitleText');
  const simpleModalInput = document.getElementById('simpleModalInput');
  const simpleModalCancel = document.getElementById('simpleModalCancel');
  const simpleModalConfirm = document.getElementById('simpleModalConfirm');
  let simpleModalMode = 'add';
  let simpleModalCategory = 'reply';

  // 回复面板
  const cardList = document.getElementById('cardList');
  const cardListPlaceholder = document.getElementById('cardListPlaceholder');
  const groupSelect = document.getElementById('groupSelect');
  const btnImport = document.getElementById('btnImport');
  const btnExport = document.getElementById('btnExport');
  const btnAddCard = document.getElementById('btnAddCard');
  const dedupNowBtn = document.getElementById('dedupNowBtn');
  const dedupToggle = document.getElementById('dedupToggle');
  const dedupCheckbox = document.getElementById('dedupCheckbox');
  const cardSearchInput = document.getElementById('cardSearchInput');

  // 颜文字面板
  const kaomojiList = document.getElementById('kaomojiList');
  const kaomojiPlaceholder = document.getElementById('kaomojiPlaceholder');
  const kaomojiSearchInput = document.getElementById('kaomojiSearchInput');

  // 地点面板
  const placeList = document.getElementById('placeList');
  const placePlaceholder = document.getElementById('placePlaceholder');
  const placeSearchInput = document.getElementById('placeSearchInput');

  // 心情面板
  const moodList = document.getElementById('moodList');
  const moodPlaceholder = document.getElementById('moodPlaceholder');
  const moodSearchInput = document.getElementById('moodSearchInput');

  // 表情包面板
  const emojiGrid = document.getElementById('emojiGrid');
  const emojiFooterSub = document.getElementById('emojiFooterSub');
  const emojiFooterCount = document.getElementById('emojiFooterCount');
  const emojiSearchInput = document.getElementById('emojiSearchInput');
  const emojiFileInput = document.getElementById('emojiFileInput');
  const emojiUploadBtn = document.getElementById('emojiUploadBtn');
  const emojiAddLinkBtn = document.getElementById('emojiAddLinkBtn');
  const emojiImportLinkBtn = document.getElementById('emojiImportLinkBtn');
  const emojiExportBtn = document.getElementById('emojiExportBtn');
  const emojiNewGroupBtn = document.getElementById('emojiNewGroupBtn');
  const emojiAllGroupBtn = document.getElementById('emojiAllGroupBtn');
  const emojiOrganizeBtn = document.getElementById('emojiOrganizeBtn');

  // 状态面板
  const statusList = document.getElementById('statusList');
  const statusPlaceholder = document.getElementById('statusPlaceholder');
  const statusSearchInput = document.getElementById('statusSearchInput');
  const statusGroupSelect = document.getElementById('statusGroupSelect');
  const statusNewGroupBtn = document.getElementById('statusNewGroupBtn');
  const statusOrganizeBtn = document.getElementById('statusOrganizeBtn');
  const statusImportBtn = document.getElementById('statusImportBtn');
  const statusExportBtn = document.getElementById('statusExportBtn');
  const statusAddBtn = document.getElementById('statusAddBtn');

  // 全局数据
  let autoDedup = true;
  let currentCategory = 'reply';
  let replyCards = [];
  let kaomojiCards = [];
  let placeCards = [];
  let moodCards = [];
  let emojiCards = [];
  let statusCards = [];

  // ==================== 数据读写 ====================
  function loadArray(key, defaults) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return defaults.slice();
      const data = JSON.parse(raw);
      if (!Array.isArray(data)) return defaults.slice();
      return data.map(function (item) {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && item.text) return item.text;
        return null;
      }).filter(function (t) { return t; });
    } catch (e) {
      return defaults.slice();
    }
  }

  function loadEmoji() {
    try {
      const raw = localStorage.getItem(KEY_EMOJI);
      if (!raw) return [];
      const data = JSON.parse(raw);
      if (!Array.isArray(data)) return [];
      return data.filter(function (x) {
        return typeof x === 'string' && x;
      });
    } catch (e) { return []; }
  }

  function saveArray(key, arr) {
    try { localStorage.setItem(key, JSON.stringify(arr)); } catch (e) {}
  }

  function loadAll() {
    replyCards = loadArray(KEY_REPLY, ['今天天气很好', '在想你', '记得按时吃饭', '早点休息，别熬夜', '我一直在的', '抱抱你']);
    kaomojiCards = loadArray(KEY_KAOMOJI, []);
    placeCards = loadArray(KEY_PLACE, []);
    moodCards = loadArray(KEY_MOOD, []);
    emojiCards = loadEmoji();
    statusCards = loadArray(KEY_STATUS, []);

    // 首次写入默认回复
    if (!localStorage.getItem(KEY_REPLY)) {
      saveArray(KEY_REPLY, replyCards);
    }
  }

  // ==================== 通用工具 ====================
  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  function deduplicate(arr) {
    const seen = new Set();
    return arr.filter(function (item) {
      if (seen.has(item)) return false;
      seen.add(item);
      return true;
    });
  }

  // ==================== 分类切换 ====================
  catItems.forEach(function (item) {
    item.addEventListener('click', function () {
      const cat = item.getAttribute('data-cat');
      currentCategory = cat;

      catItems.forEach(function (i) { i.classList.remove('active'); });
      item.classList.add('active');

      Object.keys(panels).forEach(function (key) {
        if (panels[key]) {
          panels[key].classList.toggle('active', key === cat);
        }
      });

      updateAllUI();
    });
  });

  // ==================== 通用弹窗 ====================
  function openSimpleModal(mode, title, placeholder, category) {
    simpleModalMode = mode;
    simpleModalCategory = category || 'reply';
    simpleModalTitleText.textContent = title;
    simpleModalInput.value = '';
    simpleModalInput.placeholder = placeholder || '输入内容...';
    simpleModal.classList.add('active');
    setTimeout(function () { simpleModalInput.focus(); }, 100);
  }
  function closeSimpleModal() { simpleModal.classList.remove('active'); }

  if (simpleModalCancel) simpleModalCancel.addEventListener('click', closeSimpleModal);
  if (simpleModal) {
    simpleModal.addEventListener('click', function (e) {
      if (e.target === simpleModal) closeSimpleModal();
    });
  }

  // 通用添加逻辑
  function addItemsToCategory(category, texts) {
    let target;
    if (category === 'reply') target = replyCards;
    else if (category === 'kaomoji') target = kaomojiCards;
    else if (category === 'place') target = placeCards;
    else if (category === 'mood') target = moodCards;
    else if (category === 'status') target = statusCards;
    else return;

    texts.forEach(function (t) { target.push(t); });
    if (autoDedup) {
      const deduped = deduplicate(target);
      target.length = 0;
      deduped.forEach(function (t) { target.push(t); });
    }

    if (category === 'reply') saveArray(KEY_REPLY, replyCards);
    else if (category === 'kaomoji') saveArray(KEY_KAOMOJI, kaomojiCards);
    else if (category === 'place') saveArray(KEY_PLACE, placeCards);
    else if (category === 'mood') saveArray(KEY_MOOD, moodCards);
    else if (category === 'status') saveArray(KEY_STATUS, statusCards);
  }

  if (simpleModalConfirm) {
    simpleModalConfirm.addEventListener('click', function () {
      const text = simpleModalInput.value.trim();
      if (!text) { alert('请输入内容'); return; }

      if (simpleModalCategory === 'emoji') {
        // 表情包特殊处理：链接
        const lines = text.split('\n').map(function (l) { return l.trim(); }).filter(function (l) { return l; });
        lines.forEach(function (url) {
          if (url) emojiCards.push(url);
        });
        saveArray(KEY_EMOJI, emojiCards);
      } else {
        if (simpleModalMode === 'add') {
          addItemsToCategory(simpleModalCategory, [text]);
        } else {
          const lines = text.split('\n').map(function (l) { return l.trim(); }).filter(function (l) { return l; });
          addItemsToCategory(simpleModalCategory, lines);
        }
      }
      closeSimpleModal();
      updateAllUI();
    });
  }

  // ==================== 渲染通用卡片列表 ====================
  function renderTextList(container, placeholderEl, arr, searchInput, emptyIcon) {
    if (!container) return;
    const keyword = searchInput ? searchInput.value.trim().toLowerCase() : '';
    let filtered = arr;
    if (keyword) {
      filtered = arr.filter(function (t) { return t.toLowerCase().indexOf(keyword) >= 0; });
    }

    if (filtered.length === 0) {
      container.innerHTML = '';
      if (placeholderEl) placeholderEl.style.display = 'block';
      return;
    }
    if (placeholderEl) placeholderEl.style.display = 'none';
    container.innerHTML = '';

    filtered.forEach(function (text) {
      const item = document.createElement('div');
      item.className = 'word-card-item';
      const textEl = document.createElement('div');
      textEl.className = 'word-card-text';
      textEl.textContent = text;
      const del = document.createElement('button');
      del.className = 'word-card-delete';
      del.innerHTML = '<i class="fa-solid fa-xmark"></i>';
      del.addEventListener('click', function () {
        if (!confirm('确定删除这条内容吗？')) return;
        const idx = arr.indexOf(text);
        if (idx >= 0) {
          arr.splice(idx, 1);
          if (arr === replyCards) saveArray(KEY_REPLY, replyCards);
          else if (arr === kaomojiCards) saveArray(KEY_KAOMOJI, kaomojiCards);
          else if (arr === placeCards) saveArray(KEY_PLACE, placeCards);
          else if (arr === moodCards) saveArray(KEY_MOOD, moodCards);
          else if (arr === statusCards) saveArray(KEY_STATUS, statusCards);
          updateAllUI();
        }
      });
      item.appendChild(textEl);
      item.appendChild(del);
      container.appendChild(item);
    });
  }

  // ==================== 渲染表情包 ====================
  function renderEmojiGrid() {
    if (!emojiGrid) return;
    const keyword = emojiSearchInput ? emojiSearchInput.value.trim().toLowerCase() : '';
    let filtered = emojiCards;
    if (keyword) {
      filtered = emojiCards.filter(function (url) {
        return url.toLowerCase().indexOf(keyword) >= 0;
      });
    }

    emojiGrid.innerHTML = '';
    if (filtered.length === 0) {
      if (emojiFooterSub) emojiFooterSub.style.display = 'block';
      if (emojiFooterCount) {
        emojiFooterCount.textContent = '0 张 · 自动去重 · 轻点查看 / 管理';
      }
      return;
    }
    if (emojiFooterSub) emojiFooterSub.style.display = 'none';
    if (emojiFooterCount) {
      emojiFooterCount.textContent = filtered.length + ' 张 · 自动去重 · 轻点查看 / 管理';
    }

    filtered.forEach(function (url, index) {
      const item = document.createElement('div');
      item.className = 'emoji-grid-item';
      const img = document.createElement('img');
      img.src = url;
      img.alt = '表情包';
      img.onerror = function () {
        img.src = 'https://picsum.photos/100/100?random=' + index;
      };
      const del = document.createElement('button');
      del.className = 'emoji-delete';
      del.innerHTML = '<i class="fa-solid fa-xmark"></i>';
      del.addEventListener('click', function (e) {
        e.stopPropagation();
        if (!confirm('确定删除这张表情包吗？')) return;
        const realIdx = emojiCards.indexOf(url);
        if (realIdx >= 0) {
          emojiCards.splice(realIdx, 1);
          saveArray(KEY_EMOJI, emojiCards);
          updateAllUI();
        }
      });
      item.appendChild(img);
      item.appendChild(del);
      emojiGrid.appendChild(item);
    });
  }

  // ==================== 更新所有 UI ====================
  function updateAllUI() {
    // 徽章
    if (badges.reply) badges.reply.textContent = replyCards.length;
    if (badges.kaomoji) badges.kaomoji.textContent = kaomojiCards.length;
    if (badges.place) badges.place.textContent = placeCards.length;
    if (badges.mood) badges.mood.textContent = moodCards.length;
    if (badges.emoji) badges.emoji.textContent = emojiCards.length;
    if (badges.status) badges.status.textContent = statusCards.length;

    // 状态栏
    if (cardStatusCounts) {
      cardStatusCounts.textContent = replyCards.length + ' 条回复 · ' +
        emojiCards.length + ' 个表情 · ' +
        placeCards.length + ' 个地点 · ' +
        moodCards.length + ' 种心情';
    }

    // 回复面板
    renderTextList(cardList, cardListPlaceholder, replyCards, cardSearchInput, 'fa-regular fa-note-sticky');
    if (groupSelect) {
      groupSelect.innerHTML = '';
      const opt = document.createElement('option');
      opt.textContent = '亲爱的的回复 · ' + replyCards.length + ' 条';
      opt.value = 'reply';
      groupSelect.appendChild(opt);
    }

    // 颜文字
    renderTextList(kaomojiList, kaomojiPlaceholder, kaomojiCards, kaomojiSearchInput, 'fa-regular fa-face-smile');

    // 地点
    renderTextList(placeList, placePlaceholder, placeCards, placeSearchInput, 'fa-solid fa-location-dot');

    // 心情
    renderTextList(moodList, moodPlaceholder, moodCards, moodSearchInput, 'fa-regular fa-heart');

    // 状态
    renderTextList(statusList, statusPlaceholder, statusCards, statusSearchInput, 'fa-regular fa-circle-check');
    if (statusGroupSelect) {
      statusGroupSelect.innerHTML = '';
      const opt = document.createElement('option');
      opt.textContent = '默认状态 · ' + statusCards.length + ' 条';
      opt.value = 'default';
      statusGroupSelect.appendChild(opt);
    }

    // 表情包
    renderEmojiGrid();

    // 导航角标（传讯页可能引用）
    const navMsgBadge = document.getElementById('navMsgBadge');
    if (navMsgBadge) {
      const total = replyCards.length;
      navMsgBadge.textContent = total > 99 ? '99+' : total;
      navMsgBadge.style.display = total > 0 ? 'flex' : 'none';
    }
  }

  // ==================== 回复面板事件 ====================
  if (btnAddCard) {
    btnAddCard.addEventListener('click', function () {
      openSimpleModal('add', '添加回复字卡', '输入一句话...', 'reply');
    });
  }
  if (btnImport) {
    btnImport.addEventListener('click', function () {
      openSimpleModal('import', '导入回复字卡', '每行一条，粘贴多行文字...', 'reply');
    });
  }
  if (btnExport) {
    btnExport.addEventListener('click', function () {
      if (replyCards.length === 0) { alert('没有字卡可导出'); return; }
      const blob = new Blob([JSON.stringify(replyCards, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'reply_cards.json';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }
  if (dedupNowBtn) {
    dedupNowBtn.addEventListener('click', function () {
      const before = replyCards.length;
      replyCards = deduplicate(replyCards);
      const removed = before - replyCards.length;
      saveArray(KEY_REPLY, replyCards);
      updateAllUI();
      alert(removed > 0 ? '已去除 ' + removed + ' 条重复' : '没有重复内容');
    });
  }
  if (dedupToggle) {
    dedupToggle.addEventListener('click', function () {
      autoDedup = !autoDedup;
      dedupCheckbox.classList.toggle('checked', autoDedup);
    });
    dedupCheckbox.classList.toggle('checked', autoDedup);
  }
  if (cardSearchInput) {
    cardSearchInput.addEventListener('input', updateAllUI);
  }

  // ==================== 颜文字 / 地点 / 心情 搜索 ====================
  if (kaomojiSearchInput) kaomojiSearchInput.addEventListener('input', updateAllUI);
  if (placeSearchInput) placeSearchInput.addEventListener('input', updateAllUI);
  if (moodSearchInput) moodSearchInput.addEventListener('input', updateAllUI);
  if (statusSearchInput) statusSearchInput.addEventListener('input', updateAllUI);

  // ==================== 表情包事件 ====================
  if (emojiUploadBtn) {
    emojiUploadBtn.addEventListener('click', function () {
      emojiFileInput.click();
    });
  }
  if (emojiFileInput) {
    emojiFileInput.addEventListener('change', function () {
      const files = emojiFileInput.files;
      if (!files || files.length === 0) return;
      let loaded = 0;
      const total = files.length;
      Array.prototype.forEach.call(files, function (file) {
        if (!file.type.startsWith('image/')) {
          loaded++;
          if (loaded === total) { saveArray(KEY_EMOJI, emojiCards); updateAllUI(); }
          return;
        }
        const reader = new FileReader();
        reader.onload = function (e) {
          emojiCards.push(e.target.result);
          loaded++;
          if (loaded === total) {
            if (autoDedup) emojiCards = deduplicate(emojiCards);
            saveArray(KEY_EMOJI, emojiCards);
            updateAllUI();
          }
        };
        reader.readAsDataURL(file);
      });
      emojiFileInput.value = '';
    });
  }
  if (emojiAddLinkBtn) {
    emojiAddLinkBtn.addEventListener('click', function () {
      openSimpleModal('add', '添加表情包链接', '粘贴图片 URL，每行一条...', 'emoji');
    });
  }
  if (emojiImportLinkBtn) {
    emojiImportLinkBtn.addEventListener('click', function () {
      openSimpleModal('import', '导入表情包链接', '每行一个图片 URL...', 'emoji');
    });
  }
  if (emojiExportBtn) {
    emojiExportBtn.addEventListener('click', function () {
      if (emojiCards.length === 0) { alert('没有表情包可导出'); return; }
      const blob = new Blob([JSON.stringify(emojiCards, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'emoji_cards.json';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }
  if (emojiSearchInput) {
    emojiSearchInput.addEventListener('input', renderEmojiGrid);
  }
  if (emojiNewGroupBtn) {
    emojiNewGroupBtn.addEventListener('click', function () {
      alert('分组功能开发中');
    });
  }
  if (emojiAllGroupBtn) {
    emojiAllGroupBtn.addEventListener('click', function () {
      alert('已显示全部分组');
    });
  }
  if (emojiOrganizeBtn) {
    emojiOrganizeBtn.addEventListener('click', function () {
      const before = emojiCards.length;
      emojiCards = deduplicate(emojiCards);
      saveArray(KEY_EMOJI, emojiCards);
      updateAllUI();
      alert(before - emojiCards.length > 0 ? '已去除 ' + (before - emojiCards.length) + ' 张重复' : '没有重复');
    });
  }

  // ==================== 状态面板事件 ====================
  if (statusAddBtn) {
    statusAddBtn.addEventListener('click', function () {
      openSimpleModal('add', '添加状态', '输入一个状态...', 'status');
    });
  }
  if (statusImportBtn) {
    statusImportBtn.addEventListener('click', function () {
      openSimpleModal('import', '导入状态', '每行一条状态...', 'status');
    });
  }
  if (statusExportBtn) {
    statusExportBtn.addEventListener('click', function () {
      if (statusCards.length === 0) { alert('没有状态可导出'); return; }
      const blob = new Blob([JSON.stringify(statusCards, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'status_cards.json';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }
  if (statusNewGroupBtn) {
    statusNewGroupBtn.addEventListener('click', function () {
      alert('分组功能开发中');
    });
  }
  if (statusOrganizeBtn) {
    statusOrganizeBtn.addEventListener('click', function () {
      const before = statusCards.length;
      statusCards = deduplicate(statusCards);
      saveArray(KEY_STATUS, statusCards);
      updateAllUI();
      alert(before - statusCards.length > 0 ? '已去除 ' + (before - statusCards.length) + ' 条重复' : '没有重复');
    });
  }

  // ==================== 回复分组按钮 ====================
  const btnNewGroup = document.getElementById('btnNewGroup');
  const btnRenameGroup = document.getElementById('btnRenameGroup');
  const btnOrganizeGroup = document.getElementById('btnOrganizeGroup');
  if (btnNewGroup) btnNewGroup.addEventListener('click', function () { alert('新建分组功能开发中'); });
  if (btnRenameGroup) btnRenameGroup.addEventListener('click', function () { alert('重命名功能开发中'); });
  if (btnOrganizeGroup) btnOrganizeGroup.addEventListener('click', function () {
    const before = replyCards.length;
    replyCards = deduplicate(replyCards);
    saveArray(KEY_REPLY, replyCards);
    updateAllUI();
    alert(before - replyCards.length > 0 ? '已整理，去除 ' + (before - replyCards.length) + ' 条' : '已整理');
  });

  // ==================== 颜文字 / 地点 / 心情 整理 ====================
  const kaomojiOrganizeBtn = document.getElementById('kaomojiOrganizeBtn');
  const placeOrganizeBtn = document.getElementById('placeOrganizeBtn');
  const moodOrganizeBtn = document.getElementById('moodOrganizeBtn');
  if (kaomojiOrganizeBtn) kaomojiOrganizeBtn.addEventListener('click', function () {
    kaomojiCards = deduplicate(kaomojiCards);
    saveArray(KEY_KAOMOJI, kaomojiCards);
    updateAllUI();
  });
  if (placeOrganizeBtn) placeOrganizeBtn.addEventListener('click', function () {
    placeCards = deduplicate(placeCards);
    saveArray(KEY_PLACE, placeCards);
    updateAllUI();
  });
  if (moodOrganizeBtn) moodOrganizeBtn.addEventListener('click', function () {
    moodCards = deduplicate(moodCards);
    saveArray(KEY_MOOD, moodCards);
    updateAllUI();
  });

  // ==================== 暴露给外部 ====================
  window.getReplyCards = function () { return replyCards; };
  window.getKaomojiCards = function () { return kaomojiCards; };
  window.getEmojiCards = function () { return emojiCards; };
  window.refreshCardUI = function () {
    loadAll();
    updateAllUI();
  };

  // ==================== 初始化 ====================
  loadAll();
  updateAllUI();

  // ==================== 传讯聊天逻辑 ====================
  const chatMessages = document.getElementById('chatMessages');
  const chatInput = document.getElementById('chatInput');
  const sendBtn = document.getElementById('sendBtn');

  if (chatMessages && chatInput && sendBtn) {
    let lastUserMessage = '';

    function updateSendBtnState() {
      sendBtn.disabled = chatInput.value.trim().length === 0;
    }
    chatInput.addEventListener('input', updateSendBtnState);

    function scrollToBottom() {
      requestAnimationFrame(function () {
        chatMessages.scrollTop = chatMessages.scrollHeight;
      });
    }

    function getChatCards() {
      return replyCards;
    }

    function getSettings() {
      if (typeof window.getReplySettings === 'function') return window.getReplySettings();
      return {
        normalReply: true, kaomoji: false, typingBubble: true, quote: true,
        minWait: 3, maxWait: 12, minCount: 0, maxCount: 3
      };
    }

    function randomInt(min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    function randomPick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

    const KAOMOJI_LIST = ['(๑•̀ㅂ•́)و✧', '(｡･ω･｡)', '(´• ω •`)', '(*/ω＼*)', '(๑´ㅂ`๑)', 'ฅ^•ﻌ•^ฅ'];

    function createMessageRow(type, content) {
      const row = document.createElement('div');
      row.className = 'message-row ' + type;
      const bubble = document.createElement('div');
      bubble.className = 'message-bubble';
      if (typeof content === 'string') {
        bubble.textContent = content;
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

    function triggerAutoReply() {
      const settings = getSettings();
      const cards = getChatCards();

      if (!settings.normalReply) return;
      if (cards.length === 0) {
        setTimeout(function () {
          chatMessages.appendChild(createMessageRow('other', '字卡库还没有内容哦，先去添加字卡吧~'));
          scrollToBottom();
        }, 800);
        return;
      }

      const minWait = Math.max(1, settings.minWait || 3);
      const maxWait = Math.max(minWait, settings.maxWait || 12);
      const waitMs = randomInt(minWait, maxWait) * 1000;
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
          if (typingRow && typingRow.parentNode) typingRow.parentNode.removeChild(typingRow);

          const minCount = Math.max(0, settings.minCount || 0);
          const maxCount = Math.max(minCount, settings.maxCount || 3);
          let replyCount = randomInt(minCount, maxCount);
          if (replyCount === 0) replyCount = 1;

          const shuffled = cards.slice().sort(function () { return Math.random() - 0.5; });
          const selected = shuffled.slice(0, Math.min(replyCount, cards.length));

          selected.forEach(function (cardText, index) {
            setTimeout(function () {
              let content = cardText;
              if (settings.kaomoji && Math.random() < 0.5) {
                content = content + ' ' + randomPick(KAOMOJI_LIST);
              }
              if (settings.quote && lastUserMessage && Math.random() < 0.35) {
                content = { quote: lastUserMessage, text: content };
              }
              chatMessages.appendChild(createMessageRow('other', content));
              scrollToBottom();
            }, index * 500);
          });
        }, typingDuration);
      }, waitMs);
    }

    window.initChatPage = function () { scrollToBottom(); };
    updateSendBtnState();
    scrollToBottom();
  }

  // 顶栏图标点击日志
  document.querySelectorAll('.chat-action-icon').forEach(function (icon) {
    icon.addEventListener('click', function () {
      if (icon.id === 'fishingIcon') return;
      console.log('点击了：' + (icon.getAttribute('title') || '功能'));
    });
  });
  document.querySelectorAll('.input-left-icons i').forEach(function (icon) {
    icon.addEventListener('click', function () {
      console.log('点击了：' + (icon.getAttribute('title') || '功能'));
    });
  });

})();
