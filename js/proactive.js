/**
 * 主动消息模块
 * - 监听 reply_settings_v1 的 proactive / proactiveMin / proactiveMax
 * - 开启后按随机间隔触发 window.triggerChatAutoReply()
 * - 页面不可见时暂停，重新可见时重新计时
 * - 依赖：window.getReplySettings() / window.triggerChatAutoReply()
 */

(function () {
  'use strict';

  var MIN_GAP_MS = 5000;   // 保险：最短 5 秒，防误设置成 1 秒刷屏
  var timer = null;
  var nextFireAt = 0;      // 下次触发的时间戳

  function getSettings() {
    if (typeof window.getReplySettings === 'function') {
      return window.getReplySettings();
    }
    return {};
  }

  function isPageVisible() {
    return document.visibilityState !== 'hidden';
  }

  function isChatPageActive() {
    var p = document.getElementById('pageChat');
    return p && p.classList.contains('active');
  }

  function randomGapMs() {
    var s = getSettings();
    var minSec = Number(s.proactiveMin);
    var maxSec = Number(s.proactiveMax);
    if (!isFinite(minSec) || minSec < 1) minSec = 120;
    if (!isFinite(maxSec) || maxSec < minSec) maxSec = minSec;
    var lo = Math.max(MIN_GAP_MS, minSec * 1000);
    var hi = Math.max(lo, maxSec * 1000);
    return lo + Math.floor(Math.random() * (hi - lo + 1));
  }

  function clearTimer() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    nextFireAt = 0;
  }

  function scheduleNext(delayMs) {
    clearTimer();
    var wait = (typeof delayMs === 'number') ? delayMs : randomGapMs();
    nextFireAt = Date.now() + wait;
    timer = setTimeout(fire, wait);
    console.log('[proactive] 下次主动消息将在 ' + (wait / 1000).toFixed(1) + ' 秒后');
  }

   // 检查是否可以发起问卷              
  function canPushSurvey() {          
    if (!window.dreamSurveyFromTa) return false;                          
    if (typeof window.dreamSurveyFromTa.generateAndSave !== 'function') return false;   
    if (typeof window.dreamSurveyFromTa.pushToChat !== 'function') return false;        
    return true;                                                          
  }    

  function fire() {
    timer = null;
    nextFireAt = 0;

    // 检查环境
    if (!isPageVisible()) {
      console.log('[proactive] 页面不可见，暂停');
      return;
    }

    var s = getSettings();
    if (!s.proactive) {
      console.log('[proactive] 开关已关闭，停止');
      return;
    }

        // 20% 概率改发问卷；否则正常主动消息
    var surveyChance = 0.20;

    if (Math.random() < surveyChance && canPushSurvey()) {
      try {
        var s2 = window.dreamSurveyFromTa.generateAndSave();
        if (s2) {
          window.dreamSurveyFromTa.pushToChat(s2.id);
          console.log('[proactive] 已触发一次 Ta 的问卷');
        } else {
          // 出题失败，退回普通主动消息
          window.triggerChatAutoReply();
          console.log('[proactive] 出题失败，改发主动消息');
        }
      } catch (e) {
        console.warn('[proactive] 问卷触发失败', e);
        // 异常时退回普通主动消息
        try { window.triggerChatAutoReply(); } catch (e2) {}
      }
    } else {
      // 正常主动消息
      if (typeof window.triggerChatAutoReply === 'function') {
        try {
          window.triggerChatAutoReply();
          console.log('[proactive] 已触发一次主动消息');
        } catch (e) {
          console.warn('[proactive] 触发失败', e);
        }
      } else {
        console.warn('[proactive] window.triggerChatAutoReply 不存在');
      }
    }

    // 安排下一次
    scheduleNext();
  }

  // ==================== 启动 / 停止 ====================
  function start() {
    var s = getSettings();
    if (!s.proactive) {
      stop();
      return;
    }
    scheduleNext();
  }

  function stop() {
    clearTimer();
    console.log('[proactive] 已停止');
  }

  // ==================== 外部通知：设置变更 ====================
  window.addEventListener('replySettingsChanged', function () {
    var s = getSettings();
    if (s.proactive) {
      // 重新计时（用户改完立刻按新间隔重排，而不是继续等旧计时）
      scheduleNext();
    } else {
      stop();
    }
  });

  // ==================== 页面可见性 ====================
  document.addEventListener('visibilitychange', function () {
    var s = getSettings();
    if (!s.proactive) return;

    if (document.visibilityState === 'hidden') {
      // 记录剩余时间，暂停
      if (timer && nextFireAt) {
        var remain = nextFireAt - Date.now();
        if (remain < 1000) remain = 1000;
        clearTimer();
        timer = { __paused: true, __remain: remain };
      } else {
        clearTimer();
      }
      console.log('[proactive] 页面隐藏，暂停');
    } else {
      // 恢复
      if (timer && timer.__paused) {
        var remain = timer.__remain || 1000;
        timer = null;
        scheduleNext(remain);
      } else {
        scheduleNext();
      }
      console.log('[proactive] 页面可见，恢复');
    }
  });

  // ==================== 初始化 ====================
  function init() {
    // 等 reply-settings.js 先初始化
    setTimeout(function () {
      var s = getSettings();
      if (s.proactive) start();
    }, 800);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 暴露给外部，方便调试
  window.proactive = {
    start: start,
    stop: stop,
    fire: fire,
    status: function () {
      return {
        active: !!timer && !(timer && timer.__paused),
        paused: !!(timer && timer.__paused),
        nextFireAt: nextFireAt || null,
        remainMs: nextFireAt ? (nextFireAt - Date.now()) : null
      };
    }
  };

  console.log('[proactive] 模块已加载');
})();
