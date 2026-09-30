/**
 * 存钱罐面板（独立模块）
 * - 左侧：我每天攒的钱数（可增删）
 * - 右侧：我想买的东西和价格（可增删）
 * - 使用 localforage 持久化
 * - 完全独立，不影响任何现有逻辑
 */

(function () {
  'use strict';

  var STORE_KEY = 'piggy_bank_data';

  // ==================== 数据 ====================
  var data = {
    savings: [],   // [{ id, date, amount }]
    wishes: []     // [{ id, name, price }]
  };

  // ==================== 持久化 ====================
  function persist() {
    if (typeof localforage !== 'undefined') {
      localforage.setItem(STORE_KEY, data).catch(function (e) {
        console.warn('[piggy-bank] 保存失败', e);
      });
    } else {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (e) {}
    }
  }

  function load(callback) {
    function apply(d) {
      if (d && typeof d === 'object') {
        data.savings = Array.isArray(d.savings) ? d.savings : [];
        data.wishes = Array.isArray(d.wishes) ? d.wishes : [];
      }
      if (callback) callback();
    }
    if (typeof localforage !== 'undefined') {
      localforage.getItem(STORE_KEY).then(apply).catch(function () { apply(null); });
    } else {
      try {
        var raw = localStorage.getItem(STORE_KEY);
        apply(raw ? JSON.parse(raw) : null);
      } catch (e) {
        apply(null);
      }
    }
  }

  // ==================== 工具 ====================
  function uid() {
    return 'id_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  // ==================== 渲染 ====================
  function render() {
    // 左侧：攒钱
    var savingsList = document.getElementById('piggySavingsList');
    var savingsTotal = document.getElementById('piggySavingsTotal');
    if (savingsList) {
      if (data.savings.length === 0) {
        savingsList.innerHTML = '<div class="piggy-empty">还没有记录，添加第一笔吧~</div>';
      } else {
        savingsList.innerHTML = '';
        data.savings.forEach(function (item) {
          var row = document.createElement('div');
          row.className = 'piggy-item';
          row.innerHTML =
            '<div class="piggy-item-info">' +
              '<div class="piggy-item-title">' + escapeHtml(item.date || '某天') + '</div>' +
              '<div class="piggy-item-sub">¥' + escapeHtml(String(item.amount || 0)) + '</div>' +
            '</div>' +
            '<button class="piggy-item-del" data-type="saving" data-id="' + item.id + '">' +
              '<i class="fa-solid fa-xmark"></i>' +
            '</button>';
          savingsList.appendChild(row);
        });
      }
      // 合计
      if (savingsTotal) {
        var total = data.savings.reduce(function (sum, item) {
          return sum + (parseFloat(item.amount) || 0);
        }, 0);
        savingsTotal.textContent = '共 ¥' + total.toFixed(2);
      }
    }

    // 右侧：心愿
    var wishesList = document.getElementById('piggyWishesList');
    var wishesTotal = document.getElementById('piggyWishesTotal');
    if (wishesList) {
      if (data.wishes.length === 0) {
        wishesList.innerHTML = '<div class="piggy-empty">还没有心愿，添加第一个吧~</div>';
      } else {
        wishesList.innerHTML = '';
        data.wishes.forEach(function (item) {
          var row = document.createElement('div');
          row.className = 'piggy-item';
          row.innerHTML =
            '<div class="piggy-item-info">' +
              '<div class="piggy-item-title">' + escapeHtml(item.name || '未命名') + '</div>' +
              '<div class="piggy-item-sub">¥' + escapeHtml(String(item.price || 0)) + '</div>' +
            '</div>' +
            '<button class="piggy-item-del" data-type="wish" data-id="' + item.id + '">' +
              '<i class="fa-solid fa-xmark"></i>' +
            '</button>';
          wishesList.appendChild(row);
        });
      }
      if (wishesTotal) {
        var totalW = data.wishes.reduce(function (sum, item) {
          return sum + (parseFloat(item.price) || 0);
        }, 0);
        wishesTotal.textContent = '共 ¥' + totalW.toFixed(2);
      }
    }

    // 绑定删除按钮
    document.querySelectorAll('.piggy-item-del').forEach(function (btn) {
      btn.onclick = function () {
        var type = btn.getAttribute('data-type');
        var id = btn.getAttribute('data-id');
        if (type === 'saving') {
          data.savings = data.savings.filter(function (x) { return x.id !== id; });
        } else if (type === 'wish') {
          data.wishes = data.wishes.filter(function (x) { return x.id !== id; });
        }
        persist();
        render();
      };
    });
  }

  // ==================== 创建面板 ====================
  function createPanel() {
    if (document.getElementById('piggyPanel')) return;

    var panel = document.createElement('div');
    panel.id = 'piggyPanel';
    panel.className = 'piggy-panel';
    panel.innerHTML = [
      '<div class="piggy-panel-inner">',
      '  <div class="piggy-header">',
      '    <span class="piggy-title"><i class="fa-solid fa-piggy-bank"></i> 存钱罐</span>',
      '    <button class="piggy-close" id="piggyClose"><i class="fa-solid fa-xmark"></i></button>',
      '  </div>',
      '  <div class="piggy-body">',
      '    <div class="piggy-col">',
      '      <div class="piggy-col-title"><i class="fa-solid fa-coins"></i> 每天攒的钱</div>',
      '      <div class="piggy-list" id="piggySavingsList"></div>',
      '      <div class="piggy-total" id="piggySavingsTotal">共 ¥0.00</div>',
      '      <div class="piggy-add-row">',
      '        <input type="text" class="piggy-add-input" id="piggySavingDate" placeholder="日期 (如 10/24)">',
      '        <input type="number" class="piggy-add-input" id="piggySavingAmount" placeholder="金额" min="0" step="0.01">',
      '        <button class="piggy-add-btn" id="piggyAddSaving"><i class="fa-solid fa-plus"></i></button>',
      '      </div>',
      '    </div>',
      '    <div class="piggy-col">',
      '      <div class="piggy-col-title"><i class="fa-solid fa-gift"></i> 想买的东西</div>',
      '      <div class="piggy-list" id="piggyWishesList"></div>',
      '      <div class="piggy-total" id="piggyWishesTotal">共 ¥0.00</div>',
      '      <div class="piggy-add-row">',
      '        <input type="text" class="piggy-add-input" id="piggyWishName" placeholder="想买的东西">',
      '        <input type="number" class="piggy-add-input" id="piggyWishPrice" placeholder="价格" min="0" step="0.01">',
      '        <button class="piggy-add-btn" id="piggyAddWish"><i class="fa-solid fa-plus"></i></button>',
      '      </div>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('');

    document.body.appendChild(panel);

    // 关闭
    document.getElementById('piggyClose').addEventListener('click', close);
    panel.addEventListener('click', function (e) {
      if (e.target === panel) close();
    });

    // 添加攒钱
    document.getElementById('piggyAddSaving').addEventListener('click', function () {
      var dateEl = document.getElementById('piggySavingDate');
      var amountEl = document.getElementById('piggySavingAmount');
      var date = dateEl.value.trim();
      var amount = parseFloat(amountEl.value);
      if (!date) { alert('请输入日期'); return; }
      if (isNaN(amount) || amount <= 0) { alert('请输入有效金额'); return; }
      data.savings.push({ id: uid(), date: date, amount: amount });
      persist();
      dateEl.value = '';
      amountEl.value = '';
      render();
    });

    // 添加心愿
    document.getElementById('piggyAddWish').addEventListener('click', function () {
      var nameEl = document.getElementById('piggyWishName');
      var priceEl = document.getElementById('piggyWishPrice');
      var name = nameEl.value.trim();
      var price = parseFloat(priceEl.value);
      if (!name) { alert('请输入想买的东西'); return; }
      if (isNaN(price) || price <= 0) { alert('请输入有效价格'); return; }
      data.wishes.push({ id: uid(), name: name, price: price });
      persist();
      nameEl.value = '';
      priceEl.value = '';
      render();
    });
  }

  function open() {
    createPanel();
    render();
    document.getElementById('piggyPanel').classList.add('active');
  }

  function close() {
    var panel = document.getElementById('piggyPanel');
    if (panel) panel.classList.remove('active');
  }

  // ==================== 初始化 ====================
  function init() {
    // 给存钱罐图标绑定点击（图标在 index.html 中已存在）
    var icon = document.getElementById('piggyIcon');
    if (icon) {
      icon.addEventListener('click', open);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      load(init);
    });
  } else {
    load(init);
  }

  // 暴露给外部
  window.piggyBank = {
    open: open,
    close: close
  };

})();
