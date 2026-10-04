/**
 * 梦向问卷 · Ta 的问卷（从 Ta 侧发起）
 * - 存储：localStorage 'dream_survey_from_ta'
 * - 出题：70% 抽库 + 30% Ta 自编
 * - 标题：从抽到的分类衍生
 * - 本批次不接 proactive 定时器，用 window.debugTaSurvey() 手动触发测试
 *
 * 数据结构：
 * {
 *   id, title, qs[], createdAt, status: 'unanswered' | 'answered',
 *   answers: [{ qIdx, value }]  // value 可能是 string(文字) / string(单选) / string[] (多选)
 * }
 */

(function () {
  'use strict';

  var STORE_KEY = 'dream_survey_from_ta';

  // ==================== 工具 ====================
  function genId() {
    return 'dsta_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  }
  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  function randomPick(arr) {
    if (!arr || arr.length === 0) return null;
    return arr[Math.floor(Math.random() * arr.length)];
  }
  function deepClone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  // ==================== 存储 ====================
  function loadAll() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      console.warn('[dream-survey-from-ta] 读取失败', e);
      return [];
    }
  }
  function saveAll(arr) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(arr));
    } catch (e) {
      console.warn('[dream-survey-from-ta] 保存失败', e);
    }
  }
  function findById(id) {
    return loadAll().find(function (s) { return s.id === id; }) || null;
  }
  function upsert(survey) {
    var list = loadAll();
    var idx = list.findIndex(function (s) { return s.id === survey.id; });
    if (idx >= 0) list[idx] = survey;
    else list.unshift(survey);
    saveAll(list);
  }
  function removeById(id) {
    var list = loadAll().filter(function (s) { return s.id !== id; });
    saveAll(list);
  }

  // ==================== 出题 ====================
  // 从分类里抽 N 道（不重复）
  function pickFromLib(catKey, n) {
    var lib = window.DREAM_SURVEY_LIB || [];
    var cat = lib.find(function (c) { return c.key === catKey; });
    if (!cat) return [];

    var pool = cat.questions.slice();
    var result = [];
    for (var i = 0; i < n && pool.length > 0; i++) {
      var idx = Math.floor(Math.random() * pool.length);
      result.push(pool.splice(idx, 1)[0]);
    }
    return result;
  }

  // 从 Ta 自编池抽 N 道（不重复）
  function pickFromSelf(n) {
    var pool = (window.DREAM_SURVEY_TA_SELF_QUESTIONS || []).slice();
    var result = [];
    for (var i = 0; i < n && pool.length > 0; i++) {
      var idx = Math.floor(Math.random() * pool.length);
      result.push(pool.splice(idx, 1)[0]);
    }
    return result;
  }

  // 主出题逻辑：70% 抽库 + 30% Ta 自编，共 3~5 道
  function generateQuestions() {
    var total = randomInt(3, 5);
    var selfCount = Math.round(total * 0.3);
    var libCount = total - selfCount;

    // 从库里挑一个分类（优先）
    var lib = window.DREAM_SURVEY_LIB || [];
    if (lib.length === 0) {
      // 库空，全用自编
      return {
        qs: pickFromSelf(total),
        primaryCat: 'self'
      };
    }

    var chosenCat = randomPick(lib);
    var libQs = pickFromLib(chosenCat.key, libCount);
    var selfQs = pickFromSelf(selfCount);

    // 合并 + 洗牌
    var all = libQs.concat(selfQs);
    for (var i = all.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = all[i]; all[i] = all[j]; all[j] = tmp;
    }

    // 标记来源（用于调试，非必须）
    all.forEach(function (q) { /* 保持原结构 */ });

    return {
      qs: all,
      primaryCat: chosenCat.key
    };
  }

  // 生成标题
  function generateTitle(primaryCat) {
    var map = window.DREAM_SURVEY_TA_TITLE_MAP || {};
    return map[primaryCat] || 'Ta 有话想问你';
  }

  // 生成一份完整问卷
  function createSurvey() {
    var gen = generateQuestions();
    var survey = {
      id: genId(),
      title: generateTitle(gen.primaryCat),
      qs: gen.qs,
      createdAt: Date.now(),
      status: 'unanswered',   // 'unanswered' | 'answered'
      answers: []             // 用户提交后填充
    };
    return survey;
  }

  // ==================== 生成并保存（API） ====================
  function generateAndSave() {
    var survey = createSurvey();
    if (!survey || !survey.qs || survey.qs.length === 0) {
      console.warn('[dream-survey-from-ta] 出题失败（题库为空？）');
      return null;
    }
    upsert(survey);
    console.log('[dream-survey-from-ta] 已生成一份 Ta 的问卷：', survey);
    return survey;
  }

  // ==================== 提交答案 ====================
  function submitAnswers(id, answers) {
    var s = findById(id);
    if (!s) return false;
    s.answers = Array.isArray(answers) ? answers : [];
    s.status = 'answered';
    s.answeredAt = Date.now();
    upsert(s);
    return true;
  }

    // ==================== 推送问卷卡片到聊天 ====================
  // 依赖 chat.js 暴露的 window.appendSurveyCardToChat（下一步加）
  function pushToChat(surveyId) {
    var s = findById(surveyId);
    if (!s) return false;

    // 1. 先推一句 Ta 的话（从字卡库抽）
    try {
      var pool = (typeof window.getReplyCards === 'function') ? window.getReplyCards() : [];
      if (Array.isArray(pool) && pool.length > 0) {
        var text = pool[Math.floor(Math.random() * pool.length)];
        if (text && typeof text === 'string') {
          if (typeof window.appendTaTextToChat === 'function') {
            window.appendTaTextToChat(text);
          } else {
            pushTextFallback(text);
          }
        }
      }
    } catch (e) {
      console.warn('[dream-survey-from-ta] 推送陪衬话失败', e);
    }

    // 2. 推问卷卡片
    if (typeof window.appendSurveyCardToChat === 'function') {
      window.appendSurveyCardToChat(s);
      return true;
    } else {
      console.warn('[dream-survey-from-ta] chat.js 未暴露 appendSurveyCardToChat');
      return false;
    }
  }

  // 兜底：直接往聊天里塞一条对方文字
  function pushTextFallback(text) {
    var chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    var row = document.createElement('div');
    row.className = 'message-row other';
    var bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.textContent = text;
    row.appendChild(bubble);
    chatMessages.appendChild(row);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // ==================== 暴露给外部 ====================
   window.dreamSurveyFromTa = {
    loadAll: loadAll,
    findById: findById,
    generateAndSave: generateAndSave,
    submitAnswers: submitAnswers,
    removeById: removeById,
    pushToChat: pushToChat,
    STORE_KEY: STORE_KEY
  };

  // 调试用：手动触发一次 Ta 出题（批次 2 会接 proactive.js）
  window.debugTaSurvey = function () {
    var s = generateAndSave();
    if (s) {
      console.log('[debugTaSurvey] 已生成并推送到聊天，切到传讯页可看到卡片');
      pushToChat(s.id);
      return s;
    }
    return null;
  };
  
  console.log('[dream-survey-from-ta] 模块已加载');
})();
