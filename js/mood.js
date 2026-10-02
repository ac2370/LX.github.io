/* ============================================================
   mood.js —— 心晴手账（多角色双人心情日历）
   依赖：
     - window.showPage / window.pageMood（router.js）
     - window.getReplyCards（card.js）
     - localforage（CDN）
   数据：
     - moodCalendar:     { [contactId]: { [dateStr]: {...} } }
     - customMoodOptions: [ {...} ]  （全局共享）
     - moodTrash:        [ {...} ]   （全局共享，每条带 contactId）
   ============================================================ */
(function () {
  'use strict';

  // ==================== 常量 ====================
  var STORE_KEY_CALENDAR = 'moodCalendar';
  var STORE_KEY_CUSTOM   = 'customMoodOptions';
  var STORE_KEY_TRASH    = 'moodTrash';

  var LS_CONTACTS_KEY  = 'my_contacts';
  var LS_CURRENT_KEY   = 'my_current_contact';

  var BUILTIN_MOODS = [
    { key: 'happy',    emoji: '😆', label: '开心', color: '#f8d878' },
    { key: 'excited',  emoji: '🥰', label: '兴奋', color: '#f8b4b4' },
    { key: 'calm',     emoji: '☺️', label: '平淡', color: '#b8d4ec' },
    { key: 'sad',      emoji: '😕', label: '难过', color: '#a8b4c0' },
    { key: 'tired',    emoji: '😞', label: '疲惫', color: '#c4b8d8' },
    { key: 'angry',    emoji: '😠', label: '生气', color: '#e58b8b' },
    { key: 'love',     emoji: '🥰', label: '想你', color: '#f8a8c8' },
    { key: 'busy',     emoji: '😵‍💫', label: '忙碌', color: '#c8d4dc' },
    { key: 'sleepy',   emoji: '😴', label: '困困', color: '#b8c8dc' },
    { key: 'lonely',   emoji: '🥹', label: '孤单', color: '#a8c8d8' },
    { key: 'cool',     emoji: '😎', label: '潇洒', color: '#8fd1a3' },
    { key: 'coquetry', emoji: '🥺', label: '撒娇', color: '#f8c8d8' }
  ];

  var CUSTOM_COLOR_PALETTE = [
    '#f8d878', '#f8b4b4', '#f8a8c8', '#e58b8b',
    '#b8d4ec', '#8fb8d8', '#8fd1a3', '#c4b8d8'
  ];

  // ==================== 状态 ====================
  var moodData = {};              // { [contactId]: { [dateStr]: {...} } }
  var customMoodOptions = [];     // 全局自定义心情
  var moodTrash = [];             // 全局回收站

  var currentContactId = null;
  var currentContactInfo = null;  // { id, name, avatar }

  var viewYear, viewMonth;        // 当前日历显示的年份/月份（0-11）

  // 编辑器临时状态
  var editorState = {
    dateStr: '',
    target: 'me',           // 'me' | 'partner'
    page: 1,                // 1 | 2
    tempMood: null,         // 当前选中的心情 key
    tempNote: '',
    tempWeather: ''
  };

  // 自定义心情临时状态
  var customState = {
    emoji: '',
    label: '',
    color: CUSTOM_COLOR_PALETTE[0]
  };

  // 导入待处理数据
  var pendingImportData = null;

  // ==================== 工具 ====================
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  function dateToStr(date) {
    return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
  }

  function strToDate(str) {
    var parts = str.split('-');
    return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  }

  function todayStr() {
    return dateToStr(new Date());
  }

  function formatDateDisplay(str) {
    var d = strToDate(str);
    return d.getFullYear() + '.' + pad2(d.getMonth() + 1) + '.' + pad2(d.getDate());
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  // ==================== 联系人 ====================
  function loadContacts() {
    try {
      var raw = localStorage.getItem(LS_CONTACTS_KEY);
      if (raw) {
        var arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length > 0) return arr;
      }
    } catch (e) {}
    return [{ id: 'default_ta', name: 'Ta', avatar: 'https://picsum.photos/200/200?random=99' }];
  }

  function loadCurrentContactId(contacts) {
    var cid = null;
    try { cid = localStorage.getItem(LS_CURRENT_KEY); } catch (e) {}
    if (cid && contacts.some(function (c) { return c.id === cid; })) return cid;
    return contacts[0].id;
  }

  function refreshCurrentContact() {
    var contacts = loadContacts();
    currentContactId = loadCurrentContactId(contacts);
    currentContactInfo = contacts.find(function (c) { return c.id === currentContactId; }) || contacts[0];
    updateCurrentContactUI();
  }

  function updateCurrentContactUI() {
    var avatarEl = document.getElementById('moodCurrentAvatar');
    var nameEl = document.getElementById('moodCurrentName');
    if (avatarEl && currentContactInfo) {
      avatarEl.src = currentContactInfo.avatar || '';
      avatarEl.alt = currentContactInfo.name || '';
    }
    if (nameEl && currentContactInfo) {
      nameEl.textContent = currentContactInfo.name || 'Ta';
    }
  }

  // ==================== 数据读写 ====================
  function loadAllData() {
    return Promise.all([
      localforage.getItem(STORE_KEY_CALENDAR),
      localforage.getItem(STORE_KEY_CUSTOM),
      localforage.getItem(STORE_KEY_TRASH)
    ]).then(function (results) {
      moodData = results[0] || {};
      if (typeof moodData !== 'object' || Array.isArray(moodData)) moodData = {};
      customMoodOptions = Array.isArray(results[1]) ? results[1] : [];
      moodTrash = Array.isArray(results[2]) ? results[2] : [];
    }).catch(function () {
      moodData = {};
      customMoodOptions = [];
      moodTrash = [];
    });
  }

  function saveMoodData() {
    return localforage.setItem(STORE_KEY_CALENDAR, moodData).catch(function () {});
  }
  function saveCustomMoodOptions() {
    return localforage.setItem(STORE_KEY_CUSTOM, customMoodOptions).catch(function () {});
  }
  function saveMoodTrash() {
    return localforage.setItem(STORE_KEY_TRASH, moodTrash).catch(function () {});
  }

  // ==================== 心情选项 ====================
  function getAllMoods() {
    return BUILTIN_MOODS.concat(customMoodOptions);
  }

  function findMood(key) {
    if (!key) return null;
    var all = getAllMoods();
    return all.find(function (m) { return m.key === key; }) || null;
  }

  function getMoodEmoji(key) {
    var m = findMood(key);
    return m ? m.emoji : '❓';
  }
  function getMoodLabel(key) {
    var m = findMood(key);
    return m ? m.label : '未知';
  }
  function getMoodColor(key) {
    var m = findMood(key);
    return m ? m.color : '#cbd4dc';
  }

  // ==================== 当前角色数据访问 ====================
  function getContactMoodMap() {
    if (!currentContactId) return {};
    if (!moodData[currentContactId]) moodData[currentContactId] = {};
    return moodData[currentContactId];
  }

  // ==================== 对方每日自动记录 ====================
  function checkPartnerDailyMood() {
    if (!currentContactId) return;
    var map = getContactMoodMap();
    var today = todayStr();
    var rec = map[today] || {};
    if (rec.partnerChecked) return;   // 今天已处理过

    // 20% 概率今天不记录
    if (Math.random() < 0.2) {
      rec.partnerChecked = true;
      map[today] = rec;
      saveMoodData();
      return;
    }

    // 随机心情
    var all = getAllMoods();
    var mood = all[Math.floor(Math.random() * all.length)];

    // 从"回复"分类随机抽 1~3 条拼接随记
    var replies = getReplyCardsSafe();
    var noteText = '';
    if (replies.length > 0) {
      var count = 1 + Math.floor(Math.random() * 3);
      if (count > replies.length) count = replies.length;
      var pool = replies.slice();
      var picked = [];
      for (var i = 0; i < count; i++) {
        var idx = Math.floor(Math.random() * pool.length);
        picked.push(pool[idx]);
        pool.splice(idx, 1);
      }
      noteText = picked.join(' ');
    }

    rec.partner = mood.key;
    rec.partnerNote = noteText;
    rec.partnerWeather = '';
    rec.partnerChecked = true;

    map[today] = rec;
    saveMoodData();
  }

  function getReplyCardsSafe() {
    // 优先用 card.js 暴露的接口
    try {
      if (typeof window.getReplyCards === 'function') {
        var arr = window.getReplyCards();
        if (Array.isArray(arr)) {
          return arr.map(function (item) {
            if (typeof item === 'string') return item;
            if (item && typeof item === 'object' && item.text) return item.text;
            return null;
          }).filter(function (t) { return t; });
        }
      }
    } catch (e) {}

    // 回退：直接读 localStorage
    try {
      var raw = localStorage.getItem('my_word_cards');
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

  // ==================== 日历渲染 ====================
  function initCalendar() {
    var now = new Date();
    viewYear = now.getFullYear();
    viewMonth = now.getMonth();
  }

  function renderCalendar() {
    var label = document.getElementById('moodMonthLabel');
    var grid = document.getElementById('moodCalendarGrid');
    if (!grid) return;

    if (label) label.textContent = viewYear + '年' + (viewMonth + 1) + '月';

    var map = getContactMoodMap();
    var firstDay = new Date(viewYear, viewMonth, 1);
    var daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    // 周一为第一列：JS getDay() 0=周日，转换
    var startWeekday = firstDay.getDay();
    if (startWeekday === 0) startWeekday = 7;
    startWeekday -= 1; // 0=周一

    var today = todayStr();
    var html = '';

    // 前置空位
    for (var i = 0; i < startWeekday; i++) {
      html += '<div class="mood-day empty"></div>';
    }

    // 日期
    for (var d = 1; d <= daysInMonth; d++) {
      var dateStr = viewYear + '-' + pad2(viewMonth + 1) + '-' + pad2(d);
      var rec = map[dateStr] || {};
      var hasUser = !!rec.user;
      var hasPartner = !!rec.partner;
      var isToday = dateStr === today;

      var cls = 'mood-day';
      if (isToday) cls += ' today';
      if (hasUser || hasPartner) cls += ' has-record';

      var dots = '';
      if (hasUser) {
        dots += '<span class="mood-dot me" style="background:' + getMoodColor(rec.user) + '"></span>';
      }
      if (hasPartner) {
        dots += '<span class="mood-dot partner" style="background:' + getMoodColor(rec.partner) + '"></span>';
      }

      html += '<div class="' + cls + '" data-date="' + dateStr + '">' +
        '<div class="mood-day-num">' + d + '</div>' +
        '<div class="mood-day-dots">' + dots + '</div>' +
        '</div>';
    }

    grid.innerHTML = html;

    // 绑定点击
    grid.querySelectorAll('.mood-day[data-date]').forEach(function (el) {
      el.addEventListener('click', function () {
        var ds = el.getAttribute('data-date');
        openDay(ds);
      });
    });
  }

  function openDay(dateStr) {
    var map = getContactMoodMap();
    var rec = map[dateStr];
    if (rec && (rec.user || rec.partner)) {
      showDayDetails(dateStr);
    } else {
      openEditor(dateStr, 'me', 1);
    }
  }

  // ==================== 统计视图 ====================
  function renderStats() {
    var container = document.getElementById('moodStatsContent');
    if (!container) return;

    var map = getContactMoodMap();
    var prefix = viewYear + '-' + pad2(viewMonth + 1) + '-';
    var daysMe = 0, daysPartner = 0;
    var moodCountMe = {};
    var moodCountPartner = {};

    Object.keys(map).forEach(function (ds) {
      if (ds.indexOf(prefix) !== 0) return;
      var rec = map[ds];
      if (rec.user) {
        daysMe++;
        moodCountMe[rec.user] = (moodCountMe[rec.user] || 0) + 1;
      }
      if (rec.partner) {
        daysPartner++;
        moodCountPartner[rec.partner] = (moodCountPartner[rec.partner] || 0) + 1;
      }
    });

    if (daysMe === 0 && daysPartner === 0) {
      container.innerHTML =
        '<div class="mood-stats-empty">' +
        '<i class="fa-regular fa-chart-bar"></i>' +
        '本月还没有记录，点日历里的一天开始吧' +
        '</div>';
      return;
    }

    // 占比
    var total = daysMe + daysPartner;
    var mePercent = total > 0 ? Math.round(daysMe * 100 / total) : 0;
    var partnerPercent = total > 0 ? 100 - mePercent : 0;

    // 主导心情
    function dominant(countMap) {
      var best = null, bestN = 0;
      Object.keys(countMap).forEach(function (k) {
        if (countMap[k] > bestN) { bestN = countMap[k]; best = k; }
      });
      return best;
    }
    var domMe = dominant(moodCountMe);
    var domPartner = dominant(moodCountPartner);

    var html = '';
    html += '<div class="mood-stats-title">' + viewYear + '.' + pad2(viewMonth + 1) + ' · 记录统计</div>';

    // 记录天数
    html += '<div class="mood-stats-days">';
    html += '<div class="mood-stats-day-item">' +
      '<div class="mood-stats-day-num me">' + daysMe + '</div>' +
      '<div class="mood-stats-day-label">我的记录</div>' +
      '</div>';
    html += '<div class="mood-stats-day-item">' +
      '<div class="mood-stats-day-num partner">' + daysPartner + '</div>' +
      '<div class="mood-stats-day-label">Ta 的记录</div>' +
      '</div>';
    html += '</div>';

    // 占比条
    html += '<div class="mood-stats-ratio">';
    html += '<span class="mood-stats-ratio-label">我 ' + mePercent + '%</span>';
    html += '<div class="mood-stats-ratio-bar">' +
      '<div class="mood-stats-ratio-me" style="width:' + mePercent + '%"></div>' +
      '<div class="mood-stats-ratio-partner" style="width:' + partnerPercent + '%"></div>' +
      '</div>';
    html += '<span class="mood-stats-ratio-label">' + partnerPercent + '% Ta</span>';
    html += '</div>';

    // 主导心情
    html += '<div class="mood-stats-title" style="margin-top:16px;">本月主导心情</div>';
    html += '<div class="mood-stats-dominant">';
    html += '<div class="mood-stats-dominant-item">' +
      '<div class="mood-stats-dominant-emoji">' + (domMe ? getMoodEmoji(domMe) : '—') + '</div>' +
      '<div class="mood-stats-dominant-label">' + (domMe ? getMoodLabel(domMe) : '暂无') + '</div>' +
      '<div class="mood-stats-dominant-who">我</div>' +
      '</div>';
    html += '<div class="mood-stats-dominant-item">' +
      '<div class="mood-stats-dominant-emoji">' + (domPartner ? getMoodEmoji(domPartner) : '—') + '</div>' +
      '<div class="mood-stats-dominant-label">' + (domPartner ? getMoodLabel(domPartner) : '暂无') + '</div>' +
      '<div class="mood-stats-dominant-who">Ta</div>' +
      '</div>';
    html += '</div>';

    // 分类条
    html += renderCategoryBars('我的心情分类', moodCountMe, daysMe);
    html += renderCategoryBars('Ta 的心情分类', moodCountPartner, daysPartner);

    container.innerHTML = html;
  }

  function renderCategoryBars(title, countMap, total) {
    if (total === 0) return '';
    var html = '<div class="mood-stats-title" style="margin-top:16px;">' + title + '</div>';
    html += '<div class="mood-stats-categories">';
    var keys = Object.keys(countMap).sort(function (a, b) { return countMap[b] - countMap[a]; });
    keys.forEach(function (k) {
      var count = countMap[k];
      var percent = Math.round(count * 100 / total);
      html += '<div class="mood-stats-cat-row">' +
        '<span class="mood-stats-cat-emoji">' + getMoodEmoji(k) + '</span>' +
        '<span class="mood-stats-cat-label">' + escapeHtml(getMoodLabel(k)) + '</span>' +
        '<div class="mood-stats-cat-bar-wrap">' +
          '<div class="mood-stats-cat-bar" style="width:' + percent + '%;background:' + getMoodColor(k) + '"></div>' +
        '</div>' +
        '<span class="mood-stats-cat-count">' + count + '</span>' +
        '</div>';
    });
    html += '</div>';
    return html;
  }

  // ==================== 回收站 ====================
  function renderTrash() {
    var list = document.getElementById('moodTrashList');
    if (!list) return;

    // 只显示当前联系人的
    var items = moodTrash.filter(function (t) { return t.contactId === currentContactId; });

    if (items.length === 0) {
      list.innerHTML =
        '<div class="mood-trash-empty">' +
        '<i class="fa-regular fa-trash-can"></i>' +
        '回收站是空的' +
        '</div>';
      return;
    }

    // 按删除时间倒序
    items.sort(function (a, b) { return (b.deletedAt || 0) - (a.deletedAt || 0); });

    var html = '';
    items.forEach(function (item) {
      var who = item.who === 'me' ? '我' : 'Ta';
      var preview = '';
      if (item.payload && item.payload.mood) {
        preview = who + '：' + getMoodEmoji(item.payload.mood) + ' ' + escapeHtml(getMoodLabel(item.payload.mood));
        if (item.payload.note) {
          preview += ' · ' + escapeHtml(item.payload.note.substring(0, 20));
        }
      }
      html += '<div class="mood-trash-item" data-id="' + item.id + '">' +
        '<div class="mood-trash-head">' +
          '<span class="mood-trash-date">' + formatDateDisplay(item.dateStr) + '</span>' +
          '<span class="mood-trash-contact">' + escapeHtml(currentContactInfo ? currentContactInfo.name : 'Ta') + '</span>' +
        '</div>' +
        '<div class="mood-trash-preview">' + preview + '</div>' +
        '<div class="mood-trash-actions">' +
          '<button class="mood-trash-btn restore" data-act="restore"><i class="fa-solid fa-rotate-left"></i>恢复</button>' +
          '<button class="mood-trash-btn delete" data-act="delete"><i class="fa-solid fa-xmark"></i>彻底删除</button>' +
        '</div>' +
        '</div>';
    });

    list.innerHTML = html;

    list.querySelectorAll('.mood-trash-item').forEach(function (el) {
      var id = el.getAttribute('data-id');
      el.querySelector('[data-act="restore"]').addEventListener('click', function () {
        restoreTrashItem(id);
      });
      el.querySelector('[data-act="delete"]').addEventListener('click', function () {
        deleteTrashItem(id);
      });
    });
  }

  function softDelete(dateStr, who) {
    var map = getContactMoodMap();
    var rec = map[dateStr];
    if (!rec) return;

    var payload = {};
    var deletedAny = false;

    if (who === 'me' && rec.user) {
      payload.mood = rec.user;
      payload.note = rec.note || '';
      payload.weather = rec.myWeather || '';
      // 清空我的部分
      delete rec.user;
      delete rec.note;
      delete rec.myWeather;
      deletedAny = true;
    } else if (who === 'partner' && rec.partner) {
      payload.mood = rec.partner;
      payload.note = rec.partnerNote || '';
      payload.weather = rec.partnerWeather || '';
      delete rec.partner;
      delete rec.partnerNote;
      delete rec.partnerWeather;
      deletedAny = true;
    }

    if (!deletedAny) return;

    // 双方都空 → 删掉整条日期
    if (!rec.user && !rec.partner) {
      delete map[dateStr];
    } else {
      map[dateStr] = rec;
    }

    moodTrash.push({
      id: 'trash_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      contactId: currentContactId,
      dateStr: dateStr,
      who: who,
      payload: payload,
      deletedAt: Date.now()
    });

    saveMoodData();
    saveMoodTrash();
  }

  function restoreTrashItem(id) {
    var idx = moodTrash.findIndex(function (t) { return t.id === id; });
    if (idx < 0) return;
    var item = moodTrash[idx];

    // 恢复到对应联系人（即使当前不是那个联系人）
    var cid = item.contactId;
    if (!moodData[cid]) moodData[cid] = {};
    var map = moodData[cid];
    var rec = map[item.dateStr] || {};

    if (item.who === 'me') {
      rec.user = item.payload.mood;
      rec.note = item.payload.note || '';
      rec.myWeather = item.payload.weather || '';
    } else {
      rec.partner = item.payload.mood;
      rec.partnerNote = item.payload.note || '';
      rec.partnerWeather = item.payload.weather || '';
    }

    map[item.dateStr] = rec;

    moodTrash.splice(idx, 1);
    saveMoodData();
    saveMoodTrash();

    if (cid === currentContactId) {
      renderTrash();
    }
  }

  function deleteTrashItem(id) {
    if (!confirm('彻底删除这条记录？此操作不可恢复。')) return;
    var idx = moodTrash.findIndex(function (t) { return t.id === id; });
    if (idx < 0) return;
    moodTrash.splice(idx, 1);
    saveMoodTrash();
    renderTrash();
  }

  // ==================== 编辑器 ====================
  function openEditor(dateStr, target, page) {
    editorState.dateStr = dateStr;
    editorState.target = target || 'me';
    editorState.page = page || 1;
    editorState.tempMood = null;
    editorState.tempNote = '';
    editorState.tempWeather = '';

    // 回填已有记录
    var map = getContactMoodMap();
    var rec = map[dateStr] || {};
    if (editorState.target === 'me') {
      editorState.tempMood = rec.user || null;
      editorState.tempNote = rec.note || '';
      editorState.tempWeather = rec.myWeather || '';
    } else {
      editorState.tempMood = rec.partner || null;
      editorState.tempNote = rec.partnerNote || '';
      editorState.tempWeather = rec.partnerWeather || '';
    }

    var dateEl = document.getElementById('moodEditorDate');
    if (dateEl) dateEl.textContent = formatDateDisplay(dateStr);

    updateEditorTabs();
    renderMoodOptions();
    updateEditorPage();

    var noteInput = document.getElementById('moodNoteInput');
    var weatherInput = document.getElementById('moodWeatherInput');
    if (noteInput) noteInput.value = editorState.tempNote;
    if (weatherInput) weatherInput.value = editorState.tempWeather;

    var overlay = document.getElementById('moodEditorOverlay');
    if (overlay) overlay.classList.add('active');
  }

  function closeEditor() {
    var overlay = document.getElementById('moodEditorOverlay');
    if (overlay) overlay.classList.remove('active');
  }

  function updateEditorTabs() {
    var tabMe = document.getElementById('moodEditorTabMe');
    var tabPartner = document.getElementById('moodEditorTabPartner');
    if (tabMe) tabMe.classList.toggle('active', editorState.target === 'me');
    if (tabPartner) tabPartner.classList.toggle('active', editorState.target === 'partner');
  }

  function renderMoodOptions() {
    var grid = document.getElementById('moodOptionsGrid');
    if (!grid) return;

    var all = getAllMoods();
    var html = '';
    all.forEach(function (m) {
      var selected = editorState.tempMood === m.key ? ' selected' : '';
      var isCustom = m.key.indexOf('custom_') === 0;
      html += '<div class="mood-option' + selected + '" data-key="' + escapeHtml(m.key) + '">' +
        '<div class="mood-option-emoji">' + escapeHtml(m.emoji) + '</div>' +
        '<div class="mood-option-label">' + escapeHtml(m.label) + '</div>' +
        (isCustom ? '<button class="mood-option custom-del" data-del="' + escapeHtml(m.key) + '" title="删除"><i class="fa-solid fa-xmark"></i></button>' : '') +
        '</div>';
    });
    grid.innerHTML = html;

    grid.querySelectorAll('.mood-option').forEach(function (el) {
      el.addEventListener('click', function (e) {
        if (e.target.closest('.custom-del')) return;
        editorState.tempMood = el.getAttribute('data-key');
        renderMoodOptions();
      });
    });

    grid.querySelectorAll('.custom-del').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var key = btn.getAttribute('data-del');
        deleteCustomMood(key);
      });
    });
  }

  function updateEditorPage() {
    var page1 = document.getElementById('moodEditorPage1');
    var page2 = document.getElementById('moodEditorPage2');
    if (page1) page1.classList.toggle('active', editorState.page === 1);
    if (page2) page2.classList.toggle('active', editorState.page === 2);

    var footer = document.getElementById('moodEditorFooter');
    if (!footer) return;

    if (editorState.page === 1) {
      footer.innerHTML =
        '<button class="mood-editor-btn mood-editor-btn-cancel" id="moodEditorCancel">取消</button>' +
        '<button class="mood-editor-btn mood-editor-btn-next" id="moodEditorNext">下一步</button>';
      document.getElementById('moodEditorCancel').addEventListener('click', closeEditor);
      document.getElementById('moodEditorNext').addEventListener('click', function () {
        if (!editorState.tempMood) { alert('请先选一个心情'); return; }
        editorState.page = 2;
        updateEditorPage();
      });
    } else {
      footer.innerHTML =
        '<button class="mood-editor-btn mood-editor-btn-back" id="moodEditorBack">上一步</button>' +
        '<button class="mood-editor-btn mood-editor-btn-save" id="moodEditorSave">保存</button>';
      document.getElementById('moodEditorBack').addEventListener('click', function () {
        // 保存当前输入
        var ni = document.getElementById('moodNoteInput');
        var wi = document.getElementById('moodWeatherInput');
        if (ni) editorState.tempNote = ni.value;
        if (wi) editorState.tempWeather = wi.value;
        editorState.page = 1;
        updateEditorPage();
      });
      document.getElementById('moodEditorSave').addEventListener('click', saveEditor);
    }
  }

  function saveEditor() {
    var ni = document.getElementById('moodNoteInput');
    var wi = document.getElementById('moodWeatherInput');
    editorState.tempNote = ni ? ni.value : '';
    editorState.tempWeather = wi ? wi.value : '';

    if (!editorState.tempMood) { alert('请先选一个心情'); return; }

    var map = getContactMoodMap();
    var rec = map[editorState.dateStr] || {};

    if (editorState.target === 'me') {
      rec.user = editorState.tempMood;
      rec.note = editorState.tempNote;
      rec.myWeather = editorState.tempWeather;
    } else {
      rec.partner = editorState.tempMood;
      rec.partnerNote = editorState.tempNote;
      rec.partnerWeather = editorState.tempWeather;
      // 手动编辑对方记录时，标记为已处理，避免自动覆盖
      rec.partnerChecked = true;
    }

    map[editorState.dateStr] = rec;
    saveMoodData();

    closeEditor();
    renderCalendar();
    renderStats();
  }

  // ==================== 详情视图 ====================
  function showDayDetails(dateStr) {
    var map = getContactMoodMap();
    var rec = map[dateStr] || {};

    var dateEl = document.getElementById('moodDetailDate');
    if (dateEl) dateEl.textContent = formatDateDisplay(dateStr);

    var body = document.getElementById('moodDetailBody');
    if (!body) return;

    var html = '';

    // 我
    html += '<div class="mood-detail-block">';
    html += '<div class="mood-detail-block-head">';
    html += '<img class="mood-detail-avatar" src="https://picsum.photos/100/100?random=1" alt="我">';
    html += '<span class="mood-detail-name">我</span>';
    html += '</div>';
    if (rec.user) {
      html += '<div class="mood-detail-mood">' +
        '<span class="mood-detail-mood-emoji">' + getMoodEmoji(rec.user) + '</span>' +
        '<span class="mood-detail-mood-label">' + escapeHtml(getMoodLabel(rec.user)) + '</span>' +
        '<span class="mood-detail-mood-color" style="background:' + getMoodColor(rec.user) + '"></span>' +
        '</div>';
      if (rec.note) {
        html += '<div class="mood-detail-note">' + escapeHtml(rec.note) + '</div>';
      }
      if (rec.myWeather) {
        html += '<div class="mood-detail-weather"><i class="fa-solid fa-cloud-sun"></i>' + escapeHtml(rec.myWeather) + '</div>';
      }
      html += '<div class="mood-detail-actions">' +
        '<button class="mood-detail-btn edit" data-edit="me"><i class="fa-solid fa-pen"></i>修改</button>' +
        '<button class="mood-detail-btn delete" data-del="me"><i class="fa-solid fa-trash-can"></i>删除</button>' +
        '</div>';
    } else {
      html += '<div class="mood-detail-empty">这天没有记录</div>';
      html += '<div class="mood-detail-actions">' +
        '<button class="mood-detail-btn edit" data-edit="me"><i class="fa-solid fa-plus"></i>添加</button>' +
        '</div>';
    }
    html += '</div>';

    // Ta
    html += '<div class="mood-detail-block">';
    html += '<div class="mood-detail-block-head">';
    html += '<img class="mood-detail-avatar" src="' + escapeHtml(currentContactInfo ? currentContactInfo.avatar : '') + '" alt="Ta">';
    html += '<span class="mood-detail-name">' + escapeHtml(currentContactInfo ? currentContactInfo.name : 'Ta') + '</span>';
    html += '</div>';
    if (rec.partner) {
      html += '<div class="mood-detail-mood">' +
        '<span class="mood-detail-mood-emoji">' + getMoodEmoji(rec.partner) + '</span>' +
        '<span class="mood-detail-mood-label">' + escapeHtml(getMoodLabel(rec.partner)) + '</span>' +
        '<span class="mood-detail-mood-color" style="background:' + getMoodColor(rec.partner) + '"></span>' +
        '</div>';
      if (rec.partnerNote) {
        html += '<div class="mood-detail-note">' + escapeHtml(rec.partnerNote) + '</div>';
      }
      if (rec.partnerWeather) {
        html += '<div class="mood-detail-weather"><i class="fa-solid fa-cloud-sun"></i>' + escapeHtml(rec.partnerWeather) + '</div>';
      }
      html += '<div class="mood-detail-actions">' +
        '<button class="mood-detail-btn edit" data-edit="partner"><i class="fa-solid fa-pen"></i>修改</button>' +
        '<button class="mood-detail-btn delete" data-del="partner"><i class="fa-solid fa-trash-can"></i>删除</button>' +
        '</div>';
    } else {
      html += '<div class="mood-detail-empty">这天没有记录</div>';
      html += '<div class="mood-detail-actions">' +
        '<button class="mood-detail-btn edit" data-edit="partner"><i class="fa-solid fa-plus"></i>添加</button>' +
        '</div>';
    }
    html += '</div>';

    body.innerHTML = html;

    // 绑定按钮
    body.querySelectorAll('[data-edit]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var target = btn.getAttribute('data-edit');
        closeDetail();
        openEditor(dateStr, target, 1);
      });
    });
    body.querySelectorAll('[data-del]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var who = btn.getAttribute('data-del');
        if (!confirm('删除这条记录？可在回收站恢复。')) return;
        softDelete(dateStr, who);
        closeDetail();
        renderCalendar();
        renderStats();
        renderTrash();
      });
    });

    var overlay = document.getElementById('moodDetailOverlay');
    if (overlay) overlay.classList.add('active');
  }

  function closeDetail() {
    var overlay = document.getElementById('moodDetailOverlay');
    if (overlay) overlay.classList.remove('active');
  }

  // ==================== 自定义心情 ====================
  function openCustomModal() {
    customState.emoji = '';
    customState.label = '';
    customState.color = CUSTOM_COLOR_PALETTE[0];

    var emojiEl = document.getElementById('moodCustomEmoji');
    var labelEl = document.getElementById('moodCustomLabel');
    if (emojiEl) emojiEl.value = '';
    if (labelEl) labelEl.value = '';

    renderCustomColors();
    var modal = document.getElementById('moodCustomModal');
    if (modal) modal.classList.add('active');
  }

  function closeCustomModal() {
    var modal = document.getElementById('moodCustomModal');
    if (modal) modal.classList.remove('active');
  }

  function renderCustomColors() {
    var wrap = document.getElementById('moodCustomColors');
    if (!wrap) return;
    var html = '';
    CUSTOM_COLOR_PALETTE.forEach(function (c) {
      var active = c === customState.color ? ' active' : '';
      html += '<button class="mood-custom-color-btn' + active + '" data-color="' + c + '" style="background:' + c + '"></button>';
    });
    wrap.innerHTML = html;

    wrap.querySelectorAll('.mood-custom-color-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        customState.color = btn.getAttribute('data-color');
        renderCustomColors();
      });
    });
  }

  function saveCustomMood() {
    var emojiEl = document.getElementById('moodCustomEmoji');
    var labelEl = document.getElementById('moodCustomLabel');
    var emoji = emojiEl ? emojiEl.value.trim() : '';
    var label = labelEl ? labelEl.value.trim() : '';

    if (!emoji) { alert('请填一个表情'); return; }
    if (!label) { alert('请填一个名称'); return; }

    customMoodOptions.push({
      key: 'custom_' + Date.now(),
      emoji: emoji,
      label: label,
      color: customState.color
    });

    saveCustomMoodOptions();
    closeCustomModal();
    renderMoodOptions();
  }

  function deleteCustomMood(key) {
    if (!confirm('删除这个自定义心情？')) return;
    var idx = customMoodOptions.findIndex(function (m) { return m.key === key; });
    if (idx < 0) return;
    customMoodOptions.splice(idx, 1);
    saveCustomMoodOptions();
    if (editorState.tempMood === key) editorState.tempMood = null;
    renderMoodOptions();
  }

  // ==================== 导入导出 ====================
  function exportMoodBackup() {
    var data = {
      type: 'mood-backup',
      version: 2,
      exportedAt: Date.now(),
      moodCalendar: moodData,
      customMoodOptions: customMoodOptions,
      moodTrash: moodTrash
    };
    var json = JSON.stringify(data, null, 2);
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    var now = new Date();
    a.download = 'mood-backup-' + now.getFullYear() + pad2(now.getMonth() + 1) + pad2(now.getDate()) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function triggerImport() {
    var input = document.getElementById('moodImportFileInput');
    if (input) {
      input.value = '';
      input.click();
    }
  }

  function handleImportFile(file) {
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var data = JSON.parse(e.target.result);
        if (!data || data.type !== 'mood-backup') {
          alert('文件格式不正确');
          return;
        }
        pendingImportData = data;
        // 显示导入选择器
        var overlay = document.getElementById('moodImportOverlay');
        if (overlay) overlay.classList.add('active');
      } catch (err) {
        alert('文件解析失败');
      }
    };
    reader.readAsText(file);
  }

  function confirmImport() {
    if (!pendingImportData) return;

    var importCalendar = document.getElementById('moodImportCalendar').checked;
    var importCustom = document.getElementById('moodImportCustom').checked;
    var importTrash = document.getElementById('moodImportTrash').checked;

    // 1. 合并日历
    if (importCalendar && pendingImportData.moodCalendar) {
      var srcCal = pendingImportData.moodCalendar;
      Object.keys(srcCal).forEach(function (cid) {
        if (!moodData[cid]) moodData[cid] = {};
        var srcMap = srcCal[cid];
        Object.keys(srcMap).forEach(function (ds) {
          if (!moodData[cid][ds]) {
            moodData[cid][ds] = srcMap[ds];
          } else {
            // 同一天：合并字段（不覆盖已有）
            var existing = moodData[cid][ds];
            var incoming = srcMap[ds];
            Object.keys(incoming).forEach(function (k) {
              if (existing[k] === undefined || existing[k] === '' || existing[k] === null) {
                existing[k] = incoming[k];
              }
            });
          }
        });
      });
      saveMoodData();
    }

    // 2. 合并自定义心情（按 key 去重）
    if (importCustom && Array.isArray(pendingImportData.customMoodOptions)) {
      var existingKeys = {};
      customMoodOptions.forEach(function (m) { existingKeys[m.key] = true; });
      pendingImportData.customMoodOptions.forEach(function (m) {
        if (!existingKeys[m.key]) {
          customMoodOptions.push(m);
          existingKeys[m.key] = true;
        }
      });
      saveCustomMoodOptions();
    }

    // 3. 合并回收站（按 id 去重）
    if (importTrash && Array.isArray(pendingImportData.moodTrash)) {
      var existingIds = {};
      moodTrash.forEach(function (t) { existingIds[t.id] = true; });
      pendingImportData.moodTrash.forEach(function (t) {
        if (!existingIds[t.id]) {
          moodTrash.push(t);
          existingIds[t.id] = true;
        }
      });
      saveMoodTrash();
    }

    pendingImportData = null;
    var overlay = document.getElementById('moodImportOverlay');
    if (overlay) overlay.classList.remove('active');

    renderCalendar();
    renderStats();
    renderTrash();
    alert('导入完成');
  }

  // ==================== 视图切换 ====================
  function switchView(view) {
    document.querySelectorAll('.mood-view-tab').forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-view') === view);
    });
    document.querySelectorAll('.mood-view').forEach(function (v) {
      v.classList.remove('active');
    });
    var target = document.getElementById('moodView' + view.charAt(0).toUpperCase() + view.slice(1));
    if (target) target.classList.add('active');

    if (view === 'calendar') renderCalendar();
    else if (view === 'stats') renderStats();
    else if (view === 'trash') renderTrash();
  }

  // ==================== 进入 / 离开页面 ====================
  function enterMoodPage() {
    refreshCurrentContact();
    // 自动生成对方今日心情
    checkPartnerDailyMood();
    // 默认显示日历视图
    switchView('calendar');
  }

  // ==================== 事件绑定 ====================
  function bindEvents() {
    // 主页入口
    var btnMood = document.getElementById('btnMood');
    if (btnMood) {
      btnMood.addEventListener('click', function (e) {
        e.preventDefault();
        if (window.showPage && window.pageMood) {
          window.showPage(window.pageMood);
          enterMoodPage();
        } else {
          alert('页面切换模块未加载');
        }
      });
    }

    // 返回主页
    var backBtn = document.getElementById('moodBackBtn');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        if (window.showPage && window.pageHome) {
          window.showPage(window.pageHome);
        }
      });
    }

    // 视图 tab
    document.querySelectorAll('.mood-view-tab').forEach(function (t) {
      t.addEventListener('click', function () {
        switchView(t.getAttribute('data-view'));
      });
    });

    // 月份切换
    var prevBtn = document.getElementById('moodPrevMonth');
    var nextBtn = document.getElementById('moodNextMonth');
    if (prevBtn) {
      prevBtn.addEventListener('click', function () {
        viewMonth--;
        if (viewMonth < 0) { viewMonth = 11; viewYear--; }
        renderCalendar();
        renderStats();
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        viewMonth++;
        if (viewMonth > 11) { viewMonth = 0; viewYear++; }
        renderCalendar();
        renderStats();
      });
    }

    // 编辑器
    var editorClose = document.getElementById('moodEditorClose');
    if (editorClose) editorClose.addEventListener('click', closeEditor);
    var editorOverlay = document.getElementById('moodEditorOverlay');
    if (editorOverlay) {
      editorOverlay.addEventListener('click', function (e) {
        if (e.target === editorOverlay) closeEditor();
      });
    }

    var tabMe = document.getElementById('moodEditorTabMe');
    if (tabMe) {
      tabMe.addEventListener('click', function () {
        if (editorState.target === 'me') return;
        editorState.target = 'me';
        openEditor(editorState.dateStr, 'me', editorState.page);
      });
    }
    var tabPartner = document.getElementById('moodEditorTabPartner');
    if (tabPartner) {
      tabPartner.addEventListener('click', function () {
        if (editorState.target === 'partner') return;
        editorState.target = 'partner';
        openEditor(editorState.dateStr, 'partner', editorState.page);
      });
    }

    // 自定义心情
    var addBtn = document.getElementById('moodCustomAddBtn');
    if (addBtn) addBtn.addEventListener('click', openCustomModal);
    var customCancel = document.getElementById('moodCustomCancel');
    if (customCancel) customCancel.addEventListener('click', closeCustomModal);
    var customConfirm = document.getElementById('moodCustomConfirm');
    if (customConfirm) customConfirm.addEventListener('click', saveCustomMood);
    var customModal = document.getElementById('moodCustomModal');
    if (customModal) {
      customModal.addEventListener('click', function (e) {
        if (e.target === customModal) closeCustomModal();
      });
    }

    // 详情
    var detailClose = document.getElementById('moodDetailClose');
    if (detailClose) detailClose.addEventListener('click', closeDetail);
    var detailOverlay = document.getElementById('moodDetailOverlay');
    if (detailOverlay) {
      detailOverlay.addEventListener('click', function (e) {
        if (e.target === detailOverlay) closeDetail();
      });
    }

    // 导出 / 导入
    var exportBtn = document.getElementById('moodExportBtn');
    if (exportBtn) exportBtn.addEventListener('click', exportMoodBackup);
    var importBtn = document.getElementById('moodImportBtn');
    if (importBtn) importBtn.addEventListener('click', triggerImport);
    var importFile = document.getElementById('moodImportFileInput');
    if (importFile) {
      importFile.addEventListener('change', function () {
        var f = importFile.files && importFile.files[0];
        if (f) handleImportFile(f);
      });
    }
    var importCancel = document.getElementById('moodImportCancel');
    if (importCancel) {
      importCancel.addEventListener('click', function () {
        var overlay = document.getElementById('moodImportOverlay');
        if (overlay) overlay.classList.remove('active');
        pendingImportData = null;
      });
    }
    var importConfirm = document.getElementById('moodImportConfirm');
    if (importConfirm) importConfirm.addEventListener('click', confirmImport);
    var importOverlay = document.getElementById('moodImportOverlay');
    if (importOverlay) {
      importOverlay.addEventListener('click', function (e) {
        if (e.target === importOverlay) {
          importOverlay.classList.remove('active');
          pendingImportData = null;
        }
      });
    }

    // 监听 localStorage 变化（切换联系人）
    window.addEventListener('storage', function (e) {
      if (e.key === LS_CURRENT_KEY || e.key === LS_CONTACTS_KEY) {
        // 只有当前在手账页面时才刷新
        var pageMood = document.getElementById('pageMood');
        if (pageMood && pageMood.classList.contains('active')) {
          enterMoodPage();
        }
      }
    });
  }

  // ==================== 启动 ====================
  function init() {
    initCalendar();
    refreshCurrentContact();

    loadAllData().then(function () {
      bindEvents();
      renderCalendar();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 暴露给外部（可选）
  window.enterMoodPage = enterMoodPage;
  window.refreshMoodPage = function () {
    refreshCurrentContact();
    renderCalendar();
    renderStats();
    renderTrash();
  };

})();
