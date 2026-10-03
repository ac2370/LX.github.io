/**
 * 字卡数据库底层（保留 cardDatabase 对象定义 + 持久化）
 * - 只负责：定义 window.cardDatabase、提供 get/add/remove/clear/persist
 * - 不再预设默认字卡（默认字卡交给 card.js 的 migrateOldData 处理）
 * - reply 字段初始化为 { "默认分组": [] } 分组对象，与 card.js 对齐
 */

(function () {
  'use strict';

  // ==================== 全局数据对象 ====================
  // 注意：reply / pat / place / mood 都是分组对象；emoji / sticker 是数组
  window.cardDatabase = {
    reply:   { '默认分组': [] },
    pat:     { '默认分组': [] },
    place:   { '默认分组': [] },
    mood:    { '默认分组': [] },
    emoji:   [],
    sticker: [],
    status:  []
  };

  // ==================== localforage 配置 ====================
  var hasLocalforage = typeof localforage !== 'undefined';
  var STORE_KEY = 'cardDatabase_v3';

  // ==================== 保存 ====================
  function persist() {
    var data = {
      reply:   window.cardDatabase.reply,
      pat:     window.cardDatabase.pat,
      place:   window.cardDatabase.place,
      mood:    window.cardDatabase.mood,
      emoji:   window.cardDatabase.emoji,
      sticker: window.cardDatabase.sticker,
      status:  window.cardDatabase.status
    };
    if (hasLocalforage) {
      localforage.setItem(STORE_KEY, data).catch(function (e) {
        console.warn('[cardDatabase] localforage 保存失败', e);
      });
    } else {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(data));
      } catch (e) {
        console.warn('[cardDatabase] localStorage 保存失败', e);
      }
    }
  }

  // ==================== 加载 ====================
  function load(callback) {
    function applyData(data) {
      if (!data) {
        // 没数据：保持空结构，让 card.js 的 migrateOldData 去做初始化
        if (callback) callback();
        return;
      }

      // reply / pat / place / mood：期望是分组对象
      // 如果读到的是数组，先按「默认分组」包起来（不丢数据）
      ['reply', 'pat', 'place', 'mood'].forEach(function (key) {
        var v = data[key];
        if (Array.isArray(v)) {
          window.cardDatabase[key] = { '默认分组': v.slice() };
        } else if (v && typeof v === 'object') {
          window.cardDatabase[key] = v;
        } else {
          window.cardDatabase[key] = { '默认分组': [] };
        }
      });

      // emoji / sticker / status：数组
      window.cardDatabase.emoji   = Array.isArray(data.emoji)   ? data.emoji   : [];
      window.cardDatabase.sticker = Array.isArray(data.sticker) ? data.sticker : [];
      window.cardDatabase.status  = Array.isArray(data.status)  ? data.status  : [];

      if (callback) callback();
    }

    if (hasLocalforage) {
      localforage.getItem(STORE_KEY).then(function (data) {
        applyData(data);
      }).catch(function (e) {
        console.warn('[cardDatabase] localforage 读取失败', e);
        applyData(null);
      });
    } else {
      try {
        var raw = localStorage.getItem(STORE_KEY);
        applyData(raw ? JSON.parse(raw) : null);
      } catch (e) {
        applyData(null);
      }
    }
  }

  // ==================== 对外 API ====================

  window.cardDatabase.get = function (category) {
    if (category === 'reply')   return window.cardDatabase.reply;
    if (category === 'pat')     return window.cardDatabase.pat;
    if (category === 'place')   return window.cardDatabase.place;
    if (category === 'mood')    return window.cardDatabase.mood;
    if (category === 'emoji')   return window.cardDatabase.emoji;
    if (category === 'sticker') return window.cardDatabase.sticker;
    if (category === 'status')  return window.cardDatabase.status;
    return [];
  };

  // 添加一条（自动去重）—— 仅用于数组类分类（emoji / sticker / status）
  window.cardDatabase.add = function (category, value, autoDedup) {
    if (!value) return;
    var arr = window.cardDatabase.get(category);
    if (!Array.isArray(arr)) return;
    if (autoDedup && arr.indexOf(value) >= 0) return;
    arr.push(value);
    persist();
  };

  window.cardDatabase.addMany = function (category, values, autoDedup) {
    if (!Array.isArray(values)) return;
    values.forEach(function (v) {
      window.cardDatabase.add(category, v, autoDedup);
    });
  };

  window.cardDatabase.remove = function (category, value) {
    var arr = window.cardDatabase.get(category);
    if (!Array.isArray(arr)) return;
    var idx = arr.indexOf(value);
    if (idx >= 0) {
      arr.splice(idx, 1);
      persist();
    }
  };

  window.cardDatabase.clear = function (category) {
    var arr = window.cardDatabase.get(category);
    if (!Array.isArray(arr)) return;
    arr.length = 0;
    persist();
  };

  window.cardDatabase.deduplicate = function (category) {
    var arr = window.cardDatabase.get(category);
    if (!Array.isArray(arr)) return;
    var seen = new Set();
    var result = arr.filter(function (item) {
      if (seen.has(item)) return false;
      seen.add(item);
      return true;
    });
    arr.length = 0;
    result.forEach(function (item) { arr.push(item); });
    persist();
  };

  window.cardDatabase.persist = persist;

  window.cardDatabase.reload = function (callback) {
    load(callback);
  };

  // ==================== 初始化 ====================
  load(function () {
    window.cardDatabase.ready = true;
    window.dispatchEvent(new Event('cardDatabaseReady'));
  });

})();
