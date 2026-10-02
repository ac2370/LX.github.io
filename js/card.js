/* ============================================================
   card.js 追加块 —— 分类切换 / 整理模式 / 分组弹窗
   （由原 index.html 内联脚本原样迁移，未改动内部逻辑）
   ============================================================ */
(function () {
  'use strict';

  // ==================== 存储 Key ====================
  var KEY_MAP = {
    reply: 'my_word_cards',
    kaomoji: 'my_kaomoji_cards',
    place: 'my_place_cards',
    mood: 'my_mood_cards',
    emoji: 'my_emoji_cards',
    status: 'my_status_cards'
  };

  // ==================== 状态 ====================
  var currentCat = 'reply';
  var organizeMode = false;
  var selectedSet = new Set(); // 存放选中的文字或 URL

  // ==================== 工具 ====================
  function getList(cat) {
    if (window.getReplyCards && cat === 'reply') return window.getReplyCards();
    try {
      var raw = localStorage.getItem(KEY_MAP[cat]);
      if (!raw) return [];
      var data = JSON.parse(raw);
      if (!Array.isArray(data)) return [];
      return data.map(function (item) {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && item.text) return item.text;
        return null;
      }).filter(function (t) { return t; });
    } catch (e) { return []; }
  }

  function saveList(cat, arr) {
    try { localStorage.setItem(KEY_MAP[cat], JSON.stringify(arr)); } catch (e) {}
    if (window.refreshCardUI) window.refreshCardUI();
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

  // ==================== 搜索框占位符区分 ====================
  function updateSearchPlaceholder() {
    var map = {
      reply: '找一句话、一种心情...',
      kaomoji: '找一个表情...',
      place: '找一个熟悉的地方...',
      mood: '找一句话、一种心情...',
      emoji: '搜索图片名称',
      status: '搜索状态...'
    };
    var inputs = ['cardSearchInput', 'kaomojiSearchInput', 'placeSearchInput', 'moodSearchInput', 'emojiSearchInput', 'statusSearchInput'];
    inputs.forEach(function (id) {
      var el = document.getElementById(id);
      if (el && map[currentCat]) el.placeholder = map[currentCat];
    });
  }

  // ==================== 整理模式切换 ====================
  function toggleOrganize(cat) {
    if (organizeMode && currentCat === cat) {
      organizeMode = false;
    } else {
      organizeMode = true;
      currentCat = cat;
    }
    selectedSet.clear();
    updateOrganizeUI();
  }

  function updateOrganizeUI() {
    // 移除所有整理栏的 active
    document.querySelectorAll('.organize-bar').forEach(function (b) { b.classList.remove('active'); });
    // 移除所有卡片的 organizing / selected
    document.querySelectorAll('.word-card-item, .emoji-grid-item').forEach(function (c) {
      c.classList.remove('organizing', 'selected');
    });

    if (!organizeMode) return;

    // 显示当前分类的整理栏
    var bar = document.getElementById('organizeBar-' + currentCat);
    if (bar) bar.classList.add('active');

    // 给当前分类的卡片加 organizing
    var listEl = document.getElementById('cardList');
    var emojiGridEl = document.getElementById('emojiGrid');
    if (currentCat === 'emoji') {
      if (emojiGridEl) emojiGridEl.querySelectorAll('.emoji-grid-item').forEach(function (c) { c.classList.add('organizing'); });
    } else {
      var listMap = {
        reply: 'cardList',
        kaomoji: 'kaomojiList',
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

  // ==================== 整理栏 DOM 动态注入 ====================
  // 在初始化时，为每个分类注入整理栏
  function injectOrganizeBars() {
    var cats = ['reply', 'kaomoji', 'place', 'mood', 'emoji', 'status'];
    cats.forEach(function (cat) {
      if (document.getElementById('organizeBar-' + cat)) return; // 已存在

      var bar = document.createElement('div');
      bar.className = 'organize-bar';
      bar.id = 'organizeBar-' + cat;
      bar.innerHTML =
        '<div class="organize-count" id="organizeCount-' + cat + '">已选 0 条</div>' +
        '<button class="organize-btn" data-act="selectAll">全选筛选结果</button>' +
        '<button class="organize-btn danger" data-act="deleteSelected">删除所选</button>' +
        '<button class="organize-btn" data-act="deleteGroup">删除此分组</button>' +
        '<button class="organize-btn" data-act="exit">退出整理</button>';

      // 插入到面板最前面（分类网格之后）
      var panel = document.getElementById('panel-' + cat);
      if (panel) {
        panel.insertBefore(bar, panel.firstChild);
      }
    });

    // 绑定整理栏按钮事件
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
          // 重新给卡片加 selected
          applySelectedState();
        } else if (act === 'deleteSelected') {
          if (selectedSet.size === 0) { alert('请先选择要删除的内容'); return; }
          if (!confirm('确定删除选中的 ' + selectedSet.size + ' 条内容吗？')) return;
          var list2 = getList(cat);
          var filtered = list2.filter(function (item) { return !selectedSet.has(item); });
          saveList(cat, filtered);
          selectedSet.clear();
          organizeMode = false;
          updateOrganizeUI();
          if (window.refreshCardUI) window.refreshCardUI();
          setTimeout(function () { rebindCardEvents(); }, 100);
        } else if (act === 'deleteGroup') {
          if (!confirm('确定删除当前分组的所有内容吗？')) return;
          saveList(cat, []);
          selectedSet.clear();
          organizeMode = false;
          updateOrganizeUI();
          if (window.refreshCardUI) window.refreshCardUI();
          setTimeout(function () { rebindCardEvents(); }, 100);
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

    // 文字类
    var listMap = {
      reply: 'cardList',
      kaomoji: 'kaomojiList',
      place: 'placeList',
      mood: 'moodList',
      status: 'statusList'
    };
    var listEl = document.getElementById(listMap[currentCat]);
    if (listEl) {
      listEl.querySelectorAll('.word-card-item').forEach(function (card) {
        var textEl = card.querySelector('.word-card-text');
        if (!textEl) return;
        var text = textEl.textContent;
        card.classList.toggle('selected', selectedSet.has(text));
      });
    }

    // 表情包
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

  // ==================== 给卡片注入勾选圆圈 + 点击事件 ====================
  function rebindCardEvents() {
    // 给所有文字卡片注入勾选圆圈
    document.querySelectorAll('.word-card-item').forEach(function (card) {
      if (card.querySelector('.select-circle')) return;
      var circle = document.createElement('div');
      circle.className = 'select-circle';
      card.insertBefore(circle, card.firstChild);

      // 点击圆圈或卡片本身（在整理模式下）切换选中
      card.addEventListener('click', function (e) {
        if (!organizeMode) return;
        // 避免点到删除按钮
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

    // 给表情包卡片注入勾选圆圈
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

  // ==================== 分组弹窗 ====================
  function createGroupModal() {
    if (document.getElementById('groupModal')) return;
    var modal = document.createElement('div');
    modal.className = 'group-modal';
    modal.id = 'groupModal';
    modal.innerHTML =
      '<div class="group-modal-panel">' +
        '<div class="group-modal-title" id="groupModalTitle">新建分组</div>' +
        '<input type="text" class="group-modal-input" id="groupModalInput" placeholder="输入分组名称...">' +
        '<div class="group-modal-actions">' +
          '<button class="group-modal-btn group-modal-cancel" id="groupModalCancel">取消</button>' +
          '<button class="group-modal-btn group-modal-confirm" id="groupModalConfirm">保存</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);

    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeGroupModal();
    });
    document.getElementById('groupModalCancel').addEventListener('click', closeGroupModal);
    document.getElementById('groupModalConfirm').addEventListener('click', function () {
      var name = document.getElementById('groupModalInput').value.trim();
      if (!name) { alert('请输入分组名称'); return; }
      alert('分组「' + name + '」已保存（演示功能）');
      closeGroupModal();
    });
  }

  function openGroupModal(title) {
    createGroupModal();
    document.getElementById('groupModalTitle').textContent = title;
    document.getElementById('groupModalInput').value = '';
    document.getElementById('groupModal').classList.add('active');
    setTimeout(function () {
      document.getElementById('groupModalInput').focus();
    }, 100);
  }

  function closeGroupModal() {
    var modal = document.getElementById('groupModal');
    if (modal) modal.classList.remove('active');
  }

  // ==================== 绑定按钮 ====================
  function bindButtons() {
    // 回复面板的导入/导出/添加（保留原逻辑，由 card.js 处理，这里只处理"添加"的多行提示）
    var btnAddCard = document.getElementById('btnAddCard');
    if (btnAddCard && !btnAddCard.dataset.bound) {
      btnAddCard.dataset.bound = '1';
      // 不覆盖原有逻辑，只修改 placeholder
      var origClick = btnAddCard.onclick;
      // 原 card.js 中已处理，这里不重复绑定
    }

    // 新建分组
    var btnNewGroup = document.getElementById('btnNewGroup');
    if (btnNewGroup && !btnNewGroup.dataset.bound) {
      btnNewGroup.dataset.bound = '1';
      btnNewGroup.addEventListener('click', function (e) {
        e.stopImmediatePropagation();
        openGroupModal('新建分组');
      }, true);
    }

    // 重命名
    var btnRenameGroup = document.getElementById('btnRenameGroup');
    if (btnRenameGroup && !btnRenameGroup.dataset.bound) {
      btnRenameGroup.dataset.bound = '1';
      btnRenameGroup.addEventListener('click', function (e) {
        e.stopImmediatePropagation();
        openGroupModal('重命名分组');
      }, true);
    }

    // 各分类的"整理"按钮
    var organizeMap = {
      btnOrganizeGroup: 'reply',
      kaomojiOrganizeBtn: 'kaomoji',
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
          rebindCardEvents();
        }, true);
      }
    });
  }

  // ==================== 监听分类切换后重新绑定 ====================
  var observer = new MutationObserver(function () {
    rebindCardEvents();
    // 如果处于整理模式，重新应用选中状态
    if (organizeMode) {
      updateOrganizeUI();
      applySelectedState();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // ==================== 初始化 ====================
  function init() {
    injectOrganizeBars();
    bindButtons();
    updateSearchPlaceholder();
    rebindCardEvents();
  }

  // DOM 就绪后执行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 暴露给外部
  window.rebindCardEvents = rebindCardEvents;

})();
