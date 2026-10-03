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
 *   proactive, proactiveMin, proactiveMax
 * }
 */

(function () {
  'use strict';

  var STORE_KEY = 'reply_settings_v1';

  var modal = document.getElementById('replySettingsModal');
  var openBtn = document.getElementById('cardEditBtn');
  var closeBtn = document.getElementById('replySettingsClose');

  if (!modal || !openBtn) {
    console.warn('[reply-settings] 缺少必要 DOM，跳过初始化');
    return;
  }

  // ==================== 默认值 ====================
  var DEFAULTS = {
    // 回复节奏
    normalReply:     true,
    minWait:         3,
    maxWait:         12,
    minCount:        0,
    maxCount:        3,
    kaomoji:         false,
    typingBubble:    true,
    // 已读/状态（UI 有，逻辑后续再接）
    readStatus:      false,
    autoReply:       false,
    // 通讯节奏
    commMinWait:     10,
    commMaxWait:     60,
    // 引用/反应
    quote:           true,
    reaction:        true,
    // 主动消息
    proactive:       false,
    proactiveMin:    120,
    proactiveMax:    300
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
      if (saved && typeof saved[k] === typeof DEFAULTS[k]) {
        settings[k] = saved[k];
      } else {
        settings[k] = DEFAULTS[k];
      }
    });
  }

  function persistSettings() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn('[reply-settings] 持久化失败', e);
    }
    // 主动消息模块（阶段 2）会监听这个事件
    try {
      window.dispatchEvent(new CustomEvent('replySettingsChanged', { detail: settings }));
    } catch (e) {}
  }

  // ==================== 控件 ID ↔ 字段名映射 ====================
  var FIELD_MAP = {
    // 回复节奏
    toggleNormalReply:    { key: 'normalReply',  type: 'bool' },
    inputMinWait:         { key: 'minWait',      type: 'int',  min: 1,  max: 600 },
    inputMaxWait:         { key: 'maxWait',      type: 'int',  min: 1,  max: 600 },
    inputMinCount:        { key: 'minCount',     type: 'int',  min: 0,  max: 10 },
    inputMaxCount:        { key: 'maxCount',     type: 'int',  min: 0,  max: 10 },
    toggleKaomoji:        { key: 'kaomoji',      type: 'bool' },
    toggleTypingBubble:   { key: 'typingBubble', type: 'bool' },
    // 已读/状态
    toggleReadStatus:     { key: 'readStatus',   type: 'bool' },
    toggleAutoReply:      { key: 'autoReply',    type: 'bool' },
    // 通讯节奏
    inputCommMinWait:     { key: 'commMinWait',  type: 'int',  min: 1,  max: 600 },
    inputCommMaxWait:     { key: 'commMaxWait',  type: 'int',  min: 1,  max: 600 },
    // 引用/反应
    toggleQuote:          { key: 'quote',        type: 'bool' },
    toggleReaction:       { key: 'reaction',     type: 'bool' },
    // 主动消息
    toggleProactive:      { key: 'proactive',    type: 'bool' },
    inputProactiveMin:    { key: 'proactiveMin', type: 'int',  min: 10, max: 10800 },
    inputProactiveMax:    { key: 'proactiveMax', type: 'int',  min: 10, max: 10800 }
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
        // min/max 交叉校验
        crossValidate();
        persistSettings();
      });

      // 数字框失焦时也回填一下（防用户输入越界值后没触发 input）
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
  }

  // ==================== min/max 交叉校验 ====================
  function crossValidate() {
    // 等待时间
    if (settings.maxWait < settings.minWait) {
      settings.maxWait = settings.minWait;
      var elMaxWait = document.getElementById('inputMaxWait');
      if (elMaxWait) elMaxWait.value = settings.maxWait;
    }
    // 连发条数
    if (settings.maxCount < settings.minCount) {
      settings.maxCount = settings.minCount;
      var elMaxCount = document.getElementById('inputMaxCount');
      if (elMaxCount) elMaxCount.value = settings.maxCount;
    }
    // 通讯节奏
    if (settings.commMaxWait < settings.commMinWait) {
      settings.commMaxWait = settings.commMinWait;
      var elCommMax = document.getElementById('inputCommMaxWait');
      if (elCommMax) elCommMax.value = settings.commMaxWait;
    }
    // 主动消息
    if (settings.proactiveMax < settings.proactiveMin) {
      settings.proactiveMax = settings.proactiveMin;
      var elProMax = document.getElementById('inputProactiveMax');
      if (elProMax) elProMax.value = settings.proactiveMax;
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
    proactive: document.getElementById('panel-proactive'),
    quote:     document.getElementById('panel-quote')
  };
  tabBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var tab = btn.getAttribute('data-tab');
      tabBtns.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      Object.keys(panels).forEach(function (key) {
        if (panels[key]) panels[key].classList.toggle('active', key === tab);
      });
    });
  });

  // ==================== 初始化 ====================
  loadSettings();
  bindControls();
  applySettingsToUI();

  // ==================== 暴露给外部 ====================
  // chat.js / proactive.js 通过 window.getReplySettings() 读取
  window.getReplySettings = function () {
    // 返回副本，避免外部改坏
    var out = {};
    Object.keys(settings).forEach(function (k) { out[k] = settings[k]; });
    return out;
  };

  // 也暴露一个写接口，方便其它模块改（如自动回复触发时更新）
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
      Object.keys(DEFAULTS).forEach(function (k) { settings[k] = DEFAULTS[k]; });
      persistSettings();
      applySettingsToUI();
    },
    defaults: DEFAULTS,
    storeKey: STORE_KEY
  };

  console.log('[reply-settings] 已初始化，当前设置：', settings);
})();
