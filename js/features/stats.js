/**
 * 词云（消息统计 & 收藏）页面
 * - 数据源：DOM（#chatMessages .message-row）
 * - 4 个 tab：统计 / 搜索 / 收藏 / 词云
 * - 独立页面 #pageStats，不用弹窗
 */

(function () {
  'use strict';

  var pageStats = document.getElementById('pageStats');
  if (!pageStats) {
    console.warn('[stats] 找不到 #pageStats');
    return;
  }

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

  // ==================== 从 DOM 读消息 ====================
  function readAllMessages() {
    var chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return [];

    var rows = chatMessages.querySelectorAll('.message-row');
    var result = [];

    rows.forEach(function (row) {
      if (row.id === 'typingRow') return;

      var sender = row.dataset.sender || (row.classList.contains('self') ? 'me' : 'partner');
      var type = row.dataset.type || 'text';
      var time = Number(row.dataset.time) || 0;
      var favorited = row.dataset.favorited === 'true';

      if (type === 'system') return;
      if (row.classList.contains('system-call-event')) return;

      var text = '';
      var imageUrl = '';

      if (type === 'image') {
        var img = row.querySelector('.message-bubble img');
        imageUrl = img ? img.src : '';
      } else {
        var bubble = row.querySelector('.message-bubble');
        text = bubble ? bubble.textContent.trim() : '';
      }

      if (!text && !imageUrl) return;

      result.push({
        sender: sender,
        type: type,
        time: time,
        favorited: favorited,
        text: text,
        imageUrl: imageUrl,
        row: row
      });
    });

    return result;
  }

  // ==================== 名字/头像 ====================
  function getMyName() {
    var el = document.getElementById('myNickname');
    if (el && el.textContent.trim()) return el.textContent.trim();
    var h1 = document.querySelector('#headerCard h1');
    if (h1 && h1.textContent.trim()) return h1.textContent.trim();
    return '我';
  }
  function getPartnerName() {
    var el = document.getElementById('chatName');
    if (el && el.textContent.trim()) return el.textContent.trim();
    return 'Ta';
  }
  function getMyAvatar() {
    var el = document.getElementById('avatarImg');
    if (el && el.src) return el.src;
    return 'https://picsum.photos/100/100?random=1';
  }
  function getPartnerAvatar() {
    var el = document.getElementById('chatAvatar');
    if (el && el.src) return el.src;
    return 'https://picsum.photos/200/200?random=99';
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
      var view = document.getElementById('statsView' + name.charAt(0).toUpperCase() + name.slice(1));
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

  document.getElementById('statsViewPartner').addEventListener('click', function () {
    currentRankView = 'partner';
    document.getElementById('statsViewPartner').classList.add('active');
    document.getElementById('statsViewMe').classList.remove('active');
    renderRankList('partner', readAllMessages());
  });
  document.getElementById('statsViewMe').addEventListener('click', function () {
    currentRankView = 'me';
    document.getElementById('statsViewMe').classList.add('active');
    document.getElementById('statsViewPartner').classList.remove('active');
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

  document.getElementById('statsSearchBtn').addEventListener('click', runSearch);

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
        m.row.dataset.favorited = 'false';
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

    // 不管有没有词，canvas 都显示（容器固定高度）
    canvas.style.display = 'block';
    // 空状态元素可能存在也可能不存在，做个防御
    if (emptyEl) emptyEl.classList.remove('active');

    // 清空画布（即使没词也要清）
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

    // 没有词就直接清空返回（不再弹「暂无数据」）
    if (top.length === 0) {
      return;
    }

    // 用 Canvas 绘制
    requestAnimationFrame(function () {
      drawWordCloud(canvas, top);
    });
  }
  
function drawWordCloud(canvas, words) {
  var parent = canvas.parentElement;
  // 用 getBoundingClientRect 更可靠
  var rect = parent.getBoundingClientRect();
  var W = rect.width;
  var H = rect.height;

  // 兜底：如果还是 0，用窗口宽度估算
  if (!W || W < 50) W = Math.min(window.innerWidth - 36, 400);
  if (!H || H < 50) H = W;

  var dpr = window.devicePixelRatio || 1;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';

  var ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);   // 先重置
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

      var placed = false;
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
          placed = true;
          break;
        }
      }
    });
  }

  // 词云视图切换
  document.getElementById('statsWCPartner').addEventListener('click', function () {
    currentWCView = 'partner';
    document.getElementById('statsWCPartner').classList.add('active');
    document.getElementById('statsWCMe').classList.remove('active');
    document.getElementById('statsWCAll').classList.remove('active');
    renderWordCloud();
  });
  document.getElementById('statsWCMe').addEventListener('click', function () {
    currentWCView = 'me';
    document.getElementById('statsWCMe').classList.add('active');
    document.getElementById('statsWCPartner').classList.remove('active');
    document.getElementById('statsWCAll').classList.remove('active');
    renderWordCloud();
  });
  document.getElementById('statsWCAll').addEventListener('click', function () {
    currentWCView = 'all';
    document.getElementById('statsWCAll').classList.add('active');
    document.getElementById('statsWCMe').classList.remove('active');
    document.getElementById('statsWCPartner').classList.remove('active');
    renderWordCloud();
  });
  // ==================== 入口绑定 ====================
  function openStatsPage() {
    // 用 router 切页（如果有 showPage）
    if (typeof window.showPage === 'function') {
      window.showPage(pageStats);
    } else {
      // 兜底：手动切
      document.querySelectorAll('.page').forEach(function (p) {
        p.classList.remove('active');
      });
      pageStats.classList.add('active');
    }
    // 默认渲染统计 tab
    document.querySelector('.stats-tab[data-tab="overview"]').click();
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

  // 暴露给外部
  window.stats = {
    open: openStatsPage,
    readAllMessages: readAllMessages,
    renderOverview: renderOverview,
    renderFavorites: renderFavorites,
    renderWordCloud: renderWordCloud,
    runSearch: runSearch
  };

})();
