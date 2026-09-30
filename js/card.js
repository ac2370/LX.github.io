/**
 * 字卡管理 + 回复设定面板
 * - 管理 replyCards 数组（localStorage 持久化）
 * - 处理添加、导入、删除、去重
 * - 处理回复设定面板的所有输入/开关，持久化到 localStorage
 */

(function () {
  'use strict';

  // ==================== 全局字卡数据 ====================
  // 从 localStorage 读取，若无则预置测试数据
  function loadReplyCards() {
    try {
      const raw = localStorage.getItem('replyCards');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return arr;
      }
    } catch (e) {}
    // 预置测试数据
    return ['今天天气很好', '在想你', '刚刚看到一只小猫', '记得按时吃饭', '晚安，好梦'];
  }

  function saveReplyCards() {
    try {
      localStorage.setItem('replyCards', JSON.stringify(window.replyCards));
    } catch (e) {}
  }

  // 暴露到全局，供 chat.js 读取
  window.replyCards = loadReplyCards();

  // ==================== 回复设定默认值 ====================
  const DEFAULT_SETTINGS = {
    normalReply: true,
    minWait: 3,
    maxWait: 12,
    minCount: 0,
    maxCount: 3,
    kaomoji: false,
    typingBubble: true,
    readStatus: false,
    autoReply: false,
    commMinWait: 10,
    commMaxWait: 60,
    proactive: false,
    proactiveMin: 120,
    proactiveMax: 300,
    quote: true,
    reaction: true
  };

  function loadSettings() {
    try {
      const raw = localStorage.getItem('replySettings');
      if (raw) {
        const obj = JSON.parse(raw);
        return Object.assign({}, DEFAULT_SETTINGS, obj);
      }
    } catch (e) {}
    return Object.assign({}, DEFAULT_SETTINGS);
  }

  function saveSettings() {
    try {
      localStorage.setItem('replySettings', JSON.stringify(window.replySettings));
    } catch (e) {}
  }

  window.replySettings = loadSettings();

  // ==================== DOM 引用 ====================
  const cardList = document.getElementById('cardList');
  const cardListPlaceholder = document.getElementById('cardListPlaceholder');
  const cardStatusCounts = document.getElementById('cardStatusCounts');
  const cardSearchInput = document.getElementById('cardSearchInput');
  const groupSelect = document.getElementById('groupSelect');
  const badgeReply = document.getElementById('badgeReply');
  const badgeKaomoji = document.getElementById('badgeKaomoji');
  const badgePlace = document.getElementById('badgePlace');
  const badgeMood = document.getElementById('badgeMood');
  const badgeEmoji = document.getElementById('badgeEmoji');
  const badgeAlbum = document.getElementById('badgeAlbum');
  const dedupToggle = document.getElementById('dedupToggle');
  const dedupCheckbox = document.getElementById('dedupCheckbox');
  const dedupNowBtn = document.getElementById('dedupNowBtn');
  const btnAddCard = document.getElementById('btnAddCard');
  const btnImport = document.getElementById('btnImport');
  const btnExport = document.getElementById('btnExport');

  // 通用弹窗
  const simpleModal = document.getElementById('simpleModal');
  const simpleModalTitle = document.getElementById('simpleModalTitle');
  const simpleModalTextarea = document.getElementById('simpleModalTextarea');
  const simpleModalInput = document.getElementById('simpleModalInput');
  const simpleModalCancel = document.getElementById('simpleModalCancel');
  const simpleModalConfirm = document.getElementById('simpleModalConfirm');

  // ==================== 通用弹窗控制 ====================
  let modalMode = 'add'; // 'add' | 'import'
  let modalCallback = null;

  function openSimpleModal(mode, title, callback) {
    modalMode = mode;
    modalCallback = callback;
    simpleModalTitle.textContent = title;
    simpleModalTextarea.value = '';
    simpleModalInput.value = '';
    if (mode === 'add') {
      simpleModalTextarea.style.display = 'none';
      simpleModalInput.style.display = 'block';
      simpleModalInput.focus();
    } else {
      simpleModalTextarea.style.display = 'block';
      simpleModalInput.style.display = 'none';
      simpleModalTextarea.focus();
    }
    simpleModal.classList.add('active');
  }

  function closeSimpleModal() {
    simpleModal.classList.remove('active');
    modalCallback = null;
  }

  if (simpleModalCancel) {
    simpleModalCancel.addEventListener('click', closeSimpleModal);
  }
  if (simpleModal) {
    simpleModal.addEventListener('click', function (e) {
      if (e.target === simpleModal) closeSimpleModal();
    });
  }
  if (simpleModalConfirm) {
    simpleModalConfirm.addEventListener('click', function () {
      if (modalMode === 'add') {
        const text = simpleModalInput.value.trim();
        if (!text) { alert('请输入内容'); return; }
        if (modalCallback) modalCallback([text]);
      } else {
        const text = simpleModalTextarea.value.trim();
        if (!text) { alert('请输入内容'); return; }
        const lines = text.split('\n').map(function (l) { return l.trim(); }).filter(function (l) { return l; });
        if (lines.length === 0) { alert('请输入有效内容'); return; }
        if (modalCallback) modalCallback(lines);
      }
      closeSimpleModal();
    });
  }

  // ==================== 渲染字卡列表 ====================
  let searchKeyword = '';

  function renderCardList() {
    if (!cardList) return;
    const allCards = window.replyCards || [];
    let filtered = allCards;
    if (searchKeyword) {
      const kw = searchKeyword.toLowerCase();
      filtered = filtered.filter(function (c) {
        return String(c).toLowerCase().indexOf(kw) >= 0;
      });
    }

    // 渲染列表
    cardList.innerHTML = '';
    if (filtered.length === 0) {
      if (cardListPlaceholder) cardListPlaceholder.style.display = 'block';
    } else {
      if (cardListPlaceholder) cardListPlaceholder.style.display = 'none';
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
          if (confirm('确定删除这条字卡吗？')) {
            const idx = window.replyCards.indexOf(text);
            if (idx >= 0) {
              window.replyCards.splice(idx, 1);
              saveReplyCards();
              renderCardList();
              updateBadges();
            }
          }
        });

        item.appendChild(textEl);
        item.appendChild(del);
        cardList.appendChild(item);
      });
    }
  }

  // ==================== 更新角标和统计 ====================
  function updateBadges() {
    const total = (window.replyCards || []).length;
    if (badgeReply) badgeReply.textContent = total;
    if (badgeKaomoji) badgeKaomoji.textContent = 0;
    if (badgePlace) badgePlace.textContent = 0;
    if (badgeMood) badgeMood.textContent = 0;
    if (badgeEmoji) badgeEmoji.textContent = 0;
    if (badgeAlbum) badgeAlbum.textContent = 0;

    if (cardStatusCounts) {
      cardStatusCounts.textContent = total + ' 条回复 · 0 个表情 · 0 个地点 · 0 种心情';
    }
    if (groupSelect) {
      groupSelect.innerHTML = '<option>亲爱的的回复 · ' + total + ' 条</option>';
    }
  }

  // ==================== 添加字卡 ====================
  if (btnAddCard) {
    btnAddCard.addEventListener('click', function () {
      openSimpleModal('add', '添加字卡', function (lines) {
        lines.forEach(function (line) {
          window.replyCards.push(line);
        });
        if (dedupCheckbox && dedupCheckbox.classList.contains('checked')) {
          window.replyCards = deduplicate(window.replyCards);
        }
        saveReplyCards();
        renderCardList();
        updateBadges();
      });
    });
  }

  // ==================== 导入字卡（多行） ====================
  if (btnImport) {
    btnImport.addEventListener('click', function () {
      openSimpleModal('import', '导入字卡（每行一条）', function (lines) {
        lines.forEach(function (line) {
          window.replyCards.push(line);
        });
        if (dedupCheckbox && dedupCheckbox.classList.contains('checked')) {
          window.replyCards = deduplicate(window.replyCards);
        }
        saveReplyCards();
        renderCardList();
        updateBadges();
      });
    });
  }

  // ==================== 导出字卡 ====================
  if (btnExport) {
    btnExport.addEventListener('click', function () {
      const data = JSON.stringify(window.replyCards, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'reply_cards.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  // ==================== 去重 ====================
  function deduplicate(arr) {
    const seen = new Set();
    return arr.filter(function (item) {
      const key = String(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  if (dedupNowBtn) {
    dedupNowBtn.addEventListener('click', function () {
      const before = window.replyCards.length;
      window.replyCards = deduplicate(window.replyCards);
      const removed = before - window.replyCards.length;
      saveReplyCards();
      renderCardList();
      updateBadges();
      if (removed > 0) {
        alert('已去除 ' + removed + ' 条重复内容');
      } else {
        alert('没有重复内容');
      }
    });
  }

  if (dedupToggle) {
    dedupToggle.addEventListener('click', function () {
      if (dedupCheckbox) dedupCheckbox.classList.toggle('checked');
    });
  }

  // ==================== 搜索 ====================
  if (cardSearchInput) {
    cardSearchInput.addEventListener('input', function () {
      searchKeyword = cardSearchInput.value.trim();
      renderCardList();
    });
  }

  // ==================== 刷新接口 ====================
  window.refreshCardUI = function () {
    // 重新从 localStorage 读取
    try {
      const raw = localStorage.getItem('replyCards');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) window.replyCards = arr;
      }
    } catch (e) {}
    renderCardList();
    updateBadges();
  };

  // ==================== 回复设定面板逻辑 ====================
  (function () {
    const modal = document.getElementById('replySettingsModal');
    const openBtn = document.getElementById('cardEditBtn');
    const closeBtn = document.getElementById('replySettingsClose');

    function openModal() {
      modal.classList.add('active');
      syncSettingsToUI();
    }
    function closeModal() {
      modal.classList.remove('active');
    }

    if (openBtn) openBtn.addEventListener('click', openModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target === modal) closeModal();
      });
    }

    // 选项卡切换
    const tabBtns = document.querySelectorAll('.reply-tab-btn');
    const panels = {
      rhythm: document.getElementById('panel-rhythm'),
      proactive: document.getElementById('panel-proactive'),
      quote: document.getElementById('panel-quote')
    };

    tabBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        const tab = btn.getAttribute('data-tab');
        tabBtns.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        Object.keys(panels).forEach(function (key) {
          panels[key].classList.toggle('active', key === tab);
        });
      });
    });

    // 将设置同步到 UI
    function syncSettingsToUI() {
      const s = window.replySettings;
      setToggle('toggleNormalReply', s.normalReply);
      setInput('inputMinWait', s.minWait);
      setInput('inputMaxWait', s.maxWait);
      setInput('inputMinCount', s.minCount);
      setInput('inputMaxCount', s.maxCount);
      setToggle('toggleKaomoji', s.kaomoji);
      setToggle('toggleTypingBubble', s.typingBubble);
      setToggle('toggleReadStatus', s.readStatus);
      setToggle('toggleAutoReply', s.autoReply);
      setInput('inputCommMinWait', s.commMinWait);
      setInput('inputCommMaxWait', s.commMaxWait);
      setToggle('toggleProactive', s.proactive);
      setInput('inputProactiveMin', s.proactiveMin);
      setInput('inputProactiveMax', s.proactiveMax);
      setToggle('toggleQuote', s.quote);
      setToggle('toggleReaction', s.reaction);
    }

    function setToggle(id, val) {
      const el = document.getElementById(id);
      if (el) el.checked = !!val;
    }
    function setInput(id, val) {
      const el = document.getElementById(id);
      if (el) el.value = val;
    }

    // 绑定输入变化
    const toggleMap = {
      toggleNormalReply: 'normalReply',
      toggleKaomoji: 'kaomoji',
      toggleTypingBubble: 'typingBubble',
      toggleReadStatus: 'readStatus',
      toggleAutoReply: 'autoReply',
      toggleProactive: 'proactive',
      toggleQuote: 'quote',
      toggleReaction: 'reaction'
    };
    Object.keys(toggleMap).forEach(function (id) {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', function () {
          window.replySettings[toggleMap[id]] = el.checked;
          saveSettings();
          console.log('[回复设定] ' + id + ' =', el.checked);
        });
      }
    });

    const inputMap = {
      inputMinWait: 'minWait',
      inputMaxWait: 'maxWait',
      inputMinCount: 'minCount',
      inputMaxCount: 'maxCount',
      inputCommMinWait: 'commMinWait',
      inputCommMaxWait: 'commMaxWait',
      inputProactiveMin: 'proactiveMin',
      inputProactiveMax: 'proactiveMax'
    };
    Object.keys(inputMap).forEach(function (id) {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', function () {
          const v = parseFloat(el.value);
          if (!isNaN(v)) {
            window.replySettings[inputMap[id]] = v;
            saveSettings();
            console.log('[回复设定] ' + id + ' =', v);
          }
        });
      }
    });

    // 按钮
    const btnManageAutoReply = document.getElementById('btnManageAutoReply');
    if (btnManageAutoReply) {
      btnManageAutoReply.addEventListener('click', function () {
        console.log('[回复设定] 点击：管理自动回复字卡');
        alert('管理自动回复字卡功能开发中');
      });
    }
    const btnViewStatusCards = document.getElementById('btnViewStatusCards');
    if (btnViewStatusCards) {
      btnViewStatusCards.addEventListener('click', function () {
        console.log('[回复设定] 点击：查看角色状态卡片');
        alert('查看角色状态卡片功能开发中');
      });
    }
    const linkBackgroundKeep = document.getElementById('linkBackgroundKeep');
    if (linkBackgroundKeep) {
      linkBackgroundKeep.addEventListener('click', function (e) {
        e.preventDefault();
        console.log('[回复设定] 点击：后台保活与消息提醒');
        alert('后台保活与消息提醒功能开发中');
      });
    }

    // 初始化同步一次
    syncSettingsToUI();
  })();

  // ==================== 初始化 ====================
  renderCardList();
  updateBadges();

  // 监听 localStorage 外部变化
  window.addEventListener('storage', function (e) {
    if (e.key === 'replyCards') {
      try {
        const arr = JSON.parse(e.newValue || '[]');
        if (Array.isArray(arr)) {
          window.replyCards = arr;
          renderCardList();
          updateBadges();
        }
      } catch (err) {}
    }
  });

})();
