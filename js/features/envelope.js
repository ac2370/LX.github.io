/* ============================================================
   envelope.js —— 信箱完整逻辑
   数据：localforage 键 'envelopeData' = { outbox: [], inbox: [] }
     outbox: { id, content, sentTime, replyTime, status: 'pending' | 'replied' }
     inbox:  { id, refId, originalContent, content, receivedTime, isNew }
   兼容：旧键 'pending_envelope' 自动迁移
   依赖：
     - window.addMessage（若无则用回退：直接往 #chatMessages 追加一条）
     - window.getReplyCards（card.js 暴露，抽"回复"分类字卡）
     - window.showPage / window.pageEnvelope / window.pageHome（router.js）
   ============================================================ */
(function () {
  'use strict';

  console.log('envelope loaded');

  // ==================== 常量 ====================
  var STORE_KEY = 'envelopeData';
  var LEGACY_KEY = 'pending_envelope';

  // 回信时间：10~24 小时（毫秒）
  var REPLY_MIN_MS = 10 * 60 * 60 * 1000;
  var REPLY_MAX_MS = 24 * 60 * 60 * 1000;

  // 回信正文：抽 8~12 句
  var REPLY_SENT_MIN = 8;
  var REPLY_SENT_MAX = 12;

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
      // 兼容旧键 pending_envelope
      return localforage.getItem(LEGACY_KEY).then(function (legacy) {
        if (Array.isArray(legacy) && legacy.length > 0) {
          legacy.forEach(function (item) {
            envelopeData.outbox.push({
              id: item.id || genId('out'),
              content: item.content || '',
              sentTime: item.sentTime || Date.now(),
              replyTime: item.replyTime || (Date.now() + randomReplyDelay()),
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

  function randomReplyDelay() {
    return randomInt(REPLY_MIN_MS, REPLY_MAX_MS);
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

  // 距离回信还剩几小时（向上取整）
  function hoursUntil(ts) {
    var diff = ts - Date.now();
    if (diff <= 0) return 0;
    return Math.ceil(diff / (60 * 60 * 1000));
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
  function applyTabUI(name) {
    if (viewSent)  viewSent.classList.toggle('active',  name === 'sent');
    if (viewInbox) viewInbox.classList.toggle('active', name === 'inbox');
    if (envFooter) {
      envFooter.style.display = (name === 'sent') ? '' : 'none';
    }
  }

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      var name = tab.getAttribute('data-tab');
      tabs.forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');
      applyTabUI(name);
      if (name === 'inbox') {
        // 进收件箱时清掉"新"标记
        markInboxRead();
      }
    });
  });

  function markInboxRead() {
    var changed = false;
    envelopeData.inbox.forEach(function (m) {
      if (m.isNew) { m.isNew = false; changed = true; }
    });
    if (changed) {
      saveData().then(function () { renderInbox(); });
    } else {
      renderInbox();
    }
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
        statusHtml = '<span class="env-card-status pending"><i class="fa-regular fa-clock"></i> 预计 ' + h + ' 小时后回信</span>';
      }
      html += '<div class="env-card" data-id="' + escapeHtml(item.id) + '" data-type="sent">' +
        '<div class="env-card-date">寄出 · ' + formatDate(item.sentTime) + '</div>' +
        '<div class="env-card-text">' + escapeHtml(truncate(item.content, 38)) + '</div>' +
        '<div class="env-card-foot">' +
          statusHtml +
          '<button class="env-card-del" data-del="' + escapeHtml(item.id) + '" data-deltype="sent"><i class="fa-solid fa-xmark"></i></button>' +
        '</div>' +
        '</div>';
    });
    sentList.innerHTML = html;
    bindCards(sentList);
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
        '<div class="env-card-text">' + escapeHtml(truncate(item.content, 38)) + '</div>' +
        '<div class="env-card-foot">' +
          newTag +
          '<button class="env-card-del" data-del="' + escapeHtml(item.id) + '" data-deltype="inbox"><i class="fa-solid fa-xmark"></i></button>' +
        '</div>' +
        '</div>';
    });
    inboxList.innerHTML = html;
    bindCards(inboxList);
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
      });
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

    if (readTitle) readTitle.textContent = (type === 'sent') ? '寄出的信' : '收到的信';

    var html = '';

    // 邮戳
    html += '<div class="env-read-stamp">' +
      '<div class="stamp-icon">✉</div>' +
      '<div>应许之地</div>' +
      '</div>';

    // 收件箱显示原信引用
    if (type === 'inbox' && item.originalContent) {
      html += '<div class="env-read-original">原信: ' + escapeHtml(truncate(item.originalContent, 60)) + '</div>';
    }

    // 称呼 + 正文
    html += '<div class="env-read-salutation">亲爱的：</div>';
    html += '<div class="env-read-content">' + escapeHtml(item.content) + '</div>';

    // 落款 + 日期
    html += '<div class="env-read-signature">—— 阿晏</div>';
    var ts = (type === 'sent') ? item.sentTime : item.receivedTime;
    html += '<div class="env-read-date">' + formatDate(ts) + '</div>';

    if (readBody) readBody.innerHTML = html;

    // 底部按钮
    var btnHtml = '<button class="env-read-btn" data-act="close"><i class="fa-solid fa-xmark"></i> 关闭</button>';
    if (type === 'sent' && item.status === 'pending') {
      btnHtml += '<button class="env-read-btn primary" data-act="edit">编辑</button>';
    }
    if (type === 'inbox') {
      btnHtml += '<button class="env-read-btn primary" data-act="reply">回复</button>';
    }
    if (readFooter) readFooter.innerHTML = btnHtml;

    // 绑定按钮
    if (readFooter) {
      readFooter.querySelectorAll('.env-read-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var act = btn.getAttribute('data-act');
          if (act === 'close') {
            closeRead();
          } else if (act === 'edit') {
            // 简单处理：跳到写信弹层，预填原文（不删原信）
            closeRead();
            if (writeText) writeText.value = item.content || '';
            if (writeModal) writeModal.classList.add('active');
          } else if (act === 'reply') {
            closeRead();
            // 切到"寄出的信"Tab 并打开写信
            tabs.forEach(function (t) {
              t.classList.toggle('active', t.getAttribute('data-tab') === 'sent');
            });
            applyTabUI('sent');
            if (writeModal) writeModal.classList.add('active');
          }
        });
      });
    }

    if (readModal) readModal.classList.add('active');
  }

  function closeRead() {
    if (readModal) readModal.classList.remove('active');
  }

  if (readClose) readClose.addEventListener('click', closeRead);
  if (readModal) {
    readModal.addEventListener('click', function (e) {
      if (e.target === readModal) closeRead();
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
  // 从"回复"分类抽 8~12 句，用句末标点拼接
  function generateReplyContent() {
    var pool = (typeof window.getReplyCards === 'function') ? window.getReplyCards() : [];
    if (!Array.isArray(pool) || pool.length === 0) {
      return '收到了你的信，我很开心。';
    }

    var count = randomInt(REPLY_SENT_MIN, REPLY_SENT_MAX);
    if (count > pool.length) count = pool.length;

    // 洗牌，避免抽到重复
    var shuffled = pool.slice();
    for (var i = shuffled.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = tmp;
    }

    var sentences = shuffled.slice(0, count).map(function (s) {
      var t = String(s).trim();
      // 如果末尾没标点，随机补一个
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
          showMailToast(newMails.length);
        }
      });
    } else {
      // 即使没变化，也把列表渲染一次，保证 UI 是最新
      renderSent();
      renderInbox();
    }
  }

  // ==================== 底部浮层提示 ====================
  function showMailToast(count) {
    // 避免重复
    var old = document.getElementById('envMailToast');
    if (old && old.parentNode) old.parentNode.removeChild(old);

    var toast = document.createElement('div');
    toast.id = 'envMailToast';
    toast.innerHTML =
      '<div class="env-mail-toast-inner">' +
        '<div class="env-mail-toast-icon">💌</div>' +
        '<div class="env-mail-toast-text">收到了一封回信</div>' +
        '<div class="env-mail-toast-actions">' +
          '<button class="env-mail-toast-btn later" id="envToastLater">稍后查看</button>' +
          '<button class="env-mail-toast-btn now" id="envToastNow">立即阅读</button>' +
        '</div>' +
      '</div>';

    toast.style.cssText =
      'position:fixed;left:50%;bottom:-200px;transform:translateX(-50%);' +
      'z-index:600;width:calc(100% - 32px);max-width:400px;' +
      'transition:bottom 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);';

    document.body.appendChild(toast);

    // 用 requestAnimationFrame 让 transition 生效
    requestAnimationFrame(function () {
      toast.style.bottom = '24px';
    });

    function removeToast() {
      toast.style.bottom = '-200px';
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 400);
    }

    document.getElementById('envToastLater').addEventListener('click', removeToast);
    document.getElementById('envToastNow').addEventListener('click', function () {
      removeToast();
      // 切到收件箱 Tab 并打开最新的那封
      tabs.forEach(function (t) {
        t.classList.toggle('active', t.getAttribute('data-tab') === 'inbox');
      });
      applyTabUI('inbox');
      renderInbox();
      var latest = envelopeData.inbox[envelopeData.inbox.length - 1];
      if (latest) {
        setTimeout(function () { openRead('inbox', latest.id); }, 200);
      }
    });
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
      var replyTime = now + randomReplyDelay();

      // 1. 写入寄出箱
      envelopeData.outbox.push({
        id: genId('out'),
        content: content,
        sentTime: now,
        replyTime: replyTime,
        status: 'pending'
      });

      // 2. 可选：同步到聊天记录
      if (writeSync && writeSync.checked) {
        var text = '【寄出的信】' + content;
        if (typeof window.addMessage === 'function') {
          try { window.addMessage('self', text); } catch (e) {}
        } else {
          // 回退：直接往 #chatMessages 追加一条我方气泡
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
        var hours = Math.round((replyTime - now) / (60 * 60 * 1000));
        alert('信件已寄出，预计 ' + hours + ' 小时后收到回信 ✉️');
      });
    });
  }

  // ==================== 初始化 ====================
  function init() {
    applyTabUI('sent');

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
    getData: function () { return envelopeData; },
    // 测试用：强制让所有 pending 信件立即到期
    forceReplies: function () {
      var now = Date.now();
      envelopeData.outbox.forEach(function (m) {
        if (m.status === 'pending') m.replyTime = now - 1;
      });
      saveData().then(function () { checkReplies(); });
    }
  };

})();
