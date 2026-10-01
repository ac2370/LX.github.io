/**
 * 字卡双轨机制扩展（公共 / 专属）
 * - 在 cardDatabase 上新增 public / private 字段
 * - 独立持久化，不与原 STORE_KEY 冲突
 * - 完全独立，不修改 reply.js
 */

(function () {
  'use strict';

  if (!window.cardDatabase) {
    console.warn('[reply-modes] cardDatabase 未就绪');
    return;
  }

  var STORE_KEY_MODES = 'cardDatabase_modes';

  // ==================== 初始化字段 ====================
  if (!window.cardDatabase.public) window.cardDatabase.public = [];
  if (!window.cardDatabase.private) window.cardDatabase.private = {};

  // ==================== 持久化 ====================
  function persistModes() {
    var data = {
      public: window.cardDatabase.public,
      private: window.cardDatabase.private
    };
    if (typeof localforage !== 'undefined') {
      localforage.setItem(STORE_KEY_MODES, data).catch(function () {});
    } else {
      try { localStorage.setItem(STORE_KEY_MODES, JSON.stringify(data)); } catch (e) {}
    }
  }

  function loadModes(callback) {
    function apply(d) {
      if (d && typeof d === 'object') {
        window.cardDatabase.public = Array.isArray(d.public) ? d.public : [];
        window.cardDatabase.private = (d.private && typeof d.private === 'object') ? d.private : {};
      }
      if (callback) callback();
    }
    if (typeof localforage !== 'undefined') {
      localforage.getItem(STORE_KEY_MODES).then(apply).catch(function () { apply(null); });
    } else {
      try {
        var raw = localStorage.getItem(STORE_KEY_MODES);
        apply(raw ? JSON.parse(raw) : null);
      } catch (e) { apply(null); }
    }
  }

  // ==================== API ====================
  window.cardDatabase.getPublic = function () {
    return window.cardDatabase.public || [];
  };
  window.cardDatabase.getPrivate = function (contactId) {
    if (!contactId) return [];
    return (window.cardDatabase.private && window.cardDatabase.private[contactId]) || [];
  };
  window.cardDatabase.addPublic = function (value, autoDedup) {
    if (!value) return;
    var arr = window.cardDatabase.public;
    if (autoDedup && arr.indexOf(value) >= 0) return;
    arr.push(value);
    persistModes();
  };
  window.cardDatabase.addPublicMany = function (values, autoDedup) {
    if (!Array.isArray(values)) return;
    values.forEach(function (v) { window.cardDatabase.addPublic(v, autoDedup); });
  };
  window.cardDatabase.addPrivate = function (contactId, value, autoDedup) {
    if (!contactId || !value) return;
    if (!window.cardDatabase.private[contactId]) window.cardDatabase.private[contactId] = [];
    var arr = window.cardDatabase.private[contactId];
    if (autoDedup && arr.indexOf(value) >= 0) return;
    arr.push(value);
    persistModes();
  };
  window.cardDatabase.addPrivateMany = function (contactId, values, autoDedup) {
    if (!contactId || !Array.isArray(values)) return;
    values.forEach(function (v) { window.cardDatabase.addPrivate(contactId, v, autoDedup); });
  };
  window.cardDatabase.removePublic = function (value) {
    var arr = window.cardDatabase.public;
    var idx = arr.indexOf(value);
    if (idx >= 0) { arr.splice(idx, 1); persistModes(); }
  };
  window.cardDatabase.removePrivate = function (contactId, value) {
    if (!contactId) return;
    var arr = window.cardDatabase.private[contactId];
    if (!arr) return;
    var idx = arr.indexOf(value);
    if (idx >= 0) { arr.splice(idx, 1); persistModes(); }
  };
  window.cardDatabase.clearPublic = function () {
    window.cardDatabase.public.length = 0;
    persistModes();
  };
  window.cardDatabase.clearPrivate = function (contactId) {
    if (!contactId) return;
    window.cardDatabase.private[contactId] = [];
    persistModes();
  };
  window.cardDatabase.persistModes = persistModes;

  // ==================== 加载 ====================
  function init() {
    loadModes(function () {
      window.dispatchEvent(new Event('cardModesReady'));
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
