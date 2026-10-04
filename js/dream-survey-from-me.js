/**
 * 梦向问卷 · 我的问卷 发出 / Ta 作答
 * - 依赖 window.dreamSurvey（dream-survey.js 暴露）
 * - 依赖 window.appendMySurveyCardToChat（chat.js 暴露）
 * - 依赖 window.syncMySurveyCard（chat.js 暴露）
 * - 依赖 window.appendTaTextToChat（chat.js 暴露）
 * - 依赖 window.getReplyCards
 *
 * 存储仍走 dream_survey_list（dream-survey.js 负责）
 * 本模块只做「发出 → Ta 逐题作答 → 交卷」流程
 */

(function () {
  'use strict';

  var STORE_KEY = 'dream_survey_list';

  // ==================== 存储工具 ====================
  function loadList() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      console.warn('[dream-survey-from-me] 读取失败', e);
      return [];
    }
  }
  function saveList(arr) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(arr));
    } catch (e) {
      console.warn('[dream-survey-from-me] 保存失败', e);
    }
  }
  function findSurvey(id) {
    return loadList().find(function (s) { return s.id === id; }) || null;
  }
  function upsertSurvey(survey) {
    var list = loadList();
    var idx = list.findIndex(function (s) { return s.id === survey.id; });
    if (idx >= 0) list[idx] = survey;
    else list.unshift(survey);
    saveList(list);
  }

  // ==================== 随机工具 ====================
  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  function randomPick(arr) {
    if (!arr || arr.length === 0) return null;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ==================== Ta 答题 ====================
  // 从字卡库抽 1~3 句拼成一段文字
  function generateTextAnswer() {
    // ==================== 三层兜底 ====================
    // 1) 用户字卡（getReplyCards）
    // 2) 内置字卡库（DEFAULT_CARD_DATA.reply）
    // 3) 公共字卡库勾选（publicCards.getSelectedCards('reply')）
    var pool = [];
    try {
      if (typeof window.getReplyCards === 'function') {
        var u = window.getReplyCards() || [];
        if (Array.isArray(u) && u.length > 0) pool = pool.concat(u);
      }
    } catch (e) {}

    if (pool.length === 0) {
      try {
        var d = window.DEFAULT_CARD_DATA;
        if (d && d.reply && typeof d.reply === 'object') {
          Object.keys(d.reply).forEach(function (g) {
            if (Array.isArray(d.reply[g])) {
              pool = pool.concat(d.reply[g]);
            }
          });
        }
      } catch (e) {}
    }

    if (pool.length === 0) {
      try {
        if (window.publicCards && typeof window.publicCards.getSelectedCards === 'function') {
          var pub = window.publicCards.getSelectedCards('reply');
          if (Array.isArray(pub) && pub.length > 0) pool = pub;
        }
      } catch (e) {}
    }

    if (pool.length === 0) {
      return '……';
    }

    var count = randomInt(1, 3);
    if (count > pool.length) count = pool.length;

    var shuffled = pool.slice();
    for (var i = shuffled.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = tmp;
    }
    var parts = shuffled.slice(0, count).map(function (s) {
      var t = String(s).trim();
      if (!/[。！？…~～.!?]$/.test(t)) {
        t = t + '。';
      }
      return t;
    });
    return parts.join('');
  }

  // 单题作答
  function answerOneQuestion(q) {
    if (!q) return '';
    if (q.type === 'text') {
      return generateTextAnswer();
    }
    var opts = Array.isArray(q.options) ? q.options.filter(function (o) {
      return o && String(o).trim() !== '';
    }) : [];
    if (opts.length === 0) return '';

    if (q.type === 'single') {
      return randomPick(opts);
    }
    if (q.type === 'multi') {
      var maxN = q.multiMax || 2;
      if (maxN > opts.length) maxN = opts.length;
      if (maxN < 2) maxN = Math.min(2, opts.length);
      var count = randomInt(2, maxN);
      var shuffled = opts.slice();
      for (var i = shuffled.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = tmp;
      }
      // 按原选项顺序拼「A、B」形式
      var chosen = shuffled.slice(0, count);
      chosen.sort(function (a, b) {
        return opts.indexOf(a) - opts.indexOf(b);
      });
      return chosen.join('、');
    }
    return '';
  }

  // ==================== 发出流程 ====================
  function sendSurvey(surveyId) {
    var s = findSurvey(surveyId);
    if (!s) {
      alert('问卷不存在');
      return false;
    }
    if (!s.qs || s.qs.length === 0) {
      alert('问卷没有题目');
      return false;
    }
    if (s.status === 'sent') {
      alert('问卷已发出，正在等待 Ta 作答');
      return false;
    }
    if (s.status === 'done') {
      alert('问卷已完成');
      return false;
    }

    // 重置作答状态
    s.status = 'sent';
    s.answers = [];
    s.sentAt = Date.now();
    s.doneAt = 0;
    upsertSurvey(s);

    // 推卡片到聊天
    if (typeof window.appendMySurveyCardToChat === 'function') {
      try {
        window.appendMySurveyCardToChat(s);
      } catch (e) {
        console.warn('[dream-survey-from-me] 推卡片失败', e);
      }
    } else {
      console.warn('[dream-survey-from-me] chat.js 未暴露 appendMySurveyCardToChat');
    }

    // 启动 Ta 作答
    startTaAnswering(s.id);

    return true;
  }

  // ==================== Ta 逐题作答 ====================
  // 用 tick 链，每题 1~2 秒
  function startTaAnswering(surveyId) {
    var s = findSurvey(surveyId);
    if (!s) return;

    // 等 1 秒（Ta 收到问卷）
    setTimeout(function () {
      tickAnswer(surveyId, 0);
    }, 1000);
  }

  function tickAnswer(surveyId, qIdx) {
    var s = findSurvey(surveyId);
    if (!s) return;
    if (s.status !== 'sent') return;   // 已被撤回 / 状态变了
    if (!s.qs || qIdx >= s.qs.length) {
      // 全部答完 → 交卷
      submitSurvey(surveyId);
      return;
    }

    // 回答当前题
    var q = s.qs[qIdx];
    var val = answerOneQuestion(q);
    if (!Array.isArray(s.answers)) s.answers = [];
    // 用 qIdx 定位（覆盖式）
    var existing = s.answers.findIndex(function (a) { return a && a.qIdx === qIdx; });
    if (existing >= 0) {
      s.answers[existing] = { qIdx: qIdx, value: val };
    } else {
      s.answers.push({ qIdx: qIdx, value: val });
    }
    upsertSurvey(s);

    // 回写卡片进度
    if (typeof window.syncMySurveyCard === 'function') {
      try { window.syncMySurveyCard(surveyId); } catch (e) {}
    }

    // 下一题：1~2 秒后
    var delay = 1000 + Math.floor(Math.random() * 1000);
    setTimeout(function () {
      tickAnswer(surveyId, qIdx + 1);
    }, delay);
  }

  // ==================== 交卷 ====================
  function submitSurvey(surveyId) {
    var s = findSurvey(surveyId);
    if (!s) return;
    if (s.status !== 'sent') return;

    s.status = 'done';
    s.doneAt = Date.now();
    upsertSurvey(s);

    // 回写卡片状态
    if (typeof window.syncMySurveyCard === 'function') {
      try { window.syncMySurveyCard(surveyId); } catch (e) {}
    }

    // Ta 说一句回应（隔 2~4 秒）
    var delay = 2000 + Math.floor(Math.random() * 2000);
    setTimeout(function () {
        var pool = [];
      try {
        if (typeof window.getReplyCards === 'function') {
          var u = window.getReplyCards() || [];
          if (Array.isArray(u) && u.length > 0) pool = pool.concat(u);
        }
      } catch (e) {}

      if (pool.length === 0) {
        try {
          var d = window.DEFAULT_CARD_DATA;
          if (d && d.reply && typeof d.reply === 'object') {
            Object.keys(d.reply).forEach(function (g) {
              if (Array.isArray(d.reply[g])) pool = pool.concat(d.reply[g]);
            });
          }
        } catch (e) {}
      }

      if (pool.length === 0) {
        try {
          if (window.publicCards && typeof window.publicCards.getSelectedCards === 'function') {
            var pub = window.publicCards.getSelectedCards('reply');
            if (Array.isArray(pub) && pub.length > 0) pool = pub;
          }
        } catch (e) {}
      }

      var text = '';
      if (pool.length > 0) {
        text = randomPick(pool);
      } else {
        text = '你的问题我都答完了。';
      }
      if (text && typeof text === 'string' && typeof window.appendTaTextToChat === 'function') {
        try { window.appendTaTextToChat(text); } catch (e) {}
      }
    }, delay);

    console.log('[dream-survey-from-me] Ta 已交卷:', surveyId);
  }

  // ==================== 撤回联动（供 chat.js 调用） ====================
  // 用户从消息菜单撤回问卷卡片时调它 → 问卷回 draft
  function onCardWithdrawn(surveyId) {
    var s = findSurvey(surveyId);
    if (!s) return;
    // 只有 sent 状态才回 draft；done 状态不动（已交卷的不能撤）
    if (s.status === 'sent') {
      s.status = 'draft';
      s.answers = [];
      s.sentAt = 0;
      s.doneAt = 0;
      upsertSurvey(s);
      console.log('[dream-survey-from-me] 问卷已撤回，状态回 draft:', surveyId);
    }
  }

  // ==================== 暴露 ====================
  window.dreamSurveyFromMe = {
    sendSurvey: sendSurvey,
    onCardWithdrawn: onCardWithdrawn,
    STORE_KEY: STORE_KEY
  };

  console.log('[dream-survey-from-me] 模块已加载');
})();
