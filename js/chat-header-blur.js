/* ============================================================
   chat-header-blur.js —— 传讯顶部栏模糊模式（点击清晰）· 独立增量版
   【设计原则】最大程度不改动现有代码：
   - home-settings.js / home-settings-panel.js 一字不动
   - home-settings.css / chat.css 一字不动
   - 本文件通过「对象引用注入 + 事件委托 + 动态插入」实现全部新功能：
     ① 数据：直接向 window.homeSettings.current 注入 chatHeaderBlur 字段
        （current 是对象引用，home-settings 的 persist/applyUrls 自动带上它）
     ② 面板：向「传讯背景」Tab 动态插入「顶部栏模糊」开关行
     ③ 事件：document 级委托（change 实时保存 / 调色盘打开回显 / 顶部栏点击清晰）
   - 配套样式：chat-header-blur.css（新增文件）
   引入位置：index.html 中 home-settings-panel.js 之后
   ============================================================ */
(function () {
  'use strict';

  // ==================== ① 数据字段注入 ====================
  // 老数据没有该字段时默认开启（true）
  function ensureField() {
    var hs = window.homeSettings;
    if (!hs || !hs.current) return false;
    if (hs.current.chatHeaderBlur === undefined || hs.current.chatHeaderBlur === null) {
      hs.current.chatHeaderBlur = true;
    }
    return true;
  }

  // ==================== ② 应用模糊 class ====================
  function applyHeaderBlur() {
    if (!ensureField()) return;
    var pc = document.getElementById('pageChat');
    if (!pc) return;
    pc.classList.toggle('header-blur', window.homeSettings.current.chatHeaderBlur !== false);
  }

  // 立即应用；home-settings 的 load() 是异步的（localforage），
  // 稍后再校正几次，确保持久化值被正确应用
  applyHeaderBlur();
  setTimeout(applyHeaderBlur, 300);
  setTimeout(applyHeaderBlur, 1000);

  // ==================== ③ 面板插入开关行 ====================
  var SWITCH_HTML =
      '<div class="hs-row">' +
      '  <div class="hs-label"><i class="fa-solid fa-border-all"></i>顶部栏模糊</div>' +
      '  <div class="hs-toggle-row">' +
      '    <span class="hs-toggle-desc">开启后顶部栏平时模糊（毛玻璃），点击时清晰</span>' +
      '    <label class="hs-switch">' +
      '      <input type="checkbox" id="hsChatHeaderBlur">' +
      '      <span class="hs-switch-slider"></span>' +
      '    </label>' +
      '  </div>' +
      '</div>';

  function insertSwitchIntoPanel() {
    if (document.getElementById('hsChatHeaderBlur')) return true; // 已插入
    var panel = document.getElementById('homeSettingsPanel');
    if (!panel) return false;
    var chatTab = panel.querySelector('[data-panel="chat"]');
    if (!chatTab) return false;
    // 插到「传讯背景图」行之后、提示文字之前
    var hint = chatTab.querySelector('.hs-hint');
    var wrapper = document.createElement('div');
    wrapper.innerHTML = SWITCH_HTML;
    if (hint) {
      chatTab.insertBefore(wrapper.firstChild, hint);
    } else {
      chatTab.appendChild(wrapper.firstChild);
    }
    // 回显开关状态
    syncSwitch();
    return true;
  }

  // 面板由 home-settings-panel.js 在 DOMContentLoaded 时动态创建，
  // 轮询直到面板存在
  (function waitForPanel() {
    var tries = 0;
    var timer = setInterval(function () {
      tries++;
      if (insertSwitchIntoPanel() || tries > 50) clearInterval(timer);
    }, 100);
  })();

  // ==================== ④ 开关状态回显/同步 ====================
  function syncSwitch() {
    var el = document.getElementById('hsChatHeaderBlur');
    if (!el || !window.homeSettings) return;
    el.checked = window.homeSettings.current.chatHeaderBlur !== false;
  }

  // ==================== ⑤ document 级事件委托 ====================
  document.addEventListener('change', function (e) {
    // 开关变化：实时保存（不依赖原「保存」按钮）
    if (e.target && e.target.id === 'hsChatHeaderBlur') {
      if (window.homeSettings) {
        window.homeSettings.set('chatHeaderBlur', e.target.checked);
        applyHeaderBlur();
      }
    }
  });

  document.addEventListener('click', function (e) {
    // 打开面板（调色盘按钮）后回显开关状态
    if (e.target && e.target.closest && e.target.closest('.home-settings-btn')) {
      setTimeout(syncSwitch, 0);
      return;
    }
    // 原「保存」按钮被点击时，兜底再收集一次开关状态（幂等）
    if (e.target && e.target.id === 'homeSettingsSave') {
      var el = document.getElementById('hsChatHeaderBlur');
      if (el && window.homeSettings) {
        window.homeSettings.set('chatHeaderBlur', el.checked);
        applyHeaderBlur();
      }
    }
  });

  // ==================== ⑥ 顶部栏点击清晰/模糊切换 ====================
  // 仅当模糊模式（.header-blur）开启时生效；点击顶部栏任意位置切换 .header-clear。
  // 头像/昵称点击照常触发拍一拍与角色面板，互不冲突。
  (function bindChatHeaderClear() {
    var pageChat = document.getElementById('pageChat');
    if (!pageChat) return;
    pageChat.addEventListener('click', function (e) {
      if (!pageChat.classList.contains('header-blur')) return;
      var header = pageChat.querySelector('.chat-header');
      if (!header) return;
      if (!e.target.closest('.chat-header')) return;      // 非顶部栏区域忽略
      if (e.target.closest('.quote-preview-bar')) return; // 引用预览条不参与
      header.classList.toggle('header-clear');
    });
  })();

})();
