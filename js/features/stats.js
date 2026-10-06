/**
 * 词云（消息统计 & 收藏）页面
 * - 数据源：sessionChat.getMessagesOf(选中的联系人)（不再读 DOM）
 * - 4 个 tab：统计 / 搜索 / 收藏 / 词云
 * - 独立页面 #pageStats
 * 本次改动：
 * - 数据源从 DOM 改为存储（sessionChat）
 * - 顶部加"切换联系人"按钮，私有键 stats_view_contact
 * - 收藏从存储读、取消收藏写存储
 */

(function () {
  'use strict';

  var pageStats = document.getElementById('pageStats');
  if (!pageStats) {
    console.warn('[stats] 找不到 #pageStats');
    return;
  }

  var LS_CONTACTS_KEY = 'my_contacts';
  var STATS_VIEW_KEY  = 'stats_view_contact';

  // ==================== 工具 ====================
  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  function formatDate(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    function pad(n) { return n < 10 ? '0' + n : '' + n; }
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  // ==================== 联系人 ====================
  function loadContacts() {
    try {
      var arr = JSON.parse(localStorage.getItem(LS_CONTACTS_KEY) || '[]');
      if (Array.isArray(arr) && arr.length > 0) return arr;
    } catch (e) {}
    return [];
  }

  function getCurrentViewContactId() {
    var contacts = loadContacts();
    var id = null;
    try { id = localStorage.getItem(STATS_VIEW_KEY); } catch (e) {}
    if (id && contacts.some(function (c) { return c.id === id; })) return id;
    return contacts[0] ? contacts[0].id : null;
  }

  function getContactInfo(id) {
    if (!id) return null;
    var contacts = loadContacts();
    return contacts.find(function (c) { return c.id === id; }) || null;
  }

  function updateSwitchLabel() {
    var el = document.getElementById('statsSwitchLabel');
    if (!el) return;
    var c = getContactInfo(getCurrentViewContactId());
    el.textContent = c ? (c.name || 'Ta') : '—';
  }

  // ==================== 从存储读消息 ====================
  // 返回统一结构：{ sender, type, time, favorited, text, imageUrl, msgId }
  function readMessagesOfContact(contactId) {
    if (!contactId) return [];
    if (!window.sessionChat || typeof window.sessionChat.getMessagesOf !== 'function') return [];
    var raw = [];
    try { raw = window.sessionChat.getMessagesOf(contactId) || []; } catch (e) { return []; }

    var result = [];
    raw.forEach(function (m) {
      if (!m) return;
      // 过滤系统行（拍一拍 / 通话记录）
      if (m.kind === 'pat' || m.kind === 'call') return;

      var sender = (m.type === 'self') ? 'me' : 'partner';
      var type = m.kind || 'text';
      var text = '';
      var imageUrl = '';

      if (type === 'image') {
        imageUrl = m.url || '';
      } else if (type === 'quote') {
        text = (m.quote ? ('> ' + m.quote + ' ') : '') + (m.text || '');
      } else {
        text = m.text || '';
      }

      if (!text && !imageUrl) return;

      result.push({
        sender: sender,
        type: type,
        time: m.t || 0,
        favorited: !!m.fav,
        text: text,
        imageUrl: imageUrl,
        msgId: m.msgId || ''
      });
    });

    return result;
  }

  function readAllMessages() {
    return readMessagesOfContact(getCurrentViewContactId());
  }

  // ==================== 名字/头像 ====================
  function getMyName() {
    try {
      var raw = localStorage.getItem('my_profile');
      if (raw) {
        var p = JSON.parse(raw);
        if (p && p.name) return p.name;
      }
    } catch (e) {}
    var el = document.getElementById('myNickname');
    if (el && el.textContent.trim()) return el.textContent.trim();
    return '我';
  }

  function getPartnerName() {
    var c = getContactInfo(getCurrentViewContactId());
    return c ? (c.name || 'Ta') : 'Ta';
  }

  function getMyAvatar() {
    try {
      var raw = localStorage.getItem('my_profile');
      if (raw) {
        var p = JSON.parse(raw);
        if (p && p.avatar) return p.avatar;
      }
    } catch (e) {}
    var el = document.getElementById('avatarImg');
    if (el && el.src) return el.src;
    return 'https://picsum.photos/100/100?random=1';
  }

  function getPartnerAvatar() {
    var c = getContactInfo(getCurrentViewContactId());
    if (c && c.avatar) return c.avatar;
    return 'https://picsum.photos/200/200?random=99';
  }

  // ==================== 切换联系人弹层 ====================
  function openContactSwitcher() {
    var old = document.getElementById('statsContactSwitcher');
    if (old && old.parentNode) old.parentNode.removeChild(old);

    var contacts = loadContacts();
    if (contacts.length === 0) {
      alert('还没有联系人');
      return;
    }
    var curId = getCurrentViewContactId();

    var listHtml = '';
    contacts.forEach(function (c) {
      var isCurrent = c.id === curId;
      listHtml +=
        '<div class="stats-sw-item' + (isCurrent ? ' current' : '') + '" data-id="' + escapeHtml(c.id) + '">' +
        '<img class="stats-sw-avatar" src="' + escapeHtml(c.avatar || 'https://picsum.photos/100/100?random=1') + '" alt="">' +
        '<span class="stats-sw-name">' + escapeHtml(c.name || 'Ta') + '</span>' +
        (isCurrent ? '<span class="stats-sw-check"><i class="fa-solid fa-check"></i></span>' : '') +
        '</div>';
    });

    var modal = document.createElement('div');
    modal.id = 'statsContactSwitcher';
    modal.className = 'stats-sw-modal';
    modal.innerHTML =
      '<div class="stats-sw-panel">' +
        '<div class="stats-sw-title">选择联系人</div>' +
        '<div class="stats-sw-list">' + listHtml + '</div>' +
        '<button class="stats-sw-cancel">取消</button>' +
      '</div>';
    document.body.appendChild(modal);
    requestAnimationFrame(function () { modal.classList.add('active'); });

    modal.querySelectorAll('.stats-sw-item').forEach(function (item) {
      item.addEventListener('click', function () {
        var id = item.getAttribute('data-id');
        switchViewContact(id);
      });
    });
    var cancelBtn = modal.querySelector('.stats-sw-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', closeContactSwitcher);
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeContactSwitcher();
    });
  }

  function closeContactSwitcher() {
    var modal = document.getElementById('statsContactSwitcher');
    if (modal) {
      modal.classList.remove('active');
      setTimeout(function () {
        if (modal.parentNode) modal.parentNode.removeChild(modal);
      }, 250);
    }
  }

  function switchViewContact(id) {
    if (!id) return;
    try { localStorage.setItem(STATS_VIEW_KEY, id); } catch (e) {}
    closeContactSwitcher();
    updateSwitchLabel();
    // 重渲染当前激活的 tab
    var activeTab = pageStats.querySelector('.stats-tab.active');
    if (activeTab) {
      var name = activeTab.getAttribute('data-tab');
      if (name === 'overview') renderOverview();
      else if (name === 'favorites') renderFavorites();
      else if (name === 'wordcloud') renderWordCloud();
      else if (name === 'search') {
        // 搜索不自动跑，清空结果
        var box = document.getElementById('statsSearchResults');
        if (box) box.innerHTML = '';
      }
    }
  }

  // ==================== Tab 切换 ====================
  var tabs = pageStats.querySelectorAll('.stats-tab');
  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      var name = tab.getAttribute('data-tab');
      tabs.forEach(function (t) { t.classList.toggle('active', t === tab); });
      pageStats.querySelectorAll('.stats-view').forEach(function (v) {
        v.classList.remove('active');
      });
      var VIEW_ID_MAP = {
        overview: 'statsViewOverview',
        search: 'statsViewSearch',
        favorites: 'statsViewFavorites',
        wordcloud: 'statsViewWordCloud'
      };
      var view = document.getElementById(VIEW_ID_MAP[name] || ('statsView' + name));
      if (view) view.classList.add('active');

      if (name === 'overview') renderOverview();
      if (name === 'favorites') renderFavorites();
      if (name === 'wordcloud') renderWordCloud();
    });
  });

  // ==================== Tab 1：统计 ====================
  var currentRankView = 'partner';

  function renderOverview() {
    var msgs = readAllMessages();
    var myMsgs = msgs.filter(function (m) { return m.sender === 'me'; });
    var partnerMsgs = msgs.filter(function (m) { return m.sender === 'partner'; });

    var cards = document.getElementById('statsOverviewCards');
    cards.innerHTML = '';

    var timeMsgs = msgs.filter(function (m) { return m.time > 0; });
    var firstTime = 0, lastTime = 0;
    if (timeMsgs.length > 0) {
      firstTime = Math.min.apply(null, timeMsgs.map(function (m) { return m.time; }));
      lastTime = Math.max.apply(null, timeMsgs.map(function (m) { return m.time; }));
    }

    var overview = [
      { label: '总消息数', value: msgs.length },
      { label: '我发送的', value: myMsgs.length },
      { label: '对方发送的', value: partnerMsgs.length },
      { label: '初次相遇', value: firstTime ? formatDate(firstTime) : '—', small: true },
      { label: '最近联络', value: lastTime ? formatDate(lastTime) : '—', small: true }
    ];

    overview.forEach(function (o) {
      var div = document.createElement('div');
      div.className = 'stats-card';
      div.innerHTML =
        '<div class="stats-card-label">' + o.label + '</div>' +
        '<div class="stats-card-value' + (o.small ? ' small' : '') + '">' + escapeHtml(String(o.value)) + '</div>';
      cards.appendChild(div);
    });

    renderRankList(currentRankView, msgs);
  }

  function renderRankList(view, msgs) {
    var list = document.getElementById('statsRankList');
    list.innerHTML = '';

    var targetMsgs = msgs.filter(function (m) {
      if (view === 'partner') return m.sender === 'partner';
      return m.sender === 'me';
    }).filter(function (m) { return m.text; });

    if (targetMsgs.length === 0) {
      list.innerHTML = '<div style="text-align:center;padding:30px 0;color:#c0ccd6;font-size:13px;">暂无数据</div>';
      return;
    }

    var countMap = {};
    targetMsgs.forEach(function (m) {
      countMap[m.text] = (countMap[m.text] || 0) + 1;
    });

    var arr = Object.keys(countMap).map(function (k) {
      return { text: k, count: countMap[k] };
    });
    arr.sort(function (a, b) { return b.count - a.count; });
    var top5 = arr.slice(0, 5);

    if (top5.length === 0) {
      list.innerHTML = '<div style="text-align:center;padding:30px 0;color:#c0ccd6;font-size:13px;">暂无数据</div>';
      return;
    }

    var max = top5[0].count;

    top5.forEach(function (item, idx) {
      var pct = Math.round(item.count / max * 100);
      var div = document.createElement('div');
      div.className = 'stats-rank-item';
      div.innerHTML =
        '<div class="stats-rank-head">' +
        '  <span class="stats-rank-text">' + (idx + 1) + '. ' + escapeHtml(item.text) + '</span>' +
        '  <span class="stats-rank-count">' + item.count + ' 次</span>' +
        '</div>' +
        '<div class="stats-rank-bar"><div class="stats-rank-fill" style="width:' + pct + '%"></div></div>';
      list.appendChild(div);
    });
  }

  var svPartner = document.getElementById('statsViewPartner');
  var svMe = document.getElementById('statsViewMe');
  if (svPartner) svPartner.addEventListener('click', function () {
    currentRankView = 'partner';
    svPartner.classList.add('active');
    if (svMe) svMe.classList.remove('active');
    renderRankList('partner', readAllMessages());
  });
  if (svMe) svMe.addEventListener('click', function () {
    currentRankView = 'me';
    svMe.classList.add('active');
    if (svPartner) svPartner.classList.remove('active');
    renderRankList('me', readAllMessages());
  });

  // ==================== Tab 2：搜索 ====================
  function escapeReg(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function runSearch() {
    var keyword = document.getElementById('statsSearchKeyword').value.trim();
    var fromStr = document.getElementById('statsSearchFrom').value;
    var toStr = document.getElementById('statsSearchTo').value;

    if (!keyword && !fromStr && !toStr) {
      alert('输入关键词或选择日期开始搜索');
      return;
    }

    var fromTs = fromStr ? new Date(fromStr + 'T00:00:00').getTime() : 0;
    var toTs = toStr ? new Date(toStr + 'T23:59:59').getTime() : Infinity;

    var msgs = readAllMessages();
    var results = msgs.filter(function (m) {
      if (m.time < fromTs || m.time > toTs) return false;
      if (keyword) {
        if (m.type === 'image') return false;
        if (m.text.indexOf(keyword) < 0) return false;
      }
      return true;
    });

    var box = document.getElementById('statsSearchResults');
    box.innerHTML = '';

    if (results.length === 0) {
      box.innerHTML = '<div style="text-align:center;padding:30px 0;color:#c0ccd6;font-size:13px;">没有匹配的消息</div>';
      return;
    }

    results.forEach(function (m) {
      var senderName = m.sender === 'me' ? getMyName() : getPartnerName();
      var avatar = m.sender === 'me' ? getMyAvatar() : getPartnerAvatar();
      var text = m.text;
      if (keyword) {
        text = escapeHtml(text).replace(
          new RegExp(escapeReg(keyword), 'gi'),
          function (match) { return '<mark>' + match + '</mark>'; }
        );
      } else {
        text = escapeHtml(text);
      }
      if (m.type === 'image') text = '[图片]';

      var div = document.createElement('div');
      div.className = 'stats-result-item';
      div.innerHTML =
        '<img class="stats-result-avatar" src="' + avatar + '" alt="">' +
        '<div class="stats-result-main">' +
        '  <div class="stats-result-head">' +
        '    <span class="stats-result-sender">' + escapeHtml(senderName) + '</span>' +
        '    <span class="stats-result-time">' + formatDate(m.time) + '</span>' +
        '  </div>' +
        '  <div class="stats-result-text">' + text + '</div>' +
        '</div>';
      box.appendChild(div);
    });
  }

  var searchBtn = document.getElementById('statsSearchBtn');
  if (searchBtn) searchBtn.addEventListener('click', runSearch);

  // ==================== Tab 3：收藏 ====================
  function renderFavorites() {
    var msgs = readAllMessages().filter(function (m) { return m.favorited; });
    var list = document.getElementById('statsFavList');
    var empty = document.getElementById('statsFavEmpty');

    list.innerHTML = '';
    if (msgs.length === 0) {
      empty.classList.add('active');
      return;
    }
    empty.classList.remove('active');

    msgs.forEach(function (m) {
      var senderName = m.sender === 'me' ? getMyName() : getPartnerName();
      var avatar = m.sender === 'me' ? getMyAvatar() : getPartnerAvatar();
      var content = m.type === 'image'
        ? '<img src="' + m.imageUrl + '" style="max-width:120px;border-radius:8px;display:block;">'
        : escapeHtml(m.text);

      var div = document.createElement('div');
      div.className = 'stats-fav-item';
      div.innerHTML =
        '<img class="stats-result-avatar" src="' + avatar + '" alt="">' +
        '<div class="stats-result-main">' +
        '  <div class="stats-result-head">' +
        '    <span class="stats-result-sender">' + escapeHtml(senderName) + '</span>' +
        '    <span class="stats-result-time">' + formatDate(m.time) + '</span>' +
        '  </div>' +
        '  <div class="stats-result-text">' + content + '</div>' +
        '</div>' +
        '<button class="stats-fav-unfav" title="取消收藏"><i class="fa-solid fa-star"></i></button>';

      div.querySelector('.stats-fav-unfav').addEventListener('click', function () {
        // 写存储 + 重渲染
        if (m.msgId && window.sessionChat && typeof window.sessionChat.toggleFav === 'function') {
          try {
            window.sessionChat.toggleFav(m.msgId, false, 'c:' + getCurrentViewContactId());
          } catch (e) {}
        }
        renderFavorites();
      });

      list.appendChild(div);
    });
  }

  // ==================== Tab 4：词云 ====================
  var STOP_WORDS = {
    '的':1,'了':1,'是':1,'我':1,'你':1,'他':1,'她':1,'它':1,'们':1,'在':1,'有':1,'和':1,'就':1,'都':1,'也':1,'还':1,'又':1,'再':1,'只':1,'被':1,'把':1,'让':1,'给':1,'对':1,'从':1,'向':1,'往':1,'与':1,'或':1,'但':1,'而':1,'且':1,'并':1,'等':1,'着':1,'过':1,'地':1,'得':1,'呢':1,'吧':1,'啊':1,'吗':1,'呀':1,'哦':1,'噢':1,'嗯':1,'嘛':1,'啦':1,'哟':1,'哈':1,'嘿':1,'不':1,'没':1,'很':1,'太':1,'更':1,'最':1,'挺':1,'真':1,'好':1,'那':1,'这':1,'上':1,'下':1,'来':1,'去':1,'会':1,'能':1,'要':1,'想':1,'个':1,'一':1,'二':1,'三':1,'点':1,'些':1,
    '图片':1,'表情':1,'语音':1,'撤回':1,'消息':1,'视频':1,'通话':1
  };

  var currentWCView = 'all';

  function tokenize(text) {
    if (!text) return [];
    text = text.replace(/https?:\/\/\S+/g, ' ');
    text = text.replace(/\[[^\]]*\]/g, ' ');
    text = text.replace(/<[^>]+>/g, ' ');
    text = text.replace(/[^\u4e00-\u9fa5a-zA-Z]/g, ' ');

    var tokens = [];

    for (var i = 0; i < text.length - 3; i++) {
      var w = text.substr(i, 4);
      if (/^[\u4e00-\u9fa5]{4}$/.test(w)) tokens.push({ word: w, weight: 2.4 });
    }
    for (var j = 0; j < text.length - 2; j++) {
      var w3 = text.substr(j, 3);
      if (/^[\u4e00-\u9fa5]{3}$/.test(w3)) tokens.push({ word: w3, weight: 1.8 });
    }
    for (var k = 0; k < text.length - 1; k += 2) {
      var w2 = text.substr(k, 2);
      if (/^[\u4e00-\u9fa5]{2}$/.test(w2)) tokens.push({ word: w2, weight: 1.0 });
    }
    var en = text.match(/[a-zA-Z]{3,}/g) || [];
    en.forEach(function (w) {
      tokens.push({ word: w.toLowerCase(), weight: 1.0 });
    });

    return tokens.filter(function (t) { return !STOP_WORDS[t.word]; });
  }

  function renderWordCloud() {
    var msgs = readAllMessages().filter(function (m) { return m.text; });
    if (currentWCView === 'partner') {
      msgs = msgs.filter(function (m) { return m.sender === 'partner'; });
    } else if (currentWCView === 'me') {
      msgs = msgs.filter(function (m) { return m.sender === 'me'; });
    }

    var freq = {};
    msgs.forEach(function (m) {
      var tokens = tokenize(m.text);
      tokens.forEach(function (t) {
        freq[t.word] = (freq[t.word] || 0) + t.weight;
      });
    });

    var arr = Object.keys(freq).map(function (w) {
      return { word: w, freq: freq[w] };
    });
    arr.sort(function (a, b) { return b.freq - a.freq; });
    var top = arr.slice(0, 60);

    var canvas = document.getElementById('statsWCCanvas');
    var emptyEl = document.getElementById('statsWCEmpty');

    canvas.style.display = 'block';
    if (emptyEl) emptyEl.classList.remove('active');

    var parent = canvas.parentElement;
    var rect = parent.getBoundingClientRect();
    var W = rect.width || parent.offsetWidth || Math.min(window.innerWidth - 36, 400);
    var H = rect.height || parent.offsetHeight || W;
    var dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    var ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    if (top.length === 0) {
      return;
    }

    requestAnimationFrame(function () {
      drawWordCloud(canvas, top);
    });
  }

  function drawWordCloud(canvas, words) {
    var parent = canvas.parentElement;
    var rect = parent.getBoundingClientRect();
    var W = rect.width;
    var H = rect.height;

    if (!W || W < 50) W = Math.min(window.innerWidth - 36, 400);
    if (!H || H < 50) H = W;

    var dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';

    var ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    var maxFreq = words[0].freq;
    var minFreq = words[words.length - 1].freq;
    var placedRects = [];

    var palette = ['#f8b4b4', '#7ED3A8', '#6FB1E8', '#B78BEA', '#F5A623', '#F06292', '#4DD0E1'];

    function overlaps(x, y, w, h) {
      for (var i = 0; i < placedRects.length; i++) {
        var r = placedRects[i];
        if (Math.abs(x - r.x) < (w + r.w) / 2 &&
            Math.abs(y - r.y) < (h + r.h) / 2) {
          return true;
        }
      }
      return false;
    }

    words.forEach(function (item, idx) {
      var norm = (item.freq - minFreq) / (maxFreq - minFreq || 1);
      var size = 11 + Math.log(1 + norm * 9) / Math.log(10) * 43;
      if (size < 11) size = 11;
      if (size > 54) size = 54;

      ctx.font = 'bold ' + size + 'px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
      var metrics = ctx.measureText(item.word);
      var w = metrics.width + 6;
      var h = size + 6;

      for (var attempt = 0; attempt < 300; attempt++) {
        var x = Math.random() * (W - w) + w / 2;
        var y = Math.random() * (H - h) + h / 2;
        if (!overlaps(x, y, w, h)) {
          ctx.save();
          if (idx < 3) {
            ctx.globalAlpha = idx === 0 ? 1 : (idx === 1 ? 0.82 : 0.64);
          } else {
            ctx.globalAlpha = 0.85;
          }
          var color = palette[idx % palette.length];
          ctx.fillStyle = color;
          ctx.fillText(item.word, x, y);
          ctx.restore();
          placedRects.push({ x: x, y: y, w: w, h: h });
          break;
        }
      }
    });
  }

  var wcPartner = document.getElementById('statsWCPartner');
  var wcMe = document.getElementById('statsWCMe');
  var wcAll = document.getElementById('statsWCAll');
  if (wcPartner) wcPartner.addEventListener('click', function () {
    currentWCView = 'partner';
    wcPartner.classList.add('active');
    if (wcMe) wcMe.classList.remove('active');
    if (wcAll) wcAll.classList.remove('active');
    renderWordCloud();
  });
  if (wcMe) wcMe.addEventListener('click', function () {
    currentWCView = 'me';
    wcMe.classList.add('active');
    if (wcPartner) wcPartner.classList.remove('active');
    if (wcAll) wcAll.classList.remove('active');
    renderWordCloud();
  });
  if (wcAll) wcAll.addEventListener('click', function () {
    currentWCView = 'all';
    wcAll.classList.add('active');
    if (wcMe) wcMe.classList.remove('active');
    if (wcPartner) wcPartner.classList.remove('active');
    renderWordCloud();
  });

  // ==================== 入口绑定 ====================
  function openStatsPage() {
    updateSwitchLabel();
    if (typeof window.showPage === 'function') {
      window.showPage(pageStats);
    } else {
      document.querySelectorAll('.page').forEach(function (p) {
        p.classList.remove('active');
      });
      pageStats.classList.add('active');
    }
    var firstTab = pageStats.querySelector('.stats-tab[data-tab="overview"]');
    if (firstTab) firstTab.click();
  }

  var btn = document.getElementById('btnWordCloud');
  if (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      openStatsPage();
    });
  }

  var backBtn = document.getElementById('statsBackBtn');
  if (backBtn) {
    backBtn.addEventListener('click', function () {
      if (typeof window.showPage === 'function') {
        window.showPage(document.getElementById('pageHome'));
      }
    });
  }

  // 切换联系人按钮
  var switchBtn = document.getElementById('statsSwitchBtn');
  if (switchBtn) {
    switchBtn.addEventListener('click', openContactSwitcher);
  }

  // 暴露给外部
  window.stats = {
    open: openStatsPage,
    readAllMessages: readAllMessages,
    readMessagesOfContact: readMessagesOfContact,
    renderOverview: renderOverview,
    renderFavorites: renderFavorites,
    renderWordCloud: renderWordCloud,
    runSearch: runSearch,
    openContactSwitcher: openContactSwitcher,
    switchViewContact: switchViewContact
  };

})();
