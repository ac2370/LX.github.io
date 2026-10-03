/* ============================================================
   envelope.js —— 信箱完整逻辑（含列表/阅读/编辑/删除/浮层）
   数据：localforage 键 'envelopeData' = { outbox: [], inbox: [] }
     outbox: { id, content, sentTime, replyTime, status: 'pending' | 'replied' }
     inbox:  { id, refId, originalContent, content, receivedTime, isNew }
   兼容：旧键 'pending_envelope' 自动迁移
   依赖：
     - window.addMessage（可选，缺失则回退为直接追加气泡）
     - window.getReplyCards（card.js 暴露，抽"回复"分类字卡）
     - window.showPage / window.pageEnvelope / window.pageHome（router.js）
   ============================================================ */
(function () {
  'use strict';

  console.log('envelope loaded');

  // ==================== 常量 ====================
  var STORE_KEY = 'envelopeData';
  var LEGACY_KEY = 'pending_envelope';

  // 回信时间 
var TEST_REPLY_DELAY_MS = 10 * 60 * 60 * 1000;   // 10 小时
// 或想要 10~24 小时随机：
// var TEST_REPLY_DELAY_MS = randomInt(10 * 60 * 60 * 1000, 24 * 60 * 60 * 1000);

  // 回信正文：抽 8~12 句
  var REPLY_SENT_MIN = 8;
  var REPLY_SENT_MAX = 12;

  // 内容预览截断长度
  var PREVIEW_LEN = 38;
  var ORIGINAL_PREVIEW_LEN = 60;

  // ==================== DOM 引用 ====================
  var btnEnvelope = document.getElementById('btnEnvelope');
  var envBackBtn  = document.getElementById('envBackBtn');

  var tabs        = document.querySelectorAll('.env-tab');
  var viewSent    = document.getElementById('envViewSent');
  var viewInbox   = document.getElementById('envViewInbox');
  var envFooter   = document.querySelector('#pageEnvelope .env-footer');

  var sentList    = document.getElementById('envSentList');
  var sentEmpty   = document.getElementById('envSentEmpty');
  var inboxList   = document.getElementById('envInboxList');
  var inboxEmpty  = document.getElementById('envInboxEmpty');

  // 写信弹层
  var writeModal   = document.getElementById('envWriteModal');
  var writeBtn     = document.getElementById('envWriteBtn');
  var writeClose   = document.getElementById('envWriteClose');
  var writeCancel  = document.getElementById('envWriteCancel');
  var writeSend    = document.getElementById('envWriteSend');
  var writeText    = document.getElementById('envWriteText');
  var writeSync    = document.getElementById('envWriteSyncChat');

  // 阅读弹层
  var readModal  = document.getElementById('envReadModal');
  var readClose  = document.getElementById('envReadClose');
  var readTitle  = document.getElementById('envReadTitle');
  var readBody   = document.getElementById('envReadBody');
  var readFooter = document.getElementById('envReadFooter');

  // ==================== 数据 ====================
  var envelopeData = { outbox: [], inbox: [] };
  var dataReady = false;

  // 当前 Tab
  var currentTab = 'sent';

  // 当前打开的信件（阅读弹层用）
  var currentRead = { type: null, id: null };

  function saveData() {
    if (typeof localforage === 'undefined') return Promise.resolve();
    return localforage.setItem(STORE_KEY, envelopeData).catch(function (e) {
      console.warn('[envelope] 保存失败', e);
    });
  }

  function loadData() {
    if (typeof localforage === 'undefined') {
      dataReady = true;
      return Promise.resolve();
    }
    return localforage.getItem(STORE_KEY).then(function (data) {
      if (data && typeof data === 'object') {
        envelopeData.outbox = Array.isArray(data.outbox) ? data.outbox : [];
        envelopeData.inbox  = Array.isArray(data.inbox)  ? data.inbox  : [];
      }
      return localforage.getItem(LEGACY_KEY).then(function (legacy) {
        if (Array.isArray(legacy) && legacy.length > 0) {
          legacy.forEach(function (item) {
            envelopeData.outbox.push({
              id: item.id || genId('out'),
              content: item.content || '',
              sentTime: item.sentTime || Date.now(),
              replyTime: item.replyTime || (Date.now() + TEST_REPLY_DELAY_MS),
              status: 'pending'
            });
          });
          localforage.removeItem(LEGACY_KEY).catch(function () {});
          return saveData();
        }
      });
    }).then(function () {
      dataReady = true;
    }).catch(function () {
      dataReady = true;
    });
  }

  // ==================== 工具 ====================
  function genId(prefix) {
    return (prefix || 'id') + '_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function formatDate(ts) {
    var d = new Date(ts);
    var y = d.getFullYear();
    var m = (d.getMonth() + 1).toString().padStart(2, '0');
    var day = d.getDate().toString().padStart(2, '0');
    var h = d.getHours().toString().padStart(2, '0');
    var min = d.getMinutes().toString().padStart(2, '0');
    return y + '.' + m + '.' + day + ' ' + h + ':' + min;
  }

  function truncate(str, len) {
    if (!str) return '';
    return str.length > len ? str.substring(0, len) + '…' : str;
  }

  function hoursUntil(ts) {
    var diff = ts - Date.now();
    if (diff <= 0) return 0;
    return Math.ceil(diff / (60 * 60 * 1000));
  }

  // 从 home settings 或 chat 里读名字（尽量兼容）
  function getSettingsNames() {
    var partnerName = 'Ta';
    var myName = '我';

    // 1) 优先从 localStorage 里的 my_contacts / my_current_contact 取对方名字
    try {
      var contacts = JSON.parse(localStorage.getItem('my_contacts') || '[]');
      var currentId = localStorage.getItem('my_current_contact');
      if (Array.isArray(contacts)) {
        var cur = contacts.find(function (c) { return c.id === currentId; }) || contacts[0];
        if (cur && cur.name) partnerName = cur.name;
      }
    } catch (e) {}

    // 2) 我的名字：从 home_custom_images 或类似键读（兼容常见字段）
    try {
      var raw = localStorage.getItem('home_custom_images');
      if (raw) {
        var data = JSON.parse(raw);
        if (data && data.myName) myName = data.myName;
      }
    } catch (e) {}

    // 3) 如果外部有 settings 对象（Milk 风格），优先用它
    if (window.settings && typeof window.settings === 'object') {
      if (window.settings.partnerName) partnerName = window.settings.partnerName;
      if (window.settings.myName)      myName      = window.settings.myName;
    }

    return { partnerName: partnerName, myName: myName };
  }

  // ==================== 页面切换 ====================
  function gotoEnvelope() {
    if (window.showPage && window.pageEnvelope) {
      window.showPage(window.pageEnvelope);
    } else if (window.showPage) {
      var p = document.getElementById('pageEnvelope');
      if (p) window.showPage(p);
    }
    // 打开页面时检查回信
    setTimeout(checkReplies, 50);
  }

  if (btnEnvelope) {
    btnEnvelope.addEventListener('click', function (e) {
      e.preventDefault();
      gotoEnvelope();
    });
  }
  if (envBackBtn) {
    envBackBtn.addEventListener('click', function () {
      if (window.showPage && window.pageHome) {
        window.showPage(window.pageHome);
      }
    });
  }

  // ==================== Tab 切换 ====================
  function switchEnvTab(name) {
    currentTab = name;
    tabs.forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-tab') === name);
    });
    if (viewSent)  viewSent.classList.toggle('active',  name === 'sent');
    if (viewInbox) viewInbox.classList.toggle('active', name === 'inbox');
    if (envFooter) {
      envFooter.style.display = (name === 'sent') ? '' : 'none';
    }
    if (name === 'inbox') {
      // 进收件箱时清掉"新"标记
      markInboxRead();
    }
  }

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      switchEnvTab(tab.getAttribute('data-tab'));
    });
  });

  function markInboxRead() {
    var changed = false;
    envelopeData.inbox.forEach(function (m) {
      if (m.isNew) { m.isNew = false; changed = true; }
    });
    if (changed) {
      saveData().then(function () {
        renderInbox();
        updateTabBadges();
      });
    } else {
      renderInbox();
      updateTabBadges();
    }
  }

  // ==================== Tab 角标 ====================
  function updateTabBadges() {
    var pendingCount = envelopeData.outbox.filter(function (m) {
      return m.status === 'pending';
    }).length;
    var unreadCount = envelopeData.inbox.filter(function (m) {
      return m.isNew;
    }).length;

    var tabSent  = document.getElementById('envTabSent');
    var tabInbox = document.getElementById('envTabInbox');

    function setBadge(tabEl, count) {
      if (!tabEl) return;
      var old = tabEl.querySelector('.env-tab-badge');
      if (old && old.parentNode) old.parentNode.removeChild(old);
      if (count > 0) {
        var span = document.createElement('span');
        span.className = 'env-tab-badge';
        span.textContent = count;
        tabEl.appendChild(span);
      }
    }

    setBadge(tabSent,  pendingCount);
    setBadge(tabInbox, unreadCount);
  }

  // ==================== 渲染：寄出箱 ====================
  function renderSent() {
    if (!sentList) return;
    var arr = envelopeData.outbox.slice().sort(function (a, b) {
      return (b.sentTime || 0) - (a.sentTime || 0);
    });

    if (arr.length === 0) {
      sentList.innerHTML = '';
      if (sentEmpty) sentEmpty.style.display = 'block';
      updateTabBadges();
      return;
    }
    if (sentEmpty) sentEmpty.style.display = 'none';

    var html = '';
    arr.forEach(function (item) {
      var statusHtml;
      if (item.status === 'replied') {
        statusHtml = '<span class="env-card-status replied"><i class="fa-solid fa-check"></i> 已收到回信</span>';
      } else {
        var h = hoursUntil(item.replyTime);
        // 如果不足 1 小时（比如测试用的 30 秒），显示分钟
        var pendingText;
        var diff = item.replyTime - Date.now();
        if (diff > 0 && diff < 60 * 60 * 1000) {
          var mins = Math.max(1, Math.ceil(diff / (60 * 1000)));
          pendingText = '预计 ' + mins + ' 分钟后回信';
        } else if (h <= 0) {
          pendingText = '即将回信';
        } else {
          pendingText = '预计 ' + h + ' 小时后回信';
        }
        statusHtml = '<span class="env-card-status pending"><i class="fa-regular fa-clock"></i> ' + pendingText + '</span>';
      }
      html += '<div class="env-card" data-id="' + escapeHtml(item.id) + '" data-type="sent">' +
        '<div class="env-card-date">寄出 · ' + formatDate(item.sentTime) + '</div>' +
        '<div class="env-card-text">' + escapeHtml(truncate(item.content, PREVIEW_LEN)) + '</div>' +
        '<div class="env-card-foot">' +
          statusHtml +
          '<button class="env-card-del" data-del="' + escapeHtml(item.id) + '" data-deltype="sent"><i class="fa-solid fa-xmark"></i></button>' +
        '</div>' +
        '</div>';
    });
    sentList.innerHTML = html;
    bindCards(sentList);
    updateTabBadges();
  }

  // ==================== 渲染：收件箱 ====================
  function renderInbox() {
    if (!inboxList) return;
    var arr = envelopeData.inbox.slice().sort(function (a, b) {
      return (b.receivedTime || 0) - (a.receivedTime || 0);
    });

    if (arr.length === 0) {
      inboxList.innerHTML = '';
      if (inboxEmpty) inboxEmpty.style.display = 'block';
      updateTabBadges();
      return;
    }
    if (inboxEmpty) inboxEmpty.style.display = 'none';

    var html = '';
    arr.forEach(function (item) {
      var quote = item.originalContent
        ? '<div class="env-card-quote">原信: ' + escapeHtml(truncate(item.originalContent, 30)) + '</div>'
        : '';
      var newTag = item.isNew
        ? '<span class="env-card-new">新</span>'
        : '';
      html += '<div class="env-card" data-id="' + escapeHtml(item.id) + '" data-type="inbox">' +
        '<div class="env-card-date">收到 · ' + formatDate(item.receivedTime) + '</div>' +
        quote +
        '<div class="env-card-text">' + escapeHtml(truncate(item.content, PREVIEW_LEN)) + '</div>' +
        '<div class="env-card-foot">' +
          newTag +
          '<button class="env-card-del" data-del="' + escapeHtml(item.id) + '" data-deltype="inbox"><i class="fa-solid fa-xmark"></i></button>' +
        '</div>' +
        '</div>';
    });
    inboxList.innerHTML = html;
    bindCards(inboxList);
    updateTabBadges();
  }

  // ==================== 卡片点击 / 删除 ====================
  function bindCards(container) {
    container.querySelectorAll('.env-card').forEach(function (card) {
      card.addEventListener('click', function (e) {
        if (e.target.closest('.env-card-del')) return;
        var id = card.getAttribute('data-id');
        var type = card.getAttribute('data-type');
        openRead(type, id);
      });
    });
    container.querySelectorAll('.env-card-del').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var id = btn.getAttribute('data-del');
        var type = btn.getAttribute('data-deltype');
        deleteEnvLetter(type, id);
      });
    });
  }

  // ==================== 删除 ====================
  function deleteEnvLetter(type, id) {
    if (!confirm('确定删除这封信吗？')) return;
    if (type === 'sent') {
      envelopeData.outbox = envelopeData.outbox.filter(function (m) { return m.id !== id; });
    } else {
      envelopeData.inbox = envelopeData.inbox.filter(function (m) { return m.id !== id; });
    }
    saveData().then(function () {
      renderSent();
      renderInbox();
    });
  }

  // ==================== 阅读弹层 ====================
  function openRead(type, id) {
    var item;
    if (type === 'sent') {
      item = envelopeData.outbox.find(function (m) { return m.id === id; });
    } else {
      item = envelopeData.inbox.find(function (m) { return m.id === id; });
    }
    if (!item) return;

    currentRead = { type: type, id: id };

    // 打开收件信：清掉"新"标记
    if (type === 'inbox' && item.isNew) {
      item.isNew = false;
      saveData().then(function () {
        renderInbox();
        updateTabBadges();
      });
    }

    var names = getSettingsNames();
    var salutationName = (type === 'sent') ? names.partnerName : names.myName;

    if (readTitle) readTitle.textContent = (type === 'sent') ? '寄出的信' : '收到的信';

    var html = '';

    // 邮戳
    html += '<div class="env-read-stamp">' +
      '<div class="stamp-icon">✉</div>' +
      '<div>应许之地</div>' +
      '</div>';

    // 收件箱显示"你的原信"引用（超过 120 字可展开）
    if (type === 'inbox' && item.originalContent) {
      var orig = item.originalContent;
      var isLong = orig.length > 120;
      var preview = isLong ? orig.substring(0, 120) : orig;
      html += '<div class="env-read-original" id="envReadOriginal">' +
        '<div class="env-read-original-label">你的原信</div>' +
        '<div class="env-read-original-text" id="envReadOriginalText">' +
          escapeHtml(preview).replace(/\n/g, '<br>') +
        '</div>' +
        (isLong ? '<button class="env-read-original-toggle" id="envReadOriginalToggle">展开</button>' : '') +
        '</div>';
    }

    // 称呼 + 正文
    html += '<div class="env-read-salutation">' + escapeHtml(salutationName) + '：</div>';
    html += '<div class="env-read-content" id="envReadContent">' + escapeHtml(item.content) + '</div>';

    // 落款 + 日期
    var signName = (type === 'sent') ? names.myName : names.partnerName;
    html += '<div class="env-read-signature">—— ' + escapeHtml(signName) + '</div>';
    var ts = (type === 'sent') ? item.sentTime : item.receivedTime;
    html += '<div class="env-read-date">' + formatDate(ts) + '</div>';

    if (readBody) readBody.innerHTML = html;

    // 原信展开/收起
    var toggleBtn = document.getElementById('envReadOriginalToggle');
    if (toggleBtn && item.originalContent) {
      var expanded = false;
      toggleBtn.addEventListener('click', function () {
        expanded = !expanded;
        var textEl = document.getElementById('envReadOriginalText');
        if (textEl) {
          textEl.innerHTML = escapeHtml(expanded ? orig : preview).replace(/\n/g, '<br>');
        }
        toggleBtn.textContent = expanded ? '收起' : '展开';
      });
    }

    // 底部按钮
    var btnHtml = '<button class="env-read-btn" data-act="close"><i class="fa-solid fa-xmark"></i> 关闭</button>';
    if (type === 'sent' && item.status === 'pending') {
      btnHtml += '<button class="env-read-btn primary" data-act="edit"><i class="fa-solid fa-pen"></i> 编辑</button>';
    }
    if (type === 'inbox') {
      btnHtml += '<button class="env-read-btn primary" data-act="reply"><i class="fa-solid fa-reply"></i> 回复</button>';
    }
    if (readFooter) readFooter.innerHTML = btnHtml;

    // 绑定底部按钮
    if (readFooter) {
      readFooter.querySelectorAll('.env-read-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var act = btn.getAttribute('data-act');
          if (act === 'close') {
            closeRead();
          } else if (act === 'edit') {
            closeRead();
            toggleEnvEdit(type, id);
          } else if (act === 'reply') {
            closeRead();
            switchEnvTab('sent');
            if (writeText) writeText.value = '';
            if (writeModal) writeModal.classList.add('active');
          }
        });
      });
    }

    if (readModal) readModal.classList.add('active');
  }

  function closeRead() {
    if (readModal) readModal.classList.remove('active');
    currentRead = { type: null, id: null };
  }

  if (readClose) readClose.addEventListener('click', closeRead);
  if (readModal) {
    readModal.addEventListener('click', function (e) {
      if (e.target === readModal) closeRead();
    });
  }

  // ==================== 编辑寄出信 ====================
  // 直接在阅读弹层里把正文变成 textarea，保存后写回
  function toggleEnvEdit(type, id) {
    if (type !== 'sent') return;
    var item = envelopeData.outbox.find(function (m) { return m.id === id; });
    if (!item) return;
    if (item.status !== 'pending') {
      alert('这封信已经收到回信，不能再编辑了');
      return;
    }

    var contentEl = document.getElementById('envReadContent');
    if (!contentEl) return;

    // 编辑态
    contentEl.innerHTML =
      '<textarea class="env-read-editarea" id="envReadEditArea">' +
        escapeHtml(item.content) +
      '</textarea>';

    // 底部按钮换成保存/取消
    if (readFooter) {
      readFooter.innerHTML =
        '<button class="env-read-btn" data-act="cancel-edit">取消</button>' +
        '<button class="env-read-btn primary" data-act="save-edit">保存</button>';

      readFooter.querySelector('[data-act="cancel-edit"]').addEventListener('click', function () {
        // 重新打开阅读视图
        openRead(type, id);
      });
      readFooter.querySelector('[data-act="save-edit"]').addEventListener('click', function () {
        saveEnvEdit(type, id);
      });
    }
  }

  function saveEnvEdit(type, id) {
    if (type !== 'sent') return;
    var item = envelopeData.outbox.find(function (m) { return m.id === id; });
    if (!item) return;

    var area = document.getElementById('envReadEditArea');
    if (!area) return;
    var newText = area.value.trim();
    if (!newText) {
      alert('信件内容不能为空');
      return;
    }

    item.content = newText;
    saveData().then(function () {
      renderSent();
      openRead(type, id);
      alert('已保存修改');
    });
  }

  // ==================== 写信 / 寄出 ====================
  function openWriteModal() {
    if (writeText) writeText.value = '';
    if (writeSync) writeSync.checked = false;
    if (writeModal) writeModal.classList.add('active');
    setTimeout(function () { if (writeText) writeText.focus(); }, 100);
  }

  function closeWriteModal() {
    if (writeModal) writeModal.classList.remove('active');
  }

  if (writeBtn)    writeBtn.addEventListener('click', openWriteModal);
  if (writeClose)  writeClose.addEventListener('click', closeWriteModal);
  if (writeCancel) writeCancel.addEventListener('click', closeWriteModal);
  if (writeModal) {
    writeModal.addEventListener('click', function (e) {
      if (e.target === writeModal) closeWriteModal();
    });
  }

  // ==================== 回信生成 ====================
  function generateReplyContent() {
    var pool = (typeof window.getReplyCards === 'function') ? window.getReplyCards() : [];
    if (!Array.isArray(pool) || pool.length === 0) {
      return '收到了你的信，我很开心。';
    }

    var count = randomInt(REPLY_SENT_MIN, REPLY_SENT_MAX);
    if (count > pool.length) count = pool.length;

    // 洗牌
    var shuffled = pool.slice();
    for (var i = shuffled.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = tmp;
    }

    var sentences = shuffled.slice(0, count).map(function (s) {
      var t = String(s).trim();
      if (!/[。！？…~～.!?]$/.test(t)) {
        var endings = ['。', '！', '…', '~'];
        t = t + endings[Math.floor(Math.random() * endings.length)];
      }
      return t;
    });

    return sentences.join('');
  }

  function checkReplies() {
    if (!dataReady) return;

    var now = Date.now();
    var changed = false;
    var newMails = [];

    envelopeData.outbox.forEach(function (item) {
      if (item.status === 'pending' && now >= item.replyTime) {
        item.status = 'replied';
        changed = true;

        var reply = {
          id: genId('in'),
          refId: item.id,
          originalContent: item.content,
          content: generateReplyContent(),
          receivedTime: now,
          isNew: true
        };
        envelopeData.inbox.push(reply);
        newMails.push(reply);
      }
    });

    if (changed) {
      saveData().then(function () {
        renderSent();
        renderInbox();
        if (newMails.length > 0) {
          showEnvelopeReplyPopup(newMails[0]);
        }
      });
    } else {
      renderSent();
      renderInbox();
    }
  }

  // ==================== 底部浮层 ====================
  function showEnvelopeReplyPopup(mail) {
    var old = document.getElementById('envMailToast');
    if (old && old.parentNode) old.parentNode.removeChild(old);

    var toast = document.createElement('div');
    toast.id = 'envMailToast';
    toast.innerHTML =
      '<div class="env-mail-toast-inner">' +
        '<div class="env-mail-toast-icon">💌</div>' +
        '<div class="env-mail-toast-text">收到了一封回信</div>' +
        '<div class="env-mail-toast-actions">' +
          '<button class="env-mail-toast-btn now" id="envToastNow">立即阅读</button>' +
        '</div>' +
      '</div>';

    toast.style.cssText =
      'position:fixed;left:50%;bottom:-200px;transform:translateX(-50%);' +
      'z-index:600;width:calc(100% - 32px);max-width:400px;' +
      'transition:bottom 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);';

    document.body.appendChild(toast);

    requestAnimationFrame(function () {
      toast.style.bottom = '24px';
    });

    // 8 秒后自动消失
    var autoTimer = setTimeout(function () {
      removeToast();
    }, 8000);

    function removeToast() {
      clearTimeout(autoTimer);
      toast.style.bottom = '-200px';
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 400);
    }

    var nowBtn = document.getElementById('envToastNow');
    if (nowBtn) {
      nowBtn.addEventListener('click', function () {
        removeToast();
        switchEnvTab('inbox');
        if (mail && mail.id) {
          setTimeout(function () { openRead('inbox', mail.id); }, 200);
        }
      });
    }
  }

  // ==================== 寄出 ====================
  if (writeSend) {
    writeSend.addEventListener('click', function () {
      var content = writeText ? writeText.value.trim() : '';
      if (!content) {
        alert('信件内容不能为空');
        return;
      }

      var now = Date.now();
     var replyTime = now + randomInt(10 * 60 * 60 * 1000, 24 * 60 * 60 * 1000);

      envelopeData.outbox.push({
        id: genId('out'),
        content: content,
        sentTime: now,
        replyTime: replyTime,
        status: 'pending'
      });

      // 可选：同步到聊天记录
      if (writeSync && writeSync.checked) {
        var text = '【寄出的信】' + content;
        if (typeof window.addMessage === 'function') {
          try { window.addMessage('self', text); } catch (e) {}
        } else {
          var chatMessages = document.getElementById('chatMessages');
          if (chatMessages) {
            var row = document.createElement('div');
            row.className = 'message-row self';
            var bubble = document.createElement('div');
            bubble.className = 'message-bubble';
            bubble.textContent = text;
            row.appendChild(bubble);
            chatMessages.appendChild(row);
            chatMessages.scrollTop = chatMessages.scrollHeight;
          }
        }
      }

      saveData().then(function () {
        renderSent();
        closeWriteModal();
        // 显示预计回信时间
        var diff = replyTime - Date.now();
        var tip;
        if (diff < 60 * 1000) {
          tip = Math.max(1, Math.round(diff / 1000)) + ' 秒';
        } else if (diff < 60 * 60 * 1000) {
          tip = Math.round(diff / (60 * 1000)) + ' 分钟';
        } else {
          tip = Math.round(diff / (60 * 60 * 1000)) + ' 小时';
        }
        alert('信件已寄出，预计 ' + tip + ' 后收到回信 ✉️');
      });
    });
  }

  // ==================== 初始化 ====================
  function init() {
    switchEnvTab('sent');

    loadData().then(function () {
      renderSent();
      renderInbox();
      // 启动后 100ms 检查一次
      setTimeout(checkReplies, 100);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ==================== 暴露接口 ====================
  window.envelope = {
    checkReplies: checkReplies,
    renderSent: renderSent,
    renderInbox: renderInbox,
    switchEnvTab: switchEnvTab,
    openRead: openRead,
    deleteEnvLetter: deleteEnvLetter,
    toggleEnvEdit: toggleEnvEdit,
    saveEnvEdit: saveEnvEdit,
    getData: function () { return envelopeData; },
    // 测试：强制让所有 pending 信件立即到期
    forceReplies: function () {
      var now = Date.now();
      envelopeData.outbox.forEach(function (m) {
        if (m.status === 'pending') m.replyTime = now - 1;
      });
      saveData().then(function () { checkReplies(); });
    }
  };

})();
