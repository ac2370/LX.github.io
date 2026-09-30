/**
 * 全局昼夜模式（独立模块）
 * - 点击传讯页顶栏的月亮图标切换
 * - 通过 CSS 变量影响所有页面
 * - 使用 localforage 持久化
 * - 完全独立，不影响任何现有逻辑
 */

(function () {
  'use strict';

  var STORE_KEY = 'theme_mode';
  var currentMode = 'light'; // 'light' | 'dark'

  // ==================== 持久化 ====================
  function persist() {
    if (typeof localforage !== 'undefined') {
      localforage.setItem(STORE_KEY, currentMode).catch(function () {});
    } else {
      try { localStorage.setItem(STORE_KEY, currentMode); } catch (e) {}
    }
  }

  function load(callback) {
    if (typeof localforage !== 'undefined') {
      localforage.getItem(STORE_KEY).then(function (val) {
        if (val === 'dark' || val === 'light') currentMode = val;
        if (callback) callback();
      }).catch(function () { if (callback) callback(); });
    } else {
      try {
        var raw = localStorage.getItem(STORE_KEY);
        if (raw === 'dark' || raw === 'light') currentMode = raw;
      } catch (e) {}
      if (callback) callback();
    }
  }

  // ==================== 应用模式 ====================
  function applyMode() {
    var body = document.body;
    if (currentMode === 'dark') {
      body.classList.add('theme-dark');
    } else {
      body.classList.remove('theme-dark');
    }
    // 更新月亮图标
    var moonIcon = document.querySelector('.chat-action-icon[title="月亮"]');
    if (moonIcon) {
      var i = moonIcon.querySelector('i');
      if (i) {
        if (currentMode === 'dark') {
          i.className = 'fa-solid fa-sun';
        } else {
          i.className = 'fa-solid fa-moon';
        }
      }
    }
  }

  // ==================== 切换 ====================
  function toggle() {
    currentMode = currentMode === 'dark' ? 'light' : 'dark';
    applyMode();
    persist();
  }

  // ==================== 绑定月亮图标 ====================
  function bindMoonIcon() {
    var moonIcon = document.querySelector('.chat-action-icon[title="月亮"]');
    if (!moonIcon) return;
    if (moonIcon.dataset.themeBound) return;
    moonIcon.dataset.themeBound = '1';
    moonIcon.style.cursor = 'pointer';
    moonIcon.addEventListener('click', function (e) {
      e.stopImmediatePropagation();
      e.preventDefault();
      toggle();
    }, true);
  }

  // ==================== 初始化 ====================
  function init() {
    load(function () {
      applyMode();
      bindMoonIcon();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 延迟重新绑定（确保其他脚本不会覆盖）
  setTimeout(bindMoonIcon, 500);
  setTimeout(bindMoonIcon, 1500);

  // 暴露给外部
  window.themeMode = {
    toggle: toggle,
    get: function () { return currentMode; }
  };

})();
