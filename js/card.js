/**
 * 字卡收纳盒逻辑
 * 负责 localStorage 读写、字卡增删、去重、搜索等
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'my_word_cards';

  // ==================== 数据读写 ====================
  function loadCards() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const data = JSON.parse(raw);
      if (!Array.isArray(data)) return [];
      // 兼容字符串和对象格式，统一转成对象 { text, category, createdAt }
      return data.map(function (item) {
        if (typeof item === 'string') {
          return { text: item, category: 'reply', createdAt: Date.now() };
        }
        if (item && typeof item === 'object') {
          return {
            text: item.text || item.content || '',
            category: item.category || 'reply',
            createdAt: item.createdAt || Date.now()
          };
        }
        return null;
      }).filter(function (item) { return item && item.text; });
    } catch (e) {
      return [];
    }
  }

  function saveCards(cards) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
    } catch (e) {
      console.warn('保存字卡失败', e);
    }
    // 触发 storage 事件（同页面手动触发）
    updateUI();
  }

  // ==================== 全局状态 ====================
  let cards = loadCards();
  let autoDedup = true;
  let currentCategory = 'reply';
  let searchKeyword = '';

  // ==================== DOM 引用 ====================
  const cardList = document.getElementById('cardList');
  const cardStatusBar = document.getElementById('cardStatusBar');
  const cardSearchInput = document.getElementById('cardSearchInput');
  const groupSelect = document.getElementById('groupSelect');
  const badgeReply = document.getElementById('badgeReply');
  const badgeKaomoji = document.getElementById('badgeKaomoji');
  const badgePlace = document.getElementById('badgePlace');
  const badgeMood = document.getElementById('badgeMood');
  const badgeEmoji = document.getElementById('badgeEmoji');
  const badgeAlbum = document.getElementById('badgeAlbum');
  const dedupCheckbox = document.getElementById('dedupCheckbox');
  const dedupToggle = document.getElementById('dedupToggle');
  const dedupNow = document.getElementById('dedupNow');
  const navMsgBadge = document.getElementById('navMsgBadge');

  // ==================== 添加字卡弹窗 ====================
  const wordAddModal = document.getElementById('wordAddModal');
  const wordAddInput = document.getElementById('wordAddInput');
  const wordAddCancel = document.getElementById('wordAddCancel');
  const wordAddConfirm = document.getElementById('wordAddConfirm');
  const cardAddBtn = document.getElementById('cardAddBtn');

  function openAddModal() {
    wordAddInput.value = '';
    wordAddModal.classList.add('active');
    setTimeout(function () { wordAddInput.focus(); }, 100);
  }

  function closeAddModal() {
    wordAddModal.classList.remove('active');
  }

  if (cardAddBtn) {
    cardAddBtn.addEventListener('click', openAddModal);
  }
  if (wordAddCancel) {
    wordAddCancel.addEventListener('click', closeAddModal);
  }
  if (wordAddModal) {
    wordAddModal.addEventListener('click', function (e) {
      if (e.target === wordAddModal) closeAddModal();
    });
  }

  if (wordAddConfirm) {
    wordAddConfirm.addEventListener('click', function () {
      const text = wordAddInput.value.trim();
      if (!text) {
        alert('请输入内容');
        return;
      }
      cards.push({
        text: text,
        category: currentCategory,
        createdAt: Date.now()
      });
      // 自动去重
      if (autoDedup) {
        cards = deduplicate(cards);
      }
      saveCards(cards);
      closeAddModal();
    });
  }

  // ==================== 去重 ====================
  function deduplicate(arr) {
    const seen = new Set();
    return arr.filter(function (item) {
      const key = item.text;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  if (dedupNow) {
    dedupNow.addEventListener('click', function () {
      const before = cards.length;
      cards = deduplicate(cards);
      const removed = before - cards.length;
      saveCards(cards);
      if (removed > 0) {
        alert('已去除 ' + removed + ' 条重复内容');
      } else {
        alert('没有重复内容');
      }
    });
  }

  if (dedupToggle) {
    dedupToggle.addEventListener('click', function () {
      autoDedup = !autoDedup;
      dedupCheckbox.classList.toggle('checked', autoDedup);
    });
    // 初始化
    dedupCheckbox.classList.toggle('checked', autoDedup);
  }

  // ==================== 分类切换 ====================
  document.querySelectorAll('#cardCategories .cat-item').forEach(function (item) {
    item.addEventListener('click', function () {
      document.querySelectorAll('#cardCategories .cat-item').forEach(function (i) {
        i.classList.remove('active');
      });
      item.classList.add('active');
      currentCategory = item.getAttribute('data-cat');
      updateUI();
    });
  });

  // ==================== 搜索 ====================
  if (cardSearchInput) {
    cardSearchInput.addEventListener('input', function () {
      searchKeyword = cardSearchInput.value.trim().toLowerCase();
      updateUI();
    });
  }

  // ==================== 渲染列表 ====================
  function renderList() {
    if (!cardList) return;

    let filtered = cards;
    // 分类过滤
    if (currentCategory) {
      filtered = filtered.filter(function (c) {
        return c.category === currentCategory;
      });
    }
    // 搜索过滤
    if (searchKeyword) {
      filtered = filtered.filter(function (c) {
        return c.text.toLowerCase().indexOf(searchKeyword) >= 0;
      });
    }

    // 按时间倒序
    filtered.sort(function (a, b) {
      return (b.createdAt || 0) - (a.createdAt || 0);
    });

    if (filtered.length === 0) {
      cardList.innerHTML = '<div class="empty-state"><i class="fa-regular fa-note-sticky"></i>把想听到的话，放进这里。</div>';
      return;
    }

    cardList.innerHTML = '';
    filtered.forEach(function (card) {
      const item = document.createElement('div');
      item.className = 'word-card-item';

      const text = document.createElement('div');
      text.className = 'word-card-text';
      text.textContent = card.text;

      const del = document.createElement('button');
      del.className = 'word-card-delete';
      del.innerHTML = '<i class="fa-solid fa-xmark"></i>';
      del.addEventListener('click', function () {
        if (confirm('确定删除这条字卡吗？')) {
          const idx = cards.findIndex(function (c) {
            return c.text === card.text && c.createdAt === card.createdAt;
          });
          if (idx >= 0) {
            cards.splice(idx, 1);
            saveCards(cards);
          }
        }
      });

      item.appendChild(text);
      item.appendChild(del);
      cardList.appendChild(item);
    });
  }

  // ==================== 更新角标 ====================
  function updateBadges() {
    const counts = { reply: 0, kaomoji: 0, place: 0, mood: 0, emoji: 0, album: 0 };
    cards.forEach(function (c) {
      if (counts[c.category] !== undefined) counts[c.category]++;
      else counts.reply++;
    });

    if (badgeReply) badgeReply.textContent = counts.reply;
    if (badgeKaomoji) badgeKaomoji.textContent = counts.kaomoji;
    if (badgePlace) badgePlace.textContent = counts.place;
    if (badgeMood) badgeMood.textContent = counts.mood;
    if (badgeEmoji) badgeEmoji.textContent = counts.emoji;
    if (badgeAlbum) badgeAlbum.textContent = counts.album;

    // 底部状态栏
    if (cardStatusBar) {
      cardStatusBar.textContent = counts.reply + '条回复 · ' + counts.emoji + '个表情 · ' + counts.place + '个地点 · ' + counts.mood + '种心情';
    }

    // 导航角标
    if (navMsgBadge) {
      const total = cards.length;
      navMsgBadge.textContent = total > 99 ? '99+' : total;
      navMsgBadge.style.display = total > 0 ? 'flex' : 'none';
    }

    // 分组下拉更新
    if (groupSelect) {
      const currentVal = groupSelect.value;
      groupSelect.innerHTML = '';
      const opt = document.createElement('option');
      opt.textContent = '亲爱的的回复 · ' + counts.reply + ' 条';
      opt.value = 'reply';
      groupSelect.appendChild(opt);
      // 恢复选中
      if (currentVal) groupSelect.value = currentVal;
    }
  }

  // ==================== 统一更新 ====================
  function updateUI() {
    renderList();
    updateBadges();
    // 同步到 window 供 chat.js 读取
    window.dispatchEvent(new Event('wordCardsUpdated'));
  }

  // 暴露给外部调用
  window.refreshCardUI = function () {
    cards = loadCards();
    updateUI();
  };

  // ==================== 导入 / 导出 ====================
  const cardImportBtn = document.getElementById('cardImportBtn');
  const cardExportBtn = document.getElementById('cardExportBtn');

  if (cardImportBtn) {
    cardImportBtn.addEventListener('click', function () {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,.txt,application/json';
      input.addEventListener('change', function () {
        const file = input.files && input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function (e) {
          try {
            const content = e.target.result;
            let imported = [];
            try {
              const parsed = JSON.parse(content);
              if (Array.isArray(parsed)) imported = parsed;
              else if (parsed && Array.isArray(parsed.cards)) imported = parsed.cards;
            } catch (err) {
              // 按行解析
              imported = content.split('\n').filter(function (l) { return l.trim(); }).map(function (line) {
                return { text: line.trim(), category: 'reply', createdAt: Date.now() };
              });
            }
            const valid = imported.map(function (item) {
              if (typeof item === 'string') return { text: item, category: 'reply', createdAt: Date.now() };
              if (item && typeof item === 'object') return {
                text: item.text || item.content || '',
                category: item.category || 'reply',
                createdAt: item.createdAt || Date.now()
              };
              return null;
            }).filter(function (item) { return item && item.text; });

            if (valid.length === 0) {
              alert('未找到有效字卡');
              return;
            }
            cards = cards.concat(valid);
            if (autoDedup) cards = deduplicate(cards);
            saveCards(cards);
            alert('成功导入 ' + valid.length + ' 条字卡');
          } catch (err) {
            alert('导入失败：文件解析错误');
          }
        };
        reader.readAsText(file);
      });
      input.click();
    });
  }

  if (cardExportBtn) {
    cardExportBtn.addEventListener('click', function () {
      const data = JSON.stringify(cards, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'word_cards.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  // ==================== 顶栏编辑按钮 ====================
  const cardEditBtn = document.getElementById('cardEditBtn');
  if (cardEditBtn) {
    cardEditBtn.addEventListener('click', function () {
      alert('编辑模式：点击每条字卡右侧的 × 即可删除');
    });
  }

  // ==================== 分组按钮 ====================
  const groupNewBtn = document.getElementById('groupNewBtn');
  const groupRenameBtn = document.getElementById('groupRenameBtn');
  const groupOrganizeBtn = document.getElementById('groupOrganizeBtn');

  if (groupNewBtn) {
    groupNewBtn.addEventListener('click', function () {
      const name = prompt('请输入新分组名称：');
      if (name) {
        const opt = document.createElement('option');
        opt.textContent = name + ' · 0 条';
        opt.value = 'custom_' + Date.now();
        groupSelect.appendChild(opt);
        groupSelect.value = opt.value;
      }
    });
  }
  if (groupRenameBtn) {
    groupRenameBtn.addEventListener('click', function () {
      const current = groupSelect.options[groupSelect.selectedIndex];
      if (!current) return;
      const name = prompt('重命名分组：', current.textContent);
      if (name) current.textContent = name;
    });
  }
  if (groupOrganizeBtn) {
    groupOrganizeBtn.addEventListener('click', function () {
      alert('整理功能：按时间排序，稍后完善');
    });
  }

  // ==================== 监听其他页面的字卡更新 ====================
  window.addEventListener('storage', function (e) {
    if (e.key === STORAGE_KEY) {
      cards = loadCards();
      updateUI();
    }
  });

  window.addEventListener('wordCardsUpdated', function () {
    // 防止循环调用
  });

  // ==================== 初始化 ====================
  updateUI();

})();
