/**
 * 梦向问卷模块
 * - 列表页 #pageDreamSurvey（含「我的问卷 / Ta 的问卷」分类切换）
 * - 编辑页 #pageDreamSurveyEdit（含「从问卷库添加」折叠面板）
 * - 详情页 #pageDreamSurveyDetail
 * - 作答页 #pageDreamSurveyAnswer
 * - 存储：localStorage 'dream_survey_list'
 * - 依赖：window.DREAM_SURVEY_LIB（dream-survey-questions.js）
 *
 * 注意：
 * - 已删除自带的 showPage 函数，统一用 window.showPage（来自 router.js）
 * - window.showPage 已兼容字符串 id 和 DOM 节点
 */

(function () {
  'use strict';

  var STORE_KEY = 'dream_survey_list';

  // ==================== 状态 ====================
  var editingSurvey = null;
  var currentListTab = 'mine';

  var libSelected = {};
  var libCurrentCat = 'daily';
  var libOpen = false;

  // ==================== 工具 ====================
  function genId() {
    return 'ds_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  }
  function escapeHtml(s) {
    if (!s) return '';
    return String(s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }
  function deepClone(o) {
    return JSON.parse(JSON.stringify(o));
  }
  function formatDate(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    function pad(n) { return n < 10 ? '0' + n : '' + n; }
    return d.getFullYear() + '.' + pad(d.getMonth() + 1) + '.' + pad(d.getDate());
  }

  // 统一跳页（走 router.js）
  function goPage(id) {
    if (typeof window.showPage === 'function') {
      window.showPage(id);
    } else {
      // 兜底
      document.querySelectorAll('.page').forEach(function (p) {
        p.classList.toggle('active', p.id === id);
      });
      window.scrollTo(0, 0);
    }
  }

  // ==================== 存储 ====================
  function loadList() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      console.warn('[dream-survey] 读取失败', e);
      return [];
    }
  }
  function saveList(arr) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(arr));
    } catch (e) {
      console.warn('[dream-survey] 保存失败', e);
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
  function removeSurvey(id) {
    var list = loadList().filter(function (s) { return s.id !== id; });
    saveList(list);
  }

  // ==================== 列表页 ====================
  function renderList() {
    var listBox = document.getElementById('dsList');
    var emptyBox = document.getElementById('dsEmpty');
    if (!listBox || !emptyBox) return;

    var list = [];

    if (currentListTab === 'theirs') {
      if (window.dreamSurveyFromTa && typeof window.dreamSurveyFromTa.loadAll === 'function') {
        list = window.dreamSurveyFromTa.loadAll();
      } else {
        list = [];
      }
    } else {
      list = loadList();
    }

    if (list.length === 0) {
      listBox.innerHTML = '';
      emptyBox.classList.add('show');

      var emptyText = emptyBox.querySelector('.ds-empty-text');
      var emptyHint = emptyBox.querySelector('.ds-empty-hint');
      if (currentListTab === 'theirs') {
        if (emptyText) emptyText.textContent = 'Ta 还没有发起问卷';
        if (emptyHint) emptyHint.textContent = '等 Ta 主动问你点什么吧（调试：Console 里跑 window.debugTaSurvey()）';
      } else {
        if (emptyText) emptyText.textContent = '还没有问卷';
        if (emptyHint) emptyHint.textContent = '点右上角 + 新建一份吧';
      }
      return;
    }
    emptyBox.classList.remove('show');

    listBox.innerHTML = '';
    list.forEach(function (s) {
      var item = document.createElement('div');
      item.className = 'ds-item';
      item.dataset.id = s.id;

      var statusText, statusClass;
      if (currentListTab === 'theirs') {
        statusText = (s.status === 'answered') ? '已作答' : '待作答';
        statusClass = (s.status === 'answered') ? 'done' : 'sent';
      } else {
        statusText = { draft: '草稿', sent: '已发出', done: '已交卷' }[s.status] || '草稿';
        statusClass = s.status || 'draft';
      }

      var metaParts = [];
      metaParts.push('<i class="fa-solid fa-list"></i> ' + (s.qs ? s.qs.length : 0) + ' 题');
      if (s.createdAt) {
        metaParts.push('<i class="fa-regular fa-clock"></i> ' + formatDate(s.createdAt));
      }

      item.innerHTML =
        '<div class="ds-item-header">' +
        '  <div class="ds-item-title">' + escapeHtml(s.title || '未命名问卷') + '</div>' +
        '  <span class="ds-item-status ' + statusClass + '">' + statusText + '</span>' +
        '</div>' +
        '<div class="ds-item-meta">' + metaParts.join(' &nbsp; ') + '</div>';

      item.addEventListener('click', function () {
        if (currentListTab === 'theirs') {
          openAnswerPage(s.id);
        } else {
          openDetail(s.id);
        }
      });

      listBox.appendChild(item);
    });
  }

  // ==================== 编辑页 ====================
  function ensureEditingSurvey() {
    if (editingSurvey) return;
    editingSurvey = {
      id: genId(),
      title: '',
      qs: [],
      deadline: 0,
      prob: 10,
      status: 'draft',
      createdAt: Date.now(),
      sentAt: 0,
      doneAt: 0
    };
  }

  function renderEdit() {
    if (!editingSurvey) return;

    libSelected = {};
    libOpen = false;

    var titleInput = document.getElementById('dsTitleInput');
    var probInput = document.getElementById('dsProbInput');
    var countLabel = document.getElementById('dsCountLabel');
    var editTitle = document.getElementById('dsEditTitle');

    if (titleInput) titleInput.value = editingSurvey.title || '';
    if (probInput) probInput.value = editingSurvey.prob != null ? editingSurvey.prob : 10;
    if (countLabel) countLabel.textContent = (editingSurvey.qs ? editingSurvey.qs.length : 0) + ' 题';
    if (editTitle) {
      editTitle.textContent = editingSurvey.createdAt && findSurvey(editingSurvey.id)
        ? '编辑问卷'
        : '新建问卷';
    }

    var libPanel = document.getElementById('dsLibPanel');
    var libToggle = document.getElementById('dsLibToggleBtn');
    if (libPanel) libPanel.style.display = 'none';
    if (libToggle) libToggle.classList.remove('open');

    renderQsList();
  }

  function renderQsList() {
    var box = document.getElementById('dsQsList');
    if (!box) return;
    box.innerHTML = '';

    if (!editingSurvey.qs) editingSurvey.qs = [];

    editingSurvey.qs.forEach(function (q, idx) {
      var card = document.createElement('div');
      card.className = 'ds-q-card';
      card.dataset.idx = String(idx);

      var head = document.createElement('div');
      head.className = 'ds-q-header';

      var numEl = document.createElement('div');
      numEl.className = 'ds-q-num';
      numEl.textContent = String(idx + 1);

      var typeSel = document.createElement('select');
      typeSel.className = 'ds-q-type-select';
      typeSel.innerHTML =
        '<option value="single">单选</option>' +
        '<option value="multi">多选</option>' +
        '<option value="text">文字题</option>';
      typeSel.value = q.type || 'single';
      typeSel.addEventListener('change', function () {
        var newType = typeSel.value;
        if (newType === q.type) return;
        q.type = newType;
        if (newType === 'text') {
          q.options = [];
        } else if (!q.options || q.options.length < 2) {
          q.options = ['选项A', '选项B'];
        }
        renderQsList();
      });

      var delBtn = document.createElement('button');
      delBtn.className = 'ds-q-del';
      delBtn.type = 'button';
      delBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
      delBtn.addEventListener('click', function () {
        editingSurvey.qs.splice(idx, 1);
        renderQsList();
        updateCountLabel();
      });

      head.appendChild(numEl);
      head.appendChild(typeSel);
      head.appendChild(delBtn);
      card.appendChild(head);

      var textInput = document.createElement('input');
      textInput.type = 'text';
      textInput.className = 'ds-q-text';
      textInput.placeholder = '题干，例如：你最喜欢我哪一点？';
      textInput.value = q.text || '';
      textInput.addEventListener('input', function () {
        q.text = textInput.value;
      });
      card.appendChild(textInput);

      if (q.type === 'text') {
        var hint = document.createElement('div');
        hint.className = 'ds-q-text-hint';
        hint.textContent = '文字题：Ta 会自由作答';
        card.appendChild(hint);
      } else {
        var optsBox = document.createElement('div');
        optsBox.className = 'ds-q-options';

        var opts = q.options || (q.options = ['选项A', '选项B']);

        opts.forEach(function (opt, oi) {
          var row = document.createElement('div');
          row.className = 'ds-q-opt-row';

          var mark = document.createElement('div');
          mark.className = 'ds-q-opt-mark';
          mark.textContent = String.fromCharCode(65 + oi);

          var optInput = document.createElement('input');
          optInput.type = 'text';
          optInput.className = 'ds-q-opt-input';
          optInput.placeholder = '选项内容';
          optInput.value = opt || '';
          optInput.addEventListener('input', function () {
            opts[oi] = optInput.value;
          });

          var optDel = document.createElement('button');
          optDel.className = 'ds-q-opt-del';
          optDel.type = 'button';
          optDel.innerHTML = '<i class="fa-solid fa-xmark"></i>';
          optDel.addEventListener('click', function () {
            if (opts.length <= 2) return;
            opts.splice(oi, 1);
            renderQsList();
          });

          row.appendChild(mark);
          row.appendChild(optInput);
          row.appendChild(optDel);
          optsBox.appendChild(row);
        });

        var addOpt = document.createElement('button');
        addOpt.className = 'ds-q-add-opt';
        addOpt.type = 'button';
        addOpt.innerHTML = '<i class="fa-solid fa-plus"></i> 添加选项';
        addOpt.addEventListener('click', function () {
          opts.push('');
          renderQsList();
        });
        optsBox.appendChild(addOpt);

        card.appendChild(optsBox);

        if (q.type === 'multi') {
          var maxRow = document.createElement('div');
          maxRow.className = 'ds-q-multimax';
          maxRow.innerHTML = '<span>最多选</span>';
          var maxInput = document.createElement('input');
          maxInput.type = 'number';
          maxInput.min = '2';
          maxInput.max = '6';
          maxInput.value = q.multiMax || 2;
          maxInput.addEventListener('input', function () {
            var v = parseInt(maxInput.value, 10);
            if (isNaN(v)) v = 2;
            if (v < 2) v = 2;
            if (v > 6) v = 6;
            q.multiMax = v;
          });
          maxRow.appendChild(maxInput);
          var maxLabel = document.createElement('span');
          maxLabel.textContent = '项';
          maxRow.appendChild(maxLabel);
          card.appendChild(maxRow);
        }
      }

      box.appendChild(card);
    });
  }

  function updateCountLabel() {
    var countLabel = document.getElementById('dsCountLabel');
    if (countLabel && editingSurvey && editingSurvey.qs) {
      countLabel.textContent = editingSurvey.qs.length + ' 题';
    }
  }

  function addNewQuestion() {
    if (!editingSurvey) return;
    editingSurvey.qs = editingSurvey.qs || [];
    editingSurvey.qs.push({
      type: 'single',
      text: '',
      options: ['选项A', '选项B']
    });
    renderQsList();
    updateCountLabel();
    requestAnimationFrame(function () {
      var cards = document.querySelectorAll('#dsQsList .ds-q-card');
      var last = cards[cards.length - 1];
      if (last) last.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  // ==================== 高级模式解析 ====================
  function parseAdvText(text) {
    var result = [];
    if (!text || !text.trim()) return result;

    var blocks = text.split(/\n\s*\n/).map(function (b) { return b.trim(); }).filter(Boolean);

    blocks.forEach(function (block) {
      var lines = block.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
      if (lines.length === 0) return;

      var first = lines[0];
      var rest = lines.slice(1);

      var m = first.match(/^【(.+?)】(.*)$/);
      var title, tail;
      if (m) {
        title = m[1].trim();
        tail = (m[2] || '').trim();
      } else {
        result.push({ type: 'text', text: first });
        return;
      }

      var isMulti = /多选/.test(tail) || /多选/.test(title);
      var multiMaxMatch = (tail + ' ' + title).match(/最多\s*(\d+)/);
      var multiMax = multiMaxMatch ? parseInt(multiMaxMatch[1], 10) : 0;
      if (multiMax && (multiMax < 2 || multiMax > 6)) multiMax = 0;

      if (rest.length === 0 || (rest.length === 1 && rest[0] === '一')) {
        result.push({ type: 'text', text: title });
        return;
      }

      if (rest.length >= 2) {
        var q = {
          type: isMulti ? 'multi' : 'single',
          text: title,
          options: rest.slice(0, 12)
        };
        if (isMulti) {
          q.multiMax = multiMax || 2;
        }
        result.push(q);
        return;
      }

      result.push({ type: 'text', text: title });
    });

    return result;
  }

  // ==================== 详情页 ====================
  function openDetail(id) {
    var s = findSurvey(id);
    if (!s) return;

    var body = document.getElementById('dsDetailBody');
    var titleEl = document.getElementById('dsDetailTitle');
    if (!body) return;

    if (titleEl) titleEl.textContent = s.title || '未命名问卷';

    var editBtn = document.getElementById('dsDetailEditBtn');
    if (editBtn) {
      editBtn.onclick = function () {
        editingSurvey = deepClone(s);
        renderEdit();
        goPage('pageDreamSurveyEdit');
      };
    }

    var statusText = { draft: '草稿', sent: '已发出', done: '已交卷' }[s.status] || '草稿';
    var statusClass = s.status || 'draft';

    var html = '';

    html += '<div class="ds-detail-meta">';
    html += '  <i class="fa-solid fa-list"></i> ' + (s.qs ? s.qs.length : 0) + ' 题';
    if (s.createdAt) {
      html += '  <i class="fa-regular fa-clock"></i> ' + formatDate(s.createdAt);
    }
    html += '  <span class="ds-detail-status ds-item-status ' + statusClass + '">' + statusText + '</span>';
    html += '</div>';

    html += '<div class="ds-detail-qs">';
    (s.qs || []).forEach(function (q, idx) {
      var typeLabel = { single: '单选', multi: '多选', text: '文字' }[q.type] || '单选';

      html += '<div class="ds-detail-q">';
      html += '  <div class="ds-detail-q-head">';
      html += '    <div class="ds-detail-q-num">' + (idx + 1) + '</div>';
      html += '    <div class="ds-detail-q-text">' + escapeHtml(q.text || '（未填写题干）') + '</div>';
      html += '    <span class="ds-detail-q-type">' + typeLabel + '</span>';
      html += '  </div>';

      if (q.type === 'text') {
        html += '  <div class="ds-detail-q-empty">Ta 将自由作答</div>';
      } else if (q.options && q.options.length) {
        html += '  <div class="ds-detail-q-opts">';
        q.options.forEach(function (opt, oi) {
          html += '    <div class="ds-detail-q-opt">' + String.fromCharCode(65 + oi) + '. ' + escapeHtml(opt || '（空）') + '</div>';
        });
        html += '  </div>';
      } else {
        html += '  <div class="ds-detail-q-empty">（暂无选项）</div>';
      }

      html += '</div>';
    });
    html += '</div>';

    body.innerHTML = html;

    goPage('pageDreamSurveyDetail');
  }

  // ==================== Ta 的问卷 · 作答页 ====================
  var answeringId = null;
  var answeringData = {};

  function openAnswerPage(id) {
    if (!window.dreamSurveyFromTa) {
      alert('模块未加载');
      return;
    }
    var s = window.dreamSurveyFromTa.findById(id);
    if (!s) {
      alert('问卷不存在');
      return;
    }

    answeringId = id;
    answeringData = {};

    if (s.status === 'answered' && Array.isArray(s.answers)) {
      s.answers.forEach(function (a) {
        if (a && typeof a.qIdx === 'number') {
          answeringData[a.qIdx] = a.value;
        }
      });
    }

    renderAnswerPage(s);
    goPage('pageDreamSurveyAnswer');
  }

  function renderAnswerPage(s) {
    var titleEl = document.getElementById('dsAnswerTitle');
    var bodyEl = document.getElementById('dsAnswerBody');
    if (!bodyEl) return;

    if (titleEl) titleEl.textContent = s.title || 'Ta 的问卷';

    var readOnly = s.status === 'answered';
    var html = '';

    html += '<div class="ds-answer-meta">';
    html += '  <i class="fa-solid fa-circle-question"></i> ' + s.qs.length + ' 题';
    if (readOnly) {
      html += ' <span class="ds-answer-readonly-tag"><i class="fa-solid fa-check"></i> 已作答</span>';
    }
    html += '</div>';

    html += '<div class="ds-answer-qs">';

    s.qs.forEach(function (q, idx) {
      html += '<div class="ds-answer-q" data-qidx="' + idx + '">';
      html += '  <div class="ds-answer-q-head">';
      html += '    <div class="ds-answer-q-num">' + (idx + 1) + '</div>';
      html += '    <div class="ds-answer-q-text">' + escapeHtml(q.text || '') + '</div>';
      html += '  </div>';

      if (q.type === 'text') {
        var val = answeringData[idx] || '';
        html += '<textarea class="ds-answer-textarea" data-qidx="' + idx + '" placeholder="写下你的回答..."' + (readOnly ? ' readonly' : '') + '>' + escapeHtml(val) + '</textarea>';
      } else {
        html += '<div class="ds-answer-options" data-qidx="' + idx + '" data-type="' + q.type + '" data-multimax="' + (q.multiMax || 0) + '">';
        (q.options || []).forEach(function (opt, oi) {
          var isSelected = false;
          if (q.type === 'single') {
            isSelected = answeringData[idx] === opt;
          } else {
            var arr = Array.isArray(answeringData[idx]) ? answeringData[idx] : [];
            isSelected = arr.indexOf(opt) >= 0;
          }
          html += '<div class="ds-answer-opt' + (isSelected ? ' selected' : '') + '" data-qidx="' + idx + '" data-val="' + escapeHtml(opt) + '">';
          html += '  <span class="ds-answer-opt-mark">' + String.fromCharCode(65 + oi) + '</span>';
          html += '  <span class="ds-answer-opt-text">' + escapeHtml(opt) + '</span>';
          html += '</div>';
        });
        html += '</div>';
        if (q.type === 'multi') {
          html += '<div class="ds-answer-multi-hint">最多选 ' + (q.multiMax || 2) + ' 项</div>';
        }
      }

      html += '</div>';
    });

    html += '</div>';

    if (!readOnly) {
      html += '<div class="ds-answer-footer">';
      html += '  <button class="ds-answer-submit" id="dsAnswerSubmitBtn" type="button">提交</button>';
      html += '</div>';
    } else {
      html += '<div class="ds-answer-footer ds-answer-footer-readonly">';
      html += '  <div class="ds-answer-done-hint"><i class="fa-solid fa-check-circle"></i> 你已作答</div>';
      html += '</div>';
    }

    bodyEl.innerHTML = html;

    if (!readOnly) {
      bindAnswerInteractions();
    }
  }

  function bindAnswerInteractions() {
    document.querySelectorAll('#dsAnswerBody .ds-answer-textarea').forEach(function (ta) {
      ta.addEventListener('input', function () {
        var qi = parseInt(ta.getAttribute('data-qidx'), 10);
        answeringData[qi] = ta.value;
      });
    });

    document.querySelectorAll('#dsAnswerBody .ds-answer-opt').forEach(function (opt) {
      opt.addEventListener('click', function () {
        var qi = parseInt(opt.getAttribute('data-qidx'), 10);
        var val = opt.getAttribute('data-val');
        var container = opt.closest('.ds-answer-options');
        var type = container.getAttribute('data-type');
        var multiMax = parseInt(container.getAttribute('data-multimax'), 10) || 2;

        if (type === 'single') {
          answeringData[qi] = val;
          container.querySelectorAll('.ds-answer-opt').forEach(function (o) {
            o.classList.toggle('selected', o === opt);
          });
        } else {
          var arr = Array.isArray(answeringData[qi]) ? answeringData[qi].slice() : [];
          var idx = arr.indexOf(val);
          if (idx >= 0) {
            arr.splice(idx, 1);
            opt.classList.remove('selected');
          } else {
            if (arr.length >= multiMax) {
              var firstVal = arr.shift();
              container.querySelectorAll('.ds-answer-opt').forEach(function (o) {
                if (o.getAttribute('data-val') === firstVal) o.classList.remove('selected');
              });
            }
            arr.push(val);
            opt.classList.add('selected');
          }
          answeringData[qi] = arr;
        }
      });
    });

    var submitBtn = document.getElementById('dsAnswerSubmitBtn');
    if (submitBtn) {
      submitBtn.addEventListener('click', function () {
        if (!answeringId) return;
        var s = window.dreamSurveyFromTa.findById(answeringId);
        if (!s) return;

        for (var i = 0; i < s.qs.length; i++) {
          var q = s.qs[i];
          var v = answeringData[i];
          if (q.type === 'text') {
            if (!v || !String(v).trim()) {
              alert('第 ' + (i + 1) + ' 题还没填哦');
              return;
            }
          } else if (q.type === 'single') {
            if (!v) {
              alert('第 ' + (i + 1) + ' 题还没选哦');
              return;
            }
          } else if (q.type === 'multi') {
            if (!Array.isArray(v) || v.length === 0) {
              alert('第 ' + (i + 1) + ' 题还没选哦');
              return;
            }
          }
        }

        var answers = [];
        for (var j = 0; j < s.qs.length; j++) {
          answers.push({ qIdx: j, value: answeringData[j] });
        }
        window.dreamSurveyFromTa.submitAnswers(answeringId, answers);

        // 回写聊天里的卡片
        if (typeof window.syncSurveyCard === 'function') {
          try { window.syncSurveyCard(answeringId); } catch (e) {
            console.warn('[dream-survey] 同步卡片失败', e);
          }
        }

        alert('已提交');

        // 清空作答状态
        answeringId = null;
        answeringData = {};

        // 回到传讯页
        goPage('pageChat');
      });
    }
  }

  // ==================== 问卷库 ====================
  function libKeyOf(cat, idx) {
    return cat + '_' + idx;
  }

  function renderLibCats() {
    var box = document.getElementById('dsLibCats');
    if (!box) return;
    box.innerHTML = '';

    var lib = window.DREAM_SURVEY_LIB || [];
    lib.forEach(function (cat) {
      var btn = document.createElement('button');
      btn.className = 'ds-lib-cat' + (cat.key === libCurrentCat ? ' active' : '');
      btn.type = 'button';
      btn.innerHTML = '<i class="' + (cat.icon || 'fa-solid fa-circle') + '"></i> ' + cat.label;
      btn.addEventListener('click', function () {
        libCurrentCat = cat.key;
        renderLibCats();
        renderLibList();
      });
      box.appendChild(btn);
    });
  }

  function renderLibList() {
    var box = document.getElementById('dsLibList');
    if (!box) return;
    box.innerHTML = '';

    var lib = window.DREAM_SURVEY_LIB || [];
    var cat = lib.find(function (c) { return c.key === libCurrentCat; });
    if (!cat) return;

    cat.questions.forEach(function (q, idx) {
      var key = libKeyOf(cat.key, idx);
      var isChecked = !!libSelected[key];

      var item = document.createElement('div');
      item.className = 'ds-lib-q' + (isChecked ? ' checked' : '');

      var typeLabel = { single: '单选', multi: '多选', text: '文字' }[q.type] || '文字';
      var typeClass = q.type === 'multi' ? 'multi' : (q.type === 'text' ? 'text' : '');

      item.innerHTML =
        '<div class="ds-lib-check"><i class="fa-solid fa-check"></i></div>' +
        '<div class="ds-lib-q-body">' +
        '  <div class="ds-lib-q-text">' + escapeHtml(q.text) + '</div>' +
        '  <div class="ds-lib-q-tags">' +
        '    <span class="ds-lib-q-tag ' + typeClass + '">' + typeLabel + '</span>' +
        '    <span class="ds-lib-q-tag">' + escapeHtml(cat.label) + '</span>' +
        '  </div>' +
        '</div>';

      item.addEventListener('click', function () {
        if (libSelected[key]) {
          delete libSelected[key];
          item.classList.remove('checked');
        } else {
          libSelected[key] = true;
          item.classList.add('checked');
        }
        updateLibCount();
      });

      box.appendChild(item);
    });
  }

  function updateLibCount() {
    var count = Object.keys(libSelected).length;
    var el = document.getElementById('dsLibCount');
    if (el) el.textContent = '已选 ' + count + ' 道';

    var addBtn = document.getElementById('dsLibAddBtn');
    if (addBtn) addBtn.disabled = count === 0;
  }

  function addSelectedFromLib() {
    if (!editingSurvey) {
      editingSurvey = {
        id: genId(), title: '', qs: [], deadline: 0, prob: 10,
        status: 'draft', createdAt: Date.now(), sentAt: 0, doneAt: 0
      };
    }
    if (!editingSurvey.qs) editingSurvey.qs = [];

    var lib = window.DREAM_SURVEY_LIB || [];
    var keys = Object.keys(libSelected);
    var added = 0;

    keys.forEach(function (key) {
      var parts = key.split('_');
      var catKey = parts[0];
      var idx = parseInt(parts[1], 10);
      var cat = lib.find(function (c) { return c.key === catKey; });
      if (!cat) return;
      var q = cat.questions[idx];
      if (!q) return;

      var copy = {
        type: q.type,
        text: q.text,
        options: q.options ? q.options.slice() : []
      };
      if (q.type === 'multi') {
        copy.multiMax = q.multiMax || 2;
      }
      editingSurvey.qs.push(copy);
      added++;
    });

    if (added > 0) {
      renderQsList();
      updateCountLabel();
      libSelected = {};
      renderLibList();
      updateLibCount();
    } else {
      alert('没有可添加的题目');
    }
  }

  function bindLibEvents() {
    var toggleBtn = document.getElementById('dsLibToggleBtn');
    var panel = document.getElementById('dsLibPanel');
    if (toggleBtn && panel) {
      toggleBtn.addEventListener('click', function () {
        libOpen = !libOpen;
        panel.style.display = libOpen ? 'block' : 'none';
        toggleBtn.classList.toggle('open', libOpen);
        if (libOpen) {
          renderLibCats();
          renderLibList();
          updateLibCount();
        }
      });
    }

    var addBtn = document.getElementById('dsLibAddBtn');
    if (addBtn) {
      addBtn.disabled = true;
      addBtn.addEventListener('click', addSelectedFromLib);
    }

    var clearBtn = document.getElementById('dsLibClearBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        libSelected = {};
        renderLibList();
        updateLibCount();
      });
    }
  }

  // ==================== 事件绑定 ====================
  function bindEvents() {
    // 主页入口
    var homeBtn = document.getElementById('btnDreamSurvey');
    if (homeBtn) {
      homeBtn.addEventListener('click', function (e) {
        e.preventDefault();
        renderList();
        goPage('pageDreamSurvey');
      });
    }

    // 列表页返回
    var backBtn = document.getElementById('dsBackBtn');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        goPage('pageHome');
      });
    }

    // 分类切换 tab
    var tabMine = document.getElementById('dsTabMine');
    var tabTheirs = document.getElementById('dsTabTheirs');

    function switchListTab(tab) {
      currentListTab = tab;
      if (tabMine) tabMine.classList.toggle('active', tab === 'mine');
      if (tabTheirs) tabTheirs.classList.toggle('active', tab === 'theirs');
      renderList();
    }

    if (tabMine) {
      tabMine.addEventListener('click', function () { switchListTab('mine'); });
    }
    if (tabTheirs) {
      tabTheirs.addEventListener('click', function () { switchListTab('theirs'); });
    }

    // 新建按钮
    var newBtn = document.getElementById('dsNewBtn');
    if (newBtn) {
      newBtn.addEventListener('click', function () {
        editingSurvey = {
          id: genId(),
          title: '',
          qs: [],
          deadline: 0,
          prob: 10,
          status: 'draft',
          createdAt: Date.now(),
          sentAt: 0,
          doneAt: 0
        };
        renderEdit();
        goPage('pageDreamSurveyEdit');
      });
    }

    // 编辑页返回
    var editBackBtn = document.getElementById('dsEditBackBtn');
    if (editBackBtn) {
      editBackBtn.addEventListener('click', function () {
        if (!confirm('放弃当前编辑吗？未保存的修改将丢失。')) return;
        editingSurvey = null;
        renderList();
        goPage('pageDreamSurvey');
      });
    }

    // 编辑页保存
    var saveBtn = document.getElementById('dsSaveBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        if (!editingSurvey) return;
        if (!editingSurvey.title || !editingSurvey.title.trim()) {
          alert('请填写问卷标题');
          return;
        }
        if (!editingSurvey.qs || editingSurvey.qs.length === 0) {
          alert('至少添加一道题目');
          return;
        }
        for (var i = 0; i < editingSurvey.qs.length; i++) {
          var q = editingSurvey.qs[i];
          if (!q.text || !q.text.trim()) {
            alert('第 ' + (i + 1) + ' 题还没有题干');
            return;
          }
          if (q.type !== 'text') {
            var validOpts = (q.options || []).filter(function (o) { return o && o.trim(); });
            if (validOpts.length < 2) {
              alert('第 ' + (i + 1) + ' 题至少需要两个选项');
              return;
            }
          }
        }

        upsertSurvey(editingSurvey);
        editingSurvey = null;
        renderList();
        alert('已保存');
        goPage('pageDreamSurvey');
      });
    }

    // 标题输入
    var titleInput = document.getElementById('dsTitleInput');
    if (titleInput) {
      titleInput.addEventListener('input', function () {
        if (editingSurvey) editingSurvey.title = titleInput.value;
      });
    }

    // 概率输入
    var probInput = document.getElementById('dsProbInput');
    if (probInput) {
      probInput.addEventListener('input', function () {
        var v = parseInt(probInput.value, 10);
        if (isNaN(v)) v = 10;
        if (v < 0) v = 0;
        if (v > 100) v = 100;
        if (editingSurvey) editingSurvey.prob = v;
      });
    }

    // 添加题目
    var addQBtn = document.getElementById('dsAddQBtn');
    if (addQBtn) {
      addQBtn.addEventListener('click', addNewQuestion);
    }

    // 高级模式
    var advBtn = document.getElementById('dsAdvToggleBtn');
    var advArea = document.getElementById('dsAdvArea');
    var advTextarea = document.getElementById('dsAdvTextarea');
    var advParseBtn = document.getElementById('dsAdvParseBtn');
    if (advBtn && advArea) {
      advBtn.addEventListener('click', function () {
        var isActive = advArea.style.display !== 'none';
        advArea.style.display = isActive ? 'none' : 'flex';
        advBtn.classList.toggle('active', !isActive);
        if (!isActive && advTextarea && editingSurvey) {
          advTextarea.value = serializeQsToText(editingSurvey.qs);
        }
      });
    }
    if (advParseBtn && advTextarea) {
      advParseBtn.addEventListener('click', function () {
        var text = advTextarea.value || '';
        var qs = parseAdvText(text);
        if (qs.length === 0) {
          alert('没有解析出任何题目，请检查格式');
          return;
        }
        if (!editingSurvey) editingSurvey = { id: genId(), title: '', qs: [], deadline: 0, prob: 10, status: 'draft', createdAt: Date.now(), sentAt: 0, doneAt: 0 };
        editingSurvey.qs = qs;
        renderQsList();
        updateCountLabel();
        advArea.style.display = 'none';
        advBtn.classList.remove('active');
        alert('已解析 ' + qs.length + ' 道题');
      });
    }

    // 详情页返回
    var detailBackBtn = document.getElementById('dsDetailBackBtn');
    if (detailBackBtn) {
      detailBackBtn.addEventListener('click', function () {
        renderList();
        goPage('pageDreamSurvey');
      });
    }

    // 作答页返回
    var answerBackBtn = document.getElementById('dsAnswerBackBtn');
    if (answerBackBtn) {
      answerBackBtn.addEventListener('click', function () {
        if (!confirm('放弃作答吗？未提交的内容将丢失。')) return;
        answeringId = null;
        answeringData = {};
        renderList();
        goPage('pageDreamSurvey');
      });
    }
  }

  // 把题目序列化回文本（用于高级模式回显）
  function serializeQsToText(qs) {
    if (!qs || qs.length === 0) return '';
    var parts = [];
    qs.forEach(function (q) {
      var lines = [];
      if (q.type === 'text') {
        lines.push('【' + (q.text || '') + '】');
        lines.push('一');
      } else if (q.type === 'multi') {
        lines.push('【' + (q.text || '') + '】（多选' + (q.multiMax ? '·最多' + q.multiMax : '') + '）');
        (q.options || []).forEach(function (o) { lines.push(o); });
      } else {
        lines.push('【' + (q.text || '') + '】');
        (q.options || []).forEach(function (o) { lines.push(o); });
      }
      parts.push(lines.join('\n'));
    });
    return parts.join('\n\n');
  }

  // ==================== 初始化 ====================
  function init() {
    bindEvents();
    bindLibEvents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 暴露给外部
   window.dreamSurvey = {
    reload: renderList,
    openList: function () { renderList(); goPage('pageDreamSurvey'); }
  };

  // 供外部（如聊天卡片点击）打开 Ta 的问卷作答页
  window.openTaSurveyAnswer = function (id) {
    if (!id) return;
    // 先切到列表页（确保 tab 状态正确）
    currentListTab = 'theirs';
    var tabMine = document.getElementById('dsTabMine');
    var tabTheirs = document.getElementById('dsTabTheirs');
    if (tabMine) tabMine.classList.remove('active');
    if (tabTheirs) tabTheirs.classList.add('active');
    // 打开作答页
    openAnswerPage(id);
  };

  console.log('[dream-survey] 模块已加载');
})();
