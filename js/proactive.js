/**
 * 主动消息模块（每个联系人独立定时器版）
 * - 遍历 my_contacts，给每个联系人各起一个定时器
 * - 每个联系人按各自间隔（当前暂用默认 10-30 分钟；第二步接 UI 配置）
 * - 到点调 window.triggerChatAutoReply(contactId) 发给指定联系人
 * - 页面不可见时全部暂停，可见时恢复
 * - 依赖：window.getReplySettings() / window.triggerChatAutoReply(contactId)
 *
 * 本版（第一步）：
 * - 一个 timer 改为「每联系人一个」（timers map）
 * - 间隔暂用默认 DEFAULT_MIN/DEFAULT_MAX（10-30 分钟）
 * - 第二步会改成读 reply_settings_v1.proactivePerContact
 */

(function () {
  'use strict';

  var MIN_GAP_MS = 5000;   // 保险：最短 5 秒

  // 第一步：默认间隔（秒），第二步会被 UI 配置覆盖
  var DEFAULT_MIN_SEC = 10 * 60;   // 10 分钟
  var DEFAULT_MAX_SEC = 30 * 60;   // 30 分钟

  // 每个联系人一个 timer：{ 'contact_xxx': { timerId, nextFireAt } }
  var timers = {};

  // ==================== 设置 ====================
  function getSettings() {
    if (typeof window.getReplySettings === 'function') {
      return window.getReplySettings();
    }
    return {};
  }

  // 总开关
  function isProactiveOn() {
    return !!getSettings().proactive;
  }

  // 读联系人列表
  function loadContacts() {
    try {
      var arr = JSON.parse(localStorage.getItem('my_contacts') || '[]');
      if (Array.isArray(arr)) return arr.filter(function (c) { return c && c.id; });
    } catch (e) {}
    return [];
  }

  // 取某联系人的间隔（秒）——第一步：读 proactivePerContact，没有就默认
  function getGapSecondsFor(contactId) {
    var s = getSettings();
    var per = s.proactivePerContact;
    if (per && typeof per === 'object' && per[contactId]) {
      var cfg = per[contactId];
      var mn = Number(cfg.min);
      var mx = Number(cfg.max);
      if (isFinite(mn) && mn >= 1 && isFinite(mx) && mx >= mn) {
        return { min: mn, max: mx };
      }
    }
    // 默认
    return { min: DEFAULT_MIN_SEC, max: DEFAULT_MAX_SEC };
  }

  function randomGapMsFor(contactId) {
    var g = getGapSecondsFor(contactId);
    var lo = Math.max(MIN_GAP_MS, g.min * 1000);
    var hi = Math.max(lo, g.max * 1000);
    return lo + Math.floor(Math.random() * (hi - lo + 1));
  }

  // ==================== 页面可见性 ====================
  function isPageVisible() {
    return document.visibilityState !== 'hidden';
  }

  // ==================== 定时器管理 ====================
  function clearTimerFor(contactId) {
    var t = timers[contactId];
    if (t && t.timerId) {
      clearTimeout(t.timerId);
    }
    delete timers[contactId];
  }

  function clearAllTimers() {
    Object.keys(timers).forEach(function (cid) { clearTimerFor(cid); });
  }

  function scheduleNextFor(contactId, delayMs) {
    clearTimerFor(contactId);
    if (!isProactiveOn()) return;
    var wait = (typeof delayMs === 'number') ? delayMs : randomGapMsFor(contactId);
    var timerId = setTimeout(function () { fire(contactId); }, wait);
    timers[contactId] = {
      timerId: timerId,
      nextFireAt: Date.now() + wait,
      paused: false,
      remain: 0
    };
    console.log('[proactive] 「' + contactId + '」下次主动消息将在 ' + (wait / 1000).toFixed(1) + ' 秒后');
  }

  // ==================== 触发 ====================
  function fire(contactId) {
    if (timers[contactId]) {
      timers[contactId].timerId = null;
    }

    if (!isPageVisible()) {
      console.log('[proactive] 页面不可见，跳过 ' + contactId);
      return;
    }
    if (!isProactiveOn()) {
      console.log('[proactive] 总开关已关闭，停止 ' + contactId);
      return;
    }

    // 检查联系人是否还存在
    var contacts = loadContacts();
    var exists = contacts.some(function (c) { return c.id === contactId; });
    if (!exists) {
      console.log('[proactive] 联系人已删除，停止其定时器 ' + contactId);
      clearTimerFor(contactId);
      return;
    }

    // 20% 概率改发问卷（问卷是"Ta 的问卷"，发给指定联系人）
    var surveyChance = 0.20;
    var canPushSurvey = !!(
      window.dreamSurveyFromTa &&
      typeof window.dreamSurveyFromTa.generateAndSave === 'function' &&
      typeof window.dreamSurveyFromTa.pushToChat === 'function'
    );

    if (Math.random() < surveyChance && canPushSurvey) {
      try {
        var s2 = window.dreamSurveyFromTa.generateAndSave();
        if (s2) {
          window.dreamSurveyFromTa.pushToChat(s2.id);
          console.log('[proactive] 已给「' + contactId + '」触发一次问卷');
        } else {
          if (typeof window.triggerChatAutoReply === 'function') {
            window.triggerChatAutoReply(contactId);
          }
        }
      } catch (e) {
        console.warn('[proactive] 问卷触发失败', e);
        try { window.triggerChatAutoReply(contactId); } catch (e2) {}
      }
    } else {
      if (typeof window.triggerChatAutoReply === 'function') {
        try {
          window.triggerChatAutoReply(contactId);
          console.log('[proactive] 已给「' + contactId + '」触发一次主动消息');
        } catch (e) {
          console.warn('[proactive] 触发失败', e);
        }
      } else {
        console.warn('[proactive] window.triggerChatAutoReply 不存在');
      }
    }

    // 安排下一次
    scheduleNextFor(contactId);
  }

  // ==================== 启动 / 停止 ====================
  function start() {
    if (!isProactiveOn()) {
      stop();
      return;
    }
    var contacts = loadContacts();
    contacts.forEach(function (c) {
      if (!timers[c.id]) scheduleNextFor(c.id);
    });
  }

  function stop() {
    clearAllTimers();
    console.log('[proactive] 已停止全部定时器');
  }

  // 联系人列表变化时：给新联系人补 timer，给已删联系人清 timer
  function syncContacts() {
    if (!isProactiveOn()) return;
    var contacts = loadContacts();
    var validIds = {};
    contacts.forEach(function (c) { validIds[c.id] = true; });

    // 清掉已删联系人的 timer
    Object.keys(timers).forEach(function (cid) {
      if (!validIds[cid]) clearTimerFor(cid);
    });
    // 给新联系人补 timer
    contacts.forEach(function (c) {
      if (!timers[c.id]) scheduleNextFor(c.id);
    });
  }

  // ==================== 外部通知：设置变更 ====================
  window.addEventListener('replySettingsChanged', function () {
    var s = getSettings();
    if (s.proactive) {
      // 重新计时（全部重排）
      stop();
      start();
    } else {
      stop();
    }
  });

  // ==================== 页面可见性 ====================
  document.addEventListener('visibilitychange', function () {
    if (!isProactiveOn()) return;

    if (document.visibilityState === 'hidden') {
      // 记录剩余时间，全部暂停
      Object.keys(timers).forEach(function (cid) {
        var t = timers[cid];
        if (t && t.timerId && t.nextFireAt) {
          var remain = t.nextFireAt - Date.now();
          if (remain < 1000) remain = 1000;
          clearTimeout(t.timerId);
          t.timerId = null;
          t.paused = true;
          t.remain = remain;
        }
      });
      console.log('[proactive] 页面隐藏，全部暂停');
    } else {
      // 恢复
      Object.keys(timers).forEach(function (cid) {
        var t = timers[cid];
        if (t && t.paused) {
          var remain = t.remain || 1000;
          t.paused = false;
          scheduleNextFor(cid, remain);
        }
      });
      // 如果之前完全没有 timer（比如开关刚开），补上
      syncContacts();
      console.log('[proactive] 页面可见，恢复');
    }
  });

  // ==================== 联系人变化监听 ====================
  window.addEventListener('contactChanged', syncContacts);
  window.addEventListener('storage', function (e) {
    if (e.key === 'my_contacts') syncContacts();
  });

  // ==================== 初始化 ====================
  function init() {
    setTimeout(function () {
      if (isProactiveOn()) start();
    }, 800);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ==================== 暴露 ====================
  window.proactive = {
    start: start,
    stop: stop,
    sync: syncContacts,
    fire: function (contactId) { fire(contactId); },
    status: function () {
      var out = {};
      Object.keys(timers).forEach(function (cid) {
        var t = timers[cid];
        out[cid] = {
          active: !!t.timerId,
          paused: !!t.paused,
          remainMs: t.nextFireAt ? (t.nextFireAt - Date.now()) : null
        };
      });
      return out;
    }
  };

  console.log('[proactive] 模块已加载（每联系人独立定时器版）');
})();
