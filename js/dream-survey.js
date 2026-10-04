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

     
