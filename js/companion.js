/**
 * 陪伴模式 + 陪伴中 页面逻辑（独立模块）
 * - 依赖：无（只读取 localStorage 与 window 上的全局变量）
 * - 在 DOMContentLoaded 之后执行
 */

(function () {
  'use strict';

  // ==================== 元素引用 ====================
  var pageCompanion = document.getElementById('pageCompanion');
  var pageActive = document.getElementById('pageCompanionActive');
  var btnCompanion = document.getElementById('btnCompanion');

  if (!pageCompanion) return;

  // ==================== 状态 ====================
  var companionContactId = null;
  var timerId = null;
  var startTime = 0;
  var TARGET_DURATION_SEC = 60 * 60;
  var lastProgress = -1;

  // ==================== 预设背景 ====================
  var COMPANION_BG_PRESETS = {
    aurora:   'linear-gradient(160deg, #e8f0fb 0%, #e0d4fc 100%)',
    deepsea:  'linear-gradient(160deg, #c8dff4 0%, #a4c4e0 100%)',
    sunset:   'linear-gradient(160deg, #fce4d8 0%, #fcd4e0 100%)',
    forest:   'linear-gradient(160deg, #d8ecd8 0%, #c0e0cc 100%)',
    night:    'linear-gradient(160deg, #ccd4e0 0%, #a8b0c4 100%)',
    rose:     'linear-gradient(160deg, #fcd8e0 0%, #f8c0d0 100%)'
  };

  // ==================== 联系人读取 ====================
  function loadContacts() {
    try {
      var raw = localStorage.getItem('my_contacts');
      if (!raw) return [];
      var data = JSON.parse(raw);
      if (!Array.isArray(data)) return [];
      return data;
    } catch (e) { return []; }
  }

  function getDefaultCompanionContact() {
    var contacts = loadContacts();
    if (contacts.length === 0) return null;

    if (companionContactId) {
      var found = contacts.find(function (c) { return c.id === companionContactId; });
      if (found) return found;
    }

    try {
      var currentId = localStorage.getItem('my_current_contact');
      if (currentId) {
        var cur = contacts.find(function (c) { return c.id === currentId; });
        if (cur) return cur;
      }
    } catch (e) {}

    return contacts[0];
  }

  function updatePartnerCard(contact) {
    var avatarEl = document.getElementById('companionPartnerAvatar');
    var nameEl = document.getElementById('companionPartnerName');
    if (!avatarEl || !nameEl) return;

    if (!contact) {
      avatarEl.innerHTML = 'TA';
      nameEl.textContent = '未命名';
      window.chatCompanionPartner = null;
      return;
    }

    if (contact.avatar) {
      avatarEl.innerHTML = '<img src="' + contact.avatar + '" alt="">';
    } else {
      avatarEl.textContent = (contact.name || 'TA').slice(0, 1).toUpperCase();
    }
    nameEl.textContent = contact.name || '未命名';
    window.chatCompanionPartner = contact;
  }

  function initCompanionPartner() {
    var contact = getDefaultCompanionContact();
    updatePartnerCard(contact);
  }

  window.addEventListener('storage', function (e) {
    if (e.key === 'my_contacts' || e.key === 'my_current_contact') {
      if (!companionContactId) {
        initCompanionPartner();
      }
    }
  });

  function refreshCompanionPartner() {
    var contact = getDefaultCompanionContact();
    updatePartnerCard(contact);
    if (typeof checkStartBtnState === 'function') {
      checkStartBtnState();
    }
  }

  // ==================== 页面切换 ====================
  function showCompanion() {
    document.querySelectorAll('.page').forEach(function (p) {
      p.classList.remove('active');
    });
    pageCompanion.classList.add('active');
    window.scrollTo(0, 0);
  }

  function goHome() {
    document.querySelectorAll('.page').forEach(function (p) {
      p.classList.remove('active');
    });
    var home = document.getElementById('pageHome');
    if (home) home.classList.add('active');
  }

  // ==================== 绑定主页"陪伴"按钮 ====================
  if (btnCompanion) {
    btnCompanion.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      showCompanion();
      setTimeout(function () { refreshCompanionPartner(); }, 50);
    });
  }

  // ==================== 返回按钮 ====================
  var backBtn = document.getElementById('companionBackBtn');
  if (backBtn) {
    backBtn.addEventListener('click', function () {
      goHome();
    });
  }

  // ==================== 选择音乐 ====================
  var pickMusicBtn = document.getElementById('companionPickMusicBtn');
  var nowPlayingBar = document.getElementById('companionNowPlaying');
  var nowPlayingName = document.getElementById('companionNowPlayingName');

  if (pickMusicBtn) {
    pickMusicBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();

      if (!window.playlist || !Array.isArray(window.playlist)) {
        console.warn('[陪伴] 主页播放器 playlist 未就绪');
      }

      if (typeof window.openPlaylistSheet === 'function') {
        window.openPlaylistSheet();
      } else {
        var vinylCover = document.getElementById('vinylCover');
        if (vinylCover) {
          vinylCover.click();
        } else {
          alert('播放器未就绪，请先回到主页加载一次');
          return;
        }
      }

      if (pageCompanion) pageCompanion.classList.add('has-player');
      startWatchingNowPlaying();
    });
  }

  var watchTimer = null;
  var lastSongTitle = '';

  function startWatchingNowPlaying() {
    if (watchTimer) return;
    watchTimer = setInterval(function () {
      var songTitle = document.getElementById('songTitle');
      if (!songTitle) return;
      var title = songTitle.textContent || '';
      if (title && title !== lastSongTitle) {
        lastSongTitle = title;
        if (nowPlayingName) nowPlayingName.textContent = title;
        if (nowPlayingBar) nowPlayingBar.style.display = 'block';
      }
    }, 500);
  }

  // ==================== 场景选中 ====================
  var sceneBtns = document.querySelectorAll('.companion-scene-btn');
  sceneBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      sceneBtns.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      window.chatCompanionScene = btn.getAttribute('data-scene');
      if (typeof checkStartBtnState === 'function') checkStartBtnState();
    });
  });

  // ==================== 背景色块选中 ====================
  var bgBlocks = document.querySelectorAll('.companion-bg-block');
  bgBlocks.forEach(function (block) {
    block.addEventListener('click', function () {
      bgBlocks.forEach(function (b) { b.classList.remove('active'); });
      block.classList.add('active');
      window.chatCompanionBg = block.getAttribute('data-bg');
      window.chatCompanionBgType = 'preset';
      window.chatCompanionBgCustomImage = null;
    });
  });

  // ==================== 自定义背景图片 ====================
  var bgCustomBtn = document.getElementById('companionBgCustomBtn');
  if (bgCustomBtn) {
    bgCustomBtn.addEventListener('click', function () {
      var choice = confirm('点击"确定"粘贴图片 URL，点击"取消"上传本地文件');
      if (choice) {
        var url = prompt('请输入图片 URL：');
        if (!url) return;
        applyCustomImageToCompanion(url);
      } else {
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.style.display = 'none';
        document.body.appendChild(input);
        input.addEventListener('change', function () {
          var file = input.files && input.files[0];
          if (!file) { document.body.removeChild(input); return; }
          var reader = new FileReader();
          reader.onload = function (ev) {
            applyCustomImageToCompanion(ev.target.result);
            document.body.removeChild(input);
          };
          reader.readAsDataURL(file);
        });
        input.click();
      }
    });
  }

  function applyCustomImageToCompanion(url) {
    pageCompanion.style.backgroundImage = "url('" + url + "')";
    pageCompanion.style.backgroundSize = 'cover';
    pageCompanion.style.backgroundPosition = 'center';
    pageCompanion.style.backgroundRepeat = 'no-repeat';

    window.chatCompanionBgType = 'custom';
    window.chatCompanionBgCustomImage = url;
    window.chatCompanionBg = 'custom';
    bgBlocks.forEach(function (b) { b.classList.remove('active'); });
  }

  // ==================== 陪伴对象选择器 ====================
  var partnerCard = document.getElementById('companionPartnerCard');
  var partnerModal = document.getElementById('companionPartnerModal');

  function ensurePartnerModal() {
    if (partnerModal) return partnerModal;
    partnerModal = document.createElement('div');
    partnerModal.id = 'companionPartnerModal';
    partnerModal.className = 'companion-partner-modal';
    partnerModal.innerHTML =
      '<div class="companion-partner-modal-panel">' +
      '  <div class="companion-partner-modal-title">选择陪伴对象</div>' +
      '  <div class="companion-partner-list" id="companionPartnerList"></div>' +
      '  <button class="companion-partner-modal-cancel" id="companionPartnerCancel">取消</button>' +
      '</div>';
    document.body.appendChild(partnerModal);

    document.getElementById('companionPartnerCancel').addEventListener('click', function () {
      partnerModal.classList.remove('active');
    });
    partnerModal.addEventListener('click', function (e) {
      if (e.target === partnerModal) partnerModal.classList.remove('active');
    });
    return partnerModal;
  }

  function renderPartnerList() {
    var list = document.getElementById('companionPartnerList');
    if (!list) return;
    list.innerHTML = '';

    var contacts = loadContacts();

    if (contacts.length === 0) {
      list.innerHTML = '<div style="text-align:center;padding:24px;color:#a8b4c0;font-size:13px;">还没有联系人，先去传讯页面添加吧~</div>';
      return;
    }

    contacts.forEach(function (c) {
      var item = document.createElement('div');
      item.className = 'companion-partner-item';

      var isActive = (companionContactId === c.id) ||
                     (!companionContactId && window.chatCompanionPartner && window.chatCompanionPartner.id === c.id);
      if (isActive) {
        item.style.background = '#fcdce6';
        item.style.borderColor = '#f8b4c8';
      }

      item.innerHTML =
        '<div class="companion-partner-item-avatar">' +
        (c.avatar ? '<img src="' + c.avatar + '" alt="">' : (c.name || 'TA').slice(0, 1)) +
        '</div>' +
        '<div class="companion-partner-item-name">' + (c.name || '未命名') + '</div>';

      item.addEventListener('click', function () {
        companionContactId = c.id;
        updatePartnerCard(c);
        partnerModal.classList.remove('active');
        if (typeof checkStartBtnState === 'function') checkStartBtnState();
      });

      list.appendChild(item);
    });
  }

  if (partnerCard) {
    partnerCard.addEventListener('click', function () {
      ensurePartnerModal();
      renderPartnerList();
      partnerModal.classList.add('active');
    });
  }

  // ==================== 开始陪伴按钮状态 ====================
  function checkStartBtnState() {
    var startBtn = document.getElementById('companionStartBtn');
    if (!startBtn) return;

    var hasPartner = !!(window.chatCompanionPartner && window.chatCompanionPartner.id);
    var hasScene = !!window.chatCompanionScene;

    if (hasPartner && hasScene) {
      startBtn.classList.remove('disabled');
      startBtn.classList.add('active');
    } else {
      startBtn.classList.add('disabled');
      startBtn.classList.remove('active');
    }
  }

  // ==================== 开始陪伴 ====================
  var startBtn = document.getElementById('companionStartBtn');
  if (startBtn) {
    startBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();

      var hasPartner = !!(window.chatCompanionPartner && window.chatCompanionPartner.id);
      var hasScene = !!window.chatCompanionScene;

      if (!hasPartner && !hasScene) { alert('请先选择陪伴对象和场景'); return; }
      if (!hasPartner) { alert('请先选择陪伴对象'); return; }
      if (!hasScene) { alert('请先选择陪伴场景'); return; }

      applyBackgroundToActivePage();

      if (window.pageCompanionActive && typeof window.pageCompanionActive.show === 'function') {
        window.pageCompanionActive.show();
        return;
      }

      if (pageActive) {
        document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active'); });
        pageActive.classList.add('active');
        window.scrollTo(0, 0);
      }
    });
  }

  function applyBackgroundToActivePage() {
    if (!pageActive) return;

    if (window.chatCompanionBgType === 'custom' && window.chatCompanionBgCustomImage) {
      pageActive.style.backgroundImage = "url('" + window.chatCompanionBgCustomImage + "')";
      pageActive.style.backgroundSize = 'cover';
      pageActive.style.backgroundPosition = 'center';
      pageActive.style.backgroundRepeat = 'no-repeat';
      pageActive.style.background = '';
      return;
    }

    var bgKey = window.chatCompanionBg || 'aurora';
    if (COMPANION_BG_PRESETS[bgKey]) {
      pageActive.style.backgroundImage = '';
      pageActive.style.background = COMPANION_BG_PRESETS[bgKey];
      return;
    }

    pageActive.style.background = COMPANION_BG_PRESETS.aurora;
  }

  // ==================== 陪伴中 页面逻辑 ====================
  var dateEl = document.getElementById('cpaDate');
  var timerValueEl = document.getElementById('cpaTimerValue');
  var cpaBackBtn = document.getElementById('cpaBackBtn');
  var cpaEndBtn = document.getElementById('cpaEndBtn');
  var cpaMusicPill = document.getElementById('cpaMusicPill');
  var cpaAvatar = document.getElementById('cpaAvatar');
  var cpaStatusTitle = document.getElementById('cpaStatusTitle');

  function updateDate() {
    if (!dateEl) return;
    var d = new Date();
    var y = d.getFullYear();
    var m = d.getMonth() + 1;
    var day = d.getDate();
    dateEl.textContent = y + '.' + (m < 10 ? '0' + m : m) + '.' + (day < 10 ? '0' + day : day);
  }

  function formatDuration(sec) {
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = sec % 60;
    return h + '小时' + m + '分钟' + s + '秒';
  }

  function updateTimer() {
    var now = Date.now();
    var elapsed = Math.floor((now - startTime) / 1000);
    if (timerValueEl) timerValueEl.textContent = formatDuration(elapsed);
    updateFocusProgress(elapsed);
  }

  function updateFocusProgress(elapsedSec) {
    var fill = document.querySelector('#pageCompanionActive .cpa-focus-fill');
    if (!fill) return;

    var percent = Math.min(100, (elapsedSec / TARGET_DURATION_SEC) * 100);
    var rounded = Math.round(percent * 10) / 10;
    if (rounded === lastProgress) return;
    lastProgress = rounded;

    fill.style.width = percent + '%';

    if (percent >= 100) {
      fill.classList.add('completed');
      var labels = document.querySelectorAll('#pageCompanionActive .cpa-focus-labels span');
      if (labels && labels.length >= 2) labels[1].classList.add('focus-completed');
    } else {
      fill.classList.remove('completed');
      var labels2 = document.querySelectorAll('#pageCompanionActive .cpa-focus-labels span');
      if (labels2 && labels2.length >= 2) labels2[1].classList.remove('focus-completed');
    }
  }

  function resetFocusProgress() {
    var fill = document.querySelector('#pageCompanionActive .cpa-focus-fill');
    if (!fill) return;
    fill.style.width = '0%';
    fill.classList.remove('completed');
    lastProgress = -1;
    var labels = document.querySelectorAll('#pageCompanionActive .cpa-focus-labels span');
    if (labels && labels.length >= 2) labels[1].classList.remove('focus-completed');
  }

  function startTimer() {
    stopTimer();
    startTime = Date.now();
    resetFocusProgress();
    updateTimer();
    timerId = setInterval(updateTimer, 1000);
  }

  function stopTimer() {
    if (timerId) { clearInterval(timerId); timerId = null; }
  }

  function updateAvatarAndStatus() {
    var partner = window.chatCompanionPartner || null;
    var scene = window.chatCompanionScene || 'study';
    var sceneMap = { study: '学习', work: '工作', rest: '休息', sport: '运动' };
    var sceneText = sceneMap[scene] || '学习';

    var partnerName = 'TA';
    var partnerAvatar = '';
    if (partner && partner.name) {
      partnerName = partner.name;
      partnerAvatar = partner.avatar || '';
    }

    if (cpaAvatar) {
      if (partnerAvatar) {
        cpaAvatar.innerHTML = '<img src="' + partnerAvatar + '" alt="">';
      } else {
        cpaAvatar.textContent = partnerName.slice(0, 2);
      }
    }

    if (cpaStatusTitle) {
      cpaStatusTitle.textContent = partnerName + ' 和你一起' + sceneText;
    }
  }

  function showActivePage() {
    if (!pageActive) return;
    document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active'); });
    pageActive.classList.add('active');
    window.scrollTo(0, 0);
    updateDate();
    updateAvatarAndStatus();
    startTimer();
  }

  function showCompanionPage() {
    document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active'); });
    if (pageCompanion) {
      pageCompanion.classList.add('active');
      window.scrollTo(0, 0);
    }
    stopTimer();
  }

  if (cpaBackBtn) {
    cpaBackBtn.addEventListener('click', function () {
      stopTimer();
      resetFocusProgress();
      showCompanionPage();
    });
  }

  if (cpaEndBtn) {
    cpaEndBtn.addEventListener('click', function () {
      stopTimer();
      resetFocusProgress();
      if (pageActive) {
        pageActive.style.background = '';
        pageActive.style.backgroundImage = '';
        pageActive.style.backgroundSize = '';
        pageActive.style.backgroundPosition = '';
        pageActive.style.backgroundRepeat = '';
        pageActive.style.backgroundColor = '';
        pageActive.classList.remove('has-mask');
        pageActive.classList.remove('no-mask');
      }
      showCompanionPage();
    });
  }

  if (cpaMusicPill) {
    cpaMusicPill.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof window.openPlaylistSheet === 'function') {
        window.openPlaylistSheet();
      } else {
        var vinylCover = document.getElementById('vinylCover');
        if (vinylCover) vinylCover.click();
      }
    });
  }

  // 监听当前歌曲，更新 cpaMusicPill 文字
  var lastCpaSongTitle = '';
  setInterval(function () {
    var songTitleEl = document.getElementById('songTitle');
    if (!songTitleEl || !cpaMusicPill || !pageActive) return;
    var title = songTitleEl.textContent || '';
    if (title && title !== lastCpaSongTitle) {
      lastCpaSongTitle = title;
      if (pageActive.classList.contains('active')) {
        cpaMusicPill.textContent = '🎵 正在播放：' + title;
      }
    }
  }, 500);

  // ==================== 初始化 ====================
  initCompanionPartner();
  updateDate();
  checkStartBtnState();

  // 暴露给外部
  window.refreshCompanionPartner = refreshCompanionPartner;
  window.pageCompanionActive = {
    show: showActivePage,
    back: showCompanionPage
  };

})();
