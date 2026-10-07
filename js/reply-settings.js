/**
 * 回复设定模态框
 * - 打开 / 关闭 / tab 切换
 * - 所有控件的初始值回填（从 localStorage 读）
 * - 所有控件的改动实时持久化（写 localStorage）
 * - 暴露 window.getReplySettings() 给 chat.js 消费
 *
 * 存储 key：reply_settings_v1
 * 结构：
 * {
 *   normalReply, minWait, maxWait, minCount, maxCount,
 *   kaomoji, typingBubble, readStatus, autoReply,
 *   commMinWait, commMaxWait,
 *   quote, reaction,
 *   proactive,                      // 总开关
 *   proactivePerContact: {          // 每个联系人的间隔（秒）
 *     'contact_xxx': { min: 600, max: 1800 }
 *   }
 * }
 */

(function () {
  'use strict';

  var STORE_KEY = 'reply_settings_v1';
  var LS_CONTACTS_KEY = 'my_contacts';

  var modal = document.getElementById('replySettingsModal');
  var openBtn = document.getElementById('cardEditBtn');
  var closeBtn = document.getElementById('replySettingsClose');

  if (!modal || !openBtn) {
    console.warn('[reply-settings] 缺少必要 DOM，跳过初始化');
    return;
  }

  // ==================== 默认值 ====================
  var DEFAULT_PROACTIVE = { min: 600, max: 1800 };   // 10-30 分钟

  var DEFAULTS = {
    // 回复节奏
    normalReply:     true,
    minWait:         3,
    maxWait:         12,
    minCount:        0,
    maxCount:        3,
    typingBubble:    true,
    typingFloat:     true,
    // 已读状态
    readStatus:      false,
    readNoReply:     false,
    // 引用
    quote:           true,
    // 主动消息
    proactive:       false,
    proactivePerContact: {}
  };

  // ==================== 存储 ====================
  var settings = {};

  function loadSettings() {
    var raw = null;
    try { raw = localStorage.getItem(STORE_KEY); } catch (e) {}
    var saved = null;
    if (raw) {
      try { saved = JSON.parse(raw); } catch (e) { saved = null; }
    }
    settings = {};
    Object.keys(DEFAULTS).forEach(function (k) {
      var def = DEFAULTS[k];
      if (saved && saved[k] !== undefined) {
        // 对象类型（proactivePerContact）直接取对象
        if (typeof def === 'object' && def !== null && !Array.isArray(def)) {
          settings[k] = (typeof saved[k] === 'object' && saved[k] !== null) ? saved[k] : def;
        } else if (typeof saved[k] === typeof def) {
          settings[k] = saved[k];
        } else {
          settings[k] = def;
        }
      } else {
        // 深拷贝对象默认值
        settings[k] = (typeof def === 'object' && def !== null) ? JSON.parse(JSON.stringify(def)) : def;
      }
    });
    // 兼容：老版本有 proactiveMin/proactiveMax 全局字段，迁到"未分配"
    if (saved && (saved.proactiveMin !== undefined || saved.proactiveMax !== undefined)) {
      // 不迁移（按你的要求：每个联系人用默认值）
      // 旧的全局 min/max 不再使用
    }
  }

  function persistSettings() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn('[reply-settings] 持久化失败', e);
    }
    try {
      window.dispatchEvent(new CustomEvent('replySettingsChanged', { detail: settings }));
    } catch (e) {}
  }

  // ==================== 联系人 ====================
  function loadContacts() {
    try {
      var arr = JSON.parse(localStorage.getItem(LS_CONTACTS_KEY) || '[]');
      if (Array.isArray(arr)) return arr.filter(function (c) { return c && c.id; });
    } catch (e) {}
    return [];
  }

  // 当前选中的联系人（UI 里那个下拉）
  var selectedContactId = null;

  // 取某联系人的间隔配置（不存在则返回默认副本）
  function getPerContact(contactId) {
    if (!contactId) return { min: DEFAULT_PROACTIVE.min, max: DEFAULT_PROACTIVE.max };
    var map = settings.proactivePerContact || {};
    var cfg = map[contactId];
    if (cfg && isFinite(cfg.min) && isFinite(cfg.max)) {
      return { min: cfg.min, max: cfg.max };
    }
    return { min: DEFAULT_PROACTIVE.min, max: DEFAULT_PROACTIVE.max };
  }

  // 写某联系人的间隔配置
  function setPerContact(contactId, min, max) {
    if (!contactId) return;
    if (!settings.proactivePerContact) settings.proactivePerContact = {};
    settings.proactivePerContact[contactId] = { min: min, max: max };
  }

  // ==================== 控件 ID ↔ 字段名映射 ====================
  // 注意：proactiveMin / proactiveMax 不走这里（它们按联系人存），单独处理
  var FIELD_MAP = {
    toggleNormalReply:    { key: 'normalReply',  type: 'bool' },
    inputMinWait:         { key: 'minWait',      type: 'int',  min: 1,  max: 600 },
    inputMaxWait:         { key: 'maxWait',      type: 'int',  min: 1,  max: 600 },
    inputMinCount:        { key: 'minCount',     type: 'int',  min: 0,  max: 10 },
    inputMaxCount:        { key: 'maxCount',     type: 'int',  min: 0,  max: 10 },
    toggleTypingBubble:   { key: 'typingBubble', type: 'bool' },
    toggleTypingFloat:    { key: 'typingFloat',  type: 'bool' },
    toggleReadStatus:     { key: 'readStatus',   type: 'bool' },
    toggleReadNoReply:    { key: 'readNoReply',  type: 'bool' },
    toggleQuote:          { key: 'quote',        type: 'bool' },
    toggleProactive:      { key: 'proactive',    type: 'bool' }
  };

  // ==================== 控件回填 ====================
  function applySettingsToUI() {
    Object.keys(FIELD_MAP).forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      var field = FIELD_MAP[id];
      var val = settings[field.key];
      if (field.type === 'bool') {
        el.checked = !!val;
      } else {
        el.value = val;
      }
    });

    // 主动消息：联系人下拉 + min/max 输入框
    renderProactiveContactSelect();
    applyProactiveInputs();
  }

  // 渲染"给哪个联系人配间隔"下拉
  function renderProactiveContactSelect() {
    var sel = document.getElementById('proactiveContactSelect');
    if (!sel) return;
    var contacts = loadContacts();

    if (contacts.length === 0) {
      sel.innerHTML = '<option value="">（暂无联系人）</option>';
      selectedContactId = null;
      return;
    }
    // 保持当前选中，否则取第一个
    if (!selectedContactId || !contacts.some(function (c) { return c.id === selectedContactId; })) {
      selectedContactId = contacts[0].id;
    }

    var html = '';
    contacts.forEach(function (c) {
      html += '<option value="' + c.id + '"' + (c.id === selectedContactId ? ' selected' : '') + '>' +
              (c.name || '未命名') + '</option>';
    });
    sel.innerHTML = html;
  }

  // 把"当前选中联系人"的间隔填进 min/max 输入框
  function applyProactiveInputs() {
    var minEl = document.getElementById('inputProactiveMin');
    var maxEl = document.getElementById('inputProactiveMax');
    if (!minEl || !maxEl) return;
    var cfg = getPerContact(selectedContactId);
    minEl.value = cfg.min;
    maxEl.value = cfg.max;
  }

  // ==================== 控件事件绑定 ====================
  function clampInt(val, min, max) {
    var n = parseInt(val, 10);
    if (isNaN(n)) return min;
    if (typeof min === 'number' && n < min) n = min;
    if (typeof max === 'number' && n > max) n = max;
    return n;
  }

  function bindControls() {
    // 普通字段
    Object.keys(FIELD_MAP).forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      var field = FIELD_MAP[id];
      var evtName = (field.type === 'bool') ? 'change' : 'input';

      el.addEventListener(evtName, function () {
        if (field.type === 'bool') {
          settings[field.key] = !!el.checked;
        } else {
          settings[field.key] = clampInt(el.value, field.min, field.max);
        }
        crossValidate();
        persistSettings();
      });

      if (field.type === 'int') {
        el.addEventListener('blur', function () {
          var v = clampInt(el.value, field.min, field.max);
          el.value = v;
          settings[field.key] = v;
          crossValidate();
          persistSettings();
        });
      }
    });

    // 主动消息：联系人下拉
    var sel = document.getElementById('proactiveContactSelect');
    if (sel) {
      sel.addEventListener('change', function () {
        selectedContactId = sel.value;
        applyProactiveInputs();
      });
    }

    // 主动消息：min/max（按联系人存）
    var pMin = document.getElementById('inputProactiveMin');
    var pMax = document.getElementById('inputProactiveMax');
    if (pMin && pMax) {
      function readProactiveInputs() {
        var mn = clampInt(pMin.value, 10, 10800);
        var mx = clampInt(pMax.value, 10, 10800);
        if (mx < mn) mx = mn;
        pMin.value = mn;
        pMax.value = mx;
        setPerContact(selectedContactId, mn, mx);
        persistSettings();
      }
      pMin.addEventListener('input', readProactiveInputs);
      pMax.addEventListener('input', readProactiveInputs);
      pMin.addEventListener('blur', readProactiveInputs);
      pMax.addEventListener('blur', readProactiveInputs);
    }
  }

  // ==================== min/max 交叉校验（普通字段） ====================
  function crossValidate() {
    if (settings.maxWait < settings.minWait) {
      settings.maxWait = settings.minWait;
      var elMaxWait = document.getElementById('inputMaxWait');
      if (elMaxWait) elMaxWait.value = settings.maxWait;
    }
    if (settings.maxCount < settings.minCount) {
      settings.maxCount = settings.minCount;
      var elMaxCount = document.getElementById('inputMaxCount');
      if (elMaxCount) elMaxCount.value = settings.maxCount;
    }
  }

  // ==================== 打开 / 关闭 ====================
  function openModal() {
    applySettingsToUI();
    modal.classList.add('active');
  }
  function closeModal() {
    modal.classList.remove('active');
  }

  openBtn.addEventListener('click', openModal);
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', function (e) {
    if (e.target === modal) closeModal();
  });

  // ==================== tab 切换 ====================
  var tabBtns = document.querySelectorAll('.reply-tab-btn');
  var panels = {
    rhythm:    document.getElementById('panel-rhythm'),
    proactive: document.getElementById('panel-proactive')
  };
  tabBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var tab = btn.getAttribute('data-tab');
      tabBtns.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      Object.keys(panels).forEach(function (key) {
        if (panels[key]) panels[key].classList.toggle('active', key === tab);
      });
      // 切到主动消息 tab 时刷新下拉
      if (tab === 'proactive') {
        renderProactiveContactSelect();
        applyProactiveInputs();
      }
    });
  });

  // ==================== 初始化 ====================
  loadSettings();
  bindControls();
  applySettingsToUI();

  // ==================== 暴露给外部 ====================
  window.getReplySettings = function () {
    var out = {};
    Object.keys(settings).forEach(function (k) { out[k] = settings[k]; });
    return out;
  };

  window.setReplySettings = function (patch) {
    if (!patch || typeof patch !== 'object') return;
    Object.keys(patch).forEach(function (k) {
      if (k in DEFAULTS) settings[k] = patch[k];
    });
    crossValidate();
    persistSettings();
    applySettingsToUI();
  };

  window.replySettings = {
    get: window.getReplySettings,
    set: window.setReplySettings,
    reset: function () {
      settings = {};
      Object.keys(DEFAULTS).forEach(function (k) {
        var def = DEFAULTS[k];
        settings[k] = (typeof def === 'object' && def !== null) ? JSON.parse(JSON.stringify(def)) : def;
      });
      persistSettings();
      applySettingsToUI();
    },
    defaults: DEFAULTS,
    storeKey: STORE_KEY
  };

  console.log('[reply-settings] 已初始化，当前设置：', settings);
})();
