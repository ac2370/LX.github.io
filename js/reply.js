/**
 * 字卡数据库（分类存储 + localforage 持久化）
 * - reply:    回复分类（纯文字）
 * - emoji:    颜文字分类（纯文字）
 * - sticker:  表情包分类（图片链接）
 *
 * 严格限定：传讯自动回复只从 reply / emoji 抽文字，从 sticker 抽图片
 */

(function () {
  'use strict';

  // ==================== 全局数据对象 ====================
  window.cardDatabase = {
    reply: [],
    emoji: [],
    sticker: []
  };

  // ==================== localforage 配置 ====================
  // 若未引入 localforage，则降级为 localStorage
  var hasLocalforage = typeof localforage !== 'undefined';

  var STORE_KEY = 'cardDatabase_v3';

  // ==================== 保存到本地 ====================
  function persist() {
    var data = {
      reply: window.cardDatabase.reply,
      emoji: window.cardDatabase.emoji,
      sticker: window.cardDatabase.sticker
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

  // ==================== 从本地加载 ====================
  function load(callback) {
    function applyData(data) {
      if (!data) {
        // 首次进入：初始化默认回复字卡
        window.cardDatabase.reply = [
          '今天天气很好',
          '在想你',
          '记得按时吃饭',
          '早点休息，别熬夜',
          '我一直在的',
          '抱抱你'
        ];
        window.cardDatabase.emoji = [];
        window.cardDatabase.sticker = [];
        persist();
        if (callback) callback();
        return;
      }
      window.cardDatabase.reply = Array.isArray(data.reply) ? data.reply : [];
      window.cardDatabase.emoji = Array.isArray(data.emoji) ? data.emoji : [];
      window.cardDatabase.sticker = Array.isArray(data.sticker) ? data.sticker : [];
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

  // 获取指定分类的数组引用
  window.cardDatabase.get = function (category) {
    if (category === 'reply') return window.cardDatabase.reply;
    if (category === 'emoji') return window.cardDatabase.emoji;
    if (category === 'sticker') return window.cardDatabase.sticker;
    return [];
  };

  // 添加一条（自动去重）
  window.cardDatabase.add = function (category, value, autoDedup) {
    if (!value) return;
    var arr = window.cardDatabase.get(category);
    if (!arr) return;
    if (autoDedup && arr.indexOf(value) >= 0) return;
    arr.push(value);
    persist();
  };

  // 批量添加
  window.cardDatabase.addMany = function (category, values, autoDedup) {
    if (!Array.isArray(values)) return;
    values.forEach(function (v) {
      window.cardDatabase.add(category, v, autoDedup);
    });
  };

  // 删除一条
  window.cardDatabase.remove = function (category, value) {
    var arr = window.cardDatabase.get(category);
    if (!arr) return;
    var idx = arr.indexOf(value);
    if (idx >= 0) {
      arr.splice(idx, 1);
      persist();
    }
  };

  // 清空某一分类
  window.cardDatabase.clear = function (category) {
    var arr = window.cardDatabase.get(category);
    if (!arr) return;
    arr.length = 0;
    persist();
  };

  // 去重
  window.cardDatabase.deduplicate = function (category) {
    var arr = window.cardDatabase.get(category);
    if (!arr) return;
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

  // 手动保存
  window.cardDatabase.persist = persist;

  // 重新加载（供外部刷新）
  window.cardDatabase.reload = function (callback) {
    load(callback);
  };

  // ==================== 初始化 ====================
  load(function () {
    // 暴露就绪标志
    window.cardDatabase.ready = true;
    // 触发自定义事件，通知外部数据已就绪
    window.dispatchEvent(new Event('cardDatabaseReady'));
  });

})();
