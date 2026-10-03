/**
 * 设置面板里的「公共字卡库」勾选列表
 * - 在 #publicCardsList 容器里动态生成 checkbox
 * - 按分类分组显示（回复 / 拍一拍）
 * - 提供全选 / 全不选
 */

(function () {
  'use strict';

  function buildPanel() {
    var container = document.getElementById('publicCardsList');
    if (!container) {
      // 容器还没生成（设置面板没打开），静默跳过
      return;
    }

    if (!window.publicCards || !window.publicCards.isReady()) {
      window.publicCards && window.publicCards.onReady(buildPanel);
      return;
    }

    container.innerHTML = '';
    // ... 后续渲染逻辑
  }

    // 顶部操作栏
    var bar = document.createElement('div');
    bar.className = 'public-cards-bar';
    bar.innerHTML =
      '<span class="public-cards-title">公共字卡库</span>' +
      '<div class="public-cards-actions">' +
      '  <button type="button" class="public-cards-btn" id="pcSelectAll">全选</button>' +
      '  <button type="button" class="public-cards-btn" id="pcDeselectAll">全不选</button>' +
      '</div>';
    container.appendChild(bar);

    // 分类：reply / pat
    var categories = [
      { key: 'reply', label: '回复' },
      { key: 'pat',   label: '拍一拍' }
    ];

    categories.forEach(function (cat) {
      var groups = window.publicCards.getGroupsByCategory(cat.key);
      if (groups.length === 0) return;

      var section = document.createElement('div');
      section.className = 'public-cards-section';

      var title = document.createElement('div');
      title.className = 'public-cards-section-title';
      title.textContent = cat.label;
      section.appendChild(title);

      var list = document.createElement('div');
      list.className = 'public-cards-group-list';

      groups.forEach(function (g) {
        var count = window.publicCards.getGroupCount(g);
        var checked = window.publicCards.isSelected(g);

        var row = document.createElement('label');
        row.className = 'public-cards-item' + (checked ? ' checked' : '');
        row.setAttribute('data-group', g);
        row.setAttribute('data-category', cat.key);

        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = checked;
        cb.addEventListener('change', function () {
          window.publicCards.toggle(g);
          row.classList.toggle('checked', cb.checked);
        });

        var txt = document.createElement('span');
        txt.className = 'public-cards-item-name';
        txt.textContent = g;

        var num = document.createElement('span');
        num.className = 'public-cards-item-count';
        num.textContent = '(' + count + ' 条)';

        row.appendChild(cb);
        row.appendChild(txt);
        row.appendChild(num);
        list.appendChild(row);
      });

      section.appendChild(list);
      container.appendChild(section);
    });

    // 全选 / 全不选
    var allGroups = window.publicCards.getAllGroups();

    var btnAll = document.getElementById('pcSelectAll');
    if (btnAll) {
      btnAll.addEventListener('click', function () {
        window.publicCards.setSelected(allGroups);
        refreshCheckboxes();
      });
    }

    var btnNone = document.getElementById('pcDeselectAll');
    if (btnNone) {
      btnNone.addEventListener('click', function () {
        window.publicCards.setSelected([]);
        refreshCheckboxes();
      });
    }

    function refreshCheckboxes() {
      container.querySelectorAll('.public-cards-item').forEach(function (row) {
        var g = row.getAttribute('data-group');
        var cb = row.querySelector('input[type="checkbox"]');
        var checked = window.publicCards.isSelected(g);
        if (cb) cb.checked = checked;
        row.classList.toggle('checked', checked);
      });
    }
  }

  // 等待 publicCards 就绪 + DOM 就绪
 function init() {
  if (!window.publicCards) {
    console.warn('[public-cards-panel] window.publicCards 未加载');
    return;
  }
  window.publicCards.onReady(function () {
    // 只在容器存在时才渲染
    if (document.getElementById('publicCardsList')) {
      buildPanel();
    }
  });
}

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
