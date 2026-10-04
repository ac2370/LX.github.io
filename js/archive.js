/**
 * archive.js —— 档案模块
 * 页面：#pageArchive
 * 存储：localStorage 'archive_data_v1'
 * 数据：{ me: {...}, contacts: { [contactId]: {...} } }
 */

(function () {
  'use strict';

  var STORE_KEY = 'archive_data_v1';
  var currentTab = 'me';   // 'me' | 'ta'

  // ==================== 存储 ====================
  function loadData() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return { me: {}, contacts: {} };
      var d = JSON.parse(raw);
      if (!d.me) d.me = {};
      if (!d.contacts) d.contacts = {};
      return d;
    } catch (e) {
      return { me: {}, contacts: {} };
    }
  }
  function saveData(d) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(d)); } catch (e) {
      console.warn('[archive] 保存失败', e);
    }
  }

  // ==================== 当前联系人 ====================
  function getCurrentContact() {
    try {
      var contacts = JSON.parse(localStorage.getItem('my_contacts') || '[]');
      var id = localStorage.getItem('my_current_contact');
      if (Array.isArray(contacts) && contacts.length > 0) {
        return contacts.find(function (c) { return c.id === id; }) || contacts[0];
      }
    } catch (e) {}
    return null;
  }

  // ==================== 字段定义 ====================
  var FIELDS = ['appearance', 'identity', 'age', 'desc', 'basicInfo', 'history', 'preferences', 'relations'];
  var PLACEHOLDERS = {
    appearance: '输入外貌',
    identity: '输入身份',
    age: '输入年龄',
    desc: '背景设定留白，文本过长可滑动展开。',
    basicInfo: '在此填入更多基础维度的详细数据与设定参数。',
    history: '记录人物过往的履历、事件节点与背景故事。',
    preferences: '关于日习惯、偏好物品以及厌恶事物的明细。',
    relations: '展示与外部社会、其他角色的阵营关系及纽带。'
  };

  function getCurrentEntry(data) {
    if (currentTab === 'me') return data.me;
    var c = getCurrentContact();
    if (!c) return {};
    if (!data.contacts[c.id]) data.contacts[c.id] = {};
    return data.contacts[c.id];
  }

  // ==================== 渲染 ====================
  function render() {
    var data = loadData();
    var entry = getCurrentEntry(data);
    var c = getCurrentContact();

    var photoEl = document.getElementById('cen_main_photo');
    var nameEl = document.getElementById('arcPhotoName');
    var quoteEl = document.getElementById('arcQuoteTitle');

    // 照片
    if (photoEl) {
      if (entry.photo) {
        photoEl.style.backgroundImage = 'url(' + entry.photo + ')';
      } else if (currentTab === 'me') {
        var myAvatar = document.getElementById('avatarImg');
        var url = '';
        try {
          var raw = localStorage.getItem('home_custom_images');
          if (raw) {
            var hd = JSON.parse(raw);
            if (hd && hd.avatar) url = hd.avatar;
          }
        } catch (e) {}
        if (!url && myAvatar && myAvatar.src) url = myAvatar.src;
        photoEl.style.backgroundImage = url ? 'url(' + url + ')' : '';
      } else {
        var taAvatar = document.getElementById('chatAvatar');
        if (taAvatar && taAvatar.src) photoEl.style.backgroundImage = 'url(' + taAvatar.src + ')';
        else photoEl.style.backgroundImage = '';
      }
    }

    // 名字
    if (nameEl) {
      if (entry.name) {
        nameEl.textContent = entry.name;
      } else if (currentTab === 'me') {
        nameEl.textContent = '我';
      } else {
        nameEl.textContent = c ? (c.name || 'Ta') : 'Ta';
      }
    }

    // 标题
    if (quoteEl) {
      quoteEl.textContent = entry.quote || '如果某天我真的杳无音讯';
    }

    // 字段
    FIELDS.forEach(function (f) {
      var el = document.querySelector('.arc-field[data-field="' + f + '"], .arc-field-block[data-field="' + f + '"]');
      if (!el) return;
      if (entry[f] && entry[f].trim()) {
        el.textContent = entry[f];
        el.removeAttribute('data-empty');
      } else {
        el.textContent = PLACEHOLDERS[f] || '';
        el.setAttribute('data-empty', '1');
      }
    });

        // 3D 引擎复位
    if (window.cen3DEngineInstance && typeof window.cen3DEngineInstance.setTargetY === 'function') {
      window.cen3DEngineInstance.setTargetY(0);
    }
  }

  // ==================== 收集字段 ====================
  function collectFields() {
    var data = loadData();
    var entry = getCurrentEntry(data);

    FIELDS.forEach(function (f) {
      var el = document.querySelector('.arc-field[data-field="' + f + '"], .arc-field-block[data-field="' + f + '"]');
      if (!el) return;
      var text = el.textContent.trim();
      var placeholder = PLACEHOLDERS[f] || '';
      if (text === placeholder || el.getAttribute('data-empty') === '1') text = '';
      entry[f] = text;
    });

    var nameEl = document.getElementById('arcPhotoName');
    if (nameEl) {
      var n = nameEl.textContent.trim();
      if (n && n !== '我' && n !== 'Ta') entry.name = n;
    }

    saveData(data);
    return true;
  }

  // ==================== 照片上传 ====================
  function bindPhotoUpload() {
    var photoEl = document.getElementById('cen_main_photo');
    var input = document.getElementById('arcPhotoInput');
    if (!photoEl || !input) return;

    var pressTimer = null;

    function startPress() {
      pressTimer = setTimeout(function () {
        input.click();
      }, 600);
    }
    function cancelPress() {
      if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    }

    photoEl.addEventListener('mousedown', startPress);
    photoEl.addEventListener('mouseup', cancelPress);
    photoEl.addEventListener('mouseleave', cancelPress);
    photoEl.addEventListener('touchstart', startPress, { passive: true });
    photoEl.addEventListener('touchend', cancelPress);
    photoEl.addEventListener('touchcancel', cancelPress);

    input.addEventListener('change', function () {
      var f = input.files && input.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function (e) {
        var url = e.target.result;
        if (photoEl) photoEl.style.backgroundImage = 'url(' + url + ')';
        var data = loadData();
        var entry = getCurrentEntry(data);
        entry.photo = url;
        saveData(data);
      };
      reader.readAsDataURL(f);
    });
  }

  // ==================== Tab 切换 ====================
  function switchTab(tab) {
    currentTab = tab;
    var tabMe = document.getElementById('arcTabMe');
    var tabTa = document.getElementById('arcTabTa');
    if (tabMe) tabMe.classList.toggle('active', tab === 'me');
    if (tabTa) tabTa.classList.toggle('active', tab === 'ta');
    render();
  }

  // ==================== 字段编辑事件 ====================
  function bindFieldEditing() {
    document.querySelectorAll('.arc-field, .arc-field-block').forEach(function (el) {
      el.addEventListener('focus', function () {
        if (el.getAttribute('data-empty') === '1') {
          el.textContent = '';
          el.removeAttribute('data-empty');
        }
      });
      el.addEventListener('blur', function () {
        var text = el.textContent.trim();
        var f = el.getAttribute('data-field');
        var placeholder = PLACEHOLDERS[f] || '';
        if (!text) {
          el.textContent = placeholder;
          el.setAttribute('data-empty', '1');
        }
      });
    });
  }

  // ==================== 事件绑定 ====================
  function bindEvents() {
    // 主页入口
    var homeBtn = document.getElementById('btnArchive');
    if (homeBtn) {
      homeBtn.addEventListener('click', function (e) {
        e.preventDefault();
        if (typeof window.showPage === 'function') {
          window.showPage('pageArchive');
        }
        switchTab('me');
      });
    }

    // 返回
    var backBtn = document.getElementById('arcBackBtn');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        if (typeof window.showPage === 'function') {
          window.showPage('pageHome');
        }
      });
    }

    // 保存
    var saveBtn = document.getElementById('arcSaveBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        collectFields();
        alert('已保存');
      });
    }

    // Tab 切换
    var tabMe = document.getElementById('arcTabMe');
    var tabTa = document.getElementById('arcTabTa');
    if (tabMe) tabMe.addEventListener('click', function () { switchTab('me'); });
    if (tabTa) tabTa.addEventListener('click', function () { switchTab('ta'); });

    // 联系人变化
    window.addEventListener('contactChanged', function () {
      if (currentTab === 'ta') render();
      else switchTab('ta');
    });
    window.addEventListener('storage', function (e) {
      if (e.key === 'my_current_contact') {
        if (currentTab === 'ta') render();
      }
    });
  }

  // ==================== 3D 旋转引擎 ====================
  function init3DEngine() {
    var targetId = 'Tuan_init_rotator';
    var el = document.getElementById(targetId);
    if (!el) return;

    var isDragging = false;
    var startX = 0, rawX = 0;
    var rotY = 0, targetY = 0;
    var friction = 0.12, sensitivity = 0.6;
    var bubbleTimer = null;

    function onStart(e) {
      var stage = document.getElementById('cenConfig_stage');
      if (stage && stage.classList.contains('cen-intro-mode')) return;
      isDragging = true;
      el.style.cursor = 'grabbing';
      el.style.transition = 'none';
      var clientX = e.type.indexOf('mouse') >= 0 ? e.clientX : e.touches[0].clientX;
      rawX = clientX;
      startX = clientX - (targetY / sensitivity);
    }
    function onMove(e) {
      if (!isDragging) return;
      e.preventDefault();
      var clientX = e.type.indexOf('mouse') >= 0 ? e.clientX : e.touches[0].clientX;
      var deltaX = clientX - startX;
      targetY = deltaX * sensitivity;
    }
    function onEnd(e) {
      isDragging = false;
      el.style.cursor = 'grab';

      var clientX = rawX;
      if (e.type.indexOf('mouse') >= 0) {
        clientX = e.clientX;
      } else if (e.changedTouches && e.changedTouches.length > 0) {
        clientX = e.changedTouches[0].clientX;
      }

      if (Math.abs(clientX - rawX) < 5) {
        if (e.target.id === 'cen_mouth_zone') {
          var bubble = document.getElementById('cen_speech_bubble');
          if (bubble) {
            bubble.style.opacity = '1';
            bubble.style.filter = 'blur(0px)';
            bubble.style.transform = 'translate(-50%, -15px) translateZ(50px)';
            clearTimeout(bubbleTimer);
            bubbleTimer = setTimeout(function () {
              bubble.style.opacity = '0';
              bubble.style.filter = 'blur(8px)';
              bubble.style.transform = 'translate(-50%, 10px) translateZ(50px)';
            }, 2000);
          }
        }
      }
    }

    el.addEventListener('mousedown', onStart);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    el.addEventListener('touchstart', onStart, { passive: false });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);

    var resetBtn = document.getElementById('reset_btn_cen');
    if (resetBtn) {
      resetBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        targetY = 0;
      });
    }

    function renderLoop() {
      rotY += (targetY - rotY) * friction;
      if (el) el.style.transform = 'rotateX(0deg) rotateY(' + rotY + 'deg)';
      requestAnimationFrame(renderLoop);
    }
    renderLoop();

    window.cen3DEngineInstance = {
      setTargetY: function (v) { targetY = v; },
      get targetY() { return targetY; }
    };
  }

  // ==================== 全局：intro → play 动画 ====================
  window.cenTriggerPlayAnim = function () {
    var stage = document.getElementById('cenConfig_stage');
    if (stage && stage.classList.contains('cen-intro-mode')) {
      stage.classList.remove('cen-intro-mode');
      stage.classList.add('cen-play-mode');
    }
  };
  window.cenReturnToIntro = function () {
    var stage = document.getElementById('cenConfig_stage');
    if (stage && stage.classList.contains('cen-play-mode')) {
      stage.classList.remove('cen-play-mode');
      stage.classList.add('cen-intro-mode');
      if (window.cen3DEngineInstance) window.cen3DEngineInstance.setTargetY(0);
    }
  };

  // ==================== 初始化 ====================
  function init() {
    bindEvents();
    bindFieldEditing();
    bindPhotoUpload();
    init3DEngine();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 暴露
  window.archive = {
    switchTab: switchTab,
    render: render,
    loadData: loadData,
    saveData: saveData
  };

  console.log('[archive] 模块已加载');
})();
