/**
 * 重要日 页面逻辑（独立模块）
 * - 数据存储：localStorage.my_important_days
 * - 提供添加弹窗、日期选择器、类型选择器、天数计算、卡片渲染
 * - 依赖：无
 */

(function () {
  'use strict';

  var pageImp = document.getElementById('pageImportantDay');
  var btnImp = document.getElementById('btnImportantDay');
  if (!pageImp) return;

  var STORE_KEY = 'my_important_days';

  // ==================== 数据读写 ====================
  function loadData() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return [];
      var data = JSON.parse(raw);
      if (!Array.isArray(data)) return [];
      return data;
    } catch (e) { return []; }
  }

  function saveData(arr) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(arr));
    } catch (e) {}
  }

  // ==================== 颜色池（按类型分） ====================
  var COLOR_POOL = {
    anniversary: { bg: 'linear-gradient(135deg, #fcd8e0 0%, #f8c0d0 100%)', icon: 'fa-heart', color: '#e58b9b' },
    birthday:    { bg: 'linear-gradient(135deg, #fce4d8 0%, #fcd0b8 100%)', icon: 'fa-birthday-cake', color: '#e09b6b' },
    countdown:   { bg: 'linear-gradient(135deg, #d8ecfc 0%, #c0d8f8 100%)', icon: 'fa-hourglass-half', color: '#6fa3cc' },
    default:     { bg: 'linear-gradient(135deg, #e0d8fc 0%, #d0c0f8 100%)', icon: 'fa-star', color: '#9b8bd0' }
  };

  // ==================== 计算剩余/已过天数 ====================
  function calcDays(dateStr) {
    var target = new Date(dateStr + 'T00:00:00');
    if (isNaN(target.getTime())) return { text: '日期无效', type: 'future' };

    var now = new Date();
    now.setHours(0, 0, 0, 0);
    var diff = Math.round((now - target) / 86400000);

    if (diff === 0) {
      return { text: '就是今天', type: 'today' };
    } else if (diff > 0) {
      return { text: '已过 ' + diff + ' 天', type: 'past' };
    } else {
      return { text: '还有 ' + Math.abs(diff) + ' 天', type: 'future' };
    }
  }

  // ==================== 日期格式显示 ====================
  function formatDateDisplay(dateStr) {
    return dateStr.replace(/-/g, '.');
  }

  // ==================== 渲染列表 ====================
  function renderList() {
    var listEl = document.getElementById('impList');
    var emptyEl = document.getElementById('impEmpty');
    if (!listEl) return;

    var data = loadData();

    if (data.length === 0) {
      listEl.innerHTML = '';
      if (emptyEl) emptyEl.classList.add('active');
      return;
    }

    if (emptyEl) emptyEl.classList.remove('active');
    listEl.innerHTML = '';

    data.forEach(function (item, index) {
      var meta = COLOR_POOL[item.type] || COLOR_POOL.default;
      var calc = calcDays(item.date);

      var card = document.createElement('div');
      card.className = 'imp-card';
      card.innerHTML =
        '<div class="imp-card-icon" style="background: ' + meta.bg + ';">' +
        '  <i class="fa-solid ' + meta.icon + '" style="color: ' + meta.color + ';"></i>' +
        '</div>' +
        '<div class="imp-card-info">' +
        '  <div class="imp-card-name">' + escapeHtml(item.name || '未命名') + '</div>' +
        '  <div class="imp-card-date">' + formatDateDisplay(item.date || '') + '</div>' +
        '  <div class="imp-card-remain ' + calc.type + '">' + calc.text + '</div>' +
        '</div>' +
        '<div class="imp-card-arrow"><i class="fa-solid fa-chevron-right"></i></div>';

      // 点击卡片 → 提示
      card.addEventListener('click', function () {
        alert('重要日：' + (item.name || '未命名') + '\n日期：' + formatDateDisplay(item.date || '') + '\n' + calc.text);
      });

      // 长按删除
      card.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        if (confirm('删除「' + (item.name || '未命名') + '」吗？')) {
          var arr = loadData();
          arr.splice(index, 1);
          saveData(arr);
          renderList();
        }
      });

      listEl.appendChild(card);
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  // ==================== 页面切换 ====================
  function showImpPage() {
    document.querySelectorAll('.page').forEach(function (p) {
      p.classList.remove('active');
    });
    pageImp.classList.add('active');
    window.scrollTo(0, 0);
    renderList();
  }

  function goHome() {
    document.querySelectorAll('.page').forEach(function (p) {
      p.classList.remove('active');
    });
    var home = document.getElementById('pageHome');
    if (home) home.classList.add('active');
  }

  // ==================== 绑定主页"重要日"按钮 ====================
  if (btnImp) {
    btnImp.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      showImpPage();
    });
  }

  // ==================== 返回按钮 ====================
  var backBtn = document.getElementById('impBackBtn');
  if (backBtn) {
    backBtn.addEventListener('click', function () {
      goHome();
    });
  }

  // ==================== 添加重要日弹窗 ====================
  var addBtn = document.getElementById('impAddBtn');
  var modal = null;

  function ensureModal() {
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'impModal';
    modal.className = 'imp-modal';
    modal.innerHTML =
      '<div class="imp-modal-panel">' +
      '  <div class="imp-modal-title">添加重要日</div>' +
      '  <div class="imp-modal-label">名称</div>' +
      '  <input type="text" class="imp-modal-input" id="impModalName" placeholder="例如：恋爱纪念日">' +
      '  <div class="imp-modal-label">日期</div>' +
      '  <div class="imp-date-picker" id="impDatePickerWrap">' +
      '    <button type="button" class="imp-date-btn" id="impDateBtn">' +
      '      <i class="fa-regular fa-calendar-days imp-date-btn-icon"></i>' +
      '      <span class="imp-date-text" id="impDateText">选择日期</span>' +
      '      <i class="fa-solid fa-chevron-down imp-date-arrow"></i>' +
      '    </button>' +
      '    <div class="imp-calendar" id="impCalendar">' +
      '      <div class="imp-cal-header">' +
      '        <button type="button" class="imp-cal-nav" id="impCalPrev">' +
      '          <i class="fa-solid fa-chevron-left"></i>' +
      '        </button>' +
      '        <div class="imp-cal-title" id="impCalTitle">2026年10月</div>' +
      '        <button type="button" class="imp-cal-nav" id="impCalNext">' +
      '          <i class="fa-solid fa-chevron-right"></i>' +
      '        </button>' +
      '      </div>' +
      '      <div class="imp-cal-weekdays">' +
      '        <span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span>' +
      '      </div>' +
      '      <div class="imp-cal-days" id="impCalDays"></div>' +
      '      <div class="imp-cal-footer">' +
      '        <button type="button" class="imp-cal-btn imp-cal-cancel" id="impCalCancel">取消</button>' +
      '        <button type="button" class="imp-cal-btn imp-cal-confirm" id="impCalConfirm">确定</button>' +
      '      </div>' +
      '    </div>' +
      '  </div>' +
      '  <div class="imp-modal-label">类型</div>' +
      '  <div class="imp-select" id="impModalTypeSelect">' +
      '    <button type="button" class="imp-select-btn" id="impModalTypeBtn">' +
      '      <span class="imp-select-dot" style="background: #e58b9b;"></span>' +
      '      <span class="imp-select-text" id="impModalTypeText">纪念日</span>' +
      '      <i class="fa-solid fa-chevron-down imp-select-arrow"></i>' +
      '    </button>' +
      '    <div class="imp-select-menu" id="impModalTypeMenu">' +
      '      <div class="imp-select-item active" data-value="anniversary">' +
      '        <span class="imp-select-dot" style="background: #e58b9b;"></span>' +
      '        <span>纪念日</span>' +
      '      </div>' +
      '      <div class="imp-select-item" data-value="birthday">' +
      '        <span class="imp-select-dot" style="background: #e09b6b;"></span>' +
      '        <span>生日</span>' +
      '      </div>' +
      '      <div class="imp-select-item" data-value="countdown">' +
      '        <span class="imp-select-dot" style="background: #6fa3cc;"></span>' +
      '        <span>倒数日</span>' +
      '      </div>' +
      '      <div class="imp-select-item" data-value="default">' +
      '        <span class="imp-select-dot" style="background: #9b8bd0;"></span>' +
      '        <span>其他</span>' +
      '      </div>' +
      '    </div>' +
      '  </div>' +
      '  <div class="imp-modal-actions">' +
      '    <button class="imp-modal-cancel" id="impModalCancel">取消</button>' +
      '    <button class="imp-modal-confirm" id="impModalConfirm">保存</button>' +
      '  </div>' +
      '</div>';

    document.body.appendChild(modal);

    document.getElementById('impModalCancel').addEventListener('click', function () {
      modal.classList.remove('active');
    });
    modal.addEventListener('click', function (e) {
      if (e.target === modal) modal.classList.remove('active');
    });

    // ============ 自定义类型下拉选择器 ============
    var currentType = 'anniversary';
    var typeColors = {
      anniversary: '#e58b9b',
      birthday: '#e09b6b',
      countdown: '#6fa3cc',
      default: '#9b8bd0'
    };
    var typeNames = {
      anniversary: '纪念日',
      birthday: '生日',
      countdown: '倒数日',
      default: '其他'
    };

    var typeBtn = document.getElementById('impModalTypeBtn');
    var typeMenu = document.getElementById('impModalTypeMenu');
    var typeText = document.getElementById('impModalTypeText');

    if (typeBtn && typeMenu) {
      typeBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        typeMenu.classList.toggle('active');
        var arrow = typeBtn.querySelector('.imp-select-arrow');
        if (arrow) {
          arrow.style.transform = typeMenu.classList.contains('active')
            ? 'rotate(180deg)' : 'rotate(0)';
        }
      });

      typeMenu.querySelectorAll('.imp-select-item').forEach(function (item) {
        item.addEventListener('click', function (e) {
          e.stopPropagation();
          var val = item.getAttribute('data-value');
          currentType = val;

          typeText.textContent = typeNames[val];
          var dot = typeBtn.querySelector('.imp-select-dot');
          if (dot) dot.style.background = typeColors[val];

          typeMenu.querySelectorAll('.imp-select-item').forEach(function (i) {
            i.classList.remove('active');
          });
          item.classList.add('active');

          typeMenu.classList.remove('active');
          var arrow2 = typeBtn.querySelector('.imp-select-arrow');
          if (arrow2) arrow2.style.transform = 'rotate(0)';
        });
      });

      document.addEventListener('click', function () {
        typeMenu.classList.remove('active');
        var arrow3 = typeBtn.querySelector('.imp-select-arrow');
        if (arrow3) arrow3.style.transform = 'rotate(0)';
      });
    }

    // ============ 自定义日历选择器 ============
    var calCurrentYear = 0;
    var calCurrentMonth = 0;
    var calSelectedDate = null;
    var calTempDate = null;

    var dateBtn = document.getElementById('impDateBtn');
    var dateText = document.getElementById('impDateText');
    var calendar = document.getElementById('impCalendar');
    var calTitle = document.getElementById('impCalTitle');
    var calDays = document.getElementById('impCalDays');
    var calPrev = document.getElementById('impCalPrev');
    var calNext = document.getElementById('impCalNext');
    var calCancel = document.getElementById('impCalCancel');
    var calConfirm = document.getElementById('impCalConfirm');

    function pad2(n) { return n < 10 ? '0' + n : '' + n; }

    function formatDateStr(y, m, d) {
      return y + '-' + pad2(m) + '-' + pad2(d);
    }

    function formatDateDisplay(str) {
      if (!str) return '选择日期';
      return str.replace(/-/g, '.');
    }

    function renderCalendar(year, month) {
      calTitle.textContent = year + '年' + (month + 1) + '月';

      var firstDay = new Date(year, month, 1).getDay();
      var daysInMonth = new Date(year, month + 1, 0).getDate();
      var prevMonthDays = new Date(year, month, 0).getDate();

      calDays.innerHTML = '';

      var today = new Date();
      var todayStr = formatDateStr(today.getFullYear(), today.getMonth() + 1, today.getDate());

      var totalCells = firstDay + daysInMonth;
      var rows = Math.ceil(totalCells / 7);
      var totalSlots = rows * 7;

      for (var i = 0; i < totalSlots; i++) {
        var cell = document.createElement('div');
        cell.className = 'imp-cal-day';

        var dayNum, isCurrentMonth = true, isPrev = false, isNext = false;
        if (i < firstDay) {
          dayNum = prevMonthDays - firstDay + i + 1;
          isCurrentMonth = false;
          isPrev = true;
        } else if (i >= firstDay + daysInMonth) {
          dayNum = i - firstDay - daysInMonth + 1;
          isCurrentMonth = false;
          isNext = true;
        } else {
          dayNum = i - firstDay + 1;
        }

        cell.textContent = dayNum;
        if (!isCurrentMonth) {
          cell.classList.add('other-month');
        }

        var cellYear = year, cellMonth = month + 1, cellDay = dayNum;
        if (isPrev) {
          cellMonth = month;
          if (cellMonth === 0) { cellMonth = 12; cellYear = year - 1; }
        } else if (isNext) {
          cellMonth = month + 2;
          if (cellMonth === 13) { cellMonth = 1; cellYear = year + 1; }
        }
        var cellDateStr = formatDateStr(cellYear, cellMonth, cellDay);

        if (cellDateStr === todayStr) {
          cell.classList.add('today');
        }

        if (calTempDate === cellDateStr) {
          cell.classList.add('selected');
        }

        (function (dateStr, c) {
          c.addEventListener('click', function (e) {
            e.stopPropagation();
            calTempDate = dateStr;
            renderCalendar(year, month);
          });
        })(cellDateStr, cell);

        calDays.appendChild(cell);
      }
    }

    if (dateBtn) {
      dateBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        calendar.classList.toggle('active');
        var arrow = dateBtn.querySelector('.imp-date-arrow');
        if (arrow) {
          arrow.style.transform = calendar.classList.contains('active')
            ? 'rotate(180deg)' : 'rotate(0)';
        }

        if (calendar.classList.contains('active')) {
          if (calSelectedDate) {
            var parts = calSelectedDate.split('-');
            calCurrentYear = parseInt(parts[0], 10);
            calCurrentMonth = parseInt(parts[1], 10) - 1;
            calTempDate = calSelectedDate;
          } else {
            var now = new Date();
            calCurrentYear = now.getFullYear();
            calCurrentMonth = now.getMonth();
            calTempDate = null;
          }
          renderCalendar(calCurrentYear, calCurrentMonth);

          setTimeout(function () {
            var rect = calendar.getBoundingClientRect();
            var viewportHeight = window.innerHeight;
            if (rect.bottom > viewportHeight - 20) {
              calendar.classList.add('expand-up');
            } else {
              calendar.classList.remove('expand-up');
            }
          }, 10);
        }
      });
    }

    if (calPrev) {
      calPrev.addEventListener('click', function (e) {
        e.stopPropagation();
        calCurrentMonth--;
        if (calCurrentMonth < 0) { calCurrentMonth = 11; calCurrentYear--; }
        renderCalendar(calCurrentYear, calCurrentMonth);
      });
    }

    if (calNext) {
      calNext.addEventListener('click', function (e) {
        e.stopPropagation();
        calCurrentMonth++;
        if (calCurrentMonth > 11) { calCurrentMonth = 0; calCurrentYear++; }
        renderCalendar(calCurrentYear, calCurrentMonth);
      });
    }

    if (calCancel) {
      calCancel.addEventListener('click', function (e) {
        e.stopPropagation();
        calendar.classList.remove('active');
        var arrow = dateBtn.querySelector('.imp-date-arrow');
        if (arrow) arrow.style.transform = 'rotate(0)';
        calTempDate = calSelectedDate;
      });
    }

    if (calConfirm) {
      calConfirm.addEventListener('click', function (e) {
        e.stopPropagation();
        if (!calTempDate) {
          alert('请选择日期');
          return;
        }
        calSelectedDate = calTempDate;
        dateText.textContent = formatDateDisplay(calSelectedDate);
        dateText.style.color = '#333';
        calendar.classList.remove('active');
        var arrow = dateBtn.querySelector('.imp-date-arrow');
        if (arrow) arrow.style.transform = 'rotate(0)';
      });
    }

    document.addEventListener('click', function (e) {
      if (calendar && calendar.classList.contains('active')) {
        if (!calendar.contains(e.target) && e.target !== dateBtn && !dateBtn.contains(e.target)) {
          calendar.classList.remove('active');
          var arrow = dateBtn.querySelector('.imp-date-arrow');
          if (arrow) arrow.style.transform = 'rotate(0)';
        }
      }
    });

    // ============ 保存按钮 ============
    document.getElementById('impModalConfirm').addEventListener('click', function () {
      var name = (document.getElementById('impModalName').value || '').trim();
      var date = calSelectedDate;
      var type = currentType;

      if (!name) { alert('请输入名称'); return; }
      if (!date) { alert('请选择日期'); return; }

      var arr = loadData();
      arr.push({
        name: name,
        date: date,
        type: type,
        createdAt: Date.now()
      });
      saveData(arr);
      modal.classList.remove('active');
      renderList();

      // 清空
      document.getElementById('impModalName').value = '';

      // 重置日期选择器
      calSelectedDate = null;
      calTempDate = null;
      if (dateText) {
        dateText.textContent = '选择日期';
        dateText.style.color = '';
      }

      // 重置类型选择器
      currentType = 'anniversary';
      if (typeText) typeText.textContent = '纪念日';
      var dot2 = typeBtn.querySelector('.imp-select-dot');
      if (dot2) dot2.style.background = '#e58b9b';
      typeMenu.querySelectorAll('.imp-select-item').forEach(function (i) {
        i.classList.toggle('active', i.getAttribute('data-value') === 'anniversary');
      });
    });

    return modal;
  }

  if (addBtn) {
    addBtn.addEventListener('click', function () {
      ensureModal();
      modal.classList.add('active');
    });
  }

  // ==================== 初始化 ====================
  renderList();

  // 暴露给外部
  window.pageImportantDay = {
    show: showImpPage,
    back: goHome,
    refresh: renderList
  };

})();
