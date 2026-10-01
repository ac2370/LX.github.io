/**
 * 字卡管理逻辑（分组重构版）
 * - cardDatabase.reply 从一维数组改为 { "分组名": [字卡...] }
 * - 兼容旧数据：自动迁移
 * - 新增分组操作函数（挂在 window 上）
 * - 保持字卡收纳盒现有 UI 和功能完全不变
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
  const KEY_REPLY_GROUPS = 'my_word_card_groups'; // 新：分组结构存储

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
  let currentGroup = '默认分组'; // 当前选中的回复分组

  // ==================== 数据访问 ====================

  // 判断是否为分组对象
  function isGroupObject(obj) {
    return obj && typeof obj === 'object' && !Array.isArray(obj);
  }

  // 获取 reply 的分组对象（自动兼容旧数据）
  function getReplyGroupsObject() {
    if (!window.cardDatabase) return { '默认分组': [] };
    var reply = window.cardDatabase.reply;
    // 如果已经是分组对象
    if (isGroupObject(reply)) return reply;
    // 如果是数组（旧数据），迁移为分组对象
    if (Array.isArray(reply)) {
      var migrated = { '默认分组': reply.slice() };
      window.cardDatabase.reply = migrated;
      // 持久化
      if (window.cardDatabase.persist) window.cardDatabase.persist();
      return migrated;
    }
    // 其他情况（null/undefined），初始化
    window.cardDatabase.reply = { '默认分组': [] };
    if (window.cardDatabase.persist) window.cardDatabase.persist();
    return window.cardDatabase.reply;
  }

  // 从独立 localStorage 兼容读取旧的分组结构（如果 cardDatabase 未就绪）
  function loadReplyGroupsFromStorage() {
    try {
      var raw = localStorage.getItem(KEY_REPLY_GROUPS);
      if (raw) {
        var data = JSON.parse(raw);
        if (isGroupObject(data)) return data;
      }
    } catch (e) {}
    return null;
  }

  // 保存分组结构到 localStorage（兼容备份）
  function saveReplyGroupsToStorage(groupsObj) {
    try {
      localStorage.setItem(KEY_REPLY_GROUPS, JSON.stringify(groupsObj));
    } catch (e) {}
  }

  // ==================== 公共 API（挂在 window 上） ====================

  // 获取所有分组名
  window.getGroups = function () {
    var groupsObj = getReplyGroupsObject();
    return Object.keys(groupsObj);
  };

  // 新建分组
  window.addGroup = function (groupName) {
    if (!groupName || typeof groupName !== 'string') return false;
    var groupsObj = getReplyGroupsObject();
    if (groupsObj[groupName]) return false; // 已存在
    groupsObj[groupName] = [];
    // 持久化
    if (window.cardDatabase && window.cardDatabase.persist) {
      window.cardDatabase.persist();
    }
    saveReplyGroupsToStorage(groupsObj);
    return true;
  };

  // 重命名分组
  window.renameGroup = function (oldName, newName) {
    if (!oldName || !newName) return false;
    var groupsObj = getReplyGroupsObject();
    if (!groupsObj[oldName]) return false; // 不存在
    if (groupsObj[newName]) return false; // 新名字已存在
    // 保持顺序：重建对象
    var newObj = {};
    Object.keys(groupsObj).forEach(function (key) {
      if (key === oldName) {
        newObj[newName] = groupsObj[oldName];
      } else {
        newObj[key] = groupsObj[key];
      }
    });
    window.cardDatabase.reply = newObj;
    if (window.cardDatabase && window.cardDatabase.persist) {
      window.cardDatabase.persist();
    }
    saveReplyGroupsToStorage(newObj);
    return true;
  };

  // 删除分组
  window.deleteGroup = function (groupName) {
    if (!groupName) return false;
    var groupsObj = getReplyGroupsObject();
    if (!groupsObj[groupName]) return false;
    // 不允许删除最后一个分组
    if (Object.keys(groupsObj).length <= 1) return false;
    delete groupsObj[groupName];
    if (window.cardDatabase && window.cardDatabase.persist) {
      window.cardDatabase.persist();
    }
    saveReplyGroupsToStorage(groupsObj);
    // 如果删除的是当前分组，切回第一个
    if (currentGroup === groupName) {
      var remaining = Object.keys(groupsObj);
      currentGroup = remaining[0] || '默认分组';
    }
    return true;
  };

  // 向指定分组添加字卡
  window.addCardToGroup = function (groupName, text) {
    if (!groupName || !text) return false;
    var groupsObj = getReplyGroupsObject();
    if (!groupsObj[groupName]) {
      groupsObj[groupName] = [];
    }
    if (autoDedup && groupsObj[groupName].indexOf(text) >= 0) return false;
    groupsObj[groupName].push(text);
    if (window.cardDatabase && window.cardDatabase.persist) {
      window.cardDatabase.persist();
    }
    saveReplyGroupsToStorage(groupsObj);
    return true;
  };

  // 从指定分组删除字卡
  window.removeCardFromGroup = function (groupName, text) {
    if (!groupName || !text) return false;
    var groupsObj = getReplyGroupsObject();
    if (!groupsObj[groupName]) return false;
    var idx = groupsObj[groupName].indexOf(text);
    if (idx < 0) return false;
    groupsObj[groupName].splice(idx, 1);
    if (window.cardDatabase && window.cardDatabase.persist) {
      window.cardDatabase.persist();
    }
    saveReplyGroupsToStorage(groupsObj);
    return true;
  };

  // 获取某分组的所有字卡
  window.getCardsInGroup = function (groupName) {
    var groupsObj = getReplyGroupsObject();
    return groupsObj[groupName] || [];
  };

  // 获取当前分组
  window.getCurrentGroup = function () {
    return currentGroup;
  };

  // 设置当前分组
  window.setCurrentGroup = function (groupName) {
    var groupsObj = getReplyGroupsObject();
    if (groupsObj[groupName]) {
      currentGroup = groupName;
      return true;
    }
    return false;
  };

  // ==================== 数据访问（其他分类保持原样） ====================
  function getDB(category) {
    if (!window.cardDatabase || !window.cardDatabase.ready) return [];
    if (category === 'reply') {
      // 兼容：返回当前分组的字卡数组
      var groupsObj = getReplyGroupsObject();
      return groupsObj[currentGroup] || [];
    }
    return window.cardDatabase.get(category) || [];
  }

  // ==================== 兼容旧数据迁移 ====================
  function migrateOldData() {
    if (!window.cardDatabase || !window.cardDatabase.ready) return;

    // 1. 检查是否有独立存储的分组数据（优先级最高）
    var storedGroups = loadReplyGroupsFromStorage();
    if (storedGroups) {
      // 只有当 cardDatabase.reply 还是数组或空对象时才使用存储的分组
      var reply = window.cardDatabase.reply;
      if (Array.isArray(reply) || (isGroupObject(reply) && Object.keys(reply).length === 0)) {
        window.cardDatabase.reply = storedGroups;
        if (window.cardDatabase.persist) window.cardDatabase.persist();
      }
    }

    // 2. 如果 cardDatabase.reply 是数组，迁移为分组对象
    if (Array.isArray(window.cardDatabase.reply)) {
      var migrated = { '默认分组': window.cardDatabase.reply.slice() };
      window.cardDatabase.reply = migrated;
      if (window.cardDatabase.persist) window.cardDatabase.persist();
      saveReplyGroupsToStorage(migrated);
    }

    // 3. 如果 cardDatabase.reply 是空对象，初始化默认分组
    if (isGroupObject(window.cardDatabase.reply) && Object.keys(window.cardDatabase.reply).length === 0) {
      window.cardDatabase.reply = { '默认分组': [] };
      if (window.cardDatabase.persist) window.cardDatabase.persist();
      saveReplyGroupsToStorage(window.cardDatabase.reply);
    }

    // 4. 颜文字
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

    // 5. 表情包
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

  // 地点 / 心情 / 状态：继续使用 localStorage
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

    if (category === 'reply') {
      // 添加到当前分组
      texts.forEach(function (t) {
        window.addCardToGroup(currentGroup, t);
      });
    } else if (category === 'kaomoji') {
      window.cardDatabase.addMany('emoji', texts, autoDedup);
    } else if (category === 'emoji') {
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
  function renderTextList(container, placeholderEl, arr, searchInput, groupName) {
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
        // 回复分类：从当前分组删除
        if (container === cardList && groupName) {
          window.removeCardFromGroup(groupName, text);
        } else {
          const idx = arr.indexOf(text);
          if (idx >= 0) {
            arr.splice(idx, 1);
            if (arr === placeCards) saveAuxArray(KEY_PLACE, placeCards);
            else if (arr === moodCards) saveAuxArray(KEY_MOOD, moodCards);
            else if (arr === statusCards) saveAuxArray(KEY_STATUS, statusCards);
            else if (window.cardDatabase) {
              if (window.cardDatabase.emoji.indexOf(text) >= 0) {
                window.cardDatabase.remove('emoji', text);
              } else if (window.cardDatabase.sticker.indexOf(text) >= 0) {
                window.cardDatabase.remove('sticker', text);
              }
            }
          }
        }
        updateAllUI();
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

  // ==================== 更新分组下拉框 ====================
  function updateGroupSelect() {
    if (!groupSelect) return;
    var groups = window.getGroups();
    // 确保 currentGroup 有效
    if (groups.indexOf(currentGroup) < 0) {
      currentGroup = groups[0] || '默认分组';
    }

    groupSelect.innerHTML = '';
    groups.forEach(function (name) {
      var opt = document.createElement('option');
      opt.value = name;
      var count = window.getCardsInGroup(name).length;
      opt.textContent = name + ' · ' + count + ' 条';
      if (name === currentGroup) opt.selected = true;
      groupSelect.appendChild(opt);
    });
  }

  // 绑定分组下拉框切换
  if (groupSelect) {
    groupSelect.addEventListener('change', function () {
      currentGroup = groupSelect.value;
      updateAllUI();
    });
  }

  // ==================== 更新所有 UI ====================
  function updateAllUI() {
    if (!window.cardDatabase) return;

    var groupsObj = getReplyGroupsObject();
    var allGroups = Object.keys(groupsObj);
    var totalReplyCount = 0;
    allGroups.forEach(function (g) {
      totalReplyCount += (groupsObj[g] || []).length;
    });

    var emojiArr = getDB('emoji');
    var stickerArr = getDB('sticker');

    // 徽章
    if (badges.reply) badges.reply.textContent = totalReplyCount;
    if (badges.kaomoji) badges.kaomoji.textContent = emojiArr.length;
    if (badges.place) badges.place.textContent = placeCards.length;
    if (badges.mood) badges.mood.textContent = moodCards.length;
    if (badges.emoji) badges.emoji.textContent = stickerArr.length;
    if (badges.status) badges.status.textContent = statusCards.length;

    // 状态栏
    if (cardStatusCounts) {
      cardStatusCounts.textContent = totalReplyCount + ' 条回复 · ' +
        stickerArr.length + ' 个表情 · ' +
        placeCards.length + ' 个地点 · ' +
        moodCards.length + ' 种心情';
    }

    // 更新分组下拉
    updateGroupSelect();

    // 回复列表：只显示当前分组
    var currentGroupCards = window.getCardsInGroup(currentGroup);
    renderTextList(cardList, cardListPlaceholder, currentGroupCards, cardSearchInput, currentGroup);

    // 颜文字
    renderTextList(kaomojiList, kaomojiPlaceholder, emojiArr, kaomojiSearchInput);

    // 地点
    renderTextList(placeList, placePlaceholder, placeCards, placeSearchInput);

    // 心情
    renderTextList(moodList, moodPlaceholder, moodCards, moodSearchInput);

    // 状态
    renderTextList(statusList, statusPlaceholder, statusCards, statusSearchInput);

    if (statusGroupSelect) {
      statusGroupSelect.innerHTML = '';
      var opt = document.createElement('option');
      opt.textContent = '默认状态 · ' + statusCards.length + ' 条';
      opt.value = 'default';
      statusGroupSelect.appendChild(opt);
    }

    // 表情包
    renderEmojiGrid();
  }

  // ==================== 回复面板事件 ====================
  if (btnAddCard) btnAddCard.addEventListener('click', function () {
    openSimpleModal('add', '添加回复字卡', '输入一句话...', 'reply');
  });
  if (btnImport) btnImport.addEventListener('click', function () {
    openSimpleModal('import', '导入回复字卡', '每行一条，粘贴多行文字...', 'reply');
  });
  if (btnExport) btnExport.addEventListener('click', function () {
    // 导出当前分组
    var currentGroupCards = window.getCardsInGroup(currentGroup);
    if (currentGroupCards.length === 0) { alert('当前分组没有字卡可导出'); return; }
    var exportData = {};
    exportData[currentGroup] = currentGroupCards;
    var blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'reply_cards_' + currentGroup + '.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
  if (dedupNowBtn) dedupNowBtn.addEventListener('click', function () {
    var groupsObj = getReplyGroupsObject();
    var before = (groupsObj[currentGroup] || []).length;
    if (groupsObj[currentGroup]) {
      groupsObj[currentGroup] = deduplicate(groupsObj[currentGroup]);
    }
    var after = (groupsObj[currentGroup] || []).length;
    if (window.cardDatabase && window.cardDatabase.persist) {
      window.cardDatabase.persist();
    }
    saveReplyGroupsToStorage(groupsObj);
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

  // ==================== 暴露给外部 ====================
  window.getReplyCards = function () {
    // 兼容：返回所有分组的字卡合并（供 chat.js 抽卡）
    var groupsObj = getReplyGroupsObject();
    var all = [];
    Object.keys(groupsObj).forEach(function (g) {
      all = all.concat(groupsObj[g] || []);
    });
    return all;
  };
  window.getKaomojiCards = function () { return getDB('emoji'); };
  window.getEmojiCards = function () { return getDB('sticker'); };

  window.refreshCardUI = function () {
    if (!window.cardDatabase || !window.cardDatabase.ready) {
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

  window.addEventListener('cardDatabaseReady', function () {
    initData();
    updateAllUI();
  });

})();
