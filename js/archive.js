/**
 * archive.js —— 档案模块（联动版 + 档案页内切换联系人）
 * 页面：#pageArchive
 * 存储：localStorage 'archive_data_v1'
 * 数据：{ me: {...}, contacts: { [contactId]: {...} } }
 *
 * 联动：
 * - Ta 档案的 location / status / mood 从字卡库抽（window.getArchivePick）
 * - Ta 档案的 basicInfo / history / preferences / relations 从内置文案库抽
 * - Ta 档案的 desc 从「回复」词库抽 1~3 条（window.getArchiveDesc）
 * - 1~8 小时周期自动换一批
 * - 保存时只保存「我的档案」
 * - 「我的档案」的 name / photo 与传讯页 my_profile 同步（只读）
 * - 右上角按钮：我的档案 = 保存√；Ta 的档案 = 切换⇄（档案页内切换联系人，不跟随聊天联系人）
 */
(function () {
  'use strict';
  var STORE_KEY = 'archive_data_v1';
  var MY_PROFILE_KEY = 'my_profile';
  var VIEW_KEY  = 'archive_view_contact';   // 档案页当前查看的联系人（独立于聊天当前联系人）
  var currentTab = 'me';   // 'me' | 'ta'

  // ==================== 我的资料（与传讯页同步） ====================
  function loadMyProfile() {
    try {
      var raw = localStorage.getItem(MY_PROFILE_KEY);
      if (raw) {
        var p = JSON.parse(raw);
        if (p && typeof p === 'object') {
          return {
            name: p.name || '我',
            avatar: p.avatar || ''
          };
        }
      }
    } catch (e) {}
    return { name: '我', avatar: '' };
  }

  // ==================== 文案库（内置） ====================
  var ARCHIVE_QUOTES = [
    '唯独心脏是雪花绣的痂靠近你就融化',
    '用你的视角去看世界',
    '幸好我的勇气始终比困难多一点',
    '等你读懂我的时候，明天见',
    '爱的本质是自由意志的沉沦',
    '人的生命更像是季节',
    '我永远会坚定的选择你',
    '自由的风不应该被困在方寸之地',
    '爱从来不是一件简单的事',
    '生命是一万次的春和景明',
    '生命给我多少积雪 我就遇到多少春天',
    '爱是秩序外的一瞬间',
    '跨越无数轮回，我始终会找到你',
    '我的剑永远对准苦难，身后留给你',
    '哪怕银河倾覆，我也会守在你的身旁',
    '不必害怕黑暗，我会做你的星火',
    '万千时空辗转，我的心意从未改变',
    '风会捎来我的念想，告诉你我在想你',
    '我奔赴过宇宙荒原，只为奔赴一个你',
    '只要你回头，我一直都在'
  ];

  // Ta 档案里自动填充的字段
  var AUTO_FIELDS = ['location', 'status', 'mood', 'desc', 'basicInfo', 'history', 'preferences', 'relations'];
  // 自动填充的周期（毫秒）
  var AUTO_CHECK_INTERVAL = 60 * 1000;       // 60 秒检查一次
  var AUTO_CHANGE_MIN_HOURS = 1;             // 最短 1 小时
  var AUTO_CHANGE_MAX_HOURS = 8;             // 最长 8 小时

  // ==================== 字卡库抽取（字卡收纳盒 + 内置文案库） ====================
  // 从分组对象里把所有句子摊平成数组
  function flattenGroups(obj) {
    var all = [];
    if (!obj) return all;
    if (Array.isArray(obj)) {
      obj.forEach(function (x) { if (typeof x === 'string') all.push(x); });
    } else if (typeof obj === 'object') {
      Object.keys(obj).forEach(function (k) {
        var v = obj[k];
        if (Array.isArray(v)) {
          v.forEach(function (x) { if (typeof x === 'string') all.push(x); });
        } else if (typeof v === 'string') {
          all.push(v);
        }
      });
    }
    return all.filter(function (s) { return s && s.trim(); });
  }
  // 随机取一条
  function randomPickFrom(arr) {
    if (!arr || arr.length === 0) return '';
    return arr[Math.floor(Math.random() * arr.length)].trim();
  }
  // 按类型从字卡库抽一条（place / status / mood；栏位为空返回 ''，由渲染层显示"暂无"）
  window.getArchivePick = function (type) {
    var all = [];
    var db = window.cardDatabase || {};
    // 地点分类在字卡库里的键是 location（面板叫 place）
    var keys = [];
    if (type === 'place') keys = ['location', 'place'];
    else if (type) keys = [type];
    keys.forEach(function (k) {
      if (db[k]) all = all.concat(flattenGroups(db[k]));
    });
    // 不兜底：用户没在对应栏位添加内容就返回空，档案显示「暂无」
    return randomPickFrom(all);
  };
  // 从「回复」分组抽 1~3 条作为 desc（只读用户自己的回复栏，空则返回 ''）
  window.getArchiveDesc = function () {
    var all = [];
    var db = window.cardDatabase || {};
    if (db.reply) all = all.concat(flattenGroups(db.reply));
    if (!all.length) return '';
    var n = Math.min(3, all.length);
    var used = {};
    var picked = [];
    for (var i = 0; i < n; i++) {
      var idx, tries = 0;
      do {
        idx = Math.floor(Math.random() * all.length);
        tries++;
      } while (used[idx] && tries < 20);
      used[idx] = true;
      picked.push(all[idx].trim());
    }
    return picked.join(' ');
  };

  // 给 4 个格子抽不重复文案
  function pickUniqueQuotes(n) {
    var pool = ARCHIVE_QUOTES.slice();
    var result = [];
    n = Math.min(n, pool.length);
    for (var i = 0; i < n; i++) {
      var idx = Math.floor(Math.random() * pool.length);
      result.push(pool[idx]);
      pool.splice(idx, 1);
    }
    return result;
  }

  // 给 Ta 档案一次性抽满所有自动字段
  function pickAutoFields() {
    var result = {};
    // 图片旁四个格子（从上往下）：地点 / 心情 / 状态 / 回复
    // location 字段 ← 字卡收纳盒「地点」栏（字卡库键 location，面板叫 place）
    // status 字段   ← 字卡收纳盒「心情」栏（字卡库键 mood）
    // mood 字段     ← 字卡收纳盒「状态」栏（字卡库键 status）
    // desc 字段     ← 字卡收纳盒「回复」栏（reply 词库抽 1~3 条）
    result.location = window.getArchivePick ? window.getArchivePick('place') : '';
    result.status   = window.getArchivePick ? window.getArchivePick('mood') : '';
    result.mood     = window.getArchivePick ? window.getArchivePick('status') : '';
    result.desc     = window.getArchiveDesc ? window.getArchiveDesc() : '';
    // 下方四个格子：文案库（互不相同）
    var quotes = pickUniqueQuotes(4);
    result.basicInfo   = quotes[0] || '';
    result.history     = quotes[1] || '';
    result.preferences = quotes[2] || '';
    result.relations   = quotes[3] || '';
    return result;
  }

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

  // ==================== 当前查看的联系人（独立于聊天当前联系人） ====================
  function getCurrentContact() {
    try {
      var contacts = JSON.parse(localStorage.getItem('my_contacts') || '[]');
      var id = localStorage.getItem(VIEW_KEY);
      if (Array.isArray(contacts) && contacts.length > 0) {
        return contacts.find(function (c) { return c.id === id; }) || contacts[0];
      }
    } catch (e) {}
    return null;
  }

  // ==================== 字段定义 ====================
  var FIELDS = ['location', 'status', 'mood', 'desc', 'basicInfo', 'history', 'preferences', 'relations'];
  var PLACEHOLDERS = {
    location: '输入地点',
    status: '输入状态',
    mood: '输入心情',
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
      if (currentTab === 'me') {
        // 我的档案：优先读 my_profile.avatar
        var myProfile = loadMyProfile();
        var url = myProfile.avatar || '';
        if (!url) {
          // 回退：主页头像
          var myAvatar = document.getElementById('avatarImg');
          try {
            var raw = localStorage.getItem('home_custom_images');
            if (raw) {
              var hd = JSON.parse(raw);
              if (hd && hd.avatar) url = hd.avatar;
            }
          } catch (e) {}
          if (!url && myAvatar && myAvatar.src) url = myAvatar.src;
        }
        photoEl.style.backgroundImage = url ? 'url(' + url + ')' : '';
      } else if (c && c.avatar) {
        // Ta 档案头像：跟随「添加联系人」里设置的头像（切联系人即变）
        photoEl.style.backgroundImage = 'url(' + c.avatar + ')';
      } else if (entry.photo) {
        photoEl.style.backgroundImage = 'url(' + entry.photo + ')';
      } else {
        var taAvatar = document.getElementById('chatAvatar');
        if (taAvatar && taAvatar.src) photoEl.style.backgroundImage = 'url(' + taAvatar.src + ')';
        else photoEl.style.backgroundImage = '';
      }
    }

    // 名字
    if (nameEl) {
      if (currentTab === 'me') {
        // 我的档案：优先读 my_profile.name
        var myProfile2 = loadMyProfile();
        nameEl.textContent = myProfile2.name || '我';
      } else if (entry.name) {
        nameEl.textContent = entry.name;
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
      // Ta 档案的自动字段：从 entry._auto 读
      if (currentTab === 'ta' && AUTO_FIELDS.indexOf(f) >= 0) {
        var autoVal = (entry._auto && entry._auto[f]) || '';
        if (autoVal) {
          el.textContent = autoVal;
          el.removeAttribute('data-empty');
        } else {
          el.textContent = '（暂无）';
          el.setAttribute('data-empty', '1');
        }
        return;
      }
      // 其他情况：照旧
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
    // Ta 档案不保存（内容全部来自自动抽取）
    if (currentTab === 'ta') return true;
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
    // 我的档案的 name 由 my_profile 控制，不写回 entry
    // （photo 本来就不在 FIELDS / collectFields 里，无需处理）
    saveData(data);
    return true;
  }

  // ==================== 照片上传 ====================
  // 我的档案的照片由 my_profile 控制，不上传；
  // 这里只处理 Ta 档案的照片上传
  function bindPhotoUpload() {
    var photoEl = document.getElementById('cen_main_photo');
    var input = document.getElementById('arcPhotoInput');
    if (!photoEl || !input) return;
    var pressTimer = null;
    function startPress() {
      // 我的档案不允许上传照片
      if (currentTab === 'me') return;
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

    // 切 tab 时，如果是 Ta 档案，先跑一次自动抽取
    if (tab === 'ta') runAutoPick(false);

    // 动态设置只读
    var isTa = tab === 'ta';
    document.querySelectorAll('.arc-field, .arc-field-block').forEach(function (el) {
      var f = el.getAttribute('data-field');
      if (isTa && AUTO_FIELDS.indexOf(f) >= 0) {
        el.setAttribute('contenteditable', 'false');
        el.classList.add('arc-field-auto');
      } else {
        el.setAttribute('contenteditable', 'true');
        el.classList.remove('arc-field-auto');
      }
    });

    // 右上角按钮跟随 Tab：我的档案=保存√；Ta 的档案=切换⇄
    var saveBtn = document.getElementById('arcSaveBtn');
    if (saveBtn) {
      var icon = saveBtn.querySelector('i');
      if (tab === 'me') {
        if (icon) icon.className = 'fa-solid fa-check';
        saveBtn.title = '保存';
      } else {
        if (icon) icon.className = 'fa-solid fa-arrow-right-arrow-left';
        saveBtn.title = '切换联系人';
      }
    }

    // 切 tab 也重播动画
    resetAnimState();
    render();
  }

  // ==================== 切换联系人弹层 ====================
  function openContactSwitcher() {
    var old = document.getElementById('arcContactSwitcher');
    if (old && old.parentNode) old.parentNode.removeChild(old);

    var contacts = [];
    try {
      contacts = JSON.parse(localStorage.getItem('my_contacts') || '[]');
    } catch (e) {}
    if (!Array.isArray(contacts)) contacts = [];
    if (contacts.length === 0) return;

    var cur = getCurrentContact();
    var curId = cur ? cur.id : null;

    var listHtml = '';
    contacts.forEach(function (c) {
      var isCurrent = c.id === curId;
      listHtml +=
        '<div class="arc-sw-item' + (isCurrent ? ' current' : '') + '" data-id="' + c.id + '">' +
        '<img class="arc-sw-avatar" src="' + (c.avatar || 'https://picsum.photos/100/100?random=1') + '" alt="">' +
        '<span class="arc-sw-name">' + (c.name || 'Ta') + '</span>' +
        (isCurrent ? '<span class="arc-sw-check"><i class="fa-solid fa-check"></i></span>' : '') +
        '</div>';
    });

    var modal = document.createElement('div');
    modal.id = 'arcContactSwitcher';
    modal.className = 'arc-sw-modal';
    modal.innerHTML =
      '<div class="arc-sw-panel">' +
        '<div class="arc-sw-title">切换联系人</div>' +
        '<div class="arc-sw-list">' + listHtml + '</div>' +
        '<button class="arc-sw-cancel">取消</button>' +
      '</div>';
    document.body.appendChild(modal);
    requestAnimationFrame(function () { modal.classList.add('active'); });

    modal.querySelectorAll('.arc-sw-item').forEach(function (item) {
      item.addEventListener('click', function () {
        var id = item.getAttribute('data-id');
        switchContactView(id);
      });
    });
    var cancelBtn = modal.querySelector('.arc-sw-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', closeContactSwitcher);
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeContactSwitcher();
    });
  }

  function closeContactSwitcher() {
    var modal = document.getElementById('arcContactSwitcher');
    if (modal) {
      modal.classList.remove('active');
      setTimeout(function () {
        if (modal.parentNode) modal.parentNode.removeChild(modal);
      }, 250);
    }
  }

  function switchContactView(id) {
    if (!id) return;
    try { localStorage.setItem(VIEW_KEY, id); } catch (e) {}
    closeContactSwitcher();
    // 切到该联系人的档案（Ta 的档案），switchTab 内部会跑自动抽取 + 重渲染
    switchTab('ta');
  }

  // ==================== 字段编辑事件 ====================
  function bindFieldEditing() {
    document.querySelectorAll('.arc-field, .arc-field-block').forEach(function (el) {
      el.addEventListener('focus', function () {
        if (el.getAttribute('contenteditable') === 'false') return;
        if (el.getAttribute('data-empty') === '1') {
          el.textContent = '';
          el.removeAttribute('data-empty');
        }
      });
      el.addEventListener('blur', function () {
        if (el.getAttribute('contenteditable') === 'false') return;
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
        resetAnimState();
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

    // 右上角按钮：我的档案=保存√；Ta 的档案=切换⇄（按当前 Tab 判断行为）
    var saveBtn = document.getElementById('arcSaveBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        collectFields();
        if (currentTab === 'ta') {
          openContactSwitcher();
        } else {
          alert('已保存');
        }
      });
    }

    // Tab 切换
    var tabMe = document.getElementById('arcTabMe');
    var tabTa = document.getElementById('arcTabTa');
    if (tabMe) tabMe.addEventListener('click', function () { switchTab('me'); });
    if (tabTa) tabTa.addEventListener('click', function () { switchTab('ta'); });

    // 档案页查看联系人独立于聊天：不再跟随 my_current_contact / contactChanged
    // 只保留 my_profile 变化 → 我的档案刷新
    window.addEventListener('storage', function (e) {
      if (e.key === MY_PROFILE_KEY && currentTab === 'me') {
        render();
      }
    });
    // 同标签页内，role-panel 保存后主动通知
    window.addEventListener('myProfileChanged', function () {
      if (currentTab === 'me') render();
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

  // ==================== 重置动画状态（每次进页面重播） ====================
  function resetAnimState() {
    var stage = document.getElementById('cenConfig_stage');
    if (stage) {
      stage.classList.remove('cen-play-mode');
      stage.classList.add('cen-intro-mode');
    }
    if (window.cen3DEngineInstance && typeof window.cen3DEngineInstance.setTargetY === 'function') {
      window.cen3DEngineInstance.setTargetY(0);
    }
    var bubble = document.getElementById('cen_speech_bubble');
    if (bubble) {
      bubble.style.opacity = '0';
      bubble.style.filter = 'blur(8px)';
      bubble.style.transform = 'translate(-50%, 10px) translateZ(50px)';
    }
    document.querySelectorAll('#cen_bottom_panels details[open]').forEach(function (d) {
      d.removeAttribute('open');
    });
    if (document.activeElement && document.activeElement.blur) {
      try { document.activeElement.blur(); } catch (e) {}
    }
  }

  // ==================== Ta 档案 · 自动抽取 ====================
  var autoTimer = null;
  function runAutoPick(force) {
    var c = getCurrentContact();
    if (!c) return;                       // 没联系人，跳过
    var data = loadData();
    if (!data.contacts[c.id]) data.contacts[c.id] = {};
    var entry = data.contacts[c.id];
    var now = Date.now();
    var meta = entry._autoStatus || {};
    var due = false;
    if (!meta.lastChange || !meta.nextInterval) {
      due = true;                          // 从没抽过
    } else {
      var elapsed = now - meta.lastChange;
      if (elapsed >= meta.nextInterval * 3600 * 1000) due = true;
    }
    if (force) due = true;
    if (!due) return;
    // 抽新的
    var picked = pickAutoFields();
    if (!entry._auto) entry._auto = {};
    Object.keys(picked).forEach(function (k) {
      if (picked[k]) entry._auto[k] = picked[k];
    });
    // 记时间
    entry._autoStatus = {
      lastChange: now,
      nextInterval: AUTO_CHANGE_MIN_HOURS +
        Math.random() * (AUTO_CHANGE_MAX_HOURS - AUTO_CHANGE_MIN_HOURS)
    };
    saveData(data);
    // 如果当前正在看 Ta 档案，立即重渲染
    if (currentTab === 'ta') render();
  }

  function startAutoTimer() {
    if (autoTimer) return;
    // 启动时先跑一次（若从没抽过就会抽）
    runAutoPick(false);
    autoTimer = setInterval(function () {
      runAutoPick(false);
    }, AUTO_CHECK_INTERVAL);
  }

  // ==================== 初始化 ====================
  function init() {
    // 首次进入：默认查看第一个联系人（不跟随聊天当前联系人，与点击联系人解耦）
    try {
      if (!localStorage.getItem(VIEW_KEY)) {
        var contacts = JSON.parse(localStorage.getItem('my_contacts') || '[]');
        localStorage.setItem(VIEW_KEY, Array.isArray(contacts) && contacts.length ? contacts[0].id : '');
      }
    } catch (e) {}
    bindEvents();
    bindFieldEditing();
    bindPhotoUpload();
    init3DEngine();
    startAutoTimer();
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
    saveData: saveData,
    runAutoPick: runAutoPick,
    loadMyProfile: loadMyProfile,          // 方便调试
    openContactSwitcher: openContactSwitcher,
    switchContactView: switchContactView
  };
  console.log('[archive] 模块已加载');
})();
