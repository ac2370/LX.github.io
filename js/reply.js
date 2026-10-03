/**
 * 字卡数据库工具（轻量版）
 *
 * 重要说明：
 * - 本文件不再定义 window.cardDatabase，不再读写 cardDatabase_v3
 * - 字卡数据的存储、分组、持久化全部由 js/card.js 统一负责
 * - 这里只保留一个「兜底读取」的工具函数，供 chat.js 等模块使用
 *
 * 为什么这么做：
 * - 之前 reply.js 会自己初始化 cardDatabase.reply = [] 并写入 cardDatabase_v3
 * - card.js 读写的是 my_word_cards（分组对象），两者 key 不冲突
 * - 但 reply.js 的默认数据 + card.js 的数据会互相覆盖，导致刷新后字卡变 0 条
 * - 所以 reply.js 现在只提供只读工具，不再参与数据存储
 */

(function () {
  'use strict';

  // ==================== 工具函数 ====================

  /**
   * 从 card.js 的分组接口读取所有「回复」分类的字卡
   * 优先使用 window.getGroups + window.getCardsInGroup（card.js 暴露的接口）
   * 如果 card.js 未加载，则返回空数组
   */
  function getAllReplyCards() {
    var all = [];

    // 1) 优先走 card.js 的分组接口
    if (typeof window.getGroups === 'function' && typeof window.getCardsInGroup === 'function') {
      try {
        var groups = window.getGroups('reply') || [];
        groups.forEach(function (g) {
          var arr = window.getCardsInGroup(g, 'reply') || [];
          if (Array.isArray(arr)) all = all.concat(arr);
        });
      } catch (e) {
        console.warn('[reply] 读取分组字卡失败', e);
      }
    }

    // 2) 兜底：card.js 暴露的 window.getReplyCards()
    if (all.length === 0 && typeof window.getReplyCards === 'function') {
      try {
        var alt = window.getReplyCards();
        if (Array.isArray(alt)) all = alt;
      } catch (e) {
        console.warn('[reply] getReplyCards 失败', e);
      }
    }

    return all;
  }

  /**
   * 从 card.js 的分组接口读取所有「拍一拍」分类的字卡
   */
  function getAllPatCards() {
    var all = [];

    if (typeof window.getGroups === 'function' && typeof window.getCardsInGroup === 'function') {
      try {
        var groups = window.getGroups('pat') || [];
        groups.forEach(function (g) {
          var arr = window.getCardsInGroup(g, 'pat') || [];
          if (Array.isArray(arr)) all = all.concat(arr);
        });
      } catch (e) {
        console.warn('[reply] 读取拍一拍字卡失败', e);
      }
    }

    if (all.length === 0 && typeof window.getPatCards === 'function') {
      try {
        var alt = window.getPatCards();
        if (Array.isArray(alt)) all = alt;
      } catch (e) {
        console.warn('[reply] getPatCards 失败', e);
      }
    }

    return all;
  }

  /**
   * 随机抽一条回复字卡
   * 返回字符串，没数据时返回 null
   */
  function pickRandomReply() {
    var all = getAllReplyCards();
    if (!all || all.length === 0) return null;
    return all[Math.floor(Math.random() * all.length)];
  }

  /**
   * 随机抽一条拍一拍字卡
   */
  function pickRandomPat() {
    var all = getAllPatCards();
    if (!all || all.length === 0) return null;
    return all[Math.floor(Math.random() * all.length)];
  }

  // ==================== 对外暴露 ====================
  window.reply = {
    getAllReplyCards: getAllReplyCards,
    getAllPatCards: getAllPatCards,
    pickRandomReply: pickRandomReply,
    pickRandomPat: pickRandomPat
  };

  // 兼容旧调用：以前可能有代码调 window.replyCards 或 window.getReplyCards
  // 这里不覆盖 card.js 已经暴露的 window.getReplyCards，只保证工具函数可用

})();
