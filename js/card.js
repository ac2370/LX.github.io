/**
 * 字卡管理逻辑（第 3 步修改版）
 * - 所有分类数据写入 window.cardDatabase（由 reply.js 提供）
 * - 使用 localforage 持久化
 * - 传讯页面的自动回复只使用 cardDatabase.reply / emoji / sticker
 */

(function () {
  'use strict';

  // ==================== 存储 Key（兼容旧数据迁移） ====================
  const KEY_REPLY = 'my_word_cards';
  const KEY_KAOMOJI = 'my_kaomoji_cards';
  const KEY_PLACE = 'my_place_cards';
  const KEY_MOOD = 'my_mood_cards';
  const KEY_EMOJI = 'my_emoji_cards';
  const KEY_STATUS = 'my_status_cards';

  // ==================== DOM 引用 ====================
  const catItems = document.querySelectorAll('.cat-grid-item');
  const panels = {
    reply: document.getElementById('panel-reply'),
    kaomoji: document.getElementById('panel-kaomoji'),
    place: document.getElementById('panel-place'),
    mood: document.getElementById('panel-mood'),
    emoji: document.getElementById('panel-emoji'),
    status: document.getElementById('panel-status')
  };

  const badges = {
    reply: document.getElementById('badgeReply'),
    kaomoji: document.getElementById('badgeKaomoji'),
    place: document.getElementById('badgePlace'),
    mood: document.getElementById('badgeMood'),
    emoji: document.getElementById('badgeEmoji'),
    status: document.getElementById('badgeStatus')
  };

  const cardStatusCounts = document.getElementById('cardStatusCounts');

  const simpleModal = document.getElementById('simpleModal');
  const simpleModalTitleText = document.getElementById('simpleModalTitleText');
  const simpleModalInput = document.getElementById('simpleModalInput');
  const simpleModalCancel = document.getElementById('simpleModalCancel');
  const simpleModalConfirm = document.getElementById('simpleModalConfirm');
  let simpleModalMode = 'add';
  let simpleModalCategory = 'reply';

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

  const kaomojiList = document.getElementById('kaomojiList');
  const kaomojiPlaceholder = document.getElementById('kaomojiPlaceholder');
  const kaomojiSearchInput = document.getElementById('kaomojiSearchInput');

  const placeList = document.getElementById('placeList');
  const placePlaceholder = document.getElementById('placePlaceholder');
  const placeSearchInput = document.getElementById('placeSearchInput');

  const moodList = document.getElementById('moodList');
  const moodPlaceholder = document.getElementById('moodPlaceholder');
  const moodSearchInput = document.getElementById('moodSearchInput');

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

  const statusList = document.getElementById('statusList');
  const statusPlaceholder = document.getElementById('statusPlaceholder');
  const statusSearchInput = document.getElementById('statusSearchInput');
  const statusGroupSelect = document.getElementById('statusGroupSelect');
  const statusNewGroupBtn = document.getElementById('statusNewGroupBtn');
  const statusOrganizeBtn = document.getElementById('statusOrganizeBtn');
  const statusImportBtn = document.getElementById('statusImportBtn');
  const statusExportBtn = document.getElementById('statusExportBtn');
  const statusAddBtn = document.getElementById('statusAddBtn');

  let autoDedup = true;
  let currentCategory = 'reply';

  // ==================== 数据访问（统一走 cardDatabase） ====================
  function getDB(category) {
    if (!window.cardDatabase || !window.cardDatabase.ready) return [];
    return window.cardDatabase.get(category) || [];
  }

  // 兼容旧数据迁移：把旧的 localStorage 数据迁移到 cardDatabase
  function migrateOldData() {
    if (!window.cardDatabase || !window.cardDatabase.ready) return;

    // 回复
    if (window.cardDatabase.reply.length === 0) {
      try {
        const raw = localStorage.getItem(KEY_REPLY);
        if (raw) {
          const data = JSON.parse(raw);
          if (Array.isArray(data) && data.length > 0) {
            data.forEach(function (item) {
              var text = (typeof item === 'string') ? item : (item && item.text ? item.text : '');
              if (text) window.cardDatabase.reply.push(text);
            });
          }
        }
      } catch (e) {}
    }

    // 颜文字
    if (window.cardDatabase.emoji.length === 0) {
      try {
        const raw = localStorage.getItem(KEY_KAOMOJI);
        if (raw) {
          const data = JSON.parse(raw);
          if (Array.isArray(data) && data.length > 0) {
            data.forEach(function (item) {
              var text = (typeof item === 'string') ? item : (item && item.text ? item.text : '');
              if (text) window.cardDatabase.emoji.push(text);
            });
          }
        }
      } catch (e) {}
    }

    // 表情包
    if (window.cardDatabase.sticker.length === 0) {
      try {
        const raw = localStorage.getItem(KEY_EMOJI);
        if (raw) {
          const data = JSON.parse(raw);
          if (Array.isArray(data) && data.length > 0) {
            data.forEach(function (item) {
              if (typeof item === 'string' && item) window.cardDatabase.sticker.push(item);
            });
          }
        }
      } catch (e) {}
    }

    window.cardDatabase.persist();
  }

  // 地点 / 心情 / 状态：继续使用 localStorage（不参与自动回复）
  function loadAuxArray(key, defaults) {
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

  function saveAuxArray(key, arr) {
    try { localStorage.setItem(key, JSON.stringify(arr)); } catch (e) {}
  }

  let placeCards = [];
  let moodCards = [];
  let statusCards = [];

  // ==================== 工具 ====================
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

  // ==================== 初始化数据 ====================
  function initData() {
    placeCards = loadAuxArray(KEY_PLACE, []);
    moodCards = loadAuxArray(KEY_MOOD, []);
    statusCards = loadAuxArray(KEY_STATUS, []);

    migrateOldData();
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

  // 统一添加逻辑：文字类分类
  function addTextToCategory(category, texts) {
    if (!window.cardDatabase || !window.cardDatabase.ready) return;

    // 参与自动回复的分类：reply / emoji
    if (category === 'reply') {
      window.cardDatabase.addMany('reply', texts, autoDedup);
    } else if (category === 'kaomoji') {
      // 颜文字存入 cardDatabase.emoji
      window.cardDatabase.addMany('emoji', texts, autoDedup);
    } else if (category === 'emoji') {
      // 表情包（图片链接）存入 cardDatabase.sticker
      window.cardDatabase.addMany('sticker', texts, autoDedup);
    } else if (category === 'place') {
      texts.forEach(function (t) { placeCards.push(t); });
      if (autoDedup) placeCards = deduplicate(placeCards);
      saveAuxArray(KEY_PLACE, placeCards);
    } else if (category === 'mood') {
      texts.forEach(function (t) { moodCards.push(t); });
      if (autoDedup) moodCards = deduplicate(moodCards);
      saveAuxArray(KEY_MOOD, moodCards);
    } else if (category === 'status') {
      texts.forEach(function (t) { statusCards.push(t); });
      if (autoDedup) statusCards = deduplicate(statusCards);
      saveAuxArray(KEY_STATUS, statusCards);
    }
  }

  if (simpleModalConfirm) {
    simpleModalConfirm.addEventListener('click', function () {
      const text = simpleModalInput.value.trim();
      if (!text) { alert('请输入内容'); return; }

      if (simpleModalCategory === 'emoji') {
        // 表情包链接
        const lines = text.split('\n').map(function (l) { return l.trim(); }).filter(function (l) { return l; });
        addTextToCategory('emoji', lines);
      } else {
        if (simpleModalMode === 'add') {
          addTextToCategory(simpleModalCategory, [text]);
        } else {
          const lines = text.split('\n').map(function (l) { return l.trim(); }).filter(function (l) { return l; });
          addTextToCategory(simpleModalCategory, lines);
        }
      }
      closeSimpleModal();
      updateAllUI();
    });
  }

  // ==================== 渲染通用卡片 ====================
  function renderTextList(container, placeholderEl, arr, searchInput) {
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
          if (arr === placeCards) saveAuxArray(KEY_PLACE, placeCards);
          else if (arr === moodCards) saveAuxArray(KEY_MOOD, moodCards);
          else if (arr === statusCards) saveAuxArray(KEY_STATUS, statusCards);
          else if (window.cardDatabase) {
            // 判断属于哪个 cardDatabase 分类
            if (window.cardDatabase.reply.indexOf(text) >= 0) {
              window.cardDatabase.remove('reply', text);
            } else if (window.cardDatabase.emoji.indexOf(text) >= 0) {
              window.cardDatabase.remove('emoji', text);
            } else if (window.cardDatabase.sticker.indexOf(text) >= 0) {
              window.cardDatabase.remove('sticker', text);
            }
          }
          updateAllUI();
        }
      });
      item.appendChild(textEl);
      item.appendChild(del);
      container.appendChild(item);
    });
  }

  function renderEmojiGrid() {
    if (!emojiGrid) return;
    const stickerArr = getDB('sticker');
    const keyword = emojiSearchInput ? emojiSearchInput.value.trim().toLowerCase() : '';
    let filtered = stickerArr;
    if (keyword) {
      filtered = stickerArr.filter(function (url) {
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
        window.cardDatabase.remove('sticker', url);
        updateAllUI();
      });
      item.appendChild(img);
      item.appendChild(del);
      emojiGrid.appendChild(item);
    });
  }

  function updateAllUI() {
    if (!window.cardDatabase) return;

    const replyArr = getDB('reply');
    const emojiArr = getDB('emoji');
    const stickerArr = getDB('sticker');

    if (badges.reply) badges.reply.textContent = replyArr.length;
    if (badges.kaomoji) badges.kaomoji.textContent = emojiArr.length;
    if (badges.place) badges.place.textContent = placeCards.length;
    if (badges.mood) badges.mood.textContent = moodCards.length;
    if (badges.emoji) badges.emoji.textContent = stickerArr.length;
    if (badges.status) badges.status.textContent = statusCards.length;

    if (cardStatusCounts) {
      cardStatusCounts.textContent = replyArr.length + ' 条回复 · ' +
        stickerArr.length + ' 个表情 · ' +
        placeCards.length + ' 个地点 · ' +
        moodCards.length + ' 种心情';
    }

    renderTextList(cardList, cardListPlaceholder, replyArr, cardSearchInput);
    if (groupSelect) {
      groupSelect.innerHTML = '';
      const opt = document.createElement('option');
      opt.textContent = '亲爱的的回复 · ' + replyArr.length + ' 条';
      opt.value = 'reply';
      groupSelect.appendChild(opt);
    }

    renderTextList(kaomojiList, kaomojiPlaceholder, emojiArr, kaomojiSearchInput);
    renderTextList(placeList, placePlaceholder, placeCards, placeSearchInput);
    renderTextList(moodList, moodPlaceholder, moodCards, moodSearchInput);
    renderTextList(statusList, statusPlaceholder, statusCards, statusSearchInput);

    if (statusGroupSelect) {
      statusGroupSelect.innerHTML = '';
      const opt = document.createElement('option');
      opt.textContent = '默认状态 · ' + statusCards.length + ' 条';
      opt.value = 'default';
      statusGroupSelect.appendChild(opt);
    }

    renderEmojiGrid();

    // 重新绑定整理模式的卡片
    if (window.rebindCardEvents) window.rebindCardEvents();
  }

  // ==================== 回复面板事件 ====================
  if (btnAddCard) btnAddCard.addEventListener('click', function () {
    openSimpleModal('add', '添加回复字卡', '输入一句话...', 'reply');
  });
  if (btnImport) btnImport.addEventListener('click', function () {
    openSimpleModal('import', '导入回复字卡', '每行一条，粘贴多行文字...', 'reply');
  });
  if (btnExport) btnExport.addEventListener('click', function () {
    const replyArr = getDB('reply');
    if (replyArr.length === 0) { alert('没有字卡可导出'); return; }
    const blob = new Blob([JSON.stringify(replyArr, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'reply_cards.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
  if (dedupNowBtn) dedupNowBtn.addEventListener('click', function () {
    const before = getDB('reply').length;
    window.cardDatabase.deduplicate('reply');
    const after = getDB('reply').length;
    updateAllUI();
    alert(before - after > 0 ? '已去除 ' + (before - after) + ' 条重复' : '没有重复内容');
  });
  if (dedupToggle) {
    dedupToggle.addEventListener('click', function () {
      autoDedup = !autoDedup;
      dedupCheckbox.classList.toggle('checked', autoDedup);
    });
    dedupCheckbox.classList.toggle('checked', autoDedup);
  }
  if (cardSearchInput) cardSearchInput.addEventListener('input', updateAllUI);

  if (kaomojiSearchInput) kaomojiSearchInput.addEventListener('input', updateAllUI);
  if (placeSearchInput) placeSearchInput.addEventListener('input', updateAllUI);
  if (moodSearchInput) moodSearchInput.addEventListener('input', updateAllUI);
  if (statusSearchInput) statusSearchInput.addEventListener('input', updateAllUI);

  // ==================== 表情包事件 ====================
  if (emojiUploadBtn) emojiUploadBtn.addEventListener('click', function () { emojiFileInput.click(); });
  if (emojiFileInput) {
    emojiFileInput.addEventListener('change', function () {
      const files = emojiFileInput.files;
      if (!files || files.length === 0) return;
      let loaded = 0;
      const total = files.length;
      Array.prototype.forEach.call(files, function (file) {
        if (!file.type.startsWith('image/')) {
          loaded++;
          if (loaded === total) { updateAllUI(); }
          return;
        }
        const reader = new FileReader();
        reader.onload = function (e) {
          // 图片上传：存入 sticker
          window.cardDatabase.add('sticker', e.target.result, autoDedup);
          loaded++;
          if (loaded === total) updateAllUI();
        };
        reader.readAsDataURL(file);
      });
      emojiFileInput.value = '';
    });
  }
  if (emojiAddLinkBtn) emojiAddLinkBtn.addEventListener('click', function () {
    openSimpleModal('add', '添加表情包链接', '粘贴图片 URL，每行一条...', 'emoji');
  });
  if (emojiImportLinkBtn) emojiImportLinkBtn.addEventListener('click', function () {
    openSimpleModal('import', '导入表情包链接', '每行一个图片 URL...', 'emoji');
  });
  if (emojiExportBtn) emojiExportBtn.addEventListener('click', function () {
    const stickerArr = getDB('sticker');
    if (stickerArr.length === 0) { alert('没有表情包可导出'); return; }
    const blob = new Blob([JSON.stringify(stickerArr, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'emoji_cards.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
  if (emojiSearchInput) emojiSearchInput.addEventListener('input', renderEmojiGrid);
  if (emojiNewGroupBtn) emojiNewGroupBtn.addEventListener('click', function () { alert('分组功能开发中'); });
  if (emojiAllGroupBtn) emojiAllGroupBtn.addEventListener('click', function () { alert('已显示全部分组'); });
  if (emojiOrganizeBtn) emojiOrganizeBtn.addEventListener('click', function () {
    const before = getDB('sticker').length;
    window.cardDatabase.deduplicate('sticker');
    const after = getDB('sticker').length;
    updateAllUI();
    alert(before - after > 0 ? '已去除 ' + (before - after) + ' 张重复' : '没有重复');
  });

  // ==================== 状态面板事件 ====================
  if (statusAddBtn) statusAddBtn.addEventListener('click', function () {
    openSimpleModal('add', '添加状态', '输入一个状态...', 'status');
  });
  if (statusImportBtn) statusImportBtn.addEventListener('click', function () {
    openSimpleModal('import', '导入状态', '每行一条状态...', 'status');
  });
  if (statusExportBtn) statusExportBtn.addEventListener('click', function () {
    if (statusCards.length === 0) { alert('没有状态可导出'); return; }
    const blob = new Blob([JSON.stringify(statusCards, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'status_cards.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
  if (statusNewGroupBtn) statusNewGroupBtn.addEventListener('click', function () { alert('分组功能开发中'); });
  if (statusOrganizeBtn) statusOrganizeBtn.addEventListener('click', function () {
    const before = statusCards.length;
    statusCards = deduplicate(statusCards);
    saveAuxArray(KEY_STATUS, statusCards);
    updateAllUI();
    alert(before - statusCards.length > 0 ? '已去除 ' + (before - statusCards.length) + ' 条重复' : '没有重复');
  });

  // ==================== 整理按钮（由第 2 步的脚本接管，这里不覆盖） ====================

  // ==================== 暴露给外部 ====================
  window.getReplyCards = function () { return getDB('reply'); };
  window.getKaomojiCards = function () { return getDB('emoji'); };
  window.getEmojiCards = function () { return getDB('sticker'); };

  window.refreshCardUI = function () {
    if (!window.cardDatabase || !window.cardDatabase.ready) {
      // 等待 cardDatabase 就绪
      window.addEventListener('cardDatabaseReady', function () {
        initData();
        updateAllUI();
      });
      return;
    }
    initData();
    updateAllUI();
  };

  // ==================== 初始化 ====================
  function init() {
    if (!window.cardDatabase) {
      // 等待 reply.js 加载
      window.addEventListener('cardDatabaseReady', function () {
        initData();
        updateAllUI();
      });
      return;
    }
    if (!window.cardDatabase.ready) {
      window.addEventListener('cardDatabaseReady', function () {
        initData();
        updateAllUI();
      });
      return;
    }
    initData();
    updateAllUI();
  }

  init();

  // 监听 cardDatabase 就绪事件
  window.addEventListener('cardDatabaseReady', function () {
    initData();
    updateAllUI();
  });

})();
