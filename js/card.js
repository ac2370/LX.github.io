/**
 * 字卡管理逻辑（分组 + 颜色 + 多分类支持）
 * - cardDatabase.reply / pat / mood / location 均为分组对象结构
 * - 兼容旧数据：一维数组自动迁移为 { "默认分组": [...] }
 * - 兼容旧颜文字：cardDatabase.emoji → cardDatabase.pat 自动迁移
 * - 使用 localforage 持久化
 * - 保持字卡收纳盒现有 UI 和功能完全不变
 *
 * 修复：
 * - refreshCardUI 不再重复 migrateOldData，避免每次切回字卡页覆盖新数据
 * - init 只执行一次，避免 cardDatabaseReady 重复触发迁移
 */

(function () {
  'use strict';

  // ==================== 存储 Key ====================
  const KEY_REPLY = 'my_word_cards';
  const KEY_PAT = 'my_kaomoji_cards';   // 沿用旧 key，避免数据丢失
  const KEY_PLACE = 'my_place_cards';
  const KEY_MOOD = 'my_mood_cards';
  const KEY_EMOJI = 'my_emoji_cards';
  const KEY_STATUS = 'my_status_cards';

  // 分组数据独立存储 Key（兼容旧版）
  const STORE_KEY_GROUPS = 'my_card_groups_v2';

  // ==================== DOM 引用 ====================
  const catItems = document.querySelectorAll('.cat-grid-item');
  const panels = {
    reply: document.getElementById('panel-reply'),
    pat: document.getElementById('panel-pat'),
    place: document.getElementById('panel-place'),
    mood: document.getElementById('panel-mood'),
    emoji: document.getElementById('panel-emoji'),
    status: document.getElementById('panel-status')
  };

  const badges = {
    reply: document.getElementById('badgeReply'),
    pat: document.getElementById('badgePat'),
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

  const patList = document.getElementById('patList');
  const patPlaceholder = document.getElementById('patPlaceholder');
  const patSearchInput = document.getElementById('patSearchInput');

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

  // 每个分类的当前选中分组
  const currentGroupMap = {
    reply: '默认分组',
    pat: '默认分组',
    place: '默认分组',
    mood: '默认分组'
  };

  // ==================== 分组数据结构 ====================
  var groupsMeta = {
    reply: {},
    pat: {},
    place: {},
    mood: {}
  };

  const DEFAULT_COLORS = [
    '#5C7CFA', '#F8B4B4', '#6FB1E8', '#7ED3A8', '#F5A623',
    '#B78BEA', '#F06292', '#4DD0E1', '#FF8A65', '#9CCC65',
    '#9575CD', '#FFD54F'
  ];

  // ==================== 通用工具 ====================
  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  function escapeAttr(str) {
    if (!str) return '';
    return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function deduplicate(arr) {
    const seen = new Set();
    return arr.filter(function (item) {
      if (seen.has(item)) return false;
      seen.add(item);
      return true;
    });
  }

  function isGroupObject(obj) {
    return obj && typeof obj === 'object' && !Array.isArray(obj);
  }

  // ==================== 兼容旧数据结构 ====================
  function migrateToGroups(arr) {
    if (Array.isArray(arr)) {
      return { '默认分组': arr.slice() };
    }
    if (isGroupObject(arr)) return arr;
    return { '默认分组': [] };
  }

  // ==================== 持久化 ====================
  function persistAll() {
    // 1. 保存分组数据（cardDatabase.reply / pat / mood / location）
    if (window.cardDatabase && window.cardDatabase.persist) {
      window.cardDatabase.persist();
    }
    // 2. 保存分组元数据（颜色）
    var payload = {
      groupsMeta: groupsMeta,
      currentGroupMap: currentGroupMap
    };
    if (typeof localforage !== 'undefined') {
      localforage.setItem(STORE_KEY_GROUPS, payload).catch(function (e) {
        console.warn('[card.js] localforage 保存失败', e);
      });
    } else {
      try { localStorage.setItem(STORE_KEY_GROUPS, JSON.stringify(payload)); } catch (e) {}
    }
  }

  function loadGroupsMeta(callback) {
    function apply(data) {
      if (data && typeof data === 'object') {
        if (data.groupsMeta) {
          ['reply', 'pat', 'place', 'mood'].forEach(function (k) {
            if (data.groupsMeta[k] && typeof data.groupsMeta[k] === 'object') {
              groupsMeta[k] = data.groupsMeta[k];
            }
          });
        }
        if (data.currentGroupMap) {
          ['reply', 'pat', 'place', 'mood'].forEach(function (k) {
            if (data.currentGroupMap[k]) {
              currentGroupMap[k] = data.currentGroupMap[k];
            }
          });
        }
      }
      if (callback) callback();
    }

    if (typeof localforage !== 'undefined') {
      localforage.getItem(STORE_KEY_GROUPS).then(apply).catch(function () { apply(null); });
    } else {
      try {
        var raw = localStorage.getItem(STORE_KEY_GROUPS);
        apply(raw ? JSON.parse(raw) : null);
      } catch (e) { apply(null); }
    }
  }

  // ==================== 获取/初始化数据 ====================
  function getGroupObject(category) {
    if (!window.cardDatabase) return { '默认分组': [] };

    var dbKey = category;
    if (category === 'place') dbKey = 'location';
    else if (category === 'kaomoji') dbKey = 'pat';

    if (!window.cardDatabase[dbKey]) {
      window.cardDatabase[dbKey] = { '默认分组': [] };
    }
    var obj = window.cardDatabase[dbKey];
    if (Array.isArray(obj)) {
      var migrated = { '默认分组': obj.slice() };
      window.cardDatabase[dbKey] = migrated;
      if (window.cardDatabase.persist) window.cardDatabase.persist();
      return migrated;
    }
    if (!isGroupObject(obj)) {
      window.cardDatabase[dbKey] = { '默认分组': [] };
      if (window.cardDatabase.persist) window.cardDatabase.persist();
    }
    return window.cardDatabase[dbKey];
  }

  // ==================== 全局 API ====================

  function getGroupsOf(category) {
    var obj = getGroupObject(category);
    return Object.keys(obj);
  }

  window.getGroups = function (category) {
    return getGroupsOf(category || 'reply');
  };

  function getCardsInGroupOf(category, groupName) {
    var obj = getGroupObject(category);
    return obj[groupName] || [];
  }

  window.getCardsInGroup = function (groupName, category) {
    return getCardsInGroupOf(category || 'reply', groupName);
  };

  window.getGroupColor = function (groupName, category) {
    var cat = category || 'reply';
    if (cat === 'kaomoji') cat = 'pat';
    var meta = groupsMeta[cat] || {};
    return (meta[groupName] && meta[groupName].color) || DEFAULT_COLORS[0];
  };

  window.addGroup = function (name, color, category) {
    if (!name || typeof name !== 'string') return false;
    var cat = category || 'reply';
    if (cat === 'kaomoji') cat = 'pat';
    var obj = getGroupObject(cat);
    if (obj[name]) return false;

    obj[name] = [];
    if (!groupsMeta[cat]) groupsMeta[cat] = {};
    groupsMeta[cat][name] = { color: color || DEFAULT_COLORS[Object.keys(obj).length % DEFAULT_COLORS.length] };

    if (window.cardDatabase && window.cardDatabase.persist) {
      window.cardDatabase.persist();
    }
    persistAll();
    return true;
  };

  window.renameGroup = function (oldName, newName, category) {
    if (!oldName || !newName) return false;
    var cat = category || 'reply';
    if (cat === 'kaomoji') cat = 'pat';
    var obj = getGroupObject(cat);
    if (!obj[oldName]) return false;
    if (obj[newName]) return false;

    var newObj = {};
    Object.keys(obj).forEach(function (key) {
      if (key === oldName) {
        newObj[newName] = obj[oldName];
      } else {
        newObj[key] = obj[key];
      }
    });

    if (groupsMeta[cat] && groupsMeta[cat][oldName]) {
      groupsMeta[cat][newName] = groupsMeta[cat][oldName];
      delete groupsMeta[cat][oldName];
    }

    if (currentGroupMap[cat] === oldName) {
      currentGroupMap[cat] = newName;
    }

    var dbKey = cat;
    if (cat === 'place') dbKey = 'location';
    window.cardDatabase[dbKey] = newObj;
    if (window.cardDatabase.persist) window.cardDatabase.persist();
    persistAll();
    return true;
  };

  window.deleteGroup = function (name, category) {
    if (!name) return false;
    var cat = category || 'reply';
    if (cat === 'kaomoji') cat = 'pat';
    var obj = getGroupObject(cat);
    if (!obj[name]) return false;
    if (Object.keys(obj).length <= 1) return false;

    delete obj[name];
    if (groupsMeta[cat]) delete groupsMeta[cat][name];

    if (currentGroupMap[cat] === name) {
      var remaining = Object.keys(obj);
      currentGroupMap[cat] = remaining[0] || '默认分组';
    }

    if (window.cardDatabase && window.cardDatabase.persist) {
      window.cardDatabase.persist();
    }
    persistAll();
    return true;
  };

  window.addCardToGroup = function (groupName, text, category) {
    if (!groupName || !text) return false;
    var cat = category || 'reply';
    if (cat === 'kaomoji') cat = 'pat';
    var obj = getGroupObject(cat);
    if (!obj[groupName]) obj[groupName] = [];
    if (autoDedup && obj[groupName].indexOf(text) >= 0) return false;
    obj[groupName].push(text);

    if (window.cardDatabase && window.cardDatabase.persist) {
      window.cardDatabase.persist();
    }
    persistAll();
    return true;
  };

  window.removeCardFromGroup = function (groupName, text, category) {
    if (!groupName || !text) return false;
    var cat = category || 'reply';
    if (cat === 'kaomoji') cat = 'pat';
    var obj = getGroupObject(cat);
    if (!obj[groupName]) return false;
    var idx = obj[groupName].indexOf(text);
    if (idx < 0) return false;
    obj[groupName].splice(idx, 1);

    if (window.cardDatabase && window.cardDatabase.persist) {
      window.cardDatabase.persist();
    }
    persistAll();
    return true;
  };

  window.getCurrentGroup = function (category) {
    var cat = category || 'reply';
    if (cat === 'kaomoji') cat = 'pat';
    return currentGroupMap[cat] || '默认分组';
  };
  window.setCurrentGroup = function (groupName, category) {
    var cat = category || 'reply';
    if (cat === 'kaomoji') cat = 'pat';
    var obj = getGroupObject(cat);
    if (obj[groupName]) {
      currentGroupMap[cat] = groupName;
      persistAll();
      return true;
    }
    return false;
  };

  // ==================== 兼容旧 card.js 的接口 ====================
  function getDB(category) {
    if (!window.cardDatabase || !window.cardDatabase.ready) return [];
    if (category === 'emoji' || category === 'status') {
      return window.cardDatabase.get(category) || [];
    }
    var cat = category === 'kaomoji' ? 'pat' : category;
    return getCardsInGroupOf(cat, currentGroupMap[cat] || '默认分组');
  }

  // ==================== 兼容旧数据迁移 ====================
  var migratedOnce = false;
  function migrateOldData() {
    if (migratedOnce) return;
    if (!window.cardDatabase || !window.cardDatabase.ready) return;

    // 1. 把旧的 reply 数组迁移为分组对象
    if (Array.isArray(window.cardDatabase.reply)) {
      window.cardDatabase.reply = { '默认分组': window.cardDatabase.reply.slice() };
    } else if (!isGroupObject(window.cardDatabase.reply)) {
      window.cardDatabase.reply = { '默认分组': [] };
    }

    // 2. 拍一拍
    if (window.cardDatabase.pat) {
      if (Array.isArray(window.cardDatabase.pat)) {
        window.cardDatabase.pat = { '默认分组': window.cardDatabase.pat.slice() };
      } else if (!isGroupObject(window.cardDatabase.pat)) {
        window.cardDatabase.pat = { '默认分组': [] };
      }
    } else if (window.cardDatabase.emoji) {
      var oldEmoji = window.cardDatabase.emoji;
      if (Array.isArray(oldEmoji)) {
        window.cardDatabase.pat = { '默认分组': oldEmoji.slice() };
      } else if (isGroupObject(oldEmoji)) {
        window.cardDatabase.pat = JSON.parse(JSON.stringify(oldEmoji));
      } else {
        window.cardDatabase.pat = { '默认分组': [] };
      }
    } else {
      window.cardDatabase.pat = { '默认分组': [] };
    }

    // 3. place / mood
    ['place', 'mood'].forEach(function (cat) {
      var key = cat === 'place' ? KEY_PLACE : KEY_MOOD;
      var dbKey = (cat === 'place') ? 'location' : cat;
      if (!window.cardDatabase[dbKey]) {
        try {
          var raw = localStorage.getItem(key);
          if (raw) {
            var data = JSON.parse(raw);
            if (Array.isArray(data)) {
              window.cardDatabase[dbKey] = { '默认分组': data.slice() };
              localStorage.removeItem(key);
            }
          }
        } catch (e) {}
        if (!window.cardDatabase[dbKey]) {
          window.cardDatabase[dbKey] = { '默认分组': [] };
        }
      } else if (Array.isArray(window.cardDatabase[dbKey])) {
        window.cardDatabase[dbKey] = { '默认分组': window.cardDatabase[dbKey].slice() };
      }
    });

    // 4. 默认分组颜色
    ['reply', 'pat', 'place', 'mood'].forEach(function (cat) {
      if (!groupsMeta[cat]) groupsMeta[cat] = {};
      var obj = getGroupObject(cat);
      Object.keys(obj).forEach(function (g, idx) {
        if (!groupsMeta[cat][g]) {
          groupsMeta[cat][g] = { color: DEFAULT_COLORS[idx % DEFAULT_COLORS.length] };
        }
      });
    });

    if (window.cardDatabase.persist) window.cardDatabase.persist();
    persistAll();

    migratedOnce = true;
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
  let simpleModalMode = 'add';
  let simpleModalCategory = 'reply';

  function openSimpleModal(mode, title, placeholder, category) {
    simpleModalMode = mode;
    simpleModalCategory = category || 'reply';
    simpleModalTitleText.textContent = title;
    simpleModalInput.value = '';
    simpleModalInput.placeholder = placeholder || '输入内容...';
    simpleModal.classList.add('active');
    setTimeout(function () { simpleModalInput.focus(); }, 100);
    showGroupSelectorInModal(simpleModalCategory);
  }
  function closeSimpleModal() { simpleModal.classList.remove('active'); }

  if (simpleModalCancel) simpleModalCancel.addEventListener('click', closeSimpleModal);
  if (simpleModal) {
    simpleModal.addEventListener('click', function (e) {
      if (e.target === simpleModal) closeSimpleModal();
    });
  }

  // ==================== 统一添加逻辑 ====================
  function addTextToCategory(category, texts, groupName) {
    if (!window.cardDatabase || !window.cardDatabase.ready) return;

    var cat = category === 'kaomoji' ? 'pat' : category;

    if (cat === 'reply' || cat === 'pat' || cat === 'place' || cat === 'mood') {
      var target = groupName || currentGroupMap[cat] || '默认分组';
      texts.forEach(function (t) {
        window.addCardToGroup(target, t, cat);
      });
      currentGroupMap[cat] = target;
    } else if (cat === 'emoji') {
      window.cardDatabase.addMany('sticker', texts, autoDedup);
    } else if (cat === 'status') {
      if (!window.cardDatabase.status) window.cardDatabase.status = [];
      texts.forEach(function (t) {
        if (autoDedup && window.cardDatabase.status.indexOf(t) >= 0) return;
        window.cardDatabase.status.push(t);
      });
      if (window.cardDatabase.persist) window.cardDatabase.persist();
    }
  }

  // ==================== 弹窗内的分组选择器 ====================
  function showGroupSelectorInModal(category) {
    var cat = category === 'kaomoji' ? 'pat' : category;

    if (cat === 'emoji' || cat === 'status') {
      var existing = document.getElementById('modalGroupSelector');
      if (existing) existing.style.display = 'none';
      return;
    }

    var container = document.getElementById('modalGroupSelector');
    if (!container) {
      container = document.createElement('div');
      container.id = 'modalGroupSelector';
      container.className = 'modal-group-selector';

      var simplePanel = document.querySelector('#simpleModal .simple-panel');
      if (simplePanel) {
        var actions = simplePanel.querySelector('.simple-actions');
        if (actions) {
          simplePanel.insertBefore(container, actions);
        } else {
          simplePanel.appendChild(container);
        }
      }
    }

    container.style.display = 'block';
    container.innerHTML = '';

    var label = document.createElement('div');
    label.className = 'modal-group-label';
    label.textContent = '添加到分组';
    container.appendChild(label);

    var selectWrap = document.createElement('div');
    selectWrap.className = 'modal-group-select-wrap';

    var selectBtn = document.createElement('button');
    selectBtn.type = 'button';
    selectBtn.className = 'modal-group-select-btn';
    selectBtn.id = 'modalGroupSelectBtn';

    var currentGroupName = currentGroupMap[cat] || '默认分组';
    var currentColor = window.getGroupColor(currentGroupName, cat);

    selectBtn.innerHTML =
      '<span class="modal-group-color-dot" style="background:' + currentColor + '"></span>' +
      '<span class="modal-group-name-text" id="modalGroupNameText">' + escapeHtml(currentGroupName) + '</span>' +
      '<i class="fa-solid fa-chevron-down modal-group-arrow"></i>';

    selectWrap.appendChild(selectBtn);

    var dropdown = document.createElement('div');
    dropdown.className = 'modal-group-dropdown';
    dropdown.id = 'modalGroupDropdown';

    var groups = window.getGroups(cat);
    var noGroupItem = document.createElement('div');
    noGroupItem.className = 'modal-group-item' + (currentGroupName === '默认分组' ? ' active' : '');
    noGroupItem.setAttribute('data-group', '默认分组');
    noGroupItem.innerHTML =
      '<span class="modal-group-color-dot" style="background:' + window.getGroupColor('默认分组', cat) + '"></span>' +
      '<span class="modal-group-name-text">不分组（默认分组）</span>';
    dropdown.appendChild(noGroupItem);

    groups.forEach(function (g) {
      if (g === '默认分组') return;
      var item = document.createElement('div');
      item.className = 'modal-group-item' + (currentGroupName === g ? ' active' : '');
      item.setAttribute('data-group', escapeAttr(g));
      item.innerHTML =
        '<span class="modal-group-color-dot" style="background:' + window.getGroupColor(g, cat) + '"></span>' +
        '<span class="modal-group-name-text">' + escapeHtml(g) + '</span>';
      dropdown.appendChild(item);
    });

    selectWrap.appendChild(dropdown);
    container.appendChild(selectWrap);

    selectBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      dropdown.classList.toggle('active');
    });

    dropdown.querySelectorAll('.modal-group-item').forEach(function (item) {
      item.addEventListener('click', function (e) {
        e.stopPropagation();
        var name = item.getAttribute('data-group');
        currentGroupMap[cat] = name;
        selectBtn.querySelector('#modalGroupNameText').textContent = name;
        var colorDot = selectBtn.querySelector('.modal-group-color-dot');
        if (colorDot) colorDot.style.background = window.getGroupColor(name, cat);
        dropdown.querySelectorAll('.modal-group-item').forEach(function (i) {
          i.classList.remove('active');
        });
        item.classList.add('active');
        dropdown.classList.remove('active');
      });
    });

    if (!container.dataset.bound) {
      container.dataset.bound = '1';
      document.addEventListener('click', function () {
        var dd = document.getElementById('modalGroupDropdown');
        if (dd) dd.classList.remove('active');
      });
    }
  }

  // ==================== 确认添加 ====================
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
  function renderTextList(container, placeholderEl, arr, searchInput, category, groupName) {
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
        var cat = category === 'kaomoji' ? 'pat' : category;
        window.removeCardFromGroup(groupName, text, cat);
        updateAllUI();
      });
      item.appendChild(textEl);
      item.appendChild(del);
      container.appendChild(item);
    });
  }

  function renderEmojiGrid() {
    if (!emojiGrid) return;
    const stickerArr = (window.cardDatabase.get('sticker')) || [];
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

    var cat = 'reply';
    var groups = window.getGroups(cat);

    if (groups.indexOf(currentGroupMap[cat]) < 0) {
      currentGroupMap[cat] = groups[0] || '默认分组';
    }

    groupSelect.innerHTML = '';
    groups.forEach(function (name) {
      var opt = document.createElement('option');
      opt.value = name;
      var count = window.getCardsInGroup(name, cat).length;
      opt.textContent = name + ' · ' + count + ' 条';
      if (name === currentGroupMap[cat]) opt.selected = true;
      groupSelect.appendChild(opt);
    });
  }

  if (groupSelect) {
    groupSelect.addEventListener('change', function () {
      currentGroupMap['reply'] = groupSelect.value;
      updateAllUI();
    });
  }

  // ==================== 更新所有 UI ====================
  function updateAllUI() {
    if (!window.cardDatabase) return;

    var replyGroups = getGroupObject('reply');
    var patGroups = getGroupObject('pat');
    var placeGroups = getGroupObject('place');
    var moodGroups = getGroupObject('mood');

    var replyTotal = 0, patTotal = 0, placeTotal = 0, moodTotal = 0;
    Object.keys(replyGroups).forEach(function (g) { replyTotal += replyGroups[g].length; });
    Object.keys(patGroups).forEach(function (g) { patTotal += patGroups[g].length; });
    Object.keys(placeGroups).forEach(function (g) { placeTotal += placeGroups[g].length; });
    Object.keys(moodGroups).forEach(function (g) { moodTotal += moodGroups[g].length; });

    var stickerTotal = (window.cardDatabase.get('sticker') || []).length;
    var statusTotal = (window.cardDatabase.status || []).length;

    if (badges.reply) badges.reply.textContent = replyTotal;
    if (badges.pat) badges.pat.textContent = patTotal;
    if (badges.place) badges.place.textContent = placeTotal;
    if (badges.mood) badges.mood.textContent = moodTotal;
    if (badges.emoji) badges.emoji.textContent = stickerTotal;
    if (badges.status) badges.status.textContent = statusTotal;

    if (cardStatusCounts) {
      cardStatusCounts.textContent = replyTotal + ' 条回复 · ' +
        stickerTotal + ' 个表情 · ' +
        placeTotal + ' 个地点 · ' +
        moodTotal + ' 种心情';
    }

    updateGroupSelect();

    var replyCurrentGroup = currentGroupMap.reply || '默认分组';
    renderTextList(
      cardList, cardListPlaceholder,
      window.getCardsInGroup(replyCurrentGroup, 'reply'),
      cardSearchInput, 'reply', replyCurrentGroup
    );

    var patCurrentGroup = currentGroupMap.pat || '默认分组';
    renderTextList(
      patList, patPlaceholder,
      window.getCardsInGroup(patCurrentGroup, 'pat'),
      patSearchInput, 'pat', patCurrentGroup
    );

    var placeCurrentGroup = currentGroupMap.place || '默认分组';
    renderTextList(
      placeList, placePlaceholder,
      window.getCardsInGroup(placeCurrentGroup, 'place'),
      placeSearchInput, 'place', placeCurrentGroup
    );

    var moodCurrentGroup = currentGroupMap.mood || '默认分组';
    renderTextList(
      moodList, moodPlaceholder,
      window.getCardsInGroup(moodCurrentGroup, 'mood'),
      moodSearchInput, 'mood', moodCurrentGroup
    );

    renderTextList(statusList, statusPlaceholder,
      (window.cardDatabase.status || []),
      statusSearchInput, 'status', null
    );

    renderEmojiGrid();
  }

  // ==================== 回复面板事件 ====================
  if (btnAddCard) btnAddCard.addEventListener('click', function () {
    openSimpleModal('add', '添加回复字卡', '输入一句话...', 'reply');
  });
  if (btnImport) btnImport.addEventListener('click', function () {
    openSimpleModal('import', '导入回复字卡', '批量添加回复（每行一条，自动去重）', 'reply');
  });
  if (btnExport) btnExport.addEventListener('click', function () {
    var currentGroup = currentGroupMap.reply || '默认分组';
    var cards = window.getCardsInGroup(currentGroup, 'reply');
    if (cards.length === 0) { alert('当前分组没有字卡可导出'); return; }
    var data = {};
    data[currentGroup] = cards;
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'reply_cards_' + currentGroup + '.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
  if (dedupNowBtn) dedupNowBtn.addEventListener('click', function () {
    var obj = getGroupObject('reply');
    var currentGroup = currentGroupMap.reply || '默认分组';
    if (!obj[currentGroup]) return;
    var before = obj[currentGroup].length;
    obj[currentGroup] = deduplicate(obj[currentGroup]);
    if (window.cardDatabase.persist) window.cardDatabase.persist();
    persistAll();
    updateAllUI();
    var after = obj[currentGroup].length;
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

  // ==================== 拍一拍/地点/心情/状态 操作栏 ====================
  function bindCategoryButtons(cat, prefix) {
    var addBtn = document.getElementById(prefix + 'AddBtn');
    var importBtn = document.getElementById(prefix + 'ImportBtn');
    var exportBtn = document.getElementById(prefix + 'ExportBtn');

    if (addBtn) addBtn.addEventListener('click', function () {
      openSimpleModal('add', '添加' + categoryTitle(cat) + '字卡', '输入一句话...', cat);
    });
    if (importBtn) importBtn.addEventListener('click', function () {
      openSimpleModal('import', '导入' + categoryTitle(cat) + '字卡', '批量添加（每行一条，自动去重）', cat);
    });
    if (exportBtn) exportBtn.addEventListener('click', function () {
      var currentGroup = currentGroupMap[cat] || '默认分组';
      var cards = window.getCardsInGroup(currentGroup, cat);
      if (cards.length === 0) { alert('当前分组没有内容可导出'); return; }
      var data = {};
      data[currentGroup] = cards;
      var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = cat + '_cards_' + currentGroup + '.json';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  function categoryTitle(cat) {
    var map = { reply: '回复', pat: '拍一拍', place: '地点', mood: '心情', emoji: '表情包', status: '状态' };
    return map[cat] || cat;
  }

  bindCategoryButtons('pat', 'pat');
  bindCategoryButtons('place', 'place');
  bindCategoryButtons('mood', 'mood');

  // ==================== 搜索框 ====================
  if (patSearchInput) patSearchInput.addEventListener('input', updateAllUI);
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
    const stickerArr = (window.cardDatabase.get('sticker')) || [];
    if (stickerArr.length === 0) { alert('没有表情包可导出'); return; }
    const blob = new Blob([JSON.stringify(stickerArr, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'emoji_cards.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
  if (emojiSearchInput) emojiSearchInput.addEventListener('input', renderEmojiGrid);
  if (emojiNewGroupBtn) emojiNewGroupBtn.addEventListener('click', function () {
    openNewGroupModal('emoji');
  });
  if (emojiAllGroupBtn) emojiAllGroupBtn.addEventListener('click', function () { alert('已显示全部分组'); });
  if (emojiOrganizeBtn) emojiOrganizeBtn.addEventListener('click', function () {
    const before = (window.cardDatabase.get('sticker') || []).length;
    window.cardDatabase.deduplicate('sticker');
    const after = (window.cardDatabase.get('sticker') || []).length;
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
    var statusArr = window.cardDatabase.status || [];
    if (statusArr.length === 0) { alert('没有状态可导出'); return; }
    const blob = new Blob([JSON.stringify(statusArr, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'status_cards.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
  if (statusNewGroupBtn) statusNewGroupBtn.addEventListener('click', function () { alert('分组功能开发中'); });
  if (statusOrganizeBtn) statusOrganizeBtn.addEventListener('click', function () {
    var statusArr = window.cardDatabase.status || [];
    var before = statusArr.length;
    window.cardDatabase.status = deduplicate(statusArr);
    if (window.cardDatabase.persist) window.cardDatabase.persist();
    updateAllUI();
    alert(before - window.cardDatabase.status.length > 0 ? '已去除 ' + (before - window.cardDatabase.status.length) + ' 条重复' : '没有重复');
  });

  // ==================== 新建分组弹窗 ====================
  var newGroupModal = null;
  var newGroupCategory = 'reply';

  function openNewGroupModal(category) {
    newGroupCategory = category || 'reply';
    if (newGroupCategory === 'kaomoji') newGroupCategory = 'pat';

    if (!newGroupModal) {
      newGroupModal = document.createElement('div');
      newGroupModal.id = 'newGroupModal';
      newGroupModal.className = 'new-group-modal';
      newGroupModal.innerHTML =
        '<div class="new-group-panel">' +
        '  <div class="new-group-title">新建分组</div>' +

        '  <div class="new-group-label">LABEL</div>' +
        '  <input type="text" class="new-group-input" id="newGroupName" placeholder="分组名称...">' +

        '  <div class="new-group-label">COLOR PRESET</div>' +
        '  <div class="new-group-colors" id="newGroupColors"></div>' +

        '  <div class="new-group-label">CUSTOM COLOR</div>' +
        '  <div class="new-group-custom">' +
        '    <input type="color" class="new-group-color-picker" id="newGroupColorPicker" value="#5C7CFA">' +
        '    <input type="text" class="new-group-hex-input" id="newGroupHexInput" placeholder="#5C7CFA" maxlength="7">' +
        '    <button class="new-group-preview-btn" id="newGroupPreviewBtn">预览</button>' +
        '  </div>' +

        '  <div class="new-group-actions">' +
        '    <button class="new-group-btn new-group-cancel" id="newGroupCancel">取消</button>' +
        '    <button class="new-group-btn new-group-confirm" id="newGroupConfirm">保存</button>' +
        '  </div>' +
        '</div>';

      document.body.appendChild(newGroupModal);

      var colorsContainer = newGroupModal.querySelector('#newGroupColors');
      var initialColor = '#5C7CFA';
      DEFAULT_COLORS.forEach(function (color, idx) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'new-group-color-btn' + (color === initialColor ? ' active' : '');
        btn.style.background = color;
        btn.setAttribute('data-color', color);
        btn.addEventListener('click', function () {
          colorsContainer.querySelectorAll('.new-group-color-btn').forEach(function (b) {
            b.classList.remove('active');
          });
          btn.classList.add('active');
          newGroupModal.querySelector('#newGroupColorPicker').value = color;
          newGroupModal.querySelector('#newGroupHexInput').value = color;
        });
        colorsContainer.appendChild(btn);
      });

      var picker = newGroupModal.querySelector('#newGroupColorPicker');
      var hexInput = newGroupModal.querySelector('#newGroupHexInput');
      picker.addEventListener('input', function () {
        hexInput.value = picker.value.toUpperCase();
        colorsContainer.querySelectorAll('.new-group-color-btn').forEach(function (b) {
          b.classList.remove('active');
        });
      });
      hexInput.addEventListener('input', function () {
        var v = hexInput.value.trim();
        if (/^#[0-9A-Fa-f]{6}$/.test(v)) {
          picker.value = v;
        }
      });

      newGroupModal.querySelector('#newGroupPreviewBtn').addEventListener('click', function () {
        var v = hexInput.value.trim();
        if (!/^#[0-9A-Fa-f]{6}$/.test(v)) { alert('请输入有效的 HEX 颜色，如 #5C7CFA'); return; }
        picker.value = v;
      });

      newGroupModal.querySelector('#newGroupCancel').addEventListener('click', function () {
        newGroupModal.classList.remove('active');
      });
      newGroupModal.addEventListener('click', function (e) {
        if (e.target === newGroupModal) newGroupModal.classList.remove('active');
      });

      newGroupModal.querySelector('#newGroupConfirm').addEventListener('click', function () {
        var name = newGroupModal.querySelector('#newGroupName').value.trim();
        if (!name) { alert('请输入分组名称'); return; }
        var color = newGroupModal.querySelector('#newGroupHexInput').value.trim() || '#5C7CFA';

        var success = window.addGroup(name, color, newGroupCategory);
        if (!success) {
          alert('分组已存在或名称无效');
          return;
        }

        newGroupModal.classList.remove('active');
        updateAllUI();

        if (window.chatSettingsPanel && window.chatSettingsPanel.refreshGroupCheckboxes) {
          window.chatSettingsPanel.refreshGroupCheckboxes();
        }
      });
    }

    newGroupModal.querySelector('#newGroupName').value = '';
    newGroupModal.querySelector('#newGroupColorPicker').value = '#5C7CFA';
    newGroupModal.querySelector('#newGroupHexInput').value = '#5C7CFA';
    var colorsContainer2 = newGroupModal.querySelector('#newGroupColors');
    colorsContainer2.querySelectorAll('.new-group-color-btn').forEach(function (b, idx) {
      b.classList.toggle('active', idx === 0);
    });

    newGroupModal.classList.add('active');
  }

  function bindNewGroupButton(btnId, category) {
    var btn = document.getElementById(btnId);
    if (btn) {
      btn.addEventListener('click', function (e) {
        e.stopImmediatePropagation();
        openNewGroupModal(category);
      }, true);
    }
  }

  bindNewGroupButton('btnNewGroup', 'reply');
  bindNewGroupButton('patNewGroupBtn', 'pat');
  bindNewGroupButton('placeNewGroupBtn', 'place');
  bindNewGroupButton('moodNewGroupBtn', 'mood');

  function bindRenameButton(btnId, category) {
    var btn = document.getElementById(btnId);
    if (!btn) return;
    btn.addEventListener('click', function (e) {
      e.stopImmediatePropagation();
      var currentGroup = currentGroupMap[category] || '默认分组';
      var newName = prompt('重命名分组「' + currentGroup + '」为：');
      if (!newName) return;
      newName = newName.trim();
      if (!newName) return;
      if (newName === currentGroup) return;

      var success = window.renameGroup(currentGroup, newName, category);
      if (!success) {
        alert('重命名失败，可能新名称已存在');
        return;
      }
      updateAllUI();
      if (window.chatSettingsPanel && window.chatSettingsPanel.refreshGroupCheckboxes) {
        window.chatSettingsPanel.refreshGroupCheckboxes();
      }
    }, true);
  }

  bindRenameButton('btnRenameGroup', 'reply');
  bindRenameButton('patRenameGroupBtn', 'pat');
  bindRenameButton('placeRenameGroupBtn', 'place');
  bindRenameButton('moodRenameGroupBtn', 'mood');

  // ==================== 暴露给外部 ====================
  window.getReplyCards = function () {
    var obj = getGroupObject('reply');
    var all = [];
    Object.keys(obj).forEach(function (g) {
      all = all.concat(obj[g] || []);
    });
    return all;
  };
  window.getPatCards = function () {
    var obj = getGroupObject('pat');
    var all = [];
    Object.keys(obj).forEach(function (g) {
      all = all.concat(obj[g] || []);
    });
    return all;
  };
  window.getKaomojiCards = window.getPatCards;
  window.getEmojiCards = function () {
    return window.cardDatabase.get('sticker') || [];
  };

  // 关键修复：不再重复跑迁移，只刷新 UI
  window.refreshCardUI = function () {
    if (!window.cardDatabase || !window.cardDatabase.ready) {
      window.addEventListener('cardDatabaseReady', function () {
        updateAllUI();
      });
      return;
    }
    updateAllUI();
  };

  // ==================== 初始化 ====================
  var inited = false;
  function init() {
    if (inited) return;
    inited = true;

    if (!window.cardDatabase) {
      window.addEventListener('cardDatabaseReady', function () {
        loadGroupsMeta(function () {
          migrateOldData();
          updateAllUI();
        });
      });
      return;
    }
    if (!window.cardDatabase.ready) {
      window.addEventListener('cardDatabaseReady', function () {
        loadGroupsMeta(function () {
          migrateOldData();
          updateAllUI();
        });
      });
      return;
    }
    loadGroupsMeta(function () {
      migrateOldData();
      updateAllUI();
    });
  }

  init();

  window.addEventListener('cardDatabaseReady', function () {
    if (!inited) return;
    loadGroupsMeta(function () {
      // 迁移只跑一次，由 migratedOnce 控制
      migrateOldData();
      updateAllUI();
    });
  });

})();

/* ============================================================
   card.js 追加块 —— 分类切换 / 整理模式
   （统一走主块的 cardDatabase 接口，不再单独读写 localStorage）
   ============================================================ */
(function () {
  'use strict';

  var currentCat = 'reply';
  var organizeMode = false;
  var selectedSet = new Set();

  // ==================== 统一从主块接口读数据 ====================
  function getList(cat) {
    if (typeof window.getGroups !== 'function' || typeof window.getCardsInGroup !== 'function') {
      return [];
    }
    var realCat = cat === 'kaomoji' ? 'pat' : cat;
    var groups = window.getGroups(realCat) || [];
    var all = [];
    groups.forEach(function (g) {
      var arr = window.getCardsInGroup(g, realCat) || [];
      all = all.concat(arr);
    });
    return all;
  }

  // ==================== 删除指定文本（统一走主块） ====================
  function removeTexts(cat, textsToRemove) {
    var realCat = cat === 'kaomoji' ? 'pat' : cat;
    var set = new Set(textsToRemove);
    if (typeof window.getGroups !== 'function') return;

    var groups = window.getGroups(realCat) || [];
    groups.forEach(function (g) {
      var arr = window.getCardsInGroup(g, realCat) || [];
      // 倒序删除，避免 index 错位
      for (var i = arr.length - 1; i >= 0; i--) {
        if (set.has(arr[i])) {
          window.removeCardFromGroup(g, arr[i], realCat);
        }
      }
    });
  }

  // ==================== 清空整个分组 ====================
  function clearCurrentGroup(cat) {
    var realCat = cat === 'kaomoji' ? 'pat' : cat;
    var currentGroup = window.getCurrentGroup(realCat) || '默认分组';
    var arr = window.getCardsInGroup(currentGroup, realCat) || [];
    // 倒序删
    for (var i = arr.length - 1; i >= 0; i--) {
      window.removeCardFromGroup(currentGroup, arr[i], realCat);
    }
  }

  // ==================== 分类按钮点击 ====================
  document.querySelectorAll('.cat-grid-item').forEach(function (item) {
    item.addEventListener('click', function () {
      var cat = item.getAttribute('data-cat');
      currentCat = cat;
      organizeMode = false;
      selectedSet.clear();
      updateOrganizeUI();
      updateSearchPlaceholder();
    });
  });

  // ==================== 搜索框占位符 ====================
  function updateSearchPlaceholder() {
    var map = {
      reply: '找一句话、一种心情...',
      pat: '找一句拍一拍...',
      place: '找一个熟悉的地方...',
      mood: '找一句话、一种心情...',
      emoji: '搜索图片名称',
      status: '搜索状态...'
    };
    var inputs = ['cardSearchInput', 'patSearchInput', 'placeSearchInput', 'moodSearchInput', 'emojiSearchInput', 'statusSearchInput'];
    inputs.forEach(function (id) {
      var el = document.getElementById(id);
      if (el && map[currentCat]) el.placeholder = map[currentCat];
    });
  }

  // ==================== 整理模式 ====================
  function toggleOrganize(cat) {
    if (organizeMode && currentCat === cat) {
      organizeMode = false;
    } else {
      organizeMode = true;
      currentCat = cat;
    }
    selectedSet.clear();
    updateOrganizeUI();
    rebindCardEvents();
  }

  function updateOrganizeUI() {
    document.querySelectorAll('.organize-bar').forEach(function (b) { b.classList.remove('active'); });
    document.querySelectorAll('.word-card-item, .emoji-grid-item').forEach(function (c) {
      c.classList.remove('organizing', 'selected');
    });

    if (!organizeMode) return;

    var bar = document.getElementById('organizeBar-' + currentCat);
    if (bar) bar.classList.add('active');

    var emojiGridEl = document.getElementById('emojiGrid');
    if (currentCat === 'emoji') {
      if (emojiGridEl) emojiGridEl.querySelectorAll('.emoji-grid-item').forEach(function (c) { c.classList.add('organizing'); });
    } else {
      var listMap = {
        reply: 'cardList',
        pat: 'patList',
        place: 'placeList',
        mood: 'moodList',
        status: 'statusList'
      };
      var el = document.getElementById(listMap[currentCat]);
      if (el) el.querySelectorAll('.word-card-item').forEach(function (c) { c.classList.add('organizing'); });
    }
    updateOrganizeCount();
  }

  function updateOrganizeCount() {
    var countEl = document.getElementById('organizeCount-' + currentCat);
    if (countEl) countEl.textContent = '已选 ' + selectedSet.size + ' 条';
  }

  // ==================== 整理栏注入 ====================
  function injectOrganizeBars() {
    var cats = ['reply', 'pat', 'place', 'mood', 'emoji', 'status'];
    cats.forEach(function (cat) {
      if (document.getElementById('organizeBar-' + cat)) return;

      var bar = document.createElement('div');
      bar.className = 'organize-bar';
      bar.id = 'organizeBar-' + cat;
      bar.innerHTML =
        '<div class="organize-count" id="organizeCount-' + cat + '">已选 0 条</div>' +
        '<button class="organize-btn" data-act="selectAll">全选筛选结果</button>' +
        '<button class="organize-btn danger" data-act="deleteSelected">删除所选</button>' +
        '<button class="organize-btn" data-act="deleteGroup">删除此分组</button>' +
        '<button class="organize-btn" data-act="exit">退出整理</button>';

      var panel = document.getElementById('panel-' + cat);
      if (panel) panel.insertBefore(bar, panel.firstChild);
    });

    document.querySelectorAll('.organize-bar').forEach(function (bar) {
      bar.addEventListener('click', function (e) {
        var btn = e.target.closest('.organize-btn');
        if (!btn) return;
        var act = btn.getAttribute('data-act');
        var cat = bar.id.replace('organizeBar-', '');

        if (act === 'selectAll') {
          var list = getList(cat);
          if (selectedSet.size === list.length) {
            selectedSet.clear();
          } else {
            selectedSet.clear();
            list.forEach(function (item) { selectedSet.add(item); });
          }
          updateOrganizeUI();
          applySelectedState();

        } else if (act === 'deleteSelected') {
          if (selectedSet.size === 0) { alert('请先选择要删除的内容'); return; }
          if (!confirm('确定删除选中的 ' + selectedSet.size + ' 条内容吗？')) return;
          removeTexts(cat, Array.from(selectedSet));
          selectedSet.clear();
          organizeMode = false;
          updateOrganizeUI();
          if (window.refreshCardUI) window.refreshCardUI();
          setTimeout(rebindCardEvents, 100);

        } else if (act === 'deleteGroup') {
          if (!confirm('确定删除当前分组的所有内容吗？')) return;
          clearCurrentGroup(cat);
          selectedSet.clear();
          organizeMode = false;
          updateOrganizeUI();
          if (window.refreshCardUI) window.refreshCardUI();
          setTimeout(rebindCardEvents, 100);

        } else if (act === 'exit') {
          organizeMode = false;
          selectedSet.clear();
          updateOrganizeUI();
        }
      });
    });
  }

  function applySelectedState() {
    if (!organizeMode) return;

    var listMap = {
      reply: 'cardList',
      pat: 'patList',
      place: 'placeList',
      mood: 'moodList',
      status: 'statusList'
    };
    var listEl = document.getElementById(listMap[currentCat]);
    if (listEl) {
      listEl.querySelectorAll('.word-card-item').forEach(function (card) {
        var textEl = card.querySelector('.word-card-text');
        if (!textEl) return;
        card.classList.toggle('selected', selectedSet.has(textEl.textContent));
      });
    }

    if (currentCat === 'emoji') {
      var grid = document.getElementById('emojiGrid');
      if (grid) {
        grid.querySelectorAll('.emoji-grid-item').forEach(function (item) {
          var img = item.querySelector('img');
          if (!img) return;
          item.classList.toggle('selected', selectedSet.has(img.src));
        });
      }
    }
  }

  // ==================== 给卡片注入勾选圆圈 ====================
  function rebindCardEvents() {
    document.querySelectorAll('.word-card-item').forEach(function (card) {
      if (card.querySelector('.select-circle')) return;
      var circle = document.createElement('div');
      circle.className = 'select-circle';
      card.insertBefore(circle, card.firstChild);

      card.addEventListener('click', function (e) {
        if (!organizeMode) return;
        if (e.target.closest('.word-card-delete')) return;
        var textEl = card.querySelector('.word-card-text');
        if (!textEl) return;
        var text = textEl.textContent;
        if (selectedSet.has(text)) {
          selectedSet.delete(text);
          card.classList.remove('selected');
        } else {
          selectedSet.add(text);
          card.classList.add('selected');
        }
        updateOrganizeCount();
      });
    });

    document.querySelectorAll('.emoji-grid-item').forEach(function (item) {
      if (item.querySelector('.emoji-select-circle')) return;
      var circle = document.createElement('div');
      circle.className = 'emoji-select-circle';
      item.appendChild(circle);

      item.addEventListener('click', function (e) {
        if (!organizeMode) return;
        if (e.target.closest('.emoji-delete')) return;
        var img = item.querySelector('img');
        if (!img) return;
        var src = img.src;
        if (selectedSet.has(src)) {
          selectedSet.delete(src);
          item.classList.remove('selected');
        } else {
          selectedSet.add(src);
          item.classList.add('selected');
        }
        updateOrganizeCount();
      });
    });
  }

  // ==================== 绑定「整理」按钮 ====================
  function bindOrganizeButtons() {
    var organizeMap = {
      btnOrganizeGroup: 'reply',
      patOrganizeBtn: 'pat',
      placeOrganizeBtn: 'place',
      moodOrganizeBtn: 'mood',
      emojiOrganizeBtn: 'emoji',
      statusOrganizeBtn: 'status'
    };
    Object.keys(organizeMap).forEach(function (id) {
      var btn = document.getElementById(id);
      if (btn && !btn.dataset.organized) {
        btn.dataset.organized = '1';
        btn.addEventListener('click', function (e) {
          e.stopImmediatePropagation();
          toggleOrganize(organizeMap[id]);
        }, true);
      }
    });
  }

  // ==================== MutationObserver：只重绑勾选事件，不再重跑迁移 ====================
  var observer = new MutationObserver(function () {
    rebindCardEvents();
    if (organizeMode) {
      updateOrganizeUI();
      applySelectedState();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // ==================== 初始化 ====================
  function init() {
    injectOrganizeBars();
    bindOrganizeButtons();
    updateSearchPlaceholder();
    rebindCardEvents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.rebindCardEvents = rebindCardEvents;

})();
