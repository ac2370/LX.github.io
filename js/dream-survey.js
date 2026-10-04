/**
 * 梦向问卷模块
 * - 列表页 #pageDreamSurvey
 * - 编辑页 #pageDreamSurveyEdit
 * - 详情页 #pageDreamSurveyDetail
 * - 存储：localStorage 'dream_survey_list'
 *
 * 本次只做 UI + 基础保存，不做「TA 作答 / 交卷」逻辑
 */

(function () {
  'use strict';

  var STORE_KEY = 'dream_survey_list';
  var LS_CURRENT_EDIT = 'dream_survey_editing_id';
  var LS_CURRENT_DETAIL = 'dream_survey_detail_id';

  // ==================== 状态 ====================
  var editingSurvey = null;   // 当前编辑的问卷对象（深拷贝）

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

  // ==================== 页面切换 ====================
  function showPage(id) {
    document.querySelectorAll('.page').forEach(function (p) {
      p.classList.toggle('active', p.id === id);
    });
    window.scrollTo(0, 0);
  }

  // ==================== 列表页 ====================
  function renderList() {
    var listBox = document.getElementById('dsList');
    var emptyBox = document.getElementById('dsEmpty');
    if (!listBox || !emptyBox) return;

    var list = loadList();

    if (list.length === 0) {
      listBox.innerHTML = '';
      emptyBox.classList.add('show');
      return;
    }
    emptyBox.classList.remove('show');

    listBox.innerHTML = '';
    list.forEach(function (s) {
      var item = document.createElement('div');
      item.className = 'ds-item';
      item.dataset.id = s.id;

      var statusText = { draft: '草稿', sent: '已发出', done: '已交卷' }[s.status] || '草稿';
      var statusClass = s.status || 'draft';

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
        openDetail(s.id);
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

      // 头部：序号 + 类型 select + 删除
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
          // 文字题不需要选项
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

      // 题干
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
        // 文字题：显示提示
        var hint = document.createElement('div');
        hint.className = 'ds-q-text-hint';
        hint.textContent = '文字题：Ta 会自由作答';
        card.appendChild(hint);
      } else {
        // 单选/多选：选项列表
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

        // 多选：加多选上限
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
    // 滚动到新题
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

    // 用连续空行分段
    var blocks = text.split(/\n\s*\n/).map(function (b) { return b.trim(); }).filter(Boolean);

    blocks.forEach(function (block) {
      var lines = block.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
      if (lines.length === 0) return;

      var first = lines[0];
      var rest = lines.slice(1);

      // 【xxx】开头
      var m = first.match(/^【(.+?)】(.*)$/);
      var title, tail;
      if (m) {
        title = m[1].trim();
        tail = (m[2] || '').trim();
      } else {
        // 裸行 → 文字题
        result.push({ type: 'text', text: first });
        return;
      }

      // 题干带"多选"
      var isMulti = /多选/.test(tail) || /多选/.test(title);
      var multiMaxMatch = (tail + ' ' + title).match(/最多\s*(\d+)/);
      var multiMax = multiMaxMatch ? parseInt(multiMaxMatch[1], 10) : 0;
      if (multiMax && (multiMax < 2 || multiMax > 6)) multiMax = 0;

      // 剩下是选项，或「一」=文字题
      if (rest.length === 0 || (rest.length === 1 && rest[0] === '一')) {
        result.push({ type: 'text', text: title });
        return;
      }

      // 有选项
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

      // 只有一个选项：当文字题
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

    // 顶栏的编辑按钮
    var editBtn = document.getElementById('dsDetailEditBtn');
    if (editBtn) {
      editBtn.onclick = function () {
        editingSurvey = deepClone(s);
        renderEdit();
        showPage('pageDreamSurveyEdit');
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

    showPage('pageDreamSurveyDetail');
  }

  // ==================== 事件绑定 ====================
  function bindEvents() {
    // 主页入口
    var homeBtn = document.getElementById('btnDreamSurvey');
    if (homeBtn) {
      homeBtn.addEventListener('click', function (e) {
        e.preventDefault();
        renderList();
        showPage('pageDreamSurvey');
      });
    }

    // 列表页返回
    var backBtn = document.getElementById('dsBackBtn');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        if (typeof window.showPage === 'function') {
          window.showPage('pageHome');
        } else {
          showPage('pageHome');
        }
      });
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
        showPage('pageDreamSurveyEdit');
      });
    }

    // 编辑页返回
    var editBackBtn = document.getElementById('dsEditBackBtn');
    if (editBackBtn) {
      editBackBtn.addEventListener('click', function () {
        if (!confirm('放弃当前编辑吗？未保存的修改将丢失。')) return;
        editingSurvey = null;
        renderList();
        showPage('pageDreamSurvey');
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
        // 校验每道题的题干
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
        showPage('pageDreamSurvey');
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

    // 高级模式切换
    var advBtn = document.getElementById('dsAdvToggleBtn');
    var advArea = document.getElementById('dsAdvArea');
    var advTextarea = document.getElementById('dsAdvTextarea');
    var advParseBtn = document.getElementById('dsAdvParseBtn');
    if (advBtn && advArea) {
      advBtn.addEventListener('click', function () {
        var isActive = advArea.style.display !== 'none';
        advArea.style.display = isActive ? 'none' : 'flex';
        advBtn.classList.toggle('active', !isActive);
        // 切到高级模式时，把当前题目序列化成文本
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
        // 收起高级模式
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
        showPage('pageDreamSurvey');
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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 暴露给外部
  window.dreamSurvey = {
    reload: renderList,
    openList: function () { renderList(); showPage('pageDreamSurvey'); }
  };

  console.log('[dream-survey] 模块已加载');
})();
