/**
 * 公共字卡库
 * - 管理内置分组的勾选状态
 * - 提供抽卡时用的合并接口
 * - 数据源：window.DEFAULT_CARD_DATA
 * - 存储：localforage key = public_card_groups
 */

(function () {
  'use strict';

  var STORE_KEY = 'public_card_groups';
  var selectedGroups = null;       // ['生活碎片', '颜文字·开心', ...]
  var ready = false;
  var pendingCallbacks = [];

  // ==================== 工具 ====================
  function getAllGroups(category) {
    var data = window.DEFAULT_CARD_DATA || {};
    var catData = data[category || 'reply'] || {};
    return Object.keys(catData);
  }

  function getCardsByGroup(groupName, category) {
    var data = window.DEFAULT_CARD_DATA || {};
    var cat = category || 'reply';

    // 先按当前分类找
    if (data[cat] && data[cat][groupName]) {
      return data[cat][groupName].slice();
    }
    // 兜底：在整个 data 里搜
    var found = null;
    Object.keys(data).forEach(function (k) {
      if (!found && data[k] && data[k][groupName]) {
        found = data[k][groupName];
      }
    });
    return found ? found.slice() : [];
  }

  function groupExists(groupName) {
    var data = window.DEFAULT_CARD_DATA || {};
    var exists = false;
    Object.keys(data).forEach(function (k) {
      if (data[k] && data[k][groupName]) exists = true;
    });
    return exists;
  }

  // ==================== 持久化 ====================
  function persist() {
    if (typeof localforage !== 'undefined') {
      localforage.setItem(STORE_KEY, selectedGroups).catch(function (e) {
        console.warn('[public-cards] 保存失败', e);
      });
    } else {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(selectedGroups)); } catch (e) {}
    }
  }

  function load(callback) {
    function apply(data) {
      if (Array.isArray(data) && data.length > 0) {
        // 过滤掉已经不存在的分组名
        selectedGroups = data.filter(groupExists);
      } else {
        // 首次：全部勾选
        selectedGroups = getAllGroups('reply').concat(getAllGroups('pat'));
      }
      ready = true;
      if (callback) callback();
      pendingCallbacks.forEach(function (cb) { cb(); });
      pendingCallbacks = [];
      window.dispatchEvent(new Event('publicCardsReady'));
    }

    if (typeof localforage !== 'undefined') {
      localforage.getItem(STORE_KEY).then(apply).catch(function () { apply(null); });
    } else {
      try {
        var raw = localStorage.getItem(STORE_KEY);
        apply(raw ? JSON.parse(raw) : null);
      } catch (e) { apply(null); }
    }
  }

  // ==================== 对外 API ====================
  window.publicCards = {
    isReady: function () { return ready; },

    onReady: function (cb) {
      if (ready) cb();
      else pendingCallbacks.push(cb);
    },

    // 返回所有内置分组名（合并 reply + pat）
    getAllGroups: function () {
      return getAllGroups('reply').concat(getAllGroups('pat'));
    },

    // 按分类返回分组名
    getGroupsByCategory: function (category) {
      return getAllGroups(category || 'reply');
    },

    // 获取勾选状态
    getSelected: function () {
      return selectedGroups ? selectedGroups.slice() : [];
    },

    // 设置勾选状态
    setSelected: function (arr) {
      if (!Array.isArray(arr)) return;
      selectedGroups = arr.filter(groupExists);
      persist();
    },

    // 切换单个分组
    toggle: function (groupName) {
      if (!selectedGroups) selectedGroups = [];
      var i = selectedGroups.indexOf(groupName);
      if (i >= 0) selectedGroups.splice(i, 1);
      else selectedGroups.push(groupName);
      persist();
      return selectedGroups.indexOf(groupName) >= 0;
    },

    // 是否勾选
    isSelected: function (groupName) {
      return selectedGroups && selectedGroups.indexOf(groupName) >= 0;
    },

    // 返回某分组的所有字卡
    getCardsByGroup: getCardsByGroup,

    // 返回某分类下所有勾选分组的字卡合并
    getSelectedCards: function (category) {
      var cat = category || 'reply';
      var result = [];
      var groups = getAllGroups(cat);
      groups.forEach(function (g) {
        if (selectedGroups && selectedGroups.indexOf(g) >= 0) {
          var cards = getCardsByGroup(g, cat);
          result = result.concat(cards);
        }
      });
      return result;
    },

    // 返回某分组的总条数
    getGroupCount: function (groupName) {
      return getCardsByGroup(groupName).length;
    }
  };

    // ==================== 供字卡库只读展示用 ====================
  // 返回指定分类下所有内置分组（带分类标识）
  window.publicCards.getBuiltinGroups = function (category) {
    var cat = category || 'reply';
    var groups = getAllGroups(cat);
    return groups.map(function (name) {
      return {
        name: name,
        category: cat,
        count: getCardsByGroup(name, cat).length
      };
    });
  };

  // 返回某内置分组的字卡（只读）
  window.publicCards.getBuiltinCards = function (groupName, category) {
    return getCardsByGroup(groupName, category || 'reply');
  };
  
  // ==================== 初始化 ====================
  load();

})();
