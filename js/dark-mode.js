/**
 * 全局昼夜模式（独立模块）
 * - 在顶部导航栏新增切换按钮
 * - 通过 CSS 变量切换全局颜色
 * - 使用 localStorage 持久化
 */

(function () {
  'use strict';

  var STORE_KEY = 'global_dark_mode';

  // ==================== 读取状态 ====================
  function getDark() {
    try {
      return localStorage.getItem(STORE_KEY) === '1';
    } catch (e) { return false; }
  }

  function saveDark(v) {
    try {
      localStorage.setItem(STORE_KEY, v ? '1' : '0');
    } catch (e) {}
  }

  // ==================== 应用 ====================
  function apply(dark) {
    document.documentElement.classList.toggle('dark-mode', dark);
    // 更新按钮图标
    var btn = document.getElementById('darkModeBtn');
    if (btn) {
      var icon = btn.querySelector('i');
      if (icon) {
        icon.className = dark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
      }
    }
  }

  // ==================== 切换 ====================
  function toggle() {
    var next = !getDark();
    saveDark(next);
    apply(next);
  }

  // ==================== 创建按钮 ====================
  function createButton() {
    if (document.getElementById('darkModeBtn')) return;

    // 找到主页底部导航栏（更符合"顶部导航栏"的视觉位置，但主页底部 tab 更显眼）
    // 用户说"顶部导航栏"，但主页没有顶部导航栏，只有传讯页面有
    // 为避免影响传讯页面的图标布局，我把按钮放到传讯页面的 chat-actions 里
    // 同时也放到主页底部 tab 上方（作为全局按钮更合理）

    // 方案：加到传讯页面 chat-actions 里（因为用户说顶部导航栏）
    var chatActions = document.querySelector('#pageChat .chat-actions');
    if (chatActions) {
      var btn = document.createElement('div');
      btn.className = 'chat-action-icon';
      btn.id = 'darkModeBtn';
      btn.title = '昼夜模式';
      btn.innerHTML = '<i class="fa-solid fa-moon"></i>';
      btn.addEventListener('click', toggle);
      chatActions.appendChild(btn);
    }
  }

  // ==================== 初始化 ====================
  function init() {
    apply(getDark());
    createButton();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 稍后再次执行，确保传讯页面已渲染
  setTimeout(function () {
    apply(getDark());
    createButton();
  }, 500);

  // 暴露给外部
  window.darkMode = {
    toggle: toggle,
    isDark: getDark
  };

})();
